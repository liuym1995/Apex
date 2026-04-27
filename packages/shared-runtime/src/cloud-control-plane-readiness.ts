import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  CloudSyncEnvelopeSchema,
  CloudControlPlaneConfigSchema,
  type CloudSyncEnvelope,
  type CloudControlPlaneConfig
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export function createCloudControlPlaneConfig(input?: Partial<CloudControlPlaneConfig>): CloudControlPlaneConfig {
  const config = CloudControlPlaneConfigSchema.parse({
    config_id: createEntityId("ccpcfg"),
    mode: input?.mode ?? "local_only",
    cloud_endpoint: input?.cloud_endpoint,
    sync_interval_ms: input?.sync_interval_ms ?? 30000,
    auth_provider: input?.auth_provider ?? "none",
    tenant_id: input?.tenant_id,
    device_id: input?.device_id,
    retry_policy: input?.retry_policy ?? {
      max_retries: 3,
      backoff_base_ms: 1000,
      max_backoff_ms: 60000
    },
    conflict_resolution: input?.conflict_resolution ?? "local_wins",
    created_at: nowIso()
  });

  store.cloudControlPlaneConfigs.set(config.config_id, config);

  recordAudit("cloud_control_plane.config_created", {
    config_id: config.config_id,
    mode: config.mode,
    auth_provider: config.auth_provider
  });

  return config;
}

export function getCloudControlPlaneConfig(): CloudControlPlaneConfig | undefined {
  const configs = [...store.cloudControlPlaneConfigs.values()];
  return configs[configs.length - 1];
}

export function prepareSyncEnvelope(input: {
  sync_kind: CloudSyncEnvelope["sync_kind"];
  payload?: Record<string, unknown>;
  tenant_id?: string;
  device_id?: string;
}): CloudSyncEnvelope {
  const config = getCloudControlPlaneConfig();
  const payloadStr = input.payload ? JSON.stringify(input.payload) : "";

  const envelope = CloudSyncEnvelopeSchema.parse({
    envelope_id: createEntityId("syncenv"),
    source_tenant_id: input.tenant_id ?? config?.tenant_id ?? "local",
    source_device_id: input.device_id ?? config?.device_id ?? "local-desktop",
    target_cloud_endpoint: config?.cloud_endpoint,
    sync_kind: input.sync_kind,
    payload_hash: payloadStr ? simpleHash(payloadStr) : undefined,
    payload_size_bytes: payloadStr.length,
    status: "prepared",
    created_at: nowIso()
  });

  store.cloudSyncEnvelopes.set(envelope.envelope_id, envelope);

  recordAudit("cloud_control_plane.sync_envelope_prepared", {
    envelope_id: envelope.envelope_id,
    sync_kind: input.sync_kind,
    payload_size_bytes: envelope.payload_size_bytes
  });

  return envelope;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function simulateSyncSend(envelopeId: string): CloudSyncEnvelope {
  const envelope = store.cloudSyncEnvelopes.get(envelopeId);
  if (!envelope) throw new Error(`SyncEnvelope not found: ${envelopeId}`);

  const config = getCloudControlPlaneConfig();
  if (config?.mode === "local_only") {
    envelope.status = "failed";
    store.cloudSyncEnvelopes.set(envelopeId, envelope);

    recordAudit("cloud_control_plane.sync_send_failed", {
      envelope_id: envelopeId,
      reason: "local_only_mode",
      sync_kind: envelope.sync_kind
    });

    return envelope;
  }

  envelope.status = "sent";
  envelope.sent_at = nowIso();
  store.cloudSyncEnvelopes.set(envelopeId, envelope);

  recordAudit("cloud_control_plane.sync_send_simulated", {
    envelope_id: envelopeId,
    sync_kind: envelope.sync_kind,
    target: envelope.target_cloud_endpoint ?? "no_endpoint_configured"
  });

  return envelope;
}

export function getCloudReadinessDiagnostics(): {
  config_exists: boolean;
  mode: string;
  auth_provider: string;
  pending_envelopes: number;
  failed_envelopes: number;
  cloud_endpoint_configured: boolean;
  tenant_configured: boolean;
  readiness_level: "not_configured" | "local_only" | "configured_not_connected" | "ready_for_connection";
  blocking_items: string[];
} {
  const config = getCloudControlPlaneConfig();
  const envelopes = [...store.cloudSyncEnvelopes.values()];

  const blockingItems: string[] = [];
  let readinessLevel: "not_configured" | "local_only" | "configured_not_connected" | "ready_for_connection" = "not_configured";

  if (!config) {
    blockingItems.push("No cloud control plane config created");
    readinessLevel = "not_configured";
  } else if (config.mode === "local_only") {
    readinessLevel = "local_only";
    blockingItems.push("Mode is local_only - cloud sync disabled");
  } else if (!config.cloud_endpoint) {
    readinessLevel = "configured_not_connected";
    blockingItems.push("No cloud endpoint configured");
  } else {
    readinessLevel = "ready_for_connection";
  }

  if (config && config.auth_provider !== "none" && !config.tenant_id) {
    blockingItems.push("Auth provider configured but no tenant_id set");
  }

  return {
    config_exists: !!config,
    mode: config?.mode ?? "local_only",
    auth_provider: config?.auth_provider ?? "none",
    pending_envelopes: envelopes.filter(e => e.status === "prepared").length,
    failed_envelopes: envelopes.filter(e => e.status === "failed").length,
    cloud_endpoint_configured: !!config?.cloud_endpoint,
    tenant_configured: !!config?.tenant_id,
    readiness_level: readinessLevel,
    blocking_items: blockingItems
  };
}

export function listSyncEnvelopes(filter?: {
  sync_kind?: CloudSyncEnvelope["sync_kind"];
  status?: CloudSyncEnvelope["status"];
}): CloudSyncEnvelope[] {
  let envelopes = [...store.cloudSyncEnvelopes.values()];
  if (filter?.sync_kind) envelopes = envelopes.filter(e => e.sync_kind === filter.sync_kind);
  if (filter?.status) envelopes = envelopes.filter(e => e.status === filter.status);
  return envelopes.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getOrgAuditAggregationContract(): {
  contract_shape: Record<string, unknown>;
  supported_sync_kinds: string[];
  local_audit_count: number;
  pending_upload_count: number;
} {
  const localAuditCount = store.audits.toArray().length;
  const pendingUploads = [...store.cloudSyncEnvelopes.values()]
    .filter(e => e.sync_kind === "audit_upload" && e.status === "prepared").length;

  return {
    contract_shape: {
      audit_upload: {
        fields: ["audit_id", "action", "payload", "task_id", "created_at"],
        batch_size: 100,
        compression: "gzip",
        format: "jsonl"
      },
      policy_download: {
        fields: ["policy_id", "scope", "rules", "version", "created_at"],
        format: "json",
        merge_strategy: "org_overrides_local"
      }
    },
    supported_sync_kinds: ["audit_upload", "policy_download", "session_sync", "memory_sync", "task_state_sync", "governance_sync"],
    local_audit_count: localAuditCount,
    pending_upload_count: pendingUploads
  };
}

export function getMultiDeviceSessionSyncContract(): {
  contract_shape: Record<string, unknown>;
  conflict_strategies: string[];
  local_session_count: number;
} {
  const localSessionCount = [...store.workerSessions.values()].length;

  return {
    contract_shape: {
      session_sync: {
        fields: ["session_id", "worker_id", "task_id", "status", "last_heartbeat_at", "step_count"],
        conflict_resolution: ["local_wins", "cloud_wins", "newest_wins", "manual"],
        merge_strategy: "last_heartbeat_wins"
      }
    },
    conflict_strategies: ["local_wins", "cloud_wins", "newest_wins", "manual"],
    local_session_count: localSessionCount
  };
}

export function getCloudHealthEndpointContracts(): Array<{
  endpoint: string;
  method: string;
  description: string;
  contract_available: boolean;
}> {
  return [
    { endpoint: "/api/cloud/health", method: "GET", description: "Cloud control plane health check", contract_available: true },
    { endpoint: "/api/cloud/ready", method: "GET", description: "Readiness probe for cloud attachment", contract_available: true },
    { endpoint: "/api/cloud/sync", method: "POST", description: "Sync envelope upload endpoint", contract_available: true },
    { endpoint: "/api/cloud/sync/:envelopeId/ack", method: "POST", description: "Acknowledge sync envelope", contract_available: true },
    { endpoint: "/api/cloud/policy", method: "GET", description: "Download org policy", contract_available: true },
    { endpoint: "/api/cloud/audit", method: "POST", description: "Upload audit events", contract_available: true },
    { endpoint: "/api/cloud/session", method: "POST", description: "Sync session state", contract_available: true }
  ];
}

export function getBootstrapManifest(): {
  manifest_version: string;
  required_env_vars: string[];
  optional_env_vars: string[];
  required_services: string[];
  optional_services: string[];
  readiness_checks: string[];
  deployment_steps: string[];
} {
  return {
    manifest_version: "1.0.0",
    required_env_vars: [
      "APEX_CLOUD_MODE",
      "APEX_CLOUD_ENDPOINT"
    ],
    optional_env_vars: [
      "APEX_CLOUD_AUTH_PROVIDER",
      "APEX_CLOUD_TENANT_ID",
      "APEX_CLOUD_DEVICE_ID",
      "APEX_CLOUD_SYNC_INTERVAL_MS",
      "APEX_CLOUD_CONFLICT_RESOLUTION"
    ],
    required_services: [
      "cloud-control-plane-api"
    ],
    optional_services: [
      "cloud-audit-aggregation",
      "cloud-policy-distribution",
      "cloud-session-sync"
    ],
    readiness_checks: [
      "cloud_endpoint_reachable",
      "auth_provider_configured",
      "tenant_id_set",
      "first_sync_envelope_prepared"
    ],
    deployment_steps: [
      "1. Set APEX_CLOUD_MODE=cloud_augmented",
      "2. Set APEX_CLOUD_ENDPOINT to cloud API URL",
      "3. Configure auth provider (api_key, oauth2, or saml)",
      "4. Set APEX_CLOUD_TENANT_ID",
      "5. Verify cloud endpoint health check returns 200",
      "6. Prepare first sync envelope",
      "7. Monitor sync envelope status"
    ]
  };
}
