import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export interface CQSEndpointMapping {
  mapping_id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  cqs_type: "command" | "query" | "event";
  command_name?: string;
  query_name?: string;
  event_type?: string;
  is_wrapped: boolean;
  created_at: string;
}

export interface EgressCheckResult {
  allowed: boolean;
  rule_id?: string;
  reason?: string;
  matched_destination?: string;
  timestamp: string;
}

const endpointMappings = new Map<string, CQSEndpointMapping>();

export function registerCQSEndpoint(input: {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  cqs_type: "command" | "query" | "event";
  command_name?: string;
  query_name?: string;
  event_type?: string;
}): CQSEndpointMapping {
  const key = `${input.method}:${input.path}`;
  const mapping: CQSEndpointMapping = {
    mapping_id: createEntityId("cqsmap"),
    method: input.method,
    path: input.path,
    cqs_type: input.cqs_type,
    command_name: input.command_name,
    query_name: input.query_name,
    event_type: input.event_type,
    is_wrapped: true,
    created_at: nowIso()
  };
  endpointMappings.set(key, mapping);

  recordAudit("cqs_middleware.endpoint_registered", {
    mapping_id: mapping.mapping_id,
    method: input.method,
    path: input.path,
    cqs_type: input.cqs_type
  });

  return mapping;
}

export function autoWrapEndpointsAsCQS(): CQSEndpointMapping[] {
  const mappings: CQSEndpointMapping[] = [];

  const commandEndpoints = [
    { method: "POST" as const, path: "/api/local/tasks", command_name: "createTask" },
    { method: "POST" as const, path: "/api/local/tasks/:taskId/interrupt", command_name: "interruptTask" },
    { method: "POST" as const, path: "/api/local/tasks/:taskId/correct", command_name: "correctTask" },
    { method: "POST" as const, path: "/api/local/tasks/:taskId/redirect", command_name: "redirectTask" },
    { method: "POST" as const, path: "/api/local/sandbox-executor/execute", command_name: "executeInSandbox" },
    { method: "POST" as const, path: "/api/local/sandbox-executor/execute-async", command_name: "executeInSandboxAsync" },
    { method: "POST" as const, path: "/api/local/sandbox-executor/kill", command_name: "killSandboxProcess" },
    { method: "POST" as const, path: "/api/local/model/call", command_name: "callLLM" },
    { method: "POST" as const, path: "/api/local/automation/trigger", command_name: "triggerAutomation" },
    { method: "POST" as const, path: "/api/local/execution-steps/:stepId/fail", command_name: "failExecutionStep" },
    { method: "POST" as const, path: "/api/local/runtime/maintenance-cycle", command_name: "runMaintenanceCycle" },
    { method: "POST" as const, path: "/api/local/sandbox-leases/enforce-expiry", command_name: "enforceSandboxLeaseExpiry" },
    { method: "POST" as const, path: "/api/local/worker-sessions/detect-expired", command_name: "detectExpiredWorkerSessions" },
    { method: "POST" as const, path: "/api/local/execution-steps/enforce-timeouts", command_name: "enforceExecutionStepTimeouts" },
    { method: "DELETE" as const, path: "/api/local/memory/documents/:docId", command_name: "deleteMemoryDocument" },
    { method: "POST" as const, path: "/api/local/policy/pdp/enforce", command_name: "enforcePDP" }
  ];

  const queryEndpoints = [
    { method: "GET" as const, path: "/api/local/tasks", query_name: "listTasks" },
    { method: "GET" as const, path: "/api/local/tasks/:taskId", query_name: "getTask" },
    { method: "GET" as const, path: "/api/local/capabilities", query_name: "listCapabilities" },
    { method: "GET" as const, path: "/api/local/evidence/graph/:taskId", query_name: "getEvidenceGraph" },
    { method: "GET" as const, path: "/api/local/model/cost-summary", query_name: "getModelCostSummary" },
    { method: "GET" as const, path: "/api/local/observability/traces", query_name: "listTraces" },
    { method: "GET" as const, path: "/api/local/execution-steps/cost-summary/:taskId", query_name: "getStepCostSummary" },
    { method: "GET" as const, path: "/api/local/model/quotas", query_name: "getAllProviderQuotas" },
    { method: "GET" as const, path: "/api/local/sandbox-executor/processes", query_name: "listActiveSandboxProcesses" },
    { method: "GET" as const, path: "/api/local/operational-metrics", query_name: "getOperationalMetrics" },
    { method: "GET" as const, path: "/api/local/slo-alerts", query_name: "listSLOAlerts" },
    { method: "GET" as const, path: "/api/local/wiki", query_name: "listWikiPages" },
    { method: "GET" as const, path: "/api/local/memory/directory", query_name: "listMemoryDirectory" }
  ];

  const eventEndpoints = [
    { method: "POST" as const, path: "/api/local/automation/match-event", event_type: "automation.event_matched" },
    { method: "POST" as const, path: "/api/local/cqs/event", event_type: "cqs.event_published" },
    { method: "POST" as const, path: "/api/local/execution-steps/pipeline", event_type: "pipeline.steps_created" },
    { method: "POST" as const, path: "/api/local/execution-steps/advance-pipeline", event_type: "pipeline.step_advanced" }
  ];

  for (const ep of commandEndpoints) {
    mappings.push(registerCQSEndpoint({ ...ep, cqs_type: "command" }));
  }
  for (const ep of queryEndpoints) {
    mappings.push(registerCQSEndpoint({ ...ep, cqs_type: "query" }));
  }
  for (const ep of eventEndpoints) {
    mappings.push(registerCQSEndpoint({ ...ep, cqs_type: "event" }));
  }

  recordAudit("cqs_middleware.auto_wrap_completed", {
    command_count: commandEndpoints.length,
    query_count: queryEndpoints.length,
    event_count: eventEndpoints.length,
    total_count: mappings.length
  });

  return mappings;
}

export function listCQSEndpointMappings(filter?: { cqs_type?: "command" | "query" | "event" }): CQSEndpointMapping[] {
  let result = [...endpointMappings.values()];
  if (filter?.cqs_type) result = result.filter(m => m.cqs_type === filter.cqs_type);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

export function classifyEndpoint(method: string, path: string): "command" | "query" | "event" | "unknown" {
  const key = `${method.toUpperCase()}:${path}`;
  const mapping = endpointMappings.get(key);
  return mapping?.cqs_type ?? "unknown";
}

export function checkEgressForHTTPCall(input: {
  destination_url: string;
  method: string;
  headers?: Record<string, string>;
  task_id?: string;
  sandbox_manifest_id?: string;
}): EgressCheckResult {
  const url = new URL(input.destination_url);
  const hostname = url.hostname;
  const protocol = url.protocol.replace(":", "");

  const noSilentEgressRule = [...store.egressRules.values()]
    .filter(r => r.enabled)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const rule of noSilentEgressRule) {
    const ruleDest = rule.destination_pattern;
    const ruleProtocol = rule.protocol;

    if (ruleProtocol !== "any" && ruleProtocol !== protocol) {
      continue;
    }

    if (ruleDest === "*" || ruleDest === hostname || hostname.endsWith(`.${ruleDest}`) || ruleDest.endsWith(`.${hostname}`)) {
      if (rule.action === "allow") {
        recordAudit("egress_middleware.allowed", {
          rule_id: rule.rule_id,
          destination: input.destination_url,
          hostname,
          protocol,
          task_id: input.task_id
        });

        return {
          allowed: true,
          rule_id: rule.rule_id,
          matched_destination: hostname,
          timestamp: nowIso()
        };
      } else if (rule.action === "deny") {
        recordAudit("egress_middleware.blocked_by_rule", {
          rule_id: rule.rule_id,
          destination: input.destination_url,
          hostname,
          protocol,
          task_id: input.task_id
        });

        return {
          allowed: false,
          rule_id: rule.rule_id,
          reason: `Egress denied by rule '${rule.name}': ${hostname}`,
          timestamp: nowIso()
        };
      }
    }
  }

  if (input.sandbox_manifest_id) {
    const manifest = store.sandboxManifests.get(input.sandbox_manifest_id);
    if (manifest && manifest.tier === "isolated_mutation") {
      recordAudit("egress_middleware.blocked_sandbox", {
        destination: input.destination_url,
        manifest_id: input.sandbox_manifest_id,
        task_id: input.task_id
      });

      return {
        allowed: false,
        reason: `Network egress blocked by sandbox (isolated_mutation tier): ${hostname}`,
        timestamp: nowIso()
      };
    }
  }

  const localhostPatterns = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
  if (localhostPatterns.includes(hostname)) {
    return {
      allowed: true,
      rule_id: "localhost_implicit",
      matched_destination: hostname,
      timestamp: nowIso()
    };
  }

  recordAudit("egress_middleware.blocked_no_rule", {
    destination: input.destination_url,
    hostname,
    protocol,
    task_id: input.task_id
  });

  return {
    allowed: false,
    reason: `No egress rule allows connection to ${hostname} (${protocol})`,
    timestamp: nowIso()
  };
}

export function createEgressHTTPMiddleware() {
  return async function egressMiddleware(
    destinationUrl: string,
    method: string,
    options?: {
      headers?: Record<string, string>;
      body?: unknown;
      task_id?: string;
      sandbox_manifest_id?: string;
    }
  ): Promise<{ allowed: boolean; check: EgressCheckResult }> {
    const check = checkEgressForHTTPCall({
      destination_url: destinationUrl,
      method,
      headers: options?.headers,
      task_id: options?.task_id,
      sandbox_manifest_id: options?.sandbox_manifest_id
    });

    return { allowed: check.allowed, check };
  };
}

export function getEgressRuleManagementData(): {
  active_rules: Array<{
    rule_id: string;
    name: string;
    destination_pattern: string;
    destination_type: string;
    action: string;
    protocol: string;
    priority: number;
  }>;
  recent_checks: Array<{
    destination: string;
    allowed: boolean;
    rule_id?: string;
    reason?: string;
    timestamp: string;
  }>;
} {
  const activeRules = [...store.egressRules.values()]
    .filter(r => r.enabled)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map(r => ({
      rule_id: r.rule_id,
      name: r.name,
      destination_pattern: r.destination_pattern,
      destination_type: r.destination_type,
      action: r.action,
      protocol: r.protocol,
      priority: r.priority ?? 0
    }));

  const recentChecks = store.egressAudits.toArray()
    .slice(-50)
    .map((e: Record<string, unknown>) => ({
      destination: (e.destination ?? "") as string,
      allowed: (e.allowed ?? false) as boolean,
      rule_id: (e.rule_id ?? undefined) as string | undefined,
      reason: (e.reason ?? undefined) as string | undefined,
      timestamp: (e.timestamp ?? e.created_at ?? "") as string
    }));

  return { active_rules: activeRules, recent_checks: recentChecks };
}
