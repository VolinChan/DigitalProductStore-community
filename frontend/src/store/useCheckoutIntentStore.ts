'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const BUY_NOW_TTL_MS = 30 * 60 * 1000;

export interface BuyNowIntent {
  mode: 'buy_now';
  productId: number;
  skuId: number;
  quantity: number;
  createdAt: number;
}

interface CheckoutIntentState {
  buyNow: BuyNowIntent | null;
  hydrated: boolean;
  createBuyNow: (input: Omit<BuyNowIntent, 'mode' | 'createdAt'>) => void;
  clearBuyNow: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useCheckoutIntentStore = create<CheckoutIntentState>()(
  persist(
    (set) => ({
      buyNow: null,
      hydrated: false,
      createBuyNow: (input) => set({ buyNow: { mode: 'buy_now', ...input, createdAt: Date.now() } }),
      clearBuyNow: () => set({ buyNow: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'plexoria-checkout-intent',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ buyNow: state.buyNow }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

export function isBuyNowIntentValid(intent: BuyNowIntent | null): intent is BuyNowIntent {
  return Boolean(
    intent &&
    Number.isInteger(intent.productId) && intent.productId > 0 &&
    Number.isInteger(intent.skuId) && intent.skuId > 0 &&
    Number.isInteger(intent.quantity) && intent.quantity > 0 &&
    Date.now() - intent.createdAt <= BUY_NOW_TTL_MS,
  );
}
