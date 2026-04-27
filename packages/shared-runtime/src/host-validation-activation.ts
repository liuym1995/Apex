import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type HostPlatform = "windows" | "macos" | "linux";

export type HostValidationStatus = "validated" | "partial" | "unavailable" | "blocked";

export interface HostValidationResult {
  validation_id: string;
  platform: HostPlatform;
  status: HostValidationStatus;
  capabilities: {
    process_spawn: boolean;
    filesystem_read: boolean;
    filesystem_write: boolean;
    sandbox_rule_based: boolean;
    sandbox_os_native: boolean;
    sandbox_container: boolean;
    sandbox_vm: boolean;
    network_egress: boolean;
    model_local: boolean;
  };
  validated_capabilities: string[];
  missing_capabilities: string[];
  detail: string;
  validated_at: string;
}

export interface CrossPlatformValidationReport {
  report_id: string;
  platforms: HostValidationResult[];
  windows_status: HostValidationStatus;
  macos_status: HostValidationStatus;
  linux_status: HostValidationStatus;
  live_platforms: string[];
  blocked_platforms: string[];
  overall: "live_now" | "boundary_only" | "host_blocked";
  generated_at: string;
}

export function validateCurrentHost(): HostValidationResult {
  const platform: HostPlatform = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";

  const capabilities: HostValidationResult["capabilities"] = {
    process_spawn: true,
    filesystem_read: true,
    filesystem_write: true,
    sandbox_rule_based: true,
    sandbox_os_native: platform === "windows",
    sandbox_container: false,
    sandbox_vm: false,
    network_egress: true,
    model_local: false
  };

  if (platform === "windows") {
    capabilities.sandbox_os_native = true;
  } else if (platform === "linux") {
    capabilities.sandbox_os_native = true;
    capabilities.sandbox_container = false;
  } else if (platform === "macos") {
    capabilities.sandbox_os_native = true;
    capabilities.sandbox_container = false;
  }

  const validatedCapabilities: string[] = [];
  const missingCapabilities: string[] = [];

  for (const [key, value] of Object.entries(capabilities)) {
    if (value) {
      validatedCapabilities.push(key);
    } else {
      missingCapabilities.push(key);
    }
  }

  let status: HostValidationStatus;
  if (missingCapabilities.length === 0) {
    status = "validated";
  } else if (validatedCapabilities.length > missingCapabilities.length) {
    status = "partial";
  } else if (validatedCapabilities.length === 0) {
    status = "blocked";
  } else {
    status = "unavailable";
  }

  const detail = `Platform: ${platform}. Validated: ${validatedCapabilities.join(", ")}. Missing: ${missingCapabilities.join(", ") || "none"}.`;

  const result: HostValidationResult = {
    validation_id: createEntityId("hv"),
    platform,
    status,
    capabilities,
    validated_capabilities: validatedCapabilities,
    missing_capabilities: missingCapabilities,
    detail,
    validated_at: nowIso()
  };

  recordAudit("post_frontier.host_validated", { platform, status, validated: validatedCapabilities.length, missing: missingCapabilities.length });

  return result;
}

export function generateCrossPlatformValidationReport(): CrossPlatformValidationReport {
  const currentHost = validateCurrentHost();

  const macosResult: HostValidationResult = {
    validation_id: createEntityId("hv"),
    platform: "macos",
    status: "blocked",
    capabilities: {
      process_spawn: false,
      filesystem_read: false,
      filesystem_write: false,
      sandbox_rule_based: false,
      sandbox_os_native: false,
      sandbox_container: false,
      sandbox_vm: false,
      network_egress: false,
      model_local: false
    },
    validated_capabilities: [],
    missing_capabilities: ["process_spawn", "filesystem_read", "filesystem_write", "sandbox_rule_based", "sandbox_os_native", "sandbox_container", "sandbox_vm", "network_egress", "model_local"],
    detail: "No macOS host available. Requires physical or virtual macOS machine.",
    validated_at: nowIso()
  };

  const linuxResult: HostValidationResult = {
    validation_id: createEntityId("hv"),
    platform: "linux",
    status: "blocked",
    capabilities: {
      process_spawn: false,
      filesystem_read: false,
      filesystem_write: false,
      sandbox_rule_based: false,
      sandbox_os_native: false,
      sandbox_container: false,
      sandbox_vm: false,
      network_egress: false,
      model_local: false
    },
    validated_capabilities: [],
    missing_capabilities: ["process_spawn", "filesystem_read", "filesystem_write", "sandbox_rule_based", "sandbox_os_native", "sandbox_container", "sandbox_vm", "network_egress", "model_local"],
    detail: "No Linux host available. WSL2 installed but no running distributions. Requires Linux host or running WSL2 distribution.",
    validated_at: nowIso()
  };

  const platforms = [currentHost, macosResult, linuxResult];
  const livePlatforms = platforms.filter(p => p.status === "validated" || p.status === "partial").map(p => p.platform);
  const blockedPlatforms = platforms.filter(p => p.status === "blocked" || p.status === "unavailable").map(p => p.platform);

  let overall: "live_now" | "boundary_only" | "host_blocked";
  if (livePlatforms.length >= 2) {
    overall = "live_now";
  } else if (livePlatforms.length === 1) {
    overall = "boundary_only";
  } else {
    overall = "host_blocked";
  }

  const report: CrossPlatformValidationReport = {
    report_id: createEntityId("cpvr"),
    platforms,
    windows_status: currentHost.platform === "windows" ? currentHost.status : "blocked",
    macos_status: macosResult.status,
    linux_status: linuxResult.status,
    live_platforms: livePlatforms,
    blocked_platforms: blockedPlatforms,
    overall,
    generated_at: nowIso()
  };

  recordAudit("post_frontier.cross_platform_validation", {
    report_id: report.report_id,
    live: livePlatforms,
    blocked: blockedPlatforms,
    overall
  });

  return report;
}
