import 'server-only';

import { getSEOIndex, type SEOIndexProduct } from '@/lib/server/catalog';
import { absoluteSiteUrl } from './site-config';
import { localeAlternates, productCanonicalUrl } from './urls';

export const SITEMAP_PROTOCOL_LIMIT = 50_000;
export const SITEMAP_PRODUCT_PAGE_SIZE = 1_000;
const STATIC_UPDATED_AT = '2026-08-03T00:00:00.000Z';
const staticRoutes = ['', 'products', 'categories', 'about', 'contact', 'help/shipping'] as const;

export interface SitemapEntry {
  url: string;
  lastModified: string;
  alternates?: Record<string, string>;
}

export function staticSitemapEntries(): SitemapEntry[] {
  return staticRoutes.flatMap((pathname) => (['es-CL', 'en'] as const).map((locale) => ({
    url: absoluteSiteUrl(`/${locale}${pathname ? `/${pathname}` : ''}`),
    lastModified: STATIC_UPDATED_AT,
    alternates: localeAlternates(pathname),
  })));
}

export function productSitemapEntries(products: SEOIndexProduct[]): SitemapEntry[] {
  return products.flatMap((product) => product.available_locales
    .filter((locale): locale is 'es-CL' | 'en' => locale === 'es-CL' || locale === 'en')
    .map((locale) => ({
      url: productCanonicalUrl(locale, product.slug),
      lastModified: new Date(product.updated_at).toISOString(),
    })));
}

export async function loadProductSitemapPage(page: number) {
  return getSEOIndex(page, SITEMAP_PRODUCT_PAGE_SIZE);
}

export async function loadAllProductSitemapEntries(firstPage?: Awaited<ReturnType<typeof getSEOIndex>>): Promise<SitemapEntry[]> {
  const first = firstPage || await loadProductSitemapPage(1);
  const products = [...first.products];
  for (let page = 2; products.length < first.total; page += 1) {
    const result = await loadProductSitemapPage(page);
    if (!result.products.length) break;
    products.push(...result.products);
  }
  return productSitemapEntries(products);
}

function escapeXML(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function renderURLSet(entries: SitemapEntry[]): string {
  const unique = [...new Map(entries.map((entry) => [entry.url, entry])).values()];
  if (unique.length > SITEMAP_PROTOCOL_LIMIT) throw new Error(`Sitemap chunk exceeds ${SITEMAP_PROTOCOL_LIMIT} URLs`);
  const urls = unique.map((entry) => {
    const alternates = Object.entries(entry.alternates || {}).map(([locale, href]) => `<xhtml:link rel="alternate" hreflang="${escapeXML(locale)}" href="${escapeXML(href)}"/>`).join('');
    return `<url><loc>${escapeXML(entry.url)}</loc><lastmod>${escapeXML(entry.lastModified)}</lastmod>${alternates}</url>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
}

export function renderSitemapIndex(locations: string[]): string {
  const items = locations.map((location) => `<sitemap><loc>${escapeXML(location)}</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

export function sitemapXMLResponse(xml: string): Response {
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=60' } });
}
