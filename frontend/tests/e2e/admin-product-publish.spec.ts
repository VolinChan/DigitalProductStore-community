import { expect, test } from '@playwright/test';

const product = {
  id: 12, name: 'Hub USB-C', slug: 'hub-usb-c', description: '<p>Descripción</p>', short_description: '',
  brand: '', model: '', condition: 'new', warranty_text: '', status: 'draft', version: 4, category_id: 2,
  specifications: '{}', is_active: false, created_at: '', updated_at: '', skus: [], images: [], media: [],
  structured_specifications: [], variant_dimensions: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });
});

test('shows publish issues by section and navigates to the affected editor section', async ({ page }) => {
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories') {
      await route.fulfill({ json: { data: { categories: [{ id: 2, name: 'Accessories', slug: 'accessories', sort_order: 0, is_active: true }] } } });
      return;
    }
    if (path === '/api/v1/admin/products/12' && request.method() === 'GET') {
      await route.fulfill({ json: { data: product } });
      return;
    }
    if (path === '/api/v1/admin/products/12' && request.method() === 'PUT') {
      await route.fulfill({ json: { data: { message: 'saved' } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/specifications') {
      await route.fulfill({ json: { data: { specifications: [], version: 4 } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/variants/preview') {
      await route.fulfill({ json: { data: { combinations: [], kept: [], created: [], deactivated: [], deletable: [] } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/validate') {
      await route.fulfill({ json: { data: {
        product_id: 12, version: 4, can_publish: false, requires_confirmation: true,
        errors: [{ section: 'media', path: 'media.primary', code: 'PRIMARY_IMAGE_REQUIRED', message: 'Select one primary product image' }],
        warnings: [{ section: 'variants', path: 'variants.skus.31.inventory', code: 'SKU_OUT_OF_STOCK', message: 'SKU has no stock' }],
        sections: { basic: { complete: true, errors: 0, warnings: 0 }, media: { complete: false, errors: 1, warnings: 0 }, specifications: { complete: true, errors: 0, warnings: 0 }, variants: { complete: true, errors: 0, warnings: 1 }, description: { complete: true, errors: 0, warnings: 0 } },
        completion: { completed: 4, total: 5, percent: 80 },
      } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/products/12');
  await page.getByRole('button', { name: '运行发布检查' }).click();
  await expect(page.getByText('暂不可发布')).toBeVisible();
  await expect(page.getByText('1 个错误')).toBeVisible();
  await expect(page.getByText('Select one primary product image')).toBeVisible();
  await page.getByText('Select one primary product image').click();
  await expect(page.locator('#media')).toBeInViewport();
});

test('draft saving does not require category brand or model', async ({ page }) => {
  let saved = false;
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories') {
      await route.fulfill({ json: { data: { categories: [] } } });
      return;
    }
    if (path === '/api/v1/admin/products/12' && request.method() === 'GET') {
      await route.fulfill({ json: { data: { ...product, category_id: undefined } } });
      return;
    }
    if (path === '/api/v1/admin/products/12' && request.method() === 'PUT') {
      const payload = request.postDataJSON();
      saved = payload.status === 'draft' && payload.category_id === undefined && payload.brand === '' && payload.model === '';
      await route.fulfill({ json: { data: { message: 'saved' } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/specifications') {
      await route.fulfill({ json: { data: { specifications: [], version: 4 } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/variants/preview') {
      await route.fulfill({ json: { data: { combinations: [], kept: [], created: [], deactivated: [], deletable: [] } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/products/12');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect.poll(() => saved).toBe(true);
  await expect(page.getByText('草稿已保存')).toBeVisible();
});

test('opens the real product detail in an admin-only mobile preview with purchasing disabled', async ({ page, context }) => {
  let previewDataRequested = false;
  let publicDataRequested = false;
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories') {
      await route.fulfill({ json: { data: { categories: [{ id: 2, name: 'Accessories', slug: 'accessories', sort_order: 0, is_active: true }] } } });
      return;
    }
    if (path === '/api/v1/admin/products/12' && request.method() === 'GET') {
      await route.fulfill({ json: { data: product } });
      return;
    }
    if (path === '/api/v1/admin/products/12/specifications') {
      await route.fulfill({ json: { data: { specifications: [], version: 4 } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/variants/preview') {
      await route.fulfill({ json: { data: { combinations: [], kept: [], created: [], deactivated: [], deletable: [] } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/preview-token') {
      await route.fulfill({ json: { data: { token: 'preview-token', expires_at: '2026-07-29T10:10:00Z' } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/preview') {
      previewDataRequested = true;
      await route.fulfill({ json: { data: {
        ...product,
        skus: [{ id: 31, product_id: 12, sku_code: 'HUB-DEFAULT', price: 19990, inventory: 3, attributes: [], is_active: true }],
      } } });
      return;
    }
    if (path === '/api/v1/products/12') {
      publicDataRequested = true;
      await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/products/12');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /预览$/ }).click();
  const previewPage = await popupPromise;
  await previewPage.waitForURL(/\/es-CL\/products\/12\?preview_token=/);
  await previewPage.setViewportSize({ width: 390, height: 844 });
  await expect(previewPage.getByText('Vista previa.', { exact: true })).toBeVisible();
  await expect(previewPage.getByRole('heading', { name: 'Hub USB-C' })).toBeVisible();
  await expect(previewPage.getByRole('button', { name: 'Agregar al carrito' }).last()).toBeDisabled();
  await expect(previewPage.getByRole('button', { name: /Comprar ahora/ }).last()).toBeDisabled();
  expect(previewDataRequested).toBe(true);
  expect(publicDataRequested).toBe(false);
});
