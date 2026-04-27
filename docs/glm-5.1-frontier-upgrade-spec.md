# GLM-5.1 Frontier Upgrade Spec

This document is the handoff for the next architecture-upgrade wave after the current local-first baseline, computer-use runtime, hybrid memory, MCP fabric, delegated runtime, and readiness layers have already landed.

Use it when the goal is:

- upgrade Apex against the latest frontier best practices without losing the current backbone strengths
- avoid shallow "framework swapping"
- push the repository closer to a world-class agent desktop/runtime stack
- give `GLM-5.1` one continuous, ordered modernization package instead of fragmented prompts

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)

When this document and current code differ, typed contracts and repository code remain authoritative for current behavior.

## 1. Goal

Land the highest-value modernization upgrades that still fit the current architecture philosophy:

- keep the current local-first typed runtime as the backbone
- keep verification-first completion
- keep governed reuse and self-evolution
- keep vendor neutrality
- absorb the best recent ideas from frontier agent systems without turning the repository into framework glue

`Do not stop after one item. Continue through the ordered list until every in-scope item is landed or only true external blockers remain.`

## 2. What Must Not Change

The following are fixed architecture rules for this handoff:

- do not replace the current typed local runtime with `LangGraph`
- do not replace the current backbone with `DeerFlow`
- do not turn memory into vector-only storage
- do not weaken verifier, reconciliation, checklist, completion-engine, or done-gate semantics
- do not add silent telemetry, hidden uploads, or secret third-party reporting
- do not collapse current module boundaries into one large orchestrator file
- do not mark readiness layers as live integrations unless a real endpoint, real host, or real backend has been verified

The correct direction is:

- `LangGraph` as an optional remote orchestration lane behind a clean boundary
- `DeerFlow` as a compatibility and idea source, not the public backbone
- `MCP` as a full host boundary, not just a tool executor
- `Computer Use` as a sandboxed, policy-aware, replayable runtime
- `Hybrid Memory + TTT` as a bounded specialist lane, not the default path

## 3. Fixed Execution Order

Work through the next modernization items in this exact order.

### 3.1 P0: Upgrade MCP Fabric To A Full MCP Host Boundary

Current status:

- MCP live execution fabric exists
- built-in capabilities exist
- policy enforcement and health checks exist

What is still missing relative to frontier best practice:

- full `resources` support
- full `prompts` support
- `roots` support
- `progress` and `cancellation` support
- capability negotiation / protocol-version negotiation
- stronger auth and session-bound authorization semantics

Target outcomes:

- promote the current MCP layer from tool-only fabric to full `MCP Host` boundary
- add typed support for:
  - `tools`
  - `resources`
  - `prompts`
  - `roots`
  - `progress`
  - `cancellation`
  - negotiated capabilities
- preserve the existing policy, audit, and health-check model
- keep current built-in MCP capabilities working
- keep non-MCP skills and local tools first-class citizens

Repository landing areas:

- `packages/shared-runtime/src/mcp-execution-fabric.ts`
- `packages/shared-types/src/index.ts`
- `apps/local-control-plane/src/index.ts`
- any MCP-related docs and module manifests

### 3.2 P1: Introduce A Clean Remote Orchestration SPI Without Replacing The Backbone

Current status:

- LangGraph and Temporal exist mostly as readiness and boundary prep
- current runtime already has strong typed local orchestration

What is still missing relative to frontier best practice:

- a clean live `Agent Runtime SPI`
- explicit mapping from local `TaskRun / TaskAttempt / ExecutionStep / CheckpointSnapshot` to remote graph/workflow runs
- honest lane routing between local-first execution and remote long-running orchestration

Target outcomes:

- formalize a live `Remote Orchestration SPI`
- keep `Temporal` as the workflow boundary and `LangGraph` as one optional runtime implementation behind it
- add lane-routing rules:
  - local typed runtime for desktop and short/medium local tasks
  - remote orchestrator lane for cross-device or long-horizon tasks
- map checkpoint, interrupt, resume, cancellation, and trace IDs cleanly across the boundary
- do not hardwire the architecture to LangGraph internals

Repository landing areas:

- `packages/shared-runtime/src/temporal-langgraph-boundary.ts`
- `packages/shared-runtime/src/index.ts`
- `apps/local-control-plane/src/index.ts`
- `docs/deployment-and-environments.md`
- `docs/task-lifecycle-and-interruption.md`

### 3.3 P2: Turn Sandboxing And Isolation Into A Real Provider Layer

Current status:

- sandbox tiers exist
- Windows Job Object has partial real enforcement
- readiness layers for OS isolation exist

What is still missing relative to frontier best practice:

- unified sandbox provider abstraction
- backend capability negotiation
- true runtime selection between rule-only, OS-native, container, and VM-backed isolation
- tighter linkage between computer-use, local app invoke, shell/file mutation, and sandbox policy

Target outcomes:

- introduce a real `Sandbox Provider SPI`
- support provider classes such as:
  - rule-only
  - OS-native
  - container-backed
  - VM-backed
- route every risky action through explicit provider selection and enforcement evidence
- strengthen:
  - filesystem restriction evidence
  - network restriction evidence
  - process restriction evidence
  - sandbox lease provenance
  - rollback / cleanup / expiry behavior
- keep current tiers:
  - `host_readonly`
  - `guarded_mutation`
  - `isolated_mutation`

Repository landing areas:

- `packages/shared-runtime/src/sandbox-executor.ts`
- `packages/shared-runtime/src/os-isolation-readiness.ts`
- `packages/shared-runtime/src/windows-native-isolation.ts`
- `packages/shared-runtime/src/real-windows-job-object.ts`
- `packages/shared-runtime/src/computer-use-runtime.ts`
- `apps/local-control-plane/src/index.ts`

### 3.4 P3: Add Trace Grading And Eval Flywheel

Current status:

- trace/span/cost/SLO infrastructure exists
- verification stack exists
- learning and reuse baseline exists

What is still missing relative to frontier best practice:

- automatic trace grading
- structured replay-eval scoring
- regression detection based on traces rather than just smoke assertions
- trace-to-methodology feedback loop

Target outcomes:

- add `Trace Grader` contracts and scoring output
- grade:
  - task traces
  - tool traces
  - computer-use traces
  - verification traces
- generate structured regression verdicts
- attach grading output to:
  - task templates
  - learned playbooks
  - capability routing hints
  - methodology memory
- keep deterministic checks first, then semantic/eval grading as an added layer

Repository landing areas:

- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/learning-factory-automation.ts`
- `packages/shared-runtime/src/final-regression-coverage.ts`
- `packages/shared-runtime/src/computer-use-runtime.ts`
- `docs/observability-and-operations.md`
- `docs/reuse-and-learning.md`

### 3.5 P4: Upgrade Memory To Explicit Semantic / Episodic / Procedural Layers

Current status:

- current memory backbone is already durable and human-readable
- directory/document-first memory exists
- hybrid retrieval and routing quality work exists

What is still missing relative to frontier best practice:

- explicit memory-type separation
- stronger background-write policy
- compaction / retention budget rules at the memory-class level
- promotion rules from task experience into procedural memory and skills

Target outcomes:

- explicitly model:
  - `semantic memory`
  - `episodic memory`
  - `procedural memory`
- preserve the current directory/document system of record
- add bounded background write pipelines for memory capture and compaction
- add retention and promotion policies:
  - avoid storage explosion
  - prefer procedure over raw transcript accumulation
  - promote stable reusable patterns into playbooks / task templates / skills
- keep direct directory/document addressing first
- use lexical/metadata retrieval before semantic discovery whenever possible

Repository landing areas:

- `packages/shared-runtime/src/hybrid-memory-ttt.ts`
- `packages/shared-runtime/src/index.ts`
- `packages/shared-types/src/index.ts`
- `docs/reuse-and-learning.md`
- `docs/capability-discovery-and-reuse.md`
- `docs/data-model.md`

### 3.6 P5: Upgrade Hybrid Memory + TTT Into A Specialist Lane, Not A Default Path

Current status:

- memory mode routing exists
- TTT eligibility gate exists
- adaptation SPI and adapters exist
- distillation back into durable memory exists

What is still missing relative to frontier best practice:

- stronger specialist-lane routing
- replay-eval-driven promotion and rollback
- tighter integration with self-hosted model services
- stronger distinction between durable memory and temporary fast adaptation

Target outcomes:

- keep `durable_retrieval` as the default path
- use TTT only when:
  - self-hosted model service is available
  - task family is eligible
  - replay-eval and rollback are available
  - budget gate passes
- add stronger specialist-lane routing signals
- distill only proven gains back into durable methodology / templates / skills
- keep vendor-hosted closed APIs excluded from weight-update flows

Repository landing areas:

- `packages/shared-runtime/src/hybrid-memory-ttt.ts`
- `packages/shared-runtime/src/model-gateway-executor.ts`
- `packages/shared-runtime/src/index.ts`
- `docs/reuse-and-learning.md`
- `docs/external-pattern-adoption.md`

## 4. Cross-Cutting Rules For This Handoff

For all ordered items above:

- prefer extending existing modules over inventing parallel stacks
- preserve replaceability through explicit contracts
- preserve `implemented / partial / future-target` honesty in docs
- prefer deterministic verification wherever possible
- every new live capability must have:
  - typed contracts
  - API surface where appropriate
  - audit trail
  - test or replay coverage
  - documentation updates

Additional mandatory rule:

- if a target requires real external infrastructure, real host access, real credentials, or real privileged execution, land the adapter boundary and readiness evidence honestly, but do not pretend the live integration is complete

## 5. Required Document Updates

When behavior changes, update the affected docs in the same round.

At minimum, keep these synchronized:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./capability-discovery-and-reuse.md`](./capability-discovery-and-reuse.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)

If public contracts change, also update:

- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)
- [`./architecture-document-system.md`](./architecture-document-system.md) when vocabulary or authority boundaries are affected

## 6. Stop Condition

Only stop when one of these is true:

1. every in-scope ordered item in this document is implemented
2. the only remaining work depends on true external infrastructure or credentials
3. the only remaining work depends on unavailable hosts or privileged execution that is not available
4. a real architecture fork requires explicit user choice

Do not stop merely because one ordered item is complete.

### 6.1 Implementation Status (as of 2026-04-24)

| Item | Status | Notes |
| --- | --- | --- |
| P0: MCP Host Boundary | **Implemented** | Full resources, prompts, roots, session auth, progress, capability negotiation in `mcp-execution-fabric.ts` |
| P1: Remote Orchestration SPI | **Implemented** | Clean SPI with local_runtime primary, Temporal/LangGraph as optional fallback lanes in `orchestration-spi.ts` |
| P2: Sandbox Provider Layer | **Implemented** | 8 pluggable providers with capability-based selection in `sandbox-provider-layer.ts` |
| P3: Trace Grading And Eval Flywheel | **Implemented** | 6 grading criteria, regression detection, methodology feedback loop, eval flywheel in `trace-grading-eval.ts` |
| P4: Explicit Memory Layers | **Implemented** | Semantic/Episodic/Procedural separation, compaction, promotion, retention in `memory-layers.ts` |
| P5: TTT Specialist Lane | **Implemented** | Gated specialist lane with 10-check gate, replay-eval, proven-gains-only promotion in `ttt-specialist-lane.ts` |

**Stop condition 1 met**: every in-scope ordered item in this document is implemented.

Externally blocked items (not in-scope for code-level implementation):
- Real Temporal server connection (requires installation)
- Real LangGraph runtime connection (requires installation)
- Real Docker/Podman/Hyper-V container isolation (requires installation)
- Real self-hosted model service (requires Ollama or equivalent)
- Real cloud/OTEL endpoint (requires credentials)

## 7. Reporting Format

Every implementation round must report:

1. current target and why it is the highest remaining priority
2. files changed
3. what moved from implemented baseline to upgraded implementation
4. what remains partial and why
5. which items are still externally blocked
6. verification run
7. next target

## 8. One-Sentence Summary

`This handoff upgrades Apex toward frontier agent-system best practice by turning MCP into a full host boundary, introducing a clean optional remote orchestration SPI, hardening sandbox providers, adding trace grading and eval flywheels, strengthening memory into explicit semantic/episodic/procedural layers, and keeping TTT as a gated specialist lane rather than a default path.`
