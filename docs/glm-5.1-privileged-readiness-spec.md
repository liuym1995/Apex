# GLM-5.1 Privileged Readiness Spec

This document is the handoff for the final repository-local work that is still worth doing after:

- the local-first implementation is complete
- the external-readiness preparation layers are complete
- live external rollout has progressed as far as the currently available non-admin resources allow

Use it when the goal is:

- keep making progress even when the remaining blockers are mostly admin privileges, missing local runtimes, or missing external endpoints
- land the last useful preparation layers before true privileged execution or live external hookup
- reduce future human setup time and integration friction

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./glm-5.1-live-external-rollout-spec.md`](./glm-5.1-live-external-rollout-spec.md)

When current code and this document differ, code and typed contracts remain authoritative for current behavior.

## 1. Goal

The remaining work is now mostly blocked by:

- missing administrator privileges
- missing local infrastructure such as Docker, WSL2, Ollama, Rust/Cargo, Temporal CLI
- missing real cloud or service endpoints
- missing provider credentials

The best remaining repository-local work is therefore:

- privileged-execution preparation
- install and environment bootstrap automation
- capability verification and blocker reporting
- endpoint and credential onboarding boundaries

`Do not stop after one item. Continue until every in-scope preparation item is landed or only true admin/external resource provisioning remains.`

## 2. What Remains Truly Blocked

These still require real external inputs or real privilege elevation:

- administrator-approved Windows Integrity Level execution
- administrator-approved Windows Firewall rule creation
- Docker-backed container isolation
- WSL2 Linux validation after the host issue is fixed
- real Ollama or self-hosted inference service
- real Temporal endpoint
- real LangGraph runtime or endpoint
- real SSO credentials
- real DeerFlow endpoint
- real macOS or Linux host access

Do not pretend those are finished.

## 3. What Is Still Worth Implementing Now

Even without those resources, these final preparation layers are still valuable:

- admin-ready execution wrappers
- capability acquisition scripts and bootstrap helpers
- machine-readable blocker diagnostics
- install and setup verification commands
- endpoint onboarding config validators
- privileged-run runbooks and dry-run flows
- desktop or control-plane visibility for blocked-vs-ready states

## 4. Fixed Execution Order

Work through the remaining preparation work in this exact order.

### 4.1 First: Windows Privileged-Execution Readiness

Target outcomes:

- explicit privileged-operation contract for:
  - Integrity Level changes
  - Firewall rule changes
  - Hyper-V checks
  - any future admin-only sandbox backends
- admin-required operation registry with reason, expected command, and rollback notes
- elevation-aware dry-run mode
- readiness diagnostics that distinguish:
  - not supported
  - supported but blocked by missing admin
  - supported and ready
- privileged-run runbook generation for operators

This should not silently attempt elevation.
It should prepare the path clearly and safely.

### 4.2 Second: Local Runtime Acquisition And Bootstrap Automation

Target outcomes:

- machine-readable diagnostics and bootstrap helpers for:
  - Docker Desktop
  - WSL2
  - Rust/Cargo
  - Ollama
  - Temporal CLI
- install-state detection with precise blocker reasons
- optional bootstrap script generation or step plans
- post-install verification routines
- stable local environment report export

This should make missing local prerequisites obvious and faster to resolve.

### 4.3 Third: Endpoint And Credential Onboarding Boundaries

Target outcomes:

- typed config validators for:
  - Temporal endpoint
  - LangGraph endpoint or runtime boundary
  - SSO provider config
  - DeerFlow endpoint
  - model inference endpoint
- env-schema validation and redaction-safe diagnostics
- connectivity preflight checks
- "configured but unreachable" vs "not configured" vs "ready" distinctions
- onboarding runbooks and expected secret inventory

This turns future live rollout into a bounded setup workflow instead of ad-hoc debugging.

### 4.4 Fourth: Blocker Dashboard And Exportable Readiness Matrix

Target outcomes:

- unified readiness matrix for:
  - admin-only backends
  - local prerequisites
  - external endpoints
  - host availability
- exportable machine-readable status artifact
- desktop/control-plane surface for current blockers, readiness level, and next human action
- grouping by:
  - ready now
  - needs admin
  - needs install
  - needs credential
  - needs external endpoint
  - needs unavailable host

This gives the operator a single place to see what is blocking the final architecture.

### 4.5 Fifth: Final Privileged-Readiness Verification Suite

Target outcomes:

- regression coverage for privileged-operation contracts
- regression coverage for installer/bootstrap diagnostics
- config validation tests for endpoints and credentials
- readiness matrix tests
- dry-run and report-generation tests

This should validate all repository-local work in this phase without pretending the blocked resources are present.

## 5. Required Document Updates

When any sub-area above changes behavior, update the affected documents in the same round.

At minimum, keep these synchronized:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)

When relevant, also update:

- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

## 6. Execution Rules

Follow these rules throughout the handoff:

- do not silently elevate privileges
- do not pretend a missing install or endpoint is configured
- do not mark admin-only features implemented unless real privileged execution was validated
- prefer explicit diagnostics, runbooks, and dry-run behavior over hidden assumptions
- keep implemented / partial / not-implemented boundaries honest

## 7. Stop Condition

Only stop when one of these is true:

1. every in-scope preparation item in this document has been implemented
2. the only remaining work requires actual admin approval, actual installation, actual credentials, actual endpoints, or actual host access
3. a real architecture fork requires explicit user choice

## 8. Reporting Format

Every round must report:

1. current target
2. why it is the highest remaining priority
3. files changed
4. what moved from partial to implemented-preparation
5. what remains blocked and why
6. verification run
7. next target

## 9. One-Sentence Summary

`This handoff finishes the last useful repo-local work before true admin and external rollout by adding privileged-execution preparation, install/bootstrap automation, endpoint onboarding validation, blocker visibility, and their verification suite.`

## 10. Completion Status

All five preparation layers have been implemented in the repository:

### 8.1 Windows Privileged-Execution Readiness — ✅ COMPLETE

- `privileged-execution-readiness.ts`: PrivilegedOperationContract, AdminOperationRegistryEntry, ElevationDryRunResult, PrivilegedRunRunbook, PrivilegedReadinessDiagnostics
- 8 default privileged operation contracts registered
- 4 admin operation registry entries with alternative approaches
- Elevation-aware dry-run mode with warnings and readiness_after assessment
- Operator runbook generation with rollback plans

### 8.2 Local Runtime Acquisition And Bootstrap Automation — ✅ COMPLETE

- `local-runtime-bootstrap.ts`: RuntimeDiagnostics, BootstrapPlan, PostInstallVerification, LocalEnvironmentReport
- 9 runtime kinds with install-state detection and blocker reasons
- Per-runtime bootstrap plans with step-by-step commands and verification
- Post-install verification routines
- Local environment report export

### 8.3 Endpoint And Credential Onboarding Boundaries — ✅ COMPLETE

- `endpoint-onboarding.ts`: EndpointConfig, CredentialInventory, ConnectivityPreflightResult, OnboardingRunbook
- 7 endpoint kinds with typed config validators and env-schema validation
- Connectivity preflight checks with recommendations
- Per-endpoint credential inventory tracking
- Per-endpoint onboarding runbooks with troubleshooting

### 8.4 Blocker Dashboard And Exportable Readiness Matrix — ✅ COMPLETE

- `blocker-dashboard.ts`: ReadinessMatrix, ReadinessMatrixEntry, ReadinessStatusArtifact, BlockerDashboardState
- Unified readiness matrix aggregating 4 source layers
- 6 blocker categories with impact levels and remediation
- Exportable status artifact (JSON/Markdown/CSV) with checksum
- Desktop workspace panels: blocker_dashboard, privileged_execution, readiness_matrix

### 8.5 Final Privileged-Readiness Verification Suite — ✅ COMPLETE

- `privileged-readiness-verification.ts`: 5 regression suites with 51 total tests
- Privileged operation contract suite (8 tests)
- Installer/bootstrap diagnostics suite (12 tests)
- Config validation suite (12 tests)
- Readiness matrix suite (10 tests)
- Dry-run/report generation suite (9 tests)

### What Remains Blocked

The following items require real admin approval, real installation, real credentials, real endpoints, or real host access:

1. **Administrator elevation**: Integrity Level, Firewall, Hyper-V, Process Token, Service Installation, Registry HKLM write — all require running as Administrator
2. **Docker Desktop**: Not installed — required for container-based isolation
3. **WSL2**: Not installed — required for Linux host validation
4. **Ollama**: Not installed — required for self-hosted model inference
5. **Temporal CLI**: Not installed — required for workflow orchestration
6. **Rust/Cargo**: Not installed — required for Tauri desktop shell
7. **All external endpoints**: Temporal, LangGraph, SSO, DeerFlow, libSQL, OTEL Collector — not configured
8. **macOS host**: Not available — required for accessibility validation
9. **Linux host**: Not available — required for AT-SPI and cgroups validation
