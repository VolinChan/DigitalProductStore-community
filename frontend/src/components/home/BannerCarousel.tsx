'use client';

import React from 'react';
import Image from 'next/image';
import { Carousel } from 'antd';
import type { Banner } from '@/types';

interface BannerCarouselProps {
  banners: Banner[];
}

/**
 * Banner carousel component for the homepage.
 * Displays active banners sorted by priority with 5-second auto-rotation.
 * Requirement 25.6: Display active banners sorted by priority descending.
 * Requirement 25.8: Automatic rotation with 5-second intervals.
 */
export default function BannerCarousel({ banners }: BannerCarouselProps) {
  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-lg overflow-hidden">
      <Carousel
        autoplay
        autoplaySpeed={5000}
        dots={{ className: 'banner-dots' }}
        effect="fade"
      >
        {banners.map((banner) => (
          <div key={banner.id}>
            {banner.link_url ? (
              <a
                href={banner.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <BannerSlide banner={banner} />
              </a>
            ) : (
              <BannerSlide banner={banner} />
            )}
          </div>
        ))}
      </Carousel>
    </div>
  );
}

function BannerSlide({ banner }: { banner: Banner }) {
  return (
    <div className="relative w-full h-[200px] sm:h-[300px] md:h-[400px] lg:h-[480px]">
      <Image
        src={banner.image_url}
        alt={banner.title}
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
      {(banner.title || banner.description) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 sm:p-6 md:p-8">
          {banner.title && (
            <h2 className="text-white text-lg sm:text-xl md:text-2xl font-bold mb-1">
              {banner.title}
            </h2>
          )}
          {banner.description && (
            <p className="text-white/90 text-sm sm:text-base line-clamp-2">
              {banner.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
