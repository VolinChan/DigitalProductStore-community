'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export default function ShippingPage() {
  const t = useTranslations('help.shipping');
  const common = useTranslations();
  const locale = useLocale();
  const items = [{ title: t('processingTime'), text: t('processingDesc') }, { title: t('deliveryTime'), text: t('deliveryDesc') }, { title: t('cost'), text: t('costDesc') }];
  return <main className="store-container"><article className="max-w-3xl"><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 text-4xl font-black text-[var(--sf-ink)]">{t('title')}</h1><div className="mt-8 space-y-7">{items.map((item) => <section key={item.title} className="border-t border-[var(--sf-line)] pt-6"><h2 className="text-lg font-black text-[var(--sf-ink)]">{item.title}</h2><p className="mt-3 text-sm leading-7 text-[var(--sf-subtle)]">{item.text}</p></section>)}</div><Link href={`/${locale}/contact`} className="sf-button-secondary mt-9">{common('layout.contactUs')}</Link></article></main>;
}
