'use client';

import type { RefObject } from 'react';
import Link from 'next/link';
import { Drawer } from 'antd';
import { CheckCircleFilled, ShoppingOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import ImageFallback from '@/components/ImageFallback';
import { getSKUImage } from '@/lib/catalog';
import { formatCLP } from '@/lib/utils';
import { trapFocusWithin } from '@/lib/focus';
import type { Product, SKU } from '@/types';

interface MiniCartProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  sku: SKU;
  quantity: number;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export default function MiniCart({ open, onClose, product, sku, quantity, returnFocusRef }: MiniCartProps) {
  const t = useTranslations();
  const locale = useLocale();
  const image = getSKUImage(sku) || product.images?.find((item) => item.is_primary)?.image_url || '/placeholder-product.svg';
  const subtotal = Number(sku.price) * quantity;

  return (
    <Drawer
      placement="right"
      className="storefront"
      width="min(92vw, 420px)"
      open={open}
      onKeyDown={trapFocusWithin}
      onClose={onClose}
      afterOpenChange={(visible) => {
        if (!visible) returnFocusRef.current?.focus();
      }}
      title={<span className="inline-flex items-center gap-2 text-base font-black text-[var(--sf-ink)]"><CheckCircleFilled className="text-[var(--sf-success)]" />{t('cart.addedTitle')}</span>}
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex h-full flex-col bg-[var(--sf-bg)] p-5">
        <div className="flex gap-4 rounded-[18px] bg-white p-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#f1f4f2]">
            <ImageFallback src={image} alt={product.name} fill className="object-contain p-2" sizes="96px" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-black leading-5 text-[var(--sf-ink)]">{product.name}</h3>
            {sku.attributes?.length > 0 && <p className="mt-1 text-xs leading-5 text-[var(--sf-muted)]">{sku.attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ')}</p>}
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-xs text-[var(--sf-muted)]">{t('cart.itemQuantity', { count: quantity })}</span>
              <span className="font-black text-[var(--sf-brand)]">{formatCLP(subtotal, locale)}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-2 pb-[max(0px,env(safe-area-inset-bottom))]">
          <Link href={`/${locale}/cart`} onClick={onClose} className="sf-button-primary w-full"><ShoppingOutlined />{t('cart.viewCart')}</Link>
          <Link href={`/${locale}/checkout?mode=cart`} onClick={onClose} className="sf-button-secondary w-full">{t('cart.proceedToCheckout')}</Link>
          <button type="button" onClick={onClose} className="flex min-h-12 w-full items-center justify-center text-sm font-bold text-[var(--sf-muted)] hover:text-[var(--sf-accent)]">{t('cart.continueShopping')}</button>
        </div>
      </div>
    </Drawer>
  );
}
