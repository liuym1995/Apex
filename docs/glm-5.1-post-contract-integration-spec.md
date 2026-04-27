# GLM-5.1 Post-Contract Integration Spec

This document is the continuous handoff for the next execution wave after the typed contracts and runtime modules for:

- settings-backed runtime defaults
- bounded multi-agent governance
- dispatch-plan leasing
- subagent context envelopes
- acceptance-agent review
- task budget enforcement

have already landed.

Use it when the goal is:

- move those newly added contracts out of "typed/runtime-only" status
- wire them into the real local control plane, task pipeline, workspace UI, and verification flow
- remove the remaining "partial" gap between architecture shape and product behavior

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
- [`./glm-5.1-settings-subagents-acceptance-budget-spec.md`](./glm-5.1-settings-subagents-acceptance-budget-spec.md)

When this document and current code differ, typed contracts and repository code remain authoritative for current behavior.

## 1. Goal

Land one continuous integration wave that completes the product-facing convergence for the newly added P0-P5 runtime capabilities.

The target is not "more contracts".

The target is:

- real control-plane endpoints
- real task-engine integration
- real workspace visibility
- real interruption / continue flow
- real regression coverage

`Do not stop after one item. Continue through the ordered list until every in-scope item is landed or only a true external blocker remains.`

## 2. What Must Not Change

- do not replace the current local-first typed runtime backbone
- do not weaken checklist / acceptance-agent / reconciliation / done-gate ordering
- do not bypass plan leasing or hard subagent caps
- do not silently continue past a hard budget cap
- do not collapse all logic into UI or local-control-plane route handlers
- do not claim full feature completion while contracts remain unintegrated into actual task execution

## 3. Current Boundary

The previous wave already landed the typed/runtime backbone for:

- expanded local settings defaults
- delegation policy settings
- dispatch-plan leasing
- subagent envelopes
- acceptance-agent contracts
- task budget contracts

What still remains is product and execution integration:

- desktop workspace UI integration
- local-control-plane API integration
- task pipeline integration
- budget pause/continue interaction flow
- acceptance-agent insertion into real completion flow
- smoke / regression verification at app behavior level

## 4. Fixed Execution Order

### 4.1 P0: Surface The New Settings End-To-End

Current status:

- the new settings fields exist in shared config
- first-run settings baseline already exists

What is still missing:

- desktop settings panels for the 5 new directory defaults
- advanced settings section for delegation policy defaults and budget defaults
- clear restart / no-restart labeling for each field
- local-control-plane read/write validation coverage for the new fields

Target outcomes:

- expose in Settings:
  - `default_task_workdir`
  - `default_write_root`
  - `default_export_dir`
  - `verification_evidence_dir`
  - `task_run_dir`
- expose in advanced settings:
  - `subagent_resource_mode`
  - `cpu_reserve_ratio`
  - `memory_reserve_ratio`
  - `max_parallel_subagents`
  - `max_total_subagents_per_task`
  - `max_delegation_depth`
  - default budget policy fields
- ensure required-vs-optional validation remains honest
- ensure defaults are editable after first install

Repository landing areas:

- `apps/desktop-shell/src/App.tsx`
- `apps/desktop-shell/src/styles.css`
- `apps/local-control-plane/src/index.ts`
- `packages/shared-config/src/local-app-settings.ts`

### 4.2 P1: Wire Settings Defaults Into Real Task Behavior

Current status:

- settings can resolve default paths
- those paths are not yet guaranteed to drive real task execution everywhere

What is still missing:

- task creation inheritance
- default file write routing
- default export routing
- default verification-evidence routing
- default task-run and checkpoint routing
- computer-use artifact routing convergence

Target outcomes:

- when a task is created without explicit paths, it inherits:
  - workdir
  - write root
  - export root
- file writes use `default_write_root` when no explicit target path is provided
- export flows use `default_export_dir`
- acceptance/checklist/reconciliation/done-gate evidence uses `verification_evidence_dir`
- checkpoints / replay / rollback / per-task runtime files use `task_run_dir`
- computer-use artifacts land under the configured artifact/evidence structure

Repository landing areas:

- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/computer-use-runtime.ts`
- `packages/shared-state/src/index.ts`
- `apps/local-control-plane/src/index.ts`

### 4.3 P2: Expose Multi-Agent, Dispatch, Envelope, Acceptance, And Budget APIs

Current status:

- runtime modules exist
- app-facing API routes remain partial

What is still missing:

- route layer integration
- operator inspection endpoints
- pause / continue / override control routes

Target outcomes:

- add local-control-plane APIs for:
  - effective delegation-policy settings and computed limits
  - dispatch-plan CRUD / inspection
  - assignment lease inspection
  - subagent envelope inspection
  - acceptance review status
  - task budget status
  - budget interruption event history
  - budget continue / extend / stop actions
- preserve audit logging on every mutating route

Repository landing areas:

- `apps/local-control-plane/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `docs/api-contracts.md`

### 4.4 P3: Insert New Runtime Modules Into The Real Task Pipeline

Current status:

- modules exist in isolation
- actual task run lifecycle may still bypass them

What is still missing:

- dispatch-plan leasing inside delegated execution
- subagent envelope creation during handoff
- acceptance-agent stage in real completion flow
- budget checks during execution
- pause and explicit user confirmation continuation semantics

Target outcomes:

- supervisor-created delegated steps must use dispatch-plan leasing
- subagent launches must consume context envelopes rather than full parent context
- acceptance-agent review must run in the actual completion path before reconciliation/done-gate finalization
- budget status must update during execution from real token/cost accounting
- reaching the hard limit must:
  - pause the task
  - emit a budget interruption event
  - surface a user-visible decision point
- explicit user continuation must:
  - raise the limit or grant a one-time extension
  - then resume the paused task

Repository landing areas:

- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/model-gateway-executor.ts`
- `packages/shared-runtime/src/delegated-runtime-hardening.ts`
- `packages/shared-runtime/src/acceptance-agent.ts`
- `packages/shared-runtime/src/task-budget.ts`
- `apps/local-control-plane/src/index.ts`

### 4.5 P4: Add Workspace UI For Acceptance, Budget, And Multi-Agent Limits

Current status:

- architecture docs now define these UX surfaces
- workspace UI is not yet guaranteed to expose them

What is still missing:

- Acceptance card
- Budget card
- effective multi-agent limits card/section
- budget-paused action path
- settings visibility for advanced resource policy

Target outcomes:

- workspace should show:
  - acceptance verdict
  - acceptance findings
  - missing items
  - rerun scope hints
  - configured budget cap
  - current spend
  - warning threshold
  - paused-by-budget state
  - continue / raise-budget / stop actions
  - active subagent count
  - effective parallel limit
  - max total subagents
  - max delegation depth
  - current task workdir / write root / export root

Repository landing areas:

- `apps/desktop-shell/src/App.tsx`
- `apps/desktop-shell/src/styles.css`
- `packages/shared-runtime/src/desktop-workspace.ts`
- `docs/desktop-workspace-ui.md`

### 4.6 P5: Close The Verification Gap With App-Level Tests

Current status:

- typecheck may pass
- runtime modules exist
- product-level behavior may still not be fully exercised

What is still missing:

- integration and smoke coverage for the new features

Target outcomes:

- add targeted tests for:
  - settings default propagation into task creation
  - file/export/evidence default routing
  - effective multi-agent limit computation
  - duplicate step-lease denial
  - subagent envelope compactness
  - acceptance-agent completion path behavior
  - budget hard-stop pause
  - budget continue after explicit user approval
- ensure `npm run smoke` covers the most important user-facing paths

Repository landing areas:

- `scripts/smoke-loader.mjs`
- runtime regression suites
- any local-control-plane or workspace integration tests already used by the repo

### 4.7 P6: Final Docs And Status Convergence

Target outcomes:

- update `docs/current-architecture-status.md` honestly
- update `README.md` if startup/settings/task behavior changed
- update `docs/api-contracts.md` and `docs/data-model.md`
- mark only truly implemented product behavior as implemented
- leave externally blocked items clearly marked as blocked or partial

## 5. Stop Conditions

Stop only when one of these becomes true:

1. every in-scope item above is implemented and verified
2. only a true external blocker remains
3. a requested behavior conflicts with higher-authority architecture rules and cannot be implemented as requested without violating them

Do not stop after partial route or UI work just to summarize progress.

## 6. Required Verification

For this handoff, `GLM-5.1` must not stop at typecheck only.

Required verification should include, where relevant:

- `npm run check`
- `npm run build`
- `npm run smoke`
- targeted integration/regression coverage for:
  - settings propagation
  - routing to default directories
  - dispatch lease enforcement
  - acceptance-agent completion flow
  - budget hard-stop and continue path
  - workspace display of acceptance/budget/multi-agent data

## 7. Final Prompt For GLM-5.1

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
14. docs/glm-5.1-post-contract-integration-spec.md
15. 与当前目标相关的专题文档

当前任务：
严格按照 docs/glm-5.1-post-contract-integration-spec.md 的固定顺序，连续落地全部 in-scope 项目，从 P0 开始一直做到 P6；除非只剩真实外部阻塞，否则中间不要停止，不要只做分析，不要分批等确认。

强制要求：
- 不要替换当前 local-first typed runtime backbone
- 不要把新 contracts 停留在 shared-runtime 层，必须接到 control plane、task pipeline、workspace UI 和验证链
- 不要削弱 checklist / acceptance-agent / reconciliation / done gate 顺序
- 不要允许子 agent 默认无限派生
- 不要允许同一 plan step 同时被多个 active subagent 领取
- 不要在超过预算硬上限后静默继续
- 不要只做 typecheck 就停止
- 每完成一项都必须同步更新相关文档，保持 implemented / partial / future-target 边界诚实
- 每完成一轮必须给出 verification 结果

执行方式：
- 严格按 P0 -> P6 顺序推进
- 每个阶段先给出 architecture alignment summary、涉及模块、current-state vs target-state、verification plan
- 然后直接编码实现
- 不要停在“方案设计完成”
- 不要跳过测试、回归、类型检查、构建、冒烟或确定性验证
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

现在开始，从 P0 开始连续实现，直到 docs/glm-5.1-post-contract-integration-spec.md 的 stop condition 触发为止。
```

## 8. One-Line Compressed Prompt

```text
在 apex 仓库中严格按 docs/glm-5.1-architecture-execution-spec.md、docs/local-settings-and-runtime-defaults.md、docs/multi-agent-governance-and-budgeting.md 和 docs/glm-5.1-post-contract-integration-spec.md，按 P0→P6 连续把新增 settings / 多agent / acceptance / budget contracts 接入 control plane、task pipeline、workspace UI 和 smoke/regression 验证，直到 stop condition 触发为止。
```
