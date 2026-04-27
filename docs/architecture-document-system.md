# Architecture Document System

This document defines how the Apex architecture documents fit together.

It answers four questions:

1. which document governs which kind of decision
2. which document wins when documents appear to conflict
3. which runtime terms are public architecture terms versus transitional internal detail
4. how contributors and agents must update docs without introducing drift

This document is the consistency layer for the architecture set.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

## 1. Document Families

The architecture docs are intentionally split into distinct roles.

### 1.1 Constitution

Primary document:

- [`./architecture-constitution.md`](./architecture-constitution.md)

Role:

- non-negotiable engineering law
- mandatory rules for humans, agents, workers, skills, and services

This document wins over all other architecture prose.

### 1.2 Best-Practice Final Shape

Primary document:

- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)

Role:

- strictest final-state architecture target
- what the system should converge toward when optimizing for best practice without preserving weak legacy shape

This document wins over `master_plan.md` when both discuss final-state shape and differ.

### 1.3 Product and Final Convergence Plan

Primary document:

- [`../master_plan.md`](../master_plan.md)

Role:

- full product definition
- high-level target architecture
- product modes and convergence direction

This document remains the canonical product plan, but not the strictest final-shape authority when it conflicts with the reset plan.

### 1.4 Current-State Truth

Primary document:

- [`./current-architecture-status.md`](./current-architecture-status.md)

Role:

- what is implemented now
- what is partial now
- what is not implemented now

When there is a difference between target docs and current reality, this document and the codebase win for present-tense claims.

### 1.5 Focused Subsystem Guides

Examples:

- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./capability-discovery-and-reuse.md`](./capability-discovery-and-reuse.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

Role:

- explain one operational concern in detail
- must remain consistent with the constitution, reset plan, master plan, and current-state map

### 1.6 External Pattern and Execution Protocol Docs

Examples:

- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)
- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)

Role:

- show how external systems should be absorbed
- show how implementation agents should be controlled

These documents do not define product truth on their own.
They must inherit from the higher-priority architecture docs.

## 2. Authority Order

Use this precedence order everywhere:

1. [`./architecture-constitution.md`](./architecture-constitution.md)
2. [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
3. [`../master_plan.md`](../master_plan.md)
4. [`./current-architecture-status.md`](./current-architecture-status.md) plus code and typed contracts for present-tense implementation truth
5. focused subsystem docs
6. external pattern and execution protocol docs

Interpretation rules:

- for final-state architecture conflicts, the constitution and reset plan win
- for current-state implementation conflicts, code and current-status win
- subsystem docs must never silently redefine a higher-level rule
- execution prompts and agent-control docs must never invent architecture outside this stack

## 3. Standard Truth Labels

Every architecture statement should fit one of these truth classes:

- `Law`
  - mandatory rule that must be obeyed
- `Final target`
  - desired best-practice final architecture
- `Current state`
  - what exists now in the repository
- `Transition plan`
  - how to move from current state toward final target

Contributors must not mix these labels casually.

Specifically:

- do not describe a transition plan as current reality
- do not describe a current workaround as final best practice
- do not describe a preferred future term as if the code already implements that abstraction

## 4. Standard Runtime Vocabulary

To keep the architecture set logically tight, the public runtime vocabulary should converge on:

- `TaskRun`
- `TaskAttempt`
- `WorkerSession`
- `SandboxLease`
- `ExecutionStep`
- `VerificationRun`
- `Evidence Graph`
- `Completion Engine`
- `Capability Resolver`
- `Learning Factory`
- `MemoryDirectory`
- `MemoryDocument`

These are the preferred public-facing architecture terms.

## 5. Transitional Internal Vocabulary

The repository still contains transitional internal terminology such as:

- launcher
- launcher driver
- backend adapter
- backend execution
- runner handle
- runner execution
- runner job

Best-practice rule:

- these are implementation-plumbing terms
- they may exist in current code or roadmap detail
- they should not define the stable public product surface
- subsystem docs must mark them as transitional internal detail when they appear

The same rule applies to any future temporary runtime plumbing names.

## 6. Stable Memory Vocabulary

The stable memory model is:

- `working context`
- `internalized memory`
- `compiled knowledge wiki`
- `MemoryDirectory`
- `MemoryDocument`
- `bounded semantic index`

Best-practice retrieval order is:

1. direct address
2. metadata filter
3. approved playbook or template lookup
4. bounded hybrid semantic candidate retrieval
5. rerank
6. recursive deep retrieval
7. transcript fallback only when necessary

This prevents drift back into flat vector-only memory wording.

## 7. Stable Completion Vocabulary

The stable completion model is:

- deterministic validators and checklist
- verifier
- reconciliation
- done gate
- `Evidence Graph`
- `Completion Engine`

Interpretation rule:

- the checklist -> verifier -> reconciliation -> done gate sequence is an explanatory order
- the stronger final architecture is evidence-driven, with these producers feeding one completion decision

This keeps current explanations and final best-practice design from appearing contradictory.

## 8. Required Document Editing Rules

When changing architecture docs, contributors and agents must:

1. identify which truth class is being edited:
   - law
   - final target
   - current state
   - transition plan
2. check whether the change affects:
   - terminology
   - authority order
   - current-vs-target boundaries
   - public runtime surface
3. update all impacted docs rather than leaving partial drift
4. preserve the distinction between:
   - public architecture terms
   - internal transitional implementation detail
5. keep document language aligned with deterministic-first, no-silent-egress, verification-driven completion, modular boundaries, and governed self-evolution

## 9. Required Review Checklist

Before accepting an architecture-doc update, verify:

1. no higher-priority document is contradicted
2. current-state claims still match `current-architecture-status.md` and code
3. final-state claims still match `best-practice-reset-plan.md`
4. subsystem docs do not overexpose transitional runtime plumbing as stable architecture
5. memory docs still preserve hierarchical hybrid retrieval
6. completion docs still preserve evidence-driven completion semantics
7. terminology is consistent across README, index, plan, and focused docs

## 10. Final Rule

In one sentence:

`Apex architecture docs are only considered coherent when they share one authority order, one public runtime vocabulary, one current-vs-target truth model, and one best-practice convergence direction.`
