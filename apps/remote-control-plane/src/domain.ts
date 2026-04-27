import { createHash, randomBytes, createHmac } from "node:crypto";
import { createEntityId, nowIso } from "@apex/shared-types";
import type {
  FleetAgent,
  FleetAgentStatus,
  FleetHeartbeat,
  Tenant,
  RemoteUser,
  SyncRecord,
  APIKey,
  JWTClaims,
  RemoteTaskDispatch,
  AuditSyncEntry
} from "./contracts.js";

const agents = new Map<string, FleetAgent>();
const tenants = new Map<string, Tenant>();
const users = new Map<string, RemoteUser>();
const syncRecords = new Map<string, SyncRecord>();
const apiKeys = new Map<string, APIKey>();
const dispatches = new Map<string, RemoteTaskDispatch>();
const auditSyncEntries = new Map<string, AuditSyncEntry>();

export function registerFleetAgent(input: {
  tenant_id: string;
  display_name: string;
  hostname: string;
  ip_address: string;
  capabilities?: string[];
  max_concurrent_tasks?: number;
  metadata?: Record<string, unknown>;
}): FleetAgent {
  const agent: FleetAgent = {
    agent_id: createEntityId("agent"),
    tenant_id: input.tenant_id,
    display_name: input.display_name,
    hostname: input.hostname,
    ip_address: input.ip_address,
    status: "online",
    capabilities: input.capabilities ?? [],
    max_concurrent_tasks: input.max_concurrent_tasks ?? 5,
    current_task_count: 0,
    last_heartbeat_at: nowIso(),
    registered_at: nowIso(),
    metadata: input.metadata ?? {}
  };
  agents.set(agent.agent_id, agent);
  return agent;
}

export function recordFleetHeartbeat(input: {
  agent_id: string;
  status: FleetAgentStatus;
  current_task_count: number;
  active_task_ids?: string[];
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
  metadata?: Record<string, unknown>;
}): FleetAgent {
  const agent = agents.get(input.agent_id);
  if (!agent) throw new Error(`Agent not found: ${input.agent_id}`);
  agent.status = input.status;
  agent.current_task_count = input.current_task_count;
  agent.last_heartbeat_at = nowIso();
  if (input.metadata) agent.metadata = input.metadata;
  agents.set(agent.agent_id, agent);
  return agent;
}

export function listFleetAgents(filter?: {
  tenant_id?: string;
  status?: FleetAgentStatus;
}): FleetAgent[] {
  let result = [...agents.values()];
  if (filter?.tenant_id) result = result.filter(a => a.tenant_id === filter.tenant_id);
  if (filter?.status) result = result.filter(a => a.status === filter.status);
  return result;
}

export function getFleetAgent(agentId: string): FleetAgent | undefined {
  return agents.get(agentId);
}

export function deregisterFleetAgent(agentId: string): boolean {
  return agents.delete(agentId);
}

export function detectStaleAgents(timeoutMs: number): FleetAgent[] {
  const cutoff = Date.now() - timeoutMs;
  const stale: FleetAgent[] = [];
  for (const agent of agents.values()) {
    if (agent.status === "online" && new Date(agent.last_heartbeat_at).getTime() < cutoff) {
      agent.status = "unknown";
      agents.set(agent.agent_id, agent);
      stale.push(agent);
    }
  }
  return stale;
}

export function createTenant(input: {
  name: string;
  plan?: Tenant["plan"];
  max_agents?: number;
  max_tasks_per_day?: number;
  features?: string[];
}): Tenant {
  const tenant: Tenant = {
    tenant_id: createEntityId("tenant"),
    name: input.name,
    plan: input.plan ?? "free",
    status: "active",
    max_agents: input.max_agents ?? 5,
    max_tasks_per_day: input.max_tasks_per_day ?? 100,
    features: input.features ?? [],
    created_at: nowIso(),
    updated_at: nowIso()
  };
  tenants.set(tenant.tenant_id, tenant);
  return tenant;
}

export function getTenant(tenantId: string): Tenant | undefined {
  return tenants.get(tenantId);
}

export function listTenants(): Tenant[] {
  return [...tenants.values()];
}

export function updateTenant(tenantId: string, updates: Partial<Pick<Tenant, "name" | "plan" | "status" | "max_agents" | "max_tasks_per_day" | "features">>): Tenant {
  const tenant = tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  if (updates.name !== undefined) tenant.name = updates.name;
  if (updates.plan !== undefined) tenant.plan = updates.plan;
  if (updates.status !== undefined) tenant.status = updates.status;
  if (updates.max_agents !== undefined) tenant.max_agents = updates.max_agents;
  if (updates.max_tasks_per_day !== undefined) tenant.max_tasks_per_day = updates.max_tasks_per_day;
  if (updates.features !== undefined) tenant.features = updates.features;
  tenant.updated_at = nowIso();
  tenants.set(tenant.tenant_id, tenant);
  return tenant;
}

export function createRemoteUser(input: {
  tenant_id: string;
  email: string;
  display_name: string;
  role?: RemoteUser["role"];
}): RemoteUser {
  const user: RemoteUser = {
    user_id: createEntityId("user"),
    tenant_id: input.tenant_id,
    email: input.email,
    display_name: input.display_name,
    role: input.role ?? "viewer",
    status: "active",
    api_key_hash: "",
    last_login_at: "",
    created_at: nowIso(),
    updated_at: nowIso()
  };
  users.set(user.user_id, user);
  return user;
}

export function getRemoteUser(userId: string): RemoteUser | undefined {
  return users.get(userId);
}

export function listRemoteUsers(filter?: { tenant_id?: string }): RemoteUser[] {
  let result = [...users.values()];
  if (filter?.tenant_id) result = result.filter(u => u.tenant_id === filter.tenant_id);
  return result;
}

export function createAPIKey(input: {
  tenant_id: string;
  user_id: string;
  name: string;
  scopes?: string[];
  expires_at?: string;
}): { api_key: APIKey; secret: string } {
  const secret = `cb_${randomBytes(24).toString("hex")}`;
  const keyPrefix = secret.substring(0, 8);
  const keyHash = hashSecret(secret);
  const apiKey: APIKey = {
    key_id: createEntityId("apikey"),
    tenant_id: input.tenant_id,
    user_id: input.user_id,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    name: input.name,
    scopes: input.scopes ?? [],
    last_used_at: "",
    expires_at: input.expires_at ?? "",
    created_at: nowIso()
  };
  apiKeys.set(apiKey.key_id, apiKey);
  return { api_key: apiKey, secret };
}

export function validateAPIKey(secret: string): APIKey | null {
  const keyHash = hashSecret(secret);
  const keyPrefix = secret.substring(0, 8);
  for (const key of apiKeys.values()) {
    if (key.key_prefix === keyPrefix && key.key_hash === keyHash) {
      if (key.expires_at && new Date(key.expires_at) < new Date()) return null;
      key.last_used_at = nowIso();
      apiKeys.set(key.key_id, key);
      return key;
    }
  }
  return null;
}

export function issueJWT(claims: Omit<JWTClaims, "iat" | "exp">, expirySeconds: number, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expirySeconds;
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64urlEncode(JSON.stringify({ ...claims, iat, exp }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyJWT(token: string, secret: string): JWTClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expectedSig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const claims = JSON.parse(base64urlDecode(payload)) as JWTClaims;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function dispatchTaskToAgent(input: {
  task_id: string;
  tenant_id: string;
  target_agent_id: string;
  priority?: RemoteTaskDispatch["priority"];
}): RemoteTaskDispatch {
  const agent = agents.get(input.target_agent_id);
  if (!agent) throw new Error(`Agent not found: ${input.target_agent_id}`);
  if (agent.status !== "online") throw new Error(`Agent not online: ${input.target_agent_id}`);
  if (agent.current_task_count >= agent.max_concurrent_tasks) {
    throw new Error(`Agent at capacity: ${input.target_agent_id}`);
  }
  const dispatch: RemoteTaskDispatch = {
    dispatch_id: createEntityId("dispatch"),
    task_id: input.task_id,
    tenant_id: input.tenant_id,
    target_agent_id: input.target_agent_id,
    priority: input.priority ?? "medium",
    status: "dispatched",
    dispatched_at: nowIso(),
    acknowledged_at: "",
    created_at: nowIso()
  };
  dispatches.set(dispatch.dispatch_id, dispatch);
  agent.current_task_count++;
  agents.set(agent.agent_id, agent);
  return dispatch;
}

export function acknowledgeDispatch(dispatchId: string): RemoteTaskDispatch {
  const dispatch = dispatches.get(dispatchId);
  if (!dispatch) throw new Error(`Dispatch not found: ${dispatchId}`);
  dispatch.status = "acknowledged";
  dispatch.acknowledged_at = nowIso();
  dispatches.set(dispatch.dispatch_id, dispatch);
  return dispatch;
}

export function listDispatches(filter?: { tenant_id?: string; agent_id?: string; status?: RemoteTaskDispatch["status"] }): RemoteTaskDispatch[] {
  let result = [...dispatches.values()];
  if (filter?.tenant_id) result = result.filter(d => d.tenant_id === filter.tenant_id);
  if (filter?.agent_id) result = result.filter(d => d.target_agent_id === filter.agent_id);
  if (filter?.status) result = result.filter(d => d.status === filter.status);
  return result;
}

export function recordSyncEntry(input: {
  source_agent_id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncRecord["operation"];
  payload_hash: string;
}): SyncRecord {
  const record: SyncRecord = {
    sync_id: createEntityId("sync"),
    source_agent_id: input.source_agent_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    operation: input.operation,
    payload_hash: input.payload_hash,
    synced_at: nowIso(),
    status: "pending"
  };
  syncRecords.set(record.sync_id, record);
  return record;
}

export function recordAuditSync(input: {
  tenant_id: string;
  source_agent_id: string;
  action: string;
  payload_json: string;
  entity_type: string;
  entity_id: string;
}): AuditSyncEntry {
  const entry: AuditSyncEntry = {
    audit_sync_id: createEntityId("asyncaudit"),
    tenant_id: input.tenant_id,
    source_agent_id: input.source_agent_id,
    action: input.action,
    payload_json: input.payload_json,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    synced_at: nowIso(),
    created_at: nowIso()
  };
  auditSyncEntries.set(entry.audit_sync_id, entry);
  return entry;
}

export function listAuditSyncEntries(filter?: { tenant_id?: string; agent_id?: string }): AuditSyncEntry[] {
  let result = [...auditSyncEntries.values()];
  if (filter?.tenant_id) result = result.filter(e => e.tenant_id === filter.tenant_id);
  if (filter?.agent_id) result = result.filter(e => e.source_agent_id === filter.agent_id);
  return result;
}

export function getRemoteControlPlaneStats() {
  return {
    total_agents: agents.size,
    online_agents: [...agents.values()].filter(a => a.status === "online").length,
    total_tenants: tenants.size,
    total_users: users.size,
    pending_syncs: [...syncRecords.values()].filter(s => s.status === "pending").length,
    active_dispatches: [...dispatches.values()].filter(d => d.status === "dispatched").length,
    total_audit_syncs: auditSyncEntries.size
  };
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}
