'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: '首页', href: '/' },
  { label: '全部商品', href: '/products' },
  { label: '分类', href: '/categories' },
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
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className={`${
        direction === 'horizontal'
          ? 'flex items-center gap-1'
          : 'flex flex-col gap-1'
      } ${className}`}
      aria-label="主导航"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onItemClick}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors
            min-h-[44px] min-w-[44px] flex items-center justify-center
            ${
              isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }
          `}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          {item.icon && <span className="mr-2">{item.icon}</span>}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export { navItems };
