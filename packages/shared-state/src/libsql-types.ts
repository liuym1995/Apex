import { z } from "zod";

export const LibSQLOperationSchema = z.enum(["execute", "batch", "transaction"]);
export const LibSQLResultSchema = z.object({
  rows: z.array(z.record(z.unknown())),
  columns: z.array(z.string()),
  rows_affected: z.number(),
  last_insert_rowid: z.union([z.number(), z.bigint(), z.null()]).default(null)
});

export type LibSQLOperation = z.infer<typeof LibSQLOperationSchema>;
export type LibSQLResult = z.infer<typeof LibSQLResultSchema>;

export interface LibSQLConnectionConfig {
  url: string;
  authToken: string;
  syncUrl?: string;
  syncIntervalMs?: number;
  localPath?: string;
  poolSize?: number;
  connectTimeoutMs?: number;
  readOnly?: boolean;
}

export interface LibSQLQuery {
  sql: string;
  args?: Record<string, unknown> | unknown[];
}

export interface LibSQLBatchStep {
  sql: string;
  args?: Record<string, unknown> | unknown[];
}

export interface LibSQLMigration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export interface LibSQLMigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

export interface LibSQLHealthCheck {
  connected: boolean;
  url: string;
  latency_ms: number;
  version: string;
  is_replica: boolean;
}

export interface LibSQLSyncStatus {
  last_sync_at: string;
  frames_applied: number;
  sync_url: string;
  is_replica: boolean;
}
