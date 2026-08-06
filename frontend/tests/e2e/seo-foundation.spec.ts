import { expect, test } from '@playwright/test';

test('initial product HTML is canonical, localized, crawlable, and safely structured', async ({ request }) => {
  const response = await request.get('/es-CL/products/seo-usb-c-hub');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<html lang="es-CL"');
  expect(html).toContain('<h1');
  expect(html).toContain('SEO USB-C Hub');
  expect(html).toContain('<title>SEO USB-C Hub | Plexoria</title>');
  expect(html).toContain('rel="canonical" href="https://www.plexoria.cl/es-CL/products/seo-usb-c-hub"');
  expect(html).toContain('property="og:url" content="https://www.plexoria.cl/es-CL/products/seo-usb-c-hub"');
  expect(html).toContain('application/ld+json');
  expect(html).toContain('ProductGroup');
  expect(html).toContain('SEO-HUB-BLUE');
  expect(html).toContain('15990');
  expect(html).toContain('https://schema.org/InStock');
  expect(html).not.toContain('</script><script>alert(1)</script>');

  const simpleHTML = await (await request.get('/es-CL/products/simple-usb-c-cable')).text();
  expect(simpleHTML).toContain('"@type":"Product"');
  expect(simpleHTML).not.toContain('ProductGroup');
  expect(simpleHTML).toContain('https://schema.org/OutOfStock');
});

test('English fallback is noindex and legacy references redirect permanently', async ({ request }) => {
  const english = await request.get('/en/products/seo-usb-c-hub');
  expect(english.status()).toBe(200);
  const englishHTML = await english.text();
  expect(englishHTML).toContain('<html lang="en"');
  expect(englishHTML).toMatch(/name="robots" content="noindex, nofollow"/);
  expect(englishHTML).not.toContain('hreflang="es-CL"');

  for (const ref of ['22', 'old-seo-hub']) {
    const redirect = await request.get(`/es-CL/products/${ref}`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('/es-CL/products/seo-usb-c-hub');
  }
  const missing = await request.get('/es-CL/products/missing-product');
  expect(missing.status()).toBe(404);
  const missingHTML = await missing.text();
  expect(missingHTML).toContain('No encontramos lo que buscabas');
  expect(missingHTML).toContain('href="/es-CL/products"');
  expect(missingHTML).toContain('href="/es-CL"');
  expect(missingHTML).toMatch(/name="robots" content="noindex/);
  expect(missingHTML).not.toContain('<h1>Product not found</h1>');
});

test('home, listing, and categories expose primary content without browser API hydration', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/es-CL');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('SEO USB-C Hub').first()).toBeVisible();
  await page.goto('/es-CL/products');
  await expect(page.getByRole('heading', { name: /Productos/ })).toBeVisible();
  await expect(page.getByText('SEO USB-C Hub').first()).toBeVisible();
  await page.goto('/es-CL/categories');
  await expect(page.getByRole('heading', { name: /Categorías/ })).toBeVisible();
  await expect(page.getByText('Connectivity').first()).toBeVisible();
  await context.close();
});

test('private and parameter-derived pages cannot inherit indexable metadata', async ({ request }) => {
  for (const path of ['/es-CL/cart', '/es-CL/checkout', '/es-CL/login', '/es-CL/profile', '/es-CL/orders', '/es-CL/products/search?q=hub', '/es-CL/products?category_id=4']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toMatch(/name="robots" content="noindex, nofollow"/);
  }
});

test('robots and sitemap publish only absolute canonical public URLs', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Allow: /');
  expect(robots).toContain('Disallow: /admin/');
  expect(robots).toContain('Sitemap: https://www.plexoria.cl/sitemap.xml');

  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('https://www.plexoria.cl/es-CL/products/seo-usb-c-hub');
  expect(sitemap).toContain('https://www.plexoria.cl/es-CL/products/simple-usb-c-cable');
  expect(sitemap).not.toContain('/en/products/seo-usb-c-hub');
  expect(sitemap).not.toMatch(/cart|checkout|login|orders|products\/22|old-seo-hub/);
  expect(sitemap).toContain('2026-08-02T11:30:00.000Z');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(new Set(locations).size).toBe(locations.length);
  expect(locations.every((location) => location.startsWith('https://www.plexoria.cl/'))).toBe(true);

  for (const location of locations) {
    const path = new URL(location).pathname;
    const pageResponse = await request.get(path);
    expect(pageResponse.status(), path).toBe(200);
    const html = await pageResponse.text();
    expect(html, path).not.toMatch(/name="robots" content="noindex/);
    expect(html, path).toContain(`rel="canonical" href="${location}"`);
  }

  const homeHTML = await (await request.get('/es-CL')).text();
  expect(homeHTML).toContain('"@type":"Organization"');
  expect(homeHTML).toContain('"@type":"WebSite"');

  expect((await request.get('/sitemaps/static.xml')).status()).toBe(200);
  const productChunk = await request.get('/sitemaps/products-1.xml');
  expect(productChunk.status()).toBe(200);
  expect(await productChunk.text()).toContain('/es-CL/products/simple-usb-c-cable');
  expect((await request.get('/sitemaps/products-2.xml')).status()).toBe(404);
});

test('catalog revalidation hook requires its deployment secret', async ({ request }) => {
  const unauthorized = await request.post('/api/revalidate/catalog', { data: { product_id: 22, slug: 'seo-usb-c-hub', event: 'published' } });
  expect(unauthorized.status()).toBe(401);
  const accepted = await request.post('/api/revalidate/catalog', {
    headers: { Authorization: 'Bearer seo-test-revalidation-secret' },
    data: { product_id: 22, slug: 'seo-usb-c-hub', previous_slug: 'old-seo-hub', event: 'slug_changed' },
  });
  expect(accepted.status()).toBe(200);
  expect(await accepted.json()).toMatchObject({ revalidated: true, event: 'slug_changed' });
});
