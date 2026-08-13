import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

interface RevalidationPayload {
  product_id?: number;
  category_id?: number;
  slug?: string;
  previous_slug?: string;
  event?: string;
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEO_REVALIDATION_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'Revalidation is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await request.json() as RevalidationPayload;
  // Catalog lifecycle changes must be strongly consistent. Serving a stale
  // list after an archive/unpublish leaves a card linking to a 404 detail
  // page, so expire the affected entries synchronously on the next read.
  const expireImmediately = { expire: 0 } as const;
  const productChanged = Boolean(payload.product_id || payload.slug || payload.previous_slug);
  const categoryChanged = Boolean(payload.category_id);
  if (productChanged) {
    revalidateTag('catalog-products', expireImmediately);
    revalidateTag('catalog-seo-index', expireImmediately);
    if (payload.slug) revalidateTag(`product:${payload.slug}`, expireImmediately);
    if (payload.previous_slug) revalidateTag(`product:${payload.previous_slug}`, expireImmediately);
  }
  if (categoryChanged) {
    revalidateTag('catalog-categories', expireImmediately);
    // Category visibility, names, and hierarchy also affect product listings
    // and their filters, even when no product row changed.
    revalidateTag('catalog-products', expireImmediately);
  }
  return NextResponse.json({ revalidated: true, event: payload.event || 'catalog_changed' });
}
