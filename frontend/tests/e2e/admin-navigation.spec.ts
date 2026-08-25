import { expect, test, type Page } from '@playwright/test';

async function authenticateAdmin(page: Page, role = 'super_admin') {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('refresh_token', 'e2e-refresh');
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'e2e-token', refreshToken: 'e2e-refresh', isAuthenticated: true },
      version: 0,
    }));
  });
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin Plexoria', role, permissions: role === 'user' ? [] : ['manage_products', 'manage_payments', 'review_transfer_payments', 'view_system_monitoring'], is_active: true, created_at: '', updated_at: '' } } });
      return;
    }
    if (path === '/api/v1/admin/products') {
      await route.fulfill({ json: { data: { products: [{
        id: 12, name: 'Mouse Gamer Inalámbrico', slug: 'mouse-gamer-inalambrico', description: '', specifications: '{}',
        status: 'published', is_active: true, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-06T00:00:00Z', skus: [],
      }], total: 1, page: 1, page_size: 20 } } });
      return;
    }
    if (path === '/api/v1/admin/categories') {
      await route.fulfill({ json: { data: { categories: [] } } });
      return;
    }
    if (path === '/api/v1/admin/product-shipping-templates') {
      await route.fulfill({ json: { data: [] } });
      return;
    }
    if (path === '/api/v1/admin/products/12' && route.request().method() === 'GET') {
      await route.fulfill({ json: { data: {
        id: 12, name: 'Mouse Gamer Inalámbrico', slug: 'mouse-gamer-inalambrico', short_description: '', description: '', specifications: '{}',
        status: 'published', is_active: true, version: 2, condition: 'new', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-06T00:00:00Z',
        skus: [], media: [], images: [], structured_specifications: [], variant_dimensions: [],
      } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/specifications') {
      await route.fulfill({ json: { data: { specifications: [], version: 2 } } });
      return;
    }
    if (path === '/api/v1/admin/products/12/variants/preview') {
      await route.fulfill({ json: { data: { kept: [], created: [], deactivated: [], deletable: [] } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });
}

async function authenticateSystemAdmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true }, version: 0 }));
  });
  await page.route('http://localhost:8080/api/v1/auth/profile', (route) => route.fulfill({
    json: { data: { id: 9, email: 'admin@example.test', full_name: 'Admin', role: 'super_admin', permissions: ['manage_system'], is_active: true } },
  }));
  await page.route('http://localhost:8080/api/v1/admin/store-config/transfer-accounts', (route) => route.fulfill({
    json: { data: { accounts: [] } },
  }));
}

test('deep admin entry redirects unauthenticated users to the real localized login route', async ({ page }) => {
  await page.goto('/admin/products');
  await expect(page).toHaveURL(/\/es-CL\/login\?redirect=%2Fadmin%2Fproducts$/);
  await expect(page.getByRole('heading', { name: /Iniciar sesión/ })).toBeVisible();
});

test('non-admin users return to the localized storefront instead of an ambiguous root route', async ({ page }) => {
  await authenticateAdmin(page, 'user');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/es-CL$/);
});

test('keyboard locale switching preserves query and unsaved editor values', async ({ page }) => {
  await authenticateAdmin(page);
  await page.goto('/admin/products/12?source=catalog');

  const title = page.getByLabel('商品标题（es-CL）');
  await title.fill('Cambio todavía no guardado');
  const localeSelect = page.getByLabel('后台语言');
  await localeSelect.focus();
  await localeSelect.press('Enter');
  await localeSelect.press('ArrowDown');
  await localeSelect.press('Enter');

  await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
  await expect(page.getByLabel('Título del producto (es-CL)')).toHaveValue('Cambio todavía no guardado');
  await expect(page).toHaveURL(/\/admin\/products\/12\?source=catalog$/);
});

test('mobile admin shell exposes an accessible storefront action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateAdmin(page);
  await page.goto('/admin/products');
  const storeHome = page.getByRole('link', { name: '商城首页' });
  await expect(storeHome).toBeVisible();
  await expect(storeHome).toHaveAttribute('href', '/es-CL');
  await expect(storeHome).toHaveAttribute('rel', /noopener/);
});

test('published product list exposes only the unpublish lifecycle command', async ({ page }) => {
  await authenticateAdmin(page);
  let unpublishCalls = 0;
  await page.route('http://localhost:8080/api/v1/admin/products/12/unpublish', async (route) => {
    unpublishCalls += 1;
    await route.fulfill({ json: { data: { id: 12, status: 'unpublished' } } });
  });
  await page.goto('/admin/products');
  await page.getByRole('button', { name: '下架' }).click();
  await page.getByRole('button', { name: '确 定' }).click();
  await expect.poll(() => unpublishCalls).toBe(1);
});

test('admin shell uses the Grafana vhost only when monitoring is explicitly enabled', async ({ page }) => {
  await authenticateAdmin(page);
  await page.goto('/admin/products');
  const monitoringLink = page.getByRole('link', { name: '系统监控' });
  if (process.env.NEXT_PUBLIC_SYSTEM_MONITORING_LINK_ENABLED === 'true') {
    await expect(monitoringLink).toHaveAttribute('href', 'https://grafana.plexoria.cl');
    await expect(monitoringLink).toHaveAttribute('target', '_blank');
    await expect(monitoringLink).toHaveAttribute('rel', /noopener/);
  } else {
    await expect(monitoringLink).toHaveCount(0);
  }
});

test('admin shell removes the legacy payment review entry and keeps trusted transfer review', async ({ page }) => {
  await authenticateAdmin(page);
  await page.goto('/admin/products');
  await expect(page.getByText('转账确认', { exact: true })).toHaveCount(0);
  await expect(page.getByText('到账核验', { exact: true })).toBeVisible();
});

test('admin shell persists language, opens storefront links, and logs out without a 404', async ({ page }) => {
  await authenticateAdmin(page);
  await page.goto('/admin/products');

  const storeHome = page.getByRole('link', { name: '商城首页' });
  await expect(storeHome).toHaveAttribute('href', '/es-CL');
  await expect(storeHome).toHaveAttribute('target', '_blank');
  await expect(storeHome).toHaveAttribute('rel', /noopener/);

  const publishedProduct = page.getByRole('link', { name: '前台查看' });
  await expect(publishedProduct).toHaveAttribute('href', '/es-CL/products/mouse-gamer-inalambrico');
  await expect(publishedProduct).toHaveAttribute('target', '_blank');

  await page.getByLabel('后台语言').click();
  await page.locator('.ant-select-dropdown:visible').getByText('Español (Chile)', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ir a la tienda' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver en la tienda' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('plexoria_admin_locale'))).toBe('es-CL');

  await page.reload();
  await expect(page.getByRole('link', { name: 'Ir a la tienda' })).toBeVisible();

  await page.getByRole('button', { name: /Admin Plexoria/ }).click();
  await page.getByText('Cerrar sesión', { exact: true }).click();
  await expect(page).toHaveURL(/\/es-CL\/login$/);
  await expect(page.getByRole('heading', { name: /Iniciar sesión/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
});

test('system settings keeps its legacy URL and presents payment accounts as an inner page', async ({ page }) => {
  await authenticateSystemAdmin(page);
  await page.goto('/admin/settings');

  await expect(page).toHaveURL(/\/admin\/settings\/payment-accounts$/);
  await expect(page.getByRole('menuitem', { name: /系统设置/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '收款账户' })).toBeVisible();
});
