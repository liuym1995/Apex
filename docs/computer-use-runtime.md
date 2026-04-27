# Computer Use Runtime

This document defines the dedicated architecture, current implementation boundary, and landing order for the desktop-first computer-use subsystem.

Use this document when the task involves:

- desktop screenshot capture
- OCR, accessibility, DOM, or other perception pipelines
- mouse, keyboard, or element-native desktop/browser actions
- see -> act -> verify -> recover loops
- human takeover, replay, and computer-use safety boundaries

This document is subordinate to:

- [`../master_plan.md`](../master_plan.md)
- [`./architecture-constitution.md`](./architecture-constitution.md)
- [`./architecture-document-system.md`](./architecture-document-system.md)
- [`./best-practice-reset-plan.md`](./best-practice-reset-plan.md)

When this document conflicts with current code, typed contracts and runtime code remain authoritative for current behavior.

## 1. Purpose

`Computer Use Runtime` is a first-class local runtime subsystem for operating a user workstation through structured perception, controlled action, verification, recovery, and human takeover.

It exists to let the desktop product move beyond file-only or browser-only tooling and toward a complete machine-operator loop without turning the whole product into a monolithic automation engine.

The subsystem must remain:

- local-first
- vendor-neutral
- verification-driven
- policy-aware
- replayable
- interruptible
- replaceable at the provider layer

## 2. Architectural Role

Within the desktop-first target architecture, `Computer Use Runtime` is not the global orchestration backbone.

It is a dedicated runtime module that plugs into the existing local typed runtime and control plane.

The stable public execution shape remains:

- `TaskRun`
- `TaskAttempt`
- `WorkerSession`
- `SandboxLease`
- `ExecutionStep`
- `VerificationRun`

`Computer Use Runtime` contributes computer-use-specific contracts, providers, and execution loops under that public shape.

## 3. Best-Practice Module Shape

The subsystem should continue converging on five replaceable layers.

### 3.1 Perception SPI

- screen capture provider
- OCR provider SPI with pluggable provider registration
- local default OCR providers (Windows OCR, Tesseract)
- accessibility provider
- browser DOM provider (Playwright DOM -> UIElement mapping)
- unified `UIElement` normalization

### 3.2 Action SPI

- mouse executor
- keyboard executor
- element-native action executor (ElementActionProvider SPI)
- local app invoke executor (invokeLocalApp with dryRun, capability detection, audit logging)
- unified element action resolver with fallback chain (element-native -> accessibility-native -> coordinate fallback)
- cross-platform app invocation hardening (detectLocalAppCapabilities, checkLocalAppAvailability)

### 3.3 Verification SPI

- screenshot diff verification (implemented: compareScreenCaptures with exact-hash and sampled-byte-similarity modes)
- DOM post-condition verification (implemented: performDOMPostCheck)
- accessibility post-condition verification (implemented: performAccessibilityPostCheck)
- confidence scoring (implemented: computeConfidenceScore with multi-signal weighted scoring)
- verification evidence integration (implemented: buildVerificationEvidence, ComputerUseVerificationEvidenceSchema)
- element state diffing (implemented: buildElementStateFromUIElement, state_before/state_after comparison)

### 3.4 Recovery and Replay

- see -> act -> verify -> recover loop
- retry policy
- circuit breakers
- replay package
- step-by-step replay results
- session recording (implemented: generateSessionRecording, exportSessionRecording)
- verification-evidence-aware replay payloads (implemented: verification_evidence in ComputerUseReplayStep)
- frame-based session recording (implemented: startSessionFrameRecording, captureRecordingFrame, stopSessionFrameRecording, buildSessionRecordingArtifact)
- session recording timeline with metadata (implemented: SessionRecordingTimeline with platform, resolution, display_count, engine)

### 3.5 Diagnostics and Self-Check

- platform feature detection (implemented: detectPlatformFeatures with per-platform checks)
- comprehensive self-check (implemented: runComputerUseSelfCheck across all subsystems)
- local app capability detection (implemented: detectLocalAppCapabilities, checkLocalAppAvailability)
- circuit breaker status monitoring (implemented: getCircuitBreakerStatus)

### 3.6 Safety Boundary

- human takeover
- stop / pause / resume
- permission checks
- sandbox lease linkage
- audit trace

## 4. Current Implemented Scope

The current repository has already landed a meaningful computer-use runtime baseline.

### 4.1 Typed Contracts

The subsystem is modeled through dedicated contracts covering:

- `ScreenCapture`
- `UIElement`
- `UIPerception`
- `InputAction`
- `ComputerUseStep`
- `ComputerUseSession`
- `HumanTakeover`
- `ComputerUseReplayStep`

These contracts should remain the stable integration surface for APIs, state adapters, replay, and verification.

### 4.2 Screenshot Capture

Cross-platform screenshot capture has a real baseline with platform-specific fallbacks:

- Windows via PowerShell-native capture path
- macOS via `screencapture`
- Linux via `gnome-screenshot` / `scrot`
- Playwright fallback for browser-oriented capture paths

### 4.3 Accessibility Baseline

Windows accessibility-tree traversal has a first working implementation, including:

- `UIAutomationClient` traversal
- bounded depth exploration
- normalized role mapping
- interactive-element classification

### 4.3a Browser DOM Perception

Playwright DOM -> `UIElement` mapping has a working implementation, including:

- Chromium headless browser launch with page evaluation
- tag-name-to-role mapping (40+ HTML tags mapped to 26 UIElement roles)
- input-type-specific role resolution (button, checkbox, radio, slider, etc.)
- interactive element detection (interactive tags, onclick, role attributes, tabindex, contenteditable)
- visibility filtering (zero-size, display:none, visibility:hidden, opacity:0)
- bounding box extraction from `getBoundingClientRect()`
- focused element detection
- aria-label / title / alt label extraction
- text content extraction via TreeWalker
- DOM attribute preservation (tag_name, href, input_type, placeholder, dom_id)
- URL-based page navigation with title extraction

### 4.3b OCR Provider SPI

OCR is no longer a placeholder. The subsystem now has a pluggable provider SPI:

- `OCRProvider` interface with `name`, `isAvailable()`, and `extractText()` methods
- `OCRResult` type with `fullText`, `regions[]`, `confidence`, and `processingTimeMs`
- `OCRRegion` type with `text`, `boundingBox`, and `confidence`
- `registerOCRProvider()` / `listOCRProviders()` / `clearOCRProviders()` SPI functions
- automatic provider resolution: iterates registered providers, uses first available
- `WindowsOCRProvider`: uses Windows.Media.Ocr.OcrEngine via PowerShell (WinRT API)
- `TesseractOCRProvider`: uses Tesseract CLI with TSV output for region-level bounding boxes
- `PlaceholderOCRProvider`: fallback when no real provider is available
- OCR regions are mapped to `UIElement` entries with source=ocr, confidence, and provider metadata

### 4.3c Element-Native Action SPI

The subsystem now has a pluggable element action SPI with automatic fallback:

- `ElementActionProvider` interface with `name`, `canHandle()`, and `execute()` methods
- `ElementActionResult` type with `success`, `method`, `provider`, `durationMs`, `error`, and `postCheck`
- `ElementPostCheckResult` type with `elementStillExists`, `elementStillVisible`, `valueChanged`, `focusChanged`, `stateSnapshot`
- `registerElementActionProvider()` / `listElementActionProviders()` / `clearElementActionProviders()` SPI functions
- `resolveElementAction()`: unified resolver with fallback chain (element-native providers -> coordinate fallback)
- `executeElementAction()`: high-level action executor that resolves the best provider and records the result as an InputAction

#### Playwright DOM Element Actions

- `PlaywrightDOMElementActionProvider`: browser DOM-native element interaction
- CSS selector construction from UIElement attributes (dom_id, tag_name, input_type, aria-label, href)
- Actions: click, type (fill), focus, select (selectOption), hover
- DOM post-check: `performDOMPostCheck()` verifies element still exists and is visible after action
- Headful Chromium launch for real browser interaction

#### Windows Accessibility Element Actions

- `WindowsAccessibilityElementActionProvider`: desktop UI-native element interaction via UIAutomationClient
- Element finding by AutomationId, Name, or ClassName property conditions
- Actions: click (InvokePattern), type (ValuePattern or SetFocus+SendKeys), focus (SetFocus), select (SelectionPattern/ExpandCollapsePattern), hover (coordinate move)
- Accessibility post-check: `performAccessibilityPostCheck()` verifies element still exists, visible, and focus state after action

#### Fallback Chain

When `resolveElementAction()` is called, it follows the best-practice fallback order:

1. Try each registered `ElementActionProvider` in order (Playwright DOM first, Windows Accessibility second)
2. If a provider can handle the element and succeeds, return the result
3. If all providers fail, fall back to coordinate-based mouse/keyboard actions using the element's bounding box
4. If no bounding box is available, return a failure result

#### InputAction kind support

- `focus_element`: now implemented — tries element-native focus, falls back to coordinate click
- `select_option`: now implemented — tries element-native select, falls back to coordinate click

### 4.4 Input Execution

Mouse execution baseline is already present for:

- click
- double-click
- right-click
- move
- drag
- scroll

Keyboard execution baseline is already present for:

- key press
- key combo
- text typing
- key alias normalization

### 4.5 Runtime Loop and Human Intervention

The current runtime also includes:

- a `see -> act -> verify -> recover` loop
- retry tracking
- escalation into human takeover
- replay package generation
- replay result tracking
- per-subsystem circuit breakers

### 4.6 State and API Surface

The current runtime has already been connected to:

- dedicated state namespaces
- local control plane endpoints
- module-manifest registration

That means the subsystem is already more than an isolated helper library; it is part of the live desktop runtime surface.

## 5. Current Partial Scope

The current subsystem is not yet complete. The most important partial items are:

- macOS accessibility binding: code-landed with diagnostics and feature detection but unverified on current host (requires macOS to validate)
- Linux AT-SPI accessibility binding: code-landed with diagnostics and feature detection but unverified on current host (requires Linux with AT-SPI to validate)
- Windows OCR provider requires WinRT runtime availability (may not work on all Windows editions)
- Tesseract OCR provider requires Tesseract CLI to be installed separately
- macOS/Linux element action providers support all 5 actions (click/type/focus/select/hover); select uses AT-SPI Selection/Action interfaces and AppleScript select; hover uses xdotool/cliclick/Quartz.CoreGraphics

These gaps matter because they block the runtime from becoming a reliable full computer-use layer instead of a coordinates-first automation baseline.

## 6. Future Target

The future target remains broader than the currently landed baseline.

Important future-target capabilities include:

- ~~screenshot diff and visual verification~~ ✅ (implemented: compareScreenCaptures with exact-hash and sampled-byte-similarity)
- ~~full multi-display support~~ ✅ (implemented: listAvailableDisplays with Windows/macOS/Linux enumeration)
- ~~accessibility-native direct interaction instead of coordinate fallback only~~ ✅ (implemented: macOS and Linux accessibility providers)
- ~~full computer-use session recording and replay~~ ✅ (implemented: generateSessionRecording, exportSessionRecording, frame-based recording with timeline)
- ~~local application control through `local_app.invoke`~~ ✅ (implemented: invokeLocalApp with cross-platform launch/open_file/open_url/send_command, dryRun, capability detection, audit logging)
- ~~display enumeration parity~~ ✅ (implemented: Windows PowerShell, macOS CoreGraphics/system_profiler, Linux xrandr/Gdk)
- ~~platform diagnostics and self-check~~ ✅ (implemented: runComputerUseSelfCheck, detectPlatformFeatures)
- ~~cross-platform app invocation hardening~~ ✅ (implemented: detectLocalAppCapabilities, checkLocalAppAvailability, dryRun, ENOENT detection, audit logging)
- ~~session recording video encoding~~ ✅ (implemented: encodeSessionRecording with FFmpeg MP4/WebM/GIF + PNGSequenceEncoder fallback)
- ~~Firefox and WebKit browser perception support~~ ✅ (implemented: playwright_dom_firefox, playwright_dom_webkit engines with element action providers)
- ~~macOS/Linux select and hover action support via accessibility providers~~ ✅ (implemented: macOS select via AppleScript, macOS hover via cliclick/Quartz/xdotool, Linux select via AT-SPI Selection/Action, Linux hover via xdotool/AT-SPI coordinates)
- OS-level hard sandboxing for computer-use actions

These remain target capabilities until they are wired to real code, verified, and reflected in the current-state documents.

## 7. Provider Matrix

Current and planned provider strategy should stay modular.

| Concern | Current baseline | Best-practice direction |
| --- | --- | --- |
| Screenshot capture | Windows PowerShell, macOS `screencapture`, Linux `gnome-screenshot` / `scrot`, Playwright fallback | Keep native capture first, maintain browser fallback only as a scoped provider |
| Screenshot diff | Exact-hash and sampled-byte-similarity comparison via compareScreenCaptures | Add perceptual hashing and structural diff for more robust visual verification |
| OCR | Provider SPI with Windows OCR and Tesseract defaults | Keep SPI pluggable, add cloud vision providers as optional stronger providers |
| Accessibility | Windows baseline, macOS (code-landed with diagnostics), Linux AT-SPI (code-landed with diagnostics) | Validate macOS/Linux on target platforms, expand action vocabulary |
| Browser perception | Playwright DOM -> UIElement mapping for Chromium, Firefox, and WebKit | Prefer DOM-native interaction over coordinate clicks, validate cross-browser consistency |
| Mouse action | Cross-platform baseline exists | Keep native low-level executors as fallback and verification-aware action drivers |
| Keyboard action | Cross-platform baseline exists | Keep native executors and normalize combos, aliases, and escape rules |
| Element-native actions | Playwright DOM (Chromium/Firefox/WebKit) + Windows UIAutomation + macOS Accessibility + Linux AT-SPI providers with fallback chain | Validate macOS/Linux providers, expand action vocabulary (select, hover) |
| Local app invoke | Cross-platform invokeLocalApp with launch/open_file/open_url/send_command, dryRun, capability detection, audit logging | Add process monitoring, app window targeting, and richer interaction |
| Multi-display | Windows/macOS/Linux enumeration via listAvailableDisplays | Keep cross-platform, add per-display DPI awareness |
| Session recording | generateSessionRecording + exportSessionRecording + frame-based recording + encodeSessionRecording (FFmpeg MP4/WebM/GIF + PNGSequenceEncoder fallback) | Add real-time streaming, timeline scrubbing, annotation |
| Verification evidence | ComputerUseVerificationEvidence with confidence scoring, state diff, screenshot diff | Add ML-based visual verification, anomaly detection |
| Video encoding | FFmpegVideoEncoder (MP4/WebM/GIF) + PNGSequenceEncoder fallback + VideoEncoder SPI | Add hardware-accelerated encoding, adaptive bitrate |

## 8. Best-Practice Fallback Order

The runtime should not behave like a naive coordinate bot.

The preferred execution order is:

1. direct structured target resolution
   - known task target
   - known element id
   - known app or workspace handle
2. DOM-native interaction
   - for browser-visible targets
3. accessibility-native interaction
   - for desktop UI where semantic handles exist
4. OCR-assisted targeting
   - only when semantic structure is weak or absent
5. coordinate-based mouse and keyboard fallback
6. verification
7. recovery
8. human takeover

This ordering is best practice because it optimizes:

- stability
- maintainability
- replay fidelity
- reduced hallucinated actions
- lower sensitivity to small layout shifts

## 9. Verification Model

`Computer Use Runtime` must stay verification-driven.

Successful execution should increasingly rely on:

- post-action screenshot checks
- DOM post-condition checks
- accessibility post-condition checks
- confidence scoring
- mismatch tracing
- retry and recover escalation

The runtime should never treat raw action dispatch alone as sufficient proof of task completion.

## 10. Safety Boundary

The subsystem must operate inside a stronger safety boundary than ordinary local tools because it can directly manipulate a live workstation.

Core safety principles:

- computer-use actions must stay auditable
- actions must remain interruptible
- human takeover must always be available
- high-risk actions should remain policy-gated
- replay must be evidence-oriented, not just debugging-oriented
- computer-use execution should link to sandbox lease and permission state wherever applicable

The system should preserve a clear separation between:

- perception
- decision
- action
- verification
- recovery
- operator takeover

That separation is essential for debugging, safe interruption, and future hard-sandbox evolution.

## 11. Current Best Implementation Order

For the current desktop-first phase, the highest-value landing order remains:

1. perception completion
   - ~~Playwright DOM -> `UIElement`~~ ✅
   - ~~OCR provider SPI~~ ✅
   - ~~local default OCR implementation~~ ✅
2. element-native actions
   - ~~Windows accessibility direct actions~~ ✅
   - ~~Playwright DOM element actions~~ ✅
   - ~~action fallback ordering~~ ✅
   - ~~DOM/accessibility post-check~~ ✅
3. verification upgrade
   - ~~screenshot diff~~ ✅
   - ~~visual verification~~ ✅
   - ~~DOM/accessibility post-check upgrade~~ ✅
   - ~~confidence scoring~~ ✅
   - ~~verification evidence integration~~ ✅
4. desktop usability upgrade
   - ~~multi-display support~~ ✅
   - ~~richer replay~~ ✅
   - ~~session recording~~ ✅
   - ~~local app invoke~~ ✅
5. cross-platform parity
   - ~~macOS accessibility~~ ✅ (code-landed, unverified on current host)
   - ~~Linux AT-SPI~~ ✅ (code-landed, unverified on current host)

Only after that layer is mature should the project shift major effort into the next desktop-safety phase:

- OS-level hard sandboxing

## 12. Relationship To Other Documents

Use this document together with:

- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
  - machine-control permissions and staged local-control rollout
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)
  - operator-facing task workspace and intervention UX
- [`./verification-and-completion.md`](./verification-and-completion.md)
  - completion, verifier, evidence, and done-gate model
- [`./task-lifecycle-and-interruption.md`](./task-lifecycle-and-interruption.md)
  - stop, resume, checkpoints, and interruption semantics
- [`./current-architecture-status.md`](./current-architecture-status.md)
  - authoritative current `implemented / partial / not implemented` boundary map

## 13. Maintenance Rule

This document should be updated whenever any of the following changes:

- computer-use contracts
- provider coverage
- fallback order
- verification method
- safety boundary
- implemented / partial / future-target status

It should stay focused on the computer-use subsystem and should not be overloaded with unrelated cloud-orchestration or team-control concerns.
