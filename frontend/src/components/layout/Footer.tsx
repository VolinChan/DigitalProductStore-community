'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

const footerLinks = {
  shop: {
    title: 'layout.shopGuide',
    links: [
      { label: 'layout.allProductsLink', href: '/products' },
      { label: 'layout.categoryLink', href: '/categories' },
      { label: 'layout.newArrivals', href: '/products?sort=newest' },
    ],
  },
  service: {
    title: 'layout.customerService',
    links: [
      { label: 'layout.orderTracking', href: '/orders/track' },
      { label: 'layout.shippingInfo', href: '/help/shipping' },
      { label: 'layout.returnPolicy', href: '/help/returns' },
    ],
  },
  about: {
    title: 'layout.aboutUs',
    links: [
      { label: 'layout.aboutPlexoria', href: '/about' },
      { label: 'layout.contactUs', href: '/contact' },
      { label: 'layout.privacyPolicy', href: '/privacy' },
    ],
  },
};

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/70 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-6 md:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 md:pr-10">
            <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              PLEXORIA
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted">
              {t('home.description')}
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">
              {t('home.subtitle')}
            </p>
            <a href="tel:+56995096835" className="mt-4 inline-flex items-center rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10">
              +56 9 9509 6835
            </a>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.links[0].href} className="md:col-span-1">
              <h3 className="mb-4 text-sm font-semibold text-foreground">{t(section.title)}</h3>
              <ul className="space-y-1">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={`/${locale}${link.href}`}
                      className="inline-flex min-h-[36px] items-center text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {t(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <p className="text-center text-xs text-muted">
            {t('layout.copyright', { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  );
}
