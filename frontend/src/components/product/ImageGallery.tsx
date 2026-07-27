'use client';

import React, { useState, useEffect } from 'react';
import ImageFallback from '@/components/ImageFallback';
import { useTranslations } from 'next-intl';

interface ImageGalleryProps {
  images: { id: number; image_url: string; thumbnail_url?: string; sort_order: number; is_primary?: boolean }[];
  skuImageUrl?: string;
  productName: string;
}

export default function ImageGallery({ images, skuImageUrl, productName }: ImageGalleryProps) {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allImages = React.useMemo(() => {
    const baseImages = images.length > 0
      ? [...images].sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || a.sort_order - b.sort_order).map((img) => ({
          id: img.id,
          url: img.image_url,
          thumbnail: img.thumbnail_url || img.image_url,
        }))
      : [{ id: 0, url: '/placeholder-product.svg', thumbnail: '/placeholder-product.svg' }];

    if (skuImageUrl) {
      return [{ id: -1, url: skuImageUrl, thumbnail: skuImageUrl }, ...baseImages];
    }
    return baseImages;
  }, [images, skuImageUrl]);

  useEffect(() => { setSelectedIndex(0); }, [skuImageUrl]);

  const currentImage = allImages[selectedIndex] || allImages[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800 border shadow-sm">
        <ImageFallback
          src={currentImage.url}
          alt={`${productName} - ${t('gallery.image', { num: selectedIndex + 1 })}`}
          fill
          className="object-contain p-2"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 500px"
          priority={selectedIndex === 0}
        />
      </div>

      {allImages.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
          role="listbox"
          aria-label={t('gallery.title')}
        >
          {allImages.map((img, index) => (
            <button
              key={img.id}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              aria-label={t('gallery.viewImage', { num: index + 1 })}
              className={`relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                index === selectedIndex
                  ? 'border-accent ring-1 ring-accent/30 shadow-md'
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => setSelectedIndex(index)}
            >
              <ImageFallback
                src={img.thumbnail}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
