# Desktop Workspace UI

This document explains the intended user experience and information architecture of the desktop task workspace.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`../README.md`](../README.md)

## 1. Purpose

The desktop app should not behave like a plain chat window.

The task workspace is the primary surface where a user should be able to understand:

- what the task is
- what the system plans to do
- what it has already done
- what it is reusing
- what still blocks completion
- whether it is safe to trust the result

## 2. Design Goal

The workspace should make the system feel:

- transparent
- interruptible
- inspectable
- controllable
- auditable

Users should not have to guess what the runtime is doing.

## 3. Primary Workspace Sections

The recommended task workspace includes these sections.

### 3.1 Task Header

Should show:

- task intent
- department
- task type
- risk level
- status

This is the primary identity block for the task.

### 3.2 Definition of Done

Should show:

- goal
- completion criteria
- required artifacts
- any approval requirement

This section answers:

- what does "done" mean here

### 3.3 Execution Plan

Should show:

- ordered steps
- current step status
- step owners when available

This section answers:

- what is the runtime doing next

### 3.4 Capability Strategy

Should show:

- each inferred capability need
- strategy used:
  - `reuse_existing`
  - `compose_existing`
  - `implement_local`
- reasoning
- selected capabilities

This section answers:

- why did the runtime choose this method

### 3.5 Reuse Recommendations

Should show:

- matched learned playbooks
- matched task templates
- current execution template key
- reused task template id and version when fast-path planning reused a learned template
- compact reused task-template details, including applicability and failure boundaries
- compact improvement hints for the reused task template when reuse-governance has suggested refinements
- related learned playbooks that share the same learned fingerprint
- a lightweight detail panel for the currently selected related playbook
- compact improvement hints for the selected learned playbook when reuse-governance has suggested refinements
- canonical deep links for execution template and related playbook details
- a dedicated `Reuse Improvement` card for reuse-governance tasks, including the affected reusable asset, suggested learning action, target improvement hints, and a direct jump back to that asset
- a `Runtime Boundaries` card that makes the current `session / harness / sandbox` state visible, including compaction strategy, planning mode, guarded scopes, and current isolation tier
- an `Agent Team` card that makes delegated runtime structure visible, including team mode, isolated context count, subagent sessions, and compact supervisor/worker message summaries
- resume support visibility for the team and each delegated session, so future delegated resume can be audited before it is fully automated
- delegated checkpoint visibility, so operators can see the latest capability-routing, execution, verification, and learning-curation milestones per team
- delegated handoff visibility and a merged team timeline, so operators can inspect how the supervisor routed work from capability resolution into execution, verification, and learning
- delegated resume package visibility, so operators can see which handoff package was prepared, applied, or superseded before a delegated runtime continues the work
- delegated runtime binding visibility, so the workspace shows which runtime kind and sandbox profile a resumed execution is currently using
- delegated runtime instance visibility, including heartbeat and final state, so future independent worker processes or sandbox pools can plug into a stable operational contract
- delegated resume request visibility and per-session resume actions, so operators can ask for an isolated worker to resume from its latest delegated checkpoint, then accept, reject, or mark that delegated handoff as handled without leaving the workspace
- delegated resume package visibility, so operators can inspect the handoff package, the checkpoint it points at, the compact execution-state summary, and whether that package has already been applied by a delegated runtime handoff
- delegated execution run visibility, so operators can see whether an applied handoff package actually started a delegated runtime and whether that resumed execution completed or failed
- delegated runtime binding visibility, so operators can see which running delegated execution has been bound to which runtime kind and sandbox profile, and when that binding was released
- canonical skills currently registered for use
- ranking score
- version
- support count
- applicability rules
- failure boundaries

This section answers:

- what prior successful methods are relevant here
- why the runtime thinks they fit
- whether this task is already executing through a stable template or through a reused learned template

Best-practice boundary:

- the workspace should present delegated-runtime state through the stable public model:
  - `TaskRun`
  - `TaskAttempt`
  - `WorkerSession`
  - `SandboxLease`
  - `ExecutionStep`
  - `VerificationRun`
- launcher, driver, adapter, receipt, backend-execution, runner, and job detail may still appear in diagnostic panels while the current implementation is transitional
- those plumbing details should stay secondary to operator intent, evidence, safety state, and recovery actions

The canonical skill surface should also support lightweight filtering by:

- free-text query
- source ecosystem
- governance status

It should now support bounded skill interchange actions as well:

- inspect canonical skill details
- export a canonical skill into a supported interchange format
- import a skill document through the control plane rather than bypassing registry policy
- approve, disable, or return a canonical skill to review through explicit governance actions
- inspect recent governance audit history
- preview or export a promoted skill bundle for team distribution
- verify and import a promoted bundle through the same bounded control-plane workflow

For promoted bundle operations, the workspace should also let the user specify and inspect:

- publisher id
- publisher name
- source environment
- release channel
- promotion note
- promotion history visible in the exported manifest preview

This keeps skill release and distribution explainable from the same surface where users already review skills.

The same panel should also show a short bundle activity feed so users can inspect recent:

- bundle export events
- bundle promotion events
- bundle import events

without leaving the workspace.

Bundle verification feedback should also surface trust-policy results when available:

- publisher trusted vs untrusted
- release channel allowed vs blocked
- source policy allowed vs blocked
- tag policy allowed vs blocked
- capability policy allowed vs blocked

so a user can immediately see whether a bundle is merely well-formed or actually acceptable under local governance.

The same workspace area should also carry an explicit actor role field so governance and bundle-release actions are explainable under role policy rather than appearing to succeed or fail arbitrarily.

Policy diagnostics should also indicate the source of each effective rule:

- default
- global policy file
- org policy file
- workspace policy file
- local policy file
- environment configuration

so users and operators can understand not just what the rule is, but why it is currently in effect.

The same diagnostics area should also expose policy-environment semantics:

- human-friendly labels for `global / org / workspace / local`
- the current allowed promotion pipeline
- whether that pipeline came from defaults or environment overrides

The diagnostics panel should also show the effective policy-file state itself:

- configured policy path
- whether the file loaded successfully
- validation or parse errors when the file could not be applied

And for scoped policy, it should also show a compact per-scope list:

- global
- org
- workspace
- local

This keeps policy troubleshooting in the same place where governance actions happen.

The same area should also support a lightweight policy dry-run for bundle files:

- choose a bundle path
- choose the actor role
- simulate trusted import eligibility
- inspect which trust/content/role rules would allow or block the action

This gives operators a safe preflight before a real verify or import call.

For teams that actively manage local governance, the same workspace area should also expose a scoped policy editor:

- select the scope (`global`, `org`, `workspace`, `local`)
- inspect the resolved path for that scope
- edit the JSON config for that scope
- save it back through the audited control-plane API

This is intentionally a bounded JSON editor, not an unrestricted filesystem browser.

That editor should also support:

- an effective diff preview before save
- a short policy audit feed after save
- policy bundle preview/export/import
- scoped rollback to a prior policy snapshot
- scope-change proposal creation
- scope-to-scope promotion proposal creation
- proposal queue review, split into `security review`, `manual approval`, and `standard promotion`
- queue-specific role expectations so operators can see that `security review` and `manual approval` can require different approver sets
- queue-level operations signals including pending counts, oldest pending age, SLA breaches, and suggested next action
- queue health diagnostics including health status, escalation requirement, escalation reason, and follow-up action
- a dedicated follow-up feed derived from queue health so operators can act on concrete next steps before opening individual proposals
- one-click follow-up execution that turns queue escalation into a trackable local ops task
- overview inbox actions for acknowledge/resolve so alerts can move through a visible lifecycle instead of accumulating forever
- overview inbox summary cards for open/new/acknowledged/critical counts
- inbox filtering by severity, kind, and state so operators can narrow the feed before acting
- opt-in desktop notifications for warning/critical inbox items with local delivery de-duplication
- hybrid notification delivery:
  - browser notifications when click-through is available
  - native Tauri notifications as a desktop fallback when browser notification APIs are unavailable
- visible delivery-mode diagnostics so operators know whether click-through is active or whether the runtime is using native fallback delivery
- a single deep-link model for `task / inbox / policy_follow_up / policy_proposal / execution_template / learned_playbook`
- a current deep-link preview card so operators can copy the exact workspace target they are looking at
- per-item `Copy Link` actions for inbox alerts, policy follow-ups, and policy proposals
- a desktop navigation event feed so operators can see whether the current focus came from startup, a pending deep-link handoff, a notification click, or a direct workspace action
- the same feed should also include Tauri system-originated events such as startup arguments and single-instance handoff, so desktop entry behavior is auditable instead of inferred
- the feed should support source filtering plus per-event `Copy Link` and `Replay` actions, turning desktop entry history into an operational tool instead of a passive log
- the feed should also support target-kind filtering and grouped counts for `task / inbox / policy / reuse`, so operators can separately inspect template/playbook navigation and ordinary task routing
- when the target kind is `reuse`, the workspace should further distinguish `execution template` vs `learned playbook`, and should raise a lightweight warning when the same reuse target is reopened repeatedly in the same operating window
- repeated `reuse` warnings should be promotable into the normal governance path, but should carry a distinct `reuse_navigation` identity so inbox items, follow-ups, and ops-task templates can distinguish guidance-review work from handoff-routing work
- the feed should also expose retention policy, time-range filtering, and lightweight risk summaries so repeated handoff loops or unexpectedly system-driven entry patterns are visible early
- approve / reject / apply actions for pending proposals
- batch approve / reject / apply for selected proposals
- approval note templates for common review outcomes
- environment release history for applied policy changes
- environment snapshots for each effective scope
- direct `from -> to` environment compare previews before promotion or import
- grouped compare sections for `trust / content / roles / environments`
- risk summaries that explicitly call out trust relaxation, role expansion, or newly unblocked capabilities
- an advisory conclusion such as `safe_to_promote`, `manual_approval_required`, or `requires_security_review`
- a workflow recommendation that can prefill rationale and route the operator into the right proposal path

This keeps policy mutation explainable instead of turning it into a blind JSON overwrite.

The deep-link protocol is intentionally simple and hash-based for now:

- `#kind=task&taskId=...`
- `#kind=inbox&inboxId=...`
- `#kind=policy_follow_up&followUpId=...`
- `#kind=policy_proposal&proposalId=...`
- `#kind=execution_template&taskId=...&templateId=...`
- `#kind=learned_playbook&taskId=...&playbookId=...`

The same protocol is used by:

- in-workspace `Focus` actions
- copied workspace links
- priority inbox notification click handling
- future native desktop notification callbacks
- Tauri startup arguments such as `--deep-link="#kind=task&taskId=..."` or `apex://open#kind=inbox&inboxId=...`

The control plane should also be able to emit the same target hashes, so backend-generated inbox items, follow-ups, and policy proposals can carry their own canonical navigation target.

Inside the desktop shell runtime, the same protocol should also support a pending handoff path:

- startup-time initial target
- runtime queued target for a shell that is already open
- single-instance relaunch forwarding into the active shell window

This keeps future native notification callbacks and single-instance relaunch behavior on the same navigation contract.

The proposal flow should preserve role separation:

- policy editors propose
- policy approvers approve or reject
- policy promoters apply approved changes to the target scope

The same policy center should also expose environment snapshots as first-class operational views. Users should be able to:

- inspect the current label and trust posture of each scope
- compare any two scopes side-by-side through a structured preview
- use that preview before promotion proposals, bundle import, or rollback decisions
- read grouped diffs by governance concern instead of scanning a flat field list
- see an explicit risk summary before promoting a more permissive policy into a broader scope
- get a final recommended action so governance decisions can move faster without hiding the reasons
- trigger the suggested workflow directly from the compare surface instead of manually copying scope and rationale
- carry the suggested review path into the resulting promotion proposal so queues and audits know whether the change was routed through standard review, manual approval, or security review
- inspect queue-specific proposal volumes before acting, so high-risk reviews do not get buried under standard promotions

This keeps policy drift visible at the effective-policy layer instead of forcing operators to mentally diff raw JSON.

### 3.6 Local Tool Actions

Should expose bounded local controls such as:

- file write
- exact patch
- rollback of compensable local file changes
- IDE summary
- browser snapshot
- browser session navigation

This section answers:

- what concrete local actions can be taken right now

### 3.7 External Tool Actions

Should expose bounded gateway-backed controls such as:

- CRM sync
- HR checks
- finance reconciliation helpers
- future MCP or connector-backed operations

This section answers:

- what remote or connector-backed actions can be initiated from the same task surface

### 3.8 Operational Safety

Should show:

- total invocation count
- local vs external invocation mix
- idempotent invocation count
- compensable pending actions
- compensation failures
- external reconciliation states:
  - pending
  - applied
  - failed
- degraded executions and circuit state
- manual-attention recommendations

This section answers:

- what can be safely retried
- what can still be rolled back
- what external actions still need reconciliation
- what requires human intervention before rerun

### 3.9 Browser Sessions

Should show:

- session title
- current URL
- engine
- history length
- session status
- degraded mode when fallback was used
- retry and circuit-breaker context when relevant

This section answers:

- what browser work already exists for this task

### 3.10 Verification Stack

Should show:

- checklist status
- verifier verdict
- reconciliation status
- done gate result
- failure reasons when present

This section answers:

- can this output actually be trusted

### 3.11 Worker Runs

Should show:

- worker name
- worker kind
- run status
- summary when available

This section answers:

- who executed the work

### 3.12 Artifacts

Should show:

- artifact name
- artifact status
- artifact kind

This section answers:

- what concrete outputs exist

### 3.13 Tool Invocations

Should show:

- tool name
- invocation status
- timestamp
- idempotency key when present
- compensation status
- reconciliation mode/state when present
- resilience/degraded metadata when present

This section answers:

- what tools actually ran

### 3.14 External Reconciliation

Should show:

- each external or reconciliation-aware invocation
- current reconciliation state
- reconciliation mode
- idempotency key
- a direct action to rerun reconciliation

This section answers:

- can we safely verify the side effect right now
- do we still need human review before retry

### 3.15 Watchdog

Should show:

- watchdog health
- reasons for stall if unhealthy

This section answers:

- is the task progressing normally

### 3.16 Methodology Output

Should show:

- skill candidates
- status

This section answers:

- what was learned from this task

### 3.17 Audit Trail

Should show:

- recent significant events
- action name
- timestamp

This section answers:

- what happened in this task recently

## 4. Interaction Rules

The user should be able to:

- prepare a task
- run a task
- verify a task
- stop a task
- resume a task

These controls should remain visible in the header region.

## 5. Why This Structure Matters

This structure separates concerns:

- planning
- execution
- reuse
- tooling
- verification
- audit

Without that separation, the workspace turns into a noisy event log instead of a usable operating surface.

## 6. Conversation Is Secondary

The conversation panel is useful for:

- refinement
- follow-up instructions
- clarification
- explanation

But the workspace itself should carry the core operational truth.

The user should not need to read a long conversation to know:

- whether the task is blocked
- whether the task is complete
- what method was reused

## 7. Recommended Future Enhancements

The next UI upgrades should be:

1. accept or ignore reuse recommendations
2. rerun only failed verification scope
3. compare current task against the reused template
4. inspect failure boundaries before approving risky reuse

## 8. Summary

The desktop workspace should behave like an operational control panel, not a chat transcript.

In one sentence:

`The task workspace is where planning, execution, reuse, verification, and audit become visible enough for a human to trust and steer the system.`
## Desktop Event Center

The desktop event center is not only a navigation log. High-risk patterns such as repeated system handoffs or system-dominated navigation windows are elevated into actionable risk items.

- Each risk item includes a recommended action.
- Operators can send a risk into the governance inbox, then execute it through the same inbox workflow used by other governance items.
- Dismissals are local-only and stored in browser/local desktop state so teams can hide already-understood noise without weakening backend governance.
- Executed governance alerts reuse the standard local task flow, so they inherit the same audit, planning, verification, and workspace lifecycle as any other task.
- Executed governance alerts and policy follow-ups now land as template-backed `ops` tasks, so operators get a consistent completion target, required artifacts, and execution metadata instead of an unstructured remediation stub.
- Governance alerts also roll up into the dashboard summary and expose their own audit history in the workspace, so operators can see both current load and the full path from detection to execution.
- Repeated desktop navigation risks are aggregated into the same governance alert item with occurrence counts and last-seen visibility, which keeps the dashboard and inbox from getting flooded by identical system-entry noise.
- If the same warning-level navigation risk keeps recurring in a short window, the system can auto-escalate it to critical, reopen the related inbox item, and show the escalation explicitly in the governance panel.
- Priority desktop notifications are derived from `new` inbox items, so repeated low-signal alerts do not keep firing. If a governance alert is reopened or auto-escalated, it becomes eligible for notification again through a new delivery key.
- Critical or repeated governance alerts also appear in a dedicated governance follow-up feed, so operators can execute the highest-signal desktop incidents from a tighter queue without losing the original alert history or inbox routing.

## Worker Session and Schedule Operational Panels

The desktop workspace now includes operational panels for delegated runtime, scheduled jobs, and DeerFlow compatibility:

### Worker Session Panel

Shows all worker sessions with:
- session status (active, idle, stalled, orphaned, expired, supervised_restart, terminated)
- heartbeat recency and step count
- restart count and max restarts
- supervision policy
- linked lease and attempt
- health assessment with specific issues
- resume packages for the session
- recent supervision events

### Scheduled Jobs Panel

Shows all scheduled jobs with:
- job name, cron expression, handler
- active/inactive status
- last run and next run times
- run count, error count, consecutive error count
- missed run count
- checkpoint-aware and maintenance-cycle flags
- health diagnostics (healthy/degraded/unhealthy)
- stuck task detection
- maintenance cycle visibility

### Delegated Runtime Panel

Shows the overall delegated runtime state with:
- active and total session counts
- sessions by status breakdown
- resume package summary (prepared/applied/superseded/failed/rolled_back)
- recent supervision events
- attempt linkage (attempt → session → lease → run)
- available recovery actions (restart session, apply resume package, release expired lease)

### DeerFlow Boundary Panel

Shows the DeerFlow compatibility boundary with:
- registered worker routes with adapter boundary type
- import hooks and their status
- compatibility status (full/partial/mock_only)
- non-backbone semantics explanation
