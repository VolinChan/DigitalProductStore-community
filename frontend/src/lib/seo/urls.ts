import { absoluteSiteUrl } from './site-config';
import { DEFAULT_INDEX_LOCALE, type StorefrontLocale } from './policy';

export function localizedPath(locale: StorefrontLocale, pathname = ''): string {
  const suffix = pathname ? `/${pathname.replace(/^\/+|\/+$/g, '')}` : '';
  return `/${locale}${suffix}`;
}

export function canonicalUrl(locale: StorefrontLocale, pathname = ''): string {
  return absoluteSiteUrl(localizedPath(locale, pathname));
}

export function productPath(locale: StorefrontLocale, slug: string): string {
  return localizedPath(locale, `products/${encodeURIComponent(slug)}`);
}

export function productCanonicalUrl(locale: StorefrontLocale, slug: string): string {
  return absoluteSiteUrl(productPath(locale, slug));
}

export function localeAlternates(pathname = ''): Record<string, string> {
  return {
    'es-CL': canonicalUrl('es-CL', pathname),
    en: canonicalUrl('en', pathname),
    'x-default': canonicalUrl(DEFAULT_INDEX_LOCALE, pathname),
  };
}
