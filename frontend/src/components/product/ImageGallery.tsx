'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PlayCircleOutlined, VideoCameraOutlined } from '@ant-design/icons';
import ImageFallback from '@/components/ImageFallback';
import type { ProductMedia } from '@/types';
import { useTranslations } from 'next-intl';

interface ImageGalleryProps {
  images: { id: number; image_url: string; thumbnail_url?: string; sort_order: number; is_primary?: boolean }[];
  media?: ProductMedia[];
  skuImageUrl?: string;
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

export default function ImageGallery({ images, media = [], skuImageUrl, productName }: ImageGalleryProps) {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo<GalleryItem[]>(() => {
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
    const base = modern.length ? modern : legacy;
    if (skuImageUrl) base.unshift({ id: -1, kind: 'image', url: skuImageUrl, thumbnail: skuImageUrl, alt: productName });
    return base.length ? base : [{ id: 0, kind: 'image', url: '/placeholder-product.svg', thumbnail: '/placeholder-product.svg', alt: productName }];
  }, [images, media, productName, skuImageUrl]);

  useEffect(() => setSelectedIndex(0), [skuImageUrl, media]);
  const current = items[selectedIndex] ?? items[0];
  const isYouTube = current.mimeType === 'video/youtube';

  return <div className="flex min-w-0 flex-col gap-3">
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-gray-50 shadow-sm dark:bg-gray-800">
      {current.kind === 'image' && <ImageFallback src={current.url} alt={current.alt} fill className="object-contain p-2" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 500px" priority={selectedIndex === 0} />}
      {current.kind === 'video' && !isYouTube && <video key={current.url} src={current.url} poster={current.thumbnail} controls preload="metadata" className="h-full w-full object-contain" aria-label={current.alt} />}
      {current.kind === 'video' && isYouTube && <a href={current.url} target="_blank" rel="noopener noreferrer" className="relative block h-full w-full" aria-label={`YouTube: ${current.alt}`}>
        {current.thumbnail ? <ImageFallback src={current.thumbnail} alt={current.alt} fill className="object-contain" sizes="(max-width: 768px) 100vw, 500px" loading="lazy" /> : <VideoCameraOutlined className="absolute left-1/2 top-1/2 text-5xl text-gray-400" />}
        <PlayCircleOutlined className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl text-white drop-shadow" />
      </a>}
    </div>

    {items.length > 1 && <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="listbox" aria-label={t('gallery.title')}>
      {items.map((item, index) => <button key={`${item.kind}-${item.id}`} type="button" role="option" aria-selected={index === selectedIndex} aria-label={t('gallery.viewImage', { num: index + 1 })} className={`relative h-14 w-14 flex-none overflow-hidden rounded-lg border-2 sm:h-16 sm:w-16 ${index === selectedIndex ? 'border-accent ring-1 ring-accent/30' : 'border-transparent hover:border-gray-300'}`} onClick={() => setSelectedIndex(index)}>
        {item.thumbnail ? <ImageFallback src={item.thumbnail} alt="" fill className="object-cover" sizes="64px" loading="lazy" /> : <VideoCameraOutlined className="text-xl text-gray-400" />}
        {item.kind === 'video' && <PlayCircleOutlined className="absolute bottom-1 right-1 text-white drop-shadow" />}
      </button>)}
    </div>}
  </div>;
}
