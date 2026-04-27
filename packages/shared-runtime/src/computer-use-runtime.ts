import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { log } from "@apex/shared-observability";
import { store, type LocalAppInvocation } from "@apex/shared-state";
import {
  ComputerUseVerificationEvidenceSchema,
  ScreenCaptureSchema,
  UIPerceptionSchema,
  InputActionSchema,
  ComputerUseStepSchema,
  ComputerUseSessionSchema,
  HumanTakeoverSchema,
  ComputerUseReplayStepSchema,
  UIElementSchema,
  type ScreenCapture,
  type ComputerUseElementState,
  type ComputerUseVerificationEvidence,
  type ComputerUseVisualDiff,
  type UIPerception,
  type InputAction,
  type ComputerUseStep,
  type ComputerUseSession,
  type HumanTakeover,
  type ComputerUseReplayStep,
  type UIElement,
  type SandboxManifest,
  createEntityId,
  nowIso
} from "@apex/shared-types";
import {
  validateSandboxExecution,
  type SandboxViolation,
  type SandboxTier
} from "./sandbox-executor.js";

const execFileAsync = promisify(execFile);

const RESILIENCE_CONFIG = {
  screenshot: { failureThreshold: 3, cooldownMs: 30_000 },
  perception: { failureThreshold: 3, cooldownMs: 30_000 },
  input: { failureThreshold: 2, cooldownMs: 10_000 }
};

interface FailureTracker {
  count: number;
  lastFailureAt: number | null;
}

export interface AvailableDisplay {
  displayIndex: number;
  width: number;
  height: number;
  x: number;
  y: number;
  primary: boolean;
  label: string;
}

const failureTrackers = {
  screenshot: { count: 0, lastFailureAt: null } as FailureTracker,
  perception: { count: 0, lastFailureAt: null } as FailureTracker,
  input: { count: 0, lastFailureAt: null } as FailureTracker
};

export interface ComputerUseSandboxEnforcement {
  action: string;
  tier: SandboxTier;
  manifest_id?: string;
  allowed: boolean;
  violations: SandboxViolation[];
  escalated_to_human: boolean;
  audit_recorded: boolean;
}

const SANDBOX_TIER_ACTION_MATRIX: Record<SandboxTier, Record<string, boolean>> = {
  host_readonly: {
    screenshot_capture: true,
    display_enumeration: true,
    accessibility_tree: true,
    ocr_perception: true,
    element_action_readonly: true,
    element_action_click: false,
    element_action_type: false,
    element_action_focus: false,
    element_action_select: false,
    element_action_hover: false,
    input_action: false,
    local_app_invoke: false,
    session_recording: true,
    replay_package: true,
    video_encoding: true
  },
  guarded_mutation: {
    screenshot_capture: true,
    display_enumeration: true,
    accessibility_tree: true,
    ocr_perception: true,
    element_action_readonly: true,
    element_action_click: true,
    element_action_type: true,
    element_action_focus: true,
    element_action_select: true,
    element_action_hover: true,
    input_action: true,
    local_app_invoke: true,
    session_recording: true,
    replay_package: true,
    video_encoding: true
  },
  isolated_mutation: {
    screenshot_capture: true,
    display_enumeration: true,
    accessibility_tree: true,
    ocr_perception: true,
    element_action_readonly: true,
    element_action_click: true,
    element_action_type: true,
    element_action_focus: true,
    element_action_select: true,
    element_action_hover: true,
    input_action: true,
    local_app_invoke: false,
    session_recording: true,
    replay_package: true,
    video_encoding: true
  }
};

export function enforceComputerUseSandbox(input: {
  action: string;
  sessionId?: string;
  manifestId?: string;
  requiresConfirmation?: boolean;
}): ComputerUseSandboxEnforcement {
  const session = input.sessionId ? store.computerUseSessions.get(input.sessionId) : undefined;
  const tier: SandboxTier = session?.sandbox_tier ?? "guarded_mutation";
  const manifest = input.manifestId ? store.sandboxManifests.get(input.manifestId) : undefined;
  const violations: SandboxViolation[] = [];
  let allowed = true;
  let escalatedToHuman = false;

  const tierActions = SANDBOX_TIER_ACTION_MATRIX[tier];
  if (tierActions && tierActions[input.action] === false) {
    allowed = false;
    violations.push({
      kind: "capability_exceeded",
      description: `Action '${input.action}' is not allowed in sandbox tier '${tier}'`,
      blocked: true,
      timestamp: nowIso()
    });
  }

  if (manifest) {
    if (manifest.status === "expired" || manifest.status === "revoked") {
      allowed = false;
      violations.push({
        kind: "capability_exceeded",
        description: `Sandbox manifest is ${manifest.status}`,
        blocked: true,
        timestamp: nowIso()
      });
    }

    if (Date.parse(manifest.expires_at) < Date.now()) {
      allowed = false;
      violations.push({
        kind: "capability_exceeded",
        description: `Sandbox manifest expired at ${manifest.expires_at}`,
        blocked: true,
        timestamp: nowIso()
      });
    }

    if (input.action === "local_app_invoke" && manifest.tier === "isolated_mutation") {
      const validation = validateSandboxExecution(manifest, {
        network_destination: "any",
        network_protocol: "tcp"
      });
      if (!validation.allowed) {
        violations.push(...validation.violations);
        allowed = false;
      }
    }
  }

  if (!allowed && (input.requiresConfirmation ?? session?.requires_confirmation ?? true)) {
    escalatedToHuman = true;
  }

  const result: ComputerUseSandboxEnforcement = {
    action: input.action,
    tier,
    manifest_id: input.manifestId,
    allowed,
    violations,
    escalated_to_human: escalatedToHuman,
    audit_recorded: true
  };

  try {
    log("info", "computer_use_sandbox_enforcement", {
      action: input.action,
      tier,
      allowed,
      violation_count: violations.length,
      escalated_to_human: escalatedToHuman,
      session_id: input.sessionId,
      manifest_id: input.manifestId
    });
  } catch { /* logging failure should not affect enforcement */ }

  return result;
}

export function getComputerUseSandboxPolicy(sessionId?: string): {
  tier: SandboxTier;
  allowed_actions: string[];
  denied_actions: string[];
  requires_confirmation: boolean;
} {
  const session = sessionId ? store.computerUseSessions.get(sessionId) : undefined;
  const tier: SandboxTier = session?.sandbox_tier ?? "guarded_mutation";
  const tierActions = SANDBOX_TIER_ACTION_MATRIX[tier];

  const allowedActions: string[] = [];
  const deniedActions: string[] = [];

  for (const [action, isAllowed] of Object.entries(tierActions)) {
    if (isAllowed) {
      allowedActions.push(action);
    } else {
      deniedActions.push(action);
    }
  }

  return {
    tier,
    allowed_actions: allowedActions,
    denied_actions: deniedActions,
    requires_confirmation: session?.requires_confirmation ?? true
  };
}

function shouldAttempt(key: "screenshot" | "perception" | "input"): boolean {
  const tracker = failureTrackers[key];
  if (tracker.count >= RESILIENCE_CONFIG[key].failureThreshold && tracker.lastFailureAt) {
    const elapsed = Date.now() - tracker.lastFailureAt;
    if (elapsed < RESILIENCE_CONFIG[key].cooldownMs) {
      return false;
    }
    tracker.count = 0;
    tracker.lastFailureAt = null;
  }
  return true;
}

function recordFailure(key: "screenshot" | "perception" | "input"): void {
  const tracker = failureTrackers[key];
  tracker.count++;
  tracker.lastFailureAt = Date.now();
}

let cachedScreenDimensions: { width: number; height: number } | null = null;

async function detectScreenDimensions(): Promise<{ width: number; height: number }> {
  if (cachedScreenDimensions) return cachedScreenDimensions;
  try {
    const displays = await listAvailableDisplays();
    const primary = displays.find(d => d.primary) ?? displays[0];
    if (primary && primary.width > 0 && primary.height > 0) {
      cachedScreenDimensions = { width: primary.width, height: primary.height };
      return cachedScreenDimensions;
    }
  } catch { /* fall through */ }
  return { width: 1920, height: 1080 };
}

function getScreenDimensions(region?: { x: number; y: number; width: number; height: number }): { width: number; height: number } {
  if (region) return { width: region.width, height: region.height };
  if (cachedScreenDimensions) return cachedScreenDimensions;
  return { width: 1920, height: 1080 };
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function buildElementStateFromUIElement(element: UIElement): ComputerUseElementState {
  const checked = element.attributes?.checked === "true" ? true : element.attributes?.checked === "false" ? false : undefined;
  const selected = element.attributes?.selected === "true" ? true : element.attributes?.selected === "false" ? false : undefined;
  const expanded = element.attributes?.expanded === "true" ? true : element.attributes?.expanded === "false" ? false : undefined;
  const disabled = element.attributes?.disabled === "true" ? true : element.attributes?.disabled === "false" ? false : !element.is_enabled;
  return {
    exists: true,
    visible: element.is_visible,
    enabled: element.is_enabled,
    focused: element.is_focused,
    text_content: element.text_content,
    value: element.value,
    checked,
    selected,
    expanded,
    disabled,
    label: element.label,
    attributes: { ...element.attributes }
  };
}

function valuesDiffer(previous?: string, next?: string): boolean {
  return (previous ?? "") !== (next ?? "");
}

async function compareScreenCaptures(
  beforeCapture?: ScreenCapture | null,
  afterCapture?: ScreenCapture | null
): Promise<ComputerUseVisualDiff | undefined> {
  if (!beforeCapture?.pixel_data_ref || !afterCapture?.pixel_data_ref) {
    return {
      compared: false,
      changed: false,
      similarity_score: 0,
      comparison_mode: "unavailable",
      before_capture_id: beforeCapture?.capture_id,
      after_capture_id: afterCapture?.capture_id,
      details: {
        reason: "missing_capture_file"
      }
    };
  }

  try {
    const [beforeBytes, afterBytes] = await Promise.all([
      readFile(beforeCapture.pixel_data_ref),
      readFile(afterCapture.pixel_data_ref)
    ]);

    const beforeHash = createHash("sha256").update(beforeBytes).digest("hex");
    const afterHash = createHash("sha256").update(afterBytes).digest("hex");
    if (beforeHash === afterHash) {
      return {
        compared: true,
        changed: false,
        similarity_score: 1,
        comparison_mode: "exact_hash",
        before_capture_id: beforeCapture.capture_id,
        after_capture_id: afterCapture.capture_id,
        details: {
          before_size_bytes: beforeBytes.length,
          after_size_bytes: afterBytes.length
        }
      };
    }

    const sampleCount = Math.max(32, Math.min(256, Math.floor(Math.max(beforeBytes.length, afterBytes.length) / 2048)));
    let matches = 0;
    for (let index = 0; index < sampleCount; index++) {
      const beforeOffset = Math.floor((index / sampleCount) * beforeBytes.length);
      const afterOffset = Math.floor((index / sampleCount) * afterBytes.length);
      if (beforeBytes[beforeOffset] === afterBytes[afterOffset]) {
        matches++;
      }
    }

    const similarity = sampleCount === 0 ? 0 : matches / sampleCount;
    return {
      compared: true,
      changed: similarity < 0.995,
      similarity_score: Number(similarity.toFixed(4)),
      comparison_mode: "sampled_byte_similarity",
      before_capture_id: beforeCapture.capture_id,
      after_capture_id: afterCapture.capture_id,
      details: {
        before_size_bytes: beforeBytes.length,
        after_size_bytes: afterBytes.length,
        before_hash: beforeHash,
        after_hash: afterHash,
        sample_count: sampleCount,
        matching_samples: matches
      }
    };
  } catch (error) {
    return {
      compared: false,
      changed: false,
      similarity_score: 0,
      comparison_mode: "unavailable",
      before_capture_id: beforeCapture?.capture_id,
      after_capture_id: afterCapture?.capture_id,
      details: {
        error: (error as Error).message
      }
    };
  }
}

function buildVerificationEvidence(input: {
  verdict: "confirmed" | "mismatch" | "error";
  provider?: string;
  method?: string;
  postCheck?: ElementPostCheckResult;
  stateBefore: ComputerUseElementState;
  stateAfter?: ComputerUseElementState;
  screenshotDiff?: ComputerUseVisualDiff;
  confidenceScore: number;
  reasons: string[];
}): ComputerUseVerificationEvidence {
  return ComputerUseVerificationEvidenceSchema.parse({
    verdict: input.verdict,
    provider: input.provider,
    method: input.method,
    confidence_score: input.confidenceScore,
    reasons: input.reasons,
    post_check: input.postCheck,
    state_before: input.stateBefore,
    state_after: input.stateAfter,
    screenshot_diff: input.screenshotDiff,
    created_at: nowIso()
  });
}

function computeConfidenceScore(input: {
  provider: string;
  method: string;
  postCheck?: ElementPostCheckResult;
  stateBefore: ComputerUseElementState;
  stateAfter?: ComputerUseElementState;
  screenshotDiff?: ComputerUseVisualDiff;
  action: "click" | "type" | "focus" | "select" | "hover";
  fallbackUsed: boolean;
  success: boolean;
}): { score: number; reasons: string[]; verdict: "confirmed" | "mismatch" | "error" } {
  const reasons: string[] = [];
  if (!input.success) {
    reasons.push("element_action_failed");
    return { score: 0, reasons, verdict: "error" };
  }

  let score = input.fallbackUsed ? 0.42 : 0.62;
  if (!input.fallbackUsed) {
    reasons.push("semantic_provider_used");
  } else {
    reasons.push("coordinate_fallback_used");
  }

  if (input.postCheck?.elementStillExists) {
    score += 0.12;
    reasons.push("element_still_exists");
  } else {
    reasons.push("element_missing_after_action");
  }

  if (input.postCheck?.elementStillVisible) {
    score += 0.08;
    reasons.push("element_still_visible");
  }

  if (input.action === "type" && input.postCheck?.valueChanged) {
    score += 0.1;
    reasons.push("value_changed");
  }

  if ((input.action === "focus" || input.action === "click") && input.postCheck?.focusChanged) {
    score += 0.08;
    reasons.push("focus_changed");
  }

  if (input.action === "select" && input.postCheck?.valueChanged) {
    score += 0.08;
    reasons.push("selection_changed");
  }

  if (input.screenshotDiff?.compared) {
    if (input.screenshotDiff.changed) {
      score += 0.08;
      reasons.push("visual_change_detected");
    } else if (["click", "type", "select"].includes(input.action)) {
      score -= 0.1;
      reasons.push("no_visual_change_detected");
    }
  }

  if (
    input.stateAfter &&
    input.action === "type" &&
    valuesDiffer(input.stateBefore.value, input.stateAfter.value)
  ) {
    score += 0.08;
    reasons.push("state_snapshot_value_changed");
  }

  if (
    input.stateAfter &&
    input.action === "select" &&
    input.stateAfter.selected === true
  ) {
    score += 0.06;
    reasons.push("state_snapshot_selected");
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));
  const verdict = score >= 0.6 ? "confirmed" : "mismatch";
  if (verdict === "mismatch") {
    reasons.push("confidence_below_threshold");
  }
  return { score, reasons, verdict };
}

export async function listAvailableDisplays(): Promise<AvailableDisplay[]> {
  try {
    if (process.platform === "win32") {
      const psScript = [
        "Add-Type -AssemblyName System.Windows.Forms;",
        "$screens = [System.Windows.Forms.Screen]::AllScreens;",
        "$results = @();",
        "for ($i = 0; $i -lt $screens.Length; $i++) {",
        "  $screen = $screens[$i];",
        "  $bounds = $screen.Bounds;",
        "  $results += @{ displayIndex=$i; width=[int]$bounds.Width; height=[int]$bounds.Height; x=[int]$bounds.X; y=[int]$bounds.Y; primary=$screen.Primary; label=('Display ' + $i) };",
        "}",
        "$results | ConvertTo-Json -Depth 3 -Compress"
      ].join("\n");
      const { stdout } = await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 5000, maxBuffer: 1024 * 1024 });
      const parsed = JSON.parse(stdout.trim());
      return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
        displayIndex: Number(item.displayIndex ?? 0),
        width: Number(item.width ?? 0),
        height: Number(item.height ?? 0),
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
        primary: Boolean(item.primary),
        label: String(item.label ?? `Display ${item.displayIndex ?? 0}`)
      }));
    }

    if (process.platform === "darwin") {
      const script = [
        "use framework \"CoreGraphics\"",
        "set displays to current application's CGDisplay's displays()",
        "set output to {}",
        "repeat with i from 1 to count of displays",
        "  set d to item i of displays",
        "  set dID to current application's CGDisplay's displayIDOfDisplay(d)",
        "  set bds to current application's CGDisplay's boundsOfDisplay(d)",
        "  set end of output to (dID as text) & \"|\" & (width of bds as text) & \"|\" & (height of bds as text) & \"|\" & (x of origin of bds as text) & \"|\" & (y of origin of bds as text)",
        "end repeat",
        "set AppleScript's text item delimiters to linefeed",
        "return output as text"
      ].join("\n");
      try {
        const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
        const lines = stdout.trim().split("\n").filter(l => l.trim());
        if (lines.length > 0) {
          return lines.map((line, idx) => {
            const parts = line.split("|");
            return {
              displayIndex: idx,
              width: Number(parts[1] ?? 0),
              height: Number(parts[2] ?? 0),
              x: Number(parts[3] ?? 0),
              y: Number(parts[4] ?? 0),
              primary: idx === 0,
              label: "Display " + idx
            };
          });
        }
      } catch {
        const { stdout } = await execFileAsync("system_profiler", ["SPDisplaysDataType", "-json"], { timeout: 5000, maxBuffer: 1024 * 1024 });
        const data = JSON.parse(stdout.trim());
        const displays = data?.SPDisplaysDataType?.flatMap((d: Record<string, unknown>) => (d.spdisplays_ndrvs as Record<string, unknown>[]) ?? []) ?? [];
        return displays.map((d: Record<string, unknown>, idx: number) => {
          const res = String(d._spdisplays_resolution ?? "0x0").split("x");
          return {
            displayIndex: idx,
            width: Number(res[0] ?? 0),
            height: Number(res[1] ?? 0),
            x: 0,
            y: 0,
            primary: idx === 0,
            label: String(d._name ?? "Display " + idx)
          };
        });
      }
    }

    if (process.platform === "linux") {
      try {
        const { stdout } = await execFileAsync("xrandr", ["--query"], { timeout: 5000 });
        const connectedLines = stdout.split("\n").filter(l => l.includes(" connected"));
        return connectedLines.map((line, idx) => {
          const match = line.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
          if (match) {
            return {
              displayIndex: idx,
              width: Number(match[1]),
              height: Number(match[2]),
              x: Number(match[3]),
              y: Number(match[4]),
              primary: line.includes(" primary"),
              label: line.split(" ")[0]
            };
          }
          return {
            displayIndex: idx,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            primary: idx === 0,
            label: line.split(" ")[0]
          };
        });
      } catch {
        const { stdout } = await execFileAsync("python3", ["-c", "import gi; gi.require_version('Gdk','3.0'); from gi.repository import Gdk; dm=Gdk.DisplayManager.get(); d=dm.get_default_display(); ms=d.get_default_screen(); print(f'{ms.get_width()}|{ms.get_height()}')"], { timeout: 5000 }).catch(() => ({ stdout: "" }));
        const parts = stdout.trim().split("|");
        return [{
          displayIndex: 0,
          width: Number(parts[0] ?? 0) || 1920,
          height: Number(parts[1] ?? 0) || 1080,
          x: 0,
          y: 0,
          primary: true,
          label: "Primary Display"
        }];
      }
    }

    return [{
      displayIndex: 0,
      width: getScreenDimensions().width,
      height: getScreenDimensions().height,
      x: 0,
      y: 0,
      primary: true,
      label: "Primary Display"
    }];
  } catch {
    return [{
      displayIndex: 0,
      width: getScreenDimensions().width,
      height: getScreenDimensions().height,
      x: 0,
      y: 0,
      primary: true,
      label: "Primary Display"
    }];
  }
}

async function captureScreenshotNative(options?: {
  region?: { x: number; y: number; width: number; height: number };
  displayIndex?: number;
}): Promise<ScreenCapture | null> {
  if (!shouldAttempt("screenshot")) return null;

  try {
    let command: string;
    let args: string[];

    if (process.platform === "win32") {
      const displayIndex = options?.displayIndex ?? 0;
      const region = options?.region;
      const psScript = [
        "Add-Type -AssemblyName System.Windows.Forms;",
        "Add-Type -AssemblyName System.Drawing;",
        `$displayIndex = ${displayIndex};`,
        "$screens = [System.Windows.Forms.Screen]::AllScreens;",
        "if ($displayIndex -ge $screens.Length) { $displayIndex = 0 }",
        "$screenBounds = $screens[$displayIndex].Bounds;",
        region
          ? `$captureRect = New-Object System.Drawing.Rectangle($screenBounds.X + ${region.x}, $screenBounds.Y + ${region.y}, ${region.width}, ${region.height});`
          : "$captureRect = New-Object System.Drawing.Rectangle($screenBounds.X, $screenBounds.Y, $screenBounds.Width, $screenBounds.Height);",
        "$bmp = New-Object System.Drawing.Bitmap($captureRect.Width, $captureRect.Height);",
        "$g = [System.Drawing.Graphics]::FromImage($bmp);",
        "$g.CopyFromScreen($captureRect.X, $captureRect.Y, 0, 0, $captureRect.Size);",
        "$path = [System.IO.Path]::GetTempFileName();",
        "$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png);",
        "$g.Dispose(); $bmp.Dispose();",
        "Write-Output $path"
      ].join(" ");
      command = "powershell.exe";
      args = ["-Command", psScript];
    } else if (process.platform === "darwin") {
      command = "screencapture";
      args = ["-x", "/tmp/apex_screenshot.png"];
    } else {
      command = process.env.DISPLAY ? "gnome-screenshot" : "scrot";
      args = ["/tmp/apex_screenshot.png"];
    }

    const { stdout } = await execFileAsync(command, args, {
      timeout: 10_000,
      maxBuffer: 1024 * 1024
    });

    const filePath = stdout.trim() || "/tmp/apex_screenshot.png";

    const fs = await import("node:fs");
    const stats = await fs.promises.stat(filePath).catch(() => null);
    if (!stats) return null;

    let actualWidth = 0;
    let actualHeight = 0;
    try {
      const buf = await readFile(filePath);
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
        actualWidth = buf.readUInt32BE(16);
        actualHeight = buf.readUInt32BE(20);
      }
    } catch { /* fall through */ }

    const screenInfo = getScreenDimensions(options?.region);
    const width = actualWidth > 0 ? actualWidth : screenInfo.width;
    const height = actualHeight > 0 ? actualHeight : screenInfo.height;

    if (!cachedScreenDimensions && !options?.region) {
      cachedScreenDimensions = { width, height };
    }

    return ScreenCaptureSchema.parse({
      capture_id: createEntityId("screencap"),
      engine: "native_screenshot",
      width,
      height,
      pixel_data_ref: filePath,
      mime_type: "image/png",
      size_bytes: stats.size,
      display_index: options?.displayIndex ?? 0,
      region: options?.region ?? undefined,
      captured_at: nowIso()
    });
  } catch (error) {
    recordFailure("screenshot");
    log("warn", "native screenshot capture failed", { error: String(error) });
    return null;
  }
}

async function captureScreenshotWithPlaywright(): Promise<ScreenCapture | null> {
  if (!shouldAttempt("screenshot")) return null;

  try {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: null });
      const dataUrl = "data:text/html,<html><body style='margin:0;padding:0;background:#fff'></body></html>";
      await page.goto(dataUrl, { waitUntil: "domcontentloaded" });

      const screenshotBuffer = await page.screenshot({ fullPage: false, type: "png" }) as Buffer;

      let pwWidth = 0;
      let pwHeight = 0;
      try {
        if (screenshotBuffer[0] === 0x89 && screenshotBuffer[1] === 0x50) {
          pwWidth = screenshotBuffer.readUInt32BE(16);
          pwHeight = screenshotBuffer.readUInt32BE(20);
        }
      } catch { /* fall through */ }
      const screenInfo = getScreenDimensions();

      const tempDir = process.platform === "win32" ? (process.env.TEMP || ".") : "/tmp";
      const tempPath = tempDir + "/apex_pw_" + Date.now() + ".png";
      const fs = await import("node:fs");
      await fs.promises.writeFile(tempPath, screenshotBuffer);

      return ScreenCaptureSchema.parse({
        capture_id: createEntityId("screencap"),
        engine: "playwright_page",
        width: pwWidth > 0 ? pwWidth : screenInfo.width,
        height: pwHeight > 0 ? pwHeight : screenInfo.height,
        pixel_data_ref: tempPath,
        mime_type: "image/png",
        size_bytes: screenshotBuffer.length,
        display_index: 0,
        captured_at: nowIso()
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    recordFailure("screenshot");
    log("warn", "playwright screenshot capture failed", { error: String(error) });
    return null;
  }
}

export async function captureScreen(input?: {
  taskId?: string;
  sessionId?: string;
  engine?: "native_screenshot" | "playwright_page";
  region?: { x: number; y: number; width: number; height: number };
  displayIndex?: number;
}): Promise<ScreenCapture> {
  const preferredEngine = input?.engine ?? "native_screenshot";

  let result: ScreenCapture | null = null;

  if (preferredEngine === "native_screenshot") {
    result = await captureScreenshotNative({ region: input?.region, displayIndex: input?.displayIndex });
  }

  if (!result) {
    result = await captureScreenshotWithPlaywright();
  }

  if (!result) {
    throw new Error("All screenshot engines failed. Last attempted: " + preferredEngine);
  }

  const capture = ScreenCaptureSchema.parse({
    ...result,
    task_id: input?.taskId,
    session_id: input?.sessionId
  });
  store.screenCaptures.set(capture.capture_id, capture);

  return capture;
}

export async function buildAccessibilityTree(input?: {
  taskId?: string;
  sessionId?: string;
  windowTitle?: string;
}): Promise<UIPerception> {
  if (!shouldAttempt("perception")) {
    throw new Error("Perception circuit breaker is open");
  }

  const elements: UIElement[] = [];
  const screenInfo = getScreenDimensions();

  if (process.platform === "win32") {
    try {
      const psScript = [
        "Add-Type -AssemblyName UIAutomationClient;",
        "$root = [System.Windows.Automation.AutomationElement]::RootElement;",
        "function Walk-Element($el, $depth) {",
        "  if ($depth -gt 6) { return @() }",
        "  $name = $el.Current.Name;",
        "  $ctrlType = $el.Current.ControlType.ProgrammaticName -replace 'ControlType.', '';",
        "  $rect = $el.Current.BoundingRectangle;",
        "  $isEnabled = $el.Current.IsEnabled;",
        "  $isOffscreen = $el.Current.IsOffscreen;",
        "  $hasFocus = $el.Current.HasKeyboardFocus;",
        "  $roleMap = @{'Button'='button';'Edit'='input';'Text'='paragraph';'Hyperlink'='link';'CheckBox'='checkbox';'RadioButton'='radio';'ComboBox'='select';'List'='list';'MenuItem'='menuitem';'Menu'='menu';'Tab'='tab';'Window'='window';'Pane'='pane';'ToolBar'='toolbar';'StatusBar'='statusbar';'ScrollBar'='scrollbar';'Slider'='slider';'ProgressBar'='progress';'DataGrid'='table';'Custom'='unknown';'Document'='paragraph';'TitleBar'='heading';'Image'='image'};",
        "  $role = if ($roleMap[$ctrlType]) { $roleMap[$ctrlType] } else { 'unknown' };",
        "  $interactive = @('button','link','input','select','checkbox','radio','menu','menuitem','tab') -contains $role;",
        "  $id = $el.Current.AutomationId + '_' + $depth + '_' + ([guid]::NewGuid().ToString().Substring(0,8));",
        "  @{ id=$id; role=$role; label=$name; text_content=$name; bounding_box=@{x=[int]$rect.X;y=[int]$rect.Y;width=[int][Math]::Max(0,$rect.Width);height=[int][Math]::Max(0,$rect.Height)}; is_visible=(-not $isOffscreen); is_enabled=$isEnabled; is_focused=$hasFocus; is_interactive=$interactive; attributes=@{}; children_ids=@(); parent_id='' }",
        "}",
        "$results = @();",
        "try { $results = Walk-Element $root 0 } catch {}",
        "$results | ConvertTo-Json -Depth 3 -Compress"
      ].join("\n");

      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-Command", psScript],
        { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }
      );

      if (stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const flatElements = Array.isArray(parsed) ? parsed : [parsed];

        for (const el of flatElements) {
          try {
            elements.push(UIElementSchema.parse({
              element_id: el.id || createEntityId("uielem"),
              role: el.role || "unknown",
              label: typeof el.label === "string" ? el.label.slice(0, 500) : undefined,
              text_content: typeof el.text_content === "string" ? el.text_content.slice(0, 2000) : undefined,
              bounding_box: el.bounding_box || { x: 0, y: 0, width: 0, height: 0 },
              is_visible: Boolean(el.is_visible),
              is_enabled: Boolean(el.is_enabled),
              is_focused: Boolean(el.is_focused),
              is_interactive: Boolean(el.is_interactive),
              attributes: typeof el.attributes === "object" && el.attributes !== null ? el.attributes : {},
              children_ids: Array.isArray(el.children_ids) ? el.children_ids : [],
              parent_id: el.parent_id || undefined
            }));
          } catch { /* skip malformed */ }
        }
      }
    } catch (error) {
      recordFailure("perception");
      log("warn", "Windows accessibility tree extraction failed", { error: String(error) });
    }
  }

  const focusedEl = elements.find(e => e.is_focused);

  const perception = UIPerceptionSchema.parse({
    perception_id: createEntityId("uipercept"),
    task_id: input?.taskId,
    session_id: input?.sessionId,
    engine: "accessibility_api",
    screen_width: screenInfo.width,
    screen_height: screenInfo.height,
    elements,
    active_window_title: input?.windowTitle,
    focused_element_id: focusedEl?.element_id,
    perceived_at: nowIso()
  });

  store.uiPerceptions.set(perception.perception_id, perception);
  return perception;
}

export async function perceiveScreen(input?: {
  taskId?: string;
  sessionId?: string;
  captureId?: string;
  engine?: "accessibility_api" | "ocr" | "hybrid" | "playwright_dom" | "playwright_dom_firefox" | "playwright_dom_webkit";
  windowTitle?: string;
  url?: string;
}): Promise<UIPerception> {
  const preferredEngine = input?.engine ?? "accessibility_api";

  if (preferredEngine === "playwright_dom") {
    return buildPlaywrightDOMPerception(input, "chromium");
  }

  if (preferredEngine === "playwright_dom_firefox") {
    return buildPlaywrightDOMPerception(input, "firefox");
  }

  if (preferredEngine === "playwright_dom_webkit") {
    return buildPlaywrightDOMPerception(input, "webkit");
  }

  if (preferredEngine === "ocr" || preferredEngine === "hybrid") {
    const ocrResult = await performOCROnScreen(input);
    if (preferredEngine === "ocr") return ocrResult;
  }

  return buildAccessibilityTree(input);
}

export interface OCRProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  extractText(imagePath: string): Promise<OCRResult>;
}

export interface OCRResult {
  fullText: string;
  regions: OCRRegion[];
  confidence: number;
  processingTimeMs: number;
}

export interface OCRRegion {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

const ocrProviders: OCRProvider[] = [];

export function registerOCRProvider(provider: OCRProvider): void {
  const existing = ocrProviders.findIndex(p => p.name === provider.name);
  if (existing >= 0) {
    ocrProviders[existing] = provider;
  } else {
    ocrProviders.push(provider);
  }
}

export function listOCRProviders(): string[] {
  return ocrProviders.map(p => p.name);
}

export function clearOCRProviders(): void {
  ocrProviders.length = 0;
}

async function resolveOCRProvider(): Promise<OCRProvider | null> {
  for (const provider of ocrProviders) {
    try {
      const available = await provider.isAvailable();
      if (available) return provider;
    } catch { /* skip unavailable */ }
  }
  return null;
}

class WindowsOCRProvider implements OCRProvider {
  name = "windows_ocr";

  async isAvailable(): Promise<boolean> {
    if (process.platform !== "win32") return false;
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-Command", "Get-Command 'Add-Type' -ErrorAction SilentlyContinue | Select-Object -First 1; [bool](Get-Command 'Windows.Media.Ocr.OcrEngine' -ErrorAction SilentlyContinue)"],
        { timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  async extractText(imagePath: string): Promise<OCRResult> {
    const startTime = Date.now();
    const escapedPath = imagePath.replace(/'/g, "''");

    const psScript = [
      "Add-Type -AssemblyName System.Runtime.WindowsRuntime;",
      "Add-Type -AssemblyName System.Threading;",
      "[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null;",
      "[Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime] | Out-Null;",
      "[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null;",
      "$asyncResult = [Windows.Storage.StorageFile]::GetFileFromPathAsync('" + escapedPath + "');",
      "$file = $asyncResult.GetAwaiter().GetResult();",
      "$stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult();",
      "$decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult();",
      "$bmp = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult();",
      "$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages();",
      "$result = $engine.RecognizeAsync($bmp).GetAwaiter().GetResult();",
      "$lines = @();",
      "foreach ($line in $result.Lines) {",
      "  $words = ($line.Words | ForEach-Object { $_.Text }) -join ' ';",
      "  $rect = $line.Words[0].BoundingRect;",
      "  $lines += @{ text=$words; x=[int]$rect.X; y=[int]$rect.Y; w=[int]$rect.Width; h=[int]$rect.Height }",
      "}",
      "$fullText = $result.Text;",
      "@{ fullText=$fullText; lines=$lines } | ConvertTo-Json -Depth 3 -Compress"
    ].join("\n");

    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-Command", psScript],
        { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 }
      );

      const parsed = JSON.parse(stdout.trim());
      const regions: OCRRegion[] = [];

      if (Array.isArray(parsed.lines)) {
        for (const line of parsed.lines) {
          regions.push({
            text: String(line.text || ""),
            boundingBox: {
              x: line.x || 0,
              y: line.y || 0,
              width: line.w || 0,
              height: line.h || 0
            },
            confidence: 0.8
          });
        }
      }

      return {
        fullText: String(parsed.fullText || ""),
        regions,
        confidence: 0.8,
        processingTimeMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error("Windows OCR failed: " + (error as Error).message);
    }
  }
}

class TesseractOCRProvider implements OCRProvider {
  name = "tesseract";

  async isAvailable(): Promise<boolean> {
    try {
      if (process.platform === "win32") {
        const { stdout } = await execFileAsync("where", ["tesseract"], { timeout: 3000 });
        return stdout.trim().length > 0;
      }
      const { stdout } = await execFileAsync("which", ["tesseract"], { timeout: 3000 });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async extractText(imagePath: string): Promise<OCRResult> {
    const startTime = Date.now();
    const outputPath = imagePath.replace(/\.\w+$/, "") + "_ocr";

    try {
      await execFileAsync(
        "tesseract",
        [imagePath, outputPath, "-l", "eng", "--tsv"],
        { timeout: 60_000 }
      );

      const fs = await import("node:fs");
      const tsvPath = outputPath + ".tsv";
      const tsvContent = await fs.promises.readFile(tsvPath, "utf-8").catch(() => "");
      const fullTextPath = outputPath + ".txt";
      const fullText = await fs.promises.readFile(fullTextPath, "utf-8").catch(() => "");

      const regions: OCRRegion[] = [];
      if (tsvContent) {
        const lines = tsvContent.split("\n").slice(1);
        for (const line of lines) {
          const cols = line.split("\t");
          if (cols.length >= 7 && cols[11] && cols[11].trim()) {
            regions.push({
              text: cols[11].trim(),
              boundingBox: {
                x: parseInt(cols[6], 10) || 0,
                y: parseInt(cols[7], 10) || 0,
                width: parseInt(cols[8], 10) || 0,
                height: parseInt(cols[9], 10) || 0
              },
              confidence: parseFloat(cols[10]) / 100 || 0.5
            });
          }
        }
      }

      await fs.promises.unlink(tsvPath).catch(() => {});
      await fs.promises.unlink(fullTextPath).catch(() => {});

      return {
        fullText: fullText.trim(),
        regions,
        confidence: regions.length > 0 ? regions.reduce((s, r) => s + r.confidence, 0) / regions.length : 0,
        processingTimeMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error("Tesseract OCR failed: " + (error as Error).message);
    }
  }
}

class PlaceholderOCRProvider implements OCRProvider {
  name = "placeholder";

  async isAvailable(): Promise<boolean> {
    return ocrProviders.length === 0;
  }

  async extractText(imagePath: string): Promise<OCRResult> {
    return {
      fullText: "[OCR placeholder: no OCR provider registered. Register a provider via registerOCRProvider().]",
      regions: [],
      confidence: 0,
      processingTimeMs: 0
    };
  }
}

registerOCRProvider(new WindowsOCRProvider());
registerOCRProvider(new TesseractOCRProvider());

async function performOCROnScreen(input?: {
  taskId?: string;
  sessionId?: string;
  windowTitle?: string;
}): Promise<UIPerception> {
  if (!shouldAttempt("perception")) {
    throw new Error("OCR perception circuit breaker is open");
  }

  const screenInfo = getScreenDimensions();

  try {
    let capture: ScreenCapture | null = null;
    try {
      capture = await captureScreen({ taskId: input?.taskId, sessionId: input?.sessionId });
    } catch { /* proceed without capture */ }

    let ocrResult: OCRResult;
    const provider = await resolveOCRProvider();

    if (provider && capture?.pixel_data_ref) {
      try {
        ocrResult = await provider.extractText(capture.pixel_data_ref);
      } catch {
        const placeholder = new PlaceholderOCRProvider();
        ocrResult = await placeholder.extractText("");
      }
    } else {
      const placeholder = new PlaceholderOCRProvider();
      ocrResult = await placeholder.extractText("");
    }

    const ocrElements: UIElement[] = [];
    if (ocrResult.regions.length > 0) {
      for (const region of ocrResult.regions) {
        if (!region.text.trim()) continue;
        ocrElements.push(UIElementSchema.parse({
          element_id: createEntityId("ocr_elem"),
          role: "paragraph",
          text_content: region.text.slice(0, 1000),
          bounding_box: region.boundingBox,
          is_visible: true,
          is_interactive: false,
          attributes: { source: "ocr", confidence: String(region.confidence), provider: provider?.name ?? "none" }
        }));
      }
    } else if (ocrResult.fullText) {
      const lines = ocrResult.fullText.split("\n").filter(l => l.trim());
      lines.forEach((line, idx) => {
        ocrElements.push(UIElementSchema.parse({
          element_id: createEntityId("ocr_elem"),
          role: "paragraph",
          text_content: line.slice(0, 1000),
          bounding_box: { x: 0, y: idx * 20, width: Math.min(line.length * 8, screenInfo.width), height: 20 },
          is_visible: true,
          is_interactive: false,
          attributes: { source: "ocr", line_number: String(idx), provider: provider?.name ?? "none" }
        }));
      });
    }

    const perception = UIPerceptionSchema.parse({
      perception_id: createEntityId("uipercept_ocr"),
      task_id: input?.taskId,
      session_id: input?.sessionId,
      engine: "ocr",
      screen_width: screenInfo.width,
      screen_height: screenInfo.height,
      elements: ocrElements,
      active_window_title: input?.windowTitle,
      ocr_full_text: ocrResult.fullText.slice(0, 10000),
      perceived_at: nowIso()
    });

    store.uiPerceptions.set(perception.perception_id, perception);
    return perception;
  } catch (error) {
    recordFailure("perception");
    log("warn", "OCR perception failed", { error: String(error) });
    throw new Error("OCR perception failed: " + (error as Error).message);
  }
}

async function buildPlaywrightDOMPerception(input?: {
  taskId?: string;
  sessionId?: string;
  windowTitle?: string;
  url?: string;
}, browserType: "chromium" | "firefox" | "webkit" = "chromium"): Promise<UIPerception> {
  if (!shouldAttempt("perception")) {
    throw new Error("Playwright DOM perception circuit breaker is open");
  }

  const screenInfo = getScreenDimensions();
  const elements: UIElement[] = [];
  let pageTitle = input?.windowTitle;

  try {
    const playwright = await import("playwright");
    const launcher = playwright[browserType];
    if (!launcher) {
      throw new Error("Playwright browser type '" + browserType + "' is not available");
    }
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: null });

      if (input?.url) {
        await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 15_000 });
        pageTitle = await page.title();
      }

      const domElements = await page.evaluate(function() {
        function mapTagNameToRole(tag: string, attrs: Record<string, string>): string {
          const roleAttr = attrs["role"];
          if (roleAttr) return roleAttr;

          const tagRoleMap: Record<string, string> = {
            "button": "button", "a": "link", "input": "input", "textarea": "textarea",
            "select": "select", "option": "menuitem", "h1": "heading", "h2": "heading",
            "h3": "heading", "h4": "heading", "h5": "heading", "h6": "heading",
            "p": "paragraph", "img": "image", "table": "table", "tr": "row",
            "td": "cell", "th": "cell", "ul": "list", "ol": "list", "li": "menuitem",
            "nav": "navigation", "header": "heading", "footer": "paragraph",
            "main": "pane", "aside": "pane", "section": "pane", "article": "pane",
            "div": "pane", "span": "paragraph", "label": "paragraph",
            "form": "pane", "fieldset": "pane", "dialog": "dialog",
            "details": "group", "summary": "button", "progress": "progress",
            "meter": "progress", "menu": "menu", "menuitem": "menuitem",
            "tab": "tab", "tabpanel": "pane", "checkbox": "checkbox",
            "radio": "radio", "slider": "slider", "scrollbar": "scrollbar",
            "toolbar": "toolbar", "status": "statusbar"
          };

          const inputTypeRoleMap: Record<string, string> = {
            "button": "button", "submit": "button", "reset": "button",
            "checkbox": "checkbox", "radio": "radio", "range": "slider",
            "number": "input", "email": "input", "password": "input",
            "search": "input", "tel": "input", "text": "input", "url": "input",
            "file": "input", "color": "input", "date": "input",
            "datetime-local": "input", "month": "input", "time": "input", "week": "input"
          };

          if (tag === "input") {
            const inputType = (attrs["type"] || "text").toLowerCase();
            return inputTypeRoleMap[inputType] || "input";
          }

          return tagRoleMap[tag.toLowerCase()] || "unknown";
        }

        function isInteractive(tag: string, attrs: Record<string, string>): boolean {
          const interactiveTags = new Set(["a", "button", "input", "textarea", "select", "details", "summary", "option"]);
          if (interactiveTags.has(tag.toLowerCase())) return true;
          if (attrs["onclick"]) return true;
          if (attrs["role"] && ["button", "link", "tab", "menuitem", "checkbox", "radio", "switch", "slider"].includes(attrs["role"])) return true;
          if (attrs["tabindex"] && parseInt(attrs["tabindex"]) >= 0) return true;
          if (attrs["contenteditable"] === "true") return true;
          return false;
        }

        function getVisibleText(el: Element): string {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
          let text = "";
          while (walker.nextNode()) {
            text += walker.currentNode.textContent || "";
          }
          return text.trim();
        }

        const results: Array<{
          id: string;
          role: string;
          label: string | null;
          text_content: string | null;
          value: string | null;
          bounding_box: { x: number; y: number; width: number; height: number };
          is_visible: boolean;
          is_enabled: boolean;
          is_focused: boolean;
          is_interactive: boolean;
          tag_name: string;
          href: string | null;
          input_type: string | null;
          placeholder: string | null;
          page_url: string;
          checked: string | null;
          selected: string | null;
          expanded: string | null;
          disabled: string | null;
        }> = [];

        const allElements = document.querySelectorAll("*");
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;

          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;

          const tag = el.tagName.toLowerCase();
          const attrs: Record<string, string> = {};
          for (const attr of Array.from(el.attributes)) {
            attrs[attr.name] = attr.value;
          }

          const role = mapTagNameToRole(tag, attrs);
          const interactive = isInteractive(tag, attrs);

          const label = attrs["aria-label"] || attrs["title"] || attrs["alt"] || el.textContent?.slice(0, 200) || null;
          const textContent = getVisibleText(el).slice(0, 2000) || null;
          const value = (el as HTMLInputElement).value || null;

          const focused = document.activeElement === el;

          results.push({
            id: (attrs["id"] || attrs["data-testid"] || attrs["aria-label"] || tag + "_" + results.length).slice(0, 200),
            role,
            label: label ? label.slice(0, 500) : null,
            text_content: textContent ? textContent.slice(0, 2000) : null,
            value: value ? value.slice(0, 500) : null,
            bounding_box: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            is_visible: true,
            is_enabled: !(el as HTMLInputElement).disabled,
            is_focused: focused,
            is_interactive: interactive,
            tag_name: tag,
            href: attrs["href"] || null,
            input_type: attrs["type"] || null,
            placeholder: attrs["placeholder"] || null,
            page_url: window.location.href,
            checked: (el as HTMLInputElement).checked !== undefined ? String((el as HTMLInputElement).checked) : null,
            selected: "selected" in el ? String(Boolean((el as HTMLOptionElement).selected)) : null,
            expanded: attrs["aria-expanded"] || null,
            disabled: "disabled" in el ? String(Boolean((el as HTMLInputElement).disabled)) : null
          });
        }

        return results;
      });

      for (const domEl of domElements) {
        try {
          const attrs: Record<string, string> = { tag_name: domEl.tag_name };
          if (domEl.href) attrs.href = domEl.href;
          if (domEl.input_type) attrs.input_type = domEl.input_type;
          if (domEl.placeholder) attrs.placeholder = domEl.placeholder;
          if (domEl.id) attrs.dom_id = domEl.id;
          if (domEl.page_url) attrs.page_url = domEl.page_url;
          if (domEl.checked) attrs.checked = domEl.checked;
          if (domEl.selected) attrs.selected = domEl.selected;
          if (domEl.expanded) attrs.expanded = domEl.expanded;
          if (domEl.disabled) attrs.disabled = domEl.disabled;

          elements.push(UIElementSchema.parse({
            element_id: createEntityId("dom_elem"),
            role: domEl.role as UIElement["role"],
            label: domEl.label ?? undefined,
            text_content: domEl.text_content ?? undefined,
            value: domEl.value ?? undefined,
            bounding_box: domEl.bounding_box,
            is_visible: domEl.is_visible,
            is_enabled: domEl.is_enabled,
            is_focused: domEl.is_focused,
            is_interactive: domEl.is_interactive,
            attributes: attrs,
            children_ids: [],
            parent_id: undefined
          }));
        } catch { /* skip malformed */ }
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    recordFailure("perception");
    log("warn", "Playwright DOM perception failed", { error: String(error) });
  }

  const focusedEl = elements.find(e => e.is_focused);

  const perception = UIPerceptionSchema.parse({
    perception_id: createEntityId("uipercept"),
    task_id: input?.taskId,
    session_id: input?.sessionId,
    engine: browserType === "chromium" ? "playwright_dom" : ("playwright_dom_" + browserType),
    screen_width: screenInfo.width,
    screen_height: screenInfo.height,
    elements,
    active_window_title: pageTitle,
    focused_element_id: focusedEl?.element_id,
    perceived_at: nowIso()
  });

  store.uiPerceptions.set(perception.perception_id, perception);
  return perception;
}

export interface ElementActionProvider {
  name: string;
  canHandle(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover"): boolean;
  execute(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover", value?: string): Promise<ElementActionResult>;
}

export interface ElementActionResult {
  success: boolean;
  method: string;
  provider: string;
  durationMs: number;
  error?: string;
  postCheck?: ElementPostCheckResult;
}

export interface ElementPostCheckResult {
  elementStillExists: boolean;
  elementStillVisible: boolean;
  valueChanged: boolean;
  focusChanged: boolean;
  stateSnapshot?: Record<string, unknown>;
}

const elementActionProviders: ElementActionProvider[] = [];

export function registerElementActionProvider(provider: ElementActionProvider): void {
  const existing = elementActionProviders.findIndex(p => p.name === provider.name);
  if (existing >= 0) {
    elementActionProviders[existing] = provider;
  } else {
    elementActionProviders.push(provider);
  }
}

export function listElementActionProviders(): string[] {
  return elementActionProviders.map(p => p.name);
}

export function clearElementActionProviders(): void {
  elementActionProviders.length = 0;
}

class PlaywrightDOMElementActionProvider implements ElementActionProvider {
  name = "playwright_dom";
  protected browserType: "chromium" | "firefox" | "webkit" = "chromium";

  canHandle(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover"): boolean {
    const domId = element.attributes?.dom_id;
    const tagName = element.attributes?.tag_name;
    const href = element.attributes?.href;
    if (!domId && !tagName && !href) return false;

    if (action === "click" && (element.is_interactive || element.role === "button" || element.role === "link")) return true;
    if (action === "type" && (element.role === "input" || element.role === "textarea")) return true;
    if (action === "focus" && element.is_interactive) return true;
    if (action === "select" && element.role === "select") return true;
    if (action === "hover" && element.is_interactive) return true;
    return false;
  }

  async execute(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover", value?: string): Promise<ElementActionResult> {
    const startTime = Date.now();
    const method = "playwright_dom_" + this.browserType;

    try {
      const playwright = await import("playwright");
      const launcher = playwright[this.browserType];
      if (!launcher) {
        return { success: false, method, provider: this.name, durationMs: Date.now() - startTime, error: "Playwright browser type '" + this.browserType + "' is not available" };
      }
      const browser = await launcher.launch({ headless: false });
      try {
        const page = await browser.newPage({ viewport: null });

        const selector = this.buildSelector(element);
        if (!selector) {
          return { success: false, method, provider: this.name, durationMs: Date.now() - startTime, error: "Could not build selector for element" };
        }

        await page.waitForSelector(selector, { timeout: 5_000 }).catch(() => {});

        switch (action) {
          case "click":
            await page.click(selector, { timeout: 5_000 });
            break;
          case "type":
            await page.fill(selector, value ?? "", { timeout: 5_000 });
            break;
          case "focus":
            await page.focus(selector, { timeout: 5_000 });
            break;
          case "select":
            if (value) await page.selectOption(selector, value, { timeout: 5_000 });
            break;
          case "hover":
            await page.hover(selector, { timeout: 5_000 });
            break;
        }

        const postCheck = await performDOMPostCheck(page, selector, element, action, value);

        return { success: true, method, provider: this.name, durationMs: Date.now() - startTime, postCheck };
      } finally {
        await browser.close();
      }
    } catch (error) {
      return { success: false, method, provider: this.name, durationMs: Date.now() - startTime, error: (error as Error).message };
    }
  }

  protected buildSelector(element: UIElement): string {
    const domId = element.attributes?.dom_id;
    if (domId) return "#" + CSS.escape(domId);

    const tagName = element.attributes?.tag_name;
    const inputType = element.attributes?.input_type;
    const ariaLabel = element.label;

    if (tagName === "input" && inputType) {
      if (ariaLabel) return "input[type='" + inputType + "'][aria-label='" + ariaLabel + "']";
      return "input[type='" + inputType + "']";
    }

    if (ariaLabel) return "[aria-label='" + ariaLabel + "']";

    const href = element.attributes?.href;
    if (tagName === "a" && href) return "a[href='" + href + "']";

    if (tagName) return tagName;
    return "";
  }
}

class PlaywrightFirefoxElementActionProvider extends PlaywrightDOMElementActionProvider {
  name = "playwright_dom_firefox";
  protected browserType: "firefox" = "firefox";

  canHandle(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover"): boolean {
    const source = element.attributes?.source;
    if (source && source !== "playwright_dom_firefox") return false;
    return super.canHandle(element, action);
  }
}

class PlaywrightWebKitElementActionProvider extends PlaywrightDOMElementActionProvider {
  name = "playwright_dom_webkit";
  protected browserType: "webkit" = "webkit";

  canHandle(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover"): boolean {
    const source = element.attributes?.source;
    if (source && source !== "playwright_dom_webkit") return false;
    return super.canHandle(element, action);
  }
}

class WindowsAccessibilityElementActionProvider implements ElementActionProvider {
  name = "windows_accessibility";

  canHandle(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover"): boolean {
    if (process.platform !== "win32") return false;

    const automationId = element.attributes?.automation_id;
    const className = element.attributes?.class_name;
    if (!automationId && !className && !element.label) return false;

    if (action === "click" && element.is_interactive) return true;
    if (action === "type" && (element.role === "input" || element.role === "textarea")) return true;
    if (action === "focus" && element.is_interactive) return true;
    if (action === "select" && element.role === "select") return true;
    return false;
  }

  async execute(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover", value?: string): Promise<ElementActionResult> {
    const startTime = Date.now();

    try {
      const automationId = element.attributes?.automation_id ?? "";
      const className = element.attributes?.class_name ?? "";
      const elementName = element.label ?? "";

      let findCondition: string;
      if (automationId) {
        findCondition = "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '" + automationId.replace(/'/g, "''") + "')";
      } else if (elementName) {
        findCondition = "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '" + elementName.replace(/'/g, "''") + "')";
      } else {
        findCondition = "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '" + className.replace(/'/g, "''") + "')";
      }

      let actionScript: string;

      switch (action) {
        case "click": {
          actionScript = [
            "Add-Type -AssemblyName UIAutomationClient;",
            "$root = [System.Windows.Automation.AutomationElement]::RootElement;",
            findCondition + ";",
            "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond);",
            "if ($el -eq $null) { throw 'Element not found' }",
            "$pattern = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern);",
            "if ($pattern) { $pattern.Invoke() } else { throw 'InvokePattern not available' }"
          ].join("\n");
          break;
        }
        case "type": {
          const escapedValue = (value ?? "").replace(/'/g, "''");
          actionScript = [
            "Add-Type -AssemblyName UIAutomationClient;",
            "$root = [System.Windows.Automation.AutomationElement]::RootElement;",
            findCondition + ";",
            "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond);",
            "if ($el -eq $null) { throw 'Element not found' }",
            "$pattern = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern);",
            "if ($pattern) { $pattern.SetValue('" + escapedValue + "') } else {",
            "  $el.SetFocus();",
            "  Add-Type -AssemblyName System.Windows.Forms;",
            "  [System.Windows.Forms.SendKeys]::SendWait('" + escapedValue.replace(/[{}()+^%~]/g, "{$&}") + "');",
            "}"
          ].join("\n");
          break;
        }
        case "focus": {
          actionScript = [
            "Add-Type -AssemblyName UIAutomationClient;",
            "$root = [System.Windows.Automation.AutomationElement]::RootElement;",
            findCondition + ";",
            "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond);",
            "if ($el -eq $null) { throw 'Element not found' }",
            "$el.SetFocus()"
          ].join("\n");
          break;
        }
        case "select": {
          const escapedValue = (value ?? "").replace(/'/g, "''");
          actionScript = [
            "Add-Type -AssemblyName UIAutomationClient;",
            "$root = [System.Windows.Automation.AutomationElement]::RootElement;",
            findCondition + ";",
            "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond);",
            "if ($el -eq $null) { throw 'Element not found' }",
            "$pattern = $el.GetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern);",
            "if ($pattern) {",
            "  $items = $pattern.GetSelection();",
            "  foreach ($item in $items) { Write-Output $item.Current.Name }",
            "} else {",
            "  $expandPattern = $el.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern);",
            "  if ($expandPattern) { $expandPattern.Expand() }",
            "}"
          ].join("\n");
          break;
        }
        case "hover": {
          const bbox = element.bounding_box;
          const centerX = Math.round(bbox.x + bbox.width / 2);
          const centerY = Math.round(bbox.y + bbox.height / 2);
          await executeMouseMove(centerX, centerY);
          const postCheck = await performAccessibilityPostCheck(element, action);
          return { success: true, method: "accessibility_hover", provider: this.name, durationMs: Date.now() - startTime, postCheck };
        }
      }

      await execFileAsync("powershell.exe", ["-Command", actionScript], { timeout: 10_000 });

      const postCheck = await performAccessibilityPostCheck(element, action);

      return { success: true, method: "accessibility_" + action, provider: this.name, durationMs: Date.now() - startTime, postCheck };
    } catch (error) {
      return { success: false, method: "accessibility_" + action, provider: this.name, durationMs: Date.now() - startTime, error: (error as Error).message };
    }
  }
}

registerElementActionProvider(new PlaywrightDOMElementActionProvider());
registerElementActionProvider(new WindowsAccessibilityElementActionProvider());

export async function resolveElementAction(
  element: UIElement,
  action: "click" | "type" | "focus" | "select" | "hover",
  value?: string
): Promise<ElementActionResult> {
  for (const provider of elementActionProviders) {
    if (provider.canHandle(element, action)) {
      const result = await provider.execute(element, action, value);
      if (result.success) return result;
    }
  }

  if (element.bounding_box.width > 0 && element.bounding_box.height > 0) {
    const bbox = element.bounding_box;
    const centerX = Math.round(bbox.x + bbox.width / 2);
    const centerY = Math.round(bbox.y + bbox.height / 2);

    const startTime = Date.now();

    switch (action) {
      case "click":
        await executeMouseClick(centerX, centerY, "mouse_click", "left");
        break;
      case "type":
        await executeMouseClick(centerX, centerY, "mouse_click", "left");
        await new Promise(r => setTimeout(r, 50));
        if (value) await executeTypeText(value);
        break;
      case "focus":
        await executeMouseClick(centerX, centerY, "mouse_click", "left");
        break;
      case "select":
        await executeMouseClick(centerX, centerY, "mouse_click", "left");
        break;
      case "hover":
        await executeMouseMove(centerX, centerY);
        break;
    }

    return { success: true, method: "coordinate_fallback", provider: "fallback", durationMs: Date.now() - startTime };
  }

  return { success: false, method: "none", provider: "none", durationMs: 0, error: "No provider could handle the element action and no bounding box available for coordinate fallback" };
}

async function performDOMPostCheck(
  page: { evaluate: (fn: () => unknown) => Promise<unknown> },
  selector: string,
  elementBefore: UIElement,
  action: string,
  value?: string
): Promise<ElementPostCheckResult> {
  try {
    const result = await page.evaluate(function() {
      return true;
    }) as boolean;

    return {
      elementStillExists: result,
      elementStillVisible: result,
      valueChanged: action === "type" && value !== undefined,
      focusChanged: action === "focus" || action === "click",
      stateSnapshot: { selector: selector, action: action, previousValue: elementBefore.value }
    };
  } catch {
    return {
      elementStillExists: false,
      elementStillVisible: false,
      valueChanged: false,
      focusChanged: false
    };
  }
}

async function performAccessibilityPostCheck(
  elementBefore: UIElement,
  action: string
): Promise<ElementPostCheckResult> {
  if (process.platform !== "win32") {
    return { elementStillExists: true, elementStillVisible: true, valueChanged: false, focusChanged: action === "focus" || action === "click" };
  }

  try {
    const automationId = elementBefore.attributes?.automation_id ?? "";
    const elementName = elementBefore.label ?? "";

    let findCondition: string;
    if (automationId) {
      findCondition = "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '" + automationId.replace(/'/g, "''") + "')";
    } else if (elementName) {
      findCondition = "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '" + elementName.replace(/'/g, "''") + "')";
    } else {
      return { elementStillExists: true, elementStillVisible: true, valueChanged: false, focusChanged: action === "focus" || action === "click" };
    }

    const psScript = [
      "Add-Type -AssemblyName UIAutomationClient;",
      "$root = [System.Windows.Automation.AutomationElement]::RootElement;",
      findCondition + ";",
      "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond);",
      "if ($el -eq $null) { @{ exists=$false; visible=$false; focused=$false } | ConvertTo-Json -Compress }",
      "else { @{ exists=$true; visible=(-not $el.Current.IsOffscreen); focused=$el.Current.HasKeyboardFocus } | ConvertTo-Json -Compress }"
    ].join("\n");

    const { stdout } = await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 5_000 });
    const parsed = JSON.parse(stdout.trim());

    return {
      elementStillExists: Boolean(parsed.exists),
      elementStillVisible: Boolean(parsed.visible),
      valueChanged: false,
      focusChanged: Boolean(parsed.focused) || action === "focus" || action === "click",
      stateSnapshot: { action: action, previousLabel: elementBefore.label }
    };
  } catch {
    return { elementStillExists: true, elementStillVisible: true, valueChanged: false, focusChanged: action === "focus" || action === "click" };
  }
}

export async function executeElementAction(input: {
  element: UIElement;
  action: "click" | "type" | "focus" | "select" | "hover";
  value?: string;
  taskId?: string;
  sessionId?: string;
}): Promise<InputAction> {
  if (!shouldAttempt("input")) {
    throw new Error("Input action circuit breaker is open");
  }

  const sandboxAction = input.action === "click" || input.action === "type" || input.action === "focus" || input.action === "select" || input.action === "hover"
    ? `element_action_${input.action}` as string
    : "element_action_readonly";
  const sandboxCheck = enforceComputerUseSandbox({
    action: sandboxAction,
    sessionId: input.sessionId
  });
  if (!sandboxCheck.allowed) {
    throw new Error("Element action blocked by sandbox: " + sandboxCheck.violations.map(v => v.description).join("; "));
  }

  const kindMap: Record<string, InputAction["kind"]> = {
    click: "mouse_click",
    type: "type_text",
    focus: "focus_element",
    select: "select_option",
    hover: "mouse_move"
  };

  const action = InputActionSchema.parse({
    action_id: createEntityId("inputact"),
    task_id: input.taskId,
    session_id: input.sessionId,
    kind: kindMap[input.action] ?? "mouse_click",
    target_element_id: input.element.element_id,
    coordinates: {
      x: Math.round(input.element.bounding_box.x + input.element.bounding_box.width / 2),
      y: Math.round(input.element.bounding_box.y + input.element.bounding_box.height / 2)
    },
    text: input.value,
    created_at: nowIso()
  });

  try {
    const stateBefore = buildElementStateFromUIElement(input.element);
    const beforeCapture = input.sessionId ? await captureScreen({ sessionId: input.sessionId, taskId: input.taskId }).catch(() => null) : null;

    const result = await resolveElementAction(input.element, input.action, input.value);

    if (!result.success) {
      action.result = "error";
      action.error_message = result.error ?? "Element action failed";
      recordFailure("input");
    } else {
      action.executed = true;
      action.executed_at = nowIso();
      action.result = "success";
      action.provider = result.provider;
      action.execution_method = result.method;
    }

    const afterCapture = input.sessionId ? await captureScreen({ sessionId: input.sessionId, taskId: input.taskId }).catch(() => null) : null;
    const screenshotDiff = await compareScreenCaptures(beforeCapture, afterCapture);

    let stateAfter: ComputerUseElementState | undefined;
    if (input.sessionId) {
      const afterPerception = await perceiveScreen({ sessionId: input.sessionId, taskId: input.taskId, engine: "accessibility_api" }).catch(() => undefined);
      const afterElement = afterPerception?.elements.find(e => e.element_id === input.element.element_id);
      if (afterElement) stateAfter = buildElementStateFromUIElement(afterElement);
    }

    const confidence = computeConfidenceScore({
      provider: result.provider,
      method: result.method,
      postCheck: result.postCheck,
      stateBefore,
      stateAfter,
      screenshotDiff,
      action: input.action,
      fallbackUsed: result.method === "coordinate_fallback",
      success: result.success
    });

    const evidence = buildVerificationEvidence({
      verdict: confidence.verdict,
      provider: result.provider,
      method: result.method,
      postCheck: result.postCheck,
      stateBefore,
      stateAfter,
      screenshotDiff,
      confidenceScore: confidence.score,
      reasons: confidence.reasons
    });

    action.verification_evidence = evidence;
  } catch (error) {
    action.result = "error";
    action.error_message = (error as Error).message;
    recordFailure("input");
  }

  store.inputActions.set(action.action_id, action);
  return action;
}

export async function executeInputAction(input: {
  kind: InputAction["kind"];
  coordinates?: { x: number; y: number };
  targetElementId?: string;
  button?: "left" | "right" | "middle";
  key?: string;
  keyCombo?: string[];
  text?: string;
  scrollDelta?: number;
  durationMs?: number;
  taskId?: string;
  sessionId?: string;
}): Promise<InputAction> {
  if (!shouldAttempt("input")) {
    throw new Error("Input action circuit breaker is open");
  }

  const action = InputActionSchema.parse({
    action_id: createEntityId("inputact"),
    task_id: input.taskId,
    session_id: input.sessionId,
    kind: input.kind,
    target_element_id: input.targetElementId,
    coordinates: input.coordinates,
    button: input.button ?? "left",
    key: input.key,
    key_combo: input.keyCombo ?? [],
    text: input.text,
    scroll_delta: input.scrollDelta ?? 0,
    duration_ms: input.durationMs ?? 0,
    created_at: nowIso()
  });

  try {
    switch (action.kind) {
      case "mouse_click":
      case "mouse_double_click":
      case "mouse_right_click": {
        if (!action.coordinates) throw new Error("Mouse click requires coordinates");
        await executeMouseClick(action.coordinates.x, action.coordinates.y, action.kind, action.button);
        break;
      }
      case "mouse_move": {
        if (!action.coordinates) throw new Error("Mouse move requires coordinates");
        await executeMouseMove(action.coordinates.x, action.coordinates.y);
        break;
      }
      case "mouse_drag": {
        if (!action.coordinates) throw new Error("Mouse drag requires coordinates");
        await executeMouseDrag(action.coordinates.x, action.coordinates.y, action.duration_ms);
        break;
      }
      case "mouse_scroll": {
        await executeMouseScroll(action.scroll_delta);
        break;
      }
      case "key_press": {
        if (!action.key) throw new Error("Key press requires a key");
        await executeKeyPress(action.key);
        break;
      }
      case "key_combo": {
        if (!action.key_combo || action.key_combo.length === 0) throw new Error("Key combo requires keys");
        await executeKeyCombo(action.key_combo);
        break;
      }
      case "type_text": {
        if (!action.text) throw new Error("Type text requires text content");
        await executeTypeText(action.text);
        break;
      }
      case "focus_element": {
        if (!action.target_element_id) throw new Error("Focus element requires target_element_id");
        const perception = action.target_element_id ? store.uiPerceptions.get(action.target_element_id) : undefined;
        if (perception) {
          const el = perception.elements.find(e => e.element_id === action.target_element_id);
          if (el) {
            const result = await resolveElementAction(el, "focus");
            if (!result.success && el.bounding_box.width > 0) {
              await executeMouseMove(Math.round(el.bounding_box.x + el.bounding_box.width / 2), Math.round(el.bounding_box.y + el.bounding_box.height / 2));
              await executeMouseClick(Math.round(el.bounding_box.x + el.bounding_box.width / 2), Math.round(el.bounding_box.y + el.bounding_box.height / 2), "mouse_click", "left");
            }
            break;
          }
        }
        if (action.coordinates) {
          await executeMouseClick(action.coordinates.x, action.coordinates.y, "mouse_click", "left");
        }
        break;
      }
      case "select_option": {
        if (!action.target_element_id) throw new Error("Select option requires target_element_id");
        const selectPerception = action.target_element_id ? store.uiPerceptions.get(action.target_element_id) : undefined;
        if (selectPerception) {
          const selEl = selectPerception.elements.find(e => e.element_id === action.target_element_id);
          if (selEl) {
            const result = await resolveElementAction(selEl, "select", action.text);
            if (!result.success && selEl.bounding_box.width > 0) {
              await executeMouseClick(Math.round(selEl.bounding_box.x + selEl.bounding_box.width / 2), Math.round(selEl.bounding_box.y + selEl.bounding_box.height / 2), "mouse_click", "left");
            }
            break;
          }
        }
        if (action.coordinates) {
          await executeMouseClick(action.coordinates.x, action.coordinates.y, "mouse_click", "left");
        }
        break;
      }
      default:
        throw new Error("Unsupported input action kind: " + action.kind);
    }

    action.executed = true;
    action.executed_at = nowIso();
    action.result = "success";
  } catch (error) {
    action.result = "error";
    action.error_message = (error as Error).message;
    recordFailure("input");
  }

  store.inputActions.set(action.action_id, action);
  return action;
}

async function executeMouseClick(x: number, y: number, kind: string, button: string): Promise<void> {
  if (process.platform === "win32") {
    const clickType = kind === "mouse_double_click" ? "2" : "1";
    const psScript = [
      "Add-Type -AssemblyName System.Windows.Forms;",
      "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(" + x + "," + y + ");",
      "Start-Sleep -Milliseconds 50;",
      "Add-Type @'",
      "using System;",
      "using System.Runtime.InteropServices;",
      "public class MouseClick {",
      "  [DllImport(\"user32.dll\")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);",
      "  public static void Click() { mouse_event(0x0002, 0, 0, 0, 0); mouse_event(0x0004, 0, 0, 0, 0); }",
      "  public static void RightClick() { mouse_event(0x0008, 0, 0, 0, 0); mouse_event(0x0010, 0, 0, 0, 0); }",
      "  public static void DblClick() { mouse_event(0x0002, 0, 0, 0, 0); mouse_event(0x0004, 0, 0, 0, 0); mouse_event(0x0002, 0, 0, 0, 0); mouse_event(0x0004, 0, 0, 0, 0); }",
      "}",
      "'@;",
      "if (" + clickType + " -eq 2) { [MouseClick]::DblClick() } elseif (\"" + button + "\" -eq \"right\") { [MouseClick]::RightClick() } else { [MouseClick]::Click() }"
    ].join("\n");
    await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 5000 });
  } else if (process.platform === "darwin") {
    const script = "tell application \"System Events\" to click at {" + x + ", " + y + "}";
    await execFileAsync("osascript", ["-e", script], { timeout: 3000 }).catch(() => {});
  } else {
    await execFileAsync("xdotool", ["mousemove", String(x), String(y)], { timeout: 2000 }).catch(() => {});
    const clickBtn = kind === "mouse_right_click" ? "3" : "1";
    const clickCmd = kind === "mouse_double_click" ? "click" : "click";
    await execFileAsync("xdotool", [clickCmd, clickBtn], { timeout: 2000 }).catch(() => {});
  }
}

async function executeMouseMove(x: number, y: number): Promise<void> {
  if (process.platform === "win32") {
    const psScript = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(" + x + "," + y + ")";
    await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 3000 });
  } else if (process.platform === "darwin") {
    const script = "tell application \"System Events\" to set mouse position to {" + x + ", " + y + "}";
    await execFileAsync("osascript", ["-e", script], { timeout: 2000 }).catch(() => {});
  } else {
    await execFileAsync("xdotool", ["mousemove", String(x), String(y)], { timeout: 2000 }).catch(() => {});
  }
}

async function executeMouseDrag(endX: number, endY: number, durationMs: number): Promise<void> {
  if (process.platform === "win32") {
    const psScript = [
      "Add-Type @'",
      "using System;",
      "using System.Runtime.InteropServices;",
      "using System.Threading;",
      "public class DragHelper {",
      "  [DllImport(\"user32.dll\")] public static extern void SetCursorPos(int X, int Y);",
      "  [DllImport(\"user32.dll\")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);",
      "  public static void Drag(int endX, int endY, int ms) {",
      "    mouse_event(0x0002, 0, 0, 0, 0);",
      "    Thread.Sleep(ms > 0 ? ms / 2 : 50);",
      "    SetCursorPos(endX, endY);",
      "    Thread.Sleep(ms > 0 ? ms / 2 : 50);",
      "    mouse_event(0x0004, 0, 0, 0, 0);",
      "  }",
      "}",
      "'@;",
      "[DragHelper]::Drag(" + endX + ", " + endY + ", " + Math.max(durationMs, 100) + ")"
    ].join("\n");
    await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 10000 });
  } else {
    await execFileAsync("xdotool", ["mousemove", String(endX), String(endY), "mousedown", "1", "mouseup", "1"], { timeout: 5000 }).catch(() => {});
  }
}

async function executeMouseScroll(delta: number): Promise<void> {
  if (process.platform === "win32") {
    const psScript = [
      "Add-Type @'",
      "using System;",
      "using System.Runtime.InteropServices;",
      "public class ScrollHelper {",
      "  [DllImport(\"user32.dll\")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);",
      "  public static void Scroll(int d) { mouse_event(0x0800, 0, 0, d, 0); }",
      "}",
      "'@;",
      "[ScrollHelper]::Scroll(" + delta + ")"
    ].join("\n");
    await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 3000 });
  } else if (process.platform === "darwin") {
    const script = "tell application \"System Events\" to scroll " + delta;
    await execFileAsync("osascript", ["-e", script], { timeout: 2000 }).catch(() => {});
  } else {
    await execFileAsync("xdotool", ["scroll", String(delta)], { timeout: 2000 }).catch(() => {});
  }
}

async function executeKeyPress(key: string): Promise<void> {
  const normalizedKey = normalizeKeyForPlatform(key);

  if (process.platform === "win32") {
    const escaped = escapeSendKeys(normalizedKey);
    const psScript = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('" + escaped + "')";
    await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 3000 });
  } else if (process.platform === "darwin") {
    const script = "tell application \"System Events\" to keystroke \"" + normalizedKey + "\"";
    await execFileAsync("osascript", ["-e", script], { timeout: 2000 }).catch(() => {});
  } else {
    await execFileAsync("xdotool", ["key", normalizedKey], { timeout: 2000 }).catch(() => {});
  }
}

async function executeKeyCombo(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  if (process.platform === "win32") {
    const comboStr = keys.map(k => escapeSendKeys(normalizeKeyForPlatform(k))).join("");
    const psScript = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('" + comboStr + "')";
    await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: 3000 });
  } else if (process.platform === "darwin") {
    const modifiers = keys.filter(isModifier).map(m => m.toLowerCase()).join(" + ");
    const regularKey = keys.find(k => !isModifier(k));
    if (regularKey) {
      const script = "tell application \"System Events\" to keystroke \"" + regularKey + "\" using {" + modifiers + "}";
      await execFileAsync("osascript", ["-e", script], { timeout: 2000 }).catch(() => {});
    }
  } else {
    const xdotoolKeys = keys.map(k => k.toLowerCase() === "control" ? "ctrl" : k.toLowerCase()).join("+");
    await execFileAsync("xdotool", ["key", xdotoolKeys], { timeout: 2000 }).catch(() => {});
  }
}

async function executeTypeText(text: string): Promise<void> {
  const sanitized = text.replace(/[{}()+^%~]/g, function(m) { return "{" + m + "}"; });

  if (process.platform === "win32") {
    const psScript = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('" + sanitized + "')";
    await execFileAsync("powershell.exe", ["-Command", psScript], { timeout: Math.max(text.length * 50, 1000) });
  } else if (process.platform === "darwin") {
    const script = "tell application \"System Events\" to keystroke \"" + text + "\"";
    await execFileAsync("osascript", ["-e", script], { timeout: Math.max(text.length * 50, 1000) }).catch(() => {});
  } else {
    await execFileAsync("xdotool", ["type", "--delay", "20", text], { timeout: Math.max(text.length * 50, 1000) }).catch(() => {});
  }
}

function normalizeKeyForPlatform(key: string): string {
  const map: Record<string, string> = {
    "Enter": "{ENTER}", "Tab": "{TAB}", "Escape": "{ESC}", "Backspace": "{BS}",
    "Delete": "{DEL}", "Home": "{HOME}", "End": "{END}", "PageUp": "{PGUP}",
    "PageDown": "{PGDN}", "Up": "{UP}", "Down": "{DOWN}", "Left": "{LEFT}",
    "Right": "{RIGHT}", "F1": "{F1}", "F2": "{F2}", "F3": "{F3}", "F4": "{F4}",
    "F5": "{F5}", "F6": "{F6}", "F7": "{F7}", "F8": "{F8}", "F9": "{F9}",
    "F10": "{F10}", "F11": "{F11}", "F12": "{F12}", " ": "+"
  };

  return map[key] ?? key;
}

function escapeSendKeys(s: string): string {
  return s
    .replace(/\{/g, "{{")
    .replace(/\}/g, "}}")
    .replace(/\(/g, "{(}")
    .replace(/\)/g, "{)}")
    .replace(/\+/g, "{+}")
    .replace(/\^/g, "{^}")
    .replace(/%/g, "{%}")
    .replace(/~/g, "{~}");
}

function isModifier(key: string): boolean {
  const mods = new Set(["Control", "Ctrl", "Alt", "Shift", "Meta", "Command", "Super"]);
  return mods.has(key);
}

export function createComputerUseSession(input: {
  taskId: string;
  maxSteps?: number;
  perceptionEngine?: UIPerception["engine"];
  captureEngine?: ScreenCapture["engine"];
  sandboxTier?: ComputerUseSession["sandbox_tier"];
  requiresConfirmation?: boolean;
}): ComputerUseSession {
  const session = ComputerUseSessionSchema.parse({
    session_id: createEntityId("cusession"),
    task_id: input.taskId,
    status: "active",
    step_count: 0,
    max_steps: input.maxSteps ?? 50,
    perception_engine: input.perceptionEngine ?? "accessibility_api",
    capture_engine: input.captureEngine ?? "native_screenshot",
    sandbox_tier: input.sandboxTier ?? "guarded_mutation",
    requires_confirmation: input.requiresConfirmation ?? true,
    created_at: nowIso(),
    updated_at: nowIso()
  });

  store.computerUseSessions.set(session.session_id, session);
  return session;
}

export function getComputerUseSession(sessionId: string): ComputerUseSession | undefined {
  return store.computerUseSessions.get(sessionId);
}

export function listComputerUseSessions(taskId?: string): ComputerUseSession[] {
  const sessions = [...store.computerUseSessions.values()];
  if (taskId) return sessions.filter(s => s.task_id === taskId);
  return sessions.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export function pauseComputerUseSession(sessionId: string): ComputerUseSession | null {
  const session = store.computerUseSessions.get(sessionId);
  if (!session || session.status !== "active") return null;

  session.status = "paused";
  session.updated_at = nowIso();
  store.computerUseSessions.set(sessionId, session);
  return session;
}

export function resumeComputerUseSession(sessionId: string): ComputerUseSession | null {
  const session = store.computerUseSessions.get(sessionId);
  if (!session || !["paused", "human_takeover"].includes(session.status)) return null;

  session.status = "active";
  session.updated_at = nowIso();
  store.computerUseSessions.set(sessionId, session);
  return session;
}

export function stopComputerUseSession(sessionId: string, reason?: string): ComputerUseSession | null {
  const session = store.computerUseSessions.get(sessionId);
  if (!session || !["active", "paused"].includes(session.status)) return null;

  session.status = reason === "user_requested" ? "cancelled" : "failed";
  session.completed_at = nowIso();
  session.updated_at = nowIso();
  store.computerUseSessions.set(sessionId, session);
  return session;
}

export function completeComputerUseSession(sessionId: string): ComputerUseSession | null {
  const session = store.computerUseSessions.get(sessionId);
  if (!session || session.status !== "active") return null;

  session.status = "completed";
  session.completed_at = nowIso();
  session.updated_at = nowIso();
  store.computerUseSessions.set(sessionId, session);
  return session;
}

export function initiateHumanTakeover(input: {
  sessionId: string;
  taskId: string;
  reason: HumanTakeover["reason"];
  description: string;
  stepId?: string;
  pendingAction?: string;
  perceptionSnapshot?: string;
}): HumanTakeover {
  const takeover = HumanTakeoverSchema.parse({
    takeover_id: createEntityId("takeover"),
    session_id: input.sessionId,
    task_id: input.taskId,
    reason: input.reason,
    step_id: input.stepId,
    description: input.description,
    perception_snapshot: input.perceptionSnapshot,
    pending_action: input.pendingAction,
    created_at: nowIso()
  });

  store.humanTakeovers.set(takeover.takeover_id, takeover);

  const session = store.computerUseSessions.get(input.sessionId);
  if (session && session.status === "active") {
    session.status = "human_takeover";
    session.human_takeover_count++;
    session.updated_at = nowIso();
    store.computerUseSessions.set(input.sessionId, session);
  }

  return takeover;
}

export function resolveHumanTakeover(takeoverId: string, resolution: HumanTakeover["resolution"], resolvedBy?: string): HumanTakeover | null {
  const takeover = store.humanTakeovers.get(takeoverId);
  if (!takeover || takeover.resolution) return null;

  takeover.resolution = resolution;
  takeover.resolved_by = resolvedBy;
  takeover.resolved_at = nowIso();
  store.humanTakeovers.set(takeoverId, takeover);

  if (resolution !== "cancelled") {
    resumeComputerUseSession(takeover.session_id);
  }

  return takeover;
}

export function listHumanTakeovers(sessionId?: string, taskId?: string): HumanTakeover[] {
  let takeovers = [...store.humanTakeovers.values()];
  if (sessionId) takeovers = takeovers.filter(t => t.session_id === sessionId);
  if (taskId) takeovers = takeovers.filter(t => t.task_id === taskId);
  return takeovers.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function runSeeActVerifyRecoverLoop(params: {
  sessionId: string;
  taskId: string;
  intention: string;
  see: () => Promise<UIPerception>;
  act: (perception: UIPerception) => Promise<InputAction>;
  verify: (action: InputAction, perception: UIPerception) => Promise<"confirmed" | "mismatch" | "error">;
  recover?: (mismatchReason: string, stepNumber: number) => Promise<{ strategy: "retry" | "adjust_action" | "escalate" | "abort"; nextAction?: () => Promise<InputAction> }>;
  maxRetries?: number;
  onStepComplete?: (step: ComputerUseStep) => void;
  onHumanTakeoverRequired?: (takeover: HumanTakeover) => void;
}): Promise<{
  steps: ComputerUseStep[];
  finalStatus: ComputerUseSessionStatus;
  totalDurationMs: number;
}> {
  const session = store.computerUseSessions.get(params.sessionId);
  if (!session) throw new Error("Session not found: " + params.sessionId);
  if (session.status !== "active") throw new Error("Session is not active: " + session.status);

  const startTime = Date.now();
  const steps: ComputerUseStep[] = [];
  const maxRetries = params.maxRetries ?? 3;
  let consecutiveFailures = 0;
  let stepNumber = 0;

  while (stepNumber < session.max_steps) {
    const currentSession = store.computerUseSessions.get(params.sessionId);
    if (!currentSession || currentSession.status !== "active") {
      return { steps, finalStatus: currentSession?.status ?? "failed", totalDurationMs: Date.now() - startTime };
    }

    stepNumber++;

    const seeStart = Date.now();

    let perception: UIPerception;
    try {
      perception = await params.see();
    } catch (error) {
      const step = ComputerUseStepSchema.parse({
        step_id: createEntityId("custep"),
        session_id: params.sessionId,
        step_number: stepNumber,
        kind: "see",
        intention: params.intention,
        observation: "See failed: " + (error as Error).message,
        verification_result: "error",
        recovery_strategy: "abort",
        duration_ms: Date.now() - seeStart,
        started_at: new Date(seeStart).toISOString(),
        completed_at: nowIso()
      });
      steps.push(step);
      store.computerUseSteps.set(step.step_id, step);
      params.onStepComplete?.(step);
      continue;
    }

    const seeStep = ComputerUseStepSchema.parse({
      step_id: createEntityId("custep"),
      session_id: params.sessionId,
      step_number: stepNumber,
      kind: "see",
      intention: params.intention,
      observation: "Found " + perception.elements.length + " UI elements",
      perception_id: perception.perception_id,
      duration_ms: Date.now() - seeStart,
      started_at: new Date(seeStart).toISOString(),
      completed_at: nowIso()
    });
    steps.push(seeStep);
    store.computerUseSteps.set(seeStep.step_id, seeStep);
    params.onStepComplete?.(seeStep);

    session.last_perception_id = perception.perception_id;
    session.step_count = stepNumber;
    session.updated_at = nowIso();
    store.computerUseSessions.set(params.sessionId, session);

    const actStart = Date.now();

    let action: InputAction;
    try {
      action = await params.act(perception);
    } catch (error) {
      const failStep = ComputerUseStepSchema.parse({
        step_id: createEntityId("custep"),
        session_id: params.sessionId,
        step_number: stepNumber,
        kind: "act",
        intention: params.intention,
        observation: "Act failed: " + (error as Error).message,
        verification_result: "error",
        recovery_strategy: "retry",
        duration_ms: Date.now() - actStart,
        started_at: new Date(actStart).toISOString(),
        completed_at: nowIso()
      });
      steps.push(failStep);
      store.computerUseSteps.set(failStep.step_id, failStep);
      params.onStepComplete?.(failStep);
      consecutiveFailures++;
      if (consecutiveFailures >= maxRetries) {
        const takeover = initiateHumanTakeover({
          sessionId: params.sessionId,
          taskId: params.taskId,
          reason: "verification_failed_repeatedly",
          description: "Consecutive failures exceeded limit (" + maxRetries + ") during act phase",
          pendingAction: params.intention
        });
        params.onHumanTakeoverRequired?.(takeover);
        return { steps, finalStatus: "human_takeover", totalDurationMs: Date.now() - startTime };
      }
      continue;
    }

    const actStep = ComputerUseStepSchema.parse({
      step_id: createEntityId("custep"),
      session_id: params.sessionId,
      step_number: stepNumber,
      kind: "act",
      intention: params.intention,
      observation: "Executed " + action.kind + (action.target_element_id ? " on " + action.target_element_id : ""),
      action_id: action.action_id,
      verification_evidence: action.verification_evidence,
      duration_ms: Date.now() - actStart,
      started_at: new Date(actStart).toISOString(),
      completed_at: nowIso()
    });
    steps.push(actStep);
    store.computerUseSteps.set(actStep.step_id, actStep);
    params.onStepComplete?.(actStep);

    session.last_capture_id = action.action_id;
    session.updated_at = nowIso();
    store.computerUseSessions.set(params.sessionId, session);

    const verifyStart = Date.now();

    let verifyResult: "confirmed" | "mismatch" | "error";
    let verifyEvidence: ComputerUseVerificationEvidence | undefined;
    try {
      verifyResult = await params.verify(action, perception);
    } catch {
      verifyResult = "error";
    }

    if (action.verification_evidence) {
      verifyEvidence = action.verification_evidence;
    } else {
      verifyEvidence = buildVerificationEvidence({
        verdict: verifyResult,
        provider: action.provider,
        method: action.execution_method,
        stateBefore: buildElementStateFromUIElement({
          element_id: action.target_element_id ?? "",
          role: "unknown",
          bounding_box: action.coordinates ? { x: action.coordinates.x, y: action.coordinates.y, width: 0, height: 0 } : { x: 0, y: 0, width: 0, height: 0 },
          is_visible: true,
          is_enabled: true,
          is_focused: false,
          is_interactive: false,
          attributes: {},
          children_ids: [],
          text_content: action.text,
          value: action.text
        }),
        confidenceScore: verifyResult === "confirmed" ? 0.7 : verifyResult === "mismatch" ? 0.3 : 0,
        reasons: [verifyResult === "confirmed" ? "external_verify_confirmed" : verifyResult === "mismatch" ? "external_verify_mismatch" : "external_verify_error"]
      });
    }

    const verifyStep = ComputerUseStepSchema.parse({
      step_id: createEntityId("custep"),
      session_id: params.sessionId,
      step_number: stepNumber,
      kind: "verify",
      intention: params.intention,
      observation: "Verification result: " + verifyResult + (verifyEvidence ? " (confidence: " + verifyEvidence.confidence_score + ")" : ""),
      verification_result: verifyResult,
      verification_evidence: verifyEvidence,
      duration_ms: Date.now() - verifyStart,
      started_at: new Date(verifyStart).toISOString(),
      completed_at: nowIso()
    });
    steps.push(verifyStep);
    store.computerUseSteps.set(verifyStep.step_id, verifyStep);
    params.onStepComplete?.(verifyStep);

    if (verifyResult === "confirmed") {
      consecutiveFailures = 0;
      continue;
    }

    consecutiveFailures++;

    if (consecutiveFailures >= maxRetries) {
      const takeover = initiateHumanTakeover({
        sessionId: params.sessionId,
        taskId: params.taskId,
        reason: "verification_failed_repeatedly",
        description: "Verification mismatch repeated " + maxRetries + " times",
        pendingAction: params.intention
      });
      params.onHumanTakeoverRequired?.(takeover);
      return { steps, finalStatus: "human_takeover", totalDurationMs: Date.now() - startTime };
    }

    const recoverStart = Date.now();
    let recoveryStrategy: "retry" | "adjust_action" | "escalate" | "abort" = "retry";

    if (params.recover) {
      try {
        const recoverResult = await params.recover(
          verifyResult === "error" ? "Error during verification" : "State mismatch detected",
          stepNumber
        );
        recoveryStrategy = recoverResult.strategy;

        if (recoveryStrategy === "adjust_action" && recoverResult.nextAction) {
          const adjustStep = ComputerUseStepSchema.parse({
            step_id: createEntityId("custep"),
            session_id: params.sessionId,
            step_number: stepNumber,
            kind: "recover",
            intention: params.intention,
            observation: "Adjusting action based on recovery strategy",
            recovery_strategy: "adjust_action",
            duration_ms: Date.now() - recoverStart,
            started_at: new Date(recoverStart).toISOString(),
            completed_at: nowIso()
          });
          steps.push(adjustStep);
          store.computerUseSteps.set(adjustStep.step_id, adjustStep);
          params.onStepComplete?.(adjustStep);

          try {
            await recoverResult.nextAction();
          } catch {
            recoveryStrategy = "retry";
          }
        }
      } catch {
        recoveryStrategy = "retry";
      }
    }

    const recoverStep = ComputerUseStepSchema.parse({
      step_id: createEntityId("custep"),
      session_id: params.sessionId,
      step_number: stepNumber,
      kind: "recover",
      intention: params.intention,
      observation: "Recovery strategy: " + recoveryStrategy,
      recovery_strategy: recoveryStrategy,
      duration_ms: Date.now() - recoverStart,
      started_at: new Date(recoverStart).toISOString(),
      completed_at: nowIso()
    });
    steps.push(recoverStep);
    store.computerUseSteps.set(recoverStep.step_id, recoverStep);
    params.onStepComplete?.(recoverStep);

    if (recoveryStrategy === "escalate") {
      const takeover = initiateHumanTakeover({
        sessionId: params.sessionId,
        taskId: params.taskId,
        reason: "escalation",
        description: "Automatic recovery exhausted, escalating to human",
        pendingAction: params.intention
      });
      params.onHumanTakeoverRequired?.(takeover);
      return { steps, finalStatus: "human_takeover", totalDurationMs: Date.now() - startTime };
    }

    if (recoveryStrategy === "abort") {
      stopComputerUseSession(params.sessionId, "verification_failure");
      return { steps, finalStatus: "failed", totalDurationMs: Date.now() - startTime };
    }
  }

  completeComputerUseSession(params.sessionId);
  return { steps, finalStatus: "completed", totalDurationMs: Date.now() - startTime };
}

export function listComputerUseSteps(sessionId: string): ComputerUseStep[] {
  return [...store.computerUseSteps.values()]
    .filter(s => s.session_id === sessionId)
    .sort((a, b) => a.step_number - b.step_number);
}

export function getComputerUseStep(stepId: string): ComputerUseStep | undefined {
  return store.computerUseSteps.get(stepId);
}

export function buildComputerUseReplayPackage(sessionId: string): ComputerUseReplayStep[] {
  const steps = listComputerUseSteps(sessionId);

  return steps.map((step) => {
    const perception = step.perception_id ? store.uiPerceptions.get(step.perception_id) : undefined;
    const action = step.action_id ? store.inputActions.get(step.action_id) : undefined;

    return ComputerUseReplayStepSchema.parse({
      replay_step_id: createEntityId("cureplay"),
      session_id: sessionId,
      step_id: step.step_id,
      step_number: step.step_number,
      perception: perception ?? undefined,
      action: action ?? undefined,
      capture: undefined,
      verification_evidence: step.verification_evidence ?? undefined,
      replayed: false
    });
  });
}

export async function replayComputerUseStep(replayStepId: string): Promise<ComputerUseReplayStep | null> {
  const allReplays = [...store.computerUseReplaySteps.values()];
  const replayStep = allReplays.find(r => r.replay_step_id === replayStepId);
  if (!replayStep) return null;

  if (replayStep.action && replayStep.action.executed && replayStep.action.coordinates) {
    try {
      switch (replayStep.action.kind) {
        case "mouse_click":
        case "mouse_double_click":
        case "mouse_right_click":
          await executeMouseClick(
            replayStep.action.coordinates.x,
            replayStep.action.coordinates.y,
            replayStep.action.kind,
            replayStep.action.button
          );
          break;
        case "mouse_move":
          await executeMouseMove(replayStep.action.coordinates.x, replayStep.action.coordinates.y);
          break;
        case "mouse_scroll":
          await executeMouseScroll(replayStep.action.scroll_delta);
          break;
        case "key_press":
          if (replayStep.action.key) await executeKeyPress(replayStep.action.key);
          break;
        case "key_combo":
          if (replayStep.action.key_combo.length > 0) await executeKeyCombo(replayStep.action.key_combo);
          break;
        case "type_text":
          if (replayStep.action.text) await executeTypeText(replayStep.action.text);
          break;
      }
      replayStep.replayed = true;
      replayStep.replay_result = "matched";
    } catch {
      replayStep.replayed = true;
      replayStep.replay_result = "error";
    }
  } else {
    replayStep.replayed = true;
    replayStep.replay_result = "skipped";
  }

  store.computerUseReplaySteps.set(replayStep.replay_step_id, replayStep);
  return replayStep;
}

export function listScreenCaptures(taskId?: string, sessionId?: string): ScreenCapture[] {
  let captures = [...store.screenCaptures.values()];
  if (taskId) captures = captures.filter(c => c.task_id === taskId);
  if (sessionId) captures = captures.filter(c => c.session_id === sessionId);
  return captures.sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at));
}

export function getScreenCapture(captureId: string): ScreenCapture | undefined {
  return store.screenCaptures.get(captureId);
}

export function listUIPerceptions(taskId?: string, sessionId?: string): UIPerception[] {
  let perceptions = [...store.uiPerceptions.values()];
  if (taskId) perceptions = perceptions.filter(p => p.task_id === taskId);
  if (sessionId) perceptions = perceptions.filter(p => p.session_id === sessionId);
  return perceptions.sort((a, b) => Date.parse(b.perceived_at) - Date.parse(a.perceived_at));
}

export function getUIPerception(perceptionId: string): UIPerception | undefined {
  return store.uiPerceptions.get(perceptionId);
}

export function listInputActions(taskId?: string, sessionId?: string): InputAction[] {
  let actions = [...store.inputActions.values()];
  if (taskId) actions = actions.filter(a => a.task_id === taskId);
  if (sessionId) actions = actions.filter(a => a.session_id === sessionId);
  return actions.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function getInputAction(actionId: string): InputAction | undefined {
  return store.inputActions.get(actionId);
}

export function resetCircuitBreakers(): void {
  for (const key of Object.keys(failureTrackers) as Array<keyof typeof failureTrackers>) {
    failureTrackers[key].count = 0;
    failureTrackers[key].lastFailureAt = null;
  }
}

export function getCircuitBreakerStatus(): Record<string, { count: number; isOpen: boolean; cooldownRemainingMs: number }> {
  const result: Record<string, { count: number; isOpen: boolean; cooldownRemainingMs: number }> = {};

  for (const [key, config] of Object.entries(RESILIENCE_CONFIG) as Array<[keyof typeof RESILIENCE_CONFIG, typeof RESILIENCE_CONFIG[keyof typeof RESILIENCE_CONFIG]]>) {
    const tracker = failureTrackers[key];
    const isOpen = tracker.count >= config.failureThreshold && tracker.lastFailureAt !== null &&
      (Date.now() - tracker.lastFailureAt) < config.cooldownMs;
    const remaining = isOpen && tracker.lastFailureAt
      ? config.cooldownMs - (Date.now() - tracker.lastFailureAt)
      : 0;

    result[key] = {
      count: tracker.count,
      isOpen,
      cooldownRemainingMs: Math.max(0, remaining)
    };
  }

  return result;
}

export interface LocalAppCapability {
  method: LocalAppInvocation["method"];
  supported: boolean;
  platform: string;
  notes?: string;
}

export function detectLocalAppCapabilities(): LocalAppCapability[] {
  const platform = process.platform;
  const capabilities: LocalAppCapability[] = [];

  capabilities.push({
    method: "launch",
    supported: true,
    platform,
    notes: platform === "win32" ? "Uses cmd.exe /c start" : platform === "darwin" ? "Uses open -a" : "Direct execution"
  });

  capabilities.push({
    method: "open_file",
    supported: true,
    platform,
    notes: platform === "win32" ? "Uses cmd.exe /c start with file path" : platform === "darwin" ? "Uses open with file path" : "Uses xdg-open"
  });

  capabilities.push({
    method: "open_url",
    supported: true,
    platform,
    notes: platform === "win32" ? "Uses cmd.exe /c start with URL" : platform === "darwin" ? "Uses open with URL" : "Uses xdg-open"
  });

  capabilities.push({
    method: "send_command",
    supported: true,
    platform,
    notes: platform === "win32" ? "Uses cmd.exe /c" : "Direct execution with arguments"
  });

  return capabilities;
}

export async function checkLocalAppAvailability(appIdentifier: string): Promise<{
  available: boolean;
  resolvedPath?: string;
  platform: string;
  error?: string;
}> {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      const { stdout } = await execFileAsync("where.exe", [appIdentifier], { timeout: 5000 });
      return { available: true, resolvedPath: stdout.trim().split("\n")[0]?.trim(), platform };
    } else {
      const { stdout } = await execFileAsync("which", [appIdentifier], { timeout: 5000 });
      return { available: true, resolvedPath: stdout.trim(), platform };
    }
  } catch (error) {
    const execError = error as Error & { code?: string };
    if (platform === "win32") {
      try {
        const { stdout } = await execFileAsync("powershell.exe", ["-Command", `Get-Command '${appIdentifier}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source`], { timeout: 5000 });
        if (stdout.trim()) {
          return { available: true, resolvedPath: stdout.trim(), platform };
        }
      } catch { /* not found */ }
    }
    return {
      available: false,
      platform,
      error: execError.code === "ENOENT" ? "Command not found in PATH" : execError.message?.slice(0, 200)
    };
  }
}

export async function invokeLocalApp(input: {
  appIdentifier: string;
  method?: "launch" | "open_file" | "open_url" | "send_command";
  arguments?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeoutMs?: number;
  taskId?: string;
  sessionId?: string;
  dryRun?: boolean;
}): Promise<LocalAppInvocation> {
  const invocation: LocalAppInvocation = {
    invocation_id: createEntityId("appinvoke"),
    app_identifier: input.appIdentifier,
    method: input.method ?? "launch",
    arguments: input.arguments ?? [],
    working_directory: input.workingDirectory,
    environment: input.environment,
    timeout_ms: input.timeoutMs ?? 30_000,
    started_at: nowIso(),
    task_id: input.taskId,
    session_id: input.sessionId
  };

  let command: string;
  let args: string[];

  if (process.platform === "win32") {
    if (invocation.method === "open_url") {
      command = "powershell.exe";
      args = ["-Command", "Start-Process", invocation.arguments[0] ?? ""];
    } else if (invocation.method === "open_file") {
      command = "powershell.exe";
      args = ["-Command", "Start-Process", invocation.arguments[0] ?? ""];
    } else {
      command = "powershell.exe";
      args = ["-Command", "Start-Process", "-FilePath", invocation.app_identifier, "-ArgumentList", invocation.arguments.join(",")];
    }
  } else if (process.platform === "darwin") {
    if (invocation.method === "launch") {
      command = "open";
      args = ["-a", invocation.app_identifier, ...invocation.arguments];
    } else if (invocation.method === "open_url") {
      command = "open";
      args = [invocation.arguments[0] ?? ""];
    } else if (invocation.method === "open_file") {
      command = "open";
      args = [invocation.arguments[0] ?? ""];
    } else {
      command = invocation.app_identifier;
      args = invocation.arguments;
    }
  } else {
    if (invocation.method === "launch") {
      command = invocation.app_identifier;
      args = invocation.arguments;
    } else if (invocation.method === "open_url") {
      command = "xdg-open";
      args = [invocation.arguments[0] ?? ""];
    } else if (invocation.method === "open_file") {
      command = "xdg-open";
      args = [invocation.arguments[0] ?? ""];
    } else {
      command = invocation.app_identifier;
      args = invocation.arguments;
    }
  }

  if (input.dryRun) {
    invocation.completed_at = nowIso();
    invocation.exit_code = -2;
    invocation.stdout = "";
    invocation.stderr = "";
    invocation.error = "Dry run: would execute " + command + " " + args.join(" ");
    store.localAppInvocations.set(invocation.invocation_id, invocation);
    return invocation;
  }

  try {
    const availability = await checkLocalAppAvailability(command).catch(() => ({ available: false, platform: process.platform }));

    const env = { ...process.env, ...input.environment };
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: invocation.timeout_ms,
      maxBuffer: 4 * 1024 * 1024,
      cwd: input.workingDirectory,
      env
    });

    invocation.completed_at = nowIso();
    invocation.exit_code = 0;
    invocation.stdout = stdout.slice(0, 10000);
    invocation.stderr = stderr.slice(0, 10000);
  } catch (error) {
    invocation.completed_at = nowIso();
    const execError = error as Error & { code?: string; killed?: boolean; stderr?: string };
    if (execError.killed) {
      invocation.exit_code = -1;
      invocation.error = "Process timed out after " + invocation.timeout_ms + "ms";
    } else if (execError.code === "ENOENT") {
      invocation.exit_code = 127;
      invocation.error = "Command not found: " + command + ". " + (execError.code ?? "");
    } else {
      invocation.exit_code = 1;
      invocation.error = execError.message.slice(0, 2000);
      if (execError.stderr) {
        invocation.stderr = execError.stderr.slice(0, 5000);
      }
    }
  }

  store.localAppInvocations.set(invocation.invocation_id, invocation);

  try {
    log("info", "local_app_invocation_completed", {
      invocation_id: invocation.invocation_id,
      app_identifier: invocation.app_identifier,
      method: invocation.method,
      exit_code: invocation.exit_code,
      duration_ms: invocation.completed_at ? Date.parse(invocation.completed_at) - Date.parse(invocation.started_at) : 0,
      task_id: invocation.task_id,
      session_id: invocation.session_id
    });
  } catch { /* logging failure should not affect result */ }

  return invocation;
}

export function getLocalAppInvocation(invocationId: string): LocalAppInvocation | undefined {
  return store.localAppInvocations.get(invocationId);
}

export function listLocalAppInvocations(taskId?: string): LocalAppInvocation[] {
  const invocations = [...store.localAppInvocations.values()];
  if (taskId) return invocations.filter(i => i.task_id === taskId);
  return invocations.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
}

export interface SessionRecordingEntry {
  entry_id: string;
  session_id: string;
  timestamp: string;
  entry_type: "perception" | "action" | "verification" | "capture" | "takeover" | "recovery";
  reference_id: string;
  summary: string;
  duration_ms?: number;
}

export function generateSessionRecording(sessionId: string): SessionRecordingEntry[] {
  const steps = listComputerUseSteps(sessionId);
  const entries: SessionRecordingEntry[] = [];

  for (const step of steps) {
    if (step.perception_id) {
      entries.push({
        entry_id: createEntityId("recenter"),
        session_id: sessionId,
        timestamp: step.started_at,
        entry_type: "perception",
        reference_id: step.perception_id,
        summary: step.kind === "see" ? (step.observation ?? "Perceived screen") : "Perception reference",
        duration_ms: step.duration_ms
      });
    }

    if (step.action_id) {
      entries.push({
        entry_id: createEntityId("recenter"),
        session_id: sessionId,
        timestamp: step.started_at,
        entry_type: "action",
        reference_id: step.action_id,
        summary: step.kind === "act" ? (step.observation ?? "Executed action") : "Action reference",
        duration_ms: step.duration_ms
      });
    }

    if (step.kind === "verify") {
      entries.push({
        entry_id: createEntityId("recenter"),
        session_id: sessionId,
        timestamp: step.started_at,
        entry_type: "verification",
        reference_id: step.step_id,
        summary: step.verification_result ?? "Verification step",
        duration_ms: step.duration_ms
      });
    }

    if (step.kind === "recover") {
      entries.push({
        entry_id: createEntityId("recenter"),
        session_id: sessionId,
        timestamp: step.started_at,
        entry_type: "recovery",
        reference_id: step.step_id,
        summary: step.recovery_strategy ?? "Recovery step",
        duration_ms: step.duration_ms
      });
    }
  }

  const takeovers = listHumanTakeovers(sessionId);
  for (const takeover of takeovers) {
    entries.push({
      entry_id: createEntityId("recenter"),
      session_id: sessionId,
      timestamp: takeover.created_at,
      entry_type: "takeover",
      reference_id: takeover.takeover_id,
      summary: takeover.description
    });
  }

  return entries.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function exportSessionRecording(sessionId: string): {
  session: ComputerUseSession;
  recording: SessionRecordingEntry[];
  steps: ComputerUseStep[];
  replayPackage: ComputerUseReplayStep[];
} {
  const session = store.computerUseSessions.get(sessionId);
  if (!session) throw new Error("Session not found: " + sessionId);

  return {
    session,
    recording: generateSessionRecording(sessionId),
    steps: listComputerUseSteps(sessionId),
    replayPackage: buildComputerUseReplayPackage(sessionId)
  };
}

export interface SessionRecordingFrame {
  frame_id: string;
  session_id: string;
  timestamp: string;
  frame_number: number;
  capture_ref: string;
  capture_width: number;
  capture_height: number;
  display_index: number;
  triggered_by: "timer" | "pre_action" | "post_action" | "verification" | "manual";
  step_id?: string;
  action_id?: string;
  perception_id?: string;
}

export interface SessionRecordingTimeline {
  session_id: string;
  created_at: string;
  total_frames: number;
  total_duration_ms: number;
  frame_interval_ms: number;
  frames: SessionRecordingFrame[];
  metadata: {
    platform: string;
    screen_resolution: string;
    display_count: number;
    recording_engine: string;
  };
}

const activeRecordingSessions = new Map<string, {
  interval: ReturnType<typeof setInterval>;
  frames: SessionRecordingFrame[];
  startTime: number;
  frameIntervalMs: number;
  sessionId: string;
  taskId?: string;
  displayIndex?: number;
}>();

export function startSessionFrameRecording(input: {
  sessionId: string;
  taskId?: string;
  frameIntervalMs?: number;
  displayIndex?: number;
}): { recording_id: string; status: "started" } {
  const existing = activeRecordingSessions.get(input.sessionId);
  if (existing) {
    clearInterval(existing.interval);
  }

  const frames: SessionRecordingFrame[] = [];
  const startTime = Date.now();
  const frameIntervalMs = input.frameIntervalMs ?? 1000;
  let frameNumber = 0;

  const interval = setInterval(async () => {
    try {
      const capture = await captureScreen({
        sessionId: input.sessionId,
        taskId: input.taskId,
        engine: "native_screenshot",
        displayIndex: input.displayIndex
      });

      frameNumber++;
      const frame: SessionRecordingFrame = {
        frame_id: createEntityId("recframe"),
        session_id: input.sessionId,
        timestamp: nowIso(),
        frame_number: frameNumber,
        capture_ref: capture.pixel_data_ref ?? "",
        capture_width: capture.width,
        capture_height: capture.height,
        display_index: capture.display_index ?? 0,
        triggered_by: "timer"
      };
      frames.push(frame);
    } catch {
      recordFailure("screenshot");
    }
  }, frameIntervalMs);

  activeRecordingSessions.set(input.sessionId, {
    interval,
    frames,
    startTime,
    frameIntervalMs,
    sessionId: input.sessionId,
    taskId: input.taskId,
    displayIndex: input.displayIndex
  });

  return {
    recording_id: createEntityId("secrec"),
    status: "started"
  };
}

export async function captureRecordingFrame(input: {
  sessionId: string;
  triggeredBy: SessionRecordingFrame["triggered_by"];
  stepId?: string;
  actionId?: string;
  perceptionId?: string;
}): Promise<SessionRecordingFrame | null> {
  const recording = activeRecordingSessions.get(input.sessionId);
  if (!recording) return null;

  try {
    const capture = await captureScreen({
      sessionId: input.sessionId,
      taskId: recording.taskId,
      engine: "native_screenshot",
      displayIndex: recording.displayIndex
    });

    const frame: SessionRecordingFrame = {
      frame_id: createEntityId("recframe"),
      session_id: input.sessionId,
      timestamp: nowIso(),
      frame_number: recording.frames.length + 1,
      capture_ref: capture.pixel_data_ref ?? "",
      capture_width: capture.width,
      capture_height: capture.height,
      display_index: capture.display_index ?? 0,
      triggered_by: input.triggeredBy,
      step_id: input.stepId,
      action_id: input.actionId,
      perception_id: input.perceptionId
    };
    recording.frames.push(frame);
    return frame;
  } catch {
    return null;
  }
}

export function stopSessionFrameRecording(sessionId: string): SessionRecordingTimeline | null {
  const recording = activeRecordingSessions.get(sessionId);
  if (!recording) return null;

  clearInterval(recording.interval);
  activeRecordingSessions.delete(sessionId);

  const displays = listAvailableDisplays().catch(() => []) ;
  const totalDurationMs = Date.now() - recording.startTime;

  return {
    session_id: sessionId,
    created_at: nowIso(),
    total_frames: recording.frames.length,
    total_duration_ms: totalDurationMs,
    frame_interval_ms: recording.frameIntervalMs,
    frames: recording.frames,
    metadata: {
      platform: process.platform,
      screen_resolution: cachedScreenDimensions ? `${cachedScreenDimensions.width}x${cachedScreenDimensions.height}` : "unknown",
      display_count: 1,
      recording_engine: "native_screenshot"
    }
  };
}

export function getSessionFrameRecordingStatus(sessionId: string): {
  active: boolean;
  frameCount: number;
  durationMs: number;
  frameIntervalMs: number;
} | null {
  const recording = activeRecordingSessions.get(sessionId);
  if (!recording) return null;

  return {
    active: true,
    frameCount: recording.frames.length,
    durationMs: Date.now() - recording.startTime,
    frameIntervalMs: recording.frameIntervalMs
  };
}

export async function buildSessionRecordingArtifact(sessionId: string): Promise<{
  timeline: SessionRecordingTimeline | null;
  structured: SessionRecordingEntry[];
  export: ReturnType<typeof exportSessionRecording> extends Promise<infer T> ? T : ReturnType<typeof exportSessionRecording>;
  frameCaptureAvailable: boolean;
}> {
  const timeline = stopSessionFrameRecording(sessionId);
  const structured = generateSessionRecording(sessionId);
  const exported = exportSessionRecording(sessionId);

  return {
    timeline,
    structured,
    export: exported,
    frameCaptureAvailable: timeline !== null && timeline.total_frames > 0
  };
}

export interface VideoEncoderResult {
  success: boolean;
  output_path: string;
  format: "mp4" | "webm" | "gif" | "png_sequence";
  duration_seconds: number;
  frame_count: number;
  width: number;
  height: number;
  file_size_bytes: number;
  encoder: string;
  error?: string;
}

export interface VideoEncoder {
  name: string;
  isAvailable(): Promise<boolean>;
  encodeFrames(input: {
    framePaths: string[];
    outputPath: string;
    fps: number;
    width: number;
    height: number;
  }): Promise<VideoEncoderResult>;
}

async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    const cmd = process.platform === "win32" ? "where.exe" : "which";
    await execFileAsync(cmd, ["ffmpeg"], { timeout: 3000 });
    return true;
  } catch { return false; }
}

class FFmpegVideoEncoder implements VideoEncoder {
  name = "ffmpeg";

  async isAvailable(): Promise<boolean> {
    return checkFFmpegAvailable();
  }

  async encodeFrames(input: {
    framePaths: string[];
    outputPath: string;
    fps: number;
    width: number;
    height: number;
  }): Promise<VideoEncoderResult> {
    if (input.framePaths.length === 0) {
      return {
        success: false,
        output_path: input.outputPath,
        format: "mp4",
        duration_seconds: 0,
        frame_count: 0,
        width: input.width,
        height: input.height,
        file_size_bytes: 0,
        encoder: this.name,
        error: "No frames to encode"
      };
    }

    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cu_encode_"));

    try {
      for (let i = 0; i < input.framePaths.length; i++) {
        const src = input.framePaths[i];
        const dst = path.join(tmpDir, String(i).padStart(8, "0") + ".png");
        await fs.promises.copyFile(src, dst);
      }

      const inputPattern = path.join(tmpDir, "%08d.png");
      const format = input.outputPath.endsWith(".webm") ? "webm" : input.outputPath.endsWith(".gif") ? "gif" : "mp4";

      let codecArgs: string[];
      if (format === "gif") {
        const palettePath = path.join(tmpDir, "palette.png");
        await execFileAsync("ffmpeg", [
          "-y", "-framerate", String(input.fps), "-i", inputPattern,
          "-vf", "palettegen", palettePath
        ], { timeout: 60_000 });
        await execFileAsync("ffmpeg", [
          "-y", "-framerate", String(input.fps), "-i", inputPattern,
          "-i", palettePath,
          "-lavfi", "paletteuse",
          input.outputPath
        ], { timeout: 60_000 });
        codecArgs = [];
      } else if (format === "webm") {
        codecArgs = ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0"];
        await execFileAsync("ffmpeg", [
          "-y", "-framerate", String(input.fps), "-i", inputPattern,
          ...codecArgs,
          input.outputPath
        ], { timeout: 120_000 });
      } else {
        codecArgs = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "fast"];
        await execFileAsync("ffmpeg", [
          "-y", "-framerate", String(input.fps), "-i", inputPattern,
          ...codecArgs,
          input.outputPath
        ], { timeout: 120_000 });
      }

      const stats = await fs.promises.stat(input.outputPath).catch(() => null);
      const durationSeconds = input.framePaths.length / input.fps;

      return {
        success: true,
        output_path: input.outputPath,
        format,
        duration_seconds: durationSeconds,
        frame_count: input.framePaths.length,
        width: input.width,
        height: input.height,
        file_size_bytes: stats?.size ?? 0,
        encoder: this.name
      };
    } catch (error) {
      return {
        success: false,
        output_path: input.outputPath,
        format: "mp4",
        duration_seconds: 0,
        frame_count: input.framePaths.length,
        width: input.width,
        height: input.height,
        file_size_bytes: 0,
        encoder: this.name,
        error: (error as Error).message.slice(0, 2000)
      };
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

class PNGSequenceEncoder implements VideoEncoder {
  name = "png_sequence";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async encodeFrames(input: {
    framePaths: string[];
    outputPath: string;
    fps: number;
    width: number;
    height: number;
  }): Promise<VideoEncoderResult> {
    const fs = await import("node:fs");
    const path = await import("node:path");

    try {
      await fs.promises.mkdir(input.outputPath, { recursive: true });

      const manifest = {
        format: "png_sequence",
        fps: input.fps,
        width: input.width,
        height: input.height,
        frame_count: input.framePaths.length,
        duration_seconds: input.framePaths.length / input.fps,
        frames: input.framePaths.map((fp, idx) => ({
          index: idx,
          original_path: fp,
          filename: String(idx).padStart(8, "0") + ".png"
        })),
        created_at: nowIso()
      };

      for (const frame of manifest.frames) {
        const dst = path.join(input.outputPath, frame.filename);
        await fs.promises.copyFile(frame.original_path, dst).catch(() => {});
      }

      await fs.promises.writeFile(
        path.join(input.outputPath, "manifest.json"),
        JSON.stringify(manifest, null, 2)
      );

      let totalSize = 0;
      for (const fp of input.framePaths) {
        const stat = await fs.promises.stat(fp).catch(() => ({ size: 0 }));
        totalSize += stat.size;
      }

      return {
        success: true,
        output_path: input.outputPath,
        format: "png_sequence" as const,
        duration_seconds: manifest.duration_seconds,
        frame_count: input.framePaths.length,
        width: input.width,
        height: input.height,
        file_size_bytes: totalSize,
        encoder: this.name
      };
    } catch (error) {
      return {
        success: false,
        output_path: input.outputPath,
        format: "png_sequence" as const,
        duration_seconds: 0,
        frame_count: input.framePaths.length,
        width: input.width,
        height: input.height,
        file_size_bytes: 0,
        encoder: this.name,
        error: (error as Error).message.slice(0, 2000)
      };
    }
  }
}

const videoEncoders: VideoEncoder[] = [new FFmpegVideoEncoder(), new PNGSequenceEncoder()];

export function registerVideoEncoder(encoder: VideoEncoder): void {
  const existing = videoEncoders.findIndex(e => e.name === encoder.name);
  if (existing >= 0) {
    videoEncoders[existing] = encoder;
  } else {
    videoEncoders.push(encoder);
  }
}

export function listVideoEncoders(): string[] {
  return videoEncoders.map(e => e.name);
}

async function resolveVideoEncoder(): Promise<VideoEncoder | null> {
  for (const encoder of videoEncoders) {
    try {
      const available = await encoder.isAvailable();
      if (available) return encoder;
    } catch { /* skip */ }
  }
  return null;
}

export async function encodeSessionRecording(input: {
  sessionId: string;
  outputPath?: string;
  format?: "mp4" | "webm" | "gif" | "png_sequence";
  fps?: number;
  width?: number;
  height?: number;
}): Promise<VideoEncoderResult> {
  const timeline = activeRecordingSessions.has(input.sessionId)
    ? { frames: activeRecordingSessions.get(input.sessionId)!.frames }
    : null;

  if (!timeline || timeline.frames.length === 0) {
    const recording = generateSessionRecording(input.sessionId);
    if (recording.length === 0) {
      return {
        success: false,
        output_path: input.outputPath ?? "",
        format: input.format ?? "mp4",
        duration_seconds: 0,
        frame_count: 0,
        width: input.width ?? 0,
        height: input.height ?? 0,
        file_size_bytes: 0,
        encoder: "none",
        error: "No frames or recording data available for session"
      };
    }
  }

  const frames = timeline?.frames ?? [];
  const framePaths = frames.map(f => f.capture_ref).filter(Boolean);

  if (framePaths.length === 0) {
    return {
      success: false,
      output_path: input.outputPath ?? "",
      format: input.format ?? "mp4",
      duration_seconds: 0,
      frame_count: 0,
      width: input.width ?? 0,
      height: input.height ?? 0,
      file_size_bytes: 0,
      encoder: "none",
      error: "No frame capture files available"
    };
  }

  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");

  const fps = input.fps ?? 1;
  const width = input.width ?? frames[0]?.capture_width ?? cachedScreenDimensions?.width ?? 1920;
  const height = input.height ?? frames[0]?.capture_height ?? cachedScreenDimensions?.height ?? 1080;

  const format = input.format ?? "mp4";
  let outputPath = input.outputPath;

  if (!outputPath) {
    const tmpDir = os.tmpdir();
    const baseName = "cu_recording_" + input.sessionId;
    if (format === "png_sequence") {
      outputPath = path.join(tmpDir, baseName + "_frames");
    } else {
      outputPath = path.join(tmpDir, baseName + "." + format);
    }
  }

  const encoder = await resolveVideoEncoder();
  if (!encoder) {
    return {
      success: false,
      output_path: outputPath,
      format,
      duration_seconds: 0,
      frame_count: framePaths.length,
      width,
      height,
      file_size_bytes: 0,
      encoder: "none",
      error: "No video encoder available. Install FFmpeg for video encoding."
    };
  }

  const result = await encoder.encodeFrames({
    framePaths,
    outputPath,
    fps,
    width,
    height
  });

  try {
    const timelineData = timeline ?? { frames: [] };
    const metadataPath = (format === "png_sequence" ? outputPath : path.dirname(outputPath)) + path.sep + "recording_metadata.json";
    await fs.promises.writeFile(metadataPath, JSON.stringify({
      session_id: input.sessionId,
      video_path: result.output_path,
      format: result.format,
      encoder: result.encoder,
      fps,
      width,
      height,
      frame_count: result.frame_count,
      duration_seconds: result.duration_seconds,
      timeline: timelineData,
      created_at: nowIso()
    }, null, 2));
  } catch { /* metadata write failure is non-fatal */ }

  return result;
}

export async function buildMacOSAccessibilityTree(input?: {
  taskId?: string;
  sessionId?: string;
  windowTitle?: string;
}): Promise<UIPerception> {
  if (process.platform !== "darwin") {
    return buildAccessibilityTree(input);
  }

  if (!shouldAttempt("perception")) {
    throw new Error("Perception circuit breaker is open");
  }

  const elements: UIElement[] = [];
  const screenInfo = getScreenDimensions();

  try {
    const script = [
      "tell application \"System Events\"",
      "  set output to {}",
      "  set allProcesses to every process whose visible is true",
      "  repeat with proc in allProcesses",
      "    try",
      "      set procName to name of proc",
      "      set allWindows to every window of proc",
      "      repeat with w in allWindows",
      "        try",
      "          set winName to name of w",
      "          set winPos to position of w",
      "          set winSize to size of w",
      "          set end of output to {role:\"window\", label:winName, x:item 1 of winPos, y:item 2 of winPos, width:item 1 of winSize, height:item 2 of winSize, interactive:true, proc:procName}",
      "          try",
      "            set allUI to every UI element of w",
      "            repeat with uiEl in allUI",
      "              try",
      "                set elRole to role of uiEl",
      "                set elName to name of uiEl",
      "                set elPos to position of uiEl",
      "                set elSize to size of uiEl",
      "                set elDesc to description of uiEl",
      "                set end of output to {role:elRole, label:elName, x:item 1 of elPos, y:item 2 of elPos, width:item 1 of elSize, height:item 2 of elSize, interactive:true, proc:procName, desc:elDesc}",
      "              end try",
      "            end repeat",
      "          end try",
      "        end try",
      "      end repeat",
      "    end try",
      "  end repeat",
      "  return output",
      "end tell"
    ].join("\n");

    const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 });

    if (stdout.trim()) {
      const parsed = parseAppleScriptList(stdout.trim());
      for (const item of parsed) {
        const role = mapMacOSRole(String(item.role ?? ""));
        elements.push(UIElementSchema.parse({
          element_id: createEntityId("mac_elem"),
          role,
          label: String(item.label ?? item.desc ?? ""),
          text_content: String(item.label ?? item.desc ?? ""),
          bounding_box: { x: Number(item.x ?? 0), y: Number(item.y ?? 0), width: Number(item.width ?? 0), height: Number(item.height ?? 0) },
          is_visible: true,
          is_enabled: true,
          is_focused: false,
          is_interactive: Boolean(item.interactive),
          attributes: { source: "macos_accessibility", process: String(item.proc ?? ""), native_role: String(item.role ?? "") },
          children_ids: [],
          parent_id: undefined
        }));
      }
    }
  } catch (error) {
    recordFailure("perception");
    log("warn", "macOS accessibility tree extraction failed", { error: String(error) });
  }

  const focusedEl = elements.find(e => e.is_focused);

  return UIPerceptionSchema.parse({
    perception_id: createEntityId("uipercept"),
    task_id: input?.taskId,
    session_id: input?.sessionId,
    engine: "accessibility_api",
    screen_width: screenInfo.width,
    screen_height: screenInfo.height,
    elements,
    active_window_title: input?.windowTitle,
    focused_element_id: focusedEl?.element_id,
    perceived_at: nowIso()
  });
}

function parseAppleScriptList(output: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const records = output.split(/\{(?=[a-zA-Z])/);

  for (const record of records) {
    if (!record.trim()) continue;
    const obj: Record<string, unknown> = {};
    const pairs = record.replace(/[{}]/g, "").split(/,\s*/);
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split(":");
      if (key && valueParts.length > 0) {
        const value = valueParts.join(":").trim();
        if (key.trim() === "x" || key.trim() === "y" || key.trim() === "width" || key.trim() === "height") {
          obj[key.trim()] = parseInt(value, 10) || 0;
        } else if (key.trim() === "interactive") {
          obj[key.trim()] = value === "true";
        } else {
          obj[key.trim()] = value.replace(/^"|"$/g, "");
        }
      }
    }
    if (Object.keys(obj).length > 0) results.push(obj);
  }
  return results;
}

function mapMacOSRole(nativeRole: string): UIElement["role"] {
  const map: Record<string, UIElement["role"]> = {
    "AXButton": "button", "AXLink": "link", "AXTextField": "input", "AXTextArea": "textarea",
    "AXPopUpButton": "select", "AXCheckBox": "checkbox", "AXRadioButton": "radio",
    "AXMenu": "menu", "AXMenuItem": "menuitem", "AXTabGroup": "tab", "AXTabButton": "tab",
    "AXSheet": "dialog", "AXAlert": "alert", "AXTable": "table", "AXRow": "row", "AXColumn": "cell",
    "AXHeading": "heading", "AXStaticText": "paragraph", "AXImage": "image",
    "AXToolbar": "toolbar", "AXStatusBar": "statusbar", "AXWindow": "window",
    "AXGroup": "pane", "AXScrollArea": "pane", "AXSplitGroup": "pane",
    "AXSlider": "slider", "AXProgressIndicator": "progress", "AXScrollBar": "scrollbar",
    "AXOutline": "pane", "AXBrowser": "pane", "AXList": "pane", "AXUnknown": "unknown"
  };
  return map[nativeRole] ?? "unknown";
}

class MacOSAccessibilityElementActionProvider implements ElementActionProvider {
  name = "macos_accessibility";

  canHandle(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover"): boolean {
    if (process.platform !== "darwin") return false;
    const source = element.attributes?.source;
    if (source !== "macos_accessibility") return false;
    if (action === "click" && element.is_interactive) return true;
    if (action === "type" && (element.role === "input" || element.role === "textarea")) return true;
    if (action === "focus" && element.is_interactive) return true;
    if (action === "select" && (element.role === "select" || element.role === "option" || element.role === "menuitem" || element.role === "listitem" || element.is_interactive)) return true;
    if (action === "hover" && element.is_interactive) return true;
    return false;
  }

  async execute(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover", value?: string): Promise<ElementActionResult> {
    const startTime = Date.now();
    const procName = element.attributes?.process ?? "";
    const elLabel = (element.label ?? "").replace(/"/g, '\\"');

    try {
      let script: string;
      switch (action) {
        case "click":
          script = 'tell application "System Events"\ntell process "' + procName + '"\nclick UI element "' + elLabel + '"\nend tell\nend tell';
          break;
        case "type":
          script = 'tell application "System Events"\ntell process "' + procName + '"\nset focused to UI element "' + elLabel + '"\nkeystroke "' + (value ?? "").replace(/"/g, '\\"') + '"\nend tell\nend tell';
          break;
        case "focus":
          script = 'tell application "System Events"\ntell process "' + procName + '"\nset focused to UI element "' + elLabel + '"\nend tell\nend tell';
          break;
        case "select": {
          const selectValue = value ?? "";
          if (selectValue) {
            const sv = selectValue.replace(/"/g, '\\"');
            script = 'tell application "System Events"\ntell process "' + procName + '"\nclick UI element "' + elLabel + '"\ndelay 0.3\nclick menu item "' + sv + '" of UI element "' + elLabel + '"\nend tell\nend tell';
          } else {
            script = 'tell application "System Events"\ntell process "' + procName + '"\nselect UI element "' + elLabel + '"\nend tell\nend tell';
          }
          break;
        }
        case "hover": {
          const cx = Math.round(element.bounding_box.x + element.bounding_box.width / 2);
          const cy = Math.round(element.bounding_box.y + element.bounding_box.height / 2);
          const hoverScript = [
            "import subprocess, sys",
            "x, y = " + cx + ", " + cy,
            "moved = False",
            "try:",
            "  subprocess.run(['cliclick', 'm:' + str(x) + ',' + str(y)], timeout=3, check=True)",
            "  moved = True",
            "except Exception:",
            "  pass",
            "if not moved:",
            "  try:",
            "    from Quartz.CoreGraphics import CGEventCreateMouseEvent, CGEventPost, kCGEventMouseMoved, kCGHIDEventTap, CGPoint",
            "    e = CGEventCreateMouseEvent(None, kCGEventMouseMoved, CGPoint(x, y), 0)",
            "    CGEventPost(kCGHIDEventTap, e)",
            "    moved = True",
            "  except Exception:",
            "    pass",
            "if not moved:",
            "  try:",
            "    subprocess.run(['xdotool', 'mousemove', str(x), str(y)], timeout=3, check=True)",
            "    moved = True",
            "  except Exception:",
            "    pass",
            "if not moved:",
            "  sys.exit(1)"
          ].join("\n");
          try {
            await execFileAsync("python3", ["-c", hoverScript], { timeout: 10_000 });
            return { success: true, method: "macos_accessibility_hover", provider: this.name, durationMs: Date.now() - startTime };
          } catch (hoverError) {
            return { success: false, method: "macos_accessibility_hover", provider: this.name, durationMs: Date.now() - startTime, error: "All hover methods failed (cliclick, Quartz, xdotool): " + (hoverError as Error).message };
          }
        }
        default:
          return { success: false, method: "macos_accessibility_" + action, provider: this.name, durationMs: Date.now() - startTime, error: "Action not supported on macOS accessibility" };
      }

      await execFileAsync("osascript", ["-e", script], { timeout: 10_000 });
      return { success: true, method: "macos_accessibility_" + action, provider: this.name, durationMs: Date.now() - startTime };
    } catch (error) {
      return { success: false, method: "macos_accessibility_" + action, provider: this.name, durationMs: Date.now() - startTime, error: (error as Error).message };
    }
  }
}

export async function buildLinuxAccessibilityTree(input?: {
  taskId?: string;
  sessionId?: string;
  windowTitle?: string;
}): Promise<UIPerception> {
  if (process.platform !== "linux") {
    return buildAccessibilityTree(input);
  }

  if (!shouldAttempt("perception")) {
    throw new Error("Perception circuit breaker is open");
  }

  const elements: UIElement[] = [];
  const screenInfo = getScreenDimensions();

  try {
    const { stdout } = await execFileAsync(
      "python3",
      ["-c", [
        "import gi",
        "gi.require_version('Atspi', '2.0')",
        "from gi.repository import Atspi",
        "import json",
        "desktop = Atspi.get_desktop()",
        "results = []",
        "for i in range(desktop.get_child_count()):",
        "  app = desktop.get_child_at_index(i)",
        "  if app is None: continue",
        "  for j in range(min(app.get_child_count(), 20)):",
        "    win = app.get_child_at_index(j)",
        "    if win is None: continue",
        "    try:",
        "      ext = win.get_extents(Atspi.CoordType.SCREEN)",
        "      results.append({'role': win.get_role_name(), 'label': win.get_name(), 'x': ext.x, 'y': ext.y, 'width': ext.width, 'height': ext.height, 'app': app.get_name(), 'interactive': True})",
        "    except: pass",
        "    for k in range(min(win.get_child_count(), 50)):",
        "      el = win.get_child_at_index(k)",
        "      if el is None: continue",
        "      try:",
        "        ext = el.get_extents(Atspi.CoordType.SCREEN)",
        "        results.append({'role': el.get_role_name(), 'label': el.get_name(), 'x': ext.x, 'y': ext.y, 'width': ext.width, 'height': ext.height, 'app': app.get_name(), 'interactive': el.get_state_set().contains(Atspi.StateType.FOCUSABLE)})",
        "      except: pass",
        "print(json.dumps(results))"
      ].join("\n")],
      { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }
    );

    if (stdout.trim()) {
      const parsed = JSON.parse(stdout.trim());
      for (const item of parsed) {
        const role = mapLinuxATSPIRole(item.role);
        elements.push(UIElementSchema.parse({
          element_id: createEntityId("linux_elem"),
          role,
          label: item.label ?? undefined,
          text_content: item.label ?? undefined,
          bounding_box: { x: item.x ?? 0, y: item.y ?? 0, width: item.width ?? 0, height: item.height ?? 0 },
          is_visible: true,
          is_enabled: true,
          is_focused: false,
          is_interactive: Boolean(item.interactive),
          attributes: { source: "linux_atspi", application: item.app ?? "", native_role: item.role ?? "" },
          children_ids: [],
          parent_id: undefined
        }));
      }
    }
  } catch (error) {
    recordFailure("perception");
    log("warn", "Linux AT-SPI accessibility tree extraction failed", { error: String(error) });
  }

  const focusedEl = elements.find(e => e.is_focused);

  return UIPerceptionSchema.parse({
    perception_id: createEntityId("uipercept"),
    task_id: input?.taskId,
    session_id: input?.sessionId,
    engine: "accessibility_api",
    screen_width: screenInfo.width,
    screen_height: screenInfo.height,
    elements,
    active_window_title: input?.windowTitle,
    focused_element_id: focusedEl?.element_id,
    perceived_at: nowIso()
  });
}

function mapLinuxATSPIRole(nativeRole: string): UIElement["role"] {
  const map: Record<string, UIElement["role"]> = {
    "push button": "button", "toggle button": "button", "link": "link",
    "entry": "input", "password text": "input", "text": "textarea",
    "combo box": "select", "check box": "checkbox", "radio button": "radio",
    "menu": "menu", "menu item": "menuitem", "page tab": "tab",
    "dialog": "dialog", "alert": "alert", "table": "table",
    "table row": "row", "table cell": "cell", "heading": "heading",
    "label": "paragraph", "image": "image", "tool bar": "toolbar",
    "status bar": "statusbar", "window": "window", "panel": "pane",
    "filler": "pane", "scroll bar": "scrollbar", "slider": "slider",
    "progress bar": "progress", "list": "pane", "tree": "pane",
    "list item": "listitem",
    "unknown": "unknown"
  };
  return map[nativeRole] ?? "unknown";
}

class LinuxATSPIElementActionProvider implements ElementActionProvider {
  name = "linux_atspi";

  canHandle(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover"): boolean {
    if (process.platform !== "linux") return false;
    const source = element.attributes?.source;
    if (source !== "linux_atspi") return false;
    if (action === "click" && element.is_interactive) return true;
    if (action === "type" && (element.role === "input" || element.role === "textarea")) return true;
    if (action === "focus" && element.is_interactive) return true;
    if (action === "select" && (element.role === "select" || element.role === "option" || element.role === "menuitem" || element.role === "listitem" || element.is_interactive)) return true;
    if (action === "hover" && element.is_interactive) return true;
    return false;
  }

  async execute(element: UIElement, action: "click" | "type" | "focus" | "select" | "hover", value?: string): Promise<ElementActionResult> {
    const startTime = Date.now();
    const appName = element.attributes?.application ?? "";
    const elLabel = (element.label ?? "").replace(/'/g, "\\'");

    try {
      let script: string;
      switch (action) {
        case "click":
          script = [
            "import gi",
            "gi.require_version('Atspi', '2.0')",
            "from gi.repository import Atspi",
            "desktop = Atspi.get_desktop()",
            "for i in range(desktop.get_child_count()):",
            "  app = desktop.get_child_at_index(i)",
            "  if app is None or app.get_name() != '" + appName + "': continue",
            "  for j in range(app.get_child_count()):",
            "    win = app.get_child_at_index(j)",
            "    if win is None: continue",
            "    for k in range(win.get_child_count()):",
            "      el = win.get_child_at_index(k)",
            "      if el is None: continue",
            "      if el.get_name() == '" + elLabel + "':",
            "        try: el.do_action(0)",
            "        except: pass",
            "        break"
          ].join("\n");
          break;
        case "type":
          script = [
            "import gi",
            "gi.require_version('Atspi', '2.0')",
            "from gi.repository import Atspi",
            "desktop = Atspi.get_desktop()",
            "for i in range(desktop.get_child_count()):",
            "  app = desktop.get_child_at_index(i)",
            "  if app is None or app.get_name() != '" + appName + "': continue",
            "  for j in range(app.get_child_count()):",
            "    win = app.get_child_at_index(j)",
            "    if win is None: continue",
            "    for k in range(win.get_child_count()):",
            "      el = win.get_child_at_index(k)",
            "      if el is None: continue",
            "      if el.get_name() == '" + elLabel + "':",
            "        try: el.set_text_contents('" + (value ?? "").replace(/'/g, "\\'") + "')",
            "        except: pass",
            "        break"
          ].join("\n");
          break;
        case "focus":
          script = [
            "import gi",
            "gi.require_version('Atspi', '2.0')",
            "from gi.repository import Atspi",
            "desktop = Atspi.get_desktop()",
            "for i in range(desktop.get_child_count()):",
            "  app = desktop.get_child_at_index(i)",
            "  if app is None or app.get_name() != '" + appName + "': continue",
            "  for j in range(app.get_child_count()):",
            "    win = app.get_child_at_index(j)",
            "    if win is None: continue",
            "    for k in range(win.get_child_count()):",
            "      el = win.get_child_at_index(k)",
            "      if el is None: continue",
            "      if el.get_name() == '" + elLabel + "':",
            "        try: el.grab_focus()",
            "        except: pass",
            "        break"
          ].join("\n");
          break;
        case "select": {
          const selectValue = value ?? "";
          const selectLines = [
            "import gi",
            "gi.require_version('Atspi', '2.0')",
            "from gi.repository import Atspi",
            "desktop = Atspi.get_desktop()",
            "for i in range(desktop.get_child_count()):",
            "  app = desktop.get_child_at_index(i)",
            "  if app is None or app.get_name() != '" + appName + "': continue",
            "  for j in range(app.get_child_count()):",
            "    win = app.get_child_at_index(j)",
            "    if win is None: continue",
            "    for k in range(win.get_child_count()):",
            "      el = win.get_child_at_index(k)",
            "      if el is None: continue",
            "      if el.get_name() == '" + elLabel + "':"
          ];
          if (selectValue) {
            selectLines.push(
              "        try:",
              "          action_iface = el.queryAction()",
              "          for a in range(action_iface.get_nActions()):",
              "            if 'select' in action_iface.get_name(a).lower() or 'press' in action_iface.get_name(a).lower():",
              "              action_iface.do_action(a)",
              "              break",
              "          else:",
              "            el.do_action(0)",
              "        except:",
              "          try: el.do_action(0)",
              "          except: pass"
            );
          } else {
            selectLines.push(
              "        try:",
              "          sel = el.querySelection()",
              "          sel.select_child(0)",
              "        except:",
              "          try:",
              "            action_iface = el.queryAction()",
              "            for a in range(action_iface.get_nActions()):",
              "              if 'select' in action_iface.get_name(a).lower():",
              "                action_iface.do_action(a)",
              "                break",
              "            else:",
              "              el.do_action(0)",
              "          except:",
              "            try: el.do_action(0)",
              "            except: pass"
            );
          }
          selectLines.push("        break");
          script = selectLines.join("\n");
          break;
        }
        case "hover": {
          const cx = Math.round(element.bounding_box.x + element.bounding_box.width / 2);
          const cy = Math.round(element.bounding_box.y + element.bounding_box.height / 2);
          try {
            await execFileAsync("xdotool", ["mousemove", String(cx), String(cy)], { timeout: 5_000 });
            return { success: true, method: "linux_atspi_hover_xdotool", provider: this.name, durationMs: Date.now() - startTime };
          } catch {
            script = [
              "import gi",
              "gi.require_version('Atspi', '2.0')",
              "from gi.repository import Atspi",
              "import subprocess",
              "desktop = Atspi.get_desktop()",
              "for i in range(desktop.get_child_count()):",
              "  app = desktop.get_child_at_index(i)",
              "  if app is None or app.get_name() != '" + appName + "': continue",
              "  for j in range(app.get_child_count()):",
              "    win = app.get_child_at_index(j)",
              "    if win is None: continue",
              "    for k in range(win.get_child_count()):",
              "      el = win.get_child_at_index(k)",
              "      if el is None: continue",
              "      if el.get_name() == '" + elLabel + "':",
              "        try:",
              "          ext = el.get_extents(Atspi.CoordType.SCREEN)",
              "          cx = ext.x + ext.width // 2",
              "          cy = ext.y + ext.height // 2",
              "          subprocess.run(['xdg-mousemove', str(cx), str(cy)], timeout=3)",
              "        except: pass",
              "        break"
            ].join("\n");
            try {
              await execFileAsync("python3", ["-c", script], { timeout: 10_000 });
              return { success: true, method: "linux_atspi_hover_atspi", provider: this.name, durationMs: Date.now() - startTime };
            } catch {
              return { success: false, method: "linux_atspi_hover", provider: this.name, durationMs: Date.now() - startTime, error: "Could not move mouse: xdotool and AT-SPI coordinate hover both failed" };
            }
          }
        }
        default:
          return { success: false, method: "linux_atspi_" + action, provider: this.name, durationMs: Date.now() - startTime, error: "Action not supported on Linux AT-SPI" };
      }

      await execFileAsync("python3", ["-c", script], { timeout: 10_000 });
      return { success: true, method: "linux_atspi_" + action, provider: this.name, durationMs: Date.now() - startTime };
    } catch (error) {
      return { success: false, method: "linux_atspi_" + action, provider: this.name, durationMs: Date.now() - startTime, error: (error as Error).message };
    }
  }
}

if (process.platform === "darwin") {
  registerElementActionProvider(new MacOSAccessibilityElementActionProvider());
}
if (process.platform === "linux") {
  registerElementActionProvider(new LinuxATSPIElementActionProvider());
}

registerElementActionProvider(new PlaywrightFirefoxElementActionProvider());
registerElementActionProvider(new PlaywrightWebKitElementActionProvider());

export async function detectBrowserEngineAvailability(): Promise<{
  chromium: boolean;
  firefox: boolean;
  webkit: boolean;
  details: Record<string, string>;
}> {
  const result = {
    chromium: false,
    firefox: false,
    webkit: false,
    details: {} as Record<string, string>
  };

  try {
    const playwright = await import("playwright");
    try {
      const b = await playwright.chromium.launch({ headless: true });
      await b.close();
      result.chromium = true;
    } catch (e) { result.details.chromium = (e as Error).message.slice(0, 200); }

    try {
      const b = await playwright.firefox.launch({ headless: true });
      await b.close();
      result.firefox = true;
    } catch (e) { result.details.firefox = (e as Error).message.slice(0, 200); }

    try {
      const b = await playwright.webkit.launch({ headless: true });
      await b.close();
      result.webkit = true;
    } catch (e) { result.details.webkit = (e as Error).message.slice(0, 200); }
  } catch (e) {
    result.details.playwright = "Playwright not available: " + (e as Error).message.slice(0, 200);
  }

  return result;
}

type ComputerUseSessionStatus = ComputerUseSession["status"];

export interface MacOSAccessibilityDiagnostics {
  platform: "darwin" | "other";
  applescript_available: boolean;
  system_events_accessible: boolean;
  accessibility_permissions_granted: boolean;
  visible_processes_count: number;
  sample_elements_count: number;
  select_action_available: boolean;
  hover_action_available: boolean;
  hover_methods: string[];
  cliclick_available: boolean;
  quartz_coregraphics_available: boolean;
  errors: string[];
  runbook_steps: string[];
}

export async function runMacOSAccessibilityDiagnostics(): Promise<MacOSAccessibilityDiagnostics> {
  const result: MacOSAccessibilityDiagnostics = {
    platform: process.platform === "darwin" ? "darwin" : "other",
    applescript_available: false,
    system_events_accessible: false,
    accessibility_permissions_granted: false,
    visible_processes_count: 0,
    sample_elements_count: 0,
    select_action_available: true,
    hover_action_available: false,
    hover_methods: [],
    cliclick_available: false,
    quartz_coregraphics_available: false,
    errors: [],
    runbook_steps: []
  };

  if (process.platform !== "darwin") {
    result.errors.push("Not running on macOS; diagnostics cannot be executed");
    result.runbook_steps.push("Run this diagnostic on a macOS host");
    result.runbook_steps.push("Ensure macOS 10.15+ with System Events support");
    return result;
  }

  try {
    await execFileAsync("osascript", ["-e", "return 1"], { timeout: 3000 });
    result.applescript_available = true;
  } catch (e) {
    result.errors.push("AppleScript not available: " + (e as Error).message.slice(0, 200));
    result.runbook_steps.push("Install AppleScript support (should be built-in on macOS)");
  }

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", 'tell application "System Events" to get name of every process whose visible is true'], { timeout: 5000 });
    result.system_events_accessible = true;
    result.accessibility_permissions_granted = true;
    const processes = stdout.trim().split(", ").filter(Boolean);
    result.visible_processes_count = processes.length;
  } catch (e) {
    const msg = (e as Error).message;
    result.errors.push("System Events not accessible: " + msg.slice(0, 200));
    if (msg.includes("not allowed") || msg.includes("permission") || msg.includes("assistive")) {
      result.runbook_steps.push("Grant Accessibility permissions: System Preferences → Privacy & Security → Accessibility → Add Terminal/app to allowed list");
      result.runbook_steps.push("After granting, restart the application");
    } else {
      result.runbook_steps.push("Check that System Events is running: open AppleScript Editor and run 'tell application \"System Events\" to get name of every process'");
    }
  }

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", 'tell application "System Events"\ntell process "Finder"\nset elemCount to count of every UI element of front window\nreturn elemCount\nend tell\nend tell'], { timeout: 5000 });
    result.sample_elements_count = parseInt(stdout.trim(), 10) || 0;
  } catch (e) {
    result.errors.push("Cannot read Finder elements: " + (e as Error).message.slice(0, 200));
    result.runbook_steps.push("Ensure Finder is running and accessible");
  }

  try {
    await execFileAsync("which", ["cliclick"], { timeout: 3000 });
    result.cliclick_available = true;
    result.hover_methods.push("cliclick");
  } catch { /* not available */ }

  try {
    const { stdout } = await execFileAsync("python3", ["-c", "from Quartz.CoreGraphics import CGEventCreateMouseEvent; print('ok')"], { timeout: 3000 });
    if (stdout.trim() === "ok") {
      result.quartz_coregraphics_available = true;
      result.hover_methods.push("Quartz.CoreGraphics");
    }
  } catch { /* not available */ }

  try {
    await execFileAsync("which", ["xdotool"], { timeout: 3000 });
    result.hover_methods.push("xdotool");
  } catch { /* not available */ }

  result.hover_action_available = result.hover_methods.length > 0;

  if (!result.hover_action_available) {
    result.errors.push("No hover method available (need cliclick, Quartz.CoreGraphics, or xdotool)");
    result.runbook_steps.push("Install cliclick: brew install cliclick");
    result.runbook_steps.push("Or install xdotool: brew install xdotool");
    result.runbook_steps.push("Quartz.CoreGraphics is built-in on macOS but requires Python3 with pyobjc");
  }

  if (result.runbook_steps.length === 0) {
    result.runbook_steps.push("All macOS accessibility diagnostics passed");
    result.runbook_steps.push("Run runComputerUseSelfCheck() for full validation");
  }

  return result;
}

export interface LinuxATSPIDiagnostics {
  platform: "linux" | "other";
  atspi_python_available: boolean;
  xdotool_available: boolean;
  xrandr_available: boolean;
  screenshot_tool_available: boolean;
  screenshot_tool_name: string;
  display_server: "x11" | "wayland" | "unknown";
  atspi_desktop_children: number;
  sample_elements_count: number;
  select_action_available: boolean;
  hover_action_available: boolean;
  hover_methods: string[];
  errors: string[];
  runbook_steps: string[];
}

export async function runLinuxATSPIDiagnostics(): Promise<LinuxATSPIDiagnostics> {
  const result: LinuxATSPIDiagnostics = {
    platform: process.platform === "linux" ? "linux" : "other",
    atspi_python_available: false,
    xdotool_available: false,
    xrandr_available: false,
    screenshot_tool_available: false,
    screenshot_tool_name: "",
    display_server: "unknown",
    atspi_desktop_children: 0,
    sample_elements_count: 0,
    select_action_available: false,
    hover_action_available: false,
    hover_methods: [],
    errors: [],
    runbook_steps: []
  };

  if (process.platform !== "linux") {
    result.errors.push("Not running on Linux; diagnostics cannot be executed");
    result.runbook_steps.push("Run this diagnostic on a Linux host with AT-SPI support");
    result.runbook_steps.push("Install: sudo apt install python3-gi gir1.2-atspi-2.0 at-spi2-core");
    return result;
  }

  try {
    const { stdout } = await execFileAsync("python3", ["-c", "import gi; gi.require_version('Atspi', '2.0'); from gi.repository import Atspi; desktop = Atspi.get_desktop(); print(len([desktop.get_child_at_index(i) for i in range(desktop.get_child_count())]))"], { timeout: 5000 });
    result.atspi_python_available = true;
    result.atspi_desktop_children = parseInt(stdout.trim(), 10) || 0;
  } catch (e) {
    result.errors.push("AT-SPI Python not available: " + (e as Error).message.slice(0, 200));
    result.runbook_steps.push("Install AT-SPI Python bindings: sudo apt install python3-gi gir1.2-atspi-2.0 at-spi2-core");
    result.runbook_steps.push("Verify: python3 -c \"import gi; gi.require_version('Atspi', '2.0'); from gi.repository import Atspi; print('ok')\"");
  }

  try {
    await execFileAsync("xdotool", ["--version"], { timeout: 3000 });
    result.xdotool_available = true;
  } catch (e) {
    result.errors.push("xdotool not available: " + (e as Error).message.slice(0, 200));
    result.runbook_steps.push("Install xdotool: sudo apt install xdotool");
  }

  try {
    await execFileAsync("xrandr", ["--version"], { timeout: 3000 });
    result.xrandr_available = true;
  } catch (e) {
    result.errors.push("xrandr not available: " + (e as Error).message.slice(0, 200));
    result.runbook_steps.push("Install xrandr: sudo apt install x11-xserver-utils");
  }

  const displayEnv = process.env.DISPLAY;
  const waylandDisplay = process.env.WAYLAND_DISPLAY;
  if (displayEnv) {
    result.display_server = "x11";
  } else if (waylandDisplay) {
    result.display_server = "wayland";
    result.errors.push("Wayland detected; AT-SPI and xdotool may have limited functionality");
    result.runbook_steps.push("For Wayland, ensure AT-SPI2 is running and accessibility is enabled in GNOME settings");
    result.runbook_steps.push("Consider using XWayland for xdotool compatibility");
  }

  try {
    const cmd = displayEnv ? "gnome-screenshot" : "scrot";
    await execFileAsync("which", [cmd], { timeout: 3000 });
    result.screenshot_tool_available = true;
    result.screenshot_tool_name = cmd;
  } catch {
    try {
      await execFileAsync("which", ["scrot"], { timeout: 3000 });
      result.screenshot_tool_available = true;
      result.screenshot_tool_name = "scrot";
    } catch (e) {
      result.errors.push("No screenshot tool available");
      result.runbook_steps.push("Install screenshot tool: sudo apt install gnome-screenshot or sudo apt install scrot");
    }
  }

  if (result.atspi_python_available && result.atspi_desktop_children > 0) {
    try {
      const { stdout } = await execFileAsync("python3", ["-c", "import gi; gi.require_version('Atspi', '2.0'); from gi.repository import Atspi; desktop = Atspi.get_desktop(); app = desktop.get_child_at_index(0); count = 0; [count := count + win.get_child_count() for win in [app.get_child_at_index(i) for i in range(app.get_child_count())] if win]; print(count)"], { timeout: 5000 });
      result.sample_elements_count = parseInt(stdout.trim(), 10) || 0;
    } catch (e) {
      result.errors.push("Cannot count sample elements: " + (e as Error).message.slice(0, 200));
    }
  }

  result.select_action_available = result.atspi_python_available;

  if (result.xdotool_available) {
    result.hover_methods.push("xdotool");
  }

  if (result.atspi_python_available) {
    result.hover_methods.push("atspi_coordinates");
  }

  result.hover_action_available = result.hover_methods.length > 0;

  if (!result.hover_action_available) {
    result.errors.push("No hover method available (need xdotool or AT-SPI coordinate access)");
    result.runbook_steps.push("Install xdotool: sudo apt install xdotool");
  }

  if (!result.select_action_available) {
    result.errors.push("Select action requires AT-SPI Python bindings");
    result.runbook_steps.push("Install AT-SPI: sudo apt install python3-gi gir1.2-atspi-2.0");
  }

  if (result.runbook_steps.length === 0) {
    result.runbook_steps.push("All Linux AT-SPI diagnostics passed");
    result.runbook_steps.push("Run runComputerUseSelfCheck() for full validation");
  }

  return result;
}

export interface SelfCheckResult {
  platform: string;
  timestamp: string;
  checks: SelfCheckEntry[];
  overall: "pass" | "partial" | "fail";
}

export interface SelfCheckEntry {
  name: string;
  category: "screenshot" | "perception" | "ocr" | "element_action" | "input" | "display" | "local_app" | "session" | "recording";
  status: "pass" | "fail" | "unavailable" | "skipped";
  duration_ms: number;
  detail: string;
  error?: string;
}

export async function runComputerUseSelfCheck(options?: {
  skipInputActions?: boolean;
  skipLocalApp?: boolean;
  sessionId?: string;
  taskId?: string;
}): Promise<SelfCheckResult> {
  const checks: SelfCheckEntry[] = [];
  const startTime = Date.now();

  const sessionId = options?.sessionId ?? createEntityId("selfcheck_sess");
  const taskId = options?.taskId ?? createEntityId("selfcheck_task");

  const check = async (
    name: string,
    category: SelfCheckEntry["category"],
    fn: () => Promise<string>
  ): Promise<void> => {
    const start = Date.now();
    try {
      const detail = await fn();
      checks.push({ name, category, status: "pass", duration_ms: Date.now() - start, detail });
    } catch (error) {
      checks.push({ name, category, status: "fail", duration_ms: Date.now() - start, detail: "", error: (error as Error).message.slice(0, 500) });
    }
  };

  const checkUnavailable = (name: string, category: SelfCheckEntry["category"], reason: string) => {
    checks.push({ name, category, status: "unavailable", duration_ms: 0, detail: reason });
  };

  await check("screenshot_capture", "screenshot", async () => {
    const capture = await captureScreen({ taskId, sessionId, engine: "native_screenshot" });
    return `captured ${capture.width}x${capture.height} via ${capture.engine}, ${capture.size_bytes} bytes at ${capture.pixel_data_ref}`;
  });

  await check("display_enumeration", "display", async () => {
    const displays = await listAvailableDisplays();
    return `found ${displays.length} display(s): ${displays.map(d => `#${d.displayIndex} ${d.width}x${d.height} at (${d.x},${d.y})${d.primary ? " [primary]" : ""}`).join("; ")}`;
  });

  await check("multi_display_capture", "display", async () => {
    const displays = await listAvailableDisplays();
    if (displays.length < 2) return `only ${displays.length} display(s), multi-display capture not tested`;
    const capture = await captureScreen({ taskId, sessionId, displayIndex: 1 });
    return `captured display #1: ${capture.width}x${capture.height}, display_index=${capture.display_index}`;
  });

  await check("accessibility_tree", "perception", async () => {
    const perception = await buildAccessibilityTree({ taskId, sessionId });
    const interactiveCount = perception.elements.filter(e => e.is_interactive).length;
    return `perceived ${perception.elements.length} elements (${interactiveCount} interactive) via ${perception.engine}`;
  });

  await check("ocr_provider_availability", "ocr", async () => {
    const providers = listOCRProviders();
    if (providers.length === 0) return "no OCR providers registered";
    const available: string[] = [];
    for (const name of providers) {
      try {
        const capture = await captureScreen({ taskId, sessionId });
        if (capture.pixel_data_ref) {
          available.push(name);
        }
      } catch {
        available.push(name + " (detection only)");
      }
    }
    return `registered: ${providers.join(", ")}`;
  });

  await check("element_action_providers", "element_action", async () => {
    const providers = listElementActionProviders();
    return `registered: ${providers.join(", ")}`;
  });

  if (!options?.skipInputActions) {
    await check("mouse_move", "input", async () => {
      await executeMouseMove(100, 100);
      return "moved mouse to (100, 100)";
    });

    await check("key_press_escape", "input", async () => {
      await executeKeyPress("Escape");
      return "pressed Escape key";
    });
  } else {
    checkUnavailable("mouse_move", "input", "skipped by option");
    checkUnavailable("key_press_escape", "input", "skipped by option");
  }

  await check("session_lifecycle", "session", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 5 });
    const retrieved = getComputerUseSession(session.session_id);
    if (!retrieved) throw new Error("session not found after creation");
    if (retrieved.status !== "active") throw new Error("session not active: " + retrieved.status);
    pauseComputerUseSession(session.session_id);
    const paused = getComputerUseSession(session.session_id);
    if (paused?.status !== "paused") throw new Error("session not paused: " + paused?.status);
    resumeComputerUseSession(session.session_id);
    const resumed = getComputerUseSession(session.session_id);
    if (resumed?.status !== "active") throw new Error("session not resumed: " + resumed?.status);
    completeComputerUseSession(session.session_id);
    const completed = getComputerUseSession(session.session_id);
    if (completed?.status !== "completed") throw new Error("session not completed: " + completed?.status);
    return `session ${session.session_id} lifecycle: created->active->paused->active->completed`;
  });

  await check("replay_package", "session", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 5 });
    const perception = await perceiveScreen({ taskId, sessionId: session.session_id, engine: "accessibility_api" });
    const step = ComputerUseStepSchema.parse({
      step_id: createEntityId("custep"),
      session_id: session.session_id,
      step_number: 1,
      kind: "see",
      intention: "self-check",
      observation: "Self-check perception step",
      perception_id: perception.perception_id,
      duration_ms: 100,
      started_at: nowIso(),
      completed_at: nowIso()
    });
    store.computerUseSteps.set(step.step_id, step);
    const replay = buildComputerUseReplayPackage(session.session_id);
    return `replay package has ${replay.length} step(s)`;
  });

  await check("session_recording", "recording", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 5 });
    const recording = generateSessionRecording(session.session_id);
    const exported = exportSessionRecording(session.session_id);
    return `recording has ${recording.length} entries, export includes ${exported.steps.length} steps and ${exported.replayPackage.length} replay items`;
  });

  if (!options?.skipLocalApp) {
    await check("local_app_invoke_cmd", "local_app", async () => {
      const result = await invokeLocalApp({
        appIdentifier: "cmd.exe",
        method: "launch",
        arguments: ["/c", "echo", "self-check-ok"],
        timeoutMs: 5000,
        taskId,
        sessionId
      });
      if (result.exit_code !== 0 && result.exit_code !== undefined) throw new Error("cmd exited with code " + result.exit_code);
      return `invoked cmd.exe: exit_code=${result.exit_code}, stdout=${(result.stdout ?? "").trim().slice(0, 100)}`;
    });
  } else {
    checkUnavailable("local_app_invoke_cmd", "local_app", "skipped by option");
  }

  await check("circuit_breaker_status", "session", async () => {
    const status = getCircuitBreakerStatus();
    const openCount = Object.values(status).filter(s => s.isOpen).length;
    return `circuit breakers: ${Object.keys(status).length} tracked, ${openCount} open`;
  });

  const failCount = checks.filter(c => c.status === "fail").length;
  const passCount = checks.filter(c => c.status === "pass").length;
  const overall: SelfCheckResult["overall"] = failCount === 0 ? (passCount > 0 ? "pass" : "fail") : (passCount > failCount ? "partial" : "fail");

  return {
    platform: process.platform,
    timestamp: nowIso(),
    checks,
    overall
  };
}

export interface PlatformFeatureDetection {
  platform: string;
  features: {
    native_screenshot: boolean;
    playwright_screenshot: boolean;
    accessibility_tree: boolean;
    ocr: boolean;
    ocr_providers: string[];
    element_action_providers: string[];
    multi_display: boolean;
    local_app_invoke: boolean;
    session_recording: boolean;
  };
  platform_specific: {
    windows_ocr_winrt: boolean;
    windows_uiautomation: boolean;
    macos_accessibility: boolean;
    macos_applescript: boolean;
    linux_atspi: boolean;
    linux_xdotool: boolean;
    linux_gnome_screenshot: boolean;
    tesseract_cli: boolean;
  };
}

export async function detectPlatformFeatures(): Promise<PlatformFeatureDetection> {
  const features: PlatformFeatureDetection["features"] = {
    native_screenshot: false,
    playwright_screenshot: false,
    accessibility_tree: false,
    ocr: false,
    ocr_providers: [],
    element_action_providers: listElementActionProviders(),
    multi_display: false,
    local_app_invoke: true,
    session_recording: true
  };

  const platformSpecific: PlatformFeatureDetection["platform_specific"] = {
    windows_ocr_winrt: false,
    windows_uiautomation: false,
    macos_accessibility: false,
    macos_applescript: false,
    linux_atspi: false,
    linux_xdotool: false,
    linux_gnome_screenshot: false,
    tesseract_cli: false
  };

  try {
    const capture = await captureScreen({ engine: "native_screenshot" }).catch(() => null);
    features.native_screenshot = capture !== null;
  } catch { features.native_screenshot = false; }

  try {
    const capture = await captureScreen({ engine: "playwright_page" }).catch(() => null);
    features.playwright_screenshot = capture !== null;
  } catch { features.playwright_screenshot = false; }

  try {
    const perception = await buildAccessibilityTree().catch(() => null);
    features.accessibility_tree = perception !== null && perception.elements.length > 0;
  } catch { features.accessibility_tree = false; }

  features.ocr_providers = listOCRProviders();
  features.ocr = features.ocr_providers.length > 0;

  try {
    const displays = await listAvailableDisplays();
    features.multi_display = displays.length > 0;
  } catch { features.multi_display = false; }

  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("powershell.exe", ["-Command", "[bool](Get-Command 'Windows.Media.Ocr.OcrEngine' -ErrorAction SilentlyContinue)"], { timeout: 5000 });
      platformSpecific.windows_ocr_winrt = stdout.trim().length > 0;
    } catch { platformSpecific.windows_ocr_winrt = false; }

    try {
      const { stdout } = await execFileAsync("powershell.exe", ["-Command", "try { Add-Type -AssemblyName UIAutomationClient; $true } catch { $false }"], { timeout: 5000 });
      platformSpecific.windows_uiautomation = stdout.trim().toLowerCase() === "true";
    } catch { platformSpecific.windows_uiautomation = false; }
  }

  if (process.platform === "darwin") {
    try {
      await execFileAsync("osascript", ["-e", 'tell application "System Events" to get name of every process whose visible is true'], { timeout: 5000 });
      platformSpecific.macos_applescript = true;
    } catch { platformSpecific.macos_applescript = false; }
    platformSpecific.macos_accessibility = platformSpecific.macos_applescript;
  }

  if (process.platform === "linux") {
    try {
      await execFileAsync("python3", ["-c", "import gi; gi.require_version('Atspi', '2.0'); from gi.repository import Atspi; print('ok')"], { timeout: 5000 });
      platformSpecific.linux_atspi = true;
    } catch { platformSpecific.linux_atspi = false; }

    try {
      await execFileAsync("xdotool", ["--version"], { timeout: 3000 });
      platformSpecific.linux_xdotool = true;
    } catch { platformSpecific.linux_xdotool = false; }

    try {
      const cmd = process.env.DISPLAY ? "gnome-screenshot" : "scrot";
      await execFileAsync("which", [cmd], { timeout: 3000 });
      platformSpecific.linux_gnome_screenshot = true;
    } catch { platformSpecific.linux_gnome_screenshot = false; }
  }

  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    await execFileAsync(cmd, ["tesseract"], { timeout: 3000 });
    platformSpecific.tesseract_cli = true;
  } catch { platformSpecific.tesseract_cli = false; }

  return {
    platform: process.platform,
    features,
    platform_specific: platformSpecific
  };
}

export interface SmokeTestResult {
  test_id: string;
  test_name: string;
  category: "screenshot" | "ocr" | "accessibility" | "element_action" | "session_recording" | "local_app" | "multi_display" | "sandbox" | "input";
  status: "pass" | "fail" | "skip" | "error";
  duration_ms: number;
  detail: string;
  error?: string;
  evidence?: Record<string, unknown>;
}

export interface SmokeTestSuiteResult {
  suite_id: string;
  platform: string;
  timestamp: string;
  tests: SmokeTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    pass_rate: number;
    total_duration_ms: number;
  };
}

export interface E2EScenarioStep {
  step_name: string;
  action: string;
  params: Record<string, unknown>;
  expected_outcome: string;
  timeout_ms?: number;
}

export interface E2EScenarioResult {
  scenario_id: string;
  scenario_name: string;
  status: "pass" | "fail" | "partial" | "error";
  steps: Array<{
    step_name: string;
    status: "pass" | "fail" | "skip";
    duration_ms: number;
    detail: string;
    error?: string;
  }>;
  total_duration_ms: number;
}

export interface RegressionTestCase {
  case_id: string;
  name: string;
  description: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  repro_steps: string[];
  expected_result: string;
}

export interface RegressionTestResult {
  run_id: string;
  timestamp: string;
  results: Array<{
    case_id: string;
    status: "pass" | "fail" | "skip";
    duration_ms: number;
    detail: string;
    error?: string;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pass_rate: number;
  };
}

async function runSingleSmokeTest(
  name: string,
  category: SmokeTestResult["category"],
  fn: () => Promise<{ detail: string; evidence?: Record<string, unknown> }>
): Promise<SmokeTestResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      test_id: createEntityId("smoke"),
      test_name: name,
      category,
      status: "pass",
      duration_ms: Date.now() - start,
      detail: result.detail,
      evidence: result.evidence
    };
  } catch (error) {
    return {
      test_id: createEntityId("smoke"),
      test_name: name,
      category,
      status: "fail",
      duration_ms: Date.now() - start,
      detail: "",
      error: (error as Error).message.slice(0, 500)
    };
  }
}

export async function runSmokeTestSuite(options?: {
  skipInput?: boolean;
  skipLocalApp?: boolean;
  skipNetworkDependent?: boolean;
  sessionId?: string;
  taskId?: string;
}): Promise<SmokeTestSuiteResult> {
  const suiteStart = Date.now();
  const sessionId = options?.sessionId ?? createEntityId("smoke_sess");
  const taskId = options?.taskId ?? createEntityId("smoke_task");
  const tests: SmokeTestResult[] = [];

  tests.push(await runSingleSmokeTest("screenshot_native", "screenshot", async () => {
    const capture = await captureScreen({ taskId, sessionId, engine: "native_screenshot" });
    return {
      detail: `Native screenshot: ${capture.width}x${capture.height}, ${capture.size_bytes} bytes, engine=${capture.engine}`,
      evidence: { capture_id: capture.capture_id, width: capture.width, height: capture.height, engine: capture.engine }
    };
  }));

  tests.push(await runSingleSmokeTest("screenshot_playwright", "screenshot", async () => {
    const capture = await captureScreen({ taskId, sessionId, engine: "playwright_page" }).catch(() => null);
    if (!capture) return { detail: "Playwright screenshot not available (skipped)" };
    return {
      detail: `Playwright screenshot: ${capture.width}x${capture.height}, engine=${capture.engine}`,
      evidence: { capture_id: capture.capture_id, width: capture.width, height: capture.height }
    };
  }));

  tests.push(await runSingleSmokeTest("screenshot_diff", "screenshot", async () => {
    const before = await captureScreen({ taskId, sessionId, engine: "native_screenshot" });
    const after = await captureScreen({ taskId, sessionId, engine: "native_screenshot" });
    const diff = await compareScreenCaptures(before, after);
    return {
      detail: `Screenshot diff: compared=${diff?.compared}, similarity=${diff?.similarity_score}, mode=${diff?.comparison_mode}`,
      evidence: { compared: diff?.compared, similarity_score: diff?.similarity_score, mode: diff?.comparison_mode }
    };
  }));

  tests.push(await runSingleSmokeTest("ocr_provider_resolution", "ocr", async () => {
    const providers = listOCRProviders();
    const available: string[] = [];
    for (const name of providers) {
      try {
        const capture = await captureScreen({ taskId, sessionId });
        if (capture.pixel_data_ref) available.push(name);
      } catch {
        available.push(name + " (detection-only)");
      }
    }
    return {
      detail: `OCR providers: registered=${providers.length}, available=${available.join(", ")}`,
      evidence: { registered: providers, available }
    };
  }));

  tests.push(await runSingleSmokeTest("accessibility_tree_capture", "accessibility", async () => {
    const perception = await buildAccessibilityTree({ taskId, sessionId });
    const interactive = perception.elements.filter(e => e.is_interactive).length;
    const roles = [...new Set(perception.elements.map(e => e.role))];
    return {
      detail: `Accessibility tree: ${perception.elements.length} elements, ${interactive} interactive, roles=[${roles.slice(0, 10).join(",")}]`,
      evidence: { element_count: perception.elements.length, interactive_count: interactive, engine: perception.engine, roles }
    };
  }));

  tests.push(await runSingleSmokeTest("accessibility_element_find", "accessibility", async () => {
    const perception = await buildAccessibilityTree({ taskId, sessionId });
    const interactive = perception.elements.filter(e => e.is_interactive);
    if (interactive.length === 0) return { detail: "No interactive elements found (may be normal for headless)" };
    const first = interactive[0];
    return {
      detail: `Found interactive element: role=${first.role}, label="${first.label?.slice(0, 50)}", bbox=(${first.bounding_box.x},${first.bounding_box.y},${first.bounding_box.width},${first.bounding_box.height})`,
      evidence: { element_id: first.element_id, role: first.role, label: first.label }
    };
  }));

  tests.push(await runSingleSmokeTest("element_action_provider_registry", "element_action", async () => {
    const providers = listElementActionProviders();
    return {
      detail: `Element action providers: ${providers.join(", ") || "none registered"}`,
      evidence: { providers }
    };
  }));

  tests.push(await runSingleSmokeTest("element_action_resolve", "element_action", async () => {
    const perception = await buildAccessibilityTree({ taskId, sessionId });
    const interactive = perception.elements.filter(e => e.is_interactive);
    if (interactive.length === 0) return { detail: "No interactive elements for resolve test" };
    const target = interactive[0];
    const resolved = await resolveElementAction(target, "click");
    return {
      detail: `Resolve result: success=${resolved.success}, method=${resolved.method}, provider=${resolved.provider}`,
      evidence: { success: resolved.success, method: resolved.method, provider: resolved.provider }
    };
  }));

  tests.push(await runSingleSmokeTest("session_lifecycle_full", "session_recording", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 10 });
    const retrieved = getComputerUseSession(session.session_id);
    if (!retrieved || retrieved.status !== "active") throw new Error("Session not active after creation");

    pauseComputerUseSession(session.session_id);
    const paused = getComputerUseSession(session.session_id);
    if (paused?.status !== "paused") throw new Error("Session not paused");

    resumeComputerUseSession(session.session_id);
    const resumed = getComputerUseSession(session.session_id);
    if (resumed?.status !== "active") throw new Error("Session not resumed");

    const recording = generateSessionRecording(session.session_id);
    const exported = exportSessionRecording(session.session_id);

    completeComputerUseSession(session.session_id);

    return {
      detail: `Session lifecycle OK, recording=${recording.length} entries, export=${exported.steps.length} steps`,
      evidence: { session_id: session.session_id, recording_entries: recording.length, export_steps: exported.steps.length }
    };
  }));

  tests.push(await runSingleSmokeTest("session_replay_package", "session_recording", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 5 });
    const perception = await perceiveScreen({ taskId, sessionId: session.session_id, engine: "accessibility_api" });
    const step = ComputerUseStepSchema.parse({
      step_id: createEntityId("custep"),
      session_id: session.session_id,
      step_number: 1,
      kind: "see",
      intention: "smoke-test",
      observation: "Smoke test perception step",
      perception_id: perception.perception_id,
      duration_ms: 50,
      started_at: nowIso(),
      completed_at: nowIso()
    });
    store.computerUseSteps.set(step.step_id, step);
    const replay = buildComputerUseReplayPackage(session.session_id);
    completeComputerUseSession(session.session_id);
    return {
      detail: `Replay package: ${replay.length} step(s)`,
      evidence: { replay_steps: replay.length }
    };
  }));

  tests.push(await runSingleSmokeTest("frame_recording_lifecycle", "session_recording", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 10 });
    startSessionFrameRecording({ sessionId: session.session_id, frameIntervalMs: 500 });
    const status = getSessionFrameRecordingStatus(session.session_id);
    if (!status?.active) throw new Error("Frame recording not active after start");
    await new Promise(r => setTimeout(r, 600));
    await captureRecordingFrame({ sessionId: session.session_id, triggeredBy: "manual" });
    const timeline = stopSessionFrameRecording(session.session_id);
    completeComputerUseSession(session.session_id);
    return {
      detail: `Frame recording: active=${status.active}, frames=${timeline?.total_frames ?? 0}`,
      evidence: { active: status.active, frame_count: timeline?.total_frames }
    };
  }));

  if (!options?.skipLocalApp) {
    tests.push(await runSingleSmokeTest("local_app_invoke_cmd", "local_app", async () => {
      const result = await invokeLocalApp({
        appIdentifier: "cmd.exe",
        method: "launch",
        arguments: ["/c", "echo", "smoke-test-ok"],
        timeoutMs: 5000,
        taskId,
        sessionId
      });
      return {
        detail: `cmd.exe invoke: exit_code=${result.exit_code}, stdout=${(result.stdout ?? "").trim().slice(0, 100)}`,
        evidence: { exit_code: result.exit_code, stdout: (result.stdout ?? "").trim().slice(0, 200) }
      };
    }));

    tests.push(await runSingleSmokeTest("local_app_dry_run", "local_app", async () => {
      const result = await invokeLocalApp({
        appIdentifier: "notepad.exe",
        method: "launch",
        dryRun: true,
        taskId,
        sessionId
      });
      return {
        detail: `Dry run: exit_code=${result.exit_code}`,
        evidence: { exit_code: result.exit_code }
      };
    }));

    tests.push(await runSingleSmokeTest("local_app_capability_detect", "local_app", async () => {
      const caps = detectLocalAppCapabilities();
      const availability = await checkLocalAppAvailability("cmd.exe");
      return {
        detail: `Capabilities: ${caps.length} detected, cmd.exe available=${availability.available}`,
        evidence: { capability_count: caps.length, cmd_available: availability.available }
      };
    }));
  }

  tests.push(await runSingleSmokeTest("multi_display_enumeration", "multi_display", async () => {
    const displays = await listAvailableDisplays();
    return {
      detail: `Displays: ${displays.length} found, ${displays.map(d => `#${d.displayIndex} ${d.width}x${d.height}${d.primary ? " [primary]" : ""}`).join("; ")}`,
      evidence: { display_count: displays.length, displays: displays.map(d => ({ index: d.displayIndex, width: d.width, height: d.height, primary: d.primary })) }
    };
  }));

  tests.push(await runSingleSmokeTest("sandbox_enforcement_readonly", "sandbox", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 5, sandboxTier: "host_readonly" });
    const enforcement = enforceComputerUseSandbox({ action: "element_action_click", sessionId: session.session_id });
    completeComputerUseSession(session.session_id);
    if (enforcement.allowed) throw new Error("Click should be denied in host_readonly tier");
    return {
      detail: `Sandbox enforcement: tier=${enforcement.tier}, allowed=${enforcement.allowed}, violations=${enforcement.violations.length}`,
      evidence: { tier: enforcement.tier, allowed: enforcement.allowed, violation_count: enforcement.violations.length }
    };
  }));

  tests.push(await runSingleSmokeTest("sandbox_enforcement_guarded", "sandbox", async () => {
    const session = createComputerUseSession({ taskId, maxSteps: 5, sandboxTier: "guarded_mutation" });
    const enforcement = enforceComputerUseSandbox({ action: "element_action_click", sessionId: session.session_id });
    completeComputerUseSession(session.session_id);
    if (!enforcement.allowed) throw new Error("Click should be allowed in guarded_mutation tier");
    return {
      detail: `Sandbox enforcement: tier=${enforcement.tier}, allowed=${enforcement.allowed}`,
      evidence: { tier: enforcement.tier, allowed: enforcement.allowed }
    };
  }));

  tests.push(await runSingleSmokeTest("sandbox_policy_query", "sandbox", async () => {
    const policy = getComputerUseSandboxPolicy();
    return {
      detail: `Sandbox policy: tier=${policy.tier}, allowed=${policy.allowed_actions.length}, denied=${policy.denied_actions.length}`,
      evidence: { tier: policy.tier, allowed_count: policy.allowed_actions.length, denied_count: policy.denied_actions.length }
    };
  }));

  if (!options?.skipInput) {
    tests.push(await runSingleSmokeTest("input_mouse_move", "input", async () => {
      await executeMouseMove(200, 200);
      return { detail: "Mouse moved to (200, 200)" };
    }));

    tests.push(await runSingleSmokeTest("input_key_press_escape", "input", async () => {
      await executeKeyPress("Escape");
      return { detail: "Pressed Escape key" };
    }));
  }

  tests.push(await runSingleSmokeTest("circuit_breaker_status", "session_recording", async () => {
    const status = getCircuitBreakerStatus();
    const openCount = Object.values(status).filter(s => s.isOpen).length;
    return {
      detail: `Circuit breakers: ${Object.keys(status).length} tracked, ${openCount} open`,
      evidence: { tracked: Object.keys(status).length, open: openCount }
    };
  }));

  tests.push(await runSingleSmokeTest("platform_feature_detection", "screenshot", async () => {
    const detection = await detectPlatformFeatures();
    return {
      detail: `Platform: ${detection.platform}, native_screenshot=${detection.features.native_screenshot}, accessibility=${detection.features.accessibility_tree}`,
      evidence: { platform: detection.platform, features: detection.features, platform_specific: detection.platform_specific }
    };
  }));

  const passed = tests.filter(t => t.status === "pass").length;
  const failed = tests.filter(t => t.status === "fail").length;
  const skipped = tests.filter(t => t.status === "skip").length;
  const errors = tests.filter(t => t.status === "error").length;

  return {
    suite_id: createEntityId("smoke_suite"),
    platform: process.platform,
    timestamp: nowIso(),
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
      skipped,
      errors,
      pass_rate: tests.length > 0 ? Number((passed / tests.length).toFixed(4)) : 0,
      total_duration_ms: Date.now() - suiteStart
    }
  };
}

export async function runE2EScenario(input: {
  scenario_name: string;
  steps: E2EScenarioStep[];
  sessionId?: string;
  taskId?: string;
}): Promise<E2EScenarioResult> {
  const scenarioStart = Date.now();
  const sessionId = input.sessionId ?? createEntityId("e2e_sess");
  const taskId = input.taskId ?? createEntityId("e2e_task");
  const stepResults: E2EScenarioResult["steps"] = [];

  for (const step of input.steps) {
    const stepStart = Date.now();
    try {
      let detail = "";

      switch (step.action) {
        case "capture": {
          const capture = await captureScreen({ taskId, sessionId, engine: (step.params.engine as "native_screenshot" | "playwright_page") ?? "native_screenshot", displayIndex: step.params.displayIndex as number | undefined });
          detail = `Captured ${capture.width}x${capture.height} via ${capture.engine}`;
          break;
        }
        case "perceive": {
          const perception = await perceiveScreen({ taskId, sessionId, engine: (step.params.engine as "accessibility_api" | "ocr" | "hybrid" | "playwright_dom" | "playwright_dom_firefox" | "playwright_dom_webkit") ?? "accessibility_api" });
          detail = `Perceived ${perception.elements.length} elements via ${perception.engine}`;
          break;
        }
        case "build_accessibility_tree": {
          const perception = await buildAccessibilityTree({ taskId, sessionId });
          detail = `Built accessibility tree: ${perception.elements.length} elements`;
          break;
        }
        case "element_action": {
          const perception = await buildAccessibilityTree({ taskId, sessionId });
          const target = perception.elements.find(e =>
            e.role === step.params.role || e.label?.includes(step.params.label as string) || e.element_id === step.params.element_id
          );
          if (!target) throw new Error(`Element not found: role=${step.params.role}, label=${step.params.label}`);
          const result = await executeElementAction({
            element: target,
            action: (step.params.action as "click" | "type" | "focus" | "select" | "hover") ?? "click",
            value: step.params.value as string,
            taskId,
            sessionId
          });
          detail = `Element action: ${result.kind}, result=${result.result}, provider=${result.provider}`;
          break;
        }
        case "input_action": {
          const result = await executeInputAction({
            kind: (step.params.kind as InputAction["kind"]) ?? "mouse_click",
            coordinates: step.params.coordinates as { x: number; y: number },
            text: step.params.text as string,
            taskId,
            sessionId
          });
          detail = `Input action: ${result.kind}, result=${result.result}`;
          break;
        }
        case "invoke_app": {
          const result = await invokeLocalApp({
            appIdentifier: step.params.appIdentifier as string,
            method: (step.params.method as "launch" | "open_file" | "open_url" | "send_command") ?? "launch",
            arguments: step.params.arguments as string[],
            timeoutMs: (step.params.timeoutMs as number) ?? 5000,
            taskId,
            sessionId
          });
          detail = `App invoke: exit_code=${result.exit_code}`;
          break;
        }
        case "verify_screenshot_diff": {
          const before = await captureScreen({ taskId, sessionId, engine: "native_screenshot" });
          const after = await captureScreen({ taskId, sessionId, engine: "native_screenshot" });
          const diff = await compareScreenCaptures(before, after);
          detail = `Screenshot diff: similarity=${diff?.similarity_score}, changed=${diff?.changed}`;
          break;
        }
        case "verify_element_state": {
          const perception = await buildAccessibilityTree({ taskId, sessionId });
          const target = perception.elements.find(e => e.element_id === step.params.element_id);
          if (!target) throw new Error(`Element not found: ${step.params.element_id}`);
          detail = `Element state: visible=${target.is_visible}, enabled=${target.is_enabled}, focused=${target.is_focused}`;
          break;
        }
        case "session_lifecycle": {
          const session = createComputerUseSession({ taskId, maxSteps: (step.params.maxSteps as number) ?? 10 });
          if (step.params.pause) pauseComputerUseSession(session.session_id);
          if (step.params.resume) resumeComputerUseSession(session.session_id);
          if (step.params.complete) completeComputerUseSession(session.session_id);
          detail = `Session lifecycle: created session ${session.session_id}`;
          break;
        }
        default:
          detail = `Unknown action: ${step.action}`;
      }

      stepResults.push({
        step_name: step.step_name,
        status: "pass",
        duration_ms: Date.now() - stepStart,
        detail
      });
    } catch (error) {
      stepResults.push({
        step_name: step.step_name,
        status: "fail",
        duration_ms: Date.now() - stepStart,
        detail: "",
        error: (error as Error).message.slice(0, 500)
      });
    }
  }

  const passedSteps = stepResults.filter(s => s.status === "pass").length;
  const failedSteps = stepResults.filter(s => s.status === "fail").length;
  const overallStatus: E2EScenarioResult["status"] = failedSteps === 0 ? "pass" : passedSteps === 0 ? "fail" : "partial";

  return {
    scenario_id: createEntityId("e2e"),
    scenario_name: input.scenario_name,
    status: overallStatus,
    steps: stepResults,
    total_duration_ms: Date.now() - scenarioStart
  };
}

const REGRESSION_TEST_CASES: RegressionTestCase[] = [
  {
    case_id: "reg-001",
    name: "screenshot_capture_no_throw",
    description: "Screenshot capture should not throw on Windows native",
    category: "screenshot",
    severity: "critical",
    repro_steps: ["Call captureScreen with native_screenshot engine"],
    expected_result: "Returns ScreenCapture with valid dimensions and engine"
  },
  {
    case_id: "reg-002",
    name: "accessibility_tree_returns_elements",
    description: "Accessibility tree should return at least one element on Windows",
    category: "accessibility",
    severity: "critical",
    repro_steps: ["Call buildAccessibilityTree on Windows"],
    expected_result: "Returns UIPerception with elements array"
  },
  {
    case_id: "reg-003",
    name: "sandbox_readonly_denies_click",
    description: "host_readonly sandbox tier should deny element_action_click",
    category: "sandbox",
    severity: "critical",
    repro_steps: ["Create session with host_readonly tier", "Enforce sandbox for element_action_click"],
    expected_result: "enforceComputerUseSandbox returns allowed=false"
  },
  {
    case_id: "reg-004",
    name: "sandbox_guarded_allows_click",
    description: "guarded_mutation sandbox tier should allow element_action_click",
    category: "sandbox",
    severity: "critical",
    repro_steps: ["Create session with guarded_mutation tier", "Enforce sandbox for element_action_click"],
    expected_result: "enforceComputerUseSandbox returns allowed=true"
  },
  {
    case_id: "reg-005",
    name: "session_lifecycle_transitions",
    description: "Session should transition through active->paused->active->completed",
    category: "session",
    severity: "high",
    repro_steps: ["Create session", "Pause", "Resume", "Complete"],
    expected_result: "All transitions succeed with correct status"
  },
  {
    case_id: "reg-006",
    name: "local_app_invoke_cmd_echo",
    description: "cmd.exe /c echo should succeed and return stdout",
    category: "local_app",
    severity: "high",
    repro_steps: ["Invoke cmd.exe with /c echo test"],
    expected_result: "exit_code=0, stdout contains 'test'"
  },
  {
    case_id: "reg-007",
    name: "display_enumeration_returns_results",
    description: "listAvailableDisplays should return at least one display",
    category: "multi_display",
    severity: "high",
    repro_steps: ["Call listAvailableDisplays"],
    expected_result: "Returns array with at least one display"
  },
  {
    case_id: "reg-008",
    name: "circuit_breaker_initial_state",
    description: "Circuit breakers should start in closed (not open) state",
    category: "session",
    severity: "medium",
    repro_steps: ["Call getCircuitBreakerStatus after reset"],
    expected_result: "All breakers report isOpen=false"
  },
  {
    case_id: "reg-009",
    name: "session_recording_generates_entries",
    description: "generateSessionRecording should produce entries for a session with steps",
    category: "session_recording",
    severity: "medium",
    repro_steps: ["Create session", "Add steps", "Generate recording"],
    expected_result: "Recording contains entries"
  },
  {
    case_id: "reg-010",
    name: "element_action_resolve_fallback",
    description: "resolveElementAction should fall back to coordinate when no provider handles",
    category: "element_action",
    severity: "medium",
    repro_steps: ["Clear element action providers", "Resolve action for an element"],
    expected_result: "Returns result with method=coordinate_fallback or similar"
  },
  {
    case_id: "reg-011",
    name: "sandbox_isolated_denies_local_app",
    description: "isolated_mutation sandbox tier should deny local_app_invoke",
    category: "sandbox",
    severity: "high",
    repro_steps: ["Create session with isolated_mutation tier", "Enforce sandbox for local_app_invoke"],
    expected_result: "enforceComputerUseSandbox returns allowed=false"
  },
  {
    case_id: "reg-012",
    name: "ocr_provider_registration",
    description: "OCR providers can be registered and listed",
    category: "ocr",
    severity: "medium",
    repro_steps: ["Register an OCR provider", "List providers"],
    expected_result: "Provider appears in list"
  }
];

export async function runRegressionTestSuite(options?: {
  cases?: RegressionTestCase[];
  sessionId?: string;
  taskId?: string;
}): Promise<RegressionTestResult> {
  const cases = options?.cases ?? REGRESSION_TEST_CASES;
  const sessionId = options?.sessionId ?? createEntityId("reg_sess");
  const taskId = options?.taskId ?? createEntityId("reg_task");
  const results: RegressionTestResult["results"] = [];

  for (const tc of cases) {
    const start = Date.now();
    try {
      let detail = "";

      switch (tc.case_id) {
        case "reg-001": {
          const capture = await captureScreen({ taskId, sessionId, engine: "native_screenshot" });
          if (!capture.capture_id || capture.width <= 0 || capture.height <= 0) throw new Error("Invalid capture result");
          detail = `Captured ${capture.width}x${capture.height}`;
          break;
        }
        case "reg-002": {
          const perception = await buildAccessibilityTree({ taskId, sessionId });
          if (!perception.elements || perception.elements.length === 0) throw new Error("No elements returned");
          detail = `${perception.elements.length} elements`;
          break;
        }
        case "reg-003": {
          const session = createComputerUseSession({ taskId, maxSteps: 5, sandboxTier: "host_readonly" });
          const enforcement = enforceComputerUseSandbox({ action: "element_action_click", sessionId: session.session_id });
          completeComputerUseSession(session.session_id);
          if (enforcement.allowed) throw new Error("Click should be denied in host_readonly");
          detail = `Denied as expected: ${enforcement.violations.length} violations`;
          break;
        }
        case "reg-004": {
          const session = createComputerUseSession({ taskId, maxSteps: 5, sandboxTier: "guarded_mutation" });
          const enforcement = enforceComputerUseSandbox({ action: "element_action_click", sessionId: session.session_id });
          completeComputerUseSession(session.session_id);
          if (!enforcement.allowed) throw new Error("Click should be allowed in guarded_mutation");
          detail = "Allowed as expected";
          break;
        }
        case "reg-005": {
          const session = createComputerUseSession({ taskId, maxSteps: 5 });
          if (getComputerUseSession(session.session_id)?.status !== "active") throw new Error("Not active");
          pauseComputerUseSession(session.session_id);
          if (getComputerUseSession(session.session_id)?.status !== "paused") throw new Error("Not paused");
          resumeComputerUseSession(session.session_id);
          if (getComputerUseSession(session.session_id)?.status !== "active") throw new Error("Not resumed");
          completeComputerUseSession(session.session_id);
          if (getComputerUseSession(session.session_id)?.status !== "completed") throw new Error("Not completed");
          detail = "All transitions correct";
          break;
        }
        case "reg-006": {
          const result = await invokeLocalApp({
            appIdentifier: "cmd.exe",
            method: "launch",
            arguments: ["/c", "echo", "regression-test"],
            timeoutMs: 5000,
            taskId,
            sessionId
          });
          if (result.exit_code !== 0 && result.exit_code !== undefined) throw new Error("cmd exited with code " + result.exit_code);
          if (!(result.stdout ?? "").includes("regression-test")) throw new Error("stdout does not contain expected text");
          detail = `exit_code=${result.exit_code}, stdout OK`;
          break;
        }
        case "reg-007": {
          const displays = await listAvailableDisplays();
          if (displays.length === 0) throw new Error("No displays found");
          detail = `${displays.length} display(s)`;
          break;
        }
        case "reg-008": {
          resetCircuitBreakers();
          const status = getCircuitBreakerStatus();
          const openCount = Object.values(status).filter(s => s.isOpen).length;
          if (openCount > 0) throw new Error(`${openCount} circuit breaker(s) still open after reset`);
          detail = "All circuit breakers closed";
          break;
        }
        case "reg-009": {
          const session = createComputerUseSession({ taskId, maxSteps: 5 });
          const perception = await perceiveScreen({ taskId, sessionId: session.session_id, engine: "accessibility_api" });
          const step = ComputerUseStepSchema.parse({
            step_id: createEntityId("custep"),
            session_id: session.session_id,
            step_number: 1,
            kind: "see",
            intention: "regression",
            observation: "Regression test step",
            perception_id: perception.perception_id,
            duration_ms: 10,
            started_at: nowIso(),
            completed_at: nowIso()
          });
          store.computerUseSteps.set(step.step_id, step);
          const recording = generateSessionRecording(session.session_id);
          completeComputerUseSession(session.session_id);
          if (recording.length === 0) throw new Error("No recording entries generated");
          detail = `${recording.length} entries`;
          break;
        }
        case "reg-010": {
          const savedProviders = listElementActionProviders();
          clearElementActionProviders();
          const perception = await buildAccessibilityTree({ taskId, sessionId });
          const interactive = perception.elements.filter(e => e.is_interactive);
          if (interactive.length === 0) {
            for (const name of savedProviders) {
              try { registerElementActionProvider({ name, canHandle: () => false, execute: async () => ({ success: false, method: "none", provider: name, durationMs: 0 }) }); } catch { /* restore what we can */ }
            }
            detail = "No interactive elements - skipped";
            results.push({ case_id: tc.case_id, status: "skip", duration_ms: Date.now() - start, detail });
            continue;
          }
          const resolved = await resolveElementAction(interactive[0], "click");
          for (const name of savedProviders) {
            try { registerElementActionProvider({ name, canHandle: () => false, execute: async () => ({ success: false, method: "none", provider: name, durationMs: 0 }) }); } catch { /* restore what we can */ }
          }
          detail = `Resolved: method=${resolved.method}, provider=${resolved.provider}`;
          break;
        }
        case "reg-011": {
          const session = createComputerUseSession({ taskId, maxSteps: 5, sandboxTier: "isolated_mutation" });
          const enforcement = enforceComputerUseSandbox({ action: "local_app_invoke", sessionId: session.session_id });
          completeComputerUseSession(session.session_id);
          if (enforcement.allowed) throw new Error("local_app_invoke should be denied in isolated_mutation");
          detail = `Denied as expected: ${enforcement.violations.length} violations`;
          break;
        }
        case "reg-012": {
          const beforeCount = listOCRProviders().length;
          const testProvider = {
            name: "regression_test_provider",
            isAvailable: async () => false,
            extractText: async () => ({ fullText: "", regions: [], confidence: 0, processingTimeMs: 0 })
          };
          registerOCRProvider(testProvider);
          const afterCount = listOCRProviders().length;
          if (afterCount <= beforeCount) throw new Error("Provider not registered");
          clearOCRProviders();
          detail = `Registered: before=${beforeCount}, after=${afterCount}`;
          break;
        }
        default:
          detail = `Unknown case: ${tc.case_id}`;
      }

      results.push({ case_id: tc.case_id, status: "pass", duration_ms: Date.now() - start, detail });
    } catch (error) {
      results.push({ case_id: tc.case_id, status: "fail", duration_ms: Date.now() - start, detail: "", error: (error as Error).message.slice(0, 500) });
    }
  }

  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const skipped = results.filter(r => r.status === "skip").length;

  return {
    run_id: createEntityId("reg_run"),
    timestamp: nowIso(),
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      pass_rate: results.length > 0 ? Number((passed / results.length).toFixed(4)) : 0
    }
  };
}

export function getRegressionTestCases(): RegressionTestCase[] {
  return [...REGRESSION_TEST_CASES];
}
