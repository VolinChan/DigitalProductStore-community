'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface ImageGalleryProps {
  /** Product images (sorted by sort_order) */
  images: { id: number; image_url: string; thumbnail_url: string; sort_order: number }[];
  /** SKU-specific image URL when a SKU is selected (Requirement 4.3) */
  skuImageUrl?: string;
  /** Product name for alt text */
  productName: string;
}

/**
 * Product image gallery component.
 * Displays a main large image with a thumbnail strip for navigation.
 * When a SKU is selected, shows the SKU-specific image (Requirement 4.3).
 * Supports touch swipe on mobile (Requirement 20.7).
 */
export default function ImageGallery({ images, skuImageUrl, productName }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build the image list: if SKU image exists, prepend it
  const allImages = React.useMemo(() => {
    const baseImages = images.length > 0
      ? images.map((img) => ({
          id: img.id,
          url: img.image_url,
          thumbnail: img.thumbnail_url || img.image_url,
        }))
      : [{ id: 0, url: '/placeholder-product.svg', thumbnail: '/placeholder-product.svg' }];

    if (skuImageUrl) {
      return [
        { id: -1, url: skuImageUrl, thumbnail: skuImageUrl },
        ...baseImages,
      ];
    }
    return baseImages;
  }, [images, skuImageUrl]);

  // Reset to first image when SKU image changes (Requirement 4.5)
  useEffect(() => {
    setSelectedIndex(0);
  }, [skuImageUrl]);

  const currentImage = allImages[selectedIndex] || allImages[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Main Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100 border border-gray-200">
        <Image
          src={currentImage.url}
          alt={`${productName} - 图片 ${selectedIndex + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 500px"
          priority={selectedIndex === 0}
        />
      </div>

      {/* Thumbnail Strip */}
      {allImages.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="listbox"
          aria-label="商品图片选择"
        >
          {allImages.map((img, index) => (
            <button
              key={img.id}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              aria-label={`查看图片 ${index + 1}`}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                index === selectedIndex
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => setSelectedIndex(index)}
            >
              <Image
                src={img.thumbnail}
                alt={`${productName} 缩略图 ${index + 1}`}
                fill
                className="object-cover"
                sizes="80px"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
