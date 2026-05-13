package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/services"
	"github.com/digital-store/backend/pkg/response"
)

// AuthMiddleware creates a middleware for JWT authentication
func AuthMiddleware(authService services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "missing authorization header")
			c.Abort()
			return
		}

		// Check Bearer prefix
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "invalid authorization header format")
			c.Abort()
			return
		}

		token := parts[1]

		// Validate token
		claims, err := authService.ValidateToken(c.Request.Context(), token)
		if err != nil {
			response.Unauthorized(c, "invalid or expired token")
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)

		c.Next()
	}
}

// RequireRole creates a middleware that requires specific roles.
// super_admin always has access to all endpoints regardless of the roles specified.
func RequireRole(roles ...models.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			response.Unauthorized(c, "authentication required")
			c.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok {
			response.InternalError(c, "invalid role type")
			c.Abort()
			return
		}

		// Super admin has access to everything
		if roleStr == string(models.RoleSuperAdmin) {
			c.Next()
			return
		}

		// Check if user has one of the required roles
		for _, role := range roles {
			if roleStr == string(role) {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "insufficient permissions")
		c.Abort()
	}
}

// Permission represents a specific admin permission
type Permission string

const (
	// Product management permissions
	PermissionManageProducts   Permission = "manage_products"
	PermissionManageSKUs       Permission = "manage_skus"
	PermissionManageCategories Permission = "manage_categories"
	PermissionManageInventory  Permission = "manage_inventory"

	// Order management permissions
	PermissionManageOrders   Permission = "manage_orders"
	PermissionManagePayments Permission = "manage_payments"

	// Super admin only permissions
	PermissionManageUsers  Permission = "manage_users"
	PermissionManageSystem Permission = "manage_system"
)

// rolePermissions maps roles to their allowed permissions.
// super_admin is not listed here because it has all permissions by default.
var rolePermissions = map[models.Role][]Permission{
	models.RoleProductManager: {
		PermissionManageProducts,
		PermissionManageSKUs,
		PermissionManageCategories,
		PermissionManageInventory,
	},
	models.RoleOrderManager: {
		PermissionManageOrders,
		PermissionManagePayments,
	},
}

// RequirePermission creates a middleware that checks if the user has a specific permission.
// super_admin always has all permissions.
// product_manager can manage products, SKUs, categories, and inventory.
// order_manager can manage orders and payments.
// Sensitive operations (user management, system configuration) are restricted to super_admin only.
func RequirePermission(permission Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			response.Unauthorized(c, "authentication required")
			c.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok {
			response.InternalError(c, "invalid role type")
			c.Abort()
			return
		}

		role := models.Role(roleStr)

		// Super admin has all permissions
		if role == models.RoleSuperAdmin {
			c.Next()
			return
		}

		// Check if the role has the required permission
		permissions, exists := rolePermissions[role]
		if !exists {
			response.Forbidden(c, "insufficient permissions")
			c.Abort()
			return
		}

		for _, p := range permissions {
			if p == permission {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "insufficient permissions")
		c.Abort()
	}
}

// HasPermission checks if a role has a specific permission without middleware context.
// Useful for service-level permission checks.
func HasPermission(role models.Role, permission Permission) bool {
	// Super admin has all permissions
	if role == models.RoleSuperAdmin {
		return true
	}

	permissions, exists := rolePermissions[role]
	if !exists {
		return false
	}

	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// OptionalAuth creates a middleware that optionally authenticates users
// If a valid token is provided, user info is set in context
// If no token or invalid token, request continues without user info
func OptionalAuth(authService services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		token := parts[1]
		claims, err := authService.ValidateToken(c.Request.Context(), token)
		if err != nil {
			c.Next()
			return
		}

		// Set user info in context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)

		c.Next()
	}
}

// GetUserID retrieves the user ID from the context
func GetUserID(c *gin.Context) (uint, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	id, ok := userID.(uint)
	return id, ok
}

// GetUserEmail retrieves the user email from the context
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get("user_email")
	if !exists {
		return "", false
	}
	emailStr, ok := email.(string)
	return emailStr, ok
}

// GetUserRole retrieves the user role from the context
func GetUserRole(c *gin.Context) (string, bool) {
	role, exists := c.Get("user_role")
	if !exists {
		return "", false
	}
	roleStr, ok := role.(string)
	return roleStr, ok
}
