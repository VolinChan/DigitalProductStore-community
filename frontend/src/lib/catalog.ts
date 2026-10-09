import type { Product, ProductMedia, SKU } from '@/types';
import { catalogStorefrontEnabled } from '@/lib/catalog-flags';
import { toPlainText } from '@/lib/plain-text';

function sortedProductMedia(media: ProductMedia[] = []) {
  return [...media].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
}

export function getProductPreviewVideo(product: Pick<Product, 'media'>): string | undefined {
  if (!catalogStorefrontEnabled) return undefined;
  return sortedProductMedia(product.media).find((item) => item.media_asset?.kind === 'video'
    && item.media_asset.mime_type !== 'video/youtube' && item.media_asset.url)?.media_asset?.url;
}

export function getProductPrimaryImage(product: Pick<Product, 'media' | 'images'>): string | undefined {
  const legacy = [...(product.images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  )[0];
  if (!catalogStorefrontEnabled && legacy) return legacy.thumbnail_url || legacy.image_url;

  const modern = sortedProductMedia(product.media).find((item) => item.media_asset?.kind === 'image' && item.media_asset.url);
  if (modern?.media_asset) return modern.media_asset.url;
  return legacy?.thumbnail_url || legacy?.image_url;
}

export function getProductSummary(product: Pick<Product, 'short_description' | 'description'>): string {
  const shortDescription = toPlainText(product.short_description);
  const description = toPlainText(product.description);
  return catalogStorefrontEnabled
    ? shortDescription || description
    : description || shortDescription;
}

export function getSKUImage(sku?: SKU | null): string | undefined {
  if (!catalogStorefrontEnabled && sku?.image_url) return sku.image_url;
  const modern = [...(sku?.media ?? [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id - b.id)
    .find((item) => item.media_asset?.kind === 'image' && item.media_asset.url);
  return modern?.media_asset?.url || sku?.image_url || undefined;
}

export function getProductImageOptions(product: Pick<Product, 'media' | 'images'>) {
  const legacy = [...(product.images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({ id: `legacy-${image.id}`, url: image.image_url }));
  if (!catalogStorefrontEnabled && legacy.length > 0) return legacy;

  const modern = sortedProductMedia(product.media)
    .filter((item) => item.media_asset?.kind === 'image' && item.media_asset.url)
    .map((item) => ({ id: `media-${item.media_asset_id}`, url: item.media_asset!.url }));
  if (modern.length > 0) return modern;
  return legacy;
}
