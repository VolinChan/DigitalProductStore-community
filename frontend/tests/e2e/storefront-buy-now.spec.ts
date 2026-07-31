import { expect, test } from '@playwright/test';

const product = {
  id: 22,
  name: 'Compact USB-C Hub',
  description: 'A useful hub for everyday connections.',
  specifications: '{}',
  status: 'published',
  is_active: true,
  created_at: '2026-07-30T09:00:00Z',
  updated_at: '2026-07-30T09:00:00Z',
  images: [],
  skus: [{ id: 220, product_id: 22, sku_code: 'HUB-220', price: 15990, inventory: 4, attributes: [], is_active: true }],
};

test.beforeEach(async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cart-storage', JSON.stringify({ state: { items: [{ id: 1, sku_id: 31, sku_code: 'CART-ITEM', sku_name: 'Existing cart item', quantity: 1, unit_price: 4990, subtotal: 4990 }], totalPrice: 4990, totalItems: 1 }, version: 0 }));
  });
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/products/22') { await route.fulfill({ json: { data: product } }); return; }
    if (path === '/api/v1/orders' && request.method() === 'POST') {
      expect(request.postDataJSON()).toMatchObject({ payment_method: 'transfer', items: [{ sku_id: 220, quantity: 1 }] });
      await route.fulfill({ status: 201, json: { data: { id: 90, order_number: 'ORD-90', total_amount: 15990 } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });
});

test('buy now checks out only the selected SKU and preserves the normal cart', async ({ page }) => {
  await page.goto('/en/products/22');
  await page.getByRole('button', { name: 'Buy now' }).first().click();
  await expect(page).toHaveURL(/\/en\/checkout\?mode=buy_now$/);
  await expect(page.getByText('Compact USB-C Hub')).toBeVisible();
  await expect(page.getByText('Existing cart item')).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Compact USB-C Hub')).toBeVisible();
  await expect(page.getByText('Existing cart item')).toHaveCount(0);

  await page.getByLabel('Full name').fill('Buy Now Buyer');
  await page.getByLabel('Email address').fill('buyer@example.com');
  await page.getByLabel('Contact phone').fill('+56912345678');
  await page.getByLabel('Region').fill('Metropolitana');
  await page.getByLabel('Commune').fill('Santiago');
  await page.getByLabel('Shipping address').fill('Test Street 123');
  await page.getByRole('radio', { name: /Bank transfer/ }).check();
  await page.getByRole('button', { name: 'Submit order' }).click();
  await expect(page).toHaveURL(/\/en\/checkout\/payment\?order_id=90&order_number=ORD-90&amount=15990&method=transfer/);

  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('cart-storage') || '{}'));
  expect(cart.state.items).toHaveLength(1);
  expect(cart.state.items[0].sku_id).toBe(31);
});

test('expired buy-now intent does not fall back to the normal cart', async ({ page }) => {
  await page.goto('/en/products/22');
  await page.evaluate(() => sessionStorage.setItem('plexoria-checkout-intent', JSON.stringify({ state: { buyNow: { mode: 'buy_now', productId: 22, skuId: 220, quantity: 1, createdAt: 1 } }, version: 0 })));
  await page.goto('/en/checkout?mode=buy_now');
  await expect(page.getByRole('heading', { name: 'This direct purchase is no longer available' })).toBeVisible();
  await expect(page.getByText('Existing cart item')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to product' })).toHaveAttribute('href', '/en/products/22');
});

test('unavailable SKU and insufficient inventory are rejected without exposing the normal cart', async ({ page }) => {
  await page.goto('/en/products/22');
  for (const intent of [
    { productId: 22, skuId: 999, quantity: 1 },
    { productId: 22, skuId: 220, quantity: 5 },
  ]) {
    await page.evaluate((value) => sessionStorage.setItem('plexoria-checkout-intent', JSON.stringify({ state: {
      buyNow: { mode: 'buy_now', ...value, createdAt: Date.now() },
    }, version: 0 })), intent);
    await page.goto('/en/checkout?mode=buy_now');
    await expect(page.getByRole('heading', { name: 'This direct purchase is no longer available' })).toBeVisible();
    await expect(page.getByText('Existing cart item')).toHaveCount(0);
  }
});

test('checkout re-fetches price and never submits a client price', async ({ page, context }) => {
  let orderPayload: Record<string, unknown> | undefined;
  await context.unroute('http://localhost:8080/api/v1/**');
  await context.route('http://localhost:8080/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/products/22') {
      await route.fulfill({ json: { data: { ...product, skus: [{ ...product.skus[0], price: 21990, inventory: 2 }] } } });
      return;
    }
    if (path === '/api/v1/orders' && request.method() === 'POST') {
      orderPayload = request.postDataJSON();
      await route.fulfill({ status: 201, json: { data: { id: 91, order_number: 'ORD-91', total_amount: 21990 } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/products/22');
  await page.evaluate(() => sessionStorage.setItem('plexoria-checkout-intent', JSON.stringify({ state: {
    buyNow: { mode: 'buy_now', productId: 22, skuId: 220, quantity: 1, createdAt: Date.now(), price: 1 },
  }, version: 0 })));
  await page.goto('/en/checkout?mode=buy_now');
  await expect(page.getByText('CLP 21,990').first()).toBeVisible();
  await page.getByLabel('Full name').fill('Current Price Buyer');
  await page.getByLabel('Email address').fill('buyer@example.com');
  await page.getByLabel('Contact phone').fill('+56912345678');
  await page.getByLabel('Region').fill('Metropolitana');
  await page.getByLabel('Commune').fill('Santiago');
  await page.getByLabel('Shipping address').fill('Test Street 123');
  await page.getByRole('radio', { name: /Bank transfer/ }).check();
  await page.getByRole('button', { name: 'Submit order' }).click();
  await expect(page).toHaveURL(/order_id=91/);
  expect(orderPayload).toMatchObject({ items: [{ sku_id: 220, quantity: 1 }] });
  expect(JSON.stringify(orderPayload)).not.toContain('price');
});
