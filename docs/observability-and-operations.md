# Observability and Operations

This document explains how Apex should be monitored, operated, and debugged in real use.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)

## 1. Purpose

The platform is not just an AI interface.
It is an operational system that runs tasks, controls tools, learns from work, and may interact with real external systems.

That means observability is not optional.

Best-practice boundary:

- observability must not become silent third-party data exfiltration

## 2. Operational Goals

The system should make it easy to answer:

- what is running
- what is stuck
- what completed
- what failed
- what was reused
- what was learned
- what cost was incurred
- why a task is blocked

## 3. Core Signals

The minimum important operational signals are:

### 3.1 Task Signals

- task created
- task planned
- task running
- task stopped
- task resumed
- task completed
- task failed

### 3.2 Execution Signals

- checkpoint added
- worker assigned
- worker started
- worker completed
- tool invoked
- artifact created

### 3.3 Verification Signals

- checklist ran
- verifier ran
- reconciliation ran
- done gate passed or failed

### 3.4 Learning Signals

- memory captured
- skill candidate created
- skill approved
- task template promoted
- task template applied

## 4. Watchdog and Stall Detection

The watchdog exists to detect tasks that appear alive but are no longer progressing.

It should monitor:

- missing heartbeat
- stale heartbeat
- missing progress over time
- repeated fallback loops

The watchdog result should be visible in the workspace and available to operations dashboards.

## 5. Audit and Operational Logs

Audit logs and operational logs are related but not identical.

### 5.1 Audit

Audit should answer:

- what critical action happened
- who or what triggered it
- when it happened
- which policy scope or bundle was affected when the action was governance-related

### 5.2 Operational Logs

Operational logs should answer:

- what the system was doing internally
- where it failed
- what step produced an error

Both are necessary.

## 6. Metrics

Recommended metrics include:

- tasks created per period
- tasks completed per period
- task failure rate
- average time to completion
- average planning time
- reuse hit rate
- learned asset promotion rate
- local tool invocation count
- verifier failure rate
- reconciliation failure rate
- done gate failure rate
- queue depth and local rate-limit events
- retry count and fallback count
- manual intervention rate
- security-flag rate
- prompt-injection rejection rate
- learned-skill rejection rate
- estimated hallucination rate where a measurable benchmark exists
- token usage when model-backed paths are enabled

These metrics should be emitted to self-hosted or policy-approved sinks by default.

These metrics help determine whether the system is getting faster and safer over time.

## 7. Operational Dashboards

Recommended dashboards:

### 7.1 Runtime Health Dashboard

Shows:

- active tasks
- stalled tasks
- recent failures
- worker activity

### 7.2 Verification Dashboard

Shows:

- checklist failures
- verifier failures
- reconciliation failures
- done gate pass/fail trends

### 7.3 Reuse Dashboard

Shows:

- learned playbook hits
- task template hits
- fallback rate
- template promotion count

### 7.4 Cost Dashboard

Shows:

- total cost
- cost by task family
- cost by department
- cost by model and tool mix when available

### 7.5 Skill Governance Dashboard

Shows:

- review queue size
- policy proposal queue size
- recent policy proposal approve / reject / apply activity
- batch proposal processing activity
- environment release history for policy promotion and rollback
- recent bundle export / promotion / import activity
- trusted publisher policy
- allowed release channels
- blocked tags and blocked capabilities
- effective role gates for review, promotion, and trusted import
- effective role gates for policy edit, policy approval, and policy promotion
- active environment labels and allowed promotion pipeline
- policy source tracking, so operators can see whether a value came from default behavior, a global/org/workspace/local policy file, or environment configuration
- policy file load status, including configured path and parse or validation errors for each configured scope

## 8. Operational Principles

- prefer structured event records over freeform log-only debugging
- make important state visible in both UI and logs
- capture just enough detail to debug, but avoid uncontrolled log sprawl
- track reuse and verification explicitly because they are first-class system behaviors
- distinguish retriable failures from terminal failures
- record when the system downgraded, fell back, or rate-limited a request
- make security decisions inspectable instead of burying them in model transcripts
- keep correlated traces and event ids across planning, execution, verification, and learning
- do not ship prompts, code, memory, logs, or artifacts to third-party telemetry platforms by default

## 8B. Telemetry Boundary

Best-practice telemetry policy:

- self-hosted telemetry by default
- outbound telemetry deny-by-default
- explicit allowlists and policy attribution for remote sinks
- no third-party telemetry SDKs inside privileged local runtime components
- export only by explicit user or policy action

## 8A. A/B and Baseline Evaluation

The product should continuously answer:

- is the agent path better than a simpler baseline
- where is the agent still adding latency without enough value
- what task families should continue using reuse fast paths

Recommended comparisons:

- agent workflow versus plain LLM answer
- reused template versus newly generated plan
- preferred capability versus fallback capability

Recommended tracked outcomes:

- success rate
- completion time
- cost
- human intervention rate
- verifier pass rate
- reconciliation pass rate

## 9. Incident Handling

When something goes wrong, operators should be able to inspect:

- task status
- checkpoints
- worker runs
- tool invocations
- verification state
- audit trail
- watchdog result

This is why these objects are first-class.

## 10. What Good Operations Looks Like

In a healthy deployment:

- most similar tasks increasingly reuse approved methods
- planning time trends down
- verification remains stable
- fallback rate trends down where reuse is appropriate
- watchdog catches stalled tasks before users lose trust
- security rejection rates are understandable and do not silently disappear
- degraded-mode operation remains visible instead of pretending the preferred path ran

## 11. Summary

Observability is what makes the platform operable as a real task system rather than a black-box AI feature.

In one sentence:

`Apex should make task state, execution state, verification state, reuse state, and failure state visible enough to operate confidently at scale.`
