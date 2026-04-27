import Fastify from "fastify";
import { loadRemoteControlPlaneEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import {
  registerFleetAgent,
  recordFleetHeartbeat,
  listFleetAgents,
  getFleetAgent,
  deregisterFleetAgent,
  detectStaleAgents,
  createTenant,
  getTenant,
  listTenants,
  updateTenant,
  createRemoteUser,
  getRemoteUser,
  listRemoteUsers,
  createAPIKey,
  validateAPIKey,
  issueJWT,
  verifyJWT,
  dispatchTaskToAgent,
  acknowledgeDispatch,
  listDispatches,
  recordSyncEntry,
  recordAuditSync,
  listAuditSyncEntries,
  getRemoteControlPlaneStats
} from "./domain.js";
import type { FleetAgentStatus, RemoteTaskDispatch, Tenant } from "./contracts.js";

const env = loadRemoteControlPlaneEnv({
  ...process.env,
  SERVICE_NAME: "remote-control-plane",
  PORT: process.env.PORT ?? "3020"
});

const app = Fastify({ logger: false });

function extractAuth(headers: Record<string, string | string[] | undefined>): { tenant_id: string; user_id: string; role: string } | null {
  const rawAuth = headers["authorization"];
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader) return null;

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const claims = verifyJWT(token, env.JWT_SECRET);
    if (!claims) return null;
    return { tenant_id: claims.tenant_id, user_id: claims.sub, role: claims.role };
  }

  if (authHeader.startsWith("ApiKey ")) {
    const secret = authHeader.substring(7);
    const apiKey = validateAPIKey(secret);
    if (!apiKey) return null;
    const user = getRemoteUser(apiKey.user_id);
    if (!user) return null;
    return { tenant_id: apiKey.tenant_id, user_id: user.user_id, role: user.role };
  }

  return null;
}

function requireAuth(headers: Record<string, string | string[] | undefined>, reply: { code: (c: number) => { send: (b: unknown) => void } }): { tenant_id: string; user_id: string; role: string } | null {
  const auth = extractAuth(headers);
  if (!auth) {
    reply.code(401).send({ error: "Unauthorized", message: "Valid Bearer token or ApiKey required" });
    return null;
  }
  return auth;
}

app.get("/health", async () => {
  return {
    status: "ok",
    service: "remote-control-plane",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    stats: getRemoteControlPlaneStats()
  };
});

app.post("/api/rcp/auth/login", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const email = String(body.email ?? "");
  const tenantId = String(body.tenant_id ?? "");

  const allUsers = listRemoteUsers({ tenant_id: tenantId });
  const user = allUsers.find(u => u.email === email);
  if (!user) return reply.code(404).send({ error: "User not found" });

  const token = issueJWT(
    { sub: user.user_id, tenant_id: user.tenant_id, role: user.role, iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE },
    env.JWT_EXPIRY_SECONDS,
    env.JWT_SECRET
  );

  user.last_login_at = new Date().toISOString();

  return { token, user_id: user.user_id, tenant_id: user.tenant_id, role: user.role };
});

app.post("/api/rcp/auth/api-keys", async (request, reply) => {
  const auth = requireAuth(request.headers, reply);
  if (!auth) return;

  const body = (request.body ?? {}) as Record<string, unknown>;
  const result = createAPIKey({
    tenant_id: auth.tenant_id,
    user_id: auth.user_id,
    name: String(body.name ?? "default"),
    scopes: (body.scopes as string[]) ?? []
  });

  return { key_id: result.api_key.key_id, key_prefix: result.api_key.key_prefix, secret: result.secret, created_at: result.api_key.created_at };
});

app.post("/api/rcp/tenants", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const tenant = createTenant({
    name: String(body.name ?? "Default Tenant"),
    plan: body.plan as Tenant["plan"] ?? "free",
    max_agents: body.max_agents as number | undefined,
    max_tasks_per_day: body.max_tasks_per_day as number | undefined,
    features: body.features as string[] | undefined
  });
  return reply.code(201).send(tenant);
});

app.get("/api/rcp/tenants", async () => {
  return { tenants: listTenants() };
});

app.get("/api/rcp/tenants/:tenantId", async (request, reply) => {
  const tenant = getTenant((request.params as { tenantId: string }).tenantId);
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });
  return tenant;
});

app.patch("/api/rcp/tenants/:tenantId", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const tenant = updateTenant(tenantId, body as Partial<Pick<Tenant, "name" | "plan" | "status" | "max_agents" | "max_tasks_per_day" | "features">>);
    return tenant;
  } catch (e) {
    return reply.code(404).send({ error: (e as Error).message });
  }
});

app.post("/api/rcp/users", async (request, reply) => {
  const auth = requireAuth(request.headers, reply);
  if (!auth) return;

  const body = (request.body ?? {}) as Record<string, unknown>;
  const user = createRemoteUser({
    tenant_id: auth.tenant_id,
    email: String(body.email ?? ""),
    display_name: String(body.display_name ?? ""),
    role: body.role as import("./contracts.js").RemoteUser["role"] | undefined
  });
  return reply.code(201).send(user);
});

app.get("/api/rcp/users", async (request) => {
  const auth = extractAuth(request.headers);
  const tenantId = auth?.tenant_id;
  return { users: listRemoteUsers(tenantId ? { tenant_id: tenantId } : undefined) };
});

app.get("/api/rcp/users/:userId", async (request, reply) => {
  const user = getRemoteUser((request.params as { userId: string }).userId);
  if (!user) return reply.code(404).send({ error: "User not found" });
  return user;
});

app.post("/api/rcp/fleet/register", async (request, reply) => {
  const auth = requireAuth(request.headers, reply);
  if (!auth) return;

  const body = (request.body ?? {}) as Record<string, unknown>;
  const agent = registerFleetAgent({
    tenant_id: auth.tenant_id,
    display_name: String(body.display_name ?? ""),
    hostname: String(body.hostname ?? ""),
    ip_address: String(body.ip_address ?? request.ip ?? "127.0.0.1"),
    capabilities: body.capabilities as string[] | undefined,
    max_concurrent_tasks: body.max_concurrent_tasks as number | undefined,
    metadata: body.metadata as Record<string, unknown> | undefined
  });
  return reply.code(201).send(agent);
});

app.post("/api/rcp/fleet/heartbeat", async (request, reply) => {
  const auth = requireAuth(request.headers, reply);
  if (!auth) return;

  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const agent = recordFleetHeartbeat({
      agent_id: String(body.agent_id ?? ""),
      status: body.status as FleetAgentStatus,
      current_task_count: body.current_task_count as number ?? 0,
      active_task_ids: body.active_task_ids as string[] | undefined,
      memory_usage_mb: body.memory_usage_mb as number | undefined,
      cpu_usage_percent: body.cpu_usage_percent as number | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined
    });
    return agent;
  } catch (e) {
    return reply.code(404).send({ error: (e as Error).message });
  }
});

app.get("/api/rcp/fleet/agents", async (request) => {
  const auth = extractAuth(request.headers);
  const query = request.query as { status?: FleetAgentStatus };
  return {
    agents: listFleetAgents({
      tenant_id: auth?.tenant_id,
      status: query.status
    })
  };
});

app.get("/api/rcp/fleet/agents/:agentId", async (request, reply) => {
  const agent = getFleetAgent((request.params as { agentId: string }).agentId);
  if (!agent) return reply.code(404).send({ error: "Agent not found" });
  return agent;
});

app.delete("/api/rcp/fleet/agents/:agentId", async (request, reply) => {
  const agentId = (request.params as { agentId: string }).agentId;
  const removed = deregisterFleetAgent(agentId);
  if (!removed) return reply.code(404).send({ error: "Agent not found" });
  return { deleted: true, agent_id: agentId };
});

app.post("/api/rcp/fleet/detect-stale", async () => {
  const stale = detectStaleAgents(env.FLEET_HEARTBEAT_TIMEOUT_MS);
  return { stale_agents: stale, count: stale.length };
});

app.post("/api/rcp/dispatch", async (request, reply) => {
  const auth = requireAuth(request.headers, reply);
  if (!auth) return;

  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const dispatch = dispatchTaskToAgent({
      task_id: String(body.task_id ?? ""),
      tenant_id: auth.tenant_id,
      target_agent_id: String(body.target_agent_id ?? ""),
      priority: body.priority as RemoteTaskDispatch["priority"] | undefined
    });
    return reply.code(201).send(dispatch);
  } catch (e) {
    return reply.code(400).send({ error: (e as Error).message });
  }
});

app.post("/api/rcp/dispatch/:dispatchId/acknowledge", async (request, reply) => {
  try {
    const dispatch = acknowledgeDispatch((request.params as { dispatchId: string }).dispatchId);
    return dispatch;
  } catch (e) {
    return reply.code(404).send({ error: (e as Error).message });
  }
});

app.get("/api/rcp/dispatch", async (request) => {
  const auth = extractAuth(request.headers);
  const query = request.query as { agent_id?: string; status?: RemoteTaskDispatch["status"] };
  return {
    dispatches: listDispatches({
      tenant_id: auth?.tenant_id,
      agent_id: query.agent_id,
      status: query.status
    })
  };
});

app.post("/api/rcp/sync", async (request, reply) => {
  const auth = requireAuth(request.headers, reply);
  if (!auth) return;

  const body = (request.body ?? {}) as Record<string, unknown>;
  const record = recordSyncEntry({
    source_agent_id: String(body.source_agent_id ?? ""),
    entity_type: String(body.entity_type ?? ""),
    entity_id: String(body.entity_id ?? ""),
    operation: body.operation as "create" | "update" | "delete",
    payload_hash: String(body.payload_hash ?? "")
  });
  return reply.code(201).send(record);
});

app.post("/api/rcp/audit-sync", async (request, reply) => {
  const auth = requireAuth(request.headers, reply);
  if (!auth) return;

  const body = (request.body ?? {}) as Record<string, unknown>;
  const entry = recordAuditSync({
    tenant_id: auth.tenant_id,
    source_agent_id: String(body.source_agent_id ?? ""),
    action: String(body.action ?? ""),
    payload_json: String(body.payload_json ?? "{}"),
    entity_type: String(body.entity_type ?? ""),
    entity_id: String(body.entity_id ?? "")
  });
  return reply.code(201).send(entry);
});

app.get("/api/rcp/audit-sync", async (request) => {
  const auth = extractAuth(request.headers);
  const query = request.query as { agent_id?: string };
  return {
    entries: listAuditSyncEntries({
      tenant_id: auth?.tenant_id,
      agent_id: query.agent_id
    })
  };
});

app.get("/api/rcp/stats", async () => {
  return getRemoteControlPlaneStats();
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "remote-control-plane started", { host: env.HOST, port: env.PORT });
});
