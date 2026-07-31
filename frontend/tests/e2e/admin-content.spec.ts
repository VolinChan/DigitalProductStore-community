import { expect, test, type Page } from '@playwright/test';

const banner = {
  id: 11,
  title: 'Back to school essentials',
  description: 'Reliable accessories for study and work.',
  image_url: 'https://example.com/back-to-school.jpg',
  link_url: 'https://example.com/collections/study',
  priority: 20,
  is_active: true,
  start_date: '2026-07-01T00:00:00Z',
  end_date: '2026-08-31T23:59:59Z',
};

const announcement = {
  id: 21,
  title: 'Weekend promotion',
  content: 'Selected accessories are available at special prices.',
  type: 'promotion',
  priority: 'high',
  is_active: true,
  start_date: '2026-07-01T00:00:00Z',
  end_date: '2026-08-31T23:59:59Z',
};

type ApiCall = { method: string; path: string; body: Record<string, unknown> };

async function mockContentApi(page: Page, calls: ApiCall[], role = 'super_admin') {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true },
      version: 0,
    }));
  });

  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() !== 'GET') {
      calls.push({ method: request.method(), path, body: request.postDataJSON() });
    }
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'operator@example.com', full_name: 'Content operator', role } } });
      return;
    }
    if (path === '/api/v1/admin/banners') {
      await route.fulfill({ json: { data: { banners: [banner] } } });
      return;
    }
    if (path === '/api/v1/admin/announcements') {
      await route.fulfill({ json: { data: { announcements: [announcement] } } });
      return;
    }
    if (path === '/api/v1/banners') {
      await route.fulfill({ json: { data: { banners: [banner] } } });
      return;
    }
    if (path === '/api/v1/announcements') {
      await route.fulfill({ json: { data: { announcements: [announcement] } } });
      return;
    }
    if (path === '/api/v1/categories') {
      await route.fulfill({ json: { data: { categories: [] } } });
      return;
    }
    if (path === '/api/v1/products') {
      await route.fulfill({ json: { data: { products: [] } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });
}

test('super admin can update existing homepage content', async ({ page }) => {
  const calls: ApiCall[] = [];
  await mockContentApi(page, calls);
  await page.goto('/admin/content');

  await expect(page.getByRole('heading', { name: '内容管理' })).toBeVisible();
  await page.getByRole('row', { name: /Back to school essentials/ }).getByRole('button', { name: /编辑/ }).click();
  await page.getByLabel('标题').fill('Updated essentials');
  await page.getByRole('button', { name: /(?:OK|确\s*定)/ }).click();

  await expect.poll(() => calls.find((call) => call.path === '/api/v1/admin/banners/11')).toMatchObject({
    method: 'PUT',
    body: expect.objectContaining({ title: 'Updated essentials', priority: 20, is_active: true }),
  });
});

test('active banner and promotion announcement render on the storefront', async ({ page }) => {
  const calls: ApiCall[] = [];
  await mockContentApi(page, calls);
  await page.goto('/en');

  await expect(page.getByText('Weekend promotion', { exact: true })).toBeVisible();
  await expect(page.getByText('Selected accessories are available at special prices.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Back to school essentials' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Back to school essentials/ })).toHaveAttribute('href', banner.link_url);
});

test('product manager does not see the content management entry', async ({ page }) => {
  const calls: ApiCall[] = [];
  await mockContentApi(page, calls, 'product_manager');
  await page.goto('/admin/products');

  await expect(page.getByText('商品管理', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('内容管理', { exact: true })).toHaveCount(0);
});
