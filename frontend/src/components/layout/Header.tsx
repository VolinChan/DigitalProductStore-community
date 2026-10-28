'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import BrandWordmark from '@/components/brand/BrandWordmark';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuOutlined,
  SearchOutlined,
  CloseCircleFilled,
  CloseOutlined,
  ShoppingOutlined,
  UserOutlined,
	BellOutlined,
	GiftOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import MobileMenu from './MobileMenu';
import apiClient from '@/lib/api';

export default function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, user, logout, loadUser } = useAuthStore();
  const cartItemCount = useCartStore((state) => state.totalItems);
	const [unreadNotifications, setUnreadNotifications] = useState(0);
  const locale = getLocale(pathname);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setMobileSearchOpen(false);
    if (pathname?.startsWith(`/${locale}/products/search`)) setSearchQuery(searchParams.get('q') || '');
  }, [locale, pathname, searchParams]);

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (mounted && isAuthenticated && !user) {
      loadUser().catch(() => undefined);
    }
  }, [isAuthenticated, loadUser, mounted, user]);

	useEffect(() => {
	  if (!mounted || !isAuthenticated) { setUnreadNotifications(0); return; }
	  void apiClient.get('/notifications/unread-count').then((response) => setUnreadNotifications(response.data.data?.count || 0)).catch(() => undefined);
	}, [isAuthenticated, mounted, pathname]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setMobileSearchOpen(false);
    router.push(`/${locale}/products/search?q=${encodeURIComponent(query)}`);
  };

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
  };

  const showAuthed = mounted && isAuthenticated;
  const userMenuItems: MenuProps['items'] = showAuthed
    ? [
        { key: 'profile', label: <Link href={`/${locale}/profile`}>{t('layout.profile')}</Link> },
        { key: 'orders', label: <Link href={`/${locale}/orders`}>{t('layout.myOrders')}</Link> },
        ...(user?.permissions?.length
          ? [{ key: 'admin', label: <Link href="/admin">{t('layout.admin')}</Link> }]
          : []),
        { type: 'divider' as const },
        { key: 'logout', label: t('layout.logout'), onClick: handleLogout, danger: true },
      ]
    : [
        { key: 'login', label: <Link href={`/${locale}/login`}>{t('layout.login')}</Link> },
        { key: 'register', label: <Link href={`/${locale}/register`}>{t('layout.register')}</Link> },
      ];

  return (
    <>
      <div role="region" aria-label={`${t('layout.announcement')} · ${t('layout.pickupAnnouncement')}`} className="bg-[var(--sf-brand)] px-4 py-2 text-center text-white">
        <Link href={`/${locale}/help/shipping`} className="inline-flex min-h-11 flex-wrap items-center justify-center gap-x-4 gap-y-0.5 rounded-lg px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <span className="text-sm font-extrabold sm:text-base"><span className="inline-block"><GiftOutlined aria-hidden className="mr-2" />{t('layout.announcement')}</span>{' · '}<span className="inline-block">{t('layout.pickupAnnouncement')}</span></span>{' '}
          <span className="text-xs underline decoration-white/50 underline-offset-4">{t('layout.shippingConditions')}</span>
        </Link>
      </div>

      <header className="sf-header sticky top-0 z-50 border-b border-[var(--sf-line)] backdrop-blur-xl">
        <div className="sf-shell">
          <div className="flex h-[68px] items-center gap-3 lg:h-[76px]">
            <Link href={`/${locale}`} className="flex min-h-11 shrink-0 items-center rounded-lg px-2 py-2 sm:px-2.5" aria-label={t('layout.logo')}>
              <BrandWordmark alt="Plexoria Logo" className="sf-header-logo" priority />
            </Link>

            <nav className="ml-5 hidden items-center gap-5 xl:flex" aria-label={t('layout.home')}>
              <HeaderLink href={`/${locale}/products`} active={pathname?.startsWith(`/${locale}/products`) ?? false}>
                {t('layout.allProducts')}
              </HeaderLink>
              <HeaderLink href={`/${locale}/categories`} active={pathname?.startsWith(`/${locale}/categories`) ?? false}>
                {t('layout.categories')}
              </HeaderLink>
              <HeaderLink href={`/${locale}#offers`} active={false}>{t('home.viewOffers')}</HeaderLink>
            </nav>

            <form role="search" onSubmit={submitSearch} className="ml-auto hidden min-w-0 flex-1 lg:block lg:max-w-[390px] xl:max-w-[440px]">
              <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t('layout.searchPlaceholder')} searchLabel={t('layout.searchAria')} clearLabel={t('products.clearSearch')} />
            </form>

            <div className="ml-auto flex items-center gap-1 lg:ml-2">
              <button
                ref={mobileSearchButtonRef}
                type="button"
                className="sf-icon-button lg:hidden"
                aria-label={t(mobileSearchOpen ? 'layout.closeSearch' : 'layout.searchAria')}
                aria-expanded={mobileSearchOpen}
                aria-controls="storefront-mobile-search"
                onClick={() => setMobileSearchOpen(current => !current)}
              >
                {mobileSearchOpen ? <CloseOutlined className="text-xl" /> : <SearchOutlined className="text-xl" />}
              </button>
              <div className="hidden lg:block"><LanguageSwitcher /></div>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                <button type="button" className="sf-icon-button hidden sm:flex" aria-label={t('layout.userMenu')}>
                  <UserOutlined className="text-[19px]" />
                </button>
              </Dropdown>
			  {showAuthed && <Link href={`/${locale}/notifications`} className="sf-icon-button relative hidden sm:flex" aria-label={t('layout.notifications')}><BellOutlined className="text-[20px]" />{unreadNotifications > 0 && <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--sf-warm)] px-1 text-[10px] font-bold text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</Link>}
              <Link
                id="cart-icon-header"
                href={`/${locale}/cart`}
                className="sf-icon-button relative"
                aria-label={t('layout.cartItems', { count: mounted ? cartItemCount : 0 })}
              >
                <ShoppingOutlined className="text-[21px]" />
                {mounted && cartItemCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--sf-warm)] px-1 text-[10px] font-bold text-white">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </Link>
              <button type="button" className="sf-icon-button relative lg:hidden" onClick={() => { setMobileSearchOpen(false); setMobileMenuOpen(true); }} aria-label={t('layout.menu')} aria-describedby={unreadNotifications > 0 ? 'storefront-menu-notification-summary' : undefined}>
                <MenuOutlined className="text-xl" />
                {unreadNotifications > 0 && <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--sf-warm)] sm:hidden" />}
              </button>
              {unreadNotifications > 0 && <span id="storefront-menu-notification-summary" className="sr-only">{unreadNotifications} {t('layout.notifications')}</span>}
            </div>
          </div>

          <form
            id="storefront-mobile-search"
            role="search"
            onSubmit={submitSearch}
            className={`${mobileSearchOpen ? 'block' : 'hidden'} pb-3 lg:hidden`}
            onKeyDown={event => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              setMobileSearchOpen(false);
              mobileSearchButtonRef.current?.focus();
            }}
          >
            <SearchField inputRef={mobileSearchInputRef} value={searchQuery} onChange={setSearchQuery} placeholder={t('layout.searchPlaceholder')} searchLabel={t('layout.searchAria')} clearLabel={t('products.clearSearch')} />
          </form>
        </div>
      </header>

      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} unreadNotifications={unreadNotifications} />
    </>
  );
}

function SearchField({ value, onChange, placeholder, searchLabel, clearLabel, inputRef }: { value: string; onChange: (value: string) => void; placeholder: string; searchLabel: string; clearLabel: string; inputRef?: RefObject<HTMLInputElement | null> }) {
  return (
    <div className="sf-header-search-field flex h-12 items-center gap-1 rounded-lg border border-[var(--sf-line)] bg-white p-px pl-3 transition focus-within:border-[var(--sf-accent)] focus-within:ring-4 focus-within:ring-[var(--sf-accent)]/12">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={searchLabel}
        className="sf-header-search-input min-w-0 flex-1 appearance-none border-0 bg-transparent px-1 text-sm text-[var(--sf-ink)] outline-none placeholder:text-[var(--sf-muted)]"
      />
      {value && <button type="button" onClick={() => onChange('')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--sf-muted)] transition hover:bg-[var(--sf-soft)] hover:text-[var(--sf-ink)]" aria-label={clearLabel}><CloseCircleFilled /></button>}
      <button type="submit" disabled={!value.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--sf-brand)] transition hover:bg-[var(--sf-soft-blue)] disabled:cursor-not-allowed disabled:opacity-40" aria-label={searchLabel}><SearchOutlined className="text-[17px]" /></button>
    </div>
  );
}

function HeaderLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex min-h-11 items-center text-sm font-semibold transition-colors ${
        active ? 'text-[var(--sf-accent)]' : 'text-[var(--sf-subtle)] hover:text-[var(--sf-accent)]'
      }`}
    >
      {children}
    </Link>
  );
}

function getLocale(pathname: string | null): string {
  return pathname?.split('/').filter(Boolean)[0] || 'es-CL';
}
