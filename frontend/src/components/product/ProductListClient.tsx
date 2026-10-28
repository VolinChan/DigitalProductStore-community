'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';
import ProductFilters, { type FilterValues } from '@/components/product/ProductFilters';
import ProductSort, { RECOMMENDED_SORT, SORT_OPTIONS } from '@/components/product/ProductSort';
import apiClient from '@/lib/api';
import { trapFocusWithin } from '@/lib/focus';
import type { Category, Product } from '@/types';

const PAGE_SIZE = 12;
interface ProductListResponse { data: { products: Product[]; total: number } }

export interface ProductListClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
  initialTotal: number;
  clientFetch?: boolean;
  recommendedOnly?: boolean;
}

export default function ProductListClient(props: ProductListClientProps) {
  return <Suspense fallback={<ListSkeleton />}><ProductListContent {...props} /></Suspense>;
}

function ProductListContent({ initialProducts, initialCategories, initialTotal, clientFetch = false, recommendedOnly = false }: ProductListClientProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(clientFetch);
  const [failed, setFailed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const initialRender = useRef(!clientFetch);
  const requestSequence = useRef(0);
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const defaultSort = recommendedOnly ? 'recommended' : 'newest';
  const sort = searchParams.get('sort') || defaultSort;
  const filters = useMemo<FilterValues>(() => ({
    category_id: searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined,
    min_price: searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined,
    max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
  }), [searchParams]);
  const sortOption = useMemo(() => SORT_OPTIONS.find((item) => item.value === sort) || (recommendedOnly ? RECOMMENDED_SORT : SORT_OPTIONS[0]), [recommendedOnly, sort]);

  const listingUrl = useCallback((nextPage: number, nextSort: string, nextFilters: FilterValues) => {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextSort !== defaultSort) params.set('sort', nextSort);
    if (nextFilters.category_id) params.set('category_id', String(nextFilters.category_id));
    if (nextFilters.min_price !== undefined) params.set('min_price', String(nextFilters.min_price));
    if (nextFilters.max_price !== undefined) params.set('max_price', String(nextFilters.max_price));
    return `/${locale}/${recommendedOnly ? 'recommended' : 'products'}${params.size ? `?${params.toString()}` : ''}`;
  }, [defaultSort, locale, recommendedOnly]);
  const updateUrl = (nextPage: number, nextSort: string, nextFilters: FilterValues) => router.push(listingUrl(nextPage, nextSort, nextFilters), { scroll: false });

  useEffect(() => {
    if (!clientFetch) return;
    void apiClient.get<{ data: { categories: Category[] } }>('/categories')
      .then((response) => setCategories(response.data.data?.categories || []))
      .catch(() => setCategories([]));
  }, [clientFetch]);

  const loadProducts = useCallback(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setFailed(false);
    apiClient.get<ProductListResponse>('/products', { params: { page, page_size: PAGE_SIZE, sort_by: sortOption.sort_by, sort_order: sortOption.sort_order, ...(recommendedOnly ? { is_recommended: true } : {}), ...filters } })
      .then((response) => { if (sequence === requestSequence.current) { setProducts(response.data.data?.products || []); setTotal(response.data.data?.total || 0); } })
      .catch(() => { if (sequence === requestSequence.current) { setProducts([]); setTotal(0); setFailed(true); } })
      .finally(() => { if (sequence === requestSequence.current) setLoading(false); });
  }, [filters, page, recommendedOnly, sortOption]);
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    loadProducts();
  }, [loadProducts]);

  const applyFilters = (next: FilterValues) => { setDrawerOpen(false); updateUrl(1, sort, next); };
  const selectCategory = (id: number | undefined) => applyFilters({ ...filters, category_id: id });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined).length;

  return (
    <main className="store-container">
      <header className="mb-7 border-b border-[var(--sf-line)] pb-6">
        <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t(recommendedOnly ? 'products.recommendedTitle' : 'products.title')}</h1>
            {recommendedOnly && <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--sf-subtle)]">{t('products.recommendedDescription')}</p>}
            <p className="mt-2 text-sm text-[var(--sf-muted)]">{total} {t('products.results')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label={t('products.filter')} onClick={() => setDrawerOpen(true)} className="relative flex min-h-11 items-center gap-2 rounded-full bg-[var(--sf-soft)] px-4 text-sm font-bold text-[var(--sf-ink)] lg:hidden">
              <FilterOutlined />{t('products.filter')}
              {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-warm)] px-1 text-[10px] text-white">{activeFilterCount}</span>}
            </button>
            <ProductSort value={sort} onChange={(next) => updateUrl(1, next, filters)} recommendedOnly={recommendedOnly} />
          </div>
        </div>
      </header>

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block" aria-label={t('products.filter')}>
          <div className="sticky top-28"><ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} onCategoryChange={selectCategory} /></div>
        </aside>

        <div className="min-w-0 flex-1">
          {loading ? <ListSkeleton /> : failed ? (
            <div className="py-16 text-center"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('common.error')}</h2><button type="button" onClick={loadProducts} className="sf-button-primary mt-6">{t('common.retry')}</button></div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => <ProductCard key={product.id} product={product} showRecommendation={recommendedOnly} />)}
              </div>
              {pages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-3" aria-label={t('products.pageInfo', { current: page, total: pages })}>
                  <Link href={listingUrl(Math.max(1, page - 1), sort, filters)} scroll={false} rel="prev" aria-disabled={page === 1 || undefined} tabIndex={page === 1 ? -1 : undefined} onClick={event => { if (page === 1) event.preventDefault(); }} className="sf-button-secondary aria-disabled:opacity-40">{t('products.prevPage')}</Link>
                  <span className="text-sm font-semibold text-[var(--sf-muted)]">{t('products.pageInfo', { current: page, total: pages })}</span>
                  <Link href={listingUrl(Math.min(pages, page + 1), sort, filters)} scroll={false} rel="next" aria-disabled={page >= pages || undefined} tabIndex={page >= pages ? -1 : undefined} onClick={event => { if (page >= pages) event.preventDefault(); }} className="sf-button-secondary aria-disabled:opacity-40">{t('products.nextPage')}</Link>
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-[22px] bg-white px-5 py-14 text-center">
              <h2 className="text-xl font-black text-[var(--sf-ink)]">{t(recommendedOnly && activeFilterCount === 0 ? 'products.noRecommendations' : 'products.noResults')}</h2>
              <p className="mt-2 text-sm text-[var(--sf-muted)]">{t(recommendedOnly ? 'products.recommendedEmptyDescription' : 'emptyState.defaultDesc')}</p>
              {activeFilterCount > 0 && <button type="button" onClick={() => applyFilters({})} className="sf-button-primary mt-6">{t('products.clearFilters')}</button>}
              {recommendedOnly && activeFilterCount === 0 && <Link href={`/${locale}/products`} className="sf-button-primary mt-6">{t('products.browseAll')}</Link>}
            </div>
          )}
        </div>
      </div>

      <Drawer title={t('products.filter')} placement="bottom" className="storefront" height="min(86vh, 720px)" open={drawerOpen} onClose={() => setDrawerOpen(false)} onKeyDown={trapFocusWithin} styles={{ body: { paddingBottom: 'max(24px, env(safe-area-inset-bottom))' } }}>
        <ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} onCategoryChange={selectCategory} />
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
