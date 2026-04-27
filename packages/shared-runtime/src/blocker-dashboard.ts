import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { recordAudit } from "./core.js";
import { getPrivilegedReadinessDiagnostics, type PrivilegedOperationKind, type ReadinessStatus } from "./privileged-execution-readiness.js";
import { type LocalRuntimeKind, type InstallState, type RuntimeDiagnostics } from "./local-runtime-bootstrap.js";
import { type EndpointKind, type EndpointConfigStatus, type EndpointConfig } from "./endpoint-onboarding.js";

export type BlockerCategory = "ready_now" | "needs_admin" | "needs_install" | "needs_credential" | "needs_external_endpoint" | "needs_unavailable_host";

export interface ReadinessMatrixEntry {
  entry_id: string;
  category: BlockerCategory;
  item_name: string;
  description: string;
  current_status: string;
  blocking_reason?: string;
  remediation?: string;
  impact_level: "blocking" | "degraded" | "optional";
  source_layer: "admin_backend" | "local_prerequisite" | "external_endpoint" | "host_availability";
  related_entity_id?: string;
  created_at: string;
}

export interface ReadinessMatrix {
  matrix_id: string;
  title: string;
  entries: ReadinessMatrixEntry[];
  summary: {
    total_items: number;
    ready_now_count: number;
    needs_admin_count: number;
    needs_install_count: number;
    needs_credential_count: number;
    needs_external_endpoint_count: number;
    needs_unavailable_host_count: number;
    readiness_percentage: number;
    blocking_count: number;
    degraded_count: number;
    optional_count: number;
  };
  generated_at: string;
}

export interface ReadinessStatusArtifact {
  artifact_id: string;
  format_version: string;
  generated_at: string;
  platform: string;
  matrix: ReadinessMatrix;
  privileged_execution_summary: {
    total_operations: number;
    ready_count: number;
    blocked_count: number;
    elevation_required: boolean;
  };
  local_runtime_summary: {
    total_runtimes: number;
    ready_count: number;
    needs_install_count: number;
  };
  endpoint_summary: {
    total_endpoints: number;
    configured_count: number;
    reachable_count: number;
    not_configured_count: number;
  };
  export_format: "json" | "markdown" | "csv";
  checksum: string;
}

export interface BlockerDashboardState {
  dashboard_id: string;
  overall_readiness_level: "ready" | "mostly_ready" | "partially_ready" | "mostly_blocked" | "blocked";
  readiness_percentage: number;
  top_blockers: Array<{
    category: BlockerCategory;
    item_name: string;
    impact_level: "blocking" | "degraded" | "optional";
    remediation?: string;
  }>;
  category_counts: {
    ready_now: number;
    needs_admin: number;
    needs_install: number;
    needs_credential: number;
    needs_external_endpoint: number;
    needs_unavailable_host: number;
  };
  next_human_actions: Array<{
    action: string;
    priority: "critical" | "high" | "medium" | "low";
    category: BlockerCategory;
    estimated_impact: string;
  }>;
  last_updated_at: string;
}

function categorizePrivilegedOperation(readinessStatus: ReadinessStatus): BlockerCategory {
  if (readinessStatus === "supported_and_ready") return "ready_now";
  if (readinessStatus === "supported_but_blocked_by_missing_admin") return "needs_admin";
  return "needs_unavailable_host";
}

function categorizeLocalRuntime(installState: InstallState): BlockerCategory {
  if (installState === "installed_and_running") return "ready_now";
  if (installState === "not_installed") return "needs_install";
  if (installState === "installed_but_not_running") return "needs_install";
  if (installState === "installed_version_mismatch") return "needs_install";
  return "needs_install";
}

function categorizeEndpoint(configStatus: EndpointConfigStatus): BlockerCategory {
  if (configStatus === "configured_and_reachable") return "ready_now";
  if (configStatus === "not_configured") return "needs_external_endpoint";
  if (configStatus === "configured_but_unreachable") return "needs_external_endpoint";
  if (configStatus === "configured_invalid") return "needs_credential";
  return "needs_external_endpoint";
}

export function buildReadinessMatrix(): ReadinessMatrix {
  const entries: ReadinessMatrixEntry[] = [];

  const privDiagnostics = getPrivilegedReadinessDiagnostics();
  for (const contract of privDiagnostics.contracts) {
    const category = categorizePrivilegedOperation(contract.readiness_status);
    const blockingItem = privDiagnostics.blocking_items.find(b => b.operation_kind === contract.operation_kind);

    entries.push({
      entry_id: createEntityId("rme"),
      category,
      item_name: contract.display_name,
      description: `Privileged operation: ${contract.operation_kind}`,
      current_status: contract.readiness_status,
      blocking_reason: category !== "ready_now" ? blockingItem?.reason ?? "Requires Administrator elevation" : undefined,
      remediation: category === "needs_admin" ? "Run application as Administrator" : undefined,
      impact_level: blockingItem?.impact ?? "degraded",
      source_layer: "admin_backend",
      created_at: nowIso()
    });
  }

  const runtimeKinds: LocalRuntimeKind[] = [
    "docker_desktop", "wsl2", "rust_cargo", "ollama", "temporal_cli",
    "node_js", "python", "git", "playwright"
  ];
  for (const kind of runtimeKinds) {
    const existing = ([...store.runtimeDiagnostics.values()] as RuntimeDiagnostics[])
      .filter(d => d.runtime_kind === kind)
      .sort((a, b) => b.last_checked_at.localeCompare(a.last_checked_at));
    const diag = existing[0];

    if (diag) {
      const category = categorizeLocalRuntime(diag.install_state);
      entries.push({
        entry_id: createEntityId("rme"),
        category,
        item_name: `${kind} runtime`,
        description: `Local runtime: ${kind}`,
        current_status: diag.install_state,
        blocking_reason: diag.blocker_reason,
        remediation: category === "needs_install" ? `Install ${kind} using bootstrap plan` : undefined,
        impact_level: kind === "docker_desktop" || kind === "rust_cargo" ? "blocking" : "degraded",
        source_layer: "local_prerequisite",
        created_at: nowIso()
      });
    }
  }

  const endpointKinds: EndpointKind[] = [
    "temporal", "langgraph", "sso", "deerflow", "model_inference", "libsql", "otel_collector"
  ];
  for (const kind of endpointKinds) {
    const configs = ([...store.endpointConfigs.values()] as EndpointConfig[])
      .filter(c => c.endpoint_kind === kind);

    if (configs.length > 0) {
      for (const config of configs) {
        const category = categorizeEndpoint(config.status);
        entries.push({
          entry_id: createEntityId("rme"),
          category,
          item_name: config.display_name,
          description: `External endpoint: ${kind}`,
          current_status: config.status,
          blocking_reason: category !== "ready_now"
            ? config.missing_env_vars.length > 0
              ? `Missing env vars: ${config.missing_env_vars.join(", ")}`
              : "Endpoint not reachable"
            : undefined,
          remediation: category === "needs_credential"
            ? "Configure required credentials"
            : category === "needs_external_endpoint"
              ? "Deploy or configure the external service"
              : undefined,
          impact_level: kind === "model_inference" ? "blocking" : "degraded",
          source_layer: "external_endpoint",
          related_entity_id: config.config_id,
          created_at: nowIso()
        });
      }
    } else {
      entries.push({
        entry_id: createEntityId("rme"),
        category: "needs_external_endpoint",
        item_name: `${kind} endpoint`,
        description: `External endpoint: ${kind} (not yet registered)`,
        current_status: "not_configured",
        blocking_reason: "Endpoint not configured",
        remediation: "Register endpoint configuration",
        impact_level: "degraded",
        source_layer: "external_endpoint",
        created_at: nowIso()
      });
    }
  }

  const hostItems: Array<{ name: string; reason: string; impact: "blocking" | "degraded" | "optional" }> = [
    { name: "macOS host", reason: "No macOS host available for accessibility and display validation", impact: "degraded" },
    { name: "Linux host", reason: "No Linux host available for AT-SPI and cgroups validation", impact: "degraded" }
  ];

  for (const item of hostItems) {
    entries.push({
      entry_id: createEntityId("rme"),
      category: "needs_unavailable_host",
      item_name: item.name,
      description: `Host availability: ${item.name}`,
      current_status: "unavailable",
      blocking_reason: item.reason,
      impact_level: item.impact,
      source_layer: "host_availability",
      created_at: nowIso()
    });
  }

  const readyNowCount = entries.filter(e => e.category === "ready_now").length;
  const needsAdminCount = entries.filter(e => e.category === "needs_admin").length;
  const needsInstallCount = entries.filter(e => e.category === "needs_install").length;
  const needsCredentialCount = entries.filter(e => e.category === "needs_credential").length;
  const needsEndpointCount = entries.filter(e => e.category === "needs_external_endpoint").length;
  const needsHostCount = entries.filter(e => e.category === "needs_unavailable_host").length;
  const totalCount = entries.length;
  const blockingCount = entries.filter(e => e.impact_level === "blocking").length;
  const degradedCount = entries.filter(e => e.impact_level === "degraded").length;
  const optionalCount = entries.filter(e => e.impact_level === "optional").length;

  const matrix: ReadinessMatrix = {
    matrix_id: createEntityId("rmatrix"),
    title: "Apex Readiness Matrix",
    entries,
    summary: {
      total_items: totalCount,
      ready_now_count: readyNowCount,
      needs_admin_count: needsAdminCount,
      needs_install_count: needsInstallCount,
      needs_credential_count: needsCredentialCount,
      needs_external_endpoint_count: needsEndpointCount,
      needs_unavailable_host_count: needsHostCount,
      readiness_percentage: totalCount > 0 ? Math.round((readyNowCount / totalCount) * 100) : 0,
      blocking_count: blockingCount,
      degraded_count: degradedCount,
      optional_count: optionalCount
    },
    generated_at: nowIso()
  };

  store.readinessMatrices.set(matrix.matrix_id, matrix);

  recordAudit("blocker_dashboard.matrix_built", {
    matrix_id: matrix.matrix_id,
    total_items: totalCount,
    ready_now_count: readyNowCount,
    readiness_percentage: matrix.summary.readiness_percentage
  });

  return matrix;
}

export function listReadinessMatrices(): ReadinessMatrix[] {
  return ([...store.readinessMatrices.values()] as ReadinessMatrix[])
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at));
}

export function exportReadinessStatusArtifact(format: "json" | "markdown" | "csv" = "json"): ReadinessStatusArtifact {
  const matrix = buildReadinessMatrix();

  const privDiagnostics = getPrivilegedReadinessDiagnostics();

  const runtimeReady = ([...store.runtimeDiagnostics.values()] as RuntimeDiagnostics[])
    .filter(d => d.install_state === "installed_and_running").length;
  const runtimeTotal = ([...store.runtimeDiagnostics.values()] as RuntimeDiagnostics[]).length;

  const endpointConfigs = [...store.endpointConfigs.values()] as EndpointConfig[];
  const endpointReachable = endpointConfigs.filter(c => c.status === "configured_and_reachable").length;
  const endpointConfigured = endpointConfigs.filter(c => c.status !== "not_configured").length;
  const endpointNotConfigured = endpointConfigs.filter(c => c.status === "not_configured").length;

  const allEndpointKinds: string[] = ["temporal", "langgraph", "sso", "deerflow", "model_inference", "libsql", "otel_collector"];

  const artifact: ReadinessStatusArtifact = {
    artifact_id: createEntityId("rsartifact"),
    format_version: "1.0",
    generated_at: nowIso(),
    platform: process.platform,
    matrix,
    privileged_execution_summary: {
      total_operations: privDiagnostics.summary.total_operations,
      ready_count: privDiagnostics.summary.ready_count,
      blocked_count: privDiagnostics.summary.blocked_by_admin_count,
      elevation_required: privDiagnostics.elevation_status === "not_elevated"
    },
    local_runtime_summary: {
      total_runtimes: runtimeTotal,
      ready_count: runtimeReady,
      needs_install_count: runtimeTotal - runtimeReady
    },
    endpoint_summary: {
      total_endpoints: allEndpointKinds.length,
      configured_count: endpointConfigured,
      reachable_count: endpointReachable,
      not_configured_count: endpointNotConfigured
    },
    export_format: format,
    checksum: simpleChecksum(JSON.stringify(matrix))
  };

  recordAudit("blocker_dashboard.artifact_exported", {
    artifact_id: artifact.artifact_id,
    format,
    readiness_percentage: matrix.summary.readiness_percentage
  });

  return artifact;
}

function simpleChecksum(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function buildBlockerDashboardState(): BlockerDashboardState {
  const matrix = buildReadinessMatrix();

  const topBlockers = matrix.entries
    .filter(e => e.category !== "ready_now")
    .sort((a, b) => {
      const impactOrder: Record<string, number> = { blocking: 0, degraded: 1, optional: 2 };
      return impactOrder[a.impact_level] - impactOrder[b.impact_level];
    })
    .slice(0, 10)
    .map(e => ({
      category: e.category,
      item_name: e.item_name,
      impact_level: e.impact_level,
      remediation: e.remediation
    }));

  const nextActions = matrix.entries
    .filter(e => e.category !== "ready_now" && e.impact_level === "blocking")
    .map(e => ({
      action: e.remediation ?? `Resolve blocker: ${e.item_name}`,
      priority: "critical" as const,
      category: e.category,
      estimated_impact: `Unblocks ${e.item_name}`
    }));

  const adminActions = matrix.entries
    .filter(e => e.category === "needs_admin" && e.impact_level !== "optional")
    .map(e => ({
      action: `Run as Administrator to enable: ${e.item_name}`,
      priority: "high" as const,
      category: e.category as BlockerCategory,
      estimated_impact: `Enables ${e.item_name} privileged operation`
    }));

  const installActions = matrix.entries
    .filter(e => e.category === "needs_install")
    .slice(0, 3)
    .map(e => ({
      action: `Install ${e.item_name}`,
      priority: "medium" as const,
      category: e.category as BlockerCategory,
      estimated_impact: `Enables ${e.item_name} capability`
    }));

  const allActions = [...nextActions, ...adminActions, ...installActions].slice(0, 10);

  const readinessPct = matrix.summary.readiness_percentage;
  let overallLevel: BlockerDashboardState["overall_readiness_level"];
  if (readinessPct >= 90) overallLevel = "ready";
  else if (readinessPct >= 70) overallLevel = "mostly_ready";
  else if (readinessPct >= 40) overallLevel = "partially_ready";
  else if (readinessPct >= 15) overallLevel = "mostly_blocked";
  else overallLevel = "blocked";

  const dashboard: BlockerDashboardState = {
    dashboard_id: createEntityId("blkdash"),
    overall_readiness_level: overallLevel,
    readiness_percentage: readinessPct,
    top_blockers: topBlockers,
    category_counts: {
      ready_now: matrix.summary.ready_now_count,
      needs_admin: matrix.summary.needs_admin_count,
      needs_install: matrix.summary.needs_install_count,
      needs_credential: matrix.summary.needs_credential_count,
      needs_external_endpoint: matrix.summary.needs_external_endpoint_count,
      needs_unavailable_host: matrix.summary.needs_unavailable_host_count
    },
    next_human_actions: allActions,
    last_updated_at: nowIso()
  };

  return dashboard;
}
