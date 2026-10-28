'use client';

import BrandWordmark from '@/components/brand/BrandWordmark';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { supplierProfile } from '@/lib/legal/supplier';
import { openConsentCenterEvent } from '@/lib/legal/consent';
import FooterPaymentMarks from '@/components/layout/FooterPaymentMarks';
import MarketplaceLinks from '@/components/layout/MarketplaceLinks';
import AccessibilityPreferences from '@/components/accessibility/AccessibilityPreferences';
import './footer-brands.css';

interface FooterLink {
  label: string;
  href: string;
}

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const year = new Date().getFullYear();
  const isSpanish = locale === 'es-CL';
  const storeLinks: FooterLink[] = [
    { label: t('layout.allProductsLink'), href: '/products' },
    { label: t('layout.categoryLink'), href: '/categories' },
    { label: t('layout.newArrivals'), href: '/products?sort=newest' },
    { label: t('products.recommendedTitle'), href: '/recommended' },
  ];
  const helpLinks: FooterLink[] = [
    { label: t('orders.tracking'), href: '/orders/track' },
    { label: t('layout.returnPolicy'), href: '/help/returns' },
    { label: t('layout.shippingInfo'), href: '/help/shipping' },
    { label: t('layout.contactUs'), href: '/contact' },
  ];

  return (
    <footer className="sf-footer mt-auto text-white">
      <div className="sf-shell py-10 sm:py-12 lg:py-14">
        <div className="sf-footer-grid grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-4">
          <section aria-labelledby="footer-brand-title" className="col-span-2 min-w-0 lg:col-span-1">
            <Link href={`/${locale}`} className="sf-footer-logo-link" aria-label={t('layout.logo')}>
              <BrandWordmark alt="Plexoria" className="sf-footer-logo" />
            </Link>
            <h2 id="footer-brand-title" className="sr-only">PLEXORIA</h2>
            <MarketplaceLinks />
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/65">{t('layout.footerDescription')}</p>
          </section>

          <FooterLinks title={t('layout.store')} links={storeLinks} locale={locale} />
          <FooterLinks title={t('layout.help')} links={helpLinks} locale={locale} />

          <section aria-labelledby="footer-contact-title" className="col-span-2 min-w-0 lg:col-span-1">
            <h2 id="footer-contact-title" className="text-sm font-black uppercase tracking-[0.12em] text-white">{t('layout.contactUs')}</h2>
            <address className="mt-4 space-y-3 text-sm not-italic leading-6 text-white/65">
              <p><a href={`mailto:${supplierProfile.supportEmail}`} className="transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{supplierProfile.supportEmail}</a></p>
              <p>{supplierProfile.principalAddress}</p>
              <p><Link href={`/${locale}/contact`} className="text-white/65 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{isSpanish ? 'Ver horarios de atención' : 'View service hours'} <span aria-hidden="true">→</span></Link></p>
            </address>
          </section>
        </div>

      </div>
      <div className="sf-footer-bottom">
        <div className="sf-shell sf-footer-bottom-content">
          <div className="sf-footer-copyright">
            <p className="text-[13px] font-semibold leading-5 text-white/85">{t('layout.copyright', { year })}</p>
            <nav aria-label={isSpanish ? 'Información legal y privacidad' : 'Legal and privacy information'} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-5 text-white/70">
              <Link href={`/${locale}/privacy`} className="transition hover:text-white">{t('layout.privacyPolicy')}</Link>
              <Link href={`/${locale}/legal`} className="transition hover:text-white">{isSpanish ? 'Información legal' : 'Legal information'}</Link>
              <button type="button" className="border-0 bg-transparent p-0 text-inherit transition hover:text-white" onClick={() => window.dispatchEvent(new Event(openConsentCenterEvent))}>{isSpanish ? 'Preferencias de cookies' : 'Cookie preferences'}</button>
              <AccessibilityPreferences />
            </nav>
          </div>

          <FooterPaymentMarks />
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links, locale }: { title: string; links: FooterLink[]; locale: string }) {
  return (
    <nav aria-label={title} className="min-w-0">
      <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white">{title}</h2>
      <ul className="m-0 mt-4 list-none space-y-3 p-0">
        {links.map((link) => (
          <li key={link.href} className="m-0 p-0"><Link href={`/${locale}${link.href}`} className="text-sm text-white/65 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{link.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
