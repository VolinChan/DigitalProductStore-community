'use client';

import Link from 'next/link';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';

export default function AboutPage() {
  const t = useTranslations();
  const locale = useLocale();
  return <main className="store-container"><section className="max-w-4xl py-5 sm:py-10"><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-3 text-4xl font-black leading-tight text-[var(--sf-brand)] sm:text-5xl">{t('home.subtitle')}</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--sf-subtle)]">{t('home.description')}</p><div className="mt-9 flex flex-wrap gap-3"><Link href={`/${locale}/products`} className="sf-button-primary">{t('home.viewProducts')} <ArrowRightOutlined /></Link><Link href={`/${locale}/contact`} className="sf-button-secondary">{t('layout.contactUs')}</Link></div></section></main>;
}
