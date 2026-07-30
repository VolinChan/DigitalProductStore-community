'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, InputNumber, Tag, Divider, Typography, Breadcrumb, Spin } from 'antd';
import { ShoppingCartOutlined, HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { useCartStore } from '@/store/useCartStore';
import ImageGallery from '@/components/product/ImageGallery';
import SKUSelector from '@/components/product/SKUSelector';
import EmptyState from '@/components/EmptyState';
import type { Product, ProductSpecification, SKU } from '@/types';
import { getSKUImage } from '@/lib/catalog';
import { catalogStorefrontEnabled } from '@/lib/catalog-flags';
import { useLocale, useTranslations } from 'next-intl';

const { Title, Text, Paragraph } = Typography;

interface ProductDetailResponse {
  data: Product;
}

/**
 * Modern product detail page.
 * Requirements: 4.1-4.5, 28.4, 38.1-38.8
 */
export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.id as string;
  const previewToken = searchParams.get('preview_token');
  const isPreview = Boolean(previewToken);
  const t = useTranslations();
  const locale = useLocale();
  const formatPrice = (amount: number) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError(null);
      try {
        const endpoint = previewToken
          ? `/admin/products/${productId}/preview?token=${encodeURIComponent(previewToken)}`
          : `/products/${productId}`;
        const response = await apiClient.get<ProductDetailResponse>(endpoint);
        setProduct(response.data.data);
      } catch {
        setError(t('products.loadFailed'));
      } finally {
        setLoading(false);
      }
    }
    if (productId) fetchProduct();
  }, [previewToken, productId, t]);

  // Track product view
  useEffect(() => {
    if (!product || isPreview) return;
    async function trackView() {
      try {
        await apiClient.post('/analytics/track', {
          event_type: 'product_view',
          product_id: product!.id,
          metadata: { product_name: product!.name, category_id: product!.category_id },
        });
      } catch { /* silent */ }
    }
    trackView();
  }, [isPreview, product]);

  const selectedSku = useMemo((): SKU | null => {
    if (!product?.skus || product.skus.length === 0) return null;
    const activeSKUs = product.skus.filter((sku) => sku.is_active);
    if (activeSKUs.length === 0) return null;

    const attributeNames = new Set<string>();
    activeSKUs.forEach((sku) => (sku.attributes ?? []).forEach((attr) => attributeNames.add(attr.name)));

    const allSelected = Array.from(attributeNames).every(
      (name) => selectedAttributes[name] && selectedAttributes[name] !== ''
    );
    if (!allSelected) return null;

    return activeSKUs.find((sku) =>
      (sku.attributes ?? []).every((attr) => selectedAttributes[attr.name] === attr.value)
    ) || null;
  }, [product, selectedAttributes]);

  const displayPrice = useMemo(() => {
    if (selectedSku) return { type: 'exact' as const, price: selectedSku.price };
    if (!product?.skus || product.skus.length === 0) return { type: 'none' as const, price: 0 };
    const activeSKUs = product.skus.filter((sku) => sku.is_active);
    if (activeSKUs.length === 0) return { type: 'none' as const, price: 0 };
    const prices = activeSKUs.map((sku) => sku.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return { type: 'exact' as const, price: min };
    return { type: 'range' as const, min, max };
  }, [product, selectedSku]);

  const inventoryStatus = useMemo(() => {
    if (!selectedSku) {
      if (product?.skus && product.skus.every((sku) => sku.inventory <= 0)) {
        return { available: false, count: 0, label: t('common.soldOut') };
      }
      return { available: true, count: -1, label: t('products.selectSku') };
    }
    if (selectedSku.inventory <= 0) return { available: false, count: 0, label: t('common.soldOut') };
    return { available: true, count: selectedSku.inventory, label: t('products.inStockWithQty', { count: selectedSku.inventory }) };
  }, [selectedSku, product, t]);

  const handleAttributeChange = useCallback((name: string, value: string) => {
    setSelectedAttributes((prev) => {
      const next = { ...prev };
      if (value === '') delete next[name]; else next[name] = value;
      return next;
    });
    setQuantity(1);
  }, []);

  const handleAddToCart = async () => {
    if (isPreview) return;
    if (!selectedSku) { toast.warning(t('products.selectSku')); return; }
    if (!inventoryStatus.available) { toast.error(t('common.soldOut')); return; }
    if (quantity > selectedSku.inventory) { toast.warning(t('cart.stockLimit', { count: selectedSku.inventory })); return; }

    setAddingToCart(true);
    try {
      await addToCart(selectedSku, quantity);
      const cartIcon = document.getElementById('cart-icon-header');
      if (cartIcon) {
        cartIcon.classList.remove('animate-bounce-sm');
        void cartIcon.offsetWidth;
        cartIcon.classList.add('animate-bounce-sm');
      }
      toast.success(t('products.addedToCart'), { description: `${product?.name} x ${quantity}`, icon: <ShoppingCartOutlined /> });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('products.addFailed'));
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <main className="store-container flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip={t('common.loading')} />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="store-container" id="main-content">
        <div className="animate-fade-in-up">
          <Breadcrumb className="mb-6" items={[
            { title: <Link href={`/${locale}`}><HomeOutlined /> {t('layout.home')}</Link> },
            { title: <Link href={`/${locale}/products`}>{t('layout.allProducts')}</Link> },
          ]} />
          <EmptyState
            title={error || t('products.notFound')}
            actionLabel={t('products.backToProducts')}
            actionHref={`/${locale}/products`}
          />
        </div>
      </main>
    );
  }

  const activeSKUs = product.skus?.filter((sku) => sku.is_active) || [];

  return (
    <main className="store-container" id="main-content">
      <div className="animate-fade-in-up space-y-8">
        {isPreview && <div className="border-y border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <strong>Vista previa de administrador</strong><span className="ml-2">Las compras estan desactivadas.</span>
        </div>}
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link href={`/${locale}`} className="flex items-center gap-1 hover:text-accent"><HomeOutlined /> {t('layout.home')}</Link> },
            { title: <Link href={`/${locale}/products`} className="hover:text-accent">{t('layout.allProducts')}</Link> },
            { title: <span className="text-foreground">{product.name}</span> },
          ]}
        />

        {/* Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Image Gallery */}
          <div>
            <ImageGallery images={product.images || []} media={catalogStorefrontEnabled ? product.media || [] : []} skuImageUrl={getSKUImage(selectedSku)} productName={product.name} />
          </div>

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Category tag */}
            {product.category && (
              <Tag color="blue" className="text-xs font-semibold">{product.category.name}</Tag>
            )}

            {/* Title */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Price */}
            <div className="bg-card rounded-xl border p-5 shadow-sm">
              <div className="flex items-baseline gap-2">
                <Text type="secondary" className="text-sm">{t('products.price')}</Text>
                {displayPrice.type === 'exact' && (
                  <>
                    <span className="text-3xl sm:text-4xl font-bold text-error">{formatPrice(displayPrice.price)}</span>
                  </>
                )}
                {displayPrice.type === 'range' && (
                  <>
                    <span className="text-3xl font-bold text-error">{formatPrice(displayPrice.min)}</span>
                    <Text type="secondary" className="mx-1">~</Text>
                    <span className="text-xl font-bold text-error">{formatPrice(displayPrice.max)}</span>
                  </>
                )}
                {displayPrice.type === 'none' && <Text type="secondary">{t('products.noPrice')}</Text>}
              </div>
              <div className="mt-2">
                {inventoryStatus.available ? (
                  <Text type="success" className="text-sm font-medium">{inventoryStatus.label}</Text>
                ) : (
                  <Text type="danger" className="text-sm font-semibold">{inventoryStatus.label}</Text>
                )}
              </div>
            </div>

            {/* SKU Selector */}
            {activeSKUs.length > 0 && (
              <SKUSelector
                skus={activeSKUs}
                selectedSku={selectedSku}
                selectedAttributes={selectedAttributes}
                onAttributeChange={handleAttributeChange}
              />
            )}

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <Text strong className="text-sm">{t('common.quantity')}</Text>
              <div className="flex items-center border rounded-lg overflow-hidden w-32">
                <button
                  type="button"
                  disabled={!inventoryStatus.available || !selectedSku || quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                  aria-label={t('products.decreaseQuantity')}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={selectedSku?.inventory ?? 99}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={!inventoryStatus.available || !selectedSku}
                  className="w-12 h-9 text-center text-sm border-x disabled:opacity-50 bg-transparent"
                  aria-label={t('common.quantity')}
                />
                <button
                  type="button"
                  disabled={!inventoryStatus.available || !selectedSku || quantity >= (selectedSku?.inventory ?? 99)}
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                  aria-label={t('products.increaseQuantity')}
                >
                  +
                </button>
              </div>
              {selectedSku && selectedSku.inventory > 0 && (
                <Text type="secondary" className="text-xs">{t('products.maxQty', { count: selectedSku.inventory })}</Text>
              )}
            </div>

            {/* Add to Cart */}
            <div className="flex gap-3">
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                onClick={handleAddToCart}
                loading={addingToCart}
                disabled={isPreview || !selectedSku || !inventoryStatus.available}
                className="store-btn-primary !px-8 !py-3 !text-base flex-1"
              >
                {isPreview ? 'Vista previa' : !inventoryStatus.available && selectedSku ? t('common.soldOut') : !selectedSku ? t('products.selectSku') : t('products.addToCart')}
              </Button>
              <Link href={`/${locale}/products`}>
                <Button size="large" icon={<ArrowLeftOutlined />} className="!py-3">
                  {t('products.continueShopping')}
                </Button>
              </Link>
            </div>

            {selectedSku && (
              <Text type="secondary" className="text-xs">SKU: {selectedSku.sku_code}</Text>
            )}
          </div>
        </div>

        {/* Description & Specifications */}
        {(product.description_html || product.description || product.structured_specifications?.length || product.specifications) && (
          <section className="border-t pt-8 space-y-8">
            {(product.description_html || product.description) && (
              <div>
                <h2 className="text-lg font-bold mb-3">{t('products.description')}</h2>
                {catalogStorefrontEnabled && product.description_html
                  ? <div className="catalog-product-description text-muted" dangerouslySetInnerHTML={{ __html: product.description_html }} />
                  : <Paragraph className="whitespace-pre-wrap text-muted">{product.description}</Paragraph>}
              </div>
            )}
            {(product.structured_specifications?.length || product.specifications) && <SpecificationsTable structured={catalogStorefrontEnabled ? product.structured_specifications : []} specifications={product.specifications} title={t('products.specs')} />}
          </section>
        )}

        {/* Mobile Sticky Add to Cart */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t px-4 py-3 shadow-lg z-50 flex items-center justify-between">
          <div>
            {displayPrice.type === 'exact' && (
              <span className="text-lg font-bold text-error">{formatPrice(displayPrice.price)}</span>
            )}
            {displayPrice.type === 'range' && (
              <span className="text-sm text-muted">{formatPrice(displayPrice.min)} - {formatPrice(displayPrice.max)}</span>
            )}
          </div>
          <Button type="primary" size="large" onClick={handleAddToCart} loading={addingToCart} disabled={isPreview || !inventoryStatus.available} className="!h-10 !px-6 !text-sm font-medium rounded-lg">
            {isPreview ? 'Vista previa' : t('products.addToCart')}
          </Button>
        </div>
      </div>
    </main>
  );
}

function SpecificationsTable({ structured = [], specifications, title }: { structured?: ProductSpecification[]; specifications: string; title: string }) {
  const populated = structured.filter((item) => item.value_text?.trim() || item.value_number !== undefined);
  if (populated.length > 0) {
    const groups = new Map<string, ProductSpecification[]>();
    populated.sort((a, b) => a.group_name.localeCompare(b.group_name) || a.sort_order - b.sort_order).forEach((item) => {
      const group = item.group_name || 'General';
      groups.set(group, [...(groups.get(group) ?? []), item]);
    });
    return <div>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="space-y-5">
        {[...groups.entries()].map(([group, rows]) => <section key={group}>
          <h3 className="mb-2 text-base font-semibold">{group}</h3>
          <dl className="overflow-hidden rounded-xl border text-sm">
            {rows.map((item, index) => <div key={`${group}-${item.spec_key}`} className={`grid grid-cols-[minmax(0,42%)_minmax(0,58%)] ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
              <dt className="break-words border-r px-3 py-3 font-medium text-foreground sm:px-4">{item.label}</dt>
              <dd className="min-w-0 break-words px-3 py-3 text-muted sm:px-4">{item.value_text ?? item.value_number}{item.unit ? ` ${item.unit}` : ''}</dd>
            </div>)}
          </dl>
        </section>)}
      </div>
    </div>;
  }
  try {
    const parsed = JSON.parse(specifications);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        return (
          <div>
            <h2 className="text-lg font-bold mb-3">{title}</h2>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {entries.map(([key, value], index) => (
                    <tr key={key} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                      <td className="px-4 py-3 font-medium text-foreground w-1/3 border-r">{key}</td>
                      <td className="px-4 py-3 text-muted">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
    }
  } catch { /* not JSON */ }

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      <Paragraph className="text-muted whitespace-pre-wrap">{specifications}</Paragraph>
    </div>
  );
}
