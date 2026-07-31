import { expect, test } from '@playwright/test';

test('keeps a failed online payment on the payment page and allows retry', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cart-storage', JSON.stringify({
      state: {
        items: [{
          id: 1,
          sku_id: 31,
          sku_code: 'TEST-SKU',
          sku_name: 'Test product',
          quantity: 1,
          unit_price: 12990,
          subtotal: 12990,
        }],
        totalPrice: 12990,
        totalItems: 1,
      },
      version: 0,
    }));
  });

  let sessionRequests = 0;
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/v1/orders' && request.method() === 'POST') {
      expect(request.postDataJSON()).toMatchObject({
        payment_method: 'online',
        items: [{ sku_id: 31, quantity: 1 }],
      });
      await route.fulfill({
        status: 201,
        json: { data: { id: 77, order_number: 'ORD-77', total_amount: 12990 } },
      });
      return;
    }

    if (path === '/api/v1/payments/online/session' && request.method() === 'POST') {
      sessionRequests += 1;
      expect(request.postDataJSON()).toEqual({ order_id: 77 });
      await route.fulfill({
        status: 500,
        json: { error: { message: 'payment service misconfigured' } },
      });
      return;
    }

    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/checkout');
  await page.getByLabel('Full name').fill('Test Buyer');
  await page.getByLabel('Email address').fill('buyer@example.com');
  await page.getByLabel('Contact phone').fill('+56912345678');
  await page.getByLabel('Region').fill('Metropolitana');
  await page.getByLabel('Commune').fill('Santiago');
  await page.getByLabel('Shipping address').fill('Test Street 123');
  await page.getByRole('button', { name: 'Submit & pay' }).click();

  await expect(page).toHaveURL(/\/en\/checkout\/payment\?order_id=77&order_number=ORD-77&method=online/);
  await expect(page.getByText('Payment failed')).toBeVisible();
  await expect(page.getByText(/ORD-77.*payment service misconfigured/)).toBeVisible();
  await expect.poll(() => sessionRequests).toBe(1);
  await expect(page.getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en/orders/77');

  await page.getByRole('button', { name: 'Click here to retry' }).click();
  await expect.poll(() => sessionRequests).toBe(2);
  await expect(page).not.toHaveURL(/checkout\/success/);
});

test('keeps the manual transfer checkout and does not create a Stripe session', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cart-storage', JSON.stringify({
      state: {
        items: [{
          id: 1,
          sku_id: 31,
          sku_code: 'TEST-SKU',
          sku_name: 'Test product',
          quantity: 1,
          unit_price: 12990,
          subtotal: 12990,
        }],
        totalPrice: 12990,
        totalItems: 1,
      },
      version: 0,
    }));
  });

  let sessionRequests = 0;
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/v1/orders' && request.method() === 'POST') {
      expect(request.postDataJSON()).toMatchObject({
        payment_method: 'transfer',
        items: [{ sku_id: 31, quantity: 1 }],
      });
      await route.fulfill({
        status: 201,
        json: { data: { id: 78, order_number: 'ORD-78', total_amount: 12990 } },
      });
      return;
    }

    if (path === '/api/v1/payments/online/session') {
      sessionRequests += 1;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/checkout');
  await page.getByLabel('Full name').fill('Transfer Buyer');
  await page.getByLabel('Email address').fill('transfer@example.com');
  await page.getByLabel('Contact phone').fill('+56912345678');
  await page.getByLabel('Region').fill('Metropolitana');
  await page.getByLabel('Commune').fill('Santiago');
  await page.getByLabel('Shipping address').fill('Transfer Street 123');
  await page.getByRole('radio', { name: /Bank transfer/ }).check();
  await page.getByRole('button', { name: 'Submit order' }).click();

  await expect(page).toHaveURL(/\/en\/checkout\/payment\?order_id=78&order_number=ORD-78&amount=12990&method=transfer/);
  await expect(page.getByRole('heading', { name: 'Bank transfer payment' })).toBeVisible();
  await expect(page.getByText('Banco de Prueba', { exact: true })).toBeVisible();
  await expect(page.getByText('PLEXORIA Test', { exact: true })).toBeVisible();
  await expect(page.getByText('123456789', { exact: true })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'ORD-78' })).toBeVisible();
  await expect(page.getByText(/12,990/, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en/orders/78');
  expect(sessionRequests).toBe(0);
});
