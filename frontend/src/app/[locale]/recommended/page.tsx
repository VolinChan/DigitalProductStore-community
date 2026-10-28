import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import ProductListClient from '@/components/product/ProductListClient';
import { getPublicCategories, getPublicProducts } from '@/lib/server/catalog';
import { canonicalUrl, localeAlternates } from '@/lib/seo/urls';
import { getSiteConfig } from '@/lib/seo/site-config';
import { INDEX_ROBOTS, isStorefrontLocale, NOINDEX_ROBOTS } from '@/lib/seo/policy';
import { buildCollectionJsonLd, serializeJsonLd } from '@/lib/seo/json-ld';

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const sortOptions: Record<string, { sortBy: string; sortOrder: string }> = {
  recommended: { sortBy: 'recommended', sortOrder: 'desc' },
  newest: { sortBy: 'created_at', sortOrder: 'desc' },
  price_asc: { sortBy: 'price', sortOrder: 'asc' },
  price_desc: { sortBy: 'price', sortOrder: 'desc' },
  name_asc: { sortBy: 'name', sortOrder: 'asc' },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numeric(value: string | string[] | undefined, minimum: number) {
  const raw = first(value);
  if (!raw?.trim()) return undefined;
  const number = Number(raw);
  return Number.isFinite(number) && number >= minimum ? number : undefined;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isStorefrontLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'products' });
  const page = Math.floor(numeric(query.page, 1) || 1);
  const filtered = Object.keys(query).some(key => key !== 'page');
  const canonical = canonicalUrl(locale, !filtered && page > 1 ? `recommended?page=${page}` : 'recommended');
  return {
    title: t('recommendedTitle'),
    description: t('recommendedDescription'),
    alternates: { canonical, languages: !filtered && page === 1 ? localeAlternates('recommended') : undefined },
    openGraph: { type: 'website', url: canonical, title: t('recommendedTitle'), description: t('recommendedDescription'), images: [{ url: getSiteConfig().brandShareImage, alt: getSiteConfig().brandName }] },
    robots: !getSiteConfig().indexingEnabled || filtered ? NOINDEX_ROBOTS : INDEX_ROBOTS,
  };
}

export default async function RecommendedPage({ params, searchParams }: PageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isStorefrontLocale(locale)) notFound();
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') {
    return <div className="seo-interactive-content"><ProductListClient initialProducts={[]} initialCategories={[]} initialTotal={0} clientFetch recommendedOnly /></div>;
  }
  const sort = sortOptions[first(query.sort) || 'recommended'] || sortOptions.recommended;
  const [catalog, categories] = await Promise.all([
    getPublicProducts({
      page: Math.floor(numeric(query.page, 1) || 1), pageSize: 12, ...sort, isRecommended: true,
      categoryId: numeric(query.category_id, 1), minPrice: numeric(query.min_price, 0), maxPrice: numeric(query.max_price, 0),
    }),
    getPublicCategories(),
  ]);
  const t = await getTranslations({ locale, namespace: 'products' });
  const page = Math.floor(numeric(query.page, 1) || 1);
  const jsonLd = buildCollectionJsonLd({ locale, path: page > 1 ? `recommended?page=${page}` : 'recommended', name: t('recommendedTitle'), description: t('recommendedDescription'), products: catalog.products });
  return <>
    {!Object.keys(query).some(key => key !== 'page') && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
    <div className="seo-interactive-content"><ProductListClient initialProducts={catalog.products} initialCategories={categories} initialTotal={catalog.total} recommendedOnly /></div>
  </>;
}
