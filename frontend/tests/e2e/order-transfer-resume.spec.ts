import { expect, test } from '@playwright/test';

const transferAccounts = [
  { id: 1, bank_name: 'Banco Histórico', account_name: 'PLEXORIA SpA', rut: '76.123.456-7', account_type: 'Cuenta Corriente', account_number: '998877', email: 'pagos@example.com', sort_order: 0, is_active: true },
];

const order = {
  id: 78,
  order_number: 'ORD-78',
  user_id: 9,
  shipping_address: 'Santiago',
  status: 'pending_payment',
  payment_method: 'transfer',
  subtotal: 12990,
  shipping_fee: 0,
  total_amount: 12990,
  items: [],
  transfer_account_snapshot: transferAccounts,
  created_at: '2026-08-06T01:00:00Z',
  updated_at: '2026-08-06T01:00:00Z',
};

test('pending manual transfer can be resumed from order history with its account snapshot', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', refreshToken: 'refresh-token', isAuthenticated: true }, version: 0 }));
  });
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/profile') return route.fulfill({ json: { data: { id: 9, email: 'buyer@example.com', full_name: 'Buyer', role: 'customer' } } });
    if (path === '/api/v1/notifications/unread-count') return route.fulfill({ json: { data: { count: 0 } } });
    if (path === '/api/v1/orders/78') return route.fulfill({ json: { data: order } });
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: false, accounts: [] } } });
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/orders/78');
  await expect(page.getByText('Awaiting transfer proof', { exact: true })).toBeVisible();
  const resume = page.getByRole('link', { name: 'Continue bank transfer' });
  await expect(resume).toHaveAttribute('href', '/en/checkout/payment?order_id=78&order_number=ORD-78&amount=12990&method=transfer');
  await resume.click();

  await expect(page).toHaveURL(/\/en\/checkout\/payment\?order_id=78/);
  await expect(page.getByRole('heading', { name: 'Bank transfer payment' })).toBeVisible();
  await expect(page.getByText('Banco Histórico', { exact: true })).toBeVisible();
  await expect(page.getByText('998877', { exact: true })).toBeVisible();
});
