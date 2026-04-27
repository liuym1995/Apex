import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  type ClawHubRegistryConfig,
  type ClawHubSearchResult,
  type ClawHubInstallRecord,
  type ClawHubPublishRecord,
  type ClawHubSyncRecord,
  type RemoteSkillTrustVerdict
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export function createClawHubRegistryConfig(input: {
  registry_endpoint?: string;
  registry_name?: string;
  auth_method?: "none" | "api_key" | "oauth2";
  api_key_ref?: string;
  oauth2_client_id?: string;
  sync_interval_seconds?: number;
  auto_sync_enabled?: boolean;
  trust_policy?: ClawHubRegistryConfig["trust_policy"];
}): ClawHubRegistryConfig {
  const config: ClawHubRegistryConfig = {
    config_id: createEntityId("clhcfg"),
    registry_endpoint: input.registry_endpoint,
    registry_name: input.registry_name ?? "default",
    auth_method: input.auth_method ?? "none",
    api_key_ref: input.api_key_ref,
    oauth2_client_id: input.oauth2_client_id,
    sync_interval_seconds: input.sync_interval_seconds ?? 3600,
    auto_sync_enabled: input.auto_sync_enabled ?? false,
    trust_policy: input.trust_policy ?? {
      require_verified_publisher: true,
      minimum_downloads: 0,
      allowed_tags: [],
      blocked_tags: []
    },
    created_at: nowIso()
  };
  store.clawHubRegistryConfigs.set(config.config_id, config);
  recordAudit("clawhub.registry_config_created", { config_id: config.config_id, registry_name: config.registry_name });
  return config;
}

export function getClawHubRegistryConfig(configId: string): ClawHubRegistryConfig | undefined {
  return store.clawHubRegistryConfigs.get(configId);
}

export function listClawHubRegistryConfigs(): ClawHubRegistryConfig[] {
  return [...store.clawHubRegistryConfigs.values()];
}

export function searchClawHubSkills(input: {
  query: string;
  registry_name?: string;
  tags?: string[];
}): ClawHubSearchResult[] {
  const registryName = input.registry_name ?? "default";
  const config = [...store.clawHubRegistryConfigs.values()].find(c => c.registry_name === registryName);

  if (!config?.registry_endpoint) {
    recordAudit("clawhub.search_blocked", { query: input.query, reason: "no_registry_endpoint" });
    return [];
  }

  const results: ClawHubSearchResult[] = [];
  recordAudit("clawhub.search_executed", { query: input.query, registry_name: registryName, result_count: results.length });
  return results;
}

export function inspectClawHubSkill(input: {
  remote_skill_id: string;
  registry_name?: string;
}): ClawHubSearchResult | { error: string } {
  const registryName = input.registry_name ?? "default";
  const config = [...store.clawHubRegistryConfigs.values()].find(c => c.registry_name === registryName);

  if (!config?.registry_endpoint) {
    return { error: "No registry endpoint configured" };
  }

  const existing = [...store.clawHubSearchResults.values()].find(
    r => r.skill_id === input.remote_skill_id && r.registry_name === registryName
  );
  if (existing) return existing;

  return { error: "Skill not found in local cache; remote inspection not available without live endpoint" };
}

export function installClawHubSkill(input: {
  remote_skill_id: string;
  remote_skill_name: string;
  remote_version: string;
  registry_name?: string;
}): ClawHubInstallRecord {
  const registryName = input.registry_name ?? "default";
  const install: ClawHubInstallRecord = {
    install_id: createEntityId("clhinst"),
    registry_name: registryName,
    remote_skill_id: input.remote_skill_id,
    remote_skill_name: input.remote_skill_name,
    remote_version: input.remote_version,
    install_status: "pending_review",
    governance_review_required: true,
    created_at: nowIso()
  };
  store.clawHubInstallRecords.set(install.install_id, install);
  recordAudit("clawhub.install_initiated", {
    install_id: install.install_id,
    remote_skill_id: input.remote_skill_id,
    status: install.install_status,
    governance_required: install.governance_review_required
  });
  return install;
}

export function listClawHubInstallRecords(): ClawHubInstallRecord[] {
  return [...store.clawHubInstallRecords.values()];
}

export function publishToClawHub(input: {
  local_skill_id: string;
  local_skill_name: string;
  local_version: number;
  registry_name?: string;
}): ClawHubPublishRecord {
  const registryName = input.registry_name ?? "default";
  const publish: ClawHubPublishRecord = {
    publish_id: createEntityId("clhpub"),
    registry_name: registryName,
    local_skill_id: input.local_skill_id,
    local_skill_name: input.local_skill_name,
    local_version: input.local_version,
    publish_status: "pending_approval",
    governance_approved: false,
    created_at: nowIso()
  };
  store.clawHubPublishRecords.set(publish.publish_id, publish);
  recordAudit("clawhub.publish_initiated", {
    publish_id: publish.publish_id,
    local_skill_id: input.local_skill_id,
    status: publish.publish_status,
    governance_approved: publish.governance_approved
  });
  return publish;
}

export function listClawHubPublishRecords(): ClawHubPublishRecord[] {
  return [...store.clawHubPublishRecords.values()];
}

export function syncClawHubRegistry(input: {
  registry_name?: string;
  sync_kind?: "full" | "incremental" | "metadata_only";
}): ClawHubSyncRecord {
  const registryName = input.registry_name ?? "default";
  const config = [...store.clawHubRegistryConfigs.values()].find(c => c.registry_name === registryName);

  const sync: ClawHubSyncRecord = {
    sync_id: createEntityId("clhsync"),
    registry_name: registryName,
    sync_kind: input.sync_kind ?? "incremental",
    sync_status: config?.registry_endpoint ? "in_progress" : "failed",
    skills_synced: 0,
    skills_updated: 0,
    skills_added: 0,
    errors: config?.registry_endpoint ? [] : ["No registry endpoint configured"],
    started_at: nowIso()
  };

  if (!config?.registry_endpoint) {
    sync.completed_at = nowIso();
  }

  store.clawHubSyncRecords.set(sync.sync_id, sync);
  recordAudit("clawhub.sync_initiated", {
    sync_id: sync.sync_id,
    registry_name: registryName,
    sync_kind: sync.sync_kind,
    status: sync.sync_status
  });
  return sync;
}

export function listClawHubSyncRecords(): ClawHubSyncRecord[] {
  return [...store.clawHubSyncRecords.values()];
}

export function assessRemoteSkillTrust(input: {
  remote_skill_id: string;
  registry_name?: string;
  verification_signals?: string[];
  publisher_verified?: boolean;
  compatibility_check?: "pending" | "compatible" | "incompatible" | "unknown";
}): RemoteSkillTrustVerdict {
  const registryName = input.registry_name ?? "default";
  const config = [...store.clawHubRegistryConfigs.values()].find(c => c.registry_name === registryName);

  const publisherVerified = input.publisher_verified ?? false;
  const compatibilityCheck = input.compatibility_check ?? "unknown";
  const policyCompliant = publisherVerified
    && compatibilityCheck === "compatible"
    && (config?.trust_policy.require_verified_publisher ? publisherVerified : true);

  let trustLevel: RemoteSkillTrustVerdict["trust_level"] = "untrusted";
  if (policyCompliant && publisherVerified && compatibilityCheck === "compatible") {
    trustLevel = "trusted";
  } else if (publisherVerified || compatibilityCheck === "compatible") {
    trustLevel = "conditional";
  }

  const verdict: RemoteSkillTrustVerdict = {
    verdict_id: createEntityId("rmtvrd"),
    remote_skill_id: input.remote_skill_id,
    registry_name: registryName,
    trust_level: trustLevel,
    verification_signals: input.verification_signals ?? [],
    compatibility_check: compatibilityCheck,
    policy_compliant: policyCompliant,
    publisher_verified: publisherVerified,
    risk_assessment: trustLevel === "untrusted"
      ? "Skill is untrusted; governance review required before activation"
      : trustLevel === "conditional"
        ? "Skill has conditional trust; limited activation with governance oversight"
        : "Skill is trusted; governance review still required for first activation",
    governance_review_required: true,
    created_at: nowIso()
  };
  store.remoteSkillTrustVerdicts.set(verdict.verdict_id, verdict);
  recordAudit("clawhub.trust_verdict_issued", {
    verdict_id: verdict.verdict_id,
    remote_skill_id: input.remote_skill_id,
    trust_level: verdict.trust_level,
    policy_compliant: verdict.policy_compliant,
    governance_required: verdict.governance_review_required
  });
  return verdict;
}

export function listRemoteSkillTrustVerdicts(): RemoteSkillTrustVerdict[] {
  return [...store.remoteSkillTrustVerdicts.values()];
}

export function getClawHubDiagnostics(): {
  registry_configs: number;
  search_results_cached: number;
  install_records: number;
  publish_records: number;
  sync_records: number;
  trust_verdicts: number;
  pending_installs: number;
  pending_publishes: number;
} {
  const installs = [...store.clawHubInstallRecords.values()];
  const publishes = [...store.clawHubPublishRecords.values()];
  return {
    registry_configs: store.clawHubRegistryConfigs.size,
    search_results_cached: store.clawHubSearchResults.size,
    install_records: installs.length,
    publish_records: publishes.length,
    sync_records: store.clawHubSyncRecords.size,
    trust_verdicts: store.remoteSkillTrustVerdicts.size,
    pending_installs: installs.filter(i => i.install_status === "pending_review").length,
    pending_publishes: publishes.filter(p => p.publish_status === "pending_approval").length
  };
}
