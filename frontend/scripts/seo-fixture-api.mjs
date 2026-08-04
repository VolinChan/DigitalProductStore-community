import http from 'node:http';

const port = Number(process.env.SEO_FIXTURE_PORT || 4010);
const product = {
  id: 22,
  name: 'SEO USB-C Hub',
  slug: 'seo-usb-c-hub',
  short_description: 'Reliable connectivity </script><script>alert(1)</script> for everyday devices.',
  description: 'Connect displays, storage, and power through one compact hub.',
  description_html: '<p>Connect displays, storage, and power through one compact hub.</p>',
  brand: 'Plexoria Select',
  condition: 'new',
  specifications: '{}',
  status: 'published',
  is_active: true,
  created_at: '2026-07-30T09:00:00Z',
  updated_at: '2026-08-02T11:30:00Z',
  images: [{ id: 1, product_id: 22, image_url: '/placeholder-product.svg', sort_order: 0, is_primary: true }],
  variant_dimensions: [{ id: 1, name: 'Color', sort_order: 0, values: [] }],
  skus: [
    { id: 220, product_id: 22, sku_code: 'SEO-HUB-BLUE', price: 15990, inventory: 3, is_active: true, attributes: [{ id: 1, sku_id: 220, name: 'Color', value: 'Blue' }] },
    { id: 221, product_id: 22, sku_code: 'SEO-HUB-RED', price: 21990, inventory: 0, is_active: true, attributes: [{ id: 2, sku_id: 221, name: 'Color', value: 'Red' }] },
  ],
};
const simpleProduct = {
  ...product,
  id: 23,
  name: 'Simple USB-C Cable',
  slug: 'simple-usb-c-cable',
  short_description: 'A straightforward USB-C cable.',
  updated_at: '2026-08-01T10:00:00Z',
  variant_dimensions: [],
  images: [],
  skus: [{ id: 230, product_id: 23, sku_code: 'SIMPLE-CABLE', price: 4990, inventory: 0, is_active: true, attributes: [] }],
};
const categories = [{ id: 4, name: 'Connectivity', slug: 'connectivity', sort_order: 0, is_active: true, product_count: 1, updated_at: '2026-08-01T00:00:00Z', icon_key: 'usb' }];

function json(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(status >= 400 ? { success: false, error: { message: data } } : { success: true, data }));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  const path = url.pathname;
  if (path === '/health') return json(response, 200, { status: 'ok' });
  if (path === '/api/v1/products') return json(response, 200, { products: [product, simpleProduct], total: 2, page: Number(url.searchParams.get('page') || 1), page_size: Number(url.searchParams.get('page_size') || 12) });
  if (path === '/api/v1/products/slug/seo-usb-c-hub') return json(response, 200, product);
  if (path === '/api/v1/products/slug/simple-usb-c-cable') return json(response, 200, simpleProduct);
  if (path.startsWith('/api/v1/products/slug/')) return json(response, 404, 'Product not found');
  if (path === '/api/v1/products/resolve/22') return json(response, 200, { product_id: 22, current_slug: product.slug, match: 'legacy_id' });
  if (path === '/api/v1/products/resolve/seo-usb-c-hub') return json(response, 200, { product_id: 22, current_slug: product.slug, match: 'current_slug' });
  if (path === '/api/v1/products/resolve/simple-usb-c-cable') return json(response, 200, { product_id: 23, current_slug: simpleProduct.slug, match: 'current_slug' });
  if (path === '/api/v1/products/resolve/old-seo-hub') return json(response, 200, { product_id: 22, current_slug: product.slug, match: 'historical_slug' });
  if (path.startsWith('/api/v1/products/resolve/')) return json(response, 404, 'Product not found');
  if (path === '/api/v1/catalog/seo-index') {
    const page = Number(url.searchParams.get('page') || 1);
    return json(response, 200, { products: page === 1 ? [product, simpleProduct].map((item) => ({ product_id: item.id, slug: item.slug, updated_at: item.updated_at, available_locales: ['es-CL'] })) : [], total: 2, page, page_size: 1000 });
  }
  if (path === '/api/v1/categories') return json(response, 200, { categories });
  if (path === '/api/v1/banners') return json(response, 200, { banners: [] });
  if (path === '/api/v1/announcements') return json(response, 200, { announcements: [] });
  return json(response, 404, 'Not found');
});

server.listen(port, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
