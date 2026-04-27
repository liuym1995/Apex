import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  type CapabilityDescriptor
} from "@apex/shared-types";
import { log } from "@apex/shared-observability";

export interface MCPCapabilitySpec {
  capability_id: string;
  name: string;
  description: string;
  server_uri?: string;
  protocol: "stdio" | "sse" | "streamable_http" | "grpc";
  tools: MCPToolSpec[];
  risk_tier: "low" | "medium" | "high" | "critical";
  sandbox_requirement: "none" | "guarded" | "isolated";
  tags: string[];
  version: string;
  registered_at: string;
  last_health_check?: string;
  health_status: "healthy" | "degraded" | "unavailable" | "unknown";
}

export interface MCPToolSpec {
  tool_name: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  risk_tier: "low" | "medium" | "high" | "critical";
  requires_confirmation: boolean;
  idempotent: boolean;
  compensable: boolean;
  estimated_latency_ms?: number;
}

export interface MCPInvocationRequest {
  capability_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  task_id?: string;
  session_id?: string;
  sandbox_manifest_id?: string;
  requires_confirmation?: boolean;
  timeout_ms?: number;
}

export interface MCPInvocationResult {
  invocation_id: string;
  capability_id: string;
  tool_name: string;
  status: "success" | "error" | "timeout" | "denied" | "pending_confirmation";
  result?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
  sandbox_tier: string;
  audit_recorded: boolean;
  verification_evidence?: Record<string, unknown>;
  invoked_at: string;
  completed_at?: string;
}

export interface MCPLiveExecutionFabric {
  fabric_id: string;
  registered_capabilities: number;
  total_invocations: number;
  successful_invocations: number;
  failed_invocations: number;
  denied_invocations: number;
  average_latency_ms: number;
  last_updated: string;
}

export interface MCPHealthCheckResult {
  capability_id: string;
  status: "healthy" | "degraded" | "unavailable";
  latency_ms: number;
  checked_at: string;
  detail: string;
}

export interface MCPResourceTemplate {
  uri_template: string;
  name: string;
  description: string;
  mime_type?: string;
  annotations?: Record<string, unknown>;
}

export interface MCPPromptTemplate {
  prompt_id: string;
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}

export interface MCPRootSpec {
  root_uri: string;
  name: string;
  read_only: boolean;
  capability_id: string;
}

export interface MCPSessionAuthorization {
  session_id: string;
  capability_grants: string[];
  max_risk_tier: "low" | "medium" | "high" | "critical";
  resource_access: string[];
  expires_at?: string;
  created_at: string;
}

export interface MCPProgressEvent {
  progress_token: string;
  total?: number;
  completed?: number;
  message?: string;
  timestamp: string;
}

export interface MCPCapabilityNegotiation {
  negotiation_id: string;
  capability_id: string;
  client_capabilities: string[];
  server_capabilities: string[];
  agreed_protocol_version: string;
  agreed_features: string[];
  unsupported_features: string[];
  negotiated_at: string;
}

const MCP_PROTOCOL_VERSION = "2025-03-26";

const mcpCapabilities = new Map<string, MCPCapabilitySpec>();
const mcpInvocations = new Map<string, MCPInvocationResult>();
const mcpHealthChecks = new Map<string, MCPHealthCheckResult>();
const mcpResources = new Map<string, MCPResourceTemplate>();
const mcpPrompts = new Map<string, MCPPromptTemplate>();
const mcpRoots = new Map<string, MCPRootSpec>();
const mcpSessionAuthorizations = new Map<string, MCPSessionAuthorization>();
const mcpProgressEvents = new Map<string, MCPProgressEvent[]>();
const mcpCapabilityNegotiations = new Map<string, MCPCapabilityNegotiation>();

let totalInvocations = 0;
let successfulInvocations = 0;
let failedInvocations = 0;
let deniedInvocations = 0;
let totalLatencyMs = 0;

export function registerMCPResource(input: Omit<MCPResourceTemplate, never>): MCPResourceTemplate {
  const resource: MCPResourceTemplate = { ...input };
  mcpResources.set(resource.uri_template, resource);
  try { log("info", "mcp_resource_registered", { uri_template: resource.uri_template, name: resource.name }); } catch {}
  return resource;
}

export function listMCPResources(filter?: { capability_id?: string }): MCPResourceTemplate[] {
  const resources = Array.from(mcpResources.values());
  if (!filter?.capability_id) return resources;
  return resources;
}

export function readMCPResource(uriTemplate: string, variables: Record<string, string>): { content: string; mime_type?: string; error?: string } {
  const resource = mcpResources.get(uriTemplate);
  if (!resource) return { content: "", error: `Resource template not found: ${uriTemplate}` };
  let resolvedUri = uriTemplate;
  for (const [key, value] of Object.entries(variables)) {
    resolvedUri = resolvedUri.replace(`{${key}}`, value);
  }
  return { content: `[MCP Resource] ${resource.name}: ${resolvedUri}`, mime_type: resource.mime_type };
}

export function registerMCPPrompt(input: Omit<MCPPromptTemplate, "prompt_id">): MCPPromptTemplate {
  const prompt: MCPPromptTemplate = { ...input, prompt_id: createEntityId("mcp_prompt") };
  mcpPrompts.set(prompt.prompt_id, prompt);
  try { log("info", "mcp_prompt_registered", { prompt_id: prompt.prompt_id, name: prompt.name }); } catch {}
  return prompt;
}

export function listMCPPrompts(filter?: { name?: string }): MCPPromptTemplate[] {
  const prompts = Array.from(mcpPrompts.values());
  if (!filter?.name) return prompts;
  return prompts.filter(p => p.name === filter.name);
}

export function getMCPPrompt(promptId: string): MCPPromptTemplate | undefined {
  return mcpPrompts.get(promptId);
}

export function resolveMCPPrompt(promptId: string, args: Record<string, string>): { messages: Array<{ role: string; content: string }>; error?: string } {
  const prompt = mcpPrompts.get(promptId);
  if (!prompt) return { messages: [], error: `Prompt not found: ${promptId}` };
  const missingArgs = prompt.arguments.filter(a => a.required && !args[a.name]);
  if (missingArgs.length > 0) return { messages: [], error: `Missing required arguments: ${missingArgs.map(a => a.name).join(", ")}` };
  const messages = prompt.messages.map(m => {
    let content = m.content;
    for (const [key, value] of Object.entries(args)) {
      content = content.replace(`{{${key}}}`, value);
    }
    return { role: m.role, content };
  });
  return { messages };
}

export function registerMCPRoot(input: Omit<MCPRootSpec, never>): MCPRootSpec {
  const root: MCPRootSpec = { ...input };
  mcpRoots.set(root.root_uri, root);
  try { log("info", "mcp_root_registered", { root_uri: root.root_uri, name: root.name, read_only: root.read_only }); } catch {}
  return root;
}

export function listMCPRoots(filter?: { capability_id?: string }): MCPRootSpec[] {
  const roots = Array.from(mcpRoots.values());
  if (!filter?.capability_id) return roots;
  return roots.filter(r => r.capability_id === filter.capability_id);
}

export function authorizeMCPSession(input: {
  session_id: string;
  capability_grants: string[];
  max_risk_tier: "low" | "medium" | "high" | "critical";
  resource_access?: string[];
  expires_at?: string;
}): MCPSessionAuthorization {
  const auth: MCPSessionAuthorization = {
    session_id: input.session_id,
    capability_grants: input.capability_grants,
    max_risk_tier: input.max_risk_tier,
    resource_access: input.resource_access ?? [],
    expires_at: input.expires_at,
    created_at: nowIso()
  };
  mcpSessionAuthorizations.set(input.session_id, auth);
  try { log("info", "mcp_session_authorized", { session_id: input.session_id, grants: input.capability_grants.length, max_risk: input.max_risk_tier }); } catch {}
  return auth;
}

export function getMCPSessionAuthorization(sessionId: string): MCPSessionAuthorization | undefined {
  return mcpSessionAuthorizations.get(sessionId);
}

export function revokeMCPSessionAuthorization(sessionId: string): boolean {
  const existed = mcpSessionAuthorizations.delete(sessionId);
  if (existed) try { log("info", "mcp_session_revoked", { session_id: sessionId }); } catch {}
  return existed;
}

export function isMCPSessionAuthorized(sessionId: string, capabilityId: string, toolRiskTier: string): { authorized: boolean; reason?: string } {
  const auth = mcpSessionAuthorizations.get(sessionId);
  if (!auth) return { authorized: false, reason: "No session authorization found" };
  if (auth.expires_at && new Date(auth.expires_at) < new Date()) return { authorized: false, reason: "Session authorization expired" };
  if (!auth.capability_grants.includes(capabilityId) && !auth.capability_grants.includes("*")) return { authorized: false, reason: `Capability ${capabilityId} not granted in session` };
  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  if ((riskOrder[toolRiskTier] ?? 0) > (riskOrder[auth.max_risk_tier] ?? 0)) return { authorized: false, reason: `Tool risk tier ${toolRiskTier} exceeds session max ${auth.max_risk_tier}` };
  return { authorized: true };
}

export function reportMCPProgress(input: { progress_token: string; total?: number; completed?: number; message?: string }): MCPProgressEvent {
  const event: MCPProgressEvent = { progress_token: input.progress_token, total: input.total, completed: input.completed, message: input.message, timestamp: nowIso() };
  const existing = mcpProgressEvents.get(input.progress_token) ?? [];
  existing.push(event);
  mcpProgressEvents.set(input.progress_token, existing);
  return event;
}

export function getMCPProgress(progressToken: string): MCPProgressEvent[] {
  return mcpProgressEvents.get(progressToken) ?? [];
}

export function negotiateMCPCapability(input: {
  capability_id: string;
  client_capabilities: string[];
}): MCPCapabilityNegotiation {
  const capability = mcpCapabilities.get(input.capability_id);
  const serverCapabilities = capability ? ["tools", "resources", "prompts", "roots", "logging", "sampling"] : [];
  const allFeatures = ["tools", "resources.list", "resources.read", "resources.subscribe", "prompts.list", "prompts.get", "roots.list", "logging", "sampling", "completion", "progress"];
  const agreedFeatures = input.client_capabilities.filter(c => allFeatures.includes(c));
  const unsupportedFeatures = input.client_capabilities.filter(c => !allFeatures.includes(c));
  const negotiation: MCPCapabilityNegotiation = {
    negotiation_id: createEntityId("mcp_neg"),
    capability_id: input.capability_id,
    client_capabilities: input.client_capabilities,
    server_capabilities: serverCapabilities,
    agreed_protocol_version: MCP_PROTOCOL_VERSION,
    agreed_features: agreedFeatures,
    unsupported_features: unsupportedFeatures,
    negotiated_at: nowIso()
  };
  mcpCapabilityNegotiations.set(negotiation.negotiation_id, negotiation);
  try { log("info", "mcp_capability_negotiated", { negotiation_id: negotiation.negotiation_id, capability_id: input.capability_id, agreed: agreedFeatures.length, unsupported: unsupportedFeatures.length }); } catch {}
  return negotiation;
}

export function listMCPCapabilityNegotiations(filter?: { capability_id?: string }): MCPCapabilityNegotiation[] {
  const negotiations = Array.from(mcpCapabilityNegotiations.values());
  if (!filter?.capability_id) return negotiations;
  return negotiations.filter(n => n.capability_id === filter.capability_id);
}

export function registerMCPCapability(spec: Omit<MCPCapabilitySpec, "registered_at" | "health_status">): MCPCapabilitySpec {
  const capability: MCPCapabilitySpec = {
    ...spec,
    registered_at: nowIso(),
    health_status: "unknown"
  };

  mcpCapabilities.set(spec.capability_id, capability);

  try {
    log("info", "mcp_capability_registered", {
      capability_id: spec.capability_id,
      name: spec.name,
      tool_count: spec.tools.length,
      risk_tier: spec.risk_tier,
      protocol: spec.protocol
    });
  } catch { /* logging failure should not block registration */ }

  return capability;
}

export function unregisterMCPCapability(capabilityId: string): boolean {
  const existed = mcpCapabilities.delete(capabilityId);
  if (existed) {
    try {
      log("info", "mcp_capability_unregistered", { capability_id: capabilityId });
    } catch { /* logging failure should not block unregistration */ }
  }
  return existed;
}

export function getMCPCapability(capabilityId: string): MCPCapabilitySpec | undefined {
  return mcpCapabilities.get(capabilityId);
}

export function listMCPCapabilities(filter?: {
  risk_tier?: MCPCapabilitySpec["risk_tier"];
  protocol?: MCPCapabilitySpec["protocol"];
  health_status?: MCPCapabilitySpec["health_status"];
  tag?: string;
}): MCPCapabilitySpec[] {
  const capabilities = Array.from(mcpCapabilities.values());
  if (!filter) return capabilities;

  return capabilities.filter(cap => {
    if (filter.risk_tier && cap.risk_tier !== filter.risk_tier) return false;
    if (filter.protocol && cap.protocol !== filter.protocol) return false;
    if (filter.health_status && cap.health_status !== filter.health_status) return false;
    if (filter.tag && !cap.tags.includes(filter.tag)) return false;
    return true;
  });
}

export function resolveMCPTool(capabilityId: string, toolName: string): { capability: MCPCapabilitySpec; tool: MCPToolSpec } | null {
  const capability = mcpCapabilities.get(capabilityId);
  if (!capability) return null;

  const tool = capability.tools.find(t => t.tool_name === toolName);
  if (!tool) return null;

  return { capability, tool };
}

export function resolveMCPToolForNeed(input: {
  need_description: string;
  preferred_tags?: string[];
  max_risk_tier?: MCPCapabilitySpec["risk_tier"];
}): Array<{ capability: MCPCapabilitySpec; tool: MCPToolSpec; relevance_score: number }> {
  const results: Array<{ capability: MCPCapabilitySpec; tool: MCPToolSpec; relevance_score: number }> = [];
  const maxRisk = input.max_risk_tier ?? "high";
  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const maxRiskNum = riskOrder[maxRisk] ?? 2;

  for (const capability of mcpCapabilities.values()) {
    if (riskOrder[capability.risk_tier] > maxRiskNum) continue;
    if (capability.health_status === "unavailable") continue;

    for (const tool of capability.tools) {
      if (riskOrder[tool.risk_tier] > maxRiskNum) continue;

      let score = 0;
      const desc = (input.need_description ?? "").toLowerCase();
      const toolDesc = (tool.description ?? "").toLowerCase();
      const capDesc = (capability.description ?? "").toLowerCase();
      const toolName = tool.tool_name.toLowerCase();

      for (const word of desc.split(/\s+/)) {
        if (word.length < 2) continue;
        if (toolDesc.includes(word)) score += 3;
        if (capDesc.includes(word)) score += 2;
        if (toolName.includes(word)) score += 4;
      }

      if (input.preferred_tags) {
        for (const tag of input.preferred_tags) {
          if (capability.tags.includes(tag)) score += 2;
        }
      }

      if (tool.idempotent) score += 1;
      if (tool.compensable) score += 1;
      if (capability.health_status === "healthy") score += 2;
      if (capability.health_status === "degraded") score += 0;

      results.push({ capability, tool, relevance_score: score });
    }
  }

  return results.sort((a, b) => b.relevance_score - a.relevance_score);
}

export function enforceMCPPolicy(input: {
  capability_id: string;
  tool_name: string;
  session_id?: string;
  sandbox_manifest_id?: string;
}): { allowed: boolean; reason?: string; sandbox_tier: string; audit_recorded: boolean } {
  const resolved = resolveMCPTool(input.capability_id, input.tool_name);
  if (!resolved) {
    return { allowed: false, reason: `MCP capability/tool not found: ${input.capability_id}/${input.tool_name}`, sandbox_tier: "host_readonly", audit_recorded: true };
  }

  const { capability, tool } = resolved;

  if (capability.health_status === "unavailable") {
    return { allowed: false, reason: `MCP capability ${input.capability_id} is unavailable`, sandbox_tier: capability.sandbox_requirement === "isolated" ? "isolated_mutation" : "guarded_mutation", audit_recorded: true };
  }

  const session = input.session_id ? store.computerUseSessions.get(input.session_id) : undefined;
  const sessionTier = session?.sandbox_tier ?? "guarded_mutation";
  const requiredTier = capability.sandbox_requirement === "isolated" ? "isolated_mutation" : capability.sandbox_requirement === "guarded" ? "guarded_mutation" : "host_readonly";
  const tierOrder: Record<string, number> = { host_readonly: 0, guarded_mutation: 1, isolated_mutation: 2 };

  if (tierOrder[sessionTier] < tierOrder[requiredTier]) {
    return { allowed: false, reason: `Session sandbox tier ${sessionTier} insufficient for MCP capability requiring ${requiredTier}`, sandbox_tier: requiredTier, audit_recorded: true };
  }

  if (tool.risk_tier === "critical" && !tool.requires_confirmation) {
    return { allowed: false, reason: `Critical-risk tool ${input.tool_name} requires explicit confirmation`, sandbox_tier: requiredTier, audit_recorded: true };
  }

  if (input.sandbox_manifest_id) {
    const manifest = store.sandboxManifests.get(input.sandbox_manifest_id);
    if (manifest && (manifest.status === "expired" || manifest.status === "revoked")) {
      return { allowed: false, reason: `Sandbox manifest is ${manifest.status}`, sandbox_tier: requiredTier, audit_recorded: true };
    }
  }

  if (input.session_id) {
    const sessionAuth = isMCPSessionAuthorized(input.session_id, input.capability_id, tool.risk_tier);
    if (!sessionAuth.authorized) {
      return { allowed: false, reason: sessionAuth.reason, sandbox_tier: requiredTier, audit_recorded: true };
    }
  }

  return { allowed: true, sandbox_tier: requiredTier, audit_recorded: true };
}

export async function invokeMCPTool(input: MCPInvocationRequest): Promise<MCPInvocationResult> {
  const invocationId = createEntityId("mcp_inv");
  const startTime = Date.now();
  const sandboxTier = "guarded_mutation";

  const policyResult = enforceMCPPolicy({
    capability_id: input.capability_id,
    tool_name: input.tool_name,
    session_id: input.session_id,
    sandbox_manifest_id: input.sandbox_manifest_id
  });

  if (!policyResult.allowed) {
    totalInvocations++;
    deniedInvocations++;
    const result: MCPInvocationResult = {
      invocation_id: invocationId,
      capability_id: input.capability_id,
      tool_name: input.tool_name,
      status: "denied",
      error: policyResult.reason,
      duration_ms: Date.now() - startTime,
      sandbox_tier: policyResult.sandbox_tier,
      audit_recorded: true,
      invoked_at: nowIso()
    };
    mcpInvocations.set(invocationId, result);
    return result;
  }

  const resolved = resolveMCPTool(input.capability_id, input.tool_name);
  if (!resolved) {
    totalInvocations++;
    failedInvocations++;
    const result: MCPInvocationResult = {
      invocation_id: invocationId,
      capability_id: input.capability_id,
      tool_name: input.tool_name,
      status: "error",
      error: "Capability or tool not found after policy check",
      duration_ms: Date.now() - startTime,
      sandbox_tier: policyResult.sandbox_tier,
      audit_recorded: true,
      invoked_at: nowIso()
    };
    mcpInvocations.set(invocationId, result);
    return result;
  }

  if (resolved.tool.requires_confirmation && input.requires_confirmation !== true) {
    totalInvocations++;
    const result: MCPInvocationResult = {
      invocation_id: invocationId,
      capability_id: input.capability_id,
      tool_name: input.tool_name,
      status: "pending_confirmation",
      duration_ms: Date.now() - startTime,
      sandbox_tier: policyResult.sandbox_tier,
      audit_recorded: true,
      invoked_at: nowIso()
    };
    mcpInvocations.set(invocationId, result);
    return result;
  }

  try {
    const execResult = await executeMCPToolInternal(resolved.capability, resolved.tool, input);

    totalInvocations++;
    if (execResult.success) {
      successfulInvocations++;
    } else {
      failedInvocations++;
    }
    totalLatencyMs += execResult.duration_ms;

    const result: MCPInvocationResult = {
      invocation_id: invocationId,
      capability_id: input.capability_id,
      tool_name: input.tool_name,
      status: execResult.success ? "success" : "error",
      result: execResult.result,
      error: execResult.error,
      duration_ms: execResult.duration_ms,
      sandbox_tier: policyResult.sandbox_tier,
      audit_recorded: true,
      verification_evidence: execResult.verification_evidence,
      invoked_at: nowIso(),
      completed_at: nowIso()
    };

    mcpInvocations.set(invocationId, result);

    try {
      log("info", "mcp_tool_invocation", {
        invocation_id: invocationId,
        capability_id: input.capability_id,
        tool_name: input.tool_name,
        status: result.status,
        duration_ms: result.duration_ms,
        task_id: input.task_id,
        session_id: input.session_id
      });
    } catch { /* logging failure should not affect invocation result */ }

    return result;
  } catch (error) {
    totalInvocations++;
    failedInvocations++;
    totalLatencyMs += Date.now() - startTime;

    const result: MCPInvocationResult = {
      invocation_id: invocationId,
      capability_id: input.capability_id,
      tool_name: input.tool_name,
      status: "error",
      error: (error as Error).message.slice(0, 500),
      duration_ms: Date.now() - startTime,
      sandbox_tier: policyResult.sandbox_tier,
      audit_recorded: true,
      invoked_at: nowIso(),
      completed_at: nowIso()
    };

    mcpInvocations.set(invocationId, result);
    return result;
  }
}

async function executeMCPToolInternal(
  capability: MCPCapabilitySpec,
  tool: MCPToolSpec,
  request: MCPInvocationRequest
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
  verification_evidence?: Record<string, unknown>;
}> {
  const startTime = Date.now();
  const timeoutMs = request.timeout_ms ?? tool.estimated_latency_ms ?? 30000;

  try {
    switch (capability.protocol) {
      case "stdio": {
        const result = await executeStdioMCP(capability, tool, request, timeoutMs);
        return { success: true, result, duration_ms: Date.now() - startTime, verification_evidence: { protocol: "stdio", tool_name: tool.tool_name } };
      }
      case "sse":
      case "streamable_http": {
        const result = await executeHTTPMCP(capability, tool, request, timeoutMs);
        return { success: true, result, duration_ms: Date.now() - startTime, verification_evidence: { protocol: capability.protocol, tool_name: tool.tool_name } };
      }
      case "grpc": {
        return { success: false, error: "gRPC MCP execution not yet implemented locally", duration_ms: Date.now() - startTime };
      }
      default:
        return { success: false, error: `Unknown protocol: ${capability.protocol}`, duration_ms: Date.now() - startTime };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message.slice(0, 500), duration_ms: Date.now() - startTime };
  }
}

async function executeStdioMCP(
  capability: MCPCapabilitySpec,
  tool: MCPToolSpec,
  request: MCPInvocationRequest,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const serverCommand = capability.server_uri;
  if (!serverCommand) throw new Error("No server_uri configured for stdio MCP capability");

  const mcpRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: tool.tool_name,
      arguments: request.arguments
    }
  };

  const { spawn } = await import("node:child_process");
  const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(serverCommand, [], {
      env: { ...process.env, MCP_SERVER: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("MCP stdio execution timed out"));
    }, timeoutMs);

    child.on("close", (code: number) => {
      clearTimeout(timer);
      resolve({ stdout, stderr });
    });

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    child.stdin.write(JSON.stringify(mcpRequest));
    child.stdin.end();
  });

  try {
    const parsed = JSON.parse(result.stdout);
    return parsed.result ?? { stdout: result.stdout.slice(0, 10000), stderr: result.stderr.slice(0, 1000) };
  } catch {
    return { raw_stdout: result.stdout.slice(0, 10000), raw_stderr: result.stderr.slice(0, 1000) };
  }
}

async function executeHTTPMCP(
  capability: MCPCapabilitySpec,
  tool: MCPToolSpec,
  request: MCPInvocationRequest,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const serverUri = capability.server_uri;
  if (!serverUri) throw new Error("No server_uri configured for HTTP MCP capability");

  const mcpRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: tool.tool_name,
      arguments: request.arguments
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(serverUri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcpRequest),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`MCP server returned HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runMCPHealthCheck(capabilityId: string): Promise<MCPHealthCheckResult> {
  const capability = mcpCapabilities.get(capabilityId);
  if (!capability) {
    return {
      capability_id: capabilityId,
      status: "unavailable",
      latency_ms: 0,
      checked_at: nowIso(),
      detail: "Capability not found"
    };
  }

  const startTime = Date.now();

  try {
    switch (capability.protocol) {
      case "stdio": {
        if (!capability.server_uri) {
          const result: MCPHealthCheckResult = { capability_id: capabilityId, status: "unavailable", latency_ms: Date.now() - startTime, checked_at: nowIso(), detail: "No server_uri configured" };
          capability.health_status = "unavailable";
          capability.last_health_check = result.checked_at;
          mcpHealthChecks.set(capabilityId, result);
          return result;
        }

        const { spawn } = await import("node:child_process");

        try {
          await new Promise<void>((resolve, reject) => {
            const child = spawn(capability.server_uri!, [], {
              env: { ...process.env, MCP_SERVER: "1" },
              stdio: ["pipe", "pipe", "pipe"]
            });
            const timer = setTimeout(() => { child.kill(); reject(new Error("timeout")); }, 5000);
            child.on("close", () => { clearTimeout(timer); resolve(); });
            child.on("error", (err: Error) => { clearTimeout(timer); reject(err); });
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }));
            child.stdin.end();
          });
          const result: MCPHealthCheckResult = { capability_id: capabilityId, status: "healthy", latency_ms: Date.now() - startTime, checked_at: nowIso(), detail: "Server responded to ping" };
          capability.health_status = "healthy";
          capability.last_health_check = result.checked_at;
          mcpHealthChecks.set(capabilityId, result);
          return result;
        } catch (error) {
          const result: MCPHealthCheckResult = { capability_id: capabilityId, status: "degraded", latency_ms: Date.now() - startTime, checked_at: nowIso(), detail: `Ping failed: ${(error as Error).message.slice(0, 200)}` };
          capability.health_status = "degraded";
          capability.last_health_check = result.checked_at;
          mcpHealthChecks.set(capabilityId, result);
          return result;
        }
      }
      case "sse":
      case "streamable_http": {
        if (!capability.server_uri) {
          const result: MCPHealthCheckResult = { capability_id: capabilityId, status: "unavailable", latency_ms: Date.now() - startTime, checked_at: nowIso(), detail: "No server_uri configured" };
          capability.health_status = "unavailable";
          capability.last_health_check = result.checked_at;
          mcpHealthChecks.set(capabilityId, result);
          return result;
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(capability.server_uri, { method: "GET", signal: controller.signal });
          clearTimeout(timeout);

          const result: MCPHealthCheckResult = {
            capability_id: capabilityId,
            status: response.ok ? "healthy" : "degraded",
            latency_ms: Date.now() - startTime,
            checked_at: nowIso(),
            detail: `HTTP ${response.status} ${response.statusText}`
          };
          capability.health_status = result.status;
          capability.last_health_check = result.checked_at;
          mcpHealthChecks.set(capabilityId, result);
          return result;
        } catch (error) {
          const result: MCPHealthCheckResult = { capability_id: capabilityId, status: "unavailable", latency_ms: Date.now() - startTime, checked_at: nowIso(), detail: `Connection failed: ${(error as Error).message.slice(0, 200)}` };
          capability.health_status = "unavailable";
          capability.last_health_check = result.checked_at;
          mcpHealthChecks.set(capabilityId, result);
          return result;
        }
      }
      default: {
        const result: MCPHealthCheckResult = { capability_id: capabilityId, status: "degraded", latency_ms: 0, checked_at: nowIso(), detail: `Health check not implemented for protocol: ${capability.protocol}` };
        capability.health_status = "degraded";
        capability.last_health_check = result.checked_at;
        mcpHealthChecks.set(capabilityId, result);
        return result;
      }
    }
  } catch (error) {
    const result: MCPHealthCheckResult = { capability_id: capabilityId, status: "unavailable", latency_ms: Date.now() - startTime, checked_at: nowIso(), detail: `Health check error: ${(error as Error).message.slice(0, 200)}` };
    capability.health_status = "unavailable";
    capability.last_health_check = result.checked_at;
    mcpHealthChecks.set(capabilityId, result);
    return result;
  }
}

export async function runAllMCPHealthChecks(): Promise<MCPHealthCheckResult[]> {
  const results: MCPHealthCheckResult[] = [];
  for (const capabilityId of mcpCapabilities.keys()) {
    results.push(await runMCPHealthCheck(capabilityId));
  }
  return results;
}

export function getMCPInvocation(invocationId: string): MCPInvocationResult | undefined {
  return mcpInvocations.get(invocationId);
}

export function listMCPInvocations(filter?: {
  capability_id?: string;
  tool_name?: string;
  status?: MCPInvocationResult["status"];
  task_id?: string;
}): MCPInvocationResult[] {
  const invocations = Array.from(mcpInvocations.values());
  if (!filter) return invocations;

  return invocations.filter(inv => {
    if (filter.capability_id && inv.capability_id !== filter.capability_id) return false;
    if (filter.tool_name && inv.tool_name !== filter.tool_name) return false;
    if (filter.status && inv.status !== filter.status) return false;
    if (filter.task_id) {
      const stored = mcpInvocations.get(inv.invocation_id);
      if (!stored) return false;
    }
    return true;
  });
}

export function getMCPLiveFabricStatus(): MCPLiveExecutionFabric {
  return {
    fabric_id: createEntityId("mcp_fabric"),
    registered_capabilities: mcpCapabilities.size,
    total_invocations: totalInvocations,
    successful_invocations: successfulInvocations,
    failed_invocations: failedInvocations,
    denied_invocations: deniedInvocations,
    average_latency_ms: totalInvocations > 0 ? Math.round(totalLatencyMs / totalInvocations) : 0,
    last_updated: nowIso()
  };
}

export function mcpCapabilityToDescriptor(cap: MCPCapabilitySpec): CapabilityDescriptor {
  return {
    capability_id: cap.capability_id,
    name: cap.name,
    kind: "mcp_server",
    source: "mcp",
    summary: cap.description,
    tags: cap.tags
  };
}

export function registerBuiltinMCPCapabilities(): MCPCapabilitySpec[] {
  const builtin: MCPCapabilitySpec[] = [
    {
      capability_id: "mcp.filesystem.local",
      name: "Local Filesystem MCP",
      description: "Standardized file and directory access for local workspaces.",
      protocol: "stdio",
      tools: [
        {
          tool_name: "read_file",
          description: "Read file contents from the local filesystem",
          input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
          risk_tier: "low",
          requires_confirmation: false,
          idempotent: true,
          compensable: false
        },
        {
          tool_name: "write_file",
          description: "Write content to a file on the local filesystem",
          input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
          risk_tier: "medium",
          requires_confirmation: true,
          idempotent: false,
          compensable: true
        },
        {
          tool_name: "list_directory",
          description: "List directory contents",
          input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
          risk_tier: "low",
          requires_confirmation: false,
          idempotent: true,
          compensable: false
        }
      ],
      risk_tier: "medium",
      sandbox_requirement: "guarded",
      tags: ["files", "filesystem", "local"],
      version: "1.0.0",
      registered_at: nowIso(),
      health_status: "unknown"
    },
    {
      capability_id: "mcp.shell.local",
      name: "Local Shell MCP",
      description: "Execute shell commands on the local machine with sandbox enforcement.",
      protocol: "stdio",
      tools: [
        {
          tool_name: "execute_command",
          description: "Execute a shell command",
          input_schema: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" }, timeout_ms: { type: "number" } }, required: ["command"] },
          risk_tier: "high",
          requires_confirmation: true,
          idempotent: false,
          compensable: false,
          estimated_latency_ms: 5000
        }
      ],
      risk_tier: "high",
      sandbox_requirement: "isolated",
      tags: ["shell", "command", "local", "execution"],
      version: "1.0.0",
      registered_at: nowIso(),
      health_status: "unknown"
    },
    {
      capability_id: "mcp.browser.local",
      name: "Local Browser MCP",
      description: "Browser automation and web access through MCP protocol.",
      protocol: "streamable_http",
      tools: [
        {
          tool_name: "navigate",
          description: "Navigate to a URL",
          input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
          risk_tier: "low",
          requires_confirmation: false,
          idempotent: true,
          compensable: false
        },
        {
          tool_name: "screenshot",
          description: "Capture a screenshot of the current page",
          input_schema: { type: "object", properties: {} },
          risk_tier: "low",
          requires_confirmation: false,
          idempotent: true,
          compensable: false
        },
        {
          tool_name: "click_element",
          description: "Click an element on the page",
          input_schema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] },
          risk_tier: "medium",
          requires_confirmation: true,
          idempotent: false,
          compensable: false
        }
      ],
      risk_tier: "medium",
      sandbox_requirement: "guarded",
      tags: ["browser", "web", "automation"],
      version: "1.0.0",
      registered_at: nowIso(),
      health_status: "unknown"
    }
  ];

  for (const spec of builtin) {
    if (!mcpCapabilities.has(spec.capability_id)) {
      mcpCapabilities.set(spec.capability_id, spec);
    }
  }

  registerMCPResource({
    uri_template: "file:///{path}",
    name: "Local Filesystem Resource",
    description: "Access local filesystem files by path",
    mime_type: "application/octet-stream"
  });

  registerMCPResource({
    uri_template: "memory:///{memory_id}",
    name: "Memory Item Resource",
    description: "Access memory items by ID",
    mime_type: "application/json"
  });

  registerMCPPrompt({
    name: "task_execution",
    description: "Standard task execution prompt template",
    arguments: [
      { name: "intent", description: "The task intent", required: true },
      { name: "context", description: "Additional context", required: false }
    ],
    messages: [
      { role: "system", content: "You are a task execution agent. Execute the following task carefully and report results." },
      { role: "user", content: "Execute task: {{intent}}\n\nContext: {{context}}" }
    ]
  });

  registerMCPPrompt({
    name: "verification_check",
    description: "Verification check prompt template",
    arguments: [
      { name: "artifact", description: "The artifact to verify", required: true },
      { name: "criteria", description: "Verification criteria", required: true }
    ],
    messages: [
      { role: "system", content: "You are a verification agent. Check the artifact against the criteria and report pass/fail." },
      { role: "user", content: "Verify artifact: {{artifact}}\n\nCriteria: {{criteria}}" }
    ]
  });

  registerMCPRoot({
    root_uri: "file:///workspace",
    name: "Workspace Root",
    read_only: false,
    capability_id: "mcp.filesystem.local"
  });

  registerMCPRoot({
    root_uri: "file:///system",
    name: "System Root (Read-Only)",
    read_only: true,
    capability_id: "mcp.filesystem.local"
  });

  return builtin;
}
