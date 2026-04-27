import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  OSIsolationBackendSchema,
  IsolationPolicyToBackendMappingSchema,
  type OSIsolationBackend,
  type OSIsolationBackendKind,
  type IsolationPolicyToBackendMapping
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export function registerOSIsolationBackend(input: {
  backend_kind: OSIsolationBackendKind;
  display_name: string;
  platform?: OSIsolationBackend["platform"];
  capability_level?: OSIsolationBackend["capability_level"];
  available?: boolean;
  detection_command?: string;
  config_schema?: Record<string, unknown>;
}): OSIsolationBackend {
  const backend = OSIsolationBackendSchema.parse({
    backend_id: createEntityId("osbe"),
    backend_kind: input.backend_kind,
    display_name: input.display_name,
    platform: input.platform ?? "windows",
    capability_level: input.capability_level ?? "none",
    available: input.available ?? false,
    detection_command: input.detection_command,
    config_schema: input.config_schema ?? {},
    created_at: nowIso()
  });

  store.osIsolationBackends.set(backend.backend_id, backend);

  recordAudit("os_isolation.backend_registered", {
    backend_id: backend.backend_id,
    backend_kind: input.backend_kind,
    platform: backend.platform,
    capability_level: backend.capability_level,
    available: backend.available
  });

  return backend;
}

export function listOSIsolationBackends(filter?: {
  platform?: OSIsolationBackend["platform"];
  available_only?: boolean;
}): OSIsolationBackend[] {
  let backends = [...store.osIsolationBackends.values()];
  if (filter?.platform) backends = backends.filter(b => b.platform === filter.platform);
  if (filter?.available_only) backends = backends.filter(b => b.available);
  return backends.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function detectOSIsolationCapabilities(): {
  platform: string;
  detected_backends: Array<{
    backend_kind: OSIsolationBackendKind;
    available: boolean;
    capability_level: string;
  }>;
  current_enforcement_level: "rule_only" | "policy_translated" | "backend_enforced";
  recommended_backend: OSIsolationBackendKind | undefined;
} {
  const platform = detectPlatform();
  const backends = [...store.osIsolationBackends.values()]
    .filter(b => b.platform === platform || b.platform === "cross_platform");

  const detectedBackends = backends.map(b => ({
    backend_kind: b.backend_kind,
    available: b.available,
    capability_level: b.capability_level
  }));

  const recommendedBackend = backends
    .filter(b => b.available)
    .sort((a, b) => {
      const levelOrder = { none: 0, filesystem_restriction: 1, network_restriction: 2, process_restriction: 3, full_isolation: 4 };
      return (levelOrder[b.capability_level] ?? 0) - (levelOrder[a.capability_level] ?? 0);
    })[0]?.backend_kind;

  const currentEnforcementLevel = recommendedBackend
    ? "policy_translated"
    : "rule_only";

  return {
    platform,
    detected_backends: detectedBackends,
    current_enforcement_level: currentEnforcementLevel,
    recommended_backend: recommendedBackend
  };
}

function detectPlatform(): string {
  if (typeof process !== "undefined" && process.platform) {
    switch (process.platform) {
      case "win32": return "windows";
      case "darwin": return "macos";
      case "linux": return "linux";
      default: return process.platform;
    }
  }
  return "unknown";
}

export function createIsolationPolicyToBackendMapping(input: {
  sandbox_tier: IsolationPolicyToBackendMapping["sandbox_tier"];
  backend_id: string;
  enforcement_level?: IsolationPolicyToBackendMapping["enforcement_level"];
  translated_capabilities?: string[];
}): IsolationPolicyToBackendMapping {
  const mapping = IsolationPolicyToBackendMappingSchema.parse({
    mapping_id: createEntityId("isomap"),
    sandbox_tier: input.sandbox_tier,
    backend_id: input.backend_id,
    enforcement_level: input.enforcement_level ?? "rule_only",
    translated_capabilities: input.translated_capabilities ?? [],
    created_at: nowIso()
  });

  store.isolationPolicyToBackendMappings.set(mapping.mapping_id, mapping);

  recordAudit("os_isolation.policy_mapping_created", {
    mapping_id: mapping.mapping_id,
    sandbox_tier: input.sandbox_tier,
    backend_id: input.backend_id,
    enforcement_level: mapping.enforcement_level
  });

  return mapping;
}

export function translateSandboxTierToBackendCapabilities(sandboxTier: "host_readonly" | "guarded_mutation" | "isolated_mutation"): {
  tier: string;
  required_capabilities: string[];
  recommended_backend_kind: OSIsolationBackendKind;
  current_enforcement: string;
  backend_specific_config: Record<string, unknown>;
} {
  const mappings = [...store.isolationPolicyToBackendMappings.values()]
    .filter(m => m.sandbox_tier === sandboxTier);

  const activeMapping = mappings[mappings.length - 1];
  const backend = activeMapping
    ? store.osIsolationBackends.get(activeMapping.backend_id)
    : undefined;

  const tierCapabilities: Record<string, string[]> = {
    host_readonly: ["filesystem_read", "network_read", "process_list"],
    guarded_mutation: ["filesystem_read", "filesystem_write_limited", "network_read", "network_write_limited", "process_spawn"],
    isolated_mutation: ["filesystem_read", "filesystem_write", "network_read", "network_write", "process_spawn", "process_isolation"]
  };

  const recommendedBackend: Record<string, OSIsolationBackendKind> = {
    host_readonly: "rule_based",
    guarded_mutation: "windows_job_object",
    isolated_mutation: "container_docker"
  };

  const backendConfig: Record<string, Record<string, unknown>> = {
    host_readonly: {
      enforcement: "rule_validation_only",
      network_disabled: false,
      filesystem_readonly: true
    },
    guarded_mutation: {
      enforcement: "job_object_limits",
      max_memory_mb: 512,
      max_cpu_percent: 50,
      network_restricted: true,
      allowed_hosts: []
    },
    isolated_mutation: {
      enforcement: "container_isolation",
      image: "apex-worker:latest",
      memory_limit_mb: 1024,
      cpu_limit_percent: 80,
      network_mode: "bridge",
      volume_mounts: []
    }
  };

  return {
    tier: sandboxTier,
    required_capabilities: tierCapabilities[sandboxTier] ?? [],
    recommended_backend_kind: recommendedBackend[sandboxTier] ?? "rule_based",
    current_enforcement: activeMapping?.enforcement_level ?? "rule_only",
    backend_specific_config: backendConfig[sandboxTier] ?? {}
  };
}

export function getOSIsolationReadinessDiagnostics(): {
  backends_registered: number;
  backends_available: number;
  policy_mappings_count: number;
  current_platform: string;
  current_enforcement_level: string;
  recommended_backend: OSIsolationBackendKind | undefined;
  readiness_level: "not_prepared" | "rule_based_only" | "boundary_prepared" | "ready_for_backend_enforcement";
  blocking_items: string[];
} {
  const backends = [...store.osIsolationBackends.values()];
  const mappings = [...store.isolationPolicyToBackendMappings.values()];
  const capabilities = detectOSIsolationCapabilities();

  const blockingItems: string[] = [];
  let readinessLevel: "not_prepared" | "rule_based_only" | "boundary_prepared" | "ready_for_backend_enforcement" = "not_prepared";

  if (backends.length === 0) {
    blockingItems.push("No OS isolation backends registered");
  } else if (!backends.some(b => b.available)) {
    readinessLevel = "rule_based_only";
    blockingItems.push("No backends marked as available - all are boundary registrations");
    blockingItems.push("Real OS-native isolation requires platform-specific implementation");
  } else if (mappings.length === 0) {
    readinessLevel = "boundary_prepared";
    blockingItems.push("No policy-to-backend mappings created");
  } else {
    readinessLevel = "ready_for_backend_enforcement";
  }

  return {
    backends_registered: backends.length,
    backends_available: backends.filter(b => b.available).length,
    policy_mappings_count: mappings.length,
    current_platform: capabilities.platform,
    current_enforcement_level: capabilities.current_enforcement_level,
    recommended_backend: capabilities.recommended_backend,
    readiness_level: readinessLevel,
    blocking_items: blockingItems
  };
}

export function initializeDefaultOSIsolationBackends(): OSIsolationBackend[] {
  const backends: OSIsolationBackend[] = [];

  const defaults: Array<{
    backend_kind: OSIsolationBackendKind;
    display_name: string;
    platform: OSIsolationBackend["platform"];
    capability_level: OSIsolationBackend["capability_level"];
    detection_command?: string;
  }> = [
    {
      backend_kind: "rule_based",
      display_name: "Rule-Based Validation",
      platform: "cross_platform",
      capability_level: "none"
    },
    {
      backend_kind: "windows_job_object",
      display_name: "Windows Job Object",
      platform: "windows",
      capability_level: "process_restriction",
      detection_command: "ver"
    },
    {
      backend_kind: "windows_mandatory_integrity",
      display_name: "Windows Mandatory Integrity Control",
      platform: "windows",
      capability_level: "filesystem_restriction",
      detection_command: "whoami /priv"
    },
    {
      backend_kind: "container_docker",
      display_name: "Docker Container",
      platform: "cross_platform",
      capability_level: "full_isolation",
      detection_command: "docker version"
    },
    {
      backend_kind: "container_podman",
      display_name: "Podman Container",
      platform: "cross_platform",
      capability_level: "full_isolation",
      detection_command: "podman version"
    },
    {
      backend_kind: "vm_hyperv",
      display_name: "Hyper-V VM",
      platform: "windows",
      capability_level: "full_isolation",
      detection_command: "Get-VM -ErrorAction SilentlyContinue"
    },
    {
      backend_kind: "linux_cgroups",
      display_name: "Linux Cgroups",
      platform: "linux",
      capability_level: "process_restriction",
      detection_command: "ls /sys/fs/cgroup"
    },
    {
      backend_kind: "linux_namespaces",
      display_name: "Linux Namespaces",
      platform: "linux",
      capability_level: "full_isolation",
      detection_command: "ls /proc/self/ns"
    }
  ];

  for (const def of defaults) {
    const existing = [...store.osIsolationBackends.values()]
      .find(b => b.backend_kind === def.backend_kind);
    if (!existing) {
      backends.push(registerOSIsolationBackend({
        backend_kind: def.backend_kind,
        display_name: def.display_name,
        platform: def.platform,
        capability_level: def.capability_level,
        available: false,
        detection_command: def.detection_command
      }));
    }
  }

  return backends;
}

export function getOSIsolationRunbook(backendKind: OSIsolationBackendKind): {
  backend_kind: string;
  platform: string;
  setup_steps: string[];
  verification_steps: string[];
  rollback_steps: string[];
  prerequisites: string[];
} {
  const runbooks: Record<string, {
    platform: string;
    setup_steps: string[];
    verification_steps: string[];
    rollback_steps: string[];
    prerequisites: string[];
  }> = {
    windows_job_object: {
      platform: "windows",
      setup_steps: [
        "1. Verify Windows Job Object API availability",
        "2. Configure memory and CPU limits per tier",
        "3. Create policy-to-backend mappings",
        "4. Test with guarded_mutation tier tasks",
        "5. Enable backend enforcement"
      ],
      verification_steps: [
        "Verify job object creation succeeds",
        "Verify memory limit enforcement",
        "Verify CPU limit enforcement",
        "Verify process termination on limit breach"
      ],
      rollback_steps: [
        "1. Disable backend enforcement",
        "2. Revert to rule_only enforcement",
        "3. Remove policy-to-backend mappings"
      ],
      prerequisites: ["Windows 10+", "Process creation privileges"]
    },
    container_docker: {
      platform: "cross_platform",
      setup_steps: [
        "1. Install Docker Desktop or Docker Engine",
        "2. Build apex-worker container image",
        "3. Configure container resource limits per tier",
        "4. Create policy-to-backend mappings",
        "5. Test with isolated_mutation tier tasks",
        "6. Enable backend enforcement"
      ],
      verification_steps: [
        "Verify Docker daemon is running",
        "Verify container creation succeeds",
        "Verify resource limits are enforced",
        "Verify network isolation works",
        "Verify filesystem isolation works"
      ],
      rollback_steps: [
        "1. Disable backend enforcement",
        "2. Stop and remove containers",
        "3. Revert to rule_only enforcement"
      ],
      prerequisites: ["Docker Desktop or Docker Engine", "Container image built", "Sufficient disk space for images"]
    }
  };

  const runbook = runbooks[backendKind] ?? {
    platform: "unknown",
    setup_steps: ["1. Configure backend", "2. Create policy mappings", "3. Test enforcement"],
    verification_steps: ["Verify backend is available", "Verify enforcement works"],
    rollback_steps: ["1. Disable backend enforcement", "2. Revert to rule_only"],
    prerequisites: ["Platform-specific setup required"]
  };

  return {
    backend_kind: backendKind,
    ...runbook
  };
}
