import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export interface ExperimentComparisonReport {
  report_id: string;
  experiment_id: string;
  winner_candidate_id: string;
  loser_candidate_ids: string[];
  metrics: {
    winner_score: number;
    loser_scores: Array<{ candidate_id: string; score: number }>;
    improvement_percent: number;
    confidence_level: number;
  };
  recommendation: string;
  auto_promote_eligible: boolean;
  created_at: string;
}

export interface AutoPromotionResult {
  promotion_id: string;
  asset_type: "skill" | "template" | "playbook" | "method";
  asset_id: string;
  source: "experiment_winner" | "reuse_confidence_low" | "learning_factory";
  lineage_id: string;
  promoted: boolean;
  reason: string;
}

export interface ReuseConfidenceAssessment {
  asset_type: "skill" | "template" | "playbook";
  asset_id: string;
  reuse_count: number;
  success_rate: number;
  confidence_score: number;
  needs_experiment: boolean;
  reason: string;
}

export function autoPromoteExperimentWinner(experimentId: string): AutoPromotionResult {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`ExperimentRun not found: ${experimentId}`);

  if (experiment.status !== "completed") {
    return {
      promotion_id: createEntityId("autopromo"),
      asset_type: "skill",
      asset_id: experiment.experiment_id,
      source: "experiment_winner",
      lineage_id: "",
      promoted: false,
      reason: `Experiment not completed (status: ${experiment.status})`
    };
  }

  const candidates = experiment.candidates ?? [];
  if (candidates.length === 0) {
    return {
      promotion_id: createEntityId("autopromo"),
      asset_type: "skill",
      asset_id: experiment.experiment_id,
      source: "experiment_winner",
      lineage_id: "",
      promoted: false,
      reason: "No candidates found"
    };
  }

  const sorted = [...candidates].sort((a, b) => {
    const scoreA = a.success_metric_value ?? 0;
    const scoreB = b.success_metric_value ?? 0;
    return scoreB - scoreA;
  });

  const winner = sorted[0];
  const winnerCandidateId = winner.candidate_id ?? winner.name ?? "unknown";
  const winnerScore = winner.success_metric_value ?? 0;

  const loserScores = sorted.slice(1).map(v => ({
    candidate_id: v.candidate_id ?? v.name ?? "unknown",
    score: v.success_metric_value ?? 0
  }));

  const improvementPercent = loserScores.length > 0
    ? ((winnerScore - Math.max(...loserScores.map(l => l.score))) / (Math.max(...loserScores.map(l => l.score)) || 1)) * 100
    : 100;

  const confidenceLevel = Math.min(1, winnerScore * (1 + improvementPercent / 200));

  const autoPromoteEligible = winnerScore >= 0.7 && improvementPercent >= 5 && confidenceLevel >= 0.6;

  const report: ExperimentComparisonReport = {
    report_id: createEntityId("expreport"),
    experiment_id: experimentId,
    winner_candidate_id: winnerCandidateId,
    loser_candidate_ids: loserScores.map(l => l.candidate_id),
    metrics: {
      winner_score: winnerScore,
      loser_scores: loserScores,
      improvement_percent: Math.round(improvementPercent * 100) / 100,
      confidence_level: Math.round(confidenceLevel * 100) / 100
    },
    recommendation: autoPromoteEligible
      ? `Winner candidate '${winnerCandidateId}' (score: ${winnerScore.toFixed(3)}) outperforms alternatives by ${improvementPercent.toFixed(1)}%. Recommend auto-promotion.`
      : `Winner candidate '${winnerCandidateId}' (score: ${winnerScore.toFixed(3)}) does not meet auto-promotion thresholds. Manual review recommended.`,
    auto_promote_eligible: autoPromoteEligible,
    created_at: nowIso()
  };

  recordAudit("learning_factory.experiment_comparison", {
    report_id: report.report_id,
    experiment_id: experimentId,
    winner_candidate_id: winnerCandidateId,
    winner_score: winnerScore,
    improvement_percent: improvementPercent,
    auto_promote_eligible: autoPromoteEligible
  });

  if (autoPromoteEligible) {
    const lineage = autoCreateLineageFromPromotionInternal(
      "skill",
      winnerCandidateId,
      "experiment_winner",
      { experiment_id: experimentId, winner_score: winnerScore, report_id: report.report_id }
    );

    recordAudit("learning_factory.auto_promoted", {
      experiment_id: experimentId,
      winner_candidate_id: winnerCandidateId,
      lineage_id: lineage.lineage_id,
      winner_score: winnerScore
    });

    return {
      promotion_id: report.report_id,
      asset_type: "skill",
      asset_id: winnerCandidateId,
      source: "experiment_winner",
      lineage_id: lineage.lineage_id,
      promoted: true,
      reason: report.recommendation
    };
  }

  return {
    promotion_id: report.report_id,
    asset_type: "skill",
    asset_id: winnerCandidateId,
    source: "experiment_winner",
    lineage_id: "",
    promoted: false,
    reason: report.recommendation
  };
}

function autoCreateLineageFromPromotionInternal(
  assetType: "skill" | "template" | "playbook" | "method",
  assetId: string,
  promotionSource: string,
  snapshot: Record<string, unknown>
): { lineage_id: string; version: number } {
  const existingLineages = [...store.methodLineages.values()]
    .filter(l => l.asset_type === assetType && l.asset_id === assetId)
    .sort((a, b) => b.version - a.version);

  const version = existingLineages.length > 0 ? existingLineages[0].version + 1 : 1;
  const parentLineageId = existingLineages.length > 0 ? existingLineages[0].lineage_id : undefined;

  const lineage = {
    lineage_id: createEntityId("mlin"),
    asset_type: assetType,
    asset_id: assetId,
    version,
    mutation_kind: promotionSource as "experiment_winner" | "learning_factory_promotion" | "manual_edit",
    mutation_reason: `Auto-promoted from ${promotionSource}`,
    snapshot,
    parent_lineage_id: parentLineageId,
    is_active: true,
    tags: [] as string[],
    created_at: nowIso(),
    created_by: "system:auto_promotion"
  };

  store.methodLineages.set(lineage.lineage_id, lineage);

  return { lineage_id: lineage.lineage_id, version };
}

export function assessReuseConfidence(
  assetType: "skill" | "template" | "playbook",
  assetId: string
): ReuseConfidenceAssessment {
  let reuseCount = 0;
  let successCount = 0;

  if (assetType === "skill") {
    const skill = store.canonicalSkills.get(assetId);
    if (!skill) {
      return {
        asset_type: assetType,
        asset_id: assetId,
        reuse_count: 0,
        success_rate: 0,
        confidence_score: 0,
        needs_experiment: true,
        reason: "Skill not found"
      };
    }
    const skillAudits = store.audits.toArray().filter(a =>
      a.action?.includes("skill") && (a.payload as Record<string, unknown>)?.skill_id === assetId
    );
    reuseCount = skillAudits.length;
  } else if (assetType === "template") {
    const template = store.taskTemplates.get(assetId);
    if (!template) {
      return {
        asset_type: assetType,
        asset_id: assetId,
        reuse_count: 0,
        success_rate: 0,
        confidence_score: 0,
        needs_experiment: true,
        reason: "Template not found"
      };
    }
  }

  const successRate = reuseCount > 0 ? successCount / reuseCount : 0;
  const confidenceScore = Math.min(1, reuseCount * 0.1 + successRate * 0.5);
  const needsExperiment = confidenceScore < 0.3 && reuseCount < 5;

  return {
    asset_type: assetType,
    asset_id: assetId,
    reuse_count: reuseCount,
    success_rate: successRate,
    confidence_score: Math.round(confidenceScore * 100) / 100,
    needs_experiment: needsExperiment,
    reason: needsExperiment
      ? `Low confidence (score: ${confidenceScore.toFixed(2)}, reuse: ${reuseCount}). Experiment recommended.`
      : `Adequate confidence (score: ${confidenceScore.toFixed(2)}, reuse: ${reuseCount}). No experiment needed.`
  };
}

export function triggerExperimentsForLowConfidence(): Array<{
  asset_type: "skill" | "template" | "playbook";
  asset_id: string;
  experiment_triggered: boolean;
  reason: string;
}> {
  const results: Array<{
    asset_type: "skill" | "template" | "playbook";
    asset_id: string;
    experiment_triggered: boolean;
    reason: string;
  }> = [];

  for (const skill of store.canonicalSkills.values()) {
    const assessment = assessReuseConfidence("skill", skill.skill_id);
    if (assessment.needs_experiment) {
      results.push({
        asset_type: "skill",
        asset_id: skill.skill_id,
        experiment_triggered: true,
        reason: assessment.reason
      });

      recordAudit("learning_factory.auto_experiment_triggered", {
        asset_type: "skill",
        asset_id: skill.skill_id,
        confidence_score: assessment.confidence_score
      });
    }
  }

  for (const template of store.taskTemplates.values()) {
    const assessment = assessReuseConfidence("template", template.template_id);
    if (assessment.needs_experiment) {
      results.push({
        asset_type: "template",
        asset_id: template.template_id,
        experiment_triggered: false,
        reason: assessment.reason
      });
    }
  }

  return results;
}

export function generateExperimentComparisonReport(experimentId: string): ExperimentComparisonReport {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`ExperimentRun not found: ${experimentId}`);

  const candidates = experiment.candidates ?? [];
  const sorted = [...candidates].sort((a, b) => (b.success_metric_value ?? 0) - (a.success_metric_value ?? 0));

  const winner = sorted[0] ?? { candidate_id: "none", success_metric_value: 0 };
  const winnerScore = winner.success_metric_value ?? 0;
  const loserScores = sorted.slice(1).map(v => ({
    candidate_id: v.candidate_id ?? v.name ?? "unknown",
    score: v.success_metric_value ?? 0
  }));

  const improvementPercent = loserScores.length > 0
    ? ((winnerScore - Math.max(...loserScores.map(l => l.score))) / (Math.max(...loserScores.map(l => l.score)) || 1)) * 100
    : 0;

  const confidenceLevel = Math.min(1, winnerScore * (1 + improvementPercent / 200));

  return {
    report_id: createEntityId("expreport"),
    experiment_id: experimentId,
    winner_candidate_id: winner.candidate_id ?? winner.name ?? "unknown",
    loser_candidate_ids: loserScores.map(l => l.candidate_id),
    metrics: {
      winner_score: winnerScore,
      loser_scores: loserScores,
      improvement_percent: Math.round(improvementPercent * 100) / 100,
      confidence_level: Math.round(confidenceLevel * 100) / 100
    },
    recommendation: winnerScore >= 0.7
      ? `Winner: ${winner.candidate_id ?? winner.name} with score ${winnerScore.toFixed(3)}`
      : `No candidate meets quality threshold. Best: ${winner.candidate_id ?? winner.name} (${winnerScore.toFixed(3)})`,
    auto_promote_eligible: winnerScore >= 0.7 && improvementPercent >= 5,
    created_at: nowIso()
  };
}
