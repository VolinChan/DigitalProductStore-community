package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/digital-store/backend/internal/cache"
	"github.com/digital-store/backend/internal/config"
	"github.com/digital-store/backend/internal/database"
	"github.com/digital-store/backend/internal/handlers"
	"github.com/digital-store/backend/internal/middleware"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/internal/worker"
	"github.com/digital-store/backend/pkg/logger"
	"github.com/digital-store/backend/pkg/response"
	"github.com/digital-store/backend/pkg/utils"
)

// @title Digital Store API
// @version 1.0
// @description A digital product e-commerce system API
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	log := logger.New(cfg.Environment)
	defer log.Sync()

	// Initialize database connection
	db, err := database.New(&cfg.Database, log.SugaredLogger)
	if err != nil {
		log.Fatal(fmt.Sprintf("Failed to connect to database: %v", err))
	}
	defer func() {
		if err := db.Close(); err != nil {
			log.Error(fmt.Sprintf("Failed to close database connection: %v", err))
		}
	}()
	log.Info("Database connection established")

	// Run migrations
	ctx := context.Background()
	if err := database.MigrateFromFS(ctx, db, database.MigrationsFS, "migrations"); err != nil {
		log.Fatal(fmt.Sprintf("Failed to run migrations: %v", err))
	}
	log.Info("Database migrations completed")

	// Demo data seeding (opt-in via SEED_DEMO_DATA=true). Idempotent — safe
	// to leave on across restarts. Never enable in production.
	if os.Getenv("SEED_DEMO_DATA") == "true" {
		if err := database.SeedDemoData(ctx, db.DB); err != nil {
			log.Warnw("Demo data seed failed", "error", err.Error())
		} else {
			log.Info("Demo data seeded (admin@demo.local / Admin@1234)")
		}
	}

	// Initialize Redis connection
	redisClient, err := cache.New(&cfg.Redis, log)
	if err != nil {
		log.Fatal(fmt.Sprintf("Failed to connect to Redis: %v", err))
	}
	defer func() {
		if err := redisClient.Close(); err != nil {
			log.Error(fmt.Sprintf("Failed to close Redis connection: %v", err))
		}
	}()

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	router := gin.New()

	// Create error handler
	errorHandler := middleware.NewErrorHandler(log, cfg)

	// Add middleware (order matters!)
	// 1. Recovery middleware should be first to catch panics
	router.Use(errorHandler.RecoveryMiddleware())
	// 2. Security headers (XSS, clickjacking, MIME sniffing protection)
	router.Use(middleware.SecurityHeadersMiddleware())
	// 3. CORS configuration (Requirement 19)
	allowedOrigins := []string{"http://localhost:3000", "http://localhost:8080"}
	if cfg.Environment == "production" {
		allowedOrigins = []string{os.Getenv("FRONTEND_URL")}
	}
	router.Use(middleware.CORSMiddleware(allowedOrigins))
	// 4. Rate limiting (Requirement 19.5: 100 requests/minute/IP in production).
	// For local development we use a much higher limit because browsers
	// pull dozens of static assets per page load, and our limiter counts
	// every request rather than just the /api/* surface.
	rateLimitReqPerMin := cfg.RateLimit.RequestsPerMinute
	if cfg.IsDevelopment() {
		rateLimitReqPerMin = 10000
	}
	rateLimiter := middleware.NewRateLimiter(rateLimitReqPerMin, time.Minute)
	router.Use(middleware.RateLimitMiddleware(rateLimiter))
	// 5. Input sanitization (XSS prevention on query params)
	router.Use(middleware.InputSanitizationMiddleware())
	// 6. Request logging
	router.Use(logger.Middleware(log))
	// 7. Request ID middleware
	router.Use(response.Middleware())
	// 8. Error handler for AppError conversion
	router.Use(errorHandler.ErrorHandlerMiddleware())
	// 9. Security audit logging (Requirement 19.9)
	securityLogger := middleware.NewSecurityLogger(log.SugaredLogger)
	router.Use(middleware.SecurityAuditMiddleware(securityLogger))
	// 10. Prometheus HTTP metrics (http_requests_total, http_request_duration_seconds)
	router.Use(middleware.MetricsMiddleware())

	// Handle 404 Not Found
	router.NoRoute(errorHandler.NotFoundHandler())

	// Handle 405 Method Not Allowed
	router.NoMethod(errorHandler.MethodNotAllowedHandler())

	// Initialize repositories
	userRepo := repositories.NewUserRepository(db.DB)
	categoryRepo := repositories.NewCategoryRepository(db.DB)
	productRepo := repositories.NewProductRepository(db.DB)
	skuRepo := repositories.NewSKURepository(db.DB)
	cartRepo := repositories.NewCartRepository(db.DB)
	orderRepo := repositories.NewOrderRepository(db.DB)
	paymentRepo := repositories.NewPaymentRepository(db.DB)
	inventoryLogRepo := repositories.NewInventoryLogRepository(db.DB)

	// Transaction manager lets multi-repository operations (e.g. creating an
	// order while decrementing inventory) run atomically.
	txManager := repositories.NewTxManager(db.DB)

	// Initialize utilities
	jwtManager := utils.NewJWTManager(cfg.JWT.Secret, cfg.JWT.AccessTokenTTL, cfg.JWT.RefreshTokenTTL, cfg.JWT.Issuer)
	validator := utils.NewValidator()

	// Initialize email sender. Real SMTP delivery only happens when
	// EMAIL_ENABLED=true and the SMTP host / from address are set.
	// Otherwise we fall back to a no-op sender so local dev and tests
	// don't need a reachable mail server.
	var emailSender services.EmailSender
	if cfg.Email.IsEnabled() {
		smtpSender, err := services.NewSMTPEmailSender(services.SMTPConfig{
			Host:                 cfg.Email.SMTPHost,
			Port:                 cfg.Email.SMTPPort,
			Username:             cfg.Email.SMTPUser,
			Password:             cfg.Email.SMTPPass,
			FromAddress:          cfg.Email.FromEmail,
			FromName:             cfg.Email.FromName,
			BrandName:            cfg.Email.BrandName,
			PasswordResetBaseURL: cfg.Email.PasswordResetBaseURL,
		}, log)
		if err != nil {
			log.Warnw("SMTP email sender disabled (invalid config); using noop sender",
				"error", err.Error(),
			)
			emailSender = services.NewNoopEmailSender(log)
		} else {
			emailSender = smtpSender
			log.Info("SMTP email sender initialized")
		}
	} else {
		emailSender = services.NewNoopEmailSender(log)
		log.Info("Email sending disabled; using noop sender")
	}

	// NotificationService wraps the EmailSender with order-aware helpers
	// used by OrderService, PaymentService and background jobs.
	notificationService := services.NewNotificationService(emailSender, log)

	// Initialize services
	authService := services.NewAuthService(userRepo, jwtManager, validator, redisClient, emailSender)
	productService := services.NewProductService(productRepo, categoryRepo, redisClient.GetClient())
	skuService := services.NewSKUService(skuRepo, productRepo)
	cartService := services.NewCartService(cartRepo, skuRepo)
	inventoryService := services.NewInventoryService(skuRepo, inventoryLogRepo, txManager, db.DB)
	orderService := services.NewOrderService(orderRepo, skuRepo, cartRepo, inventoryLogRepo, txManager, notificationService)

	// File storage backend. Transfer proofs, product images, and banners
	// land under cfg.Storage.LocalDir when running with the "local"
	// provider, or in S3/MinIO when configured.
	var fileStorage services.FileStorage
	switch cfg.Storage.Provider {
	case "s3", "minio":
		s3Storage, err := services.NewS3FileStorage(services.S3Config{
			Bucket:    cfg.Storage.S3Bucket,
			Region:    cfg.Storage.S3Region,
			AccessKey: cfg.Storage.S3AccessKey,
			SecretKey: cfg.Storage.S3SecretKey,
			Endpoint:  cfg.Storage.S3Endpoint,
		})
		if err != nil {
			log.Warnw("S3 file storage initialization failed; falling back to local storage",
				"error", err.Error(),
			)
			fileStorage = services.NewLocalFileStorage(cfg.Storage.LocalDir, "/uploads")
		} else {
			fileStorage = s3Storage
			log.Info("S3/MinIO file storage initialized")
		}
	default:
		fileStorage = services.NewLocalFileStorage(cfg.Storage.LocalDir, "/uploads")
		log.Info("Local file storage initialized")
	}

	// FileUploadService wraps the storage backend with image format
	// validation, size limits, and content-addressable naming.
	fileUploadService := services.NewFileUploadService(fileStorage)
	_ = fileUploadService // Used by handlers in subsequent tasks

	// Payment service. Wires Stripe config from the global config struct
	// so the handler can create checkout sessions and verify webhook
	// signatures.
	paymentService := services.NewPaymentService(
		paymentRepo,
		orderRepo,
		txManager,
		fileStorage,
		services.StripeConfig{
			SecretKey:     cfg.Payment.StripeSecretKey,
			WebhookSecret: cfg.Payment.StripeWebhookSecret,
			SuccessURL:    cfg.Payment.StripeSuccessURL,
			CancelURL:     cfg.Payment.StripeCancelURL,
		},
		log,
		notificationService,
	)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService)
	productHandler := handlers.NewProductHandler(productService, skuService)
	categoryHandler := handlers.NewCategoryHandler(categoryRepo)
	cartHandler := handlers.NewCartHandler(cartService)
	orderHandler := handlers.NewOrderHandler(orderService)
	paymentHandler := handlers.NewPaymentHandler(paymentService, paymentRepo)
	inventoryHandler := handlers.NewInventoryHandler(inventoryService)
	adminOrderHandler := handlers.NewAdminOrderHandler(orderService)
	adminUserHandler := handlers.NewAdminUserHandler(userRepo, authService)
	bannerRepo := repositories.NewBannerRepository(db.DB)
	bannerHandler := handlers.NewBannerHandler(bannerRepo)
	announcementRepo := repositories.NewAnnouncementRepository(db.DB)
	announcementHandler := handlers.NewAnnouncementHandler(announcementRepo)

	// Analytics service and handler (Requirements 27.1-27.7, 29.1-29.6)
	analyticsEventRepo := repositories.NewAnalyticsEventRepository(db.DB)
	analyticsService := services.NewAnalyticsService(db.DB, analyticsEventRepo)
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService)

	// Start background workers
	// Transfer deadline checker: scans for expired transfer orders every hour
	// and auto-cancels them, restoring inventory and sending notifications
	// (Requirements 11.2-11.5).
	deadlineChecker := worker.NewDeadlineChecker(
		db.DB,
		orderRepo,
		skuRepo,
		inventoryLogRepo,
		txManager,
		notificationService,
		log,
	)
	deadlineChecker.Start()
	defer deadlineChecker.Stop()

	// Transfer deadline reminder checker: scans for transfer orders whose
	// confirmation deadline is within the next 24 hours and sends a reminder
	// email to the administrator (Requirement 11.1).
	reminderChecker := worker.NewReminderChecker(
		db.DB,
		notificationService,
		log,
	)
	reminderChecker.Start()
	defer reminderChecker.Stop()

	// Register Swagger UI routes (Requirement 31.1-31.5)
	swaggerSpec, err := os.ReadFile("api/openapi/swagger.json")
	if err != nil {
		log.Warnw("Swagger spec not found; API docs disabled", "error", err.Error())
	} else {
		handlers.RegisterSwaggerRoutes(router, swaggerSpec)
		log.Info("Swagger UI available at /api/docs")
	}

	// Setup routes
	setupRoutes(router, authService, authHandler, productHandler, categoryHandler, cartHandler, orderHandler, paymentHandler, inventoryHandler, adminOrderHandler, adminUserHandler, bannerHandler, announcementHandler, analyticsHandler, cfg.Storage.LocalDir)

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Start server in a goroutine
	go func() {
		log.Info(fmt.Sprintf("Starting server on port %s", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(fmt.Sprintf("Failed to start server: %v", err))
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Give outstanding requests 30 seconds to complete
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal(fmt.Sprintf("Server forced to shutdown: %v", err))
	}

	log.Info("Server exited properly")
}
