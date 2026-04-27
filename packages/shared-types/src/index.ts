import { randomUUID } from "node:crypto";
import { z } from "zod";

export const TaskTypeSchema = z.enum(["one_off", "long_running", "recurring", "scheduled"]);
export const DepartmentSchema = z.enum(["engineering", "qa", "marketing", "sales", "hr", "finance", "ops", "general"]);
export const PrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const TaskStatusSchema = z.enum([
  "created",
  "queued",
  "planning",
  "running",
  "waiting_approval",
  "waiting_event",
  "paused",
  "corrected",
  "redirected",
  "stopping",
  "resuming",
  "completed",
  "failed",
  "cancelled",
  "expired"
]);

export const InitiatorSchema = z.object({
  tenant_id: z.string(),
  user_id: z.string(),
  channel: z.string()
});

export const OwnerSchema = z.object({
  user_id: z.string().optional(),
  team_id: z.string().optional()
});

export const PlanStepSchema = z.object({
  step_id: z.string(),
  title: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "skipped"]),
  owner: z.string().optional()
});

export const CompletionContractSchema = z.object({
  goal: z.string(),
  completion_criteria: z.array(z.string()).default([]),
  acceptance_tests: z.array(z.string()).default([]),
  required_artifacts: z.array(z.string()).default([]),
  approval_requirements: z.array(z.string()).default([]),
  deadline_or_sla: z.string().optional()
});

export const ChecklistContractSchema = z.object({
  pre_run_checklist: z.array(z.string()).default([]),
  in_run_checklist: z.array(z.string()).default([]),
  pre_complete_checklist: z.array(z.string()).default([]),
  owner_checklist: z.array(z.string()).default([]),
  auto_check_items: z.array(z.string()).default([]),
  manual_check_items: z.array(z.string()).default([])
});

export const ReconciliationContractSchema = z.object({
  expected_actions: z.array(z.string()).default([]),
  expected_external_state: z.array(z.string()).default([]),
  verification_sources: z.array(z.string()).default([]),
  idempotency_keys: z.array(z.string()).default([]),
  compensation_rules: z.array(z.string()).default([]),
  reconcile_timeout_sec: z.number().int().optional()
});

export const VerificationModeSchema = z.enum(["light", "standard", "strict"]);
export const VerificationContractSchema = z.object({
  verification_required: z.boolean().default(false),
  verification_mode: VerificationModeSchema.default("standard"),
  verification_scope: z.array(z.string()).default([]),
  verification_inputs: z.array(z.string()).default([]),
  verification_pass_rules: z.array(z.string()).default([]),
  verification_fail_rules: z.array(z.string()).default([]),
  verification_retry_policy: z.object({
    max_retry: z.number().int().default(0)
  }).optional()
});

export const StopModeSchema = z.enum(["graceful_stop", "cancel_after_checkpoint", "force_kill"]);
export const StopContractSchema = z.object({
  can_stop: z.boolean().default(true),
  stop_mode: StopModeSchema.default("graceful_stop"),
  stop_requested_at: z.string().datetime().nullable().optional(),
  stop_requested_by: z.string().nullable().optional(),
  stop_reason: z.string().nullable().optional(),
  safe_stop_checkpoint: z.string().optional(),
  stop_timeout_sec: z.number().int().default(120),
  partial_artifact_policy: z.enum(["keep", "mark_partial", "discard"]).default("mark_partial"),
  resume_supported: z.boolean().default(true)
});

export const ArtifactSchema = z.object({
  artifact_id: z.string(),
  task_id: z.string(),
  name: z.string(),
  kind: z.enum(["report", "code", "qa_result", "sales_note", "hr_note", "finance_note", "checkpoint", "generic"]),
  status: z.enum(["draft", "ready", "partial"]).default("draft"),
  uri: z.string().optional(),
  content: z.string().optional(),
  created_at: z.string().datetime()
});

export const CheckpointSchema = z.object({
  checkpoint_id: z.string(),
  task_id: z.string(),
  stage: z.string(),
  summary: z.string(),
  created_at: z.string().datetime()
});

export const MemoryKindSchema = z.enum(["session", "fact", "semantic", "methodology", "evaluation"]);
export const MemoryItemSchema = z.object({
  memory_id: z.string(),
  task_id: z.string().optional(),
  kind: MemoryKindSchema,
  title: z.string(),
  content: z.string(),
  fingerprint: z.string().optional(),
  source_task_count: z.number().int().default(1),
  tags: z.array(z.string()).default([]),
  created_at: z.string().datetime()
});

export const MemoryDirectoryKindSchema = z.enum([
  "department",
  "system",
  "project",
  "task_family",
  "operational_domain"
]);
export const MemoryDirectorySchema = z.object({
  directory_id: z.string(),
  kind: MemoryDirectoryKindSchema,
  key: z.string(),
  title: z.string(),
  description: z.string().optional(),
  parent_directory_id: z.string().optional(),
  department: z.string().optional(),
  owners: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  document_count: z.number().int().nonnegative().default(0),
  child_directory_count: z.number().int().nonnegative().default(0),
  freshness_window_days: z.number().int().default(90),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const MemoryDocumentKindSchema = z.enum([
  "sop",
  "troubleshooting",
  "decision_record",
  "learned_playbook_reference",
  "methodology_summary",
  "tool_usage_guide",
  "domain_notes"
]);
export const MemoryDocumentSchema = z.object({
  document_id: z.string(),
  directory_id: z.string(),
  kind: MemoryDocumentKindSchema,
  key: z.string(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  department: z.string().optional(),
  task_family: z.string().optional(),
  owners: z.array(z.string()).default([]),
  source_artifact_ids: z.array(z.string()).default([]),
  source_evidence_ids: z.array(z.string()).default([]),
  promotion_status: z.enum(["draft", "approved", "retired"]).default("draft"),
  freshness_window_days: z.number().int().default(90),
  tags: z.array(z.string()).default([]),
  section_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const MemoryDocumentSectionSchema = z.object({
  section_id: z.string(),
  document_id: z.string(),
  directory_id: z.string(),
  parent_section_id: z.string().optional(),
  title: z.string(),
  content: z.string(),
  section_index: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  source_artifact_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const MemoryRetrievalStageSchema = z.enum([
  "direct_address",
  "metadata_filter",
  "lexical_hit",
  "semantic_hit",
  "rerank_promotion"
]);
export const MemoryRetrievalTraceSchema = z.object({
  trace_id: z.string(),
  task_id: z.string().optional(),
  query: z.string(),
  stage: MemoryRetrievalStageSchema,
  directory_id: z.string().optional(),
  document_id: z.string().optional(),
  section_id: z.string().optional(),
  matched: z.boolean().default(false),
  score: z.number().default(0),
  created_at: z.string().datetime()
});

export const MemoryModeSchema = z.enum([
  "durable_retrieval",
  "hybrid_retrieval_ttt",
  "ttt_first_specialist"
]);
export const MemoryStrategyRecommendationSchema = z.object({
  recommendation_id: z.string(),
  task_id: z.string().optional(),
  task_family: z.string().optional(),
  department: z.string().optional(),
  recommended_mode: MemoryModeSchema,
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  expected_benefit: z.string(),
  fallback_mode: MemoryModeSchema,
  routing_signals: z.object({
    context_length: z.enum(["short", "medium", "long", "very_long"]).optional(),
    memory_hit_quality: z.enum(["high", "medium", "low", "none"]).optional(),
    reuse_confidence: z.number().min(0).max(1).optional(),
    has_playbook: z.boolean().optional(),
    has_template: z.boolean().optional(),
    is_replayable: z.boolean().optional(),
    has_completion_criteria: z.boolean().optional(),
    model_route_type: z.enum(["self_hosted", "vendor_hosted", "hybrid"]).optional(),
    expected_task_value: z.enum(["low", "medium", "high", "critical"]).optional()
  }),
  created_at: z.string().datetime()
});
export const TTTEligibilityVerdictSchema = z.enum([
  "approved",
  "downgraded",
  "denied"
]);
export const TTTEligibilityGateResultSchema = z.object({
  gate_id: z.string(),
  recommendation_id: z.string(),
  task_id: z.string().optional(),
  verdict: TTTEligibilityVerdictSchema,
  original_mode: MemoryModeSchema,
  resolved_mode: MemoryModeSchema,
  checks: z.object({
    model_route_eligible: z.boolean(),
    task_family_eligible: z.boolean(),
    budget_eligible: z.boolean(),
    policy_eligible: z.boolean(),
    replay_eval_eligible: z.boolean(),
    not_vendor_hosted: z.boolean(),
    not_privileged_planner: z.boolean(),
    has_completion_criteria: z.boolean()
  }),
  denial_reason: z.string().optional(),
  downgrade_reason: z.string().optional(),
  budget_remaining: z.number().optional(),
  created_at: z.string().datetime()
});
export const TTTAdaptationRunSchema = z.object({
  run_id: z.string(),
  gate_id: z.string(),
  task_id: z.string().optional(),
  session_id: z.string().optional(),
  status: z.enum(["pending", "baseline_running", "baseline_complete", "adapted_running", "adapted_complete", "delta_analyzed", "completed", "failed", "rolled_back"]),
  baseline_result: z.record(z.unknown()).optional(),
  adapted_result: z.record(z.unknown()).optional(),
  delta_analysis: z.object({
    improvement_score: z.number(),
    quality_delta: z.number(),
    latency_delta_ms: z.number(),
    token_cost_delta: z.number(),
    verdict: z.enum(["improved", "neutral", "regressed"]),
    details: z.string()
  }).optional(),
  budget_consumed: z.number().default(0),
  budget_limit: z.number().default(0),
  rollback_ready: z.boolean().default(false),
  rollback_artifact_id: z.string().optional(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  error: z.string().optional()
});
export const TTTDistillationRecordSchema = z.object({
  distillation_id: z.string(),
  adaptation_run_id: z.string(),
  task_id: z.string().optional(),
  status: z.enum(["pending", "distilling", "completed", "failed"]),
  targets: z.array(z.enum(["routing_rules", "prompts", "playbooks", "methodology_memory", "task_templates", "eval_insights"])),
  distilled_artifacts: z.array(z.object({
    target: z.string(),
    artifact_id: z.string(),
    change_description: z.string(),
    created_at: z.string().datetime()
  })),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().optional()
});
export const TTTBudgetLedgerSchema = z.object({
  ledger_id: z.string(),
  total_budget: z.number(),
  consumed: z.number(),
  remaining: z.number(),
  runs: z.array(z.object({
    run_id: z.string(),
    amount: z.number(),
    timestamp: z.string().datetime()
  })),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  created_at: z.string().datetime()
});

export const LearningFactoryStageSchema = z.enum([
  "distill",
  "sanitize",
  "cluster_and_deduplicate",
  "replay_eval",
  "policy_review",
  "canary_adoption",
  "general_promotion",
  "rollback"
]);
export const LearningFactoryPipelineStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "rolled_back"
]);
export const LearningFactoryPipelineSchema = z.object({
  pipeline_id: z.string(),
  source_task_id: z.string(),
  source_artifact_type: z.enum(["methodology", "skill_candidate", "task_template"]),
  source_artifact_id: z.string(),
  current_stage: LearningFactoryStageSchema.default("distill"),
  status: LearningFactoryPipelineStatusSchema.default("pending"),
  stages: z.array(z.object({
    stage: LearningFactoryStageSchema,
    status: LearningFactoryPipelineStatusSchema.default("pending"),
    started_at: z.string().datetime().optional(),
    completed_at: z.string().datetime().optional(),
    result: z.record(z.unknown()).default({}),
    error: z.string().optional()
  })).default([]),
  canary_task_ids: z.array(z.string()).default([]),
  canary_pass_count: z.number().int().nonnegative().default(0),
  canary_fail_count: z.number().int().nonnegative().default(0),
  rollback_reason: z.string().optional(),
  promoted_artifact_id: z.string().optional(),
  fingerprint: z.string().optional(),
  department: z.string().optional(),
  task_family: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const LearningFactoryBacklogItemSchema = z.object({
  backlog_id: z.string(),
  source_type: z.enum([
    "verifier_miss",
    "user_correction",
    "fallback_to_local",
    "reuse_navigation_reopen",
    "replay_eval_failure",
    "rollback_event"
  ]),
  source_task_id: z.string().optional(),
  target_artifact_type: z.enum(["skill", "template", "script", "cli_wrapper"]).optional(),
  target_artifact_id: z.string().optional(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["open", "in_progress", "resolved", "dismissed"]).default("open"),
  pipeline_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const EventLedgerEntryKindSchema = z.enum([
  "task_created",
  "task_state_changed",
  "capability_resolved",
  "execution_started",
  "execution_completed",
  "checklist_completed",
  "verifier_completed",
  "reconciliation_completed",
  "evidence_node_produced",
  "evidence_node_verdict",
  "completion_engine_evaluated",
  "acceptance_review_completed",
  "done_gate_evaluated",
  "memory_captured",
  "skill_candidate_created",
  "task_template_upserted",
  "learning_pipeline_created",
  "learning_pipeline_stage_advanced",
  "learning_pipeline_completed",
  "learning_pipeline_failed",
  "learning_pipeline_rolled_back",
  "policy_decision",
  "audit_event",
  "artifact_stored",
  "outbox_pending",
  "outbox_sent"
]);
export const EventLedgerEntrySchema = z.object({
  event_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  kind: EventLedgerEntryKindSchema,
  aggregate_type: z.string(),
  aggregate_id: z.string(),
  payload: z.record(z.unknown()).default({}),
  metadata: z.record(z.string()).default({}),
  correlation_id: z.string().optional(),
  causation_id: z.string().optional(),
  occurred_at: z.string().datetime(),
  recorded_at: z.string().datetime()
});
export const EventProjectionSchema = z.object({
  projection_id: z.string(),
  projection_type: z.string(),
  aggregate_type: z.string(),
  aggregate_id: z.string(),
  last_sequence_number: z.number().int().nonnegative().default(0),
  state: z.record(z.unknown()).default({}),
  updated_at: z.string().datetime()
});
export const OutboxEntrySchema = z.object({
  outbox_id: z.string(),
  event_id: z.string(),
  target: z.enum(["cloud_sync", "external_notification", "webhook"]),
  status: z.enum(["pending", "sent", "failed", "skipped"]).default("pending"),
  payload: z.record(z.unknown()).default({}),
  attempts: z.number().int().nonnegative().default(0),
  last_attempt_at: z.string().datetime().optional(),
  error: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const PolicyDecisionVerdictSchema = z.enum(["allow", "deny", "conditional"]);
export const PolicyDecisionSchema = z.object({
  decision_id: z.string(),
  request_id: z.string(),
  pep_id: z.string(),
  subject: z.string(),
  action: z.string(),
  resource: z.string(),
  scope: z.string().optional(),
  sandbox_tier: z.enum(["host_readonly", "guarded_mutation", "isolated_mutation"]).optional(),
  risk_level: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  verdict: PolicyDecisionVerdictSchema,
  conditions: z.array(z.string()).default([]),
  reasoning: z.string().optional(),
  policy_rules_matched: z.array(z.string()).default([]),
  correlation_id: z.string().optional(),
  task_id: z.string().optional(),
  decided_at: z.string().datetime()
});
export const PolicyEnforcementActionSchema = z.object({
  enforcement_id: z.string(),
  decision_id: z.string(),
  pep_id: z.string(),
  action: z.string(),
  resource: z.string(),
  enforcement_result: z.enum(["executed", "blocked", "condition_applied", "deferred"]).default("executed"),
  evidence_node_id: z.string().optional(),
  task_id: z.string().optional(),
  enforced_at: z.string().datetime()
});
export const PolicyRuleSchema = z.object({
  rule_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  effect: z.enum(["allow", "deny"]),
  priority: z.number().int().nonnegative().default(0),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(["eq", "neq", "in", "not_in", "contains", "gt", "lt", "gte", "lte"]),
    value: z.unknown()
  })).default([]),
  enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const LocalCapabilityCategorySchema = z.enum([
  "cli",
  "package_manager",
  "browser",
  "ide",
  "desktop_application",
  "os_automation",
  "system_service"
]);
export const LocalCapabilitySchema = z.object({
  local_capability_id: z.string(),
  category: LocalCapabilityCategorySchema,
  name: z.string(),
  version: z.string().optional(),
  install_path: z.string().optional(),
  invocation_method: z.enum(["cli", "api", "protocol", "gui", "daemon"]),
  risk_tier: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  sandbox_requirement: z.enum(["host_readonly", "guarded_mutation", "isolated_mutation"]).default("guarded_mutation"),
  detected_at: z.string().datetime(),
  last_verified_at: z.string().datetime().optional(),
  available: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({})
});

export const ApplicabilityRulesSchema = z.object({
  required_tags: z.array(z.string()).default([]),
  preferred_tags: z.array(z.string()).default([]),
  excluded_tags: z.array(z.string()).default([])
});

export const SkillCandidateSchema = z.object({
  candidate_id: z.string(),
  task_id: z.string(),
  title: z.string(),
  summary: z.string(),
  fingerprint: z.string().optional(),
  version: z.number().int().default(1),
  source_task_count: z.number().int().default(1),
  applicability: ApplicabilityRulesSchema.default({}),
  failure_boundaries: z.array(z.string()).default([]),
  improvement_hints: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  status: z.enum(["candidate", "approved", "rejected"]).default("candidate"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
  last_improved_at: z.string().datetime().optional()
});

export const CanonicalSkillSourceSchema = z.enum(["internal", "openclaw", "claude", "openai"]);
export const CanonicalSkillExecutionModeSchema = z.enum(["advisory", "tool_orchestrated", "worker_delegated"]);
export const CanonicalSkillStatusSchema = z.enum(["review_required", "active", "disabled"]);
export const CanonicalSkillDocumentFormatSchema = z.enum([
  "canonical_json",
  "openclaw_markdown",
  "claude_markdown",
  "openai_json"
]);

export const CanonicalSkillSpecSchema = z.object({
  skill_id: z.string(),
  name: z.string(),
  description: z.string(),
  source: CanonicalSkillSourceSchema,
  execution_mode: CanonicalSkillExecutionModeSchema.default("advisory"),
  prompt_template: z.string(),
  trigger_phrases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  required_capabilities: z.array(z.string()).default([]),
  preferred_workers: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  status: CanonicalSkillStatusSchema.default("review_required"),
  integrity_hash: z.string(),
  reviewed_by: z.string().optional(),
  reviewed_at: z.string().datetime().optional(),
  governance_note: z.string().optional(),
  version: z.number().int().default(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CanonicalSkillBundleSignatureSchema = z.object({
  algorithm: z.literal("hmac-sha256"),
  key_id: z.string().optional(),
  value: z.string()
});

export const CanonicalSkillBundlePublisherSchema = z.object({
  publisher_id: z.string(),
  publisher_name: z.string().optional(),
  published_at: z.string().datetime()
});

export const CanonicalSkillBundleProvenanceEventSchema = z.object({
  event_id: z.string(),
  action: z.enum(["bundle_exported", "bundle_imported", "bundle_promoted"]),
  occurred_at: z.string().datetime(),
  actor_id: z.string().optional(),
  actor_name: z.string().optional(),
  environment: z.string().optional(),
  release_channel: z.string().optional(),
  note: z.string().optional(),
  bundle_name: z.string().optional(),
  skill_ids: z.array(z.string()).default([]),
  included_statuses: z.array(CanonicalSkillStatusSchema).default([]),
  signature_key_id: z.string().optional()
});

export const CanonicalSkillBundleProvenanceSchema = z.object({
  source_environment: z.string().optional(),
  release_channel: z.string().optional(),
  promotion_note: z.string().optional(),
  current_event: CanonicalSkillBundleProvenanceEventSchema,
  promotion_history: z.array(CanonicalSkillBundleProvenanceEventSchema).default([])
});

export const CanonicalSkillBundleManifestSchema = z.object({
  bundle_version: z.number().int().default(1),
  bundle_name: z.string().optional(),
  generated_at: z.string().datetime(),
  included_statuses: z.array(CanonicalSkillStatusSchema).default(["active"]),
  skill_count: z.number().int().nonnegative(),
  skills: z.array(CanonicalSkillSpecSchema).default([]),
  integrity: z.string(),
  signature: CanonicalSkillBundleSignatureSchema.optional(),
  publisher: CanonicalSkillBundlePublisherSchema.optional(),
  provenance: CanonicalSkillBundleProvenanceSchema.optional()
});

export const SkillPolicyConfigSchema = z.object({
  trust: z.object({
    trusted_publishers: z.array(z.string()).default([]),
    allowed_release_channels: z.array(z.string()).default([]),
    require_trusted_bundle_import: z.boolean().default(false)
  }).default({}),
  content: z.object({
    allowed_skill_sources: z.array(CanonicalSkillSourceSchema).default([]),
    blocked_tags: z.array(z.string()).default([]),
    blocked_capabilities: z.array(z.string()).default([])
  }).default({}),
  roles: z.object({
    review_roles: z.array(z.string()).default(["admin", "reviewer"]),
    promote_roles: z.array(z.string()).default(["admin", "releaser"]),
    trusted_import_roles: z.array(z.string()).default(["admin", "releaser"]),
    policy_edit_roles: z.array(z.string()).default(["admin", "policy_editor"]),
    policy_approve_roles: z.array(z.string()).default(["admin", "reviewer"]),
    policy_manual_approval_roles: z.array(z.string()).default(["admin", "reviewer"]),
    policy_security_review_roles: z.array(z.string()).default(["admin", "security-reviewer"]),
    policy_promote_roles: z.array(z.string()).default(["admin", "releaser"])
  }).default({})
});

export const SkillPolicyScopeNameSchema = z.enum(["global", "org", "workspace", "local"]);
export const PolicyChangeFieldSchema = z.object({
  field: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional()
});
export const SkillPolicyProposalKindSchema = z.enum(["scope_update", "scope_promotion"]);
export const SkillPolicyProposalStatusSchema = z.enum(["pending_review", "approved", "rejected", "applied"]);
export const SkillPolicyProposalReviewPathSchema = z.enum(["standard", "manual_approval", "security_review"]);
export const PolicyCompareRecommendedActionSchema = z.enum([
  "safe_to_promote",
  "manual_approval_required",
  "requires_security_review"
]);
export const SkillPolicyProposalSchema = z.object({
  proposal_id: z.string(),
  kind: SkillPolicyProposalKindSchema,
  status: SkillPolicyProposalStatusSchema.default("pending_review"),
  review_path: SkillPolicyProposalReviewPathSchema.default("standard"),
  advisory_recommended_action: PolicyCompareRecommendedActionSchema.optional(),
  advisory_reasons: z.array(z.string()).default([]),
  suggested_template_kind: z.enum(["approval", "rejection", "promotion"]).optional(),
  source_scope: SkillPolicyScopeNameSchema.optional(),
  target_scope: SkillPolicyScopeNameSchema,
  path: z.string().optional(),
  rationale: z.string().optional(),
  requested_by: z.string().optional(),
  requested_at: z.string().datetime(),
  approved_by: z.string().optional(),
  approved_at: z.string().datetime().optional(),
  approval_note: z.string().optional(),
  deep_link: z.string().optional(),
  rejected_by: z.string().optional(),
  rejected_at: z.string().datetime().optional(),
  rejection_reason: z.string().optional(),
  applied_by: z.string().optional(),
  applied_at: z.string().datetime().optional(),
  persisted_config: z.record(z.unknown()).default({}),
  effective_preview: SkillPolicyConfigSchema,
  changed_fields: z.array(PolicyChangeFieldSchema).default([])
});
export const PolicyProposalFollowUpSeveritySchema = z.enum(["info", "warning", "critical"]);
export const PolicyProposalFollowUpActionSchema = z.enum([
  "assign_security_reviewer",
  "escalate_queue_owner",
  "request_manual_approval",
  "process_standard_promotions"
]);
export const PolicyProposalFollowUpSchema = z.object({
  follow_up_id: z.string(),
  review_path: SkillPolicyProposalReviewPathSchema,
  severity: PolicyProposalFollowUpSeveritySchema,
  action: PolicyProposalFollowUpActionSchema,
  queue_label: z.string(),
  title: z.string(),
  message: z.string(),
  pending_count: z.number().int().nonnegative(),
  sla_breach_count: z.number().int().nonnegative(),
  deep_link: z.string().optional(),
  created_at: z.string().datetime()
});
export const GovernanceAlertSourceKindSchema = z.enum(["desktop_navigation", "reuse_navigation"]);
export const GovernanceAlertActionSchema = z.enum([
  "review_desktop_navigation",
  "investigate_system_handoff",
  "review_reuse_navigation",
  "investigate_reuse_loop"
]);
export const GovernanceAlertSchema = z.object({
  alert_id: z.string(),
  source_kind: GovernanceAlertSourceKindSchema,
  source_id: z.string().optional(),
  aggregate_key: z.string().optional(),
  severity: PolicyProposalFollowUpSeveritySchema,
  action: GovernanceAlertActionSchema,
  title: z.string(),
  message: z.string(),
  detail: z.string().optional(),
  recommended_action: z.string().optional(),
  deep_link: z.string().optional(),
  created_at: z.string().datetime(),
  first_seen_at: z.string().datetime().optional(),
  last_seen_at: z.string().datetime().optional(),
  occurrence_count: z.number().int().positive().default(1),
  auto_escalated: z.boolean().default(false),
  escalated_at: z.string().datetime().optional(),
  suppressed_repeat_count: z.number().int().nonnegative().default(0)
});
export const GovernanceAlertFollowUpSchema = z.object({
  follow_up_id: z.string(),
  alert_id: z.string(),
  severity: PolicyProposalFollowUpSeveritySchema,
  action: GovernanceAlertActionSchema,
  title: z.string(),
  message: z.string(),
  occurrence_count: z.number().int().positive(),
  auto_escalated: z.boolean().default(false),
  deep_link: z.string().optional(),
  created_at: z.string().datetime()
});
export const InboxItemSchema = z.object({
  inbox_id: z.string(),
  kind: z.enum(["policy_follow_up", "task_attention", "governance_alert"]),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  message: z.string(),
  action: z.string(),
  source_id: z.string().optional(),
  deep_link: z.string().optional(),
  created_at: z.string().datetime()
});
export const InboxItemStateSchema = z.object({
  inbox_id: z.string(),
  status: z.enum(["open", "acknowledged", "resolved"]).default("open"),
  updated_at: z.string().datetime(),
  updated_by: z.string().optional()
});

export const EvolutionRunKindSchema = z.enum(["skill", "prompt", "tool_description", "routing_rule"]);
export const EvolutionRunStatusSchema = z.enum(["candidate_generated", "gating", "gated_passed", "gated_failed", "promoted", "rolled_back", "rejected"]);
export const EvolutionCandidateSchema = z.object({
  candidate_id: z.string(),
  evolution_run_id: z.string(),
  kind: EvolutionRunKindSchema,
  target_id: z.string(),
  target_name: z.string(),
  proposed_change: z.string(),
  change_diff: z.string().optional(),
  source_signals: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  budget_used_usd: z.number().nonnegative().default(0),
  replay_score: z.number().min(0).max(1).optional(),
  regression_passed: z.boolean().optional(),
  semantic_preserved: z.boolean().optional(),
  status: EvolutionRunStatusSchema.default("candidate_generated"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional()
});
export const SkillEvolutionRunSchema = z.object({
  run_id: z.string(),
  skill_id: z.string(),
  skill_name: z.string(),
  trigger_signals: z.array(z.string()).default([]),
  candidates: z.array(EvolutionCandidateSchema).default([]),
  budget_allocated_usd: z.number().nonnegative().default(0.5),
  budget_used_usd: z.number().nonnegative().default(0),
  status: EvolutionRunStatusSchema.default("candidate_generated"),
  trace_ids: z.array(z.string()).default([]),
  acceptance_review_ids: z.array(z.string()).default([]),
  finding_ids: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional()
});
export const PromptEvolutionRunSchema = z.object({
  run_id: z.string(),
  prompt_id: z.string(),
  prompt_name: z.string(),
  trigger_signals: z.array(z.string()).default([]),
  candidates: z.array(EvolutionCandidateSchema).default([]),
  budget_allocated_usd: z.number().nonnegative().default(0.3),
  budget_used_usd: z.number().nonnegative().default(0),
  status: EvolutionRunStatusSchema.default("candidate_generated"),
  trace_ids: z.array(z.string()).default([]),
  acceptance_review_ids: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional()
});
export const ToolDescriptionEvolutionRunSchema = z.object({
  run_id: z.string(),
  tool_id: z.string(),
  tool_name: z.string(),
  trigger_signals: z.array(z.string()).default([]),
  candidates: z.array(EvolutionCandidateSchema).default([]),
  budget_allocated_usd: z.number().nonnegative().default(0.2),
  budget_used_usd: z.number().nonnegative().default(0),
  status: EvolutionRunStatusSchema.default("candidate_generated"),
  trace_ids: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional()
});
export const EvolutionPromotionDecisionSchema = z.object({
  decision_id: z.string(),
  candidate_id: z.string(),
  evolution_run_id: z.string(),
  decision: z.enum(["promote", "reject", "rollback", "defer"]),
  reason: z.string(),
  replay_score: z.number().min(0).max(1).optional(),
  regression_passed: z.boolean().optional(),
  budget_impact_usd: z.number().nonnegative().default(0),
  governance_review_required: z.boolean().default(true),
  reviewed_by: z.string().optional(),
  reviewed_at: z.string().datetime().optional(),
  created_at: z.string().datetime()
});
export const EvolutionRollbackRecordSchema = z.object({
  rollback_id: z.string(),
  candidate_id: z.string(),
  evolution_run_id: z.string(),
  target_id: z.string(),
  target_kind: EvolutionRunKindSchema,
  previous_version: z.number().int(),
  rolled_back_version: z.number().int(),
  reason: z.string(),
  rollback_evidence: z.array(z.string()).default([]),
  created_at: z.string().datetime()
});

export const ClawHubRegistryConfigSchema = z.object({
  config_id: z.string(),
  registry_endpoint: z.string().url().optional(),
  registry_name: z.string().default("default"),
  auth_method: z.enum(["none", "api_key", "oauth2"]).default("none"),
  api_key_ref: z.string().optional(),
  oauth2_client_id: z.string().optional(),
  sync_interval_seconds: z.number().int().positive().default(3600),
  auto_sync_enabled: z.boolean().default(false),
  trust_policy: z.object({
    require_verified_publisher: z.boolean().default(true),
    minimum_downloads: z.number().int().nonnegative().default(0),
    allowed_tags: z.array(z.string()).default([]),
    blocked_tags: z.array(z.string()).default([])
  }).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional()
});

export const ClawHubSearchResultSchema = z.object({
  result_id: z.string(),
  query: z.string(),
  registry_name: z.string().default("default"),
  skill_id: z.string(),
  skill_name: z.string(),
  description: z.string(),
  publisher_id: z.string().optional(),
  publisher_name: z.string().optional(),
  version: z.string(),
  download_count: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  compatibility_score: z.number().min(0).max(1).default(0),
  verified: z.boolean().default(false),
  openclaw_format: z.boolean().default(false),
  created_at: z.string().datetime()
});

export const ClawHubInstallRecordSchema = z.object({
  install_id: z.string(),
  registry_name: z.string().default("default"),
  remote_skill_id: z.string(),
  remote_skill_name: z.string(),
  remote_version: z.string(),
  local_skill_id: z.string().optional(),
  install_status: z.enum(["pending_review", "installed", "install_failed", "review_rejected"]).default("pending_review"),
  trust_verdict_id: z.string().optional(),
  governance_review_required: z.boolean().default(true),
  installed_at: z.string().datetime().optional(),
  installed_by: z.string().optional(),
  created_at: z.string().datetime()
});

export const ClawHubPublishRecordSchema = z.object({
  publish_id: z.string(),
  registry_name: z.string().default("default"),
  local_skill_id: z.string(),
  local_skill_name: z.string(),
  local_version: z.number().int(),
  remote_skill_id: z.string().optional(),
  publish_status: z.enum(["pending_approval", "published", "publish_failed", "revoked"]).default("pending_approval"),
  governance_approved: z.boolean().default(false),
  published_at: z.string().datetime().optional(),
  published_by: z.string().optional(),
  created_at: z.string().datetime()
});

export const ClawHubSyncRecordSchema = z.object({
  sync_id: z.string(),
  registry_name: z.string().default("default"),
  sync_kind: z.enum(["full", "incremental", "metadata_only"]).default("incremental"),
  sync_status: z.enum(["in_progress", "completed", "failed"]).default("in_progress"),
  skills_synced: z.number().int().nonnegative().default(0),
  skills_updated: z.number().int().nonnegative().default(0),
  skills_added: z.number().int().nonnegative().default(0),
  errors: z.array(z.string()).default([]),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional()
});

export const RemoteSkillTrustVerdictSchema = z.object({
  verdict_id: z.string(),
  remote_skill_id: z.string(),
  registry_name: z.string().default("default"),
  trust_level: z.enum(["untrusted", "conditional", "trusted"]).default("untrusted"),
  verification_signals: z.array(z.string()).default([]),
  compatibility_check: z.enum(["pending", "compatible", "incompatible", "unknown"]).default("pending"),
  policy_compliant: z.boolean().default(false),
  publisher_verified: z.boolean().default(false),
  risk_assessment: z.string().optional(),
  reviewed_by: z.string().optional(),
  reviewed_at: z.string().datetime().optional(),
  governance_review_required: z.boolean().default(true),
  created_at: z.string().datetime()
});

export const TaskTemplateSchema = z.object({
  template_id: z.string(),
  fingerprint: z.string(),
  department: DepartmentSchema,
  task_type: TaskTypeSchema,
  title: z.string(),
  version: z.number().int().default(1),
  definition_of_done: CompletionContractSchema,
  execution_plan: z.array(PlanStepSchema).default([]),
  applicability: ApplicabilityRulesSchema.default({}),
  failure_boundaries: z.array(z.string()).default([]),
  improvement_hints: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  source_task_count: z.number().int().default(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_used_at: z.string().datetime().optional(),
  last_improved_at: z.string().datetime().optional()
});

export const ScheduleSchema = z.object({
  schedule_id: z.string(),
  task_template: z.object({
    intent: z.string(),
    task_type: TaskTypeSchema,
    department: DepartmentSchema,
    risk_level: RiskLevelSchema
  }),
  cadence: z.string(),
  enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  last_triggered_at: z.string().datetime().optional()
});

export const ToolInvocationSchema = z.object({
  invocation_id: z.string(),
  task_id: z.string(),
  tool_name: z.string(),
  status: z.enum(["started", "succeeded", "failed"]),
  idempotency_key: z.string().optional(),
  compensation_available: z.boolean().default(false),
  compensation_status: z.enum(["not_required", "available", "applied", "failed"]).default("not_required"),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).default({}),
  created_at: z.string().datetime()
});

export const ConnectorTypeSchema = z.enum(["simulated", "http_json_fetch", "crm_contact_lookup", "hr_candidate_lookup", "finance_reconcile"]);
export const ConnectorAuthStrategySchema = z.enum(["none", "bearer_env"]);
export const ConnectorPaginationStrategySchema = z.enum(["none", "cursor"]);

export const ConnectorSpecSchema = z.object({
  name: z.string(),
  category: z.string(),
  risk: z.enum(["medium", "high"]),
  compensation_available: z.boolean().default(false),
  reconciliation_mode: z.enum(["artifact", "external_state"]),
  connector_type: ConnectorTypeSchema.default("simulated"),
  auth_strategy: ConnectorAuthStrategySchema.default("none"),
  pagination_strategy: ConnectorPaginationStrategySchema.default("none"),
  required_inputs: z.array(z.string()).default([])
});

export const BrowserSessionSchema = z.object({
  session_id: z.string(),
  task_id: z.string(),
  entry_url: z.string(),
  current_url: z.string(),
  engine: z.enum(["playwright_worker", "fetch_snapshot"]),
  title: z.string().nullable().optional(),
  status: z.enum(["active", "completed", "failed"]),
  status_code: z.number().int().nullable().optional(),
  content_type: z.string().nullable().optional(),
  text_excerpt: z.string().default(""),
  dom_summary: z.object({
    heading_count: z.number().int().default(0),
    link_count: z.number().int().default(0),
    form_count: z.number().int().default(0),
    interactive_count: z.number().int().default(0),
    sample_links: z.array(z.string()).default([]),
    sample_headings: z.array(z.string()).default([])
  }).nullable().optional(),
  history: z.array(
    z.object({
      url: z.string(),
      engine: z.enum(["playwright_worker", "fetch_snapshot"]),
      title: z.string().nullable().optional(),
      status_code: z.number().int().nullable().optional(),
      visited_at: z.string().datetime()
    })
  ).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const WorkerKindSchema = z.enum([
  "manager",
  "deerflow_worker",
  "coding_worker",
  "qa_worker",
  "business_worker",
  "finance_worker",
  "general_worker"
]);

export const WorkerRunSchema = z.object({
  worker_run_id: z.string(),
  task_id: z.string(),
  worker_kind: WorkerKindSchema,
  worker_name: z.string(),
  status: z.enum(["assigned", "running", "completed", "failed", "stopped"]),
  summary: z.string().optional(),
  delegated_execution_run_id: z.string().optional(),
  delegated_runtime_instance_id: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  created_at: z.string().datetime()
});

export const RuntimeSessionInfoSchema = z.object({
  session_id: z.string(),
  memory_strategy: z.enum(["compacted", "raw", "promoted"]),
  memory_items: z.number().int().nonnegative(),
  methodology_items: z.number().int().nonnegative(),
  checkpoint_count: z.number().int().nonnegative(),
  promoted_memory: z.boolean().default(false)
});

export const RuntimeHarnessInfoSchema = z.object({
  harness_id: z.string(),
  planner_mode: z.enum(["fresh_plan", "template_reuse", "playbook_reuse", "mixed"]),
  capability_resolution_count: z.number().int().nonnegative(),
  verification_stack: z.array(z.string()).default([]),
  fast_path_reuse: z.boolean().default(false)
});

export const RuntimeSandboxInfoSchema = z.object({
  sandbox_id: z.string(),
  isolation_tier: z.enum(["host_guarded", "sandbox_runner", "cloud_runner"]),
  execution_profile: z.enum(["read_only", "confirmed_write", "connector_only", "mixed"]),
  guarded_scopes: z.array(z.string()).default([]),
  mutation_present: z.boolean().default(false),
  future_upgrade_path: z.string().optional()
});

export const RuntimeBoundaryInfoSchema = z.object({
  session: RuntimeSessionInfoSchema,
  harness: RuntimeHarnessInfoSchema,
  sandbox: RuntimeSandboxInfoSchema
});

export const SubagentRoleSchema = z.enum([
  "supervisor",
  "capability_router",
  "execution_worker",
  "verification_guard",
  "learning_curator"
]);

export const SubagentSessionSchema = z.object({
  subagent_session_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  parent_worker_run_id: z.string().optional(),
  role: SubagentRoleSchema,
  worker_kind: WorkerKindSchema,
  worker_name: z.string(),
  status: z.enum(["planned", "running", "completed", "failed", "paused"]).default("planned"),
  isolated_context_key: z.string(),
  checkpoint_count: z.number().int().nonnegative().default(0),
  message_count: z.number().int().nonnegative().default(0),
  last_message_id: z.string().optional(),
  resume_supported: z.boolean().default(true),
  result_summary: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const SubagentMessageSchema = z.object({
  message_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  direction: z.enum(["supervisor_to_subagent", "subagent_to_supervisor"]),
  kind: z.enum(["assignment", "context", "progress", "result", "handoff"]),
  summary: z.string(),
  payload: z.record(z.unknown()).default({}),
  created_at: z.string().datetime()
});

export const SubagentCheckpointSchema = z.object({
  checkpoint_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  stage: z.string(),
  summary: z.string(),
  created_at: z.string().datetime()
});

export const AgentTeamTimelineEntrySchema = z.object({
  entry_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  source_type: z.enum([
    "session",
    "message",
    "checkpoint",
    "resume_request",
    "resume_package",
    "execution_run",
    "runtime_binding",
    "runtime_instance",
      "runtime_launch_receipt",
      "runtime_adapter_run",
      "runtime_runner_backend_lease",
      "runtime_backend_execution",
      "runtime_driver_run",
      "runtime_runner_handle",
      "runtime_runner_execution",
      "runtime_runner_job"
    ]),
  source_id: z.string(),
  subagent_session_id: z.string().optional(),
  role: SubagentRoleSchema.optional(),
  event_kind: z.string(),
  summary: z.string(),
  created_at: z.string().datetime()
});

export const SubagentResumeRequestStatusSchema = z.enum(["pending", "accepted", "completed", "rejected"]);
export const SubagentResumeRequestSchema = z.object({
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  actor_role: z.string(),
  reason: z.string().optional(),
  last_checkpoint_id: z.string().optional(),
  deep_link: z.string().optional(),
  status: SubagentResumeRequestStatusSchema.default("pending"),
  accepted_by: z.string().optional(),
  accepted_at: z.string().datetime().optional(),
  resolved_by: z.string().optional(),
  resolved_at: z.string().datetime().optional(),
  resolution_note: z.string().optional(),
  result_summary: z.string().optional(),
  requested_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const SubagentResumePackageStatusSchema = z.enum(["prepared", "applied", "superseded"]);
export const SubagentResumePackageSchema = z.object({
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  handoff_checkpoint_id: z.string(),
  deep_link: z.string().optional(),
  status: SubagentResumePackageStatusSchema.default("prepared"),
  package_summary: z.string(),
  execution_state_summary: z.string().optional(),
  created_by: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  applied_at: z.string().datetime().optional(),
  applied_by: z.string().optional(),
  applied_note: z.string().optional(),
  applied_checkpoint_id: z.string().optional(),
  superseded_at: z.string().datetime().optional()
});

export const SubagentExecutionRunStatusSchema = z.enum(["running", "completed", "failed"]);
export const SubagentExecutionRunSchema = z.object({
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  status: SubagentExecutionRunStatusSchema.default("running"),
  runtime_kind: z.enum(["delegated_runtime"]).default("delegated_runtime"),
  start_checkpoint_id: z.string(),
  latest_checkpoint_id: z.string().optional(),
  result_summary: z.string().optional(),
  started_by: z.string(),
  started_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  completion_note: z.string().optional(),
  deep_link: z.string().optional()
});

export const SubagentRuntimeBindingStatusSchema = z.enum(["bound", "released"]);
export const SubagentRuntimeBindingSchema = z.object({
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  status: SubagentRuntimeBindingStatusSchema.default("bound"),
  runtime_kind: z.enum(["host_guarded", "sandbox_runner", "cloud_runner"]).default("sandbox_runner"),
  sandbox_profile: z.enum(["delegated_resume_default", "verified_readonly", "connector_guarded"]).default("delegated_resume_default"),
  runtime_locator: z.string().optional(),
  latest_heartbeat_at: z.string().datetime().optional(),
  bound_by: z.string(),
  bound_at: z.string().datetime(),
  released_at: z.string().datetime().optional(),
  release_reason: z.string().optional(),
  deep_link: z.string().optional()
});

export const SubagentRuntimeInstanceStatusSchema = z.enum(["active", "completed", "failed", "released"]);
export const SubagentRuntimeLauncherKindSchema = z.enum(["worker_run", "sandbox_runner", "cloud_runner"]);
export const SubagentRuntimeLauncherStateSchema = z.enum(["attached", "external_pending", "released"]);
export const SubagentRuntimeLaunchReceiptStatusSchema = z.enum(["launched", "failed"]);
export const SubagentRuntimeLaunchBackendKindSchema = z.enum([
  "local_worker_adapter",
  "sandbox_runner_adapter",
  "cloud_runner_adapter"
]);
export const SubagentRuntimeLauncherDriverIdSchema = z.enum([
  "local_worker_run_driver",
  "sandbox_pool_driver",
  "cloud_control_plane_driver"
]);
export const SubagentRuntimeIsolationScopeSchema = z.enum(["host_process", "sandbox_pool", "remote_control_plane"]);
export const SubagentRuntimeQuotaProfileSchema = z.enum([
  "local_worker_default",
  "sandbox_pool_default",
  "cloud_runner_default"
]);
export const SubagentRuntimeLauncherCatalogEntrySchema = z.object({
  launcher_kind: SubagentRuntimeLauncherKindSchema,
  label: z.string(),
  description: z.string(),
  runtime_kind: z.enum(["host_guarded", "sandbox_runner", "cloud_runner"]),
  sandbox_profile: z.enum(["delegated_resume_default", "verified_readonly", "connector_guarded"]),
  attachment_mode: z.enum(["managed", "external"]),
  requires_locator: z.boolean().default(false),
  locator_placeholder: z.string().optional(),
  future_upgrade_path: z.string().optional()
});
export const SubagentRuntimeLauncherStatusSchema = z.object({
  launcher_kind: SubagentRuntimeLauncherKindSchema,
  availability: z.enum(["ready", "attention", "degraded"]),
  active_runtime_count: z.number().int().nonnegative(),
  pending_attachment_count: z.number().int().nonnegative(),
  released_runtime_count: z.number().int().nonnegative(),
  recommended_action: z.string(),
  summary: z.string()
});
export const SubagentRuntimeLauncherDriverCatalogEntrySchema = z.object({
  driver_id: SubagentRuntimeLauncherDriverIdSchema,
  launcher_kind: SubagentRuntimeLauncherKindSchema,
  label: z.string(),
  description: z.string(),
  runtime_kind: z.enum(["host_guarded", "sandbox_runner", "cloud_runner"]),
  sandbox_profile: z.enum(["delegated_resume_default", "verified_readonly", "connector_guarded"]),
  attachment_mode: z.enum(["managed", "external"]),
  health_contract: z.enum(["worker_run_lifecycle", "external_heartbeat", "cloud_control_plane"]),
  isolation_scope: SubagentRuntimeIsolationScopeSchema,
  quota_profile: SubagentRuntimeQuotaProfileSchema,
  mutation_guarded: z.boolean().default(true),
  capability_flags: z.array(z.string()).default([]),
  requires_locator: z.boolean().default(false),
  locator_placeholder: z.string().optional(),
  future_upgrade_path: z.string().optional()
});
export const SubagentRuntimeLauncherDriverStatusSchema = z.object({
  driver_id: SubagentRuntimeLauncherDriverIdSchema,
  launcher_kind: SubagentRuntimeLauncherKindSchema,
  health: z.enum(["healthy", "attention", "degraded"]),
  active_runtime_count: z.number().int().nonnegative(),
  pending_attachment_count: z.number().int().nonnegative(),
  released_runtime_count: z.number().int().nonnegative(),
  recommended_action: z.string(),
  summary: z.string()
});
export const SubagentRuntimeLauncherBackendAdapterIdSchema = z.enum([
  "local_worker_backend_adapter",
  "sandbox_pool_backend_adapter",
  "cloud_control_plane_backend_adapter"
]);
export const SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema = z.object({
  adapter_id: SubagentRuntimeLauncherBackendAdapterIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  supported_driver_ids: z.array(SubagentRuntimeLauncherDriverIdSchema).default([]),
  label: z.string(),
  description: z.string(),
  consumption_mode: z.enum(["managed_runtime_launch", "external_launch_handoff", "remote_control_plane"]),
  heartbeat_contract: z.enum(["worker_run_lifecycle", "external_heartbeat", "cloud_control_plane"]),
  release_contract: z.enum(["managed_worker_release", "sandbox_pool_release", "cloud_control_plane_release"]),
  execution_style: z.enum(["inline_control_plane", "delegated_runtime_adapter", "future_remote_runner"]),
  future_upgrade_path: z.string().optional()
});
export const SubagentRuntimeLauncherBackendAdapterStatusSchema = z.object({
  adapter_id: SubagentRuntimeLauncherBackendAdapterIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  health: z.enum(["healthy", "attention", "degraded"]),
  launched_receipt_count: z.number().int().nonnegative(),
  active_adapter_run_count: z.number().int().nonnegative(),
  completed_adapter_run_count: z.number().int().nonnegative(),
  failed_adapter_run_count: z.number().int().nonnegative(),
  recommended_action: z.string(),
  summary: z.string()
});
export const SubagentRuntimeInstanceSchema = z.object({
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  status: SubagentRuntimeInstanceStatusSchema.default("active"),
  runtime_kind: z.enum(["host_guarded", "sandbox_runner", "cloud_runner"]).default("sandbox_runner"),
  sandbox_profile: z.enum(["delegated_resume_default", "verified_readonly", "connector_guarded"]).default("delegated_resume_default"),
  runtime_locator: z.string().optional(),
  launched_by: z.string(),
  launched_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  launcher_kind: SubagentRuntimeLauncherKindSchema.default("worker_run"),
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema.default("local_worker_run_driver"),
  isolation_scope: SubagentRuntimeIsolationScopeSchema.default("host_process"),
  quota_profile: SubagentRuntimeQuotaProfileSchema.default("local_worker_default"),
  mutation_guarded: z.boolean().default(true),
  launcher_state: SubagentRuntimeLauncherStateSchema.default("attached"),
  launcher_locator: z.string().optional(),
  launcher_attached_at: z.string().datetime().optional(),
  launcher_summary: z.string().optional(),
  launcher_worker_run_id: z.string().optional(),
  finished_at: z.string().datetime().optional(),
  finish_reason: z.string().optional(),
  deep_link: z.string().optional()
});

export const SubagentRuntimeLaunchSpecSchema = z.object({
  launch_spec_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  runtime_kind: z.enum(["host_guarded", "sandbox_runner", "cloud_runner"]),
  sandbox_profile: z.enum(["delegated_resume_default", "verified_readonly", "connector_guarded"]),
  runtime_locator: z.string().optional(),
  launcher_kind: SubagentRuntimeLauncherKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  launcher_state: SubagentRuntimeLauncherStateSchema,
  launcher_locator: z.string().optional(),
  launcher_worker_run_id: z.string().optional(),
  isolation_scope: SubagentRuntimeIsolationScopeSchema,
  quota_profile: SubagentRuntimeQuotaProfileSchema,
  mutation_guarded: z.boolean().default(true),
  handoff_checkpoint_id: z.string(),
  start_checkpoint_id: z.string(),
  latest_checkpoint_id: z.string().optional(),
  applied_checkpoint_id: z.string().optional(),
  package_summary: z.string(),
  execution_state_summary: z.string().optional(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  consumer_contract_version: z.literal(1).default(1),
  deep_link: z.string().optional(),
  created_at: z.string().datetime()
});

export const SubagentRuntimeLaunchReceiptSchema = z.object({
  receipt_id: z.string(),
  launch_spec_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  launcher_kind: SubagentRuntimeLauncherKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  status: SubagentRuntimeLaunchReceiptStatusSchema.default("launched"),
  launched_by: z.string(),
  launched_at: z.string().datetime(),
  launch_locator: z.string().optional(),
  execution_locator: z.string().optional(),
  note: z.string().optional(),
  failure_reason: z.string().optional(),
  consumer_contract_version: z.literal(1).default(1),
  deep_link: z.string().optional()
});

export const SubagentRuntimeAdapterRunStatusSchema = z.enum(["running", "completed", "failed"]);
export const SubagentRuntimeAdapterRunSchema = z.object({
  adapter_run_id: z.string(),
  receipt_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  launch_locator: z.string().optional(),
  execution_locator: z.string().optional(),
  status: SubagentRuntimeAdapterRunStatusSchema.default("running"),
  started_by: z.string(),
  started_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  completed_at: z.string().datetime().optional(),
  completion_note: z.string().optional(),
  deep_link: z.string().optional()
});
export const SubagentRuntimeBackendExecutionStatusSchema = z.enum(["running", "completed", "failed"]);
export const SubagentRuntimeBackendExecutionSchema = z.object({
  backend_execution_id: z.string(),
  lease_id: z.string().optional(),
  adapter_run_id: z.string(),
  receipt_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  adapter_id: SubagentRuntimeLauncherBackendAdapterIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  execution_style: z.enum(["inline_control_plane", "delegated_runtime_adapter", "future_remote_runner"]),
  launch_locator: z.string().optional(),
  execution_locator: z.string().optional(),
  status: SubagentRuntimeBackendExecutionStatusSchema.default("running"),
  started_by: z.string(),
  started_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  completed_at: z.string().datetime().optional(),
  completion_note: z.string().optional(),
  deep_link: z.string().optional()
});
export const SubagentRuntimeDriverRunStatusSchema = z.enum(["running", "completed", "failed"]);
export const SubagentRuntimeDriverRunSchema = z.object({
  driver_run_id: z.string(),
  backend_execution_id: z.string(),
  adapter_run_id: z.string(),
  receipt_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  adapter_id: SubagentRuntimeLauncherBackendAdapterIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  execution_style: z.enum(["inline_control_plane", "delegated_runtime_adapter", "future_remote_runner"]),
  launch_locator: z.string().optional(),
  execution_locator: z.string().optional(),
  status: SubagentRuntimeDriverRunStatusSchema.default("running"),
  started_by: z.string(),
  started_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  completed_at: z.string().datetime().optional(),
  completion_note: z.string().optional(),
  deep_link: z.string().optional()
});
export const SubagentRuntimeRunnerHandleStatusSchema = z.enum(["attached", "released", "failed"]);
export const SubagentRuntimeRunnerKindSchema = z.enum([
  "local_worker_process",
  "sandbox_pool_job",
  "cloud_control_plane_job"
]);
export const SubagentRuntimeRunnerBackendAdapterIdSchema = z.enum([
  "local_process_runner_backend",
  "sandbox_job_runner_backend",
  "cloud_job_runner_backend"
]);
export const SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema = z.object({
  adapter_id: SubagentRuntimeRunnerBackendAdapterIdSchema,
  runner_kind: SubagentRuntimeRunnerKindSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  supported_driver_ids: z.array(SubagentRuntimeLauncherDriverIdSchema).default([]),
  label: z.string(),
  description: z.string(),
  execution_contract: z.enum(["host_process_lifecycle", "sandbox_job_lifecycle", "cloud_job_lifecycle"]),
  heartbeat_contract: z.enum(["local_process_heartbeat", "external_job_heartbeat", "cloud_job_heartbeat"]),
  release_contract: z.enum(["host_process_release", "sandbox_job_release", "cloud_job_release"]),
  future_upgrade_path: z.string().optional()
});
export const SubagentRuntimeRunnerBackendAdapterStatusSchema = z.object({
  adapter_id: SubagentRuntimeRunnerBackendAdapterIdSchema,
  runner_kind: SubagentRuntimeRunnerKindSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  health: z.enum(["healthy", "attention", "degraded"]),
  running_execution_count: z.number().int().nonnegative(),
  completed_execution_count: z.number().int().nonnegative(),
  failed_execution_count: z.number().int().nonnegative(),
  recommended_action: z.string(),
  summary: z.string()
});
export const SubagentRuntimeRunnerBackendLeaseStatusSchema = z.enum(["allocated", "released", "failed"]);
export const SubagentRuntimeRunnerBackendLeaseSchema = z.object({
  lease_id: z.string(),
  adapter_run_id: z.string(),
  receipt_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  adapter_id: SubagentRuntimeRunnerBackendAdapterIdSchema,
  runner_kind: SubagentRuntimeRunnerKindSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  quota_profile: SubagentRuntimeQuotaProfileSchema,
  isolation_scope: SubagentRuntimeIsolationScopeSchema,
  execution_locator: z.string().optional(),
  resource_locator: z.string().optional(),
  status: SubagentRuntimeRunnerBackendLeaseStatusSchema.default("allocated"),
  allocated_by: z.string(),
  allocated_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  released_at: z.string().datetime().optional(),
  release_note: z.string().optional(),
  deep_link: z.string().optional()
});
export const SubagentRuntimeRunnerHandleSchema = z.object({
  runner_handle_id: z.string(),
  driver_run_id: z.string(),
  backend_execution_id: z.string(),
  adapter_run_id: z.string(),
  receipt_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  adapter_id: SubagentRuntimeLauncherBackendAdapterIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  runner_kind: SubagentRuntimeRunnerKindSchema,
  status: SubagentRuntimeRunnerHandleStatusSchema.default("attached"),
  attached_by: z.string(),
  attached_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  runner_locator: z.string().optional(),
  released_at: z.string().datetime().optional(),
  release_reason: z.string().optional(),
  deep_link: z.string().optional()
});

export const SubagentRuntimeRunnerExecutionStatusSchema = z.enum(["running", "completed", "failed"]);
export const SubagentRuntimeRunnerExecutionSchema = z.object({
  runner_execution_id: z.string(),
  runner_handle_id: z.string(),
  driver_run_id: z.string(),
  backend_execution_id: z.string(),
  adapter_run_id: z.string(),
  receipt_id: z.string(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  adapter_id: SubagentRuntimeLauncherBackendAdapterIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  runner_kind: SubagentRuntimeRunnerKindSchema,
  runner_locator: z.string().optional(),
  execution_locator: z.string().optional(),
  status: SubagentRuntimeRunnerExecutionStatusSchema.default("running"),
  started_by: z.string(),
  started_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  completed_at: z.string().datetime().optional(),
  completed_by: z.string().optional(),
  completion_note: z.string().optional(),
  deep_link: z.string().optional()
});

export const SubagentRuntimeRunnerJobKindSchema = z.enum([
  "local_process_job",
  "sandbox_execution_job",
  "cloud_execution_job"
]);
export const SubagentRuntimeRunnerJobStatusSchema = z.enum(["running", "completed", "failed"]);
export const SubagentRuntimeRunnerJobSchema = z.object({
  runner_job_id: z.string(),
  runner_execution_id: z.string(),
  runner_handle_id: z.string(),
  driver_run_id: z.string(),
  backend_execution_id: z.string(),
  adapter_run_id: z.string(),
  receipt_id: z.string(),
  lease_id: z.string().optional(),
  instance_id: z.string(),
  binding_id: z.string(),
  execution_run_id: z.string(),
  package_id: z.string(),
  request_id: z.string(),
  team_id: z.string(),
  task_id: z.string(),
  subagent_session_id: z.string(),
  adapter_id: SubagentRuntimeLauncherBackendAdapterIdSchema,
  backend_kind: SubagentRuntimeLaunchBackendKindSchema,
  launcher_driver_id: SubagentRuntimeLauncherDriverIdSchema,
  runner_kind: SubagentRuntimeRunnerKindSchema,
  job_kind: SubagentRuntimeRunnerJobKindSchema,
  runner_locator: z.string().optional(),
  execution_locator: z.string().optional(),
  job_locator: z.string().optional(),
  status: SubagentRuntimeRunnerJobStatusSchema.default("running"),
  started_by: z.string(),
  started_at: z.string().datetime(),
  latest_heartbeat_at: z.string().datetime().optional(),
  latest_heartbeat_note: z.string().optional(),
  completed_at: z.string().datetime().optional(),
  completed_by: z.string().optional(),
  completion_note: z.string().optional(),
  deep_link: z.string().optional()
});

export const AgentTeamSummarySchema = z.object({
  team_id: z.string(),
  task_id: z.string(),
  mode: z.enum(["single_worker", "delegated_team"]).default("single_worker"),
  status: z.enum(["planned", "active", "completed"]).default("planned"),
  supervisor_session_id: z.string().optional(),
  resume_supported: z.boolean().default(true),
  session_count: z.number().int().nonnegative().default(0),
  active_session_count: z.number().int().nonnegative().default(0),
  completed_session_count: z.number().int().nonnegative().default(0),
  message_count: z.number().int().nonnegative().default(0),
  isolated_context_count: z.number().int().nonnegative().default(0),
  checkpoint_count: z.number().int().nonnegative().default(0),
  dispatch_plan_id: z.string().optional(),
  future_upgrade_path: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CapabilityKindSchema = z.enum(["skill", "mcp_server", "tool", "worker", "implementation"]);
export const CapabilityStrategySchema = z.enum(["reuse_existing", "compose_existing", "implement_local"]);
export const CapabilityDescriptorSchema = z.object({
  capability_id: z.string(),
  name: z.string(),
  kind: CapabilityKindSchema,
  source: z.string(),
  summary: z.string(),
  tags: z.array(z.string()).default([])
});

export const CapabilityResolutionSchema = z.object({
  resolution_id: z.string(),
  task_id: z.string(),
  need_key: z.string(),
  need_title: z.string(),
  strategy: CapabilityStrategySchema,
  search_query: z.string(),
  status: z.enum(["resolved", "fallback_required"]).default("resolved"),
  selected_capabilities: z.array(CapabilityDescriptorSchema).default([]),
  reasoning: z.string(),
  created_at: z.string().datetime()
});

export const CapabilityScoreBreakdownSchema = z.object({
  capability_id: z.string(),
  total_score: z.number().default(0),
  policy_admissibility: z.number().default(0),
  risk_tier: z.number().default(0),
  deterministic_coverage: z.number().default(0),
  locality: z.number().default(0),
  historical_reliability: z.number().default(0),
  reuse_success: z.number().default(0),
  latency: z.number().default(0),
  cost: z.number().default(0),
  maintenance_burden: z.number().default(0),
  tag_overlap: z.number().default(0),
  query_relevance: z.number().default(0),
  source_weight: z.number().default(0),
  deterministic_tier: z.number().default(0),
  details: z.record(z.unknown()).default({})
});

export const AuditEntrySchema = z.object({
  audit_id: z.string(),
  task_id: z.string().optional(),
  action: z.string(),
  payload: z.record(z.unknown()).default({}),
  created_at: z.string().datetime()
});

export const TaskContractSchema = z.object({
  task_id: z.string(),
  task_type: TaskTypeSchema,
  intent: z.string(),
  department: DepartmentSchema,
  priority: PrioritySchema.default("medium"),
  risk_level: RiskLevelSchema,
  status: TaskStatusSchema,
  initiator: InitiatorSchema,
  owner: OwnerSchema.optional(),
  inputs: z.record(z.unknown()).default({}),
  constraints: z.record(z.unknown()).default({}),
  execution_plan: z.array(PlanStepSchema).default([]),
  definition_of_done: CompletionContractSchema,
  reconciliation_requirements: ReconciliationContractSchema.default({}),
  mandatory_checklists: ChecklistContractSchema.default({}),
  verification_policy: VerificationContractSchema.default({}),
  progress_heartbeat_at: z.string().datetime().optional(),
  watchdog_policy: z.object({
    heartbeat_timeout_sec: z.number().int().default(300),
    stagnation_timeout_sec: z.number().int().default(900),
    max_retry: z.number().int().default(2)
  }).default({}),
  timestamps: z.object({
    created_at: z.string().datetime(),
    started_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    completed_at: z.string().datetime().optional()
  }),
  cost_metrics: z.object({
    total_cost_usd: z.number().default(0),
    input_tokens: z.number().int().default(0),
    output_tokens: z.number().int().default(0),
    tool_calls: z.number().int().default(0)
  }).default({}),
  memory_mode: MemoryModeSchema.default("durable_retrieval"),
  memory_strategy_recommendation_id: z.string().optional(),
  ttt_eligibility_gate_id: z.string().optional(),
  ttt_adaptation_run_id: z.string().optional()
});

export const ChecklistRunResultSchema = z.object({
  status: z.enum(["passed", "failed"]),
  failed_items: z.array(z.string()).default([]),
  passed_items: z.array(z.string()).default([])
});

export const ReconciliationRunResultSchema = z.object({
  status: z.enum(["passed", "failed"]),
  matched_states: z.array(z.string()).default([]),
  missing_states: z.array(z.string()).default([])
});

export const VerificationRunResultSchema = z.object({
  verdict: z.enum(["pass", "pass_with_notes", "fail"]),
  summary: z.string(),
  missing_items: z.array(z.string()).default([]),
  quality_issues: z.array(z.string()).default([]),
  policy_issues: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  recommended_fix: z.array(z.string()).default([]),
  rerun_scope: z.enum(["full", "partial", "none"]).default("none")
});

export const DoneGateResultSchema = z.object({
  status: z.enum(["passed", "failed"]),
  reasons: z.array(z.string()).default([]),
  completed_at: z.string().datetime().optional()
});

export const EvidenceNodeKindSchema = z.enum([
  "checklist",
  "verifier",
  "reconciliation",
  "policy_decision",
  "execution_output",
  "external_state_confirmation",
  "artifact_presence",
  "approval",
  "reviewer_feedback"
]);
export const EvidenceNodeStatusSchema = z.enum(["pending", "produced", "passed", "failed", "skipped", "revise_and_retry"]);
export const EvidenceNodeSchema = z.object({
  node_id: z.string(),
  task_id: z.string(),
  kind: EvidenceNodeKindSchema,
  status: EvidenceNodeStatusSchema.default("pending"),
  label: z.string(),
  description: z.string().optional(),
  source_id: z.string().optional(),
  produced_at: z.string().datetime().optional(),
  verdict: z.enum(["pass", "pass_with_notes", "fail", "not_evaluated"]).default("not_evaluated"),
  details: z.record(z.unknown()).default({}),
  required_for_completion: z.boolean().default(true),
  depends_on: z.array(z.string()).default([])
});
export const EvidenceGraphSchema = z.object({
  graph_id: z.string(),
  task_id: z.string(),
  nodes: z.array(EvidenceNodeSchema).default([]),
  completion_eligible: z.boolean().default(false),
  blocking_node_count: z.number().int().nonnegative().default(0),
  passed_node_count: z.number().int().nonnegative().default(0),
  failed_node_count: z.number().int().nonnegative().default(0),
  pending_node_count: z.number().int().nonnegative().default(0),
  evaluated_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const CompletionEngineVerdictSchema = z.enum(["complete", "incomplete", "blocked", "revise_and_retry"]);
export const CompletionEngineResultSchema = z.object({
  result_id: z.string(),
  task_id: z.string(),
  graph_id: z.string(),
  verdict: CompletionEngineVerdictSchema,
  passed_nodes: z.number().int().nonnegative().default(0),
  failed_nodes: z.number().int().nonnegative().default(0),
  pending_nodes: z.number().int().nonnegative().default(0),
  revise_nodes: z.number().int().nonnegative().default(0),
  blocking_reasons: z.array(z.string()).default([]),
  next_actions: z.array(z.string()).default([]),
  evaluated_at: z.string().datetime()
});

export type TaskContract = z.infer<typeof TaskContractSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Initiator = z.infer<typeof InitiatorSchema>;
export type Owner = z.infer<typeof OwnerSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type CompletionContract = z.infer<typeof CompletionContractSchema>;
export type ChecklistRunResult = z.infer<typeof ChecklistRunResultSchema>;
export type ReconciliationRunResult = z.infer<typeof ReconciliationRunResultSchema>;
export type VerificationRunResult = z.infer<typeof VerificationRunResultSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type MemoryKind = z.infer<typeof MemoryKindSchema>;
export type MemoryItem = z.infer<typeof MemoryItemSchema>;
export type MemoryDirectoryKind = z.infer<typeof MemoryDirectoryKindSchema>;
export type MemoryDirectory = z.infer<typeof MemoryDirectorySchema>;
export type MemoryDocumentKind = z.infer<typeof MemoryDocumentKindSchema>;
export type MemoryDocument = z.infer<typeof MemoryDocumentSchema>;
export type MemoryDocumentSection = z.infer<typeof MemoryDocumentSectionSchema>;
export type MemoryRetrievalStage = z.infer<typeof MemoryRetrievalStageSchema>;
export type MemoryRetrievalTrace = z.infer<typeof MemoryRetrievalTraceSchema>;
export type MemoryMode = z.infer<typeof MemoryModeSchema>;
export type MemoryStrategyRecommendation = z.infer<typeof MemoryStrategyRecommendationSchema>;
export type TTTEligibilityVerdict = z.infer<typeof TTTEligibilityVerdictSchema>;
export type TTTEligibilityGateResult = z.infer<typeof TTTEligibilityGateResultSchema>;
export type TTTAdaptationRun = z.infer<typeof TTTAdaptationRunSchema>;
export type TTTDistillationRecord = z.infer<typeof TTTDistillationRecordSchema>;
export type TTTBudgetLedger = z.infer<typeof TTTBudgetLedgerSchema>;
export type LearningFactoryStage = z.infer<typeof LearningFactoryStageSchema>;
export type LearningFactoryPipelineStatus = z.infer<typeof LearningFactoryPipelineStatusSchema>;
export type LearningFactoryPipeline = z.infer<typeof LearningFactoryPipelineSchema>;
export type LearningFactoryBacklogItem = z.infer<typeof LearningFactoryBacklogItemSchema>;
export type EventLedgerEntryKind = z.infer<typeof EventLedgerEntryKindSchema>;
export type EventLedgerEntry = z.infer<typeof EventLedgerEntrySchema>;
export type EventProjection = z.infer<typeof EventProjectionSchema>;
export type OutboxEntry = z.infer<typeof OutboxEntrySchema>;
export type PolicyDecisionVerdict = z.infer<typeof PolicyDecisionVerdictSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type PolicyEnforcementAction = z.infer<typeof PolicyEnforcementActionSchema>;
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;
export type LocalCapabilityCategory = z.infer<typeof LocalCapabilityCategorySchema>;
export type LocalCapability = z.infer<typeof LocalCapabilitySchema>;
export type AutonomousCompletionState = z.infer<typeof AutonomousCompletionStateSchema>;
export type TaskCheckpoint = z.infer<typeof TaskCheckpointSchema>;
export type HeartbeatRecord = z.infer<typeof HeartbeatRecordSchema>;
export type AutonomousCompletionConfig = z.infer<typeof AutonomousCompletionConfigSchema>;
export type ReviewerVerdict = z.infer<typeof ReviewerVerdictSchema>;
export type ReviewerExpectation = z.infer<typeof ReviewerExpectationSchema>;
export type ReviewerFeedback = z.infer<typeof ReviewerFeedbackSchema>;
export type RalphAttempt = z.infer<typeof RalphAttemptSchema>;
export type RalphLoopState = z.infer<typeof RalphLoopStateSchema>;
export type SpanKind = z.infer<typeof SpanKindSchema>;
export type SpanStatus = z.infer<typeof SpanStatusSchema>;
export type TraceSpan = z.infer<typeof TraceSpanSchema>;
export type RunTimeline = z.infer<typeof RunTimelineSchema>;
export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;
export type SLOMetric = z.infer<typeof SLOMetricSchema>;
export type EgressRuleAction = z.infer<typeof EgressRuleActionSchema>;
export type EgressRule = z.infer<typeof EgressRuleSchema>;
export type EgressRequest = z.infer<typeof EgressRequestSchema>;
export type EgressVerdict = z.infer<typeof EgressVerdictSchema>;
export type EgressAudit = z.infer<typeof EgressAuditSchema>;
export type CQSCommandKind = z.infer<typeof CQSCommandKindSchema>;
export type CQSQueryKind = z.infer<typeof CQSQueryKindSchema>;
export type CQSEventKind = z.infer<typeof CQSEventKindSchema>;
export type CQSCommand = z.infer<typeof CQSCommandSchema>;
export type CQSQuery = z.infer<typeof CQSQuerySchema>;
export type CQSEvent = z.infer<typeof CQSEventSchema>;
export type CQSDispatchResult = z.infer<typeof CQSDispatchResultSchema>;
export type CQSQueryResult = z.infer<typeof CQSQueryResultSchema>;
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;
export type ExperimentCandidate = z.infer<typeof ExperimentCandidateSchema>;
export type ExperimentBudget = z.infer<typeof ExperimentBudgetSchema>;
export type ExperimentRun = z.infer<typeof ExperimentRunSchema>;
export type SandboxTier = z.infer<typeof SandboxTierSchema>;
export type FilesystemMount = z.infer<typeof FilesystemMountSchema>;
export type CapabilityToken = z.infer<typeof CapabilityTokenSchema>;
export type ResourceQuota = z.infer<typeof ResourceQuotaSchema>;
export type SandboxManifest = z.infer<typeof SandboxManifestSchema>;
export type TaskControlCommandKind = z.infer<typeof TaskControlCommandKindSchema>;
export type TaskControlCommand = z.infer<typeof TaskControlCommandSchema>;
export type LineageMutationKind = z.infer<typeof LineageMutationKindSchema>;
export type MethodLineage = z.infer<typeof MethodLineageSchema>;
export type MetricsWindow = z.infer<typeof MetricsWindowSchema>;
export type OperationalMetrics = z.infer<typeof OperationalMetricsSchema>;
export type ReplayPackage = z.infer<typeof ReplayPackageSchema>;
export type PrivacyLevel = z.infer<typeof PrivacyLevelSchema>;
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type ModelRoute = z.infer<typeof ModelRouteSchema>;
export type ModelRequest = z.infer<typeof ModelRequestSchema>;
export type AutomationTriggerKind = z.infer<typeof AutomationTriggerKindSchema>;
export type AutomationDedupStrategy = z.infer<typeof AutomationDedupStrategySchema>;
export type AutomationRecursionPolicy = z.infer<typeof AutomationRecursionPolicySchema>;
export type AutomationDefinition = z.infer<typeof AutomationDefinitionSchema>;
export type AutomationTriggerRecord = z.infer<typeof AutomationTriggerRecordSchema>;
export type WikiPageClass = z.infer<typeof WikiPageClassSchema>;
export type WikiPageStatus = z.infer<typeof WikiPageStatusSchema>;
export type WikiPage = z.infer<typeof WikiPageSchema>;
export type WikiCompilationResult = z.infer<typeof WikiCompilationResultSchema>;
export type ExecutionStepKind = z.infer<typeof ExecutionStepKindSchema>;
export type ExecutionStepStatus = z.infer<typeof ExecutionStepStatusSchema>;
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;
export type TaskRunStatus = z.infer<typeof TaskRunStatusSchema>;
export type TaskRun = z.infer<typeof TaskRunSchema>;
export type TaskAttemptStatus = z.infer<typeof TaskAttemptStatusSchema>;
export type TaskAttempt = z.infer<typeof TaskAttemptSchema>;
export type WorkerSessionStatus = z.infer<typeof WorkerSessionStatusSchema>;
export type WorkerSession = z.infer<typeof WorkerSessionSchema>;
export type SandboxLeaseStatus = z.infer<typeof SandboxLeaseStatusSchema>;
export type SandboxLease = z.infer<typeof SandboxLeaseSchema>;
export type HarnessKind = z.infer<typeof HarnessKindSchema>;
export type HarnessStatus = z.infer<typeof HarnessStatusSchema>;
export type ExecutionHarness = z.infer<typeof ExecutionHarnessSchema>;
export type ReuseFeedbackKind = z.infer<typeof ReuseFeedbackKindSchema>;
export type ReuseFeedback = z.infer<typeof ReuseFeedbackSchema>;
export type ScheduledJob = z.infer<typeof ScheduledJobSchema>;
export type CheckpointSnapshot = z.infer<typeof CheckpointSnapshotSchema>;
export type EventSubscription = z.infer<typeof EventSubscriptionSchema>;
export type SLOAlert = z.infer<typeof SLOAlertSchema>;

export const EventSubscriptionSchema = z.object({
  subscription_id: z.string(),
  event_kind: z.string(),
  subscriber_type: z.enum(["webhook", "internal_callback", "poll"]).default("poll"),
  callback_url: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  last_triggered_at: z.string().datetime().optional(),
  trigger_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime()
});
export const SLOAlertSchema = z.object({
  alert_id: z.string(),
  slo_name: z.string(),
  threshold: z.number(),
  actual_value: z.number(),
  severity: z.enum(["warning", "critical"]).default("warning"),
  task_id: z.string().optional(),
  acknowledged: z.boolean().default(false),
  acknowledged_by: z.string().optional(),
  acknowledged_at: z.string().datetime().optional(),
  created_at: z.string().datetime()
});

export const CronExpressionSchema = z.string().refine(val => {
  const parts = val.split(" ");
  return parts.length === 5 || parts.length === 6;
}, { message: "Cron expression must have 5 or 6 fields" });
export const ScheduledJobSchema = z.object({
  job_id: z.string(),
  name: z.string(),
  cron_expression: z.string().optional(),
  interval_ms: z.number().int().positive().optional(),
  task_intent: z.string(),
  enabled: z.boolean().default(true),
  last_triggered_at: z.string().datetime().optional(),
  next_trigger_at: z.string().datetime().optional(),
  trigger_count: z.number().int().nonnegative().default(0),
  failure_count: z.number().int().nonnegative().default(0),
  last_failure_reason: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const CheckpointSnapshotSchema = z.object({
  checkpoint_id: z.string(),
  task_id: z.string(),
  step_id: z.string().optional(),
  snapshot_data: z.record(z.unknown()).default({}),
  task_status: z.string(),
  execution_step_ids: z.array(z.string()).default([]),
  evidence_node_ids: z.array(z.string()).default([]),
  created_at: z.string().datetime()
});

export const ReuseFeedbackKindSchema = z.enum(["accept_recommendation", "ignore_recommendation", "prefer_template", "reject_playbook", "approve_methodology"]);
export const ReuseFeedbackSchema = z.object({
  feedback_id: z.string(),
  task_id: z.string(),
  kind: ReuseFeedbackKindSchema,
  target_type: z.enum(["playbook", "template", "skill", "methodology", "capability"]).default("playbook"),
  target_id: z.string(),
  preferred_alternative_id: z.string().optional(),
  reason: z.string().optional(),
  user_id: z.string().optional(),
  created_at: z.string().datetime()
});

export const HarnessKindSchema = z.enum(["code_change", "connector_call", "browser_automation", "shell_command", "file_write", "external_api"]);
export const HarnessStatusSchema = z.enum(["pending", "running", "passed", "failed", "timed_out", "skipped", "error"]);
export const ExecutionHarnessSchema = z.object({
  harness_id: z.string(),
  task_id: z.string(),
  step_id: z.string().optional(),
  kind: HarnessKindSchema,
  status: HarnessStatusSchema.default("pending"),
  label: z.string(),
  fixed_input: z.record(z.unknown()).default({}),
  expected_output: z.record(z.unknown()).default({}),
  actual_output: z.record(z.unknown()).default({}),
  timeout_ms: z.number().int().positive().default(30000),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
  evidence_node_id: z.string().optional(),
  rollback_available: z.boolean().default(false),
  rollback_executed: z.boolean().default(false),
  created_at: z.string().datetime()
});

export const TaskRunStatusSchema = z.enum(["created", "running", "completed", "failed", "cancelled"]);
export const TaskRunSchema = z.object({
  run_id: z.string(),
  task_id: z.string(),
  status: TaskRunStatusSchema.default("created"),
  attempt_count: z.number().int().nonnegative().default(0),
  current_attempt_id: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().int().nonnegative().default(0),
  total_step_count: z.number().int().nonnegative().default(0),
  completed_step_count: z.number().int().nonnegative().default(0),
  failed_step_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const TaskAttemptStatusSchema = z.enum(["pending", "running", "completed", "failed", "cancelled"]);
export const TaskAttemptSchema = z.object({
  attempt_id: z.string(),
  run_id: z.string(),
  task_id: z.string(),
  attempt_number: z.number().int().positive().default(1),
  status: TaskAttemptStatusSchema.default("pending"),
  parent_attempt_id: z.string().optional(),
  worker_session_id: z.string().optional(),
  sandbox_lease_id: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().int().nonnegative().default(0),
  verdict: z.enum(["accepted", "accepted_with_notes", "revise_and_retry", "blocked"]).optional(),
  created_at: z.string().datetime()
});
export const WorkerSessionStatusSchema = z.enum(["active", "idle", "terminated", "expired", "orphaned", "stalled", "supervised_restart"]);
export const WorkerSessionSchema = z.object({
  session_id: z.string(),
  worker_id: z.string(),
  task_id: z.string().optional(),
  run_id: z.string().optional(),
  attempt_id: z.string().optional(),
  status: WorkerSessionStatusSchema.default("active"),
  started_at: z.string().datetime(),
  last_heartbeat_at: z.string().datetime().optional(),
  terminated_at: z.string().datetime().optional(),
  step_count: z.number().int().nonnegative().default(0),
  owner_process_id: z.string().optional(),
  restart_count: z.number().int().nonnegative().default(0),
  max_restarts: z.number().int().nonnegative().default(3),
  last_restart_at: z.string().datetime().optional(),
  stall_detected_at: z.string().datetime().optional(),
  orphaned_detected_at: z.string().datetime().optional(),
  lease_id: z.string().optional(),
  dispatch_lease_id: z.string().optional(),
  dispatch_plan_id: z.string().optional(),
  supervision_policy: z.enum(["none", "restart_on_failure", "restart_on_stall", "restart_on_expiry"]).default("none"),
  created_at: z.string().datetime()
});
export const SandboxLeaseStatusSchema = z.enum(["active", "released", "expired", "revoked"]);
export const SandboxLeaseSchema = z.object({
  lease_id: z.string(),
  task_id: z.string(),
  attempt_id: z.string().optional(),
  sandbox_manifest_id: z.string().optional(),
  status: SandboxLeaseStatusSchema.default("active"),
  tier: z.enum(["host_readonly", "guarded_mutation", "isolated_mutation"]).default("host_readonly"),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  released_at: z.string().datetime().optional(),
  failure_cleanup_done: z.boolean().default(false),
  cleanup_reason: z.string().optional(),
  created_at: z.string().datetime()
});

export const DelegatedResumePackageSchema = z.object({
  package_id: z.string(),
  session_id: z.string(),
  task_id: z.string(),
  attempt_id: z.string().optional(),
  checkpoint_id: z.string().optional(),
  superseded_package_id: z.string().optional(),
  status: z.enum(["prepared", "applied", "superseded", "failed", "rolled_back"]).default("prepared"),
  execution_state_summary: z.record(z.unknown()).default({}),
  pending_steps: z.array(z.string()).default([]),
  applied_at: z.string().datetime().optional(),
  superseded_at: z.string().datetime().optional(),
  applied_by_session_id: z.string().optional(),
  created_at: z.string().datetime()
});

export const WorkerSupervisionEventSchema = z.object({
  event_id: z.string(),
  session_id: z.string(),
  worker_id: z.string(),
  event_kind: z.enum(["heartbeat_expiry", "orphan_detected", "stall_detected", "restart_initiated", "restart_completed", "restart_failed", "lease_released", "cleanup_completed", "resume_applied"]),
  details: z.record(z.unknown()).default({}),
  created_at: z.string().datetime()
});

export const ScheduledJobRetryPolicySchema = z.object({
  max_retries: z.number().int().nonnegative().default(3),
  backoff_base_ms: z.number().int().positive().default(1000),
  backoff_multiplier: z.number().positive().default(2),
  max_backoff_ms: z.number().int().positive().default(60000),
  retry_on_error: z.boolean().default(true),
  retry_on_timeout: z.boolean().default(true)
});

export const MissedRunPolicySchema = z.enum(["skip", "run_immediately", "run_and_alert", "queue_for_next_cycle"]);

export const DeerFlowWorkerRouteSchema = z.object({
  route_id: z.string(),
  worker_kind: z.literal("deerflow_worker"),
  worker_name: z.string(),
  launch_contract: z.record(z.unknown()).default({}),
  adapter_boundary: z.enum(["local_mock", "local_process", "remote_grpc"]).default("local_mock"),
  compatibility_version: z.string().default("0.1.0"),
  is_backbone: z.literal(false),
  created_at: z.string().datetime()
});

export const ExecutionStepKindSchema = z.enum(["planning", "tool_invocation", "capability_resolution", "verification", "policy_check", "memory_capture", "learning", "execution", "approval", "external_call", "subtask_dispatch", "checkpoint"]);
export const ExecutionStepStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped", "cancelled"]);
export const ExecutionStepSchema = z.object({
  step_id: z.string(),
  task_id: z.string(),
  run_id: z.string().optional(),
  attempt_id: z.string().optional(),
  parent_step_id: z.string().optional(),
  kind: ExecutionStepKindSchema,
  status: ExecutionStepStatusSchema.default("pending"),
  label: z.string(),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).default({}),
  error: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().int().nonnegative().default(0),
  retry_count: z.number().int().nonnegative().default(0),
  evidence_node_ids: z.array(z.string()).default([]),
  child_step_ids: z.array(z.string()).default([]),
  created_at: z.string().datetime()
});

export const WikiPageClassSchema = z.enum(["sop", "troubleshooting", "decision_record", "connector_guide", "department_brief", "domain_notes", "tool_usage_guide"]);
export const WikiPageStatusSchema = z.enum(["draft", "published", "stale", "retired"]);
export const WikiPageSchema = z.object({
  page_id: z.string(),
  title: z.string(),
  page_class: WikiPageClassSchema,
  status: WikiPageStatusSchema,
  content_markdown: z.string(),
  owners: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  freshness_date: z.string().datetime(),
  linked_skill_ids: z.array(z.string()).default([]),
  linked_template_ids: z.array(z.string()).default([]),
  sections: z.array(z.object({
    section_id: z.string(),
    heading: z.string(),
    level: z.number().int().min(1).max(6).default(1),
    content: z.string(),
    child_section_ids: z.array(z.string()).default([])
  })).default([]),
  backlink_page_ids: z.array(z.string()).default([]),
  compiled_summary: z.string().optional(),
  compiled_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const WikiCompilationResultSchema = z.object({
  compilation_id: z.string(),
  total_pages: z.number().int().nonnegative(),
  total_backlinks: z.number().int().nonnegative(),
  total_sections: z.number().int().nonnegative(),
  stale_pages: z.array(z.string()).default([]),
  orphan_pages: z.array(z.string()).default([]),
  compiled_at: z.string().datetime()
});

export const AutomationTriggerKindSchema = z.enum(["schedule", "event", "webhook", "manual"]);
export const AutomationDedupStrategySchema = z.enum(["none", "exact_intent", "fingerprint", "window"]);
export const AutomationRecursionPolicySchema = z.enum(["allow", "block", "max_depth"]);
export const AutomationDefinitionSchema = z.object({
  automation_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  trigger_kind: AutomationTriggerKindSchema,
  trigger_config: z.record(z.unknown()).default({}),
  task_template: z.object({
    intent: z.string(),
    department: z.string(),
    task_type: z.string(),
    priority: z.string().default("medium"),
    inputs: z.record(z.unknown()).default({})
  }),
  dedup_strategy: AutomationDedupStrategySchema.default("exact_intent"),
  dedup_window_ms: z.number().int().positive().default(3600000),
  recursion_policy: AutomationRecursionPolicySchema.default("block"),
  max_recursion_depth: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
  last_triggered_at: z.string().datetime().optional(),
  trigger_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export const AutomationTriggerRecordSchema = z.object({
  trigger_id: z.string(),
  automation_id: z.string(),
  trigger_kind: AutomationTriggerKindSchema,
  task_id: z.string().optional(),
  was_deduplicated: z.boolean().default(false),
  dedup_reason: z.string().optional(),
  recursion_depth: z.number().int().nonnegative().default(0),
  triggered_at: z.string().datetime()
});

export const PrivacyLevelSchema = z.enum(["public", "internal", "confidential", "restricted"]);
export const ModelProviderSchema = z.enum(["openai", "anthropic", "google", "local", "custom"]);
export const ModelRouteSchema = z.object({
  route_id: z.string(),
  model_alias: z.string(),
  provider: ModelProviderSchema,
  model_id: z.string(),
  max_privacy_level: PrivacyLevelSchema,
  priority: z.number().int().nonnegative().default(0),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  is_active: z.boolean().default(true),
  fallback_route_id: z.string().optional()
});
export const ModelRequestSchema = z.object({
  request_id: z.string(),
  route_id: z.string(),
  task_id: z.string().optional(),
  model_alias: z.string(),
  provider: ModelProviderSchema,
  model_id: z.string(),
  privacy_level: PrivacyLevelSchema,
  input_tokens: z.number().int().nonnegative().default(0),
  output_tokens: z.number().int().nonnegative().default(0),
  cost_usd: z.number().nonnegative().default(0),
  latency_ms: z.number().int().nonnegative().default(0),
  status: z.enum(["pending", "success", "error", "rate_limited", "fallback"]).default("pending"),
  error_message: z.string().optional(),
  retry_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime()
});

export const ReplayPackageSchema = z.object({
  package_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  task_id: z.string().optional(),
  time_range_start: z.string().datetime(),
  time_range_end: z.string().datetime(),
  event_kinds: z.array(z.string()).default([]),
  included_event_ids: z.array(z.string()).default([]),
  state_snapshot: z.record(z.unknown()).optional(),
  annotations: z.array(z.object({
    event_id: z.string(),
    note: z.string(),
    severity: z.enum(["info", "warning", "critical"]).default("info"),
    annotated_at: z.string().datetime(),
    annotated_by: z.string().optional()
  })).default([]),
  status: z.enum(["building", "ready", "error"]).default("building"),
  event_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  created_by: z.string().optional()
});

export const MetricsWindowSchema = z.enum(["hour", "day", "week"]);
export const OperationalMetricsSchema = z.object({
  metrics_id: z.string(),
  window: MetricsWindowSchema,
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  department: z.string().optional(),
  task_family: z.string().optional(),
  task_metrics: z.object({
    total_created: z.number().int().nonnegative().default(0),
    total_completed: z.number().int().nonnegative().default(0),
    total_failed: z.number().int().nonnegative().default(0),
    total_cancelled: z.number().int().nonnegative().default(0),
    completion_rate: z.number().min(0).max(1).default(0),
    failure_rate: z.number().min(0).max(1).default(0),
    avg_duration_ms: z.number().nonnegative().default(0),
    p50_duration_ms: z.number().nonnegative().default(0),
    p95_duration_ms: z.number().nonnegative().default(0),
    p99_duration_ms: z.number().nonnegative().default(0)
  }),
  verification_metrics: z.object({
    total_verifications: z.number().int().nonnegative().default(0),
    passed: z.number().int().nonnegative().default(0),
    failed: z.number().int().nonnegative().default(0),
    pass_rate: z.number().min(0).max(1).default(0),
    avg_attempts_to_pass: z.number().nonnegative().default(0)
  }),
  reuse_metrics: z.object({
    total_tasks: z.number().int().nonnegative().default(0),
    tasks_with_reuse: z.number().int().nonnegative().default(0),
    reuse_hit_rate: z.number().min(0).max(1).default(0),
    skills_reused: z.number().int().nonnegative().default(0),
    playbooks_reused: z.number().int().nonnegative().default(0)
  }),
  cost_metrics: z.object({
    total_tokens: z.number().int().nonnegative().default(0),
    total_cost: z.number().nonnegative().default(0),
    avg_tokens_per_task: z.number().nonnegative().default(0),
    avg_cost_per_task: z.number().nonnegative().default(0),
    by_model: z.record(z.object({ tokens: z.number().int().nonnegative(), cost: z.number().nonnegative() })).default({})
  }),
  computed_at: z.string().datetime()
});

export const LineageMutationKindSchema = z.enum(["manual_edit", "learning_factory_promotion", "experiment_winner", "fork", "merge", "rollback"]);
export const MethodLineageSchema = z.object({
  lineage_id: z.string(),
  asset_type: z.enum(["skill", "template", "playbook", "method"]),
  asset_id: z.string(),
  version: z.number().int().positive(),
  parent_lineage_id: z.string().optional(),
  mutation_kind: LineageMutationKindSchema,
  mutation_reason: z.string(),
  mutation_source_id: z.string().optional(),
  snapshot: z.record(z.unknown()),
  evaluation_result: z.object({
    score: z.number().optional(),
    passed: z.boolean().optional(),
    metric_name: z.string().optional(),
    metric_value: z.number().optional(),
    evaluated_at: z.string().datetime().optional()
  }).optional(),
  created_at: z.string().datetime(),
  created_by: z.string().optional(),
  is_active: z.boolean().default(true),
  tags: z.array(z.string()).default([])
});

export const TaskControlCommandKindSchema = z.enum(["interrupt", "correct", "redirect"]);
export const TaskControlCommandSchema = z.object({
  command_id: z.string(),
  kind: TaskControlCommandKindSchema,
  task_id: z.string(),
  issued_by: z.string().optional(),
  issued_at: z.string().datetime(),
  reason: z.string(),
  correction: z.string().optional(),
  new_intent: z.string().optional(),
  checkpoint_id: z.string().optional(),
  resume_from_checkpoint: z.boolean().default(false),
  status: z.enum(["pending", "applied", "rejected"]).default("pending")
});

export const SandboxTierSchema = z.enum(["host_readonly", "guarded_mutation", "isolated_mutation"]);
export const FilesystemMountSchema = z.object({
  path: z.string(),
  access: z.enum(["readonly", "readwrite"]),
  max_size_bytes: z.number().int().positive().optional()
});
export const CapabilityTokenSchema = z.object({
  token_id: z.string(),
  capability: z.string(),
  scope: z.string().optional(),
  expires_at: z.string().datetime(),
  issued_at: z.string().datetime()
});
export const ResourceQuotaSchema = z.object({
  max_cpu_percent: z.number().positive().optional(),
  max_memory_bytes: z.number().int().positive().optional(),
  max_wall_clock_ms: z.number().int().positive().optional(),
  max_file_writes: z.number().int().nonnegative().optional(),
  max_shell_commands: z.number().int().nonnegative().optional(),
  max_network_calls: z.number().int().nonnegative().optional()
});
export const SandboxManifestSchema = z.object({
  manifest_id: z.string(),
  task_id: z.string(),
  tier: SandboxTierSchema,
  filesystem_mounts: z.array(FilesystemMountSchema).default([]),
  capability_tokens: z.array(CapabilityTokenSchema).default([]),
  resource_quota: ResourceQuotaSchema,
  egress_rule_ids: z.array(z.string()).default([]),
  rollback_hints: z.array(z.object({ action: z.string(), target: z.string(), method: z.string() })).default([]),
  compensation_available: z.boolean().default(false),
  signed_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  status: z.enum(["active", "expired", "revoked"]).default("active"),
  usage_summary: z.object({
    file_writes: z.number().int().nonnegative().default(0),
    shell_commands: z.number().int().nonnegative().default(0),
    network_calls: z.number().int().nonnegative().default(0),
    memory_peak_bytes: z.number().int().nonnegative().default(0),
    wall_clock_ms: z.number().int().nonnegative().default(0)
  }).default({ file_writes: 0, shell_commands: 0, network_calls: 0, memory_peak_bytes: 0, wall_clock_ms: 0 })
});

export const ExperimentStatusSchema = z.enum(["draft", "running", "completed", "failed", "cancelled", "budget_exhausted"]);
export const ExperimentCandidateSchema = z.object({
  candidate_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  method_type: z.enum(["cli", "script", "tool", "skill", "mcp_server", "worker", "implementation"]),
  config: z.record(z.unknown()).default({}),
  result: z.unknown().optional(),
  success_metric_value: z.number().optional(),
  status: z.enum(["pending", "running", "completed", "failed"]).default("pending")
});
export const ExperimentBudgetSchema = z.object({
  max_attempts: z.number().int().positive().default(3),
  max_tokens: z.number().int().positive().optional(),
  max_wall_clock_ms: z.number().int().positive().optional(),
  max_cost: z.number().positive().optional()
});
export const ExperimentRunSchema = z.object({
  experiment_id: z.string(),
  objective: z.string(),
  hypothesis: z.string().optional(),
  status: ExperimentStatusSchema.default("draft"),
  candidates: z.array(ExperimentCandidateSchema).default([]),
  budget: ExperimentBudgetSchema,
  success_metric: z.string(),
  config_artifact_id: z.string().optional(),
  result_artifact_id: z.string().optional(),
  comparison_summary: z.record(z.unknown()).optional(),
  winner_candidate_id: z.string().optional(),
  tokens_used: z.number().int().nonnegative().default(0),
  cost_incurred: z.number().nonnegative().default(0),
  wall_clock_ms: z.number().int().nonnegative().default(0),
  attempts_used: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  task_family: z.string().optional(),
  department: z.string().optional()
});

export const CQSCommandKindSchema = z.enum([
  "create_task",
  "update_task",
  "start_task",
  "stop_task",
  "retry_task",
  "approve_action",
  "reject_action",
  "promote_playbook",
  "release_sandbox_lease",
  "add_evidence_node",
  "submit_verification",
  "submit_reviewer_feedback",
  "add_egress_rule",
  "approve_egress",
  "apply_policy",
  "import_skill",
  "export_skill",
  "capture_memory",
  "start_trace",
  "end_trace",
  "record_cost",
  "custom"
]);
export const CQSQueryKindSchema = z.enum([
  "get_task",
  "list_tasks",
  "get_workspace",
  "get_evidence_graph",
  "get_completion_verdict",
  "get_capability_score",
  "get_run_timeline",
  "get_cost_breakdown",
  "get_slo_metrics",
  "get_span_tree",
  "list_egress_rules",
  "list_egress_audits",
  "get_egress_stats",
  "list_memory",
  "list_skills",
  "get_policy",
  "get_agent_team",
  "custom"
]);
export const CQSEventKindSchema = z.enum([
  "task_created",
  "task_state_changed",
  "task_completed",
  "evidence_produced",
  "verification_completed",
  "reviewer_feedback_submitted",
  "egress_checked",
  "egress_approved",
  "policy_applied",
  "skill_imported",
  "memory_captured",
  "trace_started",
  "trace_ended",
  "slo_breached",
  "custom"
]);
export const CQSCommandSchema = z.object({
  command_id: z.string(),
  kind: CQSCommandKindSchema,
  aggregate_type: z.string(),
  aggregate_id: z.string(),
  payload: z.record(z.unknown()),
  issued_at: z.string().datetime(),
  issued_by: z.string().optional(),
  correlation_id: z.string().optional()
});
export const CQSQuerySchema = z.object({
  query_id: z.string(),
  kind: CQSQueryKindSchema,
  target_type: z.string(),
  target_id: z.string().optional(),
  filter: z.record(z.unknown()).default({}),
  projection: z.array(z.string()).optional(),
  issued_at: z.string().datetime(),
  correlation_id: z.string().optional()
});
export const CQSEventSchema = z.object({
  event_id: z.string(),
  kind: CQSEventKindSchema,
  aggregate_type: z.string(),
  aggregate_id: z.string(),
  payload: z.record(z.unknown()),
  caused_by_command_id: z.string().optional(),
  occurred_at: z.string().datetime(),
  correlation_id: z.string().optional()
});
export const CQSDispatchResultSchema = z.object({
  success: z.boolean(),
  command_id: z.string().optional(),
  result: z.unknown().optional(),
  events: z.array(CQSEventSchema).default([]),
  error: z.string().optional()
});
export const CQSQueryResultSchema = z.object({
  success: z.boolean(),
  query_id: z.string().optional(),
  data: z.unknown().optional(),
  error: z.string().optional()
});

export const EgressRuleActionSchema = z.enum(["allow", "deny", "ask"]);
export const EgressRuleSchema = z.object({
  rule_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  action: EgressRuleActionSchema,
  destination_pattern: z.string(),
  destination_type: z.enum(["domain", "ip", "cidr", "url_prefix", "port", "wildcard"]),
  protocol: z.enum(["any", "http", "https", "ws", "wss", "tcp", "udp"]).default("any"),
  policy_source: z.enum(["global", "org", "workspace", "local", "user"]).default("local"),
  priority: z.number().int().nonnegative().default(0),
  enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional()
});
export const EgressRequestSchema = z.object({
  request_id: z.string(),
  task_id: z.string().optional(),
  trace_id: z.string().optional(),
  destination: z.string(),
  destination_type: z.enum(["domain", "ip", "cidr", "url_prefix", "port", "wildcard"]),
  protocol: z.enum(["any", "http", "https", "ws", "wss", "tcp", "udp"]).default("any"),
  port: z.number().int().optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  headers_sent: z.record(z.string()).optional(),
  payload_size_bytes: z.number().int().nonnegative().optional(),
  payload_summary: z.string().optional(),
  requested_at: z.string().datetime()
});
export const EgressVerdictSchema = z.enum(["allowed", "denied", "pending_approval"]);
export const EgressAuditSchema = z.object({
  audit_id: z.string(),
  request_id: z.string(),
  task_id: z.string().optional(),
  trace_id: z.string().optional(),
  destination: z.string(),
  protocol: z.enum(["any", "http", "https", "ws", "wss", "tcp", "udp"]).default("any"),
  verdict: EgressVerdictSchema,
  matched_rule_id: z.string().optional(),
  matched_rule_name: z.string().optional(),
  policy_source: z.enum(["global", "org", "workspace", "local", "user"]).optional(),
  denial_reason: z.string().optional(),
  approved_by: z.string().optional(),
  payload_redacted: z.boolean().default(false),
  audited_at: z.string().datetime()
});

export const SpanKindSchema = z.enum([
  "planning",
  "tool_invocation",
  "capability_resolution",
  "verification",
  "policy_check",
  "memory_capture",
  "learning",
  "execution",
  "approval",
  "external_call"
]);
export const SpanStatusSchema = z.enum(["ok", "error", "timeout"]);
export const TraceSpanSchema = z.object({
  span_id: z.string(),
  trace_id: z.string(),
  parent_span_id: z.string().optional(),
  task_id: z.string().optional(),
  attempt_id: z.string().optional(),
  kind: SpanKindSchema,
  name: z.string(),
  status: SpanStatusSchema.default("ok"),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  attributes: z.record(z.unknown()).default({}),
  events: z.array(z.object({
    name: z.string(),
    timestamp: z.string().datetime(),
    attributes: z.record(z.unknown()).default({})
  })).default([])
});
export const RunTimelineSchema = z.object({
  timeline_id: z.string(),
  task_id: z.string(),
  trace_id: z.string(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  total_duration_ms: z.number().int().nonnegative().optional(),
  span_count: z.number().int().nonnegative().default(0),
  error_count: z.number().int().nonnegative().default(0),
  status: z.enum(["running", "completed", "failed", "cancelled"]).default("running")
});
export const CostBreakdownSchema = z.object({
  cost_id: z.string(),
  task_id: z.string(),
  trace_id: z.string(),
  llm_tokens_used: z.number().int().nonnegative().default(0),
  llm_cost_usd: z.number().nonnegative().default(0),
  tool_invocations: z.number().int().nonnegative().default(0),
  external_calls: z.number().int().nonnegative().default(0),
  memory_operations: z.number().int().nonnegative().default(0),
  total_duration_ms: z.number().int().nonnegative().default(0),
  computed_at: z.string().datetime()
});
export const SLOMetricSchema = z.object({
  metric_id: z.string(),
  metric_name: z.string(),
  value: z.number(),
  unit: z.string().default("ms"),
  threshold: z.number().optional(),
  breached: z.boolean().default(false),
  measured_at: z.string().datetime(),
  task_id: z.string().optional(),
  trace_id: z.string().optional()
});

export const ReviewerVerdictSchema = z.enum([
  "accepted",
  "accepted_with_notes",
  "revise_and_retry",
  "blocked"
]);
export const ReviewerExpectationSchema = z.object({
  expectation_id: z.string(),
  task_id: z.string(),
  attempt_id: z.string(),
  criterion: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(true),
  created_at: z.string().datetime()
});
export const ReviewerFeedbackSchema = z.object({
  feedback_id: z.string(),
  task_id: z.string(),
  attempt_id: z.string(),
  expectation_id: z.string(),
  verdict: ReviewerVerdictSchema,
  notes: z.string().optional(),
  evidence_node_id: z.string().optional(),
  reviewer_type: z.enum(["auto_verifier", "human", "policy_check"]).default("auto_verifier"),
  reviewed_at: z.string().datetime()
});
export const RalphAttemptSchema = z.object({
  attempt_id: z.string(),
  task_id: z.string(),
  attempt_number: z.number().int().positive(),
  parent_attempt_id: z.string().optional(),
  status: z.enum(["in_progress", "review_pending", "accepted", "revise_and_retry", "blocked"]).default("in_progress"),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  review_summary: z.string().optional()
});
export const RalphLoopStateSchema = z.object({
  loop_id: z.string(),
  task_id: z.string(),
  current_attempt_id: z.string(),
  attempt_count: z.number().int().positive().default(1),
  max_attempts: z.number().int().positive().default(5),
  loop_status: z.enum(["iterating", "accepted", "blocked", "stopped"]).default("iterating"),
  accepted_count: z.number().int().nonnegative().default(0),
  revise_count: z.number().int().nonnegative().default(0),
  blocked_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const AutonomousCompletionStateSchema = z.enum([
  "running",
  "paused",
  "retrying",
  "circuit_open",
  "escalated",
  "completed",
  "failed",
  "cancelled"
]);
export const TaskCheckpointSchema = z.object({
  checkpoint_id: z.string(),
  task_id: z.string(),
  step_index: z.number().int().nonnegative(),
  step_description: z.string().optional(),
  state_snapshot: z.record(z.unknown()).default({}),
  created_at: z.string().datetime()
});
export const HeartbeatRecordSchema = z.object({
  heartbeat_id: z.string(),
  task_id: z.string(),
  status: AutonomousCompletionStateSchema,
  progress_note: z.string().optional(),
  retry_count: z.number().int().nonnegative().default(0),
  max_retries: z.number().int().nonnegative().default(3),
  circuit_open: z.boolean().default(false),
  escalated: z.boolean().default(false),
  escalation_reason: z.string().optional(),
  recorded_at: z.string().datetime()
});
export const AutonomousCompletionConfigSchema = z.object({
  max_retries: z.number().int().nonnegative().default(3),
  retry_backoff_ms: z.number().int().positive().default(1000),
  circuit_breaker_threshold: z.number().int().positive().default(5),
  circuit_breaker_reset_ms: z.number().int().positive().default(30000),
  heartbeat_interval_ms: z.number().int().positive().default(10000),
  watchdog_timeout_ms: z.number().int().positive().default(120000),
  auto_escalation: z.boolean().default(true),
  human_judgment_boundaries: z.array(z.string()).default([])
});
export type ApplicabilityRules = z.infer<typeof ApplicabilityRulesSchema>;
export type SkillCandidate = z.infer<typeof SkillCandidateSchema>;
export type CanonicalSkillSource = z.infer<typeof CanonicalSkillSourceSchema>;
export type CanonicalSkillExecutionMode = z.infer<typeof CanonicalSkillExecutionModeSchema>;
export type CanonicalSkillStatus = z.infer<typeof CanonicalSkillStatusSchema>;
export type CanonicalSkillDocumentFormat = z.infer<typeof CanonicalSkillDocumentFormatSchema>;
export type CanonicalSkillSpec = z.infer<typeof CanonicalSkillSpecSchema>;
export type CanonicalSkillBundleSignature = z.infer<typeof CanonicalSkillBundleSignatureSchema>;
export type CanonicalSkillBundlePublisher = z.infer<typeof CanonicalSkillBundlePublisherSchema>;
export type CanonicalSkillBundleProvenanceEvent = z.infer<typeof CanonicalSkillBundleProvenanceEventSchema>;
export type CanonicalSkillBundleProvenance = z.infer<typeof CanonicalSkillBundleProvenanceSchema>;
export type CanonicalSkillBundleManifest = z.infer<typeof CanonicalSkillBundleManifestSchema>;
export type SkillPolicyConfig = z.infer<typeof SkillPolicyConfigSchema>;
export type SkillPolicyScopeName = z.infer<typeof SkillPolicyScopeNameSchema>;
export type PolicyChangeField = z.infer<typeof PolicyChangeFieldSchema>;
export type SkillPolicyProposalKind = z.infer<typeof SkillPolicyProposalKindSchema>;
export type SkillPolicyProposalStatus = z.infer<typeof SkillPolicyProposalStatusSchema>;
export type SkillPolicyProposal = z.infer<typeof SkillPolicyProposalSchema>;
export type PolicyProposalFollowUp = z.infer<typeof PolicyProposalFollowUpSchema>;
export type GovernanceAlert = z.infer<typeof GovernanceAlertSchema>;
export type GovernanceAlertFollowUp = z.infer<typeof GovernanceAlertFollowUpSchema>;
export type InboxItem = z.infer<typeof InboxItemSchema>;
export type InboxItemState = z.infer<typeof InboxItemStateSchema>;
export type EvolutionRunKind = z.infer<typeof EvolutionRunKindSchema>;
export type EvolutionRunStatus = z.infer<typeof EvolutionRunStatusSchema>;
export type EvolutionCandidate = z.infer<typeof EvolutionCandidateSchema>;
export type SkillEvolutionRun = z.infer<typeof SkillEvolutionRunSchema>;
export type PromptEvolutionRun = z.infer<typeof PromptEvolutionRunSchema>;
export type ToolDescriptionEvolutionRun = z.infer<typeof ToolDescriptionEvolutionRunSchema>;
export type EvolutionPromotionDecision = z.infer<typeof EvolutionPromotionDecisionSchema>;
export type EvolutionRollbackRecord = z.infer<typeof EvolutionRollbackRecordSchema>;
export type ClawHubRegistryConfig = z.infer<typeof ClawHubRegistryConfigSchema>;
export type ClawHubSearchResult = z.infer<typeof ClawHubSearchResultSchema>;
export type ClawHubInstallRecord = z.infer<typeof ClawHubInstallRecordSchema>;
export type ClawHubPublishRecord = z.infer<typeof ClawHubPublishRecordSchema>;
export type ClawHubSyncRecord = z.infer<typeof ClawHubSyncRecordSchema>;
export type RemoteSkillTrustVerdict = z.infer<typeof RemoteSkillTrustVerdictSchema>;
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type CapabilityKind = z.infer<typeof CapabilityKindSchema>;
export type CapabilityStrategy = z.infer<typeof CapabilityStrategySchema>;
export type CapabilityDescriptor = z.infer<typeof CapabilityDescriptorSchema>;
export type CapabilityResolution = z.infer<typeof CapabilityResolutionSchema>;
export type CapabilityScoreBreakdown = z.infer<typeof CapabilityScoreBreakdownSchema>;
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;
export type ConnectorAuthStrategy = z.infer<typeof ConnectorAuthStrategySchema>;
export type ConnectorPaginationStrategy = z.infer<typeof ConnectorPaginationStrategySchema>;
export type ConnectorSpec = z.infer<typeof ConnectorSpecSchema>;
export type BrowserSession = z.infer<typeof BrowserSessionSchema>;
export type RuntimeSessionInfo = z.infer<typeof RuntimeSessionInfoSchema>;
export type RuntimeHarnessInfo = z.infer<typeof RuntimeHarnessInfoSchema>;
export type RuntimeSandboxInfo = z.infer<typeof RuntimeSandboxInfoSchema>;
export type RuntimeBoundaryInfo = z.infer<typeof RuntimeBoundaryInfoSchema>;
export type SubagentRole = z.infer<typeof SubagentRoleSchema>;
export type SubagentSession = z.infer<typeof SubagentSessionSchema>;
export type SubagentMessage = z.infer<typeof SubagentMessageSchema>;
export type SubagentCheckpoint = z.infer<typeof SubagentCheckpointSchema>;
export type AgentTeamTimelineEntry = z.infer<typeof AgentTeamTimelineEntrySchema>;
export type SubagentResumeRequest = z.infer<typeof SubagentResumeRequestSchema>;
export type SubagentResumePackage = z.infer<typeof SubagentResumePackageSchema>;
export type SubagentExecutionRun = z.infer<typeof SubagentExecutionRunSchema>;
export type SubagentRuntimeBinding = z.infer<typeof SubagentRuntimeBindingSchema>;
export type SubagentRuntimeInstance = z.infer<typeof SubagentRuntimeInstanceSchema>;
export type SubagentRuntimeLaunchSpec = z.infer<typeof SubagentRuntimeLaunchSpecSchema>;
export type SubagentRuntimeLaunchReceipt = z.infer<typeof SubagentRuntimeLaunchReceiptSchema>;
export type SubagentRuntimeAdapterRun = z.infer<typeof SubagentRuntimeAdapterRunSchema>;
export type SubagentRuntimeRunnerBackendLeaseStatus = z.infer<typeof SubagentRuntimeRunnerBackendLeaseStatusSchema>;
export type SubagentRuntimeRunnerBackendLease = z.infer<typeof SubagentRuntimeRunnerBackendLeaseSchema>;
export type SubagentRuntimeBackendExecution = z.infer<typeof SubagentRuntimeBackendExecutionSchema>;
export type SubagentRuntimeDriverRun = z.infer<typeof SubagentRuntimeDriverRunSchema>;
export type SubagentRuntimeRunnerHandle = z.infer<typeof SubagentRuntimeRunnerHandleSchema>;
export type SubagentRuntimeRunnerExecution = z.infer<typeof SubagentRuntimeRunnerExecutionSchema>;
export type SubagentRuntimeRunnerJobKind = z.infer<typeof SubagentRuntimeRunnerJobKindSchema>;
export type SubagentRuntimeRunnerJobStatus = z.infer<typeof SubagentRuntimeRunnerJobStatusSchema>;
export type SubagentRuntimeRunnerJob = z.infer<typeof SubagentRuntimeRunnerJobSchema>;
export type SubagentRuntimeRunnerBackendAdapterId = z.infer<typeof SubagentRuntimeRunnerBackendAdapterIdSchema>;
export type SubagentRuntimeRunnerBackendAdapterCatalogEntry = z.infer<typeof SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema>;
export type SubagentRuntimeRunnerBackendAdapterStatus = z.infer<typeof SubagentRuntimeRunnerBackendAdapterStatusSchema>;
export type SubagentRuntimeLauncherCatalogEntry = z.infer<typeof SubagentRuntimeLauncherCatalogEntrySchema>;
export type SubagentRuntimeLauncherStatus = z.infer<typeof SubagentRuntimeLauncherStatusSchema>;
export type SubagentRuntimeLauncherDriverId = z.infer<typeof SubagentRuntimeLauncherDriverIdSchema>;
export type SubagentRuntimeLauncherDriverCatalogEntry = z.infer<typeof SubagentRuntimeLauncherDriverCatalogEntrySchema>;
export type SubagentRuntimeLauncherDriverStatus = z.infer<typeof SubagentRuntimeLauncherDriverStatusSchema>;
export type SubagentRuntimeLauncherBackendAdapterId = z.infer<typeof SubagentRuntimeLauncherBackendAdapterIdSchema>;
export type SubagentRuntimeLauncherBackendAdapterCatalogEntry = z.infer<typeof SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema>;
export type SubagentRuntimeLauncherBackendAdapterStatus = z.infer<typeof SubagentRuntimeLauncherBackendAdapterStatusSchema>;
export type AgentTeamSummary = z.infer<typeof AgentTeamSummarySchema>;
export type WorkerKind = z.infer<typeof WorkerKindSchema>;
export type WorkerRun = z.infer<typeof WorkerRunSchema>;
export type DelegatedResumePackage = z.infer<typeof DelegatedResumePackageSchema>;
export type WorkerSupervisionEvent = z.infer<typeof WorkerSupervisionEventSchema>;
export type ScheduledJobRetryPolicy = z.infer<typeof ScheduledJobRetryPolicySchema>;
export type MissedRunPolicy = z.infer<typeof MissedRunPolicySchema>;
export type DeerFlowWorkerRoute = z.infer<typeof DeerFlowWorkerRouteSchema>;
export type CloudSyncEnvelope = z.infer<typeof CloudSyncEnvelopeSchema>;
export type CloudControlPlaneConfig = z.infer<typeof CloudControlPlaneConfigSchema>;
export type OrchestratorMode = z.infer<typeof OrchestratorModeSchema>;
export type OrchestratorBoundaryConfig = z.infer<typeof OrchestratorBoundaryConfigSchema>;
export type WorkflowContractShape = z.infer<typeof WorkflowContractShapeSchema>;
export type SSOProviderKind = z.infer<typeof SSOProviderKindSchema>;
export type SSOProviderBoundary = z.infer<typeof SSOProviderBoundarySchema>;
export type OrgTenant = z.infer<typeof OrgTenantSchema>;
export type ClaimsToPolicyMapping = z.infer<typeof ClaimsToPolicyMappingSchema>;
export type DeerFlowRuntimeMode = z.infer<typeof DeerFlowRuntimeModeSchema>;
export type DeerFlowBackboneReadiness = z.infer<typeof DeerFlowBackboneReadinessSchema>;
export type OSIsolationBackendKind = z.infer<typeof OSIsolationBackendKindSchema>;
export type OSIsolationBackend = z.infer<typeof OSIsolationBackendSchema>;
export type IsolationPolicyToBackendMapping = z.infer<typeof IsolationPolicyToBackendMappingSchema>;
export type ExternalReadinessStatus = z.infer<typeof ExternalReadinessStatusSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type DoneGateResult = z.infer<typeof DoneGateResultSchema>;
export type EvidenceNodeKind = z.infer<typeof EvidenceNodeKindSchema>;
export type EvidenceNodeStatus = z.infer<typeof EvidenceNodeStatusSchema>;
export type EvidenceNode = z.infer<typeof EvidenceNodeSchema>;
export type EvidenceGraph = z.infer<typeof EvidenceGraphSchema>;
export type CompletionEngineVerdict = z.infer<typeof CompletionEngineVerdictSchema>;
export type CompletionEngineResult = z.infer<typeof CompletionEngineResultSchema>;

export const CloudSyncEnvelopeSchema = z.object({
  envelope_id: z.string(),
  source_tenant_id: z.string(),
  source_device_id: z.string(),
  target_cloud_endpoint: z.string().optional(),
  sync_kind: z.enum(["audit_upload", "policy_download", "session_sync", "memory_sync", "task_state_sync", "governance_sync"]),
  payload_hash: z.string().optional(),
  payload_size_bytes: z.number().int().nonnegative().default(0),
  status: z.enum(["prepared", "sent", "acknowledged", "failed", "conflict"]).default("prepared"),
  created_at: z.string().datetime(),
  sent_at: z.string().datetime().optional(),
  acknowledged_at: z.string().datetime().optional()
});

export const CloudControlPlaneConfigSchema = z.object({
  config_id: z.string(),
  mode: z.enum(["local_only", "cloud_augmented", "cloud_primary"]).default("local_only"),
  cloud_endpoint: z.string().optional(),
  sync_interval_ms: z.number().int().positive().default(30000),
  auth_provider: z.enum(["none", "api_key", "oauth2", "saml"]).default("none"),
  tenant_id: z.string().optional(),
  device_id: z.string().optional(),
  retry_policy: z.object({
    max_retries: z.number().int().nonnegative().default(3),
    backoff_base_ms: z.number().int().positive().default(1000),
    max_backoff_ms: z.number().int().positive().default(60000)
  }).default({}),
  conflict_resolution: z.enum(["local_wins", "cloud_wins", "newest_wins", "manual"]).default("local_wins"),
  created_at: z.string().datetime()
});

export const OrchestratorModeSchema = z.enum(["local_typed_runtime", "temporal_workflow", "langgraph_graph", "hybrid"]);

export const OrchestratorBoundaryConfigSchema = z.object({
  config_id: z.string(),
  active_mode: OrchestratorModeSchema.default("local_typed_runtime"),
  temporal_endpoint: z.string().optional(),
  temporal_namespace: z.string().optional(),
  langgraph_endpoint: z.string().optional(),
  langgraph_graph_name: z.string().optional(),
  fallback_mode: OrchestratorModeSchema.default("local_typed_runtime"),
  translation_enabled: z.boolean().default(false),
  dry_run: z.boolean().default(true),
  created_at: z.string().datetime()
});

export const WorkflowContractShapeSchema = z.object({
  shape_id: z.string(),
  workflow_name: z.string(),
  orchestrator_target: z.enum(["temporal", "langgraph", "local_runtime"]),
  input_schema: z.record(z.unknown()).default({}),
  output_schema: z.record(z.unknown()).default({}),
  signal_schemas: z.array(z.record(z.unknown())).default([]),
  query_schemas: z.array(z.record(z.unknown())).default([]),
  created_at: z.string().datetime()
});

export const SSOProviderKindSchema = z.enum(["none", "okta", "azure_ad", "clerk", "custom_oidc", "custom_saml"]);

export const SSOProviderBoundarySchema = z.object({
  provider_id: z.string(),
  provider_kind: SSOProviderKindSchema,
  display_name: z.string(),
  issuer_url: z.string().optional(),
  client_id: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  claims_mapping: z.record(z.string()).default({}),
  active: z.boolean().default(false),
  created_at: z.string().datetime()
});

export const OrgTenantSchema = z.object({
  tenant_id: z.string(),
  org_name: z.string(),
  tier: z.enum(["personal", "team", "enterprise"]).default("personal"),
  sso_provider_id: z.string().optional(),
  fleet_policy_id: z.string().optional(),
  role_definitions: z.array(z.object({
    role_name: z.string(),
    permissions: z.array(z.string()).default([])
  })).default([]),
  created_at: z.string().datetime()
});

export const ClaimsToPolicyMappingSchema = z.object({
  mapping_id: z.string(),
  provider_id: z.string(),
  claim_path: z.string(),
  policy_field: z.string(),
  transform: z.enum(["direct", "prefix", "regex_extract", "lookup"]).default("direct"),
  transform_config: z.record(z.unknown()).default({}),
  created_at: z.string().datetime()
});

export const DeerFlowRuntimeModeSchema = z.enum(["local_backbone", "deerflow_worker_lane", "hybrid"]);

export const DeerFlowBackboneReadinessSchema = z.object({
  readiness_id: z.string(),
  runtime_mode: DeerFlowRuntimeModeSchema.default("local_backbone"),
  deerflow_endpoint: z.string().optional(),
  deerflow_api_version: z.string().optional(),
  health_check_interval_ms: z.number().int().positive().default(30000),
  worker_registration_enabled: z.boolean().default(false),
  translation_contracts_version: z.string().default("0.1.0"),
  fallback_to_local: z.boolean().default(true),
  diagnostics_enabled: z.boolean().default(true),
  created_at: z.string().datetime()
});

export const OSIsolationBackendKindSchema = z.enum(["rule_based", "windows_job_object", "windows_mandatory_integrity", "linux_cgroups", "linux_namespaces", "container_docker", "container_podman", "vm_hyperv", "vm_kvm"]);

export const OSIsolationBackendSchema = z.object({
  backend_id: z.string(),
  backend_kind: OSIsolationBackendKindSchema,
  display_name: z.string(),
  platform: z.enum(["windows", "linux", "macos", "cross_platform"]).default("windows"),
  capability_level: z.enum(["none", "filesystem_restriction", "network_restriction", "process_restriction", "full_isolation"]).default("none"),
  available: z.boolean().default(false),
  detection_command: z.string().optional(),
  config_schema: z.record(z.unknown()).default({}),
  created_at: z.string().datetime()
});

export const IsolationPolicyToBackendMappingSchema = z.object({
  mapping_id: z.string(),
  sandbox_tier: z.enum(["host_readonly", "guarded_mutation", "isolated_mutation"]),
  backend_id: z.string(),
  enforcement_level: z.enum(["rule_only", "policy_translated", "backend_enforced"]).default("rule_only"),
  translated_capabilities: z.array(z.string()).default([]),
  created_at: z.string().datetime()
});

export const ExternalReadinessStatusSchema = z.object({
  layer: z.string(),
  status: z.enum(["not_prepared", "contracts_only", "adapter_boundary", "dry_run_available", "ready_for_integration"]),
  blocking_dependencies: z.array(z.string()).default([]),
  notes: z.string().optional()
});

export function createTaskId(): string {
  return `task_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function createEntityId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function buildDefaultTask(input: {
  task_type: z.infer<typeof TaskTypeSchema>;
  intent: string;
  department: z.infer<typeof DepartmentSchema>;
  risk_level: z.infer<typeof RiskLevelSchema>;
  initiator: z.infer<typeof InitiatorSchema>;
  inputs?: Record<string, unknown>;
  definition_of_done?: Partial<z.infer<typeof CompletionContractSchema>>;
}): TaskContract {
  return TaskContractSchema.parse({
    task_id: createTaskId(),
    task_type: input.task_type,
    intent: input.intent,
    department: input.department,
    risk_level: input.risk_level,
    status: "created",
    initiator: input.initiator,
    inputs: input.inputs ?? {},
    definition_of_done: {
      goal: input.definition_of_done?.goal ?? input.intent,
      completion_criteria: input.definition_of_done?.completion_criteria ?? [],
      acceptance_tests: input.definition_of_done?.acceptance_tests ?? [],
      required_artifacts: input.definition_of_done?.required_artifacts ?? [],
      approval_requirements: input.definition_of_done?.approval_requirements ?? [],
      deadline_or_sla: input.definition_of_done?.deadline_or_sla
    },
    timestamps: {
      created_at: nowIso()
    }
  });
}

export const ScreenCaptureEngineSchema = z.enum(["native_screenshot", "playwright_page", "accessibility_tree", "ocr_fallback"]);
export const ScreenCaptureSchema = z.object({
  capture_id: z.string(),
  task_id: z.string().optional(),
  session_id: z.string().optional(),
  engine: ScreenCaptureEngineSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pixel_data_ref: z.string().optional(),
  mime_type: z.string().default("image/png"),
  size_bytes: z.number().int().nonnegative().default(0),
  window_title: z.string().optional(),
  window_class: z.string().optional(),
  display_index: z.number().int().nonnegative().default(0),
  region: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }).optional(),
  captured_at: z.string().datetime()
});

export const UIElementRoleSchema = z.enum([
  "button", "link", "input", "textarea", "select", "checkbox", "radio",
  "menu", "menuitem", "option", "listitem", "tab", "dialog", "alert", "table", "row", "cell",
  "heading", "paragraph", "image", "icon", "toolbar", "statusbar",
  "window", "pane", "scrollbar", "slider", "progress", "unknown"
]);
export const UIElementSchema = z.object({
  element_id: z.string(),
  role: UIElementRoleSchema,
  label: z.string().optional(),
  text_content: z.string().optional(),
  value: z.string().optional(),
  bounding_box: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative()
  }),
  is_visible: z.boolean().default(true),
  is_enabled: z.boolean().default(true),
  is_focused: z.boolean().default(false),
  is_interactive: z.boolean().default(false),
  attributes: z.record(z.string()).default({}),
  children_ids: z.array(z.string()).default([]),
  parent_id: z.string().optional()
});

export const ComputerUseElementStateSchema = z.object({
  exists: z.boolean().default(true),
  visible: z.boolean().default(true),
  enabled: z.boolean().default(true),
  focused: z.boolean().default(false),
  text_content: z.string().optional(),
  value: z.string().optional(),
  checked: z.boolean().optional(),
  selected: z.boolean().optional(),
  expanded: z.boolean().optional(),
  disabled: z.boolean().optional(),
  label: z.string().optional(),
  attributes: z.record(z.string()).default({})
});

export const ComputerUseVisualDiffSchema = z.object({
  compared: z.boolean().default(false),
  changed: z.boolean().default(false),
  similarity_score: z.number().min(0).max(1).default(0),
  comparison_mode: z.enum(["exact_hash", "sampled_byte_similarity", "unavailable"]).default("unavailable"),
  before_capture_id: z.string().optional(),
  after_capture_id: z.string().optional(),
  details: z.record(z.unknown()).default({})
});

export const ComputerUseVerificationEvidenceSchema = z.object({
  verdict: z.enum(["confirmed", "mismatch", "error"]),
  provider: z.string().optional(),
  method: z.string().optional(),
  confidence_score: z.number().min(0).max(1).default(0),
  reasons: z.array(z.string()).default([]),
  post_check: z.object({
    elementStillExists: z.boolean().default(false),
    elementStillVisible: z.boolean().default(false),
    valueChanged: z.boolean().default(false),
    focusChanged: z.boolean().default(false),
    stateSnapshot: z.record(z.unknown()).optional()
  }).optional(),
  state_before: ComputerUseElementStateSchema.optional(),
  state_after: ComputerUseElementStateSchema.optional(),
  screenshot_diff: ComputerUseVisualDiffSchema.optional(),
  created_at: z.string().datetime()
});

export const UIPerceptionEngineSchema = z.enum(["accessibility_api", "ocr", "hybrid", "playwright_dom", "playwright_dom_firefox", "playwright_dom_webkit"]);
export const UIPerceptionSchema = z.object({
  perception_id: z.string(),
  task_id: z.string().optional(),
  session_id: z.string().optional(),
  capture_id: z.string().optional(),
  engine: UIPerceptionEngineSchema,
  screen_width: z.number().int().positive(),
  screen_height: z.number().int().positive(),
  elements: z.array(UIElementSchema).default([]),
  active_window_title: z.string().optional(),
  focused_element_id: z.string().optional(),
  ocr_full_text: z.string().optional(),
  perceived_at: z.string().datetime()
});

export const InputActionKindSchema = z.enum([
  "mouse_click", "mouse_double_click", "mouse_right_click",
  "mouse_move", "mouse_drag", "mouse_scroll",
  "key_press", "key_combo", "type_text",
  "focus_element", "select_option"
]);
export const InputActionSchema = z.object({
  action_id: z.string(),
  task_id: z.string().optional(),
  session_id: z.string().optional(),
  kind: InputActionKindSchema,
  target_element_id: z.string().optional(),
  coordinates: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative()
  }).optional(),
  button: z.enum(["left", "right", "middle"]).default("left"),
  key: z.string().optional(),
  key_combo: z.array(z.string()).default([]),
  text: z.string().optional(),
  scroll_delta: z.number().int().default(0),
  duration_ms: z.number().int().nonnegative().default(0),
  executed: z.boolean().default(false),
  executed_at: z.string().datetime().optional(),
  result: z.enum(["success", "element_not_found", "timeout", "blocked_by_policy", "error"]).optional(),
  provider: z.string().optional(),
  execution_method: z.string().optional(),
  verification_evidence: ComputerUseVerificationEvidenceSchema.optional(),
  error_message: z.string().optional(),
  created_at: z.string().datetime()
});

export const ComputerUseStepKindSchema = z.enum(["see", "act", "verify", "recover"]);
export const ComputerUseStepSchema = z.object({
  step_id: z.string(),
  session_id: z.string(),
  step_number: z.number().int().positive(),
  kind: ComputerUseStepKindSchema,
  perception_id: z.string().optional(),
  action_id: z.string().optional(),
  intention: z.string(),
  observation: z.string().optional(),
  verification_result: z.enum(["confirmed", "mismatch", "error", "pending"]).optional(),
  recovery_strategy: z.enum(["retry", "adjust_action", "escalate", "abort"]).optional(),
  verification_evidence: ComputerUseVerificationEvidenceSchema.optional(),
  details: z.record(z.unknown()).default({}),
  duration_ms: z.number().int().nonnegative().default(0),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional()
});

export const ComputerUseSessionStatusSchema = z.enum(["active", "paused", "completed", "failed", "human_takeover", "cancelled"]);
export const ComputerUseSessionSchema = z.object({
  session_id: z.string(),
  task_id: z.string(),
  status: ComputerUseSessionStatusSchema.default("active"),
  step_count: z.number().int().nonnegative().default(0),
  current_step_id: z.string().optional(),
  max_steps: z.number().int().positive().default(50),
  perception_engine: UIPerceptionEngineSchema.default("accessibility_api"),
  capture_engine: ScreenCaptureEngineSchema.default("native_screenshot"),
  sandbox_tier: z.enum(["host_readonly", "guarded_mutation", "isolated_mutation"]).default("guarded_mutation"),
  requires_confirmation: z.boolean().default(true),
  human_takeover_count: z.number().int().nonnegative().default(0),
  last_perception_id: z.string().optional(),
  last_capture_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional()
});

export const HumanTakeoverReasonSchema = z.enum([
  "user_requested", "policy_block", "max_steps_reached",
  "verification_failed_repeatedly", "ambiguous_state",
  "unsafe_action_detected", "escalation"
]);
export const HumanTakeoverSchema = z.object({
  takeover_id: z.string(),
  session_id: z.string(),
  task_id: z.string(),
  reason: HumanTakeoverReasonSchema,
  step_id: z.string().optional(),
  description: z.string(),
  perception_snapshot: z.string().optional(),
  pending_action: z.string().optional(),
  resolution: z.enum(["resumed", "modified_and_resumed", "cancelled"]).optional(),
  resolved_by: z.string().optional(),
  resolved_at: z.string().datetime().optional(),
  created_at: z.string().datetime()
});

export const ComputerUseReplayStepSchema = z.object({
  replay_step_id: z.string(),
  session_id: z.string(),
  step_id: z.string(),
  step_number: z.number().int().positive(),
  perception: UIPerceptionSchema.optional(),
  action: InputActionSchema.optional(),
  capture: ScreenCaptureSchema.optional(),
  verification_evidence: ComputerUseVerificationEvidenceSchema.optional(),
  replayed: z.boolean().default(false),
  replay_result: z.enum(["matched", "mismatched", "skipped", "error"]).optional()
});

export type ScreenCaptureEngine = z.infer<typeof ScreenCaptureEngineSchema>;
export type ScreenCapture = z.infer<typeof ScreenCaptureSchema>;
export type UIElementRole = z.infer<typeof UIElementRoleSchema>;
export type UIElement = z.infer<typeof UIElementSchema>;
export type ComputerUseElementState = z.infer<typeof ComputerUseElementStateSchema>;
export type ComputerUseVisualDiff = z.infer<typeof ComputerUseVisualDiffSchema>;
export type ComputerUseVerificationEvidence = z.infer<typeof ComputerUseVerificationEvidenceSchema>;
export type UIPerceptionEngine = z.infer<typeof UIPerceptionEngineSchema>;
export type UIPerception = z.infer<typeof UIPerceptionSchema>;
export type InputActionKind = z.infer<typeof InputActionKindSchema>;
export type InputAction = z.infer<typeof InputActionSchema>;
export type ComputerUseStepKind = z.infer<typeof ComputerUseStepKindSchema>;
export type ComputerUseStep = z.infer<typeof ComputerUseStepSchema>;
export type ComputerUseSessionStatus = z.infer<typeof ComputerUseSessionStatusSchema>;
export type ComputerUseSession = z.infer<typeof ComputerUseSessionSchema>;
export type HumanTakeoverReason = z.infer<typeof HumanTakeoverReasonSchema>;
export type HumanTakeover = z.infer<typeof HumanTakeoverSchema>;
export type ComputerUseReplayStep = z.infer<typeof ComputerUseReplayStepSchema>;

export function buildSuggestedDefinitionOfDone(task: Pick<TaskContract, "intent" | "task_type" | "department">): CompletionContract {
  const baseArtifacts = [
    `${task.department}_summary.md`,
    "execution_log.json",
    "verification_report.json"
  ];
  const departmentArtifact =
    task.department === "engineering"
      ? "implementation_notes.md"
      : task.department === "qa"
        ? "test_results.md"
        : task.department === "sales"
          ? "sales_actions.md"
          : task.department === "marketing"
            ? "campaign_output.md"
            : task.department === "hr"
              ? "hr_actions.md"
              : task.department === "finance"
                ? "finance_summary.md"
                : "task_output.md";

  return CompletionContractSchema.parse({
    goal: task.intent,
    completion_criteria: [
      "Execution plan is finished without failed mandatory steps.",
      "All required artifacts are generated and marked ready.",
      "Verification and reconciliation both pass."
    ],
    acceptance_tests: [
      "Checklist runner passes all mandatory items.",
      "Verifier reports pass or pass_with_notes with no policy issues."
    ],
    required_artifacts: [...new Set([...baseArtifacts, departmentArtifact])],
    approval_requirements: task.task_type === "scheduled" ? ["schedule_owner_review"] : []
  });
}
