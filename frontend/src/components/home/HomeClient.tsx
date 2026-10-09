'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Announcement, Banner, Category, Product } from '@/types';
import apiClient from '@/lib/api';
import { loadHomeSections, type HomeProductSection } from '@/lib/home';
import { trackStorefrontEvent } from '@/lib/legal/consent';
import AnnouncementBar from '@/components/home/AnnouncementBar';
import HomeProductSections from '@/components/home/HomeProductSections';
import CategoryRail from '@/components/home/CategoryRail';
import {
  HomeHero,
  ShoppingHelp,
  TrustStrip,
} from '@/components/home/StorefrontSections';

export interface HomeClientProps {
  banners: Banner[];
  announcements: Announcement[];
  categories: Category[];
  sections: HomeProductSection[];
  clientFetch?: boolean;
}

export default function HomeClient({ banners: initialBanners, announcements: initialAnnouncements, categories: initialCategories, sections: initialSections, clientFetch = false }: HomeClientProps) {
  const t = useTranslations();
  const [banners, setBanners] = useState(initialBanners);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [categories, setCategories] = useState(initialCategories);
  const [sections, setSections] = useState(initialSections);
  const [productsFailed, setProductsFailed] = useState(false);
  const [productsLoading, setProductsLoading] = useState(clientFetch);

  useEffect(() => {
    trackStorefrontEvent({ event_type: 'homepage_view' });
  }, []);

  useEffect(() => {
    if (!clientFetch) return;
    let active = true;
    void apiClient.get<{ data: { banners: Banner[] } }>('/banners').then((response) => { if (active) setBanners(response.data.data?.banners || []); }).catch(() => undefined);
    void apiClient.get<{ data: { announcements: Announcement[] } }>('/announcements').then((response) => { if (active) setAnnouncements(response.data.data?.announcements || []); }).catch(() => undefined);
    void apiClient.get<{ data: { categories: Category[] } }>('/categories')
      .then(async response => {
        const loadedCategories = response.data.data?.categories || [];
        if (!active) return;
        setCategories(loadedCategories);
        const loadedSections = await loadHomeSections(loadedCategories, async query => {
          const result = await apiClient.get<{ data: { products: Product[]; total: number } }>('/products', {
            params: { page: query.page, page_size: query.pageSize, category_id: query.categoryId, sort_by: query.sortBy },
          });
          return result.data.data;
        });
        if (active) setSections(loadedSections);
      })
      .catch(() => { if (active) setProductsFailed(true); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [clientFetch]);
  return (
    <main className="bg-[#f0f3f5]">
      <div className="sf-shell pt-2 sm:pt-4 lg:pt-6">
        {announcements.length > 0 && (
          <section className="mb-4" aria-label={t('home.announcements')}>
            <AnnouncementBar announcements={announcements} />
          </section>
        )}
        <h1 className="sr-only lg:hidden">{t('home.pageTitle')}</h1>
        <HomeHero />
        <CategoryRail categories={categories} />
      </div>

      <HomeProductSections sections={sections} banners={banners} loading={productsLoading} failed={productsFailed} />

      <div className="sf-shell py-8 sm:py-10 lg:py-12">
        <ShoppingHelp />
      </div>
      <TrustStrip />
    </main>
  );
}
