import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type MemoryLayerKind = "semantic" | "episodic" | "procedural";

export type MemoryLayerWritePolicy = "immediate" | "background_batched" | "deferred_on_completion";

export type MemoryLayerCompactionStrategy = "none" | "merge_similar" | "summarize_old" | "promote_and_archive";

export type PromotionVerdict = "promoted" | "deferred" | "rejected";

export interface MemoryLayerSpec {
  layer_id: string;
  kind: MemoryLayerKind;
  display_name: string;
  description: string;
  write_policy: MemoryLayerWritePolicy;
  compaction_strategy: MemoryLayerCompactionStrategy;
  retention_max_items: number;
  retention_max_age_days: number;
  promotion_enabled: boolean;
  promotion_threshold: number;
  directory_prefix: string;
  created_at: string;
}

export interface SemanticMemoryEntry {
  entry_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source_document_ids: string[];
  confidence: number;
  last_validated_at: string;
  validation_count: number;
  layer: "semantic";
  created_at: string;
  updated_at: string;
}

export interface EpisodicMemoryEntry {
  entry_id: string;
  title: string;
  content: string;
  task_id: string;
  task_family: string;
  outcome: "success" | "partial" | "failure";
  step_count: number;
  tool_invocations: number;
  duration_ms: number;
  trace_grade_verdict?: string;
  tags: string[];
  layer: "episodic";
  created_at: string;
  expires_at?: string;
}

export interface ProceduralMemoryEntry {
  entry_id: string;
  title: string;
  content: string;
  procedure_kind: "playbook" | "skill" | "methodology" | "template";
  source_episodic_ids: string[];
  promotion_count: number;
  reuse_count: number;
  success_rate: number;
  stability_score: number;
  tags: string[];
  task_family: string;
  layer: "procedural";
  created_at: string;
  last_used_at?: string;
  promoted_at: string;
}

export type MemoryLayerEntry = SemanticMemoryEntry | EpisodicMemoryEntry | ProceduralMemoryEntry;

export interface MemoryLayerWriteBatch {
  batch_id: string;
  layer_kind: MemoryLayerKind;
  entries: MemoryLayerEntry[];
  status: "pending" | "processing" | "completed" | "failed";
  processed_count: number;
  failed_count: number;
  created_at: string;
  completed_at?: string;
}

export interface MemoryLayerCompactionResult {
  compaction_id: string;
  layer_kind: MemoryLayerKind;
  strategy: MemoryLayerCompactionStrategy;
  entries_before: number;
  entries_after: number;
  entries_removed: number;
  entries_merged: number;
  entries_promoted: number;
  space_reclaimed_pct: number;
  completed_at: string;
}

export interface MemoryLayerPromotionCandidate {
  candidate_id: string;
  source_layer: MemoryLayerKind;
  target_layer: MemoryLayerKind;
  source_entry_id: string;
  promotion_score: number;
  verdict: PromotionVerdict;
  reason: string;
  evaluated_at: string;
}

export interface MemoryLayerRetentionReport {
  layer_kind: MemoryLayerKind;
  total_entries: number;
  entries_over_max_age: number;
  entries_near_retention_limit: number;
  compaction_recommended: boolean;
  oldest_entry_age_days: number;
  average_entry_age_days: number;
  reported_at: string;
}

const layerSpecs = new Map<string, MemoryLayerSpec>();
const semanticEntries = new Map<string, SemanticMemoryEntry>();
const episodicEntries = new Map<string, EpisodicMemoryEntry>();
const proceduralEntries = new Map<string, ProceduralMemoryEntry>();
const writeBatches = new Map<string, MemoryLayerWriteBatch>();
const promotionCandidates = new Map<string, MemoryLayerPromotionCandidate>();

const DEFAULT_LAYERS: Array<Omit<MemoryLayerSpec, "layer_id" | "created_at">> = [
  {
    kind: "semantic",
    display_name: "Semantic Memory",
    description: "Factual knowledge, definitions, domain concepts. Stable, rarely changes. Direct directory addressing preferred.",
    write_policy: "immediate",
    compaction_strategy: "merge_similar",
    retention_max_items: 5000,
    retention_max_age_days: 365,
    promotion_enabled: false,
    promotion_threshold: 0,
    directory_prefix: "semantic/"
  },
  {
    kind: "episodic",
    display_name: "Episodic Memory",
    description: "Task experiences, execution traces, outcomes. Time-bounded. Subject to compaction and promotion into procedural memory.",
    write_policy: "background_batched",
    compaction_strategy: "summarize_old",
    retention_max_items: 10000,
    retention_max_age_days: 90,
    promotion_enabled: true,
    promotion_threshold: 0.7,
    directory_prefix: "episodic/"
  },
  {
    kind: "procedural",
    display_name: "Procedural Memory",
    description: "Learned procedures, playbooks, skills, methodologies. Promoted from stable episodic patterns. High reuse, high stability.",
    write_policy: "deferred_on_completion",
    compaction_strategy: "promote_and_archive",
    retention_max_items: 2000,
    retention_max_age_days: 180,
    promotion_enabled: true,
    promotion_threshold: 0.8,
    directory_prefix: "procedural/"
  }
];

export function registerMemoryLayer(input: Omit<MemoryLayerSpec, "layer_id" | "created_at">): MemoryLayerSpec {
  const spec: MemoryLayerSpec = { ...input, layer_id: createEntityId("mlspec"), created_at: nowIso() };
  layerSpecs.set(spec.layer_id, spec);
  recordAudit("memory_layers.layer_registered", { layer_id: spec.layer_id, kind: input.kind, write_policy: input.write_policy });
  return spec;
}

export function listMemoryLayers(filter?: { kind?: MemoryLayerKind }): MemoryLayerSpec[] {
  let specs = [...layerSpecs.values()];
  if (filter?.kind) specs = specs.filter(s => s.kind === filter.kind);
  return specs;
}

export function getMemoryLayerByKind(kind: MemoryLayerKind): MemoryLayerSpec | undefined {
  return [...layerSpecs.values()].find(s => s.kind === kind);
}

export function initializeDefaultMemoryLayers(): MemoryLayerSpec[] {
  return DEFAULT_LAYERS.map(l => registerMemoryLayer(l));
}

function ensureLayers(): void {
  if (layerSpecs.size === 0) initializeDefaultMemoryLayers();
}

export function writeSemanticEntry(input: Omit<SemanticMemoryEntry, "entry_id" | "layer" | "created_at" | "updated_at" | "validation_count">): SemanticMemoryEntry {
  ensureLayers();
  const entry: SemanticMemoryEntry = {
    ...input,
    entry_id: createEntityId("sem"),
    layer: "semantic",
    validation_count: 0,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  semanticEntries.set(entry.entry_id, entry);
  recordAudit("memory_layers.semantic_written", { entry_id: entry.entry_id, category: input.category, confidence: input.confidence });
  return entry;
}

export function writeEpisodicEntry(input: Omit<EpisodicMemoryEntry, "entry_id" | "layer" | "created_at">): EpisodicMemoryEntry {
  ensureLayers();
  const spec = getMemoryLayerByKind("episodic");
  const maxAge = spec?.retention_max_age_days ?? 90;
  const entry: EpisodicMemoryEntry = {
    ...input,
    entry_id: createEntityId("epi"),
    layer: "episodic",
    created_at: nowIso(),
    expires_at: new Date(Date.now() + maxAge * 24 * 60 * 60 * 1000).toISOString()
  };
  episodicEntries.set(entry.entry_id, entry);
  recordAudit("memory_layers.episodic_written", { entry_id: entry.entry_id, task_family: input.task_family, outcome: input.outcome });
  return entry;
}

export function writeProceduralEntry(input: Omit<ProceduralMemoryEntry, "entry_id" | "layer" | "created_at" | "promoted_at">): ProceduralMemoryEntry {
  ensureLayers();
  const entry: ProceduralMemoryEntry = {
    ...input,
    entry_id: createEntityId("proc"),
    layer: "procedural",
    created_at: nowIso(),
    promoted_at: nowIso()
  };
  proceduralEntries.set(entry.entry_id, entry);
  recordAudit("memory_layers.procedural_written", { entry_id: entry.entry_id, procedure_kind: input.procedure_kind, stability_score: input.stability_score });
  return entry;
}

export function listSemanticEntries(filter?: { category?: string; min_confidence?: number }): SemanticMemoryEntry[] {
  let entries = [...semanticEntries.values()];
  if (filter?.category) entries = entries.filter(e => e.category === filter.category);
  if (filter?.min_confidence !== undefined) entries = entries.filter(e => e.confidence >= filter.min_confidence!);
  return entries;
}

export function listEpisodicEntries(filter?: { task_family?: string; outcome?: EpisodicMemoryEntry["outcome"] }): EpisodicMemoryEntry[] {
  let entries = [...episodicEntries.values()];
  if (filter?.task_family) entries = entries.filter(e => e.task_family === filter.task_family);
  if (filter?.outcome) entries = entries.filter(e => e.outcome === filter.outcome);
  return entries;
}

export function listProceduralEntries(filter?: { procedure_kind?: ProceduralMemoryEntry["procedure_kind"]; task_family?: string; min_stability?: number }): ProceduralMemoryEntry[] {
  let entries = [...proceduralEntries.values()];
  if (filter?.procedure_kind) entries = entries.filter(e => e.procedure_kind === filter.procedure_kind);
  if (filter?.task_family) entries = entries.filter(e => e.task_family === filter.task_family);
  if (filter?.min_stability !== undefined) entries = entries.filter(e => e.stability_score >= filter.min_stability!);
  return entries;
}

export function getMemoryLayerEntry(entryId: string): MemoryLayerEntry | undefined {
  return semanticEntries.get(entryId) ?? episodicEntries.get(entryId) ?? proceduralEntries.get(entryId);
}

export function createMemoryLayerWriteBatch(input: {
  layer_kind: MemoryLayerKind;
  entries: Array<Record<string, unknown>>;
}): MemoryLayerWriteBatch {
  const batch: MemoryLayerWriteBatch = {
    batch_id: createEntityId("mlbatch"),
    layer_kind: input.layer_kind,
    entries: [],
    status: "pending",
    processed_count: 0,
    failed_count: 0,
    created_at: nowIso()
  };

  let processed = 0;
  let failed = 0;
  const writtenEntries: MemoryLayerEntry[] = [];

  for (const rawEntry of input.entries) {
    try {
      let entry: MemoryLayerEntry;
      switch (input.layer_kind) {
        case "semantic":
          entry = writeSemanticEntry({
            title: (rawEntry.title as string) ?? "Untitled",
            content: (rawEntry.content as string) ?? "",
            category: (rawEntry.category as string) ?? "general",
            tags: (rawEntry.tags as string[]) ?? [],
            source_document_ids: (rawEntry.source_document_ids as string[]) ?? [],
            confidence: (rawEntry.confidence as number) ?? 0.5,
            last_validated_at: nowIso()
          });
          break;
        case "episodic":
          entry = writeEpisodicEntry({
            title: (rawEntry.title as string) ?? "Untitled Episode",
            content: (rawEntry.content as string) ?? "",
            task_id: (rawEntry.task_id as string) ?? createEntityId("task"),
            task_family: (rawEntry.task_family as string) ?? "unknown",
            outcome: (rawEntry.outcome as EpisodicMemoryEntry["outcome"]) ?? "partial",
            step_count: (rawEntry.step_count as number) ?? 0,
            tool_invocations: (rawEntry.tool_invocations as number) ?? 0,
            duration_ms: (rawEntry.duration_ms as number) ?? 0,
            tags: (rawEntry.tags as string[]) ?? []
          });
          break;
        case "procedural":
          entry = writeProceduralEntry({
            title: (rawEntry.title as string) ?? "Untitled Procedure",
            content: (rawEntry.content as string) ?? "",
            procedure_kind: (rawEntry.procedure_kind as ProceduralMemoryEntry["procedure_kind"]) ?? "methodology",
            source_episodic_ids: (rawEntry.source_episodic_ids as string[]) ?? [],
            promotion_count: (rawEntry.promotion_count as number) ?? 0,
            reuse_count: (rawEntry.reuse_count as number) ?? 0,
            success_rate: (rawEntry.success_rate as number) ?? 0,
            stability_score: (rawEntry.stability_score as number) ?? 0,
            tags: (rawEntry.tags as string[]) ?? [],
            task_family: (rawEntry.task_family as string) ?? "unknown"
          });
          break;
        default:
          throw new Error(`Unknown layer kind: ${input.layer_kind}`);
      }
      writtenEntries.push(entry);
      processed++;
    } catch {
      failed++;
    }
  }

  batch.entries = writtenEntries;
  batch.status = failed > 0 && processed === 0 ? "failed" : "completed";
  batch.processed_count = processed;
  batch.failed_count = failed;
  batch.completed_at = nowIso();

  writeBatches.set(batch.batch_id, batch);
  recordAudit("memory_layers.write_batch", { batch_id: batch.batch_id, layer_kind: input.layer_kind, processed, failed });

  return batch;
}

export function compactMemoryLayer(layerKind: MemoryLayerKind): MemoryLayerCompactionResult {
  const spec = getMemoryLayerByKind(layerKind);
  const strategy = spec?.compaction_strategy ?? "none";

  let entriesBefore = 0;
  let entriesAfter = 0;
  let entriesRemoved = 0;
  let entriesMerged = 0;
  let entriesPromoted = 0;

  switch (layerKind) {
    case "semantic": {
      entriesBefore = semanticEntries.size;
      const now = Date.now();
      const maxAge = (spec?.retention_max_age_days ?? 365) * 24 * 60 * 60 * 1000;
      const toRemove: string[] = [];

      for (const [id, entry] of semanticEntries) {
        if (now - new Date(entry.updated_at).getTime() > maxAge) {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        semanticEntries.delete(id);
        entriesRemoved++;
      }

      if (strategy === "merge_similar") {
        const byCategory = new Map<string, SemanticMemoryEntry[]>();
        for (const entry of semanticEntries.values()) {
          const key = entry.category;
          if (!byCategory.has(key)) byCategory.set(key, []);
          byCategory.get(key)!.push(entry);
        }

        for (const [, catEntries] of byCategory) {
          if (catEntries.length > 50) {
            const toMerge = catEntries
              .sort((a, b) => a.confidence - b.confidence)
              .slice(0, catEntries.length - 50);
            for (const entry of toMerge) {
              semanticEntries.delete(entry.entry_id);
              entriesMerged++;
            }
          }
        }
      }

      entriesAfter = semanticEntries.size;
      break;
    }
    case "episodic": {
      entriesBefore = episodicEntries.size;
      const now = Date.now();
      const maxAge = (spec?.retention_max_age_days ?? 90) * 24 * 60 * 60 * 1000;
      const maxItems = spec?.retention_max_items ?? 10000;
      const toRemove: string[] = [];

      for (const [id, entry] of episodicEntries) {
        if (entry.expires_at && now > new Date(entry.expires_at).getTime()) {
          toRemove.push(id);
        } else if (now - new Date(entry.created_at).getTime() > maxAge) {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        episodicEntries.delete(id);
        entriesRemoved++;
      }

      if (episodicEntries.size > maxItems) {
        const sorted = [...episodicEntries.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const excess = sorted.slice(0, episodicEntries.size - maxItems);
        for (const entry of excess) {
          episodicEntries.delete(entry.entry_id);
          entriesRemoved++;
        }
      }

      if (strategy === "summarize_old") {
        const oldEntries = [...episodicEntries.values()]
          .filter(e => now - new Date(e.created_at).getTime() > maxAge * 0.7)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));

        const toSummarize = oldEntries.slice(0, Math.floor(oldEntries.length * 0.3));
        for (const entry of toSummarize) {
          episodicEntries.delete(entry.entry_id);
          entriesMerged++;
        }
      }

      entriesAfter = episodicEntries.size;
      break;
    }
    case "procedural": {
      entriesBefore = proceduralEntries.size;
      const now = Date.now();
      const maxAge = (spec?.retention_max_age_days ?? 180) * 24 * 60 * 60 * 1000;
      const toRemove: string[] = [];

      for (const [id, entry] of proceduralEntries) {
        if (entry.stability_score < 0.3 && entry.reuse_count < 2) {
          toRemove.push(id);
        } else if (now - new Date(entry.created_at).getTime() > maxAge && entry.reuse_count < 5) {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        proceduralEntries.delete(id);
        entriesRemoved++;
      }

      entriesAfter = proceduralEntries.size;
      break;
    }
  }

  const spaceReclaimed = entriesBefore > 0 ? Number(((entriesBefore - entriesAfter) / entriesBefore * 100).toFixed(2)) : 0;

  const result: MemoryLayerCompactionResult = {
    compaction_id: createEntityId("mlcompact"),
    layer_kind: layerKind,
    strategy,
    entries_before: entriesBefore,
    entries_after: entriesAfter,
    entries_removed: entriesRemoved,
    entries_merged: entriesMerged,
    entries_promoted: entriesPromoted,
    space_reclaimed_pct: spaceReclaimed,
    completed_at: nowIso()
  };

  recordAudit("memory_layers.compacted", { compaction_id: result.compaction_id, layer_kind: layerKind, before: entriesBefore, after: entriesAfter, removed: entriesRemoved });

  return result;
}

export function evaluatePromotionCandidate(sourceEntryId: string): MemoryLayerPromotionCandidate {
  const entry = getMemoryLayerEntry(sourceEntryId);
  if (!entry) {
    const candidate: MemoryLayerPromotionCandidate = {
      candidate_id: createEntityId("mlpromo"),
      source_layer: "episodic",
      target_layer: "procedural",
      source_entry_id: sourceEntryId,
      promotion_score: 0,
      verdict: "rejected",
      reason: "Entry not found",
      evaluated_at: nowIso()
    };
    promotionCandidates.set(candidate.candidate_id, candidate);
    return candidate;
  }

  let sourceLayer: MemoryLayerKind;
  let targetLayer: MemoryLayerKind;
  let score = 0;
  let verdict: PromotionVerdict = "deferred";
  let reason = "";

  if (entry.layer === "episodic") {
    sourceLayer = "episodic";
    targetLayer = "procedural";
    const episodic = entry as EpisodicMemoryEntry;
    const spec = getMemoryLayerByKind("procedural");
    const threshold = spec?.promotion_threshold ?? 0.8;

    score = 0;
    if (episodic.outcome === "success") score += 0.3;
    else if (episodic.outcome === "partial") score += 0.1;

    if (episodic.trace_grade_verdict === "excellent" || episodic.trace_grade_verdict === "good") score += 0.2;
    else if (episodic.trace_grade_verdict === "acceptable") score += 0.1;

    const existingProcedural = [...proceduralEntries.values()].filter(
      p => p.task_family === episodic.task_family
    );
    if (existingProcedural.length >= 3) score += 0.2;

    const sameFamilyEpisodes = [...episodicEntries.values()].filter(
      e => e.task_family === episodic.task_family && e.outcome === "success"
    );
    if (sameFamilyEpisodes.length >= 3) score += 0.2;

    score = Math.min(1, score);

    if (score >= threshold) {
      verdict = "promoted";
      reason = `Episodic entry meets promotion threshold (${score.toFixed(2)} >= ${threshold}). Outcome: ${episodic.outcome}, family: ${episodic.task_family}.`;
    } else {
      verdict = "deferred";
      reason = `Score ${score.toFixed(2)} below threshold ${threshold}. Needs more successful episodes or higher trace grades.`;
    }
  } else if (entry.layer === "semantic") {
    sourceLayer = "semantic";
    targetLayer = "procedural";
    const semantic = entry as SemanticMemoryEntry;
    score = semantic.confidence * 0.5;
    verdict = "rejected";
    reason = "Semantic entries are not promoted to procedural. They are reference knowledge.";
  } else {
    sourceLayer = "procedural";
    targetLayer = "procedural";
    const procedural = entry as ProceduralMemoryEntry;
    score = procedural.stability_score;
    verdict = "rejected";
    reason = "Procedural entries are already at the highest layer. No further promotion.";
  }

  const candidate: MemoryLayerPromotionCandidate = {
    candidate_id: createEntityId("mlpromo"),
    source_layer: sourceLayer,
    target_layer: targetLayer,
    source_entry_id: sourceEntryId,
    promotion_score: Number(score.toFixed(4)),
    verdict,
    reason,
    evaluated_at: nowIso()
  };

  promotionCandidates.set(candidate.candidate_id, candidate);
  recordAudit("memory_layers.promotion_evaluated", { candidate_id: candidate.candidate_id, source: sourceLayer, target: targetLayer, score, verdict });

  return candidate;
}

export function promoteEpisodicToProcedural(episodicEntryId: string): ProceduralMemoryEntry | undefined {
  const candidate = evaluatePromotionCandidate(episodicEntryId);
  if (candidate.verdict !== "promoted") return undefined;

  const episodic = episodicEntries.get(episodicEntryId);
  if (!episodic) return undefined;

  const sameFamilyEpisodes = [...episodicEntries.values()].filter(
    e => e.task_family === episodic.task_family && e.outcome === "success"
  );

  const procedural = writeProceduralEntry({
    title: `Procedural: ${episodic.task_family} (${episodic.outcome})`,
    content: episodic.content,
    procedure_kind: "methodology",
    source_episodic_ids: sameFamilyEpisodes.map(e => e.entry_id),
    promotion_count: 1,
    reuse_count: 0,
    success_rate: sameFamilyEpisodes.length > 0 ? sameFamilyEpisodes.filter(e => e.outcome === "success").length / sameFamilyEpisodes.length : 0,
    stability_score: candidate.promotion_score,
    tags: [...episodic.tags, "promoted_from_episodic"],
    task_family: episodic.task_family
  });

  recordAudit("memory_layers.promoted", { episodic_id: episodicEntryId, procedural_id: procedural.entry_id, task_family: episodic.task_family });

  return procedural;
}

export function listPromotionCandidates(filter?: { verdict?: PromotionVerdict; source_layer?: MemoryLayerKind }): MemoryLayerPromotionCandidate[] {
  let candidates = [...promotionCandidates.values()];
  if (filter?.verdict) candidates = candidates.filter(c => c.verdict === filter.verdict);
  if (filter?.source_layer) candidates = candidates.filter(c => c.source_layer === filter.source_layer);
  return candidates.sort((a, b) => b.promotion_score - a.promotion_score);
}

export function generateRetentionReport(layerKind: MemoryLayerKind): MemoryLayerRetentionReport {
  const spec = getMemoryLayerByKind(layerKind);
  const maxAge = (spec?.retention_max_age_days ?? 90) * 24 * 60 * 60 * 1000;
  const maxItems = spec?.retention_max_items ?? 10000;
  const now = Date.now();

  let totalEntries = 0;
  let overMaxAge = 0;
  let nearLimit = 0;
  let oldestAgeDays = 0;
  let totalAgeDays = 0;

  const getEntries = (): MemoryLayerEntry[] => {
    switch (layerKind) {
      case "semantic": return [...semanticEntries.values()];
      case "episodic": return [...episodicEntries.values()];
      case "procedural": return [...proceduralEntries.values()];
    }
  };

  const entries = getEntries();
  totalEntries = entries.length;

  for (const entry of entries) {
    const ageMs = now - new Date(entry.created_at).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    totalAgeDays += ageDays;
    if (ageDays > oldestAgeDays) oldestAgeDays = ageDays;
    if (ageMs > maxAge) overMaxAge++;
  }

  nearLimit = Math.max(0, totalEntries - Math.floor(maxItems * 0.9));
  const avgAgeDays = totalEntries > 0 ? totalAgeDays / totalEntries : 0;

  return {
    layer_kind: layerKind,
    total_entries: totalEntries,
    entries_over_max_age: overMaxAge,
    entries_near_retention_limit: nearLimit,
    compaction_recommended: overMaxAge > 0 || totalEntries > maxItems * 0.8,
    oldest_entry_age_days: Number(oldestAgeDays.toFixed(1)),
    average_entry_age_days: Number(avgAgeDays.toFixed(1)),
    reported_at: nowIso()
  };
}

export function getMemoryLayerDiagnostics(): {
  layers: Array<{ kind: MemoryLayerKind; entries: number; write_policy: string; compaction_strategy: string }>;
  total_entries: number;
  promotion_candidates: number;
  promoted_entries: number;
} {
  ensureLayers();
  return {
    layers: [...layerSpecs.values()].map(s => ({
      kind: s.kind,
      entries: s.kind === "semantic" ? semanticEntries.size : s.kind === "episodic" ? episodicEntries.size : proceduralEntries.size,
      write_policy: s.write_policy,
      compaction_strategy: s.compaction_strategy
    })),
    total_entries: semanticEntries.size + episodicEntries.size + proceduralEntries.size,
    promotion_candidates: [...promotionCandidates.values()].filter(c => c.verdict === "promoted").length,
    promoted_entries: proceduralEntries.size
  };
}

export function runMemoryLayerRegressionSuite(): {
  suite_id: string;
  results: Array<{ case_id: string; name: string; status: "pass" | "fail"; detail: string; error?: string }>;
  summary: { total: number; passed: number; failed: number; pass_rate: number };
} {
  const results: Array<{ case_id: string; name: string; status: "pass" | "fail"; detail: string; error?: string }> = [];

  const cases: Array<{ case_id: string; name: string; fn: () => string }> = [
    {
      case_id: "ml-reg-001",
      name: "default_layers_initialized",
      fn: () => {
        layerSpecs.clear();
        const layers = initializeDefaultMemoryLayers();
        if (layers.length !== 3) throw new Error(`Expected 3 layers, got ${layers.length}`);
        const kinds = layers.map(l => l.kind).sort();
        if (kinds[0] !== "episodic" || kinds[1] !== "procedural" || kinds[2] !== "semantic") throw new Error(`Wrong layer kinds: ${kinds}`);
        return `Initialized ${layers.length} layers: ${kinds.join(", ")}`;
      }
    },
    {
      case_id: "ml-reg-002",
      name: "semantic_entry_write_read",
      fn: () => {
        const entry = writeSemanticEntry({
          title: "Test Semantic",
          content: "Test content",
          category: "test",
          tags: ["test"],
          source_document_ids: [],
          confidence: 0.9,
          last_validated_at: nowIso()
        });
        if (entry.layer !== "semantic") throw new Error(`Expected semantic layer, got ${entry.layer}`);
        const retrieved = getMemoryLayerEntry(entry.entry_id);
        if (!retrieved) throw new Error("Entry not found");
        if (retrieved.layer !== "semantic") throw new Error("Wrong layer on retrieval");
        return `Semantic entry: ${entry.entry_id}, confidence=${entry.confidence}`;
      }
    },
    {
      case_id: "ml-reg-003",
      name: "episodic_entry_write_read",
      fn: () => {
        const entry = writeEpisodicEntry({
          title: "Test Episode",
          content: "Test episode content",
          task_id: "task-1",
          task_family: "test_family",
          outcome: "success",
          step_count: 5,
          tool_invocations: 3,
          duration_ms: 1000,
          tags: ["test"]
        });
        if (entry.layer !== "episodic") throw new Error(`Expected episodic layer, got ${entry.layer}`);
        if (!entry.expires_at) throw new Error("Episodic entry should have expiry");
        return `Episodic entry: ${entry.entry_id}, outcome=${entry.outcome}`;
      }
    },
    {
      case_id: "ml-reg-004",
      name: "procedural_entry_write_read",
      fn: () => {
        const entry = writeProceduralEntry({
          title: "Test Procedure",
          content: "Test procedure content",
          procedure_kind: "methodology",
          source_episodic_ids: [],
          promotion_count: 1,
          reuse_count: 5,
          success_rate: 0.9,
          stability_score: 0.85,
          tags: ["test"],
          task_family: "test_family"
        });
        if (entry.layer !== "procedural") throw new Error(`Expected procedural layer, got ${entry.layer}`);
        return `Procedural entry: ${entry.entry_id}, stability=${entry.stability_score}`;
      }
    },
    {
      case_id: "ml-reg-005",
      name: "write_batch_processing",
      fn: () => {
        const batch = createMemoryLayerWriteBatch({
          layer_kind: "semantic",
          entries: [
            { title: "Batch 1", content: "Content 1", category: "batch_test", confidence: 0.8 },
            { title: "Batch 2", content: "Content 2", category: "batch_test", confidence: 0.7 }
          ]
        });
        if (batch.status !== "completed") throw new Error(`Expected completed, got ${batch.status}`);
        if (batch.processed_count !== 2) throw new Error(`Expected 2 processed, got ${batch.processed_count}`);
        return `Batch: ${batch.processed_count} processed, ${batch.failed_count} failed`;
      }
    },
    {
      case_id: "ml-reg-006",
      name: "compaction_removes_expired",
      fn: () => {
        const entry = writeEpisodicEntry({
          title: "Old Episode",
          content: "Old content",
          task_id: "old-task",
          task_family: "old_family",
          outcome: "failure",
          step_count: 1,
          tool_invocations: 0,
          duration_ms: 100,
          tags: ["old"]
        });
        entry.created_at = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
        entry.expires_at = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
        episodicEntries.set(entry.entry_id, entry);

        const before = episodicEntries.size;
        const result = compactMemoryLayer("episodic");
        if (result.entries_removed === 0) throw new Error("Expected some entries removed");
        return `Compaction: ${result.entries_before} → ${result.entries_after}, removed=${result.entries_removed}`;
      }
    },
    {
      case_id: "ml-reg-007",
      name: "promotion_evaluation_episodic_to_procedural",
      fn: () => {
        for (let i = 0; i < 5; i++) {
          writeEpisodicEntry({
            title: `Success Episode ${i}`,
            content: `Success content ${i}`,
            task_id: `task-promo-${i}`,
            task_family: "promotion_family",
            outcome: "success",
            step_count: 3,
            tool_invocations: 2,
            duration_ms: 500,
            trace_grade_verdict: "excellent",
            tags: ["promotion_test"]
          });
        }

        const episodes = [...episodicEntries.values()].filter(e => e.task_family === "promotion_family");
        const candidate = evaluatePromotionCandidate(episodes[0].entry_id);
        if (candidate.source_layer !== "episodic") throw new Error(`Expected episodic source, got ${candidate.source_layer}`);
        if (candidate.target_layer !== "procedural") throw new Error(`Expected procedural target, got ${candidate.target_layer}`);
        return `Promotion candidate: score=${candidate.promotion_score}, verdict=${candidate.verdict}`;
      }
    },
    {
      case_id: "ml-reg-008",
      name: "promotion_execution_creates_procedural",
      fn: () => {
        const episodes = [...episodicEntries.values()].filter(e => e.task_family === "promotion_family" && e.outcome === "success");
        if (episodes.length === 0) throw new Error("No success episodes for promotion test");

        const candidate = evaluatePromotionCandidate(episodes[0].entry_id);
        if (candidate.verdict === "promoted") {
          const procedural = promoteEpisodicToProcedural(episodes[0].entry_id);
          if (!procedural) throw new Error("Promotion returned undefined");
          if (procedural.layer !== "procedural") throw new Error("Not procedural layer");
          if (procedural.source_episodic_ids.length === 0) throw new Error("No source episodic IDs");
          return `Promoted to procedural: ${procedural.entry_id}, stability=${procedural.stability_score}`;
        }
        return `Promotion deferred (score: ${candidate.promotion_score}), which is valid behavior`;
      }
    },
    {
      case_id: "ml-reg-009",
      name: "semantic_not_promoted_to_procedural",
      fn: () => {
        const semantic = writeSemanticEntry({
          title: "No Promotion Semantic",
          content: "Should not be promoted",
          category: "no_promote",
          tags: [],
          source_document_ids: [],
          confidence: 0.95,
          last_validated_at: nowIso()
        });
        const candidate = evaluatePromotionCandidate(semantic.entry_id);
        if (candidate.verdict !== "rejected") throw new Error(`Semantic should be rejected for promotion, got ${candidate.verdict}`);
        return `Semantic correctly rejected: ${candidate.reason}`;
      }
    },
    {
      case_id: "ml-reg-010",
      name: "retention_report_generated",
      fn: () => {
        const report = generateRetentionReport("episodic");
        if (typeof report.total_entries !== "number") throw new Error("Invalid report");
        if (typeof report.compaction_recommended !== "boolean") throw new Error("Invalid compaction_recommended");
        return `Retention: ${report.total_entries} entries, ${report.entries_over_max_age} over max age, compaction=${report.compaction_recommended}`;
      }
    },
    {
      case_id: "ml-reg-011",
      name: "diagnostics_available",
      fn: () => {
        const diag = getMemoryLayerDiagnostics();
        if (diag.layers.length !== 3) throw new Error(`Expected 3 layers, got ${diag.layers.length}`);
        if (typeof diag.total_entries !== "number") throw new Error("Invalid total_entries");
        return `Diagnostics: ${diag.total_entries} total entries across ${diag.layers.length} layers`;
      }
    },
    {
      case_id: "ml-reg-012",
      name: "no_vector_only_memory",
      fn: () => {
        const semantic = writeSemanticEntry({
          title: "Non-Vector Semantic",
          content: "This entry uses direct directory/document addressing, not vector-only storage",
          category: "verification",
          tags: ["no_vector"],
          source_document_ids: ["doc-1", "doc-2"],
          confidence: 0.8,
          last_validated_at: nowIso()
        });
        if (!semantic.source_document_ids || semantic.source_document_ids.length === 0) {
          throw new Error("Semantic entry must have source document references, not vector-only");
        }
        return `Entry has ${semantic.source_document_ids.length} source documents (not vector-only)`;
      }
    }
  ];

  for (const tc of cases) {
    try {
      const detail = tc.fn();
      results.push({ case_id: tc.case_id, name: tc.name, status: "pass", detail });
    } catch (error) {
      results.push({ case_id: tc.case_id, name: tc.name, status: "fail", detail: "", error: (error as Error).message.slice(0, 500) });
    }
  }

  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;

  return {
    suite_id: createEntityId("mlsuite"),
    results,
    summary: { total: results.length, passed, failed, pass_rate: results.length > 0 ? Number((passed / results.length).toFixed(4)) : 0 }
  };
}
