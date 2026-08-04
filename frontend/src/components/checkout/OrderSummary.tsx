'use client';

import ImageFallback from '@/components/ImageFallback';
import { formatCLP } from '@/lib/utils';
import { getCartLineDisplay } from '@/lib/cart-line';
import type { CartItem, ShippingQuote } from '@/types';
import { useLocale, useTranslations } from 'next-intl';

interface OrderSummaryProps {
  items: CartItem[];
  totalPrice: number;
  shippingFee?: number;
  shippingQuote?: ShippingQuote | null;
}

export default function OrderSummary({ items, totalPrice, shippingFee = 0, shippingQuote }: OrderSummaryProps) {
  const t = useTranslations();
  const locale = useLocale();
	const payable = shippingQuote?.payable_shipping ?? shippingFee;
  const grandTotal = totalPrice + payable;

  return (
    <div>
      <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
        {items.map((item) => {
          const { name, image, attributes, skuCode, lineTotal } = getCartLineDisplay(item, t('cart.unavailableItem'));
          return (
            <div key={`${item.sku_id}-${item.id}`} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f1f4f2]">
                <ImageFallback src={image} alt={name} fill className="object-contain p-1.5" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold leading-5 text-[var(--sf-ink)]">{name}</p>
                {attributes.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-[var(--sf-muted)]">{attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ')}</p>}
                {skuCode && <p className="mt-1 font-mono text-xs text-[var(--sf-muted)]">{skuCode}</p>}
              </div>
              <div className="shrink-0 text-right"><p className="text-xs text-[var(--sf-muted)]">{formatCLP(item.unit_price, locale)} × {item.quantity}</p><p className="mt-1 text-sm font-black text-[var(--sf-brand)]">{formatCLP(lineTotal, locale)}</p></div>
            </div>
          );
        })}
      </div>
      <dl className="mt-5 space-y-3 border-t border-[var(--sf-line)] pt-5 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('cart.totalPrice')}</dt><dd className="font-semibold text-[var(--sf-ink)]">{formatCLP(totalPrice, locale)}</dd></div>
		{shippingQuote ? <><div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('shipping.baseShipping')}</dt><dd className="font-semibold">{formatCLP(shippingQuote.rounded_base_amount, locale)}</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('shipping.subsidy')}</dt><dd className="font-semibold text-[#24723f]">−{formatCLP(shippingQuote.subsidy_amount, locale)}</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('shipping.remoteSurcharge')}</dt><dd className="font-semibold">{formatCLP(shippingQuote.remote_surcharge, locale)}</dd></div>{shippingQuote.remote_assessment_required && <p className="rounded-lg bg-[#fff7e6] p-2 text-xs">{t('shipping.remotePending')}</p>}<div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('cart.shippingFee')}</dt><dd className="font-semibold">{payable > 0 ? formatCLP(payable, locale) : t('common.free')}</dd></div></> : <div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('cart.shippingFee')}</dt><dd className="font-semibold text-[var(--sf-ink)]">{t('shipping.quoteRequired')}</dd></div>}
        <div className="flex items-baseline justify-between gap-4 border-t border-[var(--sf-line)] pt-4"><dt className="font-black text-[var(--sf-ink)]">{t('cart.total')}</dt><dd className="text-xl font-black text-[var(--sf-brand)]">{formatCLP(grandTotal, locale)}</dd></div>
      </dl>
    </div>
  );
}
