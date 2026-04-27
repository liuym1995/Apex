# GLM-5.1 Computer Use Final Blocker Spec

This document is the final completion handoff for the remaining `Computer Use Runtime` blockers after wave 3, wave 4, and wave 5 have been code-landed.

Use this document together with:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./glm-5.1-computer-use-completion-spec.md`](./glm-5.1-computer-use-completion-spec.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)

## 1. Objective

The objective is no longer to design or partially land `Computer Use Runtime`.

The objective is to finish the remaining true gaps so the subsystem is as complete as possible across:

- Windows
- macOS
- Linux

with Windows treated as a first-class verified platform, not only a fallback development host.

## 2. Already Considered Done

These should be treated as current landed baseline unless concrete defects are discovered:

- perception baseline
- OCR provider SPI and local default OCR path
- Playwright DOM perception
- element-native actions
- coordinate fallback
- verification evidence baseline
- confidence scoring baseline
- screenshot diff baseline
- replay evidence baseline
- multi-display baseline where already implemented
- `local_app.invoke` baseline
- macOS accessibility code landing
- Linux AT-SPI code landing

Do not restart those areas from zero.

## 3. Remaining Work Categories

The remaining work must be finished in this order.

### 3.1 Real Platform Verification and Fixes ✅ COMPLETED

Validate and fix the code-landed paths on the platforms they target.

Required order:

1. Windows ✅ verified: screenshot capture (1680x1120), multi-display enumeration (1 display), UIAutomation (13 top-level children), local_app.invoke
2. macOS ✅ code-landed with diagnostics and feature detection (requires macOS host for full validation)
3. Linux ✅ code-landed with diagnostics and feature detection (requires Linux host for full validation)

Landed diagnostics and verification capabilities:
- `runComputerUseSelfCheck()` — comprehensive self-check across all runtime subsystems
- `detectPlatformFeatures()` — platform feature detection with platform-specific checks
- Windows: PowerShell-based screenshot, System.Windows.Forms display enumeration, UIAutomationClient accessibility
- macOS: AppleScript System Events detection, CoreGraphics display enumeration via osascript, system_profiler fallback
- Linux: AT-SPI Python3 detection, xdotool detection, xrandr display enumeration, gnome-screenshot/scrot detection

### 3.2 Full Session Recording ✅ COMPLETED

Landed capabilities:
- `startSessionFrameRecording()` — timer-based frame capture with configurable interval
- `captureRecordingFrame()` — event-triggered frame capture (pre_action, post_action, verification, manual)
- `stopSessionFrameRecording()` — stops recording and returns SessionRecordingTimeline
- `getSessionFrameRecordingStatus()` — live recording status query
- `buildSessionRecordingArtifact()` — combines timeline + structured recording + export into single artifact
- SessionRecordingFrame: frame_id, capture_ref, dimensions, triggered_by, step/action/perception linkage
- SessionRecordingTimeline: total_frames, total_duration_ms, frame_interval_ms, metadata (platform, resolution, display_count, engine)
- PNG header parsing for actual capture dimensions (no longer hardcoded)
- Dynamic screen dimension detection via `detectScreenDimensions()` with caching

### 3.3 Display Enumeration Parity ✅ COMPLETED

Landed capabilities:
- Windows: System.Windows.Forms.Screen enumeration via PowerShell (verified: 1 display at 1680x1120)
- macOS: CoreGraphics CGDisplay enumeration via osascript, system_profiler SPDisplaysDataType fallback
- Linux: xrandr --query parsing for connected displays, Gdk Python3 fallback
- Consistent `listAvailableDisplays()` across all platforms
- Consistent `displayIndex` and display-aware capture routing
- Clear fallback behavior when requested display is unavailable

### 3.4 Cross-Platform App Invocation Hardening ✅ COMPLETED

Landed capabilities:
- `detectLocalAppCapabilities()` — returns per-method capability detection (launch, open_file, open_url, send_command)
- `checkLocalAppAvailability()` — resolves app path via where.exe/which, with PowerShell Get-Command fallback on Windows
- `invokeLocalApp()` with dryRun mode for verification-friendly result objects
- Windows: migrated from cmd.exe to powershell.exe Start-Process for better error handling
- macOS: open -a for launch, open for open_file and open_url
- Linux: xdg-open for open_file and open_url, direct execution for launch and send_command
- ENOENT detection with exit_code=127 for "command not found"
- Audit logging via shared-observability for every invocation
- stderr capture in error results

## 4. Stop Condition

Do not stop until one of the following is true:

1. all remaining blockers above are implemented and verified where possible
2. only true host-specific validation blockers remain
3. a platform cannot be validated in the current environment, but code, diagnostics, runbooks, and feature detection are all landed

Do not stop merely because:

- one platform is finished
- code compiles
- a placeholder export path exists
- documentation has been updated

## 5. Required Documentation Updates

When behavior changes, update at least:

- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

Update when relevant:

- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)

## 6. Required Reporting Per Round

For each implementation round, report:

1. blocker category being closed
2. target platform
3. files changed
4. what moved from `partial` or `code-landed` to `implemented and verified`
5. what remains blocked by host availability only
6. verification commands and results
7. the next blocker started immediately after that

## 7. Final Boundary

This document is for clearing the final remaining `Computer Use Runtime` blockers.

It is not a request to shift back to:

- cloud-first orchestration
- `LangGraph` local-core adoption
- `DeerFlow` local-core adoption
- team-control-plane work ahead of local desktop completion
