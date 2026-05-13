'use client';

import React from 'react';
import Link from 'next/link';

const footerLinks = {
  shop: {
    title: '购物指南',
    links: [
      { label: '全部商品', href: '/products' },
      { label: '商品分类', href: '/categories' },
      { label: '新品上架', href: '/products?sort=newest' },
    ],
  },
  service: {
    title: '客户服务',
    links: [
      { label: '订单查询', href: '/orders/track' },
      { label: '配送说明', href: '/help/shipping' },
      { label: '退换政策', href: '/help/returns' },
    ],
  },
  about: {
    title: '关于我们',
    links: [
      { label: '关于商城', href: '/about' },
      { label: '联系我们', href: '/contact' },
      { label: '隐私政策', href: '/privacy' },
    ],
  },
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand section */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="text-xl font-bold text-primary hover:opacity-80 transition-opacity"
            >
              数码商城
            </Link>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              专注数码产品的在线商城，提供优质的数码产品和购物体验。
            </p>
          </div>

          {/* Link sections */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-primary transition-colors min-h-[44px] inline-flex items-center"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-xs text-gray-400">
            © {currentYear} 数码商城 Digital Store. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
