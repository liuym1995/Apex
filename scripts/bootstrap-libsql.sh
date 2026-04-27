#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/infra/migrations"

echo "=== Apex libSQL/Turso Bootstrap ==="

DATABASE_URL="${DATABASE_URL:-http://127.0.0.1:8080}"
DATABASE_AUTH_TOKEN="${DATABASE_AUTH_TOKEN:-}"

echo "Database URL: $DATABASE_URL"
echo "Migrations directory: $MIGRATIONS_DIR"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

MIGRATION_FILES=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)
if [ -z "$MIGRATION_FILES" ]; then
  echo "No migration files found"
  exit 0
fi

for MIGRATION_FILE in $MIGRATION_FILES; do
  MIGRATION_NAME=$(basename "$MIGRATION_FILE")
  echo ""
  echo "Applying migration: $MIGRATION_NAME"

  if [ -n "$DATABASE_AUTH_TOKEN" ]; then
    curl -s -X POST "$DATABASE_URL" \
      -H "Authorization: Bearer $DATABASE_AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"requests\": [{\"type\": \"execute\", \"stmt\": {\"sql\": $(cat "$MIGRATION_FILE" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}}]}" \
      || echo "WARNING: Failed to apply migration via HTTP (libSQL server may not be running)"
  else
    echo "  No auth token set, skipping remote apply"
    echo "  Migration SQL available at: $MIGRATION_FILE"
  fi
done

echo ""
echo "=== Bootstrap complete ==="
echo "To start libSQL server locally:"
echo "  docker run -p 8080:8080 -p 5001:5001 ghcr.io/tursodatabase/libsql-server:latest"
echo ""
echo "Or use docker compose:"
echo "  cd infra/docker && docker compose up libsql -d"
