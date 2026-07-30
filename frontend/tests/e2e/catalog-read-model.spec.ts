import { expect, test } from '@playwright/test';

test('storefront prefers the modern catalog read model and keeps legacy fallbacks available', async ({ page }) => {
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/products/12') {
      await route.fulfill({ json: { data: {
        id: 12,
        name: 'Hub USB-C',
        description: 'Legacy description',
        description_html: '<p>Descripcion <strong>segura</strong></p>',
        short_description: 'Hub compacto',
        specifications: '{"legacy":"value"}',
        structured_specifications: [{ id: 1, group_name: 'Conectividad', spec_key: 'connector', label: 'Conector', value_text: 'USB-C', sort_order: 0 }],
        status: 'published',
        is_active: true,
        created_at: '',
        updated_at: '',
        images: [{ id: 1, product_id: 12, image_url: 'https://legacy.invalid/product.jpg', sort_order: 0, is_primary: true }],
        media: [{ id: 2, media_asset_id: 3, role: 'gallery', sort_order: 0, is_primary: true, media_asset: {
          id: 3, kind: 'image', storage_key: '', url: 'https://cdn.example/product-modern.jpg', mime_type: 'image/jpeg', size_bytes: 100, created_at: '', updated_at: '',
        } }],
        skus: [{
          id: 31, product_id: 12, sku_code: 'HUB-DEFAULT', price: 19990, inventory: 3, attributes: [], is_active: true,
          image_url: 'https://legacy.invalid/sku.jpg',
          media: [{ id: 4, sku_id: 31, media_asset_id: 5, sort_order: 0, media_asset: {
            id: 5, kind: 'image', storage_key: '', url: 'https://cdn.example/sku-modern.jpg', mime_type: 'image/jpeg', size_bytes: 100, created_at: '', updated_at: '',
          } }],
        }],
      } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/es-CL/products/12');
  await expect(page.getByRole('heading', { name: 'Hub USB-C' })).toBeVisible();
  await expect(page.locator('img[alt="Hub USB-C"]').first()).toHaveAttribute('src', /sku-modern/);
  await expect(page.getByText('Descripcion', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conectividad', exact: true })).toBeVisible();
  await expect(page.getByText('USB-C', { exact: true })).toBeVisible();
  await expect(page.getByText('Legacy description')).toHaveCount(0);
  await expect(page.getByText('legacy', { exact: true })).toHaveCount(0);
});

test('selects a color and length combination and updates SKU price stock and media', async ({ page }) => {
  const skus = [
    ['Red', '1 m', 101, 10990, 4],
    ['Red', '2 m', 102, 12990, 2],
    ['Blue', '1 m', 103, 11990, 3],
    ['Blue', '2 m', 104, 13990, 0],
  ].map(([color, length, id, price, inventory]) => ({
    id, product_id: 20, sku_code: `CABLE-${id}`, price, inventory, is_active: true,
    attributes: [{ id: Number(id) * 10, sku_id: id, name: 'Color', value: color }, { id: Number(id) * 10 + 1, sku_id: id, name: 'Largo del cable', value: length }],
    media: [{ id: Number(id) * 100, sku_id: id, media_asset_id: id, sort_order: 0, media_asset: {
      id, kind: 'image', storage_key: '', url: `https://cdn.example/cable-${id}.jpg`, mime_type: 'image/jpeg', size_bytes: 100, created_at: '', updated_at: '',
    } }],
  }));

  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/products/20') {
      await route.fulfill({ json: { data: {
        id: 20, name: 'Cable USB-C', description: '', description_html: '<p>Cable reforzado</p>', short_description: '',
        specifications: '{}', status: 'published', is_active: true, created_at: '', updated_at: '', images: [],
        media: [{ id: 1, media_asset_id: 1, role: 'gallery', sort_order: 0, is_primary: true, media_asset: {
          id: 1, kind: 'image', storage_key: '', url: 'https://cdn.example/cable-main.jpg', mime_type: 'image/jpeg', size_bytes: 100, created_at: '', updated_at: '',
        } }],
        skus,
      } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/es-CL/products/20');
  await page.getByRole('radio', { name: 'Red', exact: true }).click();
  await page.getByRole('radio', { name: '2 m', exact: true }).click();

  await expect(page.getByText('SKU: CABLE-102')).toBeVisible();
  await expect(page.locator('img[alt="Cable USB-C"]').first()).toHaveAttribute('src', /cable-102/);
  await expect(page.getByText(/12[.,]990/).first()).toBeVisible();
  await expect(page.getByText(/Disponible \(2 en stock\)/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Agregar|add/i }).first()).toBeEnabled();
});
