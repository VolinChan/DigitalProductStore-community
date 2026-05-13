package logger

import (
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger wraps zap.SugaredLogger
type Logger struct {
	*zap.SugaredLogger
}

// New creates a new logger instance
func New(environment string) *Logger {
	var config zap.Config

	if environment == "production" {
		config = zap.NewProductionConfig()
		config.EncoderConfig.TimeKey = "timestamp"
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	} else {
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	// Output to stdout
	config.OutputPaths = []string{"stdout"}
	config.ErrorOutputPaths = []string{"stderr"}

	logger, err := config.Build()
	if err != nil {
		panic(err)
	}

	return &Logger{logger.Sugar()}
}

// Sync flushes any buffered log entries
func (l *Logger) Sync() error {
	return l.SugaredLogger.Sync()
}

// Middleware returns a gin middleware for logging requests
func Middleware(logger *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Get status code
		statusCode := c.Writer.Status()

		// Get client IP
		clientIP := c.ClientIP()

		// Get method
		method := c.Request.Method

		// Log request
		if statusCode >= 500 {
			logger.Errorw("Server error",
				"method", method,
				"path", path,
				"query", query,
				"status", statusCode,
				"latency", latency.String(),
				"client_ip", clientIP,
				"errors", c.Errors.String(),
			)
		} else if statusCode >= 400 {
			logger.Warnw("Client error",
				"method", method,
				"path", path,
				"query", query,
				"status", statusCode,
				"latency", latency.String(),
				"client_ip", clientIP,
			)
		} else {
			logger.Infow("Request",
				"method", method,
				"path", path,
				"query", query,
				"status", statusCode,
				"latency", latency.String(),
				"client_ip", clientIP,
			)
		}
	}
}

// Fatal logs a fatal error and exits
func (l *Logger) Fatal(msg string, args ...interface{}) {
	l.SugaredLogger.Fatalf(msg, args...)
	os.Exit(1)
}
