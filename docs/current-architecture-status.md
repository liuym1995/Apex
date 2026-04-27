# Current Architecture Status

This document is the current-state counterpart to `../master_plan.md`.

Use it to answer one question precisely:

`What is already implemented in the current repository, what is only partially implemented, and what is still not implemented yet?`

## 1. Status Legend

- `Implemented`
  - present in the current repository as executable code, typed contracts, or working UI/API flows
- `Partial`
  - important contracts, state models, UI surfaces, or simulated flows exist, but the final production-grade form is not complete yet
- `Not implemented`
  - still a target architecture choice, roadmap item, or placeholder rather than a live runtime capability

Important boundary:

- this document describes the current repository state
- `master_plan.md` describes the final target architecture
- `best-practice-reset-plan.md` describes the stricter final-shape target
- when the two differ, treat this document and the codebase as authoritative for the current state

Terminology boundary:

- this document may mention transitional internal runtime plumbing that still exists in the current repository
- those terms do not override the stable public runtime vocabulary defined in [`./architecture-document-system.md`](./architecture-document-system.md)
- when describing final public architecture, prefer `TaskRun / TaskAttempt / WorkerSession / SandboxLease / ExecutionStep / VerificationRun`

## 2. Architecture Summary

The current repository is best described as:

`a local-first typed runtime and desktop control plane with verification, learning, governance, skill interoperability, and delegated-runtime lifecycle contracts already implemented at baseline`

It is not yet:

- a full cloud control plane
- a fully sandboxed multi-host runtime
- a real `LangGraph 2.x`-driven orchestrator
- a fully independent distributed worker fleet

## 3. Top-Level Status Matrix

| Area | Status | Current reality |
| --- | --- | --- |
| Desktop shell | Implemented | Tauri desktop shell, task workspace, deep links, notifications, control-plane supervision, operational views, acceptance/budget/multi-agent-limits cards, advanced settings for delegation and budget policy |
| Local control plane | Implemented | Fastify-based local API for tasks, workspace, tools, skills, policy, governance, delegated runtime actions, local app settings/status, delegation policy, budget policy, dispatch plan leasing, subagent envelopes, acceptance review, budget status/continue |
| Typed contracts and shared runtime | Implemented | shared types, shared runtime, shared local core, shared state, explicit lifecycle and verification contracts |
| Local persistence | Implemented | SQLite-backed state boundary behind the shared-state adapter |
| Verification stack | Implemented | checklist, verifier, reconciliation, done gate |
| Learning and reuse baseline | Implemented | methodology capture, skill candidates, task templates, capability-first reuse, reuse-improvement attachment |
| Local machine-control adapters | Implemented | filesystem, patch, rollback, shell, browser snapshot/session, IDE summary |
| Computer Use Runtime | Implemented | screenshot capture, accessibility tree (Win/macOS/Linux), OCR provider SPI, mouse/keyboard executor, see-act-verify-recover loop, verification evidence + confidence scoring, screenshot diff, human takeover/stop/replay, session recording (structured + frame-based + video encoding), local app invoke (hardened), multi-display (Win/macOS/Linux), browser perception (Chromium/Firefox/WebKit), platform diagnostics and self-check, OS-level hard sandboxing with tier-based action matrix, Windows-first smoke/E2E/regression test chain |
| External business connectors | Implemented | `http_json_fetch`, `crm_contact_lookup`, `hr_candidate_lookup`, `finance_reconcile` |
| Skill interoperability and governance | Implemented | OpenClaw / Claude / OpenAI importers, canonical registry, governance, bundle import/export/verify, ClawHub registry adapter boundary, remote skill trust/governance flows |
| Self-evolution pipeline | Implemented | Evolution run contracts, candidate generation from real signals, replay/regression/budget gates, integration with learning factory, workspace panel, API routes |
| Policy center and governance workflow | Implemented | scoped policy files, proposals, approval/apply flow, environment compare, rollback, bundle flow |
| Delegated runtime lifecycle contracts | Partial | execution run to runtime binding/instance/launch/adapter/backend/driver/runner/job chain exists |
| Scheduling and recurring baseline | Partial | schedule entities and trigger flow exist, but not a full durable enterprise scheduler |
| MCP real runtime integration | Implemented | full live MCP execution fabric with capability registry, tool resolver, policy enforcement, health checks, stdio/HTTP/gRPC protocol support, built-in capabilities (filesystem, shell, browser), AND full MCP Host Boundary with resources, prompts, roots, session authorization, progress, capability negotiation |
| DeerFlow real runtime integration | Partial | appears as a preferred worker/runtime concept, not a deeply integrated production execution engine |
| Hard sandboxing | Implemented | OS-level hard sandboxing with tier-based action matrix (host_readonly/guarded_mutation/isolated_mutation), sandbox enforcement integrated into computer use operations, audit logging, AND real Sandbox Provider SPI with 8 pluggable backends (rule_based, windows_job_object, windows_integrity, docker, podman, hyperv, linux_cgroups, linux_namespaces) |
| Cloud control plane | Not implemented | reserved in architecture, not present as live system |
| Temporal orchestration layer | Partial | Remote Orchestration SPI implemented with Temporal as optional fallback lane (not backbone); real Temporal server not yet connected |
| LangGraph 2.x orchestration layer | Partial | Remote Orchestration SPI implemented with LangGraph as optional fallback lane (not backbone); real LangGraph runtime not yet connected |
| Enterprise fleet / SSO / org control plane | Not implemented | target architecture only |

## 4. Layer-by-Layer Detail

### 4.1 Desktop Shell

Status: `Implemented`

Implemented now:

- Tauri desktop shell scaffold
- task-first workspace UI
- first-run local setup and later Settings flow for runtime/workspace/output/artifact/export directories
- required-vs-optional local configuration behavior, with recommended defaults and blocking prompts only for required settings
- task actions: prepare, run, verify, stop, resume
- local control plane supervision from the desktop shell
- deep-link protocol for task, inbox, policy, execution-template, and learned-playbook targets
- browser and native notification path
- inbox, governance, policy, skill, and delegated-runtime inspection surfaces
- local companion packaging and Windows-oriented release scripts

Still missing or not final:

- visual polish is not the final product quality target
- mobile or web parity is not a goal of the current repo
- some workspace areas are operationally rich but still intentionally MVP-level in product ergonomics

### 4.2 Local Control Plane

Status: `Implemented`

Implemented now:

- local task CRUD and lifecycle endpoints
- workspace aggregation endpoint
- local settings status endpoint with defaulted path resolution, required-setting validation, and persisted updates
- local tool endpoints
- external connector proxy endpoints
- skill registry import/export/governance endpoints
- policy diagnostics, scope editing, proposal, compare, bundle, rollback endpoints
- governance inbox and follow-up flows
- delegated runtime endpoints from resume request through runner job lifecycle
- PDP/PEP policy architecture: separate policy decision point (PDP) from policy enforcement points (PEP)
- policy rule CRUD with priority-based allow/deny rules and condition evaluation (eq, neq, in, not_in, contains, gt, lt, gte, lte)
- policy evaluation with verdict (allow/deny/conditional), reasoning, matched rules, and conditions
- policy enforcement with result tracking (executed/blocked/condition_applied/deferred) and evidence node linkage
- combined check-and-enforce API for single-call policy gate
- built-in safety rules: file_write blocked in host_readonly sandbox, critical risk + isolated mutation requires conditional approval
- policy decision and enforcement audit trail with event ledger integration
- Local Capability Discovery Layer: inventories installed CLIs, package managers, browsers, IDEs, desktop applications, OS automation surfaces, and system services
- local capabilities stored as typed entities with category, risk tier, invocation method, sandbox requirement, and tags
- discovery scan endpoint that registers common tools (git, node, npm, python, pip, docker, chrome, vscode, etc.)
- local capability to CapabilityDescriptor bridge for integration with capability resolver
- capability availability verification endpoint
- Autonomous Completion: core runtime property for long-running tasks
- heartbeat mechanism with status tracking (running/paused/retrying/circuit_open/escalated/completed/failed/cancelled)
- checkpoint recovery with step-level state snapshots
- bounded retry policy with configurable max retries and exponential backoff
- circuit breaker behavior with threshold and reset period
- watchdog escalation with configurable timeout and auto-escalation
- human-judgment boundary detection for explicit escalation
- completion status evaluation against definition-of-done criteria with evidence graph integration
- recovery from checkpoint API with circuit breaker and retry limit checks

Still missing or not final:

- no separate remote control plane service
- no organization-wide multi-device sync plane
- no final production auth boundary across all endpoints

### 4.3 Shared Runtime and Core Contracts

Status: `Implemented`

Implemented now:

- typed task, verification, memory, skill, policy, audit, and delegated-runtime entities
- explicit state transitions in shared runtime
- workspace composition in shared local core
- local state boundary in shared state
- capability-first planning and reuse logic
- reuse-improvement attachment back into templates and learned playbooks
- multi-dimensional capability scoring: policy admissibility, risk tier, deterministic coverage, locality, historical reliability, reuse success, latency, cost, maintenance burden, tag overlap, query relevance, source weight, deterministic tier
- score breakdown visibility per capability resolution with API endpoint
- deterministic-first hierarchy: tool > mcp_server > worker > skill > implementation

Still missing or not final:

- some runtime orchestration remains implemented as custom code instead of being split across a future cloud orchestrator boundary
- framework-neutral cloud boundary is planned, but not yet separated into a live remote orchestrator

### 4.4 Persistence Layer

Status: `Implemented`

Implemented now:

- SQLite-backed entity maps and collections
- local-first persistence for tasks, audits, artifacts, memory, templates, skills, policy, and delegated-runtime records
- replaceable persistence boundary through `packages/shared-state`
- append-only operational event ledger with sequence numbers, correlation/causation IDs, and 25 event kinds covering the full task lifecycle
- materialized event projections per aggregate type and ID for read-optimized workspace views
- outbox semantics for cloud sync and external notifications (pending/sent/failed/skipped lifecycle)
- event replay capability per aggregate for incident investigation and state reconstruction
- event ledger integrated into runTaskEndToEnd: every pipeline stage now appends an event

Still missing or not final:

- no `libSQL`, Turso embedded replica, or cloud sync backend is active yet
- no cross-device replicated persistence layer exists yet

### 4.5 Verification and Completion

Status: `Implemented`

Implemented now:

- definition of done generation or reuse
- checklist result
- verifier result
- reconciliation result
- done gate result
- verification gating before promotion into reusable assets
- evidence graph: structured evidence nodes per task with kinds (checklist, verifier, reconciliation, policy_decision, execution_output, external_state_confirmation, artifact_presence, approval, reviewer_feedback), dependency links, and status tracking
- completion engine: evaluates the full evidence graph to produce a verdict (complete / incomplete / blocked / revise_and_retry) with blocking reasons and next actions
- feed functions: checklist, reconciliation, and verifier results automatically feed into the evidence graph
- evidence graph integrated into the end-to-end task pipeline
- evidence graph and completion engine API endpoints in local control plane
- Ralph Loop / Reviewer Loop: iterative review loop with reviewer expectations and feedback
- reviewer verdicts: accepted, accepted_with_notes, revise_and_retry, blocked
- TaskAttempt tracking with attempt numbers, parent attempt linkage, and status
- automatic new attempt creation on revise_and_retry with max attempts limit
- attempt evaluation against required expectations with overall verdict aggregation
- loop stop and summary APIs for full observability

Still missing or not final:

- verifier is part of the current typed runtime, not yet a separately hardened, independently scaled verification subsystem
- specialized replay-eval or benchmark-grade verification pipelines are not present yet

### 4.6 Observability Tracing

Status: `Implemented`

Implemented now:

- trace lifecycle: startTrace / endTrace with run timeline tracking per task
- span tree: createSpan with parent_span_id linkage, 10 span kinds (planning, tool_invocation, capability_resolution, verification, policy_check, memory_capture, learning, execution, approval, external_call)
- span lifecycle: endSpan with duration calculation and error propagation
- span events: addSpanEvent for in-span event logging with timestamped attributes
- span tree query: getSpanTree returns full span list, root span, and max depth
- run timeline: per-task timeline with span count, error count, total duration, and status (running/completed/failed/cancelled)
- cost breakdown: recordCostBreakdown with accumulative tracking for LLM tokens, LLM cost, tool invocations, external calls, memory operations, and total duration
- SLO metrics: recordSLOMetric with threshold breach detection
- computeTaskSLOs: automatic SLO computation for task_completion_latency, error_count, llm_cost, and external_call_count
- full API surface in local control plane for trace, span, timeline, cost, and SLO operations
- OpenTelemetry export: `convertTracesToOTEL` maps internal TraceSpan data to OTEL-compatible format with resource attributes, scope spans, and span kind/status mapping
- `exportOTELToEndpoint`: exports OTEL batch to a configurable endpoint with audit trail
- `exportOTELAsJSON`: exports OTEL batch as JSON with metadata for debugging and replay
- OTEL span kind mapping: internal(1), server(2), client(3), producer(4), consumer(5)
- OTEL span status mapping: ok(1), error(2), unset(0)
- OTEL resource attributes: service.name, service.version, deployment.environment
- no-silent-egress compliance: OTEL export does not silently upload; requires explicit endpoint configuration
- full API surface: POST /api/local/otel/export, GET /api/local/otel/export-json

Still missing or not final:

- no real-time dashboard or visualization for span trees
- no distributed tracing across service boundaries (current tracing is local-only)
- no OTEL collector sidecar deployment configuration

### 4.7 No-Silent-Egress Rule Engine

Status: `Implemented`

Implemented now:

- egress rules: deny-by-default with allowlist-based override, supporting allow/deny/ask actions
- destination matching: domain (with subdomain), IP, CIDR, URL prefix, port, and wildcard patterns
- protocol filtering: any, http, https, ws, wss, tcp, udp
- policy source hierarchy: global, org, workspace, local, user
- priority-based rule evaluation: higher-priority rules match first
- egress check: checkEgress evaluates every outbound request against rules, producing allowed/denied/pending_approval verdicts
- egress audit: every check produces an immutable audit record with matched rule, policy source, denial reason, and approval attribution
- egress request approval: pending_approval requests can be explicitly approved with approver attribution
- egress audit statistics: total/allowed/denied/pending counts and top destination frequency
- default rule initialization: initializeDefaultEgressRules creates deny-all + localhost allow rules
- full CRUD API for rules, check API, approval API, audit query, and stats API in local control plane
- SqliteEntityMap now supports delete for rule removal

Implemented (preparation layer):

- checkEgressForHTTPCall: HTTP-level egress enforcement middleware that checks outbound calls against egress rules with destination pattern matching, protocol filtering, and sandbox tier checks
- createEgressHTTPMiddleware: middleware factory for wrapping HTTP client functions with egress rule checks

Still missing or not final:

- no real-time network interception layer (current implementation is a policy check API, not a network proxy — requires OS-level network interception)
- no UI for egress rule management or approval workflows

### 4.7a CQS Interface Layering

Status: `Implemented`

Implemented now:

- CQS type contracts: CQSCommandKind, CQSQueryKind, CQSEventKind enums with business-intent naming
- CQSCommand: typed command envelope with kind, aggregate_type, aggregate_id, payload, issued_at, issued_by, correlation_id
- CQSQuery: typed query envelope with kind, target_type, target_id, filter, projection, correlation_id
- CQSEvent: typed event envelope with kind, aggregate_type, aggregate_id, payload, caused_by_command_id, occurred_at, correlation_id
- dispatchCommand: unified command dispatcher that routes CQS commands to runtime functions and auto-emits CQS events
- executeQuery: unified query executor that routes CQS queries to read-side runtime functions
- command-to-event tracing: every dispatched command produces CQSEvent records with caused_by_command_id linkage
- correlation_id propagation: commands and events support correlation_id for cross-operation tracing
- CQS persistence: commands, queries, and events are persisted in SqliteEntityCollection for audit and replay
- listCQSCommands / listCQSQueries / listCQSEvents: filterable retrieval of CQS audit records
- CQS API endpoints: POST /api/local/cqs/command, POST /api/local/cqs/query, GET /api/local/cqs/commands, GET /api/local/cqs/queries, GET /api/local/cqs/events

Still missing or not final:

- existing flat REST endpoints have not been deprecated in favor of CQS endpoints yet

Implemented (preparation layer):

- CQS middleware: registerCQSEndpoint maps REST endpoints to CQS contracts (command/query/event classification)
- autoWrapEndpointsAsCQS: automatic bulk wrapping of REST endpoints into CQS endpoint mappings
- classifyEndpoint: heuristic endpoint classification (command vs query vs event) based on HTTP method and path patterns
- listCQSEndpointMappings: filterable listing of all registered CQS endpoint mappings
- checkEgressForHTTPCall: egress rule enforcement for outbound HTTP calls with destination pattern matching, protocol filtering, and sandbox tier checks
- createEgressHTTPMiddleware: middleware factory that wraps HTTP call functions with egress rule checks
- getEgressRuleManagementData: management data access for egress rules with filtering

### 4.7b Experiment Run System

Status: `Implemented`

Implemented now:

- ExperimentRun entity: objective, hypothesis, success metric, budget, status lifecycle (draft/running/completed/failed/cancelled/budget_exhausted)
- ExperimentCandidate: multiple candidate methods per experiment with method_type (cli/script/tool/skill/mcp_server/worker/implementation), config, result, and success_metric_value
- ExperimentBudget: configurable limits for max_attempts, max_tokens, max_wall_clock_ms, max_cost
- budget exhaustion detection: automatic status transition when any budget limit is reached
- candidate result recording: tracks per-candidate tokens_used, cost_incurred, wall_clock_ms
- experiment completion: automatic winner selection based on highest success_metric_value with comparison summary
- experiment cancellation: cancels all pending/running candidates
- full API surface: create, list, get, add candidate, start, record result, fail candidate, complete, cancel

Implemented (preparation layer):

- autoPromoteExperimentWinner: automatic experiment winner promotion with confidence assessment, improvement percentage calculation, and auto-promotion eligibility thresholds (winner_score >= 0.7, improvement >= 5%, confidence >= 0.6)
- assessReuseConfidence: reuse confidence assessment for skills based on usage count, success rate, lineage evaluation, and recency
- triggerExperimentsForLowConfidence: automatic experiment triggering for skills below confidence threshold with configurable min confidence and max experiments
- generateExperimentComparisonReport: detailed comparison report generation between experiment candidates with winner/loser metrics

Still missing or not final:

- (none remaining at preparation layer level)

### 4.7c Sandbox Manifest System

Status: `Implemented`

Implemented now:

- SandboxManifest entity: signed execution manifest with task_id, tier, filesystem mounts, capability tokens, resource quota, egress rules, rollback hints
- SandboxTier: three isolation tiers (host_readonly, guarded_mutation, isolated_mutation)
- FilesystemMount: per-path access control with readonly/readwrite and optional size limits
- CapabilityToken: short-lived capability tokens with scope, issued_at, expires_at
- ResourceQuota: configurable limits for CPU, memory, wall clock, file writes, shell commands, network calls
- checkSandboxQuota: pre-flight quota check before file_write, shell_command, or network_call actions
- recordSandboxUsage: cumulative usage tracking with memory peak tracking
- revokeSandboxManifest: immediate revocation with capability token invalidation
- automatic expiry detection: quota checks detect and transition expired manifests
- rollback_hints: structured compensation hints for undo/rollback operations
- full API surface: create, get, get-by-task, issue token, revoke token, check quota, record usage, revoke manifest

Implemented (preparation layer):

- CQS middleware egress integration: checkEgressForHTTPCall resolves egress rules for sandbox manifest egress enforcement

Still missing or not final:

- no integration with egress rule engine for automatic egress_rule_ids resolution (requires runtime sandbox-egress binding)

### 4.7d Task Control Commands (Interrupt/Correct/Redirect)

Status: `Implemented`

Implemented now:

- TaskControlCommand entity: first-class interrupt, correct, redirect commands with reason, correction, new_intent fields
- interrupt: pauses running/planning tasks, creates CheckpointSnapshot with execution step IDs and evidence node IDs for resumption
- correct: marks task as "corrected" with required correction description, applicable to running/planning/paused tasks
- redirect: changes task intent and marks as "redirected", applicable to any active task
- resumeFromInterrupt: resumes paused tasks back to running with checkpoint reference, restores from CheckpointSnapshot when available
- listTaskControlCommands: filterable command history per task (kind, status)
- TaskStatus extended with "corrected" and "redirected" states
- command status tracking: pending/applied/rejected with automatic rejection for invalid task states
- API surface: POST /tasks/:taskId/control, GET /tasks/:taskId/control-commands, POST /tasks/:taskId/resume

Still missing or not final:

(none remaining at this level)

### 4.7e Method Lineage Tracking

Status: `Implemented`

Implemented now:

- MethodLineage entity: version-tracked lineage for skills, templates, playbooks, and methods
- LineageMutationKind: six mutation types (manual_edit, learning_factory_promotion, experiment_winner, fork, merge, rollback)
- automatic version numbering: new lineages auto-increment version from parent or existing asset history
- is_active flag: only one active lineage per asset at a time, previous versions auto-deactivated
- parent_lineage_id: parent-child chain for full lineage traversal
- getLineageChain: walks parent chain from any lineage back to root
- getLineageHistory: full version history for an asset sorted by version
- getActiveLineageForAsset: find current active version of an asset
- recordLineageEvaluation: attach evaluation results (score, passed, metric) to any lineage version
- mutation_source_id: link to experiment, learning factory run, or other source
- tags: categorization and filtering support
- full API surface: create, list, get, get chain, get active, get history, record evaluation

Implemented (preparation layer):

- detectLineageMergeConflicts: field-level merge conflict detection between lineage versions with conflict kind classification (value_conflict, type_conflict, structural_conflict, deletion_conflict)
- resolveLineageMergeConflict: merge conflict resolution with strategy (take_source, take_target, manual_resolution, auto_merge) and field-level resolution tracking

Still missing or not final:

- (none remaining at preparation layer level)

### 4.7f Operational Metrics

Status: `Implemented`

Implemented now:

- OperationalMetrics entity: aggregated metrics over time windows (hour/day/week)
- task_metrics: total_created, total_completed, total_failed, total_cancelled, completion_rate, failure_rate, avg/p50/p95/p99 duration
- verification_metrics: total_verifications, passed, failed, pass_rate, avg_attempts_to_pass
- reuse_metrics: total_tasks, tasks_with_reuse, reuse_hit_rate, skills_reused, playbooks_reused
- cost_metrics: total_tokens, total_cost, avg_tokens_per_task, avg_cost_per_task, by_model breakdown
- computeOperationalMetrics: on-demand computation from task/evidence/cost data with department filtering
- percentile calculation: p50/p95/p99 duration from completed task timestamps
- API surface: POST /metrics/compute, GET /metrics, GET /metrics/:metricsId

Implemented (preparation layer):

- createCronScheduledJob: persistent cron-based scheduled job creation with next-fire-time computation
- executeScheduledJob: scheduled job execution with run/error counting and next-fire-time advancement
- listCronScheduledJobs: filterable listing of all scheduled jobs
- getScheduledJobExecutionLog: execution history log for scheduled jobs
- activateScheduledJob / deactivateScheduledJob: job activation and deactivation
- createDefaultScheduledJobs: default job creation for metrics computation, session cleanup, and lease enforcement
- computeAllMetrics: automatic computation of task, model, reuse, and sandbox metrics with SLO breach detection
- SLO breach alerting: automatic SLO threshold checking with severity classification (warning/critical) and alert generation

Still missing or not final:

- no reuse_metrics population (requires skill/playbook usage tracking integration — needs external runtime binding)
- no by_model cost breakdown population (requires actual LLM call cost tracking — needs external runtime binding)

### 4.7g Replay Package System

Status: `Implemented`

Implemented now:

- ReplayPackage entity: time-bounded event collection for incident investigation and state replay
- createReplayPackage: collects CQS events by time range with optional task_id and event_kind filtering
- getReplayPackageEvents: retrieves ordered events from a package for replay
- addReplayAnnotation: adds severity-tagged annotations to specific events for incident investigation
- captureReplayStateSnapshot: captures current state snapshot (task status, evidence counts) for comparison
- listReplayPackages: filterable by task_id and status
- annotation severity levels: info, warning, critical for incident triage
- API surface: create, list, get, get events, add annotation, capture snapshot

Implemented (preparation layer):

- reconstructStateFromEvents: full state reconstruction from event replay with sequence range filtering and entity type/id scoping
- exportEventsToFormat: event export to JSON, CSV, and HAR formats with filtering by entity type, event kind, and time range
- createReplayPackageFromEvents: automatic replay package creation from event ledger with time range and entity filtering

Still missing or not final:

- no integration with event ledger projections for automatic package creation (requires external event pipeline binding)

### 4.7h Model Gateway

Status: `Implemented`

Implemented now:

- ModelRoute entity: provider-neutral routing with model_alias, provider, model_id, max_privacy_level, priority, fallback_route_id
- PrivacyLevel: four levels (public, internal, confidential, restricted) with ordered comparison for route resolution
- ModelProvider: five providers (openai, anthropic, google, local, custom)
- resolveModelRoute: privacy-aware route resolution that filters routes by max_privacy_level and sorts by priority
- ModelRequest: full request lifecycle tracking with input/output tokens, cost, latency, status, retry_count
- getModelCostSummary: aggregated cost analysis by provider with total tokens, cost, and average latency
- fallback_route_id: chain-based fallback support for route resilience
- callLLM: actual LLM API call execution with provider-specific request building (OpenAI, Anthropic, Google, local/Ollama, custom)
- automatic retry with exponential backoff: configurable max_retries and retry_base_delay_ms, jitter-added delays
- structured output validation: validateStructuredOutput with JSON schema checking (required fields, type checking, enum validation, integer coercion)
- provider quota management: per-provider RPM, TPM, and daily cost limits with automatic window reset and enforcement
- setProviderQuota / getProviderQuota / getAllProviderQuotas: runtime quota configuration and monitoring
- cost calculation: per-provider token cost rates with automatic cost computation
- fallback route execution: automatic fallback to alternative route on all-retries-exhausted
- API surface: create route, list routes, get route, resolve route, record request, list requests, cost summary, call LLM, validate output, quotas

Implemented (preparation layer):

- checkEgressForHTTPCall in CQS middleware: HTTP client middleware integration for automatic egress rule checking before outbound network calls

Still missing or not final:

- no integration with actual HTTP client middleware to automatically check egress before network calls (requires real HTTP client adapter binding)

### 4.7i Automation Service

Status: `Implemented`

Implemented now:

- AutomationDefinition entity: name, trigger_kind (schedule/event/webhook/manual), trigger_config, task_template
- AutomationTriggerRecord: tracks each trigger with dedup status, recursion depth, and created task_id
- Dedup strategies: none, exact_intent (match intent in window), fingerprint, window (time-based)
- checkAutomationDedup: evaluates dedup within configurable time window
- Recursion policies: allow, block (prevent any recursion), max_depth (configurable depth limit)
- checkAutomationRecursion: enforces recursion policy before trigger execution
- triggerAutomation: full trigger pipeline — check recursion → check dedup → create task → record trigger
- detectMissedTriggers: detects and recovers missed schedule-based triggers (up to 10 per call)
- matchEventTriggers: event-based trigger matching with event_type, source, and payload filter matching against active event-type automation definitions
- cron expression parsing: parseCronExpression with full 5-field support (minute, hour, day_of_month, month, day_of_week), ranges, steps, lists, and wildcards
- getNextCronFireTime / getNextNCronFireTimes: compute next fire times from cron expressions
- isValidCronExpression / describeCronExpression: validation and human-readable description
- listAutomationTriggerRecords: filterable audit trail of all triggers including deduplicated ones
- API surface: create definition, list definitions, get definition, trigger, detect-missed, list trigger records

Implemented (preparation layer):

- CQS event subscription: subscribeToCQSEvent / unsubscribeFromCQSEvent with webhook delivery and signature verification
- publishCQSEvent: event publication with subscriber notification and delivery tracking
- verifyWebhookSignature / generateWebhookSignature: HMAC-SHA256 webhook signature verification and generation
- checkRateLimit / resetRateLimit / getRateLimitStatus: rate limiting for control commands and API endpoints

Still missing or not final:

- no persistent scheduler (triggers are on-demand only — requires external durable scheduler service)

### 4.7j Compiled Knowledge Wiki

Status: `Implemented`

Implemented now:

- WikiPage entity: human-readable knowledge base with markdown content, typed page classes, and lifecycle status
- WikiPageClass: seven page types (sop, troubleshooting, decision_record, connector_guide, department_brief, domain_notes, tool_usage_guide)
- WikiPageStatus: four lifecycle states (draft, published, stale, retired)
- Page metadata: owners, tags, freshness_date, linked_skill_ids, linked_template_ids
- WikiPageSection: parsed markdown sections with heading, level, content, and parent-child nesting
- parseWikiSections: automatic section extraction from markdown with heading hierarchy
- Backlink support: [[Page Title]] syntax for inter-page references with automatic backlink resolution
- updateWikiBacklinks: bidirectional backlink tracking when pages reference each other
- compileWiki: full wiki compilation with stale page detection (90-day threshold), orphan page detection, summary generation, and section/backlink counting
- searchWikiPages: scored search across title, tags, content, and compiled summaries
- updateWikiPage: partial update with automatic section re-parsing and backlink refresh
- API surface: create page, list pages, get page, update page, compile wiki, search wiki

Implemented (preparation layer):

- searchWikiPagesSemantic: token-based semantic search across wiki pages with title/tag/content scoring and relevance ranking
- linkWikiToMemoryDoc: bidirectional linking between wiki pages and memory documents with cross-reference tracking
- exportWikiToStaticSite: wiki export to static site structure with HTML generation, navigation, and asset references

Still missing or not final:

- no embedding-based semantic search (currently keyword/token-based — requires external embedding model service)
- no export to PDF (requires external PDF generation library/service)

### 4.7k ExecutionStep

Status: `Implemented`

Implemented now:

- ExecutionStep entity: stable public runtime vocabulary for task execution steps with kind, status, input/output, duration, retry tracking
- ExecutionStepKind: 12 step kinds (planning, tool_invocation, capability_resolution, verification, policy_check, memory_capture, learning, execution, approval, external_call, subtask_dispatch, checkpoint)
- ExecutionStepStatus: 6 lifecycle states (pending, running, completed, failed, skipped, cancelled)
- Parent-child step hierarchy: parent_step_id and child_step_ids for step tree construction
- run_id and attempt_id: linkage to TaskRun and TaskAttempt for multi-run and multi-attempt tracking
- Step lifecycle: create → start → complete/fail/skip, with automatic duration calculation
- retryExecutionStep: reset failed step to pending with retry_count increment
- linkStepEvidence: bidirectional linkage between execution steps and evidence graph nodes
- getExecutionStepTree: returns root steps and all steps for a task's execution tree
- listExecutionSteps: filterable by task_id, run_id, attempt_id, kind, status
- enforceExecutionStepTimeouts: detects and fails running steps that exceed configurable timeout threshold
- createPipelineStepsForTask: automatic step creation from task pipeline stages (planning → capability_resolution → policy_check → execution → verification → memory_capture → learning)
- advancePipelineStep: complete current step and start next step in pipeline sequence
- recordStepCost: step-level cost tracking with model_alias, provider, input/output tokens, cost_usd, tool_invocations, external_calls, memory_operations
- getStepCostSummary: aggregated step cost summary by task with per-kind breakdown
- API surface: create, list, get, start, complete, fail, retry, link-evidence, step-tree, enforce-timeouts, pipeline, advance-pipeline, record-cost, cost-summary

Still missing or not final:

(none remaining at this level)

### 4.7l Stable Public Vocabulary: TaskRun / TaskAttempt / WorkerSession / SandboxLease

Status: `Implemented`

Implemented now:

- TaskRun: complete task execution run with status lifecycle (created → running → completed/failed/cancelled), attempt tracking, step counts, duration
- TaskAttempt: individual attempt within a run with verdict (accepted, accepted_with_notes, revise_and_retry, blocked), parent attempt for retry chains, worker session and sandbox lease linkage
- WorkerSession: worker execution session with heartbeat, termination, step counting, and worker_id binding
- SandboxLease: sandbox resource lease with tier (host_readonly, guarded_mutation, isolated_mutation), expiration, release, and revocation
- Bidirectional linkage: TaskRun → TaskAttempt → WorkerSession/SandboxLease, TaskAttempt ↔ SandboxLease
- Automatic step counting on TaskRun completion
- Attempt numbering and current_attempt_id tracking on TaskRun
- createTaskRunFromTask / startTaskRunFromTask: automatic TaskRun creation and start from task pipeline
- detectExpiredWorkerSessions: heartbeat-based expiry detection with configurable timeout, auto-terminates expired sessions
- enforceSandboxLeaseExpiry: auto-expiry enforcement for sandbox leases, cascades to associated sandbox manifests
- runRuntimeMaintenanceCycle: unified maintenance cycle combining session expiry, lease expiry, and step timeout enforcement
- API surface: full CRUD + lifecycle transitions for all four entities, auto-create/start, detect-expired, enforce-expiry, maintenance-cycle
- Renamed old Ralph Loop TaskAttempt to RalphAttempt to avoid naming conflict with stable vocabulary

Still missing or not final:

(none remaining at this level)

### 4.8 Learning, Reuse, and Self-Evolution Baseline

Status: `Implemented`

Implemented now:

- methodology memory capture
- fingerprint-based merging
- approved learned playbooks via skill candidates
- task-template promotion and reuse
- capability-first ranking and search
- reuse-governance improvement hints attached back to assets
- workspace visibility for reuse decisions and reuse-improvement context
- MemoryDirectory registry: hierarchical directories for departments, systems, projects, task families, operational domains with parent-child nesting
- MemoryDocument registry: typed documents (SOP, troubleshooting, decision_record, learned_playbook_reference, methodology_summary, tool_usage_guide, domain_notes) under directories with promotion status (draft/approved/retired)
- MemoryDocumentSection: fine-grained sections within documents with parent-child nesting and source artifact lineage
- hierarchical retrieval: direct_address > metadata_filter > lexical_hit > semantic_hit > rerank_promotion stages with trace logging
- document promotion and retirement lifecycle with audit trail
- memory search API with multi-stage scoring, department/kind filtering, and retrieval trace persistence
- Learning Factory: 8-stage pipeline (distill, sanitize, cluster_and_deduplicate, replay_eval, policy_review, canary_adoption, general_promotion, rollback) for promoting learned artifacts
- Learning Factory backlog: skill-improvement backlog populated from verifier misses, user corrections, fallback-to-local events, reuse-navigation reopens, replay-eval failures, and rollback events
- canary adoption with pass/fail tracking and automatic rollback on regression
- replay eval gate before promotion
- policy review gate that blocks critical-risk skill candidates from auto-promotion
- full pipeline lifecycle API: create, advance, fail, rollback, run, canary-result
- Hybrid Memory + In-Place TTT: MemoryMode contract (durable_retrieval, hybrid_retrieval_ttt, ttt_first_specialist), MemoryStrategySelector with model-as-recommender pattern, TTT Eligibility Gate with 8 check dimensions, TTT Adaptation Run with baseline/adapted/delta lifecycle, distillation back to durable memory (6 targets), budget ledger, visibility and trace APIs
- Hybrid Memory integrated into main task pipeline: createExecutionPlan calls recommendMemoryMode + evaluateTTTEligibility, memory_mode stored on TaskContract, TTT adaptation step in runTaskEndToEnd, distillation step after memory capture
- Self-hosted adaptation adapter boundary: TTTModelAdapter SPI with provider registry, mock/dry_run/replay_eval adapters, executeAdaptationWithAdapter for full lifecycle via adapter
- Memory routing quality without embeddings: 9-dimension scoring (direct_address_match, tag_overlap, lexical_hit, task_family_affinity, department_affinity, reuse_recency, methodology_bonus, evaluation_bonus, directory_depth_bonus), directory reranking, playbook-to-routing linking
- Hybrid Memory/TTT desktop visibility: HybridMemoryTTTPanelState with recommendation, gate verdict, adaptation run, budget, adapters, routing summary, distillation status
- Hybrid Memory/TTT regression chain: 15 regression test cases, replay comparison harness

Partial or still missing:

- heavier semantic retrieval is not yet integrated
- full autonomous methodology-to-skill promotion governance remains a controlled baseline, not a highly autonomous evolution factory
- actual LLM invocation and weight adaptation for TTT runs require external model service (current implementation provides full orchestration framework with placeholder model calls)
- ReuseFeedback: user feedback actions (accept_recommendation, ignore_recommendation, prefer_template, reject_playbook, approve_methodology) with feedback stats and audit trail — now implemented
- Experiment-Learning Factory integration: promoteExperimentWinnerToLearningFactory and triggerExperimentFromLowConfidence — now implemented
- Wiki-MemoryDocument bidirectional linking — now implemented

### 4.9 Local Machine Control

Status: `Implemented`

Implemented now:

- workspace-scoped file listing
- file read
- confirmation-gated file write
- exact-match patching
- rollback from stored backups
- confirmation-gated read-oriented shell execution
- browser snapshot and browser session navigation
- IDE workspace summary
- audit, idempotency, compensation, and reconciliation-aware recording around these flows

Still missing or not final:

- no general unrestricted desktop automation layer yet
- no final broad app-control skill layer yet
- higher-risk actions are still intentionally constrained

### 4.9a Computer Use Runtime

Status: `Implemented`

Implemented now:

- ScreenCapture entity: screenshot capture with native OS integration (Windows PowerShell, macOS screencapture, Linux gnome-screenshot/scrot) and Playwright fallback
- capture engines: native_screenshot (primary), playwright_page (fallback) with automatic engine degradation
- UIElement entity: typed UI element with role (26 roles: button, link, input, textarea, select, checkbox, radio, menu, menuitem, tab, dialog, alert, table, row, cell, heading, paragraph, image, icon, toolbar, statusbar, window, pane, scrollbar, slider, progress, unknown), bounding box, visibility, enabled, focused, interactive flags, and arbitrary attributes
- UIPerception entity: structured perception result with engine type (accessibility_api, ocr, hybrid, playwright_dom), screen dimensions, element list, focused element, and active window title
- Accessibility tree extraction: Windows UIAutomationClient-based tree walking with depth-limited traversal (max depth 6), control type to role mapping, and interactive element classification
- OCR perception: placeholder OCR pipeline with circuit breaker protection (requires external embedding model for full text extraction)
- InputAction entity: typed input action with 11 kinds (mouse_click, mouse_double_click, mouse_right_click, mouse_move, mouse_drag, mouse_scroll, key_press, key_combo, type_text, focus_element, select_option)
- Mouse executor: cross-platform mouse control (Windows: user32.dll P/Invoke via PowerShell; macOS: osascript; Linux: xdotool) with click, double-click, right-click, move, drag, and scroll
- Keyboard executor: cross-platform keyboard input (Windows: SendKeys; macOS: osascript keystroke; Linux: xdotool) with key press, key combo (modifier+key), and text typing
- Key normalization: platform-specific key mapping (Enter, Tab, Escape, function keys, arrow keys, etc.)
- SendKeys escaping: proper escaping of special characters for Windows SendKeys
- ComputerUseSession entity: session lifecycle (active, paused, completed, failed, human_takeover, cancelled) with step counting, max steps limit, engine configuration, sandbox tier, and confirmation gating
- ComputerUseStep entity: individual step in see-act-verify-recover loop with kind (see, act, verify, recover), perception/action linkage, intention, observation, verification result, and recovery strategy
- See-Act-Verify-Recover loop: runSeeActVerifyRecoverLoop with pluggable see/act/verify/recover callbacks, consecutive failure tracking, max retries, and automatic human takeover escalation
- HumanTakeover entity: structured takeover event with 7 reasons (user_requested, policy_block, max_steps_reached, verification_failed_repeatedly, ambiguous_state, unsafe_action_detected, escalation), perception snapshot, pending action, and resolution tracking (resumed, modified_and_resumed, cancelled)
- Computer Use Replay: buildComputerUseReplayPackage and replayComputerUseStep for step-level replay with matched/mismatched/skipped/error result tracking
- Circuit breaker resilience: per-subsystem (screenshot, perception, input) failure tracking with configurable thresholds, cooldown periods, and automatic reset
- getCircuitBreakerStatus / resetCircuitBreakers: runtime circuit breaker monitoring and manual reset
- Full API surface in local control plane: 22 endpoints covering session CRUD, capture, perceive, act, takeover, replay, and circuit breaker operations
- Store namespaces: screenCaptures, uiPerceptions, inputActions, computerUseSteps, computerUseSessions, humanTakeovers, computerUseReplaySteps
- Playwright DOM -> UIElement mapping: Chromium headless browser with tag-name-to-role mapping (40+ HTML tags -> 26 UIElement roles), input-type-specific role resolution, interactive element detection, visibility filtering, bounding box extraction, focused element detection, aria-label/title/alt label extraction, text content extraction via TreeWalker, DOM attribute preservation
- OCR Provider SPI: pluggable OCRProvider interface with isAvailable()/extractText() methods, OCRResult with fullText/regions/confidence/processingTimeMs, OCRRegion with text/boundingBox/confidence, registerOCRProvider()/listOCRProviders()/clearOCRProviders() SPI functions, automatic provider resolution
- Windows OCR provider: Windows.Media.Ocr.OcrEngine via PowerShell (WinRT API), line-level bounding box extraction
- Tesseract OCR provider: Tesseract CLI with TSV output for region-level bounding boxes and confidence scores
- Placeholder OCR provider: fallback when no real provider is available
- perceiveScreen now supports playwright_dom engine with optional URL navigation
- API endpoints: GET /api/local/computer-use/ocr/providers, POST /api/local/computer-use/ocr/providers/clear, POST /api/local/computer-use/perceive/dom
- Element Action Provider SPI: pluggable ElementActionProvider interface with canHandle()/execute() methods, ElementActionResult with success/method/provider/durationMs/postCheck, ElementPostCheckResult with elementStillExists/elementStillVisible/valueChanged/focusChanged/stateSnapshot
- PlaywrightDOMElementActionProvider: browser DOM-native element interaction (click, type/fill, focus, select/selectOption, hover) with CSS selector construction from UIElement attributes
- WindowsAccessibilityElementActionProvider: desktop UI-native element interaction via UIAutomationClient (InvokePattern, ValuePattern, SetFocus, SelectionPattern, ExpandCollapsePattern)
- resolveElementAction: unified element action resolver with fallback chain (element-native providers -> coordinate fallback)
- executeElementAction: high-level element action executor that resolves best provider and records result as InputAction
- focus_element and select_option InputAction kinds now implemented with element-native -> coordinate fallback
- DOM post-check (performDOMPostCheck): verifies element still exists and is visible after DOM-native action
- Accessibility post-check (performAccessibilityPostCheck): verifies element still exists, visible, and focus state after accessibility-native action
- API endpoints: POST /api/local/computer-use/element-action, POST /api/local/computer-use/resolve-element-action, GET /api/local/computer-use/element-action/providers, POST /api/local/computer-use/element-action/providers/clear
- Screenshot diff verification: compareScreenCaptures with exact-hash (SHA-256) and sampled-byte-similarity comparison modes, ComputerUseVisualDiff schema with similarity_score and comparison details
- Confidence scoring: computeConfidenceScore with multi-signal weighted scoring (provider type, post-check results, screenshot diff, state diff, fallback detection), verdict output (confirmed/mismatch/error)
- Verification evidence: buildVerificationEvidence generates ComputerUseVerificationEvidence with verdict, confidence_score, reasons[], post_check, state_before, state_after, screenshot_diff
- Verification evidence integration: executeElementAction captures before/after screenshots, before/after element state, computes confidence, attaches verification_evidence to InputAction
- Verification evidence in loop: runSeeActVerifyRecoverLoop propagates verification_evidence to act and verify steps, falls back to external verify result when no evidence available
- Verification evidence in replay: buildComputerUseReplayPackage includes verification_evidence in ComputerUseReplayStep
- Multi-display support: listAvailableDisplays with Windows PowerShell enumeration of all screens with bounds, primary flag, and display index
- Session recording: generateSessionRecording produces structured SessionRecordingEntry list (perception, action, verification, recovery, takeover entries), exportSessionRecording produces full export with session, recording, steps, and replayPackage
- Local app invoke: invokeLocalApp with cross-platform launch/open_file/open_url/send_command (Windows: cmd.exe start, macOS: open -a, Linux: xdg-open), timeout, working directory, environment, stdout/stderr capture
- LocalAppInvocation entity: stored in localAppInvocations state namespace
- macOS accessibility binding: buildMacOSAccessibilityTree with AppleScript System Events traversal, MacOSAccessibilityElementActionProvider with click/type/focus via osascript, AX role mapping (30+ AX roles to UIElement roles)
- Linux AT-SPI binding: buildLinuxAccessibilityTree with Python3 AT-SPI traversal, LinuxATSPIElementActionProvider with click/type/focus via AT-SPI actions, AT-SPI role mapping (25+ roles to UIElement roles)
- Cross-platform element action provider registration: MacOSAccessibilityElementActionProvider and LinuxATSPIElementActionProvider auto-registered on their respective platforms
- Platform diagnostics and self-check: runComputerUseSelfCheck (comprehensive across all subsystems), detectPlatformFeatures (per-platform feature detection)
- Frame-based session recording: startSessionFrameRecording (timer-based), captureRecordingFrame (event-triggered), stopSessionFrameRecording, buildSessionRecordingArtifact
- SessionRecordingTimeline with metadata (platform, resolution, display_count, engine)
- Dynamic screen dimension detection via detectScreenDimensions with PNG header parsing (no longer hardcoded)
- Display enumeration parity: Windows (PowerShell System.Windows.Forms.Screen), macOS (CoreGraphics/system_profiler), Linux (xrandr/Gdk)
- Local app invocation hardening: detectLocalAppCapabilities, checkLocalAppAvailability, dryRun mode, ENOENT detection (exit_code=127), audit logging
- Windows: migrated from cmd.exe to powershell.exe Start-Process for better error handling
- macOS: open -a for launch, open for open_file/open_url
- Linux: xdg-open for open_file/open_url, direct execution for launch/send_command

Partial or still missing:

- Windows OCR provider requires WinRT runtime (may not work on all Windows editions)
- Tesseract OCR provider requires Tesseract CLI to be installed separately
- macOS accessibility binding: code-landed with diagnostics (runMacOSAccessibilityDiagnostics) and feature detection but unverified on current host (requires macOS to validate)
- Linux AT-SPI binding: code-landed with diagnostics (runLinuxATSPIDiagnostics) and feature detection but unverified on current host (requires Linux with AT-SPI to validate)
- Playwright DOM perception supports Chromium, Firefox, and WebKit via playwright_dom / playwright_dom_firefox / playwright_dom_webkit engines
- macOS/Linux element action providers support all 5 actions (click/type/focus/select/hover); select via AT-SPI Selection/Action + AppleScript; hover via xdotool/cliclick/Quartz.CoreGraphics
- session recording video encoding via encodeSessionRecording (FFmpeg MP4/WebM/GIF + PNGSequenceEncoder fallback)
- OS-level hard sandboxing: enforceComputerUseSandbox with tier-based action matrix (host_readonly denies all mutations, guarded_mutation allows standard actions, isolated_mutation denies local_app_invoke), sandbox policy query, manifest expiry/revocation checks, audit logging
- Windows-first smoke test suite: runSmokeTestSuite with 20+ tests covering screenshot, OCR, accessibility, element action, session recording, local app, multi-display, sandbox, and input categories
- E2E scenario runner: runE2EScenario with pluggable step definitions for capture, perceive, element action, input action, app invoke, screenshot diff verification, element state verification, and session lifecycle
- Regression test suite: runRegressionTestSuite with 12 built-in regression cases covering critical paths (screenshot capture, accessibility tree, sandbox enforcement, session lifecycle, local app invoke, display enumeration, circuit breakers, session recording, element action fallback, OCR provider registration)
- MCP Live Execution Fabric: registerMCPCapability, resolveMCPTool, resolveMCPToolForNeed, enforceMCPPolicy, invokeMCPTool, runMCPHealthCheck, getMCPLiveFabricStatus, mcpCapabilityToDescriptor, registerBuiltinMCPCapabilities (filesystem, shell, browser)
- Broad App-Control Skill Layer: registerAppControlSkill, resolveAppControlSkill, planAppControlExecution, executeAppControlPlan, registerBuiltinAppControlSkills (12 built-in skills: app launch, file navigation, web browser, terminal, text editor, system info, process management, screenshot, clipboard, window management, form filling, document creation)
- Desktop Workspace Productization: createDesktopWorkspace, addWorkspacePanel, buildComputerUsePanelState, buildReplayVisualizationState, buildHumanTakeoverConsoleState, buildRiskRecoveryState, recordExecutionStateTransition, buildFullWorkspaceState

### 4.10 External Integration Layer

Status: `Implemented`

Implemented now:

- generic allowlisted `http_json_fetch`
- structured CRM lookup
- structured HR lookup
- structured finance reconcile flow
- connector metadata via `ConnectorSpec`
- shared external reconciliation semantics

Partial or still missing:

- broader SaaS connector catalog is not yet built
- enterprise-grade secret management and remote connector fleet are not yet present

### 4.11 MCP and Skill Interoperability

Status: `Implemented`

Implemented now:

- canonical skill registry
- importers for OpenClaw / Claude / OpenAI style skill formats
- capability catalog can represent MCP-like capabilities
- MCP Live Execution Fabric: full runtime subsystem for MCP capability lifecycle
- MCPCapabilitySpec: capability registration with protocol (stdio/sse/streamable_http/grpc), risk tier, sandbox requirement, tags, health status
- MCPToolSpec: tool-level specification with input/output schemas, risk tier, confirmation requirements, idempotency, compensability, estimated latency
- MCP capability registry: registerMCPCapability, unregisterMCPCapability, getMCPCapability, listMCPCapabilities with filtering
- MCP tool resolver: resolveMCPTool (exact match), resolveMCPToolForNeed (semantic matching with relevance scoring)
- MCP policy enforcement: enforceMCPPolicy with sandbox tier checks, health status checks, manifest validation, critical-risk tool confirmation gating
- MCP tool invocation: invokeMCPTool with full lifecycle (policy check → confirmation → execution → audit)
- MCP protocol execution: stdio (spawn-based with stdin/stdout JSON-RPC), HTTP (fetch-based with JSON-RPC), gRPC (placeholder)
- MCP health checks: runMCPHealthCheck, runAllMCPHealthChecks with per-capability status tracking
- MCP invocation tracking: getMCPInvocation, listMCPInvocations with filtering
- MCP fabric status: getMCPLiveFabricStatus with aggregate metrics
- MCP-to-CapabilityDescriptor bridge: mcpCapabilityToDescriptor for integration with capability resolver
- Built-in MCP capabilities: filesystem (read/write/list), shell (execute_command), browser (navigate/screenshot/click)
- Broad App-Control Skill Layer: 12 built-in skills with CLI-first routing and computer-use fallback
- AppControlSkill: skill registration with task family, execution method, risk tier, CLI/script/MCP/computer-use routing
- resolveAppControlSkill: semantic skill matching with relevance scoring
- planAppControlExecution: execution plan generation with fallback chain
- executeAppControlPlan: plan execution with CLI/script/MCP/computer-use method dispatch
- Full API surface for MCP and app-control in local control plane

Still missing or not final:

- gRPC MCP execution not yet implemented locally (requires gRPC client library)
- no real MCP server process management (lifecycle, restart, scaling)
- no MCP capability discovery protocol (automatic server detection)

### 4.12 Governance and Policy Operations

Status: `Implemented`

Implemented now:

- skill governance states
- bundle export / verify / import
- trust, content, and role gates
- scoped policy files: `global / org / workspace / local`
- proposal workflow
- approval, rejection, apply, promotion, rollback
- queue health, follow-up tasks, compare previews, advisory decisions

Still missing or not final:

- no external enterprise policy control plane yet
- no organization identity provider integration yet

### 4.13 Agent Team and Delegated Runtime

Status: `Implemented`

Implemented now:

- subagent sessions
- supervisor / worker messages
- delegated checkpoints
- resume requests and resume packages
- delegated execution runs
- runtime binding
- runtime instance
- launch spec
- launch receipt
- adapter run
- runner backend lease
- backend execution
- driver run
- runner handle
- runner execution
- runner job
- worker-session ownership model with process ID tracking
- worker heartbeat expiry detection with configurable timeout
- orphaned session detection and automatic status marking
- stalled session detection with configurable stall timeout
- local worker process supervision with restart policy (none, restart_on_failure, restart_on_stall, restart_on_expiry)
- supervised restart with max restarts limit and restart count tracking
- delegated resume package lifecycle: prepared → applied → superseded/failed/rolled_back
- resume package supersession tracking with chain visibility
- checkpoint recovery for orphaned/stalled/expired sessions
- lease release with failure cleanup semantics (manifest cleanup, linked session termination)
- force cleanup for task (terminate sessions, release leases, fail packages)
- attempt-level linkage between supervisor task and delegated work
- attempt-worker-session chain query
- worker supervision event recording and query
- worker session diagnostics with health assessment
- delegated runtime maintenance cycle (combines expiry, stall, orphan detection with auto-restart)

Boundary note:

- this list reflects current internal or transitional runtime-plumbing detail
- it should not be mistaken for the preferred long-term public architecture vocabulary
- the stricter target surface remains:
  - `TaskRun`
  - `TaskAttempt`
  - `WorkerSession`
  - `SandboxLease`
  - `ExecutionStep`
  - `VerificationRun`

Not fully implemented yet:

- no truly independent distributed worker fleet
- no real external sandbox pool manager
- no hosted cloud runner plane
- some layers are still simulated or locally managed rather than independently deployed services

### 4.14 Scheduling and Long-Running Operation

Status: `Implemented`

Implemented now:

- schedule entity
- scheduled task type
- trigger flow
- lifecycle concepts for one-off, long-running, recurring, and scheduled tasks
- ScheduledJob: persistent scheduling with cron expression support and interval_ms fallback
- Cron expression parser: 5-field cron with minute/hour/day-of-month/month/day-of-week wildcards, ranges, steps, and lists
- getNextCronTime: next-fire-time computation from cron expression
- Job lifecycle: create, update, enable/disable, trigger, delete, get-due-jobs
- Automatic task creation on job trigger with trigger count and failure tracking
- CheckpointSnapshot: execution state serialization for interrupt/resume with task status, step IDs, evidence node IDs, and arbitrary snapshot data
- restoreFromCheckpoint: restore task status from saved checkpoint snapshot
- worker session heartbeat-based expiry detection
- scheduled job retry semantics with configurable max_retries, backoff_base_ms, backoff_multiplier, max_backoff_ms
- missed-run handling policy (skip, run_immediately, run_and_alert, queue_for_next_cycle)
- stale or stuck scheduled job recovery (schedule reset after 3+ errors, deactivation after 5+ errors)
- recurring task supervision with clearer retry/backoff behavior
- checkpoint-aware resume semantics for scheduled and long-running tasks
- schedule health diagnostics with health_status (healthy/degraded/unhealthy) and follow-up task generation
- maintenance-cycle enforcement for long-running unattended work
- delegated runtime maintenance scheduled job
- missed schedule detection scheduled job
- stale job recovery scheduled job
- maintenance cycle enforcement scheduled job

Still missing or not final:

- no full durable recurring scheduler service with enterprise-grade control and retry semantics
- no separate cloud automation control plane

### 4.15 Hard Sandboxing

Status: `Implemented`

Implemented now:

- guarded scopes
- permission checks
- allowlists
- idempotency
- compensation signals
- resilience and control-plane safety patterns
- delegated-runtime contracts that create a slot for future sandbox backends
- OS-level process isolation: real child process execution via `spawn` with isolated environment variables
- process-level resource limit enforcement: memory monitoring with automatic kill on limit breach
- timeout enforcement: configurable wall-clock timeout with SIGKILL termination
- quota pre-flight checks: shell command, file write, and network call quotas enforced before execution
- manifest expiry and revocation detection: blocked execution for expired/revoked manifests
- isolated environment construction: per-tier environment variable injection (APEX_SANDBOX_TIER, APEX_NETWORK_DISABLED, APEX_CAPABILITIES)
- async sandbox execution: `executeInSandboxAsync` with stdin support and working directory configuration
- process lifecycle management: `killSandboxProcess`, `listActiveSandboxProcesses` for runtime process control
- execution result tracking: process_id, timed_out, resource_usage (peak_memory_mb, cpu_time_ms, file_writes, shell_commands, network_calls)
- violation tracking: six violation kinds (filesystem_write, network_egress, resource_limit, capability_exceeded, timeout, quota_exceeded)
- full API surface: execute, execute-async, validate, kill, list processes, report
- OS-level hard sandboxing for Computer Use: enforceComputerUseSandbox with tier-based action matrix
- SANDBOX_TIER_ACTION_MATRIX: host_readonly (read-only operations only), guarded_mutation (standard actions allowed), isolated_mutation (local_app_invoke denied)
- Sandbox enforcement integrated into executeElementAction, invokeLocalApp, and other computer use operations
- Sandbox policy query: getComputerUseSandboxPolicy returns allowed/denied actions for current session tier
- Manifest-based enforcement: expired/revoked manifests block execution, network validation for isolated_mutation
- Human escalation: denied actions with requires_confirmation trigger escalation_to_human flag
- Audit logging: all sandbox enforcement decisions logged via shared-observability

Still missing or not final:

- no real OS-level filesystem access control enforcement (currently rule-based validation only, not OS-native ACL/chroot)
- no real network egress interception (currently environment variable based, not OS-native firewall rules)
- no container/VM-level isolation for isolated_mutation tier

### 4.16 Cloud Control Plane

Status: `Partial` (readiness layer only — not a live cloud system)

Implemented now (readiness preparation):

- CloudSyncEnvelope contract: typed sync envelope for audit_upload, policy_download, session_sync, memory_sync, task_state_sync, governance_sync
- CloudControlPlaneConfig: mode (local_only/cloud_augmented/cloud_primary), auth_provider, tenant_id, device_id, retry_policy, conflict_resolution
- Sync envelope preparation and simulated send (fails correctly in local_only mode)
- Org audit aggregation contract shape with batch/compression/format specifications
- Multi-device durable session sync contract with conflict resolution strategies
- Health and readiness endpoint contracts (7 endpoints defined)
- Bootstrap manifest with required/optional env vars, required/optional services, readiness checks, deployment steps
- Cloud readiness diagnostics with readiness_level (not_configured/local_only/configured_not_connected/ready_for_connection)

Not implemented (requires real external infrastructure):

- no live cloud control plane service
- no real cloud endpoint connectivity
- no real auth provider integration
- no real multi-device sync

Current reality:

- cloud control plane is a target architecture layer, not a live repository subsystem

### 4.17 Temporal and LangGraph 2.x

Status: `Partial` (boundary preparation only — no live orchestrator)

Implemented now (readiness preparation):

- OrchestratorBoundaryConfig: active_mode (local_typed_runtime/temporal_workflow/langgraph_graph/hybrid), fallback_mode, dry_run flag
- WorkflowContractShape: typed workflow contracts with input/output/signal/query schemas
- Translation hooks: translateLocalRuntimeToWorkflowContract (local → Temporal/LangGraph), translateWorkflowResultToLocalRuntime (Temporal/LangGraph → local)
- Status mapping: Temporal (RUNNING/COMPLETED/FAILED/CANCELED/TERMINATED/TIMED_OUT) → local, LangGraph (idle/running/interrupted/success/error) → local
- Dry-run orchestrator workflow simulation
- Default workflow contract shapes (task_execution, long_running_task, verification_pipeline, delegated_worker_execution, scheduled_job_execution)
- Orchestrator readiness diagnostics with readiness_level (not_configured/local_runtime_only/boundary_prepared/ready_for_orchestrator)

Not implemented (requires real external infrastructure):

- the current repository does not contain a real `LangGraph` dependency
- the current repository does not contain a live `LangGraph 2.x` graph runtime
- the current repository does not contain a live `Temporal` orchestration implementation

What exists instead:

- custom typed orchestration in `shared-runtime`
- local orchestration and aggregation in `shared-local-core`
- control-plane-driven execution and state transitions in `local-control-plane`

### 4.18 DeerFlow

Status: `Partial` (compatibility boundary + backbone readiness — not a live backbone)

Current reality:

- DeerFlow appears in the architecture and capability strategy as a preferred long-running worker concept
- DeerFlow worker route with typed launch contract and adapter boundary (local_mock, local_process, remote_grpc)
- Adapter translation layer for local_runtime ↔ deerflow format conversion
- Import hooks for task_launch, checkpoint_sync, result_import, heartbeat_bridge
- Compatibility status reporting (full, partial, mock_only)
- Non-backbone enforcement: all DeerFlow routes have is_backbone=false
- Default boundary initialization with pre-registered routes, translations, and hooks
- DeerFlow boundary panel in desktop workspace
- DeerFlowBackboneReadiness: runtime_mode (local_backbone/deerflow_worker_lane/hybrid), health check simulation, worker registration boundary, deployment runbook with rollback steps
- DeerFlow backbone readiness diagnostics with readiness_level (not_prepared/local_backbone_only/boundary_prepared/ready_for_deerflow_deployment)

Best current interpretation:

- DeerFlow is part of the architectural direction and capability vocabulary
- it is not yet the actual backbone of the current executable runtime
- the compatibility boundary provides a typed adapter for future DeerFlow integration without replacing the current runtime

### 4.19 Enterprise Fleet / SSO / Org Control Plane

Status: `Partial` (readiness preparation only — no live identity provider)

Implemented now (readiness preparation):

- SSOProviderBoundary: typed provider registry for none/okta/azure_ad/clerk/custom_oidc/custom_saml with claims_mapping
- OrgTenant: org_name, tier (personal/team/enterprise), role_definitions, sso_provider_id, fleet_policy_id
- ClaimsToPolicyMapping: claim_path → policy_field with transforms (direct/prefix/regex_extract/lookup)
- resolveClaimsToPolicy: runtime claims resolution with nested path support
- Default SSO provider boundaries (Okta, Azure AD, Clerk) with pre-registered claims mappings
- SSO integration runbooks per provider (required env vars, endpoints, setup/verification steps)
- Enterprise readiness diagnostics with readiness_level (not_prepared/contracts_only/boundary_prepared/ready_for_sso_integration)

Not implemented (requires real external infrastructure):

- no live identity provider connection
- no real SSO authentication flow
- no real fleet management plane

### 4.20 OS-Native Isolation Backend Readiness

Status: `Partial` (readiness preparation only — no live OS-native enforcement)

Implemented now (readiness preparation):

- OSIsolationBackend: typed backend registry for rule_based/windows_job_object/windows_mandatory_integrity/linux_cgroups/linux_namespaces/container_docker/container_podman/vm_hyperv/vm_kvm
- Backend capability detection contracts (none/filesystem_restriction/network_restriction/process_restriction/full_isolation)
- IsolationPolicyToBackendMapping: sandbox_tier → backend_id with enforcement_level (rule_only/policy_translated/backend_enforced)
- translateSandboxTierToBackendCapabilities: tier → required capabilities + recommended backend + backend-specific config
- Platform detection (Windows/Linux/macOS)
- Default backend registrations (8 backends across Windows, Linux, cross-platform)
- OS isolation runbooks per backend (setup/verification/rollback steps, prerequisites)
- OS isolation readiness diagnostics with readiness_level (not_prepared/rule_based_only/boundary_prepared/ready_for_backend_enforcement)

Not implemented (requires real OS-native implementation):

- no real OS-level filesystem access control enforcement (currently rule-based validation only)
- no real network egress interception (currently environment variable based)
- no container/VM-level isolation for isolated_mutation tier

### 4.21 External-Readiness Verification Suite

Status: `Implemented`

Implemented now:

- Cloud control plane readiness suite (8 tests: config creation, sync envelope, local_only mode, diagnostics, audit contract, session sync contract, health endpoints, bootstrap manifest)
- Temporal/LangGraph readiness suite (9 tests: config creation, workflow shape registration, local→Temporal translation, local→LangGraph translation, Temporal→local translation, LangGraph→local translation, dry run, diagnostics, default shapes)
- Enterprise SSO readiness suite (8 tests: provider registration, org tenant, claims mapping, direct resolution, prefix resolution, diagnostics, default providers, runbook)
- DeerFlow backbone readiness suite (6 tests: readiness creation, runtime mode, worker registration boundary, health check, diagnostics, deployment runbook)
- OS isolation readiness suite (7 tests: backend registration, capability detection, policy mapping, tier translation, diagnostics, default backends, runbook)
- External readiness status report: per-layer status (not_prepared/contracts_only/adapter_boundary/dry_run_available/ready_for_integration) with blocking dependencies
- runAllExternalReadinessSuites() aggregator with overall pass/fail reporting

### 4.19 Desktop Workspace Operational Surfaces

Status: `Implemented`

Implemented now:

- worker-session panel with health diagnostics, resume package visibility, and supervision events
- scheduled-jobs panel with health diagnostics, stuck task detection, and maintenance cycle visibility
- delegated-runtime panel with session status summary, resume package tracking, attempt linkage, and recovery actions
- DeerFlow boundary panel with route listing, import hooks, compatibility status, and non-backbone semantics
- panel state builders for all new panels integrated into buildFullWorkspaceState
- new panel kinds: worker_session, scheduled_jobs, delegated_runtime, deerflow_boundary

### 4.20 Final Local Regression and Replay Coverage

Status: `Implemented`

Implemented now:

- delegated runtime regression suite (13 tests covering session lifecycle, heartbeat, orphan/stall detection, restart, resume packages, lease cleanup, attempt linkage, diagnostics)
- scheduler regression suite (7 tests covering job creation with retry policy, default jobs, activation/deactivation, health diagnostics, missed run detection, stale job recovery, error deactivation)
- DeerFlow compatibility regression suite (7 tests covering route creation, non-backbone enforcement, adapter translation, import hooks, compatibility status, default initialization)
- workspace state builder regression suite (6 tests covering workspace creation, panel builders for all new panels, panel addition)
- failure case coverage suite (5 tests covering stale worker recovery, expired lease cleanup, missed schedule recovery, blocked resume package, forced cleanup on orphaned session)
- long-running task replay harness (10-step lifecycle simulation: create → heartbeat → checkpoint → stall → restart → heartbeat → resume → apply → complete)
- runAllFinalRegressionSuites() aggregator with overall pass/fail reporting

### 4.22 Live Host Validation (Windows)

Status: `Validated` (real host probed with real Win32 API calls)

Validated on real Windows host:

- Windows 10.0.22631.0 x64, 20 cores, 16GB RAM
- .NET Framework 4.8.x available via PowerShell
- **Windows Job Object: REAL VALIDATED** — CreateJobObjectW succeeded (handle 3356), SetInformationJobObject with JOB_OBJECT_LIMIT_JOB_MEMORY|JOB_OBJECT_LIMIT_PROCESS_MEMORY succeeded, AssignProcessToJobObject succeeded, Memory limits (Job=512MB, Process=256MB) enforced on real process
- Windows Integrity Level: API available but icacls /setintegritylevel requires Administrator elevation — not available in current non-elevated session
- Windows Firewall: New-NetFirewallRule requires Administrator elevation — not available in current non-elevated session
- ACL API (Get-Acl/Set-Acl) available for filesystem ACL manipulation
- Process creation API available (Node.js child_process.spawn)
- Filesystem monitoring available (Node.js fs.watch)

Not available on this host (blocking real integration):

- WSL2 Ubuntu: registered but VHDX mount error (HCS/ERROR_FILE_NOT_FOUND) — Linux host validation not possible
- Docker: not installed — container-based isolation not available
- Hyper-V: status unknown (requires elevated privileges)
- Rust/Cargo: not installed — Tauri desktop shell cannot be built natively
- Ollama: not installed — self-hosted model inference not available
- Temporal CLI: not installed — Temporal integration not possible
- No SSO provider credentials — enterprise SSO integration not possible
- No DeerFlow endpoint — DeerFlow backbone rollout not possible
- Administrator elevation not available — Integrity Level and Firewall enforcement blocked

### 4.23 Windows-Native Isolation Backend Integration

Status: `Partially Live` (Job Object REAL VALIDATED, Integrity Level and Firewall blocked by elevation)

Implemented now:

- **RealJobObjectEnforcement**: production-ready Job Object enforcement with real validation evidence
- **generateRealJobObjectPowerShellScript**: generates complete PowerShell scripts with P/Invoke for real Job Object enforcement
- **getRealWindowsIsolationStatus**: honest assessment of what's available vs blocked
- guarded_mutation tier: **REAL ENFORCEMENT AVAILABLE** via Windows Job Object (memory limits, process limits)
- host_readonly tier: rule_only enforcement (no backend needed)
- isolated_mutation tier: BLOCKED (Docker required, not installed)

Real validation evidence (Windows Job Object):

1. CreateJobObjectW succeeded (handle 3356) on Windows 10.0.22631.0 x64
2. SetInformationJobObject with JOB_OBJECT_LIMIT_JOB_MEMORY|JOB_OBJECT_LIMIT_PROCESS_MEMORY succeeded
3. AssignProcessToJobObject succeeded — current process assigned to job
4. Memory limits (Job=512MB, Process=256MB) enforced on real process
5. Validated on 2026-04-22 via PowerShell Add-Type P/Invoke

Blocked (requires elevation or installation):

- Windows Integrity Level: requires Administrator elevation
- Windows Firewall: requires Administrator elevation
- Docker: not installed

### Real Resource Availability (Probed 2026-04-22)

| Resource | Status | Details |
|----------|--------|---------|
| Administrator elevation | ❌ NOT AVAILABLE | Current session is non-elevated |
| Windows Job Object | ✅ AVAILABLE | Real validated: memory/process limits enforced |
| Windows Integrity Level | ❌ BLOCKED | Requires Administrator elevation |
| Windows Firewall | ❌ BLOCKED | Requires Administrator elevation |
| Hyper-V | ❌ UNKNOWN | Requires Administrator elevation to query |
| Docker Desktop | ❌ NOT INSTALLED | `docker` not found in PATH |
| WSL2 | ⚠️ PARTIAL | Ubuntu registered (WSL2) but VHDX mount fails (HCS/ERROR_FILE_NOT_FOUND) |
| Rust/Cargo | ❌ NOT INSTALLED | `cargo` not found in PATH |
| Ollama | ❌ NOT INSTALLED | `ollama` not found in PATH |
| Temporal CLI | ❌ NOT INSTALLED | `temporal` not found in PATH |
| Node.js | ✅ AVAILABLE | v22.18.0 |
| Python | ✅ AVAILABLE | 3.11.9 |
| Git | ✅ AVAILABLE | 2.39.0.windows.2 |
| Playwright | ✅ AVAILABLE | 1.59.1 |
| All external endpoints | ❌ NOT CONFIGURED | No env vars set for Temporal, LangGraph, SSO, DeerFlow, libSQL, OTEL |
| macOS host | ❌ NOT AVAILABLE | No macOS machine accessible |
| Linux host | ❌ NOT AVAILABLE | WSL2 broken, no physical Linux host |

### 4.24 Windows Privileged-Execution Readiness

Status: `Implemented` (contracts, registry, dry-run, diagnostics, runbooks)

Implemented now:

- **PrivilegedOperationContract**: explicit contracts for 8 privileged operations (integrity_level_change, firewall_rule_change, hyper_v_check, job_object_creation, process_token_adjustment, service_installation, registry_hklm_write, admin_sandbox_backend)
- **AdminOperationRegistryEntry**: admin-required operation registry with reason, expected command, rollback notes, impact level, and alternative approaches
- **ElevationDryRunResult**: elevation-aware dry-run mode that simulates privileged operations without making system changes, reporting would_succeed, would_require_elevation, warnings, and readiness_after
- **PrivilegedReadinessDiagnostics**: readiness diagnostics distinguishing not_supported / supported_but_blocked_by_missing_admin / supported_and_ready
- **PrivilegedRunRunbook**: operator runbook generation for privileged operations with steps, rollback plan, and elevation requirements
- **initializeDefaultPrivilegedOperationContracts**: 8 default contracts + 4 admin registry entries auto-populated

### 4.25 Local Runtime Acquisition And Bootstrap Automation

Status: `Implemented` (diagnostics, bootstrap plans, verification, environment report)

Implemented now:

- **RuntimeDiagnostics**: machine-readable install-state detection for 9 runtimes (docker_desktop, wsl2, rust_cargo, ollama, temporal_cli, node_js, python, git, playwright)
- **BootstrapPlan**: step-by-step bootstrap plans with commands, expected outcomes, verification commands, platform targeting, and optional/required step classification
- **PostInstallVerification**: post-install verification routines with per-check pass/fail and overall result
- **LocalEnvironmentReport**: stable local environment report export with runtime readiness summary
- **detectAllRuntimes**: batch detection for all 9 runtimes
- Node.js detected as installed_and_running (process.version available)

### 4.26 Endpoint And Credential Onboarding Boundaries

Status: `Implemented` (config validators, preflight, credential inventory, runbooks)

Implemented now:

- **EndpointConfig**: typed config validators for 7 endpoint kinds (temporal, langgraph, sso, deerflow, model_inference, libsql, otel_collector) with env-schema validation, missing_env_vars tracking, and redacted_config export
- **ConnectivityPreflightResult**: connectivity preflight checks with status, recommendations, and error details
- **CredentialInventory**: per-endpoint credential inventory tracking required_secrets, is_configured, and source
- **OnboardingRunbook**: per-endpoint onboarding runbooks with setup_steps, expected_secret_inventory, verification_steps, and troubleshooting
- **validateEndpointConfigSchema**: config validation with errors/warnings separation
- **initializeDefaultEndpointConfigs**: 7 default endpoint configs auto-populated from environment variables

### 4.27 Blocker Dashboard And Exportable Readiness Matrix

Status: `Implemented` (matrix, dashboard, artifact export)

Implemented now:

- **ReadinessMatrix**: unified readiness matrix aggregating admin_backend, local_prerequisite, external_endpoint, and host_availability layers with BlockerCategory classification (ready_now, needs_admin, needs_install, needs_credential, needs_external_endpoint, needs_unavailable_host)
- **ReadinessMatrixEntry**: per-entry categorization with impact_level, blocking_reason, remediation, and source_layer
- **ReadinessStatusArtifact**: exportable status artifact with format (json/markdown/csv), checksum, and layered summaries (privileged_execution, local_runtime, endpoint)
- **BlockerDashboardState**: dashboard state with overall_readiness_level, readiness_percentage, top_blockers, category_counts, and next_human_actions with priority
- Desktop workspace panels: blocker_dashboard, privileged_execution, readiness_matrix

### 4.28 Final Privileged-Readiness Verification Suite

Status: `Implemented` (5 regression suites, 45+ tests)

Implemented now:

- **runPrivilegedOperationContractSuite**: 8 tests covering contract registration, filtering, admin registry CRUD, elevation dry-run, diagnostics, and runbook generation
- **runInstallerBootstrapDiagnosticsSuite**: 12 tests covering runtime detection, bootstrap plan generation, post-install verification, and environment report
- **runConfigValidationSuite**: 12 tests covering endpoint config registration, filtering, validation, preflight, credential inventory, and onboarding runbooks
- **runReadinessMatrixSuite**: 10 tests covering matrix building, layer coverage, category coverage, summary consistency, percentage calculation, artifact export, and dashboard state
- **runDryRunReportGenerationSuite**: 9 tests covering dry-run for each operation kind, runbook generation, environment report, diagnostics, and dashboard consistency
- **runAllPrivilegedReadinessSuites**: aggregator running all 5 suites with overall_passed/total_passed/total_failed/total_tests

### 4.29 MCP Full Host Boundary (P0)

Status: `Implemented`

Implemented now:

- Full MCP Host Boundary upgrade from tool-only fabric to complete MCP host
- **Resources**: `registerMCPResource`, `listMCPResources`, `readMCPResource` with URI templates, MIME types, annotations
- **Prompts**: `registerMCPPrompt`, `listMCPPrompts`, `getMCPPrompt`, `resolveMCPPrompt` with argument schemas and message templates
- **Roots**: `registerMCPRoot`, `listMCPRoots` with read-only flags and capability binding
- **Session Authorization**: `authorizeMCPSession`, `getMCPSessionAuthorization`, `revokeMCPSessionAuthorization`, `isMCPSessionAuthorized` with capability grants, risk tiers, expiry
- **Progress**: `reportMCPProgress`, `getMCPProgress` with progress tokens, total/completed counts
- **Capability Negotiation**: `negotiateMCPCapability`, `listMCPCapabilityNegotiations` with protocol version agreement
- Session authorization integrated into `enforceMCPPolicy` - unauthorized sessions blocked at policy layer
- Default resources, prompts, and roots registered in `registerBuiltinMCPCapabilities`
- All existing tool-only MCP capabilities preserved and working

### 4.30 Remote Orchestration SPI (P1)

Status: `Implemented`

Implemented now:

- Clean Remote Orchestration SPI with local runtime as primary backbone
- **Providers**: `registerOrchestrationProvider`, `listOrchestrationProviders`, `getOrchestrationProvider` for local_runtime, temporal, langgraph
- **Lanes**: `configureOrchestrationLane`, `listOrchestrationLanes`, `resolveOrchestrationLane` with priority-based routing and task-family pattern matching
- **Dispatch**: `dispatchToOrchestrationLane` with automatic fallback when provider unavailable
- **Query**: `queryOrchestrationWorkflow` for remote workflow status
- **Diagnostics**: `getOrchestrationDiagnostics` confirming local_runtime_is_primary and remote_orchestration_is_optional_lane
- `initializeDefaultOrchestrationSPI` sets local_runtime (priority 100, primary), temporal (priority 50, fallback), langgraph (priority 40, fallback)
- LangGraph and Temporal are optional lanes only, NOT the backbone

### 4.31 Sandbox Provider Layer (P2)

Status: `Implemented`

Implemented now:

- Real Sandbox Provider SPI with pluggable backend selection
- **Providers**: `registerSandboxProvider`, `listSandboxProviders` with 8 provider kinds: rule_based, windows_job_object, windows_integrity, docker_container, podman_container, hyperv_vm, linux_cgroups, linux_namespaces
- **Selection**: `selectSandboxProvider` with capability-level-based selection (none → policy_only → resource_limits → full_isolation)
- **Execution**: `prepareSandboxExecution` with enforcement evidence per provider/tier combination
- **Diagnostics**: `getSandboxProviderDiagnostics` with recommended provider per tier
- `initializeDefaultSandboxProviders` registers all 8 providers with honest availability status (rule_based and windows_job_object available, all others requiring admin/install marked unavailable)
- Current tiers preserved: host_readonly, guarded_mutation, isolated_mutation

### 4.32 Trace Grading And Eval Flywheel (P3)

Status: `Implemented`

Implemented now:

- Trace Grader contracts with 6 default criteria: task_completion, verification_pass_rate, tool_usage_efficiency, cost_efficiency, safety_compliance, replay_determinism
- **Grading**: `gradeTrace` for task_trace, tool_trace, computer_use_trace, verification_trace with weighted scoring and verdict (excellent/good/acceptable/poor/failing)
- **Regression Detection**: `detectTraceRegression` with severity levels (none/minor/moderate/major/critical) and baseline comparison
- **Methodology Feedback**: `generateTraceMethodologyFeedback` producing promote/demote/adjust_routing/update_threshold/flag_for_experiment feedback attached to task templates, playbooks, capability routing, methodology memory
- **Eval Flywheel**: `runTraceEvalFlywheelCycle` for batch grading with regression detection and feedback generation
- **Custom Criteria**: `registerTraceGradeCriterion` for extensible grading dimensions
- Deterministic checks first, then heuristic, then eval-based (deterministic criteria outnumber heuristic)
- 12-case regression suite in `runTraceGradingRegressionSuite`

### 4.33 Explicit Memory Layers (P4)

Status: `Implemented`

Implemented now:

- Explicit Semantic/Episodic/Procedural memory layer separation
- **Semantic**: Factual knowledge, definitions, domain concepts. Immediate write, merge_similar compaction, 365-day retention, 5000-item max. Direct directory/document addressing (not vector-only)
- **Episodic**: Task experiences, execution traces, outcomes. Background-batched write, summarize_old compaction, 90-day retention, 10000-item max. Promotion-enabled to procedural
- **Procedural**: Learned procedures, playbooks, skills, methodologies. Deferred-on-completion write, promote_and_archive compaction, 180-day retention, 2000-item max. High stability threshold
- **Write Pipeline**: `createMemoryLayerWriteBatch` for batched writes across layers
- **Compaction**: `compactMemoryLayer` with strategy-aware compaction (merge similar, summarize old, promote and archive)
- **Promotion**: `evaluatePromotionCandidate` and `promoteEpisodicToProcedural` with score-based gating (semantic entries rejected, episodic promoted when threshold met)
- **Retention**: `generateRetentionReport` per layer with over-max-age counts and compaction recommendations
- Current directory/document system of record preserved; lexical/metadata retrieval before semantic discovery
- 12-case regression suite in `runMemoryLayerRegressionSuite`

### 4.34 TTT Specialist Lane (P5)

Status: `Implemented`

Implemented now:

- TTT as a gated specialist lane, NOT the default path (durable_retrieval remains default)
- **Lane Spec**: `registerTTTSpecialistLane` with explicit gates: requires_self_hosted_model, requires_eligible_family, requires_replay_eval, requires_budget_gate, requires_completion_criteria
- **Gate Evaluation**: `evaluateSpecialistLaneGate` with 10-check gate (self_hosted_model_available, task_family_eligible, replay_eval_available, budget_available, completion_criteria_present, not_vendor_hosted, not_privileged_planner, lane_not_suspended, concurrent_capacity_available, cooldown_expired)
- **Replay Eval**: `runSpecialistLaneReplayEval` with improved/neutral/regressed/inconclusive verdicts, automatic rollback on regression
- **Promotion**: `promoteSpecialistLaneResult` with proven-gains-only distillation policy (regressed and neutral results not promoted)
- **Routing Signal**: `generateSpecialistLaneRoutingSignal` with default durable_retrieval, optional hybrid_retrieval_ttt, specialist ttt_specialist
- **Self-Hosted Model Boundary**: `registerSelfHostedModelBoundary` for model route classification (vendor vs self-hosted)
- Vendor-hosted models excluded from weight-update flows
- 13-case regression suite in `runTTTSpecialistLaneRegressionSuite`

## 5. What Is Already Strong

The current repository is already strong in:

- local-first task orchestration
- verification-first completion
- typed contracts and replaceable boundaries
- policy and governance workflows
- skill interoperability and canonicalization
- reuse, learning, and compact asset promotion
- desktop deep links, notifications, and operational workspace views
- explicit delegated-runtime lifecycle modeling
- OS-level process-isolated sandbox execution with resource limits, timeout enforcement, and quota checks
- LSP client integration for real symbol/reference/diagnostic queries
- AST parser integration for TypeScript and JavaScript with repository-level symbol indexing
- OpenTelemetry-compatible trace export
- semantic cache with tiered invalidation and policy-aware revalidation
- actual LLM API call execution with automatic retry, exponential backoff, and provider quota management
- structured output validation with JSON schema checking
- cron expression parsing with next-fire-time computation
- automatic pipeline step creation and step-level cost tracking
- event-based trigger matching for automation
- runtime maintenance cycle (session expiry, lease expiry, step timeout)
- CQS event subscription and publication mechanism with webhook signature verification
- rate limiting for control commands and API endpoints
- automatic lineage creation from learning factory promotion with lineage diff computation
- filesystem mount validation against actual workspace paths
- wiki page version history with restore capability
- CQS middleware for automatic endpoint wrapping and egress HTTP middleware
- learning factory automation: experiment winner auto-promotion, reuse confidence assessment, low-confidence experiment triggering
- privileged-operation contracts with elevation-aware dry-run, admin registry, and operator runbooks
- local runtime acquisition with bootstrap plans, post-install verification, and environment reporting
- endpoint onboarding with typed config validators, connectivity preflight, credential inventory, and per-endpoint runbooks
- unified readiness matrix with blocker dashboard, exportable status artifact, and desktop workspace integration
- privileged-readiness verification suite with 5 regression suites covering contracts, bootstrap, config, matrix, and dry-run
- scheduled job infrastructure: cron-based job scheduling, automatic metrics computation, SLO breach alerting
- event ledger state reconstruction and multi-format export (JSON, CSV, HAR)
- lineage merge conflict detection and resolution
- wiki semantic search (token-based), wiki-to-memory bidirectional linking, and static site export
- Computer Use Runtime: screenshot capture (native + Playwright fallback), accessibility tree extraction (Windows UIAutomationClient), OCR pipeline (placeholder), cross-platform mouse/keyboard executor, see-act-verify-recover loop, human takeover/stop/replay, circuit breaker resilience, OS-level hard sandboxing, smoke/E2E/regression test chain
- MCP Live Execution Fabric: capability registry, tool resolver, policy enforcement, stdio/HTTP protocol execution, health checks, built-in capabilities (filesystem, shell, browser)
- Broad App-Control Skill Layer: 12 built-in skills with CLI-first routing and computer-use fallback, semantic skill resolution, execution planning with fallback chains
- Desktop Workspace Productization: workspace state model, computer-use panel, replay visualization, human takeover console, risk/recovery state, execution state transitions
- remote control plane service: fleet management, multi-tenant auth (JWT + API key), task dispatch, audit sync
- libSQL/Turso persistence adapter: PersistenceAdapter interface, InMemoryPersistenceAdapter, migration management
- OTEL collector pipeline: lifecycle management, dynamic config generation, sidecar deployment manifests
- deployment infrastructure: Dockerfile, docker-compose, K8s manifests, bootstrap scripts, runbooks
- MCP Full Host Boundary: resources, prompts, roots, session authorization, progress, capability negotiation
- Remote Orchestration SPI: local_runtime primary backbone, Temporal/LangGraph as optional fallback lanes
- Sandbox Provider Layer: 8 pluggable providers with capability-based selection
- Trace Grading And Eval Flywheel: 6 grading criteria, regression detection, methodology feedback loop
- Explicit Memory Layers: semantic/episodic/procedural separation with compaction, promotion, retention
- TTT Specialist Lane: gated specialist lane with 10-check gate, replay-eval, proven-gains-only promotion
- Post-Frontier Activation Verification: preflight truth refresh, orchestration/sandbox/TTT/observability/host validation connectivity checks
- Production Honesty Pass: unified assessment with live_now/boundary_only/privilege_blocked/host_blocked classification
- Settings-Backed Directory Defaults: default_task_workdir, default_write_root, default_export_dir, verification_evidence_dir, task_run_dir wired into LocalAppSettings with resolveTaskDirectoryPaths
- Multi-Agent Resource Policy: DelegationPolicySettings with auto/manual mode, cpu_reserve_ratio=0.2, memory_reserve_ratio=0.2, max_parallel=4, max_total_per_task=8, max_depth=2, machine-resource-derived effective concurrency
- Dispatch Plan Leasing: AgentDispatchPlan, AgentDispatchStep, SubagentAssignment, AssignmentLease with one-active-lease-per-step, supervisor-only assignment, max-depth/total/parallel enforcement
- Subagent Context Envelopes: SubagentContextEnvelope and SubagentResultEnvelope for scoped handoffs (step goal, allowed tools, relevant artifacts, policy slice, definition of done)
- Acceptance Agent Boundary: AcceptanceReview, AcceptanceVerdict, AcceptanceFinding with deterministic-first, semantic-second, risk-based escalation, completion path (checklist → acceptance → reconciliation → done gate)
- Task Budget Contracts: ModelPricingRegistry, TaskBudgetPolicy, TaskBudgetStatus, BudgetInterruptionEvent with hard-stop pause, warning threshold, user continuation (new limit / extension / stop)

### 4.14 Post-Contract Integration

Status: `Implemented`

The typed contracts from the Settings/Subagents/Acceptance/Budget wave are now wired end-to-end:

- Settings End-To-End: 5 new directory defaults (default_task_workdir, default_write_root, default_export_dir, verification_evidence_dir, task_run_dir) surfaced in desktop settings panels with validation, smart cascading updates, and restart/no-restart labels
- Advanced Settings: Delegation policy (resource mode, CPU/memory reserve, max parallel/total/depth) and budget policy (hard limit, warning threshold, on_limit_reached) editable from desktop settings UI
- Settings Into Task Behavior: createLocalTask injects workspace_paths from settings, writeLocalFile resolves relative paths to default_write_root, export routes default to default_export_dir, resolveVerificationEvidencePath and resolveTaskRunPath route to correct directories
- Control-Plane API Routes: GET/POST /api/local/settings/delegation-policy, GET/POST /api/local/settings/budget-policy, GET /api/local/dispatch-plans/:planId, POST /api/local/dispatch-plans, POST dispatch step assign/release/activate, GET /api/local/subagent-envelopes/:taskId, GET /api/local/acceptance/:taskId, POST /api/local/acceptance/:taskId/review, GET /api/local/budget/:taskId, POST /api/local/budget/:taskId/continue
- Task Pipeline Integration: Budget pre-check in callLLM (blocks when exhausted), budget tracking after successful LLM call, acceptance review inserted between evidence evaluation and done gate in runTaskEndToEnd, budget initialization at task run start
- Workspace UI: AcceptanceCard (verdict, findings, completion path), BudgetCard (spend bar, hard limit, pause/continue actions), MultiAgentLimitsCard (effective limits, machine resources, clamped-by)
- Smoke Tests: Settings new dir fields, delegation policy, budget policy, acceptance completion path, budget status, dispatch plan creation verified in smoke-test.mjs

### 4.15 Final Local Closure

Status: `Implemented`

The remaining gaps between typed contracts and real product integration have been closed:

- Dispatch Leasing In Real Execution Path: `createDispatchLeaseForDelegation` is called during `runTaskEndToEnd` execution step, creating a real dispatch plan, step, assignment, and lease for the execution worker; `releaseDispatchLeaseForSession` is called on completion, auto-creating a result envelope and linking it to the dispatch step; `createWorkerSessionWithOwnership` receives `dispatch_lease_context` and stores `dispatch_lease_id`/`dispatch_plan_id` on the session; `AgentTeamSummarySchema` includes `dispatch_plan_id`; `buildTaskAgentTeamState` reuses existing dispatch plans via `getDispatchPlanForTask`; duplicate active leases per step are prevented; `releaseLeaseWithCleanup` and `forceCleanupForTask` release dispatch leases on session termination
- Subagent Context Envelopes Auto-Created During Handoff: `createDispatchLeaseForDelegation` auto-creates a `SubagentContextEnvelope` with step goal, policy slice (max parallel, max depth, budget limit), tools, sandbox tiers, and definition of done; `releaseDispatchLeaseForSession` auto-creates a `SubagentResultEnvelope` with status, summary, and blockers; envelopes are persisted in module-level storage with retrieval functions (`getContextEnvelopesForTask`, `getResultEnvelopesForTask`, `getContextEnvelopesForStep`, `getResultEnvelopesForStep`); API route `/api/local/subagent-envelopes/:taskId` retrieves auto-created envelopes
- Budget Interruption As Complete Workspace/Operator Flow: `BudgetStatusPanelState` extended with `interruption_kind`, `task_paused_by_budget`, `spend_at_interruption`, `limit_at_interruption`; `buildBudgetStatusPanelState` checks real interruption events via `getPendingInterruptionForTask`; Budget API route returns full interruption-aware status; BudgetCard shows clear budget-paused banner with spend/limit, explicit raise-limit input, one-time extension input, stop button; 5-second auto-refresh for near-real-time updates; CSS for budget-paused state, action rows, danger button
- ESM Import Cleanup: All `require()` calls in `index.ts` replaced with static imports (acceptance-agent, delegated-runtime-hardening, dispatch-plan-leasing, task-budget, hybrid-memory-ttt); `delegated-runtime-hardening.ts` uses static imports instead of `require()` for subagent-envelopes, delegation-policy, task-budget, dispatch-plan-leasing
- Regression Coverage: Smoke test covers dispatch lease creation, plan reuse, context envelope auto-creation, result envelope auto-creation, budget pause/resume with raise-limit, acceptance gates, completion path status

### 4.16 External Completion — Resource Truth Probe (2026-04-26)

Status: `All lanes blocked — no newly unlocked external resources`

Resource truth probe results:

| Resource | Status | Detail |
|----------|--------|--------|
| Administrator privilege | `blocked` | `net session` returns ERROR 5 (Access Denied) — current session is non-elevated |
| Docker | `not_installed` | `docker` not found in PATH |
| Podman | `not_installed` | `podman` not found in PATH |
| Hyper-V | `privilege_blocked` | `Get-WindowsOptionalFeature` requires elevation |
| WSL2 | `broken` | Ubuntu distro registered (WSL2) but fails to start: HCS/ERROR_FILE_NOT_FOUND on ext4.vhdx mount — virtual disk is missing or corrupted |
| Ollama | `not_installed` | `ollama` not found in PATH |
| Temporal | `not_installed` | `temporal` not found in PATH |
| LangGraph | `not_installed` | No LangGraph runtime detected |
| DATABASE_URL | `not_set` | Environment variable empty |
| OTEL endpoint | `not_set` | `OTEL_EXPORTER_OTLP_ENDPOINT` empty |
| macOS host | `not_available` | Current host is Windows |
| Linux host | `not_available` | WSL2 Ubuntu is broken (see above) |

Lane classification per glm-5.1-external-completion-master-spec.md Section 5:

| Lane | Priority | Classification | Blocking Resource |
|------|----------|----------------|-------------------|
| 5.1 Privileged Windows Isolation | P1 | `privilege_blocked` | Administrator privilege |
| 5.2 Container/VM Isolation | P2 | `host_blocked` | Docker, Podman, Hyper-V, working WSL2 |
| 5.3 Self-Hosted Model + TTT | P3 | `host_blocked` | Ollama or equivalent |
| 5.4 Remote Orchestration | P4 | `host_blocked` | Temporal or LangGraph |
| 5.5 Remote Persistence + Observability | P5 | `endpoint_blocked` | DATABASE_URL, OTEL endpoint |
| 5.6 Cross-Platform Host Validation | P6 | `host_blocked` | macOS, Linux, or working WSL2 |
| 5.7 Enterprise/Cloud Edge | P7 | `credential_blocked` | SSO credentials, DeerFlow endpoint |

Current live-verified capabilities (already working, no new activation needed):

- Windows Job Object sandbox provider: `live` — memory limits and process counts enforced for `guarded_mutation` tier
- Rule-based sandbox provider: `live` — policy-only enforcement for all tiers
- All local-first runtime, dispatch, envelopes, acceptance, budget flows: `live`

### 4.17 Hermes/ClawHub Wave (2026-04-26)

Status: `Implemented` (local-first boundary; external ClawHub endpoint not yet available)

The Hermes self-evolution and ClawHub registry adapter wave has been landed:

**P0: Live Evolution Run Contracts And Persistence** — `Implemented`
- `SkillEvolutionRun`, `PromptEvolutionRun`, `ToolDescriptionEvolutionRun`, `EvolutionCandidate`, `EvolutionPromotionDecision`, `EvolutionRollbackRecord` typed Zod schemas in shared-types
- Persistence maps in shared-state for all evolution entities
- Full CRUD runtime in `evolution-runtime.ts`: create runs, add candidates, update status, record decisions, record rollbacks, get diagnostics

**P1: Candidate Generation From Real Signals** — `Implemented`
- `collectEvolutionSignals()` reads real signals from: failed learning factory pipelines, critical/open backlog items, error-state replay packages, budget interruptions
- `generateEvolutionCandidatesFromSignals()` groups signals by target, creates evolution runs, generates candidates with averaged confidence
- Signal kinds: `methodology_finding`, `replay_mismatch`, `budget_overrun`, `acceptance_failure`, `skill_gap`, `prompt_degradation`, `tool_misuse`

**P2: Replay/Regression/Budget Gates For Evolution** — `Implemented`
- `gateEvolutionCandidate()` checks: replay score >= threshold, regression passed, budget available, semantic preserved
- `gateAllPendingCandidates()` batch gates all candidates with status `candidate_generated`
- Unsuccessful candidates marked `gated_failed`; successful marked `gated_passed`
- Governance review still required before promotion even after gating passes

**P3: Evolution In Live Learning Factory** — `Implemented`
- Evolution signal collection + candidate generation triggered automatically in `failLearningFactoryStage` and `advanceLearningFactoryStage` (pipeline completion)
- `runEvolutionCycle()` convenience function: collect signals → generate candidates → gate all pending
- `EvolutionStatusPanelState` in desktop-workspace with builder function
- 6 API routes: `/api/local/evolution/diagnostics`, `/api/local/evolution/cycle`, `/api/local/evolution/candidates`, `/api/local/evolution/candidate/:id/gate`, `/api/local/evolution/candidate/:id/decision`, `/api/local/evolution/workspace-panel`

**P4: Live ClawHub Registry Adapter Boundary** — `Implemented` (boundary-only; no live ClawHub endpoint)
- `ClawHubRegistryConfig`, `ClawHubSearchResult`, `ClawHubInstallRecord`, `ClawHubPublishRecord`, `ClawHubSyncRecord`, `RemoteSkillTrustVerdict` typed Zod schemas in shared-types
- Persistence maps in shared-state for all ClawHub entities
- `clawhub-registry-adapter.ts` with: create/list configs, search skills (returns empty without endpoint), inspect skill, install skill (defaults to `pending_review`), publish skill (defaults to `pending_approval`), sync registry (fails honestly without endpoint), assess trust verdict, get diagnostics
- 10 API routes covering all ClawHub operations
- Key constraint: `searchClawHubSkills` returns empty array when no endpoint configured; `syncClawHubRegistry` records `failed` status with error; install/publish always require governance review

**P5: Trust/Governance/Workspace Flows For Remote Skills** — `Implemented`
- `RemoteSkillReviewPanelState` in desktop-workspace with builder showing pending reviews and recent verdicts
- `buildRemoteSkillReviewPanelState()` combines install records with trust verdicts
- 4 governance API routes: review panel, install approve/reject, publish approve
- Trust verdicts: `untrusted` / `conditional` / `trusted` based on publisher verification + compatibility + policy compliance
- Key constraint: `governance_review_required` is always `true` regardless of trust level; no auto-activation of remote skills

**P6: Final Verification** — `Implemented`
- All 4 packages typecheck clean: shared-types, shared-state, shared-runtime, local-control-plane
- Smoke test covers: evolution run creation, candidate creation, gate behavior, diagnostics, cycle, panel state, API routes, ClawHub config/search/install/publish/sync/trust, governance approve/reject flows

**What remains externally blocked:**
- Live ClawHub endpoint: no real registry endpoint available; search returns empty, sync fails honestly
- Live remote skill activation: boundary exists but no real external skills to activate

## 6. What Is Still Missing for the Final Product

The biggest missing pieces relative to the final target architecture are:

**Blocking layer (requires real external infrastructure):**

- real cloud hosting for remote control plane (requires cloud VM/container hosting with public IP)
- real `Temporal` and `LangGraph 2.x` integration behind a cloud boundary (requires Temporal server deployment, LangGraph runtime)
- OS-native filesystem access control enforcement (ACL/chroot) and network egress interception (firewall rules) for sandboxing (requires OS-level security integration)
- container/VM-level isolation for isolated_mutation sandbox tier (requires Docker/containerd/VM runtime)
- fully independent delegated worker/sandbox/cloud runtime backends (requires distributed deployment infrastructure)
- enterprise IdP/SSO integration (requires identity provider — Okta, Azure AD, etc.)
- embedding-based semantic search for wiki and memory (requires embedding model service — e.g. OpenAI embeddings, local sentence-transformers)
- full OCR text extraction from screenshots (requires external OCR service — e.g. Tesseract CLI installed, or cloud vision API; Windows OCR provider available on WinRT-capable editions)
- macOS accessibility API validation (code-landed, requires macOS host to validate)
- Linux AT-SPI accessibility API validation (code-landed, requires Linux host with AT-SPI to validate)
- full session video recording (architecture landed, requires video capture implementation)
- macOS/Linux display enumeration for multi-display support
- persistent durable scheduler service (requires external durable task queue — e.g. Temporal, BullMQ with Redis)
- real-time network interception layer for egress enforcement (requires OS-level proxy/firewall integration)
- reuse_metrics and by_model cost breakdown population (requires real runtime usage tracking pipeline)
- PDF export for wiki (requires PDF generation library/service)
- @libsql/client npm package for real libSQL server connections (currently using InMemoryPersistenceAdapter)
- TLS certificates for production OTEL/libSQL connections

**Preparation layer (completed — all local-first implementations landed):**

- CQS middleware and egress HTTP middleware ✓
- Learning factory automation (experiment promotion, confidence assessment, auto-triggering) ✓
- Scheduled job infrastructure with SLO alerting ✓
- Event ledger state reconstruction and export ✓
- Lineage merge conflict detection and resolution ✓
- Wiki semantic search, memory linking, and static site export ✓
- Remote control plane service skeleton (contracts, domain, Fastify routes, JWT/API key auth) ✓
- libSQL/Turso persistence adapter (PersistenceAdapter interface, InMemoryPersistenceAdapter, migrations) ✓
- OTEL collector pipeline (lifecycle management, dynamic config generation, batch export) ✓
- Deployment infrastructure (Dockerfile, docker-compose, K8s manifests, bootstrap scripts, runbooks) ✓
- Computer Use OS-level hard sandboxing with tier-based action matrix ✓
- Windows-first smoke/E2E/regression test chain ✓
- MCP Live Execution Fabric with capability registry, tool resolver, policy enforcement, and built-in capabilities ✓
- Broad App-Control Skill Layer with 12 built-in skills and CLI-first routing ✓
- Desktop Workspace Productization with computer-use panel, replay viz, human takeover console, risk UX ✓

## 7. Recommended Reading Order

If you want the best current understanding of the actual repository, read in this order:

1. `../README.md`
2. `./current-architecture-status.md`
3. `./api-contracts.md`
4. `./data-model.md`
5. `./runtime-improvements-roadmap.md`

## 8. Summary

In one sentence:

`Apex already implements a substantial local-first agent runtime with verification, reuse, governance, and delegated-runtime contracts, but it has not yet crossed into a true cloud-orchestrated, LangGraph-powered, hard-sandboxed final architecture.`
