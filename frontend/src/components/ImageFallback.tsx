'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface ImageFallbackProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  placeholder?: 'blur' | 'empty';
}

/**
 * Shared image component with broken-image fallback.
 * Requirement 23.11: Show placeholder without broken-image icons.
 * Requirement 43.5: Normalize frontend image URL construction.
 */
export default function ImageFallback({
  src,
  alt,
  width,
  height,
  fill,
  className = '',
  sizes,
  priority,
  loading = 'lazy',
  ...props
}: ImageFallbackProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
        style={{ width, height }}
        role="img"
        aria-label={alt || 'Loading image'}
      >
        <svg
          className="w-8 h-8 text-gray-400 dark:text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
      loading={loading}
      onError={() => setError(true)}
      {...props}
    />
  );
}
