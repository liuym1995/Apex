import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export interface CacheEntry {
  entry_id: string;
  cache_tier: "exact_request" | "semantic_suggestion" | "harness_result" | "plan_skeleton";
  query_hash: string;
  query_text: string;
  result: Record<string, unknown>;
  model_family?: string;
  tool_family?: string;
  policy_version?: string;
  repo_fingerprint?: string;
  hit_count: number;
  last_hit_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface CacheLookupResult {
  hit: boolean;
  entry?: CacheEntry;
  tier: CacheEntry["cache_tier"];
}

const cacheStore = new Map<string, CacheEntry>();

function computeQueryHash(query: string, tier: CacheEntry["cache_tier"]): string {
  const normalized = query.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${tier}_${Math.abs(hash).toString(36)}`;
}

export function putCacheEntry(input: {
  cache_tier: CacheEntry["cache_tier"];
  query_text: string;
  result: Record<string, unknown>;
  model_family?: string;
  tool_family?: string;
  policy_version?: string;
  repo_fingerprint?: string;
  expires_at?: string;
}): CacheEntry {
  const queryHash = computeQueryHash(input.query_text, input.cache_tier);
  const existing = cacheStore.get(queryHash);
  if (existing) {
    existing.result = input.result;
    existing.model_family = input.model_family;
    existing.tool_family = input.tool_family;
    existing.policy_version = input.policy_version;
    existing.repo_fingerprint = input.repo_fingerprint;
    existing.expires_at = input.expires_at;
    cacheStore.set(queryHash, existing);
    return existing;
  }

  const entry: CacheEntry = {
    entry_id: createEntityId("cache"),
    cache_tier: input.cache_tier,
    query_hash: queryHash,
    query_text: input.query_text,
    result: input.result,
    model_family: input.model_family,
    tool_family: input.tool_family,
    policy_version: input.policy_version,
    repo_fingerprint: input.repo_fingerprint,
    hit_count: 0,
    last_hit_at: undefined,
    expires_at: input.expires_at,
    created_at: nowIso()
  };

  cacheStore.set(queryHash, entry);
  recordAudit("semantic_cache.put", { entry_id: entry.entry_id, cache_tier: input.cache_tier });
  return entry;
}

export function lookupCache(input: {
  query_text: string;
  cache_tier: CacheEntry["cache_tier"];
  model_family?: string;
  tool_family?: string;
  policy_version?: string;
  repo_fingerprint?: string;
}): CacheLookupResult {
  const queryHash = computeQueryHash(input.query_text, input.cache_tier);
  const entry = cacheStore.get(queryHash);

  if (!entry) {
    return { hit: false, tier: input.cache_tier };
  }

  if (entry.expires_at && Date.parse(entry.expires_at) < Date.now()) {
    cacheStore.delete(queryHash);
    return { hit: false, tier: input.cache_tier };
  }

  if (input.model_family && entry.model_family && entry.model_family !== input.model_family) {
    return { hit: false, tier: input.cache_tier };
  }
  if (input.policy_version && entry.policy_version && entry.policy_version !== input.policy_version) {
    return { hit: false, tier: input.cache_tier };
  }
  if (input.repo_fingerprint && entry.repo_fingerprint && entry.repo_fingerprint !== input.repo_fingerprint) {
    return { hit: false, tier: input.cache_tier };
  }

  entry.hit_count += 1;
  entry.last_hit_at = nowIso();
  cacheStore.set(queryHash, entry);

  recordAudit("semantic_cache.hit", { entry_id: entry.entry_id, cache_tier: input.cache_tier, hit_count: entry.hit_count });
  return { hit: true, entry, tier: input.cache_tier };
}

export function invalidateCache(queryText: string, cacheTier: CacheEntry["cache_tier"]): boolean {
  const queryHash = computeQueryHash(queryText, cacheTier);
  const deleted = cacheStore.delete(queryHash);
  if (deleted) {
    recordAudit("semantic_cache.invalidate", { query_hash: queryHash, cache_tier: cacheTier });
  }
  return deleted;
}

export function clearCache(tier?: CacheEntry["cache_tier"]): number {
  if (tier) {
    let count = 0;
    for (const [key, entry] of cacheStore.entries()) {
      if (entry.cache_tier === tier) {
        cacheStore.delete(key);
        count++;
      }
    }
    recordAudit("semantic_cache.clear", { tier, count });
    return count;
  }
  const count = cacheStore.size;
  cacheStore.clear();
  recordAudit("semantic_cache.clear", { tier: "all", count });
  return count;
}

export function getCacheStats(): {
  total_entries: number;
  by_tier: Record<string, number>;
  total_hits: number;
  expired_entries: number;
} {
  const byTier: Record<string, number> = {};
  let totalHits = 0;
  let expiredEntries = 0;
  const now = Date.now();

  for (const entry of cacheStore.values()) {
    byTier[entry.cache_tier] = (byTier[entry.cache_tier] ?? 0) + 1;
    totalHits += entry.hit_count;
    if (entry.expires_at && Date.parse(entry.expires_at) < now) {
      expiredEntries++;
    }
  }

  return {
    total_entries: cacheStore.size,
    by_tier: byTier,
    total_hits: totalHits,
    expired_entries: expiredEntries
  };
}
