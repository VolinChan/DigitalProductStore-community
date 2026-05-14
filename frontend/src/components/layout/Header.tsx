'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Input, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  ShoppingCartOutlined,
  UserOutlined,
  SearchOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import Navigation from './Navigation';
import MobileMenu from './MobileMenu';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { isAuthenticated, user, logout, loadUser } = useAuthStore();
  const cartItemCount = useCartStore((s) => s.totalItems);

  // Avoid hydration mismatch: Zustand persist populates on the client only,
  // so we keep the first render as the "logged out" shape and swap once
  // mounted. Without this, the server-rendered header would briefly show
  // the login/register items even for logged-in users.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Refresh user profile on first mount when we have a token but no user
  // object yet (e.g. after a hard refresh).
  useEffect(() => {
    if (mounted && isAuthenticated && !user) {
      loadUser().catch(() => { /* noop */ });
    }
  }, [mounted, isAuthenticated, user, loadUser]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const showAuthed = mounted && isAuthenticated;

  const userMenuItems: MenuProps['items'] = showAuthed
    ? [
        { key: 'profile', label: <Link href="/profile">个人中心</Link> },
        { key: 'orders', label: <Link href="/orders">我的订单</Link> },
        { type: 'divider' },
        { key: 'logout', label: <span onClick={handleLogout}>退出登录</span> },
      ]
    : [
        { key: 'login', label: <Link href="/login">登录</Link> },
        { key: 'register', label: <Link href="/register">注册</Link> },
      ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section: Hamburger (mobile) + Logo */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger button */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="打开菜单"
            >
              <MenuOutlined className="text-xl" />
            </button>

            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-primary hover:opacity-80 transition-opacity"
            >
              <span className="hidden sm:inline">数码商城</span>
              <span className="sm:hidden">商城</span>
            </Link>
          </div>

          {/* Center section: Navigation (desktop only) */}
          <div className="hidden md:flex items-center">
            <Navigation />
          </div>

          {/* Right section: Search + Cart + User */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search - full on desktop, icon on mobile */}
            <div className="hidden lg:block">
              <Input
                placeholder="搜索商品..."
                prefix={<SearchOutlined className="text-gray-400" />}
                className="w-48 xl:w-64"
                size="middle"
                onPressEnter={(e) => {
                  const value = (e.target as HTMLInputElement).value;
                  if (value.trim()) {
                    window.location.href = `/products/search?q=${encodeURIComponent(value.trim())}`;
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="lg:hidden flex items-center justify-center w-11 h-11 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setSearchVisible(!searchVisible)}
              aria-label="搜索"
            >
              <SearchOutlined className="text-lg" />
            </button>

            {/* Cart */}
            <Link
              href="/cart"
              className="flex items-center justify-center w-11 h-11 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label={`购物车${cartItemCount > 0 ? `，${cartItemCount}件商品` : ''}`}
            >
              <Badge count={mounted ? cartItemCount : 0} size="small" offset={[-2, 2]}>
                <ShoppingCartOutlined className="text-xl text-gray-700" />
              </Badge>
            </Link>

            {/* User menu */}
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <button
                type="button"
                className="flex items-center justify-center w-11 h-11 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="用户菜单"
              >
                <UserOutlined className="text-lg" />
              </button>
            </Dropdown>
          </div>
        </div>

        {/* Mobile search bar - shown when search icon is clicked */}
        {searchVisible && (
          <div className="lg:hidden pb-3">
            <Input
              placeholder="搜索商品..."
              prefix={<SearchOutlined className="text-gray-400" />}
              size="large"
              autoFocus
              onPressEnter={(e) => {
                const value = (e.target as HTMLInputElement).value;
                if (value.trim()) {
                  window.location.href = `/products/search?q=${encodeURIComponent(value.trim())}`;
                  setSearchVisible(false);
                }
              }}
              onBlur={() => setSearchVisible(false)}
            />
          </div>
        )}
      </div>

      {/* Mobile Menu Drawer */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  );
}
