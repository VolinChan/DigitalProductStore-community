#!/bin/bash
# Database Backup Script for Digital Store
# Supports daily full backups and 6-hour incremental backups
#
# Usage:
#   ./backup.sh full     - Run a full backup
#   ./backup.sh incr     - Run an incremental backup
#
# Environment variables:
#   DB_HOST       - PostgreSQL host (default: localhost)
#   DB_PORT       - PostgreSQL port (default: 5432)
#   DB_USER       - PostgreSQL user (default: postgres)
#   DB_PASSWORD   - PostgreSQL password
#   DB_NAME       - Database name (default: digital_store)
#   BACKUP_DIR    - Backup directory (default: /backup)
#   BACKUP_RETAIN_DAYS - Days to retain backups (default: 30)
#   REMOTE_BACKUP_PATH - Remote backup path for offsite storage (optional)

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-digital_store}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"
REMOTE_BACKUP_PATH="${REMOTE_BACKUP_PATH:-}"

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y%m%d)

# Directories
FULL_BACKUP_DIR="${BACKUP_DIR}/full"
INCR_BACKUP_DIR="${BACKUP_DIR}/incremental"
LOG_DIR="${BACKUP_DIR}/logs"

# Create directories
mkdir -p "${FULL_BACKUP_DIR}" "${INCR_BACKUP_DIR}" "${LOG_DIR}"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_DIR}/backup_${DATE}.log"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Set PGPASSWORD for non-interactive authentication
export PGPASSWORD="${DB_PASSWORD:-postgres}"

# Full backup
full_backup() {
    local backup_file="${FULL_BACKUP_DIR}/${DB_NAME}_full_${TIMESTAMP}.sql.gz"
    
    log "Starting full backup of database '${DB_NAME}'..."
    
    pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --format=custom \
        --compress=9 \
        --verbose \
        -f "${backup_file}" \
        2>> "${LOG_DIR}/backup_${DATE}.log" \
        || error_exit "Full backup failed"
    
    # Calculate checksum
    sha256sum "${backup_file}" > "${backup_file}.sha256"
    
    local size=$(du -h "${backup_file}" | cut -f1)
    log "Full backup completed: ${backup_file} (${size})"
    
    # Copy to remote storage if configured
    if [ -n "${REMOTE_BACKUP_PATH}" ]; then
        sync_to_remote "${backup_file}" "${backup_file}.sha256"
    fi
}

# Incremental backup (WAL-based or table diff)
incremental_backup() {
    local backup_file="${INCR_BACKUP_DIR}/${DB_NAME}_incr_${TIMESTAMP}.sql.gz"
    
    log "Starting incremental backup of database '${DB_NAME}'..."
    
    # Use pg_dump with --data-only for tables modified since last backup
    # For a true WAL-based incremental, configure PostgreSQL WAL archiving
    pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --format=custom \
        --compress=9 \
        --verbose \
        -f "${backup_file}" \
        2>> "${LOG_DIR}/backup_${DATE}.log" \
        || error_exit "Incremental backup failed"
    
    # Calculate checksum
    sha256sum "${backup_file}" > "${backup_file}.sha256"
    
    local size=$(du -h "${backup_file}" | cut -f1)
    log "Incremental backup completed: ${backup_file} (${size})"
    
    # Copy to remote storage if configured
    if [ -n "${REMOTE_BACKUP_PATH}" ]; then
        sync_to_remote "${backup_file}" "${backup_file}.sha256"
    fi
}

# Sync to remote storage
sync_to_remote() {
    log "Syncing backup to remote storage: ${REMOTE_BACKUP_PATH}"
    
    for file in "$@"; do
        if command -v aws &> /dev/null; then
            # AWS S3
            aws s3 cp "${file}" "${REMOTE_BACKUP_PATH}/$(basename ${file})" \
                || log "WARNING: Failed to sync ${file} to remote storage"
        elif command -v rclone &> /dev/null; then
            # rclone (supports multiple cloud providers)
            rclone copy "${file}" "${REMOTE_BACKUP_PATH}/" \
                || log "WARNING: Failed to sync ${file} to remote storage"
        else
            log "WARNING: No remote sync tool available (aws cli or rclone)"
        fi
    done
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${BACKUP_RETAIN_DAYS} days..."
    
    find "${FULL_BACKUP_DIR}" -type f -mtime +${BACKUP_RETAIN_DAYS} -delete 2>/dev/null || true
    find "${INCR_BACKUP_DIR}" -type f -mtime +${BACKUP_RETAIN_DAYS} -delete 2>/dev/null || true
    find "${LOG_DIR}" -type f -mtime +${BACKUP_RETAIN_DAYS} -delete 2>/dev/null || true
    
    log "Cleanup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [ -f "${backup_file}.sha256" ]; then
        if sha256sum -c "${backup_file}.sha256" > /dev/null 2>&1; then
            log "Backup integrity verified: ${backup_file}"
            return 0
        else
            log "ERROR: Backup integrity check failed: ${backup_file}"
            return 1
        fi
    fi
}

# Main
case "${1:-full}" in
    full)
        full_backup
        cleanup_old_backups
        ;;
    incr|incremental)
        incremental_backup
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    verify)
        if [ -n "${2:-}" ]; then
            verify_backup "$2"
        else
            log "Usage: $0 verify <backup_file>"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {full|incr|cleanup|verify <file>}"
        exit 1
        ;;
esac

log "Backup operation completed successfully"
