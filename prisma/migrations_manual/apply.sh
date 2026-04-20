#!/usr/bin/env bash
# Apply manual SQL migrations that Prisma cannot express (GIN, trigram indexes).
# Usage: DATABASE_URL=... ./prisma/migrations_manual/apply.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

for sql_file in "$SCRIPT_DIR"/*.sql; do
  echo "Applying $(basename "$sql_file")..."
  psql "$DATABASE_URL" -f "$sql_file"
  echo "Done."
done

echo "All manual migrations applied."
