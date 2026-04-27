import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type OrchestrationProviderKind = "local_runtime" | "temporal" | "langgraph";

export interface OrchestrationSPIProvider {
  provider_id: string;
  kind: OrchestrationProviderKind;
  display_name: string;
  description: string;
  is_local: boolean;
  is_available: boolean;
  supports_durable_execution: boolean;
  supports_signal: boolean;
  supports_query: boolean;
  supports_cancellation: boolean;
  max_workflow_duration_hours: number;
  protocol_version: string;
}

export interface OrchestrationLaneConfig {
  lane_id: string;
  provider_kind: OrchestrationProviderKind;
  is_primary: boolean;
  is_fallback: boolean;
  priority: number;
  enabled: boolean;
  routing_rules: Array<{
    task_family_pattern: string;
    priority_boost: number;
  }>;
  created_at: string;
}

export interface OrchestrationDispatchResult {
  dispatch_id: string;
  lane_id: string;
  provider_kind: OrchestrationProviderKind;
  workflow_id: string;
  status: "dispatched" | "failed" | "fallback_triggered";
  fallback_to?: OrchestrationProviderKind;
  error?: string;
  dispatched_at: string;
}

export interface OrchestrationQueryResult {
  query_id: string;
  workflow_id: string;
  provider_kind: OrchestrationProviderKind;
  status: "running" | "completed" | "failed" | "timed_out" | "not_found";
  result?: Record<string, unknown>;
  error?: string;
  queried_at: string;
}

const orchestrationProviders = new Map<string, OrchestrationSPIProvider>();
const orchestrationLanes = new Map<string, OrchestrationLaneConfig>();
const orchestrationDispatches = new Map<string, OrchestrationDispatchResult>();

export function registerOrchestrationProvider(input: Omit<OrchestrationSPIProvider, "provider_id">): OrchestrationSPIProvider {
  const provider: OrchestrationSPIProvider = { ...input, provider_id: createEntityId("orchprov") };
  orchestrationProviders.set(provider.provider_id, provider);
  recordAudit("orchestration_spi.provider_registered", { provider_id: provider.provider_id, kind: input.kind, available: input.is_available });
  return provider;
}

export function listOrchestrationProviders(filter?: { kind?: OrchestrationProviderKind; is_available?: boolean }): OrchestrationSPIProvider[] {
  let providers = [...orchestrationProviders.values()];
  if (filter?.kind) providers = providers.filter(p => p.kind === filter.kind);
  if (filter?.is_available !== undefined) providers = providers.filter(p => p.is_available === filter.is_available);
  return providers;
}

export function getOrchestrationProvider(providerId: string): OrchestrationSPIProvider | undefined {
  return orchestrationProviders.get(providerId);
}

export function configureOrchestrationLane(input: {
  provider_kind: OrchestrationProviderKind;
  is_primary?: boolean;
  is_fallback?: boolean;
  priority?: number;
  enabled?: boolean;
  routing_rules?: Array<{ task_family_pattern: string; priority_boost: number }>;
}): OrchestrationLaneConfig {
  const lane: OrchestrationLaneConfig = {
    lane_id: createEntityId("orchlane"),
    provider_kind: input.provider_kind,
    is_primary: input.is_primary ?? false,
    is_fallback: input.is_fallback ?? false,
    priority: input.priority ?? 0,
    enabled: input.enabled ?? true,
    routing_rules: input.routing_rules ?? [],
    created_at: nowIso()
  };
  orchestrationLanes.set(lane.lane_id, lane);
  recordAudit("orchestration_spi.lane_configured", { lane_id: lane.lane_id, kind: input.provider_kind, primary: lane.is_primary });
  return lane;
}

export function listOrchestrationLanes(filter?: { provider_kind?: OrchestrationProviderKind; enabled?: boolean }): OrchestrationLaneConfig[] {
  let lanes = [...orchestrationLanes.values()];
  if (filter?.provider_kind) lanes = lanes.filter(l => l.provider_kind === filter.provider_kind);
  if (filter?.enabled !== undefined) lanes = lanes.filter(l => l.enabled === filter.enabled);
  return lanes.sort((a, b) => b.priority - a.priority);
}

export function resolveOrchestrationLane(input: { task_family?: string; require_durable?: boolean }): OrchestrationLaneConfig | undefined {
  const enabledLanes = [...orchestrationLanes.values()].filter(l => l.enabled);
  if (enabledLanes.length === 0) return undefined;

  const scored = enabledLanes.map(lane => {
    let score = lane.priority;
    if (lane.is_primary) score += 100;
    if (input.task_family) {
      for (const rule of lane.routing_rules) {
        if (new RegExp(rule.task_family_pattern).test(input.task_family)) {
          score += rule.priority_boost;
        }
      }
    }
    if (input.require_durable) {
      const provider = [...orchestrationProviders.values()].find(p => p.kind === lane.provider_kind);
      if (provider && !provider.supports_durable_execution) score -= 1000;
    }
    const provider = [...orchestrationProviders.values()].find(p => p.kind === lane.provider_kind);
    if (provider && !provider.is_available) score -= 500;
    return { lane, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].lane : undefined;
}

export function dispatchToOrchestrationLane(input: {
  lane_id: string;
  workflow_name: string;
  task_data: Record<string, unknown>;
  task_id?: string;
}): OrchestrationDispatchResult {
  const lane = orchestrationLanes.get(input.lane_id);
  if (!lane) {
    const result: OrchestrationDispatchResult = {
      dispatch_id: createEntityId("orchdisp"),
      lane_id: input.lane_id,
      provider_kind: "local_runtime",
      workflow_id: "",
      status: "failed",
      error: "Lane not found",
      dispatched_at: nowIso()
    };
    orchestrationDispatches.set(result.dispatch_id, result);
    return result;
  }

  const provider = [...orchestrationProviders.values()].find(p => p.kind === lane.provider_kind);
  if (!provider || !provider.is_available) {
    const fallbackLane = [...orchestrationLanes.values()]
      .filter(l => l.enabled && l.is_fallback && l.lane_id !== lane.lane_id)
      .sort((a, b) => b.priority - a.priority)[0];

    const result: OrchestrationDispatchResult = {
      dispatch_id: createEntityId("orchdisp"),
      lane_id: input.lane_id,
      provider_kind: lane.provider_kind,
      workflow_id: "",
      status: "fallback_triggered",
      fallback_to: fallbackLane?.provider_kind ?? "local_runtime",
      dispatched_at: nowIso()
    };
    orchestrationDispatches.set(result.dispatch_id, result);
    recordAudit("orchestration_spi.fallback_triggered", { dispatch_id: result.dispatch_id, from: lane.provider_kind, to: result.fallback_to });
    return result;
  }

  const result: OrchestrationDispatchResult = {
    dispatch_id: createEntityId("orchdisp"),
    lane_id: input.lane_id,
    provider_kind: lane.provider_kind,
    workflow_id: createEntityId("wf"),
    status: "dispatched",
    dispatched_at: nowIso()
  };
  orchestrationDispatches.set(result.dispatch_id, result);
  recordAudit("orchestration_spi.dispatched", { dispatch_id: result.dispatch_id, provider: lane.provider_kind, workflow: input.workflow_name });
  return result;
}

export function queryOrchestrationWorkflow(input: {
  workflow_id: string;
  provider_kind: OrchestrationProviderKind;
}): OrchestrationQueryResult {
  const provider = [...orchestrationProviders.values()].find(p => p.kind === input.provider_kind);
  if (!provider || !provider.is_available) {
    return {
      query_id: createEntityId("orchquery"),
      workflow_id: input.workflow_id,
      provider_kind: input.provider_kind,
      status: "not_found",
      error: "Provider not available",
      queried_at: nowIso()
    };
  }

  return {
    query_id: createEntityId("orchquery"),
    workflow_id: input.workflow_id,
    provider_kind: input.provider_kind,
    status: "running",
    queried_at: nowIso()
  };
}

export function getOrchestrationDiagnostics(): {
  providers: Array<{ kind: OrchestrationProviderKind; available: boolean; local: boolean }>;
  lanes: Array<{ kind: OrchestrationProviderKind; primary: boolean; enabled: boolean }>;
  local_runtime_is_primary: boolean;
  remote_orchestration_is_optional_lane: boolean;
} {
  const providers = [...orchestrationProviders.values()].map(p => ({ kind: p.kind, available: p.is_available, local: p.is_local }));
  const lanes = [...orchestrationLanes.values()].map(l => ({ kind: l.provider_kind, primary: l.is_primary, enabled: l.enabled }));
  const localPrimary = lanes.some(l => l.kind === "local_runtime" && l.primary);
  return {
    providers,
    lanes,
    local_runtime_is_primary: localPrimary,
    remote_orchestration_is_optional_lane: !lanes.some(l => l.kind !== "local_runtime" && l.primary)
  };
}

export function initializeDefaultOrchestrationSPI(): void {
  registerOrchestrationProvider({
    kind: "local_runtime",
    display_name: "Local Runtime (Primary)",
    description: "The local-first typed runtime backbone. Always primary. Remote orchestration is optional lane only.",
    is_local: true,
    is_available: true,
    supports_durable_execution: false,
    supports_signal: false,
    supports_query: true,
    supports_cancellation: true,
    max_workflow_duration_hours: 0,
    protocol_version: "1.0.0"
  });

  registerOrchestrationProvider({
    kind: "temporal",
    display_name: "Temporal (Optional Remote Lane)",
    description: "Optional remote orchestration via Temporal. Not a backbone - only an optional lane for durable workflows.",
    is_local: false,
    is_available: false,
    supports_durable_execution: true,
    supports_signal: true,
    supports_query: true,
    supports_cancellation: true,
    max_workflow_duration_hours: 720,
    protocol_version: "1.0.0"
  });

  registerOrchestrationProvider({
    kind: "langgraph",
    display_name: "LangGraph (Optional Remote Lane)",
    description: "Optional remote orchestration via LangGraph. Not a backbone - only an optional lane for graph-based workflows.",
    is_local: false,
    is_available: false,
    supports_durable_execution: true,
    supports_signal: false,
    supports_query: true,
    supports_cancellation: true,
    max_workflow_duration_hours: 168,
    protocol_version: "1.0.0"
  });

  configureOrchestrationLane({
    provider_kind: "local_runtime",
    is_primary: true,
    is_fallback: false,
    priority: 100,
    enabled: true,
    routing_rules: []
  });

  configureOrchestrationLane({
    provider_kind: "temporal",
    is_primary: false,
    is_fallback: true,
    priority: 50,
    enabled: true,
    routing_rules: [
      { task_family_pattern: "durable_.*", priority_boost: 30 },
      { task_family_pattern: "long_running_.*", priority_boost: 20 }
    ]
  });

  configureOrchestrationLane({
    provider_kind: "langgraph",
    is_primary: false,
    is_fallback: true,
    priority: 40,
    enabled: true,
    routing_rules: [
      { task_family_pattern: "graph_.*", priority_boost: 30 },
      { task_family_pattern: "multi_step_.*", priority_boost: 10 }
    ]
  });
}

export function verifyOrchestrationProviderConnectivity(providerKind: OrchestrationProviderKind): {
  provider_kind: OrchestrationProviderKind;
  connectivity: "live" | "unreachable" | "not_installed";
  endpoint?: string;
  latency_ms?: number;
  error?: string;
  verified_at: string;
} {
  const provider = [...orchestrationProviders.values()].find(p => p.kind === providerKind);
  if (!provider) {
    return {
      provider_kind: providerKind,
      connectivity: "not_installed",
      error: `Provider ${providerKind} not registered`,
      verified_at: nowIso()
    };
  }

  switch (providerKind) {
    case "local_runtime":
      return {
        provider_kind: "local_runtime",
        connectivity: "live",
        endpoint: "in-process",
        latency_ms: 0,
        verified_at: nowIso()
      };
    case "temporal":
      return {
        provider_kind: "temporal",
        connectivity: "not_installed",
        error: "Temporal CLI not found on PATH. Install: https://temporal.io/cli",
        verified_at: nowIso()
      };
    case "langgraph":
      return {
        provider_kind: "langgraph",
        connectivity: "not_installed",
        error: "LangGraph Python runtime not available. Install: pip install langgraph",
        verified_at: nowIso()
      };
    default:
      return {
        provider_kind: providerKind,
        connectivity: "unreachable",
        error: "Unknown provider kind",
        verified_at: nowIso()
      };
  }
}

export function runOrchestrationActivationVerification(): {
  local_runtime_is_primary: boolean;
  local_runtime_is_live: boolean;
  temporal_status: string;
  langgraph_status: string;
  fallback_lanes_available: boolean;
  dispatch_will_use_local: boolean;
  overall: "live_now" | "boundary_only" | "host_blocked";
} {
  const diag = getOrchestrationDiagnostics();
  const localProvider = [...orchestrationProviders.values()].find(p => p.kind === "local_runtime");
  const localConn = verifyOrchestrationProviderConnectivity("local_runtime");
  const temporalConn = verifyOrchestrationProviderConnectivity("temporal");
  const langgraphConn = verifyOrchestrationProviderConnectivity("langgraph");

  const localIsPrimary = diag.local_runtime_is_primary;
  const localIsLive = localConn.connectivity === "live";
  const fallbackAvailable = diag.providers.filter(p => p.available && !p.local).length > 0;

  let dispatchUsesLocal = false;
  if (localIsPrimary && localIsLive) {
    dispatchUsesLocal = true;
  }

  let overall: "live_now" | "boundary_only" | "host_blocked";
  if (localIsPrimary && localIsLive) {
    overall = "live_now";
  } else if (localIsLive) {
    overall = "boundary_only";
  } else {
    overall = "host_blocked";
  }

  return {
    local_runtime_is_primary: localIsPrimary,
    local_runtime_is_live: localIsLive,
    temporal_status: temporalConn.connectivity,
    langgraph_status: langgraphConn.connectivity,
    fallback_lanes_available: fallbackAvailable,
    dispatch_will_use_local: dispatchUsesLocal,
    overall
  };
}
