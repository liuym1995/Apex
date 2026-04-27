import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AgentTeamSummary,
  Artifact,
  AuditEntry,
  BrowserSession,
  CanonicalSkillSpec,
  CapabilityResolution,
  CapabilityScoreBreakdown,
  Checkpoint,
  ChecklistRunResult,
  CompletionEngineResult,
  DoneGateResult,
  EvidenceGraph,
  GovernanceAlert,
  InboxItemState,
  LearningFactoryBacklogItem,
  LearningFactoryPipeline,
  EventLedgerEntry,
  EventProjection,
  OutboxEntry,
  PolicyDecision,
  PolicyEnforcementAction,
  PolicyRule,
  LocalCapability,
  AutonomousCompletionConfig,
  TaskCheckpoint,
  HeartbeatRecord,
  ReviewerExpectation,
  ReviewerFeedback,
  RalphAttempt,
  RalphLoopState,
  TraceSpan,
  RunTimeline,
  CostBreakdown,
  SLOMetric,
  EgressRule,
  EgressRequest,
  EgressAudit,
  CQSCommand,
  CQSQuery,
  CQSEvent,
  ExperimentRun,
  SandboxManifest,
  TaskControlCommand,
  MethodLineage,
  OperationalMetrics,
  ReplayPackage,
  ModelRoute,
  ModelRequest,
  AutomationDefinition,
  AutomationTriggerRecord,
  WikiPage,
  ExecutionStep,
  TaskRun,
  TaskAttempt,
  WorkerSession,
  SandboxLease,
  ExecutionHarness,
  ReuseFeedback,
  ScheduledJob,
  CheckpointSnapshot,
  EventSubscription,
  SLOAlert,
  MemoryDirectory,
  MemoryDocument,
  MemoryDocumentSection,
  MemoryItem,
  MemoryRetrievalTrace,
  ReconciliationRunResult,
  Schedule,
  SkillPolicyProposal,
  SkillCandidate,
  SubagentResumeRequest,
  SubagentResumePackage,
  SubagentExecutionRun,
  SubagentRuntimeBinding,
  SubagentRuntimeInstance,
  SubagentRuntimeLaunchReceipt,
  SubagentRuntimeAdapterRun,
  SubagentRuntimeRunnerBackendLease,
  SubagentRuntimeBackendExecution,
  SubagentRuntimeDriverRun,
  SubagentRuntimeRunnerHandle,
  SubagentRuntimeRunnerExecution,
  SubagentRuntimeRunnerJob,
  SubagentCheckpoint,
  TaskTemplate,
  TaskContract,
  ToolInvocation,
  SubagentMessage,
  SubagentSession,
  VerificationRunResult,
  WorkerRun,
  ScreenCapture,
  UIPerception,
  InputAction,
  ComputerUseStep,
  ComputerUseSession,
  HumanTakeover,
  ComputerUseReplayStep,
  DelegatedResumePackage,
  WorkerSupervisionEvent,
  DeerFlowWorkerRoute,
  CloudSyncEnvelope,
  CloudControlPlaneConfig,
  OrchestratorBoundaryConfig,
  WorkflowContractShape,
  SSOProviderBoundary,
  OrgTenant,
  ClaimsToPolicyMapping,
  DeerFlowBackboneReadiness,
  OSIsolationBackend,
  IsolationPolicyToBackendMapping
} from "@apex/shared-types";

export interface PrivilegedOperationContract {
  contract_id: string;
  operation_kind: string;
  display_name: string;
  description: string;
  requires_admin: boolean;
  expected_command: string;
  rollback_command?: string;
  rollback_notes?: string;
  risk_level: string;
  affected_system_area: string;
  prerequisites: string[];
  verification_command?: string;
  readiness_status: string;
  last_checked_at?: string;
  created_at: string;
}

export interface AdminOperationRegistryEntry {
  entry_id: string;
  operation_kind: string;
  reason: string;
  expected_command: string;
  rollback_notes: string;
  impact_if_unavailable: string;
  alternative_approach?: string;
  created_at: string;
}

export interface ElevationDryRunResult {
  dry_run_id: string;
  operation_kind: string;
  would_succeed: boolean;
  would_require_elevation: boolean;
  current_elevation_status: string;
  simulated_command: string;
  simulated_output?: string;
  simulated_exit_code?: number;
  warnings: string[];
  prerequisites_met: boolean;
  missing_prerequisites: string[];
  readiness_after: string;
  created_at: string;
}

export interface PrivilegedRunRunbook {
  runbook_id: string;
  title: string;
  operation_kinds: string[];
  steps: Array<{
    step_number: number;
    description: string;
    command?: string;
    expected_outcome: string;
    verification?: string;
    rollback_step?: number;
    requires_elevation: boolean;
    risk_notes?: string;
  }>;
  total_elevation_steps: number;
  estimated_duration_minutes?: number;
  prerequisites: string[];
  rollback_plan: string;
  created_at: string;
}

export interface RuntimeDiagnostics {
  diagnostics_id: string;
  runtime_kind: string;
  install_state: string;
  detected_version?: string;
  required_version?: string;
  install_path?: string;
  blocker_reason?: string;
  detection_command: string;
  detection_output?: string;
  last_checked_at: string;
  created_at: string;
}

export interface BootstrapPlan {
  plan_id: string;
  runtime_kind: string;
  title: string;
  description: string;
  steps: Array<{
    step_number: number;
    description: string;
    command?: string;
    expected_outcome: string;
    verification_command?: string;
    is_optional: boolean;
    platform: string;
    estimated_duration_minutes?: number;
  }>;
  total_steps: number;
  required_steps: number;
  optional_steps: number;
  post_install_verification_command?: string;
  created_at: string;
}

export interface PostInstallVerification {
  verification_id: string;
  runtime_kind: string;
  passed: boolean;
  checks: Array<{
    check_name: string;
    passed: boolean;
    actual_value?: string;
    expected_value?: string;
    details?: string;
  }>;
  overall_result: string;
  created_at: string;
}

export interface EndpointConfig {
  config_id: string;
  endpoint_kind: string;
  display_name: string;
  description: string;
  url?: string;
  port?: number;
  protocol?: string;
  status: string;
  required_env_vars: Array<{
    var_name: string;
    description: string;
    is_secret: boolean;
    is_required: boolean;
    example_value?: string;
  }>;
  configured_env_vars: string[];
  missing_env_vars: string[];
  connectivity_preflight: {
    attempted: boolean;
    reachable?: boolean;
    response_time_ms?: number;
    error?: string;
    checked_at?: string;
  };
  redacted_config?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface OnboardingRunbook {
  runbook_id: string;
  endpoint_kind: string;
  title: string;
  setup_steps: Array<{
    step_number: number;
    description: string;
    command?: string;
    expected_outcome: string;
    verification?: string;
  }>;
  expected_secret_inventory: Array<{
    secret_name: string;
    description: string;
    source_hint: string;
  }>;
  verification_steps: Array<{
    step_number: number;
    description: string;
    command?: string;
    expected_result: string;
  }>;
  troubleshooting: Array<{
    symptom: string;
    likely_cause: string;
    resolution: string;
  }>;
  created_at: string;
}

export interface ReadinessMatrix {
  matrix_id: string;
  title: string;
  entries: Array<{
    entry_id: string;
    category: string;
    item_name: string;
    description: string;
    current_status: string;
    blocking_reason?: string;
    remediation?: string;
    impact_level: string;
    source_layer: string;
    related_entity_id?: string;
    created_at: string;
  }>;
  summary: {
    total_items: number;
    ready_now_count: number;
    needs_admin_count: number;
    needs_install_count: number;
    needs_credential_count: number;
    needs_external_endpoint_count: number;
    needs_unavailable_host_count: number;
    readiness_percentage: number;
    blocking_count: number;
    degraded_count: number;
    optional_count: number;
  };
  generated_at: string;
}

export interface LocalAppInvocation {
  invocation_id: string;
  app_identifier: string;
  method: "launch" | "open_file" | "open_url" | "send_command";
  arguments: string[];
  working_directory?: string;
  environment?: Record<string, string>;
  timeout_ms: number;
  started_at: string;
  completed_at?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  task_id?: string;
  session_id?: string;
}

type PersistedEntity = {
  entity_id: string;
  payload_json: string;
};

type PersistedCollection = {
  entry_id: string;
  payload_json: string;
};

function resolveDbPath(): string {
  return process.env.APEX_LOCAL_DB_PATH ?? resolve(process.cwd(), ".apex", "local-control-plane.sqlite");
}

const sqlitePath = resolveDbPath();
mkdirSync(dirname(sqlitePath), { recursive: true });

const db = new DatabaseSync(sqlitePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS state_entries (
    namespace TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    task_id TEXT,
    created_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(namespace, entity_id)
  );
  CREATE INDEX IF NOT EXISTS idx_state_entries_namespace_task_id
    ON state_entries(namespace, task_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_state_entries_namespace_updated_at
    ON state_entries(namespace, updated_at DESC);

  CREATE TABLE IF NOT EXISTS state_collections (
    namespace TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    task_id TEXT,
    created_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(namespace, entry_id)
  );
  CREATE INDEX IF NOT EXISTS idx_state_collections_namespace_task_id
    ON state_collections(namespace, task_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_state_collections_namespace_updated_at
    ON state_collections(namespace, updated_at DESC);
`);

const statements = {
  mapUpsert: db.prepare(`
    INSERT INTO state_entries(namespace, entity_id, payload_json, task_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(namespace, entity_id) DO UPDATE SET
      payload_json = excluded.payload_json,
      task_id = excluded.task_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `),
  mapGet: db.prepare(`
    SELECT entity_id, payload_json
    FROM state_entries
    WHERE namespace = ? AND entity_id = ?
  `),
  mapList: db.prepare(`
    SELECT entity_id, payload_json
    FROM state_entries
    WHERE namespace = ?
    ORDER BY updated_at ASC, entity_id ASC
  `),
  mapCount: db.prepare(`
    SELECT COUNT(*) AS total
    FROM state_entries
    WHERE namespace = ?
  `),
  mapDelete: db.prepare(`
    DELETE FROM state_entries
    WHERE namespace = ? AND entity_id = ?
  `),
  collectionUpsert: db.prepare(`
    INSERT INTO state_collections(namespace, entry_id, payload_json, task_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(namespace, entry_id) DO UPDATE SET
      payload_json = excluded.payload_json,
      task_id = excluded.task_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `),
  collectionList: db.prepare(`
    SELECT entry_id, payload_json
    FROM state_collections
    WHERE namespace = ?
    ORDER BY created_at ASC, updated_at ASC, entry_id ASC
  `),
  collectionCount: db.prepare(`
    SELECT COUNT(*) AS total
    FROM state_collections
    WHERE namespace = ?
  `)
};

function asJson<T>(value: T): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function inferTaskId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.task_id === "string" ? record.task_id : null;
}

function inferTimestamp(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const createdAt = record.created_at;
  if (typeof createdAt === "string") return createdAt;
  const timestamps = record.timestamps;
  if (timestamps && typeof timestamps === "object") {
    const nestedCreatedAt = (timestamps as Record<string, unknown>).created_at;
    if (typeof nestedCreatedAt === "string") return nestedCreatedAt;
  }
  return null;
}

class SqliteEntityMap<T extends object> {
  private readonly namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  set(id: string, value: T): this {
    const now = new Date().toISOString();
    statements.mapUpsert.run(
      this.namespace,
      id,
      asJson(value),
      inferTaskId(value),
      inferTimestamp(value),
      now
    );
    return this;
  }

  get(id: string): T | undefined {
    const row = statements.mapGet.get(this.namespace, id) as PersistedEntity | undefined;
    return row ? parseJson<T>(row.payload_json) : undefined;
  }

  has(id: string): boolean {
    return Boolean(this.get(id));
  }

  values(): IterableIterator<T> {
    const rows = statements.mapList.all(this.namespace) as PersistedEntity[];
    return rows.map(row => parseJson<T>(row.payload_json))[Symbol.iterator]();
  }

  get size(): number {
    const row = statements.mapCount.get(this.namespace) as { total: number };
    return row.total;
  }

  delete(id: string): boolean {
    const existing = this.get(id);
    if (!existing) return false;
    statements.mapDelete.run(this.namespace, id);
    return true;
  }
}

class SqliteEntityCollection<T extends object> {
  private readonly namespace: string;
  private readonly idKey: keyof T & string;

  constructor(namespace: string, idKey: keyof T & string) {
    this.namespace = namespace;
    this.idKey = idKey;
  }

  push(value: T): number {
    const now = new Date().toISOString();
    const entryId = String((value as Record<string, unknown>)[this.idKey]);
    statements.collectionUpsert.run(
      this.namespace,
      entryId,
      asJson(value),
      inferTaskId(value),
      inferTimestamp(value),
      now
    );
    return this.size;
  }

  filter(predicate: (value: T, index: number, array: T[]) => boolean): T[] {
    return this.toArray().filter(predicate);
  }

  toArray(): T[] {
    const rows = statements.collectionList.all(this.namespace) as PersistedCollection[];
    return rows.map(row => parseJson<T>(row.payload_json));
  }

  values(): IterableIterator<T> {
    return this.toArray()[Symbol.iterator]();
  }

  get size(): number {
    const row = statements.collectionCount.get(this.namespace) as { total: number };
    return row.total;
  }
}

export const stateBackendInfo = {
  kind: "sqlite",
  driver: "node:sqlite",
  path: sqlitePath
} as const;

export const store = {
  tasks: new SqliteEntityMap<TaskContract>("tasks"),
  audits: new SqliteEntityCollection<AuditEntry>("audits", "audit_id"),
  artifacts: new SqliteEntityMap<Artifact>("artifacts"),
  checkpoints: new SqliteEntityMap<Checkpoint>("checkpoints"),
  checklistResults: new SqliteEntityMap<ChecklistRunResult>("checklist_results"),
  reconciliationResults: new SqliteEntityMap<ReconciliationRunResult>("reconciliation_results"),
  verificationResults: new SqliteEntityMap<VerificationRunResult>("verification_results"),
  doneGateResults: new SqliteEntityMap<DoneGateResult>("done_gate_results"),
  memoryItems: new SqliteEntityMap<MemoryItem>("memory_items"),
  canonicalSkills: new SqliteEntityMap<CanonicalSkillSpec>("canonical_skills"),
  skillPolicyProposals: new SqliteEntityMap<SkillPolicyProposal>("skill_policy_proposals"),
  schedules: new SqliteEntityMap<Schedule>("schedules"),
  skillCandidates: new SqliteEntityMap<SkillCandidate>("skill_candidates"),
  taskTemplates: new SqliteEntityMap<TaskTemplate>("task_templates"),
  capabilityResolutions: new SqliteEntityMap<CapabilityResolution>("capability_resolutions"),
  toolInvocations: new SqliteEntityMap<ToolInvocation>("tool_invocations"),
  browserSessions: new SqliteEntityMap<BrowserSession>("browser_sessions"),
  workerRuns: new SqliteEntityMap<WorkerRun>("worker_runs"),
  agentTeams: new SqliteEntityMap<AgentTeamSummary>("agent_teams"),
  subagentSessions: new SqliteEntityMap<SubagentSession>("subagent_sessions"),
  subagentMessages: new SqliteEntityCollection<SubagentMessage>("subagent_messages", "message_id"),
  subagentCheckpoints: new SqliteEntityCollection<SubagentCheckpoint>("subagent_checkpoints", "checkpoint_id"),
  subagentResumeRequests: new SqliteEntityMap<SubagentResumeRequest>("subagent_resume_requests"),
  subagentResumePackages: new SqliteEntityMap<SubagentResumePackage>("subagent_resume_packages"),
  subagentExecutionRuns: new SqliteEntityMap<SubagentExecutionRun>("subagent_execution_runs"),
  subagentRuntimeBindings: new SqliteEntityMap<SubagentRuntimeBinding>("subagent_runtime_bindings"),
  subagentRuntimeInstances: new SqliteEntityMap<SubagentRuntimeInstance>("subagent_runtime_instances"),
  subagentRuntimeLaunchReceipts: new SqliteEntityMap<SubagentRuntimeLaunchReceipt>("subagent_runtime_launch_receipts"),
  subagentRuntimeAdapterRuns: new SqliteEntityMap<SubagentRuntimeAdapterRun>("subagent_runtime_adapter_runs"),
  subagentRuntimeRunnerBackendLeases: new SqliteEntityMap<SubagentRuntimeRunnerBackendLease>("subagent_runtime_runner_backend_leases"),
  subagentRuntimeBackendExecutions: new SqliteEntityMap<SubagentRuntimeBackendExecution>("subagent_runtime_backend_executions"),
  subagentRuntimeDriverRuns: new SqliteEntityMap<SubagentRuntimeDriverRun>("subagent_runtime_driver_runs"),
  subagentRuntimeRunnerHandles: new SqliteEntityMap<SubagentRuntimeRunnerHandle>("subagent_runtime_runner_handles"),
  subagentRuntimeRunnerExecutions: new SqliteEntityMap<SubagentRuntimeRunnerExecution>("subagent_runtime_runner_executions"),
  subagentRuntimeRunnerJobs: new SqliteEntityMap<SubagentRuntimeRunnerJob>("subagent_runtime_runner_jobs"),
  governanceAlerts: new SqliteEntityMap<GovernanceAlert>("governance_alerts"),
  inboxItemStates: new SqliteEntityMap<InboxItemState>("inbox_item_states"),
  evidenceGraphs: new SqliteEntityMap<EvidenceGraph>("evidence_graphs"),
  completionEngineResults: new SqliteEntityMap<CompletionEngineResult>("completion_engine_results"),
  capabilityScoreBreakdowns: new SqliteEntityCollection<CapabilityScoreBreakdown>("capability_score_breakdowns", "capability_id"),
  memoryDirectories: new SqliteEntityMap<MemoryDirectory>("memory_directories"),
  memoryDocuments: new SqliteEntityMap<MemoryDocument>("memory_documents"),
  memoryDocumentSections: new SqliteEntityMap<MemoryDocumentSection>("memory_document_sections"),
  memoryRetrievalTraces: new SqliteEntityCollection<MemoryRetrievalTrace>("memory_retrieval_traces", "trace_id"),
  learningFactoryPipelines: new SqliteEntityMap<LearningFactoryPipeline>("learning_factory_pipelines"),
  learningFactoryBacklog: new SqliteEntityCollection<LearningFactoryBacklogItem>("learning_factory_backlog", "backlog_id"),
  eventLedger: new SqliteEntityCollection<EventLedgerEntry>("event_ledger", "sequence_number"),
  eventProjections: new SqliteEntityMap<EventProjection>("event_projections"),
  outboxEntries: new SqliteEntityCollection<OutboxEntry>("outbox_entries", "outbox_id"),
  policyDecisions: new SqliteEntityCollection<PolicyDecision>("policy_decisions", "decision_id"),
  policyEnforcementActions: new SqliteEntityCollection<PolicyEnforcementAction>("policy_enforcement_actions", "enforcement_id"),
  policyRules: new SqliteEntityMap<PolicyRule>("policy_rules"),
  localCapabilities: new SqliteEntityMap<LocalCapability>("local_capabilities"),
  autonomousCompletionConfigs: new SqliteEntityMap<AutonomousCompletionConfig>("autonomous_completion_configs"),
  taskCheckpoints: new SqliteEntityCollection<TaskCheckpoint>("task_checkpoints", "checkpoint_id"),
  heartbeatRecords: new SqliteEntityCollection<HeartbeatRecord>("heartbeat_records", "heartbeat_id"),
  reviewerExpectations: new SqliteEntityCollection<ReviewerExpectation>("reviewer_expectations", "expectation_id"),
  reviewerFeedbacks: new SqliteEntityCollection<ReviewerFeedback>("reviewer_feedbacks", "feedback_id"),
  ralphAttempts: new SqliteEntityCollection<RalphAttempt>("ralph_attempts", "attempt_id"),
  ralphLoopStates: new SqliteEntityMap<RalphLoopState>("ralph_loop_states"),
  traceSpans: new SqliteEntityCollection<TraceSpan>("trace_spans", "span_id"),
  runTimelines: new SqliteEntityMap<RunTimeline>("run_timelines"),
  costBreakdowns: new SqliteEntityMap<CostBreakdown>("cost_breakdowns"),
  sloMetrics: new SqliteEntityCollection<SLOMetric>("slo_metrics", "metric_id"),
  egressRules: new SqliteEntityMap<EgressRule>("egress_rules"),
  egressRequests: new SqliteEntityCollection<EgressRequest>("egress_requests", "request_id"),
  egressAudits: new SqliteEntityCollection<EgressAudit>("egress_audits", "audit_id"),
  cqsCommands: new SqliteEntityCollection<CQSCommand>("cqs_commands", "command_id"),
  cqsQueries: new SqliteEntityCollection<CQSQuery>("cqs_queries", "query_id"),
  cqsEvents: new SqliteEntityCollection<CQSEvent>("cqs_events", "event_id"),
  experimentRuns: new SqliteEntityMap<ExperimentRun>("experiment_runs"),
  sandboxManifests: new SqliteEntityMap<SandboxManifest>("sandbox_manifests"),
  taskControlCommands: new SqliteEntityCollection<TaskControlCommand>("task_control_commands", "command_id"),
  methodLineages: new SqliteEntityMap<MethodLineage>("method_lineages"),
  operationalMetrics: new SqliteEntityMap<OperationalMetrics>("operational_metrics"),
  replayPackages: new SqliteEntityMap<ReplayPackage>("replay_packages"),
  modelRoutes: new SqliteEntityMap<ModelRoute>("model_routes"),
  modelRequests: new SqliteEntityCollection<ModelRequest>("model_requests", "request_id"),
  automationDefinitions: new SqliteEntityMap<AutomationDefinition>("automation_definitions"),
  automationTriggerRecords: new SqliteEntityCollection<AutomationTriggerRecord>("automation_trigger_records", "trigger_id"),
  wikiPages: new SqliteEntityMap<WikiPage>("wiki_pages"),
  executionSteps: new SqliteEntityCollection<ExecutionStep>("execution_steps", "step_id"),
  taskRuns: new SqliteEntityMap<TaskRun>("task_runs"),
  taskAttempts: new SqliteEntityCollection<TaskAttempt>("task_attempts", "attempt_id"),
  workerSessions: new SqliteEntityMap<WorkerSession>("worker_sessions"),
  sandboxLeases: new SqliteEntityMap<SandboxLease>("sandbox_leases"),
  executionHarnesses: new SqliteEntityMap<ExecutionHarness>("execution_harnesses"),
  reuseFeedbacks: new SqliteEntityCollection<ReuseFeedback>("reuse_feedbacks", "feedback_id"),
  scheduledJobs: new SqliteEntityMap<ScheduledJob>("scheduled_jobs"),
  checkpointSnapshots: new SqliteEntityMap<CheckpointSnapshot>("checkpoint_snapshots"),
  eventSubscriptions: new SqliteEntityMap<EventSubscription>("event_subscriptions"),
  sloAlerts: new SqliteEntityCollection<SLOAlert>("slo_alerts", "alert_id"),
  screenCaptures: new SqliteEntityMap<ScreenCapture>("screen_captures"),
  uiPerceptions: new SqliteEntityMap<UIPerception>("ui_perceptions"),
  inputActions: new SqliteEntityMap<InputAction>("input_actions"),
  computerUseSteps: new SqliteEntityMap<ComputerUseStep>("computer_use_steps"),
  computerUseSessions: new SqliteEntityMap<ComputerUseSession>("computer_use_sessions"),
  humanTakeovers: new SqliteEntityMap<HumanTakeover>("human_takeovers"),
  computerUseReplaySteps: new SqliteEntityMap<ComputerUseReplayStep>("computer_use_replay_steps"),
  localAppInvocations: new SqliteEntityMap<LocalAppInvocation>("local_app_invocations"),
  delegatedResumePackages: new SqliteEntityMap<DelegatedResumePackage>("delegated_resume_packages"),
  workerSupervisionEvents: new SqliteEntityCollection<WorkerSupervisionEvent>("worker_supervision_events", "event_id"),
  deerFlowWorkerRoutes: new SqliteEntityMap<DeerFlowWorkerRoute>("deerflow_worker_routes"),
  cloudSyncEnvelopes: new SqliteEntityMap<CloudSyncEnvelope>("cloud_sync_envelopes"),
  cloudControlPlaneConfigs: new SqliteEntityMap<CloudControlPlaneConfig>("cloud_control_plane_configs"),
  orchestratorBoundaryConfigs: new SqliteEntityMap<OrchestratorBoundaryConfig>("orchestrator_boundary_configs"),
  workflowContractShapes: new SqliteEntityMap<WorkflowContractShape>("workflow_contract_shapes"),
  ssoProviderBoundaries: new SqliteEntityMap<SSOProviderBoundary>("sso_provider_boundaries"),
  orgTenants: new SqliteEntityMap<OrgTenant>("org_tenants"),
  claimsToPolicyMappings: new SqliteEntityMap<ClaimsToPolicyMapping>("claims_to_policy_mappings"),
  deerFlowBackboneReadiness: new SqliteEntityMap<DeerFlowBackboneReadiness>("deerflow_backbone_readiness"),
  osIsolationBackends: new SqliteEntityMap<OSIsolationBackend>("os_isolation_backends"),
  isolationPolicyToBackendMappings: new SqliteEntityMap<IsolationPolicyToBackendMapping>("isolation_policy_to_backend_mappings"),
  privilegedOperationContracts: new SqliteEntityMap<PrivilegedOperationContract>("privileged_operation_contracts"),
  adminOperationRegistryEntries: new SqliteEntityMap<AdminOperationRegistryEntry>("admin_operation_registry_entries"),
  elevationDryRunResults: new SqliteEntityMap<ElevationDryRunResult>("elevation_dry_run_results"),
  privilegedRunRunbooks: new SqliteEntityMap<PrivilegedRunRunbook>("privileged_run_runbooks"),
  runtimeDiagnostics: new SqliteEntityMap<RuntimeDiagnostics>("runtime_diagnostics"),
  bootstrapPlans: new SqliteEntityMap<BootstrapPlan>("bootstrap_plans"),
  postInstallVerifications: new SqliteEntityMap<PostInstallVerification>("post_install_verifications"),
  endpointConfigs: new SqliteEntityMap<EndpointConfig>("endpoint_configs"),
  onboardingRunbooks: new SqliteEntityMap<OnboardingRunbook>("onboarding_runbooks"),
  readinessMatrices: new SqliteEntityMap<ReadinessMatrix>("readiness_matrices")
};

export {
  type PersistenceAdapter,
  type LibSQLConnectionConfig,
  type LibSQLQuery,
  type LibSQLBatchStep,
  type LibSQLResult,
  type LibSQLMigration,
  type LibSQLMigrationRecord,
  type LibSQLHealthCheck,
  type LibSQLSyncStatus,
  InMemoryPersistenceAdapter,
  createPersistenceAdapter,
  createDefaultLibSQLConfig
} from "./libsql-adapter.js";
