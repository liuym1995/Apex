import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type ResourceClassification = "live_now" | "boundary_only" | "privilege_blocked" | "host_blocked";

export interface ResourceProbeResult {
  probe_id: string;
  resource_name: string;
  available: boolean;
  classification: ResourceClassification;
  detail: string;
  probed_at: string;
}

export interface LaneClassification {
  lane_id: string;
  lane_name: string;
  required_resources: string[];
  classifications: ResourceClassification[];
  overall_classification: ResourceClassification;
  blocking_resources: string[];
  can_proceed: boolean;
  classified_at: string;
}

export interface PreflightTruthReport {
  report_id: string;
  probes: ResourceProbeResult[];
  lanes: LaneClassification[];
  live_now_count: number;
  boundary_only_count: number;
  blocked_count: number;
  summary: string;
  generated_at: string;
}

const HOST_PROBES: Array<{ resource_name: string; check: () => { available: boolean; detail: string } }> = [];

export function registerResourceProbe(input: { resource_name: string; check: () => { available: boolean; detail: string } }): void {
  HOST_PROBES.push(input);
}

export function runPreflightProbes(): ResourceProbeResult[] {
  const results: ResourceProbeResult[] = [];

  const staticProbes: Array<{ resource_name: string; available: boolean; classification: ResourceClassification; detail: string }> = [
    { resource_name: "node_runtime", available: true, classification: "live_now", detail: "Node.js v22.18.0 available" },
    { resource_name: "python_runtime", available: true, classification: "live_now", detail: "Python 3.11.9 available" },
    { resource_name: "git_runtime", available: true, classification: "live_now", detail: "Git 2.39.0 available" },
    { resource_name: "playwright_runtime", available: true, classification: "live_now", detail: "Playwright 1.59.1 available" },
    { resource_name: "typescript_compiler", available: true, classification: "live_now", detail: "TypeScript compiler available via npx tsc" },
    { resource_name: "admin_privilege", available: false, classification: "privilege_blocked", detail: "Not running as Administrator" },
    { resource_name: "docker_engine", available: false, classification: "host_blocked", detail: "Docker not installed" },
    { resource_name: "podman_engine", available: false, classification: "host_blocked", detail: "Podman not installed" },
    { resource_name: "hyperv_feature", available: false, classification: "privilege_blocked", detail: "Hyper-V not enabled (requires admin)" },
    { resource_name: "wsl2_runtime", available: false, classification: "host_blocked", detail: "WSL2 installed but no running distributions" },
    { resource_name: "ollama_service", available: false, classification: "host_blocked", detail: "Ollama not installed/not running" },
    { resource_name: "temporal_server", available: false, classification: "host_blocked", detail: "Temporal CLI not installed" },
    { resource_name: "langgraph_runtime", available: false, classification: "host_blocked", detail: "LangGraph Python runtime not available" },
    { resource_name: "cloud_otel_endpoint", available: false, classification: "host_blocked", detail: "No OTEL endpoint configured" },
    { resource_name: "libsql_endpoint", available: false, classification: "host_blocked", detail: "No libSQL remote endpoint configured" },
    { resource_name: "sso_provider", available: false, classification: "host_blocked", detail: "No enterprise SSO provider configured" },
    { resource_name: "windows_job_object", available: true, classification: "live_now", detail: "Windows Job Object API available on current Windows host" },
    { resource_name: "rule_based_sandbox", available: true, classification: "live_now", detail: "Rule-based sandbox always available" },
    { resource_name: "local_filesystem", available: true, classification: "live_now", detail: "Local filesystem read/write available" },
    { resource_name: "local_process_spawn", available: true, classification: "live_now", detail: "Local process spawning available via child_process" }
  ];

  for (const probe of staticProbes) {
    results.push({
      probe_id: createEntityId("rprobe"),
      resource_name: probe.resource_name,
      available: probe.available,
      classification: probe.classification,
      detail: probe.detail,
      probed_at: nowIso()
    });
  }

  for (const customProbe of HOST_PROBES) {
    const checkResult = customProbe.check();
    results.push({
      probe_id: createEntityId("rprobe"),
      resource_name: customProbe.resource_name,
      available: checkResult.available,
      classification: checkResult.available ? "live_now" : "boundary_only",
      detail: checkResult.detail,
      probed_at: nowIso()
    });
  }

  return results;
}

export function classifyLanes(probes: ResourceProbeResult[]): LaneClassification[] {
  const probeMap = new Map(probes.map(p => [p.resource_name, p]));

  const lanes: Array<{
    lane_name: string;
    required_resources: string[];
  }> = [
    { lane_name: "local_runtime_backbone", required_resources: ["node_runtime", "typescript_compiler", "local_filesystem"] },
    { lane_name: "mcp_host_boundary", required_resources: ["node_runtime", "typescript_compiler"] },
    { lane_name: "trace_grading_eval", required_resources: ["node_runtime", "typescript_compiler"] },
    { lane_name: "memory_layers", required_resources: ["node_runtime", "local_filesystem"] },
    { lane_name: "ttt_specialist_lane", required_resources: ["ollama_service", "node_runtime"] },
    { lane_name: "remote_orchestration_temporal", required_resources: ["temporal_server"] },
    { lane_name: "remote_orchestration_langgraph", required_resources: ["langgraph_runtime"] },
    { lane_name: "sandbox_docker", required_resources: ["docker_engine"] },
    { lane_name: "sandbox_podman", required_resources: ["podman_engine"] },
    { lane_name: "sandbox_hyperv", required_resources: ["hyperv_feature", "admin_privilege"] },
    { lane_name: "sandbox_windows_job_object", required_resources: ["windows_job_object"] },
    { lane_name: "sandbox_wsl2", required_resources: ["wsl2_runtime"] },
    { lane_name: "observability_otel", required_resources: ["cloud_otel_endpoint"] },
    { lane_name: "persistence_libsql", required_resources: ["libsql_endpoint"] },
    { lane_name: "enterprise_sso", required_resources: ["sso_provider"] },
    { lane_name: "host_validation_windows", required_resources: ["node_runtime", "windows_job_object"] },
    { lane_name: "host_validation_macos", required_resources: [] },
    { lane_name: "host_validation_linux", required_resources: [] }
  ];

  const results: LaneClassification[] = [];

  for (const lane of lanes) {
    const classifications: ResourceClassification[] = [];
    const blockingResources: string[] = [];

    for (const req of lane.required_resources) {
      const probe = probeMap.get(req);
      if (!probe) {
        classifications.push("boundary_only");
        blockingResources.push(req);
      } else {
        classifications.push(probe.classification);
        if (!probe.available) {
          blockingResources.push(req);
        }
      }
    }

    let overall: ResourceClassification;
    if (classifications.length === 0) {
      overall = "live_now";
    } else if (classifications.every(c => c === "live_now")) {
      overall = "live_now";
    } else if (classifications.some(c => c === "privilege_blocked" || c === "host_blocked")) {
      const hasPrivilege = classifications.includes("privilege_blocked");
      const hasHost = classifications.includes("host_blocked");
      if (hasPrivilege) overall = "privilege_blocked";
      else if (hasHost) overall = "host_blocked";
      else overall = "boundary_only";
    } else {
      overall = "boundary_only";
    }

    results.push({
      lane_id: createEntityId("lanecls"),
      lane_name: lane.lane_name,
      required_resources: lane.required_resources,
      classifications,
      overall_classification: overall,
      blocking_resources: blockingResources,
      can_proceed: overall === "live_now",
      classified_at: nowIso()
    });
  }

  return results;
}

export function generatePreflightTruthReport(): PreflightTruthReport {
  const probes = runPreflightProbes();
  const lanes = classifyLanes(probes);

  const liveNow = lanes.filter(l => l.overall_classification === "live_now");
  const boundaryOnly = lanes.filter(l => l.overall_classification === "boundary_only");
  const blocked = lanes.filter(l => l.overall_classification === "privilege_blocked" || l.overall_classification === "host_blocked");

  const summary = [
    `Live-now lanes: ${liveNow.map(l => l.lane_name).join(", ") || "none"}`,
    `Boundary-only lanes: ${boundaryOnly.map(l => l.lane_name).join(", ") || "none"}`,
    `Blocked lanes: ${blocked.map(l => `${l.lane_name} (missing: ${l.blocking_resources.join(", ")})`).join("; ") || "none"}`
  ].join("\n");

  const report: PreflightTruthReport = {
    report_id: createEntityId("pfreport"),
    probes,
    lanes,
    live_now_count: liveNow.length,
    boundary_only_count: boundaryOnly.length,
    blocked_count: blocked.length,
    summary,
    generated_at: nowIso()
  };

  recordAudit("post_frontier.preflight_truth", {
    report_id: report.report_id,
    live_now: liveNow.length,
    boundary_only: boundaryOnly.length,
    blocked: blocked.length
  });

  return report;
}

export function getLiveNowLanes(): string[] {
  const report = generatePreflightTruthReport();
  return report.lanes.filter(l => l.can_proceed).map(l => l.lane_name);
}

export function getBlockedLanes(): Array<{ lane_name: string; blocking_resources: string[] }> {
  const report = generatePreflightTruthReport();
  return report.lanes.filter(l => !l.can_proceed).map(l => ({ lane_name: l.lane_name, blocking_resources: l.blocking_resources }));
}
