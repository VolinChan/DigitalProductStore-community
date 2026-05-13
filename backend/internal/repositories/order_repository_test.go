package repositories

import (
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// orderNumberPattern matches the expected order number format:
// "ORD" followed by 14 digits (yyyyMMddHHmmss) and 8 lowercase hex chars.
var orderNumberPattern = regexp.MustCompile(`^ORD\d{14}[0-9a-f]{8}$`)

func TestBuildOrderNumber_Format(t *testing.T) {
	ts := time.Date(2024, time.January, 15, 14, 30, 20, 0, time.UTC)

	number, err := buildOrderNumber(ts)
	require.NoError(t, err)

	assert.True(t, orderNumberPattern.MatchString(number),
		"order number %q does not match expected format", number)
	assert.True(t, strings.HasPrefix(number, "ORD20240115143020"),
		"order number %q should start with ORD<timestamp>", number)
	// ORD(3) + 14 digit timestamp + 8 hex chars = 25 characters total.
	assert.Equal(t, 25, len(number), "order number should have fixed length 25")
}

func TestBuildOrderNumber_UniqueSuffix(t *testing.T) {
	// Generating many numbers at the same instant should still produce
	// unique values because of the 32-bit random suffix.
	ts := time.Date(2024, time.January, 15, 14, 30, 20, 0, time.UTC)

	seen := make(map[string]struct{}, 1000)
	for i := 0; i < 1000; i++ {
		n, err := buildOrderNumber(ts)
		require.NoError(t, err)
		_, dup := seen[n]
		assert.Falsef(t, dup, "duplicate order number generated at iteration %d: %s", i, n)
		seen[n] = struct{}{}
	}
}

func TestGenerateOrderNumber_Exported(t *testing.T) {
	n, err := GenerateOrderNumber()
	require.NoError(t, err)
	assert.True(t, orderNumberPattern.MatchString(n),
		"exported GenerateOrderNumber produced %q which does not match expected format", n)
}
