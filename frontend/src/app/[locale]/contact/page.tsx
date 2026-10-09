'use client';

import type { ReactNode } from 'react';
import { MailOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import SupplierDisclosure from '@/components/legal/SupplierDisclosure';
import { supplierProfile } from '@/lib/legal/supplier';

export default function ContactPage() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <main className="store-container">
      <section className="max-w-3xl">
        <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
        <h1 className="mt-2 text-4xl font-black text-[var(--sf-ink)]">{t('layout.contactUs')}</h1>
        <h2 className="mt-6 text-xl font-bold text-[var(--sf-ink)]">{t('contact.welcomeTitle')}</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--sf-subtle)]">{t('contact.desc')}</p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2" data-testid="contact-channels">
          <ContactOption icon={<WhatsAppOutlined />} label={t('contact.whatsAppLabel')} href={supplierProfile.whatsappHref} value={t('contact.whatsApp')} external primary />
          <ContactOption icon={<MailOutlined />} label={t('contact.email')} href={`mailto:${supplierProfile.supportEmail}`} value={supplierProfile.supportEmail} />
          <div className="rounded-[18px] bg-[var(--sf-soft)] p-5 sm:col-span-2" data-testid="contact-service-hours">
            <p className="text-xs font-bold uppercase text-[var(--sf-subtle)]">{t('contact.hours')}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--sf-ink)]">{t('contact.hoursText')}</p>
          </div>
        </div>
        <div className="mt-8"><SupplierDisclosure locale={locale} showPhone={false} showHours={false} /></div>
      </section>
    </main>
  );
}

function ContactOption({ icon, label, href, value, external = false, primary = false }: { icon: ReactNode; label: string; href: string; value: string; external?: boolean; primary?: boolean }) {
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={`group rounded-[18px] border border-[var(--sf-line)] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(21,48,66,0.10)] ${primary ? 'bg-[var(--sf-soft-blue)]' : 'bg-white'}`}>
      <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl text-[var(--sf-accent)] ${primary ? 'bg-white' : 'bg-[var(--sf-soft-blue)]'}`}>{icon}</span>
      <p className="mt-5 text-xs font-bold uppercase text-[var(--sf-subtle)]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[var(--sf-ink)] group-hover:text-[var(--sf-accent)]">{value}</p>
    </a>
  );
}
