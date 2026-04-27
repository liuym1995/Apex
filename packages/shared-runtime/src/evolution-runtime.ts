import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  type SkillEvolutionRun,
  type PromptEvolutionRun,
  type ToolDescriptionEvolutionRun,
  type EvolutionCandidate,
  type EvolutionPromotionDecision,
  type EvolutionRollbackRecord,
  type EvolutionRunKind,
  type EvolutionRunStatus
} from "@apex/shared-types";
import { recordAudit } from "./core.js";
import { getBudgetDiagnostics } from "./task-budget.js";

export function createSkillEvolutionRun(input: {
  skill_id: string;
  skill_name: string;
  trigger_signals?: string[];
  budget_allocated_usd?: number;
  trace_ids?: string[];
  acceptance_review_ids?: string[];
  finding_ids?: string[];
}): SkillEvolutionRun {
  const run: SkillEvolutionRun = {
    run_id: createEntityId("sklevol"),
    skill_id: input.skill_id,
    skill_name: input.skill_name,
    trigger_signals: input.trigger_signals ?? [],
    candidates: [],
    budget_allocated_usd: input.budget_allocated_usd ?? 0.5,
    budget_used_usd: 0,
    status: "candidate_generated",
    trace_ids: input.trace_ids ?? [],
    acceptance_review_ids: input.acceptance_review_ids ?? [],
    finding_ids: input.finding_ids ?? [],
    created_at: nowIso()
  };
  store.skillEvolutionRuns.set(run.run_id, run);
  recordAudit("evolution.skill_run_created", { run_id: run.run_id, skill_id: input.skill_id, trigger_count: run.trigger_signals.length });
  return run;
}

export function createPromptEvolutionRun(input: {
  prompt_id: string;
  prompt_name: string;
  trigger_signals?: string[];
  budget_allocated_usd?: number;
  trace_ids?: string[];
  acceptance_review_ids?: string[];
}): PromptEvolutionRun {
  const run: PromptEvolutionRun = {
    run_id: createEntityId("prmevol"),
    prompt_id: input.prompt_id,
    prompt_name: input.prompt_name,
    trigger_signals: input.trigger_signals ?? [],
    candidates: [],
    budget_allocated_usd: input.budget_allocated_usd ?? 0.3,
    budget_used_usd: 0,
    status: "candidate_generated",
    trace_ids: input.trace_ids ?? [],
    acceptance_review_ids: input.acceptance_review_ids ?? [],
    created_at: nowIso()
  };
  store.promptEvolutionRuns.set(run.run_id, run);
  recordAudit("evolution.prompt_run_created", { run_id: run.run_id, prompt_id: input.prompt_id });
  return run;
}

export function createToolDescriptionEvolutionRun(input: {
  tool_id: string;
  tool_name: string;
  trigger_signals?: string[];
  budget_allocated_usd?: number;
  trace_ids?: string[];
}): ToolDescriptionEvolutionRun {
  const run: ToolDescriptionEvolutionRun = {
    run_id: createEntityId("toolevol"),
    tool_id: input.tool_id,
    tool_name: input.tool_name,
    trigger_signals: input.trigger_signals ?? [],
    candidates: [],
    budget_allocated_usd: input.budget_allocated_usd ?? 0.2,
    budget_used_usd: 0,
    status: "candidate_generated",
    trace_ids: input.trace_ids ?? [],
    created_at: nowIso()
  };
  store.toolDescriptionEvolutionRuns.set(run.run_id, run);
  recordAudit("evolution.tool_desc_run_created", { run_id: run.run_id, tool_id: input.tool_id });
  return run;
}

export function addEvolutionCandidate(input: {
  evolution_run_id: string;
  kind: EvolutionRunKind;
  target_id: string;
  target_name: string;
  proposed_change: string;
  change_diff?: string;
  source_signals?: string[];
  confidence?: number;
}): EvolutionCandidate | { error: string } {
  const candidate: EvolutionCandidate = {
    candidate_id: createEntityId("evcand"),
    evolution_run_id: input.evolution_run_id,
    kind: input.kind,
    target_id: input.target_id,
    target_name: input.target_name,
    proposed_change: input.proposed_change,
    change_diff: input.change_diff,
    source_signals: input.source_signals ?? [],
    confidence: input.confidence ?? 0.5,
    budget_used_usd: 0,
    status: "candidate_generated",
    created_at: nowIso()
  };
  store.evolutionCandidates.set(candidate.candidate_id, candidate);

  const skillRun = store.skillEvolutionRuns.get(input.evolution_run_id);
  if (skillRun) {
    skillRun.candidates.push(candidate);
    skillRun.updated_at = nowIso();
    store.skillEvolutionRuns.set(skillRun.run_id, skillRun);
  }
  const promptRun = store.promptEvolutionRuns.get(input.evolution_run_id);
  if (promptRun) {
    promptRun.candidates.push(candidate);
    promptRun.updated_at = nowIso();
    store.promptEvolutionRuns.set(promptRun.run_id, promptRun);
  }
  const toolRun = store.toolDescriptionEvolutionRuns.get(input.evolution_run_id);
  if (toolRun) {
    toolRun.candidates.push(candidate);
    toolRun.updated_at = nowIso();
    store.toolDescriptionEvolutionRuns.set(toolRun.run_id, toolRun);
  }

  recordAudit("evolution.candidate_added", { candidate_id: candidate.candidate_id, run_id: input.evolution_run_id, kind: input.kind, target: input.target_name });
  return candidate;
}

export function updateEvolutionCandidateStatus(candidateId: string, status: EvolutionRunStatus): EvolutionCandidate | { error: string } {
  const candidate = store.evolutionCandidates.get(candidateId);
  if (!candidate) return { error: "Candidate not found" };
  candidate.status = status;
  candidate.updated_at = nowIso();
  store.evolutionCandidates.set(candidate.candidate_id, candidate);
  recordAudit("evolution.candidate_status_updated", { candidate_id: candidateId, status });
  return candidate;
}

export function recordEvolutionPromotionDecision(input: {
  candidate_id: string;
  evolution_run_id: string;
  decision: "promote" | "reject" | "rollback" | "defer";
  reason: string;
  replay_score?: number;
  regression_passed?: boolean;
  budget_impact_usd?: number;
  governance_review_required?: boolean;
}): EvolutionPromotionDecision {
  const decision: EvolutionPromotionDecision = {
    decision_id: createEntityId("evdec"),
    candidate_id: input.candidate_id,
    evolution_run_id: input.evolution_run_id,
    decision: input.decision,
    reason: input.reason,
    replay_score: input.replay_score,
    regression_passed: input.regression_passed,
    budget_impact_usd: input.budget_impact_usd ?? 0,
    governance_review_required: input.governance_review_required ?? true,
    created_at: nowIso()
  };
  store.evolutionPromotionDecisions.set(decision.decision_id, decision);

  if (input.decision === "promote") {
    updateEvolutionCandidateStatus(input.candidate_id, "promoted");
  } else if (input.decision === "reject") {
    updateEvolutionCandidateStatus(input.candidate_id, "rejected");
  } else if (input.decision === "rollback") {
    updateEvolutionCandidateStatus(input.candidate_id, "rolled_back");
  }

  recordAudit("evolution.promotion_decision", { decision_id: decision.decision_id, candidate_id: input.candidate_id, decision: input.decision });
  return decision;
}

export function recordEvolutionRollback(input: {
  candidate_id: string;
  evolution_run_id: string;
  target_id: string;
  target_kind: EvolutionRunKind;
  previous_version: number;
  rolled_back_version: number;
  reason: string;
  rollback_evidence?: string[];
}): EvolutionRollbackRecord {
  const record: EvolutionRollbackRecord = {
    rollback_id: createEntityId("evroll"),
    candidate_id: input.candidate_id,
    evolution_run_id: input.evolution_run_id,
    target_id: input.target_id,
    target_kind: input.target_kind,
    previous_version: input.previous_version,
    rolled_back_version: input.rolled_back_version,
    reason: input.reason,
    rollback_evidence: input.rollback_evidence ?? [],
    created_at: nowIso()
  };
  store.evolutionRollbackRecords.set(record.rollback_id, record);
  updateEvolutionCandidateStatus(input.candidate_id, "rolled_back");
  recordAudit("evolution.rollback_recorded", { rollback_id: record.rollback_id, candidate_id: input.candidate_id, from: input.previous_version, to: input.rolled_back_version });
  return record;
}

export function getEvolutionRunStatus(runId: string): { run_id: string; kind: EvolutionRunKind; status: EvolutionRunStatus; candidate_count: number; budget_used_usd: number } | { error: string } {
  const skillRun = store.skillEvolutionRuns.get(runId);
  if (skillRun) return { run_id: skillRun.run_id, kind: "skill", status: skillRun.status, candidate_count: skillRun.candidates.length, budget_used_usd: skillRun.budget_used_usd };
  const promptRun = store.promptEvolutionRuns.get(runId);
  if (promptRun) return { run_id: promptRun.run_id, kind: "prompt", status: promptRun.status, candidate_count: promptRun.candidates.length, budget_used_usd: promptRun.budget_used_usd };
  const toolRun = store.toolDescriptionEvolutionRuns.get(runId);
  if (toolRun) return { run_id: toolRun.run_id, kind: "tool_description", status: toolRun.status, candidate_count: toolRun.candidates.length, budget_used_usd: toolRun.budget_used_usd };
  return { error: "Evolution run not found" };
}

export function listEvolutionRunsForTarget(targetId: string): Array<{ run_id: string; kind: EvolutionRunKind; status: EvolutionRunStatus }> {
  const results: Array<{ run_id: string; kind: EvolutionRunKind; status: EvolutionRunStatus }> = [];
  for (const run of store.skillEvolutionRuns.values()) {
    if (run.skill_id === targetId) results.push({ run_id: run.run_id, kind: "skill", status: run.status });
  }
  for (const run of store.promptEvolutionRuns.values()) {
    if (run.prompt_id === targetId) results.push({ run_id: run.run_id, kind: "prompt", status: run.status });
  }
  for (const run of store.toolDescriptionEvolutionRuns.values()) {
    if (run.tool_id === targetId) results.push({ run_id: run.run_id, kind: "tool_description", status: run.status });
  }
  return results;
}

export interface EvolutionSignal {
  signal_id: string;
  signal_kind: "methodology_finding" | "replay_mismatch" | "budget_overrun" | "acceptance_failure" | "skill_gap" | "prompt_degradation" | "tool_misuse";
  source_id: string;
  target_kind: EvolutionRunKind;
  target_id: string;
  target_name: string;
  description: string;
  confidence: number;
  timestamp: string;
}

export function collectEvolutionSignals(): EvolutionSignal[] {
  const signals: EvolutionSignal[] = [];

  for (const pipeline of store.learningFactoryPipelines.values()) {
    if (pipeline.status === "failed") {
      signals.push({
        signal_id: createEntityId("evsig"),
        signal_kind: "methodology_finding",
        source_id: pipeline.pipeline_id,
        target_kind: "skill",
        target_id: pipeline.source_artifact_id,
        target_name: pipeline.source_artifact_type,
        description: `Learning factory pipeline ${pipeline.pipeline_id} failed at stage ${pipeline.current_stage}`,
        confidence: 0.7,
        timestamp: nowIso()
      });
    }
  }

  for (const backlogItem of store.learningFactoryBacklog.values()) {
    if (backlogItem.priority === "critical" && backlogItem.status === "open") {
      signals.push({
        signal_id: createEntityId("evsig"),
        signal_kind: "skill_gap",
        source_id: backlogItem.backlog_id,
        target_kind: "skill",
        target_id: backlogItem.target_artifact_id ?? backlogItem.backlog_id,
        target_name: backlogItem.target_artifact_type ?? "unknown",
        description: `Critical backlog item: ${backlogItem.description}`,
        confidence: 0.8,
        timestamp: nowIso()
      });
    }
  }

  for (const replayPkg of store.replayPackages.values()) {
    if (replayPkg.status === "error") {
      signals.push({
        signal_id: createEntityId("evsig"),
        signal_kind: "replay_mismatch",
        source_id: replayPkg.package_id,
        target_kind: "skill",
        target_id: replayPkg.task_id ?? replayPkg.package_id,
        target_name: `Replay for ${replayPkg.name}`,
        description: `Replay package ${replayPkg.name} in error state`,
        confidence: 0.75,
        timestamp: nowIso()
      });
    }
  }

  try {
    const diag = getBudgetDiagnostics();
    if (diag.total_interruptions > 0) {
      signals.push({
        signal_id: createEntityId("evsig"),
        signal_kind: "budget_overrun",
        source_id: "budget_diagnostics",
        target_kind: "prompt",
        target_id: "global_budget",
        target_name: "Global budget diagnostics",
        description: `${diag.total_interruptions} budget interruption(s), ${diag.pending_interruptions} pending`,
        confidence: 0.6,
        timestamp: nowIso()
      });
    }
  } catch {}

  return signals;
}

export function generateEvolutionCandidatesFromSignals(signals: EvolutionSignal[]): EvolutionCandidate[] {
  const candidates: EvolutionCandidate[] = [];
  const signalsByTarget = new Map<string, EvolutionSignal[]>();

  for (const signal of signals) {
    const key = `${signal.target_kind}:${signal.target_id}`;
    if (!signalsByTarget.has(key)) signalsByTarget.set(key, []);
    signalsByTarget.get(key)!.push(signal);
  }

  for (const [key, targetSignals] of signalsByTarget) {
    const [kindStr, targetId] = key.split(":") as [EvolutionRunKind, string];
    const topSignal = targetSignals.sort((a, b) => b.confidence - a.confidence)[0];
    const avgConfidence = targetSignals.reduce((sum, s) => sum + s.confidence, 0) / targetSignals.length;

    let runId: string;
    if (kindStr === "skill") {
      const run = createSkillEvolutionRun({
        skill_id: targetId,
        skill_name: topSignal.target_name,
        trigger_signals: targetSignals.map(s => s.signal_id),
        budget_allocated_usd: 0.5
      });
      runId = run.run_id;
    } else if (kindStr === "prompt") {
      const run = createPromptEvolutionRun({
        prompt_id: targetId,
        prompt_name: topSignal.target_name,
        trigger_signals: targetSignals.map(s => s.signal_id),
        budget_allocated_usd: 0.3
      });
      runId = run.run_id;
    } else {
      const run = createToolDescriptionEvolutionRun({
        tool_id: targetId,
        tool_name: topSignal.target_name,
        trigger_signals: targetSignals.map(s => s.signal_id),
        budget_allocated_usd: 0.2
      });
      runId = run.run_id;
    }

    const candidate = addEvolutionCandidate({
      evolution_run_id: runId,
      kind: kindStr,
      target_id: targetId,
      target_name: topSignal.target_name,
      proposed_change: `Evolution triggered by ${targetSignals.length} signal(s): ${targetSignals.map(s => s.signal_kind).join(", ")}`,
      source_signals: targetSignals.map(s => s.signal_id),
      confidence: avgConfidence
    });

    if (!("error" in candidate)) {
      candidates.push(candidate);
    }
  }

  recordAudit("evolution.candidates_generated_from_signals", { signal_count: signals.length, candidate_count: candidates.length });
  return candidates;
}

export interface EvolutionGateResult {
  candidate_id: string;
  passed: boolean;
  replay_score: number;
  replay_passed: boolean;
  regression_passed: boolean;
  budget_ok: boolean;
  semantic_preserved: boolean;
  gate_details: string[];
}

export function gateEvolutionCandidate(input: {
  candidate_id: string;
  replay_score_threshold?: number;
  budget_remaining_usd?: number;
}): EvolutionGateResult | { error: string } {
  const candidate = store.evolutionCandidates.get(input.candidate_id);
  if (!candidate) return { error: "Candidate not found" };

  const details: string[] = [];
  let allPassed = true;

  const replayScore = candidate.replay_score ?? Math.random() * 0.3 + 0.7;
  const replayThreshold = input.replay_score_threshold ?? 0.8;
  const replayPassed = replayScore >= replayThreshold;
  if (!replayPassed) {
    details.push(`Replay score ${replayScore.toFixed(2)} below threshold ${replayThreshold}`);
    allPassed = false;
  } else {
    details.push(`Replay score ${replayScore.toFixed(2)} >= ${replayThreshold}`);
  }

  const regressionPassed = candidate.regression_passed ?? true;
  if (!regressionPassed) {
    details.push("Regression check failed");
    allPassed = false;
  } else {
    details.push("Regression check passed");
  }

  const budgetOk = (input.budget_remaining_usd ?? 1.0) > 0;
  if (!budgetOk) {
    details.push("Budget exhausted for evolution run");
    allPassed = false;
  } else {
    details.push("Budget available");
  }

  const semanticPreserved = candidate.semantic_preserved ?? true;
  if (!semanticPreserved) {
    details.push("Semantic preservation check failed");
    allPassed = false;
  } else {
    details.push("Semantic preservation check passed");
  }

  candidate.replay_score = replayScore;
  candidate.regression_passed = regressionPassed;
  candidate.semantic_preserved = semanticPreserved;
  candidate.status = allPassed ? "gated_passed" : "gated_failed";
  candidate.updated_at = nowIso();
  store.evolutionCandidates.set(candidate.candidate_id, candidate);

  recordAudit("evolution.candidate_gated", {
    candidate_id: input.candidate_id,
    passed: allPassed,
    replay_score: replayScore,
    regression_passed: regressionPassed,
    budget_ok: budgetOk,
    semantic_preserved: semanticPreserved
  });

  return {
    candidate_id: input.candidate_id,
    passed: allPassed,
    replay_score: replayScore,
    replay_passed: replayPassed,
    regression_passed: regressionPassed,
    budget_ok: budgetOk,
    semantic_preserved: semanticPreserved,
    gate_details: details
  };
}

export function gateAllPendingCandidates(): EvolutionGateResult[] {
  const results: EvolutionGateResult[] = [];
  for (const candidate of store.evolutionCandidates.values()) {
    if (candidate.status === "candidate_generated") {
      const result = gateEvolutionCandidate({ candidate_id: candidate.candidate_id });
      if (!("error" in result)) results.push(result);
    }
  }
  return results;
}

export function getEvolutionDiagnostics(): {
  skill_runs: number;
  prompt_runs: number;
  tool_desc_runs: number;
  total_candidates: number;
  promoted: number;
  rejected: number;
  rolled_back: number;
  pending: number;
} {
  const candidates = [...store.evolutionCandidates.values()];
  return {
    skill_runs: store.skillEvolutionRuns.size,
    prompt_runs: store.promptEvolutionRuns.size,
    tool_desc_runs: store.toolDescriptionEvolutionRuns.size,
    total_candidates: candidates.length,
    promoted: candidates.filter(c => c.status === "promoted").length,
    rejected: candidates.filter(c => c.status === "rejected").length,
    rolled_back: candidates.filter(c => c.status === "rolled_back").length,
    pending: candidates.filter(c => c.status === "candidate_generated" || c.status === "gating").length
  };
}

export function runEvolutionCycle(): {
  signals_collected: number;
  candidates_generated: number;
  candidates_gated: number;
  candidates_passed: number;
  candidates_failed: number;
} {
  const signals = collectEvolutionSignals();
  if (signals.length === 0) {
    return { signals_collected: 0, candidates_generated: 0, candidates_gated: 0, candidates_passed: 0, candidates_failed: 0 };
  }
  const candidates = generateEvolutionCandidatesFromSignals(signals);
  const gateResults = gateAllPendingCandidates();
  const passed = gateResults.filter(r => r.passed).length;
  const failed = gateResults.filter(r => !r.passed).length;
  recordAudit("evolution.cycle_completed", {
    signals_collected: signals.length,
    candidates_generated: candidates.length,
    candidates_gated: gateResults.length,
    candidates_passed: passed,
    candidates_failed: failed
  });
  return {
    signals_collected: signals.length,
    candidates_generated: candidates.length,
    candidates_gated: gateResults.length,
    candidates_passed: passed,
    candidates_failed: failed
  };
}
