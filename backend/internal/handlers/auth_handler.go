package handlers

import (
	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/middleware"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// AuthHandler handles authentication-related HTTP requests
type AuthHandler struct {
	authService services.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	FullName string `json:"full_name" binding:"required,min=2,max=100"`
	Phone    string `json:"phone" binding:"omitempty"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// PasswordResetRequest represents a password reset request
type PasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ResetPasswordRequest represents a reset password request
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8,max=72"`
}

// UserResponse represents a user response
type UserResponse struct {
	ID       uint   `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
	IsActive bool   `json:"is_active"`
}

// Register handles user registration. On success the user is auto-logged-in
// and a full AuthToken (access + refresh + user) is returned so the frontend
// can store the credential without a second round-trip.
// @Summary Register a new user
// @Description Register a new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Registration request"
// @Success 201 {object} response.Response{data=services.AuthToken}
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", err.Error())
		return
	}

	// Convert to service request
	serviceReq := &services.RegisterRequest{
		Email:    req.Email,
		Password: req.Password,
		FullName: req.FullName,
		Phone:    req.Phone,
	}

	if _, err := h.authService.Register(c.Request.Context(), serviceReq); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// Auto-login the freshly registered user so the front-end gets a token
	// pair without an extra request. If login fails for any reason (e.g.
	// post-create lock), surface a 201 with no token rather than failing the
	// registration outright; the user can log in manually.
	token, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Created(c, gin.H{"email": req.Email})
		return
	}

	response.Created(c, token)
}

// Login handles user login
// @Summary User login
// @Description Authenticate user and return tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login request"
// @Success 200 {object} response.Response{data=services.AuthToken}
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", err.Error())
		return
	}

	token, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.Success(c, token)
}

// AdminLogin handles admin login
// @Summary Admin login
// @Description Authenticate admin user and return tokens with 8-hour expiration
// @Tags admin-auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login request"
// @Success 200 {object} response.Response{data=services.AuthToken}
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Router /api/v1/admin/login [post]
func (h *AuthHandler) AdminLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", err.Error())
		return
	}

	token, err := h.authService.AdminLogin(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.Success(c, token)
}

// Logout handles user logout
// @Summary User logout
// @Description Invalidate user tokens
// @Tags auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	// Get token from header
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		response.Unauthorized(c, "missing authorization header")
		return
	}

	// Extract token
	token := authHeader[7:] // Remove "Bearer " prefix

	if err := h.authService.Logout(c.Request.Context(), token); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// RefreshToken handles token refresh
// @Summary Refresh access token
// @Description Refresh access token using refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RefreshTokenRequest true "Refresh token request"
// @Success 200 {object} response.Response{data=services.AuthToken}
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", err.Error())
		return
	}

	token, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.Success(c, token)
}

// RequestPasswordReset handles password reset request
// @Summary Request password reset
// @Description Send password reset email
// @Tags auth
// @Accept json
// @Produce json
// @Param request body PasswordResetRequest true "Password reset request"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/auth/password-reset/request [post]
func (h *AuthHandler) RequestPasswordReset(c *gin.Context) {
	var req PasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", err.Error())
		return
	}

	if err := h.authService.RequestPasswordReset(c.Request.Context(), req.Email); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "password reset email sent"})
}

// ResetPassword handles password reset
// @Summary Reset password
// @Description Reset password using reset token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ResetPasswordRequest true "Reset password request"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/auth/password-reset/confirm [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", err.Error())
		return
	}

	if err := h.authService.ResetPassword(c.Request.Context(), req.Token, req.NewPassword); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "password reset successfully"})
}

// GetProfile handles getting current user profile
// @Summary Get user profile
// @Description Get current authenticated user profile
// @Tags auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response{data=UserResponse}
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/auth/profile [get]
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		response.Unauthorized(c, "user not authenticated")
		return
	}

	email, _ := middleware.GetUserEmail(c)
	role, _ := middleware.GetUserRole(c)

	// In a real implementation, you would fetch full user details from the database
	userResp := UserResponse{
		ID:    userID,
		Email: email,
		Role:  role,
	}

	response.Success(c, userResp)
}
