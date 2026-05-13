package repositories

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// AnnouncementRepository defines the interface for announcement data operations
type AnnouncementRepository interface {
	Create(ctx context.Context, announcement *models.Announcement) error
	GetByID(ctx context.Context, id uint) (*models.Announcement, error)
	List(ctx context.Context, page, perPage int) ([]*models.Announcement, int64, error)
	Update(ctx context.Context, announcement *models.Announcement) error
	Delete(ctx context.Context, id uint) error
	GetActiveAnnouncements(ctx context.Context) ([]*models.Announcement, error)
}

// announcementRepository implements AnnouncementRepository
type announcementRepository struct {
	db *gorm.DB
}

// NewAnnouncementRepository creates a new announcement repository
func NewAnnouncementRepository(db *gorm.DB) AnnouncementRepository {
	return &announcementRepository{db: db}
}

// Create creates a new announcement
func (r *announcementRepository) Create(ctx context.Context, announcement *models.Announcement) error {
	if err := r.db.WithContext(ctx).Create(announcement).Error; err != nil {
		return fmt.Errorf("failed to create announcement: %w", err)
	}
	return nil
}

// GetByID retrieves an announcement by ID
func (r *announcementRepository) GetByID(ctx context.Context, id uint) (*models.Announcement, error) {
	var announcement models.Announcement
	if err := r.db.WithContext(ctx).First(&announcement, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("announcement not found")
		}
		return nil, fmt.Errorf("failed to get announcement: %w", err)
	}
	return &announcement, nil
}

// List retrieves announcements with pagination
func (r *announcementRepository) List(ctx context.Context, page, perPage int) ([]*models.Announcement, int64, error) {
	var announcements []*models.Announcement
	var total int64

	if err := r.db.WithContext(ctx).Model(&models.Announcement{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count announcements: %w", err)
	}

	offset := (page - 1) * perPage
	if err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Offset(offset).
		Limit(perPage).
		Find(&announcements).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list announcements: %w", err)
	}

	return announcements, total, nil
}

// Update updates an announcement
func (r *announcementRepository) Update(ctx context.Context, announcement *models.Announcement) error {
	if err := r.db.WithContext(ctx).Save(announcement).Error; err != nil {
		return fmt.Errorf("failed to update announcement: %w", err)
	}
	return nil
}

// Delete deletes an announcement
func (r *announcementRepository) Delete(ctx context.Context, id uint) error {
	result := r.db.WithContext(ctx).Delete(&models.Announcement{}, id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete announcement: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("announcement not found")
	}
	return nil
}

// GetActiveAnnouncements retrieves active announcements within their display period,
// sorted by priority (high > medium > low) then by creation date descending.
// Requirement 26.5: high priority announcements displayed prominently at top
// Requirement 26.6: filter by current date within start_date/end_date range
func (r *announcementRepository) GetActiveAnnouncements(ctx context.Context) ([]*models.Announcement, error) {
	var announcements []*models.Announcement
	now := time.Now()

	if err := r.db.WithContext(ctx).
		Where("is_active = ?", true).
		Where("(start_date IS NULL OR start_date <= ?)", now).
		Where("(end_date IS NULL OR end_date >= ?)", now).
		Order("CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC, created_at DESC").
		Find(&announcements).Error; err != nil {
		return nil, fmt.Errorf("failed to get active announcements: %w", err)
	}

	return announcements, nil
}
