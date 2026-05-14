package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// mockAnalyticsService is a minimal AnalyticsService stand-in for handler tests.
type mockAnalyticsService struct {
	getRevenueReportFn              func(context.Context, *services.DateRangeParams) (*services.RevenueReport, error)
	getOrderCountReportFn           func(context.Context, *services.DateRangeParams) (*services.OrderCountReport, error)
	getAverageOrderValueFn          func(context.Context, *services.DateRangeParams) (*services.AOVReport, error)
	exportSalesDataFn               func(context.Context, *services.DateRangeParams) ([]services.SalesExportRow, error)
	getTopProductsByQuantityFn      func(context.Context, *services.TopProductsParams) ([]services.ProductSales, error)
	getTopProductsByRevenueFn       func(context.Context, *services.TopProductsParams) ([]services.ProductSales, error)
	getProductViewStatsFn           func(context.Context, uint) (*services.ViewStats, error)
	getSKUSalesReportFn             func(context.Context, *services.SKUSalesParams) ([]services.SKUSales, error)
	getConversionFunnelFn           func(context.Context, *services.DateRangeParams) (*services.FunnelReport, error)
	getCartAbandonmentRateFn        func(context.Context, *services.DateRangeParams) (*services.AbandonmentReport, error)
	getPaymentMethodDistributionFn  func(context.Context, *services.DateRangeParams) ([]services.MethodDistribution, error)
	getOrderStatusDistributionFn    func(context.Context, *services.DateRangeParams) ([]services.StatusDistribution, error)
	trackEventFn                    func(context.Context, *models.AnalyticsEvent) error
}

func (m *mockAnalyticsService) GetRevenueReport(ctx context.Context, params *services.DateRangeParams) (*services.RevenueReport, error) {
	if m.getRevenueReportFn != nil {
		return m.getRevenueReportFn(ctx, params)
	}
	return &services.RevenueReport{}, nil
}

func (m *mockAnalyticsService) GetOrderCountReport(ctx context.Context, params *services.DateRangeParams) (*services.OrderCountReport, error) {
	if m.getOrderCountReportFn != nil {
		return m.getOrderCountReportFn(ctx, params)
	}
	return &services.OrderCountReport{}, nil
}

func (m *mockAnalyticsService) GetAverageOrderValue(ctx context.Context, params *services.DateRangeParams) (*services.AOVReport, error) {
	if m.getAverageOrderValueFn != nil {
		return m.getAverageOrderValueFn(ctx, params)
	}
	return &services.AOVReport{}, nil
}

func (m *mockAnalyticsService) ExportSalesData(ctx context.Context, params *services.DateRangeParams) ([]services.SalesExportRow, error) {
	if m.exportSalesDataFn != nil {
		return m.exportSalesDataFn(ctx, params)
	}
	return []services.SalesExportRow{}, nil
}

func (m *mockAnalyticsService) GetTopProductsByQuantity(ctx context.Context, params *services.TopProductsParams) ([]services.ProductSales, error) {
	if m.getTopProductsByQuantityFn != nil {
		return m.getTopProductsByQuantityFn(ctx, params)
	}
	return []services.ProductSales{}, nil
}

func (m *mockAnalyticsService) GetTopProductsByRevenue(ctx context.Context, params *services.TopProductsParams) ([]services.ProductSales, error) {
	if m.getTopProductsByRevenueFn != nil {
		return m.getTopProductsByRevenueFn(ctx, params)
	}
	return []services.ProductSales{}, nil
}

func (m *mockAnalyticsService) GetProductViewStats(ctx context.Context, productID uint) (*services.ViewStats, error) {
	if m.getProductViewStatsFn != nil {
		return m.getProductViewStatsFn(ctx, productID)
	}
	return &services.ViewStats{}, nil
}

func (m *mockAnalyticsService) GetSKUSalesReport(ctx context.Context, params *services.SKUSalesParams) ([]services.SKUSales, error) {
	if m.getSKUSalesReportFn != nil {
		return m.getSKUSalesReportFn(ctx, params)
	}
	return []services.SKUSales{}, nil
}

func (m *mockAnalyticsService) GetConversionFunnel(ctx context.Context, params *services.DateRangeParams) (*services.FunnelReport, error) {
	if m.getConversionFunnelFn != nil {
		return m.getConversionFunnelFn(ctx, params)
	}
	return &services.FunnelReport{ConversionRates: map[string]float64{}}, nil
}

func (m *mockAnalyticsService) GetCartAbandonmentRate(ctx context.Context, params *services.DateRangeParams) (*services.AbandonmentReport, error) {
	if m.getCartAbandonmentRateFn != nil {
		return m.getCartAbandonmentRateFn(ctx, params)
	}
	return &services.AbandonmentReport{}, nil
}

func (m *mockAnalyticsService) GetPaymentMethodDistribution(ctx context.Context, params *services.DateRangeParams) ([]services.MethodDistribution, error) {
	if m.getPaymentMethodDistributionFn != nil {
		return m.getPaymentMethodDistributionFn(ctx, params)
	}
	return []services.MethodDistribution{}, nil
}

func (m *mockAnalyticsService) GetOrderStatusDistribution(ctx context.Context, params *services.DateRangeParams) ([]services.StatusDistribution, error) {
	if m.getOrderStatusDistributionFn != nil {
		return m.getOrderStatusDistributionFn(ctx, params)
	}
	return []services.StatusDistribution{}, nil
}

func (m *mockAnalyticsService) TrackEvent(ctx context.Context, event *models.AnalyticsEvent) error {
	if m.trackEventFn != nil {
		return m.trackEventFn(ctx, event)
	}
	return nil
}

// newAnalyticsTestRouter sets up a gin engine with the response middleware
// and returns an AnalyticsHandler backed by the mock service.
func newAnalyticsTestRouter() (*gin.Engine, *AnalyticsHandler, *mockAnalyticsService) {
	router := gin.New()
	router.Use(response.Middleware())
	svc := &mockAnalyticsService{}
	h := NewAnalyticsHandler(svc)
	return router, h, svc
}

// decodeAnalyticsResponse decodes a JSON response body.
func decodeAnalyticsResponse(t *testing.T, body *bytes.Buffer) parsedResponse {
	t.Helper()
	var r parsedResponse
	if err := json.Unmarshal(body.Bytes(), &r); err != nil {
		t.Fatalf("failed to decode response: %v - body: %s", err, body.String())
	}
	return r
}

// --- GetRevenue ---

func TestAnalyticsHandler_GetRevenue_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/revenue", h.GetRevenue)

	svc.getRevenueReportFn = func(_ context.Context, params *services.DateRangeParams) (*services.RevenueReport, error) {
		return &services.RevenueReport{
			TotalRevenue: decimal.NewFromInt(5000),
			DailyData: []services.DailyRevenue{
				{Date: "2024-01-01", Revenue: decimal.NewFromInt(2000)},
				{Date: "2024-01-02", Revenue: decimal.NewFromInt(3000)},
			},
			StartDate: "2024-01-01",
			EndDate:   "2024-01-02",
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/revenue?start_date=2024-01-01&end_date=2024-01-02", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	// Verify data contains total_revenue
	if !strings.Contains(string(got.Data), "5000") {
		t.Fatalf("expected total_revenue=5000 in response, got: %s", string(got.Data))
	}
}

func TestAnalyticsHandler_GetRevenue_DefaultDateRange(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/revenue", h.GetRevenue)

	var calledParams *services.DateRangeParams
	svc.getRevenueReportFn = func(_ context.Context, params *services.DateRangeParams) (*services.RevenueReport, error) {
		calledParams = params
		return &services.RevenueReport{
			TotalRevenue: decimal.Zero,
			DailyData:    []services.DailyRevenue{},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/revenue", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if calledParams == nil {
		t.Fatal("expected service to be called")
	}
	// Default should be last 30 days
	if calledParams.StartDate.IsZero() || calledParams.EndDate.IsZero() {
		t.Fatal("expected non-zero date range")
	}
}

func TestAnalyticsHandler_GetRevenue_InvalidStartDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/revenue", h.GetRevenue)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/revenue?start_date=invalid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetRevenue_EndBeforeStart(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/revenue", h.GetRevenue)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/revenue?start_date=2024-01-10&end_date=2024-01-01", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetRevenue_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/revenue", h.GetRevenue)

	svc.getRevenueReportFn = func(_ context.Context, _ *services.DateRangeParams) (*services.RevenueReport, error) {
		return nil, errors.New("database error")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/revenue?start_date=2024-01-01&end_date=2024-01-02", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetOrderStats ---

func TestAnalyticsHandler_GetOrderStats_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/orders", h.GetOrderStats)

	svc.getOrderCountReportFn = func(_ context.Context, _ *services.DateRangeParams) (*services.OrderCountReport, error) {
		return &services.OrderCountReport{
			TotalOrders: 42,
			DailyData: []services.DailyOrderCount{
				{Date: "2024-01-01", Count: 20},
				{Date: "2024-01-02", Count: 22},
			},
			StartDate: "2024-01-01",
			EndDate:   "2024-01-02",
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/orders?start_date=2024-01-01&end_date=2024-01-02", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if !strings.Contains(string(got.Data), "42") {
		t.Fatalf("expected total_orders=42 in response, got: %s", string(got.Data))
	}
}

func TestAnalyticsHandler_GetOrderStats_InvalidDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/orders", h.GetOrderStats)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/orders?end_date=not-a-date", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetAOV ---

func TestAnalyticsHandler_GetAOV_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/aov", h.GetAOV)

	svc.getAverageOrderValueFn = func(_ context.Context, _ *services.DateRangeParams) (*services.AOVReport, error) {
		return &services.AOVReport{
			AverageOrderValue: decimal.NewFromFloat(125.50),
			TotalRevenue:      decimal.NewFromInt(5020),
			TotalOrders:       40,
			StartDate:         "2024-01-01",
			EndDate:           "2024-01-31",
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/aov?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if !strings.Contains(string(got.Data), "125.5") {
		t.Fatalf("expected average_order_value in response, got: %s", string(got.Data))
	}
}

func TestAnalyticsHandler_GetAOV_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/aov", h.GetAOV)

	svc.getAverageOrderValueFn = func(_ context.Context, _ *services.DateRangeParams) (*services.AOVReport, error) {
		return nil, errors.New("db timeout")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/aov?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- ExportAnalytics ---

func TestAnalyticsHandler_ExportAnalytics_CSV(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/export", h.ExportAnalytics)

	svc.exportSalesDataFn = func(_ context.Context, _ *services.DateRangeParams) ([]services.SalesExportRow, error) {
		return []services.SalesExportRow{
			{Date: "2024-01-01", OrderCount: 10, Revenue: decimal.NewFromInt(1000), AOV: decimal.NewFromInt(100)},
			{Date: "2024-01-02", OrderCount: 15, Revenue: decimal.NewFromInt(2250), AOV: decimal.NewFromInt(150)},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/export?start_date=2024-01-01&end_date=2024-01-02", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/csv") {
		t.Fatalf("expected Content-Type text/csv, got %q", contentType)
	}

	disposition := w.Header().Get("Content-Disposition")
	if !strings.Contains(disposition, "attachment") {
		t.Fatalf("expected Content-Disposition attachment, got %q", disposition)
	}

	body := w.Body.String()
	if !strings.Contains(body, "Date") {
		t.Fatalf("expected CSV header row, got: %s", body)
	}
	if !strings.Contains(body, "2024-01-01") {
		t.Fatalf("expected date in CSV, got: %s", body)
	}
	if !strings.Contains(body, "1000.00") {
		t.Fatalf("expected revenue in CSV, got: %s", body)
	}
	if !strings.Contains(body, "150.00") {
		t.Fatalf("expected AOV in CSV, got: %s", body)
	}
}

func TestAnalyticsHandler_ExportAnalytics_InvalidDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/export", h.ExportAnalytics)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/export?start_date=bad-date", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_ExportAnalytics_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/export", h.ExportAnalytics)

	svc.exportSalesDataFn = func(_ context.Context, _ *services.DateRangeParams) ([]services.SalesExportRow, error) {
		return nil, errors.New("export failed")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/export?start_date=2024-01-01&end_date=2024-01-02", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- parseDateRange helper tests ---

func TestParseDateRange_RFC3339Format(t *testing.T) {
	router := gin.New()
	router.Use(response.Middleware())
	router.GET("/test", func(c *gin.Context) {
		params, err := parseDateRange(c)
		if err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		response.Success(c, gin.H{
			"start": params.StartDate.Format("2006-01-02"),
			"end":   params.EndDate.Format("2006-01-02"),
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/test?start_date=2024-03-15T10:30:00Z&end_date=2024-03-20T18:00:00Z", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "2024-03-15") || !strings.Contains(body, "2024-03-20") {
		t.Fatalf("expected parsed dates in response, got: %s", body)
	}
}

// --- GetTopProductsByQuantity ---

func TestAnalyticsHandler_GetTopProductsByQuantity_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-quantity", h.GetTopProductsByQuantity)

	svc.getTopProductsByQuantityFn = func(_ context.Context, params *services.TopProductsParams) ([]services.ProductSales, error) {
		if params.Limit != 10 {
			t.Errorf("expected default limit 10, got %d", params.Limit)
		}
		return []services.ProductSales{
			{ProductID: 1, ProductName: "iPhone 15", Quantity: 100, Revenue: decimal.NewFromInt(99900)},
			{ProductID: 2, ProductName: "MacBook Pro", Quantity: 50, Revenue: decimal.NewFromInt(124950)},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-quantity?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if !strings.Contains(string(got.Data), "iPhone 15") {
		t.Fatalf("expected product name in response, got: %s", string(got.Data))
	}
	if !strings.Contains(string(got.Data), "100") {
		t.Fatalf("expected quantity in response, got: %s", string(got.Data))
	}
}

func TestAnalyticsHandler_GetTopProductsByQuantity_CustomLimit(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-quantity", h.GetTopProductsByQuantity)

	var calledLimit int
	svc.getTopProductsByQuantityFn = func(_ context.Context, params *services.TopProductsParams) ([]services.ProductSales, error) {
		calledLimit = params.Limit
		return []services.ProductSales{}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-quantity?limit=5", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if calledLimit != 5 {
		t.Fatalf("expected limit=5, got %d", calledLimit)
	}
}

func TestAnalyticsHandler_GetTopProductsByQuantity_InvalidLimit(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-quantity", h.GetTopProductsByQuantity)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-quantity?limit=abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetTopProductsByQuantity_WithCategoryFilter(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-quantity", h.GetTopProductsByQuantity)

	var calledCategoryID *uint
	svc.getTopProductsByQuantityFn = func(_ context.Context, params *services.TopProductsParams) ([]services.ProductSales, error) {
		calledCategoryID = params.CategoryID
		return []services.ProductSales{}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-quantity?category_id=3", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if calledCategoryID == nil || *calledCategoryID != 3 {
		t.Fatalf("expected category_id=3, got %v", calledCategoryID)
	}
}

func TestAnalyticsHandler_GetTopProductsByQuantity_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-quantity", h.GetTopProductsByQuantity)

	svc.getTopProductsByQuantityFn = func(_ context.Context, _ *services.TopProductsParams) ([]services.ProductSales, error) {
		return nil, errors.New("database error")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-quantity?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetTopProductsByRevenue ---

func TestAnalyticsHandler_GetTopProductsByRevenue_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-revenue", h.GetTopProductsByRevenue)

	svc.getTopProductsByRevenueFn = func(_ context.Context, params *services.TopProductsParams) ([]services.ProductSales, error) {
		return []services.ProductSales{
			{ProductID: 2, ProductName: "MacBook Pro", Quantity: 50, Revenue: decimal.NewFromInt(124950)},
			{ProductID: 1, ProductName: "iPhone 15", Quantity: 100, Revenue: decimal.NewFromInt(99900)},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-revenue?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if !strings.Contains(string(got.Data), "MacBook Pro") {
		t.Fatalf("expected product name in response, got: %s", string(got.Data))
	}
	if !strings.Contains(string(got.Data), "124950") {
		t.Fatalf("expected revenue in response, got: %s", string(got.Data))
	}
}

func TestAnalyticsHandler_GetTopProductsByRevenue_InvalidDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-revenue", h.GetTopProductsByRevenue)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-revenue?start_date=bad", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetTopProductsByRevenue_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/top-revenue", h.GetTopProductsByRevenue)

	svc.getTopProductsByRevenueFn = func(_ context.Context, _ *services.TopProductsParams) ([]services.ProductSales, error) {
		return nil, errors.New("db error")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/top-revenue?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetProductViews ---

func TestAnalyticsHandler_GetProductViews_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/:id/views", h.GetProductViews)

	svc.getProductViewStatsFn = func(_ context.Context, productID uint) (*services.ViewStats, error) {
		if productID != 42 {
			t.Errorf("expected productID=42, got %d", productID)
		}
		return &services.ViewStats{
			ProductID:      42,
			ViewCount:      500,
			OrderCount:     25,
			ConversionRate: 5.0,
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/42/views", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if !strings.Contains(string(got.Data), "500") {
		t.Fatalf("expected view_count=500 in response, got: %s", string(got.Data))
	}
	if !strings.Contains(string(got.Data), "5") {
		t.Fatalf("expected conversion_rate in response, got: %s", string(got.Data))
	}
}

func TestAnalyticsHandler_GetProductViews_InvalidID(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/:id/views", h.GetProductViews)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/abc/views", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetProductViews_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/products/:id/views", h.GetProductViews)

	svc.getProductViewStatsFn = func(_ context.Context, _ uint) (*services.ViewStats, error) {
		return nil, errors.New("not found")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/products/1/views", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetSKUSales ---

func TestAnalyticsHandler_GetSKUSales_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/skus", h.GetSKUSales)

	svc.getSKUSalesReportFn = func(_ context.Context, params *services.SKUSalesParams) ([]services.SKUSales, error) {
		return []services.SKUSales{
			{SKUID: 1, SKUCode: "IP15-BLK-128", ProductID: 1, ProductName: "iPhone 15", Quantity: 60, Revenue: decimal.NewFromInt(59940)},
			{SKUID: 2, SKUCode: "IP15-WHT-256", ProductID: 1, ProductName: "iPhone 15", Quantity: 40, Revenue: decimal.NewFromInt(43960)},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/skus?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	if !strings.Contains(string(got.Data), "IP15-BLK-128") {
		t.Fatalf("expected SKU code in response, got: %s", string(got.Data))
	}
	if !strings.Contains(string(got.Data), "59940") {
		t.Fatalf("expected revenue in response, got: %s", string(got.Data))
	}
}

func TestAnalyticsHandler_GetSKUSales_WithCategoryFilter(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/skus", h.GetSKUSales)

	var calledCategoryID *uint
	svc.getSKUSalesReportFn = func(_ context.Context, params *services.SKUSalesParams) ([]services.SKUSales, error) {
		calledCategoryID = params.CategoryID
		return []services.SKUSales{}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/skus?category_id=7", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if calledCategoryID == nil || *calledCategoryID != 7 {
		t.Fatalf("expected category_id=7, got %v", calledCategoryID)
	}
}

func TestAnalyticsHandler_GetSKUSales_InvalidCategoryID(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/skus", h.GetSKUSales)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/skus?category_id=xyz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetSKUSales_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/skus", h.GetSKUSales)

	svc.getSKUSalesReportFn = func(_ context.Context, _ *services.SKUSalesParams) ([]services.SKUSales, error) {
		return nil, errors.New("query failed")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/skus?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetConversionFunnel ---

func TestAnalyticsHandler_GetConversionFunnel_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/funnel", h.GetConversionFunnel)

	svc.getConversionFunnelFn = func(_ context.Context, params *services.DateRangeParams) (*services.FunnelReport, error) {
		return &services.FunnelReport{
			HomepageViews:   1000,
			ProductViews:    500,
			AddToCartEvents: 200,
			CheckoutStarts:  100,
			OrdersCompleted: 50,
			ConversionRates: map[string]float64{
				"homepage_to_product": 50.0,
				"product_to_cart":     40.0,
				"cart_to_checkout":    50.0,
				"checkout_to_order":   50.0,
				"overall":            5.0,
			},
			StartDate: "2024-01-01",
			EndDate:   "2024-01-31",
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/funnel?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	data := string(got.Data)
	if !strings.Contains(data, "1000") {
		t.Fatalf("expected homepage_views=1000 in response, got: %s", data)
	}
	if !strings.Contains(data, "homepage_to_product") {
		t.Fatalf("expected conversion_rates in response, got: %s", data)
	}
}

func TestAnalyticsHandler_GetConversionFunnel_InvalidDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/funnel", h.GetConversionFunnel)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/funnel?start_date=bad-date", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetConversionFunnel_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/funnel", h.GetConversionFunnel)

	svc.getConversionFunnelFn = func(_ context.Context, _ *services.DateRangeParams) (*services.FunnelReport, error) {
		return nil, errors.New("database error")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/funnel?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetCartAbandonment ---

func TestAnalyticsHandler_GetCartAbandonment_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/cart-abandonment", h.GetCartAbandonment)

	svc.getCartAbandonmentRateFn = func(_ context.Context, params *services.DateRangeParams) (*services.AbandonmentReport, error) {
		return &services.AbandonmentReport{
			TotalCarts:      200,
			CheckoutCarts:   80,
			AbandonedCarts:  120,
			AbandonmentRate: 60.0,
			StartDate:       "2024-01-01",
			EndDate:         "2024-01-31",
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/cart-abandonment?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	data := string(got.Data)
	if !strings.Contains(data, "200") {
		t.Fatalf("expected total_carts=200 in response, got: %s", data)
	}
	if !strings.Contains(data, "60") {
		t.Fatalf("expected abandonment_rate=60 in response, got: %s", data)
	}
}

func TestAnalyticsHandler_GetCartAbandonment_InvalidDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/cart-abandonment", h.GetCartAbandonment)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/cart-abandonment?end_date=invalid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetCartAbandonment_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/cart-abandonment", h.GetCartAbandonment)

	svc.getCartAbandonmentRateFn = func(_ context.Context, _ *services.DateRangeParams) (*services.AbandonmentReport, error) {
		return nil, errors.New("query failed")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/cart-abandonment?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetPaymentDistribution ---

func TestAnalyticsHandler_GetPaymentDistribution_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/payment-distribution", h.GetPaymentDistribution)

	svc.getPaymentMethodDistributionFn = func(_ context.Context, params *services.DateRangeParams) ([]services.MethodDistribution, error) {
		return []services.MethodDistribution{
			{Method: "online", Count: 70, Percentage: 70.0},
			{Method: "transfer", Count: 30, Percentage: 30.0},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/payment-distribution?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	data := string(got.Data)
	if !strings.Contains(data, "online") {
		t.Fatalf("expected 'online' method in response, got: %s", data)
	}
	if !strings.Contains(data, "transfer") {
		t.Fatalf("expected 'transfer' method in response, got: %s", data)
	}
	if !strings.Contains(data, "70") {
		t.Fatalf("expected percentage=70 in response, got: %s", data)
	}
}

func TestAnalyticsHandler_GetPaymentDistribution_InvalidDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/payment-distribution", h.GetPaymentDistribution)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/payment-distribution?start_date=xyz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetPaymentDistribution_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/payment-distribution", h.GetPaymentDistribution)

	svc.getPaymentMethodDistributionFn = func(_ context.Context, _ *services.DateRangeParams) ([]services.MethodDistribution, error) {
		return nil, errors.New("db error")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/payment-distribution?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetStatusDistribution ---

func TestAnalyticsHandler_GetStatusDistribution_Success(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/status-distribution", h.GetStatusDistribution)

	svc.getOrderStatusDistributionFn = func(_ context.Context, params *services.DateRangeParams) ([]services.StatusDistribution, error) {
		return []services.StatusDistribution{
			{Status: "paid", Count: 40, Percentage: 40.0},
			{Status: "pending_payment", Count: 30, Percentage: 30.0},
			{Status: "shipped", Count: 20, Percentage: 20.0},
			{Status: "cancelled", Count: 10, Percentage: 10.0},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/status-distribution?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeAnalyticsResponse(t, w.Body)
	if !got.Success {
		t.Fatalf("expected success=true")
	}
	data := string(got.Data)
	if !strings.Contains(data, "paid") {
		t.Fatalf("expected 'paid' status in response, got: %s", data)
	}
	if !strings.Contains(data, "pending_payment") {
		t.Fatalf("expected 'pending_payment' status in response, got: %s", data)
	}
	if !strings.Contains(data, "40") {
		t.Fatalf("expected percentage=40 in response, got: %s", data)
	}
}

func TestAnalyticsHandler_GetStatusDistribution_InvalidDate(t *testing.T) {
	router, h, _ := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/status-distribution", h.GetStatusDistribution)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/status-distribution?start_date=2024-13-01", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAnalyticsHandler_GetStatusDistribution_ServiceError(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/status-distribution", h.GetStatusDistribution)

	svc.getOrderStatusDistributionFn = func(_ context.Context, _ *services.DateRangeParams) ([]services.StatusDistribution, error) {
		return nil, errors.New("timeout")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/status-distribution?start_date=2024-01-01&end_date=2024-01-31", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GetConversionFunnel default date range ---

func TestAnalyticsHandler_GetConversionFunnel_DefaultDateRange(t *testing.T) {
	router, h, svc := newAnalyticsTestRouter()
	router.GET("/api/v1/admin/analytics/funnel", h.GetConversionFunnel)

	var calledParams *services.DateRangeParams
	svc.getConversionFunnelFn = func(_ context.Context, params *services.DateRangeParams) (*services.FunnelReport, error) {
		calledParams = params
		return &services.FunnelReport{ConversionRates: map[string]float64{}}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/funnel", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if calledParams == nil {
		t.Fatal("expected service to be called")
	}
	if calledParams.StartDate.IsZero() || calledParams.EndDate.IsZero() {
		t.Fatal("expected non-zero date range")
	}
}
