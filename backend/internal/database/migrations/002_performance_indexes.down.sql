-- Rollback performance indexes

DROP INDEX IF EXISTS idx_orders_user_status;
DROP INDEX IF EXISTS idx_orders_status_created;
DROP INDEX IF EXISTS idx_orders_payment_status;
DROP INDEX IF EXISTS idx_products_category_active;
DROP INDEX IF EXISTS idx_products_active_created;
DROP INDEX IF EXISTS idx_skus_product_active;
DROP INDEX IF EXISTS idx_skus_low_inventory;
DROP INDEX IF EXISTS idx_payments_method_status;
DROP INDEX IF EXISTS idx_analytics_type_product_ts;
DROP INDEX IF EXISTS idx_analytics_session_type;
