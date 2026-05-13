package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Operations defines the interface for cache operations
type Operations interface {
	// Get retrieves a value from cache
	Get(ctx context.Context, key string) (string, error)

	// Set stores a value in cache with TTL
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error

	// Delete removes a key from cache
	Delete(ctx context.Context, key string) error

	// DeleteByPattern removes all keys matching a pattern
	DeleteByPattern(ctx context.Context, pattern string) error

	// Exists checks if a key exists
	Exists(ctx context.Context, key string) (bool, error)

	// GetJSON retrieves a JSON value from cache and unmarshals it
	GetJSON(ctx context.Context, key string, dest interface{}) error

	// SetJSON stores a JSON value in cache with TTL
	SetJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) error

	// SetNX sets a value only if the key does not exist (for distributed locking)
	SetNX(ctx context.Context, key string, value interface{}, ttl time.Duration) (bool, error)

	// Expire sets the TTL for an existing key
	Expire(ctx context.Context, key string, ttl time.Duration) error

	// TTL returns the remaining time-to-live for a key
	TTL(ctx context.Context, key string) (time.Duration, error)

	// Incr increments a counter
	Incr(ctx context.Context, key string) (int64, error)

	// IncrBy increments a counter by a specific amount
	IncrBy(ctx context.Context, key string, value int64) (int64, error)

	// Decr decrements a counter
	Decr(ctx context.Context, key string) (int64, error)

	// DecrBy decrements a counter by a specific amount
	DecrBy(ctx context.Context, key string, value int64) (int64, error)
}

// Ensure RedisClient implements Operations interface
var _ Operations = (*RedisClient)(nil)

// Get retrieves a value from cache
func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	result, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", ErrKeyNotFound
	}
	if err != nil {
		return "", fmt.Errorf("failed to get key %s: %w", key, err)
	}
	return result, nil
}

// Set stores a value in cache with TTL
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if err := r.client.Set(ctx, key, value, ttl).Err(); err != nil {
		return fmt.Errorf("failed to set key %s: %w", key, err)
	}
	return nil
}

// Delete removes a key from cache
func (r *RedisClient) Delete(ctx context.Context, key string) error {
	if err := r.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete key %s: %w", key, err)
	}
	return nil
}

// DeleteByPattern removes all keys matching a pattern
// Example pattern: "digital-store:products:*"
func (r *RedisClient) DeleteByPattern(ctx context.Context, pattern string) error {
	iter := r.client.Scan(ctx, 0, pattern, 0).Iterator()
	for iter.Next(ctx) {
		if err := r.client.Del(ctx, iter.Val()).Err(); err != nil {
			r.log.Error(fmt.Sprintf("failed to delete key %s: %v", iter.Val(), err))
		}
	}
	if err := iter.Err(); err != nil {
		return fmt.Errorf("failed to scan keys with pattern %s: %w", pattern, err)
	}
	return nil
}

// Exists checks if a key exists
func (r *RedisClient) Exists(ctx context.Context, key string) (bool, error) {
	result, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check existence of key %s: %w", key, err)
	}
	return result > 0, nil
}

// GetJSON retrieves a JSON value from cache and unmarshals it
func (r *RedisClient) GetJSON(ctx context.Context, key string, dest interface{}) error {
	data, err := r.Get(ctx, key)
	if err != nil {
		return err
	}

	if err := json.Unmarshal([]byte(data), dest); err != nil {
		return fmt.Errorf("failed to unmarshal JSON for key %s: %w", key, err)
	}

	return nil
}

// SetJSON stores a JSON value in cache with TTL
func (r *RedisClient) SetJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON for key %s: %w", key, err)
	}

	return r.Set(ctx, key, data, ttl)
}

// SetNX sets a value only if the key does not exist (useful for distributed locking)
func (r *RedisClient) SetNX(ctx context.Context, key string, value interface{}, ttl time.Duration) (bool, error) {
	result, err := r.client.SetNX(ctx, key, value, ttl).Result()
	if err != nil {
		return false, fmt.Errorf("failed to set key %s with NX: %w", key, err)
	}
	return result, nil
}

// Expire sets the TTL for an existing key
func (r *RedisClient) Expire(ctx context.Context, key string, ttl time.Duration) error {
	if err := r.client.Expire(ctx, key, ttl).Err(); err != nil {
		return fmt.Errorf("failed to set expiry for key %s: %w", key, err)
	}
	return nil
}

// TTL returns the remaining time-to-live for a key
func (r *RedisClient) TTL(ctx context.Context, key string) (time.Duration, error) {
	result, err := r.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get TTL for key %s: %w", key, err)
	}
	return result, nil
}

// Incr increments a counter
func (r *RedisClient) Incr(ctx context.Context, key string) (int64, error) {
	result, err := r.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to increment key %s: %w", key, err)
	}
	return result, nil
}

// IncrBy increments a counter by a specific amount
func (r *RedisClient) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	result, err := r.client.IncrBy(ctx, key, value).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to increment key %s by %d: %w", key, value, err)
	}
	return result, nil
}

// Decr decrements a counter
func (r *RedisClient) Decr(ctx context.Context, key string) (int64, error) {
	result, err := r.client.Decr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to decrement key %s: %w", key, err)
	}
	return result, nil
}

// DecrBy decrements a counter by a specific amount
func (r *RedisClient) DecrBy(ctx context.Context, key string, value int64) (int64, error) {
	result, err := r.client.DecrBy(ctx, key, value).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to decrement key %s by %d: %w", key, value, err)
	}
	return result, nil
}
