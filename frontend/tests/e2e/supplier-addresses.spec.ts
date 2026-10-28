import { expect, test } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

test('supplier addresses are consistent and readable on mobile and desktop', async ({ page }, testInfo) => {
  await seedNecessaryCookieConsent(page);
  await page.route('http://localhost:8080/api/v1/**', (route) => route.fulfill({ json: { data: {} } }));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/es-CL/legal/supplier');
    const main = page.locator('#main-content');
    const legal = main.locator('dl > div').filter({ has: page.getByText('Domicilio legal:', { exact: true }) });
    const warehouse = main.locator('dl > div').filter({ has: page.getByText('Sucursal y bodega:', { exact: true }) });
    await expect(legal.locator('dd')).toHaveText('Santiago, Chile');
    await expect(warehouse.locator('dd')).toHaveText('Av. Marathón 2499, Bodega 041, Macul, Región Metropolitana, Chile');
    await main.locator('dl').screenshot({ path: testInfo.outputPath(`supplier-${width}.png`) });
    await expect(main).not.toContainText('Alameda 2963');
    await expect(main).not.toContainText('MTF041');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/es-CL/legal');
    const disclosure = main.getByRole('region', { name: 'Identificación del proveedor' });
    await expect(disclosure).toContainText('Sucursal y bodega: Av. Marathón 2499, Bodega 041, Macul, Región Metropolitana, Chile.');
    await expect(disclosure).not.toContainText('Domicilio legal');
    await expect(disclosure.getByRole('link', { name: 'Av. Marathón 2499' })).toHaveAttribute('href', 'https://www.google.com/maps/search/Av.+Marath%C3%B3n+2499');
    await expect(disclosure.getByRole('link', { name: '+56 9 9509 6835' })).toHaveAttribute('href', 'tel:+56995096835');
    await expect(disclosure).toContainText('Lunes a viernes: 10:00–17:30 · Sábados: 10:30–15:30.');
    await expect(disclosure).toContainText('Atención presencial, retiros y devoluciones previa coordinación.');
    await expect(disclosure.getByRole('link', { name: 'Ver información completa' })).toHaveAttribute('href', '/es-CL/legal/supplier');
    await disclosure.screenshot({ path: testInfo.outputPath(`legal-overview-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/es-CL/about');
    await expect(main).toContainText('Sucursal y bodega:');
    await expect(main).toContainText('Bodega 041');
    await expect(main).not.toContainText('Dirección de operación y bodega');
    await page.goto('/es-CL/contact');
    await expect(main).toContainText('Bodega 041');
    await expect(main).not.toContainText('MTF041');
    await expect(main.locator('a[href^="tel:"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
