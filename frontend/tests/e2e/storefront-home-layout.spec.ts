import { expect, test, type Page } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

async function fixture(page: Page, options: { soldOut?: boolean; noRecommendations?: boolean; counts?: number[] } = {}) {
  await seedNecessaryCookieConsent(page);
  await page.route('**/home-product.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect x="50" y="50" width="100" height="100" fill="#173f67"/></svg>' }));
  const queries: URL[] = [];
  const categories = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: i === 0 ? 'Computación y Periféricos' : `Category ${i + 1}`, slug: `category-${i + 1}`, is_active: true, sort_order: i }));
  await page.route('http://localhost:8080/api/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [...categories, { id: 90, parent_id: 1, name: 'Child category', is_active: true }, { id: 91, name: 'Hidden category', is_active: false }] } } });
    if (url.pathname === '/api/v1/products') {
      queries.push(url);
      if (!url.searchParams.has('category_id')) {
        const products = [900, 899].map((id, i) => ({
          id, category_id: 99, name: `Latest pick ${id}`, slug: `latest-pick-${id}`, is_active: true, status: 'published', is_recommended: !options.noRecommendations,
          created_at: `2026-10-${10 + i}T10:00:00Z`, recommended_at: `2026-10-${20 - i}T10:00:00Z`, images: [{ id, image_url: '/home-product.svg', is_primary: true, sort_order: 0 }],
          skus: [{ id, sku_code: `PICK-${id}`, price: 1990, inventory: options.soldOut && i === 0 ? 0 : 5, is_active: true }, { id: id + 10000, price: 100, inventory: 5, is_active: false }],
        }));
        return route.fulfill({ json: { data: { products, total: products.length } } });
      }
      const category = Number(url.searchParams.get('category_id'));
      const products = Array.from({ length: options.counts?.[category - 1] ?? 5 }, (_, i) => ({
        id: category * 10 + i, category_id: category, name: `Product ${category}-${i}`, slug: `product-${category}-${i}`, description: '', specifications: '{}', status: 'published', is_active: true, is_recommended: i === 0,
        images: [{ id: category * 10 + i, image_url: '/home-product.svg', is_primary: true, sort_order: 0 }],
        skus: [{ id: category * 100 + i, sku_code: `SKU-${category}-${i}`, price: 1990, inventory: i === 1 ? 0 : 5, is_active: true, attributes: [] }],
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
  await links.first().hover();
  await expect(links.first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(links.first()).not.toHaveCSS('box-shadow', 'none');
  await page.mouse.move(0, 0);
  await links.first().focus();
  await expect(links.first()).toHaveCSS('outline-style', 'solid');
  await expect(links.first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await links.first().blur();
  await expect(links.first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const boxes = await links.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  expect(boxes.slice(0, 5).every(box => Math.abs(box.y - boxes[0].y) < 1)).toBe(true);
  expect(boxes[5].y).toBeGreaterThan(boxes[0].y);
  const groups = page.locator('#offers section[aria-labelledby^="home-category-"]');
  await expect(groups).toHaveCount(5);
  await expect(page.locator('#offers h3:visible')).toHaveCount(25);
  await expect(page.locator('#offers').getByText('Recommended', { exact: true })).toHaveCount(5);
  const categoryQueries = queries.filter(query => query.searchParams.has('category_id'));
  expect(categoryQueries).toHaveLength(5);
  for (const query of categoryQueries) {
    expect(query.searchParams.get('sort_by')).toBe('recommended');
    expect(query.searchParams.get('page_size')).toBe('5');
  }
  const recommendations = queries.filter(query => !query.searchParams.has('category_id'));
  expect(recommendations).toHaveLength(1);
  expect(recommendations[0].searchParams.get('sort_by')).toBe('recommended');
  expect(recommendations[0].searchParams.get('page_size')).toBe('12');
  const logo = page.locator('header a').filter({ has: page.getByAltText('Plexoria Logo') });
  await expect(logo).toHaveCSS('padding-left', '10px');
  await expect(logo).toHaveCSS('padding-top', '8px');
  const hero = page.locator('[data-hero-product]:visible');
  await expect(hero).toHaveAttribute('href', '/en/products/latest-pick-900');
  await expect(hero.getByRole('img', { name: 'Latest pick 900' })).toBeVisible();
  await expect(hero).toContainText(/CLP\s+1,990/);
  await expect(page.getByRole('link', { name: /Free warehouse pickup in Macul/ })).toHaveAttribute('href', '/en/help/shipping');
});

test('hero uses the next available recommendation when the latest is sold out', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(page, { soldOut: true });
  await page.goto('/en');
  const hero = page.locator('[data-hero-product]:visible');
  await expect(hero).toHaveAttribute('href', '/en/products/latest-pick-899');
  await expect(hero).toContainText(/CLP\s+1,990/);
  await expect(hero).toContainText('Latest pick');
});

test('unrecommended products never fill the recommendation position', async ({ page }) => {
  await fixture(page, { noRecommendations: true });
  await page.goto('/en');
  await expect(page.locator('#offers h3:visible')).toHaveCount(25);
  await expect(page.locator('[data-hero-product]')).toHaveCount(0);
  await expect(page.locator('#categories')).toBeVisible();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`small categories share a discovery section without empty floors at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page, { counts: [1, 2, 3, 4, 5] });
    await page.goto('/en');
    const groups = page.locator('#offers section[aria-labelledby^="home-category-"]');
    await expect(groups).toHaveCount(5);
    for (const group of await groups.all()) {
      expect(await group.locator('h3').count()).toBeGreaterThanOrEqual(3);
    }
    await expect(page.locator('#home-category-1')).toHaveCount(0);
    await expect(page.locator('#home-category-2')).toHaveCount(0);
    // Small early categories must not consume the floor limit and hide later full categories.
    await expect(page.locator('#home-category-6')).toBeVisible();
    await expect(page.locator('#home-category-7')).toBeVisible();
    const discoveries = page.getByRole('region', { name: 'More to discover', exact: true });
    await expect(discoveries.locator('h3')).toHaveCount(3);
    await expect(discoveries.getByRole('heading', { name: 'Product 1-0', exact: true })).toBeVisible();
    await expect(discoveries.getByRole('link', { name: 'Computación y Periféricos' })).toHaveAttribute('href', '/en/products?category_id=1');
    await expect(discoveries.getByRole('link', { name: 'View all', exact: false })).toHaveAttribute('href', '/en/products');
    const productRows = await discoveries.locator('h3').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
    if (width >= 640) expect(productRows.every(y => Math.abs(y - productRows[0]) < 1)).toBe(true);
    const trust = page.locator('[data-trust-strip]');
    const benefits = trust.locator('.sf-shell > div');
    await expect(benefits).toHaveCount(4);
    await expect(benefits.first().locator('p').last()).toBeVisible();
    const boxes = await benefits.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    expect(boxes.slice(0, width >= 1024 ? 4 : 2).every(box => Math.abs(box.y - boxes[0].y) < 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('one sparse product keeps its category entry without creating an empty floor', async ({ page }) => {
  await fixture(page, { counts: [1, ...Array(11).fill(0)] });
  await page.goto('/en');
  await expect(page.locator('#offers').getByRole('status')).toHaveCount(0);
  await expect(page.locator('#offers').getByRole('link', { name: /View products/ })).toBeVisible();
  await expect(page.locator('#offers section[aria-labelledby^="home-category-"]')).toHaveCount(0);
  await expect(page.locator('#home-discoveries')).toHaveCount(0);
  await expect(page.locator('#categories a').first()).toHaveAttribute('href', '/en/products?category_id=1');
});

test('multiple sparse categories fill one discovery grid and retain their original links', async ({ page }) => {
  await fixture(page, { counts: Array(12).fill(1) });
  await page.goto('/en');
  const discoveries = page.getByRole('region', { name: 'More to discover', exact: true });
  await expect(discoveries.locator('h3')).toHaveCount(5);
  await expect(page.locator('#offers section[aria-labelledby^="home-category-"]')).toHaveCount(0);
  await expect(discoveries.getByRole('link', { name: 'Category 2' })).toHaveAttribute('href', '/en/products?category_id=2');
  await expect(discoveries.getByRole('link', { name: 'Category 5' })).toHaveAttribute('href', '/en/products?category_id=5');
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
      await links.first().hover();
      await expect(links.first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(links.first()).toHaveCSS('box-shadow', 'none');
      await expect(page.locator('#offers h3:visible')).toHaveCount(20);
      const featured = page.locator('[data-hero-product]:visible');
      await expect(featured).toHaveAttribute('href', '/en/products/latest-pick-900');
      expect((await featured.boundingBox())!.y).toBeLessThan((await rail.boundingBox())!.y);
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
