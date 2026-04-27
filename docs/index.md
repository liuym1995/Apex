# Apex Docs Index

This directory contains the focused design and implementation documents that sit under the canonical architecture in [`../master_plan.md`](../master_plan.md).

Use this file as the fastest navigation entry when you need a topic-specific explanation.

## 0. Read This Boundary First

- `master_plan.md` describes the final architecture target and convergence direction
- `README.md` describes the current repository baseline and implemented scope
- `architecture-constitution.md` defines the hard architectural rules every human contributor and agent must obey
- `architecture-document-system.md` defines document authority order, truth classes, and the stable public architecture vocabulary
- `external-pattern-adoption.md` explains how strong external systems should be selectively absorbed into this architecture
- the most exact current-state documents are:
  - `api-contracts.md`
  - `data-model.md`
  - `runtime-improvements-roadmap.md`
- `best-practice-reset-plan.md` describes which target-architecture choices should be upgraded when optimizing for best practice without preserving backward compatibility
- when target architecture and current implementation differ, code and typed contracts are authoritative for current behavior
- the current repository does not yet include a real `LangGraph 2.x` integration; `LangGraph` appears in the architecture as a future cloud-orchestrator choice

## 1. Core Architecture

- [`../master_plan.md`](../master_plan.md)
  - canonical product and architecture plan
- [`./architecture-constitution.md`](./architecture-constitution.md)
  - mandatory architecture rules for contributors, agents, skills, and services
- [`./architecture-document-system.md`](./architecture-document-system.md)
  - authority order, vocabulary normalization, and current-vs-target document rules
- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)
  - detailed landing guide for Hermes, Claude/Codex, AutoResearch, Karpathy wiki, In-Place TTT, EvoMap, and AI Scientist ideas
- [`./hermes-self-evolution-and-clawhub-adoption.md`](./hermes-self-evolution-and-clawhub-adoption.md)
  - focused landing guide for surpassing Hermes-style self-evolution and adding live ClawHub registry adoption without replacing the current backbone
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
  - best-practice reset plan for upgrading the target architecture without compatibility constraints
- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
  - strict execution protocol and reusable prompt spec for commanding `GLM-5.1` to implement against this architecture
- [`./glm-5.1-remaining-priority-execution-spec.md`](./glm-5.1-remaining-priority-execution-spec.md)
  - best-practice execution order for the remaining high-impact architecture items that `GLM-5.1` should land next
- [`./glm-5.1-computer-use-completion-spec.md`](./glm-5.1-computer-use-completion-spec.md)
  - strict completion handoff for finishing the remaining computer-use runtime work without stopping after each wave
- [`./glm-5.1-computer-use-final-blocker-spec.md`](./glm-5.1-computer-use-final-blocker-spec.md)
  - final blocker-clearing handoff for finishing the last computer-use runtime gaps across Windows, macOS, and Linux
- [`./glm-5.1-computer-use-last-mile-spec.md`](./glm-5.1-computer-use-last-mile-spec.md)
  - final last-mile handoff for the very last remaining computer-use runtime gaps after the blocker-clearing pass
- [`./glm-5.1-computer-use-host-parity-spec.md`](./glm-5.1-computer-use-host-parity-spec.md)
  - final host-parity handoff for the remaining macOS and Linux computer-use action gaps and host verification work
- [`./glm-5.1-computer-use-host-validation-spec.md`](./glm-5.1-computer-use-host-validation-spec.md)
  - real-host validation handoff for the final remaining macOS and Linux computer-use work
- [`./glm-5.1-local-remaining-execution-spec.md`](./glm-5.1-local-remaining-execution-spec.md)
  - continuous handoff for all still-doable local-first remaining work after computer-use host validation becomes externally blocked
- [`./glm-5.1-hybrid-memory-ttt-spec.md`](./glm-5.1-hybrid-memory-ttt-spec.md)
  - bounded handoff for preserving the current memory backbone while adding a gated In-Place TTT memory-strategy lane
- [`./glm-5.1-frontier-upgrade-spec.md`](./glm-5.1-frontier-upgrade-spec.md)
  - one-shot modernization handoff for upgrading the current backbone toward frontier best practice without replacing it with LangGraph or DeerFlow
- [`./glm-5.1-post-frontier-resource-gated-spec.md`](./glm-5.1-post-frontier-resource-gated-spec.md)
  - resource-gated activation handoff for everything that remains after the frontier-upgrade wave reaches stop condition 1
- [`./glm-5.1-final-resource-activation-master-spec.md`](./glm-5.1-final-resource-activation-master-spec.md)
  - the permanent resource-triggered continuation handoff for all remaining work after the project reaches a fully blocked-by-real-resources state
- [`./glm-5.1-resource-arrival-playbook.md`](./glm-5.1-resource-arrival-playbook.md)
  - direct operator playbook and ready-to-send prompts for resuming work the moment a real resource becomes available
- [`./glm-5.1-post-local-remaining-spec.md`](./glm-5.1-post-local-remaining-spec.md)
  - continuous handoff for the still-doable post-milestone local work after the first local runtime and hybrid-memory waves are complete
- [`./glm-5.1-final-local-feasible-spec.md`](./glm-5.1-final-local-feasible-spec.md)
  - continuous handoff for the final meaningful local-first runtime work that remains after the earlier local and hybrid-memory waves
- [`./glm-5.1-external-readiness-spec.md`](./glm-5.1-external-readiness-spec.md)
  - continuous handoff for the remaining repo-local preparation layers after the locally-feasible runtime work is complete
- [`./glm-5.1-live-external-rollout-spec.md`](./glm-5.1-live-external-rollout-spec.md)
  - final handoff for real external deployment and live integration after readiness work is complete
- [`./glm-5.1-privileged-readiness-spec.md`](./glm-5.1-privileged-readiness-spec.md)
  - final repo-local handoff for admin-blocked and resource-blocked preparation work after live rollout reaches non-admin limits
- [`./glm-5.1-resource-gated-resume-spec.md`](./glm-5.1-resource-gated-resume-spec.md)
  - final resume handoff for continuing only when real resources become available
- [`./glm-5.1-settings-subagents-acceptance-budget-spec.md`](./glm-5.1-settings-subagents-acceptance-budget-spec.md)
  - continuous handoff for wiring settings defaults into runtime behavior, bounding multi-agent execution, formalizing the acceptance-agent boundary, and adding hard budget enforcement
- [`./glm-5.1-post-contract-integration-spec.md`](./glm-5.1-post-contract-integration-spec.md)
  - continuous handoff for integrating the new settings, multi-agent, acceptance, and budget contracts into real APIs, task execution, workspace UI, and verification paths
- [`./glm-5.1-final-local-closure-spec.md`](./glm-5.1-final-local-closure-spec.md)
  - final locally achievable closure handoff for wiring dispatch leasing into delegated execution, automatic subagent envelopes into handoff, and budget interruption into the real operator flow
- [`./glm-5.1-external-completion-master-spec.md`](./glm-5.1-external-completion-master-spec.md)
  - permanent continuation handoff after final local closure, used to activate only real external lanes as resources arrive until the whole product is complete
- [`./glm-5.1-hermes-clawhub-spec.md`](./glm-5.1-hermes-clawhub-spec.md)
  - continuous handoff for upgrading the repository toward live Hermes-style self-evolution and live OpenClaw ClawHub registry compatibility
- [`./glm-5.1-unified-final-completion-spec.md`](./glm-5.1-unified-final-completion-spec.md)
  - unified final continuation handoff: finish the Hermes/ClawHub local enhancement wave first, then fall through into the resource-gated external activation master flow
- [`./current-architecture-status.md`](./current-architecture-status.md)
  - current repository status map with `implemented / partial / not implemented` boundaries
- [`../README.md`](../README.md)
  - repository entry point and document links

## 2. Runtime Learning and Reuse

- [`./reuse-and-learning.md`](./reuse-and-learning.md)
  - learning loop, fast-path planning, compact reuse assets
- [`./capability-discovery-and-reuse.md`](./capability-discovery-and-reuse.md)
  - capability-first resolution, reuse vs fallback behavior

## 3. Completion and Reliability

- [`./verification-and-completion.md`](./verification-and-completion.md)
  - completion stack, verifier, reconciliation, done gate
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
  - lifecycle, checkpoints, stop, resume, interruption model

## 4. Local Runtime and UX

- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
  - local permissions, tool safety, staged machine-control rollout
- [`./local-settings-and-runtime-defaults.md`](./local-settings-and-runtime-defaults.md)
  - local settings model, required-vs-default path behavior, and runtime default directory rules
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
  - dedicated computer-use runtime architecture, provider matrix, fallback order, and implementation boundary
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
  - desktop task workspace structure and user-facing interaction model

## 5. Engineering Reference

- [`./api-contracts.md`](./api-contracts.md)
  - contract boundaries and runtime-facing API expectations
- [`./data-model.md`](./data-model.md)
  - entity model, storage boundaries, and persistence guidance
- [`./skill-compatibility.md`](./skill-compatibility.md)
  - canonical skill contract and compatibility with external skill ecosystems
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
  - deployment modes, environments, and rollout guidance
- [`./observability-and-operations.md`](./observability-and-operations.md)
  - operational visibility, monitoring, and dashboards
- [`./multi-agent-governance-and-budgeting.md`](./multi-agent-governance-and-budgeting.md)
  - supervisor/subagent governance, acceptance-agent boundary, and task budget enforcement model
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)
  - phased roadmap for session/harness/sandbox separation, compaction, subagents, sandboxing, and cloud augmentation

## 6. Recommended Reading Paths

### 6.1 Product and Architecture Review

Read in this order:

1. [`../master_plan.md`](../master_plan.md)
2. [`./architecture-constitution.md`](./architecture-constitution.md)
3. [`./architecture-document-system.md`](./architecture-document-system.md)
4. [`./external-pattern-adoption.md`](./external-pattern-adoption.md)
5. [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
6. [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
7. [`./reuse-and-learning.md`](./reuse-and-learning.md)
8. [`./verification-and-completion.md`](./verification-and-completion.md)

### 6.2 Runtime / Agent Implementation

Read in this order:

1. [`./architecture-document-system.md`](./architecture-document-system.md)
2. [`./capability-discovery-and-reuse.md`](./capability-discovery-and-reuse.md)
3. [`./reuse-and-learning.md`](./reuse-and-learning.md)
4. [`./verification-and-completion.md`](./verification-and-completion.md)
5. [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)

### 6.3 Local Desktop and Machine-Control Work

Read in this order:

1. [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
2. [`./computer-use-runtime.md`](./computer-use-runtime.md)
3. [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
4. [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)

### 6.4 Backend and Persistence Work

Read in this order:

1. [`./api-contracts.md`](./api-contracts.md)
2. [`./data-model.md`](./data-model.md)
3. [`./verification-and-completion.md`](./verification-and-completion.md)

## 7. Summary

This directory is meant to keep the project understandable as it grows.

In one sentence:

`master_plan.md defines the whole product, while docs/ explains the system one operational concern at a time.`
