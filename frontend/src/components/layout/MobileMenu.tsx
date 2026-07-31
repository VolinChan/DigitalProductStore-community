'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Drawer } from 'antd';
import { AppstoreOutlined, HomeOutlined, ShoppingOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import BrandMark from '@/components/storefront/BrandMark';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';
import { useAuthStore } from '@/store/useAuthStore';
import { trapFocusWithin } from '@/lib/focus';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const locale = pathname?.split('/').filter(Boolean)[0] || 'es-CL';
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const links = [
    { href: `/${locale}`, label: t('layout.home'), icon: <HomeOutlined /> },
    { href: `/${locale}/products`, label: t('layout.allProducts'), icon: <ShoppingOutlined /> },
    { href: `/${locale}/categories`, label: t('layout.categories'), icon: <AppstoreOutlined /> },
    { href: `/${locale}/${isAuthenticated ? 'profile' : 'login'}`, label: isAuthenticated ? t('layout.profile') : t('layout.login'), icon: <UserOutlined /> },
  ];

  return (
    <Drawer
      placement="right"
      className="storefront"
      onClose={onClose}
      open={open}
      onKeyDown={trapFocusWithin}
      width="min(88vw, 360px)"
      title={
        <Link href={`/${locale}`} onClick={onClose} className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-lg font-black text-[var(--sf-brand)]">PLEXORIA</span>
        </Link>
      }
      styles={{ body: { padding: 0 }, header: { borderBottom: '1px solid var(--sf-line)' } }}
    >
      <div className="flex h-full flex-col bg-[var(--sf-bg)] px-4 py-5">
        <nav className="space-y-1" aria-label={t('layout.menu')}>
          {links.map((link) => {
            const active = link.href === `/${locale}` ? pathname === link.href : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold transition-colors ${
                  active ? 'bg-[var(--sf-soft-blue)] text-[var(--sf-accent)]' : 'text-[var(--sf-ink)] hover:bg-[var(--sf-soft)]'
                }`}
              >
                <span className="text-lg">{link.icon}</span>{link.label}
              </Link>
            );
          })}
        </nav>

        {!isAuthenticated && (
          <Link href={`/${locale}/register`} onClick={onClose} className="sf-button-primary mt-6 w-full">
            {t('layout.register')}
          </Link>
        )}

        <div className="mt-auto border-t border-[var(--sf-line)] pt-5">
          <p className="mb-2 text-xs font-bold uppercase text-[var(--sf-muted)]">{t('layout.language')}</p>
          <LanguageSwitcher />
        </div>
      </div>
    </Drawer>
  );
}
