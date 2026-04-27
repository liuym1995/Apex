import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  DelegatedResumePackageSchema,
  WorkerSupervisionEventSchema,
  WorkerSessionSchema,
  type DelegatedResumePackage,
  type WorkerSupervisionEvent,
  type WorkerSession,
  type SandboxLease,
  type TaskRun,
  type TaskAttempt,
  type CheckpointSnapshot
} from "@apex/shared-types";
import { recordAudit } from "./core.js";
import {
  createDispatchPlan,
  addDispatchStep,
  assignStepToSubagent,
  releaseLease as releaseDispatchLease,
  activatePlan,
  getDispatchPlan,
  getDispatchStep,
  getDispatchPlanForTask,
  getActiveLeaseForStep,
  getDispatchLeaseById,
  failDispatchStep,
  updateStepResult,
  type AgentDispatchPlan,
  type AgentDispatchStep,
  type SubagentAssignment,
  type AssignmentLease
} from "./dispatch-plan-leasing.js";
import { buildSubagentContextEnvelope, buildSubagentResultEnvelope } from "./subagent-envelopes.js";
import { loadDelegationPolicy, computeEffectiveDelegationLimits } from "./delegation-policy.js";
import { getBudgetPolicyForTask } from "./task-budget.js";

function recordSupervisionEvent(input: {
  sessionId: string;
  workerId: string;
  eventKind: WorkerSupervisionEvent["event_kind"];
  details?: Record<string, unknown>;
}): WorkerSupervisionEvent {
  const event = WorkerSupervisionEventSchema.parse({
    event_id: createEntityId("wsevt"),
    session_id: input.sessionId,
    worker_id: input.workerId,
    event_kind: input.eventKind,
    details: input.details ?? {},
    created_at: nowIso()
  });
  store.workerSupervisionEvents.push(event);
  return event;
}

export interface DispatchLeaseContext {
  plan: AgentDispatchPlan;
  step: AgentDispatchStep;
  assignment: SubagentAssignment;
  lease: AssignmentLease;
}

export function createDispatchLeaseForDelegation(input: {
  task_id: string;
  supervisor_agent_id: string;
  step_goal: string;
  subagent_id: string;
}): DispatchLeaseContext | { error: string } {
  let plan = getDispatchPlanForTask(input.task_id);
  if (!plan) {
    plan = createDispatchPlan({
      task_id: input.task_id,
      supervisor_agent_id: input.supervisor_agent_id
    });
    activatePlan(plan.plan_id);
  }

  const stepResult = addDispatchStep({
    plan_id: plan.plan_id,
    goal: input.step_goal,
    supervisor_agent_id: input.supervisor_agent_id
  });
  if ("error" in stepResult) return { error: stepResult.error };
  const step = stepResult as AgentDispatchStep;

  const existingLease = getActiveLeaseForStep(step.step_id);
  if (existingLease) {
    return { error: "Step already has an active lease. Duplicate assignment denied." };
  }

  const assignmentResult = assignStepToSubagent({
    plan_id: plan.plan_id,
    step_id: step.step_id,
    agent_id: input.subagent_id,
    supervisor_agent_id: input.supervisor_agent_id
  });
  if ("error" in assignmentResult) return { error: assignmentResult.error };
  const assignment = assignmentResult as SubagentAssignment;

  const updatedStep = getDispatchStep(step.step_id);
  const leaseId = updatedStep?.lease_id;
  if (!leaseId) return { error: "Lease not created during assignment" };

  const lease = getDispatchLeaseById(leaseId);
  if (!lease) return { error: "Lease not found after assignment" };

  recordAudit("delegated_runtime.dispatch_lease_created", {
    plan_id: plan.plan_id,
    step_id: step.step_id,
    assignment_id: assignment.assignment_id,
    lease_id: leaseId,
    task_id: input.task_id,
    subagent_id: input.subagent_id
  });

  try {
    const policy = loadDelegationPolicy();
    const limits = computeEffectiveDelegationLimits(policy);
    const budgetPolicy = getBudgetPolicyForTask(input.task_id);
    const contextEnvelope = buildSubagentContextEnvelope({
      plan_id: plan.plan_id,
      step_id: step.step_id,
      agent_id: input.subagent_id,
      step_goal: input.step_goal,
      allowed_tools: ["filesystem_read", "filesystem_write", "shell_exec"],
      allowed_sandbox_tiers: ["host_readonly", "guarded_mutation"],
      max_parallel_subagents: limits.effective_max_parallel,
      max_delegation_depth: limits.effective_max_depth,
      budget_limit: budgetPolicy?.hard_limit_amount,
      definition_of_done: [`Complete: ${input.step_goal}`, "Produce evidence of completion"]
    });
    recordAudit("delegated_runtime.context_envelope_auto_created", {
      envelope_id: contextEnvelope.envelope_id,
      plan_id: plan.plan_id,
      step_id: step.step_id,
      subagent_id: input.subagent_id
    });
  } catch {}

  return { plan, step: updatedStep ?? step, assignment, lease };
}

export function releaseDispatchLeaseForSession(leaseId: string, reason: "completed" | "failed" | "cancelled" = "completed"): AssignmentLease | { error: string } {
  const result = releaseDispatchLease(leaseId);
  if ("error" in result) return result;

  const lease = result as AssignmentLease;

  if (reason === "failed" || reason === "cancelled") {
    const step = getDispatchStep(lease.step_id);
    if (step) {
      failDispatchStep(step.step_id, reason);
    }
  }

  try {
    const step = getDispatchStep(lease.step_id);
    if (step) {
      const resultEnvelope = buildSubagentResultEnvelope({
        plan_id: lease.plan_id,
        step_id: lease.step_id,
        agent_id: lease.agent_id,
        status: reason === "completed" ? "completed" : reason === "failed" ? "failed" : "blocked",
        summary: reason === "completed"
          ? `Subagent completed step: ${step.goal}`
          : `Subagent ${reason} step: ${step.goal}`,
        blockers: reason !== "completed" ? [reason] : []
      });
      updateStepResult({ step_id: step.step_id, agent_id: lease.agent_id, result_envelope_ref: resultEnvelope.envelope_id });
      recordAudit("delegated_runtime.result_envelope_auto_created", {
        envelope_id: resultEnvelope.envelope_id,
        plan_id: lease.plan_id,
        step_id: lease.step_id,
        agent_id: lease.agent_id,
        status: resultEnvelope.status
      });
    }
  } catch {}

  recordAudit("delegated_runtime.dispatch_lease_released", {
    lease_id: leaseId,
    reason
  });

  return result;
}

export function createWorkerSessionWithOwnership(input: {
  worker_id: string;
  task_id?: string;
  run_id?: string;
  attempt_id?: string;
  owner_process_id?: string;
  supervision_policy?: WorkerSession["supervision_policy"];
  max_restarts?: number;
  lease_id?: string;
  dispatch_lease_context?: DispatchLeaseContext;
}): WorkerSession {
  const now = nowIso();
  const session = WorkerSessionSchema.parse({
    session_id: createEntityId("wses"),
    worker_id: input.worker_id,
    task_id: input.task_id,
    run_id: input.run_id,
    attempt_id: input.attempt_id,
    status: "active",
    started_at: now,
    last_heartbeat_at: now,
    terminated_at: undefined,
    step_count: 0,
    owner_process_id: input.owner_process_id,
    restart_count: 0,
    max_restarts: input.max_restarts ?? 3,
    last_restart_at: undefined,
    stall_detected_at: undefined,
    orphaned_detected_at: undefined,
    lease_id: input.lease_id,
    dispatch_lease_id: input.dispatch_lease_context?.lease.lease_id,
    dispatch_plan_id: input.dispatch_lease_context?.plan.plan_id,
    supervision_policy: input.supervision_policy ?? "none",
    created_at: now
  });
  store.workerSessions.set(session.session_id, session);

  recordAudit("worker_session.created_with_ownership", {
    session_id: session.session_id,
    worker_id: input.worker_id,
    task_id: input.task_id,
    attempt_id: input.attempt_id,
    owner_process_id: input.owner_process_id,
    supervision_policy: session.supervision_policy,
    dispatch_lease_id: input.dispatch_lease_context?.lease.lease_id,
    dispatch_plan_id: input.dispatch_lease_context?.plan.plan_id
  });

  return session;
}

export function heartbeatWorkerSessionWithMetadata(sessionId: string, metadata?: {
  step_count?: number;
  current_step_label?: string;
  progress_pct?: number;
}): WorkerSession {
  const session = store.workerSessions.get(sessionId);
  if (!session) throw new Error(`WorkerSession not found: ${sessionId}`);

  session.last_heartbeat_at = nowIso();
  if (metadata?.step_count !== undefined) session.step_count = metadata.step_count;
  if (session.status === "stalled" || session.status === "supervised_restart") {
    session.status = "active";
  }
  store.workerSessions.set(sessionId, session);

  return session;
}

export function detectOrphanedSessions(orphanTimeoutMs: number = 300000): WorkerSession[] {
  const now = Date.now();
  const orphaned: WorkerSession[] = [];

  for (const session of store.workerSessions.values()) {
    if (session.status !== "active" && session.status !== "idle") continue;

    const lastHeartbeat = session.last_heartbeat_at ? Date.parse(session.last_heartbeat_at) : Date.parse(session.started_at);
    if (now - lastHeartbeat > orphanTimeoutMs) {
      session.status = "orphaned";
      session.orphaned_detected_at = nowIso();
      store.workerSessions.set(session.session_id, session);
      orphaned.push(session);

      recordSupervisionEvent({
        sessionId: session.session_id,
        workerId: session.worker_id,
        eventKind: "orphan_detected",
        details: {
          last_heartbeat_at: session.last_heartbeat_at,
          orphan_timeout_ms: orphanTimeoutMs,
          task_id: session.task_id,
          attempt_id: session.attempt_id
        }
      });

      recordAudit("worker_session.orphaned", {
        session_id: session.session_id,
        worker_id: session.worker_id,
        last_heartbeat_at: session.last_heartbeat_at,
        orphan_timeout_ms: orphanTimeoutMs
      });
    }
  }

  return orphaned;
}

export function detectStalledSessions(stallTimeoutMs: number = 120000): WorkerSession[] {
  const now = Date.now();
  const stalled: WorkerSession[] = [];

  for (const session of store.workerSessions.values()) {
    if (session.status !== "active") continue;

    const lastHeartbeat = session.last_heartbeat_at ? Date.parse(session.last_heartbeat_at) : Date.parse(session.started_at);
    const elapsed = now - lastHeartbeat;

    if (elapsed > stallTimeoutMs && elapsed <= (stallTimeoutMs * 3)) {
      session.status = "stalled";
      session.stall_detected_at = nowIso();
      store.workerSessions.set(session.session_id, session);
      stalled.push(session);

      recordSupervisionEvent({
        sessionId: session.session_id,
        workerId: session.worker_id,
        eventKind: "stall_detected",
        details: {
          last_heartbeat_at: session.last_heartbeat_at,
          stall_timeout_ms: stallTimeoutMs,
          elapsed_ms: elapsed
        }
      });

      recordAudit("worker_session.stalled", {
        session_id: session.session_id,
        worker_id: session.worker_id,
        last_heartbeat_at: session.last_heartbeat_at,
        stall_timeout_ms: stallTimeoutMs
      });
    }
  }

  return stalled;
}

export function superviseAndRestartSession(sessionId: string): WorkerSession {
  const session = store.workerSessions.get(sessionId);
  if (!session) throw new Error(`WorkerSession not found: ${sessionId}`);

  if (session.restart_count >= session.max_restarts) {
    session.status = "terminated";
    session.terminated_at = nowIso();
    store.workerSessions.set(sessionId, session);

    recordSupervisionEvent({
      sessionId: session.session_id,
      workerId: session.worker_id,
      eventKind: "restart_failed",
      details: {
        reason: "max_restarts_exceeded",
        restart_count: session.restart_count,
        max_restarts: session.max_restarts
      }
    });

    recordAudit("worker_session.restart_limit_exceeded", {
      session_id: sessionId,
      worker_id: session.worker_id,
      restart_count: session.restart_count,
      max_restarts: session.max_restarts
    });

    return session;
  }

  session.restart_count += 1;
  session.last_restart_at = nowIso();
  session.status = "supervised_restart";
  session.last_heartbeat_at = nowIso();
  session.stall_detected_at = undefined;
  session.orphaned_detected_at = undefined;
  store.workerSessions.set(sessionId, session);

  recordSupervisionEvent({
    sessionId: session.session_id,
    workerId: session.worker_id,
    eventKind: "restart_initiated",
    details: {
      restart_count: session.restart_count,
      max_restarts: session.max_restarts,
      supervision_policy: session.supervision_policy
    }
  });

  recordAudit("worker_session.restart_initiated", {
    session_id: sessionId,
    worker_id: session.worker_id,
    restart_count: session.restart_count,
    max_restarts: session.max_restarts
  });

  return session;
}

export function completeSupervisedRestart(sessionId: string): WorkerSession {
  const session = store.workerSessions.get(sessionId);
  if (!session) throw new Error(`WorkerSession not found: ${sessionId}`);

  if (session.status !== "supervised_restart") {
    throw new Error(`Session is not in supervised_restart state: ${session.status}`);
  }

  session.status = "active";
  session.last_heartbeat_at = nowIso();
  store.workerSessions.set(sessionId, session);

  recordSupervisionEvent({
    sessionId: session.session_id,
    workerId: session.worker_id,
    eventKind: "restart_completed",
    details: {
      restart_count: session.restart_count
    }
  });

  recordAudit("worker_session.restart_completed", {
    session_id: sessionId,
    worker_id: session.worker_id,
    restart_count: session.restart_count
  });

  return session;
}

export function prepareDelegatedResumePackage(input: {
  session_id: string;
  task_id: string;
  attempt_id?: string;
  checkpoint_id?: string;
  superseded_package_id?: string;
  execution_state_summary?: Record<string, unknown>;
  pending_steps?: string[];
}): DelegatedResumePackage {
  const pkg = DelegatedResumePackageSchema.parse({
    package_id: createEntityId("drpkg"),
    session_id: input.session_id,
    task_id: input.task_id,
    attempt_id: input.attempt_id,
    checkpoint_id: input.checkpoint_id,
    superseded_package_id: input.superseded_package_id,
    status: "prepared",
    execution_state_summary: input.execution_state_summary ?? {},
    pending_steps: input.pending_steps ?? [],
    applied_at: undefined,
    superseded_at: undefined,
    applied_by_session_id: undefined,
    created_at: nowIso()
  });

  if (input.superseded_package_id) {
    const superseded = store.delegatedResumePackages.get(input.superseded_package_id);
    if (superseded && superseded.status === "prepared") {
      superseded.status = "superseded";
      superseded.superseded_at = nowIso();
      store.delegatedResumePackages.set(superseded.package_id, superseded);
    }
  }

  store.delegatedResumePackages.set(pkg.package_id, pkg);

  recordAudit("delegated_resume_package.prepared", {
    package_id: pkg.package_id,
    session_id: input.session_id,
    task_id: input.task_id,
    checkpoint_id: input.checkpoint_id,
    superseded_package_id: input.superseded_package_id
  });

  return pkg;
}

export function applyDelegatedResumePackage(packageId: string, applyingSessionId: string): DelegatedResumePackage {
  const pkg = store.delegatedResumePackages.get(packageId);
  if (!pkg) throw new Error(`DelegatedResumePackage not found: ${packageId}`);
  if (pkg.status !== "prepared") throw new Error(`Package is not in prepared state: ${pkg.status}`);

  pkg.status = "applied";
  pkg.applied_at = nowIso();
  pkg.applied_by_session_id = applyingSessionId;
  store.delegatedResumePackages.set(packageId, pkg);

  recordSupervisionEvent({
    sessionId: pkg.session_id,
    workerId: applyingSessionId,
    eventKind: "resume_applied",
    details: {
      package_id: packageId,
      task_id: pkg.task_id,
      checkpoint_id: pkg.checkpoint_id
    }
  });

  recordAudit("delegated_resume_package.applied", {
    package_id: packageId,
    session_id: pkg.session_id,
    task_id: pkg.task_id,
    applied_by_session_id: applyingSessionId
  });

  return pkg;
}

export function failDelegatedResumePackage(packageId: string, reason: string): DelegatedResumePackage {
  const pkg = store.delegatedResumePackages.get(packageId);
  if (!pkg) throw new Error(`DelegatedResumePackage not found: ${packageId}`);

  pkg.status = "failed";
  store.delegatedResumePackages.set(packageId, pkg);

  recordAudit("delegated_resume_package.failed", {
    package_id: packageId,
    reason
  });

  return pkg;
}

export function rollbackDelegatedResumePackage(packageId: string): DelegatedResumePackage {
  const pkg = store.delegatedResumePackages.get(packageId);
  if (!pkg) throw new Error(`DelegatedResumePackage not found: ${packageId}`);
  if (pkg.status !== "applied") throw new Error(`Package is not in applied state: ${pkg.status}`);

  pkg.status = "rolled_back";
  store.delegatedResumePackages.set(packageId, pkg);

  recordAudit("delegated_resume_package.rolled_back", {
    package_id: packageId,
    task_id: pkg.task_id
  });

  return pkg;
}

export function listDelegatedResumePackages(filter?: {
  task_id?: string;
  session_id?: string;
  status?: DelegatedResumePackage["status"];
}): DelegatedResumePackage[] {
  let packages = [...store.delegatedResumePackages.values()];
  if (filter?.task_id) packages = packages.filter(p => p.task_id === filter.task_id);
  if (filter?.session_id) packages = packages.filter(p => p.session_id === filter.session_id);
  if (filter?.status) packages = packages.filter(p => p.status === filter.status);
  return packages.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getDelegatedResumePackage(packageId: string): DelegatedResumePackage | undefined {
  return store.delegatedResumePackages.get(packageId);
}

export function recoverFromCheckpointForSession(sessionId: string, checkpointId: string): {
  session: WorkerSession;
  checkpoint: CheckpointSnapshot | undefined;
} {
  const session = store.workerSessions.get(sessionId);
  if (!session) throw new Error(`WorkerSession not found: ${sessionId}`);

  const checkpoint = store.checkpointSnapshots.get(checkpointId);

  if (session.status === "orphaned" || session.status === "stalled" || session.status === "expired") {
    session.status = "active";
    session.last_heartbeat_at = nowIso();
    session.stall_detected_at = undefined;
    session.orphaned_detected_at = undefined;
    store.workerSessions.set(sessionId, session);
  }

  recordAudit("worker_session.checkpoint_recovery", {
    session_id: sessionId,
    checkpoint_id: checkpointId,
    task_id: session.task_id,
    previous_status: session.status
  });

  return { session, checkpoint };
}

export function releaseLeaseWithCleanup(leaseId: string, reason?: string): SandboxLease {
  const lease = store.sandboxLeases.get(leaseId);
  if (!lease) throw new Error(`SandboxLease not found: ${leaseId}`);

  lease.status = "released";
  lease.released_at = nowIso();
  lease.failure_cleanup_done = true;
  lease.cleanup_reason = reason ?? "normal_release";
  store.sandboxLeases.set(leaseId, lease);

  if (lease.sandbox_manifest_id) {
    const manifest = store.sandboxManifests.get(lease.sandbox_manifest_id);
    if (manifest && manifest.status === "active") {
      manifest.status = "expired";
      store.sandboxManifests.set(lease.sandbox_manifest_id, manifest);
    }
  }

  const linkedSessions = [...store.workerSessions.values()]
    .filter(s => s.lease_id === leaseId && (s.status === "active" || s.status === "idle"));

  for (const linkedSession of linkedSessions) {
    linkedSession.status = "terminated";
    linkedSession.terminated_at = nowIso();
    store.workerSessions.set(linkedSession.session_id, linkedSession);

    if (linkedSession.dispatch_lease_id) {
      try { releaseDispatchLeaseForSession(linkedSession.dispatch_lease_id, "completed"); } catch {}
    }

    recordSupervisionEvent({
      sessionId: linkedSession.session_id,
      workerId: linkedSession.worker_id,
      eventKind: "lease_released",
      details: {
        lease_id: leaseId,
        cleanup_reason: reason
      }
    });
  }

  recordAudit("sandbox_lease.released_with_cleanup", {
    lease_id: leaseId,
    task_id: lease.task_id,
    cleanup_reason: reason,
    terminated_sessions: linkedSessions.length
  });

  return lease;
}

export function forceCleanupForTask(taskId: string): {
  terminated_sessions: WorkerSession[];
  released_leases: SandboxLease[];
  failed_packages: DelegatedResumePackage[];
} {
  const terminatedSessions: WorkerSession[] = [];
  const releasedLeases: SandboxLease[] = [];
  const failedPackages: DelegatedResumePackage[] = [];

  for (const session of store.workerSessions.values()) {
    if (session.task_id === taskId && (session.status === "active" || session.status === "idle" || session.status === "stalled" || session.status === "orphaned")) {
      session.status = "terminated";
      session.terminated_at = nowIso();
      store.workerSessions.set(session.session_id, session);
      terminatedSessions.push(session);

      if (session.dispatch_lease_id) {
        try { releaseDispatchLeaseForSession(session.dispatch_lease_id, "cancelled"); } catch {}
      }

      recordSupervisionEvent({
        sessionId: session.session_id,
        workerId: session.worker_id,
        eventKind: "cleanup_completed",
        details: { task_id: taskId, reason: "force_cleanup" }
      });
    }
  }

  for (const lease of store.sandboxLeases.values()) {
    if (lease.task_id === taskId && lease.status === "active") {
      lease.status = "released";
      lease.released_at = nowIso();
      lease.failure_cleanup_done = true;
      lease.cleanup_reason = "force_cleanup";
      store.sandboxLeases.set(lease.lease_id, lease);
      releasedLeases.push(lease);
    }
  }

  for (const pkg of store.delegatedResumePackages.values()) {
    if (pkg.task_id === taskId && pkg.status === "prepared") {
      pkg.status = "failed";
      store.delegatedResumePackages.set(pkg.package_id, pkg);
      failedPackages.push(pkg);
    }
  }

  recordAudit("delegated_runtime.force_cleanup", {
    task_id: taskId,
    terminated_sessions: terminatedSessions.length,
    released_leases: releasedLeases.length,
    failed_packages: failedPackages.length
  });

  return { terminated_sessions: terminatedSessions, released_leases: releasedLeases, failed_packages: failedPackages };
}

export function linkAttemptToWorkerSession(attemptId: string, sessionId: string): TaskAttempt {
  const attempt = store.taskAttempts.toArray().find(a => a.attempt_id === attemptId);
  if (!attempt) throw new Error(`TaskAttempt not found: ${attemptId}`);

  attempt.worker_session_id = sessionId;
  store.taskAttempts.push(attempt);

  const session = store.workerSessions.get(sessionId);
  if (session) {
    session.attempt_id = attemptId;
    store.workerSessions.set(sessionId, session);
  }

  recordAudit("attempt.worker_session_linked", {
    attempt_id: attemptId,
    session_id: sessionId,
    task_id: attempt.task_id
  });

  return attempt;
}

export function getAttemptWorkerSessionChain(attemptId: string): {
  attempt: TaskAttempt | undefined;
  session: WorkerSession | undefined;
  lease: SandboxLease | undefined;
  run: TaskRun | undefined;
} {
  const attempt = store.taskAttempts.toArray().find(a => a.attempt_id === attemptId);
  if (!attempt) return { attempt: undefined, session: undefined, lease: undefined, run: undefined };

  const session = attempt.worker_session_id
    ? store.workerSessions.get(attempt.worker_session_id)
    : undefined;

  const lease = attempt.sandbox_lease_id
    ? store.sandboxLeases.get(attempt.sandbox_lease_id)
    : undefined;

  const run = [...store.taskRuns.values()].find(r => r.run_id === attempt.run_id);

  return { attempt, session, lease, run };
}

export function runDelegatedRuntimeMaintenanceCycle(options?: {
  heartbeat_timeout_ms?: number;
  stall_timeout_ms?: number;
  orphan_timeout_ms?: number;
  auto_restart?: boolean;
}): {
  expired_sessions: WorkerSession[];
  stalled_sessions: WorkerSession[];
  orphaned_sessions: WorkerSession[];
  restarted_sessions: WorkerSession[];
  expired_leases: SandboxLease[];
} {
  const expiredSessions: WorkerSession[] = [];
  const now = Date.now();
  for (const session of store.workerSessions.values()) {
    if (session.status !== "active" && session.status !== "idle") continue;
    const lastHeartbeat = session.last_heartbeat_at ? Date.parse(session.last_heartbeat_at) : Date.parse(session.started_at);
    if (now - lastHeartbeat > (options?.heartbeat_timeout_ms ?? 60000)) {
      session.status = "expired";
      session.terminated_at = nowIso();
      store.workerSessions.set(session.session_id, session);
      expiredSessions.push(session);
      recordAudit("worker_session.expired", { session_id: session.session_id, worker_id: session.worker_id });
    }
  }

  const expiredLeases: SandboxLease[] = [];
  for (const lease of store.sandboxLeases.values()) {
    if (lease.status === "active" && lease.expires_at && Date.parse(lease.expires_at) < now) {
      lease.status = "expired";
      store.sandboxLeases.set(lease.lease_id, lease);
      expiredLeases.push(lease);
    }
  }

  const stalledSessions = detectStalledSessions(options?.stall_timeout_ms ?? 120000);
  const orphanedSessions = detectOrphanedSessions(options?.orphan_timeout_ms ?? 300000);

  const restartedSessions: WorkerSession[] = [];
  if (options?.auto_restart) {
    const restartable = [...stalledSessions, ...orphanedSessions];
    for (const session of restartable) {
      if (session.supervision_policy === "restart_on_stall" || session.supervision_policy === "restart_on_expiry") {
        try {
          const restarted = superviseAndRestartSession(session.session_id);
          restartedSessions.push(restarted);
        } catch {
          recordSupervisionEvent({
            sessionId: session.session_id,
            workerId: session.worker_id,
            eventKind: "restart_failed",
            details: { reason: "restart_error" }
          });
        }
      }
    }
  }

  recordAudit("delegated_runtime.maintenance_cycle", {
    expired_sessions: expiredSessions.length,
    stalled_sessions: stalledSessions.length,
    orphaned_sessions: orphanedSessions.length,
    restarted_sessions: restartedSessions.length,
    expired_leases: expiredLeases.length
  });

  return {
    expired_sessions: expiredSessions,
    stalled_sessions: stalledSessions,
    orphaned_sessions: orphanedSessions,
    restarted_sessions: restartedSessions,
    expired_leases: expiredLeases
  };
}

export function getWorkerSupervisionEvents(filter?: {
  session_id?: string;
  worker_id?: string;
  event_kind?: WorkerSupervisionEvent["event_kind"];
}): WorkerSupervisionEvent[] {
  let events = store.workerSupervisionEvents.toArray();
  if (filter?.session_id) events = events.filter(e => e.session_id === filter.session_id);
  if (filter?.worker_id) events = events.filter(e => e.worker_id === filter.worker_id);
  if (filter?.event_kind) events = events.filter(e => e.event_kind === filter.event_kind);
  return events.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getWorkerSessionDiagnostics(sessionId: string): {
  session: WorkerSession | undefined;
  supervision_events: WorkerSupervisionEvent[];
  linked_attempt: TaskAttempt | undefined;
  linked_lease: SandboxLease | undefined;
  resume_packages: DelegatedResumePackage[];
  is_healthy: boolean;
  health_issues: string[];
} {
  const session = store.workerSessions.get(sessionId);
  const supervisionEvents = store.workerSupervisionEvents.toArray()
    .filter(e => e.session_id === sessionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);

  const linkedAttempt = session?.attempt_id
    ? store.taskAttempts.toArray().find(a => a.attempt_id === session.attempt_id)
    : undefined;

  const linkedLease = session?.lease_id
    ? store.sandboxLeases.get(session.lease_id)
    : undefined;

  const resumePackages = [...store.delegatedResumePackages.values()]
    .filter(p => p.session_id === sessionId);

  const healthIssues: string[] = [];
  let isHealthy = true;

  if (!session) {
    healthIssues.push("Session not found");
    isHealthy = false;
  } else {
    if (session.status === "orphaned") {
      healthIssues.push("Session is orphaned - no recent heartbeat");
      isHealthy = false;
    }
    if (session.status === "stalled") {
      healthIssues.push("Session is stalled - heartbeat delayed");
      isHealthy = false;
    }
    if (session.status === "expired") {
      healthIssues.push("Session has expired");
      isHealthy = false;
    }
    if (session.restart_count > 0) {
      healthIssues.push(`Session has been restarted ${session.restart_count} times`);
    }
    if (session.restart_count >= session.max_restarts) {
      healthIssues.push("Session has exceeded maximum restarts");
      isHealthy = false;
    }
    if (linkedLease && linkedLease.status !== "active") {
      healthIssues.push(`Linked lease is ${linkedLease.status}`);
      isHealthy = false;
    }
  }

  return {
    session,
    supervision_events: supervisionEvents,
    linked_attempt: linkedAttempt,
    linked_lease: linkedLease,
    resume_packages: resumePackages,
    is_healthy: isHealthy,
    health_issues: healthIssues
  };
}
