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
  permissions?: PermissionCode[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'guest' | 'user' | 'operations_manager' | 'product_manager' | 'order_manager' | 'super_admin';

export type PermissionCode =
  | 'manage_staff'
  | 'view_access_audit'
  | 'manage_customers'
  | 'manage_products'
  | 'manage_skus'
  | 'manage_categories'
  | 'manage_inventory'
  | 'manage_orders'
  | 'manage_payments'
  | 'review_transfer_payments'
  | 'manage_notifications'
  | 'manage_shipping'
  | 'manage_content'
  | 'view_sales_analytics'
  | 'view_product_analytics'
  | 'view_conversion_analytics'
  | 'export_analytics'
  | 'manage_system'
  | 'view_system_monitoring'
  | 'manage_integrations'
  | 'manage_catalog_integrations'
  | 'manage_fiscal_documents'
  | 'adjust_external_inventory';

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
  status?: 'draft' | 'published' | 'unpublished' | 'archived';
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
  promoted_sku_id?: number;
  package_length_cm?: number;
  package_width_cm?: number;
  package_height_cm?: number;
  package_weight_kg?: number;
  shipping_template_id?: number;
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
  original_filename?: string;
  deletion_status?: 'active' | 'deletion_pending' | 'objects_deleted' | 'cleanup_failed';
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
  icon_key?: string | null;
  image_asset_id?: number | null;
  image_asset?: MediaAsset | null;
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
  available_to_sell?: number;
  inventory_provider?: string;
  inventory_synced_at?: string;
  inventory_freshness?: string;
  inventory_sellable?: boolean;
  inventory_managed_externally?: boolean;
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
  is_primary: boolean;
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
  revision: number;
  requested_locale: string;
  resolved_locale: string;
  currency: 'CLP';
  items: CartItem[];
  issues: CartLineIssue[];
  subtotal: number;
  total_price: number;
  total_items: number;
}

export type CartLineIssueCode = 'price_changed' | 'insufficient_stock' | 'out_of_stock' | 'sku_inactive' | 'product_unpublished' | 'catalog_missing';

export interface CartLineIssue {
  code: CartLineIssueCode;
  requested_quantity?: number;
  available_quantity?: number;
}

export interface CartItem {
  id: number;
  cart_item_id?: number;
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
	product_id?: number;
	product_slug?: string;
	product_name?: string;
	product_brand?: string;
	product_image_url?: string;
	variant_attributes?: SKUAttribute[];
	requested_locale?: string;
	resolved_locale?: string;
	translation_fallback?: boolean;
	stock_available?: number;
	currency?: 'CLP';
	previous_unit_price?: number;
	line_total?: number;
	price_changed?: boolean;
	issues?: CartLineIssue[];
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
  payment_provider?: string;
  payment_access_token?: string;
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
  transfer_account_snapshot?: TransferPaymentAccount[];
  address_snapshot?: AddressSnapshot;
  shipping_rate_snapshot?: ShippingQuote;
  shipping_base_amount?: number;
  shipping_subsidy_amount?: number;
  shipping_remote_surcharge?: number;
  shipping_payable_amount?: number;
  integration?: OrderIntegrationSummary;
}

export interface InventoryCommitmentSummary {
  provider: string;
  state: 'local_pending' | 'provider_submitting' | 'externally_committed' | 'release_pending' | 'released' | 'failed' | 'manual_attention';
  external_reference?: string;
  provider_reflected: boolean;
  submitted_at?: string;
  committed_at?: string;
  released_at?: string;
  last_error_code?: string;
  last_error_message?: string;
}

export interface OrderDocumentSummary {
  id: number;
  provider: string;
  kind: string;
  lifecycle_status: string;
  external_reference?: string;
  folio?: string;
  sii_status?: string;
  issued_at?: string;
  voided_at?: string;
  synced_at?: string;
  last_error_code?: string;
  last_error_message?: string;
}

export interface OrderIntegrationSummary {
  inventory_commitment?: InventoryCommitmentSummary;
  documents: OrderDocumentSummary[];
}

export interface CheckoutValidation {
  checkout_validation_id?: string;
  digest: string;
  expires_at: string;
  cart_revision: number;
  valid: boolean;
  summary: Cart;
}

export interface ChileRegion { id: number; location_code: string; name: string; sort_order: number; is_active: boolean }
export interface ChileCommune { id: number; region_id: number; location_code: string; name: string; sort_order: number; is_active: boolean }
export interface UserAddress { id: number; user_id: number; label: string; recipient: string; phone: string; region_id: number; commune_id: number; street: string; street_number: string; complement: string; reference: string; is_default: boolean; last_used_at?: string; region?: ChileRegion; commune?: ChileCommune }
export interface AddressSnapshot { version: number; recipient: string; phone: string; region_id: number; region_location_code: string; region_name: string; commune_id: number; commune_location_code: string; commune_name: string; street: string; street_number: string; complement: string; reference: string }
export interface ShippingRateComponent { template_id: number; template_name: string; quantity_mode: 'per_order' | 'per_unit' | 'per_distinct_sku'; rule_id: number; rule_scope: string; product_ids: number[]; sku_ids: number[]; quantity_factor: number; unit_base_amount: number; raw_base_amount: number; remote_surcharge: number }
export interface ShippingQuote { formula_version: string; quote_version: string; region_id: number; commune_id: number; shipping_rate_components: ShippingRateComponent[]; raw_base_amount: number; rounded_base_amount: number; rounding_unit: number; subsidy_id?: number; subsidy_amount: number; remote_surcharge: number; payable_shipping: number; remote_assessment_required: boolean }
export interface ShippingTemplate { id: number; name: string; quantity_mode: 'per_order' | 'per_unit' | 'per_distinct_sku'; is_default: boolean; is_active: boolean }
export interface ShippingAdjustment { id: number; order_id: number; status: 'pending_assessment' | 'awaiting_customer_payment' | 'customer_paid' | 'confirmed' | 'cancelled'; difference_amount?: number; reason?: string; payment_obligation_id?: number; assessed_at?: string; customer_declared_at?: string; confirmed_at?: string }

export interface TransferPaymentAccount {
  id?: number;
  bank_name: string;
  account_name: string;
  rut: string;
  account_type: string;
  account_number: string;
  email: string;
  sort_order: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TransferPaymentConfig {
  bank_name: string;
  account_name: string;
  account_number: string;
  configured: boolean;
  source?: 'admin' | 'env' | 'unconfigured';
  accounts: TransferPaymentAccount[];
}

export interface TransferDeclarationEntry {
  id: number;
  declaration_id: number;
  account_id?: number;
  declared_amount?: number;
  note?: string;
  is_inferred: boolean;
}

export interface TransferProof {
  id: number;
  declaration_id: number;
  entry_id?: number;
  original_filename: string;
  claimed_mime_type?: string;
  detected_mime_type?: string;
  size_bytes: number;
  scan_status: 'pending_scan' | 'clean' | 'quarantined';
  scan_diagnostic_code?: string;
}

export interface TransferDeclaration {
  id: number;
  order_id: number;
  status: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'partially_accepted' | 'rejected';
  rejection_reason?: string;
  shipping_adjustment_id?: number;
  submitted_at: string;
  entries?: TransferDeclarationEntry[];
  proofs?: TransferProof[];
}

export interface PaymentObligation {
  id: number;
  order_id: number;
  obligation_type: 'order_base' | 'shipping_adjustment';
  subject_id: number;
  amount: number;
  allocated_amount: number;
  status: 'pending' | 'partially_received' | 'satisfied' | 'inactive';
  is_active: boolean;
}

export interface VerifiedReceiptAllocation {
  id: number;
  receipt_id: number;
  obligation_id: number;
  allocated_amount: number;
}

export interface VerifiedReceipt {
  id: number;
  order_id: number;
  declaration_id?: number;
  actual_account_id?: number;
  amount: number;
  verified_by: number;
  verified_at: string;
  note?: string;
  allocations?: VerifiedReceiptAllocation[];
}

export interface TransferReviewDetail {
  declaration: TransferDeclaration;
  order: Order;
  obligations: PaymentObligation[];
  receipts: VerifiedReceipt[];
}

export interface NotificationOutbox {
  id: number;
  event_type: string;
  recipient_email?: string;
  status: string;
  aggregate_id: number;
}

export interface DeliveryAttempt {
  id: number;
  outbox_id: number;
  attempt_number: number;
  provider: string;
  provider_message_id?: string;
  status: string;
  diagnostic_code?: string;
  created_at: string;
  outbox?: NotificationOutbox;
}

export interface NotificationEmailTemplate {
  event_type: string;
  locale: 'es-CL' | 'en';
  subject_template: string;
  html_template: string;
  variables: string[];
  is_custom: boolean;
  updated_at?: string;
}

export interface NotificationEmailPreview {
  subject: string;
  title: string;
  body_summary: string;
  html: string;
  deep_link: string;
}

export interface InAppNotification {
  id: number;
  event_key: string;
  event_type: string;
  locale: string;
  title: string;
  body_summary: string;
  deep_link?: string;
  read_at?: string;
  created_at: string;
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
	product_id?: number;
	product_slug_snapshot?: string;
	product_brand_snapshot?: string;
	image_url_snapshot?: string;
	resolved_locale?: string;
	variant_summary_snapshot?: string;
	discount_snapshot?: number;
	tax_snapshot?: number;
	currency?: 'CLP';
}

export type OrderStatus =
  | 'pending_payment'
  | 'pending_transfer'
  | 'paid'
  | 'pending_shipment'
  | 'shipped'
  | 'completed'
  | 'cancelled'
	| 'payment_failed'
	| 'payment_review';

export type PaymentMethod = 'online' | 'transfer';

// ============ Logistics Types ============

export type LogisticsProviderAdapter = 'moveup' | 'manual';
export type LogisticsShipmentStatus = 'submitting' | 'created' | 'in_transit' | 'delivered' | 'failed' | 'manual_attention' | 'cancelled';

export interface LogisticsProvider {
  id: number;
  code: string;
  name: string;
  adapter: LogisticsProviderAdapter;
  api_base_url: string;
  request_domain: string;
  access_token_hint: string;
  credential_configured: boolean;
  service_region_codes: string[];
  settings: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogisticsShipment {
  id: number;
  order_id: number;
  provider_id: number;
  provider?: LogisticsProvider;
  status: LogisticsShipmentStatus;
  provider_status: string;
  provider_shipment_id: string;
  tracking_number: string;
  package_size: number;
  package_quantity: number;
  package_price: number;
  observations: string;
  last_error_code: string;
  last_error_message: string;
  last_synced_at?: string;
  label_fetched_at?: string;
  created_at: string;
  updated_at: string;
}

// ============ Payment Types ============

export interface Payment {
  id: number;
  order_id: number;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  transaction_id?: string;
  provider_status_detail?: string;
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
