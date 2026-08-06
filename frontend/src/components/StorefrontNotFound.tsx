'use client';

import Link from 'next/link';
import { AppstoreOutlined, HomeOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { DEFAULT_INDEX_LOCALE, isStorefrontLocale } from '@/lib/seo/policy';

export default function StorefrontNotFound() {
  const requestedLocale = useLocale();
  const locale = isStorefrontLocale(requestedLocale) ? requestedLocale : DEFAULT_INDEX_LOCALE;
  const t = useTranslations('notFoundPage');

  return (
    <main className="store-container flex min-h-[68vh] items-center py-10 sm:py-16">
      <section className="grid w-full overflow-hidden rounded-[28px] border border-[var(--sf-line)] bg-white shadow-[0_24px_70px_rgba(16,48,58,0.08)] lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <p className="inline-flex rounded-full bg-[var(--sf-soft-blue)] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--sf-brand)]">
            {t('eyebrow')}
          </p>
          <h1 className="mt-5 max-w-xl text-3xl font-black leading-tight text-[var(--sf-ink)] sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--sf-muted)] sm:text-base">
            {t('description')}
          </p>

          <form action={`/${locale}/products`} role="search" className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <label htmlFor="not-found-search" className="sr-only">{t('searchLabel')}</label>
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--sf-line)] bg-[var(--sf-bg)] px-4 focus-within:border-[var(--sf-brand)] focus-within:ring-2 focus-within:ring-[var(--sf-soft-blue)]">
              <SearchOutlined aria-hidden className="text-[var(--sf-muted)]" />
              <input
                id="not-found-search"
                name="q"
                type="search"
                placeholder={t('searchPlaceholder')}
                className="h-12 min-w-0 flex-1 bg-transparent text-sm text-[var(--sf-ink)] outline-none placeholder:text-[var(--sf-muted)]"
              />
            </div>
            <button type="submit" className="sf-button-primary h-12 shrink-0">{t('searchAction')}</button>
          </form>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={`/${locale}/products`} className="sf-button-primary">
              <AppstoreOutlined aria-hidden />{t('browseProducts')}
            </Link>
            <Link href={`/${locale}`} className="sf-button-secondary">
              <HomeOutlined aria-hidden />{t('backHome')}
            </Link>
          </div>
        </div>

        <div aria-hidden className="relative hidden min-h-[440px] overflow-hidden bg-[linear-gradient(145deg,var(--sf-soft-blue),#dff3ed)] lg:block">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[34px] border-white/40" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-white/35" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative flex h-64 w-64 items-center justify-center rounded-full bg-white/75 shadow-[0_22px_60px_rgba(30,84,94,0.13)] backdrop-blur">
              <span className="text-[92px] font-black tracking-[-0.08em] text-[var(--sf-brand)]">404</span>
              <span className="absolute -bottom-4 -right-3 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--sf-accent)] text-3xl text-white shadow-xl">
                <SearchOutlined />
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
