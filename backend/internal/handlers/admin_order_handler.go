package handlers

import (
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// AdminOrderHandler handles admin order management HTTP requests.
// It provides endpoints for listing, viewing, updating, cancelling, and
// exporting orders (Requirements 16.1-16.9).
type AdminOrderHandler struct {
	orderService services.OrderService
}

// NewAdminOrderHandler creates a new AdminOrderHandler.
func NewAdminOrderHandler(orderService services.OrderService) *AdminOrderHandler {
	return &AdminOrderHandler{orderService: orderService}
}

// shipOrderRequest carries the shipping carrier and tracking number for the
// ship order endpoint (Requirements 16.3, 16.4).
type shipOrderRequest struct {
	ShippingCarrier string `json:"shipping_carrier" binding:"required"`
	TrackingNumber  string `json:"tracking_number" binding:"required"`
}

// adminCancelOrderRequest carries an optional cancellation reason for admin
// order cancellation.
type adminCancelOrderRequest struct {
	Reason string `json:"reason"`
}

// ListAllOrders handles GET /api/v1/admin/orders.
// Returns a paginated list of all orders with filtering by status, date
// range, payment method, and customer information (Requirement 16.1).
// @Summary      List all orders (admin)
// @Description  Returns paginated order list with admin-level filtering.
// @Tags         Admin Orders
// @Produce      json
// @Param        page           query int    false "Page number (default 1)"
// @Param        page_size      query int    false "Page size (1-100, default 20)"
// @Param        status         query string false "Order status filter"
// @Param        payment_method query string false "Payment method filter (online, transfer)"
// @Param        search         query string false "Search by order number or email"
// @Param        start_date     query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date       query string false "End date (YYYY-MM-DD or RFC3339)"
// @Param        sort_by        query string false "Sort field (created_at, updated_at, total_amount, order_number)"
// @Param        sort_order     query string false "Sort order (asc or desc)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      401 {object} response.Response
// @Failure      403 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/orders [get]
// @Security     BearerAuth
func (h *AdminOrderHandler) ListAllOrders(c *gin.Context) {
	req := &services.AdminListOrdersRequest{
		Page:          parseIntQuery(c, "page", 1, 1, 0),
		PageSize:      parseIntQuery(c, "page_size", 20, 1, 100),
		Status:        c.Query("status"),
		PaymentMethod: c.Query("payment_method"),
		Search:        c.Query("search"),
		StartDate:     c.Query("start_date"),
		EndDate:       c.Query("end_date"),
		SortBy:        c.Query("sort_by"),
		SortOrder:     c.Query("sort_order"),
	}

	result, err := h.orderService.ListAllOrders(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidOrderStatus) || errors.Is(err, services.ErrInvalidPaymentMethod) {
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

// GetOrder handles GET /api/v1/admin/orders/:id.
// Returns detailed order information including customer details, items,
// and payment information (Requirement 16.2).
// @Summary      Get order detail (admin)
// @Description  Returns detailed order information for admin view.
// @Tags         Admin Orders
// @Produce      json
// @Param        id path int true "Order ID"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/orders/{id} [get]
// @Security     BearerAuth
func (h *AdminOrderHandler) GetOrder(c *gin.Context) {
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

	response.Success(c, order)
}

// UpdateStatus handles PUT /api/v1/admin/orders/:id/status.
// Updates order status with validation. When updating to "shipped",
// shipping carrier and tracking number are required (Requirements 16.3, 16.4).
// Sends notification email on status change (Requirement 16.6).
// @Summary      Update order status (admin)
// @Description  Updates order status. Requires shipping details for shipped status.
// @Tags         Admin Orders
// @Accept       json
// @Produce      json
// @Param        id      path int                          true "Order ID"
// @Param        request body services.AdminUpdateStatusRequest true "Status update payload"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/orders/{id}/status [put]
// @Security     BearerAuth
func (h *AdminOrderHandler) UpdateStatus(c *gin.Context) {
	orderID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid order id")
		return
	}

	var req services.AdminUpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request body", err.Error())
		return
	}

	if req.Status == "" {
		response.BadRequest(c, "status is required")
		return
	}

	err := h.orderService.AdminUpdateOrderStatus(c.Request.Context(), orderID, &req)
	if err != nil {
		writeAdminOrderServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "order status updated"})
}

// CancelOrder handles POST /api/v1/admin/orders/:id/cancel.
// Cancels an order with status pending_payment or pending_transfer
// (Requirement 16.5). Restores inventory and sends cancellation email.
// @Summary      Cancel order (admin)
// @Description  Cancels an order. Only pending_payment or pending_transfer orders can be cancelled.
// @Tags         Admin Orders
// @Accept       json
// @Produce      json
// @Param        id      path int                     true  "Order ID"
// @Param        request body adminCancelOrderRequest false "Optional reason"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/orders/{id}/cancel [post]
// @Security     BearerAuth
func (h *AdminOrderHandler) CancelOrder(c *gin.Context) {
	orderID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid order id")
		return
	}

	var req adminCancelOrderRequest
	_ = c.ShouldBindJSON(&req)

	err := h.orderService.AdminCancelOrder(c.Request.Context(), orderID, req.Reason)
	if err != nil {
		writeAdminOrderServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "order cancelled"})
}

// ShipOrder handles POST /api/v1/admin/orders/:id/ship.
// Updates order status to "shipped" and records shipping carrier and tracking
// number. Sends a shipping notification email to the customer.
// This is a convenience endpoint that wraps the status update with
// shipping-specific validation (Requirements 16.3, 16.4, 21.3).
// @Summary      Ship order (admin)
// @Description  Updates order to shipped status with carrier and tracking number.
// @Tags         Admin Orders
// @Accept       json
// @Produce      json
// @Param        id      path int              true "Order ID"
// @Param        request body shipOrderRequest  true "Shipping details"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/orders/{id}/ship [post]
// @Security     BearerAuth
func (h *AdminOrderHandler) ShipOrder(c *gin.Context) {
	orderID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid order id")
		return
	}

	var req shipOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "shipping_carrier and tracking_number are required", err.Error())
		return
	}

	if strings.TrimSpace(req.ShippingCarrier) == "" {
		response.BadRequest(c, "shipping_carrier is required")
		return
	}
	if strings.TrimSpace(req.TrackingNumber) == "" {
		response.BadRequest(c, "tracking_number is required")
		return
	}

	// Delegate to AdminUpdateOrderStatus which handles status transition
	// validation, shipping detail persistence, and notification dispatch.
	statusReq := &services.AdminUpdateStatusRequest{
		Status:          "shipped",
		ShippingCarrier: req.ShippingCarrier,
		TrackingNumber:  req.TrackingNumber,
	}

	err := h.orderService.AdminUpdateOrderStatus(c.Request.Context(), orderID, statusReq)
	if err != nil {
		writeAdminOrderServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "order shipped successfully"})
}

// ExportOrders handles GET /api/v1/admin/orders/export.
// Exports orders to CSV format (Requirement 16.8). The CSV includes order
// number, customer info, items, total, status, and dates.
// @Summary      Export orders to CSV (admin)
// @Description  Exports filtered orders to CSV format.
// @Tags         Admin Orders
// @Produce      text/csv
// @Param        status         query string false "Order status filter"
// @Param        payment_method query string false "Payment method filter"
// @Param        search         query string false "Search by order number or email"
// @Param        start_date     query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date       query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {file} file "CSV file"
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/orders/export [get]
// @Security     BearerAuth
func (h *AdminOrderHandler) ExportOrders(c *gin.Context) {
	// Use a large page size to export all matching orders.
	req := &services.AdminListOrdersRequest{
		Page:          1,
		PageSize:      10000,
		Status:        c.Query("status"),
		PaymentMethod: c.Query("payment_method"),
		Search:        c.Query("search"),
		StartDate:     c.Query("start_date"),
		EndDate:       c.Query("end_date"),
		SortBy:        "created_at",
		SortOrder:     "desc",
	}

	result, err := h.orderService.ListAllOrders(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidOrderStatus) || errors.Is(err, services.ErrInvalidPaymentMethod) {
			response.BadRequest(c, err.Error())
			return
		}
		response.InternalError(c, "failed to export orders", err.Error())
		return
	}

	// Set CSV response headers.
	filename := fmt.Sprintf("orders_export_%s.csv", time.Now().Format("20060102_150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Status(http.StatusOK)

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write CSV header.
	header := []string{
		"Order Number",
		"Customer Name",
		"Customer Email",
		"Customer Phone",
		"Items",
		"Subtotal",
		"Shipping Fee",
		"Total Amount",
		"Payment Method",
		"Status",
		"Created At",
		"Updated At",
	}
	if err := writer.Write(header); err != nil {
		return
	}

	// Write order rows.
	for _, order := range result.Orders {
		customerName := order.GuestName
		customerEmail := order.GuestEmail
		customerPhone := order.GuestPhone
		if order.User != nil {
			customerName = order.User.FullName
			customerEmail = order.User.Email
			if order.User.Phone != "" {
				customerPhone = order.User.Phone
			}
		}

		// Build items summary.
		var itemParts []string
		for _, item := range order.Items {
			itemParts = append(itemParts, fmt.Sprintf("%s x%d", item.SKUName, item.Quantity))
		}
		itemsSummary := strings.Join(itemParts, "; ")

		row := []string{
			order.OrderNumber,
			customerName,
			customerEmail,
			customerPhone,
			itemsSummary,
			order.Subtotal.String(),
			order.ShippingFee.String(),
			order.TotalAmount.String(),
			string(order.PaymentMethod),
			string(order.Status),
			order.CreatedAt.Format(time.RFC3339),
			order.UpdatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(row); err != nil {
			return
		}
	}
}

// writeAdminOrderServiceError maps order service errors to HTTP responses
// for admin endpoints.
func writeAdminOrderServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrOrderNotFound):
		response.NotFound(c, "order not found")
	case errors.Is(err, services.ErrInvalidOrderStatus),
		errors.Is(err, services.ErrInvalidStatusTransition),
		errors.Is(err, services.ErrOrderNotCancellable),
		errors.Is(err, services.ErrInvalidPaymentMethod):
		response.BadRequest(c, err.Error())
	default:
		response.InternalError(c, "order operation failed", err.Error())
	}
}
