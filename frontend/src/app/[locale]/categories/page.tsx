import type { Metadata } from 'next';
import CategoryIndexClient from '@/components/category/CategoryIndexClient';
import { getPublicCategories } from '@/lib/server/catalog';
import { canonicalUrl, localeAlternates } from '@/lib/seo/urls';
import { getSiteConfig } from '@/lib/seo/site-config';
import { isStorefrontLocale, NOINDEX_ROBOTS } from '@/lib/seo/policy';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isStorefrontLocale(locale)) return {};
  const canonical = canonicalUrl(locale, 'categories');
  const title = locale === 'es-CL' ? 'Categorías de productos' : 'Product categories';
  const description = locale === 'es-CL'
    ? 'Explora tecnología y accesorios por categoría en Plexoria.'
    : 'Browse technology and accessories by category at Plexoria.';
  return {
    title, description,
    alternates: { canonical, languages: localeAlternates('categories') },
    openGraph: { type: 'website', url: canonical, title, description },
    robots: getSiteConfig().indexingEnabled ? { index: true, follow: true } : NOINDEX_ROBOTS,
  };
}

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isStorefrontLocale(locale)) notFound();
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') {
    return <div className="seo-interactive-content"><CategoryIndexClient categories={[]} clientFetch /></div>;
  }
  const categories = await getPublicCategories();
  return <>
    <div className="seo-interactive-content"><CategoryIndexClient categories={categories} /></div>
  </>;
}
