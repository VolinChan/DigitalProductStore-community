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
  await expect(page.getByRole('heading', { level: 2, name: 'Connectivity' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Todas las categorías' })).toHaveAttribute('href', '/es-CL/categories');
  await page.goto('/es-CL/products');
  await expect(page.getByRole('heading', { name: /Productos/ })).toBeVisible();
  await expect(page.getByText('SEO USB-C Hub').first()).toBeVisible();
  await page.goto('/es-CL/categories');
  await expect(page.getByRole('heading', { name: /Categorías/ })).toBeVisible();
  await expect(page.getByText('Connectivity').first()).toBeVisible();
  await page.goto('/es-CL/recommended');
  await expect(page.getByRole('heading', { level: 1, name: 'Productos recomendados' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SEO USB-C Hub' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simple USB-C Cable' })).toHaveCount(0);
  await context.close();
});

test('private and parameter-derived pages cannot inherit indexable metadata', async ({ request }) => {
  for (const path of ['/es-CL/cart', '/es-CL/checkout', '/es-CL/login', '/es-CL/profile', '/es-CL/orders', '/es-CL/products/search?q=hub', '/es-CL/products?category_id=4', '/es-CL/recommended?category_id=4']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toMatch(/name="robots" content="noindex, nofollow"/);
    if (!path.includes('/products') && !path.includes('/recommended')) {
      expect(await response.text(), path).not.toContain('rel="canonical"');
      expect(await response.text(), path).not.toContain('hreflang=');
    }
  }
  for (const collection of ['products', 'recommended']) {
    const response = await request.get(`/es-CL/${collection}?page=1.5`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(`rel="canonical" href="https://www.plexoria.cl/es-CL/${collection}"`);
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

  const categoryAccepted = await request.post('/api/revalidate/catalog', {
    headers: { Authorization: 'Bearer seo-test-revalidation-secret' },
    data: { category_id: 4, event: 'category_updated' },
  });
  expect(categoryAccepted.status()).toBe(200);
  expect(await categoryAccepted.json()).toMatchObject({ revalidated: true, event: 'category_updated' });
});

test('AI search crawlers receive complete public HTML and connected structured entities without JavaScript', async ({ browser }) => {
  for (const userAgent of ['Googlebot', 'bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot']) {
    const context = await browser.newContext({ javaScriptEnabled: false, userAgent });
    const page = await context.newPage();
    await page.goto('/es-CL/recommended');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'SEO USB-C Hub' })).toBeVisible();
    const collection = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => JSON.parse(script.textContent || '{}')).find(data => data['@type'] === 'CollectionPage'));
    expect(collection.mainEntity.itemListElement).toHaveLength(1);
    expect(collection.mainEntity.itemListElement[0].url).toContain('/es-CL/products/seo-usb-c-hub');
    expect(collection.breadcrumb['@type']).toBe('BreadcrumbList');
    const site = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => JSON.parse(script.textContent || '{}')).find(data => data['@graph']));
    const organization = site['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'Organization');
    expect(organization.legalName).toBe('PLEXORIA SpA');
    expect(organization.sameAs).toHaveLength(2);
    expect(collection.publisher['@id']).toBe(organization['@id']);
    await page.goto('/es-CL/products/seo-usb-c-hub');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const visibleProduct = page.locator('main.seo-server-content');
    await expect(visibleProduct.getByText('Modelo: HUB-7', { exact: true })).toBeVisible();
    await expect(visibleProduct.getByText('USB-C Power Delivery', { exact: true })).toBeVisible();
    await expect(visibleProduct.getByText('100 W', { exact: true })).toBeVisible();
    await expect(visibleProduct.getByText('Connect displays, storage, and power through one compact hub.', { exact: true }).last()).toBeVisible();
    const product = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => JSON.parse(script.textContent || '{}')).find(data => data['@type'] === 'ProductGroup'));
    expect(product.model).toBe('HUB-7');
    expect(product.additionalProperty).toContainEqual({ '@type': 'PropertyValue', name: 'USB-C Power Delivery', value: '100', unitText: 'W' });
    expect(product.hasVariant[0].offers.seller['@id']).toBe(organization['@id']);
    await context.close();
  }
});

test('published help pages retain complete readable text without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const locale of ['es-CL', 'en']) {
    for (const path of ['about', 'contact', 'help/shipping', 'help/returns', 'privacy', 'legal', 'legal/terms', 'legal/returns-withdrawal', 'legal/legal-guarantee', 'legal/cookies', 'legal/supplier']) {
      await page.goto(`/${locale}/${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      if (path === 'help/shipping') {
        await expect(page.getByRole('heading', { name: locale === 'en' ? 'Free warehouse pickup' : 'Retiro gratis en bodega' })).toBeVisible();
        await expect(page.getByText(/Bodega 041/).first()).toBeVisible();
      }
      if (path === 'about' && locale === 'en') {
        await expect(page.getByRole('heading', { name: 'About PLEXORIA', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Visiting our warehouse', exact: true })).toBeVisible();
        await expect(page.locator('#main-content')).not.toContainText('Somos PLEXORIA');
      }
      if (path.startsWith('legal') || path === 'privacy' || path === 'help/returns') {
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.plexoria.cl/${locale}/${path}`);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
        await expect(page).not.toHaveTitle(/^Plexoria \|/);
      }
    }
  }
  await context.close();
});
