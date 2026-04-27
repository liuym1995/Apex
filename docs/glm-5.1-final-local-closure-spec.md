# GLM-5.1 Final Local Closure Spec

This document is the continuous handoff for the final locally achievable closure wave after:

- typed contracts have landed
- post-contract integration has landed
- the repository already exposes settings defaults, delegation policy, dispatch-plan APIs, subagent envelopes, acceptance-agent contracts, and task budget contracts

Use it when the goal is:

- close the remaining local partials
- remove the last meaningful gap between "integrated" and "fully closed" behavior
- finish all repo-local work before only true external-resource blockers remain

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
- [`./glm-5.1-post-contract-integration-spec.md`](./glm-5.1-post-contract-integration-spec.md)

When this document and current code differ, typed contracts and repository code remain authoritative for current behavior.

## 1. Goal

Land one continuous final-local wave that finishes the remaining repo-local execution gaps without stopping mid-way.

The target is not new architecture.

The target is final local closure for:

- delegated runtime dispatch leasing in the actual execution path
- automatic subagent envelope creation during handoff
- budget interruption visibility and continue flow in real workspace behavior
- final app-level regression and documentation convergence

`Do not stop after one item. Continue through the ordered list until every in-scope item is landed or only true external blockers remain.`

## 2. What Must Not Change

- do not replace the current local-first typed runtime backbone
- do not weaken checklist / acceptance-agent / reconciliation / done gate ordering
- do not bypass plan leasing or hard subagent caps
- do not silently continue past hard budget caps
- do not downgrade real integration back into route-only or UI-only mock behavior
- do not claim "fully complete" while any of the listed local partials remain open

## 3. Current Boundary

The latest integration wave already landed:

- settings UI and validation for new defaults
- control-plane endpoints for delegation policy, dispatch plans, acceptance, and budget
- task pipeline insertion of acceptance and budget logic
- workspace cards for acceptance, budget, and multi-agent limits

The remaining local partials are now specifically:

1. dispatch-plan leasing is not yet wired into the real delegated-runtime execution path
2. subagent envelope creation is not yet automatically triggered during actual agent-team handoff
3. budget interruption state is not yet surfaced to the workspace in a stronger real-time / near-real-time operator flow

Everything else in this wave should serve closing those gaps and proving them through verification.

## 4. Fixed Execution Order

### 4.1 P0: Wire Dispatch Leasing Into Real Delegated Runtime Execution

Current status:

- dispatch-plan and assignment-lease APIs exist
- delegated runtime exists
- the actual delegated-runtime flow does not yet depend on the dispatch lease model

Target outcomes:

- every delegated execution launch should be backed by a real dispatch-plan step
- every delegated worker session should map to:
  - a dispatch step
  - a subagent assignment
  - an active assignment lease
- duplicate active assignment on the same step must be impossible in the real execution path, not just at API layer
- lease release / failure / retry must update the dispatch plan consistently

Repository landing areas:

- `packages/shared-runtime/src/delegated-runtime-hardening.ts`
- `packages/shared-runtime/src/index.ts`
- `apps/local-control-plane/src/index.ts`
- `docs/api-contracts.md`
- `docs/data-model.md`

### 4.2 P1: Trigger Subagent Context Envelopes Automatically During Handoff

Current status:

- subagent envelope types and manual API access exist
- the actual delegated handoff path may still bypass automatic envelope creation

Target outcomes:

- supervisor-to-subagent handoff must automatically create a scoped `SubagentContextEnvelope`
- subagent completion must automatically persist a compact `SubagentResultEnvelope`
- envelope creation must use:
  - step goal
  - relevant artifacts
  - relevant memory
  - relevant policy
  - step-level DoD
  - tool/sandbox allowances
  - budget/resource limits
- the supervisor should consume the compact result envelope instead of uncontrolled full-context reattachment

Repository landing areas:

- `packages/shared-runtime/src/subagent-envelopes.ts`
- `packages/shared-runtime/src/delegated-runtime-hardening.ts`
- `packages/shared-runtime/src/index.ts`
- `apps/local-control-plane/src/index.ts`

### 4.3 P2: Strengthen Budget Interruption Into Real Workspace Control Flow

Current status:

- budget contracts exist
- budget checks exist
- budget pause/continue routes exist
- workspace visibility may still be polling-only or too weakly linked to active interruption state

Target outcomes:

- when budget hard limit is reached:
  - task enters a clear budget-paused state
  - interruption event is persisted
  - workspace state reflects it without ambiguity
  - user sees current spend and current cap
- user continuation path should be complete and operator-safe:
  - explicit raise-limit action
  - explicit one-time extension action
  - explicit stop action
- resume should happen only after explicit continuation approval is recorded
- near-real-time refresh is acceptable if true push is not already available, but the operator flow must feel complete and trustworthy

Repository landing areas:

- `packages/shared-runtime/src/task-budget.ts`
- `packages/shared-runtime/src/desktop-workspace.ts`
- `packages/shared-runtime/src/index.ts`
- `apps/local-control-plane/src/index.ts`
- `apps/desktop-shell/src/App.tsx`
- `apps/desktop-shell/src/styles.css`

### 4.4 P3: Tighten End-To-End Acceptance / Delegation / Budget Regression Coverage

Current status:

- typecheck and build pass
- smoke assertions exist
- the new local closures still need stronger scenario coverage

Target outcomes:

- add scenario tests for:
  - delegated execution creates dispatch lease automatically
  - duplicate delegated claim is rejected
  - subagent handoff creates context envelope automatically
  - subagent completion creates result envelope automatically
  - budget limit pauses the task
  - explicit continue raises or extends budget and resumes task
  - acceptance-agent outcome still gates completion correctly after delegated execution and budget-aware runs
- ensure smoke output reports these closures explicitly

Repository landing areas:

- `scripts/smoke-test.mjs`
- runtime regression suites
- any existing integration harness already used by the repo

### 4.5 P4: Final Docs And Status Convergence

Target outcomes:

- update `docs/current-architecture-status.md` honestly
- update `README.md` if user-visible behavior changed
- update `docs/api-contracts.md`
- update `docs/data-model.md`
- mark only true remaining external blockers as partial or blocked
- if a repo-local feature is now truly closed, mark it implemented

## 5. Stop Conditions

Stop only when one of these becomes true:

1. every in-scope item above is implemented and verified
2. only a true external blocker remains
3. a requested behavior conflicts with higher-authority architecture rules and cannot be implemented as requested without violating them

Do not stop merely because a previous spec's stop condition was met.
This spec exists specifically to close the remaining local partials after that wave.

## 6. Required Verification

For this handoff, `GLM-5.1` must not stop at typecheck only.

Required verification should include, where relevant:

- `npm run check`
- `npm run build`
- `npm run smoke`
- targeted regression coverage for:
  - delegated lease creation
  - duplicate assignment rejection
  - automatic envelope creation
  - budget pause / continue
  - acceptance-agent completion after delegated execution

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
15. docs/glm-5.1-final-local-closure-spec.md
16. 与当前目标相关的专题文档

当前任务：
严格按照 docs/glm-5.1-final-local-closure-spec.md 的固定顺序，连续落地全部 in-scope 项目，从 P0 开始一直做到 P4；除非只剩真实外部阻塞，否则中间不要停止，不要只做分析，不要分批等确认。

强制要求：
- 不要替换当前 local-first typed runtime backbone
- 不要把 dispatch leasing 停留在 API 层，必须真正接进 delegated runtime execution path
- 不要把 subagent envelope 停留在手动 API 调用层，必须在真实 handoff 中自动创建
- 不要让 budget pause/continue 只停留在后台状态，必须形成完整可见、可继续、可停止的 workspace/operator flow
- 不要削弱 checklist / acceptance-agent / reconciliation / done gate 顺序
- 不要只做 typecheck 就停止
- 每完成一项都必须同步更新相关文档，保持 implemented / partial / blocked 边界诚实
- 每完成一轮必须给出 verification 结果

执行方式：
- 严格按 P0 -> P4 顺序推进
- 每个阶段先给出 architecture alignment summary、涉及模块、current-state vs target-state、verification plan
- 然后直接编码实现
- 不要停在“方案设计完成”
- 不要跳过测试、回归、类型检查、构建、冒烟或确定性验证
- 如果遇到真实外部阻塞，只能落 boundary / adapter / readiness，并明确标注 blocked，不得谎报已完成

完成汇报格式：
1. current target
2. why highest priority
3. files changed
4. what moved from partial to implemented
5. what remains partial
6. what is externally blocked
7. verification run
8. next target

现在开始，从 P0 开始连续实现，直到 docs/glm-5.1-final-local-closure-spec.md 的 stop condition 触发为止。
```

## 8. One-Line Compressed Prompt

```text
在 apex 仓库中严格按 docs/glm-5.1-architecture-execution-spec.md、docs/multi-agent-governance-and-budgeting.md 和 docs/glm-5.1-final-local-closure-spec.md，按 P0→P4 连续把 dispatch leasing 真接入 delegated runtime、subagent envelope 自动接入 handoff、budget pause/continue 完整接入 workspace/operator flow，并补齐 smoke/regression 与文档收口，直到 stop condition 触发为止。
```
