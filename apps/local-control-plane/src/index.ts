import Fastify from "fastify";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { loadBaseEnv } from "@apex/shared-config";
import {
  bootstrapLocalDemoData,
  captureLocalBrowserSnapshot,
  createLocalTask,
  evaluateLocalPermission,
  getCapabilityCatalogSnapshot,
  getLocalDashboard,
  getLocalAgentTeamLauncherCatalog,
  getLocalAgentTeamLauncherBackendAdapterCatalog,
  getLocalAgentTeamLauncherBackendAdapterStatuses,
  getLocalAgentTeamRunnerBackendAdapterCatalog,
  getLocalAgentTeamRunnerBackendAdapterStatuses,
  getLocalAgentTeamLauncherDriverCatalog,
  getLocalAgentTeamLauncherDriverStatuses,
  getLocalAgentTeamLauncherStatuses,
  getLocalSubagentRuntimeLaunchSpec,
  getLocalTaskWorkspace,
  getLocalToolCatalog,
  listTasks,
  listLocalFiles,
  navigateLocalBrowserSession,
  patchLocalFileExact,
  prepareLocalTask,
  readLocalFile,
  requestLocalSubagentResume,
  rollbackLocalFileOperation,
  resolveLocalTaskCapabilities,
  resumeLocalTask,
  runLocalShellCommand,
  searchLocalCapabilities,
  summarizeLocalIdeWorkspace,
  stopLocalTask,
  applyLocalSubagentResumePackage,
  bindLocalSubagentExecutionRun,
  heartbeatLocalSubagentRuntimeInstance,
  launchLocalSubagentRuntimeInstance,
  consumeLocalSubagentRuntimeLaunchReceipt,
  acquireLocalSubagentRuntimeRunnerBackendLease,
  startLocalSubagentRuntimeAdapterRun,
  startLocalSubagentRuntimeBackendExecution,
  startLocalSubagentRuntimeDriverRun,
  attachLocalSubagentRuntimeRunnerHandle,
  startLocalSubagentRuntimeRunnerExecution,
  startLocalSubagentRuntimeRunnerJob,
  heartbeatLocalSubagentRuntimeAdapterRun,
  releaseLocalSubagentRuntimeRunnerBackendLease,
  heartbeatLocalSubagentRuntimeBackendExecution,
  heartbeatLocalSubagentRuntimeDriverRun,
  heartbeatLocalSubagentRuntimeRunnerHandle,
  heartbeatLocalSubagentRuntimeRunnerExecution,
  heartbeatLocalSubagentRuntimeRunnerJob,
  finalizeLocalSubagentRuntimeAdapterRun,
  finalizeLocalSubagentRuntimeBackendExecution,
  finalizeLocalSubagentRuntimeDriverRun,
  finalizeLocalSubagentRuntimeRunnerHandle,
  finalizeLocalSubagentRuntimeRunnerExecution,
  finalizeLocalSubagentRuntimeRunnerJob,
  updateLocalSubagentExecutionRun,
  updateLocalSubagentResumeRequest,
  releaseLocalSubagentRuntimeBinding,
  verifyLocalTask,
  writeLocalFile
} from "@apex/shared-local-core";
import { log } from "@apex/shared-observability";
import {
  detectObjectSecuritySignals,
  detectTextSecuritySignals,
  exportCanonicalSkill,
  exportCanonicalSkillBundle,
  getCanonicalSkill,
  importCanonicalSkillBundle,
  importSkillDocument,
  listCanonicalSkillAudits,
  listCanonicalSkillBundleHistory,
  listCanonicalSkillReviewQueue,
  listCanonicalSkills,
  recordToolInvocation,
  recordAudit,
  registerCanonicalSkill,
  requireTask,
  runTaskEndToEnd,
  searchTaskTemplates,
  searchCanonicalSkills,
  updateCanonicalSkillGovernance,
  verifyCanonicalSkillBundle,
  captureScreen,
  buildAccessibilityTree,
  perceiveScreen,
  executeInputAction,
  createComputerUseSession,
  getComputerUseSession,
  listComputerUseSessions,
  pauseComputerUseSession,
  resumeComputerUseSession,
  stopComputerUseSession,
  completeComputerUseSession,
  initiateHumanTakeover,
  resolveHumanTakeover,
  listHumanTakeovers,
  runSeeActVerifyRecoverLoop,
  listComputerUseSteps,
  getComputerUseStep,
  buildComputerUseReplayPackage,
  replayComputerUseStep,
  listScreenCaptures,
  getScreenCapture,
  listUIPerceptions,
  getUIPerception,
  listInputActions,
  getInputAction,
  resetCircuitBreakers,
  registerOCRProvider,
  listOCRProviders,
  clearOCRProviders,
  registerElementActionProvider,
  listElementActionProviders,
  clearElementActionProviders,
  executeElementAction,
  resolveElementAction,
  getCircuitBreakerStatus
} from "@apex/shared-runtime";
import { store } from "@apex/shared-state";
import {
  CanonicalSkillBundleManifestSchema,
  CanonicalSkillDocumentFormatSchema,
  CanonicalSkillSpecSchema,
  CanonicalSkillStatusSchema,
  createEntityId,
  GovernanceAlertSchema,
  GovernanceAlertFollowUpSchema,
  InboxItemSchema,
  InboxItemStateSchema,
  MemoryDirectory,
  MemoryDocument,
  LearningFactoryPipeline,
  LearningFactoryPipelineStatus,
  LearningFactoryBacklogItem,
  EventLedgerEntryKind,
  PolicyDecisionVerdict,
  PolicyDecision,
  PolicyEnforcementAction,
  PolicyRule,
  LocalCapabilityCategory,
  LocalCapability,
  AutonomousCompletionState,
  AutonomousCompletionConfig,
  ReviewerVerdict,
  ReviewerFeedback,
  SpanKind,
  SpanStatus,
  RunTimeline,
  EgressRuleAction,
  EgressRule,
  EgressRequest,
  EgressVerdict,
  CQSCommandKind,
  CQSQueryKind,
  CQSEventKind,
  ExperimentStatus,
  SandboxTier,
  TaskControlCommandKind,
  LineageMutationKind,
  MetricsWindow,
  PrivacyLevel,
  ModelProvider,
  nowIso,
  PolicyProposalFollowUpSchema,
  SkillPolicyConfigSchema,
  SkillPolicyProposalSchema,
  SkillPolicyScopeNameSchema
} from "@apex/shared-types";
import { z } from "zod";

const env = loadBaseEnv({
  ...process.env,
  SERVICE_NAME: "local-control-plane",
  PORT: process.env.PORT ?? "3010"
});
const TOOL_GATEWAY_BASE_URL = process.env.APEX_TOOL_GATEWAY_BASE_URL ?? "http://127.0.0.1:3007";

const app = Fastify({ logger: false });

function readPositiveIntEnv(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMIT_WINDOWS_MS = 60_000;
const READ_LIMIT_PER_WINDOW = readPositiveIntEnv("APEX_READ_LIMIT_PER_WINDOW", 180);
const MUTATION_LIMIT_PER_WINDOW = readPositiveIntEnv("APEX_MUTATION_LIMIT_PER_WINDOW", 60);
const GOVERNANCE_ALERT_ESCALATION_WINDOW_MS = 15 * 60 * 1000;
const GOVERNANCE_ALERT_ESCALATION_THRESHOLD = 3;
const taskMutationLocks = new Set<string>();
const requestWindows = new Map<string, { windowStart: number; count: number }>();
const DEFAULT_SKILL_POLICY = SkillPolicyConfigSchema.parse({});
const SKILL_POLICY_SCOPE_PATHS = [
  { scope: "global", path: process.env.APEX_SKILL_POLICY_PATH_GLOBAL },
  { scope: "org", path: process.env.APEX_SKILL_POLICY_PATH_ORG },
  { scope: "workspace", path: process.env.APEX_SKILL_POLICY_PATH_WORKSPACE },
  { scope: "local", path: process.env.APEX_SKILL_POLICY_PATH_LOCAL ?? process.env.APEX_SKILL_POLICY_PATH }
] as const;
const PolicyBundleScopeSchema = z.object({
  scope: z.enum(["global", "org", "workspace", "local"]),
  path: z.string().optional(),
  config: SkillPolicyConfigSchema,
  persisted_config: z.record(z.unknown()).optional()
});
const PolicyBundleSchema = z.object({
  bundle_version: z.literal(1),
  exported_at: z.string(),
  scopes: z.array(PolicyBundleScopeSchema),
  integrity_hash: z.string()
});
const DEFAULT_POLICY_APPROVAL_NOTE_TEMPLATES = {
  approval: [
    "Reviewed and approved for target scope promotion.",
    "Change is acceptable and aligned with current governance baseline.",
    "Approved after policy diff review and compatibility check."
  ],
  rejection: [
    "Rejected because the proposed scope would widen trust without justification.",
    "Rejected pending stronger rationale and environment-specific validation.",
    "Rejected because the change conflicts with current content restrictions."
  ],
  promotion: [
    "Promoting reviewed policy into the target environment baseline.",
    "Applying approved proposal to the next scope after review sign-off.",
    "Promoting approved hardening changes to the target scope."
  ]
} as const;
const DEFAULT_POLICY_SCOPE_LABELS = {
  global: "Global Baseline",
  org: "Organization Policy",
  workspace: "Workspace Policy",
  local: "Local Override"
} as const;
const DEFAULT_POLICY_PROMOTION_PIPELINE = ["local>workspace", "workspace>org", "org>global"] as const;
const POLICY_SCOPE_ORDER: Array<z.infer<typeof SkillPolicyScopeNameSchema>> = ["global", "org", "workspace", "local"];
const DesktopDeepLinkTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("task"),
    taskId: z.string()
  }),
  z.object({
    kind: z.literal("inbox"),
    inboxId: z.string()
  }),
  z.object({
    kind: z.literal("policy_follow_up"),
    followUpId: z.string()
  }),
  z.object({
    kind: z.literal("policy_proposal"),
    proposalId: z.string()
  }),
  z.object({
    kind: z.literal("execution_template"),
    taskId: z.string(),
    templateId: z.string()
  }),
  z.object({
    kind: z.literal("learned_playbook"),
    taskId: z.string(),
    playbookId: z.string()
  })
]);

function resolveListPolicy(envKey: string, fallback: string[] = []) {
  const raw = process.env[envKey];
  const value = (raw ?? fallback.join(","))
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  return {
    value,
    source: raw == null ? "default" : "env"
  } as const;
}

function resolveBooleanPolicy(envKey: string, fallback = false) {
  const raw = process.env[envKey];
  const value = raw == null ? fallback : /^(1|true|yes)$/i.test(raw);
  return {
    value,
    source: raw == null ? "default" : "env"
  } as const;
}

function hasNestedProperty(value: unknown, path: string[]) {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return true;
}

function getNestedProperty<T>(value: unknown, path: string[]): T {
  let current = value;
  for (const segment of path) {
    current = (current as Record<string, unknown>)[segment];
  }
  return current as T;
}

function loadSkillPolicyFiles() {
  return SKILL_POLICY_SCOPE_PATHS.map(entry => {
    if (!entry.path) {
      return {
        scope: entry.scope,
        configured: false,
        loaded: false,
        path: undefined,
        error: null,
        raw: {},
        config: DEFAULT_SKILL_POLICY
      };
    }

    try {
      const resolvedPath = requireAbsolutePath(entry.path);
      const raw = JSON.parse(readFileSync(resolvedPath, "utf8")) as Record<string, unknown>;
      const parsed = SkillPolicyConfigSchema.parse(raw);
      return {
        scope: entry.scope,
        configured: true,
        loaded: true,
        path: resolvedPath,
        error: null,
        raw,
        config: parsed
      };
    } catch (error) {
      return {
        scope: entry.scope,
        configured: true,
        loaded: false,
        path: entry.path,
        error: (error as Error).message,
        raw: {},
        config: DEFAULT_SKILL_POLICY
      };
    }
  });
}

function computeEffectiveSkillPolicyDiagnostics(policyFiles = loadSkillPolicyFiles()) {

  const resolveScopedListPolicy = (path: string[], envKey: string, fallback: string[]) => {
    let value = [...fallback];
    let source: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env" = "default";
    for (const file of policyFiles) {
      if (!file.loaded || !hasNestedProperty(file.raw, path)) continue;
      value = [...getNestedProperty<string[]>(file.config, path)];
      source = `${file.scope}_file`;
    }
    const envPolicy = resolveListPolicy(envKey, value);
    if (envPolicy.source === "env") {
      return { value: envPolicy.value, source: "env" as const };
    }
    return { value, source };
  };

  const resolveScopedBooleanPolicy = (path: string[], envKey: string, fallback: boolean) => {
    let value = fallback;
    let source: "default" | "global_file" | "org_file" | "workspace_file" | "local_file" | "env" = "default";
    for (const file of policyFiles) {
      if (!file.loaded || !hasNestedProperty(file.raw, path)) continue;
      value = getNestedProperty<boolean>(file.config, path);
      source = `${file.scope}_file`;
    }
    const envPolicy = resolveBooleanPolicy(envKey, value);
    if (envPolicy.source === "env") {
      return { value: envPolicy.value, source: "env" as const };
    }
    return { value, source };
  };

  const trustedPublishersPolicy = resolveScopedListPolicy(
    ["trust", "trusted_publishers"],
    "APEX_SKILL_TRUSTED_PUBLISHERS",
    DEFAULT_SKILL_POLICY.trust.trusted_publishers
  );
  const allowedReleaseChannelsPolicy = resolveScopedListPolicy(
    ["trust", "allowed_release_channels"],
    "APEX_SKILL_ALLOWED_RELEASE_CHANNELS",
    DEFAULT_SKILL_POLICY.trust.allowed_release_channels
  );
  const requireTrustedImportPolicy = resolveScopedBooleanPolicy(
    ["trust", "require_trusted_bundle_import"],
    "APEX_SKILL_REQUIRE_TRUSTED_IMPORT",
    DEFAULT_SKILL_POLICY.trust.require_trusted_bundle_import
  );
  const allowedSourcesPolicy = resolveScopedListPolicy(
    ["content", "allowed_skill_sources"],
    "APEX_SKILL_ALLOWED_SOURCES",
    DEFAULT_SKILL_POLICY.content.allowed_skill_sources
  );
  const blockedTagsPolicy = resolveScopedListPolicy(
    ["content", "blocked_tags"],
    "APEX_SKILL_BLOCKED_TAGS",
    DEFAULT_SKILL_POLICY.content.blocked_tags
  );
  const blockedCapabilitiesPolicy = resolveScopedListPolicy(
    ["content", "blocked_capabilities"],
    "APEX_SKILL_BLOCKED_CAPABILITIES",
    DEFAULT_SKILL_POLICY.content.blocked_capabilities
  );
  const reviewRolesPolicy = resolveScopedListPolicy(
    ["roles", "review_roles"],
    "APEX_SKILL_REVIEW_ROLES",
    DEFAULT_SKILL_POLICY.roles.review_roles
  );
  const promoteRolesPolicy = resolveScopedListPolicy(
    ["roles", "promote_roles"],
    "APEX_SKILL_PROMOTE_ROLES",
    DEFAULT_SKILL_POLICY.roles.promote_roles
  );
  const trustedImportRolesPolicy = resolveScopedListPolicy(
    ["roles", "trusted_import_roles"],
    "APEX_SKILL_TRUSTED_IMPORT_ROLES",
    DEFAULT_SKILL_POLICY.roles.trusted_import_roles
  );
  const policyEditRolesPolicy = resolveScopedListPolicy(
    ["roles", "policy_edit_roles"],
    "APEX_SKILL_POLICY_EDIT_ROLES",
    DEFAULT_SKILL_POLICY.roles.policy_edit_roles
  );
  const policyApproveRolesPolicy = resolveScopedListPolicy(
    ["roles", "policy_approve_roles"],
    "APEX_SKILL_POLICY_APPROVE_ROLES",
    DEFAULT_SKILL_POLICY.roles.policy_approve_roles
  );
  const policyManualApprovalRolesPolicy = resolveScopedListPolicy(
    ["roles", "policy_manual_approval_roles"],
    "APEX_SKILL_POLICY_MANUAL_APPROVAL_ROLES",
    DEFAULT_SKILL_POLICY.roles.policy_manual_approval_roles
  );
  const policySecurityReviewRolesPolicy = resolveScopedListPolicy(
    ["roles", "policy_security_review_roles"],
    "APEX_SKILL_POLICY_SECURITY_REVIEW_ROLES",
    DEFAULT_SKILL_POLICY.roles.policy_security_review_roles
  );
  const policyPromoteRolesPolicy = resolveScopedListPolicy(
    ["roles", "policy_promote_roles"],
    "APEX_SKILL_POLICY_PROMOTE_ROLES",
    DEFAULT_SKILL_POLICY.roles.policy_promote_roles
  );
  const scopeLabelsPolicy = resolveScopeLabelsPolicy();
  const promotionPipelinePolicy = resolvePromotionPipelinePolicy();

  const effectivePolicyFile = [...policyFiles]
    .reverse()
    .find(file => file.configured);

  return {
    trust: {
      trusted_publishers: trustedPublishersPolicy.value,
      allowed_release_channels: allowedReleaseChannelsPolicy.value,
      require_trusted_bundle_import: requireTrustedImportPolicy.value
    },
    content: {
      allowed_skill_sources: allowedSourcesPolicy.value as Array<"internal" | "openclaw" | "claude" | "openai">,
      blocked_tags: blockedTagsPolicy.value,
      blocked_capabilities: blockedCapabilitiesPolicy.value
    },
    roles: {
      review_roles: reviewRolesPolicy.value,
      promote_roles: promoteRolesPolicy.value,
      trusted_import_roles: trustedImportRolesPolicy.value,
      policy_edit_roles: policyEditRolesPolicy.value,
      policy_approve_roles: policyApproveRolesPolicy.value,
      policy_manual_approval_roles: policyManualApprovalRolesPolicy.value,
      policy_security_review_roles: policySecurityReviewRolesPolicy.value,
      policy_promote_roles: policyPromoteRolesPolicy.value
    },
    environments: {
      labels: scopeLabelsPolicy.value,
      promotion_pipeline: promotionPipelinePolicy.value
    },
    sources: {
      trusted_publishers: trustedPublishersPolicy.source,
      allowed_release_channels: allowedReleaseChannelsPolicy.source,
      require_trusted_bundle_import: requireTrustedImportPolicy.source,
      allowed_skill_sources: allowedSourcesPolicy.source,
      blocked_tags: blockedTagsPolicy.source,
      blocked_capabilities: blockedCapabilitiesPolicy.source,
      review_roles: reviewRolesPolicy.source,
      promote_roles: promoteRolesPolicy.source,
      trusted_import_roles: trustedImportRolesPolicy.source,
      policy_edit_roles: policyEditRolesPolicy.source,
      policy_approve_roles: policyApproveRolesPolicy.source,
      policy_manual_approval_roles: policyManualApprovalRolesPolicy.source,
      policy_security_review_roles: policySecurityReviewRolesPolicy.source,
      policy_promote_roles: policyPromoteRolesPolicy.source,
      scope_labels: scopeLabelsPolicy.source,
      promotion_pipeline: promotionPipelinePolicy.source
    },
    policy_file: {
      path: effectivePolicyFile?.path,
      loaded: effectivePolicyFile?.loaded ?? false,
      error: effectivePolicyFile?.error ?? null
    },
    policy_files: policyFiles.map(file => ({
      scope: file.scope,
      configured: file.configured,
      path: file.path,
      loaded: file.loaded,
      error: file.error
    }))
  };
}

function resolveScopeLabelsPolicy() {
  const raw = process.env.APEX_SKILL_POLICY_SCOPE_LABELS;
  if (!raw) {
    return {
      value: DEFAULT_POLICY_SCOPE_LABELS,
      source: "default" as const
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Record<z.infer<typeof SkillPolicyScopeNameSchema>, string>>;
    return {
      value: {
        global: parsed.global ?? DEFAULT_POLICY_SCOPE_LABELS.global,
        org: parsed.org ?? DEFAULT_POLICY_SCOPE_LABELS.org,
        workspace: parsed.workspace ?? DEFAULT_POLICY_SCOPE_LABELS.workspace,
        local: parsed.local ?? DEFAULT_POLICY_SCOPE_LABELS.local
      },
      source: "env" as const
    };
  } catch {
    return {
      value: DEFAULT_POLICY_SCOPE_LABELS,
      source: "default" as const
    };
  }
}

function resolvePromotionPipelinePolicy() {
  const raw = process.env.APEX_SKILL_POLICY_PROMOTION_PIPELINE;
  const values = (raw ?? DEFAULT_POLICY_PROMOTION_PIPELINE.join(","))
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  return {
    value: values,
    source: raw ? "env" as const : "default" as const
  };
}

function getEffectiveSkillPolicyDiagnostics() {
  return computeEffectiveSkillPolicyDiagnostics();
}

function getConfiguredSkillPolicyPath(scope: z.infer<typeof SkillPolicyScopeNameSchema>) {
  return SKILL_POLICY_SCOPE_PATHS.find(item => item.scope === scope)?.path;
}

function listSkillPolicyScopes() {
  return loadSkillPolicyFiles().map(file => ({
    scope: file.scope,
    configured: file.configured,
    path: file.path,
    loaded: file.loaded,
    error: file.error,
    config: file.loaded ? file.config : DEFAULT_SKILL_POLICY
  }));
}

function buildPolicyEnvironmentSnapshots() {
  const allFiles = loadSkillPolicyFiles();
  const labels = getEffectiveSkillPolicyDiagnostics().environments.labels;
  return POLICY_SCOPE_ORDER.map(scope => {
    const allowedScopes = new Set(POLICY_SCOPE_ORDER.slice(0, POLICY_SCOPE_ORDER.indexOf(scope) + 1));
    const scopedFiles = allFiles.filter(file => allowedScopes.has(file.scope));
    return {
      scope,
      label: labels[scope],
      effective_policy: computeEffectiveSkillPolicyDiagnostics(scopedFiles)
    };
  });
}

function createPersistableSkillPolicyConfig(
  rawConfig: Record<string, unknown>,
  parsedConfig: typeof DEFAULT_SKILL_POLICY
) {
  const result: Record<string, unknown> = {};
  for (const section of ["trust", "content", "roles"] as const) {
    const rawSection = rawConfig[section];
    if (!rawSection || typeof rawSection !== "object") continue;
    const sectionResult: Record<string, unknown> = {};
    for (const key of Object.keys(rawSection)) {
      sectionResult[key] = (parsedConfig[section] as Record<string, unknown>)[key];
    }
    if (Object.keys(sectionResult).length > 0) {
      result[section] = sectionResult;
    }
  }
  return result;
}

function buildPolicyBundle(policyFiles = loadSkillPolicyFiles()) {
  const normalizedScopes = policyFiles
    .filter(scope => scope.configured && scope.loaded)
    .map(scope => ({
      scope: scope.scope,
      path: scope.path,
      config: SkillPolicyConfigSchema.parse(scope.raw),
      persisted_config: scope.raw
    }));
  const payload = {
    bundle_version: 1 as const,
    exported_at: new Date().toISOString(),
    scopes: normalizedScopes
  };
  const integrity_hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return PolicyBundleSchema.parse({
    ...payload,
    integrity_hash
  });
}

function verifyPolicyBundleIntegrity(bundle: z.infer<typeof PolicyBundleSchema>) {
  const expected = createHash("sha256")
    .update(
      JSON.stringify({
        bundle_version: bundle.bundle_version,
        exported_at: bundle.exported_at,
        scopes: bundle.scopes
      })
    )
    .digest("hex");
  return {
    valid: expected === bundle.integrity_hash,
    expected_integrity_hash: expected
  };
}

function listPolicyScopeAudits(scope?: z.infer<typeof SkillPolicyScopeNameSchema>) {
  return [...store.audits.values()]
    .filter(audit => audit.action.startsWith("skill.policy_"))
    .filter(audit => (scope ? audit.payload?.scope === scope : true))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function createPolicyScopeOverride(
  scope: z.infer<typeof SkillPolicyScopeNameSchema>,
  rawConfig: Record<string, unknown>,
  parsedConfig: typeof DEFAULT_SKILL_POLICY,
  resolvedPath?: string
) {
  return loadSkillPolicyFiles().map(file =>
    file.scope === scope
      ? {
          ...file,
          configured: true,
          loaded: true,
          path: resolvedPath ?? file.path,
          error: null,
          raw: rawConfig,
          config: parsedConfig
        }
      : file
  );
}

function computePolicyDiff(
  before: ReturnType<typeof getEffectiveSkillPolicyDiagnostics>,
  after: ReturnType<typeof getEffectiveSkillPolicyDiagnostics>
) {
  const fields = [
    "trust.trusted_publishers",
    "trust.allowed_release_channels",
    "trust.require_trusted_bundle_import",
    "content.allowed_skill_sources",
    "content.blocked_tags",
    "content.blocked_capabilities",
    "roles.review_roles",
    "roles.promote_roles",
      "roles.trusted_import_roles",
      "roles.policy_edit_roles",
      "roles.policy_approve_roles",
      "roles.policy_manual_approval_roles",
      "roles.policy_security_review_roles",
      "roles.policy_promote_roles",
      "environments.labels",
      "environments.promotion_pipeline"
  ] as const;
  const changes: Array<{ field: string; before?: unknown; after?: unknown }> = [];
  for (const field of fields) {
    const path = field.split(".");
    const beforeValue = getNestedProperty<unknown>(before, path as string[]);
    const afterValue = getNestedProperty<unknown>(after, path as string[]);
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue;
    }
    changes.push({
      field,
      before: beforeValue,
      after: afterValue
    });
  }
  return changes;
}

function groupPolicyDiff(changes: Array<{ field: string; before?: unknown; after?: unknown }>) {
  const groups = new Map<
    "trust" | "content" | "roles" | "environments",
    Array<{ field: string; before?: unknown; after?: unknown }>
  >();
  for (const change of changes) {
    const group = change.field.split(".")[0] as "trust" | "content" | "roles" | "environments";
    const existing = groups.get(group) ?? [];
    existing.push(change);
    groups.set(group, existing);
  }
  return [...groups.entries()].map(([group, items]) => ({
    group,
    items
  }));
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item)) : [];
}

function summarizePolicyCompareRisk(changes: Array<{ field: string; before?: unknown; after?: unknown }>) {
  const risks: Array<{
    severity: "high" | "medium" | "low";
    field: string;
    title: string;
    reason: string;
  }> = [];
  for (const change of changes) {
    if (change.field === "trust.require_trusted_bundle_import" && change.before === true && change.after === false) {
      risks.push({
        severity: "high",
        field: change.field,
        title: "Trusted import guard removed",
        reason: "The target environment no longer requires trusted bundle import, which broadens what can be promoted or imported."
      });
      continue;
    }

    if (change.field === "trust.trusted_publishers") {
      const before = new Set(asStringArray(change.before));
      const after = asStringArray(change.after).filter(item => !before.has(item));
      if (after.length > 0) {
        risks.push({
          severity: "medium",
          field: change.field,
          title: "Trusted publisher allowlist expanded",
          reason: `New trusted publishers were added: ${after.join(", ")}.`
        });
      }
      continue;
    }

    if (change.field === "trust.allowed_release_channels") {
      const before = new Set(asStringArray(change.before));
      const after = asStringArray(change.after).filter(item => !before.has(item));
      if (after.length > 0) {
        risks.push({
          severity: "medium",
          field: change.field,
          title: "Release channels expanded",
          reason: `Additional release channels became allowed: ${after.join(", ")}.`
        });
      }
      continue;
    }

    if (change.field === "content.allowed_skill_sources") {
      const before = new Set(asStringArray(change.before));
      const after = asStringArray(change.after).filter(item => !before.has(item));
      if (after.length > 0) {
        risks.push({
          severity: "medium",
          field: change.field,
          title: "Additional skill sources allowed",
          reason: `The target environment allows more skill sources: ${after.join(", ")}.`
        });
      }
      continue;
    }

    if (change.field === "content.blocked_tags" || change.field === "content.blocked_capabilities") {
      const after = new Set(asStringArray(change.after));
      const removed = asStringArray(change.before).filter(item => !after.has(item));
      if (removed.length > 0) {
        risks.push({
          severity: "high",
          field: change.field,
          title: change.field === "content.blocked_tags" ? "Blocked tags were removed" : "Blocked capabilities were removed",
          reason: `The target environment unblocked: ${removed.join(", ")}.`
        });
      }
      continue;
    }

      if (
        change.field === "roles.trusted_import_roles" ||
        change.field === "roles.policy_promote_roles" ||
        change.field === "roles.policy_approve_roles" ||
        change.field === "roles.policy_manual_approval_roles" ||
        change.field === "roles.policy_security_review_roles" ||
        change.field === "roles.policy_edit_roles" ||
        change.field === "roles.promote_roles" ||
        change.field === "roles.review_roles"
      ) {
        const before = new Set(asStringArray(change.before));
        const added = asStringArray(change.after).filter(item => !before.has(item));
        if (added.length > 0) {
          risks.push({
            severity: change.field === "roles.trusted_import_roles" || change.field.startsWith("roles.policy_") ? "high" : "medium",
            field: change.field,
            title: "Role access expanded",
            reason: `The target environment grants additional roles: ${added.join(", ")}.`
          });
        }
      continue;
    }

    if (change.field === "environments.promotion_pipeline") {
      const before = new Set(asStringArray(change.before));
      const added = asStringArray(change.after).filter(item => !before.has(item));
      if (added.length > 0) {
        risks.push({
          severity: "medium",
          field: change.field,
          title: "Promotion pipeline expanded",
          reason: `New promotion paths are allowed: ${added.join(", ")}.`
        });
      }
    }
  }
  return risks;
}

function buildPolicyCompareAdvisory(
  risks: Array<{
    severity: "high" | "medium" | "low";
    field: string;
    title: string;
    reason: string;
  }>
) {
  const highRisks = risks.filter(item => item.severity === "high");
  const mediumRisks = risks.filter(item => item.severity === "medium");

  if (highRisks.length > 0) {
    return {
      recommended_action: "requires_security_review" as const,
      manual_approval_required: true,
      security_review_required: true,
      reasons: highRisks.map(item => item.title),
      next_step: "create_promotion_proposal" as const,
      review_path: "security_review" as const,
      suggested_template_kind: "promotion" as const,
      suggested_note:
        "Promoting reviewed policy into the target environment baseline. Security review is required before this change is applied."
    };
  }

  if (mediumRisks.length > 0) {
    return {
      recommended_action: "manual_approval_required" as const,
      manual_approval_required: true,
      security_review_required: false,
      reasons: mediumRisks.map(item => item.title),
      next_step: "create_promotion_proposal" as const,
      review_path: "manual_approval" as const,
      suggested_template_kind: "promotion" as const,
      suggested_note:
        "Applying approved proposal to the next scope after review sign-off. Manual approval is required because this compare expands governance scope."
    };
  }

  return {
    recommended_action: "safe_to_promote" as const,
    manual_approval_required: false,
    security_review_required: false,
    reasons: ["No governance-expanding risk signals were detected."],
    next_step: "create_promotion_proposal" as const,
    review_path: "standard" as const,
    suggested_template_kind: "promotion" as const,
    suggested_note: "Promoting reviewed policy into the target environment baseline."
  };
}

function buildDesktopDeepLink(target: z.infer<typeof DesktopDeepLinkTargetSchema>) {
  const params = new URLSearchParams();
  params.set("kind", target.kind);
  if (target.kind === "task") {
    params.set("taskId", target.taskId);
  } else if (target.kind === "inbox") {
    params.set("inboxId", target.inboxId);
  } else if (target.kind === "policy_follow_up") {
    params.set("followUpId", target.followUpId);
  } else if (target.kind === "policy_proposal") {
    params.set("proposalId", target.proposalId);
  } else if (target.kind === "execution_template") {
    params.set("taskId", target.taskId);
    params.set("templateId", target.templateId);
  } else {
    params.set("taskId", target.taskId);
    params.set("playbookId", target.playbookId);
  }
  return `#${params.toString()}`;
}

function parseDesktopDeepLink(hash?: string | null) {
  if (!hash) return null;
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalized) return null;
  const params = new URLSearchParams(normalized);
  const kind = params.get("kind");
  if (kind === "execution_template" && params.get("taskId") && params.get("templateId")) {
    return {
      kind,
      taskId: params.get("taskId") ?? "",
      templateId: params.get("templateId") ?? ""
    } as const;
  }
  if (kind === "learned_playbook" && params.get("taskId") && params.get("playbookId")) {
    return {
      kind,
      taskId: params.get("taskId") ?? "",
      playbookId: params.get("playbookId") ?? ""
    } as const;
  }
  return null;
}

function listPolicyProposals(status?: z.infer<typeof SkillPolicyProposalSchema>["status"]) {
  return [...store.skillPolicyProposals.values()]
    .filter(proposal => (status ? proposal.status === status : true))
    .sort((left, right) => right.requested_at.localeCompare(left.requested_at))
    .map(proposal =>
      SkillPolicyProposalSchema.parse({
        ...proposal,
        deep_link: buildDesktopDeepLink({
          kind: "policy_proposal",
          proposalId: proposal.proposal_id
        })
      })
    );
}

function listPolicyProposalQueues(filters?: {
  status?: z.infer<typeof SkillPolicyProposalSchema>["status"];
  target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
}) {
  const queueDefinitions: Array<{
    review_path: z.infer<typeof SkillPolicyProposalSchema>["review_path"];
    label: string;
    description: string;
  }> = [
    {
      review_path: "security_review",
      label: "Security Review Queue",
      description: "Governance-expanding proposals that require explicit security review."
    },
    {
      review_path: "manual_approval",
      label: "Manual Approval Queue",
      description: "Medium-risk proposals that require elevated manual review before promotion."
    },
    {
      review_path: "standard",
      label: "Standard Promotion Queue",
      description: "Low-risk proposals that are safe to process through the standard path."
    }
  ];

  const items = listPolicyProposals(filters?.status).filter(item =>
    (filters?.target_scope ? item.target_scope === filters.target_scope : true)
  );

  return queueDefinitions.map(queue => {
    const queueItems = items.filter(item => item.review_path === queue.review_path);
    const statusBreakdown = {
      pending_review: queueItems.filter(item => item.status === "pending_review").length,
      approved: queueItems.filter(item => item.status === "approved").length,
      rejected: queueItems.filter(item => item.status === "rejected").length,
      applied: queueItems.filter(item => item.status === "applied").length
    };
    const pendingItems = queueItems
      .filter(item => item.status === "pending_review")
      .sort((left, right) => left.requested_at.localeCompare(right.requested_at));
    const oldestRequestedAt = pendingItems[0]?.requested_at;
    const now = Date.now();
    const slaHours =
      queue.review_path === "security_review" ? 4 :
      queue.review_path === "manual_approval" ? 8 :
      24;
    const slaBreaches = pendingItems.filter(item => now - Date.parse(item.requested_at) > slaHours * 60 * 60 * 1000).length;
    const suggestedAction =
      queue.review_path === "security_review" && statusBreakdown.pending_review > 0
        ? "prioritize_security_review"
        : queue.review_path === "manual_approval" && statusBreakdown.pending_review > 0
          ? "clear_manual_approval_queue"
          : queue.review_path === "standard" && statusBreakdown.pending_review > 0
            ? "process_standard_queue"
            : "queue_clear";
    const escalationRequired =
      slaBreaches > 0 ||
      (queue.review_path === "security_review" && statusBreakdown.pending_review > 0);
    const escalationReason =
      slaBreaches > 0
        ? `${slaBreaches} pending proposal(s) exceeded the ${slaHours}h SLA.`
        : queue.review_path === "security_review" && statusBreakdown.pending_review > 0
          ? "Security review proposals are pending and should be handled before standard promotions."
          : undefined;
    const followUpAction =
      slaBreaches > 0
        ? "escalate_queue_owner"
        : queue.review_path === "security_review" && statusBreakdown.pending_review > 0
          ? "assign_security_reviewer"
          : queue.review_path === "manual_approval" && statusBreakdown.pending_review > 0
            ? "request_manual_approval"
            : queue.review_path === "standard" && statusBreakdown.pending_review > 0
              ? "process_standard_promotions"
              : "none";
    const healthStatus =
      slaBreaches > 0
        ? "breached"
        : statusBreakdown.pending_review > 0
          ? "attention"
          : "healthy";
    return {
      ...queue,
      count: queueItems.length,
      status_breakdown: statusBreakdown,
      oldest_requested_at: oldestRequestedAt,
      pending_review_sla_hours: slaHours,
      pending_review_sla_breach_count: slaBreaches,
      suggested_action: suggestedAction,
      health_status: healthStatus,
      escalation_required: escalationRequired,
      escalation_reason: escalationReason,
      follow_up_action: followUpAction,
      items: queueItems
    };
  });
}

function listPolicyProposalFollowUps(filters?: {
  status?: z.infer<typeof SkillPolicyProposalSchema>["status"];
  target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
}) {
  return listPolicyProposalQueues(filters)
    .filter(queue => queue.follow_up_action !== "none")
    .map(queue => {
      const severity =
        queue.pending_review_sla_breach_count > 0
          ? "critical"
          : queue.review_path === "security_review"
            ? "warning"
            : "info";
      const title =
        queue.follow_up_action === "escalate_queue_owner"
          ? `${queue.label}: SLA escalation required`
          : queue.follow_up_action === "assign_security_reviewer"
            ? `${queue.label}: assign security reviewer`
            : queue.follow_up_action === "request_manual_approval"
              ? `${queue.label}: request manual approval`
              : `${queue.label}: process pending promotions`;
      const message =
        queue.escalation_reason ??
        `${queue.status_breakdown.pending_review} pending proposal(s) require action in the ${queue.label.toLowerCase()}.`;
      return PolicyProposalFollowUpSchema.parse({
        follow_up_id: `policy_follow_up_${queue.review_path}`,
        review_path: queue.review_path,
        severity,
        action: queue.follow_up_action,
        queue_label: queue.label,
        title,
        message,
        pending_count: queue.status_breakdown.pending_review,
        sla_breach_count: queue.pending_review_sla_breach_count,
        deep_link: buildDesktopDeepLink({
          kind: "policy_follow_up",
          followUpId: `policy_follow_up_${queue.review_path}`
        }),
        created_at: nowIso()
      });
    });
}

type InboxListItem = z.infer<typeof InboxItemSchema> & {
  state: "new" | "acknowledged";
};

type InboxFilters = {
  severity?: z.infer<typeof InboxItemSchema>["severity"];
  kind?: z.infer<typeof InboxItemSchema>["kind"];
  status?: "new" | "acknowledged";
};

function buildInboxItems() {
  const policyItems = listPolicyProposalFollowUps().map(item => {
    const baseItem = InboxItemSchema.parse({
      inbox_id: `inbox_${item.follow_up_id}`,
      kind: "policy_follow_up",
      severity: item.severity,
      title: item.title,
      message: item.message,
      action: item.action,
      source_id: item.follow_up_id,
      deep_link: buildDesktopDeepLink({
        kind: "inbox",
        inboxId: `inbox_${item.follow_up_id}`
      }),
      created_at: item.created_at
    });
    const state = store.inboxItemStates.get(baseItem.inbox_id);
    if (state?.status === "resolved") {
      return null;
    }
    return {
      ...baseItem,
      state: state?.status === "acknowledged" ? "acknowledged" : "new"
    } satisfies InboxListItem;
  });

  const governanceItems = [...store.governanceAlerts.values()].map(alert => {
    const baseItem = InboxItemSchema.parse({
      inbox_id: `inbox_${alert.alert_id}`,
      kind: "governance_alert",
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      action: alert.action,
      source_id: alert.alert_id,
      deep_link: buildDesktopDeepLink({
        kind: "inbox",
        inboxId: `inbox_${alert.alert_id}`
      }),
      created_at: alert.created_at
    });
    const state = store.inboxItemStates.get(baseItem.inbox_id);
    if (state?.status === "resolved") {
      return null;
    }
    return {
      ...baseItem,
      state: state?.status === "acknowledged" ? "acknowledged" : "new"
    } satisfies InboxListItem;
  });

  return [...policyItems, ...governanceItems]
    .filter((item): item is InboxListItem => Boolean(item))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function listInboxItems(filters?: InboxFilters) {
  return buildInboxItems().filter(item =>
    (filters?.severity ? item.severity === filters.severity : true) &&
    (filters?.kind ? item.kind === filters.kind : true) &&
    (filters?.status ? item.state === filters.status : true)
  );
}

function buildInboxSummary() {
  const items = buildInboxItems();
  return {
    total_open: items.length,
    new_count: items.filter(item => item.state === "new").length,
    acknowledged_count: items.filter(item => item.state === "acknowledged").length,
    by_severity: {
      info: items.filter(item => item.severity === "info").length,
      warning: items.filter(item => item.severity === "warning").length,
      critical: items.filter(item => item.severity === "critical").length
    },
    by_kind: {
      policy_follow_up: items.filter(item => item.kind === "policy_follow_up").length,
      task_attention: items.filter(item => item.kind === "task_attention").length,
      governance_alert: items.filter(item => item.kind === "governance_alert").length
    }
  };
}

function buildGovernanceAlertSummary() {
  const items = listGovernanceAlertsWithState();
  return {
    total: items.length,
    open_count: items.filter(item => item.status !== "resolved").length,
    acknowledged_count: items.filter(item => item.status === "acknowledged").length,
    resolved_count: items.filter(item => item.status === "resolved").length,
    escalated_count: items.filter(item => item.auto_escalated).length,
    by_severity: {
      info: items.filter(item => item.severity === "info").length,
      warning: items.filter(item => item.severity === "warning").length,
      critical: items.filter(item => item.severity === "critical").length
    },
    by_action: {
      review_desktop_navigation: items.filter(item => item.action === "review_desktop_navigation").length,
      investigate_system_handoff: items.filter(item => item.action === "investigate_system_handoff").length,
      review_reuse_navigation: items.filter(item => item.action === "review_reuse_navigation").length,
      investigate_reuse_loop: items.filter(item => item.action === "investigate_reuse_loop").length
    },
    by_source_kind: {
      desktop_navigation: items.filter(item => item.source_kind === "desktop_navigation").length,
      reuse_navigation: items.filter(item => item.source_kind === "reuse_navigation").length
    },
    aggregated_occurrences: items.reduce((sum, item) => sum + (item.occurrence_count ?? 1), 0)
  };
}

function updateInboxItemState(inboxId: string, status: "acknowledged" | "resolved", actorRole: string) {
  const inboxItem = buildInboxItems().find(item => item.inbox_id === inboxId) ??
    listPolicyProposalFollowUps()
      .map(item =>
        InboxItemSchema.parse({
          inbox_id: `inbox_${item.follow_up_id}`,
          kind: "policy_follow_up",
          severity: item.severity,
          title: item.title,
          message: item.message,
          action: item.action,
          source_id: item.follow_up_id,
          created_at: item.created_at
        })
      )
      .find(item => item.inbox_id === inboxId);
  if (!inboxItem) {
    throw new Error(`Unknown inbox item '${inboxId}'.`);
  }
  const state = InboxItemStateSchema.parse({
    inbox_id: inboxId,
    status,
    updated_at: nowIso(),
    updated_by: actorRole
  });
  store.inboxItemStates.set(inboxId, state);
  recordAudit(`inbox.${status}`, {
    inbox_id: inboxId,
    actor_role: actorRole,
    kind: inboxItem.kind,
    source_id: inboxItem.source_id
  });
  return state;
}

function reopenInboxItem(inboxId: string, actorRole: string, reason: string) {
  const state = InboxItemStateSchema.parse({
    inbox_id: inboxId,
    status: "open",
    updated_at: nowIso(),
    updated_by: actorRole
  });
  store.inboxItemStates.set(inboxId, state);
  recordAudit("inbox.reopened", {
    inbox_id: inboxId,
    actor_role: actorRole,
    reason
  });
  return state;
}

function getPolicyProposalFollowUp(
  followUpId: string,
  filters?: {
    status?: z.infer<typeof SkillPolicyProposalSchema>["status"];
    target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
  }
) {
  return listPolicyProposalFollowUps(filters).find(item => item.follow_up_id === followUpId);
}

function listGovernanceAlerts() {
  return [...store.governanceAlerts.values()].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function listGovernanceAlertsWithState(filters?: {
  severity?: z.infer<typeof GovernanceAlertSchema>["severity"];
  status?: "new" | "acknowledged" | "resolved";
}) {
  return listGovernanceAlerts()
    .map(alert => {
      const inboxId = `inbox_${alert.alert_id}`;
      const state = store.inboxItemStates.get(inboxId);
      const status =
        state?.status === "resolved"
          ? "resolved"
          : state?.status === "acknowledged"
            ? "acknowledged"
            : "new";
      return {
        ...alert,
        status
      };
    })
    .filter(alert =>
      (filters?.severity ? alert.severity === filters.severity : true) &&
      (filters?.status ? alert.status === filters.status : true)
    );
}

function summarizeGovernanceAlerts() {
  const items = listGovernanceAlertsWithState();
  return {
    total_items: items.length,
    aggregated_occurrences: items.reduce((sum, item) => sum + (item.occurrence_count ?? 1), 0),
    max_occurrence_count: items.reduce((max, item) => Math.max(max, item.occurrence_count ?? 1), 0)
  };
}

function getGovernanceAlertTopRepeated() {
  return listGovernanceAlertsWithState()
    .sort((left, right) => (right.occurrence_count ?? 1) - (left.occurrence_count ?? 1))
    .slice(0, 5)
    .map(item => ({
      alert_id: item.alert_id,
      title: item.title,
      severity: item.severity,
      status: item.status,
      occurrence_count: item.occurrence_count ?? 1,
      last_seen_at: item.last_seen_at ?? item.created_at
    }));
}

function listGovernanceAlertFollowUps(filters?: {
  severity?: z.infer<typeof GovernanceAlertSchema>["severity"];
  status?: "new" | "acknowledged" | "resolved";
}) {
  return listGovernanceAlertsWithState(filters)
    .filter(alert => alert.status !== "resolved")
    .filter(alert => alert.severity === "critical" || alert.auto_escalated || (alert.occurrence_count ?? 1) >= 2)
    .map(alert =>
      GovernanceAlertFollowUpSchema.parse({
        follow_up_id: `governance_follow_up_${alert.alert_id}`,
        alert_id: alert.alert_id,
        severity: alert.severity,
        action: alert.action,
        title:
          alert.action === "investigate_system_handoff"
            ? `${alert.title}: investigate desktop handoff`
            : alert.action === "investigate_reuse_loop"
              ? `${alert.title}: investigate reuse loop`
              : alert.action === "review_reuse_navigation"
                ? `${alert.title}: review repeated reuse navigation`
                : `${alert.title}: review repeated navigation`,
        message:
          alert.recommended_action ??
          (alert.action === "investigate_system_handoff"
            ? "Investigate repeated system handoff behavior and validate desktop routing stability."
            : alert.action === "investigate_reuse_loop"
              ? "Investigate why operators are repeatedly reopening the same execution template or learned playbook and decide whether the reuse path needs stronger guidance."
              : alert.action === "review_reuse_navigation"
                ? "Review the repeated reuse-detail navigation pattern and decide whether the current template or playbook guidance is insufficient."
                : "Review the repeated desktop navigation pattern and decide whether stronger mitigation is needed."),
        occurrence_count: alert.occurrence_count ?? 1,
        auto_escalated: alert.auto_escalated ?? false,
        deep_link:
          alert.deep_link ??
          buildDesktopDeepLink({
            kind: "inbox",
            inboxId: `inbox_${alert.alert_id}`
          }),
        created_at: alert.last_seen_at ?? alert.created_at
      })
    )
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function getGovernanceAlertFollowUp(followUpId: string) {
  return listGovernanceAlertFollowUps().find(item => item.follow_up_id === followUpId);
}

function isReuseNavigationTarget(target?: z.infer<typeof DesktopDeepLinkTargetSchema>) {
  return target?.kind === "execution_template" || target?.kind === "learned_playbook";
}

function buildGovernanceAlertAggregateKey(input: {
  sourceKind: z.infer<typeof GovernanceAlertSchema>["source_kind"];
  severity: z.infer<typeof PolicyProposalFollowUpSchema>["severity"];
  title: string;
  target?: z.infer<typeof DesktopDeepLinkTargetSchema>;
}) {
  return `${input.sourceKind}:${input.severity}:${input.title}:${input.target?.kind ?? "generic"}`;
}

function createDesktopNavigationGovernanceAlert(input: {
  risk_id: string;
  severity: z.infer<typeof PolicyProposalFollowUpSchema>["severity"];
  title: string;
  detail: string;
  recommended_action: string;
  target?: z.infer<typeof DesktopDeepLinkTargetSchema>;
}) {
  const sourceKind = isReuseNavigationTarget(input.target) ? "reuse_navigation" : "desktop_navigation";
  const aggregateKey = buildGovernanceAlertAggregateKey({
    sourceKind,
    severity: input.severity,
    title: input.title,
    target: input.target
  });
  const existing = listGovernanceAlerts().find(
    alert =>
      alert.source_kind === sourceKind &&
      (alert.aggregate_key === aggregateKey ||
        (alert.source_id === input.risk_id &&
          alert.title === input.title &&
          alert.message === input.detail))
  );
  if (existing) {
    const previousLastSeenAt = existing.last_seen_at ?? existing.created_at;
    const previousLastSeenMs = new Date(previousLastSeenAt).getTime();
    const now = nowIso();
    const updatedOccurrenceCount = (existing.occurrence_count ?? 1) + 1;
    const repeatedWithinEscalationWindow = Number.isFinite(previousLastSeenMs)
      ? Date.now() - previousLastSeenMs <= GOVERNANCE_ALERT_ESCALATION_WINDOW_MS
      : false;
    const shouldAutoEscalate =
      existing.severity !== "critical" &&
      repeatedWithinEscalationWindow &&
      updatedOccurrenceCount >= GOVERNANCE_ALERT_ESCALATION_THRESHOLD;
    const inboxId = `inbox_${existing.alert_id}`;
    const currentInboxState = store.inboxItemStates.get(inboxId)?.status ?? "open";
    const updated = GovernanceAlertSchema.parse({
      ...existing,
      source_kind: sourceKind,
      source_id: input.risk_id,
      aggregate_key: aggregateKey,
      severity: shouldAutoEscalate ? "critical" : existing.severity,
      action:
        sourceKind === "reuse_navigation"
          ? (shouldAutoEscalate || existing.severity === "critical"
            ? "investigate_reuse_loop"
            : "review_reuse_navigation")
          : (shouldAutoEscalate || existing.severity === "critical"
            ? "investigate_system_handoff"
            : "review_desktop_navigation"),
      message: input.detail,
      detail: input.detail,
      recommended_action: shouldAutoEscalate
        ? sourceKind === "reuse_navigation"
          ? "Repeated low-severity reuse-navigation risk auto-escalated. Investigate why operators keep reopening the same template or playbook details instead of progressing through the task."
          : "Repeated low-severity desktop risk auto-escalated. Investigate protocol handoff, single-instance routing, and notification entry points."
        : input.recommended_action,
      deep_link: input.target ? buildDesktopDeepLink(input.target) : existing.deep_link,
      first_seen_at: existing.first_seen_at ?? existing.created_at,
      last_seen_at: now,
      occurrence_count: updatedOccurrenceCount,
      auto_escalated: existing.auto_escalated || shouldAutoEscalate,
      escalated_at: shouldAutoEscalate ? now : existing.escalated_at,
      suppressed_repeat_count:
        currentInboxState === "resolved" || shouldAutoEscalate
          ? existing.suppressed_repeat_count ?? 0
          : (existing.suppressed_repeat_count ?? 0) + 1
    });
    store.governanceAlerts.set(updated.alert_id, updated);
    recordAudit("governance_alert.aggregated", {
      alert_id: updated.alert_id,
      source_kind: updated.source_kind,
      source_id: updated.source_id,
      severity: updated.severity,
      occurrence_count: updated.occurrence_count,
      aggregate_key: updated.aggregate_key,
      auto_escalated: updated.auto_escalated,
      suppressed_repeat_count: updated.suppressed_repeat_count
    });
    if (shouldAutoEscalate) {
      recordAudit("governance_alert.auto_escalated", {
        alert_id: updated.alert_id,
        occurrence_count: updated.occurrence_count,
        aggregate_key: updated.aggregate_key,
        escalated_at: updated.escalated_at
      });
    }
    if (currentInboxState === "resolved" || shouldAutoEscalate) {
      reopenInboxItem(
        inboxId,
        "system",
        currentInboxState === "resolved"
          ? "governance alert recurred after resolution"
          : "governance alert auto-escalated after repeated occurrences"
      );
    }
    return {
      governance_alert: updated,
      inbox_item: buildInboxItems().find(item => item.source_id === updated.alert_id)
    };
  }
  const alert = GovernanceAlertSchema.parse({
    alert_id: createEntityId("governance_alert"),
    source_kind: sourceKind,
    source_id: input.risk_id,
    aggregate_key: aggregateKey,
    severity: input.severity,
    action:
      sourceKind === "reuse_navigation"
        ? input.severity === "critical"
          ? "investigate_reuse_loop"
          : "review_reuse_navigation"
        : input.severity === "critical"
          ? "investigate_system_handoff"
          : "review_desktop_navigation",
    title: input.title,
    message: input.detail,
    detail: input.detail,
    recommended_action: input.recommended_action,
    deep_link: input.target ? buildDesktopDeepLink(input.target) : undefined,
    created_at: nowIso(),
    first_seen_at: nowIso(),
    last_seen_at: nowIso(),
    occurrence_count: 1,
    auto_escalated: false,
    suppressed_repeat_count: 0
  });
  store.governanceAlerts.set(alert.alert_id, alert);
  recordAudit("governance_alert.created", {
    alert_id: alert.alert_id,
    source_kind: alert.source_kind,
    source_id: alert.source_id,
    severity: alert.severity,
    action: alert.action
  });
  return {
    governance_alert: alert,
    inbox_item: buildInboxItems().find(item => item.source_id === alert.alert_id)
  };
}

function buildPolicyFollowUpExecutionTemplate(followUp: z.infer<typeof PolicyProposalFollowUpSchema>) {
  const executionTemplateKey = `policy_follow_up:${followUp.action}`;
  const goal =
    followUp.action === "assign_security_reviewer"
      ? `Assign the correct security reviewer and unblock the ${followUp.queue_label}.`
      : followUp.action === "escalate_queue_owner"
        ? `Escalate ownership and clear the SLA breach in the ${followUp.queue_label}.`
        : followUp.action === "request_manual_approval"
          ? `Secure manual approval coverage for the ${followUp.queue_label}.`
          : `Process pending promotions in the ${followUp.queue_label} without skipping required governance checks.`;

  return {
    executionTemplateKey,
    definitionOfDone: {
      goal,
      completion_criteria: [
        "The correct governance owner or approver is identified for the queue.",
        "The queue-specific blocking reason is documented with next actions.",
        "A follow-up artifact is ready for the operator handoff."
      ],
      acceptance_tests: [
        "Task inputs preserve queue metadata and review path context.",
        "An operator can tell who owns the next action without reopening the queue diagnostics."
      ],
      required_artifacts: ["ops_summary.md", "governance_follow_up.md"],
      approval_requirements: followUp.review_path === "security_review" ? ["security_owner_review"] : []
    }
  };
}

function buildGovernanceAlertExecutionTemplate(alert: z.infer<typeof GovernanceAlertSchema>) {
  const executionTemplateKey = alert.auto_escalated
    ? alert.source_kind === "reuse_navigation"
      ? "governance_alert:auto_escalated_reuse_investigation"
      : "governance_alert:auto_escalated_investigation"
    : alert.action === "investigate_system_handoff"
      ? "governance_alert:system_handoff_investigation"
      : alert.action === "investigate_reuse_loop"
        ? "governance_alert:reuse_loop_investigation"
        : alert.action === "review_reuse_navigation"
          ? "governance_alert:reuse_navigation_review"
          : "governance_alert:desktop_navigation_review";

  return {
    executionTemplateKey,
    definitionOfDone: {
      goal:
        alert.source_kind === "reuse_navigation"
          ? alert.auto_escalated || alert.action === "investigate_reuse_loop"
            ? "Stabilize repeated reuse-detail review loops and document why the current template or playbook guidance is insufficient."
            : "Review the repeated reuse-detail navigation anomaly and document whether the current reusable guidance needs refinement."
          : alert.auto_escalated || alert.action === "investigate_system_handoff"
            ? "Stabilize desktop handoff behavior and document why the alert escalated."
            : "Review the desktop navigation anomaly and document whether it requires a deeper systems investigation.",
      completion_criteria: [
        alert.source_kind === "reuse_navigation"
          ? "The triggering reuse-navigation pattern is documented with target kind, target identifier, and recurrence details."
          : "The triggering navigation pattern is documented with source, target, and recurrence details.",
        alert.source_kind === "reuse_navigation"
          ? "The affected reusable guidance is classified as clear, noisy, stale, or unsafe."
          : "The affected desktop entry path is classified as expected, noisy, or unsafe.",
        "A remediation recommendation or suppression rationale is captured."
      ],
      acceptance_tests: [
        "Task inputs preserve the governance alert metadata and deep-link target.",
        alert.source_kind === "reuse_navigation"
          ? "The resulting task clearly distinguishes reuse-detail review from a deeper reuse-loop investigation."
          : "The resulting task clearly distinguishes review-only work from system-handoff investigation."
      ],
      required_artifacts:
        alert.source_kind === "reuse_navigation"
          ? ["reuse_navigation_review.md", "ops_summary.md"]
          : ["desktop_navigation_incident.md", "ops_summary.md"],
      approval_requirements:
        alert.auto_escalated || alert.severity === "critical" ? ["security_owner_review"] : []
    }
  };
}

function mergeDefinitionOfDone(
  base: {
    goal?: string;
    completion_criteria?: string[];
    acceptance_tests?: string[];
    required_artifacts?: string[];
    approval_requirements?: string[];
    deadline_or_sla?: string;
  },
  reusable?: {
    goal?: string;
    completion_criteria?: string[];
    acceptance_tests?: string[];
    required_artifacts?: string[];
    approval_requirements?: string[];
    deadline_or_sla?: string;
  }
) {
  if (!reusable) {
    return base;
  }
  return {
    goal: reusable.goal ?? base.goal,
    completion_criteria: [...new Set([...(reusable.completion_criteria ?? []), ...(base.completion_criteria ?? [])])],
    acceptance_tests: [...new Set([...(reusable.acceptance_tests ?? []), ...(base.acceptance_tests ?? [])])],
    required_artifacts: [...new Set([...(reusable.required_artifacts ?? []), ...(base.required_artifacts ?? [])])],
    approval_requirements: [...new Set([...(reusable.approval_requirements ?? []), ...(base.approval_requirements ?? [])])],
    deadline_or_sla: reusable.deadline_or_sla ?? base.deadline_or_sla
  };
}

function resolveExecutionTemplateReuse(params: {
  intent: string;
  taskType: "one_off" | "long_running" | "recurring" | "scheduled";
  department: "engineering" | "qa" | "marketing" | "sales" | "hr" | "finance" | "ops" | "general";
  executionTemplateKey: string;
}) {
  const [best] = searchTaskTemplates({
    department: params.department,
    task_type: params.taskType,
    intent: params.intent,
    inputs: {
      execution_template_key: params.executionTemplateKey
    }
  });
  if (!best || best.score < 10) {
    return null;
  }
  return best;
}

function executePolicyProposalFollowUp(
  followUpId: string,
  actorRole: string
) {
  const followUp = getPolicyProposalFollowUp(followUpId);
  if (!followUp) {
    throw new Error(`Unknown policy follow-up '${followUpId}'.`);
  }

  const taskIntent =
    followUp.action === "assign_security_reviewer"
      ? `Assign a security reviewer to clear the ${followUp.queue_label}`
      : followUp.action === "escalate_queue_owner"
        ? `Escalate the owner of the ${followUp.queue_label} because proposals exceeded SLA`
        : followUp.action === "request_manual_approval"
        ? `Request manual approval to clear the ${followUp.queue_label}`
        : `Process pending promotions in the ${followUp.queue_label}`;
  const template = buildPolicyFollowUpExecutionTemplate(followUp);
  const reusableTemplate = resolveExecutionTemplateReuse({
    intent: taskIntent,
    taskType: "one_off",
    department: "ops",
    executionTemplateKey: template.executionTemplateKey
  });
  const definitionOfDone = mergeDefinitionOfDone(template.definitionOfDone, reusableTemplate?.template.definition_of_done);
  const approvalEvidence = (definitionOfDone.approval_requirements ?? []).length > 0
    ? {
        approval_actor_role: actorRole,
        approved_by: actorRole,
        approved_at: nowIso()
      }
    : {};

  const task = createLocalTask({
    intent: taskIntent,
    taskType: "one_off",
    department: "ops",
    riskLevel: followUp.severity === "critical" ? "high" : "medium",
    channel: "policy-follow-up",
    definitionOfDone,
    inputs: {
      execution_template_key: template.executionTemplateKey,
      reused_task_template_id: reusableTemplate?.template.template_id,
      reused_task_template_version: reusableTemplate?.template.version,
      ...approvalEvidence,
      follow_up_id: followUp.follow_up_id,
      follow_up_action: followUp.action,
      review_path: followUp.review_path,
      queue_label: followUp.queue_label,
      severity: followUp.severity,
      message: followUp.message,
      pending_count: followUp.pending_count,
      sla_breach_count: followUp.sla_breach_count
    }
  });

  recordAudit("skill.policy_follow_up_executed", {
    follow_up_id: followUp.follow_up_id,
    action: followUp.action,
    review_path: followUp.review_path,
    severity: followUp.severity,
    actor_role: actorRole,
    task_id: task.task_id
  });
  updateInboxItemState(`inbox_${followUp.follow_up_id}`, "resolved", actorRole);

  return {
    follow_up: followUp,
    task
  };
}

function executeGovernanceAlert(
  alertId: string,
  actorRole: string
) {
  const alert = store.governanceAlerts.get(alertId);
  if (!alert) {
    throw new Error(`Unknown governance alert '${alertId}'.`);
  }
  const template = buildGovernanceAlertExecutionTemplate(alert);
  const taskIntent = `${alert.title}. ${alert.recommended_action ?? "Review and stabilize the affected desktop workflow."}`;
  const reuseTarget = alert.source_kind === "reuse_navigation" ? parseDesktopDeepLink(alert.deep_link) : null;
  const reusableTemplate = resolveExecutionTemplateReuse({
    intent: taskIntent,
    taskType: "one_off",
    department: "ops",
    executionTemplateKey: template.executionTemplateKey
  });
  const definitionOfDone = mergeDefinitionOfDone(template.definitionOfDone, reusableTemplate?.template.definition_of_done);
  const approvalEvidence = (definitionOfDone.approval_requirements ?? []).length > 0
    ? {
        approval_actor_role: actorRole,
        approved_by: actorRole,
        approved_at: nowIso()
      }
    : {};
  const task = createLocalTask({
    intent: taskIntent,
    taskType: "one_off",
    department: "ops",
    riskLevel: alert.severity === "critical" ? "high" : "medium",
    channel: "governance-alert",
    definitionOfDone,
    inputs: {
      execution_template_key: template.executionTemplateKey,
      reused_task_template_id: reusableTemplate?.template.template_id,
      reused_task_template_version: reusableTemplate?.template.version,
      ...approvalEvidence,
      alert_id: alert.alert_id,
      source_kind: alert.source_kind,
      source_id: alert.source_id,
      severity: alert.severity,
      action: alert.action,
      title: alert.title,
      detail: alert.detail ?? alert.message,
      recommended_action: alert.recommended_action,
      deep_link: alert.deep_link,
      reuse_target_kind:
        reuseTarget?.kind === "execution_template"
          ? "execution_template"
          : reuseTarget?.kind === "learned_playbook"
            ? "learned_playbook"
            : undefined,
      reuse_target_id:
        reuseTarget?.kind === "execution_template"
          ? reuseTarget.templateId
          : reuseTarget?.kind === "learned_playbook"
            ? reuseTarget.playbookId
            : undefined,
      reuse_target_task_id: reuseTarget?.taskId,
      reuse_target_deep_link: reuseTarget ? buildDesktopDeepLink(reuseTarget) : undefined,
      suggested_learning_action:
        reuseTarget?.kind === "execution_template"
          ? "refine_execution_template"
          : reuseTarget?.kind === "learned_playbook"
            ? "refine_learned_playbook"
            : undefined
    }
  });
  recordAudit("governance_alert.executed", {
    alert_id: alert.alert_id,
    actor_role: actorRole,
    task_id: task.task_id,
    severity: alert.severity,
    action: alert.action,
    execution_template_key: template.executionTemplateKey,
    reused_task_template_id: reusableTemplate?.template.template_id
  });
  updateInboxItemState(`inbox_${alert.alert_id}`, "resolved", actorRole);
  return {
    governance_alert: alert,
    task
  };
}

function executeGovernanceAlertFollowUp(
  followUpId: string,
  actorRole: string
) {
  const followUp = getGovernanceAlertFollowUp(followUpId);
  if (!followUp) {
    throw new Error(`Unknown governance alert follow-up '${followUpId}'.`);
  }
  const payload = executeGovernanceAlert(followUp.alert_id, actorRole);
  recordAudit("governance_alert.follow_up_executed", {
    follow_up_id: followUp.follow_up_id,
    alert_id: followUp.alert_id,
    actor_role: actorRole,
    task_id: payload.task.task_id,
    severity: followUp.severity,
    action: followUp.action
  });
  return {
    follow_up: followUp,
    ...payload
  };
}

function executeInboxItem(
  inboxId: string,
  actorRole: string
) {
  const inboxItem = buildInboxItems().find(item => item.inbox_id === inboxId);
  if (!inboxItem) {
    throw new Error(`Unknown inbox item '${inboxId}'.`);
  }
  if (inboxItem.kind === "policy_follow_up") {
    if (!inboxItem.source_id) {
      throw new Error(`Inbox item '${inboxId}' is missing a follow-up source id.`);
    }
    return executePolicyProposalFollowUp(inboxItem.source_id, actorRole);
  }
  if (inboxItem.kind === "governance_alert") {
    if (!inboxItem.source_id) {
      throw new Error(`Inbox item '${inboxId}' is missing a governance alert source id.`);
    }
    return executeGovernanceAlert(inboxItem.source_id, actorRole);
  }
  throw new Error(`Inbox item '${inboxId}' cannot be executed automatically.`);
}

function getPolicyProposalReviewRoles(
  policy: ReturnType<typeof getEffectiveSkillPolicyDiagnostics>,
  reviewPath: z.infer<typeof SkillPolicyProposalSchema>["review_path"]
) {
  if (reviewPath === "security_review") {
    return policy.roles.policy_security_review_roles;
  }
  if (reviewPath === "manual_approval") {
    return policy.roles.policy_manual_approval_roles;
  }
  return policy.roles.policy_approve_roles;
}

function getPolicyProposal(proposalId: string) {
  return store.skillPolicyProposals.get(proposalId);
}

function persistPolicyProposal(proposal: z.infer<typeof SkillPolicyProposalSchema>) {
  store.skillPolicyProposals.set(proposal.proposal_id, proposal);
  return proposal;
}

function listPolicyReleaseHistory(scope?: z.infer<typeof SkillPolicyScopeNameSchema>) {
  const releaseActions = new Set([
    "skill.policy_proposal_applied",
    "skill.policy_bundle_imported",
    "skill.policy_bundle_exported",
    "skill.policy_scope_rolled_back"
  ]);
  return [...store.audits.values()]
    .filter(audit => releaseActions.has(audit.action))
    .filter(audit => (scope ? audit.payload?.target_scope === scope || audit.payload?.scope === scope : true))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function approvePolicyProposalRecord(
  proposalId: string,
  actorRole: string,
  approvedBy?: string,
  approvalNote?: string
) {
  const proposal = getPolicyProposal(proposalId);
  if (!proposal) {
    throw new Error(`Unknown policy proposal '${proposalId}'.`);
  }
  if (proposal.status !== "pending_review") {
    throw new Error(`Proposal '${proposalId}' is already ${proposal.status}.`);
  }
  const updated = persistPolicyProposal(
    SkillPolicyProposalSchema.parse({
      ...proposal,
      status: "approved",
      approved_by: approvedBy ?? actorRole,
      approved_at: nowIso(),
      approval_note: approvalNote
    })
  );
  recordAudit("skill.policy_proposal_approved", {
    proposal_id: proposalId,
    target_scope: updated.target_scope,
    actor_role: actorRole
  });
  return updated;
}

function rejectPolicyProposalRecord(
  proposalId: string,
  actorRole: string,
  rejectedBy?: string,
  rejectionReason?: string
) {
  const proposal = getPolicyProposal(proposalId);
  if (!proposal) {
    throw new Error(`Unknown policy proposal '${proposalId}'.`);
  }
  if (proposal.status !== "pending_review") {
    throw new Error(`Proposal '${proposalId}' is already ${proposal.status}.`);
  }
  const updated = persistPolicyProposal(
    SkillPolicyProposalSchema.parse({
      ...proposal,
      status: "rejected",
      rejected_by: rejectedBy ?? actorRole,
      rejected_at: nowIso(),
      rejection_reason: rejectionReason
    })
  );
  recordAudit("skill.policy_proposal_rejected", {
    proposal_id: proposalId,
    target_scope: updated.target_scope,
    actor_role: actorRole
  });
  return updated;
}

function applyPolicyProposalRecord(
  proposalId: string,
  actorRole: string,
  appliedBy?: string
) {
  const proposal = getPolicyProposal(proposalId);
  if (!proposal) {
    throw new Error(`Unknown policy proposal '${proposalId}'.`);
  }
  if (proposal.status !== "approved") {
    throw new Error(`Proposal '${proposalId}' must be approved before apply.`);
  }
  const before = getEffectiveSkillPolicyDiagnostics();
  const resolvedPath = writePolicyScopeFile(proposal.target_scope, proposal.path ?? "", proposal.persisted_config);
  const after = getEffectiveSkillPolicyDiagnostics();
  const updated = persistPolicyProposal(
    SkillPolicyProposalSchema.parse({
      ...proposal,
      path: resolvedPath,
      status: "applied",
      applied_by: appliedBy ?? actorRole,
      applied_at: nowIso(),
      effective_preview: after,
      changed_fields: computePolicyDiff(before, after)
    })
  );
  recordAudit("skill.policy_proposal_applied", {
    proposal_id: proposalId,
    kind: updated.kind,
    source_scope: updated.source_scope,
    target_scope: updated.target_scope,
    actor_role: actorRole,
    changed_fields: updated.changed_fields
  });
  return updated;
}

function createPolicyProposal(input: {
  kind: z.infer<typeof SkillPolicyProposalSchema>["kind"];
  review_path?: z.infer<typeof SkillPolicyProposalSchema>["review_path"];
  advisory_recommended_action?: z.infer<typeof SkillPolicyProposalSchema>["advisory_recommended_action"];
  advisory_reasons?: string[];
  suggested_template_kind?: z.infer<typeof SkillPolicyProposalSchema>["suggested_template_kind"];
  source_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
  target_scope: z.infer<typeof SkillPolicyScopeNameSchema>;
  path?: string;
  rationale?: string;
  requested_by?: string;
  persisted_config: Record<string, unknown>;
  effective_preview: typeof DEFAULT_SKILL_POLICY;
  changed_fields: Array<{ field: string; before?: unknown; after?: unknown }>;
}) {
  const proposal = SkillPolicyProposalSchema.parse({
    proposal_id: createEntityId("policy_proposal"),
    kind: input.kind,
    status: "pending_review",
    review_path: input.review_path ?? "standard",
    advisory_recommended_action: input.advisory_recommended_action,
    advisory_reasons: input.advisory_reasons ?? [],
    suggested_template_kind: input.suggested_template_kind,
    source_scope: input.source_scope,
    target_scope: input.target_scope,
    path: input.path,
    rationale: input.rationale,
    requested_by: input.requested_by,
    requested_at: nowIso(),
    persisted_config: input.persisted_config,
    effective_preview: input.effective_preview,
    changed_fields: input.changed_fields
  });
  persistPolicyProposal(proposal);
  recordAudit("skill.policy_proposal_created", {
    proposal_id: proposal.proposal_id,
    kind: proposal.kind,
    source_scope: proposal.source_scope,
    target_scope: proposal.target_scope,
    changed_fields: proposal.changed_fields.map(item => item.field)
  });
  return proposal;
}

function getResolvedPolicyPathForScope(scope: z.infer<typeof SkillPolicyScopeNameSchema>, explicitPath?: string) {
  if (explicitPath) {
    return requireAbsolutePath(explicitPath);
  }
  const configured = getConfiguredSkillPolicyPath(scope);
  if (configured) {
    return requireAbsolutePath(configured);
  }
  return requireAbsolutePath(resolve(process.cwd(), ".apex", `skill-policy.${scope}.json`));
}

function writePolicyScopeFile(scope: z.infer<typeof SkillPolicyScopeNameSchema>, path: string, persistedConfig: Record<string, unknown>) {
  const resolvedPath = getResolvedPolicyPathForScope(scope, path);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(persistedConfig, null, 2)}\n`, "utf8");
  return resolvedPath;
}

function resolveTargetScopePath(scope: z.infer<typeof SkillPolicyScopeNameSchema>, explicitPath?: string) {
  return explicitPath ?? getConfiguredSkillPolicyPath(scope);
}

function isAllowedPromotionTransition(
  sourceScope: z.infer<typeof SkillPolicyScopeNameSchema>,
  targetScope: z.infer<typeof SkillPolicyScopeNameSchema>,
  policy = getEffectiveSkillPolicyDiagnostics()
) {
  const transition = `${sourceScope}>${targetScope}`;
  return policy.environments.promotion_pipeline.includes(transition);
}

function requireRole(role: string | undefined, allowedRoles: string[], operation: string) {
  const normalizedRole = (role ?? "viewer").trim() || "viewer";
  if (!allowedRoles.includes(normalizedRole)) {
    throw new Error(`Role '${normalizedRole}' is not allowed to perform ${operation}.`);
  }
  return normalizedRole;
}

function classifyRequestBucket(method: string, url: string): "read" | "mutation" {
  if (method === "GET" || url.endsWith("/permissions/check")) {
    return "read";
  }
  return "mutation";
}

function checkRateLimit(key: string, limit: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = requestWindows.get(key);
  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOWS_MS) {
    requestWindows.set(key, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((RATE_LIMIT_WINDOWS_MS - (now - existing.windowStart)) / 1000))
    };
  }
  existing.count += 1;
  requestWindows.set(key, existing);
  return { allowed: true, retryAfterSec: 0 };
}

async function fetchToolGatewayJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TOOL_GATEWAY_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : `Tool gateway request failed: ${response.status}`);
  }
  return body as T;
}

function requireAbsolutePath(pathValue: string): string {
  if (!isAbsolute(pathValue)) {
    throw new Error("path must be absolute");
  }
  return resolve(pathValue);
}

async function withTaskMutationLock<T>(taskId: string, reply: any, operation: string, fn: () => Promise<T> | T): Promise<T | ReturnType<typeof reply.send>> {
  if (taskMutationLocks.has(taskId)) {
    log("warn", "local-control-plane task mutation blocked by in-flight operation", { task_id: taskId, operation });
    return reply.code(409).send({
      message: `Task ${taskId} already has an in-flight mutation. Retry after the current ${operation} completes.`
    });
  }
  taskMutationLocks.add(taskId);
  try {
    return await fn();
  } finally {
    taskMutationLocks.delete(taskId);
  }
}

app.addHook("onRequest", async (request, reply) => {
  const bucket = classifyRequestBucket(request.method, request.url);
  const limit = bucket === "read" ? READ_LIMIT_PER_WINDOW : MUTATION_LIMIT_PER_WINDOW;
  const clientId = request.ip || "local";
  const rateLimit = checkRateLimit(`${clientId}:${bucket}`, limit);
  if (!rateLimit.allowed) {
    reply.header("Retry-After", String(rateLimit.retryAfterSec));
    log("warn", "local-control-plane request rate limited", {
      client_id: clientId,
      bucket,
      method: request.method,
      url: request.url
    });
    return reply.code(429).send({
      message: `Rate limit exceeded for ${bucket} requests. Retry in ${rateLimit.retryAfterSec} seconds.`
    });
  }
});

app.get("/health", async () => ({ status: "ok", service: "local-control-plane" }));

app.post("/api/local/bootstrap-demo", async () => {
  return { tasks: bootstrapLocalDemoData() };
});

app.get("/api/local/dashboard", async () => {
  return {
    ...getLocalDashboard(),
    inbox_summary: buildInboxSummary(),
    governance_alert_summary: buildGovernanceAlertSummary()
  };
});

app.post("/api/local/navigation/deep-link", async (request, reply) => {
  try {
    const body = DesktopDeepLinkTargetSchema.parse(request.body ?? {});
    return {
      target: body,
      deep_link: buildDesktopDeepLink(body)
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.get("/api/local/system/state-backend", async () => {
  return getLocalDashboard().stateBackend;
});

app.get("/api/local/agent-team/launchers", async () => {
  return {
    items: getLocalAgentTeamLauncherCatalog()
  };
});

app.get("/api/local/agent-team/launchers/status", async () => {
  return {
    items: getLocalAgentTeamLauncherStatuses()
  };
});

app.get("/api/local/agent-team/launcher-drivers", async () => {
  return {
    items: getLocalAgentTeamLauncherDriverCatalog()
  };
});

app.get("/api/local/agent-team/launcher-drivers/status", async () => {
  return {
    items: getLocalAgentTeamLauncherDriverStatuses()
  };
});

app.get("/api/local/agent-team/launcher-backend-adapters", async () => {
  return {
    items: getLocalAgentTeamLauncherBackendAdapterCatalog()
  };
});

app.get("/api/local/agent-team/launcher-backend-adapters/status", async () => {
  return {
    items: getLocalAgentTeamLauncherBackendAdapterStatuses()
  };
});

app.get("/api/local/agent-team/runner-backend-adapters", async () => {
  return {
    items: getLocalAgentTeamRunnerBackendAdapterCatalog()
  };
});

app.get("/api/local/agent-team/runner-backend-adapters/status", async () => {
  return {
    items: getLocalAgentTeamRunnerBackendAdapterStatuses()
  };
});

app.get("/api/local/tasks", async () => {
  return { tasks: listTasks() };
});

app.post("/api/local/tasks", async request => {
  const body = (request.body ?? {}) as {
    intent?: string;
    taskType?: "one_off" | "long_running" | "recurring" | "scheduled";
    department?: "engineering" | "qa" | "marketing" | "sales" | "hr" | "finance" | "ops" | "general";
    riskLevel?: "low" | "medium" | "high" | "critical";
    inputs?: Record<string, unknown>;
  };
  const reasons = [
    ...detectTextSecuritySignals(body.intent ?? "").reasons,
    ...detectObjectSecuritySignals(body.inputs).reasons
  ];
  if (reasons.length > 0) {
    log("warn", "local task creation rejected by security preflight", { reasons });
    return {
      rejected: true,
      reasons: [...new Set(reasons)],
      message: "Task creation blocked because the request matched prompt-injection or privilege-bypass patterns."
    };
  }
  const task = createLocalTask({
    intent: body.intent ?? "Untitled desktop task",
    taskType: body.taskType,
    department: body.department,
    riskLevel: body.riskLevel,
    inputs: body.inputs
  });
  return { task };
});

app.get("/api/local/tasks/:taskId/workspace", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return getLocalTaskWorkspace(taskId);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/api/local/tasks/:taskId/agent-team", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return getLocalTaskWorkspace(taskId).agentTeam;
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/sessions/:sessionId/resume", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const sessionId = (request.params as { sessionId: string }).sessionId;
  const body = (request.body ?? {}) as {
    actor_role?: string;
    reason?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-resume", () => ({
      request: requestLocalSubagentResume(taskId, sessionId, body.actor_role ?? "operator", body.reason)
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/resume-requests/:requestId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { requestId, action } = request.params as {
    requestId: string;
    action: "accept" | "complete" | "reject";
  };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    if (!["accept", "complete", "reject"].includes(action)) {
      return reply.code(400).send({ message: `Unsupported resume action: ${action}` });
    }
    return withTaskMutationLock(taskId, reply, `agent-team-resume-${action}`, () => ({
      request: updateLocalSubagentResumeRequest(taskId, requestId, body.actor_role ?? "operator", action, body.note)
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/resume-packages/:packageId/apply", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { packageId } = request.params as { packageId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-resume-package-apply", () => ({
      package: applyLocalSubagentResumePackage(taskId, packageId, body.actor_role ?? "operator", body.note)
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/execution-runs/:executionRunId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { executionRunId, action } = request.params as {
    executionRunId: string;
    action: "complete" | "fail";
  };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    if (!["complete", "fail"].includes(action)) {
      return reply.code(400).send({ message: `Unsupported execution run action: ${action}` });
    }
    return withTaskMutationLock(taskId, reply, `agent-team-execution-run-${action}`, () => ({
      execution_run: updateLocalSubagentExecutionRun(taskId, executionRunId, body.actor_role ?? "operator", action, body.note)
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/execution-runs/:executionRunId/bind", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { executionRunId } = request.params as { executionRunId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    runtime_kind?: "host_guarded" | "sandbox_runner" | "cloud_runner";
    sandbox_profile?: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
    runtime_locator?: string;
    launcher_kind?: "worker_run" | "sandbox_runner" | "cloud_runner";
    launcher_driver_id?: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    launcher_locator?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-execution-run-bind", () => ({
      runtime_binding: bindLocalSubagentExecutionRun(taskId, executionRunId, body.actor_role ?? "operator", {
        runtime_kind: body.runtime_kind,
        sandbox_profile: body.sandbox_profile,
        runtime_locator: body.runtime_locator,
        launcher_kind: body.launcher_kind,
        launcher_driver_id: body.launcher_driver_id,
        launcher_locator: body.launcher_locator,
        note: body.note
      })
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-bindings/:bindingId/release", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { bindingId } = request.params as { bindingId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-binding-release", () => ({
      runtime_binding: releaseLocalSubagentRuntimeBinding(taskId, bindingId, body.actor_role ?? "operator", body.note)
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-instances/:instanceId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { instanceId } = request.params as { instanceId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-instance-heartbeat", () => ({
      runtime_instance: heartbeatLocalSubagentRuntimeInstance(
        taskId,
        instanceId,
        body.actor_role ?? "delegated_runtime",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-instances/:instanceId/launch", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { instanceId } = request.params as { instanceId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
    launch_locator?: string;
    runtime_locator?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-instance-launch", () => ({
      launch_receipt: launchLocalSubagentRuntimeInstance(
        taskId,
        instanceId,
        body.actor_role ?? "delegated_runtime_launcher",
        {
          note: body.note,
          launch_locator: body.launch_locator,
          runtime_locator: body.runtime_locator
        }
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-launch-receipts/:receiptId/start", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { receiptId } = request.params as { receiptId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-adapter-start", () => ({
      adapter_run: startLocalSubagentRuntimeAdapterRun(
        taskId,
        receiptId,
        body.actor_role ?? "delegated_runtime_adapter",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-launch-receipts/:receiptId/consume", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { receiptId } = request.params as { receiptId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-launch-receipt-consume", () =>
      consumeLocalSubagentRuntimeLaunchReceipt(taskId, receiptId, body.actor_role ?? "delegated_runtime_launcher", body.note)
    );
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-adapter-runs/:adapterRunId/acquire-runner-backend-lease", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { adapterRunId } = request.params as { adapterRunId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
    resource_locator?: string;
    execution_locator?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-backend-lease-acquire", () => ({
      runner_backend_lease: acquireLocalSubagentRuntimeRunnerBackendLease(
        taskId,
        adapterRunId,
        body.actor_role ?? "delegated_runtime_runner_backend",
        {
          note: body.note,
          resource_locator: body.resource_locator,
          execution_locator: body.execution_locator
        }
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-backend-leases/:leaseId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { leaseId, action } = request.params as { leaseId: string; action: string };
  if (action !== "release" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runner backend lease action '${action}'.` });
  }
  const body = (request.body ?? {}) as { actor_role?: string; note?: string };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-backend-lease-finalize", () => ({
      runner_backend_lease: releaseLocalSubagentRuntimeRunnerBackendLease(
        taskId,
        leaseId,
        body.actor_role ?? "delegated_runtime_runner_backend",
        {
          action,
          note: body.note
        }
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-adapter-runs/:adapterRunId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { adapterRunId } = request.params as { adapterRunId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-adapter-heartbeat", () => ({
      adapter_run: heartbeatLocalSubagentRuntimeAdapterRun(
        taskId,
        adapterRunId,
        body.actor_role ?? "delegated_runtime_adapter",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-adapter-runs/:adapterRunId/execute", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { adapterRunId } = request.params as { taskId: string; adapterRunId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-backend-start", () => ({
      backend_execution: startLocalSubagentRuntimeBackendExecution(
        taskId,
        adapterRunId,
        body.actor_role ?? "delegated_runtime_backend",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-backend-executions/:backendExecutionId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { backendExecutionId } = request.params as { taskId: string; backendExecutionId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-backend-heartbeat", () => ({
      backend_execution: heartbeatLocalSubagentRuntimeBackendExecution(
        taskId,
        backendExecutionId,
        body.actor_role ?? "delegated_runtime_backend",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-backend-executions/:backendExecutionId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { backendExecutionId, action } = request.params as { taskId: string; backendExecutionId: string; action: string };
  if (action !== "complete" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runtime backend execution action: ${action}` });
  }
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-backend-finalize", () => ({
      backend_execution: finalizeLocalSubagentRuntimeBackendExecution(
        taskId,
        backendExecutionId,
        body.actor_role ?? "delegated_runtime_backend",
        action,
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-backend-executions/:backendExecutionId/start-driver", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { backendExecutionId } = request.params as { taskId: string; backendExecutionId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-driver-start", () => ({
      driver_run: startLocalSubagentRuntimeDriverRun(
        taskId,
        backendExecutionId,
        body.actor_role ?? "delegated_runtime_driver",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-driver-runs/:driverRunId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { driverRunId } = request.params as { taskId: string; driverRunId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-driver-heartbeat", () => ({
      driver_run: heartbeatLocalSubagentRuntimeDriverRun(
        taskId,
        driverRunId,
        body.actor_role ?? "delegated_runtime_driver",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-driver-runs/:driverRunId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { driverRunId, action } = request.params as { taskId: string; driverRunId: string; action: string };
  if (action !== "complete" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runtime driver action: ${action}` });
  }
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-driver-finalize", () => ({
      driver_run: finalizeLocalSubagentRuntimeDriverRun(
        taskId,
        driverRunId,
        body.actor_role ?? "delegated_runtime_driver",
        action,
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-driver-runs/:driverRunId/attach-runner", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { driverRunId } = request.params as { taskId: string; driverRunId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    runner_kind?: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
    runner_locator?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-attach", () => ({
      runner_handle: attachLocalSubagentRuntimeRunnerHandle(taskId, driverRunId, body.actor_role ?? "delegated_runtime_runner", {
        runner_kind: body.runner_kind,
        runner_locator: body.runner_locator,
        note: body.note
      })
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-driver-runs/:driverRunId/runner-handles/:runnerHandleId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerHandleId } = request.params as { taskId: string; driverRunId: string; runnerHandleId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-heartbeat", () => ({
      runner_handle: heartbeatLocalSubagentRuntimeRunnerHandle(
        taskId,
        runnerHandleId,
        body.actor_role ?? "delegated_runtime_runner",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-driver-runs/:driverRunId/runner-handles/:runnerHandleId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerHandleId, action } = request.params as {
    taskId: string;
    driverRunId: string;
    runnerHandleId: string;
    action: string;
  };
  if (action !== "release" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runtime runner action: ${action}` });
  }
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-finalize", () => ({
      runner_handle: finalizeLocalSubagentRuntimeRunnerHandle(
        taskId,
        runnerHandleId,
        body.actor_role ?? "delegated_runtime_runner",
        action,
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-handles/:runnerHandleId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerHandleId } = request.params as { taskId: string; runnerHandleId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-heartbeat", () => ({
      runner_handle: heartbeatLocalSubagentRuntimeRunnerHandle(
        taskId,
        runnerHandleId,
        body.actor_role ?? "delegated_runtime_runner",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-handles/:runnerHandleId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerHandleId, action } = request.params as { taskId: string; runnerHandleId: string; action: string };
  if (action !== "release" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runtime runner action: ${action}` });
  }
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-finalize", () => ({
      runner_handle: finalizeLocalSubagentRuntimeRunnerHandle(
        taskId,
        runnerHandleId,
        body.actor_role ?? "delegated_runtime_runner",
        action,
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-handles/:runnerHandleId/start-execution", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerHandleId } = request.params as { taskId: string; runnerHandleId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    execution_locator?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-execution-start", () => ({
      runner_execution: startLocalSubagentRuntimeRunnerExecution(taskId, runnerHandleId, body.actor_role ?? "delegated_runtime_runner_execution", {
        execution_locator: body.execution_locator,
        note: body.note
      })
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-executions/:runnerExecutionId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerExecutionId } = request.params as { taskId: string; runnerExecutionId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-execution-heartbeat", () => ({
      runner_execution: heartbeatLocalSubagentRuntimeRunnerExecution(
        taskId,
        runnerExecutionId,
        body.actor_role ?? "delegated_runtime_runner_execution",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-executions/:runnerExecutionId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerExecutionId, action } = request.params as { taskId: string; runnerExecutionId: string; action: string };
  if (action !== "complete" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runtime runner execution action: ${action}` });
  }
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-execution-finalize", () => ({
      runner_execution: finalizeLocalSubagentRuntimeRunnerExecution(
        taskId,
        runnerExecutionId,
        body.actor_role ?? "delegated_runtime_runner_execution",
        action,
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-executions/:runnerExecutionId/start-job", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerExecutionId } = request.params as { taskId: string; runnerExecutionId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    job_locator?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-job-start", () => ({
      runner_job: startLocalSubagentRuntimeRunnerJob(taskId, runnerExecutionId, body.actor_role ?? "delegated_runtime_runner_job", {
        job_locator: body.job_locator,
        note: body.note
      })
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-jobs/:runnerJobId/heartbeat", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerJobId } = request.params as { taskId: string; runnerJobId: string };
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-job-heartbeat", () => ({
      runner_job: heartbeatLocalSubagentRuntimeRunnerJob(
        taskId,
        runnerJobId,
        body.actor_role ?? "delegated_runtime_runner_job",
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-runner-jobs/:runnerJobId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { runnerJobId, action } = request.params as { taskId: string; runnerJobId: string; action: string };
  if (action !== "complete" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runtime runner job action: ${action}` });
  }
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-runner-job-finalize", () => ({
      runner_job: finalizeLocalSubagentRuntimeRunnerJob(
        taskId,
        runnerJobId,
        body.actor_role ?? "delegated_runtime_runner_job",
        action,
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/agent-team/runtime-adapter-runs/:adapterRunId/:action", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { adapterRunId, action } = request.params as { taskId: string; adapterRunId: string; action: string };
  if (action !== "complete" && action !== "fail") {
    return reply.code(400).send({ message: `Unsupported runtime adapter action: ${action}` });
  }
  const body = (request.body ?? {}) as {
    actor_role?: string;
    note?: string;
  };
  try {
    return withTaskMutationLock(taskId, reply, "agent-team-runtime-adapter-finalize", () => ({
      adapter_run: finalizeLocalSubagentRuntimeAdapterRun(
        taskId,
        adapterRunId,
        body.actor_role ?? "delegated_runtime_adapter",
        action,
        body.note
      )
    }));
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.get("/api/local/tasks/:taskId/agent-team/runtime-instances/:instanceId/launch-spec", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { instanceId } = request.params as { instanceId: string };
  try {
    const launchSpec = getLocalSubagentRuntimeLaunchSpec(taskId, instanceId);
    if (!launchSpec) {
      return reply.code(404).send({ message: `Runtime launch spec for ${instanceId} not found.` });
    }
    return { launch_spec: launchSpec };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/prepare", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return withTaskMutationLock(taskId, reply, "prepare", () => prepareLocalTask(taskId));
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/run", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return withTaskMutationLock(taskId, reply, "run", () => runTaskEndToEnd(taskId));
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/verify", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return withTaskMutationLock(taskId, reply, "verify", () => verifyLocalTask(taskId));
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/stop", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return withTaskMutationLock(taskId, reply, "stop", () => ({ task: stopLocalTask(taskId) }));
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/resume", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return withTaskMutationLock(taskId, reply, "resume", () => ({ task: resumeLocalTask(taskId) }));
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/permissions/check", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as {
    scope?: Parameters<typeof evaluateLocalPermission>[1];
    detail?: string;
  };
  try {
    return evaluateLocalPermission(taskId, body.scope ?? "local_files.read", body.detail);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/capabilities/resolve", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return { task_id: taskId, resolutions: resolveLocalTaskCapabilities(taskId) };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/api/local/capabilities/search", async request => {
  const query = request.query as { q?: string; kind?: string; tags?: string };
  const kinds = query.kind
    ? query.kind.split(",").map(item => item.trim()).filter(Boolean) as Parameters<typeof searchLocalCapabilities>[0]["kinds"]
    : undefined;
  const tags = query.tags ? query.tags.split(",").map(item => item.trim()).filter(Boolean) : undefined;
  return {
    total: getCapabilityCatalogSnapshot().length,
    items: searchLocalCapabilities({
      query: query.q,
      kinds,
      tags
    })
  };
});

app.get("/api/local/capabilities/catalog", async () => {
  return { items: getCapabilityCatalogSnapshot() };
});

app.get("/api/local/tasks/:taskId/capabilities/score-breakdowns", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  try {
    const { getCapabilityScoreBreakdowns } = await import("@apex/shared-runtime");
    const breakdowns = getCapabilityScoreBreakdowns(taskId);
    return { scoreBreakdowns: breakdowns };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/skills", async request => {
  const query = request.query as {
    q?: string;
    tag?: string;
    source?: "internal" | "openclaw" | "claude" | "openai";
    status?: "review_required" | "active" | "disabled";
  };
  const tags = query.tag ? query.tag.split(",").map(item => item.trim()).filter(Boolean) : undefined;
  if (query.q || query.source || (tags?.length ?? 0) > 0) {
    return {
      items: searchCanonicalSkills({
        query: query.q,
        tags,
        source: query.source,
        status: query.status
      })
    };
  }
  return {
    items: query.status
      ? listCanonicalSkills().filter(skill => skill.status === query.status)
      : listCanonicalSkills()
  };
});

app.get("/api/local/skills/:skillId", async (request, reply) => {
  const { skillId } = request.params as { skillId: string };
  const skill = getCanonicalSkill(skillId);
  if (!skill) {
    return reply.code(404).send({ message: `Canonical skill not found: ${skillId}` });
  }
  return { skill };
});

app.get("/api/local/skills/review-queue", async () => {
  return { items: listCanonicalSkillReviewQueue() };
});

app.get("/api/local/skills/policy", async () => {
  return getEffectiveSkillPolicyDiagnostics();
});

app.get("/api/local/skills/policy/scopes", async () => {
  return {
    items: listSkillPolicyScopes()
  };
});

app.get("/api/local/skills/policy/environment-snapshots", async () => {
  return {
    items: buildPolicyEnvironmentSnapshots()
  };
});

app.get("/api/local/skills/policy/audits", async () => {
  return {
    items: listPolicyScopeAudits()
  };
});

app.get("/api/local/skills/policy/proposals", async request => {
  const query = request.query as {
    status?: z.infer<typeof SkillPolicyProposalSchema>["status"];
    target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
    review_path?: z.infer<typeof SkillPolicyProposalSchema>["review_path"];
  };
  return {
    items: listPolicyProposals(query.status).filter(item =>
      (query.target_scope ? item.target_scope === query.target_scope : true) &&
      (query.review_path ? item.review_path === query.review_path : true)
    )
    };
  });

app.get("/api/local/skills/policy/proposals/queues", async request => {
  const query = request.query as {
    status?: z.infer<typeof SkillPolicyProposalSchema>["status"];
    target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
  };
  const queues = listPolicyProposalQueues({
    status: query.status,
    target_scope: query.target_scope
  });
  return {
    total: queues.reduce((sum, queue) => sum + queue.count, 0),
    queues
  };
});

app.get("/api/local/skills/policy/proposals/follow-ups", async request => {
  const query = request.query as {
    status?: z.infer<typeof SkillPolicyProposalSchema>["status"];
    target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
  };
  const items = listPolicyProposalFollowUps({
    status: query.status,
    target_scope: query.target_scope
  });
  return {
    total: items.length,
    items
  };
});

app.get("/api/local/inbox", async request => {
  const query = request.query as {
    severity?: z.infer<typeof InboxItemSchema>["severity"];
    kind?: z.infer<typeof InboxItemSchema>["kind"];
    status?: "new" | "acknowledged";
  };
  const items = listInboxItems({
    severity: query.severity,
    kind: query.kind,
    status: query.status
  });
  return {
    total: items.length,
    summary: buildInboxSummary(),
    items
  };
});

app.post("/api/local/governance-alerts/desktop-navigation", async (request, reply) => {
  try {
    const body = z.object({
      risk_id: z.string(),
      severity: z.enum(["warning", "critical"]),
      title: z.string().min(1),
      detail: z.string().min(1),
      recommended_action: z.string().min(1),
      target: DesktopDeepLinkTargetSchema.optional()
    }).parse(request.body ?? {});
    return createDesktopNavigationGovernanceAlert(body);
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.get("/api/local/governance-alerts", async request => {
  const query = z.object({
    severity: z.enum(["info", "warning", "critical"]).optional(),
    status: z.enum(["new", "acknowledged", "resolved"]).optional()
  }).parse(request.query ?? {});
  const items = listGovernanceAlertsWithState(query);
  return {
    total: items.length,
    summary: summarizeGovernanceAlerts(),
    top_repeated: getGovernanceAlertTopRepeated(),
    items
  };
});

app.get("/api/local/governance-alerts/follow-ups", async request => {
  const query = z.object({
    severity: z.enum(["info", "warning", "critical"]).optional(),
    status: z.enum(["new", "acknowledged", "resolved"]).optional()
  }).parse(request.query ?? {});
  const items = listGovernanceAlertFollowUps(query);
  return {
    total: items.length,
    items
  };
});

app.post("/api/local/governance-alerts/follow-ups/:followUpId/execute", async (request, reply) => {
  try {
    const { followUpId } = request.params as { followUpId: string };
    const body = z.object({
      actor_role: z.string().default("admin")
    }).parse(request.body ?? {});
    return executeGovernanceAlertFollowUp(followUpId, body.actor_role);
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown governance alert follow-up") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/inbox/:inboxId/ack", async (request, reply) => {
  try {
    const { inboxId } = request.params as { inboxId: string };
    const body = (request.body ?? {}) as { actor_role?: string };
    const actorRole = body.actor_role?.trim();
    if (!actorRole) {
      return reply.code(400).send({ message: "actor_role is required" });
    }
    return {
      state: updateInboxItemState(inboxId, "acknowledged", actorRole)
    };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown inbox item") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/inbox/:inboxId/execute", async (request, reply) => {
  try {
    const { inboxId } = request.params as { inboxId: string };
    const body = z.object({
      actor_role: z.string().default("admin")
    }).parse(request.body ?? {});
    return executeInboxItem(inboxId, body.actor_role);
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown inbox item") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/inbox/:inboxId/resolve", async (request, reply) => {
  try {
    const { inboxId } = request.params as { inboxId: string };
    const body = (request.body ?? {}) as { actor_role?: string };
    const actorRole = body.actor_role?.trim();
    if (!actorRole) {
      return reply.code(400).send({ message: "actor_role is required" });
    }
    return {
      state: updateInboxItemState(inboxId, "resolved", actorRole)
    };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown inbox item") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/policy/proposals/follow-ups/:followUpId/execute", async (request, reply) => {
  try {
    const { followUpId } = request.params as { followUpId: string };
    const body = (request.body ?? {}) as { actor_role?: string };
    const policy = getEffectiveSkillPolicyDiagnostics();
    const actorRole = requireRole(
      body.actor_role,
      [...policy.roles.policy_edit_roles, ...policy.roles.policy_approve_roles, ...policy.roles.policy_manual_approval_roles, ...policy.roles.policy_security_review_roles, ...policy.roles.policy_promote_roles],
      `policy follow-up execute (${followUpId})`
    );
    return executePolicyProposalFollowUp(followUpId, actorRole);
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown policy follow-up") ? 404 : 400).send({ message });
  }
});

app.get("/api/local/skills/policy/approval-templates", async () => {
  return DEFAULT_POLICY_APPROVAL_NOTE_TEMPLATES;
});

app.get("/api/local/skills/policy/release-history", async request => {
  const query = request.query as { scope?: z.infer<typeof SkillPolicyScopeNameSchema> };
  return {
    items: listPolicyReleaseHistory(query.scope)
  };
});

app.post("/api/local/skills/policy/compare", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      from_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
      to_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
    };
    const fromScope = SkillPolicyScopeNameSchema.parse(body.from_scope);
    const toScope = SkillPolicyScopeNameSchema.parse(body.to_scope);
    const snapshots = buildPolicyEnvironmentSnapshots();
    const fromSnapshot = snapshots.find(item => item.scope === fromScope);
    const toSnapshot = snapshots.find(item => item.scope === toScope);
    if (!fromSnapshot || !toSnapshot) {
      return reply.code(404).send({ message: "Unable to resolve environment snapshots for compare." });
    }
    const changedFields = computePolicyDiff(fromSnapshot.effective_policy, toSnapshot.effective_policy);
    const riskSummary = summarizePolicyCompareRisk(changedFields);
    return {
      from: fromSnapshot,
      to: toSnapshot,
      changed_fields: changedFields,
      changed_groups: groupPolicyDiff(changedFields),
      risk_summary: riskSummary,
      advisory: buildPolicyCompareAdvisory(riskSummary)
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/proposals/scope", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
      config?: unknown;
      path?: string;
      actor_role?: string;
      requested_by?: string;
      rationale?: string;
    };
    const targetScope = SkillPolicyScopeNameSchema.parse(body.target_scope);
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.policy_edit_roles, `policy proposal create (${targetScope})`);
    const rawConfig = (body.config ?? {}) as Record<string, unknown>;
    const parsedConfig = SkillPolicyConfigSchema.parse(rawConfig);
    const persistedConfig = createPersistableSkillPolicyConfig(rawConfig, parsedConfig);
    const resolvedPath = resolveTargetScopePath(targetScope, body.path ? requireAbsolutePath(body.path) : undefined);
    const before = policy;
    const after = computeEffectiveSkillPolicyDiagnostics(
      createPolicyScopeOverride(targetScope, persistedConfig, parsedConfig, resolvedPath)
    );
    return {
      proposal: createPolicyProposal({
        kind: "scope_update",
        target_scope: targetScope,
        path: resolvedPath,
        rationale: body.rationale,
        requested_by: body.requested_by,
        persisted_config: persistedConfig,
        effective_preview: after,
        changed_fields: computePolicyDiff(before, after)
      })
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/proposals/promote", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      source_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
      target_scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
      actor_role?: string;
      requested_by?: string;
      rationale?: string;
      review_path?: z.infer<typeof SkillPolicyProposalSchema>["review_path"];
      advisory_recommended_action?: z.infer<typeof SkillPolicyProposalSchema>["advisory_recommended_action"];
      advisory_reasons?: string[];
      suggested_template_kind?: z.infer<typeof SkillPolicyProposalSchema>["suggested_template_kind"];
    };
    const sourceScope = SkillPolicyScopeNameSchema.parse(body.source_scope);
    const targetScope = SkillPolicyScopeNameSchema.parse(body.target_scope);
    if (sourceScope === targetScope) {
      return reply.code(400).send({ message: "source_scope and target_scope must be different" });
    }
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.policy_edit_roles, `policy promotion proposal (${sourceScope} -> ${targetScope})`);
    if (!isAllowedPromotionTransition(sourceScope, targetScope, policy)) {
      return reply.code(400).send({
        message: `Promotion transition '${sourceScope}>${targetScope}' is not allowed by current policy pipeline.`
      });
    }
    const sourceEntry = listSkillPolicyScopes().find(item => item.scope === sourceScope);
    if (!sourceEntry?.loaded) {
      return reply.code(400).send({ message: `Source scope '${sourceScope}' is not loaded.` });
    }
    const sourceRaw = sourceEntry.configured && sourceEntry.path
      ? (JSON.parse(readFileSync(requireAbsolutePath(sourceEntry.path), "utf8")) as Record<string, unknown>)
      : {};
    const sourceConfig = SkillPolicyConfigSchema.parse(sourceRaw);
    const persistedConfig = createPersistableSkillPolicyConfig(sourceRaw, sourceConfig);
    const resolvedPath = resolveTargetScopePath(targetScope);
    const before = policy;
    const after = computeEffectiveSkillPolicyDiagnostics(
      createPolicyScopeOverride(targetScope, persistedConfig, sourceConfig, resolvedPath)
    );
    return {
      proposal: createPolicyProposal({
        kind: "scope_promotion",
        review_path: body.review_path,
        advisory_recommended_action: body.advisory_recommended_action,
        advisory_reasons: body.advisory_reasons,
        suggested_template_kind: body.suggested_template_kind,
        source_scope: sourceScope,
        target_scope: targetScope,
        path: resolvedPath,
        rationale: body.rationale,
        requested_by: body.requested_by,
        persisted_config: persistedConfig,
        effective_preview: after,
        changed_fields: computePolicyDiff(before, after)
      })
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/proposals/:proposalId/approve", async (request, reply) => {
  try {
    const { proposalId } = request.params as { proposalId: string };
    const body = (request.body ?? {}) as { actor_role?: string; approved_by?: string; approval_note?: string };
    const proposal = getPolicyProposal(proposalId);
    if (!proposal) {
      return reply.code(404).send({ message: `Unknown policy proposal '${proposalId}'.` });
    }
    const policy = getEffectiveSkillPolicyDiagnostics();
    const actorRole = requireRole(
      body.actor_role,
      getPolicyProposalReviewRoles(policy, proposal.review_path),
      `policy proposal approve (${proposal.target_scope} / ${proposal.review_path})`
    );
    const updated = approvePolicyProposalRecord(proposalId, actorRole, body.approved_by, body.approval_note);
    return { proposal: updated };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown policy proposal") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/policy/proposals/:proposalId/reject", async (request, reply) => {
  try {
    const { proposalId } = request.params as { proposalId: string };
    const body = (request.body ?? {}) as { actor_role?: string; rejected_by?: string; rejection_reason?: string };
    const policy = getEffectiveSkillPolicyDiagnostics();
    const proposal = getPolicyProposal(proposalId);
    if (!proposal) {
      return reply.code(404).send({ message: `Unknown policy proposal '${proposalId}'.` });
    }
    const actorRole = requireRole(
      body.actor_role,
      getPolicyProposalReviewRoles(policy, proposal.review_path),
      `policy proposal reject (${proposal.target_scope} / ${proposal.review_path})`
    );
    const updated = rejectPolicyProposalRecord(proposalId, actorRole, body.rejected_by, body.rejection_reason);
    return { proposal: updated };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown policy proposal") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/policy/proposals/:proposalId/apply", async (request, reply) => {
  try {
    const { proposalId } = request.params as { proposalId: string };
    const body = (request.body ?? {}) as { actor_role?: string; applied_by?: string };
    const policy = getEffectiveSkillPolicyDiagnostics();
    const proposal = getPolicyProposal(proposalId);
    if (!proposal) {
      return reply.code(404).send({ message: `Unknown policy proposal '${proposalId}'.` });
    }
    const actorRole = requireRole(body.actor_role, policy.roles.policy_promote_roles, `policy proposal apply (${proposal.target_scope})`);
    const updated = applyPolicyProposalRecord(proposalId, actorRole, body.applied_by);
    return { proposal: updated };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown policy proposal") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/policy/proposals/batch", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      proposal_ids?: string[];
      action?: "approve" | "reject" | "apply";
      actor_role?: string;
      note?: string;
    };
    const proposalIds = Array.isArray(body.proposal_ids) ? body.proposal_ids.filter(Boolean) : [];
    if (proposalIds.length === 0) {
      return reply.code(400).send({ message: "proposal_ids is required" });
    }
    if (!body.action) {
      return reply.code(400).send({ message: "action is required" });
    }
    const policy = getEffectiveSkillPolicyDiagnostics();
    const actorRole = body.actor_role?.trim();
    if (!actorRole) {
      return reply.code(400).send({ message: "actor_role is required" });
    }
    const items = proposalIds.map(proposalId => {
      const proposal = getPolicyProposal(proposalId);
      if (!proposal) {
        throw new Error(`Unknown policy proposal '${proposalId}'.`);
      }
      if (body.action === "approve") {
        requireRole(actorRole, getPolicyProposalReviewRoles(policy, proposal.review_path), `policy proposal batch approve (${proposal.review_path})`);
        return approvePolicyProposalRecord(proposalId, actorRole, actorRole, body.note);
      }
      if (body.action === "reject") {
        requireRole(actorRole, getPolicyProposalReviewRoles(policy, proposal.review_path), `policy proposal batch reject (${proposal.review_path})`);
        return rejectPolicyProposalRecord(proposalId, actorRole, actorRole, body.note);
      }
      requireRole(actorRole, policy.roles.policy_promote_roles, "policy proposal batch apply");
      return applyPolicyProposalRecord(proposalId, actorRole, actorRole);
    });
    recordAudit("skill.policy_proposal_batch_processed", {
      action: body.action,
      proposal_ids: proposalIds,
      actor_role: actorRole
    });
    return {
      action: body.action,
      count: items.length,
      items
    };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.startsWith("Unknown policy proposal") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/policy/export", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as { path?: string; actor_role?: string };
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.policy_promote_roles, "policy bundle export");
    const brokenScopes = listSkillPolicyScopes().filter(scope => scope.configured && !scope.loaded);
    if (brokenScopes.length > 0) {
      return reply.code(400).send({
        message: `Cannot export policy bundle while configured scopes are invalid: ${brokenScopes.map(item => item.scope).join(", ")}`
      });
    }
    const bundle = buildPolicyBundle();
    if (body.path) {
      const resolvedPath = requireAbsolutePath(body.path);
      mkdirSync(dirname(resolvedPath), { recursive: true });
      writeFileSync(resolvedPath, JSON.stringify(bundle, null, 2), "utf8");
      recordAudit("skill.policy_bundle_exported", {
        path: resolvedPath,
        actor_role: body.actor_role ?? "viewer",
        scope_count: bundle.scopes.length,
        integrity_hash: bundle.integrity_hash
      });
      return { ...bundle, path: resolvedPath };
    }
    recordAudit("skill.policy_bundle_exported", {
      actor_role: body.actor_role ?? "viewer",
      scope_count: bundle.scopes.length,
      integrity_hash: bundle.integrity_hash
    });
    return bundle;
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/verify-bundle", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as { bundle?: unknown; path?: string };
    const bundle =
      body.bundle
        ? PolicyBundleSchema.parse(body.bundle)
        : body.path
          ? PolicyBundleSchema.parse(JSON.parse(readFileSync(requireAbsolutePath(body.path), "utf8")))
          : null;
    if (!bundle) {
      return reply.code(400).send({ message: "bundle or path is required" });
    }
    const integrity = verifyPolicyBundleIntegrity(bundle);
    const missingPaths = bundle.scopes
      .filter(item => !item.path && !getConfiguredSkillPolicyPath(item.scope))
      .map(item => item.scope);
    return {
      valid: integrity.valid && missingPaths.length === 0,
      integrity_valid: integrity.valid,
      expected_integrity_hash: integrity.expected_integrity_hash,
      missing_paths: missingPaths,
      scope_count: bundle.scopes.length
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/import", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as { bundle?: unknown; path?: string; actor_role?: string };
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.policy_promote_roles, "policy bundle import");
    const bundle =
      body.bundle
        ? PolicyBundleSchema.parse(body.bundle)
        : body.path
          ? PolicyBundleSchema.parse(JSON.parse(readFileSync(requireAbsolutePath(body.path), "utf8")))
          : null;
    if (!bundle) {
      return reply.code(400).send({ message: "bundle or path is required" });
    }
    const integrity = verifyPolicyBundleIntegrity(bundle);
    if (!integrity.valid) {
      return reply.code(400).send({ message: "policy bundle integrity check failed" });
    }
    const importedScopes: string[] = [];
    for (const scopeEntry of bundle.scopes) {
      const resolvedPath = scopeEntry.path
        ? requireAbsolutePath(scopeEntry.path)
        : getConfiguredSkillPolicyPath(scopeEntry.scope)
          ? requireAbsolutePath(getConfiguredSkillPolicyPath(scopeEntry.scope)!)
          : null;
      if (!resolvedPath) {
        return reply.code(400).send({ message: `No target path available for scope '${scopeEntry.scope}'.` });
      }
      const persistedSource = (scopeEntry.persisted_config && typeof scopeEntry.persisted_config === "object"
        ? scopeEntry.persisted_config
        : scopeEntry.config) as Record<string, unknown>;
      const persistedConfig = createPersistableSkillPolicyConfig(persistedSource, scopeEntry.config);
      mkdirSync(dirname(resolvedPath), { recursive: true });
      writeFileSync(resolvedPath, JSON.stringify(persistedConfig, null, 2), "utf8");
      importedScopes.push(scopeEntry.scope);
    }
    recordAudit("skill.policy_bundle_imported", {
      actor_role: body.actor_role ?? "viewer",
      scope_count: bundle.scopes.length,
      imported_scopes: importedScopes,
      integrity_hash: bundle.integrity_hash
    });
    return {
      imported_scopes: importedScopes,
      scope_count: bundle.scopes.length,
      integrity_hash: bundle.integrity_hash
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/diff", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      scope?: z.infer<typeof SkillPolicyScopeNameSchema>;
      config?: unknown;
      path?: string;
      actor_role?: string;
    };
    const scope = body.scope;
    if (!scope || !SKILL_POLICY_SCOPE_PATHS.some(item => item.scope === scope)) {
      return reply.code(400).send({ message: "valid scope is required" });
    }
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.policy_edit_roles, `policy diff (${scope})`);
    const rawConfig = (body.config ?? {}) as Record<string, unknown>;
    const parsedConfig = SkillPolicyConfigSchema.parse(rawConfig);
    const resolvedPath = body.path ? requireAbsolutePath(body.path) : getConfiguredSkillPolicyPath(scope);
    const before = policy;
    const after = computeEffectiveSkillPolicyDiagnostics(
      createPolicyScopeOverride(scope, rawConfig, parsedConfig, resolvedPath ? requireAbsolutePath(resolvedPath) : undefined)
    );
    return {
      scope,
      path: resolvedPath,
      before,
      after,
      changed_fields: computePolicyDiff(before, after)
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/scopes/:scope", async (request, reply) => {
  try {
    const { scope } = request.params as { scope: z.infer<typeof SkillPolicyScopeNameSchema> };
    if (!SKILL_POLICY_SCOPE_PATHS.some(item => item.scope === scope)) {
      return reply.code(404).send({ message: `Unknown policy scope '${scope}'.` });
    }
    const body = (request.body ?? {}) as {
      config?: unknown;
      path?: string;
      actor_role?: string;
    };
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.policy_edit_roles, `policy scope write (${scope})`);
    const rawConfig = ((body.config ?? {}) as Record<string, unknown>);
    const parsedConfig = SkillPolicyConfigSchema.parse(rawConfig);
    const persistedConfig = createPersistableSkillPolicyConfig(rawConfig, parsedConfig);
    const resolvedPath = getResolvedPolicyPathForScope(scope, body.path);
    const before = policy;
    writePolicyScopeFile(scope, resolvedPath, persistedConfig);
    const after = getEffectiveSkillPolicyDiagnostics();
    recordAudit("skill.policy_scope_updated", {
      scope,
      path: resolvedPath,
      actor_role: body.actor_role ?? "viewer",
      changed_fields: computePolicyDiff(before, after),
      persisted_config: persistedConfig
    });
    return {
      scope,
      path: resolvedPath,
      config: parsedConfig,
      persisted_config: persistedConfig,
      changed_fields: computePolicyDiff(before, after)
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/scopes/:scope/rollback", async (request, reply) => {
  try {
    const { scope } = request.params as { scope: z.infer<typeof SkillPolicyScopeNameSchema> };
    if (!SKILL_POLICY_SCOPE_PATHS.some(item => item.scope === scope)) {
      return reply.code(404).send({ message: `Unknown policy scope '${scope}'.` });
    }
    const body = (request.body ?? {}) as { audit_id?: string; actor_role?: string };
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.policy_promote_roles, `policy rollback (${scope})`);
    const candidates = listPolicyScopeAudits(scope).filter(
      audit => audit.action === "skill.policy_scope_updated" && typeof audit.payload?.path === "string" && audit.payload?.persisted_config
    );
    const targetAudit = body.audit_id
      ? candidates.find(item => item.audit_id === body.audit_id)
      : candidates[0];
    if (!targetAudit) {
      return reply.code(404).send({ message: `No rollback snapshot found for scope '${scope}'.` });
    }
    const resolvedPath = requireAbsolutePath(targetAudit.payload.path as string);
    const persistedConfig = SkillPolicyConfigSchema.parse(targetAudit.payload.persisted_config);
    const rawPersisted = createPersistableSkillPolicyConfig(
      targetAudit.payload.persisted_config as Record<string, unknown>,
      persistedConfig
    );
    const before = policy;
    writePolicyScopeFile(scope, resolvedPath, rawPersisted);
    const after = getEffectiveSkillPolicyDiagnostics();
    recordAudit("skill.policy_scope_rolled_back", {
      scope,
      path: resolvedPath,
      actor_role: body.actor_role ?? "viewer",
      from_audit_id: targetAudit.audit_id,
      changed_fields: computePolicyDiff(before, after)
    });
    return {
      scope,
      path: resolvedPath,
      from_audit_id: targetAudit.audit_id,
      changed_fields: computePolicyDiff(before, after)
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/policy/simulate", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      bundle?: unknown;
      path?: string;
      actor_role?: string;
      trust_bundle?: boolean;
      signature_secret?: string;
    };
    const bundle =
      body.bundle
        ? CanonicalSkillBundleManifestSchema.parse(body.bundle)
        : body.path
          ? CanonicalSkillBundleManifestSchema.parse(JSON.parse(readFileSync(requireAbsolutePath(body.path), "utf8")))
          : null;
    if (!bundle) {
      return reply.code(400).send({ message: "bundle or path is required" });
    }
    const policy = getEffectiveSkillPolicyDiagnostics();
    const actorRole = (body.actor_role ?? "viewer").trim() || "viewer";
    const verify = verifyCanonicalSkillBundle({
      bundle,
      signature_secret: body.signature_secret ?? process.env.APEX_SKILL_BUNDLE_SECRET,
      policy: {
        trusted_publishers: policy.trust.trusted_publishers,
        allowed_release_channels: policy.trust.allowed_release_channels,
        allowed_skill_sources: policy.content.allowed_skill_sources,
        blocked_tags: policy.content.blocked_tags,
        blocked_capabilities: policy.content.blocked_capabilities
      }
    });
    return {
      ...verify,
      actor_role: actorRole,
      trust_bundle_requested: Boolean(body.trust_bundle),
        role_policy: {
          can_review: policy.roles.review_roles.includes(actorRole),
          can_promote: policy.roles.promote_roles.includes(actorRole),
          can_import_trusted_bundle: policy.roles.trusted_import_roles.includes(actorRole),
          can_edit_policy: policy.roles.policy_edit_roles.includes(actorRole),
          can_approve_policy: policy.roles.policy_approve_roles.includes(actorRole),
          can_manual_approve_policy: policy.roles.policy_manual_approval_roles.includes(actorRole),
          can_security_review_policy: policy.roles.policy_security_review_roles.includes(actorRole),
          can_promote_policy: policy.roles.policy_promote_roles.includes(actorRole)
        },
      policy_file: policy.policy_file,
      policy_sources: policy.sources
    };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.get("/api/local/skills/bundle-history", async request => {
  const query = request.query as { bundle_name?: string };
  return {
    items: listCanonicalSkillBundleHistory({
      bundle_name: query.bundle_name?.trim() || undefined
    })
  };
});

app.get("/api/local/skills/:skillId/audits", async (request, reply) => {
  const { skillId } = request.params as { skillId: string };
  const skill = getCanonicalSkill(skillId);
  if (!skill) {
    return reply.code(404).send({ message: `Canonical skill not found: ${skillId}` });
  }
  return { skill_id: skillId, items: listCanonicalSkillAudits(skillId) };
});

app.post("/api/local/skills/register", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as { skill?: unknown };
    if (!body.skill) {
      return reply.code(400).send({ message: "skill is required" });
    }
    const parsedSkill = CanonicalSkillSpecSchema.parse(body.skill);
    const securitySignals = detectTextSecuritySignals(parsedSkill.prompt_template);
    if (securitySignals.reasons.length > 0) {
      return reply.code(400).send({
        message: "Canonical skill registration was rejected by security preflight.",
        reasons: securitySignals.reasons
      });
    }
    const registered = registerCanonicalSkill(parsedSkill);
    return { skill: registered };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/import", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      source_format?: unknown;
      content?: string;
      metadata?: {
        command_name?: string;
        name?: string;
        description?: string;
        tags?: string[];
        required_capabilities?: string[];
        preferred_workers?: string[];
        notes?: string[];
      };
    };
    const format = CanonicalSkillDocumentFormatSchema.parse(body.source_format);
    if (typeof body.content !== "string" || body.content.trim().length === 0) {
      return reply.code(400).send({ message: "content is required" });
    }
    const imported = importSkillDocument({
      format,
      content: body.content,
      register: false,
      metadata: body.metadata
    });
    const securitySignals = detectTextSecuritySignals(imported.prompt_template);
    if (securitySignals.reasons.length > 0) {
      return reply.code(400).send({
        message: "Imported skill was rejected by security preflight.",
        reasons: securitySignals.reasons
      });
    }
    return { skill: registerCanonicalSkill(imported) };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/import-file", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      source_format?: unknown;
      path?: string;
      metadata?: {
        command_name?: string;
        name?: string;
        description?: string;
        tags?: string[];
        required_capabilities?: string[];
        preferred_workers?: string[];
        notes?: string[];
      };
    };
    const format = CanonicalSkillDocumentFormatSchema.parse(body.source_format);
    if (!body.path) {
      return reply.code(400).send({ message: "path is required" });
    }
    const resolvedPath = requireAbsolutePath(body.path);
    const content = readFileSync(resolvedPath, "utf8");
    const imported = importSkillDocument({
      format,
      content,
      register: false,
      metadata: body.metadata
    });
    const securitySignals = detectTextSecuritySignals(imported.prompt_template);
    if (securitySignals.reasons.length > 0) {
      return reply.code(400).send({
        message: "Imported skill file was rejected by security preflight.",
        reasons: securitySignals.reasons
      });
    }
    return { skill: registerCanonicalSkill(imported), path: resolvedPath };
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/:skillId/export", async (request, reply) => {
  try {
    const { skillId } = request.params as { skillId: string };
    const body = (request.body ?? {}) as { format?: unknown };
    const format = CanonicalSkillDocumentFormatSchema.parse(body.format ?? "canonical_json");
    return exportCanonicalSkill({
      skill_id: skillId,
      format
    });
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.includes("not found") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/:skillId/export-file", async (request, reply) => {
  try {
    const { skillId } = request.params as { skillId: string };
    const body = (request.body ?? {}) as { format?: unknown; path?: string };
    const format = CanonicalSkillDocumentFormatSchema.parse(body.format ?? "canonical_json");
    if (!body.path) {
      return reply.code(400).send({ message: "path is required" });
    }
    const resolvedPath = requireAbsolutePath(body.path);
    const exported = exportCanonicalSkill({
      skill_id: skillId,
      format
    });
    mkdirSync(dirname(resolvedPath), { recursive: true });
    writeFileSync(resolvedPath, exported.content, "utf8");
    return {
      skill: exported.skill,
      format: exported.format,
      path: resolvedPath
    };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.includes("not found") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/:skillId/governance", async (request, reply) => {
  try {
    const { skillId } = request.params as { skillId: string };
    const body = (request.body ?? {}) as {
      status?: unknown;
      reviewed_by?: string;
      governance_note?: string;
      actor_role?: string;
    };
    const status = CanonicalSkillStatusSchema.parse(body.status);
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.review_roles, "skill governance");
    const updated = updateCanonicalSkillGovernance({
      skill_id: skillId,
      status,
      reviewed_by: body.reviewed_by,
      governance_note: body.governance_note
    });
    return { skill: updated };
  } catch (error) {
    const message = (error as Error).message;
    return reply.code(message.includes("not found") ? 404 : 400).send({ message });
  }
});

app.post("/api/local/skills/export-bundle", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      skill_ids?: string[];
      statuses?: Array<"review_required" | "active" | "disabled">;
      path?: string;
      bundle_name?: string;
      publisher_id?: string;
      publisher_name?: string;
      source_environment?: string;
      release_channel?: string;
      promotion_note?: string;
      actor_role?: string;
    };
    const policy = getEffectiveSkillPolicyDiagnostics();
    requireRole(body.actor_role, policy.roles.promote_roles, "bundle promotion/export");
    const publisherId = body.publisher_id ?? process.env.APEX_SKILL_BUNDLE_PUBLISHER_ID;
    const publisherName = body.publisher_name ?? process.env.APEX_SKILL_BUNDLE_PUBLISHER_NAME;
    const bundle = exportCanonicalSkillBundle({
      skill_ids: body.skill_ids,
      statuses: body.statuses,
      bundle_name: body.bundle_name,
      signature_secret: process.env.APEX_SKILL_BUNDLE_SECRET,
      signature_key_id: process.env.APEX_SKILL_BUNDLE_KEY_ID,
      publisher: publisherId
        ? {
            publisher_id: publisherId,
            publisher_name: publisherName
          }
        : undefined,
      source_environment: body.source_environment ?? process.env.APEX_SKILL_BUNDLE_SOURCE_ENVIRONMENT,
      release_channel: body.release_channel ?? process.env.APEX_SKILL_BUNDLE_RELEASE_CHANNEL,
      promotion_note: body.promotion_note
    });
    if (body.path) {
      const resolvedPath = requireAbsolutePath(body.path);
      mkdirSync(dirname(resolvedPath), { recursive: true });
      writeFileSync(resolvedPath, JSON.stringify(bundle, null, 2), "utf8");
      return { ...bundle, path: resolvedPath };
    }
    return bundle;
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/verify-bundle", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      bundle?: unknown;
      path?: string;
      signature_secret?: string;
    };
    const bundle =
      body.bundle
        ? CanonicalSkillBundleManifestSchema.parse(body.bundle)
        : body.path
          ? CanonicalSkillBundleManifestSchema.parse(JSON.parse(readFileSync(requireAbsolutePath(body.path), "utf8")))
          : null;
    if (!bundle) {
      return reply.code(400).send({ message: "bundle or path is required" });
    }
    const policy = getEffectiveSkillPolicyDiagnostics();
    return verifyCanonicalSkillBundle({
      bundle,
      signature_secret: body.signature_secret ?? process.env.APEX_SKILL_BUNDLE_SECRET,
      policy: {
        trusted_publishers: policy.trust.trusted_publishers,
        allowed_release_channels: policy.trust.allowed_release_channels,
        allowed_skill_sources: policy.content.allowed_skill_sources,
        blocked_tags: policy.content.blocked_tags,
        blocked_capabilities: policy.content.blocked_capabilities
      }
    });
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/skills/import-bundle", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      bundle?: unknown;
      path?: string;
      trust_bundle?: boolean;
      signature_secret?: string;
      actor_role?: string;
    };
    const bundle =
      body.bundle
        ? CanonicalSkillBundleManifestSchema.parse(body.bundle)
        : body.path
          ? CanonicalSkillBundleManifestSchema.parse(JSON.parse(readFileSync(requireAbsolutePath(body.path), "utf8")))
          : null;
    if (!bundle) {
      return reply.code(400).send({ message: "bundle or path is required" });
    }
    const policy = getEffectiveSkillPolicyDiagnostics();
    if (body.trust_bundle) {
      requireRole(body.actor_role, policy.roles.trusted_import_roles, "trusted bundle import");
    }
    return importCanonicalSkillBundle({
      bundle,
      trust_bundle: body.trust_bundle,
      signature_secret: body.signature_secret ?? process.env.APEX_SKILL_BUNDLE_SECRET,
      policy: {
        trusted_publishers: policy.trust.trusted_publishers,
        allowed_release_channels: policy.trust.allowed_release_channels,
        allowed_skill_sources: policy.content.allowed_skill_sources,
        blocked_tags: policy.content.blocked_tags,
        blocked_capabilities: policy.content.blocked_capabilities,
        require_trusted_bundle: policy.trust.require_trusted_bundle_import
      }
    });
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.get("/api/local/tools/catalog", async () => {
  return { items: getLocalToolCatalog() };
});

app.get("/api/local/tools/external/catalog", async (_request, reply) => {
  try {
    return await fetchToolGatewayJson<{ tools: Array<Record<string, unknown>> }>("/internal/tools");
  } catch (error) {
    log("warn", "local-control-plane failed to load external tool catalog", { message: (error as Error).message });
    return reply.code(502).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/external/:toolName/invoke", async (request, reply) => {
  const { taskId, toolName } = request.params as { taskId: string; toolName: string };
  const body = (request.body ?? {}) as { input?: Record<string, unknown>; idempotencyKey?: string };
  try {
    return withTaskMutationLock(taskId, reply, `external:${toolName}`, async () => {
      const taskContract = requireTask(taskId);
      const gatewayResponse = await fetchToolGatewayJson<{
        task_id: string;
        tool_name: string;
        idempotency_key?: string;
        compensation_available?: boolean;
        reconciliation_mode?: "artifact" | "external_state";
        reconciliation_state?: string;
        reused?: boolean;
        output?: Record<string, unknown>;
      }>(`/internal/tools/${toolName}/invoke`, {
        method: "POST",
        body: JSON.stringify({
          task_id: taskId,
          task_contract: taskContract,
          input: body.input ?? {},
          idempotency_key: body.idempotencyKey
        })
      });
      recordToolInvocation(
        taskId,
        toolName,
        body.input ?? {},
        {
          ...(gatewayResponse.output ?? {}),
          external_connector: true,
          reused: gatewayResponse.reused ?? false,
          reconciliation_state:
            gatewayResponse.reconciliation_mode === "external_state"
              ? (gatewayResponse.reconciliation_state ?? (gatewayResponse.output?.reconciliation_state as string | undefined) ?? "pending")
              : "artifact_ready"
        },
        "succeeded",
        {
          idempotency_key: gatewayResponse.idempotency_key,
          compensation_available: gatewayResponse.compensation_available ?? false,
          compensation_status: gatewayResponse.compensation_available ? "available" : "not_required"
        }
      );
      return gatewayResponse;
    });
  } catch (error) {
    return reply.code(502).send({ message: (error as Error).message });
  }
});

app.get("/api/local/tasks/:taskId/tools/external/:toolName/reconcile", async (request, reply) => {
  const { taskId, toolName } = request.params as { taskId: string; toolName: string };
  const query = request.query as { idempotency_key?: string };
  try {
    const search = query.idempotency_key ? `?idempotency_key=${encodeURIComponent(query.idempotency_key)}` : "";
    return await fetchToolGatewayJson(`/internal/tools/reconcile/${taskId}/${toolName}${search}`);
  } catch (error) {
    return reply.code(502).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/fs/list", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { path?: string };
  try {
    return listLocalFiles(taskId, body.path);
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/fs/read", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { path?: string };
  try {
    if (!body.path) {
      return reply.code(400).send({ message: "path is required" });
    }
    return readLocalFile(taskId, body.path);
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/fs/write", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { path?: string; content?: string; confirm?: boolean };
  try {
    if (!body.path) {
      return reply.code(400).send({ message: "path is required" });
    }
    if (typeof body.content !== "string") {
      return reply.code(400).send({ message: "content is required" });
    }
    const path = body.path;
    const content = body.content;
    return withTaskMutationLock(taskId, reply, "fs.write", () =>
      writeLocalFile({
        taskId,
        path,
        content,
        confirm: body.confirm
      })
    );
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/fs/patch", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { path?: string; expectedContent?: string; nextContent?: string; confirm?: boolean };
  try {
    if (!body.path) {
      return reply.code(400).send({ message: "path is required" });
    }
    if (typeof body.expectedContent !== "string") {
      return reply.code(400).send({ message: "expectedContent is required" });
    }
    if (typeof body.nextContent !== "string") {
      return reply.code(400).send({ message: "nextContent is required" });
    }
    const path = body.path;
    const expectedContent = body.expectedContent;
    const nextContent = body.nextContent;
    return withTaskMutationLock(taskId, reply, "fs.patch", () =>
      patchLocalFileExact({
        taskId,
        path,
        expectedContent,
        nextContent,
        confirm: body.confirm
      })
    );
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/fs/rollback", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { path?: string; invocationId?: string; confirm?: boolean };
  try {
    return withTaskMutationLock(taskId, reply, "fs.rollback", () =>
      rollbackLocalFileOperation({
        taskId,
        path: body.path,
        invocationId: body.invocationId,
        confirm: body.confirm
      })
    );
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/shell/run", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { command?: string; cwd?: string; confirm?: boolean };
  try {
    if (!body.command) {
      return reply.code(400).send({ message: "command is required" });
    }
    const command = body.command;
    return withTaskMutationLock(taskId, reply, "shell.run", () =>
      runLocalShellCommand({
        taskId,
        command,
        cwd: body.cwd,
        confirm: body.confirm
      })
    );
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/browser/snapshot", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { url?: string; confirm?: boolean };
  try {
    if (!body.url) {
      return reply.code(400).send({ message: "url is required" });
    }
    const url = body.url;
    return withTaskMutationLock(taskId, reply, "browser.snapshot", () =>
      captureLocalBrowserSnapshot({
        taskId,
        url,
        confirm: body.confirm
      })
    );
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/browser/session/navigate", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { sessionId?: string; url?: string; confirm?: boolean };
  try {
    if (!body.sessionId) {
      return reply.code(400).send({ message: "sessionId is required" });
    }
    if (!body.url) {
      return reply.code(400).send({ message: "url is required" });
    }
    const sessionId = body.sessionId;
    const url = body.url;
    return withTaskMutationLock(taskId, reply, "browser.navigate", () =>
      navigateLocalBrowserSession({
        taskId,
        sessionId,
        url,
        confirm: body.confirm
      })
    );
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post("/api/local/tasks/:taskId/tools/ide/workspace-summary", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { rootPath?: string; confirm?: boolean };
  try {
    return summarizeLocalIdeWorkspace({
      taskId,
      rootPath: body.rootPath,
      confirm: body.confirm
    });
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.get("/api/local/workers/runs", async () => {
  return { workerRuns: [...store.workerRuns.values()] };
});

app.get("/api/local/memory/directories", async request => {
  const query = request.query as { kind?: string; department?: string; parent_directory_id?: string };
  const { listMemoryDirectories } = await import("@apex/shared-runtime");
  const dirs = listMemoryDirectories({
    kind: query.kind as MemoryDirectory["kind"] | undefined,
    department: query.department,
    parent_directory_id: query.parent_directory_id
  });
  return { directories: dirs };
});

app.get("/api/local/memory/directories/:directoryId", async (request, reply) => {
  const { directoryId } = request.params as { directoryId: string };
  const { getMemoryDirectory } = await import("@apex/shared-runtime");
  const dir = getMemoryDirectory(directoryId);
  if (!dir) {
    reply.status(404);
    return { error: "Memory directory not found." };
  }
  return { directory: dir };
});

app.post("/api/local/memory/directories", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { createMemoryDirectory } = await import("@apex/shared-runtime");
    const dir = createMemoryDirectory({
      kind: body.kind as MemoryDirectory["kind"],
      key: body.key as string,
      title: body.title as string,
      description: body.description as string | undefined,
      parent_directory_id: body.parent_directory_id as string | undefined,
      department: body.department as string | undefined,
      owners: body.owners as string[] | undefined,
      tags: body.tags as string[] | undefined,
      freshness_window_days: body.freshness_window_days as number | undefined
    });
    return { directory: dir };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/memory/documents", async request => {
  const query = request.query as { directory_id?: string; kind?: string; department?: string; promotion_status?: string; tags?: string };
  const { listMemoryDocuments } = await import("@apex/shared-runtime");
  const docs = listMemoryDocuments({
    directory_id: query.directory_id,
    kind: query.kind as MemoryDocument["kind"] | undefined,
    department: query.department,
    promotion_status: query.promotion_status as MemoryDocument["promotion_status"] | undefined,
    tags: query.tags?.split(",").filter(Boolean)
  });
  return { documents: docs };
});

app.get("/api/local/memory/documents/:documentId", async (request, reply) => {
  const { documentId } = request.params as { documentId: string };
  const { getMemoryDocument } = await import("@apex/shared-runtime");
  const doc = getMemoryDocument(documentId);
  if (!doc) {
    reply.status(404);
    return { error: "Memory document not found." };
  }
  return { document: doc };
});

app.post("/api/local/memory/documents", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { createMemoryDocument } = await import("@apex/shared-runtime");
    const doc = createMemoryDocument({
      directory_id: body.directory_id as string,
      kind: body.kind as MemoryDocument["kind"],
      key: body.key as string,
      title: body.title as string,
      content: body.content as string,
      summary: body.summary as string | undefined,
      department: body.department as string | undefined,
      task_family: body.task_family as string | undefined,
      owners: body.owners as string[] | undefined,
      source_artifact_ids: body.source_artifact_ids as string[] | undefined,
      source_evidence_ids: body.source_evidence_ids as string[] | undefined,
      promotion_status: body.promotion_status as MemoryDocument["promotion_status"] | undefined,
      tags: body.tags as string[] | undefined,
      freshness_window_days: body.freshness_window_days as number | undefined
    });
    return { document: doc };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/memory/documents/:documentId/promote", async (request, reply) => {
  const { documentId } = request.params as { documentId: string };
  try {
    const { promoteMemoryDocument } = await import("@apex/shared-runtime");
    const doc = promoteMemoryDocument(documentId);
    return { document: doc };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/memory/documents/:documentId/retire", async (request, reply) => {
  const { documentId } = request.params as { documentId: string };
  try {
    const { retireMemoryDocument } = await import("@apex/shared-runtime");
    const doc = retireMemoryDocument(documentId);
    return { document: doc };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/memory/documents/:documentId/sections", async (request, reply) => {
  const { documentId } = request.params as { documentId: string };
  const { listMemoryDocumentSections } = await import("@apex/shared-runtime");
  const sections = listMemoryDocumentSections(documentId);
  return { sections };
});

app.post("/api/local/memory/documents/:documentId/sections", async (request, reply) => {
  const { documentId } = request.params as { documentId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { createMemoryDocumentSection } = await import("@apex/shared-runtime");
    const section = createMemoryDocumentSection({
      document_id: documentId,
      title: body.title as string,
      content: body.content as string,
      parent_section_id: body.parent_section_id as string | undefined,
      section_index: body.section_index as number | undefined,
      tags: body.tags as string[] | undefined,
      source_artifact_id: body.source_artifact_id as string | undefined
    });
    return { section };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/memory/search", async request => {
  const query = request.query as { q?: string; department?: string; kinds?: string; limit?: string };
  const { searchMemoryDocuments } = await import("@apex/shared-runtime");
  const results = searchMemoryDocuments(query.q ?? "", {
    department: query.department,
    kinds: query.kinds?.split(",").filter(Boolean) as MemoryDocument["kind"][],
    limit: query.limit ? parseInt(query.limit, 10) : undefined
  });
  return { results };
});

app.get("/api/local/learning-factory/pipelines", async request => {
  const query = request.query as { status?: string; source_artifact_type?: string; department?: string };
  const { listLearningFactoryPipelines } = await import("@apex/shared-runtime");
  const pipelines = listLearningFactoryPipelines({
    status: query.status as LearningFactoryPipelineStatus | undefined,
    source_artifact_type: query.source_artifact_type as LearningFactoryPipeline["source_artifact_type"] | undefined,
    department: query.department
  });
  return { pipelines };
});

app.get("/api/local/learning-factory/pipelines/:pipelineId", async (request, reply) => {
  const { pipelineId } = request.params as { pipelineId: string };
  const { getLearningFactoryPipeline } = await import("@apex/shared-runtime");
  const pipeline = getLearningFactoryPipeline(pipelineId);
  if (!pipeline) {
    reply.status(404);
    return { error: "Learning factory pipeline not found." };
  }
  return { pipeline };
});

app.post("/api/local/learning-factory/pipelines", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { createLearningFactoryPipeline } = await import("@apex/shared-runtime");
    const pipeline = createLearningFactoryPipeline({
      source_task_id: body.source_task_id as string,
      source_artifact_type: body.source_artifact_type as LearningFactoryPipeline["source_artifact_type"],
      source_artifact_id: body.source_artifact_id as string,
      fingerprint: body.fingerprint as string | undefined,
      department: body.department as string | undefined,
      task_family: body.task_family as string | undefined
    });
    return { pipeline };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/learning-factory/pipelines/:pipelineId/advance", async (request, reply) => {
  const { pipelineId } = request.params as { pipelineId: string };
  const body = request.body as Record<string, unknown> | undefined;
  try {
    const { advanceLearningFactoryStage } = await import("@apex/shared-runtime");
    const pipeline = advanceLearningFactoryStage(pipelineId, body as Record<string, unknown> | undefined);
    return { pipeline };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/learning-factory/pipelines/:pipelineId/fail", async (request, reply) => {
  const { pipelineId } = request.params as { pipelineId: string };
  const body = request.body as { error?: string };
  try {
    const { failLearningFactoryStage } = await import("@apex/shared-runtime");
    const pipeline = failLearningFactoryStage(pipelineId, body.error ?? "Manual failure");
    return { pipeline };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/learning-factory/pipelines/:pipelineId/rollback", async (request, reply) => {
  const { pipelineId } = request.params as { pipelineId: string };
  const body = request.body as { reason?: string };
  try {
    const { rollbackLearningFactoryPipeline } = await import("@apex/shared-runtime");
    const pipeline = rollbackLearningFactoryPipeline(pipelineId, body.reason ?? "Manual rollback");
    return { pipeline };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/learning-factory/pipelines/:pipelineId/canary-result", async (request, reply) => {
  const { pipelineId } = request.params as { pipelineId: string };
  const body = request.body as { task_id: string; passed: boolean };
  try {
    const { addCanaryResultToPipeline } = await import("@apex/shared-runtime");
    const pipeline = addCanaryResultToPipeline(pipelineId, body.task_id, body.passed);
    return { pipeline };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/learning-factory/pipelines/:pipelineId/run", async (request, reply) => {
  const { pipelineId } = request.params as { pipelineId: string };
  try {
    const { runLearningFactoryPipeline } = await import("@apex/shared-runtime");
    const pipeline = runLearningFactoryPipeline(pipelineId);
    return { pipeline };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/learning-factory/backlog", async request => {
  const query = request.query as { status?: string; source_type?: string; priority?: string };
  const { listLearningFactoryBacklog } = await import("@apex/shared-runtime");
  const items = listLearningFactoryBacklog({
    status: query.status as LearningFactoryBacklogItem["status"] | undefined,
    source_type: query.source_type as LearningFactoryBacklogItem["source_type"] | undefined,
    priority: query.priority as LearningFactoryBacklogItem["priority"] | undefined
  });
  return { items };
});

app.post("/api/local/learning-factory/backlog", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { createLearningFactoryBacklogItem } = await import("@apex/shared-runtime");
    const item = createLearningFactoryBacklogItem({
      source_type: body.source_type as LearningFactoryBacklogItem["source_type"],
      source_task_id: body.source_task_id as string | undefined,
      target_artifact_type: body.target_artifact_type as LearningFactoryBacklogItem["target_artifact_type"] | undefined,
      target_artifact_id: body.target_artifact_id as string | undefined,
      description: body.description as string,
      priority: body.priority as LearningFactoryBacklogItem["priority"] | undefined
    });
    return { item };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/learning-factory/backlog/:backlogId/resolve", async (request, reply) => {
  const { backlogId } = request.params as { backlogId: string };
  const body = request.body as { pipeline_id?: string } | undefined;
  try {
    const { resolveLearningFactoryBacklogItem } = await import("@apex/shared-runtime");
    const item = resolveLearningFactoryBacklogItem(backlogId, body?.pipeline_id);
    return { item };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/event-ledger", async request => {
  const query = request.query as { aggregate_type?: string; aggregate_id?: string; kind?: string; from_sequence?: string; limit?: string };
  const { getEventLedger } = await import("@apex/shared-runtime");
  const entries = getEventLedger({
    aggregate_type: query.aggregate_type,
    aggregate_id: query.aggregate_id,
    kind: query.kind as EventLedgerEntryKind | undefined,
    from_sequence: query.from_sequence ? parseInt(query.from_sequence, 10) : undefined,
    limit: query.limit ? parseInt(query.limit, 10) : undefined
  });
  return { events: entries };
});

app.get("/api/local/event-ledger/projections", async request => {
  const query = request.query as { projection_type?: string; limit?: string };
  const { listEventProjections } = await import("@apex/shared-runtime");
  const projections = listEventProjections({
    projection_type: query.projection_type,
    limit: query.limit ? parseInt(query.limit, 10) : undefined
  });
  return { projections };
});

app.get("/api/local/event-ledger/projections/:aggregateType/:aggregateId", async (request, reply) => {
  const { aggregateType, aggregateId } = request.params as { aggregateType: string; aggregateId: string };
  const { getEventProjection } = await import("@apex/shared-runtime");
  const projection = getEventProjection(aggregateType, aggregateId);
  if (!projection) {
    reply.status(404);
    return { error: "Event projection not found." };
  }
  return { projection };
});

app.get("/api/local/event-ledger/replay/:aggregateType/:aggregateId", async request => {
  const { aggregateType, aggregateId } = request.params as { aggregateType: string; aggregateId: string };
  const { replayEvents } = await import("@apex/shared-runtime");
  const events = replayEvents(aggregateType, aggregateId);
  return { events };
});

app.get("/api/local/event-ledger/outbox", async request => {
  const query = request.query as { limit?: string };
  const { getPendingOutboxEntries } = await import("@apex/shared-runtime");
  const entries = getPendingOutboxEntries(query.limit ? parseInt(query.limit, 10) : undefined);
  return { outbox: entries };
});

app.post("/api/local/event-ledger/outbox/:outboxId/sent", async (request, reply) => {
  const { outboxId } = request.params as { outboxId: string };
  try {
    const { markOutboxEntrySent } = await import("@apex/shared-runtime");
    const entry = markOutboxEntrySent(outboxId);
    return { entry };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/event-ledger/outbox/:outboxId/failed", async (request, reply) => {
  const { outboxId } = request.params as { outboxId: string };
  const body = request.body as { error?: string };
  try {
    const { markOutboxEntryFailed } = await import("@apex/shared-runtime");
    const entry = markOutboxEntryFailed(outboxId, body.error ?? "Unknown error");
    return { entry };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/policy/rules", async request => {
  const query = request.query as { enabled?: string; effect?: string };
  const { listPolicyRules } = await import("@apex/shared-runtime");
  const rules = listPolicyRules({
    enabled: query.enabled === "true" ? true : query.enabled === "false" ? false : undefined,
    effect: query.effect as PolicyRule["effect"] | undefined
  });
  return { rules };
});

app.post("/api/local/policy/rules", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { createPolicyRule } = await import("@apex/shared-runtime");
    const rule = createPolicyRule({
      name: body.name as string,
      description: body.description as string | undefined,
      effect: body.effect as PolicyRule["effect"],
      priority: body.priority as number | undefined,
      conditions: body.conditions as PolicyRule["conditions"] | undefined,
      enabled: body.enabled as boolean | undefined
    });
    return { rule };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/policy/evaluate", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { evaluatePolicy } = await import("@apex/shared-runtime");
    const decision = evaluatePolicy({
      pep_id: body.pep_id as string,
      subject: body.subject as string,
      action: body.action as string,
      resource: body.resource as string,
      scope: body.scope as string | undefined,
      sandbox_tier: body.sandbox_tier as PolicyDecision["sandbox_tier"] | undefined,
      risk_level: body.risk_level as PolicyDecision["risk_level"] | undefined,
      task_id: body.task_id as string | undefined,
      correlation_id: body.correlation_id as string | undefined
    });
    return { decision };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/policy/enforce", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { enforcePolicy } = await import("@apex/shared-runtime");
    const action = enforcePolicy(
      body.decision_id as string,
      body.enforcement_result as PolicyEnforcementAction["enforcement_result"],
      body.evidence_node_id as string | undefined
    );
    return { action };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/policy/check-and-enforce", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { checkPolicyAndEnforce } = await import("@apex/shared-runtime");
    const result = checkPolicyAndEnforce({
      pep_id: body.pep_id as string,
      subject: body.subject as string,
      action: body.action as string,
      resource: body.resource as string,
      scope: body.scope as string | undefined,
      sandbox_tier: body.sandbox_tier as PolicyDecision["sandbox_tier"] | undefined,
      risk_level: body.risk_level as PolicyDecision["risk_level"] | undefined,
      task_id: body.task_id as string | undefined,
      correlation_id: body.correlation_id as string | undefined
    });
    return result;
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/policy/decisions", async request => {
  const query = request.query as { pep_id?: string; verdict?: string; task_id?: string };
  const { listPolicyDecisions } = await import("@apex/shared-runtime");
  const decisions = listPolicyDecisions({
    pep_id: query.pep_id,
    verdict: query.verdict as PolicyDecisionVerdict | undefined,
    task_id: query.task_id
  });
  return { decisions };
});

app.get("/api/local/policy/enforcement-actions", async request => {
  const query = request.query as { pep_id?: string; enforcement_result?: string; task_id?: string };
  const { listPolicyEnforcementActions } = await import("@apex/shared-runtime");
  const actions = listPolicyEnforcementActions({
    pep_id: query.pep_id,
    enforcement_result: query.enforcement_result as PolicyEnforcementAction["enforcement_result"] | undefined,
    task_id: query.task_id
  });
  return { actions };
});

app.get("/api/local/capabilities/discovery", async () => {
  const { listLocalCapabilities } = await import("@apex/shared-runtime");
  const capabilities = listLocalCapabilities();
  return { capabilities };
});

app.get("/api/local/tasks/:taskId/autonomous-completion/config", async request => {
  const { taskId } = request.params as { taskId: string };
  const { getAutonomousCompletionConfig } = await import("@apex/shared-runtime");
  const config = getAutonomousCompletionConfig(taskId);
  return { config };
});

app.post("/api/local/tasks/:taskId/autonomous-completion/config", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { setAutonomousCompletionConfig } = await import("@apex/shared-runtime");
    const config = setAutonomousCompletionConfig(taskId, {
      max_retries: body.max_retries as number | undefined,
      retry_backoff_ms: body.retry_backoff_ms as number | undefined,
      circuit_breaker_threshold: body.circuit_breaker_threshold as number | undefined,
      circuit_breaker_reset_ms: body.circuit_breaker_reset_ms as number | undefined,
      heartbeat_interval_ms: body.heartbeat_interval_ms as number | undefined,
      watchdog_timeout_ms: body.watchdog_timeout_ms as number | undefined,
      auto_escalation: body.auto_escalation as boolean | undefined,
      human_judgment_boundaries: body.human_judgment_boundaries as string[] | undefined
    });
    return { config };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/tasks/:taskId/autonomous-completion/checkpoint", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { createCheckpoint } = await import("@apex/shared-runtime");
    const checkpoint = createCheckpoint(
      taskId,
      body.step_index as number,
      body.step_description as string | undefined,
      body.state_snapshot as Record<string, unknown> | undefined
    );
    return { checkpoint };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/autonomous-completion/checkpoints", async request => {
  const { taskId } = request.params as { taskId: string };
  const { listCheckpoints } = await import("@apex/shared-runtime");
  const checkpoints = listCheckpoints(taskId);
  return { checkpoints };
});

app.post("/api/local/tasks/:taskId/autonomous-completion/heartbeat", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { recordHeartbeat } = await import("@apex/shared-runtime");
    const heartbeat = recordHeartbeat(
      taskId,
      body.status as AutonomousCompletionState,
      body.progress_note as string | undefined
    );
    return { heartbeat };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/autonomous-completion/heartbeats", async request => {
  const { taskId } = request.params as { taskId: string };
  const query = request.query as { limit?: string };
  const { listHeartbeats } = await import("@apex/shared-runtime");
  const heartbeats = listHeartbeats(taskId, query.limit ? parseInt(query.limit) : undefined);
  return { heartbeats };
});

app.get("/api/local/tasks/:taskId/autonomous-completion/watchdog", async request => {
  const { taskId } = request.params as { taskId: string };
  const { checkWatchdog } = await import("@apex/shared-runtime");
  const result = checkWatchdog(taskId);
  return result;
});

app.post("/api/local/tasks/:taskId/autonomous-completion/recover", async request => {
  const { taskId } = request.params as { taskId: string };
  const { recoverFromCheckpoint } = await import("@apex/shared-runtime");
  const result = recoverFromCheckpoint(taskId);
  return result;
});

app.get("/api/local/tasks/:taskId/autonomous-completion/status", async request => {
  const { taskId } = request.params as { taskId: string };
  const { evaluateCompletionStatus } = await import("@apex/shared-runtime");
  const status = evaluateCompletionStatus(taskId);
  return status;
});

app.post("/api/local/tasks/:taskId/autonomous-completion/check-human-boundary", async request => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as { step: string };
  const { isHumanJudgmentBoundary } = await import("@apex/shared-runtime");
  const isBoundary = isHumanJudgmentBoundary(taskId, body.step);
  return { is_human_judgment_boundary: isBoundary, step: body.step };
});

app.post("/api/local/tasks/:taskId/ralph-loop/start", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as { max_attempts?: number } | undefined;
  try {
    const { startRalphLoop } = await import("@apex/shared-runtime");
    const loopState = startRalphLoop(taskId, body?.max_attempts);
    return { loop_state: loopState };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/ralph-loop", async request => {
  const { taskId } = request.params as { taskId: string };
  const { getRalphLoopSummary } = await import("@apex/shared-runtime");
  const summary = getRalphLoopSummary(taskId);
  return summary;
});

app.post("/api/local/tasks/:taskId/ralph-loop/advance", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  try {
    const { advanceRalphLoop } = await import("@apex/shared-runtime");
    const result = advanceRalphLoop(taskId);
    return result;
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/tasks/:taskId/ralph-loop/stop", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  try {
    const { stopRalphLoop } = await import("@apex/shared-runtime");
    const loopState = stopRalphLoop(taskId);
    return { loop_state: loopState };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/tasks/:taskId/ralph-loop/expectations", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as { attempt_id: string; criterion: string; description?: string; required?: boolean };
  try {
    const { addReviewerExpectation } = await import("@apex/shared-runtime");
    const expectation = addReviewerExpectation(taskId, body.attempt_id, body.criterion, body.description, body.required);
    return { expectation };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/ralph-loop/expectations", async request => {
  const { taskId } = request.params as { taskId: string };
  const query = request.query as { attempt_id?: string };
  const { listReviewerExpectations } = await import("@apex/shared-runtime");
  const expectations = listReviewerExpectations(taskId, query.attempt_id);
  return { expectations };
});

app.post("/api/local/tasks/:taskId/ralph-loop/feedback", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as { attempt_id: string; expectation_id: string; verdict: ReviewerVerdict; notes?: string; evidence_node_id?: string; reviewer_type?: ReviewerFeedback["reviewer_type"] };
  try {
    const { submitReviewerFeedback } = await import("@apex/shared-runtime");
    const feedback = submitReviewerFeedback({
      task_id: taskId,
      attempt_id: body.attempt_id,
      expectation_id: body.expectation_id,
      verdict: body.verdict,
      notes: body.notes,
      evidence_node_id: body.evidence_node_id,
      reviewer_type: body.reviewer_type
    });
    return { feedback };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/ralph-loop/feedback", async request => {
  const { taskId } = request.params as { taskId: string };
  const query = request.query as { attempt_id?: string };
  const { listReviewerFeedback } = await import("@apex/shared-runtime");
  const feedbacks = listReviewerFeedback(taskId, query.attempt_id);
  return { feedbacks };
});

app.post("/api/local/tasks/:taskId/ralph-loop/evaluate-attempt", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as { attempt_id: string };
  try {
    const { evaluateAttempt } = await import("@apex/shared-runtime");
    const evaluation = evaluateAttempt(taskId, body.attempt_id);
    return evaluation;
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/tasks/:taskId/trace/start", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  try {
    const { startTrace } = await import("@apex/shared-runtime");
    const result = startTrace(taskId);
    return result;
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/tasks/:taskId/trace/spans", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { createSpan } = await import("@apex/shared-runtime");
    const span = createSpan({
      trace_id: body.trace_id as string,
      parent_span_id: body.parent_span_id as string | undefined,
      task_id: taskId,
      attempt_id: body.attempt_id as string | undefined,
      kind: body.kind as SpanKind,
      name: body.name as string,
      attributes: body.attributes as Record<string, unknown> | undefined
    });
    return { span };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/trace/spans/:spanId/end", async (request, reply) => {
  const { spanId } = request.params as { spanId: string };
  const body = request.body as { status?: SpanStatus } | undefined;
  try {
    const { endSpan } = await import("@apex/shared-runtime");
    const span = endSpan(spanId, body?.status);
    return { span };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/trace/spans/:spanId/events", async (request, reply) => {
  const { spanId } = request.params as { spanId: string };
  const body = request.body as { name: string; attributes?: Record<string, unknown> };
  try {
    const { addSpanEvent } = await import("@apex/shared-runtime");
    const span = addSpanEvent(spanId, body.name, body.attributes);
    return { span };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/trace/:traceId/spans", async request => {
  const { traceId } = request.params as { traceId: string };
  const { getTraceSpans } = await import("@apex/shared-runtime");
  const spans = getTraceSpans(traceId);
  return { spans };
});

app.get("/api/local/trace/:traceId/tree", async request => {
  const { traceId } = request.params as { traceId: string };
  const { getSpanTree } = await import("@apex/shared-runtime");
  const tree = getSpanTree(traceId);
  return tree;
});

app.post("/api/local/trace/:traceId/end", async (request, reply) => {
  const { traceId } = request.params as { traceId: string };
  const body = request.body as { status?: RunTimeline["status"] } | undefined;
  try {
    const { endTrace } = await import("@apex/shared-runtime");
    const timeline = endTrace(traceId, body?.status);
    return { timeline };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/timeline", async request => {
  const { taskId } = request.params as { taskId: string };
  const { getRunTimeline } = await import("@apex/shared-runtime");
  const timeline = getRunTimeline(taskId);
  return { timeline };
});

app.post("/api/local/tasks/:taskId/cost", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { recordCostBreakdown } = await import("@apex/shared-runtime");
    const cost = recordCostBreakdown({
      task_id: taskId,
      trace_id: body.trace_id as string,
      llm_tokens_used: body.llm_tokens_used as number | undefined,
      llm_cost_usd: body.llm_cost_usd as number | undefined,
      tool_invocations: body.tool_invocations as number | undefined,
      external_calls: body.external_calls as number | undefined,
      memory_operations: body.memory_operations as number | undefined,
      total_duration_ms: body.total_duration_ms as number | undefined
    });
    return { cost };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/cost", async request => {
  const { taskId } = request.params as { taskId: string };
  const { getCostBreakdown } = await import("@apex/shared-runtime");
  const cost = getCostBreakdown(taskId);
  return { cost };
});

app.post("/api/local/slo/metrics", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { recordSLOMetric } = await import("@apex/shared-runtime");
    const metric = recordSLOMetric({
      metric_name: body.metric_name as string,
      value: body.value as number,
      unit: body.unit as string | undefined,
      threshold: body.threshold as number | undefined,
      task_id: body.task_id as string | undefined,
      trace_id: body.trace_id as string | undefined
    });
    return { metric };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/slo/metrics", async request => {
  const query = request.query as { metric_name?: string; task_id?: string; breached?: string };
  const { getSLOMetrics } = await import("@apex/shared-runtime");
  const metrics = getSLOMetrics({
    metric_name: query.metric_name,
    task_id: query.task_id,
    breached: query.breached === "true" ? true : query.breached === "false" ? false : undefined
  });
  return { metrics };
});

app.post("/api/local/tasks/:taskId/slo/compute", async request => {
  const { taskId } = request.params as { taskId: string };
  const { computeTaskSLOs } = await import("@apex/shared-runtime");
  const metrics = computeTaskSLOs(taskId);
  return { metrics };
});

app.post("/api/local/egress/rules", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { addEgressRule } = await import("@apex/shared-runtime");
    const rule = addEgressRule({
      name: body.name as string,
      description: body.description as string | undefined,
      action: body.action as EgressRuleAction,
      destination_pattern: body.destination_pattern as string,
      destination_type: body.destination_type as EgressRule["destination_type"],
      protocol: body.protocol as EgressRule["protocol"] | undefined,
      policy_source: body.policy_source as EgressRule["policy_source"] | undefined,
      priority: body.priority as number | undefined,
      enabled: body.enabled as boolean | undefined
    });
    return { rule };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/egress/rules", async request => {
  const query = request.query as { action?: EgressRuleAction; policy_source?: EgressRule["policy_source"]; enabled?: string };
  const { listEgressRules } = await import("@apex/shared-runtime");
  const rules = listEgressRules({
    action: query.action,
    policy_source: query.policy_source,
    enabled: query.enabled === "true" ? true : query.enabled === "false" ? false : undefined
  });
  return { rules };
});

app.patch("/api/local/egress/rules/:ruleId", async (request, reply) => {
  const { ruleId } = request.params as { ruleId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { updateEgressRule } = await import("@apex/shared-runtime");
    const rule = updateEgressRule(ruleId, body as Partial<Pick<EgressRule, "name" | "description" | "action" | "destination_pattern" | "destination_type" | "protocol" | "policy_source" | "priority" | "enabled">>);
    return { rule };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.delete("/api/local/egress/rules/:ruleId", async (request, reply) => {
  const { ruleId } = request.params as { ruleId: string };
  try {
    const { removeEgressRule } = await import("@apex/shared-runtime");
    removeEgressRule(ruleId);
    return { success: true };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/egress/check", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { checkEgress } = await import("@apex/shared-runtime");
    const result = checkEgress({
      destination: body.destination as string,
      destination_type: body.destination_type as EgressRequest["destination_type"],
      protocol: body.protocol as EgressRequest["protocol"] | undefined,
      port: body.port as number | undefined,
      path: body.path as string | undefined,
      method: body.method as string | undefined,
      task_id: body.task_id as string | undefined,
      trace_id: body.trace_id as string | undefined,
      payload_size_bytes: body.payload_size_bytes as number | undefined,
      payload_summary: body.payload_summary as string | undefined
    });
    return result;
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/egress/requests/:requestId/approve", async (request, reply) => {
  const { requestId } = request.params as { requestId: string };
  const body = request.body as { approved_by: string };
  try {
    const { approveEgressRequest } = await import("@apex/shared-runtime");
    const audit = approveEgressRequest(requestId, body.approved_by);
    return { audit };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/egress/audits", async request => {
  const query = request.query as { verdict?: EgressVerdict; task_id?: string; destination?: string };
  const { listEgressAudits } = await import("@apex/shared-runtime");
  const audits = listEgressAudits({
    verdict: query.verdict,
    task_id: query.task_id,
    destination: query.destination
  });
  return { audits };
});

app.get("/api/local/egress/stats", async () => {
  const { getEgressAuditStats } = await import("@apex/shared-runtime");
  const stats = getEgressAuditStats();
  return stats;
});

app.post("/api/local/egress/initialize", async () => {
  const { initializeDefaultEgressRules } = await import("@apex/shared-runtime");
  const rules = initializeDefaultEgressRules();
  return { rules, count: rules.length };
});

app.post("/api/local/cqs/command", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { dispatchCommand } = await import("@apex/shared-runtime");
    const result = dispatchCommand({
      kind: body.kind as CQSCommandKind,
      aggregate_type: body.aggregate_type as string,
      aggregate_id: body.aggregate_id as string,
      payload: body.payload as Record<string, unknown>,
      issued_by: body.issued_by as string | undefined,
      correlation_id: body.correlation_id as string | undefined
    });
    return result;
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/cqs/query", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { executeQuery } = await import("@apex/shared-runtime");
    const result = executeQuery({
      kind: body.kind as CQSQueryKind,
      target_type: body.target_type as string,
      target_id: body.target_id as string | undefined,
      filter: body.filter as Record<string, unknown> | undefined,
      projection: body.projection as string[] | undefined,
      correlation_id: body.correlation_id as string | undefined
    });
    return result;
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/cqs/commands", async request => {
  const query = request.query as { kind?: CQSCommandKind; aggregate_type?: string; aggregate_id?: string };
  const { listCQSCommands } = await import("@apex/shared-runtime");
  const commands = listCQSCommands(query);
  return { commands };
});

app.get("/api/local/cqs/queries", async request => {
  const query = request.query as { kind?: CQSQueryKind; target_type?: string };
  const { listCQSQueries } = await import("@apex/shared-runtime");
  const queries = listCQSQueries(query);
  return { queries };
});

app.get("/api/local/cqs/events", async request => {
  const query = request.query as { kind?: CQSEventKind; aggregate_type?: string; aggregate_id?: string; caused_by_command_id?: string };
  const { listCQSEvents } = await import("@apex/shared-runtime");
  const events = listCQSEvents(query);
  return { events };
});

app.post("/api/local/experiments", async request => {
  const body = request.body as Record<string, unknown>;
  const { createExperimentRun } = await import("@apex/shared-runtime");
  const experiment = createExperimentRun({
    objective: body.objective as string,
    hypothesis: body.hypothesis as string | undefined,
    success_metric: body.success_metric as string,
    budget: body.budget as { max_attempts: number; max_tokens?: number; max_wall_clock_ms?: number; max_cost?: number },
    task_family: body.task_family as string | undefined,
    department: body.department as string | undefined
  });
  return experiment;
});

app.get("/api/local/experiments", async request => {
  const query = request.query as { status?: ExperimentStatus; task_family?: string; department?: string };
  const { listExperimentRuns } = await import("@apex/shared-runtime");
  const experiments = listExperimentRuns(query);
  return { experiments };
});

app.get("/api/local/experiments/:experimentId", async request => {
  const { experimentId } = request.params as { experimentId: string };
  const { getExperimentRun } = await import("@apex/shared-runtime");
  const experiment = getExperimentRun(experimentId);
  if (!experiment) {
    throw { statusCode: 404, message: "Experiment not found" };
  }
  return experiment;
});

app.post("/api/local/experiments/:experimentId/candidates", async request => {
  const { experimentId } = request.params as { experimentId: string };
  const body = request.body as Record<string, unknown>;
  const { addExperimentCandidate } = await import("@apex/shared-runtime");
  const experiment = addExperimentCandidate(experimentId, {
    name: body.name as string,
    description: body.description as string | undefined,
    method_type: body.method_type as "cli" | "script" | "tool" | "skill" | "mcp_server" | "worker" | "implementation",
    config: (body.config ?? {}) as Record<string, unknown>
  });
  return experiment;
});

app.post("/api/local/experiments/:experimentId/start", async request => {
  const { experimentId } = request.params as { experimentId: string };
  const { startExperimentRun } = await import("@apex/shared-runtime");
  const experiment = startExperimentRun(experimentId);
  return experiment;
});

app.post("/api/local/experiments/:experimentId/candidates/:candidateId/result", async request => {
  const { experimentId, candidateId } = request.params as { experimentId: string; candidateId: string };
  const body = request.body as Record<string, unknown>;
  const { recordExperimentCandidateResult } = await import("@apex/shared-runtime");
  const experiment = recordExperimentCandidateResult(experimentId, candidateId, {
    result: body.result,
    success_metric_value: body.success_metric_value as number | undefined,
    tokens_used: body.tokens_used as number | undefined,
    cost_incurred: body.cost_incurred as number | undefined,
    wall_clock_ms: body.wall_clock_ms as number | undefined
  });
  return experiment;
});

app.post("/api/local/experiments/:experimentId/candidates/:candidateId/fail", async request => {
  const { experimentId, candidateId } = request.params as { experimentId: string; candidateId: string };
  const { failExperimentCandidate } = await import("@apex/shared-runtime");
  const experiment = failExperimentCandidate(experimentId, candidateId);
  return experiment;
});

app.post("/api/local/experiments/:experimentId/complete", async request => {
  const { experimentId } = request.params as { experimentId: string };
  const { completeExperimentRun } = await import("@apex/shared-runtime");
  const experiment = completeExperimentRun(experimentId);
  return experiment;
});

app.post("/api/local/experiments/:experimentId/cancel", async request => {
  const { experimentId } = request.params as { experimentId: string };
  const { cancelExperimentRun } = await import("@apex/shared-runtime");
  const experiment = cancelExperimentRun(experimentId);
  return experiment;
});

app.post("/api/local/sandbox/manifests", async request => {
  const body = request.body as Record<string, unknown>;
  const { createSandboxManifest } = await import("@apex/shared-runtime");
  const manifest = createSandboxManifest({
    task_id: body.task_id as string,
    tier: body.tier as SandboxTier,
    resource_quota: body.resource_quota as { max_cpu_percent?: number; max_memory_bytes?: number; max_wall_clock_ms?: number; max_file_writes?: number; max_shell_commands?: number; max_network_calls?: number },
    filesystem_mounts: body.filesystem_mounts as { path: string; access: "readonly" | "readwrite"; max_size_bytes?: number }[] | undefined,
    egress_rule_ids: body.egress_rule_ids as string[] | undefined,
    rollback_hints: body.rollback_hints as { action: string; target: string; method: string }[] | undefined,
    compensation_available: body.compensation_available as boolean | undefined,
    ttl_ms: body.ttl_ms as number | undefined
  });
  return manifest;
});

app.get("/api/local/sandbox/manifests/:manifestId", async request => {
  const { manifestId } = request.params as { manifestId: string };
  const { getSandboxManifest } = await import("@apex/shared-runtime");
  const manifest = getSandboxManifest(manifestId);
  if (!manifest) {
    throw { statusCode: 404, message: "Sandbox manifest not found" };
  }
  return manifest;
});

app.get("/api/local/sandbox/manifests/task/:taskId", async request => {
  const { taskId } = request.params as { taskId: string };
  const { getSandboxManifestsForTask } = await import("@apex/shared-runtime");
  const manifests = getSandboxManifestsForTask(taskId);
  return { manifests };
});

app.post("/api/local/sandbox/manifests/:manifestId/tokens", async request => {
  const { manifestId } = request.params as { manifestId: string };
  const body = request.body as Record<string, unknown>;
  const { issueCapabilityToken } = await import("@apex/shared-runtime");
  const manifest = issueCapabilityToken(manifestId, body.capability as string, body.scope as string | undefined, body.ttl_ms as number | undefined);
  return manifest;
});

app.delete("/api/local/sandbox/manifests/:manifestId/tokens/:tokenId", async request => {
  const { manifestId, tokenId } = request.params as { manifestId: string; tokenId: string };
  const { revokeCapabilityToken } = await import("@apex/shared-runtime");
  const manifest = revokeCapabilityToken(manifestId, tokenId);
  return manifest;
});

app.post("/api/local/sandbox/manifests/:manifestId/check-quota", async request => {
  const { manifestId } = request.params as { manifestId: string };
  const body = request.body as Record<string, unknown>;
  const { checkSandboxQuota } = await import("@apex/shared-runtime");
  const result = checkSandboxQuota(manifestId, body.action as "file_write" | "shell_command" | "network_call");
  return result;
});

app.post("/api/local/sandbox/manifests/:manifestId/usage", async request => {
  const { manifestId } = request.params as { manifestId: string };
  const body = request.body as Record<string, unknown>;
  const { recordSandboxUsage } = await import("@apex/shared-runtime");
  const manifest = recordSandboxUsage(manifestId, {
    file_writes: body.file_writes as number | undefined,
    shell_commands: body.shell_commands as number | undefined,
    network_calls: body.network_calls as number | undefined,
    memory_peak_bytes: body.memory_peak_bytes as number | undefined,
    wall_clock_ms: body.wall_clock_ms as number | undefined
  });
  return manifest;
});

app.post("/api/local/sandbox/manifests/:manifestId/revoke", async request => {
  const { manifestId } = request.params as { manifestId: string };
  const { revokeSandboxManifest } = await import("@apex/shared-runtime");
  const manifest = revokeSandboxManifest(manifestId);
  return manifest;
});

app.post("/api/local/tasks/:taskId/control", async request => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as Record<string, unknown>;
  const { issueTaskControlCommand } = await import("@apex/shared-runtime");
  const command = issueTaskControlCommand({
    kind: body.kind as TaskControlCommandKind,
    task_id: taskId,
    reason: body.reason as string,
    correction: body.correction as string | undefined,
    new_intent: body.new_intent as string | undefined,
    issued_by: body.issued_by as string | undefined,
    resume_from_checkpoint: body.resume_from_checkpoint as boolean | undefined
  });
  return command;
});

app.get("/api/local/tasks/:taskId/control-commands", async request => {
  const { taskId } = request.params as { taskId: string };
  const query = request.query as { kind?: TaskControlCommandKind; status?: "pending" | "applied" | "rejected" };
  const { listTaskControlCommands } = await import("@apex/shared-runtime");
  const commands = listTaskControlCommands(taskId, query);
  return { commands };
});

app.post("/api/local/tasks/:taskId/interrupt/resume", async request => {
  const { taskId } = request.params as { taskId: string };
  const { resumeFromInterrupt } = await import("@apex/shared-runtime");
  const result = resumeFromInterrupt(taskId);
  return result;
});

app.post("/api/local/lineages", async request => {
  const body = request.body as Record<string, unknown>;
  const { createMethodLineage } = await import("@apex/shared-runtime");
  const lineage = createMethodLineage({
    asset_type: body.asset_type as "skill" | "template" | "playbook" | "method",
    asset_id: body.asset_id as string,
    mutation_kind: body.mutation_kind as LineageMutationKind,
    mutation_reason: body.mutation_reason as string,
    snapshot: body.snapshot as Record<string, unknown>,
    mutation_source_id: body.mutation_source_id as string | undefined,
    parent_lineage_id: body.parent_lineage_id as string | undefined,
    created_by: body.created_by as string | undefined,
    tags: body.tags as string[] | undefined
  });
  return lineage;
});

app.get("/api/local/lineages", async request => {
  const query = request.query as { asset_type?: "skill" | "template" | "playbook" | "method"; mutation_kind?: LineageMutationKind; is_active?: string; tags?: string };
  const { listMethodLineages } = await import("@apex/shared-runtime");
  const lineages = listMethodLineages({
    asset_type: query.asset_type,
    mutation_kind: query.mutation_kind,
    is_active: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined,
    tags: query.tags ? query.tags.split(",") : undefined
  });
  return { lineages };
});

app.get("/api/local/lineages/:lineageId", async request => {
  const { lineageId } = request.params as { lineageId: string };
  const { getMethodLineage } = await import("@apex/shared-runtime");
  const lineage = getMethodLineage(lineageId);
  if (!lineage) {
    throw { statusCode: 404, message: "Lineage not found" };
  }
  return lineage;
});

app.get("/api/local/lineages/:lineageId/chain", async request => {
  const { lineageId } = request.params as { lineageId: string };
  const { getLineageChain } = await import("@apex/shared-runtime");
  const chain = getLineageChain(lineageId);
  return { chain };
});

app.get("/api/local/lineages/asset/:assetType/:assetId/active", async request => {
  const { assetType, assetId } = request.params as { assetType: "skill" | "template" | "playbook" | "method"; assetId: string };
  const { getActiveLineageForAsset } = await import("@apex/shared-runtime");
  const lineage = getActiveLineageForAsset(assetType, assetId);
  if (!lineage) {
    throw { statusCode: 404, message: "No active lineage for this asset" };
  }
  return lineage;
});

app.get("/api/local/lineages/asset/:assetType/:assetId/history", async request => {
  const { assetType, assetId } = request.params as { assetType: "skill" | "template" | "playbook" | "method"; assetId: string };
  const { getLineageHistory } = await import("@apex/shared-runtime");
  const history = getLineageHistory(assetType, assetId);
  return { history };
});

app.post("/api/local/lineages/:lineageId/evaluation", async request => {
  const { lineageId } = request.params as { lineageId: string };
  const body = request.body as Record<string, unknown>;
  const { recordLineageEvaluation } = await import("@apex/shared-runtime");
  const lineage = recordLineageEvaluation(lineageId, {
    score: body.score as number | undefined,
    passed: body.passed as boolean | undefined,
    metric_name: body.metric_name as string | undefined,
    metric_value: body.metric_value as number | undefined
  });
  return lineage;
});

app.post("/api/local/metrics/compute", async request => {
  const body = request.body as Record<string, unknown>;
  const { computeOperationalMetrics } = await import("@apex/shared-runtime");
  const metrics = computeOperationalMetrics({
    window: body.window as MetricsWindow,
    window_start: body.window_start as string,
    window_end: body.window_end as string,
    department: body.department as string | undefined,
    task_family: body.task_family as string | undefined
  });
  return metrics;
});

app.get("/api/local/metrics", async request => {
  const query = request.query as { window?: MetricsWindow; department?: string; task_family?: string };
  const { listOperationalMetrics } = await import("@apex/shared-runtime");
  const metrics = listOperationalMetrics(query);
  return { metrics };
});

app.get("/api/local/metrics/:metricsId", async request => {
  const { metricsId } = request.params as { metricsId: string };
  const { getOperationalMetrics } = await import("@apex/shared-runtime");
  const metrics = getOperationalMetrics(metricsId);
  if (!metrics) {
    throw { statusCode: 404, message: "Metrics not found" };
  }
  return metrics;
});

app.post("/api/local/replay/packages", async request => {
  const body = request.body as Record<string, unknown>;
  const { createReplayPackage } = await import("@apex/shared-runtime");
  const pkg = createReplayPackage({
    name: body.name as string,
    description: body.description as string | undefined,
    task_id: body.task_id as string | undefined,
    time_range_start: body.time_range_start as string,
    time_range_end: body.time_range_end as string,
    event_kinds: body.event_kinds as string[] | undefined,
    created_by: body.created_by as string | undefined
  });
  return pkg;
});

app.get("/api/local/replay/packages", async request => {
  const query = request.query as { task_id?: string; status?: "building" | "ready" | "error" };
  const { listReplayPackages } = await import("@apex/shared-runtime");
  const packages = listReplayPackages(query);
  return { packages };
});

app.get("/api/local/replay/packages/:packageId", async request => {
  const { packageId } = request.params as { packageId: string };
  const { getReplayPackage } = await import("@apex/shared-runtime");
  const pkg = getReplayPackage(packageId);
  if (!pkg) {
    throw { statusCode: 404, message: "Replay package not found" };
  }
  return pkg;
});

app.get("/api/local/replay/packages/:packageId/events", async request => {
  const { packageId } = request.params as { packageId: string };
  const { getReplayPackageEvents } = await import("@apex/shared-runtime");
  const events = getReplayPackageEvents(packageId);
  return { events };
});

app.post("/api/local/replay/packages/:packageId/annotations", async request => {
  const { packageId } = request.params as { packageId: string };
  const body = request.body as Record<string, unknown>;
  const { addReplayAnnotation } = await import("@apex/shared-runtime");
  const pkg = addReplayAnnotation(packageId, {
    event_id: body.event_id as string,
    note: body.note as string,
    severity: body.severity as "info" | "warning" | "critical" | undefined,
    annotated_by: body.annotated_by as string | undefined
  });
  return pkg;
});

app.post("/api/local/replay/packages/:packageId/snapshot", async request => {
  const { packageId } = request.params as { packageId: string };
  const { captureReplayStateSnapshot } = await import("@apex/shared-runtime");
  const pkg = captureReplayStateSnapshot(packageId);
  return pkg;
});

app.post("/api/local/model/routes", async request => {
  const body = request.body as Record<string, unknown>;
  const { createModelRoute } = await import("@apex/shared-runtime");
  const route = createModelRoute({
    model_alias: body.model_alias as string,
    provider: body.provider as ModelProvider,
    model_id: body.model_id as string,
    max_privacy_level: body.max_privacy_level as PrivacyLevel,
    priority: body.priority as number | undefined,
    max_tokens: body.max_tokens as number | undefined,
    temperature: body.temperature as number | undefined,
    fallback_route_id: body.fallback_route_id as string | undefined
  });
  return route;
});

app.get("/api/local/model/routes", async request => {
  const query = request.query as { model_alias?: string; provider?: ModelProvider; is_active?: string };
  const { listModelRoutes } = await import("@apex/shared-runtime");
  const routes = listModelRoutes({
    model_alias: query.model_alias,
    provider: query.provider,
    is_active: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined
  });
  return { routes };
});

app.get("/api/local/model/routes/:routeId", async request => {
  const { routeId } = request.params as { routeId: string };
  const { getModelRoute } = await import("@apex/shared-runtime");
  const route = getModelRoute(routeId);
  if (!route) {
    throw { statusCode: 404, message: "Model route not found" };
  }
  return route;
});

app.post("/api/local/model/resolve", async request => {
  const body = request.body as Record<string, unknown>;
  const { resolveModelRoute } = await import("@apex/shared-runtime");
  const route = resolveModelRoute(body.model_alias as string, body.privacy_level as PrivacyLevel);
  if (!route) {
    throw { statusCode: 404, message: "No compatible model route found" };
  }
  return route;
});

app.post("/api/local/model/requests", async request => {
  const body = request.body as Record<string, unknown>;
  const { recordModelRequest } = await import("@apex/shared-runtime");
  const modelRequest = recordModelRequest({
    route_id: body.route_id as string,
    task_id: body.task_id as string | undefined,
    model_alias: body.model_alias as string,
    provider: body.provider as ModelProvider,
    model_id: body.model_id as string,
    privacy_level: body.privacy_level as PrivacyLevel,
    input_tokens: body.input_tokens as number | undefined,
    output_tokens: body.output_tokens as number | undefined,
    cost_usd: body.cost_usd as number | undefined,
    latency_ms: body.latency_ms as number | undefined,
    status: body.status as "pending" | "success" | "error" | "rate_limited" | "fallback",
    error_message: body.error_message as string | undefined,
    retry_count: body.retry_count as number | undefined
  });
  return modelRequest;
});

app.get("/api/local/model/requests", async request => {
  const query = request.query as { task_id?: string; route_id?: string; provider?: ModelProvider; status?: string };
  const { listModelRequests } = await import("@apex/shared-runtime");
  const requests = listModelRequests(query);
  return { requests };
});

app.get("/api/local/model/cost-summary", async request => {
  const query = request.query as { task_id?: string; provider?: ModelProvider };
  const { getModelCostSummary } = await import("@apex/shared-runtime");
  const summary = getModelCostSummary(query);
  return summary;
});

app.post("/api/local/model/call", async request => {
  const body = request.body as Record<string, unknown>;
  const { callLLM } = await import("@apex/shared-runtime");
  const result = await callLLM({
    model_alias: body.model_alias as string,
    privacy_level: body.privacy_level as PrivacyLevel,
    task_id: body.task_id as string | undefined,
    messages: body.messages as { role: "system" | "user" | "assistant" | "tool"; content: string }[],
    max_tokens: body.max_tokens as number | undefined,
    temperature: body.temperature as number | undefined,
    response_format: body.response_format as { type: "json_object" | "text" } | undefined,
    structured_output_schema: body.structured_output_schema as Record<string, unknown> | undefined,
    max_retries: body.max_retries as number | undefined,
    retry_base_delay_ms: body.retry_base_delay_ms as number | undefined,
    timeout_ms: body.timeout_ms as number | undefined
  });
  return result;
});

app.post("/api/local/model/validate-output", async request => {
  const body = request.body as Record<string, unknown>;
  const { validateStructuredOutput } = await import("@apex/shared-runtime");
  const result = validateStructuredOutput(
    body.content as string,
    body.schema as Record<string, unknown>
  );
  return result;
});

app.get("/api/local/model/quotas", async () => {
  const { getAllProviderQuotas } = await import("@apex/shared-runtime");
  const quotas = getAllProviderQuotas();
  return { quotas };
});

app.post("/api/local/model/quotas/:provider", async request => {
  const { provider } = request.params as { provider: ModelProvider };
  const body = request.body as Record<string, unknown>;
  const { setProviderQuota } = await import("@apex/shared-runtime");
  const quota = setProviderQuota(provider, {
    max_requests_per_minute: body.max_requests_per_minute as number | undefined,
    max_tokens_per_minute: body.max_tokens_per_minute as number | undefined,
    max_cost_per_day_usd: body.max_cost_per_day_usd as number | undefined
  });
  return quota;
});

app.post("/api/local/automation/definitions", async request => {
  const body = request.body as Record<string, unknown>;
  const { createAutomationDefinition } = await import("@apex/shared-runtime");
  const def = createAutomationDefinition({
    name: body.name as string,
    description: body.description as string | undefined,
    trigger_kind: body.trigger_kind as "schedule" | "event" | "webhook" | "manual",
    trigger_config: body.trigger_config as Record<string, unknown> | undefined,
    task_template: body.task_template as {
      intent: string;
      department: string;
      task_type: string;
      priority?: string;
      inputs?: Record<string, unknown>;
    },
    dedup_strategy: body.dedup_strategy as "none" | "exact_intent" | "fingerprint" | "window" | undefined,
    dedup_window_ms: body.dedup_window_ms as number | undefined,
    recursion_policy: body.recursion_policy as "allow" | "block" | "max_depth" | undefined,
    max_recursion_depth: body.max_recursion_depth as number | undefined
  });
  return def;
});

app.get("/api/local/automation/definitions", async request => {
  const query = request.query as { trigger_kind?: string; is_active?: string };
  const { listAutomationDefinitions } = await import("@apex/shared-runtime");
  const definitions = listAutomationDefinitions({
    trigger_kind: query.trigger_kind as "schedule" | "event" | "webhook" | "manual" | undefined,
    is_active: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined
  });
  return { definitions };
});

app.get("/api/local/automation/definitions/:automationId", async request => {
  const { automationId } = request.params as { automationId: string };
  const { getAutomationDefinition } = await import("@apex/shared-runtime");
  const def = getAutomationDefinition(automationId);
  if (!def) {
    throw { statusCode: 404, message: "Automation definition not found" };
  }
  return def;
});

app.post("/api/local/automation/definitions/:automationId/trigger", async request => {
  const { automationId } = request.params as { automationId: string };
  const body = request.body as Record<string, unknown>;
  const { triggerAutomation } = await import("@apex/shared-runtime");
  const record = triggerAutomation(automationId, (body.recursion_depth as number) ?? 0);
  return record;
});

app.post("/api/local/automation/definitions/:automationId/detect-missed", async request => {
  const { automationId } = request.params as { automationId: string };
  const { detectMissedTriggers } = await import("@apex/shared-runtime");
  const missed = detectMissedTriggers(automationId);
  return { missed_count: missed.length, records: missed };
});

app.get("/api/local/automation/trigger-records", async request => {
  const query = request.query as { automation_id?: string; was_deduplicated?: string };
  const { listAutomationTriggerRecords } = await import("@apex/shared-runtime");
  const records = listAutomationTriggerRecords({
    automation_id: query.automation_id,
    was_deduplicated: query.was_deduplicated === "true" ? true : query.was_deduplicated === "false" ? false : undefined
  });
  return { records };
});

app.post("/api/local/wiki/pages", async request => {
  const body = request.body as Record<string, unknown>;
  const { createWikiPage } = await import("@apex/shared-runtime");
  const page = createWikiPage({
    title: body.title as string,
    page_class: body.page_class as "sop" | "troubleshooting" | "decision_record" | "connector_guide" | "department_brief" | "domain_notes" | "tool_usage_guide",
    content_markdown: body.content_markdown as string,
    owners: body.owners as string[] | undefined,
    tags: body.tags as string[] | undefined,
    linked_skill_ids: body.linked_skill_ids as string[] | undefined,
    linked_template_ids: body.linked_template_ids as string[] | undefined
  });
  return page;
});

app.get("/api/local/wiki/pages", async request => {
  const query = request.query as { page_class?: string; status?: string; tag?: string; owner?: string };
  const { listWikiPages } = await import("@apex/shared-runtime");
  const pages = listWikiPages({
    page_class: query.page_class as "sop" | "troubleshooting" | "decision_record" | "connector_guide" | "department_brief" | "domain_notes" | "tool_usage_guide" | undefined,
    status: query.status as "draft" | "published" | "stale" | "retired" | undefined,
    tag: query.tag,
    owner: query.owner
  });
  return { pages };
});

app.get("/api/local/wiki/pages/:pageId", async request => {
  const { pageId } = request.params as { pageId: string };
  const { getWikiPage } = await import("@apex/shared-runtime");
  const page = getWikiPage(pageId);
  if (!page) {
    throw { statusCode: 404, message: "Wiki page not found" };
  }
  return page;
});

app.patch("/api/local/wiki/pages/:pageId", async request => {
  const { pageId } = request.params as { pageId: string };
  const body = request.body as Record<string, unknown>;
  const { updateWikiPage } = await import("@apex/shared-runtime");
  const page = updateWikiPage(pageId, {
    title: body.title as string | undefined,
    content_markdown: body.content_markdown as string | undefined,
    page_class: body.page_class as "sop" | "troubleshooting" | "decision_record" | "connector_guide" | "department_brief" | "domain_notes" | "tool_usage_guide" | undefined,
    status: body.status as "draft" | "published" | "stale" | "retired" | undefined,
    owners: body.owners as string[] | undefined,
    tags: body.tags as string[] | undefined,
    linked_skill_ids: body.linked_skill_ids as string[] | undefined,
    linked_template_ids: body.linked_template_ids as string[] | undefined
  });
  return page;
});

app.post("/api/local/wiki/compile", async () => {
  const { compileWiki } = await import("@apex/shared-runtime");
  const result = compileWiki();
  return result;
});

app.get("/api/local/wiki/search", async request => {
  const query = request.query as { q?: string };
  const { searchWikiPages } = await import("@apex/shared-runtime");
  const pages = searchWikiPages(query.q ?? "");
  return { pages };
});

app.post("/api/local/execution-steps", async request => {
  const body = request.body as Record<string, unknown>;
  const { createExecutionStep } = await import("@apex/shared-runtime");
  const step = createExecutionStep({
    task_id: body.task_id as string,
    run_id: body.run_id as string | undefined,
    attempt_id: body.attempt_id as string | undefined,
    parent_step_id: body.parent_step_id as string | undefined,
    kind: body.kind as "planning" | "tool_invocation" | "capability_resolution" | "verification" | "policy_check" | "memory_capture" | "learning" | "execution" | "approval" | "external_call" | "subtask_dispatch" | "checkpoint",
    label: body.label as string,
    input: body.input as Record<string, unknown> | undefined
  });
  return step;
});

app.get("/api/local/execution-steps", async request => {
  const query = request.query as { task_id?: string; run_id?: string; attempt_id?: string; kind?: string; status?: string };
  const { listExecutionSteps } = await import("@apex/shared-runtime");
  if (!query.task_id) {
    throw { statusCode: 400, message: "task_id is required" };
  }
  const steps = listExecutionSteps({
    task_id: query.task_id,
    run_id: query.run_id,
    attempt_id: query.attempt_id,
    kind: query.kind as "planning" | "tool_invocation" | "capability_resolution" | "verification" | "policy_check" | "memory_capture" | "learning" | "execution" | "approval" | "external_call" | "subtask_dispatch" | "checkpoint" | undefined,
    status: query.status as "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled" | undefined
  });
  return { steps };
});

app.get("/api/local/execution-steps/:stepId", async request => {
  const { stepId } = request.params as { stepId: string };
  const { getExecutionStep } = await import("@apex/shared-runtime");
  const step = getExecutionStep(stepId);
  if (!step) {
    throw { statusCode: 404, message: "Execution step not found" };
  }
  return step;
});

app.post("/api/local/execution-steps/:stepId/start", async request => {
  const { stepId } = request.params as { stepId: string };
  const { startExecutionStep } = await import("@apex/shared-runtime");
  const step = startExecutionStep(stepId);
  return step;
});

app.post("/api/local/execution-steps/:stepId/complete", async request => {
  const { stepId } = request.params as { stepId: string };
  const body = request.body as Record<string, unknown>;
  const { completeExecutionStep } = await import("@apex/shared-runtime");
  const step = completeExecutionStep(stepId, body.output as Record<string, unknown> | undefined);
  return step;
});

app.post("/api/local/execution-steps/:stepId/fail", async request => {
  const { stepId } = request.params as { stepId: string };
  const body = request.body as Record<string, unknown>;
  const { failExecutionStep } = await import("@apex/shared-runtime");
  const step = failExecutionStep(stepId, body.error as string);
  return step;
});

app.post("/api/local/execution-steps/:stepId/retry", async request => {
  const { stepId } = request.params as { stepId: string };
  const { retryExecutionStep } = await import("@apex/shared-runtime");
  const step = retryExecutionStep(stepId);
  return step;
});

app.post("/api/local/execution-steps/:stepId/link-evidence", async request => {
  const { stepId } = request.params as { stepId: string };
  const body = request.body as Record<string, unknown>;
  const { linkStepEvidence } = await import("@apex/shared-runtime");
  const step = linkStepEvidence(stepId, body.evidence_node_id as string);
  return step;
});

app.get("/api/local/tasks/:taskId/execution-step-tree", async request => {
  const { taskId } = request.params as { taskId: string };
  const { getExecutionStepTree } = await import("@apex/shared-runtime");
  const tree = getExecutionStepTree(taskId);
  return tree;
});

app.post("/api/local/task-runs", async request => {
  const body = request.body as Record<string, unknown>;
  const { createTaskRun } = await import("@apex/shared-runtime");
  const run = createTaskRun(body.task_id as string);
  return run;
});

app.get("/api/local/task-runs", async request => {
  const query = request.query as { task_id?: string };
  const { listTaskRuns } = await import("@apex/shared-runtime");
  if (!query.task_id) {
    throw { statusCode: 400, message: "task_id is required" };
  }
  const runs = listTaskRuns(query.task_id);
  return { runs };
});

app.get("/api/local/task-runs/:runId", async request => {
  const { runId } = request.params as { runId: string };
  const { getTaskRun } = await import("@apex/shared-runtime");
  const run = getTaskRun(runId);
  if (!run) {
    throw { statusCode: 404, message: "TaskRun not found" };
  }
  return run;
});

app.post("/api/local/task-runs/:runId/start", async request => {
  const { runId } = request.params as { runId: string };
  const { startTaskRun } = await import("@apex/shared-runtime");
  const run = startTaskRun(runId);
  return run;
});

app.post("/api/local/task-runs/:runId/complete", async request => {
  const { runId } = request.params as { runId: string };
  const { completeTaskRun } = await import("@apex/shared-runtime");
  const run = completeTaskRun(runId);
  return run;
});

app.post("/api/local/task-runs/:runId/fail", async request => {
  const { runId } = request.params as { runId: string };
  const { failTaskRun } = await import("@apex/shared-runtime");
  const run = failTaskRun(runId);
  return run;
});

app.post("/api/local/task-attempts", async request => {
  const body = request.body as Record<string, unknown>;
  const { createTaskAttempt } = await import("@apex/shared-runtime");
  const attempt = createTaskAttempt({
    run_id: body.run_id as string,
    task_id: body.task_id as string,
    parent_attempt_id: body.parent_attempt_id as string | undefined
  });
  return attempt;
});

app.get("/api/local/task-attempts", async request => {
  const query = request.query as { run_id?: string };
  const { listTaskAttempts } = await import("@apex/shared-runtime");
  if (!query.run_id) {
    throw { statusCode: 400, message: "run_id is required" };
  }
  const attempts = listTaskAttempts(query.run_id);
  return { attempts };
});

app.get("/api/local/task-attempts/:attemptId", async request => {
  const { attemptId } = request.params as { attemptId: string };
  const { getTaskAttempt } = await import("@apex/shared-runtime");
  const attempt = getTaskAttempt(attemptId);
  if (!attempt) {
    throw { statusCode: 404, message: "TaskAttempt not found" };
  }
  return attempt;
});

app.post("/api/local/task-attempts/:attemptId/start", async request => {
  const { attemptId } = request.params as { attemptId: string };
  const { startTaskAttempt } = await import("@apex/shared-runtime");
  const attempt = startTaskAttempt(attemptId);
  return attempt;
});

app.post("/api/local/task-attempts/:attemptId/complete", async request => {
  const { attemptId } = request.params as { attemptId: string };
  const body = request.body as Record<string, unknown>;
  const { completeTaskAttempt } = await import("@apex/shared-runtime");
  const attempt = completeTaskAttempt(attemptId, body.verdict as "accepted" | "accepted_with_notes" | "revise_and_retry" | "blocked" | undefined);
  return attempt;
});

app.post("/api/local/task-attempts/:attemptId/fail", async request => {
  const { attemptId } = request.params as { attemptId: string };
  const { failTaskAttempt } = await import("@apex/shared-runtime");
  const attempt = failTaskAttempt(attemptId);
  return attempt;
});

app.post("/api/local/worker-sessions", async request => {
  const body = request.body as Record<string, unknown>;
  const { createWorkerSession } = await import("@apex/shared-runtime");
  const session = createWorkerSession({
    worker_id: body.worker_id as string,
    task_id: body.task_id as string | undefined,
    run_id: body.run_id as string | undefined
  });
  return session;
});

app.get("/api/local/worker-sessions", async request => {
  const query = request.query as { worker_id?: string; status?: string };
  const { listWorkerSessions } = await import("@apex/shared-runtime");
  const sessions = listWorkerSessions({
    worker_id: query.worker_id,
    status: query.status as "active" | "idle" | "terminated" | "expired" | undefined
  });
  return { sessions };
});

app.get("/api/local/worker-sessions/:sessionId", async request => {
  const { sessionId } = request.params as { sessionId: string };
  const { getWorkerSession } = await import("@apex/shared-runtime");
  const session = getWorkerSession(sessionId);
  if (!session) {
    throw { statusCode: 404, message: "WorkerSession not found" };
  }
  return session;
});

app.post("/api/local/worker-sessions/:sessionId/heartbeat", async request => {
  const { sessionId } = request.params as { sessionId: string };
  const { heartbeatWorkerSession } = await import("@apex/shared-runtime");
  const session = heartbeatWorkerSession(sessionId);
  return session;
});

app.post("/api/local/worker-sessions/:sessionId/terminate", async request => {
  const { sessionId } = request.params as { sessionId: string };
  const { terminateWorkerSession } = await import("@apex/shared-runtime");
  const session = terminateWorkerSession(sessionId);
  return session;
});

app.post("/api/local/sandbox-leases", async request => {
  const body = request.body as Record<string, unknown>;
  const { createSandboxLease } = await import("@apex/shared-runtime");
  const lease = createSandboxLease({
    task_id: body.task_id as string,
    attempt_id: body.attempt_id as string | undefined,
    sandbox_manifest_id: body.sandbox_manifest_id as string | undefined,
    tier: body.tier as "host_readonly" | "guarded_mutation" | "isolated_mutation" | undefined,
    expires_at: body.expires_at as string | undefined
  });
  return lease;
});

app.get("/api/local/sandbox-leases", async request => {
  const query = request.query as { task_id?: string };
  const { listSandboxLeases } = await import("@apex/shared-runtime");
  if (!query.task_id) {
    throw { statusCode: 400, message: "task_id is required" };
  }
  const leases = listSandboxLeases(query.task_id);
  return { leases };
});

app.get("/api/local/sandbox-leases/:leaseId", async request => {
  const { leaseId } = request.params as { leaseId: string };
  const { getSandboxLease } = await import("@apex/shared-runtime");
  const lease = getSandboxLease(leaseId);
  if (!lease) {
    throw { statusCode: 404, message: "SandboxLease not found" };
  }
  return lease;
});

app.post("/api/local/sandbox-leases/:leaseId/release", async request => {
  const { leaseId } = request.params as { leaseId: string };
  const { releaseSandboxLease } = await import("@apex/shared-runtime");
  const lease = releaseSandboxLease(leaseId);
  return lease;
});

app.post("/api/local/sandbox-leases/:leaseId/revoke", async request => {
  const { leaseId } = request.params as { leaseId: string };
  const { revokeSandboxLease } = await import("@apex/shared-runtime");
  const lease = revokeSandboxLease(leaseId);
  return lease;
});

app.post("/api/local/sandbox-leases/enforce-expiry", async () => {
  const { enforceSandboxLeaseExpiry } = await import("@apex/shared-runtime");
  const expired = enforceSandboxLeaseExpiry();
  return { expired_count: expired.length, expired_leases: expired.map(l => ({ lease_id: l.lease_id, task_id: l.task_id, tier: l.tier })) };
});

app.post("/api/local/worker-sessions/detect-expired", async request => {
  const body = request.body as { heartbeat_timeout_ms?: number } | null;
  const { detectExpiredWorkerSessions } = await import("@apex/shared-runtime");
  const expired = detectExpiredWorkerSessions(body?.heartbeat_timeout_ms);
  return { expired_count: expired.length, expired_sessions: expired.map(s => ({ session_id: s.session_id, worker_id: s.worker_id, last_heartbeat_at: s.last_heartbeat_at })) };
});

app.post("/api/local/automation/match-event", async request => {
  const body = request.body as Record<string, unknown>;
  const { matchEventTriggers } = await import("@apex/shared-runtime");
  const records = matchEventTriggers({
    event_type: body.event_type as string,
    source: body.source as string,
    payload: body.payload as Record<string, unknown>
  });
  return { matched_count: records.length, records };
});

app.post("/api/local/execution-steps/enforce-timeouts", async request => {
  const body = request.body as { timeout_ms?: number } | null;
  const { enforceExecutionStepTimeouts } = await import("@apex/shared-runtime");
  const timedOut = enforceExecutionStepTimeouts(body?.timeout_ms);
  return { timed_out_count: timedOut.length, timed_out_steps: timedOut.map(s => ({ step_id: s.step_id, task_id: s.task_id, kind: s.kind })) };
});

app.post("/api/local/runtime/maintenance-cycle", async request => {
  const body = request.body as { heartbeat_timeout_ms?: number; step_timeout_ms?: number } | null | undefined;
  const { runRuntimeMaintenanceCycle } = await import("@apex/shared-runtime");
  const result = runRuntimeMaintenanceCycle(body ?? undefined);
  return {
    expired_sessions_count: result.expired_sessions.length,
    expired_leases_count: result.expired_leases.length,
    timed_out_steps_count: result.timed_out_steps.length,
    expired_sessions: result.expired_sessions.map(s => ({ session_id: s.session_id, worker_id: s.worker_id })),
    expired_leases: result.expired_leases.map(l => ({ lease_id: l.lease_id, task_id: l.task_id })),
    timed_out_steps: result.timed_out_steps.map(s => ({ step_id: s.step_id, task_id: s.task_id }))
  };
});

app.post("/api/local/task-runs/auto-create", async request => {
  const body = request.body as Record<string, unknown>;
  const { createTaskRunFromTask } = await import("@apex/shared-runtime");
  const run = createTaskRunFromTask(body.task_id as string);
  return run;
});

app.post("/api/local/task-runs/auto-start", async request => {
  const body = request.body as Record<string, unknown>;
  const { startTaskRunFromTask } = await import("@apex/shared-runtime");
  const run = startTaskRunFromTask(body.task_id as string);
  return run;
});

app.post("/api/local/execution-steps/pipeline", async request => {
  const body = request.body as Record<string, unknown>;
  const { createPipelineStepsForTask } = await import("@apex/shared-runtime");
  const steps = createPipelineStepsForTask(body.task_id as string, body.run_id as string | undefined);
  return { step_count: steps.length, steps: steps.map(s => ({ step_id: s.step_id, kind: s.kind, label: s.label, status: s.status })) };
});

app.post("/api/local/execution-steps/advance-pipeline", async request => {
  const body = request.body as Record<string, unknown>;
  const { advancePipelineStep } = await import("@apex/shared-runtime");
  const nextStep = advancePipelineStep(body.task_id as string, body.current_step_kind as "planning" | "checkpoint" | "approval" | "policy_check" | "tool_invocation" | "capability_resolution" | "verification" | "memory_capture" | "learning" | "execution" | "external_call" | "subtask_dispatch");
  return nextStep ? { step_id: nextStep.step_id, kind: nextStep.kind, label: nextStep.label, status: nextStep.status } : { completed: true };
});

app.post("/api/local/execution-steps/:stepId/record-cost", async request => {
  const { stepId } = request.params as { stepId: string };
  const body = request.body as Record<string, unknown>;
  const { recordStepCost } = await import("@apex/shared-runtime");
  const step = recordStepCost({
    step_id: stepId,
    model_alias: body.model_alias as string | undefined,
    provider: body.provider as string | undefined,
    input_tokens: body.input_tokens as number | undefined,
    output_tokens: body.output_tokens as number | undefined,
    cost_usd: body.cost_usd as number | undefined,
    tool_invocations: body.tool_invocations as number | undefined,
    external_calls: body.external_calls as number | undefined,
    memory_operations: body.memory_operations as number | undefined
  });
  return step;
});

app.get("/api/local/execution-steps/cost-summary/:taskId", async request => {
  const { taskId } = request.params as { taskId: string };
  const { getStepCostSummary } = await import("@apex/shared-runtime");
  const summary = getStepCostSummary(taskId);
  return summary;
});

app.post("/api/local/cron/parse", async request => {
  const body = request.body as Record<string, unknown>;
  const { parseCronExpression, describeCronExpression } = await import("@apex/shared-runtime");
  const expr = parseCronExpression(body.expression as string);
  const description = describeCronExpression(body.expression as string);
  return { expression: expr.original, description, minute: expr.minute, hour: expr.hour, day_of_month: expr.day_of_month, month: expr.month, day_of_week: expr.day_of_week };
});

app.post("/api/local/cron/next-fire", async request => {
  const body = request.body as Record<string, unknown>;
  const { getNextCronFireTime } = await import("@apex/shared-runtime");
  const result = getNextCronFireTime(body.expression as string, body.from_time ? new Date(body.from_time as string) : undefined);
  return result;
});

app.post("/api/local/cron/validate", async request => {
  const body = request.body as Record<string, unknown>;
  const { isValidCronExpression } = await import("@apex/shared-runtime");
  const result = isValidCronExpression(body.expression as string);
  return result;
});

app.post("/api/local/execution-harnesses", async request => {
  const body = request.body as Record<string, unknown>;
  const { createExecutionHarness } = await import("@apex/shared-runtime");
  const harness = createExecutionHarness({
    task_id: body.task_id as string,
    step_id: body.step_id as string | undefined,
    kind: body.kind as "code_change" | "connector_call" | "browser_automation" | "shell_command" | "file_write" | "external_api",
    label: body.label as string,
    fixed_input: body.fixed_input as Record<string, unknown>,
    expected_output: body.expected_output as Record<string, unknown>,
    timeout_ms: body.timeout_ms as number | undefined,
    rollback_available: body.rollback_available as boolean | undefined
  });
  return harness;
});

app.get("/api/local/execution-harnesses", async request => {
  const query = request.query as { task_id?: string; kind?: string; status?: string };
  const { listExecutionHarnesses } = await import("@apex/shared-runtime");
  if (!query.task_id) {
    throw { statusCode: 400, message: "task_id is required" };
  }
  const harnesses = listExecutionHarnesses(query.task_id, {
    kind: query.kind as "code_change" | "connector_call" | "browser_automation" | "shell_command" | "file_write" | "external_api" | undefined,
    status: query.status as "pending" | "running" | "passed" | "failed" | "timed_out" | "skipped" | "error" | undefined
  });
  return { harnesses };
});

app.get("/api/local/execution-harnesses/:harnessId", async request => {
  const { harnessId } = request.params as { harnessId: string };
  const { getExecutionHarness } = await import("@apex/shared-runtime");
  const harness = getExecutionHarness(harnessId);
  if (!harness) {
    throw { statusCode: 404, message: "ExecutionHarness not found" };
  }
  return harness;
});

app.post("/api/local/execution-harnesses/:harnessId/run", async request => {
  const { harnessId } = request.params as { harnessId: string };
  const body = request.body as Record<string, unknown>;
  const { runExecutionHarness } = await import("@apex/shared-runtime");
  const executeFn = (input: Record<string, unknown>) => (body.execute_fn ?? input) as Record<string, unknown>;
  const harness = runExecutionHarness(harnessId, executeFn);
  return harness;
});

app.post("/api/local/execution-harnesses/:harnessId/timeout", async request => {
  const { harnessId } = request.params as { harnessId: string };
  const { timeoutExecutionHarness } = await import("@apex/shared-runtime");
  const harness = timeoutExecutionHarness(harnessId);
  return harness;
});

app.post("/api/local/execution-harnesses/:harnessId/rollback", async request => {
  const { harnessId } = request.params as { harnessId: string };
  const { rollbackExecutionHarness } = await import("@apex/shared-runtime");
  const harness = rollbackExecutionHarness(harnessId);
  return harness;
});

app.post("/api/local/reuse-feedbacks", async request => {
  const body = request.body as Record<string, unknown>;
  const { submitReuseFeedback } = await import("@apex/shared-runtime");
  const feedback = submitReuseFeedback({
    task_id: body.task_id as string,
    kind: body.kind as "accept_recommendation" | "ignore_recommendation" | "prefer_template" | "reject_playbook" | "approve_methodology",
    target_type: body.target_type as "playbook" | "template" | "skill" | "methodology" | "capability",
    target_id: body.target_id as string,
    preferred_alternative_id: body.preferred_alternative_id as string | undefined,
    reason: body.reason as string | undefined,
    user_id: body.user_id as string | undefined
  });
  return feedback;
});

app.get("/api/local/reuse-feedbacks", async request => {
  const query = request.query as { task_id?: string; kind?: string; target_type?: string };
  const { listReuseFeedbacks } = await import("@apex/shared-runtime");
  if (!query.task_id) {
    throw { statusCode: 400, message: "task_id is required" };
  }
  const feedbacks = listReuseFeedbacks(query.task_id, {
    kind: query.kind as "accept_recommendation" | "ignore_recommendation" | "prefer_template" | "reject_playbook" | "approve_methodology" | undefined,
    target_type: query.target_type
  });
  return { feedbacks };
});

app.get("/api/local/reuse-feedbacks/stats", async request => {
  const query = request.query as { task_id?: string };
  const { getReuseFeedbackStats } = await import("@apex/shared-runtime");
  if (!query.task_id) {
    throw { statusCode: 400, message: "task_id is required" };
  }
  const stats = getReuseFeedbackStats(query.task_id);
  return stats;
});

app.post("/api/local/egress-aware-fetch", async request => {
  const body = request.body as Record<string, unknown>;
  const { egressAwareFetch } = await import("@apex/shared-runtime");
  const result = await egressAwareFetch(body.url as string, {
    task_id: body.task_id as string | undefined,
    trace_id: body.trace_id as string | undefined,
    method: body.method as string | undefined,
    headers: body.headers as Record<string, string> | undefined,
    body: body.body,
    payload_summary: body.payload_summary as string | undefined
  });
  return result;
});

app.post("/api/local/scheduled-jobs", async request => {
  const body = request.body as Record<string, unknown>;
  const { createScheduledJob } = await import("@apex/shared-runtime");
  const job = createScheduledJob({
    name: body.name as string,
    cron_expression: body.cron_expression as string | undefined,
    interval_ms: body.interval_ms as number | undefined,
    task_intent: body.task_intent as string,
    enabled: body.enabled as boolean | undefined
  });
  return job;
});

app.get("/api/local/scheduled-jobs", async request => {
  const query = request.query as { enabled?: string };
  const { listScheduledJobs } = await import("@apex/shared-runtime");
  const jobs = listScheduledJobs({ enabled: query.enabled === "true" ? true : query.enabled === "false" ? false : undefined });
  return { jobs };
});

app.get("/api/local/scheduled-jobs/:jobId", async request => {
  const { jobId } = request.params as { jobId: string };
  const { getScheduledJob } = await import("@apex/shared-runtime");
  const job = getScheduledJob(jobId);
  if (!job) throw { statusCode: 404, message: "ScheduledJob not found" };
  return job;
});

app.patch("/api/local/scheduled-jobs/:jobId", async request => {
  const { jobId } = request.params as { jobId: string };
  const body = request.body as Record<string, unknown>;
  const { updateScheduledJob } = await import("@apex/shared-runtime");
  const job = updateScheduledJob(jobId, {
    name: body.name as string | undefined,
    cron_expression: body.cron_expression as string | undefined,
    interval_ms: body.interval_ms as number | undefined,
    task_intent: body.task_intent as string | undefined,
    enabled: body.enabled as boolean | undefined
  });
  return job;
});

app.post("/api/local/scheduled-jobs/:jobId/trigger", async request => {
  const { jobId } = request.params as { jobId: string };
  const { triggerScheduledJob } = await import("@apex/shared-runtime");
  const result = triggerScheduledJob(jobId);
  return result;
});

app.get("/api/local/scheduled-jobs/due", async () => {
  const { getDueScheduledJobs } = await import("@apex/shared-runtime");
  const jobs = getDueScheduledJobs();
  return { jobs };
});

app.delete("/api/local/scheduled-jobs/:jobId", async request => {
  const { jobId } = request.params as { jobId: string };
  const { deleteScheduledJob } = await import("@apex/shared-runtime");
  deleteScheduledJob(jobId);
  return { success: true };
});

app.post("/api/local/checkpoint-snapshots", async request => {
  const body = request.body as Record<string, unknown>;
  const { createCheckpointSnapshot } = await import("@apex/shared-runtime");
  const snapshot = createCheckpointSnapshot({
    task_id: body.task_id as string,
    step_id: body.step_id as string | undefined,
    task_status: body.task_status as string,
    execution_step_ids: body.execution_step_ids as string[] | undefined,
    evidence_node_ids: body.evidence_node_ids as string[] | undefined,
    snapshot_data: body.snapshot_data as Record<string, unknown> | undefined
  });
  return snapshot;
});

app.get("/api/local/checkpoint-snapshots", async request => {
  const query = request.query as { task_id?: string };
  const { listCheckpointSnapshots } = await import("@apex/shared-runtime");
  if (!query.task_id) throw { statusCode: 400, message: "task_id is required" };
  const snapshots = listCheckpointSnapshots(query.task_id);
  return { snapshots };
});

app.get("/api/local/checkpoint-snapshots/:checkpointId", async request => {
  const { checkpointId } = request.params as { checkpointId: string };
  const { getCheckpointSnapshot } = await import("@apex/shared-runtime");
  const snapshot = getCheckpointSnapshot(checkpointId);
  if (!snapshot) throw { statusCode: 404, message: "CheckpointSnapshot not found" };
  return snapshot;
});

app.post("/api/local/checkpoint-snapshots/:checkpointId/restore", async request => {
  const { checkpointId } = request.params as { checkpointId: string };
  const { restoreFromCheckpoint } = await import("@apex/shared-runtime");
  const result = restoreFromCheckpoint(checkpointId);
  return result;
});

app.post("/api/local/experiments/:experimentId/promote-winner", async request => {
  const { experimentId } = request.params as { experimentId: string };
  const { promoteExperimentWinnerToLearningFactory } = await import("@apex/shared-runtime");
  const result = promoteExperimentWinnerToLearningFactory(experimentId);
  if (!result) throw { statusCode: 400, message: "No winner to promote" };
  return result;
});

app.post("/api/local/tasks/:taskId/trigger-experiment", async request => {
  const { taskId } = request.params as { taskId: string };
  const { triggerExperimentFromLowConfidence } = await import("@apex/shared-runtime");
  const experiment = triggerExperimentFromLowConfidence(taskId);
  if (!experiment) return { message: "No low-confidence capabilities found, no experiment needed" };
  return experiment;
});

app.post("/api/local/wiki/:wikiPageId/link-memory/:memoryDocumentId", async request => {
  const { wikiPageId, memoryDocumentId } = request.params as { wikiPageId: string; memoryDocumentId: string };
  const { linkWikiToMemoryDocument } = await import("@apex/shared-runtime");
  const result = linkWikiToMemoryDocument(wikiPageId, memoryDocumentId);
  return result;
});

app.delete("/api/local/wiki/:wikiPageId/unlink-memory/:memoryDocumentId", async request => {
  const { wikiPageId, memoryDocumentId } = request.params as { wikiPageId: string; memoryDocumentId: string };
  const { unlinkWikiFromMemoryDocument } = await import("@apex/shared-runtime");
  unlinkWikiFromMemoryDocument(wikiPageId, memoryDocumentId);
  return { success: true };
});

app.get("/api/local/memory-documents/:memoryDocumentId/linked-wiki-pages", async request => {
  const { memoryDocumentId } = request.params as { memoryDocumentId: string };
  const { getLinkedWikiPages } = await import("@apex/shared-runtime");
  const pages = getLinkedWikiPages(memoryDocumentId);
  return { pages };
});

app.get("/api/local/wiki/:wikiPageId/linked-memory-documents", async request => {
  const { wikiPageId } = request.params as { wikiPageId: string };
  const { getLinkedMemoryDocuments } = await import("@apex/shared-runtime");
  const documents = getLinkedMemoryDocuments(wikiPageId);
  return { documents };
});

app.post("/api/local/event-subscriptions", async request => {
  const body = request.body as Record<string, unknown>;
  const { createEventSubscription } = await import("@apex/shared-runtime");
  const subscription = createEventSubscription({
    event_kind: body.event_kind as string,
    subscriber_type: body.subscriber_type as "webhook" | "internal_callback" | "poll" | undefined,
    callback_url: body.callback_url as string | undefined,
    description: body.description as string | undefined,
    enabled: body.enabled as boolean | undefined
  });
  return subscription;
});

app.get("/api/local/event-subscriptions", async request => {
  const query = request.query as { event_kind?: string; enabled?: string };
  const { listEventSubscriptions } = await import("@apex/shared-runtime");
  const subs = listEventSubscriptions({
    event_kind: query.event_kind,
    enabled: query.enabled === "true" ? true : query.enabled === "false" ? false : undefined
  });
  return { subscriptions: subs };
});

app.get("/api/local/event-subscriptions/:subscriptionId", async request => {
  const { subscriptionId } = request.params as { subscriptionId: string };
  const { getEventSubscription } = await import("@apex/shared-runtime");
  const sub = getEventSubscription(subscriptionId);
  if (!sub) throw { statusCode: 404, message: "EventSubscription not found" };
  return sub;
});

app.delete("/api/local/event-subscriptions/:subscriptionId", async request => {
  const { subscriptionId } = request.params as { subscriptionId: string };
  const { deleteEventSubscription } = await import("@apex/shared-runtime");
  deleteEventSubscription(subscriptionId);
  return { success: true };
});

app.post("/api/local/slo-alerts", async request => {
  const body = request.body as Record<string, unknown>;
  const { createSLOAlert } = await import("@apex/shared-runtime");
  const alert = createSLOAlert({
    slo_name: body.slo_name as string,
    threshold: body.threshold as number,
    actual_value: body.actual_value as number,
    severity: body.severity as "warning" | "critical" | undefined,
    task_id: body.task_id as string | undefined
  });
  return alert;
});

app.get("/api/local/slo-alerts", async request => {
  const query = request.query as { slo_name?: string; severity?: string; acknowledged?: string };
  const { listSLOAlerts } = await import("@apex/shared-runtime");
  const alerts = listSLOAlerts({
    slo_name: query.slo_name,
    severity: query.severity as "warning" | "critical" | undefined,
    acknowledged: query.acknowledged === "true" ? true : query.acknowledged === "false" ? false : undefined
  });
  return { alerts };
});

app.post("/api/local/slo-alerts/:alertId/acknowledge", async request => {
  const { alertId } = request.params as { alertId: string };
  const body = request.body as Record<string, unknown>;
  const { acknowledgeSLOAlert } = await import("@apex/shared-runtime");
  const alert = acknowledgeSLOAlert(alertId, body.acknowledged_by as string);
  return alert;
});

app.post("/api/local/slo-alerts/evaluate", async () => {
  const { evaluateSLOs } = await import("@apex/shared-runtime");
  const alerts = evaluateSLOs();
  return { alerts };
});

app.post("/api/local/sandbox-executor/execute", async request => {
  const body = request.body as Record<string, unknown>;
  const { executeInSandbox } = await import("@apex/shared-runtime");
  const result = executeInSandbox(
    body.manifest_id as string,
    body.command as string,
    body.args as string[] | undefined
  );
  return result;
});

app.post("/api/local/sandbox-executor/execute-async", async request => {
  const body = request.body as Record<string, unknown>;
  const { executeInSandboxAsync } = await import("@apex/shared-runtime");
  const result = await executeInSandboxAsync(
    body.manifest_id as string,
    body.command as string,
    body.args as string[] | undefined,
    {
      stdin: body.stdin as string | undefined,
      workingDirectory: body.working_directory as string | undefined
    }
  );
  return result;
});

app.post("/api/local/sandbox-executor/kill", async request => {
  const body = request.body as Record<string, unknown>;
  const { killSandboxProcess } = await import("@apex/shared-runtime");
  const killed = killSandboxProcess(
    body.manifest_id as string,
    body.process_id as number
  );
  return { killed };
});

app.get("/api/local/sandbox-executor/processes", async request => {
  const query = request.query as { manifest_id?: string };
  const { listActiveSandboxProcesses } = await import("@apex/shared-runtime");
  const processes = listActiveSandboxProcesses(query.manifest_id);
  return { processes };
});

app.post("/api/local/sandbox-executor/validate", async request => {
  const body = request.body as Record<string, unknown>;
  const { validateSandboxExecution, getSandboxManifest } = await import("@apex/shared-runtime");
  const manifest = getSandboxManifest(body.manifest_id as string);
  if (!manifest) throw { statusCode: 404, message: "SandboxManifest not found" };
  const result = validateSandboxExecution(manifest, {
    path: body.path as string | undefined,
    write: body.write as boolean | undefined,
    network_destination: body.network_destination as string | undefined,
    network_protocol: body.network_protocol as string | undefined
  });
  return result;
});

app.get("/api/local/sandbox-executor/:manifestId/report", async request => {
  const { manifestId } = request.params as { manifestId: string };
  const { getSandboxExecutionReport } = await import("@apex/shared-runtime");
  const report = getSandboxExecutionReport(manifestId);
  return report;
});

app.post("/api/local/code-intelligence/symbols", async request => {
  const body = request.body as Record<string, unknown>;
  const { registerSymbolDefinition } = await import("@apex/shared-runtime");
  const symbol = registerSymbolDefinition({
    name: body.name as string,
    kind: body.kind as "function" | "class" | "interface" | "type" | "variable" | "constant" | "enum" | "module" | "namespace" | "method" | "property",
    file_path: body.file_path as string,
    line_start: body.line_start as number,
    line_end: body.line_end as number,
    type_signature: body.type_signature as string,
    documentation: body.documentation as string,
    language: body.language as string
  });
  return symbol;
});

app.get("/api/local/code-intelligence/symbols", async request => {
  const query = request.query as { name?: string; language?: string; search?: string; kind?: string };
  const { lookupSymbolDefinition, searchSymbols } = await import("@apex/shared-runtime");
  if (query.search) {
    const symbols = searchSymbols(query.search, query.language, query.kind as any);
    return { symbols };
  }
  if (query.name) {
    const definitions = lookupSymbolDefinition(query.name, query.language);
    return { definitions };
  }
  return { symbols: [] };
});

app.post("/api/local/code-intelligence/references", async request => {
  const body = request.body as Record<string, unknown>;
  const { registerSymbolReference } = await import("@apex/shared-runtime");
  const reference = registerSymbolReference({
    symbol_name: body.symbol_name as string,
    file_path: body.file_path as string,
    line_number: body.line_number as number,
    context: body.context as string,
    kind: body.kind as "import" | "call" | "type_reference" | "inheritance" | "implementation"
  });
  return reference;
});

app.get("/api/local/code-intelligence/references", async request => {
  const query = request.query as { symbol_name?: string };
  const { findSymbolReferences } = await import("@apex/shared-runtime");
  if (!query.symbol_name) throw { statusCode: 400, message: "symbol_name is required" };
  const references = findSymbolReferences(query.symbol_name);
  return { references };
});

app.get("/api/local/code-intelligence/affected-files", async request => {
  const query = request.query as { file_path?: string };
  const { computeAffectedFiles } = await import("@apex/shared-runtime");
  if (!query.file_path) throw { statusCode: 400, message: "file_path is required" };
  const graph = computeAffectedFiles(query.file_path);
  return graph;
});

app.post("/api/local/code-intelligence/diagnostics", async request => {
  const body = request.body as Record<string, unknown>;
  const { registerDiagnostic } = await import("@apex/shared-runtime");
  const diagnostic = registerDiagnostic({
    file_path: body.file_path as string,
    line_start: body.line_start as number,
    line_end: body.line_end as number,
    severity: body.severity as "error" | "warning" | "info" | "hint",
    message: body.message as string,
    source: body.source as string,
    code: body.code as string
  });
  return diagnostic;
});

app.get("/api/local/code-intelligence/diagnostics", async request => {
  const query = request.query as { file_path?: string; severity?: string };
  const { getDiagnostics } = await import("@apex/shared-runtime");
  const diagnostics = getDiagnostics(query.file_path, query.severity as any);
  return { diagnostics };
});

app.post("/api/local/code-intelligence/query", async request => {
  const body = request.body as Record<string, unknown>;
  const { queryCodeIntelligence } = await import("@apex/shared-runtime");
  const result = queryCodeIntelligence({
    task_id: body.task_id as string | undefined,
    query_type: body.query_type as "symbol_definition" | "symbol_references" | "affected_files" | "diagnostics" | "type_info" | "search",
    target: body.target as string,
    file_path: body.file_path as string | undefined,
    language: body.language as string | undefined
  });
  return result;
});

app.post("/api/local/code-intelligence/patches", async request => {
  const body = request.body as Record<string, unknown>;
  const { createCodePatch, applyCodePatch } = await import("@apex/shared-runtime");
  const patch = createCodePatch({
    file_path: body.file_path as string,
    kind: body.kind as "symbol_rename" | "range_patch" | "ast_transform" | "full_rewrite",
    description: body.description as string,
    original_range: body.original_range as { line_start: number; line_end: number },
    replacement: body.replacement as string,
    affected_symbols: body.affected_symbols as string[]
  });
  const result = applyCodePatch(patch);
  return { patch, result };
});

app.post("/api/local/code-intelligence/lsp/create", async request => {
  const body = request.body as Record<string, unknown>;
  const { createLSPClient } = await import("@apex/shared-runtime");
  const client = createLSPClient({
    language: body.language as string,
    command: body.command as string,
    args: body.args as string[],
    workspace_root: body.workspace_root as string,
    initialization_options: body.initialization_options as Record<string, unknown> | undefined
  });
  return { client_id: client.client_id, status: client.status };
});

app.post("/api/local/code-intelligence/lsp/:clientId/start", async request => {
  const { clientId } = request.params as { clientId: string };
  const { startLSPClient } = await import("@apex/shared-runtime");
  const state = await startLSPClient(clientId);
  return { client_id: state.client_id, status: state.status, capabilities: state.capabilities };
});

app.post("/api/local/code-intelligence/lsp/:clientId/stop", async request => {
  const { clientId } = request.params as { clientId: string };
  const { stopLSPClient } = await import("@apex/shared-runtime");
  await stopLSPClient(clientId);
  return { stopped: true };
});

app.get("/api/local/code-intelligence/lsp/:clientId", async request => {
  const { clientId } = request.params as { clientId: string };
  const { getLSPClientState } = await import("@apex/shared-runtime");
  const state = getLSPClientState(clientId);
  if (!state) throw { statusCode: 404, message: "LSP client not found" };
  return { client_id: state.client_id, status: state.status, language: state.config.language, started_at: state.started_at, error_message: state.error_message };
});

app.get("/api/local/code-intelligence/lsp", async () => {
  const { listLSPClients } = await import("@apex/shared-runtime");
  const clients = listLSPClients();
  return { clients: clients.map(c => ({ client_id: c.client_id, status: c.status, language: c.config.language, started_at: c.started_at })) };
});

app.post("/api/local/code-intelligence/lsp/:clientId/document-symbols", async request => {
  const { clientId } = request.params as { clientId: string };
  const body = request.body as Record<string, unknown>;
  const { lspDocumentSymbols } = await import("@apex/shared-runtime");
  const symbols = await lspDocumentSymbols(clientId, body.file_path as string);
  return { symbols };
});

app.post("/api/local/code-intelligence/lsp/:clientId/workspace-symbols", async request => {
  const { clientId } = request.params as { clientId: string };
  const body = request.body as Record<string, unknown>;
  const { lspWorkspaceSymbols } = await import("@apex/shared-runtime");
  const symbols = await lspWorkspaceSymbols(clientId, body.query as string);
  return { symbols };
});

app.post("/api/local/code-intelligence/lsp/:clientId/references", async request => {
  const { clientId } = request.params as { clientId: string };
  const body = request.body as Record<string, unknown>;
  const { lspReferences } = await import("@apex/shared-runtime");
  const references = await lspReferences(clientId, body.file_path as string, body.line as number, body.character as number);
  return { references };
});

app.post("/api/local/code-intelligence/lsp/:clientId/definition", async request => {
  const { clientId } = request.params as { clientId: string };
  const body = request.body as Record<string, unknown>;
  const { lspDefinition } = await import("@apex/shared-runtime");
  const definitions = await lspDefinition(clientId, body.file_path as string, body.line as number, body.character as number);
  return { definitions };
});

app.post("/api/local/code-intelligence/lsp/:clientId/notify/open", async request => {
  const { clientId } = request.params as { clientId: string };
  const body = request.body as Record<string, unknown>;
  const { notifyLSPFileOpen } = await import("@apex/shared-runtime");
  notifyLSPFileOpen(clientId, body.file_path as string, body.content as string);
  return { notified: true };
});

app.post("/api/local/code-intelligence/lsp/:clientId/notify/change", async request => {
  const { clientId } = request.params as { clientId: string };
  const body = request.body as Record<string, unknown>;
  const { notifyLSPFileChange } = await import("@apex/shared-runtime");
  notifyLSPFileChange(clientId, body.file_path as string, body.content as string, body.version as number);
  return { notified: true };
});

app.post("/api/local/code-intelligence/lsp/:clientId/notify/close", async request => {
  const { clientId } = request.params as { clientId: string };
  const body = request.body as Record<string, unknown>;
  const { notifyLSPFileClose } = await import("@apex/shared-runtime");
  notifyLSPFileClose(clientId, body.file_path as string);
  return { notified: true };
});

app.post("/api/local/code-intelligence/ast/parse", async request => {
  const body = request.body as Record<string, unknown>;
  const { parseFileAST } = await import("@apex/shared-runtime");
  const result = parseFileAST(body.file_path as string, body.language as string | undefined);
  return result;
});

app.post("/api/local/code-intelligence/repository/index", async request => {
  const body = request.body as Record<string, unknown>;
  const { indexRepository } = await import("@apex/shared-runtime");
  const result = indexRepository(body.root_path as string, {
    filePatterns: body.file_patterns as string[] | undefined,
    excludePatterns: body.exclude_patterns as string[] | undefined,
    maxFiles: body.max_files as number | undefined,
    language: body.language as string | undefined
  });
  return result;
});

app.post("/api/local/otel/export", async request => {
  const body = request.body as Record<string, unknown>;
  const { exportOTELToEndpoint } = await import("@apex/shared-runtime");
  const result = exportOTELToEndpoint(body.endpoint as string ?? "http://localhost:4318/v1/traces");
  return result;
});

app.get("/api/local/otel/export-json", async () => {
  const { exportOTELAsJSON } = await import("@apex/shared-runtime");
  const result = exportOTELAsJSON();
  return result;
});

app.post("/api/local/semantic-cache", async request => {
  const body = request.body as Record<string, unknown>;
  const { putCacheEntry } = await import("@apex/shared-runtime");
  const entry = putCacheEntry({
    cache_tier: body.cache_tier as "exact_request" | "semantic_suggestion" | "harness_result" | "plan_skeleton",
    query_text: body.query_text as string,
    result: body.result as Record<string, unknown>,
    model_family: body.model_family as string | undefined,
    tool_family: body.tool_family as string | undefined,
    policy_version: body.policy_version as string | undefined,
    repo_fingerprint: body.repo_fingerprint as string | undefined,
    expires_at: body.expires_at as string | undefined
  });
  return entry;
});

app.get("/api/local/semantic-cache", async request => {
  const query = request.query as { query_text?: string; cache_tier?: string; model_family?: string; policy_version?: string; repo_fingerprint?: string };
  const { lookupCache } = await import("@apex/shared-runtime");
  if (!query.query_text || !query.cache_tier) {
    throw { statusCode: 400, message: "query_text and cache_tier are required" };
  }
  const result = lookupCache({
    query_text: query.query_text,
    cache_tier: query.cache_tier as "exact_request" | "semantic_suggestion" | "harness_result" | "plan_skeleton",
    model_family: query.model_family,
    policy_version: query.policy_version,
    repo_fingerprint: query.repo_fingerprint
  });
  return result;
});

app.delete("/api/local/semantic-cache", async request => {
  const query = request.query as { query_text?: string; cache_tier?: string; all?: string };
  const { invalidateCache, clearCache } = await import("@apex/shared-runtime");
  if (query.all === "true") {
    const count = clearCache();
    return { cleared: count };
  }
  if (!query.query_text || !query.cache_tier) {
    throw { statusCode: 400, message: "query_text and cache_tier are required, or use all=true" };
  }
  const deleted = invalidateCache(query.query_text, query.cache_tier as any);
  return { deleted };
});

app.get("/api/local/semantic-cache/stats", async () => {
  const { getCacheStats } = await import("@apex/shared-runtime");
  const stats = getCacheStats();
  return stats;
});

app.post("/api/local/capabilities/discovery/scan", async () => {
  const { discoverLocalCapabilities } = await import("@apex/shared-runtime");
  const discovered = discoverLocalCapabilities();
  return { discovered_count: discovered.length, capabilities: discovered };
});

app.post("/api/local/capabilities/discovery/register", async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  try {
    const { registerLocalCapability } = await import("@apex/shared-runtime");
    const capability = registerLocalCapability({
      category: body.category as LocalCapabilityCategory,
      name: body.name as string,
      version: body.version as string | undefined,
      install_path: body.install_path as string | undefined,
      invocation_method: body.invocation_method as LocalCapability["invocation_method"],
      risk_tier: body.risk_tier as LocalCapability["risk_tier"] | undefined,
      sandbox_requirement: body.sandbox_requirement as LocalCapability["sandbox_requirement"] | undefined,
      available: body.available as boolean | undefined,
      tags: body.tags as string[] | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined
    });
    return { capability };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/capabilities/discovery/descriptors", async () => {
  const { getLocalCapabilitiesAsDescriptors } = await import("@apex/shared-runtime");
  const descriptors = getLocalCapabilitiesAsDescriptors();
  return { descriptors };
});

app.post("/api/local/capabilities/discovery/:capabilityId/verify", async (request, reply) => {
  const { capabilityId } = request.params as { capabilityId: string };
  try {
    const { verifyLocalCapabilityAvailability } = await import("@apex/shared-runtime");
    const capability = verifyLocalCapabilityAvailability(capabilityId);
    return { capability };
  } catch (err) {
    reply.status(404);
    return { error: String(err) };
  }
});

app.get("/api/local/capabilities/discovery/search", async request => {
  const query = request.query as { category?: string; available?: string; risk_tier?: string; invocation_method?: string };
  const { listLocalCapabilities } = await import("@apex/shared-runtime");
  const capabilities = listLocalCapabilities({
    category: query.category as LocalCapabilityCategory | undefined,
    available: query.available === "true" ? true : query.available === "false" ? false : undefined,
    risk_tier: query.risk_tier as LocalCapability["risk_tier"] | undefined,
    invocation_method: query.invocation_method as LocalCapability["invocation_method"] | undefined
  });
  return { capabilities };
});

app.get("/api/local/tasks/:taskId/evidence-graph", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const graph = store.evidenceGraphs.get(taskId);
  if (!graph) {
    reply.status(404);
    return { error: "Evidence graph not found for this task." };
  }
  return { evidenceGraph: graph };
});

app.post("/api/local/tasks/:taskId/evidence-graph/build", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  try {
    const { buildEvidenceGraph } = await import("@apex/shared-runtime");
    const graph = buildEvidenceGraph(taskId);
    return { evidenceGraph: graph };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/tasks/:taskId/evidence-graph/nodes", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { addEvidenceNode } = await import("@apex/shared-runtime");
    const { EvidenceNodeKindSchema, EvidenceNodeStatusSchema } = await import("@apex/shared-types");
    const kind = EvidenceNodeKindSchema.parse(body.kind);
    const status = EvidenceNodeStatusSchema.parse(body.status ?? "pending");
    const verdict = z.enum(["pass", "pass_with_notes", "fail", "not_evaluated"]).parse(body.verdict ?? "not_evaluated");
    const graph = addEvidenceNode(taskId, {
      kind,
      status,
      label: body.label as string,
      description: body.description as string | undefined,
      source_id: body.source_id as string | undefined,
      verdict,
      details: (body.details as Record<string, unknown>) ?? {},
      required_for_completion: (body.required_for_completion as boolean) ?? true,
      depends_on: (body.depends_on as string[]) ?? []
    });
    return { evidenceGraph: graph };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.patch("/api/local/tasks/:taskId/evidence-graph/nodes/:nodeId", async (request, reply) => {
  const { taskId, nodeId } = request.params as { taskId: string; nodeId: string };
  const body = request.body as Record<string, unknown>;
  try {
    const { updateEvidenceNode } = await import("@apex/shared-runtime");
    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) patch.status = body.status;
    if (body.verdict !== undefined) patch.verdict = body.verdict;
    if (body.details !== undefined) patch.details = body.details;
    if (body.label !== undefined) patch.label = body.label;
    if (body.description !== undefined) patch.description = body.description;
    const graph = updateEvidenceNode(taskId, nodeId, patch as Parameters<typeof updateEvidenceNode>[2]);
    return { evidenceGraph: graph };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.post("/api/local/tasks/:taskId/evidence-graph/evaluate", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  try {
    const { evaluateEvidenceGraph } = await import("@apex/shared-runtime");
    const result = evaluateEvidenceGraph(taskId);
    return { completionEngineResult: result };
  } catch (err) {
    reply.status(400);
    return { error: String(err) };
  }
});

app.get("/api/local/tasks/:taskId/completion-engine-result", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const result = store.completionEngineResults.get(taskId);
  if (!result) {
    reply.status(404);
    return { error: "Completion engine result not found for this task." };
  }
  return { completionEngineResult: result };
});

if (process.env.APEX_DEBUG_PRINT_ROUTES === "1") {
  console.log(app.printRoutes());
}

app.post("/api/local/computer-use/sessions", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const taskId = String(body.task_id ?? "");
  if (!taskId) return reply.code(400).send({ error: "task_id is required" });
  const session = createComputerUseSession({
    taskId,
    maxSteps: body.max_steps as number | undefined,
    perceptionEngine: body.perception_engine as "accessibility_api" | "ocr" | "hybrid" | undefined,
    captureEngine: body.capture_engine as "native_screenshot" | "playwright_page" | undefined,
    sandboxTier: body.sandbox_tier as "host_readonly" | "guarded_mutation" | "isolated_mutation" | undefined,
    requiresConfirmation: body.requires_confirmation as boolean | undefined
  });
  return reply.code(201).send(session);
});

app.get("/api/local/computer-use/sessions", async (request) => {
  const query = request.query as Record<string, string>;
  return { sessions: listComputerUseSessions(query.task_id) };
});

app.get("/api/local/computer-use/sessions/:sessionId", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const session = getComputerUseSession(sessionId);
  if (!session) return reply.code(404).send({ error: "Session not found" });
  return session;
});

app.post("/api/local/computer-use/sessions/:sessionId/pause", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const result = pauseComputerUseSession(sessionId);
  if (!result) return reply.code(400).send({ error: "Cannot pause session" });
  return result;
});

app.post("/api/local/computer-use/sessions/:sessionId/resume", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const result = resumeComputerUseSession(sessionId);
  if (!result) return reply.code(400).send({ error: "Cannot resume session" });
  return result;
});

app.post("/api/local/computer-use/sessions/:sessionId/stop", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const body = (request.body ?? {}) as Record<string, unknown>;
  const result = stopComputerUseSession(sessionId, body.reason as string | undefined);
  if (!result) return reply.code(400).send({ error: "Cannot stop session" });
  return result;
});

app.post("/api/local/computer-use/sessions/:sessionId/complete", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const result = completeComputerUseSession(sessionId);
  if (!result) return reply.code(400).send({ error: "Cannot complete session" });
  return result;
});

app.get("/api/local/computer-use/sessions/:sessionId/steps", async (request) => {
  const { sessionId } = request.params as { sessionId: string };
  return { steps: listComputerUseSteps(sessionId) };
});

app.get("/api/local/computer-use/steps/:stepId", async (request, reply) => {
  const { stepId } = request.params as { stepId: string };
  const step = getComputerUseStep(stepId);
  if (!step) return reply.code(404).send({ error: "Step not found" });
  return step;
});

app.post("/api/local/computer-use/capture", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const capture = await captureScreen({
      taskId: body.task_id as string | undefined,
      sessionId: body.session_id as string | undefined,
      engine: body.engine as "native_screenshot" | "playwright_page" | undefined,
      region: body.region as { x: number; y: number; width: number; height: number } | undefined,
      displayIndex: body.display_index as number | undefined
    });
    return reply.code(201).send(capture);
  } catch (error) {
    return reply.code(500).send({ error: (error as Error).message });
  }
});

app.get("/api/local/computer-use/captures", async (request) => {
  const query = request.query as Record<string, string>;
  return { captures: listScreenCaptures(query.task_id, query.session_id) };
});

app.get("/api/local/computer-use/captures/:captureId", async (request, reply) => {
  const { captureId } = request.params as { captureId: string };
  const capture = getScreenCapture(captureId);
  if (!capture) return reply.code(404).send({ error: "Capture not found" });
  return capture;
});

app.post("/api/local/computer-use/perceive", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const perception = await perceiveScreen({
      taskId: body.task_id as string | undefined,
      sessionId: body.session_id as string | undefined,
      captureId: body.capture_id as string | undefined,
      engine: body.engine as "accessibility_api" | "ocr" | "hybrid" | undefined,
      windowTitle: body.window_title as string | undefined
    });
    return reply.code(201).send(perception);
  } catch (error) {
    return reply.code(500).send({ error: (error as Error).message });
  }
});

app.get("/api/local/computer-use/perceptions", async (request) => {
  const query = request.query as Record<string, string>;
  return { perceptions: listUIPerceptions(query.task_id, query.session_id) };
});

app.get("/api/local/computer-use/perceptions/:perceptionId", async (request, reply) => {
  const { perceptionId } = request.params as { perceptionId: string };
  const perception = getUIPerception(perceptionId);
  if (!perception) return reply.code(404).send({ error: "Perception not found" });
  return perception;
});

app.post("/api/local/computer-use/act", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const action = await executeInputAction({
      kind: body.kind as "mouse_click" | "mouse_double_click" | "mouse_right_click" | "mouse_move" | "mouse_drag" | "mouse_scroll" | "key_press" | "key_combo" | "type_text" | "focus_element" | "select_option",
      coordinates: body.coordinates as { x: number; y: number } | undefined,
      targetElementId: body.target_element_id as string | undefined,
      button: body.button as "left" | "right" | "middle" | undefined,
      key: body.key as string | undefined,
      keyCombo: body.key_combo as string[] | undefined,
      text: body.text as string | undefined,
      scrollDelta: body.scroll_delta as number | undefined,
      durationMs: body.duration_ms as number | undefined,
      taskId: body.task_id as string | undefined,
      sessionId: body.session_id as string | undefined
    });
    return reply.code(201).send(action);
  } catch (error) {
    return reply.code(500).send({ error: (error as Error).message });
  }
});

app.get("/api/local/computer-use/actions", async (request) => {
  const query = request.query as Record<string, string>;
  return { actions: listInputActions(query.task_id, query.session_id) };
});

app.get("/api/local/computer-use/actions/:actionId", async (request, reply) => {
  const { actionId } = request.params as { actionId: string };
  const action = getInputAction(actionId);
  if (!action) return reply.code(404).send({ error: "Action not found" });
  return action;
});

app.post("/api/local/computer-use/takeover", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const sessionId = String(body.session_id ?? "");
  const taskId = String(body.task_id ?? "");
  if (!sessionId || !taskId) return reply.code(400).send({ error: "session_id and task_id are required" });
  const takeover = initiateHumanTakeover({
    sessionId,
    taskId,
    reason: body.reason as "user_requested" | "policy_block" | "max_steps_reached" | "verification_failed_repeatedly" | "ambiguous_state" | "unsafe_action_detected" | "escalation",
    description: String(body.description ?? ""),
    stepId: body.step_id as string | undefined,
    pendingAction: body.pending_action as string | undefined,
    perceptionSnapshot: body.perception_snapshot as string | undefined
  });
  return reply.code(201).send(takeover);
});

app.post("/api/local/computer-use/takeover/:takeoverId/resolve", async (request, reply) => {
  const { takeoverId } = request.params as { takeoverId: string };
  const body = (request.body ?? {}) as Record<string, unknown>;
  const result = resolveHumanTakeover(
    takeoverId,
    body.resolution as "resumed" | "modified_and_resumed" | "cancelled",
    body.resolved_by as string | undefined
  );
  if (!result) return reply.code(400).send({ error: "Cannot resolve takeover" });
  return result;
});

app.get("/api/local/computer-use/takeovers", async (request) => {
  const query = request.query as Record<string, string>;
  return { takeovers: listHumanTakeovers(query.session_id, query.task_id) };
});

app.get("/api/local/computer-use/sessions/:sessionId/replay", async (request) => {
  const { sessionId } = request.params as { sessionId: string };
  return { replay_steps: buildComputerUseReplayPackage(sessionId) };
});

app.post("/api/local/computer-use/replay/:replayStepId", async (request, reply) => {
  const { replayStepId } = request.params as { replayStepId: string };
  const result = await replayComputerUseStep(replayStepId);
  if (!result) return reply.code(404).send({ error: "Replay step not found" });
  return result;
});

app.get("/api/local/computer-use/circuit-breakers", async () => {
  return getCircuitBreakerStatus();
});

app.post("/api/local/computer-use/circuit-breakers/reset", async () => {
  resetCircuitBreakers();
  return { status: "reset" };
});

app.get("/api/local/computer-use/ocr/providers", async () => {
  return { providers: listOCRProviders() };
});

app.post("/api/local/computer-use/ocr/providers/clear", async () => {
  clearOCRProviders();
  return { status: "cleared" };
});

app.post("/api/local/computer-use/perceive/dom", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const perception = await perceiveScreen({
      taskId: body.task_id as string | undefined,
      sessionId: body.session_id as string | undefined,
      engine: "playwright_dom",
      windowTitle: body.window_title as string | undefined,
      url: body.url as string | undefined
    });
    return reply.code(201).send(perception);
  } catch (error) {
    return reply.code(500).send({ error: (error as Error).message });
  }
});

app.post("/api/local/computer-use/element-action", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const element = body.element as Record<string, unknown>;
    if (!element) return reply.code(400).send({ error: "element is required" });
    const action = String(body.action ?? "click");
    if (!["click", "type", "focus", "select", "hover"].includes(action)) {
      return reply.code(400).send({ error: "action must be one of: click, type, focus, select, hover" });
    }
    const result = await executeElementAction({
      element: element as any,
      action: action as "click" | "type" | "focus" | "select" | "hover",
      value: body.value as string | undefined,
      taskId: body.task_id as string | undefined,
      sessionId: body.session_id as string | undefined
    });
    return reply.code(201).send(result);
  } catch (error) {
    return reply.code(500).send({ error: (error as Error).message });
  }
});

app.post("/api/local/computer-use/resolve-element-action", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  try {
    const element = body.element as Record<string, unknown>;
    if (!element) return reply.code(400).send({ error: "element is required" });
    const action = String(body.action ?? "click");
    const result = await resolveElementAction(
      element as any,
      action as "click" | "type" | "focus" | "select" | "hover",
      body.value as string | undefined
    );
    return reply.code(200).send(result);
  } catch (error) {
    return reply.code(500).send({ error: (error as Error).message });
  }
});

app.get("/api/local/computer-use/element-action/providers", async () => {
  return { providers: listElementActionProviders() };
});

app.post("/api/local/computer-use/element-action/providers/clear", async () => {
  clearElementActionProviders();
  return { status: "cleared" };
});

app.post("/api/local/computer-use/sandbox/enforce", async (request, reply) => {
  const { enforceComputerUseSandbox } = await import("@apex/shared-runtime");
  const { action, sessionId, manifestId, requiresConfirmation } = request.body as { action: string; sessionId?: string; manifestId?: string; requiresConfirmation?: boolean };
  const result = enforceComputerUseSandbox({ action, sessionId, manifestId, requiresConfirmation });
  return result;
});

app.get("/api/local/computer-use/sandbox/policy", async (request) => {
  const { getComputerUseSandboxPolicy } = await import("@apex/shared-runtime");
  const { sessionId } = request.query as { sessionId?: string };
  return getComputerUseSandboxPolicy(sessionId);
});

app.post("/api/local/computer-use/smoke", async (request, reply) => {
  const { runSmokeTestSuite } = await import("@apex/shared-runtime");
  const options = request.body as { skipInput?: boolean; skipLocalApp?: boolean; skipNetworkDependent?: boolean; sessionId?: string; taskId?: string } | undefined;
  const result = await runSmokeTestSuite(options);
  return result;
});

app.post("/api/local/computer-use/e2e", async (request, reply) => {
  const { runE2EScenario } = await import("@apex/shared-runtime");
  const input = request.body as { scenario_name: string; steps: Array<{ step_name: string; action: string; params: Record<string, unknown>; expected_outcome: string; timeout_ms?: number }>; sessionId?: string; taskId?: string };
  const result = await runE2EScenario(input);
  return result;
});

app.post("/api/local/computer-use/regression", async (request, reply) => {
  const { runRegressionTestSuite } = await import("@apex/shared-runtime");
  const options = request.body as { cases?: import("@apex/shared-runtime").RegressionTestCase[]; sessionId?: string; taskId?: string } | undefined;
  const result = await runRegressionTestSuite(options);
  return result;
});

app.get("/api/local/computer-use/regression/cases", async () => {
  const { getRegressionTestCases } = await import("@apex/shared-runtime");
  return { cases: getRegressionTestCases() };
});

app.post("/api/local/mcp/capabilities", async (request, reply) => {
  const { registerMCPCapability } = await import("@apex/shared-runtime");
  const spec = request.body as Omit<import("@apex/shared-runtime").MCPCapabilitySpec, "registered_at" | "health_status">;
  const result = registerMCPCapability(spec);
  return result;
});

app.get("/api/local/mcp/capabilities", async (request) => {
  const { listMCPCapabilities } = await import("@apex/shared-runtime");
  const query = request.query as { risk_tier?: string; protocol?: string; health_status?: string; tag?: string };
  return { capabilities: listMCPCapabilities(query as any) };
});

app.get("/api/local/mcp/capabilities/:capabilityId", async (request, reply) => {
  const { getMCPCapability } = await import("@apex/shared-runtime");
  const { capabilityId } = request.params as { capabilityId: string };
  const cap = getMCPCapability(capabilityId);
  if (!cap) { reply.code(404); return { error: "not found" }; }
  return cap;
});

app.delete("/api/local/mcp/capabilities/:capabilityId", async (request) => {
  const { unregisterMCPCapability } = await import("@apex/shared-runtime");
  const { capabilityId } = request.params as { capabilityId: string };
  return { removed: unregisterMCPCapability(capabilityId) };
});

app.post("/api/local/mcp/resolve", async (request, reply) => {
  const { resolveMCPToolForNeed } = await import("@apex/shared-runtime");
  const input = request.body as { need_description: string; preferred_tags?: string[]; max_risk_tier?: "low" | "medium" | "high" | "critical" };
  const results = resolveMCPToolForNeed(input);
  return { results };
});

app.post("/api/local/mcp/invoke", async (request, reply) => {
  const { invokeMCPTool } = await import("@apex/shared-runtime");
  const input = request.body as import("@apex/shared-runtime").MCPInvocationRequest;
  const result = await invokeMCPTool(input);
  return result;
});

app.get("/api/local/mcp/invocations", async (request) => {
  const { listMCPInvocations } = await import("@apex/shared-runtime");
  const query = request.query as { capability_id?: string; tool_name?: string; status?: string };
  return { invocations: listMCPInvocations(query as any) };
});

app.get("/api/local/mcp/invocations/:invocationId", async (request, reply) => {
  const { getMCPInvocation } = await import("@apex/shared-runtime");
  const { invocationId } = request.params as { invocationId: string };
  const inv = getMCPInvocation(invocationId);
  if (!inv) { reply.code(404); return { error: "not found" }; }
  return inv;
});

app.post("/api/local/mcp/health-check/:capabilityId", async (request, reply) => {
  const { runMCPHealthCheck } = await import("@apex/shared-runtime");
  const { capabilityId } = request.params as { capabilityId: string };
  return await runMCPHealthCheck(capabilityId);
});

app.post("/api/local/mcp/health-check-all", async () => {
  const { runAllMCPHealthChecks } = await import("@apex/shared-runtime");
  return { results: await runAllMCPHealthChecks() };
});

app.get("/api/local/mcp/fabric/status", async () => {
  const { getMCPLiveFabricStatus } = await import("@apex/shared-runtime");
  return getMCPLiveFabricStatus();
});

app.post("/api/local/mcp/builtin/register", async () => {
  const { registerBuiltinMCPCapabilities } = await import("@apex/shared-runtime");
  return { capabilities: registerBuiltinMCPCapabilities() };
});

app.post("/api/local/app-control/skills", async (request, reply) => {
  const { registerAppControlSkill } = await import("@apex/shared-runtime");
  const spec = request.body as Omit<import("@apex/shared-runtime").AppControlSkill, "skill_id" | "created_at" | "updated_at">;
  return registerAppControlSkill(spec);
});

app.get("/api/local/app-control/skills", async (request) => {
  const { listAppControlSkills } = await import("@apex/shared-runtime");
  const query = request.query as { task_family?: string; execution_method?: string; risk_tier?: string; tag?: string };
  return { skills: listAppControlSkills(query as any) };
});

app.get("/api/local/app-control/skills/:skillId", async (request, reply) => {
  const { getAppControlSkill } = await import("@apex/shared-runtime");
  const { skillId } = request.params as { skillId: string };
  const skill = getAppControlSkill(skillId);
  if (!skill) { reply.code(404); return { error: "not found" }; }
  return skill;
});

app.post("/api/local/app-control/resolve", async (request, reply) => {
  const { resolveAppControlSkill } = await import("@apex/shared-runtime");
  const input = request.body as { task_description: string; preferred_method?: string; max_risk_tier?: string };
  return { results: resolveAppControlSkill(input as any) };
});

app.post("/api/local/app-control/plan", async (request, reply) => {
  const { planAppControlExecution } = await import("@apex/shared-runtime");
  const input = request.body as { skill_id: string; task_id?: string; session_id?: string; params?: Record<string, unknown> };
  return planAppControlExecution(input);
});

app.post("/api/local/app-control/execute/:planId", async (request, reply) => {
  const { executeAppControlPlan } = await import("@apex/shared-runtime");
  const { planId } = request.params as { planId: string };
  return await executeAppControlPlan(planId);
});

app.get("/api/local/app-control/plans/:planId", async (request, reply) => {
  const { getAppControlExecutionPlan } = await import("@apex/shared-runtime");
  const { planId } = request.params as { planId: string };
  const plan = getAppControlExecutionPlan(planId);
  if (!plan) { reply.code(404); return { error: "not found" }; }
  return plan;
});

app.get("/api/local/app-control/results/:resultId", async (request, reply) => {
  const { getAppControlExecutionResult } = await import("@apex/shared-runtime");
  const { resultId } = request.params as { resultId: string };
  const result = getAppControlExecutionResult(resultId);
  if (!result) { reply.code(404); return { error: "not found" }; }
  return result;
});

app.post("/api/local/app-control/builtin/register", async () => {
  const { registerBuiltinAppControlSkills } = await import("@apex/shared-runtime");
  return { skills: registerBuiltinAppControlSkills() };
});

app.post("/api/local/workspace", async (request, reply) => {
  const { createDesktopWorkspace } = await import("@apex/shared-runtime");
  const input = request.body as { taskId?: string };
  return createDesktopWorkspace(input);
});

app.get("/api/local/workspace/:workspaceId", async (request, reply) => {
  const { getDesktopWorkspace } = await import("@apex/shared-runtime");
  const { workspaceId } = request.params as { workspaceId: string };
  const workspace = getDesktopWorkspace(workspaceId);
  if (!workspace) { reply.code(404); return { error: "not found" }; }
  return workspace;
});

app.get("/api/local/workspace/:workspaceId/full", async (request, reply) => {
  const { buildFullWorkspaceState } = await import("@apex/shared-runtime");
  const { workspaceId } = request.params as { workspaceId: string };
  const state = buildFullWorkspaceState(workspaceId);
  if (!state) { reply.code(404); return { error: "not found" }; }
  return state;
});

app.post("/api/local/workspace/:workspaceId/panels", async (request, reply) => {
  const { addWorkspacePanel } = await import("@apex/shared-runtime");
  const { workspaceId } = request.params as { workspaceId: string };
  const panel = request.body as Omit<import("@apex/shared-runtime").WorkspacePanel, "panel_id" | "created_at" | "updated_at">;
  return addWorkspacePanel(workspaceId, panel);
});

app.patch("/api/local/workspace/panels/:panelId", async (request, reply) => {
  const { updateWorkspacePanel } = await import("@apex/shared-runtime");
  const { panelId } = request.params as { panelId: string };
  const updates = request.body as Partial<Pick<import("@apex/shared-runtime").WorkspacePanel, "status" | "title" | "data">>;
  const result = updateWorkspacePanel(panelId, updates);
  if (!result) { reply.code(404); return { error: "not found" }; }
  return result;
});

app.get("/api/local/workspace/computer-use-panel/:sessionId", async (request, reply) => {
  const { buildComputerUsePanelState } = await import("@apex/shared-runtime");
  const { sessionId } = request.params as { sessionId: string };
  return buildComputerUsePanelState(sessionId);
});

app.get("/api/local/workspace/replay-panel/:sessionId", async (request, reply) => {
  const { buildReplayVisualizationState } = await import("@apex/shared-runtime");
  const { sessionId } = request.params as { sessionId: string };
  return buildReplayVisualizationState(sessionId);
});

app.get("/api/local/workspace/takeover-console", async (request) => {
  const { buildHumanTakeoverConsoleState } = await import("@apex/shared-runtime");
  const query = request.query as { sessionId?: string };
  return buildHumanTakeoverConsoleState(query.sessionId);
});

app.get("/api/local/workspace/risk-state", async (request) => {
  const { buildRiskRecoveryState } = await import("@apex/shared-runtime");
  const query = request.query as { sessionId?: string };
  return buildRiskRecoveryState(query.sessionId);
});

app.post("/api/local/workspace/execution-transition", async (request, reply) => {
  const { recordExecutionStateTransition } = await import("@apex/shared-runtime");
  const input = request.body as { sessionId: string; fromState: string; toState: string; trigger: string; metadata?: Record<string, unknown>; workspaceId?: string };
  return recordExecutionStateTransition(input);
});

app.post("/api/local/memory/recommend", async (request, reply) => {
  const { recommendMemoryMode } = await import("@apex/shared-runtime");
  const input = request.body as { task_id?: string; task_family?: string; department?: string; routing_signals: Record<string, unknown> };
  return recommendMemoryMode(input as any);
});

app.get("/api/local/memory/recommendations", async (request) => {
  const { listMemoryStrategyRecommendations } = await import("@apex/shared-runtime");
  const query = request.query as { task_id?: string; recommended_mode?: string };
  return { recommendations: listMemoryStrategyRecommendations(query as any) };
});

app.get("/api/local/memory/recommendations/:recommendationId", async (request, reply) => {
  const { getMemoryStrategyRecommendation } = await import("@apex/shared-runtime");
  const { recommendationId } = request.params as { recommendationId: string };
  const rec = getMemoryStrategyRecommendation(recommendationId);
  if (!rec) { reply.code(404); return { error: "not found" }; }
  return rec;
});

app.post("/api/local/memory/ttt/eligibility", async (request, reply) => {
  const { evaluateTTTEligibility } = await import("@apex/shared-runtime");
  const input = request.body as { recommendation_id: string; model_route?: string; task_family?: string; is_privileged_planner?: boolean; has_completion_criteria?: boolean; is_replayable?: boolean; budget_limit?: number };
  return evaluateTTTEligibility(input);
});

app.get("/api/local/memory/ttt/eligibility-results", async (request) => {
  const { listTTTEligibilityGateResults } = await import("@apex/shared-runtime");
  const query = request.query as { verdict?: string; task_id?: string };
  return { results: listTTTEligibilityGateResults(query as any) };
});

app.get("/api/local/memory/ttt/eligibility-results/:gateId", async (request, reply) => {
  const { getTTTEligibilityGateResult } = await import("@apex/shared-runtime");
  const { gateId } = request.params as { gateId: string };
  const result = getTTTEligibilityGateResult(gateId);
  if (!result) { reply.code(404); return { error: "not found" }; }
  return result;
});

app.post("/api/local/memory/ttt/adaptation-run", async (request, reply) => {
  const { executeTTTAdaptationRun } = await import("@apex/shared-runtime");
  const input = request.body as { gate_id: string; task_id?: string; session_id?: string; model_route?: string; task_prompt?: string; budget_limit?: number };
  return await executeTTTAdaptationRun(input);
});

app.get("/api/local/memory/ttt/adaptation-runs", async (request) => {
  const { listTTTAdaptationRuns } = await import("@apex/shared-runtime");
  const query = request.query as { status?: string; task_id?: string; gate_id?: string };
  return { runs: listTTTAdaptationRuns(query as any) };
});

app.get("/api/local/memory/ttt/adaptation-runs/:runId", async (request, reply) => {
  const { getTTTAdaptationRun } = await import("@apex/shared-runtime");
  const { runId } = request.params as { runId: string };
  const run = getTTTAdaptationRun(runId);
  if (!run) { reply.code(404); return { error: "not found" }; }
  return run;
});

app.post("/api/local/memory/ttt/adaptation-runs/:runId/rollback", async (request, reply) => {
  const { rollbackTTTAdaptation } = await import("@apex/shared-runtime");
  const { runId } = request.params as { runId: string };
  const result = rollbackTTTAdaptation(runId);
  if (!result) { reply.code(404); return { error: "not found or not rollback-ready" }; }
  return result;
});

app.post("/api/local/memory/ttt/distill", async (request, reply) => {
  const { distillTTTAdaptation } = await import("@apex/shared-runtime");
  const input = request.body as { adaptation_run_id: string; targets?: string[] };
  return distillTTTAdaptation(input as any);
});

app.get("/api/local/memory/ttt/distillation-records", async (request) => {
  const { listTTTDistillationRecords } = await import("@apex/shared-runtime");
  const query = request.query as { adaptation_run_id?: string; status?: string };
  return { records: listTTTDistillationRecords(query as any) };
});

app.get("/api/local/memory/ttt/budget", async () => {
  const { getTTTBudgetLedger } = await import("@apex/shared-runtime");
  return getTTTBudgetLedger();
});

app.post("/api/local/memory/ttt/budget/set", async (request) => {
  const { setTTTBudgetTotal } = await import("@apex/shared-runtime");
  const { totalBudget } = request.body as { totalBudget: number };
  return setTTTBudgetTotal(totalBudget);
});

app.post("/api/local/memory/ttt/budget/reset", async (request) => {
  const { resetTTTBudgetLedger } = await import("@apex/shared-runtime");
  const { totalBudget } = (request.body ?? {}) as { totalBudget?: number };
  return resetTTTBudgetLedger(totalBudget);
});

app.get("/api/local/memory/ttt/eligible-families", async () => {
  const { listTTTEligibleTaskFamilies } = await import("@apex/shared-runtime");
  return { families: listTTTEligibleTaskFamilies() };
});

app.post("/api/local/memory/ttt/eligible-families", async (request) => {
  const { registerTTTEligibleTaskFamily } = await import("@apex/shared-runtime");
  const { taskFamily } = request.body as { taskFamily: string };
  registerTTTEligibleTaskFamily(taskFamily);
  return { registered: true };
});

app.delete("/api/local/memory/ttt/eligible-families/:taskFamily", async (request) => {
  const { unregisterTTTEligibleTaskFamily } = await import("@apex/shared-runtime");
  const { taskFamily } = request.params as { taskFamily: string };
  unregisterTTTEligibleTaskFamily(taskFamily);
  return { unregistered: true };
});

app.get("/api/local/memory/ttt/trace/:taskId", async (request) => {
  const { getTTTTraceForTask } = await import("@apex/shared-runtime");
  const { taskId } = request.params as { taskId: string };
  return getTTTTraceForTask(taskId);
});

app.get("/api/local/memory/ttt/visibility", async (request) => {
  const { getTTTVisibilitySummary } = await import("@apex/shared-runtime");
  const query = request.query as { taskId?: string };
  return getTTTVisibilitySummary(query.taskId);
});

app.post("/api/local/memory/ttt/regression", async () => {
  const { runTTTRegressionTestSuite } = await import("@apex/shared-runtime");
  return await runTTTRegressionTestSuite();
});

app.get("/api/local/memory/ttt/regression/cases", async () => {
  const { getTTTRegressionTestCases } = await import("@apex/shared-runtime");
  return { cases: getTTTRegressionTestCases() };
});

app.post("/api/local/memory/ttt/replay-comparison", async (request) => {
  const { replayTTTAdaptationForComparison } = await import("@apex/shared-runtime");
  const input = request.body as { original_run_id: string; model_route?: string; task_prompt?: string };
  return await replayTTTAdaptationForComparison(input);
});

app.post("/api/local/memory/ttt/adapters/register-builtin", async () => {
  const { registerBuiltinTTTModelAdapters } = await import("@apex/shared-runtime");
  return { adapters: registerBuiltinTTTModelAdapters() };
});

app.get("/api/local/memory/ttt/adapters", async () => {
  const { listTTTModelAdapters } = await import("@apex/shared-runtime");
  return { adapters: listTTTModelAdapters() };
});

app.post("/api/local/memory/routing/score", async (request) => {
  const { scoreMemoryRoutingCandidates } = await import("@apex/shared-runtime");
  const input = request.body as { query: string; task_id?: string; task_family?: string; department?: string; top_k?: number };
  return scoreMemoryRoutingCandidates(input);
});

app.post("/api/local/memory/routing/hit-quality", async (request) => {
  const { computeMemoryHitQuality } = await import("@apex/shared-runtime");
  const input = request.body as { query: string; task_id?: string; task_family?: string; department?: string };
  return { hit_quality: computeMemoryHitQuality(input) };
});

app.post("/api/local/memory/routing/rerank-directory", async (request) => {
  const { rerankMemoryDirectory } = await import("@apex/shared-runtime");
  const input = request.body as { directory_id: string; query: string; task_family?: string; department?: string };
  return { results: rerankMemoryDirectory(input) };
});

app.post("/api/local/memory/routing/link-playbook", async (request) => {
  const { linkPlaybookToRouting } = await import("@apex/shared-runtime");
  const input = request.body as { playbook_memory_id: string; task_family: string; department?: string };
  return linkPlaybookToRouting(input);
});

app.get("/api/local/workspace/hybrid-memory-ttt-panel", async (request) => {
  const { buildHybridMemoryTTTPanelState } = await import("@apex/shared-runtime");
  const query = request.query as { taskId?: string };
  return buildHybridMemoryTTTPanelState(query.taskId);
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "local-control-plane started", { host: env.HOST, port: env.PORT });
});
