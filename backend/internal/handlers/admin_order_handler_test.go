package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// newAdminTestRouter sets up a gin engine with the response middleware and
// returns an AdminOrderHandler backed by the shared mockOrderService.
func newAdminTestRouter() (*gin.Engine, *AdminOrderHandler, *mockOrderService) {
	router := gin.New()
	router.Use(response.Middleware())
	svc := &mockOrderService{}
	h := NewAdminOrderHandler(svc)
	return router, h, svc
}

// --- ListAllOrders ---

func TestAdminOrderHandler_ListAllOrders_Success(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.GET("/api/v1/admin/orders", h.ListAllOrders)

	svc.listAllOrdersFn = func(_ context.Context, req *services.AdminListOrdersRequest) (*services.OrderListResponse, error) {
		if req.Status != "paid" {
			t.Fatalf("expected status=paid, got %q", req.Status)
		}
		if req.PaymentMethod != "online" {
			t.Fatalf("expected payment_method=online, got %q", req.PaymentMethod)
		}
		return &services.OrderListResponse{
			Orders:   []*models.Order{{OrderNumber: "ORD-1"}},
			Total:    1,
			Page:     1,
			PageSize: 20,
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/orders?status=paid&payment_method=online", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decode(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if got.Meta == nil || got.Meta.Total != 1 {
		t.Fatalf("unexpected meta: %+v", got.Meta)
	}
}

func TestAdminOrderHandler_ListAllOrders_InvalidStatus(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.GET("/api/v1/admin/orders", h.ListAllOrders)

	svc.listAllOrdersFn = func(_ context.Context, req *services.AdminListOrdersRequest) (*services.OrderListResponse, error) {
		return nil, services.ErrInvalidOrderStatus
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/orders?status=bogus", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- GetOrder ---

func TestAdminOrderHandler_GetOrder_Success(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.GET("/api/v1/admin/orders/:id", h.GetOrder)

	svc.getOrderFn = func(_ context.Context, id uint) (*models.Order, error) {
		return &models.Order{
			BaseWithUpdate: models.BaseWithUpdate{ID: id},
			OrderNumber:    "ORD-42",
			TotalAmount:    decimal.NewFromInt(100),
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/orders/42", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminOrderHandler_GetOrder_NotFound(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.GET("/api/v1/admin/orders/:id", h.GetOrder)

	svc.getOrderFn = func(_ context.Context, _ uint) (*models.Order, error) {
		return nil, repositories.ErrOrderNotFound
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/orders/999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestAdminOrderHandler_GetOrder_InvalidID(t *testing.T) {
	router, h, _ := newAdminTestRouter()
	router.GET("/api/v1/admin/orders/:id", h.GetOrder)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/orders/abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- UpdateStatus ---

func TestAdminOrderHandler_UpdateStatus_Success(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.PUT("/api/v1/admin/orders/:id/status", h.UpdateStatus)

	svc.adminUpdateStatusFn = func(_ context.Context, id uint, req *services.AdminUpdateStatusRequest) error {
		if id != 5 {
			t.Fatalf("expected id=5, got %d", id)
		}
		if req.Status != models.OrderStatusShipped {
			t.Fatalf("expected status=shipped, got %s", req.Status)
		}
		if req.ShippingCarrier != "FedEx" || req.TrackingNumber != "TRACK123" {
			t.Fatalf("unexpected shipping details: carrier=%q tracking=%q", req.ShippingCarrier, req.TrackingNumber)
		}
		return nil
	}

	body := `{"status":"shipped","shipping_carrier":"FedEx","tracking_number":"TRACK123"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/orders/5/status", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminOrderHandler_UpdateStatus_MissingStatus(t *testing.T) {
	router, h, _ := newAdminTestRouter()
	router.PUT("/api/v1/admin/orders/:id/status", h.UpdateStatus)

	body := `{}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/orders/5/status", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestAdminOrderHandler_UpdateStatus_InvalidTransition(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.PUT("/api/v1/admin/orders/:id/status", h.UpdateStatus)

	svc.adminUpdateStatusFn = func(_ context.Context, _ uint, _ *services.AdminUpdateStatusRequest) error {
		return services.ErrInvalidStatusTransition
	}

	body := `{"status":"completed"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/orders/5/status", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- CancelOrder ---

func TestAdminOrderHandler_CancelOrder_Success(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/cancel", h.CancelOrder)

	var cancelledID uint
	var cancelReason string
	svc.adminCancelOrderFn = func(_ context.Context, id uint, reason string) error {
		cancelledID = id
		cancelReason = reason
		return nil
	}

	body := `{"reason":"customer request"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/7/cancel", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if cancelledID != 7 || cancelReason != "customer request" {
		t.Fatalf("unexpected cancel: id=%d reason=%q", cancelledID, cancelReason)
	}
}

func TestAdminOrderHandler_CancelOrder_NotCancellable(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/cancel", h.CancelOrder)

	svc.adminCancelOrderFn = func(_ context.Context, _ uint, _ string) error {
		return services.ErrOrderNotCancellable
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/7/cancel", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestAdminOrderHandler_CancelOrder_NotFound(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/cancel", h.CancelOrder)

	svc.adminCancelOrderFn = func(_ context.Context, _ uint, _ string) error {
		return repositories.ErrOrderNotFound
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/999/cancel", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- ExportOrders ---

func TestAdminOrderHandler_ExportOrders_CSV(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.GET("/api/v1/admin/orders/export", h.ExportOrders)

	svc.listAllOrdersFn = func(_ context.Context, _ *services.AdminListOrdersRequest) (*services.OrderListResponse, error) {
		return &services.OrderListResponse{
			Orders: []*models.Order{
				{
					OrderNumber:   "ORD-001",
					GuestName:     "Alice",
					GuestEmail:    "alice@example.com",
					GuestPhone:    "123456",
					PaymentMethod: models.PaymentMethodOnline,
					Status:        models.OrderStatusPaid,
					Subtotal:      decimal.NewFromInt(90),
					ShippingFee:   decimal.NewFromInt(10),
					TotalAmount:   decimal.NewFromInt(100),
					Items: []*models.OrderItem{
						{SKUName: "Widget", Quantity: 2},
					},
				},
			},
			Total:    1,
			Page:     1,
			PageSize: 10000,
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/orders/export", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/csv") {
		t.Fatalf("expected Content-Type text/csv, got %q", contentType)
	}

	body := w.Body.String()
	if !strings.Contains(body, "Order Number") {
		t.Fatalf("expected CSV header row, got: %s", body)
	}
	if !strings.Contains(body, "ORD-001") {
		t.Fatalf("expected order number in CSV, got: %s", body)
	}
	if !strings.Contains(body, "Widget x2") {
		t.Fatalf("expected item summary in CSV, got: %s", body)
	}
}

// --- ShipOrder ---

func TestAdminOrderHandler_ShipOrder_Success(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/ship", h.ShipOrder)

	svc.adminUpdateStatusFn = func(_ context.Context, id uint, req *services.AdminUpdateStatusRequest) error {
		if id != 10 {
			t.Fatalf("expected id=10, got %d", id)
		}
		if req.Status != "shipped" {
			t.Fatalf("expected status=shipped, got %s", req.Status)
		}
		if req.ShippingCarrier != "DHL" {
			t.Fatalf("expected carrier=DHL, got %q", req.ShippingCarrier)
		}
		if req.TrackingNumber != "DHL123456789" {
			t.Fatalf("expected tracking=DHL123456789, got %q", req.TrackingNumber)
		}
		return nil
	}

	body := `{"shipping_carrier":"DHL","tracking_number":"DHL123456789"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/10/ship", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decode(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
}

func TestAdminOrderHandler_ShipOrder_MissingCarrier(t *testing.T) {
	router, h, _ := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/ship", h.ShipOrder)

	body := `{"tracking_number":"TRACK123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/10/ship", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminOrderHandler_ShipOrder_MissingTrackingNumber(t *testing.T) {
	router, h, _ := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/ship", h.ShipOrder)

	body := `{"shipping_carrier":"FedEx"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/10/ship", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminOrderHandler_ShipOrder_EmptyBody(t *testing.T) {
	router, h, _ := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/ship", h.ShipOrder)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/10/ship", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminOrderHandler_ShipOrder_InvalidID(t *testing.T) {
	router, h, _ := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/ship", h.ShipOrder)

	body := `{"shipping_carrier":"DHL","tracking_number":"DHL123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/abc/ship", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminOrderHandler_ShipOrder_InvalidTransition(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/ship", h.ShipOrder)

	svc.adminUpdateStatusFn = func(_ context.Context, _ uint, _ *services.AdminUpdateStatusRequest) error {
		return services.ErrInvalidStatusTransition
	}

	body := `{"shipping_carrier":"DHL","tracking_number":"DHL123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/10/ship", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminOrderHandler_ShipOrder_OrderNotFound(t *testing.T) {
	router, h, svc := newAdminTestRouter()
	router.POST("/api/v1/admin/orders/:id/ship", h.ShipOrder)

	svc.adminUpdateStatusFn = func(_ context.Context, _ uint, _ *services.AdminUpdateStatusRequest) error {
		return repositories.ErrOrderNotFound
	}

	body := `{"shipping_carrier":"DHL","tracking_number":"DHL123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/orders/999/ship", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}
