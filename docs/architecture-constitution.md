# Architecture Constitution

This document is the non-negotiable engineering constitution for Apex.

It exists to answer one question:

`What rules must every future human contributor, agent, worker, skill, and service obey so the system stays modular, reliable, and evolvable?`

This document is not optional guidance.
It is the base rulebook for:

- architecture decisions
- code review
- agent behavior
- skill design
- tool integration
- refactoring
- long-term governance

## 1. Scope and Priority

This constitution applies to:

- product architecture
- local runtime
- cloud runtime
- tools
- skills
- automations
- learned assets
- code generation by agents

Priority order:

1. security and privacy
2. correctness and completion
3. modularity and replaceability
4. deterministic leverage
5. autonomy and speed

## 2. Hard Rules

### 2.1 Task Completion Rule

The system must continue working toward the task objective until one of the following is true:

- the definition of done is satisfied
- the task is explicitly stopped by the user
- a hard safety policy blocks progress
- genuine human judgment is required and cannot be reduced to a policy or deterministic check

Best practice:

- no premature "done"
- no passive abandonment of long tasks
- no silent stalling without watchdog escalation

### 2.2 Deterministic-First Rule

If a task can be solved by a deterministic path, that path must be preferred over LLM reasoning.

The preferred execution order is:

1. existing CLI
2. existing script
3. existing tool or connector
4. existing skill that wraps deterministic infrastructure
5. LLM-planned or LLM-generated path

Implications:

- CLI and scripts are infrastructure, not fallback hacks
- skills bridge LLM reasoning to deterministic execution
- the LLM is the planner, synthesizer, and exception handler, not the default executor for fixed workflows

### 2.3 Do-Not-Rebuild Rule

Before implementing a new capability, the system must search for reusable solutions in:

1. internal capability registry
2. local installed tools
3. GitHub and official tool ecosystems
4. MCP servers and connectors
5. existing scripts and skills

Only when reuse is insufficient on quality, security, latency, or cost grounds may the platform build a new capability.

The build-vs-buy decision must be recorded.

### 2.4 Module Boundary Rule

Every feature must belong to an explicit module with:

- a clear owner
- a typed contract
- defined dependencies
- defined side effects
- defined test surface

No module may reach into another module's private persistence or internal state shape.

### 2.5 Replaceability Rule

Every major subsystem must be swappable behind a contract:

- model providers
- local persistence drivers
- connector transports
- worker runtimes
- sandbox backends
- cloud orchestrators

No feature may assume a single vendor forever.

### 2.6 Long-Run Stability Rule

Long-running work must be designed for unattended operation.

Minimum requirements:

- heartbeats
- checkpointing
- bounded retries
- backoff
- circuit breaking
- replayable evidence
- watchdog detection
- resume-safe state

### 2.7 Interruptibility Rule

Users must be able to stop running work at any time.

The system must:

- stop safely
- preserve artifacts
- preserve checkpoints
- expose resumable state when possible
- avoid corrupting local or external systems on interruption

### 2.8 No Silent Egress Rule

The platform must never silently upload user data, code, artifacts, prompts, logs, or memory to third-party systems.

Required policy:

- outbound network access is deny-by-default
- every remote destination is explicit
- every remote destination is policy-audited
- telemetry is self-hosted by default
- third-party telemetry SDKs are forbidden in the privileged runtime

### 2.9 Human-Readable Knowledge Rule

Long-lived knowledge must remain inspectable by humans.

Required forms include:

- markdown or structured docs
- typed metadata
- audit records
- compact learned assets

The system must not trap its memory only inside opaque embeddings or hidden model state.

### 2.10 Promotion Rule

No learned method becomes generally reusable without:

- sanitation
- validation
- bounded evidence
- policy review
- rollback path

## 3. Mandatory Structural Patterns

### 3.1 Constitution Over Documentation Drift

If an implementation or prompt pattern conflicts with this constitution, the constitution wins.

### 3.1A Document Authority Rule

Architecture documentation must preserve one explicit authority order.

That order is defined in:

- [`./architecture-document-system.md`](./architecture-document-system.md)

No subsystem doc may silently redefine:

- which document wins on conflict
- what counts as current state
- what counts as final target
- what the stable public runtime vocabulary is

### 3.2 Enforce in Code, Not Only in Prose

Important rules should become:

- linters
- tests
- schema validation
- policy checks
- runtime guards

### 3.3 Central Boundaries, Local Freedom

The platform must enforce:

- dependency directions
- policy points
- sandbox tiers
- data egress controls
- completion semantics

Within those boundaries, modules are free to evolve.

### 3.4 Public Vocabulary Rule

Stable public architecture terms must remain compact and consistent.

The preferred public runtime terms are:

- `TaskRun`
- `TaskAttempt`
- `WorkerSession`
- `SandboxLease`
- `ExecutionStep`
- `VerificationRun`

Transitional plumbing terms such as launcher, driver, adapter, backend execution, runner handle, runner execution, and runner job may exist internally, but they must not become the stable product-facing architecture vocabulary.

## 4. Required Module Set

The final system must remain decomposed into at least these modules:

- desktop shell
- native local core
- task runtime
- capability resolver
- tool gateway
- sandbox manager
- completion engine
- learning factory
- automation service
- policy decision point
- event ledger and projections
- cloud workflow orchestrator

## 5. Required Contributor Workflow

Every contributor and agent must:

1. identify the module they are changing
2. identify the contract they rely on
3. avoid cross-module leakage
4. prefer deterministic infrastructure over fresh LLM logic
5. reuse existing capabilities before building new ones
6. preserve auditability and stop/resume behavior
7. update docs when changing architecture rules

## 6. Required Runtime Decision Ladder

For every meaningful step:

1. can this be answered deterministically
2. can this be reused from an existing tool or script
3. can this be delegated to an existing skill
4. does this require model reasoning
5. does it require mutation
6. what sandbox tier is required
7. what evidence will prove completion

## 7. Memory and Summarization Rule

Periodic summarization is allowed only when it is:

- explicitly enabled by user or org policy
- budget-capped
- reviewable
- stored compactly

The default production posture is:

- summarize with intent
- do not silently burn tokens forever in the background

## 8. Final Principle

In one sentence:

`Apex must stay modular, deterministic-first, reusable, stoppable, auditable, privacy-preserving, and capable of finishing long tasks with minimal human intervention.`
