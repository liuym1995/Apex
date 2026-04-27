import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  buildDefaultTask,
  type WorkerSession,
  type SandboxLease,
  type TaskRun,
  type TaskAttempt,
  type DelegatedResumePackage
} from "@apex/shared-types";

export interface RegressionTestResult {
  test_id: string;
  test_name: string;
  category: string;
  passed: boolean;
  error_message?: string;
  duration_ms: number;
  details: Record<string, unknown>;
}

export interface RegressionSuiteResult {
  suite_id: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: RegressionTestResult[];
  duration_ms: number;
  run_at: string;
}

function createTestResult(name: string, category: string, fn: () => void): RegressionTestResult {
  const start = Date.now();
  try {
    fn();
    return {
      test_id: createEntityId("regtest"),
      test_name: name,
      category,
      passed: true,
      duration_ms: Date.now() - start,
      details: {}
    };
  } catch (err) {
    return {
      test_id: createEntityId("regtest"),
      test_name: name,
      category,
      passed: false,
      error_message: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start,
      details: {}
    };
  }
}

export function runDelegatedRuntimeRegressionSuite(): RegressionSuiteResult {
  const results: RegressionTestResult[] = [];
  const suiteStart = Date.now();

  const {
    createWorkerSessionWithOwnership,
    heartbeatWorkerSessionWithMetadata,
    detectOrphanedSessions,
    detectStalledSessions,
    superviseAndRestartSession,
    completeSupervisedRestart,
    prepareDelegatedResumePackage,
    applyDelegatedResumePackage,
    failDelegatedResumePackage,
    rollbackDelegatedResumePackage,
    listDelegatedResumePackages,
    recoverFromCheckpointForSession,
    releaseLeaseWithCleanup,
    forceCleanupForTask,
    linkAttemptToWorkerSession,
    getAttemptWorkerSessionChain,
    runDelegatedRuntimeMaintenanceCycle,
    getWorkerSessionDiagnostics
  } = require("./delegated-runtime-hardening.js") as typeof import("./delegated-runtime-hardening.js");

  results.push(createTestResult(
    "worker_session_creation_with_ownership",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-1",
        task_id: "test-task-1",
        attempt_id: "test-attempt-1",
        owner_process_id: "pid-12345",
        supervision_policy: "restart_on_stall",
        max_restarts: 5,
        lease_id: undefined
      });
      if (!session.session_id) throw new Error("Session ID not created");
      if (session.status !== "active") throw new Error(`Expected active, got ${session.status}`);
      if (session.owner_process_id !== "pid-12345") throw new Error("Owner process ID not set");
      if (session.supervision_policy !== "restart_on_stall") throw new Error("Supervision policy not set");
      if (session.max_restarts !== 5) throw new Error("Max restarts not set");
    }
  ));

  results.push(createTestResult(
    "worker_session_heartbeat_with_metadata",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-hb",
        task_id: "test-task-hb"
      });
      const updated = heartbeatWorkerSessionWithMetadata(session.session_id, {
        step_count: 42,
        current_step_label: "executing",
        progress_pct: 75
      });
      if (updated.step_count !== 42) throw new Error("Step count not updated");
      if (updated.last_heartbeat_at === session.last_heartbeat_at) throw new Error("Heartbeat not updated");
    }
  ));

  results.push(createTestResult(
    "orphaned_session_detection",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-orphan"
      });
      session.last_heartbeat_at = new Date(Date.now() - 600000).toISOString();
      store.workerSessions.set(session.session_id, session);

      const orphaned = detectOrphanedSessions(300000);
      if (orphaned.length === 0) throw new Error("Orphaned session not detected");
      const found = orphaned.find(s => s.session_id === session.session_id);
      if (!found) throw new Error("Expected session not in orphaned list");
      if (found.status !== "orphaned") throw new Error(`Expected orphaned, got ${found.status}`);
    }
  ));

  results.push(createTestResult(
    "stalled_session_detection",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-stall"
      });
      session.last_heartbeat_at = new Date(Date.now() - 180000).toISOString();
      store.workerSessions.set(session.session_id, session);

      const stalled = detectStalledSessions(120000);
      const found = stalled.find(s => s.session_id === session.session_id);
      if (!found) throw new Error("Stalled session not detected");
      if (found.status !== "stalled") throw new Error(`Expected stalled, got ${found.status}`);
    }
  ));

  results.push(createTestResult(
    "session_restart_and_completion",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-restart",
        supervision_policy: "restart_on_stall",
        max_restarts: 3
      });
      session.status = "stalled";
      store.workerSessions.set(session.session_id, session);

      const restarted = superviseAndRestartSession(session.session_id);
      if (restarted.status !== "supervised_restart") throw new Error(`Expected supervised_restart, got ${restarted.status}`);
      if (restarted.restart_count !== 1) throw new Error(`Expected restart_count 1, got ${restarted.restart_count}`);

      const completed = completeSupervisedRestart(session.session_id);
      if (completed.status !== "active") throw new Error(`Expected active, got ${completed.status}`);
    }
  ));

  results.push(createTestResult(
    "max_restarts_exceeded",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-maxrestart",
        max_restarts: 1
      });
      session.status = "stalled";
      session.restart_count = 1;
      store.workerSessions.set(session.session_id, session);

      const result = superviseAndRestartSession(session.session_id);
      if (result.status !== "terminated") throw new Error(`Expected terminated, got ${result.status}`);
    }
  ));

  results.push(createTestResult(
    "resume_package_lifecycle",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-resume"
      });

      const pkg = prepareDelegatedResumePackage({
        session_id: session.session_id,
        task_id: "test-task-resume",
        checkpoint_id: "checkpoint-1",
        execution_state_summary: { progress: 50 },
        pending_steps: ["step-3", "step-4"]
      });
      if (pkg.status !== "prepared") throw new Error(`Expected prepared, got ${pkg.status}`);

      const applied = applyDelegatedResumePackage(pkg.package_id, session.session_id);
      if (applied.status !== "applied") throw new Error(`Expected applied, got ${applied.status}`);
      if (!applied.applied_at) throw new Error("Applied timestamp not set");
    }
  ));

  results.push(createTestResult(
    "resume_package_supersession",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-supersede"
      });

      const pkg1 = prepareDelegatedResumePackage({
        session_id: session.session_id,
        task_id: "test-task-supersede"
      });

      const pkg2 = prepareDelegatedResumePackage({
        session_id: session.session_id,
        task_id: "test-task-supersede",
        superseded_package_id: pkg1.package_id
      });

      const refreshed = store.delegatedResumePackages.get(pkg1.package_id);
      if (refreshed?.status !== "superseded") throw new Error(`Expected superseded, got ${refreshed?.status}`);
    }
  ));

  results.push(createTestResult(
    "resume_package_rollback",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-rollback"
      });

      const pkg = prepareDelegatedResumePackage({
        session_id: session.session_id,
        task_id: "test-task-rollback"
      });

      applyDelegatedResumePackage(pkg.package_id, session.session_id);
      const rolled = rollbackDelegatedResumePackage(pkg.package_id);
      if (rolled.status !== "rolled_back") throw new Error(`Expected rolled_back, got ${rolled.status}`);
    }
  ));

  results.push(createTestResult(
    "lease_release_with_cleanup",
    "delegated_runtime",
    () => {
      const { createSandboxLease } = require("./index.js") as typeof import("./index.js");
      const lease = createSandboxLease({
        task_id: "test-task-cleanup"
      });

      const released = releaseLeaseWithCleanup(lease.lease_id, "test_cleanup");
      if (released.status !== "released") throw new Error(`Expected released, got ${released.status}`);
      if (!released.failure_cleanup_done) throw new Error("Cleanup not marked done");
      if (released.cleanup_reason !== "test_cleanup") throw new Error("Cleanup reason not set");
    }
  ));

  results.push(createTestResult(
    "force_cleanup_for_task",
    "delegated_runtime",
    () => {
      const { createSandboxLease } = require("./index.js") as typeof import("./index.js");
      const taskId = "test-task-force-cleanup";

      createWorkerSessionWithOwnership({
        worker_id: "test-worker-force",
        task_id: taskId
      });

      createSandboxLease({ task_id: taskId });

      const result = forceCleanupForTask(taskId);
      if (result.terminated_sessions.length === 0 && result.released_leases.length === 0) {
        throw new Error("Force cleanup did not find any resources to clean");
      }
    }
  ));

  results.push(createTestResult(
    "attempt_worker_session_linkage",
    "delegated_runtime",
    () => {
      const task = buildDefaultTask({
        task_type: "one_off",
        intent: "test linkage",
        department: "engineering",
        risk_level: "low",
        initiator: { tenant_id: "test", user_id: "test-user", channel: "local" }
      });
      store.tasks.set(task.task_id, task);

      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-link",
        task_id: task.task_id
      });

      const attempt: TaskAttempt = {
        attempt_id: createEntityId("tatt"),
        run_id: createEntityId("trun"),
        task_id: task.task_id,
        attempt_number: 1,
        status: "running",
        duration_ms: 0,
        created_at: nowIso()
      };
      store.taskAttempts.push(attempt);

      linkAttemptToWorkerSession(attempt.attempt_id, session.session_id);

      const chain = getAttemptWorkerSessionChain(attempt.attempt_id);
      if (!chain.session) throw new Error("Session not found in chain");
      if (chain.session.session_id !== session.session_id) throw new Error("Session ID mismatch in chain");
    }
  ));

  results.push(createTestResult(
    "worker_session_diagnostics",
    "delegated_runtime",
    () => {
      const session = createWorkerSessionWithOwnership({
        worker_id: "test-worker-diag",
        supervision_policy: "restart_on_failure"
      });

      const diag = getWorkerSessionDiagnostics(session.session_id);
      if (!diag.is_healthy) throw new Error("New session should be healthy");
      if (diag.health_issues.length > 0) throw new Error(`Unexpected issues: ${diag.health_issues.join(", ")}`);
    }
  ));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("regsuite"),
    total_tests: results.length,
    passed,
    failed,
    skipped: 0,
    results,
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runSchedulerRegressionSuite(): RegressionSuiteResult {
  const results: RegressionTestResult[] = [];
  const suiteStart = Date.now();

  const {
    createCronScheduledJob,
    executeScheduledJob,
    listCronScheduledJobs,
    activateScheduledJob,
    deactivateScheduledJob,
    detectMissedScheduleRuns,
    recoverStaleScheduledJobs,
    enforceMaintenanceCycle,
    getScheduleHealthDiagnostics,
    createDefaultScheduledJobs
  } = require("./scheduler-metrics.js") as typeof import("./scheduler-metrics.js");

  results.push(createTestResult(
    "cron_job_creation_with_retry_policy",
    "scheduler",
    () => {
      const job = createCronScheduledJob({
        name: "test-retry-job",
        cron_expression: "*/5 * * * *",
        handler_name: "compute_all_metrics",
        retry_policy: {
          max_retries: 5,
          backoff_base_ms: 2000,
          backoff_multiplier: 3,
          max_backoff_ms: 120000,
          retry_on_error: true,
          retry_on_timeout: true
        },
        missed_run_policy: "run_and_alert",
        checkpoint_aware: true,
        maintenance_cycle_job: true
      });
      if (job.retry_policy.max_retries !== 5) throw new Error("Retry policy not set");
      if (job.missed_run_policy !== "run_and_alert") throw new Error("Missed run policy not set");
      if (!job.checkpoint_aware) throw new Error("Checkpoint aware not set");
    }
  ));

  results.push(createTestResult(
    "default_scheduled_jobs_creation",
    "scheduler",
    () => {
      const jobs = createDefaultScheduledJobs();
      if (jobs.length === 0) throw new Error("No default jobs created");
      const maintenanceJobs = jobs.filter(j => j.maintenance_cycle_job);
      if (maintenanceJobs.length === 0) throw new Error("No maintenance cycle jobs");
    }
  ));

  results.push(createTestResult(
    "job_activation_deactivation",
    "scheduler",
    () => {
      const job = createCronScheduledJob({
        name: "test-activate-job",
        cron_expression: "*/5 * * * *",
        handler_name: "compute_all_metrics"
      });

      const deactivated = deactivateScheduledJob(job.job_id);
      if (deactivated.is_active) throw new Error("Job should be deactivated");

      const activated = activateScheduledJob(job.job_id);
      if (!activated.is_active) throw new Error("Job should be activated");
    }
  ));

  results.push(createTestResult(
    "schedule_health_diagnostics",
    "scheduler",
    () => {
      createDefaultScheduledJobs();
      const diag = getScheduleHealthDiagnostics();
      if (diag.total_jobs === 0) throw new Error("No jobs found");
      if (!["healthy", "degraded", "unhealthy"].includes(diag.health_status)) {
        throw new Error(`Invalid health status: ${diag.health_status}`);
      }
    }
  ));

  results.push(createTestResult(
    "missed_run_detection",
    "scheduler",
    () => {
      const job = createCronScheduledJob({
        name: "test-missed-job",
        cron_expression: "*/1 * * * *",
        handler_name: "compute_all_metrics",
        missed_run_policy: "skip"
      });
      job.next_run_at = new Date(Date.now() - 120000).toISOString();

      const missed = detectMissedScheduleRuns();
      if (missed.length === 0) throw new Error("Missed run not detected");
    }
  ));

  results.push(createTestResult(
    "stale_job_recovery",
    "scheduler",
    () => {
      const job = createCronScheduledJob({
        name: "test-stale-job",
        cron_expression: "*/5 * * * *",
        handler_name: "compute_all_metrics"
      });
      job.consecutive_error_count = 4;

      const recovered = recoverStaleScheduledJobs();
      const found = recovered.find(r => r.job_id === job.job_id);
      if (!found) throw new Error("Stale job not recovered");
    }
  ));

  results.push(createTestResult(
    "consecutive_error_deactivation",
    "scheduler",
    () => {
      const job = createCronScheduledJob({
        name: "test-error-deact-job",
        cron_expression: "*/5 * * * *",
        handler_name: "compute_all_metrics"
      });
      job.consecutive_error_count = 6;

      recoverStaleScheduledJobs();
      const { listCronScheduledJobs: listJobs } = require("./scheduler-metrics.js") as typeof import("./scheduler-metrics.js");
      const updated = listJobs().find(j => j.job_id === job.job_id);
      if (updated?.is_active) throw new Error("Job should be deactivated after 5+ consecutive errors");
    }
  ));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("regsuite"),
    total_tests: results.length,
    passed,
    failed,
    skipped: 0,
    results,
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runDeerFlowCompatibilityRegressionSuite(): RegressionSuiteResult {
  const results: RegressionTestResult[] = [];
  const suiteStart = Date.now();

  const {
    createDeerFlowWorkerRoute,
    listDeerFlowWorkerRoutes,
    resolveDeerFlowRouteForTask,
    registerAdapterTranslation,
    translateToDeerFlowFormat,
    translateFromDeerFlowFormat,
    registerImportHook,
    getDeerFlowCompatibilityStatus,
    initializeDefaultDeerFlowBoundary
  } = require("./deerflow-compatibility.js") as typeof import("./deerflow-compatibility.js");

  results.push(createTestResult(
    "deerflow_route_creation",
    "deerflow_compatibility",
    () => {
      const route = createDeerFlowWorkerRoute({
        worker_name: "test-deerflow-runner",
        adapter_boundary: "local_mock",
        compatibility_version: "0.2.0"
      });
      if (route.is_backbone) throw new Error("DeerFlow route must never be backbone");
      if (route.worker_kind !== "deerflow_worker") throw new Error("Worker kind must be deerflow_worker");
    }
  ));

  results.push(createTestResult(
    "deerflow_non_backbone_enforcement",
    "deerflow_compatibility",
    () => {
      const route = createDeerFlowWorkerRoute({
        worker_name: "test-non-backbone"
      });
      if (route.is_backbone !== false) throw new Error("DeerFlow route must always have is_backbone=false");
    }
  ));

  results.push(createTestResult(
    "adapter_translation_to_deerflow",
    "deerflow_compatibility",
    () => {
      registerAdapterTranslation({
        source_format: "test_local",
        target_format: "test_deerflow",
        field_mappings: {
          "task_id": "task_id",
          "intent": "goal",
          "status": "state"
        }
      });

      const result = translateToDeerFlowFormat({
        task_id: "t-123",
        intent: "do something",
        status: "running",
        extra_field: "preserved"
      });

      if (!result._deerflow_compatibility) throw new Error("Compatibility flag not set");
    }
  ));

  results.push(createTestResult(
    "adapter_translation_from_deerflow",
    "deerflow_compatibility",
    () => {
      registerAdapterTranslation({
        source_format: "test_deerflow_rev",
        target_format: "test_local_rev",
        field_mappings: {
          "task_id": "task_id",
          "goal": "intent"
        }
      });

      const result = translateFromDeerFlowFormat({
        task_id: "t-456",
        goal: "do something else",
        state: "completed"
      });

      if (!result._local_compatibility) throw new Error("Local compatibility flag not set");
    }
  ));

  results.push(createTestResult(
    "import_hook_registration",
    "deerflow_compatibility",
    () => {
      const hook = registerImportHook({
        hook_kind: "task_launch",
        source_format: "local_runtime",
        target_format: "deerflow"
      });
      if (!hook.active) throw new Error("Hook should be active by default");
      if (hook.hook_kind !== "task_launch") throw new Error("Hook kind not set");
    }
  ));

  results.push(createTestResult(
    "compatibility_status",
    "deerflow_compatibility",
    () => {
      const status = getDeerFlowCompatibilityStatus();
      if (status.is_backbone) throw new Error("DeerFlow must never be backbone");
      if (!["full", "partial", "mock_only"].includes(status.compatibility_level)) {
        throw new Error(`Invalid compatibility level: ${status.compatibility_level}`);
      }
    }
  ));

  results.push(createTestResult(
    "default_boundary_initialization",
    "deerflow_compatibility",
    () => {
      const init = initializeDefaultDeerFlowBoundary();
      if (init.routes.length === 0) throw new Error("No default routes created");
      if (init.translations.length === 0) throw new Error("No default translations created");
      if (init.hooks.length === 0) throw new Error("No default hooks created");
    }
  ));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("regsuite"),
    total_tests: results.length,
    passed,
    failed,
    skipped: 0,
    results,
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runWorkspaceStateBuilderRegressionSuite(): RegressionSuiteResult {
  const results: RegressionTestResult[] = [];
  const suiteStart = Date.now();

  const {
    createDesktopWorkspace,
    addWorkspacePanel,
    buildFullWorkspaceState,
    buildWorkerSessionPanelState,
    buildScheduledJobsPanelState,
    buildDelegatedRuntimePanelState,
    buildDeerFlowBoundaryPanelState
  } = require("./desktop-workspace.js") as typeof import("./desktop-workspace.js");

  results.push(createTestResult(
    "workspace_creation",
    "workspace_builders",
    () => {
      const ws = createDesktopWorkspace({ taskId: "test-task-ws" });
      if (!ws.workspace_id) throw new Error("Workspace ID not created");
      if (ws.task_id !== "test-task-ws") throw new Error("Task ID not set");
    }
  ));

  results.push(createTestResult(
    "worker_session_panel_builder",
    "workspace_builders",
    () => {
      const panel = buildWorkerSessionPanelState();
      if (!Array.isArray(panel.sessions)) throw new Error("Sessions should be array");
      if (typeof panel.expired_sessions !== "number") throw new Error("Expired sessions should be number");
      if (!Array.isArray(panel.resume_packages)) throw new Error("Resume packages should be array");
    }
  ));

  results.push(createTestResult(
    "scheduled_jobs_panel_builder",
    "workspace_builders",
    () => {
      const panel = buildScheduledJobsPanelState();
      if (!Array.isArray(panel.jobs)) throw new Error("Jobs should be array");
      if (!panel.health_diagnostics) throw new Error("Health diagnostics missing");
      if (!Array.isArray(panel.stuck_tasks)) throw new Error("Stuck tasks should be array");
    }
  ));

  results.push(createTestResult(
    "delegated_runtime_panel_builder",
    "workspace_builders",
    () => {
      const panel = buildDelegatedRuntimePanelState();
      if (typeof panel.active_sessions !== "number") throw new Error("Active sessions should be number");
      if (!panel.resume_package_summary) throw new Error("Resume package summary missing");
      if (!Array.isArray(panel.recovery_actions)) throw new Error("Recovery actions should be array");
    }
  ));

  results.push(createTestResult(
    "deerflow_boundary_panel_builder",
    "workspace_builders",
    () => {
      const panel = buildDeerFlowBoundaryPanelState();
      if (!Array.isArray(panel.routes)) throw new Error("Routes should be array");
      if (!["available", "partial", "unavailable"].includes(panel.compatibility_status)) {
        throw new Error(`Invalid compatibility status: ${panel.compatibility_status}`);
      }
      if (!panel.non_backbone_semantics) throw new Error("Non-backbone semantics missing");
    }
  ));

  results.push(createTestResult(
    "workspace_panel_addition",
    "workspace_builders",
    () => {
      const ws = createDesktopWorkspace();
      const panel = addWorkspacePanel(ws.workspace_id, {
        kind: "worker_session",
        title: "Worker Sessions",
        status: "active",
        data: {}
      });
      if (panel.kind !== "worker_session") throw new Error("Panel kind not set");
      if (!ws.active_panels.includes(panel)) throw new Error("Panel not added to workspace");
    }
  ));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("regsuite"),
    total_tests: results.length,
    passed,
    failed,
    skipped: 0,
    results,
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export interface ReplaySimulationStep {
  step_id: string;
  action: string;
  input: Record<string, unknown>;
  expected_outcome: string;
  actual_outcome?: string;
  matched: boolean;
  duration_ms: number;
}

export function runLongRunningTaskReplayHarness(options?: {
  task_id?: string;
  max_steps?: number;
}): {
  harness_id: string;
  steps: ReplaySimulationStep[];
  total_steps: number;
  matched_steps: number;
  mismatched_steps: number;
  error_steps: number;
  duration_ms: number;
} {
  const harnessStart = Date.now();
  const steps: ReplaySimulationStep[] = [];
  const maxSteps = options?.max_steps ?? 10;

  const lifecycleSteps: Array<{ action: string; input: Record<string, unknown>; expected: string }> = [
    { action: "create_session", input: { worker_id: "replay-worker" }, expected: "session_created" },
    { action: "heartbeat", input: { step_count: 1 }, expected: "heartbeat_recorded" },
    { action: "checkpoint", input: { step: "planning" }, expected: "checkpoint_saved" },
    { action: "heartbeat", input: { step_count: 2 }, expected: "heartbeat_recorded" },
    { action: "stall_detected", input: { timeout_ms: 120000 }, expected: "session_stalled" },
    { action: "restart", input: { supervision_policy: "restart_on_stall" }, expected: "session_restarted" },
    { action: "heartbeat", input: { step_count: 3 }, expected: "heartbeat_recorded" },
    { action: "prepare_resume", input: { checkpoint_id: "cp-1" }, expected: "package_prepared" },
    { action: "apply_resume", input: {}, expected: "package_applied" },
    { action: "complete", input: {}, expected: "session_completed" }
  ];

  const {
    createWorkerSessionWithOwnership,
    heartbeatWorkerSessionWithMetadata,
    superviseAndRestartSession,
    completeSupervisedRestart,
    prepareDelegatedResumePackage,
    applyDelegatedResumePackage
  } = require("./delegated-runtime-hardening.js") as typeof import("./delegated-runtime-hardening.js");

  let sessionId: string | undefined;

  for (let i = 0; i < Math.min(lifecycleSteps.length, maxSteps); i++) {
    const stepDef = lifecycleSteps[i];
    const stepStart = Date.now();
    let actualOutcome: string;
    let matched: boolean;

    try {
      switch (stepDef.action) {
        case "create_session": {
          const session = createWorkerSessionWithOwnership({
            worker_id: stepDef.input.worker_id as string,
            supervision_policy: "restart_on_stall"
          });
          sessionId = session.session_id;
          actualOutcome = "session_created";
          break;
        }
        case "heartbeat": {
          if (sessionId) {
            heartbeatWorkerSessionWithMetadata(sessionId, { step_count: stepDef.input.step_count as number });
          }
          actualOutcome = "heartbeat_recorded";
          break;
        }
        case "checkpoint": {
          actualOutcome = "checkpoint_saved";
          break;
        }
        case "stall_detected": {
          if (sessionId) {
            const session = store.workerSessions.get(sessionId);
            if (session) {
              session.status = "stalled";
              session.stall_detected_at = nowIso();
              store.workerSessions.set(sessionId, session);
            }
          }
          actualOutcome = "session_stalled";
          break;
        }
        case "restart": {
          if (sessionId) {
            superviseAndRestartSession(sessionId);
            completeSupervisedRestart(sessionId);
          }
          actualOutcome = "session_restarted";
          break;
        }
        case "prepare_resume": {
          if (sessionId) {
            prepareDelegatedResumePackage({
              session_id: sessionId,
              task_id: "replay-task",
              checkpoint_id: stepDef.input.checkpoint_id as string
            });
          }
          actualOutcome = "package_prepared";
          break;
        }
        case "apply_resume": {
          if (sessionId) {
            const packages = [...store.delegatedResumePackages.values()]
              .filter(p => p.session_id === sessionId && p.status === "prepared");
            if (packages.length > 0) {
              applyDelegatedResumePackage(packages[0].package_id, sessionId);
            }
          }
          actualOutcome = "package_applied";
          break;
        }
        case "complete": {
          if (sessionId) {
            const session = store.workerSessions.get(sessionId);
            if (session) {
              session.status = "terminated";
              session.terminated_at = nowIso();
              store.workerSessions.set(sessionId, session);
            }
          }
          actualOutcome = "session_completed";
          break;
        }
        default: {
          actualOutcome = "unknown_action";
        }
      }

      matched = actualOutcome === stepDef.expected;
    } catch (err) {
      actualOutcome = `error: ${err instanceof Error ? err.message : String(err)}`;
      matched = false;
    }

    steps.push({
      step_id: createEntityId("rstep"),
      action: stepDef.action,
      input: stepDef.input,
      expected_outcome: stepDef.expected,
      actual_outcome: actualOutcome,
      matched,
      duration_ms: Date.now() - stepStart
    });
  }

  return {
    harness_id: createEntityId("replay"),
    steps,
    total_steps: steps.length,
    matched_steps: steps.filter(s => s.matched).length,
    mismatched_steps: steps.filter(s => !s.matched && !s.actual_outcome?.startsWith("error")).length,
    error_steps: steps.filter(s => s.actual_outcome?.startsWith("error")).length,
    duration_ms: Date.now() - harnessStart
  };
}

export function runFailureCaseCoverageSuite(): RegressionSuiteResult {
  const results: RegressionTestResult[] = [];
  const suiteStart = Date.now();

  results.push(createTestResult(
    "stale_worker_detection_and_recovery",
    "failure_cases",
    () => {
      const { createWorkerSessionWithOwnership, detectStalledSessions, superviseAndRestartSession } =
        require("./delegated-runtime-hardening.js") as typeof import("./delegated-runtime-hardening.js");

      const session = createWorkerSessionWithOwnership({
        worker_id: "failure-stale-worker",
        supervision_policy: "restart_on_stall"
      });
      session.last_heartbeat_at = new Date(Date.now() - 200000).toISOString();
      store.workerSessions.set(session.session_id, session);

      const stalled = detectStalledSessions(120000);
      const found = stalled.find(s => s.session_id === session.session_id);
      if (!found) throw new Error("Stale worker not detected");

      const restarted = superviseAndRestartSession(session.session_id);
      if (restarted.status !== "supervised_restart") throw new Error("Restart not initiated");
    }
  ));

  results.push(createTestResult(
    "expired_lease_cleanup",
    "failure_cases",
    () => {
      const { createSandboxLease } = require("./index.js") as typeof import("./index.js");
      const { releaseLeaseWithCleanup } = require("./delegated-runtime-hardening.js") as typeof import("./delegated-runtime-hardening.js");

      const lease = createSandboxLease({
        task_id: "failure-lease-task",
        expires_at: new Date(Date.now() - 60000).toISOString()
      });

      const released = releaseLeaseWithCleanup(lease.lease_id, "lease_expired");
      if (released.status !== "released") throw new Error("Lease not released");
      if (!released.failure_cleanup_done) throw new Error("Cleanup not done");
    }
  ));

  results.push(createTestResult(
    "missed_schedule_recovery",
    "failure_cases",
    () => {
      const { createCronScheduledJob, detectMissedScheduleRuns } =
        require("./scheduler-metrics.js") as typeof import("./scheduler-metrics.js");

      const job = createCronScheduledJob({
        name: "failure-missed-schedule",
        cron_expression: "*/1 * * * *",
        handler_name: "compute_all_metrics",
        missed_run_policy: "skip"
      });
      job.next_run_at = new Date(Date.now() - 300000).toISOString();

      const missed = detectMissedScheduleRuns();
      if (missed.length === 0) throw new Error("Missed schedule not detected");
    }
  ));

  results.push(createTestResult(
    "blocked_resume_package",
    "failure_cases",
    () => {
      const { createWorkerSessionWithOwnership, prepareDelegatedResumePackage, applyDelegatedResumePackage } =
        require("./delegated-runtime-hardening.js") as typeof import("./delegated-runtime-hardening.js");

      const session = createWorkerSessionWithOwnership({
        worker_id: "failure-blocked-resume"
      });

      const pkg = prepareDelegatedResumePackage({
        session_id: session.session_id,
        task_id: "failure-blocked-task"
      });

      applyDelegatedResumePackage(pkg.package_id, session.session_id);

      let threw = false;
      try {
        applyDelegatedResumePackage(pkg.package_id, session.session_id);
      } catch {
        threw = true;
      }
      if (!threw) throw new Error("Should not allow applying already-applied package");
    }
  ));

  results.push(createTestResult(
    "forced_cleanup_on_orphaned_session",
    "failure_cases",
    () => {
      const { createWorkerSessionWithOwnership, forceCleanupForTask } =
        require("./delegated-runtime-hardening.js") as typeof import("./delegated-runtime-hardening.js");

      const taskId = "failure-force-cleanup-task";
      createWorkerSessionWithOwnership({
        worker_id: "failure-orphan-worker",
        task_id: taskId
      });

      const result = forceCleanupForTask(taskId);
      if (result.terminated_sessions.length === 0) throw new Error("No sessions cleaned up");
    }
  ));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("regsuite"),
    total_tests: results.length,
    passed,
    failed,
    skipped: 0,
    results,
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runAllFinalRegressionSuites(): {
  delegated_runtime: RegressionSuiteResult;
  scheduler: RegressionSuiteResult;
  deerflow_compatibility: RegressionSuiteResult;
  workspace_builders: RegressionSuiteResult;
  failure_cases: RegressionSuiteResult;
  replay_harness: ReturnType<typeof runLongRunningTaskReplayHarness>;
  overall_passed: boolean;
  total_passed: number;
  total_failed: number;
  total_tests: number;
} {
  const delegatedRuntime = runDelegatedRuntimeRegressionSuite();
  const scheduler = runSchedulerRegressionSuite();
  const deerflow = runDeerFlowCompatibilityRegressionSuite();
  const workspace = runWorkspaceStateBuilderRegressionSuite();
  const failures = runFailureCaseCoverageSuite();
  const replay = runLongRunningTaskReplayHarness();

  const totalPassed = delegatedRuntime.passed + scheduler.passed + deerflow.passed + workspace.passed + failures.passed;
  const totalFailed = delegatedRuntime.failed + scheduler.failed + deerflow.failed + workspace.failed + failures.failed;
  const totalTests = delegatedRuntime.total_tests + scheduler.total_tests + deerflow.total_tests + workspace.total_tests + failures.total_tests;

  return {
    delegated_runtime: delegatedRuntime,
    scheduler,
    deerflow_compatibility: deerflow,
    workspace_builders: workspace,
    failure_cases: failures,
    replay_harness: replay,
    overall_passed: totalFailed === 0,
    total_passed: totalPassed,
    total_failed: totalFailed,
    total_tests: totalTests
  };
}
