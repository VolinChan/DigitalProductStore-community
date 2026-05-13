package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"github.com/digital-store/backend/internal/models"
)

// setupAuthTestRouter creates a test router with request_id set (needed by response package)
func setupAuthTestRouter() *gin.Engine {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("request_id", "test-request-id")
		c.Next()
	})
	return router
}

// TestRequireRole_SuperAdminAccessAll verifies super_admin can access any endpoint
func TestRequireRole_SuperAdminAccessAll(t *testing.T) {
	router := setupAuthTestRouter()
	router.GET("/admin/products", func(c *gin.Context) {
		c.Set("user_role", string(models.RoleSuperAdmin))
		c.Next()
	}, RequireRole(models.RoleProductManager), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Use a different approach: set role before RequireRole runs
	router2 := setupAuthTestRouter()
	router2.Use(func(c *gin.Context) {
		c.Set("user_role", string(models.RoleSuperAdmin))
		c.Next()
	})
	router2.GET("/admin/products", RequireRole(models.RoleProductManager), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/products", nil)
	router2.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestRequireRole_ProductManagerAccessProducts verifies product_manager can access product endpoints
func TestRequireRole_ProductManagerAccessProducts(t *testing.T) {
	router := setupAuthTestRouter()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", string(models.RoleProductManager))
		c.Next()
	})
	router.GET("/admin/products", RequireRole(models.RoleProductManager, models.RoleSuperAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/products", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestRequireRole_OrderManagerAccessOrders verifies order_manager can access order endpoints
func TestRequireRole_OrderManagerAccessOrders(t *testing.T) {
	router := setupAuthTestRouter()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", string(models.RoleOrderManager))
		c.Next()
	})
	router.GET("/admin/orders", RequireRole(models.RoleOrderManager, models.RoleSuperAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/orders", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestRequireRole_ProductManagerCannotAccessOrders verifies product_manager cannot access order endpoints
func TestRequireRole_ProductManagerCannotAccessOrders(t *testing.T) {
	router := setupAuthTestRouter()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", string(models.RoleProductManager))
		c.Next()
	})
	router.GET("/admin/orders", RequireRole(models.RoleOrderManager, models.RoleSuperAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/orders", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

// TestRequireRole_OrderManagerCannotAccessProducts verifies order_manager cannot access product management
func TestRequireRole_OrderManagerCannotAccessProducts(t *testing.T) {
	router := setupAuthTestRouter()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", string(models.RoleOrderManager))
		c.Next()
	})
	router.GET("/admin/products", RequireRole(models.RoleProductManager, models.RoleSuperAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/products", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

// TestRequireRole_RegularUserCannotAccessAdmin verifies regular users cannot access admin endpoints
func TestRequireRole_RegularUserCannotAccessAdmin(t *testing.T) {
	router := setupAuthTestRouter()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", string(models.RoleUser))
		c.Next()
	})
	router.GET("/admin/products", RequireRole(models.RoleProductManager, models.RoleSuperAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/products", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

// TestRequireRole_NoRoleInContext returns 401 when no role is set
func TestRequireRole_NoRoleInContext(t *testing.T) {
	router := setupAuthTestRouter()
	router.GET("/admin/products", RequireRole(models.RoleProductManager), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/products", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// TestRequireRole_SuperAdminOnlyEndpoint verifies only super_admin can access user management
func TestRequireRole_SuperAdminOnlyEndpoint(t *testing.T) {
	tests := []struct {
		name       string
		role       models.Role
		wantStatus int
	}{
		{"super_admin can access", models.RoleSuperAdmin, http.StatusOK},
		{"product_manager cannot access", models.RoleProductManager, http.StatusForbidden},
		{"order_manager cannot access", models.RoleOrderManager, http.StatusForbidden},
		{"regular user cannot access", models.RoleUser, http.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupAuthTestRouter()
			router.Use(func(c *gin.Context) {
				c.Set("user_role", string(tt.role))
				c.Next()
			})
			router.GET("/admin/users", RequireRole(models.RoleSuperAdmin), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/admin/users", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// TestRequirePermission_SuperAdminHasAll verifies super_admin has all permissions
func TestRequirePermission_SuperAdminHasAll(t *testing.T) {
	permissions := []Permission{
		PermissionManageProducts,
		PermissionManageSKUs,
		PermissionManageCategories,
		PermissionManageInventory,
		PermissionManageOrders,
		PermissionManagePayments,
		PermissionManageUsers,
		PermissionManageSystem,
	}

	for _, perm := range permissions {
		t.Run(string(perm), func(t *testing.T) {
			router := setupAuthTestRouter()
			router.Use(func(c *gin.Context) {
				c.Set("user_role", string(models.RoleSuperAdmin))
				c.Next()
			})
			router.GET("/test", RequirePermission(perm), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/test", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
		})
	}
}

// TestRequirePermission_ProductManagerPermissions verifies product_manager permissions
func TestRequirePermission_ProductManagerPermissions(t *testing.T) {
	tests := []struct {
		permission Permission
		allowed    bool
	}{
		{PermissionManageProducts, true},
		{PermissionManageSKUs, true},
		{PermissionManageCategories, true},
		{PermissionManageInventory, true},
		{PermissionManageOrders, false},
		{PermissionManagePayments, false},
		{PermissionManageUsers, false},
		{PermissionManageSystem, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.permission), func(t *testing.T) {
			router := setupAuthTestRouter()
			router.Use(func(c *gin.Context) {
				c.Set("user_role", string(models.RoleProductManager))
				c.Next()
			})
			router.GET("/test", RequirePermission(tt.permission), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/test", nil)
			router.ServeHTTP(w, req)

			if tt.allowed {
				assert.Equal(t, http.StatusOK, w.Code)
			} else {
				assert.Equal(t, http.StatusForbidden, w.Code)
			}
		})
	}
}

// TestRequirePermission_OrderManagerPermissions verifies order_manager permissions
func TestRequirePermission_OrderManagerPermissions(t *testing.T) {
	tests := []struct {
		permission Permission
		allowed    bool
	}{
		{PermissionManageProducts, false},
		{PermissionManageSKUs, false},
		{PermissionManageCategories, false},
		{PermissionManageInventory, false},
		{PermissionManageOrders, true},
		{PermissionManagePayments, true},
		{PermissionManageUsers, false},
		{PermissionManageSystem, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.permission), func(t *testing.T) {
			router := setupAuthTestRouter()
			router.Use(func(c *gin.Context) {
				c.Set("user_role", string(models.RoleOrderManager))
				c.Next()
			})
			router.GET("/test", RequirePermission(tt.permission), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/test", nil)
			router.ServeHTTP(w, req)

			if tt.allowed {
				assert.Equal(t, http.StatusOK, w.Code)
			} else {
				assert.Equal(t, http.StatusForbidden, w.Code)
			}
		})
	}
}

// TestRequirePermission_RegularUserNoPermissions verifies regular users have no admin permissions
func TestRequirePermission_RegularUserNoPermissions(t *testing.T) {
	router := setupAuthTestRouter()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", string(models.RoleUser))
		c.Next()
	})
	router.GET("/test", RequirePermission(PermissionManageProducts), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

// TestRequirePermission_NoRoleInContext returns 401
func TestRequirePermission_NoRoleInContext(t *testing.T) {
	router := setupAuthTestRouter()
	router.GET("/test", RequirePermission(PermissionManageProducts), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// TestHasPermission verifies the HasPermission helper function
func TestHasPermission(t *testing.T) {
	tests := []struct {
		name       string
		role       models.Role
		permission Permission
		expected   bool
	}{
		// super_admin has all permissions
		{"super_admin manage_products", models.RoleSuperAdmin, PermissionManageProducts, true},
		{"super_admin manage_users", models.RoleSuperAdmin, PermissionManageUsers, true},
		{"super_admin manage_system", models.RoleSuperAdmin, PermissionManageSystem, true},

		// product_manager permissions
		{"product_manager manage_products", models.RoleProductManager, PermissionManageProducts, true},
		{"product_manager manage_skus", models.RoleProductManager, PermissionManageSKUs, true},
		{"product_manager manage_categories", models.RoleProductManager, PermissionManageCategories, true},
		{"product_manager manage_inventory", models.RoleProductManager, PermissionManageInventory, true},
		{"product_manager manage_orders", models.RoleProductManager, PermissionManageOrders, false},
		{"product_manager manage_users", models.RoleProductManager, PermissionManageUsers, false},

		// order_manager permissions
		{"order_manager manage_orders", models.RoleOrderManager, PermissionManageOrders, true},
		{"order_manager manage_payments", models.RoleOrderManager, PermissionManagePayments, true},
		{"order_manager manage_products", models.RoleOrderManager, PermissionManageProducts, false},
		{"order_manager manage_users", models.RoleOrderManager, PermissionManageUsers, false},

		// regular user has no admin permissions
		{"user manage_products", models.RoleUser, PermissionManageProducts, false},
		{"user manage_orders", models.RoleUser, PermissionManageOrders, false},
		{"user manage_users", models.RoleUser, PermissionManageUsers, false},

		// guest has no admin permissions
		{"guest manage_products", models.RoleGuest, PermissionManageProducts, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HasPermission(tt.role, tt.permission)
			assert.Equal(t, tt.expected, result)
		})
	}
}
