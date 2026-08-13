'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuOutlined,
  SearchOutlined,
  CloseCircleFilled,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, user, logout, loadUser } = useAuthStore();
  const cartItemCount = useCartStore((state) => state.totalItems);
	const [unreadNotifications, setUnreadNotifications] = useState(0);
  const locale = getLocale(pathname);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (pathname?.startsWith(`/${locale}/products/search`)) setSearchQuery(searchParams.get('q') || '');
  }, [locale, pathname, searchParams]);

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
        { key: 'logout', label: <button type="button" onClick={handleLogout}>{t('layout.logout')}</button> },
      ]
    : [
        { key: 'login', label: <Link href={`/${locale}/login`}>{t('layout.login')}</Link> },
        { key: 'register', label: <Link href={`/${locale}/register`}>{t('layout.register')}</Link> },
      ];

  return (
    <>
      <div role="region" aria-label={t('layout.announcement')} className="bg-[var(--sf-brand)] px-4 py-2.5 text-center text-xs font-black tracking-wide text-white sm:text-sm">
        <span className="inline-flex items-center gap-2"><GiftOutlined aria-hidden />{t('layout.announcement')}</span>
      </div>

      <header className="sticky top-0 z-50 border-b border-[var(--sf-line)] bg-[color:var(--sf-bg)]/95 backdrop-blur-xl">
        <div className="sf-shell">
          <div className="flex h-[68px] items-center gap-3 lg:h-[76px]">
            <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2.5" aria-label={t('layout.logo')}>
              <Image src="/plexoria-logo.png" alt="Plexoria Logo" width={240} height={80} className="h-7 w-auto sm:h-8" priority />
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
              <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t('layout.searchPlaceholder')} searchLabel={t('layout.searchAria')} clearLabel={t('layout.closeSearch')} />
            </form>

            <div className="ml-auto flex items-center gap-1 lg:ml-2">
              <div className="hidden lg:block"><LanguageSwitcher /></div>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                <button type="button" className="sf-icon-button hidden sm:flex" aria-label={t('layout.userMenu')}>
                  <UserOutlined className="text-[19px]" />
                </button>
              </Dropdown>
			  {showAuthed && <Link href={`/${locale}/notifications`} className="sf-icon-button relative" aria-label={t('layout.notifications')}><BellOutlined className="text-[20px]" />{unreadNotifications > 0 && <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--sf-warm)] px-1 text-[10px] font-bold text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</Link>}
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
              <button type="button" className="sf-icon-button lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label={t('layout.menu')}>
                <MenuOutlined className="text-xl" />
              </button>
            </div>
          </div>

          <form role="search" onSubmit={submitSearch} className="pb-3 lg:hidden">
            <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t('layout.searchPlaceholder')} searchLabel={t('layout.searchAria')} clearLabel={t('layout.closeSearch')} />
          </form>
        </div>
      </header>

      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}

function SearchField({ value, onChange, placeholder, searchLabel, clearLabel }: { value: string; onChange: (value: string) => void; placeholder: string; searchLabel: string; clearLabel: string }) {
  return (
    <div className="flex h-12 items-center gap-1 rounded-xl border border-[var(--sf-line)] bg-white p-1 pl-3 transition focus-within:border-[var(--sf-accent)] focus-within:ring-4 focus-within:ring-[var(--sf-accent)]/12">
      <SearchOutlined className="mr-1 shrink-0 text-[17px] text-[var(--sf-muted)]" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={searchLabel}
        className="sf-header-search-input min-w-0 flex-1 appearance-none border-0 bg-transparent px-1 text-sm text-[var(--sf-ink)] outline-none placeholder:text-[var(--sf-muted)]"
      />
      {value && <button type="button" onClick={() => onChange('')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--sf-muted)] transition hover:bg-[var(--sf-soft)] hover:text-[var(--sf-ink)]" aria-label={clearLabel}><CloseCircleFilled /></button>}
      <button type="submit" disabled={!value.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-0 bg-[var(--sf-brand)] text-white transition hover:bg-[var(--sf-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40" aria-label={searchLabel}><SearchOutlined className="text-[17px]" /></button>
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
