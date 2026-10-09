import { expect, test, type Page } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

async function fixture(page: Page) {
  await seedNecessaryCookieConsent(page);
  const queries: URL[] = [];
  const categories = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: i === 0 ? 'Computación y Periféricos' : `Category ${i + 1}`, slug: `category-${i + 1}`, is_active: true, sort_order: i }));
  await page.route('http://localhost:8080/api/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [...categories, { id: 90, parent_id: 1, name: 'Child category', is_active: true }, { id: 91, name: 'Hidden category', is_active: false }] } } });
    if (url.pathname === '/api/v1/products') {
      queries.push(url);
      const category = Number(url.searchParams.get('category_id'));
      const products = Array.from({ length: 5 }, (_, i) => ({
        id: category * 10 + i, category_id: category, name: `Product ${category}-${i}`, slug: `product-${category}-${i}`, description: '', specifications: '{}', status: 'published', is_active: true, is_recommended: i === 0,
        images: [], skus: [{ id: category * 100 + i, sku_code: `SKU-${category}-${i}`, price: 1990, inventory: i === 1 ? 0 : 5, is_active: true, attributes: [] }],
      }));
      return route.fulfill({ json: { data: { products, total: 10 } } });
    }
    return route.fulfill({ json: { data: {} } });
  });
  return queries;
}

test('desktop homepage uses root categories and five products per group', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const queries = await fixture(page);
  await page.goto('/en');
  const rail = page.locator('#categories');
  const links = rail.getByRole('link');
  await expect(links).toHaveCount(10);
  await expect(rail.getByRole('heading')).toHaveCount(0);
  await expect(rail).toHaveAttribute('aria-label', 'Categories');
  await expect(rail.getByRole('navigation')).toHaveCount(0);
  await expect(links.last()).toHaveAttribute('href', '/en/categories');
  await expect(rail).not.toContainText('Child category');
  await expect(rail).not.toContainText('Hidden category');
  await expect(links.first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(links.first().locator(':scope > span').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(links.first()).toHaveCSS('box-shadow', 'none');
  await expect(links.first()).toHaveCSS('text-align', 'center');
  const boxes = await links.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  expect(boxes.slice(0, 5).every(box => Math.abs(box.y - boxes[0].y) < 1)).toBe(true);
  expect(boxes[5].y).toBeGreaterThan(boxes[0].y);
  const groups = page.locator('#offers section[aria-labelledby^="home-category-"]');
  await expect(groups).toHaveCount(5);
  await expect(page.locator('#offers h3:visible')).toHaveCount(25);
  await expect(page.locator('#offers').getByText('Recommended', { exact: true })).toHaveCount(5);
  expect(queries).toHaveLength(5);
  for (const query of queries) {
    expect(query.searchParams.get('sort_by')).toBe('recommended');
    expect(query.searchParams.get('page_size')).toBe('5');
  }
  const logo = page.locator('header a').filter({ has: page.getByAltText('Plexoria Logo') });
  await expect(logo).toHaveCSS('padding-left', '10px');
  await expect(logo).toHaveCSS('padding-top', '8px');
});

test.describe('touch homepage', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const width of [360, 390, 430]) {
    test(`three columns, two rows and transparent entries at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await fixture(page);
      await page.goto('/en');
      const rail = page.locator('#categories');
      const pages = rail.getByRole('navigation').getByRole('button');
      await expect(pages).toHaveCount(2);
      await expect(rail.getByRole('heading')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('PLEXORIA · Technology and accessories');
      await expect(pages.first()).toHaveAttribute('aria-current', 'page');
      const links = rail.getByRole('link');
      const boxes = await links.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
      expect(boxes.slice(0, 3).every(box => Math.abs(box.y - boxes[0].y) < 1)).toBe(true);
      expect(boxes[3].y).toBeGreaterThan(boxes[0].y);
      expect(boxes[5].x + boxes[5].width).toBeLessThanOrEqual(width);
      expect(boxes[6].x).toBeGreaterThanOrEqual(width - 30);
      await expect(links.first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(links.first().locator(':scope > span').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(links.first()).toHaveCSS('text-align', 'center');
      await expect(page.locator('#offers h3:visible')).toHaveCount(20);
      await pages.last().click();
      await expect(pages.last()).toHaveAttribute('aria-current', 'page');
      await expect(links.last()).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const logo = page.locator('header a').filter({ has: page.getByAltText('Plexoria Logo') });
      await expect(logo).toHaveCSS('padding', '8px');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.locator('#storefront-mobile-search input')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#storefront-mobile-search')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Search', exact: true }).blur();
      const contact = page.locator('.sf-whatsapp-contact');
      await expect(contact).toBeVisible();
      await expect(contact).toHaveCSS('height', '48px');
      await page.locator('[data-shopping-help]').scrollIntoViewIfNeeded();
      await expect(contact).toBeHidden();
      await page.evaluate(() => scrollTo(0, 0));
      await expect(contact).toBeVisible();
      await rail.screenshot({ path: `test-results/home-categories-${width}.png` });
    });
  }
});
