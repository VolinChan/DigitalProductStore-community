import { expect, test, type Page } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';
import { expectAccessiblePage } from './helpers/accessibility';

async function fixture(page: Page, count = 15) {
  await seedNecessaryCookieConsent(page);
  const queries: URL[] = [];
  await page.route('http://localhost:8080/api/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/categories')) return route.fulfill({ json: { data: { categories: [{ id: 7, name: 'Connectivity', slug: 'connectivity', is_active: true }] } } });
    if (url.pathname.endsWith('/products')) {
      queries.push(url);
      const all = Array.from({ length: count }, (_, index) => ({
        id: 100 + index, name: index === 0 ? 'Older product, latest pick' : `Recommended accessory ${index + 1}`,
        slug: `recommended-accessory-${index + 1}`, category_id: 7, is_active: true, status: 'published', is_recommended: true,
        created_at: index === 0 ? '2025-01-01T00:00:00Z' : '2026-10-01T00:00:00Z',
        recommended_at: `2026-10-${String(21 - index).padStart(2, '0')}T00:00:00Z`,
        skus: [{ id: 1000 + index, sku_code: `REC-${index}`, price: 1990 + index * 1000, inventory: 5, is_active: true }],
        images: [],
      }));
      const filtered = url.searchParams.get('min_price') === '999999' ? [] : all;
      const page = Number(url.searchParams.get('page') || 1);
      return route.fulfill({ json: { data: { products: filtered.slice((page - 1) * 12, page * 12), total: filtered.length } } });
    }
    return route.fulfill({ json: { data: {} } });
  });
  return queries;
}

for (const [locale, width, title, store] of [['en', 1440, 'Recommended products', 'Store'], ['es-CL', 390, 'Productos recomendados', 'Tienda'], ['en', 320, 'Recommended products', 'Store']] as const) {
  test(`footer opens the localized recommendation collection at ${width}px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const queries = await fixture(page);
    await page.goto(`/${locale}/contact`);
    const storeNav = page.locator('footer').getByRole('navigation', { name: store, exact: true });
    await expect(storeNav.getByRole('link')).toHaveCount(4);
    await storeNav.getByRole('link', { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/recommended$`));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('main h3').first()).toHaveText('Older product, latest pick');
    expect(queries.at(-1)?.searchParams.get('is_recommended')).toBe('true');
    expect(queries.at(-1)?.searchParams.get('sort_by')).toBe('recommended');
    expect(queries.at(-1)?.searchParams.get('sort_order')).toBe('desc');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectAccessiblePage(page);
  });
}

test('pagination, sorting, filtering and locale changes preserve the recommendation collection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const queries = await fixture(page);
  await page.goto('/en/recommended');
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/recommended\?page=2$/);
  await expect(page.locator('main h3').first()).toHaveText('Recommended accessory 13');
  await page.getByRole('combobox', { name: 'Sort' }).click();
  await page.getByText('Price: low to high', { exact: true }).last().click();
  await expect(page).toHaveURL(/\/en\/recommended\?sort=price_asc$/);
  await expect(page.locator('main h3').first()).toHaveText('Older product, latest pick');
  await page.getByRole('complementary').getByRole('button', { name: 'Connectivity', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/recommended\?sort=price_asc&category_id=7$/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('category_id')).toBe('7');
  expect(queries.every(query => query.searchParams.get('is_recommended') === 'true')).toBe(true);
  expect(queries.at(-1)?.searchParams.get('sort_by')).toBe('price');
  await page.getByRole('button', { name: 'Switch to ES', exact: true }).click();
  await expect(page).toHaveURL(/\/es-CL\/recommended\?sort=price_asc&category_id=7$/);
  await expect(page.getByRole('heading', { name: 'Productos recomendados', exact: true })).toBeVisible();
});

test('empty recommendations offer the full catalog and API failures offer retry', async ({ page }) => {
  await fixture(page, 0);
  await page.goto('/en/recommended');
  await expect(page.getByRole('heading', { name: 'No recommendations available yet' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Browse all products' })).toHaveAttribute('href', '/en/products');
  await page.route('http://localhost:8080/api/v1/products?**', route => route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } }));
  await page.reload();
  const retry = page.getByRole('button', { name: 'Retry', exact: true });
  await expect(retry).toBeVisible();
  await page.unroute('http://localhost:8080/api/v1/products?**');
  await retry.click();
  await expect(page.getByRole('heading', { name: 'No recommendations available yet' })).toBeVisible();
});
