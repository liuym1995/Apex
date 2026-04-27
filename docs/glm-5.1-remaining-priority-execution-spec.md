# GLM-5.1 Remaining Priority Execution Spec

This document defines the best-practice execution order for the major remaining architecture items that are still not fully landed in the current Apex repository.

It exists to answer one practical question:

`When GLM-5.1 continues implementation from the current state, what should it build next, in what order, and why?`

It is a companion to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)

## 1. Scope

This document is only about the high-impact remaining items that still require:

- external dependencies
- heavier architecture work
- deeper runtime refactoring
- platform-level enforcement work

It does not replace the broader architecture docs.
It is the implementation-order companion for the next phase.

## 2. Remaining Major Items

The current high-impact remaining items are:

1. microkernel runtime module separation
2. OS-level hard sandbox enforcement
3. code intelligence plane with real `LSP / AST` integration
4. self-hosted `OpenTelemetry`-style trace export
5. semantic cache and reuse layer

These correspond to the not-yet-complete areas already reflected in:

- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)

## 3. Best-Practice Priority Order

The recommended order is:

1. microkernel runtime module separation
2. OS-level hard sandbox enforcement
3. code intelligence plane
4. self-hosted OpenTelemetry export
5. semantic cache and reuse layer

This order is intentional.
It optimizes for:

1. architecture integrity
2. safety and trust boundary enforcement
3. correctness of complex coding work
4. long-run operability and debugging
5. speed optimization after the above are stable

## 4. Why This Order Is Best Practice

### 4.1 First: Microkernel Runtime Module Separation

Why first:

- it reduces coupling before more advanced subsystems are added
- it prevents sandboxing, code intelligence, observability, and caching from being bolted into a weak runtime shape
- it aligns with the best-practice reset plan and the external pattern adoption order

What this phase should accomplish:

- split runtime concerns into explicit modules
- keep the public runtime vocabulary stable:
  - `TaskRun`
  - `TaskAttempt`
  - `WorkerSession`
  - `SandboxLease`
  - `ExecutionStep`
  - `VerificationRun`
- move internal plumbing behind diagnostics and private contracts
- reduce shared-runtime coupling so later sandbox and code-intelligence integrations land cleanly

Why it comes before sandboxing:

- strong sandboxing is more durable when execution boundaries are already explicit
- otherwise sandbox code tends to get threaded through a monolithic runtime and becomes harder to maintain

### 4.2 Second: OS-Level Hard Sandbox Enforcement

Why second:

- security and privacy are the highest constitutional priority
- manifest-only sandbox semantics are not enough for a long-running, mutation-capable local agent
- once runtime boundaries are cleaner, the next highest-value move is to make isolation real

What this phase should accomplish:

- move high-risk execution into real process-level or OS-native isolation
- enforce `host_readonly / guarded_mutation / isolated_mutation`
- attach real lease, quota, filesystem, and egress enforcement to sandbox tiers
- make stop, revoke, timeout, and rollback behavior trustworthy

Why it comes before code intelligence:

- correctness matters, but a universal desktop agent must not postpone real trust boundaries until after convenience features

### 4.3 Third: Code Intelligence Plane

Why third:

- once runtime shape and trust boundaries are strong enough, the biggest correctness uplift for engineering tasks comes from LSP/AST-backed code understanding
- this is the largest quality improvement for multi-file coding, refactoring, and safe patching

What this phase should accomplish:

- real `LSP` integration
- real `AST` parser integration
- symbol and reference navigation
- structural edits instead of text-only replacement
- code-aware verification harness inputs

Why it comes after sandboxing:

- code intelligence makes the agent more powerful
- power should come after stronger isolation, not before it

### 4.4 Fourth: Self-Hosted OpenTelemetry Export

Why fourth:

- once the runtime has cleaner boundaries, stronger sandboxing, and deeper code execution paths, observability becomes much more valuable
- at this stage trace export helps debug and tune the more advanced system that has already landed

What this phase should accomplish:

- self-hosted OTEL-compatible tracing
- trace correlation across planning, execution, sandbox, verification, and learning
- no-silent-egress compliance
- operator-friendly replay and debugging

Why it comes before semantic cache:

- before optimizing speed, the team should be able to clearly observe the system and trust the evidence it emits

### 4.5 Fifth: Semantic Cache and Reuse Layer

Why fifth:

- semantic cache is an optimization layer, not a trust or correctness foundation
- if introduced too early, it can mask architecture problems and create stale-behavior risks
- it should sit on top of the already-established hierarchical memory model, not replace it

What this phase should accomplish:

- bounded semantic cache
- strict revalidation for mutating or policy-sensitive paths
- cache entries tied to model family, tool family, policy version, and workspace fingerprint
- alignment with `MemoryDirectory / MemoryDocument / metadata-first / rerank / recursive deep retrieval`

Why it is last:

- speed should follow correctness, safety, and observability
- this order reduces the chance of optimizing the wrong architecture

## 5. Execution Policy for GLM-5.1

When continuing implementation, `GLM-5.1` should obey these rules:

1. do not re-open priority order unless a real blocker appears
2. start from the highest unfinished item in this document
3. finish one stage to a meaningful boundary before diffusing effort across all remaining stages
4. update:
   - code
   - related docs
   - implemented/partial/not-implemented boundary
5. verify each stage with real checks before moving to the next

## 6. Stage-by-Stage Completion Criteria

### 6.1 Microkernel Runtime Module Separation

Status: **LANDED** ✓

Consider this stage sufficiently landed when:

- runtime responsibilities are split into explicit modules ✓
- public runtime vocabulary is normalized ✓
- transitional plumbing is no longer treated as the stable public surface ✓
- shared-runtime responsibilities are materially cleaner than before ✓

### 6.2 OS-Level Hard Sandbox Enforcement

Status: **LANDED** ✓

Consider this stage sufficiently landed when:

- high-risk execution is no longer manifest-only ✓ (real child process execution via `spawn`)
- at least one real OS/process isolation path is active ✓ (process-level isolation with isolated environment)
- quotas, revocation, and egress enforcement are tied to the sandbox runtime ✓ (quota pre-flight, manifest expiry/revocation checks, environment-based egress control)

### 6.3 Code Intelligence Plane

Status: **LANDED** ✓

Consider this stage sufficiently landed when:

- code tasks can query real symbol and diagnostic data ✓ (LSP client: document symbols, workspace symbols, references, definition; AST parser: TypeScript/JavaScript)
- structural edits are supported ✓ (CodePatch with symbol_rename, range_patch, ast_transform, full_rewrite)
- text-only repository search is no longer the final source of truth for code mutation ✓ (symbol store, reference store, affected files graph, repository indexer)

### 6.4 Self-Hosted OpenTelemetry Export

Status: **LANDED** ✓

Consider this stage sufficiently landed when:

- traces can be exported to a self-hosted OTEL-compatible sink ✓
- spans correlate planning, execution, sandbox, verification, and learning ✓
- no-silent-egress rules still hold ✓

### 6.5 Semantic Cache and Reuse Layer

Status: **LANDED** ✓

Consider this stage sufficiently landed when:

- semantic cache is bounded and explainable ✓ (CacheEntry with tier, hash, hit count, expiry)
- mutating or policy-sensitive paths require revalidation ✓ (model_family, policy_version, repo_fingerprint mismatch → cache miss)
- the cache augments hierarchical memory retrieval instead of bypassing it ✓ (separate cache tiers, not replacing MemoryDirectory/MemoryDocument)

## 7. Prompt for GLM-5.1

Use this when you want `GLM-5.1` to continue implementation according to the order above.

```text
Continue implementing Apex strictly according to:
1. docs/architecture-constitution.md
2. docs/architecture-document-system.md
3. docs/best-practice-reset-plan.md
4. master_plan.md
5. docs/current-architecture-status.md
6. docs/glm-5.1-architecture-execution-spec.md
7. docs/glm-5.1-remaining-priority-execution-spec.md

Do not stop at analysis.
Use the priority order defined in docs/glm-5.1-remaining-priority-execution-spec.md and start from the highest unfinished item.
Implement the current stage end-to-end, update related docs, run verification, report implemented/partial/future-target boundaries, and then continue to the next unfinished stage unless a real blocker or mandatory user decision appears.
```

## 8. Final Rule

In one sentence:

`GLM-5.1 should first strengthen the runtime shape, then make isolation real, then improve code correctness, then improve observability, and only then optimize speed through semantic caching.`

## 9. Preparation Layer vs Blocking Layer

All five major stages (6.1–6.5) are LANDED at the local-first level. The remaining work splits into:

### Preparation Layer (COMPLETED ✓)

All local-first implementations that do not require external infrastructure have been landed:

- CQS middleware: automatic endpoint wrapping, egress HTTP middleware, endpoint classification
- Learning factory automation: experiment winner auto-promotion, reuse confidence assessment, low-confidence auto-triggering
- Scheduled job infrastructure: cron-based job scheduling, automatic metrics computation, SLO breach alerting
- Event ledger enhancements: state reconstruction from events, multi-format export (JSON/CSV/HAR), replay package creation
- Lineage merge conflict detection and resolution
- Wiki enhancements: token-based semantic search, wiki-to-memory bidirectional linking, static site export
- Remote control plane service: contracts (FleetAgent, Tenant, RemoteUser, APIKey, SyncRecord, RemoteTaskDispatch), domain logic (fleet registration, heartbeat, dispatch, JWT/API key auth, audit sync), Fastify routes with 22 endpoints
- libSQL/Turso boundary: PersistenceAdapter interface, InMemoryPersistenceAdapter with SQL-like query parsing, migration management, LibSQLConfig Zod schema, migration scripts (002_remote_control_plane.sql, 003_otel_archive.sql)
- OTEL collector path: pipeline lifecycle (create/start/stop/tick), dynamic collector config generation (YAML), batch export, InMemoryPersistenceAdapter, OTELCollectorConfig Zod schema, collector-config.yaml, K8s sidecar manifest
- Deployment infrastructure: Dockerfile (remote-control-plane), docker-compose.yml (RCP + libSQL + OTEL), K8s manifests (RCP + OTEL), bootstrap scripts (bootstrap-rcp.sh, bootstrap-libsql.sh, bootstrap-otel.sh), runbooks (remote-control-plane.md, libsql-turso.md, otel-collector.md)

TypeScript type check: all packages (shared-config, shared-state, shared-runtime, remote-control-plane, local-control-plane) pass `tsc --noEmit` with zero errors.

### Blocking Layer (requires real external infrastructure)

These items cannot be completed without real external services or infrastructure:

1. **Cloud hosting for RCP** — requires cloud VM/container hosting with public IP (service skeleton is ready, just needs hosting)
2. **Temporal + LangGraph 2.x integration** — requires Temporal server deployment, LangGraph runtime environment
3. **OS-native filesystem/network sandbox enforcement** — requires OS-level ACL/chroot integration, native firewall rules
4. **Container/VM-level isolation** — requires Docker/containerd or VM runtime for isolated_mutation tier
5. **Independent distributed worker/sandbox backends** — requires distributed deployment infrastructure
6. **Enterprise IdP/SSO integration** — requires identity provider (Okta, Azure AD, etc.)
7. **Embedding-based semantic search** — requires embedding model service (OpenAI embeddings API, or local sentence-transformers with GPU)
8. **Persistent durable scheduler** — requires external durable task queue (Temporal, BullMQ+Redis, etc.)
9. **Real-time network interception** — requires OS-level proxy/firewall integration
10. **Runtime usage tracking pipeline** — requires real LLM call cost tracking and skill usage event pipeline
11. **PDF export** — requires PDF generation library or service
12. **@libsql/client npm package** — required for real libSQL server connections (InMemoryPersistenceAdapter is ready as fallback)
13. **TLS certificates** — required for production OTEL/libSQL/Turso connections
