#!/bin/bash

# Database migration script
# Usage: ./scripts/db_migrate.sh [up|down|create|status]

set -e

# Default values
MIGRATIONS_DIR="./internal/migrations"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-digital_store}"

# Database URL
DB_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

# Check if migrate is installed
if ! command -v migrate &> /dev/null; then
    echo "Installing golang-migrate..."
    go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
fi

# Function to run migrations
run_migrations() {
    local action=$1
    migrate -path "${MIGRATIONS_DIR}" -database "${DB_URL}" ${action}
}

# Main logic
case "$1" in
    up)
        echo "Running migrations up..."
        run_migrations "up"
        echo "Migrations completed successfully!"
        ;;
    down)
        echo "Rolling back migrations..."
        run_migrations "down"
        echo "Rollback completed!"
        ;;
    create)
        if [ -z "$2" ]; then
            echo "Usage: $0 create <migration_name>"
            exit 1
        fi
        echo "Creating migration: $2"
        migrate create -ext sql -dir "${MIGRATIONS_DIR}" -seq "$2"
        echo "Migration created successfully!"
        ;;
    status)
        echo "Checking migration status..."
        migrate -path "${MIGRATIONS_DIR}" -database "${DB_URL}" version
        ;;
    force)
        if [ -z "$2" ]; then
            echo "Usage: $0 force <version>"
            exit 1
        fi
        echo "Forcing migration version to $2..."
        migrate -path "${MIGRATIONS_DIR}" -database "${DB_URL}" force "$2"
        ;;
    *)
        echo "Usage: $0 {up|down|create|status|force}"
        echo ""
        echo "Commands:"
        echo "  up       - Run all pending migrations"
        echo "  down     - Rollback last migration"
        echo "  create   - Create a new migration file"
        echo "  status   - Show current migration version"
        echo "  force    - Force set migration version (use with caution)"
        exit 1
        ;;
esac
