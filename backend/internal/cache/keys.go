package cache

import (
	"fmt"
	"strings"
)

const (
	// KeyPrefix is the global prefix for all cache keys
	KeyPrefix = "digital-store"

	// DefaultTTL is the default time-to-live for cache entries (5 minutes)
	// As per Requirement 32.9: caching for Product catalog data with 5 minute TTL
	DefaultTTL = 5 * 60 // 5 minutes in seconds
)

// KeyBuilder helps build cache keys with consistent naming conventions
type KeyBuilder struct {
	prefix string
}

// NewKeyBuilder creates a new KeyBuilder with the global prefix
func NewKeyBuilder() *KeyBuilder {
	return &KeyBuilder{
		prefix: KeyPrefix,
	}
}

// Build builds a cache key from the given parts
// Example: Build("products", "list") -> "digital-store:products:list"
func (kb *KeyBuilder) Build(parts ...string) string {
	allParts := append([]string{kb.prefix}, parts...)
	return strings.Join(allParts, ":")
}

// Cache key patterns for different entities
var (
	// Product-related cache keys
	// ProductsKey returns the key for product list cache
	// Example: "digital-store:products:list"
	ProductsKey = func() string {
		return NewKeyBuilder().Build("products", "list")
	}

	// ProductsByCategoryKey returns the key for products filtered by category
	// Example: "digital-store:products:category:123"
	ProductsByCategoryKey = func(categoryID uint) string {
		return NewKeyBuilder().Build("products", "category", fmt.Sprintf("%d", categoryID))
	}

	// ProductDetailKey returns the key for a single product detail
	// Example: "digital-store:product:123"
	ProductDetailKey = func(productID uint) string {
		return NewKeyBuilder().Build("product", fmt.Sprintf("%d", productID))
	}

	// ProductSKUsKey returns the key for a product's SKUs
	// Example: "digital-store:product:123:skus"
	ProductSKUsKey = func(productID uint) string {
		return NewKeyBuilder().Build("product", fmt.Sprintf("%d", productID), "skus")
	}

	// CategoriesKey returns the key for categories list
	// Example: "digital-store:categories:list"
	CategoriesKey = func() string {
		return NewKeyBuilder().Build("categories", "list")
	}

	// CartKey returns the key for a shopping cart
	// Example: "digital-store:cart:session-abc123" (for guests)
	// Example: "digital-store:cart:user:123" (for authenticated users)
	CartKey = func(identifier string) string {
		return NewKeyBuilder().Build("cart", identifier)
	}

	// CartKeyForUser returns the key for a user's shopping cart
	// Example: "digital-store:cart:user:123"
	CartKeyForUser = func(userID uint) string {
		return NewKeyBuilder().Build("cart", "user", fmt.Sprintf("%d", userID))
	}

	// CartKeyForSession returns the key for a guest's shopping cart
	// Example: "digital-store:cart:session:abc123"
	CartKeyForSession = func(sessionID string) string {
		return NewKeyBuilder().Build("cart", "session", sessionID)
	}

	// UserSessionKey returns the key for user session data
	// Example: "digital-store:session:token-abc123"
	UserSessionKey = func(sessionToken string) string {
		return NewKeyBuilder().Build("session", sessionToken)
	}

	// RateLimitKey returns the key for rate limiting
	// Example: "digital-store:ratelimit:192.168.1.1"
	RateLimitKey = func(identifier string) string {
		return NewKeyBuilder().Build("ratelimit", identifier)
	}

	// LoginAttemptsKey returns the key for login attempt tracking
	// Example: "digital-store:login_attempts:user@example.com"
	LoginAttemptsKey = func(email string) string {
		return NewKeyBuilder().Build("login_attempts", email)
	}

	// PasswordResetKey returns the key for password reset tokens
	// Example: "digital-store:password_reset:token-abc123"
	PasswordResetKey = func(token string) string {
		return NewKeyBuilder().Build("password_reset", token)
	}

	// RefreshTokenKey returns the key for refresh token storage
	// Example: "digital-store:refresh_token:user:123"
	RefreshTokenKey = func(userID uint) string {
		return NewKeyBuilder().Build("refresh_token", "user", fmt.Sprintf("%d", userID))
	}

	// BannerKey returns the key for active banners
	// Example: "digital-store:banners:active"
	BannerKey = func() string {
		return NewKeyBuilder().Build("banners", "active")
	}

	// AnnouncementsKey returns the key for active announcements
	// Example: "digital-store:announcements:active"
	AnnouncementsKey = func() string {
		return NewKeyBuilder().Build("announcements", "active")
	}

	// InventoryKey returns the key for SKU inventory cache
	// Example: "digital-store:inventory:sku:123"
	InventoryKey = func(skuID uint) string {
		return NewKeyBuilder().Build("inventory", "sku", fmt.Sprintf("%d", skuID))
	}
)

// TTL constants for different cache types
const (
	// TTL for product catalog (5 minutes as per Requirement 32.9)
	ProductTTL = 5 * 60 // seconds

	// TTL for categories (10 minutes - categories change less frequently)
	CategoryTTL = 10 * 60 // seconds

	// TTL for shopping cart (30 minutes)
	CartTTL = 30 * 60 // seconds

	// TTL for user sessions (24 hours)
	SessionTTL = 24 * 60 * 60 // seconds

	// TTL for rate limiting (1 minute)
	RateLimitTTL = 60 // seconds

	// TTL for login attempts (15 minutes for lockout)
	LoginAttemptTTL = 15 * 60 // seconds

	// TTL for password reset tokens (1 hour)
	PasswordResetTTL = 60 * 60 // seconds

	// TTL for refresh tokens (7 days)
	RefreshTokenTTL = 7 * 24 * 60 * 60 // seconds

	// TTL for banners and announcements (5 minutes)
	ContentTTL = 5 * 60 // seconds

	// TTL for inventory cache (1 minute - needs to be fresh)
	InventoryTTL = 60 // seconds
)
