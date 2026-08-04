import { expect, test } from '@playwright/test';
import { mockCartContractRoute, seedNecessaryCookieConsent } from './helpers/shipping';

const product = {
  id: 22, name: 'Compact USB-C Hub with a long everyday product name', description: 'Reliable connections for home and office.', specifications: '{}',
  status: 'published', is_active: true, created_at: '2026-07-30T09:00:00Z', updated_at: '2026-07-30T09:00:00Z', images: [],
  skus: [{ id: 220, product_id: 22, sku_code: 'HUB-220', price: 15990, inventory: 99, attributes: [], is_active: true }],
};

const viewports = [320, 360, 390, 768, 1024, 1440];
const corePaths = ['/en', '/en/products', '/en/products/22', '/en/cart', '/en/checkout'];
const orderPaths = ['/en/orders', '/en/orders/91'];
const order = {
  id: 91, order_number: 'ORD-2026-VERY-LONG-000091', shipping_address: '123 Long Test Street, Apartment 45, Santiago, Región Metropolitana',
  status: 'pending_payment', payment_method: 'online', subtotal: 15990, shipping_fee: 0, total_amount: 15990,
  created_at: '2026-07-30T09:00:00Z', updated_at: '2026-07-30T09:00:00Z',
  items: [{ id: 1, order_id: 91, sku_id: 220, sku_name: 'Compact USB-C Hub with a long everyday product name', sku_code: 'HUB-220-LONG-CODE', attributes: 'Color: Space gray · Connection: USB-C', quantity: 1, unit_price: 15990, subtotal: 15990 }],
};

for (const width of viewports) {
  test(`storefront pages and overlays do not overflow at ${width}px`, async ({ page, context }, testInfo) => {
    await seedNecessaryCookieConsent(page);
    await page.addInitScript(() => {
      localStorage.setItem('cart-storage', JSON.stringify({ state: {
        items: [{ id: 1, sku_id: 220, sku_code: 'HUB-220', sku_name: 'Compact USB-C Hub with a long everyday product name', quantity: 1, unit_price: 15990, subtotal: 15990 }],
        totalPrice: 15990, totalItems: 1,
      }, version: 0 }));
      localStorage.setItem('access_token', 'e2e-token');
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', refreshToken: 'refresh-token', isAuthenticated: true }, version: 0 }));
    });

    await context.route('http://localhost:8080/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
	  if (await mockCartContractRoute(route, [{ id: 1, cart_item_id: 1, product_id: 22, product_name: product.name, sku_id: 220, sku_code: 'HUB-220', quantity: 1, unit_price: 15990, line_total: 15990, subtotal: 15990, stock_available: 99, available: true, issues: [] }])) return;
      if (path === '/api/v1/products/22') return route.fulfill({ json: { data: product } });
      if (path === '/api/v1/products') return route.fulfill({ json: { data: { products: [product], total: 1 } } });
      if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [{ id: 7, name: 'Cables and connectivity', slug: 'cables', is_active: true }] } } });
      if (path === '/api/v1/banners') return route.fulfill({ json: { data: { banners: [] } } });
      if (path === '/api/v1/announcements') return route.fulfill({ json: { data: { announcements: [] } } });
      if (path === '/api/v1/auth/profile') return route.fulfill({ json: { data: { id: 9, email: 'buyer@example.com', full_name: 'Test Buyer', role: 'customer' } } });
      if (path === '/api/v1/orders/91') return route.fulfill({ json: { data: order } });
      if (path === '/api/v1/orders') return route.fulfill({ json: { data: { orders: [order], total: 1 } } });
      return route.fulfill({ json: { data: {} } });
    });

    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const path of [...corePaths, ...orderPaths]) {
      await page.goto(path);
      await expect(page.locator('main').first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if ((width === 320 || width === 1440) && ['/en', '/en/products/22', '/en/checkout'].includes(path)) {
        const name = `${width}-${path === '/en' ? 'home' : path.endsWith('22') ? 'product' : 'checkout'}.png`;
        await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
      }
      if ((width === 320 || width === 1440) && path === '/en/orders/91') {
        await page.screenshot({ path: testInfo.outputPath(`${width}-order-detail.png`), fullPage: true });
      }
    }

    await page.goto('/en/products/22');
    const addButton = page.getByRole('button', { name: 'Add to cart' }).first();
    await expect(addButton).toBeEnabled();
    await addButton.click();
    const miniCart = page.getByRole('dialog');
    await expect(miniCart).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(async () => {
      const bounds = await miniCart.boundingBox();
      return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
    }).toBe(true);
    if (width === 320 || width === 1440) {
      await page.screenshot({ path: testInfo.outputPath(`${width}-mini-cart.png`) });
    }
    await miniCart.getByRole('button', { name: 'Continue shopping' }).click();
  });
}
