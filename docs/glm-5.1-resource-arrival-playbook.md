# GLM-5.1 Resource Arrival Playbook

This document is the practical follow-up companion to:

- [`./glm-5.1-final-resource-activation-master-spec.md`](./glm-5.1-final-resource-activation-master-spec.md)
- [`./glm-5.1-post-frontier-resource-gated-spec.md`](./glm-5.1-post-frontier-resource-gated-spec.md)
- [`./glm-5.1-resource-gated-resume-spec.md`](./glm-5.1-resource-gated-resume-spec.md)

Use it when:

- the project is fully blocked by missing real resources
- one or more real resources have just become available
- you want to give `GLM-5.1` a short, exact, no-drift prompt for that specific resource event

This document does not replace the master spec.

It translates the master spec into direct operator actions and ready-to-send prompts.

## 1. How To Use This Playbook

When a resource arrives:

1. identify which resource class changed
2. use the matching subsection below
3. send the matching prompt to `GLM-5.1`
4. require it to follow:
   - [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
   - [`./glm-5.1-final-resource-activation-master-spec.md`](./glm-5.1-final-resource-activation-master-spec.md)
5. let it run until:
   - the newly unlocked lane is fully activated and verified
   - or the next blocker is still missing

## 2. Resource Event Priority

If multiple resources arrive together, use this priority:

1. administrator privilege
2. Docker / Podman / Hyper-V / working WSL2
3. Ollama or self-hosted model service
4. Temporal / LangGraph
5. libSQL / OTEL endpoint
6. macOS / Linux host
7. SSO / DeerFlow endpoint

## 3. Resource-Specific Resume Plans

### 3.1 Administrator Privilege Arrives

This unlocks the current highest-priority blocked lane.

GLM-5.1 must:

- re-probe admin-only capabilities
- activate privileged Windows isolation paths
- verify Windows integrity-level and firewall-backed sandbox behavior where supported
- verify Hyper-V discovery if admin access reveals it
- update status docs honestly

Short prompt:

```text
管理员权限现在已到位。请在 apex 仓库中严格按 docs/glm-5.1-architecture-execution-spec.md 和 docs/glm-5.1-final-resource-activation-master-spec.md 执行：重新探测资源，优先解锁并实现 Priority 5.1 的 Privileged Windows Isolation lane，完成真实激活、真实验证、文档更新；完成后若下一个 lane 仍缺资源则诚实停止。
```

### 3.2 Docker / Podman / Hyper-V / WSL2 Arrives

This unlocks container or VM sandbox provider work.

GLM-5.1 must:

- verify the installed backend is real and usable
- activate the corresponding sandbox provider
- validate enforcement, cleanup, fallback, and evidence
- stop when the next provider is still blocked

Short prompt:

```text
以下资源现在已到位：{{填写 Docker / Podman / Hyper-V / WSL2 真实状态}}。请在 apex 仓库中严格按 docs/glm-5.1-final-resource-activation-master-spec.md 执行，优先解锁 Priority 5.2 的 container / VM isolation lane，只做真实 provider 激活与验证，不做伪 readiness；完成后若下一个 lane 仍缺资源则停止。
```

### 3.3 Ollama Or Self-Hosted Model Service Arrives

This unlocks the self-hosted model and TTT specialist lane.

GLM-5.1 must:

- verify model endpoint connectivity
- wire the self-hosted route into the current model gateway
- activate baseline and adapted inference
- verify TTT gate, rollback, replay-eval, and promotion rules
- keep durable retrieval as default

Short prompt:

```text
Ollama / self-hosted model 服务现在已到位。请在 apex 仓库中严格按 docs/glm-5.1-final-resource-activation-master-spec.md 执行，优先解锁 Priority 5.3 的 self-hosted model + TTT specialist lane，完成真实接线、真实验证、文档更新，并保持 durable retrieval 为默认路径；完成后若下一个 lane 仍缺资源则停止。
```

### 3.4 Temporal Or LangGraph Arrives

This unlocks real remote orchestration.

GLM-5.1 must:

- verify the real orchestration runtime
- activate the corresponding lane behind the existing SPI
- keep local typed runtime as primary
- validate run/checkpoint/interrupt/resume/cancel/trace mapping

Short prompt:

```text
以下远程编排资源现在已到位：{{填写 Temporal / LangGraph 真实状态}}。请在 apex 仓库中严格按 docs/glm-5.1-final-resource-activation-master-spec.md 执行，优先解锁 Priority 5.4 的 remote orchestration lane，只在现有 SPI 边界后做真实激活与验证，不替换当前 backbone；完成后若下一个 lane 仍缺资源则停止。
```

### 3.5 libSQL / Turso / OTEL Endpoint Arrives

This unlocks remote persistence and remote observability activation.

GLM-5.1 must:

- verify endpoint reachability and config gates
- activate only explicitly configured remote export / sync
- preserve no-silent-egress
- validate success path, failure path, fallback, and audit trail

Short prompt:

```text
以下远程资源现在已到位：{{填写 DATABASE_URL / OTEL endpoint / 开关状态}}。请在 apex 仓库中严格按 docs/glm-5.1-final-resource-activation-master-spec.md 执行，优先解锁 Priority 5.5 的 remote persistence + observability lane，只做显式配置下的真实激活与验证，严格保持 no-silent-egress；完成后若下一个 lane 仍缺资源则停止。
```

### 3.6 macOS Or Linux Host Arrives

This unlocks cross-platform host validation.

GLM-5.1 must:

- probe the real host
- run computer-use runtime validation on that host
- verify accessibility, action providers, screenshot, replay, and diagnostics
- update platform parity docs honestly

Short prompt:

```text
现在已提供真实主机：{{填写 macOS / Linux / 两者}}。请在 apex 仓库中严格按 docs/glm-5.1-final-resource-activation-master-spec.md 执行，优先解锁 Priority 5.6 的 cross-platform host validation lane，完成真实主机探测、computer-use 真实验证和文档更新；未验证的能力不得标记为 parity complete。
```

### 3.7 SSO Credentials Or DeerFlow Endpoint Arrive

This unlocks the final optional enterprise/cloud edge lanes.

GLM-5.1 must:

- verify the real credential or endpoint
- activate only the exact lane unlocked
- keep DeerFlow optional and non-backbone
- keep enterprise auth and tenant mapping honest

Short prompt:

```text
以下企业/边缘资源现在已到位：{{填写 SSO credentials / DeerFlow endpoint 真实状态}}。请在 apex 仓库中严格按 docs/glm-5.1-final-resource-activation-master-spec.md 执行，优先解锁 Priority 5.7 的 enterprise / DeerFlow lane，只做真实接入与验证，不改变当前 backbone；完成后若下一个 lane 仍缺资源则停止。
```

## 4. Universal Prompt Template

If you want one reusable template instead of the short prompts above, use this:

```text
以下真实资源现在已到位：
{{把新增可用的真实资源逐条写清楚}}

请在 apex 仓库中严格遵守：
1. docs/glm-5.1-architecture-execution-spec.md
2. docs/architecture-constitution.md
3. docs/architecture-document-system.md
4. docs/current-architecture-status.md
5. docs/glm-5.1-final-resource-activation-master-spec.md
6. 与当前 lane 相关的专题文档

执行要求：
- 先重新探测真实资源
- 按 docs/glm-5.1-final-resource-activation-master-spec.md 的优先级，只解锁当前最高优先级 newly unlocked lane
- 只做真实激活、真实验证、真实文档更新
- 不新增 readiness，不替换 backbone，不做 speculative work
- 完成后如果下一 lane 仍缺资源，则诚实停止

汇报格式必须包含：
1. which real resources are now available
2. which lane(s) those resources unlock
3. current classification for each relevant lane
4. files changed
5. what moved from blocked/boundary-only to live verified capability
6. what remains blocked and the exact missing resource
7. verification run
8. next highest-priority blocked lane
```

## 5. Operator Reminder

If no new real resource has appeared, do not ask `GLM-5.1` to continue implementation.

The correct action is:

- either provide a new real resource
- or stop and wait

## 6. One-Sentence Summary

`This playbook turns each newly available real resource into a direct, ready-to-send GLM-5.1 execution prompt so the project resumes only on the highest-priority newly unlocked lane and stops again as soon as the next real blocker is reached.`
