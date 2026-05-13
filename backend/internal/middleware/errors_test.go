package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/digital-store/backend/internal/config"
	"github.com/digital-store/backend/pkg/logger"
	"github.com/digital-store/backend/pkg/response"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupTestRouter(isProduction bool) (*gin.Engine, *ErrorHandler) {
	cfg := &config.Config{
		Environment: "development",
	}
	if isProduction {
		cfg.Environment = "production"
	}

	log := logger.New("development")
	errorHandler := NewErrorHandler(log, cfg)

	router := gin.New()
	router.Use(response.Middleware())

	return router, errorHandler
}

func TestRecoveryMiddleware_PanicRecovery(t *testing.T) {
	router, errorHandler := setupTestRouter(false)

	router.Use(errorHandler.RecoveryMiddleware())
	router.GET("/panic", func(c *gin.Context) {
		panic("test panic")
	})

	req := httptest.NewRequest("GET", "/panic", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}

	// Check response body contains error info
	if !containsString(w.Body.String(), "INTERNAL_ERROR") {
		t.Errorf("Expected response to contain INTERNAL_ERROR, got: %s", w.Body.String())
	}
}

func TestRecoveryMiddleware_PanicRecovery_Production(t *testing.T) {
	router, errorHandler := setupTestRouter(true)

	router.Use(errorHandler.RecoveryMiddleware())
	router.GET("/panic", func(c *gin.Context) {
		panic("sensitive internal error details")
	})

	req := httptest.NewRequest("GET", "/panic", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}

	// In production, internal error details should NOT be exposed
	if containsString(w.Body.String(), "sensitive internal error details") {
		t.Errorf("Production mode should not expose internal error details, got: %s", w.Body.String())
	}
}

func TestRecoveryMiddleware_NoPanic(t *testing.T) {
	router, errorHandler := setupTestRouter(false)

	router.Use(errorHandler.RecoveryMiddleware())
	router.GET("/ok", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	req := httptest.NewRequest("GET", "/ok", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
}

func TestNotFoundHandler(t *testing.T) {
	router, errorHandler := setupTestRouter(false)

	router.NoRoute(errorHandler.NotFoundHandler())

	req := httptest.NewRequest("GET", "/nonexistent", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, w.Code)
	}

	if !containsString(w.Body.String(), "NOT_FOUND") {
		t.Errorf("Expected response to contain NOT_FOUND, got: %s", w.Body.String())
	}
}

func TestMethodNotAllowedHandler(t *testing.T) {
	router, errorHandler := setupTestRouter(false)

	router.HandleMethodNotAllowed = true
	router.NoMethod(errorHandler.MethodNotAllowedHandler())
	router.POST("/resource", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "created"})
	})

	req := httptest.NewRequest("GET", "/resource", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status code %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}

	if !containsString(w.Body.String(), "METHOD_NOT_ALLOWED") {
		t.Errorf("Expected response to contain METHOD_NOT_ALLOWED, got: %s", w.Body.String())
	}
}

func TestAppError_Error(t *testing.T) {
	tests := []struct {
		name     string
		appErr   *AppError
		expected string
	}{
		{
			name:     "error without underlying error",
			appErr:   BadRequestError("Invalid input"),
			expected: "Invalid input",
		},
		{
			name:     "error with underlying error",
			appErr:   BadRequestError("Invalid input").WithError(errors.New("field is required")),
			expected: "Invalid input: field is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.appErr.Error(); got != tt.expected {
				t.Errorf("Expected error message %q, got %q", tt.expected, got)
			}
		})
	}
}

func TestAppError_Unwrap(t *testing.T) {
	underlyingErr := errors.New("underlying error")
	appErr := BadRequestError("Invalid input").WithError(underlyingErr)

	if unwrapped := appErr.Unwrap(); unwrapped != underlyingErr {
		t.Errorf("Expected unwrapped error to be the underlying error")
	}
}

func TestAppError_WithDetails(t *testing.T) {
	appErr := BadRequestError("Invalid input").WithDetails("Field 'name' is required")

	if appErr.Details != "Field 'name' is required" {
		t.Errorf("Expected details to be set, got: %s", appErr.Details)
	}
}

func TestErrorConstructors(t *testing.T) {
	tests := []struct {
		name           string
		appErr         *AppError
		expectedCode   string
		expectedStatus int
	}{
		{
			name:           "BadRequestError",
			appErr:         BadRequestError("bad request"),
			expectedCode:   "BAD_REQUEST",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "UnauthorizedError",
			appErr:         UnauthorizedError("unauthorized"),
			expectedCode:   "UNAUTHORIZED",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "ForbiddenError",
			appErr:         ForbiddenError("forbidden"),
			expectedCode:   "FORBIDDEN",
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "NotFoundError",
			appErr:         NotFoundError("not found"),
			expectedCode:   "NOT_FOUND",
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "ConflictError",
			appErr:         ConflictError("conflict"),
			expectedCode:   "CONFLICT",
			expectedStatus: http.StatusConflict,
		},
		{
			name:           "ValidationError",
			appErr:         ValidationError("validation failed"),
			expectedCode:   "VALIDATION_ERROR",
			expectedStatus: http.StatusUnprocessableEntity,
		},
		{
			name:           "InternalError",
			appErr:         InternalError("internal error"),
			expectedCode:   "INTERNAL_ERROR",
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:           "ServiceUnavailableError",
			appErr:         ServiceUnavailableError("service unavailable"),
			expectedCode:   "SERVICE_UNAVAILABLE",
			expectedStatus: http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.appErr.Code != tt.expectedCode {
				t.Errorf("Expected code %q, got %q", tt.expectedCode, tt.appErr.Code)
			}
			if tt.appErr.StatusCode != tt.expectedStatus {
				t.Errorf("Expected status code %d, got %d", tt.expectedStatus, tt.appErr.StatusCode)
			}
		})
	}
}

func TestErrorHandlerMiddleware_AppError(t *testing.T) {
	router, errorHandler := setupTestRouter(false)

	router.Use(errorHandler.ErrorHandlerMiddleware())
	router.GET("/error", func(c *gin.Context) {
		_ = c.Error(BadRequestError("Invalid request parameter").WithDetails("Field 'id' must be positive"))
	})

	req := httptest.NewRequest("GET", "/error", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestErrorHandlerMiddleware_InternalError_Production(t *testing.T) {
	router, errorHandler := setupTestRouter(true)

	router.Use(errorHandler.ErrorHandlerMiddleware())
	router.GET("/internal-error", func(c *gin.Context) {
		_ = c.Error(InternalError("database connection failed"))
	})

	req := httptest.NewRequest("GET", "/internal-error", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}

	// In production, internal error message should be generic
	if containsString(w.Body.String(), "database connection failed") {
		t.Errorf("Production mode should not expose internal error details, got: %s", w.Body.String())
	}
}

func TestErrorHandlerMiddleware_GenericError(t *testing.T) {
	router, errorHandler := setupTestRouter(false)

	router.Use(errorHandler.ErrorHandlerMiddleware())
	router.GET("/generic-error", func(c *gin.Context) {
		_ = c.Error(errors.New("generic error"))
	})

	req := httptest.NewRequest("GET", "/generic-error", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}
}

func TestErrorHandlerMiddleware_NoError(t *testing.T) {
	router, errorHandler := setupTestRouter(false)

	router.Use(errorHandler.ErrorHandlerMiddleware())
	router.GET("/ok", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	req := httptest.NewRequest("GET", "/ok", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
}

// Helper function
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || 
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
