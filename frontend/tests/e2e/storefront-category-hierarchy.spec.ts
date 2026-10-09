import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';
import documents from '../../src/lib/legal/documents.json';

const categories = [
  { id: 1, name: 'Electrónica', slug: 'electronica', is_active: true, parent_id: null, sort_order: 1, product_count: 2 },
  { id: 2, name: 'Cables USB', slug: 'cables-usb', is_active: true, parent_id: 1, sort_order: 1, product_count: 1 },
  { id: 3, name: 'USB-C', slug: 'usb-c', is_active: true, parent_id: 2, sort_order: 1, product_count: 1 },
  { id: 4, name: 'Oficina', slug: 'oficina', is_active: true, parent_id: null, sort_order: 2, product_count: 1 },
  { id: 5, name: 'Orphan', slug: 'orphan', is_active: true, parent_id: 999 },
  { id: 6, name: 'Inactive', slug: 'inactive', is_active: false, parent_id: null },
  { id: 7, name: 'Hidden child', slug: 'hidden', is_active: true, parent_id: 6 },
  { id: 8, name: 'Cycle A', slug: 'cycle-a', is_active: true, parent_id: 9 },
  { id: 9, name: 'Cycle B', slug: 'cycle-b', is_active: true, parent_id: 8 },
];

test.beforeEach(async ({ page }) => {
  await seedNecessaryCookieConsent(page);
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/categories') return route.fulfill({ json: { data: { categories } } });
    if (url.pathname === '/api/v1/products') {
      const id = url.searchParams.get('category_id');
      return route.fulfill({ json: { data: { products: [], total: id ? Number(id) : 0 } } });
    }
    return route.fulfill({ json: { data: {} } });
  });
});

test('category index contains roots only and never promotes invalid branches', async ({ page }) => {
  await page.goto('/es-CL/categories');
  const main = page.locator('#main-content');
  await expect(main.getByText('Electrónica', { exact: true })).toBeVisible();
  await expect(main.getByText('Oficina', { exact: true })).toBeVisible();
  for (const name of ['Cables USB', 'USB-C', 'Orphan', 'Inactive', 'Hidden child', 'Cycle A', 'Cycle B']) {
    await expect(main.getByText(name, { exact: true })).toHaveCount(0);
  }
});

test('grouped category selection applies immediately, preserves applied filters and history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/es-CL/products?page=2&sort=price_asc&min_price=1000');
  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('button', { name: 'USB-C', exact: true })).toBeVisible();
  await sidebar.getByRole('button', { name: 'USB-C', exact: true }).click();
  await expect(page).toHaveURL(/category_id=3/);
  await expect(page).toHaveURL(/min_price=1000/);
  await expect(page).toHaveURL(/sort=price_asc/);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await expect(sidebar.getByRole('button', { name: 'USB-C', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sidebar.getByRole('button', { name: 'Oficina', exact: true }).click();
  await expect(page).toHaveURL(/category_id=4/);
  await page.goBack();
  await expect(sidebar.getByRole('button', { name: 'USB-C', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(sidebar.getByRole('button', { name: 'USB-C', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('mobile drawer applies category without a second confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/es-CL/products');
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('button', { name: 'USB-C', exact: true }).click();
  await expect(page).toHaveURL(/category_id=3/);
  await expect(drawer).toBeHidden();
});

test('marketplace footer exposes exact links, slogan and updated contact details at all widths', async ({ page }) => {
  for (const width of [390, 834, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/es-CL/contact');
    const footer = page.locator('footer').last();
    await expect(footer.getByRole('link', { name: 'PLEXORIA en Mercado Libre' })).toHaveAttribute('href', 'https://www.mercadolibre.cl/pagina/plexoria');
    await expect(footer.getByRole('link', { name: 'PLEXORIA en Falabella' })).toHaveAttribute('href', 'https://www.falabella.com/falabella-cl/seller/PLEXORIA');
    await expect(footer).toContainText('CONECTAR · INTEGRAR · AVANZAR');
    await expect(footer).toContainText('Av. Marathón 2499, Macul, Región Metropolitana, Chile.');
    await expect(page.locator('#main-content')).toContainText('10:30–15:30');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/marketplace-footer-${width}.png`, fullPage: true });
  }
});

test('all published pages retain every owner-supplied paragraph without internal instructions', async ({ page }) => {
  const routes = { terms: 'legal/terms', returns_withdrawal: 'legal/returns-withdrawal', legal_guarantee: 'legal/legal-guarantee', shipping: 'help/shipping', privacy: 'privacy', cookies: 'legal/cookies', supplier_identification: 'legal/supplier', privacy_requests: 'privacy-request', about: 'about' };
  for (const [key, route] of Object.entries(routes)) {
    await page.goto(`/es-CL/${route}`);
    const content = page.locator('#main-content');
    for (const paragraph of documents.documents[key as keyof typeof routes].paragraphs) await expect(content).toContainText(paragraph);
    expect(await content.innerText()).not.toMatch(/[\u4e00-\u9fff]/);
  }
});
