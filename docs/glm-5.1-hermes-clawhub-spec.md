# GLM-5.1 Hermes And ClawHub Spec

This document is the continuous handoff for the next modernization wave focused on:

- surpassing Hermes-style self-evolution in a governed way
- adding live OpenClaw ClawHub compatibility beyond static format import/export

Use it when the goal is:

- move from "self-evolution primitives exist" to "live self-evolution lane exists"
- move from "OpenClaw skill format compatibility exists" to "live ClawHub registry adapter exists"
- do so without replacing the current backbone

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`../master_plan.md`](../master_plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./skill-compatibility.md`](./skill-compatibility.md)
- [`./multi-agent-governance-and-budgeting.md`](./multi-agent-governance-and-budgeting.md)
- [`./hermes-self-evolution-and-clawhub-adoption.md`](./hermes-self-evolution-and-clawhub-adoption.md)

When this document and current code differ, typed contracts and repository code remain authoritative for current behavior.

## 1. Goal

Land one continuous wave that upgrades the current repository from:

- governed self-evolution baseline
- canonical skill interoperability baseline

to:

- live evolution candidate pipeline
- live ClawHub registry adapter boundary

`Do not stop after one item. Continue through the ordered list until every in-scope item is landed or only true external blockers remain.`

## 2. What Must Not Change

- do not replace the current local-first typed runtime backbone
- do not replace the canonical skill registry with ClawHub as the internal source of truth
- do not weaken acceptance-agent / reconciliation / done gate semantics
- do not auto-activate external skills without trust/governance review
- do not auto-promote evolution candidates without replay/regression gates
- do not add silent external sync or hidden uploads
- do not turn self-evolution into unbounded token burn; it must remain budget-capped

## 3. Fixed Execution Order

### 3.1 P0: Add Live Evolution Run Contracts And Persistence

Current status:

- learning factory, methodology capture, replay/eval concepts, and TTT contracts already exist

What is still missing:

- first-class evolution-run records
- promotion and rollback records specialized for skills/prompts/tool descriptions

Target outcomes:

- add typed entities for:
  - `SkillEvolutionRun`
  - `PromptEvolutionRun`
  - `ToolDescriptionEvolutionRun`
  - `EvolutionCandidate`
  - `EvolutionPromotionDecision`
  - `EvolutionRollbackRecord`
- persist them locally through the current shared-state boundary
- expose audit linkage to source traces, findings, budgets, and acceptance results

Repository landing areas:

- `packages/shared-types/src/index.ts`
- `packages/shared-state/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `docs/data-model.md`

### 3.2 P1: Build Candidate Generation From Real Trace / Acceptance / Failure Signals

Current status:

- traces exist
- acceptance findings exist
- methodology feedback exists

What is still missing:

- a concrete runtime that turns those signals into evolution candidates automatically

Target outcomes:

- generate candidate evolution records from:
  - acceptance misses
  - verifier/acceptance findings
  - reconciliation failures
  - repeated fallback-to-local events
  - repeated reuse-navigation reopens
  - successful repeated task patterns
- classify candidates into:
  - skill improvement
  - prompt improvement
  - tool-description improvement
  - routing-rule improvement

Repository landing areas:

- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/trace-grading-eval.ts`
- `packages/shared-runtime/src/learning-factory-automation.ts`
- `docs/reuse-and-learning.md`

### 3.3 P2: Add Replay / Regression / Budget Gates For Evolution

Current status:

- replay and budget concepts exist in nearby subsystems

What is still missing:

- a real evolution gate pipeline

Target outcomes:

- every evolution candidate must pass:
  - bounded budget gate
  - replay-eval gate
  - regression gate
  - semantic-preservation gate
- unsuccessful candidates must be:
  - rejected
  - or rolled back
- successful candidates must still require governance review before activation

Repository landing areas:

- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/task-budget.ts`
- `packages/shared-runtime/src/trace-grading-eval.ts`
- `docs/reuse-and-learning.md`

### 3.4 P3: Insert Evolution Into The Live Learning Factory

Current status:

- learning factory exists
- skill candidates and playbook promotion already exist

What is still missing:

- the evolution lane as a first-class part of the factory

Target outcomes:

- integrate evolution runs into the existing learning factory pipeline
- store promotion decisions and rollback lineage
- expose evolution status in workspace / diagnostics / APIs
- keep governance and audit first-class

Repository landing areas:

- `packages/shared-runtime/src/learning-factory-automation.ts`
- `packages/shared-runtime/src/desktop-workspace.ts`
- `apps/local-control-plane/src/index.ts`
- `docs/desktop-workspace-ui.md`

### 3.5 P4: Add Live ClawHub Registry Adapter Boundary

Current status:

- OpenClaw format import/export exists
- canonical registry exists

What is still missing:

- live registry search / inspect / install / update / publish / sync boundary

Target outcomes:

- add typed entities for:
  - `ClawHubRegistryConfig`
  - `ClawHubSearchResult`
  - `ClawHubInstallRecord`
  - `ClawHubPublishRecord`
  - `ClawHubSyncRecord`
  - `RemoteSkillTrustVerdict`
- add a registry adapter that can:
  - search ClawHub
  - inspect metadata and files
  - install into canonical import/governance flow
  - publish reviewed canonical skills outward
  - sync metadata/version state back locally

Repository landing areas:

- `packages/shared-types/src/index.ts`
- `packages/shared-runtime/src/index.ts`
- `packages/shared-runtime/src/mcp-execution-fabric.ts`
- `apps/local-control-plane/src/index.ts`
- `docs/skill-compatibility.md`

### 3.6 P5: Add Trust, Governance, And Workspace Flows For Remote Skills

Current status:

- skill governance already exists locally

What is still missing:

- a remote-registry aware trust workflow

Target outcomes:

- imported ClawHub skills must default to `review_required`
- add trust verdicts based on:
  - registry source
  - verification signals
  - local policy
  - compatibility
- expose remote skill review flows in the workspace:
  - search
  - inspect
  - import
  - review
  - activate
  - update
  - publish

Repository landing areas:

- `apps/local-control-plane/src/index.ts`
- `apps/desktop-shell/src/App.tsx`
- `apps/desktop-shell/src/styles.css`
- `docs/desktop-workspace-ui.md`
- `docs/skill-compatibility.md`

### 3.7 P6: Final Verification And Documentation Convergence

Target outcomes:

- add smoke / regression coverage for:
  - evolution candidate creation
  - replay/regression gate behavior
  - promotion / rollback decisions
  - ClawHub search / inspect / install flows
  - governance review_required activation path
- update:
  - `docs/current-architecture-status.md`
  - `docs/reuse-and-learning.md`
  - `docs/skill-compatibility.md`
  - `README.md` if user-visible behavior changes

## 4. Stop Conditions

Stop only when one of these becomes true:

1. every in-scope item above is implemented and verified
2. only a true external blocker remains
3. a requested behavior conflicts with higher-authority architecture rules and cannot be implemented as requested without violating them

## 5. Final Prompt For GLM-5.1

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
7. docs/reuse-and-learning.md
8. docs/skill-compatibility.md
9. docs/multi-agent-governance-and-budgeting.md
10. docs/hermes-self-evolution-and-clawhub-adoption.md
11. docs/glm-5.1-hermes-clawhub-spec.md
12. 与当前目标相关的专题文档

当前任务：
严格按照 docs/glm-5.1-hermes-clawhub-spec.md 的固定顺序，连续落地全部 in-scope 项目，从 P0 开始一直做到 P6；除非只剩真实外部阻塞，否则中间不要停止，不要只做分析，不要分批等确认。

强制要求：
- 不要替换当前 local-first typed runtime backbone
- 不要把 ClawHub 当成内部 source of truth；内部仍然必须以 CanonicalSkillSpec 为中心
- 不要自动激活外部 skills；必须经过 trust / governance
- 不要自动推广 evolution candidates；必须经过 replay / regression / budget / governance gates
- 不要削弱 acceptance-agent / reconciliation / done gate
- 不要引入隐藏 external sync 或 silent egress
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

现在开始，从 P0 开始连续实现，直到 docs/glm-5.1-hermes-clawhub-spec.md 的 stop condition 触发为止。
```

## 6. One-Line Compressed Prompt

```text
在 apex 仓库中严格按 docs/reuse-and-learning.md、docs/skill-compatibility.md、docs/hermes-self-evolution-and-clawhub-adoption.md 和 docs/glm-5.1-hermes-clawhub-spec.md，按 P0→P6 连续落地 live 自进化候选/回放/回滚/治理链路，以及 live ClawHub 搜索/安装/发布/同步/信任治理适配，直到 stop condition 触发为止。
```
