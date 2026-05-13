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

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// mockProductService is a mock implementation of services.ProductService
type mockProductService struct {
	createProductFn func(ctx context.Context, req *services.CreateProductRequest) (*models.Product, error)
	getProductFn    func(ctx context.Context, id uint) (*models.Product, error)
	getWithDetailsFn func(ctx context.Context, id uint) (*models.Product, error)
	listProductsFn  func(ctx context.Context, params *services.ListProductsRequest) (*services.ProductListResponse, error)
	updateProductFn func(ctx context.Context, id uint, req *services.UpdateProductRequest) error
	deleteProductFn func(ctx context.Context, id uint) error
	searchProductsFn func(ctx context.Context, query string, params *services.ListProductsRequest) (*services.ProductListResponse, error)
}

func (m *mockProductService) CreateProduct(ctx context.Context, req *services.CreateProductRequest) (*models.Product, error) {
	if m.createProductFn != nil {
		return m.createProductFn(ctx, req)
	}
	return &models.Product{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Name: req.Name}, nil
}

func (m *mockProductService) GetProduct(ctx context.Context, id uint) (*models.Product, error) {
	if m.getProductFn != nil {
		return m.getProductFn(ctx, id)
	}
	return nil, fmt.Errorf("product not found")
}

func (m *mockProductService) GetProductWithDetails(ctx context.Context, id uint) (*models.Product, error) {
	if m.getWithDetailsFn != nil {
		return m.getWithDetailsFn(ctx, id)
	}
	return nil, fmt.Errorf("product not found")
}

func (m *mockProductService) ListProducts(ctx context.Context, params *services.ListProductsRequest) (*services.ProductListResponse, error) {
	if m.listProductsFn != nil {
		return m.listProductsFn(ctx, params)
	}
	return &services.ProductListResponse{Products: []*models.Product{}, Total: 0}, nil
}

func (m *mockProductService) UpdateProduct(ctx context.Context, id uint, req *services.UpdateProductRequest) error {
	if m.updateProductFn != nil {
		return m.updateProductFn(ctx, id, req)
	}
	return nil
}

func (m *mockProductService) DeleteProduct(ctx context.Context, id uint) error {
	if m.deleteProductFn != nil {
		return m.deleteProductFn(ctx, id)
	}
	return nil
}

func (m *mockProductService) SearchProducts(ctx context.Context, query string, params *services.ListProductsRequest) (*services.ProductListResponse, error) {
	if m.searchProductsFn != nil {
		return m.searchProductsFn(ctx, query, params)
	}
	return &services.ProductListResponse{Products: []*models.Product{}, Total: 0}, nil
}

// mockSKUService is a minimal mock for SKUService (not used in product admin tests)
type mockSKUService struct{}

func (m *mockSKUService) CreateSKU(ctx context.Context, productID uint, req *services.CreateSKURequest) (*models.SKU, error) {
	return nil, nil
}
func (m *mockSKUService) GetSKU(ctx context.Context, id uint) (*models.SKU, error) {
	return nil, nil
}
func (m *mockSKUService) GetSKUWithAttributes(ctx context.Context, id uint) (*models.SKU, error) {
	return nil, nil
}
func (m *mockSKUService) ListSKUsByProduct(ctx context.Context, productID uint) ([]*models.SKU, error) {
	return nil, nil
}
func (m *mockSKUService) UpdateSKU(ctx context.Context, id uint, req *services.UpdateSKURequest) error {
	return nil
}
func (m *mockSKUService) DeleteSKU(ctx context.Context, id uint) error {
	return nil
}
func (m *mockSKUService) CheckSKUAvailability(ctx context.Context, id uint, quantity int) (bool, error) {
	return true, nil
}

func newProductTestRouter() (*gin.Engine, *ProductHandler, *mockProductService) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(response.Middleware())
	svc := &mockProductService{}
	skuSvc := &mockSKUService{}
	h := NewProductHandler(svc, skuSvc)
	return router, h, svc
}

func decodeProductResponse(t *testing.T, body *bytes.Buffer) parsedResponse {
	t.Helper()
	var r parsedResponse
	if err := json.Unmarshal(body.Bytes(), &r); err != nil {
		t.Fatalf("failed to decode response: %v - body: %s", err, body.String())
	}
	return r
}

// --- CreateProduct ---

func TestProductHandler_CreateProduct_Success(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.POST("/api/v1/admin/products", h.CreateProduct)

	svc.createProductFn = func(_ context.Context, req *services.CreateProductRequest) (*models.Product, error) {
		if req.Name != "Test Product" {
			t.Fatalf("expected name 'Test Product', got %q", req.Name)
		}
		if req.Description != "A test product" {
			t.Fatalf("expected description 'A test product', got %q", req.Description)
		}
		if !req.IsActive {
			t.Fatal("expected IsActive to be true by default")
		}
		return &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           req.Name,
			Description:    req.Description,
			IsActive:       req.IsActive,
		}, nil
	}

	body := `{"name":"Test Product","description":"A test product","specifications":"{\"cpu\":\"i7\"}"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeProductResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true, got error %+v", got.Error)
	}
}

func TestProductHandler_CreateProduct_WithCategory(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.POST("/api/v1/admin/products", h.CreateProduct)

	svc.createProductFn = func(_ context.Context, req *services.CreateProductRequest) (*models.Product, error) {
		if req.CategoryID == nil || *req.CategoryID != 5 {
			t.Fatalf("expected category_id=5, got %v", req.CategoryID)
		}
		catID := uint(5)
		return &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           req.Name,
			CategoryID:     &catID,
			IsActive:       true,
		}, nil
	}

	body := `{"name":"Laptop","category_id":5}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateProduct_InvalidCategory(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.POST("/api/v1/admin/products", h.CreateProduct)

	svc.createProductFn = func(_ context.Context, req *services.CreateProductRequest) (*models.Product, error) {
		return nil, fmt.Errorf("invalid category: category not found")
	}

	body := `{"name":"Laptop","category_id":999}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateProduct_MissingName(t *testing.T) {
	router, h, _ := newProductTestRouter()
	router.POST("/api/v1/admin/products", h.CreateProduct)

	body := `{"description":"No name provided"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateProduct_InvalidJSON(t *testing.T) {
	router, h, _ := newProductTestRouter()
	router.POST("/api/v1/admin/products", h.CreateProduct)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products", bytes.NewBufferString("not-json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_CreateProduct_IsActiveExplicitFalse(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.POST("/api/v1/admin/products", h.CreateProduct)

	svc.createProductFn = func(_ context.Context, req *services.CreateProductRequest) (*models.Product, error) {
		if req.IsActive {
			t.Fatal("expected IsActive to be false when explicitly set")
		}
		return &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           req.Name,
			IsActive:       false,
		}, nil
	}

	body := `{"name":"Hidden Product","is_active":false}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/products", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

// --- UpdateProduct ---

func TestProductHandler_UpdateProduct_Success(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.PUT("/api/v1/admin/products/:id", h.UpdateProduct)

	svc.updateProductFn = func(_ context.Context, id uint, req *services.UpdateProductRequest) error {
		if id != 1 {
			t.Fatalf("expected id=1, got %d", id)
		}
		if req.Name == nil || *req.Name != "Updated Name" {
			t.Fatalf("expected name='Updated Name', got %v", req.Name)
		}
		return nil
	}

	body := `{"name":"Updated Name"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/products/1", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_UpdateProduct_PartialUpdate(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.PUT("/api/v1/admin/products/:id", h.UpdateProduct)

	svc.updateProductFn = func(_ context.Context, id uint, req *services.UpdateProductRequest) error {
		if req.IsActive == nil || *req.IsActive != false {
			t.Fatal("expected is_active=false")
		}
		if req.Name != nil {
			t.Fatal("expected name to be nil for partial update")
		}
		return nil
	}

	body := `{"is_active":false}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/products/1", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_UpdateProduct_NotFound(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.PUT("/api/v1/admin/products/:id", h.UpdateProduct)

	svc.updateProductFn = func(_ context.Context, id uint, req *services.UpdateProductRequest) error {
		return fmt.Errorf("product not found")
	}

	body := `{"name":"New Name"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/products/999", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_UpdateProduct_InvalidID(t *testing.T) {
	router, h, _ := newProductTestRouter()
	router.PUT("/api/v1/admin/products/:id", h.UpdateProduct)

	body := `{"name":"New Name"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/products/abc", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_UpdateProduct_EmptyName(t *testing.T) {
	router, h, _ := newProductTestRouter()
	router.PUT("/api/v1/admin/products/:id", h.UpdateProduct)

	body := `{"name":"   "}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/products/1", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty name, got %d: %s", w.Code, w.Body.String())
	}
}

// --- DeleteProduct ---

func TestProductHandler_DeleteProduct_Success(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.DELETE("/api/v1/admin/products/:id", h.DeleteProduct)

	svc.deleteProductFn = func(_ context.Context, id uint) error {
		if id != 1 {
			t.Fatalf("expected id=1, got %d", id)
		}
		return nil
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/products/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_DeleteProduct_PendingOrders(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.DELETE("/api/v1/admin/products/:id", h.DeleteProduct)

	svc.deleteProductFn = func(_ context.Context, id uint) error {
		return fmt.Errorf("cannot delete product with pending orders")
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/products/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_DeleteProduct_NotFound(t *testing.T) {
	router, h, svc := newProductTestRouter()
	router.DELETE("/api/v1/admin/products/:id", h.DeleteProduct)

	svc.deleteProductFn = func(_ context.Context, id uint) error {
		return fmt.Errorf("product not found")
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/products/999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProductHandler_DeleteProduct_InvalidID(t *testing.T) {
	router, h, _ := newProductTestRouter()
	router.DELETE("/api/v1/admin/products/:id", h.DeleteProduct)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/products/xyz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
