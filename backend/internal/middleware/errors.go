package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"github.com/digital-store/backend/internal/config"
	"github.com/digital-store/backend/pkg/logger"
	"github.com/digital-store/backend/pkg/response"
)

// ErrorHandler handles panics and errors in the request chain
type ErrorHandler struct {
	logger *logger.Logger
	config *config.Config
}

// NewErrorHandler creates a new ErrorHandler instance
func NewErrorHandler(logger *logger.Logger, cfg *config.Config) *ErrorHandler {
	return &ErrorHandler{
		logger: logger,
		config: cfg,
	}
}

// RecoveryMiddleware recovers from panics and returns a proper error response
// This middleware should be one of the first middlewares in the chain
func (h *ErrorHandler) RecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Get stack trace
				stack := string(debug.Stack())

				// Get request ID for tracing
				requestID, _ := c.Get("request_id")

				// Log the panic with full stack trace
				h.logger.Errorw("Panic recovered",
					"error", fmt.Sprintf("%v", err),
					"stack", stack,
					"request_id", requestID,
					"method", c.Request.Method,
					"path", c.Request.URL.Path,
					"query", c.Request.URL.RawQuery,
					"client_ip", c.ClientIP(),
				)

				// Don't expose internal error details in production
				errorMessage := "An unexpected error occurred"
				if !h.config.IsProduction() {
					// In development, include the panic error for debugging
					errorMessage = fmt.Sprintf("Internal error: %v", err)
				}

				// Return a standardized error response
				response.InternalError(c, errorMessage)

				// Abort the request chain
				c.Abort()
			}
		}()
		c.Next()
	}
}

// ErrorLoggerMiddleware logs errors that occur during request processing
// This middleware logs errors attached to the context via c.Error()
func (h *ErrorHandler) ErrorLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check if there are any errors in the context
		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				// Log each error with context
				h.logger.Errorw("Request error",
					"error", err.Error(),
					"type", err.Type,
					"request_id", c.GetString("request_id"),
					"method", c.Request.Method,
					"path", c.Request.URL.Path,
				)
			}
		}
	}
}

// NotFoundHandler handles requests to undefined routes
func (h *ErrorHandler) NotFoundHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		response.NotFound(c, "Resource not found",
			fmt.Sprintf("The requested endpoint %s %s does not exist", c.Request.Method, c.Request.URL.Path),
		)
	}
}

// MethodNotAllowedHandler handles requests with wrong HTTP methods
func (h *ErrorHandler) MethodNotAllowedHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		response.Custom(c, http.StatusMethodNotAllowed, false, nil, &response.ErrorInfo{
			Code:    "METHOD_NOT_ALLOWED",
			Message: "Method not allowed",
			Details: fmt.Sprintf("The method %s is not allowed for this endpoint", c.Request.Method),
		})
	}
}

// AppError represents an application-level error that can be converted to API response
type AppError struct {
	Code       string
	Message    string
	Details    string
	StatusCode int
	Err        error
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

// Unwrap returns the underlying error
func (e *AppError) Unwrap() error {
	return e.Err
}

// NewAppError creates a new AppError
func NewAppError(code, message string, statusCode int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
	}
}

// WithDetails adds details to the error
func (e *AppError) WithDetails(details string) *AppError {
	e.Details = details
	return e
}

// WithError wraps an underlying error
func (e *AppError) WithError(err error) *AppError {
	e.Err = err
	return e
}

// Common error constructors

// BadRequestError creates a 400 Bad Request error
func BadRequestError(message string) *AppError {
	return NewAppError("BAD_REQUEST", message, http.StatusBadRequest)
}

// UnauthorizedError creates a 401 Unauthorized error
func UnauthorizedError(message string) *AppError {
	return NewAppError("UNAUTHORIZED", message, http.StatusUnauthorized)
}

// ForbiddenError creates a 403 Forbidden error
func ForbiddenError(message string) *AppError {
	return NewAppError("FORBIDDEN", message, http.StatusForbidden)
}

// NotFoundError creates a 404 Not Found error
func NotFoundError(message string) *AppError {
	return NewAppError("NOT_FOUND", message, http.StatusNotFound)
}

// ConflictError creates a 409 Conflict error
func ConflictError(message string) *AppError {
	return NewAppError("CONFLICT", message, http.StatusConflict)
}

// ValidationError creates a 422 Unprocessable Entity error
func ValidationError(message string) *AppError {
	return NewAppError("VALIDATION_ERROR", message, http.StatusUnprocessableEntity)
}

// InternalError creates a 500 Internal Server Error
func InternalError(message string) *AppError {
	return NewAppError("INTERNAL_ERROR", message, http.StatusInternalServerError)
}

// ServiceUnavailableError creates a 503 Service Unavailable error
func ServiceUnavailableError(message string) *AppError {
	return NewAppError("SERVICE_UNAVAILABLE", message, http.StatusServiceUnavailable)
}

// ErrorHandlerMiddleware converts AppError to proper HTTP responses
// This middleware should be used after the recovery middleware
func (h *ErrorHandler) ErrorHandlerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check for errors in context
		if len(c.Errors) > 0 {
			// Get the last error (most recent)
			err := c.Errors.Last()

			// Check if it's an AppError
			if appErr, ok := err.Err.(*AppError); ok {
				h.handleAppError(c, appErr)
				c.Abort()
				return
			}

			// Handle generic errors
			h.logger.Errorw("Unhandled error",
				"error", err.Error(),
				"request_id", c.GetString("request_id"),
			)

			// Return generic internal error
			message := "An internal error occurred"
			if !h.config.IsProduction() {
				message = err.Error()
			}
			response.InternalError(c, message)
		}
	}
}

// handleAppError handles AppError instances and returns appropriate responses
func (h *ErrorHandler) handleAppError(c *gin.Context, err *AppError) {
	requestID := c.GetString("request_id")

	// Log the error
	h.logger.Warnw("Application error",
		"code", err.Code,
		"message", err.Message,
		"details", err.Details,
		"status_code", err.StatusCode,
		"request_id", requestID,
	)

	// Determine if we should expose details
	details := err.Details
	if h.config.IsProduction() && err.StatusCode >= 500 {
		// Don't expose internal error details in production
		details = ""
	}

	// Send appropriate response based on status code
	switch err.StatusCode {
	case http.StatusBadRequest:
		response.BadRequest(c, err.Message, details)
	case http.StatusUnauthorized:
		response.Unauthorized(c, err.Message, details)
	case http.StatusForbidden:
		response.Forbidden(c, err.Message, details)
	case http.StatusNotFound:
		response.NotFound(c, err.Message, details)
	case http.StatusConflict:
		response.Conflict(c, err.Message, details)
	case http.StatusUnprocessableEntity:
		response.ValidationError(c, err.Message, details)
	case http.StatusTooManyRequests:
		response.TooManyRequests(c, err.Message, details)
	case http.StatusInternalServerError:
		message := err.Message
		if h.config.IsProduction() {
			message = "An unexpected error occurred"
		}
		response.InternalError(c, message, details)
	case http.StatusServiceUnavailable:
		response.ServiceUnavailable(c, err.Message, details)
	default:
		response.Custom(c, err.StatusCode, false, nil, &response.ErrorInfo{
			Code:    err.Code,
			Message: err.Message,
			Details: details,
		})
	}
}
