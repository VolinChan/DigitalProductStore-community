import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

const product = {
  id: 22, slug: 'whatsapp-test-hub', name: 'WhatsApp layout test hub', description: 'USB-C hub', specifications: '{}',
  status: 'published', is_active: true, images: [],
  skus: [{ id: 220, product_id: 22, sku_code: 'HUB-220', price: 15990, inventory: 4, attributes: [], is_active: true }],
};

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/products/22') return route.fulfill({ json: { data: product } });
    if (path === '/api/v1/products') return route.fulfill({ json: { data: { products: [product], total: 1 } } });
    if (path === '/api/v1/categories') return route.fulfill({ json: { data: { categories: [] } } });
    return route.fulfill({ json: { data: {} } });
  });
});

for (const locale of ['es-CL', 'en']) {
  test(`product contact includes its name and clean public URL in ${locale} and clears on navigation`, async ({ page }) => {
    await seedNecessaryCookieConsent(page);
    await page.goto(`/${locale}/products/22?utm_source=test&private_query=do-not-share#details`);
    const contact = page.locator('.sf-whatsapp-contact');
    await expect(contact).toHaveAttribute('href', /whatsapp-test-hub/);
    const text = new URL((await contact.getAttribute('href'))!).searchParams.get('text')!;
    expect(text).toContain(product.name);
    expect(text).toContain(`https://www.plexoria.cl/${locale}/products/whatsapp-test-hub`);
    expect(text).toContain(locale === 'en' ? 'I am viewing' : 'estoy viendo el producto');
    expect(text).not.toMatch(/utm_source|private_query|do-not-share|#details|localhost/);
    await page.getByRole('link', { name: locale === 'en' ? 'Categories' : 'Categorías', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/categories$`));
    await expect(contact).not.toHaveAttribute('href', /whatsapp-test-hub/);
  });
}

test('preview product never shares its token or unpublished identity', async ({ page }) => {
  await seedNecessaryCookieConsent(page);
  await page.route('http://localhost:8080/api/v1/admin/products/22/preview**', (route) => route.fulfill({ json: { data: product } }));
  await page.goto('/en/products/22?preview_token=private-preview-token');
  await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
  const text = new URL((await page.locator('.sf-whatsapp-contact').getAttribute('href'))!).searchParams.get('text');
  expect(text).toBe('Hello, I have a question about PLEXORIA.');
});

for (const width of [320, 390, 1440]) {
  test(`quiet WhatsApp contact and footer remain usable at ${width}px`, async ({ page }) => {
    await seedNecessaryCookieConsent(page);
    await page.setViewportSize({ width, height: 900 });
    const externalRequests: string[] = [];
    page.on('request', (request) => { if (/whatsapp|wa\.me/.test(new URL(request.url()).hostname)) externalRequests.push(request.url()); });
    await page.goto('/es-CL/contact');
    const contact = page.getByRole('link', { name: 'Contactar por WhatsApp (abre una nueva pestaña)', exact: true });
    await expect(contact).toBeVisible();
    const url = new URL((await contact.getAttribute('href'))!);
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/56995096835');
    expect(url.searchParams.get('text')).toBe('Hola, tengo una consulta sobre PLEXORIA.');
    await expect(contact).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(contact).toHaveAttribute('target', '_blank');
    await expect(contact).toHaveCSS('animation-name', 'none');
    await expect(contact.locator('.anticon')).toHaveCSS('color', 'rgb(22, 124, 73)');
    await expect(page.locator('header .sf-whatsapp-contact')).toHaveCount(0);
    const footer = page.locator('footer').last();
    await expect(footer).not.toContainText('+56 9 9509 6835');
    await expect(footer.locator('a[href*="wa.me"], a[href^="tel:"]')).toHaveCount(0);
    await expect(footer).toContainText('soporte@plexoria.cl');
    await expect(page.locator('#main-content')).not.toContainText('+56 9 9509 6835');
    await expect(page.locator('#main-content a[href^="tel:"]')).toHaveCount(0);
    const box = await contact.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
    if (width < 640) expect(box!.width).toBeLessThanOrEqual(60);
    await contact.focus();
    await expect(contact).toBeFocused();
    await expect(contact).toHaveCSS('outline-style', 'solid');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(externalRequests).toEqual([]);
    await page.screenshot({ path: `test-results/whatsapp-contact-${width}.png`, fullPage: true });
  });
}

test('WhatsApp contact yields to cookie preferences and mobile drawers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/products');
  const contact = page.locator('.sf-whatsapp-contact');
  await expect(page.getByRole('dialog', { name: 'Your privacy preferences' })).toBeVisible();
  await expect(contact).toBeHidden();
  await page.getByRole('button', { name: 'Reject nonessential' }).click();
  await expect(contact).toBeVisible();
  expect(new URL((await contact.getAttribute('href'))!).searchParams.get('text')).toBe('Hello, I have a question about PLEXORIA.');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(contact).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(contact).toBeVisible();
  await page.getByRole('button', { name: 'Cookie preferences' }).click();
  await expect(contact).toBeHidden();
});

test('mobile purchase actions and focused fields have priority over contact', async ({ page }) => {
  await seedNecessaryCookieConsent(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/products/22');
  const contact = page.locator('.sf-whatsapp-contact');
  await expect(contact).toBeVisible();
  await expect(page.getByTestId('mobile-purchase-bar')).toBeInViewport();
  const button = await contact.boundingBox();
  const bar = await page.getByTestId('mobile-purchase-bar').boundingBox();
  expect(button!.y + button!.height + 12).toBeLessThanOrEqual(bar!.y);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.locator('header input[type="search"]:visible');
  await search.focus();
  await expect(contact).toBeHidden();
  await search.blur();
  await expect(contact).toBeVisible();
  await page.goto('/admin/login');
  await expect(contact).toHaveCount(0);
});
