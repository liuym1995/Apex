import { createHash, createHmac } from "node:crypto";
import { store } from "@apex/shared-state";
import {
  AuditEntrySchema,
  CanonicalSkillBundleManifestSchema,
  CanonicalSkillDocumentFormatSchema,
  CanonicalSkillSpecSchema,
  createEntityId,
  nowIso,
  type CanonicalSkillBundleManifest,
  type CanonicalSkillBundleProvenanceEvent,
  type CanonicalSkillDocumentFormat,
  type CanonicalSkillExecutionMode,
  type CanonicalSkillStatus,
  type CanonicalSkillSpec
} from "@apex/shared-types";

function createCanonicalSkillId(source: CanonicalSkillSpec["source"], name: string, promptTemplate: string) {
  const digest = createHash("sha256")
    .update(`${source}:${name}:${promptTemplate}`)
    .digest("hex")
    .slice(0, 16);
  return `skill_${source}_${digest}`;
}

function createCanonicalSkillIntegrityHash(input: {
  source: CanonicalSkillSpec["source"];
  name: string;
  description: string;
  prompt_template: string;
  trigger_phrases: string[];
  tags: string[];
  required_capabilities: string[];
  preferred_workers: string[];
  notes: string[];
  execution_mode: CanonicalSkillExecutionMode;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: input.source,
        name: input.name,
        description: input.description,
        prompt_template: input.prompt_template,
        trigger_phrases: input.trigger_phrases,
        tags: input.tags,
        required_capabilities: input.required_capabilities,
        preferred_workers: input.preferred_workers,
        notes: input.notes,
        execution_mode: input.execution_mode
      })
    )
    .digest("hex");
}

function recordSkillAudit(action: string, skill: Pick<CanonicalSkillSpec, "skill_id">, payload: Record<string, unknown> = {}) {
  store.audits.push(
    AuditEntrySchema.parse({
      audit_id: createEntityId("audit"),
      task_id: undefined,
      action,
      payload: {
        skill_id: skill.skill_id,
        ...payload
      },
      created_at: nowIso()
    })
  );
}

function createBundleIntegrity(skills: CanonicalSkillSpec[], generatedAt: string, includedStatuses: CanonicalSkillStatus[], bundleName?: string) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        bundle_name: bundleName,
        generated_at: generatedAt,
        included_statuses: includedStatuses,
        skills: skills.map(skill => ({
          skill_id: skill.skill_id,
          integrity_hash: skill.integrity_hash,
          version: skill.version,
          status: skill.status
        }))
      })
    )
    .digest("hex");
}

function createBundleSignature(integrity: string, secret: string) {
  return createHmac("sha256", secret)
    .update(integrity)
    .digest("hex");
}

function parsePolicyList(values?: string[]): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))];
}

function toBundleAuditAction(action: string): CanonicalSkillBundleProvenanceEvent["action"] | null {
  switch (action) {
    case "skill.bundle_exported":
      return "bundle_exported";
    case "skill.bundle_imported":
      return "bundle_imported";
    case "skill.bundle_promoted":
      return "bundle_promoted";
    default:
      return null;
  }
}

function listBundleProvenanceHistory(bundleName: string): CanonicalSkillBundleProvenanceEvent[] {
  const events: CanonicalSkillBundleProvenanceEvent[] = [];
  for (const audit of [...store.audits.values()]) {
      const action = toBundleAuditAction(audit.action);
      const event = audit.payload?.provenance_event;
      if (!action || !event || typeof event !== "object" || Array.isArray(event)) {
        continue;
      }
      const parsed = event as Record<string, unknown>;
      if ((parsed.bundle_name ?? bundleName) !== bundleName) {
        continue;
      }
      events.push({
        event_id: typeof parsed.event_id === "string" ? parsed.event_id : createEntityId("bundleevt"),
        action,
        occurred_at: typeof parsed.occurred_at === "string" ? parsed.occurred_at : audit.created_at,
        actor_id: typeof parsed.actor_id === "string" ? parsed.actor_id : undefined,
        actor_name: typeof parsed.actor_name === "string" ? parsed.actor_name : undefined,
        environment: typeof parsed.environment === "string" ? parsed.environment : undefined,
        release_channel: typeof parsed.release_channel === "string" ? parsed.release_channel : undefined,
        note: typeof parsed.note === "string" ? parsed.note : undefined,
        bundle_name: typeof parsed.bundle_name === "string" ? parsed.bundle_name : bundleName,
        skill_ids: Array.isArray(parsed.skill_ids) ? parsed.skill_ids.filter((item): item is string => typeof item === "string") : [],
        included_statuses: Array.isArray(parsed.included_statuses)
          ? parsed.included_statuses.filter((item): item is CanonicalSkillStatus => typeof item === "string")
          : [],
        signature_key_id: typeof parsed.signature_key_id === "string" ? parsed.signature_key_id : undefined
      });
  }
  return events.sort((left: CanonicalSkillBundleProvenanceEvent, right: CanonicalSkillBundleProvenanceEvent) =>
    left.occurred_at.localeCompare(right.occurred_at)
  );
}

export function listCanonicalSkillBundleHistory(input?: { bundle_name?: string }) {
  const rawEvents = [...store.audits.values()]
    .flatMap(audit => {
      const action = toBundleAuditAction(audit.action);
      const event = audit.payload?.provenance_event;
      if (!action || !event || typeof event !== "object" || Array.isArray(event)) {
        return [];
      }
      const parsed = event as Record<string, unknown>;
      const bundleName = typeof parsed.bundle_name === "string" ? parsed.bundle_name : "default";
      return [
        {
          event_id: typeof parsed.event_id === "string" ? parsed.event_id : createEntityId("bundleevt"),
          action,
          occurred_at: typeof parsed.occurred_at === "string" ? parsed.occurred_at : audit.created_at,
          actor_id: typeof parsed.actor_id === "string" ? parsed.actor_id : undefined,
          actor_name: typeof parsed.actor_name === "string" ? parsed.actor_name : undefined,
          environment: typeof parsed.environment === "string" ? parsed.environment : undefined,
          release_channel: typeof parsed.release_channel === "string" ? parsed.release_channel : undefined,
          note: typeof parsed.note === "string" ? parsed.note : undefined,
          bundle_name: bundleName,
          skill_ids: Array.isArray(parsed.skill_ids) ? parsed.skill_ids.filter((item): item is string => typeof item === "string") : [],
          included_statuses: Array.isArray(parsed.included_statuses)
            ? parsed.included_statuses.filter((item): item is CanonicalSkillStatus => typeof item === "string")
            : [],
          signature_key_id: typeof parsed.signature_key_id === "string" ? parsed.signature_key_id : undefined
        } satisfies CanonicalSkillBundleProvenanceEvent
      ];
    })
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));

  if (input?.bundle_name) {
    return rawEvents.filter(event => event.bundle_name === input.bundle_name);
  }
  return rawEvents;
}

function normalizeList(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(value => (value ?? "").trim()).filter(Boolean))];
}

function inferExecutionMode(promptTemplate: string, requiredCapabilities: string[]): CanonicalSkillExecutionMode {
  const normalizedPrompt = promptTemplate.toLowerCase();
  if (requiredCapabilities.length > 0) {
    return "tool_orchestrated";
  }
  if (normalizedPrompt.includes("delegate") || normalizedPrompt.includes("worker")) {
    return "worker_delegated";
  }
  return "advisory";
}

function buildCanonicalSkillSpec(input: {
  source: CanonicalSkillSpec["source"];
  name: string;
  description: string;
  prompt_template: string;
  trigger_phrases?: string[];
  tags?: string[];
  required_capabilities?: string[];
  preferred_workers?: string[];
  notes?: string[];
  execution_mode?: CanonicalSkillExecutionMode;
  status?: CanonicalSkillStatus;
  reviewed_by?: string;
  governance_note?: string;
  version?: number;
}): CanonicalSkillSpec {
  const createdAt = nowIso();
  const requiredCapabilities = normalizeList(input.required_capabilities ?? []);
  const executionMode = input.execution_mode ?? inferExecutionMode(input.prompt_template, requiredCapabilities);
  const triggerPhrases = normalizeList(input.trigger_phrases ?? []);
  const tags = normalizeList(input.tags ?? []);
  const preferredWorkers = normalizeList(input.preferred_workers ?? []);
  const notes = normalizeList(input.notes ?? []);
  const status = input.status ?? (input.source === "internal" ? "active" : "review_required");
  const reviewedAt = status === "active" ? nowIso() : undefined;
  return CanonicalSkillSpecSchema.parse({
    skill_id: createCanonicalSkillId(input.source, input.name, input.prompt_template),
    name: input.name.trim(),
    description: input.description.trim(),
    source: input.source,
    execution_mode: executionMode,
    prompt_template: input.prompt_template.trim(),
    trigger_phrases: triggerPhrases,
    tags,
    required_capabilities: requiredCapabilities,
    preferred_workers: preferredWorkers,
    notes,
    status,
    integrity_hash: createCanonicalSkillIntegrityHash({
      source: input.source,
      name: input.name.trim(),
      description: input.description.trim(),
      prompt_template: input.prompt_template.trim(),
      trigger_phrases: triggerPhrases,
      tags,
      required_capabilities: requiredCapabilities,
      preferred_workers: preferredWorkers,
      notes,
      execution_mode: executionMode
    }),
    reviewed_by: status === "active" ? input.reviewed_by ?? "system:auto" : undefined,
    reviewed_at: reviewedAt,
    governance_note: input.governance_note,
    version: input.version ?? 1,
    created_at: createdAt,
    updated_at: createdAt
  });
}

export function registerCanonicalSkill(skill: CanonicalSkillSpec): CanonicalSkillSpec {
  const existing = store.canonicalSkills.get(skill.skill_id);
  const integrityHash = createCanonicalSkillIntegrityHash({
    source: skill.source,
    name: skill.name,
    description: skill.description,
    prompt_template: skill.prompt_template,
    trigger_phrases: skill.trigger_phrases,
    tags: skill.tags,
    required_capabilities: skill.required_capabilities,
    preferred_workers: skill.preferred_workers,
    notes: skill.notes,
    execution_mode: skill.execution_mode
  });
  const persisted = CanonicalSkillSpecSchema.parse({
    ...skill,
    integrity_hash: integrityHash,
    created_at: existing?.created_at ?? skill.created_at ?? nowIso(),
    updated_at: nowIso(),
    version: existing ? Math.max(existing.version + 1, skill.version) : skill.version
  });
  store.canonicalSkills.set(persisted.skill_id, persisted);
  recordSkillAudit(existing ? "skill.updated" : "skill.registered", persisted, {
    source: persisted.source,
    status: persisted.status,
    version: persisted.version
  });
  return persisted;
}

export function listCanonicalSkills(): CanonicalSkillSpec[] {
  return [...store.canonicalSkills.values()];
}

export function listCanonicalSkillReviewQueue(): CanonicalSkillSpec[] {
  return listCanonicalSkills()
    .filter(skill => skill.status === "review_required")
    .sort((left, right) => left.updated_at.localeCompare(right.updated_at));
}

export function getCanonicalSkill(skillId: string): CanonicalSkillSpec | null {
  return store.canonicalSkills.get(skillId) ?? null;
}

export function listCanonicalSkillAudits(skillId: string) {
  return store.audits
    .filter(audit => audit.payload?.skill_id === skillId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function searchCanonicalSkills(input: {
  query?: string;
  tags?: string[];
  source?: CanonicalSkillSpec["source"];
  status?: CanonicalSkillStatus;
}): CanonicalSkillSpec[] {
  const normalizedQuery = (input.query ?? "").trim().toLowerCase();
  const normalizedTags = new Set((input.tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean));
  return listCanonicalSkills()
    .filter(skill => (input.source ? skill.source === input.source : true))
    .filter(skill => (input.status ? skill.status === input.status : true))
    .map(skill => {
      let score = 0;
      const haystacks = [
        skill.name.toLowerCase(),
        skill.description.toLowerCase(),
        ...skill.trigger_phrases.map(item => item.toLowerCase()),
        ...skill.tags.map(item => item.toLowerCase()),
        ...skill.required_capabilities.map(item => item.toLowerCase())
      ];
      if (normalizedQuery) {
        for (const haystack of haystacks) {
          if (haystack.includes(normalizedQuery)) {
            score += 4;
          }
        }
      } else {
        score += 1;
      }
      if (normalizedTags.size > 0) {
        for (const tag of skill.tags) {
          if (normalizedTags.has(tag.toLowerCase())) {
            score += 2;
          }
        }
      }
      if (skill.status === "active") score += 3;
      if (skill.status === "review_required") score += 1;
      score += Math.min(skill.version, 3);
      return { skill, score };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name))
    .map(item => item.skill);
}

function extractBulletList(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const targetHeading = heading.trim().toLowerCase();
  const collected: string[] = [];
  let insideSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^##?\s+(.+)$/);
    if (headingMatch) {
      const normalizedHeading = headingMatch[1].trim().toLowerCase();
      if (insideSection && normalizedHeading !== targetHeading) {
        break;
      }
      insideSection = normalizedHeading === targetHeading;
      continue;
    }
    if (!insideSection) {
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      collected.push(line.replace(/^[-*]\s+/, "").trim());
      continue;
    }
    if (line.length === 0) {
      continue;
    }
    break;
  }

  return collected.filter(Boolean);
}

function extractFirstParagraph(markdown: string): string {
  const cleaned = markdown
    .replace(/^---[\s\S]*?---/, "")
    .split(/\r?\n\r?\n/)
    .map(chunk => chunk.trim())
    .find(chunk => chunk.length > 0 && !chunk.startsWith("#"));
  return cleaned ?? "Imported skill";
}

function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function normalizeOpenClawSkill(input: {
  name?: string;
  markdown: string;
  metadata?: {
    tags?: string[];
    required_capabilities?: string[];
    preferred_workers?: string[];
  };
}): CanonicalSkillSpec {
  const title = extractTitle(input.markdown, input.name ?? "OpenClaw Skill");
  return buildCanonicalSkillSpec({
    source: "openclaw",
    name: title,
    description: extractFirstParagraph(input.markdown),
    prompt_template: input.markdown,
    trigger_phrases: [title, ...extractBulletList(input.markdown, "Triggers")],
    tags: [...(input.metadata?.tags ?? []), "openclaw"],
    required_capabilities: input.metadata?.required_capabilities ?? extractBulletList(input.markdown, "Capabilities"),
    preferred_workers: input.metadata?.preferred_workers ?? extractBulletList(input.markdown, "Workers"),
    notes: extractBulletList(input.markdown, "Notes")
  });
}

export function importOpenClawSkill(input: {
  name?: string;
  markdown: string;
  metadata?: {
    tags?: string[];
    required_capabilities?: string[];
    preferred_workers?: string[];
  };
}): CanonicalSkillSpec {
  return registerCanonicalSkill(normalizeOpenClawSkill(input));
}

function normalizeClaudeSkill(input: {
  command_name?: string;
  markdown: string;
  description?: string;
  tags?: string[];
}): CanonicalSkillSpec {
  const title = extractTitle(input.markdown, input.command_name ?? "Claude Skill");
  const commandName = (input.command_name ?? title).replace(/^\/+/, "").trim();
  return buildCanonicalSkillSpec({
    source: "claude",
    name: commandName,
    description: input.description?.trim() || extractFirstParagraph(input.markdown),
    prompt_template: input.markdown,
    trigger_phrases: [commandName, `/${commandName}`],
    tags: [...(input.tags ?? []), "claude-command"],
    notes: extractBulletList(input.markdown, "Notes")
  });
}

export function importClaudeSkill(input: {
  command_name?: string;
  markdown: string;
  description?: string;
  tags?: string[];
}): CanonicalSkillSpec {
  return registerCanonicalSkill(normalizeClaudeSkill(input));
}

function normalizeOpenAiSkill(input: {
  name: string;
  description: string;
  instructions: string;
  trigger_phrases?: string[];
  tags?: string[];
  required_capabilities?: string[];
  preferred_workers?: string[];
}): CanonicalSkillSpec {
  return buildCanonicalSkillSpec({
    source: "openai",
    name: input.name,
    description: input.description,
    prompt_template: input.instructions,
    trigger_phrases: input.trigger_phrases ?? [input.name],
    tags: [...(input.tags ?? []), "openai-skill"],
    required_capabilities: input.required_capabilities,
    preferred_workers: input.preferred_workers
  });
}

export function importOpenAiSkill(input: {
  name: string;
  description: string;
  instructions: string;
  trigger_phrases?: string[];
  tags?: string[];
  required_capabilities?: string[];
  preferred_workers?: string[];
}): CanonicalSkillSpec {
  return registerCanonicalSkill(normalizeOpenAiSkill(input));
}

export function createInternalSkill(input: {
  name: string;
  description: string;
  prompt_template: string;
  trigger_phrases?: string[];
  tags?: string[];
  required_capabilities?: string[];
  preferred_workers?: string[];
  notes?: string[];
}): CanonicalSkillSpec {
  return registerCanonicalSkill(buildCanonicalSkillSpec({
    source: "internal",
    name: input.name,
    description: input.description,
    prompt_template: input.prompt_template,
    trigger_phrases: input.trigger_phrases,
    tags: input.tags,
    required_capabilities: input.required_capabilities,
    preferred_workers: input.preferred_workers,
    notes: input.notes
  }));
}

export function updateCanonicalSkillGovernance(input: {
  skill_id: string;
  status: CanonicalSkillStatus;
  reviewed_by?: string;
  governance_note?: string;
}): CanonicalSkillSpec {
  const existing = getCanonicalSkill(input.skill_id);
  if (!existing) {
    throw new Error(`Canonical skill not found: ${input.skill_id}`);
  }
  const now = nowIso();
  const nextSkill = CanonicalSkillSpecSchema.parse({
    ...existing,
    status: input.status,
    reviewed_by: input.status === "review_required" ? undefined : input.reviewed_by ?? "system:governance",
    reviewed_at: input.status === "review_required" ? undefined : now,
    governance_note: input.governance_note,
    updated_at: now,
    version: existing.version + 1
  });
  store.canonicalSkills.set(nextSkill.skill_id, nextSkill);
  recordSkillAudit("skill.governance_updated", nextSkill, {
    status: nextSkill.status,
    reviewed_by: nextSkill.reviewed_by,
    governance_note: nextSkill.governance_note,
    version: nextSkill.version
  });
  return nextSkill;
}

export function exportCanonicalSkillBundle(input?: {
  skill_ids?: string[];
  statuses?: CanonicalSkillStatus[];
  bundle_name?: string;
  signature_secret?: string;
  signature_key_id?: string;
  publisher?: {
    publisher_id: string;
    publisher_name?: string;
  };
  source_environment?: string;
  release_channel?: string;
  promotion_note?: string;
}): CanonicalSkillBundleManifest {
  const allowedSkillIds = input?.skill_ids ? new Set(input.skill_ids) : null;
  const allowedStatuses = new Set<CanonicalSkillStatus>(input?.statuses ?? ["active"]);
  const skills = listCanonicalSkills()
    .filter(skill => (allowedSkillIds ? allowedSkillIds.has(skill.skill_id) : true))
    .filter(skill => allowedStatuses.has(skill.status))
    .sort((left, right) => left.name.localeCompare(right.name));
  const generatedAt = nowIso();
  const bundleName = input?.bundle_name ?? "default";
  const includedStatuses: CanonicalSkillStatus[] = [...allowedStatuses];
  const integrity = createBundleIntegrity(skills, generatedAt, includedStatuses, input?.bundle_name);
  const currentAction: CanonicalSkillBundleProvenanceEvent["action"] =
    input?.release_channel || input?.promotion_note || (includedStatuses.length === 1 && includedStatuses[0] === "active")
      ? "bundle_promoted"
      : "bundle_exported";
  const currentEvent: CanonicalSkillBundleProvenanceEvent = {
    event_id: createEntityId("bundleevt"),
    action: currentAction,
    occurred_at: generatedAt,
    actor_id: input?.publisher?.publisher_id,
    actor_name: input?.publisher?.publisher_name,
    environment: input?.source_environment,
    release_channel: input?.release_channel,
    note: input?.promotion_note,
    bundle_name: bundleName,
    skill_ids: skills.map(skill => skill.skill_id),
    included_statuses: includedStatuses,
    signature_key_id: input?.signature_key_id
  };
  const bundle = CanonicalSkillBundleManifestSchema.parse({
    bundle_version: 1,
    bundle_name: input?.bundle_name,
    generated_at: generatedAt,
    included_statuses: includedStatuses,
    skill_count: skills.length,
    skills,
    integrity,
    publisher: input?.publisher
      ? {
          publisher_id: input.publisher.publisher_id,
          publisher_name: input.publisher.publisher_name,
          published_at: generatedAt
        }
      : undefined,
    provenance: {
      source_environment: input?.source_environment,
      release_channel: input?.release_channel,
      promotion_note: input?.promotion_note,
      current_event: currentEvent,
      promotion_history: listBundleProvenanceHistory(bundleName)
    },
    signature: input?.signature_secret
      ? {
          algorithm: "hmac-sha256",
          key_id: input.signature_key_id,
          value: createBundleSignature(integrity, input.signature_secret)
        }
      : undefined
  });
  recordSkillAudit(currentAction === "bundle_promoted" ? "skill.bundle_promoted" : "skill.bundle_exported", { skill_id: `bundle:${bundle.bundle_name ?? "default"}` }, {
    bundle_name: bundle.bundle_name,
    skill_count: bundle.skill_count,
    included_statuses: bundle.included_statuses,
    publisher: bundle.publisher,
    provenance_event: currentEvent,
    release_channel: bundle.provenance?.release_channel,
    source_environment: bundle.provenance?.source_environment
  });
  return bundle;
}

export function verifyCanonicalSkillBundle(input: {
  bundle: CanonicalSkillBundleManifest;
  signature_secret?: string;
  policy?: {
    trusted_publishers?: string[];
    allowed_release_channels?: string[];
    allowed_skill_sources?: CanonicalSkillSpec["source"][];
    blocked_tags?: string[];
    blocked_capabilities?: string[];
  };
}) {
  const bundle = CanonicalSkillBundleManifestSchema.parse(input.bundle);
  const issues: string[] = [];
  const computedIntegrity = createBundleIntegrity(bundle.skills, bundle.generated_at, bundle.included_statuses, bundle.bundle_name);
  const integrity_valid = computedIntegrity === bundle.integrity;
  if (!integrity_valid) {
    issues.push("Bundle integrity does not match manifest contents.");
  }
  const missingSkillIntegrity = bundle.skills.filter(skill => {
    const recomputed = createCanonicalSkillIntegrityHash({
      source: skill.source,
      name: skill.name,
      description: skill.description,
      prompt_template: skill.prompt_template,
      trigger_phrases: skill.trigger_phrases,
      tags: skill.tags,
      required_capabilities: skill.required_capabilities,
      preferred_workers: skill.preferred_workers,
      notes: skill.notes,
      execution_mode: skill.execution_mode
    });
    return recomputed !== skill.integrity_hash;
  });
  if (missingSkillIntegrity.length > 0) {
    issues.push(`Skill integrity mismatch for ${missingSkillIntegrity.length} skill(s).`);
  }
  let signature_valid: boolean | null = null;
  if (bundle.signature) {
    signature_valid = Boolean(input.signature_secret) && createBundleSignature(bundle.integrity, input.signature_secret!) === bundle.signature.value;
    if (!signature_valid) {
      issues.push("Bundle signature verification failed.");
    }
  }
  const trustedPublishers = parsePolicyList(input.policy?.trusted_publishers);
  const allowedReleaseChannels = parsePolicyList(input.policy?.allowed_release_channels);
  const publisher_trusted =
    trustedPublishers.length === 0
      ? null
      : Boolean(bundle.publisher?.publisher_id) && trustedPublishers.includes(bundle.publisher!.publisher_id);
  if (publisher_trusted === false) {
    issues.push(`Bundle publisher '${bundle.publisher?.publisher_id ?? "unknown"}' is not trusted by local policy.`);
  }
  const release_channel_allowed =
    allowedReleaseChannels.length === 0
      ? null
      : Boolean(bundle.provenance?.release_channel) && allowedReleaseChannels.includes(bundle.provenance!.release_channel!);
  if (release_channel_allowed === false) {
    issues.push(`Bundle release channel '${bundle.provenance?.release_channel ?? "unspecified"}' is not allowed by local policy.`);
  }
  const allowedSkillSources = parsePolicyList(input.policy?.allowed_skill_sources);
  const blockedTags = parsePolicyList(input.policy?.blocked_tags).map(tag => tag.toLowerCase());
  const blockedCapabilities = parsePolicyList(input.policy?.blocked_capabilities).map(item => item.toLowerCase());
  const source_policy_allowed =
    allowedSkillSources.length === 0
      ? null
      : bundle.skills.every(skill => allowedSkillSources.includes(skill.source));
  if (source_policy_allowed === false) {
    issues.push("Bundle contains one or more skill sources that are not allowed by local policy.");
  }
  const tag_policy_allowed =
    blockedTags.length === 0
      ? null
      : bundle.skills.every(skill => skill.tags.every(tag => !blockedTags.includes(tag.toLowerCase())));
  if (tag_policy_allowed === false) {
    issues.push("Bundle contains one or more blocked skill tags.");
  }
  const capability_policy_allowed =
    blockedCapabilities.length === 0
      ? null
      : bundle.skills.every(skill =>
          skill.required_capabilities.every(capability => !blockedCapabilities.includes(capability.toLowerCase()))
        );
  if (capability_policy_allowed === false) {
    issues.push("Bundle contains one or more blocked required capabilities.");
  }
  return {
    valid: issues.length === 0,
    integrity_valid,
    signature_valid,
    publisher_trusted,
    release_channel_allowed,
    source_policy_allowed,
    tag_policy_allowed,
    capability_policy_allowed,
    issues
  };
}

export function importCanonicalSkillBundle(input: {
  bundle: CanonicalSkillBundleManifest;
  trust_bundle?: boolean;
  signature_secret?: string;
  policy?: {
    trusted_publishers?: string[];
    allowed_release_channels?: string[];
    allowed_skill_sources?: CanonicalSkillSpec["source"][];
    blocked_tags?: string[];
    blocked_capabilities?: string[];
    require_trusted_bundle?: boolean;
  };
}) {
  const bundle = CanonicalSkillBundleManifestSchema.parse(input.bundle);
  const verification = verifyCanonicalSkillBundle({
    bundle,
    signature_secret: input.signature_secret,
    policy: input.policy
  });
  if (!verification.valid) {
    throw new Error(`Bundle verification failed: ${verification.issues.join(" ")}`);
  }
  const trustEligible =
    verification.signature_valid !== false &&
    verification.publisher_trusted !== false &&
    verification.release_channel_allowed !== false &&
    verification.source_policy_allowed !== false &&
    verification.tag_policy_allowed !== false &&
    verification.capability_policy_allowed !== false;
  if (input.trust_bundle && !trustEligible) {
    throw new Error("Trusted bundle import was requested, but the bundle did not satisfy local trust policy.");
  }
  if (input.policy?.require_trusted_bundle && !trustEligible) {
    throw new Error("Local policy requires trusted bundle import, but this bundle did not satisfy trust requirements.");
  }
  const imported: CanonicalSkillSpec[] = [];
  for (const skill of bundle.skills) {
    const normalizedStatus =
      (input.trust_bundle || input.policy?.require_trusted_bundle) && trustEligible
        ? skill.status
        : skill.status === "disabled"
          ? "disabled"
          : "review_required";
    const persisted = registerCanonicalSkill(
      CanonicalSkillSpecSchema.parse({
        ...skill,
        status: normalizedStatus,
        reviewed_by: normalizedStatus === "active" ? skill.reviewed_by : undefined,
        reviewed_at: normalizedStatus === "active" ? skill.reviewed_at : undefined,
        governance_note:
          normalizedStatus === skill.status
            ? skill.governance_note
            : "Imported from bundle and downgraded to review_required until local approval."
      })
    );
    imported.push(persisted);
  }
  recordSkillAudit("skill.bundle_imported", { skill_id: `bundle:${bundle.bundle_name ?? "default"}` }, {
    bundle_name: bundle.bundle_name,
    imported_count: imported.length,
    trusted_import: input.trust_bundle ?? false,
    publisher: bundle.publisher,
    provenance_event: {
      event_id: createEntityId("bundleevt"),
      action: "bundle_imported",
      occurred_at: nowIso(),
      actor_id: bundle.publisher?.publisher_id,
      actor_name: bundle.publisher?.publisher_name,
      environment: bundle.provenance?.source_environment,
      release_channel: bundle.provenance?.release_channel,
      note: bundle.provenance?.promotion_note,
      bundle_name: bundle.bundle_name ?? "default",
      skill_ids: imported.map(skill => skill.skill_id),
      included_statuses: bundle.included_statuses,
      signature_key_id: bundle.signature?.key_id
    }
  });
  return {
    verification,
    imported
  };
}

function renderBulletSection(title: string, values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  return [`## ${title}`, ...values.map(value => `- ${value}`), ""].join("\n");
}

function renderOpenClawMarkdown(skill: CanonicalSkillSpec): string {
  return [
    `# ${skill.name}`,
    "",
    skill.description,
    "",
    "## Prompt",
    skill.prompt_template,
    "",
    renderBulletSection("Triggers", skill.trigger_phrases),
    renderBulletSection("Capabilities", skill.required_capabilities),
    renderBulletSection("Workers", skill.preferred_workers),
    renderBulletSection("Notes", skill.notes)
  ]
    .filter(Boolean)
    .join("\n");
}

function renderClaudeMarkdown(skill: CanonicalSkillSpec): string {
  return [
    `# /${skill.name.replace(/^\/+/, "")}`,
    "",
    skill.description,
    "",
    skill.prompt_template,
    "",
    renderBulletSection("Notes", skill.notes)
  ]
    .filter(Boolean)
    .join("\n");
}

function renderOpenAiSkillJson(skill: CanonicalSkillSpec): string {
  return JSON.stringify(
    {
      name: skill.name,
      description: skill.description,
      instructions: skill.prompt_template,
      trigger_phrases: skill.trigger_phrases,
      tags: skill.tags,
      required_capabilities: skill.required_capabilities,
      preferred_workers: skill.preferred_workers
    },
    null,
    2
  );
}

export function exportCanonicalSkill(input: {
  skill_id: string;
  format: CanonicalSkillDocumentFormat;
}): { skill: CanonicalSkillSpec; format: CanonicalSkillDocumentFormat; content: string } {
  const format = CanonicalSkillDocumentFormatSchema.parse(input.format);
  const skill = getCanonicalSkill(input.skill_id);
  if (!skill) {
    throw new Error(`Canonical skill not found: ${input.skill_id}`);
  }
  switch (format) {
    case "canonical_json":
      return {
        skill,
        format,
        content: JSON.stringify(skill, null, 2)
      };
    case "openclaw_markdown":
      return {
        skill,
        format,
        content: renderOpenClawMarkdown(skill)
      };
    case "claude_markdown":
      return {
        skill,
        format,
        content: renderClaudeMarkdown(skill)
      };
    case "openai_json":
      return {
        skill,
        format,
        content: renderOpenAiSkillJson(skill)
      };
    default:
      throw new Error(`Unsupported skill export format: ${format satisfies never}`);
  }
}

export function importSkillDocument(input: {
  format: CanonicalSkillDocumentFormat;
  content: string;
  register?: boolean;
  metadata?: {
    command_name?: string;
    name?: string;
    description?: string;
    tags?: string[];
    required_capabilities?: string[];
    preferred_workers?: string[];
    notes?: string[];
  };
}): CanonicalSkillSpec {
  const format = CanonicalSkillDocumentFormatSchema.parse(input.format);
  const shouldRegister = input.register ?? true;
  switch (format) {
    case "canonical_json": {
      const canonicalSkill = CanonicalSkillSpecSchema.parse(JSON.parse(input.content));
      return shouldRegister ? registerCanonicalSkill(canonicalSkill) : canonicalSkill;
    }
    case "openclaw_markdown":
      return shouldRegister
        ? importOpenClawSkill({
            name: input.metadata?.name,
            markdown: input.content,
            metadata: {
              tags: input.metadata?.tags,
              required_capabilities: input.metadata?.required_capabilities,
              preferred_workers: input.metadata?.preferred_workers
            }
          })
        : normalizeOpenClawSkill({
            name: input.metadata?.name,
            markdown: input.content,
            metadata: {
              tags: input.metadata?.tags,
              required_capabilities: input.metadata?.required_capabilities,
              preferred_workers: input.metadata?.preferred_workers
            }
          });
    case "claude_markdown":
      return shouldRegister
        ? importClaudeSkill({
            command_name: input.metadata?.command_name,
            markdown: input.content,
            description: input.metadata?.description,
            tags: input.metadata?.tags
          })
        : normalizeClaudeSkill({
            command_name: input.metadata?.command_name,
            markdown: input.content,
            description: input.metadata?.description,
            tags: input.metadata?.tags
          });
    case "openai_json": {
      const parsed = JSON.parse(input.content) as {
        name?: string;
        description?: string;
        instructions?: string;
        trigger_phrases?: string[];
        tags?: string[];
        required_capabilities?: string[];
        preferred_workers?: string[];
      };
      const normalized = {
        name: parsed.name ?? input.metadata?.name ?? "OpenAI Imported Skill",
        description: parsed.description ?? input.metadata?.description ?? "Imported OpenAI skill",
        instructions: parsed.instructions ?? "",
        trigger_phrases: parsed.trigger_phrases,
        tags: parsed.tags ?? input.metadata?.tags,
        required_capabilities: parsed.required_capabilities ?? input.metadata?.required_capabilities,
        preferred_workers: parsed.preferred_workers ?? input.metadata?.preferred_workers
      };
      return shouldRegister ? importOpenAiSkill(normalized) : normalizeOpenAiSkill(normalized);
    }
    default:
      throw new Error(`Unsupported skill import format: ${format satisfies never}`);
  }
}
