'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ApiOutlined,
  ArrowRightOutlined,
  AudioOutlined,
  CheckCircleFilled,
  CustomerServiceOutlined,
  DesktopOutlined,
  HddOutlined,
  SafetyCertificateOutlined,
  MessageOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  UsbOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import ImageFallback from '@/components/ImageFallback';
import { getProductPrimaryImage } from '@/lib/catalog';
import type { Category, Product } from '@/types';

export function HomeHero({ product, loading }: { product?: Product; loading: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const image = product ? getProductPrimaryImage(product) : undefined;

  return (
    <section className="relative overflow-hidden rounded-[26px] bg-[#dff1f5] px-5 pb-6 pt-9 sm:rounded-[32px] sm:px-10 sm:py-12 lg:grid lg:min-h-[500px] lg:grid-cols-[0.93fr_1.07fr] lg:items-center lg:px-16 lg:py-14">
      <div className="relative z-10 max-w-[550px]">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-[#17658a] shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[var(--sf-warm)]" />{t('home.valueBadge')}
        </span>
        <h1 className="mt-5 max-w-[540px] text-[36px] font-black leading-[1.04] text-[var(--sf-brand)] sm:text-5xl lg:text-[58px]">
          {t('home.heroTitle')}<br />{t('home.heroTitleSecond')}
        </h1>
        <p className="mt-4 max-w-[500px] text-[15px] leading-6 text-[#455d6f] sm:text-lg sm:leading-7">{t('home.heroDescription')}</p>
        <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row sm:mt-8">
          <Link href={`/${locale}/products`} className="sf-button-primary">
            {t('home.viewProducts')} <ArrowRightOutlined />
          </Link>
          <a href="#categories" className="sf-button-secondary">{t('home.shopByCategory')}</a>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#4f6877] sm:mt-8">
          <span className="inline-flex items-center gap-1.5"><CheckCircleFilled className="text-[#25806b]" />{t('home.trustSecure')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircleFilled className="text-[#25806b]" />{t('home.trustClear')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircleFilled className="text-[#25806b]" />{t('home.trustSupportShort')}</span>
        </div>
      </div>

      <div className="relative mt-10 min-h-[285px] lg:mt-0 lg:min-h-[410px]">
        <div className="absolute bottom-[3%] left-1/2 h-[34px] w-[76%] -translate-x-1/2 rounded-[100%] bg-[#2c6f87]/15 blur-xl" />
        <div className="absolute left-1/2 top-1/2 aspect-[5/4] w-[76%] max-w-[390px] -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] overflow-hidden rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(24,75,91,0.18)]">
          <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-[#edf2f2]">
            {loading ? (
              <div className="h-full w-full animate-pulse bg-white/40" />
            ) : image && product ? (
              <ImageFallback src={image} alt={product.name} fill priority className="object-contain p-5" sizes="(max-width: 1024px) 70vw, 32vw" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-[#17658a]">
                <ApiOutlined className="text-7xl" />
                <span className="mt-3 text-sm font-bold">{t('home.fallbackVisual')}</span>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-[7%] left-[1%] -rotate-[4deg] rounded-2xl bg-[var(--sf-warm)] px-3.5 py-2.5 text-white shadow-lg shadow-[#f2694b]/20 sm:left-[12%] lg:bottom-[11%] lg:left-[3%]">
          <p className="text-[10px] font-bold uppercase text-white/75">{t('home.buyConfidently')}</p>
          <p className="mt-0.5 text-xs font-black">{t('home.compatibilityClear')}</p>
        </div>
      </div>
    </section>
  );
}

export function CategoryRail({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const icons = [<UsbOutlined key="usb" />, <ThunderboltOutlined key="bolt" />, <DesktopOutlined key="desktop" />, <HddOutlined key="storage" />, <WifiOutlined key="wifi" />, <AudioOutlined key="audio" />];
  const fallback = [t('home.categoryCables'), t('home.categoryChargers'), t('home.categoryPeripherals'), t('home.categoryStorage'), t('home.categoryNetwork'), t('home.categoryAudio')];
  const items = categories.length
    ? categories.slice(0, 6).map((category) => ({ id: category.id, label: category.name, href: `/${locale}/products?category_id=${category.id}` }))
    : fallback.map((label, index) => ({ id: `fallback-${index}`, label, href: `/${locale}/products` }));

  return (
    <section id="categories" className="py-12 sm:py-16 lg:py-20">
      <SectionHeading eyebrow={t('home.findFast')} title={t('home.whatLookingFor')} action={<Link href={`/${locale}/categories`}>{t('common.viewAll')} <ArrowRightOutlined /></Link>} />
      <div className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {items.map((item, index) => (
          <Link key={item.id} href={item.href} className="group flex min-h-[142px] min-w-[138px] snap-start flex-col justify-between rounded-[18px] bg-white p-4 shadow-[0_2px_18px_rgba(21,48,66,0.05)] transition hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(21,48,66,0.10)] sm:min-w-0">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${index % 3 === 0 ? 'bg-[#e8f4fb] text-[#1677b8]' : index % 3 === 1 ? 'bg-[#fff0e9] text-[#df6043]' : 'bg-[#e8f4ef] text-[#25806b]'}`}>
              {icons[index % icons.length]}
            </span>
            <span className="mt-5 text-sm font-bold leading-snug text-[#273746] group-hover:text-[var(--sf-accent)]">{item.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ShoppingHelp() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <section className="overflow-hidden rounded-[26px] bg-[var(--sf-brand)] text-white sm:rounded-[32px] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <div className="px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
        <span className="text-xs font-bold uppercase text-[var(--sf-aqua)]">{t('home.helpEyebrow')}</span>
        <h2 className="mt-3 max-w-[560px] text-3xl font-black leading-tight sm:text-4xl">{t('home.helpTitle')}</h2>
        <p className="mt-4 max-w-[580px] text-sm leading-6 text-white/72 sm:text-base sm:leading-7">{t('home.helpDescription')}</p>
        <Link href={`/${locale}/contact`} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--sf-warm)] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5">
          {t('home.askForHelp')} <ArrowRightOutlined />
        </Link>
      </div>
      <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden bg-[#20517c] p-6 sm:min-h-[280px] lg:min-h-full">
        <div className="w-full max-w-[360px] rotate-[-3deg] rounded-[22px] bg-white p-4 text-[var(--sf-ink)] shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dff1f5] text-[#17658a]"><CustomerServiceOutlined className="text-xl" /></span>
            <div><p className="text-xs font-semibold text-[#7b8993]">PLEXORIA</p><p className="mt-0.5 text-sm font-bold">{t('home.helpQuestion')}</p></div>
          </div>
          <p className="ml-9 mt-4 rounded-2xl rounded-tr-sm bg-[#eaf4f7] px-4 py-3 text-xs leading-5 text-[#435968]">{t('home.helpAnswer')}</p>
        </div>
      </div>
    </section>
  );
}

export function BrandIntro() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <section className="grid gap-6 border-t border-[var(--sf-line)] py-12 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-20">
      <div>
        <p className="text-xs font-bold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
        <h2 className="mt-3 text-3xl font-black leading-tight text-[var(--sf-brand)] sm:text-4xl">{t('home.subtitle')}</h2>
      </div>
      <div>
        <p className="max-w-2xl text-base leading-7 text-[var(--sf-subtle)] sm:text-lg sm:leading-8">{t('home.description')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/${locale}/about`} className="sf-button-secondary">{t('layout.aboutPlexoria')}</Link>
          <a href="https://wa.me/56995096835" target="_blank" rel="noopener noreferrer" className="sf-button-primary"><MessageOutlined />{t('contact.whatsApp')}</a>
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
    <section className="border-y border-[var(--sf-line)] bg-[#f4f1ea]">
      <div className="sf-shell grid grid-cols-2 gap-y-7 py-9 lg:grid-cols-4 lg:py-10">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3 px-2 sm:px-4 lg:border-r lg:border-[var(--sf-line)] lg:last:border-r-0">
            <span className="mt-0.5 text-xl text-[var(--sf-accent)]">{item.icon}</span>
            <div><p className="text-xs font-extrabold text-[#263845] sm:text-sm">{item.title}</p><p className="mt-1 hidden text-xs text-[#6e7b84] sm:block">{item.text}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">{eyebrow}</p>
        <h2 className="mt-1.5 text-[26px] font-black leading-tight text-[var(--sf-ink)] sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 hidden text-sm text-[var(--sf-muted)] sm:block">{description}</p>}
      </div>
      <div className="shrink-0 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:gap-1.5 [&_a]:text-xs [&_a]:font-bold [&_a]:text-[var(--sf-accent)] sm:[&_a]:text-sm">{action}</div>
    </div>
  );
}
