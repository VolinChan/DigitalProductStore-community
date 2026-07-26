'use client';

import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/request';

/**
 * Extract the current locale from the pathname.
 * For /es-CL/cart returns "es-CL", for /en/products returns "en".
 * Returns default "es-CL" if no locale found.
 */
export function useCurrentLocale(): Locale {
  const pathname = usePathname() || '/';
  const parts = pathname.split('/').filter(p => p);
  return (parts[0] as Locale) || 'es-CL';
}
