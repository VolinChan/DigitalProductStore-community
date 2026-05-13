'use client';

import React, { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Spin, Empty, Pagination, Button, Drawer, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import ProductCard from '@/components/product/ProductCard';
import ProductFilters, { FilterValues } from '@/components/product/ProductFilters';
import ProductSort, { SORT_OPTIONS } from '@/components/product/ProductSort';
import apiClient from '@/lib/api';
import type { Product, Category, PaginationMeta } from '@/types';

const { Text } = Typography;

const PAGE_SIZE = 12;

interface ProductListResponse {
  data: {
    products: Product[];
    total: number;
    page: number;
    page_size: number;
  };
}

/**
 * Product list page with filtering, sorting, and pagination.
 * Requirements: 5.1-5.6 (product display), 22.1-22.7 (search and filter)
 *
 * Features:
 * - Responsive product grid using ProductCard component
 * - Sidebar filters (category, price range) on desktop, drawer on mobile
 * - Sort dropdown (price asc/desc, name, newest)
 * - Pagination at the bottom
 * - Product count display (Requirement 22.5)
 * - URL query params for filters/sort/page (shareable URLs)
 */
export default function ProductListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Spin size="large" tip="加载中..." />
        </div>
      }
    >
      <ProductListContent />
    </Suspense>
  );
}

function ProductListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse initial state from URL params
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialSort = searchParams.get('sort') || 'newest';
  const initialCategoryId = searchParams.get('category_id')
    ? Number(searchParams.get('category_id'))
    : undefined;
  const initialMinPrice = searchParams.get('min_price')
    ? Number(searchParams.get('min_price'))
    : undefined;
  const initialMaxPrice = searchParams.get('max_price')
    ? Number(searchParams.get('max_price'))
    : undefined;

  // State
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

  // Resolve sort params from sort key
  const sortParams = useMemo(() => {
    const option = SORT_OPTIONS.find((o) => o.value === sortKey);
    return option || SORT_OPTIONS[0];
  }, [sortKey]);

  // Update URL with current state
  const updateURL = useCallback(
    (page: number, sort: string, filterValues: FilterValues) => {
      const params = new URLSearchParams();
      if (page > 1) params.set('page', String(page));
      if (sort !== 'newest') params.set('sort', sort);
      if (filterValues.category_id) params.set('category_id', String(filterValues.category_id));
      if (filterValues.min_price) params.set('min_price', String(filterValues.min_price));
      if (filterValues.max_price) params.set('max_price', String(filterValues.max_price));

      const queryString = params.toString();
      router.push(queryString ? `/products?${queryString}` : '/products', { scroll: false });
    },
    [router]
  );

  // Fetch products
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

  // Fetch categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await apiClient.get<{ data: { categories: Category[] } }>('/categories');
        setCategories(response.data.data?.categories || []);
      } catch {
        setCategories([]);
      }
    }
    loadCategories();
  }, []);

  // Fetch products when dependencies change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handlers
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
    const emptyFilters: FilterValues = {};
    setFilters(emptyFilters);
    setCurrentPage(1);
    updateURL(1, sortKey, emptyFilters);
    setDrawerOpen(false);
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.category_id !== undefined ||
    filters.min_price !== undefined ||
    filters.max_price !== undefined;

  // Filter sidebar content (shared between desktop sidebar and mobile drawer)
  const filterContent = (
    <ProductFilters
      categories={categories}
      initialValues={filters}
      onApply={handleFilterApply}
      onReset={handleFilterReset}
    />
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block w-64 flex-shrink-0" aria-label="商品筛选">
          <div className="sticky top-4 bg-white rounded-lg border border-gray-200 p-4">
            {filterContent}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar: Sort + Count + Mobile Filter Button */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {/* Mobile filter button */}
              <Button
                icon={<FilterOutlined />}
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden"
                type={hasActiveFilters ? 'primary' : 'default'}
                ghost={hasActiveFilters}
              >
                筛选
              </Button>

              {/* Product count (Requirement 22.5) */}
              <Text type="secondary" className="text-sm">
                共 <span className="font-medium text-gray-900">{total}</span> 件商品
              </Text>
            </div>

            {/* Sort dropdown */}
            <ProductSort value={sortKey} onChange={handleSortChange} />
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <Spin size="large" tip="加载中..." />
            </div>
          ) : products.length > 0 ? (
            <>
              {/* Requirement 5.5: Grid layout optimized for visual appeal */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex justify-center mt-8">
                  <Pagination
                    current={currentPage}
                    total={total}
                    pageSize={PAGE_SIZE}
                    onChange={handlePageChange}
                    showSizeChanger={false}
                    showQuickJumper={total > PAGE_SIZE * 5}
                    showTotal={(t) => `共 ${t} 件商品`}
                  />
                </div>
              )}
            </>
          ) : (
            <Empty
              description={hasActiveFilters ? '没有找到符合条件的商品' : '暂无商品'}
              className="py-16"
            >
              {hasActiveFilters && (
                <Button type="primary" onClick={handleFilterReset}>
                  清除筛选条件
                </Button>
              )}
            </Empty>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <Drawer
        title="筛选商品"
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={300}
        className="lg:hidden"
      >
        {filterContent}
      </Drawer>
    </main>
  );
}
