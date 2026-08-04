import 'server-only';

import { cache } from 'react';
import type { Announcement, Banner, Category, Product } from '@/types';
import { getSiteConfig } from '@/lib/seo/site-config';

interface APIEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
}

export interface PublicProductList {
  products: Product[];
  total: number;
  page: number;
  page_size: number;
}

export interface SEOIndexProduct {
  product_id: number;
  slug: string;
  updated_at: string;
  available_locales: Array<'es-CL' | 'en'>;
}

export interface SEOIndexResponse {
  products: SEOIndexProduct[];
  total: number;
  page: number;
  page_size: number;
}

export interface ResolvedProductReference {
  product_id: number;
  current_slug: string;
  match: 'legacy_id' | 'historical_slug' | 'current_slug';
}

export class CatalogNotFoundError extends Error {}

async function fetchCatalog<T>(path: string, tags: string[]): Promise<T> {
  const config = getSiteConfig();
  const response = await fetch(`${config.internalApiBaseUrl}/api/v1${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: config.revalidateSeconds, tags },
  });
  if (response.status === 404) throw new CatalogNotFoundError(path);
  if (!response.ok) throw new Error(`Catalog API request failed (${response.status})`);
  const envelope = await response.json() as APIEnvelope<T>;
  if (!envelope.success || envelope.data === undefined) {
    throw new Error(envelope.error?.message || 'Catalog API returned an invalid response');
  }
  return envelope.data;
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    skus: product.skus?.map((sku) => ({ ...sku, price: Number(sku.price) })),
  };
}

export const getPublicProductBySlug = cache(async (slug: string): Promise<Product> => {
  const product = await fetchCatalog<Product>(`/products/slug/${encodeURIComponent(slug)}`, [`product:${slug}`, 'catalog-products']);
  return normalizeProduct(product);
});

export const resolvePublicProductReference = cache(async (ref: string): Promise<ResolvedProductReference> => (
  fetchCatalog<ResolvedProductReference>(`/products/resolve/${encodeURIComponent(ref)}`, ['catalog-products'])
));

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
}

export const getPublicProducts = cache(async (query: ProductListQuery = {}): Promise<PublicProductList> => {
  const params = new URLSearchParams({
    page: String(query.page || 1),
    page_size: String(query.pageSize || 12),
  });
  if (query.sortBy) params.set('sort_by', query.sortBy);
  if (query.sortOrder) params.set('sort_order', query.sortOrder);
  if (query.categoryId) params.set('category_id', String(query.categoryId));
  if (query.minPrice !== undefined) params.set('min_price', String(query.minPrice));
  if (query.maxPrice !== undefined) params.set('max_price', String(query.maxPrice));
  const result = await fetchCatalog<PublicProductList>(`/products?${params}`, ['catalog-products']);
  return { ...result, products: (result.products || []).map(normalizeProduct) };
});

export const getPublicCategories = cache(async (): Promise<Category[]> => {
  const result = await fetchCatalog<{ categories: Category[] }>('/categories', ['catalog-categories']);
  return result.categories || [];
});

export const getActiveBanners = cache(async (): Promise<Banner[]> => {
  const result = await fetchCatalog<{ banners: Banner[] }>('/banners', ['storefront-content']);
  return result.banners || [];
});

export const getActiveAnnouncements = cache(async (): Promise<Announcement[]> => {
  const result = await fetchCatalog<{ announcements: Announcement[] }>('/announcements', ['storefront-content']);
  return result.announcements || [];
});

export async function getSEOIndex(page = 1, pageSize = 1000): Promise<SEOIndexResponse> {
  return fetchCatalog<SEOIndexResponse>(`/catalog/seo-index?page=${page}&page_size=${pageSize}`, ['catalog-seo-index']);
}
