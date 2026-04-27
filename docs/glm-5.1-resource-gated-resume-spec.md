# GLM-5.1 Resource-Gated Resume Spec

This document is the final handoff for resuming implementation only when the currently missing real resources become available.

Use it when the goal is:

- resume work only after real blockers are removed
- map each remaining architecture item to its required resource
- continue in a strict resource-driven order instead of guessing or faking readiness

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./glm-5.1-live-external-rollout-spec.md`](./glm-5.1-live-external-rollout-spec.md)
- [`./glm-5.1-privileged-readiness-spec.md`](./glm-5.1-privileged-readiness-spec.md)

When current code and this document differ, code and typed contracts remain authoritative for current behavior.

## 1. Goal

The repository-local implementation and preparation layers are complete enough that further progress now depends on real resources.

The purpose of this document is not to invent more local work.

The purpose is to:

- resume only when a required resource is actually present
- execute the corresponding live integration or validation work immediately
- stop honestly when the required resource is still missing

`Do not continue speculative implementation when the required real resource is not available.`

## 2. Current Blocking Resource Classes

The remaining work is now gated by these resource classes:

- administrator approval or elevated execution
- missing local runtime installations
- missing external service endpoints
- missing credentials or tenant configuration
- missing real host access

## 3. Resource-to-Work Mapping

Resume work only when one or more of the following become available.

### 3.1 Administrator Privileges

When administrator privileges are available, resume:

- Windows Integrity Level execution
- Windows Firewall rule creation
- Hyper-V-backed checks and integrations where applicable
- any other admin-only isolation or service setup path already marked as blocked-by-admin

Expected result:

- move admin-only Windows readiness items from `implemented-preparation` or `blocked` to real validated execution

### 3.2 Local Runtime Installations

When the corresponding runtime is installed, resume:

- Docker Desktop -> container-backed isolation work
- WSL2 -> Linux-side local validation and related runtime flows
- Rust/Cargo -> native Windows API or desktop native build paths still gated by toolchain
- Ollama -> self-hosted model and TTT live inference integration
- Temporal CLI -> Temporal hookup and validation

Expected result:

- convert installation blockers into real integration and verification work

### 3.3 External Endpoints

When real endpoints are provided, resume:

- Temporal endpoint -> workflow orchestration integration
- LangGraph endpoint or runtime -> graph runtime integration
- DeerFlow endpoint -> real DeerFlow worker or backbone experiment
- libSQL/Turso endpoint -> cloud-sync or replicated persistence integration
- OTEL collector endpoint -> real trace export integration
- self-hosted model inference endpoint -> baseline and adapted TTT run integration

Expected result:

- convert readiness boundaries into live endpoint-backed functionality

### 3.4 Credentials And Tenant Configuration

When credentials are provided, resume:

- Okta / Azure AD / Clerk / OIDC / SAML integration
- enterprise tenant claims mapping validation
- org-control-plane auth and trust integration

Expected result:

- convert SSO and org control from readiness-only to real validated integration

### 3.5 Host Access

When host access is provided, resume:

- macOS accessibility and computer-use validation
- Linux AT-SPI and computer-use validation
- host-specific regression, smoke, and E2E runs

Expected result:

- move host-blocked capabilities from `prepared` or `claimed` to real validated status

## 4. Resume Order

When multiple resource classes become available at once, resume in this order.

### 4.1 Real Host Validation

Validate the still-unverified host-specific computer-use paths first.

### 4.2 Real OS-Native Isolation

Then land the admin-only or backend-only isolation work.

### 4.3 Self-Hosted Model And TTT Integration

Then turn the TTT lane from scaffolding into live model-backed execution.

### 4.4 Cloud / Temporal / LangGraph / libSQL / OTEL

Then attach real orchestration, sync, and observability endpoints.

### 4.5 Enterprise SSO / Org Control

Then attach enterprise identity and tenant-aware auth.

### 4.6 DeerFlow Live Worker Integration

Only after the above is stable should live DeerFlow-backed lanes be rolled out.

## 5. Execution Rules

Follow these rules throughout resumed execution:

- do not continue a resource-gated area without the actual resource
- do not mark anything live unless the real endpoint, host, or privilege path was validated
- do not replace the current local backbone prematurely
- keep rollback, audit, and verification active
- keep implemented / partial / blocked boundaries honest

## 6. Required Document Updates

When a blocked area becomes live, update the affected documents in the same round.

At minimum, keep these synchronized:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)

When relevant, also update:

- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

## 7. Stop Condition

Only stop when one of these is true:

1. the currently supplied resource-backed target has been fully integrated and validated
2. the next remaining step needs another real resource that is still missing
3. a real architecture fork requires explicit user choice

## 8. Reporting Format

Every resumed round must report:

1. which real resource became available
2. which blocked area is now being resumed
3. files changed
4. what moved from blocked or preparation-only to implemented
5. what remains blocked and why
6. validation run
7. next resource-gated target

## 9. One-Sentence Summary

`This handoff resumes work only when real admin privileges, installations, endpoints, credentials, or host access are actually present, and maps each newly available resource to the exact blocked architecture area it unlocks.`
