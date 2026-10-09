'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ApiOutlined,
  ArrowRightOutlined,
  CustomerServiceOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';

export function HomeHero() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <section className="relative hidden overflow-hidden rounded-[28px] bg-[#dff1f5] px-12 py-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-32 h-80 w-80 rounded-full border-[48px] border-white/25" />
      <div className="relative max-w-[700px]">
        <h1 className="text-[40px] font-black leading-tight tracking-tight text-[var(--sf-brand)]">{t('home.heroCompactTitle')}</h1>
        <p className="mt-3 text-base leading-7 text-[#455d6f]">{t('home.heroCompactDescription')}</p>
      </div>
      <Link href={`/${locale}/products`} className="sf-button-primary relative shrink-0">
        {t('home.viewProducts')} <ArrowRightOutlined />
      </Link>
    </section>
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
            <div><p className="text-xs font-semibold text-[#7b8993]">PLEXORIA</p><p className="mt-0.5 text-sm font-bold">{t('home.helpQuestion')}</p></div>
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

export function SectionHeading({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-extrabold tracking-tight text-[var(--sf-ink)] sm:text-2xl">{title}</h2>
      <div className="shrink-0 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:gap-1.5 [&_a]:text-xs [&_a]:font-bold [&_a]:text-[var(--sf-accent)] sm:[&_a]:text-sm">{action}</div>
    </div>
  );
}
