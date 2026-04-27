# GLM-5.1 Computer Use Last Mile Spec

This document is the final last-mile handoff for the remaining `Computer Use Runtime` work after the main blocker-clearing pass has already landed.

Use this document together with:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./glm-5.1-computer-use-completion-spec.md`](./glm-5.1-computer-use-completion-spec.md)
- [`./glm-5.1-computer-use-final-blocker-spec.md`](./glm-5.1-computer-use-final-blocker-spec.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)

## 1. Objective

The objective is to finish the remaining last-mile `Computer Use Runtime` gaps without stopping at intermediate summaries.

At this point the work is no longer broad platform construction. It is targeted completion of the few remaining capabilities that are still:

- unimplemented
- only partially implemented
- code-landed but not yet host-validated

## 2. Remaining Scope

The remaining scope is now limited to these items:

1. macOS accessibility host validation and fixups
2. Linux AT-SPI host validation and fixups
3. session recording -> real video encoding pipeline
4. Firefox perception support
5. WebKit perception support

Everything else should be treated as already landed baseline unless a concrete defect is found.

## 3. Fixed Execution Order

The remaining work must be completed in this exact order.

### 3.1 Browser Perception Parity ✅ COMPLETED

Landed capabilities:
- Firefox DOM perception support via `perceiveScreen({ engine: "playwright_dom_firefox" })`
- WebKit DOM perception support via `perceiveScreen({ engine: "playwright_dom_webkit" })`
- Normalization parity with Chromium (same DOM → UIElement mapping, same role/tag/attribute extraction)
- PlaywrightFirefoxElementActionProvider and PlaywrightWebKitElementActionProvider registered
- `detectBrowserEngineAvailability()` for provider-level diagnostics
- UIPerceptionEngineSchema extended with "playwright_dom_firefox" and "playwright_dom_webkit"

### 3.2 Session Recording Video Encoding ✅ COMPLETED

Landed capabilities:
- `encodeSessionRecording()` — converts frame/timeline recording into real video artifact
- FFmpegVideoEncoder: MP4 (H.264), WebM (VP9), GIF (palette-based) encoding via FFmpeg
- PNGSequenceEncoder: always-available fallback with manifest.json + numbered PNGs
- VideoEncoder SPI with `registerVideoEncoder()` / `listVideoEncoders()`
- recording_metadata.json written alongside encoded output with timeline data
- Configurable fps, width, height, format, output path

### 3.3 macOS Accessibility Validation ✅ COMPLETED (code-landed with diagnostics, requires macOS host)

Landed capabilities:
- `runMacOSAccessibilityDiagnostics()` — comprehensive diagnostics with:
  - AppleScript availability check
  - System Events accessibility check
  - Accessibility permissions detection
  - Visible process count
  - Sample element count from Finder
  - Detailed error reporting
  - Step-by-step runbook for permission issues
- MacOSAccessibilityElementActionProvider with click/type/focus via osascript
- buildMacOSAccessibilityTree with AppleScript System Events traversal

### 3.4 Linux AT-SPI Validation ✅ COMPLETED (code-landed with diagnostics, requires Linux host)

Landed capabilities:
- `runLinuxATSPIDiagnostics()` — comprehensive diagnostics with:
  - AT-SPI Python3 availability check
  - xdotool availability check
  - xrandr availability check
  - Screenshot tool detection (gnome-screenshot / scrot)
  - Display server detection (X11 / Wayland)
  - AT-SPI desktop children count
  - Sample element count
  - Detailed error reporting
  - Step-by-step runbook for installation and Wayland compatibility
- LinuxATSPIElementActionProvider with click/type/focus via AT-SPI actions
- buildLinuxAccessibilityTree with Python3 AT-SPI traversal

## 4. Rules

- Do not stop after Firefox support alone.
- Do not stop after video encoding alone.
- Do not stop after updating documentation.
- Do not treat “host not available” as a reason to stop early if code-only work remains.
- Do not re-open cloud orchestration or unrelated architecture work.
- Do not replace the local typed runtime skeleton.
- Do not introduce DeerFlow or LangGraph as the current local runtime core.

## 5. Required Documentation Updates

When behavior changes, update at least:

- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

Update when relevant:

- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)

## 6. Required Verification

For each last-mile item, run the strongest local verification available.

Minimum expectation:

- type check
- build where applicable
- direct endpoint or runtime smoke checks for the changed capability
- explicit note when verification is blocked by host availability

## 7. Stop Condition

Stop only when one of the following is true:

1. all remaining scope above is fully implemented and verified where possible
2. only true host-unavailable validation blockers remain for macOS and/or Linux
3. a hard environmental dependency prevents progress even after code-only work, diagnostics, and runbooks are complete

## 8. Required Reporting Per Round

For each round, report:

1. current target
2. files changed
3. what moved to implemented
4. what remains partial
5. what is blocked only by host availability
6. verification results
7. the next remaining item started immediately after that
