'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiOutlined, AppstoreOutlined, AudioOutlined, DesktopOutlined, HddOutlined, ThunderboltOutlined, WifiOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import type { Category } from '@/types';

interface CategoriesResponse { data: { categories: Category[] } }

const icons = [ApiOutlined, ThunderboltOutlined, DesktopOutlined, HddOutlined, WifiOutlined, AudioOutlined, AppstoreOutlined];

export default function CategoriesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<CategoriesResponse>('/categories')
      .then((response) => setCategories(response.data.data?.categories || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="store-container">
      <header className="max-w-2xl pb-8 sm:pb-10">
        <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('categories.title')}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--sf-muted)] sm:text-base">{t('categories.description')}</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-[18px] bg-white" />)}
        </div>
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {categories.map((category, index) => {
            const Icon = icons[index % icons.length];
            return (
              <Link key={category.id} href={`/${locale}/products?category_id=${category.id}`} className="group flex min-h-40 flex-col justify-between rounded-[18px] bg-white p-5 shadow-[0_2px_18px_rgba(21,48,66,0.05)] transition hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(21,48,66,0.1)]">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--sf-soft-blue)] text-xl text-[var(--sf-accent)]"><Icon /></span>
                <div className="mt-6">
                  <h2 className="break-words text-sm font-black leading-5 text-[var(--sf-ink)] group-hover:text-[var(--sf-accent)] sm:text-base">{category.name}</h2>
                  {typeof category.product_count === 'number' && <p className="mt-1 text-xs text-[var(--sf-muted)]">{t('categories.productCount', { count: category.product_count })}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white px-5 py-14 text-center text-sm text-[var(--sf-muted)]">{t('categories.empty')}</div>
      )}
    </main>
  );
}
