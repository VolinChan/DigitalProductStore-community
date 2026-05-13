package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/digital-store/backend/internal/cache"
	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/pkg/utils"
)

var (
	// ErrInvalidCredentials is returned when login credentials are invalid
	ErrInvalidCredentials = errors.New("invalid email or password")
	// ErrAccountLocked is returned when account is locked
	ErrAccountLocked = errors.New("account is locked due to too many failed login attempts")
	// ErrAccountDisabled is returned when account is disabled
	ErrAccountDisabled = errors.New("account is disabled")
	// ErrInvalidToken is returned when token is invalid
	ErrInvalidToken = errors.New("invalid or expired token")
	// ErrPasswordResetTokenExpired is returned when password reset token has expired
	ErrPasswordResetTokenExpired = errors.New("password reset token has expired")
	// ErrNotAdmin is returned when a non-admin user tries to use admin login
	ErrNotAdmin = errors.New("insufficient permissions: admin role required")
)

const (
	// LoginFailureKeyPrefix is the Redis key prefix for login failure tracking
	LoginFailureKeyPrefix = "login_failure:"
	// AccountLockKeyPrefix is the Redis key prefix for account lock tracking
	AccountLockKeyPrefix = "account_lock:"
	// PasswordResetTokenPrefix is the Redis key prefix for password reset tokens
	PasswordResetTokenPrefix = "password_reset:"
	// RefreshTokenPrefix is the Redis key prefix for refresh tokens
	RefreshTokenPrefix = "refresh_token:"
	
	// MaxLoginAttempts is the maximum number of failed login attempts before locking
	MaxLoginAttempts = 5
	// LoginAttemptWindow is the time window for tracking login attempts
	LoginAttemptWindow = 15 * time.Minute
	// AccountLockDuration is the duration for which an account is locked
	AccountLockDuration = 30 * time.Minute
	// PasswordResetTokenTTL is the TTL for password reset tokens
	PasswordResetTokenTTL = 1 * time.Hour
	// RefreshTokenTTL is the TTL for refresh tokens
	RefreshTokenTTL = 7 * 24 * time.Hour
)

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	FullName string `json:"full_name" validate:"required,min=2,max=100"`
	Phone    string `json:"phone" validate:"omitempty,e164"`
}

// AuthToken represents authentication tokens
type AuthToken struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresIn    int64     `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// AuthService defines the authentication service interface
type AuthService interface {
	// Register registers a new user
	Register(ctx context.Context, req *RegisterRequest) (*models.User, error)
	
	// Login authenticates a user and returns tokens
	Login(ctx context.Context, email, password string) (*AuthToken, error)
	
	// AdminLogin authenticates an admin user and returns tokens with 8-hour expiration
	AdminLogin(ctx context.Context, email, password string) (*AuthToken, error)
	
	// Logout invalidates user tokens
	Logout(ctx context.Context, token string) error
	
	// ValidateToken validates an access token and returns claims
	ValidateToken(ctx context.Context, token string) (*utils.Claims, error)
	
	// RefreshToken refreshes an access token using a refresh token
	RefreshToken(ctx context.Context, refreshToken string) (*AuthToken, error)
	
	// RequestPasswordReset generates a password reset token and sends email
	RequestPasswordReset(ctx context.Context, email string) error
	
	// ResetPassword resets a user's password using a reset token
	ResetPassword(ctx context.Context, token, newPassword string) error
	
	// CheckAccountLock checks if an account is locked
	CheckAccountLock(ctx context.Context, userID uint) (bool, time.Time, error)
	
	// LockAccount locks an account for a specified duration
	LockAccount(ctx context.Context, userID uint, duration time.Duration) error
}

// authService implements AuthService
type authService struct {
	userRepo    repositories.UserRepository
	jwtManager  *utils.JWTManager
	validator   *utils.Validator
	cache       cache.Operations
	emailSender EmailSender // Will be implemented in notification service
}

// NewAuthService creates a new authentication service
func NewAuthService(
	userRepo repositories.UserRepository,
	jwtManager *utils.JWTManager,
	validator *utils.Validator,
	cache cache.Operations,
	emailSender EmailSender,
) AuthService {
	return &authService{
		userRepo:    userRepo,
		jwtManager:  jwtManager,
		validator:   validator,
		cache:       cache,
		emailSender: emailSender,
	}
}

// Register registers a new user
func (s *authService) Register(ctx context.Context, req *RegisterRequest) (*models.User, error) {
	// Validate email format
	email, valid := s.validator.SanitizeAndValidateEmail(req.Email)
	if !valid {
		return nil, fmt.Errorf("invalid email format")
	}

	// Validate password strength
	if !s.validator.IsStrongPassword(req.Password) {
		return nil, fmt.Errorf("password must be 8-72 characters and contain uppercase, lowercase, number, and special character")
	}

	// Validate full name
	fullName := s.validator.SanitizeString(req.FullName)
	if !s.validator.MinLength(fullName, 2) || !s.validator.MaxLength(fullName, 100) {
		return nil, fmt.Errorf("full name must be between 2 and 100 characters")
	}

	// Validate phone if provided
	if req.Phone != "" && !s.validator.IsPhone(req.Phone) {
		return nil, fmt.Errorf("invalid phone number format")
	}

	// Hash password
	passwordHash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Email:        email,
		PasswordHash: passwordHash,
		FullName:     fullName,
		Phone:        req.Phone,
		Role:         models.RoleUser,
		IsActive:     true,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		if errors.Is(err, repositories.ErrUserEmailExists) {
			return nil, fmt.Errorf("email already registered")
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// Login authenticates a user and returns tokens
func (s *authService) Login(ctx context.Context, email, password string) (*AuthToken, error) {
	// Sanitize email
	email, valid := s.validator.SanitizeAndValidateEmail(email)
	if !valid {
		return nil, ErrInvalidCredentials
	}

	// Get user by email
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check if account is locked
	locked, unlockTime, err := s.CheckAccountLock(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to check account lock: %w", err)
	}
	if locked {
		return nil, fmt.Errorf("%w: account will be unlocked at %s", ErrAccountLocked, unlockTime.Format(time.RFC3339))
	}

	// Check if account is active
	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	// Verify password
	if !utils.CheckPassword(password, user.PasswordHash) {
		// Increment login failure count
		if err := s.incrementLoginFailures(ctx, user.ID); err != nil {
			return nil, fmt.Errorf("failed to track login failure: %w", err)
		}
		return nil, ErrInvalidCredentials
	}

	// Clear login failures on successful login
	if err := s.clearLoginFailures(ctx, user.ID); err != nil {
		// Log error but don't fail login
		fmt.Printf("failed to clear login failures: %v\n", err)
	}

	// Generate tokens
	accessToken, err := s.jwtManager.GenerateAccessToken(user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in cache
	refreshKey := fmt.Sprintf("%s%d", RefreshTokenPrefix, user.ID)
	if err := s.cache.Set(ctx, refreshKey, refreshToken, RefreshTokenTTL); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	// Calculate expiration
	expiresIn := int64(24 * time.Hour / time.Second) // Default 24 hours
	if user.Role == models.RoleSuperAdmin || user.Role == models.RoleOrderManager || user.Role == models.RoleProductManager {
		expiresIn = int64(8 * time.Hour / time.Second) // Admin tokens expire in 8 hours
	}

	return &AuthToken{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    expiresIn,
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
	}, nil
}

// AdminLogin authenticates an admin user and returns tokens with 8-hour expiration.
// It validates that the user has an admin role (super_admin, product_manager, or order_manager).
func (s *authService) AdminLogin(ctx context.Context, email, password string) (*AuthToken, error) {
	// Sanitize email
	email, valid := s.validator.SanitizeAndValidateEmail(email)
	if !valid {
		return nil, ErrInvalidCredentials
	}

	// Get user by email
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check if account is locked
	locked, unlockTime, err := s.CheckAccountLock(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to check account lock: %w", err)
	}
	if locked {
		return nil, fmt.Errorf("%w: account will be unlocked at %s", ErrAccountLocked, unlockTime.Format(time.RFC3339))
	}

	// Check if account is active
	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	// Verify password
	if !utils.CheckPassword(password, user.PasswordHash) {
		// Increment login failure count
		if err := s.incrementLoginFailures(ctx, user.ID); err != nil {
			return nil, fmt.Errorf("failed to track login failure: %w", err)
		}
		return nil, ErrInvalidCredentials
	}

	// Validate admin role
	if user.Role != models.RoleSuperAdmin && user.Role != models.RoleProductManager && user.Role != models.RoleOrderManager {
		return nil, ErrNotAdmin
	}

	// Clear login failures on successful login
	if err := s.clearLoginFailures(ctx, user.ID); err != nil {
		fmt.Printf("failed to clear login failures: %v\n", err)
	}

	// Generate tokens
	accessToken, err := s.jwtManager.GenerateAccessToken(user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in cache
	refreshKey := fmt.Sprintf("%s%d", RefreshTokenPrefix, user.ID)
	if err := s.cache.Set(ctx, refreshKey, refreshToken, RefreshTokenTTL); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	// Admin tokens expire in 8 hours
	expiresIn := int64(8 * time.Hour / time.Second)

	return &AuthToken{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    expiresIn,
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
	}, nil
}

// Logout invalidates user tokens
func (s *authService) Logout(ctx context.Context, token string) error {
	// Validate token to get user ID
	claims, err := s.jwtManager.ValidateToken(token)
	if err != nil {
		return ErrInvalidToken
	}

	// Delete refresh token from cache
	refreshKey := fmt.Sprintf("%s%d", RefreshTokenPrefix, claims.UserID)
	if err := s.cache.Delete(ctx, refreshKey); err != nil {
		return fmt.Errorf("failed to delete refresh token: %w", err)
	}

	return nil
}

// ValidateToken validates an access token and returns claims
func (s *authService) ValidateToken(ctx context.Context, token string) (*utils.Claims, error) {
	claims, err := s.jwtManager.ValidateToken(token)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Verify user still exists and is active
	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	return claims, nil
}

// RefreshToken refreshes an access token using a refresh token
func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (*AuthToken, error) {
	// Validate refresh token
	claims, err := s.jwtManager.ValidateToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Check if refresh token exists in cache
	refreshKey := fmt.Sprintf("%s%d", RefreshTokenPrefix, claims.UserID)
	storedToken, err := s.cache.Get(ctx, refreshKey)
	if err != nil {
		return nil, ErrInvalidToken
	}

	if storedToken != refreshToken {
		return nil, ErrInvalidToken
	}

	// Get user
	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	// Generate new access token
	accessToken, err := s.jwtManager.GenerateAccessToken(user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Calculate expiration
	expiresIn := int64(24 * time.Hour / time.Second)
	if user.Role == models.RoleSuperAdmin || user.Role == models.RoleOrderManager || user.Role == models.RoleProductManager {
		expiresIn = int64(8 * time.Hour / time.Second)
	}

	return &AuthToken{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    expiresIn,
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
	}, nil
}

// RequestPasswordReset generates a password reset token and sends email
func (s *authService) RequestPasswordReset(ctx context.Context, email string) error {
	// Sanitize email
	email, valid := s.validator.SanitizeAndValidateEmail(email)
	if !valid {
		// Don't reveal if email exists or not
		return nil
	}

	// Get user by email
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repositories.ErrUserNotFound) {
			// Don't reveal if email exists or not
			return nil
		}
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Generate reset token (simple UUID-like token)
	resetToken := fmt.Sprintf("%d-%d", user.ID, time.Now().UnixNano())

	// Store reset token in cache with 1 hour TTL
	resetKey := fmt.Sprintf("%s%s", PasswordResetTokenPrefix, resetToken)
	if err := s.cache.Set(ctx, resetKey, fmt.Sprintf("%d", user.ID), PasswordResetTokenTTL); err != nil {
		return fmt.Errorf("failed to store reset token: %w", err)
	}

	// Send password reset email
	if s.emailSender != nil {
		if err := s.emailSender.SendPasswordReset(ctx, email, resetToken); err != nil {
			return fmt.Errorf("failed to send password reset email: %w", err)
		}
	}

	return nil
}

// ResetPassword resets a user's password using a reset token
func (s *authService) ResetPassword(ctx context.Context, token, newPassword string) error {
	// Validate new password
	if !s.validator.IsStrongPassword(newPassword) {
		return fmt.Errorf("password must be 8-72 characters and contain uppercase, lowercase, number, and special character")
	}

	// Get user ID from token
	resetKey := fmt.Sprintf("%s%s", PasswordResetTokenPrefix, token)
	userIDStr, err := s.cache.Get(ctx, resetKey)
	if err != nil {
		return ErrPasswordResetTokenExpired
	}

	var userID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		return ErrInvalidToken
	}

	// Hash new password
	passwordHash, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	if err := s.userRepo.UpdatePassword(ctx, userID, passwordHash); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Delete reset token
	if err := s.cache.Delete(ctx, resetKey); err != nil {
		// Log error but don't fail password reset
		fmt.Printf("failed to delete reset token: %v\n", err)
	}

	return nil
}

// CheckAccountLock checks if an account is locked
func (s *authService) CheckAccountLock(ctx context.Context, userID uint) (bool, time.Time, error) {
	lockKey := fmt.Sprintf("%s%d", AccountLockKeyPrefix, userID)
	unlockTimeStr, err := s.cache.Get(ctx, lockKey)
	if err != nil {
		// Not locked
		return false, time.Time{}, nil
	}

	var unlockTime time.Time
	if err := unlockTime.UnmarshalText([]byte(unlockTimeStr)); err != nil {
		return false, time.Time{}, fmt.Errorf("failed to parse unlock time: %w", err)
	}

	if time.Now().After(unlockTime) {
		// Lock expired, delete key
		_ = s.cache.Delete(ctx, lockKey)
		return false, time.Time{}, nil
	}

	return true, unlockTime, nil
}

// LockAccount locks an account for a specified duration
func (s *authService) LockAccount(ctx context.Context, userID uint, duration time.Duration) error {
	lockKey := fmt.Sprintf("%s%d", AccountLockKeyPrefix, userID)
	unlockTime := time.Now().Add(duration)
	unlockTimeBytes, _ := unlockTime.MarshalText()

	if err := s.cache.Set(ctx, lockKey, string(unlockTimeBytes), duration); err != nil {
		return fmt.Errorf("failed to lock account: %w", err)
	}

	return nil
}

// incrementLoginFailures increments the login failure count and locks account if threshold reached
func (s *authService) incrementLoginFailures(ctx context.Context, userID uint) error {
	failureKey := fmt.Sprintf("%s%d", LoginFailureKeyPrefix, userID)
	
	// Get current failure count
	countStr, err := s.cache.Get(ctx, failureKey)
	var count int
	if err == nil {
		fmt.Sscanf(countStr, "%d", &count)
	}

	count++

	// Store updated count
	if err := s.cache.Set(ctx, failureKey, fmt.Sprintf("%d", count), LoginAttemptWindow); err != nil {
		return fmt.Errorf("failed to increment failure count: %w", err)
	}

	// Lock account if threshold reached
	if count >= MaxLoginAttempts {
		if err := s.LockAccount(ctx, userID, AccountLockDuration); err != nil {
			return fmt.Errorf("failed to lock account: %w", err)
		}
		// Clear failure count
		_ = s.cache.Delete(ctx, failureKey)
	}

	return nil
}

// clearLoginFailures clears the login failure count
func (s *authService) clearLoginFailures(ctx context.Context, userID uint) error {
	failureKey := fmt.Sprintf("%s%d", LoginFailureKeyPrefix, userID)
	return s.cache.Delete(ctx, failureKey)
}
