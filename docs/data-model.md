# Data Model

This document explains the primary entities and storage boundaries in Apex.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./api-contracts.md`](./api-contracts.md)

## 1. Purpose

The platform should store operational truth in a way that is:

- local-first
- auditable
- resumable
- compact
- reusable

The data model is therefore not just implementation detail.
It is part of the product architecture.

## 2. Core Entity Families

The model groups naturally into these families:

Boundary note:

- current storage entities and final public runtime vocabulary are related but not identical
- current persisted entities may still use names such as `Task`, `Checkpoint`, and `WorkerRun`
- the stable public architecture vocabulary should converge on `TaskRun / TaskAttempt / WorkerSession / SandboxLease / ExecutionStep / VerificationRun`
- the data model should support that public surface without forcing storage tables to mirror every public term one-for-one

### 2.1 Task and Lifecycle

- `Task`
- `Schedule`
- `Checkpoint`
- `WorkerRun`

### 2.2 Execution and Output

- `Artifact`
- `ToolInvocation`
- `BrowserSession`

### 2.3 Verification

- `ChecklistRunResult`
- `ReconciliationRunResult`
- `VerificationRunResult`
- `DoneGateResult`

### 2.4 Learning and Reuse

- `MemoryItem`
- `SkillCandidate`
- `TaskTemplate`
- capability-resolution records

### 2.5 Audit and Oversight

- `AuditEntry`

## 3. Task as Primary Entity

The `Task` is the central record in the whole platform.

It should contain enough information to answer:

- what work is being done
- who started it
- what state it is in
- what completion means
- what risk level applies

Everything else should relate back to tasks.

## 4. Output Entities

Artifacts and tool invocations capture what the runtime actually produced and did.

### 4.1 Artifact

Artifacts represent:

- reports
- code
- QA results
- business notes
- backups
- verification outputs

Artifacts are user-visible operational outputs.

### 4.2 ToolInvocation

Tool invocations represent:

- what tool was called
- what task triggered it
- whether it succeeded
- what idempotency key was used when applicable
- whether compensation is available
- whether compensation has already been applied

This makes execution inspectable.

## 5. Verification Entities

Verification results should be stored separately rather than folded into the task record.

Reason:

- each layer has different semantics
- each layer may fail independently
- historical inspection becomes easier

This separation also supports partial reruns later.

## 6. Learned Asset Entities

Learning should not just create more tasks.

It should create compressed reusable assets.

### 6.1 MemoryItem

Used for:

- session summaries
- methodology entries
- evaluation notes

### 6.2 SkillCandidate

Used for:

- approved learned playbooks
- versioned methodology reuse
- applicability rules
- failure boundaries

### 6.3 TaskTemplate

Used for:

- reusable definition of done
- reusable execution plan baseline
- planning fast path

## 7. Compaction Principles

To avoid storage explosion:

- methodology entries merge by fingerprint
- approved learned skills merge by fingerprint
- task templates merge by fingerprint
- evidence is bounded
- summaries stay compact

The data model is intentionally designed for compression by task family.

## 8. Local Persistence Boundary

The local runtime currently persists state in a local database behind a repository-like store layer.

That layer should remain the storage boundary.

The app should not assume:

- a specific SQLite driver
- a specific SQL dialect in app logic
- direct table-level coupling in UI code

This preserves replaceability.

Best-practice target:

- current implementation may still look entity-centric
- the stronger final architecture should converge on an append-only operational event ledger plus materialized projections
- structured entities remain important, but they should sit alongside immutable operational history rather than replacing it

## 9. Cloud vs Local Truth

The local desktop database is the local source of truth for:

- local operational continuity
- offline behavior
- local task workspace rendering

It is not automatically the organization-wide source of truth.

The cloud control plane should remain the long-term source for:

- team-level governance
- org-wide audit
- long-running orchestration
- shared memory and policy

## 10. Recommended Storage Discipline

Keep product entities first-class.

Do not reduce the system to:

- one generic blob table
- one undifferentiated event stream
- one vector-only memory store

Different entity families exist because they support different operational questions.

## 11. Summary

The data model is designed to support the full product behavior:

- task control
- execution visibility
- verification
- reuse
- storage compaction
- replaceable persistence

In one sentence:

`Apex stores work as structured operational entities so execution, verification, learning, and reuse remain durable, inspectable, and compact.`
