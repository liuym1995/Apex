# GLM-5.1 Post-Local Remaining Spec

This document is the next handoff after the current local-first runtime, computer-use, MCP execution fabric, app-control layer, and hybrid memory plus `In-Place TTT` scaffolding have already landed.

Use it when the goal is:

- continue implementing the best remaining features that are still feasible now
- avoid stopping just because the first big local milestones are complete
- focus only on work that does **not** require unavailable hosts or external model infrastructure

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./glm-5.1-local-remaining-execution-spec.md`](./glm-5.1-local-remaining-execution-spec.md)
- [`./glm-5.1-hybrid-memory-ttt-spec.md`](./glm-5.1-hybrid-memory-ttt-spec.md)

When current code and this document differ, code and typed contracts remain authoritative for current behavior.

## 1. Goal

Finish the remaining high-value features that are still locally implementable now, after the first major local runtime and hybrid-memory milestones are done.

`Do not stop after one sub-area. Continue until every in-scope item here is landed or only true external blockers remain.`

## 2. True External Blockers To Exclude

Do not treat these as the current main line of work:

- real macOS accessibility host verification
- real Linux AT-SPI host verification
- actual self-hosted model inference service for `baseline` and `adapted` TTT runs
- real test-time weight update service for `In-Place TTT`
- embedding-service-dependent retrieval improvements
- gRPC MCP execution against real external MCP servers
- OS-native ACL / chroot / container / VM isolation beyond what the current Windows-local environment can truly enforce

Those are real blockers, not the best next local implementation path.

## 3. Fixed Execution Order

Work through the remaining locally-doable features in this exact order.

### 3.1 First: Integrate Hybrid Memory Strategy Into The Main Task Pipeline ✅ COMPLETED

Target outcomes:

- memory-mode recommendation integrated into task preparation or planning ✅
- gate verdict integrated into real task execution routing ✅
- fallback from `ttt_first_specialist` -> `hybrid_retrieval_ttt` -> `durable_retrieval` visible in the main run ✅
- memory strategy recorded into task timeline, evidence, audit, and attempt metadata ✅
- durable retrieval path and hybrid retrieval path both available through the normal task pipeline ✅

Landed:

- `TaskContractSchema` extended with `memory_mode`, `memory_strategy_recommendation_id`, `ttt_eligibility_gate_id`, `ttt_adaptation_run_id` fields
- `createExecutionPlan` now calls `gatherRoutingSignals` → `recommendMemoryMode` → `evaluateTTTEligibility` and stores the result on the task
- Memory strategy checkpoint recorded in task timeline: "Memory mode: {mode}. Recommendation: {mode}. Gate verdict: {verdict}."
- `runTaskEndToEnd` now includes TTT adaptation step after execution when `memory_mode !== "durable_retrieval"` and gate ID exists
- TTT distillation step added after memory capture when `ttt_adaptation_run_id` exists
- Full audit trail: planning audit includes `memory_mode`, TTT adaptation checkpoint, distillation checkpoint

### 3.2 Second: Build A Self-Hosted Adaptation Adapter Boundary ✅ COMPLETED

Target outcomes:

- explicit `TTTModelAdapter` or equivalent contract ✅
- provider registry for self-hosted adaptation backends ✅
- mock adapter ✅
- dry-run adapter ✅
- replay-eval adapter ✅
- clear separation between:
  - baseline inference ✅
  - adaptation step ✅
  - adapted inference ✅
  - rollback artifact ✅

Landed:

- `TTTModelAdapter` interface with capability flags (supports_weight_update, supports_baseline_inference, etc.)
- `TTTModelAdapterProvider` SPI with `canHandle`, `baselineInference`, `adaptedInference`, `rollback`, `getAdapterInfo`
- `registerTTTModelAdapter`, `unregisterTTTModelAdapter`, `listTTTModelAdapters`, `resolveTTTModelAdapter`
- `registerBuiltinTTTModelAdapters`: mock (randomized scores), dry_run (fixed scores), replay_eval (deterministic scores)
- `executeAdaptationWithAdapter`: full adaptation lifecycle using a resolved adapter provider
- API endpoints: POST /api/local/memory/ttt/adapters/register-builtin, GET /api/local/memory/ttt/adapters

### 3.3 Third: Improve Memory Routing Quality Without External Embeddings ✅ COMPLETED

Target outcomes:

- stronger `memory_hit_quality` scoring from current metadata, lexical, and reuse signals ✅
- task-family-aware retrieval scoring ✅
- richer direct-address heuristics ✅
- better rerank of directory/document candidates ✅
- better link from playbooks/templates/methodology memory into the compiled knowledge wiki ✅
- hybrid-memory recommendation quality improvements using only current local retrieval infrastructure ✅

Landed:

- `scoreMemoryRoutingCandidates`: 9-dimension scoring without embedding (direct_address_match, tag_overlap, lexical_hit, task_family_affinity, department_affinity, reuse_recency, methodology_bonus, evaluation_bonus, directory_depth_bonus)
- `computeMemoryHitQuality`: returns "high"/"medium"/"low"/"none" based on top candidate score and high-score count
- `rerankMemoryDirectory`: directory-scoped reranking with query, task_family, department, promotion_status, and document kind signals
- `linkPlaybookToRouting`: links methodology memory items to task families and departments via tag enrichment
- API endpoints: POST /api/local/memory/routing/score, POST /api/local/memory/routing/hit-quality, POST /api/local/memory/routing/rerank-directory, POST /api/local/memory/routing/link-playbook

### 3.4 Fourth: Desktop Visibility For Hybrid Memory And TTT ✅ COMPLETED

Target outcomes:

- desktop memory-mode panel ✅
- visible selector recommendation and gate verdict ✅
- visible adaptation budget state ✅
- visible baseline/adapted/delta summaries ✅
- visible distillation results back into durable memory ✅
- visible downgrade reason when TTT is denied ✅

Landed:

- `HybridMemoryTTTPanelState` interface with full TTT visibility: current_memory_mode, recommendation, gate_result, adaptation_run, budget_summary, eligible_task_families, available_adapters, memory_routing_summary, distillation_status
- `buildHybridMemoryTTTPanelState`: assembles panel state from task trace, budget ledger, adapter registry, and routing scores
- `WorkspacePanelKind` extended with "hybrid_memory_ttt" panel type
- `buildFullWorkspaceState` now includes `hybrid_memory_ttt_panel` when hybrid_memory_ttt panel is active
- API endpoint: GET /api/local/workspace/hybrid-memory-ttt-panel

### 3.5 Fifth: Eval / Replay / Regression Chain For Hybrid Memory ✅ COMPLETED

Target outcomes:

- replayable comparison harness for memory-mode decisions ✅
- regression suite for recommendation, gate verdict, downgrade flow, and distillation flow ✅
- baseline-versus-hybrid evaluation report artifacts ✅
- failure cases for budget exhaustion, denied route, and rollback ✅
- deterministic test coverage for the non-model parts of the TTT lane ✅

Landed:

- `TTTRegressionTestCase` and `TTTRegressionTestResult` types
- 15 built-in regression cases covering: vendor_exclusion, eligibility, budget, adaptation, rollback, distillation, routing, adapter boundary
- `runTTTRegressionTestSuite`: full regression suite with pass/fail/skip tracking
- `getTTTRegressionTestCases`: programmatic access to test case definitions
- `TTTReplayComparison` and `replayTTTAdaptationForComparison`: replay comparison harness
- API endpoints: POST /api/local/memory/ttt/regression, GET /api/local/memory/ttt/regression/cases, POST /api/local/memory/ttt/replay-comparison

## 4. Required Document Updates

When any sub-area above changes behavior, update the affected documents in the same round.

At minimum, keep these synchronized:

- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./glm-5.1-hybrid-memory-ttt-spec.md`](./glm-5.1-hybrid-memory-ttt-spec.md)

If new contracts are introduced, also update:

- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

## 5. Execution Rules

Follow these rules throughout the handoff:

- do not remove or weaken the current durable memory backbone
- do not make `In-Place TTT` the default memory mode
- do not pretend vendor-hosted models support real TTT
- do not stop after one section if another in-scope section remains
- do not switch to cloud-first or external-infra-first work
- prefer deterministic validation and replay where possible
- prefer adapter boundaries and product integration over placeholder-only code
- update implemented / partial / future-target boundaries honestly

## 6. Stop Condition

Only stop when one of these is true:

1. every in-scope item in this document has been implemented ✅ ALL FIVE ITEMS COMPLETED
2. the only remaining work depends on unavailable external model infrastructure
3. the only remaining work depends on unavailable host infrastructure
4. a real architecture fork requires explicit user choice

All five in-scope items have been implemented:
- 3.1 Hybrid Memory Strategy 接入主任务流水线 ✅
- 3.2 Self-hosted adaptation adapter boundary ✅
- 3.3 不依赖 embedding 的 memory routing quality 提升 ✅
- 3.4 Hybrid Memory/TTT 桌面可视化 ✅
- 3.5 Hybrid Memory/TTT replay/regression/eval 验证链 ✅

Remaining blockers are all external infrastructure or unavailable hosts:
- Actual self-hosted model inference service for baseline and adapted TTT runs
- Real test-time weight update service for In-Place TTT
- Embedding-service-dependent retrieval improvements
- macOS accessibility host verification
- Linux AT-SPI host verification
- gRPC MCP execution against real external MCP servers
- OS-native ACL/chroot/container/VM isolation

## 7. Reporting Format

Every round must report:

1. current target
2. why it is the highest remaining priority
3. files changed
4. what moved from partial to implemented
5. what remains blocked and why
6. verification run
7. next target

## 8. One-Sentence Summary

`This handoff finishes the remaining locally-doable work after the first big local and hybrid-memory milestones, by integrating hybrid memory into the real task pipeline, hardening the adapter boundary, improving non-embedding retrieval quality, surfacing the route in the desktop product, and making it replayable and regression-tested.`
