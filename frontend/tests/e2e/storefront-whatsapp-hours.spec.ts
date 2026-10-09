import { expect, test } from '@playwright/test';
import { isWithinSupportHours } from '../../src/lib/support-hours';
import { seedNecessaryCookieConsent } from './helpers/shipping';

// January = UTC-3, July = UTC-4. Boundary instants are in UTC, not runner time.
const cases: Array<[string, boolean]> = [
  ['2026-01-05T12:59:59Z', false], ['2026-01-05T13:00:00Z', true],
  ['2026-01-05T20:29:59Z', true], ['2026-01-05T20:30:00Z', false],
  ['2026-01-09T20:29:59Z', true], ['2026-01-09T20:30:00Z', false],
  ['2026-01-10T13:29:59Z', false], ['2026-01-10T13:30:00Z', true],
  ['2026-01-10T18:29:59Z', true], ['2026-01-10T18:30:00Z', false],
  ['2026-01-11T15:00:00Z', false], ['2026-01-12T02:59:59Z', false],
  ['2026-07-06T13:59:59Z', false], ['2026-07-06T14:00:00Z', true],
  ['2026-07-06T21:29:59Z', true], ['2026-07-06T21:30:00Z', false],
  ['2026-07-11T14:29:59Z', false], ['2026-07-11T14:30:00Z', true],
  ['2026-07-11T19:29:59Z', true], ['2026-07-11T19:30:00Z', false],
  ['2026-07-12T16:00:00Z', false],
];

test('Santiago weekly schedule handles exact opening/closing boundaries and summer/winter offsets', () => {
  for (const [instant, open] of cases) expect(isWithinSupportHours(new Date(instant)), instant).toBe(open);
});

test.beforeEach(async ({ page, context }) => {
  await seedNecessaryCookieConsent(page);
  // Observe links and popups without contacting WhatsApp or sending messages.
  await context.route('https://wa.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Local click-to-chat test</p>' }));
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/products/22') return route.fulfill({ json: { data: {
      id: 22, slug: 'hours-test-hub', name: 'USB-C Hub & Dock', description: '', specifications: '{}',
      status: 'published', is_active: true, images: [],
      skus: [{ id: 220, product_id: 22, sku_code: 'HUB-220', price: 15990, inventory: 4, attributes: [], is_active: true }],
    } } });
    if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [] } } });
    return route.fulfill({ json: { data: {} } });
  });
});

for (const locale of ['es-CL', 'en']) {
  test(`off-hours notice is opt-in, dismissible and preserves product inquiry in ${locale}`, async ({ page, context }) => {
    await page.clock.setFixedTime(new Date('2026-01-11T15:00:00Z'));
    await page.goto(`/${locale}/products/22?utm_source=test#details`);
    const contact = page.locator('.sf-whatsapp-contact');
    const dialog = page.locator('.sf-whatsapp-notice');
    await expect(contact).toHaveAttribute('href', /hours-test-hub/);
    await expect(dialog).toHaveCount(0);
    await contact.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'false');
    await expect(dialog).toContainText(locale === 'en' ? 'We are outside our service hours.' : 'Estamos fuera de nuestro horario de atención.');
    await expect(dialog).toContainText('10:00–17:30');
    await expect(contact.locator('.anticon')).toHaveCSS('color', 'rgb(22, 124, 73)');
    const close = dialog.getByRole('button', { name: locale === 'en' ? 'Close notice' : 'Cerrar aviso' });
    await expect(close).toBeFocused();
    expect(context.pages()).toHaveLength(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(contact).toBeFocused();
    await contact.click();
    await close.click();
    await expect(contact).toBeFocused();
    await contact.click();
    await page.getByRole('heading', { name: 'USB-C Hub & Dock', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await contact.click();
    const proceed = dialog.getByRole('link', { name: locale === 'en' ? 'Open WhatsApp' : 'Abrir WhatsApp' });
    expect(await proceed.getAttribute('href')).toBe(await contact.getAttribute('href'));
    await expect(proceed).toHaveAttribute('rel', 'noopener noreferrer');
    const popupEvent = page.waitForEvent('popup');
    await proceed.click();
    const popup = await popupEvent;
    await popup.waitForURL('https://wa.me/**');
    const text = new URL(popup.url()).searchParams.get('text')!;
    expect(text).toContain('USB-C Hub & Dock');
    expect(text).toContain(`https://www.plexoria.cl/${locale}/products/hours-test-hub`);
    expect(text).not.toMatch(/utm_source|#details|localhost/);
    await popup.close();
    await expect(dialog).toHaveCount(0);
    await contact.click();
    await page.getByRole('link', { name: locale === 'en' ? 'Categories' : 'Categorías', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/categories$`));
    await expect(dialog).toHaveCount(0);
  });
}

for (const timezoneId of ['Asia/Taipei', 'America/Los_Angeles']) {
  test.describe(`visitor in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test('click checks current Santiago time even when the page stays open across closing time', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-07-06T21:29:59Z'));
      await page.goto('/en/contact');
      const contact = page.locator('.sf-whatsapp-contact');
      const popupEvent = page.waitForEvent('popup');
      await contact.click();
      const popup = await popupEvent;
      await popup.waitForURL('https://wa.me/**');
      expect(new URL(popup.url()).searchParams.get('text')).toBe('Hello, I have a question about PLEXORIA.');
      await popup.close();
      await expect(page.locator('.sf-whatsapp-notice')).toHaveCount(0);
      await page.clock.setFixedTime(new Date('2026-07-06T21:30:00Z'));
      await contact.click();
      await expect(page.locator('.sf-whatsapp-notice')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.clock.setFixedTime(new Date('2026-07-07T14:00:00Z'));
      const nextPopupEvent = page.waitForEvent('popup');
      await contact.click();
      await (await nextPopupEvent).close();
      await expect(page.locator('.sf-whatsapp-notice')).toHaveCount(0);
    });
  });
}

for (const width of [320, 390, 1440]) {
  test(`notice fits ${width}px and respects purchase/overlay priority`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-11T15:00:00Z'));
    await page.setViewportSize({ width, height: width === 320 ? 480 : 680 });
    await page.goto('/en/products/22');
    const contact = page.locator('.sf-whatsapp-contact');
    const dialog = page.locator('.sf-whatsapp-notice');
    await expect(contact).toHaveAttribute('href', /hours-test-hub/);
    if (width < 640) await expect(page.getByTestId('mobile-purchase-bar')).toBeInViewport();
    await contact.click();
    await expect(dialog).toBeVisible();
    // Hit-testing catches a sticky header covering the close control on short screens.
    await dialog.getByRole('button', { name: 'Close notice' }).click({ trial: true });
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    const button = await contact.boundingBox();
    expect(box!.y + box!.height + 10).toBeLessThanOrEqual(button!.y);
    if (width < 640) {
      const bar = await page.getByTestId('mobile-purchase-bar').boundingBox();
      expect(button!.y + button!.height + 12).toBeLessThanOrEqual(bar!.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/whatsapp-hours-${width}.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cookie preferences' }).click();
    await expect(page.locator('.sf-whatsapp-widget')).toBeHidden();
  });
}
