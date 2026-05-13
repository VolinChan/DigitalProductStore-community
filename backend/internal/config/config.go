package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the application
type Config struct {
	Environment string
	Server      ServerConfig
	Database    DatabaseConfig
	Redis       RedisConfig
	JWT         JWTConfig
	Email       EmailConfig
	Storage     StorageConfig
	Payment     PaymentConfig
	RateLimit   RateLimitConfig
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	Host            string
	Port            string
	User            string
	Password        string
	Name            string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// RedisConfig holds Redis connection configuration
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// JWTConfig holds JWT authentication configuration
type JWTConfig struct {
	Secret          string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	Issuer          string
}

// EmailConfig holds email service configuration
type EmailConfig struct {
	Provider    string // "smtp", "sendgrid", "ses"
	SMTPHost    string
	SMTPPort    int
	SMTPUser    string
	SMTPPass    string
	SendGridKey string
	FromName    string
	FromEmail   string
	// BrandName is rendered inside email templates. Falls back to
	// FromName if unset.
	BrandName string
	// PasswordResetBaseURL is the front-end URL the password reset
	// email links to. The token is appended as ?token=<token>.
	PasswordResetBaseURL string
	// Enabled toggles the real SMTP sender on/off. When false, a
	// no-op sender is wired in — useful for local dev, CI and tests
	// where SMTP is not reachable.
	Enabled bool
}

// IsEnabled reports whether the email sender should be activated. It
// returns true only if Enabled is set AND the minimum configuration
// (host + from address) is present. This keeps main.go from falling
// into an obvious misconfiguration.
func (e EmailConfig) IsEnabled() bool {
	if !e.Enabled {
		return false
	}
	return e.SMTPHost != "" && e.FromEmail != "" && e.SMTPPort != 0
}

// StorageConfig holds file storage configuration
type StorageConfig struct {
	Provider string // "local", "s3", "minio"
	LocalDir string
	
	// S3/MinIO configuration
	S3Bucket    string
	S3Region    string
	S3AccessKey string
	S3SecretKey string
	S3Endpoint  string // For MinIO or custom S3 endpoints
}

// PaymentConfig holds payment gateway configuration
type PaymentConfig struct {
	StripeSecretKey     string
	StripeWebhookSecret string
	StripeSuccessURL    string
	StripeCancelURL     string
	PayPalClientID      string
	PayPalClientSecret  string
	PayPalSandbox       bool
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Enabled      bool
	RequestsPerMinute int
	BlockDuration    time.Duration
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		Environment: getEnv("APP_ENV", "development"),
		
		Server: ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  getDurationEnv("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: getDurationEnv("SERVER_WRITE_TIMEOUT", 15*time.Second),
			IdleTimeout:  getDurationEnv("SERVER_IDLE_TIMEOUT", 60*time.Second),
		},
		
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnv("DB_PORT", "5432"),
			User:            getEnv("DB_USER", "postgres"),
			Password:        getEnv("DB_PASSWORD", "postgres"),
			Name:            getEnv("DB_NAME", "digital_store"),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			MaxOpenConns:    getIntEnv("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getIntEnv("DB_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime: getDurationEnv("DB_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getIntEnv("REDIS_DB", 0),
		},
		
		JWT: JWTConfig{
			Secret:          getEnv("JWT_SECRET", "your-super-secret-key-change-in-production"),
			AccessTokenTTL:  getDurationEnv("JWT_ACCESS_TOKEN_TTL", 24*time.Hour),
			RefreshTokenTTL: getDurationEnv("JWT_REFRESH_TOKEN_TTL", 7*24*time.Hour),
			Issuer:          getEnv("JWT_ISSUER", "digital-store"),
		},
		
		Email: EmailConfig{
			Provider:             getEnv("EMAIL_PROVIDER", "smtp"),
			SMTPHost:             getEnv("SMTP_HOST", "localhost"),
			SMTPPort:             getIntEnv("SMTP_PORT", 587),
			SMTPUser:             getEnv("SMTP_USER", ""),
			SMTPPass:             getEnv("SMTP_PASS", ""),
			SendGridKey:          getEnv("SENDGRID_API_KEY", ""),
			FromName:             getEnv("EMAIL_FROM_NAME", "Digital Store"),
			FromEmail:            getEnv("EMAIL_FROM_ADDRESS", "noreply@digitalstore.com"),
			BrandName:            getEnv("EMAIL_BRAND_NAME", ""),
			PasswordResetBaseURL: getEnv("EMAIL_PASSWORD_RESET_URL", ""),
			Enabled:              getEnv("EMAIL_ENABLED", "false") == "true",
		},
		
		Storage: StorageConfig{
			Provider:    getEnv("STORAGE_PROVIDER", "local"),
			LocalDir:    getEnv("STORAGE_LOCAL_DIR", "./uploads"),
			S3Bucket:    getEnv("S3_BUCKET", ""),
			S3Region:    getEnv("S3_REGION", "us-east-1"),
			S3AccessKey: getEnv("S3_ACCESS_KEY", ""),
			S3SecretKey: getEnv("S3_SECRET_KEY", ""),
			S3Endpoint:  getEnv("S3_ENDPOINT", ""),
		},
		
		Payment: PaymentConfig{
			StripeSecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
			StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
			StripeSuccessURL:    getEnv("STRIPE_SUCCESS_URL", "http://localhost:3000/checkout/success"),
			StripeCancelURL:     getEnv("STRIPE_CANCEL_URL", "http://localhost:3000/checkout/cancel"),
			PayPalClientID:      getEnv("PAYPAL_CLIENT_ID", ""),
			PayPalClientSecret:  getEnv("PAYPAL_CLIENT_SECRET", ""),
			PayPalSandbox:       getEnv("PAYPAL_SANDBOX", "true") == "true",
		},
		
		RateLimit: RateLimitConfig{
			Enabled:          getEnv("RATE_LIMIT_ENABLED", "true") == "true",
			RequestsPerMinute: getIntEnv("RATE_LIMIT_REQUESTS_PER_MINUTE", 100),
			BlockDuration:     getDurationEnv("RATE_LIMIT_BLOCK_DURATION", 1*time.Minute),
		},
	}

	// Validate required configuration
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return cfg, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.Environment == "" {
		return fmt.Errorf("environment is required")
	}
	if c.Server.Port == "" {
		return fmt.Errorf("server port is required")
	}
	if c.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if c.Database.Name == "" {
		return fmt.Errorf("database name is required")
	}
	if c.JWT.Secret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	return nil
}

// GetDSN returns the database connection string
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode,
	)
}

// GetRedisAddr returns the Redis address
func (c *RedisConfig) GetRedisAddr() string {
	return fmt.Sprintf("%s:%s", c.Host, c.Port)
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction returns true if running in production mode
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
