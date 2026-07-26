'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spin, Empty, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import Image from 'next/image';
import { Card, Tag } from 'antd';
import SearchHighlight from '@/components/product/SearchHighlight';
import apiClient from '@/lib/api';
import type { Product } from '@/types';

const { Title, Text } = Typography;

/**
 * Dedicated search results page.
 * Requirements: 22.1-22.7 (Search and filter functionality)
 *
 * Features:
 * - Reads search query from URL params (?q=...)
 * - Fetches results from GET /api/v1/products/search?q=...
 * - Displays results in a responsive grid
 * - Highlights search terms in product names and descriptions (Req 22.7)
 * - Shows total result count (Req 22.5)
 * - Handles empty results with suggestions
 * - Loading state
 */
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Spin size="large" tip="搜索中..." />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);

  const fetchSearchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setProducts([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get<{ data: { products: Product[]; total: number } }>('/products/search', {
        params: { q: searchQuery.trim() },
      });
      const resultList = response.data.data?.products || [];
      setProducts(resultList);
      setTotal(response.data.data?.total || resultList.length);
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    fetchSearchResults(query);
  }, [query, fetchSearchResults]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Search header */}
      <div className="mb-6">
        {query ? (
          <>
            <Title level={4} className="!mb-1">
              <SearchOutlined className="mr-2 text-gray-400" />
              搜索结果：&ldquo;{query}&rdquo;
            </Title>
            {/* Requirement 22.5: Display count of matching products */}
            {searched && !loading && (
              <Text type="secondary">
                共找到 <span className="font-medium text-gray-900">{total}</span> 件相关商品
              </Text>
            )}
          </>
        ) : (
          <Title level={4} className="!mb-1">
            <SearchOutlined className="mr-2 text-gray-400" />
            请输入搜索关键词
          </Title>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spin size="large" tip="搜索中..." />
        </div>
      )}

      {/* Results grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {products.map((product) => (
            <SearchResultCard key={product.id} product={product} query={query} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && products.length === 0 && query && (
        <Empty
          description={
            <div className="space-y-2">
              <p className="text-gray-600">
                没有找到与 &ldquo;{query}&rdquo; 相关的商品
              </p>
              <p className="text-sm text-gray-400">
                建议尝试其他关键词，或浏览全部商品
              </p>
            </div>
          }
          className="py-16"
        >
          <Link
            href="/products"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            浏览全部商品
          </Link>
        </Empty>
      )}

      {/* No query state */}
      {!loading && !query && (
        <Empty
          description={
            <p className="text-gray-500">请在搜索框中输入关键词来搜索商品</p>
          }
          className="py-16"
        />
      )}
    </main>
  );
}

/**
 * Search result card with highlighted search terms.
 * Requirement 22.7: Highlight search terms in product names and descriptions.
 */
function SearchResultCard({ product, query }: { product: Product; query: string }) {
  const primaryImage =
    product.images && product.images.length > 0
      ? product.images[0].thumbnail_url || product.images[0].image_url
      : '/placeholder-product.svg';

  const startingPrice = getStartingPrice(product);
  const isOutOfStock = checkOutOfStock(product);

  return (
    <Link href={`/products/${product.id}`} className="block group">
      <Card
        hoverable
        className="h-full overflow-hidden"
        cover={
          <div className="relative aspect-square overflow-hidden bg-gray-100">
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
            />
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Tag color="red" className="text-base px-3 py-1 font-medium">
                  已售罄
                </Tag>
              </div>
            )}
          </div>
        }
        styles={{ body: { padding: '12px 16px' } }}
      >
        {/* Product name with search term highlighting */}
        <h3 className="text-sm sm:text-base font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
          <SearchHighlight text={product.name} query={query} />
        </h3>

        {/* Description with search term highlighting */}
        {product.description && (
          <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mb-2">
            <SearchHighlight text={product.description} query={query} maxLength={80} />
          </p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1">
          {startingPrice !== null ? (
            <>
              <span className="text-xs text-gray-500">¥</span>
              <span className="text-lg font-bold text-red-500">
                {startingPrice.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 ml-1">起</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">暂无价格</span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function getStartingPrice(product: Product): number | null {
  if (!product.skus || product.skus.length === 0) return null;
  const activeSKUs = product.skus.filter((sku) => sku.is_active);
  if (activeSKUs.length === 0) return null;
  return Math.min(...activeSKUs.map((sku) => sku.price));
}

function checkOutOfStock(product: Product): boolean {
  if (!product.skus || product.skus.length === 0) return false;
  return product.skus.every((sku) => sku.inventory <= 0);
}
