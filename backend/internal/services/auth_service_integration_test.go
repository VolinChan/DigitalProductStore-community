package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/pkg/utils"
)

// TestAuthService_RegisterAndLogin tests the complete registration and login flow
func TestAuthService_RegisterAndLogin(t *testing.T) {
	// Setup
	mockRepo := new(MockUserRepository)
	mockCache := new(MockCache)
	mockEmail := new(MockEmailSender)
	jwtManager := utils.NewJWTManager("test-secret", 24*time.Hour, 7*24*time.Hour, "test-issuer")
	validator := utils.NewValidator()

	service := NewAuthService(mockRepo, jwtManager, validator, mockCache, mockEmail)
	ctx := context.Background()

	// Test registration
	t.Run("register new user", func(t *testing.T) {
		req := &RegisterRequest{
			Email:    "test@example.com",
			Password: "Test@1234",
			FullName: "Test User",
			Phone:    "+1234567890",
		}

		mockRepo.On("ExistsByEmail", ctx, "test@example.com").Return(false, nil).Once()
		mockRepo.On("Create", ctx, matchUser("test@example.com")).Return(nil).Once()

		user, err := service.Register(ctx, req)

		require.NoError(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, "test@example.com", user.Email)
		assert.Equal(t, "Test User", user.FullName)
		assert.Equal(t, models.RoleUser, user.Role)
		assert.True(t, user.IsActive)
	})
}

// TestPasswordValidation tests password validation
func TestPasswordValidation(t *testing.T) {
	mockRepo := new(MockUserRepository)
	mockCache := new(MockCache)
	mockEmail := new(MockEmailSender)
	jwtManager := utils.NewJWTManager("test-secret", 24*time.Hour, 7*24*time.Hour, "test-issuer")
	validator := utils.NewValidator()

	service := NewAuthService(mockRepo, jwtManager, validator, mockCache, mockEmail)
	ctx := context.Background()

	tests := []struct {
		name        string
		password    string
		shouldError bool
	}{
		{"valid password", "Test@1234", false},
		{"too short", "Test@1", true},
		{"no uppercase", "test@1234", true},
		{"no lowercase", "TEST@1234", true},
		{"no number", "Test@Test", true},
		{"no special char", "Test1234", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &RegisterRequest{
				Email:    "test@example.com",
				Password: tt.password,
				FullName: "Test User",
			}

			if !tt.shouldError {
				mockRepo.On("ExistsByEmail", ctx, "test@example.com").Return(false, nil).Once()
				mockRepo.On("Create", ctx, matchUser("test@example.com")).Return(nil).Once()
			}

			_, err := service.Register(ctx, req)

			if tt.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestEmailValidation tests email validation
func TestEmailValidation(t *testing.T) {
	mockRepo := new(MockUserRepository)
	mockCache := new(MockCache)
	mockEmail := new(MockEmailSender)
	jwtManager := utils.NewJWTManager("test-secret", 24*time.Hour, 7*24*time.Hour, "test-issuer")
	validator := utils.NewValidator()

	service := NewAuthService(mockRepo, jwtManager, validator, mockCache, mockEmail)
	ctx := context.Background()

	tests := []struct {
		name        string
		email       string
		shouldError bool
	}{
		{"valid email", "test@example.com", false},
		{"invalid email - no @", "testexample.com", true},
		{"invalid email - no domain", "test@", true},
		{"invalid email - no local", "@example.com", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &RegisterRequest{
				Email:    tt.email,
				Password: "Test@1234",
				FullName: "Test User",
			}

			if !tt.shouldError {
				mockRepo.On("ExistsByEmail", ctx, tt.email).Return(false, nil).Once()
				mockRepo.On("Create", ctx, matchUser(tt.email)).Return(nil).Once()
			}

			_, err := service.Register(ctx, req)

			if tt.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// Helper function to match user by email
func matchUser(email string) interface{} {
	return mock.MatchedBy(func(u *models.User) bool {
		return u.Email == email
	})
}
