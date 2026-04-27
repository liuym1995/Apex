import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { log } from "@apex/shared-observability";

export type WorkspacePanelKind = "computer_use" | "replay" | "human_takeover" | "risk" | "execution_state" | "mcp_fabric" | "app_control" | "hybrid_memory_ttt" | "worker_session" | "scheduled_jobs" | "delegated_runtime" | "deerflow_boundary" | "blocker_dashboard" | "privileged_execution" | "readiness_matrix" | "acceptance_status" | "budget_status" | "multi_agent_limits" | "evolution_status" | "remote_skill_review";

export type WorkspacePanelStatus = "loading" | "active" | "error" | "minimized" | "hidden";

export interface WorkspacePanel {
  panel_id: string;
  kind: WorkspacePanelKind;
  title: string;
  status: WorkspacePanelStatus;
  session_id?: string;
  task_id?: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ComputerUsePanelState {
  session_id: string;
  task_id?: string;
  current_step: number;
  max_steps: number;
  sandbox_tier: string;
  sandbox_policy: {
    tier: string;
    allowed_actions: string[];
    denied_actions: string[];
    requires_confirmation: boolean;
  };
  circuit_breakers: Record<string, { count: number; isOpen: boolean; cooldownRemainingMs: number }>;
  recent_captures: Array<{ capture_id: string; width: number; height: number; engine: string; captured_at: string }>;
  recent_perceptions: Array<{ perception_id: string; element_count: number; engine: string; perceived_at: string }>;
  recent_actions: Array<{ action_id: string; kind: string; result: string; provider?: string; created_at: string }>;
  human_takeovers_pending: number;
  recording_active: boolean;
  recording_frame_count?: number;
  verification_summary: {
    total_verifications: number;
    confirmed: number;
    mismatches: number;
    errors: number;
    average_confidence: number;
  };
}

export interface ReplayVisualizationState {
  session_id: string;
  total_steps: number;
  current_step_index: number;
  steps: Array<{
    step_id: string;
    step_number: number;
    kind: string;
    intention: string;
    observation: string;
    verification_result: string;
    duration_ms: number;
    has_verification_evidence: boolean;
    confidence_score?: number;
    verdict?: string;
  }>;
  playback_mode: "paused" | "playing" | "stepping";
  playback_speed: number;
}

export interface HumanTakeoverConsoleState {
  pending_takeovers: Array<{
    takeover_id: string;
    reason: string;
    session_id: string;
    created_at: string;
    perception_snapshot?: {
      element_count: number;
      active_window?: string;
    };
    pending_action_description?: string;
  }>;
  recent_resolutions: Array<{
    takeover_id: string;
    resolution: string;
    resolved_by?: string;
    resolved_at: string;
  }>;
  escalation_count: number;
  auto_escalation_enabled: boolean;
}

export interface RiskRecoveryState {
  current_risk_level: "none" | "low" | "medium" | "high" | "critical";
  active_risks: Array<{
    risk_id: string;
    kind: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    recommended_action: string;
    created_at: string;
  }>;
  recovery_options: Array<{
    option_id: string;
    description: string;
    risk_level: string;
    compensable: boolean;
    requires_confirmation: boolean;
  }>;
  failure_states: Array<{
    state_id: string;
    kind: string;
    description: string;
    recoverable: boolean;
    recovery_action?: string;
    created_at: string;
  }>;
}

export interface ExecutionStateTransition {
  transition_id: string;
  session_id: string;
  from_state: string;
  to_state: string;
  trigger: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface WorkerSessionPanelState {
  sessions: Array<{
    session_id: string;
    worker_id: string;
    task_id?: string;
    attempt_id?: string;
    status: string;
    started_at: string;
    last_heartbeat_at?: string;
    step_count: number;
    restart_count: number;
    max_restarts: number;
    supervision_policy: string;
    lease_id?: string;
    is_healthy: boolean;
    health_issues: string[];
  }>;
  expired_sessions: number;
  stalled_sessions: number;
  orphaned_sessions: number;
  active_leases: number;
  resume_packages: Array<{
    package_id: string;
    session_id: string;
    task_id: string;
    status: string;
    checkpoint_id?: string;
    superseded_package_id?: string;
    applied_at?: string;
    created_at: string;
  }>;
  supervision_events: Array<{
    event_id: string;
    session_id: string;
    event_kind: string;
    created_at: string;
  }>;
}

export interface ScheduledJobsPanelState {
  jobs: Array<{
    job_id: string;
    name: string;
    cron_expression: string;
    handler_name: string;
    is_active: boolean;
    last_run_at?: string;
    next_run_at?: string;
    run_count: number;
    error_count: number;
    consecutive_error_count: number;
    missed_run_count: number;
    checkpoint_aware: boolean;
    maintenance_cycle_job: boolean;
  }>;
  health_diagnostics: {
    total_jobs: number;
    active_jobs: number;
    jobs_with_errors: number;
    jobs_with_missed_runs: number;
    health_status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    follow_up_tasks: Array<{ description: string; priority: "low" | "medium" | "high" }>;
  };
  stuck_tasks: Array<{
    task_id: string;
    intent: string;
    status: string;
    stuck_reason: string;
    last_activity_at: string;
  }>;
  maintenance_cycle_visibility: {
    last_cycle_at?: string;
    next_cycle_at?: string;
    cycle_results: {
      expired_sessions: number;
      stalled_sessions: number;
      orphaned_sessions: number;
      restarted_sessions: number;
      expired_leases: number;
    };
  };
}

export interface DelegatedRuntimePanelState {
  active_sessions: number;
  total_sessions: number;
  sessions_by_status: Record<string, number>;
  resume_package_summary: {
    prepared: number;
    applied: number;
    superseded: number;
    failed: number;
    rolled_back: number;
  };
  recent_supervision_events: Array<{
    event_id: string;
    session_id: string;
    worker_id: string;
    event_kind: string;
    created_at: string;
  }>;
  attempt_linkage: Array<{
    attempt_id: string;
    session_id?: string;
    lease_id?: string;
    run_id?: string;
    verdict?: string;
  }>;
  recovery_actions: Array<{
    action_id: string;
    description: string;
    target_type: "session" | "lease" | "package";
    target_id: string;
    available: boolean;
  }>;
}

export interface DeerFlowBoundaryPanelState {
  routes: Array<{
    route_id: string;
    worker_name: string;
    adapter_boundary: string;
    compatibility_version: string;
    is_backbone: boolean;
    created_at: string;
  }>;
  import_hooks: Array<{
    hook_id: string;
    hook_kind: string;
    source_format: string;
    target_format: string;
    active: boolean;
  }>;
  compatibility_status: "available" | "partial" | "unavailable";
  non_backbone_semantics: string;
}

export interface DesktopWorkspaceState {
  workspace_id: string;
  task_id?: string;
  active_panels: WorkspacePanel[];
  computer_use_panel?: ComputerUsePanelState;
  replay_panel?: ReplayVisualizationState;
  takeover_console?: HumanTakeoverConsoleState;
  risk_state?: RiskRecoveryState;
  hybrid_memory_ttt_panel?: HybridMemoryTTTPanelState;
  worker_session_panel?: WorkerSessionPanelState;
  scheduled_jobs_panel?: ScheduledJobsPanelState;
  delegated_runtime_panel?: DelegatedRuntimePanelState;
  deerflow_boundary_panel?: DeerFlowBoundaryPanelState;
  blocker_dashboard_panel?: BlockerDashboardPanelState;
  privileged_execution_panel?: PrivilegedExecutionPanelState;
  readiness_matrix_panel?: ReadinessMatrixPanelState;
  evolution_status_panel?: EvolutionStatusPanelState;
  remote_skill_review_panel?: RemoteSkillReviewPanelState;
  execution_transitions: ExecutionStateTransition[];
  last_updated: string;
}

export interface EvolutionStatusPanelState {
  skill_runs: number;
  prompt_runs: number;
  tool_desc_runs: number;
  total_candidates: number;
  promoted: number;
  rejected: number;
  rolled_back: number;
  pending: number;
  recent_candidates: Array<{
    candidate_id: string;
    target_name: string;
    kind: string;
    status: string;
    confidence: number;
    created_at: string;
  }>;
}

export interface RemoteSkillReviewPanelState {
  registry_configs: number;
  pending_installs: number;
  pending_publishes: number;
  trust_verdicts: number;
  pending_reviews: Array<{
    install_id: string;
    remote_skill_id: string;
    remote_skill_name: string;
    remote_version: string;
    trust_level: string;
    governance_review_required: boolean;
    created_at: string;
  }>;
  recent_verdicts: Array<{
    verdict_id: string;
    remote_skill_id: string;
    trust_level: string;
    compatibility_check: string;
    policy_compliant: boolean;
    publisher_verified: boolean;
    governance_review_required: boolean;
    created_at: string;
  }>;
}

export interface HybridMemoryTTTPanelState {
  task_id?: string;
  current_memory_mode: string;
  recommendation?: {
    recommendation_id: string;
    recommended_mode: string;
    confidence: number;
    reason: string;
    expected_benefit: string;
    fallback_mode: string;
  };
  gate_result?: {
    gate_id: string;
    verdict: string;
    original_mode: string;
    resolved_mode: string;
    checks: Record<string, boolean>;
    denial_reason?: string;
    downgrade_reason?: string;
  };
  adaptation_run?: {
    run_id: string;
    status: string;
    baseline_quality: number;
    adapted_quality: number;
    delta_verdict: string;
    improvement_score: number;
    budget_consumed: number;
  };
  budget_summary: {
    total: number;
    consumed: number;
    remaining: number;
  };
  eligible_task_families: string[];
  available_adapters: Array<{
    name: string;
    kind: string;
    supports_weight_update: boolean;
  }>;
  memory_routing_summary?: {
    top_candidates: Array<{
      memory_id: string;
      title: string;
      kind: string;
      score: number;
    }>;
    hit_quality: string;
  };
  distillation_status?: {
    distillation_id: string;
    status: string;
    targets: string[];
    artifact_count: number;
  };
}

const workspaceStates = new Map<string, DesktopWorkspaceState>();
const workspacePanels = new Map<string, WorkspacePanel>();

export function createDesktopWorkspace(input?: { taskId?: string }): DesktopWorkspaceState {
  const workspace: DesktopWorkspaceState = {
    workspace_id: createEntityId("workspace"),
    task_id: input?.taskId,
    active_panels: [],
    execution_transitions: [],
    last_updated: nowIso()
  };

  workspaceStates.set(workspace.workspace_id, workspace);

  try {
    log("info", "desktop_workspace_created", {
      workspace_id: workspace.workspace_id,
      task_id: input?.taskId
    });
  } catch { /* logging failure should not block */ }

  return workspace;
}

export function getDesktopWorkspace(workspaceId: string): DesktopWorkspaceState | undefined {
  return workspaceStates.get(workspaceId);
}

export function addWorkspacePanel(workspaceId: string, panel: Omit<WorkspacePanel, "panel_id" | "created_at" | "updated_at">): WorkspacePanel {
  const workspace = workspaceStates.get(workspaceId);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

  const full: WorkspacePanel = {
    ...panel,
    panel_id: createEntityId("wspanel"),
    created_at: nowIso(),
    updated_at: nowIso()
  };

  workspacePanels.set(full.panel_id, full);
  workspace.active_panels.push(full);
  workspace.last_updated = nowIso();

  return full;
}

export function updateWorkspacePanel(panelId: string, updates: Partial<Pick<WorkspacePanel, "status" | "title" | "data">>): WorkspacePanel | null {
  const panel = workspacePanels.get(panelId);
  if (!panel) return null;

  if (updates.status !== undefined) panel.status = updates.status;
  if (updates.title !== undefined) panel.title = updates.title;
  if (updates.data !== undefined) panel.data = { ...panel.data, ...updates.data };
  panel.updated_at = nowIso();

  return panel;
}

export function buildComputerUsePanelState(sessionId: string): ComputerUsePanelState {
  const session = store.computerUseSessions.get(sessionId);

  const captures = Array.from(store.screenCaptures.values())
    .filter(c => c.session_id === sessionId)
    .slice(-5)
    .map(c => ({ capture_id: c.capture_id, width: c.width, height: c.height, engine: c.engine, captured_at: c.captured_at }));

  const perceptions = Array.from(store.uiPerceptions.values())
    .filter(p => p.session_id === sessionId)
    .slice(-5)
    .map(p => ({ perception_id: p.perception_id, element_count: p.elements.length, engine: p.engine, perceived_at: p.perceived_at }));

  const actions = Array.from(store.inputActions.values())
    .filter(a => a.session_id === sessionId)
    .slice(-10)
    .map(a => ({ action_id: a.action_id, kind: a.kind, result: a.result ?? "unknown", provider: a.provider, created_at: a.executed_at ?? a.created_at }));

  const pendingTakeovers = Array.from(store.humanTakeovers.values())
    .filter(t => t.session_id === sessionId && t.resolution === undefined)
    .length;

  const steps = Array.from(store.computerUseSteps.values())
    .filter(s => s.session_id === sessionId);

  const stepsWithEvidence = steps.filter(s => s.verification_result !== undefined);
  const confirmedSteps = stepsWithEvidence.filter(s => s.verification_result === "confirmed");
  const mismatchSteps = stepsWithEvidence.filter(s => s.verification_result === "mismatch");
  const errorSteps = stepsWithEvidence.filter(s => s.verification_result === "error");

  const confidenceScores = stepsWithEvidence
    .map(s => s.verification_evidence ? (s.verification_evidence as Record<string, unknown>).confidence_score as number : undefined)
    .filter((s): s is number => s !== undefined);

  const avgConfidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0;

  let sandboxPolicy: ComputerUsePanelState["sandbox_policy"] = {
    tier: "guarded_mutation",
    allowed_actions: [],
    denied_actions: [],
    requires_confirmation: true
  };

  try {
    const { getComputerUseSandboxPolicy } = require("./computer-use-runtime.js") as typeof import("./computer-use-runtime.js");
    sandboxPolicy = getComputerUseSandboxPolicy(sessionId);
  } catch { /* use default */ }

  let circuitBreakers: ComputerUsePanelState["circuit_breakers"] = {};
  try {
    const { getCircuitBreakerStatus } = require("./computer-use-runtime.js") as typeof import("./computer-use-runtime.js");
    circuitBreakers = getCircuitBreakerStatus();
  } catch { /* use default */ }

  let recordingActive = false;
  let recordingFrameCount: number | undefined;
  try {
    const { getSessionFrameRecordingStatus } = require("./computer-use-runtime.js") as typeof import("./computer-use-runtime.js");
    const status = getSessionFrameRecordingStatus(sessionId);
    if (status) {
      recordingActive = status.active;
      recordingFrameCount = status.frameCount;
    }
  } catch { /* use default */ }

  return {
    session_id: sessionId,
    task_id: session?.task_id,
    current_step: session?.step_count ?? 0,
    max_steps: session?.max_steps ?? 50,
    sandbox_tier: session?.sandbox_tier ?? "guarded_mutation",
    sandbox_policy: sandboxPolicy,
    circuit_breakers: circuitBreakers,
    recent_captures: captures,
    recent_perceptions: perceptions,
    recent_actions: actions,
    human_takeovers_pending: pendingTakeovers,
    recording_active: recordingActive,
    recording_frame_count: recordingFrameCount,
    verification_summary: {
      total_verifications: stepsWithEvidence.length,
      confirmed: confirmedSteps.length,
      mismatches: mismatchSteps.length,
      errors: errorSteps.length,
      average_confidence: Number(avgConfidence.toFixed(4))
    }
  };
}

export function buildReplayVisualizationState(sessionId: string): ReplayVisualizationState {
  const steps = Array.from(store.computerUseSteps.values())
    .filter(s => s.session_id === sessionId)
    .sort((a, b) => a.step_number - b.step_number);

  return {
    session_id: sessionId,
    total_steps: steps.length,
    current_step_index: 0,
    steps: steps.map(s => ({
      step_id: s.step_id,
      step_number: s.step_number,
      kind: s.kind,
      intention: s.intention ?? "",
      observation: s.observation ?? "",
      verification_result: s.verification_result ?? "unknown",
      duration_ms: s.duration_ms ?? 0,
      has_verification_evidence: s.verification_evidence !== undefined,
      confidence_score: s.verification_evidence ? (s.verification_evidence as Record<string, unknown>).confidence_score as number : undefined,
      verdict: s.verification_result ?? undefined
    })),
    playback_mode: "paused",
    playback_speed: 1
  };
}

export function buildHumanTakeoverConsoleState(sessionId?: string): HumanTakeoverConsoleState {
  const takeovers = Array.from(store.humanTakeovers.values());
  const pending = sessionId
    ? takeovers.filter(t => t.session_id === sessionId && t.resolution === undefined)
    : takeovers.filter(t => t.resolution === undefined);

  const recent = takeovers
    .filter(t => t.resolution !== undefined)
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 10);

  return {
    pending_takeovers: pending.map(t => ({
      takeover_id: t.takeover_id,
      reason: t.reason,
      session_id: t.session_id,
      created_at: t.created_at,
      perception_snapshot: t.perception_snapshot ? {
        element_count: (() => { try { const p = JSON.parse(t.perception_snapshot!); return Array.isArray(p.elements) ? p.elements.length : 0; } catch { return 0; } })(),
        active_window: (() => { try { const p = JSON.parse(t.perception_snapshot!); return p.active_window_title; } catch { return undefined; } })()
      } : undefined,
      pending_action_description: t.pending_action ? String(t.pending_action) : undefined
    })),
    recent_resolutions: recent.map(t => ({
      takeover_id: t.takeover_id,
      resolution: t.resolution ?? "unknown",
      resolved_by: t.resolved_by,
      resolved_at: t.resolved_at ?? t.created_at
    })),
    escalation_count: pending.filter(t => t.reason === "escalation" || t.reason === "unsafe_action_detected").length,
    auto_escalation_enabled: true
  };
}

export function buildRiskRecoveryState(sessionId?: string): RiskRecoveryState {
  const risks: RiskRecoveryState["active_risks"] = [];
  const failures: RiskRecoveryState["failure_states"] = [];

  if (sessionId) {
    const session = store.computerUseSessions.get(sessionId);
    if (session) {
      if (session.status === "failed") {
        failures.push({
          state_id: createEntityId("failure"),
          kind: "session_failed",
          description: `Computer use session ${sessionId} has failed`,
          recoverable: true,
          recovery_action: "Create a new session or resume from checkpoint",
          created_at: nowIso()
        });
      }

      if (session.status === "human_takeover") {
        risks.push({
          risk_id: createEntityId("risk"),
          kind: "human_takeover_required",
          description: "Session requires human intervention",
          severity: "high",
          recommended_action: "Review the takeover request and choose to resume, modify, or cancel",
          created_at: nowIso()
        });
      }

      if (session.sandbox_tier === "isolated_mutation") {
        risks.push({
          risk_id: createEntityId("risk"),
          kind: "isolated_sandbox",
          description: "Session is running in isolated mutation sandbox - some actions are restricted",
          severity: "medium",
          recommended_action: "Switch to guarded_mutation if more capabilities are needed",
          created_at: nowIso()
        });
      }
    }

    const steps = Array.from(store.computerUseSteps.values())
      .filter(s => s.session_id === sessionId);

    const failedSteps = steps.filter(s => s.verification_result === "error");
    for (const step of failedSteps.slice(-3)) {
      failures.push({
        state_id: createEntityId("failure"),
        kind: "step_failed",
        description: `Step ${step.step_number} (${step.kind}) failed: ${step.verification_result}`,
        recoverable: true,
        recovery_action: "Retry the step or use an alternative approach",
        created_at: step.completed_at ?? step.started_at
      });
    }
  }

  const overallRisk: RiskRecoveryState["current_risk_level"] =
    risks.some(r => r.severity === "critical") ? "critical"
    : risks.some(r => r.severity === "high") ? "high"
    : risks.some(r => r.severity === "medium") ? "medium"
    : risks.length > 0 ? "low"
    : "none";

  const recoveryOptions: RiskRecoveryState["recovery_options"] = [
    {
      option_id: createEntityId("recovery"),
      description: "Retry the last failed step",
      risk_level: "low",
      compensable: false,
      requires_confirmation: false
    },
    {
      option_id: createEntityId("recovery"),
      description: "Switch to computer-use fallback approach",
      risk_level: "medium",
      compensable: true,
      requires_confirmation: true
    },
    {
      option_id: createEntityId("recovery"),
      description: "Escalate to human operator",
      risk_level: "none",
      compensable: false,
      requires_confirmation: false
    }
  ];

  return {
    current_risk_level: overallRisk,
    active_risks: risks,
    recovery_options: recoveryOptions,
    failure_states: failures
  };
}

export function recordExecutionStateTransition(input: {
  sessionId: string;
  fromState: string;
  toState: string;
  trigger: string;
  metadata?: Record<string, unknown>;
  workspaceId?: string;
}): ExecutionStateTransition {
  const transition: ExecutionStateTransition = {
    transition_id: createEntityId("transition"),
    session_id: input.sessionId,
    from_state: input.fromState,
    to_state: input.toState,
    trigger: input.trigger,
    timestamp: nowIso(),
    metadata: input.metadata ?? {}
  };

  if (input.workspaceId) {
    const workspace = workspaceStates.get(input.workspaceId);
    if (workspace) {
      workspace.execution_transitions.push(transition);
      workspace.last_updated = nowIso();
    }
  }

  try {
    log("info", "execution_state_transition", {
      transition_id: transition.transition_id,
      session_id: input.sessionId,
      from_state: input.fromState,
      to_state: input.toState,
      trigger: input.trigger
    });
  } catch { /* logging failure should not block */ }

  return transition;
}

export function getExecutionStateTimeline(sessionId: string, workspaceId?: string): ExecutionStateTransition[] {
  if (workspaceId) {
    const workspace = workspaceStates.get(workspaceId);
    if (workspace) {
      return workspace.execution_transitions.filter(t => t.session_id === sessionId);
    }
  }
  return [];
}

export function buildFullWorkspaceState(workspaceId: string): DesktopWorkspaceState | null {
  const workspace = workspaceStates.get(workspaceId);
  if (!workspace) return null;

  const sessionId = workspace.active_panels.find(p => p.kind === "computer_use")?.session_id;

  if (sessionId) {
    workspace.computer_use_panel = buildComputerUsePanelState(sessionId);
    workspace.replay_panel = buildReplayVisualizationState(sessionId);
    workspace.takeover_console = buildHumanTakeoverConsoleState(sessionId);
    workspace.risk_state = buildRiskRecoveryState(sessionId);
  } else {
    workspace.takeover_console = buildHumanTakeoverConsoleState();
    workspace.risk_state = buildRiskRecoveryState();
  }

  const tttPanel = workspace.active_panels.find(p => p.kind === "hybrid_memory_ttt");
  if (tttPanel) {
    workspace.hybrid_memory_ttt_panel = buildHybridMemoryTTTPanelState(tttPanel.task_id);
  }

  const workerSessionPanel = workspace.active_panels.find(p => p.kind === "worker_session");
  if (workerSessionPanel) {
    workspace.worker_session_panel = buildWorkerSessionPanelState();
  }

  const scheduledJobsPanel = workspace.active_panels.find(p => p.kind === "scheduled_jobs");
  if (scheduledJobsPanel) {
    workspace.scheduled_jobs_panel = buildScheduledJobsPanelState();
  }

  const delegatedRuntimePanel = workspace.active_panels.find(p => p.kind === "delegated_runtime");
  if (delegatedRuntimePanel) {
    workspace.delegated_runtime_panel = buildDelegatedRuntimePanelState();
  }

  const deerflowPanel = workspace.active_panels.find(p => p.kind === "deerflow_boundary");
  if (deerflowPanel) {
    workspace.deerflow_boundary_panel = buildDeerFlowBoundaryPanelState();
  }

  const blockerDashboardPanel = workspace.active_panels.find(p => p.kind === "blocker_dashboard");
  if (blockerDashboardPanel) {
    workspace.blocker_dashboard_panel = buildBlockerDashboardPanelState();
  }

  const privilegedExecutionPanel = workspace.active_panels.find(p => p.kind === "privileged_execution");
  if (privilegedExecutionPanel) {
    workspace.privileged_execution_panel = buildPrivilegedExecutionPanelState();
  }

  const readinessMatrixPanel = workspace.active_panels.find(p => p.kind === "readiness_matrix");
  if (readinessMatrixPanel) {
    workspace.readiness_matrix_panel = buildReadinessMatrixPanelState();
  }

  const evolutionPanel = workspace.active_panels.find(p => p.kind === "evolution_status");
  if (evolutionPanel) {
    workspace.evolution_status_panel = buildEvolutionStatusPanelState();
  }

  const remoteSkillReviewPanel = workspace.active_panels.find(p => p.kind === "remote_skill_review");
  if (remoteSkillReviewPanel) {
    workspace.remote_skill_review_panel = buildRemoteSkillReviewPanelState();
  }

  workspace.last_updated = nowIso();
  return workspace;
}

export function buildEvolutionStatusPanelState(): EvolutionStatusPanelState {
  const { getEvolutionDiagnostics } = require("./evolution-runtime.js") as typeof import("./evolution-runtime.js");
  const diag = getEvolutionDiagnostics();
  const recentCandidates = [...store.evolutionCandidates.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map(c => ({
      candidate_id: c.candidate_id,
      target_name: c.target_name,
      kind: c.kind,
      status: c.status,
      confidence: c.confidence,
      created_at: c.created_at
    }));
  return {
    skill_runs: diag.skill_runs,
    prompt_runs: diag.prompt_runs,
    tool_desc_runs: diag.tool_desc_runs,
    total_candidates: diag.total_candidates,
    promoted: diag.promoted,
    rejected: diag.rejected,
    rolled_back: diag.rolled_back,
    pending: diag.pending,
    recent_candidates: recentCandidates
  };
}

export function buildRemoteSkillReviewPanelState(): RemoteSkillReviewPanelState {
  const { getClawHubDiagnostics } = require("./clawhub-registry-adapter.js") as typeof import("./clawhub-registry-adapter.js");
  const diag = getClawHubDiagnostics();

  const pendingReviews = [...store.clawHubInstallRecords.values()]
    .filter(i => i.install_status === "pending_review")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map(i => {
      const verdict = [...store.remoteSkillTrustVerdicts.values()]
        .find(v => v.remote_skill_id === i.remote_skill_id);
      return {
        install_id: i.install_id,
        remote_skill_id: i.remote_skill_id,
        remote_skill_name: i.remote_skill_name,
        remote_version: i.remote_version,
        trust_level: verdict?.trust_level ?? "untrusted",
        governance_review_required: i.governance_review_required,
        created_at: i.created_at
      };
    });

  const recentVerdicts = [...store.remoteSkillTrustVerdicts.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map(v => ({
      verdict_id: v.verdict_id,
      remote_skill_id: v.remote_skill_id,
      trust_level: v.trust_level,
      compatibility_check: v.compatibility_check,
      policy_compliant: v.policy_compliant,
      publisher_verified: v.publisher_verified,
      governance_review_required: v.governance_review_required,
      created_at: v.created_at
    }));

  return {
    registry_configs: diag.registry_configs,
    pending_installs: diag.pending_installs,
    pending_publishes: diag.pending_publishes,
    trust_verdicts: diag.trust_verdicts,
    pending_reviews: pendingReviews,
    recent_verdicts: recentVerdicts
  };
}

export function buildHybridMemoryTTTPanelState(taskId?: string): HybridMemoryTTTPanelState {
  let currentMemoryMode = "durable_retrieval";
  let recommendation: HybridMemoryTTTPanelState["recommendation"] = undefined;
  let gateResult: HybridMemoryTTTPanelState["gate_result"] = undefined;
  let adaptationRun: HybridMemoryTTTPanelState["adaptation_run"] = undefined;
  let distillationStatus: HybridMemoryTTTPanelState["distillation_status"] = undefined;
  let memoryRoutingSummary: HybridMemoryTTTPanelState["memory_routing_summary"] = undefined;

  try {
    const {
      getTTTVisibilitySummary,
      getTTTTraceForTask,
      getTTTBudgetLedger,
      listTTTEligibleTaskFamilies,
      listTTTModelAdapters,
      computeMemoryHitQuality,
      scoreMemoryRoutingCandidates
    } = require("./hybrid-memory-ttt.js") as typeof import("./hybrid-memory-ttt.js");

    const visibility = getTTTVisibilitySummary(taskId);
    currentMemoryMode = visibility.current_memory_mode;

    if (taskId) {
      const trace = getTTTTraceForTask(taskId);

      if (trace.recommendations.length > 0) {
        const rec = trace.recommendations[trace.recommendations.length - 1];
        recommendation = {
          recommendation_id: rec.recommendation_id,
          recommended_mode: rec.recommended_mode,
          confidence: rec.confidence,
          reason: rec.reason,
          expected_benefit: rec.expected_benefit,
          fallback_mode: rec.fallback_mode
        };
      }

      if (trace.gate_results.length > 0) {
        const gate = trace.gate_results[trace.gate_results.length - 1];
        gateResult = {
          gate_id: gate.gate_id,
          verdict: gate.verdict,
          original_mode: gate.original_mode,
          resolved_mode: gate.resolved_mode,
          checks: gate.checks as Record<string, boolean>,
          denial_reason: gate.denial_reason,
          downgrade_reason: gate.downgrade_reason
        };
      }

      if (trace.adaptation_runs.length > 0) {
        const run = trace.adaptation_runs[trace.adaptation_runs.length - 1];
        adaptationRun = {
          run_id: run.run_id,
          status: run.status,
          baseline_quality: (run.baseline_result as Record<string, unknown>)?.quality_score as number ?? 0,
          adapted_quality: (run.adapted_result as Record<string, unknown>)?.quality_score as number ?? 0,
          delta_verdict: run.delta_analysis?.verdict ?? "n/a",
          improvement_score: run.delta_analysis?.improvement_score ?? 0,
          budget_consumed: run.budget_consumed
        };
      }

      if (trace.distillation_records.length > 0) {
        const dist = trace.distillation_records[trace.distillation_records.length - 1];
        distillationStatus = {
          distillation_id: dist.distillation_id,
          status: dist.status,
          targets: dist.targets,
          artifact_count: dist.distilled_artifacts.length
        };
      }

      const task = store.tasks.get(taskId);
      if (task) {
        const hitQuality = computeMemoryHitQuality({
          query: task.intent,
          task_id: taskId,
          task_family: task.inputs?.task_family as string | undefined,
          department: task.department
        });
        const routing = scoreMemoryRoutingCandidates({
          query: task.intent,
          task_id: taskId,
          task_family: task.inputs?.task_family as string | undefined,
          department: task.department,
          top_k: 5
        });
        memoryRoutingSummary = {
          top_candidates: routing.candidates.map(c => ({
            memory_id: c.memory_id,
            title: c.title,
            kind: c.kind,
            score: c.score
          })),
          hit_quality: hitQuality
        };
      }
    }

    const ledger = getTTTBudgetLedger();
    const adapters = listTTTModelAdapters();
    const eligibleFamilies = listTTTEligibleTaskFamilies();

    return {
      task_id: taskId,
      current_memory_mode: currentMemoryMode,
      recommendation,
      gate_result: gateResult,
      adaptation_run: adaptationRun,
      budget_summary: {
        total: ledger.total_budget,
        consumed: ledger.consumed,
        remaining: ledger.remaining
      },
      eligible_task_families: eligibleFamilies,
      available_adapters: adapters.map(a => ({
        name: a.name,
        kind: a.kind,
        supports_weight_update: a.supports_weight_update
      })),
      memory_routing_summary: memoryRoutingSummary,
      distillation_status: distillationStatus
    };
  } catch {
    return {
      task_id: taskId,
      current_memory_mode: currentMemoryMode,
      budget_summary: { total: 0, consumed: 0, remaining: 0 },
      eligible_task_families: [],
      available_adapters: []
    };
  }
}

export function buildWorkerSessionPanelState(): WorkerSessionPanelState {
  const sessions = [...store.workerSessions.values()];

  const sessionDiagnostics = sessions.map(session => {
    const issues: string[] = [];
    if (session.status === "orphaned") issues.push("Orphaned session");
    if (session.status === "stalled") issues.push("Stalled session");
    if (session.status === "expired") issues.push("Expired session");
    if (session.restart_count >= session.max_restarts) issues.push("Max restarts exceeded");
    const lease = session.lease_id ? store.sandboxLeases.get(session.lease_id) : undefined;
    if (lease && lease.status !== "active") issues.push(`Lease is ${lease.status}`);

    return {
      session_id: session.session_id,
      worker_id: session.worker_id,
      task_id: session.task_id,
      attempt_id: session.attempt_id,
      status: session.status,
      started_at: session.started_at,
      last_heartbeat_at: session.last_heartbeat_at,
      step_count: session.step_count,
      restart_count: session.restart_count,
      max_restarts: session.max_restarts,
      supervision_policy: session.supervision_policy,
      lease_id: session.lease_id,
      is_healthy: issues.length === 0,
      health_issues: issues
    };
  });

  const resumePackages = [...store.delegatedResumePackages.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
    .map(p => ({
      package_id: p.package_id,
      session_id: p.session_id,
      task_id: p.task_id,
      status: p.status,
      checkpoint_id: p.checkpoint_id,
      superseded_package_id: p.superseded_package_id,
      applied_at: p.applied_at,
      created_at: p.created_at
    }));

  const supervisionEvents = store.workerSupervisionEvents.toArray()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
    .map(e => ({
      event_id: e.event_id,
      session_id: e.session_id,
      event_kind: e.event_kind,
      created_at: e.created_at
    }));

  return {
    sessions: sessionDiagnostics,
    expired_sessions: sessions.filter(s => s.status === "expired").length,
    stalled_sessions: sessions.filter(s => s.status === "stalled").length,
    orphaned_sessions: sessions.filter(s => s.status === "orphaned").length,
    active_leases: [...store.sandboxLeases.values()].filter(l => l.status === "active").length,
    resume_packages: resumePackages,
    supervision_events: supervisionEvents
  };
}

export function buildScheduledJobsPanelState(): ScheduledJobsPanelState {
  let healthDiagnostics: ScheduledJobsPanelState["health_diagnostics"] = {
    total_jobs: 0,
    active_jobs: 0,
    jobs_with_errors: 0,
    jobs_with_missed_runs: 0,
    health_status: "healthy",
    issues: [],
    follow_up_tasks: []
  };

  let jobs: ScheduledJobsPanelState["jobs"] = [];

  try {
    const {
      listCronScheduledJobs,
      getScheduleHealthDiagnostics
    } = require("./scheduler-metrics.js") as typeof import("./scheduler-metrics.js");

    const scheduledJobs = listCronScheduledJobs();
    healthDiagnostics = getScheduleHealthDiagnostics();

    jobs = scheduledJobs.map(j => ({
      job_id: j.job_id,
      name: j.name,
      cron_expression: j.cron_expression,
      handler_name: j.handler_name,
      is_active: j.is_active,
      last_run_at: j.last_run_at,
      next_run_at: j.next_run_at,
      run_count: j.run_count,
      error_count: j.error_count,
      consecutive_error_count: j.consecutive_error_count,
      missed_run_count: j.missed_run_count,
      checkpoint_aware: j.checkpoint_aware,
      maintenance_cycle_job: j.maintenance_cycle_job
    }));
  } catch { /* use defaults */ }

  const stuckTasks: ScheduledJobsPanelState["stuck_tasks"] = [];
  for (const task of store.tasks.values()) {
    if (task.status === "running") {
      const lastHeartbeat = store.heartbeatRecords.toArray()
        .filter(h => (h as Record<string, unknown>).task_id === task.task_id)
        .sort((a, b) => String((b as Record<string, unknown>).created_at ?? "") > String((a as Record<string, unknown>).created_at ?? "") ? 1 : -1)[0];

      const lastActivity = lastHeartbeat
        ? String((lastHeartbeat as Record<string, unknown>).created_at ?? "")
        : (task.timestamps?.updated_at ?? task.timestamps?.created_at ?? nowIso());

      const elapsed = Date.now() - Date.parse(lastActivity);
      if (elapsed > 600000) {
        stuckTasks.push({
          task_id: task.task_id,
          intent: task.intent,
          status: task.status,
          stuck_reason: elapsed > 3600000 ? "no_heartbeat_over_1h" : "no_heartbeat_over_10m",
          last_activity_at: lastActivity
        });
      }
    }
  }

  return {
    jobs,
    health_diagnostics: healthDiagnostics,
    stuck_tasks: stuckTasks,
    maintenance_cycle_visibility: {
      last_cycle_at: undefined,
      next_cycle_at: undefined,
      cycle_results: {
        expired_sessions: 0,
        stalled_sessions: 0,
        orphaned_sessions: 0,
        restarted_sessions: 0,
        expired_leases: 0
      }
    }
  };
}

export function buildDelegatedRuntimePanelState(): DelegatedRuntimePanelState {
  const sessions = [...store.workerSessions.values()];
  const statusCounts: Record<string, number> = {};
  for (const session of sessions) {
    statusCounts[session.status] = (statusCounts[session.status] ?? 0) + 1;
  }

  const packages = [...store.delegatedResumePackages.values()];
  const packageSummary: DelegatedRuntimePanelState["resume_package_summary"] = {
    prepared: packages.filter(p => p.status === "prepared").length,
    applied: packages.filter(p => p.status === "applied").length,
    superseded: packages.filter(p => p.status === "superseded").length,
    failed: packages.filter(p => p.status === "failed").length,
    rolled_back: packages.filter(p => p.status === "rolled_back").length
  };

  const supervisionEvents = store.workerSupervisionEvents.toArray()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 15)
    .map(e => ({
      event_id: e.event_id,
      session_id: e.session_id,
      worker_id: e.worker_id,
      event_kind: e.event_kind,
      created_at: e.created_at
    }));

  const attemptLinkage: DelegatedRuntimePanelState["attempt_linkage"] = [];
  for (const attempt of store.taskAttempts.toArray()) {
    attemptLinkage.push({
      attempt_id: attempt.attempt_id,
      session_id: attempt.worker_session_id,
      lease_id: attempt.sandbox_lease_id,
      run_id: attempt.run_id,
      verdict: attempt.verdict
    });
  }

  const recoveryActions: DelegatedRuntimePanelState["recovery_actions"] = [];

  for (const session of sessions) {
    if (session.status === "orphaned" || session.status === "stalled") {
      recoveryActions.push({
        action_id: createEntityId("recovery"),
        description: `Restart ${session.status} session ${session.session_id.slice(0, 12)}`,
        target_type: "session",
        target_id: session.session_id,
        available: session.restart_count < session.max_restarts
      });
    }
  }

  for (const pkg of packages) {
    if (pkg.status === "prepared") {
      recoveryActions.push({
        action_id: createEntityId("recovery"),
        description: `Apply resume package ${pkg.package_id.slice(0, 12)}`,
        target_type: "package",
        target_id: pkg.package_id,
        available: true
      });
    }
  }

  for (const lease of store.sandboxLeases.values()) {
    if (lease.status === "active" && lease.expires_at && Date.parse(lease.expires_at) < Date.now()) {
      recoveryActions.push({
        action_id: createEntityId("recovery"),
        description: `Release expired lease ${lease.lease_id.slice(0, 12)}`,
        target_type: "lease",
        target_id: lease.lease_id,
        available: true
      });
    }
  }

  return {
    active_sessions: sessions.filter(s => s.status === "active").length,
    total_sessions: sessions.length,
    sessions_by_status: statusCounts,
    resume_package_summary: packageSummary,
    recent_supervision_events: supervisionEvents,
    attempt_linkage: attemptLinkage,
    recovery_actions: recoveryActions
  };
}

export function buildDeerFlowBoundaryPanelState(): DeerFlowBoundaryPanelState {
  const routes = [...store.deerFlowWorkerRoutes.values()];

  return {
    routes: routes.map(r => ({
      route_id: r.route_id,
      worker_name: r.worker_name,
      adapter_boundary: r.adapter_boundary,
      compatibility_version: r.compatibility_version,
      is_backbone: r.is_backbone,
      created_at: r.created_at
    })),
    import_hooks: [],
    compatibility_status: routes.length > 0 ? "available" : "partial",
    non_backbone_semantics: "DeerFlow routes are non-backbone compatibility boundaries. They do not replace the local runtime. Workers route through adapter boundaries with explicit version contracts."
  };
}

export interface BlockerDashboardPanelState {
  overall_readiness_level: string;
  readiness_percentage: number;
  category_counts: {
    ready_now: number;
    needs_admin: number;
    needs_install: number;
    needs_credential: number;
    needs_external_endpoint: number;
    needs_unavailable_host: number;
  };
  top_blockers: Array<{
    category: string;
    item_name: string;
    impact_level: string;
    remediation?: string;
  }>;
  next_human_actions: Array<{
    action: string;
    priority: string;
    category: string;
    estimated_impact: string;
  }>;
}

export interface PrivilegedExecutionPanelState {
  elevation_status: string;
  total_operations: number;
  ready_count: number;
  blocked_count: number;
  contracts: Array<{
    operation_kind: string;
    readiness_status: string;
    display_name: string;
  }>;
  recent_dry_runs: Array<{
    operation_kind: string;
    would_succeed: boolean;
    would_require_elevation: boolean;
  }>;
}

export interface ReadinessMatrixPanelState {
  matrix_id: string;
  total_items: number;
  readiness_percentage: number;
  entries_by_category: Record<string, number>;
  source_layer_counts: Record<string, number>;
  last_generated_at: string;
}

export function buildBlockerDashboardPanelState(): BlockerDashboardPanelState {
  const { buildBlockerDashboardState } = require("./blocker-dashboard.js") as typeof import("./blocker-dashboard.js");
  const dashboard = buildBlockerDashboardState();

  return {
    overall_readiness_level: dashboard.overall_readiness_level,
    readiness_percentage: dashboard.readiness_percentage,
    category_counts: dashboard.category_counts,
    top_blockers: dashboard.top_blockers,
    next_human_actions: dashboard.next_human_actions
  };
}

export function buildPrivilegedExecutionPanelState(): PrivilegedExecutionPanelState {
  const { getPrivilegedReadinessDiagnostics, listElevationDryRunResults } = require("./privileged-execution-readiness.js") as typeof import("./privileged-execution-readiness.js");
  const diagnostics = getPrivilegedReadinessDiagnostics();
  const dryRuns = listElevationDryRunResults().slice(-5);

  return {
    elevation_status: diagnostics.elevation_status,
    total_operations: diagnostics.summary.total_operations,
    ready_count: diagnostics.summary.ready_count,
    blocked_count: diagnostics.summary.blocked_by_admin_count,
    contracts: diagnostics.contracts,
    recent_dry_runs: dryRuns.map(dr => ({
      operation_kind: dr.operation_kind,
      would_succeed: dr.would_succeed,
      would_require_elevation: dr.would_require_elevation
    }))
  };
}

export function buildReadinessMatrixPanelState(): ReadinessMatrixPanelState {
  const { buildReadinessMatrix } = require("./blocker-dashboard.js") as typeof import("./blocker-dashboard.js");
  const matrix = buildReadinessMatrix();

  const entriesByCategory: Record<string, number> = {};
  const sourceLayerCounts: Record<string, number> = {};
  for (const entry of matrix.entries) {
    entriesByCategory[entry.category] = (entriesByCategory[entry.category] ?? 0) + 1;
    sourceLayerCounts[entry.source_layer] = (sourceLayerCounts[entry.source_layer] ?? 0) + 1;
  }

  return {
    matrix_id: matrix.matrix_id,
    total_items: matrix.summary.total_items,
    readiness_percentage: matrix.summary.readiness_percentage,
    entries_by_category: entriesByCategory,
    source_layer_counts: sourceLayerCounts,
    last_generated_at: matrix.generated_at
  };
}

export interface AcceptanceStatusPanelState {
  has_review: boolean;
  verdict: string;
  deterministic_passed: boolean;
  findings_count: number;
  critical_findings: number;
  warning_findings: number;
  can_proceed: boolean;
  requires_human_approval: boolean;
  completion_path: {
    has_deterministic_checklist: boolean;
    has_acceptance_review: boolean;
    has_reconciliation: boolean;
    has_done_gate: boolean;
    can_mark_done: boolean;
  };
  missing_items: string[];
  suggested_rerun_scope?: string;
}

export interface BudgetStatusPanelState {
  has_budget: boolean;
  hard_limit: number;
  estimated_cost: number;
  budget_remaining: number;
  warning_threshold: number;
  budget_exhausted: boolean;
  near_warning: boolean;
  on_limit_reached: string;
  total_input_tokens: number;
  total_output_tokens: number;
  interruption_pending: boolean;
  interruption_event_id?: string;
  interruption_kind?: "warning" | "hard_stop";
  task_paused_by_budget: boolean;
  spend_at_interruption?: number;
  limit_at_interruption?: number;
}

export interface MultiAgentLimitsPanelState {
  resource_mode: string;
  max_parallel: number;
  max_total_per_task: number;
  max_delegation_depth: number;
  cpu_reserve_ratio: number;
  memory_reserve_ratio: number;
  effective_max_parallel: number;
  effective_max_total_per_task: number;
  effective_max_depth: number;
  clamped_by: string;
  logical_cpu_cores: number;
  available_memory_mb: number;
}

export function buildAcceptanceStatusPanelState(taskId: string): AcceptanceStatusPanelState {
  try {
    const { listAcceptanceReviewsForTask, listAcceptanceVerdictsForTask, getCompletionPathStatus } = require("./acceptance-agent.js") as typeof import("./acceptance-agent.js");
    const reviews = listAcceptanceReviewsForTask(taskId);
    const verdicts = listAcceptanceVerdictsForTask(taskId);
    const completionPath = getCompletionPathStatus(taskId);
    const latestReview = reviews[0];
    const latestVerdict = verdicts[0];

    return {
      has_review: reviews.length > 0,
      verdict: latestVerdict?.verdict ?? "pending",
      deterministic_passed: latestReview?.deterministic_passed ?? false,
      findings_count: latestReview?.findings.length ?? 0,
      critical_findings: latestReview?.findings.filter(f => f.severity === "critical").length ?? 0,
      warning_findings: latestReview?.findings.filter(f => f.severity === "warning").length ?? 0,
      can_proceed: latestVerdict?.can_proceed ?? false,
      requires_human_approval: latestVerdict?.requires_human_approval ?? false,
      completion_path: completionPath,
      missing_items: latestVerdict?.missing_items ?? [],
      suggested_rerun_scope: latestVerdict?.suggested_rerun_scope
    };
  } catch {
    return {
      has_review: false,
      verdict: "pending",
      deterministic_passed: false,
      findings_count: 0,
      critical_findings: 0,
      warning_findings: 0,
      can_proceed: false,
      requires_human_approval: false,
      completion_path: { has_deterministic_checklist: false, has_acceptance_review: false, has_reconciliation: false, has_done_gate: false, can_mark_done: false },
      missing_items: []
    };
  }
}

export function buildBudgetStatusPanelState(taskId: string): BudgetStatusPanelState {
  try {
    const { getBudgetStatusForTask, getBudgetPolicyForTask, getPendingInterruptionForTask } = require("./task-budget.js") as typeof import("./task-budget.js");
    const status = getBudgetStatusForTask(taskId);
    const policy = getBudgetPolicyForTask(taskId);
    const pendingInterruption = getPendingInterruptionForTask(taskId);

    return {
      has_budget: !!status,
      hard_limit: status?.hard_limit ?? policy?.hard_limit_amount ?? 5,
      estimated_cost: status?.estimated_cost ?? 0,
      budget_remaining: status?.budget_remaining ?? 5,
      warning_threshold: status?.warning_threshold ?? 4,
      budget_exhausted: status?.budget_exhausted ?? false,
      near_warning: status ? status.estimated_cost >= status.warning_threshold : false,
      on_limit_reached: policy?.on_limit_reached ?? "pause_and_ask",
      total_input_tokens: status?.total_input_tokens ?? 0,
      total_output_tokens: status?.total_output_tokens ?? 0,
      interruption_pending: !!pendingInterruption,
      interruption_event_id: pendingInterruption?.event_id,
      interruption_kind: pendingInterruption?.interruption_kind,
      task_paused_by_budget: !!pendingInterruption && pendingInterruption.interruption_kind === "hard_stop",
      spend_at_interruption: pendingInterruption?.spend_at_interruption,
      limit_at_interruption: pendingInterruption?.limit_at_interruption
    };
  } catch {
    return {
      has_budget: false,
      hard_limit: 5,
      estimated_cost: 0,
      budget_remaining: 5,
      warning_threshold: 4,
      budget_exhausted: false,
      near_warning: false,
      on_limit_reached: "pause_and_ask",
      total_input_tokens: 0,
      total_output_tokens: 0,
      interruption_pending: false,
      task_paused_by_budget: false
    };
  }
}

export function buildMultiAgentLimitsPanelState(): MultiAgentLimitsPanelState {
  try {
    const { loadDelegationPolicy, computeEffectiveDelegationLimits, detectMachineResources } = require("./delegation-policy.js") as typeof import("./delegation-policy.js");
    const policy = loadDelegationPolicy();
    const limits = computeEffectiveDelegationLimits(policy);
    const machine = detectMachineResources();

    return {
      resource_mode: policy.subagent_resource_mode,
      max_parallel: policy.max_parallel_subagents,
      max_total_per_task: policy.max_total_subagents_per_task,
      max_delegation_depth: policy.max_delegation_depth,
      cpu_reserve_ratio: policy.cpu_reserve_ratio,
      memory_reserve_ratio: policy.memory_reserve_ratio,
      effective_max_parallel: limits.effective_max_parallel,
      effective_max_total_per_task: limits.effective_max_total_per_task,
      effective_max_depth: limits.effective_max_depth,
      clamped_by: limits.clamped_by,
      logical_cpu_cores: machine.logical_cpu_cores,
      available_memory_mb: machine.available_memory_mb
    };
  } catch {
    return {
      resource_mode: "auto",
      max_parallel: 4,
      max_total_per_task: 8,
      max_delegation_depth: 2,
      cpu_reserve_ratio: 0.2,
      memory_reserve_ratio: 0.2,
      effective_max_parallel: 4,
      effective_max_total_per_task: 8,
      effective_max_depth: 2,
      clamped_by: "none",
      logical_cpu_cores: 0,
      available_memory_mb: 0
    };
  }
}
