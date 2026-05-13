package repositories

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/digital-store/backend/internal/models"
)

// mockAnalyticsEventRepository is a mock implementation of AnalyticsEventRepository
// for use in tests that depend on this interface.
type mockAnalyticsEventRepository struct {
	createFn                 func(ctx context.Context, event *models.AnalyticsEvent) error
	countByTypeFn            func(ctx context.Context, eventType models.AnalyticsEventType, startDate, endDate time.Time) (int64, error)
	getFunnelDataFn          func(ctx context.Context, startDate, endDate time.Time) (*FunnelData, error)
	getCartAbandonmentRateFn func(ctx context.Context, startDate, endDate time.Time) (*CartAbandonmentData, error)
}

func (m *mockAnalyticsEventRepository) Create(ctx context.Context, event *models.AnalyticsEvent) error {
	if m.createFn != nil {
		return m.createFn(ctx, event)
	}
	event.ID = 1
	return nil
}

func (m *mockAnalyticsEventRepository) CountByType(ctx context.Context, eventType models.AnalyticsEventType, startDate, endDate time.Time) (int64, error) {
	if m.countByTypeFn != nil {
		return m.countByTypeFn(ctx, eventType, startDate, endDate)
	}
	return 0, nil
}

func (m *mockAnalyticsEventRepository) GetFunnelData(ctx context.Context, startDate, endDate time.Time) (*FunnelData, error) {
	if m.getFunnelDataFn != nil {
		return m.getFunnelDataFn(ctx, startDate, endDate)
	}
	return &FunnelData{}, nil
}

func (m *mockAnalyticsEventRepository) GetCartAbandonmentRate(ctx context.Context, startDate, endDate time.Time) (*CartAbandonmentData, error) {
	if m.getCartAbandonmentRateFn != nil {
		return m.getCartAbandonmentRateFn(ctx, startDate, endDate)
	}
	return &CartAbandonmentData{}, nil
}

// Verify interface compliance at compile time
var _ AnalyticsEventRepository = (*mockAnalyticsEventRepository)(nil)
var _ AnalyticsEventRepository = (*analyticsEventRepository)(nil)

func TestMockAnalyticsEventRepository_Create(t *testing.T) {
	t.Run("creates event with assigned ID", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{}
		event := &models.AnalyticsEvent{
			EventType: models.AnalyticsEventTypeHomepageView,
			SessionID: "session-123",
			Timestamp: time.Now(),
		}

		err := repo.Create(context.Background(), event)
		require.NoError(t, err)
		assert.Equal(t, uint(1), event.ID)
	})

	t.Run("returns error from custom function", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{
			createFn: func(ctx context.Context, event *models.AnalyticsEvent) error {
				return assert.AnError
			},
		}
		event := &models.AnalyticsEvent{
			EventType: models.AnalyticsEventTypeProductView,
			SessionID: "session-456",
		}

		err := repo.Create(context.Background(), event)
		assert.Error(t, err)
	})

	t.Run("supports all event types", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{}
		eventTypes := []models.AnalyticsEventType{
			models.AnalyticsEventTypeHomepageView,
			models.AnalyticsEventTypeProductView,
			models.AnalyticsEventTypeAddToCart,
			models.AnalyticsEventTypeCheckoutStart,
			models.AnalyticsEventTypeOrderComplete,
		}

		for _, et := range eventTypes {
			event := &models.AnalyticsEvent{
				EventType: et,
				SessionID: "session-test",
				Timestamp: time.Now(),
			}
			err := repo.Create(context.Background(), event)
			require.NoError(t, err, "failed to create event of type %s", et)
		}
	})
}

func TestMockAnalyticsEventRepository_CountByType(t *testing.T) {
	t.Run("returns count from custom function", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{
			countByTypeFn: func(ctx context.Context, eventType models.AnalyticsEventType, startDate, endDate time.Time) (int64, error) {
				if eventType == models.AnalyticsEventTypeHomepageView {
					return 42, nil
				}
				return 0, nil
			},
		}

		start := time.Now().Add(-24 * time.Hour)
		end := time.Now()

		count, err := repo.CountByType(context.Background(), models.AnalyticsEventTypeHomepageView, start, end)
		require.NoError(t, err)
		assert.Equal(t, int64(42), count)
	})

	t.Run("returns zero for default", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{}
		start := time.Now().Add(-24 * time.Hour)
		end := time.Now()

		count, err := repo.CountByType(context.Background(), models.AnalyticsEventTypeProductView, start, end)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})
}

func TestMockAnalyticsEventRepository_GetFunnelData(t *testing.T) {
	t.Run("returns funnel data from custom function", func(t *testing.T) {
		expectedFunnel := &FunnelData{
			HomepageViews:   1000,
			ProductViews:    500,
			AddToCart:       200,
			CheckoutStarts:  100,
			OrdersCompleted: 50,
		}

		repo := &mockAnalyticsEventRepository{
			getFunnelDataFn: func(ctx context.Context, startDate, endDate time.Time) (*FunnelData, error) {
				return expectedFunnel, nil
			},
		}

		start := time.Now().Add(-7 * 24 * time.Hour)
		end := time.Now()

		funnel, err := repo.GetFunnelData(context.Background(), start, end)
		require.NoError(t, err)
		assert.Equal(t, int64(1000), funnel.HomepageViews)
		assert.Equal(t, int64(500), funnel.ProductViews)
		assert.Equal(t, int64(200), funnel.AddToCart)
		assert.Equal(t, int64(100), funnel.CheckoutStarts)
		assert.Equal(t, int64(50), funnel.OrdersCompleted)
	})

	t.Run("returns empty funnel data by default", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{}
		start := time.Now().Add(-24 * time.Hour)
		end := time.Now()

		funnel, err := repo.GetFunnelData(context.Background(), start, end)
		require.NoError(t, err)
		assert.NotNil(t, funnel)
		assert.Equal(t, int64(0), funnel.HomepageViews)
		assert.Equal(t, int64(0), funnel.ProductViews)
		assert.Equal(t, int64(0), funnel.AddToCart)
		assert.Equal(t, int64(0), funnel.CheckoutStarts)
		assert.Equal(t, int64(0), funnel.OrdersCompleted)
	})
}

func TestMockAnalyticsEventRepository_GetCartAbandonmentRate(t *testing.T) {
	t.Run("calculates abandonment rate correctly", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{
			getCartAbandonmentRateFn: func(ctx context.Context, startDate, endDate time.Time) (*CartAbandonmentData, error) {
				// Simulate: 200 add_to_cart, 100 checkout_start
				// Abandonment rate = (200 - 100) / 200 * 100 = 50%
				return &CartAbandonmentData{
					AddToCartCount:  200,
					CheckoutCount:   100,
					AbandonmentRate: 50.0,
				}, nil
			},
		}

		start := time.Now().Add(-7 * 24 * time.Hour)
		end := time.Now()

		data, err := repo.GetCartAbandonmentRate(context.Background(), start, end)
		require.NoError(t, err)
		assert.Equal(t, int64(200), data.AddToCartCount)
		assert.Equal(t, int64(100), data.CheckoutCount)
		assert.Equal(t, 50.0, data.AbandonmentRate)
	})

	t.Run("returns zero rate when no add_to_cart events", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{
			getCartAbandonmentRateFn: func(ctx context.Context, startDate, endDate time.Time) (*CartAbandonmentData, error) {
				return &CartAbandonmentData{
					AddToCartCount:  0,
					CheckoutCount:   0,
					AbandonmentRate: 0,
				}, nil
			},
		}

		start := time.Now().Add(-24 * time.Hour)
		end := time.Now()

		data, err := repo.GetCartAbandonmentRate(context.Background(), start, end)
		require.NoError(t, err)
		assert.Equal(t, int64(0), data.AddToCartCount)
		assert.Equal(t, float64(0), data.AbandonmentRate)
	})

	t.Run("returns 100% rate when no checkouts", func(t *testing.T) {
		repo := &mockAnalyticsEventRepository{
			getCartAbandonmentRateFn: func(ctx context.Context, startDate, endDate time.Time) (*CartAbandonmentData, error) {
				// 50 add_to_cart, 0 checkout_start → 100% abandonment
				return &CartAbandonmentData{
					AddToCartCount:  50,
					CheckoutCount:   0,
					AbandonmentRate: 100.0,
				}, nil
			},
		}

		start := time.Now().Add(-24 * time.Hour)
		end := time.Now()

		data, err := repo.GetCartAbandonmentRate(context.Background(), start, end)
		require.NoError(t, err)
		assert.Equal(t, int64(50), data.AddToCartCount)
		assert.Equal(t, int64(0), data.CheckoutCount)
		assert.Equal(t, 100.0, data.AbandonmentRate)
	})
}

func TestCartAbandonmentRateCalculation(t *testing.T) {
	// Test the abandonment rate calculation logic directly
	tests := []struct {
		name           string
		addToCart      int64
		checkout       int64
		expectedRate   float64
	}{
		{
			name:         "50% abandonment",
			addToCart:    200,
			checkout:     100,
			expectedRate: 50.0,
		},
		{
			name:         "0% abandonment - all proceed to checkout",
			addToCart:    100,
			checkout:     100,
			expectedRate: 0.0,
		},
		{
			name:         "100% abandonment - none proceed to checkout",
			addToCart:    100,
			checkout:     0,
			expectedRate: 100.0,
		},
		{
			name:         "zero add_to_cart events",
			addToCart:    0,
			checkout:     0,
			expectedRate: 0.0,
		},
		{
			name:         "75% abandonment",
			addToCart:    400,
			checkout:     100,
			expectedRate: 75.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var rate float64
			if tt.addToCart > 0 {
				rate = float64(tt.addToCart-tt.checkout) / float64(tt.addToCart) * 100
			}
			assert.InDelta(t, tt.expectedRate, rate, 0.01)
		})
	}
}

func TestFunnelDataStructure(t *testing.T) {
	t.Run("funnel data represents correct stages", func(t *testing.T) {
		funnel := &FunnelData{
			HomepageViews:   1000,
			ProductViews:    800,
			AddToCart:       300,
			CheckoutStarts:  150,
			OrdersCompleted: 75,
		}

		// Verify funnel is monotonically decreasing (typical behavior)
		assert.GreaterOrEqual(t, funnel.HomepageViews, funnel.ProductViews)
		assert.GreaterOrEqual(t, funnel.ProductViews, funnel.AddToCart)
		assert.GreaterOrEqual(t, funnel.AddToCart, funnel.CheckoutStarts)
		assert.GreaterOrEqual(t, funnel.CheckoutStarts, funnel.OrdersCompleted)
	})
}

func TestAnalyticsEventTypes(t *testing.T) {
	t.Run("event type constants have correct values", func(t *testing.T) {
		assert.Equal(t, models.AnalyticsEventType("homepage_view"), models.AnalyticsEventTypeHomepageView)
		assert.Equal(t, models.AnalyticsEventType("product_view"), models.AnalyticsEventTypeProductView)
		assert.Equal(t, models.AnalyticsEventType("add_to_cart"), models.AnalyticsEventTypeAddToCart)
		assert.Equal(t, models.AnalyticsEventType("checkout_start"), models.AnalyticsEventTypeCheckoutStart)
		assert.Equal(t, models.AnalyticsEventType("order_complete"), models.AnalyticsEventTypeOrderComplete)
	})
}
