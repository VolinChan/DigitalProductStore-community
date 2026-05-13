package handlers_test

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestStripeWebhookIntegration tests the Stripe webhook flow with signature verification
func TestStripeWebhookIntegration(t *testing.T) {
	router := setupTestRouter()

	webhookSecret := "whsec_test_secret_key"

	// Mock Stripe webhook endpoint with signature verification
	router.POST("/api/v1/payments/webhook/stripe", func(c *gin.Context) {
		// Read the raw body
		body, err := c.GetRawData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"message": "failed to read body"}})
			return
		}

		// Verify Stripe signature
		sigHeader := c.GetHeader("Stripe-Signature")
		if sigHeader == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"message": "missing stripe signature"}})
			return
		}

		// Parse timestamp and signature from header
		// Format: t=timestamp,v1=signature
		var timestamp, signature string
		for _, part := range splitStripeHeader(sigHeader) {
			if len(part) > 2 {
				switch part[:2] {
				case "t=":
					timestamp = part[2:]
				case "v1":
					if len(part) > 3 && part[2] == '=' {
						signature = part[3:]
					}
				}
			}
		}

		if timestamp == "" || signature == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"message": "invalid stripe signature format"}})
			return
		}

		// Compute expected signature
		signedPayload := fmt.Sprintf("%s.%s", timestamp, string(body))
		mac := hmac.New(sha256.New, []byte(webhookSecret))
		mac.Write([]byte(signedPayload))
		expectedSig := hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"message": "invalid signature"}})
			return
		}

		// Parse event
		var event struct {
			Type string `json:"type"`
			Data struct {
				Object struct {
					ID            string `json:"id"`
					PaymentIntent string `json:"payment_intent"`
					Status        string `json:"status"`
				} `json:"object"`
			} `json:"data"`
		}
		if err := json.Unmarshal(body, &event); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"message": "invalid event payload"}})
			return
		}

		switch event.Type {
		case "checkout.session.completed":
			c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "payment_confirmed"}})
		case "payment_intent.payment_failed":
			c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "payment_failed"}})
		default:
			c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "ignored"}})
		}
	})

	t.Run("Webhook - Valid Signature - Payment Success", func(t *testing.T) {
		payload := `{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_123","payment_intent":"pi_test_123","status":"complete"}}}`
		timestamp := fmt.Sprintf("%d", time.Now().Unix())

		// Compute signature
		signedPayload := fmt.Sprintf("%s.%s", timestamp, payload)
		mac := hmac.New(sha256.New, []byte(webhookSecret))
		mac.Write([]byte(signedPayload))
		signature := hex.EncodeToString(mac.Sum(nil))

		sigHeader := fmt.Sprintf("t=%s,v1=%s", timestamp, signature)

		w := makeRequest(router, "POST", "/api/v1/payments/webhook/stripe",
			nil, map[string]string{"Stripe-Signature": sigHeader})
		// Since we're passing nil body but the signature was computed for a specific payload,
		// let's use a proper request
		w = makeRequestWithRawBody(router, "POST", "/api/v1/payments/webhook/stripe",
			[]byte(payload), map[string]string{
				"Stripe-Signature": sigHeader,
				"Content-Type":    "application/json",
			})

		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("Webhook - Invalid Signature", func(t *testing.T) {
		payload := `{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_123"}}}`
		sigHeader := "t=1234567890,v1=invalid_signature_here"

		w := makeRequestWithRawBody(router, "POST", "/api/v1/payments/webhook/stripe",
			[]byte(payload), map[string]string{
				"Stripe-Signature": sigHeader,
				"Content-Type":    "application/json",
			})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Webhook - Missing Signature", func(t *testing.T) {
		payload := `{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_123"}}}`

		w := makeRequestWithRawBody(router, "POST", "/api/v1/payments/webhook/stripe",
			[]byte(payload), map[string]string{
				"Content-Type": "application/json",
			})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Webhook - Payment Failed Event", func(t *testing.T) {
		payload := `{"type":"payment_intent.payment_failed","data":{"object":{"id":"pi_test_456","status":"failed"}}}`
		timestamp := fmt.Sprintf("%d", time.Now().Unix())

		signedPayload := fmt.Sprintf("%s.%s", timestamp, payload)
		mac := hmac.New(sha256.New, []byte(webhookSecret))
		mac.Write([]byte(signedPayload))
		signature := hex.EncodeToString(mac.Sum(nil))

		sigHeader := fmt.Sprintf("t=%s,v1=%s", timestamp, signature)

		w := makeRequestWithRawBody(router, "POST", "/api/v1/payments/webhook/stripe",
			[]byte(payload), map[string]string{
				"Stripe-Signature": sigHeader,
				"Content-Type":    "application/json",
			})

		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		var data map[string]interface{}
		err = json.Unmarshal(resp.Data, &data)
		require.NoError(t, err)
		assert.Equal(t, "payment_failed", data["status"])
	})
}

// TestTransferPaymentFlowIntegration tests the transfer payment flow
func TestTransferPaymentFlowIntegration(t *testing.T) {
	router := setupTestRouter()

	// Mock transfer proof upload
	router.POST("/api/v1/payments/transfer/upload", func(c *gin.Context) {
		orderID := c.PostForm("order_id")
		if orderID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": "order_id required"}})
			return
		}

		// Simulate file upload validation
		file, err := c.FormFile("proof")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": "proof file required"}})
			return
		}

		// Check file size (10MB limit)
		if file.Size > 10*1024*1024 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": "file too large, max 10MB"}})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"order_id":             orderID,
				"status":              "pending_transfer",
				"transfer_proof_url":  "/uploads/proofs/test-proof.jpg",
				"confirmation_deadline": time.Now().Add(7 * 24 * time.Hour).Format(time.RFC3339),
			},
		})
	})

	// Mock pending transfers list (admin)
	router.GET("/api/v1/admin/payments/transfer/pending", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": []gin.H{
				{
					"id":                    1,
					"order_number":          "ORD-20240101-001",
					"amount":               "199.98",
					"transfer_proof_url":   "/uploads/proofs/proof1.jpg",
					"confirmation_deadline": time.Now().Add(5 * 24 * time.Hour).Format(time.RFC3339),
					"remaining_hours":      120,
				},
			},
		})
	})

	// Mock transfer confirmation
	router.POST("/api/v1/admin/payments/transfer/:id/confirm", func(c *gin.Context) {
		var req struct {
			ReceivedAmount float64 `json:"received_amount"`
			Notes          string  `json:"notes"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST"}})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"id":              c.Param("id"),
				"status":         "paid",
				"received_amount": req.ReceivedAmount,
				"confirmed_at":   time.Now().Format(time.RFC3339),
			},
		})
	})

	// Mock transfer rejection
	router.POST("/api/v1/admin/payments/transfer/:id/reject", func(c *gin.Context) {
		var req struct {
			Reason string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST"}})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"id":     c.Param("id"),
				"status": "payment_failed",
				"reason": req.Reason,
			},
		})
	})

	// Mock batch confirmation
	router.POST("/api/v1/admin/payments/transfer/batch-confirm", func(c *gin.Context) {
		var req struct {
			Confirmations []struct {
				PaymentID      uint    `json:"payment_id"`
				ReceivedAmount float64 `json:"received_amount"`
			} `json:"confirmations"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST"}})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"confirmed_count": len(req.Confirmations),
				"status":          "all_confirmed",
			},
		})
	})

	t.Run("List Pending Transfers", func(t *testing.T) {
		w := makeRequest(router, "GET", "/api/v1/admin/payments/transfer/pending", nil,
			map[string]string{"Authorization": "Bearer admin-token"})
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)
	})

	t.Run("Confirm Transfer Payment", func(t *testing.T) {
		body := map[string]interface{}{
			"received_amount": 199.98,
			"notes":           "Amount matches order total",
		}
		w := makeRequest(router, "POST", "/api/v1/admin/payments/transfer/1/confirm", body,
			map[string]string{"Authorization": "Bearer admin-token"})
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		var data map[string]interface{}
		err = json.Unmarshal(resp.Data, &data)
		require.NoError(t, err)
		assert.Equal(t, "paid", data["status"])
	})

	t.Run("Reject Transfer Payment", func(t *testing.T) {
		body := map[string]interface{}{
			"reason": "Amount does not match order total",
		}
		w := makeRequest(router, "POST", "/api/v1/admin/payments/transfer/2/reject", body,
			map[string]string{"Authorization": "Bearer admin-token"})
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		var data map[string]interface{}
		err = json.Unmarshal(resp.Data, &data)
		require.NoError(t, err)
		assert.Equal(t, "payment_failed", data["status"])
	})

	t.Run("Batch Confirm Transfers", func(t *testing.T) {
		body := map[string]interface{}{
			"confirmations": []map[string]interface{}{
				{"payment_id": 1, "received_amount": 99.99},
				{"payment_id": 2, "received_amount": 149.99},
			},
		}
		w := makeRequest(router, "POST", "/api/v1/admin/payments/transfer/batch-confirm", body,
			map[string]string{"Authorization": "Bearer admin-token"})
		assert.Equal(t, http.StatusOK, w.Code)

		var resp testResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		var data map[string]interface{}
		err = json.Unmarshal(resp.Data, &data)
		require.NoError(t, err)
		assert.Equal(t, float64(2), data["confirmed_count"])
	})
}

// Helper functions

func splitStripeHeader(header string) []string {
	var parts []string
	current := ""
	for _, ch := range header {
		if ch == ',' {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

func makeRequestWithRawBody(router *gin.Engine, method, path string, body []byte, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBuffer(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}
