package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// mockPaymentRepo implements repositories.PaymentRepository for testing.
type mockPaymentRepo struct {
	listPendingTransfersFn func(ctx context.Context, params *repositories.ListPaymentParams) ([]*models.Payment, int64, error)
}

func (m *mockPaymentRepo) Create(_ context.Context, _ *models.Payment) error { return nil }
func (m *mockPaymentRepo) GetByID(_ context.Context, _ uint) (*models.Payment, error) {
	return nil, nil
}
func (m *mockPaymentRepo) GetByOrderID(_ context.Context, _ uint) (*models.Payment, error) {
	return nil, nil
}
func (m *mockPaymentRepo) GetByTransactionID(_ context.Context, _ string) (*models.Payment, error) {
	return nil, nil
}
func (m *mockPaymentRepo) Update(_ context.Context, _ *models.Payment) error { return nil }
func (m *mockPaymentRepo) UpdateStatus(_ context.Context, _ uint, _ models.PaymentStatus) error {
	return nil
}
func (m *mockPaymentRepo) ListPendingTransfers(ctx context.Context, params *repositories.ListPaymentParams) ([]*models.Payment, int64, error) {
	if m.listPendingTransfersFn != nil {
		return m.listPendingTransfersFn(ctx, params)
	}
	return nil, 0, nil
}

// mockPaymentSvc implements services.PaymentService for handler tests.
type mockPaymentSvc struct {
	confirmTransferFn    func(ctx context.Context, req *services.TransferConfirmRequest) error
	rejectTransferFn     func(ctx context.Context, req *services.TransferRejectRequest) error
	batchConfirmFn       func(ctx context.Context, req *services.BatchTransferConfirmRequest) error
	lastConfirmReq       *services.TransferConfirmRequest
	lastRejectReq        *services.TransferRejectRequest
	lastBatchConfirmReq  *services.BatchTransferConfirmRequest
}

func (m *mockPaymentSvc) CreatePaymentSession(_ context.Context, _ uint) (*services.PaymentSession, error) {
	return nil, nil
}
func (m *mockPaymentSvc) ConfirmPayment(_ context.Context, _ *services.PaymentConfirmRequest) error {
	return nil
}
func (m *mockPaymentSvc) UploadTransferProof(_ context.Context, _ uint, _ multipart.File, _ *multipart.FileHeader) error {
	return nil
}
func (m *mockPaymentSvc) ConfirmTransferPayment(ctx context.Context, req *services.TransferConfirmRequest) error {
	m.lastConfirmReq = req
	if m.confirmTransferFn != nil {
		return m.confirmTransferFn(ctx, req)
	}
	return nil
}
func (m *mockPaymentSvc) RejectTransferPayment(ctx context.Context, req *services.TransferRejectRequest) error {
	m.lastRejectReq = req
	if m.rejectTransferFn != nil {
		return m.rejectTransferFn(ctx, req)
	}
	return nil
}
func (m *mockPaymentSvc) BatchConfirmTransfer(ctx context.Context, req *services.BatchTransferConfirmRequest) error {
	m.lastBatchConfirmReq = req
	if m.batchConfirmFn != nil {
		return m.batchConfirmFn(ctx, req)
	}
	return nil
}
func (m *mockPaymentSvc) GetPaymentByOrder(_ context.Context, _ uint) (*models.Payment, error) {
	return nil, nil
}

// newPaymentTestRouter sets up a gin engine with the response middleware and
// returns a PaymentHandler backed by the mock repo.
func newPaymentTestRouter() (*gin.Engine, *PaymentHandler, *mockPaymentRepo) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(response.Middleware())
	repo := &mockPaymentRepo{}
	h := NewPaymentHandler(nil, repo)
	return router, h, repo
}

// newPaymentTestRouterWithService sets up a gin engine with the response
// middleware and returns a PaymentHandler backed by both a mock service and
// mock repo. An optional adminID injects the user_id into gin context to
// simulate authenticated admin requests.
func newPaymentTestRouterWithService(adminID *uint) (*gin.Engine, *PaymentHandler, *mockPaymentSvc, *mockPaymentRepo) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(response.Middleware())
	if adminID != nil {
		id := *adminID
		router.Use(func(c *gin.Context) {
			c.Set("user_id", id)
			c.Next()
		})
	}
	repo := &mockPaymentRepo{}
	svc := &mockPaymentSvc{}
	h := NewPaymentHandler(svc, repo)
	return router, h, svc, repo
}

// paymentParsedResponse is a narrow view of response.Response for payment tests.
type paymentParsedResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *response.ErrorInfo `json:"error,omitempty"`
	Meta    *response.Meta  `json:"meta,omitempty"`
}

func decodePaymentResponse(t *testing.T, body *bytes.Buffer) paymentParsedResponse {
	t.Helper()
	var r paymentParsedResponse
	if err := json.Unmarshal(body.Bytes(), &r); err != nil {
		t.Fatalf("failed to decode response: %v - body: %s", err, body.String())
	}
	return r
}

// --- ListPendingTransfers ---

func TestPaymentHandler_ListPendingTransfers_Success(t *testing.T) {
	router, h, repo := newPaymentTestRouter()
	router.GET("/api/v1/admin/payments/transfer/pending", h.ListPendingTransfers)

	deadline := time.Now().UTC().Add(48 * time.Hour) // 48 hours from now
	repo.listPendingTransfersFn = func(_ context.Context, params *repositories.ListPaymentParams) ([]*models.Payment, int64, error) {
		if params.Limit != 20 {
			t.Fatalf("expected default limit=20, got %d", params.Limit)
		}
		if params.Offset != 0 {
			t.Fatalf("expected default offset=0, got %d", params.Offset)
		}
		return []*models.Payment{
			{
				BaseWithUpdate: models.BaseWithUpdate{ID: 1},
				OrderID:        10,
				Method:         models.PaymentMethodTransfer,
				Status:         models.PaymentStatusPending,
				Amount:         decimal.NewFromInt(100),
				Order: &models.Order{
					BaseWithUpdate:       models.BaseWithUpdate{ID: 10},
					OrderNumber:          "ORD-001",
					Status:               models.OrderStatusPendingTransfer,
					ConfirmationDeadline: &deadline,
				},
			},
		}, 1, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/payments/transfer/pending", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	got := decodePaymentResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if got.Meta == nil || got.Meta.Total != 1 {
		t.Fatalf("unexpected meta: %+v", got.Meta)
	}

	// Parse the data array to check remaining_seconds
	var items []struct {
		ID               uint   `json:"id"`
		RemainingSeconds int64  `json:"remaining_seconds"`
		Order            *struct {
			OrderNumber string `json:"order_number"`
		} `json:"order"`
	}
	if err := json.Unmarshal(got.Data, &items); err != nil {
		t.Fatalf("failed to parse data: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].ID != 1 {
		t.Fatalf("expected payment id=1, got %d", items[0].ID)
	}
	// remaining_seconds should be approximately 48 hours (172800 seconds)
	// Allow a 60 second tolerance for test execution time
	if items[0].RemainingSeconds < 172700 || items[0].RemainingSeconds > 172900 {
		t.Fatalf("expected remaining_seconds ~172800, got %d", items[0].RemainingSeconds)
	}
	if items[0].Order == nil || items[0].Order.OrderNumber != "ORD-001" {
		t.Fatalf("expected order with number ORD-001, got %+v", items[0].Order)
	}
}

func TestPaymentHandler_ListPendingTransfers_ExpiredDeadline(t *testing.T) {
	router, h, repo := newPaymentTestRouter()
	router.GET("/api/v1/admin/payments/transfer/pending", h.ListPendingTransfers)

	// Deadline already passed
	deadline := time.Now().UTC().Add(-2 * time.Hour)
	repo.listPendingTransfersFn = func(_ context.Context, _ *repositories.ListPaymentParams) ([]*models.Payment, int64, error) {
		return []*models.Payment{
			{
				BaseWithUpdate: models.BaseWithUpdate{ID: 2},
				OrderID:        20,
				Method:         models.PaymentMethodTransfer,
				Status:         models.PaymentStatusPending,
				Amount:         decimal.NewFromInt(50),
				Order: &models.Order{
					BaseWithUpdate:       models.BaseWithUpdate{ID: 20},
					OrderNumber:          "ORD-002",
					Status:               models.OrderStatusPendingTransfer,
					ConfirmationDeadline: &deadline,
				},
			},
		}, 1, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/payments/transfer/pending", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	got := decodePaymentResponse(t, w.Body)
	var items []struct {
		RemainingSeconds int64 `json:"remaining_seconds"`
	}
	if err := json.Unmarshal(got.Data, &items); err != nil {
		t.Fatalf("failed to parse data: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	// Expired deadline should result in remaining_seconds = 0
	if items[0].RemainingSeconds != 0 {
		t.Fatalf("expected remaining_seconds=0 for expired deadline, got %d", items[0].RemainingSeconds)
	}
}

func TestPaymentHandler_ListPendingTransfers_NilDeadline(t *testing.T) {
	router, h, repo := newPaymentTestRouter()
	router.GET("/api/v1/admin/payments/transfer/pending", h.ListPendingTransfers)

	repo.listPendingTransfersFn = func(_ context.Context, _ *repositories.ListPaymentParams) ([]*models.Payment, int64, error) {
		return []*models.Payment{
			{
				BaseWithUpdate: models.BaseWithUpdate{ID: 3},
				OrderID:        30,
				Method:         models.PaymentMethodTransfer,
				Status:         models.PaymentStatusPending,
				Amount:         decimal.NewFromInt(75),
				Order: &models.Order{
					BaseWithUpdate:       models.BaseWithUpdate{ID: 30},
					OrderNumber:          "ORD-003",
					Status:               models.OrderStatusPendingTransfer,
					ConfirmationDeadline: nil, // No deadline set
				},
			},
		}, 1, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/payments/transfer/pending", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	got := decodePaymentResponse(t, w.Body)
	var items []struct {
		RemainingSeconds int64 `json:"remaining_seconds"`
	}
	if err := json.Unmarshal(got.Data, &items); err != nil {
		t.Fatalf("failed to parse data: %v", err)
	}
	if items[0].RemainingSeconds != 0 {
		t.Fatalf("expected remaining_seconds=0 for nil deadline, got %d", items[0].RemainingSeconds)
	}
}

func TestPaymentHandler_ListPendingTransfers_Pagination(t *testing.T) {
	router, h, repo := newPaymentTestRouter()
	router.GET("/api/v1/admin/payments/transfer/pending", h.ListPendingTransfers)

	repo.listPendingTransfersFn = func(_ context.Context, params *repositories.ListPaymentParams) ([]*models.Payment, int64, error) {
		if params.Limit != 10 {
			t.Fatalf("expected limit=10, got %d", params.Limit)
		}
		if params.Offset != 20 {
			t.Fatalf("expected offset=20, got %d", params.Offset)
		}
		return []*models.Payment{}, 50, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/payments/transfer/pending?limit=10&offset=20", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	got := decodePaymentResponse(t, w.Body)
	if got.Meta == nil {
		t.Fatalf("expected meta to be present")
	}
	if got.Meta.Total != 50 {
		t.Fatalf("expected total=50, got %d", got.Meta.Total)
	}
	if got.Meta.Page != 3 {
		t.Fatalf("expected page=3 (offset 20 / limit 10 + 1), got %d", got.Meta.Page)
	}
	if got.Meta.PerPage != 10 {
		t.Fatalf("expected per_page=10, got %d", got.Meta.PerPage)
	}
	if got.Meta.TotalPages != 5 {
		t.Fatalf("expected total_pages=5, got %d", got.Meta.TotalPages)
	}
}

func TestPaymentHandler_ListPendingTransfers_EmptyList(t *testing.T) {
	router, h, repo := newPaymentTestRouter()
	router.GET("/api/v1/admin/payments/transfer/pending", h.ListPendingTransfers)

	repo.listPendingTransfersFn = func(_ context.Context, _ *repositories.ListPaymentParams) ([]*models.Payment, int64, error) {
		return []*models.Payment{}, 0, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/payments/transfer/pending", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	got := decodePaymentResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if got.Meta == nil || got.Meta.Total != 0 {
		t.Fatalf("expected total=0, got %+v", got.Meta)
	}
}


// --- ConfirmTransfer ---

func TestPaymentHandler_ConfirmTransfer_Success(t *testing.T) {
	adminID := uint(99)
	router, h, svc, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/confirm", h.ConfirmTransfer)

	body := `{"received_amount": "150.50", "notes": "verified via bank statement"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/42/confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodePaymentResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}

	// Verify the service received the correct request
	if svc.lastConfirmReq == nil {
		t.Fatal("expected service to be called")
	}
	if svc.lastConfirmReq.PaymentID != 42 {
		t.Fatalf("expected payment_id=42, got %d", svc.lastConfirmReq.PaymentID)
	}
	if svc.lastConfirmReq.AdminID != 99 {
		t.Fatalf("expected admin_id=99, got %d", svc.lastConfirmReq.AdminID)
	}
	expectedAmount := decimal.NewFromFloat(150.50)
	if !svc.lastConfirmReq.ReceivedAmount.Equal(expectedAmount) {
		t.Fatalf("expected received_amount=%s, got %s", expectedAmount, svc.lastConfirmReq.ReceivedAmount)
	}
	if svc.lastConfirmReq.Notes != "verified via bank statement" {
		t.Fatalf("expected notes='verified via bank statement', got %q", svc.lastConfirmReq.Notes)
	}
}

func TestPaymentHandler_ConfirmTransfer_Unauthenticated(t *testing.T) {
	// No admin ID in context
	router, h, _, _ := newPaymentTestRouterWithService(nil)
	router.POST("/api/v1/admin/payments/transfer/:id/confirm", h.ConfirmTransfer)

	body := `{"received_amount": "100.00"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/1/confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_ConfirmTransfer_InvalidPaymentID(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/confirm", h.ConfirmTransfer)

	body := `{"received_amount": "100.00"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/abc/confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_ConfirmTransfer_InvalidBody(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/confirm", h.ConfirmTransfer)

	body := `{invalid json}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/1/confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_ConfirmTransfer_ServiceError_NotFound(t *testing.T) {
	adminID := uint(1)
	router, h, svc, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/confirm", h.ConfirmTransfer)

	svc.confirmTransferFn = func(_ context.Context, _ *services.TransferConfirmRequest) error {
		return fmt.Errorf("failed to load payment: %w", repositories.ErrPaymentNotFound)
	}

	body := `{"received_amount": "100.00"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/999/confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_ConfirmTransfer_ServiceError_NotReviewable(t *testing.T) {
	adminID := uint(1)
	router, h, svc, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/confirm", h.ConfirmTransfer)

	svc.confirmTransferFn = func(_ context.Context, _ *services.TransferConfirmRequest) error {
		return fmt.Errorf("%w: status=succeeded", services.ErrTransferNotReviewable)
	}

	body := `{"received_amount": "100.00"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/5/confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// --- RejectTransfer ---

func TestPaymentHandler_RejectTransfer_Success(t *testing.T) {
	adminID := uint(55)
	router, h, svc, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/reject", h.RejectTransfer)

	body := `{"reason": "proof image is blurry and unreadable"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/7/reject", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodePaymentResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}

	if svc.lastRejectReq == nil {
		t.Fatal("expected service to be called")
	}
	if svc.lastRejectReq.PaymentID != 7 {
		t.Fatalf("expected payment_id=7, got %d", svc.lastRejectReq.PaymentID)
	}
	if svc.lastRejectReq.AdminID != 55 {
		t.Fatalf("expected admin_id=55, got %d", svc.lastRejectReq.AdminID)
	}
	if svc.lastRejectReq.Reason != "proof image is blurry and unreadable" {
		t.Fatalf("expected reason='proof image is blurry and unreadable', got %q", svc.lastRejectReq.Reason)
	}
}

func TestPaymentHandler_RejectTransfer_Unauthenticated(t *testing.T) {
	router, h, _, _ := newPaymentTestRouterWithService(nil)
	router.POST("/api/v1/admin/payments/transfer/:id/reject", h.RejectTransfer)

	body := `{"reason": "invalid"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/1/reject", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_RejectTransfer_InvalidPaymentID(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/reject", h.RejectTransfer)

	body := `{"reason": "test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/xyz/reject", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_RejectTransfer_InvalidBody(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/reject", h.RejectTransfer)

	body := `not json`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/1/reject", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_RejectTransfer_ServiceError_NotReviewable(t *testing.T) {
	adminID := uint(1)
	router, h, svc, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/:id/reject", h.RejectTransfer)

	svc.rejectTransferFn = func(_ context.Context, _ *services.TransferRejectRequest) error {
		return fmt.Errorf("%w: status=succeeded", services.ErrTransferNotReviewable)
	}

	body := `{"reason": "test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/5/reject", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// --- BatchConfirmTransfer ---

func TestPaymentHandler_BatchConfirmTransfer_Success(t *testing.T) {
	adminID := uint(77)
	router, h, svc, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/batch-confirm", h.BatchConfirmTransfer)

	body := `{
		"items": [
			{"payment_id": 10, "received_amount": "100.00", "notes": "ok"},
			{"payment_id": 20, "received_amount": "200.50"}
		]
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/batch-confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodePaymentResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}

	// Verify the data contains count
	var data map[string]interface{}
	if err := json.Unmarshal(got.Data, &data); err != nil {
		t.Fatalf("failed to parse data: %v", err)
	}
	if count, ok := data["count"].(float64); !ok || int(count) != 2 {
		t.Fatalf("expected count=2, got %v", data["count"])
	}

	// Verify service received correct request
	if svc.lastBatchConfirmReq == nil {
		t.Fatal("expected service to be called")
	}
	if svc.lastBatchConfirmReq.AdminID != 77 {
		t.Fatalf("expected admin_id=77, got %d", svc.lastBatchConfirmReq.AdminID)
	}
	if len(svc.lastBatchConfirmReq.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(svc.lastBatchConfirmReq.Items))
	}
	// All items should have admin_id set from context
	for i, item := range svc.lastBatchConfirmReq.Items {
		if item.AdminID != 77 {
			t.Fatalf("item %d: expected admin_id=77, got %d", i, item.AdminID)
		}
	}
	if svc.lastBatchConfirmReq.Items[0].PaymentID != 10 {
		t.Fatalf("expected first item payment_id=10, got %d", svc.lastBatchConfirmReq.Items[0].PaymentID)
	}
	if svc.lastBatchConfirmReq.Items[1].PaymentID != 20 {
		t.Fatalf("expected second item payment_id=20, got %d", svc.lastBatchConfirmReq.Items[1].PaymentID)
	}
}

func TestPaymentHandler_BatchConfirmTransfer_Unauthenticated(t *testing.T) {
	router, h, _, _ := newPaymentTestRouterWithService(nil)
	router.POST("/api/v1/admin/payments/transfer/batch-confirm", h.BatchConfirmTransfer)

	body := `{"items": [{"payment_id": 1, "received_amount": "100.00"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/batch-confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_BatchConfirmTransfer_EmptyItems(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/batch-confirm", h.BatchConfirmTransfer)

	body := `{"items": []}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/batch-confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_BatchConfirmTransfer_InvalidBody(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/batch-confirm", h.BatchConfirmTransfer)

	body := `{broken`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/batch-confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentHandler_BatchConfirmTransfer_ServiceError(t *testing.T) {
	adminID := uint(1)
	router, h, svc, _ := newPaymentTestRouterWithService(&adminID)
	router.POST("/api/v1/admin/payments/transfer/batch-confirm", h.BatchConfirmTransfer)

	svc.batchConfirmFn = func(_ context.Context, _ *services.BatchTransferConfirmRequest) error {
		return fmt.Errorf("item 0: %w: status=succeeded", services.ErrTransferNotReviewable)
	}

	body := `{"items": [{"payment_id": 1, "received_amount": "100.00"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payments/transfer/batch-confirm", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
