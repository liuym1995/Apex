# Local Permission and Tooling

This document explains how Apex handles local machine access, tool execution, and safety boundaries in the local-first desktop runtime.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`../README.md`](../README.md)

## 1. Purpose

The app is designed to operate the user's machine directly.

That creates power, but also risk.

This document defines the best-practice rules for:

- local permissions
- local tools
- local adapters
- safe escalation boundaries
- cross-platform local tool discovery
- outbound egress control

## 2. Core Rule

The local runtime should be powerful, but not ambiently over-privileged.

In practice:

- read-only paths can be broad enough to be useful
- write, shell, browser, IDE, and app control must remain explicit
- all critical actions must be auditable

## 3. Permission Layers

Local permissions are only one part of the overall system, but they are the most dangerous one.

The complete model has three layers:

### 3.1 Platform Permissions

Examples:

- who can create tasks
- who can stop tasks
- who can approve actions

### 3.2 System Permissions

Examples:

- which connectors can be used
- what department can call which capability

### 3.3 Local Machine Permissions

Examples:

- file read
- file write
- shell execution
- browser automation
- IDE control
- local app invocation

This document focuses on layer 3.

The runtime should also make the current boundary model visible in the workspace:

- `session`
  - how task context was compacted or promoted
- `harness`
  - whether planning reused a template, a playbook, or both
- `sandbox`
  - what execution profile and guarded scopes are currently in force

For skill distribution and promoted bundle import, the local runtime should also expose policy diagnostics so the user can inspect:

- trusted publishers
- allowed release channels
- blocked tags
- blocked capabilities
- role gates for review, promotion, and trusted import

without reading service environment variables directly.

The local runtime should also maintain a typed local capability inventory for:

- installed CLI tools
- browsers
- IDEs
- desktop apps
- package managers
- OS-native automation surfaces

This keeps the system from rebuilding capabilities that are already present on the user's machine.

## 4. Default Local Permission Policy

The best-practice default is:

- `local_files.read`
  - allow by default within approved workspace roots
- `local_files.write`
  - ask
- `local_shell.execute`
  - ask
- `local_browser.automate`
  - ask, with limited lower-risk defaults for QA-style use cases
- `local_ide.control`
  - ask
- `local_app.invoke`
  - ask or deny based on risk and policy

For high-risk tasks, some local permissions should move from `ask` to `deny`.

## 5. Workspace Scoping

Local file access should never be unconstrained by default.

The runtime should restrict file operations to approved workspace roots whenever possible.

This applies to:

- directory listing
- file reads
- file writes
- patching
- shell working directories
- IDE workspace inspection

This keeps local operations bounded and auditable.

## 6. Current Tool Classes

The local-first runtime currently centers around these tool categories:

### 6.1 Filesystem

- directory listing
- file read
- file write
- exact-match patch

### 6.2 Shell

- controlled diagnostic shell execution

### 6.3 Browser

- low-risk browser snapshots
- browser sessions with navigation history

### 6.4 IDE

- read-only workspace summaries

These are intentionally staged.

The platform should not jump immediately to unrestricted machine control.

## 6A. Session / Harness / Sandbox Boundary

The next runtime-hardening step is to make three boundaries explicit:

### Session

- owns compacted task context
- owns checkpoint and promoted-memory visibility
- should avoid uncontrolled transcript growth

### Harness

- owns planning mode
- owns capability discovery
- owns verification stack selection

### Sandbox

- owns execution isolation tier
- owns guarded scopes for risky local actions
- should eventually become a harder execution boundary than the current host-guarded model

The current product now exposes these three layers in the workspace so operators can see how a task was actually run, instead of treating runtime isolation as a hidden implementation detail.

## 7. Write Safety

Write operations are the first place where local power can become dangerous.

### 7.1 File Writes

Best-practice rules:

- workspace-scoped
- confirmation-gated
- audited
- write result recorded
- previous content captured as a backup artifact when overwriting
- duplicate writes should prefer idempotent reuse over reapplying the same side effect
- reversible writes should expose a compensation path that can restore prior content from backup evidence

### 7.2 File Patching

Preferred early pattern:

- exact-match patching

Why:

- prevents editing a stale baseline
- keeps changes predictable
- makes local edits safer to review

Over time, richer patching can be added, but it should remain bounded and reviewable.

## 8. Shell Safety

Shell execution is powerful and risky.

Best-practice rules:

- read-only diagnostics first
- explicit confirmation required
- disallow dangerous shell patterns by default
- record command, cwd, result, and audit entry

The shell should not be treated as the default interface for every task.

## 9. Browser Safety

Browser access should begin in a bounded mode.

Recommended progression:

1. snapshot-style inspection
2. reusable browser sessions
3. richer worker-backed browser automation

At every stage:

- permission should still be checked
- actions should still be audited
- sessions should remain visible in the workspace

## 10. IDE Safety

IDE integration should begin as read-only context gathering.

Early-stage best practice:

- inspect workspace structure
- inspect project metadata such as `package.json` and `tsconfig`
- do not silently modify code through IDE control

Later richer IDE control should only arrive after:

- permission model stability
- audit coverage
- patch/write safety maturity

## 11. Why API-First Still Matters

Even in a local-first app, direct local control should not be the first option when a safer integration exists.

Preferred order:

1. API or MCP
2. browser automation
3. local application control

Reason:

- API paths are usually more reliable
- API paths are easier to verify
- API paths are easier to audit
- UI automation is fragile

For local machine tasks, the stronger best-practice order is:

1. installed CLI or script
2. official API or MCP
3. browser automation
4. local application control

## 12. Audit Expectations

All critical local actions should leave a trace.

That includes:

- permission decision
- tool invocation
- key parameters
- result summary
- generated artifacts
- related task id

The local runtime should never become a black box with machine authority.

## 12A. Prompt Injection and Tool-Shaping Defense

Local machine control must not trust raw user text or raw recalled memory as executable authority.

Minimum rules:

- detect known prompt-injection and policy-bypass phrases before task creation
- detect tool-call shaping attempts before promoting reusable knowledge
- never let text alone grant additional local permissions
- never let a recalled memory entry override current policy

If the system detects a suspicious request pattern, it should:

- reject the task creation request for clearly unsafe patterns, or
- require human review before any privileged path continues

## 12B. Memory Poisoning Defense

Learned methodology is valuable, but it can also become a persistence layer for bad instructions.

Best-practice controls:

- sanitize methodology summaries before storing them
- merge repeated successful patterns instead of storing raw transcripts
- block automatic approval of learned skills when the source task contains security flags
- keep learned assets compact, reviewable, and attributable to source tasks

The system should learn durable method, not durable injected text.

## 12C. No Silent Egress

Operating the user's computer does not imply permission to exfiltrate data.

Mandatory rules:

- outbound network access is deny-by-default
- third-party telemetry SDKs are forbidden in privileged runtimes
- prompts, code, logs, memory, and artifacts must not be silently uploaded
- remote destinations must be explicit, allowlisted, and auditable
- connector egress must record policy source and destination

Best practice:

- keep observability self-hosted by default
- export or sharing must be explicit user or policy action

## 13. User-Facing Visibility

The task workspace should make local execution visible.

Users should be able to inspect:

- what local tools were used
- whether a tool required confirmation
- what artifacts were produced
- what browser sessions exist
- what file operations were performed
- whether the watchdog sees any problem

This is essential for trust.

## 14. Recommended Evolution Path

The safest way to expand local power is in stages.

### Stage 1

- read-only file access
- controlled shell
- browser snapshot
- IDE summary

### Stage 2

- confirmation-gated file write
- exact-match patch
- browser session reuse

### Stage 3

- richer browser worker
- richer IDE editing flow
- more advanced patch semantics

### Stage 4

- local app invocation
- desktop automation
- organization policy packs for local machine control
- stronger circuit breaking, fallback routing, and compensating-action support for local side effects
- cross-platform tool discovery and typed invocation of installed local tools on Windows, macOS, and Linux

This staged approach is strongly preferred over exposing full local power immediately.

## 15. What Must Never Be Normalized

The following should not become default behavior:

- blanket full-disk access
- unrestricted shell execution
- silent local application control
- hidden browser automation
- machine-wide write access without confirmation or policy

These are anti-patterns, even if they appear convenient during development.

## 16. Summary

The local tooling model is designed to make the app powerful enough to act on the user's machine while still remaining:

- bounded
- auditable
- reviewable
- interruptible
- policy-aware

In one sentence:

`Apex treats local machine control as a privileged capability that must stay scoped, explicit, and observable.`

## 17. External Connector Boundary

External connectors should follow the same discipline as local tools.

Recommended rules:

- do not allow arbitrary outbound network access by default
- keep real HTTP connectors behind explicit hostname allowlists
- keep timeout behavior bounded and visible
- capture returned state as an artifact
- preserve idempotency and compensation metadata even when the connector is read-only today

The current reference pattern is `http_json_fetch`:

- real network call
- allowlisted hosts only
- bounded timeout
- normal tool invocation ledger entry
- artifact capture for later inspection and replay
