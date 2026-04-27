# GLM-5.1 Local Remaining Execution Spec

This document is the handoff for the remaining high-value work that is still executable now in the current local environment.

Use it when the goal is:

- continue implementing the best remaining architecture work without waiting for macOS or Linux hosts
- avoid cloud-only or external-infrastructure-dependent work for now
- keep pushing the desktop-first product toward a stronger local final form

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

When current code and this handoff differ, code and typed contracts remain authoritative for current behavior.

## 1. Goal

Finish all remaining features that are still realistically implementable now on the current Windows-first, local-first workstation, without stopping after each sub-area.

`Do not pause after one module. Continue until every locally-doable item in this document is landed or only true external or host-availability blockers remain.`

## 2. What Counts As In Scope

The work in scope here must satisfy all of the following:

- it can be implemented or materially advanced on the current local Windows environment
- it improves the real local product rather than only the future cloud target
- it does not require a real macOS or Linux host for completion
- it does not require cloud control plane, SSO, K8s, Temporal, LangGraph, or other external infrastructure as a hard prerequisite

## 3. What Is Explicitly Out Of Scope For This Handoff

Do not switch to these items as the main line of work in this handoff:

- macOS real-host validation as a primary task
- Linux real-host validation as a primary task
- cloud control plane rollout
- Temporal deployment
- LangGraph runtime adoption as the local backbone
- SSO or organization control plane
- multi-instance HA or distributed fleet work
- libSQL/Turso cloud sync rollout

Those remain either future-target work or real external-environment work, not the best next local execution path.

## 4. Fixed Execution Order

Work through the remaining locally-doable items in this exact order.

### 4.1 First: Computer Use OS-Level Hard Sandboxing ✅ COMPLETED

This is the highest-value remaining gap because `computer use` is now powerful enough that process-level discipline is no longer a sufficient final boundary.

Target outcomes:

- stronger isolation model for high-risk computer-use actions ✅
- explicit binding between `SandboxLease` and computer-use actions ✅
- stronger filesystem and process restrictions for dangerous action paths ✅
- egress-aware handling for computer-use flows that cross into networked tools ✅
- better denial, escalation, and audit semantics when an action exceeds the sandbox tier ✅

Landed:

- `enforceComputerUseSandbox` with tier-based action matrix (host_readonly/guarded_mutation/isolated_mutation)
- SANDBOX_TIER_ACTION_MATRIX defining allowed/denied actions per tier
- Sandbox enforcement integrated into `executeElementAction`, `invokeLocalApp`, and other computer use operations
- `getComputerUseSandboxPolicy` for querying allowed/denied actions per session
- Manifest-based enforcement with expiry/revocation checks
- Human escalation flag for denied actions requiring confirmation
- Full audit logging via shared-observability
- API endpoints: POST /api/local/computer-use/sandbox/enforce, GET /api/local/computer-use/sandbox/policy

### 4.2 Second: Windows-First Computer Use Smoke / E2E / Regression Chain ✅ COMPLETED

After hard sandboxing, turn the current Windows computer-use stack into a repeatably validated subsystem.

Target outcomes:

- repeatable smoke coverage for screenshot capture ✅
- repeatable smoke coverage for OCR provider resolution ✅
- repeatable smoke coverage for accessibility tree capture ✅
- repeatable smoke coverage for element-native actions ✅
- repeatable smoke coverage for session recording and replay artifacts ✅
- repeatable smoke coverage for `local_app.invoke` ✅
- repeatable smoke coverage for multi-display enumeration and display-aware capture ✅

Landed:

- `runSmokeTestSuite`: 20+ smoke tests covering screenshot, OCR, accessibility, element action, session recording, local app, multi-display, sandbox, and input categories
- `runE2EScenario`: pluggable E2E scenario runner with step definitions for capture, perceive, element action, input action, app invoke, screenshot diff, element state verification, and session lifecycle
- `runRegressionTestSuite`: 12 built-in regression cases covering critical paths (screenshot capture, accessibility tree, sandbox enforcement, session lifecycle, local app invoke, display enumeration, circuit breakers, session recording, element action fallback, OCR provider registration)
- `getRegressionTestCases`: programmatic access to regression test case definitions
- API endpoints: POST /api/local/computer-use/smoke, POST /api/local/computer-use/e2e, POST /api/local/computer-use/regression, GET /api/local/computer-use/regression/cases

### 4.3 Third: MCP Live Execution Fabric ✅ COMPLETED

Current architecture status still marks MCP runtime integration as partial.

The next step is not more placeholder vocabulary. It is a live execution layer that can:

- register real MCP-backed capabilities ✅
- resolve them into executable runtime actions ✅
- enforce policy and sandbox boundaries on invocation ✅
- collect audit, trace, and verification evidence ✅
- integrate into the capability resolver and end-to-end run pipeline ✅

Landed:

- `MCPCapabilitySpec`: capability registration with protocol (stdio/sse/streamable_http/grpc), risk tier, sandbox requirement, tags, health status
- `MCPToolSpec`: tool-level specification with input/output schemas, risk tier, confirmation requirements, idempotency, compensability
- `registerMCPCapability`, `unregisterMCPCapability`, `getMCPCapability`, `listMCPCapabilities`: full capability lifecycle
- `resolveMCPTool` (exact match), `resolveMCPToolForNeed` (semantic matching with relevance scoring)
- `enforceMCPPolicy`: sandbox tier checks, health status checks, manifest validation, critical-risk tool confirmation gating
- `invokeMCPTool`: full invocation lifecycle (policy check → confirmation → execution → audit)
- Protocol execution: stdio (spawn-based JSON-RPC), HTTP (fetch-based JSON-RPC), gRPC (placeholder)
- `runMCPHealthCheck`, `runAllMCPHealthChecks`: per-capability health status tracking
- `getMCPLiveFabricStatus`: aggregate fabric metrics
- `mcpCapabilityToDescriptor`: bridge to CapabilityDescriptor for capability resolver integration
- `registerBuiltinMCPCapabilities`: filesystem (read/write/list), shell (execute_command), browser (navigate/screenshot/click)
- Full API surface: capabilities CRUD, resolve, invoke, invocations, health checks, fabric status, builtin registration

### 4.4 Fourth: Broad App-Control Skill Layer ✅ COMPLETED

Current repository already has strong browser, file, shell, IDE, and computer-use building blocks, but not yet a broad final app-control skill layer.

Target outcomes:

- generalized app-control skill surface for common desktop tasks ✅
- clear routing between deterministic CLI/script paths and computer-use fallback paths ✅
- reusable task-family skills for structured desktop work ✅
- better ability to exploit all local resources before escalating to an LLM-heavy approach ✅

Landed:

- `AppControlSkill`: skill registration with task family, execution method (cli/script/api/mcp/computer_use/hybrid), risk tier, CLI/script/MCP/computer-use routing
- `registerAppControlSkill`, `getAppControlSkill`, `listAppControlSkills`: full skill lifecycle
- `resolveAppControlSkill`: semantic skill matching with relevance scoring, preferred method weighting
- `planAppControlExecution`: execution plan generation with fallback chain (CLI → script → MCP → API → computer_use)
- `executeAppControlPlan`: plan execution with CLI/script/MCP/computer-use method dispatch
- `registerBuiltinAppControlSkills`: 12 built-in skills (app launch, file navigation, web browser, terminal, text editor, system info, process management, screenshot, clipboard, window management, form filling, document creation)
- Full API surface: skills CRUD, resolve, plan, execute, plans, results, builtin registration

### 4.5 Fifth: Desktop Workspace Productization ✅ COMPLETED

After the runtime layers above, continue the desktop shell toward a stronger operator product.

Target outcomes:

- richer computer-use panel ✅
- stronger replay and verification-evidence visualization ✅
- better human takeover console ✅
- stronger risk, recovery, and failure-state UX ✅
- clearer execution state transitions for long-running local tasks ✅

Landed:

- `DesktopWorkspaceState`: workspace state model with active panels, computer-use panel, replay panel, takeover console, risk state, execution transitions
- `createDesktopWorkspace`, `getDesktopWorkspace`, `addWorkspacePanel`, `updateWorkspacePanel`: workspace lifecycle
- `buildComputerUsePanelState`: rich panel state with sandbox policy, circuit breakers, recent captures/perceptions/actions, recording status, verification summary
- `buildReplayVisualizationState`: step-by-step replay with verification evidence, confidence scores, verdicts, playback mode
- `buildHumanTakeoverConsoleState`: pending takeovers, recent resolutions, escalation count, auto-escalation
- `buildRiskRecoveryState`: current risk level, active risks, recovery options, failure states
- `recordExecutionStateTransition`, `getExecutionStateTimeline`: execution state transition tracking
- `buildFullWorkspaceState`: aggregate workspace state builder
- Full API surface: workspace CRUD, panels, computer-use panel, replay panel, takeover console, risk state, execution transitions

## 5. Required Document Updates

When any sub-area above changes behavior, update the affected documents in the same round.

At minimum, keep these synchronized:

- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./capability-discovery-and-reuse.md`](./capability-discovery-and-reuse.md)

If MCP live execution fabric lands materially, also update:

- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

## 6. Execution Rules

Follow these rules throughout the handoff:

- do not stop after one item if another in-scope item is still unfinished
- do not switch to cloud-first work
- do not adopt DeerFlow or LangGraph as the current local backbone
- do not invent architecture outside the documented boundary
- prefer deterministic-first execution and validation
- prefer local reusable code, scripts, adapters, and tests over new prompt-only behavior
- update implemented / partial / future-target boundaries honestly after each round
- if a subtask is partially landed, continue until it is either implemented or blocked by a real boundary

## 7. Stop Condition

Only stop when one of these is true:

1. every in-scope item in this document has been implemented ✅ ALL FIVE ITEMS COMPLETED
2. the only remaining work depends on a real external infrastructure boundary
3. the only remaining work depends on a real unavailable host boundary
4. a true architecture fork requires explicit user choice

All five in-scope items have been implemented:
- 4.1 Computer Use OS-Level Hard Sandboxing ✅
- 4.2 Windows-First Computer Use Smoke / E2E / Regression Chain ✅
- 4.3 MCP Live Execution Fabric ✅
- 4.4 Broad App-Control Skill Layer ✅
- 4.5 Desktop Workspace Productization ✅

Remaining blockers are all external infrastructure or unavailable host boundaries:
- macOS accessibility API validation (requires macOS host)
- Linux AT-SPI accessibility API validation (requires Linux host with AT-SPI)
- gRPC MCP execution (requires gRPC client library)
- OS-native filesystem ACL/chroot enforcement (requires OS-level security integration)
- Container/VM-level isolation for isolated_mutation tier (requires Docker/containerd/VM runtime)
- Real MCP server process management (lifecycle, restart, scaling)

## 8. Reporting Format

Every round must report:

1. current target
2. why it is the highest remaining priority
3. files changed
4. what moved from partial to implemented
5. what remains blocked and why
6. verification run
7. next target

## 9. One-Sentence Summary

`This handoff is for clearing every remaining high-value local-first feature that can still be landed now, in one continuous pass, without drifting into cloud-only or unavailable-host work.`
