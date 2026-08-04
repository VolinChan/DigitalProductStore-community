'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LeftOutlined, PlayCircleOutlined, RightOutlined, VideoCameraOutlined, ZoomInOutlined } from '@ant-design/icons';
import ImageFallback from '@/components/ImageFallback';
import type { ProductMedia, SKUMedia } from '@/types';
import { useTranslations } from 'next-intl';

interface ImageGalleryProps {
  images: { id: number; image_url: string; thumbnail_url?: string; sort_order: number; is_primary?: boolean }[];
  media?: ProductMedia[];
  skuImageUrl?: string;
  skuMedia?: SKUMedia[];
  productName: string;
}

type GalleryItem = {
  id: number;
  kind: 'image' | 'video';
  url: string;
  thumbnail?: string;
  alt: string;
  mimeType?: string;
};

function youtubePoster(url: string) {
  const id = url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}

export default function ImageGallery({ images, media = [], skuImageUrl, skuMedia = [], productName }: ImageGalleryProps) {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });

  const items = useMemo<GalleryItem[]>(() => {
    const skuGallery = [...skuMedia]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id - b.id)
      .flatMap((item) => item.media_asset?.kind === 'image' && item.media_asset.url
        ? [{ id: item.media_asset.id, kind: 'image' as const, url: item.media_asset.url, thumbnail: item.media_asset.url, alt: item.media_asset.alt_text || productName }]
        : []);
    const modern = [...media]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
      .flatMap((item) => {
        const asset = item.media_asset;
        if (!asset) return [];
        const poster = asset.kind === 'video' ? youtubePoster(asset.url) ?? asset.cover_asset?.url : asset.url;
        return [{ id: asset.id, kind: asset.kind, url: asset.url, thumbnail: poster, alt: asset.alt_text || productName, mimeType: asset.mime_type }];
      });
    const legacy: GalleryItem[] = modern.length ? [] : [...images]
      .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || a.sort_order - b.sort_order)
      .map((image) => ({ id: image.id, kind: 'image', url: image.image_url, thumbnail: image.thumbnail_url || image.image_url, alt: productName }));
    const base = skuGallery.length ? skuGallery : modern.length ? modern : legacy;
    if (!skuGallery.length && skuImageUrl) base.unshift({ id: -1, kind: 'image', url: skuImageUrl, thumbnail: skuImageUrl, alt: productName });
    return base.length ? base : [{ id: 0, kind: 'image', url: '/placeholder-product.svg', thumbnail: '/placeholder-product.svg', alt: productName }];
  }, [images, media, productName, skuImageUrl, skuMedia]);

  useEffect(() => setSelectedIndex(0), [skuImageUrl, skuMedia, media]);
  const current = items[selectedIndex] ?? items[0];
  const isYouTube = current.mimeType === 'video/youtube';

  useEffect(() => {
    setIsZoomed(false);
    setZoomPosition({ x: 50, y: 50 });
  }, [current.url]);

  const updateZoomPosition = (clientX: number, clientY: number, element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    setZoomPosition({
      x: Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - bounds.top) / bounds.height) * 100)),
    });
  };

  const selectAdjacentItem = (direction: -1 | 1) => {
    setSelectedIndex((index) => (index + direction + items.length) % items.length);
  };

  return <div className="flex min-w-0 flex-col gap-3">
    <div className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-[#f1f4f2] sm:rounded-[28px]">
      {current.kind === 'image' && <button
        type="button"
        className={`group relative block h-full w-full overflow-hidden text-left ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        aria-label={t('gallery.zoomImage')}
        aria-pressed={isZoomed}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={(event) => updateZoomPosition(event.clientX, event.clientY, event.currentTarget)}
        onPointerDown={(event) => updateZoomPosition(event.clientX, event.clientY, event.currentTarget)}
        onClick={() => setIsZoomed((zoomed) => !zoomed)}
        onBlur={() => setIsZoomed(false)}
      >
        <ImageFallback src={current.url} alt={current.alt} fill className="object-contain p-2" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 500px" priority={selectedIndex === 0} />
        <span
          data-testid="product-image-zoom"
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-[#f1f4f2] bg-no-repeat transition-opacity duration-150 ${isZoomed ? 'opacity-100' : 'opacity-0'}`}
          style={{
            backgroundImage: `url(${JSON.stringify(current.url)})`,
            backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
            backgroundSize: 'auto',
          }}
        />
        <span className="pointer-events-none absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg text-[var(--sf-ink)] shadow-md backdrop-blur-sm transition-transform group-hover:scale-105" aria-hidden="true">
          <ZoomInOutlined />
        </span>
      </button>}
      {current.kind === 'video' && !isYouTube && <video key={current.url} src={current.url} poster={current.thumbnail} controls preload="metadata" className="h-full w-full object-contain" aria-label={current.alt} />}
      {current.kind === 'video' && isYouTube && <a href={current.url} target="_blank" rel="noopener noreferrer" className="relative block h-full w-full" aria-label={`YouTube: ${current.alt}`}>
        {current.thumbnail ? <ImageFallback src={current.thumbnail} alt={current.alt} fill className="object-contain" sizes="(max-width: 768px) 100vw, 500px" loading="lazy" /> : <VideoCameraOutlined className="absolute left-1/2 top-1/2 text-5xl text-gray-400" />}
        <PlayCircleOutlined className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl text-white drop-shadow" />
      </a>}
      {items.length > 1 && <>
        <button type="button" aria-label={t('gallery.previousImage')} onClick={() => selectAdjacentItem(-1)} className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--sf-ink)] shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-accent)] sm:left-3 sm:h-11 sm:w-11">
          <LeftOutlined aria-hidden="true" />
        </button>
        <button type="button" aria-label={t('gallery.nextImage')} onClick={() => selectAdjacentItem(1)} className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--sf-ink)] shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-accent)] sm:right-3 sm:h-11 sm:w-11">
          <RightOutlined aria-hidden="true" />
        </button>
      </>}
    </div>

    {items.length > 1 && <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="listbox" aria-label={t('gallery.title')}>
      {items.map((item, index) => <button key={`${item.kind}-${item.id}`} type="button" role="option" aria-selected={index === selectedIndex} aria-label={t('gallery.viewImage', { num: index + 1 })} className={`relative h-14 w-14 flex-none overflow-hidden rounded-xl border-2 bg-[#f1f4f2] sm:h-16 sm:w-16 ${index === selectedIndex ? 'border-[var(--sf-accent)] ring-2 ring-[var(--sf-accent)]/15' : 'border-transparent hover:border-[var(--sf-line)]'}`} onClick={() => setSelectedIndex(index)}>
        {item.thumbnail ? <ImageFallback src={item.thumbnail} alt="" fill className="object-cover" sizes="64px" loading="lazy" /> : <VideoCameraOutlined className="text-xl text-gray-400" />}
        {item.kind === 'video' && <PlayCircleOutlined className="absolute bottom-1 right-1 text-white drop-shadow" />}
      </button>)}
    </div>}
  </div>;
}
