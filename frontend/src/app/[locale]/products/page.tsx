'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '@/components/product/ProductCard';
import ProductFilters, { type FilterValues } from '@/components/product/ProductFilters';
import ProductSort, { SORT_OPTIONS } from '@/components/product/ProductSort';
import apiClient from '@/lib/api';
import { trapFocusWithin } from '@/lib/focus';
import type { Category, Product } from '@/types';

const PAGE_SIZE = 12;
interface ProductListResponse { data: { products: Product[]; total: number } }

export default function ProductListPage() {
  return <Suspense fallback={<ListSkeleton />}><ProductListContent /></Suspense>;
}

function ProductListContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const page = Number(searchParams.get('page')) || 1;
  const sort = searchParams.get('sort') || 'newest';
  const filters = useMemo<FilterValues>(() => ({
    category_id: searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined,
    min_price: searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined,
    max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
  }), [searchParams]);
  const sortOption = useMemo(() => SORT_OPTIONS.find((item) => item.value === sort) || SORT_OPTIONS[0], [sort]);

  const updateUrl = useCallback((nextPage: number, nextSort: string, nextFilters: FilterValues) => {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextSort !== 'newest') params.set('sort', nextSort);
    if (nextFilters.category_id) params.set('category_id', String(nextFilters.category_id));
    if (nextFilters.min_price !== undefined) params.set('min_price', String(nextFilters.min_price));
    if (nextFilters.max_price !== undefined) params.set('max_price', String(nextFilters.max_price));
    router.push(`/${locale}/products${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [locale, router]);

  useEffect(() => {
    apiClient.get<{ data: { categories: Category[] } }>('/categories')
      .then((response) => setCategories(response.data.data?.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const loadProducts = useCallback(() => {
    setLoading(true);
    setFailed(false);
    apiClient.get<ProductListResponse>('/products', { params: { page, page_size: PAGE_SIZE, sort_by: sortOption.sort_by, sort_order: sortOption.sort_order, ...filters } })
      .then((response) => { setProducts(response.data.data?.products || []); setTotal(response.data.data?.total || 0); })
      .catch(() => { setProducts([]); setTotal(0); setFailed(true); })
      .finally(() => setLoading(false));
  }, [filters, page, sortOption]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const applyFilters = (next: FilterValues) => { setDrawerOpen(false); updateUrl(1, sort, next); };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined).length;

  return (
    <main className="store-container">
      <header className="mb-7 border-b border-[var(--sf-line)] pb-6">
        <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('products.title')}</h1>
            <p className="mt-2 text-sm text-[var(--sf-muted)]">{total} {t('products.results')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label={t('products.filter')} onClick={() => setDrawerOpen(true)} className="relative flex min-h-11 items-center gap-2 rounded-full bg-[var(--sf-soft)] px-4 text-sm font-bold text-[var(--sf-ink)] lg:hidden">
              <FilterOutlined />{t('products.filter')}
              {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-warm)] px-1 text-[10px] text-white">{activeFilterCount}</span>}
            </button>
            <ProductSort value={sort} onChange={(next) => updateUrl(1, next, filters)} />
          </div>
        </div>
      </header>

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block" aria-label={t('products.filter')}>
          <div className="sticky top-28"><ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} /></div>
        </aside>

        <div className="min-w-0 flex-1">
          {loading ? <ListSkeleton /> : failed ? (
            <div className="py-16 text-center"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('common.error')}</h2><button type="button" onClick={loadProducts} className="sf-button-primary mt-6">{t('common.retry')}</button></div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              {pages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-3" aria-label={t('products.pageInfo', { current: page, total: pages })}>
                  <button type="button" disabled={page === 1} onClick={() => updateUrl(page - 1, sort, filters)} className="sf-button-secondary disabled:opacity-40">{t('products.prevPage')}</button>
                  <span className="text-sm font-semibold text-[var(--sf-muted)]">{t('products.pageInfo', { current: page, total: pages })}</span>
                  <button type="button" disabled={page === pages} onClick={() => updateUrl(page + 1, sort, filters)} className="sf-button-secondary disabled:opacity-40">{t('products.nextPage')}</button>
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-[22px] bg-white px-5 py-14 text-center">
              <h2 className="text-xl font-black text-[var(--sf-ink)]">{t('products.noResults')}</h2>
              <p className="mt-2 text-sm text-[var(--sf-muted)]">{t('emptyState.defaultDesc')}</p>
              {activeFilterCount > 0 && <button type="button" onClick={() => applyFilters({})} className="sf-button-primary mt-6">{t('products.clearFilters')}</button>}
            </div>
          )}
        </div>
      </div>

      <Drawer title={t('products.filter')} placement="bottom" className="storefront" height="min(86vh, 720px)" open={drawerOpen} onClose={() => setDrawerOpen(false)} onKeyDown={trapFocusWithin} styles={{ body: { paddingBottom: 'max(24px, env(safe-area-inset-bottom))' } }}>
        <ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} />
      </Drawer>
    </main>
  );
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-[18px] bg-[#edf0ee]" />)}
    </div>
  );
}
