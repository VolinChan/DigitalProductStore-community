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

// AnnouncementHandler handles announcement management HTTP requests.
// It provides endpoints for creating, updating, deleting, and listing announcements
// (Requirements 26.1-26.7).
type AnnouncementHandler struct {
	announcementRepo repositories.AnnouncementRepository
}

// NewAnnouncementHandler creates a new AnnouncementHandler.
func NewAnnouncementHandler(announcementRepo repositories.AnnouncementRepository) *AnnouncementHandler {
	return &AnnouncementHandler{announcementRepo: announcementRepo}
}

// CreateAnnouncementRequest represents the request body for creating an announcement.
type CreateAnnouncementRequest struct {
	Title    string  `json:"title" binding:"required,max=200"`
	Content  string  `json:"content" binding:"required"`
	Type     string  `json:"type" binding:"omitempty,oneof=info warning promotion"`
	Priority string  `json:"priority" binding:"omitempty,oneof=high medium low"`
	IsActive *bool   `json:"is_active"`
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
}

// UpdateAnnouncementRequest represents the request body for updating an announcement.
type UpdateAnnouncementRequest struct {
	Title    *string `json:"title" binding:"omitempty,max=200"`
	Content  *string `json:"content"`
	Type     *string `json:"type" binding:"omitempty,oneof=info warning promotion"`
	Priority *string `json:"priority" binding:"omitempty,oneof=high medium low"`
	IsActive *bool   `json:"is_active"`
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
}

// CreateAnnouncement handles POST /api/v1/admin/announcements
// Creates a new announcement with the provided details.
// Requirement 26.1: create Announcement items with title, content, and type
// Requirement 26.2: set start date and end date for display periods
// Requirement 26.3: set priority (high, medium, low)
func (h *AnnouncementHandler) CreateAnnouncement(c *gin.Context) {
	var req CreateAnnouncementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	announcement := &models.Announcement{
		Title:    strings.TrimSpace(req.Title),
		Content:  strings.TrimSpace(req.Content),
		Type:     models.AnnouncementTypeInfo,
		Priority: models.PriorityMedium,
		IsActive: true,
	}

	// Set type if provided
	if req.Type != "" {
		announcement.Type = models.AnnouncementType(req.Type)
	}

	// Set priority if provided
	if req.Priority != "" {
		announcement.Priority = models.Priority(req.Priority)
	}

	if req.IsActive != nil {
		announcement.IsActive = *req.IsActive
	}

	// Parse start_date
	if req.StartDate != nil && *req.StartDate != "" {
		t, err := time.Parse(time.RFC3339, *req.StartDate)
		if err != nil {
			response.BadRequest(c, "Invalid start_date format, use RFC3339 (e.g. 2024-01-01T00:00:00Z)")
			return
		}
		announcement.StartDate = &t
	}

	// Parse end_date
	if req.EndDate != nil && *req.EndDate != "" {
		t, err := time.Parse(time.RFC3339, *req.EndDate)
		if err != nil {
			response.BadRequest(c, "Invalid end_date format, use RFC3339 (e.g. 2024-12-31T23:59:59Z)")
			return
		}
		announcement.EndDate = &t
	}

	// Validate that end_date is after start_date if both are provided
	if announcement.StartDate != nil && announcement.EndDate != nil {
		if announcement.EndDate.Before(*announcement.StartDate) {
			response.BadRequest(c, "end_date must be after start_date")
			return
		}
	}

	if err := h.announcementRepo.Create(c.Request.Context(), announcement); err != nil {
		response.InternalError(c, "Failed to create announcement", err.Error())
		return
	}

	response.Created(c, announcement)
}

// UpdateAnnouncement handles PUT /api/v1/admin/announcements/:id
// Updates an existing announcement's fields.
// Requirement 26.4: enable or disable Announcement items
func (h *AnnouncementHandler) UpdateAnnouncement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid announcement ID")
		return
	}

	var req UpdateAnnouncementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body", err.Error())
		return
	}

	// Get existing announcement
	announcement, err := h.announcementRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Announcement not found")
			return
		}
		response.InternalError(c, "Failed to get announcement", err.Error())
		return
	}

	// Update fields if provided
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			response.BadRequest(c, "title cannot be empty")
			return
		}
		announcement.Title = title
	}
	if req.Content != nil {
		content := strings.TrimSpace(*req.Content)
		if content == "" {
			response.BadRequest(c, "content cannot be empty")
			return
		}
		announcement.Content = content
	}
	if req.Type != nil {
		announcement.Type = models.AnnouncementType(*req.Type)
	}
	if req.Priority != nil {
		announcement.Priority = models.Priority(*req.Priority)
	}
	if req.IsActive != nil {
		announcement.IsActive = *req.IsActive
	}

	// Parse start_date
	if req.StartDate != nil {
		if *req.StartDate == "" {
			announcement.StartDate = nil
		} else {
			t, err := time.Parse(time.RFC3339, *req.StartDate)
			if err != nil {
				response.BadRequest(c, "Invalid start_date format, use RFC3339 (e.g. 2024-01-01T00:00:00Z)")
				return
			}
			announcement.StartDate = &t
		}
	}

	// Parse end_date
	if req.EndDate != nil {
		if *req.EndDate == "" {
			announcement.EndDate = nil
		} else {
			t, err := time.Parse(time.RFC3339, *req.EndDate)
			if err != nil {
				response.BadRequest(c, "Invalid end_date format, use RFC3339 (e.g. 2024-12-31T23:59:59Z)")
				return
			}
			announcement.EndDate = &t
		}
	}

	// Validate that end_date is after start_date if both are set
	if announcement.StartDate != nil && announcement.EndDate != nil {
		if announcement.EndDate.Before(*announcement.StartDate) {
			response.BadRequest(c, "end_date must be after start_date")
			return
		}
	}

	if err := h.announcementRepo.Update(c.Request.Context(), announcement); err != nil {
		response.InternalError(c, "Failed to update announcement", err.Error())
		return
	}

	response.Success(c, announcement)
}

// DeleteAnnouncement handles DELETE /api/v1/admin/announcements/:id
// Deletes an announcement by ID.
func (h *AnnouncementHandler) DeleteAnnouncement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid announcement ID")
		return
	}

	if err := h.announcementRepo.Delete(c.Request.Context(), uint(id)); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(c, "Announcement not found")
			return
		}
		response.InternalError(c, "Failed to delete announcement", err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Announcement deleted successfully"})
}

// ListAnnouncements handles GET /api/v1/admin/announcements
// Returns a paginated list of all announcements for admin management.
func (h *AnnouncementHandler) ListAnnouncements(c *gin.Context) {
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

	announcements, total, err := h.announcementRepo.List(c.Request.Context(), page, perPage)
	if err != nil {
		response.InternalError(c, "Failed to list announcements", err.Error())
		return
	}

	meta := response.Paginate(page, perPage, total)
	response.SuccessWithMeta(c, gin.H{"announcements": announcements}, meta)
}

// GetActiveAnnouncements handles GET /api/v1/announcements
// Returns active announcements for the public frontend, sorted by priority
// (high priority at top).
// Requirement 26.5: display active Announcement items with priority "high" prominently
// Requirement 26.6: filter by current date within display period
func (h *AnnouncementHandler) GetActiveAnnouncements(c *gin.Context) {
	announcements, err := h.announcementRepo.GetActiveAnnouncements(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to get active announcements", err.Error())
		return
	}

	response.Success(c, gin.H{"announcements": announcements})
}
