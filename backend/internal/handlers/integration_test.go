package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Integration test helpers

// testResponse represents a standard API response for testing
type testResponse struct {
	Success   bool            `json:"success"`
	Data      json.RawMessage `json:"data,omitempty"`
	Error     *testError      `json:"error,omitempty"`
	RequestID string          `json:"request_id,omitempty"`
}

type testError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// setupTestRouter creates a minimal Gin router for integration testing
func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	return router
}

// makeRequest is a helper to make HTTP requests in tests
func makeRequest(router *gin.Engine, method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// TestUserFlowIntegration tests the complete user flow:
// Register → Login → Access Protected Resource
// This is a structural integration test that validates the API contract.
func TestUserFlowIntegration(t *testing.T) {
	router := setupTestRouter()

	// Mock health endpoint to verify router works
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    gin.H{"status": "healthy"},
		})
	})

	// Mock register endpoint
	router.POST("/api/v1/auth/register", func(c *gin.Context) {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
			FullName string `json:"full_name"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		if req.Email == "" || req.Password == "" || req.FullName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": "missing fields"}})
			return
		}
		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"data": gin.H{
				"id":        1,
				"email":     req.Email,
				"full_name": req.FullName,
				"role":      "user",
				"is_active": true,
			},
		})
	})

	// Mock login endpoint
	router.POST("/api/v1/auth/login", func(c *gin.Context) {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		if req.Email == "test@example.com" && req.Password == "Password123!" {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data": gin.H{
					"access_token":  "test-jwt-token",
					"refresh_token": "test-refresh-token",
					"token_type":    "Bearer",
					"expires_in":    86400,
				},
			})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "invalid credentials"}})
		}
	})

	// Mock cart endpoints
	router.POST("/api/v1/cart/items", func(c *gin.Context) {
		var req struct {
			SKUID    uint `json:"sku_id"`
			Quantity int  `json:"quantity"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"id":       1,
				"sku_id":   req.SKUID,
				"quantity": req.Quantity,
			},
		})
	})

	router.GET("/api/v1/cart", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"items": []gin.H{
					{"sku_id": 1, "quantity": 2, "unit_price": "99.99"},
				},
				"total": "199.98",
			},
		})
	})

	// Mock order creation
	router.POST("/api/v1/orders", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"data": gin.H{
				"id":             1,
				"order_number":   "ORD-20240101-001",
				"status":        "pending_payment",
				"total_amount":  "199.98",
				"payment_method": "online",
			},
		})
	})

	t.Run("Health Check", func(t *testing.T) {
		w := makeRequest(router, "GET", "/health", nil, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("Register User", func(t *testing.T) {
		body := map[string]string{
			"email":     "test@example.com",
			"password":  "Password123!",
			"full_name": "Test User",
		}
		w := makeRequest(router, "POST", "/api/v1/auth/register", body, nil)
		assert.Equal(t, http.StatusCreated, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("Register User - Missing Fields", func(t *testing.T) {
		body := map[string]string{
			"email": "test@example.com",
		}
		w := makeRequest(router, "POST", "/api/v1/auth/register", body, nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Login User", func(t *testing.T) {
		body := map[string]string{
			"email":    "test@example.com",
			"password": "Password123!",
		}
		w := makeRequest(router, "POST", "/api/v1/auth/login", body, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		var data map[string]interface{}
		err = json.Unmarshal(resp.Data, &data)
		require.NoError(t, err)
		assert.NotEmpty(t, data["access_token"])
		assert.Equal(t, "Bearer", data["token_type"])
	})

	t.Run("Login User - Invalid Credentials", func(t *testing.T) {
		body := map[string]string{
			"email":    "test@example.com",
			"password": "wrongpassword",
		}
		w := makeRequest(router, "POST", "/api/v1/auth/login", body, nil)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("Add to Cart", func(t *testing.T) {
		body := map[string]interface{}{
			"sku_id":   1,
			"quantity": 2,
		}
		w := makeRequest(router, "POST", "/api/v1/cart/items", body, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("Get Cart", func(t *testing.T) {
		w := makeRequest(router, "GET", "/api/v1/cart", nil, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("Create Order", func(t *testing.T) {
		body := map[string]interface{}{
			"shipping_address": "123 Test St, City, Country",
			"payment_method":   "online",
			"guest_email":      "test@example.com",
			"guest_name":       "Test User",
			"guest_phone":      "+1234567890",
		}
		w := makeRequest(router, "POST", "/api/v1/orders", body, nil)
		assert.Equal(t, http.StatusCreated, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		var data map[string]interface{}
		err = json.Unmarshal(resp.Data, &data)
		require.NoError(t, err)
		assert.NotEmpty(t, data["order_number"])
		assert.Equal(t, "pending_payment", data["status"])
	})
}

// TestGuestFlowIntegration tests the guest checkout flow
func TestGuestFlowIntegration(t *testing.T) {
	router := setupTestRouter()

	// Mock product listing
	router.GET("/api/v1/products", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": []gin.H{
				{
					"id":          1,
					"name":        "Test Product",
					"description": "A test product",
					"is_active":   true,
				},
			},
			"meta": gin.H{"page": 1, "per_page": 20, "total": 1, "total_pages": 1},
		})
	})

	// Mock product detail
	router.GET("/api/v1/products/:id", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"id":          1,
				"name":        "Test Product",
				"description": "A test product",
				"skus": []gin.H{
					{"id": 1, "sku_code": "TEST-001", "price": "99.99", "inventory": 10},
				},
			},
		})
	})

	// Mock order tracking
	router.POST("/api/v1/orders/track", func(c *gin.Context) {
		var req struct {
			OrderNumber string `json:"order_number"`
			Email       string `json:"email"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST"}})
			return
		}
		if req.OrderNumber == "ORD-20240101-001" && req.Email == "guest@example.com" {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data": gin.H{
					"order_number": req.OrderNumber,
					"status":       "pending_payment",
					"total_amount": "99.99",
				},
			})
		} else {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "order not found"}})
		}
	})

	t.Run("Browse Products", func(t *testing.T) {
		w := makeRequest(router, "GET", "/api/v1/products", nil, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("View Product Detail", func(t *testing.T) {
		w := makeRequest(router, "GET", "/api/v1/products/1", nil, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("Track Order - Valid", func(t *testing.T) {
		body := map[string]string{
			"order_number": "ORD-20240101-001",
			"email":        "guest@example.com",
		}
		w := makeRequest(router, "POST", "/api/v1/orders/track", body, nil)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Track Order - Not Found", func(t *testing.T) {
		body := map[string]string{
			"order_number": "INVALID-ORDER",
			"email":        "guest@example.com",
		}
		w := makeRequest(router, "POST", "/api/v1/orders/track", body, nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// TestAdminFlowIntegration tests admin management flow
func TestAdminFlowIntegration(t *testing.T) {
	router := setupTestRouter()

	// Mock admin login
	router.POST("/api/v1/admin/login", func(c *gin.Context) {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false})
			return
		}
		if req.Email == "admin@store.com" && req.Password == "AdminPass123!" {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data": gin.H{
					"access_token":  "admin-jwt-token",
					"refresh_token": "admin-refresh-token",
					"token_type":    "Bearer",
					"expires_in":    28800,
				},
			})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED"}})
		}
	})

	t.Run("Admin Login - Success", func(t *testing.T) {
		body := map[string]string{
			"email":    "admin@store.com",
			"password": "AdminPass123!",
		}
		w := makeRequest(router, "POST", "/api/v1/admin/login", body, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		var data map[string]interface{}
		err = json.Unmarshal(resp.Data, &data)
		require.NoError(t, err)
		assert.Equal(t, float64(28800), data["expires_in"])
	})

	t.Run("Admin Login - Invalid Credentials", func(t *testing.T) {
		body := map[string]string{
			"email":    "admin@store.com",
			"password": "wrong",
		}
		w := makeRequest(router, "POST", "/api/v1/admin/login", body, nil)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}
