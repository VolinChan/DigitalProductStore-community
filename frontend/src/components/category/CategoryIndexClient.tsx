'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { Category } from '@/types';
import apiClient from '@/lib/api';
import { CategoryIcon, getCategoryAncestorIconKeys, getCategoryAncestorImageURLs } from '@/components/category/CategoryIcon';

export default function CategoryIndexClient({ categories: initialCategories, clientFetch = false }: { categories: Category[]; clientFetch?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const [categories, setCategories] = useState(initialCategories);
  useEffect(() => {
    if (!clientFetch) return;
    void apiClient.get<{ data: { categories: Category[] } }>('/categories')
      .then((response) => setCategories(response.data.data?.categories || []))
      .catch(() => setCategories([]));
  }, [clientFetch]);
  return (
    <main className="store-container">
      <header className="max-w-2xl pb-8 sm:pb-10">
        <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('categories.title')}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--sf-muted)] sm:text-base">{t('categories.description')}</p>
      </header>

      {categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {categories.map((category) => {
            return (
              <Link key={category.id} href={`/${locale}/products?category_id=${category.id}`} className="group flex min-h-40 flex-col justify-between rounded-[18px] bg-white p-5 shadow-[0_2px_18px_rgba(21,48,66,0.05)] transition hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(21,48,66,0.1)]">
                <CategoryIcon imageUrl={category.image_asset?.url} ancestorImageUrls={getCategoryAncestorImageURLs(category, categories)} iconKey={category.icon_key} ancestorKeys={getCategoryAncestorIconKeys(category, categories)} label={`${category.name} category image`} className="flex h-20 w-full items-center justify-center rounded-2xl bg-[var(--sf-soft-blue)] p-2 text-xl text-[var(--sf-accent)] sm:h-24" />
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
