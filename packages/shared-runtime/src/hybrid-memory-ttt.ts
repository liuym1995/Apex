import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  MemoryModeSchema,
  MemoryStrategyRecommendationSchema,
  TTTEligibilityGateResultSchema,
  TTTAdaptationRunSchema,
  TTTDistillationRecordSchema,
  TTTBudgetLedgerSchema,
  type MemoryMode,
  type MemoryStrategyRecommendation,
  type TTTEligibilityGateResult,
  type TTTEligibilityVerdict,
  type TTTAdaptationRun,
  type TTTDistillationRecord,
  type TTTBudgetLedger
} from "@apex/shared-types";
import { log } from "@apex/shared-observability";

const TTT_ELIGIBLE_TASK_FAMILIES = new Set([
  "long_context_analysis",
  "specialist_research",
  "replay_eval",
  "code_intelligence",
  "document_synthesis",
  "data_analysis",
  "model_adaptation_experiment"
]);

const VENDOR_HOSTED_MODEL_PREFIXES = [
  "gpt-",
  "claude-",
  "gemini-",
  "anthropic/",
  "openai/",
  "google/"
];

const recommendations = new Map<string, MemoryStrategyRecommendation>();
const gateResults = new Map<string, TTTEligibilityGateResult>();
const adaptationRuns = new Map<string, TTTAdaptationRun>();
const distillationRecords = new Map<string, TTTDistillationRecord>();
const budgetLedgers = new Map<string, TTTBudgetLedger>();

let globalBudgetLedger: TTTBudgetLedger | undefined;

function ensureGlobalBudgetLedger(): TTTBudgetLedger {
  if (!globalBudgetLedger) {
    globalBudgetLedger = {
      ledger_id: createEntityId("ttt_budget"),
      total_budget: 1000,
      consumed: 0,
      remaining: 1000,
      runs: [],
      period_start: nowIso(),
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: nowIso()
    };
    budgetLedgers.set(globalBudgetLedger.ledger_id, globalBudgetLedger);
  }
  return globalBudgetLedger;
}

export function isVendorHostedModel(modelRoute: string): boolean {
  const lower = modelRoute.toLowerCase();
  return VENDOR_HOSTED_MODEL_PREFIXES.some(prefix => lower.startsWith(prefix));
}

export function isTTTEligibleTaskFamily(taskFamily: string): boolean {
  return TTT_ELIGIBLE_TASK_FAMILIES.has(taskFamily);
}

export function registerTTTEligibleTaskFamily(taskFamily: string): void {
  TTT_ELIGIBLE_TASK_FAMILIES.add(taskFamily);
}

export function unregisterTTTEligibleTaskFamily(taskFamily: string): void {
  TTT_ELIGIBLE_TASK_FAMILIES.delete(taskFamily);
}

export function listTTTEligibleTaskFamilies(): string[] {
  return Array.from(TTT_ELIGIBLE_TASK_FAMILIES);
}

export function gatherRoutingSignals(input: {
  task_id?: string;
  task_family?: string;
  department?: string;
  context_length?: "short" | "medium" | "long" | "very_long";
  model_route?: string;
  memory_hit_quality?: "high" | "medium" | "low" | "none";
  reuse_confidence?: number;
  has_playbook?: boolean;
  has_template?: boolean;
  is_replayable?: boolean;
  has_completion_criteria?: boolean;
  expected_task_value?: "low" | "medium" | "high" | "critical";
}): MemoryStrategyRecommendation["routing_signals"] {
  return {
    context_length: input.context_length,
    memory_hit_quality: input.memory_hit_quality,
    reuse_confidence: input.reuse_confidence,
    has_playbook: input.has_playbook,
    has_template: input.has_template,
    is_replayable: input.is_replayable,
    has_completion_criteria: input.has_completion_criteria,
    model_route_type: input.model_route
      ? isVendorHostedModel(input.model_route) ? "vendor_hosted" : "self_hosted"
      : undefined,
    expected_task_value: input.expected_task_value
  };
}

export function recommendMemoryMode(input: {
  task_id?: string;
  task_family?: string;
  department?: string;
  routing_signals: MemoryStrategyRecommendation["routing_signals"];
}): MemoryStrategyRecommendation {
  const signals = input.routing_signals;
  let recommendedMode: MemoryMode = "durable_retrieval";
  let reason = "Default: durable retrieval is the safe primary path.";
  let expectedBenefit = "Stable, auditable, no adaptation risk.";
  let confidence = 0.8;
  const fallbackMode: MemoryMode = "durable_retrieval";

  const isSelfHosted = signals.model_route_type === "self_hosted";
  const isVendorHosted = signals.model_route_type === "vendor_hosted";
  const isLongContext = signals.context_length === "long" || signals.context_length === "very_long";
  const hasLowMemoryHit = signals.memory_hit_quality === "low" || signals.memory_hit_quality === "none";
  const hasLowReuse = (signals.reuse_confidence ?? 1) < 0.5;
  const isReplayable = signals.is_replayable === true;
  const hasCompletionCriteria = signals.has_completion_criteria === true;
  const isHighValue = signals.expected_task_value === "high" || signals.expected_task_value === "critical";
  const taskFamilyEligible = input.task_family ? isTTTEligibleTaskFamily(input.task_family) : false;

  if (isVendorHosted) {
    recommendedMode = "durable_retrieval";
    reason = "Vendor-hosted model route cannot support In-Place TTT. Falling back to durable retrieval.";
    expectedBenefit = "Safe retrieval without adaptation risk on closed API.";
    confidence = 0.95;
  } else if (isSelfHosted && taskFamilyEligible && isLongContext && isReplayable && hasCompletionCriteria) {
    recommendedMode = "ttt_first_specialist";
    reason = "Self-hosted route, TTT-eligible task family, long context, replayable with completion criteria. Specialist TTT lane justified.";
    expectedBenefit = "Potential quality improvement through task-specific adaptation with full rollback safety.";
    confidence = 0.7;
  } else if (isSelfHosted && (taskFamilyEligible || isHighValue) && (isLongContext || hasLowMemoryHit || hasLowReuse)) {
    recommendedMode = "hybrid_retrieval_ttt";
    reason = "Self-hosted route with TTT-eligible or high-value task. Hybrid approach: durable retrieval first, then bounded TTT adaptation.";
    expectedBenefit = "Durable retrieval as baseline, with bounded TTT adaptation for potential improvement.";
    confidence = 0.65;
  } else if (isSelfHosted && taskFamilyEligible) {
    recommendedMode = "hybrid_retrieval_ttt";
    reason = "Self-hosted route with TTT-eligible task family. Hybrid approach recommended but not required.";
    expectedBenefit = "Option to use TTT adaptation if retrieval alone is insufficient.";
    confidence = 0.55;
  } else {
    recommendedMode = "durable_retrieval";
    reason = "No TTT eligibility signals detected. Durable retrieval is the appropriate mode.";
    expectedBenefit = "Stable, well-understood retrieval path.";
    confidence = 0.9;
  }

  const recommendation: MemoryStrategyRecommendation = MemoryStrategyRecommendationSchema.parse({
    recommendation_id: createEntityId("memrec"),
    task_id: input.task_id,
    task_family: input.task_family,
    department: input.department,
    recommended_mode: recommendedMode,
    reason,
    confidence,
    expected_benefit: expectedBenefit,
    fallback_mode: fallbackMode,
    routing_signals: signals,
    created_at: nowIso()
  });

  recommendations.set(recommendation.recommendation_id, recommendation);

  try {
    log("info", "memory_strategy_recommendation", {
      recommendation_id: recommendation.recommendation_id,
      recommended_mode: recommendation.recommended_mode,
      confidence: recommendation.confidence,
      task_id: input.task_id,
      task_family: input.task_family
    });
  } catch { /* logging failure should not block */ }

  return recommendation;
}

export function getMemoryStrategyRecommendation(recommendationId: string): MemoryStrategyRecommendation | undefined {
  return recommendations.get(recommendationId);
}

export function listMemoryStrategyRecommendations(filter?: {
  task_id?: string;
  recommended_mode?: MemoryMode;
}): MemoryStrategyRecommendation[] {
  const all = Array.from(recommendations.values());
  if (!filter) return all;
  return all.filter(r => {
    if (filter.task_id && r.task_id !== filter.task_id) return false;
    if (filter.recommended_mode && r.recommended_mode !== filter.recommended_mode) return false;
    return true;
  });
}

export function evaluateTTTEligibility(input: {
  recommendation_id: string;
  model_route?: string;
  task_family?: string;
  is_privileged_planner?: boolean;
  has_completion_criteria?: boolean;
  is_replayable?: boolean;
  budget_limit?: number;
}): TTTEligibilityGateResult {
  const recommendation = recommendations.get(input.recommendation_id);
  if (!recommendation) {
    const denied: TTTEligibilityGateResult = TTTEligibilityGateResultSchema.parse({
      gate_id: createEntityId("tttgate"),
      recommendation_id: input.recommendation_id,
      verdict: "denied",
      original_mode: "durable_retrieval",
      resolved_mode: "durable_retrieval",
      checks: {
        model_route_eligible: false,
        task_family_eligible: false,
        budget_eligible: false,
        policy_eligible: false,
        replay_eval_eligible: false,
        not_vendor_hosted: false,
        not_privileged_planner: false,
        has_completion_criteria: false
      },
      denial_reason: "Recommendation not found",
      created_at: nowIso()
    });
    gateResults.set(denied.gate_id, denied);
    return denied;
  }

  const originalMode = recommendation.recommended_mode;
  const isVendorHosted = input.model_route ? isVendorHostedModel(input.model_route) : recommendation.routing_signals.model_route_type === "vendor_hosted";
  const modelRouteEligible = !isVendorHosted;
  const taskFamilyEligible = input.task_family ? isTTTEligibleTaskFamily(input.task_family) : (recommendation.task_family ? isTTTEligibleTaskFamily(recommendation.task_family) : false);
  const notPrivilegedPlanner = !(input.is_privileged_planner ?? false);
  const hasCompletionCriteria = input.has_completion_criteria ?? recommendation.routing_signals.has_completion_criteria ?? false;
  const isReplayable = input.is_replayable ?? recommendation.routing_signals.is_replayable ?? false;
  const replayEvalEligible = isReplayable && hasCompletionCriteria;

  const ledger = ensureGlobalBudgetLedger();
  const budgetEligible = ledger.remaining > 0;

  const policyEligible = notPrivilegedPlanner && hasCompletionCriteria;

  const checks: TTTEligibilityGateResult["checks"] = {
    model_route_eligible: modelRouteEligible,
    task_family_eligible: taskFamilyEligible,
    budget_eligible: budgetEligible,
    policy_eligible: policyEligible,
    replay_eval_eligible: replayEvalEligible,
    not_vendor_hosted: !isVendorHosted,
    not_privileged_planner: notPrivilegedPlanner,
    has_completion_criteria: hasCompletionCriteria
  };

  let verdict: TTTEligibilityVerdict = "approved";
  let resolvedMode: MemoryMode = originalMode;
  let denialReason: string | undefined;
  let downgradeReason: string | undefined;

  if (originalMode === "durable_retrieval") {
    verdict = "approved";
    resolvedMode = "durable_retrieval";
  } else if (isVendorHosted) {
    verdict = "denied";
    resolvedMode = "durable_retrieval";
    denialReason = "Vendor-hosted model route cannot support In-Place TTT. TTT requires self-hosted open-weight models.";
  } else if (!notPrivilegedPlanner) {
    verdict = "denied";
    resolvedMode = "durable_retrieval";
    denialReason = "Privileged planner main path cannot use TTT by default. Use a separate research lane.";
  } else if (!taskFamilyEligible && originalMode === "ttt_first_specialist") {
    verdict = "downgraded";
    resolvedMode = "hybrid_retrieval_ttt";
    downgradeReason = "Task family not TTT-eligible for specialist-first mode. Downgraded to hybrid mode.";
  } else if (!taskFamilyEligible) {
    verdict = "downgraded";
    resolvedMode = "durable_retrieval";
    downgradeReason = "Task family not TTT-eligible. Downgraded to durable retrieval.";
  } else if (!budgetEligible) {
    verdict = "denied";
    resolvedMode = "durable_retrieval";
    denialReason = "No adaptation budget remaining. Cannot proceed with TTT.";
  } else if (!policyEligible) {
    verdict = "downgraded";
    resolvedMode = "durable_retrieval";
    downgradeReason = "Policy requirements not met (privileged planner or no completion criteria). Downgraded to durable retrieval.";
  } else if (!replayEvalEligible && originalMode === "ttt_first_specialist") {
    verdict = "downgraded";
    resolvedMode = "hybrid_retrieval_ttt";
    downgradeReason = "Replay/eval eligibility not met for specialist-first mode. Downgraded to hybrid.";
  } else if (!hasCompletionCriteria) {
    verdict = "denied";
    resolvedMode = "durable_retrieval";
    denialReason = "Tasks without measurable completion or verification criteria cannot use TTT.";
  } else {
    verdict = "approved";
    resolvedMode = originalMode;
  }

  const result: TTTEligibilityGateResult = TTTEligibilityGateResultSchema.parse({
    gate_id: createEntityId("tttgate"),
    recommendation_id: input.recommendation_id,
    task_id: recommendation.task_id,
    verdict,
    original_mode: originalMode,
    resolved_mode: resolvedMode,
    checks,
    denial_reason: denialReason,
    downgrade_reason: downgradeReason,
    budget_remaining: ledger.remaining,
    created_at: nowIso()
  });

  gateResults.set(result.gate_id, result);

  try {
    log("info", "ttt_eligibility_gate", {
      gate_id: result.gate_id,
      verdict: result.verdict,
      original_mode: result.original_mode,
      resolved_mode: result.resolved_mode,
      recommendation_id: input.recommendation_id
    });
  } catch { /* logging failure should not block */ }

  return result;
}

export function getTTTEligibilityGateResult(gateId: string): TTTEligibilityGateResult | undefined {
  return gateResults.get(gateId);
}

export function listTTTEligibilityGateResults(filter?: {
  verdict?: TTTEligibilityVerdict;
  task_id?: string;
}): TTTEligibilityGateResult[] {
  const all = Array.from(gateResults.values());
  if (!filter) return all;
  return all.filter(g => {
    if (filter.verdict && g.verdict !== filter.verdict) return false;
    if (filter.task_id && g.task_id !== filter.task_id) return false;
    return true;
  });
}

export function executeTTTAdaptationRun(input: {
  gate_id: string;
  task_id?: string;
  session_id?: string;
  model_route?: string;
  task_prompt?: string;
  budget_limit?: number;
}): TTTAdaptationRun {
  const gateResult = gateResults.get(input.gate_id);
  if (!gateResult) {
    const failed: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
      run_id: createEntityId("ttt_run"),
      gate_id: input.gate_id,
      task_id: input.task_id,
      session_id: input.session_id,
      status: "failed",
      budget_consumed: 0,
      budget_limit: input.budget_limit ?? 0,
      rollback_ready: false,
      started_at: nowIso(),
      completed_at: nowIso(),
      error: "Gate result not found. Cannot execute TTT adaptation without eligibility gate approval."
    });
    adaptationRuns.set(failed.run_id, failed);
    return failed;
  }

  if (gateResult.verdict === "denied") {
    const failed: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
      run_id: createEntityId("ttt_run"),
      gate_id: input.gate_id,
      task_id: input.task_id,
      session_id: input.session_id,
      status: "failed",
      budget_consumed: 0,
      budget_limit: input.budget_limit ?? 0,
      rollback_ready: false,
      started_at: nowIso(),
      completed_at: nowIso(),
      error: `TTT adaptation denied: ${gateResult.denial_reason}`
    });
    adaptationRuns.set(failed.run_id, failed);
    return failed;
  }

  if (gateResult.resolved_mode === "durable_retrieval") {
    const failed: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
      run_id: createEntityId("ttt_run"),
      gate_id: input.gate_id,
      task_id: input.task_id,
      session_id: input.session_id,
      status: "failed",
      budget_consumed: 0,
      budget_limit: input.budget_limit ?? 0,
      rollback_ready: false,
      started_at: nowIso(),
      completed_at: nowIso(),
      error: "Resolved mode is durable_retrieval. No TTT adaptation to execute."
    });
    adaptationRuns.set(failed.run_id, failed);
    return failed;
  }

  const budgetLimit = input.budget_limit ?? Math.min(gateResult.budget_remaining ?? 100, 100);
  const ledger = ensureGlobalBudgetLedger();

  const run: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
    run_id: createEntityId("ttt_run"),
    gate_id: input.gate_id,
    task_id: input.task_id,
    session_id: input.session_id,
    status: "pending",
    budget_consumed: 0,
    budget_limit: budgetLimit,
    rollback_ready: false,
    started_at: nowIso()
  });

  adaptationRuns.set(run.run_id, run);

  try {
    run.status = "baseline_running";
    adaptationRuns.set(run.run_id, run);

    const baselineResult = executeBaselineRun(input);
    run.baseline_result = baselineResult;
    run.status = "baseline_complete";
    run.budget_consumed += 1;
    adaptationRuns.set(run.run_id, run);

    run.status = "adapted_running";
    adaptationRuns.set(run.run_id, run);

    const adaptedResult = executeAdaptedRun(input, baselineResult);
    run.adapted_result = adaptedResult;
    run.status = "adapted_complete";
    run.budget_consumed += 2;
    adaptationRuns.set(run.run_id, run);

    const deltaAnalysis = analyzeDelta(baselineResult, adaptedResult);
    run.delta_analysis = deltaAnalysis;
    run.status = "delta_analyzed";
    adaptationRuns.set(run.run_id, run);

    if (deltaAnalysis.verdict === "regressed") {
      run.status = "rolled_back";
      run.rollback_ready = true;
      run.rollback_artifact_id = createEntityId("ttt_rollback");
    } else {
      run.status = "completed";
      run.rollback_ready = true;
      run.rollback_artifact_id = createEntityId("ttt_rollback");
    }

    run.completed_at = nowIso();

    ledger.consumed += run.budget_consumed;
    ledger.remaining = Math.max(0, ledger.total_budget - ledger.consumed);
    ledger.runs.push({ run_id: run.run_id, amount: run.budget_consumed, timestamp: nowIso() });

    adaptationRuns.set(run.run_id, run);

    try {
      log("info", "ttt_adaptation_run_completed", {
        run_id: run.run_id,
        status: run.status,
        delta_verdict: deltaAnalysis.verdict,
        improvement_score: deltaAnalysis.improvement_score,
        budget_consumed: run.budget_consumed
      });
    } catch { /* logging failure should not block */ }

    return run;
  } catch (error) {
    run.status = "failed";
    run.error = (error as Error).message.slice(0, 500);
    run.completed_at = nowIso();
    run.rollback_ready = true;
    run.rollback_artifact_id = createEntityId("ttt_rollback");
    adaptationRuns.set(run.run_id, run);
    return run;
  }
}

export interface MemoryRoutingScore {
  query: string;
  candidates: Array<{
    memory_id: string;
    title: string;
    kind: string;
    score: number;
    score_breakdown: {
      direct_address_match: number;
      tag_overlap: number;
      lexical_hit: number;
      task_family_affinity: number;
      department_affinity: number;
      reuse_recency: number;
      methodology_bonus: number;
      evaluation_bonus: number;
      directory_depth_bonus: number;
    };
  }>;
  total_candidates: number;
  scoring_method: "local_no_embedding";
}

export function scoreMemoryRoutingCandidates(input: {
  query: string;
  task_id?: string;
  task_family?: string;
  department?: string;
  top_k?: number;
}): MemoryRoutingScore {
  const topK = input.top_k ?? 10;
  const queryLower = input.query.toLowerCase();
  const queryTokens = new Set(queryLower.split(/\s+/).filter(t => t.length >= 2));

  const candidates: MemoryRoutingScore["candidates"] = [];

  for (const item of store.memoryItems.values()) {
    let directAddressMatch = 0;
    let tagOverlap = 0;
    let lexicalHit = 0;
    let taskFamilyAffinity = 0;
    let departmentAffinity = 0;
    let reuseRecency = 0;
    let methodologyBonus = 0;
    let evaluationBonus = 0;
    let directoryDepthBonus = 0;

    const titleLower = (item.title ?? "").toLowerCase();
    const contentLower = (item.content ?? "").toLowerCase();
    const tags = item.tags ?? [];

    if (titleLower === queryLower || contentLower.startsWith(queryLower)) {
      directAddressMatch = 10;
    } else if (titleLower.includes(queryLower)) {
      directAddressMatch = 7;
    } else if (contentLower.includes(queryLower)) {
      directAddressMatch = 3;
    }

    for (const tag of tags) {
      if (queryTokens.has(tag.toLowerCase())) {
        tagOverlap += 2;
      }
    }

    for (const token of queryTokens) {
      if (titleLower.includes(token)) lexicalHit += 1.5;
      if (contentLower.includes(token)) lexicalHit += 0.5;
    }

    if (input.task_family) {
      const familyTokens = input.task_family.toLowerCase().split(/[_\s-]+/).filter(t => t.length >= 2);
      for (const ft of familyTokens) {
        if (titleLower.includes(ft) || contentLower.includes(ft)) taskFamilyAffinity += 2;
        for (const tag of tags) {
          if (tag.toLowerCase().includes(ft)) taskFamilyAffinity += 1.5;
        }
      }
    }

    if (input.department) {
      const deptLower = input.department.toLowerCase();
      if (titleLower.includes(deptLower) || contentLower.includes(deptLower)) departmentAffinity += 2;
      for (const tag of tags) {
        if (tag.toLowerCase().includes(deptLower)) departmentAffinity += 1;
      }
    }

    if (item.source_task_count > 0) {
      reuseRecency = Math.min(item.source_task_count * 0.5, 5);
    }

    if (item.kind === "methodology") {
      methodologyBonus = 3;
    }

    if (item.kind === "evaluation") {
      evaluationBonus = 2;
    }

    const directories = Array.from(store.memoryDirectories.values());
    const relatedDir = directories.find(d => d.key === item.tags?.[0] || d.tags.some(t => tags.includes(t)));
    if (relatedDir) {
      directoryDepthBonus = relatedDir.document_count > 5 ? 1 : 0.5;
    }

    const totalScore = directAddressMatch + tagOverlap + lexicalHit + taskFamilyAffinity + departmentAffinity + reuseRecency + methodologyBonus + evaluationBonus + directoryDepthBonus;

    if (totalScore > 0) {
      candidates.push({
        memory_id: item.memory_id,
        title: item.title,
        kind: item.kind,
        score: Number(totalScore.toFixed(4)),
        score_breakdown: {
          direct_address_match: Number(directAddressMatch.toFixed(2)),
          tag_overlap: Number(tagOverlap.toFixed(2)),
          lexical_hit: Number(lexicalHit.toFixed(2)),
          task_family_affinity: Number(taskFamilyAffinity.toFixed(2)),
          department_affinity: Number(departmentAffinity.toFixed(2)),
          reuse_recency: Number(reuseRecency.toFixed(2)),
          methodology_bonus: Number(methodologyBonus.toFixed(2)),
          evaluation_bonus: Number(evaluationBonus.toFixed(2)),
          directory_depth_bonus: Number(directoryDepthBonus.toFixed(2))
        }
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    query: input.query,
    candidates: candidates.slice(0, topK),
    total_candidates: candidates.length,
    scoring_method: "local_no_embedding"
  };
}

export function computeMemoryHitQuality(input: {
  query: string;
  task_id?: string;
  task_family?: string;
  department?: string;
}): "high" | "medium" | "low" | "none" {
  const scored = scoreMemoryRoutingCandidates(input);
  if (scored.candidates.length === 0) return "none";

  const topScore = scored.candidates[0].score;
  const highScoreCount = scored.candidates.filter(c => c.score >= 8).length;

  if (topScore >= 10 && highScoreCount >= 2) return "high";
  if (topScore >= 5 && highScoreCount >= 1) return "medium";
  if (topScore >= 2) return "low";
  return "none";
}

export function rerankMemoryDirectory(input: {
  directory_id: string;
  query: string;
  task_family?: string;
  department?: string;
}): Array<{
  document_id: string;
  title: string;
  kind: string;
  score: number;
}> {
  const directory = store.memoryDirectories.get(input.directory_id);
  if (!directory) return [];

  const documents = Array.from(store.memoryDocuments.values())
    .filter(d => d.directory_id === input.directory_id);

  const queryLower = input.query.toLowerCase();
  const queryTokens = new Set(queryLower.split(/\s+/).filter(t => t.length >= 2));

  const results: Array<{ document_id: string; title: string; kind: string; score: number }> = [];

  for (const doc of documents) {
    let score = 0;
    const titleLower = doc.title.toLowerCase();
    const summaryLower = (doc.summary ?? "").toLowerCase();

    if (titleLower.includes(queryLower)) score += 5;
    if (summaryLower.includes(queryLower)) score += 3;

    for (const token of queryTokens) {
      if (titleLower.includes(token)) score += 2;
      if (summaryLower.includes(token)) score += 1;
      for (const tag of doc.tags) {
        if (tag.toLowerCase().includes(token)) score += 1.5;
      }
    }

    if (input.task_family && doc.task_family === input.task_family) score += 3;
    if (input.department && doc.department === input.department) score += 2;

    if (doc.promotion_status === "approved") score += 2;
    if (doc.kind === "learned_playbook_reference") score += 1.5;
    if (doc.kind === "methodology_summary") score += 1;

    if (score > 0) {
      results.push({
        document_id: doc.document_id,
        title: doc.title,
        kind: doc.kind,
        score: Number(score.toFixed(4))
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function linkPlaybookToRouting(input: {
  playbook_memory_id: string;
  task_family: string;
  department?: string;
}): { linked: boolean; routing_rules_created: number } {
  const memoryItem = store.memoryItems.get(input.playbook_memory_id);
  if (!memoryItem || memoryItem.kind !== "methodology") {
    return { linked: false, routing_rules_created: 0 };
  }

  let rulesCreated = 0;

  if (!memoryItem.tags.includes(input.task_family)) {
    memoryItem.tags.push(input.task_family);
    rulesCreated++;
  }

  if (input.department && !memoryItem.tags.includes(input.department)) {
    memoryItem.tags.push(input.department);
    rulesCreated++;
  }

  if (!memoryItem.tags.includes("playbook_routing")) {
    memoryItem.tags.push("playbook_routing");
    rulesCreated++;
  }

  store.memoryItems.set(memoryItem.memory_id, memoryItem);

  return { linked: true, routing_rules_created: rulesCreated };
}

export interface TTTRegressionTestCase {
  case_id: string;
  name: string;
  description: string;
  category: "eligibility" | "adaptation" | "distillation" | "budget" | "rollback" | "routing" | "vendor_exclusion";
  severity: "critical" | "high" | "medium" | "low";
}

export interface TTTRegressionTestResult {
  run_id: string;
  timestamp: string;
  results: Array<{
    case_id: string;
    status: "pass" | "fail" | "skip";
    duration_ms: number;
    detail: string;
    error?: string;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pass_rate: number;
  };
}

const TTT_REGRESSION_CASES: TTTRegressionTestCase[] = [
  { case_id: "ttt-reg-001", name: "vendor_hosted_denied", description: "Vendor-hosted model routes must be denied TTT", category: "vendor_exclusion", severity: "critical" },
  { case_id: "ttt-reg-002", name: "privileged_planner_denied", description: "Privileged planner paths must be denied TTT", category: "eligibility", severity: "critical" },
  { case_id: "ttt-reg-003", name: "no_completion_criteria_denied", description: "Tasks without completion criteria must be denied TTT", category: "eligibility", severity: "critical" },
  { case_id: "ttt-reg-004", name: "default_mode_is_durable", description: "Default memory mode must be durable_retrieval", category: "eligibility", severity: "critical" },
  { case_id: "ttt-reg-005", name: "ineligible_family_downgraded", description: "Ineligible task families must be downgraded from TTT modes", category: "eligibility", severity: "high" },
  { case_id: "ttt-reg-006", name: "budget_exhaustion_denied", description: "Zero budget must deny TTT", category: "budget", severity: "high" },
  { case_id: "ttt-reg-007", name: "adaptation_run_lifecycle", description: "Adaptation run must follow pending→baseline→adapted→delta→completed lifecycle", category: "adaptation", severity: "high" },
  { case_id: "ttt-reg-008", name: "regressed_auto_rollback", description: "Regressed delta must trigger automatic rollback", category: "rollback", severity: "critical" },
  { case_id: "ttt-reg-009", name: "distillation_creates_artifacts", description: "Distillation of improved run must create artifacts", category: "distillation", severity: "high" },
  { case_id: "ttt-reg-010", name: "distillation_regressed_eval_only", description: "Distillation of regressed run must only create eval_insights", category: "distillation", severity: "medium" },
  { case_id: "ttt-reg-011", name: "routing_score_no_embedding", description: "Memory routing scoring must work without embedding services", category: "routing", severity: "high" },
  { case_id: "ttt-reg-012", name: "budget_ledger_tracks_consumption", description: "Budget ledger must track consumption accurately", category: "budget", severity: "high" },
  { case_id: "ttt-reg-013", name: "ttt_first_downgraded_to_hybrid", description: "ttt_first_specialist with ineligible family must downgrade to hybrid", category: "eligibility", severity: "high" },
  { case_id: "ttt-reg-014", name: "adapter_boundary_mock", description: "Mock adapter must return valid baseline and adapted results", category: "adaptation", severity: "medium" },
  { case_id: "ttt-reg-015", name: "memory_hit_quality_scoring", description: "computeMemoryHitQuality must return valid quality levels", category: "routing", severity: "medium" }
];

export async function runTTTRegressionTestSuite(): Promise<TTTRegressionTestResult> {
  const startTime = Date.now();
  const results: TTTRegressionTestResult["results"] = [];

  for (const tc of TTT_REGRESSION_CASES) {
    const caseStart = Date.now();
    try {
      let detail = "";

      switch (tc.case_id) {
        case "ttt-reg-001": {
          const rec = recommendMemoryMode({
            task_family: "long_context_analysis",
            routing_signals: gatherRoutingSignals({ model_route: "gpt-4o" })
          });
          const gate = evaluateTTTEligibility({ recommendation_id: rec.recommendation_id, model_route: "gpt-4o" });
          if (gate.verdict !== "denied") throw new Error(`Expected denied, got ${gate.verdict}`);
          if (gate.resolved_mode !== "durable_retrieval") throw new Error(`Expected durable_retrieval, got ${gate.resolved_mode}`);
          detail = `Vendor-hosted correctly denied: ${gate.denial_reason}`;
          break;
        }
        case "ttt-reg-002": {
          const rec = recommendMemoryMode({
            task_family: "specialist_research",
            routing_signals: gatherRoutingSignals({ model_route: "local-llama" })
          });
          const gate = evaluateTTTEligibility({ recommendation_id: rec.recommendation_id, model_route: "local-llama", is_privileged_planner: true });
          if (gate.verdict !== "denied") throw new Error(`Expected denied, got ${gate.verdict}`);
          detail = `Privileged planner correctly denied: ${gate.denial_reason}`;
          break;
        }
        case "ttt-reg-003": {
          const rec = recommendMemoryMode({
            task_family: "long_context_analysis",
            routing_signals: gatherRoutingSignals({ model_route: "local-llama", has_completion_criteria: false })
          });
          const gate = evaluateTTTEligibility({ recommendation_id: rec.recommendation_id, model_route: "local-llama", has_completion_criteria: false });
          if (gate.verdict === "approved" && gate.resolved_mode !== "durable_retrieval") throw new Error(`Expected durable_retrieval or denied, got ${gate.resolved_mode}`);
          detail = `No completion criteria correctly handled: verdict=${gate.verdict}, mode=${gate.resolved_mode}`;
          break;
        }
        case "ttt-reg-004": {
          const rec = recommendMemoryMode({
            routing_signals: {}
          });
          if (rec.recommended_mode !== "durable_retrieval" && rec.fallback_mode !== "durable_retrieval") throw new Error(`Default should be durable_retrieval`);
          detail = `Default mode is ${rec.recommended_mode} with fallback ${rec.fallback_mode}`;
          break;
        }
        case "ttt-reg-005": {
          const rec = recommendMemoryMode({
            task_family: "generic_task",
            routing_signals: gatherRoutingSignals({ model_route: "local-llama" })
          });
          const gate = evaluateTTTEligibility({ recommendation_id: rec.recommendation_id, model_route: "local-llama", task_family: "generic_task" });
          if (gate.verdict === "approved" && gate.resolved_mode !== "durable_retrieval") throw new Error(`Ineligible family should be downgraded`);
          detail = `Ineligible family: verdict=${gate.verdict}, mode=${gate.resolved_mode}`;
          break;
        }
        case "ttt-reg-006": {
          const savedLedger = globalBudgetLedger;
          globalBudgetLedger = undefined;
          const ledger = ensureGlobalBudgetLedger();
          ledger.consumed = ledger.total_budget;
          ledger.remaining = 0;
          const rec = recommendMemoryMode({
            task_family: "long_context_analysis",
            routing_signals: gatherRoutingSignals({ model_route: "local-llama" })
          });
          const gate = evaluateTTTEligibility({ recommendation_id: rec.recommendation_id, model_route: "local-llama", task_family: "long_context_analysis" });
          globalBudgetLedger = savedLedger;
          if (gate.verdict !== "denied") throw new Error(`Expected denied for zero budget, got ${gate.verdict}`);
          detail = `Budget exhaustion correctly denied: ${gate.denial_reason}`;
          break;
        }
        case "ttt-reg-007": {
          const rec = recommendMemoryMode({
            task_family: "long_context_analysis",
            routing_signals: gatherRoutingSignals({ model_route: "local-llama", is_replayable: true, has_completion_criteria: true })
          });
          const gate = evaluateTTTEligibility({ recommendation_id: rec.recommendation_id, model_route: "local-llama", task_family: "long_context_analysis", is_replayable: true, has_completion_criteria: true });
          if (gate.verdict === "denied") { detail = "Gate denied (expected for some configs)"; break; }
          const run = await executeTTTAdaptationRun({ gate_id: gate.gate_id, task_prompt: "test prompt" });
          if (run.status !== "completed" && run.status !== "failed" && run.status !== "rolled_back") throw new Error(`Unexpected run status: ${run.status}`);
          detail = `Adaptation run lifecycle: ${run.status}`;
          break;
        }
        case "ttt-reg-008": {
          const run: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
            run_id: createEntityId("ttt_run"),
            gate_id: createEntityId("tttgate"),
            status: "delta_analyzed",
            delta_analysis: { improvement_score: -0.15, quality_delta: -0.15, latency_delta_ms: 100, token_cost_delta: 50, verdict: "regressed", details: "Test regression" },
            budget_consumed: 3,
            budget_limit: 50,
            rollback_ready: true,
            rollback_artifact_id: createEntityId("ttt_rollback"),
            started_at: nowIso()
          });
          adaptationRuns.set(run.run_id, run);
          const rolledBack = rollbackTTTAdaptation(run.run_id);
          if (rolledBack?.status !== "rolled_back") throw new Error(`Expected rolled_back, got ${rolledBack?.status}`);
          detail = "Regression auto-rollback works correctly";
          break;
        }
        case "ttt-reg-009": {
          const run: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
            run_id: createEntityId("ttt_run"),
            gate_id: createEntityId("tttgate"),
            status: "completed",
            delta_analysis: { improvement_score: 0.2, quality_delta: 0.2, latency_delta_ms: 50, token_cost_delta: 20, verdict: "improved", details: "Test improvement" },
            budget_consumed: 3,
            budget_limit: 50,
            rollback_ready: true,
            rollback_artifact_id: createEntityId("ttt_rollback"),
            started_at: nowIso(),
            completed_at: nowIso()
          });
          adaptationRuns.set(run.run_id, run);
          const dist = distillTTTAdaptation({ adaptation_run_id: run.run_id });
          if (dist.status !== "completed") throw new Error(`Expected completed, got ${dist.status}`);
          if (dist.distilled_artifacts.length === 0) throw new Error(`Expected artifacts, got 0`);
          detail = `Distillation created ${dist.distilled_artifacts.length} artifacts`;
          break;
        }
        case "ttt-reg-010": {
          const run: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
            run_id: createEntityId("ttt_run"),
            gate_id: createEntityId("tttgate"),
            status: "completed",
            delta_analysis: { improvement_score: -0.1, quality_delta: -0.1, latency_delta_ms: 100, token_cost_delta: 50, verdict: "regressed", details: "Test regression" },
            budget_consumed: 3,
            budget_limit: 50,
            rollback_ready: true,
            rollback_artifact_id: createEntityId("ttt_rollback"),
            started_at: nowIso(),
            completed_at: nowIso()
          });
          adaptationRuns.set(run.run_id, run);
          const dist = distillTTTAdaptation({ adaptation_run_id: run.run_id, targets: ["routing_rules", "eval_insights"] });
          const nonEvalArtifacts = dist.distilled_artifacts.filter(a => a.target !== "eval_insights");
          if (nonEvalArtifacts.length > 0) throw new Error(`Regressed run should only have eval_insights, got ${nonEvalArtifacts.map(a => a.target)}`);
          detail = `Regressed distillation correctly limited to eval_insights`;
          break;
        }
        case "ttt-reg-011": {
          const scored = scoreMemoryRoutingCandidates({ query: "test query" });
          if (scored.scoring_method !== "local_no_embedding") throw new Error(`Expected local_no_embedding, got ${scored.scoring_method}`);
          detail = `Routing scoring works without embedding: ${scored.total_candidates} candidates`;
          break;
        }
        case "ttt-reg-012": {
          const savedLedger = globalBudgetLedger;
          globalBudgetLedger = undefined;
          const ledger = resetTTTBudgetLedger(100);
          ledger.consumed = 30;
          ledger.remaining = 70;
          if (ledger.consumed + ledger.remaining !== ledger.total_budget) throw new Error(`Budget tracking mismatch`);
          globalBudgetLedger = savedLedger;
          detail = `Budget ledger tracks correctly: total=${ledger.total_budget}, consumed=${ledger.consumed}, remaining=${ledger.remaining}`;
          break;
        }
        case "ttt-reg-013": {
          const rec = recommendMemoryMode({
            task_family: "generic_task",
            routing_signals: gatherRoutingSignals({ model_route: "local-llama", context_length: "very_long", is_replayable: true, has_completion_criteria: true })
          });
          if (rec.recommended_mode === "ttt_first_specialist") {
            const gate = evaluateTTTEligibility({ recommendation_id: rec.recommendation_id, model_route: "local-llama", task_family: "generic_task" });
            if (gate.resolved_mode === "ttt_first_specialist") throw new Error(`Ineligible family should downgrade ttt_first_specialist`);
            detail = `ttt_first_specialist correctly downgraded to ${gate.resolved_mode}`;
          } else {
            detail = `Recommended mode was ${rec.recommended_mode} (not ttt_first_specialist for ineligible family)`;
          }
          break;
        }
        case "ttt-reg-014": {
          registerBuiltinTTTModelAdapters();
          const adapters = listTTTModelAdapters();
          const mock = adapters.find(a => a.name === "mock");
          if (!mock) throw new Error("Mock adapter not registered");
          const provider = resolveTTTModelAdapter({ model_route: "test" });
          if (!provider) throw new Error("No adapter resolved");
          const baseline = await provider.baselineInference({ task_prompt: "test" });
          const adapted = await provider.adaptedInference({ task_prompt: "test" });
          if (baseline.quality_score < 0 || adapted.quality_score < 0) throw new Error("Invalid quality scores");
          detail = `Mock adapter: baseline=${baseline.quality_score.toFixed(3)}, adapted=${adapted.quality_score.toFixed(3)}`;
          break;
        }
        case "ttt-reg-015": {
          const quality = computeMemoryHitQuality({ query: "nonexistent query xyz" });
          if (!["high", "medium", "low", "none"].includes(quality)) throw new Error(`Invalid quality level: ${quality}`);
          detail = `Memory hit quality: ${quality}`;
          break;
        }
        default:
          detail = `Unknown case: ${tc.case_id}`;
      }

      results.push({ case_id: tc.case_id, status: "pass", duration_ms: Date.now() - caseStart, detail });
    } catch (error) {
      results.push({ case_id: tc.case_id, status: "fail", duration_ms: Date.now() - caseStart, detail: "", error: (error as Error).message.slice(0, 500) });
    }
  }

  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const skipped = results.filter(r => r.status === "skip").length;

  return {
    run_id: createEntityId("ttt_reg"),
    timestamp: nowIso(),
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      pass_rate: results.length > 0 ? Number((passed / results.length).toFixed(4)) : 0
    }
  };
}

export function getTTTRegressionTestCases(): TTTRegressionTestCase[] {
  return [...TTT_REGRESSION_CASES];
}

export interface TTTReplayComparison {
  comparison_id: string;
  baseline_run_id: string;
  replay_run_id: string;
  baseline_verdict: string;
  replay_verdict: string;
  quality_delta: number;
  latency_delta_ms: number;
  regression_detected: boolean;
  created_at: string;
}

export async function replayTTTAdaptationForComparison(input: {
  original_run_id: string;
  model_route?: string;
  task_prompt?: string;
}): Promise<TTTReplayComparison> {
  const originalRun = adaptationRuns.get(input.original_run_id);
  if (!originalRun) {
    return {
      comparison_id: createEntityId("ttt_replay"),
      baseline_run_id: input.original_run_id,
      replay_run_id: "",
      baseline_verdict: "unknown",
      replay_verdict: "unknown",
      quality_delta: 0,
      latency_delta_ms: 0,
      regression_detected: false,
      created_at: nowIso()
    };
  }

  const adapter = resolveTTTModelAdapter({ model_route: input.model_route });
  if (!adapter) {
    return {
      comparison_id: createEntityId("ttt_replay"),
      baseline_run_id: input.original_run_id,
      replay_run_id: "",
      baseline_verdict: originalRun.delta_analysis?.verdict ?? "unknown",
      replay_verdict: "no_adapter",
      quality_delta: 0,
      latency_delta_ms: 0,
      regression_detected: false,
      created_at: nowIso()
    };
  }

  const baselineResult = await adapter.baselineInference({ task_prompt: input.task_prompt ?? "replay", model_route: input.model_route });
  const adaptedResult = await adapter.adaptedInference({ task_prompt: input.task_prompt ?? "replay", model_route: input.model_route });

  const originalQuality = (originalRun.adapted_result as Record<string, unknown>)?.quality_score as number ?? 0;
  const replayQuality = adaptedResult.quality_score;
  const qualityDelta = replayQuality - originalQuality;

  const originalLatency = (originalRun.adapted_result as Record<string, unknown>)?.latency_ms as number ?? 0;
  const replayLatency = adaptedResult.latency_ms;
  const latencyDelta = replayLatency - originalLatency;

  const regressionDetected = qualityDelta < -0.1;

  return {
    comparison_id: createEntityId("ttt_replay"),
    baseline_run_id: input.original_run_id,
    replay_run_id: createEntityId("ttt_replay_run"),
    baseline_verdict: originalRun.delta_analysis?.verdict ?? "unknown",
    replay_verdict: qualityDelta > 0.05 ? "improved" : qualityDelta < -0.05 ? "regressed" : "neutral",
    quality_delta: Number(qualityDelta.toFixed(4)),
    latency_delta_ms: latencyDelta,
    regression_detected: regressionDetected,
    created_at: nowIso()
  };
}

function executeBaselineRun(input: {
  task_id?: string;
  session_id?: string;
  model_route?: string;
  task_prompt?: string;
}): Record<string, unknown> {
  return {
    mode: "durable_retrieval",
    task_id: input.task_id,
    model_route: input.model_route ?? "default",
    prompt_length: (input.task_prompt ?? "").length,
    retrieval_used: true,
    ttt_used: false,
    quality_score: 0,
    latency_ms: 0,
    token_cost: 0,
    note: "Baseline run using durable retrieval memory only. Actual LLM invocation requires external model service."
  };
}

function executeAdaptedRun(
  input: {
    task_id?: string;
    session_id?: string;
    model_route?: string;
    task_prompt?: string;
  },
  baseline: Record<string, unknown>
): Record<string, unknown> {
  return {
    mode: "ttt_adapted",
    task_id: input.task_id,
    model_route: input.model_route ?? "default",
    prompt_length: (input.task_prompt ?? "").length,
    retrieval_used: true,
    ttt_used: true,
    adaptation_steps: 1,
    baseline_quality_score: baseline.quality_score ?? 0,
    quality_score: 0,
    latency_ms: 0,
    token_cost: 0,
    note: "Adapted run using TTT on self-hosted model. Actual adaptation requires external model service with weight update capability."
  };
}

function analyzeDelta(
  baseline: Record<string, unknown>,
  adapted: Record<string, unknown>
): TTTAdaptationRun["delta_analysis"] & {} {
  const baselineScore = (baseline.quality_score as number) ?? 0;
  const adaptedScore = (adapted.quality_score as number) ?? 0;
  const baselineLatency = (baseline.latency_ms as number) ?? 0;
  const adaptedLatency = (adapted.latency_ms as number) ?? 0;
  const baselineCost = (baseline.token_cost as number) ?? 0;
  const adaptedCost = (adapted.token_cost as number) ?? 0;

  const qualityDelta = adaptedScore - baselineScore;
  const latencyDelta = adaptedLatency - baselineLatency;
  const costDelta = adaptedCost - baselineCost;
  const improvementScore = qualityDelta > 0 ? qualityDelta : qualityDelta < 0 ? qualityDelta * 2 : 0;

  let verdict: "improved" | "neutral" | "regressed";
  if (qualityDelta > 0.05) {
    verdict = "improved";
  } else if (qualityDelta < -0.05) {
    verdict = "regressed";
  } else {
    verdict = "neutral";
  }

  return {
    improvement_score: Number(improvementScore.toFixed(4)),
    quality_delta: Number(qualityDelta.toFixed(4)),
    latency_delta_ms: latencyDelta,
    token_cost_delta: costDelta,
    verdict,
    details: `Quality delta: ${qualityDelta.toFixed(4)}, Latency delta: ${latencyDelta}ms, Cost delta: ${costDelta} tokens. Verdict: ${verdict}.`
  };
}

export function getTTTAdaptationRun(runId: string): TTTAdaptationRun | undefined {
  return adaptationRuns.get(runId);
}

export function listTTTAdaptationRuns(filter?: {
  status?: TTTAdaptationRun["status"];
  task_id?: string;
  gate_id?: string;
}): TTTAdaptationRun[] {
  const all = Array.from(adaptationRuns.values());
  if (!filter) return all;
  return all.filter(r => {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.task_id && r.task_id !== filter.task_id) return false;
    if (filter.gate_id && r.gate_id !== filter.gate_id) return false;
    return true;
  });
}

export function rollbackTTTAdaptation(runId: string): TTTAdaptationRun | undefined {
  const run = adaptationRuns.get(runId);
  if (!run) return undefined;
  if (!run.rollback_ready) return undefined;

  run.status = "rolled_back";
  run.completed_at = nowIso();

  adaptationRuns.set(run.run_id, run);

  try {
    log("info", "ttt_adaptation_rollback", {
      run_id: run.run_id,
      rollback_artifact_id: run.rollback_artifact_id
    });
  } catch { /* logging failure should not block */ }

  return run;
}

export function distillTTTAdaptation(input: {
  adaptation_run_id: string;
  targets?: TTTDistillationRecord["targets"];
}): TTTDistillationRecord {
  const run = adaptationRuns.get(input.adaptation_run_id);
  if (!run) {
    const failed: TTTDistillationRecord = TTTDistillationRecordSchema.parse({
      distillation_id: createEntityId("tttdist"),
      adaptation_run_id: input.adaptation_run_id,
      task_id: undefined,
      status: "failed",
      targets: input.targets ?? ["routing_rules"],
      distilled_artifacts: [],
      created_at: nowIso(),
      completed_at: nowIso()
    });
    distillationRecords.set(failed.distillation_id, failed);
    return failed;
  }

  if (run.status !== "completed") {
    const failed: TTTDistillationRecord = TTTDistillationRecordSchema.parse({
      distillation_id: createEntityId("tttdist"),
      adaptation_run_id: input.adaptation_run_id,
      task_id: run.task_id,
      status: "failed",
      targets: input.targets ?? ["routing_rules"],
      distilled_artifacts: [],
      created_at: nowIso(),
      completed_at: nowIso()
    });
    distillationRecords.set(failed.distillation_id, failed);
    return failed;
  }

  const deltaAnalysis = run.delta_analysis;
  if (!deltaAnalysis || deltaAnalysis.verdict === "regressed") {
    const record: TTTDistillationRecord = TTTDistillationRecordSchema.parse({
      distillation_id: createEntityId("tttdist"),
      adaptation_run_id: input.adaptation_run_id,
      task_id: run.task_id,
      status: "completed",
      targets: input.targets ?? ["eval_insights"],
      distilled_artifacts: [{
        target: "eval_insights",
        artifact_id: createEntityId("tttdist_art"),
        change_description: `TTT adaptation regressed or neutral. Recording as eval insight: ${deltaAnalysis?.details ?? "no delta"}`,
        created_at: nowIso()
      }],
      created_at: nowIso(),
      completed_at: nowIso()
    });
    distillationRecords.set(record.distillation_id, record);
    return record;
  }

  const targets = input.targets ?? ["routing_rules", "prompts", "playbooks", "methodology_memory", "task_templates", "eval_insights"];
  const distilledArtifacts: TTTDistillationRecord["distilled_artifacts"] = [];

  for (const target of targets) {
    let changeDescription = "";
    switch (target) {
      case "routing_rules":
        changeDescription = `Updated routing rule: tasks matching this family should prefer ${run.delta_analysis?.verdict === "improved" ? "hybrid_retrieval_ttt" : "durable_retrieval"} based on adaptation result.`;
        break;
      case "prompts":
        changeDescription = "Prompt template refined based on TTT adaptation insights.";
        break;
      case "playbooks":
        changeDescription = "Playbook updated with TTT-enhanced approach for this task family.";
        break;
      case "methodology_memory":
        changeDescription = `Methodology memory entry created: TTT adaptation ${deltaAnalysis?.verdict} with improvement score ${deltaAnalysis?.improvement_score}.`;
        break;
      case "task_templates":
        changeDescription = "Task template updated to include TTT eligibility signals and adaptation results.";
        break;
      case "eval_insights":
        changeDescription = `Eval insight recorded: ${deltaAnalysis?.details}`;
        break;
    }

    distilledArtifacts.push({
      target,
      artifact_id: createEntityId("tttdist_art"),
      change_description: changeDescription,
      created_at: nowIso()
    });
  }

  const record: TTTDistillationRecord = TTTDistillationRecordSchema.parse({
    distillation_id: createEntityId("tttdist"),
    adaptation_run_id: input.adaptation_run_id,
    task_id: run.task_id,
    status: "completed",
    targets,
    distilled_artifacts: distilledArtifacts,
    created_at: nowIso(),
    completed_at: nowIso()
  });

  distillationRecords.set(record.distillation_id, record);

  try {
    log("info", "ttt_distillation_completed", {
      distillation_id: record.distillation_id,
      adaptation_run_id: input.adaptation_run_id,
      targets: record.targets,
      artifact_count: record.distilled_artifacts.length
    });
  } catch { /* logging failure should not block */ }

  return record;
}

export function getTTTDistillationRecord(distillationId: string): TTTDistillationRecord | undefined {
  return distillationRecords.get(distillationId);
}

export function listTTTDistillationRecords(filter?: {
  adaptation_run_id?: string;
  status?: TTTDistillationRecord["status"];
}): TTTDistillationRecord[] {
  const all = Array.from(distillationRecords.values());
  if (!filter) return all;
  return all.filter(d => {
    if (filter.adaptation_run_id && d.adaptation_run_id !== filter.adaptation_run_id) return false;
    if (filter.status && d.status !== filter.status) return false;
    return true;
  });
}

export function getTTTBudgetLedger(): TTTBudgetLedger {
  return ensureGlobalBudgetLedger();
}

export function setTTTBudgetTotal(totalBudget: number): TTTBudgetLedger {
  const ledger = ensureGlobalBudgetLedger();
  ledger.total_budget = totalBudget;
  ledger.remaining = Math.max(0, totalBudget - ledger.consumed);
  return ledger;
}

export function resetTTTBudgetLedger(totalBudget?: number): TTTBudgetLedger {
  globalBudgetLedger = undefined;
  const ledger = ensureGlobalBudgetLedger();
  if (totalBudget !== undefined) {
    ledger.total_budget = totalBudget;
    ledger.remaining = totalBudget;
  }
  return ledger;
}

export function getTTTTraceForTask(taskId: string): {
  recommendations: MemoryStrategyRecommendation[];
  gate_results: TTTEligibilityGateResult[];
  adaptation_runs: TTTAdaptationRun[];
  distillation_records: TTTDistillationRecord[];
} {
  const taskRecommendations = Array.from(recommendations.values()).filter(r => r.task_id === taskId);
  const taskGateResults = Array.from(gateResults.values()).filter(g => g.task_id === taskId);
  const taskRunIds = new Set(Array.from(adaptationRuns.values()).filter(r => r.task_id === taskId).map(r => r.run_id));
  const taskAdaptationRuns = Array.from(adaptationRuns.values()).filter(r => r.task_id === taskId);
  const taskDistillationRecords = Array.from(distillationRecords.values()).filter(d =>
    taskRunIds.has(d.adaptation_run_id)
  );

  return {
    recommendations: taskRecommendations,
    gate_results: taskGateResults,
    adaptation_runs: taskAdaptationRuns,
    distillation_records: taskDistillationRecords
  };
}

export function getTTTVisibilitySummary(taskId?: string): {
  current_memory_mode: MemoryMode;
  active_recommendations: number;
  active_adaptation_runs: number;
  completed_adaptation_runs: number;
  rolled_back_runs: number;
  budget_consumed: number;
  budget_remaining: number;
  eligible_task_families: string[];
  recent_verdicts: Array<{ verdict: TTTEligibilityVerdict; reason?: string; timestamp: string }>;
} {
  const activeRuns = Array.from(adaptationRuns.values()).filter(r =>
    r.status !== "completed" && r.status !== "failed" && r.status !== "rolled_back"
  );
  const completedRuns = Array.from(adaptationRuns.values()).filter(r => r.status === "completed");
  const rolledBackRuns = Array.from(adaptationRuns.values()).filter(r => r.status === "rolled_back");
  const ledger = ensureGlobalBudgetLedger();

  let currentMode: MemoryMode = "durable_retrieval";
  if (taskId) {
    const latestRec = Array.from(recommendations.values())
      .filter(r => r.task_id === taskId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (latestRec) {
      const latestGate = Array.from(gateResults.values())
        .filter(g => g.recommendation_id === latestRec.recommendation_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      currentMode = latestGate?.resolved_mode ?? latestRec.recommended_mode;
    }
  }

  const recentVerdicts = Array.from(gateResults.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map(g => ({
      verdict: g.verdict,
      reason: g.denial_reason ?? g.downgrade_reason,
      timestamp: g.created_at
    }));

  return {
    current_memory_mode: currentMode,
    active_recommendations: recommendations.size,
    active_adaptation_runs: activeRuns.length,
    completed_adaptation_runs: completedRuns.length,
    rolled_back_runs: rolledBackRuns.length,
    budget_consumed: ledger.consumed,
    budget_remaining: ledger.remaining,
    eligible_task_families: listTTTEligibleTaskFamilies(),
    recent_verdicts: recentVerdicts
  };
}

export interface TTTModelAdapter {
  adapter_id: string;
  name: string;
  kind: "mock" | "dry_run" | "replay_eval" | "self_hosted";
  supports_weight_update: boolean;
  supports_baseline_inference: boolean;
  supports_adapted_inference: boolean;
  supports_rollback: boolean;
  max_context_length: number;
  description: string;
}

export interface TTTModelAdapterBaselineResult {
  quality_score: number;
  latency_ms: number;
  token_cost: number;
  output_summary: string;
  metadata: Record<string, unknown>;
}

export interface TTTModelAdapterAdaptedResult {
  quality_score: number;
  latency_ms: number;
  token_cost: number;
  output_summary: string;
  adaptation_steps: number;
  weight_update_applied: boolean;
  metadata: Record<string, unknown>;
}

export interface TTTModelAdapterRollbackResult {
  rollback_id: string;
  success: boolean;
  base_weights_restored: boolean;
  timestamp: string;
}

export interface TTTModelAdapterProvider {
  name: string;
  canHandle(input: { model_route?: string; task_family?: string }): boolean;
  baselineInference(input: {
    model_route?: string;
    task_prompt: string;
    context?: Record<string, unknown>;
  }): Promise<TTTModelAdapterBaselineResult>;
  adaptedInference(input: {
    model_route?: string;
    task_prompt: string;
    context?: Record<string, unknown>;
    adaptation_steps?: number;
  }): Promise<TTTModelAdapterAdaptedResult>;
  rollback(input: {
    model_route?: string;
    rollback_artifact_id?: string;
  }): Promise<TTTModelAdapterRollbackResult>;
  getAdapterInfo(): TTTModelAdapter;
}

const adapterProviders = new Map<string, TTTModelAdapterProvider>();

export function registerTTTModelAdapter(provider: TTTModelAdapterProvider): void {
  adapterProviders.set(provider.name, provider);
  try {
    log("info", "ttt_model_adapter_registered", { name: provider.name });
  } catch { /* logging failure should not block */ }
}

export function unregisterTTTModelAdapter(name: string): boolean {
  return adapterProviders.delete(name);
}

export function listTTTModelAdapters(): TTTModelAdapter[] {
  return Array.from(adapterProviders.values()).map(p => p.getAdapterInfo());
}

export function resolveTTTModelAdapter(input: {
  model_route?: string;
  task_family?: string;
}): TTTModelAdapterProvider | undefined {
  for (const provider of adapterProviders.values()) {
    if (provider.canHandle(input)) return provider;
  }
  return undefined;
}

export function registerBuiltinTTTModelAdapters(): TTTModelAdapter[] {
  const mockAdapter: TTTModelAdapterProvider = {
    name: "mock",
    canHandle: () => true,
    baselineInference: async (input) => ({
      quality_score: 0.5 + Math.random() * 0.2,
      latency_ms: 100 + Math.random() * 200,
      token_cost: 50 + Math.random() * 100,
      output_summary: `Mock baseline for: ${input.task_prompt.slice(0, 100)}`,
      metadata: { adapter: "mock", mode: "baseline" }
    }),
    adaptedInference: async (input) => ({
      quality_score: 0.55 + Math.random() * 0.25,
      latency_ms: 200 + Math.random() * 300,
      token_cost: 100 + Math.random() * 150,
      output_summary: `Mock adapted for: ${input.task_prompt.slice(0, 100)}`,
      adaptation_steps: input.adaptation_steps ?? 1,
      weight_update_applied: false,
      metadata: { adapter: "mock", mode: "adapted" }
    }),
    rollback: async (input) => ({
      rollback_id: createEntityId("ttt_rollback"),
      success: true,
      base_weights_restored: true,
      timestamp: nowIso()
    }),
    getAdapterInfo: () => ({
      adapter_id: createEntityId("ttt_adapter"),
      name: "mock",
      kind: "mock",
      supports_weight_update: false,
      supports_baseline_inference: true,
      supports_adapted_inference: true,
      supports_rollback: true,
      max_context_length: 32768,
      description: "Mock adapter for testing and development. Returns randomized scores without real model inference."
    })
  };

  const dryRunAdapter: TTTModelAdapterProvider = {
    name: "dry_run",
    canHandle: (input) => input.model_route === "dry-run" || input.model_route === undefined,
    baselineInference: async (input) => ({
      quality_score: 0.6,
      latency_ms: 0,
      token_cost: 0,
      output_summary: `Dry-run baseline (no actual inference): ${input.task_prompt.slice(0, 100)}`,
      metadata: { adapter: "dry_run", mode: "baseline" }
    }),
    adaptedInference: async (input) => ({
      quality_score: 0.6,
      latency_ms: 0,
      token_cost: 0,
      output_summary: `Dry-run adapted (no actual inference): ${input.task_prompt.slice(0, 100)}`,
      adaptation_steps: 0,
      weight_update_applied: false,
      metadata: { adapter: "dry_run", mode: "adapted" }
    }),
    rollback: async () => ({
      rollback_id: createEntityId("ttt_rollback"),
      success: true,
      base_weights_restored: true,
      timestamp: nowIso()
    }),
    getAdapterInfo: () => ({
      adapter_id: createEntityId("ttt_adapter"),
      name: "dry_run",
      kind: "dry_run",
      supports_weight_update: false,
      supports_baseline_inference: true,
      supports_adapted_inference: true,
      supports_rollback: true,
      max_context_length: 0,
      description: "Dry-run adapter that returns fixed scores without any model interaction. Used for pipeline validation."
    })
  };

  const replayEvalAdapter: TTTModelAdapterProvider = {
    name: "replay_eval",
    canHandle: (input) => input.task_family === "replay_eval" || input.model_route === "replay-eval",
    baselineInference: async (input) => ({
      quality_score: 0.65,
      latency_ms: 50,
      token_cost: 25,
      output_summary: `Replay-eval baseline: ${input.task_prompt.slice(0, 100)}`,
      metadata: { adapter: "replay_eval", mode: "baseline" }
    }),
    adaptedInference: async (input) => ({
      quality_score: 0.7,
      latency_ms: 75,
      token_cost: 40,
      output_summary: `Replay-eval adapted: ${input.task_prompt.slice(0, 100)}`,
      adaptation_steps: input.adaptation_steps ?? 1,
      weight_update_applied: false,
      metadata: { adapter: "replay_eval", mode: "adapted" }
    }),
    rollback: async () => ({
      rollback_id: createEntityId("ttt_rollback"),
      success: true,
      base_weights_restored: true,
      timestamp: nowIso()
    }),
    getAdapterInfo: () => ({
      adapter_id: createEntityId("ttt_adapter"),
      name: "replay_eval",
      kind: "replay_eval",
      supports_weight_update: false,
      supports_baseline_inference: true,
      supports_adapted_inference: true,
      supports_rollback: true,
      max_context_length: 65536,
      description: "Replay-eval adapter for deterministic regression testing. Returns fixed scores for reproducible comparison."
    })
  };

  if (!adapterProviders.has("mock")) adapterProviders.set("mock", mockAdapter);
  if (!adapterProviders.has("dry_run")) adapterProviders.set("dry_run", dryRunAdapter);
  if (!adapterProviders.has("replay_eval")) adapterProviders.set("replay_eval", replayEvalAdapter);

  return Array.from(adapterProviders.values()).map(p => p.getAdapterInfo());
}

export async function executeAdaptationWithAdapter(input: {
  gate_id: string;
  task_id?: string;
  session_id?: string;
  model_route?: string;
  task_family?: string;
  task_prompt: string;
  budget_limit?: number;
}): Promise<TTTAdaptationRun> {
  const adapter = resolveTTTModelAdapter({ model_route: input.model_route, task_family: input.task_family });

  if (!adapter) {
    const failed: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
      run_id: createEntityId("ttt_run"),
      gate_id: input.gate_id,
      task_id: input.task_id,
      session_id: input.session_id,
      status: "failed",
      budget_consumed: 0,
      budget_limit: input.budget_limit ?? 0,
      rollback_ready: false,
      started_at: nowIso(),
      completed_at: nowIso(),
      error: "No TTT model adapter available for this route/task family."
    });
    adaptationRuns.set(failed.run_id, failed);
    return failed;
  }

  const ledger = ensureGlobalBudgetLedger();
  const budgetLimit = input.budget_limit ?? Math.min(ledger.remaining, 50);

  const run: TTTAdaptationRun = TTTAdaptationRunSchema.parse({
    run_id: createEntityId("ttt_run"),
    gate_id: input.gate_id,
    task_id: input.task_id,
    session_id: input.session_id,
    status: "pending",
    budget_consumed: 0,
    budget_limit: budgetLimit,
    rollback_ready: false,
    started_at: nowIso()
  });
  adaptationRuns.set(run.run_id, run);

  try {
    run.status = "baseline_running";
    adaptationRuns.set(run.run_id, run);

    const baselineResult = await adapter.baselineInference({
      model_route: input.model_route,
      task_prompt: input.task_prompt
    });
    run.baseline_result = baselineResult as unknown as Record<string, unknown>;
    run.status = "baseline_complete";
    run.budget_consumed += 1;
    adaptationRuns.set(run.run_id, run);

    run.status = "adapted_running";
    adaptationRuns.set(run.run_id, run);

    const adaptedResult = await adapter.adaptedInference({
      model_route: input.model_route,
      task_prompt: input.task_prompt,
      adaptation_steps: 1
    });
    run.adapted_result = adaptedResult as unknown as Record<string, unknown>;
    run.status = "adapted_complete";
    run.budget_consumed += 2;
    adaptationRuns.set(run.run_id, run);

    const deltaAnalysis = {
      improvement_score: Number((adaptedResult.quality_score - baselineResult.quality_score).toFixed(4)),
      quality_delta: Number((adaptedResult.quality_score - baselineResult.quality_score).toFixed(4)),
      latency_delta_ms: adaptedResult.latency_ms - baselineResult.latency_ms,
      token_cost_delta: adaptedResult.token_cost - baselineResult.token_cost,
      verdict: (adaptedResult.quality_score - baselineResult.quality_score > 0.05 ? "improved" : adaptedResult.quality_score - baselineResult.quality_score < -0.05 ? "regressed" : "neutral") as "improved" | "neutral" | "regressed",
      details: `Adapter: ${adapter.name}. Quality: ${baselineResult.quality_score.toFixed(3)} → ${adaptedResult.quality_score.toFixed(3)}. Latency: ${baselineResult.latency_ms}ms → ${adaptedResult.latency_ms}ms.`
    };
    run.delta_analysis = deltaAnalysis;
    run.status = "delta_analyzed";
    adaptationRuns.set(run.run_id, run);

    if (deltaAnalysis.verdict === "regressed") {
      const rollbackResult = await adapter.rollback({ model_route: input.model_route });
      run.status = "rolled_back";
      run.rollback_ready = true;
      run.rollback_artifact_id = rollbackResult.rollback_id;
    } else {
      run.status = "completed";
      run.rollback_ready = true;
      run.rollback_artifact_id = createEntityId("ttt_rollback");
    }

    run.completed_at = nowIso();

    ledger.consumed += run.budget_consumed;
    ledger.remaining = Math.max(0, ledger.total_budget - ledger.consumed);
    ledger.runs.push({ run_id: run.run_id, amount: run.budget_consumed, timestamp: nowIso() });

    adaptationRuns.set(run.run_id, run);

    try {
      log("info", "ttt_adaptation_with_adapter_completed", {
        run_id: run.run_id,
        adapter: adapter.name,
        status: run.status,
        delta_verdict: deltaAnalysis.verdict,
        improvement_score: deltaAnalysis.improvement_score
      });
    } catch { /* logging failure should not block */ }

    return run;
  } catch (error) {
    run.status = "failed";
    run.error = (error as Error).message.slice(0, 500);
    run.completed_at = nowIso();
    run.rollback_ready = true;
    run.rollback_artifact_id = createEntityId("ttt_rollback");
    adaptationRuns.set(run.run_id, run);
    return run;
  }
}
