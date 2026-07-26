'use client';

import React, { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Spin, Button, Drawer, Typography } from 'antd';
import { FilterOutlined, SortAscendingOutlined } from '@ant-design/icons';
import ProductCard from '@/components/product/ProductCard';
import ProductFilters, { FilterValues } from '@/components/product/ProductFilters';
import ProductSort, { SORT_OPTIONS } from '@/components/product/ProductSort';
import EmptyState from '@/components/EmptyState';
import { PageSkeleton } from '@/components/Skeleton';
import apiClient from '@/lib/api';
import type { Product, Category } from '@/types';

const { Text } = Typography;

const PAGE_SIZE = 12;

interface ProductListResponse {
  data: { products: Product[]; total: number; page: number; page_size: number };
}

/**
 * Modern product listing page.
 * Requirements: 5.1-5.6, 22.1-22.7, 42.3
 */
export default function ProductListPage() {
  return (
    <Suspense fallback={<PageSkeletonFallback />}>
      <ProductListContent />
    </Suspense>
  );
}

function PageSkeletonFallback() {
  return (
    <main className="store-container">
      <div className="animate-fade-in-up">
        <div className="h-8 w-48 store-skeleton mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    </main>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="aspect-[4/3] w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-5 w-1/3 mt-2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}

function ProductListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPage = Number(searchParams.get('page')) || 1;
  const initialSort = searchParams.get('sort') || 'newest';
  const initialCategoryId = searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined;
  const initialMinPrice = searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined;
  const initialMaxPrice = searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [sortKey, setSortKey] = useState(initialSort);
  const [filters, setFilters] = useState<FilterValues>({
    category_id: initialCategoryId,
    min_price: initialMinPrice,
    max_price: initialMaxPrice,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sortParams = useMemo(() => {
    return SORT_OPTIONS.find((o) => o.value === sortKey) || SORT_OPTIONS[0];
  }, [sortKey]);

  const updateURL = useCallback(
    (page: number, sort: string, filterValues: FilterValues) => {
      const params = new URLSearchParams();
      if (page > 1) params.set('page', String(page));
      if (sort !== 'newest') params.set('sort', sort);
      if (filterValues.category_id) params.set('category_id', String(filterValues.category_id));
      if (filterValues.min_price) params.set('min_price', String(filterValues.min_price));
      if (filterValues.max_price) params.set('max_price', String(filterValues.max_price));
      router.push(params.toString() ? `/products?${params.toString()}` : '/products', { scroll: false });
    },
    [router]
  );

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        page_size: PAGE_SIZE,
        sort_by: sortParams.sort_by,
        sort_order: sortParams.sort_order,
      };
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.min_price !== undefined) params.min_price = filters.min_price;
      if (filters.max_price !== undefined) params.max_price = filters.max_price;

      const response = await apiClient.get<ProductListResponse>('/products', { params });
      setProducts(response.data.data?.products || []);
      setTotal(response.data.data?.total || 0);
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortParams, filters]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await apiClient.get<{ data: { categories: Category[] } }>('/categories');
        setCategories(response.data.data?.categories || []);
      } catch { /* noop */ }
    }
    loadCategories();
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateURL(page, sortKey, filters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (value: string) => {
    setSortKey(value);
    setCurrentPage(1);
    updateURL(1, value, filters);
  };

  const handleFilterApply = (values: FilterValues) => {
    setFilters(values);
    setCurrentPage(1);
    updateURL(1, sortKey, values);
    setDrawerOpen(false);
  };

  const handleFilterReset = () => {
    setFilters({});
    setCurrentPage(1);
    updateURL(1, sortKey, {});
    setDrawerOpen(false);
  };

  const hasActiveFilters = filters.category_id !== undefined || filters.min_price !== undefined || filters.max_price !== undefined;

  return (
    <main className="store-container" id="main-content">
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold tracking-tight">全部商品</h1>
          <div className="flex items-center gap-3">
            <Button
              icon={<FilterOutlined />}
              onClick={() => setDrawerOpen(true)}
              className="sm:hidden"
              type={hasActiveFilters ? 'primary' : 'default'}
              ghost={hasActiveFilters}
            >
              筛选
            </Button>
            <Text type="secondary" className="text-sm">
              共 <span className="font-medium text-foreground">{total}</span> 件商品
            </Text>
            <ProductSort value={sortKey} onChange={handleSortChange} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0" aria-label="商品筛选">
            <div className="sticky top-24 bg-card rounded-xl border shadow-card p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <FilterOutlined /> 筛选条件
              </h2>
              <ProductFilters
                categories={categories}
                initialValues={filters}
                onApply={handleFilterApply}
                onReset={handleFilterReset}
              />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {total > PAGE_SIZE && (
                  <div className="flex justify-center mt-10">
                    <PaginationWrapper current={currentPage} total={total} pageSize={PAGE_SIZE} onChange={handlePageChange} />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title={hasActiveFilters ? '没有找到符合条件的商品' : '暂无商品'}
                description={hasActiveFilters ? '试试调整筛选条件' : '商品即将上架，敬请期待'}
                actionLabel={hasActiveFilters ? '清除筛选条件' : undefined}
                actionHref={hasActiveFilters ? '/products' : undefined}
                onAction={handleFilterReset}
              />
            )}
          </div>
        </div>

        {/* Mobile Drawer */}
        <Drawer
          title={
            <div className="flex items-center gap-2">
              <FilterOutlined /> 筛选商品
            </div>
          }
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={300}
          classNames={{ body: 'pt-4' }}
        >
          <ProductFilters categories={categories} initialValues={filters} onApply={handleFilterApply} onReset={handleFilterReset} />
        </Drawer>
      </div>
    </main>
  );
}

/* ─── Pagination wrapper ──────────────────────────────────────────── */

function PaginationWrapper({
  current,
  total,
  pageSize,
  onChange,
}: {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="分页导航" className="flex items-center gap-2">
      <button
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        上一页
      </button>
      <span className="text-sm text-muted px-2">
        第 {current} / {Math.ceil(total / pageSize) || 1} 页
      </span>
      <button
        disabled={current >= Math.ceil(total / pageSize)}
        onClick={() => onChange(current + 1)}
        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        下一页
      </button>
    </nav>
  );
}
