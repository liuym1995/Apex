# Local Settings And Runtime Defaults

This document defines how Apex should use local settings to provide safe defaults without forcing unnecessary user configuration.

It is a companion to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)

## 1. Purpose

The app should not ask the user to configure low-risk paths that can be defaulted safely.

The app should:

- generate recommended defaults on first install
- let the user review and edit them during setup
- allow later changes in `Settings`
- block only on truly required configuration

This keeps the product easy to start while remaining inspectable and controllable.

## 2. Configuration Classes

Settings are divided into three classes.

### 2.1 Required

These block execution if missing or invalid.

Examples:

- a valid local runtime root
- a writable local database path
- any mandatory external credential for a task that cannot run without it

### 2.2 Recommended Defaults

These should be populated automatically.

Examples:

- workspace root
- default task working directory
- default file write root
- default export directory
- artifact directory
- replay and verification evidence directory

These should be editable but should not block first use.

### 2.3 Advanced Policy

These should appear in advanced settings, not first-run setup unless the user explicitly expands them.

Examples:

- subagent resource policy
- budget policy defaults
- remote endpoint onboarding
- advanced sandbox policy

## 3. Default Directory Model

The runtime should maintain distinct default directories with clear intent.

### 3.1 Canonical Defaults

- `workspace_root`
  - the main user-selected workspace root
- `default_task_workdir`
  - where a new task operates by default unless the task explicitly targets another workspace
- `default_write_root`
  - the default bounded directory for task-created files when the task does not specify a target path
- `default_export_dir`
  - the default destination for user-facing exports
- `artifact_dir`
  - runtime-generated artifacts, evidence bundles, replay packages, screenshots, and temporary outputs
- `verification_evidence_dir`
  - deterministic and semantic verification evidence
- `task_run_dir`
  - per-task working state and generated subfolders

### 3.2 Best-Practice Default Resolution

Recommended behavior:

1. derive `default_task_workdir` from `workspace_root`
2. derive `default_write_root` from `workspace_root`
3. derive `default_export_dir` from `local_dev_root` or `workspace_root/exports`
4. derive `artifact_dir` and `verification_evidence_dir` from `local_dev_root`
5. derive `task_run_dir` from `local_dev_root/tasks`

Example shape:

- `workspace_root`
- `workspace_root/work`
- `workspace_root/output`
- `local_dev_root/artifacts`
- `local_dev_root/verification`
- `local_dev_root/tasks`

## 4. Where Defaults Must Be Used

These settings should not live only in the setup screen.
They must feed actual runtime behavior.

### 4.1 Task Creation

When a task is created without explicit path targets, the task should inherit:

- `default_task_workdir`
- `default_write_root`
- `default_export_dir`

### 4.2 Tool Routing

When file or export operations are invoked without explicit user paths:

- file creation should resolve under `default_write_root`
- export operations should resolve under `default_export_dir`
- evidence capture should resolve under `verification_evidence_dir`
- replay packages and screenshots should resolve under `artifact_dir`

### 4.3 Task Recovery

Checkpoint, resume, replay, and rollback artifacts should resolve under `task_run_dir` and `artifact_dir`, not arbitrary working directories.

### 4.4 Computer Use

Computer-use outputs should default to:

- screenshots -> `artifact_dir/screenshots`
- recordings -> `artifact_dir/recordings`
- OCR outputs -> `artifact_dir/ocr`
- replay bundles -> `artifact_dir/replay`

### 4.5 Verification

Checklist, verifier, reconciliation, and done-gate evidence should default to:

- `verification_evidence_dir`

This should make acceptance review reproducible.

## 5. UX Rules

### 5.1 First Install

The user should see:

- the resolved defaults
- whether each field is required or optional
- a short explanation of what each path is used for

The user should not be forced to fill every field manually.

### 5.2 Later Settings

The user should be able to change:

- workspace root
- default task working directory
- default write root
- default export directory
- artifact and verification directories

Changes that require restart should be clearly labeled.

### 5.3 Runtime Prompting

If a task truly requires missing configuration:

- pause the task
- show exactly which required configuration is missing
- explain why it is required
- offer a direct jump to the relevant settings page

## 6. Required Implementation Direction

The runtime should add explicit local settings fields for:

- `default_task_workdir`
- `default_write_root`
- `default_export_dir`
- `verification_evidence_dir`
- `task_run_dir`

The task engine should then consume these settings as runtime defaults, not just UI metadata.

## 7. Hard Rule

Optional directory settings should default automatically.

Only configuration that is truly required for task correctness, safety, or external connectivity should interrupt the user and require manual action.
