#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

umask 077
backup_directory="${BACKUP_DIRECTORY:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
interval_seconds="${BACKUP_INTERVAL_SECONDS:-86400}"
mkdir -p "$backup_directory"
plaintext_path=""
temporary_path=""

cleanup() {
    rm -f "$plaintext_path" "$temporary_path"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

case "$retention_days" in
    ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2 ;;
esac
case "$interval_seconds" in
    ''|*[!0-9]*) echo "BACKUP_INTERVAL_SECONDS must be a positive integer" >&2; exit 2 ;;
esac
if [ "$retention_days" -lt 1 ] || [ "$interval_seconds" -lt 60 ]; then
    echo "Backup retention must be positive and interval at least 60 seconds" >&2
    exit 2
fi

while :; do
    timestamp="$(date -u +%Y%m%d-%H%M%S)"
    plaintext_path="${backup_directory}/.season-cake-${timestamp}.dump.tmp"
    rm -f "$plaintext_path"
    if [ -n "${AGE_RECIPIENT:-}" ]; then
        filename="season-cake-${timestamp}.dump.age"
        temporary_path="${backup_directory}/.${filename}.tmp"
        backup_path="${backup_directory}/${filename}"
        if pg_dump --no-owner --format=custom --file="$plaintext_path" \
            && age --recipient "$AGE_RECIPIENT" --output "$temporary_path" "$plaintext_path"; then
            chmod 600 "$temporary_path"
            mv "$temporary_path" "$backup_path"
            rm -f "$plaintext_path"
            echo "Created encrypted PostgreSQL backup: $backup_path"
        else
            rm -f "$plaintext_path" "$temporary_path"
            echo "PostgreSQL backup or encryption failed at ${timestamp}" >&2
        fi
    else
        filename="season-cake-${timestamp}.dump"
        temporary_path="${backup_directory}/.${filename}.tmp"
        backup_path="${backup_directory}/${filename}"
        if pg_dump --no-owner --format=custom --file="$temporary_path"; then
            chmod 600 "$temporary_path"
            mv "$temporary_path" "$backup_path"
            echo "Created unencrypted development PostgreSQL backup: $backup_path"
        else
            rm -f "$temporary_path"
            echo "PostgreSQL backup failed at ${timestamp}" >&2
        fi
    fi

    find "$backup_directory" -type f -name 'season-cake-*.dump*' -mtime "+$retention_days" -delete
    sleep "$interval_seconds"
done
