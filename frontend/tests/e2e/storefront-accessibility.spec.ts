import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockCartContractRoute, seedNecessaryCookieConsent } from './helpers/shipping';

const product = {
  id: 22, name: 'Accessible USB-C Hub', description: 'Reliable connections for home and office.', specifications: '{}',
  status: 'published', is_active: true, created_at: '2026-07-30T09:00:00Z', updated_at: '2026-07-30T09:00:00Z', images: [],
  skus: [{
    id: 220, product_id: 22, sku_code: 'HUB-220', price: 15990, inventory: 4, is_active: true,
    attributes: [{ id: 1, sku_id: 220, name: 'Color', value: 'Blue' }],
  }],
};

const cartItem = {
  id: 1, cart_item_id: 1, product_id: product.id, product_name: product.name,
  sku_id: product.skus[0].id, sku_code: product.skus[0].sku_code, sku: product.skus[0],
  quantity: 1, unit_price: product.skus[0].price, line_total: product.skus[0].price,
  subtotal: product.skus[0].price, stock_available: product.skus[0].inventory, available: true, issues: [],
};

test.beforeEach(async ({ page }) => {
  await seedNecessaryCookieConsent(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:8080/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/products/22') return route.fulfill({ json: { data: product } });
    if (path === '/api/v1/products') return route.fulfill({ json: { data: { products: [product], total: 1 } } });
    if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [{ id: 7, name: 'Cables', slug: 'cables', is_active: true }] } } });
    if (await mockCartContractRoute(route, [cartItem])) return;
    return route.fulfill({ json: { data: {} } });
  });
});

test('localized document, skip link and product controls expose unambiguous semantics', async ({ page }) => {
  await page.goto('/en/products/22');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#main-content')).toHaveCount(1);

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.getByRole('radio', { name: 'Blue' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('1');
  await expectMinimumTarget(page.getByRole('radio', { name: 'Blue' }));
  await expectMinimumTarget(page.getByRole('button', { name: 'Add to cart' }).first());
  await expectMinimumTarget(page.getByRole('button', { name: 'Buy now' }).first());
});

test('mobile menu traps keyboard focus, closes with Escape and restores the trigger', async ({ page }) => {
  await page.goto('/en');
  const trigger = page.getByRole('button', { name: 'Menu' });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'All products' })).toHaveCSS('color', 'rgb(28, 39, 51)');
  await assertFocusRemainsInDialog(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('filter drawer closes with Escape and restores the trigger', async ({ page }) => {
  await page.goto('/en/products');
  const trigger = page.getByRole('button', { name: 'Filters' });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Apply filters' })).toHaveCSS('background-color', 'rgb(23, 63, 103)');
  await assertFocusRemainsInDialog(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('mini cart closes with Escape and restores the purchase trigger', async ({ page }) => {
  await page.goto('/en/products/22');
  await page.getByRole('radio', { name: 'Blue' }).click();
  const trigger = page.getByRole('button', { name: 'Add to cart' }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'View cart' })).toHaveCSS('background-color', 'rgb(23, 63, 103)');
  await assertFocusRemainsInDialog(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('reduced motion preference removes non-essential storefront motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/products/22');
  const motion = await page.locator('.storefront').evaluate(root => {
    const element = root.querySelector<HTMLElement>('*');
    if (!element) return null;
    const style = getComputedStyle(element);
    return { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  expect(motion).not.toBeNull();
  expect(Number.parseFloat(motion!.animationDuration)).toBeLessThanOrEqual(0.00001);
  expect(Number.parseFloat(motion!.transitionDuration)).toBeLessThanOrEqual(0.00001);
});

test('storefront text tokens meet AA contrast against their intended surfaces', async ({ page }) => {
  await page.goto('/en');
  const colors = await page.locator('.storefront').evaluate(element => {
    const style = getComputedStyle(element);
    return {
      background: style.getPropertyValue('--sf-bg'),
      ink: style.getPropertyValue('--sf-ink'),
      subtle: style.getPropertyValue('--sf-subtle'),
      muted: style.getPropertyValue('--sf-muted'),
      brand: style.getPropertyValue('--sf-brand'),
      accent: style.getPropertyValue('--sf-accent'),
      warm: style.getPropertyValue('--sf-warm'),
    };
  });

  expect(contrastRatio(colors.ink, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(colors.subtle, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(colors.muted, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio('#ffffff', colors.brand)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio('#ffffff', colors.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio('#ffffff', colors.warm)).toBeGreaterThanOrEqual(4.5);
});

test('Spanish form errors are localized and programmatically associated with fields', async ({ page }) => {
  await page.goto('/es-CL/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-CL');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  const email = page.getByRole('textbox', { name: 'Correo electrónico' });
  const password = page.getByLabel('Contraseña');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expectDescribedError(page, email, 'Ingresa tu correo electrónico');
  await expectDescribedError(page, password, 'Ingresa tu contraseña');
});

async function assertFocusRemainsInDialog(page: Page, dialog: Locator) {
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    const focusState = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        inside: Boolean(active?.closest('.ant-drawer')),
        tag: active?.tagName,
        role: active?.getAttribute('role'),
        name: active?.getAttribute('aria-label'),
        className: active?.getAttribute('class'),
      };
    });
    expect(focusState.inside, JSON.stringify(focusState)).toBe(true);
  }
  await expect(dialog).toBeVisible();
}

async function expectMinimumTarget(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
}

async function expectDescribedError(page: Page, field: Locator, message: string) {
  const describedBy = await field.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  await expect(page.locator(describedBy!.split(/\s+/).map(id => `#${id}`).join(','))).toContainText(message);
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const light = Math.max(foregroundLuminance, backgroundLuminance);
  const dark = Math.min(foregroundLuminance, backgroundLuminance);
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(color: string) {
  const hex = color.trim().replace('#', '');
  const channels = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}
