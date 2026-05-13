package repositories

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// FunnelData holds the event counts for each stage of the conversion funnel.
type FunnelData struct {
	HomepageViews   int64 `json:"homepage_views"`
	ProductViews    int64 `json:"product_views"`
	AddToCart       int64 `json:"add_to_cart"`
	CheckoutStarts  int64 `json:"checkout_starts"`
	OrdersCompleted int64 `json:"orders_completed"`
}

// CartAbandonmentData holds the data needed to calculate cart abandonment rate.
type CartAbandonmentData struct {
	AddToCartCount    int64   `json:"add_to_cart_count"`
	CheckoutCount     int64   `json:"checkout_count"`
	AbandonmentRate   float64 `json:"abandonment_rate"`
}

// AnalyticsEventRepository defines the interface for analytics event data operations.
type AnalyticsEventRepository interface {
	// Create stores a new analytics event.
	Create(ctx context.Context, event *models.AnalyticsEvent) error

	// CountByType counts events of a given type within a date range.
	CountByType(ctx context.Context, eventType models.AnalyticsEventType, startDate, endDate time.Time) (int64, error)

	// GetFunnelData returns event counts for all funnel stages within a date range.
	GetFunnelData(ctx context.Context, startDate, endDate time.Time) (*FunnelData, error)

	// GetCartAbandonmentRate calculates the cart abandonment rate within a date range.
	// Abandonment rate = (add_to_cart - checkout_start) / add_to_cart * 100
	GetCartAbandonmentRate(ctx context.Context, startDate, endDate time.Time) (*CartAbandonmentData, error)
}

// analyticsEventRepository implements AnalyticsEventRepository using GORM.
type analyticsEventRepository struct {
	db *gorm.DB
}

// NewAnalyticsEventRepository creates a new analytics event repository.
func NewAnalyticsEventRepository(db *gorm.DB) AnalyticsEventRepository {
	return &analyticsEventRepository{db: db}
}

// Create stores a new analytics event.
func (r *analyticsEventRepository) Create(ctx context.Context, event *models.AnalyticsEvent) error {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	if err := r.db.WithContext(ctx).Create(event).Error; err != nil {
		return fmt.Errorf("failed to create analytics event: %w", err)
	}
	return nil
}

// CountByType counts events of a given type within a date range.
func (r *analyticsEventRepository) CountByType(ctx context.Context, eventType models.AnalyticsEventType, startDate, endDate time.Time) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.AnalyticsEvent{}).
		Where("event_type = ? AND timestamp >= ? AND timestamp <= ?", eventType, startDate, endDate).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("failed to count analytics events by type: %w", err)
	}
	return count, nil
}

// GetFunnelData returns event counts for all funnel stages within a date range.
func (r *analyticsEventRepository) GetFunnelData(ctx context.Context, startDate, endDate time.Time) (*FunnelData, error) {
	type result struct {
		EventType string `gorm:"column:event_type"`
		Count     int64  `gorm:"column:count"`
	}

	var results []result
	err := r.db.WithContext(ctx).
		Model(&models.AnalyticsEvent{}).
		Select("event_type, COUNT(*) as count").
		Where("timestamp >= ? AND timestamp <= ?", startDate, endDate).
		Where("event_type IN ?", []models.AnalyticsEventType{
			models.AnalyticsEventTypeHomepageView,
			models.AnalyticsEventTypeProductView,
			models.AnalyticsEventTypeAddToCart,
			models.AnalyticsEventTypeCheckoutStart,
			models.AnalyticsEventTypeOrderComplete,
		}).
		Group("event_type").
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get funnel data: %w", err)
	}

	funnel := &FunnelData{}
	for _, r := range results {
		switch models.AnalyticsEventType(r.EventType) {
		case models.AnalyticsEventTypeHomepageView:
			funnel.HomepageViews = r.Count
		case models.AnalyticsEventTypeProductView:
			funnel.ProductViews = r.Count
		case models.AnalyticsEventTypeAddToCart:
			funnel.AddToCart = r.Count
		case models.AnalyticsEventTypeCheckoutStart:
			funnel.CheckoutStarts = r.Count
		case models.AnalyticsEventTypeOrderComplete:
			funnel.OrdersCompleted = r.Count
		}
	}

	return funnel, nil
}

// GetCartAbandonmentRate calculates the cart abandonment rate within a date range.
// Abandonment rate = (add_to_cart - checkout_start) / add_to_cart * 100
func (r *analyticsEventRepository) GetCartAbandonmentRate(ctx context.Context, startDate, endDate time.Time) (*CartAbandonmentData, error) {
	var addToCartCount int64
	err := r.db.WithContext(ctx).
		Model(&models.AnalyticsEvent{}).
		Where("event_type = ? AND timestamp >= ? AND timestamp <= ?",
			models.AnalyticsEventTypeAddToCart, startDate, endDate).
		Count(&addToCartCount).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count add_to_cart events: %w", err)
	}

	var checkoutCount int64
	err = r.db.WithContext(ctx).
		Model(&models.AnalyticsEvent{}).
		Where("event_type = ? AND timestamp >= ? AND timestamp <= ?",
			models.AnalyticsEventTypeCheckoutStart, startDate, endDate).
		Count(&checkoutCount).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count checkout_start events: %w", err)
	}

	var abandonmentRate float64
	if addToCartCount > 0 {
		abandonmentRate = float64(addToCartCount-checkoutCount) / float64(addToCartCount) * 100
	}

	return &CartAbandonmentData{
		AddToCartCount:  addToCartCount,
		CheckoutCount:   checkoutCount,
		AbandonmentRate: abandonmentRate,
	}, nil
}
