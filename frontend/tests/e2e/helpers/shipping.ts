import type { Page, Route } from '@playwright/test';

export const testShippingQuote = { formula_version: 'clp-shipping-v1', quote_version: 'quote-e2e-v1', region_id: 13, commune_id: 13101, shipping_rate_components: [{ template_id: 1, template_name: 'Default', quantity_mode: 'per_order', rule_id: 1, rule_scope: 'commune', product_ids: [1], sku_ids: [31], quantity_factor: 1, unit_base_amount: 0, raw_base_amount: 0, remote_surcharge: 0 }], raw_base_amount: 0, rounded_base_amount: 0, rounding_unit: 100, subsidy_amount: 0, remote_surcharge: 0, payable_shipping: 0, remote_assessment_required: false };

export async function mockShippingRoute(route: Route, quote = testShippingQuote) {
  const request = route.request(); const path = new URL(request.url()).pathname;
  if (path === '/api/v1/locations/regions') { await route.fulfill({ json: { data: [{ id: 13, location_code: 'RM', name: 'Metropolitana', sort_order: 1, is_active: true }] } }); return true; }
  if (path === '/api/v1/locations/regions/13/communes') { await route.fulfill({ json: { data: [{ id: 13101, region_id: 13, location_code: '13101', name: 'Santiago', sort_order: 1, is_active: true }] } }); return true; }
  if (path === '/api/v1/shipping/quote') { await route.fulfill({ json: { data: quote } }); return true; }
  return false;
}

export async function mockCartContractRoute(route: Route, items: Array<Record<string, unknown>>) {
  const request = route.request(); const path = new URL(request.url()).pathname;
  const cart = { id: 1, revision: 1, requested_locale: 'en', resolved_locale: 'en', currency: 'CLP', items, issues: [], subtotal: items.reduce((sum, item) => sum + Number(item.subtotal || item.line_total || 0), 0), total_items: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) };
  if (path === '/api/v1/cart/items' || path === '/api/v1/cart') { await route.fulfill({ json: { data: cart } }); return true; }
  if (path === '/api/v1/checkout/validate') { await route.fulfill({ json: { data: { checkout_validation_id: '11111111-1111-4111-8111-111111111111', digest: 'e2e', expires_at: new Date(Date.now() + 600000).toISOString(), cart_revision: 1, valid: true, summary: cart } } }); return true; }
  return false;
}

export async function fillStructuredShipping(page: Page, street: string) {
  await page.getByLabel('Region').click(); await page.locator('.ant-select-item-option[title="Metropolitana"]').click();
  await page.getByLabel('Commune').click(); await page.locator('.ant-select-item-option[title="Santiago"]').click();
  await page.getByLabel('Street').fill(street); await page.getByLabel('Number').fill('123');
}

export async function acceptCheckoutPolicies(page: Page) {
  await page.getByRole('checkbox', { name: /I accept the terms and conditions/i }).check();
}

export async function seedNecessaryCookieConsent(page: Page) {
  await page.addInitScript(() => localStorage.setItem('plexoria-cookie-consent:v1', JSON.stringify({
    policy_version: '0.1-draft', locale: 'en', recorded_at: new Date().toISOString(),
    necessary: true, analytics: false, marketing: false, personalization: false,
  })));
}
