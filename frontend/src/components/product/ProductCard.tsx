'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, Tag } from 'antd';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

/**
 * Product card component for grid display.
 * Requirement 5.1: Display primary image, name, starting price, and brief description.
 * Requirement 5.6: Show "out of stock" indicator when all SKUs have zero inventory.
 */
export default function ProductCard({ product }: ProductCardProps) {
  // Get the primary image (first image sorted by sort_order); fall back
  // to a bundled SVG placeholder so we never send next/image a 404 source.
  const primaryImage = product.images && product.images.length > 0
    ? product.images[0].thumbnail_url || product.images[0].image_url
    : '/placeholder-product.svg';

  // Calculate starting price from SKUs
  const startingPrice = getStartingPrice(product);

  // Check if all SKUs are out of stock (Requirement 5.6)
  const isOutOfStock = checkOutOfStock(product);

  return (
    <Link href={`/products/${product.id}`} className="block group">
      <Card
        hoverable
        className="h-full overflow-hidden"
        cover={
          <div className="relative aspect-square overflow-hidden bg-gray-100">
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
            />
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Tag color="red" className="text-base px-3 py-1 font-medium">
                  已售罄
                </Tag>
              </div>
            )}
          </div>
        }
        bodyStyle={{ padding: '12px 16px' }}
      >
        <h3 className="text-sm sm:text-base font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs sm:text-sm text-gray-500 line-clamp-1 mb-2">
            {product.description}
          </p>
        )}
        <div className="flex items-baseline gap-1">
          {startingPrice !== null ? (
            <>
              <span className="text-xs text-gray-500">¥</span>
              <span className="text-lg font-bold text-red-500">
                {startingPrice.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 ml-1">起</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">暂无价格</span>
          )}
        </div>
      </Card>
    </Link>
  );
}

/**
 * Get the lowest price among all active SKUs.
 */
function getStartingPrice(product: Product): number | null {
  if (!product.skus || product.skus.length === 0) {
    return null;
  }

  const activeSKUs = product.skus.filter((sku) => sku.is_active);
  if (activeSKUs.length === 0) {
    return null;
  }

  return Math.min(...activeSKUs.map((sku) => sku.price));
}

/**
 * Check if all SKUs of a product have zero inventory.
 * Requirement 5.6: Display "out of stock" when all SKU items have zero inventory.
 */
function checkOutOfStock(product: Product): boolean {
  if (!product.skus || product.skus.length === 0) {
    return false;
  }

  return product.skus.every((sku) => sku.inventory <= 0);
}
