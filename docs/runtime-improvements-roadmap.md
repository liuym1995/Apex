# Runtime Improvements Roadmap

This document tracks the architecture improvements that are worth pursuing beyond the current local-first MVP.

It complements:

- [`../master_plan.md`](../master_plan.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)

## 1. Why This Exists

The current project is already strong in:

- verification
- governance
- deep links and desktop operations
- learning and reuse
- local machine control

The next wave of improvements is about making the runtime more modular, more durable, and easier to scale into true multi-agent and cloud-augmented operation.

Current boundary note:

- the roadmap includes both already-landed runtime layers and future framework choices
- `best-practice-reset-plan.md` is the stricter redesign target when the team is willing to replace current direction instead of iterating compatibly
- `LangGraph` belongs to the future cloud-orchestrator direction, not the current local runtime implementation
- the current repository does not yet ship a `LangGraph` dependency or `LangGraph 2.x` graph implementation
- today, runtime orchestration is implemented through custom typed contracts, shared-runtime state transitions, and local control-plane APIs

## 2. Priority Improvements

### 2.1 Session / Harness / Sandbox Separation

Goal:

- make the runtime explicitly separate:
  - session state
  - orchestration harness
  - execution sandbox

Why it matters:

- lowers framework lock-in
- makes worker runtime replacement easier
- creates a cleaner path toward agent teams and stronger isolation

Current status:

- partially present in the architecture
- not yet fully separated in code

Landing plan:

1. introduce named contracts for session, harness, and sandbox
2. move high-risk execution behind sandbox-oriented interfaces
3. keep task state and UI concerns outside sandbox runners

### 2.2 Context Compaction and Memory Promotion

Goal:

- compact long task context automatically
- promote only high-signal summaries into reusable memory

Why it matters:

- reduces token and prompt sprawl
- keeps planning fast
- prevents learning storage from bloating

Current status:

- compact methodology memory already exists
- fingerprint-based merging already exists
- reuse-governance tasks now emit structured improvement context
- session compaction is now a first-class runtime behavior

Landing plan:

1. compact session summaries at task completion
2. promote reusable memory only after completion gates pass
3. keep evidence bounded and deduplicated
4. attach reuse-improvement hints back to target templates and playbooks

### 2.3 Subagents and Agent Teams

Goal:

- support supervisor-driven teams of workers with isolated contexts

Why it matters:

- prevents one giant context from carrying all reasoning
- enables parallel work
- improves recoverability of complex tasks

Current status:

- worker runtime exists
- governance and template systems already support delegated execution
- subagent session, message, and agent-team summary contracts now exist
- workspace now exposes isolated subagent contexts and supervisor/worker message summaries
- delegated checkpoint summaries and resume-support flags are now visible
- delegated handoff messages and a unified team timeline are now visible in the workspace
- delegated resume requests are now first-class contracts and can be initiated, accepted, completed, or rejected per resumable session, with resume packages moving from `prepared` to `applied` as the next delegated runtime consumes a handoff checkpoint and execution summary, and with delegated execution runs now tracking the first `running -> completed/failed` lifecycle after handoff application
- delegated execution runs now support runtime bindings, so a handoff package can be bound to a concrete runtime kind and sandbox profile before completion or failure is recorded
- delegated execution runs now create concrete runtime instances with heartbeat and finish states, so the handoff package is no longer just "applied" but actively tracked while a delegated runtime is alive
- current code still contains deeper delegated-runtime plumbing such as launcher, driver, adapter, backend-execution, runner, and job layers
- those details should now be treated as transitional internal implementation structure, not as the preferred stable public runtime surface
- fully independent delegated worker processes and external sandbox pools are still future work

Landing plan:

1. add subagent session contracts
2. add supervisor-to-worker message/result contracts
3. surface team mode, isolated contexts, and message feed in the workspace
4. add independent checkpointing and resume for delegated workers

### 2.4 Hard Sandboxing for Risky Execution

Goal:

- move high-risk machine actions into stronger isolation boundaries

Why it matters:

- reduces blast radius for shell, browser, and file mutations
- makes policy enforcement more trustworthy

Current status:

- permission, audit, idempotency, compensation, and allowlist controls already exist
- stronger per-run sandboxing is still a roadmap item

Landing plan:

1. define sandbox runner contracts
2. move high-risk execution into sandboxed adapters
3. add resource quotas and lifecycle isolation

### 2.5 Optional Cloud Control Plane

Goal:

- keep the product local-first while enabling shared sessions, memory, and governance

Why it matters:

- improves multi-device recovery
- enables team collaboration without giving up local control

Current status:

- cloud-augmented target architecture is defined
- local-first implementation is ahead of cloud implementation

Landing plan:

1. sync session and audit manifests upward
2. add shared policy and skill distribution
3. add durable long-running orchestration

### 2.6 Future Cloud Orchestrator Framework

Goal:

- introduce a durable orchestration framework at the cloud boundary without coupling the local runtime to that framework

Why it matters:

- preserves framework replaceability
- keeps desktop and local control surfaces stable
- allows future adoption of `Temporal`, `LangGraph`, or both behind one bounded cloud contract

Current status:

- target architecture reserves `Temporal + LangGraph` for the cloud orchestrator layer
- current repository code has not integrated `LangGraph`
- no claim should be made that the current runtime is already running on `LangGraph 2.x`

Landing plan:

1. define the cloud orchestrator boundary first
2. keep local runtime contracts framework-neutral
3. introduce `LangGraph` only behind that boundary after cloud orchestration is actually implemented

## 3. Current Phase Focus

The current implementation phase should prioritize:

1. context compaction and memory promotion
2. reuse-improvement feedback into learned assets
3. runtime contract cleanup for later session / harness / sandbox separation
4. subagent and agent-team contracts before true delegated runtimes

## 4. Acceptance Signals

These improvements are considered successfully landed when:

- repeated task families need less re-planning over time
- high-risk execution paths are more isolated than normal reads
- learning outputs stay compact and interpretable
- agent delegation becomes explicit and resumable
- cloud augmentation remains optional rather than mandatory
