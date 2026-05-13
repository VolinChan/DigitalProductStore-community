package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/digital-store/backend/internal/config"
	"github.com/digital-store/backend/pkg/logger"
)

// RedisClient wraps the Redis client with additional functionality
type RedisClient struct {
	client *redis.Client
	log    *logger.Logger
}

// New creates a new Redis client
func New(cfg *config.RedisConfig, log *logger.Logger) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.GetRedisAddr(),
		Password: cfg.Password,
		DB:       cfg.DB,
		// Connection pool settings
		PoolSize:     10,
		MinIdleConns: 5,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Info("Redis connection established")

	return &RedisClient{
		client: client,
		log:    log,
	}, nil
}

// Close closes the Redis connection
func (r *RedisClient) Close() error {
	if err := r.client.Close(); err != nil {
		return fmt.Errorf("failed to close Redis connection: %w", err)
	}
	r.log.Info("Redis connection closed")
	return nil
}

// Ping checks the Redis connection
func (r *RedisClient) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// GetClient returns the underlying Redis client for advanced operations
func (r *RedisClient) GetClient() *redis.Client {
	return r.client
}

// HealthCheck returns the health status of Redis
func (r *RedisClient) HealthCheck(ctx context.Context) map[string]interface{} {
	status := "ok"
	err := r.Ping(ctx)
	if err != nil {
		status = "error: " + err.Error()
	}

	return map[string]interface{}{
		"status": status,
	}
}
