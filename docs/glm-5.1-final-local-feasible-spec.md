# GLM-5.1 Final Local Feasible Spec

This document is the handoff for the remaining meaningful features that are still feasible in the current local Windows-first environment after the major computer-use, MCP, app-control, and hybrid-memory milestones have already landed.

Use it when the goal is:

- finish the last important locally-doable runtime capabilities
- avoid drifting into cloud-only, host-blocked, or external-model-blocked work
- strengthen the system's unattended execution and worker-operability model

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)

When current code and this document differ, code and typed contracts remain authoritative for current behavior.

## 1. Goal

Finish the remaining local-first execution features that still materially improve the product now.

At this point, the most valuable remaining work is no longer broad capability expansion.

It is:

- making delegated worker execution more real and durable
- making the scheduler and long-running task control plane more autonomous and reliable
- making those systems visible and recoverable from the desktop workspace

`Do not stop after one module. Continue until every in-scope item here is landed or only true external blockers remain.`

## 2. True External Or Out-Of-Scope Items

Do not switch this handoff to:

- cloud control plane rollout
- Temporal deployment
- LangGraph runtime adoption
- enterprise SSO or org control plane
- multi-instance HA or distributed cloud worker fleet
- real external sandbox pool manager
- real DeerFlow production backbone replacement
- macOS or Linux host validation work
- self-hosted model-weight update infrastructure
- gRPC MCP execution against real external servers

Those are either future-target or externally blocked.

## 3. Fixed Execution Order

Work through the remaining locally-feasible items in this exact order.

### 3.1 First: Local Delegated Runtime Hardening

Current architecture status still marks delegated runtime lifecycle contracts as partial.

The next local-first goal is to turn that chain into a stronger real local worker plane.

Target outcomes:

- stronger local worker-session ownership model
- worker heartbeat expiry detection
- orphaned or stalled delegated session detection
- local worker process supervision and restart policy
- delegated resume package application and supersession tracking
- delegated checkpoint recovery made more operationally complete
- clearer lease release and failure cleanup semantics
- stronger attempt-level linkage between supervisor task and delegated work

This should stay local-first and typed. It should not assume a hosted runner plane.

### 3.2 Second: Durable Scheduler And Long-Running Control Hardening

The repository already has a good baseline scheduler, but it is still not final.

Target outcomes:

- worker session heartbeat-based expiry detection
- stronger scheduled-job retry semantics
- missed-run handling policy
- stale or stuck scheduled-job recovery
- recurring task supervision with clearer retry/backoff behavior
- better checkpoint-aware resume semantics for scheduled and long-running tasks
- schedule health diagnostics and follow-up task generation
- stronger maintenance-cycle enforcement for long-running unattended work

This should improve real autonomous completion behavior without needing a cloud automation plane.

### 3.3 Third: Desktop Workspace Operational Surfaces For Workers And Schedules

After the runtime side above is stronger, make it visible from the desktop product.

Target outcomes:

- worker-session panel with heartbeat, checkpoint, lease, and failure state
- delegated resume and superseded-package visibility
- scheduled-job operational panel
- stuck-task and stale-worker diagnostics
- maintenance-cycle visibility
- richer long-running task recovery actions
- clearer run / attempt / worker / schedule relationships in the workspace

This is not optional polish. It is how operators trust unattended execution.

### 3.4 Fourth: Local DeerFlow Compatibility Boundary

Current architecture status still marks DeerFlow integration as partial.

Do not replace the current runtime backbone.

Instead, land a bounded compatibility layer:

- typed DeerFlow-compatible worker route or launch contract
- adapter boundary for future DeerFlow-style runtime invocation
- import or translation hooks where useful
- clear non-backbone compatibility semantics

This should preserve optional future interoperability without mutating the current local backbone.

### 3.5 Fifth: Final Local Regression And Replay Coverage For The Above

Once the runtime and workspace work are in place, make them repeatably testable.

Target outcomes:

- delegated runtime regression suite
- scheduler regression suite
- resume / supersession / heartbeat-expiry coverage
- workspace-state builders covered by deterministic tests
- replay or simulation harness for long-running task lifecycle
- failure-case coverage for stale worker, expired lease, missed schedule, blocked resume, and forced cleanup

The goal is to turn the remaining local runtime complexity into a verified subsystem.

## 4. Required Document Updates

When any sub-area above changes behavior, update the affected documents in the same round.

At minimum, keep these synchronized:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)

If public contracts move, also update:

- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

## 5. Execution Rules

Follow these rules throughout the handoff:

- do not weaken the stable public runtime vocabulary
- do not promote transitional plumbing as the public architecture surface
- do not switch to cloud-first work
- do not replace the current local runtime backbone with DeerFlow
- prefer real local execution and supervision behavior over placeholder contracts
- prefer deterministic tests and replay where possible
- keep implemented / partial / future-target boundaries honest

## 6. Stop Condition

Only stop when one of these is true:

1. every in-scope item in this document has been implemented
2. the only remaining work depends on real external infrastructure
3. the only remaining work depends on unavailable hosts
4. a real architecture fork requires explicit user choice

Do not stop merely because one ordered item is complete.

## 7. Reporting Format

Every round must report:

1. current target
2. why it is the highest remaining priority
3. files changed
4. what moved from partial to implemented
5. what remains blocked and why
6. verification run
7. next target

## 8. One-Sentence Summary

`This handoff finishes the last important local-first runtime work by hardening delegated workers, strengthening the durable scheduler and unattended task lifecycle, surfacing those systems in the desktop workspace, adding bounded DeerFlow compatibility without replacing the backbone, and covering the result with deterministic regression and replay tests.`

## 9. Implementation Status

All five in-scope items have been implemented:

### 9.1 Local Delegated Runtime Hardening — ✅ Implemented

Files changed:
- `packages/shared-types/src/index.ts`: Extended WorkerSessionSchema with owner_process_id, restart_count, max_restarts, supervision_policy, stall/orphan detection timestamps, lease_id, attempt_id. Added DelegatedResumePackageSchema, WorkerSupervisionEventSchema.
- `packages/shared-state/src/index.ts`: Added delegatedResumePackages, workerSupervisionEvents, deerFlowWorkerRoutes stores.
- `packages/shared-runtime/src/delegated-runtime-hardening.ts`: New module with createWorkerSessionWithOwnership, heartbeatWorkerSessionWithMetadata, detectOrphanedSessions, detectStalledSessions, superviseAndRestartSession, completeSupervisedRestart, prepareDelegatedResumePackage, applyDelegatedResumePackage, failDelegatedResumePackage, rollbackDelegatedResumePackage, recoverFromCheckpointForSession, releaseLeaseWithCleanup, forceCleanupForTask, linkAttemptToWorkerSession, getAttemptWorkerSessionChain, runDelegatedRuntimeMaintenanceCycle, getWorkerSupervisionEvents, getWorkerSessionDiagnostics.

### 9.2 Durable Scheduler And Long-Running Control Hardening — ✅ Implemented

Files changed:
- `packages/shared-runtime/src/scheduler-metrics.ts`: Extended ScheduledJob with retry_policy, missed_run_policy, consecutive_error_count, checkpoint_aware, maintenance_cycle_job. Added executeScheduledJob with retry/backoff. Added detectMissedScheduleRuns, recoverStaleScheduledJobs, enforceMaintenanceCycle, getScheduleHealthDiagnostics. Updated createDefaultScheduledJobs with 4 new default jobs.

### 9.3 Desktop Workspace Operational Surfaces — ✅ Implemented

Files changed:
- `packages/shared-runtime/src/desktop-workspace.ts`: Added WorkerSessionPanelState, ScheduledJobsPanelState, DelegatedRuntimePanelState, DeerFlowBoundaryPanelState interfaces. Added panel kinds: worker_session, scheduled_jobs, delegated_runtime, deerflow_boundary. Added buildWorkerSessionPanelState, buildScheduledJobsPanelState, buildDelegatedRuntimePanelState, buildDeerFlowBoundaryPanelState. Updated buildFullWorkspaceState.

### 9.4 Local DeerFlow Compatibility Boundary — ✅ Implemented

Files changed:
- `packages/shared-types/src/index.ts`: Added DeerFlowWorkerRouteSchema with is_backbone=false enforcement.
- `packages/shared-runtime/src/deerflow-compatibility.ts`: New module with createDeerFlowWorkerRoute, listDeerFlowWorkerRoutes, resolveDeerFlowRouteForTask, registerAdapterTranslation, translateToDeerFlowFormat, translateFromDeerFlowFormat, registerImportHook, listImportHooks, getDeerFlowCompatibilityStatus, initializeDefaultDeerFlowBoundary.

### 9.5 Final Local Regression And Replay Coverage — ✅ Implemented

Files changed:
- `packages/shared-runtime/src/final-regression-coverage.ts`: New module with runDelegatedRuntimeRegressionSuite (13 tests), runSchedulerRegressionSuite (7 tests), runDeerFlowCompatibilityRegressionSuite (7 tests), runWorkspaceStateBuilderRegressionSuite (6 tests), runFailureCaseCoverageSuite (5 tests), runLongRunningTaskReplayHarness (10-step simulation), runAllFinalRegressionSuites aggregator.

### Verification

- TypeScript typecheck passes for shared-types, shared-state, and shared-runtime packages.
- All new code follows existing code patterns and uses existing store, audit, and entity creation utilities.
