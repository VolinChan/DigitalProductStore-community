'use client';

import React from 'react';
import Link from 'next/link';
import { Tag } from 'antd';
import ImageFallback from '@/components/ImageFallback';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

/**
 * Modern product card component.
 * Requirement 5.5-5.8: Responsive grid, hover effects, rounded corners, subtle border.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images && product.images.length > 0
    ? product.images[0].thumbnail_url || product.images[0].image_url
    : '/placeholder-product.svg';

  const startingPrice = getStartingPrice(product);
  const isOutOfStock = checkOutOfStock(product);

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="store-card overflow-hidden flex flex-col h-full">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
          <ImageFallback
            src={primaryImage}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Tag color="error" className="text-xs px-3 py-1 font-semibold rounded-pill">
                已售罄
              </Tag>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1">
          <h3 className="text-sm sm:text-base font-medium text-foreground line-clamp-2 group-hover:text-accent transition-colors leading-snug">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs sm:text-sm text-muted line-clamp-1">
              {product.description}
            </p>
          )}
          <div className="mt-auto pt-2 flex items-baseline gap-1">
            {startingPrice !== null ? (
              <>
                <span className="text-[10px] text-muted">¥</span>
                <span className="text-lg font-bold text-error">
                  {startingPrice.toFixed(2)}
                </span>
                <span className="text-xs text-muted ml-0.5">起</span>
              </>
            ) : (
              <span className="text-xs text-muted">暂无价格</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function getStartingPrice(product: Product): number | null {
  if (!product.skus || product.skus.length === 0) return null;
  const activeSKUs = product.skus.filter((sku) => sku.is_active);
  if (activeSKUs.length === 0) return null;
  return Math.min(...activeSKUs.map((sku) => sku.price));
}

function checkOutOfStock(product: Product): boolean {
  if (!product.skus || product.skus.length === 0) return false;
  return product.skus.every((sku) => sku.inventory <= 0);
}
