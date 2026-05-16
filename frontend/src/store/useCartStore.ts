import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api';
import type { Cart, CartItem, SKU } from '@/types';
import { useAuthStore } from './useAuthStore';

interface CartState {
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
  isLoading: boolean;
}

interface CartActions {
  addToCart: (sku: SKU, quantity: number) => Promise<void>;
  updateQuantity: (skuId: number, quantity: number) => Promise<void>;
  removeItem: (skuId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  fetchCart: () => Promise<void>;
  mergeGuestCart: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

type CartStore = CartState & CartActions;

/**
 * Recalculate cart totals from items.
 * Provides immediate UI updates without waiting for API response.
 */
function calculateTotals(items: CartItem[]): { totalPrice: number; totalItems: number } {
  const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return { totalPrice, totalItems };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // State
      items: [],
      totalPrice: 0,
      totalItems: 0,
      isLoading: false,

      // Actions
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      addToCart: async (sku: SKU, quantity: number) => {
        const { isAuthenticated } = useAuthStore.getState();
        const { items } = get();

        // Validate quantity against available inventory (Requirement 6.6)
        if (quantity > sku.inventory) {
          throw new Error(`Requested quantity exceeds available stock. Available: ${sku.inventory}`);
        }

        if (isAuthenticated) {
          // Authenticated user: sync with backend API
          set({ isLoading: true });
          try {
            await apiClient.post('/cart/items', { sku_id: sku.id, quantity });
            await get().fetchCart();
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        } else {
          // Guest user: persist to localStorage
          const existingIndex = items.findIndex((item) => item.sku_id === sku.id);
          let updatedItems: CartItem[];

          if (existingIndex >= 0) {
            // Update existing item quantity
            const newQuantity = items[existingIndex].quantity + quantity;

            // Validate total quantity against inventory
            if (newQuantity > sku.inventory) {
              throw new Error(`Total quantity exceeds available stock. Available: ${sku.inventory}`);
            }

            updatedItems = items.map((item, index) =>
              index === existingIndex
                ? {
                    ...item,
                    quantity: newQuantity,
                    subtotal: sku.price * newQuantity,
                  }
                : item
            );
          } else {
            // Add new item
            const newItem: CartItem = {
              id: Date.now(), // Temporary ID for guest cart
              cart_id: 0,
              sku_id: sku.id,
              sku,
              quantity,
              unit_price: sku.price,
              subtotal: sku.price * quantity,
            };
            updatedItems = [...items, newItem];
          }

          const totals = calculateTotals(updatedItems);
          set({ items: updatedItems, ...totals });
        }
      },

      updateQuantity: async (skuId: number, quantity: number) => {
        const { isAuthenticated } = useAuthStore.getState();
        const { items } = get();

        // Find the item to validate inventory
        const item = items.find((i) => i.sku_id === skuId);
        if (!item) return;

        // Validate quantity against available inventory (Requirement 6.6)
        if (item.sku && quantity > item.sku.inventory) {
          throw new Error(`Requested quantity exceeds available stock. Available: ${item.sku.inventory}`);
        }

        if (quantity <= 0) {
          // Remove item if quantity is 0 or less
          await get().removeItem(skuId);
          return;
        }

        if (isAuthenticated) {
          // Authenticated user: sync with backend API
          set({ isLoading: true });
          try {
            await apiClient.put(`/cart/items/${skuId}`, { quantity });
            await get().fetchCart();
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        } else {
          // Guest user: update localStorage (Requirement 6.2 - recalculate within 100ms)
          const updatedItems = items.map((i) =>
            i.sku_id === skuId
              ? { ...i, quantity, subtotal: i.unit_price * quantity }
              : i
          );
          const totals = calculateTotals(updatedItems);
          set({ items: updatedItems, ...totals });
        }
      },

      removeItem: async (skuId: number) => {
        const { isAuthenticated } = useAuthStore.getState();
        const { items } = get();

        if (isAuthenticated) {
          // Authenticated user: sync with backend API
          set({ isLoading: true });
          try {
            await apiClient.delete(`/cart/items/${skuId}`);
            await get().fetchCart();
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        } else {
          // Guest user: remove from localStorage (Requirement 6.3 - update immediately)
          const updatedItems = items.filter((i) => i.sku_id !== skuId);
          const totals = calculateTotals(updatedItems);
          set({ items: updatedItems, ...totals });
        }
      },

      clearCart: async () => {
        const { isAuthenticated } = useAuthStore.getState();

        if (isAuthenticated) {
          set({ isLoading: true });
          try {
            await apiClient.delete('/cart');
            set({ items: [], totalPrice: 0, totalItems: 0, isLoading: false });
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        } else {
          // Guest user: clear localStorage
          set({ items: [], totalPrice: 0, totalItems: 0 });
        }
      },

      fetchCart: async () => {
        const { isAuthenticated } = useAuthStore.getState();

        if (!isAuthenticated) return;

        set({ isLoading: true });
        try {
          const response = await apiClient.get<{ data: Cart }>('/cart');
          const cart = response.data.data;
          set({
            items: cart.items || [],
            totalPrice: cart.total_price,
            totalItems: cart.total_items,
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      },

      /**
       * Merge guest cart with authenticated user's cart after login.
       * Implements Requirement 6.4 - persist cart data for authenticated users.
       *
       * Guest items live in localStorage (not on the backend) because the
       * cart store keeps them client-side for guests. After login we push
       * each guest item to the backend with the auth token so it lands in
       * the user's cart, then call /cart/merge so any cookie-based guest
       * cart on the server side is also folded in.
       */
      mergeGuestCart: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) return;

        const localItems = get().items;

        set({ isLoading: true });
        try {
          // Push each locally-stored guest item to the backend cart.
          for (const item of localItems) {
            try {
              await apiClient.post('/cart/items', {
                sku_id: item.sku_id,
                quantity: item.quantity,
              });
            } catch {
              // Ignore individual failures (out of stock, sku gone, etc.)
              // so a single bad item doesn't abort the whole merge.
            }
          }

          // Fold in any server-side guest cart keyed by session cookie.
          // The endpoint is no-op when no guest cart exists.
          try {
            await apiClient.post('/cart/merge');
          } catch {
            // Best-effort
          }

          // Refresh from backend so totals reflect the authoritative state.
          await get().fetchCart();
        } catch {
          await get().fetchCart();
        }
      },
    }),
    {
      name: 'cart-storage',
      // Only persist cart data for guest users
      partialize: (state) => ({
        items: state.items,
        totalPrice: state.totalPrice,
        totalItems: state.totalItems,
      }),
    }
  )
);
