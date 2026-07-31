import { expect, test } from '@playwright/test';

test('storefront tokens stay scoped away from the admin application', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });

  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin' } } });
      return;
    }
    if (path === '/api/v1/products') {
      await route.fulfill({ json: { data: { products: [], total: 0 } } });
      return;
    }
    if (path === '/api/v1/categories') {
      await route.fulfill({ json: { data: { categories: [] } } });
      return;
    }
    if (path === '/api/v1/banners') {
      await route.fulfill({ json: { data: { banners: [] } } });
      return;
    }
    if (path === '/api/v1/announcements') {
      await route.fulfill({ json: { data: { announcements: [] } } });
      return;
    }
    if (path === '/api/v1/admin/banners') {
      await route.fulfill({ json: { data: { banners: [] } } });
      return;
    }
    if (path === '/api/v1/admin/announcements') {
      await route.fulfill({ json: { data: { announcements: [] } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en');
  const storefrontRoot = page.locator('body > .storefront');
  await expect(storefrontRoot).toHaveCount(1);
  await expect(storefrontRoot).toHaveCSS('--sf-brand', '#173f67');
  await page.screenshot({ path: testInfo.outputPath('390-storefront-scope.png'), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/content');
  await expect(page.getByRole('heading', { name: '内容管理' })).toBeVisible();
  await expect(page.locator('.storefront')).toHaveCount(0);
  const leakedTokens = await page.locator('body').evaluate((body) => {
    const style = getComputedStyle(body);
    return ['--sf-bg', '--sf-brand', '--sf-accent', '--sf-ink']
      .filter((token) => style.getPropertyValue(token).trim() !== '');
  });
  expect(leakedTokens).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('1440-admin-isolation.png'), fullPage: true });
});
