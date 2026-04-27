# GLM-5.1 Final Resource Activation Master Spec

This document is the final master handoff for all remaining work after:

- the local-first implementation waves
- the computer-use completion waves
- the hybrid memory / TTT boundary waves
- the frontier-upgrade wave
- the post-frontier resource-gated activation wave

have all already reached their stop conditions.

Use it when the goal is:

- resume the project from the current fully resource-gated state
- give `GLM-5.1` one stable long-term instruction set for all future continuation
- avoid writing a new prompt every time one real resource becomes available

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./glm-5.1-frontier-upgrade-spec.md`](./glm-5.1-frontier-upgrade-spec.md)
- [`./glm-5.1-post-frontier-resource-gated-spec.md`](./glm-5.1-post-frontier-resource-gated-spec.md)
- [`./glm-5.1-resource-gated-resume-spec.md`](./glm-5.1-resource-gated-resume-spec.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)

When this document and current code differ, repository code and typed contracts remain authoritative for current behavior.

## 1. Current Global State

At the time this master spec is created, the project has already reached this point:

- all meaningful repository-local architecture work is complete
- all frontier-upgrade in-scope items are complete
- all post-frontier activation work that can be verified locally has already been attempted
- every remaining lane is now either:
  - `boundary-only`
  - `privilege-blocked`
  - `host-blocked`

The purpose of this document is therefore not to invent more repo-local work.

The purpose is to:

- resume exactly when a real resource becomes available
- activate the corresponding lane immediately
- verify it honestly
- stop again when the next remaining lane is still blocked

## 2. Fixed Truth Boundary

From now on, `GLM-5.1` must obey these rules:

- do not invent more "readiness" layers for blocked items unless a tiny adapter is strictly required to connect a now-available real backend
- do not claim a blocked lane is live unless the lane was validated against the real resource
- do not do speculative work for missing Docker / Podman / Hyper-V / Temporal / LangGraph / Ollama / OTEL / libSQL / macOS / Linux
- do not replace the current typed runtime backbone
- do not replace the current MCP host boundary
- do not replace the current memory backbone
- do not bypass verifier, completion engine, checklist, reconciliation, or done gate
- do not add silent egress

This stage is purely:

- resource-triggered activation
- live verification
- documentation truth refresh

## 3. Current Resource Matrix

Treat the following as the last known baseline until re-probed:

### 3.1 Available Now

- Node.js
- Python
- Git
- Playwright
- Windows host
- local runtime backbone
- local filesystem
- local process spawn
- MCP host boundary
- trace grading and eval flywheel
- memory layers
- rule-based sandboxing
- Windows Job Object sandbox provider
- local SQLite persistence
- local OTEL / trace / audit path

### 3.2 Missing Or Blocked

- admin privilege
- Docker
- Podman
- Hyper-V
- Ollama or equivalent self-hosted model service
- Temporal server or CLI/runtime
- LangGraph runtime
- libSQL / Turso endpoint
- remote OTEL endpoint
- macOS host
- Linux host or working WSL2-backed Linux validation path

## 4. Global Resume Strategy

Whenever the user provides one or more real resources, `GLM-5.1` must:

1. refresh truth for that resource
2. determine which blocked lane it unlocks
3. execute only the newly unlocked lane(s)
4. validate them against the real backend/host/privilege
5. update docs and status
6. stop again if the next lane still depends on another missing resource

If multiple resources become available at the same time, use the priority order in Section 5.

## 5. Fixed Activation Order

When multiple blocked lanes become available together, resume in this exact order.

### 5.1 Priority 1: Privileged Windows Isolation

Resume when:

- administrator privilege is available

Activate:

- Windows integrity-level sandbox lane
- Windows firewall-backed sandbox lane where documented
- Hyper-V discovery only if admin also unlocks it

Expected outcomes:

- move Windows isolation from partial provider activation to stronger real enforcement
- verify provider selection, enforcement evidence, cleanup, and rollback behavior

Main files:

- `packages/shared-runtime/src/sandbox-provider-layer.ts`
- `packages/shared-runtime/src/windows-native-isolation.ts`
- `packages/shared-runtime/src/real-windows-job-object.ts`
- `packages/shared-runtime/src/sandbox-executor.ts`

### 5.2 Priority 2: Container / VM Isolation Backends

Resume when one or more of these exist:

- Docker
- Podman
- Hyper-V
- working WSL2 or Linux validation path

Activate:

- Docker-backed sandbox provider
- Podman-backed sandbox provider
- Hyper-V-backed sandbox provider
- Linux-side sandbox validation if available

Expected outcomes:

- real provider activation
- real capability negotiation
- real execution verification
- honest fallback when a provider is installed but unusable

### 5.3 Priority 3: Self-Hosted Model + TTT Specialist Lane

Resume when:

- Ollama or another self-hosted model endpoint is available

Activate:

- live model route wiring
- baseline inference
- adapted inference
- TTT specialist lane activation
- replay-eval
- rollback and promotion checks

Expected outcomes:

- live self-hosted inference through the current gateway
- live gated TTT specialist lane
- durable retrieval remains default

Main files:

- `packages/shared-runtime/src/model-gateway-executor.ts`
- `packages/shared-runtime/src/hybrid-memory-ttt.ts`
- `packages/shared-runtime/src/ttt-specialist-lane.ts`

### 5.4 Priority 4: Remote Orchestration

Resume when one or more of these exist:

- Temporal runtime/server/CLI
- LangGraph runtime

Activate:

- real Temporal lane behind the orchestration SPI
- optional LangGraph lane behind the orchestration SPI

Expected outcomes:

- local typed runtime remains primary
- Temporal and/or LangGraph become verified optional lanes
- run/checkpoint/interrupt/resume/cancel/trace mapping validated live

Main files:

- `packages/shared-runtime/src/orchestration-spi.ts`
- `packages/shared-runtime/src/temporal-langgraph-boundary.ts`

### 5.5 Priority 5: Remote Persistence + Remote Observability

Resume when one or more of these exist:

- `DATABASE_URL` / libSQL / Turso endpoint
- OTEL collector endpoint with explicit export enablement

Activate:

- remote libSQL persistence augmentation
- remote OTEL export

Expected outcomes:

- no-silent-egress rule remains intact
- failure behavior remains honest
- local fallback remains intact

Main files:

- `packages/shared-state/src/libsql-adapter.ts`
- `packages/shared-runtime/src/otel-export.ts`
- `packages/shared-runtime/src/observability-persistence-activation.ts`

### 5.6 Priority 6: Cross-Platform Host Validation

Resume when one or more of these exist:

- macOS host
- Linux host
- a repaired and usable Linux validation environment

Activate:

- macOS host validation
- Linux host validation
- computer-use runtime parity verification

Expected outcomes:

- real platform parity evidence
- updated runbooks
- no false parity claims

Main files:

- `packages/shared-runtime/src/host-validation-activation.ts`
- `packages/shared-runtime/src/computer-use-runtime.ts`
- `docs/computer-use-runtime.md`

### 5.7 Priority 7: Enterprise / Cloud Edge Integrations

Resume only when corresponding real resources exist:

- SSO credentials
- org tenant configuration
- cloud endpoints
- DeerFlow live endpoint if still desired

Activate:

- enterprise SSO
- org-control-plane auth
- DeerFlow live endpoint compatibility verification

Expected outcomes:

- real credential-backed validation only
- no fake auth activation
- DeerFlow remains optional and non-backbone

## 6. Resource-To-Lane Mapping

Use this table as the master unlock map.

| Resource arrives | Unlocks |
| --- | --- |
| Admin privilege | Windows integrity sandbox, firewall-backed sandbox, part of Hyper-V validation |
| Docker installed | Docker sandbox provider lane |
| Podman installed | Podman sandbox provider lane |
| Hyper-V enabled + admin | Hyper-V sandbox provider lane |
| Working WSL2 / Linux env | Linux validation and some Linux-backed isolation checks |
| Ollama installed | self-hosted model + TTT specialist lane |
| Temporal available | real Temporal orchestration lane |
| LangGraph available | real LangGraph orchestration lane |
| `DATABASE_URL` configured | remote libSQL persistence lane |
| OTEL endpoint + env gate | remote observability lane |
| macOS host | macOS computer-use validation lane |
| Linux host | Linux computer-use validation lane |
| SSO credentials | enterprise SSO lane |
| DeerFlow endpoint | live DeerFlow compatibility lane |

## 7. Required Execution Loop For GLM-5.1

Every time this master spec is used, `GLM-5.1` must execute this loop:

1. read the current architecture docs
2. probe the real resources that matter for this run
3. classify each currently relevant lane as:
   - `live-now`
   - `boundary-only`
   - `privilege-blocked`
   - `host-blocked`
4. choose the highest-priority newly unlocked lane
5. implement only the real activation and verification work needed for that lane
6. update docs
7. stop when the next remaining lane is still blocked

## 8. Required Document Updates

Whenever a blocked lane becomes live, update at minimum:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md) when platform or computer-use behavior changes
- [`./reuse-and-learning.md`](./reuse-and-learning.md) when self-hosted model / TTT activation changes
- [`./index.md`](./index.md) when a new controlling spec becomes relevant

If public contracts change, also update:

- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

## 9. Stop Condition

Only stop when one of these is true:

1. every newly unlocked lane has been fully activated and verified
2. every remaining lane is still honestly blocked by missing resource, missing privilege, or missing host
3. a real architecture fork requires explicit user choice

## 10. Reporting Format

Every run must report:

1. which real resources are now available
2. which lane(s) those resources unlock
3. current classification for each relevant lane
4. files changed
5. what moved from blocked/boundary-only to live verified capability
6. what remains blocked and the exact missing resource
7. verification run
8. next highest-priority blocked lane

## 11. One-Sentence Summary

`This master spec is the one permanent handoff for all future continuation: whenever real resources appear, GLM-5.1 must probe them, unlock the highest-priority blocked lane, activate it honestly, verify it against the real backend or host, update docs, and stop again when the next lane still depends on another missing resource.`
