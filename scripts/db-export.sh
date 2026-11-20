#!/usr/bin/env bash
# Dumps one Supabase database (roles, schema, data) and encrypts it with BACKUP_PASSPHRASE.
# Usage: DB_URL=... BACKUP_PASSPHRASE=... bash scripts/db-export.sh <name>
# Output: export/<name>-<YYYY-MM-DD>.tar.gz.gpg
# Restore: see docs/einrichtung.md ("Backup wiederherstellen").
set -euo pipefail

name="${1:?usage: db-export.sh <name>}"

if [ -z "${DB_URL:-}" ]; then
  echo "::notice::No database URL configured for '$name', skipping export."
  exit 0
fi
if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "::error::BACKUP_PASSPHRASE is not set."
  exit 1
fi

stamp="$(date -u +%Y-%m-%d)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

npx supabase db dump --db-url "$DB_URL" -f "$workdir/roles.sql" --role-only
npx supabase db dump --db-url "$DB_URL" -f "$workdir/schema.sql"
npx supabase db dump --db-url "$DB_URL" -f "$workdir/data.sql" --use-copy --data-only

mkdir -p export
tar -C "$workdir" -czf - roles.sql schema.sql data.sql |
  gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
    --passphrase-fd 3 --output "export/$name-$stamp.tar.gz.gpg" 3<<<"$BACKUP_PASSPHRASE"

echo "Wrote export/$name-$stamp.tar.gz.gpg ($(du -h "export/$name-$stamp.tar.gz.gpg" | cut -f1))"
