#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Company Brain OTEL Collector Bootstrap ==="

OTEL_COLLECTOR_IMAGE="${OTEL_COLLECTOR_IMAGE:-otel/opentelemetry-collector-contrib:0.96.0}"
OTEL_CONFIG_PATH="${OTEL_CONFIG_PATH:-$REPO_ROOT/infra/otel/collector-config.yaml}"
OTEL_HTTP_PORT="${OTEL_HTTP_PORT:-4318}"
OTEL_GRPC_PORT="${OTEL_GRPC_PORT:-4317}"
OTEL_PROMETHEUS_PORT="${OTEL_PROMETHEUS_PORT:-8889}"
OTEL_HEALTH_PORT="${OTEL_HEALTH_PORT:-13133}"

if [ ! -f "$OTEL_CONFIG_PATH" ]; then
  echo "ERROR: OTEL collector config not found: $OTEL_CONFIG_PATH"
  exit 1
fi

echo "Config: $OTEL_CONFIG_PATH"
echo "Image:  $OTEL_COLLECTOR_IMAGE"
echo "Ports:  HTTP=$OTEL_HTTP_PORT, gRPC=$OTEL_GRPC_PORT, Prometheus=$OTEL_PROMETHEUS_PORT, Health=$OTEL_HEALTH_PORT"
echo ""

if command -v docker &>/dev/null; then
  echo "Starting OTEL Collector via Docker..."
  docker run -d \
    --name company-brain-otel-collector \
    -p "${OTEL_HTTP_PORT}:4318" \
    -p "${OTEL_GRPC_PORT}:4317" \
    -p "${OTEL_PROMETHEUS_PORT}:8889" \
    -p "${OTEL_HEALTH_PORT}:13133" \
    -v "$OTEL_CONFIG_PATH:/etc/otelcol/config.yaml:ro" \
    "$OTEL_COLLECTOR_IMAGE" \
    --config=/etc/otelcol/config.yaml

  echo ""
  echo "OTEL Collector started."
  echo "  Health: http://localhost:${OTEL_HEALTH_PORT}/"
  echo "  OTLP HTTP: http://localhost:${OTEL_HTTP_PORT}/v1/traces"
  echo "  OTLP gRPC: localhost:${OTEL_GRPC_PORT}"
  echo "  Prometheus: http://localhost:${OTEL_PROMETHEUS_PORT}/metrics"
elif command -v podman &>/dev/null; then
  echo "Starting OTEL Collector via Podman..."
  podman run -d \
    --name company-brain-otel-collector \
    -p "${OTEL_HTTP_PORT}:4318" \
    -p "${OTEL_GRPC_PORT}:4317" \
    -p "${OTEL_PROMETHEUS_PORT}:8889" \
    -p "${OTEL_HEALTH_PORT}:13133" \
    -v "$OTEL_CONFIG_PATH:/etc/otelcol/config.yaml:ro" \
    "$OTEL_COLLECTOR_IMAGE" \
    --config=/etc/otelcol/config.yaml

  echo "OTEL Collector started via Podman."
else
  echo "WARNING: Neither docker nor podman found."
  echo "To run OTEL Collector manually:"
  echo "  docker run -p 4318:4318 -p 4317:4317 -v $OTEL_CONFIG_PATH:/etc/otelcol/config.yaml:ro $OTEL_COLLECTOR_IMAGE --config=/etc/otelcol/config.yaml"
fi
