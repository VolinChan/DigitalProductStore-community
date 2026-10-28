import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

const pickup = { id: 71, order_number: 'PICKUP-71', delivery_method: 'pickup', shipping_address: 'Av. Marathón 2499, Bodega 041, Macul', status: 'completed', payment_method: 'transfer', subtotal: 3990, shipping_fee: 0, total_amount: 3990, created_at: '2026-10-20T01:00:00Z', items: [] };

for (const authenticated of [false, true]) {
  test(`pickup address and progress are clear on ${authenticated ? 'account details' : 'guest tracking'}`, async ({ page }) => {
    await seedNecessaryCookieConsent(page);
    if (authenticated) await page.addInitScript(() => {
      localStorage.setItem('access_token', 'e2e-token');
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', isAuthenticated: true }, version: 0 }));
    });
    await page.route('http://localhost:8080/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/profile') return route.fulfill({ json: { data: { id: 9, role: 'customer', email: 'buyer@example.test' } } });
      if (path === '/api/v1/orders/71' || path === '/api/v1/orders/track') return route.fulfill({ json: { data: pickup } });
      return route.fulfill({ json: { data: {} } });
    });
    await page.goto(authenticated ? '/en/orders/71' : '/en/orders/track?order_number=PICKUP-71');
    if (!authenticated) {
      await expect(page.getByLabel('Order number')).toHaveValue('PICKUP-71');
      await expect(page.getByText('Warehouse pickup', { exact: true })).toHaveCount(0);
      await page.getByLabel('Purchase email').fill('buyer@example.test');
      await page.getByRole('button', { name: /Track order/ }).click();
    }
    await expect(page.getByText('Warehouse pickup', { exact: true })).toBeVisible();
    await expect(page.getByText('Pickup address', { exact: true })).toBeVisible();
    await expect(page.getByText(pickup.shipping_address, { exact: true })).toBeVisible();
    await expect(page.getByText('Preparing pickup', { exact: true })).toBeVisible();
    await expect(page.getByText('Shipped', { exact: true })).toHaveCount(0);
  });
}
