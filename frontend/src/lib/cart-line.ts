import type { CartItem } from '@/types';

export interface CartLineDisplay {
  name: string;
  image: string;
  attributes: NonNullable<CartItem['variant_attributes']>;
  skuCode?: string;
  lineTotal: number;
}

/** The only cart/checkout compatibility adapter. UI surfaces must not build
 * independent SKU/product/ID fallback chains. */
export function getCartLineDisplay(item: CartItem, unavailableLabel: string): CartLineDisplay {
  return {
    name: item.product_name || item.sku_name || unavailableLabel,
    image: item.product_image_url || item.image_url || '/placeholder-product.svg',
    attributes: item.variant_attributes || item.attributes || [],
    skuCode: item.sku_code,
    lineTotal: item.line_total ?? item.subtotal,
  };
}
