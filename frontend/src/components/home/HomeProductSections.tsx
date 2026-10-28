'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import type { Banner } from '@/types';
import { HOME_COMPACT_PRODUCTS_PER_SECTION, HOME_MIN_PRODUCTS_PER_SECTION, HOME_PRODUCTS_PER_SECTION, HOME_SECTION_LIMIT, type HomeProductSection } from '@/lib/home';
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
  const displaySections = sections.filter(section => section.products.length >= HOME_MIN_PRODUCTS_PER_SECTION).slice(0, HOME_SECTION_LIMIT);
  const seen = new Set<number>();
  const discoveries = sections.filter(section => section.products.length < HOME_MIN_PRODUCTS_PER_SECTION)
    .flatMap(section => section.products.map(product => ({ product, category: section.category })))
    .filter(({ product }) => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    }).slice(0, HOME_PRODUCTS_PER_SECTION);
  const showDiscoveries = discoveries.length >= HOME_MIN_PRODUCTS_PER_SECTION;
  const bannerAfter = Math.min(1, displaySections.length - 1);
  const promotion = banners.length > 0 ? (
    <section className="overflow-hidden rounded-[22px] sm:rounded-[28px] lg:col-span-2" aria-label={t('home.promotions')}>
      <BannerCarousel banners={banners} />
    </section>
  ) : null;

  return (
    <section id="offers" className="bg-[var(--sf-catalog-bg)] py-5 sm:py-8 lg:py-10" aria-label={t('home.productsTitle')}>
      <div className="sf-shell grid grid-cols-1 items-start gap-5 sm:gap-7 lg:grid-cols-2">
        {loading ? (
          <div role="status" aria-label={t('common.loading')} className="rounded-[22px] bg-white p-4 sm:p-7 lg:col-span-2">
            <span className="sr-only">{t('common.loading')}</span>
            <div className="h-6 w-40 animate-pulse rounded bg-[#e8eef2] motion-reduce:animate-none" />
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: HOME_PRODUCTS_PER_SECTION }, (_, index) => <div key={index} className={`aspect-square animate-pulse rounded-2xl bg-[#f0f3f5] motion-reduce:animate-none ${index >= HOME_COMPACT_PRODUCTS_PER_SECTION ? 'hidden xl:block' : ''}`} />)}
            </div>
          </div>
        ) : sections.length > 0 ? displaySections.map((section, index) => {
          const columns = section.products.length === 3 ? 'sm:grid-cols-3' : section.products.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-4 xl:grid-cols-5';
          return (
            <Fragment key={section.category.id}>
              <section aria-labelledby={`home-category-${section.category.id}`} className="min-w-0 overflow-hidden rounded-[22px] bg-white shadow-[0_2px_12px_rgba(21,48,66,0.025)] sm:rounded-[28px] lg:col-span-2">
                <div className="p-4 sm:p-7 lg:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryIcon imageUrl={section.category.image_asset?.url} iconKey={section.category.icon_key} label={section.category.name} className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eaf3f7] text-xl text-[var(--sf-accent)] sm:flex" />
                      <h2 id={`home-category-${section.category.id}`} className="m-0 border-l-[3px] border-[var(--sf-brand)] pl-3 text-xl font-extrabold leading-snug tracking-tight text-[var(--sf-brand)] sm:text-2xl">{section.category.name}</h2>
                    </div>
                    <Link href={`/${locale}/products?category_id=${section.category.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-bold text-[var(--sf-accent)] sm:text-sm">
                      {t('common.viewAll')} <ArrowRightOutlined />
                    </Link>
                  </div>
                  <div className={`mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-7 xl:gap-x-8 ${columns}`}>
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
          <div className="rounded-[22px] bg-white px-5 py-10 text-center lg:col-span-2">
            <p className="text-base font-bold text-[var(--sf-ink)]">{t(failed ? 'home.productsLoadError' : 'emptyState.defaultTitle')}</p>
            <Link href={`/${locale}/products`} className="sf-button-primary mt-5">{t('home.viewProducts')} <ArrowRightOutlined /></Link>
          </div>
        )}
        {!loading && showDiscoveries && (
          <section aria-labelledby="home-discoveries" className="min-w-0 rounded-[22px] bg-white p-4 shadow-[0_2px_12px_rgba(21,48,66,0.025)] sm:rounded-[28px] sm:p-7 lg:col-span-2 lg:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 id="home-discoveries" className="text-xl font-extrabold text-[var(--sf-brand)] sm:text-2xl">{t('home.moreDiscoveries')}</h2>
              <Link href={`/${locale}/products`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-bold text-[var(--sf-accent)] sm:text-sm">{t('common.viewAll')} <ArrowRightOutlined /></Link>
            </div>
            <div className={`mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-7 xl:gap-x-8 ${discoveries.length === 3 ? 'sm:grid-cols-3' : discoveries.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-4 xl:grid-cols-5'}`}>
              {discoveries.map(({ product, category }, index) => (
                <div key={product.id} className={`min-w-0 ${index >= HOME_COMPACT_PRODUCTS_PER_SECTION ? 'hidden xl:block' : ''}`}>
                  <Link href={`/${locale}/products?category_id=${category.id}`} className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-[var(--sf-accent)]">{category.name} <ArrowRightOutlined className="shrink-0" /></Link>
                  <ProductCard product={product} showRecommendation />
                </div>
              ))}
            </div>
          </section>
        )}
        {!loading && sections.length > 0 && displaySections.length === 0 && !showDiscoveries && <div className="text-center lg:col-span-2"><Link href={`/${locale}/products`} className="sf-button-primary">{t('home.viewProducts')} <ArrowRightOutlined /></Link></div>}
        {!loading && displaySections.length === 0 && promotion}
      </div>
    </section>
  );
}
