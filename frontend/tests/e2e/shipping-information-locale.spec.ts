import { expect, test } from '@playwright/test';
import documents from '../../src/lib/legal/documents.json';
import english from '../../src/lib/legal/documents.en.json';
import { seedNecessaryCookieConsent } from './helpers/shipping';

for (const locale of ['en', 'es-CL']) {
  for (const width of [320, 768, 1440]) {
    test(`shipping information and global pickup notice use ${locale} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seedNecessaryCookieConsent(page);
      await page.route('http://localhost:8080/api/v1/**', route => route.fulfill({ json: { data: {} } }));
      await page.goto(`/${locale}/help/shipping`);
      const article = page.locator('#main-content article');
      const copy = locale === 'en' ? english.documents.shipping : documents.documents.shipping;
      await expect(article.getByRole('heading', { name: copy.title, exact: true })).toBeVisible();
      for (const paragraph of copy.paragraphs) await expect(article).toContainText(paragraph);
      const pickup = locale === 'en' ? 'Free warehouse pickup' : 'Retiro gratis en bodega';
      await expect(article.getByRole('heading', { name: pickup, exact: true })).toBeVisible();
      await expect(article).toContainText('Av. Marathón 2499, Bodega 041, Macul');
      const notice = page.getByRole('region', { name: new RegExp(pickup) });
      await expect(notice).toBeVisible();
      await expect(notice.getByRole('link')).toHaveAttribute('href', `/${locale}/help/shipping`);
      await expect(notice).toContainText(locale === 'en' ? 'Free shipping from $19,900' : 'Envío gratis desde $19.900');
      await expect(notice).toContainText(pickup);
      if (locale === 'en') {
        await expect(article).toContainText(`Last updated: ${english.updated}`);
        await expect(article).toContainText(`Version ${documents.version}`);
        await expect(article).toContainText('Arrange the date and time');
        await expect(article.getByRole('link', { name: 'Read the Spanish shipping information' })).toHaveAttribute('href', '/es-CL/help/shipping');
        await expect(article).not.toContainText('1. Cobertura, costo y plazo');
        await expect(article).not.toContainText('Última actualización');
        expect(english.version).toBe(documents.version);
        expect(english.documents.shipping.paragraphs).toHaveLength(documents.documents.shipping.paragraphs.length);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // The benefit is also present when the buyer leaves the homepage/help page.
      await page.goto(`/${locale}/products`);
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(pickup);
    });
  }
}
