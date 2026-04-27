#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Company Brain Remote Control Plane Bootstrap ==="
echo "Repo root: $REPO_ROOT"

echo ""
echo "[1/5] Installing npm dependencies..."
cd "$REPO_ROOT"
npm install

echo ""
echo "[2/5] Building shared packages..."
npm run build -w @company-brain/shared-types 2>/dev/null || true
npm run build -w @company-brain/shared-config 2>/dev/null || true
npm run build -w @company-brain/shared-observability 2>/dev/null || true
npm run build -w @company-brain/shared-auth 2>/dev/null || true
npm run build -w @company-brain/shared-state 2>/dev/null || true
npm run build -w @company-brain/shared-runtime 2>/dev/null || true

echo ""
echo "[3/5] Building remote-control-plane..."
npm run build -w @company-brain/remote-control-plane 2>/dev/null || true

echo ""
echo "[4/5] Checking environment..."
if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET="dev-secret-$(openssl rand -hex 16 2>/dev/null || echo 'insecure-dev-secret')"
  echo "  JWT_SECRET not set, generated dev secret"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="http://127.0.0.1:8080"
  echo "  DATABASE_URL not set, defaulting to http://127.0.0.1:8080"
fi

echo ""
echo "[5/5] Starting remote-control-plane..."
echo "  Port: ${PORT:-3020}"
echo "  Database: ${DATABASE_URL}"
echo ""

npm run dev -w @company-brain/remote-control-plane
