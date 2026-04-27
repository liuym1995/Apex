import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type TraceKind = "task_trace" | "tool_trace" | "computer_use_trace" | "verification_trace";

export type TraceGradeVerdict = "excellent" | "good" | "acceptable" | "poor" | "failing";

export interface TraceGradeCriterion {
  criterion_id: string;
  name: string;
  description: string;
  weight: number;
  scoring_method: "deterministic" | "heuristic" | "eval_based";
  pass_threshold: number;
  perfect_score: number;
}

export interface TraceGradeScore {
  criterion_id: string;
  score: number;
  normalized_score: number;
  passed: boolean;
  detail: string;
}

export interface TraceGradeResult {
  grade_id: string;
  trace_id: string;
  trace_kind: TraceKind;
  task_id?: string;
  task_family?: string;
  scores: TraceGradeScore[];
  weighted_total: number;
  verdict: TraceGradeVerdict;
  regression_detected: boolean;
  regression_detail?: string;
  baseline_grade_id?: string;
  baseline_verdict?: TraceGradeVerdict;
  baseline_weighted_total?: number;
  improvement_delta?: number;
  attached_to: TraceGradeAttachment[];
  graded_at: string;
}

export interface TraceGradeAttachment {
  target: "task_template" | "learned_playbook" | "capability_routing_hint" | "methodology_memory";
  target_id: string;
  attached_at: string;
}

export interface TraceGradeRegressionVerdict {
  verdict_id: string;
  grade_id: string;
  trace_id: string;
  is_regression: boolean;
  severity: "none" | "minor" | "moderate" | "major" | "critical";
  previous_verdict: TraceGradeVerdict;
  current_verdict: TraceGradeVerdict;
  delta: number;
  affected_criteria: string[];
  recommendation: string;
  detected_at: string;
}

export interface TraceEvalFlywheelCycle {
  cycle_id: string;
  trace_ids: string[];
  grades: TraceGradeResult[];
  regression_verdicts: TraceGradeRegressionVerdict[];
  methodology_feedback: TraceMethodologyFeedback[];
  total_traces_graded: number;
  total_regressions_detected: number;
  total_improvements_detected: number;
  cycle_completed_at: string;
}

export interface TraceMethodologyFeedback {
  feedback_id: string;
  source_grade_id: string;
  target: "task_template" | "learned_playbook" | "capability_routing_hint" | "methodology_memory";
  target_id: string;
  feedback_kind: "promote" | "demote" | "adjust_routing" | "update_threshold" | "flag_for_experiment";
  reason: string;
  confidence: number;
  applied: boolean;
  created_at: string;
}

const traceGrades = new Map<string, TraceGradeResult>();
const regressionVerdicts = new Map<string, TraceGradeRegressionVerdict>();
const methodologyFeedback = new Map<string, TraceMethodologyFeedback>();
const gradeCriteria = new Map<string, TraceGradeCriterion>();
const baselineGrades = new Map<string, string>();

const DEFAULT_CRITERIA: Array<Omit<TraceGradeCriterion, "criterion_id">> = [
  {
    name: "task_completion",
    description: "Whether the task completed successfully with all required outputs",
    weight: 0.25,
    scoring_method: "deterministic",
    pass_threshold: 0.6,
    perfect_score: 1.0
  },
  {
    name: "verification_pass_rate",
    description: "Percentage of verification checks that passed",
    weight: 0.20,
    scoring_method: "deterministic",
    pass_threshold: 0.7,
    perfect_score: 1.0
  },
  {
    name: "tool_usage_efficiency",
    description: "Efficiency of tool invocations - minimal unnecessary calls",
    weight: 0.15,
    scoring_method: "heuristic",
    pass_threshold: 0.5,
    perfect_score: 1.0
  },
  {
    name: "cost_efficiency",
    description: "Token and latency cost relative to task complexity",
    weight: 0.10,
    scoring_method: "heuristic",
    pass_threshold: 0.4,
    perfect_score: 1.0
  },
  {
    name: "safety_compliance",
    description: "No policy violations, sandbox escapes, or unauthorized egress",
    weight: 0.20,
    scoring_method: "deterministic",
    pass_threshold: 1.0,
    perfect_score: 1.0
  },
  {
    name: "replay_determinism",
    description: "Replay of the same trace produces consistent results",
    weight: 0.10,
    scoring_method: "eval_based",
    pass_threshold: 0.8,
    perfect_score: 1.0
  }
];

export function registerTraceGradeCriterion(input: Omit<TraceGradeCriterion, "criterion_id">): TraceGradeCriterion {
  const criterion: TraceGradeCriterion = { ...input, criterion_id: createEntityId("tgcrit") };
  gradeCriteria.set(criterion.criterion_id, criterion);
  recordAudit("trace_grading.criterion_registered", { criterion_id: criterion.criterion_id, name: input.name, weight: input.weight });
  return criterion;
}

export function listTraceGradeCriteria(): TraceGradeCriterion[] {
  return [...gradeCriteria.values()];
}

export function initializeDefaultTraceGradeCriteria(): TraceGradeCriterion[] {
  return DEFAULT_CRITERIA.map(c => registerTraceGradeCriterion(c));
}

function ensureCriteria(): TraceGradeCriterion[] {
  if (gradeCriteria.size === 0) initializeDefaultTraceGradeCriteria();
  return [...gradeCriteria.values()];
}

function computeVerdict(weightedTotal: number): TraceGradeVerdict {
  if (weightedTotal >= 0.9) return "excellent";
  if (weightedTotal >= 0.75) return "good";
  if (weightedTotal >= 0.6) return "acceptable";
  if (weightedTotal >= 0.4) return "poor";
  return "failing";
}

function scoreTaskTraceDeterministic(traceId: string, criterion: TraceGradeCriterion): TraceGradeScore {
  const taskRun = [...store.taskRuns.values()].find(r => r.run_id === traceId);
  if (!taskRun) {
    return { criterion_id: criterion.criterion_id, score: 0, normalized_score: 0, passed: false, detail: "TaskRun not found for trace" };
  }

  let score = 0;
  switch (criterion.name) {
    case "task_completion": {
      score = taskRun.status === "completed" ? 1.0 : taskRun.status === "failed" ? 0 : 0.3;
      break;
    }
    case "verification_pass_rate": {
      const attempts = [...store.taskAttempts.values()].filter(a => a.run_id === traceId);
      if (attempts.length === 0) { score = 0.5; break; }
      const completedAttempts = attempts.filter(a => a.status === "completed").length;
      score = completedAttempts / attempts.length;
      break;
    }
    case "safety_compliance": {
      const violations = [...store.sandboxLeases.values()].filter(v => v.task_id === traceId && v.status === "revoked");
      score = violations.length === 0 ? 1.0 : Math.max(0, 1.0 - violations.length * 0.25);
      break;
    }
    default: {
      score = 0.5;
    }
  }

  const normalizedScore = criterion.perfect_score > 0 ? score / criterion.perfect_score : 0;
  return {
    criterion_id: criterion.criterion_id,
    score: Number(score.toFixed(4)),
    normalized_score: Number(normalizedScore.toFixed(4)),
    passed: normalizedScore >= criterion.pass_threshold,
    detail: `Scored ${criterion.name}: raw=${score.toFixed(4)}, normalized=${normalizedScore.toFixed(4)}`
  };
}

function scoreToolTraceHeuristic(traceId: string, criterion: TraceGradeCriterion): TraceGradeScore {
  const invocations = [...store.modelRequests.values()].filter(i => i.request_id === traceId);

  let score = 0.5;
  switch (criterion.name) {
    case "tool_usage_efficiency": {
      if (invocations.length === 0) { score = 0.5; break; }
      const successRate = invocations.filter(i => i.status === "success").length / invocations.length;
      const redundancyPenalty = Math.max(0, (invocations.length - 5) * 0.05);
      score = Math.min(1.0, successRate - redundancyPenalty);
      break;
    }
    case "cost_efficiency": {
      const totalCost = invocations.reduce((sum, i) => sum + (i.cost_usd ?? 0), 0);
      if (totalCost === 0) { score = 0.7; break; }
      score = Math.max(0, 1.0 - totalCost / 1.0);
      break;
    }
    default:
      score = 0.5;
  }

  const normalizedScore = criterion.perfect_score > 0 ? score / criterion.perfect_score : 0;
  return {
    criterion_id: criterion.criterion_id,
    score: Number(score.toFixed(4)),
    normalized_score: Number(normalizedScore.toFixed(4)),
    passed: normalizedScore >= criterion.pass_threshold,
    detail: `Heuristic ${criterion.name}: raw=${score.toFixed(4)}, normalized=${normalizedScore.toFixed(4)}`
  };
}

function scoreComputerUseTrace(traceId: string, criterion: TraceGradeCriterion): TraceGradeScore {
  let score = 0.5;

  switch (criterion.name) {
    case "task_completion": {
      const steps = [...store.computerUseSteps.values()].filter(s => s.session_id === traceId);
      if (steps.length === 0) { score = 0.3; break; }
      const completedSteps = steps.filter(s => s.completed_at !== undefined).length;
      score = completedSteps / steps.length;
      break;
    }
    case "safety_compliance": {
      score = 1.0;
      break;
    }
    case "replay_determinism": {
      score = 0.7;
      break;
    }
    default:
      score = 0.5;
  }

  const normalizedScore = criterion.perfect_score > 0 ? score / criterion.perfect_score : 0;
  return {
    criterion_id: criterion.criterion_id,
    score: Number(score.toFixed(4)),
    normalized_score: Number(normalizedScore.toFixed(4)),
    passed: normalizedScore >= criterion.pass_threshold,
    detail: `Computer-use ${criterion.name}: raw=${score.toFixed(4)}, normalized=${normalizedScore.toFixed(4)}`
  };
}

function scoreVerificationTrace(traceId: string, criterion: TraceGradeCriterion): TraceGradeScore {
  let score = 0.5;

  switch (criterion.name) {
    case "verification_pass_rate": {
      const checks = [...store.checklistResults.values()];
      if (checks.length === 0) { score = 0.5; break; }
      const passedChecks = checks.filter(c => c.status === "passed").length;
      score = passedChecks / checks.length;
      break;
    }
    case "task_completion": {
      score = 0.8;
      break;
    }
    default:
      score = 0.5;
  }

  const normalizedScore = criterion.perfect_score > 0 ? score / criterion.perfect_score : 0;
  return {
    criterion_id: criterion.criterion_id,
    score: Number(score.toFixed(4)),
    normalized_score: Number(normalizedScore.toFixed(4)),
    passed: normalizedScore >= criterion.pass_threshold,
    detail: `Verification ${criterion.name}: raw=${score.toFixed(4)}, normalized=${normalizedScore.toFixed(4)}`
  };
}

export function gradeTrace(input: {
  trace_id: string;
  trace_kind: TraceKind;
  task_id?: string;
  task_family?: string;
  baseline_grade_id?: string;
  custom_scores?: Array<{ criterion_name: string; score: number }>;
}): TraceGradeResult {
  const criteria = ensureCriteria();
  const scores: TraceGradeScore[] = [];

  for (const criterion of criteria) {
    let scoreResult: TraceGradeScore;

    if (input.custom_scores) {
      const custom = input.custom_scores.find(cs => cs.criterion_name === criterion.name);
      if (custom) {
        const normalizedScore = criterion.perfect_score > 0 ? custom.score / criterion.perfect_score : 0;
        scoreResult = {
          criterion_id: criterion.criterion_id,
          score: Number(custom.score.toFixed(4)),
          normalized_score: Number(normalizedScore.toFixed(4)),
          passed: normalizedScore >= criterion.pass_threshold,
          detail: `Custom score for ${criterion.name}`
        };
      } else {
        scoreResult = scoreByKind(input.trace_id, input.trace_kind, criterion);
      }
    } else {
      scoreResult = scoreByKind(input.trace_id, input.trace_kind, criterion);
    }

    scores.push(scoreResult);
  }

  let weightedTotal = 0;
  let totalWeight = 0;
  for (let i = 0; i < criteria.length; i++) {
    weightedTotal += scores[i].normalized_score * criteria[i].weight;
    totalWeight += criteria[i].weight;
  }
  weightedTotal = totalWeight > 0 ? Number((weightedTotal / totalWeight).toFixed(4)) : 0;

  const verdict = computeVerdict(weightedTotal);

  let regressionDetected = false;
  let regressionDetail: string | undefined;
  let baselineVerdict: TraceGradeVerdict | undefined;
  let baselineWeightedTotal: number | undefined;
  let improvementDelta: number | undefined;

  if (input.baseline_grade_id) {
    const baselineGrade = traceGrades.get(input.baseline_grade_id);
    if (baselineGrade) {
      baselineVerdict = baselineGrade.verdict;
      baselineWeightedTotal = baselineGrade.weighted_total;
      improvementDelta = Number((weightedTotal - baselineGrade.weighted_total).toFixed(4));

      const verdictOrder: Record<TraceGradeVerdict, number> = { excellent: 5, good: 4, acceptable: 3, poor: 2, failing: 1 };
      if (verdictOrder[verdict] < verdictOrder[baselineGrade.verdict]) {
        regressionDetected = true;
        regressionDetail = `Regression: ${baselineGrade.verdict} → ${verdict} (delta: ${improvementDelta})`;
      }
    }
  }

  const previousGradeForTrace = [...traceGrades.values()]
    .filter(g => g.trace_id === input.trace_id && g.trace_kind === input.trace_kind)
    .sort((a, b) => b.graded_at.localeCompare(a.graded_at))[0];

  if (previousGradeForTrace && !input.baseline_grade_id) {
    baselineVerdict = previousGradeForTrace.verdict;
    baselineWeightedTotal = previousGradeForTrace.weighted_total;
    improvementDelta = Number((weightedTotal - previousGradeForTrace.weighted_total).toFixed(4));

    const verdictOrder: Record<TraceGradeVerdict, number> = { excellent: 5, good: 4, acceptable: 3, poor: 2, failing: 1 };
    if (verdictOrder[verdict] < verdictOrder[previousGradeForTrace.verdict]) {
      regressionDetected = true;
      regressionDetail = `Regression from previous grade: ${previousGradeForTrace.verdict} → ${verdict} (delta: ${improvementDelta})`;
    }
  }

  const attachments: TraceGradeAttachment[] = [];
  if (input.task_id) {
    const template = [...store.taskTemplates.values()].find(t => t.template_id === input.task_id);
    if (template) {
      attachments.push({ target: "task_template", target_id: template.template_id, attached_at: nowIso() });
    }
  }

  const result: TraceGradeResult = {
    grade_id: createEntityId("tgrade"),
    trace_id: input.trace_id,
    trace_kind: input.trace_kind,
    task_id: input.task_id,
    task_family: input.task_family,
    scores,
    weighted_total: weightedTotal,
    verdict,
    regression_detected: regressionDetected,
    regression_detail: regressionDetail,
    baseline_grade_id: input.baseline_grade_id ?? previousGradeForTrace?.grade_id,
    baseline_verdict: baselineVerdict,
    baseline_weighted_total: baselineWeightedTotal,
    improvement_delta: improvementDelta,
    attached_to: attachments,
    graded_at: nowIso()
  };

  traceGrades.set(result.grade_id, result);

  if (input.task_family) {
    baselineGrades.set(input.task_family, result.grade_id);
  }

  recordAudit("trace_grading.graded", {
    grade_id: result.grade_id,
    trace_id: input.trace_id,
    trace_kind: input.trace_kind,
    verdict,
    weighted_total: weightedTotal,
    regression_detected: regressionDetected
  });

  return result;
}

function scoreByKind(traceId: string, traceKind: TraceKind, criterion: TraceGradeCriterion): TraceGradeScore {
  switch (traceKind) {
    case "task_trace":
      return scoreTaskTraceDeterministic(traceId, criterion);
    case "tool_trace":
      return scoreToolTraceHeuristic(traceId, criterion);
    case "computer_use_trace":
      return scoreComputerUseTrace(traceId, criterion);
    case "verification_trace":
      return scoreVerificationTrace(traceId, criterion);
    default:
      return {
        criterion_id: criterion.criterion_id,
        score: 0,
        normalized_score: 0,
        passed: false,
        detail: `Unknown trace kind: ${traceKind}`
      };
  }
}

export function getTraceGrade(gradeId: string): TraceGradeResult | undefined {
  return traceGrades.get(gradeId);
}

export function listTraceGrades(filter?: {
  trace_kind?: TraceKind;
  verdict?: TraceGradeVerdict;
  task_id?: string;
  regression_detected?: boolean;
}): TraceGradeResult[] {
  let grades = [...traceGrades.values()];
  if (filter?.trace_kind) grades = grades.filter(g => g.trace_kind === filter.trace_kind);
  if (filter?.verdict) grades = grades.filter(g => g.verdict === filter.verdict);
  if (filter?.task_id) grades = grades.filter(g => g.task_id === filter.task_id);
  if (filter?.regression_detected !== undefined) grades = grades.filter(g => g.regression_detected === filter.regression_detected);
  return grades.sort((a, b) => b.graded_at.localeCompare(a.graded_at));
}

export function detectTraceRegression(gradeId: string): TraceGradeRegressionVerdict {
  const grade = traceGrades.get(gradeId);
  if (!grade) {
    const verdict: TraceGradeRegressionVerdict = {
      verdict_id: createEntityId("tgreg"),
      grade_id: gradeId,
      trace_id: "",
      is_regression: false,
      severity: "none",
      previous_verdict: "acceptable",
      current_verdict: "acceptable",
      delta: 0,
      affected_criteria: [],
      recommendation: "Grade not found",
      detected_at: nowIso()
    };
    return verdict;
  }

  const previousGrade = grade.baseline_grade_id ? traceGrades.get(grade.baseline_grade_id) : undefined;
  const previousVerdict = previousGrade?.verdict ?? grade.verdict;
  const delta = grade.improvement_delta ?? 0;

  const verdictOrder: Record<TraceGradeVerdict, number> = { excellent: 5, good: 4, acceptable: 3, poor: 2, failing: 1 };
  const isRegression = verdictOrder[grade.verdict] < verdictOrder[previousVerdict];

  let severity: TraceGradeRegressionVerdict["severity"] = "none";
  if (isRegression) {
    const deltaLevels = verdictOrder[previousVerdict] - verdictOrder[grade.verdict];
    if (deltaLevels >= 3) severity = "critical";
    else if (deltaLevels >= 2) severity = "major";
    else if (deltaLevels === 1 && delta < -0.2) severity = "moderate";
    else if (deltaLevels === 1) severity = "minor";
  }

  const affectedCriteria = grade.scores
    .filter(s => !s.passed)
    .map(s => s.criterion_id);

  let recommendation: string;
  if (!isRegression) {
    recommendation = "No regression detected. Continue monitoring.";
  } else if (severity === "critical") {
    recommendation = "Critical regression detected. Immediate rollback and investigation required.";
  } else if (severity === "major") {
    recommendation = "Major regression detected. Review affected criteria and consider rollback.";
  } else if (severity === "moderate") {
    recommendation = "Moderate regression. Flag for experiment and methodology review.";
  } else {
    recommendation = "Minor regression. Monitor and adjust thresholds if pattern persists.";
  }

  const result: TraceGradeRegressionVerdict = {
    verdict_id: createEntityId("tgreg"),
    grade_id: gradeId,
    trace_id: grade.trace_id,
    is_regression: isRegression,
    severity,
    previous_verdict: previousVerdict,
    current_verdict: grade.verdict,
    delta,
    affected_criteria: affectedCriteria,
    recommendation,
    detected_at: nowIso()
  };

  regressionVerdicts.set(result.verdict_id, result);
  recordAudit("trace_grading.regression_detected", { verdict_id: result.verdict_id, isRegression, severity, grade_id: gradeId });

  return result;
}

export function listTraceRegressionVerdicts(filter?: {
  severity?: TraceGradeRegressionVerdict["severity"];
  is_regression?: boolean;
}): TraceGradeRegressionVerdict[] {
  let verdicts = [...regressionVerdicts.values()];
  if (filter?.severity) verdicts = verdicts.filter(v => v.severity === filter.severity);
  if (filter?.is_regression !== undefined) verdicts = verdicts.filter(v => v.is_regression === filter.is_regression);
  return verdicts.sort((a, b) => b.detected_at.localeCompare(a.detected_at));
}

export function generateTraceMethodologyFeedback(gradeId: string): TraceMethodologyFeedback[] {
  const grade = traceGrades.get(gradeId);
  if (!grade) return [];

  const feedbacks: TraceMethodologyFeedback[] = [];
  const failedCriteria = grade.scores.filter(s => !s.passed);

  if (grade.task_id) {
    const template = [...store.taskTemplates.values()].find(t => t.template_id === grade.task_id);
    if (template) {
      if (grade.verdict === "excellent" || grade.verdict === "good") {
        feedbacks.push({
          feedback_id: createEntityId("tmfb"),
          source_grade_id: gradeId,
          target: "task_template",
          target_id: template.template_id,
          feedback_kind: "promote",
          reason: `Trace grade ${grade.verdict} (score: ${grade.weighted_total}). Template should be promoted as reliable reference.`,
          confidence: Math.min(1, grade.weighted_total),
          applied: false,
          created_at: nowIso()
        });
      } else if (grade.verdict === "poor" || grade.verdict === "failing") {
        feedbacks.push({
          feedback_id: createEntityId("tmfb"),
          source_grade_id: gradeId,
          target: "task_template",
          target_id: template.template_id,
          feedback_kind: "flag_for_experiment",
          reason: `Trace grade ${grade.verdict} (score: ${grade.weighted_total}). Template needs experimental improvement. Failed criteria: ${failedCriteria.map(s => s.criterion_id).join(", ")}`,
          confidence: Math.min(1, 1 - grade.weighted_total),
          applied: false,
          created_at: nowIso()
        });
      }
    }
  }

  if (grade.task_family) {
    const playbooks = [...store.memoryItems.values()].filter(
      m => m.kind === "methodology" && m.tags.includes(grade.task_family!)
    );

    for (const playbook of playbooks.slice(0, 3)) {
      if (grade.regression_detected) {
        feedbacks.push({
          feedback_id: createEntityId("tmfb"),
          source_grade_id: gradeId,
          target: "learned_playbook",
          target_id: playbook.memory_id,
          feedback_kind: "demote",
          reason: `Regression detected in trace for task family ${grade.task_family}. Playbook may need revision.`,
          confidence: 0.7,
          applied: false,
          created_at: nowIso()
        });
      } else if (grade.verdict === "excellent") {
        feedbacks.push({
          feedback_id: createEntityId("tmfb"),
          source_grade_id: gradeId,
          target: "methodology_memory",
          target_id: playbook.memory_id,
          feedback_kind: "promote",
          reason: `Excellent trace grade for task family ${grade.task_family}. Methodology should be reinforced.`,
          confidence: 0.8,
          applied: false,
          created_at: nowIso()
        });
      }
    }

    feedbacks.push({
      feedback_id: createEntityId("tmfb"),
      source_grade_id: gradeId,
      target: "capability_routing_hint",
      target_id: grade.task_family,
      feedback_kind: grade.verdict === "excellent" || grade.verdict === "good" ? "adjust_routing" : "flag_for_experiment",
      reason: grade.verdict === "excellent" || grade.verdict === "good"
        ? `Good trace grade (${grade.verdict}) for family ${grade.task_family}. Consider boosting routing priority.`
        : `Poor trace grade (${grade.verdict}) for family ${grade.task_family}. Consider routing adjustment or experiment.`,
      confidence: 0.6,
      applied: false,
      created_at: nowIso()
    });
  }

  for (const fb of feedbacks) {
    methodologyFeedback.set(fb.feedback_id, fb);
  }

  recordAudit("trace_grading.methodology_feedback_generated", {
    grade_id: gradeId,
    feedback_count: feedbacks.length,
    verdict: grade.verdict
  });

  return feedbacks;
}

export function listTraceMethodologyFeedback(filter?: {
  target?: TraceMethodologyFeedback["target"];
  feedback_kind?: TraceMethodologyFeedback["feedback_kind"];
  applied?: boolean;
}): TraceMethodologyFeedback[] {
  let feedbacks = [...methodologyFeedback.values()];
  if (filter?.target) feedbacks = feedbacks.filter(f => f.target === filter.target);
  if (filter?.feedback_kind) feedbacks = feedbacks.filter(f => f.feedback_kind === filter.feedback_kind);
  if (filter?.applied !== undefined) feedbacks = feedbacks.filter(f => f.applied === filter.applied);
  return feedbacks.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function applyTraceMethodologyFeedback(feedbackId: string): TraceMethodologyFeedback | undefined {
  const fb = methodologyFeedback.get(feedbackId);
  if (!fb) return undefined;

  fb.applied = true;
  methodologyFeedback.set(feedbackId, fb);

  recordAudit("trace_grading.methodology_feedback_applied", {
    feedback_id: feedbackId,
    target: fb.target,
    target_id: fb.target_id,
    feedback_kind: fb.feedback_kind
  });

  return fb;
}

export function runTraceEvalFlywheelCycle(input: {
  trace_ids: Array<{ trace_id: string; trace_kind: TraceKind; task_id?: string; task_family?: string }>;
}): TraceEvalFlywheelCycle {
  const grades: TraceGradeResult[] = [];
  const regressions: TraceGradeRegressionVerdict[] = [];
  const allFeedback: TraceMethodologyFeedback[] = [];

  for (const trace of input.trace_ids) {
    const baselineGradeId = trace.task_family ? baselineGrades.get(trace.task_family) : undefined;
    const grade = gradeTrace({
      trace_id: trace.trace_id,
      trace_kind: trace.trace_kind,
      task_id: trace.task_id,
      task_family: trace.task_family,
      baseline_grade_id: baselineGradeId
    });
    grades.push(grade);

    const regression = detectTraceRegression(grade.grade_id);
    regressions.push(regression);

    const feedback = generateTraceMethodologyFeedback(grade.grade_id);
    allFeedback.push(...feedback);
  }

  const totalRegressions = regressions.filter(r => r.is_regression).length;
  const totalImprovements = grades.filter(g => (g.improvement_delta ?? 0) > 0.05).length;

  const cycle: TraceEvalFlywheelCycle = {
    cycle_id: createEntityId("tefcycle"),
    trace_ids: input.trace_ids.map(t => t.trace_id),
    grades,
    regression_verdicts: regressions,
    methodology_feedback: allFeedback,
    total_traces_graded: grades.length,
    total_regressions_detected: totalRegressions,
    total_improvements_detected: totalImprovements,
    cycle_completed_at: nowIso()
  };

  recordAudit("trace_grading.eval_flywheel_cycle", {
    cycle_id: cycle.cycle_id,
    total_traces: cycle.total_traces_graded,
    regressions: totalRegressions,
    improvements: totalImprovements,
    feedback_generated: allFeedback.length
  });

  return cycle;
}

export function getTraceGradingDiagnostics(): {
  total_grades: number;
  grades_by_verdict: Record<TraceGradeVerdict, number>;
  total_regressions: number;
  regressions_by_severity: Record<TraceGradeRegressionVerdict["severity"], number>;
  total_feedback: number;
  applied_feedback: number;
  criteria_count: number;
} {
  const grades = [...traceGrades.values()];
  const verdicts: Record<TraceGradeVerdict, number> = { excellent: 0, good: 0, acceptable: 0, poor: 0, failing: 0 };
  for (const g of grades) verdicts[g.verdict]++;

  const regs = [...regressionVerdicts.values()];
  const severities: Record<TraceGradeRegressionVerdict["severity"], number> = { none: 0, minor: 0, moderate: 0, major: 0, critical: 0 };
  for (const r of regs) severities[r.severity]++;

  const feedbacks = [...methodologyFeedback.values()];

  return {
    total_grades: grades.length,
    grades_by_verdict: verdicts,
    total_regressions: regs.filter(r => r.is_regression).length,
    regressions_by_severity: severities,
    total_feedback: feedbacks.length,
    applied_feedback: feedbacks.filter(f => f.applied).length,
    criteria_count: gradeCriteria.size
  };
}

export function runTraceGradingRegressionSuite(): {
  suite_id: string;
  results: Array<{ case_id: string; name: string; status: "pass" | "fail"; detail: string; error?: string }>;
  summary: { total: number; passed: number; failed: number; pass_rate: number };
} {
  const results: Array<{ case_id: string; name: string; status: "pass" | "fail"; detail: string; error?: string }> = [];

  const cases: Array<{ case_id: string; name: string; fn: () => string }> = [
    {
      case_id: "tg-reg-001",
      name: "default_criteria_initialized",
      fn: () => {
        gradeCriteria.clear();
        const criteria = initializeDefaultTraceGradeCriteria();
        if (criteria.length !== 6) throw new Error(`Expected 6 criteria, got ${criteria.length}`);
        return `Initialized ${criteria.length} criteria`;
      }
    },
    {
      case_id: "tg-reg-002",
      name: "grade_task_trace",
      fn: () => {
        const grade = gradeTrace({ trace_id: "test-trace-1", trace_kind: "task_trace" });
        if (!grade.grade_id) throw new Error("Grade ID not created");
        if (!["excellent", "good", "acceptable", "poor", "failing"].includes(grade.verdict)) throw new Error(`Invalid verdict: ${grade.verdict}`);
        if (grade.scores.length === 0) throw new Error("No scores generated");
        return `Graded: verdict=${grade.verdict}, score=${grade.weighted_total}`;
      }
    },
    {
      case_id: "tg-reg-003",
      name: "grade_tool_trace",
      fn: () => {
        const grade = gradeTrace({ trace_id: "test-tool-1", trace_kind: "tool_trace" });
        if (!grade.grade_id) throw new Error("Grade ID not created");
        return `Tool trace graded: verdict=${grade.verdict}`;
      }
    },
    {
      case_id: "tg-reg-004",
      name: "grade_computer_use_trace",
      fn: () => {
        const grade = gradeTrace({ trace_id: "test-cu-1", trace_kind: "computer_use_trace" });
        if (!grade.grade_id) throw new Error("Grade ID not created");
        return `Computer-use trace graded: verdict=${grade.verdict}`;
      }
    },
    {
      case_id: "tg-reg-005",
      name: "grade_verification_trace",
      fn: () => {
        const grade = gradeTrace({ trace_id: "test-verify-1", trace_kind: "verification_trace" });
        if (!grade.grade_id) throw new Error("Grade ID not created");
        return `Verification trace graded: verdict=${grade.verdict}`;
      }
    },
    {
      case_id: "tg-reg-006",
      name: "regression_detection_on_verdict_drop",
      fn: () => {
        const grade1 = gradeTrace({
          trace_id: "test-regression-1",
          trace_kind: "task_trace",
          custom_scores: [
            { criterion_name: "task_completion", score: 1.0 },
            { criterion_name: "verification_pass_rate", score: 1.0 },
            { criterion_name: "tool_usage_efficiency", score: 0.9 },
            { criterion_name: "cost_efficiency", score: 0.8 },
            { criterion_name: "safety_compliance", score: 1.0 },
            { criterion_name: "replay_determinism", score: 0.9 }
          ]
        });

        const grade2 = gradeTrace({
          trace_id: "test-regression-1",
          trace_kind: "task_trace",
          baseline_grade_id: grade1.grade_id,
          custom_scores: [
            { criterion_name: "task_completion", score: 0.2 },
            { criterion_name: "verification_pass_rate", score: 0.1 },
            { criterion_name: "tool_usage_efficiency", score: 0.1 },
            { criterion_name: "cost_efficiency", score: 0.1 },
            { criterion_name: "safety_compliance", score: 0.5 },
            { criterion_name: "replay_determinism", score: 0.1 }
          ]
        });

        if (!grade2.regression_detected) throw new Error(`Expected regression detected, got verdict=${grade2.verdict}, baseline=${grade2.baseline_verdict}`);
        return `Regression detected: ${grade2.regression_detail}`;
      }
    },
    {
      case_id: "tg-reg-007",
      name: "methodology_feedback_generation",
      fn: () => {
        const grade = gradeTrace({
          trace_id: "test-fb-1",
          trace_kind: "task_trace",
          task_family: "test_family",
          custom_scores: [
            { criterion_name: "task_completion", score: 0.95 },
            { criterion_name: "verification_pass_rate", score: 0.95 },
            { criterion_name: "tool_usage_efficiency", score: 0.9 },
            { criterion_name: "cost_efficiency", score: 0.85 },
            { criterion_name: "safety_compliance", score: 1.0 },
            { criterion_name: "replay_determinism", score: 0.9 }
          ]
        });
        const feedback = generateTraceMethodologyFeedback(grade.grade_id);
        if (feedback.length === 0) throw new Error("Expected feedback for excellent grade");
        return `Generated ${feedback.length} feedback items`;
      }
    },
    {
      case_id: "tg-reg-008",
      name: "eval_flywheel_cycle",
      fn: () => {
        const cycle = runTraceEvalFlywheelCycle({
          trace_ids: [
            { trace_id: "cycle-1", trace_kind: "task_trace" },
            { trace_id: "cycle-2", trace_kind: "tool_trace" },
            { trace_id: "cycle-3", trace_kind: "verification_trace" }
          ]
        });
        if (cycle.total_traces_graded !== 3) throw new Error(`Expected 3 graded, got ${cycle.total_traces_graded}`);
        if (cycle.grades.length !== 3) throw new Error(`Expected 3 grades, got ${cycle.grades.length}`);
        return `Cycle: ${cycle.total_traces_graded} graded, ${cycle.total_regressions_detected} regressions, ${cycle.total_improvements_detected} improvements`;
      }
    },
    {
      case_id: "tg-reg-009",
      name: "diagnostics_available",
      fn: () => {
        const diag = getTraceGradingDiagnostics();
        if (typeof diag.total_grades !== "number") throw new Error("Invalid diagnostics");
        if (typeof diag.criteria_count !== "number") throw new Error("Invalid criteria count");
        return `Diagnostics: ${diag.total_grades} grades, ${diag.total_regressions} regressions, ${diag.criteria_count} criteria`;
      }
    },
    {
      case_id: "tg-reg-010",
      name: "custom_criteria_registration",
      fn: () => {
        const criterion = registerTraceGradeCriterion({
          name: "custom_test_criterion",
          description: "A custom test criterion",
          weight: 0.15,
          scoring_method: "heuristic",
          pass_threshold: 0.5,
          perfect_score: 1.0
        });
        if (!criterion.criterion_id) throw new Error("Criterion ID not created");
        if (criterion.name !== "custom_test_criterion") throw new Error("Criterion name not set");
        return `Custom criterion registered: ${criterion.criterion_id}`;
      }
    },
    {
      case_id: "tg-reg-011",
      name: "apply_feedback",
      fn: () => {
        const grade = gradeTrace({
          trace_id: "test-apply-fb",
          trace_kind: "task_trace",
          task_family: "apply_fb_family",
          custom_scores: [
            { criterion_name: "task_completion", score: 0.95 },
            { criterion_name: "verification_pass_rate", score: 0.95 },
            { criterion_name: "tool_usage_efficiency", score: 0.9 },
            { criterion_name: "cost_efficiency", score: 0.85 },
            { criterion_name: "safety_compliance", score: 1.0 },
            { criterion_name: "replay_determinism", score: 0.9 }
          ]
        });
        const feedback = generateTraceMethodologyFeedback(grade.grade_id);
        if (feedback.length === 0) return "No feedback to apply (no matching templates)";
        const applied = applyTraceMethodologyFeedback(feedback[0].feedback_id);
        if (!applied?.applied) throw new Error("Feedback not applied");
        return `Feedback applied: ${feedback[0].feedback_kind}`;
      }
    },
    {
      case_id: "tg-reg-012",
      name: "deterministic_first_grading",
      fn: () => {
        const criteria = ensureCriteria();
        const deterministicCount = criteria.filter(c => c.scoring_method === "deterministic").length;
        const heuristicCount = criteria.filter(c => c.scoring_method === "heuristic").length;
        if (deterministicCount === 0) throw new Error("No deterministic criteria - must have deterministic checks first");
        if (deterministicCount <= heuristicCount) throw new Error("Deterministic criteria should outnumber heuristic");
        return `Deterministic: ${deterministicCount}, Heuristic: ${heuristicCount}, Eval: ${criteria.filter(c => c.scoring_method === "eval_based").length}`;
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
    suite_id: createEntityId("tgsuite"),
    results,
    summary: { total: results.length, passed, failed, pass_rate: results.length > 0 ? Number((passed / results.length).toFixed(4)) : 0 }
  };
}
