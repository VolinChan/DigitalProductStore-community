'use client';

import React from 'react';
import { Typography, Divider, Tag, Image } from 'antd';
import { ShoppingOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { CartItem } from '@/types';

const { Title, Text } = Typography;

interface OrderSummaryProps {
  items: CartItem[];
  totalPrice: number;
  shippingFee?: number;
}

/**
 * Order summary component for the checkout page.
 * Displays cart items, subtotal, shipping fee, and total amount.
 *
 * Requirements:
 * - 7.4: Calculate total amount including SKU prices and shipping fees
 */
export default function OrderSummary({
  items,
  totalPrice,
  shippingFee = 0,
}: OrderSummaryProps) {
  const grandTotal = totalPrice + shippingFee;

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <Title level={4} className="!mb-4">
        <ShoppingOutlined className="mr-2" />
        订单摘要
      </Title>

      {/* Items List */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {items.map((item) => (
          <div key={item.sku_id} className="flex gap-3 items-center">
            {/* Item Image */}
            <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100">
              {item.sku?.image_url ? (
                <Image
                  src={item.sku.image_url}
                  alt={item.sku.sku_code || '商品'}
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
              <Text className="text-sm block truncate">
                {item.sku?.sku_code || `SKU #${item.sku_id}`}
              </Text>
              {item.sku?.attributes && item.sku.attributes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {item.sku.attributes.map((attr) => (
                    <Tag key={attr.id} className="text-xs !m-0 !px-1">
                      {attr.name}: {attr.value}
                    </Tag>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity and Price */}
            <div className="text-right flex-shrink-0">
              <Text type="secondary" className="text-xs block">
                x{item.quantity}
              </Text>
              <Text strong className="text-sm">
                ¥{item.subtotal.toFixed(2)}
              </Text>
            </div>
          </div>
        ))}
      </div>

      <Divider className="!my-4" />

      {/* Price Breakdown */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <Text type="secondary">商品小计</Text>
          <Text>¥{totalPrice.toFixed(2)}</Text>
        </div>
        <div className="flex justify-between text-sm">
          <Text type="secondary">运费</Text>
          <Text>{shippingFee > 0 ? `¥${shippingFee.toFixed(2)}` : '免运费'}</Text>
        </div>
      </div>

      <Divider className="!my-3" />

      {/* Grand Total */}
      <div className="flex justify-between items-baseline">
        <Text strong className="text-base">
          应付总额
        </Text>
        <div>
          <span className="text-sm text-red-500">¥</span>
          <span className="text-xl font-bold text-red-500">
            {grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
