import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LegalDocument({ locale, title, children }: { locale: string; title: string; children: ReactNode }) {
  const es = locale !== 'en';
  return <main className="store-container"><article className="mx-auto max-w-3xl rounded-[22px] bg-white p-6 sm:p-9">
    <Link href={`/${locale}/legal`} className="text-sm font-bold text-[var(--sf-accent)]">← {es ? 'Centro legal' : 'Legal center'}</Link>
    <h1 className="mt-5 text-3xl font-black text-[var(--sf-ink)]">{title}</h1>
    <div role="note" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>{es ? 'Borrador para revisión profesional.' : 'Draft for professional review.'}</strong> {es ? 'Esta versión organiza la información operativa confirmada y no sustituye la aprobación de un profesional familiarizado con la normativa chilena y SERNAC.' : 'This version organizes confirmed operational facts and does not replace approval by a professional familiar with Chilean and SERNAC rules.'}</div>
    <div className="legal-copy mt-8 space-y-6 text-sm leading-7 text-[var(--sf-ink)]">{children}</div>
    <footer className="mt-10 border-t border-[var(--sf-line)] pt-5 text-xs text-[var(--sf-muted)]">{es ? 'Versión 0.1-draft · Fuente jurídica pendiente · Última actualización: 4 de agosto de 2026' : 'Version 0.1-draft · Legal source review pending · Last updated: August 4, 2026'}</footer>
  </article></main>;
}
