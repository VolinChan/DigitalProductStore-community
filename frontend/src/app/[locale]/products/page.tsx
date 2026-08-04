import type { Metadata } from 'next';
import ProductListClient from '@/components/product/ProductListClient';
import { getPublicCategories, getPublicProducts } from '@/lib/server/catalog';
import { canonicalUrl, localeAlternates } from '@/lib/seo/urls';
import { getSiteConfig } from '@/lib/seo/site-config';
import { hasNonIndexableListingParameters, isStorefrontLocale, NOINDEX_ROBOTS } from '@/lib/seo/policy';
import { notFound } from 'next/navigation';

const PAGE_SIZE = 12;
const sortOptions: Record<string, { sortBy: string; sortOrder: string }> = {
  newest: { sortBy: 'created_at', sortOrder: 'desc' },
  price_asc: { sortBy: 'price', sortOrder: 'asc' },
  price_desc: { sortBy: 'price', sortOrder: 'desc' },
  name_asc: { sortBy: 'name', sortOrder: 'asc' },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isStorefrontLocale(locale)) return {};
  const page = positiveNumber(first(query.page)) || 1;
  const filtered = hasNonIndexableListingParameters(query) || Object.keys(query).some((key) => key !== 'page');
  const cleanPath = page > 1 && !filtered ? `products?page=${page}` : 'products';
  const canonical = canonicalUrl(locale, cleanPath);
  const title = locale === 'es-CL' ? 'Productos de tecnología y accesorios' : 'Technology products and accessories';
  const description = locale === 'es-CL'
    ? 'Explora productos de tecnología y accesorios con precios y disponibilidad actualizados.'
    : 'Explore technology products and accessories with current pricing and availability.';
  return {
    title,
    description,
    alternates: { canonical, languages: page === 1 && !filtered ? localeAlternates('products') : undefined },
    openGraph: { type: 'website', url: canonical, title, description, images: [{ url: getSiteConfig().brandShareImage, alt: 'Plexoria' }] },
    robots: !getSiteConfig().indexingEnabled || filtered ? NOINDEX_ROBOTS : { index: true, follow: true },
  };
}

export default async function ProductListPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isStorefrontLocale(locale)) notFound();
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') {
    return <div className="seo-interactive-content"><ProductListClient initialProducts={[]} initialCategories={[]} initialTotal={0} clientFetch /></div>;
  }
  const page = positiveNumber(first(query.page)) || 1;
  const selectedSort = sortOptions[first(query.sort) || 'newest'] || sortOptions.newest;
  const [catalog, categories] = await Promise.all([
    getPublicProducts({
      page,
      pageSize: PAGE_SIZE,
      sortBy: selectedSort.sortBy,
      sortOrder: selectedSort.sortOrder,
      categoryId: positiveNumber(first(query.category_id)),
      minPrice: positiveNumber(first(query.min_price)),
      maxPrice: positiveNumber(first(query.max_price)),
    }),
    getPublicCategories(),
  ]);
  return <>
    <div className="seo-interactive-content"><ProductListClient initialProducts={catalog.products} initialCategories={categories} initialTotal={catalog.total} /></div>
  </>;
}
