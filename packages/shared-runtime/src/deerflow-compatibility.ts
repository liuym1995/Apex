import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  DeerFlowWorkerRouteSchema,
  type DeerFlowWorkerRoute
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export function createDeerFlowWorkerRoute(input: {
  worker_name: string;
  launch_contract?: Record<string, unknown>;
  adapter_boundary?: DeerFlowWorkerRoute["adapter_boundary"];
  compatibility_version?: string;
}): DeerFlowWorkerRoute {
  const route = DeerFlowWorkerRouteSchema.parse({
    route_id: createEntityId("dfroute"),
    worker_kind: "deerflow_worker",
    worker_name: input.worker_name,
    launch_contract: input.launch_contract ?? {
      runtime_kind: "deerflow_local_mock",
      max_concurrent_tasks: 1,
      heartbeat_interval_ms: 30000,
      checkpoint_interval_ms: 60000
    },
    adapter_boundary: input.adapter_boundary ?? "local_mock",
    compatibility_version: input.compatibility_version ?? "0.1.0",
    is_backbone: false,
    created_at: nowIso()
  });

  store.deerFlowWorkerRoutes.set(route.route_id, route);

  recordAudit("deerflow.route_created", {
    route_id: route.route_id,
    worker_name: input.worker_name,
    adapter_boundary: route.adapter_boundary,
    compatibility_version: route.compatibility_version,
    is_backbone: false
  });

  return route;
}

export function listDeerFlowWorkerRoutes(): DeerFlowWorkerRoute[] {
  return [...store.deerFlowWorkerRoutes.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getDeerFlowWorkerRoute(routeId: string): DeerFlowWorkerRoute | undefined {
  return store.deerFlowWorkerRoutes.get(routeId);
}

export function resolveDeerFlowRouteForTask(taskId: string): DeerFlowWorkerRoute | undefined {
  const routes = [...store.deerFlowWorkerRoutes.values()];
  if (routes.length === 0) return undefined;

  const task = store.tasks.get(taskId);
  if (!task) return undefined;

  if (task.department === "engineering" && task.task_type === "long_running") {
    const activeRoute = routes.find(r => r.adapter_boundary !== "remote_grpc");
    return activeRoute ?? routes[0];
  }

  return undefined;
}

export interface DeerFlowAdapterTranslation {
  translation_id: string;
  source_format: string;
  target_format: string;
  field_mappings: Record<string, string>;
  required_transforms: string[];
  created_at: string;
}

const adapterTranslations = new Map<string, DeerFlowAdapterTranslation>();

export function registerAdapterTranslation(input: {
  source_format: string;
  target_format: string;
  field_mappings: Record<string, string>;
  required_transforms?: string[];
}): DeerFlowAdapterTranslation {
  const translation: DeerFlowAdapterTranslation = {
    translation_id: createEntityId("dftrans"),
    source_format: input.source_format,
    target_format: input.target_format,
    field_mappings: input.field_mappings,
    required_transforms: input.required_transforms ?? [],
    created_at: nowIso()
  };

  adapterTranslations.set(translation.translation_id, translation);

  recordAudit("deerflow.translation_registered", {
    translation_id: translation.translation_id,
    source_format: input.source_format,
    target_format: input.target_format
  });

  return translation;
}

export function listAdapterTranslations(): DeerFlowAdapterTranslation[] {
  return [...adapterTranslations.values()];
}

export function translateToDeerFlowFormat(localData: Record<string, unknown>, translationId?: string): Record<string, unknown> {
  const translations = [...adapterTranslations.values()]
    .filter(t => t.source_format === "local_runtime" && t.target_format === "deerflow");

  const translation = translationId
    ? adapterTranslations.get(translationId)
    : translations[0];

  if (!translation) {
    return {
      ...localData,
      _deerflow_compatibility: true,
      _translation_applied: false,
      _translation_note: "No translation registered; passing through as-is with compatibility flag"
    };
  }

  const result: Record<string, unknown> = {};
  for (const [localKey, deerFlowKey] of Object.entries(translation.field_mappings)) {
    if (localKey in localData) {
      result[deerFlowKey] = localData[localKey];
    }
  }

  result._deerflow_compatibility = true;
  result._translation_applied = true;
  result._translation_id = translation.translation_id;

  return result;
}

export function translateFromDeerFlowFormat(deerFlowData: Record<string, unknown>, translationId?: string): Record<string, unknown> {
  const translations = [...adapterTranslations.values()]
    .filter(t => t.source_format === "deerflow" && t.target_format === "local_runtime");

  const translation = translationId
    ? adapterTranslations.get(translationId)
    : translations[0];

  if (!translation) {
    return {
      ...deerFlowData,
      _local_compatibility: true,
      _translation_applied: false,
      _translation_note: "No reverse translation registered; passing through as-is"
    };
  }

  const result: Record<string, unknown> = {};
  for (const [localKey, deerFlowKey] of Object.entries(translation.field_mappings)) {
    if (deerFlowKey in deerFlowData) {
      result[localKey] = deerFlowData[deerFlowKey];
    }
  }

  result._local_compatibility = true;
  result._translation_applied = true;
  result._translation_id = translation.translation_id;

  return result;
}

export interface DeerFlowImportHook {
  hook_id: string;
  hook_kind: "task_launch" | "checkpoint_sync" | "result_import" | "heartbeat_bridge";
  source_format: string;
  target_format: string;
  active: boolean;
  created_at: string;
}

const importHooks = new Map<string, DeerFlowImportHook>();

export function registerImportHook(input: {
  hook_kind: DeerFlowImportHook["hook_kind"];
  source_format: string;
  target_format: string;
  active?: boolean;
}): DeerFlowImportHook {
  const hook: DeerFlowImportHook = {
    hook_id: createEntityId("dfhook"),
    hook_kind: input.hook_kind,
    source_format: input.source_format,
    target_format: input.target_format,
    active: input.active ?? true,
    created_at: nowIso()
  };

  importHooks.set(hook.hook_id, hook);

  recordAudit("deerflow.import_hook_registered", {
    hook_id: hook.hook_id,
    hook_kind: hook.hook_kind,
    source_format: hook.source_format,
    target_format: hook.target_format
  });

  return hook;
}

export function listImportHooks(): DeerFlowImportHook[] {
  return [...importHooks.values()];
}

export function getDeerFlowCompatibilityStatus(): {
  routes_available: number;
  translations_available: number;
  hooks_available: number;
  is_backbone: boolean;
  compatibility_level: "full" | "partial" | "mock_only";
  non_backbone_semantics: string;
} {
  const routes = [...store.deerFlowWorkerRoutes.values()];
  const translations = [...adapterTranslations.values()];
  const hooks = [...importHooks.values()];

  const hasLocalMock = routes.some(r => r.adapter_boundary === "local_mock");
  const hasLocalProcess = routes.some(r => r.adapter_boundary === "local_process");
  const hasRemoteGrpc = routes.some(r => r.adapter_boundary === "remote_grpc");

  const compatibilityLevel: "full" | "partial" | "mock_only" =
    hasRemoteGrpc ? "full"
    : hasLocalProcess ? "partial"
    : "mock_only";

  return {
    routes_available: routes.length,
    translations_available: translations.length,
    hooks_available: hooks.filter(h => h.active).length,
    is_backbone: false,
    compatibility_level: compatibilityLevel,
    non_backbone_semantics: "DeerFlow routes are non-backbone compatibility boundaries. They do not replace the local runtime backbone. All DeerFlow invocations go through adapter boundaries with explicit version contracts. The local runtime remains the authoritative execution engine."
  };
}

export function initializeDefaultDeerFlowBoundary(): {
  routes: DeerFlowWorkerRoute[];
  translations: DeerFlowAdapterTranslation[];
  hooks: DeerFlowImportHook[];
} {
  const routes: DeerFlowWorkerRoute[] = [];
  const translations: DeerFlowAdapterTranslation[] = [];
  const hooks: DeerFlowImportHook[] = [];

  if ([...store.deerFlowWorkerRoutes.values()].length === 0) {
    routes.push(createDeerFlowWorkerRoute({
      worker_name: "deerflow-long-runner",
      launch_contract: {
        runtime_kind: "deerflow_local_mock",
        max_concurrent_tasks: 1,
        heartbeat_interval_ms: 30000,
        checkpoint_interval_ms: 60000,
        supported_task_types: ["long_running", "research", "engineering"],
        timeout_policy: "checkpoint_and_escalate"
      },
      adapter_boundary: "local_mock",
      compatibility_version: "0.1.0"
    }));
  }

  if (adapterTranslations.size === 0) {
    translations.push(registerAdapterTranslation({
      source_format: "local_runtime",
      target_format: "deerflow",
      field_mappings: {
        "task_id": "task_id",
        "intent": "goal",
        "department": "domain",
        "task_type": "execution_mode",
        "status": "state",
        "checkpoint_data": "checkpoint",
        "heartbeat_at": "last_heartbeat"
      },
      required_transforms: ["status_mapping", "checkpoint_serialization"]
    }));

    translations.push(registerAdapterTranslation({
      source_format: "deerflow",
      target_format: "local_runtime",
      field_mappings: {
        "task_id": "task_id",
        "goal": "intent",
        "domain": "department",
        "execution_mode": "task_type",
        "state": "status",
        "checkpoint": "checkpoint_data",
        "last_heartbeat": "heartbeat_at"
      },
      required_transforms: ["state_mapping", "checkpoint_deserialization"]
    }));
  }

  if (importHooks.size === 0) {
    hooks.push(registerImportHook({
      hook_kind: "task_launch",
      source_format: "local_runtime",
      target_format: "deerflow",
      active: true
    }));

    hooks.push(registerImportHook({
      hook_kind: "checkpoint_sync",
      source_format: "local_runtime",
      target_format: "deerflow",
      active: true
    }));

    hooks.push(registerImportHook({
      hook_kind: "result_import",
      source_format: "deerflow",
      target_format: "local_runtime",
      active: true
    }));

    hooks.push(registerImportHook({
      hook_kind: "heartbeat_bridge",
      source_format: "deerflow",
      target_format: "local_runtime",
      active: false
    }));
  }

  recordAudit("deerflow.boundary_initialized", {
    routes: routes.length,
    translations: translations.length,
    hooks: hooks.length
  });

  return { routes, translations, hooks };
}
