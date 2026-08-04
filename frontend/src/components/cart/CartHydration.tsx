'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useCartStore } from '@/store/useCartStore';

export default function CartHydration() {
  const locale = useLocale();
  const fetchCart = useCartStore((state) => state.fetchCart);
  useEffect(() => { void fetchCart(locale); }, [fetchCart, locale]);
  return null;
}
