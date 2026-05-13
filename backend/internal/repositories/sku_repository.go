package repositories

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// SKURepository defines the interface for SKU data operations
type SKURepository interface {
	Create(ctx context.Context, sku *models.SKU) error
	GetByID(ctx context.Context, id uint) (*models.SKU, error)
	GetBySKUCode(ctx context.Context, skuCode string) (*models.SKU, error)
	ListByProductID(ctx context.Context, productID uint) ([]*models.SKU, error)
	Update(ctx context.Context, sku *models.SKU) error
	Delete(ctx context.Context, id uint) error
	CheckAvailability(ctx context.Context, id uint, quantity int) (bool, error)
	GetWithAttributes(ctx context.Context, id uint) (*models.SKU, error)
	CheckUniqueAttributes(ctx context.Context, productID uint, attributes []models.SKUAttribute, excludeSKUID *uint) (bool, error)

	// DecrementInventory atomically reduces the SKU's inventory by the given
	// quantity. Returns an error if the SKU is inactive, missing, or has
	// insufficient inventory. The update is performed as a single SQL
	// statement with a WHERE guard so concurrent callers cannot oversell.
	DecrementInventory(ctx context.Context, skuID uint, quantity int) error

	// IncrementInventory atomically increases the SKU's inventory by the
	// given quantity. Used to restore inventory after order cancellation or
	// to compensate for failed order persistence.
	IncrementInventory(ctx context.Context, skuID uint, quantity int) error
}

// ErrInsufficientInventory is returned when an inventory decrement cannot be
// satisfied (either the SKU is missing, inactive, or has fewer units than
// requested).
var ErrInsufficientInventory = fmt.Errorf("insufficient inventory")

// skuRepository implements SKURepository
type skuRepository struct {
	db *gorm.DB
}

// NewSKURepository creates a new SKU repository
func NewSKURepository(db *gorm.DB) SKURepository {
	return &skuRepository{db: db}
}

// Create creates a new SKU
func (r *skuRepository) Create(ctx context.Context, sku *models.SKU) error {
	if err := r.db.WithContext(ctx).Create(sku).Error; err != nil {
		return fmt.Errorf("failed to create SKU: %w", err)
	}
	return nil
}

// GetByID retrieves a SKU by ID
func (r *skuRepository) GetByID(ctx context.Context, id uint) (*models.SKU, error) {
	var sku models.SKU
	if err := r.db.WithContext(ctx).
		Preload("Product").
		First(&sku, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("SKU not found")
		}
		return nil, fmt.Errorf("failed to get SKU: %w", err)
	}
	return &sku, nil
}

// GetBySKUCode retrieves a SKU by SKU code
func (r *skuRepository) GetBySKUCode(ctx context.Context, skuCode string) (*models.SKU, error) {
	var sku models.SKU
	if err := r.db.WithContext(ctx).
		Preload("Product").
		Preload("Attributes").
		Where("sku_code = ?", skuCode).
		First(&sku).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("SKU not found")
		}
		return nil, fmt.Errorf("failed to get SKU: %w", err)
	}
	return &sku, nil
}

// GetWithAttributes retrieves a SKU with all its attributes
func (r *skuRepository) GetWithAttributes(ctx context.Context, id uint) (*models.SKU, error) {
	var sku models.SKU
	if err := r.db.WithContext(ctx).
		Preload("Product").
		Preload("Attributes").
		First(&sku, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("SKU not found")
		}
		return nil, fmt.Errorf("failed to get SKU with attributes: %w", err)
	}
	return &sku, nil
}

// ListByProductID retrieves all SKUs for a product
func (r *skuRepository) ListByProductID(ctx context.Context, productID uint) ([]*models.SKU, error) {
	var skus []*models.SKU
	if err := r.db.WithContext(ctx).
		Preload("Attributes").
		Where("product_id = ?", productID).
		Order("id ASC").
		Find(&skus).Error; err != nil {
		return nil, fmt.Errorf("failed to list SKUs: %w", err)
	}
	return skus, nil
}

// Update updates a SKU
func (r *skuRepository) Update(ctx context.Context, sku *models.SKU) error {
	if err := r.db.WithContext(ctx).Save(sku).Error; err != nil {
		return fmt.Errorf("failed to update SKU: %w", err)
	}
	return nil
}

// Delete deletes a SKU
func (r *skuRepository) Delete(ctx context.Context, id uint) error {
	// Check if SKU has pending orders
	var count int64
	if err := r.db.WithContext(ctx).
		Table("order_items").
		Joins("JOIN orders ON order_items.order_id = orders.id").
		Where("order_items.sku_id = ? AND orders.status NOT IN (?)", id, []string{"completed", "cancelled"}).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check SKU orders: %w", err)
	}

	if count > 0 {
		return fmt.Errorf("cannot delete SKU with pending orders")
	}

	// Delete the SKU (cascade will handle attributes)
	if err := r.db.WithContext(ctx).Delete(&models.SKU{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete SKU: %w", err)
	}
	return nil
}

// CheckAvailability checks if a SKU has sufficient inventory
func (r *skuRepository) CheckAvailability(ctx context.Context, id uint, quantity int) (bool, error) {
	var sku models.SKU
	if err := r.db.WithContext(ctx).
		Select("inventory", "is_active").
		First(&sku, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, fmt.Errorf("SKU not found")
		}
		return false, fmt.Errorf("failed to check SKU availability: %w", err)
	}

	if !sku.IsActive {
		return false, nil
	}

	return sku.Inventory >= quantity, nil
}

// CheckUniqueAttributes checks if the attribute combination is unique for a product
// excludeSKUID is used when updating an existing SKU to exclude it from the check
func (r *skuRepository) CheckUniqueAttributes(ctx context.Context, productID uint, attributes []models.SKUAttribute, excludeSKUID *uint) (bool, error) {
	// Get all SKUs for this product
	var skus []*models.SKU
	query := r.db.WithContext(ctx).
		Preload("Attributes").
		Where("product_id = ?", productID)

	if excludeSKUID != nil {
		query = query.Where("id != ?", *excludeSKUID)
	}

	if err := query.Find(&skus).Error; err != nil {
		return false, fmt.Errorf("failed to get SKUs: %w", err)
	}

	// Check if any SKU has the same attribute combination
	for _, sku := range skus {
		if r.attributesMatch(sku.Attributes, attributes) {
			return false, nil
		}
	}

	return true, nil
}

// attributesMatch checks if two attribute sets match
func (r *skuRepository) attributesMatch(attrs1 []*models.SKUAttribute, attrs2 []models.SKUAttribute) bool {
	if len(attrs1) != len(attrs2) {
		return false
	}

	// Create a map of name->value for attrs1
	attrMap := make(map[string]string)
	for _, attr := range attrs1 {
		attrMap[attr.Name] = attr.Value
	}

	// Check if all attrs2 match
	for _, attr := range attrs2 {
		if val, exists := attrMap[attr.Name]; !exists || val != attr.Value {
			return false
		}
	}

	return true
}

// DecrementInventory atomically reduces inventory for the given SKU. The
// update runs inside a single SQL statement guarded by WHERE conditions that
// require the SKU to exist, be active, and have sufficient inventory. This
// prevents race conditions between concurrent order creations.
func (r *skuRepository) DecrementInventory(ctx context.Context, skuID uint, quantity int) error {
	if quantity <= 0 {
		return fmt.Errorf("quantity must be greater than 0")
	}

	db := r.dbFromContext(ctx)
	result := db.Model(&models.SKU{}).
		Where("id = ? AND is_active = ? AND inventory >= ?", skuID, true, quantity).
		UpdateColumn("inventory", gorm.Expr("inventory - ?", quantity))
	if result.Error != nil {
		return fmt.Errorf("failed to decrement inventory: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrInsufficientInventory
	}
	return nil
}

// IncrementInventory atomically increases inventory for the given SKU.
func (r *skuRepository) IncrementInventory(ctx context.Context, skuID uint, quantity int) error {
	if quantity <= 0 {
		return fmt.Errorf("quantity must be greater than 0")
	}

	db := r.dbFromContext(ctx)
	result := db.Model(&models.SKU{}).
		Where("id = ?", skuID).
		UpdateColumn("inventory", gorm.Expr("inventory + ?", quantity))
	if result.Error != nil {
		return fmt.Errorf("failed to increment inventory: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("SKU not found")
	}
	return nil
}

// dbFromContext returns the transaction stored in context (via
// database.WithTransaction) if present, otherwise the repository's DB.
func (r *skuRepository) dbFromContext(ctx context.Context) *gorm.DB {
	if tx, ok := ctx.Value(transactionKey{}).(*gorm.DB); ok && tx != nil {
		return tx.WithContext(ctx)
	}
	return r.db.WithContext(ctx)
}
