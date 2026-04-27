# GLM-5.1 Live External Rollout Spec

This document is the final handoff for the work that remains only after the local-first implementation and external-readiness preparation layers are complete.

Use it when the goal is:

- move from repository-local readiness into real external deployment and live integration
- finish the remaining architecture only when the required infrastructure is actually available
- avoid pretending a blocked system is already live

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./glm-5.1-external-readiness-spec.md`](./glm-5.1-external-readiness-spec.md)

When current code and this document differ, code and typed contracts remain authoritative for current behavior.

## 1. Goal

The repository-local work is now largely complete.

What remains is no longer "more local implementation".

What remains is:

- real external deployment
- real service hookup
- real provider integration
- real unavailable-host validation

`Do not fake live deployment. Only mark an area as implemented when the real external system has been deployed, integrated, and validated.`

## 2. Remaining Real External Work

The remaining work belongs to these buckets.

### 2.1 Real Cloud Control Plane Deployment

Required for:

- shared cloud orchestrator
- team memory sync plane
- org-wide audit aggregation
- fleet management plane
- multi-device durable session sync

Expected work:

- provision actual cloud services
- apply deployment manifests
- wire real storage, auth, and health endpoints
- validate sync and failover behavior

### 2.2 Real Temporal + LangGraph Integration

Required for:

- live Temporal workflow orchestration
- live LangGraph runtime integration
- real orchestrator-mode switching between local typed runtime and cloud orchestrator lanes

Expected work:

- deploy real Temporal instance
- wire workflow contracts to live Temporal workers
- attach graph-runtime SPI to a real LangGraph integration
- validate signal/query/checkpoint behavior

### 2.3 Real Enterprise Fleet / SSO / Org Control Plane Integration

Required for:

- enterprise tenant auth
- provider-backed SSO
- org-wide role and claims mapping
- enterprise trust and policy resolution

Expected work:

- configure real Okta / Azure AD / Clerk / OIDC / SAML provider
- validate claims mapping and role resolution
- validate tenant-aware audit and control-plane behavior

### 2.4 Real DeerFlow Backbone Deployment

Required for:

- true DeerFlow worker lane or backbone experiments
- external DeerFlow worker registration
- live health checks and failure recovery

Expected work:

- provision real DeerFlow infrastructure
- attach external workers to the current compatibility boundary
- validate local-backbone fallback behavior

### 2.5 Real OS-Native Isolation Backend Integration

Required for:

- backend-enforced filesystem restriction
- backend-enforced network restriction
- backend-enforced process restriction
- container / VM-backed isolation where needed

Expected work:

- connect real Windows or Linux backend implementation
- validate manifest-to-backend enforcement
- verify actual restriction behavior instead of policy-only simulation

### 2.6 Real Host Validation

Required for:

- macOS accessibility and computer-use validation
- Linux AT-SPI and computer-use validation

Expected work:

- run diagnostics on real host
- run smoke, regression, and E2E validation
- fix platform-specific failures
- update implemented boundaries only after real host verification

### 2.7 Real Self-Hosted Model And TTT Infrastructure

Required for:

- actual baseline and adapted inference runs
- actual test-time adaptation or weight update
- real model-service-backed TTT lane

Expected work:

- attach self-hosted model inference service
- attach adaptation-capable backend
- validate baseline vs adapted behavior on replayable workloads
- keep rollback, budget, and audit enforcement live

## 3. Required Inputs Before GLM-5.1 Should Continue

Do not start live rollout blindly.

Before continuing, the user or environment must provide the relevant subset of:

- cloud deployment target
- Temporal endpoint
- LangGraph runtime or service boundary
- SSO provider credentials and tenant config
- DeerFlow runtime endpoint or worker environment
- OS-native isolation backend implementation or deployable backend target
- macOS and/or Linux host access
- self-hosted model inference endpoint
- TTT-capable model backend

If an input is missing, GLM-5.1 should not pretend the feature can be finished.

## 4. Fixed Rollout Order

When the needed resources become available, work through the remaining items in this exact order.

### 4.1 Real Host Validation First

Before broad cloud expansion, validate the still-blocked host work:

- macOS accessibility and computer-use
- Linux AT-SPI and computer-use

This closes the remaining local platform truth gap.

### 4.2 Real OS-Native Isolation Backend Integration

Next, land the real backend-enforced isolation path so the runtime is not limited to preparation contracts.

### 4.3 Real Self-Hosted Model And TTT Integration

Then land actual model-backed hybrid memory and TTT execution.

### 4.4 Real Cloud / Temporal / LangGraph Rollout

After the above, attach live orchestrator infrastructure.

### 4.5 Real Enterprise Fleet / SSO / Org Control Plane

Then attach enterprise identity and tenant control.

### 4.6 Real DeerFlow Backbone Experiments Or Rollout

Only after the system is otherwise stable should DeerFlow-backed worker lanes move from readiness to live operation.

## 5. Execution Rules

Follow these rules throughout the rollout:

- do not claim a live system exists until the real endpoint is deployed and validated
- do not mark host-specific features implemented without real host verification
- do not replace the current backbone with a new framework before fallback behavior is validated
- keep rollback, audit, and verification active during rollout
- update implemented / partial / not-implemented boundaries honestly

## 6. Required Document Updates

When any live external system becomes real, update the affected documents in the same round.

At minimum, keep these synchronized:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

When relevant, also update:

- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)

## 7. Stop Condition

Only stop when one of these is true:

1. the externally blocked target for the currently supplied infrastructure has been fully deployed and validated
2. a required real credential, endpoint, host, or backend is still missing
3. a real architecture fork requires explicit user choice

## 8. Reporting Format

Every round must report:

1. current live rollout target
2. which real external inputs were available
3. files changed
4. what moved from readiness or partial to implemented
5. what remains blocked and why
6. validation run
7. next live rollout target

## 9. One-Sentence Summary

`This handoff is for the final phase: only continue when real external infrastructure or hosts are available, then turn the prepared boundaries into genuinely deployed, validated systems.`

## 10. Live Rollout Status

### 10.1 Real Host Validation — ✅ Windows Validated with Real Win32 API Calls, ❌ macOS/Linux Blocked

Windows host (10.0.22631.0 x64, 20 cores, 16GB RAM) has been validated with REAL API calls:
- **Windows Job Object: REAL VALIDATED** — CreateJobObjectW, SetInformationJobObject, AssignProcessToJobObject all succeeded
- Memory limits (Job=512MB, Process=256MB) enforced on real process
- Windows Integrity Level: icacls /setintegritylevel requires Administrator elevation — NOT available in current session
- Windows Firewall: New-NetFirewallRule requires Administrator elevation — NOT available in current session
- WSL2 Ubuntu: VHDX mount error — Linux validation not possible
- No macOS host available

Files:
- `packages/shared-runtime/src/live-host-validation.ts`: Real host probing with honest results
- `packages/shared-runtime/src/real-windows-job-object.ts`: Production-ready Job Object enforcement with real validation evidence

### 10.2 Real OS-Native Isolation Backend Integration — ⚠️ Partially Live

- **Windows Job Object: LIVE** — Real enforcement available for guarded_mutation tier (memory limits, process limits)
- Windows Integrity Level: BLOCKED by Administrator elevation requirement
- Windows Firewall: BLOCKED by Administrator elevation requirement
- Docker: BLOCKED (not installed)
- isolated_mutation tier: BLOCKED (Docker required)

### 10.3 Real Self-Hosted Model and TTT Integration — ❌ Blocked

No Ollama or model inference service installed. Cannot proceed.

### 10.4 Real Cloud/Temporal/LangGraph Rollout — ❌ Blocked

No Temporal CLI, no LangGraph runtime, no cloud endpoint. Cannot proceed.

### 10.5 Real Enterprise Fleet/SSO/Org Control Plane — ❌ Blocked

No SSO provider credentials or tenant configuration. Cannot proceed.

### 10.6 Real DeerFlow Backbone Rollout — ❌ Blocked

No DeerFlow infrastructure endpoint. Cannot proceed.

### Required User Inputs to Continue

To proceed beyond the current state, the following real resources are needed:

1. **Administrator elevation** — enables Windows Integrity Level and Firewall enforcement
2. **Docker Desktop installation** — enables container-based isolation for isolated_mutation tier
3. **WSL2 VHDX fix** — enables Linux host validation
4. **Ollama or model inference endpoint** — enables self-hosted model and TTT integration
5. **Temporal server endpoint** — enables Temporal workflow integration
6. **LangGraph runtime** — enables LangGraph graph integration
7. **SSO provider credentials** (Okta/Azure AD/Clerk) — enables enterprise SSO
8. **DeerFlow runtime endpoint** — enables DeerFlow backbone rollout
9. **macOS host access** — enables macOS accessibility and computer-use validation
