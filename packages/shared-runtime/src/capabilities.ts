import { store } from "@apex/shared-state";
import {
  AuditEntrySchema,
  CapabilityDescriptorSchema,
  CapabilityResolutionSchema,
  CapabilityScoreBreakdownSchema,
  createEntityId,
  nowIso,
  type CapabilityDescriptor,
  type CapabilityKind,
  type CapabilityResolution,
  type CapabilityScoreBreakdown,
  type CanonicalSkillSpec,
  type SkillCandidate,
  type TaskContract
} from "@apex/shared-types";

export type CapabilityNeed = {
  need_key: string;
  need_title: string;
  description: string;
  preferred_kinds: CapabilityKind[];
  tags: string[];
};

type LearnedSkillRecord = {
  candidate: SkillCandidate;
  task: TaskContract | undefined;
};

type TaskSimilarityProbe = Pick<TaskContract, "department" | "task_type" | "intent"> & {
  inputs?: Record<string, unknown>;
};

function getExecutionTemplateKey(task: { inputs?: Record<string, unknown> }) {
  const raw = task.inputs?.execution_template_key;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().toLowerCase() : undefined;
}

const staticCapabilityCatalog = CapabilityDescriptorSchema.array().parse([
  {
    capability_id: "skill.engineering.execution-plan",
    name: "Engineering Execution Playbook",
    kind: "skill",
    source: "local-registry",
    summary: "Reusable engineering planning and implementation skill.",
    tags: ["engineering", "plan", "implementation", "skill"]
  },
  {
    capability_id: "skill.qa.release-verification",
    name: "QA Release Verification",
    kind: "skill",
    source: "local-registry",
    summary: "Strict QA verification playbook for release readiness tasks.",
    tags: ["qa", "verification", "browser", "skill"]
  },
  {
    capability_id: "skill.finance.reconciliation",
    name: "Finance Reconciliation Playbook",
    kind: "skill",
    source: "local-registry",
    summary: "Reusable reconciliation and exception review methodology.",
    tags: ["finance", "reconciliation", "reporting", "skill"]
  },
  {
    capability_id: "mcp.github",
    name: "GitHub MCP",
    kind: "mcp_server",
    source: "mcp",
    summary: "Source control, pull request, and issue access through MCP.",
    tags: ["engineering", "git", "github", "code", "mcp"]
  },
  {
    capability_id: "mcp.filesystem",
    name: "Filesystem MCP",
    kind: "mcp_server",
    source: "mcp",
    summary: "Standardized file and directory access for local workspaces.",
    tags: ["files", "filesystem", "local", "mcp"]
  },
  {
    capability_id: "tool.local-fs-read",
    name: "Local File Reader",
    kind: "tool",
    source: "local-control-plane",
    summary: "Read-only local file access within approved workspace roots.",
    tags: ["files", "filesystem", "local", "tool", "read"]
  },
  {
    capability_id: "tool.local-fs-write",
    name: "Local File Writer",
    kind: "tool",
    source: "local-control-plane",
    summary: "Confirmation-gated local file write with backup artifact capture.",
    tags: ["files", "filesystem", "local", "tool", "write"]
  },
  {
    capability_id: "tool.local-fs-patch",
    name: "Local File Patch Tool",
    kind: "tool",
    source: "local-control-plane",
    summary: "Confirmation-gated exact-match patch tool for safer local edits.",
    tags: ["files", "filesystem", "local", "tool", "patch", "edit"]
  },
  {
    capability_id: "tool.local-fs-list",
    name: "Local Directory Browser",
    kind: "tool",
    source: "local-control-plane",
    summary: "Read-only directory listing within approved workspace roots.",
    tags: ["files", "filesystem", "local", "tool", "list"]
  },
  {
    capability_id: "tool.local-shell",
    name: "Local Shell Tool",
    kind: "tool",
    source: "local-control-plane",
    summary: "Controlled local shell execution adapter.",
    tags: ["shell", "terminal", "local", "tool"]
  },
  {
    capability_id: "tool.local-browser-snapshot",
    name: "Local Browser Snapshot Tool",
    kind: "tool",
    source: "local-control-plane",
    summary: "Low-risk browser snapshot adapter for QA and validation tasks.",
    tags: ["browser", "automation", "qa", "tool", "snapshot"]
  },
  {
    capability_id: "tool.local-ide-workspace-summary",
    name: "Local IDE Workspace Summary Tool",
    kind: "tool",
    source: "local-control-plane",
    summary: "Read-only workspace inspection that provides IDE-style project context.",
    tags: ["ide", "workspace", "engineering", "tool", "summary"]
  },
  {
    capability_id: "worker.deerflow-long-runner",
    name: "DeerFlow Long Runner",
    kind: "worker",
    source: "worker-runtime",
    summary: "Heavy-duty long-running task execution worker.",
    tags: ["deerflow", "long-running", "engineering", "research", "worker"]
  },
  {
    capability_id: "worker.coding-specialist",
    name: "Coding Specialist Worker",
    kind: "worker",
    source: "worker-runtime",
    summary: "Focused coding worker for implementation and refactoring.",
    tags: ["engineering", "code", "worker"]
  },
  {
    capability_id: "worker.business-operator",
    name: "Business Operator Worker",
    kind: "worker",
    source: "worker-runtime",
    summary: "Business workflow worker for sales, marketing, HR, and ops tasks.",
    tags: ["sales", "marketing", "hr", "ops", "worker"]
  }
]);

function tokenizeIntent(value: string): string[] {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];
  const tokens = normalized.split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean);
  return [...new Set([normalized, ...tokens.filter(token => token.length >= 2)])];
}

function buildTaskTagSet(task: TaskSimilarityProbe): Set<string> {
  const executionTemplateKey = getExecutionTemplateKey(task);
  return new Set([task.department, task.task_type, ...tokenizeIntent(task.intent), ...(executionTemplateKey ? tokenizeIntent(executionTemplateKey) : [])]);
}

function overlapScore(left: Iterable<string>, right: Iterable<string>): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  let overlap = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) overlap += 1;
  }
  return overlap / Math.max(leftSet.size, rightSet.size);
}

function buildTaskFingerprint(task: TaskSimilarityProbe): string {
  const executionTemplateKey = getExecutionTemplateKey(task);
  if (executionTemplateKey) {
    const suffix = executionTemplateKey.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "template";
    return `${task.department}_${task.task_type}_${suffix}`;
  }
  const tokens = tokenizeIntent(task.intent).filter(token => token !== task.intent.trim().toLowerCase());
  const suffix = (tokens.length > 0 ? tokens.slice(0, 5).join("_") : "generic").slice(0, 48);
  return `${task.department}_${task.task_type}_${suffix}`;
}

function scoreLearnedSkill(task: TaskSimilarityProbe, candidate: SkillCandidate): number {
  const taskTags = buildTaskTagSet(task);
  if (candidate.applicability.excluded_tags.some(tag => taskTags.has(tag))) {
    return -1;
  }
  if (candidate.applicability.required_tags.some(tag => !taskTags.has(tag))) {
    return -1;
  }
  let score = 0;
  if (candidate.fingerprint && candidate.fingerprint === buildTaskFingerprint(task)) score += 10;
  for (const tag of candidate.applicability.preferred_tags) {
    if (taskTags.has(tag)) score += 2;
  }
  score += overlapScore(taskTags, [
    ...candidate.applicability.required_tags,
    ...candidate.applicability.preferred_tags
  ]) * 8;
  score += Math.min(candidate.source_task_count, 5);
  score += Math.min(candidate.version, 3);
  return score;
}

function buildApprovedSkills(): LearnedSkillRecord[] {
  return [...store.skillCandidates.values()]
    .filter(candidate => candidate.status === "approved")
    .map(candidate => ({
      candidate,
      task: store.tasks.get(candidate.task_id)
    }));
}

function buildCanonicalSkillCapabilityCatalog(): CapabilityDescriptor[] {
  return [...store.canonicalSkills.values()]
    .filter(skill => skill.status === "active")
    .sort((left, right) => right.version - left.version || left.name.localeCompare(right.name))
    .map((skill: CanonicalSkillSpec) =>
      CapabilityDescriptorSchema.parse({
        capability_id: `canonical_skill_${skill.skill_id}`,
        name: skill.name,
        kind: "skill",
        source: `${skill.source}-registry`,
        summary: `${skill.description} Execution mode: ${skill.execution_mode}. Status: ${skill.status}. Requires: ${skill.required_capabilities.join(", ") || "none"}.`,
        tags: [
          ...new Set([
            "canonical-skill",
            skill.status,
            skill.source,
            ...skill.tags,
            ...skill.trigger_phrases.map(item => item.toLowerCase()),
            ...skill.required_capabilities
          ])
        ]
      })
    );
}

function buildLearnedCapabilityCatalog(): CapabilityDescriptor[] {
  return buildApprovedSkills()
    .sort((left, right) => {
      const leftScore = left.task ? scoreLearnedSkill(left.task, left.candidate) : 0;
      const rightScore = right.task ? scoreLearnedSkill(right.task, right.candidate) : 0;
      return rightScore - leftScore || right.candidate.source_task_count - left.candidate.source_task_count;
    })
    .map(({ candidate, task }) => {
      const taskTags = task
        ? [task.department, task.task_type, ...tokenizeIntent(task.intent)]
        : [];
      return CapabilityDescriptorSchema.parse({
        capability_id: `learned_skill_${candidate.candidate_id}`,
        name: candidate.title,
        kind: "skill",
        source: "learned-playbook",
        summary: `${candidate.summary} Reused from ${candidate.source_task_count ?? 1} successful task(s). Version ${candidate.version}. Applies to: ${candidate.applicability.required_tags.join(", ") || "general"}. Boundaries: ${candidate.failure_boundaries.join(" | ") || "none recorded"}. Evidence: ${candidate.evidence.join(", ")}`,
        tags: [
          ...new Set([
            "learned",
            "playbook",
            candidate.fingerprint ?? "",
            ...candidate.applicability.required_tags,
            ...candidate.applicability.preferred_tags,
            ...taskTags,
            ...tokenizeIntent(candidate.title)
          ].filter(Boolean))
        ]
      });
    });
}

export function searchLearnedPlaybooks(task: Pick<TaskContract, "department" | "task_type" | "intent">): Array<{
  candidate: SkillCandidate;
  score: number;
}> {
  return buildApprovedSkills()
    .map(({ candidate, task: sourceTask }) => ({
      candidate,
      score: scoreLearnedSkill(task, candidate) + (sourceTask ? overlapScore(buildTaskTagSet(task), buildTaskTagSet(sourceTask)) * 4 : 0)
    }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || right.candidate.source_task_count - left.candidate.source_task_count);
}

function requireTaskRecord(taskId: string): TaskContract {
  const task = store.tasks.get(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  return task;
}

function recordCapabilityAudit(taskId: string, action: string, payload: Record<string, unknown>) {
  store.audits.push(
    AuditEntrySchema.parse({
      audit_id: createEntityId("audit"),
      task_id: taskId,
      action,
      payload,
      created_at: nowIso()
    })
  );
}

function uniqueNeeds(needs: CapabilityNeed[]): CapabilityNeed[] {
  const seen = new Set<string>();
  return needs.filter(need => {
    if (seen.has(need.need_key)) return false;
    seen.add(need.need_key);
    return true;
  });
}

function customNeedsFromInputs(task: TaskContract): CapabilityNeed[] {
  const requested = task.inputs.requested_capabilities;
  if (!Array.isArray(requested)) return [];
  return requested
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(value => ({
      need_key: `custom_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      need_title: value,
      description: `User-requested capability: ${value}`,
      preferred_kinds: ["skill", "mcp_server", "tool", "worker"],
      tags: value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    }));
}

export function inferCapabilityNeeds(task: TaskContract): CapabilityNeed[] {
  const baseNeeds: CapabilityNeed[] = [
    {
      need_key: "methodology",
      need_title: "Task methodology",
      description: "Resolve an existing skill or playbook before implementing work from scratch.",
      preferred_kinds: ["skill"],
      tags: [task.department, task.task_type, "playbook", "skill", ...tokenizeIntent(task.intent)]
    },
    {
      need_key: "execution-worker",
      need_title: "Execution worker",
      description: "Choose the most appropriate worker runtime before execution begins.",
      preferred_kinds: ["worker"],
      tags: [task.department, task.task_type, "worker"]
    }
  ];

  if (task.department === "engineering") {
    baseNeeds.push(
      {
        need_key: "source-access",
        need_title: "Source control and filesystem access",
        description: "Find reusable source access connectors before building new integrations.",
        preferred_kinds: ["mcp_server", "tool"],
        tags: ["engineering", "git", "files", "code"]
      },
      {
        need_key: "execution-runtime",
        need_title: "Long-running execution runtime",
        description: "Prefer an existing heavy worker for complex engineering tasks.",
        preferred_kinds: ["worker"],
        tags: ["engineering", task.task_type, "long-running", "deerflow"]
      },
      {
        need_key: "workspace-context",
        need_title: "Workspace context discovery",
        description: "Prefer an existing IDE or workspace context tool before inventing a new inspection path.",
        preferred_kinds: ["tool", "skill"],
        tags: ["engineering", "workspace", "ide", "filesystem"]
      }
    );
  }

  if (task.department === "qa") {
    baseNeeds.push({
      need_key: "browser-automation",
      need_title: "Browser automation",
      description: "Use an existing browser automation tool or worker when available.",
      preferred_kinds: ["tool", "worker", "skill"],
      tags: ["qa", "browser", "verification"]
    });
  }

  if (task.department === "finance") {
    baseNeeds.push({
      need_key: "reconciliation",
      need_title: "Reconciliation methodology",
      description: "Prefer an existing finance reconciliation playbook before custom implementation.",
      preferred_kinds: ["skill", "tool"],
      tags: ["finance", "reconciliation", "reporting"]
    });
  }

  if (task.task_type === "scheduled" || task.task_type === "recurring") {
    baseNeeds.push({
      need_key: "automation",
      need_title: "Automation scheduling support",
      description: "Prefer an existing automation-capable worker or tool for repeatable tasks.",
      preferred_kinds: ["worker", "tool"],
      tags: ["automation", "schedule", task.task_type]
    });
  }

  return uniqueNeeds([...baseNeeds, ...customNeedsFromInputs(task)]);
}

export function searchCapabilityCatalog(input: {
  query?: string;
  preferredKinds?: CapabilityKind[];
  tags?: string[];
}): CapabilityDescriptor[] {
  const query = (input.query ?? "").trim().toLowerCase();
  const preferredKinds = new Set(input.preferredKinds ?? []);
  const tags = (input.tags ?? []).map(tag => tag.toLowerCase());
  const queryTokens = tokenizeIntent(query);

  return getCapabilityCatalog()
    .map(capability => {
      let score = 0;
      if (preferredKinds.size === 0 || preferredKinds.has(capability.kind)) score += 3;
      if (query.length > 0) {
        const haystack = `${capability.name} ${capability.summary} ${capability.tags.join(" ")}`.toLowerCase();
        if (haystack.includes(query)) score += 6;
      }
      for (const tag of tags) {
        if (capability.tags.includes(tag)) score += 2;
      }
      for (const token of queryTokens) {
        if (capability.tags.includes(token)) score += 2;
      }
      if (capability.source === "learned-playbook") score += 1;
      if (capability.tags.includes("canonical-skill")) score += 1;
      return { capability, score };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.capability.name.localeCompare(right.capability.name))
    .map(item => item.capability);
}

function buildResolutionId(taskId: string, needKey: string): string {
  const suffix = needKey.replace(/[^a-z0-9]+/gi, "_").slice(0, 32);
  return `capres_${taskId.slice(-8)}_${suffix}`;
}

function selectCapabilityMatches(
  scored: Array<{ capability: CapabilityDescriptor; breakdown: CapabilityScoreBreakdown }>,
  need: CapabilityNeed
): Array<{ capability: CapabilityDescriptor; breakdown: CapabilityScoreBreakdown }> {
  const topMatches = scored.slice(0, 3);
  const bestLearnedPlaybook = scored.find(item => item.capability.source === "learned-playbook");
  const needsMethodologyMemory =
    need.need_key === "methodology" ||
    need.tags.includes("playbook") ||
    need.preferred_kinds.includes("skill");

  if (
    !needsMethodologyMemory ||
    !bestLearnedPlaybook ||
    topMatches.some(item => item.capability.capability_id === bestLearnedPlaybook.capability.capability_id)
  ) {
    return topMatches;
  }

  if (topMatches.length < 3) {
    return [...topMatches, bestLearnedPlaybook];
  }

  const replacementIndex = topMatches.findIndex(item => item.capability.source !== "learned-playbook");
  if (replacementIndex === -1) {
    return topMatches;
  }

  const selected = [...topMatches];
  selected[replacementIndex] = bestLearnedPlaybook;
  return selected.sort((left, right) => right.breakdown.total_score - left.breakdown.total_score);
}

const DETERMINISTIC_TIER_MAP: Record<string, number> = {
  "local-registry": 5,
  "local-control-plane": 5,
  "worker-runtime": 4,
  "mcp": 3,
  "learned-playbook": 2
};

const SOURCE_WEIGHT_MAP: Record<string, number> = {
  "local-registry": 4,
  "local-control-plane": 5,
  "worker-runtime": 3,
  "mcp": 3,
  "learned-playbook": 2
};

const KIND_DETERMINISTIC_TIER: Record<string, number> = {
  "tool": 5,
  "mcp_server": 4,
  "worker": 3,
  "skill": 2,
  "implementation": 1
};

function scoreCapabilityMultiDimensional(
  capability: CapabilityDescriptor,
  task: TaskContract,
  need: CapabilityNeed
): CapabilityScoreBreakdown {
  const taskTags = buildTaskTagSet(task);
  const capTags = new Set(capability.tags);

  const tag_overlap = overlapScore(taskTags, capTags) * 10;

  const queryText = `${task.intent} ${need.need_title} ${need.tags.join(" ")}`.toLowerCase();
  const haystack = `${capability.name} ${capability.summary} ${capability.tags.join(" ")}`.toLowerCase();
  const queryTokens = tokenizeIntent(queryText);
  let query_relevance = 0;
  if (haystack.includes(queryText)) {
    query_relevance = 8;
  } else {
    const matchedTokens = queryTokens.filter(token => haystack.includes(token));
    query_relevance = (matchedTokens.length / Math.max(queryTokens.length, 1)) * 6;
  }

  const source_weight = (SOURCE_WEIGHT_MAP[capability.source] ?? 1) * 1.0;

  const deterministic_tier = (KIND_DETERMINISTIC_TIER[capability.kind] ?? 1) * 1.0;

  const deterministic_coverage = capability.kind === "tool" || capability.kind === "mcp_server" ? 8 : capability.kind === "skill" ? 4 : 2;

  const locality = capability.source === "local-control-plane" || capability.source === "local-registry" ? 8 : capability.source === "worker-runtime" ? 5 : 3;

  const policy_admissibility = need.preferred_kinds.includes(capability.kind) ? 6 : 0;

  const risk_tier = task.risk_level === "critical" && (capability.source === "learned-playbook" || capability.kind === "implementation") ? -4 : task.risk_level === "high" && capability.source === "learned-playbook" ? -2 : 2;

  const reuseCount = capability.source === "learned-playbook"
    ? parseInt(capability.summary.match(/Reused from (\d+)/)?.[1] ?? "0", 10)
    : 0;
  const reuse_success = Math.min(reuseCount, 5) * 1.5;

  const historical_reliability = capability.source === "local-control-plane" ? 5 : capability.source === "local-registry" ? 4 : capability.source === "mcp" ? 3 : 2;

  const latency = capability.kind === "tool" ? 5 : capability.kind === "mcp_server" ? 3 : capability.kind === "worker" ? 2 : 1;

  const cost = capability.kind === "implementation" ? -3 : capability.kind === "worker" ? -1 : 3;

  const maintenance_burden = capability.kind === "implementation" ? -5 : capability.source === "learned-playbook" ? -1 : 2;

  const total_score =
    tag_overlap +
    query_relevance +
    source_weight +
    deterministic_tier +
    deterministic_coverage +
    locality +
    policy_admissibility +
    risk_tier +
    reuse_success +
    historical_reliability +
    latency +
    cost +
    maintenance_burden;

  const breakdown = CapabilityScoreBreakdownSchema.parse({
    capability_id: capability.capability_id,
    total_score,
    policy_admissibility,
    risk_tier,
    deterministic_coverage,
    locality,
    historical_reliability,
    reuse_success,
    latency,
    cost,
    maintenance_burden,
    tag_overlap,
    query_relevance,
    source_weight,
    deterministic_tier,
    details: {
      kind: capability.kind,
      source: capability.source,
      need_key: need.need_key
    }
  });

  store.capabilityScoreBreakdowns.push(breakdown);
  return breakdown;
}

export function listTaskCapabilityResolutions(taskId: string): CapabilityResolution[] {
  return [...store.capabilityResolutions.values()]
    .filter(resolution => resolution.task_id === taskId)
    .sort((left, right) => left.need_key.localeCompare(right.need_key));
}

export function resolveTaskCapabilities(taskId: string): CapabilityResolution[] {
  const task = requireTaskRecord(taskId);
  const resolutions = inferCapabilityNeeds(task).map(need => {
    const query = `${task.intent} ${need.need_title} ${need.tags.join(" ")}`.trim();
    const candidates = searchCapabilityCatalog({
      query,
      preferredKinds: need.preferred_kinds,
      tags: need.tags
    });

    const scored = candidates
      .map(capability => ({
        capability,
        breakdown: scoreCapabilityMultiDimensional(capability, task, need)
      }))
      .filter(item => item.breakdown.total_score > 0)
      .sort((left, right) => right.breakdown.total_score - left.breakdown.total_score);

    const selected = selectCapabilityMatches(scored, need);
    const matches = selected.map(item => item.capability);
    const topBreakdowns = selected.map(item => item.breakdown);

    const strategy =
      matches.length === 0 ? "implement_local" : matches.length === 1 ? "reuse_existing" : "compose_existing";

    let reasoning: string;
    if (matches.length === 0) {
      reasoning = "No reusable capability matched the need with enough confidence, so the task should fall back to a local implementation path.";
    } else if (matches.length === 1) {
      const bd = topBreakdowns[0];
      reasoning = `Resolved with ${matches[0].kind} '${matches[0].name}' from ${matches[0].source}. Score: ${bd.total_score.toFixed(1)} (deterministic_coverage=${bd.deterministic_coverage}, locality=${bd.locality}, tag_overlap=${bd.tag_overlap.toFixed(1)}, query_relevance=${bd.query_relevance.toFixed(1)}).`;
    } else {
      const scoreSummary = topBreakdowns.map(bd => `${bd.capability_id}=${bd.total_score.toFixed(1)}`).join(", ");
      reasoning = `Resolved by composing ${matches.length} existing capabilities. Scores: ${scoreSummary}. Deterministic-first ordering applied.`;
    }

    const resolution = CapabilityResolutionSchema.parse({
      resolution_id: buildResolutionId(taskId, need.need_key),
      task_id: taskId,
      need_key: need.need_key,
      need_title: need.need_title,
      strategy,
      search_query: query,
      status: matches.length === 0 ? "fallback_required" : "resolved",
      selected_capabilities: matches,
      reasoning,
      created_at: nowIso()
    });

    store.capabilityResolutions.set(resolution.resolution_id, resolution);
    recordCapabilityAudit(
      taskId,
      "task.capability_resolved",
      {
        need_key: need.need_key,
        strategy: resolution.strategy,
        selected_capabilities: resolution.selected_capabilities.map(item => item.capability_id),
        score_breakdowns: topBreakdowns.map(bd => ({
          capability_id: bd.capability_id,
          total_score: bd.total_score,
          deterministic_tier: bd.deterministic_tier,
          locality: bd.locality
        }))
      },
    );
    if (resolution.status === "fallback_required") {
      recordCapabilityAudit(
        taskId,
        "task.capability_fallback_required",
        {
          need_key: need.need_key,
          search_query: query
        }
      );
    }
    return resolution;
  });

  if (resolutions.length === 0) {
    const fallback = CapabilityResolutionSchema.parse({
      resolution_id: createEntityId("capres"),
      task_id: taskId,
      need_key: "generic_execution",
      need_title: "Generic execution path",
      strategy: "implement_local",
      search_query: task.intent,
      status: "fallback_required",
      selected_capabilities: [],
      reasoning: "No explicit capability needs were inferred, so the task will use the default local implementation path.",
      created_at: nowIso()
    });
    store.capabilityResolutions.set(fallback.resolution_id, fallback);
    resolutions.push(fallback);
  }

  return resolutions;
}

export function getCapabilityScoreBreakdowns(taskId: string): CapabilityScoreBreakdown[] {
  const taskResolutions = [...store.capabilityResolutions.values()].filter(r => r.task_id === taskId);
  if (taskResolutions.length === 0) return [];
  const resolutionIds = new Set(taskResolutions.map(r => r.resolution_id));
  return store.capabilityScoreBreakdowns
    .toArray()
    .filter(bd => {
      const details = bd.details as Record<string, unknown>;
      return details.need_key && taskResolutions.some(r => r.need_key === details.need_key);
    });
}

export function getCapabilityCatalog(): CapabilityDescriptor[] {
  return [...staticCapabilityCatalog, ...buildCanonicalSkillCapabilityCatalog(), ...buildLearnedCapabilityCatalog()];
}
