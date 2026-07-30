import { expect, test } from '@playwright/test';

test('renders the English order detail page without Chinese hardcoding and keeps localized links', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        token: 'e2e-token',
        refreshToken: 'refresh-token',
        isAuthenticated: true,
      },
      version: 0,
    }));
  });

  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({
        json: { data: { id: 9, email: 'buyer@example.com', full_name: 'Test Buyer', role: 'customer' } },
      });
      return;
    }
    if (path === '/api/v1/orders/3') {
      await route.fulfill({
        json: {
          data: {
            id: 3,
            order_number: 'ORD-3',
            shipping_address: 'Test Street 123',
            status: 'pending_payment',
            payment_method: 'online',
            subtotal: 120,
            shipping_fee: 0,
            total_amount: 120,
            created_at: '2026-07-30T09:00:00Z',
            updated_at: '2026-07-30T09:00:00Z',
            items: [{
              id: 1,
              order_id: 3,
              sku_id: 31,
              sku_name: 'USB Cable',
              sku_code: 'USB-01',
              attributes: 'Color: Black',
              quantity: 1,
              unit_price: 120,
              subtotal: 120,
            }],
          },
        },
      });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/orders/3');

  await expect(page.getByRole('heading', { name: 'Order details' })).toBeVisible();
  await expect(page.getByText('Pending payment').first()).toBeVisible();
  await expect(page.getByText('Payment information')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to orders' })).toHaveAttribute('href', '/en/orders');
  await expect(page.locator('body')).not.toContainText(/订单|支付信息|待支付|取消订单/);

  await page.getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.locator('.ant-modal-confirm-title')).toHaveText('Confirm order cancellation?');
  await expect(page.getByRole('button', { name: 'Confirm cancellation' })).toBeVisible();
});
