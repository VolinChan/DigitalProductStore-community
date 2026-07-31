'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ReloadOutlined, WarningFilled } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  useEffect(() => { console.error('Page error:', error); }, [error]);
  return <main className="store-container flex min-h-[60vh] items-center justify-center"><section className="max-w-xl text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff5d9] text-3xl text-[#835d00]"><WarningFilled /></span><h1 className="mt-6 text-3xl font-black text-[var(--sf-ink)]">{t('error.title')}</h1><p className="mt-3 text-sm leading-7 text-[var(--sf-muted)]">{t('error.subTitle')}</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={reset} className="sf-button-primary"><ReloadOutlined />{t('common.retry')}</button><Link href={`/${locale}/products`} className="sf-button-secondary">{t('home.browseProducts')}</Link></div></section></main>;
}
