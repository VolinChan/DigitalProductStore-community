import { expect, test, type Page } from '@playwright/test';

let savedRule: Record<string, unknown> | null;
let savedSubsidy: Record<string, unknown> | null;

async function mockShippingAdmin(page: Page) {
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
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin', permissions: ['manage_shipping'], is_active: true } } });
      return;
    }
    if (path === '/api/v1/admin/shipping/regions') {
      await route.fulfill({ json: { data: [{ id: 1, location_code: 'CL-RM', name: 'Metropolitana', sort_order: 1, is_active: true }] } });
      return;
    }
    if (path === '/api/v1/admin/shipping/regions/1/communes') {
      await route.fulfill({ json: { data: [{ id: 1, region_id: 1, location_code: 'CL-SCL', name: 'Santiago', sort_order: 1, is_active: true }] } });
      return;
    }
    if (path === '/api/v1/admin/shipping/templates') {
      await route.fulfill({ json: { data: [{ id: 1, name: 'Default', quantity_mode: 'per_order', is_default: true, is_active: true }] } });
      return;
    }
    if (path === '/api/v1/admin/shipping/rules' && request.method() === 'GET') {
      await route.fulfill({ json: { data: [{
        id: 77,
        template_id: 1,
        template: { id: 1, name: 'Default', quantity_mode: 'per_order', is_default: true, is_active: true },
        scope: 'commune',
        region_id: 1,
        commune_id: 1,
        base_amount: 3300,
        remote_surcharge: 100,
        remote_assessment_required: false,
        priority: 0,
        minimum_quantity: 1,
        effective_at: '2026-07-31T16:00:00.000Z',
        expires_at: '2038-08-13T16:00:00.000Z',
        is_active: true,
      }] } });
      return;
    }
    if (path === '/api/v1/admin/shipping/subsidies' && request.method() === 'GET') {
      await route.fulfill({ json: { data: [{ id: 8, name: 'Free delivery', subtotal_threshold: 19900, subsidy_cap: 9999, rounding_unit: 100, include_region_ids: [1], exclude_region_ids: [9], include_commune_ids: [99], exclude_commune_ids: [100], subsidize_remote_surcharge: false, effective_at: '2026-08-01T00:00:00Z', expires_at: '2030-08-01T00:00:00Z', priority: 1, is_active: true }] } });
      return;
    }
    if (path === '/api/v1/admin/shipping/subsidies/8' && request.method() === 'PUT') {
      savedSubsidy = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { data: savedSubsidy } });
      return;
    }
    if (path === '/api/v1/admin/shipping/locations/preview' && request.method() === 'POST') {
      await route.fulfill({ json: { data: { rows: [{ region_code: 'RM', commune_code: '13101' }], errors: null } } });
      return;
    }
    if (path === '/api/v1/admin/shipping/rules/77' && request.method() === 'PUT') {
      savedRule = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 400,
        json: { success: false, error: { code: 'BAD_REQUEST', message: 'invalid shipping configuration' } },
      });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });
}

test('region rules omit stale commune values and show API errors', async ({ page }) => {
  savedRule = null;
  await mockShippingAdmin(page);
  await page.goto('/admin/fulfillment/rates');

  await page.getByRole('tab', { name: '区域规则' }).click();
  await page.getByRole('button', { name: /编\s*辑/ }).click();
  await page.getByLabel('范围').click();
  await page.locator('.ant-select-dropdown:visible').getByText('大区（Región）', { exact: true }).click();

  await expect(page.getByRole('combobox', { name: /市镇（Comuna）/ })).toHaveCount(0);
  await page.getByRole('button', { name: '保存规则' }).click();

  await expect.poll(() => savedRule).not.toBeNull();
  expect(savedRule).toMatchObject({ scope: 'region', region_id: 1 });
  expect(savedRule).not.toHaveProperty('commune_id');
  await expect(page.getByText('invalid shipping configuration', { exact: true })).toBeVisible();
});

test('subsidy editor uses named regions and omits hidden compatibility arrays', async ({ page }) => {
  savedSubsidy = null;
  await mockShippingAdmin(page);
  await page.goto('/admin/fulfillment/rates');
  await page.getByRole('tab', { name: '补贴', exact: true }).click();
  await page.getByRole('button', { name: /编\s*辑/ }).click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Metropolitana' })).toBeVisible();
  await expect(page.getByText('留空表示适用于全部大区。')).toBeVisible();
  await expect(page.getByText(/exclude_region_ids|include_commune_ids|exclude_commune_ids/)).toHaveCount(0);
  await page.getByRole('button', { name: '保存补贴' }).click();
  await expect.poll(() => savedSubsidy).not.toBeNull();
  expect(savedSubsidy).toMatchObject({ include_region_ids: [1] });
  expect(savedSubsidy).not.toHaveProperty('exclude_region_ids');
  expect(savedSubsidy).not.toHaveProperty('include_commune_ids');
  expect(savedSubsidy).not.toHaveProperty('exclude_commune_ids');
});

test('location workbook preview handles a null errors field without crashing', async ({ page }) => {
  await mockShippingAdmin(page);
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('/admin/shipping');
  await expect(page).toHaveURL(/\/admin\/fulfillment\/locations$/);

  await page.locator('input[type="file"][accept=".xlsx"]').setInputFiles({
    name: 'chile-locations-template.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('mock workbook'),
  });
  await page.getByRole('button', { name: /预\s*览/ }).click();

  await expect(page.getByText('有效行：1；错误：0')).toBeVisible();
  await expect(page.getByRole('button', { name: /确认导入版本/ })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});
