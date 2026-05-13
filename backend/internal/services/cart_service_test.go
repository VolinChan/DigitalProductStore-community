package services

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/digital-store/backend/internal/models"
)

// MockCartRepository is a mock implementation of repositories.CartRepository.
type MockCartRepository struct {
	mock.Mock
}

func (m *MockCartRepository) Create(ctx context.Context, cart *models.Cart) error {
	args := m.Called(ctx, cart)
	// Simulate DB assigning an ID if not already set.
	if cart.ID == 0 {
		cart.ID = 1
	}
	return args.Error(0)
}

func (m *MockCartRepository) GetByID(ctx context.Context, id uint) (*models.Cart, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Cart), args.Error(1)
}

func (m *MockCartRepository) GetByUserID(ctx context.Context, userID uint) (*models.Cart, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Cart), args.Error(1)
}

func (m *MockCartRepository) GetBySessionID(ctx context.Context, sessionID string) (*models.Cart, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Cart), args.Error(1)
}

func (m *MockCartRepository) Update(ctx context.Context, cart *models.Cart) error {
	args := m.Called(ctx, cart)
	return args.Error(0)
}

func (m *MockCartRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCartRepository) AddItem(ctx context.Context, item *models.CartItem) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockCartRepository) GetItem(ctx context.Context, cartID uint, skuID uint) (*models.CartItem, error) {
	args := m.Called(ctx, cartID, skuID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.CartItem), args.Error(1)
}

func (m *MockCartRepository) UpdateItem(ctx context.Context, item *models.CartItem) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockCartRepository) DeleteItem(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCartRepository) DeleteItemBySKU(ctx context.Context, cartID uint, skuID uint) error {
	args := m.Called(ctx, cartID, skuID)
	return args.Error(0)
}

func (m *MockCartRepository) ClearItems(ctx context.Context, cartID uint) error {
	args := m.Called(ctx, cartID)
	return args.Error(0)
}

func (m *MockCartRepository) GetCartWithItems(ctx context.Context, cartID uint) (*models.Cart, error) {
	args := m.Called(ctx, cartID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Cart), args.Error(1)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newActiveSKU builds an active SKU suitable for cart tests.
func newActiveSKU(id uint, price float64, inventory int) *models.SKU {
	return &models.SKU{
		BaseWithUpdate: models.BaseWithUpdate{ID: id},
		ProductID:      1,
		SKUCode:        fmt.Sprintf("SKU-%03d", id),
		Price:          decimal.NewFromFloat(price),
		Inventory:      inventory,
		IsActive:       true,
	}
}

// ---------------------------------------------------------------------------
// AddToCart
// ---------------------------------------------------------------------------

// TestCartService_AddToCart_NewItemForNewUserCart verifies a first-time add
// creates a cart and a cart item with the SKU's current price (Requirement 6.1).
func TestCartService_AddToCart_NewItemForNewUserCart(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	userID := uint(42)
	sku := newActiveSKU(10, 99.99, 50)
	req := &AddToCartRequest{SKUID: sku.ID, Quantity: 2}

	// No existing cart yet; service will create one.
	cartRepo.On("GetByUserID", ctx, userID).Return(nil, fmt.Errorf("cart not found")).Once()
	cartRepo.On("Create", ctx, mock.MatchedBy(func(c *models.Cart) bool {
		return c.UserID != nil && *c.UserID == userID
	})).Return(nil).Once()

	// SKU lookup + availability check
	skuRepo.On("GetWithAttributes", ctx, sku.ID).Return(sku, nil).Once()
	skuRepo.On("CheckAvailability", ctx, sku.ID, req.Quantity).Return(true, nil).Once()

	// No existing item in cart.
	cartRepo.On("GetItem", ctx, mock.AnythingOfType("uint"), sku.ID).
		Return(nil, fmt.Errorf("cart item not found")).Once()
	cartRepo.On("AddItem", ctx, mock.MatchedBy(func(item *models.CartItem) bool {
		return item.SKUID == sku.ID && item.Quantity == 2 && item.UnitPrice.Equal(sku.Price)
	})).Return(nil).Once()

	err := svc.AddToCart(ctx, "", &userID, req)

	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestCartService_AddToCart_ExistingItemAccumulatesQuantity verifies that
// adding an item that is already in the cart increments its quantity
// (Requirement 6.1/6.2).
func TestCartService_AddToCart_ExistingItemAccumulatesQuantity(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "guest-session-123"
	sku := newActiveSKU(10, 50.00, 100)

	existingCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 7}, SessionID: sessionID}
	existingItem := &models.CartItem{
		Base:      models.Base{ID: 1},
		CartID:    7,
		SKUID:     sku.ID,
		Quantity:  3,
		UnitPrice: sku.Price,
	}

	req := &AddToCartRequest{SKUID: sku.ID, Quantity: 4}

	cartRepo.On("GetBySessionID", ctx, sessionID).Return(existingCart, nil).Once()
	skuRepo.On("GetWithAttributes", ctx, sku.ID).Return(sku, nil).Once()
	// First availability check: just the requested quantity (4).
	skuRepo.On("CheckAvailability", ctx, sku.ID, 4).Return(true, nil).Once()
	cartRepo.On("GetItem", ctx, uint(7), sku.ID).Return(existingItem, nil).Once()
	// Second availability check: combined quantity (3 + 4 = 7).
	skuRepo.On("CheckAvailability", ctx, sku.ID, 7).Return(true, nil).Once()
	cartRepo.On("UpdateItem", ctx, mock.MatchedBy(func(item *models.CartItem) bool {
		return item.Quantity == 7 && item.UnitPrice.Equal(sku.Price)
	})).Return(nil).Once()

	err := svc.AddToCart(ctx, sessionID, nil, req)

	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestCartService_AddToCart_InsufficientInventory verifies Requirement 6.6 —
// the service rejects adds that exceed SKU inventory.
func TestCartService_AddToCart_InsufficientInventory(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "guest-session"
	sku := newActiveSKU(10, 20.00, 5)

	existingCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 3}, SessionID: sessionID}
	req := &AddToCartRequest{SKUID: sku.ID, Quantity: 10}

	cartRepo.On("GetBySessionID", ctx, sessionID).Return(existingCart, nil).Once()
	skuRepo.On("GetWithAttributes", ctx, sku.ID).Return(sku, nil).Once()
	skuRepo.On("CheckAvailability", ctx, sku.ID, 10).Return(false, nil).Once()

	err := svc.AddToCart(ctx, sessionID, nil, req)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insufficient inventory")
	cartRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestCartService_AddToCart_InactiveSKU verifies a SKU that is no longer
// active cannot be added.
func TestCartService_AddToCart_InactiveSKU(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	userID := uint(1)
	sku := newActiveSKU(10, 20.00, 5)
	sku.IsActive = false

	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, UserID: &userID}
	cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()
	skuRepo.On("GetWithAttributes", ctx, sku.ID).Return(sku, nil).Once()

	err := svc.AddToCart(ctx, "", &userID, &AddToCartRequest{SKUID: sku.ID, Quantity: 1})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not available")
}

// ---------------------------------------------------------------------------
// UpdateCartItem
// ---------------------------------------------------------------------------

// TestCartService_UpdateCartItem_ValidQuantity verifies that an in-range
// quantity update refreshes the item quantity and unit price (Requirements 6.2, 6.7).
func TestCartService_UpdateCartItem_ValidQuantity(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	userID := uint(9)
	sku := newActiveSKU(20, 30.00, 100)
	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 5}, UserID: &userID}
	item := &models.CartItem{
		Base:      models.Base{ID: 11},
		CartID:    5,
		SKUID:     sku.ID,
		Quantity:  1,
		UnitPrice: decimal.NewFromFloat(25.00), // old price
	}

	cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()
	cartRepo.On("GetItem", ctx, cart.ID, sku.ID).Return(item, nil).Once()
	skuRepo.On("CheckAvailability", ctx, sku.ID, 6).Return(true, nil).Once()
	skuRepo.On("GetByID", ctx, sku.ID).Return(sku, nil).Once()
	cartRepo.On("UpdateItem", ctx, mock.MatchedBy(func(it *models.CartItem) bool {
		return it.Quantity == 6 && it.UnitPrice.Equal(sku.Price)
	})).Return(nil).Once()

	err := svc.UpdateCartItem(ctx, "", &userID, sku.ID, 6)
	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestCartService_UpdateCartItem_ZeroOrNegativeRejected verifies that
// non-positive quantities are rejected up front.
func TestCartService_UpdateCartItem_ZeroOrNegativeRejected(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	for _, qty := range []int{0, -1, -100} {
		err := svc.UpdateCartItem(context.Background(), "sid", nil, 1, qty)
		assert.Error(t, err, "quantity %d must be rejected", qty)
		assert.Contains(t, err.Error(), "greater than 0")
	}

	// No repository calls should happen for rejected inputs.
	cartRepo.AssertNotCalled(t, "GetBySessionID", mock.Anything, mock.Anything)
}

// TestCartService_UpdateCartItem_ExceedsInventory verifies Requirement 6.6 —
// updates that exceed SKU inventory are rejected.
func TestCartService_UpdateCartItem_ExceedsInventory(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "guest-xyz"
	sku := newActiveSKU(20, 30.00, 3)
	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 5}, SessionID: sessionID}
	item := &models.CartItem{Base: models.Base{ID: 1}, CartID: 5, SKUID: sku.ID, Quantity: 1, UnitPrice: sku.Price}

	cartRepo.On("GetBySessionID", ctx, sessionID).Return(cart, nil).Once()
	cartRepo.On("GetItem", ctx, cart.ID, sku.ID).Return(item, nil).Once()
	skuRepo.On("CheckAvailability", ctx, sku.ID, 10).Return(false, nil).Once()

	err := svc.UpdateCartItem(ctx, sessionID, nil, sku.ID, 10)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insufficient inventory")
	cartRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// RemoveCartItem
// ---------------------------------------------------------------------------

// TestCartService_RemoveCartItem verifies Requirement 6.3 — removing an item
// by SKU deletes it from the correct cart.
func TestCartService_RemoveCartItem(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	userID := uint(4)
	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 77}, UserID: &userID}
	skuID := uint(123)

	cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()
	cartRepo.On("DeleteItemBySKU", ctx, cart.ID, skuID).Return(nil).Once()

	err := svc.RemoveCartItem(ctx, "", &userID, skuID)
	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
}

// TestCartService_RemoveCartItem_NoCart verifies that attempting to remove
// from a non-existent cart surfaces an error (no silent success).
func TestCartService_RemoveCartItem_NoCart(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "missing"
	cartRepo.On("GetBySessionID", ctx, sessionID).Return(nil, fmt.Errorf("cart not found")).Once()

	err := svc.RemoveCartItem(ctx, sessionID, nil, 1)
	assert.Error(t, err)
	cartRepo.AssertExpectations(t)
	cartRepo.AssertNotCalled(t, "DeleteItemBySKU", mock.Anything, mock.Anything, mock.Anything)
}

// ---------------------------------------------------------------------------
// ClearCart
// ---------------------------------------------------------------------------

// TestCartService_ClearCart verifies that ClearCart removes all items
// for the resolved cart.
func TestCartService_ClearCart(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	userID := uint(2)
	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 99}, UserID: &userID}

	cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()
	cartRepo.On("ClearItems", ctx, cart.ID).Return(nil).Once()

	err := svc.ClearCart(ctx, "", &userID)
	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// MergeGuestCart
// ---------------------------------------------------------------------------

// TestCartService_MergeGuestCart_NoGuestCart verifies merging is a no-op when
// the guest has no cart (Requirement 6.4).
func TestCartService_MergeGuestCart_NoGuestCart(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "no-guest-cart"
	cartRepo.On("GetBySessionID", ctx, sessionID).Return(nil, fmt.Errorf("cart not found")).Once()

	err := svc.MergeGuestCart(ctx, sessionID, 1)
	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
}

// TestCartService_MergeGuestCart_EmptyGuestCartIsDeleted verifies that
// an empty guest cart is cleaned up during merge.
func TestCartService_MergeGuestCart_EmptyGuestCartIsDeleted(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "empty-guest"
	guestCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, SessionID: sessionID}
	guestWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, SessionID: sessionID, Items: []*models.CartItem{}}

	cartRepo.On("GetBySessionID", ctx, sessionID).Return(guestCart, nil).Once()
	cartRepo.On("GetCartWithItems", ctx, uint(1)).Return(guestWithItems, nil).Once()
	cartRepo.On("Delete", ctx, uint(1)).Return(nil).Once()

	err := svc.MergeGuestCart(ctx, sessionID, 5)
	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
}

// TestCartService_MergeGuestCart_MergesDisjointAndOverlappingItems verifies
// Requirement 6.4: items unique to the guest cart are added to the user cart,
// items present in both are combined, and the guest cart is removed afterwards.
func TestCartService_MergeGuestCart_MergesDisjointAndOverlappingItems(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "guest-xyz"
	userID := uint(42)

	guestCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, SessionID: sessionID}
	userCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, UserID: &userID}

	// Guest has SKU 100 (qty 2) and SKU 200 (qty 3).
	guestItems := []*models.CartItem{
		{Base: models.Base{ID: 10}, CartID: 1, SKUID: 100, Quantity: 2, UnitPrice: decimal.NewFromFloat(10)},
		{Base: models.Base{ID: 11}, CartID: 1, SKUID: 200, Quantity: 3, UnitPrice: decimal.NewFromFloat(20)},
	}
	guestWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Items: guestItems}

	// User cart already has SKU 100 (qty 1).
	userExisting := &models.CartItem{
		Base:      models.Base{ID: 50},
		CartID:    2,
		SKUID:     100,
		Quantity:  1,
		UnitPrice: decimal.NewFromFloat(10),
	}

	cartRepo.On("GetBySessionID", ctx, sessionID).Return(guestCart, nil).Once()
	cartRepo.On("GetCartWithItems", ctx, uint(1)).Return(guestWithItems, nil).Once()
	cartRepo.On("GetByUserID", ctx, userID).Return(userCart, nil).Once()

	// SKU 100 exists in user cart: combined qty 3, availability passes, update.
	cartRepo.On("GetItem", ctx, userCart.ID, uint(100)).Return(userExisting, nil).Once()
	skuRepo.On("CheckAvailability", ctx, uint(100), 3).Return(true, nil).Once()
	cartRepo.On("UpdateItem", ctx, mock.MatchedBy(func(it *models.CartItem) bool {
		return it.SKUID == 100 && it.Quantity == 3
	})).Return(nil).Once()

	// SKU 200 does not exist in user cart: add a fresh item.
	cartRepo.On("GetItem", ctx, userCart.ID, uint(200)).
		Return(nil, fmt.Errorf("cart item not found")).Once()
	cartRepo.On("AddItem", ctx, mock.MatchedBy(func(it *models.CartItem) bool {
		return it.SKUID == 200 && it.Quantity == 3 && it.CartID == userCart.ID
	})).Return(nil).Once()

	// Guest cart gets deleted at the end.
	cartRepo.On("Delete", ctx, uint(1)).Return(nil).Once()

	err := svc.MergeGuestCart(ctx, sessionID, userID)
	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// TestCartService_MergeGuestCart_ClampsOverlapToInventory verifies that when
// merging would push quantity beyond available inventory, the item is clamped
// to the SKU's remaining inventory (supports Requirement 6.6 during merges).
func TestCartService_MergeGuestCart_ClampsOverlapToInventory(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "guest-clamp"
	userID := uint(7)

	guestCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, SessionID: sessionID}
	userCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, UserID: &userID}

	guestItems := []*models.CartItem{
		{Base: models.Base{ID: 10}, CartID: 1, SKUID: 100, Quantity: 5, UnitPrice: decimal.NewFromFloat(10)},
	}
	guestWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Items: guestItems}

	userExisting := &models.CartItem{Base: models.Base{ID: 50}, CartID: 2, SKUID: 100, Quantity: 4, UnitPrice: decimal.NewFromFloat(10)}

	// Combined requested quantity = 9, but only 6 available. Service should
	// clamp the final quantity to inventory.
	skuOnlySixLeft := newActiveSKU(100, 10, 6)

	cartRepo.On("GetBySessionID", ctx, sessionID).Return(guestCart, nil).Once()
	cartRepo.On("GetCartWithItems", ctx, uint(1)).Return(guestWithItems, nil).Once()
	cartRepo.On("GetByUserID", ctx, userID).Return(userCart, nil).Once()
	cartRepo.On("GetItem", ctx, userCart.ID, uint(100)).Return(userExisting, nil).Once()
	skuRepo.On("CheckAvailability", ctx, uint(100), 9).Return(false, nil).Once()
	skuRepo.On("GetByID", ctx, uint(100)).Return(skuOnlySixLeft, nil).Once()
	cartRepo.On("UpdateItem", ctx, mock.MatchedBy(func(it *models.CartItem) bool {
		return it.SKUID == 100 && it.Quantity == 6
	})).Return(nil).Once()
	cartRepo.On("Delete", ctx, uint(1)).Return(nil).Once()

	err := svc.MergeGuestCart(ctx, sessionID, userID)
	assert.NoError(t, err)
	cartRepo.AssertExpectations(t)
	skuRepo.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// ValidateCart
// ---------------------------------------------------------------------------

// TestCartService_ValidateCart_AllValid verifies that when every cart item's
// SKU is active, in stock, and has an unchanged price, validation passes
// with no errors.
func TestCartService_ValidateCart_AllValid(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	userID := uint(1)
	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 3}, UserID: &userID}

	sku := newActiveSKU(10, 50, 100)
	items := []*models.CartItem{
		{Base: models.Base{ID: 1}, CartID: 3, SKUID: sku.ID, Quantity: 2, UnitPrice: sku.Price, SKU: sku},
	}
	cartWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 3}, Items: items}

	cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()
	cartRepo.On("GetCartWithItems", ctx, cart.ID).Return(cartWithItems, nil).Once()
	skuRepo.On("GetByID", ctx, sku.ID).Return(sku, nil).Once()

	v, err := svc.ValidateCart(ctx, "", &userID)
	assert.NoError(t, err)
	assert.NotNil(t, v)
	assert.True(t, v.Valid)
	assert.Empty(t, v.Errors)
}

// TestCartService_ValidateCart_DetectsAllErrorTypes verifies that the
// validator flags out-of-stock, insufficient-stock, inactive, and
// price-change errors (supports Requirements 6.2, 6.6).
func TestCartService_ValidateCart_DetectsAllErrorTypes(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "sess"
	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 4}, SessionID: sessionID}

	// Four items covering each error class.
	outOfStock := newActiveSKU(1, 10, 0)
	insufficient := newActiveSKU(2, 10, 1)
	inactive := newActiveSKU(3, 10, 10)
	inactive.IsActive = false
	priceChanged := newActiveSKU(4, 15, 10) // cart had 10.00, now 15.00

	items := []*models.CartItem{
		{Base: models.Base{ID: 1}, SKUID: 1, Quantity: 1, UnitPrice: decimal.NewFromFloat(10), SKU: outOfStock},
		{Base: models.Base{ID: 2}, SKUID: 2, Quantity: 5, UnitPrice: decimal.NewFromFloat(10), SKU: insufficient},
		{Base: models.Base{ID: 3}, SKUID: 3, Quantity: 1, UnitPrice: decimal.NewFromFloat(10), SKU: inactive},
		{Base: models.Base{ID: 4}, SKUID: 4, Quantity: 1, UnitPrice: decimal.NewFromFloat(10), SKU: priceChanged},
	}
	cartWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 4}, Items: items}

	cartRepo.On("GetBySessionID", ctx, sessionID).Return(cart, nil).Once()
	cartRepo.On("GetCartWithItems", ctx, cart.ID).Return(cartWithItems, nil).Once()
	skuRepo.On("GetByID", ctx, uint(1)).Return(outOfStock, nil).Once()
	skuRepo.On("GetByID", ctx, uint(2)).Return(insufficient, nil).Once()
	skuRepo.On("GetByID", ctx, uint(3)).Return(inactive, nil).Once()
	skuRepo.On("GetByID", ctx, uint(4)).Return(priceChanged, nil).Once()

	v, err := svc.ValidateCart(ctx, sessionID, nil)
	assert.NoError(t, err)
	assert.False(t, v.Valid)

	types := map[string]bool{}
	for _, e := range v.Errors {
		types[e.ErrorType] = true
	}
	assert.True(t, types["out_of_stock"], "expected out_of_stock error")
	assert.True(t, types["insufficient_stock"], "expected insufficient_stock error")
	assert.True(t, types["unavailable"], "expected unavailable error")
	assert.True(t, types["price_changed"], "expected price_changed error")
}

// TestCartService_ValidateCart_NoCartReturnsValid verifies that validating a
// session with no cart is a benign success (empty carts are valid).
func TestCartService_ValidateCart_NoCartReturnsValid(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "absent"
	cartRepo.On("GetBySessionID", ctx, sessionID).Return(nil, fmt.Errorf("cart not found")).Once()

	v, err := svc.ValidateCart(ctx, sessionID, nil)
	assert.NoError(t, err)
	assert.True(t, v.Valid)
	assert.Empty(t, v.Errors)
}

// ---------------------------------------------------------------------------
// GetCart
// ---------------------------------------------------------------------------

// TestCartService_GetCart_EmptyWhenMissing verifies that missing carts return
// an empty response rather than an error, so the frontend always receives a
// consistent cart shape (Requirement 6.4 and 6.5).
func TestCartService_GetCart_EmptyWhenMissing(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	sessionID := "nope"
	cartRepo.On("GetBySessionID", ctx, sessionID).Return(nil, fmt.Errorf("cart not found")).Once()

	resp, err := svc.GetCart(ctx, sessionID, nil)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Empty(t, resp.Items)
	assert.True(t, resp.TotalPrice.Equal(decimal.Zero))
	assert.Equal(t, 0, resp.TotalItems)
}

// TestCartService_GetCart_TotalsAndSubtotals verifies that GetCart computes
// per-item subtotals and cart totals correctly (Requirements 6.2, 6.7).
func TestCartService_GetCart_TotalsAndSubtotals(t *testing.T) {
	cartRepo := new(MockCartRepository)
	skuRepo := new(MockSKURepository)
	svc := NewCartService(cartRepo, skuRepo)

	ctx := context.Background()
	userID := uint(3)
	cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 5}, UserID: &userID}

	sku1 := newActiveSKU(10, 15.50, 10)
	sku1.ImageURL = "img1.png"
	sku1.Product = &models.Product{Name: "Phone"}
	sku1.Attributes = []*models.SKUAttribute{{Base: models.Base{ID: 1}, SKUID: 10, Name: "Color", Value: "Red"}}

	sku2 := newActiveSKU(20, 7.25, 20)
	sku2.Product = &models.Product{Name: "Case"}

	items := []*models.CartItem{
		{Base: models.Base{ID: 1}, CartID: 5, SKUID: 10, Quantity: 2, UnitPrice: sku1.Price, SKU: sku1},
		{Base: models.Base{ID: 2}, CartID: 5, SKUID: 20, Quantity: 4, UnitPrice: sku2.Price, SKU: sku2},
	}
	cartWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 5}, Items: items}

	cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()
	cartRepo.On("GetCartWithItems", ctx, cart.ID).Return(cartWithItems, nil).Once()
	skuRepo.On("CheckAvailability", ctx, uint(10), 2).Return(true, nil).Once()
	skuRepo.On("GetByID", ctx, uint(10)).Return(sku1, nil).Once()
	skuRepo.On("CheckAvailability", ctx, uint(20), 4).Return(true, nil).Once()
	skuRepo.On("GetByID", ctx, uint(20)).Return(sku2, nil).Once()

	resp, err := svc.GetCart(ctx, "", &userID)
	assert.NoError(t, err)
	assert.Equal(t, 2, len(resp.Items))
	assert.Equal(t, 6, resp.TotalItems) // 2 + 4
	// 2 * 15.50 + 4 * 7.25 = 31.00 + 29.00 = 60.00
	assert.True(t, resp.TotalPrice.Equal(decimal.NewFromFloat(60.00)),
		"expected total 60.00, got %s", resp.TotalPrice.String())
	// SKU specific details should be present.
	assert.Equal(t, "SKU-010", resp.Items[0].SKUCode)
	assert.Equal(t, "Phone", resp.Items[0].SKUName)
	assert.Equal(t, "img1.png", resp.Items[0].ImageURL)
	assert.Equal(t, 1, len(resp.Items[0].Attributes))
}

// ---------------------------------------------------------------------------
// Property-based tests (using randomized generators and testing/quick-style loops)
// ---------------------------------------------------------------------------

// TestCartService_Property_GetCartTotalsAreConsistent is a property-based test
// asserting the invariant: for any randomly generated cart with N items whose
// quantities are q_i and unit prices are p_i, the GetCart response satisfies
//
//     TotalItems = sum(q_i)
//     TotalPrice = sum(q_i * p_i)
//     Subtotal_i = q_i * p_i
//
// Validates: Requirements 6.2, 6.7
func TestCartService_Property_GetCartTotalsAreConsistent(t *testing.T) {
	const iterations = 50

	rng := rand.New(rand.NewSource(42))

	for i := 0; i < iterations; i++ {
		t.Run(fmt.Sprintf("iter-%d", i), func(t *testing.T) {
			cartRepo := new(MockCartRepository)
			skuRepo := new(MockSKURepository)
			svc := NewCartService(cartRepo, skuRepo)

			ctx := context.Background()
			userID := uint(1)
			cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, UserID: &userID}

			// Generate 1..6 items with quantity 1..10 and price 1.00..500.00.
			itemCount := rng.Intn(6) + 1
			items := make([]*models.CartItem, 0, itemCount)

			expectedTotalItems := 0
			expectedTotal := decimal.Zero

			cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()

			for j := 0; j < itemCount; j++ {
				skuID := uint(j + 10)
				qty := rng.Intn(10) + 1
				// Use 2-decimal prices to avoid floating-point noise.
				priceCents := rng.Intn(50000) + 100 // 1.00 .. 500.99
				price := decimal.New(int64(priceCents), -2)

				sku := &models.SKU{
					BaseWithUpdate: models.BaseWithUpdate{ID: skuID},
					SKUCode:        fmt.Sprintf("SKU-%03d", skuID),
					Price:          price,
					Inventory:      1000,
					IsActive:       true,
					Product:        &models.Product{Name: fmt.Sprintf("Product %d", j)},
				}
				item := &models.CartItem{
					Base:      models.Base{ID: uint(j + 1)},
					CartID:    cart.ID,
					SKUID:     skuID,
					Quantity:  qty,
					UnitPrice: price,
					SKU:       sku,
				}
				items = append(items, item)

				expectedTotalItems += qty
				expectedTotal = expectedTotal.Add(price.Mul(decimal.NewFromInt(int64(qty))))

				skuRepo.On("CheckAvailability", ctx, skuID, qty).Return(true, nil).Once()
				skuRepo.On("GetByID", ctx, skuID).Return(sku, nil).Once()
			}

			cartWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: cart.ID}, Items: items}
			cartRepo.On("GetCartWithItems", ctx, cart.ID).Return(cartWithItems, nil).Once()

			resp, err := svc.GetCart(ctx, "", &userID)
			assert.NoError(t, err)
			assert.Equal(t, expectedTotalItems, resp.TotalItems)
			assert.True(t, expectedTotal.Equal(resp.TotalPrice),
				"total mismatch: expected %s, got %s", expectedTotal.String(), resp.TotalPrice.String())

			// Per-item subtotal invariant.
			for idx, it := range resp.Items {
				expected := items[idx].UnitPrice.Mul(decimal.NewFromInt(int64(items[idx].Quantity)))
				assert.True(t, expected.Equal(it.Subtotal),
					"item %d subtotal mismatch: expected %s, got %s",
					idx, expected.String(), it.Subtotal.String())
			}
		})
	}
}

// TestCartService_Property_UpdateCartItemRespectsInventory asserts the
// invariant: for any random requested quantity q and available inventory n,
// UpdateCartItem succeeds iff q > 0 and q <= n.
//
// Validates: Requirements 6.2, 6.6
func TestCartService_Property_UpdateCartItemRespectsInventory(t *testing.T) {
	const iterations = 80

	rng := rand.New(rand.NewSource(7))

	for i := 0; i < iterations; i++ {
		// Random requested quantity (-5..30) and inventory (0..30).
		requested := rng.Intn(36) - 5
		inventory := rng.Intn(31)

		cartRepo := new(MockCartRepository)
		skuRepo := new(MockSKURepository)
		svc := NewCartService(cartRepo, skuRepo)

		ctx := context.Background()
		userID := uint(1)
		cart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, UserID: &userID}
		sku := newActiveSKU(10, 25.00, inventory)
		item := &models.CartItem{Base: models.Base{ID: 1}, CartID: 1, SKUID: sku.ID, Quantity: 1, UnitPrice: sku.Price}

		if requested > 0 {
			cartRepo.On("GetByUserID", ctx, userID).Return(cart, nil).Once()
			cartRepo.On("GetItem", ctx, cart.ID, sku.ID).Return(item, nil).Once()
			available := requested <= inventory
			skuRepo.On("CheckAvailability", ctx, sku.ID, requested).Return(available, nil).Once()
			if available {
				skuRepo.On("GetByID", ctx, sku.ID).Return(sku, nil).Once()
				cartRepo.On("UpdateItem", ctx, mock.MatchedBy(func(it *models.CartItem) bool {
					return it.Quantity == requested
				})).Return(nil).Once()
			}
		}

		err := svc.UpdateCartItem(ctx, "", &userID, sku.ID, requested)

		shouldSucceed := requested > 0 && requested <= inventory
		if shouldSucceed {
			assert.NoError(t, err, "requested=%d inventory=%d should succeed", requested, inventory)
		} else {
			assert.Error(t, err, "requested=%d inventory=%d should fail", requested, inventory)
		}
	}
}

// TestCartService_Property_MergeNeverExceedsInventory asserts the invariant
// that after merging a guest item (quantity g) with a user item (quantity u)
// for a SKU with inventory n, the resulting cart item quantity is never
// greater than max(u+g, n) bounded by n when n < u+g.
//
// Validates: Requirement 6.6 (inventory bound during merge)
func TestCartService_Property_MergeNeverExceedsInventory(t *testing.T) {
	const iterations = 50

	rng := rand.New(rand.NewSource(123))

	for i := 0; i < iterations; i++ {
		// Guest + user quantity 1..10; inventory 0..25.
		guestQty := rng.Intn(10) + 1
		userQty := rng.Intn(10) + 1
		inventory := rng.Intn(26)

		cartRepo := new(MockCartRepository)
		skuRepo := new(MockSKURepository)
		svc := NewCartService(cartRepo, skuRepo)

		ctx := context.Background()
		sessionID := "sess"
		userID := uint(1)

		guestCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, SessionID: sessionID}
		userCart := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, UserID: &userID}
		guestItem := &models.CartItem{Base: models.Base{ID: 10}, CartID: 1, SKUID: 100, Quantity: guestQty, UnitPrice: decimal.NewFromFloat(5)}
		guestWithItems := &models.Cart{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Items: []*models.CartItem{guestItem}}
		userItem := &models.CartItem{Base: models.Base{ID: 50}, CartID: 2, SKUID: 100, Quantity: userQty, UnitPrice: decimal.NewFromFloat(5)}
		sku := newActiveSKU(100, 5, inventory)

		combined := guestQty + userQty
		enough := combined <= inventory

		cartRepo.On("GetBySessionID", ctx, sessionID).Return(guestCart, nil).Once()
		cartRepo.On("GetCartWithItems", ctx, uint(1)).Return(guestWithItems, nil).Once()
		cartRepo.On("GetByUserID", ctx, userID).Return(userCart, nil).Once()
		cartRepo.On("GetItem", ctx, userCart.ID, uint(100)).Return(userItem, nil).Once()
		skuRepo.On("CheckAvailability", ctx, uint(100), combined).Return(enough, nil).Once()

		var observedQty int
		cartRepo.On("UpdateItem", ctx, mock.MatchedBy(func(it *models.CartItem) bool {
			observedQty = it.Quantity
			return true
		})).Return(nil).Maybe()

		if !enough {
			skuRepo.On("GetByID", ctx, uint(100)).Return(sku, nil).Once()
		}
		cartRepo.On("Delete", ctx, uint(1)).Return(nil).Once()

		err := svc.MergeGuestCart(ctx, sessionID, userID)
		assert.NoError(t, err)

		// Invariant: observed quantity <= max(combined, inventory) and <= inventory
		// when clamping was required.
		assert.LessOrEqual(t, observedQty, combined,
			"guest=%d user=%d inv=%d got=%d", guestQty, userQty, inventory, observedQty)
		if !enough {
			assert.Equal(t, inventory, observedQty,
				"clamp expected: guest=%d user=%d inv=%d got=%d",
				guestQty, userQty, inventory, observedQty)
		} else {
			assert.Equal(t, combined, observedQty,
				"combined expected: guest=%d user=%d inv=%d got=%d",
				guestQty, userQty, inventory, observedQty)
		}
	}
}
