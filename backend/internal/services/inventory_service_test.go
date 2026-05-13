package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newInventoryService builds an InventoryService wired to freshly minted
// mocks and a passthrough transaction manager. The mocks are returned so
// tests can configure expectations.
//
// A nil *gorm.DB is passed in: the service is designed to degrade
// gracefully when no DB handle is available (GetInventory reports
// Reserved=0 and GetLowStockAlerts returns an empty slice). That lets us
// unit-test the bulk of the service without a database; the cross-table
// queries that genuinely require a DB are noted inline.
func newInventoryService(t *testing.T) (
	InventoryService,
	*MockSKURepository,
	*MockInventoryLogRepository,
) {
	t.Helper()
	skuRepo := new(MockSKURepository)
	logRepo := new(MockInventoryLogRepository)
	svc := NewInventoryService(skuRepo, logRepo, passthroughTxManager{}, nil)
	return svc, skuRepo, logRepo
}

// newInventorySKU returns a SKU with the given id and inventory, suitable
// for the GetByID mock calls the service performs before every mutation.
func newInventorySKU(id uint, inventory int) *models.SKU {
	return &models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: id},
		ProductID:      1,
		SKUCode:        "SKU-INV-" + decimal.NewFromInt(int64(id)).String(),
		Price:          decimal.NewFromFloat(10),
		Inventory:      inventory,
		IsActive:       true,
	}
}

// ---------------------------------------------------------------------------
// GetInventory
// ---------------------------------------------------------------------------

// TestInventoryService_GetInventory_ReturnsAvailableAndLowStock verifies
// that GetInventory reads the current SKU inventory, reports Reserved as
// zero when no DB handle is wired, and flags low_stock when inventory is
// at or below the default threshold (Requirements 15.1, 15.6).
func TestInventoryService_GetInventory_ReturnsAvailableAndLowStock(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	// Inventory of 10 (equal to DefaultLowStockThreshold) should still
	// be considered low stock because the comparison is <=.
	sku := newInventorySKU(1, DefaultLowStockThreshold)
	skuRepo.On("GetByID", ctx, uint(1)).Return(sku, nil).Once()

	info, err := svc.GetInventory(ctx, 1)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.Equal(t, uint(1), info.SKUID)
	assert.Equal(t, DefaultLowStockThreshold, info.Available)
	// With a nil *gorm.DB the reserved query short-circuits to zero.
	assert.Equal(t, 0, info.Reserved)
	assert.True(t, info.LowStock, "expected low_stock=true when inventory == threshold")

	skuRepo.AssertExpectations(t)
}

// TestInventoryService_GetInventory_NotLowStockAboveThreshold verifies
// that a SKU with inventory above the threshold is reported as NOT low
// stock (Requirement 15.6).
func TestInventoryService_GetInventory_NotLowStockAboveThreshold(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(2, DefaultLowStockThreshold+5)
	skuRepo.On("GetByID", ctx, uint(2)).Return(sku, nil).Once()

	info, err := svc.GetInventory(ctx, 2)
	require.NoError(t, err)
	assert.Equal(t, DefaultLowStockThreshold+5, info.Available)
	assert.False(t, info.LowStock)
}

// TestInventoryService_GetInventory_ZeroIDRejected verifies that a zero
// SKU id is rejected without touching the repository.
func TestInventoryService_GetInventory_ZeroIDRejected(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	info, err := svc.GetInventory(ctx, 0)
	assert.Nil(t, info)
	assert.Error(t, err)
	skuRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
}

// TestInventoryService_GetInventory_SKUNotFound verifies that a SKU
// lookup failure is surfaced to the caller.
func TestInventoryService_GetInventory_SKUNotFound(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	skuRepo.On("GetByID", ctx, uint(99)).Return(nil, errors.New("SKU not found")).Once()

	info, err := svc.GetInventory(ctx, 99)
	assert.Nil(t, info)
	assert.Error(t, err)
}

// ---------------------------------------------------------------------------
// UpdateInventory
// ---------------------------------------------------------------------------

// TestInventoryService_UpdateInventory_PositiveAdjustmentLogs verifies
// that a positive adjustment increments inventory via the atomic helper
// and writes a log entry with correct prev/new/change/reason/admin_id
// (Requirements 15.3, 15.5).
func TestInventoryService_UpdateInventory_PositiveAdjustmentLogs(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(5, 20)
	skuRepo.On("GetByID", ctx, uint(5)).Return(sku, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(5), 15).Return(nil).Once()

	var captured *models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		captured = l
		return true
	})).Return(nil).Once()

	err := svc.UpdateInventory(ctx, 5, 15, "restock from supplier", 7)
	require.NoError(t, err)

	require.NotNil(t, captured)
	assert.Equal(t, uint(5), captured.SKUID)
	assert.Equal(t, 20, captured.PreviousQty)
	assert.Equal(t, 35, captured.NewQty)
	assert.Equal(t, 15, captured.Change)
	assert.Equal(t, "restock from supplier", captured.Reason)
	require.NotNil(t, captured.AdminID)
	assert.Equal(t, uint(7), *captured.AdminID)
	// Admin adjustments are not tied to an order.
	assert.Nil(t, captured.OrderID)

	skuRepo.AssertExpectations(t)
	logRepo.AssertExpectations(t)
}

// TestInventoryService_UpdateInventory_NegativeAdjustmentLogs verifies
// that a negative adjustment decrements inventory and records a log
// entry with a negative change (Requirements 15.3, 15.5).
func TestInventoryService_UpdateInventory_NegativeAdjustmentLogs(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(6, 12)
	skuRepo.On("GetByID", ctx, uint(6)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(6), 4).Return(nil).Once()

	var captured *models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		captured = l
		return true
	})).Return(nil).Once()

	err := svc.UpdateInventory(ctx, 6, -4, "damaged goods", 3)
	require.NoError(t, err)

	require.NotNil(t, captured)
	assert.Equal(t, 12, captured.PreviousQty)
	assert.Equal(t, 8, captured.NewQty)
	assert.Equal(t, -4, captured.Change)
	assert.Equal(t, "damaged goods", captured.Reason)
}

// TestInventoryService_UpdateInventory_RejectsNegativeGoingBelowZero
// verifies that an adjustment that would drive inventory below zero is
// rejected with ErrInsufficientStock BEFORE any repository mutation
// (Requirement 15.4).
func TestInventoryService_UpdateInventory_RejectsNegativeGoingBelowZero(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(8, 3)
	skuRepo.On("GetByID", ctx, uint(8)).Return(sku, nil).Once()

	err := svc.UpdateInventory(ctx, 8, -10, "bulk write-off", 1)
	assert.ErrorIs(t, err, ErrInsufficientStock)

	skuRepo.AssertNotCalled(t, "DecrementInventory", mock.Anything, mock.Anything, mock.Anything)
	skuRepo.AssertNotCalled(t, "IncrementInventory", mock.Anything, mock.Anything, mock.Anything)
	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestInventoryService_UpdateInventory_RaceReturnsInsufficientStock
// verifies that a concurrent writer surfacing as repositories.ErrInsufficientInventory
// is translated into the service-level ErrInsufficientStock (Requirement
// 15.4).
func TestInventoryService_UpdateInventory_RaceReturnsInsufficientStock(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(9, 5)
	skuRepo.On("GetByID", ctx, uint(9)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(9), 2).
		Return(repositories.ErrInsufficientInventory).Once()

	err := svc.UpdateInventory(ctx, 9, -2, "correction", 1)
	assert.ErrorIs(t, err, ErrInsufficientStock)

	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestInventoryService_UpdateInventory_ZeroAdjustmentRejected verifies
// that a zero adjustment is rejected with ErrInvalidAdjustment without
// touching the repositories.
func TestInventoryService_UpdateInventory_ZeroAdjustmentRejected(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	err := svc.UpdateInventory(ctx, 1, 0, "noop", 1)
	assert.ErrorIs(t, err, ErrInvalidAdjustment)

	skuRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestInventoryService_UpdateInventory_EmptyReasonRejected verifies that
// an empty reason is rejected with ErrInvalidAdjustment (Requirement 15.3
// requires a reason note for manual adjustments).
func TestInventoryService_UpdateInventory_EmptyReasonRejected(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	err := svc.UpdateInventory(ctx, 1, 5, "", 1)
	assert.ErrorIs(t, err, ErrInvalidAdjustment)

	skuRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestInventoryService_UpdateInventory_ZeroSKUIDRejected verifies that a
// zero SKU id is rejected before any repo call.
func TestInventoryService_UpdateInventory_ZeroSKUIDRejected(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	err := svc.UpdateInventory(ctx, 0, 5, "reason", 1)
	assert.Error(t, err)
	skuRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
}

// TestInventoryService_UpdateInventory_OmitsAdminIDWhenZero verifies
// that an admin id of zero is stored as NULL (not as 0) on the log entry
// so administrator-less adjustments (e.g. system driven) are distinguishable.
func TestInventoryService_UpdateInventory_OmitsAdminIDWhenZero(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(11, 20)
	skuRepo.On("GetByID", ctx, uint(11)).Return(sku, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(11), 5).Return(nil).Once()

	var captured *models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		captured = l
		return true
	})).Return(nil).Once()

	err := svc.UpdateInventory(ctx, 11, 5, "system auto-correction", 0)
	require.NoError(t, err)
	require.NotNil(t, captured)
	assert.Nil(t, captured.AdminID, "zero admin id should be stored as NULL")
}

// ---------------------------------------------------------------------------
// ReserveInventory
// ---------------------------------------------------------------------------

// TestInventoryService_ReserveInventory_DecrementsAndLogsPerItem verifies
// that every item in the batch is decremented and a log entry is written
// with the correct previous/new/change values, the "order reservation"
// reason, and the reserving order id (Requirements 15.1, 15.5).
func TestInventoryService_ReserveInventory_DecrementsAndLogsPerItem(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku1 := newInventorySKU(1, 20)
	sku2 := newInventorySKU(2, 5)

	skuRepo.On("GetByID", ctx, uint(1)).Return(sku1, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 3).Return(nil).Once()
	skuRepo.On("GetByID", ctx, uint(2)).Return(sku2, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(2), 1).Return(nil).Once()

	var logs []*models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		logs = append(logs, l)
		return true
	})).Return(nil).Times(2)

	items := []*InventoryItem{
		{SKUID: 1, Quantity: 3},
		{SKUID: 2, Quantity: 1},
	}
	err := svc.ReserveInventory(ctx, items, 99)
	require.NoError(t, err)
	require.Len(t, logs, 2)

	// SKU 1: 20 - 3 = 17
	assert.Equal(t, uint(1), logs[0].SKUID)
	assert.Equal(t, 20, logs[0].PreviousQty)
	assert.Equal(t, 17, logs[0].NewQty)
	assert.Equal(t, -3, logs[0].Change)
	assert.Equal(t, "order reservation", logs[0].Reason)
	require.NotNil(t, logs[0].OrderID)
	assert.Equal(t, uint(99), *logs[0].OrderID)

	// SKU 2: 5 - 1 = 4
	assert.Equal(t, uint(2), logs[1].SKUID)
	assert.Equal(t, 5, logs[1].PreviousQty)
	assert.Equal(t, 4, logs[1].NewQty)
	assert.Equal(t, -1, logs[1].Change)
	require.NotNil(t, logs[1].OrderID)
	assert.Equal(t, uint(99), *logs[1].OrderID)

	skuRepo.AssertExpectations(t)
	logRepo.AssertExpectations(t)
}

// TestInventoryService_ReserveInventory_EmptyItemsNoOp verifies that
// passing an empty (or nil) slice is a silent success and does not touch
// any repository.
func TestInventoryService_ReserveInventory_EmptyItemsNoOp(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	require.NoError(t, svc.ReserveInventory(ctx, nil, 1))
	require.NoError(t, svc.ReserveInventory(ctx, []*InventoryItem{}, 1))

	skuRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestInventoryService_ReserveInventory_NilItemRejected verifies that a
// nil entry in the batch is rejected with ErrInventoryItemInvalid.
func TestInventoryService_ReserveInventory_NilItemRejected(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	items := []*InventoryItem{
		{SKUID: 1, Quantity: 2},
		nil,
	}
	err := svc.ReserveInventory(ctx, items, 1)
	assert.ErrorIs(t, err, ErrInventoryItemInvalid)
	skuRepo.AssertNotCalled(t, "DecrementInventory", mock.Anything, mock.Anything, mock.Anything)
}

// TestInventoryService_ReserveInventory_NonPositiveQuantityRejected
// verifies that zero and negative quantities are rejected without
// touching any repository.
func TestInventoryService_ReserveInventory_NonPositiveQuantityRejected(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	for _, qty := range []int{0, -1} {
		items := []*InventoryItem{{SKUID: 1, Quantity: qty}}
		err := svc.ReserveInventory(ctx, items, 1)
		assert.ErrorIsf(t, err, ErrInventoryItemInvalid, "qty=%d should be rejected", qty)
	}
	skuRepo.AssertNotCalled(t, "DecrementInventory", mock.Anything, mock.Anything, mock.Anything)
}

// TestInventoryService_ReserveInventory_ZeroSKUIDRejected verifies that
// an item with a zero SKU id is rejected.
func TestInventoryService_ReserveInventory_ZeroSKUIDRejected(t *testing.T) {
	svc, _, _ := newInventoryService(t)
	ctx := context.Background()

	err := svc.ReserveInventory(ctx, []*InventoryItem{{SKUID: 0, Quantity: 1}}, 1)
	assert.ErrorIs(t, err, ErrInventoryItemInvalid)
}

// TestInventoryService_ReserveInventory_InsufficientStockHaltsBatch
// verifies that encountering a SKU with insufficient stock aborts the
// remaining items: the failing item's Decrement is never called and
// subsequent items are not even inspected (Requirement 15.4).
//
// With the passthrough transaction manager used in tests, earlier
// successes are not rolled back; the test only asserts that the batch
// stops at the failure point, which is the behaviour the service relies
// on the real transaction manager to extend into a clean rollback.
func TestInventoryService_ReserveInventory_InsufficientStockHaltsBatch(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku1 := newInventorySKU(1, 20)
	sku2 := newInventorySKU(2, 1) // Only 1 in stock, requesting 5

	// SKU 1 processes completely before the batch fails on SKU 2.
	skuRepo.On("GetByID", ctx, uint(1)).Return(sku1, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 3).Return(nil).Once()
	logRepo.On("Create", ctx, mock.AnythingOfType("*models.InventoryLog")).
		Return(nil).Once()

	// SKU 2 is read but the pre-check stops the batch before Decrement.
	skuRepo.On("GetByID", ctx, uint(2)).Return(sku2, nil).Once()

	// SKU 3 is never touched because the batch aborts on SKU 2.
	items := []*InventoryItem{
		{SKUID: 1, Quantity: 3},
		{SKUID: 2, Quantity: 5},
		{SKUID: 3, Quantity: 1},
	}
	err := svc.ReserveInventory(ctx, items, 42)
	assert.ErrorIs(t, err, ErrInsufficientStock)

	skuRepo.AssertNotCalled(t, "DecrementInventory", mock.Anything, uint(2), mock.Anything)
	skuRepo.AssertNotCalled(t, "GetByID", mock.Anything, uint(3))
}

// TestInventoryService_ReserveInventory_RaceTranslatesRepoError verifies
// that a race surfacing as repositories.ErrInsufficientInventory from
// DecrementInventory is translated into the service-level
// ErrInsufficientStock (Requirement 15.4).
func TestInventoryService_ReserveInventory_RaceTranslatesRepoError(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(1, 5)
	skuRepo.On("GetByID", ctx, uint(1)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 2).
		Return(repositories.ErrInsufficientInventory).Once()

	err := svc.ReserveInventory(ctx, []*InventoryItem{{SKUID: 1, Quantity: 2}}, 1)
	assert.ErrorIs(t, err, ErrInsufficientStock)

	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestInventoryService_ReserveInventory_ZeroOrderIDStoresNullOrder
// verifies that passing an orderID of zero writes the log entry with
// OrderID=NULL (rather than 0) so admin-initiated "bulk reserve" calls
// are distinguishable from order-driven reservations.
func TestInventoryService_ReserveInventory_ZeroOrderIDStoresNullOrder(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(1, 10)
	skuRepo.On("GetByID", ctx, uint(1)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 2).Return(nil).Once()

	var captured *models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		captured = l
		return true
	})).Return(nil).Once()

	err := svc.ReserveInventory(ctx, []*InventoryItem{{SKUID: 1, Quantity: 2}}, 0)
	require.NoError(t, err)
	require.NotNil(t, captured)
	assert.Nil(t, captured.OrderID)
}

// ---------------------------------------------------------------------------
// ReleaseInventory
// ---------------------------------------------------------------------------

// TestInventoryService_ReleaseInventory_IncrementsAndLogsPerItem verifies
// that every item in the batch is incremented and a log entry is written
// with the correct prev/new/positive change values, the "order cancellation"
// reason, and the cancelled order id (Requirements 15.2, 15.5).
func TestInventoryService_ReleaseInventory_IncrementsAndLogsPerItem(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku1 := newInventorySKU(10, 5)
	sku2 := newInventorySKU(20, 0)

	skuRepo.On("GetByID", ctx, uint(10)).Return(sku1, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(10), 2).Return(nil).Once()
	skuRepo.On("GetByID", ctx, uint(20)).Return(sku2, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(20), 3).Return(nil).Once()

	var logs []*models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		logs = append(logs, l)
		return true
	})).Return(nil).Times(2)

	items := []*InventoryItem{
		{SKUID: 10, Quantity: 2},
		{SKUID: 20, Quantity: 3},
	}
	err := svc.ReleaseInventory(ctx, items, 77)
	require.NoError(t, err)
	require.Len(t, logs, 2)

	// SKU 10: 5 + 2 = 7
	assert.Equal(t, uint(10), logs[0].SKUID)
	assert.Equal(t, 5, logs[0].PreviousQty)
	assert.Equal(t, 7, logs[0].NewQty)
	assert.Equal(t, 2, logs[0].Change)
	assert.Equal(t, "order cancellation", logs[0].Reason)
	require.NotNil(t, logs[0].OrderID)
	assert.Equal(t, uint(77), *logs[0].OrderID)

	// SKU 20: 0 + 3 = 3
	assert.Equal(t, uint(20), logs[1].SKUID)
	assert.Equal(t, 0, logs[1].PreviousQty)
	assert.Equal(t, 3, logs[1].NewQty)
	assert.Equal(t, 3, logs[1].Change)
}

// TestInventoryService_ReleaseInventory_EmptyItemsNoOp verifies that
// releasing an empty batch is a silent success.
func TestInventoryService_ReleaseInventory_EmptyItemsNoOp(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	require.NoError(t, svc.ReleaseInventory(ctx, nil, 1))
	require.NoError(t, svc.ReleaseInventory(ctx, []*InventoryItem{}, 1))
	skuRepo.AssertNotCalled(t, "IncrementInventory", mock.Anything, mock.Anything, mock.Anything)
	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestInventoryService_ReleaseInventory_ValidatesItems verifies that the
// same input validation as ReserveInventory applies: nil entries, zero
// SKU ids, and non-positive quantities are all rejected up-front.
func TestInventoryService_ReleaseInventory_ValidatesItems(t *testing.T) {
	svc, skuRepo, _ := newInventoryService(t)
	ctx := context.Background()

	cases := []struct {
		name  string
		items []*InventoryItem
	}{
		{"nil item", []*InventoryItem{nil}},
		{"zero sku id", []*InventoryItem{{SKUID: 0, Quantity: 1}}},
		{"zero quantity", []*InventoryItem{{SKUID: 1, Quantity: 0}}},
		{"negative quantity", []*InventoryItem{{SKUID: 1, Quantity: -1}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := svc.ReleaseInventory(ctx, tc.items, 1)
			assert.ErrorIs(t, err, ErrInventoryItemInvalid)
		})
	}
	skuRepo.AssertNotCalled(t, "IncrementInventory", mock.Anything, mock.Anything, mock.Anything)
}

// TestInventoryService_ReleaseInventory_IncrementFailureBubblesUp
// verifies that a failure restoring inventory on any item halts the
// batch and the error is surfaced to the caller.
func TestInventoryService_ReleaseInventory_IncrementFailureBubblesUp(t *testing.T) {
	svc, skuRepo, logRepo := newInventoryService(t)
	ctx := context.Background()

	sku := newInventorySKU(30, 4)
	skuRepo.On("GetByID", ctx, uint(30)).Return(sku, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(30), 2).
		Return(errors.New("db write failed")).Once()

	err := svc.ReleaseInventory(ctx, []*InventoryItem{{SKUID: 30, Quantity: 2}}, 5)
	assert.ErrorContains(t, err, "db write failed")

	logRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// ---------------------------------------------------------------------------
// GetLowStockAlerts
// ---------------------------------------------------------------------------

// TestInventoryService_GetLowStockAlerts_NilDBReturnsEmpty verifies the
// graceful degradation behaviour: when the service is constructed
// without a *gorm.DB handle (as it is in these unit tests) the low-stock
// listing returns an empty slice rather than failing. Exercising the
// real SQL path requires an integration test with sqlmock or a live DB.
func TestInventoryService_GetLowStockAlerts_NilDBReturnsEmpty(t *testing.T) {
	svc, _, _ := newInventoryService(t)
	ctx := context.Background()

	alerts, err := svc.GetLowStockAlerts(ctx, 20)
	require.NoError(t, err)
	assert.NotNil(t, alerts, "expected empty slice, got nil")
	assert.Len(t, alerts, 0)
}

// TestInventoryService_GetLowStockAlerts_ThresholdFallback verifies that
// a non-positive threshold (0 or negative) falls back to the service's
// default threshold. With a nil DB we can only assert that the call
// succeeds; the threshold value is still exercised internally.
func TestInventoryService_GetLowStockAlerts_ThresholdFallback(t *testing.T) {
	svc, _, _ := newInventoryService(t)
	ctx := context.Background()

	for _, threshold := range []int{0, -1, -100} {
		alerts, err := svc.GetLowStockAlerts(ctx, threshold)
		require.NoError(t, err, "threshold=%d", threshold)
		assert.Len(t, alerts, 0)
	}
}

// ---------------------------------------------------------------------------
// GetInventoryHistory
// ---------------------------------------------------------------------------

// TestInventoryService_GetInventoryHistory_DefaultsPagination verifies
// that a nil params struct results in Page=1, PageSize=20 being passed
// to the repository (Requirement 15.7).
func TestInventoryService_GetInventoryHistory_DefaultsPagination(t *testing.T) {
	svc, _, logRepo := newInventoryService(t)
	ctx := context.Background()

	expected := []*models.InventoryLog{
		{Base: models.Base{ID: 1}, SKUID: 1, Change: -2, Reason: "order reservation"},
	}
	logRepo.On("GetBySKUID", ctx, uint(1), mock.MatchedBy(func(p *repositories.ListInventoryLogParams) bool {
		return p.Limit == 20 && p.Offset == 0 && p.SortOrder == "desc"
	})).Return(expected, int64(1), nil).Once()

	logs, total, err := svc.GetInventoryHistory(ctx, 1, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, logs, 1)
	logRepo.AssertExpectations(t)
}

// TestInventoryService_GetInventoryHistory_DelegatesWithTranslation
// verifies that Page/PageSize are translated into Limit/Offset before
// being handed to the repository and that date / sort filters are
// forwarded unchanged (Requirement 15.7).
func TestInventoryService_GetInventoryHistory_DelegatesWithTranslation(t *testing.T) {
	svc, _, logRepo := newInventoryService(t)
	ctx := context.Background()

	start := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2024, 1, 31, 23, 59, 59, 0, time.UTC)

	logRepo.On("GetBySKUID", ctx, uint(7), mock.MatchedBy(func(p *repositories.ListInventoryLogParams) bool {
		if p.Limit != 25 || p.Offset != 50 { // page 3, size 25 -> offset 50
			return false
		}
		if p.SortOrder != "asc" {
			return false
		}
		if p.StartDate == nil || !p.StartDate.Equal(start) {
			return false
		}
		if p.EndDate == nil || !p.EndDate.Equal(end) {
			return false
		}
		return true
	})).Return([]*models.InventoryLog{}, int64(0), nil).Once()

	params := &ListInventoryHistoryParams{
		Page:      3,
		PageSize:  25,
		StartDate: &start,
		EndDate:   &end,
		SortOrder: "asc",
	}
	_, _, err := svc.GetInventoryHistory(ctx, 7, params)
	require.NoError(t, err)
	logRepo.AssertExpectations(t)
}

// TestInventoryService_GetInventoryHistory_ClampsPageSize verifies that
// a page size above 100 is clamped to 100 before being handed to the
// repository, so clients cannot accidentally pull huge result sets.
func TestInventoryService_GetInventoryHistory_ClampsPageSize(t *testing.T) {
	svc, _, logRepo := newInventoryService(t)
	ctx := context.Background()

	logRepo.On("GetBySKUID", ctx, uint(1), mock.MatchedBy(func(p *repositories.ListInventoryLogParams) bool {
		return p.Limit == 100
	})).Return([]*models.InventoryLog{}, int64(0), nil).Once()

	_, _, err := svc.GetInventoryHistory(ctx, 1, &ListInventoryHistoryParams{Page: 1, PageSize: 500})
	require.NoError(t, err)
}

// TestInventoryService_GetInventoryHistory_ZeroSKUIDRejected verifies
// that a zero SKU id is rejected up-front without calling the repository.
func TestInventoryService_GetInventoryHistory_ZeroSKUIDRejected(t *testing.T) {
	svc, _, logRepo := newInventoryService(t)
	ctx := context.Background()

	_, _, err := svc.GetInventoryHistory(ctx, 0, nil)
	assert.Error(t, err)
	logRepo.AssertNotCalled(t, "GetBySKUID", mock.Anything, mock.Anything, mock.Anything)
}
