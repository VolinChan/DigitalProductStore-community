import HomeClient from '@/components/home/HomeClient';
import { getActiveAnnouncements, getActiveBanners, getPublicCategories, getPublicProducts } from '@/lib/server/catalog';
import { notFound } from 'next/navigation';
import { isStorefrontLocale } from '@/lib/seo/policy';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isStorefrontLocale(locale)) notFound();
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') {
    return <div className="seo-interactive-content"><HomeClient products={[]} categories={[]} banners={[]} announcements={[]} clientFetch /></div>;
  }
  const [catalog, categories, banners, announcements] = await Promise.all([
    getPublicProducts({ page: 1, pageSize: 10 }),
    getPublicCategories(),
    getActiveBanners().catch(() => []),
    getActiveAnnouncements().catch(() => []),
  ]);
  return <>
    <div className="seo-interactive-content"><HomeClient products={catalog.products} categories={categories} banners={banners} announcements={announcements} /></div>
  </>;
}
