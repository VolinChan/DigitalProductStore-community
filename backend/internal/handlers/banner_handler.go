package handlers

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/pkg/response"
)

// BannerHandler handles banner management HTTP requests.
// It provides endpoints for creating, updating, deleting, and listing banners
// (Requirements 25.1-25.8).
type BannerHandler struct {
	bannerRepo repositories.BannerRepository
}

// NewBannerHandler creates a new BannerHandler.
func NewBannerHandler(bannerRepo repositories.BannerRepository) *BannerHandler {
	return &BannerHandler{bannerRepo: bannerRepo}
}

// CreateBannerRequest represents the request body for creating a banner.
type CreateBannerRequest struct {
	Title       string  `json:"title" binding:"omitempty,max=100"`
	Description string  `json:"description" binding:"omitempty,max=500"`
	ImageURL    string  `json:"image_url" binding:"required,url,max=500"`
	LinkURL     string  `json:"link_url" binding:"omitempty,url,max=500"`
	Priority    *int    `json:"priority"`
	IsActive    *bool   `json:"is_active"`
	StartDate   *string `json:"start_date"`
	EndDate     *string `json:"end_date"`
}

// UpdateBannerRequest represents the request body for updating a banner.
type UpdateBannerRequest struct {
	Title       *string `json:"title" binding:"omitempty,max=100"`
	Description *string `json:"description" binding:"omitempty,max=500"`
	ImageURL    *string `json:"image_url" binding:"omitempty,url,max=500"`
	LinkURL     *string `json:"link_url" binding:"omitempty,max=500"`
	Priority    *int    `json:"priority"`
	IsActive    *bool   `json:"is_active"`
	StartDate   *string `json:"start_date"`
	EndDate     *string `json:"end_date"`
}

// CreateBanner handles POST /api/v1/admin/banners
// Creates a new banner with the provided details.
// Requirement 25.1: create Banner items with image, title, description, and link URL
// Requirement 25.2: set display order using numeric priority values
// Requirement 25.3: set start date and end date for display periods
func (h *BannerHandler) CreateBanner(c *gin.Context) {
	var req CreateBannerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	banner := &models.Banner{
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		ImageURL:    strings.TrimSpace(req.ImageURL),
		LinkURL:     strings.TrimSpace(req.LinkURL),
		IsActive:    true,
	}

	if req.Priority != nil {
		banner.Priority = *req.Priority
	}

	if req.IsActive != nil {
		banner.IsActive = *req.IsActive
	}

	// Parse start_date
	if req.StartDate != nil && *req.StartDate != "" {
		t, err := time.Parse(time.RFC3339, *req.StartDate)
		if err != nil {
			response.BadRequest(c, "Invalid start_date format, use RFC3339 (e.g. 2024-01-01T00:00:00Z)")
			return
		}
		banner.StartDate = &t
	}

	// Parse end_date
	if req.EndDate != nil && *req.EndDate != "" {
		t, err := time.Parse(time.RFC3339, *req.EndDate)
		if err != nil {
			response.BadRequest(c, "Invalid end_date format, use RFC3339 (e.g. 2024-12-31T23:59:59Z)")
			return
		}
		banner.EndDate = &t
	}

	// Validate that end_date is after start_date if both are provided
	if banner.StartDate != nil && banner.EndDate != nil {
		if banner.EndDate.Before(*banner.StartDate) {
			response.BadRequest(c, "end_date must be after start_date")
			return
		}
	}

	if err := h.bannerRepo.Create(c.Request.Context(), banner); err != nil {
		response.InternalError(c, "Failed to create banner", err.Error())
		return
	}

	response.Created(c, banner)
}

// UpdateBanner handles PUT /api/v1/admin/banners/:id
// Updates an existing banner's fields.
// Requirement 25.4: enable or disable Banner items without deletion
func (h *BannerHandler) UpdateBanner(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid banner ID")
		return
	}

	var req UpdateBannerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Get existing banner
	banner, err := h.bannerRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Banner not found")
			return
		}
		response.InternalError(c, "Failed to get banner", err.Error())
		return
	}

	// Update fields if provided
	if req.Title != nil {
		banner.Title = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		banner.Description = strings.TrimSpace(*req.Description)
	}
	if req.ImageURL != nil {
		imageURL := strings.TrimSpace(*req.ImageURL)
		if imageURL == "" {
			response.BadRequest(c, "image_url cannot be empty")
			return
		}
		banner.ImageURL = imageURL
	}
	if req.LinkURL != nil {
		banner.LinkURL = strings.TrimSpace(*req.LinkURL)
	}
	if req.Priority != nil {
		banner.Priority = *req.Priority
	}
	if req.IsActive != nil {
		banner.IsActive = *req.IsActive
	}

	// Parse start_date
	if req.StartDate != nil {
		if *req.StartDate == "" {
			banner.StartDate = nil
		} else {
			t, err := time.Parse(time.RFC3339, *req.StartDate)
			if err != nil {
				response.BadRequest(c, "Invalid start_date format, use RFC3339 (e.g. 2024-01-01T00:00:00Z)")
				return
			}
			banner.StartDate = &t
		}
	}

	// Parse end_date
	if req.EndDate != nil {
		if *req.EndDate == "" {
			banner.EndDate = nil
		} else {
			t, err := time.Parse(time.RFC3339, *req.EndDate)
			if err != nil {
				response.BadRequest(c, "Invalid end_date format, use RFC3339 (e.g. 2024-12-31T23:59:59Z)")
				return
			}
			banner.EndDate = &t
		}
	}

	// Validate that end_date is after start_date if both are set
	if banner.StartDate != nil && banner.EndDate != nil {
		if banner.EndDate.Before(*banner.StartDate) {
			response.BadRequest(c, "end_date must be after start_date")
			return
		}
	}

	if err := h.bannerRepo.Update(c.Request.Context(), banner); err != nil {
		response.InternalError(c, "Failed to update banner", err.Error())
		return
	}

	response.Success(c, banner)
}

// DeleteBanner handles DELETE /api/v1/admin/banners/:id
// Deletes a banner by ID.
func (h *BannerHandler) DeleteBanner(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid banner ID")
		return
	}

	if err := h.bannerRepo.Delete(c.Request.Context(), uint(id)); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Banner not found")
			return
		}
		response.InternalError(c, "Failed to delete banner", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Banner deleted successfully"})
}

// ListBanners handles GET /api/v1/admin/banners
// Returns a paginated list of all banners for admin management.
func (h *BannerHandler) ListBanners(c *gin.Context) {
	page := 1
	perPage := 20

	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if pp := c.Query("per_page"); pp != "" {
		if v, err := strconv.Atoi(pp); err == nil && v > 0 && v <= 100 {
			perPage = v
		}
	}

	banners, total, err := h.bannerRepo.List(c.Request.Context(), page, perPage)
	if err != nil {
		response.InternalError(c, "Failed to list banners", err.Error())
		return
	}

	meta := response.Paginate(page, perPage, total)
	response.SuccessWithMeta(c, gin.H{"banners": banners}, meta)
}

// GetActiveBanners handles GET /api/v1/banners
// Returns active banners for the public frontend, sorted by priority descending.
// Requirement 25.6: display active Banner items sorted by priority descending
// Requirement 25.7: filter by current date within display period
func (h *BannerHandler) GetActiveBanners(c *gin.Context) {
	banners, err := h.bannerRepo.GetActiveBanners(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to get active banners", err.Error())
		return
	}

	response.Success(c, gin.H{"banners": banners})
}
