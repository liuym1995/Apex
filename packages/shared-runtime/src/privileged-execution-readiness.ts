import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type PrivilegedOperationKind =
  | "integrity_level_change"
  | "firewall_rule_change"
  | "hyper_v_check"
  | "job_object_creation"
  | "process_token_adjustment"
  | "service_installation"
  | "driver_installation"
  | "registry_hklm_write"
  | "device_driver_access"
  | "admin_sandbox_backend";

export type ReadinessStatus = "not_supported" | "supported_but_blocked_by_missing_admin" | "supported_and_ready";

export interface PrivilegedOperationContract {
  contract_id: string;
  operation_kind: PrivilegedOperationKind;
  display_name: string;
  description: string;
  requires_admin: boolean;
  expected_command: string;
  rollback_command?: string;
  rollback_notes?: string;
  risk_level: "low" | "medium" | "high" | "critical";
  affected_system_area: string;
  prerequisites: string[];
  verification_command?: string;
  readiness_status: ReadinessStatus;
  last_checked_at?: string;
  created_at: string;
}

export interface AdminOperationRegistryEntry {
  entry_id: string;
  operation_kind: PrivilegedOperationKind;
  reason: string;
  expected_command: string;
  rollback_notes: string;
  impact_if_unavailable: "blocking" | "degraded" | "optional";
  alternative_approach?: string;
  created_at: string;
}

export interface ElevationDryRunResult {
  dry_run_id: string;
  operation_kind: PrivilegedOperationKind;
  would_succeed: boolean;
  would_require_elevation: boolean;
  current_elevation_status: "elevated" | "not_elevated" | "unknown";
  simulated_command: string;
  simulated_output?: string;
  simulated_exit_code?: number;
  warnings: string[];
  prerequisites_met: boolean;
  missing_prerequisites: string[];
  readiness_after: ReadinessStatus;
  created_at: string;
}

export interface PrivilegedRunRunbook {
  runbook_id: string;
  title: string;
  operation_kinds: PrivilegedOperationKind[];
  steps: Array<{
    step_number: number;
    description: string;
    command?: string;
    expected_outcome: string;
    verification?: string;
    rollback_step?: number;
    requires_elevation: boolean;
    risk_notes?: string;
  }>;
  total_elevation_steps: number;
  estimated_duration_minutes?: number;
  prerequisites: string[];
  rollback_plan: string;
  created_at: string;
}

export interface PrivilegedReadinessDiagnostics {
  diagnostics_id: string;
  platform: string;
  is_elevated: boolean;
  elevation_status: "elevated" | "not_elevated" | "unknown";
  contracts: Array<{
    operation_kind: PrivilegedOperationKind;
    readiness_status: ReadinessStatus;
    display_name: string;
  }>;
  summary: {
    total_operations: number;
    ready_count: number;
    blocked_by_admin_count: number;
    not_supported_count: number;
    readiness_percentage: number;
  };
  blocking_items: Array<{
    operation_kind: PrivilegedOperationKind;
    reason: string;
    impact: "blocking" | "degraded" | "optional";
  }>;
  next_actions: string[];
  created_at: string;
}

export function registerPrivilegedOperationContract(input: {
  operation_kind: PrivilegedOperationKind;
  display_name: string;
  description: string;
  requires_admin: boolean;
  expected_command: string;
  rollback_command?: string;
  rollback_notes?: string;
  risk_level?: "low" | "medium" | "high" | "critical";
  affected_system_area?: string;
  prerequisites?: string[];
  verification_command?: string;
}): PrivilegedOperationContract {
  const readiness: ReadinessStatus = input.requires_admin ? "supported_but_blocked_by_missing_admin" : "supported_and_ready";

  const contract: PrivilegedOperationContract = {
    contract_id: createEntityId("privop"),
    operation_kind: input.operation_kind,
    display_name: input.display_name,
    description: input.description,
    requires_admin: input.requires_admin,
    expected_command: input.expected_command,
    rollback_command: input.rollback_command,
    rollback_notes: input.rollback_notes,
    risk_level: input.risk_level ?? "medium",
    affected_system_area: input.affected_system_area ?? "system",
    prerequisites: input.prerequisites ?? [],
    verification_command: input.verification_command,
    readiness_status: readiness,
    last_checked_at: nowIso(),
    created_at: nowIso()
  };

  store.privilegedOperationContracts.set(contract.contract_id, contract);

  recordAudit("privileged_execution.contract_registered", {
    contract_id: contract.contract_id,
    operation_kind: input.operation_kind,
    readiness_status: readiness,
    requires_admin: input.requires_admin
  });

  return contract;
}

export function listPrivilegedOperationContracts(filter?: {
  operation_kind?: PrivilegedOperationKind;
  readiness_status?: ReadinessStatus;
  requires_admin?: boolean;
}): PrivilegedOperationContract[] {
  let contracts = [...store.privilegedOperationContracts.values()] as PrivilegedOperationContract[];
  if (filter?.operation_kind) contracts = contracts.filter(c => c.operation_kind === filter.operation_kind);
  if (filter?.readiness_status) contracts = contracts.filter(c => c.readiness_status === filter.readiness_status);
  if (filter?.requires_admin !== undefined) contracts = contracts.filter(c => c.requires_admin === filter.requires_admin);
  return contracts.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getPrivilegedOperationContract(contractId: string): PrivilegedOperationContract | undefined {
  return store.privilegedOperationContracts.get(contractId) as PrivilegedOperationContract | undefined;
}

export function addAdminOperationRegistryEntry(input: {
  operation_kind: PrivilegedOperationKind;
  reason: string;
  expected_command: string;
  rollback_notes: string;
  impact_if_unavailable?: "blocking" | "degraded" | "optional";
  alternative_approach?: string;
}): AdminOperationRegistryEntry {
  const entry: AdminOperationRegistryEntry = {
    entry_id: createEntityId("admop"),
    operation_kind: input.operation_kind,
    reason: input.reason,
    expected_command: input.expected_command,
    rollback_notes: input.rollback_notes,
    impact_if_unavailable: input.impact_if_unavailable ?? "degraded",
    alternative_approach: input.alternative_approach,
    created_at: nowIso()
  };

  store.adminOperationRegistryEntries.set(entry.entry_id, entry);

  recordAudit("privileged_execution.admin_registry_entry_added", {
    entry_id: entry.entry_id,
    operation_kind: input.operation_kind,
    impact: entry.impact_if_unavailable
  });

  return entry;
}

export function listAdminOperationRegistryEntries(filter?: {
  operation_kind?: PrivilegedOperationKind;
  impact_if_unavailable?: "blocking" | "degraded" | "optional";
}): AdminOperationRegistryEntry[] {
  let entries = [...store.adminOperationRegistryEntries.values()] as AdminOperationRegistryEntry[];
  if (filter?.operation_kind) entries = entries.filter(e => e.operation_kind === filter.operation_kind);
  if (filter?.impact_if_unavailable) entries = entries.filter(e => e.impact_if_unavailable === filter.impact_if_unavailable);
  return entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function executeElevationDryRun(input: {
  operation_kind: PrivilegedOperationKind;
  simulated_command?: string;
}): ElevationDryRunResult {
  const contract = ([...store.privilegedOperationContracts.values()] as PrivilegedOperationContract[])
    .find(c => c.operation_kind === input.operation_kind);

  const isElevated = false;
  const wouldRequireElevation = contract?.requires_admin ?? true;
  const wouldSucceed = !wouldRequireElevation || isElevated;

  const warnings: string[] = [];
  const missingPrerequisites: string[] = [];

  if (contract) {
    for (const prereq of contract.prerequisites) {
      missingPrerequisites.push(prereq);
      warnings.push(`Prerequisite not verified: ${prereq}`);
    }
  }

  if (wouldRequireElevation && !isElevated) {
    warnings.push("Operation requires Administrator elevation which is not currently available");
  }

  if (input.operation_kind === "integrity_level_change") {
    warnings.push("icacls /setintegritylevel requires elevated PowerShell session");
  }
  if (input.operation_kind === "firewall_rule_change") {
    warnings.push("New-NetFirewallRule requires Administrator privileges");
  }
  if (input.operation_kind === "hyper_v_check") {
    warnings.push("Hyper-V status check may require elevated privileges for full details");
  }

  let readinessAfter: ReadinessStatus = "supported_but_blocked_by_missing_admin";
  if (!wouldRequireElevation) {
    readinessAfter = "supported_and_ready";
  }
  if (!contract) {
    readinessAfter = "not_supported";
  }

  const result: ElevationDryRunResult = {
    dry_run_id: createEntityId("dryrun"),
    operation_kind: input.operation_kind,
    would_succeed: wouldSucceed,
    would_require_elevation: wouldRequireElevation,
    current_elevation_status: "not_elevated",
    simulated_command: input.simulated_command ?? contract?.expected_command ?? "unknown",
    simulated_output: wouldSucceed ? "[dry-run] Command would execute successfully" : "[dry-run] Command would fail due to insufficient privileges",
    simulated_exit_code: wouldSucceed ? 0 : 1,
    warnings,
    prerequisites_met: missingPrerequisites.length === 0,
    missing_prerequisites: missingPrerequisites,
    readiness_after: readinessAfter,
    created_at: nowIso()
  };

  store.elevationDryRunResults.set(result.dry_run_id, result);

  recordAudit("privileged_execution.dry_run_executed", {
    dry_run_id: result.dry_run_id,
    operation_kind: input.operation_kind,
    would_succeed: wouldSucceed,
    would_require_elevation: wouldRequireElevation,
    readiness_after: readinessAfter
  });

  return result;
}

export function listElevationDryRunResults(filter?: {
  operation_kind?: PrivilegedOperationKind;
}): ElevationDryRunResult[] {
  let results = [...store.elevationDryRunResults.values()] as ElevationDryRunResult[];
  if (filter?.operation_kind) results = results.filter(r => r.operation_kind === filter.operation_kind);
  return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getPrivilegedReadinessDiagnostics(): PrivilegedReadinessDiagnostics {
  const contracts = ([...store.privilegedOperationContracts.values()] as PrivilegedOperationContract[]);

  const contractStatuses = contracts.map(c => ({
    operation_kind: c.operation_kind,
    readiness_status: c.readiness_status,
    display_name: c.display_name
  }));

  const readyCount = contracts.filter(c => c.readiness_status === "supported_and_ready").length;
  const blockedCount = contracts.filter(c => c.readiness_status === "supported_but_blocked_by_missing_admin").length;
  const notSupportedCount = contracts.filter(c => c.readiness_status === "not_supported").length;
  const totalCount = contracts.length;

  const blockingItems = contracts
    .filter(c => c.readiness_status === "supported_but_blocked_by_missing_admin")
    .map((c: PrivilegedOperationContract) => {
      const registryEntry = ([...store.adminOperationRegistryEntries.values()] as AdminOperationRegistryEntry[])
        .find(e => e.operation_kind === c.operation_kind);
      return {
        operation_kind: c.operation_kind,
        reason: `Requires Administrator elevation: ${c.display_name}`,
        impact: registryEntry?.impact_if_unavailable ?? "degraded" as const
      };
    });

  const nextActions: string[] = [];
  if (blockedCount > 0) {
    nextActions.push(`Run this application as Administrator to unlock ${blockedCount} privileged operation(s)`);
  }
  if (blockingItems.some(b => b.impact === "blocking")) {
    nextActions.push("Address blocking-level operations first - they prevent core functionality");
  }
  if (notSupportedCount > 0) {
    nextActions.push(`${notSupportedCount} operation(s) are not supported on this platform`);
  }
  if (readyCount > 0) {
    nextActions.push(`${readyCount} operation(s) are ready and can proceed without elevation`);
  }

  const diagnostics: PrivilegedReadinessDiagnostics = {
    diagnostics_id: createEntityId("privdiag"),
    platform: process.platform,
    is_elevated: false,
    elevation_status: "not_elevated",
    contracts: contractStatuses,
    summary: {
      total_operations: totalCount,
      ready_count: readyCount,
      blocked_by_admin_count: blockedCount,
      not_supported_count: notSupportedCount,
      readiness_percentage: totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0
    },
    blocking_items: blockingItems,
    next_actions: nextActions,
    created_at: nowIso()
  };

  return diagnostics;
}

export function generatePrivilegedRunRunbook(input: {
  title: string;
  operation_kinds: PrivilegedOperationKind[];
  estimated_duration_minutes?: number;
}): PrivilegedRunRunbook {
  const contracts = ([...store.privilegedOperationContracts.values()] as PrivilegedOperationContract[])
    .filter(c => input.operation_kinds.includes(c.operation_kind));

  const steps = contracts.map((contract, index) => ({
    step_number: index + 1,
    description: contract.description,
    command: contract.expected_command,
    expected_outcome: contract.requires_admin
      ? "Command executes with elevated privileges"
      : "Command executes successfully",
    verification: contract.verification_command,
    rollback_step: contract.rollback_command ? index + 1 : undefined,
    requires_elevation: contract.requires_admin,
    risk_notes: contract.risk_level === "critical" ? "Critical risk: ensure rollback plan is ready" : undefined
  }));

  const rollbackSteps = contracts
    .filter(c => c.rollback_command || c.rollback_notes)
    .map(c => c.rollback_notes ?? `Rollback: ${c.display_name}`)
    .join("; ");

  const runbook: PrivilegedRunRunbook = {
    runbook_id: createEntityId("runbook"),
    title: input.title,
    operation_kinds: input.operation_kinds,
    steps,
    total_elevation_steps: steps.filter(s => s.requires_elevation).length,
    estimated_duration_minutes: input.estimated_duration_minutes,
    prerequisites: [
      "Administrator PowerShell session",
      "Backup of affected system areas",
      "Rollback plan reviewed and approved",
      ...contracts.flatMap(c => c.prerequisites)
    ],
    rollback_plan: rollbackSteps || "No rollback commands defined - manual intervention required",
    created_at: nowIso()
  };

  store.privilegedRunRunbooks.set(runbook.runbook_id, runbook);

  recordAudit("privileged_execution.runbook_generated", {
    runbook_id: runbook.runbook_id,
    title: input.title,
    operation_kinds: input.operation_kinds,
    total_elevation_steps: runbook.total_elevation_steps
  });

  return runbook;
}

export function listPrivilegedRunRunbooks(): PrivilegedRunRunbook[] {
  return ([...store.privilegedRunRunbooks.values()] as PrivilegedRunRunbook[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function initializeDefaultPrivilegedOperationContracts(): PrivilegedOperationContract[] {
  const existing = [...store.privilegedOperationContracts.values()] as PrivilegedOperationContract[];
  if (existing.length > 0) return existing;

  const defaults: Array<Parameters<typeof registerPrivilegedOperationContract>[0]> = [
    {
      operation_kind: "integrity_level_change",
      display_name: "Windows Integrity Level Change",
      description: "Set process or file integrity level using icacls /setintegritylevel",
      requires_admin: true,
      expected_command: 'icacls "{target_path}" /setintegritylevel {level}',
      rollback_command: 'icacls "{target_path}" /setintegritylevel {previous_level}',
      rollback_notes: "Restore previous integrity level from audit record",
      risk_level: "high",
      affected_system_area: "filesystem_security",
      prerequisites: ["Administrator PowerShell session", "Target path identified"],
      verification_command: 'icacls "{target_path}" | findstr /i "Mandatory Label"'
    },
    {
      operation_kind: "firewall_rule_change",
      display_name: "Windows Firewall Rule Creation",
      description: "Create or modify Windows Firewall rules using New-NetFirewallRule",
      requires_admin: true,
      expected_command: 'New-NetFirewallRule -DisplayName "{name}" -Direction {direction} -Action {action} -Protocol {protocol}',
      rollback_command: 'Remove-NetFirewallRule -DisplayName "{name}"',
      rollback_notes: "Remove the created firewall rule by display name",
      risk_level: "high",
      affected_system_area: "network_security",
      prerequisites: ["Administrator PowerShell session", "Rule parameters defined"],
      verification_command: 'Get-NetFirewallRule -DisplayName "{name}"'
    },
    {
      operation_kind: "hyper_v_check",
      display_name: "Hyper-V Feature Check",
      description: "Check Hyper-V availability and status on Windows",
      requires_admin: true,
      expected_command: "Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V",
      rollback_notes: "Read-only check, no rollback needed",
      risk_level: "low",
      affected_system_area: "virtualization",
      prerequisites: ["Administrator PowerShell session"],
      verification_command: "Get-ComputerInfo | select HyperVisorPresent"
    },
    {
      operation_kind: "job_object_creation",
      display_name: "Windows Job Object Creation",
      description: "Create Windows Job Object with resource limits for process isolation",
      requires_admin: false,
      expected_command: "Add-Type -TypeDefinition '[DllImport(\"kernel32.dll\")]...' ; CreateJobObjectW(...)",
      rollback_command: "CloseHandle(jobObjectHandle)",
      rollback_notes: "Close the Job Object handle to release resources",
      risk_level: "medium",
      affected_system_area: "process_isolation",
      prerequisites: [".NET Framework available via PowerShell"],
      verification_command: "Verify job object handle is valid and limits are set"
    },
    {
      operation_kind: "process_token_adjustment",
      display_name: "Process Token Privilege Adjustment",
      description: "Adjust process token privileges for elevated operations",
      requires_admin: true,
      expected_command: "AdjustTokenPrivileges(tokenHandle, false, newPrivileges, ...)",
      rollback_notes: "Revert token privileges to original state",
      risk_level: "critical",
      affected_system_area: "process_security",
      prerequisites: ["Administrator PowerShell session", "Process handle obtained"]
    },
    {
      operation_kind: "service_installation",
      display_name: "Windows Service Installation",
      description: "Install or configure Windows services",
      requires_admin: true,
      expected_command: 'New-Service -Name "{name}" -BinaryPathName "{path}"',
      rollback_command: 'Remove-Service -Name "{name}"',
      rollback_notes: "Remove the installed service",
      risk_level: "high",
      affected_system_area: "system_services",
      prerequisites: ["Administrator PowerShell session", "Service binary path verified"]
    },
    {
      operation_kind: "registry_hklm_write",
      display_name: "HKEY_LOCAL_MACHINE Registry Write",
      description: "Write to HKEY_LOCAL_MACHINE registry hive",
      requires_admin: true,
      expected_command: 'Set-ItemProperty -Path "HKLM:\\{path}" -Name "{name}" -Value {value}',
      rollback_command: 'Remove-ItemProperty -Path "HKLM:\\{path}" -Name "{name}"',
      rollback_notes: "Remove or restore the registry value",
      risk_level: "high",
      affected_system_area: "system_registry",
      prerequisites: ["Administrator PowerShell session", "Registry path validated"]
    },
    {
      operation_kind: "admin_sandbox_backend",
      display_name: "Admin-Required Sandbox Backend Activation",
      description: "Activate sandbox backends that require Administrator privileges",
      requires_admin: true,
      expected_command: "Enable sandbox backend with admin enforcement",
      rollback_notes: "Deactivate sandbox backend and revert to rule-based enforcement",
      risk_level: "medium",
      affected_system_area: "sandbox_isolation",
      prerequisites: ["Administrator PowerShell session", "Backend configuration ready"]
    }
  ];

  const results: PrivilegedOperationContract[] = [];
  for (const def of defaults) {
    results.push(registerPrivilegedOperationContract(def));
  }

  addAdminOperationRegistryEntry({
    operation_kind: "integrity_level_change",
    reason: "Required for low-integrity sandbox process isolation on Windows",
    expected_command: 'icacls "{target}" /setintegritylevel Low',
    rollback_notes: "Restore to Medium integrity level",
    impact_if_unavailable: "degraded",
    alternative_approach: "Rule-based sandbox enforcement without OS integrity levels"
  });

  addAdminOperationRegistryEntry({
    operation_kind: "firewall_rule_change",
    reason: "Required for network egress enforcement via Windows Firewall",
    expected_command: 'New-NetFirewallRule -DisplayName "Apex-Deny" -Direction Outbound -Action Block',
    rollback_notes: "Remove firewall rule by display name",
    impact_if_unavailable: "degraded",
    alternative_approach: "Environment variable-based network restriction (less secure)"
  });

  addAdminOperationRegistryEntry({
    operation_kind: "hyper_v_check",
    reason: "Required to determine Hyper-V availability for VM-level sandbox isolation",
    expected_command: "Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V",
    rollback_notes: "Read-only check, no rollback needed",
    impact_if_unavailable: "optional",
    alternative_approach: "Assume Hyper-V is not available"
  });

  addAdminOperationRegistryEntry({
    operation_kind: "admin_sandbox_backend",
    reason: "Required for full OS-native sandbox enforcement with admin-level backends",
    expected_command: "Activate admin sandbox backend",
    rollback_notes: "Revert to rule-based sandbox enforcement",
    impact_if_unavailable: "degraded",
    alternative_approach: "Rule-based enforcement with Windows Job Object (non-admin)"
  });

  return results;
}
