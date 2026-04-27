import { useEffect, useMemo, useRef, useState } from "react";
import {
  consumePendingDesktopDeepLink,
  getDesktopNavigationEvents,
  getDesktopNavigationEventPolicy,
  getDesktopNotificationCapability,
  focusDesktopWindow,
  getApiBase,
  getLocalControlPlaneManagerEvents,
  getLocalControlPlaneManagerLogs,
  getInitialDesktopDeepLink,
  getDesktopRuntimeInfo,
  getLocalControlPlaneManagerState,
  restartLocalControlPlane,
  sendNativeDesktopNotification,
  startLocalControlPlane,
  stopLocalControlPlane,
  type LocalControlPlaneManagerEvent,
  type LocalControlPlaneManagerLogs,
  type LocalControlPlaneManagerState,
  type DesktopNotificationCapability,
  type DesktopNavigationEvent as SystemDesktopNavigationEvent
  ,
  type DesktopNavigationEventPolicy
} from "./platform";

type TaskSummary = {
  task_id: string;
  intent: string;
  department: string;
  risk_level: string;
  status: string;
  task_type: string;
  inputs?: Record<string, unknown>;
  timestamps: {
    created_at: string;
    updated_at?: string;
    completed_at?: string;
  };
};

type DashboardData = {
  stateBackend: {
    kind: string;
    driver: string;
    path: string;
  };
  totals: {
    tasks: number;
    running: number;
    completed: number;
    waitingApproval: number;
    workerRuns: number;
    artifacts: number;
  };
  recentTasks: TaskSummary[];
  recentSkillCandidates: Array<{ candidate_id: string; title: string; status: string }>;
  recentMemoryItems: Array<{ memory_id: string; title: string; kind: string }>;
  inbox_summary: InboxSummary;
  governance_alert_summary: {
    total: number;
    open_count: number;
    acknowledged_count: number;
    resolved_count: number;
    escalated_count: number;
    aggregated_occurrences: number;
    by_severity: {
      info: number;
      warning: number;
      critical: number;
    };
    by_action: {
      review_desktop_navigation: number;
      investigate_system_handoff: number;
      review_reuse_navigation: number;
      investigate_reuse_loop: number;
    };
    by_source_kind: {
      desktop_navigation: number;
      reuse_navigation: number;
    };
  };
};

type InboxSummary = {
  total_open: number;
  new_count: number;
  acknowledged_count: number;
  by_severity: {
    info: number;
    warning: number;
    critical: number;
  };
  by_kind: {
    policy_follow_up: number;
    task_attention: number;
    governance_alert: number;
  };
};

type InboxItem = {
  inbox_id: string;
  kind: "policy_follow_up" | "task_attention" | "governance_alert";
  severity: "info" | "warning" | "critical";
  state: "new" | "acknowledged";
  title: string;
  message: string;
  action: string;
  source_id?: string;
  created_at: string;
};
type GovernanceAlertEntry = {
  alert_id: string;
  source_kind: "desktop_navigation" | "reuse_navigation";
  source_id?: string;
  aggregate_key?: string;
  severity: "info" | "warning" | "critical";
  status: "new" | "acknowledged" | "resolved";
  action:
    | "review_desktop_navigation"
    | "investigate_system_handoff"
    | "review_reuse_navigation"
    | "investigate_reuse_loop";
  title: string;
  message: string;
  detail?: string;
  recommended_action?: string;
  deep_link?: string;
  created_at: string;
  first_seen_at?: string;
  last_seen_at?: string;
  occurrence_count: number;
  auto_escalated?: boolean;
  escalated_at?: string;
  suppressed_repeat_count?: number;
};
type GovernanceAlertFollowUp = {
  follow_up_id: string;
  alert_id: string;
  severity: "info" | "warning" | "critical";
  action:
    | "review_desktop_navigation"
    | "investigate_system_handoff"
    | "review_reuse_navigation"
    | "investigate_reuse_loop";
  title: string;
  message: string;
  occurrence_count: number;
  auto_escalated?: boolean;
  deep_link?: string;
  created_at: string;
};

type InboxSeverityFilter = InboxItem["severity"] | "all";
type InboxKindFilter = InboxItem["kind"] | "all";
type InboxStatusFilter = InboxItem["state"] | "all";

type DesktopNotificationPreference = "default" | "enabled" | "disabled";
type DesktopNotificationPermissionState = NotificationPermission | "unsupported" | "native";
type DesktopNavigationSource =
  | "workspace_click"
  | "browser_notification"
  | "native_notification"
  | "hash_change"
  | "startup_deep_link"
  | "pending_deep_link"
  | "follow_up_focus"
  | "system_focus";
type DesktopDeepLinkTarget =
  | { kind: "task"; taskId: string }
  | { kind: "inbox"; inboxId: string }
  | { kind: "policy_follow_up"; followUpId: string }
  | { kind: "policy_proposal"; proposalId: string }
  | { kind: "execution_template"; taskId: string; templateId: string }
  | { kind: "learned_playbook"; taskId: string; playbookId: string };
type DesktopNavigationEvent = {
  event_id: string;
  source: DesktopNavigationSource;
  target: DesktopDeepLinkTarget;
  recorded_at: string;
};
type DesktopNavigationRiskItem = {
  risk_id: string;
  severity: "warning" | "critical";
  title: string;
  detail: string;
  recommended_action: string;
  target?: DesktopDeepLinkTarget;
};
type DesktopNavigationSourceFilter = "all" | "workspace" | "browser" | "system";
type DesktopNavigationTargetFilter = "all" | "task" | "inbox" | "policy" | "reuse";
type DesktopNavigationReuseFilter = "all" | "execution_template" | "learned_playbook";
type DesktopNavigationTimeRangeFilter = "5m" | "1h" | "24h" | "all";

type ToolCatalogEntry = {
  tool_name: string;
  category: string;
  requires_permission: string;
  behavior: string;
  description: string;
};

type ExternalToolCatalogEntry = {
  name: string;
  category: string;
  risk: string;
  compensation_available: boolean;
  reconciliation_mode: string;
  connector_type: string;
  auth_strategy: string;
  pagination_strategy: string;
  required_inputs: string[];
};

type AgentTeamLauncherCatalogEntry = {
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

type AgentTeamLauncherDriverCatalogEntry = {
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

type AgentTeamLauncherStatusEntry = {
  launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
  availability: "ready" | "attention" | "degraded";
  active_runtime_count: number;
  pending_attachment_count: number;
  released_runtime_count: number;
  recommended_action: string;
  summary: string;
};

type AgentTeamLauncherDriverStatusEntry = {
  driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
  launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
  health: "healthy" | "attention" | "degraded";
  active_runtime_count: number;
  pending_attachment_count: number;
  released_runtime_count: number;
  recommended_action: string;
  summary: string;
};

type AgentTeamLauncherBackendAdapterCatalogEntry = {
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

type AgentTeamLauncherBackendAdapterStatusEntry = {
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

type AgentTeamRunnerBackendAdapterCatalogEntry = {
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

type AgentTeamRunnerBackendAdapterStatusEntry = {
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

type CanonicalSkillEntry = {
  skill_id: string;
  name: string;
  description: string;
  source: "internal" | "openclaw" | "claude" | "openai";
  execution_mode: "advisory" | "tool_orchestrated" | "worker_delegated";
  status: "review_required" | "active" | "disabled";
  integrity_hash: string;
  reviewed_by?: string;
  reviewed_at?: string;
  governance_note?: string;
  trigger_phrases: string[];
  tags: string[];
  required_capabilities: string[];
  preferred_workers: string[];
  notes?: string[];
  prompt_template?: string;
  version: number;
};

type CanonicalSkillSourceFilter = CanonicalSkillEntry["source"] | "all";
type CanonicalSkillStatusFilter = CanonicalSkillEntry["status"] | "all";
type SkillDocumentFormat = "canonical_json" | "openclaw_markdown" | "claude_markdown" | "openai_json";
type SkillAuditEntry = {
  audit_id: string;
  action: string;
  created_at: string;
  payload: Record<string, unknown>;
};

type BundleProvenanceEvent = {
  event_id: string;
  action: "bundle_exported" | "bundle_imported" | "bundle_promoted";
  occurred_at: string;
  actor_id?: string;
  actor_name?: string;
  environment?: string;
  release_channel?: string;
  note?: string;
  bundle_name?: string;
  skill_ids: string[];
  included_statuses: string[];
  signature_key_id?: string;
};

type BundleManifestPreview = {
  bundle_version: number;
  bundle_name?: string;
  generated_at: string;
  included_statuses: string[];
  skill_count: number;
  skills: CanonicalSkillEntry[];
  integrity: string;
  signature?: { algorithm: string; key_id?: string; value: string };
  publisher?: {
    publisher_id: string;
    publisher_name?: string;
    published_at: string;
  };
  provenance?: {
    source_environment?: string;
    release_channel?: string;
    promotion_note?: string;
    current_event: BundleProvenanceEvent;
    promotion_history: BundleProvenanceEvent[];
  };
};

type SkillPolicyDiagnostics = {
  trust: {
    trusted_publishers: string[];
    allowed_release_channels: string[];
    require_trusted_bundle_import: boolean;
  };
  content: {
    allowed_skill_sources: Array<CanonicalSkillEntry["source"]>;
    blocked_tags: string[];
    blocked_capabilities: string[];
  };
  roles: {
    review_roles: string[];
    promote_roles: string[];
    trusted_import_roles: string[];
    policy_edit_roles: string[];
    policy_approve_roles: string[];
    policy_manual_approval_roles: string[];
    policy_security_review_roles: string[];
    policy_promote_roles: string[];
  };
  environments: {
    labels: Record<SkillPolicyScopeEntry["scope"], string>;
    promotion_pipeline: string[];
  };
  sources: {
    trusted_publishers: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    allowed_release_channels: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    require_trusted_bundle_import: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    allowed_skill_sources: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    blocked_tags: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    blocked_capabilities: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    review_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    promote_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    trusted_import_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    policy_edit_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    policy_approve_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    policy_manual_approval_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    policy_security_review_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    policy_promote_roles: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env";
    scope_labels: "default" | "env";
    promotion_pipeline: "default" | "env";
  };
  policy_file: {
    path?: string;
    loaded: boolean;
    error: string | null;
  };
  policy_files: Array<{
    scope: "global" | "org" | "workspace" | "local";
    configured: boolean;
    path?: string;
    loaded: boolean;
    error: string | null;
  }>;
};

type SkillPolicyScopeEntry = {
  scope: "global" | "org" | "workspace" | "local";
  configured: boolean;
  path?: string;
  loaded: boolean;
  error: string | null;
  config: {
    trust: {
      trusted_publishers: string[];
      allowed_release_channels: string[];
      require_trusted_bundle_import: boolean;
    };
    content: {
      allowed_skill_sources: Array<CanonicalSkillEntry["source"]>;
      blocked_tags: string[];
      blocked_capabilities: string[];
    };
    roles: {
      review_roles: string[];
      promote_roles: string[];
      trusted_import_roles: string[];
    };
  };
};

type PolicyAuditEntry = {
  audit_id: string;
  task_id?: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type PolicyProposalEntry = {
  proposal_id: string;
  kind: "scope_update" | "scope_promotion";
  status: "pending_review" | "approved" | "rejected" | "applied";
  review_path: "standard" | "manual_approval" | "security_review";
  advisory_recommended_action?: "safe_to_promote" | "manual_approval_required" | "requires_security_review";
  advisory_reasons: string[];
  source_scope?: SkillPolicyScopeEntry["scope"];
  target_scope: SkillPolicyScopeEntry["scope"];
  path?: string;
  rationale?: string;
  requested_by?: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  approval_note?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  applied_by?: string;
  applied_at?: string;
  changed_fields: Array<{ field: string; before?: unknown; after?: unknown }>;
};

type PolicyProposalQueue = {
  review_path: PolicyProposalEntry["review_path"];
  label: string;
  description: string;
  count: number;
  status_breakdown: {
    pending_review: number;
    approved: number;
    rejected: number;
    applied: number;
  };
  oldest_requested_at?: string;
  pending_review_sla_hours: number;
  pending_review_sla_breach_count: number;
  suggested_action: string;
  health_status: "healthy" | "attention" | "breached";
  escalation_required: boolean;
  escalation_reason?: string;
  follow_up_action: string;
  items: PolicyProposalEntry[];
};

type PolicyProposalFollowUp = {
  follow_up_id: string;
  review_path: PolicyProposalEntry["review_path"];
  severity: "info" | "warning" | "critical";
  action: "assign_security_reviewer" | "escalate_queue_owner" | "request_manual_approval" | "process_standard_promotions";
  queue_label: string;
  title: string;
  message: string;
  pending_count: number;
  sla_breach_count: number;
  created_at: string;
};

type PolicyApprovalTemplates = {
  approval: string[];
  rejection: string[];
  promotion: string[];
};

type PolicyEnvironmentSnapshot = {
  scope: SkillPolicyScopeEntry["scope"];
  label: string;
  effective_policy: SkillPolicyDiagnostics;
};

type PolicyEnvironmentCompareResult = {
  from: PolicyEnvironmentSnapshot;
  to: PolicyEnvironmentSnapshot;
  changed_fields: Array<{
    field: string;
    before?: unknown;
    after?: unknown;
  }>;
  changed_groups: Array<{
    group: "trust" | "content" | "roles" | "environments";
    items: Array<{
      field: string;
      before?: unknown;
      after?: unknown;
    }>;
  }>;
  risk_summary: Array<{
    severity: "high" | "medium" | "low";
    field: string;
    title: string;
    reason: string;
  }>;
  advisory: {
    recommended_action: "safe_to_promote" | "manual_approval_required" | "requires_security_review";
    manual_approval_required: boolean;
    security_review_required: boolean;
    reasons: string[];
    next_step: "create_promotion_proposal";
    review_path: "standard" | "manual_approval" | "security_review";
    suggested_template_kind: keyof PolicyApprovalTemplates;
    suggested_note: string;
  };
};

type HealthData = {
  status: string;
  service: string;
};

type ControlPlaneState = "connecting" | "connected" | "unavailable";

type WorkspaceData = {
  task: TaskSummary & {
    definition_of_done: {
      goal: string;
      completion_criteria: string[];
      required_artifacts: string[];
    };
    execution_plan: Array<{ step_id: string; title: string; status: string; owner?: string }>;
  };
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
  agentTeam: {
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
    runtimeLaunchSpecs: Array<{
      launch_spec_id: string;
      instance_id: string;
      binding_id: string;
      execution_run_id: string;
      package_id: string;
      request_id: string;
      subagent_session_id: string;
      runtime_kind: "host_guarded" | "sandbox_runner" | "cloud_runner";
      sandbox_profile: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
      runtime_locator?: string;
      launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
      launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
      launcher_state: "attached" | "external_pending" | "released";
      launcher_locator?: string;
      launcher_worker_run_id?: string;
      isolation_scope: "host_process" | "sandbox_pool" | "remote_control_plane";
      quota_profile: "local_worker_default" | "sandbox_pool_default" | "cloud_runner_default";
      mutation_guarded: boolean;
      handoff_checkpoint_id: string;
      start_checkpoint_id: string;
      latest_checkpoint_id?: string;
      applied_checkpoint_id?: string;
      package_summary: string;
      execution_state_summary?: string;
      latest_heartbeat_at?: string;
      latest_heartbeat_note?: string;
      consumer_contract_version: 1;
      deep_link?: string;
      created_at: string;
    }>;
    runtimeLaunchReceipts: Array<{
      receipt_id: string;
      launch_spec_id: string;
      instance_id: string;
      binding_id: string;
      execution_run_id: string;
      package_id: string;
      request_id: string;
      subagent_session_id: string;
      launcher_kind: "worker_run" | "sandbox_runner" | "cloud_runner";
      launcher_driver_id: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
      backend_kind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter";
      status: "launched" | "failed";
      launched_by: string;
      launched_at: string;
      launch_locator?: string;
      execution_locator?: string;
      note?: string;
      failure_reason?: string;
      consumer_contract_version: 1;
      deep_link?: string;
    }>;
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
    launcherCatalog: AgentTeamLauncherCatalogEntry[];
    launcherStatuses: AgentTeamLauncherStatusEntry[];
    launcherDrivers: AgentTeamLauncherDriverCatalogEntry[];
    launcherDriverStatuses: AgentTeamLauncherDriverStatusEntry[];
    launcherBackendAdapters: AgentTeamLauncherBackendAdapterCatalogEntry[];
    launcherBackendAdapterStatuses: AgentTeamLauncherBackendAdapterStatusEntry[];
    runnerBackendAdapters: AgentTeamRunnerBackendAdapterCatalogEntry[];
    runnerBackendAdapterStatuses: AgentTeamRunnerBackendAdapterStatusEntry[];
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
  executionTemplate: {
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
  reuseImprovement: {
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
  } | null;
  artifacts: Array<{ artifact_id: string; name: string; kind: string; status: string }>;
  checkpoints: Array<{ checkpoint_id: string; stage: string; summary: string; created_at: string }>;
  workerRuns: Array<{ worker_run_id: string; worker_name: string; worker_kind: string; status: string; summary?: string }>;
  capabilityResolutions: Array<{
    resolution_id: string;
    need_key: string;
    need_title: string;
    strategy: string;
    status: string;
    reasoning: string;
    selected_capabilities: Array<{ capability_id: string; name: string; kind: string; source: string }>;
  }>;
  toolInvocations: Array<{
    invocation_id: string;
    tool_name: string;
    status: string;
    created_at: string;
    idempotency_key?: string;
    compensation_available?: boolean;
    compensation_status?: "not_required" | "available" | "applied" | "failed";
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>;
  browserSessions: Array<{
    session_id: string;
    entry_url: string;
    current_url: string;
    engine: string;
    title?: string | null;
    status: string;
    updated_at: string;
    history: Array<{ url: string; engine: string; visited_at: string }>;
    text_excerpt?: string;
    dom_summary?: {
      heading_count: number;
      link_count: number;
      form_count: number;
      interactive_count: number;
      sample_links: string[];
      sample_headings: string[];
    } | null;
    resilience?: {
      attempts: number;
      circuit_state: "closed" | "open" | "half_open";
      degraded: boolean;
      degraded_reason?: string;
      retry_reasons: string[];
    };
  }>;
  checklist: { status: string; failed_items: string[]; passed_items: string[] } | null;
  reconciliation: { status: string; missing_states: string[]; matched_states: string[] } | null;
  verification: { verdict: string; summary: string; missing_items: string[] } | null;
  doneGate: { status: string; reasons: string[] } | null;
  memoryItems: Array<{ memory_id: string; title: string; kind: string }>;
  skillCandidates: Array<{ candidate_id: string; title: string; status: string }>;
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
  audits: Array<{ audit_id: string; action: string; created_at: string }>;
  watchdog: { status: "healthy" | "stalled"; reasons: string[] };
};

const RUNTIME_INFO = getDesktopRuntimeInfo();
const DESKTOP_NOTIFICATION_PREF_KEY = "apex.desktop-notifications.preference";
const DELIVERED_INBOX_ALERTS_KEY = "apex.desktop-notifications.delivered";
const DISMISSED_DESKTOP_NAVIGATION_RISKS_KEY = "apex.desktop-navigation.risks.dismissed";

function loadDesktopNotificationPreference(): DesktopNotificationPreference {
  if (typeof window === "undefined") return "default";
  const value = window.localStorage.getItem(DESKTOP_NOTIFICATION_PREF_KEY);
  return value === "enabled" || value === "disabled" ? value : "default";
}

function persistDesktopNotificationPreference(value: DesktopNotificationPreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DESKTOP_NOTIFICATION_PREF_KEY, value);
}

function loadDeliveredInboxAlertKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELIVERED_INBOX_ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function persistDeliveredInboxAlertKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELIVERED_INBOX_ALERTS_KEY, JSON.stringify(keys.slice(-200)));
}

function loadDismissedDesktopNavigationRiskIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_DESKTOP_NAVIGATION_RISKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function persistDismissedDesktopNavigationRiskIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_DESKTOP_NAVIGATION_RISKS_KEY, JSON.stringify(ids.slice(-200)));
}

function buildInboxNotificationDeliveryKey(
  item: InboxItem,
  governanceAlert?: GovernanceAlertEntry | null
) {
  if (item.kind !== "governance_alert" || !governanceAlert) {
    return `${item.inbox_id}:${item.severity}:${item.state}`;
  }
  return [
    item.inbox_id,
    item.severity,
    item.state,
    governanceAlert.auto_escalated ? "escalated" : "standard"
  ].join(":");
}

function serializeDesktopDeepLink(target: DesktopDeepLinkTarget): string {
  const params = new URLSearchParams();
  params.set("kind", target.kind);
  if (target.kind === "task") {
    params.set("taskId", target.taskId);
  } else if (target.kind === "inbox") {
    params.set("inboxId", target.inboxId);
  } else if (target.kind === "policy_follow_up") {
    params.set("followUpId", target.followUpId);
  } else if (target.kind === "policy_proposal") {
    params.set("proposalId", target.proposalId);
  } else if (target.kind === "execution_template") {
    params.set("taskId", target.taskId);
    params.set("templateId", target.templateId);
  } else {
    params.set("taskId", target.taskId);
    params.set("playbookId", target.playbookId);
  }
  return `#${params.toString()}`;
}

function parseDesktopDeepLink(hash: string): DesktopDeepLinkTarget | null {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalized) return null;
  const params = new URLSearchParams(normalized);
  const kind = params.get("kind");
  if (kind === "task" && params.get("taskId")) {
    return { kind, taskId: params.get("taskId") ?? "" };
  }
  if (kind === "inbox" && params.get("inboxId")) {
    return { kind, inboxId: params.get("inboxId") ?? "" };
  }
  if (kind === "policy_follow_up" && params.get("followUpId")) {
    return { kind, followUpId: params.get("followUpId") ?? "" };
  }
  if (kind === "policy_proposal" && params.get("proposalId")) {
    return { kind, proposalId: params.get("proposalId") ?? "" };
  }
  if (kind === "execution_template" && params.get("taskId") && params.get("templateId")) {
    return {
      kind,
      taskId: params.get("taskId") ?? "",
      templateId: params.get("templateId") ?? ""
    };
  }
  if (kind === "learned_playbook" && params.get("taskId") && params.get("playbookId")) {
    return {
      kind,
      taskId: params.get("taskId") ?? "",
      playbookId: params.get("playbookId") ?? ""
    };
  }
  return null;
}

function describeDesktopDeepLinkTarget(target: DesktopDeepLinkTarget): string {
  if (target.kind === "task") {
    return `task ${target.taskId}`;
  }
  if (target.kind === "inbox") {
    return `inbox ${target.inboxId}`;
  }
  if (target.kind === "policy_follow_up") {
    return `policy follow-up ${target.followUpId}`;
  }
  if (target.kind === "policy_proposal") {
    return `policy proposal ${target.proposalId}`;
  }
  if (target.kind === "execution_template") {
    return `execution template ${target.templateId}`;
  }
  return `learned playbook ${target.playbookId}`;
}

function describeDesktopNavigationSource(source: DesktopNavigationSource): string {
  switch (source) {
    case "workspace_click":
      return "Workspace";
    case "browser_notification":
      return "Browser notification";
    case "native_notification":
      return "Native notification";
    case "hash_change":
      return "Hash change";
    case "startup_deep_link":
      return "Startup deep link";
    case "pending_deep_link":
      return "Pending deep link";
    case "follow_up_focus":
      return "Follow-up focus";
    case "system_focus":
      return "System focus";
    default:
      return source;
  }
}

function classifyDesktopNavigationSource(source: DesktopNavigationSource): DesktopNavigationSourceFilter {
  if (source === "workspace_click" || source === "follow_up_focus") {
    return "workspace";
  }
  if (source === "browser_notification") {
    return "browser";
  }
  return "system";
}

function classifyDesktopNavigationTarget(target: DesktopDeepLinkTarget): DesktopNavigationTargetFilter {
  if (target.kind === "task") {
    return "task";
  }
  if (target.kind === "inbox") {
    return "inbox";
  }
  if (target.kind === "policy_follow_up" || target.kind === "policy_proposal") {
    return "policy";
  }
  return "reuse";
}

function describeDesktopNavigationTargetGroup(target: DesktopDeepLinkTarget): string {
  switch (classifyDesktopNavigationTarget(target)) {
    case "task":
      return "Task";
    case "inbox":
      return "Inbox";
    case "policy":
      return "Policy";
    case "reuse":
      return "Reuse";
    default:
      return "Unknown";
  }
}

function classifyDesktopNavigationReuseTarget(target: DesktopDeepLinkTarget): DesktopNavigationReuseFilter {
  if (target.kind === "execution_template") {
    return "execution_template";
  }
  if (target.kind === "learned_playbook") {
    return "learned_playbook";
  }
  return "all";
}

function describeDesktopNavigationReuseTarget(target: DesktopDeepLinkTarget): string {
  if (target.kind === "execution_template") {
    return "Execution template";
  }
  if (target.kind === "learned_playbook") {
    return "Learned playbook";
  }
  return "Non-reuse target";
}

function describeDesktopNavigationTimeRange(range: DesktopNavigationTimeRangeFilter): string {
  switch (range) {
    case "5m":
      return "Last 5 minutes";
    case "1h":
      return "Last hour";
    case "24h":
      return "Last 24 hours";
    case "all":
    default:
      return "All retained events";
  }
}

function buildDesktopDeepLinkUrl(target: DesktopDeepLinkTarget): string {
  const hash = serializeDesktopDeepLink(target);
  if (typeof window === "undefined") {
    return hash;
  }
  try {
    const url = new URL(window.location.href);
    url.hash = hash;
    return url.toString();
  } catch {
    return `${window.location.pathname}${hash}`;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function formatManagerEventTime(input: string): string {
  const asNumber = Number(input);
  if (Number.isFinite(asNumber)) {
    return new Date(asNumber).toLocaleTimeString();
  }
  return new Date(input).toLocaleTimeString();
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [controlPlaneState, setControlPlaneState] = useState<ControlPlaneState>("connecting");
  const [lastHealthCheckAt, setLastHealthCheckAt] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [governanceAlerts, setGovernanceAlerts] = useState<GovernanceAlertEntry[]>([]);
  const [inboxSeverityFilter, setInboxSeverityFilter] = useState<InboxSeverityFilter>("all");
  const [inboxKindFilter, setInboxKindFilter] = useState<InboxKindFilter>("all");
  const [inboxStatusFilter, setInboxStatusFilter] = useState<InboxStatusFilter>("all");
  const [desktopNotificationPreference, setDesktopNotificationPreference] = useState<DesktopNotificationPreference>(() =>
    loadDesktopNotificationPreference()
  );
  const [desktopNotificationPermission, setDesktopNotificationPermission] = useState<DesktopNotificationPermissionState>(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [desktopNotificationCapability, setDesktopNotificationCapability] = useState<DesktopNotificationCapability>({
    native_supported: typeof Notification !== "undefined",
    click_through_supported: typeof Notification !== "undefined",
    mode: typeof Notification !== "undefined" ? "browser_web" : "tauri_native_fallback"
  });
  const [deliveredInboxAlertKeys, setDeliveredInboxAlertKeys] = useState<string[]>(() => loadDeliveredInboxAlertKeys());
  const [dismissedDesktopNavigationRiskIds, setDismissedDesktopNavigationRiskIds] = useState<string[]>(
    () => loadDismissedDesktopNavigationRiskIds()
  );
  const [desktopNavigationEvents, setDesktopNavigationEvents] = useState<DesktopNavigationEvent[]>([]);
  const [desktopSystemNavigationEvents, setDesktopSystemNavigationEvents] = useState<SystemDesktopNavigationEvent[]>([]);
  const [desktopNavigationSourceFilter, setDesktopNavigationSourceFilter] =
    useState<DesktopNavigationSourceFilter>("all");
  const [desktopNavigationTargetFilter, setDesktopNavigationTargetFilter] =
    useState<DesktopNavigationTargetFilter>("all");
  const [desktopNavigationReuseFilter, setDesktopNavigationReuseFilter] =
    useState<DesktopNavigationReuseFilter>("all");
  const [desktopNavigationTimeRangeFilter, setDesktopNavigationTimeRangeFilter] =
    useState<DesktopNavigationTimeRangeFilter>("1h");
  const [desktopNavigationEventPolicy, setDesktopNavigationEventPolicy] = useState<DesktopNavigationEventPolicy>({
    max_retained: 12,
    storage_mode: "in_memory_ring_buffer"
  });
  const [highlightedInboxId, setHighlightedInboxId] = useState<string | null>(null);
  const [highlightedPolicyFollowUpId, setHighlightedPolicyFollowUpId] = useState<string | null>(null);
  const [highlightedPolicyProposalId, setHighlightedPolicyProposalId] = useState<string | null>(null);
  const [highlightedExecutionTemplateId, setHighlightedExecutionTemplateId] = useState<string | null>(null);
  const [highlightedExecutionPlaybookId, setHighlightedExecutionPlaybookId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingWorkspaceTarget, setPendingWorkspaceTarget] = useState<
    | { kind: "execution_template"; taskId: string; templateId: string }
    | { kind: "learned_playbook"; taskId: string; playbookId: string }
    | null
  >(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
const [toolCatalog, setToolCatalog] = useState<ToolCatalogEntry[]>([]);
const [externalToolCatalog, setExternalToolCatalog] = useState<ExternalToolCatalogEntry[]>([]);
const [agentTeamResumeReason, setAgentTeamResumeReason] = useState("");
const [agentTeamLauncherKind, setAgentTeamLauncherKind] = useState<"worker_run" | "sandbox_runner" | "cloud_runner">("worker_run");
const [agentTeamLauncherDriverId, setAgentTeamLauncherDriverId] = useState<"local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver">("local_worker_run_driver");
const [agentTeamLauncherLocator, setAgentTeamLauncherLocator] = useState("");
const [agentTeamLauncherCatalog, setAgentTeamLauncherCatalog] = useState<AgentTeamLauncherCatalogEntry[]>([]);
const [agentTeamLauncherStatuses, setAgentTeamLauncherStatuses] = useState<AgentTeamLauncherStatusEntry[]>([]);
const [agentTeamLauncherDriverCatalog, setAgentTeamLauncherDriverCatalog] = useState<AgentTeamLauncherDriverCatalogEntry[]>([]);
const [agentTeamLauncherDriverStatuses, setAgentTeamLauncherDriverStatuses] = useState<AgentTeamLauncherDriverStatusEntry[]>([]);
const [agentTeamLauncherBackendAdapterCatalog, setAgentTeamLauncherBackendAdapterCatalog] = useState<AgentTeamLauncherBackendAdapterCatalogEntry[]>([]);
const [agentTeamLauncherBackendAdapterStatuses, setAgentTeamLauncherBackendAdapterStatuses] = useState<AgentTeamLauncherBackendAdapterStatusEntry[]>([]);
const [agentTeamRunnerBackendAdapterCatalog, setAgentTeamRunnerBackendAdapterCatalog] = useState<AgentTeamRunnerBackendAdapterCatalogEntry[]>([]);
const [agentTeamRunnerBackendAdapterStatuses, setAgentTeamRunnerBackendAdapterStatuses] = useState<AgentTeamRunnerBackendAdapterStatusEntry[]>([]);
const [canonicalSkills, setCanonicalSkills] = useState<CanonicalSkillEntry[]>([]);
  const [skillSearchQuery, setSkillSearchQuery] = useState("");
  const [skillSourceFilter, setSkillSourceFilter] = useState<CanonicalSkillSourceFilter>("all");
  const [skillStatusFilter, setSkillStatusFilter] = useState<CanonicalSkillStatusFilter>("all");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedExecutionPlaybookId, setSelectedExecutionPlaybookId] = useState<string | null>(null);
  const [selectedGovernanceAlertId, setSelectedGovernanceAlertId] = useState<string | null>(null);
  const [selectedGovernanceAlertAudits, setSelectedGovernanceAlertAudits] = useState<SkillAuditEntry[]>([]);
  const [skillImportFormat, setSkillImportFormat] = useState<SkillDocumentFormat>("openclaw_markdown");
  const [skillImportContent, setSkillImportContent] = useState("# Example Skill\n\nDescribe the skill here.");
  const [skillImportPath, setSkillImportPath] = useState("");
  const [skillExportFormat, setSkillExportFormat] = useState<SkillDocumentFormat>("canonical_json");
  const [skillExportPath, setSkillExportPath] = useState("");
  const [skillExchangeMessage, setSkillExchangeMessage] = useState<string | null>(null);
  const [skillExportPreview, setSkillExportPreview] = useState<string>("");
  const [skillGovernanceNote, setSkillGovernanceNote] = useState("");
  const [skillActorRole, setSkillActorRole] = useState("admin");
  const [skillReviewQueue, setSkillReviewQueue] = useState<CanonicalSkillEntry[]>([]);
  const [selectedSkillAudits, setSelectedSkillAudits] = useState<SkillAuditEntry[]>([]);
  const [bundleHistory, setBundleHistory] = useState<BundleProvenanceEvent[]>([]);
  const [skillPolicyDiagnostics, setSkillPolicyDiagnostics] = useState<SkillPolicyDiagnostics | null>(null);
  const [skillPolicyScopes, setSkillPolicyScopes] = useState<SkillPolicyScopeEntry[]>([]);
  const [policyAudits, setPolicyAudits] = useState<PolicyAuditEntry[]>([]);
  const [selectedPolicyScope, setSelectedPolicyScope] = useState<SkillPolicyScopeEntry["scope"]>("local");
  const [policyEditorPath, setPolicyEditorPath] = useState("");
  const [policyEditorContent, setPolicyEditorContent] = useState('{\n  "trust": {},\n  "content": {},\n  "roles": {}\n}');
  const [policyDiffPreview, setPolicyDiffPreview] = useState("");
  const [policyBundlePath, setPolicyBundlePath] = useState("");
  const [policyBundlePreview, setPolicyBundlePreview] = useState("");
  const [selectedPolicyRollbackAuditId, setSelectedPolicyRollbackAuditId] = useState("");
  const [policyProposals, setPolicyProposals] = useState<PolicyProposalEntry[]>([]);
  const [policyProposalQueues, setPolicyProposalQueues] = useState<PolicyProposalQueue[]>([]);
  const [policyProposalFollowUps, setPolicyProposalFollowUps] = useState<PolicyProposalFollowUp[]>([]);
  const [governanceAlertFollowUps, setGovernanceAlertFollowUps] = useState<GovernanceAlertFollowUp[]>([]);
  const [policyPromotionSourceScope, setPolicyPromotionSourceScope] = useState<SkillPolicyScopeEntry["scope"]>("local");
  const [policyPromotionTargetScope, setPolicyPromotionTargetScope] = useState<SkillPolicyScopeEntry["scope"]>("workspace");
  const [policyProposalRationale, setPolicyProposalRationale] = useState("");
  const [policyApprovalTemplates, setPolicyApprovalTemplates] = useState<PolicyApprovalTemplates | null>(null);
  const [policyReleaseHistory, setPolicyReleaseHistory] = useState<PolicyAuditEntry[]>([]);
  const [selectedPolicyProposalIds, setSelectedPolicyProposalIds] = useState<string[]>([]);
  const [policyEnvironmentSnapshots, setPolicyEnvironmentSnapshots] = useState<PolicyEnvironmentSnapshot[]>([]);
  const [policyCompareFromScope, setPolicyCompareFromScope] = useState<SkillPolicyScopeEntry["scope"]>("workspace");
  const [policyCompareToScope, setPolicyCompareToScope] = useState<SkillPolicyScopeEntry["scope"]>("org");
  const [policyCompareResult, setPolicyCompareResult] = useState<PolicyEnvironmentCompareResult | null>(null);
  const [policyComparePreview, setPolicyComparePreview] = useState("");
  const [bundleExportStatuses, setBundleExportStatuses] = useState<Array<CanonicalSkillEntry["status"]>>(["active"]);
  const [bundleExportPath, setBundleExportPath] = useState("");
  const [bundleExportPreview, setBundleExportPreview] = useState<string>("");
  const [bundleImportPath, setBundleImportPath] = useState("");
  const [bundlePolicySimulationPreview, setBundlePolicySimulationPreview] = useState<string>("");
  const [bundlePublisherId, setBundlePublisherId] = useState("desktop.local");
  const [bundlePublisherName, setBundlePublisherName] = useState("Apex Desktop");
  const [bundleSourceEnvironment, setBundleSourceEnvironment] = useState("desktop-local");
  const [bundleReleaseChannel, setBundleReleaseChannel] = useState("promoted");
  const [bundlePromotionNote, setBundlePromotionNote] = useState("");
  const [selectedExternalTool, setSelectedExternalTool] = useState("crm_sync");
  const [externalToolInput, setExternalToolInput] = useState('{\n  "source": "desktop-workspace",\n  "scope": "manual_invoke"\n}');
  const [desktopManagerState, setDesktopManagerState] = useState<LocalControlPlaneManagerState | null>(null);
  const [desktopManagerEvents, setDesktopManagerEvents] = useState<LocalControlPlaneManagerEvent[]>([]);
  const [desktopManagerLogs, setDesktopManagerLogs] = useState<LocalControlPlaneManagerLogs>({
    stdout_tail: [],
    stderr_tail: []
  });
  const [writePath, setWritePath] = useState("workspace-output.txt");
  const [writeContent, setWriteContent] = useState("Generated workspace output\n");
  const [patchPath, setPatchPath] = useState("workspace-output.txt");
  const [patchExpectedContent, setPatchExpectedContent] = useState("Generated workspace output\n");
  const [patchNextContent, setPatchNextContent] = useState("Generated workspace output\nPatched once\n");
  const [browserUrl, setBrowserUrl] = useState("data:text/html,<html><head><title>Local QA Snapshot</title></head><body>Snapshot a page for validation.</body></html>");
  const [browserSessionUrl, setBrowserSessionUrl] = useState("data:text/html,<html><head><title>Follow-up Snapshot</title></head><body>Follow-up navigation step.</body></html>");
  const [rollbackPath, setRollbackPath] = useState("workspace-output.txt");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const inboxPanelRef = useRef<HTMLElement | null>(null);
  const policyFollowUpsRef = useRef<HTMLParagraphElement | null>(null);
  const policyProposalQueuesRef = useRef<HTMLParagraphElement | null>(null);
  const executionTemplateRef = useRef<HTMLElement | null>(null);
  const executionPlaybookRef = useRef<HTMLElement | null>(null);

  async function loadHealth(): Promise<HealthData | null> {
    try {
      const healthData = await fetchJson<HealthData>("/health");
      setHealth(healthData);
      setControlPlaneState(healthData.status === "ok" ? "connected" : "unavailable");
      setLastHealthCheckAt(new Date().toISOString());
      return healthData;
    } catch {
      setHealth(null);
      setControlPlaneState("unavailable");
      setLastHealthCheckAt(new Date().toISOString());
      return null;
    }
  }

  async function refreshDesktopManagerState() {
    if (RUNTIME_INFO.mode !== "tauri") return;
    try {
      const [state, events, logs] = await Promise.all([
        getLocalControlPlaneManagerState(),
        getLocalControlPlaneManagerEvents(),
        getLocalControlPlaneManagerLogs()
      ]);
      setDesktopManagerState(state);
      setDesktopManagerEvents(events);
      setDesktopManagerLogs(logs);
    } catch {
      setDesktopManagerState({
        supported: false,
        status: "unsupported",
        message: "Failed to query desktop control plane management state.",
        mode: "unsupported",
        auto_restart_enabled: false,
        restart_attempts: 0
      });
      setDesktopManagerEvents([]);
      setDesktopManagerLogs({
        stdout_tail: [],
        stderr_tail: []
      });
    }
  }

  async function loadOverview() {
    if (controlPlaneState !== "connected") {
      setControlPlaneState("connecting");
    }

    const inboxSearch = new URLSearchParams();
    if (inboxSeverityFilter !== "all") {
      inboxSearch.set("severity", inboxSeverityFilter);
    }
    if (inboxKindFilter !== "all") {
      inboxSearch.set("kind", inboxKindFilter);
    }
    if (inboxStatusFilter !== "all") {
      inboxSearch.set("status", inboxStatusFilter);
    }

    const [
      healthData,
      dashboardData,
      tasksData,
      toolData,
      inboxData,
      launcherData,
      launcherStatusData,
      launcherDriverData,
      launcherDriverStatusData,
      launcherBackendAdapterData,
      launcherBackendAdapterStatusData,
      runnerBackendAdapterData,
      runnerBackendAdapterStatusData
    ] = await Promise.all([
      loadHealth(),
      fetchJson<DashboardData>("/api/local/dashboard"),
      fetchJson<{ tasks: TaskSummary[] }>("/api/local/tasks"),
      fetchJson<{ items: ToolCatalogEntry[] }>("/api/local/tools/catalog"),
      fetchJson<{ items: InboxItem[]; summary: InboxSummary }>(
        `/api/local/inbox${inboxSearch.size > 0 ? `?${inboxSearch.toString()}` : ""}`
      ),
      fetchJson<{ items: AgentTeamLauncherCatalogEntry[] }>("/api/local/agent-team/launchers"),
      fetchJson<{ items: AgentTeamLauncherStatusEntry[] }>("/api/local/agent-team/launchers/status"),
      fetchJson<{ items: AgentTeamLauncherDriverCatalogEntry[] }>("/api/local/agent-team/launcher-drivers"),
      fetchJson<{ items: AgentTeamLauncherDriverStatusEntry[] }>("/api/local/agent-team/launcher-drivers/status"),
      fetchJson<{ items: AgentTeamLauncherBackendAdapterCatalogEntry[] }>("/api/local/agent-team/launcher-backend-adapters"),
      fetchJson<{ items: AgentTeamLauncherBackendAdapterStatusEntry[] }>("/api/local/agent-team/launcher-backend-adapters/status"),
      fetchJson<{ items: AgentTeamRunnerBackendAdapterCatalogEntry[] }>("/api/local/agent-team/runner-backend-adapters"),
      fetchJson<{ items: AgentTeamRunnerBackendAdapterStatusEntry[] }>("/api/local/agent-team/runner-backend-adapters/status")
    ]);

    if (!healthData || healthData.status !== "ok") {
      throw new Error("Local control plane is unavailable.");
    }

    setDashboard(dashboardData);
    setTasks(tasksData.tasks);
    setInboxItems(inboxData.items);
    loadGovernanceAlerts().catch(() => setGovernanceAlerts([]));
    loadGovernanceAlertFollowUps().catch(() => setGovernanceAlertFollowUps([]));
    setToolCatalog(toolData.items);
    setAgentTeamLauncherCatalog(launcherData.items);
    setAgentTeamLauncherStatuses(launcherStatusData.items);
    setAgentTeamLauncherDriverCatalog(launcherDriverData.items);
    setAgentTeamLauncherDriverStatuses(launcherDriverStatusData.items);
    setAgentTeamLauncherBackendAdapterCatalog(launcherBackendAdapterData.items);
    setAgentTeamLauncherBackendAdapterStatuses(launcherBackendAdapterStatusData.items);
    setAgentTeamRunnerBackendAdapterCatalog(runnerBackendAdapterData.items);
    setAgentTeamRunnerBackendAdapterStatuses(runnerBackendAdapterStatusData.items);
    if (launcherData.items.length > 0 && !launcherData.items.some(item => item.launcher_kind === agentTeamLauncherKind)) {
      setAgentTeamLauncherKind(launcherData.items[0].launcher_kind);
      setAgentTeamLauncherLocator("");
    }
    const matchingDrivers = launcherDriverData.items.filter(item => item.launcher_kind === agentTeamLauncherKind);
    if (
      matchingDrivers.length > 0
      && !matchingDrivers.some(item => item.driver_id === agentTeamLauncherDriverId)
    ) {
      setAgentTeamLauncherDriverId(matchingDrivers[0].driver_id);
    }
    fetchJson<{ tools: ExternalToolCatalogEntry[] }>("/api/local/tools/external/catalog")
      .then(externalData => {
        setExternalToolCatalog(externalData.tools);
        if (externalData.tools.length > 0 && !externalData.tools.some(tool => tool.name === selectedExternalTool)) {
          setSelectedExternalTool(externalData.tools[0].name);
        }
      })
      .catch(() => setExternalToolCatalog([]));
    loadCanonicalSkills().catch(() => setCanonicalSkills([]));
    if (!selectedTaskId && tasksData.tasks.length > 0) {
      setSelectedTaskId(tasksData.tasks[0].task_id);
    }
  }

  async function loadWorkspace(taskId: string) {
    const workspaceData = await fetchJson<WorkspaceData>(`/api/local/tasks/${taskId}/workspace`);
    setWorkspace(workspaceData);
    if ((workspaceData.agentTeam.launcherCatalog?.length ?? 0) > 0) {
      setAgentTeamLauncherCatalog(workspaceData.agentTeam.launcherCatalog);
    }
    if ((workspaceData.agentTeam.launcherStatuses?.length ?? 0) > 0) {
      setAgentTeamLauncherStatuses(workspaceData.agentTeam.launcherStatuses);
    }
    if ((workspaceData.agentTeam.launcherDrivers?.length ?? 0) > 0) {
      setAgentTeamLauncherDriverCatalog(workspaceData.agentTeam.launcherDrivers);
    }
    if ((workspaceData.agentTeam.launcherDriverStatuses?.length ?? 0) > 0) {
      setAgentTeamLauncherDriverStatuses(workspaceData.agentTeam.launcherDriverStatuses);
    }
    if ((workspaceData.agentTeam.launcherBackendAdapters?.length ?? 0) > 0) {
      setAgentTeamLauncherBackendAdapterCatalog(workspaceData.agentTeam.launcherBackendAdapters);
    }
    if ((workspaceData.agentTeam.launcherBackendAdapterStatuses?.length ?? 0) > 0) {
      setAgentTeamLauncherBackendAdapterStatuses(workspaceData.agentTeam.launcherBackendAdapterStatuses);
    }
    if ((workspaceData.agentTeam.runnerBackendAdapters?.length ?? 0) > 0) {
      setAgentTeamRunnerBackendAdapterCatalog(workspaceData.agentTeam.runnerBackendAdapters);
    }
    if ((workspaceData.agentTeam.runnerBackendAdapterStatuses?.length ?? 0) > 0) {
      setAgentTeamRunnerBackendAdapterStatuses(workspaceData.agentTeam.runnerBackendAdapterStatuses);
    }
  }

  async function loadCanonicalSkills() {
    const search = new URLSearchParams();
    if (skillSearchQuery.trim().length > 0) {
      search.set("q", skillSearchQuery.trim());
    }
    if (skillSourceFilter !== "all") {
      search.set("source", skillSourceFilter);
    }
    if (skillStatusFilter !== "all") {
      search.set("status", skillStatusFilter);
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    const skillData = await fetchJson<{ items: CanonicalSkillEntry[] }>(`/api/local/skills${suffix}`);
    setCanonicalSkills(skillData.items);
  }

  async function loadGovernanceAlerts() {
    const alertData = await fetchJson<{
      items: GovernanceAlertEntry[];
      summary: {
        total_items: number;
        aggregated_occurrences: number;
        max_occurrence_count: number;
      };
      top_repeated: Array<{
        alert_id: string;
        title: string;
        severity: "info" | "warning" | "critical";
        status: "new" | "acknowledged" | "resolved";
        occurrence_count: number;
        last_seen_at: string;
      }>;
    }>("/api/local/governance-alerts");
    setGovernanceAlerts(alertData.items);
  }

  async function loadGovernanceAlertFollowUps() {
    const followUpData = await fetchJson<{ total: number; items: GovernanceAlertFollowUp[] }>(
      "/api/local/governance-alerts/follow-ups"
    );
    setGovernanceAlertFollowUps(followUpData.items);
  }

  async function loadGovernanceAlertAudits(alertId: string) {
    const payload = await fetchJson<{ items: SkillAuditEntry[] }>(
      `/api/local/governance-alerts/${encodeURIComponent(alertId)}/audits`
    );
    setSelectedGovernanceAlertAudits(payload.items);
  }

  async function loadSkillReviewQueue() {
    const queueData = await fetchJson<{ items: CanonicalSkillEntry[] }>("/api/local/skills/review-queue");
    setSkillReviewQueue(queueData.items);
  }

  async function loadBundleHistory(bundleName?: string) {
    const search = new URLSearchParams();
    if (bundleName && bundleName.trim().length > 0) {
      search.set("bundle_name", bundleName.trim());
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    const historyData = await fetchJson<{ items: BundleProvenanceEvent[] }>(`/api/local/skills/bundle-history${suffix}`);
    setBundleHistory(historyData.items);
  }

  async function loadSkillPolicyDiagnostics() {
    const policyData = await fetchJson<SkillPolicyDiagnostics>("/api/local/skills/policy");
    setSkillPolicyDiagnostics(policyData);
  }

  async function loadSkillPolicyScopes() {
    const policyScopeData = await fetchJson<{ items: SkillPolicyScopeEntry[] }>("/api/local/skills/policy/scopes");
    setSkillPolicyScopes(policyScopeData.items);
  }

  async function loadPolicyAudits() {
    const auditData = await fetchJson<{ items: PolicyAuditEntry[] }>("/api/local/skills/policy/audits");
    setPolicyAudits(auditData.items);
  }

  async function loadPolicyProposals() {
    const proposalData = await fetchJson<{ items: PolicyProposalEntry[] }>("/api/local/skills/policy/proposals");
    setPolicyProposals(proposalData.items);
  }

  async function loadPolicyProposalQueues() {
    const queueData = await fetchJson<{ total: number; queues: PolicyProposalQueue[] }>("/api/local/skills/policy/proposals/queues");
    setPolicyProposalQueues(queueData.queues);
  }

  async function loadPolicyProposalFollowUps() {
    const followUpData = await fetchJson<{ total: number; items: PolicyProposalFollowUp[] }>("/api/local/skills/policy/proposals/follow-ups");
    setPolicyProposalFollowUps(followUpData.items);
  }

  async function executePolicyProposalFollowUp(followUpId: string) {
    try {
      const payload = await fetchJson<{ follow_up: PolicyProposalFollowUp; task: TaskSummary }>(
        `/api/local/skills/policy/proposals/follow-ups/${encodeURIComponent(followUpId)}/execute`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole
          })
        }
      );
      setSkillExchangeMessage(`Executed follow-up '${payload.follow_up.title}' and created task ${payload.task.task_id}.`);
      await Promise.all([loadOverview(), loadPolicyProposalFollowUps()]);
      await navigateToDesktopTarget({ kind: "task", taskId: payload.task.task_id }, { source: "workspace_click" });
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function executeGovernanceAlertFollowUp(followUpId: string) {
    try {
      const payload = await fetchJson<{ follow_up: GovernanceAlertFollowUp; governance_alert: GovernanceAlertEntry; task: TaskSummary }>(
        `/api/local/governance-alerts/follow-ups/${encodeURIComponent(followUpId)}/execute`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole
          })
        }
      );
      setSkillExchangeMessage(`Executed governance follow-up '${payload.follow_up.title}' and created task ${payload.task.task_id}.`);
      await Promise.all([loadOverview(), loadGovernanceAlertFollowUps()]);
      await navigateToDesktopTarget({ kind: "task", taskId: payload.task.task_id }, { source: "workspace_click" });
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function updateInboxItem(inboxId: string, action: "ack" | "resolve") {
    try {
      await fetchJson<{ state: { status: string } }>(`/api/local/inbox/${encodeURIComponent(inboxId)}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole
        })
      });
      setSkillExchangeMessage(`${action === "ack" ? "Acknowledged" : "Resolved"} inbox item ${inboxId}.`);
      await loadOverview();
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function loadPolicyApprovalTemplates() {
    const templateData = await fetchJson<PolicyApprovalTemplates>("/api/local/skills/policy/approval-templates");
    setPolicyApprovalTemplates(templateData);
  }

  async function loadPolicyReleaseHistory() {
    const releaseData = await fetchJson<{ items: PolicyAuditEntry[] }>("/api/local/skills/policy/release-history");
    setPolicyReleaseHistory(releaseData.items);
  }

  async function loadPolicyEnvironmentSnapshots() {
    const snapshotData = await fetchJson<{ items: PolicyEnvironmentSnapshot[] }>("/api/local/skills/policy/environment-snapshots");
    setPolicyEnvironmentSnapshots(snapshotData.items);
  }

  async function loadSkillAudits(skillId: string) {
    const auditData = await fetchJson<{ skill_id: string; items: SkillAuditEntry[] }>(
      `/api/local/skills/${encodeURIComponent(skillId)}/audits`
    );
    setSelectedSkillAudits(auditData.items);
  }

  async function refreshCanonicalSkills(selectedSkillHint?: string | null) {
    await Promise.all([
      loadCanonicalSkills(),
      loadSkillReviewQueue(),
      loadBundleHistory(),
      loadSkillPolicyDiagnostics(),
      loadSkillPolicyScopes(),
      loadPolicyAudits(),
        loadPolicyProposals(),
        loadPolicyProposalQueues(),
        loadPolicyProposalFollowUps(),
        loadGovernanceAlertFollowUps(),
        loadPolicyApprovalTemplates(),
      loadPolicyReleaseHistory(),
      loadPolicyEnvironmentSnapshots()
    ]);
    if (selectedSkillHint) {
      setSelectedSkillId(selectedSkillHint);
    }
  }

  async function ensureDemo() {
    await fetchJson<{ tasks: TaskSummary[] }>("/api/local/bootstrap-demo", { method: "POST" });
    await loadOverview();
  }

  useEffect(() => {
    ensureDemo().catch(cause => setError((cause as Error).message));
  }, []);

  useEffect(() => {
    refreshDesktopManagerState().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedTaskId || controlPlaneState !== "connected") return;
    loadWorkspace(selectedTaskId).catch(cause => setError((cause as Error).message));
  }, [selectedTaskId, controlPlaneState]);

  useEffect(() => {
    if (controlPlaneState !== "connected") return;
    loadCanonicalSkills().catch(() => setCanonicalSkills([]));
  }, [controlPlaneState, skillSearchQuery, skillSourceFilter, skillStatusFilter]);

  useEffect(() => {
    if (controlPlaneState !== "connected") return;
    loadSkillReviewQueue().catch(() => setSkillReviewQueue([]));
  }, [controlPlaneState]);

  useEffect(() => {
    if (controlPlaneState !== "connected") return;
    loadBundleHistory().catch(() => setBundleHistory([]));
  }, [controlPlaneState]);

  useEffect(() => {
    if (controlPlaneState !== "connected") return;
    loadSkillPolicyDiagnostics().catch(() => setSkillPolicyDiagnostics(null));
  }, [controlPlaneState]);

  useEffect(() => {
    if (controlPlaneState !== "connected") return;
    loadSkillPolicyScopes().catch(() => setSkillPolicyScopes([]));
  }, [controlPlaneState]);

  useEffect(() => {
    if (controlPlaneState !== "connected") return;
    loadPolicyAudits().catch(() => setPolicyAudits([]));
    loadPolicyProposals().catch(() => setPolicyProposals([]));
    loadPolicyProposalQueues().catch(() => setPolicyProposalQueues([]));
    loadPolicyProposalFollowUps().catch(() => setPolicyProposalFollowUps([]));
    loadPolicyApprovalTemplates().catch(() => setPolicyApprovalTemplates(null));
    loadPolicyReleaseHistory().catch(() => setPolicyReleaseHistory([]));
    loadPolicyEnvironmentSnapshots().catch(() => setPolicyEnvironmentSnapshots([]));
  }, [controlPlaneState]);

  useEffect(() => {
    const selected = skillPolicyScopes.find(item => item.scope === selectedPolicyScope);
    if (!selected) {
      return;
    }
    setPolicyEditorPath(selected.path ?? "");
    setPolicyEditorContent(JSON.stringify(selected.config, null, 2));
  }, [skillPolicyScopes, selectedPolicyScope]);

  useEffect(() => {
    setPolicyDiffPreview("");
  }, [selectedPolicyScope, policyEditorContent, policyEditorPath, skillActorRole]);

  useEffect(() => {
    setPolicyBundlePreview("");
  }, [policyBundlePath, skillActorRole]);

  useEffect(() => {
    setPolicyCompareResult(null);
    setPolicyComparePreview("");
  }, [policyCompareFromScope, policyCompareToScope]);

  useEffect(() => {
    setPolicyComparePreview("");
  }, [policyCompareFromScope, policyCompareToScope]);

  useEffect(() => {
    const matching = policyAudits.find(
      item => item.payload?.scope === selectedPolicyScope && item.action === "skill.policy_scope_updated"
    );
    setSelectedPolicyRollbackAuditId(typeof matching?.audit_id === "string" ? matching.audit_id : "");
  }, [policyAudits, selectedPolicyScope]);

  useEffect(() => {
    setSkillExportPreview("");
  }, [selectedSkillId, skillExportFormat]);

  useEffect(() => {
    setBundleExportPreview("");
  }, [bundleExportStatuses.join(","), bundleExportPath, bundlePublisherId, bundlePublisherName, bundleSourceEnvironment, bundleReleaseChannel, bundlePromotionNote]);

  useEffect(() => {
    setBundlePolicySimulationPreview("");
  }, [bundleImportPath, skillActorRole]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      loadHealth()
        .then(healthData => {
          if (RUNTIME_INFO.mode === "tauri") {
            refreshDesktopManagerState().catch(() => undefined);
          }
          if (healthData?.status === "ok" && !dashboard) {
            loadOverview().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(handle);
  }, [dashboard]);

  useEffect(() => {
    if (controlPlaneState !== "connected") {
      return;
    }
    loadOverview().catch(cause => setError((cause as Error).message));
  }, [inboxSeverityFilter, inboxKindFilter, inboxStatusFilter]);

  useEffect(() => {
    persistDesktopNotificationPreference(desktopNotificationPreference);
  }, [desktopNotificationPreference]);

  useEffect(() => {
    persistDeliveredInboxAlertKeys(deliveredInboxAlertKeys);
  }, [deliveredInboxAlertKeys]);

  useEffect(() => {
    persistDismissedDesktopNavigationRiskIds(dismissedDesktopNavigationRiskIds);
  }, [dismissedDesktopNavigationRiskIds]);

  useEffect(() => {
    let cancelled = false;
    getDesktopNotificationCapability()
      .then(capability => {
        if (cancelled) {
          return;
        }
        setDesktopNotificationCapability(capability);
        if (capability.mode === "tauri_native_fallback" && capability.native_supported) {
          setDesktopNotificationPermission("native");
          return;
        }
        if (typeof Notification === "undefined") {
          setDesktopNotificationPermission("unsupported");
          return;
        }
        setDesktopNotificationPermission(Notification.permission);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        if (typeof Notification === "undefined") {
          setDesktopNotificationPermission("unsupported");
          return;
        }
        setDesktopNotificationPermission(Notification.permission);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTask = useMemo(
    () => tasks.find(task => task.task_id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );
  const selectedAgentTeamLauncher = useMemo(
    () => agentTeamLauncherCatalog.find(item => item.launcher_kind === agentTeamLauncherKind) ?? null,
    [agentTeamLauncherCatalog, agentTeamLauncherKind]
  );
  const availableAgentTeamLauncherDrivers = useMemo(
    () => agentTeamLauncherDriverCatalog.filter(item => item.launcher_kind === agentTeamLauncherKind),
    [agentTeamLauncherDriverCatalog, agentTeamLauncherKind]
  );
  const selectedAgentTeamLauncherDriver = useMemo(
    () => availableAgentTeamLauncherDrivers.find(item => item.driver_id === agentTeamLauncherDriverId) ?? null,
    [availableAgentTeamLauncherDrivers, agentTeamLauncherDriverId]
  );
  const selectedAgentTeamLauncherStatus = useMemo(
    () => agentTeamLauncherStatuses.find(item => item.launcher_kind === agentTeamLauncherKind) ?? null,
    [agentTeamLauncherStatuses, agentTeamLauncherKind]
  );
  const selectedAgentTeamLauncherDriverStatus = useMemo(
    () => agentTeamLauncherDriverStatuses.find(item => item.driver_id === agentTeamLauncherDriverId) ?? null,
    [agentTeamLauncherDriverStatuses, agentTeamLauncherDriverId]
  );
  const selectedAgentTeamLauncherBackendAdapter = useMemo(
    () =>
      agentTeamLauncherBackendAdapterCatalog.find(item => item.supported_driver_ids.includes(agentTeamLauncherDriverId))
      ?? null,
    [agentTeamLauncherBackendAdapterCatalog, agentTeamLauncherDriverId]
  );
  const selectedAgentTeamLauncherBackendAdapterStatus = useMemo(
    () =>
      selectedAgentTeamLauncherBackendAdapter
        ? agentTeamLauncherBackendAdapterStatuses.find(
            item => item.adapter_id === selectedAgentTeamLauncherBackendAdapter.adapter_id
          ) ?? null
        : null,
    [agentTeamLauncherBackendAdapterStatuses, selectedAgentTeamLauncherBackendAdapter]
  );
  const currentDesktopTarget = useMemo<DesktopDeepLinkTarget | null>(() => {
    if (highlightedPolicyProposalId) {
      return { kind: "policy_proposal", proposalId: highlightedPolicyProposalId };
    }
    if (highlightedPolicyFollowUpId) {
      return { kind: "policy_follow_up", followUpId: highlightedPolicyFollowUpId };
    }
    if (highlightedInboxId) {
      return { kind: "inbox", inboxId: highlightedInboxId };
    }
    if (highlightedExecutionPlaybookId && selectedTaskId) {
      return { kind: "learned_playbook", taskId: selectedTaskId, playbookId: highlightedExecutionPlaybookId };
    }
    if (highlightedExecutionTemplateId && selectedTaskId) {
      return { kind: "execution_template", taskId: selectedTaskId, templateId: highlightedExecutionTemplateId };
    }
    if (selectedTaskId) {
      return { kind: "task", taskId: selectedTaskId };
    }
    return null;
  }, [
    highlightedExecutionPlaybookId,
    highlightedExecutionTemplateId,
    highlightedInboxId,
    highlightedPolicyFollowUpId,
    highlightedPolicyProposalId,
    selectedTaskId
  ]);
  const currentDesktopLink = useMemo(
    () => (currentDesktopTarget ? buildDesktopDeepLinkUrl(currentDesktopTarget) : null),
    [currentDesktopTarget]
  );
  const governanceAlertsById = useMemo(
    () => new Map(governanceAlerts.map(alert => [alert.alert_id, alert])),
    [governanceAlerts]
  );
  const priorityInboxItems = useMemo(
    () => inboxItems.filter(item => item.state === "new" && (item.severity === "critical" || item.severity === "warning")),
    [inboxItems]
  );
  const selectedCanonicalSkill = useMemo(
    () => canonicalSkills.find(skill => skill.skill_id === selectedSkillId) ?? canonicalSkills[0] ?? null,
    [canonicalSkills, selectedSkillId]
  );
  const selectedExecutionPlaybook = useMemo(
    () =>
      workspace?.executionTemplate?.related_playbooks.find(playbook => playbook.candidate_id === selectedExecutionPlaybookId)
      ?? workspace?.executionTemplate?.related_playbooks[0]
      ?? null,
    [workspace?.executionTemplate?.related_playbooks, selectedExecutionPlaybookId]
  );
  const desktopNotificationDeliveryMode = useMemo(() => {
    if (desktopNotificationCapability.mode === "tauri_native_fallback" && desktopNotificationCapability.native_supported) {
      return "native";
    }
    if (desktopNotificationPermission === "granted") {
      return "web";
    }
    return "unsupported";
  }, [desktopNotificationCapability, desktopNotificationPermission]);
  const combinedDesktopNavigationEvents = useMemo(() => {
    type CombinedNavigationEvent = DesktopNavigationEvent & { sort_value: number };
    const localEvents = desktopNavigationEvents.map(event => ({
      ...event,
      sort_value: new Date(event.recorded_at).getTime()
    }));
    const systemEvents = desktopSystemNavigationEvents.map(event => {
      const target = parseDesktopDeepLink(event.deep_link);
      if (!target) {
        return null;
      }
      return {
        event_id: event.event_id,
        source: event.source as DesktopNavigationSource,
        target,
        recorded_at: event.recorded_at,
        sort_value: Number(event.recorded_at)
      };
    });
    const resolvedSystemEvents = systemEvents.filter(
      (event): event is CombinedNavigationEvent => event !== null
    );
    return [...localEvents, ...resolvedSystemEvents]
      .sort((left, right) => right.sort_value - left.sort_value)
      .slice(0, 8);
  }, [desktopNavigationEvents, desktopSystemNavigationEvents]);
  const filteredDesktopNavigationEvents = useMemo(() => {
    const now = Date.now();
    const minimumTimestamp =
      desktopNavigationTimeRangeFilter === "5m"
        ? now - 5 * 60 * 1000
        : desktopNavigationTimeRangeFilter === "1h"
          ? now - 60 * 60 * 1000
          : desktopNavigationTimeRangeFilter === "24h"
            ? now - 24 * 60 * 60 * 1000
            : Number.NEGATIVE_INFINITY;
    return combinedDesktopNavigationEvents.filter(event => {
      const sourceMatches =
        desktopNavigationSourceFilter === "all" ||
        classifyDesktopNavigationSource(event.source) === desktopNavigationSourceFilter;
      const targetMatches =
        desktopNavigationTargetFilter === "all" ||
        classifyDesktopNavigationTarget(event.target) === desktopNavigationTargetFilter;
      const reuseMatches =
        desktopNavigationReuseFilter === "all" ||
        classifyDesktopNavigationTarget(event.target) !== "reuse" ||
        classifyDesktopNavigationReuseTarget(event.target) === desktopNavigationReuseFilter;
      const timeMatches = new Date(event.recorded_at).getTime() >= minimumTimestamp;
      return sourceMatches && targetMatches && reuseMatches && timeMatches;
    });
  }, [
    combinedDesktopNavigationEvents,
    desktopNavigationSourceFilter,
    desktopNavigationTargetFilter,
    desktopNavigationReuseFilter,
    desktopNavigationTimeRangeFilter
  ]);
  const desktopNavigationSummary = useMemo(
    () => ({
      workspace: combinedDesktopNavigationEvents.filter(
        event => classifyDesktopNavigationSource(event.source) === "workspace"
      ).length,
      browser: combinedDesktopNavigationEvents.filter(
        event => classifyDesktopNavigationSource(event.source) === "browser"
      ).length,
      system: combinedDesktopNavigationEvents.filter(
        event => classifyDesktopNavigationSource(event.source) === "system"
      ).length
    }),
    [combinedDesktopNavigationEvents]
  );
  const desktopNavigationTargetSummary = useMemo(
    () => ({
      task: filteredDesktopNavigationEvents.filter(event => classifyDesktopNavigationTarget(event.target) === "task").length,
      inbox: filteredDesktopNavigationEvents.filter(event => classifyDesktopNavigationTarget(event.target) === "inbox").length,
      policy: filteredDesktopNavigationEvents.filter(event => classifyDesktopNavigationTarget(event.target) === "policy").length,
      reuse: filteredDesktopNavigationEvents.filter(event => classifyDesktopNavigationTarget(event.target) === "reuse").length
    }),
    [filteredDesktopNavigationEvents]
  );
  const desktopNavigationReuseSummary = useMemo(
    () => ({
      execution_template: filteredDesktopNavigationEvents.filter(
        event => classifyDesktopNavigationReuseTarget(event.target) === "execution_template"
      ).length,
      learned_playbook: filteredDesktopNavigationEvents.filter(
        event => classifyDesktopNavigationReuseTarget(event.target) === "learned_playbook"
      ).length
    }),
    [filteredDesktopNavigationEvents]
  );
  const desktopNavigationRiskSummary = useMemo(() => {
    const risks: DesktopNavigationRiskItem[] = [];
    const systemEvents = filteredDesktopNavigationEvents.filter(
      event => classifyDesktopNavigationSource(event.source) === "system"
    );
    const workspaceEvents = filteredDesktopNavigationEvents.filter(
      event => classifyDesktopNavigationSource(event.source) === "workspace"
    );
    if (systemEvents.length >= 3 && systemEvents.length > workspaceEvents.length) {
      const dominantTarget = systemEvents[0]?.target;
      risks.push({
        risk_id: "system_navigation_dominant",
        severity: "warning",
        title: "System-driven navigation is dominating",
        detail:
          "Recent focus changes are mostly coming from startup, handoff, or other system paths instead of explicit workspace actions.",
        recommended_action: "Create an ops task to review desktop handoff sources and reduce unexpected system-triggered focus changes.",
        target: dominantTarget
      });
    }
    const repeatedTargets = new Map<string, { count: number; target: DesktopDeepLinkTarget }>();
    for (const event of systemEvents) {
      const key = serializeDesktopDeepLink(event.target);
      const existing = repeatedTargets.get(key);
      repeatedTargets.set(key, {
        count: (existing?.count ?? 0) + 1,
        target: event.target
      });
    }
    const repeatedTarget = [...repeatedTargets.entries()].find(([, entry]) => entry.count >= 3);
    if (repeatedTarget) {
      risks.push({
        risk_id: `repeated_target:${repeatedTarget[0]}`,
        severity: "critical",
        title: "Repeated system handoff detected",
        detail: `The same target ${repeatedTarget[0]} was injected by system entry paths ${repeatedTarget[1].count} times in the current window.`,
        recommended_action: "Create a high-priority ops task and review protocol/single-instance handoff behavior before promoting the current desktop flow.",
        target: repeatedTarget[1].target
      });
    }
    const reuseEvents = filteredDesktopNavigationEvents.filter(
      event => classifyDesktopNavigationTarget(event.target) === "reuse"
    );
    const repeatedReuseTargets = new Map<string, { count: number; target: DesktopDeepLinkTarget }>();
    for (const event of reuseEvents) {
      const key = serializeDesktopDeepLink(event.target);
      const existing = repeatedReuseTargets.get(key);
      repeatedReuseTargets.set(key, {
        count: (existing?.count ?? 0) + 1,
        target: event.target
      });
    }
    const repeatedReuseTarget = [...repeatedReuseTargets.entries()].find(([, entry]) => entry.count >= 3);
    if (repeatedReuseTarget) {
      risks.push({
        risk_id: `repeated_reuse_target:${repeatedReuseTarget[0]}`,
        severity: "warning",
        title: "Repeated reuse-detail review detected",
        detail: `The same ${describeDesktopNavigationReuseTarget(repeatedReuseTarget[1].target).toLowerCase()} target was opened ${repeatedReuseTarget[1].count} times in the current window.`,
        recommended_action: "Create an ops task to review whether the current template or learned playbook needs clearer guidance, stronger applicability rules, or a safer default path.",
        target: repeatedReuseTarget[1].target
      });
    }
    if (reuseEvents.length >= 4 && desktopNavigationTargetSummary.task <= reuseEvents.length) {
      const dominantReuseTarget = reuseEvents[0]?.target;
      risks.push({
        risk_id: "reuse_navigation_dominant",
        severity: "warning",
        title: "Reuse-detail review is dominating the current window",
        detail:
          "Recent desktop navigation is spending more time on execution-template and learned-playbook detail panels than on task execution views.",
        recommended_action: "Consider capturing a governance follow-up or updating the learned template so operators do not need to repeatedly re-open the same reuse context.",
        target: dominantReuseTarget
      });
    }
    return risks;
  }, [desktopNavigationTargetSummary.task, filteredDesktopNavigationEvents]);
  const activeDesktopNavigationRisks = useMemo(
    () =>
      desktopNavigationRiskSummary.filter(risk => !dismissedDesktopNavigationRiskIds.includes(risk.risk_id)),
    [desktopNavigationRiskSummary, dismissedDesktopNavigationRiskIds]
  );
  const dismissedDesktopNavigationRiskCount = desktopNavigationRiskSummary.length - activeDesktopNavigationRisks.length;
  const activePriorityInboxAlertKeys = useMemo(
    () =>
      priorityInboxItems.map(item =>
        buildInboxNotificationDeliveryKey(
          item,
          item.kind === "governance_alert" && item.source_id ? governanceAlertsById.get(item.source_id) ?? null : null
        )
      ),
    [governanceAlertsById, priorityInboxItems]
  );

  useEffect(() => {
    setDeliveredInboxAlertKeys(previous =>
      previous.filter(key => activePriorityInboxAlertKeys.includes(key))
    );
  }, [activePriorityInboxAlertKeys]);

  useEffect(() => {
    if (desktopNotificationPreference !== "enabled") {
      return;
    }
    if (desktopNotificationDeliveryMode === "unsupported") {
      return;
    }
    let cancelled = false;
    const run = async () => {
      const pendingAlerts = priorityInboxItems
        .map(item => ({
          item,
          deliveryKey: buildInboxNotificationDeliveryKey(
            item,
            item.kind === "governance_alert" && item.source_id ? governanceAlertsById.get(item.source_id) ?? null : null
          )
        }))
        .filter(entry => !deliveredInboxAlertKeys.includes(entry.deliveryKey));
      if (pendingAlerts.length === 0) {
        return;
      }
      const deliveredNow: string[] = [];
      for (const { item, deliveryKey } of pendingAlerts.slice(0, 3)) {
        try {
          if (desktopNotificationDeliveryMode === "native") {
            await sendNativeDesktopNotification(item.title, `${item.severity.toUpperCase()} - ${item.message}`);
          } else {
            const notification = new Notification(item.title, {
              body: `${item.severity.toUpperCase()} - ${item.message}`,
              tag: item.inbox_id
            });
            notification.onclick = () => {
              focusInboxWorkflow(item, "browser_notification").catch(() => undefined);
            };
          }
          deliveredNow.push(deliveryKey);
        } catch {
          break;
        }
      }
      if (!cancelled && deliveredNow.length > 0) {
        setDeliveredInboxAlertKeys(previous => [...new Set([...previous, ...deliveredNow])]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    desktopNotificationDeliveryMode,
    desktopNotificationPreference,
    deliveredInboxAlertKeys,
    governanceAlertsById,
    priorityInboxItems
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const applyHashTarget = () => {
      const target = parseDesktopDeepLink(window.location.hash);
      if (!target) return;
      navigateToDesktopTarget(target, { source: "hash_change" }).catch(() => undefined);
    };
    applyHashTarget();
    window.addEventListener("hashchange", applyHashTarget);
    return () => window.removeEventListener("hashchange", applyHashTarget);
  }, [inboxItems, policyProposalFollowUps, policyProposals, tasks]);

  useEffect(() => {
    let cancelled = false;
    getInitialDesktopDeepLink()
      .then(initialHash => {
        if (cancelled || !initialHash || typeof window === "undefined") {
          return;
        }
        if (!window.location.hash) {
          window.history.replaceState(null, "", initialHash);
        }
        const target = parseDesktopDeepLink(initialHash);
        if (target) {
          navigateToDesktopTarget(target, { source: "startup_deep_link" }).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (RUNTIME_INFO.mode !== "tauri") {
      return;
    }
    const handle = window.setInterval(() => {
      consumePendingDesktopDeepLink()
        .then(pendingHash => {
          if (!pendingHash) {
            return;
          }
          const target = parseDesktopDeepLink(pendingHash);
          if (target) {
            navigateToDesktopTarget(target, { focusWindow: true, source: "pending_deep_link" }).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(handle);
  }, [inboxItems, policyProposalFollowUps, policyProposals, tasks]);

  useEffect(() => {
    if (RUNTIME_INFO.mode !== "tauri") {
      setDesktopSystemNavigationEvents([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const events = await getDesktopNavigationEvents();
        if (!cancelled) {
          setDesktopSystemNavigationEvents(events);
        }
      } catch {
        if (!cancelled) {
          setDesktopSystemNavigationEvents([]);
        }
      }
    };
    void load();
    const handle = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDesktopNavigationEventPolicy()
      .then(policy => {
        if (!cancelled) {
          setDesktopNavigationEventPolicy(policy);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCanonicalSkill || controlPlaneState !== "connected") {
      setSelectedSkillAudits([]);
      return;
    }
    loadSkillAudits(selectedCanonicalSkill.skill_id).catch(() => setSelectedSkillAudits([]));
  }, [selectedCanonicalSkill?.skill_id, controlPlaneState]);
  useEffect(() => {
    if (!selectedGovernanceAlertId || controlPlaneState !== "connected") {
      setSelectedGovernanceAlertAudits([]);
      return;
    }
    loadGovernanceAlertAudits(selectedGovernanceAlertId).catch(() => setSelectedGovernanceAlertAudits([]));
  }, [selectedGovernanceAlertId, controlPlaneState]);
  useEffect(() => {
    const playbooks = workspace?.executionTemplate?.related_playbooks ?? [];
    if (playbooks.length === 0) {
      setSelectedExecutionPlaybookId(null);
      return;
    }
    if (!playbooks.some(playbook => playbook.candidate_id === selectedExecutionPlaybookId)) {
      setSelectedExecutionPlaybookId(playbooks[0]?.candidate_id ?? null);
    }
  }, [workspace?.executionTemplate?.related_playbooks, selectedExecutionPlaybookId]);
  useEffect(() => {
    if (!pendingWorkspaceTarget || !workspace || workspace.task.task_id !== pendingWorkspaceTarget.taskId) {
      return;
    }
    if (pendingWorkspaceTarget.kind === "execution_template") {
      setHighlightedExecutionTemplateId(pendingWorkspaceTarget.templateId);
      setHighlightedExecutionPlaybookId(null);
      window.setTimeout(() => {
        executionTemplateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      setPendingWorkspaceTarget(null);
      return;
    }
    setSelectedExecutionPlaybookId(pendingWorkspaceTarget.playbookId);
    setHighlightedExecutionPlaybookId(pendingWorkspaceTarget.playbookId);
    setHighlightedExecutionTemplateId(null);
    window.setTimeout(() => {
      executionPlaybookRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    setPendingWorkspaceTarget(null);
  }, [pendingWorkspaceTarget, workspace]);
  const canonicalSkillGroups = useMemo(() => {
    const groups = new Map<CanonicalSkillEntry["source"], CanonicalSkillEntry[]>();
    for (const skill of canonicalSkills) {
      const list = groups.get(skill.source) ?? [];
      list.push(skill);
      groups.set(skill.source, list);
    }
    return [...groups.entries()];
  }, [canonicalSkills]);

  const canOperate = controlPlaneState === "connected";

  async function handleStartLocalControlPlane() {
    await manageLocalControlPlane("start-local-control-plane", () => startLocalControlPlane(), true);
  }

  async function handleStopLocalControlPlane() {
    await manageLocalControlPlane("stop-local-control-plane", () => stopLocalControlPlane(), false);
  }

  async function handleRestartLocalControlPlane() {
    await manageLocalControlPlane("restart-local-control-plane", () => restartLocalControlPlane(), true);
  }

  async function enableDesktopNotifications() {
    if (desktopNotificationCapability.mode === "tauri_native_fallback" && desktopNotificationCapability.native_supported) {
      setDesktopNotificationPermission("native");
      setDesktopNotificationPreference("enabled");
      setNotice("Desktop notifications enabled through the native Tauri fallback.");
      return;
    }
    if (typeof Notification === "undefined") {
      setNotice("Desktop notifications are not supported in this runtime.");
      setDesktopNotificationPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setDesktopNotificationPermission(permission);
    setDesktopNotificationPreference(permission === "granted" ? "enabled" : "disabled");
    setNotice(
      permission === "granted"
        ? "Desktop notifications enabled for priority inbox items."
        : "Desktop notifications were not granted."
    );
  }

  function disableDesktopNotifications() {
    setDesktopNotificationPreference("disabled");
    setNotice("Desktop notifications disabled.");
  }

  function setDesktopDeepLink(target: DesktopDeepLinkTarget) {
    if (typeof window === "undefined") return;
    const nextHash = serializeDesktopDeepLink(target);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  function recordDesktopNavigationEvent(source: DesktopNavigationSource, target: DesktopDeepLinkTarget) {
    const entry: DesktopNavigationEvent = {
      event_id: `nav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source,
      target,
      recorded_at: new Date().toISOString()
    };
    setDesktopNavigationEvents(previous => [entry, ...previous].slice(0, 12));
  }

  async function copyDesktopDeepLink(target: DesktopDeepLinkTarget, label?: string) {
    const link = buildDesktopDeepLinkUrl(target);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error("The runtime did not allow the link to be copied.");
        }
      } else {
        throw new Error("Clipboard access is not available in this runtime.");
      }
      setNotice(`Copied link for ${label ?? describeDesktopDeepLinkTarget(target)}.`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function copyJsonPayload(payload: unknown, label: string) {
    const serialized = JSON.stringify(payload, null, 2);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(serialized);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = serialized;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error("The runtime did not allow the payload to be copied.");
        }
      } else {
        throw new Error("Clipboard access is unavailable in the current runtime.");
      }
      setNotice(`${label} payload copied.`);
    } catch (error) {
      setNotice(`Could not copy ${label.toLowerCase()} payload: ${(error as Error).message}`);
    }
  }

  async function replayDesktopNavigationEvent(event: DesktopNavigationEvent) {
    await navigateToDesktopTarget(event.target, {
      focusWindow: true,
      source: "system_focus"
    });
    setNotice(`Replayed desktop event from ${describeDesktopNavigationSource(event.source)}.`);
  }

  function dismissDesktopNavigationRisk(riskId: string) {
    setDismissedDesktopNavigationRiskIds(previous => [...new Set([...previous, riskId])]);
    setNotice("Desktop navigation risk dismissed locally.");
  }

  function restoreDismissedDesktopNavigationRisks() {
    setDismissedDesktopNavigationRiskIds([]);
    setNotice("Dismissed desktop navigation risks restored.");
  }

  async function createDesktopNavigationRiskTask(risk: DesktopNavigationRiskItem) {
    if (!canOperate) return;
    setBusyAction(`desktop-risk:${risk.risk_id}`);
    setError(null);
    setNotice(null);
    try {
      const created = await fetchJson<{ governance_alert: { alert_id: string }; inbox_item?: InboxItem }>(
        "/api/local/governance-alerts/desktop-navigation",
        {
        method: "POST",
        body: JSON.stringify({
            risk_id: risk.risk_id,
            severity: risk.severity,
            title: risk.title,
            detail: `${risk.detail} Window: ${describeDesktopNavigationTimeRange(desktopNavigationTimeRangeFilter)} / source filter: ${desktopNavigationSourceFilter}.`,
            recommended_action: risk.recommended_action,
            target: risk.target
          })
        }
      );
      await loadOverview();
      await loadGovernanceAlerts().catch(() => undefined);
      if (created.inbox_item) {
        await navigateToDesktopTarget({ kind: "inbox", inboxId: created.inbox_item.inbox_id }, { source: "workspace_click" });
      } else if (risk.target) {
        await navigateToDesktopTarget(risk.target, { source: "workspace_click" });
      }
      setDismissedDesktopNavigationRiskIds(previous => [...new Set([...previous, risk.risk_id])]);
      setNotice("Desktop navigation risk was sent to the governance inbox.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function executeInboxItemAction(item: InboxItem) {
    setBusyAction(`inbox-execute:${item.inbox_id}`);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ task: TaskSummary }>(`/api/local/inbox/${encodeURIComponent(item.inbox_id)}/execute`, {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole
        })
      });
      await loadOverview();
      await loadGovernanceAlerts().catch(() => undefined);
      setSelectedTaskId(payload.task.task_id);
      await loadWorkspace(payload.task.task_id).catch(() => undefined);
      await navigateToDesktopTarget({ kind: "task", taskId: payload.task.task_id }, { source: "workspace_click" });
      setNotice(`Executed inbox item ${item.title} and created task ${payload.task.task_id}.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function navigateToDesktopTarget(
    target: DesktopDeepLinkTarget,
    options?: { focusWindow?: boolean; source?: DesktopNavigationSource }
  ) {
    if (options?.focusWindow) {
      await focusDesktopWindow().catch(() => undefined);
    }
    recordDesktopNavigationEvent(options?.source ?? "workspace_click", target);
    setDesktopDeepLink(target);
    if (target.kind === "task") {
      setHighlightedExecutionTemplateId(null);
      setHighlightedExecutionPlaybookId(null);
      setPendingWorkspaceTarget(null);
      setSelectedTaskId(target.taskId);
      setNotice(`Focused task ${target.taskId}.`);
      return;
    }
    if (target.kind === "inbox") {
      setHighlightedExecutionTemplateId(null);
      setHighlightedExecutionPlaybookId(null);
      setPendingWorkspaceTarget(null);
      const item = inboxItems.find(candidate => candidate.inbox_id === target.inboxId);
      if (!item) {
        setNotice(`Inbox item ${target.inboxId} is no longer available.`);
        return;
      }
      setInboxSeverityFilter(item.severity);
      setInboxKindFilter(item.kind);
      setInboxStatusFilter("all");
      setHighlightedInboxId(item.inbox_id);
      if (item.kind === "policy_follow_up" && item.source_id) {
        setHighlightedPolicyFollowUpId(item.source_id);
        window.setTimeout(() => {
          policyFollowUpsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      } else {
        setHighlightedPolicyFollowUpId(null);
      }
      window.setTimeout(() => {
        inboxPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      setNotice(`Focused inbox item ${item.title}.`);
      return;
    }
    if (target.kind === "policy_follow_up") {
      setHighlightedExecutionTemplateId(null);
      setHighlightedExecutionPlaybookId(null);
      setPendingWorkspaceTarget(null);
      setHighlightedPolicyFollowUpId(target.followUpId);
      setHighlightedInboxId(`inbox_${target.followUpId}`);
      window.setTimeout(() => {
        policyFollowUpsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      setNotice(`Focused policy follow-up ${target.followUpId}.`);
      return;
    }
    if (target.kind === "policy_proposal") {
      setHighlightedExecutionTemplateId(null);
      setHighlightedExecutionPlaybookId(null);
      setPendingWorkspaceTarget(null);
      setHighlightedPolicyProposalId(target.proposalId);
      setSelectedPolicyProposalIds([target.proposalId]);
      window.setTimeout(() => {
        policyProposalQueuesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      setNotice(`Focused policy proposal ${target.proposalId}.`);
      return;
    }
    if (target.kind === "execution_template") {
      setHighlightedInboxId(null);
      setHighlightedPolicyFollowUpId(null);
      setHighlightedPolicyProposalId(null);
      setSelectedTaskId(target.taskId);
      setSelectedExecutionPlaybookId(null);
      setHighlightedExecutionTemplateId(target.templateId);
      setHighlightedExecutionPlaybookId(null);
      setPendingWorkspaceTarget(target);
      if (workspace?.task.task_id === target.taskId) {
        window.setTimeout(() => {
          executionTemplateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
      setNotice(`Focused execution template ${target.templateId}.`);
      return;
    }
    setHighlightedInboxId(null);
    setHighlightedPolicyFollowUpId(null);
    setHighlightedPolicyProposalId(null);
    setSelectedTaskId(target.taskId);
    setSelectedExecutionPlaybookId(target.playbookId);
    setHighlightedExecutionPlaybookId(target.playbookId);
    setHighlightedExecutionTemplateId(null);
    setPendingWorkspaceTarget(target);
    if (workspace?.task.task_id === target.taskId) {
      window.setTimeout(() => {
        executionPlaybookRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
    setNotice(`Focused learned playbook ${target.playbookId}.`);
  }

  async function focusInboxWorkflow(
    item: InboxItem,
    source: DesktopNavigationSource = "follow_up_focus"
  ) {
    await navigateToDesktopTarget({ kind: "inbox", inboxId: item.inbox_id }, { focusWindow: true, source });
  }

  async function manageLocalControlPlane(
    action: string,
    handler: () => Promise<LocalControlPlaneManagerState>,
    shouldReloadOverview: boolean
  ) {
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const state = await handler();
      setDesktopManagerState(state);
      await loadHealth();
      if (shouldReloadOverview) {
        window.setTimeout(() => {
          loadOverview().catch(cause => setError((cause as Error).message));
        }, 1500);
      } else {
        setDashboard(null);
        setWorkspace(null);
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(action: "prepare" | "run" | "verify" | "stop" | "resume") {
    if (!selectedTaskId || !canOperate) return;
    setBusyAction(action);
    setError(null);
    try {
      await fetchJson(`/api/local/tasks/${selectedTaskId}/${action}`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await loadOverview();
      await loadWorkspace(selectedTaskId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function requestAgentTeamResume(subagentSessionId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-resume:${subagentSessionId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ request: { request_id: string; status: string } }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/sessions/${encodeURIComponent(subagentSessionId)}/resume`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            reason: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setAgentTeamResumeReason("");
      setNotice(`Created delegated resume request ${payload.request.request_id} (${payload.request.status}).`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function updateAgentTeamResumeRequest(
    requestId: string,
    actionName: "accept" | "complete" | "reject"
  ) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-resume-${actionName}:${requestId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ request: WorkspaceData["agentTeam"]["resumeRequests"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/resume-requests/${encodeURIComponent(requestId)}/${actionName}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setAgentTeamResumeReason("");
      setNotice(`Resume request ${payload.request.request_id} is now ${payload.request.status}.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function applyAgentTeamResumePackage(packageId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-resume-package-apply:${packageId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ package: WorkspaceData["agentTeam"]["resumePackages"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/resume-packages/${encodeURIComponent(packageId)}/apply`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setAgentTeamResumeReason("");
      setNotice(`Resume package ${payload.package.package_id} is now ${payload.package.status}.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function updateAgentTeamExecutionRun(
    executionRunId: string,
    actionName: "complete" | "fail"
  ) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-execution-run-${actionName}:${executionRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ execution_run: WorkspaceData["agentTeam"]["executionRuns"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/execution-runs/${encodeURIComponent(executionRunId)}/${actionName}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setAgentTeamResumeReason("");
      setNotice(`Execution run ${payload.execution_run.execution_run_id} is now ${payload.execution_run.status}.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function bindAgentTeamExecutionRun(executionRunId: string) {
    if (!selectedTaskId || !canOperate) return;
    const selectedLauncher = selectedAgentTeamLauncher;
    const selectedDriver = selectedAgentTeamLauncherDriver;
    if (!selectedLauncher || !selectedDriver) {
      setError("No delegated runtime launcher is currently available.");
      return;
    }
    if (selectedDriver.requires_locator && agentTeamLauncherLocator.trim().length === 0) {
      setError(`Launcher driver '${selectedDriver.label}' requires a locator before binding the delegated runtime.`);
      return;
    }
    const action = `agent-team-execution-run-bind:${executionRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runtime_binding: WorkspaceData["agentTeam"]["runtimeBindings"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/execution-runs/${encodeURIComponent(executionRunId)}/bind`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            runtime_kind: selectedDriver.runtime_kind,
            sandbox_profile: selectedDriver.sandbox_profile,
            launcher_kind: selectedLauncher.launcher_kind,
            launcher_driver_id: selectedDriver.driver_id,
            launcher_locator: agentTeamLauncherLocator.trim() || undefined,
            runtime_locator: agentTeamLauncherLocator.trim() || undefined,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      setNotice(`Runtime binding ${payload.runtime_binding.binding_id} is active.`);
      await loadWorkspace(selectedTaskId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function releaseAgentTeamRuntimeBinding(bindingId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-binding-release:${bindingId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runtime_binding: WorkspaceData["agentTeam"]["runtimeBindings"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-bindings/${encodeURIComponent(bindingId)}/release`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      setNotice(`Runtime binding ${payload.runtime_binding.binding_id} released.`);
      await loadWorkspace(selectedTaskId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function heartbeatAgentTeamRuntimeInstance(instanceId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-instance-heartbeat:${instanceId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runtime_instance: WorkspaceData["agentTeam"]["runtimeInstances"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-instances/${encodeURIComponent(instanceId)}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime instance ${payload.runtime_instance.instance_id} heartbeat recorded.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function launchAgentTeamRuntimeInstance(instanceId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-instance-launch:${instanceId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ launch_receipt: WorkspaceData["agentTeam"]["runtimeLaunchReceipts"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-instances/${encodeURIComponent(instanceId)}/launch`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined,
            launch_locator: agentTeamLauncherLocator.trim() || undefined,
            runtime_locator: agentTeamLauncherLocator.trim() || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime launch receipt ${payload.launch_receipt.receipt_id} recorded.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function startAgentTeamRuntimeAdapter(receiptId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-adapter-start:${receiptId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ adapter_run: WorkspaceData["agentTeam"]["runtimeAdapterRuns"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-launch-receipts/${encodeURIComponent(receiptId)}/start`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime adapter run ${payload.adapter_run.adapter_run_id} started.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function consumeAgentTeamRuntimeLaunchReceipt(receiptId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-receipt-consume:${receiptId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{
        adapter: AgentTeamLauncherBackendAdapterCatalogEntry;
        receipt: WorkspaceData["agentTeam"]["runtimeLaunchReceipts"][number];
        adapter_run: WorkspaceData["agentTeam"]["runtimeAdapterRuns"][number];
      }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-launch-receipts/${encodeURIComponent(receiptId)}/consume`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: "Consumed through launcher backend adapter."
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime launch receipt ${payload.receipt.receipt_id} consumed by ${payload.adapter.adapter_id}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyAction(current => (current === action ? null : current));
    }
  }

  async function heartbeatAgentTeamRuntimeAdapter(adapterRunId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-adapter-heartbeat:${adapterRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ adapter_run: WorkspaceData["agentTeam"]["runtimeAdapterRuns"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(adapterRunId)}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime adapter run ${payload.adapter_run.adapter_run_id} heartbeat recorded.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function finalizeAgentTeamRuntimeAdapter(adapterRunId: string, actionKind: "complete" | "fail") {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-adapter-${actionKind}:${adapterRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ adapter_run: WorkspaceData["agentTeam"]["runtimeAdapterRuns"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(adapterRunId)}/${actionKind}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime adapter run ${payload.adapter_run.adapter_run_id} ${actionKind}d.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function acquireAgentTeamRunnerBackendLease(adapterRunId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-backend-lease-acquire:${adapterRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_backend_lease: WorkspaceData["agentTeam"]["runtimeRunnerBackendLeases"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(adapterRunId)}/acquire-runner-backend-lease`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runner backend lease ${payload.runner_backend_lease.lease_id} allocated.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function finalizeAgentTeamRunnerBackendLease(leaseId: string, actionKind: "release" | "fail") {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-backend-lease-${actionKind}:${leaseId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_backend_lease: WorkspaceData["agentTeam"]["runtimeRunnerBackendLeases"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-runner-backend-leases/${encodeURIComponent(leaseId)}/${actionKind}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runner backend lease ${payload.runner_backend_lease.lease_id} ${actionKind}d.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function startAgentTeamRuntimeBackendExecution(adapterRunId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-backend-start:${adapterRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ backend_execution: WorkspaceData["agentTeam"]["runtimeBackendExecutions"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(adapterRunId)}/execute`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime backend execution ${payload.backend_execution.backend_execution_id} started.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function heartbeatAgentTeamRuntimeBackendExecution(backendExecutionId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-backend-heartbeat:${backendExecutionId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ backend_execution: WorkspaceData["agentTeam"]["runtimeBackendExecutions"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-backend-executions/${encodeURIComponent(backendExecutionId)}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime backend execution ${payload.backend_execution.backend_execution_id} heartbeat recorded.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function finalizeAgentTeamRuntimeBackendExecution(
    backendExecutionId: string,
    actionKind: "complete" | "fail"
  ) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-backend-${actionKind}:${backendExecutionId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ backend_execution: WorkspaceData["agentTeam"]["runtimeBackendExecutions"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-backend-executions/${encodeURIComponent(backendExecutionId)}/${actionKind}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime backend execution ${payload.backend_execution.backend_execution_id} ${actionKind}d.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function startAgentTeamRuntimeDriverRun(backendExecutionId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-driver-start:${backendExecutionId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ driver_run: WorkspaceData["agentTeam"]["runtimeDriverRuns"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-backend-executions/${encodeURIComponent(backendExecutionId)}/start-driver`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime driver run ${payload.driver_run.driver_run_id} started.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function heartbeatAgentTeamRuntimeDriverRun(driverRunId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-driver-heartbeat:${driverRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ driver_run: WorkspaceData["agentTeam"]["runtimeDriverRuns"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(driverRunId)}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime driver run ${payload.driver_run.driver_run_id} heartbeat recorded.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function finalizeAgentTeamRuntimeDriverRun(driverRunId: string, actionKind: "complete" | "fail") {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-driver-${actionKind}:${driverRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ driver_run: WorkspaceData["agentTeam"]["runtimeDriverRuns"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(driverRunId)}/${actionKind}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime driver run ${payload.driver_run.driver_run_id} ${actionKind}d.`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function attachAgentTeamRuntimeRunnerHandle(driverRunId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-attach:${driverRunId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_handle: WorkspaceData["agentTeam"]["runtimeRunnerHandles"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(driverRunId)}/attach-runner`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime runner handle ${payload.runner_handle.runner_handle_id} attached.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function heartbeatAgentTeamRuntimeRunnerHandle(runnerHandleId: string, driverRunId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-heartbeat:${runnerHandleId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_handle: WorkspaceData["agentTeam"]["runtimeRunnerHandles"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(driverRunId)}/runner-handles/${encodeURIComponent(runnerHandleId)}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime runner handle ${payload.runner_handle.runner_handle_id} heartbeat recorded.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function finalizeAgentTeamRuntimeRunnerHandle(
    runnerHandleId: string,
    driverRunId: string,
    actionKind: "release" | "fail"
  ) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-${actionKind}:${runnerHandleId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_handle: WorkspaceData["agentTeam"]["runtimeRunnerHandles"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(driverRunId)}/runner-handles/${encodeURIComponent(runnerHandleId)}/${actionKind}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(
        `Runtime runner handle ${payload.runner_handle.runner_handle_id} ${actionKind === "release" ? "released" : "failed"}.`
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function startAgentTeamRuntimeRunnerExecution(runnerHandleId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-execution-start:${runnerHandleId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_execution: WorkspaceData["agentTeam"]["runtimeRunnerExecutions"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-runner-handles/${encodeURIComponent(runnerHandleId)}/start-execution`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime runner execution ${payload.runner_execution.runner_execution_id} started.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function heartbeatAgentTeamRuntimeRunnerExecution(runnerExecutionId: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-execution-heartbeat:${runnerExecutionId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_execution: WorkspaceData["agentTeam"]["runtimeRunnerExecutions"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-runner-executions/${encodeURIComponent(runnerExecutionId)}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime runner execution ${payload.runner_execution.runner_execution_id} heartbeat recorded.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function finalizeAgentTeamRuntimeRunnerExecution(
    runnerExecutionId: string,
    actionKind: "complete" | "fail"
  ) {
    if (!selectedTaskId || !canOperate) return;
    const action = `agent-team-runtime-runner-execution-${actionKind}:${runnerExecutionId}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ runner_execution: WorkspaceData["agentTeam"]["runtimeRunnerExecutions"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-runner-executions/${encodeURIComponent(runnerExecutionId)}/${actionKind}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(
        `Runtime runner execution ${payload.runner_execution.runner_execution_id} ${actionKind === "complete" ? "completed" : "failed"}.`
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function startAgentTeamRuntimeRunnerJob(runnerExecutionId: string) {
    if (!selectedTaskId || !canOperate) return;
    setBusyAction(`agent-team-runner-job-start:${runnerExecutionId}`);
    try {
      const payload = await fetchJson<{ runner_job: WorkspaceData["agentTeam"]["runtimeRunnerJobs"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-runner-executions/${encodeURIComponent(runnerExecutionId)}/start-job`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime runner job ${payload.runner_job.runner_job_id} started.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function heartbeatAgentTeamRuntimeRunnerJob(runnerJobId: string) {
    if (!selectedTaskId || !canOperate) return;
    setBusyAction(`agent-team-runner-job-heartbeat:${runnerJobId}`);
    try {
      const payload = await fetchJson<{ runner_job: WorkspaceData["agentTeam"]["runtimeRunnerJobs"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-runner-jobs/${encodeURIComponent(runnerJobId)}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(`Runtime runner job ${payload.runner_job.runner_job_id} heartbeat recorded.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function finalizeAgentTeamRuntimeRunnerJob(
    runnerJobId: string,
    actionKind: "complete" | "fail"
  ) {
    if (!selectedTaskId || !canOperate) return;
    setBusyAction(`agent-team-runner-job-${actionKind}:${runnerJobId}`);
    try {
      const payload = await fetchJson<{ runner_job: WorkspaceData["agentTeam"]["runtimeRunnerJobs"][number] }>(
        `/api/local/tasks/${selectedTaskId}/agent-team/runtime-runner-jobs/${encodeURIComponent(runnerJobId)}/${actionKind}`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            note: agentTeamResumeReason || undefined
          })
        }
      );
      await loadWorkspace(selectedTaskId);
      setNotice(
        `Runtime runner job ${payload.runner_job.runner_job_id} ${actionKind === "complete" ? "completed" : "failed"}.`
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function runTool(path: string, body: Record<string, unknown>) {
    if (!selectedTaskId || !canOperate) return;
    setBusyAction(path);
    setError(null);
    setNotice(null);
    try {
      await fetchJson(`/api/local/tasks/${selectedTaskId}${path}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      await loadOverview();
      await loadWorkspace(selectedTaskId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function reconcileExternalInvocation(toolName: string, idempotencyKey: string) {
    if (!selectedTaskId || !canOperate) return;
    const action = `reconcile:${toolName}:${idempotencyKey}`;
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const result = await fetchJson<Record<string, unknown>>(
        `/api/local/tasks/${selectedTaskId}/tools/external/${toolName}/reconcile?idempotency_key=${encodeURIComponent(idempotencyKey)}`
      );
      const state = typeof result.state === "string" ? result.state : "unknown";
      setNotice(`Reconciliation result for ${toolName}: ${state}`);
      await loadWorkspace(selectedTaskId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  function getDefaultExternalToolInput(toolName: string) {
    if (toolName === "http_json_fetch") {
      return '{\n  "url": "http://127.0.0.1:3010/health"\n}';
    }
    if (toolName === "crm_contact_lookup") {
      return '{\n  "url": "http://127.0.0.1:3010/demo/crm/contact",\n  "email": "alex@example.com"\n}';
    }
    if (toolName === "hr_candidate_lookup") {
      return '{\n  "url": "http://127.0.0.1:3010/demo/hr/candidate",\n  "email": "jordan@example.com"\n}';
    }
    if (toolName === "finance_reconcile") {
      return '{\n  "url": "http://127.0.0.1:3010/demo/finance/reconcile",\n  "batch_id": "batch_demo_001"\n}';
    }
    return '{\n  "source": "desktop-workspace",\n  "scope": "manual_invoke"\n}';
  }

  function resetSkillFilters() {
    setSkillSearchQuery("");
    setSkillSourceFilter("all");
    setSkillStatusFilter("all");
  }

  function drillIntoCapability(capability: string) {
    setSkillSourceFilter("all");
    setSkillSearchQuery(capability);
  }

  async function importSkillInline() {
    try {
      const payload = await fetchJson<{ skill: CanonicalSkillEntry }>("/api/local/skills/import", {
        method: "POST",
        body: JSON.stringify({
          source_format: skillImportFormat,
          content: skillImportContent
        })
      });
      await refreshCanonicalSkills(payload.skill.skill_id);
      setSkillExchangeMessage(`Imported ${payload.skill.name} from ${payload.skill.source}.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function importSkillFile() {
    try {
      const payload = await fetchJson<{ skill: CanonicalSkillEntry; path: string }>("/api/local/skills/import-file", {
        method: "POST",
        body: JSON.stringify({
          source_format: skillImportFormat,
          path: skillImportPath
        })
      });
      await refreshCanonicalSkills(payload.skill.skill_id);
      setSkillExchangeMessage(`Imported ${payload.skill.name} from file ${payload.path}.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function previewSkillExport() {
    if (!selectedCanonicalSkill) {
      setSkillExchangeMessage("Select a skill before exporting.");
      return;
    }
    try {
      const payload = await fetchJson<{ skill: CanonicalSkillEntry; format: SkillDocumentFormat; content: string }>(
        `/api/local/skills/${encodeURIComponent(selectedCanonicalSkill.skill_id)}/export`,
        {
          method: "POST",
          body: JSON.stringify({
            format: skillExportFormat
          })
        }
      );
      setSkillExportPreview(payload.content);
      setSkillExchangeMessage(`Prepared ${payload.format} preview for ${payload.skill.name}.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function exportSkillToFile() {
    if (!selectedCanonicalSkill) {
      setSkillExchangeMessage("Select a skill before exporting.");
      return;
    }
    try {
      const payload = await fetchJson<{ skill: CanonicalSkillEntry; format: SkillDocumentFormat; path: string }>(
        `/api/local/skills/${encodeURIComponent(selectedCanonicalSkill.skill_id)}/export-file`,
        {
          method: "POST",
          body: JSON.stringify({
            format: skillExportFormat,
            path: skillExportPath
          })
        }
      );
      setSkillExchangeMessage(`Exported ${payload.skill.name} to ${payload.path}.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function updateSkillGovernance(status: CanonicalSkillEntry["status"]) {
    if (!selectedCanonicalSkill) {
      setSkillExchangeMessage("Select a skill before changing governance.");
      return;
    }
    try {
      const payload = await fetchJson<{ skill: CanonicalSkillEntry }>(
        `/api/local/skills/${encodeURIComponent(selectedCanonicalSkill.skill_id)}/governance`,
        {
          method: "POST",
          body: JSON.stringify({
            status,
            reviewed_by: "desktop:user",
            governance_note: skillGovernanceNote || undefined,
            actor_role: skillActorRole
          })
        }
      );
      await refreshCanonicalSkills(payload.skill.skill_id);
      setSkillExchangeMessage(`Updated ${payload.skill.name} to ${payload.skill.status}.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  function toggleBundleStatus(status: CanonicalSkillEntry["status"]) {
    setBundleExportStatuses(current =>
      current.includes(status)
        ? current.filter(item => item !== status)
        : [...current, status]
    );
  }

  async function previewSkillBundle() {
    try {
      const payload = await fetchJson<BundleManifestPreview>("/api/local/skills/export-bundle", {
        method: "POST",
        body: JSON.stringify({
          statuses: bundleExportStatuses,
          publisher_id: bundlePublisherId,
          publisher_name: bundlePublisherName,
          source_environment: bundleSourceEnvironment,
          release_channel: bundleReleaseChannel,
          promotion_note: bundlePromotionNote,
          actor_role: skillActorRole
        })
      });
      setBundleExportPreview(JSON.stringify(payload, null, 2));
      await loadBundleHistory(payload.bundle_name);
      setSkillExchangeMessage(
        `Prepared bundle with ${payload.skill_count} skill(s)${payload.publisher ? ` by ${payload.publisher.publisher_name ?? payload.publisher.publisher_id}` : ""}.`
      );
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function exportSkillBundleToFile() {
    try {
      const payload = await fetchJson<{ skill_count: number; path: string }>("/api/local/skills/export-bundle", {
        method: "POST",
        body: JSON.stringify({
          statuses: bundleExportStatuses,
          path: bundleExportPath,
          publisher_id: bundlePublisherId,
          publisher_name: bundlePublisherName,
          source_environment: bundleSourceEnvironment,
          release_channel: bundleReleaseChannel,
          promotion_note: bundlePromotionNote,
          actor_role: skillActorRole
        })
      });
      await loadBundleHistory();
      setSkillExchangeMessage(`Exported promoted bundle with ${payload.skill_count} skill(s) to ${payload.path}.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function verifySkillBundleFile() {
    try {
      const payload = await fetchJson<{
        valid: boolean;
        integrity_valid: boolean;
        signature_valid: boolean | null;
        publisher_trusted: boolean | null;
        release_channel_allowed: boolean | null;
        source_policy_allowed: boolean | null;
        tag_policy_allowed: boolean | null;
        capability_policy_allowed: boolean | null;
        issues: string[];
      }>("/api/local/skills/verify-bundle", {
        method: "POST",
        body: JSON.stringify({
          path: bundleImportPath
        })
      });
      setSkillExchangeMessage(
        payload.valid
          ? `Bundle verified. Integrity ${payload.integrity_valid ? "ok" : "failed"}${payload.signature_valid === null ? "" : `, signature ${payload.signature_valid ? "ok" : "failed"}`}${payload.publisher_trusted === null ? "" : `, publisher ${payload.publisher_trusted ? "trusted" : "untrusted"}`}${payload.release_channel_allowed === null ? "" : `, channel ${payload.release_channel_allowed ? "allowed" : "blocked"}`}${payload.source_policy_allowed === null ? "" : `, source ${payload.source_policy_allowed ? "allowed" : "blocked"}`}${payload.tag_policy_allowed === null ? "" : `, tags ${payload.tag_policy_allowed ? "allowed" : "blocked"}`}${payload.capability_policy_allowed === null ? "" : `, capabilities ${payload.capability_policy_allowed ? "allowed" : "blocked"}`}.`
          : `Bundle verification failed: ${payload.issues.join(" ")}`
      );
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function simulateSkillBundlePolicy() {
    try {
      const payload = await fetchJson<Record<string, unknown>>("/api/local/skills/policy/simulate", {
        method: "POST",
        body: JSON.stringify({
          path: bundleImportPath,
          actor_role: skillActorRole,
          trust_bundle: true
        })
      });
      setBundlePolicySimulationPreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(
        `Policy simulation ready for role ${String(payload.actor_role ?? skillActorRole)}. Trusted import ${
          (payload as { role_policy?: { can_import_trusted_bundle?: boolean } }).role_policy?.can_import_trusted_bundle ? "allowed" : "blocked"
        }.`
      );
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function savePolicyScope() {
    try {
      const parsedConfig = JSON.parse(policyEditorContent) as Record<string, unknown>;
      await fetchJson(`/api/local/skills/policy/scopes/${encodeURIComponent(selectedPolicyScope)}`, {
        method: "POST",
        body: JSON.stringify({
          path: policyEditorPath.trim() || undefined,
          config: parsedConfig,
          actor_role: skillActorRole
        })
      });
      await Promise.all([loadSkillPolicyDiagnostics(), loadSkillPolicyScopes(), loadPolicyAudits()]);
      setSkillExchangeMessage(`Saved ${selectedPolicyScope} policy scope.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function previewPolicyDiff() {
    try {
      const parsedConfig = JSON.parse(policyEditorContent) as Record<string, unknown>;
      const payload = await fetchJson<Record<string, unknown>>("/api/local/skills/policy/diff", {
        method: "POST",
        body: JSON.stringify({
          scope: selectedPolicyScope,
          path: policyEditorPath.trim() || undefined,
          config: parsedConfig,
          actor_role: skillActorRole
        })
      });
      setPolicyDiffPreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Computed effective diff for ${selectedPolicyScope} policy scope.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function previewPolicyBundle() {
    try {
      const payload = await fetchJson<Record<string, unknown>>("/api/local/skills/policy/export", {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage("Prepared policy bundle preview.");
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function exportPolicyBundleToFile() {
    try {
      const payload = await fetchJson<Record<string, unknown>>("/api/local/skills/policy/export", {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole,
          path: policyBundlePath.trim() || undefined
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage("Exported policy bundle.");
      await loadPolicyAudits();
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function importPolicyBundleFromFile() {
    try {
      const payload = await fetchJson<Record<string, unknown>>("/api/local/skills/policy/import", {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole,
          path: policyBundlePath.trim()
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage("Imported policy bundle.");
      await Promise.all([loadSkillPolicyDiagnostics(), loadSkillPolicyScopes(), loadPolicyAudits()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function rollbackPolicyScope() {
    try {
      const payload = await fetchJson<Record<string, unknown>>(
        `/api/local/skills/policy/scopes/${encodeURIComponent(selectedPolicyScope)}/rollback`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: skillActorRole,
            audit_id: selectedPolicyRollbackAuditId || undefined
          })
        }
      );
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Rolled back ${selectedPolicyScope} policy scope.`);
      await Promise.all([loadSkillPolicyDiagnostics(), loadSkillPolicyScopes(), loadPolicyAudits()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function createPolicyScopeProposal() {
    try {
      const parsedConfig = JSON.parse(policyEditorContent);
      const payload = await fetchJson<{ proposal: PolicyProposalEntry }>("/api/local/skills/policy/proposals/scope", {
        method: "POST",
        body: JSON.stringify({
          target_scope: selectedPolicyScope,
          path: policyEditorPath.trim() || undefined,
          config: parsedConfig,
          actor_role: skillActorRole,
          requested_by: skillActorRole,
          rationale: policyProposalRationale.trim() || undefined
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Created policy proposal for ${selectedPolicyScope}.`);
      await Promise.all([loadPolicyProposals(), loadPolicyProposalQueues(), loadPolicyProposalFollowUps()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function createPolicyPromotionProposal() {
    try {
      const advisoryPayload =
        policyCompareResult &&
        policyCompareResult.from.scope === policyPromotionSourceScope &&
        policyCompareResult.to.scope === policyPromotionTargetScope
          ? {
              review_path: policyCompareResult.advisory.review_path,
              advisory_recommended_action: policyCompareResult.advisory.recommended_action,
              advisory_reasons: policyCompareResult.advisory.reasons
            }
          : {};
      const payload = await fetchJson<{ proposal: PolicyProposalEntry }>("/api/local/skills/policy/proposals/promote", {
        method: "POST",
        body: JSON.stringify({
          source_scope: policyPromotionSourceScope,
          target_scope: policyPromotionTargetScope,
          actor_role: skillActorRole,
          requested_by: skillActorRole,
          rationale: policyProposalRationale.trim() || undefined,
          ...advisoryPayload
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Created promotion proposal ${policyPromotionSourceScope} -> ${policyPromotionTargetScope}.`);
      await Promise.all([loadPolicyProposals(), loadPolicyProposalQueues(), loadPolicyProposalFollowUps()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function approvePolicyProposal(proposalId: string) {
    try {
      const payload = await fetchJson<{ proposal: PolicyProposalEntry }>(`/api/local/skills/policy/proposals/${encodeURIComponent(proposalId)}/approve`, {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole,
          approved_by: skillActorRole
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Approved policy proposal ${proposalId}.`);
      await Promise.all([loadPolicyProposals(), loadPolicyProposalQueues(), loadPolicyProposalFollowUps()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function rejectPolicyProposal(proposalId: string) {
    try {
      const payload = await fetchJson<{ proposal: PolicyProposalEntry }>(`/api/local/skills/policy/proposals/${encodeURIComponent(proposalId)}/reject`, {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole,
          rejected_by: skillActorRole,
          rejection_reason: policyProposalRationale.trim() || undefined
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Rejected policy proposal ${proposalId}.`);
      await Promise.all([loadPolicyProposals(), loadPolicyProposalQueues(), loadPolicyProposalFollowUps()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function applyPolicyProposal(proposalId: string) {
    try {
      const payload = await fetchJson<{ proposal: PolicyProposalEntry }>(`/api/local/skills/policy/proposals/${encodeURIComponent(proposalId)}/apply`, {
        method: "POST",
        body: JSON.stringify({
          actor_role: skillActorRole,
          applied_by: skillActorRole
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Applied policy proposal ${proposalId}.`);
      await Promise.all([loadPolicyProposals(), loadPolicyProposalQueues(), loadPolicyProposalFollowUps(), loadSkillPolicyDiagnostics(), loadSkillPolicyScopes(), loadPolicyAudits()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function processPolicyProposalBatch(action: "approve" | "reject" | "apply") {
    try {
      const payload = await fetchJson<{ action: string; count: number; items: PolicyProposalEntry[] }>("/api/local/skills/policy/proposals/batch", {
        method: "POST",
        body: JSON.stringify({
          proposal_ids: selectedPolicyProposalIds,
          action,
          actor_role: skillActorRole,
          note: policyProposalRationale.trim() || undefined
        })
      });
      setPolicyBundlePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Processed ${payload.count} proposal(s) with action '${action}'.`);
      setSelectedPolicyProposalIds([]);
      await Promise.all([loadPolicyProposals(), loadPolicyProposalQueues(), loadPolicyProposalFollowUps(), loadPolicyAudits(), loadPolicyReleaseHistory(), loadSkillPolicyDiagnostics(), loadSkillPolicyScopes()]);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  function togglePolicyProposalSelection(proposalId: string) {
    setSelectedPolicyProposalIds(current =>
      current.includes(proposalId) ? current.filter(item => item !== proposalId) : [...current, proposalId]
    );
  }

  function applyPolicyTemplate(kind: keyof PolicyApprovalTemplates) {
    const template = policyApprovalTemplates?.[kind]?.[0];
    if (template) {
      setPolicyProposalRationale(template);
    }
  }

  function applyPolicyCompareAdvisory() {
    if (!policyCompareResult) {
      return;
    }
    setPolicyPromotionSourceScope(policyCompareResult.from.scope);
    setPolicyPromotionTargetScope(policyCompareResult.to.scope);
    setPolicyProposalRationale(policyCompareResult.advisory.suggested_note);
    setSkillExchangeMessage(
      `Prepared ${policyCompareResult.advisory.review_path} workflow for ${policyCompareResult.from.scope} -> ${policyCompareResult.to.scope}.`
    );
  }

  async function comparePolicyEnvironments() {
    try {
      const payload = await fetchJson<PolicyEnvironmentCompareResult>("/api/local/skills/policy/compare", {
        method: "POST",
        body: JSON.stringify({
          from_scope: policyCompareFromScope,
          to_scope: policyCompareToScope
        })
      });
      setPolicyCompareResult(payload);
      setPolicyComparePreview(JSON.stringify(payload, null, 2));
      setSkillExchangeMessage(`Compared policy environments ${policyCompareFromScope} -> ${policyCompareToScope}.`);
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  async function importSkillBundleFile(trustBundle: boolean) {
    try {
      const payload = await fetchJson<{
        verification: { valid: boolean; integrity_valid: boolean; signature_valid: boolean | null; issues: string[] };
        imported: CanonicalSkillEntry[];
      }>("/api/local/skills/import-bundle", {
        method: "POST",
        body: JSON.stringify({
          path: bundleImportPath,
          trust_bundle: trustBundle,
          actor_role: skillActorRole
        })
      });
      await refreshCanonicalSkills(payload.imported[0]?.skill_id ?? null);
      await loadBundleHistory();
      setSkillExchangeMessage(
        `Imported ${payload.imported.length} skill(s) from bundle${trustBundle ? " with trust enabled" : ""}.`
      );
    } catch (error) {
      setSkillExchangeMessage((error as Error).message);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Apex</h1>
          <p>Universal Agent Desktop</p>
        </div>

        <section className="panel" ref={inboxPanelRef}>
          <h2>Overview</h2>
          <div className="stats">
            <Stat label="Tasks" value={dashboard?.totals.tasks ?? 0} />
            <Stat label="Running" value={dashboard?.totals.running ?? 0} />
            <Stat label="Completed" value={dashboard?.totals.completed ?? 0} />
            <Stat label="Worker Runs" value={dashboard?.totals.workerRuns ?? 0} />
            <Stat label="Inbox Open" value={dashboard?.inbox_summary.total_open ?? 0} />
            <Stat label="Inbox Critical" value={dashboard?.inbox_summary.by_severity.critical ?? 0} />
            <Stat label="Governance Open" value={dashboard?.governance_alert_summary.open_count ?? 0} />
            <Stat label="Governance Critical" value={dashboard?.governance_alert_summary.by_severity.critical ?? 0} />
          </div>
          <p className="subtle">
            {dashboard?.stateBackend.kind ?? "unknown"} / {dashboard?.stateBackend.driver ?? "unknown"}
          </p>
          <p className="subtle">
            {RUNTIME_INFO.label} / {RUNTIME_INFO.mode} / {RUNTIME_INFO.apiBase}
          </p>
          <p className="subtle">control plane: {controlPlaneState}</p>
            <p className="subtle">
              {health?.service ?? "local-control-plane"} / last check{" "}
              {lastHealthCheckAt ? new Date(lastHealthCheckAt).toLocaleTimeString() : "not yet"}
            </p>
            {inboxItems.length > 0 ? (
              <>
                <p className="subtle">Inbox</p>
                <div className="tool-actions compact-grid">
                  <div className="card nested-card">
                    <p className="subtle">Desktop notifications</p>
                    <p className="subtle">
                      preference: {desktopNotificationPreference} / permission: {desktopNotificationPermission}
                    </p>
                    <p className="subtle">
                      delivery: {desktopNotificationDeliveryMode} / click-through:{" "}
                      {desktopNotificationCapability.click_through_supported ? "supported" : "not available"}
                    </p>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={desktopNotificationPermission === "unsupported"}
                        onClick={() => enableDesktopNotifications().catch(cause => setError((cause as Error).message))}
                      >
                        Enable Notifications
                      </button>
                      <button className="secondary" onClick={() => disableDesktopNotifications()}>
                        Disable Notifications
                      </button>
                    </div>
                  </div>
                  <div className="card nested-card">
                    <p className="subtle">Priority inbox</p>
                    <p className="subtle">
                      warning/critical (new only): {priorityInboxItems.length} / delivery keys retained: {deliveredInboxAlertKeys.length}
                    </p>
                    {priorityInboxItems.length > 0 ? (
                      <ul className="audit-list">
                        {priorityInboxItems.slice(0, 3).map(item => (
                          <li key={`priority-${item.inbox_id}`}>
                            <strong>{item.title}</strong>
                            <div className="subtle">
                              {item.severity} / {item.state} / {item.kind}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="subtle">No priority inbox alerts are pending.</p>
                    )}
                  </div>
                  <div className="card nested-card">
                    <p className="subtle">Governance alerts</p>
                    <p className="subtle">
                      open: {dashboard?.governance_alert_summary.open_count ?? governanceAlerts.filter(item => item.status !== "resolved").length} / resolved:{" "}
                      {dashboard?.governance_alert_summary.resolved_count ?? governanceAlerts.filter(item => item.status === "resolved").length}
                    </p>
                    <div className="stats compact-stats">
                      <Stat label="Warnings" value={dashboard?.governance_alert_summary.by_severity.warning ?? 0} />
                      <Stat label="Critical" value={dashboard?.governance_alert_summary.by_severity.critical ?? 0} />
                      <Stat label="Escalated" value={dashboard?.governance_alert_summary.escalated_count ?? 0} />
                      <Stat
                        label="Investigate"
                        value={dashboard?.governance_alert_summary.by_action.investigate_system_handoff ?? 0}
                      />
                      <Stat
                        label="Occurrences"
                        value={dashboard?.governance_alert_summary.aggregated_occurrences ?? 0}
                      />
                    </div>
                    {governanceAlerts.length > 0 ? (
                      <ul className="audit-list">
                        {governanceAlerts.slice(0, 3).map(alert => (
                          <li
                            key={alert.alert_id}
                            className={alert.alert_id === selectedGovernanceAlertId ? "highlighted-item" : undefined}
                          >
                            <strong>{alert.title}</strong>
                            <div className="subtle">
                              {alert.severity} / {alert.status} / {alert.action}
                            </div>
                            <div className="subtle">
                              seen {alert.occurrence_count} time(s) / last seen{" "}
                              {new Date(alert.last_seen_at ?? alert.created_at).toLocaleString()}
                            </div>
                            {alert.auto_escalated ? (
                              <div className="subtle">
                                auto escalated at {new Date(alert.escalated_at ?? alert.last_seen_at ?? alert.created_at).toLocaleString()}
                              </div>
                            ) : null}
                            {(alert.suppressed_repeat_count ?? 0) > 0 ? (
                              <div className="subtle">suppressed repeats: {alert.suppressed_repeat_count}</div>
                            ) : null}
                            <div className="actions compact-actions">
                              <button className="secondary" onClick={() => setSelectedGovernanceAlertId(alert.alert_id)}>
                                View Audits
                              </button>
                              <button
                                className="secondary"
                                onClick={() =>
                                  copyDesktopDeepLink(
                                    parseDesktopDeepLink(alert.deep_link ?? "") ?? { kind: "inbox", inboxId: `inbox_${alert.alert_id}` },
                                    alert.title
                                  )
                                }
                              >
                                Copy Link
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="subtle">No governance alerts have been created yet.</p>
                    )}
                    {selectedGovernanceAlertAudits.length > 0 ? (
                      <>
                        <p className="subtle">Selected governance alert audits</p>
                        <ul className="audit-list">
                          {selectedGovernanceAlertAudits.slice(0, 4).map(entry => (
                            <li key={entry.audit_id}>
                              <strong>{entry.action}</strong>
                              <div className="subtle">{new Date(entry.created_at).toLocaleString()}</div>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                  <div className="card nested-card">
                    <p className="subtle">Governance follow-ups</p>
                    <p className="subtle">
                      critical/repeated governance alerts promoted into a dedicated execution feed.
                    </p>
                    {governanceAlertFollowUps.length > 0 ? (
                      <ul className="audit-list">
                        {governanceAlertFollowUps.slice(0, 4).map(item => (
                          <li key={item.follow_up_id}>
                            <strong>{item.title}</strong>
                            <div className="subtle">
                              {item.severity} / {item.action} / occurrences {item.occurrence_count}
                            </div>
                            {item.auto_escalated ? <div className="subtle">auto escalated follow-up</div> : null}
                            <div className="actions compact-actions">
                              <button
                                className="secondary"
                                onClick={() =>
                                  navigateToDesktopTarget(
                                    parseDesktopDeepLink(item.deep_link ?? "") ?? { kind: "inbox", inboxId: `inbox_${item.alert_id}` },
                                    { source: "follow_up_focus" }
                                  ).catch(cause => setError((cause as Error).message))
                                }
                              >
                                Focus
                              </button>
                              <button
                                className="secondary"
                                onClick={() =>
                                  copyDesktopDeepLink(
                                    parseDesktopDeepLink(item.deep_link ?? "") ?? { kind: "inbox", inboxId: `inbox_${item.alert_id}` },
                                    item.title
                                  )
                                }
                              >
                                Copy Link
                              </button>
                              <button
                                className="secondary"
                                disabled={!!busyAction || !canOperate}
                                onClick={() => executeGovernanceAlertFollowUp(item.follow_up_id).catch(cause => setError((cause as Error).message))}
                              >
                                Execute
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="subtle">No governance follow-ups are pending.</p>
                    )}
                  </div>
                  <div className="card nested-card">
                    <p className="subtle">Current deep link</p>
                    {currentDesktopTarget && currentDesktopLink ? (
                      <>
                        <p className="subtle">{describeDesktopDeepLinkTarget(currentDesktopTarget)}</p>
                        <div className="link-preview">{currentDesktopLink}</div>
                        <div className="actions">
                          <button className="secondary" onClick={() => copyDesktopDeepLink(currentDesktopTarget)}>
                            Copy Link
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              navigateToDesktopTarget(currentDesktopTarget, {
                                focusWindow: true,
                                source: "system_focus"
                              }).catch(cause =>
                                setError((cause as Error).message)
                              )
                            }
                          >
                            Focus Current
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="subtle">Select a task, inbox item, follow-up, or proposal to generate a shareable link.</p>
                    )}
                  </div>
                  <div className="card nested-card">
                    <p className="subtle">Desktop navigation events</p>
                    <p className="subtle">Recent entry points into the current workspace target flow.</p>
                    <div className="tool-actions compact-grid">
                      <label className="tool-field">
                        <span>Source filter</span>
                        <select
                          value={desktopNavigationSourceFilter}
                          onChange={event =>
                            setDesktopNavigationSourceFilter(event.target.value as DesktopNavigationSourceFilter)
                          }
                        >
                          <option value="all">All</option>
                          <option value="workspace">Workspace</option>
                          <option value="browser">Browser</option>
                          <option value="system">System</option>
                        </select>
                      </label>
                      <label className="tool-field">
                        <span>Time range</span>
                        <select
                          value={desktopNavigationTimeRangeFilter}
                          onChange={event =>
                            setDesktopNavigationTimeRangeFilter(event.target.value as DesktopNavigationTimeRangeFilter)
                          }
                        >
                          <option value="5m">Last 5 minutes</option>
                          <option value="1h">Last hour</option>
                          <option value="24h">Last 24 hours</option>
                          <option value="all">All retained</option>
                        </select>
                      </label>
                      <label className="tool-field">
                        <span>Target filter</span>
                        <select
                          value={desktopNavigationTargetFilter}
                          onChange={event =>
                            setDesktopNavigationTargetFilter(event.target.value as DesktopNavigationTargetFilter)
                          }
                        >
                          <option value="all">All</option>
                          <option value="task">Task</option>
                          <option value="inbox">Inbox</option>
                          <option value="policy">Policy</option>
                          <option value="reuse">Reuse</option>
                        </select>
                      </label>
                      <label className="tool-field">
                        <span>Reuse filter</span>
                        <select
                          value={desktopNavigationReuseFilter}
                          onChange={event =>
                            setDesktopNavigationReuseFilter(event.target.value as DesktopNavigationReuseFilter)
                          }
                          disabled={desktopNavigationTargetFilter !== "reuse"}
                        >
                          <option value="all">All reuse</option>
                          <option value="execution_template">Execution templates</option>
                          <option value="learned_playbook">Learned playbooks</option>
                        </select>
                      </label>
                      <div className="card nested-card">
                        <p className="subtle">Workspace</p>
                        <strong>{desktopNavigationSummary.workspace}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">Browser</p>
                        <strong>{desktopNavigationSummary.browser}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">System</p>
                        <strong>{desktopNavigationSummary.system}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">Tasks</p>
                        <strong>{desktopNavigationTargetSummary.task}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">Inbox</p>
                        <strong>{desktopNavigationTargetSummary.inbox}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">Policy</p>
                        <strong>{desktopNavigationTargetSummary.policy}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">Reuse</p>
                        <strong>{desktopNavigationTargetSummary.reuse}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">Exec templates</p>
                        <strong>{desktopNavigationReuseSummary.execution_template}</strong>
                      </div>
                      <div className="card nested-card">
                        <p className="subtle">Playbooks</p>
                        <strong>{desktopNavigationReuseSummary.learned_playbook}</strong>
                      </div>
                    </div>
                    <p className="subtle">
                      Retention: {desktopNavigationEventPolicy.max_retained} events / storage:{" "}
                      {desktopNavigationEventPolicy.storage_mode} / window:{" "}
                      {describeDesktopNavigationTimeRange(desktopNavigationTimeRangeFilter)} / target filter:{" "}
                      {desktopNavigationTargetFilter} / reuse filter: {desktopNavigationReuseFilter}
                    </p>
                    {activeDesktopNavigationRisks.length > 0 ? (
                      <ul className="audit-list">
                        {activeDesktopNavigationRisks.map(risk => (
                          <li key={risk.risk_id} className={risk.severity === "critical" ? "highlighted-item" : undefined}>
                            <strong>{risk.title}</strong>
                            <div className="subtle">
                              {risk.severity} / {risk.detail}
                            </div>
                            <div className="subtle">{risk.recommended_action}</div>
                            <div className="actions compact-actions">
                              <button
                                className="secondary"
                                disabled={!!busyAction || !canOperate}
                                onClick={() => createDesktopNavigationRiskTask(risk).catch(cause => setError((cause as Error).message))}
                              >
                                Send To Inbox
                              </button>
                              {risk.target ? (
                                <button
                                  className="secondary"
                                  onClick={() =>
                                    copyDesktopDeepLink(risk.target!, `${risk.title} target`)
                                  }
                                >
                                  Copy Link
                                </button>
                              ) : null}
                              <button className="secondary" onClick={() => dismissDesktopNavigationRisk(risk.risk_id)}>
                                Dismiss
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {dismissedDesktopNavigationRiskCount > 0 ? (
                      <div className="actions compact-actions">
                        <span className="subtle">{dismissedDesktopNavigationRiskCount} dismissed desktop risk item(s)</span>
                        <button className="secondary" onClick={() => restoreDismissedDesktopNavigationRisks()}>
                          Restore Dismissed
                        </button>
                      </div>
                    ) : null}
                    {filteredDesktopNavigationEvents.length > 0 ? (
                      <ul className="audit-list">
                        {filteredDesktopNavigationEvents.map(event => (
                          <li key={event.event_id}>
                            <strong>{describeDesktopDeepLinkTarget(event.target)}</strong>
                            <div className="subtle">
                              {describeDesktopNavigationSource(event.source)} /{" "}
                              {describeDesktopNavigationTargetGroup(event.target)} /{" "}
                              {classifyDesktopNavigationTarget(event.target) === "reuse"
                                ? `${describeDesktopNavigationReuseTarget(event.target)} / `
                                : ""}
                              {new Date(event.recorded_at).toLocaleTimeString()}
                            </div>
                            <div className="actions compact-actions">
                              <button
                                className="secondary"
                                onClick={() =>
                                  copyDesktopDeepLink(event.target, describeDesktopDeepLinkTarget(event.target))
                                }
                              >
                                Copy Link
                              </button>
                              <button
                                className="secondary"
                                onClick={() => replayDesktopNavigationEvent(event).catch(cause => setError((cause as Error).message))}
                              >
                                Replay
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="subtle">Navigation events will appear here after focus, deep-link, or notification actions.</p>
                    )}
                  </div>
                </div>
                <div className="tool-actions compact-grid">
                  <label className="tool-field">
                    <span>Severity</span>
                    <select value={inboxSeverityFilter} onChange={event => setInboxSeverityFilter(event.target.value as InboxSeverityFilter)}>
                      <option value="all">All</option>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="tool-field">
                    <span>Kind</span>
                    <select value={inboxKindFilter} onChange={event => setInboxKindFilter(event.target.value as InboxKindFilter)}>
                      <option value="all">All</option>
                      <option value="policy_follow_up">Policy follow-up</option>
                      <option value="task_attention">Task attention</option>
                      <option value="governance_alert">Governance alert</option>
                    </select>
                  </label>
                  <label className="tool-field">
                    <span>Status</span>
                    <select value={inboxStatusFilter} onChange={event => setInboxStatusFilter(event.target.value as InboxStatusFilter)}>
                      <option value="all">All</option>
                      <option value="new">New</option>
                      <option value="acknowledged">Acknowledged</option>
                    </select>
                  </label>
                </div>
                <div className="stats compact-stats">
                  <Stat label="New" value={dashboard?.inbox_summary.new_count ?? 0} />
                  <Stat label="Acknowledged" value={dashboard?.inbox_summary.acknowledged_count ?? 0} />
                  <Stat label="Warnings" value={dashboard?.inbox_summary.by_severity.warning ?? 0} />
                  <Stat label="Policy" value={dashboard?.inbox_summary.by_kind.policy_follow_up ?? 0} />
                </div>
                <ul className="audit-list">
                  {inboxItems.slice(0, 4).map(item => (
                    <li key={item.inbox_id} className={item.inbox_id === highlightedInboxId ? "highlighted-item" : undefined}>
                      <strong>{item.title}</strong>
                      <div className="subtle">
                        {item.severity} / {item.kind} / {item.state} / {item.action}
                      </div>
                      <div className="tool-actions">
                        <button
                          className="secondary"
                          onClick={() =>
                            focusInboxWorkflow(item, "workspace_click").catch(cause => setError((cause as Error).message))
                          }
                        >
                          Focus
                        </button>
                        <button
                          className="secondary"
                          onClick={() => copyDesktopDeepLink({ kind: "inbox", inboxId: item.inbox_id }, item.title)}
                        >
                          Copy Link
                        </button>
                        <button
                          className="secondary"
                          disabled={item.state === "acknowledged"}
                          onClick={() => updateInboxItem(item.inbox_id, "ack").catch(cause => setError((cause as Error).message))}
                        >
                          Acknowledge
                        </button>
                        {(item.kind === "policy_follow_up" || item.kind === "governance_alert") ? (
                          <button
                            className="secondary"
                            disabled={!!busyAction || !canOperate}
                            onClick={() => executeInboxItemAction(item).catch(cause => setError((cause as Error).message))}
                          >
                            Execute
                          </button>
                        ) : null}
                        <button
                          className="secondary"
                          onClick={() => updateInboxItem(item.inbox_id, "resolve").catch(cause => setError((cause as Error).message))}
                        >
                          Resolve
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : dashboard?.inbox_summary.total_open ? (
              <>
                <p className="subtle">Inbox filters hid all current items.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setInboxSeverityFilter("all");
                    setInboxKindFilter("all");
                    setInboxStatusFilter("all");
                  }}
                >
                  Reset Inbox Filters
                </button>
              </>
            ) : null}
            {desktopManagerState ? (
            <>
              <p className="subtle">
                desktop manager: {desktopManagerState.status}
                {desktopManagerState.pid ? ` / pid ${desktopManagerState.pid}` : ""}
              </p>
              <p className="subtle">
                mode: {desktopManagerState.mode}
                {desktopManagerState.launch_target ? ` / ${desktopManagerState.launch_target}` : ""}
              </p>
              <p className="subtle">
                auto restart: {desktopManagerState.auto_restart_enabled ? "enabled" : "disabled"} / attempts {desktopManagerState.restart_attempts}
                {desktopManagerState.next_restart_at
                  ? ` / next ${formatManagerEventTime(desktopManagerState.next_restart_at)}`
                  : ""}
              </p>
              {desktopManagerState.last_exit ? (
                <p className="subtle">last exit: {desktopManagerState.last_exit}</p>
              ) : null}
            </>
          ) : null}
          {RUNTIME_INFO.mode === "tauri" && desktopManagerState?.supported ? (
            <div className="actions">
              <button disabled={!!busyAction || desktopManagerState.status === "running"} onClick={() => handleStartLocalControlPlane()}>
                Start
              </button>
              <button disabled={!!busyAction || desktopManagerState.status !== "running"} onClick={() => handleRestartLocalControlPlane()}>
                Restart
              </button>
              <button disabled={!!busyAction || desktopManagerState.status !== "running"} onClick={() => handleStopLocalControlPlane()}>
                Stop
              </button>
            </div>
          ) : null}
          {desktopManagerEvents.length > 0 ? (
            <div className="task-list">
              {desktopManagerEvents.slice(0, 3).map(event => (
                <div key={event.sequence} className="task-item">
                  <span className="task-intent">{event.message}</span>
                  <span className="task-meta">
                    {event.level} / {formatManagerEventTime(event.recorded_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Tasks</h2>
            <button onClick={() => ensureDemo().catch(cause => setError((cause as Error).message))}>Refresh</button>
          </div>
          <div className="task-list">
            {tasks.map(task => (
              <button
                key={task.task_id}
                className={`task-item ${task.task_id === selectedTaskId ? "selected" : ""}`}
                onClick={() =>
                  navigateToDesktopTarget({ kind: "task", taskId: task.task_id }, { source: "workspace_click" }).catch(
                    cause => setError((cause as Error).message)
                  )
                }
              >
                <span className="task-intent">{task.intent}</span>
                <span className="task-meta">
                  {task.department} / {task.status}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Local Tools</h2>
          <div className="task-list">
            {toolCatalog.map(tool => (
              <div key={tool.tool_name} className="task-item">
                <span className="task-intent">{tool.tool_name}</span>
                <span className="task-meta">
                  {tool.category} / {tool.behavior} / {tool.requires_permission}
                </span>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Task Workspace</p>
            <h2>{selectedTask?.intent ?? "No task selected"}</h2>
            {selectedTask ? (
              <p className="subtle">
                {selectedTask.department} / {selectedTask.task_type} / risk {selectedTask.risk_level}
              </p>
            ) : null}
          </div>
          <div className="actions">
            <button disabled={!selectedTaskId || !!busyAction || !canOperate} onClick={() => runAction("prepare")}>Prepare</button>
            <button disabled={!selectedTaskId || !!busyAction || !canOperate} onClick={() => runAction("run")}>Run</button>
            <button disabled={!selectedTaskId || !!busyAction || !canOperate} onClick={() => runAction("verify")}>Verify</button>
            <button disabled={!selectedTaskId || !!busyAction || !canOperate} onClick={() => runAction("stop")}>Stop</button>
            <button disabled={!selectedTaskId || !!busyAction || !canOperate} onClick={() => runAction("resume")}>Resume</button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {!error && notice ? <div className="card"><p>{notice}</p></div> : null}

        {!canOperate ? (
          <section className="card">
            <h3>Local Control Plane</h3>
            <p>
              {controlPlaneState === "connecting"
                ? "Connecting to the local control plane."
                : "The local control plane is unavailable."}
            </p>
            <p className="subtle">
              Start <code>npm run dev:desktop-supervisor</code> or <code>npm run dev -w @apex/local-control-plane</code>, then retry.
            </p>
            {desktopManagerState?.message ? <p className="subtle">{desktopManagerState.message}</p> : null}
            {RUNTIME_INFO.mode === "tauri" && desktopManagerState?.supported ? (
              <button disabled={!!busyAction || desktopManagerState.status === "running"} onClick={() => handleStartLocalControlPlane()}>
                {desktopManagerState.status === "running" ? "Control Plane Running" : "Start Local Control Plane"}
              </button>
            ) : null}
            <button
              disabled={!!busyAction}
              onClick={() => {
                setError(null);
                loadOverview().catch(cause => setError((cause as Error).message));
              }}
            >
              Retry Connection
            </button>
          </section>
        ) : null}

        <div className="workspace-grid">
          <section className="card">
            <h3>Desktop Companion</h3>
            <p>Status: <strong>{desktopManagerState?.status ?? "unknown"}</strong></p>
            <p className="subtle">mode: {desktopManagerState?.mode ?? "unknown"}</p>
            {desktopManagerState?.launch_target ? (
              <p className="subtle">launch target: {desktopManagerState.launch_target}</p>
            ) : null}
            {desktopManagerLogs.stdout_path ? (
              <p className="subtle">stdout log: {desktopManagerLogs.stdout_path}</p>
            ) : null}
            {desktopManagerLogs.stderr_path ? (
              <p className="subtle">stderr log: {desktopManagerLogs.stderr_path}</p>
            ) : null}
            {desktopManagerState?.message ? (
              <p className="subtle">{desktopManagerState.message}</p>
            ) : null}
            <p className="subtle">
              auto restart: {desktopManagerState?.auto_restart_enabled ? "enabled" : "disabled"} / attempts{" "}
              {desktopManagerState?.restart_attempts ?? 0}
              {desktopManagerState?.next_restart_at
                ? ` / next ${formatManagerEventTime(desktopManagerState.next_restart_at)}`
                : ""}
            </p>
            {desktopManagerState?.last_exit ? (
              <p className="subtle">last exit: {desktopManagerState.last_exit}</p>
            ) : null}
            <div className="actions">
              <button disabled={!!busyAction} onClick={() => refreshDesktopManagerState().catch(() => undefined)}>
                Refresh Manager
              </button>
            </div>
            {desktopManagerLogs.stdout_tail.length > 0 ? (
              <>
                <p className="subtle">stdout</p>
                <ul className="audit-list">
                  {desktopManagerLogs.stdout_tail.slice(-8).map((line, index) => (
                    <li key={`stdout-${index}`}>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {desktopManagerLogs.stderr_tail.length > 0 ? (
              <>
                <p className="subtle">stderr</p>
                <ul className="audit-list">
                  {desktopManagerLogs.stderr_tail.slice(-8).map((line, index) => (
                    <li key={`stderr-${index}`}>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="card">
            <h3>Definition of Done</h3>
            <p>{workspace?.task.definition_of_done.goal ?? "No goal loaded yet."}</p>
            <ul>
              {(workspace?.task.definition_of_done.completion_criteria ?? []).map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="card" ref={executionTemplateRef}>
            <h3>Execution Template</h3>
            {typeof workspace?.executionTemplate?.execution_template_key === "string" ? (
              <ul>
                <li>
                  <strong>template key</strong>
                  <div className="subtle">{workspace.executionTemplate.execution_template_key}</div>
                  {workspace.executionTemplate.reused_task_template ? (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button
                        className="secondary"
                        onClick={() =>
                          navigateToDesktopTarget(
                            parseDesktopDeepLink(workspace.executionTemplate.reused_task_template?.deep_link ?? "")
                              ?? {
                                kind: "execution_template",
                                taskId: workspace.task.task_id,
                                templateId: workspace.executionTemplate.reused_task_template!.template_id
                              },
                            { source: "workspace_click" }
                          ).catch(cause => setError((cause as Error).message))
                        }
                      >
                        Focus
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          copyDesktopDeepLink(
                            parseDesktopDeepLink(workspace.executionTemplate.reused_task_template?.deep_link ?? "")
                              ?? {
                                kind: "execution_template",
                                taskId: workspace.task.task_id,
                                templateId: workspace.executionTemplate.reused_task_template!.template_id
                              }
                          ).catch(cause => setError((cause as Error).message))
                        }
                      >
                        Copy Link
                      </button>
                    </div>
                  ) : null}
                </li>
                {typeof workspace?.executionTemplate?.reused_task_template_id === "string" ? (
                  <li>
                    <strong>reused learned template</strong>
                    <div className="subtle">
                      {workspace.executionTemplate.reused_task_template_id}
                      {typeof workspace?.executionTemplate?.reused_task_template_version === "number"
                        ? ` / version ${workspace.executionTemplate.reused_task_template_version}`
                        : ""}
                    </div>
                  </li>
                ) : (
                  <li>
                    <strong>reuse status</strong>
                    <div className="subtle">This task is using a stable execution template but did not reuse a learned task template yet.</div>
                  </li>
                )}
                {workspace?.executionTemplate?.reused_task_template ? (
                  <>
                    <li>
                      <strong>template title</strong>
                      <div className="subtle">
                        {workspace.executionTemplate.reused_task_template.title} / validated by{" "}
                        {workspace.executionTemplate.reused_task_template.source_task_count} task(s)
                      </div>
                    </li>
                    <li>
                      <strong>template applicability</strong>
                      <div className="subtle">
                        required: {workspace.executionTemplate.reused_task_template.applicability.required_tags.join(", ") || "none"} | preferred:{" "}
                        {workspace.executionTemplate.reused_task_template.applicability.preferred_tags.join(", ") || "none"}
                      </div>
                    </li>
                    {(workspace.executionTemplate.reused_task_template.improvement_hints?.length ?? 0) > 0 ? (
                      <li>
                        <strong>improvement hints</strong>
                        <ul>
                          {workspace.executionTemplate.reused_task_template.improvement_hints.slice(0, 4).map(item => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </li>
                    ) : null}
                    <li>
                      <strong>template boundaries</strong>
                      <div className="subtle">
                        {workspace.executionTemplate.reused_task_template.failure_boundaries.join(" | ") || "none recorded"}
                      </div>
                    </li>
                  </>
                ) : null}
                {(workspace?.executionTemplate?.related_playbooks?.length ?? 0) > 0 ? (
                  <li>
                    <strong>related learned playbooks</strong>
                    <ul>
                      {workspace?.executionTemplate?.related_playbooks.map(playbook => (
                        <li key={playbook.candidate_id}>
                          <button
                            className={`secondary ${selectedExecutionPlaybook?.candidate_id === playbook.candidate_id ? "selected-inline-button" : ""}`}
                            onClick={() => setSelectedExecutionPlaybookId(playbook.candidate_id)}
                          >
                            {playbook.title} / v{playbook.version} / validated by {playbook.source_task_count} task(s)
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="subtle">This task is currently running without a dedicated execution template.</p>
            )}
          </section>

          {workspace?.reuseImprovement ? (
            <section className="card">
              <h3>Reuse Improvement</h3>
              <p className="subtle">{workspace.reuseImprovement.summary}</p>
              <ul>
                <li>
                  <strong>target</strong>
                  <div className="subtle">
                    {workspace.reuseImprovement.target_kind === "execution_template" ? "Execution template" : "Learned playbook"} /{" "}
                    {workspace.reuseImprovement.target_title ?? workspace.reuseImprovement.target_id}
                    {typeof workspace.reuseImprovement.target_version === "number"
                      ? ` / v${workspace.reuseImprovement.target_version}`
                      : ""}
                  </div>
                </li>
                <li>
                  <strong>suggested learning action</strong>
                  <div className="subtle">{workspace.reuseImprovement.suggested_learning_action}</div>
                </li>
                {typeof workspace.reuseImprovement.source_task_count === "number" ? (
                  <li>
                    <strong>validated by</strong>
                    <div className="subtle">{workspace.reuseImprovement.source_task_count} task(s)</div>
                  </li>
                ) : null}
                {workspace.reuseImprovement.applicability ? (
                  <li>
                    <strong>applicability</strong>
                    <div className="subtle">
                      required: {workspace.reuseImprovement.applicability.required_tags.join(", ") || "none"} | preferred:{" "}
                      {workspace.reuseImprovement.applicability.preferred_tags.join(", ") || "none"}
                    </div>
                  </li>
                ) : null}
                {(workspace.reuseImprovement.failure_boundaries?.length ?? 0) > 0 ? (
                  <li>
                    <strong>failure boundaries</strong>
                    <div className="subtle">{workspace.reuseImprovement.failure_boundaries?.join(" | ")}</div>
                  </li>
                ) : null}
                {(workspace.reuseImprovement.target_improvement_hints?.length ?? 0) > 0 ? (
                  <li>
                    <strong>existing improvement hints</strong>
                    <ul>
                      {workspace.reuseImprovement.target_improvement_hints?.slice(0, 4).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </li>
                ) : null}
                {(workspace.reuseImprovement.evidence?.length ?? 0) > 0 ? (
                  <li>
                    <strong>evidence</strong>
                    <ul>
                      {workspace.reuseImprovement.evidence?.slice(0, 4).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </li>
                ) : null}
              </ul>
              {workspace.reuseImprovement.deep_link ? (
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() =>
                      navigateToDesktopTarget(
                        parseDesktopDeepLink(workspace.reuseImprovement?.deep_link ?? "")
                          ?? (workspace.reuseImprovement!.target_kind === "execution_template"
                            ? {
                                kind: "execution_template",
                                taskId: workspace.reuseImprovement!.target_task_id ?? workspace.task.task_id,
                                templateId: workspace.reuseImprovement!.target_id
                              }
                            : {
                                kind: "learned_playbook",
                                taskId: workspace.reuseImprovement!.target_task_id ?? workspace.task.task_id,
                                playbookId: workspace.reuseImprovement!.target_id
                              }),
                        { source: "workspace_click" }
                      ).catch(cause => setError((cause as Error).message))
                    }
                  >
                    Focus
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      copyDesktopDeepLink(
                        parseDesktopDeepLink(workspace.reuseImprovement?.deep_link ?? "")
                          ?? (workspace.reuseImprovement!.target_kind === "execution_template"
                            ? {
                                kind: "execution_template",
                                taskId: workspace.reuseImprovement!.target_task_id ?? workspace.task.task_id,
                                templateId: workspace.reuseImprovement!.target_id
                              }
                            : {
                                kind: "learned_playbook",
                                taskId: workspace.reuseImprovement!.target_task_id ?? workspace.task.task_id,
                                playbookId: workspace.reuseImprovement!.target_id
                              })
                      ).catch(cause => setError((cause as Error).message))
                    }
                  >
                    Copy Link
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {selectedExecutionPlaybook ? (
            <section className="card" ref={executionPlaybookRef}>
              <h3>Selected Related Playbook</h3>
              <p>
                <strong>{selectedExecutionPlaybook.title}</strong>
                <span className="badge completed" style={{ marginLeft: 8 }}>
                  {selectedExecutionPlaybook.status}
                </span>
              </p>
              <div className="actions" style={{ marginBottom: 8 }}>
                <button
                  className="secondary"
                  onClick={() =>
                    navigateToDesktopTarget(
                      parseDesktopDeepLink(selectedExecutionPlaybook.deep_link ?? "")
                        ?? {
                          kind: "learned_playbook",
                          taskId: workspace?.task.task_id ?? "",
                          playbookId: selectedExecutionPlaybook.candidate_id
                        },
                      { source: "workspace_click" }
                    ).catch(cause => setError((cause as Error).message))
                  }
                >
                  Focus
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    copyDesktopDeepLink(
                      parseDesktopDeepLink(selectedExecutionPlaybook.deep_link ?? "")
                        ?? {
                          kind: "learned_playbook",
                          taskId: workspace?.task.task_id ?? "",
                          playbookId: selectedExecutionPlaybook.candidate_id
                        }
                    ).catch(cause => setError((cause as Error).message))
                  }
                >
                  Copy Link
                </button>
              </div>
              <p className="subtle">{selectedExecutionPlaybook.summary}</p>
              <p className="subtle">
                version {selectedExecutionPlaybook.version} / validated by {selectedExecutionPlaybook.source_task_count} task(s)
              </p>
              <p className="subtle">
                required: {selectedExecutionPlaybook.applicability.required_tags.join(", ") || "none"} | preferred:{" "}
                {selectedExecutionPlaybook.applicability.preferred_tags.join(", ") || "none"}
              </p>
              <p className="subtle">
                boundaries: {selectedExecutionPlaybook.failure_boundaries.join(" | ") || "none recorded"}
              </p>
              {(selectedExecutionPlaybook.improvement_hints?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle">improvement hints</p>
                  <ul>
                    {selectedExecutionPlaybook.improvement_hints.slice(0, 4).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(selectedExecutionPlaybook.evidence?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle">evidence</p>
                  <ul>
                    {selectedExecutionPlaybook.evidence.slice(0, 5).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}

          <section className="card">
            <h3>Execution Plan</h3>
            <ul>
              {(workspace?.task.execution_plan ?? []).map(step => (
                <li key={step.step_id}>
                  <strong>{step.title}</strong>
                  <span className={`badge ${step.status}`}>{step.status}</span>
                </li>
              ))}
            </ul>
          </section>

          {workspace?.runtimeBoundaries ? (
            <section className="card">
              <h3>Runtime Boundaries</h3>
              <ul>
                <li>
                  <strong>session</strong>
                  <div className="subtle">
                    {workspace.runtimeBoundaries.session.memory_strategy} / {workspace.runtimeBoundaries.session.memory_items} memory item(s) /{" "}
                    {workspace.runtimeBoundaries.session.checkpoint_count} checkpoint(s)
                  </div>
                  <div className="subtle">
                    methodology: {workspace.runtimeBoundaries.session.methodology_items} / promoted:{" "}
                    {workspace.runtimeBoundaries.session.promoted_memory ? "yes" : "no"}
                  </div>
                </li>
                <li>
                  <strong>harness</strong>
                  <div className="subtle">
                    {workspace.runtimeBoundaries.harness.planner_mode} / capability resolutions:{" "}
                    {workspace.runtimeBoundaries.harness.capability_resolution_count}
                  </div>
                  <div className="subtle">
                    fast-path reuse: {workspace.runtimeBoundaries.harness.fast_path_reuse ? "yes" : "no"} / verification:{" "}
                    {workspace.runtimeBoundaries.harness.verification_stack.join(", ")}
                  </div>
                </li>
                <li>
                  <strong>sandbox</strong>
                  <div className="subtle">
                    {workspace.runtimeBoundaries.sandbox.isolation_tier} / {workspace.runtimeBoundaries.sandbox.execution_profile}
                  </div>
                  <div className="subtle">
                    guarded scopes: {workspace.runtimeBoundaries.sandbox.guarded_scopes.join(", ") || "none"} / mutation present:{" "}
                    {workspace.runtimeBoundaries.sandbox.mutation_present ? "yes" : "no"}
                  </div>
                  {workspace.runtimeBoundaries.sandbox.future_upgrade_path ? (
                    <div className="subtle">{workspace.runtimeBoundaries.sandbox.future_upgrade_path}</div>
                  ) : null}
                </li>
              </ul>
            </section>
          ) : null}

          {workspace?.agentTeam ? (
            <section className="card">
              <h3>Agent Team</h3>
              <ul>
                <li>
                  <strong>team mode</strong>
                  <div className="subtle">
                    {workspace.agentTeam.summary.mode} / status {workspace.agentTeam.summary.status} / supervisor{" "}
                    {workspace.agentTeam.summary.supervisor_session_id ?? "not assigned"}
                  </div>
                  <div className="subtle">resume supported: {workspace.agentTeam.summary.resume_supported ? "yes" : "no"}</div>
                </li>
                <li>
                  <strong>sessions</strong>
                  <div className="subtle">
                    total {workspace.agentTeam.summary.session_count} / active {workspace.agentTeam.summary.active_session_count} / completed{" "}
                    {workspace.agentTeam.summary.completed_session_count}
                  </div>
                  <div className="subtle">
                    isolated contexts {workspace.agentTeam.summary.isolated_context_count} / messages {workspace.agentTeam.summary.message_count} /
                    checkpoints {workspace.agentTeam.summary.checkpoint_count}
                  </div>
                  <div className="subtle">
                    handoffs {(workspace.agentTeam.messages ?? []).filter(message => message.kind === "handoff").length} / timeline events{" "}
                    {(workspace.agentTeam.timeline ?? []).length}
                  </div>
                  <div className="subtle">
                    resume requests {(workspace.agentTeam.resumeRequests ?? []).length}
                  </div>
                </li>
                {workspace.agentTeam.summary.future_upgrade_path ? (
                  <li>
                    <strong>future upgrade path</strong>
                    <div className="subtle">{workspace.agentTeam.summary.future_upgrade_path}</div>
                  </li>
                ) : null}
              </ul>
              <div className="card-grid" style={{ marginTop: 12 }}>
                {(workspace.agentTeam.sessions ?? []).map(session => (
                  <div className="card nested-card" key={session.subagent_session_id}>
                    <strong>{session.role}</strong>
                    <div className="subtle">
                      {session.worker_name} ({session.worker_kind}) / {session.status}
                    </div>
                    <div className="subtle">
                      context {session.isolated_context_key} / checkpoints {session.checkpoint_count} / messages {session.message_count}
                    </div>
                    <div className="subtle">
                      resume: {session.resume_supported ? "yes" : "no"} / last message {session.last_message_id ?? "none"}
                    </div>
                    {session.result_summary ? <div className="subtle">{session.result_summary}</div> : null}
                    {session.resume_supported ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!canOperate || busyAction === `agent-team-resume:${session.subagent_session_id}`}
                        onClick={() => requestAgentTeamResume(session.subagent_session_id)}
                      >
                        Request Resume
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="tool-actions compact-grid" style={{ marginTop: 12 }}>
                <label className="tool-field">
                  <span>Delegated resume note</span>
                  <input
                    value={agentTeamResumeReason}
                    onChange={event => setAgentTeamResumeReason(event.target.value)}
                    placeholder="Why should this delegated session resume, or how should this request be handled?"
                  />
                </label>
                <label className="tool-field">
                  <span>Delegated runtime launcher</span>
                  <select
                    value={agentTeamLauncherKind}
                    onChange={event => {
                      const nextLauncherKind = event.target.value as "worker_run" | "sandbox_runner" | "cloud_runner";
                      setAgentTeamLauncherKind(nextLauncherKind);
                      const matchingDriver = agentTeamLauncherDriverCatalog.find(item => item.launcher_kind === nextLauncherKind);
                      if (matchingDriver) {
                        setAgentTeamLauncherDriverId(matchingDriver.driver_id);
                      }
                      setAgentTeamLauncherLocator("");
                    }}
                  >
                    {agentTeamLauncherCatalog.map(item => (
                      <option key={item.launcher_kind} value={item.launcher_kind}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tool-field">
                  <span>Launcher driver</span>
                  <select
                    value={agentTeamLauncherDriverId}
                    onChange={event => {
                      setAgentTeamLauncherDriverId(
                        event.target.value as "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver"
                      );
                      setAgentTeamLauncherLocator("");
                    }}
                  >
                    {availableAgentTeamLauncherDrivers.map(item => (
                      <option key={item.driver_id} value={item.driver_id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tool-field">
                  <span>Launcher locator</span>
                  <input
                    value={agentTeamLauncherLocator}
                    onChange={event => setAgentTeamLauncherLocator(event.target.value)}
                    placeholder={
                      selectedAgentTeamLauncherDriver?.locator_placeholder
                      ?? selectedAgentTeamLauncher?.locator_placeholder
                      ?? "Optional unless the launcher requires one"
                    }
                  />
                </label>
              </div>
              {selectedAgentTeamLauncher ? (
                <div className="subtle" style={{ marginTop: 8 }}>
                  {selectedAgentTeamLauncher.description}
                  {" "}
                  / runtime {selectedAgentTeamLauncher.runtime_kind}
                  {" "}
                  / attachment {selectedAgentTeamLauncher.attachment_mode}
                  {selectedAgentTeamLauncher.future_upgrade_path ? ` / ${selectedAgentTeamLauncher.future_upgrade_path}` : ""}
                </div>
              ) : null}
              {selectedAgentTeamLauncherStatus ? (
                <div className="subtle" style={{ marginTop: 4 }}>
                  status {selectedAgentTeamLauncherStatus.availability}
                  {" "}
                  / active {selectedAgentTeamLauncherStatus.active_runtime_count}
                  {" "}
                  / pending {selectedAgentTeamLauncherStatus.pending_attachment_count}
                  {" "}
                  / released {selectedAgentTeamLauncherStatus.released_runtime_count}
                  {" "}
                  / {selectedAgentTeamLauncherStatus.recommended_action}
                </div>
              ) : null}
              {selectedAgentTeamLauncherDriver ? (
                <div className="subtle" style={{ marginTop: 4 }}>
                  driver {selectedAgentTeamLauncherDriver.driver_id}
                  {" "}
                  / health contract {selectedAgentTeamLauncherDriver.health_contract}
                  {" "}
                  / isolation {selectedAgentTeamLauncherDriver.isolation_scope}
                  {" "}
                  / quota {selectedAgentTeamLauncherDriver.quota_profile}
                  {" "}
                  / mutation guarded {selectedAgentTeamLauncherDriver.mutation_guarded ? "yes" : "no"}
                  {" "}
                  / capabilities {selectedAgentTeamLauncherDriver.capability_flags.join(", ") || "none"}
                  {selectedAgentTeamLauncherDriver.future_upgrade_path ? ` / ${selectedAgentTeamLauncherDriver.future_upgrade_path}` : ""}
                </div>
              ) : null}
              {selectedAgentTeamLauncherDriverStatus ? (
                <div className="subtle" style={{ marginTop: 4 }}>
                  driver health {selectedAgentTeamLauncherDriverStatus.health}
                  {" "}
                  / active {selectedAgentTeamLauncherDriverStatus.active_runtime_count}
                  {" "}
                  / pending {selectedAgentTeamLauncherDriverStatus.pending_attachment_count}
                  {" "}
                  / released {selectedAgentTeamLauncherDriverStatus.released_runtime_count}
                  {" "}
                  / {selectedAgentTeamLauncherDriverStatus.recommended_action}
                </div>
              ) : null}
              {selectedAgentTeamLauncherBackendAdapter ? (
                <div className="subtle" style={{ marginTop: 4 }}>
                  backend adapter {selectedAgentTeamLauncherBackendAdapter.adapter_id}
                  {" "}
                  / consume {selectedAgentTeamLauncherBackendAdapter.consumption_mode}
                  {" "}
                  / execution {selectedAgentTeamLauncherBackendAdapter.execution_style}
                  {" "}
                  / heartbeat {selectedAgentTeamLauncherBackendAdapter.heartbeat_contract}
                  {selectedAgentTeamLauncherBackendAdapter.future_upgrade_path
                    ? ` / ${selectedAgentTeamLauncherBackendAdapter.future_upgrade_path}`
                    : ""}
                </div>
              ) : null}
              {selectedAgentTeamLauncherBackendAdapterStatus ? (
                <div className="subtle" style={{ marginTop: 4 }}>
                  backend health {selectedAgentTeamLauncherBackendAdapterStatus.health}
                  {" "}
                  / receipts {selectedAgentTeamLauncherBackendAdapterStatus.launched_receipt_count}
                  {" "}
                  / active runs {selectedAgentTeamLauncherBackendAdapterStatus.active_adapter_run_count}
                  {" "}
                  / completed {selectedAgentTeamLauncherBackendAdapterStatus.completed_adapter_run_count}
                  {" "}
                  / failed {selectedAgentTeamLauncherBackendAdapterStatus.failed_adapter_run_count}
                  {" "}
                  / {selectedAgentTeamLauncherBackendAdapterStatus.recommended_action}
                </div>
              ) : null}
              {(workspace.agentTeam.messages?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Supervisor and worker messages</p>
                  <ul>
                    {workspace.agentTeam.messages.slice(-6).map(message => (
                      <li key={message.message_id}>
                        <strong>{message.kind}</strong> / {message.direction}
                        <div className="subtle">{message.summary}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.checkpoints?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Delegated checkpoints</p>
                  <ul>
                    {workspace.agentTeam.checkpoints.slice(-6).map(checkpoint => (
                      <li key={checkpoint.checkpoint_id}>
                        <strong>{checkpoint.stage}</strong>
                        <div className="subtle">
                          {checkpoint.subagent_session_id} / {checkpoint.summary}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.resumeRequests?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Delegated resume requests</p>
                  <ul>
                    {workspace.agentTeam.resumeRequests.slice(-6).map(request => (
                      <li key={request.request_id}>
                        <strong>{request.status}</strong> / {request.subagent_session_id}
                        <div className="subtle">
                          actor {request.actor_role} / checkpoint {request.last_checkpoint_id ?? "latest state"}
                        </div>
                        {request.accepted_by || request.accepted_at ? (
                          <div className="subtle">
                            accepted by {request.accepted_by ?? "unknown"} / {request.accepted_at ?? "unknown time"}
                          </div>
                        ) : null}
                        {request.resolved_by || request.resolved_at ? (
                          <div className="subtle">
                            resolved by {request.resolved_by ?? "unknown"} / {request.resolved_at ?? "unknown time"}
                          </div>
                        ) : null}
                        {request.resolution_note ? <div className="subtle">note: {request.resolution_note}</div> : null}
                        <div className="subtle">{request.result_summary ?? request.reason ?? "Resume request submitted."}</div>
                        {request.status === "pending" ? (
                          <div className="tool-actions" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!canOperate || busyAction === `agent-team-resume-accept:${request.request_id}`}
                              onClick={() => updateAgentTeamResumeRequest(request.request_id, "accept")}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="secondary-button danger-button"
                              disabled={!canOperate || busyAction === `agent-team-resume-reject:${request.request_id}`}
                              onClick={() => updateAgentTeamResumeRequest(request.request_id, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                        {request.status === "accepted" ? (
                          <div className="tool-actions" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!canOperate || busyAction === `agent-team-resume-complete:${request.request_id}`}
                              onClick={() => updateAgentTeamResumeRequest(request.request_id, "complete")}
                            >
                              Mark Handled
                            </button>
                            <button
                              type="button"
                              className="secondary-button danger-button"
                              disabled={!canOperate || busyAction === `agent-team-resume-reject:${request.request_id}`}
                              onClick={() => updateAgentTeamResumeRequest(request.request_id, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.resumePackages?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Delegated resume packages</p>
                  <ul>
                    {workspace.agentTeam.resumePackages.slice(-6).map(item => (
                      <li key={item.package_id}>
                        <strong>{item.status}</strong> / {item.subagent_session_id}
                        <div className="subtle">
                          package {item.package_id} / request {item.request_id}
                        </div>
                        <div className="subtle">
                          checkpoint {item.handoff_checkpoint_id} / created by {item.created_by}
                        </div>
                        {item.execution_state_summary ? (
                          <div className="subtle">execution state: {item.execution_state_summary}</div>
                        ) : null}
                        {item.applied_by || item.applied_at ? (
                          <div className="subtle">
                            applied by {item.applied_by ?? "unknown"} / {item.applied_at ?? "unknown time"}
                          </div>
                        ) : null}
                        {item.applied_checkpoint_id ? (
                          <div className="subtle">applied checkpoint: {item.applied_checkpoint_id}</div>
                        ) : null}
                        {item.applied_note ? <div className="subtle">note: {item.applied_note}</div> : null}
                        <div className="subtle">{item.package_summary}</div>
                        {item.status === "prepared" ? (
                          <div className="tool-actions" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!canOperate || busyAction === `agent-team-resume-package-apply:${item.package_id}`}
                              onClick={() => applyAgentTeamResumePackage(item.package_id)}
                            >
                              Apply Package
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.executionRuns?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Delegated execution runs</p>
                  <ul>
                    {workspace.agentTeam.executionRuns.slice(-6).map(item => (
                      <li key={item.execution_run_id}>
                        <strong>{item.status}</strong> / {item.subagent_session_id}
                        <div className="subtle">
                          run {item.execution_run_id} / package {item.package_id}
                        </div>
                        <div className="subtle">
                          started by {item.started_by} / checkpoint {item.start_checkpoint_id}
                        </div>
                        {item.latest_checkpoint_id ? (
                          <div className="subtle">latest checkpoint: {item.latest_checkpoint_id}</div>
                        ) : null}
                        {item.result_summary ? <div className="subtle">{item.result_summary}</div> : null}
                        {item.completion_note ? <div className="subtle">note: {item.completion_note}</div> : null}
                        {item.status === "running" ? (
                          <div className="tool-actions" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={
                                !canOperate
                                || busyAction === `agent-team-execution-run-bind:${item.execution_run_id}`
                                || workspace.agentTeam.runtimeBindings.some(
                                  binding => binding.execution_run_id === item.execution_run_id && binding.status === "bound"
                                )
                                || (selectedAgentTeamLauncherDriver?.requires_locator === true && agentTeamLauncherLocator.trim().length === 0)
                              }
                              onClick={() => bindAgentTeamExecutionRun(item.execution_run_id)}
                            >
                              Bind Runtime
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!canOperate || busyAction === `agent-team-execution-run-complete:${item.execution_run_id}`}
                              onClick={() => updateAgentTeamExecutionRun(item.execution_run_id, "complete")}
                            >
                              Mark Complete
                            </button>
                            <button
                              type="button"
                              className="secondary-button danger-button"
                              disabled={!canOperate || busyAction === `agent-team-execution-run-fail:${item.execution_run_id}`}
                              onClick={() => updateAgentTeamExecutionRun(item.execution_run_id, "fail")}
                            >
                              Mark Failed
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeBindings?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime bindings</p>
                  <ul>
                    {workspace.agentTeam.runtimeBindings.slice(-6).map(item => (
                      <li key={item.binding_id}>
                        <strong>{item.status}</strong> / {item.execution_run_id}
                        <div className="subtle">
                          binding {item.binding_id} / {item.runtime_kind} / {item.sandbox_profile}
                        </div>
                        <div className="subtle">
                          bound by {item.bound_by} / {item.bound_at}
                        </div>
                        {item.runtime_locator ? <div className="subtle">locator: {item.runtime_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">latest heartbeat: {item.latest_heartbeat_at}</div>
                        ) : null}
                        {item.released_at ? <div className="subtle">released at {item.released_at}</div> : null}
                        {item.release_reason ? <div className="subtle">release reason: {item.release_reason}</div> : null}
                        {item.status === "bound" ? (
                          <div className="tool-actions" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="secondary-button danger-button"
                              disabled={!canOperate || busyAction === `agent-team-runtime-binding-release:${item.binding_id}`}
                              onClick={() => releaseAgentTeamRuntimeBinding(item.binding_id)}
                            >
                              Release Binding
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeInstances?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime instances</p>
                  <ul>
                    {workspace.agentTeam.runtimeInstances.slice(-6).map(item => (
                      <li key={item.instance_id}>
                        <strong>{item.status}</strong> / {item.execution_run_id}
                        <div className="subtle">
                          instance {item.instance_id} / binding {item.binding_id}
                        </div>
                        <div className="subtle">
                          {item.runtime_kind} / {item.sandbox_profile} / launched by {item.launched_by}
                        </div>
                        <div className="subtle">launched at {item.launched_at}</div>
                        <div className="subtle">
                          launcher {item.launcher_kind}
                          {` / driver ${item.launcher_driver_id}`}
                          {item.launcher_worker_run_id ? ` / worker ${item.launcher_worker_run_id}` : ""}
                        </div>
                        <div className="subtle">
                          isolation {item.isolation_scope} / quota {item.quota_profile} / mutation guarded {item.mutation_guarded ? "yes" : "no"}
                        </div>
                        <div className="subtle">launcher state: {item.launcher_state}</div>
                        {item.launcher_locator ? <div className="subtle">launcher locator: {item.launcher_locator}</div> : null}
                        {item.launcher_attached_at ? (
                          <div className="subtle">launcher attached at {item.launcher_attached_at}</div>
                        ) : null}
                        {item.launcher_summary ? <div className="subtle">{item.launcher_summary}</div> : null}
                        {item.runtime_locator ? <div className="subtle">locator: {item.runtime_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.finished_at ? <div className="subtle">finished at {item.finished_at}</div> : null}
                        {item.finish_reason ? <div className="subtle">finish reason: {item.finish_reason}</div> : null}
                        {item.status === "active" ? (
                          <div className="inline-actions">
                            {item.launcher_state === "external_pending" ? (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-instance-launch:${item.instance_id}`}
                                onClick={() => launchAgentTeamRuntimeInstance(item.instance_id)}
                              >
                                Launch Runtime
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!canOperate || busyAction === `agent-team-runtime-instance-heartbeat:${item.instance_id}`}
                              onClick={() => heartbeatAgentTeamRuntimeInstance(item.instance_id)}
                            >
                              Heartbeat
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeLaunchSpecs?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime launch specs</p>
                  <ul>
                    {workspace.agentTeam.runtimeLaunchSpecs.slice(-6).map(item => (
                      <li key={item.launch_spec_id}>
                        <strong>{item.launcher_kind}</strong> / {item.runtime_kind}
                        <div className="subtle">
                          spec {item.launch_spec_id} / instance {item.instance_id}
                        </div>
                        <div className="subtle">
                          checkpoint {item.handoff_checkpoint_id} / consumer v{item.consumer_contract_version}
                        </div>
                        <div className="subtle">
                          driver {item.launcher_driver_id}
                          {` / isolation ${item.isolation_scope}`}
                          {` / quota ${item.quota_profile}`}
                        </div>
                        {item.execution_state_summary ? (
                          <div className="subtle">execution state: {item.execution_state_summary}</div>
                        ) : null}
                        <div className="subtle">{item.package_summary}</div>
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Launch spec ${item.launch_spec_id}`)}
                          >
                            Copy Launch Spec
                          </button>
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeLaunchReceipts?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime launch receipts</p>
                  <ul>
                    {workspace.agentTeam.runtimeLaunchReceipts.slice(-6).map(item => (
                      <li key={item.receipt_id}>
                        <strong>{item.status}</strong> / {item.backend_kind}
                        <div className="subtle">
                          receipt {item.receipt_id} / instance {item.instance_id}
                        </div>
                        <div className="subtle">
                          driver {item.launcher_driver_id} / launched by {item.launched_by} / {item.launched_at}
                        </div>
                        {item.launch_locator ? <div className="subtle">launch locator: {item.launch_locator}</div> : null}
                        {item.execution_locator ? <div className="subtle">execution locator: {item.execution_locator}</div> : null}
                        {item.note ? <div className="subtle">{item.note}</div> : null}
                        {item.failure_reason ? <div className="subtle">failure: {item.failure_reason}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Launch receipt ${item.receipt_id}`)}
                          >
                            Copy Launch Receipt
                          </button>
                          {item.status === "launched" ? (
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!canOperate || busyAction === `agent-team-runtime-receipt-consume:${item.receipt_id}`}
                              onClick={() => consumeAgentTeamRuntimeLaunchReceipt(item.receipt_id)}
                            >
                              Consume Receipt
                            </button>
                          ) : null}
                          {item.status === "launched" ? (
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!canOperate || busyAction === `agent-team-runtime-adapter-start:${item.receipt_id}`}
                              onClick={() => startAgentTeamRuntimeAdapter(item.receipt_id)}
                            >
                              Start Adapter
                            </button>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeAdapterRuns?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime adapter runs</p>
                  <ul>
                    {workspace.agentTeam.runtimeAdapterRuns.slice(-6).map(item => (
                      <li key={item.adapter_run_id}>
                        <strong>{item.status}</strong> / {item.backend_kind}
                        <div className="subtle">
                          adapter {item.adapter_run_id} / receipt {item.receipt_id}
                        </div>
                        <div className="subtle">
                          driver {item.launcher_driver_id} / started by {item.started_by} / {item.started_at}
                        </div>
                        {item.launch_locator ? <div className="subtle">launch locator: {item.launch_locator}</div> : null}
                        {item.execution_locator ? <div className="subtle">execution locator: {item.execution_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.completed_at ? <div className="subtle">completed at {item.completed_at}</div> : null}
                        {item.completion_note ? <div className="subtle">{item.completion_note}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Adapter run ${item.adapter_run_id}`)}
                          >
                            Copy Adapter Run
                          </button>
                          {item.status === "running" ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-backend-lease-acquire:${item.adapter_run_id}`}
                                onClick={() => acquireAgentTeamRunnerBackendLease(item.adapter_run_id)}
                              >
                                Allocate Lease
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-backend-start:${item.adapter_run_id}`}
                                onClick={() => startAgentTeamRuntimeBackendExecution(item.adapter_run_id)}
                              >
                                Execute Backend
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-adapter-heartbeat:${item.adapter_run_id}`}
                                onClick={() => heartbeatAgentTeamRuntimeAdapter(item.adapter_run_id)}
                              >
                                Heartbeat Adapter
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-adapter-complete:${item.adapter_run_id}`}
                                onClick={() => finalizeAgentTeamRuntimeAdapter(item.adapter_run_id, "complete")}
                              >
                                Complete Adapter
                              </button>
                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-adapter-fail:${item.adapter_run_id}`}
                                onClick={() => finalizeAgentTeamRuntimeAdapter(item.adapter_run_id, "fail")}
                              >
                                Fail Adapter
                              </button>
                            </>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(agentTeamLauncherStatuses?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Launcher backends</p>
                  <ul>
                    {agentTeamLauncherStatuses.map(item => (
                      <li key={item.launcher_kind}>
                        <strong>{item.launcher_kind}</strong> / {item.availability}
                        <div className="subtle">
                          active {item.active_runtime_count} / pending {item.pending_attachment_count} / released {item.released_runtime_count}
                        </div>
                        <div className="subtle">{item.summary}</div>
                        <div className="subtle">{item.recommended_action}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(agentTeamLauncherDriverStatuses?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Launcher drivers</p>
                  <ul>
                    {agentTeamLauncherDriverStatuses.map(item => (
                      <li key={item.driver_id}>
                        <strong>{item.driver_id}</strong> / {item.health} / launcher {item.launcher_kind}
                        <div className="subtle">
                          active {item.active_runtime_count} / pending {item.pending_attachment_count} / released {item.released_runtime_count}
                        </div>
                        <div className="subtle">{item.summary}</div>
                        <div className="subtle">{item.recommended_action}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(agentTeamLauncherBackendAdapterStatuses?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Launcher backend adapters</p>
                  <ul>
                    {agentTeamLauncherBackendAdapterStatuses.map(item => (
                      <li key={item.adapter_id}>
                        <strong>{item.adapter_id}</strong> / {item.health} / backend {item.backend_kind}
                        <div className="subtle">
                          receipts {item.launched_receipt_count} / active runs {item.active_adapter_run_count} / completed {item.completed_adapter_run_count} / failed {item.failed_adapter_run_count}
                        </div>
                        <div className="subtle">{item.summary}</div>
                        <div className="subtle">{item.recommended_action}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(agentTeamRunnerBackendAdapterStatuses?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runner backend adapters</p>
                  <ul>
                    {agentTeamRunnerBackendAdapterStatuses.map(item => (
                      <li key={item.adapter_id}>
                        <strong>{item.adapter_id}</strong> / {item.health} / runner {item.runner_kind}
                        <div className="subtle">
                          running {item.running_execution_count} / completed {item.completed_execution_count} / failed {item.failed_execution_count}
                        </div>
                        <div className="subtle">{item.summary}</div>
                        <div className="subtle">{item.recommended_action}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeRunnerBackendLeases?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime runner backend leases</p>
                  <ul>
                    {workspace.agentTeam.runtimeRunnerBackendLeases.slice(-6).map(item => (
                      <li key={item.lease_id}>
                        <strong>{item.status}</strong> / {item.adapter_id}
                        <div className="subtle">
                          lease {item.lease_id} / adapter run {item.adapter_run_id}
                        </div>
                        <div className="subtle">
                          runner {item.runner_kind} / backend {item.backend_kind} / quota {item.quota_profile}
                        </div>
                        <div className="subtle">
                          allocated by {item.allocated_by} / {item.allocated_at}
                        </div>
                        {item.resource_locator ? <div className="subtle">resource locator: {item.resource_locator}</div> : null}
                        {item.execution_locator ? <div className="subtle">execution locator: {item.execution_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.released_at ? <div className="subtle">released at {item.released_at}</div> : null}
                        {item.release_note ? <div className="subtle">{item.release_note}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Runner backend lease ${item.lease_id}`)}
                          >
                            Copy Lease
                          </button>
                          {item.status === "allocated" ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-backend-lease-release:${item.lease_id}`}
                                onClick={() => finalizeAgentTeamRunnerBackendLease(item.lease_id, "release")}
                              >
                                Release Lease
                              </button>
                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-backend-lease-fail:${item.lease_id}`}
                                onClick={() => finalizeAgentTeamRunnerBackendLease(item.lease_id, "fail")}
                              >
                                Fail Lease
                              </button>
                            </>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeBackendExecutions?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime backend executions</p>
                  <ul>
                    {workspace.agentTeam.runtimeBackendExecutions.slice(-6).map(item => (
                      <li key={item.backend_execution_id}>
                        <strong>{item.status}</strong> / {item.backend_kind}
                        <div className="subtle">
                          backend execution {item.backend_execution_id} / adapter run {item.adapter_run_id}
                        </div>
                        <div className="subtle">
                          adapter {item.adapter_id} / driver {item.launcher_driver_id} / style {item.execution_style}
                        </div>
                        <div className="subtle">
                          started by {item.started_by} / {item.started_at}
                        </div>
                        {item.lease_id ? <div className="subtle">lease {item.lease_id}</div> : null}
                        {item.launch_locator ? <div className="subtle">launch locator: {item.launch_locator}</div> : null}
                        {item.execution_locator ? <div className="subtle">execution locator: {item.execution_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.completed_at ? <div className="subtle">completed at {item.completed_at}</div> : null}
                        {item.completion_note ? <div className="subtle">{item.completion_note}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Backend execution ${item.backend_execution_id}`)}
                          >
                            Copy Backend Execution
                          </button>
                          {item.status === "running" ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-driver-start:${item.backend_execution_id}`}
                                onClick={() => startAgentTeamRuntimeDriverRun(item.backend_execution_id)}
                              >
                                Start Driver
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-backend-heartbeat:${item.backend_execution_id}`}
                                onClick={() => heartbeatAgentTeamRuntimeBackendExecution(item.backend_execution_id)}
                              >
                                Heartbeat Backend
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-backend-complete:${item.backend_execution_id}`}
                                onClick={() => finalizeAgentTeamRuntimeBackendExecution(item.backend_execution_id, "complete")}
                              >
                                Complete Backend
                              </button>
                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-backend-fail:${item.backend_execution_id}`}
                                onClick={() => finalizeAgentTeamRuntimeBackendExecution(item.backend_execution_id, "fail")}
                              >
                                Fail Backend
                              </button>
                            </>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeDriverRuns?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime driver runs</p>
                  <ul>
                    {workspace.agentTeam.runtimeDriverRuns.slice(-6).map(item => (
                      <li key={item.driver_run_id}>
                        <strong>{item.status}</strong> / {item.backend_kind}
                        <div className="subtle">
                          driver run {item.driver_run_id} / backend execution {item.backend_execution_id}
                        </div>
                        <div className="subtle">
                          adapter {item.adapter_id} / driver {item.launcher_driver_id} / style {item.execution_style}
                        </div>
                        <div className="subtle">
                          started by {item.started_by} / {item.started_at}
                        </div>
                        {item.launch_locator ? <div className="subtle">launch locator: {item.launch_locator}</div> : null}
                        {item.execution_locator ? <div className="subtle">execution locator: {item.execution_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.completed_at ? <div className="subtle">completed at {item.completed_at}</div> : null}
                        {item.completion_note ? <div className="subtle">{item.completion_note}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Driver run ${item.driver_run_id}`)}
                          >
                            Copy Driver Run
                          </button>
                          {item.status === "running" ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-attach:${item.driver_run_id}`}
                                onClick={() => attachAgentTeamRuntimeRunnerHandle(item.driver_run_id)}
                              >
                                Attach Runner
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-driver-heartbeat:${item.driver_run_id}`}
                                onClick={() => heartbeatAgentTeamRuntimeDriverRun(item.driver_run_id)}
                              >
                                Heartbeat Driver
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-driver-complete:${item.driver_run_id}`}
                                onClick={() => finalizeAgentTeamRuntimeDriverRun(item.driver_run_id, "complete")}
                              >
                                Complete Driver
                              </button>
                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-driver-fail:${item.driver_run_id}`}
                                onClick={() => finalizeAgentTeamRuntimeDriverRun(item.driver_run_id, "fail")}
                              >
                                Fail Driver
                              </button>
                            </>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeRunnerHandles?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime runner handles</p>
                  <ul>
                    {workspace.agentTeam.runtimeRunnerHandles.slice(-6).map(item => (
                      <li key={item.runner_handle_id}>
                        <strong>{item.status}</strong> / {item.runner_kind}
                        <div className="subtle">
                          runner handle {item.runner_handle_id} / driver run {item.driver_run_id}
                        </div>
                        <div className="subtle">
                          adapter {item.adapter_id} / driver {item.launcher_driver_id} / backend {item.backend_kind}
                        </div>
                        <div className="subtle">
                          attached by {item.attached_by} / {item.attached_at}
                        </div>
                        {item.runner_locator ? <div className="subtle">runner locator: {item.runner_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.released_at ? <div className="subtle">released at {item.released_at}</div> : null}
                        {item.release_reason ? <div className="subtle">{item.release_reason}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Runner handle ${item.runner_handle_id}`)}
                          >
                            Copy Runner Handle
                          </button>
                          {item.status === "attached" ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-execution-start:${item.runner_handle_id}`}
                                onClick={() => startAgentTeamRuntimeRunnerExecution(item.runner_handle_id)}
                              >
                                Start Runner Execution
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-heartbeat:${item.runner_handle_id}`}
                                onClick={() => heartbeatAgentTeamRuntimeRunnerHandle(item.runner_handle_id, item.driver_run_id)}
                              >
                                Heartbeat Runner
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-release:${item.runner_handle_id}`}
                                onClick={() =>
                                  finalizeAgentTeamRuntimeRunnerHandle(item.runner_handle_id, item.driver_run_id, "release")
                                }
                              >
                                Release Runner
                              </button>
                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-fail:${item.runner_handle_id}`}
                                onClick={() =>
                                  finalizeAgentTeamRuntimeRunnerHandle(item.runner_handle_id, item.driver_run_id, "fail")
                                }
                              >
                                Fail Runner
                              </button>
                            </>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeRunnerExecutions?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime runner executions</p>
                  <ul>
                    {workspace.agentTeam.runtimeRunnerExecutions.slice(-6).map(item => (
                      <li key={item.runner_execution_id}>
                        <strong>{item.status}</strong> / {item.runner_kind}
                        <div className="subtle">
                          runner execution {item.runner_execution_id} / runner handle {item.runner_handle_id}
                        </div>
                        <div className="subtle">
                          adapter {item.adapter_id} / driver {item.launcher_driver_id} / backend {item.backend_kind}
                        </div>
                        <div className="subtle">
                          started by {item.started_by} / {item.started_at}
                        </div>
                        {item.execution_locator ? <div className="subtle">execution locator: {item.execution_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.completed_at ? (
                          <div className="subtle">
                            completed at {item.completed_at}
                            {item.completed_by ? ` / by ${item.completed_by}` : ""}
                          </div>
                        ) : null}
                        {item.completion_note ? <div className="subtle">{item.completion_note}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Runner execution ${item.runner_execution_id}`)}
                          >
                            Copy Runner Execution
                          </button>
                          {item.status === "running" ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-execution-heartbeat:${item.runner_execution_id}`}
                                onClick={() => heartbeatAgentTeamRuntimeRunnerExecution(item.runner_execution_id)}
                              >
                                Heartbeat Execution
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-execution-complete:${item.runner_execution_id}`}
                                onClick={() => finalizeAgentTeamRuntimeRunnerExecution(item.runner_execution_id, "complete")}
                              >
                                Complete Execution
                              </button>
                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={!canOperate || busyAction === `agent-team-runtime-runner-execution-fail:${item.runner_execution_id}`}
                                onClick={() => finalizeAgentTeamRuntimeRunnerExecution(item.runner_execution_id, "fail")}
                              >
                                Fail Execution
                              </button>
                            </>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.runtimeRunnerJobs?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Runtime runner jobs</p>
                  <ul>
                    {workspace.agentTeam.runtimeRunnerJobs.slice(-6).map(item => (
                      <li key={item.runner_job_id}>
                        <strong>{item.status}</strong> / {item.job_kind}
                        <div className="subtle">
                          runner job {item.runner_job_id} / runner execution {item.runner_execution_id}
                        </div>
                        <div className="subtle">
                          adapter {item.adapter_id} / driver {item.launcher_driver_id} / backend {item.backend_kind}
                        </div>
                        <div className="subtle">
                          started by {item.started_by} / {item.started_at}
                        </div>
                        {item.job_locator ? <div className="subtle">job locator: {item.job_locator}</div> : null}
                        {item.latest_heartbeat_at ? (
                          <div className="subtle">
                            last heartbeat: {item.latest_heartbeat_at}
                            {item.latest_heartbeat_note ? ` - ${item.latest_heartbeat_note}` : ""}
                          </div>
                        ) : null}
                        {item.completed_at ? (
                          <div className="subtle">
                            completed at {item.completed_at}
                            {item.completed_by ? ` / by ${item.completed_by}` : ""}
                          </div>
                        ) : null}
                        {item.completion_note ? <div className="subtle">{item.completion_note}</div> : null}
                        <div className="tool-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => copyJsonPayload(item, `Runner job ${item.runner_job_id}`)}
                          >
                            Copy Runner Job
                          </button>
                          {item.status === "running" ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runner-job-heartbeat:${item.runner_job_id}`}
                                onClick={() => heartbeatAgentTeamRuntimeRunnerJob(item.runner_job_id)}
                              >
                                Heartbeat Job
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!canOperate || busyAction === `agent-team-runner-job-complete:${item.runner_job_id}`}
                                onClick={() => finalizeAgentTeamRuntimeRunnerJob(item.runner_job_id, "complete")}
                              >
                                Complete Job
                              </button>
                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={!canOperate || busyAction === `agent-team-runner-job-fail:${item.runner_job_id}`}
                                onClick={() => finalizeAgentTeamRuntimeRunnerJob(item.runner_job_id, "fail")}
                              >
                                Fail Job
                              </button>
                            </>
                          ) : null}
                          {item.deep_link ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                const parsed = parseDesktopDeepLink(item.deep_link ?? "");
                                if (parsed) {
                                  navigateToDesktopTarget(parsed, { source: "workspace_click" }).catch(cause =>
                                    setError((cause as Error).message)
                                  );
                                }
                              }}
                            >
                              Focus
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(workspace.agentTeam.timeline?.length ?? 0) > 0 ? (
                <>
                  <p className="subtle" style={{ marginTop: 12 }}>Team timeline</p>
                  <ul>
                    {workspace.agentTeam.timeline.slice(-8).map(entry => (
                      <li key={entry.entry_id}>
                        <strong>{entry.event_kind}</strong> / {entry.source_type}
                        <div className="subtle">
                          {(entry.role ?? entry.subagent_session_id ?? "team")} / {entry.summary}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}

          <section className="card">
            <h3>Capability Strategy</h3>
            <ul>
              {(workspace?.capabilityResolutions ?? []).map(resolution => (
                <li key={resolution.resolution_id}>
                  <strong>{resolution.need_title}</strong>
                  <span className={`badge ${resolution.status}`}>{resolution.strategy}</span>
                  <div className="subtle">{resolution.reasoning}</div>
                  {resolution.selected_capabilities.length > 0 ? (
                    <div className="subtle">
                      {resolution.selected_capabilities.map(item => `${item.name} (${item.kind})`).join(", ")}
                    </div>
                  ) : (
                    <div className="subtle">No reusable capability matched. The task will fall back to local implementation.</div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Reuse Recommendations</h3>
            {(workspace?.reuseRecommendations?.length ?? 0) > 0 ? (
              <ul>
                {(workspace?.reuseRecommendations ?? []).map(item => (
                  <li key={`${item.kind}-${item.fingerprint ?? item.name}`}>
                    <strong>{item.name}</strong>
                    <span className="badge completed">{item.kind === "task_template" ? "template" : "playbook"}</span>
                    <div className="subtle">
                      score {item.score.toFixed(1)} / version {item.version} / validated by {item.source_task_count} task(s)
                    </div>
                    <div className="subtle">
                      required: {item.applicability.required_tags.join(", ") || "none"} | preferred: {item.applicability.preferred_tags.join(", ") || "none"}
                    </div>
                    <div className="subtle">
                      boundaries: {item.failure_boundaries.join(" | ") || "none recorded"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle">No learned playbook or task template is a strong enough match yet.</p>
            )}
          </section>

          <section className="card">
            <h3>Canonical Skills</h3>
            <div className="tool-grid compact">
              <label className="tool-field">
                <span>Search</span>
                <input
                  value={skillSearchQuery}
                  onChange={event => setSkillSearchQuery(event.target.value)}
                  placeholder="Search skill, trigger, capability"
                />
              </label>
              <label className="tool-field">
                <span>Source</span>
                <select value={skillSourceFilter} onChange={event => setSkillSourceFilter(event.target.value as CanonicalSkillSourceFilter)}>
                  <option value="all">all</option>
                  <option value="internal">internal</option>
                  <option value="openclaw">openclaw</option>
                  <option value="claude">claude</option>
                  <option value="openai">openai</option>
                </select>
              </label>
              <label className="tool-field">
                <span>Status</span>
                <select value={skillStatusFilter} onChange={event => setSkillStatusFilter(event.target.value as CanonicalSkillStatusFilter)}>
                  <option value="all">all</option>
                  <option value="review_required">review_required</option>
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
            </div>
            <div className="tool-actions">
              <button className="secondary" onClick={() => loadCanonicalSkills().catch(cause => setError((cause as Error).message))}>
                Refresh Skills
              </button>
              <button className="secondary" onClick={resetSkillFilters}>
                Reset Filters
              </button>
            </div>
            <p className="subtle">Review queue: {skillReviewQueue.length} skill(s) waiting for approval.</p>
            <div className="detail-panel">
              <h4>Import / Export</h4>
              <div className="tool-grid compact">
                <label className="tool-field">
                  <span>Document format</span>
                  <select value={skillImportFormat} onChange={event => setSkillImportFormat(event.target.value as SkillDocumentFormat)}>
                    <option value="canonical_json">canonical_json</option>
                    <option value="openclaw_markdown">openclaw_markdown</option>
                    <option value="claude_markdown">claude_markdown</option>
                    <option value="openai_json">openai_json</option>
                  </select>
                </label>
                <label className="tool-field">
                  <span>Import from file</span>
                  <input
                    value={skillImportPath}
                    onChange={event => setSkillImportPath(event.target.value)}
                    placeholder="Absolute path to a skill document"
                  />
                </label>
              </div>
              <label className="tool-field">
                <span>Import content</span>
                <textarea
                  value={skillImportContent}
                  onChange={event => setSkillImportContent(event.target.value)}
                  rows={8}
                  placeholder="Paste a skill document here"
                />
              </label>
              <div className="tool-actions">
                <button className="secondary" onClick={() => importSkillInline().catch(cause => setError((cause as Error).message))}>
                  Import Content
                </button>
                <button
                  className="secondary"
                  disabled={skillImportPath.trim().length === 0}
                  onClick={() => importSkillFile().catch(cause => setError((cause as Error).message))}
                >
                  Import File
                </button>
              </div>
              {skillExchangeMessage ? <p className="subtle">{skillExchangeMessage}</p> : null}
            </div>
            <div className="detail-panel">
              <h4>Promoted Bundle Export</h4>
              {skillReviewQueue.length > 0 ? (
                <>
                  <p className="subtle">Review queue</p>
                  <ul className="audit-list">
                    {skillReviewQueue.slice(0, 6).map(skill => (
                      <li key={skill.skill_id}>
                        <span>{skill.name}</span>
                        <span>{skill.status}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <div className="tag-row">
                {(["review_required", "active", "disabled"] as const).map(status => (
                  <button
                    key={status}
                    className="tag-chip"
                    onClick={() => toggleBundleStatus(status)}
                  >
                    {bundleExportStatuses.includes(status) ? "included" : "excluded"}: {status}
                  </button>
                ))}
              </div>
              <label className="tool-field">
                <span>Bundle export path</span>
                <input
                  value={bundleExportPath}
                  onChange={event => setBundleExportPath(event.target.value)}
                  placeholder="Absolute path for promoted bundle"
                />
              </label>
              <label className="tool-field">
                <span>Actor role</span>
                <input
                  value={skillActorRole}
                  onChange={event => setSkillActorRole(event.target.value)}
                  placeholder="admin"
                />
              </label>
              <label className="tool-field">
                <span>Publisher ID</span>
                <input
                  value={bundlePublisherId}
                  onChange={event => setBundlePublisherId(event.target.value)}
                  placeholder="desktop.local"
                />
              </label>
              <label className="tool-field">
                <span>Publisher name</span>
                <input
                  value={bundlePublisherName}
                  onChange={event => setBundlePublisherName(event.target.value)}
                  placeholder="Apex Desktop"
                />
              </label>
              <div className="grid-two">
                <label className="tool-field">
                  <span>Source environment</span>
                  <input
                    value={bundleSourceEnvironment}
                    onChange={event => setBundleSourceEnvironment(event.target.value)}
                    placeholder="desktop-local"
                  />
                </label>
                <label className="tool-field">
                  <span>Release channel</span>
                  <input
                    value={bundleReleaseChannel}
                    onChange={event => setBundleReleaseChannel(event.target.value)}
                    placeholder="promoted"
                  />
                </label>
              </div>
              <label className="tool-field">
                <span>Promotion note</span>
                <textarea
                  value={bundlePromotionNote}
                  onChange={event => setBundlePromotionNote(event.target.value)}
                  rows={3}
                  placeholder="Why this bundle is ready to promote."
                />
              </label>
              <label className="tool-field">
                <span>Bundle import / verify path</span>
                <input
                  value={bundleImportPath}
                  onChange={event => setBundleImportPath(event.target.value)}
                  placeholder="Absolute path to a bundle manifest"
                />
              </label>
              <div className="tool-actions">
                <button className="secondary" onClick={() => previewSkillBundle().catch(cause => setError((cause as Error).message))}>
                  Preview Bundle
                </button>
                <button
                  className="secondary"
                  disabled={bundleExportPath.trim().length === 0}
                  onClick={() => exportSkillBundleToFile().catch(cause => setError((cause as Error).message))}
                >
                  Export Bundle File
                </button>
                <button
                  className="secondary"
                  disabled={bundleImportPath.trim().length === 0}
                  onClick={() => simulateSkillBundlePolicy().catch(cause => setError((cause as Error).message))}
                >
                  Simulate Policy
                </button>
                <button
                  className="secondary"
                  disabled={bundleImportPath.trim().length === 0}
                  onClick={() => verifySkillBundleFile().catch(cause => setError((cause as Error).message))}
                >
                  Verify Bundle
                </button>
                <button
                  className="secondary"
                  disabled={bundleImportPath.trim().length === 0}
                  onClick={() => importSkillBundleFile(false).catch(cause => setError((cause as Error).message))}
                >
                  Import Bundle
                </button>
                <button
                  className="secondary"
                  disabled={bundleImportPath.trim().length === 0}
                  onClick={() => importSkillBundleFile(true).catch(cause => setError((cause as Error).message))}
                >
                  Import Trusted Bundle
                </button>
              </div>
              {bundleExportPreview ? (
                <label className="tool-field">
                  <span>Bundle preview</span>
                  <textarea value={bundleExportPreview} readOnly rows={8} />
                </label>
              ) : null}
              {bundlePolicySimulationPreview ? (
                <label className="tool-field">
                  <span>Policy simulation</span>
                  <textarea value={bundlePolicySimulationPreview} readOnly rows={8} />
                </label>
              ) : null}
              {bundleExportPreview ? (
                <p className="subtle">
                  Publisher {bundlePublisherName || bundlePublisherId} / env {bundleSourceEnvironment || "unspecified"} / channel {bundleReleaseChannel || "unspecified"}
                </p>
              ) : null}
              {bundleHistory.length > 0 ? (
                <>
                  <p className="subtle">Recent bundle activity</p>
                  <ul className="audit-list">
                    {bundleHistory.slice(0, 6).map(event => (
                      <li key={event.event_id}>
                        <span>{event.action}</span>
                        <span>
                          {event.bundle_name ?? "default"} / {event.actor_name ?? event.actor_id ?? "system"} / {new Date(event.occurred_at).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {skillPolicyDiagnostics ? (
                <div className="detail-panel">
                  <h4>Policy Diagnostics</h4>
                  <p className="subtle">
                    policy file: {skillPolicyDiagnostics.policy_file.path ?? "not configured"} (
                    {skillPolicyDiagnostics.policy_file.loaded ? "loaded" : "not loaded"})
                  </p>
                  {skillPolicyDiagnostics.policy_file.error ? (
                    <p className="subtle">policy file error: {skillPolicyDiagnostics.policy_file.error}</p>
                  ) : null}
                  {skillPolicyDiagnostics.policy_files.length > 0 ? (
                    <ul className="audit-list">
                      {skillPolicyDiagnostics.policy_files.map(item => (
                        <li key={item.scope}>
                          <strong>{item.scope}</strong>: {item.configured ? item.path ?? "configured" : "not configured"} /{" "}
                          {item.loaded ? "loaded" : "not loaded"}
                          {item.error ? ` / ${item.error}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {skillPolicyScopes.length > 0 ? (
                    <>
                      <label className="tool-field">
                        <span>Policy scope editor</span>
                        <select value={selectedPolicyScope} onChange={event => setSelectedPolicyScope(event.target.value as SkillPolicyScopeEntry["scope"])}>
                          {skillPolicyScopes.map(item => (
                            <option key={item.scope} value={item.scope}>
                              {item.scope}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tool-field">
                        <span>Scope path</span>
                        <input value={policyEditorPath} onChange={event => setPolicyEditorPath(event.target.value)} placeholder="Absolute path for this scope" />
                      </label>
                      <label className="tool-field">
                        <span>Rollback snapshot</span>
                        <select value={selectedPolicyRollbackAuditId} onChange={event => setSelectedPolicyRollbackAuditId(event.target.value)}>
                          <option value="">Latest snapshot</option>
                          {policyAudits
                            .filter(item => item.payload?.scope === selectedPolicyScope && item.action === "skill.policy_scope_updated")
                            .slice(0, 10)
                            .map(item => (
                              <option key={item.audit_id} value={item.audit_id}>
                                {new Date(item.created_at).toLocaleString()}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="tool-field">
                        <span>Scope config JSON</span>
                        <textarea value={policyEditorContent} onChange={event => setPolicyEditorContent(event.target.value)} rows={10} />
                      </label>
                      <div className="tool-actions">
                        <button className="secondary" onClick={() => loadSkillPolicyScopes().catch(cause => setError((cause as Error).message))}>
                          Reload Scope
                        </button>
                        <button className="secondary" onClick={() => previewPolicyDiff().catch(cause => setError((cause as Error).message))}>
                          Preview Diff
                        </button>
                        <button className="secondary" onClick={() => savePolicyScope().catch(cause => setError((cause as Error).message))}>
                          Save Scope
                        </button>
                        <button className="secondary" onClick={() => createPolicyScopeProposal().catch(cause => setError((cause as Error).message))}>
                          Create Scope Proposal
                        </button>
                        <button className="secondary" onClick={() => rollbackPolicyScope().catch(cause => setError((cause as Error).message))}>
                          Roll Back Scope
                        </button>
                      </div>
                      {policyDiffPreview ? (
                        <label className="tool-field">
                          <span>Effective diff preview</span>
                          <textarea value={policyDiffPreview} readOnly rows={8} />
                        </label>
                      ) : null}
                      <label className="tool-field">
                        <span>Policy bundle path</span>
                        <input value={policyBundlePath} onChange={event => setPolicyBundlePath(event.target.value)} placeholder="Absolute path for a policy bundle" />
                      </label>
                      <div className="grid-two">
                        <label className="tool-field">
                          <span>Promotion source scope</span>
                          <select
                            value={policyPromotionSourceScope}
                            onChange={event => setPolicyPromotionSourceScope(event.target.value as SkillPolicyScopeEntry["scope"])}
                          >
                            {skillPolicyScopes.map(item => (
                              <option key={`promotion-source-${item.scope}`} value={item.scope}>
                                {item.scope}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="tool-field">
                          <span>Promotion target scope</span>
                          <select
                            value={policyPromotionTargetScope}
                            onChange={event => setPolicyPromotionTargetScope(event.target.value as SkillPolicyScopeEntry["scope"])}
                          >
                            {skillPolicyScopes.map(item => (
                              <option key={`promotion-target-${item.scope}`} value={item.scope}>
                                {item.scope}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="tool-field">
                        <span>Proposal rationale</span>
                        <textarea
                          value={policyProposalRationale}
                          onChange={event => setPolicyProposalRationale(event.target.value)}
                          rows={3}
                          placeholder="Why this policy change or promotion should be approved."
                        />
                      </label>
                      {policyApprovalTemplates ? (
                        <div className="tool-actions">
                          <button className="secondary" onClick={() => applyPolicyTemplate("approval")}>
                            Use Approval Template
                          </button>
                          <button className="secondary" onClick={() => applyPolicyTemplate("rejection")}>
                            Use Rejection Template
                          </button>
                          <button className="secondary" onClick={() => applyPolicyTemplate("promotion")}>
                            Use Promotion Template
                          </button>
                        </div>
                      ) : null}
                      <div className="tool-actions">
                        <button className="secondary" onClick={() => previewPolicyBundle().catch(cause => setError((cause as Error).message))}>
                          Preview Policy Bundle
                        </button>
                        <button className="secondary" onClick={() => createPolicyPromotionProposal().catch(cause => setError((cause as Error).message))}>
                          Create Promotion Proposal
                        </button>
                        <button className="secondary" onClick={() => exportPolicyBundleToFile().catch(cause => setError((cause as Error).message))}>
                          Export Policy Bundle
                        </button>
                        <button
                          className="secondary"
                          disabled={policyBundlePath.trim().length === 0}
                          onClick={() => importPolicyBundleFromFile().catch(cause => setError((cause as Error).message))}
                        >
                          Import Policy Bundle
                        </button>
                      </div>
                      {policyBundlePreview ? (
                        <label className="tool-field">
                          <span>Policy bundle result</span>
                          <textarea value={policyBundlePreview} readOnly rows={8} />
                        </label>
                        ) : null}
                        {policyProposalFollowUps.length > 0 ? (
                          <>
                            <p className="subtle" ref={policyFollowUpsRef}>Policy follow-ups</p>
                            <ul className="audit-list">
                              {policyProposalFollowUps.slice(0, 6).map(item => (
                                <li
                                  key={item.follow_up_id}
                                  className={item.follow_up_id === highlightedPolicyFollowUpId ? "highlighted-item" : undefined}
                                >
                                  <strong>{item.title}</strong>
                                  <div className="subtle">
                                    {item.queue_label} / severity {item.severity} / action {item.action}
                                  </div>
                                  <div className="subtle">
                                    {item.message}
                                  </div>
                                  <div className="subtle">
                                    pending {item.pending_count} / sla breaches {item.sla_breach_count}
                                  </div>
                                  <div className="tool-actions">
                                    <button
                                      className="secondary"
                                      onClick={() =>
                                        navigateToDesktopTarget(
                                          { kind: "policy_follow_up", followUpId: item.follow_up_id },
                                          { focusWindow: true, source: "workspace_click" }
                                        ).catch(cause => setError((cause as Error).message))
                                      }
                                    >
                                      Focus
                                    </button>
                                    <button
                                      className="secondary"
                                      onClick={() => copyDesktopDeepLink({ kind: "policy_follow_up", followUpId: item.follow_up_id }, item.title)}
                                    >
                                      Copy Link
                                    </button>
                                    <button
                                      className="secondary"
                                      onClick={() => executePolicyProposalFollowUp(item.follow_up_id).catch(cause => setError((cause as Error).message))}
                                    >
                                      Execute Follow-up
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        {policyProposalQueues.length > 0 ? (
                          <>
                            <p className="subtle" ref={policyProposalQueuesRef}>Policy proposal queues</p>
                            {policyProposalQueues.map(queue => (
                              <div key={queue.review_path} className="tool-panel">
                                <strong>{queue.label}</strong>
                                <div className="subtle">
                                  {queue.description} / {queue.count} item{queue.count === 1 ? "" : "s"}
                                </div>
                                <div className="subtle">
                                  pending {queue.status_breakdown.pending_review} / approved {queue.status_breakdown.approved} / applied{" "}
                                  {queue.status_breakdown.applied} / rejected {queue.status_breakdown.rejected}
                                </div>
                                <div className="subtle">
                                  SLA {queue.pending_review_sla_hours}h / breaches {queue.pending_review_sla_breach_count} / next action{" "}
                                  {queue.suggested_action}
                                </div>
                                <div className="subtle">
                                  health {queue.health_status} / escalation {queue.escalation_required ? "required" : "not required"} / follow-up{" "}
                                  {queue.follow_up_action}
                                </div>
                                {queue.escalation_reason ? (
                                  <div className="subtle">escalation reason: {queue.escalation_reason}</div>
                                ) : null}
                                {queue.oldest_requested_at ? (
                                  <div className="subtle">oldest pending: {new Date(queue.oldest_requested_at).toLocaleString()}</div>
                                ) : null}
                                {queue.items.length > 0 ? (
                                  <ul className="audit-list">
                                    {queue.items.slice(0, 8).map(item => (
                                      <li key={item.proposal_id} className={item.proposal_id === highlightedPolicyProposalId ? "highlighted-item" : undefined}>
                                        <div>
                                          <input
                                            type="checkbox"
                                            checked={selectedPolicyProposalIds.includes(item.proposal_id)}
                                            onChange={() => togglePolicyProposalSelection(item.proposal_id)}
                                          />
                                        </div>
                                        <div>
                                          <strong>{item.kind}</strong> / {item.status} / {item.review_path} / {item.source_scope ?? "editor"} -&gt; {item.target_scope}
                                        </div>
                                        <div className="subtle">
                                          {item.rationale ?? "no rationale"} / {new Date(item.requested_at).toLocaleString()}
                                        </div>
                                        {item.advisory_recommended_action ? (
                                          <div className="subtle">
                                            advisory: {item.advisory_recommended_action}
                                            {item.advisory_reasons.length > 0 ? ` / ${item.advisory_reasons.join(", ")}` : ""}
                                          </div>
                                        ) : null}
                                        <div className="tool-actions">
                                          <button
                                            className="secondary"
                                            onClick={() =>
                                              navigateToDesktopTarget(
                                                { kind: "policy_proposal", proposalId: item.proposal_id },
                                                { source: "workspace_click" }
                                              ).catch(cause => setError((cause as Error).message))
                                            }
                                          >
                                            Focus
                                          </button>
                                          <button
                                            className="secondary"
                                            onClick={() => copyDesktopDeepLink({ kind: "policy_proposal", proposalId: item.proposal_id }, item.proposal_id)}
                                          >
                                            Copy Link
                                          </button>
                                          {item.status === "pending_review" ? (
                                            <>
                                              <button
                                                className="secondary"
                                                onClick={() => approvePolicyProposal(item.proposal_id).catch(cause => setError((cause as Error).message))}
                                              >
                                                Approve
                                              </button>
                                              <button
                                                className="secondary"
                                                onClick={() => rejectPolicyProposal(item.proposal_id).catch(cause => setError((cause as Error).message))}
                                              >
                                                Reject
                                              </button>
                                            </>
                                          ) : null}
                                          {item.status === "approved" ? (
                                            <button
                                              className="secondary"
                                              onClick={() => applyPolicyProposal(item.proposal_id).catch(cause => setError((cause as Error).message))}
                                            >
                                              Apply
                                            </button>
                                          ) : null}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="subtle">No proposals are currently routed here.</p>
                                )}
                              </div>
                            ))}
                            {selectedPolicyProposalIds.length > 0 ? (
                              <div className="tool-actions">
                                <button className="secondary" onClick={() => processPolicyProposalBatch("approve").catch(cause => setError((cause as Error).message))}>
                                Batch Approve
                              </button>
                              <button className="secondary" onClick={() => processPolicyProposalBatch("reject").catch(cause => setError((cause as Error).message))}>
                                Batch Reject
                              </button>
                              <button className="secondary" onClick={() => processPolicyProposalBatch("apply").catch(cause => setError((cause as Error).message))}>
                                Batch Apply
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {policyReleaseHistory.length > 0 ? (
                        <>
                          <p className="subtle">Environment release history</p>
                          <ul className="audit-list">
                            {policyReleaseHistory.slice(0, 6).map(item => (
                              <li key={item.audit_id}>
                                <strong>{item.action}</strong> / {(item.payload?.target_scope as string) ?? (item.payload?.scope as string) ?? "n/a"} / {new Date(item.created_at).toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {policyEnvironmentSnapshots.length > 0 ? (
                        <>
                          <p className="subtle">Environment snapshots</p>
                          <ul className="audit-list">
                            {policyEnvironmentSnapshots.map(item => (
                              <li key={`snapshot-${item.scope}`}>
                                <span>
                                  <strong>{item.scope}</strong> / {item.label}
                                </span>
                                  <span>
                                    trusted import {item.effective_policy.trust.require_trusted_bundle_import ? "yes" : "no"} / standard{" "}
                                    {item.effective_policy.roles.policy_approve_roles.join(", ")} / manual{" "}
                                    {item.effective_policy.roles.policy_manual_approval_roles.join(", ")} / security{" "}
                                    {item.effective_policy.roles.policy_security_review_roles.join(", ")}
                                  </span>
                              </li>
                            ))}
                          </ul>
                          <div className="grid-two">
                            <label className="tool-field">
                              <span>Compare from</span>
                              <select
                                value={policyCompareFromScope}
                                onChange={event => setPolicyCompareFromScope(event.target.value as SkillPolicyScopeEntry["scope"])}
                              >
                                {policyEnvironmentSnapshots.map(item => (
                                  <option key={`policy-compare-from-${item.scope}`} value={item.scope}>
                                    {item.scope} ({item.label})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="tool-field">
                              <span>Compare to</span>
                              <select
                                value={policyCompareToScope}
                                onChange={event => setPolicyCompareToScope(event.target.value as SkillPolicyScopeEntry["scope"])}
                              >
                                {policyEnvironmentSnapshots.map(item => (
                                  <option key={`policy-compare-to-${item.scope}`} value={item.scope}>
                                    {item.scope} ({item.label})
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="tool-actions">
                            <button
                              className="secondary"
                              disabled={policyCompareFromScope === policyCompareToScope}
                              onClick={() => comparePolicyEnvironments().catch(cause => setError((cause as Error).message))}
                            >
                              Compare Environments
                            </button>
                          </div>
                          {policyCompareResult ? (
                            <>
                              <p className="subtle">
                                Comparing {policyCompareResult.from.scope} ({policyCompareResult.from.label}) {"->"} {policyCompareResult.to.scope} (
                                {policyCompareResult.to.label}) / changed fields {policyCompareResult.changed_fields.length}
                              </p>
                              <p className="subtle">
                                Advisory: <strong>{policyCompareResult.advisory.recommended_action}</strong>
                                {policyCompareResult.advisory.manual_approval_required ? " / manual approval required" : ""}
                                {policyCompareResult.advisory.security_review_required ? " / security review required" : ""}
                              </p>
                              <p className="subtle">
                                Suggested workflow: {policyCompareResult.advisory.next_step} / path {policyCompareResult.advisory.review_path}
                              </p>
                              {policyCompareResult.advisory.reasons.length > 0 ? (
                                <ul className="audit-list">
                                  {policyCompareResult.advisory.reasons.map(reason => (
                                    <li key={`policy-advisory-${reason}`}>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <div className="tool-actions">
                                <button className="secondary" onClick={() => applyPolicyCompareAdvisory()}>
                                  Use Advisory Workflow
                                </button>
                                <button
                                  className="secondary"
                                  onClick={() => createPolicyPromotionProposal().catch(cause => setError((cause as Error).message))}
                                >
                                  Create Recommended Promotion Proposal
                                </button>
                              </div>
                              {policyCompareResult.risk_summary.length > 0 ? (
                                <>
                                  <p className="subtle">Risk summary</p>
                                  <ul className="audit-list">
                                    {policyCompareResult.risk_summary.map(item => (
                                      <li key={`policy-risk-${item.field}-${item.title}`}>
                                        <span>
                                          <strong>{item.severity}</strong> / {item.title}
                                        </span>
                                        <span>{item.reason}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : (
                                <p className="subtle">No governance-expanding risk signals were detected for this compare.</p>
                              )}
                              {policyCompareResult.changed_groups.length > 0 ? (
                                <div className="grid-two">
                                  {policyCompareResult.changed_groups.map(group => (
                                    <div key={`policy-group-${group.group}`} className="detail-panel">
                                      <h4>{group.group}</h4>
                                      <ul className="audit-list">
                                        {group.items.map(item => (
                                          <li key={`policy-group-item-${item.field}`}>
                                            <span>{item.field}</span>
                                            <span>
                                              {JSON.stringify(item.before)} {"->"} {JSON.stringify(item.after)}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {policyCompareResult.changed_fields.length > 0 ? (
                                <ul className="audit-list">
                                  {policyCompareResult.changed_fields.slice(0, 8).map(item => (
                                    <li key={`policy-compare-${item.field}`}>
                                      <span>{item.field}</span>
                                      <span>
                                        {JSON.stringify(item.before)} {"->"} {JSON.stringify(item.after)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="subtle">No effective policy differences were detected for this scope pair.</p>
                              )}
                            </>
                          ) : null}
                          {policyComparePreview ? (
                            <label className="tool-field">
                              <span>Environment compare preview</span>
                              <textarea value={policyComparePreview} readOnly rows={10} />
                            </label>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {policyAudits.length > 0 ? (
                    <>
                      <p className="subtle">Recent policy changes</p>
                      <ul className="audit-list">
                        {policyAudits.slice(0, 6).map(item => (
                          <li key={item.audit_id}>
                            <strong>{item.action}</strong> at {new Date(item.created_at).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <p className="subtle">
                    trusted import required: {skillPolicyDiagnostics.trust.require_trusted_bundle_import ? "yes" : "no"} ({skillPolicyDiagnostics.sources.require_trusted_bundle_import})
                  </p>
                  <p className="subtle">
                    publishers: {skillPolicyDiagnostics.trust.trusted_publishers.length > 0 ? skillPolicyDiagnostics.trust.trusted_publishers.join(", ") : "any"} ({skillPolicyDiagnostics.sources.trusted_publishers})
                  </p>
                  <p className="subtle">
                    channels: {skillPolicyDiagnostics.trust.allowed_release_channels.length > 0 ? skillPolicyDiagnostics.trust.allowed_release_channels.join(", ") : "any"} ({skillPolicyDiagnostics.sources.allowed_release_channels})
                  </p>
                  <p className="subtle">
                    sources: {skillPolicyDiagnostics.content.allowed_skill_sources.length > 0 ? skillPolicyDiagnostics.content.allowed_skill_sources.join(", ") : "any"} ({skillPolicyDiagnostics.sources.allowed_skill_sources})
                  </p>
                  <p className="subtle">
                    blocked tags: {skillPolicyDiagnostics.content.blocked_tags.length > 0 ? skillPolicyDiagnostics.content.blocked_tags.join(", ") : "none"} ({skillPolicyDiagnostics.sources.blocked_tags})
                  </p>
                  <p className="subtle">
                    blocked capabilities: {skillPolicyDiagnostics.content.blocked_capabilities.length > 0 ? skillPolicyDiagnostics.content.blocked_capabilities.join(", ") : "none"} ({skillPolicyDiagnostics.sources.blocked_capabilities})
                  </p>
                  <p className="subtle">
                    review roles: {skillPolicyDiagnostics.roles.review_roles.join(", ")} ({skillPolicyDiagnostics.sources.review_roles})
                  </p>
                  <p className="subtle">
                    promote roles: {skillPolicyDiagnostics.roles.promote_roles.join(", ")} ({skillPolicyDiagnostics.sources.promote_roles})
                  </p>
                  <p className="subtle">
                    trusted import roles: {skillPolicyDiagnostics.roles.trusted_import_roles.join(", ")} ({skillPolicyDiagnostics.sources.trusted_import_roles})
                  </p>
                  <p className="subtle">
                    policy edit roles: {skillPolicyDiagnostics.roles.policy_edit_roles.join(", ")} ({skillPolicyDiagnostics.sources.policy_edit_roles})
                  </p>
                    <p className="subtle">
                      policy approve roles: {skillPolicyDiagnostics.roles.policy_approve_roles.join(", ")} ({skillPolicyDiagnostics.sources.policy_approve_roles})
                    </p>
                    <p className="subtle">
                      policy manual approval roles: {skillPolicyDiagnostics.roles.policy_manual_approval_roles.join(", ")} ({skillPolicyDiagnostics.sources.policy_manual_approval_roles})
                    </p>
                    <p className="subtle">
                      policy security review roles: {skillPolicyDiagnostics.roles.policy_security_review_roles.join(", ")} ({skillPolicyDiagnostics.sources.policy_security_review_roles})
                    </p>
                    <p className="subtle">
                      policy promote roles: {skillPolicyDiagnostics.roles.policy_promote_roles.join(", ")} ({skillPolicyDiagnostics.sources.policy_promote_roles})
                    </p>
                  <p className="subtle">
                    scope labels: {Object.entries(skillPolicyDiagnostics.environments.labels).map(([scope, label]) => `${scope}=${label}`).join(", ")} ({skillPolicyDiagnostics.sources.scope_labels})
                  </p>
                  <p className="subtle">
                    promotion pipeline: {skillPolicyDiagnostics.environments.promotion_pipeline.join(", ")} ({skillPolicyDiagnostics.sources.promotion_pipeline})
                  </p>
                </div>
              ) : null}
            </div>
            {canonicalSkills.length > 0 ? (
              <>
                <div className="skill-groups">
                  {canonicalSkillGroups.map(([source, skills]) => (
                    <div key={source} className="skill-group">
                      <p className="eyebrow">{source}</p>
                      <ul>
                        {skills.map(skill => (
                          <li key={skill.skill_id}>
                            <button
                              className={`task-item skill-item ${selectedCanonicalSkill?.skill_id === skill.skill_id ? "selected" : ""}`}
                              onClick={() => setSelectedSkillId(skill.skill_id)}
                            >
                              <span className="task-intent">{skill.name}</span>
                              <span className="task-meta">
                                {skill.execution_mode} / {skill.status} / v{skill.version}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {selectedCanonicalSkill ? (
                  <div className="detail-panel">
                    <h4>{selectedCanonicalSkill.name}</h4>
                    <p className="subtle">
                      {selectedCanonicalSkill.source} / {selectedCanonicalSkill.execution_mode} / {selectedCanonicalSkill.status} / version {selectedCanonicalSkill.version}
                    </p>
                    <p>{selectedCanonicalSkill.description}</p>
                    <p className="subtle">Integrity: {selectedCanonicalSkill.integrity_hash.slice(0, 16)}...</p>
                    {selectedCanonicalSkill.reviewed_at ? (
                      <p className="subtle">
                        Reviewed by {selectedCanonicalSkill.reviewed_by ?? "unknown"} at{" "}
                        {new Date(selectedCanonicalSkill.reviewed_at).toLocaleString()}
                      </p>
                    ) : null}
                    {selectedCanonicalSkill.governance_note ? (
                      <p className="subtle">Governance note: {selectedCanonicalSkill.governance_note}</p>
                    ) : null}
                    {selectedCanonicalSkill.required_capabilities.length > 0 ? (
                      <div>
                        <p className="subtle">Required capabilities</p>
                        <div className="tag-row">
                          {selectedCanonicalSkill.required_capabilities.map(capability => (
                            <button key={capability} className="tag-chip" onClick={() => drillIntoCapability(capability)}>
                              {capability}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedCanonicalSkill.preferred_workers.length > 0 ? (
                      <p className="subtle">Preferred workers: {selectedCanonicalSkill.preferred_workers.join(", ")}</p>
                    ) : null}
                    {selectedCanonicalSkill.trigger_phrases.length > 0 ? (
                      <p className="subtle">Triggers: {selectedCanonicalSkill.trigger_phrases.join(", ")}</p>
                    ) : null}
                    {selectedCanonicalSkill.tags.length > 0 ? (
                      <p className="subtle">Tags: {selectedCanonicalSkill.tags.join(", ")}</p>
                    ) : null}
                    {(selectedCanonicalSkill.notes?.length ?? 0) > 0 ? (
                      <ul>
                        {selectedCanonicalSkill.notes?.map(note => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="tool-grid compact">
                      <label className="tool-field">
                        <span>Export format</span>
                        <select value={skillExportFormat} onChange={event => setSkillExportFormat(event.target.value as SkillDocumentFormat)}>
                          <option value="canonical_json">canonical_json</option>
                          <option value="openclaw_markdown">openclaw_markdown</option>
                          <option value="claude_markdown">claude_markdown</option>
                          <option value="openai_json">openai_json</option>
                        </select>
                      </label>
                      <label className="tool-field">
                        <span>Export file path</span>
                        <input
                          value={skillExportPath}
                          onChange={event => setSkillExportPath(event.target.value)}
                          placeholder="Absolute path for exported skill"
                        />
                      </label>
                    </div>
                    <div className="tool-actions">
                      <button className="secondary" onClick={() => previewSkillExport().catch(cause => setError((cause as Error).message))}>
                        Preview Export
                      </button>
                      <button
                        className="secondary"
                        disabled={skillExportPath.trim().length === 0}
                        onClick={() => exportSkillToFile().catch(cause => setError((cause as Error).message))}
                      >
                        Export File
                      </button>
                    </div>
                    {skillExportPreview ? (
                      <label className="tool-field">
                        <span>Export preview</span>
                        <textarea value={skillExportPreview} readOnly rows={10} />
                      </label>
                    ) : null}
                    <label className="tool-field">
                      <span>Governance note</span>
                      <input
                        value={skillGovernanceNote}
                        onChange={event => setSkillGovernanceNote(event.target.value)}
                        placeholder="Optional review or disable note"
                      />
                    </label>
                    <div className="tool-actions">
                      <button
                        className="secondary"
                        disabled={selectedCanonicalSkill.status === "active"}
                        onClick={() => updateSkillGovernance("active").catch(cause => setError((cause as Error).message))}
                      >
                        Approve / Activate
                      </button>
                      <button
                        className="secondary"
                        disabled={selectedCanonicalSkill.status === "review_required"}
                        onClick={() => updateSkillGovernance("review_required").catch(cause => setError((cause as Error).message))}
                      >
                        Send To Review
                      </button>
                      <button
                        className="secondary"
                        disabled={selectedCanonicalSkill.status === "disabled"}
                        onClick={() => updateSkillGovernance("disabled").catch(cause => setError((cause as Error).message))}
                      >
                        Disable
                      </button>
                    </div>
                    {selectedSkillAudits.length > 0 ? (
                      <>
                        <p className="subtle">Governance history</p>
                        <ul className="audit-list">
                          {selectedSkillAudits.slice(-8).reverse().map(entry => (
                            <li key={entry.audit_id}>
                              <span>{entry.action}</span>
                              <span>{new Date(entry.created_at).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="subtle">No canonical skills are registered yet.</p>
            )}
          </section>

          <section className="card">
            <h3>Operational Safety</h3>
            <p className="subtle">
              total {workspace?.operationalSummary.tooling.total_invocations ?? 0} / local{" "}
              {workspace?.operationalSummary.tooling.local_invocations ?? 0} / external{" "}
              {workspace?.operationalSummary.tooling.external_invocations ?? 0}
            </p>
            <p className="subtle">
              idempotent {workspace?.operationalSummary.tooling.idempotent_invocations ?? 0} / compensable pending{" "}
              {workspace?.operationalSummary.tooling.compensable_pending ?? 0} / compensations applied{" "}
              {workspace?.operationalSummary.tooling.compensations_applied ?? 0}
            </p>
            <p className="subtle">
              reconciliation pending {workspace?.operationalSummary.reconciliation.external_state_pending ?? 0} / applied{" "}
              {workspace?.operationalSummary.reconciliation.external_state_applied ?? 0} / failed{" "}
              {workspace?.operationalSummary.reconciliation.external_state_failed ?? 0}
            </p>
            <p className="subtle">
              degraded {workspace?.operationalSummary.resilience.degraded_invocations ?? 0} / circuit open{" "}
              {workspace?.operationalSummary.resilience.circuit_open ?? 0} / half-open{" "}
              {workspace?.operationalSummary.resilience.circuit_half_open ?? 0}
            </p>
            {(workspace?.operationalSummary.manual_attention.length ?? 0) > 0 ? (
              <ul>
                {(workspace?.operationalSummary.manual_attention ?? []).map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="subtle">No immediate operational intervention is recommended.</p>
            )}
          </section>

          <section className="card">
            <h3>Local Tool Actions</h3>
            <div className="tool-actions">
              <label className="tool-field">
                <span>Write File Path</span>
                <input value={writePath} onChange={event => setWritePath(event.target.value)} />
              </label>
              <label className="tool-field">
                <span>Write File Content</span>
                <textarea value={writeContent} onChange={event => setWriteContent(event.target.value)} rows={4} />
              </label>
              <button
                disabled={!selectedTaskId || !!busyAction || !canOperate || writePath.trim().length === 0}
                onClick={() =>
                  runTool("/tools/fs/write", {
                    path: writePath.trim(),
                    content: writeContent,
                    confirm: true
                  })
                }
              >
                Write Local File
              </button>
              <label className="tool-field">
                <span>Patch File Path</span>
                <input value={patchPath} onChange={event => setPatchPath(event.target.value)} />
              </label>
              <label className="tool-field">
                <span>Patch Expected Content</span>
                <textarea value={patchExpectedContent} onChange={event => setPatchExpectedContent(event.target.value)} rows={4} />
              </label>
              <label className="tool-field">
                <span>Patch Next Content</span>
                <textarea value={patchNextContent} onChange={event => setPatchNextContent(event.target.value)} rows={4} />
              </label>
              <button
                disabled={!selectedTaskId || !!busyAction || !canOperate || patchPath.trim().length === 0}
                onClick={() =>
                  runTool("/tools/fs/patch", {
                    path: patchPath.trim(),
                    expectedContent: patchExpectedContent,
                    nextContent: patchNextContent,
                    confirm: true
                  })
                }
              >
                Apply Exact Patch
              </button>
              <label className="tool-field">
                <span>Rollback File Path</span>
                <input value={rollbackPath} onChange={event => setRollbackPath(event.target.value)} />
              </label>
              <button
                disabled={!selectedTaskId || !!busyAction || !canOperate || rollbackPath.trim().length === 0}
                onClick={() =>
                  runTool("/tools/fs/rollback", {
                    path: rollbackPath.trim(),
                    confirm: true
                  })
                }
              >
                Roll Back Latest File Change
              </button>
              <button
                disabled={!selectedTaskId || !!busyAction || !canOperate}
                onClick={() =>
                  runTool("/tools/ide/workspace-summary", {
                    confirm: true
                  })
                }
              >
                Run IDE Summary
              </button>
              <label className="tool-field">
                <span>Browser Snapshot URL</span>
                <textarea value={browserUrl} onChange={event => setBrowserUrl(event.target.value)} rows={4} />
              </label>
              <button
                disabled={!selectedTaskId || !!busyAction || !canOperate || browserUrl.trim().length === 0}
                onClick={() =>
                  runTool("/tools/browser/snapshot", {
                    url: browserUrl.trim(),
                    confirm: true
                  })
                }
              >
                Capture Browser Snapshot
              </button>
              <label className="tool-field">
                <span>Navigate Existing Session</span>
                <textarea value={browserSessionUrl} onChange={event => setBrowserSessionUrl(event.target.value)} rows={3} />
              </label>
              <button
                disabled={!selectedTaskId || !!busyAction || !canOperate || !workspace?.browserSessions?.[0] || browserSessionUrl.trim().length === 0}
                onClick={() =>
                  runTool("/tools/browser/session/navigate", {
                    sessionId: workspace?.browserSessions?.[0]?.session_id,
                    url: browserSessionUrl.trim(),
                    confirm: true
                  })
                }
              >
                Navigate Latest Browser Session
              </button>
            </div>
            <p className="subtle">
              Local tools follow the same permission, audit, artifact, and verification rules as the rest of the task runtime.
            </p>
          </section>

          <section className="card">
            <h3>External Tool Actions</h3>
            {externalToolCatalog.length > 0 ? (
              <>
                <label className="tool-field">
                  <span>External Tool</span>
                  <select value={selectedExternalTool} onChange={event => setSelectedExternalTool(event.target.value)}>
                    {externalToolCatalog.map(tool => (
                      <option key={tool.name} value={tool.name}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tool-field">
                  <span>External Tool Input (JSON)</span>
                  <textarea
                    value={externalToolInput}
                    onChange={event => setExternalToolInput(event.target.value)}
                    rows={5}
                  />
                </label>
                <button
                  disabled={!selectedTaskId || !!busyAction || !canOperate || selectedExternalTool.trim().length === 0}
                  onClick={() => {
                    let parsedInput: Record<string, unknown>;
                    try {
                      parsedInput = JSON.parse(externalToolInput) as Record<string, unknown>;
                    } catch {
                      setError("External tool input must be valid JSON.");
                      return;
                    }
                    runTool(`/tools/external/${selectedExternalTool}/invoke`, {
                      input: parsedInput
                    });
                  }}
                >
                  Invoke External Tool
                </button>
                <div className="task-list">
                  {externalToolCatalog.map(tool => (
                    <button
                      key={tool.name}
                      className={`task-item ${tool.name === selectedExternalTool ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedExternalTool(tool.name);
                        setExternalToolInput(getDefaultExternalToolInput(tool.name));
                      }}
                    >
                      <span className="task-intent">{tool.name}</span>
                      <span className="task-meta">
                        {tool.category} / {tool.reconciliation_mode} / compensation {tool.compensation_available ? "yes" : "no"}
                      </span>
                      <span className="task-meta">
                        {tool.connector_type} / auth {tool.auth_strategy} / paging {tool.pagination_strategy}
                      </span>
                      {tool.required_inputs.length > 0 ? (
                        <span className="task-meta">inputs: {tool.required_inputs.join(", ")}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="subtle">
                External tool catalog is unavailable. Start <code>npm run dev:tools</code> to enable gateway-backed actions.
              </p>
            )}
          </section>

          <section className="card">
            <h3>Browser Sessions</h3>
            <ul>
              {(workspace?.browserSessions ?? []).map(session => (
                <li key={session.session_id}>
                  <strong>{session.title ?? session.current_url}</strong>
                  <span className={`badge ${session.status}`}>{session.status}</span>
                  <div className="subtle">{session.current_url}</div>
                  <div className="subtle">engine: {session.engine}</div>
                  <div className="subtle">history: {session.history.length}</div>
                  {session.resilience ? (
                    <div className="subtle">
                      resilience: attempts {session.resilience.attempts} / circuit {session.resilience.circuit_state}
                      {session.resilience.degraded ? ` / degraded (${session.resilience.degraded_reason ?? "reason unavailable"})` : ""}
                    </div>
                  ) : null}
                  {session.dom_summary ? (
                    <div className="subtle">
                      headings: {session.dom_summary.heading_count} / links: {session.dom_summary.link_count} / forms: {session.dom_summary.form_count} / interactive: {session.dom_summary.interactive_count}
                    </div>
                  ) : null}
                  {session.text_excerpt ? (
                    <div className="subtle text-preview">{session.text_excerpt.slice(0, 180)}</div>
                  ) : null}
                  {session.dom_summary?.sample_headings?.length ? (
                    <div className="subtle">headings: {session.dom_summary.sample_headings.join(" | ")}</div>
                  ) : null}
                  {session.dom_summary?.sample_links?.length ? (
                    <div className="subtle">links: {session.dom_summary.sample_links.join(" | ")}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Verification Stack</h3>
            <p>Checklist: <strong>{workspace?.checklist?.status ?? "n/a"}</strong></p>
            <p>Verifier: <strong>{workspace?.verification?.verdict ?? "n/a"}</strong></p>
            <p>Reconciliation: <strong>{workspace?.reconciliation?.status ?? "n/a"}</strong></p>
            <p>Done Gate: <strong>{workspace?.doneGate?.status ?? "n/a"}</strong></p>
            {workspace?.doneGate?.reasons?.length ? (
              <ul>
                {workspace.doneGate.reasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="card">
            <h3>Worker Runs</h3>
            <ul>
              {(workspace?.workerRuns ?? []).map(run => (
                <li key={run.worker_run_id}>
                  <strong>{run.worker_name}</strong> ({run.worker_kind}) / {run.status}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Artifacts</h3>
            <ul>
              {(workspace?.artifacts ?? []).map(artifact => (
                <li key={artifact.artifact_id}>
                  {artifact.name} <span className={`badge ${artifact.status}`}>{artifact.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Tool Invocations</h3>
            <ul>
              {(workspace?.toolInvocations ?? []).map(invocation => (
                <li key={invocation.invocation_id}>
                  <strong>{invocation.tool_name}</strong> <span className={`badge ${invocation.status}`}>{invocation.status}</span>
                  <div className="subtle">{new Date(invocation.created_at).toLocaleString()}</div>
                  {invocation.idempotency_key ? (
                    <div className="subtle">idempotency: {invocation.idempotency_key}</div>
                  ) : null}
                  <div className="subtle">
                    compensation: {invocation.compensation_available ? invocation.compensation_status ?? "available" : "not required"}
                  </div>
                  {typeof invocation.output.reconciliation_state === "string" ? (
                    <div className="subtle">
                      reconciliation: {String(invocation.output.reconciliation_mode ?? "unknown")} / {String(invocation.output.reconciliation_state)}
                    </div>
                  ) : null}
                  {typeof invocation.output.resilience === "object" && invocation.output.resilience ? (
                    <div className="subtle">
                      resilience: attempts {String((invocation.output.resilience as Record<string, unknown>).attempts ?? 1)} / circuit {String((invocation.output.resilience as Record<string, unknown>).circuit_state ?? "closed")}
                      {(invocation.output.resilience as Record<string, unknown>).degraded
                        ? ` / degraded (${String((invocation.output.resilience as Record<string, unknown>).degraded_reason ?? "reason unavailable")})`
                        : ""}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>External Reconciliation</h3>
            {(workspace?.toolInvocations ?? []).filter(invocation => typeof invocation.output.reconciliation_state === "string").length > 0 ? (
              <ul>
                {(workspace?.toolInvocations ?? [])
                  .filter(invocation => typeof invocation.output.reconciliation_state === "string")
                  .map(invocation => (
                    <li key={`reconcile-${invocation.invocation_id}`}>
                      <strong>{invocation.tool_name}</strong>
                      <div className="subtle">
                        state: {String(invocation.output.reconciliation_state)} / mode: {String(invocation.output.reconciliation_mode ?? "unknown")}
                      </div>
                      {invocation.idempotency_key ? (
                        <div className="subtle">idempotency: {invocation.idempotency_key}</div>
                      ) : null}
                      <div className="actions">
                        <button
                          disabled={!invocation.idempotency_key || !!busyAction}
                          onClick={() => invocation.idempotency_key && reconcileExternalInvocation(invocation.tool_name, invocation.idempotency_key)}
                        >
                          Reconcile Now
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="subtle">No external reconciliation entries exist for this task yet.</p>
            )}
          </section>

          <section className="card">
            <h3>Watchdog</h3>
            <p>Status: <strong>{workspace?.watchdog.status ?? "n/a"}</strong></p>
            <ul>
              {(workspace?.watchdog.reasons ?? []).map(reason => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Methodology Output</h3>
            <ul>
              {(workspace?.skillCandidates ?? []).map(candidate => (
                <li key={candidate.candidate_id}>{candidate.title} / {candidate.status}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Audit Trail</h3>
            <ul className="audit-list">
              {(workspace?.audits ?? []).slice(-8).reverse().map(audit => (
                <li key={audit.audit_id}>
                  <strong>{audit.action}</strong>
                  <span>{new Date(audit.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat(props: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
