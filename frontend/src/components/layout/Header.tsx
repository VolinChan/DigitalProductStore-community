'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuOutlined,
  SearchOutlined,
  ShoppingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import MobileMenu from './MobileMenu';

export default function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, user, logout, loadUser } = useAuthStore();
  const cartItemCount = useCartStore((state) => state.totalItems);
  const locale = getLocale(pathname);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && isAuthenticated && !user) {
      loadUser().catch(() => undefined);
    }
  }, [isAuthenticated, loadUser, mounted, user]);

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
        ...(user?.role === 'super_admin'
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
      <div className="bg-[var(--sf-brand)] px-4 py-2 text-center text-[11px] font-semibold text-white sm:text-xs">
        {t('layout.announcement')}
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

            <form onSubmit={submitSearch} className="ml-auto hidden min-w-0 flex-1 lg:block lg:max-w-[330px] xl:max-w-[380px]">
              <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t('layout.searchPlaceholder')} />
            </form>

            <div className="ml-auto flex items-center gap-1 lg:ml-2">
              <div className="hidden lg:block"><LanguageSwitcher /></div>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                <button type="button" className="sf-icon-button hidden sm:flex" aria-label={t('layout.userMenu')}>
                  <UserOutlined className="text-[19px]" />
                </button>
              </Dropdown>
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

          <form onSubmit={submitSearch} className="pb-3 lg:hidden">
            <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t('layout.searchPlaceholder')} />
          </form>
        </div>
      </header>

      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex h-11 items-center gap-2.5 rounded-full bg-[var(--sf-soft)] px-4 ring-[var(--sf-accent)]/15 transition focus-within:bg-white focus-within:ring-4">
      <SearchOutlined className="shrink-0 text-[17px] text-[var(--sf-muted)]" />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--sf-ink)] outline-none placeholder:text-[var(--sf-muted)]"
      />
    </label>
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
