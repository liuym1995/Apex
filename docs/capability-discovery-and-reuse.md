# Capability Discovery and Reuse

This document explains how the runtime chooses between reusing existing capabilities and implementing something locally.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./reuse-and-learning.md`](./reuse-and-learning.md)

## 1. Purpose

The system should not immediately implement new behavior every time a task arrives.

It should first ask:

- do we already know how to do this
- do we already have the right connector
- do we already have the right tool
- do we already have the right worker

This is the capability-first rule.

It must be combined with a stronger best-practice rule:

`deterministic infrastructure first, build last`

## 2. Capability Types

The platform reasons over these capability classes:

- `Skill`
- `MCP server`
- `Tool`
- `Worker`
- `Implementation fallback`

Each class answers a different question.

### 2.1 Skill

Defines method.

### 2.2 MCP

Defines standardized access to external systems and resources.

### 2.3 Tool

Defines a concrete callable operation.

### 2.4 Worker

Defines a bounded execution runtime.

### 2.5 Implementation Fallback

Defines the local path taken when nothing reusable fits well enough.

## 3. Best-Practice Resolver Rule

The runtime should evaluate candidates using a scored resolver.

Important distinction:

- capability classes are not the same thing as execution priority
- deterministic-first execution order is defined by the constitution
- capability class ordering should therefore be used only as a weak tiebreaker among otherwise comparable candidates

The real decision should score candidates on:

- policy admissibility
- risk tier
- deterministic coverage
- locality
- historical reliability
- historical reuse success
- latency
- cost
- maintenance burden

This ensures that the system:

- reuses proven methods first
- keeps connectors standardized
- keeps tooling bounded
- only invents new execution paths when necessary

If two candidates are otherwise close, prefer the one that preserves deterministic leverage and cleaner contract boundaries.

## 4. Discovery Universe

Before implementing a new path, the resolver should search:

1. approved internal capabilities
2. local installed CLI tools and scripts
3. official tool ecosystems and GitHub projects
4. MCP servers and connectors
5. reusable workers
6. implementation fallback

The runtime must not rebuild a capability just because the first search surface was empty.

## 5. Capability Discovery Flow

```mermaid
flowchart LR
  A["New Task"] --> B["Infer capability needs"]
  B --> C["Search capability catalog"]
  C --> D["Rank reusable options"]
  D --> E["Choose strategy"]
  E --> F["Reuse / Compose / Implement locally"]
```

## 6. Capability Needs

Capability needs should be inferred from:

- task intent
- department
- task type
- user-requested capabilities

Examples:

- methodology
- execution worker
- source access
- browser automation
- workspace context
- reconciliation
- automation support

## 7. Allowed Strategies

Every capability need should resolve into one of:

### 7.1 `reuse_existing`

One strong existing capability is enough.

### 7.2 `compose_existing`

Multiple existing capabilities together satisfy the need.

### 7.3 `implement_local`

No sufficiently good reusable option exists, so the runtime must create the path locally.

Implementation fallback is only correct when the runtime has already compared:

- quality
- cost
- security
- operational burden

## 8. Deterministic-First Hierarchy

For fixed workflows, the preferred order is:

1. CLI
2. script
3. reusable tool or connector
4. reusable skill that wraps deterministic infrastructure
5. LLM reasoning path

Skills are not a replacement for infrastructure.
They are the method layer that points the system at the right deterministic infrastructure.

## 9. Why This Matters

Without capability discovery:

- the system repeats work
- governance fragments
- connectors become inconsistent
- new implementation paths multiply too quickly

With capability discovery:

- reused methods get stronger over time
- implementation cost goes down
- planning gets faster
- architecture stays composable
- teams avoid duplicate tool building
- model spend drops on fixed workflows

## 10. Learned Playbooks in Discovery

Approved learned playbooks are part of the capability catalog.

That means future tasks can discover previously successful methodology as if it were a first-class skill source.

This is how learning feeds back into planning.

## 11. Task Templates in Discovery

Task templates are not identical to skills.

They accelerate:

- definition of done generation
- baseline execution plan creation

They are planning accelerators, not substitutes for capability discovery.

The correct flow is:

- reuse template
- still run capability discovery
- then execute

## 12. Reuse Must Remain Explainable

Capability selection should always remain visible in the task workspace.

For each need, the user should be able to see:

- the need
- the strategy
- the matched capabilities
- the score breakdown
- the reasoning

This avoids black-box reuse.

## 13. When Fallback Is Correct

Fallback is not a failure by itself.

It is the correct choice when:

- no reusable capability fits
- a reusable option is too weak
- a reusable option is too expensive
- applicability rules say the known method should not be reused
- local constraints require a new path

The key rule is:

fallback should be deliberate, auditable, and bounded.

This also applies to runtime degradation.

If the preferred capability becomes unstable:

- bounded retry is allowed
- degraded fallback is allowed when safety remains acceptable
- circuit opening is allowed to protect the rest of the system
- the degraded path must stay visible in audits and task workspace state

## 14. Summary

Capability discovery is what keeps the platform from reinventing itself on every task.

In one sentence:

`Apex searches internal capabilities, installed tools, GitHub and connector ecosystems, and deterministic infrastructure first, then uses a scored resolver to decide whether reuse or local implementation is actually best.`
