import { expect, test } from '@playwright/test';

test('merges inherited category specifications without overwriting entered values', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories') {
      await route.fulfill({ json: { data: { categories: [
        { id: 1, name: 'Accessories', slug: 'accessories', parent_id: null, sort_order: 0, is_active: true, spec_template: [
          { group: 'General', label: 'Brand', key: 'brand', input_type: 'short_text', sort_order: 0 },
        ] },
        { id: 2, name: 'Cables', slug: 'cables', parent_id: 1, sort_order: 0, is_active: true, spec_template: [
          { group: 'General', label: 'Connector', key: 'connector', input_type: 'short_text', sort_order: 1 },
        ] },
      ] } } });
      return;
    }
    if (path === '/api/v1/admin/products/1' && route.request().method() === 'GET') {
      await route.fulfill({ json: { data: {
        id: 1, name: 'Cable', slug: 'cable', description: '', specifications: '{}', category_id: 1, condition: 'new',
        status: 'draft', is_active: false, version: 1, created_at: '', updated_at: '', images: [], media: [], skus: [],
        structured_specifications: [], variant_dimensions: [],
      } } });
      return;
    }
    if (path === '/api/v1/admin/products/1/specifications') {
      await route.fulfill({ json: { data: { specifications: [{
        id: 1, group_name: 'General', spec_key: 'brand', label: 'Brand', input_type: 'short_text',
        value_text: 'Acme', sort_order: 0, from_template: true,
      }], version: 1 } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/products/1');
  await expect(page.getByRole('heading', { name: '编辑商品' })).toBeVisible();
  await expect(page.getByPlaceholder('spec_key')).toHaveValue('brand');
  await page.getByLabel('分类').click();
  await page.getByText('Cables', { exact: true }).click();

  await expect(page.getByPlaceholder('spec_key')).toHaveCount(2);
  await expect(page.getByPlaceholder('spec_key').nth(0)).toHaveValue('brand');
  await expect(page.getByPlaceholder('spec_key').nth(0).locator('xpath=../following-sibling::input[1]')).toHaveValue('Acme');
  await expect(page.getByPlaceholder('spec_key').nth(1)).toHaveValue('connector');
});
