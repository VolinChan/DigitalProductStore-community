'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Category } from '@/types';
import apiClient from '@/lib/api';
import { buildPublicCategoryTree } from '@/lib/category-tree';
import { getCategoryAncestorIconKeys, getCategoryAncestorImageURLs } from '@/components/category/CategoryIcon';
import CategoryTile from './CategoryTile';

export default function CategoryIndexClient({ categories: initialCategories, clientFetch = false }: { categories: Category[]; clientFetch?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const [categories, setCategories] = useState(initialCategories);
  const roots = buildPublicCategoryTree(categories);
  useEffect(() => {
    if (!clientFetch) return;
    void apiClient.get<{ data: { categories: Category[] } }>('/categories')
      .then((response) => setCategories(response.data.data?.categories || []))
      .catch(() => setCategories([]));
  }, [clientFetch]);
  return (
    <main className="bg-[var(--sf-catalog-bg)]">
      <div className="store-container">
        <header className="max-w-2xl pb-8 sm:pb-10">
          <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('categories.title')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--sf-muted)] sm:text-base">{t('categories.description')}</p>
        </header>

        {roots.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {roots.map(category => (
              <CategoryTile
                key={category.id}
                href={`/${locale}/products?category_id=${category.id}`}
                label={category.name}
                imageLabel={`${category.name} category image`}
                imageUrl={category.image_asset?.url}
                ancestorImageUrls={getCategoryAncestorImageURLs(category, categories)}
                iconKey={category.icon_key}
                ancestorKeys={getCategoryAncestorIconKeys(category, categories)}
                countLabel={typeof category.product_count === 'number' ? t('categories.productCount', { count: category.product_count }) : undefined}
                size="directory"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white px-5 py-14 text-center text-sm text-[var(--sf-muted)]">{t('categories.empty')}</div>
        )}
      </div>
    </main>
  );
}
