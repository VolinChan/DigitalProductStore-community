'use client';

import React from 'react';
import { Typography, Divider, Tag, Image } from 'antd';
import { ShoppingOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { CartItem } from '@/types';
import { useTranslations } from 'next-intl';

const { Title, Text } = Typography;

interface OrderSummaryProps {
  items: CartItem[];
  totalPrice: number;
  shippingFee?: number;
}

/**
 * Order summary component for the checkout page.
 */
export default function OrderSummary({
  items,
  totalPrice,
  shippingFee = 0,
}: OrderSummaryProps) {
  const t = useTranslations();
  const grandTotal = totalPrice + shippingFee;

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <Title level={4} className="!mb-4">
        <ShoppingOutlined className="mr-2" />
        {t('checkout.orderSummary')}
      </Title>

      {/* Items List */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {items.map((item) => {
          const displayName =
            item.sku?.product?.name ||
            item.sku_name ||
            item.sku?.sku_code ||
            item.sku_code ||
            `SKU #${item.sku_id}`;
          const displayImage = item.image_url || item.sku?.image_url;
          const displayAttrs = item.attributes || item.sku?.attributes;

          return (
          <div key={item.sku_id} className="flex gap-3 items-center">
            {/* Item Image */}
            <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100">
              {displayImage ? (
                <Image
                  src={displayImage}
                  alt={displayName}
                  width={48}
                  height={48}
                  className="object-cover"
                  fallback="/placeholder-product.svg"
                  preview={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ShoppingCartOutlined />
                </div>
              )}
            </div>

            {/* Item Details */}
            <div className="flex-1 min-w-0">
              <Text className="text-sm block truncate">{displayName}</Text>
              {displayAttrs && displayAttrs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {displayAttrs.map((attr) => (
                    <Tag key={attr.id} className="text-xs !m-0 !px-1">
                      {attr.name}: {attr.value}
                    </Tag>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity and Price */}
            <div className="text-right flex-shrink-0">
              <Text type="secondary" className="text-xs block">x{item.quantity}</Text>
              <Text strong className="text-sm">{formatCLP(item.subtotal)}</Text>
            </div>
          </div>
          );
        })}
      </div>

      <Divider className="!my-4" />

      {/* Price Breakdown */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <Text type="secondary">{t('cart.itemCount')}</Text>
          <Text>{formatCLP(totalPrice)}</Text>
        </div>
        <div className="flex justify-between text-sm">
          <Text type="secondary">{t('cart.shippingFee')}</Text>
          <Text>{shippingFee > 0 ? formatCLP(shippingFee) : t('common.free')}</Text>
        </div>
      </div>

      <Divider className="!my-3" />

      {/* Grand Total */}
      <div className="flex justify-between items-baseline">
        <Text strong className="text-base">{t('cart.total')}</Text>
        <div>
          <span className="text-xl font-bold text-error">{formatCLP(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
