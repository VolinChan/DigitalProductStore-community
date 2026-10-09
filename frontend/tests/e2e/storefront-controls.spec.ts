import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

test('native storefront controls have no browser chrome and keep visible keyboard focus', async ({ page }) => {
  await seedNecessaryCookieConsent(page);
  await page.goto('/en/login');
  const language = page.getByRole('button', { name: 'Switch to ES' });
  await expect(language).toHaveCSS('border-top-width', '0px');
  await expect(language).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await language.focus();
  await expect(language).toHaveCSS('outline-style', 'solid');
  await expect(language).toHaveCSS('outline-width', '2px');

  const submit = page.locator('#main-content button[type="submit"]');
  await expect(submit).toHaveCSS('background-color', 'rgb(23, 63, 103)');
  await expect(submit).toHaveCSS('min-height', '48px');
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('address actions and portalled confirmation buttons share the storefront theme', async ({ page, context }) => {
  await seedNecessaryCookieConsent(page);
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: {
      token: 'e2e-token', isAuthenticated: true,
      user: { id: 9, email: 'buyer@example.com', full_name: 'Test Buyer', role: 'customer' },
    }, version: 0 }));
  });
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/v1/auth/profile'
      ? { id: 9, email: 'buyer@example.com', full_name: 'Test Buyer', role: 'customer' }
      : path === '/api/v1/me/addresses' || path === '/api/v1/locations/regions' ? [] : {};
    await route.fulfill({ json: { data } });
  });
  await page.goto('/en/profile');
  const add = page.getByRole('button', { name: /Add address$/ });
  await expect(add).toHaveCSS('height', '48px');
  await expect(add).toHaveCSS('border-radius', '999px');
  await add.click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.locator('.ant-btn-primary');
  await expect(confirm).toHaveCSS('background-color', 'rgb(23, 63, 103)');
  await expect(confirm).toHaveCSS('height', '48px');
  await expect(confirm).toHaveCSS('border-radius', '999px');
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(async () => {
    const bounds = await confirm.boundingBox();
    return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 740);
  }).toBe(true);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
