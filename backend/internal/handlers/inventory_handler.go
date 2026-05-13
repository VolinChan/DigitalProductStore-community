package handlers

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/middleware"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// InventoryHandler handles admin inventory management HTTP requests.
// Requirements addressed: 15.1-15.7 (库存管理)
type InventoryHandler struct {
	inventoryService services.InventoryService
}

// NewInventoryHandler creates a new inventory handler.
func NewInventoryHandler(inventoryService services.InventoryService) *InventoryHandler {
	return &InventoryHandler{
		inventoryService: inventoryService,
	}
}

// ListInventory handles GET /api/v1/admin/inventory
// Returns a paginated list of all SKU inventory.
func (h *InventoryHandler) ListInventory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	search := c.Query("search")

	params := &services.ListInventoryParams{
		Page:     page,
		PageSize: pageSize,
		Search:   search,
	}

	result, err := h.inventoryService.ListInventory(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "Failed to list inventory", err.Error())
		return
	}

	meta := response.Paginate(result.Page, result.Size, result.Total)
	response.SuccessWithMeta(c, result.Items, meta)
}

// AdjustInventoryRequest represents the request body for adjusting inventory.
type AdjustInventoryRequest struct {
	Adjustment int    `json:"adjustment" binding:"required"`
	Reason     string `json:"reason" binding:"required,min=1,max=200"`
}

// AdjustInventory handles PUT /api/v1/admin/inventory/:sku_id
// Adjusts inventory for a specific SKU with a reason note.
// Requirements: 15.3, 15.5
func (h *InventoryHandler) AdjustInventory(c *gin.Context) {
	// Parse SKU ID
	skuIDStr := c.Param("sku_id")
	skuID, err := strconv.ParseUint(skuIDStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid SKU ID", err.Error())
		return
	}

	var req AdjustInventoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Validate reason is not empty after trimming
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		response.BadRequest(c, "Reason is required")
		return
	}

	if req.Adjustment == 0 {
		response.BadRequest(c, "Adjustment cannot be zero")
		return
	}

	// Get admin user ID from context
	adminID, ok := middleware.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "authentication required")
		return
	}

	err = h.inventoryService.UpdateInventory(c.Request.Context(), uint(skuID), req.Adjustment, reason, adminID)
	if err != nil {
		if errors.Is(err, services.ErrInsufficientStock) {
			response.BadRequest(c, "Insufficient stock", err.Error())
			return
		}
		if errors.Is(err, services.ErrInvalidAdjustment) {
			response.BadRequest(c, "Invalid adjustment", err.Error())
			return
		}
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "SKU not found", err.Error())
			return
		}
		response.InternalError(c, "Failed to adjust inventory", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Inventory adjusted successfully"})
}

// GetLowStockAlerts handles GET /api/v1/admin/inventory/alerts
// Returns SKUs with inventory at or below the threshold.
// Requirements: 15.6
func (h *InventoryHandler) GetLowStockAlerts(c *gin.Context) {
	threshold := services.DefaultLowStockThreshold
	if thresholdStr := c.Query("threshold"); thresholdStr != "" {
		if t, err := strconv.Atoi(thresholdStr); err == nil && t > 0 {
			threshold = t
		}
	}

	alerts, err := h.inventoryService.GetLowStockAlerts(c.Request.Context(), threshold)
	if err != nil {
		response.InternalError(c, "Failed to get low stock alerts", err.Error())
		return
	}

	response.Success(c, alerts)
}

// GetInventoryHistory handles GET /api/v1/admin/inventory/:sku_id/history
// Returns paginated inventory change history for a specific SKU.
// Requirements: 15.5, 15.7
func (h *InventoryHandler) GetInventoryHistory(c *gin.Context) {
	// Parse SKU ID
	skuIDStr := c.Param("sku_id")
	skuID, err := strconv.ParseUint(skuIDStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid SKU ID", err.Error())
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	sortOrder := c.DefaultQuery("sort_order", "desc")

	params := &services.ListInventoryHistoryParams{
		Page:      page,
		PageSize:  pageSize,
		SortOrder: sortOrder,
	}

	// Parse optional date range filters
	if startStr := c.Query("start_date"); startStr != "" {
		if t, err := time.Parse("2006-01-02", startStr); err == nil {
			params.StartDate = &t
		}
	}
	if endStr := c.Query("end_date"); endStr != "" {
		if t, err := time.Parse("2006-01-02", endStr); err == nil {
			// Set end date to end of day
			endOfDay := t.Add(24*time.Hour - time.Second)
			params.EndDate = &endOfDay
		}
	}

	logs, total, err := h.inventoryService.GetInventoryHistory(c.Request.Context(), uint(skuID), params)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "SKU not found", err.Error())
			return
		}
		response.InternalError(c, "Failed to get inventory history", err.Error())
		return
	}

	meta := response.Paginate(page, pageSize, total)
	response.SuccessWithMeta(c, logs, meta)
}
