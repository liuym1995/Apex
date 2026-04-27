# API Contracts

This document explains the API and contract boundaries that keep Apex modular and replaceable.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./data-model.md`](./data-model.md)

## 1. Purpose

The platform is designed to stay replaceable across:

- models
- runtimes
- local persistence backends
- workers
- connectors

That only works if the major boundaries are enforced through explicit contracts.

## 2. Why Contracts Matter

Without contract boundaries:

- app logic leaks into persistence details
- workers leak their own semantics into the system
- one runtime becomes impossible to replace
- UI becomes coupled to unstable internals

Contracts are what keep the architecture composable.

## 3. Main Contract Layers

The current architecture should be thought of as having these major contract surfaces:

### 3.1 Task Contract

Defines:

- task identity
- task intent
- type
- department
- risk
- plan
- definition of done
- timestamps
- lifecycle state

This is the central object in the whole product.

### 3.2 Completion Contract

Defines:

- goal
- completion criteria
- acceptance tests
- required artifacts
- approval requirements

This is what gives tasks an explicit completion target.

### 3.3 Capability Resolution Contract

Defines:

- inferred need
- chosen strategy
- selected capabilities
- reasoning

This keeps reuse and fallback decisions visible and persistent.

### 3.4 Verification Contracts

Includes:

- checklist result
- reconciliation result
- verifier result
- done gate result

These contracts separate execution from completion.

### 3.5 Learned Asset Contracts

Includes:

- methodology memory entries
- approved learned skills
- task templates
- canonical skill registry entries

These contracts allow the system to evolve without storing raw chaos.

### 3.6 Canonical Skill Interchange Contract

Defines:

- canonical skill registry entry shape
- supported import/export document formats
- content import vs file import boundaries
- security preflight before registry persistence

This keeps external skill ecosystems interoperable without letting them become internal runtime truth.

### 3.7 Policy Governance Contract

Defines:

- effective policy diagnostics
- policy scope registry entries
- policy proposals
- proposal approval and apply state
- policy bundle import/export/verify contracts
- rollback snapshots and policy audit entries

This keeps governance changes reviewable instead of treating policy as an invisible runtime side effect.

The governance contract should also describe policy-environment semantics:

- scope labels
- allowed promotion transitions
- current promotion pipeline source

so the platform can enforce release flow rather than only documenting it.

## 4. Local Control Plane API Role

The local control plane is the main runtime-facing local API surface.

Its responsibilities are:

- expose task operations
- expose workspace state
- expose local tool actions
- expose capability discovery
- expose canonical skill registry search
- expose canonical skill import/export
- expose canonical skill governance transitions
- expose canonical skill bundle verify/import/export
- expose canonical skill bundle activity history
- expose scoped policy registry and policy proposals
- expose proposal approval, rejection, apply, rollback, and promotion
- expose inbox summaries, filters, acknowledgement, and resolution
- expose canonical desktop deep-link generation for task and governance targets
- remain safe to consume from the desktop shell

The local UI should treat the control plane as the source of operational truth.

The inbox contract should support operator-facing triage patterns:

- severity filtering
- kind filtering
- state filtering (`new` vs `acknowledged`)
- dashboard-level inbox summary counts

The same control plane should also be able to emit canonical desktop deep links for:

- tasks
- inbox items
- policy follow-ups
- policy proposals
- execution templates
- learned playbooks

This keeps notifications, copied links, future native desktop callbacks, and workspace focus actions on one navigation contract.

## 5. Workspace API Boundary

The workspace response should remain a composed view model rather than raw storage leakage.

A workspace response is expected to aggregate:

- task
- runtime boundaries
- agent-team summary
- execution template metadata
- artifacts
- checkpoints
- worker runs
- capability resolutions
- tool invocations
- browser sessions
- verification state
- learned assets
- reuse recommendations
- operational safety summary
- audit summary
- watchdog status

The UI should not need to reconstruct these from low-level tables by itself.

Execution template metadata should surface, at minimum:

- `execution_template_key`
- `reused_task_template_id`
- `reused_task_template_version`
- canonical `deep_link`
- compact reused task-template details
- related approved learned playbooks that share the same fingerprint
- `improvement_hints` for both the reused task template and related playbooks when they exist

For reuse-governance tasks, the same workspace contract should also surface a structured `reuseImprovement` object:

- `source_kind`
- `target_kind`
- `target_id`
- `suggested_learning_action`
- canonical `deep_link`
- compact target summary fields such as title, version, applicability, and failure boundaries when they are available
- `target_improvement_hints` when the target asset already carries refinement guidance

This keeps fast-path reuse explainable without forcing the desktop layer to inspect generic task input bags.

The same workspace contract should also expose a structured `runtimeBoundaries` object with:

- `session`
  - compacted vs promoted context behavior
  - memory counts
  - checkpoint counts
- `harness`
  - planner mode
  - capability resolution count
  - verification stack
- `sandbox`
  - isolation tier
  - execution profile
  - guarded scopes

This keeps `session / harness / sandbox` visible and stable as the runtime evolves toward stronger isolation.

The operational safety summary should be derived from the invocation ledger and should include:

- local vs external invocation mix
- idempotent invocation counts
- compensation availability and failure counts
- reconciliation state counts
- degraded execution counts
- manual-attention recommendations

## 6. Tool Invocation Contract

Each tool invocation should record:

- tool name
- task id
- input summary
- output summary
- status
- timestamp
- idempotency key when present
- compensation availability and status
- reconciliation state when the tool affects external systems

This keeps local and remote tool execution auditable and debuggable.

For external connectors and gateway-managed tools, the contract should also support:

- idempotent reuse of a prior successful invocation
- explicit degraded or failed invocation state
- external reconciliation lookups by task, tool, and idempotency key

Those fields should be stable enough that the desktop workspace can explain:

- whether a rerun is safe
- whether compensation is still possible
- whether an external side effect is still pending reconciliation

The same workspace contract should also expose a structured `agentTeam` object with:

- `summary`
  - `team_id`
  - `mode`
  - `status`
  - `supervisor_session_id`
  - session and message counts
  - isolated context counts
- `sessions`
  - `subagent_session_id`
  - `role`
  - `worker_kind`
  - `worker_name`
  - `status`
  - `isolated_context_key`
  - checkpoint and message counts
  - compact result summary
- `checkpoints`
  - `checkpoint_id`
  - `subagent_session_id`
  - `stage`
  - compact summary
  - timestamp
- `messages`
  - `message_id`
  - `subagent_session_id`
  - `direction`
  - `kind`
  - compact summary
  - timestamp

This keeps the first agent-team boundary explicit without forcing the desktop layer to infer delegated work from raw worker runs alone.

`GET /api/local/tasks/:taskId/agent-team` should return the same `agentTeam` view in isolation so diagnostics, automation, and future team-oriented UI surfaces can inspect delegation state without fetching the full workspace payload.

Best-practice boundary:

- the stable public runtime surface should converge on:
  - `TaskRun`
  - `TaskAttempt`
  - `WorkerSession`
  - `SandboxLease`
  - `ExecutionStep`
  - `VerificationRun`
- the agent-team API should expose intent, state, evidence, and diagnostics through that compact public model
- launcher, driver, adapter, backend-execution, runner, and job terminology may still exist in current code or transitional diagnostics, but should be treated as internal runtime plumbing rather than the preferred long-term product API

The public delegated-runtime contract should therefore prioritize:

- delegated session summary
- handoff and resume intent
- execution binding to runtime and sandbox tier
- heartbeat and liveness
- completion or failure outcome
- evidence and audit trail

When transitional runtime-plumbing detail is still surfaced for current implementation visibility, it should be grouped under diagnostics rather than defining the primary public API shape.

When a connector performs real network access, the contract should also preserve connector policy:

- explicit hostname allowlist or policy source
- bounded timeout behavior
- artifact capture of the returned state
- enough structured output for later replay or debugging

Some connectors should also expose a stable business-shaped output instead of only a raw payload.

Example:

- `crm_contact_lookup` should return a normalized contact object
- `hr_candidate_lookup` should return a normalized candidate object
- `finance_reconcile` should return a normalized reconciliation object
- the raw upstream payload may still be preserved for debugging
- the normalized object is what downstream planning, verification, and UI should prefer

Connector definitions themselves should also be first-class contract objects.

Recommended `ConnectorSpec` fields include:

- connector name
- connector type
- auth strategy
- pagination strategy
- required inputs
- compensation availability
- reconciliation mode
- connector-specific required inputs

This keeps connector growth disciplined as the platform moves from generic fetch-style helpers to real business-system adapters.

The same shared `ConnectorSpec` should be reused by:

- tool gateway catalog responses
- local control plane proxy responses
- desktop workspace rendering

That avoids connector metadata drifting across layers.

## 7. Worker Boundary

Workers should remain bounded execution units.

They should not redefine:

- task semantics
- permission semantics
- completion semantics

Those belong to the platform contracts.

Workers should consume a task context and return bounded execution output.

## 8. Persistence Boundary

Application logic should not bind directly to one storage engine.

The store layer should abstract:

- task records
- artifacts
- checkpoints
- learned assets
- verification results
- browser sessions
- worker runs

This allows the local state backend to change later without rewriting the whole runtime.

## 8.1 Policy Governance API Expectations

The policy surface should remain explicit and auditable.

Recommended operations include:

- `GET /api/local/skills/policy`
- `GET /api/local/skills/policy/scopes`
- `GET /api/local/skills/policy/audits`
- `GET /api/local/skills/policy/proposals`
- `GET /api/local/skills/policy/proposals/queues`
- `GET /api/local/skills/policy/proposals/follow-ups`
- `POST /api/local/skills/policy/proposals/follow-ups/:followUpId/execute`
- `GET /api/local/inbox` with optional `severity`, `kind`, and `status`
- `POST /api/local/inbox/:inboxId/ack`
- `POST /api/local/inbox/:inboxId/resolve`
- `GET /api/local/skills/policy/approval-templates`
- `GET /api/local/skills/policy/release-history`
- `POST /api/local/skills/policy/diff`
- `POST /api/local/skills/policy/scopes/:scope`
- `POST /api/local/skills/policy/scopes/:scope/rollback`
- `POST /api/local/skills/policy/proposals/scope`
- `POST /api/local/skills/policy/proposals/promote`
- `POST /api/local/skills/policy/proposals/:proposalId/approve`
- `POST /api/local/skills/policy/proposals/:proposalId/reject`
- `POST /api/local/skills/policy/proposals/:proposalId/apply`
- `POST /api/local/skills/policy/proposals/batch`
- `POST /api/local/skills/policy/export`
- `POST /api/local/skills/policy/verify-bundle`
- `POST /api/local/skills/policy/import`

These routes should preserve role separation:

- policy editors propose
- policy approvers review or reject
- policy promoters apply approved changes or import trusted policy bundles

## 9. Replaceability Guidance

A new implementation should be safe to swap in when it preserves the surrounding contract.

## 10. Skill Policy Diagnostics Contract

`GET /api/local/skills/policy` is the canonical runtime-facing diagnostics endpoint for effective skill-governance policy.

The effective merge precedence is:

- default policy
- global policy file
- org policy file
- workspace policy file
- local policy file
- environment overrides

The supported file-based sources are:

- `APEX_SKILL_POLICY_PATH_GLOBAL`
- `APEX_SKILL_POLICY_PATH_ORG`
- `APEX_SKILL_POLICY_PATH_WORKSPACE`
- `APEX_SKILL_POLICY_PATH_LOCAL`

`APEX_SKILL_POLICY_PATH` should continue to work as a backward-compatible alias for the local scope.

The response should expose four things together:

- effective trust policy
- effective content policy
- effective role policy
- source attribution for every effective rule

It should also include `policy_file` metadata so operators can immediately see:

- the resolved policy path
- whether the file loaded successfully
- the current parse or validation error when file loading failed

And it should include `policy_files` metadata so operators can inspect every configured scope individually.

This endpoint is intentionally diagnostic-first. It exists so the desktop workspace, smoke tests, and operators can inspect the policy that is actually in force instead of reconstructing it from environment variables and local assumptions.

`POST /api/local/skills/policy/simulate` is the dry-run companion endpoint.

It should accept the same bundle input styles as verify/import:

- inline bundle manifest
- absolute bundle path

And it should return:

- the same content/trust evaluation used by bundle verification
- the actor role being simulated
- whether that actor can review, promote, or import a trusted bundle
- effective policy-file metadata and source attribution

This keeps preflight decision-making explicit before a real trusted import is attempted.

`GET /api/local/skills/policy/scopes` and `POST /api/local/skills/policy/scopes/:scope` are the scoped policy-registry endpoints.

They should:

- expose each scope independently
- return parsed config plus load/error state
- require an explicit actor role for writes
- validate the config through `SkillPolicyConfigSchema`
- write JSON back only through explicit absolute paths or preconfigured scope paths

This keeps policy editing inside the same audited local control plane instead of encouraging manual hidden file edits.

`POST /api/local/skills/policy/diff` is the effective-policy preview endpoint.

It should:

- accept a target scope
- accept a candidate config and optional path
- resolve the same merge stack used by the runtime
- return `before`, `after`, and a compact list of `changed_fields`

`GET /api/local/skills/policy/audits` is the audit trail endpoint for policy governance.

It should expose recent `skill.policy_*` audit events so operators can reconstruct:

- which scope changed
- who changed it
- what effective fields changed

Policy governance also includes:

- `POST /api/local/skills/policy/export`
- `POST /api/local/skills/policy/verify-bundle`
- `POST /api/local/skills/policy/import`
- `POST /api/local/skills/policy/scopes/:scope/rollback`

These endpoints exist so policy can be treated as a release artifact with validation and rollback semantics rather than as ad hoc local file mutation.

Examples:

- SQLite -> libSQL
- fetch snapshot browser -> real browser worker
- one worker runtime -> another worker runtime
- one model provider -> another model provider

This is the main architectural reason to keep contracts explicit and typed.

## 10. API Design Rules

Recommended rules:

- keep task and workspace endpoints stable
- prefer additive change over breaking change
- expose structured fields rather than opaque strings
- return enough metadata for UI explainability
- avoid leaking persistence-specific details

For canonical skill interoperability specifically:

- importers should normalize first, then register
- security preflight should run on normalized prompt content before persistence
- file import/export should require an explicit local path
- export should always originate from a canonical registry record rather than an untrusted external blob
- only `active` canonical skills should participate in capability discovery and reuse ranking
- `review_required` and `disabled` skills should remain queryable in the registry without silently affecting planning
- governance APIs should expose:
  - review queue visibility
  - queue segmentation by `review_path`
  - queue-specific approval role enforcement
  - per-skill audit history
  - promoted bundle export for approved distribution

For promoted bundle distribution, the contract should also support:

- a typed bundle manifest
- integrity verification
- optional signature verification
- trusted vs untrusted import semantics
- publisher identity
- source environment metadata
- release channel metadata
- promotion note metadata
- provenance history across bundle export, promotion, and import
- local trust policy evaluation for publisher and release channel
- bundle content policy evaluation for skill source, blocked tags, and blocked capabilities

The bundle manifest should therefore be rich enough to answer:

- who published this bundle
- where it came from
- which channel it was promoted into
- why it was promoted
- which bundle lifecycle events already happened before this handoff
- whether local policy considers the publisher trusted
- whether local policy allows the declared release channel
- whether bundle content passes source, tag, and capability policy

Governance and bundle-release APIs should also honor role-based policy.

At minimum, contracts should be able to distinguish roles for:

- review / activate / disable canonical skills
- promote and export bundles
- import bundles as trusted

## 11. Summary

The platform stays modular because contracts define what each part may assume about the others.

In one sentence:

`Apex uses explicit task, capability, verification, and learned-asset contracts so runtimes, tools, storage, and UI can evolve without collapsing into one another.`
### Governance alerts

- `POST /api/local/governance-alerts/desktop-navigation`
  - Converts a high-risk desktop navigation pattern into a first-class governance alert.
  - Reuses an aggregated alert when the same risk recurs.
  - Can auto-escalate repeated warning-level events into a critical governance alert.
  - Reopens a previously resolved inbox item when the same alert recurs.
  - Returns the created or updated alert plus the derived inbox item.
- `GET /api/local/governance-alerts`
  - Lists governance alerts with their current state (`new / acknowledged / resolved`).
  - Includes summary aggregation and top repeated alerts so repeated desktop signals do not explode into unreadable alert lists.
  - Each item may include `occurrence_count`, `first_seen_at`, `last_seen_at`, `auto_escalated`, `escalated_at`, and `suppressed_repeat_count`.
- `GET /api/local/governance-alerts/follow-ups`
  - Derives a dedicated execution feed from active governance alerts.
  - Only includes alerts that are critical, auto-escalated, or have repeated enough times to warrant focused handling.
  - Returns structured follow-up items that point back to the canonical governance alert and deep-link target.
- `POST /api/local/governance-alerts/follow-ups/:followUpId/execute`
  - Executes a governance follow-up through the same governance-alert execution path used by inbox actions.
  - Creates a template-backed `ops` task and preserves the original governance alert as the source of truth.
- `GET /api/local/governance-alerts/:alertId/audits`
  - Returns the audit trail for a specific governance alert.
- `POST /api/local/inbox/:inboxId/execute`
  - Executes an inbox item when the item maps to an executable backend flow.
  - Current executable kinds:
    - `policy_follow_up`
    - `governance_alert`
  - Executed governance items now create template-backed `ops` tasks with an `execution_template_key` plus task-specific `definition_of_done`.

### Dashboard

- `GET /api/local/dashboard`
  - Includes `governance_alert_summary`, so desktop governance pressure shows up alongside task totals and inbox counts.
  - The summary includes escalated alert counts and aggregated occurrence totals.
