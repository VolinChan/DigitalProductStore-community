import type { Metadata } from 'next';
import { canonicalUrl, localeAlternates } from './urls';
import { getSiteConfig } from './site-config';
import { INDEX_ROBOTS, NOINDEX_ROBOTS, type StorefrontLocale } from './policy';
import documents from '@/lib/legal/documents.json';
import englishDocuments from '@/lib/legal/documents.en.json';

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

export function localizedMetadata(locale: StorefrontLocale, pathname = '', search = ''): Metadata {
  const config = getSiteConfig();
  const localized = copy[locale];
  const canonical = canonicalUrl(locale);
  const metadata: Metadata = {
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
    robots: config.indexingEnabled ? INDEX_ROBOTS : NOINDEX_ROBOTS,
  };
  const relative = pathname.replace(new RegExp(`^/${locale}/?`), '');
  const documentRoutes: Record<string, keyof typeof documents.documents> = {
    privacy: 'privacy', 'help/returns': 'returns_withdrawal', 'legal/terms': 'terms',
    'legal/returns-withdrawal': 'returns_withdrawal', 'legal/legal-guarantee': 'legal_guarantee',
    'legal/cookies': 'cookies', 'legal/supplier': 'supplier_identification',
  };
  const key = documentRoutes[relative];
  if (key || relative === 'legal') {
    const translated = locale === 'en' ? (englishDocuments.documents as Partial<typeof documents.documents>)[key] : undefined;
    const document = translated || documents.documents[key];
    const title = document?.title || (locale === 'en' ? 'Legal information' : 'Información legal');
    const description = document ? cleanText(document.paragraphs.find(paragraph => paragraph.length > 100)) : title;
    const url = canonicalUrl(locale, relative);
    return {
      ...metadata, title: { default: `${title} | ${config.brandName}`, template: localized.titleTemplate }, description,
      alternates: { canonical: url, languages: {} },
      openGraph: { ...metadata.openGraph, title, description, url },
    };
  }
  const privateRoute = /^(?:cart|checkout|login|register|forgot-password|reset-password|profile|orders|notifications|shipping-adjustments|verify-email|privacy-request)(?:\/|$)/.test(relative)
    || new URLSearchParams(search).has('preview_token');
  if (privateRoute || relative === 'products/search') {
    return {
      ...metadata,
      title: { default: config.brandName, template: localized.titleTemplate },
      alternates: { canonical: relative === 'products/search' ? canonicalUrl(locale, 'products') : null, languages: {} },
      openGraph: { type: 'website', siteName: config.brandName, title: config.brandName },
      robots: NOINDEX_ROBOTS,
    };
  }
  return metadata;
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
    openGraph: { type: 'website', siteName: config.brandName, url: canonical, title: content.title, description: content.description, images: [{ url: config.brandShareImage, alt: config.brandName }] },
    robots: config.indexingEnabled ? INDEX_ROBOTS : NOINDEX_ROBOTS,
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
