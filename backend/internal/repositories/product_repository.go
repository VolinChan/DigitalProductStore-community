package repositories

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// ProductRepository defines the interface for product data operations
type ProductRepository interface {
	Create(ctx context.Context, product *models.Product) error
	GetByID(ctx context.Context, id uint) (*models.Product, error)
	List(ctx context.Context, params *ListProductParams) ([]*models.Product, int64, error)
	Update(ctx context.Context, product *models.Product) error
	Delete(ctx context.Context, id uint) error
	Search(ctx context.Context, query string, params *ListProductParams) ([]*models.Product, int64, error)
	GetWithDetails(ctx context.Context, id uint) (*models.Product, error)
	ListByCategoryID(ctx context.Context, categoryID uint, params *ListProductParams) ([]*models.Product, int64, error)
}

// ListProductParams defines parameters for listing products
type ListProductParams struct {
	Limit      int
	Offset     int
	CategoryID *uint
	IsActive   *bool
	SortBy     string // "name", "created_at", "price"
	SortOrder  string // "asc", "desc"
}

// productRepository implements ProductRepository
type productRepository struct {
	db *gorm.DB
}

// NewProductRepository creates a new product repository
func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

// Create creates a new product
func (r *productRepository) Create(ctx context.Context, product *models.Product) error {
	if err := r.db.WithContext(ctx).Create(product).Error; err != nil {
		return fmt.Errorf("failed to create product: %w", err)
	}
	return nil
}

// GetByID retrieves a product by ID
func (r *productRepository) GetByID(ctx context.Context, id uint) (*models.Product, error) {
	var product models.Product
	if err := r.db.WithContext(ctx).
		Preload("Category").
		First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("product not found")
		}
		return nil, fmt.Errorf("failed to get product: %w", err)
	}
	return &product, nil
}

// GetWithDetails retrieves a product with all related data (SKUs, images, category)
func (r *productRepository) GetWithDetails(ctx context.Context, id uint) (*models.Product, error) {
	var product models.Product
	if err := r.db.WithContext(ctx).
		Preload("Category").
		Preload("SKUs", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("id ASC")
		}).
		Preload("SKUs.Attributes").
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, id ASC")
		}).
		First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("product not found")
		}
		return nil, fmt.Errorf("failed to get product with details: %w", err)
	}
	return &product, nil
}

// List retrieves products with pagination and filtering
func (r *productRepository) List(ctx context.Context, params *ListProductParams) ([]*models.Product, int64, error) {
	var products []*models.Product
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Product{})

	// Apply filters
	if params.CategoryID != nil {
		query = query.Where("category_id = ?", *params.CategoryID)
	}
	if params.IsActive != nil {
		query = query.Where("is_active = ?", *params.IsActive)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	// Apply sorting
	sortBy := "created_at"
	if params.SortBy != "" {
		sortBy = params.SortBy
	}
	sortOrder := "DESC"
	if params.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	// Apply pagination
	if params.Limit > 0 {
		query = query.Limit(params.Limit)
	}
	if params.Offset > 0 {
		query = query.Offset(params.Offset)
	}

	// Load relations. Preload active SKUs so list views can compute
	// starting price and stock indicators without a follow-up round trip.
	query = query.Preload("Category").
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_primary = ?", true).Order("sort_order ASC").Limit(1)
		}).
		Preload("SKUs", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("price ASC")
		})

	if err := query.Find(&products).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}

	return products, total, nil
}

// ListByCategoryID retrieves products by category ID
func (r *productRepository) ListByCategoryID(ctx context.Context, categoryID uint, params *ListProductParams) ([]*models.Product, int64, error) {
	params.CategoryID = &categoryID
	return r.List(ctx, params)
}

// Search searches products by name and description
func (r *productRepository) Search(ctx context.Context, query string, params *ListProductParams) ([]*models.Product, int64, error) {
	var products []*models.Product
	var total int64

	dbQuery := r.db.WithContext(ctx).Model(&models.Product{})

	// Apply search filter
	searchPattern := "%" + query + "%"
	dbQuery = dbQuery.Where("name ILIKE ? OR description ILIKE ?", searchPattern, searchPattern)

	// Apply additional filters
	if params.CategoryID != nil {
		dbQuery = dbQuery.Where("category_id = ?", *params.CategoryID)
	}
	if params.IsActive != nil {
		dbQuery = dbQuery.Where("is_active = ?", *params.IsActive)
	}

	// Count total
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Apply sorting
	sortBy := "created_at"
	if params.SortBy != "" {
		sortBy = params.SortBy
	}
	sortOrder := "DESC"
	if params.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	dbQuery = dbQuery.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	// Apply pagination
	if params.Limit > 0 {
		dbQuery = dbQuery.Limit(params.Limit)
	}
	if params.Offset > 0 {
		dbQuery = dbQuery.Offset(params.Offset)
	}

	// Load relations (see List() — same rationale for eager SKU load).
	dbQuery = dbQuery.Preload("Category").
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_primary = ?", true).Order("sort_order ASC").Limit(1)
		}).
		Preload("SKUs", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("price ASC")
		})

	if err := dbQuery.Find(&products).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to search products: %w", err)
	}

	return products, total, nil
}

// Update updates a product
func (r *productRepository) Update(ctx context.Context, product *models.Product) error {
	if err := r.db.WithContext(ctx).Save(product).Error; err != nil {
		return fmt.Errorf("failed to update product: %w", err)
	}
	return nil
}

// Delete deletes a product
func (r *productRepository) Delete(ctx context.Context, id uint) error {
	// Check if product has pending orders
	var count int64
	if err := r.db.WithContext(ctx).
		Table("order_items").
		Joins("JOIN skus ON order_items.sku_id = skus.id").
		Joins("JOIN orders ON order_items.order_id = orders.id").
		Where("skus.product_id = ? AND orders.status NOT IN (?)", id, []string{"completed", "cancelled"}).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check product orders: %w", err)
	}

	if count > 0 {
		return fmt.Errorf("cannot delete product with pending orders")
	}

	// Delete the product (cascade will handle SKUs, images, etc.)
	if err := r.db.WithContext(ctx).Delete(&models.Product{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}
	return nil
}
