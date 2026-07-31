'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Header from './Header';
import Footer from './Footer';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const t = useTranslations();

  return (
    <div className="storefront flex min-h-screen flex-col bg-[var(--sf-bg)] text-[var(--sf-ink)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-[var(--sf-brand)] focus:shadow-lg"
      >
        {t('layout.skipNav')}
      </a>
      <Header />
      <div id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </div>
      <Footer />
    </div>
  );
}
