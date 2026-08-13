'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import type { Announcement, Banner, Category, Product } from '@/types';
import apiClient from '@/lib/api';
import { trackStorefrontEvent } from '@/lib/legal/consent';
import AnnouncementBar from '@/components/home/AnnouncementBar';
import BannerCarousel from '@/components/home/BannerCarousel';
import ProductCard from '@/components/product/ProductCard';
import {
  BrandIntro,
  CategoryRail,
  HomeHero,
  SectionHeading,
  ShoppingHelp,
  TrustStrip,
} from '@/components/home/StorefrontSections';

export interface HomeClientProps {
  banners: Banner[];
  announcements: Announcement[];
  categories: Category[];
  products: Product[];
  clientFetch?: boolean;
}

export default function HomeClient({ banners: initialBanners, announcements: initialAnnouncements, categories: initialCategories, products: initialProducts, clientFetch = false }: HomeClientProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [banners, setBanners] = useState(initialBanners);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [productsLoading, setProductsLoading] = useState(clientFetch);

	useEffect(() => {
		trackStorefrontEvent({ event_type: 'homepage_view' });
	}, []);

  useEffect(() => {
    if (!clientFetch) return;
    let active = true;
    void apiClient.get<{ data: { banners: Banner[] } }>('/banners').then((response) => { if (active) setBanners(response.data.data?.banners || []); }).catch(() => undefined);
    void apiClient.get<{ data: { announcements: Announcement[] } }>('/announcements').then((response) => { if (active) setAnnouncements(response.data.data?.announcements || []); }).catch(() => undefined);
    void apiClient.get<{ data: { categories: Category[] } }>('/categories').then((response) => { if (active) setCategories(response.data.data?.categories || []); }).catch(() => undefined);
    void apiClient.get<{ data: { products: Product[] } }>('/products', { params: { page: 1, page_size: 10 } })
      .then((response) => { if (active) setProducts(response.data.data?.products || []); })
      .catch(() => undefined)
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [clientFetch]);
  return (
    <main>
      <div className="sf-shell pt-4 sm:pt-6 lg:pt-8">
        {announcements.length > 0 && (
          <section className="mb-4" aria-label={t('home.announcements')}>
            <AnnouncementBar announcements={announcements} />
          </section>
        )}
        <HomeHero product={products[0]} loading={productsLoading} />
        <CategoryRail categories={categories} />

        {banners.length > 0 && (
          <section className="pb-12 sm:pb-16" aria-label={t('home.promotions')}>
            <BannerCarousel banners={banners} />
          </section>
        )}
      </div>

      <section id="offers" className="bg-white py-12 sm:py-16 lg:py-20">
        <div className="sf-shell">
          <SectionHeading
            eyebrow={t('home.goodValue')}
            title={t('home.weeklyTitle')}
            description={t('home.weeklyDescription')}
            action={<Link href={`/${locale}/products`}>{t('common.viewAll')} <ArrowRightOutlined /></Link>}
          />

          {productsLoading ? (
            <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="loading" />
          ) : products.length > 0 ? (
            <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.slice(0, 10).map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl bg-[var(--sf-soft)] px-5 py-10 text-center">
              <p className="text-base font-bold text-[var(--sf-ink)]">{t('emptyState.defaultTitle')}</p>
              <p className="mt-2 text-sm text-[var(--sf-muted)]">{t('emptyState.defaultDesc')}</p>
            </div>
          )}
        </div>
      </section>

      <div className="sf-shell py-12 sm:py-16 lg:py-20">
        <ShoppingHelp />
        <BrandIntro />
      </div>
      <TrustStrip />
    </main>
  );
}
