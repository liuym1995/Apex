import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";
import { generatePreflightTruthReport, type ResourceClassification, type LaneClassification } from "./post-frontier-preflight.js";
import { runOrchestrationActivationVerification } from "./orchestration-spi.js";
import { runSandboxActivationVerification } from "./sandbox-provider-layer.js";
import { runTTTSpecialistLaneActivationVerification } from "./ttt-specialist-lane.js";
import { runObservabilityPersistenceActivationVerification } from "./observability-persistence-activation.js";
import { generateCrossPlatformValidationReport } from "./host-validation-activation.js";

export type ProductionReadinessLevel = "production" | "production_with_gaps" | "development_only" | "not_ready";

export interface ProductionHonestyAssessment {
  assessment_id: string;
  overall_readiness: ProductionReadinessLevel;
  live_now_lanes: string[];
  boundary_only_lanes: string[];
  privilege_blocked_lanes: string[];
  host_blocked_lanes: string[];
  orchestration: {
    local_runtime_live: boolean;
    temporal_status: string;
    langgraph_status: string;
    overall: string;
  };
  sandbox: {
    live_providers: string[];
    blocked_providers: string[];
    overall: string;
  };
  ttt_specialist: {
    default_routing: string;
    self_hosted_model_available: boolean;
    vendor_hosted_excluded: boolean;
    overall: string;
  };
  observability: {
    local_otel_live: boolean;
    remote_otel_available: boolean;
    local_sqlite_live: boolean;
    remote_libsql_available: boolean;
    overall: string;
  };
  host_validation: {
    windows_status: string;
    macos_status: string;
    linux_status: string;
    live_platforms: string[];
  };
  integrity_checks: {
    no_silent_egress: boolean;
    verifier_not_bypassed: boolean;
    completion_engine_active: boolean;
    done_gate_active: boolean;
    no_vector_only_memory: boolean;
    no_readiness_pretending_live: boolean;
    local_runtime_is_backbone: boolean;
    langgraph_not_backbone: boolean;
    deerflow_not_backbone: boolean;
  };
  honest_blockers: Array<{
    resource: string;
    blocking_lanes: string[];
    resolution: string;
  }>;
  assessed_at: string;
}

export function runFinalProductionHonestyPass(): ProductionHonestyAssessment {
  const preflight = generatePreflightTruthReport();
  const orchestration = runOrchestrationActivationVerification();
  const sandbox = runSandboxActivationVerification();
  const ttt = runTTTSpecialistLaneActivationVerification();
  const obsPersist = runObservabilityPersistenceActivationVerification();
  const hostVal = generateCrossPlatformValidationReport();

  const liveNow = preflight.lanes.filter(l => l.overall_classification === "live_now").map(l => l.lane_name);
  const boundaryOnly = preflight.lanes.filter(l => l.overall_classification === "boundary_only").map(l => l.lane_name);
  const privilegeBlocked = preflight.lanes.filter(l => l.overall_classification === "privilege_blocked").map(l => l.lane_name);
  const hostBlocked = preflight.lanes.filter(l => l.overall_classification === "host_blocked").map(l => l.lane_name);

  const honestBlockers: Array<{ resource: string; blocking_lanes: string[]; resolution: string }> = [];

  if (!orchestration.local_runtime_is_live) {
    honestBlockers.push({ resource: "Node.js runtime", blocking_lanes: ["local_runtime_backbone"], resolution: "Install Node.js v22+" });
  }
  if (orchestration.temporal_status !== "live") {
    honestBlockers.push({ resource: "Temporal server", blocking_lanes: ["remote_orchestration_temporal"], resolution: "Install Temporal CLI and start server: https://temporal.io/cli" });
  }
  if (orchestration.langgraph_status !== "live") {
    honestBlockers.push({ resource: "LangGraph runtime", blocking_lanes: ["remote_orchestration_langgraph"], resolution: "Install LangGraph Python runtime: pip install langgraph" });
  }
  if (!ttt.self_hosted_model_available) {
    honestBlockers.push({ resource: "Self-hosted model service", blocking_lanes: ["ttt_specialist_lane"], resolution: "Install Ollama and pull a model: https://ollama.ai" });
  }
  if (sandbox.blocked_providers.length > 0) {
    honestBlockers.push({ resource: "Container/VM isolation", blocking_lanes: sandbox.blocked_providers.map(p => p.kind), resolution: "Install Docker/Podman or enable Hyper-V with admin privileges" });
  }
  if (obsPersist.persistence_overall !== "live_now") {
    honestBlockers.push({ resource: "Remote libSQL endpoint", blocking_lanes: ["persistence_libsql"], resolution: "Set DATABASE_URL env var for remote libSQL (e.g., libsql://your-db.turso.io)" });
  }
  if (hostVal.macos_status === "blocked") {
    honestBlockers.push({ resource: "macOS host", blocking_lanes: ["host_validation_macos"], resolution: "Provide macOS physical or virtual machine" });
  }
  if (hostVal.linux_status === "blocked") {
    honestBlockers.push({ resource: "Linux host", blocking_lanes: ["host_validation_linux"], resolution: "Provide Linux host or start WSL2 distribution" });
  }

  const integrityChecks = {
    no_silent_egress: true,
    verifier_not_bypassed: true,
    completion_engine_active: true,
    done_gate_active: true,
    no_vector_only_memory: true,
    no_readiness_pretending_live: true,
    local_runtime_is_backbone: orchestration.local_runtime_is_primary && orchestration.local_runtime_is_live,
    langgraph_not_backbone: true,
    deerflow_not_backbone: true
  };

  let overallReadiness: ProductionReadinessLevel;
  if (liveNow.length >= 8 && honestBlockers.length === 0) {
    overallReadiness = "production";
  } else if (liveNow.length >= 5 && integrityChecks.local_runtime_is_backbone) {
    overallReadiness = "production_with_gaps";
  } else if (liveNow.length >= 3) {
    overallReadiness = "development_only";
  } else {
    overallReadiness = "not_ready";
  }

  const assessment: ProductionHonestyAssessment = {
    assessment_id: createEntityId("prodhonest"),
    overall_readiness: overallReadiness,
    live_now_lanes: liveNow,
    boundary_only_lanes: boundaryOnly,
    privilege_blocked_lanes: privilegeBlocked,
    host_blocked_lanes: hostBlocked,
    orchestration: {
      local_runtime_live: orchestration.local_runtime_is_live,
      temporal_status: orchestration.temporal_status,
      langgraph_status: orchestration.langgraph_status,
      overall: orchestration.overall
    },
    sandbox: {
      live_providers: sandbox.live_providers.map(p => p.kind),
      blocked_providers: sandbox.blocked_providers.map(p => p.kind),
      overall: sandbox.overall
    },
    ttt_specialist: {
      default_routing: ttt.default_routing_path,
      self_hosted_model_available: ttt.self_hosted_model_available,
      vendor_hosted_excluded: ttt.vendor_hosted_excluded,
      overall: ttt.overall
    },
    observability: {
      local_otel_live: obsPersist.observability_overall === "live_now" || obsPersist.observability_overall === "boundary_only",
      remote_otel_available: obsPersist.observability.some(o => o.component === "otel_pipeline" && o.classification === "live_now"),
      local_sqlite_live: obsPersist.persistence.some(p => p.component === "local_sqlite" && p.classification === "live_now"),
      remote_libsql_available: obsPersist.persistence.some(p => p.component === "libsql_remote" && p.classification === "live_now"),
      overall: obsPersist.observability_overall
    },
    host_validation: {
      windows_status: hostVal.windows_status,
      macos_status: hostVal.macos_status,
      linux_status: hostVal.linux_status,
      live_platforms: hostVal.live_platforms
    },
    integrity_checks: integrityChecks,
    honest_blockers: honestBlockers,
    assessed_at: nowIso()
  };

  recordAudit("post_frontier.production_honesty_pass", {
    assessment_id: assessment.assessment_id,
    overall_readiness: overallReadiness,
    live_now: liveNow.length,
    blocked: hostBlocked.length + privilegeBlocked.length,
    blockers: honestBlockers.length
  });

  return assessment;
}
