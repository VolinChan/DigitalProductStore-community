'use client';

import React from 'react';
import { Drawer } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import { useTranslations } from 'next-intl';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const t = useTranslations();
  const pathname = usePathname();

  // Extract locale from path
  const getLocale = (): string => {
    if (!pathname) return 'es-CL';
    const parts = pathname.split('/').filter(p => p);
    return parts.length > 0 ? (parts[0] as string) : 'es-CL';
  };

  const locale = getLocale();

  return (
    <Drawer
      title={<span className="text-lg font-bold text-accent">PLEXORIA</span>}
      placement="left"
      onClose={onClose}
      open={open}
      size={280}
      closeIcon={<CloseOutlined className="text-lg" />}
      styles={{ body: { padding: '16px 0' } }}
    >
      <div className="flex flex-col h-full">
        {/* Navigation Links */}
        <div className="px-4 mb-6">
          <Navigation direction="vertical" onItemClick={onClose} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mx-4 mb-6" />

        {/* User Actions */}
        <div className="px-4 flex flex-col gap-2">
          <Link href={`/${locale}/login`} onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] transition-colors">
            <span className="text-sm font-medium">{t('layout.login')}</span>
          </Link>
          <Link href={`/${locale}/register`} onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] transition-colors">
            <span className="text-sm font-medium">{t('layout.register')}</span>
          </Link>
        </div>

        {/* Bottom section */}
        <div className="mt-auto px-4 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">© {new Date().getFullYear()} PLEXORIA</p>
        </div>
      </div>
    </Drawer>
  );
}
