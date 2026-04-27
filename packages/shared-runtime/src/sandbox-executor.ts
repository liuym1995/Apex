import { spawn } from "node:child_process";
import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  type SandboxManifest
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type SandboxTier = "host_readonly" | "guarded_mutation" | "isolated_mutation";

export interface SandboxExecutionResult {
  success: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  tier: SandboxTier;
  manifest_id: string;
  violations: SandboxViolation[];
  process_id: number | null;
  timed_out: boolean;
  resource_usage: SandboxResourceUsage;
}

export interface SandboxViolation {
  kind: "filesystem_write" | "network_egress" | "resource_limit" | "capability_exceeded" | "timeout" | "quota_exceeded";
  description: string;
  blocked: boolean;
  timestamp: string;
}

export interface SandboxFileSystemRule {
  path: string;
  permission: "readonly" | "readwrite" | "denied";
  recursive: boolean;
}

export interface SandboxNetworkRule {
  destination: string;
  protocol: "tcp" | "udp" | "http" | "https";
  permission: "allow" | "deny";
}

export interface SandboxResourceLimit {
  max_cpu_seconds: number;
  max_memory_mb: number;
  max_file_size_kb: number;
  max_processes: number;
  max_open_files: number;
}

export interface SandboxResourceUsage {
  peak_memory_mb: number;
  cpu_time_ms: number;
  file_writes: number;
  shell_commands: number;
  network_calls: number;
}

export interface SandboxProcessHandle {
  process_id: number;
  manifest_id: string;
  started_at: string;
  command: string;
  args: string[];
  tier: SandboxTier;
  killed: boolean;
}

const activeProcesses = new Map<string, SandboxProcessHandle>();

export function buildSandboxFileSystemRules(manifest: SandboxManifest): SandboxFileSystemRule[] {
  const rules: SandboxFileSystemRule[] = [];

  if (manifest.filesystem_mounts && manifest.filesystem_mounts.length > 0) {
    for (const mount of manifest.filesystem_mounts) {
      rules.push({
        path: mount.path,
        permission: mount.access === "readonly" ? "readonly" : "readwrite",
        recursive: true
      });
    }
  }

  const tier = manifest.tier;
  if (tier === "host_readonly") {
    rules.push({ path: "/", permission: "readonly", recursive: true });
    rules.push({ path: "/tmp", permission: "readwrite", recursive: true });
  } else if (tier === "guarded_mutation") {
    rules.push({ path: "/", permission: "readonly", recursive: true });
    rules.push({ path: "/tmp", permission: "readwrite", recursive: true });
  } else if (tier === "isolated_mutation") {
    rules.push({ path: "/", permission: "denied", recursive: true });
    rules.push({ path: "/tmp", permission: "readwrite", recursive: true });
  }

  return rules;
}

export function buildSandboxNetworkRules(manifest: SandboxManifest): SandboxNetworkRule[] {
  const rules: SandboxNetworkRule[] = [];

  const tier = manifest.tier;
  if (tier === "host_readonly") {
    rules.push({ destination: "*", protocol: "http", permission: "allow" });
    rules.push({ destination: "*", protocol: "https", permission: "allow" });
    rules.push({ destination: "*", protocol: "tcp", permission: "deny" });
    rules.push({ destination: "*", protocol: "udp", permission: "deny" });
  } else if (tier === "guarded_mutation") {
    rules.push({ destination: "*", protocol: "http", permission: "allow" });
    rules.push({ destination: "*", protocol: "https", permission: "allow" });
    rules.push({ destination: "*", protocol: "tcp", permission: "deny" });
    rules.push({ destination: "*", protocol: "udp", permission: "deny" });
  } else if (tier === "isolated_mutation") {
    rules.push({ destination: "*", protocol: "http", permission: "deny" });
    rules.push({ destination: "*", protocol: "https", permission: "deny" });
    rules.push({ destination: "*", protocol: "tcp", permission: "deny" });
    rules.push({ destination: "*", protocol: "udp", permission: "deny" });
  }

  if (manifest.egress_rule_ids && manifest.egress_rule_ids.length > 0) {
    for (const ruleId of manifest.egress_rule_ids) {
      rules.push({ destination: ruleId, protocol: "https", permission: "allow" });
    }
  }

  return rules;
}

export function buildSandboxResourceLimits(manifest: SandboxManifest): SandboxResourceLimit {
  const limits: SandboxResourceLimit = {
    max_cpu_seconds: 300,
    max_memory_mb: 512,
    max_file_size_kb: 10240,
    max_processes: 10,
    max_open_files: 100
  };

  if (manifest.resource_quota) {
    if (manifest.resource_quota.max_wall_clock_ms) limits.max_cpu_seconds = Math.floor(manifest.resource_quota.max_wall_clock_ms / 1000);
    if (manifest.resource_quota.max_memory_bytes) limits.max_memory_mb = Math.floor(manifest.resource_quota.max_memory_bytes / (1024 * 1024));
    if (manifest.resource_quota.max_file_writes) limits.max_file_size_kb = manifest.resource_quota.max_file_writes;
  }

  return limits;
}

export function validateSandboxExecution(manifest: SandboxManifest, action: {
  path?: string;
  write?: boolean;
  network_destination?: string;
  network_protocol?: string;
}): { allowed: boolean; violations: SandboxViolation[] } {
  const violations: SandboxViolation[] = [];
  const fsRules = buildSandboxFileSystemRules(manifest);
  const netRules = buildSandboxNetworkRules(manifest);

  if (action.path) {
    const matchingRule = fsRules
      .filter(r => action.path!.startsWith(r.path))
      .sort((a, b) => b.path.length - a.path.length)[0];

    if (!matchingRule) {
      violations.push({
        kind: "filesystem_write",
        description: `No filesystem rule for path: ${action.path}`,
        blocked: true,
        timestamp: nowIso()
      });
    } else if (matchingRule.permission === "denied") {
      violations.push({
        kind: "filesystem_write",
        description: `Path denied by sandbox: ${action.path}`,
        blocked: true,
        timestamp: nowIso()
      });
    } else if (action.write && matchingRule.permission === "readonly") {
      violations.push({
        kind: "filesystem_write",
        description: `Write to readonly path blocked: ${action.path}`,
        blocked: true,
        timestamp: nowIso()
      });
    }
  }

  if (action.network_destination) {
    const protocol = (action.network_protocol ?? "tcp") as "tcp" | "udp" | "http" | "https";
    const matchingRule = netRules
      .filter(r => (r.destination === "*" || action.network_destination!.endsWith(r.destination)) && r.protocol === protocol)
      .sort((a, b) => b.destination.length - a.destination.length)[0];

    if (!matchingRule || matchingRule.permission === "deny") {
      violations.push({
        kind: "network_egress",
        description: `Network egress blocked: ${protocol}://${action.network_destination}`,
        blocked: true,
        timestamp: nowIso()
      });
    }
  }

  return { allowed: violations.filter(v => v.blocked).length === 0, violations };
}

function checkQuotaBeforeExecution(manifest: SandboxManifest, resourceLimits: SandboxResourceLimit): SandboxViolation[] {
  const violations: SandboxViolation[] = [];
  const usage = manifest.usage_summary;

  if (usage.shell_commands >= resourceLimits.max_processes) {
    violations.push({
      kind: "quota_exceeded",
      description: `Shell command quota exceeded: ${usage.shell_commands}/${resourceLimits.max_processes}`,
      blocked: true,
      timestamp: nowIso()
    });
  }

  if (manifest.resource_quota) {
    if (manifest.resource_quota.max_shell_commands && usage.shell_commands >= manifest.resource_quota.max_shell_commands) {
      violations.push({
        kind: "quota_exceeded",
        description: `Shell command quota exceeded: ${usage.shell_commands}/${manifest.resource_quota.max_shell_commands}`,
        blocked: true,
        timestamp: nowIso()
      });
    }
    if (manifest.resource_quota.max_file_writes && usage.file_writes >= manifest.resource_quota.max_file_writes) {
      violations.push({
        kind: "quota_exceeded",
        description: `File write quota exceeded: ${usage.file_writes}/${manifest.resource_quota.max_file_writes}`,
        blocked: true,
        timestamp: nowIso()
      });
    }
    if (manifest.resource_quota.max_network_calls && usage.network_calls >= manifest.resource_quota.max_network_calls) {
      violations.push({
        kind: "quota_exceeded",
        description: `Network call quota exceeded: ${usage.network_calls}/${manifest.resource_quota.max_network_calls}`,
        blocked: true,
        timestamp: nowIso()
      });
    }
  }

  if (manifest.status === "expired" || manifest.status === "revoked") {
    violations.push({
      kind: "capability_exceeded",
      description: `Sandbox manifest is ${manifest.status}`,
      blocked: true,
      timestamp: nowIso()
    });
  }

  if (Date.parse(manifest.expires_at) < Date.now()) {
    violations.push({
      kind: "capability_exceeded",
      description: `Sandbox manifest expired at ${manifest.expires_at}`,
      blocked: true,
      timestamp: nowIso()
    });
  }

  return violations;
}

function buildIsolatedEnvironment(manifest: SandboxManifest): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (manifest.tier === "isolated_mutation") {
    delete env.HTTP_PROXY;
    delete env.HTTPS_PROXY;
    delete env.http_proxy;
    delete env.https_proxy;
    env.APEX_SANDBOX_TIER = "isolated_mutation";
    env.APEX_SANDBOX_MANIFEST = manifest.manifest_id;
    env.APEX_NETWORK_DISABLED = "1";
  } else if (manifest.tier === "guarded_mutation") {
    env.APEX_SANDBOX_TIER = "guarded_mutation";
    env.APEX_SANDBOX_MANIFEST = manifest.manifest_id;
  } else {
    env.APEX_SANDBOX_TIER = "host_readonly";
    env.APEX_SANDBOX_MANIFEST = manifest.manifest_id;
  }

  if (manifest.capability_tokens && manifest.capability_tokens.length > 0) {
    const validTokens = manifest.capability_tokens
      .filter(t => Date.parse(t.expires_at) > Date.now())
      .map(t => t.capability);
    env.APEX_CAPABILITIES = validTokens.join(",");
  }

  return env;
}

function buildSpawnArgs(command: string, args: string[], tier: SandboxTier): { shellCommand: string; shellArgs: string[] } {
  if (tier === "isolated_mutation") {
    return {
      shellCommand: "cmd",
      shellArgs: ["/c", command, ...args]
    };
  }
  if (tier === "guarded_mutation") {
    return {
      shellCommand: "cmd",
      shellArgs: ["/c", command, ...args]
    };
  }
  return {
    shellCommand: command,
    shellArgs: args
  };
}

export async function executeInSandboxAsync(
  manifestId: string,
  command: string,
  args: string[] = [],
  options: {
    stdin?: string;
    workingDirectory?: string;
  } = {}
): Promise<SandboxExecutionResult> {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`SandboxManifest not found: ${manifestId}`);

  const startTime = Date.now();
  const violations: SandboxViolation[] = [];
  const tier = manifest.tier as SandboxTier;
  const resourceLimits = buildSandboxResourceLimits(manifest);
  const fsRules = buildSandboxFileSystemRules(manifest);
  const netRules = buildSandboxNetworkRules(manifest);

  recordAudit("sandbox.execution_started", {
    manifest_id: manifestId,
    tier,
    command,
    args,
    resource_limits: resourceLimits,
    execution_mode: "process_isolated"
  });

  const quotaViolations = checkQuotaBeforeExecution(manifest, resourceLimits);
  violations.push(...quotaViolations);

  if (violations.filter(v => v.blocked).length > 0) {
    const duration = Date.now() - startTime;
    recordAudit("sandbox.execution_blocked", {
      manifest_id: manifestId,
      tier,
      command,
      blocked_violations: violations.filter(v => v.blocked).length,
      duration_ms: duration
    });
    return {
      success: false,
      exit_code: null,
      stdout: "",
      stderr: violations.map(v => v.description).join("; "),
      duration_ms: duration,
      tier,
      manifest_id: manifestId,
      violations,
      process_id: null,
      timed_out: false,
      resource_usage: { peak_memory_mb: 0, cpu_time_ms: 0, file_writes: 0, shell_commands: 0, network_calls: 0 }
    };
  }

  const cwdValidation = validateSandboxExecution(manifest, {
    path: options.workingDirectory ?? process.cwd(),
    write: tier !== "host_readonly"
  });
  if (!cwdValidation.allowed) {
    violations.push(...cwdValidation.violations);
  }

  if (tier === "isolated_mutation") {
    const netValidation = validateSandboxExecution(manifest, {
      network_destination: "any",
      network_protocol: "tcp"
    });
    if (!netValidation.allowed) {
      violations.push(...netValidation.violations);
    }
  }

  const env = buildIsolatedEnvironment(manifest);
  const { shellCommand, shellArgs } = buildSpawnArgs(command, args, tier);
  const cwd = options.workingDirectory ?? process.cwd();

  let stdout = "";
  let stderr = "";
  let exitCode: number | null = 0;
  let success = true;
  let timedOut = false;
  let processId: number | null = null;
  const resourceUsage: SandboxResourceUsage = {
    peak_memory_mb: 0,
    cpu_time_ms: 0,
    file_writes: manifest.usage_summary.file_writes,
    shell_commands: manifest.usage_summary.shell_commands + 1,
    network_calls: manifest.usage_summary.network_calls
  };

  const timeoutMs = resourceLimits.max_cpu_seconds * 1000;

  try {
    const childProcess = spawn(shellCommand, shellArgs, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: false
    });

    processId = childProcess.pid ?? null;

    const handle: SandboxProcessHandle = {
      process_id: processId ?? 0,
      manifest_id: manifestId,
      started_at: nowIso(),
      command,
      args,
      tier,
      killed: false
    };
    if (processId) {
      activeProcesses.set(`${manifestId}:${processId}`, handle);
    }

    if (options.stdin && childProcess.stdin) {
      childProcess.stdin.write(options.stdin);
      childProcess.stdin.end();
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    childProcess.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    childProcess.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const timeoutHandle = setTimeout(() => {
      if (!handle.killed) {
        timedOut = true;
        handle.killed = true;
        childProcess.kill("SIGKILL");
        violations.push({
          kind: "timeout",
          description: `Process killed after ${timeoutMs}ms (limit: ${resourceLimits.max_cpu_seconds}s)`,
          blocked: true,
          timestamp: nowIso()
        });
      }
    }, timeoutMs);

    const memoryMonitor = setInterval(() => {
      if (handle.killed) {
        clearInterval(memoryMonitor);
        return;
      }
      try {
        const usage = childProcess.killed ? null : process.memoryUsage();
        if (usage) {
          const memMb = Math.floor(usage.rss / (1024 * 1024));
          if (memMb > resourceUsage.peak_memory_mb) {
            resourceUsage.peak_memory_mb = memMb;
          }
          if (memMb > resourceLimits.max_memory_mb) {
            handle.killed = true;
            childProcess.kill("SIGKILL");
            violations.push({
              kind: "resource_limit",
              description: `Memory limit exceeded: ${memMb}MB > ${resourceLimits.max_memory_mb}MB`,
              blocked: true,
              timestamp: nowIso()
            });
          }
        }
      } catch {
        clearInterval(memoryMonitor);
      }
    }, 500);

    await new Promise<void>((resolve) => {
      childProcess.on("close", (code) => {
        clearTimeout(timeoutHandle);
        clearInterval(memoryMonitor);
        exitCode = code;
        resolve();
      });

      childProcess.on("error", (err) => {
        clearTimeout(timeoutHandle);
        clearInterval(memoryMonitor);
        stderr += `Process spawn error: ${err.message}`;
        exitCode = 1;
        resolve();
      });
    });

    stdout = Buffer.concat(stdoutChunks).toString("utf-8");
    stderr += Buffer.concat(stderrChunks).toString("utf-8");

    if (processId) {
      activeProcesses.delete(`${manifestId}:${processId}`);
    }

    if (handle.killed && !timedOut) {
      success = false;
    } else if (timedOut) {
      success = false;
    } else if (exitCode !== 0) {
      success = false;
    }

  } catch (err) {
    success = false;
    exitCode = 1;
    stderr = err instanceof Error ? err.message : String(err);
  }

  const duration = Date.now() - startTime;
  resourceUsage.cpu_time_ms = duration;

  recordAudit("sandbox.execution_completed", {
    manifest_id: manifestId,
    tier,
    command,
    success,
    exit_code: exitCode,
    duration_ms: duration,
    process_id: processId,
    timed_out: timedOut,
    violation_count: violations.length,
    resource_usage: resourceUsage
  });

  return {
    success,
    exit_code: exitCode,
    stdout,
    stderr,
    duration_ms: duration,
    tier,
    manifest_id: manifestId,
    violations,
    process_id: processId,
    timed_out: timedOut,
    resource_usage: resourceUsage
  };
}

export function executeInSandbox(manifestId: string, command: string, args: string[] = []): SandboxExecutionResult {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`SandboxManifest not found: ${manifestId}`);

  const startTime = Date.now();
  const violations: SandboxViolation[] = [];
  const tier = manifest.tier as SandboxTier;
  const resourceLimits = buildSandboxResourceLimits(manifest);
  const fsRules = buildSandboxFileSystemRules(manifest);
  const netRules = buildSandboxNetworkRules(manifest);

  recordAudit("sandbox.execution_started", {
    manifest_id: manifestId,
    tier,
    command,
    resource_limits: resourceLimits,
    execution_mode: "process_isolated_sync"
  });

  const quotaViolations = checkQuotaBeforeExecution(manifest, resourceLimits);
  violations.push(...quotaViolations);

  if (violations.filter(v => v.blocked).length > 0) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      exit_code: null,
      stdout: "",
      stderr: violations.map(v => v.description).join("; "),
      duration_ms: duration,
      tier,
      manifest_id: manifestId,
      violations,
      process_id: null,
      timed_out: false,
      resource_usage: { peak_memory_mb: 0, cpu_time_ms: 0, file_writes: 0, shell_commands: 0, network_calls: 0 }
    };
  }

  const cwdValidation = validateSandboxExecution(manifest, {
    path: process.cwd(),
    write: tier !== "host_readonly"
  });
  if (!cwdValidation.allowed) {
    violations.push(...cwdValidation.violations);
  }

  if (tier === "isolated_mutation") {
    const netValidation = validateSandboxExecution(manifest, {
      network_destination: "any",
      network_protocol: "tcp"
    });
    if (!netValidation.allowed) {
      violations.push(...netValidation.violations);
    }
  }

  const env = buildIsolatedEnvironment(manifest);
  const { shellCommand, shellArgs } = buildSpawnArgs(command, args, tier);
  const timeoutMs = resourceLimits.max_cpu_seconds * 1000;

  let stdout = "";
  let stderr = "";
  let exitCode: number | null = 0;
  let success = true;
  let timedOut = false;
  let processId: number | null = null;
  const resourceUsage: SandboxResourceUsage = {
    peak_memory_mb: 0,
    cpu_time_ms: 0,
    file_writes: manifest.usage_summary.file_writes,
    shell_commands: manifest.usage_summary.shell_commands + 1,
    network_calls: manifest.usage_summary.network_calls
  };

  try {
    const childProcess = spawn(shellCommand, shellArgs, {
      cwd: process.cwd(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: false
    });

    processId = childProcess.pid ?? null;

    const handle: SandboxProcessHandle = {
      process_id: processId ?? 0,
      manifest_id: manifestId,
      started_at: nowIso(),
      command,
      args,
      tier,
      killed: false
    };
    if (processId) {
      activeProcesses.set(`${manifestId}:${processId}`, handle);
    }

    const timeoutHandle = setTimeout(() => {
      if (!handle.killed) {
        timedOut = true;
        handle.killed = true;
        childProcess.kill("SIGKILL");
        violations.push({
          kind: "timeout",
          description: `Process killed after ${timeoutMs}ms (limit: ${resourceLimits.max_cpu_seconds}s)`,
          blocked: true,
          timestamp: nowIso()
        });
      }
    }, timeoutMs);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    childProcess.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    childProcess.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const startMs = Date.now();
    const memoryMonitor = setInterval(() => {
      if (handle.killed) {
        clearInterval(memoryMonitor);
        return;
      }
      const elapsed = Date.now() - startMs;
      if (elapsed > timeoutMs && !handle.killed) {
        timedOut = true;
        handle.killed = true;
        childProcess.kill("SIGKILL");
        violations.push({
          kind: "timeout",
          description: `Process killed after ${elapsed}ms (limit: ${timeoutMs}ms)`,
          blocked: true,
          timestamp: nowIso()
        });
        clearInterval(memoryMonitor);
      }
    }, 1000);

    const closed = new Promise<{ code: number | null }>((resolve) => {
      childProcess.on("close", (code) => {
        clearTimeout(timeoutHandle);
        clearInterval(memoryMonitor);
        resolve({ code });
      });
      childProcess.on("error", () => {
        clearTimeout(timeoutHandle);
        clearInterval(memoryMonitor);
        resolve({ code: 1 });
      });
    });

    const timeoutPromise = new Promise<{ code: number | null }>((resolve) => {
      setTimeout(() => {
        if (!handle.killed) {
          timedOut = true;
          handle.killed = true;
          childProcess.kill("SIGKILL");
          violations.push({
            kind: "timeout",
            description: `Process timed out after ${timeoutMs}ms`,
            blocked: true,
            timestamp: nowIso()
          });
        }
        resolve({ code: null });
      }, timeoutMs + 2000);
    });

    const result = Promise.race([closed, timeoutPromise]);

    let resolved = false;
    closed.then(() => { resolved = true; });

    const syncWaitStart = Date.now();
    const maxSyncWait = Math.min(timeoutMs + 5000, 30000);
    while (!resolved && Date.now() - syncWaitStart < maxSyncWait) {
      const chunk = { resolved: false };
      closed.then(() => { chunk.resolved = true; });
    }

    if (processId) {
      activeProcesses.delete(`${manifestId}:${processId}`);
    }

    stdout = Buffer.concat(stdoutChunks).toString("utf-8");
    stderr = Buffer.concat(stderrChunks).toString("utf-8");

    if (handle.killed || timedOut) {
      success = false;
    }

  } catch (err) {
    success = false;
    exitCode = 1;
    stderr = err instanceof Error ? err.message : String(err);
  }

  const duration = Date.now() - startTime;
  resourceUsage.cpu_time_ms = duration;

  recordAudit("sandbox.execution_completed", {
    manifest_id: manifestId,
    tier,
    command,
    success,
    exit_code: exitCode,
    duration_ms: duration,
    process_id: processId,
    timed_out: timedOut,
    violation_count: violations.length,
    resource_usage: resourceUsage
  });

  return {
    success,
    exit_code: exitCode,
    stdout,
    stderr,
    duration_ms: duration,
    tier,
    manifest_id: manifestId,
    violations,
    process_id: processId,
    timed_out: timedOut,
    resource_usage: resourceUsage
  };
}

export function killSandboxProcess(manifestId: string, processId: number): boolean {
  const key = `${manifestId}:${processId}`;
  const handle = activeProcesses.get(key);
  if (!handle) return false;

  handle.killed = true;
  activeProcesses.delete(key);

  recordAudit("sandbox.process_killed", {
    manifest_id: manifestId,
    process_id: processId,
    tier: handle.tier,
    command: handle.command
  });

  try {
    process.kill(processId, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

export function listActiveSandboxProcesses(manifestId?: string): SandboxProcessHandle[] {
  const handles = [...activeProcesses.values()];
  if (manifestId) return handles.filter(h => h.manifest_id === manifestId);
  return handles;
}

export function getSandboxExecutionReport(manifestId: string): {
  manifest: SandboxManifest;
  filesystem_rules: SandboxFileSystemRule[];
  network_rules: SandboxNetworkRule[];
  resource_limits: SandboxResourceLimit;
  active_processes: SandboxProcessHandle[];
} {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`SandboxManifest not found: ${manifestId}`);

  return {
    manifest,
    filesystem_rules: buildSandboxFileSystemRules(manifest),
    network_rules: buildSandboxNetworkRules(manifest),
    resource_limits: buildSandboxResourceLimits(manifest),
    active_processes: listActiveSandboxProcesses(manifestId)
  };
}

export function validateFilesystemMounts(manifestId: string): {
  valid: boolean;
  mount_validations: Array<{
    path: string;
    access: string;
    exists: boolean;
    readable: boolean;
    writable: boolean;
    errors: string[];
  }>;
} {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`SandboxManifest not found: ${manifestId}`);

  const fs = require("node:fs");
  const path = require("node:path");
  const mountValidations: Array<{
    path: string;
    access: string;
    exists: boolean;
    readable: boolean;
    writable: boolean;
    errors: string[];
  }> = [];

  for (const mount of manifest.filesystem_mounts) {
    const errors: string[] = [];
    let exists = false;
    let readable = false;
    let writable = false;

    try {
      const resolvedPath = path.resolve(mount.path);
      exists = fs.existsSync(resolvedPath);

      if (exists) {
        try {
          fs.accessSync(resolvedPath, fs.constants.R_OK);
          readable = true;
        } catch {
          errors.push(`Path not readable: ${resolvedPath}`);
        }

        if (mount.access === "readwrite") {
          try {
            fs.accessSync(resolvedPath, fs.constants.W_OK);
            writable = true;
          } catch {
            errors.push(`Path not writable (required for readwrite access): ${resolvedPath}`);
          }
        } else {
          writable = false;
        }
      } else {
        errors.push(`Path does not exist: ${mount.path}`);
      }
    } catch (err) {
      errors.push(`Validation error: ${err instanceof Error ? err.message : String(err)}`);
    }

    mountValidations.push({
      path: mount.path,
      access: mount.access,
      exists,
      readable,
      writable,
      errors
    });
  }

  const valid = mountValidations.every(m => m.errors.length === 0);

  recordAudit("sandbox.filesystem_mounts_validated", {
    manifest_id: manifestId,
    mount_count: manifest.filesystem_mounts.length,
    valid,
    error_count: mountValidations.reduce((sum, m) => sum + m.errors.length, 0)
  });

  return { valid, mount_validations: mountValidations };
}
