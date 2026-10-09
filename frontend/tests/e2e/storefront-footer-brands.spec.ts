import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

const capabilities = {
  configured: true, transfer_enabled: true,
  providers: [{ code: 'mercadopago', accepting_new: true }, { code: 'webpay_plus', accepting_new: true }],
};

test.beforeEach(async ({ page }) => {
  await seedNecessaryCookieConsent(page);
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/store-config/online-payment') return route.fulfill({ json: { data: capabilities } });
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: true, accounts: [{}] } } });
    return route.fulfill({ json: { data: {} } });
  });
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`footer brands are quiet, deduplicated and aligned at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/es-CL/contact');
    const footer = page.locator('footer.sf-footer');
    const payments = footer.locator('.sf-footer-payments');
    await expect(payments.getByRole('img')).toHaveCount(6);
    for (const name of ['Mercado Pago', 'Visa', 'Mastercard', 'American Express', 'Banco Santander', 'Webpay Plus']) await expect(payments.getByAltText(name, { exact: true })).toHaveCount(1);
    expect(await payments.locator('img').evaluateAll(images => images.map(img => img.getAttribute('alt')))).toEqual(['Mercado Pago', 'Visa', 'Mastercard', 'American Express', 'Banco Santander', 'Webpay Plus']);
    await expect(payments).not.toContainText(/CLP|✓/);
    await expect(payments).toContainText('Transferencia bancaria');
    await expect(footer.getByText('También en', { exact: true })).toBeVisible();
    await expect(payments.getByRole('heading', { name: 'Medios de pago' })).toBeVisible();
    for (const card of await payments.locator('.sf-footer-brand-card').all()) {
      await expect(card).toHaveCSS('height', '28px');
      await expect(card).toHaveCSS('width', (await card.getAttribute('class'))!.includes('--wide') ? '64px' : '44px');
      await expect(card).not.toHaveAttribute('tabindex');
      await expect(card).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.08)');
      await expect(card.locator('img')).toHaveCSS('opacity', '0.65');
      await expect(card.locator('img')).toHaveCSS('filter', /grayscale\(1\)/);
    }
    for (const img of await footer.locator('.sf-footer-brand-image').all()) {
      await expect(img).toHaveAttribute('width', /^\d+$/);
      await expect(img).toHaveAttribute('height', /^\d+$/);
      expect(await img.getAttribute('alt')).toBeTruthy();
    }
    const channelCards = footer.locator('.sf-footer-brand-card--channel');
    for (const card of await channelCards.all()) { await expect(card).toHaveCSS('width', '104px'); await expect(card).toHaveCSS('height', '48px'); }
    const grid = (await footer.locator('.sf-footer-grid').boundingBox())!;
    const copyright = (await footer.locator('.sf-footer-copyright').boundingBox())!;
    const payment = (await payments.boundingBox())!;
    expect(Math.abs(copyright.x - grid.x)).toBeLessThan(1);
    if (width >= 1024) {
      expect(Math.abs(payment.x + payment.width - grid.x - grid.width)).toBeLessThan(1);
      expect(Math.abs(payment.y + payment.height / 2 - copyright.y - copyright.height / 2)).toBeLessThan(1);
    } else {
      expect(payment.y).toBeGreaterThan(copyright.y + copyright.height);
      expect(Math.abs(payment.x - grid.x)).toBeLessThan(1);
    }
    await expect(footer.locator('.sf-footer-payment-list')).toHaveCSS('gap', '8px');
    await expect(footer.getByAltText('American Express')).toHaveCSS('width', '22px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/footer-brands-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('mouse hover and keyboard focus restore original marks without affecting layout', async ({ page }) => {
  await page.goto('/en/contact');
  const footer = page.locator('footer.sf-footer');
  await expect(footer.getByText('Also on', { exact: true })).toBeVisible();
  await expect(footer.locator('.sf-footer-payment-list img')).toHaveCount(6);
  const card = footer.getByRole('link', { name: 'PLEXORIA on Mercado Libre' });
  await card.hover();
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(card.locator('img')).toHaveCSS('filter', 'none');
  await expect(card.locator('img')).toHaveCSS('opacity', '1');
  await expect(card).toHaveCSS('transition-duration', '0.22s, 0.22s');
  await page.mouse.move(0, 0);
  await expect(card.locator('img')).toHaveCSS('opacity', '0.65');
  await card.focus();
  await expect(card).toHaveCSS('outline-style', 'solid');
  await expect(card.locator('img')).toHaveCSS('filter', 'none');
  await page.keyboard.press('Tab');
  await expect(footer.getByRole('link', { name: 'PLEXORIA on Falabella' })).toBeFocused();
  const webpay = footer.locator('.sf-footer-mark--webpay');
  await webpay.hover();
  await expect(webpay.locator('img')).toHaveCSS('filter', 'none');
  await expect(webpay).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The existing storefront-wide reduced-motion rule uses 0.01ms !important.
  expect(await webpay.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.00001);
});

test.describe('touch input', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('shows recognizable desaturated colour and retains keyboard focus on hybrid devices', async ({ page }) => {
    await page.goto('/es-CL/contact');
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    const footer = page.locator('footer.sf-footer');
    await expect(footer.locator('.sf-footer-payment-list img')).toHaveCount(6);
    for (const img of await footer.locator('.sf-footer-brand-image').all()) {
      await expect(img).toHaveCSS('filter', 'saturate(0.6)');
      await expect(img).toHaveCSS('opacity', '1');
    }
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await footer.locator('.sf-footer-payments').scrollIntoViewIfNeeded();
      for (const mark of ['mercadopago', 'visa', 'mastercard', 'amex', 'webpay']) {
        const payment = footer.locator(`.sf-footer-mark--${mark}`);
        const img = payment.locator('img');
        await expect(payment).toHaveCSS('background-color', ['visa', 'amex'].includes(mark) ? 'rgb(203, 213, 223)' : 'rgba(255, 255, 255, 0.08)');
        await expect(payment).toHaveCSS('height', '28px');
        await expect(payment).toHaveCSS('width', mark === 'webpay' ? '64px' : '44px');
        await expect.poll(() => img.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      }
      const amex = footer.getByAltText('American Express');
      await expect(amex).toHaveCSS('width', '24px');
      await expect(amex).toHaveCSS('height', '24px');
      const art = (await amex.boundingBox())!;
      const cardBox = (await footer.locator('.sf-footer-mark--amex').boundingBox())!;
      expect(art.y).toBeGreaterThanOrEqual(cardBox.y);
      expect(art.y + art.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const card = footer.getByRole('link', { name: 'PLEXORIA en Falabella' });
    await card.focus();
    await expect(card.locator('img')).toHaveCSS('filter', 'none');
    await expect(card).toHaveCSS('outline-style', 'solid');
    await card.blur();
    await expect(card.locator('img')).toHaveCSS('filter', 'saturate(0.6)');
    await footer.screenshot({ path: 'test-results/footer-brands-touch-390.png' });
  });
});

for (const mode of ['webpay-only', 'transfer-only', 'disabled', 'unconfirmed', 'failed']) {
  test(`only confirmed payment methods are advertised: ${mode}`, async ({ page }) => {
    await page.route('http://localhost:8080/api/v1/store-config/online-payment', (route) => mode === 'failed' ? route.abort() : route.fulfill({ json: { data: mode === 'unconfirmed' ? {} : {
      configured: mode === 'webpay-only', transfer_enabled: mode === 'transfer-only',
      providers: [{ code: 'mercadopago', accepting_new: false }, { code: 'webpay_plus', accepting_new: mode === 'webpay-only' }],
    } } }));
    const loaded = page.waitForResponse((response) => response.url().endsWith('/store-config/transfer-payment'));
    await page.goto('/en/contact');
    await loaded;
    const footer = page.locator('footer.sf-footer');
    if (mode === 'webpay-only') {
      await expect(footer.locator('.sf-footer-payment-list img')).toHaveCount(3);
      await expect(footer.getByAltText('Webpay Plus')).toBeVisible();
      await expect(footer.getByAltText('American Express')).toHaveCount(0);
      await expect(footer.getByAltText('Mercado Pago', { exact: true })).toHaveCount(0);
    } else if (mode === 'transfer-only') {
      await expect(footer.getByRole('listitem', { name: 'Bank transfer · Banco Santander' })).toBeVisible();
      await expect(footer.locator('.sf-footer-payment-list img')).toHaveCount(1);
    } else {
      await expect(footer.locator('.sf-footer-payments')).toHaveCount(0);
    }
  });
}
