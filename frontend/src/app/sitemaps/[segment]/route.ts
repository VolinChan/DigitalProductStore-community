import { getSiteConfig } from '@/lib/seo/site-config';
import { loadProductSitemapPage, productSitemapEntries, renderURLSet, sitemapXMLResponse, staticSitemapEntries } from '@/lib/seo/sitemap-data';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ segment: string }> }) {
  if (!getSiteConfig().indexingEnabled) return new Response('Not Found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  const { segment } = await params;
  if (segment === 'static.xml') return sitemapXMLResponse(renderURLSet(staticSitemapEntries()));
  const match = segment.match(/^products-(\d+)\.xml$/);
  if (!match) return new Response('Not Found', { status: 404 });
  const page = Number(match[1]);
  if (!Number.isSafeInteger(page) || page < 1) return new Response('Not Found', { status: 404 });
  const result = await loadProductSitemapPage(page);
  if (!result.products.length) return new Response('Not Found', { status: 404 });
  return sitemapXMLResponse(renderURLSet(productSitemapEntries(result.products)));
}
