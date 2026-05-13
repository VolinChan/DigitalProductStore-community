package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/services"
)

// mockInventoryService implements services.InventoryService for testing.
type mockInventoryService struct {
	listInventoryFn      func(ctx context.Context, params *services.ListInventoryParams) (*services.InventoryListResult, error)
	getInventoryFn       func(ctx context.Context, skuID uint) (*services.InventoryInfo, error)
	updateInventoryFn    func(ctx context.Context, skuID uint, adjustment int, reason string, adminID uint) error
	reserveInventoryFn   func(ctx context.Context, items []*services.InventoryItem, orderID uint) error
	releaseInventoryFn   func(ctx context.Context, items []*services.InventoryItem, orderID uint) error
	getLowStockAlertsFn  func(ctx context.Context, threshold int) ([]*services.InventoryAlert, error)
	getInventoryHistoryFn func(ctx context.Context, skuID uint, params *services.ListInventoryHistoryParams) ([]*models.InventoryLog, int64, error)
}

func (m *mockInventoryService) ListInventory(ctx context.Context, params *services.ListInventoryParams) (*services.InventoryListResult, error) {
	if m.listInventoryFn != nil {
		return m.listInventoryFn(ctx, params)
	}
	return &services.InventoryListResult{Items: []*services.InventoryListItem{}, Total: 0, Page: 1, Size: 20}, nil
}

func (m *mockInventoryService) GetInventory(ctx context.Context, skuID uint) (*services.InventoryInfo, error) {
	if m.getInventoryFn != nil {
		return m.getInventoryFn(ctx, skuID)
	}
	return nil, nil
}

func (m *mockInventoryService) UpdateInventory(ctx context.Context, skuID uint, adjustment int, reason string, adminID uint) error {
	if m.updateInventoryFn != nil {
		return m.updateInventoryFn(ctx, skuID, adjustment, reason, adminID)
	}
	return nil
}

func (m *mockInventoryService) ReserveInventory(ctx context.Context, items []*services.InventoryItem, orderID uint) error {
	if m.reserveInventoryFn != nil {
		return m.reserveInventoryFn(ctx, items, orderID)
	}
	return nil
}

func (m *mockInventoryService) ReleaseInventory(ctx context.Context, items []*services.InventoryItem, orderID uint) error {
	if m.releaseInventoryFn != nil {
		return m.releaseInventoryFn(ctx, items, orderID)
	}
	return nil
}

func (m *mockInventoryService) GetLowStockAlerts(ctx context.Context, threshold int) ([]*services.InventoryAlert, error) {
	if m.getLowStockAlertsFn != nil {
		return m.getLowStockAlertsFn(ctx, threshold)
	}
	return []*services.InventoryAlert{}, nil
}

func (m *mockInventoryService) GetInventoryHistory(ctx context.Context, skuID uint, params *services.ListInventoryHistoryParams) ([]*models.InventoryLog, int64, error) {
	if m.getInventoryHistoryFn != nil {
		return m.getInventoryHistoryFn(ctx, skuID, params)
	}
	return []*models.InventoryLog{}, 0, nil
}

// setupInventoryTestRouter creates a gin router with the inventory handler
// and sets up auth context for admin user.
func setupInventoryTestRouter(handler *InventoryHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Simulate auth middleware setting user context
	r.Use(func(c *gin.Context) {
		c.Set("user_id", uint(1))
		c.Set("user_email", "admin@test.com")
		c.Set("user_role", string(models.RoleSuperAdmin))
		c.Set("request_id", "test-request-id")
		c.Next()
	})

	inventory := r.Group("/api/v1/admin/inventory")
	{
		inventory.GET("", handler.ListInventory)
		inventory.PUT("/:sku_id", handler.AdjustInventory)
		inventory.GET("/alerts", handler.GetLowStockAlerts)
		inventory.GET("/:sku_id/history", handler.GetInventoryHistory)
	}

	return r
}

func TestInventoryHandler_ListInventory_Success(t *testing.T) {
	mock := &mockInventoryService{
		listInventoryFn: func(ctx context.Context, params *services.ListInventoryParams) (*services.InventoryListResult, error) {
			return &services.InventoryListResult{
				Items: []*services.InventoryListItem{
					{SKUID: 1, SKUCode: "SKU-001", ProductID: 1, ProductName: "Product A", Inventory: 50, IsActive: true, LowStock: false},
					{SKUID: 2, SKUCode: "SKU-002", ProductID: 1, ProductName: "Product A", Inventory: 5, IsActive: true, LowStock: true},
				},
				Total: 2,
				Page:  1,
				Size:  20,
			}, nil
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/inventory?page=1&page_size=20", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if !resp["success"].(bool) {
		t.Fatal("expected success=true")
	}
	data := resp["data"].([]interface{})
	if len(data) != 2 {
		t.Fatalf("expected 2 items, got %d", len(data))
	}
	meta := resp["meta"].(map[string]interface{})
	if meta["total"].(float64) != 2 {
		t.Fatalf("expected total=2, got %v", meta["total"])
	}
}

func TestInventoryHandler_ListInventory_WithSearch(t *testing.T) {
	var capturedParams *services.ListInventoryParams
	mock := &mockInventoryService{
		listInventoryFn: func(ctx context.Context, params *services.ListInventoryParams) (*services.InventoryListResult, error) {
			capturedParams = params
			return &services.InventoryListResult{Items: []*services.InventoryListItem{}, Total: 0, Page: 1, Size: 20}, nil
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/inventory?search=phone", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if capturedParams == nil || capturedParams.Search != "phone" {
		t.Fatal("expected search param to be 'phone'")
	}
}

func TestInventoryHandler_AdjustInventory_Success(t *testing.T) {
	var capturedSKUID uint
	var capturedAdj int
	var capturedReason string
	var capturedAdminID uint

	mock := &mockInventoryService{
		updateInventoryFn: func(ctx context.Context, skuID uint, adjustment int, reason string, adminID uint) error {
			capturedSKUID = skuID
			capturedAdj = adjustment
			capturedReason = reason
			capturedAdminID = adminID
			return nil
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	body := `{"adjustment": 10, "reason": "Restock from supplier"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/inventory/5", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
	if capturedSKUID != 5 {
		t.Fatalf("expected skuID=5, got %d", capturedSKUID)
	}
	if capturedAdj != 10 {
		t.Fatalf("expected adjustment=10, got %d", capturedAdj)
	}
	if capturedReason != "Restock from supplier" {
		t.Fatalf("expected reason='Restock from supplier', got '%s'", capturedReason)
	}
	if capturedAdminID != 1 {
		t.Fatalf("expected adminID=1, got %d", capturedAdminID)
	}
}

func TestInventoryHandler_AdjustInventory_InvalidSKUID(t *testing.T) {
	handler := NewInventoryHandler(&mockInventoryService{})
	router := setupInventoryTestRouter(handler)

	body := `{"adjustment": 10, "reason": "test"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/inventory/abc", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
}

func TestInventoryHandler_AdjustInventory_MissingReason(t *testing.T) {
	handler := NewInventoryHandler(&mockInventoryService{})
	router := setupInventoryTestRouter(handler)

	body := `{"adjustment": 10}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/inventory/5", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInventoryHandler_AdjustInventory_ZeroAdjustment(t *testing.T) {
	handler := NewInventoryHandler(&mockInventoryService{})
	router := setupInventoryTestRouter(handler)

	body := `{"adjustment": 0, "reason": "test"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/inventory/5", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInventoryHandler_AdjustInventory_InsufficientStock(t *testing.T) {
	mock := &mockInventoryService{
		updateInventoryFn: func(ctx context.Context, skuID uint, adjustment int, reason string, adminID uint) error {
			return services.ErrInsufficientStock
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	body := `{"adjustment": -100, "reason": "Remove damaged items"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/inventory/5", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInventoryHandler_AdjustInventory_SKUNotFound(t *testing.T) {
	mock := &mockInventoryService{
		updateInventoryFn: func(ctx context.Context, skuID uint, adjustment int, reason string, adminID uint) error {
			return errors.New("SKU not found")
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	body := `{"adjustment": 10, "reason": "Restock"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/inventory/999", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInventoryHandler_GetLowStockAlerts_Success(t *testing.T) {
	mock := &mockInventoryService{
		getLowStockAlertsFn: func(ctx context.Context, threshold int) ([]*services.InventoryAlert, error) {
			if threshold != 15 {
				t.Fatalf("expected threshold=15, got %d", threshold)
			}
			return []*services.InventoryAlert{
				{SKUID: 2, SKUCode: "SKU-002", ProductName: "Phone", CurrentQty: 3, Threshold: 15},
			}, nil
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/inventory/alerts?threshold=15", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	data := resp["data"].([]interface{})
	if len(data) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(data))
	}
}

func TestInventoryHandler_GetLowStockAlerts_DefaultThreshold(t *testing.T) {
	var capturedThreshold int
	mock := &mockInventoryService{
		getLowStockAlertsFn: func(ctx context.Context, threshold int) ([]*services.InventoryAlert, error) {
			capturedThreshold = threshold
			return []*services.InventoryAlert{}, nil
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/inventory/alerts", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if capturedThreshold != services.DefaultLowStockThreshold {
		t.Fatalf("expected default threshold %d, got %d", services.DefaultLowStockThreshold, capturedThreshold)
	}
}

func TestInventoryHandler_GetInventoryHistory_Success(t *testing.T) {
	mock := &mockInventoryService{
		getInventoryHistoryFn: func(ctx context.Context, skuID uint, params *services.ListInventoryHistoryParams) ([]*models.InventoryLog, int64, error) {
			if skuID != 3 {
				t.Fatalf("expected skuID=3, got %d", skuID)
			}
			return []*models.InventoryLog{
				{SKUID: 3, PreviousQty: 10, NewQty: 15, Change: 5, Reason: "Restock"},
			}, 1, nil
		},
	}

	handler := NewInventoryHandler(mock)
	router := setupInventoryTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/inventory/3/history?page=1&page_size=10", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	data := resp["data"].([]interface{})
	if len(data) != 1 {
		t.Fatalf("expected 1 log entry, got %d", len(data))
	}
	meta := resp["meta"].(map[string]interface{})
	if meta["total"].(float64) != 1 {
		t.Fatalf("expected total=1, got %v", meta["total"])
	}
}

func TestInventoryHandler_GetInventoryHistory_InvalidSKUID(t *testing.T) {
	handler := NewInventoryHandler(&mockInventoryService{})
	router := setupInventoryTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/inventory/abc/history", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
}
