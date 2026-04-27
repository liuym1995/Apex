import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  OrchestratorBoundaryConfigSchema,
  WorkflowContractShapeSchema,
  type OrchestratorBoundaryConfig,
  type WorkflowContractShape,
  type OrchestratorMode
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export function createOrchestratorBoundaryConfig(input?: Partial<OrchestratorBoundaryConfig>): OrchestratorBoundaryConfig {
  const config = OrchestratorBoundaryConfigSchema.parse({
    config_id: createEntityId("orchcfg"),
    active_mode: input?.active_mode ?? "local_typed_runtime",
    temporal_endpoint: input?.temporal_endpoint,
    temporal_namespace: input?.temporal_namespace,
    langgraph_endpoint: input?.langgraph_endpoint,
    langgraph_graph_name: input?.langgraph_graph_name,
    fallback_mode: input?.fallback_mode ?? "local_typed_runtime",
    translation_enabled: input?.translation_enabled ?? false,
    dry_run: input?.dry_run ?? true,
    created_at: nowIso()
  });

  store.orchestratorBoundaryConfigs.set(config.config_id, config);

  recordAudit("orchestrator_boundary.config_created", {
    config_id: config.config_id,
    active_mode: config.active_mode,
    fallback_mode: config.fallback_mode,
    dry_run: config.dry_run
  });

  return config;
}

export function getOrchestratorBoundaryConfig(): OrchestratorBoundaryConfig | undefined {
  const configs = [...store.orchestratorBoundaryConfigs.values()];
  return configs[configs.length - 1];
}

export function registerWorkflowContractShape(input: {
  workflow_name: string;
  orchestrator_target: WorkflowContractShape["orchestrator_target"];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  signal_schemas?: Record<string, unknown>[];
  query_schemas?: Record<string, unknown>[];
}): WorkflowContractShape {
  const shape = WorkflowContractShapeSchema.parse({
    shape_id: createEntityId("wfshape"),
    workflow_name: input.workflow_name,
    orchestrator_target: input.orchestrator_target,
    input_schema: input.input_schema ?? {},
    output_schema: input.output_schema ?? {},
    signal_schemas: input.signal_schemas ?? [],
    query_schemas: input.query_schemas ?? [],
    created_at: nowIso()
  });

  store.workflowContractShapes.set(shape.shape_id, shape);

  recordAudit("orchestrator_boundary.workflow_shape_registered", {
    shape_id: shape.shape_id,
    workflow_name: input.workflow_name,
    orchestrator_target: input.orchestrator_target
  });

  return shape;
}

export function listWorkflowContractShapes(filter?: {
  orchestrator_target?: WorkflowContractShape["orchestrator_target"];
}): WorkflowContractShape[] {
  let shapes = [...store.workflowContractShapes.values()];
  if (filter?.orchestrator_target) shapes = shapes.filter(s => s.orchestrator_target === filter.orchestrator_target);
  return shapes.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function translateLocalRuntimeToWorkflowContract(localTaskData: Record<string, unknown>): {
  temporal_workflow: Record<string, unknown>;
  langgraph_graph: Record<string, unknown>;
} {
  return {
    temporal_workflow: {
      workflow_id: localTaskData.task_id ?? createEntityId("tflow"),
      workflow_type: "task_execution",
      input: {
        intent: localTaskData.intent,
        task_type: localTaskData.task_type,
        department: localTaskData.department,
        risk_level: localTaskData.risk_level,
        execution_plan: localTaskData.execution_plan ?? []
      },
      signal_names: ["cancel_task", "pause_task", "resume_task", "escalate_task"],
      query_names: ["get_status", "get_progress", "get_evidence_summary"],
      search_attributes: {
        department: localTaskData.department,
        task_type: localTaskData.task_type,
        risk_level: localTaskData.risk_level
      }
    },
    langgraph_graph: {
      graph_name: "task_execution_graph",
      thread_id: localTaskData.task_id ?? createEntityId("lgraph"),
      input: {
        intent: localTaskData.intent,
        task_type: localTaskData.task_type,
        department: localTaskData.department,
        risk_level: localTaskData.risk_level
      },
      node_names: ["plan", "execute", "verify", "complete"],
      checkpoint_interval: 60,
      interrupt_before: ["verify"],
      interrupt_after: []
    }
  };
}

export function translateWorkflowResultToLocalRuntime(workflowResult: Record<string, unknown>, orchestratorTarget: "temporal" | "langgraph"): Record<string, unknown> {
  const result: Record<string, unknown> = {
    _translation_source: orchestratorTarget,
    _translation_applied: true
  };

  if (orchestratorTarget === "temporal") {
    result.status = mapTemporalStatusToLocal(workflowResult.status as string);
    result.run_id = workflowResult.workflow_id ?? workflowResult.run_id;
    result.evidence = workflowResult.result;
  } else {
    result.status = mapLangGraphStatusToLocal(workflowResult.status as string);
    result.run_id = workflowResult.thread_id;
    result.evidence = workflowResult.output;
  }

  return result;
}

function mapTemporalStatusToLocal(temporalStatus?: string): string {
  switch (temporalStatus) {
    case "RUNNING": return "running";
    case "COMPLETED": return "completed";
    case "FAILED": return "failed";
    case "CANCELED": return "cancelled";
    case "TERMINATED": return "cancelled";
    case "TIMED_OUT": return "failed";
    default: return "created";
  }
}

function mapLangGraphStatusToLocal(langGraphStatus?: string): string {
  switch (langGraphStatus) {
    case "idle": return "created";
    case "running": return "running";
    case "interrupted": return "waiting_approval";
    case "success": return "completed";
    case "error": return "failed";
    default: return "created";
  }
}

export function dryRunOrchestratorWorkflow(input: {
  workflow_name: string;
  orchestrator_target: "temporal" | "langgraph";
  task_data: Record<string, unknown>;
}): {
  dry_run_id: string;
  workflow_name: string;
  orchestrator_target: string;
  translated_input: Record<string, unknown>;
  expected_nodes: string[];
  simulated_result: Record<string, unknown>;
  status: "dry_run_completed";
} {
  const translated = translateLocalRuntimeToWorkflowContract(input.task_data);
  const translatedInput = input.orchestrator_target === "temporal"
    ? translated.temporal_workflow
    : translated.langgraph_graph;

  const expectedNodes = input.orchestrator_target === "temporal"
    ? ["plan", "execute", "verify", "complete"]
    : ["plan", "execute", "verify", "complete"];

  recordAudit("orchestrator_boundary.dry_run", {
    workflow_name: input.workflow_name,
    orchestrator_target: input.orchestrator_target,
    task_id: input.task_data.task_id
  });

  return {
    dry_run_id: createEntityId("dryrun"),
    workflow_name: input.workflow_name,
    orchestrator_target: input.orchestrator_target,
    translated_input: translatedInput,
    expected_nodes: expectedNodes,
    simulated_result: {
      status: "completed",
      evidence: { dry_run: true },
      duration_ms: 0
    },
    status: "dry_run_completed"
  };
}

export function getOrchestratorReadinessDiagnostics(): {
  config_exists: boolean;
  active_mode: OrchestratorMode;
  temporal_configured: boolean;
  langgraph_configured: boolean;
  translation_enabled: boolean;
  dry_run_available: boolean;
  workflow_shapes_registered: number;
  readiness_level: "not_configured" | "local_runtime_only" | "boundary_prepared" | "ready_for_orchestrator";
  blocking_items: string[];
} {
  const config = getOrchestratorBoundaryConfig();
  const shapes = [...store.workflowContractShapes.values()];

  const blockingItems: string[] = [];
  let readinessLevel: "not_configured" | "local_runtime_only" | "boundary_prepared" | "ready_for_orchestrator" = "not_configured";

  if (!config) {
    blockingItems.push("No orchestrator boundary config created");
  } else if (config.active_mode === "local_typed_runtime") {
    readinessLevel = "local_runtime_only";
  } else if (config.dry_run && !config.temporal_endpoint && !config.langgraph_endpoint) {
    readinessLevel = "boundary_prepared";
    blockingItems.push("No Temporal or LangGraph endpoint configured");
  } else {
    readinessLevel = "ready_for_orchestrator";
  }

  return {
    config_exists: !!config,
    active_mode: config?.active_mode ?? "local_typed_runtime",
    temporal_configured: !!config?.temporal_endpoint,
    langgraph_configured: !!config?.langgraph_endpoint,
    translation_enabled: config?.translation_enabled ?? false,
    dry_run_available: true,
    workflow_shapes_registered: shapes.length,
    readiness_level: readinessLevel,
    blocking_items: blockingItems
  };
}

export function initializeDefaultWorkflowContractShapes(): WorkflowContractShape[] {
  const shapes: WorkflowContractShape[] = [];

  const defaults: Array<{
    workflow_name: string;
    orchestrator_target: WorkflowContractShape["orchestrator_target"];
  }> = [
    { workflow_name: "task_execution", orchestrator_target: "temporal" },
    { workflow_name: "task_execution_graph", orchestrator_target: "langgraph" },
    { workflow_name: "long_running_task", orchestrator_target: "temporal" },
    { workflow_name: "verification_pipeline", orchestrator_target: "langgraph" },
    { workflow_name: "delegated_worker_execution", orchestrator_target: "temporal" },
    { workflow_name: "scheduled_job_execution", orchestrator_target: "local_runtime" }
  ];

  for (const def of defaults) {
    const existing = [...store.workflowContractShapes.values()]
      .find(s => s.workflow_name === def.workflow_name && s.orchestrator_target === def.orchestrator_target);
    if (!existing) {
      shapes.push(registerWorkflowContractShape({
        workflow_name: def.workflow_name,
        orchestrator_target: def.orchestrator_target
      }));
    }
  }

  return shapes;
}
