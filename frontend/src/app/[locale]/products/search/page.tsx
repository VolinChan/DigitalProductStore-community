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
import { getProductPrimaryImage, getProductSummary } from '@/lib/catalog';
import { useLocale, useTranslations } from 'next-intl';

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
        <SearchFallback />
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchFallback() {
  const t = useTranslations();
  return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" tip={t('products.searching')} /></div>;
}

function SearchContent() {
  const t = useTranslations();
  const locale = useLocale();
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
              {t('products.searchResultsFor', { query })}
            </Title>
            {/* Requirement 22.5: Display count of matching products */}
            {searched && !loading && (
              <Text type="secondary">
                {t('products.searchResultCount', { count: total })}
              </Text>
            )}
          </>
        ) : (
          <Title level={4} className="!mb-1">
            <SearchOutlined className="mr-2 text-gray-400" />
            {t('products.enterSearchTerm')}
          </Title>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spin size="large" tip={t('products.searching')} />
        </div>
      )}

      {/* Results grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {products.map((product) => (
            <SearchResultCard key={product.id} product={product} query={query} locale={locale} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && products.length === 0 && query && (
        <Empty
          description={
            <div className="space-y-2">
              <p className="text-gray-600">
                {t('products.searchNoResults', { query })}
              </p>
              <p className="text-sm text-gray-400">
                {t('products.searchSuggestion')}
              </p>
            </div>
          }
          className="py-16"
        >
          <Link
            href={`/${locale}/products`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('products.browseAll')}
          </Link>
        </Empty>
      )}

      {/* No query state */}
      {!loading && !query && (
        <Empty
          description={
            <p className="text-gray-500">{t('products.searchPrompt')}</p>
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
function SearchResultCard({ product, query, locale }: { product: Product; query: string; locale: string }) {
  const t = useTranslations();
  const primaryImage = getProductPrimaryImage(product) || '/placeholder-product.svg';
  const summary = getProductSummary(product);

  const startingPrice = getStartingPrice(product);
  const isOutOfStock = checkOutOfStock(product);

  return (
    <Link href={`/${locale}/products/${product.id}`} className="block group">
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
                  {t('common.soldOut')}
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
        {summary && (
          <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mb-2">
            <SearchHighlight text={summary} query={query} maxLength={80} />
          </p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1">
          {startingPrice !== null ? (
            <>
              <span className="text-lg font-bold text-red-500">{new Intl.NumberFormat(locale, { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(startingPrice)}</span>
              <span className="text-xs text-gray-400 ml-1">{t('products.from')}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">{t('products.noPrice')}</span>
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
