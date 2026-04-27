# GLM-5.1 Computer Use Completion Spec

This document is the dedicated execution handoff for finishing the remaining `Computer Use Runtime` work without repeatedly stopping for replanning.

Use this document together with:

- [`./glm-5.1-architecture-execution-spec.md`](./glm-5.1-architecture-execution-spec.md)
- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

## 1. Objective

Finish the remaining `Computer Use Runtime` capabilities for the desktop-first local product without switching the core runtime skeleton away from:

- `typed runtime`
- `shared-runtime`
- `local control plane`

Do not introduce `DeerFlow` or `LangGraph` as the current local runtime backbone.

## 2. Already Landed Baseline

The following are already considered landed and should be treated as the current baseline, not re-planned from scratch:

- screenshot capture baseline
- Windows accessibility tree baseline
- Playwright DOM -> `UIElement` perception baseline
- OCR provider SPI and local default OCR path
- mouse and keyboard executors
- element-native action SPI
- Playwright DOM element actions
- Windows UIAutomation direct actions
- element action resolver and coordinate fallback
- `see -> act -> verify -> recover`
- replay package baseline
- human takeover baseline
- circuit breakers
- local control plane computer-use endpoints
- screenshot diff / visual verification (compareScreenCaptures with exact-hash and sampled-byte-similarity)
- structured verification evidence (ComputerUseVerificationEvidence with confidence scoring, state diff, screenshot diff)
- confidence scoring (computeConfidenceScore with multi-signal weighted scoring)
- verification evidence integration in executeElementAction, runSeeActVerifyRecoverLoop, and replay packages
- multi-display support (listAvailableDisplays with Windows PowerShell enumeration)
- session recording (generateSessionRecording, exportSessionRecording)
- local app invoke (invokeLocalApp with cross-platform launch/open_file/open_url/send_command)
- macOS accessibility binding (buildMacOSAccessibilityTree, MacOSAccessibilityElementActionProvider)
- Linux AT-SPI binding (buildLinuxAccessibilityTree, LinuxATSPIElementActionProvider)

The next work is not “start computer use”; it is “finish the remaining layers”.

## 3. Non-Negotiable Rules

- Do not stop after a single feature unless a true blocker is reached.
- Do not regress the local-first desktop architecture.
- Do not reframe the work as cloud-first orchestration.
- Do not replace current typed contracts with framework-native graph contracts.
- Do not claim a feature is implemented if only the interface exists.
- Do not skip verification or documentation updates.
- Do not ignore current `implemented / partial / future target` boundaries.

## 4. Remaining Work Order

The remaining work must be completed in this order.

### 4.1 Wave 3: Verification Upgrade ✅ COMPLETED

Land all remaining verification-layer work first.

Required scope:

- ~~DOM post-check upgrade from simple existence checks to structured state diff~~ ✅
- ~~accessibility post-check upgrade from simple existence checks to structured state diff~~ ✅
- ~~unified confidence scoring~~ ✅
- ~~lightweight screenshot diff / visual verification~~ ✅
- ~~connect verification evidence back into:~~ ✅
  - ~~`runSeeActVerifyRecoverLoop`~~ ✅
  - ~~replay package~~ ✅
  - ~~human takeover escalation~~ ✅
  - ~~evidence / verifier-facing outputs~~ ✅

Minimum expected artifacts:

- ~~richer verification data in runtime types or runtime-owned evidence structures~~ ✅
- ~~explicit mismatch reasons~~ ✅
- ~~provider / method / fallback trace~~ ✅
- ~~verification-aware replay payloads~~ ✅

### 4.2 Wave 4: Desktop Usability Upgrade ✅ COMPLETED

After wave 3 is truly landed, continue to desktop usability features.

Required scope:

- ~~multi-display support~~ ✅
- ~~richer replay payloads~~ ✅
- ~~session recording or session-recording-ready artifact generation~~ ✅
- ~~`local_app.invoke` implementation~~ ✅

Notes:

- session recording architecture and artifact generation are landed; full video recording is a future target
- `local_app.invoke` is a real runtime capability with cross-platform support (Windows, macOS, Linux)

### 4.3 Wave 5: Cross-Platform Parity ✅ COMPLETED (code-landed, platform validation pending)

After wave 4, continue to platform parity.

Required scope:

- ~~macOS accessibility binding~~ ✅ (code-landed, unverified on current host)
- ~~Linux AT-SPI binding~~ ✅ (code-landed, unverified on current host)
- ~~element-native action support for those providers where feasible~~ ✅ (click/type/focus supported)

Notes:

- macOS and Linux providers are code-landed with full provider structure, contracts, and best-effort implementation
- select and hover actions are not yet supported on macOS/Linux accessibility providers
- these providers require their respective platforms to fully validate
- comprehensive diagnostics available: runMacOSAccessibilityDiagnostics, runLinuxATSPIDiagnostics

### 4.4 Wave 6: Browser Perception Parity ✅ COMPLETED

- ~~Firefox DOM perception~~ ✅ (implemented: playwright_dom_firefox engine, PlaywrightFirefoxElementActionProvider)
- ~~WebKit DOM perception~~ ✅ (implemented: playwright_dom_webkit engine, PlaywrightWebKitElementActionProvider)
- ~~browser engine availability detection~~ ✅ (implemented: detectBrowserEngineAvailability)
- normalization parity with Chromium (same DOM → UIElement mapping, same role/tag/attribute extraction)

### 4.5 Wave 7: Video Encoding ✅ COMPLETED

- ~~session recording video encoding~~ ✅ (implemented: encodeSessionRecording)
- ~~FFmpeg encoder (MP4/WebM/GIF)~~ ✅ (implemented: FFmpegVideoEncoder)
- ~~PNG sequence fallback encoder~~ ✅ (implemented: PNGSequenceEncoder)
- ~~VideoEncoder SPI~~ ✅ (implemented: registerVideoEncoder, listVideoEncoders)
- recording_metadata.json written alongside encoded output

## 5. Completion Rule

The work should continue until one of the following is true:

1. all remaining `Computer Use Runtime` items above are implemented and documented
2. only true platform- or environment-specific blockers remain
3. a change would violate the current architecture constitution or local safety boundary

Do not stop merely because a feature is large.

## 6. Required Output Per Round

For each implementation round, report:

1. current wave and target
2. files changed
3. what moved from `partial` to `implemented`
4. what remains truly blocked
5. verification results
6. next item started immediately after that

## 7. Documentation Requirements

Every time behavior changes, update at least:

- [`./computer-use-runtime.md`](./computer-use-runtime.md)
- [`./current-architecture-status.md`](./current-architecture-status.md)

Update other documents when relevant:

- [`./verification-and-completion.md`](./verification-and-completion.md)
- [`./local-permission-and-tooling.md`](./local-permission-and-tooling.md)
- [`./desktop-workspace-ui.md`](./desktop-workspace-ui.md)

## 8. Final Boundary

This completion spec is about finishing the remaining local desktop `Computer Use Runtime`.

It is not a request to:

- prioritize cloud control plane
- integrate `LangGraph` as the local runtime core
- replace SQLite-first local execution with cloud-first infrastructure
- stop after wave 3 if wave 4 and wave 5 are still pending
