import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api';
import type { Cart, CartItem, SKU } from '@/types';

interface RecoveryItem { skuId: number; quantity: number }

interface CartState {
  cart?: Cart;
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
  recovery: RecoveryItem[];
  hydrationStatus: 'idle' | 'loading' | 'ready' | 'stale';
  isLoading: boolean;
  lastIssue?: string;
}

interface CartActions {
  addToCart: (sku: SKU, quantity: number) => Promise<CartItem>;
  updateQuantity: (skuId: number, quantity: number) => Promise<void>;
  removeItem: (skuId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  fetchCart: (locale?: string) => Promise<void>;
  mergeGuestCart: () => Promise<void>;
  acknowledgePrice: (cartItemId: number) => Promise<void>;
  setLoading: (loading: boolean) => void;
}

type CartStore = CartState & CartActions;

function currentLocale(): string {
  if (typeof window === 'undefined') return 'es-CL';
  const segment = window.location.pathname.split('/').filter(Boolean)[0];
  return segment === 'en' ? 'en' : 'es-CL';
}

function normalizeCart(wire: Cart): Cart {
  const items = (wire.items || []).map((item) => ({
    ...item,
    id: item.cart_item_id ?? item.id,
    product_name: item.product_name || item.sku_name,
    product_image_url: item.product_image_url || item.image_url,
    variant_attributes: item.variant_attributes || item.attributes || [],
    line_total: item.line_total ?? item.subtotal,
    subtotal: item.line_total ?? item.subtotal,
    max_quantity: item.stock_available ?? item.max_quantity,
  }));
  return {
    ...wire,
    revision: wire.revision || 0,
    requested_locale: wire.requested_locale || currentLocale(),
    resolved_locale: wire.resolved_locale || currentLocale(),
    currency: 'CLP',
    issues: wire.issues || items.flatMap((item) => item.issues || []),
    subtotal: wire.subtotal ?? wire.total_price ?? 0,
    total_price: wire.subtotal ?? wire.total_price ?? 0,
    total_items: wire.total_items ?? items.reduce((sum, item) => sum + item.quantity, 0),
    items,
  };
}

function applyCart(cart: Cart) {
  const normalized = normalizeCart(cart);
  return { cart: normalized, items: normalized.items, totalPrice: normalized.subtotal, totalItems: normalized.total_items, hydrationStatus: 'ready' as const, isLoading: false, lastIssue: undefined, recovery: [] };
}

function isCartResponse(value: unknown): value is Cart {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Cart).items));
}

function idempotencyKey(prefix: string, skuId: number, quantity: number): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${skuId}-${quantity}-${random}`;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [], totalPrice: 0, totalItems: 0, recovery: [], hydrationStatus: 'idle', isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),

      addToCart: async (sku, quantity) => {
        if (quantity <= 0 || quantity > sku.inventory) throw new Error(`Requested quantity exceeds available stock. Available: ${sku.inventory}`);
        set({ isLoading: true });
        try {
          const response = await apiClient.post<{ data: Cart }>(`/cart/items?locale=${encodeURIComponent(currentLocale())}`, { sku_id: sku.id, quantity, idempotency_key: idempotencyKey('add', sku.id, quantity) });
          if (isCartResponse(response.data.data)) set(applyCart(response.data.data));
          else await get().fetchCart();
          const line = get().items.find((item) => item.sku_id === sku.id);
          if (!line) throw new Error('The cart response did not contain the added product.');
          return line;
        } catch (error) { set({ isLoading: false, lastIssue: 'cart_hydration_failed' }); throw error; }
      },

      updateQuantity: async (skuId, quantity) => {
        if (quantity <= 0) throw new Error('Quantity must be positive; use remove instead.');
        const item = get().items.find((candidate) => candidate.sku_id === skuId);
        const max = item?.stock_available ?? item?.max_quantity;
        if (max !== undefined && quantity > max) throw new Error(`Requested quantity exceeds available stock. Available: ${max}`);
        set({ isLoading: true });
        try {
          if (!item) throw new Error('Cart line not found');
          const response = await apiClient.patch<{ data: Cart }>(`/cart/lines/${item.id}?locale=${encodeURIComponent(currentLocale())}`, { quantity, revision: get().cart?.revision });
          if (isCartResponse(response.data.data)) set(applyCart(response.data.data)); else await get().fetchCart();
        } catch (error) { set({ isLoading: false }); throw error; }
      },

      removeItem: async (skuId) => {
        set({ isLoading: true });
        try {
          const item = get().items.find((candidate) => candidate.sku_id === skuId);
          if (!item) throw new Error('Cart line not found');
          const response = await apiClient.delete<{ data: Cart }>(`/cart/lines/${item.id}?locale=${encodeURIComponent(currentLocale())}`, { data: { revision: get().cart?.revision } });
          if (isCartResponse(response.data.data)) set(applyCart(response.data.data)); else await get().fetchCart();
        } catch (error) { set({ isLoading: false }); throw error; }
      },

      clearCart: async () => {
        set({ isLoading: true });
        try {
          const response = await apiClient.delete<{ data: Cart }>('/cart');
          set(applyCart(response.data.data));
        } catch (error) { set({ isLoading: false }); throw error; }
      },

      fetchCart: async (locale = currentLocale()) => {
        set({ isLoading: true, hydrationStatus: 'loading' });
        try {
          const recovery = get().recovery;
          for (const item of recovery) {
            await apiClient.post(`/cart/items?locale=${encodeURIComponent(locale)}`, { sku_id: item.skuId, quantity: item.quantity, idempotency_key: `legacy-${item.skuId}-${item.quantity}` });
          }
          const response = await apiClient.get<{ data: Cart }>(`/cart?locale=${encodeURIComponent(locale)}`);
          set(applyCart(response.data.data));
        } catch { set({ isLoading: false, hydrationStatus: 'stale', lastIssue: 'cart_hydration_failed' }); }
      },

      mergeGuestCart: async () => {
        set({ isLoading: true });
        try {
          const response = await apiClient.post<{ data: Cart }>(`/cart/merge?locale=${encodeURIComponent(currentLocale())}`);
          set(applyCart(response.data.data));
        } catch { await get().fetchCart(); }
      },

      acknowledgePrice: async (cartItemId) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.post<{ data: Cart }>(`/cart/lines/${cartItemId}/acknowledge-price?locale=${encodeURIComponent(currentLocale())}`, { revision: get().cart?.revision });
          set(applyCart(response.data.data));
        } catch (error) { set({ isLoading: false }); throw error; }
      },
    }),
    {
      name: 'cart-storage',
      version: 1,
      migrate: (persisted: unknown, version) => {
        const old = (persisted || {}) as { items?: CartItem[]; recovery?: RecoveryItem[] };
        if (version >= 1) return { recovery: old.recovery || [] };
        const recovery = (old.items || []).filter((item) => item.sku_id > 0 && item.quantity > 0).map((item) => ({ skuId: item.sku_id, quantity: item.quantity }));
        return { recovery };
      },
      partialize: (state) => ({ recovery: state.recovery }),
    },
  ),
);
