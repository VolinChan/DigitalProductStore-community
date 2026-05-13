package services

import (
	"context"
	"fmt"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/digital-store/backend/internal/models"
)

// MockSKURepository is a mock implementation of SKURepository
type MockSKURepository struct {
	mock.Mock
}

func (m *MockSKURepository) Create(ctx context.Context, sku *models.SKU) error {
	args := m.Called(ctx, sku)
	return args.Error(0)
}

func (m *MockSKURepository) GetByID(ctx context.Context, id uint) (*models.SKU, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.SKU), args.Error(1)
}

func (m *MockSKURepository) GetBySKUCode(ctx context.Context, skuCode string) (*models.SKU, error) {
	args := m.Called(ctx, skuCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.SKU), args.Error(1)
}

func (m *MockSKURepository) ListByProductID(ctx context.Context, productID uint) ([]*models.SKU, error) {
	args := m.Called(ctx, productID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.SKU), args.Error(1)
}

func (m *MockSKURepository) Update(ctx context.Context, sku *models.SKU) error {
	args := m.Called(ctx, sku)
	return args.Error(0)
}

func (m *MockSKURepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockSKURepository) CheckAvailability(ctx context.Context, id uint, quantity int) (bool, error) {
	args := m.Called(ctx, id, quantity)
	return args.Bool(0), args.Error(1)
}

func (m *MockSKURepository) GetWithAttributes(ctx context.Context, id uint) (*models.SKU, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.SKU), args.Error(1)
}

func (m *MockSKURepository) CheckUniqueAttributes(ctx context.Context, productID uint, attributes []models.SKUAttribute, excludeSKUID *uint) (bool, error) {
	args := m.Called(ctx, productID, attributes, excludeSKUID)
	return args.Bool(0), args.Error(1)
}

func (m *MockSKURepository) DecrementInventory(ctx context.Context, skuID uint, quantity int) error {
	args := m.Called(ctx, skuID, quantity)
	return args.Error(0)
}

func (m *MockSKURepository) IncrementInventory(ctx context.Context, skuID uint, quantity int) error {
	args := m.Called(ctx, skuID, quantity)
	return args.Error(0)
}

// TestSKUService_CreateSKU tests SKU creation
func TestSKUService_CreateSKU(t *testing.T) {
	mockSKURepo := new(MockSKURepository)
	mockProductRepo := new(MockProductRepository)

	service := NewSKUService(mockSKURepo, mockProductRepo)

	t.Run("successful SKU creation", func(t *testing.T) {
		product := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Test Product",
			IsActive:       true,
		}

		req := &CreateSKURequest{
			SKUCode:   "SKU-001",
			Price:     decimal.NewFromFloat(99.99),
			Inventory: 100,
			ImageURL:  "https://example.com/image.jpg",
			IsActive:  true,
			Attributes: []SKUAttributeRequest{
				{Name: "Color", Value: "Red"},
				{Name: "Size", Value: "Large"},
			},
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(1)).Return(product, nil).Once()
		mockSKURepo.On("CheckUniqueAttributes", mock.Anything, uint(1), mock.AnythingOfType("[]models.SKUAttribute"), (*uint)(nil)).
			Return(true, nil).Once()
		mockSKURepo.On("Create", mock.Anything, mock.AnythingOfType("*models.SKU")).Return(nil).Once()

		sku, err := service.CreateSKU(context.Background(), 1, req)

		assert.NoError(t, err)
		assert.NotNil(t, sku)
		assert.Equal(t, "SKU-001", sku.SKUCode)
		assert.Equal(t, decimal.NewFromFloat(99.99), sku.Price)
		assert.Equal(t, 100, sku.Inventory)
		assert.True(t, sku.IsActive)
		mockProductRepo.AssertExpectations(t)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("SKU creation with invalid product", func(t *testing.T) {
		req := &CreateSKURequest{
			SKUCode:   "SKU-001",
			Price:     decimal.NewFromFloat(99.99),
			Inventory: 100,
			IsActive:  true,
			Attributes: []SKUAttributeRequest{
				{Name: "Color", Value: "Red"},
			},
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(999)).Return(nil, fmt.Errorf("product not found")).Once()

		sku, err := service.CreateSKU(context.Background(), 999, req)

		assert.Error(t, err)
		assert.Nil(t, sku)
		assert.Contains(t, err.Error(), "invalid product")
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("SKU creation with duplicate attributes", func(t *testing.T) {
		product := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Test Product",
			IsActive:       true,
		}

		req := &CreateSKURequest{
			SKUCode:   "SKU-002",
			Price:     decimal.NewFromFloat(99.99),
			Inventory: 100,
			IsActive:  true,
			Attributes: []SKUAttributeRequest{
				{Name: "Color", Value: "Red"},
				{Name: "Size", Value: "Large"},
			},
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(1)).Return(product, nil).Once()
		mockSKURepo.On("CheckUniqueAttributes", mock.Anything, uint(1), mock.AnythingOfType("[]models.SKUAttribute"), (*uint)(nil)).
			Return(false, nil).Once()

		sku, err := service.CreateSKU(context.Background(), 1, req)

		assert.Error(t, err)
		assert.Nil(t, sku)
		assert.Contains(t, err.Error(), "attribute combination already exists")
		mockProductRepo.AssertExpectations(t)
		mockSKURepo.AssertExpectations(t)
	})
}

// TestSKUService_GetSKU tests retrieving a SKU by ID
func TestSKUService_GetSKU(t *testing.T) {
	mockSKURepo := new(MockSKURepository)
	mockProductRepo := new(MockProductRepository)

	service := NewSKUService(mockSKURepo, mockProductRepo)

	t.Run("successful SKU retrieval", func(t *testing.T) {
		expectedSKU := &models.SKU{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			ProductID:      1,
			SKUCode:        "SKU-001",
			Price:          decimal.NewFromFloat(99.99),
			Inventory:      100,
			IsActive:       true,
		}

		mockSKURepo.On("GetByID", mock.Anything, uint(1)).Return(expectedSKU, nil).Once()

		sku, err := service.GetSKU(context.Background(), 1)

		assert.NoError(t, err)
		assert.NotNil(t, sku)
		assert.Equal(t, uint(1), sku.ID)
		assert.Equal(t, "SKU-001", sku.SKUCode)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("SKU not found", func(t *testing.T) {
		mockSKURepo.On("GetByID", mock.Anything, uint(999)).Return(nil, fmt.Errorf("SKU not found")).Once()

		sku, err := service.GetSKU(context.Background(), 999)

		assert.Error(t, err)
		assert.Nil(t, sku)
		mockSKURepo.AssertExpectations(t)
	})
}

// TestSKUService_GetSKUWithAttributes tests retrieving SKU with attributes
func TestSKUService_GetSKUWithAttributes(t *testing.T) {
	mockSKURepo := new(MockSKURepository)
	mockProductRepo := new(MockProductRepository)

	service := NewSKUService(mockSKURepo, mockProductRepo)

	t.Run("successful SKU retrieval with attributes", func(t *testing.T) {
		expectedSKU := &models.SKU{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			ProductID:      1,
			SKUCode:        "SKU-001",
			Price:          decimal.NewFromFloat(99.99),
			Inventory:      100,
			IsActive:       true,
			Attributes: []*models.SKUAttribute{
				{Base: models.Base{ID: 1}, SKUID: 1, Name: "Color", Value: "Red"},
				{Base: models.Base{ID: 2}, SKUID: 1, Name: "Size", Value: "Large"},
			},
		}

		mockSKURepo.On("GetWithAttributes", mock.Anything, uint(1)).Return(expectedSKU, nil).Once()

		sku, err := service.GetSKUWithAttributes(context.Background(), 1)

		assert.NoError(t, err)
		assert.NotNil(t, sku)
		assert.Equal(t, 2, len(sku.Attributes))
		assert.Equal(t, "Color", sku.Attributes[0].Name)
		assert.Equal(t, "Red", sku.Attributes[0].Value)
		mockSKURepo.AssertExpectations(t)
	})
}

// TestSKUService_ListSKUsByProduct tests listing SKUs by product
func TestSKUService_ListSKUsByProduct(t *testing.T) {
	mockSKURepo := new(MockSKURepository)
	mockProductRepo := new(MockProductRepository)

	service := NewSKUService(mockSKURepo, mockProductRepo)

	t.Run("successful SKU listing", func(t *testing.T) {
		product := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Test Product",
			IsActive:       true,
		}

		skus := []*models.SKU{
			{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, ProductID: 1, SKUCode: "SKU-001", Price: decimal.NewFromFloat(99.99), IsActive: true},
			{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, ProductID: 1, SKUCode: "SKU-002", Price: decimal.NewFromFloat(89.99), IsActive: true},
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(1)).Return(product, nil).Once()
		mockSKURepo.On("ListByProductID", mock.Anything, uint(1)).Return(skus, nil).Once()

		result, err := service.ListSKUsByProduct(context.Background(), 1)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 2, len(result))
		mockProductRepo.AssertExpectations(t)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("list SKUs for invalid product", func(t *testing.T) {
		mockProductRepo.On("GetByID", mock.Anything, uint(999)).Return(nil, fmt.Errorf("product not found")).Once()

		result, err := service.ListSKUsByProduct(context.Background(), 999)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "invalid product")
		mockProductRepo.AssertExpectations(t)
	})
}

// TestSKUService_UpdateSKU tests updating a SKU
func TestSKUService_UpdateSKU(t *testing.T) {
	mockSKURepo := new(MockSKURepository)
	mockProductRepo := new(MockProductRepository)

	service := NewSKUService(mockSKURepo, mockProductRepo)

	t.Run("successful SKU update", func(t *testing.T) {
		existingSKU := &models.SKU{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			ProductID:      1,
			SKUCode:        "SKU-001",
			Price:          decimal.NewFromFloat(99.99),
			Inventory:      100,
			IsActive:       true,
			Attributes: []*models.SKUAttribute{
				{Base: models.Base{ID: 1}, SKUID: 1, Name: "Color", Value: "Red"},
			},
		}

		newPrice := decimal.NewFromFloat(89.99)
		newInventory := 150
		req := &UpdateSKURequest{
			Price:     &newPrice,
			Inventory: &newInventory,
		}

		mockSKURepo.On("GetWithAttributes", mock.Anything, uint(1)).Return(existingSKU, nil).Once()
		mockSKURepo.On("Update", mock.Anything, mock.MatchedBy(func(s *models.SKU) bool {
			return s.Price.Equal(decimal.NewFromFloat(89.99)) && s.Inventory == 150
		})).Return(nil).Once()

		err := service.UpdateSKU(context.Background(), 1, req)

		assert.NoError(t, err)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("update SKU with new attributes", func(t *testing.T) {
		existingSKU := &models.SKU{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			ProductID:      1,
			SKUCode:        "SKU-001",
			Price:          decimal.NewFromFloat(99.99),
			Inventory:      100,
			IsActive:       true,
			Attributes: []*models.SKUAttribute{
				{Base: models.Base{ID: 1}, SKUID: 1, Name: "Color", Value: "Red"},
			},
		}

		newAttributes := []SKUAttributeRequest{
			{Name: "Color", Value: "Blue"},
		}
		req := &UpdateSKURequest{
			Attributes: &newAttributes,
		}

		mockSKURepo.On("GetWithAttributes", mock.Anything, uint(1)).Return(existingSKU, nil).Once()
		mockSKURepo.On("CheckUniqueAttributes", mock.Anything, uint(1), mock.AnythingOfType("[]models.SKUAttribute"), uintPtr(1)).
			Return(true, nil).Once()
		mockSKURepo.On("Update", mock.Anything, mock.AnythingOfType("*models.SKU")).Return(nil).Once()

		err := service.UpdateSKU(context.Background(), 1, req)

		assert.NoError(t, err)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("update SKU with duplicate attributes", func(t *testing.T) {
		existingSKU := &models.SKU{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			ProductID:      1,
			SKUCode:        "SKU-001",
			Price:          decimal.NewFromFloat(99.99),
			Inventory:      100,
			IsActive:       true,
			Attributes: []*models.SKUAttribute{
				{Base: models.Base{ID: 1}, SKUID: 1, Name: "Color", Value: "Red"},
			},
		}

		newAttributes := []SKUAttributeRequest{
			{Name: "Color", Value: "Blue"},
		}
		req := &UpdateSKURequest{
			Attributes: &newAttributes,
		}

		mockSKURepo.On("GetWithAttributes", mock.Anything, uint(1)).Return(existingSKU, nil).Once()
		mockSKURepo.On("CheckUniqueAttributes", mock.Anything, uint(1), mock.AnythingOfType("[]models.SKUAttribute"), uintPtr(1)).
			Return(false, nil).Once()

		err := service.UpdateSKU(context.Background(), 1, req)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "attribute combination already exists")
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("update non-existent SKU", func(t *testing.T) {
		req := &UpdateSKURequest{
			Price: decimalPtr(decimal.NewFromFloat(89.99)),
		}

		mockSKURepo.On("GetWithAttributes", mock.Anything, uint(999)).Return(nil, fmt.Errorf("SKU not found")).Once()

		err := service.UpdateSKU(context.Background(), 999, req)

		assert.Error(t, err)
		mockSKURepo.AssertExpectations(t)
	})
}

// TestSKUService_DeleteSKU tests deleting a SKU
func TestSKUService_DeleteSKU(t *testing.T) {
	mockSKURepo := new(MockSKURepository)
	mockProductRepo := new(MockProductRepository)

	service := NewSKUService(mockSKURepo, mockProductRepo)

	t.Run("successful SKU deletion", func(t *testing.T) {
		mockSKURepo.On("Delete", mock.Anything, uint(1)).Return(nil).Once()

		err := service.DeleteSKU(context.Background(), 1)

		assert.NoError(t, err)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("delete SKU with pending orders", func(t *testing.T) {
		mockSKURepo.On("Delete", mock.Anything, uint(1)).
			Return(fmt.Errorf("cannot delete SKU with pending orders")).Once()

		err := service.DeleteSKU(context.Background(), 1)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "pending orders")
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("delete non-existent SKU", func(t *testing.T) {
		mockSKURepo.On("Delete", mock.Anything, uint(999)).
			Return(fmt.Errorf("SKU not found")).Once()

		err := service.DeleteSKU(context.Background(), 999)

		assert.Error(t, err)
		mockSKURepo.AssertExpectations(t)
	})
}

// TestSKUService_CheckSKUAvailability tests checking SKU availability
func TestSKUService_CheckSKUAvailability(t *testing.T) {
	mockSKURepo := new(MockSKURepository)
	mockProductRepo := new(MockProductRepository)

	service := NewSKUService(mockSKURepo, mockProductRepo)

	t.Run("SKU is available", func(t *testing.T) {
		mockSKURepo.On("CheckAvailability", mock.Anything, uint(1), 10).Return(true, nil).Once()

		available, err := service.CheckSKUAvailability(context.Background(), 1, 10)

		assert.NoError(t, err)
		assert.True(t, available)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("SKU is not available", func(t *testing.T) {
		mockSKURepo.On("CheckAvailability", mock.Anything, uint(1), 1000).Return(false, nil).Once()

		available, err := service.CheckSKUAvailability(context.Background(), 1, 1000)

		assert.NoError(t, err)
		assert.False(t, available)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("check availability for non-existent SKU", func(t *testing.T) {
		mockSKURepo.On("CheckAvailability", mock.Anything, uint(999), 10).
			Return(false, fmt.Errorf("SKU not found")).Once()

		available, err := service.CheckSKUAvailability(context.Background(), 999, 10)

		assert.Error(t, err)
		assert.False(t, available)
		mockSKURepo.AssertExpectations(t)
	})

	t.Run("check availability with zero quantity", func(t *testing.T) {
		mockSKURepo.On("CheckAvailability", mock.Anything, uint(1), 0).Return(true, nil).Once()

		available, err := service.CheckSKUAvailability(context.Background(), 1, 0)

		assert.NoError(t, err)
		assert.True(t, available)
		mockSKURepo.AssertExpectations(t)
	})
}

// Helper functions
func uintPtr(u uint) *uint {
	return &u
}

func decimalPtr(d decimal.Decimal) *decimal.Decimal {
	return &d
}
