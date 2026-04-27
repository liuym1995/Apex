import { z } from "zod";

export const LibSQLConfigSchema = z.object({
  DATABASE_URL: z.string().describe("libSQL/Turso database URL (e.g. libsql://my-db.turso.io)"),
  DATABASE_AUTH_TOKEN: z.string().describe("Authentication token for Turso/libSQL"),
  DATABASE_SYNC_URL: z.string().default("").describe("Embedded replica sync URL for Turso"),
  DATABASE_SYNC_INTERVAL_MS: z.coerce.number().int().default(5000).describe("Sync interval for embedded replica"),
  DATABASE_LOCAL_PATH: z.string().default(".apex/remote-control-plane.sqlite").describe("Local path for embedded replica or standalone SQLite"),
  DATABASE_CONNECTION_POOL_SIZE: z.coerce.number().int().default(5).describe("Connection pool size for remote libSQL"),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().default(10000).describe("Connection timeout in milliseconds"),
  DATABASE_READ_ONLY: z.coerce.boolean().default(false).describe("Whether this connection is read-only (replica mode)")
});

export type LibSQLConfig = z.infer<typeof LibSQLConfigSchema>;

export const OTELCollectorConfigSchema = z.object({
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://127.0.0.1:4318").describe("OTEL OTLP HTTP endpoint"),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().default("").describe("Additional headers for OTEL exporter (key=value,key=value)"),
  OTEL_SERVICE_NAME: z.string().default("apex").describe("Service name for OTEL resource"),
  OTEL_SERVICE_VERSION: z.string().default("0.1.0").describe("Service version for OTEL resource"),
  OTEL_DEPLOYMENT_ENVIRONMENT: z.enum(["development", "staging", "production"]).default("development"),
  OTEL_TRACES_SAMPLER: z.enum(["always_on", "always_off", "traceidratio", "parentbased_traceidratio"]).default("parentbased_traceidratio"),
  OTEL_TRACES_SAMPLER_ARG: z.string().default("0.1"),
  OTEL_EXPORT_INTERVAL_MS: z.coerce.number().int().default(5000).describe("Batch export interval"),
  OTEL_MAX_EXPORT_BATCH_SIZE: z.coerce.number().int().default(512),
  OTEL_MAX_QUEUE_SIZE: z.coerce.number().int().default(2048),
  OTEL_COLLECTOR_ENABLED: z.coerce.boolean().default(false).describe("Whether OTEL collector sidecar is enabled"),
  OTEL_COLLECTOR_IMAGE: z.string().default("otel/opentelemetry-collector-contrib:0.96.0"),
  OTEL_COLLECTOR_CONFIG_PATH: z.string().default("./infra/otel/collector-config.yaml")
});

export type OTELCollectorConfig = z.infer<typeof OTELCollectorConfigSchema>;

export function loadLibSQLConfig(overrides: Record<string, string | undefined> = process.env): LibSQLConfig {
  return LibSQLConfigSchema.parse(overrides);
}

export function loadOTELCollectorConfig(overrides: Record<string, string | undefined> = process.env): OTELCollectorConfig {
  return OTELCollectorConfigSchema.parse(overrides);
}
