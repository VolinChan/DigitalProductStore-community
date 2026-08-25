import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

for (const width of [320, 390]) {
  test(`order tracking fields and header search keep usable spacing at ${width}px`, async ({ page, context }) => {
    await seedNecessaryCookieConsent(page);
    await context.route('http://localhost:8080/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/products/search') return route.fulfill({ json: { data: { products: [], total: 0 } } });
      if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [] } } });
      if (path === '/api/v1/cart') return route.fulfill({ json: { data: { id: 0, revision: 0, currency: 'CLP', items: [], issues: [], subtotal: 0, total_items: 0 } } });
      return route.fulfill({ json: { data: {} } });
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/en/orders/track');

    const card = page.getByTestId('order-tracking-card');
    const orderNumber = page.getByLabel('Order number');
    const email = page.getByLabel('Purchase email');
    const controls = [page.locator('.ant-input-affix-wrapper').filter({ has: orderNumber }), email];
    await expect(card).toBeVisible();
    for (const input of controls) {
      await expect(input).toBeVisible();
      const cardBox = await card.boundingBox();
      const inputBox = await input.boundingBox();
      expect(cardBox && inputBox).toBeTruthy();
      expect(inputBox!.x - cardBox!.x).toBeGreaterThanOrEqual(19);
      expect(cardBox!.x + cardBox!.width - inputBox!.x - inputBox!.width).toBeGreaterThanOrEqual(19);
      // Chromium may report a CSS 48px control as 47.99997px after subpixel
      // layout at narrow viewports. Keep the accessibility threshold while
      // avoiding a false failure from floating-point geometry.
      expect(inputBox!.height).toBeGreaterThanOrEqual(47.9);
    }

    const visibleSearch = page.locator('form[role="search"]:visible');
    const searchbox = visibleSearch.getByRole('searchbox', { name: 'Search' });
    await searchbox.focus();
    await expect(searchbox).toHaveCSS('outline-style', 'none');
    await searchbox.fill('usb hub');
    await expect(visibleSearch.getByRole('button', { name: 'Close search' })).toBeVisible();
    await visibleSearch.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/products\/search\?q=usb%20hub$/);
    await expect(page.locator('form[role="search"]:visible').getByRole('searchbox', { name: 'Search' })).toHaveValue('usb hub');

    const cookieButton = page.getByRole('button', { name: 'Cookie preferences' });
    await expect(cookieButton).toHaveCSS('border-top-width', '0px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('order tracking renders JSON attribute snapshots as readable variant text', async ({ page, context }) => {
  await seedNecessaryCookieConsent(page);
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/orders/track') {
      return route.fulfill({ json: { data: {
        id: 15,
        order_number: 'ORD-TRACK-15',
        status: 'pending_transfer',
        payment_method: 'transfer',
        total_amount: 110,
        created_at: '2026-08-04T00:00:00Z',
        items: [{
          id: 1,
          order_id: 15,
          sku_id: 59,
          sku_name: 'USB-C-LINE2',
          sku_code: 'P40-B69A9993',
          attributes: '{"Color":"Yellow","Length":"1m"}',
          quantity: 1,
          unit_price: 110,
          subtotal: 110,
        }],
      } } });
    }
    if (path === '/api/v1/products/search') return route.fulfill({ json: { data: { products: [], total: 0 } } });
    if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [] } } });
    if (path === '/api/v1/cart') return route.fulfill({ json: { data: { id: 0, revision: 0, currency: 'CLP', items: [], issues: [], subtotal: 0, total_items: 0 } } });
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/orders/track');
  await page.getByLabel('Order number').fill('ORD-TRACK-15');
  await page.getByLabel('Purchase email').fill('buyer@example.com');
  await page.getByRole('button', { name: /Track order/ }).click();

  await expect(page.getByText('Color: Yellow · Length: 1m', { exact: true })).toBeVisible();
  await expect(page.getByText('{"Color":"Yellow","Length":"1m"}', { exact: true })).toHaveCount(0);
});
