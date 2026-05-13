package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Migration represents a database migration
type Migration struct {
	ID        string    `gorm:"primaryKey"`
	Name      string    `gorm:"size:200;not null"`
	AppliedAt time.Time `gorm:"autoCreateTime"`
}

// TableName returns the table name for migrations
func (Migration) TableName() string {
	return "schema_migrations"
}

// MigrationManager handles database migrations
type MigrationManager struct {
	db       *DB
	fs       embed.FS
	dir      string
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *DB, migrationFS embed.FS, dir string) *MigrationManager {
	return &MigrationManager{
		db:  db,
		fs:  migrationFS,
		dir: dir,
	}
}

// Migrate runs all pending migrations
func (m *MigrationManager) Migrate(ctx context.Context) error {
	// Create migrations table if not exists
	if err := m.createMigrationsTable(ctx); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get applied migrations
	applied, err := m.getAppliedMigrations(ctx)
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Get migration files
	migrations, err := m.getMigrationFiles()
	if err != nil {
		return fmt.Errorf("failed to get migration files: %w", err)
	}

	// Apply pending migrations
	for _, migration := range migrations {
		if _, ok := applied[migration.ID]; ok {
			continue // Already applied
		}

		fmt.Printf("Applying migration: %s\n", migration.Name)

		if err := m.applyMigration(ctx, migration); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", migration.Name, err)
		}

		fmt.Printf("Migration applied: %s\n", migration.Name)
	}

	return nil
}

// Rollback rolls back the last migration
func (m *MigrationManager) Rollback(ctx context.Context) error {
	// Get applied migrations
	applied, err := m.getAppliedMigrations(ctx)
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	if len(applied) == 0 {
		return fmt.Errorf("no migrations to rollback")
	}

	// Get migration files
	migrations, err := m.getMigrationFiles()
	if err != nil {
		return fmt.Errorf("failed to get migration files: %w", err)
	}

	// Find the last applied migration
	var lastMigration *migrationFile
	for i := len(migrations) - 1; i >= 0; i-- {
		if _, ok := applied[migrations[i].ID]; ok {
			lastMigration = &migrations[i]
			break
		}
	}

	if lastMigration == nil {
		return fmt.Errorf("no migration to rollback")
	}

	fmt.Printf("Rolling back migration: %s\n", lastMigration.Name)

	if err := m.rollbackMigration(ctx, *lastMigration); err != nil {
		return fmt.Errorf("failed to rollback migration %s: %w", lastMigration.Name, err)
	}

	fmt.Printf("Migration rolled back: %s\n", lastMigration.Name)

	return nil
}

// createMigrationsTable creates the migrations tracking table
func (m *MigrationManager) createMigrationsTable(ctx context.Context) error {
	return m.db.WithContext(ctx).Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id VARCHAR(100) PRIMARY KEY,
			name VARCHAR(200) NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)
	`).Error
}

// getAppliedMigrations returns a map of applied migration IDs
func (m *MigrationManager) getAppliedMigrations(ctx context.Context) (map[string]bool, error) {
	var migrations []Migration
	if err := m.db.WithContext(ctx).Find(&migrations).Error; err != nil {
		return nil, err
	}

	applied := make(map[string]bool)
	for _, m := range migrations {
		applied[m.ID] = true
	}
	return applied, nil
}

type migrationFile struct {
	ID      string
	Name    string
	UpFile  string
	DownFile string
}

// getMigrationFiles reads migration files from the embedded filesystem
func (m *MigrationManager) getMigrationFiles() ([]migrationFile, error) {
	var files []migrationFile

	err := fs.WalkDir(m.fs, m.dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		filename := d.Name()
		if !strings.HasSuffix(filename, ".sql") {
			return nil
		}

		// Parse migration ID and name from filename
		// Expected format: 001_init_schema.up.sql or 001_init_schema.down.sql
		base := strings.TrimSuffix(filename, ".sql")
		parts := strings.SplitN(base, ".", 2)
		if len(parts) != 2 {
			return nil
		}

		migrationID := parts[0]
		direction := parts[1] // "up" or "down"

		// Find or create migration file entry
		var mf *migrationFile
		for i := range files {
			if files[i].ID == migrationID {
				mf = &files[i]
				break
			}
		}
		if mf == nil {
			files = append(files, migrationFile{
				ID:   migrationID,
				Name: migrationID,
			})
			mf = &files[len(files)-1]
		}

		if direction == "up" {
			mf.UpFile = path
		} else if direction == "down" {
			mf.DownFile = path
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	// Sort migrations by ID
	sort.Slice(files, func(i, j int) bool {
		return files[i].ID < files[j].ID
	})

	return files, nil
}

// applyMigration applies a single migration
func (m *MigrationManager) applyMigration(ctx context.Context, mf migrationFile) error {
	if mf.UpFile == "" {
		return fmt.Errorf("up migration file not found for %s", mf.ID)
	}

	content, err := m.fs.ReadFile(mf.UpFile)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	// Execute migration in a transaction
	return m.db.Transaction(ctx, func(tx *gorm.DB) error {
		// Execute migration SQL
		if err := tx.Exec(string(content)).Error; err != nil {
			return err
		}

		// Record migration
		return tx.Create(&Migration{
			ID:   mf.ID,
			Name: mf.Name,
		}).Error
	})
}

// rollbackMigration rolls back a single migration
func (m *MigrationManager) rollbackMigration(ctx context.Context, mf migrationFile) error {
	if mf.DownFile == "" {
		return fmt.Errorf("down migration file not found for %s", mf.ID)
	}

	content, err := m.fs.ReadFile(mf.DownFile)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	// Execute rollback in a transaction
	return m.db.Transaction(ctx, func(tx *gorm.DB) error {
		// Execute rollback SQL
		if err := tx.Exec(string(content)).Error; err != nil {
			return err
		}

		// Remove migration record
		return tx.Where("id = ?", mf.ID).Delete(&Migration{}).Error
	})
}

// Status returns the current migration status
func (m *MigrationManager) Status(ctx context.Context) ([]MigrationStatus, error) {
	applied, err := m.getAppliedMigrations(ctx)
	if err != nil {
		return nil, err
	}

	migrations, err := m.getMigrationFiles()
	if err != nil {
		return nil, err
	}

	var statuses []MigrationStatus
	for _, m := range migrations {
		status := MigrationStatus{
			ID:      m.ID,
			Name:    m.Name,
			Applied: applied[m.ID],
		}
		statuses = append(statuses, status)
	}

	return statuses, nil
}

// MigrationStatus represents the status of a migration
type MigrationStatus struct {
	ID      string
	Name    string
	Applied bool
}

// MigrateFromFS runs migrations from the embedded filesystem
func MigrateFromFS(ctx context.Context, db *DB, migrationFS embed.FS, dir string) error {
	manager := NewMigrationManager(db, migrationFS, dir)
	return manager.Migrate(ctx)
}
