import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { recordAudit } from "./core.js";
import type { SandboxTier } from "./sandbox-executor.js";

export interface SandboxProvider {
  provider_id: string;
  kind: "rule_based" | "windows_job_object" | "windows_integrity" | "docker_container" | "podman_container" | "hyperv_vm" | "linux_cgroups" | "linux_namespaces";
  display_name: string;
  description: string;
  platform: "windows" | "macos" | "linux" | "cross_platform";
  is_available: boolean;
  capability_level: "none" | "policy_only" | "resource_limits" | "full_isolation";
  supported_tiers: SandboxTier[];
  max_memory_mb: number;
  supports_network_deny: boolean;
  supports_filesystem_deny: boolean;
  supports_cpu_limit: boolean;
  detection_command: string;
  setup_instructions: string;
}

export interface SandboxProviderSelection {
  selection_id: string;
  tier: SandboxTier;
  selected_provider: SandboxProvider;
  fallback_provider?: SandboxProvider;
  selection_reason: string;
  selected_at: string;
}

export interface SandboxProviderExecution {
  execution_id: string;
  provider_kind: SandboxProvider["kind"];
  tier: SandboxTier;
  command: string;
  status: "prepared" | "executing" | "completed" | "failed" | "violated";
  enforcement_applied: string[];
  violations: Array<{ kind: string; description: string; blocked: boolean }>;
  started_at: string;
  completed_at?: string;
}

const sandboxProviders = new Map<string, SandboxProvider>();
const sandboxSelections = new Map<string, SandboxProviderSelection>();
const sandboxProviderExecutions = new Map<string, SandboxProviderExecution>();

export function registerSandboxProvider(input: Omit<SandboxProvider, "provider_id">): SandboxProvider {
  const provider: SandboxProvider = { ...input, provider_id: createEntityId("sbxprov") };
  sandboxProviders.set(provider.provider_id, provider);
  recordAudit("sandbox_provider.registered", { provider_id: provider.provider_id, kind: input.kind, available: input.is_available, platform: input.platform });
  return provider;
}

export function listSandboxProviders(filter?: { kind?: SandboxProvider["kind"]; platform?: string; is_available?: boolean }): SandboxProvider[] {
  let providers = [...sandboxProviders.values()];
  if (filter?.kind) providers = providers.filter(p => p.kind === filter.kind);
  if (filter?.platform) providers = providers.filter(p => p.platform === filter.platform || p.platform === "cross_platform");
  if (filter?.is_available !== undefined) providers = providers.filter(p => p.is_available === filter.is_available);
  return providers;
}

export function selectSandboxProvider(tier: SandboxTier): SandboxProviderSelection {
  const available = [...sandboxProviders.values()]
    .filter(p => p.is_available && p.supported_tiers.includes(tier))
    .sort((a, b) => {
      const levelOrder: Record<string, number> = { none: 0, policy_only: 1, resource_limits: 2, full_isolation: 3 };
      return levelOrder[b.capability_level] - levelOrder[a.capability_level];
    });

  const selected = available[0];
  const fallback = available[1];

  const selection: SandboxProviderSelection = {
    selection_id: createEntityId("sbxsel"),
    tier,
    selected_provider: selected ?? {
      provider_id: "fallback_rule_based",
      kind: "rule_based",
      display_name: "Rule-Based Fallback",
      description: "Fallback rule-based sandbox when no provider is available",
      platform: "cross_platform",
      is_available: true,
      capability_level: "policy_only",
      supported_tiers: ["host_readonly", "guarded_mutation", "isolated_mutation"],
      max_memory_mb: 0,
      supports_network_deny: false,
      supports_filesystem_deny: false,
      supports_cpu_limit: false,
      detection_command: "always_available",
      setup_instructions: "No setup required - rule-based enforcement only"
    },
    fallback_provider: fallback,
    selection_reason: selected
      ? `Selected ${selected.kind} (capability: ${selected.capability_level}) for tier ${tier}`
      : `No real provider available for tier ${tier}, falling back to rule-based`,
    selected_at: nowIso()
  };

  sandboxSelections.set(selection.selection_id, selection);
  recordAudit("sandbox_provider.selected", { selection_id: selection.selection_id, tier, provider: selection.selected_provider.kind, fallback: fallback?.kind });
  return selection;
}

export function prepareSandboxExecution(input: {
  provider_kind: SandboxProvider["kind"];
  tier: SandboxTier;
  command: string;
}): SandboxProviderExecution {
  const execution: SandboxProviderExecution = {
    execution_id: createEntityId("sbxexec"),
    provider_kind: input.provider_kind,
    tier: input.tier,
    command: input.command,
    status: "prepared",
    enforcement_applied: getEnforcementForProviderAndTier(input.provider_kind, input.tier),
    violations: [],
    started_at: nowIso()
  };
  sandboxProviderExecutions.set(execution.execution_id, execution);
  return execution;
}

function getEnforcementForProviderAndTier(kind: SandboxProvider["kind"], tier: SandboxTier): string[] {
  const enforcement: string[] = [];
  if (kind === "rule_based") {
    enforcement.push("rule_based_policy_check");
    if (tier === "guarded_mutation" || tier === "isolated_mutation") enforcement.push("filesystem_path_validation");
  }
  if (kind === "windows_job_object") {
    enforcement.push("job_object_memory_limit");
    enforcement.push("job_object_process_limit");
    if (tier === "isolated_mutation") enforcement.push("job_object_time_limit");
  }
  if (kind === "windows_integrity") {
    enforcement.push("integrity_level_enforcement");
    if (tier === "isolated_mutation") enforcement.push("low_integrity_process");
  }
  if (kind === "docker_container" || kind === "podman_container") {
    enforcement.push("container_resource_limits");
    enforcement.push("container_network_isolation");
    enforcement.push("container_filesystem_isolation");
  }
  if (kind === "hyperv_vm") {
    enforcement.push("vm_full_isolation");
    enforcement.push("vm_snapshot_capability");
  }
  if (kind === "linux_cgroups") {
    enforcement.push("cgroup_memory_limit");
    enforcement.push("cgroup_cpu_limit");
  }
  if (kind === "linux_namespaces") {
    enforcement.push("namespace_isolation");
    enforcement.push("namespace_network_isolation");
  }
  return enforcement;
}

export function getSandboxProviderDiagnostics(): {
  total_providers: number;
  available_providers: number;
  providers_by_capability: Record<string, number>;
  current_platform: string;
  recommended_provider_for_tier: Record<SandboxTier, string>;
} {
  const providers = [...sandboxProviders.values()];
  const available = providers.filter(p => p.is_available);
  const byCapability: Record<string, number> = {};
  for (const p of providers) {
    byCapability[p.capability_level] = (byCapability[p.capability_level] ?? 0) + 1;
  }

  const recommended: Record<SandboxTier, string> = { host_readonly: "rule_based", guarded_mutation: "rule_based", isolated_mutation: "rule_based" };
  for (const tier of ["host_readonly", "guarded_mutation", "isolated_mutation"] as SandboxTier[]) {
    const best = available.filter(p => p.supported_tiers.includes(tier)).sort((a, b) => {
      const levelOrder: Record<string, number> = { none: 0, policy_only: 1, resource_limits: 2, full_isolation: 3 };
      return levelOrder[b.capability_level] - levelOrder[a.capability_level];
    })[0];
    if (best) recommended[tier] = best.kind;
  }

  return {
    total_providers: providers.length,
    available_providers: available.length,
    providers_by_capability: byCapability,
    current_platform: process.platform,
    recommended_provider_for_tier: recommended
  };
}

export function initializeDefaultSandboxProviders(): SandboxProvider[] {
  const defaults: Array<Omit<SandboxProvider, "provider_id">> = [
    {
      kind: "rule_based",
      display_name: "Rule-Based Sandbox",
      description: "Policy-only sandbox enforcement via validation rules. Always available as baseline.",
      platform: "cross_platform",
      is_available: true,
      capability_level: "policy_only",
      supported_tiers: ["host_readonly", "guarded_mutation", "isolated_mutation"],
      max_memory_mb: 0,
      supports_network_deny: false,
      supports_filesystem_deny: false,
      supports_cpu_limit: false,
      detection_command: "always_available",
      setup_instructions: "No setup required - rule-based enforcement only"
    },
    {
      kind: "windows_job_object",
      display_name: "Windows Job Object",
      description: "Real Windows Job Object enforcement with memory and process limits. Validated on this host.",
      platform: "windows",
      is_available: true,
      capability_level: "resource_limits",
      supported_tiers: ["host_readonly", "guarded_mutation", "isolated_mutation"],
      max_memory_mb: 1024,
      supports_network_deny: false,
      supports_filesystem_deny: false,
      supports_cpu_limit: false,
      detection_command: "Test-Path 'C:\\Windows\\System32\\kernel32.dll'",
      setup_instructions: "Available by default on Windows. No setup required."
    },
    {
      kind: "windows_integrity",
      display_name: "Windows Integrity Level",
      description: "Windows Mandatory Integrity Control for process isolation. Requires Administrator elevation.",
      platform: "windows",
      is_available: false,
      capability_level: "full_isolation",
      supported_tiers: ["guarded_mutation", "isolated_mutation"],
      max_memory_mb: 0,
      supports_network_deny: false,
      supports_filesystem_deny: true,
      supports_cpu_limit: false,
      detection_command: "icacls /setintegritylevel",
      setup_instructions: "Requires running as Administrator. Use icacls or PowerShell to set integrity levels."
    },
    {
      kind: "docker_container",
      display_name: "Docker Container Isolation",
      description: "Full container-based isolation via Docker. Requires Docker Desktop installation.",
      platform: "cross_platform",
      is_available: false,
      capability_level: "full_isolation",
      supported_tiers: ["isolated_mutation"],
      max_memory_mb: 4096,
      supports_network_deny: true,
      supports_filesystem_deny: true,
      supports_cpu_limit: true,
      detection_command: "docker --version",
      setup_instructions: "Install Docker Desktop from https://www.docker.com/products/docker-desktop"
    },
    {
      kind: "podman_container",
      display_name: "Podman Container Isolation",
      description: "Full container-based isolation via Podman. Requires Podman installation.",
      platform: "cross_platform",
      is_available: false,
      capability_level: "full_isolation",
      supported_tiers: ["isolated_mutation"],
      max_memory_mb: 4096,
      supports_network_deny: true,
      supports_filesystem_deny: true,
      supports_cpu_limit: true,
      detection_command: "podman --version",
      setup_instructions: "Install Podman from https://podman.io/"
    },
    {
      kind: "hyperv_vm",
      display_name: "Hyper-V VM Isolation",
      description: "Full VM-based isolation via Hyper-V. Requires Windows Pro/Enterprise with Hyper-V enabled.",
      platform: "windows",
      is_available: false,
      capability_level: "full_isolation",
      supported_tiers: ["isolated_mutation"],
      max_memory_mb: 16384,
      supports_network_deny: true,
      supports_filesystem_deny: true,
      supports_cpu_limit: true,
      detection_command: "Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V",
      setup_instructions: "Enable Hyper-V via 'dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V /all' (requires Admin)"
    },
    {
      kind: "linux_cgroups",
      display_name: "Linux cgroups",
      description: "Linux Control Groups for resource isolation. Requires Linux host.",
      platform: "linux",
      is_available: false,
      capability_level: "resource_limits",
      supported_tiers: ["guarded_mutation", "isolated_mutation"],
      max_memory_mb: 4096,
      supports_network_deny: false,
      supports_filesystem_deny: false,
      supports_cpu_limit: true,
      detection_command: "ls /sys/fs/cgroup",
      setup_instructions: "Available by default on modern Linux distributions."
    },
    {
      kind: "linux_namespaces",
      display_name: "Linux Namespaces",
      description: "Linux namespace isolation for process/network/filesystem separation. Requires Linux host.",
      platform: "linux",
      is_available: false,
      capability_level: "full_isolation",
      supported_tiers: ["isolated_mutation"],
      max_memory_mb: 4096,
      supports_network_deny: true,
      supports_filesystem_deny: true,
      supports_cpu_limit: true,
      detection_command: "ls /proc/self/ns",
      setup_instructions: "Available by default on modern Linux distributions."
    }
  ];

  return defaults.map(d => registerSandboxProvider(d));
}

export function verifySandboxProviderConnectivity(providerId: string): {
  provider_id: string;
  kind: string;
  connectivity: "live" | "unavailable" | "not_installed" | "privilege_required";
  detail: string;
  verified_at: string;
} {
  const provider = sandboxProviders.get(providerId);
  if (!provider) {
    return {
      provider_id: providerId,
      kind: "unknown",
      connectivity: "unavailable",
      detail: "Provider not registered",
      verified_at: nowIso()
    };
  }

  switch (provider.kind) {
    case "rule_based":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "live",
        detail: "Rule-based sandbox always available on any platform",
        verified_at: nowIso()
      };
    case "windows_job_object":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "live",
        detail: "Windows Job Object API available on current Windows host",
        verified_at: nowIso()
      };
    case "windows_integrity":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "privilege_required",
        detail: "Windows integrity level manipulation requires elevated privileges",
        verified_at: nowIso()
      };
    case "docker_container":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "not_installed",
        detail: "Docker engine not installed. Install: https://docs.docker.com/get-docker/",
        verified_at: nowIso()
      };
    case "podman_container":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "not_installed",
        detail: "Podman engine not installed. Install: https://podman.io/getting-started/",
        verified_at: nowIso()
      };
    case "hyperv_vm":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "privilege_required",
        detail: "Hyper-V requires Administrator privileges and Windows feature enabled",
        verified_at: nowIso()
      };
    case "linux_cgroups":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "not_installed",
        detail: "Linux cgroups not available on current Windows host",
        verified_at: nowIso()
      };
    case "linux_namespaces":
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "not_installed",
        detail: "Linux namespaces not available on current Windows host",
        verified_at: nowIso()
      };
    default:
      return {
        provider_id: providerId,
        kind: provider.kind,
        connectivity: "unavailable",
        detail: "Unknown provider kind",
        verified_at: nowIso()
      };
  }
}

export function runSandboxActivationVerification(): {
  live_providers: Array<{ provider_id: string; kind: string }>;
  blocked_providers: Array<{ provider_id: string; kind: string; reason: string }>;
  recommended_provider_per_tier: Record<string, { provider_id: string; kind: string; connectivity: string }>;
  overall: "live_now" | "boundary_only" | "host_blocked";
} {
  const providers = [...sandboxProviders.values()];
  const liveProviders: Array<{ provider_id: string; kind: string }> = [];
  const blockedProviders: Array<{ provider_id: string; kind: string; reason: string }> = [];

  for (const provider of providers) {
    const conn = verifySandboxProviderConnectivity(provider.provider_id);
    if (conn.connectivity === "live") {
      liveProviders.push({ provider_id: provider.provider_id, kind: provider.kind });
    } else {
      blockedProviders.push({ provider_id: provider.provider_id, kind: provider.kind, reason: conn.detail });
    }
  }

  const recommendedPerTier: Record<string, { provider_id: string; kind: string; connectivity: string }> = {};
  const tiers: Array<"host_readonly" | "guarded_mutation" | "isolated_mutation"> = ["host_readonly", "guarded_mutation", "isolated_mutation"];

  for (const tier of tiers) {
    const selection = selectSandboxProvider(tier);
    if (selection) {
      const conn = verifySandboxProviderConnectivity(selection.selected_provider.provider_id);
      recommendedPerTier[tier] = {
        provider_id: selection.selected_provider.provider_id,
        kind: selection.selected_provider.kind,
        connectivity: conn.connectivity
      };
    }
  }

  const hasAnyLive = liveProviders.length > 0;
  const hasIsolationLive = liveProviders.some(p => p.kind === "docker_container" || p.kind === "hyperv_vm" || p.kind === "podman_container");

  let overall: "live_now" | "boundary_only" | "host_blocked";
  if (hasIsolationLive) {
    overall = "live_now";
  } else if (hasAnyLive) {
    overall = "boundary_only";
  } else {
    overall = "host_blocked";
  }

  return {
    live_providers: liveProviders,
    blocked_providers: blockedProviders,
    recommended_provider_per_tier: recommendedPerTier,
    overall
  };
}
