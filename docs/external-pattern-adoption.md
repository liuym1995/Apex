# External Pattern Adoption Guide

This document turns "worth learning from" into an implementation guide.

It answers:

`Which ideas from strong external systems should Apex adopt, where should they land in the architecture, and in what order should they be implemented?`

This document is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)

## 1. How to Use This Document

For each external source, this guide defines:

- what is worth learning
- what should not be copied blindly
- where the idea belongs in Apex
- a detailed landing sequence

The goal is not imitation.
The goal is selective integration into a stronger local-first, verification-first, privacy-first system.

## 2. Hermes

### 2.1 What Is Worth Learning

- compact internalized memory instead of large raw memory blobs
- per-agent isolation so one failing worker does not damage unrelated work
- active skill-management behavior so the system can improve methods with less manual prompting
- interrupt-and-correct interaction during execution

### 2.2 What Not to Copy Blindly

- do not let lightweight skill evolution bypass governance
- do not let memory become opaque or model-only
- do not let agent autonomy override platform policy or verification

### 2.3 Where It Lands

- `learning factory`
- `worker runtime`
- `sandbox manager`
- `task workspace interaction model`
- `compiled knowledge wiki`

### 2.4 Detailed Landing Steps

#### Hermes Memory Landing

1. define a compact `internalized_memory` asset type distinct from transcripts
2. add merge keys:
   - task family
   - department
   - tool family
   - failure boundary
3. cap each internalized memory entry by:
   - token budget
   - evidence count
   - source-task count window
4. add refresh rules:
   - merge when same fingerprint
   - summarize deltas instead of appending raw notes
   - preserve only high-signal evidence references
5. expose memory compaction in the workspace so operators can see:
   - what was promoted
   - what was discarded
   - what was merged

#### Hermes Agent Isolation Landing

1. require every worker session to run behind:
   - a session id
   - a sandbox tier
   - a resource budget
   - a lease owner
2. isolate failures by ensuring:
   - retries are per session
   - watchdog alerts are per session
   - one worker lease cannot poison another worker context
3. persist failure summaries as reusable diagnostics rather than letting them disappear into logs

#### Hermes Skill Manager Landing

1. add a `skill-improvement backlog` inside the learning factory
2. populate it from:
   - repeated verifier misses
   - repeated user corrections
   - repeated fallback-to-local events
   - repeated reuse-navigation reopen events
3. add actions:
   - suggest update to skill
   - suggest update to template
   - suggest new script
   - suggest new CLI wrapper
4. require replay-eval before promotion

#### Hermes Interaction Landing

1. add `interrupt`, `correct`, and `redirect` as first-class task commands
2. attach corrections to the current `TaskAttempt` instead of creating hidden side channels
3. allow correction to:
   - revise plan
   - revise capability choice
   - revise completion criteria
4. require the system to continue from the newest accepted correction

## 3. Claude Code and Codex

### 3.1 What Is Worth Learning

- tool-first local execution
- strong permission mediation
- bounded agent contexts
- harness-driven execution and verification loops
- iterative reviewer loops before completion

### 3.2 What Not to Copy Blindly

- do not let UI or tool wiring define the platform architecture
- do not expose every internal runtime layer as product API
- do not rely on a chat transcript as the only operational truth

### 3.3 Where It Lands

- `native local core`
- `tool gateway`
- `completion engine`
- `agent runtime`
- `workspace UI`

### 3.4 Detailed Landing Steps

#### Tool-First Runtime Landing

1. classify every task step as:
   - deterministic CLI
   - deterministic script
   - existing tool
   - skill-guided tool chain
   - model reasoning
2. default to the most deterministic valid class
3. record the chosen class in `ExecutionStep`
4. surface the chosen class in the workspace

#### Permission Mediation Landing

1. move permission decisions to a central PDP/PEP model
2. require every mutation-capable execution step to carry:
   - requested capability
   - scope
   - sandbox tier
   - approval state
3. block execution when approval state is unresolved
4. record allow or deny decisions as evidence nodes

#### Ralph-Loop Landing

1. introduce `reviewer_expectation` and `reviewer_feedback` records
2. allow verifier or human review to return:
   - accepted
   - accepted_with_notes
   - revise_and_retry
   - blocked
3. when the result is `revise_and_retry`, create a new `TaskAttempt`
4. require the runtime to keep iterating until:
   - accepted
   - blocked
   - stopped by user
5. store each review loop as part of the evidence graph

#### Harness Landing

1. wrap risky tool use in harnesses with:
   - fixed inputs
   - expected outputs
   - timeout
   - rollback or compensation path
2. require test or validation harnesses for:
   - code changes
   - connector mutations
   - browser automation flows
3. treat harness results as first-class completion evidence

### 3.5 What the Leaked-Source Critique Still Reveals About Apex

The leaked-source critique should not be copied as-is, but it is useful as a pressure test.

Current areas where Apex still shares part of the risk:

- hard sandboxing is still only partial in the current repository
- heavier semantic and hybrid memory retrieval is still not in the main runtime path
- the delegated runtime is still represented through too many lifecycle concepts in the current implementation
- verification exists, but the verifier is not yet a separately hardened subsystem
- deep code intelligence is not yet elevated to a dedicated `code intelligence plane`
- broad desktop and multimodal execution is still intentionally constrained
- observability is present, but not yet the full trace-first operator surface that a long-running autonomous system should have

Current areas where Apex already avoids the main Claude Code failure shape:

- the architecture is already documented as modular packages and services instead of one giant query-engine file
- the target product is a desktop app with a native-core direction, not a terminal-only React/Ink stack
- the platform rulebook is already vendor-neutral rather than model-vendor-locked
- the architecture already prefers typed contracts, governance, and completion evidence instead of transcript-only state

The correct response is therefore:

- do not cargo-cult the critique
- do absorb the parts that tighten modularity, isolation, code intelligence, and observability
- do land them through explicit modules and staged rollout

### 3.6 Additional Areas Worth Learning from the Critique

- stricter microkernel boundaries around the task runtime
- stronger untrusted-worker isolation than worktree-only separation
- hybrid memory that combines compact summaries, semantic retrieval, and typed evidence
- code-native understanding through LSP, AST, and structural edits
- multimodal verification for screenshots, UI states, and visual artifacts
- semantic cache and prompt-reuse layers with strict validation boundaries
- trace-first observability for every planning, tool, and verification step

### 3.7 Detailed Landing Steps from the Critique

#### Microkernel Runtime Landing

1. split the runtime into these hard modules:
   - `task runtime kernel`
   - `stream coordinator`
   - `capability resolver`
   - `tool loop`
   - `memory retrieval`
   - `token and cost accounting`
   - `error policy`
   - `verification coordinator`
2. make the kernel responsible only for:
   - state transitions
   - attempt creation
   - execution-step dispatch
   - checkpoint emission
3. prohibit direct cross-module state mutation:
   - modules talk through typed commands, queries, and events
   - modules cannot reach into another module's persistence tables
4. add architecture guards:
   - dependency rules in CI
   - maximum file and function complexity thresholds
   - required design record for any new privileged runtime module
5. reduce the public runtime API to:
   - `TaskRun`
   - `TaskAttempt`
   - `WorkerSession`
   - `SandboxLease`
   - `ExecutionStep`
   - `VerificationRun`
6. keep launcher, adapter, process, and driver details private to diagnostics and traces

#### Strong Sandbox and Worker Isolation Landing

1. classify every execution step into:
   - `host_readonly`
   - `guarded_mutation`
   - `isolated_mutation`
2. route these categories directly to `isolated_mutation` by policy:
   - shell mutation
   - browser mutation
   - desktop automation
   - untrusted skill execution
   - third-party script execution
3. create a signed `sandbox manifest` per `WorkerSession` containing:
   - allowed filesystem mounts
   - capability tokens
   - network egress rules
   - CPU, memory, and wall-clock quotas
   - rollback or compensation hints
4. make subagents fail independently:
   - one worker crash does not poison sibling sessions
   - retries are scoped to a session lease
   - watchdogs kill only the affected worker
5. persist sandbox outcomes as evidence:
   - manifest used
   - commands executed
   - files touched
   - rollback status
6. add a user-visible emergency stop that cancels the lease and preserves resumable state

#### Hybrid Memory Landing

1. keep four memory classes instead of one monolithic memory blob:
   - `working context`
   - `internalized memory`
   - `compiled knowledge wiki`
   - `bounded semantic index`
2. add `MemoryDirectory` and `MemoryDocument` registries as the durable structure above the semantic index
3. define the memory retrieval order:
   - exact structured references
   - direct directory or document addressing
   - approved playbooks and templates
   - metadata-filtered hybrid retrieval
   - semantic retrieval
   - wiki summaries
   - transcript fallback
4. attach every promoted memory item to:
   - source evidence
   - task family
   - owner
   - freshness window
   - promotion status
5. require memory compaction rules:
   - merge by fingerprint
   - summarize deltas
   - deduplicate near-identical items
   - expire low-signal entries
6. use the semantic index as an augmentation layer only:
   - not as the system of record
   - not as an opaque replacement for human-readable knowledge
7. once a directory or document candidate is found, expand recursively into parent summary and relevant sections rather than stuffing every chunk into the prompt
8. expose memory hit reasons in the workspace so operators can see why a method was recalled

#### Code Intelligence Plane Landing

1. create a dedicated `code intelligence plane` behind an SPI with adapters for:
   - LSP
   - AST parsers
   - repository symbol indexers
   - test and build diagnostics
2. require code tasks to query this plane before mutation for:
   - symbol definition
   - references
   - type information
   - diagnostics
   - affected-file graph
3. prefer structural edits over full-text rewrite:
   - AST patch
   - symbol-level rename
   - range-scoped patch
   - exact diff application
4. record code-intelligence evidence into the run graph:
   - why the file was selected
   - which symbols were changed
   - which tests or diagnostics justified the change
5. add replay harnesses for code edits:
   - build
   - test
   - lint
   - targeted regression harness
6. treat `grep`-style keyword search as a cheap first pass, not the final source of truth for code mutation

#### Multimodal Verification Landing

1. add a `visual evidence` asset class for:
   - screenshots
   - design references
   - terminal snapshots
   - scanned documents
2. use deterministic parsing first where possible:
   - OCR
   - DOM extraction
   - accessibility tree
   - structured document parsing
3. invoke a VLM only when deterministic extraction is insufficient or ambiguous
4. bind visual checks to concrete task outcomes:
   - UI matches design intent
   - browser flow reached expected screen
   - error screenshot aligns with fix
5. store redacted thumbnails or hashes where raw images are too sensitive
6. make visual evidence another producer for the completion engine, not a sidecar note

#### Semantic Cache and Reuse Landing

1. add cache classes with separate policy:
   - exact request cache
   - semantic suggestion cache
   - harness result cache
   - plan skeleton cache
2. allow automatic reuse only for:
   - read-only synthesis
   - retrieval ranking hints
   - previously verified deterministic plans
3. require revalidation before reuse for:
   - mutating actions
   - external side effects
   - policy-sensitive routes
4. attach cache entries to:
   - model family
   - tool family
   - policy version
   - repository or workspace fingerprint
5. expire or demote entries when:
   - verifier misses increase
   - rollback events rise
   - upstream tools change materially

#### Trace-First Observability Landing

1. make `TaskRun` the root trace and attach child spans for:
   - planning
   - capability resolution
   - tool execution
   - sandbox lease
   - verification
   - learning promotion
2. require each evidence node to carry:
   - trace id
   - step id
   - capability id
   - policy decision id
3. build a local operator view that can answer:
   - what is the system doing now
   - why did it choose this path
   - what blocked completion
   - what can be resumed safely
4. add replay packages for incidents:
   - inputs
   - selected tools
   - evidence graph
   - verifier result
   - final outcome
5. keep observability self-hosted by default and consistent with the no-silent-egress rule

### 3.8 Recommended Landing Sequence for These Critique-Driven Upgrades

1. first, simplify runtime boundaries and publish the microkernel module contracts
2. second, move mutation-capable worker execution behind sandbox manifests and isolated leases
3. third, add the code intelligence plane so code modification stops depending on mostly text-level search
4. fourth, add hybrid memory and semantic cache with strict promotion and revalidation rules
5. fifth, add trace-first operator views and replay packages
6. sixth, add multimodal verification only after deterministic and code-native checks are already strong

## 4. AutoResearch

### 4.1 What Is Worth Learning

- bounded experimentation
- explicit experiment configuration
- artifact-first comparison
- reproducible loops over candidate approaches

### 4.2 What Not to Copy Blindly

- do not let open-ended exploration consume production budgets indefinitely
- do not let research loops run inside privileged mutation paths without sandboxing

### 4.3 Where It Lands

- `learning factory`
- `eval plane`
- `automation service`

### 4.4 Detailed Landing Steps

1. define an `ExperimentRun` entity with:
   - objective
   - hypothesis
   - budget
   - candidate methods
   - success metric
2. require every experiment to produce:
   - config artifact
   - result artifact
   - comparison summary
3. add experiment budgets:
   - max attempts
   - max tokens
   - max wall-clock time
4. allow the learning factory to use experiment runs for:
   - playbook promotion
   - prompt comparison
   - capability-routing comparison
5. require experiment outcomes before promoting sensitive new methods

## 5. Karpathy LLM Wiki

### 5.1 What Is Worth Learning

- human-readable knowledge as markdown
- git-friendly knowledge maintenance
- link structure and summary maintenance

### 5.2 What Not to Copy Blindly

- do not treat wiki pages as the only memory layer
- do not let freeform notes replace typed operational assets

### 5.3 Where It Lands

- `compiled knowledge wiki`
- `reuse and learning`
- `team memory`

### 5.4 Detailed Landing Steps

1. create a `knowledge wiki` directory or registry with typed metadata per page
2. define allowed page classes:
   - SOP
   - troubleshooting note
   - system decision record
   - connector guide
   - department brief
3. add page metadata:
   - owners
   - tags
   - freshness date
   - linked skills
   - linked templates
4. add a wiki compiler that builds:
   - backlinks
   - summaries
   - section index
   - retrieval index
5. let learned assets point to wiki pages instead of duplicating all knowledge inline

## 6. In-Place Test-Time Training

### 6.1 What Is Worth Learning

- adaptive optimization for self-hosted models on long-context or specialist tasks
- treating adaptation as a bounded runtime experiment rather than a permanent model mutation

### 6.2 What Not to Copy Blindly

- do not apply test-time weight updates in the main privileged planner path
- do not let adaptation become silent production behavior
- do not use it on vendor-hosted APIs where weights are not actually under system control

### 6.3 Where It Lands

- `research sandbox`
- `self-hosted model routes`
- `eval plane`

### 6.4 Detailed Landing Steps ✅ IMPLEMENTED

1. create a separate `adaptive-model research lane` ✅ — `hybrid-memory-ttt.ts` implements the full TTT research lane
2. limit eligibility to:
   - self-hosted open-weight models ✅ — `isVendorHostedModel()` excludes vendor-hosted routes
   - long-context specialist tasks ✅ — `TTT_ELIGIBLE_TASK_FAMILIES` registry with 7 initial families
   - isolated replay workloads ✅ — replay/eval eligibility check in gate
3. define experiment controls:
   - adaptation budget ✅ — `TTTBudgetLedgerSchema` with global budget tracking
   - rollback to base model ✅ — `rollbackTTTAdaptation()` with rollback-ready artifacts
   - baseline comparison ✅ — `executeTTTAdaptationRun()` always runs baseline first
   - failure threshold ✅ — automatic rollback on "regressed" verdict
4. require three outputs:
   - adapted-run result ✅ — `adapted_result` in `TTTAdaptationRun`
   - baseline result ✅ — `baseline_result` in `TTTAdaptationRun`
   - delta analysis ✅ — `delta_analysis` with improvement_score, quality_delta, latency_delta, token_cost_delta, verdict
5. if adaptation helps, distill value into:
   - routing rules ✅ — distillation target "routing_rules"
   - prompts ✅ — distillation target "prompts"
   - playbooks ✅ — distillation target "playbooks"
   - specialist model selection policy ✅ — distillation target "methodology_memory"
6. do not mutate the default planner route until repeated evals show stable gains ✅ — durable_retrieval remains the default mode; TTT is only available through explicit eligibility gating

## 7. EvoMap and Self-Evolving Agents

### 7.1 What Is Worth Learning

- explicit self-improvement loops
- evaluation-backed method evolution
- visible lineage of evolving strategies

### 7.2 What Not to Copy Blindly

- do not let self-evolution bypass rollback
- do not promote based on novelty alone
- do not let self-improvement write directly into production policy

### 7.3 Where It Lands

- `learning factory`
- `policy review`
- `asset lineage tracking`

### 7.4 Detailed Landing Steps

1. add `method lineage` metadata to skills and templates
2. record:
   - parent version
   - mutation reason
   - eval outcome
   - failure boundaries
3. support canary promotion before general promotion
4. auto-create rollback candidates for each promoted version
5. prefer incremental mutation of strong methods over unconstrained invention

## 8. AI Scientist

### 8.1 What Is Worth Learning

- explicit generate-evaluate-compare loops
- report-first outputs
- bounded experimental autonomy

### 8.2 What Not to Copy Blindly

- do not let autonomous experimentation run without budgets
- do not confuse research creativity with enterprise execution reliability

### 8.3 Where It Lands

- `eval plane`
- `learning factory`
- `automation service`

### 8.4 Detailed Landing Steps

1. add a `candidate generation` stage inside the learning factory
2. generate multiple candidate methods only when:
   - reuse confidence is low
   - the task family is strategic enough to justify experimentation
3. compare candidates using:
   - completion quality
   - verification pass rate
   - latency
   - token cost
   - operational risk
4. produce a comparison report artifact
5. promote only the best candidate that passes policy review

## 9. Integrated Rollout Order

These ideas should not land randomly.

Recommended order:

### Phase 1. Foundations

1. publish the architecture constitution
2. implement deterministic-first resolver rules
3. implement no-silent-egress policy
4. define compact internalized memory assets
5. publish microkernel module contracts for the task runtime

### Phase 2. Runtime and Control

1. implement worker isolation and sandbox leases
2. implement interrupt-and-correct commands
3. implement reviewer loop and harness evidence
4. expose task autonomy status in the workspace
5. simplify public runtime concepts to the stable run/attempt/session/step surface

### Phase 3. Knowledge and Learning

1. build compiled knowledge wiki
2. link skills and templates to wiki pages
3. build skill-improvement backlog
4. add lineage and replay-eval metadata
5. add hybrid memory retrieval and semantic cache with revalidation

### Phase 4. Experimentation and Evolution

1. add experiment runs
2. add candidate comparison reports
3. add canary promotion
4. add rollback-on-regression
5. add the code intelligence plane and code replay harnesses

### Phase 5. Advanced Research Track

1. add adaptive self-hosted model research lane
2. evaluate `In-Place TTT`-style adaptation in sandboxes
3. distill gains into prompts, routing, and playbooks
4. add multimodal verification once deterministic and structural checks are mature
5. add full trace-first operator replay packages

## 10. Final Rule

In one sentence:

`Apex should absorb compact memory, tool-first execution, bounded experimentation, human-readable knowledge, reviewer loops, and governed self-improvement from the best external systems, but only through explicit modules, replayable evals, and privacy-preserving control boundaries.`
