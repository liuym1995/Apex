import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  addArtifact,
  captureMemories,
  createExecutionPlan,
  createSkillCandidate,
  evaluateWatchdog,
  getTaskAgentTeamSummary,
  getCapabilityCatalog,
  listTaskArtifacts,
  listTaskAgentTeamTimeline,
  listTaskCapabilityResults,
  listTaskCheckpoints,
  listTaskSubagentCheckpoints,
  listTaskSubagentRuntimeBindings,
  listTaskSubagentRuntimeAdapterRuns,
  listTaskSubagentRuntimeBackendExecutions,
  listTaskSubagentRuntimeDriverRuns,
  listTaskSubagentRuntimeRunnerHandles,
  listTaskSubagentRuntimeRunnerBackendLeases,
  listTaskSubagentRuntimeRunnerExecutions,
  listTaskSubagentRuntimeRunnerJobs,
  listTaskSubagentRuntimeInstances,
  listTaskSubagentRuntimeLaunchReceipts,
  listTaskSubagentRuntimeLaunchSpecs,
  listTaskSubagentExecutionRuns,
  listTaskSubagentMessages,
  listTaskSubagentResumePackages,
  listTaskSubagentResumeRequests,
  listTaskSubagentSessions,
  listTaskToolInvocations,
  listTaskWorkerRuns,
  recordAudit,
  recordToolInvocation,
  applySubagentResumePackage,
  requireTask,
  resolveTaskCapabilities,
  runChecklist,
  runDoneGate,
  runReconciliation,
  runTaskEndToEnd,
  runVerifier,
  requestSubagentResume,
  releaseSubagentRuntimeBinding,
  acquireSubagentRuntimeRunnerBackendLease,
  heartbeatSubagentRuntimeInstance,
  launchSubagentRuntimeInstance,
  consumeSubagentRuntimeLaunchReceipt,
  releaseSubagentRuntimeRunnerBackendLease,
  getSubagentRuntimeLauncherBackendAdapterCatalog,
  getSubagentRuntimeLauncherBackendAdapterStatuses,
  getSubagentRuntimeRunnerBackendAdapterCatalog,
  getSubagentRuntimeRunnerBackendAdapterStatuses,
  startSubagentRuntimeAdapterRun,
  startSubagentRuntimeBackendExecution,
  startSubagentRuntimeDriverRun,
  attachSubagentRuntimeRunnerHandle,
  startSubagentRuntimeRunnerExecution,
  startSubagentRuntimeRunnerJob,
  heartbeatSubagentRuntimeAdapterRun,
  heartbeatSubagentRuntimeBackendExecution,
  heartbeatSubagentRuntimeDriverRun,
  heartbeatSubagentRuntimeRunnerHandle,
  heartbeatSubagentRuntimeRunnerExecution,
  heartbeatSubagentRuntimeRunnerJob,
  finalizeSubagentRuntimeAdapterRun,
  finalizeSubagentRuntimeBackendExecution,
  finalizeSubagentRuntimeDriverRun,
  finalizeSubagentRuntimeRunnerHandle,
  finalizeSubagentRuntimeRunnerExecution,
  finalizeSubagentRuntimeRunnerJob,
  updateSubagentExecutionRun,
  updateSubagentResumeRequest,
  bindSubagentExecutionRunRuntime,
  searchCapabilityCatalog,
  searchLearnedPlaybooks,
  searchTaskTemplates,
  sendHeartbeat,
  stopWorkerRun,
  touchTask
} from "@apex/shared-runtime";
import { stateBackendInfo, store } from "@apex/shared-state";
import {
  BrowserSessionSchema,
  buildDefaultTask,
  createEntityId,
  type Department,
  type RiskLevel,
  RuntimeBoundaryInfoSchema,
  AgentTeamSummarySchema,
  AgentTeamTimelineEntrySchema,
  SubagentRuntimeLauncherCatalogEntrySchema,
  SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema,
  SubagentRuntimeLauncherBackendAdapterStatusSchema,
  SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema,
  SubagentRuntimeRunnerBackendAdapterStatusSchema,
  SubagentRuntimeRunnerBackendLeaseSchema,
  SubagentRuntimeRunnerJobSchema,
  SubagentRuntimeLauncherDriverCatalogEntrySchema,
  SubagentRuntimeLauncherDriverStatusSchema,
  SubagentRuntimeLauncherStatusSchema,
  type SubagentRuntimeLaunchSpec,
  type SubagentRuntimeLaunchReceipt,
  SubagentCheckpointSchema,
  SubagentMessageSchema,
  SubagentSessionSchema,
  type TaskContract,
  type TaskType,
  nowIso
} from "@apex/shared-types";
import { loadLocalAppSettings, resolveTaskDirectoryPaths } from "@apex/shared-config";

export type LocalPermissionScope =
  | "local_files.read"
  | "local_files.write"
  | "local_shell.execute"
  | "local_browser.automate"
  | "local_ide.control"
  | "local_app.invoke";

export type LocalPermissionDecision = {
  scope: LocalPermissionScope;
  behavior: "allow" | "ask" | "deny";
  reason: string;
};

export type LocalDirectoryEntry = {
  name: string;
  path: string;
  kind: "file" | "directory";
  size: number;
};

export type LocalToolCatalogEntry = {
  tool_name: string;
  category: "filesystem" | "shell" | "browser" | "ide";
  requires_permission: LocalPermissionScope;
  behavior: "allow" | "ask";
  description: string;
};

export type LocalAgentTeamLauncherCatalogEntry = {
  launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
  label: string;
  description: string;
  runtime_kind: "host_guarded" | "sandbox_runner" | "cloud_runner";
  sandbox_profile: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
  attachment_mode: "managed" | "external";
  requires_locator: boolean;
  locator_placeholder?: string;
  future_upgrade_path?: string;
};

export type LocalAgentTeamLauncherDriverCatalogEntry = {
  driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
  launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
  label: string;
  description: string;
  runtime_kind: "host_guarded" | "sandbox_runner" | "cloud_runner";
  sandbox_profile: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
  attachment_mode: "managed" | "external";
  health_contract: "worker_run_lifecycle" | "external_heartbeat" | "cloud_control_plane";
  isolation_scope: "host_process" | "sandbox_pool" | "remote_control_plane";
  quota_profile: "local_worker_default" | "sandbox_pool_default" | "cloud_runner_default";
  mutation_guarded: boolean;
  capability_flags: string[];
  requires_locator: boolean;
  locator_placeholder?: string;
  future_upgrade_path?: string;
};

export type LocalAgentTeamLauncherDriverStatusEntry = {
  driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
  launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
  health: "healthy" | "attention" | "degraded";
  active_runtime_count: number;
  pending_attachment_count: number;
  released_runtime_count: number;
  recommended_action: string;
  summary: string;
};

export type LocalAgentTeamLauncherBackendAdapterCatalogEntry = {
  adapter_id: "local_worker_backend_adapter" | "sandbox_pool_backend_adapter" | "cloud_control_plane_backend_adapter";
  backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
  supported_driver_ids: Array<"local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver">;
  label: string;
  description: string;
  consumption_mode: "managed_runtime_launch" | "external_launch_handoff" | "remote_control_plane";
  heartbeat_contract: "worker_run_lifecycle" | "external_heartbeat" | "cloud_control_plane";
  release_contract: "managed_worker_release" | "sandbox_pool_release" | "cloud_control_plane_release";
  execution_style: "inline_control_plane" | "delegated_runtime_adapter" | "future_remote_runner";
  future_upgrade_path?: string;
};

export type LocalAgentTeamLauncherBackendAdapterStatusEntry = {
  adapter_id: "local_worker_backend_adapter" | "sandbox_pool_backend_adapter" | "cloud_control_plane_backend_adapter";
  backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
  health: "healthy" | "attention" | "degraded";
  launched_receipt_count: number;
  active_adapter_run_count: number;
  completed_adapter_run_count: number;
  failed_adapter_run_count: number;
  recommended_action: string;
  summary: string;
};

export type LocalAgentTeamRunnerBackendAdapterCatalogEntry = {
  adapter_id: "local_process_runner_backend" | "sandbox_job_runner_backend" | "cloud_job_runner_backend";
  runner_kind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
  backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
  supported_driver_ids: Array<"local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver">;
  label: string;
  description: string;
  execution_contract: "host_process_lifecycle" | "sandbox_job_lifecycle" | "cloud_job_lifecycle";
  heartbeat_contract: "local_process_heartbeat" | "external_job_heartbeat" | "cloud_job_heartbeat";
  release_contract: "host_process_release" | "sandbox_job_release" | "cloud_job_release";
  future_upgrade_path?: string;
};

export type LocalAgentTeamRunnerBackendAdapterStatusEntry = {
  adapter_id: "local_process_runner_backend" | "sandbox_job_runner_backend" | "cloud_job_runner_backend";
  runner_kind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
  backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
  health: "healthy" | "attention" | "degraded";
  running_execution_count: number;
  completed_execution_count: number;
  failed_execution_count: number;
  recommended_action: string;
  summary: string;
};

export type LocalToolExecutionResult<T> = {
  status: "completed" | "approval_required";
  permission: LocalPermissionDecision;
  result?: T;
};

export type LocalExecutionResilience = {
  attempts: number;
  circuit_state: "closed" | "open" | "half_open";
  degraded: boolean;
  degraded_reason?: string;
  retry_reasons: string[];
};

export type LocalFileWriteResult = {
  path: string;
  previous_exists: boolean;
  bytes_written: number;
  backup_artifact_name?: string;
};

export type LocalFilePatchResult = {
  path: string;
  bytes_written: number;
  patch_strategy: "replace_exact";
  backup_artifact_name?: string;
};

export type LocalRollbackResult = {
  invocation_id: string;
  path: string;
  restored: boolean;
  backup_artifact_name: string;
  compensation_status: "applied";
};

export type LocalExecutionTemplateWorkspace = {
  execution_template_key?: string;
  reused_task_template_id?: string;
  reused_task_template_version?: number;
  deep_link?: string;
  reused_task_template?: {
    template_id: string;
    title: string;
    fingerprint: string;
    version: number;
    source_task_count: number;
    improvement_hints: string[];
    deep_link?: string;
    applicability: {
      required_tags: string[];
      preferred_tags: string[];
      excluded_tags: string[];
    };
    failure_boundaries: string[];
  };
  related_playbooks: Array<{
    candidate_id: string;
    title: string;
    summary: string;
    version: number;
    source_task_count: number;
    status: string;
    improvement_hints: string[];
    deep_link?: string;
    applicability: {
      required_tags: string[];
      preferred_tags: string[];
      excluded_tags: string[];
    };
    failure_boundaries: string[];
    evidence: string[];
  }>;
};

export type LocalReuseImprovementWorkspace = {
  source_kind: "reuse_navigation";
  target_kind: "execution_template" | "learned_playbook";
  target_id: string;
  target_task_id?: string;
  deep_link?: string;
  suggested_learning_action: "refine_execution_template" | "refine_learned_playbook";
  summary: string;
  target_title?: string;
  target_version?: number;
  source_task_count?: number;
  applicability?: {
    required_tags: string[];
    preferred_tags: string[];
    excluded_tags: string[];
  };
  failure_boundaries?: string[];
  target_improvement_hints?: string[];
  evidence?: string[];
};

export type LocalAgentTeamWorkspace = {
  summary: {
    team_id: string;
    mode: "single_worker" | "delegated_team";
    status: "planned" | "active" | "completed";
    supervisor_session_id?: string;
    resume_supported: boolean;
    session_count: number;
    active_session_count: number;
    completed_session_count: number;
    message_count: number;
    isolated_context_count: number;
    checkpoint_count: number;
    future_upgrade_path?: string;
  };
  sessions: Array<{
    subagent_session_id: string;
    role: "supervisor" | "capability_router" | "execution_worker" | "verification_guard" | "learning_curator";
    worker_kind: string;
      worker_name: string;
      status: "planned" | "running" | "completed" | "failed" | "paused";
      isolated_context_key: string;
      checkpoint_count: number;
      message_count: number;
      last_message_id?: string;
      resume_supported: boolean;
      result_summary?: string;
    }>;
  checkpoints: Array<{
    checkpoint_id: string;
    subagent_session_id: string;
    stage: string;
    summary: string;
    created_at: string;
  }>;
  messages: Array<{
    message_id: string;
    subagent_session_id: string;
    direction: "supervisor_to_subagent" | "subagent_to_supervisor";
    kind: "assignment" | "context" | "progress" | "result" | "handoff";
    summary: string;
    created_at: string;
  }>;
  resumeRequests: Array<{
    request_id: string;
    subagent_session_id: string;
    actor_role: string;
    reason?: string;
    last_checkpoint_id?: string;
    status: "pending" | "accepted" | "completed" | "rejected";
    accepted_by?: string;
    accepted_at?: string;
    resolved_by?: string;
    resolved_at?: string;
    resolution_note?: string;
    result_summary?: string;
    requested_at: string;
    updated_at: string;
  }>;
  resumePackages: Array<{
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    handoff_checkpoint_id: string;
    status: "prepared" | "applied" | "superseded";
    package_summary: string;
    execution_state_summary?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    applied_at?: string;
    applied_by?: string;
    applied_note?: string;
    applied_checkpoint_id?: string;
    deep_link?: string;
  }>;
  executionRuns: Array<{
    execution_run_id: string;
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    status: "running" | "completed" | "failed";
    runtime_kind: "delegated_runtime";
    start_checkpoint_id: string;
    latest_checkpoint_id?: string;
    result_summary?: string;
    started_by: string;
    started_at: string;
    updated_at: string;
    completed_at?: string;
    completion_note?: string;
    deep_link?: string;
  }>;
  runtimeBindings: Array<{
    binding_id: string;
    execution_run_id: string;
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    status: "bound" | "released";
    runtime_kind: "host_guarded" | "sandbox_runner" | "cloud_runner";
    sandbox_profile: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
    runtime_locator?: string;
    latest_heartbeat_at?: string;
    bound_by: string;
    bound_at: string;
    released_at?: string;
    release_reason?: string;
    deep_link?: string;
  }>;
  runtimeInstances: Array<{
    instance_id: string;
    binding_id: string;
    execution_run_id: string;
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    status: "active" | "completed" | "failed" | "released";
    runtime_kind: "host_guarded" | "sandbox_runner" | "cloud_runner";
    sandbox_profile: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
    runtime_locator?: string;
    launched_by: string;
    launched_at: string;
    latest_heartbeat_at?: string;
    latest_heartbeat_note?: string;
    launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
    launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    isolation_scope: "host_process" | "sandbox_pool" | "remote_control_plane";
    quota_profile: "local_worker_default" | "sandbox_pool_default" | "cloud_runner_default";
    mutation_guarded: boolean;
    launcher_state: "attached" | "external_pending" | "released";
    launcher_locator?: string;
    launcher_attached_at?: string;
    launcher_summary?: string;
    launcher_worker_run_id?: string;
    finished_at?: string;
    finish_reason?: string;
    deep_link?: string;
  }>;
  runtimeLaunchSpecs: Array<SubagentRuntimeLaunchSpec>;
  runtimeLaunchReceipts: Array<SubagentRuntimeLaunchReceipt>;
    launcherBackendAdapters: LocalAgentTeamLauncherBackendAdapterCatalogEntry[];
    launcherBackendAdapterStatuses: LocalAgentTeamLauncherBackendAdapterStatusEntry[];
    runnerBackendAdapters: LocalAgentTeamRunnerBackendAdapterCatalogEntry[];
    runnerBackendAdapterStatuses: LocalAgentTeamRunnerBackendAdapterStatusEntry[];
    runtimeAdapterRuns: Array<{
    adapter_run_id: string;
    receipt_id: string;
    instance_id: string;
    binding_id: string;
    execution_run_id: string;
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
    launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    launch_locator?: string;
    execution_locator?: string;
    status: "running" | "completed" | "failed";
    started_by: string;
    started_at: string;
    latest_heartbeat_at?: string;
    latest_heartbeat_note?: string;
    completed_at?: string;
    completion_note?: string;
    deep_link?: string;
  }>;
  runtimeBackendExecutions: Array<{
    backend_execution_id: string;
    lease_id?: string;
    adapter_run_id: string;
    receipt_id: string;
    instance_id: string;
    binding_id: string;
    execution_run_id: string;
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    adapter_id: "local_worker_backend_adapter" | "sandbox_pool_backend_adapter" | "cloud_control_plane_backend_adapter";
    backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
    launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    execution_style: "inline_control_plane" | "delegated_runtime_adapter" | "future_remote_runner";
    launch_locator?: string;
    execution_locator?: string;
    status: "running" | "completed" | "failed";
    started_by: string;
    started_at: string;
    latest_heartbeat_at?: string;
    latest_heartbeat_note?: string;
    completed_at?: string;
    completion_note?: string;
    deep_link?: string;
  }>;
  runtimeRunnerBackendLeases: Array<{
    lease_id: string;
    adapter_run_id: string;
    receipt_id: string;
    instance_id: string;
    binding_id: string;
    execution_run_id: string;
    package_id: string;
    request_id: string;
    team_id: string;
    task_id: string;
    subagent_session_id: string;
    adapter_id: "local_process_runner_backend" | "sandbox_job_runner_backend" | "cloud_job_runner_backend";
    runner_kind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
    backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
    launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    quota_profile: "local_worker_default" | "sandbox_pool_default" | "cloud_runner_default";
    isolation_scope: "host_process" | "sandbox_pool" | "remote_control_plane";
    execution_locator?: string;
    resource_locator?: string;
    status: "allocated" | "released" | "failed";
    allocated_by: string;
    allocated_at: string;
    latest_heartbeat_at?: string;
    latest_heartbeat_note?: string;
    released_at?: string;
    release_note?: string;
    deep_link?: string;
  }>;
  runtimeDriverRuns: Array<{
    driver_run_id: string;
    backend_execution_id: string;
    adapter_run_id: string;
    receipt_id: string;
    instance_id: string;
    binding_id: string;
    execution_run_id: string;
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    adapter_id: "local_worker_backend_adapter" | "sandbox_pool_backend_adapter" | "cloud_control_plane_backend_adapter";
    backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
    launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    execution_style: "inline_control_plane" | "delegated_runtime_adapter" | "future_remote_runner";
    launch_locator?: string;
    execution_locator?: string;
    status: "running" | "completed" | "failed";
    started_by: string;
    started_at: string;
    latest_heartbeat_at?: string;
    latest_heartbeat_note?: string;
    completed_at?: string;
    completion_note?: string;
    deep_link?: string;
  }>;
    runtimeRunnerHandles: Array<{
      runner_handle_id: string;
      driver_run_id: string;
      backend_execution_id: string;
    adapter_run_id: string;
    receipt_id: string;
    instance_id: string;
    binding_id: string;
    execution_run_id: string;
    package_id: string;
    request_id: string;
    subagent_session_id: string;
    adapter_id: "local_worker_backend_adapter" | "sandbox_pool_backend_adapter" | "cloud_control_plane_backend_adapter";
    backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
    launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    runner_kind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
    status: "attached" | "released" | "failed";
    attached_by: string;
    attached_at: string;
    latest_heartbeat_at?: string;
    latest_heartbeat_note?: string;
    runner_locator?: string;
    released_at?: string;
      release_reason?: string;
      deep_link?: string;
    }>;
    runtimeRunnerExecutions: Array<{
      runner_execution_id: string;
      runner_handle_id: string;
      driver_run_id: string;
      backend_execution_id: string;
      adapter_run_id: string;
      receipt_id: string;
      instance_id: string;
      binding_id: string;
      execution_run_id: string;
      package_id: string;
      request_id: string;
      team_id: string;
      task_id: string;
      subagent_session_id: string;
      adapter_id: "local_worker_backend_adapter" | "sandbox_pool_backend_adapter" | "cloud_control_plane_backend_adapter";
      backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
      launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
      runner_kind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
      runner_locator?: string;
      execution_locator?: string;
      status: "running" | "completed" | "failed";
      started_by: string;
      started_at: string;
      latest_heartbeat_at?: string;
      latest_heartbeat_note?: string;
      completed_at?: string;
      completed_by?: string;
      completion_note?: string;
      deep_link?: string;
    }>;
    runtimeRunnerJobs: Array<{
      runner_job_id: string;
      runner_execution_id: string;
      runner_handle_id: string;
      driver_run_id: string;
      backend_execution_id: string;
      adapter_run_id: string;
      receipt_id: string;
      lease_id?: string;
      instance_id: string;
      binding_id: string;
      execution_run_id: string;
      package_id: string;
      request_id: string;
      team_id: string;
      task_id: string;
      subagent_session_id: string;
      adapter_id: "local_worker_backend_adapter" | "sandbox_pool_backend_adapter" | "cloud_control_plane_backend_adapter";
      backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
      launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
      runner_kind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
      job_kind: "local_process_job" | "sandbox_execution_job" | "cloud_execution_job";
      runner_locator?: string;
      execution_locator?: string;
      job_locator?: string;
      status: "running" | "completed" | "failed";
      started_by: string;
      started_at: string;
      latest_heartbeat_at?: string;
      latest_heartbeat_note?: string;
      completed_at?: string;
      completed_by?: string;
      completion_note?: string;
      deep_link?: string;
    }>;
  launcherCatalog: LocalAgentTeamLauncherCatalogEntry[];
  launcherStatuses: Array<{
    launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
    availability: "ready" | "attention" | "degraded";
    active_runtime_count: number;
    pending_attachment_count: number;
    released_runtime_count: number;
    recommended_action: string;
    summary: string;
  }>;
  launcherDrivers: LocalAgentTeamLauncherDriverCatalogEntry[];
  launcherDriverStatuses: LocalAgentTeamLauncherDriverStatusEntry[];
  timeline: Array<{
    entry_id: string;
    source_type:
      | "session"
      | "message"
      | "checkpoint"
      | "resume_request"
      | "resume_package"
      | "execution_run"
      | "runtime_binding"
      | "runtime_instance"
      | "runtime_launch_receipt"
      | "runtime_adapter_run"
      | "runtime_runner_backend_lease"
      | "runtime_backend_execution"
      | "runtime_driver_run"
      | "runtime_runner_handle"
      | "runtime_runner_execution"
      | "runtime_runner_job";
    source_id: string;
    subagent_session_id?: string;
    role?: "supervisor" | "capability_router" | "execution_worker" | "verification_guard" | "learning_curator";
    event_kind: string;
    summary: string;
    created_at: string;
  }>;
};

export type LocalTaskWorkspace = {
  task: TaskContract;
  runtimeBoundaries: {
    session: {
      session_id: string;
      memory_strategy: "compacted" | "raw" | "promoted";
      memory_items: number;
      methodology_items: number;
      checkpoint_count: number;
      promoted_memory: boolean;
    };
    harness: {
      harness_id: string;
      planner_mode: "fresh_plan" | "template_reuse" | "playbook_reuse" | "mixed";
      capability_resolution_count: number;
      verification_stack: string[];
      fast_path_reuse: boolean;
    };
    sandbox: {
      sandbox_id: string;
      isolation_tier: "host_guarded" | "sandbox_runner" | "cloud_runner";
      execution_profile: "read_only" | "confirmed_write" | "connector_only" | "mixed";
      guarded_scopes: string[];
      mutation_present: boolean;
      future_upgrade_path?: string;
    };
  };
  agentTeam: LocalAgentTeamWorkspace;
  executionTemplate: LocalExecutionTemplateWorkspace;
  reuseImprovement: LocalReuseImprovementWorkspace | null;
  artifacts: ReturnType<typeof listTaskArtifacts>;
  checkpoints: ReturnType<typeof listTaskCheckpoints>;
  workerRuns: ReturnType<typeof listTaskWorkerRuns>;
  capabilityResolutions: ReturnType<typeof listTaskCapabilityResults>;
  toolInvocations: ReturnType<typeof listTaskToolInvocations>;
  browserSessions: ReturnType<typeof listTaskBrowserSessions>;
  checklist: ReturnType<typeof store.checklistResults.get> | null;
  reconciliation: ReturnType<typeof store.reconciliationResults.get> | null;
  verification: ReturnType<typeof store.verificationResults.get> | null;
  doneGate: ReturnType<typeof store.doneGateResults.get> | null;
  memoryItems: ReturnType<typeof listTaskMemoryItems>;
  skillCandidates: ReturnType<typeof listTaskSkillCandidates>;
  reuseRecommendations: Array<{
    kind: "learned_playbook" | "task_template";
    name: string;
    score: number;
    version: number;
    source_task_count: number;
    fingerprint?: string;
    applicability: {
      required_tags: string[];
      preferred_tags: string[];
      excluded_tags: string[];
    };
    failure_boundaries: string[];
  }>;
  operationalSummary: {
    tooling: {
      total_invocations: number;
      successful_invocations: number;
      failed_invocations: number;
      local_invocations: number;
      external_invocations: number;
      idempotent_invocations: number;
      compensable_pending: number;
      compensations_applied: number;
      compensations_failed: number;
    };
    reconciliation: {
      external_state_pending: number;
      external_state_applied: number;
      external_state_failed: number;
      artifact_ready: number;
    };
    resilience: {
      degraded_invocations: number;
      circuit_open: number;
      circuit_half_open: number;
    };
    manual_attention: string[];
  };
  audits: ReturnType<typeof listTaskAudits>;
  watchdog: ReturnType<typeof evaluateWatchdog>;
};

export type LocalBrowserSnapshot = {
  url: string;
  engine: "playwright_worker" | "fetch_snapshot";
  title: string | null;
  status_code: number | null;
  content_type: string | null;
  text_excerpt: string;
  dom_summary: {
    heading_count: number;
    link_count: number;
    form_count: number;
    interactive_count: number;
    sample_links: string[];
    sample_headings: string[];
  } | null;
  resilience?: LocalExecutionResilience;
};

export type LocalShellCommandResult = {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  resilience?: LocalExecutionResilience;
};

type CircuitState = {
  failures: number;
  state: "closed" | "open" | "half_open";
  opened_at?: number;
};

const resilienceCircuits = new Map<string, CircuitState>();
const RESILIENCE_CONFIG = {
  shell: {
    failureThreshold: 2,
    cooldownMs: 60_000
  },
  browser: {
    failureThreshold: 2,
    cooldownMs: 60_000,
    maxAttempts: 2,
    timeoutMs: 20_000
  }
} as const;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(",")}}`;
}

function buildToolIdempotencyKey(toolName: string, payload: Record<string, unknown>): string {
  const digest = createHash("sha256").update(`${toolName}:${stableStringify(payload)}`).digest("hex").slice(0, 24);
  return `${toolName}_${digest}`;
}

function findSuccessfulInvocationByIdempotency(taskId: string, toolName: string, idempotencyKey: string) {
  return [...store.toolInvocations.values()]
    .filter(invocation => invocation.task_id === taskId && invocation.tool_name === toolName && invocation.status === "succeeded")
    .find(invocation => invocation.idempotency_key === idempotencyKey);
}

export type LocalIdeWorkspaceSummary = {
  root_path: string;
  project_name: string | null;
  detected: {
    package_json: boolean;
    tsconfig: boolean;
    git_repo: boolean;
    readme: boolean;
  };
  package_json: {
    scripts: string[];
    dependency_count: number;
    dev_dependency_count: number;
  } | null;
  tsconfig: {
    files: string[];
  } | null;
  top_level_entries: Array<{
    name: string;
    kind: "file" | "directory";
  }>;
  package_manager: "npm" | "pnpm" | "yarn" | "unknown";
  workspace_kind: "node" | "generic";
};

function getRiskOrder(level: RiskLevel): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[level];
}

function getWorkspaceRoots(task: TaskContract): string[] {
  const requestedRoots = Array.isArray(task.inputs.workspace_paths)
    ? task.inputs.workspace_paths.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  if (requestedRoots.length > 0) {
    return [...new Set(requestedRoots.map(root => resolve(root)))];
  }
  try {
    const settings = loadLocalAppSettings();
    const taskDirs = resolveTaskDirectoryPaths(settings, task.task_id);
    return [...new Set([
      resolve(settings.workspace_root),
      resolve(settings.default_write_root),
      resolve(settings.default_export_dir),
      resolve(taskDirs.task_workdir),
      resolve(taskDirs.task_run_dir)
    ])];
  } catch {
    return [process.cwd()];
  }
}

function ensurePathWithinRoots(task: TaskContract, requestedPath?: string): string {
  const resolvedPath = resolve(requestedPath ?? process.cwd());
  const roots = getWorkspaceRoots(task);
  const isAllowed = roots.some(root => {
    const rel = relative(root, resolvedPath);
    return rel === "" || (!rel.startsWith("..") && !rel.includes(":"));
  });

  if (!isAllowed) {
    throw new Error(`Path '${resolvedPath}' is outside the permitted workspace roots.`);
  }

  return resolvedPath;
}

function resolveWritePath(task: TaskContract, requestedPath: string): string {
  if (isAbsolute(requestedPath)) return requestedPath;
  try {
    const settings = loadLocalAppSettings();
    return resolve(settings.default_write_root, requestedPath);
  } catch {
    return resolve(requestedPath);
  }
}

function resolveExportPath(requestedPath?: string): string {
  if (requestedPath && isAbsolute(requestedPath)) return requestedPath;
  try {
    const settings = loadLocalAppSettings();
    return resolve(settings.default_export_dir, requestedPath ?? "");
  } catch {
    return resolve(requestedPath ?? process.cwd());
  }
}

function resolveVerificationEvidencePath(taskId: string, filename: string): string {
  try {
    const settings = loadLocalAppSettings();
    const taskDirs = resolveTaskDirectoryPaths(settings, taskId);
    return resolve(taskDirs.task_verification_dir, filename);
  } catch {
    return resolve(filename);
  }
}

function resolveTaskRunPath(taskId: string, filename: string): string {
  try {
    const settings = loadLocalAppSettings();
    const taskDirs = resolveTaskDirectoryPaths(settings, taskId);
    return resolve(taskDirs.task_run_dir, filename);
  } catch {
    return resolve(filename);
  }
}

function sanitizeShellCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

function getCircuitState(key: string): CircuitState {
  return resilienceCircuits.get(key) ?? { failures: 0, state: "closed" };
}

function getCircuitStatus(key: string, config: { cooldownMs: number }): CircuitState["state"] {
  const current = getCircuitState(key);
  if (current.state === "open" && current.opened_at && Date.now() - current.opened_at >= config.cooldownMs) {
    const next: CircuitState = { failures: current.failures, state: "half_open" };
    resilienceCircuits.set(key, next);
    return next.state;
  }
  return current.state;
}

function recordCircuitSuccess(key: string) {
  resilienceCircuits.set(key, { failures: 0, state: "closed" });
}

function recordCircuitFailure(key: string, config: { failureThreshold: number }) {
  const current = getCircuitState(key);
  const failures = current.failures + 1;
  if (failures >= config.failureThreshold) {
    resilienceCircuits.set(key, { failures, state: "open", opened_at: Date.now() });
    return "open" as const;
  }
  resilienceCircuits.set(key, { failures, state: "closed" });
  return "closed" as const;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function isReadOnlyShellCommand(command: string): boolean {
  const normalized = sanitizeShellCommand(command);
  const blockedPatterns = [
    /&&|\|\||;|>|<|\|/,
    /\b(del|erase|rm|rmdir|Remove-Item|Move-Item|Copy-Item|Set-Content|Add-Content|Out-File)\b/i,
    /\b(shutdown|restart|format|diskpart)\b/i
  ];
  if (blockedPatterns.some(pattern => pattern.test(normalized))) return false;

  const allowPatterns = [
    /^(Get-Location|pwd)$/i,
    /^(Get-ChildItem|dir|ls)(\s.+)?$/i,
    /^git status(\s.+)?$/i,
    /^git diff --stat(\s.+)?$/i,
    /^git branch --show-current$/i,
    /^node -v$/i,
    /^python --version$/i,
    /^npm run (check|smoke)$/i
  ];

  return allowPatterns.some(pattern => pattern.test(normalized));
}

function shellCommandForCurrentOs(command: string): { executable: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      executable: "powershell.exe",
      args: ["-NoProfile", "-Command", command]
    };
  }

  return {
    executable: "/bin/sh",
    args: ["-lc", command]
  };
}

export function evaluateLocalPermission(
  taskId: string,
  scope: LocalPermissionScope,
  detail?: string
): LocalPermissionDecision {
  const task = requireTask(taskId);
  const highRisk = getRiskOrder(task.risk_level) >= getRiskOrder("high");

  if (scope === "local_files.read") {
    return { scope, behavior: "allow", reason: "Read-only local file access is allowed by default for active tasks." };
  }

  if (scope === "local_browser.automate" && task.department === "qa") {
    return { scope, behavior: "allow", reason: "QA tasks may automate the browser by default." };
  }

  if (scope === "local_shell.execute") {
    return highRisk
      ? { scope, behavior: "ask", reason: "High-risk tasks require explicit approval before shell execution." }
      : { scope, behavior: "ask", reason: "Shell execution always requires explicit user approval." };
  }

  if (scope === "local_files.write" || scope === "local_ide.control" || scope === "local_app.invoke") {
    return highRisk
      ? { scope, behavior: "deny", reason: `The task risk level is too high for unattended ${scope} access.` }
      : { scope, behavior: "ask", reason: `${scope} requires a local confirmation${detail ? `: ${detail}` : "."}` };
  }

  return { scope, behavior: "ask", reason: `${scope} requires interactive approval.` };
}

export function getLocalToolCatalog(): LocalToolCatalogEntry[] {
  return [
    {
      tool_name: "local_fs_list",
      category: "filesystem",
      requires_permission: "local_files.read",
      behavior: "allow",
      description: "Read-only directory listing within approved workspace roots."
    },
    {
      tool_name: "local_fs_read",
      category: "filesystem",
      requires_permission: "local_files.read",
      behavior: "allow",
      description: "Read-only file access within approved workspace roots."
    },
    {
      tool_name: "local_fs_write",
      category: "filesystem",
      requires_permission: "local_files.write",
      behavior: "ask",
      description: "Confirmation-gated file write within approved workspace roots with backup artifact capture."
    },
    {
      tool_name: "local_fs_patch",
      category: "filesystem",
      requires_permission: "local_files.write",
      behavior: "ask",
      description: "Confirmation-gated exact-match patching within approved workspace roots."
    },
    {
      tool_name: "local_fs_rollback",
      category: "filesystem",
      requires_permission: "local_files.write",
      behavior: "ask",
      description: "Confirmation-gated rollback of the latest compensable local file write or patch."
    },
    {
      tool_name: "local_shell_run",
      category: "shell",
      requires_permission: "local_shell.execute",
      behavior: "ask",
      description: "Controlled shell execution for read-only diagnostic commands."
    },
    {
      tool_name: "local_browser_snapshot",
      category: "browser",
      requires_permission: "local_browser.automate",
      behavior: "ask",
      description: "Low-risk browser snapshot for QA and validation tasks."
    },
    {
      tool_name: "local_ide_workspace_summary",
      category: "ide",
      requires_permission: "local_ide.control",
      behavior: "ask",
      description: "Read-only workspace summary that simulates initial IDE context gathering."
    }
  ];
}

export function getLocalAgentTeamLauncherCatalog(): LocalAgentTeamLauncherCatalogEntry[] {
  return [
    SubagentRuntimeLauncherCatalogEntrySchema.parse({
      launcher_kind: "worker_run",
      label: "Local Worker Launcher",
      description: "Attach the delegated runtime to a managed local worker run inside the current control plane.",
      runtime_kind: "host_guarded",
      sandbox_profile: "delegated_resume_default",
      attachment_mode: "managed",
      requires_locator: false,
      future_upgrade_path: "Use this as the default local bridge until dedicated sandbox or cloud launchers are available."
    }),
    SubagentRuntimeLauncherCatalogEntrySchema.parse({
      launcher_kind: "sandbox_runner",
      label: "Sandbox Runner",
      description: "Bind delegated execution to an external sandbox runner. The runtime stays external_pending until the first heartbeat arrives.",
      runtime_kind: "sandbox_runner",
      sandbox_profile: "delegated_resume_default",
      attachment_mode: "external",
      requires_locator: true,
      locator_placeholder: "sandbox://pool/runtime-instance",
      future_upgrade_path: "Replace manual locator entry with sandbox pool discovery once the dedicated runner lands."
    }),
    SubagentRuntimeLauncherCatalogEntrySchema.parse({
      launcher_kind: "cloud_runner",
      label: "Cloud Runner",
      description: "Bind delegated execution to a remote cloud runner for long-running or isolated execution.",
      runtime_kind: "cloud_runner",
      sandbox_profile: "connector_guarded",
      attachment_mode: "external",
      requires_locator: true,
      locator_placeholder: "cloud://runner/instance-id",
      future_upgrade_path: "Promote this into a managed cloud control-plane backed launcher when hosted runtime workers land."
    })
  ];
}

export function getLocalAgentTeamLauncherDriverCatalog(): LocalAgentTeamLauncherDriverCatalogEntry[] {
  return [
    SubagentRuntimeLauncherDriverCatalogEntrySchema.parse({
      driver_id: "local_worker_run_driver",
      launcher_kind: "worker_run",
      label: "Managed Worker Driver",
      description: "Launch delegated runtime through a managed local worker run controlled by the current control plane.",
      runtime_kind: "host_guarded",
      sandbox_profile: "delegated_resume_default",
      attachment_mode: "managed",
      health_contract: "worker_run_lifecycle",
      isolation_scope: "host_process",
      quota_profile: "local_worker_default",
      mutation_guarded: true,
      capability_flags: ["managed_launch", "worker_run_audit", "local_resume_bridge"],
      requires_locator: false,
      future_upgrade_path: "Swap the managed worker driver with a dedicated sandbox pool driver when isolated runners are available."
    }),
    SubagentRuntimeLauncherDriverCatalogEntrySchema.parse({
      driver_id: "sandbox_pool_driver",
      launcher_kind: "sandbox_runner",
      label: "Sandbox Pool Driver",
      description: "Attach delegated runtime to an external sandbox pool and confirm liveness through heartbeat handshakes.",
      runtime_kind: "sandbox_runner",
      sandbox_profile: "delegated_resume_default",
      attachment_mode: "external",
      health_contract: "external_heartbeat",
      isolation_scope: "sandbox_pool",
      quota_profile: "sandbox_pool_default",
      mutation_guarded: true,
      capability_flags: ["external_locator", "heartbeat_attach", "sandbox_pool"],
      requires_locator: true,
      locator_placeholder: "sandbox://pool/runtime-instance",
      future_upgrade_path: "Replace manual locator entry with sandbox pool discovery once dedicated runner orchestration lands."
    }),
    SubagentRuntimeLauncherDriverCatalogEntrySchema.parse({
      driver_id: "cloud_control_plane_driver",
      launcher_kind: "cloud_runner",
      label: "Cloud Control Plane Driver",
      description: "Attach delegated runtime to a hosted cloud runner with a remote control plane and deferred heartbeat confirmation.",
      runtime_kind: "cloud_runner",
      sandbox_profile: "connector_guarded",
      attachment_mode: "external",
      health_contract: "cloud_control_plane",
      isolation_scope: "remote_control_plane",
      quota_profile: "cloud_runner_default",
      mutation_guarded: true,
      capability_flags: ["remote_locator", "cloud_attach", "hosted_resume_bridge"],
      requires_locator: true,
      locator_placeholder: "cloud://runner/instance-id",
      future_upgrade_path: "Promote this into a first-class hosted control plane once cloud delegated workers are available."
    })
  ];
}

export function getLocalAgentTeamLauncherStatuses() {
  const runtimeInstances = [...store.subagentRuntimeInstances.values()];
  return getLocalAgentTeamLauncherCatalog().map(item => {
    const matching = runtimeInstances.filter(instance => instance.launcher_kind === item.launcher_kind);
    const activeRuntimeCount = matching.filter(instance => instance.status === "active").length;
    const pendingAttachmentCount = matching.filter(instance => instance.launcher_state === "external_pending").length;
    const releasedRuntimeCount = matching.filter(
      instance => instance.launcher_state === "released" || instance.status === "released"
    ).length;
    const availability =
      pendingAttachmentCount > 0
        ? "attention"
        : activeRuntimeCount > 0
          ? "ready"
          : releasedRuntimeCount > 0
            ? "ready"
            : item.attachment_mode === "managed"
              ? "ready"
              : "degraded";
    const recommendedAction =
      pendingAttachmentCount > 0
        ? `Review ${item.launcher_kind} attachment locators and send a heartbeat from the delegated runtime.`
        : activeRuntimeCount > 0
          ? `Monitor active ${item.launcher_kind} delegated runtime activity.`
          : item.attachment_mode === "managed"
            ? `Use ${item.launcher_kind} as the default launcher for local delegated runtime coverage.`
            : `Prepare a valid locator before binding ${item.launcher_kind}.`;
    const summary =
      pendingAttachmentCount > 0
        ? `${pendingAttachmentCount} delegated runtime instance(s) are waiting for ${item.launcher_kind} attachment.`
        : activeRuntimeCount > 0
          ? `${activeRuntimeCount} delegated runtime instance(s) currently use ${item.launcher_kind}.`
          : releasedRuntimeCount > 0
            ? `${releasedRuntimeCount} delegated runtime instance(s) most recently exited through ${item.launcher_kind}.`
            : `No delegated runtime instances have used ${item.launcher_kind} yet.`;
    return SubagentRuntimeLauncherStatusSchema.parse({
      launcher_kind: item.launcher_kind,
      availability,
      active_runtime_count: activeRuntimeCount,
      pending_attachment_count: pendingAttachmentCount,
      released_runtime_count: releasedRuntimeCount,
      recommended_action: recommendedAction,
      summary
    });
  });
}

export function getLocalAgentTeamLauncherDriverStatuses(): LocalAgentTeamLauncherDriverStatusEntry[] {
  const runtimeInstances = [...store.subagentRuntimeInstances.values()];
  return getLocalAgentTeamLauncherDriverCatalog().map(driver => {
    const matching = runtimeInstances.filter(instance => instance.launcher_driver_id === driver.driver_id);
    const activeRuntimeCount = matching.filter(instance => instance.status === "active").length;
    const pendingAttachmentCount = matching.filter(instance => instance.launcher_state === "external_pending").length;
    const releasedRuntimeCount = matching.filter(
      instance => instance.launcher_state === "released" || instance.status === "released"
    ).length;
    const health =
      pendingAttachmentCount > 0
        ? "attention"
        : activeRuntimeCount > 0
          ? "healthy"
          : driver.attachment_mode === "managed"
            ? "healthy"
            : releasedRuntimeCount > 0
              ? "healthy"
              : "degraded";
    const recommendedAction =
      pendingAttachmentCount > 0
        ? `Review ${driver.driver_id} attachment locators and confirm heartbeat from the delegated runtime.`
        : activeRuntimeCount > 0
          ? `Monitor active delegated runtime instances attached through ${driver.driver_id}.`
          : driver.attachment_mode === "managed"
            ? `Use ${driver.driver_id} as the default managed launcher driver for delegated runtime coverage.`
            : `Prepare a valid locator before binding delegated runtime through ${driver.driver_id}.`;
    const summary =
      pendingAttachmentCount > 0
        ? `${pendingAttachmentCount} delegated runtime instance(s) are waiting for ${driver.driver_id} to attach.`
        : activeRuntimeCount > 0
          ? `${activeRuntimeCount} delegated runtime instance(s) currently use ${driver.driver_id}.`
          : releasedRuntimeCount > 0
            ? `${releasedRuntimeCount} delegated runtime instance(s) most recently exited through ${driver.driver_id}.`
            : `No delegated runtime instances have used ${driver.driver_id} yet.`;
    return SubagentRuntimeLauncherDriverStatusSchema.parse({
      driver_id: driver.driver_id,
      launcher_kind: driver.launcher_kind,
      health,
      active_runtime_count: activeRuntimeCount,
      pending_attachment_count: pendingAttachmentCount,
      released_runtime_count: releasedRuntimeCount,
      recommended_action: recommendedAction,
      summary
    });
  });
}

export function getLocalAgentTeamLauncherBackendAdapterCatalog(): LocalAgentTeamLauncherBackendAdapterCatalogEntry[] {
  return getSubagentRuntimeLauncherBackendAdapterCatalog().map(item =>
    SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema.parse(item)
  );
}

export function getLocalAgentTeamLauncherBackendAdapterStatuses(): LocalAgentTeamLauncherBackendAdapterStatusEntry[] {
  return getSubagentRuntimeLauncherBackendAdapterStatuses().map(item =>
    SubagentRuntimeLauncherBackendAdapterStatusSchema.parse(item)
  );
}

export function getLocalAgentTeamRunnerBackendAdapterCatalog(): LocalAgentTeamRunnerBackendAdapterCatalogEntry[] {
  return getSubagentRuntimeRunnerBackendAdapterCatalog().map(item =>
    SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema.parse(item)
  );
}

export function getLocalAgentTeamRunnerBackendAdapterStatuses(): LocalAgentTeamRunnerBackendAdapterStatusEntry[] {
  return getSubagentRuntimeRunnerBackendAdapterStatuses().map(item =>
    SubagentRuntimeRunnerBackendAdapterStatusSchema.parse(item)
  );
}

export function listTasks(): TaskContract[] {
  return [...store.tasks.values()].sort((a, b) => Date.parse(b.timestamps.created_at) - Date.parse(a.timestamps.created_at));
}

export function listTaskAudits(taskId: string) {
  return store.audits.filter(entry => entry.task_id === taskId);
}

export function listTaskMemoryItems(taskId: string) {
  return [...store.memoryItems.values()].filter(item => item.task_id === taskId);
}

export function listTaskSkillCandidates(taskId: string) {
  return [...store.skillCandidates.values()].filter(item => item.task_id === taskId);
}

function buildOperationalSummary(toolInvocations: ReturnType<typeof listTaskToolInvocations>) {
  const tooling = {
    total_invocations: toolInvocations.length,
    successful_invocations: 0,
    failed_invocations: 0,
    local_invocations: 0,
    external_invocations: 0,
    idempotent_invocations: 0,
    compensable_pending: 0,
    compensations_applied: 0,
    compensations_failed: 0
  };
  const reconciliation = {
    external_state_pending: 0,
    external_state_applied: 0,
    external_state_failed: 0,
    artifact_ready: 0
  };
  const resilience = {
    degraded_invocations: 0,
    circuit_open: 0,
    circuit_half_open: 0
  };

  for (const invocation of toolInvocations) {
    if (invocation.status === "succeeded") tooling.successful_invocations += 1;
    if (invocation.status === "failed") tooling.failed_invocations += 1;
    if (invocation.idempotency_key) tooling.idempotent_invocations += 1;
    if (invocation.compensation_available && invocation.compensation_status === "available") tooling.compensable_pending += 1;
    if (invocation.compensation_status === "applied") tooling.compensations_applied += 1;
    if (invocation.compensation_status === "failed") tooling.compensations_failed += 1;

    const output = invocation.output as Record<string, unknown>;
    const reconciliationMode = typeof output.reconciliation_mode === "string" ? output.reconciliation_mode : null;
    const reconciliationState = typeof output.reconciliation_state === "string" ? output.reconciliation_state : null;
    const resiliencePayload =
      output.resilience && typeof output.resilience === "object"
        ? (output.resilience as Record<string, unknown>)
        : null;

    if (reconciliationMode === "external_state" || reconciliationState) {
      tooling.external_invocations += 1;
    } else {
      tooling.local_invocations += 1;
    }

    if (reconciliationState === "pending") reconciliation.external_state_pending += 1;
    if (reconciliationState === "applied") reconciliation.external_state_applied += 1;
    if (reconciliationState === "failed") reconciliation.external_state_failed += 1;
    if (reconciliationState === "artifact_ready") reconciliation.artifact_ready += 1;

    if (resiliencePayload) {
      if (resiliencePayload.degraded === true) resilience.degraded_invocations += 1;
      if (resiliencePayload.circuit_state === "open") resilience.circuit_open += 1;
      if (resiliencePayload.circuit_state === "half_open") resilience.circuit_half_open += 1;
    }
  }

  const manualAttention = [
    reconciliation.external_state_failed > 0
      ? `${reconciliation.external_state_failed} external action(s) failed reconciliation and need review.`
      : null,
    reconciliation.external_state_pending > 0
      ? `${reconciliation.external_state_pending} external action(s) are still pending reconciliation.`
      : null,
    tooling.compensable_pending > 0
      ? `${tooling.compensable_pending} action(s) can still be compensated if the task needs rollback.`
      : null,
    tooling.compensations_failed > 0
      ? `${tooling.compensations_failed} compensation attempt(s) failed and require manual intervention.`
      : null,
    resilience.circuit_open > 0
      ? `${resilience.circuit_open} tool circuit(s) are open and currently suppressing retries.`
      : null,
    resilience.degraded_invocations > 0
      ? `${resilience.degraded_invocations} invocation(s) completed in degraded mode.`
      : null,
    tooling.failed_invocations > 0 && reconciliation.external_state_failed === 0
      ? `${tooling.failed_invocations} invocation(s) failed and should be inspected before rerun.`
      : null
  ].filter((value): value is string => Boolean(value));

  return {
    tooling,
    reconciliation,
    resilience,
    manual_attention: manualAttention
  };
}

function buildWorkspaceDeepLink(target:
  | { kind: "execution_template"; taskId: string; templateId: string }
  | { kind: "learned_playbook"; taskId: string; playbookId: string }) {
  const params = new URLSearchParams();
  params.set("kind", target.kind);
  params.set("taskId", target.taskId);
  if (target.kind === "execution_template") {
    params.set("templateId", target.templateId);
  } else {
    params.set("playbookId", target.playbookId);
  }
  return `#${params.toString()}`;
}

function parseWorkspaceDeepLink(hash?: string) {
  if (!hash) return null;
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalized) return null;
  const params = new URLSearchParams(normalized);
  const kind = params.get("kind");
  if (kind === "execution_template" && params.get("taskId") && params.get("templateId")) {
    return {
      kind,
      taskId: params.get("taskId") ?? "",
      templateId: params.get("templateId") ?? ""
    } as const;
  }
  if (kind === "learned_playbook" && params.get("taskId") && params.get("playbookId")) {
    return {
      kind,
      taskId: params.get("taskId") ?? "",
      playbookId: params.get("playbookId") ?? ""
    } as const;
  }
  return null;
}

function resolveWorkspaceTargetTemplate(targetId: string, targetTaskId?: string) {
  const direct = store.taskTemplates.get(targetId);
  if (direct) {
    return direct;
  }
  if (targetTaskId) {
    const targetTask = store.tasks.get(targetTaskId);
    const reusedTemplateId =
      typeof targetTask?.inputs?.reused_task_template_id === "string"
        ? targetTask.inputs.reused_task_template_id
        : undefined;
    if (reusedTemplateId) {
      return store.taskTemplates.get(reusedTemplateId) ?? null;
    }
  }
  return null;
}

function buildWorkspaceReuseImprovementFingerprint(targetKind: "execution_template" | "learned_playbook", targetId: string) {
  const targetSuffix = targetId.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "target";
  return `reuse_improvement_${targetKind}_${targetSuffix}`.toLowerCase();
}

function listWorkspaceReuseImprovementHints(targetKind: "execution_template" | "learned_playbook", targetId: string) {
  const fingerprint = buildWorkspaceReuseImprovementFingerprint(targetKind, targetId);
  return [...new Set(
    [...store.memoryItems.values()]
      .filter(item => item.kind === "methodology" && item.fingerprint === fingerprint)
      .map(item => item.content)
      .filter(item => item.trim().length > 0)
  )].slice(-4);
}

function inferSandboxProfile(toolInvocations: ReturnType<typeof listTaskToolInvocations>) {
  const toolNames = toolInvocations.map(invocation => invocation.tool_name);
  const hasLocalMutation = toolNames.some(name => name === "local_fs_write" || name === "local_fs_patch");
  const hasShell = toolNames.includes("local_shell_run");
  const hasExternal = toolNames.some(name => name === "http_json_fetch" || name === "crm_contact_lookup" || name === "hr_candidate_lookup" || name === "finance_reconcile");
  const hasBrowser = toolNames.some(name => name === "local_browser_snapshot" || name === "local_browser_navigate");

  if (hasLocalMutation || (hasShell && hasExternal)) {
    return {
      execution_profile: "mixed" as const,
      guarded_scopes: ["local_files.write", "local_shell.execute", ...(hasExternal ? ["external_connectors"] : []), ...(hasBrowser ? ["local_browser.automate"] : [])],
      mutation_present: true
    };
  }
  if (hasLocalMutation) {
    return {
      execution_profile: "confirmed_write" as const,
      guarded_scopes: ["local_files.write"],
      mutation_present: true
    };
  }
  if (hasExternal && !hasShell && !hasBrowser) {
    return {
      execution_profile: "connector_only" as const,
      guarded_scopes: ["external_connectors"],
      mutation_present: false
    };
  }
  return {
    execution_profile: "read_only" as const,
    guarded_scopes: [...new Set([...(hasShell ? ["local_shell.execute"] : []), ...(hasBrowser ? ["local_browser.automate"] : [])])],
    mutation_present: false
  };
}

export function getLocalTaskWorkspace(taskId: string): LocalTaskWorkspace {
  const task = requireTask(taskId);
  const toolInvocations = listTaskToolInvocations(taskId);
  const memoryItems = listTaskMemoryItems(taskId);
  const playbookMatches = searchLearnedPlaybooks(task).slice(0, 3);
  const templateMatches = searchTaskTemplates(task).slice(0, 3);
  const reusedTaskTemplate =
    typeof task.inputs.reused_task_template_id === "string" ? store.taskTemplates.get(task.inputs.reused_task_template_id) ?? null : null;
  const relatedPlaybooks: LocalExecutionTemplateWorkspace["related_playbooks"] =
    reusedTaskTemplate
      ? [...store.skillCandidates.values()]
          .filter(candidate => candidate.status === "approved" && candidate.fingerprint === reusedTaskTemplate.fingerprint)
          .sort((left, right) => right.source_task_count - left.source_task_count || right.version - left.version)
          .slice(0, 3)
          .map(candidate => ({
            candidate_id: candidate.candidate_id,
            title: candidate.title,
            summary: candidate.summary,
            version: candidate.version,
            source_task_count: candidate.source_task_count,
            status: candidate.status,
            improvement_hints: candidate.improvement_hints ?? [],
            deep_link: buildWorkspaceDeepLink({
              kind: "learned_playbook",
              taskId: task.task_id,
              playbookId: candidate.candidate_id
            }),
            applicability: candidate.applicability,
            failure_boundaries: candidate.failure_boundaries,
            evidence: candidate.evidence
          }))
      : [];
  const executionTemplate: LocalExecutionTemplateWorkspace = {
    execution_template_key:
      typeof task.inputs.execution_template_key === "string" ? task.inputs.execution_template_key : undefined,
    reused_task_template_id:
      typeof task.inputs.reused_task_template_id === "string" ? task.inputs.reused_task_template_id : undefined,
    reused_task_template_version:
      typeof task.inputs.reused_task_template_version === "number" ? task.inputs.reused_task_template_version : undefined,
    deep_link:
      reusedTaskTemplate
        ? buildWorkspaceDeepLink({
            kind: "execution_template",
            taskId: task.task_id,
            templateId: reusedTaskTemplate.template_id
          })
        : undefined,
    reused_task_template: reusedTaskTemplate
      ? {
          template_id: reusedTaskTemplate.template_id,
          title: reusedTaskTemplate.title,
          fingerprint: reusedTaskTemplate.fingerprint,
          version: reusedTaskTemplate.version,
          source_task_count: reusedTaskTemplate.source_task_count,
          improvement_hints: reusedTaskTemplate.improvement_hints ?? [],
          deep_link: buildWorkspaceDeepLink({
            kind: "execution_template",
            taskId: task.task_id,
            templateId: reusedTaskTemplate.template_id
          }),
          applicability: reusedTaskTemplate.applicability,
          failure_boundaries: reusedTaskTemplate.failure_boundaries
        }
      : undefined,
    related_playbooks: relatedPlaybooks
  };
  const reuseImprovementTarget =
    typeof task.inputs.source_kind === "string" &&
    task.inputs.source_kind === "reuse_navigation" &&
    typeof task.inputs.reuse_target_kind === "string" &&
    typeof task.inputs.reuse_target_id === "string" &&
    (task.inputs.reuse_target_kind === "execution_template" || task.inputs.reuse_target_kind === "learned_playbook")
      ? {
          kind: task.inputs.reuse_target_kind,
          id: task.inputs.reuse_target_id,
          taskId:
            typeof task.inputs.reuse_target_task_id === "string" ? task.inputs.reuse_target_task_id : undefined,
          deepLink:
            typeof task.inputs.reuse_target_deep_link === "string"
              ? task.inputs.reuse_target_deep_link
              : typeof task.inputs.deep_link === "string"
                ? task.inputs.deep_link
                : undefined,
          suggestedLearningAction:
            task.inputs.suggested_learning_action === "refine_execution_template"
            || task.inputs.suggested_learning_action === "refine_learned_playbook"
              ? task.inputs.suggested_learning_action
              : task.inputs.reuse_target_kind === "execution_template"
                ? "refine_execution_template"
                : "refine_learned_playbook"
        }
      : null;
  const reuseImprovement: LocalReuseImprovementWorkspace | null =
    reuseImprovementTarget?.kind === "execution_template"
      ? (() => {
          const targetTemplate = resolveWorkspaceTargetTemplate(reuseImprovementTarget.id, reuseImprovementTarget.taskId);
          const parsedTarget = parseWorkspaceDeepLink(reuseImprovementTarget.deepLink);
          const targetImprovementHints = [
            ...new Set([
              ...(targetTemplate?.improvement_hints ?? []),
              ...listWorkspaceReuseImprovementHints("execution_template", reuseImprovementTarget.id)
            ])
          ].slice(-4);
          return {
            source_kind: "reuse_navigation" as const,
            target_kind: "execution_template" as const,
            target_id: reuseImprovementTarget.id,
            target_task_id: reuseImprovementTarget.taskId ?? parsedTarget?.taskId,
            deep_link:
              reuseImprovementTarget.deepLink
              ?? buildWorkspaceDeepLink({
                kind: "execution_template",
                taskId: reuseImprovementTarget.taskId ?? task.task_id,
                templateId: reuseImprovementTarget.id
              }),
            suggested_learning_action: "refine_execution_template" as const,
            summary:
              "Refine this execution template so operators can act without repeatedly reopening its detail view.",
            target_title: targetTemplate?.title,
            target_version: targetTemplate?.version,
            source_task_count: targetTemplate?.source_task_count,
            applicability: targetTemplate?.applicability,
            failure_boundaries: targetTemplate?.failure_boundaries,
            target_improvement_hints: targetImprovementHints
          };
        })()
      : reuseImprovementTarget?.kind === "learned_playbook"
        ? (() => {
            const targetPlaybook = store.skillCandidates.get(reuseImprovementTarget.id) ?? null;
            const parsedTarget = parseWorkspaceDeepLink(reuseImprovementTarget.deepLink);
            const targetImprovementHints = [
              ...new Set([
                ...(targetPlaybook?.improvement_hints ?? []),
                ...listWorkspaceReuseImprovementHints("learned_playbook", reuseImprovementTarget.id)
              ])
            ].slice(-4);
            return {
              source_kind: "reuse_navigation" as const,
              target_kind: "learned_playbook" as const,
              target_id: reuseImprovementTarget.id,
              target_task_id: reuseImprovementTarget.taskId ?? parsedTarget?.taskId,
              deep_link:
                reuseImprovementTarget.deepLink
                ?? buildWorkspaceDeepLink({
                  kind: "learned_playbook",
                  taskId: reuseImprovementTarget.taskId ?? task.task_id,
                  playbookId: reuseImprovementTarget.id
                }),
              suggested_learning_action: "refine_learned_playbook" as const,
              summary:
                "Refine this learned playbook so operators can apply it directly instead of repeatedly reopening its guidance.",
              target_title: targetPlaybook?.title,
              target_version: targetPlaybook?.version,
              source_task_count: targetPlaybook?.source_task_count,
              applicability: targetPlaybook?.applicability,
              failure_boundaries: targetPlaybook?.failure_boundaries,
              target_improvement_hints: targetImprovementHints,
              evidence: targetPlaybook?.evidence
            };
          })()
        : null;
  const sandboxProfile = inferSandboxProfile(toolInvocations);
  const runtimeBoundaries = RuntimeBoundaryInfoSchema.parse({
    session: {
      session_id: `session_${task.task_id}`,
      memory_strategy: memoryItems.some(item => item.kind === "evaluation" || item.kind === "methodology") ? "promoted" : "compacted",
      memory_items: memoryItems.length,
      methodology_items: memoryItems.filter(item => item.kind === "methodology").length,
      checkpoint_count: listTaskCheckpoints(taskId).length,
      promoted_memory: memoryItems.some(item => item.kind === "evaluation" || item.kind === "methodology")
    },
    harness: {
      harness_id: `harness_${task.task_id}`,
      planner_mode:
        typeof task.inputs.reused_task_template_id === "string" && playbookMatches.length > 0
          ? "mixed"
          : typeof task.inputs.reused_task_template_id === "string"
            ? "template_reuse"
            : playbookMatches.length > 0
              ? "playbook_reuse"
              : "fresh_plan",
      capability_resolution_count: listTaskCapabilityResults(taskId).length,
      verification_stack: ["checklist", "reconciliation", "verifier", "done_gate"],
      fast_path_reuse:
        typeof task.inputs.reused_task_template_id === "string"
        || playbookMatches.length > 0
    },
    sandbox: {
      sandbox_id: `sandbox_${task.task_id}`,
      isolation_tier: "host_guarded",
      execution_profile: sandboxProfile.execution_profile,
      guarded_scopes: sandboxProfile.guarded_scopes,
      mutation_present: sandboxProfile.mutation_present,
      future_upgrade_path: "Promote high-risk local execution into dedicated sandbox runners as Runtime Hardening Phase 5 lands."
    }
  });
  const agentTeamSummary = AgentTeamSummarySchema.parse(getTaskAgentTeamSummary(taskId));
  const agentTeamSessions = listTaskSubagentSessions(taskId).map(session =>
    SubagentSessionSchema.parse(session)
  );
  const agentTeamCheckpoints = listTaskSubagentCheckpoints(taskId).map(checkpoint =>
    SubagentCheckpointSchema.parse(checkpoint)
  );
  const agentTeamMessages = listTaskSubagentMessages(taskId).map(message =>
    SubagentMessageSchema.parse(message)
  );
  const agentTeamResumeRequests = listTaskSubagentResumeRequests(taskId);
  const agentTeamResumePackages = listTaskSubagentResumePackages(taskId);
  const agentTeamExecutionRuns = listTaskSubagentExecutionRuns(taskId);
  const agentTeamRuntimeBindings = listTaskSubagentRuntimeBindings(taskId);
  const agentTeamRuntimeInstances = listTaskSubagentRuntimeInstances(taskId);
  const agentTeamRuntimeLaunchReceipts = listTaskSubagentRuntimeLaunchReceipts(taskId);
  const agentTeamRuntimeAdapterRuns = listTaskSubagentRuntimeAdapterRuns(taskId);
  const agentTeamRuntimeRunnerBackendLeases = listTaskSubagentRuntimeRunnerBackendLeases(taskId);
  const agentTeamRuntimeBackendExecutions = listTaskSubagentRuntimeBackendExecutions(taskId);
  const agentTeamRuntimeDriverRuns = listTaskSubagentRuntimeDriverRuns(taskId);
  const agentTeamRuntimeRunnerHandles = listTaskSubagentRuntimeRunnerHandles(taskId);
  const agentTeamRuntimeRunnerExecutions = listTaskSubagentRuntimeRunnerExecutions(taskId);
  const agentTeamRuntimeRunnerJobs = listTaskSubagentRuntimeRunnerJobs(taskId);
  const agentTeamTimeline = listTaskAgentTeamTimeline(taskId).map(entry =>
    AgentTeamTimelineEntrySchema.parse(entry)
  );
  const agentTeamLauncherCatalog = getLocalAgentTeamLauncherCatalog();
  const agentTeamLauncherStatuses = getLocalAgentTeamLauncherStatuses();
  const agentTeamLauncherDrivers = getLocalAgentTeamLauncherDriverCatalog();
  const agentTeamLauncherDriverStatuses = getLocalAgentTeamLauncherDriverStatuses();
  const agentTeamLauncherBackendAdapters = getLocalAgentTeamLauncherBackendAdapterCatalog();
  const agentTeamLauncherBackendAdapterStatuses = getLocalAgentTeamLauncherBackendAdapterStatuses();
  const agentTeamRunnerBackendAdapters = getLocalAgentTeamRunnerBackendAdapterCatalog();
  const agentTeamRunnerBackendAdapterStatuses = getLocalAgentTeamRunnerBackendAdapterStatuses();
  const agentTeam: LocalAgentTeamWorkspace = {
    summary: {
      team_id: agentTeamSummary.team_id,
      mode: agentTeamSummary.mode,
      status: agentTeamSummary.status,
      supervisor_session_id: agentTeamSummary.supervisor_session_id,
      resume_supported: agentTeamSummary.resume_supported,
      session_count: agentTeamSummary.session_count,
      active_session_count: agentTeamSummary.active_session_count,
      completed_session_count: agentTeamSummary.completed_session_count,
      message_count: agentTeamSummary.message_count,
      isolated_context_count: agentTeamSummary.isolated_context_count,
      checkpoint_count: agentTeamSummary.checkpoint_count,
      future_upgrade_path: agentTeamSummary.future_upgrade_path
    },
    sessions: agentTeamSessions.map(session => ({
      subagent_session_id: session.subagent_session_id,
      role: session.role,
      worker_kind: session.worker_kind,
      worker_name: session.worker_name,
      status: session.status,
      isolated_context_key: session.isolated_context_key,
      checkpoint_count: session.checkpoint_count,
      message_count: session.message_count,
      last_message_id: session.last_message_id,
      resume_supported: session.resume_supported,
      result_summary: session.result_summary
    })),
    checkpoints: agentTeamCheckpoints.map(checkpoint => ({
      checkpoint_id: checkpoint.checkpoint_id,
      subagent_session_id: checkpoint.subagent_session_id,
      stage: checkpoint.stage,
      summary: checkpoint.summary,
      created_at: checkpoint.created_at
    })),
    messages: agentTeamMessages.map(message => ({
      message_id: message.message_id,
      subagent_session_id: message.subagent_session_id,
      direction: message.direction,
      kind: message.kind,
      summary: message.summary,
      created_at: message.created_at
    })),
    resumeRequests: agentTeamResumeRequests.map(request => ({
      request_id: request.request_id,
      subagent_session_id: request.subagent_session_id,
      actor_role: request.actor_role,
      reason: request.reason,
      last_checkpoint_id: request.last_checkpoint_id,
      status: request.status,
      accepted_by: request.accepted_by,
      accepted_at: request.accepted_at,
      resolved_by: request.resolved_by,
      resolved_at: request.resolved_at,
      resolution_note: request.resolution_note,
      result_summary: request.result_summary,
      requested_at: request.requested_at,
      updated_at: request.updated_at
    })),
    resumePackages: agentTeamResumePackages.map(item => ({
      package_id: item.package_id,
      request_id: item.request_id,
      subagent_session_id: item.subagent_session_id,
      handoff_checkpoint_id: item.handoff_checkpoint_id,
      status: item.status,
      package_summary: item.package_summary,
      execution_state_summary: item.execution_state_summary,
      created_by: item.created_by,
      created_at: item.created_at,
      updated_at: item.updated_at,
      applied_at: item.applied_at,
      applied_by: item.applied_by,
      applied_note: item.applied_note,
      applied_checkpoint_id: item.applied_checkpoint_id,
      deep_link: item.deep_link
    })),
    executionRuns: agentTeamExecutionRuns.map(item => ({
      execution_run_id: item.execution_run_id,
      package_id: item.package_id,
      request_id: item.request_id,
      subagent_session_id: item.subagent_session_id,
      status: item.status,
      runtime_kind: item.runtime_kind,
      start_checkpoint_id: item.start_checkpoint_id,
      latest_checkpoint_id: item.latest_checkpoint_id,
      result_summary: item.result_summary,
      started_by: item.started_by,
      started_at: item.started_at,
      updated_at: item.updated_at,
      completed_at: item.completed_at,
      completion_note: item.completion_note,
      deep_link: item.deep_link
    })),
    runtimeBindings: agentTeamRuntimeBindings.map(item => ({
      binding_id: item.binding_id,
      execution_run_id: item.execution_run_id,
      package_id: item.package_id,
      request_id: item.request_id,
      subagent_session_id: item.subagent_session_id,
      status: item.status,
      runtime_kind: item.runtime_kind,
      sandbox_profile: item.sandbox_profile,
      runtime_locator: item.runtime_locator,
      latest_heartbeat_at: item.latest_heartbeat_at,
      bound_by: item.bound_by,
      bound_at: item.bound_at,
      released_at: item.released_at,
      release_reason: item.release_reason,
      deep_link: item.deep_link
    })),
    runtimeInstances: agentTeamRuntimeInstances.map(item => ({
      instance_id: item.instance_id,
      binding_id: item.binding_id,
      execution_run_id: item.execution_run_id,
      package_id: item.package_id,
      request_id: item.request_id,
      subagent_session_id: item.subagent_session_id,
      status: item.status,
      runtime_kind: item.runtime_kind,
      sandbox_profile: item.sandbox_profile,
      runtime_locator: item.runtime_locator,
      launched_by: item.launched_by,
      launched_at: item.launched_at,
      latest_heartbeat_at: item.latest_heartbeat_at,
      latest_heartbeat_note: item.latest_heartbeat_note,
      launcher_kind: item.launcher_kind,
      launcher_driver_id: item.launcher_driver_id,
      isolation_scope: item.isolation_scope,
      quota_profile: item.quota_profile,
      mutation_guarded: item.mutation_guarded,
      launcher_state: item.launcher_state,
      launcher_locator: item.launcher_locator,
      launcher_attached_at: item.launcher_attached_at,
      launcher_summary: item.launcher_summary,
      launcher_worker_run_id: item.launcher_worker_run_id,
      finished_at: item.finished_at,
      finish_reason: item.finish_reason,
      deep_link: item.deep_link
    })),
    runtimeLaunchSpecs: listTaskSubagentRuntimeLaunchSpecs(taskId),
    runtimeLaunchReceipts: agentTeamRuntimeLaunchReceipts,
    launcherBackendAdapters: agentTeamLauncherBackendAdapters,
    launcherBackendAdapterStatuses: agentTeamLauncherBackendAdapterStatuses,
    runnerBackendAdapters: agentTeamRunnerBackendAdapters,
    runnerBackendAdapterStatuses: agentTeamRunnerBackendAdapterStatuses,
    runtimeAdapterRuns: agentTeamRuntimeAdapterRuns,
    runtimeRunnerBackendLeases: agentTeamRuntimeRunnerBackendLeases.map(item =>
      SubagentRuntimeRunnerBackendLeaseSchema.parse(item)
    ),
    runtimeBackendExecutions: agentTeamRuntimeBackendExecutions,
    runtimeDriverRuns: agentTeamRuntimeDriverRuns,
    runtimeRunnerHandles: agentTeamRuntimeRunnerHandles,
    runtimeRunnerExecutions: agentTeamRuntimeRunnerExecutions,
    runtimeRunnerJobs: agentTeamRuntimeRunnerJobs.map(item => SubagentRuntimeRunnerJobSchema.parse(item)),
    launcherCatalog: agentTeamLauncherCatalog,
    launcherStatuses: agentTeamLauncherStatuses,
    launcherDrivers: agentTeamLauncherDrivers,
    launcherDriverStatuses: agentTeamLauncherDriverStatuses,
    timeline: agentTeamTimeline.map(entry => ({
      entry_id: entry.entry_id,
      source_type: entry.source_type,
      source_id: entry.source_id,
      subagent_session_id: entry.subagent_session_id,
      role: entry.role,
      event_kind: entry.event_kind,
      summary: entry.summary,
      created_at: entry.created_at
    }))
  };
  return {
    task,
    runtimeBoundaries,
    agentTeam,
    executionTemplate,
    reuseImprovement,
    artifacts: listTaskArtifacts(taskId),
    checkpoints: listTaskCheckpoints(taskId),
    workerRuns: listTaskWorkerRuns(taskId),
    capabilityResolutions: listTaskCapabilityResults(taskId),
    toolInvocations,
    browserSessions: listTaskBrowserSessions(taskId),
    checklist: store.checklistResults.get(taskId) ?? null,
    reconciliation: store.reconciliationResults.get(taskId) ?? null,
    verification: store.verificationResults.get(taskId) ?? null,
    doneGate: store.doneGateResults.get(taskId) ?? null,
    memoryItems,
    skillCandidates: listTaskSkillCandidates(taskId),
    reuseRecommendations: [
      ...playbookMatches.map(match => ({
        kind: "learned_playbook" as const,
        name: match.candidate.title,
        score: match.score,
        version: match.candidate.version,
        source_task_count: match.candidate.source_task_count,
        fingerprint: match.candidate.fingerprint,
        applicability: match.candidate.applicability,
        failure_boundaries: match.candidate.failure_boundaries
      })),
      ...templateMatches.map(match => ({
        kind: "task_template" as const,
        name: match.template.title,
        score: match.score,
        version: match.template.version,
        source_task_count: match.template.source_task_count,
        fingerprint: match.template.fingerprint,
        applicability: match.template.applicability,
        failure_boundaries: match.template.failure_boundaries
      }))
    ].sort((left, right) => right.score - left.score || right.source_task_count - left.source_task_count),
    operationalSummary: buildOperationalSummary(toolInvocations),
    audits: listTaskAudits(taskId),
    watchdog: evaluateWatchdog(taskId)
  };
}

export function requestLocalSubagentResume(
  taskId: string,
  subagentSessionId: string,
  actorRole: string,
  reason?: string
) {
  return requestSubagentResume(taskId, subagentSessionId, {
    actor_role: actorRole,
    reason
  });
}

export function updateLocalSubagentResumeRequest(
  taskId: string,
  requestId: string,
  actorRole: string,
  action: "accept" | "complete" | "reject",
  note?: string
) {
  return updateSubagentResumeRequest(taskId, requestId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function applyLocalSubagentResumePackage(
  taskId: string,
  packageId: string,
  actorRole: string,
  note?: string
) {
  return applySubagentResumePackage(taskId, packageId, {
    actor_role: actorRole,
    note
  });
}

export function updateLocalSubagentExecutionRun(
  taskId: string,
  executionRunId: string,
  actorRole: string,
  action: "complete" | "fail",
  note?: string
) {
  return updateSubagentExecutionRun(taskId, executionRunId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function bindLocalSubagentExecutionRun(
  taskId: string,
  executionRunId: string,
  actorRole: string,
  options?: {
    runtime_kind?: "host_guarded" | "sandbox_runner" | "cloud_runner";
    sandbox_profile?: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
    runtime_locator?: string;
    launcher_kind?: "worker_run" | "sandbox_runner" | "cloud_runner";
    launcher_driver_id?: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    launcher_locator?: string;
    note?: string;
  }
) {
  return bindSubagentExecutionRunRuntime(taskId, executionRunId, {
    actor_role: actorRole,
    runtime_kind: options?.runtime_kind,
    sandbox_profile: options?.sandbox_profile,
    runtime_locator: options?.runtime_locator,
    launcher_kind: options?.launcher_kind,
    launcher_driver_id: options?.launcher_driver_id,
    launcher_locator: options?.launcher_locator,
    note: options?.note
  });
}

export function releaseLocalSubagentRuntimeBinding(
  taskId: string,
  bindingId: string,
  actorRole: string,
  note?: string
) {
  return releaseSubagentRuntimeBinding(taskId, bindingId, {
    actor_role: actorRole,
    note
  });
}

export function heartbeatLocalSubagentRuntimeInstance(
  taskId: string,
  instanceId: string,
  actorRole: string,
  note?: string
) {
  return heartbeatSubagentRuntimeInstance(taskId, instanceId, {
    actor_role: actorRole,
    note
  });
}

export function launchLocalSubagentRuntimeInstance(
  taskId: string,
  instanceId: string,
  actorRole: string,
  options?: {
    note?: string;
    launch_locator?: string;
    runtime_locator?: string;
  }
) {
  return launchSubagentRuntimeInstance(taskId, instanceId, {
    actor_role: actorRole,
    note: options?.note,
    launch_locator: options?.launch_locator,
    runtime_locator: options?.runtime_locator
  });
}

export function consumeLocalSubagentRuntimeLaunchReceipt(
  taskId: string,
  receiptId: string,
  actorRole: string,
  note?: string
) {
  return consumeSubagentRuntimeLaunchReceipt(taskId, receiptId, {
    actor_role: actorRole,
    note
  });
}

export function startLocalSubagentRuntimeAdapterRun(
  taskId: string,
  receiptId: string,
  actorRole: string,
  note?: string
) {
  return startSubagentRuntimeAdapterRun(taskId, receiptId, {
    actor_role: actorRole,
    note
  });
}

export function acquireLocalSubagentRuntimeRunnerBackendLease(
  taskId: string,
  adapterRunId: string,
  actorRole: string,
  options?: {
    note?: string;
    resource_locator?: string;
    execution_locator?: string;
  }
) {
  return acquireSubagentRuntimeRunnerBackendLease(taskId, adapterRunId, {
    actor_role: actorRole,
    note: options?.note,
    resource_locator: options?.resource_locator,
    execution_locator: options?.execution_locator
  });
}

export function releaseLocalSubagentRuntimeRunnerBackendLease(
  taskId: string,
  leaseId: string,
  actorRole: string,
  options?: {
    action?: "release" | "fail";
    note?: string;
  }
) {
  return releaseSubagentRuntimeRunnerBackendLease(taskId, leaseId, {
    actor_role: actorRole,
    action: options?.action,
    note: options?.note
  });
}

export function startLocalSubagentRuntimeBackendExecution(
  taskId: string,
  adapterRunId: string,
  actorRole: string,
  note?: string
) {
  return startSubagentRuntimeBackendExecution(taskId, adapterRunId, {
    actor_role: actorRole,
    note
  });
}

export function heartbeatLocalSubagentRuntimeAdapterRun(
  taskId: string,
  adapterRunId: string,
  actorRole: string,
  note?: string
) {
  return heartbeatSubagentRuntimeAdapterRun(taskId, adapterRunId, {
    actor_role: actorRole,
    note
  });
}

export function heartbeatLocalSubagentRuntimeBackendExecution(
  taskId: string,
  backendExecutionId: string,
  actorRole: string,
  note?: string
) {
  return heartbeatSubagentRuntimeBackendExecution(taskId, backendExecutionId, {
    actor_role: actorRole,
    note
  });
}

export function finalizeLocalSubagentRuntimeAdapterRun(
  taskId: string,
  adapterRunId: string,
  actorRole: string,
  action: "complete" | "fail",
  note?: string
) {
  return finalizeSubagentRuntimeAdapterRun(taskId, adapterRunId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function finalizeLocalSubagentRuntimeBackendExecution(
  taskId: string,
  backendExecutionId: string,
  actorRole: string,
  action: "complete" | "fail",
  note?: string
) {
  return finalizeSubagentRuntimeBackendExecution(taskId, backendExecutionId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function startLocalSubagentRuntimeDriverRun(
  taskId: string,
  backendExecutionId: string,
  actorRole: string,
  note?: string
) {
  return startSubagentRuntimeDriverRun(taskId, backendExecutionId, {
    actor_role: actorRole,
    note
  });
}

export function heartbeatLocalSubagentRuntimeDriverRun(
  taskId: string,
  driverRunId: string,
  actorRole: string,
  note?: string
) {
  return heartbeatSubagentRuntimeDriverRun(taskId, driverRunId, {
    actor_role: actorRole,
    note
  });
}

export function finalizeLocalSubagentRuntimeDriverRun(
  taskId: string,
  driverRunId: string,
  actorRole: string,
  action: "complete" | "fail",
  note?: string
) {
  return finalizeSubagentRuntimeDriverRun(taskId, driverRunId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function attachLocalSubagentRuntimeRunnerHandle(
  taskId: string,
  driverRunId: string,
  actorRole: string,
  options?: {
    runner_kind?: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
    runner_locator?: string;
    note?: string;
  }
) {
  return attachSubagentRuntimeRunnerHandle(taskId, driverRunId, {
    actor_role: actorRole,
    runner_kind: options?.runner_kind,
    runner_locator: options?.runner_locator,
    note: options?.note
  });
}

export function heartbeatLocalSubagentRuntimeRunnerHandle(
  taskId: string,
  runnerHandleId: string,
  actorRole: string,
  note?: string
) {
  return heartbeatSubagentRuntimeRunnerHandle(taskId, runnerHandleId, {
    actor_role: actorRole,
    note
  });
}

export function finalizeLocalSubagentRuntimeRunnerHandle(
  taskId: string,
  runnerHandleId: string,
  actorRole: string,
  action: "release" | "fail",
  note?: string
) {
  return finalizeSubagentRuntimeRunnerHandle(taskId, runnerHandleId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function startLocalSubagentRuntimeRunnerExecution(
  taskId: string,
  runnerHandleId: string,
  actorRole: string,
  options?: {
    execution_locator?: string;
    note?: string;
  }
) {
  return startSubagentRuntimeRunnerExecution(taskId, runnerHandleId, {
    actor_role: actorRole,
    execution_locator: options?.execution_locator,
    note: options?.note
  });
}

export function heartbeatLocalSubagentRuntimeRunnerExecution(
  taskId: string,
  runnerExecutionId: string,
  actorRole: string,
  note?: string
) {
  return heartbeatSubagentRuntimeRunnerExecution(taskId, runnerExecutionId, {
    actor_role: actorRole,
    note
  });
}

export function finalizeLocalSubagentRuntimeRunnerExecution(
  taskId: string,
  runnerExecutionId: string,
  actorRole: string,
  action: "complete" | "fail",
  note?: string
) {
  return finalizeSubagentRuntimeRunnerExecution(taskId, runnerExecutionId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function startLocalSubagentRuntimeRunnerJob(
  taskId: string,
  runnerExecutionId: string,
  actorRole: string,
  options?: {
    job_locator?: string;
    note?: string;
  }
) {
  return startSubagentRuntimeRunnerJob(taskId, runnerExecutionId, {
    actor_role: actorRole,
    job_locator: options?.job_locator,
    note: options?.note
  });
}

export function heartbeatLocalSubagentRuntimeRunnerJob(
  taskId: string,
  runnerJobId: string,
  actorRole: string,
  note?: string
) {
  return heartbeatSubagentRuntimeRunnerJob(taskId, runnerJobId, {
    actor_role: actorRole,
    note
  });
}

export function finalizeLocalSubagentRuntimeRunnerJob(
  taskId: string,
  runnerJobId: string,
  actorRole: string,
  action: "complete" | "fail",
  note?: string
) {
  return finalizeSubagentRuntimeRunnerJob(taskId, runnerJobId, {
    actor_role: actorRole,
    action,
    note
  });
}

export function getLocalSubagentRuntimeLaunchSpec(taskId: string, instanceId: string) {
  return listTaskSubagentRuntimeLaunchSpecs(taskId).find(item => item.instance_id === instanceId) ?? null;
}

export function listLocalFiles(
  taskId: string,
  requestedPath?: string
): LocalToolExecutionResult<{ path: string; entries: LocalDirectoryEntry[] }> {
  const task = requireTask(taskId);
  const permission = evaluateLocalPermission(taskId, "local_files.read", requestedPath);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }

  const path = ensurePathWithinRoots(task, requestedPath);
  const entries = readdirSync(path, { withFileTypes: true }).map(entry => {
    const entryPath = resolve(path, entry.name);
    const stats = statSync(entryPath);
    return {
      name: entry.name,
      path: entryPath,
      kind: entry.isDirectory() ? "directory" : "file",
      size: stats.size
    } satisfies LocalDirectoryEntry;
  });

  const result = { path, entries };
  sendHeartbeat(taskId, "local_fs_list");
  recordToolInvocation(taskId, "local_fs_list", { path }, { count: entries.length }, "succeeded");
  recordAudit("tool.local_fs_list", { path, count: entries.length }, taskId);
  return { status: "completed", permission, result };
}

export function readLocalFile(
  taskId: string,
  requestedPath: string
): LocalToolExecutionResult<{ path: string; content: string }> {
  const task = requireTask(taskId);
  const permission = evaluateLocalPermission(taskId, "local_files.read", requestedPath);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }

  const path = ensurePathWithinRoots(task, requestedPath);
  const stats = statSync(path);
  if (!stats.isFile()) {
    throw new Error(`Path '${path}' is not a file.`);
  }

  const content = readFileSync(path, "utf8");
  sendHeartbeat(taskId, "local_fs_read");
  recordToolInvocation(taskId, "local_fs_read", { path }, { bytes: Buffer.byteLength(content, "utf8") }, "succeeded");
  addArtifact(taskId, `fs_read_${basename(path)}.txt`, "generic", content.slice(0, 8000), "ready");
  recordAudit("tool.local_fs_read", { path, bytes: Buffer.byteLength(content, "utf8") }, taskId);
  return {
    status: "completed",
    permission,
    result: { path, content }
  };
}

export function writeLocalFile(input: {
  taskId: string;
  path: string;
  content: string;
  confirm?: boolean;
}): LocalToolExecutionResult<LocalFileWriteResult> {
  const task = requireTask(input.taskId);
  const permission = evaluateLocalPermission(input.taskId, "local_files.write", input.path);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }
  if (permission.behavior === "ask" && !input.confirm) {
    return { status: "approval_required", permission };
  }

  const path = ensurePathWithinRoots(task, resolveWritePath(task, input.path));
  const idempotencyKey = buildToolIdempotencyKey("local_fs_write", { path, content: input.content });
  const priorInvocation = findSuccessfulInvocationByIdempotency(input.taskId, "local_fs_write", idempotencyKey);
  if (priorInvocation) {
    recordAudit(
      "tool.local_fs_write_reused_by_idempotency",
      { path, invocation_id: priorInvocation.invocation_id, idempotency_key: idempotencyKey },
      input.taskId
    );
    return {
      status: "completed",
      permission: { ...permission, behavior: "allow", reason: "Idempotent local file write reused a prior successful result." },
      result: priorInvocation.output as unknown as LocalFileWriteResult
    };
  }
  const previousExists = existsSync(path);
  const previousContent = previousExists ? readFileSync(path, "utf8") : null;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, input.content, "utf8");

  let backupArtifactName: string | undefined;
  if (previousContent !== null) {
    backupArtifactName = `fs_write_backup_${basename(path)}.txt`;
    addArtifact(input.taskId, backupArtifactName, "generic", previousContent.slice(0, 12000), "ready");
  }

  const result: LocalFileWriteResult = {
    path,
    previous_exists: previousExists,
    bytes_written: Buffer.byteLength(input.content, "utf8"),
    backup_artifact_name: backupArtifactName
  };

  sendHeartbeat(input.taskId, "local_fs_write");
  recordToolInvocation(
    input.taskId,
    "local_fs_write",
    { path, bytes_requested: Buffer.byteLength(input.content, "utf8") },
    result,
    "succeeded",
    {
      idempotency_key: idempotencyKey,
      compensation_available: previousContent !== null,
      compensation_status: previousContent !== null ? "available" : "not_required"
    }
  );
  addArtifact(
    input.taskId,
    `fs_write_result_${basename(path)}.txt`,
    "generic",
    input.content.slice(0, 12000),
    "ready"
  );
  recordAudit(
    "tool.local_fs_write",
    {
      path,
      previous_exists: previousExists,
      bytes_written: result.bytes_written
    },
    input.taskId
  );

  return {
    status: "completed",
    permission: { ...permission, behavior: "allow", reason: "Interactive confirmation granted for local file write." },
    result
  };
}

export function patchLocalFileExact(input: {
  taskId: string;
  path: string;
  expectedContent: string;
  nextContent: string;
  confirm?: boolean;
}): LocalToolExecutionResult<LocalFilePatchResult> {
  const task = requireTask(input.taskId);
  const permission = evaluateLocalPermission(input.taskId, "local_files.write", input.path);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }
  if (permission.behavior === "ask" && !input.confirm) {
    return { status: "approval_required", permission };
  }

  const path = ensurePathWithinRoots(task, input.path);
  const idempotencyKey = buildToolIdempotencyKey("local_fs_patch", {
    path,
    expectedContent: input.expectedContent,
    nextContent: input.nextContent
  });
  const priorInvocation = findSuccessfulInvocationByIdempotency(input.taskId, "local_fs_patch", idempotencyKey);
  if (priorInvocation) {
    recordAudit(
      "tool.local_fs_patch_reused_by_idempotency",
      { path, invocation_id: priorInvocation.invocation_id, idempotency_key: idempotencyKey },
      input.taskId
    );
    return {
      status: "completed",
      permission: { ...permission, behavior: "allow", reason: "Idempotent local patch reused a prior successful result." },
      result: priorInvocation.output as unknown as LocalFilePatchResult
    };
  }
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Path '${path}' must exist and be a file before exact-match patching.`);
  }

  const currentContent = readFileSync(path, "utf8");
  if (currentContent !== input.expectedContent) {
    throw new Error("Exact-match patch rejected because the current file content no longer matches the expected baseline.");
  }

  writeFileSync(path, input.nextContent, "utf8");
  const backupArtifactName = `fs_patch_backup_${basename(path)}.txt`;
  addArtifact(input.taskId, backupArtifactName, "generic", currentContent.slice(0, 12000), "ready");

  const result: LocalFilePatchResult = {
    path,
    bytes_written: Buffer.byteLength(input.nextContent, "utf8"),
    patch_strategy: "replace_exact",
    backup_artifact_name: backupArtifactName
  };

  sendHeartbeat(input.taskId, "local_fs_patch");
  recordToolInvocation(
    input.taskId,
    "local_fs_patch",
    {
      path,
      expected_bytes: Buffer.byteLength(input.expectedContent, "utf8"),
      next_bytes: Buffer.byteLength(input.nextContent, "utf8")
    },
    result,
    "succeeded",
    {
      idempotency_key: idempotencyKey,
      compensation_available: true,
      compensation_status: "available"
    }
  );
  addArtifact(
    input.taskId,
    `fs_patch_result_${basename(path)}.txt`,
    "generic",
    input.nextContent.slice(0, 12000),
    "ready"
  );
  recordAudit(
    "tool.local_fs_patch",
    {
      path,
      patch_strategy: result.patch_strategy,
      bytes_written: result.bytes_written
    },
    input.taskId
  );

  return {
    status: "completed",
    permission: { ...permission, behavior: "allow", reason: "Interactive confirmation granted for exact-match file patch." },
    result
  };
}

export function rollbackLocalFileOperation(input: {
  taskId: string;
  path?: string;
  invocationId?: string;
  confirm?: boolean;
}): LocalToolExecutionResult<LocalRollbackResult> {
  const task = requireTask(input.taskId);
  const permission = evaluateLocalPermission(input.taskId, "local_files.write", input.path ?? input.invocationId);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }
  if (permission.behavior === "ask" && !input.confirm) {
    return { status: "approval_required", permission };
  }

  const compensableInvocation = [...store.toolInvocations.values()]
    .filter(invocation =>
      invocation.task_id === input.taskId &&
      ["local_fs_write", "local_fs_patch"].includes(invocation.tool_name) &&
      invocation.compensation_available &&
      invocation.compensation_status === "available"
    )
    .filter(invocation => {
      if (input.invocationId) return invocation.invocation_id === input.invocationId;
      if (input.path) return invocation.output.path === ensurePathWithinRoots(task, input.path);
      return true;
    })
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];

  if (!compensableInvocation) {
    throw new Error("No compensable local file operation was found for rollback.");
  }

  const path = typeof compensableInvocation.output.path === "string"
    ? ensurePathWithinRoots(task, compensableInvocation.output.path)
    : undefined;
  const backupArtifactName = typeof compensableInvocation.output.backup_artifact_name === "string"
    ? compensableInvocation.output.backup_artifact_name
    : undefined;

  if (!path || !backupArtifactName) {
    throw new Error("Rollback failed because the original invocation did not retain a backup artifact.");
  }

  const backupArtifact = [...store.artifacts.values()]
    .filter(artifact => artifact.task_id === input.taskId && artifact.name === backupArtifactName)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];

  if (!backupArtifact?.content) {
    throw new Error(`Rollback failed because backup artifact '${backupArtifactName}' is not available.`);
  }

  writeFileSync(path, backupArtifact.content, "utf8");
  compensableInvocation.compensation_status = "applied";
  store.toolInvocations.set(compensableInvocation.invocation_id, compensableInvocation);

  const result: LocalRollbackResult = {
    invocation_id: compensableInvocation.invocation_id,
    path,
    restored: true,
    backup_artifact_name: backupArtifactName,
    compensation_status: "applied"
  };

  sendHeartbeat(input.taskId, "local_fs_rollback");
  recordToolInvocation(
    input.taskId,
    "local_fs_rollback",
    {
      target_invocation_id: compensableInvocation.invocation_id,
      path
    },
    result,
    "succeeded",
    {
      idempotency_key: buildToolIdempotencyKey("local_fs_rollback", {
        target_invocation_id: compensableInvocation.invocation_id,
        path
      })
    }
  );
  addArtifact(
    input.taskId,
    `fs_rollback_result_${basename(path)}.txt`,
    "generic",
    backupArtifact.content.slice(0, 12000),
    "ready"
  );
  recordAudit(
    "tool.local_fs_rollback",
    {
      path,
      target_invocation_id: compensableInvocation.invocation_id,
      backup_artifact_name: backupArtifactName
    },
    input.taskId
  );

  return {
    status: "completed",
    permission: { ...permission, behavior: "allow", reason: "Interactive confirmation granted for local rollback." },
    result
  };
}

export function runLocalShellCommand(input: {
  taskId: string;
  command: string;
  cwd?: string;
  confirm?: boolean;
}): LocalToolExecutionResult<LocalShellCommandResult> {
  const task = requireTask(input.taskId);
  const normalizedCommand = sanitizeShellCommand(input.command);
  if (!normalizedCommand) {
    throw new Error("Shell command must not be empty.");
  }
  if (!isReadOnlyShellCommand(normalizedCommand)) {
    throw new Error("Only read-only diagnostic shell commands are allowed by the local tool adapter.");
  }

  const permission = evaluateLocalPermission(input.taskId, "local_shell.execute", normalizedCommand);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }
  if (permission.behavior === "ask" && !input.confirm) {
    return { status: "approval_required", permission };
  }

  const circuitKey = "local_shell_run";
  const circuitState = getCircuitStatus(circuitKey, RESILIENCE_CONFIG.shell);
  if (circuitState === "open") {
    recordAudit(
      "tool.local_shell_run_blocked_by_circuit_breaker",
      { command: normalizedCommand, state: circuitState },
      input.taskId
    );
    throw new Error("Shell execution is temporarily blocked because recent command failures opened the circuit breaker.");
  }

  const cwd = ensurePathWithinRoots(task, input.cwd ?? process.cwd());
  const shell = shellCommandForCurrentOs(normalizedCommand);
  const execution = spawnSync(shell.executable, shell.args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true
  });

  const stdout = execution.stdout ?? "";
  const stderr = execution.stderr ?? "";
  const exitCode = execution.status ?? 1;
  const status = exitCode === 0 ? "succeeded" : "failed";
  const retryReasons: string[] = [];
  if (execution.error) {
    retryReasons.push(execution.error.message);
  }
  if (execution.signal) {
    retryReasons.push(`signal:${execution.signal}`);
  }
  if (status === "succeeded") {
    recordCircuitSuccess(circuitKey);
  } else {
    const nextState = recordCircuitFailure(circuitKey, RESILIENCE_CONFIG.shell);
    recordAudit(
      "tool.local_shell_run_failure_recorded",
      {
        command: normalizedCommand,
        exit_code: exitCode,
        signal: execution.signal ?? null,
        error: execution.error?.message ?? null,
        circuit_state: nextState
      },
      input.taskId
    );
  }
  const resilience: LocalExecutionResilience = {
    attempts: 1,
    circuit_state: getCircuitStatus(circuitKey, RESILIENCE_CONFIG.shell),
    degraded: false,
    retry_reasons: retryReasons
  };

  sendHeartbeat(input.taskId, "local_shell_run");
  recordToolInvocation(
    input.taskId,
    "local_shell_run",
    { command: normalizedCommand, cwd },
    {
      exit_code: exitCode,
      stdout_preview: stdout.slice(0, 1000),
      stderr_preview: stderr.slice(0, 1000),
      resilience
    },
    status
  );
  addArtifact(
    input.taskId,
    `shell_${createShellArtifactName(normalizedCommand)}.log`,
    "generic",
    [`cwd: ${cwd}`, `command: ${normalizedCommand}`, "", stdout, stderr ? `stderr:\n${stderr}` : ""].filter(Boolean).join("\n"),
    status === "succeeded" ? "ready" : "partial"
  );
  recordAudit("tool.local_shell_run", { command: normalizedCommand, cwd, exit_code: exitCode, resilience }, input.taskId);
  return {
    status: "completed",
    permission: { ...permission, behavior: "allow", reason: "Interactive confirmation granted for read-only shell execution." },
    result: {
      command: normalizedCommand,
      cwd,
      stdout,
      stderr,
      exit_code: exitCode,
      resilience
    }
  };
}

export async function captureLocalBrowserSnapshot(input: {
  taskId: string;
  url: string;
  confirm?: boolean;
  sessionId?: string;
}): Promise<LocalToolExecutionResult<LocalBrowserSnapshot>> {
  const permission = evaluateLocalPermission(input.taskId, "local_browser.automate", input.url);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }
  if (permission.behavior === "ask" && !input.confirm) {
    return { status: "approval_required", permission };
  }

  const url = ensureSupportedBrowserUrl(input.url);
  const circuitKey = "local_browser_snapshot";
  const retryReasons: string[] = [];
  const circuitState = getCircuitStatus(circuitKey, RESILIENCE_CONFIG.browser);
  let snapshot: LocalBrowserSnapshot | undefined;
  let attempts = 0;
  let degraded = false;
  let degradedReason: string | undefined;

  if (circuitState === "open") {
    degraded = true;
    degradedReason = "playwright_circuit_open";
    snapshot = await withTimeout(
      captureWithFetch(url),
      RESILIENCE_CONFIG.browser.timeoutMs,
      "Fetch snapshot timed out while Playwright circuit was open."
    );
  } else {
    let playwrightFailure: unknown;
    for (let attempt = 1; attempt <= RESILIENCE_CONFIG.browser.maxAttempts; attempt += 1) {
      attempts = attempt;
      try {
        const candidate = await withTimeout(
          tryCaptureWithPlaywright(url),
          RESILIENCE_CONFIG.browser.timeoutMs,
          "Playwright browser snapshot timed out."
        );
        if (candidate) {
          snapshot = candidate;
          recordCircuitSuccess(circuitKey);
          break;
        }
        const reason = "playwright_unavailable";
        retryReasons.push(reason);
        playwrightFailure = new Error(reason);
      } catch (error) {
        playwrightFailure = error;
        retryReasons.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (!snapshot) {
      degraded = true;
      degradedReason = playwrightFailure instanceof Error ? playwrightFailure.message : "playwright_failed";
      recordCircuitFailure(circuitKey, RESILIENCE_CONFIG.browser);
      recordAudit(
        "tool.local_browser_snapshot_degraded",
        {
          url: url.toString(),
          reason: degradedReason,
          attempts
        },
        input.taskId
      );
      snapshot = await withTimeout(
        captureWithFetch(url),
        RESILIENCE_CONFIG.browser.timeoutMs,
        "Fetch snapshot timed out after Playwright fallback."
      );
    }
  }

  const resilience: LocalExecutionResilience = {
    attempts: Math.max(attempts, 1),
    circuit_state: getCircuitStatus(circuitKey, RESILIENCE_CONFIG.browser),
    degraded,
    degraded_reason: degradedReason,
    retry_reasons: retryReasons
  };
  if (!snapshot) {
    throw new Error("Browser snapshot failed before a fallback snapshot could be produced.");
  }
  snapshot = { ...snapshot, resilience };
  const browserSession = recordBrowserSession({
    taskId: input.taskId,
    sessionId: input.sessionId,
    url: snapshot.url,
    engine: snapshot.engine,
    title: snapshot.title,
    status: snapshot.status_code !== null && snapshot.status_code >= 400 ? "failed" : "completed",
    statusCode: snapshot.status_code,
    contentType: snapshot.content_type,
    textExcerpt: snapshot.text_excerpt,
    domSummary: snapshot.dom_summary
  });

  sendHeartbeat(input.taskId, "local_browser_snapshot");
  recordToolInvocation(
    input.taskId,
    "local_browser_snapshot",
    { url: snapshot.url, session_id: browserSession.session_id },
    {
      session_id: browserSession.session_id,
      engine: snapshot.engine,
      status_code: snapshot.status_code,
      content_type: snapshot.content_type,
      title: snapshot.title,
      text_excerpt: snapshot.text_excerpt,
      dom_summary: snapshot.dom_summary,
      resilience
    },
    snapshot.status_code !== null && snapshot.status_code >= 400 ? "failed" : "succeeded"
  );
  addArtifact(
    input.taskId,
    `browser_snapshot_${createShellArtifactName(url.hostname || "data_url")}.json`,
    "generic",
    JSON.stringify(snapshot, null, 2),
    snapshot.status_code !== null && snapshot.status_code >= 400 ? "partial" : "ready"
  );
  recordAudit(
    "tool.local_browser_snapshot",
    {
      url: snapshot.url,
      session_id: browserSession.session_id,
      engine: snapshot.engine,
      status_code: snapshot.status_code,
      title: snapshot.title,
      resilience
    },
    input.taskId
  );
  return {
    status: "completed",
    permission:
      permission.behavior === "allow"
        ? permission
        : { ...permission, behavior: "allow", reason: "Interactive confirmation granted for browser snapshot access." },
    result: snapshot
  };
}

export async function navigateLocalBrowserSession(input: {
  taskId: string;
  sessionId: string;
  url: string;
  confirm?: boolean;
}): Promise<LocalToolExecutionResult<{ session_id: string; snapshot: LocalBrowserSnapshot }>> {
  const existing = store.browserSessions.get(input.sessionId);
  if (!existing || existing.task_id !== input.taskId) {
    throw new Error(`Browser session '${input.sessionId}' was not found for task ${input.taskId}.`);
  }

  const result = await captureLocalBrowserSnapshot({
    taskId: input.taskId,
    url: input.url,
    confirm: input.confirm,
    sessionId: input.sessionId
  });

  return {
    status: result.status,
    permission: result.permission,
    result: result.result
      ? {
          session_id: input.sessionId,
          snapshot: result.result
        }
      : undefined
  };
}

export function summarizeLocalIdeWorkspace(input: {
  taskId: string;
  rootPath?: string;
  confirm?: boolean;
}): LocalToolExecutionResult<LocalIdeWorkspaceSummary> {
  const task = requireTask(input.taskId);
  const permission = evaluateLocalPermission(input.taskId, "local_ide.control", input.rootPath);
  if (permission.behavior === "deny") {
    throw new Error(permission.reason);
  }
  if (permission.behavior === "ask" && !input.confirm) {
    return { status: "approval_required", permission };
  }

  const rootPath = ensurePathWithinRoots(task, input.rootPath);
  const packageJsonPath = resolve(rootPath, "package.json");
  const tsconfigCandidates = ["tsconfig.json", "tsconfig.base.json", "tsconfig.app.json"]
    .map(name => resolve(rootPath, name))
    .filter(path => existsSync(path));
  const packageJson = parseJsonFile<Record<string, unknown>>(packageJsonPath);
  const topLevelEntries = readdirSync(rootPath, { withFileTypes: true })
    .slice(0, 40)
    .map(entry => ({
      name: entry.name,
      kind: (entry.isDirectory() ? "directory" : "file") as "directory" | "file"
    }));
  const entryNames = topLevelEntries.map(entry => entry.name);
  const { packageManager, workspaceKind } = summarizeWorkspaceKind(entryNames);
  const summary: LocalIdeWorkspaceSummary = {
    root_path: rootPath,
    project_name: typeof packageJson?.name === "string" ? packageJson.name : null,
    detected: {
      package_json: entryNames.includes("package.json"),
      tsconfig: entryNames.some(name => name === "tsconfig.json" || name.startsWith("tsconfig.")),
      git_repo: entryNames.includes(".git"),
      readme: entryNames.some(name => /^readme(\.|$)/i.test(name))
    },
    package_json: packageJson
      ? {
          scripts: Object.keys((packageJson.scripts as Record<string, unknown> | undefined) ?? {}).sort(),
          dependency_count: Object.keys((packageJson.dependencies as Record<string, unknown> | undefined) ?? {}).length,
          dev_dependency_count: Object.keys((packageJson.devDependencies as Record<string, unknown> | undefined) ?? {}).length
        }
      : null,
    tsconfig: tsconfigCandidates.length > 0
      ? {
          files: tsconfigCandidates.map(path => basename(path))
        }
      : null,
    top_level_entries: topLevelEntries,
    package_manager: packageManager,
    workspace_kind: workspaceKind
  };

  sendHeartbeat(input.taskId, "local_ide_workspace_summary");
  recordToolInvocation(
    input.taskId,
    "local_ide_workspace_summary",
    { root_path: rootPath },
    {
      workspace_kind: summary.workspace_kind,
      package_manager: summary.package_manager,
      project_name: summary.project_name,
      detected: summary.detected,
      top_level_entry_count: summary.top_level_entries.length
    },
    "succeeded"
  );
  addArtifact(
    input.taskId,
    `ide_workspace_summary_${basename(rootPath)}.json`,
    "generic",
    JSON.stringify(summary, null, 2),
    "ready"
  );
  recordAudit(
    "tool.local_ide_workspace_summary",
    {
      root_path: rootPath,
      workspace_kind: summary.workspace_kind,
      package_manager: summary.package_manager
    },
    input.taskId
  );
  return {
    status: "completed",
    permission: { ...permission, behavior: "allow", reason: "Interactive confirmation granted for IDE workspace summary access." },
    result: summary
  };
}

function createShellArtifactName(command: string): string {
  return command.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "command";
}

function ensureSupportedBrowserUrl(input: string): URL {
  const url = new URL(input);
  if (!["http:", "https:", "data:"].includes(url.protocol)) {
    throw new Error("Only http, https, and data URLs are supported by the browser snapshot adapter.");
  }
  return url;
}

function stripHtmlToText(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHtmlTitle(content: string): string | null {
  const match = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractDomSummaryFromHtml(content: string) {
  const headings = [...content.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map(match => stripHtmlToText(match[1] ?? ""))
    .filter(Boolean);
  const links = [...content.matchAll(/<a\b[^>]*href=["']?([^"' >]+)[^>]*>/gi)]
    .map(match => (match[1] ?? "").trim())
    .filter(Boolean);
  const formCount = [...content.matchAll(/<form\b/gi)].length;
  const interactiveCount = [...content.matchAll(/<(a|button|input|select|textarea)\b/gi)].length;

  return {
    heading_count: headings.length,
    link_count: links.length,
    form_count: formCount,
    interactive_count: interactiveCount,
    sample_links: links.slice(0, 5),
    sample_headings: headings.slice(0, 5)
  };
}

function summarizeWorkspaceKind(entries: string[]): {
  packageManager: LocalIdeWorkspaceSummary["package_manager"];
  workspaceKind: LocalIdeWorkspaceSummary["workspace_kind"];
} {
  if (entries.includes("package.json")) {
    if (entries.includes("pnpm-lock.yaml")) {
      return { packageManager: "pnpm", workspaceKind: "node" };
    }
    if (entries.includes("yarn.lock")) {
      return { packageManager: "yarn", workspaceKind: "node" };
    }
    return { packageManager: "npm", workspaceKind: "node" };
  }

  return { packageManager: "unknown", workspaceKind: "generic" };
}

function parseJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function tryCaptureWithPlaywright(url: URL): Promise<LocalBrowserSnapshot | null> {
  if (!["http:", "https:"].includes(url.protocol)) {
    return null;
  }

  try {
    const moduleName = "playwright";
    const playwright = await import(moduleName);
    const browser = await launchPlaywrightBrowser(playwright);
    try {
      const page = await browser.newPage();
      const response = await page.goto(url.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 15_000
      });
      const title = await page.title();
      const textExcerpt = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim().slice(0, 1200);
      const headingTexts = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((elements: Array<{ textContent?: string | null }>) =>
        elements
          .map((element: { textContent?: string | null }) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
          .filter(Boolean)
          .slice(0, 5)
      ).catch(() => [] as string[]);
      const linkHrefs = await page.locator("a[href]").evaluateAll((elements: Array<{ getAttribute: (name: string) => string | null }>) =>
        elements
          .map((element: { getAttribute: (name: string) => string | null }) => element.getAttribute("href") ?? "")
          .filter(Boolean)
          .slice(0, 5)
      ).catch(() => [] as string[]);
      const formCount = await page.locator("form").count().catch(() => 0);
      const interactiveCount = await page.locator("a, button, input, select, textarea").count().catch(() => 0);
      return {
        url: page.url(),
        engine: "playwright_worker",
        title: title || null,
        status_code: response?.status() ?? null,
        content_type: response?.headers()["content-type"] ?? null,
        text_excerpt: textExcerpt,
        dom_summary: {
          heading_count: headingTexts.length,
          link_count: linkHrefs.length,
          form_count: formCount,
          interactive_count: interactiveCount,
          sample_links: linkHrefs,
          sample_headings: headingTexts
        }
      };
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

async function launchPlaywrightBrowser(playwright: {
  chromium: {
    launch: (options: Record<string, unknown>) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, options: Record<string, unknown>) => Promise<{ status: () => number; headers: () => Record<string, string> } | null>;
        title: () => Promise<string>;
        locator: (selector: string) => {
          innerText: () => Promise<string>;
          evaluateAll: <T>(fn: (...args: never[]) => T) => Promise<T>;
          count: () => Promise<number>;
        };
        url: () => string;
      }>;
      close: () => Promise<void>;
    }>;
  };
}) {
  const launchAttempts: Array<Record<string, unknown>> = [{ headless: true }];
  if (process.platform === "win32") {
    launchAttempts.push({ headless: true, channel: "msedge" });
  }

  let lastError: unknown;
  for (const options of launchAttempts) {
    try {
      return await playwright.chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to launch a Playwright browser.");
}

async function captureWithFetch(url: URL): Promise<LocalBrowserSnapshot> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "apex-local-browser/0.1"
    },
    signal: AbortSignal.timeout(RESILIENCE_CONFIG.browser.timeoutMs)
  });
  const rawContent = await response.text();
  const contentType = response.headers.get("content-type");
  const title = contentType?.includes("html") || url.protocol === "data:" ? extractHtmlTitle(rawContent) : null;
  const domSummary =
    contentType?.includes("html") || url.protocol === "data:"
      ? extractDomSummaryFromHtml(rawContent)
      : null;
  return {
    url: url.toString(),
    engine: "fetch_snapshot",
    title,
    status_code: Number.isFinite(response.status) ? response.status : null,
    content_type: contentType,
    text_excerpt: stripHtmlToText(rawContent).slice(0, 1200),
    dom_summary: domSummary
  };
}

function listTaskBrowserSessions(taskId: string) {
  return [...store.browserSessions.values()]
    .filter(session => session.task_id === taskId)
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
}

function recordBrowserSession(input: {
  taskId: string;
  sessionId?: string;
  url: string;
  engine: "playwright_worker" | "fetch_snapshot";
  title: string | null;
  status: "active" | "completed" | "failed";
  statusCode: number | null;
  contentType: string | null;
  textExcerpt: string;
  domSummary: LocalBrowserSnapshot["dom_summary"];
}) {
  const existing = input.sessionId ? store.browserSessions.get(input.sessionId) : undefined;
  const visitedAt = nowIso();
  const session = BrowserSessionSchema.parse({
    session_id: existing?.session_id ?? createEntityId("browsersession"),
    task_id: input.taskId,
    entry_url: existing?.entry_url ?? input.url,
    current_url: input.url,
    engine: input.engine,
    title: input.title,
    status: input.status,
    status_code: input.statusCode,
    content_type: input.contentType,
    text_excerpt: input.textExcerpt,
    dom_summary: input.domSummary,
    history: [
      ...(existing?.history ?? []),
      {
        url: input.url,
        engine: input.engine,
        title: input.title,
        status_code: input.statusCode,
        visited_at: visitedAt
      }
    ],
    created_at: existing?.created_at ?? visitedAt,
    updated_at: visitedAt
  });
  store.browserSessions.set(session.session_id, session);
  return session;
}

export function createLocalTask(input: {
  intent: string;
  taskType?: TaskType;
  department?: Department;
  riskLevel?: RiskLevel;
  channel?: string;
  inputs?: Record<string, unknown>;
  definitionOfDone?: {
    goal?: string;
    completion_criteria?: string[];
    acceptance_tests?: string[];
    required_artifacts?: string[];
    approval_requirements?: string[];
    deadline_or_sla?: string;
  };
}) {
  let enrichedInputs = input.inputs ?? {};
  try {
    const settings = loadLocalAppSettings();
    const taskDirs = resolveTaskDirectoryPaths(settings, "__pending__");
    enrichedInputs = {
      workspace_paths: [
        settings.workspace_root,
        settings.default_write_root,
        settings.default_export_dir,
        taskDirs.task_workdir.replace("__pending__", ""),
        taskDirs.task_run_dir.replace("__pending__", "")
      ],
      default_task_workdir: settings.default_task_workdir,
      default_write_root: settings.default_write_root,
      default_export_dir: settings.default_export_dir,
      verification_evidence_dir: settings.verification_evidence_dir,
      task_run_dir: settings.task_run_dir,
      ...enrichedInputs
    };
  } catch {}

  const task = buildDefaultTask({
    task_type: input.taskType ?? "one_off",
    intent: input.intent,
    department: input.department ?? "general",
    risk_level: input.riskLevel ?? "medium",
    initiator: {
      tenant_id: "local_tenant",
      user_id: "local_user",
      channel: input.channel ?? "desktop-shell"
    },
    inputs: enrichedInputs,
    definition_of_done: input.definitionOfDone
  });
  task.status = "queued";
  task.timestamps.updated_at = nowIso();
  store.tasks.set(task.task_id, task);

  try {
    const settings = loadLocalAppSettings();
    const taskDirs = resolveTaskDirectoryPaths(settings, task.task_id);
    mkdirSync(taskDirs.task_workdir, { recursive: true });
    mkdirSync(taskDirs.task_run_dir, { recursive: true });
    mkdirSync(taskDirs.task_verification_dir, { recursive: true });
  } catch {}

  return task;
}

export function stopLocalTask(taskId: string, reason = "Stopped from desktop shell.") {
  const task = requireTask(taskId);
  task.status = "stopping";
  touchTask(task);
  stopWorkerRun(taskId, reason);
  task.status = "cancelled";
  return touchTask(task);
}

export function resumeLocalTask(taskId: string) {
  const task = requireTask(taskId);
  task.status = "resuming";
  touchTask(task);
  task.status = "running";
  sendHeartbeat(taskId, "local-control-plane");
  return touchTask(task);
}

export function prepareLocalTask(taskId: string) {
  const task = createExecutionPlan(taskId);
  const capabilityResolutions = listTaskCapabilityResults(taskId);
  return { task, capabilityResolutions };
}

export function verifyLocalTask(taskId: string) {
  const checklist = runChecklist(taskId);
  const verification = runVerifier(taskId);
  const reconciliation = runReconciliation(taskId);
  const doneGate = runDoneGate(taskId);
  captureMemories(taskId);
  createSkillCandidate(taskId);
  return { checklist, verification, reconciliation, doneGate };
}

export function bootstrapLocalDemoData() {
  if (store.tasks.size > 0) {
    return listTasks();
  }

  const tasks = [
    createLocalTask({
      intent: "Prepare an engineering implementation plan and verification report",
      department: "engineering",
      riskLevel: "medium"
    }),
    createLocalTask({
      intent: "Review QA evidence and produce a release readiness summary",
      department: "qa",
      taskType: "long_running",
      riskLevel: "high"
    }),
    createLocalTask({
      intent: "Generate a weekly finance reconciliation overview",
      department: "finance",
      taskType: "scheduled",
      riskLevel: "medium"
    })
  ];

  runTaskEndToEnd(tasks[0].task_id);
  prepareLocalTask(tasks[1].task_id);
  runTaskEndToEnd(tasks[2].task_id);

  return listTasks();
}

export function getLocalDashboard() {
  const tasks = listTasks();
  return {
    stateBackend: stateBackendInfo,
    totals: {
      tasks: tasks.length,
      running: tasks.filter(task => task.status === "running").length,
      completed: tasks.filter(task => task.status === "completed").length,
      waitingApproval: tasks.filter(task => task.status === "waiting_approval").length,
      workerRuns: store.workerRuns.size,
      artifacts: store.artifacts.size
    },
    recentTasks: tasks.slice(0, 8),
    recentSkillCandidates: [...store.skillCandidates.values()].slice(-5).reverse(),
    recentMemoryItems: [...store.memoryItems.values()].slice(-5).reverse()
  };
}

export function resolveLocalTaskCapabilities(taskId: string) {
  return resolveTaskCapabilities(taskId);
}

export function searchLocalCapabilities(input: {
  query?: string;
  kinds?: LocalCapabilityKind[];
  tags?: string[];
}) {
  return searchCapabilityCatalog({
    query: input.query,
    preferredKinds: input.kinds,
    tags: input.tags
  });
}

export function getCapabilityCatalogSnapshot() {
  return getCapabilityCatalog();
}

export type LocalCapabilityKind = Parameters<typeof searchCapabilityCatalog>[0]["preferredKinds"] extends Array<infer T> ? T : never;
