-- Performance Optimization Migration
-- Version: 2.0
-- Description: Additional indexes for query optimization (Requirement 32.8)
-- Note: Many indexes already exist from 001_init_schema.up.sql.
-- This migration adds composite indexes for common query patterns.

-- ============================================
-- Composite indexes for order queries
-- ============================================

-- Orders filtered by user + status (user order history with status filter)
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- Orders filtered by status + created_at (admin order list with date range)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Orders filtered by payment_method + status (transfer confirmation queries)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_method, status);

-- ============================================
-- Composite indexes for product queries
-- ============================================

-- Products filtered by category + active status (product listing)
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);

-- Products sorted by created_at for active products (new arrivals)
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at DESC);

-- ============================================
-- Composite indexes for SKU queries
-- ============================================

-- SKUs filtered by product + active (product detail page)
CREATE INDEX IF NOT EXISTS idx_skus_product_active ON skus(product_id, is_active);

-- SKUs with low inventory (low stock alerts)
CREATE INDEX IF NOT EXISTS idx_skus_low_inventory ON skus(inventory) WHERE inventory < 10 AND is_active = TRUE;

-- ============================================
-- Composite indexes for payment queries
-- ============================================

-- Payments by method + status (pending transfer list)
CREATE INDEX IF NOT EXISTS idx_payments_method_status ON payments(method, status);

-- ============================================
-- Composite indexes for analytics queries
-- ============================================

-- Analytics events by type + product + timestamp (product analytics)
CREATE INDEX IF NOT EXISTS idx_analytics_type_product_ts ON analytics_events(event_type, product_id, timestamp DESC);

-- Analytics events by session (funnel analysis)
CREATE INDEX IF NOT EXISTS idx_analytics_session_type ON analytics_events(session_id, event_type);

-- ============================================
-- Notes on caching strategy (Requirement 32.9)
-- ============================================
-- Product catalog caching is implemented in the ProductService layer using Redis
-- with a 5-minute TTL. See: backend/internal/services/product_service.go
-- Cache keys follow the pattern: product:list:{hash} and product:detail:{id}
-- Cache invalidation occurs on product create/update/delete operations.
