# Skill Compatibility

This document explains how Apex treats external skill ecosystems without letting the platform get locked into any single format.

## 1. Design Principle

The platform should never treat an external skill format as the internal source of truth.

Instead:

- external formats are imported
- imported skills are normalized into one shared contract
- the rest of the runtime only depends on the canonical contract

This keeps the system replaceable and prevents format drift from leaking into planning, execution, or verification.

## 2. Canonical SkillSpec

Apex now defines a shared `CanonicalSkillSpec` with fields such as:

- `skill_id`
- `name`
- `description`
- `source`
- `execution_mode`
- `prompt_template`
- `trigger_phrases`
- `tags`
- `required_capabilities`
- `preferred_workers`
- `notes`
- `version`

This contract lives in the shared type layer so that:

- importers
- planners
- capability discovery
- UI
- future registries

can all speak one stable language.

## 3. Supported Compatibility Paths

The current compatibility layer supports import into the canonical format from:

- OpenClaw-style skills
- Claude-style slash command skills
- OpenAI-style reusable skills

It now also supports formal document interchange in both directions:

- import from inline content
- import from explicit local files
- export to canonical JSON
- export to OpenClaw-style markdown
- export to Claude-style markdown
- export to OpenAI-style JSON

Imported skills are now also registered into the shared local skill registry so they can participate in:

- capability catalog search
- future ranking and reuse
- workspace-visible capability discovery

The local control plane is now the official boundary for this flow. That means the desktop app and future automations should use control-plane endpoints rather than re-implementing importer logic in the UI.

The importers are intentionally lightweight and safe:

- they normalize metadata
- they infer execution mode
- they preserve prompt content
- they avoid binding runtime behavior directly to external file layout

## 4. Why This Matters

This approach lets the platform stay compatible with external ecosystems while preserving internal control.

That means:

- OpenClaw skills can be learned from without making OpenClaw the platform contract
- Claude command skills can be imported without turning slash commands into the planning model
- OpenAI skills can be reused without making the runtime dependent on OpenAI-only semantics

## 5. Best Practice

Use external skills as:

- import sources
- interoperability bridges
- distribution formats

Do not use them as:

- the persistence truth
- the planner contract
- the execution contract
- the permission contract

The internal canonical spec should remain the stable center.

## 6. Operational Flow

The recommended flow is:

1. import external content into `CanonicalSkillSpec`
2. run security preflight on the normalized prompt template
3. register the skill into the canonical registry with a governance status
   - internal skills may start as `active`
   - imported external skills should default to `review_required`
4. expose it through:
   - capability discovery
   - workspace skill search
   - future reuse and routing
5. activate only reviewed skills for capability discovery
6. export only from the canonical registry

This keeps the system from accumulating half-normalized or partially trusted skill documents.

## 7. API Direction

The local control plane should remain the public runtime boundary for:

- `GET /api/local/skills`
- `GET /api/local/skills/:skillId`
- `GET /api/local/skills/review-queue`
- `GET /api/local/skills/bundle-history`
- `GET /api/local/skills/:skillId/audits`
- `POST /api/local/skills/register`
- `POST /api/local/skills/import`
- `POST /api/local/skills/import-file`
- `POST /api/local/skills/:skillId/export`
- `POST /api/local/skills/:skillId/export-file`
- `POST /api/local/skills/:skillId/governance`
- `POST /api/local/skills/export-bundle`
- `POST /api/local/skills/verify-bundle`
- `POST /api/local/skills/import-bundle`

That boundary exists so the desktop shell, future cloud services, and automation flows all share one skill registry contract.

## 8. Governance Model

Canonical skills should move through explicit states:

- `review_required`
- `active`
- `disabled`

Best practice:

- imported skills should not silently become active production capabilities
- only `active` skills should enter capability discovery and reuse ranking
- disabled skills should remain visible in the registry for audit and recovery, but not participate in planning
- every canonical skill should also carry an integrity hash so exported or reviewed content can be traced back to a stable normalized record

For team operations, the registry should also support:

- a review queue for `review_required` skills
- governance audit history per skill
- promoted bundle export, typically filtered to `active` skills only

The promoted bundle should now be treated as a first-class manifest:

- explicit bundle metadata
- bundle integrity hash
- optional signature
- publisher identity
- source environment
- release channel
- promotion note
- promotion history
- verify before import
- import through the same control plane boundary

Best practice for promoted bundle release is:

1. export only reviewed `active` skills by default
2. stamp the bundle with:
   - publisher id
   - publisher name
   - source environment
   - release channel
   - promotion note
3. sign the bundle when a signing secret is configured
4. verify the bundle before every import
5. preserve provenance history so downstream teams can see whether the bundle was:
   - exported
   - promoted
   - imported
6. evaluate local trust policy before privileged import:
   - trusted publisher allowlist
   - allowed release channels
   - optional requirement that only trusted bundles may be imported as trusted
7. evaluate bundle content policy before trusted or promoted use:
   - allowed skill sources
   - blocked tags
   - blocked required capabilities
8. enforce role policy on control-plane actions:
   - reviewer/admin for governance changes
   - releaser/admin for promoted bundle export
   - releaser/admin for trusted bundle import

This turns skill distribution into a traceable release workflow instead of a file-copy habit.
