# Hermes Self-Evolution And ClawHub Adoption

This document explains how Apex should absorb the strongest publicly visible ideas from Hermes-style self-evolution and OpenClaw ClawHub without replacing the current architecture backbone.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./skill-compatibility.md`](./skill-compatibility.md)
- [`./multi-agent-governance-and-budgeting.md`](./multi-agent-governance-and-budgeting.md)

## 1. Purpose

The goal is not to copy Hermes or OpenClaw.

The goal is to:

- exceed Hermes in governed, auditable self-evolution
- match or exceed ClawHub in discoverability and skill interoperability
- preserve the current local-first typed backbone
- avoid framework or registry lock-in

## 2. Current Position

Apex already has strong self-improvement primitives:

- semantic / episodic / procedural memory separation
- learning factory promotion and rollback
- trace grading and methodology feedback
- acceptance-agent + reconciliation + done gate
- budget-aware evolution lanes
- canonical skill normalization and governance
- OpenClaw / Claude / OpenAI skill import-export compatibility

This means the platform already exceeds many agent systems in governance discipline.

What it does not yet fully exceed Hermes on is:

- live continuous skill evolution against real execution traces
- automatic generation of skill candidates from successful task runs in a fully active pipeline
- tightly integrated self-hosted optimization lane running against real model endpoints

What it does not yet fully match ClawHub on is:

- a live registry adapter for search / inspect / install / publish / update / sync
- remote registry usage signals and trust-aware ranking
- version-synchronized skill-hub workflows

## 3. Hermes-Style Capability To Adopt

Publicly visible Hermes self-evolution emphasizes:

- optimization of skills, prompts, tool descriptions, and eventually code
- using execution traces for reflective improvement
- constraint gates before promotion
- human review before final adoption

Apex should adopt the same shape, but through the current governed runtime model.

### 3.1 Required Self-Evolution End State

The final live loop should be:

1. tasks execute
2. traces, acceptance findings, reconciliation misses, and corrections are captured
3. the runtime distills candidate improvements
4. candidate improvements are evaluated against replay, regression, and budget gates
5. only passing candidates enter governance review
6. only approved candidates become active skills, playbooks, prompts, or routing updates

### 3.2 What Must Be Evolvable

The live evolution loop should support bounded mutation and promotion for:

- canonical skills
- playbooks
- task templates
- methodology summaries
- routing hints
- prompt fragments
- tool descriptions

Code mutation should remain the last and most heavily gated category.

### 3.3 Hard Rules

- never auto-promote directly from a single successful task
- never bypass replay or regression checks
- never bypass human or governance review for externally sourced or high-risk changes
- never let self-evolution silently change the completion policy, permission policy, or sandbox policy

## 4. ClawHub-Style Capability To Adopt

Publicly visible ClawHub provides:

- search and discovery
- skill installation
- versioning and changelogs
- publishing
- verification/trust signals
- moderation and audit hooks

Apex should not replace its canonical registry with ClawHub semantics.

It should add a live adapter boundary.

### 4.1 Required ClawHub End State

The final registry adapter should support:

- search remote registry
- inspect metadata and files
- install into canonical import/governance flow
- publish reviewed canonical skills outward
- update installed remote skills
- sync registry metadata back into local audit and provenance

### 4.2 Best-Practice Trust Model

Remote registry skills must not become active automatically.

Recommended flow:

1. discover remote skill
2. fetch metadata and source bundle
3. normalize into canonical skill spec
4. run policy/trust/security preflight
5. store as `review_required`
6. require acceptance/governance review before activation

### 4.3 Ranking Inputs

Remote skill ranking should combine:

- local governance status
- source trust level
- version freshness
- compatibility with local capability needs
- usage and success signals
- acceptance history

Remote popularity alone should never determine activation.

## 5. What "Beyond Hermes" Means Here

The target is not "more automatic".

The target is:

- more automatic where safe
- more governed where risky
- more replayable
- more auditable
- more budget-aware

Apex should aim to exceed Hermes specifically in:

- acceptance-gated evolution
- budget and interruption integration
- explicit rollback lineage
- external skill governance
- single-source dispatch and delegated-runtime traceability

## 6. Required Implementation Direction

The next evolution wave should add two major capability families.

### 6.1 Live Self-Evolution Lane

Add:

- `SkillEvolutionRun`
- `PromptEvolutionRun`
- `ToolDescriptionEvolutionRun`
- `EvolutionCandidate`
- `EvolutionPromotionDecision`
- `EvolutionRollbackRecord`

And support:

- candidate generation from successful traces and failures
- replay-eval and regression gates
- bounded budget use
- governance review before activation

### 6.2 Live ClawHub Adapter

Add:

- `ClawHubRegistryConfig`
- `ClawHubSearchResult`
- `ClawHubInstallRecord`
- `ClawHubPublishRecord`
- `ClawHubSyncRecord`
- `RemoteSkillTrustVerdict`

And support:

- search
- inspect
- install
- update
- publish
- sync
- trust-aware governance

## 7. Final Rule

Hermes-like self-evolution and ClawHub-like skill distribution are both worth adopting.

But neither should become the product backbone.

The backbone remains:

- local-first typed runtime
- canonical skill registry
- governed memory and reuse
- acceptance-agent + reconciliation + done gate
