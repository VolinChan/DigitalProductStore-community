import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

for (const locale of ['es-CL', 'en']) {
  test(`contact prioritizes written support without changing legal disclosure in ${locale}`, async ({ page }) => {
    await seedNecessaryCookieConsent(page);
    await page.route('http://localhost:8080/api/v1/**', (route) => route.fulfill({ json: { data: {} } }));
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(`/${locale}/contact`);
      const main = page.locator('#main-content');
      await expect(main.getByRole('heading', { name: locale === 'en' ? 'How can we help?' : '¿En qué podemos ayudarte?', exact: true })).toBeVisible();
      await expect(main).toContainText(locale === 'en'
        ? 'Email is our preferred support channel. You can also message us on WhatsApp and tell us what you need.'
        : 'El correo electrónico es nuestro canal preferente de atención. También puedes escribirnos por WhatsApp y contarnos qué necesitas.');
      await expect(main).not.toContainText('+56 9 9509 6835');
      await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
      const channels = page.getByTestId('contact-channels');
      const links = channels.locator(':scope > a');
      await expect(links).toHaveCount(2);
      await expect(links.nth(0)).toHaveAttribute('href', 'https://wa.me/56995096835');
      await expect(links.nth(0)).toHaveAttribute('target', '_blank');
      await expect(links.nth(0)).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(links.nth(1)).toHaveAttribute('href', 'mailto:soporte@plexoria.cl');
      await expect(main.getByText(/10:00–17:30/)).toHaveCount(1);
      const hours = page.getByTestId('contact-service-hours');
      await expect(hours).toContainText('10:30–15:30');
      const grid = (await channels.boundingBox())!;
      const row = (await hours.boundingBox())!;
      expect(Math.abs(grid.width - row.width)).toBeLessThan(1);
      const first = (await links.nth(0).boundingBox())!;
      const second = (await links.nth(1).boundingBox())!;
      if (width < 640) expect(second.y).toBeGreaterThan(first.y + first.height);
      else expect(Math.abs(first.y - second.y)).toBeLessThan(1);
      await links.nth(0).focus();
      await expect(links.nth(0)).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Tab');
      await expect(links.nth(1)).toBeFocused();
      await expect(page.locator('footer').getByRole('link', { name: locale === 'en' ? 'View service hours' : 'Ver horarios de atención', exact: true })).toHaveAttribute('href', `/${locale}/contact`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.locator('#main-content').getByRole('link', { name: locale === 'en' ? 'View full information' : 'Ver información completa', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/legal/supplier$`));
    await expect(page.locator('#main-content')).toContainText('+56 9 9509 6835');
    await page.goto(`/${locale}/legal`);
    await expect(page.locator('#main-content a[href="tel:+56995096835"]')).toHaveCount(1);
  });
}
