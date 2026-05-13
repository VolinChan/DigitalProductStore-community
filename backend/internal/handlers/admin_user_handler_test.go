package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
	"github.com/digital-store/backend/pkg/utils"
)

// mockUserRepo implements repositories.UserRepository for testing.
type mockUserRepo struct {
	getByIDFn          func(ctx context.Context, id uint) (*models.User, error)
	getByEmailFn       func(ctx context.Context, email string) (*models.User, error)
	searchUsersFn      func(ctx context.Context, params *repositories.ListUsersParams) ([]*models.User, int64, error)
	setActiveFn        func(ctx context.Context, userID uint, isActive bool) error
	countOrdersFn      func(ctx context.Context, userID uint) (int64, error)
	createFn           func(ctx context.Context, user *models.User) error
	updateFn           func(ctx context.Context, user *models.User) error
	deleteFn           func(ctx context.Context, id uint) error
	listFn             func(ctx context.Context, offset, limit int) ([]*models.User, int64, error)
	updatePasswordFn   func(ctx context.Context, userID uint, passwordHash string) error
	existsByEmailFn    func(ctx context.Context, email string) (bool, error)
}

func (m *mockUserRepo) Create(ctx context.Context, user *models.User) error {
	if m.createFn != nil {
		return m.createFn(ctx, user)
	}
	return nil
}

func (m *mockUserRepo) GetByID(ctx context.Context, id uint) (*models.User, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, repositories.ErrUserNotFound
}

func (m *mockUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	if m.getByEmailFn != nil {
		return m.getByEmailFn(ctx, email)
	}
	return nil, repositories.ErrUserNotFound
}

func (m *mockUserRepo) Update(ctx context.Context, user *models.User) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, user)
	}
	return nil
}

func (m *mockUserRepo) Delete(ctx context.Context, id uint) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func (m *mockUserRepo) List(ctx context.Context, offset, limit int) ([]*models.User, int64, error) {
	if m.listFn != nil {
		return m.listFn(ctx, offset, limit)
	}
	return []*models.User{}, 0, nil
}

func (m *mockUserRepo) SearchUsers(ctx context.Context, params *repositories.ListUsersParams) ([]*models.User, int64, error) {
	if m.searchUsersFn != nil {
		return m.searchUsersFn(ctx, params)
	}
	return []*models.User{}, 0, nil
}

func (m *mockUserRepo) UpdatePassword(ctx context.Context, userID uint, passwordHash string) error {
	if m.updatePasswordFn != nil {
		return m.updatePasswordFn(ctx, userID, passwordHash)
	}
	return nil
}

func (m *mockUserRepo) SetActive(ctx context.Context, userID uint, isActive bool) error {
	if m.setActiveFn != nil {
		return m.setActiveFn(ctx, userID, isActive)
	}
	return nil
}

func (m *mockUserRepo) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	if m.existsByEmailFn != nil {
		return m.existsByEmailFn(ctx, email)
	}
	return false, nil
}

func (m *mockUserRepo) CountOrdersByUserID(ctx context.Context, userID uint) (int64, error) {
	if m.countOrdersFn != nil {
		return m.countOrdersFn(ctx, userID)
	}
	return 0, nil
}

// mockAuthService implements services.AuthService for testing.
type mockAuthService struct {
	requestPasswordResetFn func(ctx context.Context, email string) error
}

func (m *mockAuthService) Register(_ context.Context, _ *services.RegisterRequest) (*models.User, error) {
	return nil, nil
}
func (m *mockAuthService) Login(_ context.Context, _, _ string) (*services.AuthToken, error) {
	return nil, nil
}
func (m *mockAuthService) AdminLogin(_ context.Context, _, _ string) (*services.AuthToken, error) {
	return nil, nil
}
func (m *mockAuthService) Logout(_ context.Context, _ string) error { return nil }
func (m *mockAuthService) ValidateToken(_ context.Context, _ string) (*utils.Claims, error) {
	return nil, nil
}
func (m *mockAuthService) RefreshToken(_ context.Context, _ string) (*services.AuthToken, error) {
	return nil, nil
}
func (m *mockAuthService) RequestPasswordReset(ctx context.Context, email string) error {
	if m.requestPasswordResetFn != nil {
		return m.requestPasswordResetFn(ctx, email)
	}
	return nil
}
func (m *mockAuthService) ResetPassword(_ context.Context, _, _ string) error { return nil }
func (m *mockAuthService) CheckAccountLock(_ context.Context, _ uint) (bool, time.Time, error) {
	return false, time.Time{}, nil
}
func (m *mockAuthService) LockAccount(_ context.Context, _ uint, _ time.Duration) error { return nil }

// newAdminUserTestRouter sets up a gin engine with the response middleware and
// returns an AdminUserHandler backed by mock dependencies.
func newAdminUserTestRouter(adminUserID *uint) (*gin.Engine, *AdminUserHandler, *mockUserRepo, *mockAuthService) {
	router := gin.New()
	router.Use(response.Middleware())
	if adminUserID != nil {
		uid := *adminUserID
		router.Use(func(c *gin.Context) {
			c.Set("user_id", uid)
			c.Set("user_role", string(models.RoleSuperAdmin))
			c.Next()
		})
	}
	repo := &mockUserRepo{}
	authSvc := &mockAuthService{}
	h := NewAdminUserHandler(repo, authSvc)
	return router, h, repo, authSvc
}

// --- ListUsers ---

func TestAdminUserHandler_ListUsers_Success(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.GET("/api/v1/admin/users", h.ListUsers)

	repo.searchUsersFn = func(_ context.Context, params *repositories.ListUsersParams) ([]*models.User, int64, error) {
		if params.Limit != 20 {
			t.Fatalf("expected limit=20, got %d", params.Limit)
		}
		if params.Offset != 0 {
			t.Fatalf("expected offset=0, got %d", params.Offset)
		}
		return []*models.User{
			{
				BaseWithUpdate: models.BaseWithUpdate{ID: 2},
				Email:          "user@example.com",
				FullName:       "Test User",
				Role:           models.RoleUser,
				IsActive:       true,
			},
		}, 1, nil
	}
	repo.countOrdersFn = func(_ context.Context, userID uint) (int64, error) {
		return 5, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
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

func TestAdminUserHandler_ListUsers_WithSearch(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.GET("/api/v1/admin/users", h.ListUsers)

	var capturedSearch string
	repo.searchUsersFn = func(_ context.Context, params *repositories.ListUsersParams) ([]*models.User, int64, error) {
		capturedSearch = params.Search
		return []*models.User{}, 0, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users?search=test@example.com", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if capturedSearch != "test@example.com" {
		t.Fatalf("expected search=test@example.com, got %q", capturedSearch)
	}
}

func TestAdminUserHandler_ListUsers_Pagination(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.GET("/api/v1/admin/users", h.ListUsers)

	repo.searchUsersFn = func(_ context.Context, params *repositories.ListUsersParams) ([]*models.User, int64, error) {
		if params.Offset != 10 {
			t.Fatalf("expected offset=10, got %d", params.Offset)
		}
		if params.Limit != 10 {
			t.Fatalf("expected limit=10, got %d", params.Limit)
		}
		return []*models.User{}, 25, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users?page=2&page_size=10", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decode(t, w.Body)
	if got.Meta == nil || got.Meta.TotalPages != 3 {
		t.Fatalf("expected total_pages=3, got %+v", got.Meta)
	}
}

func TestAdminUserHandler_ListUsers_InternalError(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.GET("/api/v1/admin/users", h.ListUsers)

	repo.searchUsersFn = func(_ context.Context, _ *repositories.ListUsersParams) ([]*models.User, int64, error) {
		return nil, 0, errors.New("database error")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetUser ---

func TestAdminUserHandler_GetUser_Success(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.GET("/api/v1/admin/users/:id", h.GetUser)

	repo.getByIDFn = func(_ context.Context, id uint) (*models.User, error) {
		return &models.User{
			BaseWithUpdate: models.BaseWithUpdate{ID: id},
			Email:          "user@example.com",
			FullName:       "Test User",
			Phone:          "+1234567890",
			Role:           models.RoleUser,
			IsActive:       true,
		}, nil
	}
	repo.countOrdersFn = func(_ context.Context, _ uint) (int64, error) {
		return 3, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/42", nil)
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

func TestAdminUserHandler_GetUser_NotFound(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.GET("/api/v1/admin/users/:id", h.GetUser)

	repo.getByIDFn = func(_ context.Context, _ uint) (*models.User, error) {
		return nil, repositories.ErrUserNotFound
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestAdminUserHandler_GetUser_InvalidID(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newAdminUserTestRouter(&adminID)
	router.GET("/api/v1/admin/users/:id", h.GetUser)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- DisableUser ---

func TestAdminUserHandler_DisableUser_Success(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.PUT("/api/v1/admin/users/:id/disable", h.DisableUser)

	repo.getByIDFn = func(_ context.Context, id uint) (*models.User, error) {
		return &models.User{
			BaseWithUpdate: models.BaseWithUpdate{ID: id},
			Email:          "user@example.com",
			IsActive:       true,
		}, nil
	}

	var disabledUserID uint
	var disabledActive bool
	repo.setActiveFn = func(_ context.Context, userID uint, isActive bool) error {
		disabledUserID = userID
		disabledActive = isActive
		return nil
	}

	body := `{"reason":"suspicious activity"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/users/42/disable", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if disabledUserID != 42 {
		t.Fatalf("expected user 42 to be disabled, got %d", disabledUserID)
	}
	if disabledActive != false {
		t.Fatalf("expected isActive=false")
	}
}

func TestAdminUserHandler_DisableUser_CannotDisableSelf(t *testing.T) {
	adminID := uint(42)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.PUT("/api/v1/admin/users/:id/disable", h.DisableUser)

	repo.getByIDFn = func(_ context.Context, id uint) (*models.User, error) {
		return &models.User{
			BaseWithUpdate: models.BaseWithUpdate{ID: id},
			Email:          "admin@example.com",
			IsActive:       true,
		}, nil
	}

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/users/42/disable", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminUserHandler_DisableUser_NotFound(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.PUT("/api/v1/admin/users/:id/disable", h.DisableUser)

	repo.getByIDFn = func(_ context.Context, _ uint) (*models.User, error) {
		return nil, repositories.ErrUserNotFound
	}

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/users/999/disable", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestAdminUserHandler_DisableUser_InvalidID(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newAdminUserTestRouter(&adminID)
	router.PUT("/api/v1/admin/users/:id/disable", h.DisableUser)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/users/abc/disable", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- ResetUserPassword ---

func TestAdminUserHandler_ResetUserPassword_Success(t *testing.T) {
	adminID := uint(1)
	router, h, repo, authSvc := newAdminUserTestRouter(&adminID)
	router.POST("/api/v1/admin/users/:id/reset-password", h.ResetUserPassword)

	repo.getByIDFn = func(_ context.Context, id uint) (*models.User, error) {
		return &models.User{
			BaseWithUpdate: models.BaseWithUpdate{ID: id},
			Email:          "user@example.com",
			FullName:       "Test User",
		}, nil
	}

	var resetEmail string
	authSvc.requestPasswordResetFn = func(_ context.Context, email string) error {
		resetEmail = email
		return nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/42/reset-password", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if resetEmail != "user@example.com" {
		t.Fatalf("expected reset email=user@example.com, got %q", resetEmail)
	}
}

func TestAdminUserHandler_ResetUserPassword_NotFound(t *testing.T) {
	adminID := uint(1)
	router, h, repo, _ := newAdminUserTestRouter(&adminID)
	router.POST("/api/v1/admin/users/:id/reset-password", h.ResetUserPassword)

	repo.getByIDFn = func(_ context.Context, _ uint) (*models.User, error) {
		return nil, repositories.ErrUserNotFound
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/999/reset-password", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestAdminUserHandler_ResetUserPassword_InvalidID(t *testing.T) {
	adminID := uint(1)
	router, h, _, _ := newAdminUserTestRouter(&adminID)
	router.POST("/api/v1/admin/users/:id/reset-password", h.ResetUserPassword)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/abc/reset-password", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestAdminUserHandler_ResetUserPassword_ServiceError(t *testing.T) {
	adminID := uint(1)
	router, h, repo, authSvc := newAdminUserTestRouter(&adminID)
	router.POST("/api/v1/admin/users/:id/reset-password", h.ResetUserPassword)

	repo.getByIDFn = func(_ context.Context, id uint) (*models.User, error) {
		return &models.User{
			BaseWithUpdate: models.BaseWithUpdate{ID: id},
			Email:          "user@example.com",
		}, nil
	}

	authSvc.requestPasswordResetFn = func(_ context.Context, _ string) error {
		return errors.New("email service unavailable")
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/42/reset-password", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}
