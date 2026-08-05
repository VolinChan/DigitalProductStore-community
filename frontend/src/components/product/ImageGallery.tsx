'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { CloseOutlined, LeftOutlined, PlayCircleOutlined, RightOutlined, VideoCameraOutlined, ZoomInOutlined } from '@ant-design/icons';
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

const thumbnailLimit = 5;

function youtubePoster(url: string) {
  const id = url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}

export default function ImageGallery({ images, media = [], skuImageUrl, skuMedia = [], productName }: ImageGalleryProps) {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [zoomPanel, setZoomPanel] = useState<{ left: number; top: number; size: number } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const ignoreNextClick = useRef(false);
  const ignoreClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightboxTrigger = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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
    setZoomPanel(null);
    setZoomPosition({ x: 50, y: 50 });
  }, [current.url]);

  useEffect(() => () => {
    if (ignoreClickTimer.current) clearTimeout(ignoreClickTimer.current);
  }, []);

  const selectAdjacentItem = useCallback((direction: -1 | 1) => {
    setSelectedIndex((index) => (index + direction + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
        requestAnimationFrame(() => lightboxTrigger.current?.focus());
      }
      if (event.key === 'ArrowLeft' && items.length > 1) selectAdjacentItem(-1);
      if (event.key === 'ArrowRight' && items.length > 1) selectAdjacentItem(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [items.length, lightboxOpen, selectAdjacentItem]);

  const closeLightbox = () => {
    setLightboxOpen(false);
    requestAnimationFrame(() => lightboxTrigger.current?.focus());
  };

  const openLightbox = (index: number, trigger: HTMLElement) => {
    setSelectedIndex(index);
    setIsZoomed(false);
    setZoomPanel(null);
    lightboxTrigger.current = trigger;
    setLightboxOpen(true);
  };

  const updateZoomPosition = (clientX: number, clientY: number, element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    setZoomPosition({
      x: Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - bounds.top) / bounds.height) * 100)),
    });
    const gap = 16;
    const availableWidth = window.innerWidth - bounds.right - gap * 2;
    const size = Math.min(bounds.width, availableWidth, window.innerHeight - gap * 2);
    setZoomPanel(size >= 280 ? {
      left: bounds.right + gap,
      top: Math.max(gap, Math.min(bounds.top, window.innerHeight - size - gap)),
      size,
    } : null);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (items.length <= 1) return;
    const touch = event.touches[0];
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    const touch = event.changedTouches[0];
    swipeStart.current = null;
    if (!start || !touch || items.length <= 1) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return;

    ignoreNextClick.current = true;
    if (ignoreClickTimer.current) clearTimeout(ignoreClickTimer.current);
    ignoreClickTimer.current = setTimeout(() => { ignoreNextClick.current = false; }, 500);
    selectAdjacentItem(deltaX > 0 ? -1 : 1);
  };

  const visibleItems = items.length > thumbnailLimit ? items.slice(0, thumbnailLimit - 1) : items;
  const hiddenCount = items.length - visibleItems.length;

  return <div className="relative flex min-w-0 flex-col gap-3">
    <div
      className="relative aspect-square w-full touch-pan-y select-none overflow-hidden rounded-[22px] border border-solid border-[var(--sf-line)] bg-white sm:rounded-[28px]"
      data-testid="product-gallery-stage"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { swipeStart.current = null; }}
    >
      {current.kind === 'image' && <button
        type="button"
        className="group relative block h-full w-full cursor-zoom-in overflow-hidden text-left"
        aria-label={t('gallery.openGallery')}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => { setIsZoomed(false); setZoomPanel(null); }}
        onMouseMove={(event) => updateZoomPosition(event.clientX, event.clientY, event.currentTarget)}
        onClick={(event) => {
          if (ignoreNextClick.current) {
            ignoreNextClick.current = false;
            return;
          }
          openLightbox(selectedIndex, event.currentTarget);
        }}
        onBlur={() => { setIsZoomed(false); setZoomPanel(null); }}
      >
        <ImageFallback src={current.url} alt={current.alt} fill className="object-contain p-2" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 500px" priority={selectedIndex === 0} />
        <span className="pointer-events-none absolute right-3 top-3 z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg text-[var(--sf-ink)] shadow-md backdrop-blur-sm transition-transform group-hover:scale-105 md:flex" aria-hidden="true">
          <ZoomInOutlined />
        </span>
      </button>}
      {current.kind === 'video' && !isYouTube && <video key={current.url} src={current.url} poster={current.thumbnail} controls preload="metadata" className="h-full w-full object-contain" aria-label={current.alt} />}
      {current.kind === 'video' && isYouTube && <a href={current.url} target="_blank" rel="noopener noreferrer" className="relative block h-full w-full" aria-label={`YouTube: ${current.alt}`}>
        {current.thumbnail ? <ImageFallback src={current.thumbnail} alt={current.alt} fill className="object-contain" sizes="(max-width: 768px) 100vw, 500px" loading="lazy" /> : <VideoCameraOutlined className="absolute left-1/2 top-1/2 text-5xl text-gray-400" />}
        <PlayCircleOutlined className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl text-white drop-shadow" />
      </a>}
      {items.length > 1 && <>
        <button type="button" aria-label={t('gallery.previousImage')} onClick={() => selectAdjacentItem(-1)} className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--sf-ink)] shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-accent)] md:flex">
          <LeftOutlined aria-hidden="true" />
        </button>
        <button type="button" aria-label={t('gallery.nextImage')} onClick={() => selectAdjacentItem(1)} className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--sf-ink)] shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-accent)] md:flex">
          <RightOutlined aria-hidden="true" />
        </button>
      </>}
      {items.length > 1 && <span className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white md:hidden" aria-hidden="true">{selectedIndex + 1} / {items.length}</span>}
    </div>

    {isZoomed && zoomPanel && current.kind === 'image' && <div
      data-testid="product-image-zoom"
      aria-hidden="true"
      className="pointer-events-none fixed z-[70] hidden overflow-hidden rounded-[22px] border border-solid border-[var(--sf-line)] bg-white bg-no-repeat shadow-[0_24px_70px_rgba(21,48,66,0.24)] lg:block"
      style={{
        left: zoomPanel.left,
        top: zoomPanel.top,
        width: zoomPanel.size,
        height: zoomPanel.size,
        backgroundImage: `url(${JSON.stringify(current.url)})`,
        backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
        backgroundSize: '200%',
      }}
    />}

    {items.length > 1 && <div className="grid max-w-full grid-cols-5 gap-2 sm:grid-cols-[repeat(5,4rem)]" role="listbox" aria-label={t('gallery.title')} data-testid="product-gallery-thumbnails">
      {visibleItems.map((item, index) => <button key={`${item.kind}-${item.id}`} type="button" role="option" aria-selected={index === selectedIndex} aria-label={t('gallery.viewImage', { num: index + 1 })} className={`relative aspect-square min-w-0 overflow-hidden rounded-xl border-2 border-solid bg-[#f1f4f2] ${index === selectedIndex ? 'border-[var(--sf-accent)] ring-2 ring-[var(--sf-accent)]/15' : 'border-transparent hover:border-[var(--sf-line)]'}`} onClick={() => setSelectedIndex(index)}>
        {item.thumbnail ? <ImageFallback src={item.thumbnail} alt="" fill className="object-cover" sizes="64px" loading="lazy" /> : <VideoCameraOutlined className="text-xl text-gray-400" />}
        {item.kind === 'video' && <PlayCircleOutlined className="absolute bottom-1 right-1 text-white drop-shadow" />}
      </button>)}
      {hiddenCount > 0 && <button
        type="button"
        role="option"
        aria-selected={selectedIndex >= visibleItems.length}
        aria-label={t('gallery.moreImages', { count: hiddenCount })}
        className={`relative aspect-square min-w-0 overflow-hidden rounded-xl border-2 border-solid bg-[#f1f4f2] text-lg font-black text-[var(--sf-brand)] ${selectedIndex >= visibleItems.length ? 'border-[var(--sf-accent)] ring-2 ring-[var(--sf-accent)]/15' : 'border-transparent hover:border-[var(--sf-line)]'}`}
        onClick={(event) => openLightbox(visibleItems.length, event.currentTarget)}
      >
        {items[visibleItems.length]?.thumbnail && <ImageFallback src={items[visibleItems.length].thumbnail!} alt="" fill className="object-cover opacity-30" sizes="64px" loading="lazy" />}
        <span className="absolute inset-0 flex items-center justify-center bg-white/65">+{hiddenCount}</span>
      </button>}
    </div>}

    {lightboxOpen && <div
      className="fixed inset-0 z-[200] flex touch-pan-y items-center justify-center bg-black/90 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.title')}
      data-testid="product-gallery-lightbox"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { swipeStart.current = null; }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) closeLightbox(); }}
    >
      <button ref={closeButtonRef} type="button" aria-label={t('gallery.closeGallery')} onClick={closeLightbox} className="absolute right-3 top-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6 sm:top-6"><CloseOutlined /></button>
      <div className="relative h-[calc(100dvh-7rem)] w-[calc(100vw-1.5rem)] max-w-5xl sm:h-[calc(100dvh-8rem)] sm:w-[calc(100vw-7rem)]">
        {current.kind === 'image' && <ImageFallback src={current.url} alt={current.alt} fill className="object-contain" sizes="100vw" priority />}
        {current.kind === 'video' && !isYouTube && <video key={current.url} src={current.url} poster={current.thumbnail} controls autoPlay preload="metadata" className="h-full w-full object-contain" aria-label={current.alt} />}
        {current.kind === 'video' && isYouTube && <a href={current.url} target="_blank" rel="noopener noreferrer" className="relative block h-full w-full" aria-label={`YouTube: ${current.alt}`}>
          {current.thumbnail ? <ImageFallback src={current.thumbnail} alt={current.alt} fill className="object-contain" sizes="100vw" /> : <VideoCameraOutlined className="absolute left-1/2 top-1/2 text-6xl text-white" />}
          <PlayCircleOutlined className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl text-white drop-shadow" />
        </a>}
      </div>
      {items.length > 1 && <>
        <button type="button" aria-label={t('gallery.previousImage')} onClick={() => selectAdjacentItem(-1)} className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6"><LeftOutlined /></button>
        <button type="button" aria-label={t('gallery.nextImage')} onClick={() => selectAdjacentItem(1)} className="absolute right-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6"><RightOutlined /></button>
      </>}
      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white sm:bottom-5" aria-live="polite">{t('gallery.counter', { current: selectedIndex + 1, total: items.length })}</p>
    </div>}
  </div>;
}
