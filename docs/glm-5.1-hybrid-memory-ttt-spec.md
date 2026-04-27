# GLM-5.1 Hybrid Memory + In-Place TTT Spec

This document defines the desired upgrade path for combining the current Apex memory system with a bounded `In-Place TTT` adaptation lane.

Use it when the goal is:

- preserve the current durable memory logic
- add an `In-Place TTT` path as an additional memory and adaptation strategy
- let the model decide which memory mode should be attempted for a task
- keep the final routing bounded by policy, eligibility, and rollback rules

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

When current code and this document differ, code and typed contracts remain authoritative for current behavior.

## 1. Objective

The target shape is not to replace the current memory system.

The target shape is:

- keep the existing durable memory stack as the default memory backbone
- add a bounded `In-Place TTT` research and specialist lane
- allow the model to recommend which memory mode to use for a given task
- require the runtime to validate whether that recommendation is actually eligible

In one sentence:

`Current memory remains the primary truth source, while In-Place TTT becomes a gated specialist memory/adaptation path chosen per task only when the task and model route qualify.`

## 2. Default Principle

The current memory system remains primary.

Primary memory stays:

- directory and document registry
- compiled knowledge wiki
- methodology memory
- learned playbooks
- task templates
- metadata filters
- lexical retrieval
- bounded semantic retrieval
- rerank plus recursive deep retrieval

`In-Place TTT` must not replace this.

It is only an additional route that may be selected for certain tasks.

## 3. Target Memory Modes

The runtime should expose explicit memory modes instead of a single hidden strategy.

### 3.1 Mode A: Durable Retrieval Memory

Use the current memory logic:

- direct document or directory addressing
- metadata filtering
- lexical retrieval
- bounded semantic retrieval
- reranking
- recursive deep retrieval
- methodology and playbook reuse

This remains the default mode for most tasks.

### 3.2 Mode B: Hybrid Retrieval + TTT

Use the current memory logic first, then permit a bounded `In-Place TTT` adaptation pass for the eligible self-hosted model route.

This mode is intended for:

- long-context tasks
- specialist task families
- replayable high-value tasks
- self-hosted open-weight model routes

### 3.3 Mode C: TTT-First Specialist Lane

This is not the global default.

This mode is only for:

- isolated research sandboxes
- explicit eval workloads
- specialist long-context model lanes
- tasks already approved for adaptation experiments

If the route is not eligible, it must automatically fall back to Mode A or Mode B.

## 4. Decision Model

The requested shape is:

- the model may judge which memory mode is most suitable for a task
- the system must decide whether that choice is actually allowed

So the final decision flow must be:

1. infer task family and task traits
2. collect route eligibility facts
3. ask the model for a memory-mode recommendation
4. pass that recommendation through a policy and eligibility gate
5. either:
   - approve the requested mode
   - downgrade to a safer mode
   - reject TTT entirely and stay on durable retrieval memory

The model is therefore a recommender, not an unrestricted authority.

## 5. Eligibility Rules

`In-Place TTT` must be eligible only when all required conditions pass.

Minimum gating rules:

- the selected model route is self-hosted
- the selected model route is open-weight or locally adaptable
- the task family is marked as TTT-eligible
- the task is high-context, specialist, or replay-evaluable
- an adaptation budget is available
- rollback to base behavior is possible
- baseline comparison is enabled

Hard denials:

- vendor-hosted closed API routes
- privileged planner main path by default
- high-risk production flows without bounded replay
- tasks with no measurable completion or verification criteria

## 6. Routing Signals For The Model

The model should choose memory mode based on structured routing inputs, not free-form guessing.

Useful routing signals:

- task family
- department
- context length
- memory hit quality
- reuse confidence
- availability of high-quality playbooks or templates
- whether the task is replayable
- whether the task has deterministic or eval-based completion checks
- model route type: vendor-hosted vs self-hosted
- expected task value versus adaptation cost

The model should produce:

- recommended memory mode
- concise reason
- expected benefit
- fallback mode if denied

## 7. Runtime Components To Add

To land this architecture cleanly, add these components.

### 7.1 Memory Strategy Selector

This component gathers task traits and asks the model which memory mode should be attempted.

Expected outputs:

- `recommended_mode`
- `reason`
- `confidence`
- `fallback_mode`

### 7.2 TTT Eligibility Gate

This component validates whether the recommendation may proceed.

Expected checks:

- model route eligibility
- task-family eligibility
- budget eligibility
- policy eligibility
- replay/eval eligibility

Expected outputs:

- `approved`
- `downgraded`
- `denied`
- denial or downgrade reason

### 7.3 TTT Adaptation Run

This component executes the bounded adaptation path for eligible tasks.

Minimum outputs:

- baseline run result
- adapted run result
- delta analysis
- adaptation budget consumption
- rollback-ready record

### 7.4 Distillation Back Into Durable Memory

The system must not treat temporary adaptation as the final memory source.

When an adaptation is successful, distill value back into:

- routing rules
- prompts
- playbooks
- methodology memory
- task templates
- eval insights

This is how the main memory system keeps improving without letting silent weight mutation become the default state.

## 8. Best-Practice Constraints

The following rules are mandatory.

- do not remove or weaken the current durable memory logic
- do not let `In-Place TTT` become the default global memory mode
- do not let vendor-hosted APIs pretend to support TTT when they do not
- do not apply live weight mutation in the main privileged planner path by default
- do not skip baseline comparison
- do not skip rollback paths
- do not skip verification and completion gates
- do not allow silent adaptation without trace, audit, and budget accounting

## 9. Implementation Order

Land this in the following order.

### Phase 1. Memory Strategy Selection Layer ✅ COMPLETED

Implement:

- typed `MemoryMode` contract ✅
- `MemoryStrategyRecommendation` ✅
- `MemoryStrategySelector` ✅
- initial selector API and local-control-plane surface ✅

Landed:

- `MemoryModeSchema` with three modes: `durable_retrieval`, `hybrid_retrieval_ttt`, `ttt_first_specialist`
- `MemoryStrategyRecommendationSchema` with routing signals, confidence, expected benefit, fallback mode
- `recommendMemoryMode()` function implementing the model-as-recommender pattern
- `gatherRoutingSignals()` to collect structured routing inputs
- `listMemoryStrategyRecommendations()` and `getMemoryStrategyRecommendation()` for retrieval
- API endpoints: POST /api/local/memory/recommend, GET /api/local/memory/recommendations

Do not implement TTT execution first.
Start with explicit selection and routing.

### Phase 2. TTT Eligibility Gate ✅ COMPLETED

Implement:

- route eligibility checks ✅
- task-family eligibility checks ✅
- budget rules ✅
- policy rules ✅
- downgrade and denial flow ✅

Landed:

- `TTTEligibilityGateResultSchema` with 8 check dimensions and verdict (approved/downgraded/denied)
- `evaluateTTTEligibility()` implementing all eligibility rules from Section 5
- Vendor-hosted model detection via `isVendorHostedModel()` with prefix-based matching
- Task-family eligibility registry with `registerTTTEligibleTaskFamily()`, `unregisterTTTEligibleTaskFamily()`, `listTTTEligibleTaskFamilies()`
- Budget eligibility via `TTTBudgetLedgerSchema` with global budget tracking
- Privileged planner exclusion
- Completion criteria requirement
- Automatic downgrade: ttt_first_specialist → hybrid_retrieval_ttt → durable_retrieval
- API endpoints: POST /api/local/memory/ttt/eligibility, GET /api/local/memory/ttt/eligibility-results

### Phase 3. TTT Research Lane Execution ✅ COMPLETED

Implement:

- baseline run ✅
- adapted run ✅
- delta analysis ✅
- adaptation ledger entry ✅
- rollback-ready artifact ✅

Landed:

- `TTTAdaptationRunSchema` with full lifecycle: pending → baseline_running → baseline_complete → adapted_running → adapted_complete → delta_analyzed → completed/failed/rolled_back
- `executeTTTAdaptationRun()` with baseline-first, then adapted execution, then delta analysis
- `analyzeDelta()` comparing quality, latency, and cost between baseline and adapted runs
- Automatic rollback on regression: runs with "regressed" verdict are marked as rolled_back
- `rollbackTTTAdaptation()` for explicit rollback of any rollback-ready run
- Budget consumption tracking per run
- API endpoints: POST /api/local/memory/ttt/adaptation-run, GET /api/local/memory/ttt/adaptation-runs, POST /api/local/memory/ttt/adaptation-runs/:runId/rollback

Note: Actual LLM invocation and weight adaptation require external model service. Current implementation provides the full orchestration framework with placeholder model calls.

### Phase 4. Distillation Back To Durable Memory ✅ COMPLETED

Implement:

- promotion or distillation logic ✅
- playbook update hooks ✅
- methodology update hooks ✅
- routing rule suggestions ✅
- eval report storage ✅

Landed:

- `TTTDistillationRecordSchema` with 6 distillation targets: routing_rules, prompts, playbooks, methodology_memory, task_templates, eval_insights
- `distillTTTAdaptation()` function that creates distilled artifacts from completed adaptation runs
- Regressed/neutral runs are distilled as eval_insights only (no positive promotion)
- Improved runs are distilled to all specified targets with change descriptions
- API endpoint: POST /api/local/memory/ttt/distill, GET /api/local/memory/ttt/distillation-records

### Phase 5. UI And Operator Visibility ✅ COMPLETED

Implement:

- visible memory mode per task ✅
- visible recommendation reason ✅
- visible gate verdict ✅
- visible fallback path ✅
- visible adaptation results and budgets ✅

Landed:

- `getTTTTraceForTask()` returning full trace: recommendations, gate results, adaptation runs, distillation records
- `getTTTVisibilitySummary()` with current memory mode, active/completed/rolled-back run counts, budget status, eligible families, recent verdicts
- API endpoints: GET /api/local/memory/ttt/trace/:taskId, GET /api/local/memory/ttt/visibility
- Budget management: GET /api/local/memory/ttt/budget, POST /api/local/memory/ttt/budget/set, POST /api/local/memory/ttt/budget/reset
- Eligible family management: GET/POST/DELETE /api/local/memory/ttt/eligible-families

Only for self-hosted routes.

### Phase 4. Distillation Back To Durable Memory

Implement:

- promotion or distillation logic
- playbook update hooks
- methodology update hooks
- routing rule suggestions
- eval report storage

### Phase 5. UI And Operator Visibility

Implement:

- visible memory mode per task
- visible recommendation reason
- visible gate verdict
- visible fallback path
- visible adaptation results and budgets

## 10. Required Document Updates

When landing this architecture, keep these documents in sync:

- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./external-pattern-adoption.md`](./external-pattern-adoption.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)

If new contracts are introduced, also update:

- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

## 11. Reporting Format

Every implementation round should report:

1. current target
2. why it is the highest-priority step
3. files changed
4. what moved from planned to implemented
5. what remains partial or gated
6. verification run
7. next target

## 12. One-Sentence Summary

`Keep the current memory backbone, add a gated In-Place TTT specialist lane, let the model recommend memory strategy per task, and let the runtime decide whether that recommendation is actually allowed.`
