# GLM-5.1 Computer Use Host Validation Spec

This document is the execution handoff for the only remaining `Computer Use Runtime` work: real host validation and host-specific fixups.

Use this document together with:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./glm-5.1-computer-use-host-parity-spec.md`](./glm-5.1-computer-use-host-parity-spec.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

## 1. Objective

At this point, the remaining scope is no longer broad implementation work.

The objective is:

- validate the landed macOS accessibility path on a real macOS host
- validate the landed Linux AT-SPI path on a real Linux host
- fix any host-specific defects discovered during validation
- update documentation so the remaining boundary is only true host reachability

## 2. Remaining Scope

Only these items remain in scope:

1. macOS real-host validation
2. macOS host-specific fixes discovered during validation
3. Linux real-host validation
4. Linux host-specific fixes discovered during validation

Everything else should be treated as already landed baseline unless a concrete regression is discovered during validation.

## 3. Fixed Execution Order

The remaining work must be done in this exact order:

### 3.1 macOS Host Validation

Validate on a real macOS host:

- accessibility tree extraction
- click / type / focus / select / hover actions
- screenshot capture
- display enumeration
- `local_app.invoke`
- diagnostics output and runbook usefulness

If validation reveals defects:

- fix them immediately
- rerun validation
- update docs

### 3.2 Linux Host Validation

Validate on a real Linux host:

- AT-SPI extraction
- click / type / focus / select / hover actions
- screenshot capture
- display enumeration
- `local_app.invoke`
- diagnostics output and runbook usefulness

If validation reveals defects:

- fix them immediately
- rerun validation
- update docs

## 4. Rules

- Do not reopen already completed browser perception or recording work unless validation reveals a real regression.
- Do not invent new architecture work.
- Do not switch the local runtime skeleton.
- Do not introduce DeerFlow or LangGraph as the local runtime core.
- Do not stop after diagnostics alone; perform real host validation if the host is available.
- Do not stop after one failed attempt; fix and retry.

## 5. Required Documentation Updates

When validation changes the actual boundary, update at least:

- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

Update when relevant:

- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)

## 6. Stop Condition

Stop only when one of the following is true:

1. macOS and Linux paths are both implemented and verified on real hosts
2. one or both hosts are truly unavailable, and all code, diagnostics, runbooks, and platform-specific fixups are already complete

## 7. Required Reporting Per Round

For each round, report:

1. target host
2. validation checklist executed
3. defects found
4. files changed
5. fixes landed
6. verification rerun result
7. what remains blocked only by host availability
