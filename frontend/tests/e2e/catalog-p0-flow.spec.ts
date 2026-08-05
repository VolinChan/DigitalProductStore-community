import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

test('creates and publishes a catalog product, then selects its SKU and adds it to the cart', async ({ page, context }) => {
  test.setTimeout(90_000);
  await seedNecessaryCookieConsent(page);
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });

  const category = {
    id: 7, name: 'Cables', slug: 'cables', parent_id: null, sort_order: 0, is_active: true, product_count: 0,
    spec_template: [{ group: 'General', label: 'Connector', key: 'connector', input_type: 'short_text', required: true, sort_order: 0 }],
    variant_template: [{ name: 'Color', sort_order: 0 }],
  };
  const asset = {
    id: 21, kind: 'image', storage_key: 'products/images/21.jpg', url: '/placeholder-product.svg',
    mime_type: 'image/jpeg', size_bytes: 4, alt_text: 'Black braided cable', created_at: '', updated_at: '',
  };
  let categories: typeof category[] = [];
  let media: Array<Record<string, unknown>> = [];
  let specifications: Array<Record<string, unknown>> = [];
  let skus: Array<Record<string, unknown>> = [];
  let variantDimensions: Array<Record<string, unknown>> = [];
  let published = false;
  let cartAdded: { sku_id: number; quantity: number } | undefined;

  const product = () => ({
    id: 42, name: 'Cable USB-C trenzado', slug: 'cable-usb-c-trenzado', description: 'Carga rápida y durable.',
    description_html: '<p>Carga rápida y durable.</p>', short_description: '', brand: '', model: '', condition: 'new',
    warranty_text: '', category_id: 7, category, specifications: '{}', status: published ? 'published' : 'draft',
    is_active: published, version: 1, created_at: '', updated_at: '', images: [], media, skus,
    structured_specifications: specifications, variant_dimensions: variantDimensions,
  });

  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories' && method === 'GET') {
      await route.fulfill({ json: { data: { categories } } });
      return;
    }
    if (path === '/api/v1/admin/categories' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({ name: 'Cables', slug: 'cables', is_active: true });
      categories = [category];
      await route.fulfill({ status: 201, json: { data: category } });
      return;
    }
    if (path === '/api/v1/admin/products' && method === 'POST') {
      expect(request.postDataJSON()).toMatchObject({ name: 'Cable USB-C trenzado', category_id: 7, status: 'draft' });
      await route.fulfill({ status: 201, json: { data: product() } });
      return;
    }
    if (path === '/api/v1/admin/products/42' && method === 'GET') {
      await route.fulfill({ json: { data: product() } });
      return;
    }
    if (path === '/api/v1/admin/products/42' && method === 'PUT') {
      await route.fulfill({ json: { data: product() } });
      return;
    }
    if (path === '/api/v1/admin/media/images' && method === 'POST') {
      await route.fulfill({ status: 201, json: { data: asset } });
      return;
    }
    if (path === '/api/v1/admin/products/42/media' && method === 'PUT') {
      const body = request.postDataJSON() as { media: Array<Record<string, unknown>> };
      expect(body.media).toEqual([expect.objectContaining({ media_asset_id: 21, is_primary: true })]);
      media = body.media.map((item, index) => ({ ...item, id: index + 1, media_asset: asset }));
      await route.fulfill({ json: { data: { media } } });
      return;
    }
    if (path === '/api/v1/admin/products/42/specifications' && method === 'GET') {
      const rows = specifications.length ? specifications : [{
        group_name: 'General', spec_key: 'connector', label: 'Connector', input_type: 'text',
        sort_order: 0, required: true, from_template: true,
      }];
      await route.fulfill({ json: { data: { specifications: rows, version: 1 } } });
      return;
    }
    if (path === '/api/v1/admin/products/42/specifications' && method === 'PUT') {
      const body = request.postDataJSON() as { specifications: Array<Record<string, unknown>> };
      expect(body.specifications[0]).toMatchObject({ spec_key: 'connector', value_text: 'USB-C' });
      specifications = body.specifications.map((item, index) => ({ ...item, id: index + 1 }));
      await route.fulfill({ json: { data: { version: 2 } } });
      return;
    }
    if (path === '/api/v1/admin/products/42/variants/preview') {
      await route.fulfill({ json: { data: { kept: [], created: [{}], deactivated: [], deletable: [] } } });
      return;
    }
    if (path === '/api/v1/admin/products/42/variants' && method === 'PUT') {
      expect(request.postDataJSON()).toMatchObject({ dimensions: [{ name: 'Color', values: [{ value: 'Black' }] }] });
      variantDimensions = [{ id: 51, product_id: 42, name: 'Color', sort_order: 0, values: [{ id: 52, dimension_id: 51, value: 'Black', sort_order: 0 }] }];
      skus = [{ id: 31, product_id: 42, sku_code: 'AUTO-31', price: 1, inventory: 0, is_active: true, attributes: [{ id: 61, sku_id: 31, name: 'Color', value: 'Black' }], media: [] }];
      await route.fulfill({ json: { data: product() } });
      return;
    }
    if (path === '/api/v1/admin/skus/31' && method === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({ sku_code: 'CABLE-BLACK', price: 12990, inventory: 8 });
      skus = [{ ...skus[0], ...body }];
      await route.fulfill({ json: { data: skus[0] } });
      return;
    }
    if (path === '/api/v1/admin/products/42/skus' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({ sku_code: 'CABLE-BLACK', price: 12990, inventory: 8, attributes: [{ name: 'Color', value: 'Black' }] });
      skus = [{ ...body, id: 31, product_id: 42, is_active: true, media: [] }];
      await route.fulfill({ status: 201, json: { data: skus[0] } });
      return;
    }
    if (path === '/api/v1/admin/products/42/preview-token') {
      await route.fulfill({ json: { data: { token: 'preview-token', expires_at: '2026-07-29T10:10:00Z' } } });
      return;
    }
    if (path === '/api/v1/admin/products/42/preview') {
      await route.fulfill({ json: { data: product() } });
      return;
    }
    if (path === '/api/v1/admin/products/42/validate') {
      await route.fulfill({ json: { data: publishReport() } });
      return;
    }
    if (path === '/api/v1/admin/products/42/publish' && method === 'POST') {
      published = true;
      await route.fulfill({ json: { data: { product_id: 42, status: 'published', version: 2, published_at: '', validation: publishReport() } } });
      return;
    }
    if (path === '/api/v1/products/42') {
      await route.fulfill({ json: { data: product() } });
      return;
    }
    if (path === '/api/v1/cart/items' && method === 'POST') {
      cartAdded = request.postDataJSON() as { sku_id: number; quantity: number };
      await route.fulfill({ status: 201, json: { data: {} } });
      return;
    }
    if (path === '/api/v1/cart' && method === 'GET') {
      await route.fulfill({ json: { data: { id: 1, items: [], total_price: 0, total_items: cartAdded ? 1 : 0 } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  const initialCategoriesResponse = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && new URL(response.url()).pathname === '/api/v1/admin/categories'
  ));
  await page.goto('/admin/categories');
  await initialCategoriesResponse;
  await page.getByRole('button', { name: '新建分类' }).click();
  await page.getByLabel('分类名称').fill('Cables');
  const createCategoryResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/v1/admin/categories'
  ));
  const refreshedCategoriesResponse = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && new URL(response.url()).pathname === '/api/v1/admin/categories'
  ));
  await page.getByRole('dialog', { name: '新建分类' }).getByRole('button', { name: /保\s*存/ }).click();
  await Promise.all([createCategoryResponse, refreshedCategoriesResponse]);
  await expect(page.getByRole('row', { name: /Cables/ })).toBeVisible();

  await page.goto('/admin/products/new');
  await page.getByLabel('商品标题（es-CL）').fill('Cable USB-C trenzado');
  await page.getByLabel('分类').click();
  await page.getByText('Cables', { exact: true }).click();
  await page.getByLabel('Rich product description').fill('Carga rápida y durable.');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await page.waitForURL('**/admin/products/42');

  await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles({
    name: 'cable.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('test'),
  });
  await expect(page.locator('[data-media-id="21"]')).toBeVisible();

  const connectorKey = page.getByPlaceholder('spec_key');
  await expect(connectorKey).toHaveValue('connector');
  await connectorKey.locator('xpath=../following-sibling::input[1]').fill('USB-C');
  await page.getByRole('button', { name: '保存规格' }).click();
  await expect(page.getByText('规格已保存')).toBeVisible();

  await page.getByText('有，例如颜色或容量', { exact: true }).click();
  await page.getByRole('button', { name: /Color/ }).click();
  await page.getByLabel('Color的值').fill('Black');
  await page.getByLabel('Color的值').press('Enter');
  await page.getByRole('button', { name: '保存变体维度' }).click();
  await expect(page.getByText('AUTO-31')).toBeVisible();
  await page.getByRole('button', { name: '编辑销售变体' }).click();
  await page.getByLabel('SKU 编码').fill('CABLE-BLACK');
  await page.getByLabel('价格（CLP）').fill('12990');
  await page.getByLabel('库存').fill('8');
  await page.getByRole('dialog', { name: '编辑变体 AUTO-31' }).getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('CABLE-BLACK')).toBeVisible();

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /预览$/ }).click();
  const previewPage = await popupPromise;
  await previewPage.waitForURL(/preview_token=preview-token/);
  await expect(previewPage.getByRole('heading', { name: 'Cable USB-C trenzado' })).toBeVisible();
  await expect(previewPage.getByRole('button', { name: /Agregar al carrito/ }).first()).toBeDisabled();
  await expect(previewPage.getByRole('button', { name: /Comprar ahora/ }).first()).toBeDisabled();
  await previewPage.close();

  await page.getByRole('button', { name: '检查并发布' }).click();
  await expect.poll(() => published).toBe(true);
  await expect(page.getByText('商品已发布')).toBeVisible();

  await page.goto('/es-CL/products/42');
  await page.getByRole('radio', { name: 'Black' }).click();
  await page.getByRole('button', { name: /Agregar al carrito/ }).first().click();
  await expect.poll(() => cartAdded).toMatchObject({ sku_id: 31, quantity: 1 });
});

function publishReport() {
  return {
    product_id: 42, version: 1, can_publish: true, requires_confirmation: false, errors: [], warnings: [],
    sections: {
      basic: { complete: true, errors: 0, warnings: 0 }, media: { complete: true, errors: 0, warnings: 0 },
      specifications: { complete: true, errors: 0, warnings: 0 }, variants: { complete: true, errors: 0, warnings: 0 },
      description: { complete: true, errors: 0, warnings: 0 },
    },
    completion: { completed: 5, total: 5, percent: 100 },
  };
}
