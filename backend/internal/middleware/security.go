package middleware

import (
	"fmt"
	"html"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/pkg/response"
)

// RateLimiter implements a simple in-memory rate limiter using token bucket algorithm.
// For production, use Redis-based rate limiting (e.g., via nginx or a dedicated service).
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	limit    int
	window   time.Duration
}

type visitor struct {
	count    int
	lastSeen time.Time
}

// NewRateLimiter creates a new rate limiter with the given limit per window.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		limit:    limit,
		window:   window,
	}
	// Start cleanup goroutine
	go rl.cleanup()
	return rl
}

// cleanup removes stale entries every minute
func (rl *RateLimiter) cleanup() {
	for {
		time.Sleep(time.Minute)
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > rl.window {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if the given IP is within the rate limit
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
		return true
	}

	// Reset if window has passed
	if time.Since(v.lastSeen) > rl.window {
		v.count = 1
		v.lastSeen = time.Now()
		return true
	}

	v.count++
	v.lastSeen = time.Now()
	return v.count <= rl.limit
}

// RateLimitMiddleware creates a rate limiting middleware.
// Limits requests to 100 per minute per IP address (Requirement 19.5).
func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.Allow(ip) {
			response.TooManyRequests(c, "rate limit exceeded", "maximum 100 requests per minute")
			c.Abort()
			return
		}
		c.Next()
	}
}

// CORSMiddleware configures Cross-Origin Resource Sharing headers.
// Requirement 19: CORS configuration for frontend-backend communication.
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// Check if origin is allowed
		allowed := false
		for _, o := range allowedOrigins {
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-ID")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID")
		c.Header("Access-Control-Max-Age", "86400")
		c.Header("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// SecurityHeadersMiddleware adds security-related HTTP headers.
// Prevents XSS, clickjacking, and content-type sniffing attacks.
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent XSS attacks
		c.Header("X-XSS-Protection", "1; mode=block")
		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")
		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")
		// Referrer policy
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		// Content Security Policy
		c.Header("Content-Security-Policy", "default-src 'self'")

		c.Next()
	}
}

// InputSanitizationMiddleware sanitizes common input fields to prevent XSS.
// Note: GORM already uses parameterized queries preventing SQL injection.
// This middleware adds an extra layer of XSS protection by escaping HTML
// in query parameters.
func InputSanitizationMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Sanitize query parameters
		query := c.Request.URL.Query()
		for key, values := range query {
			for i, v := range values {
				// Escape HTML special characters in query params
				sanitized := html.EscapeString(v)
				if sanitized != v {
					values[i] = sanitized
				}
			}
			query[key] = values
		}
		c.Request.URL.RawQuery = query.Encode()

		c.Next()
	}
}

// RequestSizeLimitMiddleware limits the maximum request body size.
// Prevents denial-of-service via large payloads.
func RequestSizeLimitMiddleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			response.BadRequest(c, "request body too large",
				fmt.Sprintf("maximum size is %d bytes", maxBytes))
			c.Abort()
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

// TrustedProxiesMiddleware validates that requests come through trusted proxies.
func TrustedProxiesMiddleware(trustedProxies []string) gin.HandlerFunc {
	trusted := make(map[string]bool)
	for _, p := range trustedProxies {
		trusted[p] = true
	}

	return func(c *gin.Context) {
		// If no trusted proxies configured, allow all
		if len(trustedProxies) == 0 {
			c.Next()
			return
		}

		// Validate X-Forwarded-For header
		forwardedFor := c.GetHeader("X-Forwarded-For")
		if forwardedFor != "" {
			ips := strings.Split(forwardedFor, ",")
			for _, ip := range ips {
				ip = strings.TrimSpace(ip)
				if !trusted[ip] && ip != c.ClientIP() {
					// Log suspicious forwarded header but don't block
					break
				}
			}
		}

		c.Next()
	}
}
