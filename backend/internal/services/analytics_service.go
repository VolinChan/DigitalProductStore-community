package services

import (
	"context"
	"fmt"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// DateRangeParams holds the start and end dates for analytics queries.
type DateRangeParams struct {
	StartDate time.Time
	EndDate   time.Time
}

// TopProductsParams holds parameters for top products queries.
type TopProductsParams struct {
	StartDate  time.Time
	EndDate    time.Time
	Limit      int
	CategoryID *uint
}

// SKUSalesParams holds parameters for SKU sales queries.
type SKUSalesParams struct {
	StartDate  time.Time
	EndDate    time.Time
	CategoryID *uint
}

// ProductSales represents sales data for a single product.
type ProductSales struct {
	ProductID   uint            `json:"product_id"`
	ProductName string          `json:"product_name"`
	Quantity    int64           `json:"quantity"`
	Revenue     decimal.Decimal `json:"revenue"`
}

// ViewStats represents view statistics for a product.
type ViewStats struct {
	ProductID      uint    `json:"product_id"`
	ViewCount      int64   `json:"view_count"`
	OrderCount     int64   `json:"order_count"`
	ConversionRate float64 `json:"conversion_rate"`
}

// SKUSales represents sales data for a single SKU.
type SKUSales struct {
	SKUID       uint            `json:"sku_id"`
	SKUCode     string          `json:"sku_code"`
	ProductID   uint            `json:"product_id"`
	ProductName string          `json:"product_name"`
	Quantity    int64           `json:"quantity"`
	Revenue     decimal.Decimal `json:"revenue"`
}

// DailyRevenue represents revenue for a single day.
type DailyRevenue struct {
	Date    string          `json:"date"`
	Revenue decimal.Decimal `json:"revenue"`
}

// RevenueReport holds total revenue and daily breakdown.
type RevenueReport struct {
	TotalRevenue decimal.Decimal `json:"total_revenue"`
	DailyData    []DailyRevenue  `json:"daily_data"`
	StartDate    string          `json:"start_date"`
	EndDate      string          `json:"end_date"`
}

// DailyOrderCount represents order count for a single day.
type DailyOrderCount struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// OrderCountReport holds total order count and daily breakdown.
type OrderCountReport struct {
	TotalOrders int64             `json:"total_orders"`
	DailyData   []DailyOrderCount `json:"daily_data"`
	StartDate   string            `json:"start_date"`
	EndDate     string            `json:"end_date"`
}

// AOVReport holds the average order value.
type AOVReport struct {
	AverageOrderValue decimal.Decimal `json:"average_order_value"`
	TotalRevenue      decimal.Decimal `json:"total_revenue"`
	TotalOrders       int64           `json:"total_orders"`
	StartDate         string          `json:"start_date"`
	EndDate           string          `json:"end_date"`
}

// SalesExportRow represents a single row in the sales CSV export.
type SalesExportRow struct {
	Date         string          `json:"date"`
	OrderCount   int64           `json:"order_count"`
	Revenue      decimal.Decimal `json:"revenue"`
	AOV          decimal.Decimal `json:"aov"`
}

// FunnelReport holds conversion funnel data (Req 29.1-29.2).
type FunnelReport struct {
	HomepageViews   int64              `json:"homepage_views"`
	ProductViews    int64              `json:"product_views"`
	AddToCartEvents int64              `json:"add_to_cart_events"`
	CheckoutStarts  int64              `json:"checkout_starts"`
	OrdersCompleted int64              `json:"orders_completed"`
	ConversionRates map[string]float64 `json:"conversion_rates"`
	StartDate       string             `json:"start_date"`
	EndDate         string             `json:"end_date"`
}

// AbandonmentReport holds cart abandonment rate data (Req 29.3).
type AbandonmentReport struct {
	TotalCarts      int64   `json:"total_carts"`
	CheckoutCarts   int64   `json:"checkout_carts"`
	AbandonedCarts  int64   `json:"abandoned_carts"`
	AbandonmentRate float64 `json:"abandonment_rate"`
	StartDate       string  `json:"start_date"`
	EndDate         string  `json:"end_date"`
}

// MethodDistribution holds payment method distribution data (Req 29.4).
type MethodDistribution struct {
	Method     string  `json:"method"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// StatusDistribution holds order status distribution data (Req 29.5).
type StatusDistribution struct {
	Status     string  `json:"status"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// AnalyticsService defines the interface for sales analytics operations.
type AnalyticsService interface {
	// GetRevenueReport returns total revenue and daily breakdown for the given date range.
	GetRevenueReport(ctx context.Context, params *DateRangeParams) (*RevenueReport, error)

	// GetOrderCountReport returns total order count and daily breakdown for the given date range.
	GetOrderCountReport(ctx context.Context, params *DateRangeParams) (*OrderCountReport, error)

	// GetAverageOrderValue returns the average order value for the given date range.
	GetAverageOrderValue(ctx context.Context, params *DateRangeParams) (*AOVReport, error)

	// ExportSalesData returns daily sales data for CSV export.
	ExportSalesData(ctx context.Context, params *DateRangeParams) ([]SalesExportRow, error)

	// GetTopProductsByQuantity returns top products by order quantity (Req 28.1).
	GetTopProductsByQuantity(ctx context.Context, params *TopProductsParams) ([]ProductSales, error)

	// GetTopProductsByRevenue returns top products by revenue (Req 28.2).
	GetTopProductsByRevenue(ctx context.Context, params *TopProductsParams) ([]ProductSales, error)

	// GetProductViewStats returns product view count and conversion rate (Req 28.3-28.4).
	GetProductViewStats(ctx context.Context, productID uint) (*ViewStats, error)

	// GetSKUSalesReport returns SKU-level sales data (Req 28.5).
	GetSKUSalesReport(ctx context.Context, params *SKUSalesParams) ([]SKUSales, error)

	// GetConversionFunnel returns conversion funnel data (Req 29.1-29.2).
	GetConversionFunnel(ctx context.Context, params *DateRangeParams) (*FunnelReport, error)

	// GetCartAbandonmentRate returns cart abandonment rate (Req 29.3).
	GetCartAbandonmentRate(ctx context.Context, params *DateRangeParams) (*AbandonmentReport, error)

	// GetPaymentMethodDistribution returns payment method distribution (Req 29.4).
	GetPaymentMethodDistribution(ctx context.Context, params *DateRangeParams) ([]MethodDistribution, error)

	// GetOrderStatusDistribution returns order status distribution (Req 29.5).
	GetOrderStatusDistribution(ctx context.Context, params *DateRangeParams) ([]StatusDistribution, error)
}

// analyticsService implements AnalyticsService using GORM.
type analyticsService struct {
	db        *gorm.DB
	eventRepo repositories.AnalyticsEventRepository
}

// NewAnalyticsService creates a new analytics service.
func NewAnalyticsService(db *gorm.DB, eventRepo repositories.AnalyticsEventRepository) AnalyticsService {
	return &analyticsService{db: db, eventRepo: eventRepo}
}

// paidStatuses are the order statuses that count as "revenue-generating".
// We include paid, pending_shipment, shipped, and completed orders.
var paidStatuses = []models.OrderStatus{
	models.OrderStatusPaid,
	models.OrderStatusPendingShipment,
	models.OrderStatusShipped,
	models.OrderStatusCompleted,
}

// GetRevenueReport returns total revenue and daily breakdown (Req 27.1, 27.4).
func (s *analyticsService) GetRevenueReport(ctx context.Context, params *DateRangeParams) (*RevenueReport, error) {
	type dailyResult struct {
		Date    string          `gorm:"column:date"`
		Revenue decimal.Decimal `gorm:"column:revenue"`
	}

	var results []dailyResult
	err := s.db.WithContext(ctx).
		Model(&models.Order{}).
		Select("DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue").
		Where("created_at >= ? AND created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("status IN ?", paidStatuses).
		Group("DATE(created_at)").
		Order("date ASC").
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue report: %w", err)
	}

	totalRevenue := decimal.Zero
	dailyData := make([]DailyRevenue, 0, len(results))
	for _, r := range results {
		totalRevenue = totalRevenue.Add(r.Revenue)
		dailyData = append(dailyData, DailyRevenue{
			Date:    r.Date,
			Revenue: r.Revenue,
		})
	}

	return &RevenueReport{
		TotalRevenue: totalRevenue,
		DailyData:    dailyData,
		StartDate:    params.StartDate.Format("2006-01-02"),
		EndDate:      params.EndDate.Format("2006-01-02"),
	}, nil
}

// GetOrderCountReport returns total order count and daily breakdown (Req 27.2, 27.5).
func (s *analyticsService) GetOrderCountReport(ctx context.Context, params *DateRangeParams) (*OrderCountReport, error) {
	type dailyResult struct {
		Date  string `gorm:"column:date"`
		Count int64  `gorm:"column:count"`
	}

	var results []dailyResult
	err := s.db.WithContext(ctx).
		Model(&models.Order{}).
		Select("DATE(created_at) as date, COUNT(*) as count").
		Where("created_at >= ? AND created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("status IN ?", paidStatuses).
		Group("DATE(created_at)").
		Order("date ASC").
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get order count report: %w", err)
	}

	var totalOrders int64
	dailyData := make([]DailyOrderCount, 0, len(results))
	for _, r := range results {
		totalOrders += r.Count
		dailyData = append(dailyData, DailyOrderCount{
			Date:  r.Date,
			Count: r.Count,
		})
	}

	return &OrderCountReport{
		TotalOrders: totalOrders,
		DailyData:   dailyData,
		StartDate:   params.StartDate.Format("2006-01-02"),
		EndDate:     params.EndDate.Format("2006-01-02"),
	}, nil
}

// GetAverageOrderValue returns the average order value (Req 27.3).
func (s *analyticsService) GetAverageOrderValue(ctx context.Context, params *DateRangeParams) (*AOVReport, error) {
	type result struct {
		TotalRevenue decimal.Decimal `gorm:"column:total_revenue"`
		TotalOrders  int64           `gorm:"column:total_orders"`
	}

	var r result
	err := s.db.WithContext(ctx).
		Model(&models.Order{}).
		Select("COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders").
		Where("created_at >= ? AND created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("status IN ?", paidStatuses).
		Find(&r).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get average order value: %w", err)
	}

	aov := decimal.Zero
	if r.TotalOrders > 0 {
		aov = r.TotalRevenue.Div(decimal.NewFromInt(r.TotalOrders))
	}

	return &AOVReport{
		AverageOrderValue: aov,
		TotalRevenue:      r.TotalRevenue,
		TotalOrders:       r.TotalOrders,
		StartDate:         params.StartDate.Format("2006-01-02"),
		EndDate:           params.EndDate.Format("2006-01-02"),
	}, nil
}

// ExportSalesData returns daily sales data for CSV export (Req 27.7).
func (s *analyticsService) ExportSalesData(ctx context.Context, params *DateRangeParams) ([]SalesExportRow, error) {
	type dailyResult struct {
		Date    string          `gorm:"column:date"`
		Count   int64           `gorm:"column:count"`
		Revenue decimal.Decimal `gorm:"column:revenue"`
	}

	var results []dailyResult
	err := s.db.WithContext(ctx).
		Model(&models.Order{}).
		Select("DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue").
		Where("created_at >= ? AND created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("status IN ?", paidStatuses).
		Group("DATE(created_at)").
		Order("date ASC").
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to export sales data: %w", err)
	}

	rows := make([]SalesExportRow, 0, len(results))
	for _, r := range results {
		aov := decimal.Zero
		if r.Count > 0 {
			aov = r.Revenue.Div(decimal.NewFromInt(r.Count))
		}
		rows = append(rows, SalesExportRow{
			Date:       r.Date,
			OrderCount: r.Count,
			Revenue:    r.Revenue,
			AOV:        aov,
		})
	}

	return rows, nil
}

// GetTopProductsByQuantity returns top products by order quantity (Req 28.1).
func (s *analyticsService) GetTopProductsByQuantity(ctx context.Context, params *TopProductsParams) ([]ProductSales, error) {
	type result struct {
		ProductID   uint            `gorm:"column:product_id"`
		ProductName string          `gorm:"column:product_name"`
		Quantity    int64           `gorm:"column:quantity"`
		Revenue     decimal.Decimal `gorm:"column:revenue"`
	}

	query := s.db.WithContext(ctx).
		Table("order_items").
		Select("skus.product_id as product_id, products.name as product_name, SUM(order_items.quantity) as quantity, SUM(order_items.subtotal) as revenue").
		Joins("JOIN skus ON skus.id = order_items.sku_id").
		Joins("JOIN products ON products.id = skus.product_id").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("orders.created_at >= ? AND orders.created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("orders.status IN ?", paidStatuses)

	if params.CategoryID != nil {
		query = query.Where("products.category_id = ?", *params.CategoryID)
	}

	var results []result
	err := query.
		Group("skus.product_id, products.name").
		Order("quantity DESC").
		Limit(params.Limit).
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get top products by quantity: %w", err)
	}

	products := make([]ProductSales, 0, len(results))
	for _, r := range results {
		products = append(products, ProductSales{
			ProductID:   r.ProductID,
			ProductName: r.ProductName,
			Quantity:    r.Quantity,
			Revenue:     r.Revenue,
		})
	}

	return products, nil
}

// GetTopProductsByRevenue returns top products by revenue (Req 28.2).
func (s *analyticsService) GetTopProductsByRevenue(ctx context.Context, params *TopProductsParams) ([]ProductSales, error) {
	type result struct {
		ProductID   uint            `gorm:"column:product_id"`
		ProductName string          `gorm:"column:product_name"`
		Quantity    int64           `gorm:"column:quantity"`
		Revenue     decimal.Decimal `gorm:"column:revenue"`
	}

	query := s.db.WithContext(ctx).
		Table("order_items").
		Select("skus.product_id as product_id, products.name as product_name, SUM(order_items.quantity) as quantity, SUM(order_items.subtotal) as revenue").
		Joins("JOIN skus ON skus.id = order_items.sku_id").
		Joins("JOIN products ON products.id = skus.product_id").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("orders.created_at >= ? AND orders.created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("orders.status IN ?", paidStatuses)

	if params.CategoryID != nil {
		query = query.Where("products.category_id = ?", *params.CategoryID)
	}

	var results []result
	err := query.
		Group("skus.product_id, products.name").
		Order("revenue DESC").
		Limit(params.Limit).
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get top products by revenue: %w", err)
	}

	products := make([]ProductSales, 0, len(results))
	for _, r := range results {
		products = append(products, ProductSales{
			ProductID:   r.ProductID,
			ProductName: r.ProductName,
			Quantity:    r.Quantity,
			Revenue:     r.Revenue,
		})
	}

	return products, nil
}

// GetProductViewStats returns product view count and conversion rate (Req 28.3-28.4).
func (s *analyticsService) GetProductViewStats(ctx context.Context, productID uint) (*ViewStats, error) {
	// Count product_view events for this product
	var viewCount int64
	err := s.db.WithContext(ctx).
		Model(&models.AnalyticsEvent{}).
		Where("event_type = ? AND product_id = ?", models.AnalyticsEventTypeProductView, productID).
		Count(&viewCount).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count product views: %w", err)
	}

	// Count orders containing this product (through SKUs)
	var orderCount int64
	err = s.db.WithContext(ctx).
		Table("order_items").
		Joins("JOIN skus ON skus.id = order_items.sku_id").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("skus.product_id = ?", productID).
		Where("orders.status IN ?", paidStatuses).
		Distinct("orders.id").
		Count(&orderCount).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count product orders: %w", err)
	}

	var conversionRate float64
	if viewCount > 0 {
		conversionRate = float64(orderCount) / float64(viewCount) * 100
	}

	return &ViewStats{
		ProductID:      productID,
		ViewCount:      viewCount,
		OrderCount:     orderCount,
		ConversionRate: conversionRate,
	}, nil
}

// GetSKUSalesReport returns SKU-level sales data (Req 28.5).
func (s *analyticsService) GetSKUSalesReport(ctx context.Context, params *SKUSalesParams) ([]SKUSales, error) {
	type result struct {
		SKUID       uint            `gorm:"column:sku_id"`
		SKUCode     string          `gorm:"column:sku_code"`
		ProductID   uint            `gorm:"column:product_id"`
		ProductName string          `gorm:"column:product_name"`
		Quantity    int64           `gorm:"column:quantity"`
		Revenue     decimal.Decimal `gorm:"column:revenue"`
	}

	query := s.db.WithContext(ctx).
		Table("order_items").
		Select("order_items.sku_id as sku_id, skus.sku_code as sku_code, skus.product_id as product_id, products.name as product_name, SUM(order_items.quantity) as quantity, SUM(order_items.subtotal) as revenue").
		Joins("JOIN skus ON skus.id = order_items.sku_id").
		Joins("JOIN products ON products.id = skus.product_id").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("orders.created_at >= ? AND orders.created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("orders.status IN ?", paidStatuses)

	if params.CategoryID != nil {
		query = query.Where("products.category_id = ?", *params.CategoryID)
	}

	var results []result
	err := query.
		Group("order_items.sku_id, skus.sku_code, skus.product_id, products.name").
		Order("revenue DESC").
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get SKU sales report: %w", err)
	}

	skuSales := make([]SKUSales, 0, len(results))
	for _, r := range results {
		skuSales = append(skuSales, SKUSales{
			SKUID:       r.SKUID,
			SKUCode:     r.SKUCode,
			ProductID:   r.ProductID,
			ProductName: r.ProductName,
			Quantity:    r.Quantity,
			Revenue:     r.Revenue,
		})
	}

	return skuSales, nil
}

// GetConversionFunnel returns conversion funnel data (Req 29.1-29.2).
func (s *analyticsService) GetConversionFunnel(ctx context.Context, params *DateRangeParams) (*FunnelReport, error) {
	endDateExclusive := params.EndDate.Add(24 * time.Hour)

	funnelData, err := s.eventRepo.GetFunnelData(ctx, params.StartDate, endDateExclusive)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversion funnel: %w", err)
	}

	// Calculate conversion rates between each stage
	conversionRates := make(map[string]float64)
	if funnelData.HomepageViews > 0 {
		conversionRates["homepage_to_product"] = float64(funnelData.ProductViews) / float64(funnelData.HomepageViews) * 100
	}
	if funnelData.ProductViews > 0 {
		conversionRates["product_to_cart"] = float64(funnelData.AddToCart) / float64(funnelData.ProductViews) * 100
	}
	if funnelData.AddToCart > 0 {
		conversionRates["cart_to_checkout"] = float64(funnelData.CheckoutStarts) / float64(funnelData.AddToCart) * 100
	}
	if funnelData.CheckoutStarts > 0 {
		conversionRates["checkout_to_order"] = float64(funnelData.OrdersCompleted) / float64(funnelData.CheckoutStarts) * 100
	}
	if funnelData.HomepageViews > 0 {
		conversionRates["overall"] = float64(funnelData.OrdersCompleted) / float64(funnelData.HomepageViews) * 100
	}

	return &FunnelReport{
		HomepageViews:   funnelData.HomepageViews,
		ProductViews:    funnelData.ProductViews,
		AddToCartEvents: funnelData.AddToCart,
		CheckoutStarts:  funnelData.CheckoutStarts,
		OrdersCompleted: funnelData.OrdersCompleted,
		ConversionRates: conversionRates,
		StartDate:       params.StartDate.Format("2006-01-02"),
		EndDate:         params.EndDate.Format("2006-01-02"),
	}, nil
}

// GetCartAbandonmentRate returns cart abandonment rate (Req 29.3).
func (s *analyticsService) GetCartAbandonmentRate(ctx context.Context, params *DateRangeParams) (*AbandonmentReport, error) {
	endDateExclusive := params.EndDate.Add(24 * time.Hour)

	data, err := s.eventRepo.GetCartAbandonmentRate(ctx, params.StartDate, endDateExclusive)
	if err != nil {
		return nil, fmt.Errorf("failed to get cart abandonment rate: %w", err)
	}

	abandonedCarts := data.AddToCartCount - data.CheckoutCount
	if abandonedCarts < 0 {
		abandonedCarts = 0
	}

	return &AbandonmentReport{
		TotalCarts:      data.AddToCartCount,
		CheckoutCarts:   data.CheckoutCount,
		AbandonedCarts:  abandonedCarts,
		AbandonmentRate: data.AbandonmentRate,
		StartDate:       params.StartDate.Format("2006-01-02"),
		EndDate:         params.EndDate.Format("2006-01-02"),
	}, nil
}

// GetPaymentMethodDistribution returns payment method distribution (Req 29.4).
func (s *analyticsService) GetPaymentMethodDistribution(ctx context.Context, params *DateRangeParams) ([]MethodDistribution, error) {
	type result struct {
		Method string `gorm:"column:payment_method"`
		Count  int64  `gorm:"column:count"`
	}

	var results []result
	err := s.db.WithContext(ctx).
		Model(&models.Order{}).
		Select("payment_method, COUNT(*) as count").
		Where("created_at >= ? AND created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Where("payment_method != ''").
		Group("payment_method").
		Order("count DESC").
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get payment method distribution: %w", err)
	}

	var total int64
	for _, r := range results {
		total += r.Count
	}

	distributions := make([]MethodDistribution, 0, len(results))
	for _, r := range results {
		var percentage float64
		if total > 0 {
			percentage = float64(r.Count) / float64(total) * 100
		}
		distributions = append(distributions, MethodDistribution{
			Method:     r.Method,
			Count:      r.Count,
			Percentage: percentage,
		})
	}

	return distributions, nil
}

// GetOrderStatusDistribution returns order status distribution (Req 29.5).
func (s *analyticsService) GetOrderStatusDistribution(ctx context.Context, params *DateRangeParams) ([]StatusDistribution, error) {
	type result struct {
		Status string `gorm:"column:status"`
		Count  int64  `gorm:"column:count"`
	}

	var results []result
	err := s.db.WithContext(ctx).
		Model(&models.Order{}).
		Select("status, COUNT(*) as count").
		Where("created_at >= ? AND created_at < ?", params.StartDate, params.EndDate.Add(24*time.Hour)).
		Group("status").
		Order("count DESC").
		Find(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get order status distribution: %w", err)
	}

	var total int64
	for _, r := range results {
		total += r.Count
	}

	distributions := make([]StatusDistribution, 0, len(results))
	for _, r := range results {
		var percentage float64
		if total > 0 {
			percentage = float64(r.Count) / float64(total) * 100
		}
		distributions = append(distributions, StatusDistribution{
			Status:     r.Status,
			Count:      r.Count,
			Percentage: percentage,
		})
	}

	return distributions, nil
}
