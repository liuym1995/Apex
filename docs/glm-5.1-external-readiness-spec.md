# GLM-5.1 External Readiness Spec

This document is the handoff for the remaining work that is still worth doing after the locally-feasible runtime roadmap has been completed, but before real external infrastructure is available.

Use it when the goal is:

- continue making progress without pretending blocked infrastructure already exists
- land all remaining repository-local preparation layers for the externally blocked architecture
- reduce future integration cost for cloud, SSO, real DeerFlow backbone, and OS-native isolation

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

When current code and this document differ, code and typed contracts remain authoritative for current behavior.

## 1. Goal

The local-first implementation line is now largely complete.

The next valuable work is not to fake live cloud systems.

It is to finish the repository-local readiness layers for the still-blocked target areas, so that future integration becomes predictable, typed, auditable, and cheaper.

`Do not stop after one area. Continue until every in-scope preparation layer here is landed or only real external deployment work remains.`

## 2. What Is Actually Blocked

The following items still require real external infrastructure, real unavailable hosts, or both:

- cloud control plane
- Temporal orchestration layer
- LangGraph 2.x orchestration layer
- enterprise fleet / SSO / org control plane
- real DeerFlow production backbone
- gRPC MCP execution against real external servers
- OS-native ACL / chroot / container / VM isolation backends
- macOS real-host validation
- Linux real-host validation
- self-hosted model inference and real test-time weight update services

## 3. What Is Still Doable Now

Even though the live systems above are blocked, these preparation layers are still fully worth implementing now:

- typed contracts
- adapter boundaries
- provider registries
- env/config schemas
- deployment manifests
- bootstrap scripts
- health checks
- diagnostics
- runbooks
- replay or simulation harnesses
- desktop/control-plane visibility for future external backends

## 4. Fixed Execution Order

Work through the remaining externally-blocked preparation work in this exact order.

### 4.1 First: Cloud Control Plane Readiness Layer

Do not build a fake live cloud control plane.

Instead, land:

- cloud-control-plane-facing contract boundaries
- sync envelope and replication contracts
- org audit aggregation contract shapes
- multi-device durable session sync contract boundaries
- control-plane config and environment schemas
- health and readiness endpoint contracts
- bootstrap manifests and runbooks

The output should be a repository that is ready to attach a real cloud service later without rewriting local contracts.

### 4.2 Second: Temporal + LangGraph Boundary Preparation

Do not install or pretend to run live Temporal or LangGraph if the real environment is not available.

Instead, land:

- adapter boundaries for future workflow-orchestrator integration
- temporal-facing workflow contract shapes
- graph-runtime SPI boundary contracts
- translation hooks between current typed runtime and future cloud orchestrator routes
- configuration schema for orchestrator mode selection
- local simulation or dry-run harnesses for those contracts

The key rule:

- keep current local typed runtime as the active backbone
- prepare future orchestrator attachment cleanly

### 4.3 Third: Enterprise Fleet / SSO / Org Control Plane Readiness

Do not fake a real identity provider or org control plane.

Instead, land:

- explicit auth/provider abstraction boundaries
- org, team, user, role, and tenant contract shapes
- SSO provider registry or adapter boundary
- claims-to-policy mapping contracts
- audit, trust, and role-resolution preparation layers
- environment schema and runbooks for future Okta / Azure AD / Clerk style integration

This should make enterprise integration a bounded extension instead of a repo-wide refactor later.

### 4.4 Fourth: Real DeerFlow Backbone Readiness Boundary

Current repo should still not replace its runtime backbone with DeerFlow.

But the next valuable preparation work is:

- stronger compatibility contracts for future DeerFlow deployment
- runtime-mode configuration between local backbone and optional DeerFlow-backed worker lanes
- clearer launch, translation, and health-check semantics
- future external DeerFlow worker registration shapes
- runbooks and diagnostics for future backbone experiments

This should remain a compatibility and readiness layer, not a backbone swap.

### 4.5 Fifth: OS-Native Isolation Backend Readiness

Do not claim live ACL/chroot/container/VM isolation if it is not actually present.

Instead, land:

- backend interface for future OS-native isolation drivers
- backend capability detection contracts
- policy-to-backend translation layer
- manifest translation to backend-specific capability requests
- diagnostics and backend readiness reporting
- Windows-oriented preparation for future OS-native enforcement
- runbooks for later container / VM / OS-native backend hookup

This is the cleanest way to make the current rule-based sandboxing evolve into real backend-enforced isolation later.

### 4.6 Sixth: External-Readiness Verification Suite

Once the preparation layers above are in place, make them testable.

Target outcomes:

- regression coverage for new contracts and adapter boundaries
- config schema validation tests
- readiness diagnostics tests
- bootstrap/runbook consistency checks where practical
- dry-run or simulation harnesses for cloud/orchestrator/SSO/backend attachment

This should validate all repository-local preparation work without pretending live infrastructure exists.

## 5. Required Document Updates

When any sub-area above changes behavior, update the affected documents in the same round.

At minimum, keep these synchronized:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./runtime-improvements-roadmap.md`](./runtime-improvements-roadmap.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

When relevant, also update:

- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./skill-compatibility.md`](./skill-compatibility.md)

## 6. Execution Rules

Follow these rules throughout the handoff:

- do not mark external systems as implemented unless they are truly live
- do not build fake cloud systems and call them production-ready
- do not replace the current local backbone with LangGraph or DeerFlow
- do not collapse cloud-prep work and local runtime work into one monolith
- prefer adapter boundaries, manifests, diagnostics, and runbooks over placeholder-only prose
- keep implemented / partial / not-implemented boundaries honest

## 7. Stop Condition

Only stop when one of these is true:

1. every in-scope readiness layer in this document has been implemented
2. the only remaining work is real external deployment or real unavailable host validation
3. a real architecture fork requires explicit user choice

Do not stop merely because one ordered section is complete.

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

`This handoff finishes the last still-doable repo-local work by implementing the preparation layers for cloud control, Temporal/LangGraph attachment, enterprise SSO, real DeerFlow deployment, OS-native isolation backends, and their verification suite, without pretending the blocked infrastructure already exists.`

## 10. Implementation Status

All six in-scope readiness layers have been implemented:

### 10.1 Cloud Control Plane Readiness Layer — ✅ Implemented

Files:
- `packages/shared-types/src/index.ts`: Added CloudSyncEnvelopeSchema, CloudControlPlaneConfigSchema
- `packages/shared-state/src/index.ts`: Added cloudSyncEnvelopes, cloudControlPlaneConfigs stores
- `packages/shared-runtime/src/cloud-control-plane-readiness.ts`: New module with createCloudControlPlaneConfig, prepareSyncEnvelope, simulateSyncSend, getCloudReadinessDiagnostics, getOrgAuditAggregationContract, getMultiDeviceSessionSyncContract, getCloudHealthEndpointContracts, getBootstrapManifest

### 10.2 Temporal + LangGraph Boundary Preparation — ✅ Implemented

Files:
- `packages/shared-types/src/index.ts`: Added OrchestratorModeSchema, OrchestratorBoundaryConfigSchema, WorkflowContractShapeSchema
- `packages/shared-state/src/index.ts`: Added orchestratorBoundaryConfigs, workflowContractShapes stores
- `packages/shared-runtime/src/temporal-langgraph-boundary.ts`: New module with createOrchestratorBoundaryConfig, registerWorkflowContractShape, translateLocalRuntimeToWorkflowContract, translateWorkflowResultToLocalRuntime, dryRunOrchestratorWorkflow, getOrchestratorReadinessDiagnostics, initializeDefaultWorkflowContractShapes

### 10.3 Enterprise Fleet/SSO/Org Control Plane Readiness — ✅ Implemented

Files:
- `packages/shared-types/src/index.ts`: Added SSOProviderKindSchema, SSOProviderBoundarySchema, OrgTenantSchema, ClaimsToPolicyMappingSchema
- `packages/shared-state/src/index.ts`: Added ssoProviderBoundaries, orgTenants, claimsToPolicyMappings stores
- `packages/shared-runtime/src/enterprise-sso-readiness.ts`: New module with registerSSOProviderBoundary, createOrgTenant, createClaimsToPolicyMapping, resolveClaimsToPolicy, getEnterpriseReadinessDiagnostics, initializeDefaultSSOProviderBoundaries, getSSOIntegrationRunbook

### 10.4 Real DeerFlow Backbone Readiness Boundary — ✅ Implemented

Files:
- `packages/shared-types/src/index.ts`: Added DeerFlowRuntimeModeSchema, DeerFlowBackboneReadinessSchema
- `packages/shared-state/src/index.ts`: Added deerFlowBackboneReadiness store
- `packages/shared-runtime/src/deerflow-backbone-readiness.ts`: New module with createDeerFlowBackboneReadiness, configureDeerFlowRuntimeMode, registerExternalDeerFlowWorker, simulateDeerFlowHealthCheck, getDeerFlowBackboneReadinessDiagnostics, getDeerFlowDeploymentRunbook

### 10.5 OS-Native Isolation Backend Readiness — ✅ Implemented

Files:
- `packages/shared-types/src/index.ts`: Added OSIsolationBackendKindSchema, OSIsolationBackendSchema, IsolationPolicyToBackendMappingSchema
- `packages/shared-state/src/index.ts`: Added osIsolationBackends, isolationPolicyToBackendMappings stores
- `packages/shared-runtime/src/os-isolation-readiness.ts`: New module with registerOSIsolationBackend, detectOSIsolationCapabilities, createIsolationPolicyToBackendMapping, translateSandboxTierToBackendCapabilities, getOSIsolationReadinessDiagnostics, initializeDefaultOSIsolationBackends, getOSIsolationRunbook

### 10.6 External-Readiness Verification Suite — ✅ Implemented

Files:
- `packages/shared-runtime/src/external-readiness-verification.ts`: New module with runCloudControlPlaneReadinessSuite (8 tests), runTemporalLangGraphReadinessSuite (9 tests), runEnterpriseSSOReadinessSuite (8 tests), runDeerFlowBackboneReadinessSuite (6 tests), runOSIsolationReadinessSuite (7 tests), getExternalReadinessStatusReport, runAllExternalReadinessSuites

### Verification

- TypeScript typecheck passes for shared-types, shared-state, and shared-runtime packages
- All readiness layers correctly report their status as "contracts_only" or "adapter_boundary" — none falsely claim to be live systems
- Each layer includes diagnostics, runbooks, and blocking dependency lists
