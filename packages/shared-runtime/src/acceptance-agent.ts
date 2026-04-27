import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type AcceptanceVerdictKind = "accepted" | "accepted_with_notes" | "revise_and_retry" | "blocked";

export interface AcceptanceFinding {
  finding_id: string;
  category: "deterministic" | "semantic" | "safety" | "completeness" | "quality";
  severity: "info" | "warning" | "critical";
  description: string;
  evidence_ref?: string;
}

export interface AcceptanceReview {
  review_id: string;
  task_id: string;
  plan_id?: string;
  reviewer_kind: "acceptance_agent" | "deterministic_checklist" | "reconciliation" | "human";
  findings: AcceptanceFinding[];
  deterministic_passed: boolean;
  semantic_verdict?: AcceptanceVerdictKind;
  risk_level: "low" | "medium" | "high" | "critical";
  escalation_required: boolean;
  reviewed_at: string;
}

export interface AcceptanceVerdict {
  verdict_id: string;
  task_id: string;
  review_id: string;
  verdict: AcceptanceVerdictKind;
  rationale: string;
  missing_items: string[];
  quality_concerns: string[];
  suggested_rerun_scope?: string;
  risk_level: "low" | "medium" | "high" | "critical";
  can_proceed: boolean;
  requires_human_approval: boolean;
  issued_at: string;
}

const acceptanceReviews = new Map<string, AcceptanceReview>();
const acceptanceVerdicts = new Map<string, AcceptanceVerdict>();

export function createAcceptanceReview(input: {
  task_id: string;
  plan_id?: string;
  reviewer_kind: AcceptanceReview["reviewer_kind"];
  findings: AcceptanceFinding[];
  deterministic_passed: boolean;
  semantic_verdict?: AcceptanceVerdictKind;
  risk_level: AcceptanceReview["risk_level"];
}): AcceptanceReview {
  const escalationRequired = input.risk_level === "high" || input.risk_level === "critical";

  const review: AcceptanceReview = {
    review_id: createEntityId("accrev"),
    task_id: input.task_id,
    plan_id: input.plan_id,
    reviewer_kind: input.reviewer_kind,
    findings: input.findings,
    deterministic_passed: input.deterministic_passed,
    semantic_verdict: input.semantic_verdict,
    risk_level: input.risk_level,
    escalation_required: escalationRequired,
    reviewed_at: nowIso()
  };

  acceptanceReviews.set(review.review_id, review);
  recordAudit("acceptance.review_created", { review_id: review.review_id, task_id: input.task_id, deterministic: input.deterministic_passed, risk: input.risk_level });
  return review;
}

export function issueAcceptanceVerdict(input: {
  task_id: string;
  review_id: string;
  verdict: AcceptanceVerdictKind;
  rationale: string;
  missing_items?: string[];
  quality_concerns?: string[];
  suggested_rerun_scope?: string;
  risk_level: AcceptanceVerdict["risk_level"];
}): AcceptanceVerdict {
  const review = acceptanceReviews.get(input.review_id);

  const canProceed = input.verdict === "accepted" || input.verdict === "accepted_with_notes";
  const requiresHuman = input.risk_level === "high" || input.risk_level === "critical";

  const verdict: AcceptanceVerdict = {
    verdict_id: createEntityId("accvrd"),
    task_id: input.task_id,
    review_id: input.review_id,
    verdict: input.verdict,
    rationale: input.rationale,
    missing_items: input.missing_items ?? [],
    quality_concerns: input.quality_concerns ?? [],
    suggested_rerun_scope: input.suggested_rerun_scope,
    risk_level: input.risk_level,
    can_proceed: canProceed && !(requiresHuman && !review?.deterministic_passed),
    requires_human_approval: requiresHuman,
    issued_at: nowIso()
  };

  acceptanceVerdicts.set(verdict.verdict_id, verdict);
  recordAudit("acceptance.verdict_issued", { verdict_id: verdict.verdict_id, task_id: input.task_id, verdict: input.verdict, can_proceed: verdict.can_proceed });
  return verdict;
}

export function getAcceptanceReview(reviewId: string): AcceptanceReview | undefined {
  return acceptanceReviews.get(reviewId);
}

export function getAcceptanceVerdict(verdictId: string): AcceptanceVerdict | undefined {
  return acceptanceVerdicts.get(verdictId);
}

export function listAcceptanceReviewsForTask(taskId: string): AcceptanceReview[] {
  return [...acceptanceReviews.values()].filter(r => r.task_id === taskId).sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));
}

export function listAcceptanceVerdictsForTask(taskId: string): AcceptanceVerdict[] {
  return [...acceptanceVerdicts.values()].filter(v => v.task_id === taskId).sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}

export function getCompletionPathStatus(taskId: string): {
  has_deterministic_checklist: boolean;
  has_acceptance_review: boolean;
  has_reconciliation: boolean;
  has_done_gate: boolean;
  can_mark_done: boolean;
} {
  const reviews = listAcceptanceReviewsForTask(taskId);
  const verdicts = listAcceptanceVerdictsForTask(taskId);

  const hasDeterministic = reviews.some(r => r.reviewer_kind === "deterministic_checklist" && r.deterministic_passed);
  const hasAcceptance = reviews.some(r => r.reviewer_kind === "acceptance_agent");
  const hasReconciliation = reviews.some(r => r.reviewer_kind === "reconciliation");
  const hasDoneGate = verdicts.some(v => v.can_proceed);

  const canMarkDone = hasDeterministic && hasAcceptance && hasReconciliation && hasDoneGate;

  return {
    has_deterministic_checklist: hasDeterministic,
    has_acceptance_review: hasAcceptance,
    has_reconciliation: hasReconciliation,
    has_done_gate: hasDoneGate,
    can_mark_done: canMarkDone
  };
}
