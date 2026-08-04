import type { Metadata } from 'next';

export type StorefrontLocale = 'es-CL' | 'en';
export const STOREFRONT_LOCALES = ['es-CL', 'en'] as const;
export const DEFAULT_INDEX_LOCALE: StorefrontLocale = 'es-CL';

export type IndexPolicy = 'index' | 'noindex' | 'redirect' | 'protected';

export interface RoutePolicy {
  route: string;
  policy: IndexPolicy;
  canonical: 'self' | 'clean-listing' | 'none' | 'current-product';
  sitemap: boolean;
}

// Executable route/index contract shared by metadata, sitemap, and tests.
export const ROUTE_INDEX_POLICY: readonly RoutePolicy[] = [
  { route: '/{locale}', policy: 'index', canonical: 'self', sitemap: true },
  { route: '/{locale}/products', policy: 'index', canonical: 'self', sitemap: true },
  { route: '/{locale}/products?page=N', policy: 'index', canonical: 'self', sitemap: false },
  { route: '/{locale}/products/{slug}', policy: 'index', canonical: 'self', sitemap: true },
  { route: '/{locale}/products/{numericId|historicalSlug}', policy: 'redirect', canonical: 'current-product', sitemap: false },
  { route: '/{locale}/categories', policy: 'index', canonical: 'self', sitemap: true },
  { route: '/{locale}/products?filter|sort|q', policy: 'noindex', canonical: 'clean-listing', sitemap: false },
  { route: '/{locale}/products/search', policy: 'noindex', canonical: 'clean-listing', sitemap: false },
  { route: '/{locale}/cart|checkout|auth|profile|orders|tracking|preview', policy: 'noindex', canonical: 'none', sitemap: false },
  { route: '/admin|api/private', policy: 'protected', canonical: 'none', sitemap: false },
] as const;

export const NOINDEX_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false, noimageindex: true },
};

export function isStorefrontLocale(value: string): value is StorefrontLocale {
  return STOREFRONT_LOCALES.includes(value as StorefrontLocale);
}

export function hasNonIndexableListingParameters(params: URLSearchParams | Record<string, string | string[] | undefined>): boolean {
  const keys = params instanceof URLSearchParams ? [...params.keys()] : Object.keys(params);
  return keys.some((key) => key === 'q'
    || key === 'sort_by'
    || key === 'sort_order'
    || key === 'category_id'
    || key === 'min_price'
    || key === 'max_price'
    || key === 'preview_token'
    || key === 'gclid'
    || key === 'fbclid'
    || key.startsWith('utm_'));
}
