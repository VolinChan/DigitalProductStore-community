'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '@/components/product/ProductCard';
import ProductFilters, { type FilterValues } from '@/components/product/ProductFilters';
import ProductSort, { SORT_OPTIONS } from '@/components/product/ProductSort';
import EmptyState from '@/components/EmptyState';
import apiClient from '@/lib/api';
import type { Category, Product } from '@/types';

const { Text } = Typography;
const PAGE_SIZE = 12;
interface ProductListResponse { data: { products: Product[]; total: number } }

export default function ProductListPage() {
  return <Suspense><ProductListContent /></Suspense>;
}

function ProductListContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [filters, setFilters] = useState<FilterValues>({
    category_id: searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined,
    min_price: searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined,
    max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
  });
  const sortOption = useMemo(() => SORT_OPTIONS.find((item) => item.value === sort) || SORT_OPTIONS[0], [sort]);

  const updateUrl = useCallback((nextPage: number, nextSort: string, nextFilters: FilterValues) => {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextSort !== 'newest') params.set('sort', nextSort);
    if (nextFilters.category_id) params.set('category_id', String(nextFilters.category_id));
    if (nextFilters.min_price !== undefined) params.set('min_price', String(nextFilters.min_price));
    if (nextFilters.max_price !== undefined) params.set('max_price', String(nextFilters.max_price));
    router.push(`/${locale}/products${params.size ? `?${params}` : ''}`, { scroll: false });
  }, [locale, router]);

  useEffect(() => {
    apiClient.get<{ data: { categories: Category[] } }>('/categories')
      .then((res) => setCategories(res.data.data?.categories || []))
      .catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    setLoading(true);
    apiClient.get<ProductListResponse>('/products', { params: {
      page, page_size: PAGE_SIZE, sort_by: sortOption.sort_by, sort_order: sortOption.sort_order, ...filters,
    } }).then((res) => {
      setProducts(res.data.data?.products || []); setTotal(res.data.data?.total || 0);
    }).catch(() => { setProducts([]); setTotal(0); }).finally(() => setLoading(false));
  }, [filters, page, sortOption]);

  const applyFilters = (next: FilterValues) => { setFilters(next); setPage(1); setDrawerOpen(false); updateUrl(1, sort, next); };
  const changeSort = (next: string) => { setSort(next); setPage(1); updateUrl(1, next, filters); };
  const changePage = (next: number) => { setPage(next); updateUrl(next, sort, filters); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const hasFilters = Object.values(filters).some((value) => value !== undefined);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <main className="store-container" id="main-content">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('products.title')}</h1>
      <div className="flex items-center gap-3">
        <Button icon={<FilterOutlined />} onClick={() => setDrawerOpen(true)} className="sm:hidden" type={hasFilters ? 'primary' : 'default'}>{t('products.filter')}</Button>
        <Text type="secondary">{total} {t('products.results')}</Text>
        <ProductSort value={sort} onChange={changeSort} />
      </div>
    </div>
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="hidden lg:block w-64 shrink-0" aria-label={t('products.filter')}>
        <div className="sticky top-24 bg-card rounded-xl border shadow-card p-5"><h2 className="text-sm font-semibold mb-4"><FilterOutlined /> {t('products.filter')}</h2>
          <ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} />
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {loading ? <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] store-skeleton rounded-xl" />)}</div>
          : products.length ? <><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            {pages > 1 && <nav aria-label={t('products.pageInfo', { current: page, total: pages })} className="flex justify-center items-center gap-3 mt-10"><Button disabled={page === 1} onClick={() => changePage(page - 1)}>{t('products.prevPage')}</Button><Text>{t('products.pageInfo', { current: page, total: pages })}</Text><Button disabled={page === pages} onClick={() => changePage(page + 1)}>{t('products.nextPage')}</Button></nav>}</>
          : <EmptyState title={hasFilters ? t('products.noResults') : t('emptyState.defaultTitle')} description={t('emptyState.defaultDesc')} actionLabel={hasFilters ? t('common.retry') : undefined} onAction={() => applyFilters({})} />}
      </div>
    </div>
    <Drawer title={t('products.filter')} placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} size={300}><ProductFilters categories={categories} initialValues={filters} onApply={applyFilters} onReset={() => applyFilters({})} /></Drawer>
  </main>;
}
