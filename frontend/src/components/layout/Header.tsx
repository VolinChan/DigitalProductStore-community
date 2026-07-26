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
  CloseOutlined,
} from '@ant-design/icons';
import Navigation from './Navigation';
import MobileMenu from './MobileMenu';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import ThemeToggle from '@/components/ThemeToggle';

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  const { isAuthenticated, user, logout, loadUser } = useAuthStore();
  const cartItemCount = useCartStore((s) => s.totalItems);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAuthenticated && !user) {
      loadUser().catch(() => { /* noop */ });
    }
  }, [mounted, isAuthenticated, user, loadUser]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) {
      router.push(`/products/search?q=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setSearchVisible(false);
    }
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
    <>
      {/* Top announcement bar */}
      <div className="bg-accent text-white text-center text-xs sm:text-sm py-1.5 px-4 font-medium tracking-wide">
        新用户注册享首单优惠 · 全场数码产品正品保障
      </div>

      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left: Hamburger + Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="打开菜单"
              >
                <MenuOutlined className="text-xl" />
              </button>

              <Link href="/" className="flex items-center gap-2 text-lg sm:text-xl font-bold text-foreground hover:opacity-80 transition-opacity">
                <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="hidden sm:inline">数码商城</span>
                <span className="sm:hidden">商城</span>
              </Link>
            </div>

            {/* Center: Desktop Navigation */}
            <nav className="hidden md:flex items-center flex-1 justify-center" aria-label="主导航">
              <Navigation />
            </nav>

            {/* Right: Search + Cart + User */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Search */}
              <div className={`${searchVisible ? 'flex' : 'hidden'} lg:flex items-center`}>
                {searchVisible ? (
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="搜索商品..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onPressEnter={handleSearch}
                      className="w-40 sm:w-56"
                      size="middle"
                      prefix={<SearchOutlined className="text-muted" />}
                      suffix={
                        <button
                          type="button"
                          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                          onClick={() => { setSearchVisible(false); setSearchQuery(''); }}
                          aria-label="关闭搜索"
                        >
                          <CloseOutlined className="text-muted" />
                        </button>
                      }
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="lg:hidden w-10 h-10 rounded-lg flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    onClick={() => setSearchVisible(true)}
                    aria-label="搜索"
                  >
                    <SearchOutlined className="text-lg" />
                  </button>
                )}
                {/* Desktop search always visible */}
                <div className="hidden lg:block">
                  <Input
                    placeholder="搜索商品..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onPressEnter={handleSearch}
                    className="w-44 xl:w-56"
                    size="middle"
                    prefix={<SearchOutlined className="text-muted" />}
                  />
                </div>
              </div>

              {/* Cart */}
              <Link
                id="cart-icon-header"
                href="/cart"
                className="relative w-10 h-10 rounded-lg flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label={`购物车${cartItemCount > 0 ? `，${cartItemCount}件商品` : ''}`}
              >
                <Badge count={mounted ? cartItemCount : 0} size="small" offset={[-2, 2]}>
                  <ShoppingCartOutlined className="text-xl" />
                </Badge>
              </Link>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* User menu */}
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                trigger={['click']}
              >
                <button
                  type="button"
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  aria-label="用户菜单"
                >
                  <UserOutlined className="text-lg" />
                </button>
              </Dropdown>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile search bar */}
      {searchVisible && (
        <div className="fixed top-[60px] left-0 right-0 z-40 bg-card border-b px-4 py-2 shadow-md lg:hidden">
          <Input
            placeholder="搜索商品..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            autoFocus
            size="large"
            prefix={<SearchOutlined className="text-muted" />}
            suffix={
              <button
                type="button"
                className="p-1"
                onClick={() => { setSearchVisible(false); setSearchQuery(''); }}
              >
                <CloseOutlined />
              </button>
            }
          />
        </div>
      )}

      {/* Mobile Menu Drawer */}
      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
