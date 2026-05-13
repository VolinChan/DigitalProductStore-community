package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/pkg/response"
)

// mockBannerRepository is a mock implementation of repositories.BannerRepository
type mockBannerRepository struct {
	createFn          func(ctx context.Context, banner *models.Banner) error
	getByIDFn         func(ctx context.Context, id uint) (*models.Banner, error)
	listFn            func(ctx context.Context, page, perPage int) ([]*models.Banner, int64, error)
	updateFn          func(ctx context.Context, banner *models.Banner) error
	deleteFn          func(ctx context.Context, id uint) error
	getActiveBannersFn func(ctx context.Context) ([]*models.Banner, error)
}

func (m *mockBannerRepository) Create(ctx context.Context, banner *models.Banner) error {
	if m.createFn != nil {
		return m.createFn(ctx, banner)
	}
	banner.ID = 1
	return nil
}

func (m *mockBannerRepository) GetByID(ctx context.Context, id uint) (*models.Banner, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, fmt.Errorf("banner not found")
}

func (m *mockBannerRepository) List(ctx context.Context, page, perPage int) ([]*models.Banner, int64, error) {
	if m.listFn != nil {
		return m.listFn(ctx, page, perPage)
	}
	return []*models.Banner{}, 0, nil
}

func (m *mockBannerRepository) Update(ctx context.Context, banner *models.Banner) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, banner)
	}
	return nil
}

func (m *mockBannerRepository) Delete(ctx context.Context, id uint) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func (m *mockBannerRepository) GetActiveBanners(ctx context.Context) ([]*models.Banner, error) {
	if m.getActiveBannersFn != nil {
		return m.getActiveBannersFn(ctx)
	}
	return []*models.Banner{}, nil
}

// Verify interface compliance
var _ repositories.BannerRepository = (*mockBannerRepository)(nil)

func setupBannerTestRouter(handler *BannerHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(response.Middleware())
	return router
}

func TestCreateBanner_Success(t *testing.T) {
	repo := &mockBannerRepository{
		createFn: func(ctx context.Context, banner *models.Banner) error {
			banner.ID = 1
			return nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.POST("/api/v1/admin/banners", handler.CreateBanner)

	priority := 10
	body := CreateBannerRequest{
		Title:    "Summer Sale",
		ImageURL: "https://example.com/banner.jpg",
		LinkURL:  "https://example.com/sale",
		Priority: &priority,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/banners", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateBanner_WithDates(t *testing.T) {
	repo := &mockBannerRepository{
		createFn: func(ctx context.Context, banner *models.Banner) error {
			banner.ID = 1
			if banner.StartDate == nil || banner.EndDate == nil {
				t.Error("expected start_date and end_date to be set")
			}
			return nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.POST("/api/v1/admin/banners", handler.CreateBanner)

	startDate := "2024-01-01T00:00:00Z"
	endDate := "2024-12-31T23:59:59Z"
	body := CreateBannerRequest{
		Title:     "Holiday Sale",
		ImageURL:  "https://example.com/holiday.jpg",
		StartDate: &startDate,
		EndDate:   &endDate,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/banners", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateBanner_InvalidDateRange(t *testing.T) {
	repo := &mockBannerRepository{}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.POST("/api/v1/admin/banners", handler.CreateBanner)

	startDate := "2024-12-31T23:59:59Z"
	endDate := "2024-01-01T00:00:00Z"
	body := CreateBannerRequest{
		Title:     "Invalid Range",
		ImageURL:  "https://example.com/banner.jpg",
		StartDate: &startDate,
		EndDate:   &endDate,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/banners", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateBanner_MissingImageURL(t *testing.T) {
	repo := &mockBannerRepository{}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.POST("/api/v1/admin/banners", handler.CreateBanner)

	body := CreateBannerRequest{
		Title: "No Image",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/banners", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateBanner_InvalidBody(t *testing.T) {
	repo := &mockBannerRepository{}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.POST("/api/v1/admin/banners", handler.CreateBanner)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/banners", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateBanner_InvalidStartDateFormat(t *testing.T) {
	repo := &mockBannerRepository{}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.POST("/api/v1/admin/banners", handler.CreateBanner)

	startDate := "not-a-date"
	body := CreateBannerRequest{
		Title:     "Bad Date",
		ImageURL:  "https://example.com/banner.jpg",
		StartDate: &startDate,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/banners", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateBanner_Success(t *testing.T) {
	now := time.Now()
	repo := &mockBannerRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Banner, error) {
			return &models.Banner{
				BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
				Title:          "Old Title",
				ImageURL:       "https://example.com/old.jpg",
				IsActive:       true,
			}, nil
		},
		updateFn: func(ctx context.Context, banner *models.Banner) error {
			return nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.PUT("/api/v1/admin/banners/:id", handler.UpdateBanner)

	newTitle := "New Title"
	body := UpdateBannerRequest{
		Title: &newTitle,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/banners/1", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateBanner_NotFound(t *testing.T) {
	repo := &mockBannerRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Banner, error) {
			return nil, fmt.Errorf("banner not found")
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.PUT("/api/v1/admin/banners/:id", handler.UpdateBanner)

	newTitle := "New Title"
	body := UpdateBannerRequest{
		Title: &newTitle,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/banners/999", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateBanner_InvalidID(t *testing.T) {
	repo := &mockBannerRepository{}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.PUT("/api/v1/admin/banners/:id", handler.UpdateBanner)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/banners/abc", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateBanner_DisableBanner(t *testing.T) {
	now := time.Now()
	repo := &mockBannerRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Banner, error) {
			return &models.Banner{
				BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
				Title:          "Active Banner",
				ImageURL:       "https://example.com/banner.jpg",
				IsActive:       true,
			}, nil
		},
		updateFn: func(ctx context.Context, banner *models.Banner) error {
			if banner.IsActive {
				t.Error("expected banner to be disabled")
			}
			return nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.PUT("/api/v1/admin/banners/:id", handler.UpdateBanner)

	isActive := false
	body := UpdateBannerRequest{
		IsActive: &isActive,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/banners/1", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteBanner_Success(t *testing.T) {
	repo := &mockBannerRepository{
		deleteFn: func(ctx context.Context, id uint) error {
			return nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.DELETE("/api/v1/admin/banners/:id", handler.DeleteBanner)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/banners/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteBanner_NotFound(t *testing.T) {
	repo := &mockBannerRepository{
		deleteFn: func(ctx context.Context, id uint) error {
			return fmt.Errorf("banner not found")
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.DELETE("/api/v1/admin/banners/:id", handler.DeleteBanner)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/banners/999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteBanner_InvalidID(t *testing.T) {
	repo := &mockBannerRepository{}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.DELETE("/api/v1/admin/banners/:id", handler.DeleteBanner)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/banners/abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListBanners_Success(t *testing.T) {
	now := time.Now()
	repo := &mockBannerRepository{
		listFn: func(ctx context.Context, page, perPage int) ([]*models.Banner, int64, error) {
			return []*models.Banner{
				{
					BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
					Title:          "Banner 1",
					ImageURL:       "https://example.com/1.jpg",
					Priority:       10,
					IsActive:       true,
				},
				{
					BaseWithUpdate: models.BaseWithUpdate{ID: 2, CreatedAt: now, UpdatedAt: now},
					Title:          "Banner 2",
					ImageURL:       "https://example.com/2.jpg",
					Priority:       5,
					IsActive:       false,
				},
			}, 2, nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.GET("/api/v1/admin/banners", handler.ListBanners)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/banners?page=1&per_page=10", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp response.Response
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if !resp.Success {
		t.Error("expected success to be true")
	}
	if resp.Meta == nil {
		t.Error("expected meta to be present")
	} else if resp.Meta.Total != 2 {
		t.Errorf("expected total 2, got %d", resp.Meta.Total)
	}
}

func TestListBanners_DefaultPagination(t *testing.T) {
	repo := &mockBannerRepository{
		listFn: func(ctx context.Context, page, perPage int) ([]*models.Banner, int64, error) {
			if page != 1 {
				t.Errorf("expected default page 1, got %d", page)
			}
			if perPage != 20 {
				t.Errorf("expected default per_page 20, got %d", perPage)
			}
			return []*models.Banner{}, 0, nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.GET("/api/v1/admin/banners", handler.ListBanners)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/banners", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetActiveBanners_Success(t *testing.T) {
	now := time.Now()
	startDate := now.Add(-24 * time.Hour)
	endDate := now.Add(24 * time.Hour)
	repo := &mockBannerRepository{
		getActiveBannersFn: func(ctx context.Context) ([]*models.Banner, error) {
			return []*models.Banner{
				{
					BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
					Title:          "Active Banner",
					ImageURL:       "https://example.com/active.jpg",
					Priority:       10,
					IsActive:       true,
					StartDate:      &startDate,
					EndDate:        &endDate,
				},
			}, nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.GET("/api/v1/banners", handler.GetActiveBanners)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/banners", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp response.Response
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if !resp.Success {
		t.Error("expected success to be true")
	}
}

func TestGetActiveBanners_Empty(t *testing.T) {
	repo := &mockBannerRepository{
		getActiveBannersFn: func(ctx context.Context) ([]*models.Banner, error) {
			return []*models.Banner{}, nil
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.GET("/api/v1/banners", handler.GetActiveBanners)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/banners", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetActiveBanners_Error(t *testing.T) {
	repo := &mockBannerRepository{
		getActiveBannersFn: func(ctx context.Context) ([]*models.Banner, error) {
			return nil, fmt.Errorf("database error")
		},
	}
	handler := NewBannerHandler(repo)
	router := setupBannerTestRouter(handler)
	router.GET("/api/v1/banners", handler.GetActiveBanners)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/banners", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d: %s", w.Code, w.Body.String())
	}
}
