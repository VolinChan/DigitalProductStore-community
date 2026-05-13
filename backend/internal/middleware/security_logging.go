package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// SecurityLogger provides structured security event logging.
// Requirement 19.9: Log all authentication failures with IP address and timestamp.
type SecurityLogger struct {
	logger *zap.SugaredLogger
}

// NewSecurityLogger creates a new security logger
func NewSecurityLogger(logger *zap.SugaredLogger) *SecurityLogger {
	return &SecurityLogger{logger: logger}
}

// LogAuthFailure logs an authentication failure event with IP and timestamp.
func (sl *SecurityLogger) LogAuthFailure(c *gin.Context, reason string, email string) {
	sl.logger.Warnw("Authentication failure",
		"event", "auth_failure",
		"ip", c.ClientIP(),
		"timestamp", time.Now().UTC().Format(time.RFC3339),
		"email", email,
		"reason", reason,
		"user_agent", c.GetHeader("User-Agent"),
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
	)
}

// LogSensitiveOperation logs a sensitive operation (admin actions, password changes, etc.)
func (sl *SecurityLogger) LogSensitiveOperation(c *gin.Context, operation string, details map[string]interface{}) {
	fields := []interface{}{
		"event", "sensitive_operation",
		"operation", operation,
		"ip", c.ClientIP(),
		"timestamp", time.Now().UTC().Format(time.RFC3339),
		"user_agent", c.GetHeader("User-Agent"),
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
	}

	// Add user info if available
	if userID, exists := c.Get("user_id"); exists {
		fields = append(fields, "user_id", userID)
	}
	if userEmail, exists := c.Get("user_email"); exists {
		fields = append(fields, "user_email", userEmail)
	}

	// Add extra details
	for k, v := range details {
		fields = append(fields, k, v)
	}

	sl.logger.Infow("Sensitive operation performed", fields...)
}

// LogRateLimitExceeded logs when a rate limit is exceeded
func (sl *SecurityLogger) LogRateLimitExceeded(c *gin.Context) {
	sl.logger.Warnw("Rate limit exceeded",
		"event", "rate_limit_exceeded",
		"ip", c.ClientIP(),
		"timestamp", time.Now().UTC().Format(time.RFC3339),
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
		"user_agent", c.GetHeader("User-Agent"),
	)
}

// LogAccountLocked logs when an account gets locked due to failed attempts
func (sl *SecurityLogger) LogAccountLocked(c *gin.Context, email string) {
	sl.logger.Warnw("Account locked",
		"event", "account_locked",
		"ip", c.ClientIP(),
		"timestamp", time.Now().UTC().Format(time.RFC3339),
		"email", email,
		"user_agent", c.GetHeader("User-Agent"),
	)
}

// SecurityAuditMiddleware logs all authentication-related responses.
// It captures 401 responses and logs them as auth failures.
func SecurityAuditMiddleware(secLogger *SecurityLogger) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Log authentication failures (401 responses)
		if c.Writer.Status() == 401 {
			email := ""
			// Try to extract email from the request context or path
			if c.Request.URL.Path == "/api/v1/auth/login" || c.Request.URL.Path == "/api/v1/admin/login" {
				email = "(login attempt)"
			}
			secLogger.LogAuthFailure(c, "unauthorized_response", email)
		}

		// Log forbidden access attempts (403 responses)
		if c.Writer.Status() == 403 {
			secLogger.logger.Warnw("Forbidden access attempt",
				"event", "forbidden_access",
				"ip", c.ClientIP(),
				"timestamp", time.Now().UTC().Format(time.RFC3339),
				"path", c.Request.URL.Path,
				"method", c.Request.Method,
				"user_agent", c.GetHeader("User-Agent"),
			)
		}
	}
}
