'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button, InputNumber, Tag, Divider, Typography, Breadcrumb, Spin } from 'antd';
import { ShoppingCartOutlined, HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { useCartStore } from '@/store/useCartStore';
import ImageGallery from '@/components/product/ImageGallery';
import SKUSelector from '@/components/product/SKUSelector';
import EmptyState from '@/components/EmptyState';
import type { Product, SKU } from '@/types';

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
  const productId = params.id as string;

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
        const response = await apiClient.get<ProductDetailResponse>(`/products/${productId}`);
        setProduct(response.data.data);
      } catch {
        setError('商品加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }
    if (productId) fetchProduct();
  }, [productId]);

  // Track product view
  useEffect(() => {
    if (!product) return;
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
  }, [product]);

  const selectedSku = useMemo((): SKU | null => {
    if (!product?.skus || product.skus.length === 0) return null;
    const activeSKUs = product.skus.filter((sku) => sku.is_active);
    if (activeSKUs.length === 0) return null;

    const attributeNames = new Set<string>();
    activeSKUs.forEach((sku) => sku.attributes.forEach((attr) => attributeNames.add(attr.name)));

    const allSelected = Array.from(attributeNames).every(
      (name) => selectedAttributes[name] && selectedAttributes[name] !== ''
    );
    if (!allSelected) return null;

    return activeSKUs.find((sku) =>
      sku.attributes.every((attr) => selectedAttributes[attr.name] === attr.value)
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
        return { available: false, count: 0, label: '已售罄' };
      }
      return { available: true, count: -1, label: '请选择规格' };
    }
    if (selectedSku.inventory <= 0) return { available: false, count: 0, label: '已售罄' };
    return { available: true, count: selectedSku.inventory, label: `有货 (库存: ${selectedSku.inventory})` };
  }, [selectedSku, product]);

  const handleAttributeChange = useCallback((name: string, value: string) => {
    setSelectedAttributes((prev) => {
      const next = { ...prev };
      if (value === '') delete next[name]; else next[name] = value;
      return next;
    });
    setQuantity(1);
  }, []);

  const handleAddToCart = async () => {
    if (!selectedSku) { toast.warning('请先选择商品规格'); return; }
    if (!inventoryStatus.available) { toast.error('该商品已售罄'); return; }
    if (quantity > selectedSku.inventory) { toast.warning(`库存不足，最多可购买 ${selectedSku.inventory} 件`); return; }

    setAddingToCart(true);
    try {
      await addToCart(selectedSku, quantity);
      const cartIcon = document.getElementById('cart-icon-header');
      if (cartIcon) {
        cartIcon.classList.remove('animate-bounce-sm');
        void cartIcon.offsetWidth;
        cartIcon.classList.add('animate-bounce-sm');
      }
      toast.success('已加入购物车', { description: `${product?.name} x ${quantity}`, icon: <ShoppingCartOutlined /> });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加入购物车失败');
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <main className="store-container flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="store-container" id="main-content">
        <div className="animate-fade-in-up">
          <Breadcrumb className="mb-6" items={[
            { title: <Link href="/"><HomeOutlined /> 首页</Link> },
            { title: <Link href="/products">商品列表</Link> },
          ]} />
          <EmptyState
            title={error || '商品不存在'}
            actionLabel="返回商品列表"
            actionHref="/products"
          />
        </div>
      </main>
    );
  }

  const activeSKUs = product.skus?.filter((sku) => sku.is_active) || [];

  return (
    <main className="store-container" id="main-content">
      <div className="animate-fade-in-up space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link href="/" className="flex items-center gap-1 hover:text-accent"><HomeOutlined /> 首页</Link> },
            { title: <Link href="/products" className="hover:text-accent">商品列表</Link> },
            { title: <span className="text-foreground">{product.name}</span> },
          ]}
        />

        {/* Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Image Gallery */}
          <div>
            <ImageGallery images={product.images || []} skuImageUrl={selectedSku?.image_url} productName={product.name} />
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
                <Text type="secondary" className="text-sm">价格</Text>
                {displayPrice.type === 'exact' && (
                  <>
                    <span className="text-sm text-error">¥</span>
                    <span className="text-3xl sm:text-4xl font-bold text-error">
                      {displayPrice.price.toFixed(2)}
                    </span>
                  </>
                )}
                {displayPrice.type === 'range' && (
                  <>
                    <span className="text-sm text-error">¥</span>
                    <span className="text-3xl font-bold text-error">{displayPrice.min.toFixed(2)}</span>
                    <Text type="secondary" className="mx-1">~</Text>
                    <span className="text-sm text-error">¥</span>
                    <span className="text-xl font-bold text-error">{displayPrice.max.toFixed(2)}</span>
                  </>
                )}
                {displayPrice.type === 'none' && <Text type="secondary">暂无价格</Text>}
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
              <Text strong className="text-sm">数量</Text>
              <div className="flex items-center border rounded-lg overflow-hidden w-32">
                <button
                  type="button"
                  disabled={!inventoryStatus.available || !selectedSku || quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                  aria-label="减少数量"
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
                  aria-label="数量"
                />
                <button
                  type="button"
                  disabled={!inventoryStatus.available || !selectedSku || quantity >= (selectedSku?.inventory ?? 99)}
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                  aria-label="增加数量"
                >
                  +
                </button>
              </div>
              {selectedSku && selectedSku.inventory > 0 && (
                <Text type="secondary" className="text-xs">最多 {selectedSku.inventory} 件</Text>
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
                disabled={!selectedSku || !inventoryStatus.available}
                className="store-btn-primary !px-8 !py-3 !text-base flex-1"
              >
                {!inventoryStatus.available && selectedSku ? '已售罄' : !selectedSku ? '请选择规格' : '加入购物车'}
              </Button>
              <Link href="/products">
                <Button size="large" icon={<ArrowLeftOutlined />} className="!py-3">
                  继续购物
                </Button>
              </Link>
            </div>

            {selectedSku && (
              <Text type="secondary" className="text-xs">SKU: {selectedSku.sku_code}</Text>
            )}
          </div>
        </div>

        {/* Description & Specifications */}
        {(product.description || product.specifications) && (
          <section className="border-t pt-8 space-y-8">
            {product.description && (
              <div>
                <h2 className="text-lg font-bold mb-3">商品描述</h2>
                <Paragraph className="text-muted whitespace-pre-wrap">{product.description}</Paragraph>
              </div>
            )}
            {product.specifications && <SpecificationsTable specifications={product.specifications} />}
          </section>
        )}

        {/* Mobile Sticky Add to Cart */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t px-4 py-3 shadow-lg z-50 flex items-center justify-between">
          <div>
            {displayPrice.type === 'exact' && (
              <span className="text-lg font-bold text-error">¥{displayPrice.price.toFixed(2)}</span>
            )}
            {displayPrice.type === 'range' && (
              <span className="text-sm text-muted">¥{displayPrice.min.toFixed(2)} - ¥{displayPrice.max.toFixed(2)}</span>
            )}
          </div>
          <Button type="primary" size="large" onClick={handleAddToCart} loading={addingToCart} disabled={!inventoryStatus.available} className="!h-10 !px-6 !text-sm font-medium rounded-lg">
            加入购物车
          </Button>
        </div>
      </div>
    </main>
  );
}

function SpecificationsTable({ specifications }: { specifications: string }) {
  try {
    const parsed = JSON.parse(specifications);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        return (
          <div>
            <h2 className="text-lg font-bold mb-3">商品规格</h2>
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
      <h2 className="text-lg font-bold mb-3">商品规格</h2>
      <Paragraph className="text-muted whitespace-pre-wrap">{specifications}</Paragraph>
    </div>
  );
}
