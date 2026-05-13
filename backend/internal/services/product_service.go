package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// ProductService defines the interface for product business logic
type ProductService interface {
	CreateProduct(ctx context.Context, req *CreateProductRequest) (*models.Product, error)
	GetProduct(ctx context.Context, id uint) (*models.Product, error)
	GetProductWithDetails(ctx context.Context, id uint) (*models.Product, error)
	ListProducts(ctx context.Context, params *ListProductsRequest) (*ProductListResponse, error)
	UpdateProduct(ctx context.Context, id uint, req *UpdateProductRequest) error
	DeleteProduct(ctx context.Context, id uint) error
	SearchProducts(ctx context.Context, query string, params *ListProductsRequest) (*ProductListResponse, error)
}

// CreateProductRequest represents a request to create a product
type CreateProductRequest struct {
	Name           string   `json:"name" validate:"required,min=1,max=200"`
	Description    string   `json:"description"`
	CategoryID     *uint    `json:"category_id"`
	Specifications string   `json:"specifications"` // JSON string
	IsActive       bool     `json:"is_active"`
	Images         []string `json:"images"` // Image URLs
}

// UpdateProductRequest represents a request to update a product
type UpdateProductRequest struct {
	Name           *string  `json:"name" validate:"omitempty,min=1,max=200"`
	Description    *string  `json:"description"`
	CategoryID     *uint    `json:"category_id"`
	Specifications *string  `json:"specifications"` // JSON string
	IsActive       *bool    `json:"is_active"`
}

// ListProductsRequest represents a request to list products
type ListProductsRequest struct {
	Page       int    `json:"page" validate:"min=1"`
	PageSize   int    `json:"page_size" validate:"min=1,max=100"`
	CategoryID *uint  `json:"category_id"`
	IsActive   *bool  `json:"is_active"`
	SortBy     string `json:"sort_by"` // "name", "created_at", "price"
	SortOrder  string `json:"sort_order"` // "asc", "desc"
}

// ProductListResponse represents a paginated list of products
type ProductListResponse struct {
	Products []*models.Product `json:"products"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"page_size"`
}

// productService implements ProductService
type productService struct {
	productRepo  repositories.ProductRepository
	categoryRepo repositories.CategoryRepository
	redisClient  *redis.Client
	cacheTTL     time.Duration
}

// NewProductService creates a new product service
func NewProductService(
	productRepo repositories.ProductRepository,
	categoryRepo repositories.CategoryRepository,
	redisClient *redis.Client,
) ProductService {
	return &productService{
		productRepo:  productRepo,
		categoryRepo: categoryRepo,
		redisClient:  redisClient,
		cacheTTL:     5 * time.Minute, // 5 minutes cache TTL as per requirements
	}
}

// CreateProduct creates a new product
func (s *productService) CreateProduct(ctx context.Context, req *CreateProductRequest) (*models.Product, error) {
	// Validate category if provided
	if req.CategoryID != nil {
		if _, err := s.categoryRepo.GetByID(ctx, *req.CategoryID); err != nil {
			return nil, fmt.Errorf("invalid category: %w", err)
		}
	}

	// Create product
	product := &models.Product{
		Name:           req.Name,
		Description:    req.Description,
		CategoryID:     req.CategoryID,
		Specifications: req.Specifications,
		IsActive:       req.IsActive,
	}

	if err := s.productRepo.Create(ctx, product); err != nil {
		return nil, err
	}

	// Create product images if provided
	if len(req.Images) > 0 {
		// Note: Image creation would be handled by a separate image service
		// For now, we'll just note that images should be created
	}

	// Invalidate product list cache
	s.invalidateProductListCache(ctx)

	return product, nil
}

// GetProduct retrieves a product by ID
func (s *productService) GetProduct(ctx context.Context, id uint) (*models.Product, error) {
	return s.productRepo.GetByID(ctx, id)
}

// GetProductWithDetails retrieves a product with all details (SKUs, images, category)
func (s *productService) GetProductWithDetails(ctx context.Context, id uint) (*models.Product, error) {
	// Try to get from cache first
	cacheKey := fmt.Sprintf("product:details:%d", id)
	cached, err := s.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var product models.Product
		if err := json.Unmarshal([]byte(cached), &product); err == nil {
			return &product, nil
		}
	}

	// Get from database
	product, err := s.productRepo.GetWithDetails(ctx, id)
	if err != nil {
		return nil, err
	}

	// Cache the result
	data, err := json.Marshal(product)
	if err == nil {
		s.redisClient.Set(ctx, cacheKey, data, s.cacheTTL)
	}

	return product, nil
}

// ListProducts retrieves a paginated list of products
func (s *productService) ListProducts(ctx context.Context, req *ListProductsRequest) (*ProductListResponse, error) {
	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}

	// Try to get from cache
	cacheKey := s.buildProductListCacheKey(req)
	cached, err := s.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var response ProductListResponse
		if err := json.Unmarshal([]byte(cached), &response); err == nil {
			return &response, nil
		}
	}

	// Calculate offset
	offset := (req.Page - 1) * req.PageSize

	// Build repository params
	params := &repositories.ListProductParams{
		Limit:      req.PageSize,
		Offset:     offset,
		CategoryID: req.CategoryID,
		IsActive:   req.IsActive,
		SortBy:     req.SortBy,
		SortOrder:  req.SortOrder,
	}

	// Get from database
	products, total, err := s.productRepo.List(ctx, params)
	if err != nil {
		return nil, err
	}

	response := &ProductListResponse{
		Products: products,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}

	// Cache the result
	data, err := json.Marshal(response)
	if err == nil {
		s.redisClient.Set(ctx, cacheKey, data, s.cacheTTL)
	}

	return response, nil
}

// UpdateProduct updates a product
func (s *productService) UpdateProduct(ctx context.Context, id uint, req *UpdateProductRequest) error {
	// Get existing product
	product, err := s.productRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	// Validate category if provided
	if req.CategoryID != nil {
		if _, err := s.categoryRepo.GetByID(ctx, *req.CategoryID); err != nil {
			return fmt.Errorf("invalid category: %w", err)
		}
		product.CategoryID = req.CategoryID
	}

	// Update fields
	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.Description != nil {
		product.Description = *req.Description
	}
	if req.Specifications != nil {
		product.Specifications = *req.Specifications
	}
	if req.IsActive != nil {
		product.IsActive = *req.IsActive
	}

	// Save changes
	if err := s.productRepo.Update(ctx, product); err != nil {
		return err
	}

	// Invalidate caches
	s.invalidateProductCache(ctx, id)
	s.invalidateProductListCache(ctx)

	return nil
}

// DeleteProduct deletes a product
func (s *productService) DeleteProduct(ctx context.Context, id uint) error {
	if err := s.productRepo.Delete(ctx, id); err != nil {
		return err
	}

	// Invalidate caches
	s.invalidateProductCache(ctx, id)
	s.invalidateProductListCache(ctx)

	return nil
}

// SearchProducts searches for products by name and description
func (s *productService) SearchProducts(ctx context.Context, query string, req *ListProductsRequest) (*ProductListResponse, error) {
	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}

	// Calculate offset
	offset := (req.Page - 1) * req.PageSize

	// Build repository params
	params := &repositories.ListProductParams{
		Limit:      req.PageSize,
		Offset:     offset,
		CategoryID: req.CategoryID,
		IsActive:   req.IsActive,
		SortBy:     req.SortBy,
		SortOrder:  req.SortOrder,
	}

	// Search in database
	products, total, err := s.productRepo.Search(ctx, query, params)
	if err != nil {
		return nil, err
	}

	return &ProductListResponse{
		Products: products,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// buildProductListCacheKey builds a cache key for product list
func (s *productService) buildProductListCacheKey(req *ListProductsRequest) string {
	key := fmt.Sprintf("products:list:page=%d:size=%d", req.Page, req.PageSize)
	if req.CategoryID != nil {
		key += fmt.Sprintf(":cat=%d", *req.CategoryID)
	}
	if req.IsActive != nil {
		key += fmt.Sprintf(":active=%t", *req.IsActive)
	}
	if req.SortBy != "" {
		key += fmt.Sprintf(":sort=%s:%s", req.SortBy, req.SortOrder)
	}
	return key
}

// invalidateProductCache invalidates product detail cache
func (s *productService) invalidateProductCache(ctx context.Context, id uint) {
	cacheKey := fmt.Sprintf("product:details:%d", id)
	s.redisClient.Del(ctx, cacheKey)
}

// invalidateProductListCache invalidates all product list caches
func (s *productService) invalidateProductListCache(ctx context.Context) {
	// Delete all keys matching the pattern
	iter := s.redisClient.Scan(ctx, 0, "products:list:*", 0).Iterator()
	for iter.Next(ctx) {
		s.redisClient.Del(ctx, iter.Val())
	}
}
