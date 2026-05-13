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

// mockAnnouncementRepository is a mock implementation of repositories.AnnouncementRepository
type mockAnnouncementRepository struct {
	createFn               func(ctx context.Context, announcement *models.Announcement) error
	getByIDFn              func(ctx context.Context, id uint) (*models.Announcement, error)
	listFn                 func(ctx context.Context, page, perPage int) ([]*models.Announcement, int64, error)
	updateFn               func(ctx context.Context, announcement *models.Announcement) error
	deleteFn               func(ctx context.Context, id uint) error
	getActiveAnnouncementsFn func(ctx context.Context) ([]*models.Announcement, error)
}

func (m *mockAnnouncementRepository) Create(ctx context.Context, announcement *models.Announcement) error {
	if m.createFn != nil {
		return m.createFn(ctx, announcement)
	}
	announcement.ID = 1
	return nil
}

func (m *mockAnnouncementRepository) GetByID(ctx context.Context, id uint) (*models.Announcement, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, fmt.Errorf("announcement not found")
}

func (m *mockAnnouncementRepository) List(ctx context.Context, page, perPage int) ([]*models.Announcement, int64, error) {
	if m.listFn != nil {
		return m.listFn(ctx, page, perPage)
	}
	return []*models.Announcement{}, 0, nil
}

func (m *mockAnnouncementRepository) Update(ctx context.Context, announcement *models.Announcement) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, announcement)
	}
	return nil
}

func (m *mockAnnouncementRepository) Delete(ctx context.Context, id uint) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func (m *mockAnnouncementRepository) GetActiveAnnouncements(ctx context.Context) ([]*models.Announcement, error) {
	if m.getActiveAnnouncementsFn != nil {
		return m.getActiveAnnouncementsFn(ctx)
	}
	return []*models.Announcement{}, nil
}

// Verify interface compliance
var _ repositories.AnnouncementRepository = (*mockAnnouncementRepository)(nil)

func setupAnnouncementTestRouter(handler *AnnouncementHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(response.Middleware())
	return router
}

func TestCreateAnnouncement_Success(t *testing.T) {
	repo := &mockAnnouncementRepository{
		createFn: func(ctx context.Context, announcement *models.Announcement) error {
			announcement.ID = 1
			if announcement.Title != "System Maintenance" {
				t.Errorf("expected title 'System Maintenance', got '%s'", announcement.Title)
			}
			if announcement.Type != models.AnnouncementTypeWarning {
				t.Errorf("expected type 'warning', got '%s'", announcement.Type)
			}
			if announcement.Priority != models.PriorityHigh {
				t.Errorf("expected priority 'high', got '%s'", announcement.Priority)
			}
			return nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	body := CreateAnnouncementRequest{
		Title:    "System Maintenance",
		Content:  "The system will be down for maintenance on Saturday.",
		Type:     "warning",
		Priority: "high",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_DefaultTypeAndPriority(t *testing.T) {
	repo := &mockAnnouncementRepository{
		createFn: func(ctx context.Context, announcement *models.Announcement) error {
			announcement.ID = 1
			if announcement.Type != models.AnnouncementTypeInfo {
				t.Errorf("expected default type 'info', got '%s'", announcement.Type)
			}
			if announcement.Priority != models.PriorityMedium {
				t.Errorf("expected default priority 'medium', got '%s'", announcement.Priority)
			}
			return nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	body := CreateAnnouncementRequest{
		Title:   "General Info",
		Content: "Some general information.",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_WithDates(t *testing.T) {
	repo := &mockAnnouncementRepository{
		createFn: func(ctx context.Context, announcement *models.Announcement) error {
			announcement.ID = 1
			if announcement.StartDate == nil || announcement.EndDate == nil {
				t.Error("expected start_date and end_date to be set")
			}
			return nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	startDate := "2024-01-01T00:00:00Z"
	endDate := "2024-12-31T23:59:59Z"
	body := CreateAnnouncementRequest{
		Title:     "Holiday Promotion",
		Content:   "Special holiday deals!",
		Type:      "promotion",
		StartDate: &startDate,
		EndDate:   &endDate,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_InvalidDateRange(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	startDate := "2024-12-31T23:59:59Z"
	endDate := "2024-01-01T00:00:00Z"
	body := CreateAnnouncementRequest{
		Title:     "Invalid Range",
		Content:   "This should fail.",
		StartDate: &startDate,
		EndDate:   &endDate,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_MissingTitle(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	body := CreateAnnouncementRequest{
		Content: "Content without title",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_MissingContent(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	body := CreateAnnouncementRequest{
		Title: "Title without content",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_InvalidType(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	body := map[string]string{
		"title":   "Test",
		"content": "Test content",
		"type":    "invalid_type",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_InvalidPriority(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	body := map[string]string{
		"title":    "Test",
		"content":  "Test content",
		"priority": "critical",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAnnouncement_InvalidBody(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.POST("/api/v1/admin/announcements", handler.CreateAnnouncement)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/announcements", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateAnnouncement_Success(t *testing.T) {
	now := time.Now()
	repo := &mockAnnouncementRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Announcement, error) {
			return &models.Announcement{
				BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
				Title:          "Old Title",
				Content:        "Old content",
				Type:           models.AnnouncementTypeInfo,
				Priority:       models.PriorityMedium,
				IsActive:       true,
			}, nil
		},
		updateFn: func(ctx context.Context, announcement *models.Announcement) error {
			if announcement.Title != "New Title" {
				t.Errorf("expected title 'New Title', got '%s'", announcement.Title)
			}
			return nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.PUT("/api/v1/admin/announcements/:id", handler.UpdateAnnouncement)

	newTitle := "New Title"
	body := UpdateAnnouncementRequest{
		Title: &newTitle,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/announcements/1", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateAnnouncement_NotFound(t *testing.T) {
	repo := &mockAnnouncementRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Announcement, error) {
			return nil, fmt.Errorf("announcement not found")
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.PUT("/api/v1/admin/announcements/:id", handler.UpdateAnnouncement)

	newTitle := "New Title"
	body := UpdateAnnouncementRequest{
		Title: &newTitle,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/announcements/999", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateAnnouncement_InvalidID(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.PUT("/api/v1/admin/announcements/:id", handler.UpdateAnnouncement)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/announcements/abc", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateAnnouncement_DisableAnnouncement(t *testing.T) {
	now := time.Now()
	repo := &mockAnnouncementRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Announcement, error) {
			return &models.Announcement{
				BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
				Title:          "Active Announcement",
				Content:        "Some content",
				Type:           models.AnnouncementTypeInfo,
				Priority:       models.PriorityMedium,
				IsActive:       true,
			}, nil
		},
		updateFn: func(ctx context.Context, announcement *models.Announcement) error {
			if announcement.IsActive {
				t.Error("expected announcement to be disabled")
			}
			return nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.PUT("/api/v1/admin/announcements/:id", handler.UpdateAnnouncement)

	isActive := false
	body := UpdateAnnouncementRequest{
		IsActive: &isActive,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/announcements/1", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateAnnouncement_ChangePriority(t *testing.T) {
	now := time.Now()
	repo := &mockAnnouncementRepository{
		getByIDFn: func(ctx context.Context, id uint) (*models.Announcement, error) {
			return &models.Announcement{
				BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
				Title:          "Test",
				Content:        "Content",
				Type:           models.AnnouncementTypeInfo,
				Priority:       models.PriorityMedium,
				IsActive:       true,
			}, nil
		},
		updateFn: func(ctx context.Context, announcement *models.Announcement) error {
			if announcement.Priority != models.PriorityHigh {
				t.Errorf("expected priority 'high', got '%s'", announcement.Priority)
			}
			return nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.PUT("/api/v1/admin/announcements/:id", handler.UpdateAnnouncement)

	priority := "high"
	body := UpdateAnnouncementRequest{
		Priority: &priority,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/announcements/1", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAnnouncement_Success(t *testing.T) {
	repo := &mockAnnouncementRepository{
		deleteFn: func(ctx context.Context, id uint) error {
			return nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.DELETE("/api/v1/admin/announcements/:id", handler.DeleteAnnouncement)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/announcements/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAnnouncement_NotFound(t *testing.T) {
	repo := &mockAnnouncementRepository{
		deleteFn: func(ctx context.Context, id uint) error {
			return fmt.Errorf("announcement not found")
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.DELETE("/api/v1/admin/announcements/:id", handler.DeleteAnnouncement)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/announcements/999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAnnouncement_InvalidID(t *testing.T) {
	repo := &mockAnnouncementRepository{}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.DELETE("/api/v1/admin/announcements/:id", handler.DeleteAnnouncement)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/announcements/abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListAnnouncements_Success(t *testing.T) {
	now := time.Now()
	repo := &mockAnnouncementRepository{
		listFn: func(ctx context.Context, page, perPage int) ([]*models.Announcement, int64, error) {
			return []*models.Announcement{
				{
					BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
					Title:          "Announcement 1",
					Content:        "Content 1",
					Type:           models.AnnouncementTypeInfo,
					Priority:       models.PriorityHigh,
					IsActive:       true,
				},
				{
					BaseWithUpdate: models.BaseWithUpdate{ID: 2, CreatedAt: now, UpdatedAt: now},
					Title:          "Announcement 2",
					Content:        "Content 2",
					Type:           models.AnnouncementTypeWarning,
					Priority:       models.PriorityMedium,
					IsActive:       false,
				},
			}, 2, nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.GET("/api/v1/admin/announcements", handler.ListAnnouncements)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/announcements?page=1&per_page=10", nil)
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

func TestListAnnouncements_DefaultPagination(t *testing.T) {
	repo := &mockAnnouncementRepository{
		listFn: func(ctx context.Context, page, perPage int) ([]*models.Announcement, int64, error) {
			if page != 1 {
				t.Errorf("expected default page 1, got %d", page)
			}
			if perPage != 20 {
				t.Errorf("expected default per_page 20, got %d", perPage)
			}
			return []*models.Announcement{}, 0, nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.GET("/api/v1/admin/announcements", handler.ListAnnouncements)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/announcements", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetActiveAnnouncements_Success(t *testing.T) {
	now := time.Now()
	startDate := now.Add(-24 * time.Hour)
	endDate := now.Add(24 * time.Hour)
	repo := &mockAnnouncementRepository{
		getActiveAnnouncementsFn: func(ctx context.Context) ([]*models.Announcement, error) {
			return []*models.Announcement{
				{
					BaseWithUpdate: models.BaseWithUpdate{ID: 1, CreatedAt: now, UpdatedAt: now},
					Title:          "High Priority",
					Content:        "Important announcement",
					Type:           models.AnnouncementTypeWarning,
					Priority:       models.PriorityHigh,
					IsActive:       true,
					StartDate:      &startDate,
					EndDate:        &endDate,
				},
				{
					BaseWithUpdate: models.BaseWithUpdate{ID: 2, CreatedAt: now, UpdatedAt: now},
					Title:          "Low Priority",
					Content:        "General info",
					Type:           models.AnnouncementTypeInfo,
					Priority:       models.PriorityLow,
					IsActive:       true,
				},
			}, nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.GET("/api/v1/announcements", handler.GetActiveAnnouncements)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/announcements", nil)
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

func TestGetActiveAnnouncements_Empty(t *testing.T) {
	repo := &mockAnnouncementRepository{
		getActiveAnnouncementsFn: func(ctx context.Context) ([]*models.Announcement, error) {
			return []*models.Announcement{}, nil
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.GET("/api/v1/announcements", handler.GetActiveAnnouncements)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/announcements", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetActiveAnnouncements_Error(t *testing.T) {
	repo := &mockAnnouncementRepository{
		getActiveAnnouncementsFn: func(ctx context.Context) ([]*models.Announcement, error) {
			return nil, fmt.Errorf("database error")
		},
	}
	handler := NewAnnouncementHandler(repo)
	router := setupAnnouncementTestRouter(handler)
	router.GET("/api/v1/announcements", handler.GetActiveAnnouncements)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/announcements", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d: %s", w.Code, w.Body.String())
	}
}
