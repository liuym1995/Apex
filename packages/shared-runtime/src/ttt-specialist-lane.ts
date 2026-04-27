import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type SpecialistLaneStatus = "active" | "suspended" | "disabled" | "blocked";

export type SpecialistLaneGateResult = "granted" | "denied" | "deferred" | "downgraded";

export type ReplayEvalVerdict = "improved" | "neutral" | "regressed" | "inconclusive";

export interface TTTSpecialistLaneSpec {
  lane_id: string;
  display_name: string;
  description: string;
  is_default_path: boolean;
  status: SpecialistLaneStatus;
  requires_self_hosted_model: boolean;
  requires_eligible_family: boolean;
  requires_replay_eval: boolean;
  requires_budget_gate: boolean;
  requires_completion_criteria: boolean;
  max_concurrent_adaptations: number;
  adaptation_cooldown_minutes: number;
  rollback_on_regression: boolean;
  distill_proven_gains_only: boolean;
  vendor_hosted_excluded: boolean;
  created_at: string;
}

export interface SpecialistLaneGateCheck {
  check_id: string;
  lane_id: string;
  task_id?: string;
  task_family?: string;
  model_route?: string;
  result: SpecialistLaneGateResult;
  checks: {
    self_hosted_model_available: boolean;
    task_family_eligible: boolean;
    replay_eval_available: boolean;
    budget_available: boolean;
    completion_criteria_present: boolean;
    not_vendor_hosted: boolean;
    not_privileged_planner: boolean;
    lane_not_suspended: boolean;
    concurrent_capacity_available: boolean;
    cooldown_expired: boolean;
  };
  denial_reason?: string;
  downgrade_target?: string;
  evaluated_at: string;
}

export interface SpecialistLaneReplayEval {
  eval_id: string;
  lane_id: string;
  adaptation_run_id: string;
  baseline_score: number;
  adapted_score: number;
  score_delta: number;
  verdict: ReplayEvalVerdict;
  regression_detected: boolean;
  rollback_triggered: boolean;
  rollback_artifact_id?: string;
  promotion_eligible: boolean;
  evaluated_at: string;
}

export interface SpecialistLanePromotionRecord {
  promotion_id: string;
  lane_id: string;
  adaptation_run_id: string;
  replay_eval_id: string;
  source: "ttt_specialist" | "replay_eval" | "manual";
  promoted: boolean;
  promotion_target: "methodology_memory" | "task_template" | "learned_playbook" | "skill" | "capability_routing";
  artifact_id: string;
  reason: string;
  confidence: number;
  proven: boolean;
  promoted_at: string;
}

export interface SpecialistLaneRoutingSignal {
  signal_id: string;
  task_id?: string;
  task_family?: string;
  model_route?: string;
  recommended_path: "durable_retrieval" | "hybrid_retrieval_ttt" | "ttt_specialist";
  signal_strength: number;
  lane_gate_result?: SpecialistLaneGateResult;
  reason: string;
  generated_at: string;
}

export interface SelfHostedModelBoundary {
  boundary_id: string;
  model_route: string;
  is_self_hosted: boolean;
  supports_weight_update: boolean;
  supports_rollback: boolean;
  max_context_length: number;
  current_availability: boolean;
  last_health_check: string;
  setup_instructions: string;
}

const specialistLanes = new Map<string, TTTSpecialistLaneSpec>();
const gateChecks = new Map<string, SpecialistLaneGateCheck>();
const replayEvals = new Map<string, SpecialistLaneReplayEval>();
const promotionRecords = new Map<string, SpecialistLanePromotionRecord>();
const routingSignals = new Map<string, SpecialistLaneRoutingSignal>();
const modelBoundaries = new Map<string, SelfHostedModelBoundary>();

const VENDOR_HOSTED_PREFIXES = [
  "gpt-", "claude-", "gemini-", "anthropic/", "openai/", "google/"
];

const TTT_ELIGIBLE_FAMILIES = new Set([
  "long_context_analysis",
  "specialist_research",
  "replay_eval",
  "code_intelligence",
  "document_synthesis",
  "data_analysis",
  "model_adaptation_experiment"
]);

let activeAdaptations = 0;
let lastAdaptationTime: string | undefined;

export function registerTTTSpecialistLane(input: Omit<TTTSpecialistLaneSpec, "lane_id" | "created_at">): TTTSpecialistLaneSpec {
  const spec: TTTSpecialistLaneSpec = {
    ...input,
    lane_id: createEntityId("tttlane"),
    created_at: nowIso()
  };
  specialistLanes.set(spec.lane_id, spec);
  recordAudit("ttt_specialist.lane_registered", { lane_id: spec.lane_id, is_default: input.is_default_path, status: input.status });
  return spec;
}

export function listTTTSpecialistLanes(filter?: { status?: SpecialistLaneStatus }): TTTSpecialistLaneSpec[] {
  let lanes = [...specialistLanes.values()];
  if (filter?.status) lanes = lanes.filter(l => l.status === filter.status);
  return lanes;
}

export function initializeDefaultTTTSpecialistLane(): TTTSpecialistLaneSpec {
  const existing = [...specialistLanes.values()].find(l => l.display_name === "TTT Specialist Lane");
  if (existing) return existing;

  return registerTTTSpecialistLane({
    display_name: "TTT Specialist Lane",
    description: "Gated specialist lane for TTT adaptation. NOT the default path. Requires self-hosted model, eligible task family, replay-eval, and budget gate.",
    is_default_path: false,
    status: "active",
    requires_self_hosted_model: true,
    requires_eligible_family: true,
    requires_replay_eval: true,
    requires_budget_gate: true,
    requires_completion_criteria: true,
    max_concurrent_adaptations: 3,
    adaptation_cooldown_minutes: 30,
    rollback_on_regression: true,
    distill_proven_gains_only: true,
    vendor_hosted_excluded: true
  });
}

export function registerSelfHostedModelBoundary(input: Omit<SelfHostedModelBoundary, "boundary_id">): SelfHostedModelBoundary {
  const boundary: SelfHostedModelBoundary = { ...input, boundary_id: createEntityId("shmb") };
  modelBoundaries.set(boundary.boundary_id, boundary);
  recordAudit("ttt_specialist.model_boundary_registered", { boundary_id: boundary.boundary_id, route: input.model_route, self_hosted: input.is_self_hosted });
  return boundary;
}

export function listSelfHostedModelBoundaries(): SelfHostedModelBoundary[] {
  return [...modelBoundaries.values()];
}

export function isVendorHostedRoute(modelRoute: string): boolean {
  const lower = modelRoute.toLowerCase();
  return VENDOR_HOSTED_PREFIXES.some(prefix => lower.startsWith(prefix));
}

export function isTTTSpecialistEligibleFamily(taskFamily: string): boolean {
  return TTT_ELIGIBLE_FAMILIES.has(taskFamily);
}

export function registerTTTSpecialistEligibleFamily(taskFamily: string): void {
  TTT_ELIGIBLE_FAMILIES.add(taskFamily);
}

export function listTTTSpecialistEligibleFamilies(): string[] {
  return Array.from(TTT_ELIGIBLE_FAMILIES);
}

export function evaluateSpecialistLaneGate(input: {
  lane_id: string;
  task_id?: string;
  task_family?: string;
  model_route?: string;
  is_privileged_planner?: boolean;
  has_completion_criteria?: boolean;
  budget_remaining?: number;
}): SpecialistLaneGateCheck {
  const lane = specialistLanes.get(input.lane_id);
  if (!lane) {
    const check: SpecialistLaneGateCheck = {
      check_id: createEntityId("tttgate"),
      lane_id: input.lane_id,
      task_id: input.task_id,
      task_family: input.task_family,
      model_route: input.model_route,
      result: "denied",
      checks: {
        self_hosted_model_available: false,
        task_family_eligible: false,
        replay_eval_available: false,
        budget_available: false,
        completion_criteria_present: false,
        not_vendor_hosted: false,
        not_privileged_planner: false,
        lane_not_suspended: false,
        concurrent_capacity_available: false,
        cooldown_expired: false
      },
      denial_reason: "Lane not found",
      evaluated_at: nowIso()
    };
    gateChecks.set(check.check_id, check);
    return check;
  }

  const isVendorHosted = input.model_route ? isVendorHostedRoute(input.model_route) : false;
  const selfHostedAvailable = !isVendorHosted && [...modelBoundaries.values()].some(b => b.is_self_hosted && b.current_availability);
  const familyEligible = input.task_family ? isTTTSpecialistEligibleFamily(input.task_family) : false;
  const budgetAvailable = (input.budget_remaining ?? 0) > 0;
  const completionCriteria = input.has_completion_criteria ?? false;
  const notPrivilegedPlanner = !(input.is_privileged_planner ?? false);
  const laneNotSuspended = lane.status === "active";
  const concurrentAvailable = activeAdaptations < lane.max_concurrent_adaptations;

  let cooldownExpired = true;
  if (lastAdaptationTime && lane.adaptation_cooldown_minutes > 0) {
    const elapsed = Date.now() - new Date(lastAdaptationTime).getTime();
    cooldownExpired = elapsed > lane.adaptation_cooldown_minutes * 60 * 1000;
  }

  const replayEvalAvailable = completionCriteria;

  const checks: SpecialistLaneGateCheck["checks"] = {
    self_hosted_model_available: selfHostedAvailable,
    task_family_eligible: familyEligible,
    replay_eval_available: replayEvalAvailable,
    budget_available: budgetAvailable,
    completion_criteria_present: completionCriteria,
    not_vendor_hosted: !isVendorHosted,
    not_privileged_planner: notPrivilegedPlanner,
    lane_not_suspended: laneNotSuspended,
    concurrent_capacity_available: concurrentAvailable,
    cooldown_expired: cooldownExpired
  };

  let result: SpecialistLaneGateResult = "granted";
  let denialReason: string | undefined;
  let downgradeTarget: string | undefined;

  if (isVendorHosted && lane.vendor_hosted_excluded) {
    result = "denied";
    denialReason = "Vendor-hosted model route excluded from TTT specialist lane. Weight updates require self-hosted open-weight models.";
  } else if (!notPrivilegedPlanner) {
    result = "denied";
    denialReason = "Privileged planner main path cannot use TTT specialist lane.";
  } else if (!completionCriteria && lane.requires_completion_criteria) {
    result = "denied";
    denialReason = "No completion criteria. TTT specialist lane requires measurable completion criteria for replay-eval.";
  } else if (!selfHostedAvailable && lane.requires_self_hosted_model) {
    result = "denied";
    denialReason = "No self-hosted model available. TTT specialist lane requires self-hosted model for weight updates.";
    downgradeTarget = "durable_retrieval";
  } else if (!familyEligible && lane.requires_eligible_family) {
    result = "downgraded";
    denialReason = `Task family '${input.task_family}' not eligible for specialist lane.`;
    downgradeTarget = "hybrid_retrieval_ttt";
  } else if (!budgetAvailable && lane.requires_budget_gate) {
    result = "denied";
    denialReason = "No adaptation budget remaining.";
  } else if (!laneNotSuspended) {
    result = "denied";
    denialReason = `Specialist lane is ${lane.status}.`;
  } else if (!concurrentAvailable) {
    result = "deferred";
    denialReason = `Max concurrent adaptations (${lane.max_concurrent_adaptations}) reached. Retry after completion.`;
  } else if (!cooldownExpired) {
    result = "deferred";
    denialReason = `Adaptation cooldown not expired. Retry after ${lane.adaptation_cooldown_minutes} minutes.`;
  } else if (!replayEvalAvailable && lane.requires_replay_eval) {
    result = "downgraded";
    denialReason = "Replay-eval not available (no completion criteria). Downgrading to hybrid mode.";
    downgradeTarget = "hybrid_retrieval_ttt";
  }

  const check: SpecialistLaneGateCheck = {
    check_id: createEntityId("tttgate"),
    lane_id: input.lane_id,
    task_id: input.task_id,
    task_family: input.task_family,
    model_route: input.model_route,
    result,
    checks,
    denial_reason: denialReason,
    downgrade_target: downgradeTarget,
    evaluated_at: nowIso()
  };

  gateChecks.set(check.check_id, check);
  recordAudit("ttt_specialist.gate_evaluated", { check_id: check.check_id, result, task_family: input.task_family });

  return check;
}

export function listSpecialistLaneGateChecks(filter?: { result?: SpecialistLaneGateResult; lane_id?: string }): SpecialistLaneGateCheck[] {
  let checks = [...gateChecks.values()];
  if (filter?.result) checks = checks.filter(c => c.result === filter.result);
  if (filter?.lane_id) checks = checks.filter(c => c.lane_id === filter.lane_id);
  return checks.sort((a, b) => b.evaluated_at.localeCompare(a.evaluated_at));
}

export function runSpecialistLaneReplayEval(input: {
  lane_id: string;
  adaptation_run_id: string;
  baseline_score: number;
  adapted_score: number;
  force_rollback?: boolean;
}): SpecialistLaneReplayEval {
  const lane = specialistLanes.get(input.lane_id);
  const scoreDelta = Number((input.adapted_score - input.baseline_score).toFixed(4));

  let verdict: ReplayEvalVerdict;
  let regressionDetected = false;
  let rollbackTriggered = false;
  let rollbackArtifactId: string | undefined;
  let promotionEligible = false;

  if (input.force_rollback) {
    verdict = "regressed";
    regressionDetected = true;
    rollbackTriggered = true;
    rollbackArtifactId = createEntityId("ttt_rollback");
  } else if (scoreDelta > 0.05) {
    verdict = "improved";
    promotionEligible = true;
  } else if (scoreDelta < -0.05) {
    verdict = "regressed";
    regressionDetected = true;
    if (lane?.rollback_on_regression ?? true) {
      rollbackTriggered = true;
      rollbackArtifactId = createEntityId("ttt_rollback");
    }
  } else if (Math.abs(scoreDelta) <= 0.02) {
    verdict = "neutral";
  } else {
    verdict = "inconclusive";
  }

  const evalResult: SpecialistLaneReplayEval = {
    eval_id: createEntityId("tttreval"),
    lane_id: input.lane_id,
    adaptation_run_id: input.adaptation_run_id,
    baseline_score: input.baseline_score,
    adapted_score: input.adapted_score,
    score_delta: scoreDelta,
    verdict,
    regression_detected: regressionDetected,
    rollback_triggered: rollbackTriggered,
    rollback_artifact_id: rollbackArtifactId,
    promotion_eligible: promotionEligible,
    evaluated_at: nowIso()
  };

  replayEvals.set(evalResult.eval_id, evalResult);
  recordAudit("ttt_specialist.replay_eval", { eval_id: evalResult.eval_id, verdict, score_delta: scoreDelta, rollback: rollbackTriggered });

  return evalResult;
}

export function listSpecialistLaneReplayEvals(filter?: { verdict?: ReplayEvalVerdict; regression_detected?: boolean }): SpecialistLaneReplayEval[] {
  let evals = [...replayEvals.values()];
  if (filter?.verdict) evals = evals.filter(e => e.verdict === filter.verdict);
  if (filter?.regression_detected !== undefined) evals = evals.filter(e => e.regression_detected === filter.regression_detected);
  return evals.sort((a, b) => b.evaluated_at.localeCompare(a.evaluated_at));
}

export function promoteSpecialistLaneResult(input: {
  lane_id: string;
  adaptation_run_id: string;
  replay_eval_id: string;
  promotion_target: SpecialistLanePromotionRecord["promotion_target"];
}): SpecialistLanePromotionRecord {
  const evalResult = replayEvals.get(input.replay_eval_id);
  const lane = specialistLanes.get(input.lane_id);

  const provenGainsOnly = lane?.distill_proven_gains_only ?? true;
  const isProven = evalResult?.verdict === "improved" && (evalResult?.score_delta ?? 0) > 0.05;

  let promoted = false;
  let reason: string;
  let confidence = 0;

  if (!evalResult) {
    reason = "Replay eval not found. Cannot promote without eval evidence.";
  } else if (provenGainsOnly && !isProven) {
    reason = `Distill proven gains only policy active. Eval verdict: ${evalResult.verdict}, delta: ${evalResult.score_delta}. Not proven improvement.`;
  } else if (evalResult.regression_detected) {
    reason = "Regression detected in replay eval. Cannot promote regressed adaptation.";
  } else if (evalResult.verdict === "improved") {
    promoted = true;
    confidence = Math.min(1, evalResult.score_delta * 5);
    reason = `Proven improvement: delta=${evalResult.score_delta}, verdict=${evalResult.verdict}. Safe to promote to ${input.promotion_target}.`;
  } else if (evalResult.verdict === "neutral") {
    reason = "Neutral eval result. Not enough evidence for promotion.";
  } else {
    reason = `Eval verdict: ${evalResult.verdict}. Not eligible for promotion.`;
  }

  const record: SpecialistLanePromotionRecord = {
    promotion_id: createEntityId("tttpromo"),
    lane_id: input.lane_id,
    adaptation_run_id: input.adaptation_run_id,
    replay_eval_id: input.replay_eval_id,
    source: "replay_eval",
    promoted,
    promotion_target: input.promotion_target,
    artifact_id: createEntityId("tttartifact"),
    reason,
    confidence: Number(confidence.toFixed(4)),
    proven: isProven,
    promoted_at: nowIso()
  };

  promotionRecords.set(record.promotion_id, record);
  recordAudit("ttt_specialist.promotion_evaluated", { promotion_id: record.promotion_id, promoted, proven: isProven, target: input.promotion_target });

  return record;
}

export function listSpecialistLanePromotions(filter?: { promoted?: boolean; proven?: boolean; promotion_target?: string }): SpecialistLanePromotionRecord[] {
  let records = [...promotionRecords.values()];
  if (filter?.promoted !== undefined) records = records.filter(r => r.promoted === filter.promoted);
  if (filter?.proven !== undefined) records = records.filter(r => r.proven === filter.proven);
  if (filter?.promotion_target) records = records.filter(r => r.promotion_target === filter.promotion_target);
  return records.sort((a, b) => b.promoted_at.localeCompare(a.promoted_at));
}

export function generateSpecialistLaneRoutingSignal(input: {
  task_id?: string;
  task_family?: string;
  model_route?: string;
  is_privileged_planner?: boolean;
  has_completion_criteria?: boolean;
  budget_remaining?: number;
}): SpecialistLaneRoutingSignal {
  const lane = [...specialistLanes.values()].find(l => l.status === "active");
  let recommendedPath: SpecialistLaneRoutingSignal["recommended_path"] = "durable_retrieval";
  let signalStrength = 0;
  let reason = "Default: durable retrieval is the safe primary path.";
  let gateResult: SpecialistLaneGateResult | undefined;

  if (!lane) {
    const signal: SpecialistLaneRoutingSignal = {
      signal_id: createEntityId("tttsignal"),
      task_id: input.task_id,
      task_family: input.task_family,
      model_route: input.model_route,
      recommended_path: "durable_retrieval",
      signal_strength: 0,
      reason: "No active specialist lane. Defaulting to durable retrieval.",
      generated_at: nowIso()
    };
    routingSignals.set(signal.signal_id, signal);
    return signal;
  }

  const gate = evaluateSpecialistLaneGate({
    lane_id: lane.lane_id,
    task_id: input.task_id,
    task_family: input.task_family,
    model_route: input.model_route,
    is_privileged_planner: input.is_privileged_planner,
    has_completion_criteria: input.has_completion_criteria,
    budget_remaining: input.budget_remaining
  });

  gateResult = gate.result;

  if (gate.result === "granted") {
    recommendedPath = "ttt_specialist";
    signalStrength = 0.8;
    reason = "All specialist lane gates passed. TTT specialist lane is available.";
  } else if (gate.result === "downgraded" && gate.downgrade_target === "hybrid_retrieval_ttt") {
    recommendedPath = "hybrid_retrieval_ttt";
    signalStrength = 0.5;
    reason = `Specialist lane downgraded: ${gate.denial_reason}`;
  } else {
    recommendedPath = "durable_retrieval";
    signalStrength = 0.9;
    reason = `Specialist lane denied: ${gate.denial_reason ?? "Gate not passed"}. Defaulting to durable retrieval.`;
  }

  const signal: SpecialistLaneRoutingSignal = {
    signal_id: createEntityId("tttsignal"),
    task_id: input.task_id,
    task_family: input.task_family,
    model_route: input.model_route,
    recommended_path: recommendedPath,
    signal_strength: signalStrength,
    lane_gate_result: gateResult,
    reason,
    generated_at: nowIso()
  };

  routingSignals.set(signal.signal_id, signal);
  return signal;
}

export function listSpecialistLaneRoutingSignals(filter?: { recommended_path?: SpecialistLaneRoutingSignal["recommended_path"] }): SpecialistLaneRoutingSignal[] {
  let signals = [...routingSignals.values()];
  if (filter?.recommended_path) signals = signals.filter(s => s.recommended_path === filter.recommended_path);
  return signals.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

export function getTTTSpecialistLaneDiagnostics(): {
  active_lanes: number;
  total_gate_checks: number;
  granted_gates: number;
  denied_gates: number;
  total_replay_evals: number;
  regressions_detected: number;
  rollbacks_triggered: number;
  promotions_granted: number;
  promotions_proven: number;
  default_path_is_durable_retrieval: boolean;
  vendor_hosted_excluded: boolean;
  distill_proven_gains_only: boolean;
  model_boundaries: number;
  self_hosted_available: number;
} {
  const checks = [...gateChecks.values()];
  const evals = [...replayEvals.values()];
  const promotions = [...promotionRecords.values()];
  const boundaries = [...modelBoundaries.values()];

  return {
    active_lanes: [...specialistLanes.values()].filter(l => l.status === "active").length,
    total_gate_checks: checks.length,
    granted_gates: checks.filter(c => c.result === "granted").length,
    denied_gates: checks.filter(c => c.result === "denied").length,
    total_replay_evals: evals.length,
    regressions_detected: evals.filter(e => e.regression_detected).length,
    rollbacks_triggered: evals.filter(e => e.rollback_triggered).length,
    promotions_granted: promotions.filter(p => p.promoted).length,
    promotions_proven: promotions.filter(p => p.proven).length,
    default_path_is_durable_retrieval: ![...specialistLanes.values()].some(l => l.is_default_path),
    vendor_hosted_excluded: [...specialistLanes.values()].every(l => l.vendor_hosted_excluded),
    distill_proven_gains_only: [...specialistLanes.values()].every(l => l.distill_proven_gains_only),
    model_boundaries: boundaries.length,
    self_hosted_available: boundaries.filter(b => b.is_self_hosted && b.current_availability).length
  };
}

export function runTTTSpecialistLaneRegressionSuite(): {
  suite_id: string;
  results: Array<{ case_id: string; name: string; status: "pass" | "fail"; detail: string; error?: string }>;
  summary: { total: number; passed: number; failed: number; pass_rate: number };
} {
  const results: Array<{ case_id: string; name: string; status: "pass" | "fail"; detail: string; error?: string }> = [];

  const cases: Array<{ case_id: string; name: string; fn: () => string }> = [
    {
      case_id: "tttsl-reg-001",
      name: "default_lane_not_default_path",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        if (lane.is_default_path) throw new Error("TTT specialist lane must NOT be the default path");
        return `Lane: is_default_path=${lane.is_default_path}, status=${lane.status}`;
      }
    },
    {
      case_id: "tttsl-reg-002",
      name: "vendor_hosted_denied",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const gate = evaluateSpecialistLaneGate({
          lane_id: lane.lane_id,
          model_route: "gpt-4o",
          task_family: "long_context_analysis",
          has_completion_criteria: true,
          budget_remaining: 100
        });
        if (gate.result !== "denied") throw new Error(`Expected denied for vendor-hosted, got ${gate.result}`);
        if (!gate.checks.not_vendor_hosted === true) throw new Error("Should detect vendor-hosted");
        return `Vendor-hosted correctly denied: ${gate.denial_reason}`;
      }
    },
    {
      case_id: "tttsl-reg-003",
      name: "privileged_planner_denied",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const gate = evaluateSpecialistLaneGate({
          lane_id: lane.lane_id,
          model_route: "local-llama",
          task_family: "specialist_research",
          is_privileged_planner: true,
          has_completion_criteria: true,
          budget_remaining: 100
        });
        if (gate.result !== "denied") throw new Error(`Expected denied for privileged planner, got ${gate.result}`);
        return `Privileged planner correctly denied: ${gate.denial_reason}`;
      }
    },
    {
      case_id: "tttsl-reg-004",
      name: "ineligible_family_downgraded",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const gate = evaluateSpecialistLaneGate({
          lane_id: lane.lane_id,
          model_route: "local-llama",
          task_family: "generic_task",
          has_completion_criteria: true,
          budget_remaining: 100
        });
        if (gate.result === "granted") throw new Error("Ineligible family should not be granted");
        return `Ineligible family: result=${gate.result}, downgrade=${gate.downgrade_target}`;
      }
    },
    {
      case_id: "tttsl-reg-005",
      name: "replay_eval_improved_promotes",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const evalResult = runSpecialistLaneReplayEval({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-run-1",
          baseline_score: 0.5,
          adapted_score: 0.8
        });
        if (evalResult.verdict !== "improved") throw new Error(`Expected improved, got ${evalResult.verdict}`);
        if (!evalResult.promotion_eligible) throw new Error("Should be promotion eligible");

        const promotion = promoteSpecialistLaneResult({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-run-1",
          replay_eval_id: evalResult.eval_id,
          promotion_target: "methodology_memory"
        });
        if (!promotion.promoted) throw new Error(`Expected promoted, reason: ${promotion.reason}`);
        if (!promotion.proven) throw new Error("Should be proven improvement");
        return `Promoted: proven=${promotion.proven}, confidence=${promotion.confidence}`;
      }
    },
    {
      case_id: "tttsl-reg-006",
      name: "replay_eval_regressed_rollback",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const evalResult = runSpecialistLaneReplayEval({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-run-2",
          baseline_score: 0.8,
          adapted_score: 0.4
        });
        if (evalResult.verdict !== "regressed") throw new Error(`Expected regressed, got ${evalResult.verdict}`);
        if (!evalResult.regression_detected) throw new Error("Regression should be detected");
        if (!evalResult.rollback_triggered) throw new Error("Rollback should be triggered");
        if (!evalResult.rollback_artifact_id) throw new Error("Rollback artifact should exist");
        return `Regressed: rollback=${evalResult.rollback_triggered}, artifact=${evalResult.rollback_artifact_id}`;
      }
    },
    {
      case_id: "tttsl-reg-007",
      name: "regressed_not_promoted",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const evalResult = runSpecialistLaneReplayEval({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-run-3",
          baseline_score: 0.7,
          adapted_score: 0.3
        });
        const promotion = promoteSpecialistLaneResult({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-run-3",
          replay_eval_id: evalResult.eval_id,
          promotion_target: "skill"
        });
        if (promotion.promoted) throw new Error("Regressed adaptation should not be promoted");
        return `Correctly not promoted: ${promotion.reason}`;
      }
    },
    {
      case_id: "tttsl-reg-008",
      name: "neutral_not_promoted_proven_gains_only",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const evalResult = runSpecialistLaneReplayEval({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-run-4",
          baseline_score: 0.6,
          adapted_score: 0.63
        });
        const promotion = promoteSpecialistLaneResult({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-run-4",
          replay_eval_id: evalResult.eval_id,
          promotion_target: "task_template"
        });
        if (promotion.promoted) throw new Error("Neutral result should not be promoted with proven-gains-only policy");
        return `Neutral correctly not promoted: ${promotion.reason}`;
      }
    },
    {
      case_id: "tttsl-reg-009",
      name: "routing_signal_default_durable",
      fn: () => {
        const signal = generateSpecialistLaneRoutingSignal({
          model_route: "gpt-4o",
          task_family: "generic_task"
        });
        if (signal.recommended_path !== "durable_retrieval") throw new Error(`Expected durable_retrieval, got ${signal.recommended_path}`);
        return `Default routing: ${signal.recommended_path}, strength=${signal.signal_strength}`;
      }
    },
    {
      case_id: "tttsl-reg-010",
      name: "self_hosted_model_boundary",
      fn: () => {
        const boundary = registerSelfHostedModelBoundary({
          model_route: "local-llama-70b",
          is_self_hosted: true,
          supports_weight_update: true,
          supports_rollback: true,
          max_context_length: 32768,
          current_availability: false,
          last_health_check: nowIso(),
          setup_instructions: "Install Ollama and pull llama3:70b model"
        });
        if (!boundary.is_self_hosted) throw new Error("Should be self-hosted");
        if (boundary.current_availability) throw new Error("Should not be available (Ollama not installed)");
        return `Boundary: self_hosted=${boundary.is_self_hosted}, available=${boundary.current_availability}`;
      }
    },
    {
      case_id: "tttsl-reg-011",
      name: "diagnostics_available",
      fn: () => {
        const diag = getTTTSpecialistLaneDiagnostics();
        if (typeof diag.active_lanes !== "number") throw new Error("Invalid diagnostics");
        if (!diag.default_path_is_durable_retrieval) throw new Error("Default path must be durable_retrieval");
        if (!diag.vendor_hosted_excluded) throw new Error("Vendor-hosted must be excluded");
        if (!diag.distill_proven_gains_only) throw new Error("Must distill proven gains only");
        return `Diagnostics: ${diag.active_lanes} lanes, default=durable=${diag.default_path_is_durable_retrieval}`;
      }
    },
    {
      case_id: "tttsl-reg-012",
      name: "no_completion_criteria_denied",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const gate = evaluateSpecialistLaneGate({
          lane_id: lane.lane_id,
          model_route: "local-llama",
          task_family: "long_context_analysis",
          has_completion_criteria: false,
          budget_remaining: 100
        });
        if (gate.result === "granted") throw new Error("Should not grant without completion criteria");
        return `No completion criteria: result=${gate.result}`;
      }
    },
    {
      case_id: "tttsl-reg-013",
      name: "force_rollback_triggers_rollback",
      fn: () => {
        const lane = initializeDefaultTTTSpecialistLane();
        const evalResult = runSpecialistLaneReplayEval({
          lane_id: lane.lane_id,
          adaptation_run_id: "test-force-rollback",
          baseline_score: 0.8,
          adapted_score: 0.9,
          force_rollback: true
        });
        if (!evalResult.rollback_triggered) throw new Error("Force rollback should trigger rollback");
        if (!evalResult.regression_detected) throw new Error("Force rollback should detect regression");
        return `Force rollback: triggered=${evalResult.rollback_triggered}`;
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
    suite_id: createEntityId("tttslsuite"),
    results,
    summary: { total: results.length, passed, failed, pass_rate: results.length > 0 ? Number((passed / results.length).toFixed(4)) : 0 }
  };
}

export function verifySelfHostedModelConnectivity(modelRoute: string): {
  model_route: string;
  is_self_hosted: boolean;
  connectivity: "live" | "not_installed" | "unreachable";
  endpoint?: string;
  error?: string;
  verified_at: string;
} {
  if (isVendorHostedRoute(modelRoute)) {
    return {
      model_route: modelRoute,
      is_self_hosted: false,
      connectivity: "unreachable",
      error: "Vendor-hosted route excluded from TTT specialist lane",
      verified_at: nowIso()
    };
  }

  const boundary = [...modelBoundaries.values()].find(b => b.model_route === modelRoute);
  if (!boundary) {
    return {
      model_route: modelRoute,
      is_self_hosted: true,
      connectivity: "not_installed",
      error: `Self-hosted model '${modelRoute}' not registered. Install Ollama or equivalent and register via registerSelfHostedModelBoundary().`,
      verified_at: nowIso()
    };
  }

  if (!boundary.current_availability) {
    return {
      model_route: modelRoute,
      is_self_hosted: boundary.is_self_hosted,
      connectivity: "not_installed",
      endpoint: boundary.model_route,
      error: boundary.setup_instructions,
      verified_at: nowIso()
    };
  }

  return {
    model_route: modelRoute,
    is_self_hosted: boundary.is_self_hosted,
    connectivity: "live",
    endpoint: boundary.model_route,
    verified_at: nowIso()
  };
}

export function runTTTSpecialistLaneActivationVerification(): {
  specialist_lane_status: SpecialistLaneStatus;
  self_hosted_model_available: boolean;
  default_routing_path: string;
  gate_check_result: SpecialistLaneGateResult;
  vendor_hosted_excluded: boolean;
  distill_proven_gains_only: boolean;
  overall: "live_now" | "boundary_only" | "host_blocked";
  blocking_resources: string[];
} {
  const lane = [...specialistLanes.values()].find(l => l.display_name === "TTT Specialist Lane");
  const diag = getTTTSpecialistLaneDiagnostics();

  const selfHostedAvailable = diag.self_hosted_available > 0;

  const signal = generateSpecialistLaneRoutingSignal({
    model_route: "local-llama",
    task_family: "long_context_analysis",
    has_completion_criteria: true,
    budget_remaining: 100
  });

  const gate = evaluateSpecialistLaneGate({
    lane_id: lane?.lane_id ?? "",
    model_route: "local-llama",
    task_family: "long_context_analysis",
    has_completion_criteria: true,
    budget_remaining: 100
  });

  const blockingResources: string[] = [];
  if (!selfHostedAvailable) blockingResources.push("self-hosted model service (e.g., Ollama)");

  let overall: "live_now" | "boundary_only" | "host_blocked";
  if (selfHostedAvailable && gate.result === "granted") {
    overall = "live_now";
  } else if (selfHostedAvailable) {
    overall = "boundary_only";
  } else {
    overall = "host_blocked";
  }

  return {
    specialist_lane_status: lane?.status ?? "disabled",
    self_hosted_model_available: selfHostedAvailable,
    default_routing_path: signal.recommended_path,
    gate_check_result: gate.result,
    vendor_hosted_excluded: diag.vendor_hosted_excluded,
    distill_proven_gains_only: diag.distill_proven_gains_only,
    overall,
    blocking_resources: blockingResources
  };
}
