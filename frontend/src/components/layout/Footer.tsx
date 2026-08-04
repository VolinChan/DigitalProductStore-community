'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import SupplierDisclosure from '@/components/legal/SupplierDisclosure';
import { openConsentCenterEvent } from '@/lib/legal/consent';

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const year = new Date().getFullYear();
  const links = [
    { label: t('layout.allProductsLink'), href: '/products' },
    { label: t('layout.shippingInfo'), href: '/help/shipping' },
    { label: t('layout.returnPolicy'), href: '/help/returns' },
    { label: t('layout.contactUs'), href: '/contact' },
    { label: t('layout.privacyPolicy'), href: '/privacy' },
    { label: t('orders.tracking'), href: '/orders/track' },
    { label: locale === 'es-CL' ? 'Información legal' : 'Legal information', href: '/legal' },
  ];

  return (
    <footer className="mt-auto border-t border-[var(--sf-line)] bg-[var(--sf-brand)] text-white">
      <div className="sf-shell py-10 sm:py-12 lg:py-14">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <Link href={`/${locale}`} className="inline-flex w-fit items-center gap-2.5" aria-label={t('layout.logo')}>
            <Image src="/plexoria-logo-footer.png" alt="Plexoria Footer Logo" width={240} height={80} className="h-7 w-auto sm:h-8" />
          </Link>
          <nav className="flex max-w-2xl flex-wrap gap-x-5 gap-y-3 sm:justify-end" aria-label={t('layout.shopGuide')}>
            {links.map((link) => (
              <Link key={link.href} href={`/${locale}${link.href}`} className="text-sm font-medium text-white/70 transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-white/12 pt-6 text-white/75"><SupplierDisclosure locale={locale} compact /></div>
        <div className="mt-6 flex flex-col gap-3 border-t border-white/12 pt-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('layout.copyright', { year })}</p>
          <div className="flex flex-wrap gap-4"><Link href={`/${locale}/privacy`} className="w-fit transition hover:text-white">{t('layout.privacyPolicy')}</Link><button type="button" className="border-0 bg-transparent p-0 text-inherit underline-offset-2 transition hover:text-white hover:underline" onClick={() => window.dispatchEvent(new Event(openConsentCenterEvent))}>{locale === 'es-CL' ? 'Preferencias de cookies' : 'Cookie preferences'}</button></div>
        </div>
      </div>
    </footer>
  );
}
