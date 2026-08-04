import { expect, test } from '@playwright/test';
import { mockCartContractRoute, mockShippingRoute } from './helpers/shipping';

const supplierAddress = 'Alameda 2963 2971 Maipu 17 D 35 a Romero, Santiago, XIII Región Metropolitana, Chile';
const product = {
  id: 22, slug: 'compact-usb-c-hub', name: 'Compact USB-C Hub', description: 'Reliable connections.', specifications: '{}',
  status: 'published', is_active: true, created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-01T09:00:00Z', images: [],
  skus: [{ id: 220, product_id: 22, sku_code: 'HUB-220', price: 15990, inventory: 4, attributes: [], is_active: true }],
};

test('legal center exposes supplied company facts and clearly labels unapproved drafts', async ({ page }) => {
  await page.goto('/es-CL/legal');
  await expect(page.getByRole('heading', { name: 'Información legal' })).toBeVisible();
  for (const label of ['Términos y condiciones', 'Cambios, devoluciones y retracto', 'Garantía legal', 'Información de despacho', 'Política de privacidad', 'Política de cookies', 'Identificación del proveedor']) {
    await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible();
  }
  await expect(page.getByText('Plexoria SpA').first()).toBeVisible();
  await expect(page.getByText(/78\.236\.393-K/).first()).toBeVisible();
  await expect(page.getByText(supplierAddress).first()).toBeVisible();
  await expect(page.getByText('support@plexoria.cl').first()).toBeVisible();
  await expect(page.getByText('+56 9 9509 6835').first()).toBeVisible();

  await page.goto('/es-CL/legal/terms');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('note')).toContainText('Borrador para revisión profesional');
  await expect(page.getByText(/Versión 0\.1-draft/)).toBeVisible();
});

test('checkout defaults to bank transfer, hides online payment, and requires explicit legal acceptance', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('cart-storage', JSON.stringify({ state: { items: [{ id: 1, sku_id: 220, sku_code: 'HUB-220', sku_name: 'Compact USB-C Hub', quantity: 1, unit_price: 15990, subtotal: 15990 }], totalPrice: 15990, totalItems: 1 }, version: 0 })));
  const cartItem = { id: 1, cart_item_id: 1, product_id: 22, product_slug: product.slug, product_name: product.name, sku_id: 220, sku_code: 'HUB-220', quantity: 1, unit_price: 15990, line_total: 15990, subtotal: 15990, stock_available: 4, available: true, issues: [] };
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (await mockShippingRoute(route)) return;
    if (await mockCartContractRoute(route, [cartItem])) return;
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: true, accounts: [{ id: 1 }] } } });
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto('/es-CL/checkout');
  await page.getByRole('button', { name: 'Rechazar no necesarias' }).click();
  await expect(page.getByRole('radio', { name: /Transferencia bancaria/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Pago en línea/ })).toHaveCount(0);
  await expect(page.getByText('Plexoria SpA').first()).toBeVisible();
  await expect(page.getByText(/78\.236\.393-K/).first()).toBeVisible();
  const acceptance = page.getByRole('checkbox', { name: /Acepto los términos y condiciones/ });
  await expect(acceptance).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled();
});

test('cookie choices are usable at 320px, reopenable, and block analytics until consent', async ({ page, context }) => {
  let analyticsRequests = 0;
  let consentRequests = 0;
  await page.addInitScript(() => localStorage.setItem('cart-storage', JSON.stringify({ state: { items: [{ id: 1, sku_id: 220, sku_code: 'HUB-220', sku_name: 'Compact USB-C Hub', quantity: 1, unit_price: 15990, subtotal: 15990 }], totalPrice: 15990, totalItems: 1 }, version: 0 })));
  const cartItem = { id: 1, cart_item_id: 1, product_id: 22, product_slug: product.slug, product_name: product.name, sku_id: 220, sku_code: 'HUB-220', quantity: 1, unit_price: 15990, line_total: 15990, subtotal: 15990, stock_available: 4, available: true, issues: [] };
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (await mockShippingRoute(route)) return;
    if (await mockCartContractRoute(route, [cartItem])) return;
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: true, accounts: [{ id: 1 }] } } });
    if (path === '/api/v1/analytics/track') analyticsRequests += 1;
    if (path === '/api/v1/consents') consentRequests += 1;
    return route.fulfill({ json: { data: {} } });
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/en/checkout');
  await expect(page.getByRole('dialog', { name: 'Your privacy preferences' })).toBeVisible();
  await expect.poll(() => analyticsRequests).toBe(0);
  await page.getByRole('button', { name: 'Customize' }).click();
  const analytics = page.getByRole('checkbox', { name: 'Analytics' });
  await expect(analytics).not.toBeChecked();
  await analytics.check();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect.poll(() => consentRequests).toBe(1);
  await page.reload();
  await expect.poll(() => analyticsRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Cookie preferences' }).click();
  await expect(page.getByRole('dialog', { name: 'Your privacy preferences' })).toBeVisible();
  await analytics.uncheck();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect.poll(() => consentRequests).toBe(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('privacy request form submits a minimized request and shows its non-enumerable reference', async ({ page, context }) => {
  await context.route('http://localhost:8080/api/v1/privacy-requests', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ request_type: 'deletion', requester_contact: 'buyer@example.com', request_detail: 'Please review my account data.' });
    await route.fulfill({ status: 201, json: { data: { public_ref: '11111111-1111-4111-8111-111111111111', status: 'verification_pending', verification_status: 'pending', received_at: '2026-08-04T10:00:00Z', due_at: '2026-09-03T10:00:00Z' } } });
  });
  await page.goto('/en/privacy-request');
  await page.getByRole('button', { name: 'Reject nonessential' }).click();
  await page.getByLabel('Request type').selectOption('deletion');
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByLabel('Optional detail').fill('Please review my account data.');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByRole('status')).toContainText('Request registered');
  await expect(page.getByRole('status')).toContainText('11111111-1111-4111-8111-111111111111');
});
