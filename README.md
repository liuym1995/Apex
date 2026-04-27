# Apex Platform

Monorepo baseline for the Apex universal agent desktop.

## Documentation boundary

- `master_plan.md` is the final target architecture document
- `docs/best-practice-reset-plan.md` is the stricter reset plan for the parts of the target architecture that should be upgraded to current best practice without preserving backward compatibility
- `docs/architecture-constitution.md` is the mandatory rulebook for every future human contributor and agent
- `docs/architecture-document-system.md` is the authority and consistency map for the architecture document set
- `docs/external-pattern-adoption.md` explains exactly how external best practices should be absorbed into the architecture
- this `README.md` is the fastest summary of what is actually implemented in the current repository
- the focused contract and model details live in:
  - `docs/api-contracts.md`
  - `docs/data-model.md`
  - `docs/runtime-improvements-roadmap.md`

Important clarification:

- the repository currently does not include a real `LangGraph` dependency or a live `LangGraph 2.x` orchestration implementation
- `LangGraph` is still a planned future cloud-orchestrator option in the target architecture, not a framework already wired into the local runtime
- the current implementation is driven by the typed runtime and control-plane layers inside:
  - `packages/shared-runtime`
  - `packages/shared-local-core`
  - `apps/local-control-plane`
  - `apps/desktop-shell`

## Current scope

- shared contracts and typed domain models
- shared runtime for planning, execution, verification, reconciliation, done gate, memory capture, skill candidate generation, and capability discovery
- shared local core for desktop-first tasks, permissions, capability resolution, and workspace aggregation
- SQLite-backed local state adapter for task, audit, artifact, memory, schedule, and worker persistence
- first-pass real local tool adapters for:
  - read-only directory listing
  - read-only file access
  - confirmation-gated local file writes with backup artifact capture
  - confirmation-gated exact-match file patching for safer local edits
  - confirmed read-only shell execution
  - low-risk browser snapshots for QA and validation tasks
  - reusable browser sessions with audited navigation history
  - confirmation-gated IDE workspace summaries for engineering context gathering, including package and tsconfig context
- initial Tauri desktop-shell scaffold with a configurable local control plane API base and browser-compatible frontend runtime abstraction
- initial Tauri desktop-shell command bridge for desktop context discovery and dev-only local control plane supervision, including start/stop/restart lifecycle controls
- runnable apps and services for:
  - desktop shell
  - local control plane
  - gateway
  - workflow
  - manager
  - verification
  - memory
  - audit/cost
  - tool gateway
  - worker adapter
- initial SQL migration for the MVP persistence model
- smoke test that validates a full task lifecycle
- inbox summary, filtering, acknowledgement, and resolution for policy follow-ups and future operational alerts
- opt-in desktop notifications for priority inbox items, with local de-duplication so the same alert is not surfaced repeatedly
- hybrid desktop notifications: browser notifications remain the click-through path when available, while the Tauri shell now has a native notification fallback for runtimes where browser notifications are unavailable
- unified desktop deep links for tasks, inbox items, policy follow-ups, policy proposals, execution templates, and learned playbooks, including copyable workspace links and focus-on-open behavior
- a desktop navigation event feed so startup deep links, pending deep links, notifications, and manual focus actions all become visible entry events instead of hidden jumps
- Tauri system-originated entry events now also flow into that feed, so startup arguments and single-instance handoff events can be inspected alongside browser-side focus actions
- the desktop event feed now supports source filtering and per-event replay/copy actions, so operators can audit or re-enter a target flow without reconstructing the original entry path by hand
- the desktop event center now also supports target-kind filtering and grouped counts for `task / inbox / policy / reuse`, so execution-template and learned-playbook navigation can be inspected separately from task routing
- the desktop event center now also breaks `reuse` navigation into `execution template / learned playbook`, with lightweight risk signals when operators repeatedly reopen the same reuse target instead of progressing through the task
- repeated reuse-detail risks can now enter the same governance path as desktop handoff risks, but they are classified separately as `reuse_navigation` so alerts, follow-ups, and execution templates stay semantically accurate
- the desktop event center now also exposes retention policy, time-range filtering, and lightweight risk summaries for repeated or system-dominated entry patterns
- control-plane-generated deep links so notifications, copied links, and future external launch paths share one protocol source
- Tauri startup deep-link handoff so the desktop shell can boot directly into a task, inbox item, follow-up, or proposal target

## Canonical document

- Final architecture and product plan: [`master_plan.md`](./master_plan.md)
- Best-practice architecture reset plan: [`docs/best-practice-reset-plan.md`](./docs/best-practice-reset-plan.md)
- Architecture constitution: [`docs/architecture-constitution.md`](./docs/architecture-constitution.md)
- Architecture document system: [`docs/architecture-document-system.md`](./docs/architecture-document-system.md)
- External pattern adoption guide: [`docs/external-pattern-adoption.md`](./docs/external-pattern-adoption.md)
- GLM-5.1 architecture execution spec: [`docs/glm-5.1-architecture-execution-spec.md`](./docs/glm-5.1-architecture-execution-spec.md)
- GLM-5.1 remaining-priority execution spec: [`docs/glm-5.1-remaining-priority-execution-spec.md`](./docs/glm-5.1-remaining-priority-execution-spec.md)
- GLM-5.1 computer-use completion spec: [`docs/glm-5.1-computer-use-completion-spec.md`](./docs/glm-5.1-computer-use-completion-spec.md)
- GLM-5.1 computer-use final blocker spec: [`docs/glm-5.1-computer-use-final-blocker-spec.md`](./docs/glm-5.1-computer-use-final-blocker-spec.md)
- GLM-5.1 computer-use last-mile spec: [`docs/glm-5.1-computer-use-last-mile-spec.md`](./docs/glm-5.1-computer-use-last-mile-spec.md)
- GLM-5.1 computer-use host parity spec: [`docs/glm-5.1-computer-use-host-parity-spec.md`](./docs/glm-5.1-computer-use-host-parity-spec.md)
- GLM-5.1 computer-use host validation spec: [`docs/glm-5.1-computer-use-host-validation-spec.md`](./docs/glm-5.1-computer-use-host-validation-spec.md)
- GLM-5.1 local remaining execution spec: [`docs/glm-5.1-local-remaining-execution-spec.md`](./docs/glm-5.1-local-remaining-execution-spec.md)
- GLM-5.1 hybrid memory + In-Place TTT spec: [`docs/glm-5.1-hybrid-memory-ttt-spec.md`](./docs/glm-5.1-hybrid-memory-ttt-spec.md)
- GLM-5.1 post-local remaining spec: [`docs/glm-5.1-post-local-remaining-spec.md`](./docs/glm-5.1-post-local-remaining-spec.md)
- GLM-5.1 final local feasible spec: [`docs/glm-5.1-final-local-feasible-spec.md`](./docs/glm-5.1-final-local-feasible-spec.md)
- GLM-5.1 external readiness spec: [`docs/glm-5.1-external-readiness-spec.md`](./docs/glm-5.1-external-readiness-spec.md)
- GLM-5.1 live external rollout spec: [`docs/glm-5.1-live-external-rollout-spec.md`](./docs/glm-5.1-live-external-rollout-spec.md)
- GLM-5.1 privileged readiness spec: [`docs/glm-5.1-privileged-readiness-spec.md`](./docs/glm-5.1-privileged-readiness-spec.md)
- GLM-5.1 resource-gated resume spec: [`docs/glm-5.1-resource-gated-resume-spec.md`](./docs/glm-5.1-resource-gated-resume-spec.md)
- Computer Use Runtime guide: [`docs/computer-use-runtime.md`](./docs/computer-use-runtime.md)
- Current implementation status map: [`docs/current-architecture-status.md`](./docs/current-architecture-status.md)
- Documentation index: [`docs/index.md`](./docs/index.md)
- Reuse, learning, and fast-path planning details: [`docs/reuse-and-learning.md`](./docs/reuse-and-learning.md)
- Verification and completion details: [`docs/verification-and-completion.md`](./docs/verification-and-completion.md)
- Local permission and tooling details: [`docs/local-permission-and-tooling.md`](./docs/local-permission-and-tooling.md)
- Desktop workspace UI details: [`docs/desktop-workspace-ui.md`](./docs/desktop-workspace-ui.md)
- Capability discovery and reuse details: [`docs/capability-discovery-and-reuse.md`](./docs/capability-discovery-and-reuse.md)
- Task lifecycle and interruption details: [`docs/task-lifecycle-and-interruption.md`](./docs/task-lifecycle-and-interruption.md)
- API contracts: [`docs/api-contracts.md`](./docs/api-contracts.md)
- Data model details: [`docs/data-model.md`](./docs/data-model.md)
- Deployment and environments: [`docs/deployment-and-environments.md`](./docs/deployment-and-environments.md)
- Observability and operations: [`docs/observability-and-operations.md`](./docs/observability-and-operations.md)
- Runtime improvements roadmap: [`docs/runtime-improvements-roadmap.md`](./docs/runtime-improvements-roadmap.md)

## Getting started

1. `npm install`
2. `npm run check`
3. `npm run smoke`
4. Start the local control plane with `npm run dev:local`
5. Start the desktop shell with `npm run dev:desktop`

For Windows desktop development with a full D-drive local toolchain:

1. `npm run setup:rust:local`
2. `npm run setup:node:portable`
3. `npm run setup:playwright:local` (optional when the Edge channel fallback is sufficient)
4. `npm run generate:desktop-icons`
5. `npm run tauri:fetch`
6. `npm run tauri:info`
7. `npm run tauri:dev`

By default, these scripts now use `D:\apex-localdev` so Rust, Cargo targets, temp files, npm cache, and Playwright assets stay off a nearly full `C:` drive.
They also force a more reliable Rust network profile for slow or unstable links:

- `crates.io` sparse protocol
- longer HTTP timeout
- higher retry count
- HTTP multiplexing disabled

If the default `crates.io` path is still too slow in your network environment, you can point Cargo at a different sparse index by setting `APEX_CARGO_INDEX_URL` before running the desktop commands.
For convenience, you can also enable the built-in `rsproxy` preset:

- PowerShell: `$env:APEX_CARGO_MIRROR='rsproxy'; npm run tauri:fetch`
- CMD: `set APEX_CARGO_MIRROR=rsproxy && npm run tauri:fetch`

The preset only affects the desktop Cargo home under `D:\apex-localdev`; it does not rewrite your global Rust configuration.
Portable Node preparation now also prefers the existing local runtime and checksum manifest when they are already available, so repeat desktop builds do not depend on fresh network access unless a new runtime needs to be downloaded.

Desktop companion launch now follows a layered strategy:

1. `APEX_LOCAL_CONTROL_PLANE_COMMAND`
2. development-mode supervised `npm run dev -w @apex/local-control-plane`
3. packaged resource companion via `src-tauri/resources/local-control-plane/index.cjs`
4. built repo companion via `node apps/local-control-plane/dist/.../index.js`

The Tauri shell now records companion stdout and stderr into `D:\apex-localdev\logs` and surfaces recent log lines in the desktop workspace.
Production-oriented Tauri builds now also prepare:

- a bundled local-control-plane companion resource
- a portable Node runtime under `src-tauri/resources/node`

The default release flow prefers the bundled portable Node runtime, while still allowing `APEX_NODE_EXECUTABLE` to override the runtime path when enterprise packaging wants a different managed Node binary.

Signed desktop releases now follow a single scripted path:

- use `npm run tauri:release` for normal release builds
- use `npm run tauri:release -- --unsigned` for local unsigned bundle validation
- the default release target is a signed or unsigned portable bundle under `D:\apex-localdev\releases`
- add `-- --installer nsis` or `-- --installer msi` only when you explicitly want an installer build on top of the portable release
- configure signing with either:
  - `APEX_WINDOWS_SIGN_COMMAND`
  - or `APEX_WINDOWS_CERT_THUMBPRINT`
  - or `APEX_WINDOWS_CERT_FILE` plus optional `APEX_WINDOWS_CERT_PASSWORD`

For Windows-local deep-link testing, the repository also includes current-user-only protocol helpers:

- `npm run register:desktop-protocol`
- `npm run unregister:desktop-protocol`
- `npm run launch:desktop-link -- -DeepLink "#kind=task&taskId=task_..."`

These helpers register `apex://` under `HKCU` only, which keeps protocol validation user-scoped and avoids machine-wide registry changes.
If you want to preview the registry operations without changing anything, run the underlying PowerShell scripts with `-WhatIf`.

## Useful commands

- `npm run build`
- `npm run check`
- `npm run smoke`
- `npm run setup:rust:local`
- `npm run setup:node:portable`
- `npm run setup:playwright:local`
- `npm run generate:desktop-icons`
- `npm run register:desktop-protocol`
- `npm run unregister:desktop-protocol`
- `npm run launch:desktop-link -- -DeepLink "#kind=task&taskId=task_..."`
- `npm run prepare:portable-node`
- `npm run prepare:tauri-companion`
- `npm run prepare:tauri-build`
- `npm run tauri:fetch`
- `npm run bundle:desktop`
- `npm run tauri:info`
- `npm run dev:desktop-supervisor`
- `npm run tauri:dev`
- `npm run tauri:build`
- `npm run tauri:release`
- `npm run dev:desktop`
- `npm run dev:local`
- `npm run dev:gateway`
- `npm run dev:workflow`
- `npm run dev:manager`
- `npm run dev:verification`
- `npm run dev:memory`
- `npm run dev:audit`
- `npm run dev:tools`
- `npm run dev:workers`

## Implemented app and service roles

- `desktop-shell`
  - task-first desktop UI for local execution, verification, audit, worker visibility, and local tool visibility
- `local-control-plane`
  - local-first backend for desktop shell, permissions, capability discovery, dashboard, task workspace APIs, and real local tool adapters
- `gateway-service`
  - public task creation, stop, resume, planning, and end-to-end run trigger
- `workflow-service`
  - start, stop, resume, heartbeat, checkpoints, and schedule management
- `manager-service`
  - definition-of-done generation, planning, dispatch, complete-check, and evolution trigger
- `verification-service`
  - checklist, verifier, reconciliation, done gate, and verification summary
- `memory-service`
  - memory capture, search, and skill candidate generation
- `audit-cost-service`
  - audit stream, heartbeats, cost updates, watchdog evaluation, and metrics
- `tool-gateway-service`
  - simulated tool catalog, invocation logging, and artifact generation
  - first real allowlisted external connector via `http_json_fetch`
  - first structured business connector via `crm_contact_lookup`
  - connector specs now carry auth and pagination metadata so new integrations follow one expansion path
- `worker-adapter-service`
  - worker selection, assignment, run tracking, stop, and execution handoff

## Notes

- Current state is an MVP execution baseline, not the final production system.
- Most major architecture decisions are already documented, but not every fine-grained implementation detail is duplicated in prose.
- For exact current behavior, treat code plus typed contracts as authoritative when they are more specific than a narrative document.
- Local state now persists to SQLite through a repository-style adapter so the desktop shell and local control plane can survive restarts without staying tied to an in-memory-only store.
- The SQLite adapter is intentionally isolated behind the shared state package so it can later be replaced with `libSQL`, `Turso embedded replicas`, or another local persistence backend without rewriting the app layer.
- The runtime now follows a capability-first policy: when a task needs a Skill, MCP server, Tool, or Worker, it first searches the local capability catalog and only falls back to local implementation when no reusable option is a good fit.
- The first real local adapters now follow least-privilege rules: file listing and file reads stay read-only and workspace-scoped, while shell execution is limited to read-only diagnostic commands and still requires explicit confirmation.
- File writes are now available as a separate higher-risk adapter: they stay workspace-scoped, require confirmation, and automatically capture pre-write content as an artifact when overwriting an existing file.
- File patching now has a safer exact-match path: the edit is applied only when the current file content still matches the expected baseline, which makes local edits much more predictable and reviewable.
- Browser access starts as a low-risk snapshot adapter with QA-friendly defaults, and IDE access starts as a read-only workspace summary that still requires explicit confirmation before collecting project context.
- Browser work now persists as local browser sessions so follow-up navigation can reuse earlier context without bypassing permission, audit, or artifact capture.
- The browser layer now prefers a real browser worker when one is available locally and safely falls back to fetch-based snapshots when it is not, while preserving the same session contract and producing a small DOM summary that helps the workspace explain what the browser actually saw.
- Local execution now includes a first resilience layer: control-plane rate limiting, per-task mutation locks, browser retry-and-fallback behavior, and circuit-breaker signals for unstable shell or browser paths.
- External tool execution now follows the same contract direction as local tools: idempotency keys, compensation metadata, and reconciliation-aware outputs are first-class fields rather than connector-specific conventions.
- The local control plane can now proxy external tool-gateway catalog, invoke, and reconciliation endpoints, so the desktop workspace can launch connector-backed actions without introducing a second control surface.
- The desktop workspace now includes an operational safety summary and external tool actions panel, making retry safety, compensation availability, reconciliation status, and manual-attention cues visible before a human triggers another side effect.
- Desktop navigation now also follows a single deep-link protocol, so notifications, focus actions, copied workspace links, and future native shell entry points all resolve to the same `task / inbox / policy_follow_up / policy_proposal` targets.
- The local control plane now exposes that protocol directly, so backend-driven inbox items, policy follow-ups, and proposal queues can all carry the same `#kind=...` target contract instead of leaving link generation to each UI surface.
- The Tauri desktop shell now also accepts an initial deep-link target at startup through `--deep-link=...`, `--deep-link ...`, or a `apex://...#kind=...` style argument, so future native notifications and OS-level launch handlers can reuse the same navigation protocol.
- The desktop runtime now also has a pending deep-link bridge, so a running shell can consume a newly queued target instead of requiring a fresh window for every navigation handoff.
- The Tauri shell now registers a single-instance handoff path, so a second launch with a deep-link argument can forward that target into the already-running window instead of creating a duplicate shell.
- Windows-local protocol registration is now scripted as a user-scope operation, so `apex://...` testing can be enabled, validated, and removed without touching machine-wide registry state.
- Desktop notifications now follow a hybrid policy: browser notifications remain the preferred click-through channel, while the Tauri shell can fall back to native desktop notifications when browser notification APIs are unavailable.
- The first real external connector is `http_json_fetch`, which intentionally stays behind a hostname allowlist (`APEX_TOOL_HTTP_ALLOWLIST`, default `127.0.0.1,localhost`) so external reach stays explicit and reviewable.
- Structured connector behavior is now beginning to diverge from generic fetch: `crm_contact_lookup` validates business input, maps CRM-shaped JSON into a stable contact schema, and still preserves the same invocation, artifact, and reconciliation contracts.
- `hr_candidate_lookup` follows the same shared connector contract for HR flows and returns a normalized candidate object with stage metadata instead of raw API shape leaking upward.
- `finance_reconcile` now provides the finance-side pattern: authenticated, allowlisted, business-shaped reconciliation output with explicit external-state semantics instead of opaque payload passing.
- Connector definitions are now moving toward a formal `ConnectorSpec`: metadata such as connector type, auth strategy, pagination strategy, and required inputs live with the connector itself instead of being scattered across ad hoc conditionals.
- That `ConnectorSpec` metadata is now shared upward into the desktop workspace as well, so connector capabilities are visible to users before they invoke them.
- Skill interoperability now follows the same pattern: external skill formats should be imported into a shared `CanonicalSkillSpec` instead of being treated as runtime truth. The repo now includes initial OpenClaw / Claude / OpenAI skill importers under the shared runtime layer.
- Imported skills now land in a shared canonical skill registry, so they can participate in capability discovery instead of remaining one-off converted blobs.
- The canonical skill registry now has a full local control plane interchange path: inline import, file import, direct lookup, inline export, and file export all flow through one API surface instead of being handled ad hoc in the UI.
- The desktop workspace now exposes that same interchange flow directly: users can filter skills, inspect details, import external skill documents, preview exports, and write exported skills to explicit local files without bypassing control-plane policy.
- Canonical skills now also follow a lightweight governance model: imported skills default to `review_required`, only `active` skills enter capability discovery, and `disabled` skills stay visible for audit without silently influencing planning.
- The governance path now also exposes a review queue, per-skill audit history, and promoted bundle export so approved skills can be distributed as a deliberate team asset instead of an implicit side effect of import.
- Promoted bundle distribution now includes a typed manifest, integrity hash, optional signature, bundle verification, bundle import, publisher identity, source environment, release channel, promotion note, and bundle provenance history through the local control plane.
- The local control plane also exposes a bundle activity feed, so recent bundle export, promotion, and import events can be reviewed without opening each manifest manually.
- Bundle verify/import now also evaluates local trust policy, including trusted publisher allowlists and allowed release channels, before a bundle can be treated as trusted.
- Bundle governance now also supports content policy gates (allowed sources, blocked tags, blocked capabilities) and role gates for review, promotion, and trusted import actions.
- The desktop workspace now exposes skill policy diagnostics so active trust, content, and role gates are visible before governance or bundle actions are attempted.
- Those diagnostics now also show rule origin, so operators can tell whether a policy came from defaults, an explicit policy file, or environment configuration.
- Local skill policy now supports scoped merge precedence:
  - `default`
  - `global policy file`
  - `org policy file`
  - `workspace policy file`
  - `local policy file`
  - `environment overrides`
- The supported file env vars are `APEX_SKILL_POLICY_PATH_GLOBAL`, `APEX_SKILL_POLICY_PATH_ORG`, `APEX_SKILL_POLICY_PATH_WORKSPACE`, and `APEX_SKILL_POLICY_PATH_LOCAL` with `APEX_SKILL_POLICY_PATH` kept as a backward-compatible local alias.
- The local control plane now also exposes a policy dry-run endpoint for skill bundles, so teams can simulate verify/import outcomes and role eligibility before attempting a trusted import.
- The local control plane now also exposes a scoped policy registry API, so desktop operators can inspect and write `global / org / workspace / local` policy JSON files through the same audited control-plane boundary instead of editing runtime files blindly.
- Scoped policy editing now also exposes an effective diff preview and a policy audit feed, so operators can see what a scope change would do before saving and can later review when policy changed.
- Policy governance now also supports policy-bundle export/import/verify and per-scope rollback, so teams can snapshot local policy state, move it between environments, and restore a known-good scope without editing files by hand.
- Policy governance now also includes a proposal workflow for scope edits and scope-to-scope promotion, so policy changes can move through `proposed -> approved -> applied` instead of relying only on direct file edits.
- Policy responsibilities are now separated by role:
  - `policy_edit_roles`
  - `policy_approve_roles`
  - `policy_promote_roles`
  This keeps drafting, approval, and environment promotion distinct.
- The local control plane now exposes a policy proposal queue, proposal approval/rejection/apply APIs, and environment-style promotion between `global / org / workspace / local` scopes.
- Policy governance now also supports batch proposal processing, approval-note templates, and release-history views so the desktop workspace can operate more like a real organization control center than a raw JSON editor.
- Policy governance now also includes environment labels and a promotion pipeline, so `global / org / workspace / local` are treated as explicit policy environments instead of just file names.
- Promotion proposals are now validated against the active pipeline, which prevents unsupported jumps such as skipping straight from a local override to the global baseline.
- The desktop workspace now also surfaces policy environment snapshots and `from -> to` compare previews, so operators can inspect effective drift before creating promotion proposals or importing policy bundles.
- Policy environment compare now also groups drift into `trust / content / roles / environments`, which makes governance decisions faster than reading a flat diff.
- Policy environment compare now also emits a risk summary for governance-expanding changes such as relaxed trust gates, broader role access, or newly unblocked capabilities.
- Policy environment compare now also emits a recommended governance action, so operators can quickly see whether a change is safe to promote, needs manual approval, or requires security review.
- Policy compare advisory now also includes the next workflow step and a suggested rationale note, so the desktop workspace can launch the right proposal flow directly from the compare result.
- Promotion proposals created from compare advisory now also carry the selected review path and advisory metadata, so approval queues and audits retain the intended governance route.
- Policy proposal handling is now split into `security review`, `manual approval`, and `standard promotion` queues, so governance routing is visible and enforceable instead of being hidden inside one flat list.
- Queue routing now also carries queue-specific approval roles, so `security review` proposals can require a stricter reviewer set than standard or manual-approval changes.
- Proposal queues now expose queue-level operations signals such as pending/approved counts, oldest pending age, SLA breach count, and a suggested next action so operators can prioritize the right lane quickly.
- Queue diagnostics now also emit health status, escalation requirement, escalation reason, and a follow-up action so high-risk lanes can be escalated before they silently age out.
- The policy center now also exposes a structured follow-up feed derived from queue health, so operators can see concrete next actions like assigning a security reviewer or processing standard promotions.
- Follow-ups are now executable from the control plane and desktop workspace, and execution creates a real local ops task so escalations turn into trackable work instead of staying as passive warnings.
- Inbox items can now be acknowledged or resolved, and executing a follow-up automatically resolves its corresponding inbox item so the operator view stays clean.
- Successful tasks now distill experience into two compact reusable assets: a methodology-style knowledge entry and an approved learned skill/playbook. Similar future tasks can hit those learned playbooks during capability discovery instead of starting from scratch.
- Successful tasks now also promote a compact task template. Similar future tasks can reuse both the learned playbook and the task template so definition-of-done generation and execution planning can take a fast path instead of re-exploring from scratch.
- To avoid storage blow-up, learned methodology, approved skills, and task templates are merged by task fingerprint, updated in place, and summarized instead of storing every near-duplicate exploration as a brand-new long record.
- Fast execution is now a first-class policy: reuse approved methodology first, reuse compact task templates second, resolve only the minimum required capabilities, and fall back to local implementation only when reusable options are insufficient.
- Learned skills and task templates now carry version, applicability rules, and failure boundaries so reuse stays fast without becoming sloppy or over-broad.
- Reuse ranking is now driven by a lightweight local similarity layer that combines token overlap, applicability tags, support count, version, and recent successful use, so similar tasks can be matched quickly without introducing a heavy always-on vector stack.
- The task workspace now surfaces reuse recommendations directly, including why a learned playbook or task template matched, so fast-path reuse remains inspectable instead of becoming a black box.
- The task workspace now also surfaces the active `execution_template_key` and any `reused_task_template_id/version`, so operators can see when a task is benefiting from a previously successful template instead of inferring reuse indirectly.
- When a learned template was actually reused, the workspace now also shows compact template details and the related approved playbooks that share the same fingerprint, so reuse stays traceable instead of collapsing into opaque metadata.
- The workspace now also lets an operator inspect a selected related playbook inline, including summary, applicability, failure boundaries, and compact evidence, so a reused method can be reviewed before trusting it.
- Workspace execution-template and related-playbook details now also carry canonical deep links from the control-plane contract layer, so future notifications, event replay, and external launch paths can target the same reuse details without each UI surface inventing its own link shape.
- Reuse-governance tasks now also surface a dedicated `Reuse Improvement` context in the workspace, including the affected execution template or learned playbook, the suggested learning action, and a canonical deep link back to the reusable asset that should be refined.
- Runtime hardening now also exposes the current `session / harness / sandbox` boundary contract and a first-class `Agent Team` summary in the workspace, so delegated execution stops being implicit in raw worker runs alone.
- The local control plane now also exposes `GET /api/local/tasks/:taskId/agent-team`, so diagnostics and future team-centric UI can inspect delegated runtime state without loading the whole workspace payload.
- Agent-team inspection now also includes delegated checkpoint summaries, so capability routing, execution, verification, and learning-curation milestones stay visible as the team runtime becomes more resumable.
- Agent-team inspection now also includes explicit handoff events and a merged team timeline, so supervisor routing can be audited without reconstructing it from raw worker runs.
- Agent-team inspection now also includes delegated resume requests, delegated resume packages, delegated execution runs, delegated runtime bindings, delegated runtime instances, launcher worker-run attachments, and per-session resume lifecycle actions, so resumable delegated work can enter a formal workflow with acceptance, rejection, `prepared -> applied` handoff evidence, explicit runtime binding, heartbeat-aware runtime instances, and a concrete executor attachment before later sandbox pools or cloud workers replace the launcher implementation.
- The local control plane now exposes a delegated runtime launcher catalog, so desktop and automation clients can choose between `worker_run`, `sandbox_runner`, and `cloud_runner` launchers without hard-coding runtime defaults.
- Launcher diagnostics are now first-class too, so operators can see which delegated runtime backend is ready, waiting on attachment, or degraded before binding the next execution run.
- Delegated runtime launcher drivers are now first-class too, so each launcher kind can be backed by an explicit driver contract with its own health model, capability flags, and future upgrade path.
- Launcher drivers now also carry isolation-scope and quota-profile semantics, so a delegated runtime can stay explicit about whether it is running in a host process, sandbox pool, or remote control plane and what quota contract it expects.
- The `agent-team` workspace payload now carries launcher and launcher-driver diagnostics directly, so team-oriented automation can inspect delegated runtime readiness without stitching together separate global endpoints.
- Delegated runtime instances now also expose a copyable launch spec and a dedicated `GET /api/local/tasks/:taskId/agent-team/runtime-instances/:instanceId/launch-spec` endpoint, so future worker/sandbox runners can consume one stable handoff contract instead of reconstructing runtime state from multiple objects.
- Delegated runtime instances now also expose launcher-consumption receipts through `POST /api/local/tasks/:taskId/agent-team/runtime-instances/:instanceId/launch`, so a real launcher adapter can acknowledge handoff consumption and attach a concrete launch/execution locator without changing the surrounding delegated-runtime contract.
- Delegated runtime launcher backends now also expose adapter catalogs and health summaries, and launch receipts can be consumed through `POST /api/local/tasks/:taskId/agent-team/runtime-launch-receipts/:receiptId/consume`, so the future sandbox/cloud runner path already has one stable `launch spec -> receipt -> adapter run` bridge.
- That delegated-runtime bridge now continues into `runtime backend execution`, so operators can move from `adapter run` into a concrete backend execution with explicit heartbeat and completion semantics before a fully independent sandbox/cloud worker is attached.
- That delegated-runtime bridge now continues one step further into `runtime driver run`, so a concrete launcher driver can own the backend lifecycle with its own heartbeat and completion contract before a future sandbox pool or cloud runner takes over the same role.
- That delegated-runtime bridge now also includes `runtime runner execution`, so a concrete runner process/job can expose its own `start -> heartbeat -> complete/fail` lifecycle beneath the runner handle before later local, sandbox, or cloud executors are swapped in.
- That delegated-runtime bridge now also includes `runtime runner job`, so a concrete process/job contract can sit beneath runner execution as `runner execution -> runner job -> heartbeat -> complete/fail` without collapsing job-level lifecycle semantics back into runner execution.
- Task creation and methodology promotion now run through a security preflight so obvious prompt-injection or privilege-bypass text is filtered before it can become a new task or an approved learned skill.
- The desktop shell now treats local control plane availability as a first-class state: it can surface connection health, explain recovery steps, and in Tauri development mode query and trigger desktop-managed local control plane startup without breaking browser compatibility.
- The desktop shell can now also surface the last desktop-managed lifecycle event for the local control plane and expose guarded start, stop, and restart controls in Tauri development mode.
- Desktop-oriented tooling now has a D-drive-first local development layout under `D:\apex-localdev` by default, including Rust, Cargo target output, temp files, npm cache, and Playwright browser assets, so desktop work does not need to spill into a nearly full C drive.
- The desktop Rust/Tauri toolchain now also applies a slower-network-safe Cargo profile and exposes `npm run tauri:fetch` so crate downloads can be warmed before a full `tauri dev` or `tauri build`.
- The Tauri scaffold now has a reproducible placeholder icon generator, so Windows builds do not fail on missing `icon.ico` while the final product branding is still evolving.
- The desktop shell now supports a more production-oriented companion-process model: launch strategy detection, persisted stdout/stderr logs, launch target visibility, and last-exit reporting are all exposed through the Tauri manager state instead of being hidden behind development-only start/stop buttons.
- The Playwright worker path can now succeed without a heavy browser download on Windows by falling back to the system Edge channel when bundled Chromium is unavailable, while still keeping the same audited browser-session contract.
- `npm run build` now guarantees a stable TypeScript build across workspaces; desktop bundling is intentionally split into `npm run bundle:desktop` so front-end packaging can evolve independently from the core app build.
- The smoke test is the fastest way to confirm the full path from task creation to completion, memory capture, schedule triggering, and worker tracking.
- The desktop event center can promote high-risk navigation patterns into governance alerts and inbox items, then execute them into first-class local `ops` tasks through the same governance workflow used elsewhere in the product.
- Governance alert counts now roll into the main dashboard summary, so desktop-originated governance pressure stays visible next to task and inbox pressure.
- Repeated desktop navigation risks now aggregate into a single governance alert with occurrence counts instead of spawning unlimited duplicate alerts.
- Repeated warning-level navigation risks can now auto-escalate into critical governance alerts, reopen previously resolved inbox items, and surface explicit escalation counts in the dashboard.
- Desktop notifications now only fire for `new` priority inbox items, while re-opened or escalated governance alerts can be surfaced again without re-notifying every low-signal repeat.
- Governance alerts and policy follow-ups now execute into template-backed `ops` tasks, so recurring governance work starts with consistent completion criteria, required artifacts, and execution metadata.
- Those governance execution templates now also feed the same learned playbook and task template fingerprinting path as the rest of the system, so successfully handled governance work can become a reusable fast path instead of remaining a one-off incident response.
- Critical or repeated governance alerts now generate a dedicated governance follow-up feed, so operators can process high-risk desktop issues from a focused action queue instead of hunting through the raw alert list.
- Once a governance follow-up task is successfully completed, the next similar governance incident can prefill from the learned task template instead of starting from the static baseline alone.
