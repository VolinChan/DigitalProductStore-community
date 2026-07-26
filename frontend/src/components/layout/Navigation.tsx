'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'layout.home', href: '/' },
  { label: 'layout.allProducts', href: '/products' },
  { label: 'layout.categories', href: '/categories' },
];

interface NavigationProps {
  className?: string;
  direction?: 'horizontal' | 'vertical';
  onItemClick?: () => void;
}

export default function Navigation({
  className = '',
  direction = 'horizontal',
  onItemClick,
}: NavigationProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  // Extract locale from current path
  const getLocale = (): string => {
    if (!pathname) return 'es-CL';
    const parts = pathname.split('/').filter(p => p);
    return parts.length > 0 ? (parts[0] as string) : 'es-CL';
  };

  const isActive = (href: string) => {
    const baseHref = `/${getLocale()}${href}`;
    if (href === '/') return pathname === `/${getLocale()}`;
    return pathname.startsWith(baseHref);
  };

  return (
    <nav
      className={`${
        direction === 'horizontal'
          ? 'flex items-center gap-1'
          : 'flex flex-col gap-1'
      } ${className}`}
      aria-label={t('layout.home')}
    >
      {navItems.map((item) => {
        const href = `/${getLocale()}${item.href}`;
        return (
          <Link
            key={item.href}
            href={href}
            onClick={onItemClick}
            className={`
              px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
              min-h-[44px] min-w-[44px] flex items-center justify-center
              ${
                isActive(item.href)
                  ? 'bg-accent/10 text-accent font-semibold'
                  : 'text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10'
              }
            `}
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            {item.icon && <span className="mr-2">{item.icon}</span>}
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

export { navItems };
