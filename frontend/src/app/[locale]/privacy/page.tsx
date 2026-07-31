'use client';

import { useTranslations } from 'next-intl';

export default function PrivacyPage() {
  const t = useTranslations();
  return <main className="store-container"><article className="max-w-3xl"><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 text-4xl font-black text-[var(--sf-ink)]">{t('layout.privacyPolicy')}</h1><p className="mt-8 border-t border-[var(--sf-line)] pt-6 text-sm leading-7 text-[var(--sf-subtle)]">{t('privacy.policyDesc')}</p></article></main>;
}
