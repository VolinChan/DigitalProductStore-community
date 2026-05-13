package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
	"github.com/digital-store/backend/pkg/utils"
)

// CartHandler handles cart-related HTTP requests
type CartHandler struct {
	cartService services.CartService
}

// NewCartHandler creates a new cart handler
func NewCartHandler(cartService services.CartService) *CartHandler {
	return &CartHandler{
		cartService: cartService,
	}
}

// AddToCart handles POST /api/v1/cart/items
// @Summary Add item to cart
// @Description Add a SKU to the shopping cart
// @Tags Cart
// @Accept json
// @Produce json
// @Param request body services.AddToCartRequest true "Add to cart request"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/cart/items [post]
func (h *CartHandler) AddToCart(c *gin.Context) {
	var req services.AddToCartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body")
		return
	}

	// Validate request
	if req.SKUID == 0 || req.Quantity <= 0 {
		response.BadRequest(c, "Invalid SKU ID or quantity")
		return
	}

	// Get session ID from cookie or generate new one
	sessionID := h.getOrCreateSessionID(c)

	// Get user ID if authenticated
	var userID *uint
	if userIDVal, exists := c.Get("user_id"); exists {
		if uid, ok := userIDVal.(uint); ok {
			userID = &uid
		}
	}

	// Add to cart
	if err := h.cartService.AddToCart(c.Request.Context(), sessionID, userID, &req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "Item added to cart successfully",
	})
}

// GetCart handles GET /api/v1/cart
// @Summary Get cart
// @Description Get the shopping cart for the current user or guest
// @Tags Cart
// @Produce json
// @Success 200 {object} response.Response{data=services.CartResponse}
// @Failure 500 {object} response.Response
// @Router /api/v1/cart [get]
func (h *CartHandler) GetCart(c *gin.Context) {
	// Get session ID
	sessionID := h.getOrCreateSessionID(c)

	// Get user ID if authenticated
	var userID *uint
	if userIDVal, exists := c.Get("user_id"); exists {
		if uid, ok := userIDVal.(uint); ok {
			userID = &uid
		}
	}

	// Get cart
	cart, err := h.cartService.GetCart(c.Request.Context(), sessionID, userID)
	if err != nil {
		response.InternalError(c, "Failed to get cart")
		return
	}

	response.Success(c, cart)
}

// UpdateCartItem handles PUT /api/v1/cart/items/:sku_id
// @Summary Update cart item
// @Description Update the quantity of a cart item
// @Tags Cart
// @Accept json
// @Produce json
// @Param sku_id path int true "SKU ID"
// @Param request body object{quantity=int} true "Update quantity request"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/cart/items/{sku_id} [put]
func (h *CartHandler) UpdateCartItem(c *gin.Context) {
	// Get SKU ID from path
	skuIDStr := c.Param("sku_id")
	skuID, err := strconv.ParseUint(skuIDStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid SKU ID")
		return
	}

	// Parse request body
	var req struct {
		Quantity int `json:"quantity" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body")
		return
	}

	// Get session ID
	sessionID := h.getOrCreateSessionID(c)

	// Get user ID if authenticated
	var userID *uint
	if userIDVal, exists := c.Get("user_id"); exists {
		if uid, ok := userIDVal.(uint); ok {
			userID = &uid
		}
	}

	// Update cart item
	if err := h.cartService.UpdateCartItem(c.Request.Context(), sessionID, userID, uint(skuID), req.Quantity); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "Cart item updated successfully",
	})
}

// RemoveCartItem handles DELETE /api/v1/cart/items/:sku_id
// @Summary Remove cart item
// @Description Remove an item from the cart
// @Tags Cart
// @Produce json
// @Param sku_id path int true "SKU ID"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/cart/items/{sku_id} [delete]
func (h *CartHandler) RemoveCartItem(c *gin.Context) {
	// Get SKU ID from path
	skuIDStr := c.Param("sku_id")
	skuID, err := strconv.ParseUint(skuIDStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid SKU ID")
		return
	}

	// Get session ID
	sessionID := h.getOrCreateSessionID(c)

	// Get user ID if authenticated
	var userID *uint
	if userIDVal, exists := c.Get("user_id"); exists {
		if uid, ok := userIDVal.(uint); ok {
			userID = &uid
		}
	}

	// Remove cart item
	if err := h.cartService.RemoveCartItem(c.Request.Context(), sessionID, userID, uint(skuID)); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "Cart item removed successfully",
	})
}

// ClearCart handles DELETE /api/v1/cart
// @Summary Clear cart
// @Description Remove all items from the cart
// @Tags Cart
// @Produce json
// @Success 200 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/cart [delete]
func (h *CartHandler) ClearCart(c *gin.Context) {
	// Get session ID
	sessionID := h.getOrCreateSessionID(c)

	// Get user ID if authenticated
	var userID *uint
	if userIDVal, exists := c.Get("user_id"); exists {
		if uid, ok := userIDVal.(uint); ok {
			userID = &uid
		}
	}

	// Clear cart
	if err := h.cartService.ClearCart(c.Request.Context(), sessionID, userID); err != nil {
		response.InternalError(c, "Failed to clear cart")
		return
	}

	response.Success(c, gin.H{
		"message": "Cart cleared successfully",
	})
}

// MergeGuestCart handles POST /api/v1/cart/merge
// @Summary Merge guest cart
// @Description Merge guest cart into user cart after login
// @Tags Cart
// @Produce json
// @Success 200 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/cart/merge [post]
// @Security BearerAuth
func (h *CartHandler) MergeGuestCart(c *gin.Context) {
	// Get session ID
	sessionID := h.getOrCreateSessionID(c)

	// Get user ID (must be authenticated)
	userIDVal, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Authentication required")
		return
	}

	userID, ok := userIDVal.(uint)
	if !ok {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	// Merge guest cart
	if err := h.cartService.MergeGuestCart(c.Request.Context(), sessionID, userID); err != nil {
		response.InternalError(c, "Failed to merge cart")
		return
	}

	response.Success(c, gin.H{
		"message": "Cart merged successfully",
	})
}

// ValidateCart handles GET /api/v1/cart/validate
// @Summary Validate cart
// @Description Validate cart items (inventory, prices)
// @Tags Cart
// @Produce json
// @Success 200 {object} response.Response{data=services.CartValidation}
// @Failure 500 {object} response.Response
// @Router /api/v1/cart/validate [get]
func (h *CartHandler) ValidateCart(c *gin.Context) {
	// Get session ID
	sessionID := h.getOrCreateSessionID(c)

	// Get user ID if authenticated
	var userID *uint
	if userIDVal, exists := c.Get("user_id"); exists {
		if uid, ok := userIDVal.(uint); ok {
			userID = &uid
		}
	}

	// Validate cart
	validation, err := h.cartService.ValidateCart(c.Request.Context(), sessionID, userID)
	if err != nil {
		response.InternalError(c, "Failed to validate cart")
		return
	}

	response.Success(c, validation)
}

// getOrCreateSessionID gets the session ID from cookie or creates a new one
func (h *CartHandler) getOrCreateSessionID(c *gin.Context) string {
	const sessionCookieName = "session_id"

	// Try to get session ID from cookie
	sessionID, err := c.Cookie(sessionCookieName)
	if err == nil && sessionID != "" {
		return sessionID
	}

	// Generate new session ID
	sessionID = utils.GenerateRandomString(32)

	// Set cookie (30 days)
	c.SetCookie(
		sessionCookieName,
		sessionID,
		30*24*60*60, // 30 days
		"/",
		"",
		false, // secure (set to true in production with HTTPS)
		true,  // httpOnly
	)

	return sessionID
}
