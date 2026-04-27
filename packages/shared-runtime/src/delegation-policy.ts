import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type SubagentResourceMode = "auto" | "manual";

export interface DelegationPolicySettings {
  subagent_resource_mode: SubagentResourceMode;
  cpu_reserve_ratio: number;
  memory_reserve_ratio: number;
  max_parallel_subagents: number;
  max_total_subagents_per_task: number;
  max_delegation_depth: number;
}

export interface MachineResourceEnvelope {
  logical_cpu_cores: number;
  available_memory_mb: number;
  allocatable_cpu_cores: number;
  allocatable_memory_mb: number;
  cpu_derived_max_parallel: number;
  memory_derived_max_parallel: number;
  detected_at: string;
}

export interface EffectiveDelegationLimits {
  effective_max_parallel: number;
  effective_max_total_per_task: number;
  effective_max_depth: number;
  cpu_derived: number;
  memory_derived: number;
  topology_cap: number;
  clamped_by: "topology_cap" | "cpu" | "memory" | "none";
  computed_at: string;
}

const DEFAULT_POLICY: DelegationPolicySettings = {
  subagent_resource_mode: "auto",
  cpu_reserve_ratio: 0.2,
  memory_reserve_ratio: 0.2,
  max_parallel_subagents: 4,
  max_total_subagents_per_task: 8,
  max_delegation_depth: 2
};

let currentPolicy: DelegationPolicySettings = { ...DEFAULT_POLICY };

export function getDefaultDelegationPolicy(): DelegationPolicySettings {
  return { ...DEFAULT_POLICY };
}

export function loadDelegationPolicy(overrides?: Partial<DelegationPolicySettings>): DelegationPolicySettings {
  if (overrides) {
    currentPolicy = { ...DEFAULT_POLICY, ...overrides };
  }
  return { ...currentPolicy };
}

export function updateDelegationPolicy(updates: Partial<DelegationPolicySettings>): DelegationPolicySettings {
  currentPolicy = { ...currentPolicy, ...updates };
  recordAudit("delegation_policy.updated", { updates, policy: currentPolicy });
  return { ...currentPolicy };
}

export function detectMachineResources(): MachineResourceEnvelope {
  const cpus = typeof require === "function" ? require("node:os").cpus() : undefined;
  const totalMem = typeof require === "function" ? require("node:os").totalmem() : undefined;
  const freeMem = typeof require === "function" ? require("node:os").freemem() : undefined;

  const logicalCores = cpus?.length ?? 4;
  const availableMemoryMb = Math.floor((freeMem ?? totalMem ?? 4 * 1024 * 1024 * 1024) / (1024 * 1024));

  const policy = loadDelegationPolicy();
  const allocatableCpu = Math.max(1, Math.floor(logicalCores * (1 - policy.cpu_reserve_ratio)));
  const allocatableMemoryMb = Math.max(1024, Math.floor(availableMemoryMb * (1 - policy.memory_reserve_ratio)));

  const cpuDerived = Math.max(1, Math.floor(allocatableCpu / 2));
  const memoryDerived = Math.max(1, Math.floor(allocatableMemoryMb / 1024));

  return {
    logical_cpu_cores: logicalCores,
    available_memory_mb: availableMemoryMb,
    allocatable_cpu_cores: allocatableCpu,
    allocatable_memory_mb: allocatableMemoryMb,
    cpu_derived_max_parallel: cpuDerived,
    memory_derived_max_parallel: memoryDerived,
    detected_at: nowIso()
  };
}

export function computeEffectiveDelegationLimits(policy?: DelegationPolicySettings, machine?: MachineResourceEnvelope): EffectiveDelegationLimits {
  const p = policy ?? loadDelegationPolicy();
  const m = machine ?? detectMachineResources();

  let effectiveMaxParallel: number;
  let clampedBy: EffectiveDelegationLimits["clamped_by"];

  if (p.subagent_resource_mode === "manual") {
    effectiveMaxParallel = p.max_parallel_subagents;
    clampedBy = "topology_cap";
  } else {
    const candidates = [
      { value: p.max_parallel_subagents, source: "topology_cap" as const },
      { value: m.cpu_derived_max_parallel, source: "cpu" as const },
      { value: m.memory_derived_max_parallel, source: "memory" as const }
    ];
    const min = candidates.reduce((a, b) => a.value <= b.value ? a : b);
    effectiveMaxParallel = min.value;
    clampedBy = min.source;
    if (effectiveMaxParallel === p.max_parallel_subagents) clampedBy = "topology_cap";
  }

  effectiveMaxParallel = Math.max(1, effectiveMaxParallel);

  return {
    effective_max_parallel: effectiveMaxParallel,
    effective_max_total_per_task: p.max_total_subagents_per_task,
    effective_max_depth: p.max_delegation_depth,
    cpu_derived: m.cpu_derived_max_parallel,
    memory_derived: m.memory_derived_max_parallel,
    topology_cap: p.max_parallel_subagents,
    clamped_by: clampedBy,
    computed_at: nowIso()
  };
}

export function getDelegationPolicyDiagnostics(): {
  policy: DelegationPolicySettings;
  machine: MachineResourceEnvelope;
  effective: EffectiveDelegationLimits;
} {
  const policy = loadDelegationPolicy();
  const machine = detectMachineResources();
  const effective = computeEffectiveDelegationLimits(policy, machine);
  return { policy, machine, effective };
}
