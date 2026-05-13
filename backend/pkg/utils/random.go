package utils

import (
	"crypto/rand"
	"encoding/base64"
)

// GenerateRandomString generates a random string of the specified length
func GenerateRandomString(length int) string {
	// Calculate the number of bytes needed
	// Base64 encoding produces 4 characters for every 3 bytes
	numBytes := (length * 3) / 4
	if numBytes < length {
		numBytes = length
	}

	// Generate random bytes
	bytes := make([]byte, numBytes)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to a simple random string if crypto/rand fails
		return generateFallbackString(length)
	}

	// Encode to base64 and trim to desired length
	encoded := base64.URLEncoding.EncodeToString(bytes)
	if len(encoded) > length {
		encoded = encoded[:length]
	}

	return encoded
}

// generateFallbackString generates a simple random string as fallback
func generateFallbackString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	randomBytes := make([]byte, length)
	_, _ = rand.Read(randomBytes)

	for i := 0; i < length; i++ {
		result[i] = charset[int(randomBytes[i])%len(charset)]
	}

	return string(result)
}
