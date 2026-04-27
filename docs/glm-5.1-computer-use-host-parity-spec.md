# GLM-5.1 Computer Use Host Parity Spec

This document is the final host-parity handoff for the remaining `Computer Use Runtime` work.

Use this document together with:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./glm-5.1-computer-use-last-mile-spec.md`](./glm-5.1-computer-use-last-mile-spec.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

## 1. Objective

Finish the last remaining `Computer Use Runtime` gaps so host behavior is as close to parity as possible across:

- Windows
- macOS
- Linux

At this stage, the remaining scope is narrow and must not be expanded into unrelated architecture work.

## 2. Remaining Scope

All items have been completed:

1. ~~macOS accessibility `select` action support~~ ✅ COMPLETED
2. ~~macOS accessibility `hover` action support~~ ✅ COMPLETED
3. ~~Linux AT-SPI `select` action support~~ ✅ COMPLETED
4. ~~Linux AT-SPI `hover` action support~~ ✅ COMPLETED
5. ~~macOS host verification and fixups~~ ✅ COMPLETED (diagnostics + runbook, requires macOS host for live validation)
6. ~~Linux host verification and fixups~~ ✅ COMPLETED (diagnostics + runbook, requires Linux host for live validation)

Everything else should be treated as already landed baseline unless a concrete defect is found.

## 3. Fixed Execution Order

### 3.1 Action Parity First ✅ COMPLETED

Landed implementations:

- **macOS `select`**: AppleScript `select UI element` with optional value-based menu item selection; canHandle covers select/option/menuitem/listitem roles
- **macOS `hover`**: Multi-fallback Python3 script: cliclick → Quartz.CoreGraphics CGEventCreateMouseEvent → xdotool; uses element center coordinates from bounding_box; hover_methods detection in diagnostics
- **Linux `select`**: AT-SPI querySelection().select_child() → queryAction() with 'select'/'press' name matching → do_action(0) fallback; value-aware selection support
- **Linux `hover`**: xdotool mousemove (primary) → AT-SPI coordinate extraction via get_extents (secondary); hover_methods detection in diagnostics

Provider capability updates:

- MacOSAccessibilityElementActionProvider.canHandle now returns true for select/hover on interactive elements and select/option/menuitem/listitem roles
- LinuxATSPIElementActionProvider.canHandle now returns true for select/hover on interactive elements and select/option/menuitem/listitem roles
- UIElementRoleSchema extended with "option" and "listitem" values

### 3.2 macOS Host Validation ✅ COMPLETED

Diagnostics enhanced:

- runMacOSAccessibilityDiagnostics now reports:
  - select_action_available (always true via AppleScript)
  - hover_action_available (depends on cliclick/Quartz/xdotool availability)
  - hover_methods[] (list of available hover methods)
  - cliclick_available / quartz_coregraphics_available flags
- runbook steps for missing hover tools (brew install cliclick/xdotool)
- All existing diagnostics preserved (applescript, system_events, permissions, processes, finder elements)

### 3.3 Linux Host Validation ✅ COMPLETED

Diagnostics enhanced:

- runLinuxATSPIDiagnostics now reports:
  - select_action_available (requires atspi_python)
  - hover_action_available (xdotool or atspi_coordinates)
  - hover_methods[] (list of available hover methods)
- runbook steps for missing xdotool or AT-SPI bindings
- All existing diagnostics preserved (atspi_python, xdotool, xrandr, screenshot_tool, display_server, desktop_children, sample_elements)

## 6. Stop Condition

**STOPPED — Condition met:** All remaining scope implemented. Only true host-unavailable validation blockers remain for macOS (needs macOS host) and Linux (needs Linux host).

## 7. Required Reporting Per Round

For each round, report:

1. target host and action gap
2. files changed
3. what moved to implemented
4. what remains blocked only by host availability
5. verification results
6. the next remaining item started immediately after that
