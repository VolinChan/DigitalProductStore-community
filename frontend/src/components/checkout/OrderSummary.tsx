'use client';

import ImageFallback from '@/components/ImageFallback';
import { getSKUImage } from '@/lib/catalog';
import { formatCLP } from '@/lib/utils';
import type { CartItem } from '@/types';
import { useLocale, useTranslations } from 'next-intl';

interface OrderSummaryProps {
  items: CartItem[];
  totalPrice: number;
  shippingFee?: number;
}

export default function OrderSummary({ items, totalPrice, shippingFee = 0 }: OrderSummaryProps) {
  const t = useTranslations();
  const locale = useLocale();
  const grandTotal = totalPrice + shippingFee;

  return (
    <div>
      <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
        {items.map((item) => {
          const name = item.sku?.product?.name || item.sku_name || item.sku?.sku_code || item.sku_code || `SKU #${item.sku_id}`;
          const image = item.image_url || getSKUImage(item.sku) || '/placeholder-product.svg';
          const attributes = item.attributes || item.sku?.attributes || [];
          return (
            <div key={`${item.sku_id}-${item.id}`} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f1f4f2]">
                <ImageFallback src={image} alt={name} fill className="object-contain p-1.5" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold leading-5 text-[var(--sf-ink)]">{name}</p>
                {attributes.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-[var(--sf-muted)]">{attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ')}</p>}
              </div>
              <div className="shrink-0 text-right"><p className="text-xs text-[var(--sf-muted)]">x{item.quantity}</p><p className="mt-1 text-sm font-black text-[var(--sf-brand)]">{formatCLP(item.subtotal, locale)}</p></div>
            </div>
          );
        })}
      </div>
      <dl className="mt-5 space-y-3 border-t border-[var(--sf-line)] pt-5 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('cart.totalPrice')}</dt><dd className="font-semibold text-[var(--sf-ink)]">{formatCLP(totalPrice, locale)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('cart.shippingFee')}</dt><dd className="font-semibold text-[var(--sf-ink)]">{shippingFee > 0 ? formatCLP(shippingFee, locale) : t('common.free')}</dd></div>
        <div className="flex items-baseline justify-between gap-4 border-t border-[var(--sf-line)] pt-4"><dt className="font-black text-[var(--sf-ink)]">{t('cart.total')}</dt><dd className="text-xl font-black text-[var(--sf-brand)]">{formatCLP(grandTotal, locale)}</dd></div>
      </dl>
    </div>
  );
}
