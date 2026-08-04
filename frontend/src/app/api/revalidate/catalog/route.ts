import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

interface RevalidationPayload {
  product_id?: number;
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
  revalidateTag('catalog-products', 'max');
  revalidateTag('catalog-seo-index', 'max');
  if (payload.slug) revalidateTag(`product:${payload.slug}`, 'max');
  if (payload.previous_slug) revalidateTag(`product:${payload.previous_slug}`, 'max');
  return NextResponse.json({ revalidated: true, event: payload.event || 'catalog_changed' });
}
