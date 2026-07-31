'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Drawer } from 'antd';
import { CloseOutlined, FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '@/components/product/ProductCard';
import ProductFilters, { type FilterValues } from '@/components/product/ProductFilters';
import ProductSort, { SORT_OPTIONS } from '@/components/product/ProductSort';
import apiClient from '@/lib/api';
import { trapFocusWithin } from '@/lib/focus';
import type { Category, Product } from '@/types';

const PAGE_SIZE = 12;

export default function SearchPage() { return <Suspense fallback={<SearchSkeleton />}><SearchContent /></Suspense>; }

function SearchContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get('q')?.trim() || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = params.get('sort') || 'newest';
  const filters = useMemo<FilterValues>(() => ({ category_id: params.get('category_id') ? Number(params.get('category_id')) : undefined, min_price: params.get('min_price') ? Number(params.get('min_price')) : undefined, max_price: params.get('max_price') ? Number(params.get('max_price')) : undefined }), [params]);
  const sortOption = useMemo(() => SORT_OPTIONS.find(item => item.value === sort) || SORT_OPTIONS[0], [sort]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(Boolean(query));
  const [failed, setFailed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [total, setTotal] = useState(0);

  const updateUrl = useCallback((nextPage: number, nextSort: string, nextFilters: FilterValues) => {
    const next = new URLSearchParams({ q: query });
    if (nextPage > 1) next.set('page', String(nextPage));
    if (nextSort !== 'newest') next.set('sort', nextSort);
    if (nextFilters.category_id) next.set('category_id', String(nextFilters.category_id));
    if (nextFilters.min_price !== undefined) next.set('min_price', String(nextFilters.min_price));
    if (nextFilters.max_price !== undefined) next.set('max_price', String(nextFilters.max_price));
    router.push(`/${locale}/products/search?${next.toString()}`, { scroll: false });
  }, [locale, query, router]);

  useEffect(() => { apiClient.get<{ data: { categories: Category[] } }>('/categories').then(response => setCategories(response.data.data?.categories || [])).catch(() => setCategories([])); }, []);

  const runSearch = useCallback(async () => {
    if (!query) { setProducts([]); setTotal(0); setLoading(false); setFailed(false); return; }
    setLoading(true); setFailed(false);
    try {
      const response = await apiClient.get<{ data: { products: Product[]; total: number } }>('/products/search', { params: { q: query, page, page_size: PAGE_SIZE, sort_by: sortOption.sort_by, sort_order: sortOption.sort_order, ...filters } });
      const results = response.data.data?.products || [];
      setProducts(results); setTotal(response.data.data?.total ?? results.length);
    } catch { setProducts([]); setTotal(0); setFailed(true); }
    finally { setLoading(false); }
  }, [filters, page, query, sortOption]);
  useEffect(() => { void runSearch(); }, [runSearch]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = Object.values(filters).filter(value => value !== undefined).length;
  const applyFilters = (next: FilterValues) => { setDrawerOpen(false); updateUrl(1, sort, next); };

  return (
    <main className="store-container">
      <header className="mb-8 border-b border-[var(--sf-line)] pb-6"><p className="flex items-center gap-2 text-xs font-extrabold uppercase text-[var(--sf-accent)]"><SearchOutlined />{t('products.searchTitle')}</p><h1 className="mt-2 break-words text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{query ? t('products.searchResultsFor', { query }) : t('products.enterSearchTerm')}</h1>{!loading && query && !failed && <p className="mt-2 text-sm text-[var(--sf-muted)]">{t('products.searchResultCount', { count: total })}</p>}
        {query && <div className="mt-5 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setDrawerOpen(true)} className="relative flex min-h-11 items-center gap-2 rounded-full bg-[var(--sf-soft)] px-4 text-sm font-bold text-[var(--sf-ink)] lg:hidden"><FilterOutlined />{t('products.filter')}{activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-warm)] px-1 text-[10px] text-white">{activeFilterCount}</span>}</button><ProductSort value={sort} onChange={next => updateUrl(1, next, filters)} /><Link href={`/${locale}/products`} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-[var(--sf-muted)] hover:text-[var(--sf-accent)]"><CloseOutlined />{t('products.clearSearch')}</Link></div>}
      </header>

      {!query ? <EmptySearch query="" locale={locale} /> : <div className="flex gap-8"><aside className="hidden w-60 shrink-0 lg:block" aria-label={t('products.filter')}><div className="sticky top-28"><ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} /></div></aside><div className="min-w-0 flex-1">{loading ? <SearchSkeleton /> : failed ? <div className="py-16 text-center"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('common.error')}</h2><button type="button" onClick={runSearch} className="sf-button-primary mt-6"><ReloadOutlined />{t('common.retry')}</button></div> : products.length > 0 ? <><div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">{products.map(product => <ProductCard key={product.id} product={product} highlightQuery={query} />)}</div>{pages > 1 && <nav className="mt-12 flex items-center justify-center gap-3" aria-label={t('products.pageInfo', { current: page, total: pages })}><button type="button" disabled={page === 1} onClick={() => updateUrl(page - 1, sort, filters)} className="sf-button-secondary disabled:opacity-40">{t('products.prevPage')}</button><span className="text-sm font-semibold text-[var(--sf-muted)]">{t('products.pageInfo', { current: page, total: pages })}</span><button type="button" disabled={page === pages} onClick={() => updateUrl(page + 1, sort, filters)} className="sf-button-secondary disabled:opacity-40">{t('products.nextPage')}</button></nav>}</> : <EmptySearch query={query} locale={locale} />}</div></div>}

      <Drawer title={t('products.filter')} placement="bottom" className="storefront" height="min(86vh, 720px)" open={drawerOpen} onClose={() => setDrawerOpen(false)} onKeyDown={trapFocusWithin} styles={{ body: { paddingBottom: 'max(24px, env(safe-area-inset-bottom))' } }}><ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} /></Drawer>
    </main>
  );
}

function EmptySearch({ query, locale }: { query: string; locale: string }) { const t = useTranslations(); return <div className="rounded-[22px] bg-white px-5 py-14 text-center"><SearchOutlined className="text-4xl text-[var(--sf-accent)]" /><h2 className="mt-4 text-xl font-black text-[var(--sf-ink)]">{query ? t('products.searchNoResults', { query }) : t('products.searchPrompt')}</h2>{query && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--sf-muted)]">{t('products.searchSuggestion')}</p>}<Link href={`/${locale}/products`} className="sf-button-primary mt-6">{t('products.browseAll')}</Link></div>; }
function SearchSkeleton() { return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-[18px] bg-[#edf0ee]" />)}</div>; }
