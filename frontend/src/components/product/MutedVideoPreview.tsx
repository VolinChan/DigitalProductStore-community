'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccessibilityPreferences } from '@/lib/accessibility/useAccessibilityPreferences';

type PreviewProps = {
  src: string;
  active: boolean;
  hoverOnly?: boolean;
  controls?: boolean;
  onPlayingChange?: (playing: boolean) => void;
};

// Keep the image underneath until actual playback starts. Merely mounting a
// product card must not fetch a video (some merchant uploads exceed 30 MB).
export default function MutedVideoPreview({ src, active, hoverOnly = false, controls = false, onPlayingChange }: PreviewProps) {
  const t = useTranslations('gallery');
  const { preferences } = useAccessibilityPreferences();
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [allowed, setAllowed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [intent, setIntent] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const update = () => setAllowed(!motion.matches && !preferences.reduceMotion && document.documentElement.dataset.accessibilityMotion !== 'reduce' && !connection?.saveData && (!hoverOnly || pointer.matches));
    update();
    motion.addEventListener('change', update);
    pointer.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => {
      motion.removeEventListener('change', update);
      pointer.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
    };
  }, [hoverOnly, preferences.reduceMotion]);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.25), { threshold: [0, 0.25] });
    if (container.current) observer.observe(container.current);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  useEffect(() => {
    if (!active) { setIntent(false); return; }
    const timer = setTimeout(() => setIntent(true), hoverOnly ? 180 : 0);
    return () => clearTimeout(timer);
  }, [active, hoverOnly]);

  useEffect(() => { setFailed(false); setPaused(false); }, [src]);
  const shouldPlay = active && intent && allowed && visible && pageVisible && !paused && !failed;
  useEffect(() => {
    setPlaying(false);
    const element = video.current;
    if (!element || !shouldPlay) return;
    let cancelled = false;
    element.muted = true;
    void element.play().catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [shouldPlay, src]);

  const showingVideo = shouldPlay && playing;
  useEffect(() => { onPlayingChange?.(showingVideo); }, [showingVideo, onPlayingChange]);
  useEffect(() => () => onPlayingChange?.(false), [onPlayingChange]);

  return <div ref={container} className="pointer-events-none absolute inset-0" data-testid="muted-video-preview" data-playing={showingVideo}>
    {shouldPlay && <video
      key={src} ref={video} src={src} muted playsInline loop preload="none" aria-hidden="true" tabIndex={-1}
      className={`h-full w-full bg-white object-contain ${showingVideo ? 'opacity-100' : 'opacity-0'}`}
      onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}
    />}
    {controls && active && allowed && !failed && <button
      type="button" onClick={() => setPaused((value) => !value)}
      className="pointer-events-auto absolute bottom-3 left-3 z-20 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--sf-ink)] shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--sf-accent)]"
      aria-label={paused ? t('resumePreview') : t('pausePreview')}
    >{paused ? t('resumePreview') : t('pausePreview')}</button>}
  </div>;
}
