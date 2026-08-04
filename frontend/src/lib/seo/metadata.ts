import type { Metadata } from 'next';
import { canonicalUrl, localeAlternates } from './urls';
import { getSiteConfig } from './site-config';
import { NOINDEX_ROBOTS, type StorefrontLocale } from './policy';

const copy = {
  'es-CL': {
    defaultTitle: 'Plexoria | Tecnología y accesorios en Chile',
    titleTemplate: '%s | Plexoria',
    description: 'Compra tecnología y accesorios seleccionados en Chile con información clara de precio y disponibilidad.',
  },
  en: {
    defaultTitle: 'Plexoria | Technology and accessories in Chile',
    titleTemplate: '%s | Plexoria',
    description: 'Shop selected technology and accessories in Chile with clear pricing and availability.',
  },
} as const;

export function localizedMetadata(locale: StorefrontLocale): Metadata {
  const config = getSiteConfig();
  const localized = copy[locale];
  const canonical = canonicalUrl(locale);
  return {
    metadataBase: config.siteUrl,
    title: { default: localized.defaultTitle, template: localized.titleTemplate },
    description: localized.description,
    alternates: { canonical, languages: localeAlternates() },
    openGraph: {
      type: 'website',
      siteName: config.brandName,
      locale: locale === 'es-CL' ? 'es_CL' : 'en_US',
      url: canonical,
      title: localized.defaultTitle,
      description: localized.description,
      images: [{ url: config.brandShareImage, alt: config.brandName }],
    },
    robots: config.indexingEnabled ? { index: true, follow: true } : NOINDEX_ROBOTS,
  };
}

export function noIndexMetadata(title?: string): Metadata {
  return { title, robots: NOINDEX_ROBOTS };
}

export function publicPageMetadata(
  locale: StorefrontLocale,
  pathname: string,
  localized: Record<StorefrontLocale, { title: string; description: string }>,
): Metadata {
  const config = getSiteConfig();
  const canonical = canonicalUrl(locale, pathname);
  const content = localized[locale];
  return {
    title: content.title,
    description: content.description,
    alternates: { canonical, languages: localeAlternates(pathname) },
    openGraph: { type: 'website', url: canonical, title: content.title, description: content.description },
    robots: config.indexingEnabled ? { index: true, follow: true } : NOINDEX_ROBOTS,
  };
}

export function cleanText(value: string | undefined, maxLength = 160): string {
  if (!value) return '';
  const normalized = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : shortened.length).trim()}…`;
}
