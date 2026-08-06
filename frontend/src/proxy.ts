import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_INDEX_LOCALE, isStorefrontLocale } from '@/lib/seo/policy';
import { renderProductNotFoundHTML } from '@/lib/seo/not-found-html';

export async function proxy(request: NextRequest) {
  const segment = request.nextUrl.pathname.split('/')[1];
  const locale = isStorefrontLocale(segment) ? segment : DEFAULT_INDEX_LOCALE;
  const productMatch = request.nextUrl.pathname.match(/^\/(es-CL|en)\/products\/([^/]+)$/);
  if (process.env.SEO_E2E_CLIENT_CATALOG !== 'true' && productMatch && productMatch[2] !== 'search' && !request.nextUrl.searchParams.has('preview_token')) {
    const ref = decodeURIComponent(productMatch[2]);
    const apiBase = (process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
    try {
      const resolvedResponse = await fetch(`${apiBase}/api/v1/products/resolve/${encodeURIComponent(ref)}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (resolvedResponse.ok) {
        const body = await resolvedResponse.json() as { data?: { current_slug?: string } };
        const currentSlug = body.data?.current_slug;
        if (currentSlug && currentSlug !== ref) {
          return NextResponse.redirect(new URL(`/${locale}/products/${encodeURIComponent(currentSlug)}`, request.url), 308);
        }
      } else if (resolvedResponse.status === 404) {
        return new NextResponse(renderProductNotFoundHTML(locale), {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
    } catch {
      // The page loader owns the retryable upstream error policy. Proxy
      // resolution is only an early HTTP redirect optimization.
    }
  }
  const headers = new Headers(request.headers);
  headers.set('x-plexoria-locale', locale);
  headers.set('x-plexoria-pathname', request.nextUrl.pathname);
  headers.set('x-plexoria-search', request.nextUrl.search);
  const response = NextResponse.next({ request: { headers } });
  const nonIndexable = /^\/(?:admin|storefront-demo)(?:\/|$)/.test(request.nextUrl.pathname)
    || /\/(?:cart|checkout|login|register|forgot-password|reset-password|profile|orders|notifications|shipping-adjustments|verify-email)(?:\/|$)/.test(request.nextUrl.pathname)
    || /\/products\/search(?:\/|$)/.test(request.nextUrl.pathname)
    || request.nextUrl.searchParams.has('preview_token');
  if (nonIndexable) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
