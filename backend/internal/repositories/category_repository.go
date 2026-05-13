package repositories

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// CategoryRepository defines the interface for category data operations
type CategoryRepository interface {
	Create(ctx context.Context, category *models.Category) error
	GetByID(ctx context.Context, id uint) (*models.Category, error)
	GetBySlug(ctx context.Context, slug string) (*models.Category, error)
	List(ctx context.Context) ([]*models.Category, error)
	ListByParent(ctx context.Context, parentID *uint) ([]*models.Category, error)
	Update(ctx context.Context, category *models.Category) error
	Delete(ctx context.Context, id uint) error
	GetWithChildren(ctx context.Context, id uint) (*models.Category, error)
}

// categoryRepository implements CategoryRepository
type categoryRepository struct {
	db *gorm.DB
}

// NewCategoryRepository creates a new category repository
func NewCategoryRepository(db *gorm.DB) CategoryRepository {
	return &categoryRepository{db: db}
}

// Create creates a new category
func (r *categoryRepository) Create(ctx context.Context, category *models.Category) error {
	if err := r.db.WithContext(ctx).Create(category).Error; err != nil {
		return fmt.Errorf("failed to create category: %w", err)
	}
	return nil
}

// GetByID retrieves a category by ID
func (r *categoryRepository) GetByID(ctx context.Context, id uint) (*models.Category, error) {
	var category models.Category
	if err := r.db.WithContext(ctx).
		Preload("Parent").
		First(&category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("category not found")
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}
	return &category, nil
}

// GetBySlug retrieves a category by slug
func (r *categoryRepository) GetBySlug(ctx context.Context, slug string) (*models.Category, error) {
	var category models.Category
	if err := r.db.WithContext(ctx).
		Preload("Parent").
		Where("slug = ?", slug).
		First(&category).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("category not found")
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}
	return &category, nil
}

// List retrieves all categories ordered by sort_order
func (r *categoryRepository) List(ctx context.Context) ([]*models.Category, error) {
	var categories []*models.Category
	if err := r.db.WithContext(ctx).
		Preload("Parent").
		Order("sort_order ASC, name ASC").
		Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("failed to list categories: %w", err)
	}
	return categories, nil
}

// ListByParent retrieves categories by parent ID
func (r *categoryRepository) ListByParent(ctx context.Context, parentID *uint) ([]*models.Category, error) {
	var categories []*models.Category
	query := r.db.WithContext(ctx).
		Preload("Parent").
		Order("sort_order ASC, name ASC")

	if parentID == nil {
		// Get root categories (parent_id IS NULL)
		query = query.Where("parent_id IS NULL")
	} else {
		// Get categories with specific parent
		query = query.Where("parent_id = ?", *parentID)
	}

	if err := query.Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("failed to list categories by parent: %w", err)
	}
	return categories, nil
}

// Update updates a category
func (r *categoryRepository) Update(ctx context.Context, category *models.Category) error {
	if err := r.db.WithContext(ctx).Save(category).Error; err != nil {
		return fmt.Errorf("failed to update category: %w", err)
	}
	return nil
}

// Delete deletes a category
func (r *categoryRepository) Delete(ctx context.Context, id uint) error {
	// Check if category has children
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&models.Category{}).
		Where("parent_id = ?", id).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check category children: %w", err)
	}

	if count > 0 {
		return fmt.Errorf("cannot delete category with children")
	}

	// Check if category has products
	if err := r.db.WithContext(ctx).
		Model(&models.Product{}).
		Where("category_id = ?", id).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check category products: %w", err)
	}

	if count > 0 {
		return fmt.Errorf("cannot delete category with products")
	}

	// Delete the category
	if err := r.db.WithContext(ctx).Delete(&models.Category{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}
	return nil
}

// GetWithChildren retrieves a category with all its children recursively
func (r *categoryRepository) GetWithChildren(ctx context.Context, id uint) (*models.Category, error) {
	var category models.Category
	if err := r.db.WithContext(ctx).
		Preload("Parent").
		First(&category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("category not found")
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}

	// Load children recursively
	if err := r.loadChildren(ctx, &category); err != nil {
		return nil, err
	}

	return &category, nil
}

// loadChildren is a helper function to recursively load children
func (r *categoryRepository) loadChildren(ctx context.Context, category *models.Category) error {
	var children []*models.Category
	if err := r.db.WithContext(ctx).
		Where("parent_id = ?", category.ID).
		Order("sort_order ASC, name ASC").
		Find(&children).Error; err != nil {
		return fmt.Errorf("failed to load children: %w", err)
	}

	// Recursively load children for each child
	for _, child := range children {
		if err := r.loadChildren(ctx, child); err != nil {
			return err
		}
	}

	return nil
}
