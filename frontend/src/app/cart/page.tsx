'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, InputNumber, Typography, Divider, Popconfirm, message, Tag, Spin } from 'antd';
import {
  ShoppingCartOutlined,
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import ImageFallback from '@/components/ImageFallback';
import EmptyState from '@/components/EmptyState';
import type { CartItem } from '@/types';

const { Title, Text } = Typography;

/**
 * Modern cart page.
 * Requirements: 6.1-6.7, 42.3 (polished states)
 */
export default function CartPage() {
  const {
    items,
    totalPrice,
    totalItems,
    isLoading,
    fetchCart,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [initialLoading, setInitialLoading] = useState(true);
  const [updatingItems, setUpdatingItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function loadCart() {
      if (isAuthenticated) await fetchCart();
      setInitialLoading(false);
    }
    loadCart();
  }, [isAuthenticated, fetchCart]);

  const inventoryWarnings = useMemo(() => {
    const warnings = new Map<number, string>();
    items.forEach((item) => {
      if (item.sku && item.quantity > item.sku.inventory) {
        warnings.set(item.sku_id, `库存不足：当前仅 ${item.sku.inventory} 件`);
      }
    });
    return warnings;
  }, [items]);

  const handleQuantityChange = useCallback(
    async (skuId: number, newQuantity: number | null) => {
      if (!newQuantity || newQuantity < 1) return;
      const item = items.find((i) => i.sku_id === skuId);
      if (!item) return;
      if (item.sku && newQuantity > item.sku.inventory) {
        message.warning(`库存不足，最多可购买 ${item.sku.inventory} 件`);
        return;
      }
      setUpdatingItems((prev) => new Set(prev).add(skuId));
      try {
        await updateQuantity(skuId, newQuantity);
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : '更新数量失败');
      } finally {
        setUpdatingItems((prev) => {
          const next = new Set(prev);
          next.delete(skuId);
          return next;
        });
      }
    },
    [items, updateQuantity]
  );

  const handleRemoveItem = useCallback(
    async (skuId: number) => {
      try {
        await removeItem(skuId);
        message.success('已从购物车移除');
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : '移除失败');
      }
    },
    [removeItem]
  );

  const handleClearCart = useCallback(async () => {
    try {
      await clearCart();
      message.success('购物车已清空');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '清空购物车失败');
    }
  }, [clearCart]);

  if (initialLoading || isLoading) {
    return (
      <main className="store-container flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="store-container" id="main-content">
        <div className="animate-fade-in-up">
          <Title level={2} className="!mb-6 flex items-center gap-2">
            <ShoppingCartOutlined /> 购物车
          </Title>
          <EmptyState
            title="购物车是空的"
            description="快去挑选心仪的商品吧！"
            actionLabel="去逛逛"
            actionHref="/products"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="store-container" id="main-content">
      <div className="animate-fade-in-up space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Title level={2} className="!mb-0 flex items-center gap-2">
            <ShoppingCartOutlined /> 购物车
            <Tag className="ml-2 !text-xs">{totalItems} 件商品</Tag>
          </Title>
          <Popconfirm
            title="确定要清空购物车吗？"
            description="此操作不可撤销"
            onConfirm={handleClearCart}
            okText="确定"
            cancelText="取消"
          >
            <Button danger type="text">
              清空购物车
            </Button>
          </Popconfirm>
        </div>

        {/* Inventory Warnings */}
        {inventoryWarnings.size > 0 && (
          <div className="bg-warning/5 border border-warning/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <WarningOutlined className="text-warning mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">库存提示</p>
              <p className="text-xs text-muted mt-0.5">部分商品库存不足，请调整数量后再结算</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {/* Desktop header row */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">
              <div className="col-span-5">商品信息</div>
              <div className="col-span-2 text-center">单价</div>
              <div className="col-span-2 text-center">数量</div>
              <div className="col-span-2 text-center">小计</div>
              <div className="col-span-1 text-center">操作</div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              {items.map((item) => (
                <CartItemRow
                  key={item.sku_id}
                  item={item}
                  isUpdating={updatingItems.has(item.sku_id)}
                  warning={inventoryWarnings.get(item.sku_id)}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card rounded-xl border shadow-card p-6 space-y-4">
              <h2 className="text-lg font-bold">订单摘要</h2>
              <Divider className="!my-0" />
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">商品数量</span>
                  <span>{totalItems} 件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">商品总价</span>
                  <span>¥{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">运费</span>
                  <span className="text-muted">结算时计算</span>
                </div>
              </div>
              <Divider className="!my-0" />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">合计</span>
                <div>
                  <span className="text-sm text-error">¥</span>
                  <span className="text-2xl font-bold text-error">
                    {totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              <Link href="/checkout" className="block">
                <button className="store-btn-primary w-full !py-3 !text-base" disabled={inventoryWarnings.size > 0}>
                  去结算
                </button>
              </Link>

              {inventoryWarnings.size > 0 && (
                <Text type="warning" className="text-xs block text-center">
                  请先处理库存不足的商品
                </Text>
              )}

              <Link href="/products" className="block">
                <button className="store-btn-secondary w-full">
                  <ArrowLeftOutlined /> 继续购物
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── Individual Cart Item ──────────────────────────────────────────── */

interface CartItemRowProps {
  item: CartItem;
  isUpdating: boolean;
  warning?: string;
  onQuantityChange: (skuId: number, quantity: number | null) => void;
  onRemove: (skuId: number) => void;
}

function CartItemRow({ item, isUpdating, warning, onQuantityChange, onRemove }: CartItemRowProps) {
  const sku = item.sku;
  const displayName = sku?.product?.name || item.sku_name || sku?.sku_code || item.sku_code || `SKU #${item.sku_id}`;
  const displayCode = item.sku_code || sku?.sku_code;
  const displayImage = item.image_url || sku?.image_url;
  const displayAttrs = item.attributes || sku?.attributes;
  const inventoryQty = item.max_quantity ?? sku?.inventory ?? 99;
  const isOutOfStock = item.available === false || inventoryQty <= 0;

  return (
    <div className={`store-card p-3 sm:p-4 ${warning ? 'border-warning/30' : ''}`}>
      {/* Desktop */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
        <div className="col-span-5 flex gap-3">
          <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            {displayImage ? (
              <ImageFallback src={displayImage} alt={displayCode || displayName} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ShoppingCartOutlined className="text-xl" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Text strong className="block text-sm truncate">{displayName}</Text>
            {displayCode && displayCode !== displayName && (
              <Text type="secondary" className="text-xs mt-0.5 block truncate">{displayCode}</Text>
            )}
            {displayAttrs && displayAttrs.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {displayAttrs.map((attr) => (
                  <Tag key={attr.id} className="text-[10px] !m-0">{attr.name}: {attr.value}</Tag>
                ))}
              </div>
            )}
            {isOutOfStock && <Tag color="error" className="mt-1 text-xs">已售罄</Tag>}
          </div>
        </div>
        <div className="col-span-2 text-center">
          <Text className="text-sm">¥{item.unit_price.toFixed(2)}</Text>
        </div>
        <div className="col-span-2 flex justify-center">
          <QuantityStepper
            value={item.quantity}
            max={inventoryQty}
            disabled={isOutOfStock || isUpdating}
            onChange={(val) => onQuantityChange(item.sku_id, val)}
          />
        </div>
        <div className="col-span-2 text-center">
          <Text strong className="text-error">¥{item.subtotal.toFixed(2)}</Text>
        </div>
        <div className="col-span-1 text-center">
          <Popconfirm title="删除此商品？" onConfirm={() => onRemove(item.sku_id)} okText="确定" cancelText="取消">
            <Button type="text" danger icon={<DeleteOutlined />} size="small" aria-label="删除商品" />
          </Popconfirm>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex gap-3">
        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
          {displayImage ? (
            <ImageFallback src={displayImage} alt={displayCode || displayName} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ShoppingCartOutlined className="text-xl" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div className="min-w-0 flex-1">
              <Text strong className="text-sm truncate block">{displayName}</Text>
              {displayAttrs && displayAttrs.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {displayAttrs.slice(0, 2).map((attr) => (
                    <Tag key={attr.id} className="text-[10px] !m-0">{attr.name}: {attr.value}</Tag>
                  ))}
                </div>
              )}
            </div>
            <Popconfirm title="删除？" onConfirm={() => onRemove(item.sku_id)} okText="确定" cancelText="取消">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </div>
          <div className="flex items-center justify-between mt-2">
            <Text strong className="text-error text-sm">¥{item.unit_price.toFixed(2)}</Text>
            <QuantityStepper
              value={item.quantity}
              max={inventoryQty}
              disabled={isOutOfStock || isUpdating}
              onChange={(val) => onQuantityChange(item.sku_id, val)}
            />
          </div>
          <div className="text-right mt-1">
            <Text type="secondary" className="text-xs">小计：<Text strong className="text-error">¥{item.subtotal.toFixed(2)}</Text></Text>
          </div>
        </div>
      </div>

      {warning && (
        <AlertBanner message={warning} />
      )}
    </div>
  );
}

/* ─── Shared Sub-components ────────────────────────────────────────── */

function QuantityStepper({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (val: number | null) => void;
}) {
  return (
    <div className="flex items-center border rounded-lg overflow-hidden">
      <button
        type="button"
        disabled={value <= 1 || disabled}
        onClick={() => onChange(value - 1)}
        className="w-8 h-8 flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="减少数量"
      >
        <MinusOutlined className="text-xs" />
      </button>
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
        disabled={disabled}
        className="w-10 h-8 text-center text-sm border-x disabled:opacity-50 bg-transparent"
        aria-label="数量"
      />
      <button
        type="button"
        disabled={value >= max || disabled}
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="增加数量"
      >
        <PlusOutlined className="text-xs" />
      </button>
    </div>
  );
}

function AlertBanner({ message }: { message: string }) {
  return (
    <div className="mt-2 bg-warning/5 border border-warning/20 rounded-lg px-3 py-1.5 text-xs text-warning flex items-center gap-1.5">
      <WarningOutlined /> {message}
    </div>
  );
}
