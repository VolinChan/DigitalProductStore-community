package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// skuMockService is a mock implementation of services.SKUService with function injection
type skuMockService struct {
	createSKUFn          func(ctx context.Context, productID uint, req *services.CreateSKURequest) (*models.SKU, error)
	getSKUFn             func(ctx context.Context, id uint) (*models.SKU, error)
	getSKUWithAttrsFn    func(ctx context.Context, id uint) (*models.SKU, error)
	listSKUsByProductFn  func(ctx context.Context, productID uint) ([]*models.SKU, error)
	updateSKUFn          func(ctx context.Context, id uint, req *services.UpdateSKURequest) error
	deleteSKUFn          func(ctx context.Context, id uint) error
	checkAvailabilityFn  func(ctx context.Context, id uint, quantity int) (bool, error)
}

func (m *skuMockService) CreateSKU(ctx context.Context, productID uint, req *services.CreateSKURequest) (*models.SKU, error) {
	if m.createSKUFn != nil {
		return m.createSKUFn(ctx, productID, req)
	}
	return &models.SKU{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, ProductID: productID}, nil
}

func (m *skuMockService) GetSKU(ctx context.Context, id uint) (*models.SKU, error) {
	if m.getSKUFn != nil {
		return m.getSKUFn(ctx, id)
	}
	return nil, fmt.Errorf("SKU not found")
}

func (m *skuMockService) GetSKUWithAttributes(ctx context.Context, id uint) (*models.SKU, error) {
	if m.getSKUWithAttrsFn != nil {
		return m.getSKUWithAttrsFn(ctx, id)
	}
	return nil, fmt.Errorf("SKU not found")
}

func (m *skuMockService) ListSKUsByProduct(ctx context.Context, productID uint) ([]*models.SKU, error) {
	if m.listSKUsByProductFn != nil {
		return m.listSKUsByProductFn(ctx, productID)
	}
	return nil, nil
}

func (m *skuMockService) UpdateSKU(ctx context.Context, id uint, req *services.UpdateSKURequest) error {
	if m.updateSKUFn != nil {
		return m.updateSKUFn(ctx, id, req)
	}
	return nil
}

func (m *skuMockService) DeleteSKU(ctx context.Context, id uint) error {
	if m.deleteSKUFn != nil {
		return m.deleteSKUFn(ctx, id)
	}
	return nil
}

func (m *skuMockService) CheckSKUAvailability(ctx context.Context, id uint, quantity int) (bool, error) {
	if m.checkAvailabilityFn != nil {
		return m.checkAvailabilityFn(ctx, id, quantity)
	}
	return true, nil
}

func newSKUTestRouter() (*gin.Engine, *ProductHandler, *skuMockService) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(response.Middleware())
	productSvc := &mockProductService{}
	skuSvc := &skuMockService{}
	h := NewProductHandler(productSvc, skuSvc)
	return router, h, skuSvc
}

func decodeSKUResponse(t *testing.T, body *bytes.Buffer) parsedResponse {
	t.Helper()
	var r parsedResponse
	if err := json.Unmarshal(body.Bytes(), &r); err != nil {
		t.Fatalf("failed to decode response: %v - body: %s", err, body.String())
	}
	return r
}

// --- CreateSKU ---

func TestProductHandler_CreateSKU_Success(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.POST("/api/v1/admin/products/:id/skus", h.CreateSKU)

	skuSvc.createSKUFn = func(_ context.Context, productID uint, req *services.CreateSKURequest) (*models.SKU, error) {
		if productID != 1 {
			t.Fatalf("expected productID=1, got %d", productID)
		}
		if req.SKUCode != "SKU-001" {
			t.Fatalf("expected sku_code='SKU-001', got %q", req.SKUCode)
		}
		if !req.Price.Equal(decimal.NewFromFloat(99.99)) {
			t.Fatalf("expected price=99.99, got %s", req.Price.String())
		}
		if req.Inventory != 100 {
			t.Fatalf("expected inventory=100, got %d", req.Inventory)
		}
		if len(req.Attributes) != 2 {
			t.Fatalf("expected 2 attributes, got %d", len(req.Attributes))
		}
		return &models.SKU{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			ProductID:      productID,
			SKUCode:        req.SKUCode,
			Price:          req.Price,
			Inventory:      req.Inventory,
			IsActive:       req.IsActive,
		}, nil
	}

	body := `{
		"sku_code": "SKU-001",
		"price": 99.99,
		"inventory": 100,
		"image_url": "https://example.com/img.jpg",
		"attributes": [
			{"name": "color", "value": "red"},
			{"name": "size", "value": "XL"}
		]
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products/1/skus", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeSKUResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true, got error %+v", got.Error)
	}
}

func TestProductHandler_CreateSKU_InvalidProductID(t *testing.T) {
	router, h, _ := newSKUTestRouter()
	router.POST("/api/v1/admin/products/:id/skus", h.CreateSKU)

	body := `{"sku_code":"SKU-001","price":10,"inventory":5,"attributes":[{"name":"color","value":"blue"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products/abc/skus", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateSKU_ProductNotFound(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.POST("/api/v1/admin/products/:id/skus", h.CreateSKU)

	skuSvc.createSKUFn = func(_ context.Context, _ uint, _ *services.CreateSKURequest) (*models.SKU, error) {
		return nil, fmt.Errorf("invalid product: product not found")
	}

	body := `{"sku_code":"SKU-001","price":10,"inventory":5,"attributes":[{"name":"color","value":"blue"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products/999/skus", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateSKU_DuplicateAttributes(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.POST("/api/v1/admin/products/:id/skus", h.CreateSKU)

	skuSvc.createSKUFn = func(_ context.Context, _ uint, _ *services.CreateSKURequest) (*models.SKU, error) {
		return nil, fmt.Errorf("SKU with this attribute combination already exists for this product")
	}

	body := `{"sku_code":"SKU-002","price":10,"inventory":5,"attributes":[{"name":"color","value":"red"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products/1/skus", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateSKU_MissingAttributes(t *testing.T) {
	router, h, _ := newSKUTestRouter()
	router.POST("/api/v1/admin/products/:id/skus", h.CreateSKU)

	body := `{"sku_code":"SKU-001","price":10,"inventory":5}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products/1/skus", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateSKU_MissingSKUCode(t *testing.T) {
	router, h, _ := newSKUTestRouter()
	router.POST("/api/v1/admin/products/:id/skus", h.CreateSKU)

	body := `{"price":10,"inventory":5,"attributes":[{"name":"color","value":"blue"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products/1/skus", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateSKU_DefaultIsActive(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.POST("/api/v1/admin/products/:id/skus", h.CreateSKU)

	skuSvc.createSKUFn = func(_ context.Context, _ uint, req *services.CreateSKURequest) (*models.SKU, error) {
		if !req.IsActive {
			t.Fatal("expected IsActive to be true by default")
		}
		return &models.SKU{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			ProductID:      1,
			IsActive:       req.IsActive,
		}, nil
	}

	body := `{"sku_code":"SKU-001","price":10,"inventory":5,"attributes":[{"name":"color","value":"blue"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products/1/skus", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

// --- UpdateSKU ---

func TestProductHandler_UpdateSKU_Success(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.PUT("/api/v1/admin/skus/:id", h.UpdateSKU)

	skuSvc.updateSKUFn = func(_ context.Context, id uint, req *services.UpdateSKURequest) error {
		if id != 1 {
			t.Fatalf("expected id=1, got %d", id)
		}
		if req.Price == nil || !req.Price.Equal(decimal.NewFromFloat(149.99)) {
			t.Fatalf("expected price=149.99, got %v", req.Price)
		}
		return nil
	}

	body := `{"price": 149.99}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/skus/1", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeSKUResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true, got error %+v", got.Error)
	}
}

func TestProductHandler_UpdateSKU_InvalidID(t *testing.T) {
	router, h, _ := newSKUTestRouter()
	router.PUT("/api/v1/admin/skus/:id", h.UpdateSKU)

	body := `{"price": 10}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/skus/abc", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_UpdateSKU_NotFound(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.PUT("/api/v1/admin/skus/:id", h.UpdateSKU)

	skuSvc.updateSKUFn = func(_ context.Context, _ uint, _ *services.UpdateSKURequest) error {
		return fmt.Errorf("SKU not found")
	}

	body := `{"price": 10}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/skus/999", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_UpdateSKU_DuplicateAttributes(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.PUT("/api/v1/admin/skus/:id", h.UpdateSKU)

	skuSvc.updateSKUFn = func(_ context.Context, _ uint, _ *services.UpdateSKURequest) error {
		return fmt.Errorf("SKU with this attribute combination already exists for this product")
	}

	body := `{"attributes":[{"name":"color","value":"red"}]}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/skus/1", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_UpdateSKU_EmptySKUCode(t *testing.T) {
	router, h, _ := newSKUTestRouter()
	router.PUT("/api/v1/admin/skus/:id", h.UpdateSKU)

	body := `{"sku_code":"   "}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/skus/1", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty sku_code, got %d: %s", w.Code, w.Body.String())
	}
}

// --- DeleteSKU ---

func TestProductHandler_DeleteSKU_Success(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.DELETE("/api/v1/admin/skus/:id", h.DeleteSKU)

	skuSvc.deleteSKUFn = func(_ context.Context, id uint) error {
		if id != 1 {
			t.Fatalf("expected id=1, got %d", id)
		}
		return nil
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/skus/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeSKUResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true, got error %+v", got.Error)
	}
}

func TestProductHandler_DeleteSKU_InvalidID(t *testing.T) {
	router, h, _ := newSKUTestRouter()
	router.DELETE("/api/v1/admin/skus/:id", h.DeleteSKU)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/skus/xyz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_DeleteSKU_NotFound(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.DELETE("/api/v1/admin/skus/:id", h.DeleteSKU)

	skuSvc.deleteSKUFn = func(_ context.Context, _ uint) error {
		return fmt.Errorf("SKU not found")
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/skus/999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_DeleteSKU_PendingOrders(t *testing.T) {
	router, h, skuSvc := newSKUTestRouter()
	router.DELETE("/api/v1/admin/skus/:id", h.DeleteSKU)

	skuSvc.deleteSKUFn = func(_ context.Context, _ uint) error {
		return fmt.Errorf("cannot delete SKU with pending orders")
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/skus/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
}
