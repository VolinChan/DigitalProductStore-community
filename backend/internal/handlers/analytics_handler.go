package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// AnalyticsHandler handles admin analytics HTTP requests.
// It provides endpoints for revenue, order count, average order value,
// and CSV export (Requirements 27.1-27.7).
type AnalyticsHandler struct {
	analyticsService services.AnalyticsService
}

// NewAnalyticsHandler creates a new AnalyticsHandler.
func NewAnalyticsHandler(analyticsService services.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{analyticsService: analyticsService}
}

// parseDateRange extracts start_date and end_date query parameters.
// Supports YYYY-MM-DD and RFC3339 formats. Defaults to last 30 days if not provided.
func parseDateRange(c *gin.Context) (*services.DateRangeParams, error) {
	startStr := c.Query("start_date")
	endStr := c.Query("end_date")

	var startDate, endDate time.Time
	var err error

	if startStr == "" {
		// Default: last 30 days
		startDate = time.Now().AddDate(0, 0, -30).Truncate(24 * time.Hour)
	} else {
		startDate, err = parseDate(startStr)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date: %s", startStr)
		}
	}

	if endStr == "" {
		endDate = time.Now().Truncate(24 * time.Hour)
	} else {
		endDate, err = parseDate(endStr)
		if err != nil {
			return nil, fmt.Errorf("invalid end_date: %s", endStr)
		}
	}

	if endDate.Before(startDate) {
		return nil, fmt.Errorf("end_date must be after start_date")
	}

	return &services.DateRangeParams{
		StartDate: startDate,
		EndDate:   endDate,
	}, nil
}

// parseDate tries to parse a date string in YYYY-MM-DD or RFC3339 format.
func parseDate(s string) (time.Time, error) {
	// Try YYYY-MM-DD first
	t, err := time.Parse("2006-01-02", s)
	if err == nil {
		return t, nil
	}
	// Try RFC3339
	t, err = time.Parse(time.RFC3339, s)
	if err == nil {
		return t.Truncate(24 * time.Hour), nil
	}
	return time.Time{}, fmt.Errorf("unsupported date format: %s", s)
}

// GetRevenue handles GET /api/v1/admin/analytics/revenue.
// Returns total revenue and daily breakdown for the given date range.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 27.1, 27.4, 27.6
// @Summary      Get revenue analytics
// @Description  Returns total revenue and daily breakdown for the given date range.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/revenue [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetRevenue(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	report, err := h.analyticsService.GetRevenueReport(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get revenue report", err.Error())
		return
	}

	response.Success(c, report)
}

// GetOrderStats handles GET /api/v1/admin/analytics/orders.
// Returns total order count and daily breakdown for the given date range.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 27.2, 27.5, 27.6
// @Summary      Get order count analytics
// @Description  Returns total order count and daily breakdown for the given date range.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/orders [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetOrderStats(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	report, err := h.analyticsService.GetOrderCountReport(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get order count report", err.Error())
		return
	}

	response.Success(c, report)
}

// GetAOV handles GET /api/v1/admin/analytics/aov.
// Returns the average order value for the given date range.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 27.3, 27.6
// @Summary      Get average order value
// @Description  Returns the average order value for the given date range.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/aov [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetAOV(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	report, err := h.analyticsService.GetAverageOrderValue(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get average order value", err.Error())
		return
	}

	response.Success(c, report)
}

// ExportAnalytics handles GET /api/v1/admin/analytics/export.
// Exports daily sales data as CSV for the given date range.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 27.7
// @Summary      Export sales analytics to CSV
// @Description  Exports daily sales data (date, order count, revenue, AOV) as CSV.
// @Tags         Admin Analytics
// @Produce      text/csv
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {file} file "CSV file"
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/export [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) ExportAnalytics(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	rows, err := h.analyticsService.ExportSalesData(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to export sales data", err.Error())
		return
	}

	// Set CSV response headers.
	filename := fmt.Sprintf("sales_analytics_%s_to_%s.csv",
		params.StartDate.Format("20060102"),
		params.EndDate.Format("20060102"),
	)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Status(http.StatusOK)

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write CSV header.
	header := []string{"Date", "Order Count", "Revenue", "Average Order Value"}
	if err := writer.Write(header); err != nil {
		return
	}

	// Write data rows.
	for _, row := range rows {
		record := []string{
			row.Date,
			fmt.Sprintf("%d", row.OrderCount),
			row.Revenue.StringFixed(2),
			row.AOV.StringFixed(2),
		}
		if err := writer.Write(record); err != nil {
			return
		}
	}
}

// GetTopProductsByQuantity handles GET /api/v1/admin/analytics/products/top-quantity.
// Returns top products by order quantity for the given date range.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339), limit (default 10), category_id (optional).
// Requirements: 28.1, 28.6
// @Summary      Get top products by quantity
// @Description  Returns top products by order quantity for the given date range.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date  query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date    query string false "End date (YYYY-MM-DD or RFC3339)"
// @Param        limit       query int    false "Number of products to return (default 10)"
// @Param        category_id query int    false "Filter by category ID"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/products/top-quantity [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetTopProductsByQuantity(c *gin.Context) {
	params, err := parseTopProductsParams(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	products, err := h.analyticsService.GetTopProductsByQuantity(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get top products by quantity", err.Error())
		return
	}

	response.Success(c, products)
}

// GetTopProductsByRevenue handles GET /api/v1/admin/analytics/products/top-revenue.
// Returns top products by revenue for the given date range.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339), limit (default 10), category_id (optional).
// Requirements: 28.2, 28.6
// @Summary      Get top products by revenue
// @Description  Returns top products by revenue for the given date range.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date  query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date    query string false "End date (YYYY-MM-DD or RFC3339)"
// @Param        limit       query int    false "Number of products to return (default 10)"
// @Param        category_id query int    false "Filter by category ID"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/products/top-revenue [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetTopProductsByRevenue(c *gin.Context) {
	params, err := parseTopProductsParams(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	products, err := h.analyticsService.GetTopProductsByRevenue(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get top products by revenue", err.Error())
		return
	}

	response.Success(c, products)
}

// GetProductViews handles GET /api/v1/admin/analytics/products/:id/views.
// Returns product view count and conversion rate.
// Requirements: 28.3, 28.4
// @Summary      Get product view statistics
// @Description  Returns product view count and conversion rate for a specific product.
// @Tags         Admin Analytics
// @Produce      json
// @Param        id path int true "Product ID"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/products/{id}/views [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetProductViews(c *gin.Context) {
	idStr := c.Param("id")
	productID, err := parseUint(idStr)
	if err != nil {
		response.BadRequest(c, "invalid product ID")
		return
	}

	stats, err := h.analyticsService.GetProductViewStats(c.Request.Context(), productID)
	if err != nil {
		response.InternalError(c, "failed to get product view stats", err.Error())
		return
	}

	response.Success(c, stats)
}

// GetSKUSales handles GET /api/v1/admin/analytics/skus.
// Returns SKU-level sales data for the given date range.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339), category_id (optional).
// Requirements: 28.5, 28.6
// @Summary      Get SKU sales data
// @Description  Returns SKU-level sales data showing quantity sold and revenue for each SKU.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date  query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date    query string false "End date (YYYY-MM-DD or RFC3339)"
// @Param        category_id query int    false "Filter by category ID"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/skus [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetSKUSales(c *gin.Context) {
	params, err := parseSKUSalesParams(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	skuSales, err := h.analyticsService.GetSKUSalesReport(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get SKU sales report", err.Error())
		return
	}

	response.Success(c, skuSales)
}

// parseTopProductsParams extracts parameters for top products queries.
func parseTopProductsParams(c *gin.Context) (*services.TopProductsParams, error) {
	dateRange, err := parseDateRange(c)
	if err != nil {
		return nil, err
	}

	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err != nil || l <= 0 {
			return nil, fmt.Errorf("invalid limit: %s", limitStr)
		}
		limit = l
	}

	params := &services.TopProductsParams{
		StartDate: dateRange.StartDate,
		EndDate:   dateRange.EndDate,
		Limit:     limit,
	}

	if categoryStr := c.Query("category_id"); categoryStr != "" {
		catID, err := parseUint(categoryStr)
		if err != nil {
			return nil, fmt.Errorf("invalid category_id: %s", categoryStr)
		}
		params.CategoryID = &catID
	}

	return params, nil
}

// parseSKUSalesParams extracts parameters for SKU sales queries.
func parseSKUSalesParams(c *gin.Context) (*services.SKUSalesParams, error) {
	dateRange, err := parseDateRange(c)
	if err != nil {
		return nil, err
	}

	params := &services.SKUSalesParams{
		StartDate: dateRange.StartDate,
		EndDate:   dateRange.EndDate,
	}

	if categoryStr := c.Query("category_id"); categoryStr != "" {
		catID, err := parseUint(categoryStr)
		if err != nil {
			return nil, fmt.Errorf("invalid category_id: %s", categoryStr)
		}
		params.CategoryID = &catID
	}

	return params, nil
}

// parseUint parses a string to uint.
func parseUint(s string) (uint, error) {
	v, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(v), nil
}

// GetConversionFunnel handles GET /api/v1/admin/analytics/funnel.
// Returns conversion funnel data showing event counts and conversion rates between stages.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 29.1, 29.2, 29.6
// @Summary      Get conversion funnel
// @Description  Returns conversion funnel data with event counts and conversion rates between stages.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/funnel [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetConversionFunnel(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	report, err := h.analyticsService.GetConversionFunnel(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get conversion funnel", err.Error())
		return
	}

	response.Success(c, report)
}

// GetCartAbandonment handles GET /api/v1/admin/analytics/cart-abandonment.
// Returns cart abandonment rate data.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 29.3, 29.6
// @Summary      Get cart abandonment rate
// @Description  Returns cart abandonment rate showing total carts, checkout carts, and abandonment percentage.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/cart-abandonment [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetCartAbandonment(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	report, err := h.analyticsService.GetCartAbandonmentRate(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get cart abandonment rate", err.Error())
		return
	}

	response.Success(c, report)
}

// GetPaymentDistribution handles GET /api/v1/admin/analytics/payment-distribution.
// Returns payment method distribution showing percentage of orders by payment method.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 29.4, 29.6
// @Summary      Get payment method distribution
// @Description  Returns payment method distribution showing count and percentage for each method.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/payment-distribution [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetPaymentDistribution(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	distribution, err := h.analyticsService.GetPaymentMethodDistribution(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get payment method distribution", err.Error())
		return
	}

	response.Success(c, distribution)
}

// GetStatusDistribution handles GET /api/v1/admin/analytics/status-distribution.
// Returns order status distribution showing percentage of orders in each status.
// Query params: start_date, end_date (YYYY-MM-DD or RFC3339).
// Defaults to last 30 days if not provided.
// Requirements: 29.5, 29.6
// @Summary      Get order status distribution
// @Description  Returns order status distribution showing count and percentage for each status.
// @Tags         Admin Analytics
// @Produce      json
// @Param        start_date query string false "Start date (YYYY-MM-DD or RFC3339)"
// @Param        end_date   query string false "End date (YYYY-MM-DD or RFC3339)"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/v1/admin/analytics/status-distribution [get]
// @Security     BearerAuth
func (h *AnalyticsHandler) GetStatusDistribution(c *gin.Context) {
	params, err := parseDateRange(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	distribution, err := h.analyticsService.GetOrderStatusDistribution(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "failed to get order status distribution", err.Error())
		return
	}

	response.Success(c, distribution)
}
