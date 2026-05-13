// Package worker provides background job scheduling for the digital store.
package worker

import (
	"context"
	"sync"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/logger"
)

// ReminderChecker periodically scans for transfer payment orders whose
// confirmation deadline is within the next 24 hours and sends a reminder
// email to the administrator.
//
// To avoid sending duplicate reminders for the same order across multiple
// check cycles, the checker maintains an in-memory set of order IDs that
// have already been reminded. This set is reset when the process restarts,
// which is acceptable because the reminder is best-effort and the deadline
// checker will eventually cancel truly expired orders.
//
// Requirements addressed:
//   - 11.1: Send reminder email 24h before deadline
type ReminderChecker struct {
	db            *gorm.DB
	notifications services.NotificationService
	log           *logger.Logger

	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup

	// mu protects remindedOrders
	mu             sync.Mutex
	remindedOrders map[uint]struct{}

	// nowFunc allows tests to inject a custom time source.
	nowFunc func() time.Time
}

// NewReminderChecker creates a new ReminderChecker. The checker does not
// start automatically; call Start() to begin the periodic scan.
func NewReminderChecker(
	db *gorm.DB,
	notifications services.NotificationService,
	log *logger.Logger,
) *ReminderChecker {
	return &ReminderChecker{
		db:             db,
		notifications:  notifications,
		log:            log,
		interval:       1 * time.Hour,
		stopCh:         make(chan struct{}),
		remindedOrders: make(map[uint]struct{}),
		nowFunc:        time.Now,
	}
}

// SetInterval overrides the default 1-hour check interval. Useful for
// testing with shorter intervals.
func (rc *ReminderChecker) SetInterval(d time.Duration) {
	rc.interval = d
}

// SetNowFunc overrides the time source. Useful for testing.
func (rc *ReminderChecker) SetNowFunc(fn func() time.Time) {
	rc.nowFunc = fn
}

// Start begins the periodic reminder check loop in a background goroutine.
// It runs an immediate check on startup, then repeats at the configured
// interval until Stop() is called.
func (rc *ReminderChecker) Start() {
	rc.wg.Add(1)
	go func() {
		defer rc.wg.Done()
		rc.log.Info("Transfer deadline reminder checker started")

		// Run immediately on startup
		rc.CheckUpcomingDeadlines(context.Background())

		ticker := time.NewTicker(rc.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				rc.CheckUpcomingDeadlines(context.Background())
			case <-rc.stopCh:
				rc.log.Info("Transfer deadline reminder checker stopped")
				return
			}
		}
	}()
}

// Stop signals the background goroutine to exit and waits for it to finish.
func (rc *ReminderChecker) Stop() {
	close(rc.stopCh)
	rc.wg.Wait()
}

// CheckUpcomingDeadlines finds all orders with status "pending_transfer"
// whose confirmation_deadline is within the next 24 hours (but not yet
// expired), and sends a reminder email for each one that hasn't already
// been reminded.
func (rc *ReminderChecker) CheckUpcomingDeadlines(ctx context.Context) {
	now := rc.nowFunc()
	rc.log.Infow("Checking for transfer orders approaching deadline", "time", now)

	orders, err := rc.findOrdersApproachingDeadline(ctx, now)
	if err != nil {
		rc.log.Errorw("Failed to query orders approaching deadline", "error", err.Error())
		return
	}

	if len(orders) == 0 {
		rc.log.Info("No transfer orders approaching deadline")
		return
	}

	rc.log.Infow("Found transfer orders approaching deadline", "count", len(orders))

	for _, order := range orders {
		if rc.alreadyReminded(order.ID) {
			continue
		}

		if err := rc.sendReminder(ctx, order); err != nil {
			rc.log.Errorw("Failed to send deadline reminder",
				"order_id", order.ID,
				"order_number", order.OrderNumber,
				"error", err.Error(),
			)
			continue
		}

		rc.markReminded(order.ID)
		rc.log.Infow("Sent transfer deadline reminder",
			"order_id", order.ID,
			"order_number", order.OrderNumber,
			"deadline", order.ConfirmationDeadline,
		)
	}
}

// findOrdersApproachingDeadline queries for orders with status
// "pending_transfer" whose confirmation_deadline is between now and
// now + 24 hours (i.e., expiring within the next 24 hours).
func (rc *ReminderChecker) findOrdersApproachingDeadline(ctx context.Context, now time.Time) ([]*models.Order, error) {
	if rc.db == nil {
		return nil, nil
	}

	deadline24h := now.Add(24 * time.Hour)

	var orders []*models.Order
	err := rc.db.WithContext(ctx).
		Preload("User").
		Where("status = ? AND confirmation_deadline IS NOT NULL AND confirmation_deadline > ? AND confirmation_deadline <= ?",
			models.OrderStatusPendingTransfer, now, deadline24h).
		Find(&orders).Error
	if err != nil {
		return nil, err
	}
	return orders, nil
}

// sendReminder sends a transfer deadline reminder email for the given order.
func (rc *ReminderChecker) sendReminder(ctx context.Context, order *models.Order) error {
	if rc.notifications == nil {
		return nil
	}
	return rc.notifications.SendTransferDeadlineReminder(ctx, order)
}

// alreadyReminded checks whether a reminder has already been sent for
// the given order ID in this process lifecycle.
func (rc *ReminderChecker) alreadyReminded(orderID uint) bool {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	_, ok := rc.remindedOrders[orderID]
	return ok
}

// markReminded records that a reminder has been sent for the given order ID.
func (rc *ReminderChecker) markReminded(orderID uint) {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	rc.remindedOrders[orderID] = struct{}{}
}
