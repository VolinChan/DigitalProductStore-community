package handlers

import (
	"errors"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/middleware"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// AdminUserHandler handles admin user management HTTP requests.
// It provides endpoints for listing, viewing, disabling, and resetting
// passwords for users (Requirements 17.1-17.6).
type AdminUserHandler struct {
	userRepo    repositories.UserRepository
	authService services.AuthService
}

// NewAdminUserHandler creates a new AdminUserHandler.
func NewAdminUserHandler(userRepo repositories.UserRepository, authService services.AuthService) *AdminUserHandler {
	return &AdminUserHandler{
		userRepo:    userRepo,
		authService: authService,
	}
}

// userListItem represents a user in the list response (Requirement 17.1).
type userListItem struct {
	ID         uint      `json:"id"`
	Email      string    `json:"email"`
	FullName   string    `json:"full_name"`
	Phone      string    `json:"phone"`
	Role       string    `json:"role"`
	IsActive   bool      `json:"is_active"`
	OrderCount int64     `json:"order_count"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// userDetailResponse represents a user detail response (Requirement 17.3).
type userDetailResponse struct {
	ID         uint      `json:"id"`
	Email      string    `json:"email"`
	FullName   string    `json:"full_name"`
	Phone      string    `json:"phone"`
	Role       string    `json:"role"`
	IsActive   bool      `json:"is_active"`
	OrderCount int64     `json:"order_count"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// userListResponse represents the paginated user list response.
type userListResponse struct {
	Users []*userListItem `json:"users"`
}

// disableUserRequest carries the reason for disabling a user (Requirement 17.4).
type disableUserRequest struct {
	Reason string `json:"reason"`
}

// ListUsers handles GET /api/v1/admin/users.
// Returns a paginated list of users with search by email/name/ID
// (Requirements 17.1, 17.2).
func (h *AdminUserHandler) ListUsers(c *gin.Context) {
	page := parseIntQuery(c, "page", 1, 1, 0)
	pageSize := parseIntQuery(c, "page_size", 20, 1, 100)
	search := c.Query("search")

	offset := (page - 1) * pageSize

	params := &repositories.ListUsersParams{
		Offset: offset,
		Limit:  pageSize,
		Search: search,
	}

	users, total, err := h.userRepo.SearchUsers(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to list users", err.Error())
		return
	}

	// Build response with order counts
	items := make([]*userListItem, 0, len(users))
	for _, u := range users {
		orderCount, _ := h.userRepo.CountOrdersByUserID(c.Request.Context(), u.ID)
		items = append(items, &userListItem{
			ID:         u.ID,
			Email:      u.Email,
			FullName:   u.FullName,
			Phone:      u.Phone,
			Role:       string(u.Role),
			IsActive:   u.IsActive,
			OrderCount: orderCount,
			CreatedAt:  u.CreatedAt,
			UpdatedAt:  u.UpdatedAt,
		})
	}

	meta := &response.Meta{
		Page:       page,
		PerPage:    pageSize,
		Total:      total,
		TotalPages: totalPages(total, pageSize),
	}
	response.SuccessWithMeta(c, &userListResponse{Users: items}, meta)
}

// GetUser handles GET /api/v1/admin/users/:id.
// Returns user details with order history summary (Requirement 17.3).
func (h *AdminUserHandler) GetUser(c *gin.Context) {
	userID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid user id")
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalError(c, "failed to get user", err.Error())
		return
	}

	orderCount, _ := h.userRepo.CountOrdersByUserID(c.Request.Context(), user.ID)

	detail := &userDetailResponse{
		ID:         user.ID,
		Email:      user.Email,
		FullName:   user.FullName,
		Phone:      user.Phone,
		Role:       string(user.Role),
		IsActive:   user.IsActive,
		OrderCount: orderCount,
		CreatedAt:  user.CreatedAt,
		UpdatedAt:  user.UpdatedAt,
	}

	response.Success(c, detail)
}

// DisableUser handles PUT /api/v1/admin/users/:id/disable.
// Disables a user account with reason (Requirements 17.4, 17.6).
func (h *AdminUserHandler) DisableUser(c *gin.Context) {
	userID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid user id")
		return
	}

	var req disableUserRequest
	_ = c.ShouldBindJSON(&req)

	// Prevent admin from disabling themselves
	currentUserID, _ := middleware.GetUserID(c)
	if currentUserID == userID {
		response.BadRequest(c, "cannot disable your own account")
		return
	}

	// Check user exists
	_, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalError(c, "failed to get user", err.Error())
		return
	}

	// Disable the user
	if err := h.userRepo.SetActive(c.Request.Context(), userID, false); err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalError(c, "failed to disable user", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "user disabled", "reason": req.Reason})
}

// ResetUserPassword handles POST /api/v1/admin/users/:id/reset-password.
// Triggers a password reset for the user (Requirement 17.5).
func (h *AdminUserHandler) ResetUserPassword(c *gin.Context) {
	userID, ok := parseUintParam(c, "id")
	if !ok {
		response.BadRequest(c, "invalid user id")
		return
	}

	// Get user to find their email
	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalError(c, "failed to get user", err.Error())
		return
	}

	// Trigger password reset via auth service
	if err := h.authService.RequestPasswordReset(c.Request.Context(), user.Email); err != nil {
		response.InternalError(c, "failed to send password reset", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "password reset email sent", "email": user.Email})
}
