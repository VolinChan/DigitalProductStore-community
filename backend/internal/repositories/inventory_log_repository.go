package repositories

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

// ErrInventoryLogNotFound is returned when an inventory log is not found.
var ErrInventoryLogNotFound = errors.New("inventory log not found")

// ListInventoryLogParams defines pagination and filter parameters for
// listing inventory log entries. It is used by the admin inventory history
// view described in requirement 15.7.
type ListInventoryLogParams struct {
	Limit     int
	Offset    int
	StartDate *time.Time
	EndDate   *time.Time
	SortBy    string // "created_at"
	SortOrder string // "asc", "desc"
}

// InventoryLogRepository defines the interface for inventory log data
// operations. Inventory logs track every change to SKU inventory (order
// reservation, order cancellation, admin adjustment) so administrators can
// audit stock movements per requirement 15.5-15.7.
type InventoryLogRepository interface {
	// Create records a single inventory log entry. When the context carries
	// a transaction (via WithTx) the insert runs against that transaction so
	// it can be coordinated with the inventory mutation itself.
	Create(ctx context.Context, log *models.InventoryLog) error

	// GetBySKUID returns paginated inventory logs for a SKU along with the
	// total number of matching rows. Logs are ordered by creation time
	// descending by default so the most recent change appears first.
	GetBySKUID(ctx context.Context, skuID uint, params *ListInventoryLogParams) ([]*models.InventoryLog, int64, error)

	// GetByOrderID returns every inventory log entry associated with an
	// order. Used to trace stock movements tied to a specific order (for
	// example when restoring inventory on cancellation).
	GetByOrderID(ctx context.Context, orderID uint) ([]*models.InventoryLog, error)
}

// inventoryLogRepository implements InventoryLogRepository using GORM.
type inventoryLogRepository struct {
	db *gorm.DB
}

// NewInventoryLogRepository creates a new inventory log repository backed by
// the provided GORM DB handle.
func NewInventoryLogRepository(db *gorm.DB) InventoryLogRepository {
	return &inventoryLogRepository{db: db}
}

// dbOrTx returns the transaction carried by ctx (if any) or the repository's
// underlying DB bound to ctx. This mirrors the pattern used by the order and
// payment repositories so inventory log writes can be committed atomically
// with the stock mutation that produced them.
func (r *inventoryLogRepository) dbOrTx(ctx context.Context) *gorm.DB {
	if tx, ok := TxFromContext(ctx); ok {
		return tx.WithContext(ctx)
	}
	return r.db.WithContext(ctx)
}

// Create records a single inventory log entry.
func (r *inventoryLogRepository) Create(ctx context.Context, log *models.InventoryLog) error {
	if log == nil {
		return fmt.Errorf("inventory log is required")
	}
	if err := r.dbOrTx(ctx).Create(log).Error; err != nil {
		return fmt.Errorf("failed to create inventory log: %w", err)
	}
	return nil
}

// GetBySKUID lists inventory logs for the given SKU with pagination and
// optional date range filtering.
func (r *inventoryLogRepository) GetBySKUID(ctx context.Context, skuID uint, params *ListInventoryLogParams) ([]*models.InventoryLog, int64, error) {
	if params == nil {
		params = &ListInventoryLogParams{}
	}

	var logs []*models.InventoryLog
	var total int64

	query := r.dbOrTx(ctx).Model(&models.InventoryLog{}).
		Where("sku_id = ?", skuID)

	if params.StartDate != nil {
		query = query.Where("created_at >= ?", *params.StartDate)
	}
	if params.EndDate != nil {
		query = query.Where("created_at <= ?", *params.EndDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count inventory logs: %w", err)
	}

	// Sorting: default to created_at DESC so the most recent entry appears
	// first, which matches the expected admin history view (requirement
	// 15.7).
	sortBy := "created_at"
	switch params.SortBy {
	case "created_at", "id":
		sortBy = params.SortBy
	}
	sortOrder := "DESC"
	if params.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	if params.Limit > 0 {
		query = query.Limit(params.Limit)
	}
	if params.Offset > 0 {
		query = query.Offset(params.Offset)
	}

	if err := query.Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list inventory logs: %w", err)
	}
	return logs, total, nil
}

// GetByOrderID returns every inventory log entry linked to an order,
// ordered by creation time ascending so the caller sees the chronological
// sequence of stock movements.
func (r *inventoryLogRepository) GetByOrderID(ctx context.Context, orderID uint) ([]*models.InventoryLog, error) {
	var logs []*models.InventoryLog
	err := r.dbOrTx(ctx).
		Where("order_id = ?", orderID).
		Order("created_at ASC").
		Find(&logs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list inventory logs by order: %w", err)
	}
	return logs, nil
}
