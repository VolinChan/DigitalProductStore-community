'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ApiOutlined,
  ArrowRightOutlined,
  CustomerServiceOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import ImageFallback from '@/components/ImageFallback';
import { getProductPrimaryImage } from '@/lib/catalog';
import { formatCLP } from '@/lib/utils';
import type { Product } from '@/types';

export function HomeHero({ products, compact = false }: { products: Product[]; compact?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const available = products.filter(product => product.is_active
    && product.is_recommended
    && (!product.status || product.status === 'published')
    && getProductPrimaryImage(product)
    && product.skus?.some(sku => sku.is_active && sku.inventory > 0 && Number.isFinite(Number(sku.price)) && Number(sku.price) > 0));
  const featured = available[0];
  const price = featured ? Math.min(...featured.skus!.filter(sku => sku.is_active && sku.inventory > 0 && Number.isFinite(Number(sku.price)) && Number(sku.price) > 0).map(sku => Number(sku.price))) : null;
  const sectionClass = compact
    ? `mt-4 rounded-[22px] p-4 lg:hidden ${featured ? 'block' : 'hidden'}`
    : 'hidden min-h-[300px] rounded-[28px] px-10 py-7 lg:flex lg:items-center lg:justify-between lg:gap-8';

  return (
    <section data-home-hero className={`relative min-w-0 overflow-hidden bg-[#dff1f5] ${sectionClass}`}>
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-32 hidden h-80 w-80 rounded-full border-[48px] border-white/25 lg:block" />
      <div className="relative hidden max-w-[560px] lg:block">
        <h1 className="text-[40px] font-black leading-tight tracking-tight text-[var(--sf-brand)]">{t('home.heroCompactTitle')}</h1>
        <p className="mt-3 text-base leading-7 text-[#455d6f]">{t('home.heroCompactDescription')}</p>
        <Link href={`/${locale}/products`} className="sf-button-primary mt-6">
          {t('home.viewProducts')} <ArrowRightOutlined />
        </Link>
      </div>
      {featured && price !== null && (
        <Link data-hero-product href={`/${locale}/products/${encodeURIComponent(featured.slug || String(featured.id))}`} className="group relative grid w-full shrink-0 grid-cols-[96px_minmax(0,1fr)] items-center gap-4 rounded-[24px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--sf-accent)] sm:grid-cols-[128px_minmax(0,1fr)] lg:w-[420px] lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-5 lg:bg-white/80 lg:p-5 lg:hover:bg-white xl:w-[520px] xl:grid-cols-[240px_minmax(0,1fr)]">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-white">
            <ImageFallback src={getProductPrimaryImage(featured)!} alt={featured.name} fill priority sizes="(min-width: 1280px) 240px, (min-width: 1024px) 180px, 128px" className="object-contain p-2 transition-transform duration-200 motion-safe:group-hover:scale-105" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--sf-accent)]">{t('home.latestRecommendation')}</p>
            <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-[var(--sf-brand)] lg:mt-2 lg:line-clamp-3 lg:text-base lg:leading-6">{featured.name}</h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 lg:mt-3"><span className="text-xs text-[var(--sf-muted)]">{t('products.from')}</span><span className="text-lg font-black text-[var(--sf-brand)] lg:text-2xl">{formatCLP(price, locale)}</span></div>
            <span className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-[var(--sf-accent)] lg:mt-2 lg:text-sm">{t('home.viewProduct')} <ArrowRightOutlined /></span>
          </div>
        </Link>
      )}
    </section>
  );
}

export function PickupBenefit() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Link href={`/${locale}/help/shipping`} className="mt-3 flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-[#e2eef2] px-4 py-2 text-[var(--sf-brand)] transition-colors hover:bg-[#d8e9ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-accent)] lg:mt-4">
      <ShopOutlined aria-hidden className="shrink-0 text-lg" />
      <span className="text-xs sm:text-sm"><strong className="font-extrabold">{t('home.pickupBenefit')}</strong><span className="ml-2 text-[#455d6f]">{t('home.pickupCoordination')}</span></span>
      <ArrowRightOutlined aria-hidden className="shrink-0 text-xs" />
    </Link>
  );
}

export function ShoppingHelp() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <section data-shopping-help className="overflow-hidden rounded-[26px] bg-[var(--sf-brand)] text-white sm:rounded-[32px] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <div className="px-5 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
        <span className="text-xs font-bold uppercase text-[var(--sf-aqua)]">{t('home.helpEyebrow')}</span>
        <h2 className="mt-3 max-w-[560px] text-[26px] font-black leading-tight sm:text-4xl">{t('home.helpTitle')}</h2>
        <p className="mt-4 max-w-[580px] text-sm leading-6 text-white/72 sm:text-base sm:leading-7">{t('home.helpDescription')}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href={`/${locale}/contact`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--sf-warm)] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5">
            {t('home.askForHelp')} <ArrowRightOutlined />
          </Link>
          <Link href={`/${locale}/about`} className="inline-flex min-h-11 items-center text-sm font-semibold text-white/85 underline decoration-white/35 underline-offset-4 hover:text-white">
            {t('layout.aboutPlexoria')}
          </Link>
        </div>
      </div>
      <div className="relative flex items-center justify-center bg-[#20517c] px-5 py-6 sm:p-8 lg:p-10">
        <div className="w-full min-w-0 max-w-[360px] rounded-[22px] bg-white p-4 text-[var(--sf-ink)] shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dff1f5] text-[#17658a]"><CustomerServiceOutlined className="text-xl" /></span>
            <div><p className="text-xs font-semibold text-[var(--sf-muted)]">PLEXORIA</p><p className="mt-0.5 text-sm font-bold">{t('home.helpQuestion')}</p></div>
          </div>
          <p className="mt-4 rounded-2xl rounded-tr-sm bg-[#eaf4f7] px-4 py-3 text-xs leading-5 text-[#435968]">{t('home.helpAnswer')}</p>
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  const t = useTranslations();
  const items = [
    { icon: <SafetyCertificateOutlined />, title: t('home.trustSecure'), text: t('home.trustSecureDesc') },
    { icon: <ApiOutlined />, title: t('home.trustClear'), text: t('home.trustClearDesc') },
    { icon: <SyncOutlined />, title: t('home.trustEasyReturns'), text: t('home.trustEasyReturnsDesc') },
    { icon: <CustomerServiceOutlined />, title: t('home.trustSupport'), text: t('home.trustSupportDesc') },
  ];
  return (
    <section data-trust-strip className="border-y border-[var(--sf-line)] bg-[#e9f0f3]">
      <div className="sf-shell grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4 lg:gap-x-8 lg:py-12">
        {items.map((item) => (
          <div key={item.title} className="flex min-w-0 flex-col items-center gap-3 text-center lg:border-r lg:border-[var(--sf-line)] lg:pr-8 lg:last:border-r-0 lg:last:pr-0">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[28px] leading-none text-[var(--sf-accent)]">{item.icon}</span>
            <div className="min-w-0"><p className="text-sm font-extrabold text-[#263845] sm:text-base">{item.title}</p><p className="mt-2 max-w-[240px] text-xs leading-5 text-[#455d6f] sm:text-sm">{item.text}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-extrabold tracking-tight text-[var(--sf-ink)] sm:text-2xl">{title}</h2>
      <div className="shrink-0 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:gap-1.5 [&_a]:text-xs [&_a]:font-bold [&_a]:text-[var(--sf-accent)] sm:[&_a]:text-sm">{action}</div>
    </div>
  );
}
