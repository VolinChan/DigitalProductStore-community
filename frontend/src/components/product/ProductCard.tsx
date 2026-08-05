'use client';

import { useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import ImageFallback from '@/components/ImageFallback';
import SearchHighlight from '@/components/product/SearchHighlight';
import { getProductPrimaryImage, getProductSummary } from '@/lib/catalog';
import { formatCLP } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  highlightQuery?: string;
}

export default function ProductCard({ product, highlightQuery }: ProductCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const primaryImage = getProductPrimaryImage(product) || '/placeholder-product.svg';
  const startingPrice = getStartingPrice(product);
  const outOfStock = checkOutOfStock(product);
  const summary = getProductSummary(product);
  const [sampledSurface, setSampledSurface] = useState<{ src: string; color: string } | null>(null);
  const imageSurface = sampledSurface?.src === primaryImage ? sampledSurface.color : '#f7f7f7';

  const matchImageSurface = (event: SyntheticEvent<HTMLImageElement>) => {
    const color = sampleEdgeColor(event.currentTarget);
    if (color) setSampledSurface({ src: primaryImage, color });
  };

  return (
    <Link href={`/${locale}/products/${encodeURIComponent(product.slug || String(product.id))}`} className="group block min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-[18px] border border-solid border-[var(--sf-line)] transition-colors duration-200 sm:rounded-[22px]" style={{ backgroundColor: imageSurface }}>
        {outOfStock && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-[#273746] px-2.5 py-1 text-[10px] font-bold text-white sm:left-3 sm:top-3 sm:text-xs">
            {t('common.soldOut')}
          </span>
        )}
        <ImageFallback
          src={primaryImage}
          alt={product.name}
          fill
          className={`object-contain p-1 transition duration-500 group-hover:scale-[1.025] sm:p-2 ${outOfStock ? 'opacity-55' : ''}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          loading="lazy"
          onLoad={matchImageSurface}
        />
      </div>

      <div className="pt-3">
        {product.brand && (
          <p className="truncate text-[10px] font-bold uppercase text-[var(--sf-muted)]">{product.brand}</p>
        )}
        <h3 className="mt-1 line-clamp-2 min-h-[38px] text-[13px] font-bold leading-[19px] text-[var(--sf-ink)] transition-colors group-hover:text-[var(--sf-accent)] sm:text-sm">
          {highlightQuery ? <SearchHighlight text={product.name} query={highlightQuery} /> : product.name}
        </h3>
        {highlightQuery && summary && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--sf-muted)]">
            <SearchHighlight text={summary} query={highlightQuery} maxLength={90} />
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {startingPrice !== null ? (
            <>
              <span className="text-[10px] font-medium text-[var(--sf-muted)] sm:text-xs">{t('products.from')}</span>
              <span className="text-base font-black text-[var(--sf-brand)] sm:text-lg">
                {formatCLP(startingPrice, locale)}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-[var(--sf-muted)]">{t('common.noPrice')}</span>
          )}
        </div>
        {!outOfStock && <p className="mt-1 text-[11px] font-semibold text-[var(--sf-success)]">{t('common.inStock')}</p>}
      </div>
    </Link>
  );
}

function sampleEdgeColor(image: HTMLImageElement): string | null {
  try {
    const size = 12;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
    context.drawImage(image, 0, 0, size, size);
    const points = [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1], [size / 2, 0], [size / 2, size - 1], [0, size / 2], [size - 1, size / 2]];
    const samples = points
      .map(([x, y]) => [...context.getImageData(x, y, 1, 1).data] as [number, number, number, number])
      .filter((sample) => sample[3] > 32);
    if (!samples.length) return '#f7f7f7';
    const median = (channel: 0 | 1 | 2) => samples.map((sample) => sample[channel]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
    return `rgb(${median(0)} ${median(1)} ${median(2)})`;
  } catch {
    // Cross-origin images without CORS cannot be sampled safely.
    return null;
  }
}

function getStartingPrice(product: Product): number | null {
  const prices = (product.skus || [])
    .filter((sku) => sku.is_active)
    .map((sku) => Number(sku.price))
    .filter(Number.isFinite);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function checkOutOfStock(product: Product): boolean {
  return Boolean(product.skus?.length) && product.skus!.every((sku) => sku.inventory <= 0);
}
