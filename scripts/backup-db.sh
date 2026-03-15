#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/cyprus-rental/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cyprus_rental_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump from the running postgres container, compress
docker exec cyprus-rental-postgres \
  pg_dump -U agent -d cyprus_rental --no-owner --clean | \
  gzip > "$BACKUP_FILE"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "$(date): Backup completed: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
