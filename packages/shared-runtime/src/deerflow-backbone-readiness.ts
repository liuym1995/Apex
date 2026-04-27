import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  DeerFlowBackboneReadinessSchema,
  type DeerFlowBackboneReadiness,
  type DeerFlowRuntimeMode
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export function createDeerFlowBackboneReadiness(input?: Partial<DeerFlowBackboneReadiness>): DeerFlowBackboneReadiness {
  const readiness = DeerFlowBackboneReadinessSchema.parse({
    readiness_id: createEntityId("dfready"),
    runtime_mode: input?.runtime_mode ?? "local_backbone",
    deerflow_endpoint: input?.deerflow_endpoint,
    deerflow_api_version: input?.deerflow_api_version,
    health_check_interval_ms: input?.health_check_interval_ms ?? 30000,
    worker_registration_enabled: input?.worker_registration_enabled ?? false,
    translation_contracts_version: input?.translation_contracts_version ?? "0.1.0",
    fallback_to_local: input?.fallback_to_local ?? true,
    diagnostics_enabled: input?.diagnostics_enabled ?? true,
    created_at: nowIso()
  });

  store.deerFlowBackboneReadiness.set(readiness.readiness_id, readiness);

  recordAudit("deerflow_backbone.readiness_created", {
    readiness_id: readiness.readiness_id,
    runtime_mode: readiness.runtime_mode,
    fallback_to_local: readiness.fallback_to_local
  });

  return readiness;
}

export function getDeerFlowBackboneReadiness(): DeerFlowBackboneReadiness | undefined {
  const entries = [...store.deerFlowBackboneReadiness.values()];
  return entries[entries.length - 1];
}

export function configureDeerFlowRuntimeMode(mode: DeerFlowRuntimeMode): DeerFlowBackboneReadiness {
  let readiness = getDeerFlowBackboneReadiness();
  if (!readiness) {
    readiness = createDeerFlowBackboneReadiness({ runtime_mode: mode });
  }

  readiness.runtime_mode = mode;
  store.deerFlowBackboneReadiness.set(readiness.readiness_id, readiness);

  recordAudit("deerflow_backbone.runtime_mode_changed", {
    readiness_id: readiness.readiness_id,
    new_mode: mode,
    previous_mode: readiness.runtime_mode
  });

  return readiness;
}

export function registerExternalDeerFlowWorker(input: {
  worker_name: string;
  worker_capabilities?: string[];
  max_concurrent_tasks?: number;
}): {
  registration_id: string;
  worker_name: string;
  status: "registered_boundary_only";
  note: string;
} {
  const registration = {
    registration_id: createEntityId("dfreg"),
    worker_name: input.worker_name,
    status: "registered_boundary_only" as const,
    note: "Worker registration is a boundary contract only. Real DeerFlow worker deployment requires external infrastructure."
  };

  recordAudit("deerflow_backbone.worker_registration_boundary", {
    registration_id: registration.registration_id,
    worker_name: input.worker_name,
    capabilities: input.worker_capabilities ?? [],
    max_concurrent_tasks: input.max_concurrent_tasks ?? 1
  });

  return registration;
}

export function simulateDeerFlowHealthCheck(): {
  check_id: string;
  endpoint: string | undefined;
  status: "not_configured" | "endpoint_unreachable" | "simulated_healthy";
  response_time_ms: number;
  checked_at: string;
} {
  const readiness = getDeerFlowBackboneReadiness();
  const startTime = Date.now();

  const result = {
    check_id: createEntityId("dfhc"),
    endpoint: readiness?.deerflow_endpoint,
    status: "not_configured" as "not_configured" | "endpoint_unreachable" | "simulated_healthy",
    response_time_ms: Date.now() - startTime,
    checked_at: nowIso()
  };

  if (!readiness?.deerflow_endpoint) {
    result.status = "not_configured";
  } else {
    result.status = "endpoint_unreachable";
  }

  recordAudit("deerflow_backbone.health_check", {
    check_id: result.check_id,
    endpoint: result.endpoint,
    status: result.status
  });

  return result;
}

export function getDeerFlowBackboneReadinessDiagnostics(): {
  readiness_exists: boolean;
  runtime_mode: DeerFlowRuntimeMode;
  endpoint_configured: boolean;
  worker_registration_enabled: boolean;
  fallback_to_local: boolean;
  translation_contracts_version: string;
  existing_routes_count: number;
  readiness_level: "not_prepared" | "local_backbone_only" | "boundary_prepared" | "ready_for_deerflow_deployment";
  blocking_items: string[];
  compatibility_boundary_status: string;
} {
  const readiness = getDeerFlowBackboneReadiness();
  const routes = [...store.deerFlowWorkerRoutes.values()];

  const blockingItems: string[] = [];
  let readinessLevel: "not_prepared" | "local_backbone_only" | "boundary_prepared" | "ready_for_deerflow_deployment" = "not_prepared";

  if (!readiness) {
    blockingItems.push("No DeerFlow backbone readiness config created");
  } else if (readiness.runtime_mode === "local_backbone") {
    readinessLevel = "local_backbone_only";
    blockingItems.push("Runtime mode is local_backbone - DeerFlow not active");
  } else if (!readiness.deerflow_endpoint) {
    readinessLevel = "boundary_prepared";
    blockingItems.push("No DeerFlow endpoint configured");
    blockingItems.push("Real DeerFlow deployment requires external infrastructure");
  } else {
    readinessLevel = "ready_for_deerflow_deployment";
  }

  return {
    readiness_exists: !!readiness,
    runtime_mode: readiness?.runtime_mode ?? "local_backbone",
    endpoint_configured: !!readiness?.deerflow_endpoint,
    worker_registration_enabled: readiness?.worker_registration_enabled ?? false,
    fallback_to_local: readiness?.fallback_to_local ?? true,
    translation_contracts_version: readiness?.translation_contracts_version ?? "0.1.0",
    existing_routes_count: routes.length,
    readiness_level: readinessLevel,
    blocking_items: blockingItems,
    compatibility_boundary_status: "DeerFlow compatibility boundary exists with typed routes, translations, and import hooks. Real backbone deployment requires external DeerFlow infrastructure."
  };
}

export function getDeerFlowDeploymentRunbook(): {
  manifest_version: string;
  required_env_vars: string[];
  required_services: string[];
  deployment_steps: string[];
  verification_steps: string[];
  rollback_steps: string[];
} {
  return {
    manifest_version: "1.0.0",
    required_env_vars: [
      "APEX_DEERFLOW_ENDPOINT",
      "APEX_DEERFLOW_API_VERSION",
      "APEX_DEERFLOW_RUNTIME_MODE"
    ],
    required_services: [
      "deerflow-api",
      "deerflow-worker-pool",
      "deerflow-checkpoint-store"
    ],
    deployment_steps: [
      "1. Deploy DeerFlow infrastructure",
      "2. Configure APEX_DEERFLOW_ENDPOINT",
      "3. Set runtime_mode to deerflow_worker_lane or hybrid",
      "4. Enable worker registration",
      "5. Register external DeerFlow workers",
      "6. Run health check verification",
      "7. Enable translation contracts",
      "8. Monitor task routing to DeerFlow workers"
    ],
    verification_steps: [
      "Verify DeerFlow endpoint is reachable",
      "Verify health check returns healthy",
      "Verify worker registration succeeds",
      "Verify task routing to DeerFlow workers",
      "Verify checkpoint sync works",
      "Verify fallback to local backbone works"
    ],
    rollback_steps: [
      "1. Set runtime_mode back to local_backbone",
      "2. Disable worker registration",
      "3. Verify all tasks route to local runtime",
      "4. Remove DeerFlow environment variables",
      "5. Clean up DeerFlow infrastructure"
    ]
  };
}
