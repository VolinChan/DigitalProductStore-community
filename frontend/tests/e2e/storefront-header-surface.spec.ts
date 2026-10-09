import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`sticky navigation keeps a unified light surface over blue content at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await seedNecessaryCookieConsent(page);
    await page.route('http://localhost:8080/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/products') return route.fulfill({ json: { data: { products: [], total: 0 } } });
      if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [] } } });
      if (path === '/api/v1/banners') return route.fulfill({ json: { data: { banners: [] } } });
      if (path === '/api/v1/announcements') return route.fulfill({ json: { data: { announcements: [] } } });
      return route.fulfill({ json: { data: {} } });
    });
    await page.goto('/es-CL');
    const header = page.locator('header.sf-header');
    const logoLink = header.getByRole('link', { name: 'PLEXORIA', exact: true });
    const logo = logoLink.getByRole('img');
    await expect(header).toHaveCSS('background-color', 'rgba(251, 250, 247, 0.96)');
    await expect(logoLink).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(logo).toHaveCSS('filter', 'none');
    await expect(logo).toHaveAttribute('src', /plexoria-logo\.png/);
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const originalHeight = (await header.boundingBox())!.height;
    const help = page.locator('[data-shopping-help]');
    await help.evaluate(section => window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top + 40, behavior: 'instant' }));
    await expect.poll(async () => (await header.boundingBox())!.y).toBe(0);
    expect((await help.boundingBox())!.y).toBeLessThan(0);
    expect((await help.boundingBox())!.y + (await help.boundingBox())!.height).toBeGreaterThan(originalHeight);
    await expect(header).toHaveCSS('background-color', 'rgba(251, 250, 247, 0.96)');
    expect((await header.boundingBox())!.height).toBe(originalHeight);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await logoLink.focus();
    await expect(logoLink).toBeFocused();
    await expect(logoLink).toHaveCSS('outline-style', 'solid');
    await page.screenshot({ path: testInfo.outputPath(`header-over-blue-${width}.png`) });
    if (width < 1024) await header.getByRole('button', { name: 'Buscar', exact: true }).click();
    const search = header.getByRole('searchbox', { name: 'Buscar', exact: true }).filter({ visible: true });
    await search.fill('cable');
    await expect(search).toHaveValue('cable');
    if (width < 1024) {
      await header.getByRole('button', { name: 'Menú', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  });
}
