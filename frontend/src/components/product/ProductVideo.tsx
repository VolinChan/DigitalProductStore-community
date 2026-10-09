'use client';

import { useEffect, useRef } from 'react';

export default function ProductVideo({ src, poster, label, autoPlay = false }: { src: string; poster?: string; label: string; autoPlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const stopWhenHidden = () => { if (document.hidden) element.pause(); };
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) element.pause(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => { element.pause(); observer.disconnect(); document.removeEventListener('visibilitychange', stopWhenHidden); };
  }, [src]);
  return <video ref={ref} src={src} poster={poster} controls muted playsInline autoPlay={autoPlay} preload="metadata" className="h-full w-full object-contain" aria-label={label} />;
}
