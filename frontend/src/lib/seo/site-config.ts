const DEFAULT_SITE_URL = 'https://www.plexoria.cl';
const DEFAULT_REVALIDATE_SECONDS = 900;
const MAX_REVALIDATE_SECONDS = 900;

export interface SiteConfig {
  siteUrl: URL;
  internalApiBaseUrl: string;
  indexingEnabled: boolean;
  revalidateSeconds: number;
  brandName: string;
  brandShareImage: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('SEO_INDEXING_ENABLED must be either true or false');
}

function parseSiteUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('SITE_URL must be a valid absolute URL');
  }
  if (url.protocol !== 'https:') throw new Error('SITE_URL must use HTTPS');
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('SITE_URL must be an HTTPS origin without credentials, path, query, or fragment');
  }
  url.pathname = '/';
  return url;
}

function parseRevalidateSeconds(raw: string | undefined): number {
  if (!raw) return DEFAULT_REVALIDATE_SECONDS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_REVALIDATE_SECONDS) {
    throw new Error(`SEO_REVALIDATE_SECONDS must be an integer between 1 and ${MAX_REVALIDATE_SECONDS}`);
  }
  return value;
}

function normalizeApiBaseUrl(raw: string): string {
  const value = raw.replace(/\/+$/, '');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INTERNAL_API_BASE_URL must use HTTP or HTTPS');
  return value;
}

export function getSiteConfig(): SiteConfig {
  const indexingEnabled = parseBoolean(process.env.SEO_INDEXING_ENABLED, false);
  const configuredSiteUrl = process.env.SITE_URL?.trim();
  if (indexingEnabled && !configuredSiteUrl) {
    throw new Error('SITE_URL is required when SEO_INDEXING_ENABLED=true');
  }
  const siteUrl = parseSiteUrl(configuredSiteUrl || DEFAULT_SITE_URL);
  const internalApiBaseUrl = normalizeApiBaseUrl(
    process.env.INTERNAL_API_BASE_URL?.trim()
      || process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
      || 'http://localhost:8080',
  );
  return {
    siteUrl,
    internalApiBaseUrl,
    indexingEnabled,
    revalidateSeconds: parseRevalidateSeconds(process.env.SEO_REVALIDATE_SECONDS),
    brandName: 'Plexoria',
    brandShareImage: '/plexoria-logo.png',
  };
}

export function absoluteSiteUrl(pathname: string): string {
  const { siteUrl } = getSiteConfig();
  return new URL(pathname.replace(/^\/+/, ''), siteUrl).toString();
}

export function publicAssetUrl(value: string | undefined, fallback?: string): string | undefined {
  const candidate = value?.trim() || fallback?.trim();
  if (!candidate) return undefined;
  if (candidate.startsWith('/')) return absoluteSiteUrl(candidate);
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return fallback && fallback !== candidate ? publicAssetUrl(fallback) : undefined;
    return url.toString();
  } catch {
    return fallback && fallback !== candidate ? publicAssetUrl(fallback) : undefined;
  }
}
