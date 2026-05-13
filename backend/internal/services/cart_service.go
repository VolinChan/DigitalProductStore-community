package services

import (
	"context"
	"fmt"

	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// CartService defines the interface for cart business logic
type CartService interface {
	// AddToCart adds a SKU to the cart
	AddToCart(ctx context.Context, sessionID string, userID *uint, req *AddToCartRequest) error

	// GetCart retrieves the cart for a user or guest
	GetCart(ctx context.Context, sessionID string, userID *uint) (*CartResponse, error)

	// UpdateCartItem updates the quantity of a cart item
	UpdateCartItem(ctx context.Context, sessionID string, userID *uint, skuID uint, quantity int) error

	// RemoveCartItem removes an item from the cart
	RemoveCartItem(ctx context.Context, sessionID string, userID *uint, skuID uint) error

	// ClearCart clears all items from the cart
	ClearCart(ctx context.Context, sessionID string, userID *uint) error

	// MergeGuestCart merges a guest cart into a user cart after login
	MergeGuestCart(ctx context.Context, sessionID string, userID uint) error

	// ValidateCart validates the cart items (inventory, prices)
	ValidateCart(ctx context.Context, sessionID string, userID *uint) (*CartValidation, error)
}

// AddToCartRequest represents a request to add an item to cart
type AddToCartRequest struct {
	SKUID    uint `json:"sku_id" validate:"required,gt=0"`
	Quantity int  `json:"quantity" validate:"required,gt=0"`
}

// CartResponse represents the cart with calculated totals
type CartResponse struct {
	ID         uint                 `json:"id"`
	UserID     *uint                `json:"user_id"`
	SessionID  string               `json:"session_id"`
	Items      []*CartItemResponse  `json:"items"`
	TotalPrice decimal.Decimal      `json:"total_price"`
	TotalItems int                  `json:"total_items"`
}

// CartItemResponse represents a cart item with SKU details
type CartItemResponse struct {
	ID        uint            `json:"id"`
	SKUID     uint            `json:"sku_id"`
	SKUCode   string          `json:"sku_code"`
	SKUName   string          `json:"sku_name"`
	ImageURL  string          `json:"image_url"`
	Attributes []*models.SKUAttribute `json:"attributes"`
	Quantity  int             `json:"quantity"`
	UnitPrice decimal.Decimal `json:"unit_price"`
	Subtotal  decimal.Decimal `json:"subtotal"`
	Available bool            `json:"available"`
	MaxQuantity int           `json:"max_quantity"`
}

// CartValidation represents cart validation results
type CartValidation struct {
	Valid  bool                    `json:"valid"`
	Errors []*CartValidationError  `json:"errors"`
}

// CartValidationError represents a validation error for a cart item
type CartValidationError struct {
	SKUID       uint   `json:"sku_id"`
	SKUCode     string `json:"sku_code"`
	ErrorType   string `json:"error_type"` // "out_of_stock", "insufficient_stock", "price_changed", "unavailable"
	Message     string `json:"message"`
	CurrentQty  int    `json:"current_qty,omitempty"`
	RequestedQty int   `json:"requested_qty,omitempty"`
}

// cartService implements CartService
type cartService struct {
	cartRepo repositories.CartRepository
	skuRepo  repositories.SKURepository
}

// NewCartService creates a new cart service
func NewCartService(
	cartRepo repositories.CartRepository,
	skuRepo repositories.SKURepository,
) CartService {
	return &cartService{
		cartRepo: cartRepo,
		skuRepo:  skuRepo,
	}
}

// AddToCart adds a SKU to the cart
func (s *cartService) AddToCart(ctx context.Context, sessionID string, userID *uint, req *AddToCartRequest) error {
	// Get or create cart
	cart, err := s.getOrCreateCart(ctx, sessionID, userID)
	if err != nil {
		return err
	}

	// Get SKU details
	sku, err := s.skuRepo.GetWithAttributes(ctx, req.SKUID)
	if err != nil {
		return fmt.Errorf("SKU not found: %w", err)
	}

	// Check if SKU is active
	if !sku.IsActive {
		return fmt.Errorf("SKU is not available")
	}

	// Check inventory availability
	available, err := s.skuRepo.CheckAvailability(ctx, req.SKUID, req.Quantity)
	if err != nil {
		return err
	}
	if !available {
		return fmt.Errorf("insufficient inventory for SKU")
	}

	// Check if item already exists in cart
	existingItem, err := s.cartRepo.GetItem(ctx, cart.ID, req.SKUID)
	if err == nil {
		// Item exists, update quantity
		newQuantity := existingItem.Quantity + req.Quantity

		// Check if new quantity is available
		available, err := s.skuRepo.CheckAvailability(ctx, req.SKUID, newQuantity)
		if err != nil {
			return err
		}
		if !available {
			return fmt.Errorf("insufficient inventory for requested quantity")
		}

		existingItem.Quantity = newQuantity
		existingItem.UnitPrice = sku.Price
		if err := s.cartRepo.UpdateItem(ctx, existingItem); err != nil {
			return err
		}
	} else {
		// Item doesn't exist, create new
		item := &models.CartItem{
			CartID:    cart.ID,
			SKUID:     req.SKUID,
			Quantity:  req.Quantity,
			UnitPrice: sku.Price,
		}
		if err := s.cartRepo.AddItem(ctx, item); err != nil {
			return err
		}
	}

	return nil
}

// GetCart retrieves the cart for a user or guest
func (s *cartService) GetCart(ctx context.Context, sessionID string, userID *uint) (*CartResponse, error) {
	// Get cart
	cart, err := s.getCart(ctx, sessionID, userID)
	if err != nil {
		// Return empty cart if not found
		return &CartResponse{
			Items:      []*CartItemResponse{},
			TotalPrice: decimal.Zero,
			TotalItems: 0,
		}, nil
	}

	// Get cart with items
	cartWithItems, err := s.cartRepo.GetCartWithItems(ctx, cart.ID)
	if err != nil {
		return nil, err
	}

	// Build response
	return s.buildCartResponse(ctx, cartWithItems)
}

// UpdateCartItem updates the quantity of a cart item
func (s *cartService) UpdateCartItem(ctx context.Context, sessionID string, userID *uint, skuID uint, quantity int) error {
	if quantity <= 0 {
		return fmt.Errorf("quantity must be greater than 0")
	}

	// Get cart
	cart, err := s.getCart(ctx, sessionID, userID)
	if err != nil {
		return err
	}

	// Get cart item
	item, err := s.cartRepo.GetItem(ctx, cart.ID, skuID)
	if err != nil {
		return fmt.Errorf("item not found in cart")
	}

	// Check inventory availability
	available, err := s.skuRepo.CheckAvailability(ctx, skuID, quantity)
	if err != nil {
		return err
	}
	if !available {
		return fmt.Errorf("insufficient inventory for requested quantity")
	}

	// Update quantity
	item.Quantity = quantity

	// Update price (in case it changed)
	sku, err := s.skuRepo.GetByID(ctx, skuID)
	if err != nil {
		return err
	}
	item.UnitPrice = sku.Price

	if err := s.cartRepo.UpdateItem(ctx, item); err != nil {
		return err
	}

	return nil
}

// RemoveCartItem removes an item from the cart
func (s *cartService) RemoveCartItem(ctx context.Context, sessionID string, userID *uint, skuID uint) error {
	// Get cart
	cart, err := s.getCart(ctx, sessionID, userID)
	if err != nil {
		return err
	}

	// Delete item
	if err := s.cartRepo.DeleteItemBySKU(ctx, cart.ID, skuID); err != nil {
		return err
	}

	return nil
}

// ClearCart clears all items from the cart
func (s *cartService) ClearCart(ctx context.Context, sessionID string, userID *uint) error {
	// Get cart
	cart, err := s.getCart(ctx, sessionID, userID)
	if err != nil {
		return err
	}

	// Clear items
	if err := s.cartRepo.ClearItems(ctx, cart.ID); err != nil {
		return err
	}

	return nil
}

// MergeGuestCart merges a guest cart into a user cart after login
func (s *cartService) MergeGuestCart(ctx context.Context, sessionID string, userID uint) error {
	// Get guest cart
	guestCart, err := s.cartRepo.GetBySessionID(ctx, sessionID)
	if err != nil {
		// No guest cart to merge
		return nil
	}

	// Get guest cart with items
	guestCartWithItems, err := s.cartRepo.GetCartWithItems(ctx, guestCart.ID)
	if err != nil {
		return err
	}

	// If no items, delete guest cart and return
	if len(guestCartWithItems.Items) == 0 {
		_ = s.cartRepo.Delete(ctx, guestCart.ID)
		return nil
	}

	// Get or create user cart
	userCart, err := s.getOrCreateCart(ctx, "", &userID)
	if err != nil {
		return err
	}

	// Merge items
	for _, guestItem := range guestCartWithItems.Items {
		// Check if item exists in user cart
		userItem, err := s.cartRepo.GetItem(ctx, userCart.ID, guestItem.SKUID)
		if err == nil {
			// Item exists, update quantity
			newQuantity := userItem.Quantity + guestItem.Quantity

			// Check availability
			available, err := s.skuRepo.CheckAvailability(ctx, guestItem.SKUID, newQuantity)
			if err != nil {
				continue
			}
			if !available {
				// Use max available quantity
				sku, err := s.skuRepo.GetByID(ctx, guestItem.SKUID)
				if err != nil {
					continue
				}
				newQuantity = sku.Inventory
			}

			userItem.Quantity = newQuantity
			userItem.UnitPrice = guestItem.UnitPrice
			_ = s.cartRepo.UpdateItem(ctx, userItem)
		} else {
			// Item doesn't exist, add to user cart
			newItem := &models.CartItem{
				CartID:    userCart.ID,
				SKUID:     guestItem.SKUID,
				Quantity:  guestItem.Quantity,
				UnitPrice: guestItem.UnitPrice,
			}
			_ = s.cartRepo.AddItem(ctx, newItem)
		}
	}

	// Delete guest cart
	_ = s.cartRepo.Delete(ctx, guestCart.ID)

	return nil
}

// ValidateCart validates the cart items (inventory, prices)
func (s *cartService) ValidateCart(ctx context.Context, sessionID string, userID *uint) (*CartValidation, error) {
	validation := &CartValidation{
		Valid:  true,
		Errors: []*CartValidationError{},
	}

	// Get cart
	cart, err := s.getCart(ctx, sessionID, userID)
	if err != nil {
		// No cart, return valid
		return validation, nil
	}

	// Get cart with items
	cartWithItems, err := s.cartRepo.GetCartWithItems(ctx, cart.ID)
	if err != nil {
		return nil, err
	}

	// Validate each item
	for _, item := range cartWithItems.Items {
		// Get current SKU details
		sku, err := s.skuRepo.GetByID(ctx, item.SKUID)
		if err != nil {
			validation.Valid = false
			validation.Errors = append(validation.Errors, &CartValidationError{
				SKUID:     item.SKUID,
				SKUCode:   item.SKU.SKUCode,
				ErrorType: "unavailable",
				Message:   "Product is no longer available",
			})
			continue
		}

		// Check if SKU is active
		if !sku.IsActive {
			validation.Valid = false
			validation.Errors = append(validation.Errors, &CartValidationError{
				SKUID:     item.SKUID,
				SKUCode:   sku.SKUCode,
				ErrorType: "unavailable",
				Message:   "Product is no longer available",
			})
			continue
		}

		// Check inventory
		if sku.Inventory == 0 {
			validation.Valid = false
			validation.Errors = append(validation.Errors, &CartValidationError{
				SKUID:        item.SKUID,
				SKUCode:      sku.SKUCode,
				ErrorType:    "out_of_stock",
				Message:      "Product is out of stock",
				RequestedQty: item.Quantity,
			})
			continue
		}

		if sku.Inventory < item.Quantity {
			validation.Valid = false
			validation.Errors = append(validation.Errors, &CartValidationError{
				SKUID:        item.SKUID,
				SKUCode:      sku.SKUCode,
				ErrorType:    "insufficient_stock",
				Message:      fmt.Sprintf("Only %d items available", sku.Inventory),
				CurrentQty:   sku.Inventory,
				RequestedQty: item.Quantity,
			})
			continue
		}

		// Check price changes
		if !sku.Price.Equal(item.UnitPrice) {
			validation.Valid = false
			validation.Errors = append(validation.Errors, &CartValidationError{
				SKUID:     item.SKUID,
				SKUCode:   sku.SKUCode,
				ErrorType: "price_changed",
				Message:   fmt.Sprintf("Price has changed from %s to %s", item.UnitPrice.String(), sku.Price.String()),
			})
		}
	}

	return validation, nil
}

// getCart retrieves the cart for a user or guest
func (s *cartService) getCart(ctx context.Context, sessionID string, userID *uint) (*models.Cart, error) {
	if userID != nil {
		return s.cartRepo.GetByUserID(ctx, *userID)
	}
	return s.cartRepo.GetBySessionID(ctx, sessionID)
}

// getOrCreateCart gets or creates a cart for a user or guest
func (s *cartService) getOrCreateCart(ctx context.Context, sessionID string, userID *uint) (*models.Cart, error) {
	cart, err := s.getCart(ctx, sessionID, userID)
	if err == nil {
		return cart, nil
	}

	// Create new cart
	cart = &models.Cart{
		UserID:    userID,
		SessionID: sessionID,
	}
	if err := s.cartRepo.Create(ctx, cart); err != nil {
		return nil, err
	}

	return cart, nil
}

// buildCartResponse builds a cart response with calculated totals
func (s *cartService) buildCartResponse(ctx context.Context, cart *models.Cart) (*CartResponse, error) {
	response := &CartResponse{
		ID:         cart.ID,
		UserID:     cart.UserID,
		SessionID:  cart.SessionID,
		Items:      []*CartItemResponse{},
		TotalPrice: decimal.Zero,
		TotalItems: 0,
	}

	for _, item := range cart.Items {
		// Calculate subtotal
		subtotal := item.UnitPrice.Mul(decimal.NewFromInt(int64(item.Quantity)))

		// Check availability
		available, _ := s.skuRepo.CheckAvailability(ctx, item.SKUID, item.Quantity)

		// Get max quantity
		sku, _ := s.skuRepo.GetByID(ctx, item.SKUID)
		maxQuantity := 0
		if sku != nil {
			maxQuantity = sku.Inventory
		}

		// Build item response
		itemResponse := &CartItemResponse{
			ID:          item.ID,
			SKUID:       item.SKUID,
			SKUCode:     item.SKU.SKUCode,
			SKUName:     item.SKU.Product.Name,
			ImageURL:    item.SKU.ImageURL,
			Attributes:  item.SKU.Attributes,
			Quantity:    item.Quantity,
			UnitPrice:   item.UnitPrice,
			Subtotal:    subtotal,
			Available:   available,
			MaxQuantity: maxQuantity,
		}

		response.Items = append(response.Items, itemResponse)
		response.TotalPrice = response.TotalPrice.Add(subtotal)
		response.TotalItems += item.Quantity
	}

	return response, nil
}
