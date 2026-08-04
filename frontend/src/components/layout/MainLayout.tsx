import React from 'react';
import Header from './Header';
import Footer from './Footer';
import CartHydration from '@/components/cart/CartHydration';
import CookieConsentCenter from '@/components/legal/CookieConsentCenter';

interface MainLayoutProps {
  children: React.ReactNode;
  skipNav: string;
}

export default function MainLayout({ children, skipNav }: MainLayoutProps) {
  return (
    <div className="storefront flex min-h-screen flex-col bg-[var(--sf-bg)] text-[var(--sf-ink)]">
	  <CartHydration />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-[var(--sf-brand)] focus:shadow-lg"
      >
        {skipNav}
      </a>
      <Header />
      <div id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </div>
      <Footer />
      <CookieConsentCenter />
    </div>
  );
}
