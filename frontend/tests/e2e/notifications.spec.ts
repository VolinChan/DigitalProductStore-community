import { expect, test } from '@playwright/test';

async function seedAuthentication(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', refreshToken: 'refresh-token', isAuthenticated: true }, version: 0 }));
  });
}

test('registered user reads localized notifications on mobile', async ({ page, context }) => {
  await seedAuthentication(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const calls: string[] = [];
  const notification = {
    id: 71,
    user_id: 9,
    event_key: 'paid:order:91:v1',
    event_type: 'paid',
    locale: 'en',
    title: 'Payment confirmed',
    body_summary: 'Payment confirmed · ORD-91. Review the status and next steps in your account.',
    deep_link: '/en/orders/track?order_number=ORD-91',
    read_at: null,
    created_at: '2026-08-03T09:00:00Z',
  };
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') calls.push(`${request.method()} ${path}`);
    if (path === '/api/v1/auth/profile') return route.fulfill({ json: { data: { id: 9, email: 'buyer@example.com', full_name: 'Buyer', role: 'customer' } } });
    if (path === '/api/v1/notifications/unread-count') return route.fulfill({ json: { data: { count: 1 } } });
    if (path === '/api/v1/notifications') return route.fulfill({ json: { data: [notification], meta: { total: 1 } } });
    if (path === '/api/v1/notifications/71/read' || path === '/api/v1/notifications/read-all') return route.fulfill({ status: 204, body: '' });
    if (path === '/api/v1/orders/track') return route.fulfill({ json: { data: {} } });
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText('Payment confirmed', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Unread')).toBeVisible();
  await page.getByRole('link', { name: /Payment confirmed/ }).click();
  await expect(page).toHaveURL(/\/en\/orders\/track\?order_number=ORD-91/);
  await expect.poll(() => calls).toContain('POST /api/v1/notifications/71/read');
});

test('notification administrator filters delivery state and creates a new retry attempt', async ({ page, context }) => {
  await seedAuthentication(page);
  const listQueries: URLSearchParams[] = [];
  const calls: string[] = [];
  const attempt = {
    id: 31,
    outbox_id: 21,
    attempt_number: 1,
    provider: 'resend',
    provider_message_id: 'mail-31',
    status: 'failed',
    diagnostic_code: 'RATE_LIMITED',
    created_at: '2026-08-03T09:00:00Z',
    outbox: { id: 21, event_type: 'paid', recipient_email: 'buyer@example.com' },
  };
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/auth/profile') return route.fulfill({ json: { data: { id: 2, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
    if (url.pathname === '/api/v1/admin/notification-deliveries' && request.method() === 'GET') {
      listQueries.push(url.searchParams);
      return route.fulfill({ json: { data: [attempt], meta: { total: 1 } } });
    }
    if (url.pathname === '/api/v1/admin/notification-deliveries/21/retry') {
      calls.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ json: { data: { message: 'queued' } } });
    }
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/notifications');
  await expect(page.getByRole('heading', { name: '通知投递中心' })).toBeVisible();
  await page.getByRole('combobox').first().click();
  await page.locator('.ant-select-item-option[title="delivered"]').click();
  await expect.poll(() => listQueries.some((query) => query.get('status') === 'delivered')).toBe(true);
  await page.getByRole('button', { name: '以新 attempt 重发' }).click();
  await expect.poll(() => calls).toContain('POST /api/v1/admin/notification-deliveries/21/retry');
});
