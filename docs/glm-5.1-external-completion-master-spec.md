# GLM-5.1 External Completion Master Spec

This document is the final master handoff for all remaining work after the repository has already completed:

- the local-first implementation waves
- the computer-use completion waves
- the hybrid memory / TTT contract waves
- the frontier-upgrade wave
- the post-frontier resource-gated activation wave
- the post-contract integration wave
- the final local closure wave

Use it when the goal is:

- continue the project from the now locally-closed state
- activate every remaining external or privilege-gated lane as resources arrive
- keep one permanent, non-drifting instruction set for `GLM-5.1` until the product reaches full completion

This document is subordinate to:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`../master_plan.md`](../master_plan.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./glm-5.1-final-resource-activation-master-spec.md`](./glm-5.1-final-resource-activation-master-spec.md)
- [`./glm-5.1-resource-arrival-playbook.md`](./glm-5.1-resource-arrival-playbook.md)
- [`./glm-5.1-final-local-closure-spec.md`](./glm-5.1-final-local-closure-spec.md)
- [`./local-settings-and-runtime-defaults.md`](./local-settings-and-runtime-defaults.md)
- [`./multi-agent-governance-and-budgeting.md`](./multi-agent-governance-and-budgeting.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./deployment-and-environments.md`](./deployment-and-environments.md)
- [`./observability-and-operations.md`](./observability-and-operations.md)

When this document and current code differ, repository code and typed contracts remain authoritative for current behavior.

## 1. Current Global State

At the time this spec is created, the project has already reached this point:

- all meaningful repo-local architecture work is complete
- all meaningful local UI / API / task-pipeline closure work is complete
- dispatch leasing, subagent envelopes, acceptance-agent flow, and budget pause/continue are already integrated locally
- every remaining lane is now either:
  - `privilege-blocked`
  - `host-blocked`
  - `credential-blocked`
  - `endpoint-blocked`

The purpose of this document is not to invent more local work.

The purpose is to:

- resume only when a real external resource becomes available
- activate the corresponding lane immediately
- verify it honestly
- stop again when the next remaining lane is still blocked

## 2. Fixed Truth Boundary

From now on, `GLM-5.1` must obey these rules:

- do not invent more repo-local "readiness" work for blocked items unless a tiny adapter is strictly required to connect a now-available real backend
- do not claim a blocked lane is live unless it was validated against the real resource
- do not regress or bypass the newly completed local closure behavior:
  - settings-backed runtime defaults
  - dispatch-plan leasing
  - subagent context/result envelopes
  - acceptance-agent completion flow
  - budget hard-stop and explicit continue flow
- do not replace the current typed runtime backbone
- do not replace the current MCP host boundary
- do not replace the current memory backbone
- do not bypass verifier, acceptance-agent, reconciliation, or done gate
- do not add silent egress

This stage is purely:

- resource-triggered activation
- live verification
- documentation truth refresh

## 3. Current Resource Matrix

Treat the following as the last known baseline until re-probed.

### 3.1 Available Now

- Node.js
- Python
- Git
- Playwright
- Windows host
- local runtime backbone
- local filesystem
- local process spawn
- MCP host boundary
- trace grading and eval flywheel
- memory layers
- rule-based sandboxing
- Windows Job Object sandbox provider
- local SQLite persistence
- local OTEL / trace / audit path
- settings-backed runtime defaults
- local multi-agent governance
- local acceptance-agent flow
- local budget pause/continue flow

### 3.2 Missing Or Blocked

- admin privilege
- Docker
- Podman
- Hyper-V
- working WSL2-backed Linux path or Linux host
- Ollama or equivalent self-hosted model service
- Temporal server or CLI/runtime
- LangGraph runtime
- libSQL / Turso endpoint
- remote OTEL endpoint
- macOS host
- enterprise SSO credentials
- DeerFlow live endpoint

## 4. Global Resume Strategy

Whenever the user provides one or more real resources, `GLM-5.1` must:

1. refresh truth for that resource
2. determine which blocked lane it unlocks
3. execute only the highest-priority newly unlocked lane(s)
4. validate them against the real backend/host/privilege
5. update docs and status honestly
6. stop again if the next lane still depends on another missing resource

If multiple resources become available at the same time, use the priority order in Section 5.

## 5. Fixed Activation Order

### 5.1 Priority 1: Privileged Windows Isolation

Resume when:

- administrator privilege is available

Activate:

- Windows integrity-level sandbox lane
- Windows firewall-backed sandbox lane where documented
- Hyper-V discovery if admin also unlocks it

Expected outcomes:

- move Windows isolation from partial provider activation to stronger real enforcement
- verify provider selection, enforcement evidence, cleanup, and rollback behavior
- preserve current budget / acceptance / delegated-runtime semantics while privileged isolation is active

Main files:

- `packages/shared-runtime/src/sandbox-provider-layer.ts`
- `packages/shared-runtime/src/windows-native-isolation.ts`
- `packages/shared-runtime/src/real-windows-job-object.ts`
- `packages/shared-runtime/src/sandbox-executor.ts`

### 5.2 Priority 2: Container / VM Isolation Backends

Resume when one or more of these exist:

- Docker
- Podman
- Hyper-V
- working WSL2 or Linux validation path

Activate:

- Docker-backed sandbox provider
- Podman-backed sandbox provider
- Hyper-V-backed sandbox provider
- Linux-side sandbox validation if available

Expected outcomes:

- real provider activation
- real capability negotiation
- real execution verification
- honest fallback when a provider is installed but unusable

### 5.3 Priority 3: Self-Hosted Model + TTT Specialist Lane

Resume when:

- Ollama or another self-hosted model endpoint is available

Activate:

- live model route wiring
- baseline inference
- adapted inference
- TTT specialist lane activation
- replay-eval
- rollback and promotion checks

Expected outcomes:

- live self-hosted inference through the current gateway
- live gated TTT specialist lane
- durable retrieval remains default
- task budget and pricing enforcement continue to work with the self-hosted route

Main files:

- `packages/shared-runtime/src/model-gateway-executor.ts`
- `packages/shared-runtime/src/hybrid-memory-ttt.ts`
- `packages/shared-runtime/src/ttt-specialist-lane.ts`

### 5.4 Priority 4: Remote Orchestration

Resume when one or more of these exist:

- Temporal runtime/server/CLI
- LangGraph runtime

Activate:

- real Temporal lane behind the orchestration SPI
- optional LangGraph lane behind the orchestration SPI

Expected outcomes:

- local typed runtime remains primary
- Temporal and/or LangGraph become verified optional lanes
- run/checkpoint/interrupt/resume/cancel/trace mapping validated live
- delegated-runtime governance, dispatch leasing, and envelope semantics remain preserved across the boundary

Main files:

- `packages/shared-runtime/src/orchestration-spi.ts`
- `packages/shared-runtime/src/temporal-langgraph-boundary.ts`

### 5.5 Priority 5: Remote Persistence + Remote Observability

Resume when one or more of these exist:

- `DATABASE_URL` / libSQL / Turso endpoint
- OTEL collector endpoint with explicit export enablement

Activate:

- remote libSQL persistence augmentation
- remote OTEL export

Expected outcomes:

- no-silent-egress rule remains intact
- failure behavior remains honest
- local fallback remains intact
- acceptance, budget, dispatch, and envelope records are preserved correctly in the remote-augmented path

Main files:

- `packages/shared-state/src/libsql-adapter.ts`
- `packages/shared-runtime/src/otel-export.ts`
- `packages/shared-runtime/src/observability-persistence-activation.ts`

### 5.6 Priority 6: Cross-Platform Host Validation

Resume when one or more of these exist:

- macOS host
- Linux host
- a repaired and usable Linux validation environment

Activate:

- macOS host validation
- Linux host validation
- computer-use runtime parity verification

Expected outcomes:

- real platform parity evidence
- updated runbooks
- no false parity claims

Main files:

- `packages/shared-runtime/src/host-validation-activation.ts`
- `packages/shared-runtime/src/computer-use-runtime.ts`
- `docs/computer-use-runtime.md`

### 5.7 Priority 7: Enterprise / Cloud Edge Integrations

Resume only when corresponding real resources exist:

- enterprise SSO credentials
- DeerFlow live endpoint

Activate:

- live SSO integration
- live DeerFlow boundary verification

Expected outcomes:

- enterprise or DeerFlow lanes remain optional and non-backbone
- no architecture drift away from the current public backbone

## 6. Stop Conditions

Stop only when one of these becomes true:

1. a newly unlocked lane has been fully activated and verified, and the next lane is still blocked by a different missing resource
2. no newly available real resource exists
3. the product has reached full completion across all activation lanes
4. a requested action conflicts with higher-authority architecture rules and cannot be implemented as requested without violating them

## 7. Final Prompt For GLM-5.1

Use the following prompt to continue the project from this point forward.

```text
在 apex 仓库中执行实现任务。

严格遵守以下文档，且按 authority order 执行：
1. docs/glm-5.1-architecture-execution-spec.md
2. docs/architecture-constitution.md
3. docs/architecture-document-system.md
4. docs/best-practice-reset-plan.md
5. master_plan.md
6. docs/current-architecture-status.md
7. docs/glm-5.1-final-resource-activation-master-spec.md
8. docs/glm-5.1-resource-arrival-playbook.md
9. docs/glm-5.1-final-local-closure-spec.md
10. docs/glm-5.1-external-completion-master-spec.md
11. 与当前目标相关的专题文档

当前任务：
严格按照 docs/glm-5.1-external-completion-master-spec.md 执行后续全部工作。项目当前已经完成所有本地可落地闭环能力，因此不要再新增本地 readiness，不要回头重做 settings / dispatch / envelopes / acceptance / budget 的本地集成。你只能做一件事：重探真实资源，解锁最高优先级 newly unlocked 外部 lane，完成真实激活、真实验证、真实文档更新；如果下一个 lane 仍然缺资源，就诚实停止。

强制要求：
- 不要替换当前 local-first typed runtime backbone
- 不要替换当前 MCP host boundary、memory backbone、acceptance-agent flow、budget flow
- 不要新增伪 readiness 层，除非是连接一个已经真实可用后端所必需的极小 adapter
- 不允许 silent egress
- 不允许绕过 verifier / acceptance-agent / reconciliation / done gate
- 不允许在没有真实 endpoint / credential / installation / privilege / host 时谎报 live integration
- 只允许对 newly unlocked lane 继续实现
- 如果多个资源同时可用，必须按 docs/glm-5.1-external-completion-master-spec.md 第 5 节固定优先级推进
- 每完成一轮必须同步更新相关文档，保持 blocked / boundary-only / live verified 边界诚实

执行方式：
- 每次运行都先执行资源真相探测
- 按 master spec 的 resource-to-lane mapping 判断哪些 lane 被解锁
- 只选择最高优先级 newly unlocked lane
- 对该 lane 做真实激活与验证
- 更新 docs/current-architecture-status.md 和相关文档
- 如果下一个 lane 仍然被资源阻塞，则停止，不得继续做 speculative work

每轮汇报格式：
1. which real resources are now available
2. which lane(s) those resources unlock
3. current classification for each relevant lane
4. files changed
5. what moved from blocked/boundary-only to live verified capability
6. what remains blocked and the exact missing resource
7. verification run
8. next highest-priority blocked lane

现在开始：先重新探测真实资源，然后按照 docs/glm-5.1-external-completion-master-spec.md 执行，直到第 6 节 stop condition 触发为止。
```

## 8. One-Line Compressed Prompt

```text
在 apex 仓库中严格按 docs/glm-5.1-external-completion-master-spec.md 执行：先重探真实资源，只解锁并实现当前最高优先级 newly unlocked 外部 lane，做真实激活、真实验证、真实文档更新；若下一个 lane 仍缺资源则诚实停止，直到全部外部 lane 完成。
```

## 9. Operator Reminder

If no new real resource has appeared, do not ask `GLM-5.1` to continue implementation.

The correct action is:

- either provide a new real resource
- or stop and wait

## 10. One-Sentence Summary

`This master spec becomes the permanent continuation rule after final local closure: resume only when a real external resource appears, activate only the highest-priority newly unlocked lane, verify it honestly, and stop again as soon as the next real blocker is encountered.`
