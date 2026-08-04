import { expect, test, type Page } from '@playwright/test';

const categories = [
  {
    id: 1, name: 'Accessories', slug: 'accessories', parent_id: null, sort_order: 0,
    is_active: true, product_count: 4, icon_key: 'peripherals',
    spec_template: [
      { group: 'General', label: 'Brand', key: 'brand', input_type: 'short_text', required: true, sort_order: 0 },
      { group: 'General', label: 'Model', key: 'model', input_type: 'short_text', required: false, sort_order: 1 },
    ],
    variant_template: [{ name: 'Color', sort_order: 0 }],
  },
  {
    id: 2, name: 'Cables', slug: 'cables', parent_id: 1, sort_order: 0,
    is_active: true, product_count: 2, icon_key: null, spec_template: [], variant_template: [],
  },
  {
    id: 3, name: 'Chargers', slug: 'chargers', parent_id: 1, sort_order: 1,
    is_active: false, product_count: 0, spec_template: [], variant_template: [],
  },
];

type ApiCall = { method: string; path: string; body: unknown };
let apiCalls: ApiCall[] = [];

async function mockAdmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      apiCalls.push({ method: request.method(), path, body: request.postDataJSON() });
    }
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories' && request.method() === 'GET') {
      await route.fulfill({ json: { data: { categories } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });
}

test.beforeEach(async ({ page }) => {
  apiCalls = [];
  await mockAdmin(page);
  await page.goto('/admin/categories');
  await expect(page.getByRole('heading', { name: '分类管理' })).toBeVisible();
});

test('disables a category through the admin API', async ({ page }) => {
  const row = page.getByRole('row', { name: /Accessories/ });
  await row.getByRole('switch').click();
  await expect.poll(() => apiCalls.find((call) => call.path.endsWith('/admin/categories/1'))?.body)
    .toEqual({ is_active: false });
});

test('previews inherited fields and saves a child template override', async ({ page }) => {
  await page.getByRole('row', { name: /Cables/ }).getByRole('button', { name: /编辑/ }).click();
  await page.getByRole('tab', { name: '规格模板' }).click();
  await expect(page.getByText('继承 2 项，自定义/覆盖 0 项')).toBeVisible();
  await page.getByRole('button', { name: '添加规格字段' }).click();
  await page.getByLabel('分组').fill('General');
  await page.getByLabel('显示名称').fill('Connector');
  await page.getByLabel('内部 key').fill('connector');

  await page.getByRole('button', { name: /保\s*存/ }).dispatchEvent('click');
  await expect.poll(() => apiCalls.some((call) => call.path.endsWith('/admin/categories/2'))).toBe(true);
  const body = apiCalls.find((call) => call.path.endsWith('/admin/categories/2'))?.body as Record<string, unknown>;
  expect(body.spec_template).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'connector' })]));
});

test('previews and persists a controlled category icon', async ({ page }) => {
  await page.getByRole('row', { name: /Cables/ }).getByRole('button', { name: /编辑/ }).click();
  await page.getByRole('button', { name: 'USB y cables / USB and cables' }).click();
  await expect(page.getByText(/预览：USB y cables/)).toBeVisible();
  await page.getByRole('button', { name: /保\s*存/ }).dispatchEvent('click');

  await expect.poll(() => apiCalls.find((call) => call.path.endsWith('/admin/categories/2'))?.body)
    .toEqual(expect.objectContaining({ icon_key: 'usb' }));
});

test('reorders sibling categories by dragging rows', async ({ page }) => {
  await page.getByRole('row', { name: /Chargers/ }).dragTo(page.getByRole('row', { name: /Cables/ }));
  await expect.poll(() => apiCalls.find((call) => call.path.endsWith('/admin/categories/reorder'))?.body).toEqual({
    items: [{ id: 3, sort_order: 0 }, { id: 2, sort_order: 1 }],
  });
});

test('shows a conflict message when deleting a non-empty category', async ({ page }) => {
  await page.route('http://localhost:8080/api/v1/admin/categories/1', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 409, json: { message: 'category has products' } });
      return;
    }
    await route.fallback();
  });
  await page.getByRole('row', { name: /Accessories/ }).getByRole('button', { name: /删除/ }).click();
  await page.getByRole('tooltip').getByRole('button', { name: /删\s*除/ }).click();
  await expect(page.getByText('无法删除仍含商品或子分类的分类')).toBeVisible();
});
