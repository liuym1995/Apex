# GLM-5.1 Settings, Subagents, Acceptance, And Budget Spec

This document is the continuous handoff for the next local-first architecture wave after the recent local settings baseline landed.

Use it when the goal is:

- connect local settings into real runtime defaults
- formalize bounded multi-agent governance
- upgrade verifier semantics into a dedicated acceptance-agent boundary
- add task-level budget caps with explicit pause-and-confirm behavior

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`../master_plan.md`](../master_plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./local-settings-and-runtime-defaults.md`](./local-settings-and-runtime-defaults.md)
- [`./multi-agent-governance-and-budgeting.md`](./multi-agent-governance-and-budgeting.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./api-contracts.md`](./api-contracts.md)
- [`./data-model.md`](./data-model.md)

When this document and current code differ, typed contracts and repository code remain authoritative for current behavior.

## 1. Goal

Land one continuous implementation wave that covers all of the following without stopping after each item:

1. connect settings-backed default directories into actual task behavior
2. put multi-agent hard rules into settings with safe auto-derived machine-resource defaults
3. make the dedicated acceptance-agent boundary explicit in runtime contracts, completion flow, and UI
4. add per-task budget caps, live spend tracking, pause-on-limit, and explicit user continuation

`Do not stop after one item. Continue through the ordered list until every in-scope item is landed or a true external blocker is reached.`

## 2. What Must Not Change

- do not remove current local-first settings behavior
- do not weaken verifier, reconciliation, checklist, completion-engine, or done-gate semantics
- do not allow subagents to grow without explicit hard limits
- do not make budget enforcement advisory-only
- do not silently continue after a hard budget limit is reached
- do not make the acceptance agent the sole completion authority
- do not add hidden telemetry or hidden external pricing calls

## 3. Fixed Execution Order

### 3.1 P0: Connect Local Settings To Real Task Defaults

Current status:

- local settings contract and first-run UX exist
- recommended path defaults exist
- runtime root and local DB path already consume settings

What is still missing:

- default task working directory as a first-class runtime default
- default file write root as a first-class runtime default
- default export directory wired into task/export flows
- artifact and verification directories wired into runtime outputs

Target outcomes:

- add explicit local settings fields for:
  - `default_task_workdir`
  - `default_write_root`
  - `default_export_dir`
  - `verification_evidence_dir`
  - `task_run_dir`
- ensure new task creation inherits these defaults unless the user or task explicitly overrides them
- ensure file writes, export flows, artifacts, replay outputs, screenshots, and verification evidence resolve against these defaults
- keep only truly required configuration blocking

Repository landing areas:

- `packages/shared-config/src/local-app-settings.ts`
- `packages/shared-config/src/index.ts`
- `packages/shared-state/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/computer-use-runtime.ts`
- `apps/local-control-plane/src/index.ts`
- `apps/desktop-shell/src/App.tsx`
- `apps/desktop-shell/src/styles.css`

### 3.2 P1: Add Settings-Backed Multi-Agent Resource Policy

Current status:

- delegated runtime and agent-team summaries exist
- there is no strict multi-agent cap model exposed through settings

What is still missing:

- first-class `DelegationPolicySettings`
- hard topology caps
- machine-resource auto mode
- effective concurrency computation

Target outcomes:

- add settings-backed multi-agent policy fields:
  - `subagent_resource_mode`
  - `cpu_reserve_ratio`
  - `memory_reserve_ratio`
  - `max_parallel_subagents`
  - `max_total_subagents_per_task`
  - `max_delegation_depth`
- default to:
  - `subagent_resource_mode = auto`
  - `cpu_reserve_ratio = 0.2`
  - `memory_reserve_ratio = 0.2`
  - `max_parallel_subagents = 4`
  - `max_total_subagents_per_task = 8`
  - `max_delegation_depth = 2`
- compute effective concurrency from detected machine capacity and clamp it by hard caps
- show the derived effective limits in settings and diagnostics

Repository landing areas:

- `packages/shared-config/src/local-app-settings.ts`
- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/delegated-runtime-hardening.ts`
- `packages/shared-types/src/index.ts`
- `apps/local-control-plane/src/index.ts`
- `apps/desktop-shell/src/App.tsx`

### 3.3 P2: Add Dispatch Plan Leasing And Anti-Duplication

Current status:

- execution plan and delegated runtime contracts exist
- there is no complete plan-lease model preventing duplicate active assignment

What is still missing:

- single-source dispatch-plan contract
- step-level lease / assignment contract
- duplicate active-assignment prevention
- delegation-depth and total-agent enforcement at dispatch time

Target outcomes:

- introduce typed dispatch-plan entities and APIs:
  - `AgentDispatchPlan`
  - `AgentDispatchStep`
  - `SubagentAssignment`
  - `AssignmentLease`
- enforce:
  - one active lease per plan step
  - supervisor-only assignment creation
  - subagent result-only updates
  - max-depth / max-total / max-parallel policy checks
- keep plan as the single source of truth for team execution

Repository landing areas:

- `packages/shared-types/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/delegated-runtime-hardening.ts`
- `apps/local-control-plane/src/index.ts`
- `docs/api-contracts.md`
- `docs/data-model.md`

### 3.4 P3: Add Context Envelopes For Subagent Handoffs

Current status:

- delegated sessions exist
- memory compaction exists
- there is no dedicated scoped handoff envelope model

What is still missing:

- structured subagent input filter
- compact result envelope
- supervisor context-protection path

Target outcomes:

- add:
  - `SubagentContextEnvelope`
  - `SubagentResultEnvelope`
  - `buildSubagentContextEnvelope`
  - `buildSubagentResultEnvelope`
- hand off only scoped information:
  - step goal
  - relevant artifacts
  - relevant memory
  - relevant policy
  - step-level definition of done
  - tool and sandbox allowances
  - budget and resource limits
- return only compact structured outputs back to the supervisor

Repository landing areas:

- `packages/shared-types/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/memory-layers.ts`
- `apps/local-control-plane/src/index.ts`
- `docs/desktop-workspace-ui.md`

### 3.5 P4: Upgrade Verifier Into An Explicit Acceptance-Agent Boundary

Current status:

- verifier already exists
- verification stack already exists

What is still missing:

- explicit acceptance-agent contract
- explicit executor-vs-acceptance separation
- explicit acceptance verdict package

Target outcomes:

- formalize a dedicated `Acceptance Agent` boundary
- preserve the current stack:
  - checklist
  - acceptance agent
  - reconciliation
  - done gate
- add typed acceptance artifacts:
  - `AcceptanceReview`
  - `AcceptanceVerdict`
  - `AcceptanceFinding`
- keep deterministic checks first and semantic review second
- add risk-based escalation guidance for high-risk tasks

Repository landing areas:

- `packages/shared-types/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `docs/verification-and-completion.md`
- `docs/desktop-workspace-ui.md`
- `apps/local-control-plane/src/index.ts`

### 3.6 P5: Add Task Budget Contracts, Live Cost Tracking, And Pause-On-Limit

Current status:

- model cost tracking and summaries exist
- no first-class task budget contract or hard-stop user-confirm flow exists

What is still missing:

- pricing registry
- task-level budget contract
- budget warnings
- budget hard-stop pause
- explicit continuation approval

Target outcomes:

- add typed budget entities:
  - `ModelPricingRegistryEntry`
  - `TaskBudgetPolicy`
  - `TaskBudgetStatus`
  - `BudgetInterruptionEvent`
- support:
  - default inherited budget policy
  - task-specific budget policy
  - actual spend tracking from real token usage and model/provider pricing
  - warnings before hard stop
  - hard-stop interruption when limit is reached
  - explicit user decision to continue by setting a new cap or explicit extension
- show current cap and current spend clearly in UI

Repository landing areas:

- `packages/shared-types/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/model-gateway-executor.ts`
- `packages/shared-runtime/src/trace-grading-eval.ts`
- `apps/local-control-plane/src/index.ts`
- `apps/desktop-shell/src/App.tsx`
- `docs/observability-and-operations.md`
- `docs/api-contracts.md`
- `docs/data-model.md`

### 3.7 P6: Final Workspace, API, And Doc Convergence

Current status:

- settings UI and agent-team surfaces already exist at baseline

Target outcomes:

- ensure desktop workspace exposes:
  - effective default directories
  - multi-agent effective limits
  - active subagent counts
  - acceptance-agent verdict
  - task budget cap / spend / interruption state
- update:
  - current-status docs where implementation changes become real
  - README if startup or user-facing behavior changes
  - API docs and data model docs for all new contracts

## 4. Stop Conditions

Stop only when one of these becomes true:

1. every in-scope item above is implemented and verified
2. only a true external blocker remains
3. a requested behavior conflicts with higher-authority architecture rules and cannot be implemented as requested without violating them

Do not stop after a partial wave just to summarize progress.

## 5. Required Verification

For this handoff, `GLM-5.1` must not stop at typecheck only.

Required verification should include, where relevant:

- `npm run check`
- `npm run build`
- `npm run smoke`
- targeted regression tests for:
  - settings default propagation
  - delegation-cap enforcement
  - duplicate assignment denial
  - context-envelope compaction
  - acceptance-agent verdict flow
  - budget hard-stop and resume-after-user-confirm

## 6. Final Prompt For GLM-5.1

Use the following prompt to execute this spec.

```text
在 apex 仓库中执行实现任务。

严格遵守以下文档，且按 authority order 执行：
1. docs/glm-5.1-architecture-execution-spec.md
2. docs/architecture-constitution.md
3. docs/architecture-document-system.md
4. docs/best-practice-reset-plan.md
5. master_plan.md
6. docs/current-architecture-status.md
7. docs/local-settings-and-runtime-defaults.md
8. docs/multi-agent-governance-and-budgeting.md
9. docs/verification-and-completion.md
10. docs/desktop-workspace-ui.md
11. docs/api-contracts.md
12. docs/data-model.md
13. docs/glm-5.1-settings-subagents-acceptance-budget-spec.md
14. 与当前目标相关的专题文档

当前任务：
严格按照 docs/glm-5.1-settings-subagents-acceptance-budget-spec.md 的固定顺序，连续落地全部 in-scope 项目，从 P0 开始一直做到 P6；除非只剩真实外部阻塞，否则中间不要停止，不要只做分析，不要分批等确认。

强制要求：
- 不要替换当前 local-first typed runtime backbone
- 不要削弱 verifier / reconciliation / checklist / completion engine / done gate
- 不要把 acceptance agent 变成唯一完成真相源
- 不要允许子 agent 默认无限派生
- 不要允许同一 plan step 同时被多个 active subagent 领取
- 不要把目录默认值只做成 UI 字段，必须真正接到任务行为
- 不要在超过预算硬上限后静默继续
- 不要引入隐藏 telemetry 或外部价格请求
- 所有价格和预算计算必须走显式 pricing registry 与实际 token 用量
- 每完成一项都必须同步更新相关文档，保持 implemented / partial / future-target 边界诚实
- 每完成一轮必须给出 verification 结果

执行方式：
- 严格按 P0 -> P6 顺序推进
- 每个阶段先给出 architecture alignment summary、涉及模块、current-state vs target-state、verification plan
- 然后直接编码实现
- 不要停在“方案设计完成”
- 不要跳过测试、回归、类型检查、冒烟或确定性验证
- 如果遇到真实外部阻塞，只能落 boundary / adapter / readiness，并明确标注 blocked，不得谎报已完成

完成汇报格式：
1. current target
2. why highest priority
3. files changed
4. what moved from baseline to upgraded implementation
5. what remains partial
6. what is externally blocked
7. verification run
8. next target

现在开始，从 P0 开始连续实现，直到 docs/glm-5.1-settings-subagents-acceptance-budget-spec.md 的 stop condition 触发为止。
```

## 7. One-Line Compressed Prompt

```text
在 apex 仓库中严格按 docs/glm-5.1-architecture-execution-spec.md、docs/local-settings-and-runtime-defaults.md、docs/multi-agent-governance-and-budgeting.md 和 docs/glm-5.1-settings-subagents-acceptance-budget-spec.md，按 P0→P6 连续落地设置默认目录接线、多agent硬上限与80%资源策略、acceptance agent、任务预算硬上限与超限暂停确认，直到 stop condition 触发为止。
```
