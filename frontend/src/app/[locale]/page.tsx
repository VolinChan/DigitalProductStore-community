'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Spin, Empty, Typography } from 'antd';
import BannerCarousel from '@/components/home/BannerCarousel';
import AnnouncementBar from '@/components/home/AnnouncementBar';
import ProductCard from '@/components/product/ProductCard';
import { PageSkeleton } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import apiClient from '@/lib/api';
import type { Product, Banner, Announcement } from '@/types';
import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/lib/i18n/useCurrentLocale';

const { Title } = Typography;

interface ProductListResponse {
  data: {
    products: Product[];
    total: number;
    page: number;
    page_size: number;
  };
}

interface BannersResponse {
  data: { banners: Banner[] };
}

interface AnnouncementsResponse {
  data: { announcements: Announcement[] };
}

/**
 * Homepage — PLEXORIA storefront entry point.
 * Displays announcement bar, hero banner carousel, category highlights,
 * and featured products grid.
 */
export default function Home() {
  const t = useTranslations();
  const locale = useCurrentLocale();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHomeData() {
      setLoading(true);
      try {
        const [bannersRes, announcementsRes, productsRes] = await Promise.allSettled([
          apiClient.get<BannersResponse>('/banners'),
          apiClient.get<AnnouncementsResponse>('/announcements'),
          apiClient.get<ProductListResponse>('/products', {
            params: { page: 1, page_size: 12 },
          }),
        ]);

        if (bannersRes.status === 'fulfilled') {
          setBanners(bannersRes.value.data.data?.banners || []);
        }
        if (announcementsRes.status === 'fulfilled') {
          setAnnouncements(announcementsRes.value.data.data?.announcements || []);
        }
        if (productsRes.status === 'fulfilled') {
          setProducts(productsRes.value.data.data?.products || []);
        }
      } catch {
        // Errors handled per-request via allSettled
      } finally {
        setLoading(false);
      }
    }

    fetchHomeData();
  }, []);

  if (loading) {
    return (
      <main className="store-container" id="main-content">
        <div className="animate-fade-in-up">
          {/* Hero skeleton */}
          <div className="rounded-xl overflow-hidden mb-8">
            <PageSkeleton />
          </div>
          {/* Products skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="store-container" id="main-content">
      <div className="animate-fade-in-up space-y-8 sm:space-y-10">
        {/* Announcement bar */}
        {announcements.length > 0 && (
          <section aria-label={t('home.tagline')}>
            <AnnouncementBar announcements={announcements} />
          </section>
        )}

        {/* Hero Banner Carousel */}
        {banners.length > 0 ? (
          <section aria-label={t('home.tagline')} className="rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <BannerCarousel banners={banners} />
          </section>
        ) : (
          /* Hero CTA when no banners */
          <section className="rounded-xl bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-8 sm:p-12 text-center border">
            <Title level={2} className="!mb-3 !text-h3 sm:!text-h2 font-bold tracking-tight">
              {t('home.tagline')}
            </Title>
            <p className="text-lg text-foreground/80 !mb-2 font-medium">{t('home.subtitle')}</p>
            <p className="text-muted text-sm sm:text-base max-w-lg mx-auto mb-6">
              {t('home.description')}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={`/${locale}/products`}>
                <button className="store-btn-primary !px-8 !py-3 !text-base">
                  {t('home.viewProducts')}
                </button>
              </Link>
              <Link href={`/${locale}/categories`}>
                <button className="store-btn-secondary !px-8 !py-3 !text-base">
                  {t('home.viewOffers')}
                </button>
              </Link>
            </div>
          </section>
        )}

        {/* Featured Products */}
        <section aria-label={t('home.featuredProducts')}>
          <div className="flex items-center justify-between mb-6">
            <Title level={3} className="!mb-0 store-section-title">
              {t('home.featuredProducts')}
            </Title>
            <Link href={`/${locale}/products`}>
              <span className="text-sm text-accent hover:underline cursor-pointer">{t('common.viewAll')} →</span>
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('home.featuredProducts')}
              description={t('emptyState.defaultDesc')}
            />
          )}
        </section>

        {/* Trust signals */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t">
          {[
            { icon: '🛡️', titleKey: 'home.trustAuthentic', descKey: 'home.trustAuthenticDesc' },
            { icon: '🚚', titleKey: 'home.trustFastShipping', descKey: 'home.trustFastShippingDesc' },
            { icon: '↩️', titleKey: 'home.trustEasyReturns', descKey: 'home.trustEasyReturnsDesc' },
            { icon: '💬', titleKey: 'home.trustSupport', descKey: 'home.trustSupportDesc' },
          ].map((item) => (
            <div key={item.titleKey} className="text-center p-4 rounded-xl bg-card border shadow-sm">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-sm font-semibold text-foreground">{t(item.titleKey as string)}</p>
              <p className="text-xs text-muted mt-0.5">{t(item.descKey as string)}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

/** Single product card skeleton */
function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="aspect-square w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-5 w-1/3 mt-2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}
