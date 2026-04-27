# GLM-5.1 Post-Frontier Resource-Gated Spec

This document is the handoff for the next execution stage after the `frontier upgrade` wave has completed.

Use it when:

- `docs/glm-5.1-frontier-upgrade-spec.md` has reached stop condition 1
- the remaining work is no longer "design and contracts first"
- the remaining work is mainly live activation, real backend hookup, real host validation, and production-grade rollout of already-landed boundaries

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./glm-5.1-frontier-upgrade-spec.md`](./glm-5.1-frontier-upgrade-spec.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)

When this document and current code differ, repository code and typed contracts remain authoritative for current behavior.

## 1. Goal

After the frontier-upgrade wave, the repository should not spend more cycles on fake readiness.

The next stage is:

- verify the upgraded boundaries against real resources
- activate live backends where real resources exist
- keep all blocking items honest where real resources do not exist
- convert "implemented boundary / partial live hookup" into "live verified capability" one lane at a time

`Do not keep inventing new architecture items once this stage begins. The remaining job is activation, verification, hardening, and honest blocking.`

## 2. What This Stage Must Not Do

The following are forbidden in this stage:

- no new framework swap
- no replacement of the current typed runtime backbone
- no replacement of the MCP host boundary with another tool protocol
- no replacing the current memory backbone with vector-only or vendor-hosted memory
- no pretending an external integration is live when no real endpoint, credential, installation, host, or privilege exists
- no new pseudo-readiness layer unless it is strictly required to activate a real backend
- no silent use of cloud endpoints, telemetry endpoints, or model endpoints

This stage is activation-oriented, not speculative.

## 3. Resource-Gated Execution Principle

Every remaining item must be classified into one of four states before work starts:

1. `live-now`
   - all required resources are available now, so real integration and validation must proceed
2. `boundary-only`
   - typed contracts and adapters already exist, but a required external resource is absent
3. `privilege-blocked`
   - work requires administrator/root/system privilege that is not currently available
4. `host-blocked`
   - work requires a real host or platform that is not currently accessible

For each target:

- if `live-now`, implement and validate against the real backend
- if `boundary-only`, do not fake activation; only refresh diagnostics/runbooks if genuinely needed
- if `privilege-blocked`, report the exact privilege needed and stop that lane
- if `host-blocked`, report the exact host needed and stop that lane

## 4. Fixed Execution Order

Work through the remaining post-frontier stage in this exact order.

### 4.1 Stage 0: Preflight Truth Refresh

Before any live activation, do a hard truth refresh.

Target outcomes:

- verify that the reported frontier-upgrade outputs actually exist in code
- refresh the real resource inventory:
  - Node
  - Python
  - Git
  - Playwright
  - Docker
  - Podman
  - Hyper-V
  - WSL2
  - Ollama
  - Temporal CLI / server endpoint
  - LangGraph runtime endpoint
  - OTEL endpoint
  - libSQL / Turso endpoint
  - SSO credentials
  - DeerFlow endpoint
  - admin privilege state
  - macOS host access
  - Linux host access
- classify each remaining lane into `live-now / boundary-only / privilege-blocked / host-blocked`
- update docs to reflect the truth before touching more code

Repository landing areas:

- `docs/current-architecture-status.md`
- `docs/deployment-and-environments.md`
- `docs/observability-and-operations.md`
- `packages/shared-runtime/src/local-runtime-bootstrap.ts`
- `packages/shared-runtime/src/endpoint-onboarding.ts`
- `packages/shared-runtime/src/blocker-dashboard.ts`

### 4.2 Stage 1: Real Remote Orchestration Activation

This stage only proceeds if real resources exist.

Required resources:

- Temporal server endpoint or installed local Temporal
- LangGraph runtime endpoint or local runnable environment
- any required credentials or config variables

Target outcomes:

- activate the `Remote Orchestration SPI` against a real Temporal backend if available
- activate the optional `LangGraph` lane if available
- keep the local typed runtime as primary
- verify:
  - run creation
  - checkpoint mapping
  - interrupt
  - resume
  - cancellation
  - status mapping
  - trace correlation
- do not activate either lane if the real runtime is missing

Repository landing areas:

- `packages/shared-runtime/src/orchestration-spi.ts`
- `packages/shared-runtime/src/temporal-langgraph-boundary.ts`
- `packages/shared-runtime/src/index.ts`
- `apps/local-control-plane/src/index.ts`
- orchestration-related docs

### 4.3 Stage 2: Real Sandbox Provider Activation

This stage only proceeds if real providers and privileges exist.

Required resources may include:

- admin privilege
- Docker / Podman installation
- Hyper-V availability
- WSL2 repair or Linux environment

Target outcomes:

- activate real provider backends behind the sandbox provider layer
- validate provider selection and fallback
- validate real enforcement evidence for:
  - filesystem restriction
  - process restriction
  - network restriction where supported
  - lease expiry and cleanup
- verify live binding from:
  - computer-use actions
  - local shell
  - local file mutation
  - local app invoke
- if privilege is missing, stop honestly and record the exact blocker

Repository landing areas:

- `packages/shared-runtime/src/sandbox-provider-layer.ts`
- `packages/shared-runtime/src/sandbox-executor.ts`
- `packages/shared-runtime/src/windows-native-isolation.ts`
- `packages/shared-runtime/src/real-windows-job-object.ts`
- `packages/shared-runtime/src/computer-use-runtime.ts`
- `apps/local-control-plane/src/index.ts`

### 4.4 Stage 3: Real Self-Hosted Model And Specialist TTT Activation

This stage only proceeds if a real self-hosted model service exists.

Required resources:

- Ollama or equivalent local model service
- model route configuration
- replay-eval lane
- sufficient local compute budget

Target outcomes:

- activate the self-hosted model lane behind the existing model gateway
- validate:
  - baseline inference
  - adapted inference
  - TTT gate behavior
  - rollback behavior
  - promotion only on proven gains
- keep vendor-hosted APIs excluded from weight-update flows
- keep durable retrieval the default path
- if no self-hosted model service exists, do not simulate live TTT activation

Repository landing areas:

- `packages/shared-runtime/src/model-gateway-executor.ts`
- `packages/shared-runtime/src/hybrid-memory-ttt.ts`
- `packages/shared-runtime/src/ttt-specialist-lane.ts`
- `packages/shared-runtime/src/index.ts`
- `docs/reuse-and-learning.md`

### 4.5 Stage 4: Real Observability Endpoint And Persistence Augmentation Activation

This stage only proceeds if real endpoints and credentials exist.

Required resources:

- OTEL collector endpoint
- libSQL / Turso endpoint if cloud sync is being activated
- any required auth tokens or certificates

Target outcomes:

- activate real OTEL export only where explicitly configured
- verify no-silent-egress still holds
- activate libSQL / remote persistence augmentation only where explicitly configured
- verify:
  - export success path
  - export failure path
  - cost / trace audit
  - sync failure honesty
  - data retention and local fallback behavior

Repository landing areas:

- `packages/shared-runtime/src/otel-export.ts`
- `packages/shared-state/src/libsql-adapter.ts`
- `packages/shared-config/src/infra-config.ts`
- `apps/remote-control-plane/src/index.ts`
- docs for observability and deployment

### 4.6 Stage 5: Real Host Validation Across Windows / macOS / Linux

This stage only proceeds per host availability.

Required resources:

- Windows host
- macOS host
- Linux host

Target outcomes:

- validate computer-use runtime on each real platform
- validate accessibility provider and action provider coverage per platform
- validate:
  - capture
  - OCR provider availability
  - accessibility tree
  - element-native actions
  - session recording
  - replay
  - sandbox-aware operation
- update host-specific runbooks based on real findings
- if a host is unavailable, do not mark parity complete

Repository landing areas:

- `packages/shared-runtime/src/computer-use-runtime.ts`
- `docs/computer-use-runtime.md`
- platform runbooks and status docs

### 4.7 Stage 6: Final Production Honesty Pass

After all possible live activations are attempted, do one final pass.

Target outcomes:

- remove any stale "future" or "readiness" wording that is no longer true
- keep every still-blocked lane explicitly marked as blocked
- refresh blocker dashboard, onboarding, bootstrap, and runbook docs
- ensure that current docs answer:
  - what is live now
  - what is only boundary-complete
  - what is privilege-blocked
  - what is host-blocked
  - what credentials/installations are needed next

Repository landing areas:

- `docs/current-architecture-status.md`
- `docs/index.md`
- `docs/deployment-and-environments.md`
- `docs/observability-and-operations.md`
- `docs/computer-use-runtime.md`
- `docs/runtime-improvements-roadmap.md`

## 5. Required Document Updates

Whenever a lane changes status, update at minimum:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)

If public contracts change, also update:

- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)
- [`./index.md`](./index.md)

## 6. Stop Condition

Only stop when one of these is true:

1. every `live-now` lane has been activated and verified
2. every remaining lane is honestly classified as `boundary-only`, `privilege-blocked`, or `host-blocked`
3. a real architecture fork requires explicit user choice

Do not stop just because one activation failed.

### 6.1 Execution Status (as of 2026-04-24)

**Stop condition 2 met**: every remaining lane is honestly classified.

| Stage | Status | Classification | Notes |
| --- | --- | --- | --- |
| Stage 0: Preflight Truth Refresh | **Complete** | live_now | 20 resources probed, 18 lanes classified |
| Stage 1: Remote Orchestration | **Complete** | live_now (local) / host_blocked (remote) | local_runtime verified live; Temporal/LangGraph not_installed |
| Stage 2: Sandbox Provider | **Complete** | boundary_only | rule_based + windows_job_object live; Docker/Podman/Hyper-V blocked |
| Stage 3: Self-Hosted Model / TTT | **Complete** | host_blocked | Ollama not installed; default routing = durable_retrieval |
| Stage 4: Observability / Persistence | **Complete** | live_now (local) / host_blocked (remote) | Local SQLite + OTEL export live; remote libSQL/OTEL endpoint blocked |
| Stage 5: Host Validation | **Complete** | boundary_only | Windows partial; macOS/Linux blocked |
| Stage 6: Production Honesty Pass | **Complete** | production_with_gaps | All live-now lanes activated; all blocked lanes honestly classified |

**Live-now lanes (activated and verified):**
- local_runtime_backbone
- mcp_host_boundary
- trace_grading_eval
- memory_layers
- sandbox_windows_job_object
- host_validation_windows
- local_filesystem
- local_process_spawn

**Honest blockers (not faked as live):**
- Temporal server → install Temporal CLI
- LangGraph runtime → pip install langgraph
- Docker/Podman → install container runtime
- Hyper-V → enable with admin privileges
- Ollama → install and pull model
- Remote libSQL → set DATABASE_URL
- Remote OTEL → set APEX_OTEL_EXTERNAL_EXPORT_ENABLED=1 + endpoint
- macOS host → provide macOS machine
- Linux host → provide Linux machine or start WSL2

## 7. Reporting Format

Every round must report:

1. current target
2. resource state required for this target
3. current classification: `live-now / boundary-only / privilege-blocked / host-blocked`
4. files changed
5. what moved from boundary to live verified capability
6. what remains blocked and the exact blocking resource
7. verification run
8. next target

## 8. One-Sentence Summary

`This handoff converts the post-frontier architecture from boundary-complete modules into live verified capabilities by refreshing resource truth, activating real orchestration, sandbox, self-hosted model, observability, and host-validation lanes wherever real resources exist, and honestly stopping where only privilege, host, or endpoint blockers remain.`
