package database

import (
	"context"
	"fmt"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/pkg/utils"
)

// SeedDemoData inserts a minimal dataset for local development and smoke
// tests: one super_admin user, a few categories, a couple of products,
// and matching SKUs. It is idempotent — running it twice is a no-op.
//
// This is gated behind the SEED_DEMO_DATA=true env var in main.go so it
// never runs unintentionally in production.
func SeedDemoData(ctx context.Context, db *gorm.DB) error {
	if err := seedAdminUser(ctx, db); err != nil {
		return fmt.Errorf("seed admin: %w", err)
	}
	if err := seedCatalog(ctx, db); err != nil {
		return fmt.Errorf("seed catalog: %w", err)
	}
	return nil
}

func seedAdminUser(ctx context.Context, db *gorm.DB) error {
	const adminEmail = "admin@demo.local"

	var count int64
	if err := db.WithContext(ctx).Model(&models.User{}).
		Where("email = ?", adminEmail).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := utils.HashPassword("Admin@1234")
	if err != nil {
		return err
	}

	admin := &models.User{
		Email:        adminEmail,
		PasswordHash: hash,
		FullName:     "Demo Super Admin",
		Phone:        "",
		Role:         models.RoleSuperAdmin,
		IsActive:     true,
	}
	return db.WithContext(ctx).Create(admin).Error
}

func seedCatalog(ctx context.Context, db *gorm.DB) error {
	// Bail out if any products already exist so we don't duplicate on restart.
	var productCount int64
	if err := db.WithContext(ctx).Model(&models.Product{}).Count(&productCount).Error; err != nil {
		return err
	}
	if productCount > 0 {
		return nil
	}

	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// ----- Categories -----
		phones := &models.Category{Name: "手机", Slug: "phones", SortOrder: 1}
		laptops := &models.Category{Name: "笔记本", Slug: "laptops", SortOrder: 2}
		if err := tx.Create(phones).Error; err != nil {
			return err
		}
		if err := tx.Create(laptops).Error; err != nil {
			return err
		}

		// ----- Product 1: Phone with 2 SKUs (color variants) -----
		phoneID := phones.ID
		phone := &models.Product{
			Name:           "演示手机 Pro",
			Description:    "用于本地测试的演示手机，支持多色 SKU。",
			CategoryID:     &phoneID,
			Specifications: `{"display":"6.1 inch","battery":"4000mAh"}`,
			IsActive:       true,
		}
		if err := tx.Create(phone).Error; err != nil {
			return err
		}

		phoneSKUs := []*models.SKU{
			{
				ProductID: phone.ID,
				SKUCode:   "DEMO-PHONE-BLK",
				Price:     decimal.NewFromFloat(4999.00),
				Inventory: 50,
				IsActive:  true,
			},
			{
				ProductID: phone.ID,
				SKUCode:   "DEMO-PHONE-WHT",
				Price:     decimal.NewFromFloat(4999.00),
				Inventory: 30,
				IsActive:  true,
			},
		}
		for _, s := range phoneSKUs {
			if err := tx.Create(s).Error; err != nil {
				return err
			}
		}
		// SKU attributes
		phoneAttrs := []*models.SKUAttribute{
			{SKUID: phoneSKUs[0].ID, Name: "颜色", Value: "黑色"},
			{SKUID: phoneSKUs[1].ID, Name: "颜色", Value: "白色"},
		}
		for _, a := range phoneAttrs {
			if err := tx.Create(a).Error; err != nil {
				return err
			}
		}

		// ----- Product 2: Laptop with 2 SKUs (storage variants) -----
		laptopID := laptops.ID
		laptop := &models.Product{
			Name:           "演示笔记本 Air",
			Description:    "用于本地测试的演示笔记本电脑。",
			CategoryID:     &laptopID,
			Specifications: `{"cpu":"M2","ram":"16GB"}`,
			IsActive:       true,
		}
		if err := tx.Create(laptop).Error; err != nil {
			return err
		}

		laptopSKUs := []*models.SKU{
			{
				ProductID: laptop.ID,
				SKUCode:   "DEMO-LAPTOP-256",
				Price:     decimal.NewFromFloat(8999.00),
				Inventory: 20,
				IsActive:  true,
			},
			{
				ProductID: laptop.ID,
				SKUCode:   "DEMO-LAPTOP-512",
				Price:     decimal.NewFromFloat(10499.00),
				Inventory: 15,
				IsActive:  true,
			},
		}
		for _, s := range laptopSKUs {
			if err := tx.Create(s).Error; err != nil {
				return err
			}
		}
		laptopAttrs := []*models.SKUAttribute{
			{SKUID: laptopSKUs[0].ID, Name: "存储", Value: "256GB"},
			{SKUID: laptopSKUs[1].ID, Name: "存储", Value: "512GB"},
		}
		for _, a := range laptopAttrs {
			if err := tx.Create(a).Error; err != nil {
				return err
			}
		}

		return nil
	})
}
