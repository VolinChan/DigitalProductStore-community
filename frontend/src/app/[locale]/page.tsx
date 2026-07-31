'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import type { Announcement, Banner, Category, Product } from '@/types';
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

interface ProductListResponse { data: { products: Product[] } }
interface BannersResponse { data: { banners: Banner[] } }
interface AnnouncementsResponse { data: { announcements: Announcement[] } }
interface CategoriesResponse { data: { categories: Category[] } }

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    apiClient.get<BannersResponse>('/banners')
      .then((response) => { if (active) setBanners(response.data.data?.banners || []); })
      .catch(() => undefined);
    apiClient.get<AnnouncementsResponse>('/announcements')
      .then((response) => { if (active) setAnnouncements(response.data.data?.announcements || []); })
      .catch(() => undefined);
    apiClient.get<CategoriesResponse>('/categories')
      .then((response) => { if (active) setCategories(response.data.data?.categories || []); })
      .catch(() => undefined);
    apiClient.get<ProductListResponse>('/products', { params: { page: 1, page_size: 10 } })
      .then((response) => { if (active) setProducts(response.data.data?.products || []); })
      .catch(() => undefined)
      .finally(() => { if (active) setProductsLoading(false); });

    return () => { active = false; };
  }, []);

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
            <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => <ProductSkeleton key={index} />)}
            </div>
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

function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square rounded-[18px] bg-[#edf0ee] sm:rounded-[22px]" />
      <div className="mt-3 h-3 w-1/3 rounded bg-[#edf0ee]" />
      <div className="mt-2 h-4 w-full rounded bg-[#edf0ee]" />
      <div className="mt-2 h-5 w-1/2 rounded bg-[#edf0ee]" />
    </div>
  );
}
