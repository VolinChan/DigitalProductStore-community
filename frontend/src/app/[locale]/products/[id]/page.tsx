'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftOutlined, MinusOutlined, PlusOutlined, ShoppingCartOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import ImageGallery from '@/components/product/ImageGallery';
import SKUSelector from '@/components/product/SKUSelector';
import MiniCart from '@/components/cart/MiniCart';
import { useCartStore } from '@/store/useCartStore';
import { useCheckoutIntentStore } from '@/store/useCheckoutIntentStore';
import { getSKUImage } from '@/lib/catalog';
import { catalogStorefrontEnabled } from '@/lib/catalog-flags';
import { formatCLP } from '@/lib/utils';
import type { Product, ProductSpecification, SKU } from '@/types';

interface ProductDetailResponse { data: Product }

export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const productId = params.id as string;
  const previewToken = searchParams.get('preview_token');
  const isPreview = Boolean(previewToken);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ sku: SKU; quantity: number } | null>(null);
  const addToCartTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addToCart = useCartStore((state) => state.addToCart);
  const createBuyNow = useCheckoutIntentStore((state) => state.createBuyNow);

  useEffect(() => {
    let active = true;
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = previewToken
          ? `/admin/products/${productId}/preview?token=${encodeURIComponent(previewToken)}`
          : `/products/${productId}`;
        const response = await apiClient.get<ProductDetailResponse>(endpoint);
        if (active) setProduct(response.data.data);
      } catch {
        if (active) setError(t('products.loadFailed'));
      } finally {
        if (active) setLoading(false);
      }
    };
    if (productId) fetchProduct();
    return () => { active = false; };
  }, [previewToken, productId, t]);

  useEffect(() => {
    if (!product || isPreview) return;
    apiClient.post('/analytics/track', {
      event_type: 'product_view',
      product_id: product.id,
      metadata: { product_name: product.name, category_id: product.category_id },
    }).catch(() => undefined);
  }, [isPreview, product]);

  const selectedSku = useMemo((): SKU | null => {
    const activeSKUs = product?.skus?.filter((sku) => sku.is_active) || [];
    if (activeSKUs.length === 0) return null;
    const attributeNames = new Set(activeSKUs.flatMap((sku) => (sku.attributes || []).map((attribute) => attribute.name)));
    if (![...attributeNames].every((name) => selectedAttributes[name])) return null;
    return activeSKUs.find((sku) => (sku.attributes || []).every((attribute) => selectedAttributes[attribute.name] === attribute.value)) || null;
  }, [product, selectedAttributes]);

  const displayPrice = useMemo(() => {
    if (selectedSku) return { type: 'exact' as const, price: Number(selectedSku.price) };
    const prices = (product?.skus || []).filter((sku) => sku.is_active).map((sku) => Number(sku.price)).filter(Number.isFinite);
    if (prices.length === 0) return { type: 'none' as const };
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? { type: 'exact' as const, price: min } : { type: 'range' as const, min, max };
  }, [product, selectedSku]);

  const inventoryStatus = useMemo(() => {
    if (!selectedSku) {
      const soldOut = Boolean(product?.skus?.length) && product!.skus!.every((sku) => sku.inventory <= 0);
      return soldOut ? { available: false, label: t('common.soldOut') } : { available: true, label: t('products.selectSku') };
    }
    return selectedSku.inventory > 0
      ? { available: true, label: t('products.inStockWithQty', { count: selectedSku.inventory }) }
      : { available: false, label: t('common.soldOut') };
  }, [product, selectedSku, t]);

  const changeAttribute = useCallback((name: string, value: string) => {
    setSelectedAttributes((previous) => {
      const next = { ...previous };
      if (value) next[name] = value; else delete next[name];
      return next;
    });
    setQuantity(1);
  }, []);

  const validatePurchase = () => {
    if (!selectedSku) { toast.warning(t('products.selectSku')); return false; }
    if (!inventoryStatus.available) { toast.error(t('common.soldOut')); return false; }
    if (quantity > selectedSku.inventory) { toast.warning(t('cart.stockLimit', { count: selectedSku.inventory })); return false; }
    return true;
  };

  const handleAddToCart = async (event: MouseEvent<HTMLButtonElement>) => {
    addToCartTriggerRef.current = event.currentTarget;
    if (isPreview || !validatePurchase() || !selectedSku || !product) return;
    setAddingToCart(true);
    try {
      await addToCart(selectedSku, quantity);
      apiClient.post('/analytics/track', { event_type: 'add_to_cart', product_id: product.id, sku_id: selectedSku.id, metadata: { quantity } }).catch(() => undefined);
      setLastAdded({ sku: selectedSku, quantity });
      setMiniCartOpen(true);
      const cartIcon = document.getElementById('cart-icon-header');
      if (cartIcon) {
        cartIcon.classList.remove('animate-bounce-sm');
        void cartIcon.offsetWidth;
        cartIcon.classList.add('animate-bounce-sm');
      }
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : t('products.addFailed'));
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = () => {
    if (isPreview || !validatePurchase() || !selectedSku || !product) return;
    setBuyingNow(true);
    createBuyNow({ productId: product.id, skuId: selectedSku.id, quantity });
    apiClient.post('/analytics/track', { event_type: 'buy_now_click', product_id: product.id, sku_id: selectedSku.id, metadata: { quantity } }).catch(() => undefined);
    router.push(`/${locale}/checkout?mode=buy_now`);
  };

  if (loading) return <ProductDetailSkeleton />;

  if (error || !product) {
    return (
      <main className="store-container">
        <div className="rounded-[22px] bg-white px-5 py-16 text-center">
          <h1 className="text-2xl font-black text-[var(--sf-ink)]">{error || t('products.notFound')}</h1>
          <Link href={`/${locale}/products`} className="sf-button-primary mt-6">{t('products.backToProducts')}</Link>
        </div>
      </main>
    );
  }

  const activeSKUs = product.skus?.filter((sku) => sku.is_active) || [];
  const purchaseDisabled = isPreview || !selectedSku || !inventoryStatus.available;
  const currentPrice = displayPrice.type === 'exact' ? displayPrice.price : displayPrice.type === 'range' ? displayPrice.min : null;

  return (
    <main className="store-container pb-28 lg:pb-12">
      {isPreview && <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>{t('products.previewMode')}.</strong> {t('products.previewNotice')}</div>}

      <nav className="mb-5 flex items-center gap-2 text-xs font-semibold text-[var(--sf-muted)] sm:mb-7" aria-label={t('layout.home')}>
        <Link href={`/${locale}`} className="hover:text-[var(--sf-accent)]">{t('layout.home')}</Link><span>/</span>
        <Link href={`/${locale}/products`} className="hover:text-[var(--sf-accent)]">{t('layout.allProducts')}</Link><span>/</span>
        <span className="truncate text-[var(--sf-subtle)]">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.84fr)] lg:gap-12">
        <section><ImageGallery images={product.images || []} media={catalogStorefrontEnabled ? product.media || [] : []} skuImageUrl={getSKUImage(selectedSku)} productName={product.name} /></section>

        <section className="lg:sticky lg:top-28 lg:h-fit">
          {product.category && <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">{product.category.name}</p>}
          {product.brand && <p className="mt-3 text-xs font-bold uppercase text-[var(--sf-muted)]">{product.brand}</p>}
          <h1 className="mt-2 text-2xl font-black leading-tight text-[var(--sf-ink)] sm:text-3xl lg:text-4xl">{product.name}</h1>

          <div className="mt-6 border-y border-[var(--sf-line)] py-5">
            <p className="text-xs font-bold uppercase text-[var(--sf-muted)]">{t('products.price')}</p>
            <PriceDisplay displayPrice={displayPrice} locale={locale} noPrice={t('products.noPrice')} />
            <p className={`mt-2 text-sm font-bold ${inventoryStatus.available ? 'text-[var(--sf-success)]' : 'text-[var(--sf-warm)]'}`}>{inventoryStatus.label}</p>
          </div>

          {activeSKUs.length > 0 && <div className="mt-6"><SKUSelector skus={activeSKUs} selectedSku={selectedSku} selectedAttributes={selectedAttributes} onAttributeChange={changeAttribute} /></div>}

          <div className="mt-6 flex items-center gap-4">
            <span className="text-sm font-black text-[var(--sf-ink)]">{t('common.quantity')}</span>
            <QuantityControl quantity={quantity} max={selectedSku?.inventory || 1} disabled={!selectedSku || !inventoryStatus.available} onChange={setQuantity} quantityLabel={t('common.quantity')} decreaseLabel={t('products.decreaseQuantity')} increaseLabel={t('products.increaseQuantity')} />
            {selectedSku && selectedSku.inventory > 0 && <span className="text-xs text-[var(--sf-muted)]">{t('products.maxQty', { count: selectedSku.inventory })}</span>}
          </div>

          {selectedSku && <p className="mt-4 text-xs font-medium text-[var(--sf-muted)]">SKU: {selectedSku.sku_code}</p>}
          <div className="mt-7 hidden gap-3 sm:flex">
            <button type="button" onClick={handleAddToCart} disabled={purchaseDisabled || addingToCart} className="sf-button-secondary flex-1">{addingToCart ? t('common.loading') : <><ShoppingCartOutlined />{t('products.addToCart')}</>}</button>
            <button type="button" onClick={handleBuyNow} disabled={purchaseDisabled || buyingNow} className="sf-button-primary flex-1">{buyingNow ? t('common.loading') : <><ThunderboltOutlined />{t('products.buyNow')}</>}</button>
          </div>
        </section>
      </div>

      <section className="mt-12 border-t border-[var(--sf-line)] pt-9 sm:mt-16 sm:pt-12">
        {product.structured_specifications?.length ? <SpecificationsTable structured={product.structured_specifications} title={t('products.specs')} /> : product.specifications ? <SpecificationsTable specifications={product.specifications} title={t('products.specs')} /> : null}
        {(product.description_html || product.description) && (
          <div className="mt-10 max-w-4xl">
            <h2 className="text-2xl font-black text-[var(--sf-ink)]">{t('products.description')}</h2>
            {catalogStorefrontEnabled && product.description_html
              ? <div className="catalog-product-description mt-4 text-[var(--sf-subtle)]" dangerouslySetInnerHTML={{ __html: product.description_html }} />
              : <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--sf-subtle)] sm:text-base">{product.description}</p>}
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--sf-line)] bg-white/95 px-4 py-3 backdrop-blur-xl sm:hidden" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-[640px] items-center gap-2">
          <div className="min-w-0 flex-1"><p className="truncate text-lg font-black text-[var(--sf-brand)]">{currentPrice !== null ? formatCLP(currentPrice, locale) : t('products.noPrice')}</p></div>
          <button type="button" onClick={handleAddToCart} disabled={purchaseDisabled || addingToCart} className="sf-button-secondary !min-h-12 !px-4" aria-label={t('products.addToCart')}><ShoppingCartOutlined /></button>
          <button type="button" onClick={handleBuyNow} disabled={purchaseDisabled || buyingNow} className="sf-button-primary !min-h-12 !px-4"><ThunderboltOutlined />{t('products.buyNow')}</button>
        </div>
      </div>

      {lastAdded && <MiniCart open={miniCartOpen} onClose={() => setMiniCartOpen(false)} product={product} sku={lastAdded.sku} quantity={lastAdded.quantity} returnFocusRef={addToCartTriggerRef} />}
    </main>
  );
}

function PriceDisplay({ displayPrice, locale, noPrice }: { displayPrice: { type: 'exact'; price: number } | { type: 'range'; min: number; max: number } | { type: 'none' }; locale: string; noPrice: string }) {
  if (displayPrice.type === 'exact') return <p className="mt-1 text-3xl font-black text-[var(--sf-brand)] sm:text-4xl">{formatCLP(displayPrice.price, locale)}</p>;
  if (displayPrice.type === 'range') return <p className="mt-1 text-3xl font-black text-[var(--sf-brand)] sm:text-4xl">{formatCLP(displayPrice.min, locale)} <span className="text-xl text-[var(--sf-muted)]">-</span> {formatCLP(displayPrice.max, locale)}</p>;
  return <p className="mt-1 text-lg font-bold text-[var(--sf-muted)]">{noPrice}</p>;
}

function QuantityControl({ quantity, max, disabled, onChange, quantityLabel, decreaseLabel, increaseLabel }: { quantity: number; max: number; disabled: boolean; onChange: (quantity: number) => void; quantityLabel: string; decreaseLabel: string; increaseLabel: string }) {
  const safeMax = Math.max(1, max);
  const update = (value: number) => onChange(Math.min(safeMax, Math.max(1, value)));
  return <div className="flex h-11 overflow-hidden rounded-xl border border-[var(--sf-line)] bg-white">
    <button type="button" disabled={disabled || quantity <= 1} onClick={() => update(quantity - 1)} className="flex w-11 items-center justify-center text-[var(--sf-muted)] hover:bg-[var(--sf-soft)] disabled:opacity-35" aria-label={decreaseLabel}><MinusOutlined /></button>
    <input type="number" min={1} max={safeMax} value={quantity} disabled={disabled} onChange={(event) => update(Number(event.target.value) || 1)} className="w-11 border-x border-[var(--sf-line)] bg-transparent text-center text-sm font-bold outline-none disabled:opacity-50" aria-label={quantityLabel} />
    <button type="button" disabled={disabled || quantity >= safeMax} onClick={() => update(quantity + 1)} className="flex w-11 items-center justify-center text-[var(--sf-muted)] hover:bg-[var(--sf-soft)] disabled:opacity-35" aria-label={increaseLabel}><PlusOutlined /></button>
  </div>;
}

function SpecificationsTable({ structured = [], specifications, title }: { structured?: ProductSpecification[]; specifications?: string; title: string }) {
  const populated = structured.filter((item) => item.value_text?.trim() || item.value_number !== undefined);
  if (populated.length > 0) {
    const groups = new Map<string, ProductSpecification[]>();
    populated.sort((a, b) => a.group_name.localeCompare(b.group_name) || a.sort_order - b.sort_order).forEach((item) => {
      const group = item.group_name || 'General';
      groups.set(group, [...(groups.get(group) || []), item]);
    });
    return <div className="max-w-4xl"><h2 className="text-2xl font-black text-[var(--sf-ink)]">{title}</h2><div className="mt-5 space-y-7">{[...groups.entries()].map(([group, rows]) => <section key={group}><h3 className="mb-2 text-sm font-black text-[var(--sf-subtle)]">{group}</h3><dl className="overflow-hidden rounded-[18px] border border-[var(--sf-line)] text-sm">{rows.map((item, index) => <div key={`${group}-${item.spec_key}`} className={`grid grid-cols-[minmax(0,42%)_minmax(0,58%)] ${index % 2 === 0 ? 'bg-[#f7f8f6]' : 'bg-white'}`}><dt className="break-words border-r border-[var(--sf-line)] px-3 py-3 font-bold text-[var(--sf-ink)] sm:px-4">{item.label}</dt><dd className="min-w-0 break-words px-3 py-3 text-[var(--sf-subtle)] sm:px-4">{item.value_text ?? item.value_number}{item.unit ? ` ${item.unit}` : ''}</dd></div>)}</dl></section>)}</div></div>;
  }
  if (!specifications) return null;
  try {
    const parsed = JSON.parse(specifications);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      return entries.length ? <div className="max-w-4xl"><h2 className="text-2xl font-black text-[var(--sf-ink)]">{title}</h2><dl className="mt-5 overflow-hidden rounded-[18px] border border-[var(--sf-line)] text-sm">{entries.map(([key, value], index) => <div key={key} className={`grid grid-cols-[minmax(0,42%)_minmax(0,58%)] ${index % 2 === 0 ? 'bg-[#f7f8f6]' : 'bg-white'}`}><dt className="break-words border-r border-[var(--sf-line)] px-3 py-3 font-bold text-[var(--sf-ink)] sm:px-4">{key}</dt><dd className="break-words px-3 py-3 text-[var(--sf-subtle)] sm:px-4">{String(value)}</dd></div>)}</dl></div> : null;
    }
  } catch { /* render plain text below */ }
  return <div className="max-w-4xl"><h2 className="text-2xl font-black text-[var(--sf-ink)]">{title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--sf-subtle)]">{specifications}</p></div>;
}

function ProductDetailSkeleton() {
  return <main className="store-container"><div className="grid animate-pulse gap-8 lg:grid-cols-2 lg:gap-12"><div className="aspect-square rounded-[28px] bg-[#edf0ee]" /><div className="space-y-5 pt-4"><div className="h-4 w-1/4 rounded bg-[#edf0ee]" /><div className="h-10 w-4/5 rounded bg-[#edf0ee]" /><div className="h-16 w-1/2 rounded bg-[#edf0ee]" /><div className="h-36 rounded bg-[#edf0ee]" /></div></div></main>;
}
