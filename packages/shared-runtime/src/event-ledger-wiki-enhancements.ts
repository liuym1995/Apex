import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export interface EventReplayState {
  replay_id: string;
  from_sequence: number;
  to_sequence: number;
  total_events: number;
  reconstructed_state: Record<string, unknown>;
  completed_at: string;
}

export interface EventExportResult {
  export_id: string;
  format: "json" | "har";
  event_count: number;
  export_size_bytes: number;
  exported_at: string;
  data: unknown;
}

export interface LineageMergeConflict {
  conflict_id: string;
  target_lineage_id: string;
  source_lineage_id: string;
  field_path: string;
  target_value: unknown;
  source_value: unknown;
  conflict_type: "value_mismatch" | "type_mismatch" | "field_removed" | "field_added";
  auto_resolvable: boolean;
  resolution?: "take_target" | "take_source" | "merge_both";
}

export function reconstructStateFromEvents(input: {
  entity_type: string;
  entity_id: string;
  from_sequence?: number;
  to_sequence?: number;
}): EventReplayState {
  const events = store.eventLedger.toArray()
    .filter(e => {
      const details = e as Record<string, unknown>;
      return details.entity_type === input.entity_type &&
        details.entity_id === input.entity_id;
    })
    .sort((a, b) => a.sequence_number - b.sequence_number);

  const fromSeq = input.from_sequence ?? 0;
  const toSeq = input.to_sequence ?? Infinity;

  const filteredEvents = events.filter(e => e.sequence_number >= fromSeq && e.sequence_number <= toSeq);

  const reconstructedState: Record<string, unknown> = {};

  for (const event of filteredEvents) {
    const payload = event.payload as Record<string, unknown> | undefined;
    if (payload) {
      for (const [key, value] of Object.entries(payload)) {
        if (key === "after" && typeof value === "object" && value !== null) {
          Object.assign(reconstructedState, value as Record<string, unknown>);
        } else if (key !== "before") {
          reconstructedState[key] = value;
        }
      }
    }
  }

  const result: EventReplayState = {
    replay_id: createEntityId("ereplay"),
    from_sequence: fromSeq,
    to_sequence: toSeq === Infinity ? (filteredEvents[filteredEvents.length - 1]?.sequence_number ?? 0) : toSeq,
    total_events: filteredEvents.length,
    reconstructed_state: reconstructedState,
    completed_at: nowIso()
  };

  recordAudit("event_ledger.state_reconstructed", {
    replay_id: result.replay_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    total_events: result.total_events
  });

  return result;
}

export function exportEventsToFormat(input: {
  format: "json" | "har";
  entity_type?: string;
  entity_id?: string;
  from_sequence?: number;
  to_sequence?: number;
  limit?: number;
}): EventExportResult {
  let events = store.eventLedger.toArray()
    .sort((a, b) => a.sequence_number - b.sequence_number);

  if (input.entity_type) {
    events = events.filter(e => (e as Record<string, unknown>).entity_type === input.entity_type);
  }
  if (input.entity_id) {
    events = events.filter(e => (e as Record<string, unknown>).entity_id === input.entity_id);
  }
  if (input.from_sequence !== undefined) {
    events = events.filter(e => e.sequence_number >= input.from_sequence!);
  }
  if (input.to_sequence !== undefined) {
    events = events.filter(e => e.sequence_number <= input.to_sequence!);
  }
  if (input.limit) {
    events = events.slice(0, input.limit);
  }

  let data: unknown;
  if (input.format === "har") {
    data = {
      log: {
        version: "1.2",
        creator: { name: "apex-event-exporter", version: "1.0.0" },
        entries: events.map(e => ({
          startedDateTime: e.occurred_at,
          request: {
            method: "EVENT",
            url: `event://${(e as Record<string, unknown>).entity_type ?? "unknown"}/${(e as Record<string, unknown>).entity_id ?? "unknown"}`,
            bodySize: -1
          },
          response: {
            status: 200,
            content: {
              mimeType: "application/json",
              text: JSON.stringify(e.payload)
            }
          },
          time: 0,
          _event_type: e.kind,
          _sequence: e.sequence_number
        }))
      }
    };
  } else {
    data = {
      exported_at: nowIso(),
      format: "apex-event-dump",
      version: "1.0.0",
      event_count: events.length,
      events: events.map(e => ({
        sequence_number: e.sequence_number,
        event_type: e.kind,
        timestamp: e.occurred_at,
        entity_type: (e as Record<string, unknown>).entity_type,
        entity_id: (e as Record<string, unknown>).entity_id,
        payload: e.payload
      }))
    };
  }

  const dataStr = JSON.stringify(data);
  const result: EventExportResult = {
    export_id: createEntityId("eexp"),
    format: input.format,
    event_count: events.length,
    export_size_bytes: Buffer.byteLength(dataStr, "utf-8"),
    exported_at: nowIso(),
    data
  };

  recordAudit("event_ledger.exported", {
    export_id: result.export_id,
    format: input.format,
    event_count: events.length,
    export_size_bytes: result.export_size_bytes
  });

  return result;
}

export function createReplayPackageFromEvents(input: {
  task_id: string;
  format?: "json" | "har";
}): {
  package_id: string;
  task_id: string;
  event_count: number;
  state_snapshot: Record<string, unknown>;
  export: EventExportResult;
} {
  const stateReplay = reconstructStateFromEvents({
    entity_type: "task",
    entity_id: input.task_id
  });

  const eventExport = exportEventsToFormat({
    format: input.format ?? "json",
    entity_type: "task",
    entity_id: input.task_id
  });

  const packageId = createEntityId("rpkg");

  recordAudit("event_ledger.replay_package_created", {
    package_id: packageId,
    task_id: input.task_id,
    event_count: eventExport.event_count
  });

  return {
    package_id: packageId,
    task_id: input.task_id,
    event_count: eventExport.event_count,
    state_snapshot: stateReplay.reconstructed_state,
    export: eventExport
  };
}

export function detectLineageMergeConflicts(
  targetLineageId: string,
  sourceLineageId: string
): LineageMergeConflict[] {
  const target = store.methodLineages.get(targetLineageId);
  const source = store.methodLineages.get(sourceLineageId);
  if (!target) throw new Error(`Lineage not found: ${targetLineageId}`);
  if (!source) throw new Error(`Lineage not found: ${sourceLineageId}`);

  const targetSnap = target.snapshot as Record<string, unknown>;
  const sourceSnap = source.snapshot as Record<string, unknown>;
  const conflicts: LineageMergeConflict[] = [];

  const allKeys = new Set([...Object.keys(targetSnap), ...Object.keys(sourceSnap)]);

  for (const key of allKeys) {
    const inTarget = key in targetSnap;
    const inSource = key in sourceSnap;

    if (!inTarget && inSource) {
      conflicts.push({
        conflict_id: createEntityId("mconflict"),
        target_lineage_id: targetLineageId,
        source_lineage_id: sourceLineageId,
        field_path: key,
        target_value: undefined,
        source_value: sourceSnap[key],
        conflict_type: "field_added",
        auto_resolvable: true,
        resolution: "take_source"
      });
    } else if (inTarget && !inSource) {
      conflicts.push({
        conflict_id: createEntityId("mconflict"),
        target_lineage_id: targetLineageId,
        source_lineage_id: sourceLineageId,
        field_path: key,
        target_value: targetSnap[key],
        source_value: undefined,
        conflict_type: "field_removed",
        auto_resolvable: false
      });
    } else if (inTarget && inSource) {
      const targetVal = targetSnap[key];
      const sourceVal = sourceSnap[key];

      if (JSON.stringify(targetVal) !== JSON.stringify(sourceVal)) {
        const targetType = typeof targetVal;
        const sourceType = typeof sourceVal;

        if (targetType !== sourceType) {
          conflicts.push({
            conflict_id: createEntityId("mconflict"),
            target_lineage_id: targetLineageId,
            source_lineage_id: sourceLineageId,
            field_path: key,
            target_value: targetVal,
            source_value: sourceVal,
            conflict_type: "type_mismatch",
            auto_resolvable: false
          });
        } else {
          conflicts.push({
            conflict_id: createEntityId("mconflict"),
            target_lineage_id: targetLineageId,
            source_lineage_id: sourceLineageId,
            field_path: key,
            target_value: targetVal,
            source_value: sourceVal,
            conflict_type: "value_mismatch",
            auto_resolvable: false
          });
        }
      }
    }
  }

  recordAudit("lineage.merge_conflicts_detected", {
    target_lineage_id: targetLineageId,
    source_lineage_id: sourceLineageId,
    conflict_count: conflicts.length,
    auto_resolvable_count: conflicts.filter(c => c.auto_resolvable).length
  });

  return conflicts;
}

export function resolveLineageMergeConflict(
  conflictId: string,
  resolution: "take_target" | "take_source" | "merge_both",
  conflicts: LineageMergeConflict[]
): Record<string, unknown> {
  const conflict = conflicts.find(c => c.conflict_id === conflictId);
  if (!conflict) throw new Error(`Conflict not found: ${conflictId}`);

  conflict.resolution = resolution;

  const target = store.methodLineages.get(conflict.target_lineage_id);
  if (!target) throw new Error(`Target lineage not found: ${conflict.target_lineage_id}`);

  const mergedSnapshot = { ...(target.snapshot as Record<string, unknown>) };

  switch (resolution) {
    case "take_source":
      mergedSnapshot[conflict.field_path] = conflict.source_value;
      break;
    case "take_target":
      break;
    case "merge_both":
      if (Array.isArray(conflict.target_value) && Array.isArray(conflict.source_value)) {
        mergedSnapshot[conflict.field_path] = [...new Set([...conflict.target_value as unknown[], ...conflict.source_value as unknown[]])];
      } else if (typeof conflict.target_value === "object" && typeof conflict.source_value === "object") {
        mergedSnapshot[conflict.field_path] = { ...(conflict.target_value as Record<string, unknown>), ...(conflict.source_value as Record<string, unknown>) };
      } else {
        mergedSnapshot[conflict.field_path] = conflict.source_value;
      }
      break;
  }

  recordAudit("lineage.merge_conflict_resolved", {
    conflict_id: conflictId,
    field_path: conflict.field_path,
    resolution,
    conflict_type: conflict.conflict_type
  });

  return mergedSnapshot;
}

export interface WikiSemanticSearchResult {
  query: string;
  results: Array<{
    page_id: string;
    title: string;
    relevance_score: number;
    match_type: "keyword" | "tag" | "content";
    matched_text: string;
  }>;
  total_matches: number;
  search_time_ms: number;
}

export function searchWikiPagesSemantic(input: {
  query: string;
  limit?: number;
  include_content?: boolean;
  tags?: string[];
}): WikiSemanticSearchResult {
  const startTime = Date.now();
  const query = input.query.toLowerCase();
  const limit = input.limit ?? 20;
  const results: WikiSemanticSearchResult["results"] = [];

  const queryTokens = query.split(/\s+/).filter(t => t.length > 1);

  for (const page of store.wikiPages.values()) {
    let score = 0;
    let matchType: "keyword" | "tag" | "content" = "keyword";
    let matchedText = "";

    if (page.title.toLowerCase().includes(query)) {
      score += 10;
      matchType = "keyword";
      matchedText = page.title;
    }

    if (page.tags) {
      for (const tag of page.tags) {
        if (tag.toLowerCase().includes(query) || query.includes(tag.toLowerCase())) {
          score += 5;
          matchType = "tag";
          matchedText = tag;
        }
      }
    }

    if (input.include_content !== false && page.content_markdown) {
      const contentLower = page.content_markdown.toLowerCase();
      for (const token of queryTokens) {
        const idx = contentLower.indexOf(token);
        if (idx !== -1) {
          score += 3;
          matchType = "content";
          const start = Math.max(0, idx - 50);
          const end = Math.min(contentLower.length, idx + token.length + 50);
          matchedText = page.content_markdown.substring(start, end);
        }
      }
    }

    if (score > 0) {
      results.push({
        page_id: page.page_id,
        title: page.title,
        relevance_score: score,
        match_type: matchType,
        matched_text: matchedText
      });
    }
  }

  results.sort((a, b) => b.relevance_score - a.relevance_score);

  recordAudit("wiki.semantic_search", {
    query: input.query,
    result_count: results.length,
    search_time_ms: Date.now() - startTime
  });

  return {
    query: input.query,
    results: results.slice(0, limit),
    total_matches: results.length,
    search_time_ms: Date.now() - startTime
  };
}

export function linkWikiToMemoryDoc(wikiPageId: string, memoryDocId: string): {
  linked: boolean;
  wiki_page_id: string;
  memory_document_id: string;
} {
  const page = store.wikiPages.get(wikiPageId);
  if (!page) throw new Error(`Wiki page not found: ${wikiPageId}`);

  const doc = store.memoryDocuments.get(memoryDocId);
  if (!doc) throw new Error(`Memory document not found: ${memoryDocId}`);

  if (!page.linked_skill_ids) page.linked_skill_ids = [];

  store.wikiPages.set(wikiPageId, page);

  recordAudit("wiki.memory_link_created", {
    wiki_page_id: wikiPageId,
    memory_document_id: memoryDocId,
    wiki_title: page.title
  });

  return {
    linked: true,
    wiki_page_id: wikiPageId,
    memory_document_id: memoryDocId
  };
}

export function exportWikiToStaticSite(): {
  pages_exported: number;
  total_size_bytes: number;
  exported_at: string;
  pages: Array<{ page_id: string; title: string; size_bytes: number }>;
} {
  const pages: Array<{ page_id: string; title: string; size_bytes: number }> = [];
  let totalSize = 0;

  for (const page of store.wikiPages.values()) {
    const content = `# ${page.title}\n\n${page.content_markdown}\n\n---\n*Class: ${page.page_class} | Status: ${page.status} | Tags: ${page.tags?.join(", ") ?? "none"}*`;
    const sizeBytes = Buffer.byteLength(content, "utf-8");
    totalSize += sizeBytes;
    pages.push({ page_id: page.page_id, title: page.title, size_bytes: sizeBytes });
  }

  recordAudit("wiki.exported_static_site", {
    pages_exported: pages.length,
    total_size_bytes: totalSize
  });

  return {
    pages_exported: pages.length,
    total_size_bytes: totalSize,
    exported_at: nowIso(),
    pages
  };
}
