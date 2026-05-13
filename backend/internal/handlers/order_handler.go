package handlers

import (
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/middleware"
	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// OrderHandler handles order-related HTTP requests.
type OrderHandler struct {
	orderService services.OrderService
}

// NewOrderHandler creates a new OrderHandler backed by the given service.
func NewOrderHandler(orderService services.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

// createOrderRequest is the shape accepted by POST /api/v1/orders. It mirrors
// services.CreateOrderRequest but intentionally omits UserID; the handler
// derives the user from the authentication context so clients cannot spoof
// another user's order.
type createOrderRequest struct {
	Items           []services.CreateOrderItemRequest `json:"items"`
	CartID          *uint                             `json:"cart_id"`
	ClearCart       bool                              `json:"clear_cart"`
	GuestName       string                            `json:"guest_name"`
	GuestEmail      string                            `json:"guest_email"`
	GuestPhone      string                            `json:"guest_phone"`
	ShippingAddress string                            `json:"shipping_address"`
	PaymentMethod   string                            `json:"payment_method"`
}

// trackOrderRequest is the shape accepted by POST /api/v1/orders/track. Both
// fields may also be supplied via query string for convenience.
type trackOrderRequest struct {
	OrderNumber string `json:"order_number" form:"order_number"`
	Email       string `json:"email" form:"email"`
}

// cancelOrderRequest carries an optional cancellation reason. The reason is
// surfaced to the admin audit log by the service layer.
type cancelOrderRequest struct {
	Reason string `json:"reason"`
}

// CreateOrder handles POST /api/v1/orders. The endpoint is public: when the
// caller presents a valid bearer token the order is attached to their user
// account, otherwise the guest contact fields are required.
// @Summary      Create order
// @Description  Creates a new order. Supports both authenticated and guest checkout.
// @Tags         Orders
// @Accept       json
// @Produce      json
// @Param        request body createOrderRequest true "Order payload"
// @Success      201 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/orders [post]
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req createOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request body", err.Error())
		return
	}

	serviceReq := &services.CreateOrderRequest{
		Items:           req.Items,
		CartID:          req.CartID,
		ClearCart:       req.ClearCart,
		GuestName:       strings.TrimSpace(req.GuestName),
		GuestEmail:      strings.TrimSpace(req.GuestEmail),
		GuestPhone:      strings.TrimSpace(req.GuestPhone),
		ShippingAddress: req.ShippingAddress,
		PaymentMethod:   models.PaymentMethod(strings.TrimSpace(req.PaymentMethod)),
	}

	// If the caller is authenticated, attach their user ID. Guests leave it
	// nil and must supply the guest contact fields validated by the service.
	if userID, ok := middleware.GetUserID(c); ok {
		uid := userID
		serviceReq.UserID = &uid
	}

	order, err := h.orderService.CreateOrder(c.Request.Context(), serviceReq)
	if err != nil {
		writeOrderServiceError(c, err)
		return
	}

	response.Created(c, order)
}

// ListUserOrders handles GET /api/v1/user/orders. It returns the paginated
// order history for the authenticated user. Pagination uses limit/offset
// query parameters (Requirement 30.5) which the handler translates into the
// page/page_size shape the service expects. Optional status/sort filters
// (Requirement 30.6) are forwarded as-is.
// @Summary      List user orders
// @Description  Returns the paginated order history for the authenticated user.
// @Tags         Orders
// @Produce      json
// @Param        limit      query int    false "Page size (1-100, default 20)"
// @Param        offset     query int    false "Offset in items (default 0)"
// @Param        status     query string false "Order status filter"
// @Param        sort_by    query string false "Sort field (created_at, updated_at, total_amount, order_number)"
// @Param        sort_order query string false "Sort order (asc or desc)"
// @Success      200 {object} response.Response{data=services.OrderListResponse}
// @Failure      401 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/user/orders [get]
// @Security     BearerAuth
func (h *OrderHandler) ListUserOrders(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "authentication required")
		return
	}

	limit := parseIntQuery(c, "limit", 20, 1, 100)
	offset := parseIntQuery(c, "offset", 0, 0, 0)

	// The service uses page/page_size; translate offset into an equivalent
	// page number so we keep a single pagination model internally.
	page := offset/limit + 1

	listReq := &services.ListOrdersRequest{
		Page:      page,
		PageSize:  limit,
		Status:    c.Query("status"),
		SortBy:    c.Query("sort_by"),
		SortOrder: c.Query("sort_order"),
	}

	result, err := h.orderService.ListOrders(c.Request.Context(), userID, listReq)
	if err != nil {
		if errors.Is(err, services.ErrInvalidOrderStatus) {
			response.BadRequest(c, err.Error())
			return
		}
		response.InternalError(c, "failed to list orders", err.Error())
		return
	}

	meta := &response.Meta{
		Page:       result.Page,
		PerPage:    result.PageSize,
		Total:      result.Total,
		TotalPages: totalPages(result.Total, result.PageSize),
	}
	response.SuccessWithMeta(c, result, meta)
}

// GetUserOrder handles GET /api/v1/user/orders/:id. The order must belong to
// the authenticated user; otherwise a 404 is returned to avoid leaking the
// existence of other users' orders.
// @Summary      Get user order
// @Description  Returns a single order that belongs to the authenticated user.
// @Tags         Orders
// @Produce      json
// @Param        id path int true "Order ID"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      401 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /api/v1/user/orders/{id} [get]
// @Security     BearerAuth
func (h *OrderHandler) GetUserOrder(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "authentication required")
		return
	}

	orderID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid order id")
		return
	}

	order, err := h.orderService.GetOrder(c.Request.Context(), orderID)
	if err != nil {
		if errors.Is(err, repositories.ErrOrderNotFound) {
			response.NotFound(c, "order not found")
			return
		}
		response.InternalError(c, "failed to get order", err.Error())
		return
	}

	// Ownership check: treat a mismatched user the same as a missing record.
	if order.UserID == nil || *order.UserID != userID {
		response.NotFound(c, "order not found")
		return
	}

	response.Success(c, order)
}

// CancelUserOrder handles POST /api/v1/user/orders/:id/cancel. Cancellation
// is permitted only while the order is still in a customer-cancellable
// status (pending_payment, pending_transfer); the underlying service returns
// ErrOrderNotCancellable otherwise. Ownership is verified first so the
// cancellation error surface only covers orders the caller can actually see.
// @Summary      Cancel order
// @Description  Cancels an order that belongs to the authenticated user.
// @Tags         Orders
// @Accept       json
// @Produce      json
// @Param        id      path int                true  "Order ID"
// @Param        request body cancelOrderRequest false "Optional reason"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      401 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /api/v1/user/orders/{id}/cancel [post]
// @Security     BearerAuth
func (h *OrderHandler) CancelUserOrder(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "authentication required")
		return
	}

	orderID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid order id")
		return
	}

	// Body is optional; ignore a decoding failure rather than rejecting a
	// request that simply did not supply one.
	var req cancelOrderRequest
	_ = c.ShouldBindJSON(&req)

	order, err := h.orderService.GetOrder(c.Request.Context(), orderID)
	if err != nil {
		if errors.Is(err, repositories.ErrOrderNotFound) {
			response.NotFound(c, "order not found")
			return
		}
		response.InternalError(c, "failed to get order", err.Error())
		return
	}
	if order.UserID == nil || *order.UserID != userID {
		response.NotFound(c, "order not found")
		return
	}

	if err := h.orderService.CancelOrder(c.Request.Context(), orderID, req.Reason); err != nil {
		writeOrderServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "order cancelled"})
}

// TrackOrder handles POST /api/v1/orders/track. It accepts the order number
// and email via JSON body or query string so it works for both form
// submissions and API clients. The email is matched against the order's
// user email or guest email, preventing enumeration by order number alone.
// @Summary      Track order
// @Description  Retrieves an order by order number + email (guest tracking).
// @Tags         Orders
// @Accept       json
// @Produce      json
// @Param        request body trackOrderRequest false "Tracking payload"
// @Param        order_number query string false "Order number"
// @Param        email        query string false "Email address"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /api/v1/orders/track [post]
func (h *OrderHandler) TrackOrder(c *gin.Context) {
	var req trackOrderRequest
	// Accept either a JSON body or query-string parameters. Body values take
	// precedence when both are supplied.
	_ = c.ShouldBindJSON(&req)
	if req.OrderNumber == "" {
		req.OrderNumber = c.Query("order_number")
	}
	if req.Email == "" {
		req.Email = c.Query("email")
	}

	orderNumber := strings.TrimSpace(req.OrderNumber)
	email := strings.TrimSpace(req.Email)
	if orderNumber == "" || email == "" {
		response.BadRequest(c, "order_number and email are required")
		return
	}

	order, err := h.orderService.TrackOrder(c.Request.Context(), orderNumber, email)
	if err != nil {
		if errors.Is(err, repositories.ErrOrderNotFound) {
			response.NotFound(c, "order not found")
			return
		}
		response.InternalError(c, "failed to track order", err.Error())
		return
	}

	response.Success(c, order)
}

// writeOrderServiceError maps the well-known sentinel errors from the order
// service onto appropriate HTTP responses. Validation-style errors become
// 400s, missing orders become 404s, and anything else is treated as an
// internal error with the message included to aid debugging in development.
func writeOrderServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrOrderNotFound):
		response.NotFound(c, "order not found")
	case errors.Is(err, services.ErrEmptyCart),
		errors.Is(err, services.ErrInvalidShippingInfo),
		errors.Is(err, services.ErrInvalidPaymentMethod),
		errors.Is(err, services.ErrSKUUnavailable),
		errors.Is(err, services.ErrInvalidQuantity),
		errors.Is(err, services.ErrInvalidOrderStatus),
		errors.Is(err, services.ErrInvalidStatusTransition),
		errors.Is(err, services.ErrOrderNotCancellable):
		response.BadRequest(c, err.Error())
	default:
		response.InternalError(c, "order operation failed", err.Error())
	}
}

// parseUintParam extracts a uint path parameter. Returns false when the
// value is missing or not parseable so the caller can emit a 400.
func parseUintParam(c *gin.Context, key string) (uint, bool) {
	raw := c.Param(key)
	v, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || v == 0 {
		return 0, false
	}
	return uint(v), true
}

// parseIntQuery reads an int query parameter and applies sane bounds. A
// missing/invalid value falls back to def. When max > 0 it clamps large
// values so pagination stays within service limits.
func parseIntQuery(c *gin.Context, key string, def, min, max int) int {
	raw := c.Query(key)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	if v < min {
		return min
	}
	if max > 0 && v > max {
		return max
	}
	return v
}

// totalPages computes the number of pages for a list response. It mirrors
// response.Paginate but avoids re-deriving per_page when the service has
// already normalised the page size.
func totalPages(total int64, pageSize int) int {
	if pageSize <= 0 {
		return 0
	}
	pages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		pages++
	}
	return pages
}
