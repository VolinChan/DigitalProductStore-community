package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

func init() {
	gin.SetMode(gin.TestMode)
}

// mockOrderService is a minimal OrderService stand-in the handler tests can
// program per-call. Each field holds the response to serve for its method;
// unset fields return zero values so tests only wire up the behaviour they
// care about.
type mockOrderService struct {
	createOrderFn            func(context.Context, *services.CreateOrderRequest) (*models.Order, error)
	getOrderFn               func(context.Context, uint) (*models.Order, error)
	getByNumberFn            func(context.Context, string) (*models.Order, error)
	listOrdersFn             func(context.Context, uint, *services.ListOrdersRequest) (*services.OrderListResponse, error)
	listAllOrdersFn          func(context.Context, *services.AdminListOrdersRequest) (*services.OrderListResponse, error)
	updateStatusFn           func(context.Context, uint, models.OrderStatus) error
	adminUpdateStatusFn      func(context.Context, uint, *services.AdminUpdateStatusRequest) error
	adminCancelOrderFn       func(context.Context, uint, string) error
	cancelOrderFn            func(context.Context, uint, string) error
	trackOrderFn             func(context.Context, string, string) (*models.Order, error)
	lastCreateReq            *services.CreateOrderRequest
	lastListUserID           uint
	lastListReq              *services.ListOrdersRequest
	lastCancelReason         string
	lastCancelOrderID        uint
	lastTrackOrderNum        string
	lastTrackEmail           string
}

func (m *mockOrderService) CreateOrder(ctx context.Context, req *services.CreateOrderRequest) (*models.Order, error) {
	m.lastCreateReq = req
	if m.createOrderFn != nil {
		return m.createOrderFn(ctx, req)
	}
	return &models.Order{OrderNumber: "TEST-123"}, nil
}

func (m *mockOrderService) GetOrder(ctx context.Context, id uint) (*models.Order, error) {
	if m.getOrderFn != nil {
		return m.getOrderFn(ctx, id)
	}
	return nil, repositories.ErrOrderNotFound
}

func (m *mockOrderService) GetOrderByNumber(ctx context.Context, n string) (*models.Order, error) {
	if m.getByNumberFn != nil {
		return m.getByNumberFn(ctx, n)
	}
	return nil, repositories.ErrOrderNotFound
}

func (m *mockOrderService) ListOrders(ctx context.Context, userID uint, req *services.ListOrdersRequest) (*services.OrderListResponse, error) {
	m.lastListUserID = userID
	m.lastListReq = req
	if m.listOrdersFn != nil {
		return m.listOrdersFn(ctx, userID, req)
	}
	return &services.OrderListResponse{Orders: []*models.Order{}, Total: 0, Page: req.Page, PageSize: req.PageSize}, nil
}

func (m *mockOrderService) UpdateOrderStatus(ctx context.Context, id uint, status models.OrderStatus) error {
	if m.updateStatusFn != nil {
		return m.updateStatusFn(ctx, id, status)
	}
	return nil
}

func (m *mockOrderService) CancelOrder(ctx context.Context, id uint, reason string) error {
	m.lastCancelOrderID = id
	m.lastCancelReason = reason
	if m.cancelOrderFn != nil {
		return m.cancelOrderFn(ctx, id, reason)
	}
	return nil
}

func (m *mockOrderService) TrackOrder(ctx context.Context, number, email string) (*models.Order, error) {
	m.lastTrackOrderNum = number
	m.lastTrackEmail = email
	if m.trackOrderFn != nil {
		return m.trackOrderFn(ctx, number, email)
	}
	return nil, repositories.ErrOrderNotFound
}

func (m *mockOrderService) ListAllOrders(ctx context.Context, req *services.AdminListOrdersRequest) (*services.OrderListResponse, error) {
	if m.listAllOrdersFn != nil {
		return m.listAllOrdersFn(ctx, req)
	}
	return &services.OrderListResponse{Orders: []*models.Order{}, Total: 0, Page: 1, PageSize: 20}, nil
}

func (m *mockOrderService) AdminUpdateOrderStatus(ctx context.Context, id uint, req *services.AdminUpdateStatusRequest) error {
	if m.adminUpdateStatusFn != nil {
		return m.adminUpdateStatusFn(ctx, id, req)
	}
	return nil
}

func (m *mockOrderService) AdminCancelOrder(ctx context.Context, id uint, reason string) error {
	if m.adminCancelOrderFn != nil {
		return m.adminCancelOrderFn(ctx, id, reason)
	}
	return nil
}

// newTestRouter sets up a gin engine with the response middleware wired so
// response helpers have a request_id to work with. It also lets callers
// inject a fake authentication state by setting user_id in context before
// the handler runs.
func newTestRouter(userID *uint) (*gin.Engine, *OrderHandler, *mockOrderService) {
	router := gin.New()
	router.Use(response.Middleware())
	if userID != nil {
		uid := *userID
		router.Use(func(c *gin.Context) {
			c.Set("user_id", uid)
			c.Next()
		})
	}
	svc := &mockOrderService{}
	h := NewOrderHandler(svc)
	return router, h, svc
}

// parsedResponse is a narrow view of response.Response tailored to what the
// tests need to assert.
type parsedResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *response.ErrorInfo `json:"error,omitempty"`
	Meta    *response.Meta  `json:"meta,omitempty"`
}

func decode(t *testing.T, body *bytes.Buffer) parsedResponse {
	t.Helper()
	var r parsedResponse
	if err := json.Unmarshal(body.Bytes(), &r); err != nil {
		t.Fatalf("failed to decode response: %v - body: %s", err, body.String())
	}
	return r
}

// --- CreateOrder ---

func TestOrderHandler_CreateOrder_Guest(t *testing.T) {
	router, h, svc := newTestRouter(nil)
	router.POST("/api/v1/orders", h.CreateOrder)

	svc.createOrderFn = func(_ context.Context, req *services.CreateOrderRequest) (*models.Order, error) {
		if req.UserID != nil {
			t.Fatalf("expected UserID to be nil for guest, got %v", *req.UserID)
		}
		if req.GuestEmail != "guest@example.com" {
			t.Fatalf("expected guest email to be trimmed/passed through, got %q", req.GuestEmail)
		}
		return &models.Order{OrderNumber: "ORD-1", Status: models.OrderStatusPendingPayment, TotalAmount: decimal.NewFromInt(100)}, nil
	}

	body := `{"items":[{"sku_id":1,"quantity":2}],"guest_name":"Alice","guest_email":" guest@example.com ","guest_phone":"123","shipping_address":"123 Main St","payment_method":"online"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	got := decode(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true, got error %+v", got.Error)
	}
}

func TestOrderHandler_CreateOrder_AuthenticatedUserIDAttached(t *testing.T) {
	uid := uint(42)
	router, h, svc := newTestRouter(&uid)
	router.POST("/api/v1/orders", h.CreateOrder)

	svc.createOrderFn = func(_ context.Context, req *services.CreateOrderRequest) (*models.Order, error) {
		if req.UserID == nil || *req.UserID != uid {
			t.Fatalf("expected UserID=%d, got %v", uid, req.UserID)
		}
		return &models.Order{OrderNumber: "ORD-2"}, nil
	}

	body := `{"items":[{"sku_id":1,"quantity":1}],"shipping_address":"A","payment_method":"online"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestOrderHandler_CreateOrder_InvalidBody(t *testing.T) {
	router, h, _ := newTestRouter(nil)
	router.POST("/api/v1/orders", h.CreateOrder)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestOrderHandler_CreateOrder_ServiceValidationError(t *testing.T) {
	router, h, svc := newTestRouter(nil)
	router.POST("/api/v1/orders", h.CreateOrder)

	svc.createOrderFn = func(_ context.Context, _ *services.CreateOrderRequest) (*models.Order, error) {
		return nil, services.ErrInvalidShippingInfo
	}

	body := `{"shipping_address":"x","payment_method":"online"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for validation error, got %d", w.Code)
	}
}

// --- ListUserOrders ---

func TestOrderHandler_ListUserOrders_RequiresAuth(t *testing.T) {
	router, h, _ := newTestRouter(nil)
	router.GET("/api/v1/user/orders", h.ListUserOrders)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/user/orders", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without auth, got %d", w.Code)
	}
}

func TestOrderHandler_ListUserOrders_PaginationMapping(t *testing.T) {
	uid := uint(7)
	router, h, svc := newTestRouter(&uid)
	router.GET("/api/v1/user/orders", h.ListUserOrders)

	svc.listOrdersFn = func(_ context.Context, userID uint, req *services.ListOrdersRequest) (*services.OrderListResponse, error) {
		if userID != uid {
			t.Fatalf("expected userID=%d, got %d", uid, userID)
		}
		// limit=10, offset=20 → page 3, page_size 10
		if req.Page != 3 || req.PageSize != 10 {
			t.Fatalf("expected page=3 page_size=10, got page=%d page_size=%d", req.Page, req.PageSize)
		}
		return &services.OrderListResponse{Orders: []*models.Order{}, Total: 25, Page: req.Page, PageSize: req.PageSize}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/user/orders?limit=10&offset=20", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decode(t, w.Body)
	if got.Meta == nil || got.Meta.Total != 25 || got.Meta.Page != 3 || got.Meta.PerPage != 10 {
		t.Fatalf("unexpected meta: %+v", got.Meta)
	}
}

// --- GetUserOrder ---

func TestOrderHandler_GetUserOrder_OwnershipEnforced(t *testing.T) {
	uid := uint(5)
	router, h, svc := newTestRouter(&uid)
	router.GET("/api/v1/user/orders/:id", h.GetUserOrder)

	otherUser := uint(99)
	svc.getOrderFn = func(_ context.Context, id uint) (*models.Order, error) {
		if id != 12 {
			t.Fatalf("expected id=12, got %d", id)
		}
		return &models.Order{BaseWithUpdate: models.BaseWithUpdate{ID: 12}, UserID: &otherUser}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/user/orders/12", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for non-owner, got %d", w.Code)
	}
}

func TestOrderHandler_GetUserOrder_Owner(t *testing.T) {
	uid := uint(5)
	router, h, svc := newTestRouter(&uid)
	router.GET("/api/v1/user/orders/:id", h.GetUserOrder)

	svc.getOrderFn = func(_ context.Context, id uint) (*models.Order, error) {
		owner := uid
		return &models.Order{BaseWithUpdate: models.BaseWithUpdate{ID: id}, UserID: &owner, OrderNumber: "OK"}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/user/orders/7", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner, got %d: %s", w.Code, w.Body.String())
	}
}

func TestOrderHandler_GetUserOrder_InvalidID(t *testing.T) {
	uid := uint(5)
	router, h, _ := newTestRouter(&uid)
	router.GET("/api/v1/user/orders/:id", h.GetUserOrder)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/user/orders/notanumber", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid id, got %d", w.Code)
	}
}

// --- CancelUserOrder ---

func TestOrderHandler_CancelUserOrder_NotFoundForOtherUser(t *testing.T) {
	uid := uint(5)
	router, h, svc := newTestRouter(&uid)
	router.POST("/api/v1/user/orders/:id/cancel", h.CancelUserOrder)

	otherUser := uint(99)
	svc.getOrderFn = func(_ context.Context, id uint) (*models.Order, error) {
		return &models.Order{BaseWithUpdate: models.BaseWithUpdate{ID: id}, UserID: &otherUser}, nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/user/orders/1/cancel", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
	if svc.lastCancelOrderID != 0 {
		t.Fatalf("cancel should not be invoked when ownership check fails")
	}
}

func TestOrderHandler_CancelUserOrder_Owner(t *testing.T) {
	uid := uint(5)
	router, h, svc := newTestRouter(&uid)
	router.POST("/api/v1/user/orders/:id/cancel", h.CancelUserOrder)

	owner := uid
	svc.getOrderFn = func(_ context.Context, id uint) (*models.Order, error) {
		return &models.Order{BaseWithUpdate: models.BaseWithUpdate{ID: id}, UserID: &owner, Status: models.OrderStatusPendingPayment}, nil
	}

	body := `{"reason":"changed my mind"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/user/orders/9/cancel", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if svc.lastCancelOrderID != 9 || svc.lastCancelReason != "changed my mind" {
		t.Fatalf("unexpected cancel call: id=%d reason=%q", svc.lastCancelOrderID, svc.lastCancelReason)
	}
}

func TestOrderHandler_CancelUserOrder_NotCancellable(t *testing.T) {
	uid := uint(5)
	router, h, svc := newTestRouter(&uid)
	router.POST("/api/v1/user/orders/:id/cancel", h.CancelUserOrder)

	owner := uid
	svc.getOrderFn = func(_ context.Context, id uint) (*models.Order, error) {
		return &models.Order{BaseWithUpdate: models.BaseWithUpdate{ID: id}, UserID: &owner}, nil
	}
	svc.cancelOrderFn = func(_ context.Context, _ uint, _ string) error {
		return services.ErrOrderNotCancellable
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/user/orders/1/cancel", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for non-cancellable order, got %d", w.Code)
	}
}

// --- TrackOrder ---

func TestOrderHandler_TrackOrder_BodyParams(t *testing.T) {
	router, h, svc := newTestRouter(nil)
	router.POST("/api/v1/orders/track", h.TrackOrder)

	svc.trackOrderFn = func(_ context.Context, n, e string) (*models.Order, error) {
		if n != "ORD-1" || e != "user@example.com" {
			t.Fatalf("unexpected args: %q %q", n, e)
		}
		return &models.Order{OrderNumber: n}, nil
	}

	body := `{"order_number":"ORD-1","email":"user@example.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/track", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestOrderHandler_TrackOrder_QueryParams(t *testing.T) {
	router, h, svc := newTestRouter(nil)
	router.POST("/api/v1/orders/track", h.TrackOrder)

	svc.trackOrderFn = func(_ context.Context, n, e string) (*models.Order, error) {
		return &models.Order{OrderNumber: n}, nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/track?order_number=Q-1&email=q@example.com", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if svc.lastTrackOrderNum != "Q-1" || svc.lastTrackEmail != "q@example.com" {
		t.Fatalf("expected query params propagated, got %q %q", svc.lastTrackOrderNum, svc.lastTrackEmail)
	}
}

func TestOrderHandler_TrackOrder_Missing(t *testing.T) {
	router, h, _ := newTestRouter(nil)
	router.POST("/api/v1/orders/track", h.TrackOrder)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/track", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when fields missing, got %d", w.Code)
	}
}

func TestOrderHandler_TrackOrder_NotFound(t *testing.T) {
	router, h, svc := newTestRouter(nil)
	router.POST("/api/v1/orders/track", h.TrackOrder)

	svc.trackOrderFn = func(_ context.Context, _ string, _ string) (*models.Order, error) {
		return nil, repositories.ErrOrderNotFound
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/track?order_number=X&email=x@x", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- writeOrderServiceError mapping ---

func TestWriteOrderServiceError_Mappings(t *testing.T) {
	cases := []struct {
		name     string
		err      error
		wantCode int
	}{
		{"not found", repositories.ErrOrderNotFound, http.StatusNotFound},
		{"empty cart", services.ErrEmptyCart, http.StatusBadRequest},
		{"invalid shipping", services.ErrInvalidShippingInfo, http.StatusBadRequest},
		{"invalid payment", services.ErrInvalidPaymentMethod, http.StatusBadRequest},
		{"sku unavailable", services.ErrSKUUnavailable, http.StatusBadRequest},
		{"invalid status", services.ErrInvalidOrderStatus, http.StatusBadRequest},
		{"invalid transition", services.ErrInvalidStatusTransition, http.StatusBadRequest},
		{"not cancellable", services.ErrOrderNotCancellable, http.StatusBadRequest},
		{"other", errors.New("boom"), http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(response.Middleware())
			router.GET("/x", func(c *gin.Context) {
				writeOrderServiceError(c, tc.err)
			})
			req := httptest.NewRequest(http.MethodGet, "/x", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != tc.wantCode {
				t.Fatalf("want %d, got %d", tc.wantCode, w.Code)
			}
		})
	}
}
