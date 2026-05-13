package main

import (
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/handlers"
	"github.com/digital-store/backend/internal/middleware"
	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// setupRoutes configures all application routes
func setupRoutes(
	router *gin.Engine,
	authService services.AuthService,
	authHandler *handlers.AuthHandler,
	productHandler *handlers.ProductHandler,
	categoryHandler *handlers.CategoryHandler,
	cartHandler *handlers.CartHandler,
	orderHandler *handlers.OrderHandler,
	paymentHandler *handlers.PaymentHandler,
	inventoryHandler *handlers.InventoryHandler,
	adminOrderHandler *handlers.AdminOrderHandler,
	adminUserHandler *handlers.AdminUserHandler,
	bannerHandler *handlers.BannerHandler,
	announcementHandler *handlers.AnnouncementHandler,
	analyticsHandler *handlers.AnalyticsHandler,
	uploadDir string,
) {
	// Health check endpoint. Registered on both `/health` (legacy) and
	// `/api/v1/health` (matches the Dockerfile HEALTHCHECK probe and the
	// versioned API surface). Both paths return an identical payload.
	healthHandler := func(c *gin.Context) {
		response.Success(c, gin.H{
			"status": "healthy",
		})
	}
	router.GET("/health", healthHandler)
	router.GET("/api/v1/health", healthHandler)

	// Prometheus metrics endpoint. Scraped by the `digital-store-api` job in
	// monitoring/prometheus/prometheus.yml and surfaced by the Grafana
	// dashboard under monitoring/grafana.
	router.GET("/metrics", middleware.PrometheusHandler())

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Authentication routes (public)
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/password-reset/request", authHandler.RequestPasswordReset)
			auth.POST("/password-reset/confirm", authHandler.ResetPassword)

			// Protected auth routes
			authProtected := auth.Group("")
			authProtected.Use(middleware.AuthMiddleware(authService))
			{
				authProtected.POST("/logout", authHandler.Logout)
				authProtected.GET("/profile", authHandler.GetProfile)
			}
		}

		// Public routes (guests can access)
		products := v1.Group("/products")
		{
			products.GET("", productHandler.ListProducts)
			products.GET("/search", productHandler.SearchProducts)
			products.GET("/:id", productHandler.GetProduct)
		}

		categories := v1.Group("/categories")
		{
			categories.GET("", categoryHandler.ListCategories)
		}

		// Public banners endpoint (Requirement 25.6, 25.7)
		v1.GET("/banners", bannerHandler.GetActiveBanners)

		// Public announcements endpoint (Requirement 26.5, 26.6)
		v1.GET("/announcements", announcementHandler.GetActiveAnnouncements)

		// Cart routes (public - supports both guests and authenticated users)
		cart := v1.Group("/cart")
		{
			cart.POST("/items", cartHandler.AddToCart)
			cart.GET("", cartHandler.GetCart)
			cart.PUT("/items/:sku_id", cartHandler.UpdateCartItem)
			cart.DELETE("/items/:sku_id", cartHandler.RemoveCartItem)
			cart.DELETE("", cartHandler.ClearCart)
			cart.GET("/validate", cartHandler.ValidateCart)

			// Protected cart routes (authenticated users only)
			cartProtected := cart.Group("")
			cartProtected.Use(middleware.AuthMiddleware(authService))
			{
				cartProtected.POST("/merge", cartHandler.MergeGuestCart)
			}
		}

		// Order routes. Creation and guest tracking are public; auth is
		// optional on POST / so signed-in users get their account attached.
		// Order listing, detail, and cancellation require authentication.
		orders := v1.Group("/orders")
		{
			// Public endpoints
			orders.POST("", middleware.OptionalAuth(authService), orderHandler.CreateOrder)
			orders.POST("/track", orderHandler.TrackOrder)

			// Authenticated endpoints (user order history and management)
			ordersAuth := orders.Group("")
			ordersAuth.Use(middleware.AuthMiddleware(authService))
			{
				ordersAuth.GET("", orderHandler.ListUserOrders)
				ordersAuth.GET("/:id", orderHandler.GetUserOrder)
				ordersAuth.POST("/:id/cancel", orderHandler.CancelUserOrder)
			}
		}

		// Payment routes. Online session creation and transfer proof upload
		// are public (guest orders use these too); the Stripe webhook is
		// also public but authenticated via the Stripe-Signature header
		// verified inside ConfirmPayment (Requirement 9.5).
		payments := v1.Group("/payments")
		{
			payments.POST("/online/session", paymentHandler.CreateOnlinePaymentSession)
			payments.POST("/webhook/stripe", paymentHandler.StripeWebhook)
			payments.POST("/transfer/upload", paymentHandler.UploadTransferProof)
		}

		// Admin routes
		// Admin login (public - no auth required)
		admin := v1.Group("/admin")
		{
			admin.POST("/login", authHandler.AdminLogin)
		}

		// Admin protected routes
		adminProtected := v1.Group("/admin")
		adminProtected.Use(middleware.AuthMiddleware(authService))
		{
			// Product management (product_manager, super_admin)
			products := adminProtected.Group("/products")
			products.Use(middleware.RequireRole(models.RoleProductManager, models.RoleSuperAdmin))
			{
				products.POST("", productHandler.CreateProduct)
				products.PUT("/:id", productHandler.UpdateProduct)
				products.DELETE("/:id", productHandler.DeleteProduct)
				products.POST("/:id/skus", productHandler.CreateSKU)
			}

			// SKU management (product_manager, super_admin)
			skus := adminProtected.Group("/skus")
			skus.Use(middleware.RequireRole(models.RoleProductManager, models.RoleSuperAdmin))
			{
				skus.PUT("/:id", productHandler.UpdateSKU)
				skus.DELETE("/:id", productHandler.DeleteSKU)
			}

			// Category management (product_manager, super_admin)
			adminCategories := adminProtected.Group("/categories")
			adminCategories.Use(middleware.RequireRole(models.RoleProductManager, models.RoleSuperAdmin))
			{
				adminCategories.POST("", categoryHandler.CreateCategory)
				adminCategories.PUT("/:id", categoryHandler.UpdateCategory)
				adminCategories.DELETE("/:id", categoryHandler.DeleteCategory)
			}

			// Order management (order_manager, super_admin)
			orders := adminProtected.Group("/orders")
			orders.Use(middleware.RequireRole(models.RoleOrderManager, models.RoleSuperAdmin))
			{
				orders.GET("", adminOrderHandler.ListAllOrders)
				orders.GET("/export", adminOrderHandler.ExportOrders)
				orders.GET("/:id", adminOrderHandler.GetOrder)
				orders.PUT("/:id/status", adminOrderHandler.UpdateStatus)
				orders.POST("/:id/ship", adminOrderHandler.ShipOrder)
				orders.POST("/:id/cancel", adminOrderHandler.CancelOrder)
			}

			// Payment management (order_manager, super_admin)
			adminPayments := adminProtected.Group("/payments")
			adminPayments.Use(middleware.RequireRole(models.RoleOrderManager, models.RoleSuperAdmin))
			{
				adminPayments.GET("/transfer/pending", paymentHandler.ListPendingTransfers)
				adminPayments.POST("/transfer/:id/confirm", paymentHandler.ConfirmTransfer)
				adminPayments.POST("/transfer/:id/reject", paymentHandler.RejectTransfer)
				adminPayments.POST("/transfer/batch-confirm", paymentHandler.BatchConfirmTransfer)
			}

			// Inventory management (product_manager, super_admin)
			inventory := adminProtected.Group("/inventory")
			inventory.Use(middleware.RequireRole(models.RoleProductManager, models.RoleSuperAdmin))
			{
				inventory.GET("", inventoryHandler.ListInventory)
				inventory.PUT("/:sku_id", inventoryHandler.AdjustInventory)
				inventory.GET("/alerts", inventoryHandler.GetLowStockAlerts)
				inventory.GET("/:sku_id/history", inventoryHandler.GetInventoryHistory)
			}

			// User management (super_admin only)
			users := adminProtected.Group("/users")
			users.Use(middleware.RequireRole(models.RoleSuperAdmin))
			{
				users.GET("", adminUserHandler.ListUsers)
				users.GET("/:id", adminUserHandler.GetUser)
				users.PUT("/:id/disable", adminUserHandler.DisableUser)
				users.POST("/:id/reset-password", adminUserHandler.ResetUserPassword)
			}

			// Content management (super_admin only)
			// Banner management (Requirements 25.1-25.8)
			banners := adminProtected.Group("/banners")
			banners.Use(middleware.RequireRole(models.RoleSuperAdmin))
			{
				banners.POST("", bannerHandler.CreateBanner)
				banners.GET("", bannerHandler.ListBanners)
				banners.PUT("/:id", bannerHandler.UpdateBanner)
				banners.DELETE("/:id", bannerHandler.DeleteBanner)
			}

			// Announcement management (Requirements 26.1-26.7)
			announcements := adminProtected.Group("/announcements")
			announcements.Use(middleware.RequireRole(models.RoleSuperAdmin))
			{
				announcements.POST("", announcementHandler.CreateAnnouncement)
				announcements.GET("", announcementHandler.ListAnnouncements)
				announcements.PUT("/:id", announcementHandler.UpdateAnnouncement)
				announcements.DELETE("/:id", announcementHandler.DeleteAnnouncement)
			}

			content := adminProtected.Group("/content")
			content.Use(middleware.RequireRole(models.RoleSuperAdmin))
			{
				// Reserved for future content management endpoints
			}

			// Analytics (order_manager, super_admin)
			analytics := adminProtected.Group("/analytics")
			analytics.Use(middleware.RequireRole(models.RoleOrderManager, models.RoleSuperAdmin))
			{
				analytics.GET("/revenue", analyticsHandler.GetRevenue)
				analytics.GET("/orders", analyticsHandler.GetOrderStats)
				analytics.GET("/aov", analyticsHandler.GetAOV)
				analytics.GET("/export", analyticsHandler.ExportAnalytics)
				analytics.GET("/products/top-quantity", analyticsHandler.GetTopProductsByQuantity)
				analytics.GET("/products/top-revenue", analyticsHandler.GetTopProductsByRevenue)
				analytics.GET("/products/:id/views", analyticsHandler.GetProductViews)
				analytics.GET("/skus", analyticsHandler.GetSKUSales)
				analytics.GET("/funnel", analyticsHandler.GetConversionFunnel)
				analytics.GET("/cart-abandonment", analyticsHandler.GetCartAbandonment)
				analytics.GET("/payment-distribution", analyticsHandler.GetPaymentDistribution)
				analytics.GET("/status-distribution", analyticsHandler.GetStatusDistribution)
			}
		}
	}

	// Static file serving for uploaded images with cache headers.
	// Requirement 23.7: serve images with max-age 7 days.
	if uploadDir != "" {
		absUploadDir, _ := filepath.Abs(uploadDir)
		router.GET("/uploads/*filepath", func(c *gin.Context) {
			// Set cache headers (7 days = 604800 seconds).
			c.Header("Cache-Control", "public, max-age=604800")
			c.Header("X-Content-Type-Options", "nosniff")

			filePath := c.Param("filepath")
			fullPath := filepath.Join(absUploadDir, filepath.Clean(filePath))

			// Security: ensure the resolved path is within the upload dir.
			if !isSubPath(absUploadDir, fullPath) {
				c.Status(http.StatusNotFound)
				return
			}

			c.File(fullPath)
		})
	}
}

// isSubPath checks if target is within the base directory.
func isSubPath(base, target string) bool {
	absBase, err := filepath.Abs(base)
	if err != nil {
		return false
	}
	absTarget, err := filepath.Abs(target)
	if err != nil {
		return false
	}
	return len(absTarget) >= len(absBase) &&
		absTarget[:len(absBase)] == absBase &&
		(len(absTarget) == len(absBase) || absTarget[len(absBase)] == filepath.Separator)
}
