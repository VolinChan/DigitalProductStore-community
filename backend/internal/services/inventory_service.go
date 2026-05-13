package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// Inventory service errors. Handlers and tests match against the sentinel
// values rather than parsing error strings.
var (
	// ErrInventoryItemInvalid is returned when a reservation or release
	// request contains an invalid item (nil, zero SKU, or non-positive
	// quantity).
	ErrInventoryItemInvalid = errors.New("invalid inventory item")

	// ErrInsufficientStock is returned when an operation would drive a
	// SKU's inventory below zero. It covers both administrator-initiated
	// adjustments and order-driven reservations.
	ErrInsufficientStock = errors.New("insufficient stock")

	// ErrInvalidAdjustment is returned when UpdateInventory is called
	// with a zero adjustment or an empty reason.
	ErrInvalidAdjustment = errors.New("invalid inventory adjustment")
)

// DefaultLowStockThreshold is the default threshold below which a SKU is
// considered low stock. Administrators can override it per-call via
// GetLowStockAlerts (requirement 15.6).
const DefaultLowStockThreshold = 10

// reservedOrderStatuses enumerates the order statuses that continue to
// hold reserved inventory. When an order reaches "completed" or
// "cancelled" its inventory is no longer considered reserved (cancellation
// restores the stock via ReleaseInventory). The set is used by
// GetInventory to compute the Reserved field.
var reservedOrderStatuses = []models.OrderStatus{
	models.OrderStatusPendingPayment,
	models.OrderStatusPendingTransfer,
	models.OrderStatusPaid,
	models.OrderStatusPendingShipment,
	models.OrderStatusShipped,
}

// InventoryInfo captures the current inventory picture for a SKU. Available
// is the remaining stock that can be sold, Reserved is the quantity held
// by orders that are in flight (inventory has been decremented but the
// order is not yet terminal), and LowStock flags SKUs at or below the
// configured low-stock threshold (requirement 15.6).
type InventoryInfo struct {
	SKUID     uint `json:"sku_id"`
	Available int  `json:"available"`
	Reserved  int  `json:"reserved"`
	LowStock  bool `json:"low_stock"`
}

// InventoryItem is the SKU + quantity pair passed to bulk reservation /
// release operations. Callers build the slice from their cart or order
// items before invoking the service.
type InventoryItem struct {
	SKUID    uint `json:"sku_id"`
	Quantity int  `json:"quantity"`
}

// InventoryAlert is a low-stock alert entry returned by
// GetLowStockAlerts (requirement 15.6). It carries enough context for the
// admin UI to render the alert without additional queries.
type InventoryAlert struct {
	SKUID       uint   `json:"sku_id"`
	SKUCode     string `json:"sku_code"`
	ProductName string `json:"product_name"`
	CurrentQty  int    `json:"current_qty"`
	Threshold   int    `json:"threshold"`
}

// ListInventoryHistoryParams carries the page/page_size/date-range options
// accepted by GetInventoryHistory. The service translates them into the
// limit/offset shape understood by the inventory log repository.
type ListInventoryHistoryParams struct {
	Page      int
	PageSize  int
	StartDate *time.Time
	EndDate   *time.Time
	SortOrder string // "asc" or "desc"; default "desc"
}

// ListInventoryParams carries the pagination and filter options for the
// ListInventory admin endpoint.
type ListInventoryParams struct {
	Page     int
	PageSize int
	Search   string // optional: filter by SKU code or product name
}

// InventoryListItem represents a single row in the admin inventory list.
type InventoryListItem struct {
	SKUID       uint   `json:"sku_id"`
	SKUCode     string `json:"sku_code"`
	ProductID   uint   `json:"product_id"`
	ProductName string `json:"product_name"`
	Inventory   int    `json:"inventory"`
	IsActive    bool   `json:"is_active"`
	LowStock    bool   `json:"low_stock"`
}

// InventoryListResult wraps the paginated inventory list response.
type InventoryListResult struct {
	Items []*InventoryListItem `json:"items"`
	Total int64                `json:"total"`
	Page  int                  `json:"page"`
	Size  int                  `json:"size"`
}

// InventoryService defines the interface for inventory business logic.
//
// Responsibilities (requirements 15.1-15.7):
//   - 15.1: Reserve inventory when an order is created
//   - 15.2: Release inventory when an order is cancelled
//   - 15.3: Allow admin adjustments with a reason note
//   - 15.4: Prevent reservations that would drive stock below zero
//   - 15.5: Record every change in the inventory log
//   - 15.6: Surface low-stock alerts against a configurable threshold
//   - 15.7: Expose paginated inventory history per SKU
type InventoryService interface {
	// ListInventory returns a paginated list of all SKU inventory for the
	// admin inventory management view.
	ListInventory(ctx context.Context, params *ListInventoryParams) (*InventoryListResult, error)
	// GetInventory returns the current stock picture for a SKU.
	GetInventory(ctx context.Context, skuID uint) (*InventoryInfo, error)

	// UpdateInventory applies an administrator-driven adjustment. A
	// positive adjustment increases stock; a negative adjustment
	// decreases it. The change is recorded in the inventory log with
	// the supplied reason and administrator id for auditability.
	UpdateInventory(ctx context.Context, skuID uint, adjustment int, reason string, adminID uint) error

	// ReserveInventory decrements stock for every item in the slice and
	// records a log entry per SKU. The whole set is processed inside a
	// single database transaction: a failure on any SKU rolls back the
	// previous successes so reservations never land partially.
	ReserveInventory(ctx context.Context, items []*InventoryItem, orderID uint) error

	// ReleaseInventory is the counterpart to ReserveInventory. It
	// restores stock for every item in the slice and records the change.
	// Like ReserveInventory, the whole set is applied atomically.
	ReleaseInventory(ctx context.Context, items []*InventoryItem, orderID uint) error

	// GetLowStockAlerts returns every active SKU whose inventory is at
	// or below the given threshold. Passing a threshold <= 0 falls back
	// to the service's default (DefaultLowStockThreshold).
	GetLowStockAlerts(ctx context.Context, threshold int) ([]*InventoryAlert, error)

	// GetInventoryHistory returns the paginated change history for the
	// given SKU together with the total number of matching rows. The
	// second return value is the total count useful for UI pagination.
	GetInventoryHistory(ctx context.Context, skuID uint, params *ListInventoryHistoryParams) ([]*models.InventoryLog, int64, error)
}

// inventoryService implements InventoryService.
//
// The service owns two repositories plus a transaction manager so
// inventory mutations and their audit log entries commit atomically. A
// raw *gorm.DB handle is injected for cross-table queries that are not
// modelled on any single repository (reserved-qty lookups join
// order_items with orders; low-stock alerts join skus with products).
type inventoryService struct {
	skuRepo      repositories.SKURepository
	logRepo      repositories.InventoryLogRepository
	txManager    repositories.TxManager
	db           *gorm.DB
	lowThreshold int
}

// NewInventoryService constructs an InventoryService.
//
// txManager may be nil in tests that do not exercise transactional
// behaviour; production wiring should always supply a real manager so
// stock mutations and log entries are applied atomically.
//
// db is used exclusively for read-only cross-table queries
// (reserved-qty and low-stock listings). It may be nil, in which case
// GetInventory returns Reserved=0 and GetLowStockAlerts returns an empty
// list; both degradations are safe defaults for tests that do not wire
// a database.
func NewInventoryService(
	skuRepo repositories.SKURepository,
	logRepo repositories.InventoryLogRepository,
	txManager repositories.TxManager,
	db *gorm.DB,
) InventoryService {
	return &inventoryService{
		skuRepo:      skuRepo,
		logRepo:      logRepo,
		txManager:    txManager,
		db:           db,
		lowThreshold: DefaultLowStockThreshold,
	}
}

// ListInventory returns a paginated list of all SKU inventory for the admin
// inventory management view. It joins SKUs with products to provide context.
func (s *inventoryService) ListInventory(ctx context.Context, params *ListInventoryParams) (*InventoryListResult, error) {
	if s.db == nil {
		return &InventoryListResult{Items: []*InventoryListItem{}, Total: 0, Page: 1, Size: 20}, nil
	}

	p := normalizeListInventoryParams(params)

	type row struct {
		SKUID       uint   `gorm:"column:sku_id"`
		SKUCode     string `gorm:"column:sku_code"`
		ProductID   uint   `gorm:"column:product_id"`
		ProductName string `gorm:"column:product_name"`
		Inventory   int    `gorm:"column:inventory"`
		IsActive    bool   `gorm:"column:is_active"`
	}

	query := s.db.WithContext(ctx).
		Table("skus").
		Select(
			"skus.id AS sku_id, "+
				"skus.sku_code AS sku_code, "+
				"skus.product_id AS product_id, "+
				"COALESCE(products.name, '') AS product_name, "+
				"skus.inventory AS inventory, "+
				"skus.is_active AS is_active",
		).
		Joins("LEFT JOIN products ON products.id = skus.product_id")

	if p.Search != "" {
		like := "%" + p.Search + "%"
		query = query.Where("skus.sku_code ILIKE ? OR products.name ILIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count inventory items: %w", err)
	}

	var rows []row
	err := query.
		Order("skus.id ASC").
		Limit(p.PageSize).
		Offset((p.Page - 1) * p.PageSize).
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list inventory: %w", err)
	}

	items := make([]*InventoryListItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, &InventoryListItem{
			SKUID:       r.SKUID,
			SKUCode:     r.SKUCode,
			ProductID:   r.ProductID,
			ProductName: r.ProductName,
			Inventory:   r.Inventory,
			IsActive:    r.IsActive,
			LowStock:    r.Inventory <= s.lowThreshold,
		})
	}

	return &InventoryListResult{
		Items: items,
		Total: total,
		Page:  p.Page,
		Size:  p.PageSize,
	}, nil
}

// GetInventory returns the stock picture for a SKU. Available is read from
// the SKU row (which is decremented atomically on order creation), and
// Reserved is computed by summing active order items for the same SKU.
func (s *inventoryService) GetInventory(ctx context.Context, skuID uint) (*InventoryInfo, error) {
	if skuID == 0 {
		return nil, fmt.Errorf("sku id is required")
	}

	sku, err := s.skuRepo.GetByID(ctx, skuID)
	if err != nil {
		return nil, err
	}

	reserved, err := s.reservedQuantity(ctx, skuID)
	if err != nil {
		return nil, err
	}

	return &InventoryInfo{
		SKUID:     sku.ID,
		Available: sku.Inventory,
		Reserved:  reserved,
		LowStock:  sku.Inventory <= s.lowThreshold,
	}, nil
}

// UpdateInventory applies an administrator adjustment and records an
// inventory log entry. The adjustment value is added to the current
// stock; negative adjustments that would drive inventory below zero
// return ErrInsufficientStock without touching the database.
//
// Requirements addressed:
//   - 15.3: admin manual adjustment with reason note
//   - 15.4: reject negative adjustments exceeding current stock
//   - 15.5: record the change in the inventory log
func (s *inventoryService) UpdateInventory(
	ctx context.Context,
	skuID uint,
	adjustment int,
	reason string,
	adminID uint,
) error {
	if skuID == 0 {
		return fmt.Errorf("sku id is required")
	}
	if adjustment == 0 {
		return fmt.Errorf("%w: adjustment cannot be zero", ErrInvalidAdjustment)
	}
	if reason == "" {
		return fmt.Errorf("%w: reason is required", ErrInvalidAdjustment)
	}

	return s.runInTransaction(ctx, func(txCtx context.Context) error {
		sku, err := s.skuRepo.GetByID(txCtx, skuID)
		if err != nil {
			return err
		}

		previousQty := sku.Inventory
		newQty := previousQty + adjustment
		if newQty < 0 {
			return fmt.Errorf(
				"%w: sku %d has %d in stock, adjustment %d",
				ErrInsufficientStock, skuID, previousQty, adjustment,
			)
		}

		// Apply the change using the repository's atomic helpers so
		// concurrent writers cannot interleave and produce a negative
		// inventory. Translate the repo-level sentinel into the
		// service-level one so callers get a stable error type.
		if adjustment > 0 {
			if err := s.skuRepo.IncrementInventory(txCtx, skuID, adjustment); err != nil {
				return fmt.Errorf("failed to increment inventory: %w", err)
			}
		} else {
			if err := s.skuRepo.DecrementInventory(txCtx, skuID, -adjustment); err != nil {
				if errors.Is(err, repositories.ErrInsufficientInventory) {
					return fmt.Errorf("%w: sku %d", ErrInsufficientStock, skuID)
				}
				return fmt.Errorf("failed to decrement inventory: %w", err)
			}
		}

		var adminPtr *uint
		if adminID != 0 {
			v := adminID
			adminPtr = &v
		}
		entry := &models.InventoryLog{
			SKUID:       skuID,
			PreviousQty: previousQty,
			NewQty:      newQty,
			Change:      adjustment,
			Reason:      reason,
			AdminID:     adminPtr,
		}
		if err := s.logRepo.Create(txCtx, entry); err != nil {
			return fmt.Errorf("failed to record inventory log: %w", err)
		}
		return nil
	})
}

// ReserveInventory decrements stock for each requested item in one
// transaction. If any SKU has insufficient stock the whole batch is
// rolled back and ErrInsufficientStock is returned; no partial
// reservations are ever persisted.
//
// Requirements addressed:
//   - 15.1: reduce SKU inventory by the ordered quantity
//   - 15.4: prevent orders when inventory would go negative
//   - 15.5: record every reservation in the inventory log
func (s *inventoryService) ReserveInventory(
	ctx context.Context,
	items []*InventoryItem,
	orderID uint,
) error {
	if len(items) == 0 {
		return nil
	}
	if err := validateInventoryItems(items); err != nil {
		return err
	}

	orderPtr := orderPtrOrNil(orderID)

	return s.runInTransaction(ctx, func(txCtx context.Context) error {
		for _, item := range items {
			sku, err := s.skuRepo.GetByID(txCtx, item.SKUID)
			if err != nil {
				return err
			}
			previousQty := sku.Inventory
			if previousQty < item.Quantity {
				return fmt.Errorf(
					"%w: sku %d has %d in stock, requested %d",
					ErrInsufficientStock, item.SKUID, previousQty, item.Quantity,
				)
			}
			if err := s.skuRepo.DecrementInventory(txCtx, item.SKUID, item.Quantity); err != nil {
				if errors.Is(err, repositories.ErrInsufficientInventory) {
					return fmt.Errorf("%w: sku %d", ErrInsufficientStock, item.SKUID)
				}
				return fmt.Errorf("failed to decrement inventory for sku %d: %w", item.SKUID, err)
			}
			entry := &models.InventoryLog{
				SKUID:       item.SKUID,
				PreviousQty: previousQty,
				NewQty:      previousQty - item.Quantity,
				Change:      -item.Quantity,
				Reason:      "order reservation",
				OrderID:     orderPtr,
			}
			if err := s.logRepo.Create(txCtx, entry); err != nil {
				return fmt.Errorf("failed to record inventory log for sku %d: %w", item.SKUID, err)
			}
		}
		return nil
	})
}

// ReleaseInventory restores stock for each item. It is the mirror image
// of ReserveInventory and is called by the order cancellation flow.
//
// Requirements addressed:
//   - 15.2: restore SKU inventory on order cancellation
//   - 15.5: record every release in the inventory log
func (s *inventoryService) ReleaseInventory(
	ctx context.Context,
	items []*InventoryItem,
	orderID uint,
) error {
	if len(items) == 0 {
		return nil
	}
	if err := validateInventoryItems(items); err != nil {
		return err
	}

	orderPtr := orderPtrOrNil(orderID)

	return s.runInTransaction(ctx, func(txCtx context.Context) error {
		for _, item := range items {
			sku, err := s.skuRepo.GetByID(txCtx, item.SKUID)
			if err != nil {
				return err
			}
			previousQty := sku.Inventory
			if err := s.skuRepo.IncrementInventory(txCtx, item.SKUID, item.Quantity); err != nil {
				return fmt.Errorf("failed to increment inventory for sku %d: %w", item.SKUID, err)
			}
			entry := &models.InventoryLog{
				SKUID:       item.SKUID,
				PreviousQty: previousQty,
				NewQty:      previousQty + item.Quantity,
				Change:      item.Quantity,
				Reason:      "order cancellation",
				OrderID:     orderPtr,
			}
			if err := s.logRepo.Create(txCtx, entry); err != nil {
				return fmt.Errorf("failed to record inventory log for sku %d: %w", item.SKUID, err)
			}
		}
		return nil
	})
}

// GetLowStockAlerts returns every active SKU whose inventory is at or
// below the given threshold (requirement 15.6). Passing a non-positive
// threshold falls back to the service-level default so callers can omit
// the argument when they just want the standard view.
func (s *inventoryService) GetLowStockAlerts(
	ctx context.Context,
	threshold int,
) ([]*InventoryAlert, error) {
	if threshold <= 0 {
		threshold = s.lowThreshold
	}
	if s.db == nil {
		return []*InventoryAlert{}, nil
	}

	type row struct {
		SKUID       uint   `gorm:"column:sku_id"`
		SKUCode     string `gorm:"column:sku_code"`
		ProductName string `gorm:"column:product_name"`
		CurrentQty  int    `gorm:"column:current_qty"`
	}
	var rows []row
	err := s.db.WithContext(ctx).
		Table("skus").
		Select(
			"skus.id AS sku_id, "+
				"skus.sku_code AS sku_code, "+
				"COALESCE(products.name, '') AS product_name, "+
				"skus.inventory AS current_qty",
		).
		Joins("LEFT JOIN products ON products.id = skus.product_id").
		Where("skus.is_active = ? AND skus.inventory <= ?", true, threshold).
		Order("skus.inventory ASC, skus.id ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list low stock alerts: %w", err)
	}

	alerts := make([]*InventoryAlert, 0, len(rows))
	for _, r := range rows {
		alerts = append(alerts, &InventoryAlert{
			SKUID:       r.SKUID,
			SKUCode:     r.SKUCode,
			ProductName: r.ProductName,
			CurrentQty:  r.CurrentQty,
			Threshold:   threshold,
		})
	}
	return alerts, nil
}

// GetInventoryHistory returns the paginated inventory log entries for a
// SKU. Page / PageSize are normalised to sensible defaults and clamped to
// a maximum of 100 rows per page so clients cannot accidentally request
// huge result sets.
//
// Requirements addressed:
//   - 15.7: admin inventory history report per SKU
func (s *inventoryService) GetInventoryHistory(
	ctx context.Context,
	skuID uint,
	params *ListInventoryHistoryParams,
) ([]*models.InventoryLog, int64, error) {
	if skuID == 0 {
		return nil, 0, fmt.Errorf("sku id is required")
	}

	p := normalizeInventoryHistoryParams(params)
	repoParams := &repositories.ListInventoryLogParams{
		Limit:     p.PageSize,
		Offset:    (p.Page - 1) * p.PageSize,
		StartDate: p.StartDate,
		EndDate:   p.EndDate,
		SortOrder: p.SortOrder,
	}
	return s.logRepo.GetBySKUID(ctx, skuID, repoParams)
}

// reservedQuantity sums the quantities of order items for the given SKU
// whose order is still in a reserved (non-terminal) state. It is used by
// GetInventory to report the Reserved field. When no DB handle was
// injected the method returns zero to remain safe in unit tests that
// exercise the service without a real database.
func (s *inventoryService) reservedQuantity(ctx context.Context, skuID uint) (int, error) {
	if s.db == nil {
		return 0, nil
	}
	// Use the transaction from context when one is active so the read
	// stays consistent with the surrounding transactional write set.
	db := s.db.WithContext(ctx)
	if tx, ok := repositories.TxFromContext(ctx); ok {
		db = tx.WithContext(ctx)
	}

	var total int64
	err := db.
		Table("order_items").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("order_items.sku_id = ? AND orders.status IN (?)", skuID, reservedOrderStatuses).
		Select("COALESCE(SUM(order_items.quantity), 0)").
		Scan(&total).Error
	if err != nil {
		return 0, fmt.Errorf("failed to compute reserved quantity: %w", err)
	}
	return int(total), nil
}

// runInTransaction executes fn inside the injected transaction manager.
// When no manager was provided fn runs against the original context,
// matching the pattern used by OrderService / PaymentService.
func (s *inventoryService) runInTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	if s.txManager == nil {
		return fn(ctx)
	}
	return s.txManager.RunInTransaction(ctx, fn)
}

// validateInventoryItems rejects the caller's input if any item is nil
// or carries an invalid SKU id or quantity. Keeping the check in one
// place means ReserveInventory and ReleaseInventory stay symmetric.
func validateInventoryItems(items []*InventoryItem) error {
	for i, item := range items {
		if item == nil {
			return fmt.Errorf("%w: item %d is nil", ErrInventoryItemInvalid, i)
		}
		if item.SKUID == 0 {
			return fmt.Errorf("%w: item %d has zero sku id", ErrInventoryItemInvalid, i)
		}
		if item.Quantity <= 0 {
			return fmt.Errorf("%w: item %d quantity must be greater than zero", ErrInventoryItemInvalid, i)
		}
	}
	return nil
}

// orderPtrOrNil converts a uint order id into a *uint suitable for an
// InventoryLog. A zero value is treated as "no order" and returns nil so
// administrator-initiated adjustments (which do not carry an order id)
// are stored with order_id = NULL rather than 0.
func orderPtrOrNil(orderID uint) *uint {
	if orderID == 0 {
		return nil
	}
	v := orderID
	return &v
}

// normalizeInventoryHistoryParams returns a params struct with defaulted
// pagination and sort values. It never mutates the caller's input and
// always produces a non-nil result, even when the caller passes nil.
func normalizeInventoryHistoryParams(req *ListInventoryHistoryParams) *ListInventoryHistoryParams {
	out := ListInventoryHistoryParams{}
	if req != nil {
		out = *req
	}
	if out.Page < 1 {
		out.Page = 1
	}
	if out.PageSize < 1 {
		out.PageSize = 20
	}
	if out.PageSize > 100 {
		out.PageSize = 100
	}
	if out.SortOrder != "asc" && out.SortOrder != "desc" {
		out.SortOrder = "desc"
	}
	return &out
}

// normalizeListInventoryParams returns a params struct with defaulted
// pagination values for the ListInventory endpoint.
func normalizeListInventoryParams(req *ListInventoryParams) *ListInventoryParams {
	out := ListInventoryParams{}
	if req != nil {
		out = *req
	}
	if out.Page < 1 {
		out.Page = 1
	}
	if out.PageSize < 1 {
		out.PageSize = 20
	}
	if out.PageSize > 100 {
		out.PageSize = 100
	}
	return &out
}
