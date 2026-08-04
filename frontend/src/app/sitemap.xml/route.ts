import { getSiteConfig, absoluteSiteUrl } from '@/lib/seo/site-config';
import {
  loadAllProductSitemapEntries,
  loadProductSitemapPage,
  renderSitemapIndex,
  renderURLSet,
  sitemapXMLResponse,
  staticSitemapEntries,
  SITEMAP_PRODUCT_PAGE_SIZE,
  SITEMAP_PROTOCOL_LIMIT,
} from '@/lib/seo/sitemap-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!getSiteConfig().indexingEnabled) return new Response('Not Found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  const first = await loadProductSitemapPage(1);
  const worstCaseEntries = staticSitemapEntries().length + first.total * 2;
  if (worstCaseEntries <= SITEMAP_PROTOCOL_LIMIT) {
    const products = await loadAllProductSitemapEntries(first);
    return sitemapXMLResponse(renderURLSet([...staticSitemapEntries(), ...products]));
  }
  const pages = Math.ceil(first.total / SITEMAP_PRODUCT_PAGE_SIZE);
  const locations = [absoluteSiteUrl('/sitemaps/static.xml')];
  for (let page = 1; page <= pages; page += 1) locations.push(absoluteSiteUrl(`/sitemaps/products-${page}.xml`));
  return sitemapXMLResponse(renderSitemapIndex(locations));
}
