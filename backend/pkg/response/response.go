package response

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response represents a standard API response
type Response struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     *ErrorInfo  `json:"error,omitempty"`
	Meta      *Meta       `json:"meta,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
}

// ErrorInfo contains error details
type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// Meta contains pagination or other metadata
type Meta struct {
	Page       int   `json:"page,omitempty"`
	PerPage    int   `json:"per_page,omitempty"`
	Total      int64 `json:"total,omitempty"`
	TotalPages int   `json:"total_pages,omitempty"`
}

// Middleware adds request ID to responses
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate or get request ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// getRequestID returns the per-request ID stored by Middleware(), falling
// back to empty when the response helper is called before (or outside of)
// the middleware chain — for example when an early middleware short-circuits
// a request (rate limit, body-size guard) before response.Middleware runs.
func getRequestID(c *gin.Context) string {
	if v, ok := c.Get("request_id"); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// Success sends a successful response
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      data,
		RequestID: getRequestID(c),
	})
}

// SuccessWithMeta sends a successful response with pagination metadata
func SuccessWithMeta(c *gin.Context, data interface{}, meta *Meta) {
	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      data,
		Meta:      meta,
		RequestID: getRequestID(c),
	})
}

// Created sends a 201 Created response
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{
		Success:   true,
		Data:      data,
		RequestID: getRequestID(c),
	})
}

// NoContent sends a 204 No Content response
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// BadRequest sends a 400 Bad Request response
func BadRequest(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusBadRequest, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "BAD_REQUEST",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// Unauthorized sends a 401 Unauthorized response
func Unauthorized(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusUnauthorized, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "UNAUTHORIZED",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// Forbidden sends a 403 Forbidden response
func Forbidden(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusForbidden, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "FORBIDDEN",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// NotFound sends a 404 Not Found response
func NotFound(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusNotFound, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "NOT_FOUND",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// Conflict sends a 409 Conflict response
func Conflict(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusConflict, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "CONFLICT",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// ValidationError sends a 422 Unprocessable Entity response for validation errors
func ValidationError(c *gin.Context, message string, details string) {
	c.JSON(http.StatusUnprocessableEntity, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "VALIDATION_ERROR",
			Message: message,
			Details: details,
		},
		RequestID: getRequestID(c),
	})
}

// TooManyRequests sends a 429 Too Many Requests response
func TooManyRequests(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusTooManyRequests, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "RATE_LIMIT_EXCEEDED",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// InternalError sends a 500 Internal Server Error response
func InternalError(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusInternalServerError, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "INTERNAL_ERROR",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// ServiceUnavailable sends a 503 Service Unavailable response
func ServiceUnavailable(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusServiceUnavailable, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "SERVICE_UNAVAILABLE",
			Message: message,
			Details: joinDetails(details),
		},
		RequestID: getRequestID(c),
	})
}

// Custom sends a response with custom status code
func Custom(c *gin.Context, statusCode int, success bool, data interface{}, err *ErrorInfo) {
	c.JSON(statusCode, Response{
		Success:   success,
		Data:      data,
		Error:     err,
		RequestID: getRequestID(c),
	})
}

// Paginate creates pagination metadata
func Paginate(page, perPage int, total int64) *Meta {
	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}
	return &Meta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	}
}

// Helper functions

func joinDetails(details []string) string {
	if len(details) > 0 {
		return details[0]
	}
	return ""
}

func generateRequestID() string {
	// 16 random bytes -> 32 hex chars, suitable for log correlation. Falls
	// back to a fixed sentinel if the OS RNG somehow fails so we never
	// panic the request pipeline over a non-critical header.
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "no-request-id"
	}
	return hex.EncodeToString(b)
}
