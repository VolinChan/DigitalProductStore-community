package repositories

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// BannerRepository defines the interface for banner data operations
type BannerRepository interface {
	Create(ctx context.Context, banner *models.Banner) error
	GetByID(ctx context.Context, id uint) (*models.Banner, error)
	List(ctx context.Context, page, perPage int) ([]*models.Banner, int64, error)
	Update(ctx context.Context, banner *models.Banner) error
	Delete(ctx context.Context, id uint) error
	GetActiveBanners(ctx context.Context) ([]*models.Banner, error)
}

// bannerRepository implements BannerRepository
type bannerRepository struct {
	db *gorm.DB
}

// NewBannerRepository creates a new banner repository
func NewBannerRepository(db *gorm.DB) BannerRepository {
	return &bannerRepository{db: db}
}

// Create creates a new banner
func (r *bannerRepository) Create(ctx context.Context, banner *models.Banner) error {
	if err := r.db.WithContext(ctx).Create(banner).Error; err != nil {
		return fmt.Errorf("failed to create banner: %w", err)
	}
	return nil
}

// GetByID retrieves a banner by ID
func (r *bannerRepository) GetByID(ctx context.Context, id uint) (*models.Banner, error) {
	var banner models.Banner
	if err := r.db.WithContext(ctx).First(&banner, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("banner not found")
		}
		return nil, fmt.Errorf("failed to get banner: %w", err)
	}
	return &banner, nil
}

// List retrieves banners with pagination
func (r *bannerRepository) List(ctx context.Context, page, perPage int) ([]*models.Banner, int64, error) {
	var banners []*models.Banner
	var total int64

	if err := r.db.WithContext(ctx).Model(&models.Banner{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count banners: %w", err)
	}

	offset := (page - 1) * perPage
	if err := r.db.WithContext(ctx).
		Order("priority DESC, created_at DESC").
		Offset(offset).
		Limit(perPage).
		Find(&banners).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list banners: %w", err)
	}

	return banners, total, nil
}

// Update updates a banner
func (r *bannerRepository) Update(ctx context.Context, banner *models.Banner) error {
	if err := r.db.WithContext(ctx).Save(banner).Error; err != nil {
		return fmt.Errorf("failed to update banner: %w", err)
	}
	return nil
}

// Delete deletes a banner
func (r *bannerRepository) Delete(ctx context.Context, id uint) error {
	result := r.db.WithContext(ctx).Delete(&models.Banner{}, id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete banner: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("banner not found")
	}
	return nil
}

// GetActiveBanners retrieves active banners within their display period, sorted by priority descending
func (r *bannerRepository) GetActiveBanners(ctx context.Context) ([]*models.Banner, error) {
	var banners []*models.Banner
	now := time.Now()

	if err := r.db.WithContext(ctx).
		Where("is_active = ?", true).
		Where("(start_date IS NULL OR start_date <= ?)", now).
		Where("(end_date IS NULL OR end_date >= ?)", now).
		Order("priority DESC, created_at DESC").
		Find(&banners).Error; err != nil {
		return nil, fmt.Errorf("failed to get active banners: %w", err)
	}

	return banners, nil
}
