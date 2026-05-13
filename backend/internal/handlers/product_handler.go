package handlers

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// ProductHandler handles product-related HTTP requests
type ProductHandler struct {
	productService services.ProductService
	skuService     services.SKUService
}

// NewProductHandler creates a new product handler
func NewProductHandler(productService services.ProductService, skuService services.SKUService) *ProductHandler {
	return &ProductHandler{
		productService: productService,
		skuService:     skuService,
	}
}

// ListProducts handles GET /api/v1/products
func (h *ProductHandler) ListProducts(c *gin.Context) {
	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	sortBy := c.Query("sort_by")
	sortOrder := c.Query("sort_order")

	var categoryID *uint
	if catIDStr := c.Query("category_id"); catIDStr != "" {
		if catID, err := strconv.ParseUint(catIDStr, 10, 32); err == nil {
			id := uint(catID)
			categoryID = &id
		}
	}

	var isActive *bool
	if activeStr := c.Query("is_active"); activeStr != "" {
		if activeStr == "true" {
			active := true
			isActive = &active
		} else if activeStr == "false" {
			active := false
			isActive = &active
		}
	}

	req := &services.ListProductsRequest{
		Page:       page,
		PageSize:   pageSize,
		CategoryID: categoryID,
		IsActive:   isActive,
		SortBy:     sortBy,
		SortOrder:  sortOrder,
	}

	result, err := h.productService.ListProducts(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, "Failed to list products", err.Error())
		return
	}

	response.Success(c, result)
}

// GetProduct handles GET /api/v1/products/:id
func (h *ProductHandler) GetProduct(c *gin.Context) {
	// Parse product ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID", err.Error())
		return
	}

	// Get product with details
	product, err := h.productService.GetProductWithDetails(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c, "Product not found", err.Error())
		return
	}

	response.Success(c, product)
}

// SearchProducts handles GET /api/v1/products/search
func (h *ProductHandler) SearchProducts(c *gin.Context) {
	// Parse query parameters
	query := c.Query("q")
	if query == "" {
		response.BadRequest(c, "Search query is required")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	sortBy := c.Query("sort_by")
	sortOrder := c.Query("sort_order")

	var categoryID *uint
	if catIDStr := c.Query("category_id"); catIDStr != "" {
		if catID, err := strconv.ParseUint(catIDStr, 10, 32); err == nil {
			id := uint(catID)
			categoryID = &id
		}
	}

	var isActive *bool
	if activeStr := c.Query("is_active"); activeStr != "" {
		if activeStr == "true" {
			active := true
			isActive = &active
		} else if activeStr == "false" {
			active := false
			isActive = &active
		}
	}

	req := &services.ListProductsRequest{
		Page:       page,
		PageSize:   pageSize,
		CategoryID: categoryID,
		IsActive:   isActive,
		SortBy:     sortBy,
		SortOrder:  sortOrder,
	}

	result, err := h.productService.SearchProducts(c.Request.Context(), query, req)
	if err != nil {
		response.InternalError(c, "Failed to search products", err.Error())
		return
	}

	response.Success(c, result)
}

// ==================== Admin Product Management Handlers ====================

// AdminCreateProductRequest represents the request body for creating a product
type AdminCreateProductRequest struct {
	Name           string   `json:"name" binding:"required,min=1,max=200"`
	Description    string   `json:"description"`
	CategoryID     *uint    `json:"category_id"`
	Specifications string   `json:"specifications"`
	IsActive       *bool    `json:"is_active"`
	Images         []string `json:"images"`
}

// AdminUpdateProductRequest represents the request body for updating a product
type AdminUpdateProductRequest struct {
	Name           *string  `json:"name" binding:"omitempty,min=1,max=200"`
	Description    *string  `json:"description"`
	CategoryID     *uint    `json:"category_id"`
	Specifications *string  `json:"specifications"`
	IsActive       *bool    `json:"is_active"`
}

// CreateProduct handles POST /api/v1/admin/products
func (h *ProductHandler) CreateProduct(c *gin.Context) {
	var req AdminCreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Validate name is not empty after trimming
	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "Product name is required")
		return
	}

	// Default is_active to true if not specified
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	createReq := &services.CreateProductRequest{
		Name:           name,
		Description:    req.Description,
		CategoryID:     req.CategoryID,
		Specifications: req.Specifications,
		IsActive:       isActive,
		Images:         req.Images,
	}

	product, err := h.productService.CreateProduct(c.Request.Context(), createReq)
	if err != nil {
		if strings.Contains(err.Error(), "invalid category") {
			response.BadRequest(c, "Invalid category ID", err.Error())
			return
		}
		response.InternalError(c, "Failed to create product", err.Error())
		return
	}

	response.Created(c, product)
}

// UpdateProduct handles PUT /api/v1/admin/products/:id
func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	// Parse product ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID", err.Error())
		return
	}

	var req AdminUpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Validate name if provided
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			response.BadRequest(c, "Product name cannot be empty")
			return
		}
		req.Name = &name
	}

	updateReq := &services.UpdateProductRequest{
		Name:           req.Name,
		Description:    req.Description,
		CategoryID:     req.CategoryID,
		Specifications: req.Specifications,
		IsActive:       req.IsActive,
	}

	if err := h.productService.UpdateProduct(c.Request.Context(), uint(id), updateReq); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Product not found", err.Error())
			return
		}
		if strings.Contains(err.Error(), "invalid category") {
			response.BadRequest(c, "Invalid category ID", err.Error())
			return
		}
		response.InternalError(c, "Failed to update product", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Product updated successfully"})
}

// DeleteProduct handles DELETE /api/v1/admin/products/:id
func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	// Parse product ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID", err.Error())
		return
	}

	if err := h.productService.DeleteProduct(c.Request.Context(), uint(id)); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Product not found", err.Error())
			return
		}
		if strings.Contains(err.Error(), "pending orders") {
			response.Conflict(c, "Cannot delete product with pending orders", err.Error())
			return
		}
		response.InternalError(c, "Failed to delete product", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Product deleted successfully"})
}

// ==================== Admin SKU Management Handlers ====================

// AdminCreateSKURequest represents the request body for creating a SKU
type AdminCreateSKURequest struct {
	SKUCode    string                      `json:"sku_code" binding:"required,min=1,max=100"`
	Price      float64                     `json:"price" binding:"required,gt=0"`
	Inventory  int                         `json:"inventory" binding:"gte=0"`
	ImageURL   string                      `json:"image_url"`
	IsActive   *bool                       `json:"is_active"`
	Attributes []AdminSKUAttributeRequest  `json:"attributes" binding:"required,min=1"`
}

// AdminUpdateSKURequest represents the request body for updating a SKU
type AdminUpdateSKURequest struct {
	SKUCode    *string                     `json:"sku_code" binding:"omitempty,min=1,max=100"`
	Price      *float64                    `json:"price" binding:"omitempty,gt=0"`
	Inventory  *int                        `json:"inventory" binding:"omitempty,gte=0"`
	ImageURL   *string                     `json:"image_url"`
	IsActive   *bool                       `json:"is_active"`
	Attributes *[]AdminSKUAttributeRequest `json:"attributes" binding:"omitempty,min=1"`
}

// AdminSKUAttributeRequest represents a SKU attribute in a request
type AdminSKUAttributeRequest struct {
	Name  string `json:"name" binding:"required,min=1,max=50"`
	Value string `json:"value" binding:"required,min=1,max=100"`
}

// CreateSKU handles POST /api/v1/admin/products/:id/skus
func (h *ProductHandler) CreateSKU(c *gin.Context) {
	// Parse product ID
	idStr := c.Param("id")
	productID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID", err.Error())
		return
	}

	var req AdminCreateSKURequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Validate SKU code is not empty after trimming
	skuCode := strings.TrimSpace(req.SKUCode)
	if skuCode == "" {
		response.BadRequest(c, "SKU code is required")
		return
	}

	// Default is_active to true if not specified
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// Convert attributes
	attributes := make([]services.SKUAttributeRequest, len(req.Attributes))
	for i, attr := range req.Attributes {
		attributes[i] = services.SKUAttributeRequest{
			Name:  strings.TrimSpace(attr.Name),
			Value: strings.TrimSpace(attr.Value),
		}
	}

	createReq := &services.CreateSKURequest{
		SKUCode:    skuCode,
		Price:      decimal.NewFromFloat(req.Price),
		Inventory:  req.Inventory,
		ImageURL:   req.ImageURL,
		IsActive:   isActive,
		Attributes: attributes,
	}

	sku, err := h.skuService.CreateSKU(c.Request.Context(), uint(productID), createReq)
	if err != nil {
		if strings.Contains(err.Error(), "invalid product") {
			response.NotFound(c, "Product not found", err.Error())
			return
		}
		if strings.Contains(err.Error(), "attribute combination already exists") {
			response.Conflict(c, "SKU with this attribute combination already exists", err.Error())
			return
		}
		response.InternalError(c, "Failed to create SKU", err.Error())
		return
	}

	response.Created(c, sku)
}

// UpdateSKU handles PUT /api/v1/admin/skus/:id
func (h *ProductHandler) UpdateSKU(c *gin.Context) {
	// Parse SKU ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid SKU ID", err.Error())
		return
	}

	var req AdminUpdateSKURequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Validate SKU code if provided
	if req.SKUCode != nil {
		code := strings.TrimSpace(*req.SKUCode)
		if code == "" {
			response.BadRequest(c, "SKU code cannot be empty")
			return
		}
		req.SKUCode = &code
	}

	// Build update request
	updateReq := &services.UpdateSKURequest{
		SKUCode:  req.SKUCode,
		IsActive: req.IsActive,
		ImageURL: req.ImageURL,
	}

	if req.Price != nil {
		price := decimal.NewFromFloat(*req.Price)
		updateReq.Price = &price
	}

	if req.Inventory != nil {
		updateReq.Inventory = req.Inventory
	}

	if req.Attributes != nil {
		attributes := make([]services.SKUAttributeRequest, len(*req.Attributes))
		for i, attr := range *req.Attributes {
			attributes[i] = services.SKUAttributeRequest{
				Name:  strings.TrimSpace(attr.Name),
				Value: strings.TrimSpace(attr.Value),
			}
		}
		updateReq.Attributes = &attributes
	}

	if err := h.skuService.UpdateSKU(c.Request.Context(), uint(id), updateReq); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "SKU not found", err.Error())
			return
		}
		if strings.Contains(err.Error(), "attribute combination already exists") {
			response.Conflict(c, "SKU with this attribute combination already exists", err.Error())
			return
		}
		response.InternalError(c, "Failed to update SKU", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "SKU updated successfully"})
}

// DeleteSKU handles DELETE /api/v1/admin/skus/:id
func (h *ProductHandler) DeleteSKU(c *gin.Context) {
	// Parse SKU ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid SKU ID", err.Error())
		return
	}

	if err := h.skuService.DeleteSKU(c.Request.Context(), uint(id)); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "SKU not found", err.Error())
			return
		}
		if strings.Contains(err.Error(), "pending orders") {
			response.Conflict(c, "Cannot delete SKU with pending orders", err.Error())
			return
		}
		response.InternalError(c, "Failed to delete SKU", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "SKU deleted successfully"})
}
