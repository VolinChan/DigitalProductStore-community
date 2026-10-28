import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

test('order history requests each page and restores it after browser navigation', async ({ page, context }) => {
  await seedNecessaryCookieConsent(page);
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', isAuthenticated: true }, version: 0 }));
  });
  const offsets: number[] = [];
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/auth/profile') return route.fulfill({ json: { data: { id: 9, email: 'buyer@example.com', role: 'customer' } } });
    if (url.pathname === '/api/v1/orders') {
      expect(url.searchParams.get('limit')).toBe('10');
      const offset = Number(url.searchParams.get('offset'));
      offsets.push(offset);
      const orders = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, order_number: `ORDER-${index + 1}`, status: 'pending_payment', payment_method: 'transfer', total_amount: 6990, created_at: '2026-09-06T09:00:00Z' })).slice(offset, offset + 10);
      return route.fulfill({ json: { data: { orders, total: 11, page: offset / 10 + 1, page_size: 10 } } });
    }
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto('/en/orders');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('status')).toContainText('11 orders · Showing 1–10');
  const pages = page.getByRole('navigation', { name: 'Order pages' });
  await expect(pages.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await pages.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/en\/orders\?page=2$/);
  await expect(page.getByRole('status')).toContainText('Showing 11–11');
  await expect(page.getByText('ORDER-11', { exact: true })).toBeVisible();
  await expect(pages.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.goBack();
  await expect(page.getByText('ORDER-1', { exact: true })).toBeVisible();
  expect(offsets).toContain(10);
});
