-- Digital Store Initial Schema Migration - Rollback
-- Version: 1.0

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_skus_updated_at ON skus;
DROP TRIGGER IF EXISTS update_carts_updated_at ON carts;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_banners_updated_at ON banners;
DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order of creation (respecting foreign key constraints)
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS sku_attributes;
DROP TABLE IF EXISTS skus;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- Drop enum types
DROP TYPE IF EXISTS analytics_event_type;
DROP TYPE IF EXISTS priority;
DROP TYPE IF EXISTS announcement_type;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS order_status;
