# Multi-Agent Governance And Budgeting

This document defines the best-practice multi-agent control model, acceptance-agent boundary, and runtime budget enforcement model for Apex.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)

## 1. Purpose

The runtime should support multiple cooperating agents without:

- uncontrolled context explosion
- duplicate task assignment
- unbounded agent spawning
- silent cost blowups
- executor-biased self-acceptance

## 2. Best-Practice Multi-Agent Model

The preferred pattern is:

- one `Supervisor Agent`
- multiple bounded `Subagents`
- one versioned `Dispatch Plan` as the single source of truth
- one independent `Acceptance Agent` in the completion path

Subagents should not receive the full parent context by default.
They should receive a scoped context envelope.

## 3. Plan As Single Source Of Truth

The runtime should treat the structured dispatch plan as authoritative.

Each plan step should have:

- `step_id`
- `plan_version`
- `status`
- `assignee`
- `lease_status`
- `idempotency_key`
- `depends_on_step_ids`
- `result_envelope_ref`

Rules:

- only the supervisor can create or reassign steps
- only one active lease may exist per step at a time
- subagents may update only their assigned step result, not the global plan topology
- plan version changes must be auditable

## 4. Scoped Context Envelopes

Each subagent should receive a structured task packet rather than the full thread history.

The packet should contain only:

- the step goal
- allowed tools and allowed sandboxes
- relevant artifacts
- relevant memory hits
- relevant policy slice
- step-level definition of done
- resource and budget limits
- return schema

The subagent should return only a compact result envelope:

- status
- summary
- artifacts
- evidence
- blockers
- follow-up note

This is the main mechanism for preventing supervisor-context explosion.

## 5. Hard Multi-Agent Limits

The runtime should apply both topology caps and machine-resource caps.

### 5.1 Default Topology Caps

Best-practice defaults:

- `max_parallel_subagents = 4`
- `max_total_subagents_per_task = 8`
- `max_delegation_depth = 2`

### 5.2 Machine-Resource Policy

By default, the runtime should operate in `auto` mode and reserve `20%` of measured machine capacity for the user and the operating system.

Recommended effective envelope:

- `allocatable_cpu_cores = max(1, floor(logical_cpu_cores * 0.8))`
- `allocatable_memory_mb = max(1024, floor(available_memory_mb * 0.8))`

The final effective concurrency should be the minimum of:

- the topology cap
- the CPU-derived safe concurrency
- the memory-derived safe concurrency
- any stricter sandbox or policy cap

This means:

- the machine resource model is adaptive
- the topology caps remain hard upper bounds unless the user explicitly changes them in advanced settings

### 5.3 User Settings

These limits should appear in Settings as:

- `subagent_resource_mode`
  - `auto`
  - `manual`
- `cpu_reserve_ratio`
- `memory_reserve_ratio`
- `max_parallel_subagents`
- `max_total_subagents_per_task`
- `max_delegation_depth`

Best-practice UX:

- default to `auto`
- expose the detected CPU and memory envelope
- show the effective computed concurrency
- label values above the default safety baseline as advanced and risky

## 6. Acceptance Agent

Yes, a dedicated acceptance-focused agent is recommended.

But it must not be the only acceptance authority.

The best-practice completion path is:

1. deterministic checklist
2. acceptance/verifier agent review
3. reconciliation against real state
4. done gate

### 6.1 Why A Separate Acceptance Agent Helps

A separate acceptance agent reduces:

- executor self-confirmation bias
- hidden missing-step acceptance
- overfitting to the executor's local reasoning
- premature success marking

### 6.2 Acceptance Agent Input Boundary

The acceptance agent should receive:

- task intent
- definition of done
- plan completion summary
- artifacts
- evidence
- compact execution summary
- budget and policy context

It should not receive the full executor scratchpad by default.

### 6.3 Acceptance Agent Output

The acceptance agent should return:

- verdict
  - `accepted`
  - `accepted_with_notes`
  - `revise_and_retry`
  - `blocked`
- rationale
- missing items
- quality concerns
- suggested rerun scope

### 6.4 Risk-Based Escalation

Best-practice escalation:

- low/medium risk -> one acceptance agent
- high/critical risk -> acceptance agent plus stronger deterministic evidence and optional human approval

## 7. Budget Enforcement

Each task should support a first-class budget contract.

### 7.1 Budget Inputs

The runtime should track:

- provider
- model
- input tokens
- output tokens
- cached tokens if billed differently
- per-provider price table
- estimated and actual task cost

### 7.2 Price Source

The runtime should maintain a pricing registry with:

- provider name
- model name
- input token price
- output token price
- cache pricing when applicable
- effective date
- source metadata

### 7.3 Budget Contract

Each task should support:

- `budget_mode`
  - `inherit_default`
  - `task_specific`
- `budget_currency`
- `hard_limit_amount`
- `warning_threshold_pct`
- `on_limit_reached`
  - `pause_and_ask`
  - `pause_and_require_new_limit`
- `user_override_policy`

### 7.4 Runtime Behavior

When the budget reaches the hard limit:

- interrupt the task
- mark it as budget-paused rather than completed
- show the current spend and the configured limit
- ask the user whether to continue

Best-practice continuation options:

- increase the limit to a new explicit amount
- approve a one-time extension amount
- stop the task

The runtime should not silently continue after exceeding the cap.

## 8. Workspace Visibility

The desktop workspace should show:

- current task budget
- current spend
- projected next-step spend when available
- budget warning / hard-stop status
- subagent count
- active vs completed subagents
- current effective concurrency cap
- delegation depth
- acceptance-agent verdict and missing items

## 9. Required Implementation Direction

The repository should add:

- settings-backed directory defaults that feed actual task behavior
- settings-backed multi-agent resource policy
- supervisor-controlled dispatch-plan leasing
- acceptance-agent boundary as a first-class verification stage
- first-class task budget contracts and spend tracking
- budget-triggered pause and explicit user continuation flow

## 10. Hard Rules

- no unlimited subagent spawning by default
- no duplicate active assignment on the same plan step
- no direct subagent access to full parent context unless explicitly allowed
- no task may continue past a hard budget cap without explicit user approval
- no acceptance agent may replace deterministic verification and reconciliation
