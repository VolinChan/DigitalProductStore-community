package services

import (
	"context"
	"fmt"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// MockProductRepository is a mock implementation of ProductRepository
type MockProductRepository struct {
	mock.Mock
}

func (m *MockProductRepository) Create(ctx context.Context, product *models.Product) error {
	args := m.Called(ctx, product)
	return args.Error(0)
}

func (m *MockProductRepository) GetByID(ctx context.Context, id uint) (*models.Product, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Product), args.Error(1)
}

func (m *MockProductRepository) List(ctx context.Context, params *repositories.ListProductParams) ([]*models.Product, int64, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*models.Product), args.Get(1).(int64), args.Error(2)
}

func (m *MockProductRepository) Update(ctx context.Context, product *models.Product) error {
	args := m.Called(ctx, product)
	return args.Error(0)
}

func (m *MockProductRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockProductRepository) Search(ctx context.Context, query string, params *repositories.ListProductParams) ([]*models.Product, int64, error) {
	args := m.Called(ctx, query, params)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*models.Product), args.Get(1).(int64), args.Error(2)
}

func (m *MockProductRepository) GetWithDetails(ctx context.Context, id uint) (*models.Product, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Product), args.Error(1)
}

func (m *MockProductRepository) ListByCategoryID(ctx context.Context, categoryID uint, params *repositories.ListProductParams) ([]*models.Product, int64, error) {
	args := m.Called(ctx, categoryID, params)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*models.Product), args.Get(1).(int64), args.Error(2)
}

// MockCategoryRepository is a mock implementation of CategoryRepository
type MockCategoryRepository struct {
	mock.Mock
}

func (m *MockCategoryRepository) Create(ctx context.Context, category *models.Category) error {
	args := m.Called(ctx, category)
	return args.Error(0)
}

func (m *MockCategoryRepository) GetByID(ctx context.Context, id uint) (*models.Category, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Category), args.Error(1)
}

func (m *MockCategoryRepository) GetBySlug(ctx context.Context, slug string) (*models.Category, error) {
	args := m.Called(ctx, slug)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Category), args.Error(1)
}

func (m *MockCategoryRepository) List(ctx context.Context) ([]*models.Category, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Category), args.Error(1)
}

func (m *MockCategoryRepository) ListByParent(ctx context.Context, parentID *uint) ([]*models.Category, error) {
	args := m.Called(ctx, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Category), args.Error(1)
}

func (m *MockCategoryRepository) Update(ctx context.Context, category *models.Category) error {
	args := m.Called(ctx, category)
	return args.Error(0)
}

func (m *MockCategoryRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCategoryRepository) GetWithChildren(ctx context.Context, id uint) (*models.Category, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Category), args.Error(1)
}

// setupTestRedis creates a test Redis client using miniredis
func setupTestRedis(t *testing.T) *redis.Client {
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	return client
}

// TestProductService_CreateProduct tests product creation
func TestProductService_CreateProduct(t *testing.T) {
	mockProductRepo := new(MockProductRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	redisClient := setupTestRedis(t)

	service := NewProductService(mockProductRepo, mockCategoryRepo, redisClient)

	t.Run("successful product creation without category", func(t *testing.T) {
		req := &CreateProductRequest{
			Name:           "Test Product",
			Description:    "Test Description",
			CategoryID:     nil,
			Specifications: `{"color": "red"}`,
			IsActive:       true,
		}

		mockProductRepo.On("Create", mock.Anything, mock.AnythingOfType("*models.Product")).Return(nil).Once()

		product, err := service.CreateProduct(context.Background(), req)

		assert.NoError(t, err)
		assert.NotNil(t, product)
		assert.Equal(t, "Test Product", product.Name)
		assert.Equal(t, "Test Description", product.Description)
		assert.True(t, product.IsActive)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("successful product creation with valid category", func(t *testing.T) {
		categoryID := uint(1)
		req := &CreateProductRequest{
			Name:        "Test Product",
			Description: "Test Description",
			CategoryID:  &categoryID,
			IsActive:    true,
		}

		category := &models.Category{
			Base: models.Base{ID: 1},
			Name: "Electronics",
			Slug: "electronics",
		}

		mockCategoryRepo.On("GetByID", mock.Anything, uint(1)).Return(category, nil).Once()
		mockProductRepo.On("Create", mock.Anything, mock.AnythingOfType("*models.Product")).Return(nil).Once()

		product, err := service.CreateProduct(context.Background(), req)

		assert.NoError(t, err)
		assert.NotNil(t, product)
		assert.Equal(t, uint(1), *product.CategoryID)
		mockCategoryRepo.AssertExpectations(t)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("product creation with invalid category", func(t *testing.T) {
		categoryID := uint(999)
		req := &CreateProductRequest{
			Name:        "Test Product",
			Description: "Test Description",
			CategoryID:  &categoryID,
			IsActive:    true,
		}

		mockCategoryRepo.On("GetByID", mock.Anything, uint(999)).Return(nil, fmt.Errorf("category not found")).Once()

		product, err := service.CreateProduct(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, product)
		assert.Contains(t, err.Error(), "invalid category")
		mockCategoryRepo.AssertExpectations(t)
	})
}

// TestProductService_GetProduct tests retrieving a product by ID
func TestProductService_GetProduct(t *testing.T) {
	mockProductRepo := new(MockProductRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	redisClient := setupTestRedis(t)

	service := NewProductService(mockProductRepo, mockCategoryRepo, redisClient)

	t.Run("successful product retrieval", func(t *testing.T) {
		expectedProduct := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Test Product",
			Description:    "Test Description",
			IsActive:       true,
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(1)).Return(expectedProduct, nil).Once()

		product, err := service.GetProduct(context.Background(), 1)

		assert.NoError(t, err)
		assert.NotNil(t, product)
		assert.Equal(t, uint(1), product.ID)
		assert.Equal(t, "Test Product", product.Name)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("product not found", func(t *testing.T) {
		mockProductRepo.On("GetByID", mock.Anything, uint(999)).Return(nil, fmt.Errorf("product not found")).Once()

		product, err := service.GetProduct(context.Background(), 999)

		assert.Error(t, err)
		assert.Nil(t, product)
		mockProductRepo.AssertExpectations(t)
	})
}

// TestProductService_GetProductWithDetails tests retrieving product with details
func TestProductService_GetProductWithDetails(t *testing.T) {
	mockProductRepo := new(MockProductRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	redisClient := setupTestRedis(t)

	service := NewProductService(mockProductRepo, mockCategoryRepo, redisClient)

	t.Run("successful retrieval from database (cache miss)", func(t *testing.T) {
		expectedProduct := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Test Product",
			Description:    "Test Description",
			IsActive:       true,
		}

		mockProductRepo.On("GetWithDetails", mock.Anything, uint(1)).Return(expectedProduct, nil).Once()

		product, err := service.GetProductWithDetails(context.Background(), 1)

		assert.NoError(t, err)
		assert.NotNil(t, product)
		assert.Equal(t, uint(1), product.ID)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("product not found", func(t *testing.T) {
		mockProductRepo.On("GetWithDetails", mock.Anything, uint(999)).Return(nil, fmt.Errorf("product not found")).Once()

		product, err := service.GetProductWithDetails(context.Background(), 999)

		assert.Error(t, err)
		assert.Nil(t, product)
		mockProductRepo.AssertExpectations(t)
	})
}

// TestProductService_ListProducts tests listing products with pagination
func TestProductService_ListProducts(t *testing.T) {
	mockProductRepo := new(MockProductRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	redisClient := setupTestRedis(t)

	service := NewProductService(mockProductRepo, mockCategoryRepo, redisClient)

	t.Run("successful product listing with defaults", func(t *testing.T) {
		req := &ListProductsRequest{
			Page:     1,
			PageSize: 20,
		}

		products := []*models.Product{
			{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Name: "Product 1", IsActive: true},
			{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, Name: "Product 2", IsActive: true},
		}

		mockProductRepo.On("List", mock.Anything, mock.AnythingOfType("*repositories.ListProductParams")).
			Return(products, int64(2), nil).Once()

		response, err := service.ListProducts(context.Background(), req)

		assert.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, 2, len(response.Products))
		assert.Equal(t, int64(2), response.Total)
		assert.Equal(t, 1, response.Page)
		assert.Equal(t, 20, response.PageSize)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("product listing with category filter", func(t *testing.T) {
		categoryID := uint(1)
		req := &ListProductsRequest{
			Page:       1,
			PageSize:   10,
			CategoryID: &categoryID,
		}

		products := []*models.Product{
			{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Name: "Product 1", CategoryID: &categoryID, IsActive: true},
		}

		mockProductRepo.On("List", mock.Anything, mock.AnythingOfType("*repositories.ListProductParams")).
			Return(products, int64(1), nil).Once()

		response, err := service.ListProducts(context.Background(), req)

		assert.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, 1, len(response.Products))
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("product listing with pagination", func(t *testing.T) {
		req := &ListProductsRequest{
			Page:     2,
			PageSize: 10,
		}

		products := []*models.Product{
			{BaseWithUpdate: models.BaseWithUpdate{ID: 11}, Name: "Product 11", IsActive: true},
		}

		mockProductRepo.On("List", mock.Anything, mock.MatchedBy(func(params *repositories.ListProductParams) bool {
			return params.Offset == 10 && params.Limit == 10
		})).Return(products, int64(15), nil).Once()

		response, err := service.ListProducts(context.Background(), req)

		assert.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, 2, response.Page)
		assert.Equal(t, int64(15), response.Total)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("product listing with sorting", func(t *testing.T) {
		req := &ListProductsRequest{
			Page:      1,
			PageSize:  10,
			SortBy:    "name",
			SortOrder: "asc",
		}

		products := []*models.Product{
			{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Name: "A Product", IsActive: true},
			{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, Name: "B Product", IsActive: true},
		}

		mockProductRepo.On("List", mock.Anything, mock.MatchedBy(func(params *repositories.ListProductParams) bool {
			return params.SortBy == "name" && params.SortOrder == "asc"
		})).Return(products, int64(2), nil).Once()

		response, err := service.ListProducts(context.Background(), req)

		assert.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, "A Product", response.Products[0].Name)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("product listing with page size limit", func(t *testing.T) {
		req := &ListProductsRequest{
			Page:     1,
			PageSize: 150, // Exceeds max of 100
		}

		mockProductRepo.On("List", mock.Anything, mock.MatchedBy(func(params *repositories.ListProductParams) bool {
			return params.Limit == 100 // Should be capped at 100
		})).Return([]*models.Product{}, int64(0), nil).Once()

		response, err := service.ListProducts(context.Background(), req)

		assert.NoError(t, err)
		assert.Equal(t, 100, response.PageSize)
		mockProductRepo.AssertExpectations(t)
	})
}

// TestProductService_UpdateProduct tests updating a product
func TestProductService_UpdateProduct(t *testing.T) {
	mockProductRepo := new(MockProductRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	redisClient := setupTestRedis(t)

	service := NewProductService(mockProductRepo, mockCategoryRepo, redisClient)

	t.Run("successful product update", func(t *testing.T) {
		existingProduct := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Old Name",
			Description:    "Old Description",
			IsActive:       true,
		}

		newName := "New Name"
		newDescription := "New Description"
		req := &UpdateProductRequest{
			Name:        &newName,
			Description: &newDescription,
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(1)).Return(existingProduct, nil).Once()
		mockProductRepo.On("Update", mock.Anything, mock.MatchedBy(func(p *models.Product) bool {
			return p.Name == "New Name" && p.Description == "New Description"
		})).Return(nil).Once()

		err := service.UpdateProduct(context.Background(), 1, req)

		assert.NoError(t, err)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("update product with new category", func(t *testing.T) {
		existingProduct := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Test Product",
			CategoryID:     nil,
			IsActive:       true,
		}

		newCategoryID := uint(2)
		req := &UpdateProductRequest{
			CategoryID: &newCategoryID,
		}

		category := &models.Category{
			Base: models.Base{ID: 2},
			Name: "New Category",
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(1)).Return(existingProduct, nil).Once()
		mockCategoryRepo.On("GetByID", mock.Anything, uint(2)).Return(category, nil).Once()
		mockProductRepo.On("Update", mock.Anything, mock.MatchedBy(func(p *models.Product) bool {
			return *p.CategoryID == uint(2)
		})).Return(nil).Once()

		err := service.UpdateProduct(context.Background(), 1, req)

		assert.NoError(t, err)
		mockCategoryRepo.AssertExpectations(t)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("update product with invalid category", func(t *testing.T) {
		existingProduct := &models.Product{
			BaseWithUpdate: models.BaseWithUpdate{ID: 1},
			Name:           "Test Product",
			IsActive:       true,
		}

		invalidCategoryID := uint(999)
		req := &UpdateProductRequest{
			CategoryID: &invalidCategoryID,
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(1)).Return(existingProduct, nil).Once()
		mockCategoryRepo.On("GetByID", mock.Anything, uint(999)).Return(nil, fmt.Errorf("category not found")).Once()

		err := service.UpdateProduct(context.Background(), 1, req)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid category")
		mockProductRepo.AssertExpectations(t)
		mockCategoryRepo.AssertExpectations(t)
	})

	t.Run("update non-existent product", func(t *testing.T) {
		req := &UpdateProductRequest{
			Name: stringPtr("New Name"),
		}

		mockProductRepo.On("GetByID", mock.Anything, uint(999)).Return(nil, fmt.Errorf("product not found")).Once()

		err := service.UpdateProduct(context.Background(), 999, req)

		assert.Error(t, err)
		mockProductRepo.AssertExpectations(t)
	})
}

// TestProductService_DeleteProduct tests deleting a product
func TestProductService_DeleteProduct(t *testing.T) {
	mockProductRepo := new(MockProductRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	redisClient := setupTestRedis(t)

	service := NewProductService(mockProductRepo, mockCategoryRepo, redisClient)

	t.Run("successful product deletion", func(t *testing.T) {
		mockProductRepo.On("Delete", mock.Anything, uint(1)).Return(nil).Once()

		err := service.DeleteProduct(context.Background(), 1)

		assert.NoError(t, err)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("delete product with pending orders", func(t *testing.T) {
		mockProductRepo.On("Delete", mock.Anything, uint(1)).
			Return(fmt.Errorf("cannot delete product with pending orders")).Once()

		err := service.DeleteProduct(context.Background(), 1)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "pending orders")
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("delete non-existent product", func(t *testing.T) {
		mockProductRepo.On("Delete", mock.Anything, uint(999)).
			Return(fmt.Errorf("product not found")).Once()

		err := service.DeleteProduct(context.Background(), 999)

		assert.Error(t, err)
		mockProductRepo.AssertExpectations(t)
	})
}

// TestProductService_SearchProducts tests product search functionality
func TestProductService_SearchProducts(t *testing.T) {
	mockProductRepo := new(MockProductRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	redisClient := setupTestRedis(t)

	service := NewProductService(mockProductRepo, mockCategoryRepo, redisClient)

	t.Run("successful product search", func(t *testing.T) {
		req := &ListProductsRequest{
			Page:     1,
			PageSize: 20,
		}

		products := []*models.Product{
			{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Name: "Laptop Computer", Description: "High performance laptop", IsActive: true},
			{BaseWithUpdate: models.BaseWithUpdate{ID: 2}, Name: "Desktop Computer", Description: "Gaming desktop", IsActive: true},
		}

		mockProductRepo.On("Search", mock.Anything, "computer", mock.AnythingOfType("*repositories.ListProductParams")).
			Return(products, int64(2), nil).Once()

		response, err := service.SearchProducts(context.Background(), "computer", req)

		assert.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, 2, len(response.Products))
		assert.Equal(t, int64(2), response.Total)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("search with no results", func(t *testing.T) {
		req := &ListProductsRequest{
			Page:     1,
			PageSize: 20,
		}

		mockProductRepo.On("Search", mock.Anything, "nonexistent", mock.AnythingOfType("*repositories.ListProductParams")).
			Return([]*models.Product{}, int64(0), nil).Once()

		response, err := service.SearchProducts(context.Background(), "nonexistent", req)

		assert.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, 0, len(response.Products))
		assert.Equal(t, int64(0), response.Total)
		mockProductRepo.AssertExpectations(t)
	})

	t.Run("search with category filter", func(t *testing.T) {
		categoryID := uint(1)
		req := &ListProductsRequest{
			Page:       1,
			PageSize:   20,
			CategoryID: &categoryID,
		}

		products := []*models.Product{
			{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, Name: "Laptop", CategoryID: &categoryID, IsActive: true},
		}

		mockProductRepo.On("Search", mock.Anything, "laptop", mock.MatchedBy(func(params *repositories.ListProductParams) bool {
			return params.CategoryID != nil && *params.CategoryID == uint(1)
		})).Return(products, int64(1), nil).Once()

		response, err := service.SearchProducts(context.Background(), "laptop", req)

		assert.NoError(t, err)
		assert.Equal(t, 1, len(response.Products))
		mockProductRepo.AssertExpectations(t)
	})
}

// Helper function
func stringPtr(s string) *string {
	return &s
}
