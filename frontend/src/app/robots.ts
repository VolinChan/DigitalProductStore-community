import type { MetadataRoute } from 'next';
import { absoluteSiteUrl, getSiteConfig } from '@/lib/seo/site-config';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const config = getSiteConfig();
  if (!config.indexingEnabled) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/v1/admin/', '/api/v1/me/'] },
    ],
    sitemap: absoluteSiteUrl('/sitemap.xml'),
    host: config.siteUrl.origin,
  };
}
