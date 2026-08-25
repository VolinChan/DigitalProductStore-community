import { expect, test, type Page, type Route } from '@playwright/test';

const reportMeta = { timezone: 'America/Santiago', start_date: '2026-08-05', end_date: '2026-08-11', generated_at: '2026-08-11T12:00:00Z', source: 'order_items', coverage: { population: 'all_eligible_orders' } };

async function authenticated(page: Page, permissions: string[]) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true }, version: 0 }));
  });
  await page.route('http://localhost:8080/api/v1/auth/profile', (route) => route.fulfill({ json: { data: { id: 9, email: 'admin@example.test', full_name: 'Admin', role: 'super_admin', permissions, is_active: true } } }));
}

async function productReport(route: Route) {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [{ id: 7, name: 'Accessories', slug: 'accessories' }] } } });
  if (path.endsWith('/top-quantity') || path.endsWith('/top-revenue')) return route.fulfill({ json: { data: [{ product_id: 12, product_name: 'Measured product', quantity: 4, revenue: 1000 }], meta: reportMeta } });
  if (path.endsWith('/skus')) return route.fulfill({ json: { data: [{ sku_id: 31, sku_code: 'SKU-31', product_name: 'Measured product', quantity: 4, revenue: 1000 }], meta: reportMeta } });
  return route.fulfill({ json: { data: {}, meta: reportMeta } });
}

test('product analyst requests only permitted analytics on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticated(page, ['view_product_analytics']);
  const requested: string[] = [];
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
	if (path === '/api/v1/auth/profile') return route.fallback();
    if (path !== '/api/v1/auth/profile') requested.push(path);
    await productReport(route);
  });
  await page.goto('/admin/analytics');
  await expect(page.getByRole('heading', { name: '热门产品' })).toBeVisible();
  await expect(page.getByText('Measured product').first()).toBeVisible();
  expect(requested.some((path) => path.endsWith('/revenue') || path.endsWith('/orders') || path.endsWith('/funnel'))).toBeFalsy();
  await expect(page.getByRole('heading', { name: '销售概览' })).toHaveCount(0);
});

test('analytics shows an explicit forbidden state without making report requests', async ({ page }) => {
  const requests: string[] = [];
  await authenticated(page, ['manage_products']);
  await page.route('http://localhost:8080/api/v1/admin/analytics/**', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 403, json: { success: false, error: { code: 'FORBIDDEN', message: 'forbidden' } } });
  });

  await page.goto('/admin/analytics');
  await expect(page.getByText('你没有访问此后台功能的权限。')).toBeVisible();
  expect(requests).toEqual([]);
});

test('analytics keeps successful sections visible when sales fails', async ({ page }) => {
  await authenticated(page, ['view_sales_analytics', 'view_product_analytics', 'view_conversion_analytics', 'export_analytics']);
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
	if (path === '/api/v1/auth/profile') return route.fallback();
    if (path === '/api/v1/admin/analytics/revenue') return route.fulfill({ status: 500, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'failed' } } });
    if (path.includes('/analytics/products/') || path.endsWith('/analytics/skus') || path === '/api/v1/categories') return productReport(route);
    if (path.endsWith('/funnel')) return route.fulfill({ json: { data: { consented_sessions: 2, homepage_views: 1, product_views: 1, add_to_cart_events: 1, checkout_starts: 1, orders_completed: 1, conversion_rates: {} }, meta: { ...reportMeta, source: 'analytics_events', coverage: { population: 'consented_sessions', sessions: 2 } } } });
    if (path.endsWith('/cart-abandonment')) return route.fulfill({ json: { data: { total_carts: 1, checkout_carts: 1, abandoned_carts: 0, abandonment_rate: 0 }, meta: reportMeta } });
    return route.fulfill({ json: { data: [], meta: reportMeta } });
  });
  await page.goto('/admin/analytics');
  await expect(page.getByText('Measured product').first()).toBeVisible();
  await expect(page.getByText(/Request failed with status code 500/)).toBeVisible();
  await expect(page.getByTestId('analytics-meta').first()).toContainText('America/Santiago');
  await expect(page.getByText(/2 个匿名会话/)).toBeVisible();
});

test('single-day revenue renders as a normal chart column instead of a full-width block', async ({ page }) => {
  await authenticated(page, ['view_sales_analytics']);
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/profile') return route.fallback();
    if (path.endsWith('/revenue')) return route.fulfill({ json: { data: { total_revenue: 24666, daily_data: [{ date: '2026-08-11', revenue: 24666 }] }, meta: { ...reportMeta, source: 'orders' } } });
    if (path.endsWith('/orders')) return route.fulfill({ json: { data: { total_orders: 4, daily_data: [{ date: '2026-08-11', count: 4 }] }, meta: reportMeta } });
    if (path.endsWith('/aov')) return route.fulfill({ json: { data: { average_order_value: 6166.5 }, meta: reportMeta } });
    if (path.endsWith('/payment-distribution')) return route.fulfill({ json: { data: [{ method: 'transfer', count: 4, percentage: 100 }], meta: reportMeta } });
    if (path.endsWith('/status-distribution')) return route.fulfill({ json: { data: [{ status: 'paid', count: 4, percentage: 100 }], meta: reportMeta } });
    return route.fulfill({ json: { data: {}, meta: reportMeta } });
  });

  await page.goto('/admin/analytics');
  const chart = page.getByTestId('daily-revenue-chart');
  const bar = page.getByTestId('daily-revenue-bar');
  await expect(chart).toBeVisible();
  await expect(bar).toBeVisible();
  const chartBox = await chart.boundingBox();
  const barBox = await bar.boundingBox();
  expect(chartBox?.width).toBeGreaterThan(500);
  expect(barBox?.width).toBeLessThanOrEqual(40);
  await expect(chart).toContainText(/\$24,7\s*(?:k|mil)/);
  await expect(chart).toContainText('08-11');
});

test('staff, customers and immutable audit are separated and invitation posts', async ({ page }) => {
  await authenticated(page, ['manage_customers', 'manage_staff', 'view_access_audit']);
  let invitation: Record<string, unknown> | undefined;
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
	if (path === '/api/v1/auth/profile') return route.fallback();
    if (path === '/api/v1/admin/customers') return route.fulfill({ json: { data: { customers: [] }, meta: { total: 0 } } });
    if (path === '/api/v1/admin/staff' && request.method() === 'GET') return route.fulfill({ json: { data: { staff: [{ id: 9, email: 'admin@example.test', full_name: 'Admin', role: 'super_admin', is_active: true, permissions: ['manage_staff'], preferred_locale: 'zh-CN' }], invitations: [] } } });
    if (path === '/api/v1/admin/staff/invitations' && request.method() === 'POST') { invitation = request.postDataJSON(); return route.fulfill({ status: 201, json: { data: { id: 77, ...invitation, state: 'pending' } } }); }
    if (path === '/api/v1/admin/access-audit') return route.fulfill({ json: { data: { records: [] }, meta: { total: 0 } } });
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: '客户与人员' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '客户账号' })).toBeVisible();
  await page.getByRole('tab', { name: '员工账号' }).click();
  await page.getByRole('button', { name: '邀请员工' }).click();
  await page.getByLabel('邮箱').fill('operator@example.test');
  await page.getByLabel('姓名').fill('Operator');
  await page.getByRole('button', { name: /确\s*定|OK/ }).click();
  await expect.poll(() => invitation).toMatchObject({ email: 'operator@example.test', full_name: 'Operator', role: 'operations_manager' });
  await expect(page.getByText('员工邀请已创建并进入投递队列')).toBeVisible();
  await page.getByRole('tab', { name: '访问审计' }).click();
  await expect(page.getByPlaceholder('按动作代码筛选')).toBeVisible();
});

test('user management tabs follow the selected admin language', async ({ page }) => {
  await authenticated(page, ['manage_customers', 'manage_staff', 'view_access_audit']);
  await page.addInitScript(() => localStorage.setItem('plexoria_admin_locale', 'es-CL'));
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/profile') return route.fallback();
    if (path === '/api/v1/admin/customers') return route.fulfill({ json: { data: { customers: [] }, meta: { total: 0 } } });
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/users');
  await expect(page.getByRole('tab', { name: 'Clientes' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Personal' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Auditoría de acceso' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '客户账号' })).toHaveCount(0);
});

test('paid order ships with one semantic shipment request', async ({ page }) => {
  await authenticated(page, ['manage_orders']);
  let shipment: { path: string; method: string; body: Record<string, unknown> } | undefined;
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/profile') return route.fallback();
    if (path === '/api/v1/admin/orders' && request.method() === 'GET') return route.fulfill({ json: { data: { orders: [{ id: 20, order_number: 'ORD-20', guest_name: 'Buyer', guest_email: 'buyer@example.test', guest_phone: '+56900000000', shipping_address: 'Santiago', status: 'paid', payment_method: 'transfer', subtotal: 222, shipping_fee: 0, total_amount: 222, created_at: '2026-08-11T12:00:00Z', updated_at: '2026-08-11T12:00:00Z', items: [] }], total: 1, page: 1, page_size: 10 }, meta: { total: 1 } } });
    if (path === '/api/v1/admin/orders/20/ship' && request.method() === 'POST') {
      shipment = { path, method: request.method(), body: request.postDataJSON() };
      return route.fulfill({ json: { success: true, data: { message: 'order shipped successfully' } } });
    }
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/orders');
  await page.getByRole('button', { name: '发货' }).click();
  await page.getByLabel('物流公司').fill('test company');
  await page.getByLabel('物流单号').fill('0000000001');
  await page.getByRole('button', { name: /确\s*定|OK/ }).click();
  await expect.poll(() => shipment).toEqual({ path: '/api/v1/admin/orders/20/ship', method: 'POST', body: { shipping_carrier: 'test company', tracking_number: '0000000001' } });
  await expect(page.getByText('发货成功')).toBeVisible();
});
