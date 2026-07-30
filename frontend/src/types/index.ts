/**
 * Shared TypeScript type definitions for the digital store frontend.
 */

// ============ User Types ============

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'guest' | 'user' | 'product_manager' | 'order_manager' | 'super_admin';

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

// ============ Product Types ============

export interface Product {
  id: number;
  name: string;
  description: string;
  description_html?: string;
  description_document?: { version: number; blocks: unknown[] };
  short_description?: string;
  brand?: string;
  model?: string;
  condition?: 'new' | 'used' | 'refurbished';
  warranty_text?: string;
  slug?: string;
  status?: 'draft' | 'published' | 'archived';
  version?: number;
  category_id?: number;
  category?: Category;
  specifications: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  skus?: SKU[];
  images?: ProductImage[];
  media?: ProductMedia[];
  structured_specifications?: ProductSpecification[];
  variant_dimensions?: ProductVariantDimension[];
  completion?: ProductCompletion;
}

export interface ProductCompletion {
  completed: number;
  total: number;
  percent: number;
  sections: Record<string, boolean>;
}

export interface PublishIssue {
  section: 'basic' | 'media' | 'specifications' | 'variants' | 'description';
  path: string;
  code: string;
  message: string;
}

export interface PublishSectionStatus {
  complete: boolean;
  errors: number;
  warnings: number;
}

export interface PublishValidationReport {
  product_id: number;
  version: number;
  can_publish: boolean;
  requires_confirmation: boolean;
  errors: PublishIssue[];
  warnings: PublishIssue[];
  sections: Record<string, PublishSectionStatus>;
  completion: Pick<ProductCompletion, 'completed' | 'total' | 'percent'>;
}

export interface PublishProductResult {
  product_id: number;
  status: 'published';
  version: number;
  published_at: string;
  validation: PublishValidationReport;
}

export interface ProductSpecification {
  id: number;
  group_name: string;
  spec_key: string;
  label: string;
  value_text?: string;
  value_number?: string;
  unit?: string;
  sort_order: number;
}

export interface ProductVariantDimension {
  id: number;
  name: string;
  sort_order: number;
  values?: Array<{ id: number; value: string; color_hex?: string; sort_order: number }>;
}

export interface ProductMedia {
  id: number;
  media_asset_id: number;
  media_asset?: MediaAsset;
  role: string;
  sort_order: number;
  is_primary: boolean;
}

export interface MediaAsset {
  id: number;
  kind: 'image' | 'video';
  storage_key: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  width?: number;
  height?: number;
  duration_seconds?: number;
  thumbnail_key?: string;
  medium_key?: string;
  cover_asset_id?: number;
  cover_asset?: MediaAsset;
  alt_text?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  thumbnail_url?: string;
  sort_order: number;
  is_primary: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
  updated_at?: string;
  children?: Category[];
  spec_template?: CategorySpecTemplateField[];
  variant_template?: CategoryVariantTemplate[];
}

export interface CategorySpecTemplateField {
  group: string;
  label: string;
  key: string;
  input_type: 'short_text' | 'long_text' | 'number' | 'number_unit' | 'single_select' | 'multi_select' | 'boolean';
  unit?: string;
  required?: boolean;
  sort_order: number;
  options?: string[];
}

export interface CategoryVariantTemplate {
  name: string;
  sort_order: number;
}

export interface SKU {
  id: number;
  product_id: number;
  sku_code: string;
  combination_key?: string;
  gtin?: string;
  version?: number;
  price: number;
  inventory: number;
  attributes: SKUAttribute[];
  image_url?: string;
  media?: SKUMedia[];
  is_active: boolean;
  // Optionally preloaded by backend (e.g. cart items, order items detail).
  product?: Product;
}

export interface SKUMedia {
  id: number;
  sku_id: number;
  media_asset_id: number;
  media_asset?: MediaAsset;
  sort_order: number;
}

export interface SKUAttribute {
  id: number;
  sku_id: number;
  name: string;
  value: string;
}

// ============ Cart Types ============

export interface Cart {
  id: number;
  user_id?: number;
  session_id: string;
  items: CartItem[];
  total_price: number;
  total_items: number;
}

export interface CartItem {
  id: number;
  cart_id?: number;
  sku_id: number;
  // Optional embedded SKU (used for guest cart items stored client-side).
  sku?: SKU;
  // Flat fields populated by the backend's CartItemResponse for authenticated
  // carts (so the front-end doesn't need a second round-trip to render).
  sku_code?: string;
  sku_name?: string;
  image_url?: string;
  attributes?: SKUAttribute[];
  available?: boolean;
  max_quantity?: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// ============ Order Types ============

export interface Order {
  id: number;
  order_number: string;
  user_id?: number;
  guest_email?: string;
  guest_name?: string;
  guest_phone?: string;
  shipping_address: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  shipping_fee: number;
  total_amount: number;
  items: OrderItem[];
  payment?: Payment;
  created_at: string;
  updated_at: string;
  confirmation_deadline?: string;
  shipping_carrier?: string;
  tracking_number?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  sku_id: number;
  sku_name: string;
  sku_code: string;
  attributes: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type OrderStatus =
  | 'pending_payment'
  | 'pending_transfer'
  | 'paid'
  | 'pending_shipment'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'payment_failed';

export type PaymentMethod = 'online' | 'transfer';

// ============ Payment Types ============

export interface Payment {
  id: number;
  order_id: number;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  transaction_id?: string;
  transfer_proof_url?: string;
  confirmed_by?: number;
  confirmed_at?: string;
  received_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

// ============ Content Types ============

export interface Banner {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  link_url?: string;
  priority: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: Priority;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
}

export type AnnouncementType = 'info' | 'warning' | 'promotion';
export type Priority = 'high' | 'medium' | 'low';

// ============ API Response Types ============

export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
  metadata?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ListParams {
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
