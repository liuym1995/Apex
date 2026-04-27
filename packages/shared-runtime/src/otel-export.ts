import { store } from "@apex/shared-state";
import { nowIso, createEntityId } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export interface OTELSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTime: string;
  endTime?: string;
  attributes: Record<string, string | number | boolean>;
  status: { code: number; message?: string };
  events: Array<{ name: string; time: string; attributes: Record<string, string> }>;
  resource: Record<string, string>;
}

export interface OTELExportBatch {
  resource_spans: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue?: string; intValue?: number } }> };
    scope_spans: Array<{
      scope: { name: string; version: string };
      spans: OTELSpan[];
    }>;
  }>;
}

export interface OTELExportResult {
  export_id: string;
  total_spans: number;
  total_traces: number;
  exported_at: string;
  endpoint: string;
  success: boolean;
  error?: string;
}

export interface OTELPipelineConfig {
  endpoint: string;
  headers?: Record<string, string>;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  exportIntervalMs: number;
  maxExportBatchSize: number;
  maxQueueSize: number;
  sampler: "always_on" | "always_off" | "traceidratio" | "parentbased_traceidratio";
  samplerArg?: string;
}

export interface OTELPipelineStatus {
  pipeline_id: string;
  config: OTELPipelineConfig;
  total_exports: number;
  total_spans_exported: number;
  total_errors: number;
  last_export_at: string;
  last_error: string;
  is_running: boolean;
}

const OTEL_RESOURCE_ATTRIBUTES: Record<string, string> = {
  "service.name": "apex",
  "service.version": "1.0.0",
  "deployment.environment": "local"
};

const pipelines = new Map<string, OTELPipelineStatus>();
let pipelineCounter = 0;

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function isLocalEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function mapSpanKind(kind: string): number {
  switch (kind) {
    case "client": return 3;
    case "server": return 2;
    case "producer": return 4;
    case "consumer": return 5;
    case "internal": return 1;
    default: return 1;
  }
}

function mapSpanStatus(status: string): { code: number; message?: string } {
  switch (status) {
    case "ok": return { code: 1 };
    case "error": return { code: 2, message: "Span errored" };
    default: return { code: 0 };
  }
}

export function convertTracesToOTEL(): OTELExportBatch {
  const allSpans = store.traceSpans.toArray();

  const spans: OTELSpan[] = [];
  for (const span of allSpans) {
    const attributes: Record<string, string | number | boolean> = {};
    if (span.attributes) {
      for (const [key, value] of Object.entries(span.attributes as Record<string, unknown>)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          attributes[key] = value;
        }
      }
    }

    const events = (span.events ?? []).map((e: { name: string; timestamp: string; attributes?: Record<string, unknown> }) => ({
      name: e.name,
      time: e.timestamp,
      attributes: Object.fromEntries(
        Object.entries(e.attributes ?? {}).map(([k, v]) => [k, String(v)])
      )
    }));

    spans.push({
      traceId: span.trace_id,
      spanId: span.span_id,
      parentSpanId: span.parent_span_id,
      name: span.name,
      kind: mapSpanKind(span.kind ?? "internal"),
      startTime: span.started_at,
      endTime: span.ended_at,
      attributes,
      status: mapSpanStatus(span.status ?? "ok"),
      events,
      resource: OTEL_RESOURCE_ATTRIBUTES
    });
  }

  return {
    resource_spans: [{
      resource: {
        attributes: Object.entries(OTEL_RESOURCE_ATTRIBUTES).map(([key, value]) => ({
          key,
          value: { stringValue: value }
        }))
      },
      scope_spans: [{
        scope: { name: "apex.runtime", version: "1.0.0" },
        spans
      }]
    }]
  };
}

export function exportOTELToEndpoint(endpoint: string): OTELExportResult {
  const batch = convertTracesToOTEL();
  const totalSpans = batch.resource_spans.reduce((sum, rs) =>
    sum + rs.scope_spans.reduce((s, ss) => s + ss.spans.length, 0), 0);
  const totalTraces = new Set(
    batch.resource_spans.flatMap(rs =>
      rs.scope_spans.flatMap(ss =>
        ss.spans.map(s => s.traceId)
      )
    )
  ).size;
  const externalExportAllowed = isExplicitlyEnabled(process.env.APEX_OTEL_EXTERNAL_EXPORT_ENABLED);
  const isAllowedEndpoint = isLocalEndpoint(endpoint) || externalExportAllowed;

  const result: OTELExportResult = {
    export_id: createEntityId("otel"),
    total_spans: totalSpans,
    total_traces: totalTraces,
    exported_at: nowIso(),
    endpoint,
    success: isAllowedEndpoint,
    error: isAllowedEndpoint
      ? undefined
      : "External OTEL export is disabled by default. Set APEX_OTEL_EXTERNAL_EXPORT_ENABLED=1 to allow non-local endpoints."
  };

  recordAudit("otel.export", {
    export_id: result.export_id,
    total_spans: totalSpans,
    total_traces: totalTraces,
    endpoint,
    success: result.success,
    error: result.error
  });

  return result;
}

export function exportOTELAsJSON(): { batch: OTELExportBatch; metadata: { total_spans: number; total_traces: number; exported_at: string } } {
  const batch = convertTracesToOTEL();
  const totalSpans = batch.resource_spans.reduce((sum, rs) =>
    sum + rs.scope_spans.reduce((s, ss) => s + ss.spans.length, 0), 0);
  const totalTraces = new Set(
    batch.resource_spans.flatMap(rs =>
      rs.scope_spans.flatMap(ss => ss.spans.map(s => s.traceId))
    )
  ).size;

  return {
    batch,
    metadata: {
      total_spans: totalSpans,
      total_traces: totalTraces,
      exported_at: nowIso()
    }
  };
}

export function createOTELPipeline(config: OTELPipelineConfig): OTELPipelineStatus {
  pipelineCounter++;
  const pipelineId = `otel_pipeline_${pipelineCounter}`;
  const status: OTELPipelineStatus = {
    pipeline_id: pipelineId,
    config,
    total_exports: 0,
    total_spans_exported: 0,
    total_errors: 0,
    last_export_at: "",
    last_error: "",
    is_running: false
  };
  pipelines.set(pipelineId, status);

  recordAudit("otel.pipeline_created", {
    pipeline_id: pipelineId,
    endpoint: config.endpoint,
    service_name: config.serviceName,
    export_interval_ms: config.exportIntervalMs
  });

  return status;
}

export function startOTELPipeline(pipelineId: string): OTELPipelineStatus {
  const pipeline = pipelines.get(pipelineId);
  if (!pipeline) throw new Error(`OTEL pipeline not found: ${pipelineId}`);
  pipeline.is_running = true;
  pipelines.set(pipelineId, pipeline);

  recordAudit("otel.pipeline_started", { pipeline_id: pipelineId });
  return pipeline;
}

export function stopOTELPipeline(pipelineId: string): OTELPipelineStatus {
  const pipeline = pipelines.get(pipelineId);
  if (!pipeline) throw new Error(`OTEL pipeline not found: ${pipelineId}`);
  pipeline.is_running = false;
  pipelines.set(pipelineId, pipeline);

  recordAudit("otel.pipeline_stopped", { pipeline_id: pipelineId });
  return pipeline;
}

export function tickOTELPipeline(pipelineId: string): OTELExportResult {
  const pipeline = pipelines.get(pipelineId);
  if (!pipeline) throw new Error(`OTEL pipeline not found: ${pipelineId}`);

  const result = exportOTELToEndpoint(pipeline.config.endpoint);
  pipeline.total_exports++;
  pipeline.total_spans_exported += result.total_spans;
  pipeline.last_export_at = nowIso();

  if (!result.success) {
    pipeline.total_errors++;
    pipeline.last_error = result.error ?? "Unknown error";
  }

  pipelines.set(pipelineId, pipeline);
  return result;
}

export function listOTELPipelines(): OTELPipelineStatus[] {
  return [...pipelines.values()];
}

export function getOTELPipeline(pipelineId: string): OTELPipelineStatus | undefined {
  return pipelines.get(pipelineId);
}

export function generateCollectorSidecarConfig(input: {
  serviceName: string;
  otlpEndpoint: string;
  headers?: Record<string, string>;
  exportToFile?: boolean;
  filePath?: string;
  exportToJaeger?: boolean;
  jaegerEndpoint?: string;
  enablePrometheus?: boolean;
  prometheusPort?: number;
}): string {
  const receivers: Record<string, unknown> = {
    otlp: {
      protocols: {
        http: { endpoint: "0.0.0.0:4318", cors: { allowed_origins: ["*"] } },
        grpc: { endpoint: "0.0.0.0:4317" }
      }
    }
  };

  const processors: Record<string, unknown> = {
    batch: { send_batch_size: 512, send_batch_max_size: 1024, timeout: "5s" },
    memory_limiter: { check_interval: "1s", limit_mib: 512, spike_limit_mib: 128 },
    resource: {
      attributes: [
        { key: "service.namespace", value: "apex", action: "upsert" },
        { key: "service.name", value: input.serviceName, action: "upsert" }
      ]
    }
  };

  const exporters: Record<string, unknown> = {
    debug: { verbosity: "basic", sampling_initial: 5, sampling_thereafter: 200 }
  };

  if (input.otlpEndpoint) {
    const otlpExporter: Record<string, unknown> = {
      endpoint: input.otlpEndpoint,
      retry_on_failure: { enabled: true, initial_interval: "5s", max_interval: "30s", max_elapsed_time: "300s" }
    };
    if (input.headers && Object.keys(input.headers).length > 0) {
      otlpExporter.headers = input.headers;
    }
    exporters.otlphttp = otlpExporter;
  }

  if (input.exportToFile) {
    exporters.file = {
      path: input.filePath ?? "/var/log/otel/traces.json",
      rotation: { max_megabytes: 100, max_days: 7, max_backups: 5 }
    };
  }

  if (input.exportToJaeger && input.jaegerEndpoint) {
    exporters.otlphttp_jaeger = {
      endpoint: input.jaegerEndpoint,
      retry_on_failure: { enabled: true, initial_interval: "5s", max_interval: "30s", max_elapsed_time: "300s" }
    };
  }

  if (input.enablePrometheus) {
    exporters.prometheus = {
      endpoint: `0.0.0.0:${input.prometheusPort ?? 8889}`,
      namespace: "apex"
    };
  }

  const traceExporters = ["debug"];
  if (input.otlpEndpoint) traceExporters.push("otlphttp");
  if (input.exportToFile) traceExporters.push("file");
  if (input.exportToJaeger && input.jaegerEndpoint) traceExporters.push("otlphttp_jaeger");

  const metricExporters = ["debug"];
  if (input.enablePrometheus) metricExporters.push("prometheus");

  const config = {
    receivers,
    processors,
    exporters,
    service: {
      pipelines: {
        traces: { receivers: ["otlp"], processors: ["memory_limiter", "resource", "batch"], exporters: traceExporters },
        metrics: { receivers: ["otlp"], processors: ["memory_limiter", "resource", "batch"], exporters: metricExporters }
      },
      extensions: ["health_check"]
    },
    extensions: {
      health_check: { endpoint: "0.0.0.0:13133" }
    }
  };

  return `# Auto-generated OTEL Collector config for ${input.serviceName}
# Generated at: ${nowIso()}

${yamlStringify(config, 0)}`;
}

function yamlStringify(obj: unknown, indent: number): string {
  const prefix = "  ".repeat(indent);
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") {
    if (obj.includes("\n") || obj.includes(":") || obj.includes("#")) return `"${obj.replace(/"/g, '\\"')}"`;
    return obj;
  }
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj.map(item => {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        return `${prefix}- ${yamlStringify(item, 0)}`;
      }
      const inner = yamlStringify(item, indent + 1);
      return `${prefix}- ${inner.trimStart()}`;
    }).join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries.map(([key, value]) => {
      const val = yamlStringify(value, indent + 1);
      if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value as object).length > 0) {
        return `${prefix}${key}:\n${val}`;
      }
      if (Array.isArray(value) && value.length > 0) {
        return `${prefix}${key}:\n${val}`;
      }
      return `${prefix}${key}: ${val}`;
    }).join("\n");
  }
  return String(obj);
}
