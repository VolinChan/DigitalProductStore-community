package database

import "embed"

// MigrationsFS embeds the migration files from the migrations directory
// The migrations folder is at the same level as the database package
//
//go:embed migrations
var MigrationsFS embed.FS
