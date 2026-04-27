import { z } from "zod";

export const FleetAgentStatusSchema = z.enum([
  "online",
  "offline",
  "draining",
  "maintenance",
  "unknown"
]);

export const FleetAgentSchema = z.object({
  agent_id: z.string(),
  tenant_id: z.string(),
  display_name: z.string(),
  hostname: z.string(),
  ip_address: z.string(),
  status: FleetAgentStatusSchema,
  capabilities: z.array(z.string()),
  max_concurrent_tasks: z.number().int().default(5),
  current_task_count: z.number().int().default(0),
  last_heartbeat_at: z.string(),
  registered_at: z.string(),
  metadata: z.record(z.unknown()).default({})
});

export const FleetHeartbeatSchema = z.object({
  agent_id: z.string(),
  status: FleetAgentStatusSchema,
  current_task_count: z.number().int(),
  active_task_ids: z.array(z.string()),
  memory_usage_mb: z.number().default(0),
  cpu_usage_percent: z.number().default(0),
  metadata: z.record(z.unknown()).default({})
});

export const TenantSchema = z.object({
  tenant_id: z.string(),
  name: z.string(),
  plan: z.enum(["free", "starter", "professional", "enterprise"]).default("free"),
  status: z.enum(["active", "suspended", "deleted"]).default("active"),
  max_agents: z.number().int().default(5),
  max_tasks_per_day: z.number().int().default(100),
  features: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string()
});

export const RemoteUserSchema = z.object({
  user_id: z.string(),
  tenant_id: z.string(),
  email: z.string().email(),
  display_name: z.string(),
  role: z.enum(["viewer", "operator", "admin", "platform_admin"]).default("viewer"),
  status: z.enum(["active", "suspended", "deleted"]).default("active"),
  api_key_hash: z.string().default(""),
  last_login_at: z.string().default(""),
  created_at: z.string(),
  updated_at: z.string()
});

export const SyncRecordSchema = z.object({
  sync_id: z.string(),
  source_agent_id: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  operation: z.enum(["create", "update", "delete"]),
  payload_hash: z.string(),
  synced_at: z.string(),
  status: z.enum(["pending", "applied", "conflict", "failed"]).default("pending")
});

export const APIKeySchema = z.object({
  key_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  key_prefix: z.string(),
  key_hash: z.string(),
  name: z.string(),
  scopes: z.array(z.string()).default([]),
  last_used_at: z.string().default(""),
  expires_at: z.string().default(""),
  created_at: z.string()
});

export const JWTClaimsSchema = z.object({
  sub: z.string(),
  tenant_id: z.string(),
  role: z.string(),
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  iat: z.number()
});

export const RemoteTaskDispatchSchema = z.object({
  dispatch_id: z.string(),
  task_id: z.string(),
  tenant_id: z.string(),
  target_agent_id: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["pending", "dispatched", "acknowledged", "rejected", "timed_out"]).default("pending"),
  dispatched_at: z.string().default(""),
  acknowledged_at: z.string().default(""),
  created_at: z.string()
});

export const AuditSyncEntrySchema = z.object({
  audit_sync_id: z.string(),
  tenant_id: z.string(),
  source_agent_id: z.string(),
  action: z.string(),
  payload_json: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  synced_at: z.string(),
  created_at: z.string()
});

export type FleetAgent = z.infer<typeof FleetAgentSchema>;
export type FleetAgentStatus = z.infer<typeof FleetAgentStatusSchema>;
export type FleetHeartbeat = z.infer<typeof FleetHeartbeatSchema>;
export type Tenant = z.infer<typeof TenantSchema>;
export type RemoteUser = z.infer<typeof RemoteUserSchema>;
export type SyncRecord = z.infer<typeof SyncRecordSchema>;
export type APIKey = z.infer<typeof APIKeySchema>;
export type JWTClaims = z.infer<typeof JWTClaimsSchema>;
export type RemoteTaskDispatch = z.infer<typeof RemoteTaskDispatchSchema>;
export type AuditSyncEntry = z.infer<typeof AuditSyncEntrySchema>;
