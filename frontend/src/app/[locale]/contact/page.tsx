'use client';

import type { ReactNode } from 'react';
import { MailOutlined, MessageOutlined, PhoneOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import OrderTrackingLink from '@/components/order/OrderTrackingLink';
import SupplierDisclosure from '@/components/legal/SupplierDisclosure';

export default function ContactPage() {
  const t = useTranslations();
  const locale = useLocale();
  return <main className="store-container"><section className="max-w-3xl"><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 text-4xl font-black text-[var(--sf-ink)]">{t('layout.contactUs')}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[var(--sf-muted)]">{t('contact.desc')}</p><OrderTrackingLink className="sf-button-secondary mt-6" /><div className="mt-9 grid gap-4 sm:grid-cols-2"><ContactOption icon={<PhoneOutlined />} label={t('contact.phone')} href="tel:+56995096835" value="+56 9 9509 6835" /><ContactOption icon={<MessageOutlined />} label={t('contact.whatsAppLabel')} href="https://wa.me/56995096835" value={t('contact.whatsApp')} external /><ContactOption icon={<MailOutlined />} label={t('contact.email')} href="mailto:support@plexoria.cl" value="support@plexoria.cl" /><div className="rounded-[18px] bg-[var(--sf-soft)] p-5"><p className="text-xs font-bold uppercase text-[var(--sf-muted)]">{t('contact.hours')}</p><p className="mt-2 text-sm font-black text-[var(--sf-ink)]">{t('contact.hoursText')}</p></div></div><div className="mt-8"><SupplierDisclosure locale={locale} /></div></section></main>;
}

function ContactOption({ icon, label, href, value, external = false }: { icon: ReactNode; label: string; href: string; value: string; external?: boolean }) {
  return <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="group rounded-[18px] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(21,48,66,0.10)]"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--sf-soft-blue)] text-xl text-[var(--sf-accent)]">{icon}</span><p className="mt-5 text-xs font-bold uppercase text-[var(--sf-muted)]">{label}</p><p className="mt-1 break-all text-sm font-black text-[var(--sf-ink)] group-hover:text-[var(--sf-accent)]">{value}</p></a>;
}
