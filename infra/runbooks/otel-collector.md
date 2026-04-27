# OTEL Collector Path Runbook

## Overview

The OpenTelemetry Collector path provides a production-grade observability pipeline for Apex services. It supports:

- OTLP HTTP and gRPC trace ingestion
- Batch processing and memory limiting
- File-based trace archival
- Prometheus metrics exposition
- Jaeger trace export
- Dynamic collector config generation
- Pipeline lifecycle management (create, start, stop, tick)

## Architecture

```
Apex Services
  → OTLP Export (HTTP/gRPC)
    → OTEL Collector Sidecar
      → Processors (batch, memory_limiter, resource)
        → Exporters (debug, file, jaeger, prometheus)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | http://127.0.0.1:4318 | OTLP endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | (empty) | Additional headers (key=value) |
| `OTEL_SERVICE_NAME` | apex | Service name |
| `OTEL_SERVICE_VERSION` | 0.1.0 | Service version |
| `OTEL_DEPLOYMENT_ENVIRONMENT` | development | Deployment env |
| `OTEL_TRACES_SAMPLER` | parentbased_traceidratio | Sampling strategy |
| `OTEL_TRACES_SAMPLER_ARG` | 0.1 | Sampling rate |
| `OTEL_EXPORT_INTERVAL_MS` | 5000 | Batch export interval |
| `OTEL_MAX_EXPORT_BATCH_SIZE` | 512 | Max batch size |
| `OTEL_MAX_QUEUE_SIZE` | 2048 | Max queue size |
| `OTEL_COLLECTOR_ENABLED` | false | Enable sidecar |
| `OTEL_COLLECTOR_IMAGE` | otel/opentelemetry-collector-contrib:0.96.0 | Collector image |
| `OTEL_COLLECTOR_CONFIG_PATH` | ./infra/otel/collector-config.yaml | Config path |

## API Endpoints (Local Control Plane)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/local/otel/export` | Export traces to configured endpoint |
| GET | `/api/local/otel/export-json` | Export traces as JSON |
| POST | `/api/local/otel/pipeline` | Create OTEL pipeline |
| POST | `/api/local/otel/pipeline/:pipelineId/start` | Start pipeline |
| POST | `/api/local/otel/pipeline/:pipelineId/stop` | Stop pipeline |
| POST | `/api/local/otel/pipeline/:pipelineId/tick` | Execute one export tick |
| GET | `/api/local/otel/pipelines` | List pipelines |
| GET | `/api/local/otel/pipelines/:pipelineId` | Get pipeline status |
| POST | `/api/local/otel/generate-collector-config` | Generate sidecar YAML config |

## Deployment

### Docker

```bash
cd infra/docker
docker compose up otel-collector -d
```

### Manual

```bash
./scripts/bootstrap-otel.sh
```

### Kubernetes

```bash
kubectl apply -f infra/k8s/otel-collector.yaml
```

## Collector Config

The main collector config is at `infra/otel/collector-config.yaml`. It includes:

- **Receivers**: OTLP HTTP (4318) and gRPC (4317)
- **Processors**: batch, memory_limiter, resource, health filter
- **Exporters**: debug, file (JSON), Jaeger, Prometheus
- **Extensions**: health_check (13133), pprof (1777)

### Dynamic Config Generation

Use the `generateCollectorSidecarConfig` function to generate per-service collector configs:

```typescript
const yaml = generateCollectorSidecarConfig({
  serviceName: "remote-control-plane",
  otlpEndpoint: "https://your-otel-backend.example.com/v1/traces",
  exportToFile: true,
  enablePrometheus: true,
  prometheusPort: 8889
});
```

## Pipeline Lifecycle

1. **Create**: `createOTELPipeline(config)` — registers a pipeline with config
2. **Start**: `startOTELPipeline(id)` — marks pipeline as running
3. **Tick**: `tickOTELPipeline(id)` — executes one export cycle
4. **Stop**: `stopOTELPipeline(id)` — marks pipeline as stopped

## Health Check

```bash
curl http://localhost:13133/
```

## Troubleshooting

### Collector not receiving traces
- Check service is exporting to correct endpoint
- Verify CORS settings if using HTTP
- Check firewall rules for 4317/4318

### High memory usage
- Reduce `OTEL_MAX_QUEUE_SIZE`
- Reduce `OTEL_MAX_EXPORT_BATCH_SIZE`
- Increase `memory_limiter.limit_mib`

### Missing traces
- Check sampling rate (`OTEL_TRACES_SAMPLER_ARG`)
- Verify batch processor timeout
- Check exporter error logs

## Blocking Dependencies

- **OTEL Collector binary/image**: Requires Docker or container runtime for sidecar deployment
- **Jaeger backend**: Required for Jaeger trace visualization (optional)
- **Prometheus server**: Required for metrics scraping (optional)
- **TLS certificates**: Required for production OTLP export to cloud backends
