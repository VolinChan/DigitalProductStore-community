import { expect, test } from '@playwright/test';

const testImageURL = '/placeholder-product.svg';

test('reuses media assets and updates alt text', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });

  let savedMedia: Array<{ media_asset_id: number }> = [];
  let savedAlt = '';
  const product = {
    id: 1,
    name: 'Cable USB-C',
    slug: 'cable-usb-c',
    description: 'Description',
    short_description: 'Short',
    brand: 'Acme',
    model: 'C1',
    condition: 'new',
    warranty_text: '12 months',
    category_id: 1,
    specifications: '{}',
    status: 'draft',
    is_active: false,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    images: [],
    skus: [],
    media: [{
      id: 1,
      media_asset_id: 11,
      role: 'gallery',
      sort_order: 0,
      is_primary: true,
      media_asset: {
        id: 11,
        kind: 'image',
        storage_key: 'products/images/11.svg',
        url: testImageURL,
        mime_type: 'image/svg+xml',
        size_bytes: 100,
        alt_text: 'Old alt',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    }],
  };

  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories') {
      await route.fulfill({ json: { data: { categories: [{ id: 1, name: 'Accessories', slug: 'accessories', sort_order: 0, is_active: true }] } } });
      return;
    }
    if (path === '/api/v1/admin/products/1' && route.request().method() === 'GET') {
      await route.fulfill({ json: { data: product } });
      return;
    }
    if (path === '/api/v1/admin/media' && route.request().method() === 'GET') {
      await route.fulfill({ json: { data: { media: [{
        id: 13,
        kind: 'image',
        storage_key: 'products/images/13.svg',
        url: testImageURL,
        mime_type: 'image/svg+xml',
        size_bytes: 200,
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      }] }, meta: { page: 1, per_page: 12, total: 1 } } });
      return;
    }
    if (path === '/api/v1/admin/media/11' && route.request().method() === 'PUT') {
      savedAlt = (route.request().postDataJSON() as { alt_text: string }).alt_text;
      await route.fulfill({ json: { data: { ...product.media[0].media_asset, alt_text: savedAlt } } });
      return;
    }
    if (path === '/api/v1/admin/products/1/media' && route.request().method() === 'PUT') {
      savedMedia = (route.request().postDataJSON() as { media: Array<{ media_asset_id: number }> }).media;
      await route.fulfill({ json: { data: { media: savedMedia } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/products/1');
  const altInput = page.getByLabel('Alt text 11');
  await expect(altInput).toBeVisible();
  await altInput.fill('Braided cable');
  await altInput.blur();
  await expect.poll(() => savedAlt).toBe('Braided cable');

  await page.getByRole('button', { name: '媒体库' }).click();
  await page.getByRole('button', { name: 'Select media 13' }).click();
  await page.getByRole('button', { name: '添加所选媒体' }).click();
  await expect.poll(() => savedMedia.map((item) => item.media_asset_id)).toEqual([11, 13]);

  const editor = page.getByLabel('Rich product description');
  await editor.fill('Connectivity');
  await page.getByRole('button', { name: 'H2', exact: true }).click();
  await page.getByText('HTML 源码', { exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(/^<h2>Connectivity<\/h2>/);
  await page.getByLabel('HTML source').fill('<h3>Fast charging</h3>');
  await page.getByText('可视模式', { exact: true }).click();
  await expect(editor.locator('h3')).toHaveText('Fast charging');

  await page.getByRole('button', { name: 'Insert image' }).click();
  const insertDialog = page.getByRole('dialog', { name: '选择图片' });
  await expect(insertDialog).toBeVisible();
  await insertDialog.getByRole('button', { name: 'Insert media 13' }).click();
  await expect(insertDialog).toBeHidden();
  await page.getByText('HTML 源码', { exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(/data-media-asset-id="13"/);
});

test('retries an individual failed media upload without duplicating the gallery item', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });

  let uploadAttempts = 0;
  let savedAssetIDs: number[] = [];
  const product = {
    id: 1, name: 'Cable USB-C', slug: 'cable-usb-c', description: '', short_description: '', brand: '', model: '',
    condition: 'new', warranty_text: '', category_id: 1, specifications: '{}', status: 'draft', is_active: false,
    version: 1, created_at: '', updated_at: '', images: [], skus: [], media: [], structured_specifications: [], variant_dimensions: [],
  };

  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/admin/categories') {
      await route.fulfill({ json: { data: { categories: [{ id: 1, name: 'Accessories', slug: 'accessories', sort_order: 0, is_active: true }] } } });
      return;
    }
    if (path === '/api/v1/admin/products/1' && request.method() === 'GET') {
      await route.fulfill({ json: { data: product } });
      return;
    }
    if (path === '/api/v1/admin/products/1/specifications') {
      await route.fulfill({ json: { data: { specifications: [], version: 1 } } });
      return;
    }
    if (path === '/api/v1/admin/products/1/variants/preview') {
      await route.fulfill({ json: { data: { combinations: [], kept: [], created: [], deactivated: [], deletable: [] } } });
      return;
    }
    if (path === '/api/v1/admin/media/images') {
      uploadAttempts += 1;
      if (uploadAttempts === 1) {
        await route.fulfill({ status: 503, json: { error: { code: 'STORAGE_UNAVAILABLE', message: 'retry' } } });
      } else {
        await route.fulfill({ json: { data: {
          id: 21, kind: 'image', storage_key: 'products/images/21.svg', url: testImageURL, mime_type: 'image/svg+xml',
          size_bytes: 4, created_at: '', updated_at: '',
        } } });
      }
      return;
    }
    if (path === '/api/v1/admin/products/1/media' && request.method() === 'PUT') {
      savedAssetIDs = (request.postDataJSON() as { media: Array<{ media_asset_id: number }> }).media.map((item) => item.media_asset_id);
      await route.fulfill({ json: { data: { media: [] } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/admin/products/1');
  await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles({
    name: 'retry.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('test'),
  });
  await expect(page.getByRole('button', { name: '重试上传 retry.jpg' })).toBeVisible();
  await page.getByRole('button', { name: '重试上传 retry.jpg' }).click();
  await expect.poll(() => uploadAttempts).toBe(2);
  await expect.poll(() => savedAssetIDs).toEqual([21]);
  await expect(page.getByRole('button', { name: '重试上传 retry.jpg' })).toHaveCount(0);
});
