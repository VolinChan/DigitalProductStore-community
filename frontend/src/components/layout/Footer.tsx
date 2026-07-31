'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

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
        <div className="mt-9 flex flex-col gap-3 border-t border-white/12 pt-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('layout.copyright', { year })}</p>
          <Link href={`/${locale}/privacy`} className="w-fit transition hover:text-white">{t('layout.privacyPolicy')}</Link>
        </div>
      </div>
    </footer>
  );
}
