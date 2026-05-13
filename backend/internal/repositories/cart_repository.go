package repositories

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// CartRepository defines the interface for cart data operations
type CartRepository interface {
	// Create creates a new cart
	Create(ctx context.Context, cart *models.Cart) error

	// GetByID retrieves a cart by ID
	GetByID(ctx context.Context, id uint) (*models.Cart, error)

	// GetByUserID retrieves a cart by user ID
	GetByUserID(ctx context.Context, userID uint) (*models.Cart, error)

	// GetBySessionID retrieves a cart by session ID
	GetBySessionID(ctx context.Context, sessionID string) (*models.Cart, error)

	// Update updates a cart
	Update(ctx context.Context, cart *models.Cart) error

	// Delete deletes a cart
	Delete(ctx context.Context, id uint) error

	// AddItem adds an item to a cart
	AddItem(ctx context.Context, item *models.CartItem) error

	// GetItem retrieves a cart item by cart ID and SKU ID
	GetItem(ctx context.Context, cartID uint, skuID uint) (*models.CartItem, error)

	// UpdateItem updates a cart item
	UpdateItem(ctx context.Context, item *models.CartItem) error

	// DeleteItem deletes a cart item
	DeleteItem(ctx context.Context, id uint) error

	// DeleteItemBySKU deletes a cart item by cart ID and SKU ID
	DeleteItemBySKU(ctx context.Context, cartID uint, skuID uint) error

	// ClearItems removes all items from a cart
	ClearItems(ctx context.Context, cartID uint) error

	// GetCartWithItems retrieves a cart with all its items and SKU details
	GetCartWithItems(ctx context.Context, cartID uint) (*models.Cart, error)
}

// cartRepository implements CartRepository
type cartRepository struct {
	db *gorm.DB
}

// NewCartRepository creates a new cart repository
func NewCartRepository(db *gorm.DB) CartRepository {
	return &cartRepository{db: db}
}

// Create creates a new cart
func (r *cartRepository) Create(ctx context.Context, cart *models.Cart) error {
	if err := r.db.WithContext(ctx).Create(cart).Error; err != nil {
		return fmt.Errorf("failed to create cart: %w", err)
	}
	return nil
}

// GetByID retrieves a cart by ID
func (r *cartRepository) GetByID(ctx context.Context, id uint) (*models.Cart, error) {
	var cart models.Cart
	if err := r.db.WithContext(ctx).First(&cart, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("cart not found")
		}
		return nil, fmt.Errorf("failed to get cart: %w", err)
	}
	return &cart, nil
}

// GetByUserID retrieves a cart by user ID
func (r *cartRepository) GetByUserID(ctx context.Context, userID uint) (*models.Cart, error) {
	var cart models.Cart
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		First(&cart).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("cart not found")
		}
		return nil, fmt.Errorf("failed to get cart by user ID: %w", err)
	}
	return &cart, nil
}

// GetBySessionID retrieves a cart by session ID
func (r *cartRepository) GetBySessionID(ctx context.Context, sessionID string) (*models.Cart, error) {
	var cart models.Cart
	if err := r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		First(&cart).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("cart not found")
		}
		return nil, fmt.Errorf("failed to get cart by session ID: %w", err)
	}
	return &cart, nil
}

// Update updates a cart
func (r *cartRepository) Update(ctx context.Context, cart *models.Cart) error {
	if err := r.db.WithContext(ctx).Save(cart).Error; err != nil {
		return fmt.Errorf("failed to update cart: %w", err)
	}
	return nil
}

// Delete deletes a cart
func (r *cartRepository) Delete(ctx context.Context, id uint) error {
	// Delete cart items first (cascade)
	if err := r.db.WithContext(ctx).
		Where("cart_id = ?", id).
		Delete(&models.CartItem{}).Error; err != nil {
		return fmt.Errorf("failed to delete cart items: %w", err)
	}

	// Delete the cart
	if err := r.db.WithContext(ctx).Delete(&models.Cart{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete cart: %w", err)
	}
	return nil
}

// AddItem adds an item to a cart
func (r *cartRepository) AddItem(ctx context.Context, item *models.CartItem) error {
	if err := r.db.WithContext(ctx).Create(item).Error; err != nil {
		return fmt.Errorf("failed to add cart item: %w", err)
	}
	return nil
}

// GetItem retrieves a cart item by cart ID and SKU ID
func (r *cartRepository) GetItem(ctx context.Context, cartID uint, skuID uint) (*models.CartItem, error) {
	var item models.CartItem
	if err := r.db.WithContext(ctx).
		Where("cart_id = ? AND sku_id = ?", cartID, skuID).
		First(&item).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("cart item not found")
		}
		return nil, fmt.Errorf("failed to get cart item: %w", err)
	}
	return &item, nil
}

// UpdateItem updates a cart item
func (r *cartRepository) UpdateItem(ctx context.Context, item *models.CartItem) error {
	if err := r.db.WithContext(ctx).Save(item).Error; err != nil {
		return fmt.Errorf("failed to update cart item: %w", err)
	}
	return nil
}

// DeleteItem deletes a cart item
func (r *cartRepository) DeleteItem(ctx context.Context, id uint) error {
	if err := r.db.WithContext(ctx).Delete(&models.CartItem{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete cart item: %w", err)
	}
	return nil
}

// DeleteItemBySKU deletes a cart item by cart ID and SKU ID
func (r *cartRepository) DeleteItemBySKU(ctx context.Context, cartID uint, skuID uint) error {
	if err := r.db.WithContext(ctx).
		Where("cart_id = ? AND sku_id = ?", cartID, skuID).
		Delete(&models.CartItem{}).Error; err != nil {
		return fmt.Errorf("failed to delete cart item: %w", err)
	}
	return nil
}

// ClearItems removes all items from a cart
func (r *cartRepository) ClearItems(ctx context.Context, cartID uint) error {
	if err := r.db.WithContext(ctx).
		Where("cart_id = ?", cartID).
		Delete(&models.CartItem{}).Error; err != nil {
		return fmt.Errorf("failed to clear cart items: %w", err)
	}
	return nil
}

// GetCartWithItems retrieves a cart with all its items and SKU details
func (r *cartRepository) GetCartWithItems(ctx context.Context, cartID uint) (*models.Cart, error) {
	var cart models.Cart
	if err := r.db.WithContext(ctx).
		Preload("Items.SKU.Attributes").
		Preload("Items.SKU.Product").
		First(&cart, cartID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("cart not found")
		}
		return nil, fmt.Errorf("failed to get cart with items: %w", err)
	}
	return &cart, nil
}
