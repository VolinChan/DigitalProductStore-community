'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import type { Banner } from '@/types';
import { HOME_COMPACT_PRODUCTS_PER_SECTION, HOME_PRODUCTS_PER_SECTION, type HomeProductSection } from '@/lib/home';
import ProductCard from '@/components/product/ProductCard';
import { CategoryIcon } from '@/components/category/CategoryIcon';
import BannerCarousel from './BannerCarousel';

export default function HomeProductSections({ sections, banners, loading, failed }: {
  sections: HomeProductSection[];
  banners: Banner[];
  loading: boolean;
  failed: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const bannerAfter = Math.min(1, sections.length - 1);
  const promotion = banners.length > 0 ? (
    <section className="overflow-hidden rounded-[22px] sm:rounded-[28px]" aria-label={t('home.promotions')}>
      <BannerCarousel banners={banners} />
    </section>
  ) : null;

  return (
    <section id="offers" className="bg-[#f0f3f5] py-5 sm:py-8 lg:py-10" aria-label={t('home.productsTitle')}>
      <div className="sf-shell space-y-5 sm:space-y-7">
        {loading ? (
          <div role="status" aria-label={t('common.loading')} className="rounded-[22px] bg-white p-4 sm:p-7">
            <span className="sr-only">{t('common.loading')}</span>
            <div className="h-6 w-40 animate-pulse rounded bg-[#e8eef2] motion-reduce:animate-none" />
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: HOME_PRODUCTS_PER_SECTION }, (_, index) => <div key={index} className={`aspect-square animate-pulse rounded-2xl bg-[#f0f3f5] motion-reduce:animate-none ${index >= HOME_COMPACT_PRODUCTS_PER_SECTION ? 'hidden xl:block' : ''}`} />)}
            </div>
          </div>
        ) : sections.length > 0 ? sections.map((section, index) => {
          return (
            <Fragment key={section.category.id}>
              <section aria-labelledby={`home-category-${section.category.id}`} className="overflow-hidden rounded-[22px] bg-white shadow-[0_2px_12px_rgba(21,48,66,0.025)] sm:rounded-[28px]">
                <div className="p-4 sm:p-7 lg:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryIcon imageUrl={section.category.image_asset?.url} iconKey={section.category.icon_key} label={section.category.name} className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eaf3f7] text-xl text-[var(--sf-accent)] sm:flex" />
                      <h2 id={`home-category-${section.category.id}`} className="m-0 text-lg font-extrabold leading-snug tracking-tight text-[var(--sf-brand)] sm:text-2xl">{section.category.name}</h2>
                    </div>
                    <Link href={`/${locale}/products?category_id=${section.category.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-bold text-[var(--sf-accent)] sm:text-sm">
                      {t('common.viewAll')} <ArrowRightOutlined />
                    </Link>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-7 xl:grid-cols-5 xl:gap-x-6">
                    {section.products.map((product, productIndex) => (
                      <div key={product.id} className={`min-w-0 ${productIndex >= HOME_COMPACT_PRODUCTS_PER_SECTION ? 'hidden xl:block' : ''}`}>
                        <ProductCard product={product} showRecommendation />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              {index === bannerAfter && promotion}
            </Fragment>
          );
        }) : (
          <div className="rounded-[22px] bg-white px-5 py-10 text-center">
            <p className="text-base font-bold text-[var(--sf-ink)]">{t(failed ? 'home.productsLoadError' : 'emptyState.defaultTitle')}</p>
            <Link href={`/${locale}/products`} className="sf-button-primary mt-5">{t('home.viewProducts')} <ArrowRightOutlined /></Link>
          </div>
        )}
        {!loading && sections.length === 0 && promotion}
      </div>
    </section>
  );
}
