package worker

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/pkg/logger"
)

// --- Mock implementations ---

// mockOrderRepo implements repositories.OrderRepository for testing.
type mockOrderRepo struct {
	updatedStatuses map[uint]models.OrderStatus
}

func newMockOrderRepo() *mockOrderRepo {
	return &mockOrderRepo{
		updatedStatuses: make(map[uint]models.OrderStatus),
	}
}

func (m *mockOrderRepo) Create(_ context.Context, _ *models.Order) error { return nil }
func (m *mockOrderRepo) CreateWithItems(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockOrderRepo) GetByID(_ context.Context, _ uint) (*models.Order, error) {
	return nil, nil
}
func (m *mockOrderRepo) GetByOrderNumber(_ context.Context, _ string) (*models.Order, error) {
	return nil, nil
}
func (m *mockOrderRepo) GetByOrderNumberAndEmail(_ context.Context, _, _ string) (*models.Order, error) {
	return nil, nil
}
func (m *mockOrderRepo) ListByUserID(_ context.Context, _ uint, _ *repositories.ListOrderParams) ([]*models.Order, int64, error) {
	return nil, 0, nil
}
func (m *mockOrderRepo) List(_ context.Context, _ *repositories.ListOrderParams) ([]*models.Order, int64, error) {
	return nil, 0, nil
}
func (m *mockOrderRepo) Update(_ context.Context, _ *models.Order) error { return nil }
func (m *mockOrderRepo) UpdateStatus(_ context.Context, id uint, status models.OrderStatus) error {
	m.updatedStatuses[id] = status
	return nil
}
func (m *mockOrderRepo) Delete(_ context.Context, _ uint) error                    { return nil }
func (m *mockOrderRepo) CreateOrderItem(_ context.Context, _ *models.OrderItem) error { return nil }
func (m *mockOrderRepo) GenerateOrderNumber(_ context.Context) (string, error) {
	return "ORD-TEST", nil
}

// mockSKURepo implements repositories.SKURepository for testing.
type mockSKURepo struct {
	skus              map[uint]*models.SKU
	incrementedSKUs   map[uint]int // tracks total incremented quantity per SKU
}

func newMockSKURepo() *mockSKURepo {
	return &mockSKURepo{
		skus:            make(map[uint]*models.SKU),
		incrementedSKUs: make(map[uint]int),
	}
}

func (m *mockSKURepo) Create(_ context.Context, _ *models.SKU) error { return nil }
func (m *mockSKURepo) GetByID(_ context.Context, id uint) (*models.SKU, error) {
	sku, ok := m.skus[id]
	if !ok {
		return &models.SKU{}, nil
	}
	return sku, nil
}
func (m *mockSKURepo) GetBySKUCode(_ context.Context, _ string) (*models.SKU, error) {
	return nil, nil
}
func (m *mockSKURepo) ListByProductID(_ context.Context, _ uint) ([]*models.SKU, error) {
	return nil, nil
}
func (m *mockSKURepo) Update(_ context.Context, _ *models.SKU) error { return nil }
func (m *mockSKURepo) Delete(_ context.Context, _ uint) error        { return nil }
func (m *mockSKURepo) CheckAvailability(_ context.Context, _ uint, _ int) (bool, error) {
	return true, nil
}
func (m *mockSKURepo) GetWithAttributes(_ context.Context, _ uint) (*models.SKU, error) {
	return nil, nil
}
func (m *mockSKURepo) CheckUniqueAttributes(_ context.Context, _ uint, _ []models.SKUAttribute, _ *uint) (bool, error) {
	return true, nil
}
func (m *mockSKURepo) DecrementInventory(_ context.Context, _ uint, _ int) error { return nil }
func (m *mockSKURepo) IncrementInventory(_ context.Context, skuID uint, quantity int) error {
	m.incrementedSKUs[skuID] += quantity
	if sku, ok := m.skus[skuID]; ok {
		sku.Inventory += quantity
	}
	return nil
}

// mockInventoryLogRepo implements repositories.InventoryLogRepository for testing.
type mockInventoryLogRepo struct {
	entries []*models.InventoryLog
}

func newMockInventoryLogRepo() *mockInventoryLogRepo {
	return &mockInventoryLogRepo{
		entries: make([]*models.InventoryLog, 0),
	}
}

func (m *mockInventoryLogRepo) Create(_ context.Context, entry *models.InventoryLog) error {
	m.entries = append(m.entries, entry)
	return nil
}

func (m *mockInventoryLogRepo) GetBySKUID(_ context.Context, _ uint, _ *repositories.ListInventoryLogParams) ([]*models.InventoryLog, int64, error) {
	return nil, 0, nil
}

func (m *mockInventoryLogRepo) GetByOrderID(_ context.Context, _ uint) ([]*models.InventoryLog, error) {
	return nil, nil
}

// mockTxManager implements repositories.TxManager for testing.
// It simply executes the function without a real transaction.
type mockTxManager struct{}

func (m *mockTxManager) RunInTransaction(_ context.Context, fn func(ctx context.Context) error) error {
	return fn(context.Background())
}

// mockNotificationService implements services.NotificationService for testing.
type mockNotificationService struct {
	cancellationsSent []string // order numbers
}

func newMockNotificationService() *mockNotificationService {
	return &mockNotificationService{
		cancellationsSent: make([]string, 0),
	}
}

func (m *mockNotificationService) SendOrderConfirmation(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockNotificationService) SendPaymentConfirmation(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockNotificationService) SendShippingNotification(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockNotificationService) SendPaymentRejection(_ context.Context, _ *models.Order, _ string) error {
	return nil
}
func (m *mockNotificationService) SendOrderCancellation(_ context.Context, order *models.Order) error {
	m.cancellationsSent = append(m.cancellationsSent, order.OrderNumber)
	return nil
}
func (m *mockNotificationService) SendPasswordReset(_ context.Context, _, _ string) error {
	return nil
}
func (m *mockNotificationService) SendTransferDeadlineReminder(_ context.Context, _ *models.Order) error {
	return nil
}

// --- Tests ---

func TestCheckExpiredOrders_CancelsExpiredOrders(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	orderRepo := newMockOrderRepo()
	skuRepo := newMockSKURepo()
	inventoryLogRepo := newMockInventoryLogRepo()
	txManager := &mockTxManager{}
	notifications := newMockNotificationService()

	// Set up SKU with initial inventory
	skuRepo.skus[1] = &models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		Inventory:      5,
	}
	skuRepo.skus[2] = &models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: 2},
		Inventory:      10,
	}

	// Create expired orders directly in the checker's findExpiredOrders
	// Since we can't easily mock the DB query, we'll test cancelExpiredOrder directly
	pastDeadline := time.Now().Add(-2 * time.Hour)
	order := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		OrderNumber:    "ORD-20250101-001",
		Status:         models.OrderStatusPendingTransfer,
		PaymentMethod:  models.PaymentMethodTransfer,
		ConfirmationDeadline: &pastDeadline,
		GuestEmail:     "test@example.com",
		Items: []*models.OrderItem{
			{
				Base:     models.Base{ID: 1},
				OrderID:  1,
				SKUID:    1,
				Quantity: 2,
			},
			{
				Base:     models.Base{ID: 2},
				OrderID:  1,
				SKUID:    2,
				Quantity: 3,
			},
		},
	}

	checker := NewDeadlineChecker(
		nil, // db not used in cancelExpiredOrder directly
		orderRepo,
		skuRepo,
		inventoryLogRepo,
		txManager,
		notifications,
		log,
	)

	err := checker.cancelExpiredOrder(context.Background(), order)
	require.NoError(t, err)

	// Verify order was cancelled
	assert.Equal(t, models.OrderStatusCancelled, orderRepo.updatedStatuses[1])

	// Verify inventory was restored
	assert.Equal(t, 2, skuRepo.incrementedSKUs[1])
	assert.Equal(t, 3, skuRepo.incrementedSKUs[2])

	// Verify inventory log entries were created
	assert.Len(t, inventoryLogRepo.entries, 2)
	assert.Equal(t, uint(1), inventoryLogRepo.entries[0].SKUID)
	assert.Equal(t, 2, inventoryLogRepo.entries[0].Change)
	assert.Contains(t, inventoryLogRepo.entries[0].Reason, "auto-cancellation")
	assert.Equal(t, uint(2), inventoryLogRepo.entries[1].SKUID)
	assert.Equal(t, 3, inventoryLogRepo.entries[1].Change)

	// Verify cancellation email was sent
	assert.Len(t, notifications.cancellationsSent, 1)
	assert.Equal(t, "ORD-20250101-001", notifications.cancellationsSent[0])
}

func TestCheckExpiredOrders_SkipsZeroQuantityItems(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	orderRepo := newMockOrderRepo()
	skuRepo := newMockSKURepo()
	inventoryLogRepo := newMockInventoryLogRepo()
	txManager := &mockTxManager{}
	notifications := newMockNotificationService()

	skuRepo.skus[1] = &models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		Inventory:      5,
	}

	pastDeadline := time.Now().Add(-1 * time.Hour)
	order := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 2},
		OrderNumber:    "ORD-20250101-002",
		Status:         models.OrderStatusPendingTransfer,
		PaymentMethod:  models.PaymentMethodTransfer,
		ConfirmationDeadline: &pastDeadline,
		GuestEmail:     "test@example.com",
		Items: []*models.OrderItem{
			{
				Base:     models.Base{ID: 1},
				OrderID:  2,
				SKUID:    1,
				Quantity: 3,
			},
			nil, // nil item should be skipped
			{
				Base:     models.Base{ID: 3},
				OrderID:  2,
				SKUID:    1,
				Quantity: 0, // zero quantity should be skipped
			},
		},
	}

	checker := NewDeadlineChecker(
		nil,
		orderRepo,
		skuRepo,
		inventoryLogRepo,
		txManager,
		notifications,
		log,
	)

	err := checker.cancelExpiredOrder(context.Background(), order)
	require.NoError(t, err)

	// Only the valid item should have been processed
	assert.Equal(t, 3, skuRepo.incrementedSKUs[1])
	assert.Len(t, inventoryLogRepo.entries, 1)
	assert.Equal(t, models.OrderStatusCancelled, orderRepo.updatedStatuses[2])
}

func TestCheckExpiredOrders_SendsNotificationEvenWithoutInventoryLogRepo(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	orderRepo := newMockOrderRepo()
	skuRepo := newMockSKURepo()
	txManager := &mockTxManager{}
	notifications := newMockNotificationService()

	pastDeadline := time.Now().Add(-1 * time.Hour)
	order := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 3},
		OrderNumber:    "ORD-20250101-003",
		Status:         models.OrderStatusPendingTransfer,
		PaymentMethod:  models.PaymentMethodTransfer,
		ConfirmationDeadline: &pastDeadline,
		GuestEmail:     "test@example.com",
		Items: []*models.OrderItem{
			{
				Base:     models.Base{ID: 1},
				OrderID:  3,
				SKUID:    1,
				Quantity: 1,
			},
		},
	}

	// No inventory log repo - should still work
	checker := NewDeadlineChecker(
		nil,
		orderRepo,
		skuRepo,
		nil, // no inventory log repo
		txManager,
		notifications,
		log,
	)

	err := checker.cancelExpiredOrder(context.Background(), order)
	require.NoError(t, err)

	// Inventory should still be restored
	assert.Equal(t, 1, skuRepo.incrementedSKUs[1])

	// Order should be cancelled
	assert.Equal(t, models.OrderStatusCancelled, orderRepo.updatedStatuses[3])

	// Notification should be sent
	assert.Len(t, notifications.cancellationsSent, 1)
}

func TestDeadlineChecker_StartStop(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	orderRepo := newMockOrderRepo()
	skuRepo := newMockSKURepo()
	txManager := &mockTxManager{}
	notifications := newMockNotificationService()

	checker := NewDeadlineChecker(
		nil,
		orderRepo,
		skuRepo,
		nil,
		txManager,
		notifications,
		log,
	)

	// Use a very short interval for testing
	checker.SetInterval(50 * time.Millisecond)

	checker.Start()

	// Give it time to run at least once
	time.Sleep(100 * time.Millisecond)

	// Stop should not hang
	done := make(chan struct{})
	go func() {
		checker.Stop()
		close(done)
	}()

	select {
	case <-done:
		// Success - stopped cleanly
	case <-time.After(2 * time.Second):
		t.Fatal("DeadlineChecker.Stop() did not return within 2 seconds")
	}
}
