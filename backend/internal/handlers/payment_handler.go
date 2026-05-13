package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/middleware"
	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// PaymentHandler exposes the HTTP endpoints for the payment subsystem
// (Requirements 9.x, 10.x, 12.x, 13.x). It owns both the customer-facing
// routes (create online session, upload transfer proof, Stripe webhook)
// and the admin-facing transfer review routes.
type PaymentHandler struct {
	paymentService services.PaymentService
	paymentRepo    repositories.PaymentRepository
}

// NewPaymentHandler constructs a PaymentHandler backed by the given
// service and repository. The repository is used directly for the admin
// pending-transfer listing (Requirement 12.1), following the same pattern
// as CategoryHandler for simple read-only views that do not need service
// orchestration.
func NewPaymentHandler(
	paymentService services.PaymentService,
	paymentRepo repositories.PaymentRepository,
) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
		paymentRepo:    paymentRepo,
	}
}

// --- Customer-facing endpoints -----------------------------------------

// createOnlineSessionRequest is the JSON payload accepted by
// POST /api/v1/payments/online/session.
type createOnlineSessionRequest struct {
	OrderID uint `json:"order_id"`
}

// CreateOnlinePaymentSession handles POST /api/v1/payments/online/session.
// It creates a Stripe Checkout Session for the given order and returns the
// URL the frontend should redirect the customer to (Requirements 9.1, 9.2).
//
// @Summary      Create online payment session
// @Description  Creates a Stripe Checkout Session for an order paying online.
// @Tags         Payments
// @Accept       json
// @Produce      json
// @Param        request body createOnlineSessionRequest true "Order to pay"
// @Success      200 {object} response.Response{data=services.PaymentSession}
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/payments/online/session [post]
func (h *PaymentHandler) CreateOnlinePaymentSession(c *gin.Context) {
	var req createOnlineSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request body", err.Error())
		return
	}
	if req.OrderID == 0 {
		response.BadRequest(c, "order_id is required")
		return
	}

	session, err := h.paymentService.CreatePaymentSession(c.Request.Context(), req.OrderID)
	if err != nil {
		writePaymentServiceError(c, err)
		return
	}

	response.Success(c, session)
}

// StripeWebhook handles POST /api/v1/payments/webhook/stripe. The handler
// reads the raw body (preserved byte-for-byte for HMAC-SHA256 verification,
// Requirement 9.5) plus the Stripe-Signature header and hands them to the
// service. We deliberately do not return 200 until the service call
// succeeds so Stripe knows to retry on transient failures.
//
// Response codes:
//   - 200 OK on successful processing (including silently ignored events)
//   - 400 Bad Request on signature or payload validation errors
//   - 500 Internal Server Error on everything else (Stripe will retry)
//
// @Summary      Stripe webhook
// @Description  Receives payment status notifications from Stripe.
// @Tags         Payments
// @Accept       json
// @Produce      json
// @Success      200 {string} string "ok"
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/payments/webhook/stripe [post]
func (h *PaymentHandler) StripeWebhook(c *gin.Context) {
	// Read the raw request body. GetRawData drains c.Request.Body which
	// is the only way to preserve the exact bytes Stripe signed; any
	// prior c.Bind / c.ShouldBindJSON call would mutate or consume the
	// body and break signature verification.
	payload, err := c.GetRawData()
	if err != nil {
		response.BadRequest(c, "failed to read webhook payload", err.Error())
		return
	}

	signature := c.GetHeader("Stripe-Signature")

	req := &services.PaymentConfirmRequest{
		Payload:   payload,
		Signature: signature,
	}

	if err := h.paymentService.ConfirmPayment(c.Request.Context(), req); err != nil {
		// Signature / payload problems are client errors; anything else
		// is a server error so Stripe retries the webhook.
		if errors.Is(err, services.ErrInvalidWebhookSignature) ||
			errors.Is(err, services.ErrInvalidWebhookPayload) {
			response.BadRequest(c, "invalid webhook", err.Error())
			return
		}
		response.InternalError(c, "failed to process webhook", err.Error())
		return
	}

	// Stripe expects a 2xx response to consider the webhook delivered.
	// Return a minimal plain-text 200 rather than the wrapped Response
	// envelope so the body stays tiny and matches Stripe's examples.
	c.String(http.StatusOK, "ok")
}

// UploadTransferProof handles POST /api/v1/payments/transfer/upload. The
// endpoint accepts a multipart/form-data request with fields:
//   - order_id  (integer, form field)
//   - file      (the proof image or PDF)
//
// The service validates the order state, file size, and file format
// (Requirements 10.1-10.8), persists the file via the configured
// FileStorage backend, and transitions the order to "pending_transfer".
//
// @Summary      Upload transfer proof
// @Description  Uploads a payment transfer proof (image or PDF) for an order.
// @Tags         Payments
// @Accept       multipart/form-data
// @Produce      json
// @Param        order_id formData int  true "Order ID"
// @Param        file     formData file true "Transfer proof file (JPEG, PNG, PDF; max 10MB)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/payments/transfer/upload [post]
func (h *PaymentHandler) UploadTransferProof(c *gin.Context) {
	orderIDStr := c.PostForm("order_id")
	orderID, err := strconv.ParseUint(orderIDStr, 10, 32)
	if err != nil || orderID == 0 {
		response.BadRequest(c, "order_id is required")
		return
	}

	header, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "file is required", err.Error())
		return
	}
	file, err := header.Open()
	if err != nil {
		response.BadRequest(c, "failed to open uploaded file", err.Error())
		return
	}
	defer file.Close()

	if err := h.paymentService.UploadTransferProof(
		c.Request.Context(),
		uint(orderID),
		file,
		header,
	); err != nil {
		writePaymentServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "transfer proof uploaded"})
}

// --- Admin-facing endpoints --------------------------------------------

// pendingTransferResponse is the enriched response item for the pending
// transfer list. It wraps the raw Payment model and adds the computed
// remaining_seconds field required by Requirement 12.2 (display remaining
// time until confirmation deadline).
type pendingTransferResponse struct {
	*models.Payment
	RemainingSeconds int64 `json:"remaining_seconds"`
}

// ListPendingTransfers handles GET /api/v1/admin/payments/transfer/pending.
// It returns transfer payments awaiting admin review (Requirement 12.1).
// Each item includes remaining_seconds indicating how many seconds remain
// until the confirmation deadline expires (Requirement 12.2). A value of 0
// means the deadline has already passed.
// Pagination uses limit / offset query parameters consistent with the rest
// of the admin surface (Requirement 30.5).
//
// @Summary      List pending transfer payments
// @Description  Returns the paginated list of transfer payments awaiting admin review with remaining confirmation time.
// @Tags         AdminPayments
// @Produce      json
// @Param        limit  query int false "Page size (1-100, default 20)"
// @Param        offset query int false "Offset (default 0)"
// @Success      200 {object} response.Response
// @Failure      401 {object} response.Response
// @Failure      403 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/payments/transfer/pending [get]
// @Security     BearerAuth
func (h *PaymentHandler) ListPendingTransfers(c *gin.Context) {
	limit := parseIntQuery(c, "limit", 20, 1, 100)
	offset := parseIntQuery(c, "offset", 0, 0, 0)

	params := &repositories.ListPaymentParams{
		Limit:     limit,
		Offset:    offset,
		SortBy:    c.Query("sort_by"),
		SortOrder: c.Query("sort_order"),
	}

	payments, total, err := h.paymentRepo.ListPendingTransfers(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to list pending transfers", err.Error())
		return
	}

	// Build enriched response with remaining confirmation time
	// (Requirement 12.2).
	now := time.Now().UTC()
	items := make([]pendingTransferResponse, len(payments))
	for i, p := range payments {
		var remaining int64
		if p.Order != nil && p.Order.ConfirmationDeadline != nil {
			diff := p.Order.ConfirmationDeadline.Sub(now)
			if diff > 0 {
				remaining = int64(diff.Seconds())
			}
		}
		items[i] = pendingTransferResponse{
			Payment:          p,
			RemainingSeconds: remaining,
		}
	}

	page := offset/limit + 1
	meta := &response.Meta{
		Page:       page,
		PerPage:    limit,
		Total:      total,
		TotalPages: totalPages(total, limit),
	}
	response.SuccessWithMeta(c, items, meta)
}

// confirmTransferRequest is the JSON payload accepted by the admin confirm
// endpoint. received_amount accepts any format decimal.Decimal supports
// (bare number or string), so "99.95" and 99.95 both work.
type confirmTransferRequest struct {
	ReceivedAmount decimal.Decimal `json:"received_amount"`
	Notes          string          `json:"notes"`
}

// ConfirmTransfer handles POST /api/v1/admin/payments/transfer/:id/confirm.
// The admin id is derived from the authentication context populated by
// AuthMiddleware (Requirements 12.7, 13.7).
//
// @Summary      Confirm transfer payment
// @Description  Marks a transfer payment as received and transitions the order to "paid".
// @Tags         AdminPayments
// @Accept       json
// @Produce      json
// @Param        id      path int                    true  "Payment ID"
// @Param        request body confirmTransferRequest true  "Confirmation payload"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      401 {object} response.Response
// @Failure      403 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /api/v1/admin/payments/transfer/{id}/confirm [post]
// @Security     BearerAuth
func (h *PaymentHandler) ConfirmTransfer(c *gin.Context) {
	adminID, ok := middleware.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "authentication required")
		return
	}

	paymentID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid payment id")
		return
	}

	var body confirmTransferRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "invalid request body", err.Error())
		return
	}

	req := &services.TransferConfirmRequest{
		PaymentID:      paymentID,
		ReceivedAmount: body.ReceivedAmount,
		AdminID:        adminID,
		Notes:          body.Notes,
	}

	if err := h.paymentService.ConfirmTransferPayment(c.Request.Context(), req); err != nil {
		writePaymentServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "transfer confirmed"})
}

// rejectTransferRequest is the JSON payload accepted by the admin reject
// endpoint.
type rejectTransferRequest struct {
	Reason string `json:"reason"`
}

// RejectTransfer handles POST /api/v1/admin/payments/transfer/:id/reject.
//
// @Summary      Reject transfer payment
// @Description  Rejects a transfer payment and transitions the order to "payment_failed".
// @Tags         AdminPayments
// @Accept       json
// @Produce      json
// @Param        id      path int                   true  "Payment ID"
// @Param        request body rejectTransferRequest true  "Rejection payload"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      401 {object} response.Response
// @Failure      403 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /api/v1/admin/payments/transfer/{id}/reject [post]
// @Security     BearerAuth
func (h *PaymentHandler) RejectTransfer(c *gin.Context) {
	adminID, ok := middleware.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "authentication required")
		return
	}

	paymentID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid payment id")
		return
	}

	var body rejectTransferRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "invalid request body", err.Error())
		return
	}

	req := &services.TransferRejectRequest{
		PaymentID: paymentID,
		AdminID:   adminID,
		Reason:    body.Reason,
	}

	if err := h.paymentService.RejectTransferPayment(c.Request.Context(), req); err != nil {
		writePaymentServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "transfer rejected"})
}

// batchConfirmItem mirrors services.TransferConfirmRequest but excludes
// admin_id so clients cannot forge the confirming administrator; the admin
// id is taken from the authentication context.
type batchConfirmItem struct {
	PaymentID      uint            `json:"payment_id"`
	ReceivedAmount decimal.Decimal `json:"received_amount"`
	Notes          string          `json:"notes"`
}

// batchConfirmRequest is the JSON payload accepted by the admin batch
// confirm endpoint.
type batchConfirmRequest struct {
	Items []batchConfirmItem `json:"items"`
}

// BatchConfirmTransfer handles POST /api/v1/admin/payments/transfer/batch-confirm.
// All items in the batch are applied inside a single transaction
// (Requirements 13.4, 13.5, 13.7).
//
// @Summary      Batch confirm transfer payments
// @Description  Confirms multiple transfer payments atomically.
// @Tags         AdminPayments
// @Accept       json
// @Produce      json
// @Param        request body batchConfirmRequest true "Batch confirmation payload"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      401 {object} response.Response
// @Failure      403 {object} response.Response
// @Router       /api/v1/admin/payments/transfer/batch-confirm [post]
// @Security     BearerAuth
func (h *PaymentHandler) BatchConfirmTransfer(c *gin.Context) {
	adminID, ok := middleware.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "authentication required")
		return
	}

	var body batchConfirmRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "invalid request body", err.Error())
		return
	}
	if len(body.Items) == 0 {
		response.BadRequest(c, "items must not be empty")
		return
	}

	items := make([]services.TransferConfirmRequest, len(body.Items))
	for i, item := range body.Items {
		items[i] = services.TransferConfirmRequest{
			PaymentID:      item.PaymentID,
			ReceivedAmount: item.ReceivedAmount,
			AdminID:        adminID,
			Notes:          item.Notes,
		}
	}

	req := &services.BatchTransferConfirmRequest{
		Items:   items,
		AdminID: adminID,
	}

	if err := h.paymentService.BatchConfirmTransfer(c.Request.Context(), req); err != nil {
		writePaymentServiceError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "batch confirmed", "count": len(body.Items)})
}

// --- error translation -------------------------------------------------

// writePaymentServiceError maps the well-known sentinel errors from the
// payment service onto appropriate HTTP responses.
func writePaymentServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrOrderNotFound),
		errors.Is(err, repositories.ErrPaymentNotFound):
		response.NotFound(c, "resource not found", err.Error())
	case errors.Is(err, services.ErrInvalidWebhookSignature),
		errors.Is(err, services.ErrInvalidWebhookPayload):
		response.BadRequest(c, "invalid webhook", err.Error())
	case errors.Is(err, services.ErrOrderNotPayable),
		errors.Is(err, services.ErrInvalidPaymentMethodForOnline),
		errors.Is(err, services.ErrInvalidPaymentMethodForTransfer),
		errors.Is(err, services.ErrOrderNotAwaitingTransfer),
		errors.Is(err, services.ErrTransferNotReviewable),
		errors.Is(err, services.ErrTransferProofTooLarge),
		errors.Is(err, services.ErrTransferProofFormat):
		response.BadRequest(c, err.Error())
	case errors.Is(err, services.ErrPaymentConfigMissing),
		errors.Is(err, services.ErrFileStorageNotConfigured):
		response.InternalError(c, "payment service misconfigured", err.Error())
	default:
		response.InternalError(c, "payment operation failed", err.Error())
	}
}
