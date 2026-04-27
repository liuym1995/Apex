# GLM-5.1 Unified Final Completion Spec

This document is the unified master handoff for all remaining work after:

- local-first runtime closure is complete
- external resource probing has confirmed that the previously known external lanes remain blocked
- a new architecture objective has been added:
  - surpass Hermes-style self-evolution
  - add live OpenClaw ClawHub compatibility beyond static format import/export

Use it when the goal is:

- continue all remaining meaningful repo-local work first
- then automatically switch back to real external resource activation work
- give `GLM-5.1` one stable instruction set that does not stall at the old external-blocked checkpoint when new local in-scope work still exists

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`../master_plan.md`](../master_plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./skill-compatibility.md`](./skill-compatibility.md)
- [`./hermes-self-evolution-and-clawhub-adoption.md`](./hermes-self-evolution-and-clawhub-adoption.md)
- [`./glm-5.1-hermes-clawhub-spec.md`](./glm-5.1-hermes-clawhub-spec.md)
- [`./glm-5.1-external-completion-master-spec.md`](./glm-5.1-external-completion-master-spec.md)
- [`./glm-5.1-resource-arrival-playbook.md`](./glm-5.1-resource-arrival-playbook.md)

When this document and current code differ, repository code and typed contracts remain authoritative for current behavior.

## 1. Purpose

The project now has two different kinds of remaining work:

1. **new repo-local modernization work**
   - the Hermes / ClawHub adoption wave
2. **resource-gated external activation work**
   - admin, Docker, Ollama, Temporal, LangGraph, libSQL, OTEL, macOS/Linux hosts, SSO, DeerFlow

The correct continuation rule is therefore:

- do all remaining meaningful repo-local work first
- do not wait for external resources while local in-scope architecture work is still open
- once the Hermes / ClawHub wave is complete, switch back to the external resource activation master flow

## 2. Global Execution Policy

From now on, `GLM-5.1` must obey this decision tree in order:

1. check whether the `Hermes / ClawHub` wave is fully implemented
2. if not, continue that wave first
3. only after that wave reaches stop condition should the agent switch to external resource activation
4. during the external phase, continue only when a real resource has appeared

This prevents the agent from incorrectly stopping just because external resources are still blocked while new local in-scope work remains.

## 3. Fixed Completion Order

### 3.1 Phase A: Hermes / ClawHub Upgrade Wave

Treat the following as the current highest-priority in-scope work until completed:

- [`./hermes-self-evolution-and-clawhub-adoption.md`](./hermes-self-evolution-and-clawhub-adoption.md)
- [`./glm-5.1-hermes-clawhub-spec.md`](./glm-5.1-hermes-clawhub-spec.md)

Execution rule:

- continue through P0 -> P6 in `glm-5.1-hermes-clawhub-spec.md`
- do not stop just because external resources are blocked
- only true blockers for this phase are:
  - a direct architecture conflict
  - or a genuinely required external dependency for a specific sub-item

Expected Phase A target:

- live self-evolution candidate pipeline
- replay/regression/budget-governed evolution gate
- learning-factory-integrated evolution flow
- live ClawHub registry adapter boundary
- trust/governance-aware remote skill review and activation flow

### 3.2 Phase B: External Completion Master Flow

Once Phase A reaches stop condition, switch to:

- [`./glm-5.1-external-completion-master-spec.md`](./glm-5.1-external-completion-master-spec.md)

Execution rule:

- re-probe real resources
- activate only the highest-priority newly unlocked external lane
- verify honestly
- stop when the next lane is still blocked

Expected Phase B target:

- privileged Windows isolation
- container / VM isolation backends
- self-hosted model activation
- remote orchestration activation
- remote persistence / observability activation
- cross-platform host validation
- enterprise / DeerFlow edge activation

## 4. What Must Not Change

- do not replace the local-first typed runtime backbone
- do not replace canonical skill truth with ClawHub truth
- do not weaken acceptance-agent / reconciliation / done gate semantics
- do not auto-activate external skills without trust/governance review
- do not auto-promote self-evolution candidates without replay/regression/budget/governance gates
- do not regress the completed local closure behavior for settings, delegated runtime, envelopes, acceptance, or budget pause/continue
- do not claim live external activation without real resource validation
- do not add silent egress

## 5. Stop Conditions

Stop only when one of these becomes true:

1. Phase A is complete and Phase B has no newly unlocked real resource
2. Phase A or Phase B encounters a true external blocker for the currently active item
3. the entire product has reached full completion across both Phase A and Phase B
4. a requested direction conflicts with higher-authority architecture rules and cannot be implemented as requested without violating them

## 6. Final Prompt For GLM-5.1

Use the following prompt as the unified continuation prompt.

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
9. docs/hermes-self-evolution-and-clawhub-adoption.md
10. docs/glm-5.1-hermes-clawhub-spec.md
11. docs/glm-5.1-external-completion-master-spec.md
12. docs/glm-5.1-resource-arrival-playbook.md
13. docs/glm-5.1-unified-final-completion-spec.md
14. 与当前目标相关的专题文档

当前任务：
严格按照 docs/glm-5.1-unified-final-completion-spec.md 执行后续全部工作。

执行总规则：
- 先判断 Hermes / ClawHub 波次是否已经全部完成
- 如果还没完成，就严格按 docs/glm-5.1-hermes-clawhub-spec.md 的 P0→P6 连续实现，不要因为外部资源仍阻塞就提前停止
- 只有当 Hermes / ClawHub 波次完成后，才切换到 docs/glm-5.1-external-completion-master-spec.md
- 切换到外部阶段后，必须先重探真实资源，只解锁并实现当前最高优先级 newly unlocked 外部 lane；如果没有新资源，则诚实停止

强制要求：
- 不要替换当前 local-first typed runtime backbone
- 不要把 ClawHub 当成内部 source of truth；内部仍然必须以 CanonicalSkillSpec 为中心
- 不要自动激活外部 skills；必须经过 trust / governance
- 不要自动推广 evolution candidates；必须经过 replay / regression / budget / governance gates
- 不要削弱 acceptance-agent / reconciliation / done gate
- 不要引入隐藏 external sync 或 silent egress
- 在外部阶段，不要在没有真实 endpoint / credential / installation / privilege / host 时谎报 live integration
- 每完成一项都必须同步更新相关文档，保持 implemented / partial / blocked / future-target 边界诚实
- 每完成一轮必须给出 verification 结果

执行方式：
- 如果 Hermes / ClawHub 波次未完成：严格按 P0 -> P6 顺序推进
- 如果 Hermes / ClawHub 波次已完成：切换到外部阶段，先重探资源，再只做最高优先级 newly unlocked lane
- 每个阶段先给出 architecture alignment summary、涉及模块、current-state vs target-state、verification plan
- 然后直接编码实现
- 不要停在“方案设计完成”
- 不要跳过测试、回归、类型检查、构建、冒烟或确定性验证
- 如果遇到真实外部阻塞，只能落 boundary / adapter / readiness，并明确标注 blocked，不得谎报已完成

完成汇报格式：
1. current target
2. why highest priority
3. files changed
4. what moved from baseline/partial/blocked to upgraded implementation or live verified capability
5. what remains partial
6. what is externally blocked
7. verification run
8. next target

现在开始：
1. 先判断 docs/glm-5.1-hermes-clawhub-spec.md 是否已经全部完成
2. 若未完成，则从该 spec 的 P0 开始连续实现直到 stop condition
3. 若已完成，则切换到 docs/glm-5.1-external-completion-master-spec.md，重探真实资源并继续最高优先级 newly unlocked lane，直到本轮 stop condition 触发为止。
```

## 7. One-Line Compressed Prompt

```text
在 apex 仓库中严格按 docs/glm-5.1-unified-final-completion-spec.md 执行：先完成 Hermes/ClawHub 波次的全部 P0→P6，本地补强做完后再自动切换到外部资源激活总线，只实现最高优先级 newly unlocked lane，直到整个项目完成或当前轮次真实阻塞。
```

## 8. Operator Reminder

If the Hermes / ClawHub phase is still incomplete, do not use the older external-only continuation prompt.

Use this unified prompt instead.

If the Hermes / ClawHub phase is already complete, this unified prompt will naturally fall through into the external activation phase.
