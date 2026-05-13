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
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/pkg/response"
)

// mockCategoryRepository is a mock implementation of repositories.CategoryRepository
type mockCategoryRepository struct {
	createFn        func(ctx context.Context, category *models.Category) error
	getByIDFn       func(ctx context.Context, id uint) (*models.Category, error)
	getBySlugFn     func(ctx context.Context, slug string) (*models.Category, error)
	listFn          func(ctx context.Context) ([]*models.Category, error)
	listByParentFn  func(ctx context.Context, parentID *uint) ([]*models.Category, error)
	updateFn        func(ctx context.Context, category *models.Category) error
	deleteFn        func(ctx context.Context, id uint) error
	getWithChildFn  func(ctx context.Context, id uint) (*models.Category, error)
}

func (m *mockCategoryRepository) Create(ctx context.Context, category *models.Category) error {
	if m.createFn != nil {
		return m.createFn(ctx, category)
	}
	category.ID = 1
	return nil
}

func (m *mockCategoryRepository) GetByID(ctx context.Context, id uint) (*models.Category, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, fmt.Errorf("category not found")
}

func (m *mockCategoryRepository) GetBySlug(ctx context.Context, slug string) (*models.Category, error) {
	if m.getBySlugFn != nil {
		return m.getBySlugFn(ctx, slug)
	}
	return nil, fmt.Errorf("category not found")
}

func (m *mockCategoryRepository) List(ctx context.Context) ([]*models.Category, error) {
	if m.listFn != nil {
		return m.listFn(ctx)
	}
	return []*models.Category{}, nil
}

func (m *mockCategoryRepository) ListByParent(ctx context.Context, parentID *uint) ([]*models.Category, error) {
	if m.listByParentFn != nil {
		return m.listByParentFn(ctx, parentID)
	}
	return []*models.Category{}, nil
}

func (m *mockCategoryRepository) Update(ctx context.Context, category *models.Category) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, category)
	}
	return nil
}

func (m *mockCategoryRepository) Delete(ctx context.Context, id uint) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func (m *mockCategoryRepository) GetWithChildren(ctx context.Context, id uint) (*models.Category, error) {
	if m.getWithChildFn != nil {
		return m.getWithChildFn(ctx, id)
	}
	return nil, fmt.Errorf("category not found")
}

// Verify interface compliance
var _ repositories.CategoryRepository = (*mockCategoryRepository)(nil)

func setupCategoryTestRouter(handler *CategoryHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(response.Middleware())
	return router
}

func TestCreateCategory_Success(t *testing.T) {
	repo := &mockCategoryRepository{
		getBySlugFn: func(ctx context.Context, slug string) (*models.Category, error) {
			return nil, fmt.Errorf("category not found")
		},
		createFn: func(ctx context.Context, category *models.Category) error {
			category.ID = 1
			return nil
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.POST("/api/v1/admin/categories", handler.CreateCategory)

	body := AdminCreateCategoryRequest{
		Name: "Electronics",
		Slug: "electronics",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/categories", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateCategory_WithParent(t *testing.T) {
	parentID := uint(1)
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			if id == 1 {
				return &models.Category{Base: models.Base{ID: 1}, Name: "Parent", Slug: "parent"}, nil
			}
			return nil, fmt.Errorf("category not found")
		},
		getBySlugFn: func(ctx context.Context, slug string) (*models.Category, error) {
			return nil, fmt.Errorf("category not found")
		},
		createFn: func(ctx context.Context, category *models.Category) error {
			category.ID = 2
			return nil
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.POST("/api/v1/admin/categories", handler.CreateCategory)

	body := AdminCreateCategoryRequest{
		Name:     "Phones",
		Slug:     "phones",
		ParentID: &parentID,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/categories", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateCategory_DuplicateSlug(t *testing.T) {
	repo := &mockCategoryRepository{
		getBySlugFn: func(ctx context.Context, slug string) (*models.Category, error) {
			return &models.Category{Base: models.Base{ID: 1}, Name: "Existing", Slug: slug}, nil
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.POST("/api/v1/admin/categories", handler.CreateCategory)

	body := AdminCreateCategoryRequest{
		Name: "Electronics",
		Slug: "electronics",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/categories", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateCategory_InvalidParent(t *testing.T) {
	parentID := uint(999)
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return nil, fmt.Errorf("category not found")
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.POST("/api/v1/admin/categories", handler.CreateCategory)

	body := AdminCreateCategoryRequest{
		Name:     "Phones",
		Slug:     "phones",
		ParentID: &parentID,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/categories", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateCategory_InvalidBody(t *testing.T) {
	repo := &mockCategoryRepository{}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.POST("/api/v1/admin/categories", handler.CreateCategory)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/categories", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCategory_Success(t *testing.T) {
	newName := "Updated Electronics"
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return &models.Category{Base: models.Base{ID: 1}, Name: "Electronics", Slug: "electronics"}, nil
		},
		updateFn: func(ctx context.Context, category *models.Category) error {
			return nil
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.PUT("/api/v1/admin/categories/:id", handler.UpdateCategory)

	body := AdminUpdateCategoryRequest{
		Name: &newName,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/categories/1", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCategory_NotFound(t *testing.T) {
	newName := "Updated"
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return nil, fmt.Errorf("category not found")
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.PUT("/api/v1/admin/categories/:id", handler.UpdateCategory)

	body := AdminUpdateCategoryRequest{
		Name: &newName,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/categories/999", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCategory_SelfParent(t *testing.T) {
	parentID := uint(1)
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return &models.Category{Base: models.Base{ID: 1}, Name: "Electronics", Slug: "electronics"}, nil
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.PUT("/api/v1/admin/categories/:id", handler.UpdateCategory)

	body := AdminUpdateCategoryRequest{
		ParentID: &parentID,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/categories/1", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCategory_InvalidID(t *testing.T) {
	repo := &mockCategoryRepository{}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.PUT("/api/v1/admin/categories/:id", handler.UpdateCategory)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/categories/abc", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCategory_Success(t *testing.T) {
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return &models.Category{Base: models.Base{ID: 1}, Name: "Electronics", Slug: "electronics"}, nil
		},
		deleteFn: func(ctx context.Context, id uint) error {
			return nil
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.DELETE("/api/v1/admin/categories/:id", handler.DeleteCategory)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/categories/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCategory_NotFound(t *testing.T) {
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return nil, fmt.Errorf("category not found")
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.DELETE("/api/v1/admin/categories/:id", handler.DeleteCategory)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/categories/999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCategory_HasChildren(t *testing.T) {
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return &models.Category{Base: models.Base{ID: 1}, Name: "Electronics", Slug: "electronics"}, nil
		},
		deleteFn: func(ctx context.Context, id uint) error {
			return fmt.Errorf("cannot delete category with children")
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.DELETE("/api/v1/admin/categories/:id", handler.DeleteCategory)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/categories/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCategory_HasProducts(t *testing.T) {
	repo := &mockCategoryRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Category, error) {
			return &models.Category{Base: models.Base{ID: 1}, Name: "Electronics", Slug: "electronics"}, nil
		},
		deleteFn: func(ctx context.Context, id uint) error {
			return fmt.Errorf("cannot delete category with products")
		},
	}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.DELETE("/api/v1/admin/categories/:id", handler.DeleteCategory)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/categories/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCategory_InvalidID(t *testing.T) {
	repo := &mockCategoryRepository{}
	handler := NewCategoryHandler(repo)
	router := setupCategoryTestRouter(handler)
	router.DELETE("/api/v1/admin/categories/:id", handler.DeleteCategory)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/categories/abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}
