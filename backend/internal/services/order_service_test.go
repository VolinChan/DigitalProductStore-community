package services

import (
	"context"
	"encoding/json"
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
// Mocks
// ---------------------------------------------------------------------------

// MockOrderRepository implements repositories.OrderRepository for unit tests.
type MockOrderRepository struct {
	mock.Mock
}

func (m *MockOrderRepository) Create(ctx context.Context, order *models.Order) error {
	args := m.Called(ctx, order)
	return args.Error(0)
}

func (m *MockOrderRepository) CreateWithItems(ctx context.Context, order *models.Order) error {
	args := m.Called(ctx, order)
	if order.ID == 0 {
		order.ID = 1
	}
	if order.OrderNumber == "" {
		order.OrderNumber = "ORD-TEST-000001"
	}
	return args.Error(0)
}

func (m *MockOrderRepository) GetByID(ctx context.Context, id uint) (*models.Order, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Order), args.Error(1)
}

func (m *MockOrderRepository) GetByOrderNumber(ctx context.Context, orderNumber string) (*models.Order, error) {
	args := m.Called(ctx, orderNumber)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Order), args.Error(1)
}

func (m *MockOrderRepository) GetByOrderNumberAndEmail(ctx context.Context, orderNumber, email string) (*models.Order, error) {
	args := m.Called(ctx, orderNumber, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Order), args.Error(1)
}

func (m *MockOrderRepository) ListByUserID(ctx context.Context, userID uint, params *repositories.ListOrderParams) ([]*models.Order, int64, error) {
	args := m.Called(ctx, userID, params)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*models.Order), args.Get(1).(int64), args.Error(2)
}

func (m *MockOrderRepository) List(ctx context.Context, params *repositories.ListOrderParams) ([]*models.Order, int64, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*models.Order), args.Get(1).(int64), args.Error(2)
}

func (m *MockOrderRepository) Update(ctx context.Context, order *models.Order) error {
	args := m.Called(ctx, order)
	return args.Error(0)
}

func (m *MockOrderRepository) UpdateStatus(ctx context.Context, id uint, status models.OrderStatus) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockOrderRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockOrderRepository) CreateOrderItem(ctx context.Context, item *models.OrderItem) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockOrderRepository) GenerateOrderNumber(ctx context.Context) (string, error) {
	args := m.Called(ctx)
	return args.String(0), args.Error(1)
}

// passthroughTxManager runs the callback directly, exercising the code path
// where services are configured without a real transaction manager.
type passthroughTxManager struct{}

func (passthroughTxManager) RunInTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newOrderableSKU returns a SKU that is active, has stock, and carries a
// product + attributes for snapshot verification.
func newOrderableSKU(id uint, price float64, inventory int) *models.SKU {
	return &models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: id},
		ProductID:      1,
		SKUCode:        "SKU-TEST-" + decimal.NewFromInt(int64(id)).String(),
		Price:          decimal.NewFromFloat(price),
		Inventory:      inventory,
		IsActive:       true,
		Product:        &models.Product{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Name: "Test Product"},
		Attributes: []*models.SKUAttribute{
			{Base: models.Base{ID: 1}, SKUID: id, Name: "Color", Value: "Red"},
			{Base: models.Base{ID: 2}, SKUID: id, Name: "Size", Value: "L"},
		},
	}
}

// newOrderService builds an OrderService wired to freshly minted mocks and
// a passthrough transaction manager. The mocks are returned so tests can
// configure expectations. The inventory log repository is left nil; these
// tests exercise the stock-decrement / increment behaviour of OrderService
// directly. A dedicated test below (wired via newOrderServiceWithLog)
// verifies that when a log repo is configured an audit entry is recorded
// for every inventory change (Requirement 15.5).
func newOrderService(t *testing.T) (OrderService, *MockOrderRepository, *MockSKURepository, *MockCartRepository) {
	t.Helper()
	orderRepo := new(MockOrderRepository)
	skuRepo := new(MockSKURepository)
	cartRepo := new(MockCartRepository)
	svc := NewOrderService(orderRepo, skuRepo, cartRepo, nil, passthroughTxManager{}, nil)
	return svc, orderRepo, skuRepo, cartRepo
}

func baseGuestRequest(items []CreateOrderItemRequest) *CreateOrderRequest {
	return &CreateOrderRequest{
		Items:           items,
		GuestName:       "Jane Doe",
		GuestEmail:      "jane@example.com",
		GuestPhone:      "+15551234567",
		ShippingAddress: "123 Main St, Springfield",
		PaymentMethod:   models.PaymentMethodOnline,
	}
}

// ---------------------------------------------------------------------------
// CreateOrder - happy paths
// ---------------------------------------------------------------------------

// TestOrderService_CreateOrder_SnapshotsSKUAndComputesTotals verifies that
// CreateOrder snapshots SKU data onto each order item and computes subtotal,
// shipping fee, and total amount correctly (Requirements 7.1, 7.2, 7.4).
func TestOrderService_CreateOrder_SnapshotsSKUAndComputesTotals(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(10, 99.50, 5)
	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 10, Quantity: 2}})

	skuRepo.On("GetWithAttributes", ctx, uint(10)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(10), 2).Return(nil).Once()

	var capturedOrder *models.Order
	orderRepo.On("CreateWithItems", ctx, mock.MatchedBy(func(o *models.Order) bool {
		capturedOrder = o
		return o != nil
	})).Return(nil).Once()

	order, err := svc.CreateOrder(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, order)
	require.Same(t, capturedOrder, order, "order returned should be the one passed to repo")

	// Totals: subtotal = 99.50 * 2 = 199.00, shipping = 10, total = 209.00
	expectedSubtotal := decimal.NewFromFloat(199.00)
	expectedTotal := expectedSubtotal.Add(DefaultShippingFee)
	assert.True(t, order.Subtotal.Equal(expectedSubtotal), "subtotal %s", order.Subtotal)
	assert.True(t, order.ShippingFee.Equal(DefaultShippingFee), "shipping fee %s", order.ShippingFee)
	assert.True(t, order.TotalAmount.Equal(expectedTotal), "total %s", order.TotalAmount)
	assert.Equal(t, models.OrderStatusPendingPayment, order.Status)
	assert.Equal(t, models.PaymentMethodOnline, order.PaymentMethod)

	// Item snapshot
	require.Len(t, order.Items, 1)
	item := order.Items[0]
	assert.Equal(t, sku.ID, item.SKUID)
	assert.Equal(t, "Test Product", item.SKUName)
	assert.Equal(t, sku.SKUCode, item.SKUCode)
	assert.Equal(t, 2, item.Quantity)
	assert.True(t, item.UnitPrice.Equal(sku.Price))
	assert.True(t, item.Subtotal.Equal(expectedSubtotal))

	// Attributes snapshot should be a JSON object containing the SKU attrs.
	var decoded map[string]string
	require.NoError(t, json.Unmarshal([]byte(item.Attributes), &decoded))
	assert.Equal(t, "Red", decoded["Color"])
	assert.Equal(t, "L", decoded["Size"])

	// Guest info propagated
	assert.Equal(t, "Jane Doe", order.GuestName)
	assert.Equal(t, "jane@example.com", order.GuestEmail)
	assert.Equal(t, "+15551234567", order.GuestPhone)

	orderRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestOrderService_CreateOrder_DecrementsInventoryBeforeInsert verifies that
// inventory is decremented for each SKU and the order is then created, all
// within a single transaction (Requirement 7.3).
func TestOrderService_CreateOrder_DecrementsInventoryBeforeInsert(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku1 := newOrderableSKU(1, 10, 10)
	sku2 := newOrderableSKU(2, 25, 4)
	req := baseGuestRequest([]CreateOrderItemRequest{
		{SKUID: 1, Quantity: 3},
		{SKUID: 2, Quantity: 1},
	})

	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku1, nil).Once()
	skuRepo.On("GetWithAttributes", ctx, uint(2)).Return(sku2, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 3).Return(nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(2), 1).Return(nil).Once()
	orderRepo.On("CreateWithItems", ctx, mock.AnythingOfType("*models.Order")).Return(nil).Once()

	order, err := svc.CreateOrder(ctx, req)
	require.NoError(t, err)
	require.Len(t, order.Items, 2)

	// subtotal = 10*3 + 25*1 = 55
	assert.True(t, order.Subtotal.Equal(decimal.NewFromInt(55)))
	orderRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestOrderService_CreateOrder_FromCart verifies that an order can be
// created from a cart reference: items are sourced from the cart and the
// cart is cleared when requested.
func TestOrderService_CreateOrder_FromCart(t *testing.T) {
	svc, orderRepo, skuRepo, cartRepo := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(7, 15, 10)
	cart := &models.Cart{
		BaseWithUpdate: models.BaseWithUpdate{ID: 42},
		Items: []*models.CartItem{
			{Base: models.Base{ID: 1}, CartID: 42, SKUID: 7, Quantity: 4, UnitPrice: sku.Price},
		},
	}
	cartID := uint(42)
	userID := uint(99)
	req := &CreateOrderRequest{
		CartID:          &cartID,
		ClearCart:       true,
		UserID:          &userID,
		ShippingAddress: "1 Street",
		PaymentMethod:   models.PaymentMethodTransfer,
	}

	cartRepo.On("GetCartWithItems", ctx, cartID).Return(cart, nil).Once()
	skuRepo.On("GetWithAttributes", ctx, uint(7)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(7), 4).Return(nil).Once()
	orderRepo.On("CreateWithItems", ctx, mock.AnythingOfType("*models.Order")).Return(nil).Once()
	cartRepo.On("ClearItems", ctx, cartID).Return(nil).Once()

	order, err := svc.CreateOrder(ctx, req)
	require.NoError(t, err)
	assert.Equal(t, 1, len(order.Items))
	assert.Equal(t, models.PaymentMethodTransfer, order.PaymentMethod)
	assert.Equal(t, &userID, order.UserID)
	cartRepo.AssertExpectations(t)
}

// TestOrderService_CreateOrder_AssignsOrderNumber verifies that an order
// number is present on the returned order after CreateOrder completes. The
// repository layer is responsible for minting the number; this test
// asserts that the service propagates it to the caller unchanged
// (Requirement 7.5).
func TestOrderService_CreateOrder_AssignsOrderNumber(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(1, 20, 10)
	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 1).Return(nil).Once()

	// Simulate the repository assigning the unique order number during
	// the insert, as the real orderRepository does.
	const assignedNumber = "ORD20240115143020a1b2c3d4"
	orderRepo.On("CreateWithItems", ctx, mock.AnythingOfType("*models.Order")).
		Run(func(args mock.Arguments) {
			o := args.Get(1).(*models.Order)
			o.OrderNumber = assignedNumber
		}).
		Return(nil).Once()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 1}})
	order, err := svc.CreateOrder(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, order)
	assert.Equal(t, assignedNumber, order.OrderNumber,
		"service should return order with repository-assigned order number")
}

// TestOrderService_CreateOrder_RecordsCreationTimestamp verifies that the
// creation timestamp set by the repository is preserved on the returned
// order so downstream consumers (emails, UI, tracking) can render it
// (Requirement 7.8). The service itself does not touch CreatedAt; this
// test guards against a future regression that would drop or overwrite
// the value after the repository stamps it.
func TestOrderService_CreateOrder_RecordsCreationTimestamp(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(1, 50, 5)
	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 1).Return(nil).Once()

	stamped := time.Date(2024, 3, 4, 5, 6, 7, 0, time.UTC)
	orderRepo.On("CreateWithItems", ctx, mock.AnythingOfType("*models.Order")).
		Run(func(args mock.Arguments) {
			o := args.Get(1).(*models.Order)
			o.CreatedAt = stamped
		}).
		Return(nil).Once()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 1}})
	order, err := svc.CreateOrder(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, order)
	assert.True(t, stamped.Equal(order.CreatedAt),
		"expected CreatedAt %s, got %s", stamped, order.CreatedAt)
}

// ---------------------------------------------------------------------------
// CreateOrder - validation failures
// ---------------------------------------------------------------------------

// TestOrderService_CreateOrder_EmptyItemsRejected verifies that a request
// with no items and no cart produces ErrEmptyCart without touching
// inventory.
func TestOrderService_CreateOrder_EmptyItemsRejected(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	req := baseGuestRequest(nil)
	order, err := svc.CreateOrder(ctx, req)
	assert.Nil(t, order)
	assert.ErrorIs(t, err, ErrEmptyCart)
	skuRepo.AssertNotCalled(t, "DecrementInventory", mock.Anything, mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "CreateWithItems", mock.Anything, mock.Anything)
}

// TestOrderService_CreateOrder_InvalidPaymentMethodRejected verifies that
// only known payment methods are accepted.
func TestOrderService_CreateOrder_InvalidPaymentMethodRejected(t *testing.T) {
	svc, _, _, _ := newOrderService(t)
	ctx := context.Background()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 1}})
	req.PaymentMethod = "bitcoin"
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorIs(t, err, ErrInvalidPaymentMethod)
}

// TestOrderService_CreateOrder_GuestWithoutContactRejected verifies that
// guest orders (UserID nil) must provide name, email and phone.
func TestOrderService_CreateOrder_GuestWithoutContactRejected(t *testing.T) {
	svc, _, _, _ := newOrderService(t)
	ctx := context.Background()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 1}})
	req.GuestEmail = ""
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorIs(t, err, ErrInvalidShippingInfo)
}

// TestOrderService_CreateOrder_MissingAddressRejected verifies that every
// order requires a shipping address, for both users and guests.
func TestOrderService_CreateOrder_MissingAddressRejected(t *testing.T) {
	svc, _, _, _ := newOrderService(t)
	ctx := context.Background()

	userID := uint(1)
	req := &CreateOrderRequest{
		Items:         []CreateOrderItemRequest{{SKUID: 1, Quantity: 1}},
		UserID:        &userID,
		PaymentMethod: models.PaymentMethodOnline,
	}
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorIs(t, err, ErrInvalidShippingInfo)
}

// TestOrderService_CreateOrder_InactiveSKURejected verifies that an
// inactive SKU cannot be ordered.
func TestOrderService_CreateOrder_InactiveSKURejected(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(1, 10, 10)
	sku.IsActive = false
	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku, nil).Once()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 1}})
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorIs(t, err, ErrSKUUnavailable)
	orderRepo.AssertNotCalled(t, "CreateWithItems", mock.Anything, mock.Anything)
	skuRepo.AssertNotCalled(t, "DecrementInventory", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_CreateOrder_InsufficientInventoryUpfrontRejected verifies
// that if the pre-check sees insufficient stock the order is aborted before
// any mutation.
func TestOrderService_CreateOrder_InsufficientInventoryUpfrontRejected(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(1, 10, 1)
	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku, nil).Once()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 5}})
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorIs(t, err, ErrSKUUnavailable)
	orderRepo.AssertNotCalled(t, "CreateWithItems", mock.Anything, mock.Anything)
	skuRepo.AssertNotCalled(t, "DecrementInventory", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_CreateOrder_InventoryRaceSurfacesError verifies that if
// the atomic inventory decrement fails due to a race (ErrInsufficientInventory)
// the service surfaces ErrSKUUnavailable and the order is never inserted.
func TestOrderService_CreateOrder_InventoryRaceSurfacesError(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(1, 10, 5)
	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 2).
		Return(repositories.ErrInsufficientInventory).Once()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 2}})
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorIs(t, err, ErrSKUUnavailable)
	orderRepo.AssertNotCalled(t, "CreateWithItems", mock.Anything, mock.Anything)
}

// TestOrderService_CreateOrder_CartEmptyRejected verifies that sourcing an
// order from an empty cart is rejected with ErrEmptyCart.
func TestOrderService_CreateOrder_CartEmptyRejected(t *testing.T) {
	svc, _, _, cartRepo := newOrderService(t)
	ctx := context.Background()

	cartID := uint(5)
	cartRepo.On("GetCartWithItems", ctx, cartID).
		Return(&models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: cartID}}, nil).Once()

	userID := uint(1)
	req := &CreateOrderRequest{
		CartID:          &cartID,
		UserID:          &userID,
		ShippingAddress: "addr",
		PaymentMethod:   models.PaymentMethodOnline,
	}
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorIs(t, err, ErrEmptyCart)
}

// TestOrderService_CreateOrder_OrderPersistFailureBubblesUp verifies that a
// failure inserting the order (after inventory decrement has been issued)
// returns the underlying error so the transaction manager can roll back.
func TestOrderService_CreateOrder_OrderPersistFailureBubblesUp(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	sku := newOrderableSKU(1, 10, 10)
	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 1).Return(nil).Once()
	boom := errors.New("db exploded")
	orderRepo.On("CreateWithItems", ctx, mock.AnythingOfType("*models.Order")).Return(boom).Once()

	req := baseGuestRequest([]CreateOrderItemRequest{{SKUID: 1, Quantity: 1}})
	_, err := svc.CreateOrder(ctx, req)
	assert.ErrorContains(t, err, "db exploded")
}

// ---------------------------------------------------------------------------
// Property-based test
// ---------------------------------------------------------------------------

// TestOrderService_Property_TotalAmountEqualsSubtotalPlusShipping is a
// lightweight property test: for a randomly generated basket, the resulting
// order's TotalAmount must equal the sum of item subtotals plus the flat
// shipping fee, and each item's Subtotal must equal UnitPrice * Quantity.
//
// Validates: Requirements 7.2, 7.4
func TestOrderService_Property_TotalAmountEqualsSubtotalPlusShipping(t *testing.T) {
	const iterations = 30

	cases := []struct {
		prices     []float64
		quantities []int
	}{
		{[]float64{1.00}, []int{1}},
		{[]float64{0.01, 0.02}, []int{1, 1}},
		{[]float64{9999.99}, []int{3}},
		{[]float64{19.95, 5.00, 100.00}, []int{2, 4, 1}},
	}

	for i := 0; i < iterations; i++ {
		// Cycle through deterministic cases so failures are easy to reproduce.
		tc := cases[i%len(cases)]

		svc, orderRepo, skuRepo, _ := newOrderService(t)
		ctx := context.Background()

		items := make([]CreateOrderItemRequest, len(tc.prices))
		expectedSubtotal := decimal.Zero
		for j, price := range tc.prices {
			skuID := uint(j + 1)
			qty := tc.quantities[j]
			sku := newOrderableSKU(skuID, price, qty*10)
			skuRepo.On("GetWithAttributes", ctx, skuID).Return(sku, nil).Once()
			skuRepo.On("DecrementInventory", ctx, skuID, qty).Return(nil).Once()
			items[j] = CreateOrderItemRequest{SKUID: skuID, Quantity: qty}
			expectedSubtotal = expectedSubtotal.Add(
				decimal.NewFromFloat(price).Mul(decimal.NewFromInt(int64(qty))),
			)
		}
		orderRepo.On("CreateWithItems", ctx, mock.AnythingOfType("*models.Order")).
			Return(nil).Once()

		req := baseGuestRequest(items)
		order, err := svc.CreateOrder(ctx, req)
		require.NoError(t, err, "iteration %d", i)
		require.NotNil(t, order)

		// Property: per-item subtotal = unit_price * quantity
		sum := decimal.Zero
		for _, item := range order.Items {
			expected := item.UnitPrice.Mul(decimal.NewFromInt(int64(item.Quantity)))
			assert.Truef(t, item.Subtotal.Equal(expected),
				"iter %d sku %d: subtotal %s != %s", i, item.SKUID, item.Subtotal, expected)
			sum = sum.Add(item.Subtotal)
		}

		// Property: order subtotal = sum of item subtotals
		assert.Truef(t, order.Subtotal.Equal(sum),
			"iter %d: order.Subtotal %s != sum %s", i, order.Subtotal, sum)
		assert.Truef(t, order.Subtotal.Equal(expectedSubtotal),
			"iter %d: order.Subtotal %s != expected %s", i, order.Subtotal, expectedSubtotal)

		// Property: total_amount = subtotal + shipping_fee
		expectedTotal := order.Subtotal.Add(order.ShippingFee)
		assert.Truef(t, order.TotalAmount.Equal(expectedTotal),
			"iter %d: total %s != subtotal+shipping %s", i, order.TotalAmount, expectedTotal)
	}
}

// ---------------------------------------------------------------------------
// Query methods (task 10.3)
// ---------------------------------------------------------------------------

// TestOrderService_GetOrder_Success verifies GetOrder delegates to the
// repository and returns the order unchanged (Requirement 7.7).
func TestOrderService_GetOrder_Success(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	expected := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 5},
		OrderNumber:    "ORD-123",
		Status:         models.OrderStatusPaid,
	}
	orderRepo.On("GetByID", ctx, uint(5)).Return(expected, nil).Once()

	got, err := svc.GetOrder(ctx, 5)
	require.NoError(t, err)
	assert.Same(t, expected, got)
	orderRepo.AssertExpectations(t)
}

// TestOrderService_GetOrder_ZeroIDRejected verifies that a zero id is
// rejected without touching the repository.
func TestOrderService_GetOrder_ZeroIDRejected(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	_, err := svc.GetOrder(ctx, 0)
	assert.Error(t, err)
	orderRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
}

// TestOrderService_GetOrderByNumber_Success verifies that a non-empty order
// number is looked up by the repository.
func TestOrderService_GetOrderByNumber_Success(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	expected := &models.Order{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, OrderNumber: "ORD-ABC"}
	orderRepo.On("GetByOrderNumber", ctx, "ORD-ABC").Return(expected, nil).Once()

	got, err := svc.GetOrderByNumber(ctx, "  ORD-ABC  ")
	require.NoError(t, err)
	assert.Same(t, expected, got)
	orderRepo.AssertExpectations(t)
}

// TestOrderService_GetOrderByNumber_EmptyRejected verifies that blank order
// numbers are rejected without calling the repository.
func TestOrderService_GetOrderByNumber_EmptyRejected(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	_, err := svc.GetOrderByNumber(ctx, "   ")
	assert.Error(t, err)
	orderRepo.AssertNotCalled(t, "GetByOrderNumber", mock.Anything, mock.Anything)
}

// TestOrderService_TrackOrder_RequiresBothFields verifies that both
// order_number and email must be present (Requirement 7.7).
func TestOrderService_TrackOrder_RequiresBothFields(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	_, err := svc.TrackOrder(ctx, "", "x@example.com")
	assert.Error(t, err)
	_, err = svc.TrackOrder(ctx, "ORD", "")
	assert.Error(t, err)
	orderRepo.AssertNotCalled(t, "GetByOrderNumberAndEmail", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_TrackOrder_DelegatesToRepo verifies that TrackOrder
// passes the trimmed order number and email to the repository. This covers
// the guest tracking path (Requirement 7.7).
func TestOrderService_TrackOrder_DelegatesToRepo(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	expected := &models.Order{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, OrderNumber: "ORD-G"}
	orderRepo.On("GetByOrderNumberAndEmail", ctx, "ORD-G", "guest@example.com").
		Return(expected, nil).Once()

	got, err := svc.TrackOrder(ctx, " ORD-G ", " guest@example.com ")
	require.NoError(t, err)
	assert.Same(t, expected, got)
	orderRepo.AssertExpectations(t)
}

// TestOrderService_ListOrders_DefaultsPagination verifies that missing
// page/page_size fall back to sane defaults and the call is forwarded to
// the user-scoped list method (Requirement 7.6).
func TestOrderService_ListOrders_DefaultsPagination(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orders := []*models.Order{
		{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Status: models.OrderStatusPaid},
		{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, Status: models.OrderStatusCompleted},
	}
	orderRepo.On("ListByUserID", ctx, uint(7), mock.MatchedBy(func(p *repositories.ListOrderParams) bool {
		return p.Limit == 20 && p.Offset == 0 && p.Status == nil &&
			p.SortBy == "created_at" && p.SortOrder == "desc"
	})).Return(orders, int64(2), nil).Once()

	resp, err := svc.ListOrders(ctx, 7, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(2), resp.Total)
	assert.Equal(t, 1, resp.Page)
	assert.Equal(t, 20, resp.PageSize)
	assert.Len(t, resp.Orders, 2)
}

// TestOrderService_ListOrders_PaginationAndFilter verifies that pagination
// math (page -> offset) and the status filter are forwarded correctly.
func TestOrderService_ListOrders_PaginationAndFilter(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("ListByUserID", ctx, uint(3), mock.MatchedBy(func(p *repositories.ListOrderParams) bool {
		if p.Limit != 5 || p.Offset != 10 {
			return false
		}
		if p.Status == nil || *p.Status != models.OrderStatusPaid {
			return false
		}
		return p.SortBy == "total_amount" && p.SortOrder == "asc"
	})).Return([]*models.Order{}, int64(0), nil).Once()

	_, err := svc.ListOrders(ctx, 3, &ListOrdersRequest{
		Page:      3,
		PageSize:  5,
		Status:    string(models.OrderStatusPaid),
		SortBy:    "total_amount",
		SortOrder: "asc",
	})
	require.NoError(t, err)
	orderRepo.AssertExpectations(t)
}

// TestOrderService_ListOrders_InvalidStatusRejected verifies that an
// unknown status string is rejected up-front so callers get a clean error.
func TestOrderService_ListOrders_InvalidStatusRejected(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	_, err := svc.ListOrders(ctx, 1, &ListOrdersRequest{Status: "bogus"})
	assert.ErrorIs(t, err, ErrInvalidOrderStatus)
	orderRepo.AssertNotCalled(t, "ListByUserID", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_ListOrders_CapsPageSize verifies that page sizes above
// the allowed maximum are clamped.
func TestOrderService_ListOrders_CapsPageSize(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("ListByUserID", ctx, uint(1), mock.MatchedBy(func(p *repositories.ListOrderParams) bool {
		return p.Limit == 100
	})).Return([]*models.Order{}, int64(0), nil).Once()

	resp, err := svc.ListOrders(ctx, 1, &ListOrdersRequest{Page: 1, PageSize: 500})
	require.NoError(t, err)
	assert.Equal(t, 100, resp.PageSize)
}

// ---------------------------------------------------------------------------
// UpdateOrderStatus (task 10.3)
// ---------------------------------------------------------------------------

// TestOrderService_UpdateOrderStatus_ValidTransition verifies that a legal
// transition (pending_shipment -> shipped) is persisted.
func TestOrderService_UpdateOrderStatus_ValidTransition(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("GetByID", ctx, uint(1)).Return(&models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		Status:         models.OrderStatusPendingShipment,
	}, nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(1), models.OrderStatusShipped).Return(nil).Once()

	err := svc.UpdateOrderStatus(ctx, 1, models.OrderStatusShipped)
	require.NoError(t, err)
	orderRepo.AssertExpectations(t)
}

// TestOrderService_UpdateOrderStatus_NoOp verifies that setting the current
// status is a silent success and does not hit UpdateStatus.
func TestOrderService_UpdateOrderStatus_NoOp(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("GetByID", ctx, uint(2)).Return(&models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 2},
		Status:         models.OrderStatusPaid,
	}, nil).Once()

	err := svc.UpdateOrderStatus(ctx, 2, models.OrderStatusPaid)
	require.NoError(t, err)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_UpdateOrderStatus_IllegalTransition verifies that a
// move from a terminal status (completed) is rejected.
func TestOrderService_UpdateOrderStatus_IllegalTransition(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("GetByID", ctx, uint(9)).Return(&models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 9},
		Status:         models.OrderStatusCompleted,
	}, nil).Once()

	err := svc.UpdateOrderStatus(ctx, 9, models.OrderStatusShipped)
	assert.ErrorIs(t, err, ErrInvalidStatusTransition)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_UpdateOrderStatus_ShippedToCompleted verifies that the
// final "shipped -> completed" transition is allowed (Requirement 7.6).
func TestOrderService_UpdateOrderStatus_ShippedToCompleted(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("GetByID", ctx, uint(4)).Return(&models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 4},
		Status:         models.OrderStatusShipped,
	}, nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(4), models.OrderStatusCompleted).Return(nil).Once()

	require.NoError(t, svc.UpdateOrderStatus(ctx, 4, models.OrderStatusCompleted))
}

// TestOrderService_UpdateOrderStatus_UnknownStatus verifies that an unknown
// status string is rejected before any repo call.
func TestOrderService_UpdateOrderStatus_UnknownStatus(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	err := svc.UpdateOrderStatus(ctx, 1, models.OrderStatus("bogus"))
	assert.ErrorIs(t, err, ErrInvalidOrderStatus)
	orderRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
}

// ---------------------------------------------------------------------------
// CancelOrder (task 10.3, Requirement 24)
// ---------------------------------------------------------------------------

// TestOrderService_CancelOrder_RestoresInventoryAndUpdatesStatus verifies
// that cancellation of a pending_payment order restores inventory for all
// items and updates the status to cancelled (Requirements 24.1 & 24.3).
func TestOrderService_CancelOrder_RestoresInventoryAndUpdatesStatus(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	order := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		Status:         models.OrderStatusPendingPayment,
		Items: []*models.OrderItem{
			{Base: models.Base{ID: 1}, OrderID: 1, SKUID: 10, Quantity: 2},
			{Base: models.Base{ID: 2}, OrderID: 1, SKUID: 20, Quantity: 3},
		},
	}
	orderRepo.On("GetByID", ctx, uint(1)).Return(order, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(10), 2).Return(nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(20), 3).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(1), models.OrderStatusCancelled).Return(nil).Once()

	err := svc.CancelOrder(ctx, 1, "customer changed mind")
	require.NoError(t, err)
	orderRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestOrderService_CancelOrder_PendingTransferAllowed verifies that the
// cancellation flow also applies to pending_transfer (Requirement 24.2).
func TestOrderService_CancelOrder_PendingTransferAllowed(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	order := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 2},
		Status:         models.OrderStatusPendingTransfer,
		Items:          []*models.OrderItem{{Base: models.Base{ID: 1}, OrderID: 2, SKUID: 5, Quantity: 1}},
	}
	orderRepo.On("GetByID", ctx, uint(2)).Return(order, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(5), 1).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(2), models.OrderStatusCancelled).Return(nil).Once()

	require.NoError(t, svc.CancelOrder(ctx, 2, ""))
}

// TestOrderService_CancelOrder_ShippedRejected verifies that shipped
// orders cannot be cancelled by the customer (Requirement 24.4) and that
// neither inventory nor status is touched.
func TestOrderService_CancelOrder_ShippedRejected(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("GetByID", ctx, uint(9)).Return(&models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 9},
		Status:         models.OrderStatusShipped,
	}, nil).Once()

	err := svc.CancelOrder(ctx, 9, "")
	assert.ErrorIs(t, err, ErrOrderNotCancellable)
	skuRepo.AssertNotCalled(t, "IncrementInventory", mock.Anything, mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_CancelOrder_CompletedRejected verifies that completed
// orders cannot be cancelled (Requirement 24.4).
func TestOrderService_CancelOrder_CompletedRejected(t *testing.T) {
	svc, orderRepo, _, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("GetByID", ctx, uint(11)).Return(&models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 11},
		Status:         models.OrderStatusCompleted,
	}, nil).Once()

	err := svc.CancelOrder(ctx, 11, "")
	assert.ErrorIs(t, err, ErrOrderNotCancellable)
}

// TestOrderService_CancelOrder_AlreadyCancelledIsNoOp verifies that a
// second cancellation is a silent success (idempotency).
func TestOrderService_CancelOrder_AlreadyCancelledIsNoOp(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	orderRepo.On("GetByID", ctx, uint(12)).Return(&models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 12},
		Status:         models.OrderStatusCancelled,
	}, nil).Once()

	require.NoError(t, svc.CancelOrder(ctx, 12, ""))
	skuRepo.AssertNotCalled(t, "IncrementInventory", mock.Anything, mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestOrderService_CancelOrder_InventoryFailureBubblesUp verifies that a
// failure restoring inventory aborts the cancellation without persisting
// the status change. With the passthrough transaction manager, nothing is
// actually rolled back, but the caller sees the underlying error and the
// UpdateStatus call is never reached.
func TestOrderService_CancelOrder_InventoryFailureBubblesUp(t *testing.T) {
	svc, orderRepo, skuRepo, _ := newOrderService(t)
	ctx := context.Background()

	order := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 3},
		Status:         models.OrderStatusPendingPayment,
		Items:          []*models.OrderItem{{Base: models.Base{ID: 1}, OrderID: 3, SKUID: 77, Quantity: 1}},
	}
	orderRepo.On("GetByID", ctx, uint(3)).Return(order, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(77), 1).
		Return(errors.New("sku not found")).Once()

	err := svc.CancelOrder(ctx, 3, "")
	assert.ErrorContains(t, err, "sku not found")
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// ---------------------------------------------------------------------------
// Inventory audit logging (task 12.3, Requirement 15.5)
// ---------------------------------------------------------------------------

// MockInventoryLogRepository implements repositories.InventoryLogRepository
// so the order service tests can assert that inventory audit entries are
// written for every order-driven stock change.
type MockInventoryLogRepository struct {
	mock.Mock
}

func (m *MockInventoryLogRepository) Create(ctx context.Context, log *models.InventoryLog) error {
	args := m.Called(ctx, log)
	return args.Error(0)
}

func (m *MockInventoryLogRepository) GetBySKUID(
	ctx context.Context,
	skuID uint,
	params *repositories.ListInventoryLogParams,
) ([]*models.InventoryLog, int64, error) {
	args := m.Called(ctx, skuID, params)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*models.InventoryLog), args.Get(1).(int64), args.Error(2)
}

func (m *MockInventoryLogRepository) GetByOrderID(
	ctx context.Context,
	orderID uint,
) ([]*models.InventoryLog, error) {
	args := m.Called(ctx, orderID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.InventoryLog), args.Error(1)
}

// newOrderServiceWithLog builds an OrderService with a MockInventoryLogRepository
// attached so the caller can assert the audit behaviour introduced for
// Requirement 15.5.
func newOrderServiceWithLog(t *testing.T) (
	OrderService,
	*MockOrderRepository,
	*MockSKURepository,
	*MockCartRepository,
	*MockInventoryLogRepository,
) {
	t.Helper()
	orderRepo := new(MockOrderRepository)
	skuRepo := new(MockSKURepository)
	cartRepo := new(MockCartRepository)
	logRepo := new(MockInventoryLogRepository)
	svc := NewOrderService(orderRepo, skuRepo, cartRepo, logRepo, passthroughTxManager{}, nil)
	return svc, orderRepo, skuRepo, cartRepo, logRepo
}

// TestOrderService_CreateOrder_RecordsInventoryLog verifies that when an
// inventory log repository is wired, CreateOrder records an audit entry
// for every ordered SKU with accurate previous / new quantities, the
// correct negative change, and the reserving order id (Requirement 15.5).
func TestOrderService_CreateOrder_RecordsInventoryLog(t *testing.T) {
	svc, orderRepo, skuRepo, _, logRepo := newOrderServiceWithLog(t)
	ctx := context.Background()

	sku1 := newOrderableSKU(1, 10, 10) // pre-order inventory 10
	sku2 := newOrderableSKU(2, 25, 4)  // pre-order inventory 4
	req := baseGuestRequest([]CreateOrderItemRequest{
		{SKUID: 1, Quantity: 3},
		{SKUID: 2, Quantity: 1},
	})

	skuRepo.On("GetWithAttributes", ctx, uint(1)).Return(sku1, nil).Once()
	skuRepo.On("GetWithAttributes", ctx, uint(2)).Return(sku2, nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(1), 3).Return(nil).Once()
	skuRepo.On("DecrementInventory", ctx, uint(2), 1).Return(nil).Once()
	orderRepo.On("CreateWithItems", ctx, mock.AnythingOfType("*models.Order")).
		Return(nil).Once()

	// Capture the log entries for assertion after the call.
	var logs []*models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		logs = append(logs, l)
		return true
	})).Return(nil).Times(2)

	order, err := svc.CreateOrder(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, order)
	require.Len(t, logs, 2)

	// SKU 1: pre-order 10, minus 3 = 7
	assert.Equal(t, uint(1), logs[0].SKUID)
	assert.Equal(t, 10, logs[0].PreviousQty)
	assert.Equal(t, 7, logs[0].NewQty)
	assert.Equal(t, -3, logs[0].Change)
	assert.Equal(t, "order reservation", logs[0].Reason)
	require.NotNil(t, logs[0].OrderID)
	assert.Equal(t, order.ID, *logs[0].OrderID)

	// SKU 2: pre-order 4, minus 1 = 3
	assert.Equal(t, uint(2), logs[1].SKUID)
	assert.Equal(t, 4, logs[1].PreviousQty)
	assert.Equal(t, 3, logs[1].NewQty)
	assert.Equal(t, -1, logs[1].Change)
	require.NotNil(t, logs[1].OrderID)
	assert.Equal(t, order.ID, *logs[1].OrderID)

	logRepo.AssertExpectations(t)
}

// TestOrderService_CancelOrder_RecordsInventoryLog verifies that when an
// inventory log repository is wired, CancelOrder records an audit entry
// for every restored SKU with accurate previous / new quantities, the
// correct positive change, and the cancelled order id (Requirement 15.5).
func TestOrderService_CancelOrder_RecordsInventoryLog(t *testing.T) {
	svc, orderRepo, skuRepo, _, logRepo := newOrderServiceWithLog(t)
	ctx := context.Background()

	order := &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{ID: 42},
		Status:         models.OrderStatusPendingPayment,
		Items: []*models.OrderItem{
			{Base: models.Base{ID: 1}, OrderID: 42, SKUID: 10, Quantity: 2},
			{Base: models.Base{ID: 2}, OrderID: 42, SKUID: 20, Quantity: 3},
		},
	}

	orderRepo.On("GetByID", ctx, uint(42)).Return(order, nil).Once()

	// The service reads the SKU before restoring stock so the log entry
	// can record the pre-restore inventory snapshot.
	skuRepo.On("GetByID", ctx, uint(10)).Return(&models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: 10}, Inventory: 5,
	}, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(10), 2).Return(nil).Once()
	skuRepo.On("GetByID", ctx, uint(20)).Return(&models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: 20}, Inventory: 0,
	}, nil).Once()
	skuRepo.On("IncrementInventory", ctx, uint(20), 3).Return(nil).Once()

	var logs []*models.InventoryLog
	logRepo.On("Create", ctx, mock.MatchedBy(func(l *models.InventoryLog) bool {
		logs = append(logs, l)
		return true
	})).Return(nil).Times(2)

	orderRepo.On("UpdateStatus", ctx, uint(42), models.OrderStatusCancelled).
		Return(nil).Once()

	require.NoError(t, svc.CancelOrder(ctx, 42, "customer changed mind"))
	require.Len(t, logs, 2)

	// SKU 10: pre-restore 5, plus 2 = 7
	assert.Equal(t, uint(10), logs[0].SKUID)
	assert.Equal(t, 5, logs[0].PreviousQty)
	assert.Equal(t, 7, logs[0].NewQty)
	assert.Equal(t, 2, logs[0].Change)
	assert.Equal(t, "order cancellation", logs[0].Reason)
	require.NotNil(t, logs[0].OrderID)
	assert.Equal(t, order.ID, *logs[0].OrderID)

	// SKU 20: pre-restore 0, plus 3 = 3
	assert.Equal(t, uint(20), logs[1].SKUID)
	assert.Equal(t, 0, logs[1].PreviousQty)
	assert.Equal(t, 3, logs[1].NewQty)
	assert.Equal(t, 3, logs[1].Change)

	logRepo.AssertExpectations(t)
}
