'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { message, Popconfirm, Spin } from 'antd';
import { DeleteOutlined, MinusOutlined, PlusOutlined, ShoppingCartOutlined, WarningOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import ImageFallback from '@/components/ImageFallback';
import { getSKUImage } from '@/lib/catalog';
import { formatCLP } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import type { CartItem } from '@/types';

export default function CartPage() {
  const t = useTranslations();
  const locale = useLocale();
  const cart = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      if (isAuthenticated) await cart.fetchCart();
      setInitialLoading(false);
    })();
    // Zustand actions are stable and should not re-fetch when the state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.fetchCart, isAuthenticated]);

  const warnings = useMemo(() => new Map(cart.items.filter((item) => item.sku && item.quantity > item.sku.inventory).map((item) => [item.sku_id, t('cart.stockLimit', { count: item.sku!.inventory })])), [cart.items, t]);
  const money = (amount: number) => formatCLP(amount, locale);

  const changeQuantity = useCallback(async (skuId: number, quantity: number) => {
    const item = cart.items.find((candidate) => candidate.sku_id === skuId);
    if (!item || quantity < 1) return;
    if (item.sku && quantity > item.sku.inventory) { message.warning(t('cart.stockLimit', { count: item.sku.inventory })); return; }
    setUpdating((previous) => new Set(previous).add(skuId));
    try { await cart.updateQuantity(skuId, quantity); } catch { message.error(t('cart.updateFailed')); }
    finally { setUpdating((previous) => { const next = new Set(previous); next.delete(skuId); return next; }); }
  }, [cart, t]);

  const remove = async (skuId: number) => {
    try { await cart.removeItem(skuId); message.success(t('cart.removed')); } catch { message.error(t('cart.removeFailed')); }
  };
  const clear = async () => {
    try { await cart.clearCart(); message.success(t('cart.clearCartSuccess')); } catch { message.error(t('cart.clearFailed')); }
  };

  if (initialLoading || cart.isLoading) return <main className="store-container flex min-h-[400px] items-center justify-center"><Spin size="large" /></main>;
  if (cart.items.length === 0) return <EmptyCart locale={locale} title={t('cart.emptyTitle')} description={t('cart.emptyDesc')} action={t('cart.shopNow')} />;

  return (
    <main className="store-container">
      <header className="flex flex-col gap-4 border-b border-[var(--sf-line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl"><ShoppingCartOutlined />{t('cart.title')}</h1><p className="mt-2 text-sm text-[var(--sf-muted)]">{t('cart.itemQuantity', { count: cart.totalItems })}</p></div>
        <Popconfirm title={t('cart.confirmClear')} onConfirm={clear} okText={t('common.confirm')} cancelText={t('common.cancel')}>
          <button type="button" className="min-h-11 text-sm font-bold text-[var(--sf-muted)] hover:text-[var(--sf-warm)]">{t('cart.clearCart')}</button>
        </Popconfirm>
      </header>

      {warnings.size > 0 && <div className="mt-6 flex gap-3 rounded-2xl bg-[#fff0e9] p-4 text-sm text-[#8e3a26]"><WarningOutlined className="mt-0.5 text-lg" /><div><p className="font-black">{t('cart.inventoryWarning')}</p><p className="mt-1 leading-5">{t('cart.inventoryInsufficient')}</p></div></div>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          {cart.items.map((item) => <CartRow key={item.sku_id} item={item} warning={warnings.get(item.sku_id)} updating={updating.has(item.sku_id)} onChange={changeQuantity} onRemove={remove} money={money} />)}
        </section>
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-[22px] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-black text-[var(--sf-ink)]">{t('cart.orderSummary')}</h2>
            <dl className="mt-5 space-y-3 border-y border-[var(--sf-line)] py-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('cart.itemCount')}</dt><dd className="font-semibold">{t('cart.itemQuantity', { count: cart.totalItems })}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--sf-muted)]">{t('cart.shippingFee')}</dt><dd className="font-semibold">{t('cart.shippingCalc')}</dd></div>
            </dl>
            <div className="mt-5 flex items-baseline justify-between"><span className="font-black text-[var(--sf-ink)]">{t('cart.total')}</span><span className="text-xl font-black text-[var(--sf-brand)]">{money(cart.totalPrice)}</span></div>
            <Link href={`/${locale}/checkout?mode=cart`} aria-disabled={warnings.size > 0} className={`sf-button-primary mt-6 w-full ${warnings.size > 0 ? 'pointer-events-none opacity-45' : ''}`}>{t('cart.proceedToCheckout')}</Link>
            {warnings.size > 0 && <p className="mt-3 text-center text-xs leading-5 text-[var(--sf-warm)]">{t('cart.handleInventory')}</p>}
            <Link href={`/${locale}/products`} className="sf-button-secondary mt-3 w-full">{t('cart.continueShopping')}</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

function CartRow({ item, warning, updating, onChange, onRemove, money }: { item: CartItem; warning?: string; updating: boolean; onChange: (id: number, quantity: number) => void; onRemove: (id: number) => void; money: (value: number) => string }) {
  const t = useTranslations();
  const name = item.sku?.product?.name || item.sku_name || item.sku_code || `SKU #${item.sku_id}`;
  const image = item.image_url || getSKUImage(item.sku) || '/placeholder-product.svg';
  const max = item.max_quantity ?? item.sku?.inventory ?? 99;
  const soldOut = item.available === false || max <= 0;
  const attributes = item.attributes || item.sku?.attributes || [];

  return (
    <article className="flex gap-3 rounded-[20px] bg-white p-3 sm:gap-5 sm:p-5">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#f1f4f2] sm:h-24 sm:w-24"><ImageFallback src={image} alt={name} fill className="object-contain p-2" sizes="96px" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3"><div className="min-w-0"><h2 className="line-clamp-2 text-sm font-black leading-5 text-[var(--sf-ink)] sm:text-base">{name}</h2>{attributes.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-[var(--sf-muted)]">{attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ')}</p>}</div><Popconfirm title={t('cart.confirmRemove')} onConfirm={() => onRemove(item.sku_id)} okText={t('common.confirm')} cancelText={t('common.cancel')}><button type="button" className="sf-icon-button !h-10 !w-10 shrink-0 text-[var(--sf-muted)] hover:text-[var(--sf-warm)]" aria-label={t('cart.remove')}><DeleteOutlined /></button></Popconfirm></div>
        {soldOut && <p className="mt-2 text-xs font-bold text-[var(--sf-warm)]">{t('common.soldOut')}</p>}
        {warning && <p className="mt-2 text-xs font-semibold text-[var(--sf-warm)]">{warning}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><QuantityControl item={item} max={max} soldOut={soldOut} updating={updating} onChange={onChange} /><div className="text-right"><p className="text-xs text-[var(--sf-muted)]">{money(item.unit_price)} {t('common.per')}</p><p className="mt-1 text-base font-black text-[var(--sf-brand)]">{money(item.subtotal)}</p></div></div>
      </div>
    </article>
  );
}

function QuantityControl({ item, max, soldOut, updating, onChange }: { item: CartItem; max: number; soldOut: boolean; updating: boolean; onChange: (id: number, quantity: number) => void }) {
  const t = useTranslations();
  return <div className="flex h-11 overflow-hidden rounded-xl border border-[var(--sf-line)]"><button type="button" disabled={item.quantity <= 1 || soldOut || updating} onClick={() => onChange(item.sku_id, item.quantity - 1)} className="flex w-10 items-center justify-center hover:bg-[var(--sf-soft)] disabled:opacity-35" aria-label={t('cart.quantityDecrease')}><MinusOutlined /></button><input type="number" min={1} max={max} value={item.quantity} disabled={soldOut || updating} onChange={(event) => onChange(item.sku_id, Number(event.target.value) || 1)} className="w-11 border-x border-[var(--sf-line)] bg-transparent text-center text-sm font-bold outline-none" aria-label={t('cart.quantity')} /><button type="button" disabled={item.quantity >= max || soldOut || updating} onClick={() => onChange(item.sku_id, item.quantity + 1)} className="flex w-10 items-center justify-center hover:bg-[var(--sf-soft)] disabled:opacity-35" aria-label={t('cart.quantityIncrease')}><PlusOutlined /></button></div>;
}

function EmptyCart({ locale, title, description, action }: { locale: string; title: string; description: string; action: string }) {
  return <main className="store-container"><div className="rounded-[22px] bg-white px-5 py-16 text-center"><ShoppingCartOutlined className="text-4xl text-[var(--sf-accent)]" /><h1 className="mt-4 text-2xl font-black text-[var(--sf-ink)]">{title}</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--sf-muted)]">{description}</p><Link href={`/${locale}/products`} className="sf-button-primary mt-6">{action}</Link></div></main>;
}
