import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

const categories = [
  { id: 1, name: 'Computación y Periféricos', is_active: true, sort_order: 1, product_count: 2, image_asset: { url: '/category-style.svg' } },
  { id: 2, name: 'Hubs USB y USB-C', is_active: true, sort_order: 2, product_count: 1, icon_key: 'usb' },
  { id: 3, name: 'Conectividad y Redes', is_active: true, sort_order: 3, product_count: 0, icon_key: 'network' },
  { id: 4, name: 'Cables y Adaptadores', is_active: true, sort_order: 4, icon_key: 'usb' },
  { id: 5, name: 'Accesorios para Notebook', is_active: true, sort_order: 5, product_count: 3, icon_key: 'laptop' },
];

for (const width of [320, 768, 1440]) {
  test.describe(`category navigation at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width < 1024, isMobile: width < 1024 });

    for (const locale of ['en', 'es-CL']) {
      test(`homepage and directory share visual and interaction rules in ${locale}`, async ({ page }) => {
        await seedNecessaryCookieConsent(page);
        await page.route('**/category-style.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect x="20" y="20" width="80" height="80" fill="#173f67"/></svg>' }));
        await page.route('http://localhost:8080/api/v1/**', route => {
          const pathname = new URL(route.request().url()).pathname;
          if (pathname.endsWith('/categories')) return route.fulfill({ json: { data: { categories } } });
          if (pathname.endsWith('/products')) return route.fulfill({ json: { data: { products: [], total: 0 } } });
          return route.fulfill({ json: { data: {} } });
        });

        await page.goto(`/${locale}`);
        const homeEntry = page.locator('#categories a').first();
        await expect(homeEntry).toBeVisible();
        await expect(homeEntry).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        const homeStyle = await homeEntry.evaluate(element => {
          const style = getComputedStyle(element);
          return { color: style.color, transitionDuration: style.transitionDuration, textAlign: style.textAlign };
        });
        const homeSurface = await page.locator('.seo-interactive-content > main:visible').evaluate(element => getComputedStyle(element).backgroundColor);

        await page.goto(`/${locale}/categories`);
        const main = page.locator('.seo-interactive-content > main:visible');
        await expect.poll(() => main.evaluate(element => {
          let opacity = 1;
          for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
          return opacity;
        })).toBe(1);
        const entries = main.locator('a[href*="/products?category_id="]');
        await expect(entries).toHaveCount(categories.length);
        const first = entries.first();
        await expect(first).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(first).toHaveCSS('box-shadow', 'none');
        await expect(first).toHaveCSS('color', homeStyle.color);
        await expect(first).toHaveCSS('text-align', homeStyle.textAlign);
        await expect(first).toHaveCSS('transition-duration', homeStyle.transitionDuration);
        await expect(main).toHaveCSS('background-color', homeSurface);
        await expect(first.getByRole('img')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(first.locator('img')).toHaveJSProperty('src', new URL('/category-style.svg', page.url()).href);
        expect(Math.round((await first.getByRole('img').boundingBox())!.height)).toBeGreaterThanOrEqual(88);

        const count = entries.nth(1).locator('p');
        await expect(count).toHaveText(locale === 'en' ? '1 product' : '1 producto');
        await expect(count).toHaveCSS('font-size', '13px');
        await expect(count).toHaveCSS('color', 'rgb(66, 84, 102)');
        const titleBounds = (await entries.nth(1).locator('h2').boundingBox())!;
        const countBounds = (await count.boundingBox())!;
        expect(countBounds.y - titleBounds.y - titleBounds.height).toBeLessThanOrEqual(6);
        await expect(first.locator('p')).toHaveText(locale === 'en' ? '2 products' : '2 productos');
        await expect(entries.nth(2).locator('p')).toHaveText(locale === 'en' ? '0 products' : '0 productos');
        await expect(entries.nth(3).locator('p')).toHaveCount(0);

        const boxes = await entries.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
        const columns = width < 640 ? 2 : width < 1024 ? 3 : 4;
        expect(boxes.slice(0, columns).every(box => Math.abs(box.y - boxes[0].y) < 1)).toBe(true);
        expect(boxes[columns].y).toBeGreaterThan(boxes[0].y);
        for (const heading of await entries.locator('h2').all()) {
          expect(await heading.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await first.hover();
        if (width >= 1024) {
          await expect(first).toHaveCSS('background-color', 'rgb(255, 255, 255)');
          await expect(first).not.toHaveCSS('box-shadow', 'none');
        } else {
          await expect(first).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
          await expect(first).toHaveCSS('box-shadow', 'none');
        }
        await page.mouse.move(0, 0);
        await page.keyboard.press('Tab');
        await first.focus();
        await expect(first).toHaveCSS('outline-style', 'solid');
        await expect(first).toHaveCSS('background-color', 'rgb(255, 255, 255)');
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(new RegExp(`/${locale}/products\\?category_id=1$`));
      });
    }
  });
}
