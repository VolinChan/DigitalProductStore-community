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
    await expect(logo).toHaveAttribute('src', '/plexoria-wordmark.svg');
    await expect(logo).toHaveCSS('width', `${width < 360 ? 112 : width < 640 ? 140 : width < 1024 ? 160 : 176}px`);
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const cart = header.locator('#cart-icon-header');
    await expect(cart).toHaveCSS('border-radius', '12px');
    await cart.hover();
    await expect(cart).toHaveCSS('border-radius', '12px');
    await page.mouse.move(0, 0);
    if (width >= 640) {
      const account = header.getByRole('button', { name: 'Menú de usuario' });
      await expect(account).toHaveCSS('border-radius', '12px');
      await account.hover();
      await expect(account).toHaveCSS('border-radius', '12px');
      await page.mouse.move(0, 0);
    }
    const logoBox = (await logo.boundingBox())!;
    const cartBox = (await cart.boundingBox())!;
    expect(Math.abs(logoBox.y + logoBox.height / 2 - cartBox.y - cartBox.height / 2)).toBeLessThan(1);
    if (width >= 1024) {
      const selectedLanguage = header.getByRole('button', { name: 'Switch to ES' });
      await expect(selectedLanguage).toHaveAttribute('aria-pressed', 'true');
      await expect(selectedLanguage).toHaveCSS('background-color', 'rgb(232, 244, 251)');
      await expect(selectedLanguage).toHaveCSS('color', 'rgb(23, 63, 103)');
      await expect(selectedLanguage).toHaveCSS('min-height', '44px');
      await expect(selectedLanguage).toHaveCSS('border-radius', '12px');
      await expect(header.getByRole('button', { name: 'Switch to EN' })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
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
    const submit = search.locator('..').getByRole('button', { name: 'Buscar', exact: true });
    await expect(search.locator('..')).toHaveCSS('border-radius', '12px');
    await expect(submit).toHaveCSS('border-radius', '12px');
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await search.fill('cable');
    await expect(search).toHaveValue('cable');
    const clear = search.locator('..').getByRole('button', { name: 'Borrar búsqueda', exact: true });
    await expect(clear).toHaveCSS('border-radius', '12px');
    await expect(clear).toHaveCSS('width', '44px');
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    if (width < 1024) {
      await header.getByRole('button', { name: 'Menú', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByRole('img', { name: 'PLEXORIA', exact: true })).toHaveAttribute('src', '/plexoria-wordmark.svg');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  });
}

for (const width of [320, 360, 390]) {
  test(`signed-in navigation keeps the wordmark and notification access at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await seedNecessaryCookieConsent(page);
    const user = { id: 9, email: 'buyer@example.com', full_name: 'Test Buyer', role: 'customer' };
    await page.addInitScript(user => {
      localStorage.setItem('access_token', 'e2e-token');
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', isAuthenticated: true, user }, version: 0 }));
    }, user);
    await page.route('http://localhost:8080/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      const data = path === '/api/v1/auth/profile' ? user
        : path === '/api/v1/notifications/unread-count' ? { count: 3 }
          : path === '/api/v1/notifications' ? [] : {};
      return route.fulfill({ json: { data } });
    });
    await page.goto('/en/contact');
    const header = page.locator('header.sf-header');
    const menu = header.getByRole('button', { name: 'Menu', exact: true });
    await expect(menu).toHaveAccessibleDescription('3 Notifications');
    await expect(header.getByAltText('Plexoria Logo')).toHaveCSS('width', `${width < 360 ? 112 : 140}px`);
    await expect(header.getByRole('link', { name: 'Notifications', exact: true })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await menu.click();
    const notification = page.getByRole('dialog').getByRole('link', { name: /Notifications/ });
    await expect(notification).toContainText('3');
    await expect(notification).toHaveAttribute('href', '/en/notifications');
    await notification.click();
    await expect(page).toHaveURL(/\/en\/notifications$/);
    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
}
