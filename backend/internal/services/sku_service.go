package services

import (
	"context"
	"fmt"

	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// SKUService defines the interface for SKU business logic
type SKUService interface {
	CreateSKU(ctx context.Context, productID uint, req *CreateSKURequest) (*models.SKU, error)
	GetSKU(ctx context.Context, id uint) (*models.SKU, error)
	GetSKUWithAttributes(ctx context.Context, id uint) (*models.SKU, error)
	ListSKUsByProduct(ctx context.Context, productID uint) ([]*models.SKU, error)
	UpdateSKU(ctx context.Context, id uint, req *UpdateSKURequest) error
	DeleteSKU(ctx context.Context, id uint) error
	CheckSKUAvailability(ctx context.Context, id uint, quantity int) (bool, error)
}

// CreateSKURequest represents a request to create a SKU
type CreateSKURequest struct {
	SKUCode    string                `json:"sku_code" validate:"required,min=1,max=100"`
	Price      decimal.Decimal       `json:"price" validate:"required,gt=0"`
	Inventory  int                   `json:"inventory" validate:"gte=0"`
	ImageURL   string                `json:"image_url" validate:"omitempty,url,max=500"`
	IsActive   bool                  `json:"is_active"`
	Attributes []SKUAttributeRequest `json:"attributes" validate:"required,min=1"`
}

// UpdateSKURequest represents a request to update a SKU
type UpdateSKURequest struct {
	SKUCode    *string                `json:"sku_code" validate:"omitempty,min=1,max=100"`
	Price      *decimal.Decimal       `json:"price" validate:"omitempty,gt=0"`
	Inventory  *int                   `json:"inventory" validate:"omitempty,gte=0"`
	ImageURL   *string                `json:"image_url" validate:"omitempty,url,max=500"`
	IsActive   *bool                  `json:"is_active"`
	Attributes *[]SKUAttributeRequest `json:"attributes" validate:"omitempty,min=1"`
}

// SKUAttributeRequest represents a SKU attribute in a request
type SKUAttributeRequest struct {
	Name  string `json:"name" validate:"required,min=1,max=50"`
	Value string `json:"value" validate:"required,min=1,max=100"`
}

// skuService implements SKUService
type skuService struct {
	skuRepo     repositories.SKURepository
	productRepo repositories.ProductRepository
}

// NewSKUService creates a new SKU service
func NewSKUService(
	skuRepo repositories.SKURepository,
	productRepo repositories.ProductRepository,
) SKUService {
	return &skuService{
		skuRepo:     skuRepo,
		productRepo: productRepo,
	}
}

// CreateSKU creates a new SKU
func (s *skuService) CreateSKU(ctx context.Context, productID uint, req *CreateSKURequest) (*models.SKU, error) {
	// Validate product exists
	if _, err := s.productRepo.GetByID(ctx, productID); err != nil {
		return nil, fmt.Errorf("invalid product: %w", err)
	}

	// Convert attribute requests to models
	attributes := make([]models.SKUAttribute, len(req.Attributes))
	for i, attr := range req.Attributes {
		attributes[i] = models.SKUAttribute{
			Name:  attr.Name,
			Value: attr.Value,
		}
	}

	// Check if attribute combination is unique
	isUnique, err := s.skuRepo.CheckUniqueAttributes(ctx, productID, attributes, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to check attribute uniqueness: %w", err)
	}
	if !isUnique {
		return nil, fmt.Errorf("SKU with this attribute combination already exists for this product")
	}

	// Create SKU
	sku := &models.SKU{
		ProductID: productID,
		SKUCode:   req.SKUCode,
		Price:     req.Price,
		Inventory: req.Inventory,
		ImageURL:  req.ImageURL,
		IsActive:  req.IsActive,
	}

	if err := s.skuRepo.Create(ctx, sku); err != nil {
		return nil, err
	}

	// Create attributes
	for i := range attributes {
		attributes[i].SKUID = sku.ID
	}
	sku.Attributes = make([]*models.SKUAttribute, len(attributes))
	for i := range attributes {
		sku.Attributes[i] = &attributes[i]
	}

	return sku, nil
}

// GetSKU retrieves a SKU by ID
func (s *skuService) GetSKU(ctx context.Context, id uint) (*models.SKU, error) {
	return s.skuRepo.GetByID(ctx, id)
}

// GetSKUWithAttributes retrieves a SKU with all its attributes
func (s *skuService) GetSKUWithAttributes(ctx context.Context, id uint) (*models.SKU, error) {
	return s.skuRepo.GetWithAttributes(ctx, id)
}

// ListSKUsByProduct retrieves all SKUs for a product
func (s *skuService) ListSKUsByProduct(ctx context.Context, productID uint) ([]*models.SKU, error) {
	// Validate product exists
	if _, err := s.productRepo.GetByID(ctx, productID); err != nil {
		return nil, fmt.Errorf("invalid product: %w", err)
	}

	return s.skuRepo.ListByProductID(ctx, productID)
}

// UpdateSKU updates a SKU
func (s *skuService) UpdateSKU(ctx context.Context, id uint, req *UpdateSKURequest) error {
	// Get existing SKU
	sku, err := s.skuRepo.GetWithAttributes(ctx, id)
	if err != nil {
		return err
	}

	// Update fields
	if req.SKUCode != nil {
		sku.SKUCode = *req.SKUCode
	}
	if req.Price != nil {
		sku.Price = *req.Price
	}
	if req.Inventory != nil {
		sku.Inventory = *req.Inventory
	}
	if req.ImageURL != nil {
		sku.ImageURL = *req.ImageURL
	}
	if req.IsActive != nil {
		sku.IsActive = *req.IsActive
	}

	// Update attributes if provided
	if req.Attributes != nil {
		// Convert attribute requests to models
		attributes := make([]models.SKUAttribute, len(*req.Attributes))
		for i, attr := range *req.Attributes {
			attributes[i] = models.SKUAttribute{
				Name:  attr.Name,
				Value: attr.Value,
			}
		}

		// Check if attribute combination is unique (excluding current SKU)
		isUnique, err := s.skuRepo.CheckUniqueAttributes(ctx, sku.ProductID, attributes, &id)
		if err != nil {
			return fmt.Errorf("failed to check attribute uniqueness: %w", err)
		}
		if !isUnique {
			return fmt.Errorf("SKU with this attribute combination already exists for this product")
		}

		// Note: Updating attributes would require deleting old ones and creating new ones
		// This is a simplified version - in production, you'd handle this in a transaction
	}

	// Save changes
	if err := s.skuRepo.Update(ctx, sku); err != nil {
		return err
	}

	return nil
}

// DeleteSKU deletes a SKU
func (s *skuService) DeleteSKU(ctx context.Context, id uint) error {
	return s.skuRepo.Delete(ctx, id)
}

// CheckSKUAvailability checks if a SKU has sufficient inventory
func (s *skuService) CheckSKUAvailability(ctx context.Context, id uint, quantity int) (bool, error) {
	return s.skuRepo.CheckAvailability(ctx, id, quantity)
}
