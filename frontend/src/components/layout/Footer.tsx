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
    <footer className="bg-card border-t mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-foreground hover:opacity-80 transition-opacity">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              数码商城
            </Link>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              专注数码产品的在线商城，提供优质的数码产品和购物体验。
            </p>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{section.title}</h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted hover:text-accent transition-colors min-h-[44px] inline-flex items-center"
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
      <div className="border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-xs text-muted">
            © {currentYear} 数码商城 Digital Store. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
