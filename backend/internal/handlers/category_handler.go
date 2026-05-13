package handlers

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/pkg/response"
)

// CategoryHandler handles category-related HTTP requests
type CategoryHandler struct {
	categoryRepo repositories.CategoryRepository
}

// NewCategoryHandler creates a new category handler
func NewCategoryHandler(categoryRepo repositories.CategoryRepository) *CategoryHandler {
	return &CategoryHandler{
		categoryRepo: categoryRepo,
	}
}

// ListCategories handles GET /api/v1/categories
func (h *CategoryHandler) ListCategories(c *gin.Context) {
	categories, err := h.categoryRepo.List(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to list categories", err.Error())
		return
	}

	response.Success(c, gin.H{
		"categories": categories,
	})
}

// ==================== Admin Category Management Handlers ====================

// AdminCreateCategoryRequest represents the request body for creating a category
type AdminCreateCategoryRequest struct {
	Name      string `json:"name" binding:"required,min=1,max=100"`
	Slug      string `json:"slug" binding:"required,min=1,max=100"`
	ParentID  *uint  `json:"parent_id"`
	SortOrder *int   `json:"sort_order"`
}

// AdminUpdateCategoryRequest represents the request body for updating a category
type AdminUpdateCategoryRequest struct {
	Name      *string `json:"name" binding:"omitempty,min=1,max=100"`
	Slug      *string `json:"slug" binding:"omitempty,min=1,max=100"`
	ParentID  *uint   `json:"parent_id"`
	SortOrder *int    `json:"sort_order"`
}

// CreateCategory handles POST /api/v1/admin/categories
func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	var req AdminCreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Validate name is not empty after trimming
	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "Category name is required")
		return
	}

	// Validate slug is not empty after trimming
	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		response.BadRequest(c, "Category slug is required")
		return
	}

	// If parent_id is provided, verify the parent category exists
	if req.ParentID != nil {
		_, err := h.categoryRepo.GetByID(c.Request.Context(), *req.ParentID)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				response.BadRequest(c, "Parent category not found")
				return
			}
			response.InternalError(c, "Failed to verify parent category", err.Error())
			return
		}
	}

	// Check if slug already exists
	existing, err := h.categoryRepo.GetBySlug(c.Request.Context(), slug)
	if err == nil && existing != nil {
		response.Conflict(c, "Category with this slug already exists")
		return
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	category := &models.Category{
		Name:      name,
		Slug:      slug,
		ParentID:  req.ParentID,
		SortOrder: sortOrder,
	}

	if err := h.categoryRepo.Create(c.Request.Context(), category); err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			response.Conflict(c, "Category with this slug already exists")
			return
		}
		response.InternalError(c, "Failed to create category", err.Error())
		return
	}

	response.Created(c, category)
}

// UpdateCategory handles PUT /api/v1/admin/categories/:id
func (h *CategoryHandler) UpdateCategory(c *gin.Context) {
	// Parse category ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid category ID", err.Error())
		return
	}

	var req AdminUpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Get existing category
	category, err := h.categoryRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Category not found")
			return
		}
		response.InternalError(c, "Failed to get category", err.Error())
		return
	}

	// Update fields if provided
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			response.BadRequest(c, "Category name cannot be empty")
			return
		}
		category.Name = name
	}

	if req.Slug != nil {
		slug := strings.TrimSpace(*req.Slug)
		if slug == "" {
			response.BadRequest(c, "Category slug cannot be empty")
			return
		}
		// Check if slug is taken by another category
		existing, err := h.categoryRepo.GetBySlug(c.Request.Context(), slug)
		if err == nil && existing != nil && existing.ID != uint(id) {
			response.Conflict(c, "Category with this slug already exists")
			return
		}
		category.Slug = slug
	}

	if req.ParentID != nil {
		// Prevent setting self as parent
		if *req.ParentID == uint(id) {
			response.BadRequest(c, "Category cannot be its own parent")
			return
		}
		// Verify parent exists
		_, err := h.categoryRepo.GetByID(c.Request.Context(), *req.ParentID)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				response.BadRequest(c, "Parent category not found")
				return
			}
			response.InternalError(c, "Failed to verify parent category", err.Error())
			return
		}
		category.ParentID = req.ParentID
	}

	if req.SortOrder != nil {
		category.SortOrder = *req.SortOrder
	}

	if err := h.categoryRepo.Update(c.Request.Context(), category); err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			response.Conflict(c, "Category with this slug already exists")
			return
		}
		response.InternalError(c, "Failed to update category", err.Error())
		return
	}

	response.Success(c, category)
}

// DeleteCategory handles DELETE /api/v1/admin/categories/:id
func (h *CategoryHandler) DeleteCategory(c *gin.Context) {
	// Parse category ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid category ID", err.Error())
		return
	}

	// Verify category exists
	_, err = h.categoryRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Category not found")
			return
		}
		response.InternalError(c, "Failed to get category", err.Error())
		return
	}

	// Delete category (repository handles children and product checks)
	if err := h.categoryRepo.Delete(c.Request.Context(), uint(id)); err != nil {
		if strings.Contains(err.Error(), "children") {
			response.Conflict(c, "Cannot delete category with children categories")
			return
		}
		if strings.Contains(err.Error(), "products") {
			response.Conflict(c, "Cannot delete category with associated products")
			return
		}
		response.InternalError(c, "Failed to delete category", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Category deleted successfully"})
}
