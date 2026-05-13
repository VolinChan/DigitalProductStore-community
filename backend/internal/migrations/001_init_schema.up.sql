-- Digital Store Initial Schema Migration
-- Version: 1.0
-- Description: Creates all required tables for the digital store system

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- Categories Table (with parent-child hierarchy)
-- ============================================
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for categories
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- ============================================
-- Products Table
-- ============================================
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    specifications JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for products
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_created_at ON products(created_at);

-- Create full-text search index for products
CREATE INDEX idx_products_search ON products USING GIN(
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- ============================================
-- Product Images Table
-- ============================================
CREATE TABLE product_images (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for product_images
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_is_primary ON product_images(is_primary);

-- ============================================
-- SKUs Table (Stock Keeping Units)
-- ============================================
CREATE TABLE skus (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku_code VARCHAR(100) NOT NULL UNIQUE,
    price DECIMAL(10, 2) NOT NULL,
    inventory INTEGER NOT NULL DEFAULT 0,
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraint to ensure non-negative inventory
    CONSTRAINT chk_skus_inventory_non_negative CHECK (inventory >= 0),
    -- Constraint to ensure non-negative price
    CONSTRAINT chk_skus_price_non_negative CHECK (price >= 0)
);

-- Create indexes for skus
CREATE INDEX idx_skus_product_id ON skus(product_id);
CREATE INDEX idx_skus_sku_code ON skus(sku_code);
CREATE INDEX idx_skus_is_active ON skus(is_active);
CREATE INDEX idx_skus_inventory ON skus(inventory);

-- ============================================
-- SKU Attributes Table
-- ============================================
CREATE TABLE sku_attributes (
    id BIGSERIAL PRIMARY KEY,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    value VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for sku_attributes
CREATE INDEX idx_sku_attributes_sku_id ON sku_attributes(sku_id);
CREATE INDEX idx_sku_attributes_name_value ON sku_attributes(name, value);

-- Create unique constraint for attribute combination per SKU
CREATE UNIQUE INDEX idx_sku_attributes_unique ON sku_attributes(sku_id, name);

-- ============================================
-- Carts Table
-- ============================================
CREATE TABLE carts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Ensure either user_id or session_id is set
    CONSTRAINT chk_carts_user_or_session CHECK (
        (user_id IS NOT NULL AND session_id IS NULL) OR
        (user_id IS NULL AND session_id IS NOT NULL)
    )
);

-- Create indexes for carts
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_session_id ON carts(session_id);

-- ============================================
-- Cart Items Table
-- ============================================
CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraint to ensure positive quantity
    CONSTRAINT chk_cart_items_quantity_positive CHECK (quantity > 0),
    -- Constraint to ensure non-negative price
    CONSTRAINT chk_cart_items_price_non_negative CHECK (unit_price >= 0)
);

-- Create indexes for cart_items
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_sku_id ON cart_items(sku_id);

-- Create unique constraint for one SKU per cart
CREATE UNIQUE INDEX idx_cart_items_unique ON cart_items(cart_id, sku_id);

-- ============================================
-- Orders Table
-- ============================================
CREATE TYPE order_status AS ENUM (
    'pending_payment',
    'pending_transfer',
    'paid',
    'pending_shipment',
    'shipped',
    'completed',
    'cancelled',
    'payment_failed'
);

CREATE TYPE payment_method AS ENUM (
    'online',
    'transfer'
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    guest_email VARCHAR(100),
    guest_name VARCHAR(100),
    guest_phone VARCHAR(20),
    shipping_address TEXT NOT NULL,
    status order_status NOT NULL DEFAULT 'pending_payment',
    payment_method payment_method,
    subtotal DECIMAL(12, 2) NOT NULL,
    shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_id BIGINT,
    confirmation_deadline TIMESTAMP WITH TIME ZONE,
    shipping_carrier VARCHAR(50),
    tracking_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraint to ensure non-negative amounts
    CONSTRAINT chk_orders_subtotal_non_negative CHECK (subtotal >= 0),
    CONSTRAINT chk_orders_shipping_fee_non_negative CHECK (shipping_fee >= 0),
    CONSTRAINT chk_orders_total_non_negative CHECK (total_amount >= 0)
);

-- Create indexes for orders
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_guest_email ON orders(guest_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_payment_method ON orders(payment_method);
CREATE INDEX idx_orders_confirmation_deadline ON orders(confirmation_deadline);

-- ============================================
-- Order Items Table
-- ============================================
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    sku_name VARCHAR(200) NOT NULL,
    sku_code VARCHAR(100) NOT NULL,
    attributes TEXT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraint to ensure positive quantity
    CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0),
    -- Constraint to ensure non-negative prices
    CONSTRAINT chk_order_items_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT chk_order_items_subtotal_non_negative CHECK (subtotal >= 0)
);

-- Create indexes for order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_sku_id ON order_items(sku_id);

-- ============================================
-- Payments Table
-- ============================================
CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'cancelled'
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    transaction_id VARCHAR(100),
    transfer_proof_url VARCHAR(500),
    confirmed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    received_amount DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraint to ensure non-negative amounts
    CONSTRAINT chk_payments_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT chk_payments_received_amount_non_negative CHECK (received_amount IS NULL OR received_amount >= 0)
);

-- Create indexes for payments
CREATE UNIQUE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_confirmed_by ON payments(confirmed_by);

-- Add payment_id foreign key to orders (after payments table exists)
ALTER TABLE orders ADD CONSTRAINT fk_orders_payment_id FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- ============================================
-- Inventory Logs Table
-- ============================================
CREATE TABLE inventory_logs (
    id BIGSERIAL PRIMARY KEY,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL,
    change INTEGER NOT NULL,
    reason VARCHAR(200),
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for inventory_logs
CREATE INDEX idx_inventory_logs_sku_id ON inventory_logs(sku_id);
CREATE INDEX idx_inventory_logs_order_id ON inventory_logs(order_id);
CREATE INDEX idx_inventory_logs_admin_id ON inventory_logs(admin_id);
CREATE INDEX idx_inventory_logs_created_at ON inventory_logs(created_at);

-- ============================================
-- Banners Table
-- ============================================
CREATE TABLE banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(100),
    description VARCHAR(500),
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for banners
CREATE INDEX idx_banners_is_active ON banners(is_active);
CREATE INDEX idx_banners_priority ON banners(priority DESC);
CREATE INDEX idx_banners_date_range ON banners(start_date, end_date);

-- ============================================
-- Announcements Table
-- ============================================
CREATE TYPE announcement_type AS ENUM (
    'info',
    'warning',
    'promotion'
);

CREATE TYPE priority AS ENUM (
    'high',
    'medium',
    'low'
);

CREATE TABLE announcements (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type announcement_type NOT NULL DEFAULT 'info',
    priority priority NOT NULL DEFAULT 'medium',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for announcements
CREATE INDEX idx_announcements_is_active ON announcements(is_active);
CREATE INDEX idx_announcements_type ON announcements(type);
CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_date_range ON announcements(start_date, end_date);

-- ============================================
-- Analytics Events Table
-- ============================================
CREATE TYPE analytics_event_type AS ENUM (
    'homepage_view',
    'product_view',
    'add_to_cart',
    'remove_from_cart',
    'checkout_start',
    'order_complete',
    'payment_success',
    'payment_failure'
);

CREATE TABLE analytics_events (
    id BIGSERIAL PRIMARY KEY,
    event_type analytics_event_type NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100) NOT NULL,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    sku_id BIGINT REFERENCES skus(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for analytics_events
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_product_id ON analytics_events(product_id);
CREATE INDEX idx_analytics_events_sku_id ON analytics_events(sku_id);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);

-- Create composite indexes for common query patterns
CREATE INDEX idx_analytics_events_type_timestamp ON analytics_events(event_type, timestamp);
CREATE INDEX idx_analytics_events_product_timestamp ON analytics_events(product_id, timestamp);

-- ============================================
-- Triggers for updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skus_updated_at BEFORE UPDATE ON skus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE users IS 'User accounts including customers and administrators';
COMMENT ON TABLE categories IS 'Product categories with hierarchical structure';
COMMENT ON TABLE products IS 'Products available for sale';
COMMENT ON TABLE product_images IS 'Images associated with products';
COMMENT ON TABLE skus IS 'Stock Keeping Units - specific product variants';
COMMENT ON TABLE sku_attributes IS 'Attributes for SKUs (color, size, etc.)';
COMMENT ON TABLE carts IS 'Shopping carts for users and guests';
COMMENT ON TABLE cart_items IS 'Items in shopping carts';
COMMENT ON TABLE orders IS 'Customer orders';
COMMENT ON TABLE order_items IS 'Line items in orders';
COMMENT ON TABLE payments IS 'Payment records for orders';
COMMENT ON TABLE inventory_logs IS 'History of inventory changes';
COMMENT ON TABLE banners IS 'Homepage banner/carousel images';
COMMENT ON TABLE announcements IS 'System announcements';
COMMENT ON TABLE analytics_events IS 'Events tracked for analytics and conversion rates';
