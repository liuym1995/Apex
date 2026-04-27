# Reuse, Learning, and Fast-Path Planning

This document explains how the local-first Apex runtime learns from completed work, turns that experience into reusable assets, and reuses those assets to make similar future tasks faster without weakening safety or verification.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`../README.md`](../README.md)

## 1. Purpose

The platform should not solve every similar task from scratch.

Instead, the intended operating model is:

1. a hard task is completed once
2. the successful path is distilled into compact reusable knowledge
3. future similar tasks discover and reuse that knowledge
4. planning becomes faster
5. verification remains mandatory

This design gives the app an "experienced operator" behavior while staying inspectable and controlled.

Best-practice upgrade:

- keep long-lived knowledge compact
- keep it human-readable when possible
- keep promotion governed by evals and rollback paths

## 2. Reusable Asset Types

The runtime promotes successful task experience into three different reusable layers.

### 2.1 Methodology Memory

Stored as compact `methodology` memory entries.

Purpose:

- retain the condensed summary of how a task family was solved
- record which capabilities were reused
- support later inspection and future ranking

These are not full transcripts.
They are compressed knowledge entries.

The best-practice target is closer to an internalized memory model:

- compact
- merge-oriented
- bounded
- optimized for later action rather than archival completeness

### 2.2 Learned Skills / Playbooks

Stored as approved `SkillCandidate` records after a task passes the full completion gates.

Purpose:

- provide reusable method guidance
- participate in capability discovery
- help future tasks avoid rediscovering the same working method

Each learned skill includes:

- fingerprint
- version
- source task count
- applicability rules
- failure boundaries
- bounded evidence list

### 2.3 Task Templates

Stored as compact `TaskTemplate` records.

Purpose:

- accelerate planning
- reuse a proven definition of done
- reuse a baseline execution plan

Task templates are intentionally narrower than full skill logic.
They are planning assets, not full execution histories.

### 2.4 Compiled Knowledge Wiki

Some knowledge should remain durable as a human-readable corpus.

Examples:

- domain notes
- SOPs
- troubleshooting playbooks
- decision records
- tool usage guides

Best practice:

- store this layer as markdown or similarly inspectable structured docs
- index it for retrieval
- let learned assets point into it
- do not collapse it into opaque vector-only memory

### 2.5 Hierarchical Memory Registry and Retrieval

The stronger best-practice target is not "vector database only".

It is:

- directories and documents as the durable memory structure
- typed metadata and exact addressing when the target is already clear
- bounded vector search as a discovery and ranking layer
- reranking plus recursive deep retrieval once a useful directory or document region has been found

The intended durable memory stack is:

1. `directory registry`
2. `document registry`
3. `approved playbooks and templates`
4. `methodology memory`
5. `bounded semantic index`

Each durable memory document should carry metadata such as:

- directory key
- document key
- task family
- department
- owners
- freshness window
- source evidence ids
- promotion status

This keeps memory inspectable and lets the runtime jump directly to the right place when the target is explicit.

## 3. Learning Flow

The runtime follows this path for successful tasks:

```mermaid
flowchart LR
  A["Task completes"] --> B["Checklist / Reconciliation / Verifier / Done Gate pass"]
  B --> C["Capture methodology memory"]
  C --> D["Create or update learned skill"]
  D --> E["Create or update task template"]
  E --> F["Future similar task searches these assets first"]
```

More concretely:

1. the task finishes execution
2. the verification stack passes
3. methodology memory is captured
4. a learned skill candidate is created or merged
5. if the task is fully accepted, the learned skill is promoted to approved
6. a task template is created or updated
7. later tasks can reuse both the learned playbook and the task template

The stronger final path should also include:

8. replay eval or canary validation for sensitive promotions
9. rollback when a promoted method regresses

Governance-originated `ops` tasks should not be treated as a separate learning island.

- If a governance alert or policy follow-up executes through a stable `execution_template_key`, that key should participate in fingerprinting and applicability.
- Governance-originated `ops` tasks should feed the same learned task-template path as normal work. After one successful governance follow-up is completed, the next similar follow-up should prefill from the learned template and carry `reused_task_template_id` metadata so the reuse decision stays visible and auditable.
- This allows recurring governance work such as desktop handoff investigation or security-review queue clearing to converge on reusable templates instead of producing near-duplicate one-off assets.
- Reuse-governance tasks should also carry a structured `reuseImprovement` context so the operator can see which execution template or learned playbook is being refined, instead of treating reuse-loop investigation as a generic ops stub.
- When a reuse-governance task completes successfully, its feedback should also attach compact `improvement_hints` back onto the target task template or learned playbook so future operators can see what needs refinement without reopening the whole governance trail.

## 4. Fingerprints and Merge Strategy

To avoid storage explosion, the system does not keep an unlimited number of near-duplicate records.

Instead, similar successful tasks are merged by a task-family fingerprint.

The fingerprint is derived from:

- department
- task type
- normalized intent tokens

Examples of what is merged:

- methodology memory
- approved learned skills
- task templates

What changes on merge:

- `source_task_count` increases
- `version` increases for learned skills and templates
- summaries are refreshed
- evidence remains bounded

This means the knowledge base grows by task families, not by every single near-identical run.

## 4A. Context Compaction and Memory Promotion

The runtime should prefer compact promoted memory over raw session sprawl.

Current implementation direction:

- session memory is compacted into a bounded summary at task completion
- methodology memory is sanitized and merged by fingerprint
- reuse-improvement tasks produce a separate compact methodology entry tied to the target asset
- only post-verification tasks should promote reusable summaries into long-lived memory and templates

This keeps the system fast while still making successful work reusable.

Periodic consolidation of skills, scripts, and methodology is allowed only when it is:

- opt-in
- budget-capped
- reviewable
- compact

## 5. Fast-Path Planning

When a new task enters planning, the runtime follows this order:

1. infer task family
2. search learned playbooks
3. search task templates
4. if a strong template is found:
   - reuse the definition of done
   - reuse the baseline execution plan
5. run capability discovery
6. only generate a fresh plan when no strong reusable template exists

This preserves the most important distinction:

- planning becomes faster
- validation does not become weaker

The runtime still performs:

- permission checks
- capability resolution
- execution logging
- checklist
- reconciliation
- verifier review
- done gate

## 6. Similarity and Ranking

The current implementation uses a lightweight local similarity layer rather than a heavy always-on vector system.

### 6.1 Ranking Inputs

Ranking combines:

- normalized intent token overlap
- department alignment
- task-type alignment
- fingerprint exact match when available
- applicability rule fit
- support count from prior successful tasks
- version
- recent successful reuse

### 6.2 Why This Is the Default

This approach is preferred early because it is:

- fast
- local-first
- offline-friendly
- explainable
- small in operational complexity

Heavier semantic retrieval can be added later, but should augment this layer rather than replace it for repeated operational task families.

### 6.3 Best-Practice Retrieval Strategy

The target architecture should use a hierarchical hybrid retrieval path:

1. if the user, planner, or prior template already identifies a directory, document, task family, or asset id:
   - go directly to that directory or document
   - use metadata filters and exact addressing first
   - retrieve only the relevant sections inside it
2. if the target is not explicit:
   - run hybrid candidate retrieval across the bounded semantic index and lexical metadata index
   - retrieve candidate directories, candidate documents, and candidate reusable assets
   - rerank candidates before deeper expansion
3. once a candidate directory or document is selected:
   - expand to parent summary, sibling summaries, and fine-grained sections
   - retrieve only the minimum evidence set needed for the task
4. always surface why the memory item was selected:
   - direct address
   - metadata filter
   - lexical hit
   - semantic hit
   - rerank promotion

This means the runtime should not do "vector search over everything" as the default.
It should do:

- direct routing when explicit
- filtered hybrid retrieval when semi-explicit
- semantic candidate generation when ambiguous
- recursive deep retrieval when a useful memory region has been found

### 6.4 Detailed Landing Steps

1. create a `MemoryDirectory` registry for:
   - departments
   - systems
   - projects
   - task families
   - operational domains
2. create a `MemoryDocument` registry under each directory for:
   - SOPs
   - troubleshooting notes
   - decision records
   - learned playbook references
   - methodology summaries
3. index every document at multiple levels:
   - directory summary
   - document summary
   - section or chunk
4. store path and lineage metadata on every indexed section:
   - directory id
   - document id
   - parent section id
   - source artifact id
   - freshness
5. implement retrieval in four stages:
   - direct address and metadata filtering
   - hybrid candidate retrieval
   - reranking
   - recursive deep retrieval
6. require retrieval to return not just chunks but also their container path:
   - which directory
   - which document
   - which section
7. cache winning routes by task family so repeated tasks can skip broad search and jump to the right directory family faster
8. compact memory periodically by:
   - merging duplicate summaries
   - retiring stale low-signal chunks
   - keeping the directory and document graph small and inspectable
9. expose a workspace trace that shows:
   - which retrieval stage was used
   - whether the result came from direct addressing or semantic discovery
   - which directory or document was expanded

For fixed workflows, reuse should prefer deterministic infrastructure:

- CLI
- scripts
- tools
- skills that wrap them

The LLM should not be used as the default executor once the workflow is well understood.

## 7. Applicability Rules and Failure Boundaries

Every approved learned skill and every task template should say not only where it works, but also where it should not be blindly reused.

### 7.1 Applicability

Applicability contains:

- `required_tags`
- `preferred_tags`
- `excluded_tags`

This helps the runtime decide whether a reused method is likely to fit the current task.

### 7.2 Failure Boundaries

Failure boundaries record constraints and caveats such as:

- local implementation fallback is still required for certain needs
- do not auto-reuse in critical-risk workflows
- validate scheduling assumptions before using in recurring or scheduled contexts

These boundaries are surfaced to the user so reuse stays inspectable.

## 8. Workspace Visibility

The task workspace includes `reuseRecommendations`.

This list shows:

- learned playbooks that matched
- task templates that matched
- execution template metadata for the current task
- `reused_task_template_id` and version when fast-path reuse was actually applied
- compact reused task-template details and related approved playbooks
- target-level improvement hints when reuse-governance has suggested that a template or playbook should be refined
- agent-team context showing which isolated runtime role handled capability routing, verification, or learning curation
- ranking score
- version
- support count
- applicability rules
- failure boundaries

This matters because the system should not become a black box.

Users, reviewers, and operators need to understand:

- why a reuse path was chosen
- why a reuse path was ranked highly
- when reuse should be overridden

## 9. Storage Control

The storage model intentionally avoids runaway growth.

### 9.1 What Is Bounded

- evidence arrays are capped
- summaries are compact
- templates keep reusable planning cores only
- learned skills do not store full raw transcripts
- methodology memory merges by fingerprint

### 9.2 What Is Not Stored Repeatedly

The system avoids duplicating:

- long near-identical plans
- full historical transcripts for every similar run
- unbounded artifact content in learned assets

### 9.3 Why This Matters

Without this control, a self-evolving system becomes:

- slower
- harder to rank correctly
- more expensive to store
- more confusing to inspect

The current design keeps knowledge dense and operationally useful.

## 10. Verification Is Still Mandatory

Learning and reuse do not bypass the verification stack.

A reused method is still subject to:

- checklist
- verifier
- reconciliation
- done gate

This is a hard rule.

The system may get faster through reuse, but it must not become less trustworthy through reuse.

## 11. APIs and Runtime Surfaces

The current implementation exposes reuse in these places:

- runtime capability discovery
- learned playbook search
- task template search
- local task workspace aggregation
- desktop task workspace UI

The task workspace is therefore the main user-facing inspection surface for reuse decisions.

## 12. Recommended Next Steps

The next best improvements on top of the current baseline are:

1. add user feedback actions such as:
   - accept recommended playbook
   - reject recommended playbook
   - prefer a different template
2. feed that feedback back into ranking
3. add optional replay-eval before promoting sensitive learned methods
4. add hierarchical hybrid retrieval:
   - direct directory and document addressing first
   - bounded semantic candidate retrieval second
   - rerank plus recursive deep retrieval third
5. add a compiled knowledge wiki so learned assets can point to stable human-readable references

## 13. Hybrid Memory and In-Place TTT Integration

The reuse and learning system now integrates with the Hybrid Memory + In-Place TTT architecture defined in `glm-5.1-hybrid-memory-ttt-spec.md`.

Key integration points:

- MemoryMode contract: tasks can now be routed to `durable_retrieval` (default), `hybrid_retrieval_ttt`, or `ttt_first_specialist` modes
- Model-as-recommender: the LLM recommends a memory mode per task, but the runtime validates eligibility before allowing TTT
- TTT Eligibility Gate: vendor-hosted routes, privileged planner paths, and tasks without completion criteria are automatically denied or downgraded
- TTT Adaptation Run: baseline-first execution with delta analysis and automatic rollback on regression
- Distillation: successful TTT adaptations are distilled back into routing rules, prompts, playbooks, methodology memory, task templates, and eval insights
- Budget accounting: all TTT runs consume from a bounded budget ledger with audit trail

This integration preserves the core principle: `durable retrieval remains the primary truth source, while In-Place TTT becomes a gated specialist path chosen per task only when the task and model route qualify.`

## 14. Summary

The reuse and learning system is designed to do three things at once:

- make repeated work faster
- keep knowledge compact
- keep reuse explainable and governed

For memory retrieval specifically, the best-practice target is:

- directories and documents as the durable memory structure
- metadata and exact addressing first when the target is clear
- bounded hybrid semantic retrieval when the target is unclear
- rerank plus recursive deep retrieval once a useful directory or document region is found

In one sentence:

`Apex learns compactly, reuses selectively, ranks locally, and still verifies everything before completion.`
