'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Button,
  InputNumber,
  Spin,
  Empty,
  Typography,
  Divider,
  Popconfirm,
  message,
  Alert,
  Tag,
  Image,
} from 'antd';
import {
  DeleteOutlined,
  ShoppingCartOutlined,
  MinusOutlined,
  PlusOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { CartItem } from '@/types';

const { Title, Text } = Typography;

/**
 * Cart page component.
 * Displays cart items with SKU information, quantity adjustment, and price calculation.
 *
 * Requirements:
 * - 6.1: Update cart display with added item including SKU attributes
 * - 6.2: Recalculate total price within 100ms on quantity change
 * - 6.3: Update cart display immediately on item removal
 * - 6.6: Display warning and limit quantity when exceeding available inventory
 * - 6.7: Display SKU-specific information (attributes, price, image) for each cart item
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

  // Fetch cart data on mount for authenticated users
  useEffect(() => {
    async function loadCart() {
      if (isAuthenticated) {
        await fetchCart();
      }
      setInitialLoading(false);
    }
    loadCart();
  }, [isAuthenticated, fetchCart]);

  // Inventory warnings: items where quantity exceeds available stock (Requirement 6.6)
  const inventoryWarnings = useMemo(() => {
    const warnings: Map<number, string> = new Map();
    items.forEach((item) => {
      if (item.sku && item.quantity > item.sku.inventory) {
        warnings.set(
          item.sku_id,
          `库存不足：当前库存仅 ${item.sku.inventory} 件，已自动调整数量`
        );
      }
    });
    return warnings;
  }, [items]);

  // Handle quantity change (Requirement 6.2 - recalculate within 100ms)
  const handleQuantityChange = useCallback(
    async (skuId: number, newQuantity: number | null) => {
      if (!newQuantity || newQuantity < 1) return;

      const item = items.find((i) => i.sku_id === skuId);
      if (!item) return;

      // Check inventory limit (Requirement 6.6)
      if (item.sku && newQuantity > item.sku.inventory) {
        message.warning(`库存不足，最多可购买 ${item.sku.inventory} 件`);
        return;
      }

      setUpdatingItems((prev) => new Set(prev).add(skuId));
      try {
        await updateQuantity(skuId, newQuantity);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '更新数量失败';
        message.error(errorMessage);
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

  // Handle item removal (Requirement 6.3 - update immediately)
  const handleRemoveItem = useCallback(
    async (skuId: number) => {
      try {
        await removeItem(skuId);
        message.success('已从购物车移除');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '移除失败';
        message.error(errorMessage);
      }
    },
    [removeItem]
  );

  // Handle clear cart
  const handleClearCart = useCallback(async () => {
    try {
      await clearCart();
      message.success('购物车已清空');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '清空购物车失败';
      message.error(errorMessage);
    }
  }, [clearCart]);

  // Loading state
  if (initialLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载购物车..." />
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Title level={2} className="!mb-6">
          <ShoppingCartOutlined className="mr-2" />
          购物车
        </Title>
        <div className="flex flex-col items-center justify-center py-16">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="购物车是空的"
          >
            <Link href="/products">
              <Button type="primary" size="large">
                去逛逛
              </Button>
            </Link>
          </Empty>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <Title level={2} className="!mb-0">
          <ShoppingCartOutlined className="mr-2" />
          购物车
          <Text type="secondary" className="text-base font-normal ml-2">
            ({totalItems} 件商品)
          </Text>
        </Title>
        <Popconfirm
          title="确定要清空购物车吗？"
          description="此操作不可撤销"
          onConfirm={handleClearCart}
          okText="确定"
          cancelText="取消"
        >
          <Button danger type="text" size="small">
            清空购物车
          </Button>
        </Popconfirm>
      </div>

      {/* Inventory Warnings (Requirement 6.6) */}
      {inventoryWarnings.size > 0 && (
        <Alert
          message="库存提示"
          description="部分商品库存不足，请调整数量后再结算"
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="mb-4"
          closable
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Cart Items List */}
        <div className="flex-1">
          {/* Desktop Table Header (hidden on mobile) */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 rounded-t-lg text-sm font-medium text-gray-600">
            <div className="col-span-5">商品信息</div>
            <div className="col-span-2 text-center">单价</div>
            <div className="col-span-2 text-center">数量</div>
            <div className="col-span-2 text-center">小计</div>
            <div className="col-span-1 text-center">操作</div>
          </div>

          {/* Cart Items */}
          <div className="border border-gray-200 rounded-lg md:rounded-t-none divide-y divide-gray-200">
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

        {/* Cart Summary Sidebar */}
        <div className="w-full lg:w-80 lg:flex-shrink-0">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-4">
            <Title level={4} className="!mb-4">
              订单摘要
            </Title>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <Text type="secondary">商品数量</Text>
                <Text>{totalItems} 件</Text>
              </div>
              <div className="flex justify-between text-sm">
                <Text type="secondary">商品总价</Text>
                <Text>￥{totalPrice.toFixed(2)}</Text>
              </div>
              <div className="flex justify-between text-sm">
                <Text type="secondary">运费</Text>
                <Text type="secondary">结算时计算</Text>
              </div>
            </div>

            <Divider className="!my-4" />

            <div className="flex justify-between items-baseline mb-6">
              <Text strong className="text-base">
                合计
              </Text>
              <div>
                <span className="text-sm text-red-500">￥</span>
                <span className="text-2xl font-bold text-red-500">
                  {totalPrice.toFixed(2)}
                </span>
              </div>
            </div>

            <Link href="/checkout">
              <Button
                type="primary"
                size="large"
                block
                disabled={inventoryWarnings.size > 0}
              >
                去结算
              </Button>
            </Link>

            {inventoryWarnings.size > 0 && (
              <Text type="warning" className="text-xs mt-2 block text-center">
                请先处理库存不足的商品
              </Text>
            )}

            <Link href="/products">
              <Button type="link" block className="mt-2">
                继续购物
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Individual cart item row component.
 * Displays SKU-specific information including attributes, price, and image (Requirement 6.7).
 */
interface CartItemRowProps {
  item: CartItem;
  isUpdating: boolean;
  warning?: string;
  onQuantityChange: (skuId: number, quantity: number | null) => void;
  onRemove: (skuId: number) => void;
}

function CartItemRow({
  item,
  isUpdating,
  warning,
  onQuantityChange,
  onRemove,
}: CartItemRowProps) {
  const sku = item.sku;
  const maxQuantity = sku ? sku.inventory : 99;
  const isOutOfStock = sku ? sku.inventory <= 0 : false;

  return (
    <div className="p-4">
      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
        {/* Product Info - col-span-5 */}
        <div className="col-span-5 flex gap-3">
          {/* SKU Image (Requirement 6.7) */}
          <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
            {sku?.image_url ? (
              <Image
                src={sku.image_url}
                alt={sku.sku_code || '商品图片'}
                width={80}
                height={80}
                className="object-cover"
                fallback="/placeholder-product.svg"
                preview={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <ShoppingCartOutlined className="text-2xl" />
              </div>
            )}
          </div>

          {/* SKU Details */}
          <div className="min-w-0 flex-1">
            <Text strong className="block text-sm truncate">
              {sku?.sku_code || `SKU #${item.sku_id}`}
            </Text>

            {/* SKU Attributes (Requirement 6.7) */}
            {sku?.attributes && sku.attributes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {sku.attributes.map((attr) => (
                  <Tag key={attr.id} className="text-xs !m-0">
                    {attr.name}: {attr.value}
                  </Tag>
                ))}
              </div>
            )}

            {/* Out of stock indicator */}
            {isOutOfStock && (
              <Tag color="red" className="mt-1 text-xs">
                已售罄
              </Tag>
            )}
          </div>
        </div>

        {/* Unit Price - col-span-2 */}
        <div className="col-span-2 text-center">
          <Text className="text-sm">￥{item.unit_price.toFixed(2)}</Text>
        </div>

        {/* Quantity - col-span-2 */}
        <div className="col-span-2 flex justify-center">
          <div className="flex items-center gap-1">
            <Button
              size="small"
              icon={<MinusOutlined />}
              disabled={item.quantity <= 1 || isUpdating || isOutOfStock}
              onClick={() => onQuantityChange(item.sku_id, item.quantity - 1)}
              aria-label="减少数量"
            />
            <InputNumber
              min={1}
              max={maxQuantity}
              value={item.quantity}
              onChange={(val) => onQuantityChange(item.sku_id, val)}
              disabled={isUpdating || isOutOfStock}
              className="w-14 text-center"
              controls={false}
              size="small"
            />
            <Button
              size="small"
              icon={<PlusOutlined />}
              disabled={item.quantity >= maxQuantity || isUpdating || isOutOfStock}
              onClick={() => onQuantityChange(item.sku_id, item.quantity + 1)}
              aria-label="增加数量"
            />
          </div>
        </div>

        {/* Subtotal - col-span-2 */}
        <div className="col-span-2 text-center">
          <Text strong className="text-red-500">
            ￥{item.subtotal.toFixed(2)}
          </Text>
        </div>

        {/* Actions - col-span-1 */}
        <div className="col-span-1 text-center">
          <Popconfirm
            title="确定要删除此商品吗？"
            onConfirm={() => onRemove(item.sku_id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              aria-label="删除商品"
            />
          </Popconfirm>
        </div>
      </div>

      {/* Mobile Layout (card style) */}
      <div className="md:hidden">
        <div className="flex gap-3">
          {/* SKU Image */}
          <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
            {sku?.image_url ? (
              <Image
                src={sku.image_url}
                alt={sku.sku_code || '商品图片'}
                width={80}
                height={80}
                className="object-cover"
                fallback="/placeholder-product.svg"
                preview={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <ShoppingCartOutlined className="text-2xl" />
              </div>
            )}
          </div>

          {/* Item Details */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <Text strong className="text-sm truncate block max-w-[200px]">
                {sku?.sku_code || `SKU #${item.sku_id}`}
              </Text>
              <Popconfirm
                title="确定要删除此商品吗？"
                onConfirm={() => onRemove(item.sku_id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  aria-label="删除商品"
                />
              </Popconfirm>
            </div>

            {/* SKU Attributes */}
            {sku?.attributes && sku.attributes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {sku.attributes.map((attr) => (
                  <Tag key={attr.id} className="text-xs !m-0">
                    {attr.name}: {attr.value}
                  </Tag>
                ))}
              </div>
            )}

            {/* Price and Quantity Row */}
            <div className="flex items-center justify-between mt-3">
              <Text strong className="text-red-500 text-sm">
                ￥{item.unit_price.toFixed(2)}
              </Text>

              <div className="flex items-center gap-1">
                <Button
                  size="small"
                  icon={<MinusOutlined />}
                  disabled={item.quantity <= 1 || isUpdating || isOutOfStock}
                  onClick={() => onQuantityChange(item.sku_id, item.quantity - 1)}
                  aria-label="减少数量"
                />
                <InputNumber
                  min={1}
                  max={maxQuantity}
                  value={item.quantity}
                  onChange={(val) => onQuantityChange(item.sku_id, val)}
                  disabled={isUpdating || isOutOfStock}
                  className="w-12 text-center"
                  controls={false}
                  size="small"
                />
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={item.quantity >= maxQuantity || isUpdating || isOutOfStock}
                  onClick={() => onQuantityChange(item.sku_id, item.quantity + 1)}
                  aria-label="增加数量"
                />
              </div>
            </div>

            {/* Subtotal */}
            <div className="flex justify-end mt-1">
              <Text type="secondary" className="text-xs">
                小计：
                <Text strong className="text-red-500 text-sm">
                  ￥{item.subtotal.toFixed(2)}
                </Text>
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Warning (Requirement 6.6) */}
      {warning && (
        <div className="mt-2">
          <Alert
            message={warning}
            type="warning"
            showIcon
            className="!py-1 !text-xs"
            banner
          />
        </div>
      )}
    </div>
  );
}