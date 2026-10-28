import HomeClient from '@/components/home/HomeClient';
import { getActiveAnnouncements, getActiveBanners, getPublicCategories, getPublicProducts } from '@/lib/server/catalog';
import { notFound } from 'next/navigation';
import { isStorefrontLocale } from '@/lib/seo/policy';
import { loadHomeSections } from '@/lib/home';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isStorefrontLocale(locale)) notFound();
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') {
    return <div className="seo-interactive-content"><HomeClient sections={[]} categories={[]} banners={[]} announcements={[]} clientFetch /></div>;
  }
  const [categories, banners, announcements, recommended] = await Promise.all([
    getPublicCategories(),
    getActiveBanners().catch(() => []),
    getActiveAnnouncements().catch(() => []),
    getPublicProducts({ pageSize: 12, sortBy: 'recommended' }).catch(() => ({ products: [] })),
  ]);
  const sections = await loadHomeSections(categories, getPublicProducts);
  return <>
    <div className="seo-interactive-content"><HomeClient sections={sections} recommendedProducts={recommended.products} categories={categories} banners={banners} announcements={announcements} /></div>
  </>;
}
