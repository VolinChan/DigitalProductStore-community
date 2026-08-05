import { expect, test } from '@playwright/test';
import { acceptCheckoutPolicies, fillStructuredShipping, mockCartContractRoute, mockShippingRoute, seedNecessaryCookieConsent, testShippingQuote } from './helpers/shipping';

const cartItem = { id: 1, cart_item_id: 1, product_id: 1, product_name: 'Test product', sku_id: 31, sku_code: 'SKU-31', quantity: 1, unit_price: 20000, line_total: 20000, subtotal: 20000, stock_available: 5, available: true, issues: [] };

test.beforeEach(async ({ page }) => {
  await seedNecessaryCookieConsent(page);
  await page.addInitScript(() => localStorage.setItem('cart-storage', JSON.stringify({ state: { items: [{ id: 1, sku_id: 31, sku_code: 'SKU-31', sku_name: 'Test product', quantity: 1, unit_price: 20000, subtotal: 20000 }], totalPrice: 20000, totalItems: 1 }, version: 0 })));
});

test('guest sees itemized CLP shipping, explicitly persists address, and confirms a stale reprice', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const firstQuote = { ...testShippingQuote, quote_version: 'quote-v1', raw_base_amount: 2351, rounded_base_amount: 2400, subsidy_amount: 1000, remote_surcharge: 900, payable_shipping: 2300 };
  const updatedQuote = { ...firstQuote, quote_version: 'quote-v2', remote_surcharge: 1200, payable_shipping: 2600 };
  const orderPayloads: Record<string, unknown>[] = [];
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (await mockShippingRoute(route, firstQuote)) return;
    if (await mockCartContractRoute(route, [cartItem])) return;
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: false, accounts: [] } } });
    if (path === '/api/v1/orders' && request.method() === 'POST') {
      orderPayloads.push(request.postDataJSON());
      if (orderPayloads.length === 1) return route.fulfill({ status: 409, json: { success: false, error: { code: 'SHIPPING_QUOTE_STALE', message: 'changed' }, data: { quote: updatedQuote } } });
      return route.fulfill({ status: 201, json: { data: { id: 91, order_number: 'ORD-91', total_amount: 22600, shipping_payable_amount: 2600 } } });
    }
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto('/en/checkout');
  await page.getByLabel('Full name').fill('Guest Buyer'); await page.getByLabel('Email address').fill('guest@example.com'); await page.getByLabel('Contact phone').fill('+56912345678');
  await fillStructuredShipping(page, 'Guest Street');
  await page.getByRole('checkbox', { name: 'Remember this address in this browser' }).check();
  await expect(page.getByText('Base shipping').locator('..')).toContainText(/2,400/);
  await expect(page.getByText('Shipping subsidy').locator('..')).toContainText(/1,000/);
  await expect(page.getByText('Remote surcharge').locator('..')).toContainText(/900/);
  await acceptCheckoutPolicies(page);
  await page.getByRole('button', { name: 'Submit & pay' }).click();
  await expect.poll(() => orderPayloads.length).toBe(1);
  await page.getByRole('button', { name: 'Submit & pay' }).click();
  await expect.poll(() => orderPayloads.length).toBe(2);
  expect(orderPayloads[1]).toMatchObject({ address_source: 'new', shipping_quote_version: 'quote-v2', shipping_payable_amount: 2600, address: { region_id: 13, commune_id: 13101, street: 'Guest Street', street_number: '123' } });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('plexoria:guest-address:v1') || 'null')?.version)).toBe(1);
});

test('changing Región clears an incompatible Comuna', async ({ page, context }) => {
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (await mockCartContractRoute(route, [cartItem])) return;
    if (path === '/api/v1/locations/regions') return route.fulfill({ json: { data: [{ id: 13, name: 'Metropolitana' }, { id: 5, name: 'Valparaíso' }] } });
    if (path === '/api/v1/locations/regions/13/communes') return route.fulfill({ json: { data: [{ id: 13101, region_id: 13, name: 'Santiago' }] } });
    if (path === '/api/v1/locations/regions/5/communes') return route.fulfill({ json: { data: [{ id: 5101, region_id: 5, name: 'Valparaíso' }] } });
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: false, accounts: [] } } });
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto('/en/checkout');
  await page.getByLabel('Region').click(); await page.locator('.ant-select-item-option[title="Metropolitana"]').click();
  await page.getByLabel('Commune').click(); await page.locator('.ant-select-item-option[title="Santiago"]').click();
  await page.getByLabel('Region').click(); await page.locator('.ant-select-item-option[title="Valparaíso"]').click();
  await expect(page.getByLabel('Commune')).toHaveValue('');
});

test('authenticated buyer checks out with one saved address reference', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', refreshToken: 'refresh-token', isAuthenticated: true }, version: 0 }));
  });
  let orderPayload: Record<string, unknown> | undefined;
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/profile') return route.fulfill({ json: { data: { id: 9, email: 'buyer@example.com', full_name: 'Buyer', phone: '+56911111111', role: 'user' } } });
    if (path === '/api/v1/me/addresses') return route.fulfill({ json: { data: [{ id: 77, user_id: 9, label: 'Home', recipient: 'Buyer', phone: '+56911111111', region_id: 13, commune_id: 13101, street: 'Saved Street', street_number: '77', complement: '', reference: '', is_default: true }] } });
    if (await mockShippingRoute(route)) return;
    if (await mockCartContractRoute(route, [cartItem])) return;
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: false, accounts: [] } } });
    if (path === '/api/v1/orders' && request.method() === 'POST') {
      orderPayload = request.postDataJSON();
      return route.fulfill({ status: 201, json: { data: { id: 92, order_number: 'ORD-92', total_amount: 20000, shipping_payable_amount: 0 } } });
    }
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/en/checkout');
  await expect(page.getByText('Home · Saved Street 77', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Street')).toHaveValue('Saved Street');
  await expect(page.getByLabel('Street')).toBeDisabled();
  await acceptCheckoutPolicies(page);
  await page.getByRole('button', { name: 'Submit & pay' }).click();
  await expect.poll(() => orderPayload).toBeTruthy();
  expect(orderPayload).toMatchObject({ address_source: 'existing', address_id: 77, shipping_quote_version: testShippingQuote.quote_version });
  expect(orderPayload).not.toHaveProperty('address');
});

test('buyer submits evidence for a remote shipping adjustment on mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let began = false; let submitted = false;
  await page.addInitScript(() => sessionStorage.setItem('shipping-adjustment-email:5', 'buyer@example.com'));
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/v1/shipping-adjustments/5' && request.method() === 'GET') return route.fulfill({ json: { data: { adjustment: { id: 5, order_id: 91, status: 'awaiting_customer_payment', difference_amount: 3500, reason: 'Remote route' }, order_number: 'ORD-91' } } });
    if (path === '/api/v1/store-config/transfer-payment') return route.fulfill({ json: { data: { configured: true, accounts: [{ id: 1, bank_name: 'Banco', account_name: 'PLEXORIA', rut: '', account_type: 'Cuenta', account_number: '123', email: '', sort_order: 0, is_active: true }] } } });
    if (path === '/api/v1/shipping-adjustments/5/declarations') { began = true; return route.fulfill({ status: 201, json: { data: { id: 44, order_id: 91, shipping_adjustment_id: 5, status: 'draft', entries: [] } } }); }
    if (path === '/api/v1/transfer-declarations/44/proofs') return route.fulfill({ status: 201, json: { data: { id: 55, scan_status: 'pending_scan' } } });
    if (path === '/api/v1/transfer-declarations/44/submit') { submitted = true; return route.fulfill({ json: { data: { id: 44, status: 'submitted' } } }); }
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto('/en/shipping-adjustments/5');
  await page.getByRole('button', { name: 'I have transferred' }).click();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'remote.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') });
  await page.getByRole('button', { name: 'Submit proof' }).click();
  await expect(page.getByText('Proof uploaded', { exact: true })).toBeVisible();
  expect(began).toBe(true); expect(submitted).toBe(true);
});
