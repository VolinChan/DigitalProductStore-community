package cache

import "errors"

// Cache-related errors
var (
	// ErrKeyNotFound is returned when a key does not exist in cache
	ErrKeyNotFound = errors.New("cache key not found")

	// ErrInvalidValue is returned when a value cannot be marshaled/unmarshaled
	ErrInvalidValue = errors.New("invalid cache value")

	// ErrConnectionFailed is returned when Redis connection fails
	ErrConnectionFailed = errors.New("failed to connect to Redis")

	// ErrOperationFailed is returned when a cache operation fails
	ErrOperationFailed = errors.New("cache operation failed")
)
