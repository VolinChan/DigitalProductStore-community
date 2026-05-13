// Package worker provides background job scheduling for the digital store.
// The primary job is the transfer deadline checker which runs every hour to
// find and cancel orders whose confirmation deadline has passed.
package worker

import (
	"context"
	"sync"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/logger"
)

// DeadlineChecker periodically scans for transfer payment orders that have
// exceeded their confirmation deadline and automatically cancels them,
// restoring inventory and sending notification emails.
//
// Requirements addressed:
//   - 11.1: Send reminder email 24h before deadline (handled by ReminderChecker)
//   - 11.2: Auto-cancel orders past confirmation deadline
//   - 11.3: Restore SKU inventory on auto-cancellation
//   - 11.4: Send cancellation notification email
//   - 11.5: Check every 1 hour
type DeadlineChecker struct {
	db               *gorm.DB
	orderRepo        repositories.OrderRepository
	skuRepo          repositories.SKURepository
	inventoryLogRepo repositories.InventoryLogRepository
	txManager        repositories.TxManager
	notifications    services.NotificationService
	log              *logger.Logger

	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

// NewDeadlineChecker creates a new DeadlineChecker. The checker does not
// start automatically; call Start() to begin the periodic scan.
func NewDeadlineChecker(
	db *gorm.DB,
	orderRepo repositories.OrderRepository,
	skuRepo repositories.SKURepository,
	inventoryLogRepo repositories.InventoryLogRepository,
	txManager repositories.TxManager,
	notifications services.NotificationService,
	log *logger.Logger,
) *DeadlineChecker {
	return &DeadlineChecker{
		db:               db,
		orderRepo:        orderRepo,
		skuRepo:          skuRepo,
		inventoryLogRepo: inventoryLogRepo,
		txManager:        txManager,
		notifications:    notifications,
		log:              log,
		interval:         1 * time.Hour,
		stopCh:           make(chan struct{}),
	}
}

// SetInterval overrides the default 1-hour check interval. Useful for
// testing with shorter intervals.
func (dc *DeadlineChecker) SetInterval(d time.Duration) {
	dc.interval = d
}

// Start begins the periodic deadline check loop in a background goroutine.
// It runs an immediate check on startup, then repeats at the configured
// interval until Stop() is called.
func (dc *DeadlineChecker) Start() {
	dc.wg.Add(1)
	go func() {
		defer dc.wg.Done()
		dc.log.Info("Transfer deadline checker started")

		// Run immediately on startup
		dc.CheckExpiredOrders(context.Background())

		ticker := time.NewTicker(dc.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				dc.CheckExpiredOrders(context.Background())
			case <-dc.stopCh:
				dc.log.Info("Transfer deadline checker stopped")
				return
			}
		}
	}()
}

// Stop signals the background goroutine to exit and waits for it to finish.
func (dc *DeadlineChecker) Stop() {
	close(dc.stopCh)
	dc.wg.Wait()
}

// CheckExpiredOrders finds all orders with status "pending_transfer" whose
// confirmation_deadline has passed, cancels them, restores inventory, and
// sends cancellation notification emails.
//
// Each expired order is processed independently so a failure on one order
// does not block the others.
func (dc *DeadlineChecker) CheckExpiredOrders(ctx context.Context) {
	now := time.Now()
	dc.log.Infow("Checking for expired transfer orders", "time", now)

	orders, err := dc.findExpiredOrders(ctx, now)
	if err != nil {
		dc.log.Errorw("Failed to query expired orders", "error", err.Error())
		return
	}

	if len(orders) == 0 {
		dc.log.Info("No expired transfer orders found")
		return
	}

	dc.log.Infow("Found expired transfer orders", "count", len(orders))

	for _, order := range orders {
		if err := dc.cancelExpiredOrder(ctx, order); err != nil {
			dc.log.Errorw("Failed to cancel expired order",
				"order_id", order.ID,
				"order_number", order.OrderNumber,
				"error", err.Error(),
			)
			continue
		}
		dc.log.Infow("Auto-cancelled expired transfer order",
			"order_id", order.ID,
			"order_number", order.OrderNumber,
		)
	}
}

// findExpiredOrders queries for orders with status "pending_transfer" whose
// confirmation_deadline is before the given time.
func (dc *DeadlineChecker) findExpiredOrders(ctx context.Context, now time.Time) ([]*models.Order, error) {
	if dc.db == nil {
		return nil, nil
	}
	var orders []*models.Order
	err := dc.db.WithContext(ctx).
		Preload("Items").
		Preload("User").
		Where("status = ? AND confirmation_deadline IS NOT NULL AND confirmation_deadline < ?",
			models.OrderStatusPendingTransfer, now).
		Find(&orders).Error
	if err != nil {
		return nil, err
	}
	return orders, nil
}

// cancelExpiredOrder cancels a single expired order: updates status to
// cancelled, restores inventory for each order item, and sends a
// cancellation notification email.
func (dc *DeadlineChecker) cancelExpiredOrder(ctx context.Context, order *models.Order) error {
	// Run status update and inventory restoration in a single transaction
	if err := dc.txManager.RunInTransaction(ctx, func(txCtx context.Context) error {
		// Restore inventory for each order item (Requirement 11.3)
		for _, item := range order.Items {
			if item == nil || item.Quantity <= 0 {
				continue
			}

			var previousQty int
			if dc.inventoryLogRepo != nil {
				sku, err := dc.skuRepo.GetByID(txCtx, item.SKUID)
				if err != nil {
					return err
				}
				previousQty = sku.Inventory
			}

			if err := dc.skuRepo.IncrementInventory(txCtx, item.SKUID, item.Quantity); err != nil {
				return err
			}

			// Record inventory log entry
			if dc.inventoryLogRepo != nil {
				orderID := order.ID
				entry := &models.InventoryLog{
					SKUID:       item.SKUID,
					PreviousQty: previousQty,
					NewQty:      previousQty + item.Quantity,
					Change:      item.Quantity,
					Reason:      "auto-cancellation: transfer confirmation deadline exceeded",
					OrderID:     &orderID,
				}
				if err := dc.inventoryLogRepo.Create(txCtx, entry); err != nil {
					return err
				}
			}
		}

		// Update order status to cancelled (Requirement 11.2)
		if err := dc.orderRepo.UpdateStatus(txCtx, order.ID, models.OrderStatusCancelled); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return err
	}

	// Send cancellation notification email (Requirement 11.4)
	// This is best-effort: a notification failure must not fail the
	// cancellation which has already been committed.
	if dc.notifications != nil {
		order.Status = models.OrderStatusCancelled
		if err := dc.notifications.SendOrderCancellation(ctx, order); err != nil {
			dc.log.Errorw("Failed to send cancellation email for expired order",
				"order_id", order.ID,
				"order_number", order.OrderNumber,
				"error", err.Error(),
			)
		}
	}

	return nil
}
