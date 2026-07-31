'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import BrandMark from './BrandMark';

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function AuthShell({ title, description, children }: AuthShellProps) {
  const locale = useLocale();
  return (
    <main className="sf-shell flex min-h-[calc(100vh-190px)] items-center justify-center py-10 sm:py-14">
      <section className="w-full max-w-[460px] rounded-[24px] bg-white p-5 shadow-[0_10px_40px_rgba(23,63,103,0.08)] sm:p-8">
        <Link href={`/${locale}`} className="inline-flex items-center gap-2.5"><BrandMark /><span className="text-lg font-black text-[var(--sf-brand)]">PLEXORIA</span></Link>
        <h1 className="mt-7 text-3xl font-black text-[var(--sf-ink)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sf-muted)]">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
