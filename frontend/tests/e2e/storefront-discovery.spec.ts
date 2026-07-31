import { expect, test } from '@playwright/test';

const makeProduct = (id: number, name: string) => ({
  id, name, description: '', specifications: '{}', status: 'published', is_active: true,
  created_at: '2026-07-30T09:00:00Z', updated_at: '2026-07-30T09:00:00Z', images: [],
  skus: [{ id: id * 10, product_id: id, sku_code: `SKU-${id}`, price: 9990 + id, inventory: 5, attributes: [], is_active: true }],
});

test('home category entry keeps the locale and applies the category filter', async ({ page }) => {
  let filteredRequest: URL | undefined;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:8080/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/categories') {
      await route.fulfill({ json: { data: { categories: [{ id: 7, name: 'Cables', slug: 'cables', sort_order: 0, is_active: true }] } } });
      return;
    }
    if (url.pathname === '/api/v1/products') {
      if (url.searchParams.get('category_id') === '7') filteredRequest = url;
      await route.fulfill({ json: { data: { products: [makeProduct(1, 'Cable USB-C')], total: 1 } } });
      return;
    }
    if (url.pathname === '/api/v1/banners') { await route.fulfill({ json: { data: { banners: [] } } }); return; }
    if (url.pathname === '/api/v1/announcements') { await route.fulfill({ json: { data: { announcements: [] } } }); return; }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/es-CL');
  await page.locator('a[href="/es-CL/products?category_id=7"]').click();
  await expect(page).toHaveURL(/\/es-CL\/products\?category_id=7$/);
  await expect.poll(() => Boolean(filteredRequest)).toBe(true);
});

test('mobile product discovery persists filters, sorting and pagination in the URL', async ({ page }) => {
  const productRequests: URL[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:8080/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/categories') { await route.fulfill({ json: { data: { categories: [{ id: 7, name: 'Cables', slug: 'cables', sort_order: 0, is_active: true }] } } }); return; }
    if (url.pathname === '/api/v1/products') { productRequests.push(url); await route.fulfill({ json: { data: { products: [makeProduct(1, 'USB-C Cable')], total: 24 } } }); return; }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/products');
  await expect(page.getByRole('heading', { name: 'All products' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Sort' }).click();
  await page.getByText('Price: low to high', { exact: true }).click();
  await expect(page).toHaveURL(/sort=price_asc/);

  await page.getByRole('button', { name: /^Filters/ }).click();
  const filterDialog = page.getByRole('dialog');
  await filterDialog.getByRole('button', { name: 'Cables', exact: true }).click();
  await filterDialog.getByLabel('Minimum price').fill('1000');
  await filterDialog.getByLabel('Maximum price').fill('20000');
  await filterDialog.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/category_id=7/);
  await expect(page).toHaveURL(/min_price=1000/);
  await expect(page).toHaveURL(/max_price=20000/);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/page=2/);

  await expect.poll(() => productRequests.some(url => url.searchParams.get('category_id') === '7' && url.searchParams.get('min_price') === '1000' && url.searchParams.get('max_price') === '20000' && url.searchParams.get('sort_by') === 'price' && url.searchParams.get('sort_order') === 'asc')).toBe(true);
  await expect.poll(() => productRequests.some(url => url.searchParams.get('page') === '2')).toBe(true);

  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/sort=price_asc/);
  await expect(page).not.toHaveURL(/category_id|(?:min|max)_price|page=2/);
  await expect.poll(() => productRequests.some(url =>
    url.searchParams.get('sort_by') === 'price' &&
    url.searchParams.get('sort_order') === 'asc' &&
    !url.searchParams.has('category_id') &&
    !url.searchParams.has('min_price') &&
    !url.searchParams.has('max_price') &&
    url.searchParams.get('page') === '1',
  )).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('search restores locale, query, filters, sorting and page from a shared URL', async ({ page }) => {
  let searchRequest: URL | undefined;
  await page.route('http://localhost:8080/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/categories') { await route.fulfill({ json: { data: { categories: [] } } }); return; }
    if (url.pathname === '/api/v1/products/search') { searchRequest = url; await route.fulfill({ json: { data: { products: [makeProduct(2, 'Compact Hub')], total: 18 } } }); return; }
    await route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/products/search?q=hub&sort=name_asc&category_id=7&min_price=1000&max_price=20000&page=2');
  await expect(page.getByRole('heading', { name: 'Results for "hub"' })).toBeVisible();
  await expect(page.getByText('Compact Hub')).toBeVisible();
  await expect.poll(() => Boolean(searchRequest)).toBe(true);
  expect(searchRequest?.searchParams.get('q')).toBe('hub');
  expect(searchRequest?.searchParams.get('page')).toBe('2');
  expect(searchRequest?.searchParams.get('category_id')).toBe('7');
  expect(searchRequest?.searchParams.get('min_price')).toBe('1000');
  expect(searchRequest?.searchParams.get('max_price')).toBe('20000');
  expect(searchRequest?.searchParams.get('sort_by')).toBe('name');
  expect(searchRequest?.searchParams.get('sort_order')).toBe('asc');
  await expect(page).toHaveURL(/\/en\/products\/search/);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/q=hub/);
  await expect(page).toHaveURL(/sort=name_asc/);
  await expect(page).not.toHaveURL(/category_id|(?:min|max)_price|page=2/);
  await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Clear search' }).click();
  await expect(page).toHaveURL(/\/en\/products$/);
});
