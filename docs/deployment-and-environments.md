# Deployment and Environments

This document explains how Apex should be deployed across local, team, and enterprise environments.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./data-model.md`](./data-model.md)

## 1. Purpose

The product is designed as:

- local-first
- cloud-augmented
- deployable across personal, team, and enterprise modes

This document defines the recommended environment model and deployment progression.

## 2. Deployment Modes

### 2.1 Personal Mode

Characteristics:

- single machine
- local control plane
- desktop shell
- local persistence
- no required cloud dependency

Best for:

- developers
- researchers
- power users

### 2.2 Team Mode

Characteristics:

- local desktop clients
- shared cloud control plane
- shared approvals
- shared memory and playbook distribution
- central audit aggregation

Best for:

- small product teams
- engineering teams
- operations groups

### 2.3 Enterprise Mode

Characteristics:

- centrally governed cloud control plane
- org-wide policy
- SSO
- device and fleet controls
- compliance exports
- stronger approval and audit models

Best for:

- regulated environments
- multiple departments
- managed fleets

## 3. Local Runtime Components

The local environment should contain:

- desktop shell
- local control plane
- local persistence
- local tool adapters
- local worker runtime

This is the minimum footprint for real machine control.

## 4. Cloud Runtime Components

The cloud environment should contain only what truly benefits from centralization.

Recommended cloud components:

- orchestration
- approval services
- shared memory and playbook registry
- organization policy
- audit aggregation
- model routing
- long-running execution coordination

## 5. Environment Separation

At minimum, deployments should distinguish:

- local development
- shared development
- staging
- production

### 5.1 Local Development

Purpose:

- rapid iteration
- local runtime debugging
- UI and adapter development

### 5.2 Shared Development

Purpose:

- integration testing
- contract verification
- early multi-user behavior

### 5.3 Staging

Purpose:

- release candidate validation
- production-like config validation
- approval and audit path verification

### 5.4 Production

Purpose:

- trusted user and organization workloads

## 6. Best-Practice Deployment Rules

- keep the local control plane installable without cloud dependency
- keep cloud services optional for personal mode
- isolate secrets by environment
- separate local operational state from shared organizational state
- do not require local machine authority for cloud-only services
- do not require cloud connectivity for basic local desktop operation

## 7. Persistence by Environment

Recommended baseline:

- local desktop runtime
  - local embedded database
- cloud control plane
  - durable transactional database
- large artifacts
  - object storage

This keeps local latency low and cloud governance durable.

## 7.1 Desktop Companion Process Strategy

The desktop shell should treat the local control plane as a supervised companion process rather than an invisible side effect.

Best-practice launch order:

1. explicit environment-provided command
2. development-supervised local npm workflow
3. packaged local companion resource
4. built local companion entry

Best-practice runtime behavior:

- persist stdout and stderr into the local desktop root
- expose launch target, current mode, and last exit in the UI
- allow guarded restart and stop actions
- rotate companion logs before they grow unbounded
- auto-restart only bounded node-based companion modes with visible retry state
- keep production strategy separate from browser-preview behavior
- avoid requiring a system-wide service install for local-first operation
- keep local request rate limiting and backpressure at the control-plane edge so desktop automation does not self-overwhelm
- prefer bounded retries plus explicit degraded mode over silent infinite retry loops

Best-practice packaging behavior:

- prepare the desktop frontend and bundled local-control-plane companion before Rust packaging
- prepare a portable Node runtime so packaged local control plane execution is not dependent on a machine-level Node install
- keep the bundled companion under desktop resources, not in source directories that should be edited by hand
- allow an explicit Node executable override for packaged deployments that manage their own runtime path
- keep signed and unsigned release flows separate so local validation does not require production certificates
- keep runtime resilience policy in product code rather than relying on installer-specific service managers for basic recovery

Recommended Windows release flow:

1. prepare frontend assets
2. prepare bundled companion resources
3. prepare bundled portable Node runtime
4. produce a portable release first so the primary desktop release path is independent of installer-tool downloads
5. run unsigned portable validation locally when needed
6. run signed release creation only when signing credentials are present
7. add NSIS or MSI installers only when that channel is explicitly required
8. stage release outputs into a deterministic local release directory for inspection and handoff

## 8. Configuration Strategy

Configuration should be layered:

1. build-time defaults
2. environment configuration
3. per-machine local settings
4. organization policy overlays

This prevents environment-specific hacks from leaking into product logic.

### 8.1 Desktop Toolchain Placement

For Windows desktop development and validation, the local toolchain should prefer a dedicated non-system path such as:

- `D:\apex-localdev`

That directory should hold:

- Rust toolchains
- Cargo target output
- npm cache
- Playwright browser assets
- temporary desktop build files

This keeps desktop validation from exhausting a nearly full `C:` drive and makes local cleanup predictable.

### 8.2 Slow-Network Cargo Defaults

Desktop Rust/Tauri workflows should assume that crate downloads may be the slowest part of setup.

Best-practice defaults:

- use the `crates.io` sparse protocol
- increase Cargo retry count
- increase HTTP timeout
- disable HTTP multiplexing when links are unstable
- expose a dedicated `cargo fetch` or equivalent prefetch step before full desktop builds

If the default `crates.io` path remains unreliable in a specific network, the registry index should be overrideable through environment configuration rather than hard-coding a region-specific mirror into product logic.

Recommended override pattern:

- keep the product default on the official sparse index
- allow a local preset such as `APEX_CARGO_MIRROR=rsproxy`
- allow a fully explicit sparse registry override through `APEX_CARGO_INDEX_URL`
- write those overrides only into the local desktop Cargo home, not into global machine-wide Rust configuration

## 9. Security Guidance

Deployment safety depends on keeping local and cloud boundaries clear.

Best-practice rules:

- local machine permissions should remain explicit
- cloud services should never assume blanket local authority
- shared services should not require unnecessary device reach
- environment secrets should be rotated and scoped
- degraded mode, circuit-open state, and security-triggered rejection should remain visible to operators instead of being hidden behind generic failure messages

## 10. Rollout Guidance

Recommended rollout order:

1. personal mode local-first baseline
2. team mode cloud augmentation
3. enterprise controls and fleet governance

This reduces complexity while preserving the intended final architecture.

## 11. Summary

The deployment model should preserve the product's local-first nature while adding cloud services only where shared control and durability genuinely help.

In one sentence:

`Apex should deploy locally for machine control and centrally only for governance, collaboration, and durable orchestration.`
