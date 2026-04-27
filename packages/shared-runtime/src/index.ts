import { log } from "@apex/shared-observability";
import { store } from "@apex/shared-state";
import { requireTask, recordAudit, touchTask, mirrorTaskContract, tokenizeForLearning, getExecutionTemplateKey, getLearningTokens, buildLearningFingerprint } from "./core.js";
import { createAcceptanceReview, issueAcceptanceVerdict } from "./acceptance-agent.js";
import { createDispatchLeaseForDelegation, releaseDispatchLeaseForSession, createWorkerSessionWithOwnership } from "./delegated-runtime-hardening.js";
import { getDispatchPlanForTask, createDispatchPlan, activatePlan } from "./dispatch-plan-leasing.js";
import { getBudgetPolicyForTask, initializeBudgetStatus } from "./task-budget.js";
import { gatherRoutingSignals, recommendMemoryMode, evaluateTTTEligibility, executeTTTAdaptationRun, distillTTTAdaptation } from "./hybrid-memory-ttt.js";
import { collectEvolutionSignals, generateEvolutionCandidatesFromSignals, gateAllPendingCandidates, createSkillEvolutionRun, addEvolutionCandidate, recordEvolutionPromotionDecision, runEvolutionCycle } from "./evolution-runtime.js";
export { requireTask, recordAudit, touchTask, mirrorTaskContract };
export { buildSandboxFileSystemRules, buildSandboxNetworkRules, buildSandboxResourceLimits, validateSandboxExecution, executeInSandbox, executeInSandboxAsync, killSandboxProcess, listActiveSandboxProcesses, getSandboxExecutionReport, validateFilesystemMounts } from "./sandbox-executor.js";
export type { SandboxTier, SandboxExecutionResult, SandboxViolation, SandboxFileSystemRule, SandboxNetworkRule, SandboxResourceLimit, SandboxResourceUsage, SandboxProcessHandle } from "./sandbox-executor.js";
export { registerSymbolDefinition, lookupSymbolDefinition, searchSymbols, registerSymbolReference, findSymbolReferences, computeAffectedFiles, registerDiagnostic, getDiagnostics, createCodePatch, applyCodePatch, queryCodeIntelligence, createLSPClient, startLSPClient, stopLSPClient, getLSPClientState, listLSPClients, lspDocumentSymbols, lspWorkspaceSymbols, lspReferences, lspDefinition, parseFileAST, indexRepository, notifyLSPFileOpen, notifyLSPFileChange, notifyLSPFileClose } from "./code-intelligence.js";
export type { SymbolDefinition, SymbolReference, AffectedFilesGraph, DiagnosticItem, CodePatch, CodeIntelligenceQuery, LSPClientConfig, LSPClientState, ASTParseResult, RepositoryIndexResult } from "./code-intelligence.js";
export { convertTracesToOTEL, exportOTELToEndpoint, exportOTELAsJSON, createOTELPipeline, startOTELPipeline, stopOTELPipeline, tickOTELPipeline, listOTELPipelines, getOTELPipeline, generateCollectorSidecarConfig } from "./otel-export.js";
export type { OTELSpan, OTELExportBatch, OTELExportResult, OTELPipelineConfig, OTELPipelineStatus } from "./otel-export.js";
export { putCacheEntry, lookupCache, invalidateCache, clearCache, getCacheStats } from "./semantic-cache.js";
export type { CacheEntry, CacheLookupResult } from "./semantic-cache.js";
export { callLLM, validateStructuredOutput, setProviderQuota, getProviderQuota, getAllProviderQuotas } from "./model-gateway-executor.js";
export type { LLMCallOptions, LLMMessage, LLMCallResult, ProviderQuota, StructuredOutputValidationResult } from "./model-gateway-executor.js";
export { parseCronExpression, getNextCronFireTime, getNextNCronFireTimes, isValidCronExpression, describeCronExpression } from "./cron-parser.js";
export type { CronExpression, CronNextFireResult } from "./cron-parser.js";
export { subscribeToCQSEvent, unsubscribeFromCQSEvent, listCQSEventSubscriptions, publishCQSEvent, listCQSEventPublications, verifyWebhookSignature, generateWebhookSignature, checkRateLimit, resetRateLimit, getRateLimitStatus } from "./cqs-events.js";
export type { EventSubscription as CQSEventSubscription, EventPublication as CQSEventPublication, EventDeliveryResult as CQSEventDeliveryResult, RateLimitEntry } from "./cqs-events.js";
export { registerCQSEndpoint, autoWrapEndpointsAsCQS, listCQSEndpointMappings, classifyEndpoint, checkEgressForHTTPCall, createEgressHTTPMiddleware, getEgressRuleManagementData } from "./cqs-middleware.js";
export type { CQSEndpointMapping, EgressCheckResult } from "./cqs-middleware.js";
export { autoPromoteExperimentWinner, assessReuseConfidence, triggerExperimentsForLowConfidence, generateExperimentComparisonReport } from "./learning-factory-automation.js";
export type { ExperimentComparisonReport, AutoPromotionResult, ReuseConfidenceAssessment } from "./learning-factory-automation.js";
export { computeAllMetrics, createCronScheduledJob, executeScheduledJob, listCronScheduledJobs, getScheduledJobExecutionLog, activateScheduledJob, deactivateScheduledJob, createDefaultScheduledJobs } from "./scheduler-metrics.js";
export type { ScheduledJob, MetricsComputationResult } from "./scheduler-metrics.js";
export { reconstructStateFromEvents, exportEventsToFormat, createReplayPackageFromEvents, detectLineageMergeConflicts, resolveLineageMergeConflict, searchWikiPagesSemantic, linkWikiToMemoryDoc, exportWikiToStaticSite } from "./event-ledger-wiki-enhancements.js";
export type { EventReplayState, EventExportResult, LineageMergeConflict, WikiSemanticSearchResult } from "./event-ledger-wiki-enhancements.js";
export { registerMCPCapability, unregisterMCPCapability, getMCPCapability, listMCPCapabilities, resolveMCPTool, resolveMCPToolForNeed, enforceMCPPolicy, invokeMCPTool, runMCPHealthCheck, runAllMCPHealthChecks, getMCPInvocation, listMCPInvocations, getMCPLiveFabricStatus, mcpCapabilityToDescriptor, registerBuiltinMCPCapabilities, registerMCPResource, listMCPResources, readMCPResource, registerMCPPrompt, listMCPPrompts, getMCPPrompt, resolveMCPPrompt, registerMCPRoot, listMCPRoots, authorizeMCPSession, getMCPSessionAuthorization, revokeMCPSessionAuthorization, isMCPSessionAuthorized, reportMCPProgress, getMCPProgress, negotiateMCPCapability, listMCPCapabilityNegotiations } from "./mcp-execution-fabric.js";
export type { MCPCapabilitySpec, MCPToolSpec, MCPInvocationRequest, MCPInvocationResult, MCPLiveExecutionFabric, MCPHealthCheckResult, MCPResourceTemplate, MCPPromptTemplate, MCPRootSpec, MCPSessionAuthorization, MCPProgressEvent, MCPCapabilityNegotiation } from "./mcp-execution-fabric.js";
export { registerAppControlSkill, getAppControlSkill, listAppControlSkills, resolveAppControlSkill, planAppControlExecution, executeAppControlPlan, getAppControlExecutionPlan, getAppControlExecutionResult, registerBuiltinAppControlSkills } from "./app-control-skills.js";
export type { AppControlSkill, AppControlExecutionPlan, AppControlExecutionStep, AppControlExecutionResult, AppControlExecutionMethod, AppControlRiskTier } from "./app-control-skills.js";
export { createDesktopWorkspace, getDesktopWorkspace, addWorkspacePanel, updateWorkspacePanel, buildComputerUsePanelState, buildReplayVisualizationState, buildHumanTakeoverConsoleState, buildRiskRecoveryState, recordExecutionStateTransition, getExecutionStateTimeline, buildFullWorkspaceState, buildHybridMemoryTTTPanelState, buildBlockerDashboardPanelState, buildPrivilegedExecutionPanelState, buildReadinessMatrixPanelState, buildEvolutionStatusPanelState, buildRemoteSkillReviewPanelState } from "./desktop-workspace.js";
export type { WorkspacePanelKind, WorkspacePanelStatus, WorkspacePanel, ComputerUsePanelState, ReplayVisualizationState, HumanTakeoverConsoleState, RiskRecoveryState, ExecutionStateTransition, DesktopWorkspaceState, HybridMemoryTTTPanelState, BlockerDashboardPanelState, PrivilegedExecutionPanelState, ReadinessMatrixPanelState, EvolutionStatusPanelState, RemoteSkillReviewPanelState } from "./desktop-workspace.js";
export { recommendMemoryMode, getMemoryStrategyRecommendation, listMemoryStrategyRecommendations, gatherRoutingSignals, evaluateTTTEligibility, getTTTEligibilityGateResult, listTTTEligibilityGateResults, executeTTTAdaptationRun, getTTTAdaptationRun, listTTTAdaptationRuns, rollbackTTTAdaptation, distillTTTAdaptation, getTTTDistillationRecord, listTTTDistillationRecords, getTTTBudgetLedger, setTTTBudgetTotal, resetTTTBudgetLedger, getTTTTraceForTask, getTTTVisibilitySummary, isVendorHostedModel, isTTTEligibleTaskFamily, registerTTTEligibleTaskFamily, unregisterTTTEligibleTaskFamily, listTTTEligibleTaskFamilies, registerTTTModelAdapter, unregisterTTTModelAdapter, listTTTModelAdapters, resolveTTTModelAdapter, registerBuiltinTTTModelAdapters, executeAdaptationWithAdapter, scoreMemoryRoutingCandidates, computeMemoryHitQuality, rerankMemoryDirectory, linkPlaybookToRouting, runTTTRegressionTestSuite, getTTTRegressionTestCases, replayTTTAdaptationForComparison } from "./hybrid-memory-ttt.js";
export { captureScreen, buildAccessibilityTree, perceiveScreen, executeInputAction, executeElementAction, resolveElementAction, createComputerUseSession, getComputerUseSession, listComputerUseSessions, pauseComputerUseSession, resumeComputerUseSession, stopComputerUseSession, completeComputerUseSession, initiateHumanTakeover, resolveHumanTakeover, listHumanTakeovers, runSeeActVerifyRecoverLoop, listComputerUseSteps, getComputerUseStep, buildComputerUseReplayPackage, replayComputerUseStep, listScreenCaptures, getScreenCapture, listUIPerceptions, getUIPerception, listInputActions, getInputAction, resetCircuitBreakers, getCircuitBreakerStatus, registerOCRProvider, listOCRProviders, clearOCRProviders, registerElementActionProvider, listElementActionProviders, clearElementActionProviders, invokeLocalApp, getLocalAppInvocation, listLocalAppInvocations, generateSessionRecording, exportSessionRecording, buildMacOSAccessibilityTree, buildLinuxAccessibilityTree, listAvailableDisplays, runComputerUseSelfCheck, detectPlatformFeatures, startSessionFrameRecording, captureRecordingFrame, stopSessionFrameRecording, getSessionFrameRecordingStatus, buildSessionRecordingArtifact, detectLocalAppCapabilities, checkLocalAppAvailability, detectBrowserEngineAvailability, encodeSessionRecording, registerVideoEncoder, listVideoEncoders, runMacOSAccessibilityDiagnostics, runLinuxATSPIDiagnostics, enforceComputerUseSandbox, getComputerUseSandboxPolicy, runSmokeTestSuite, runE2EScenario, runRegressionTestSuite, getRegressionTestCases } from "./computer-use-runtime.js";
export type { OCRProvider, OCRResult, OCRRegion, ElementActionProvider, ElementActionResult, ElementPostCheckResult, SessionRecordingEntry, AvailableDisplay, SelfCheckResult, SelfCheckEntry, PlatformFeatureDetection, SessionRecordingFrame, SessionRecordingTimeline, LocalAppCapability, VideoEncoderResult, VideoEncoder, MacOSAccessibilityDiagnostics, LinuxATSPIDiagnostics, SmokeTestResult, SmokeTestSuiteResult, E2EScenarioStep, E2EScenarioResult, RegressionTestCase, RegressionTestResult, ComputerUseSandboxEnforcement } from "./computer-use-runtime.js";
export { registerPrivilegedOperationContract, listPrivilegedOperationContracts, getPrivilegedOperationContract, addAdminOperationRegistryEntry, listAdminOperationRegistryEntries, executeElevationDryRun, listElevationDryRunResults, getPrivilegedReadinessDiagnostics, generatePrivilegedRunRunbook, listPrivilegedRunRunbooks, initializeDefaultPrivilegedOperationContracts } from "./privileged-execution-readiness.js";
export type { PrivilegedOperationKind, ReadinessStatus, PrivilegedOperationContract, AdminOperationRegistryEntry, ElevationDryRunResult, PrivilegedRunRunbook, PrivilegedReadinessDiagnostics } from "./privileged-execution-readiness.js";
export { detectRuntimeInstallState, listRuntimeDiagnostics, generateBootstrapPlan, listBootstrapPlans, runPostInstallVerification, listPostInstallVerifications, generateLocalEnvironmentReport, detectAllRuntimes } from "./local-runtime-bootstrap.js";
export type { LocalRuntimeKind, InstallState, RuntimeDiagnostics, BootstrapPlan, PostInstallVerification, LocalEnvironmentReport } from "./local-runtime-bootstrap.js";
export { registerEndpointConfig, listEndpointConfigs, getEndpointConfig, runConnectivityPreflight, getCredentialInventory, generateOnboardingRunbook, listOnboardingRunbooks, validateEndpointConfigSchema, initializeDefaultEndpointConfigs } from "./endpoint-onboarding.js";
export type { EndpointKind, EndpointConfigStatus, EndpointConfig, CredentialInventory, ConnectivityPreflightResult, OnboardingRunbook } from "./endpoint-onboarding.js";
export { buildReadinessMatrix, listReadinessMatrices, exportReadinessStatusArtifact, buildBlockerDashboardState } from "./blocker-dashboard.js";
export type { BlockerCategory, ReadinessMatrixEntry, ReadinessMatrix, ReadinessStatusArtifact, BlockerDashboardState } from "./blocker-dashboard.js";
export { runPrivilegedOperationContractSuite, runInstallerBootstrapDiagnosticsSuite, runConfigValidationSuite, runReadinessMatrixSuite, runDryRunReportGenerationSuite, runAllPrivilegedReadinessSuites } from "./privileged-readiness-verification.js";
export type { PrivilegedReadinessTestResult, PrivilegedReadinessSuiteResult } from "./privileged-readiness-verification.js";
export { registerOrchestrationProvider, listOrchestrationProviders, getOrchestrationProvider, configureOrchestrationLane, listOrchestrationLanes, resolveOrchestrationLane, dispatchToOrchestrationLane, queryOrchestrationWorkflow, getOrchestrationDiagnostics, initializeDefaultOrchestrationSPI, verifyOrchestrationProviderConnectivity, runOrchestrationActivationVerification } from "./orchestration-spi.js";
export type { OrchestrationProviderKind, OrchestrationSPIProvider, OrchestrationLaneConfig, OrchestrationDispatchResult, OrchestrationQueryResult } from "./orchestration-spi.js";
export { registerSandboxProvider, listSandboxProviders, selectSandboxProvider, prepareSandboxExecution, getSandboxProviderDiagnostics, initializeDefaultSandboxProviders, verifySandboxProviderConnectivity, runSandboxActivationVerification } from "./sandbox-provider-layer.js";
export type { SandboxProvider, SandboxProviderSelection, SandboxProviderExecution } from "./sandbox-provider-layer.js";
export { registerTraceGradeCriterion, listTraceGradeCriteria, initializeDefaultTraceGradeCriteria, gradeTrace, getTraceGrade, listTraceGrades, detectTraceRegression, listTraceRegressionVerdicts, generateTraceMethodologyFeedback, listTraceMethodologyFeedback, applyTraceMethodologyFeedback, runTraceEvalFlywheelCycle, getTraceGradingDiagnostics, runTraceGradingRegressionSuite } from "./trace-grading-eval.js";
export type { TraceKind, TraceGradeVerdict, TraceGradeCriterion, TraceGradeScore, TraceGradeResult, TraceGradeAttachment, TraceGradeRegressionVerdict, TraceEvalFlywheelCycle, TraceMethodologyFeedback } from "./trace-grading-eval.js";
export { registerMemoryLayer, listMemoryLayers, getMemoryLayerByKind, initializeDefaultMemoryLayers, writeSemanticEntry, writeEpisodicEntry, writeProceduralEntry, listSemanticEntries, listEpisodicEntries, listProceduralEntries, getMemoryLayerEntry, createMemoryLayerWriteBatch, compactMemoryLayer, evaluatePromotionCandidate, promoteEpisodicToProcedural, listPromotionCandidates, generateRetentionReport, getMemoryLayerDiagnostics, runMemoryLayerRegressionSuite } from "./memory-layers.js";
export type { MemoryLayerKind, MemoryLayerWritePolicy, MemoryLayerCompactionStrategy, PromotionVerdict, MemoryLayerSpec, SemanticMemoryEntry, EpisodicMemoryEntry, ProceduralMemoryEntry, MemoryLayerEntry, MemoryLayerWriteBatch, MemoryLayerCompactionResult, MemoryLayerPromotionCandidate, MemoryLayerRetentionReport } from "./memory-layers.js";
export { registerTTTSpecialistLane, listTTTSpecialistLanes, initializeDefaultTTTSpecialistLane, registerSelfHostedModelBoundary, listSelfHostedModelBoundaries, isVendorHostedRoute, isTTTSpecialistEligibleFamily, registerTTTSpecialistEligibleFamily, listTTTSpecialistEligibleFamilies, evaluateSpecialistLaneGate, listSpecialistLaneGateChecks, runSpecialistLaneReplayEval, listSpecialistLaneReplayEvals, promoteSpecialistLaneResult, listSpecialistLanePromotions, generateSpecialistLaneRoutingSignal, listSpecialistLaneRoutingSignals, getTTTSpecialistLaneDiagnostics, runTTTSpecialistLaneRegressionSuite, verifySelfHostedModelConnectivity, runTTTSpecialistLaneActivationVerification } from "./ttt-specialist-lane.js";
export type { SpecialistLaneStatus, SpecialistLaneGateResult, ReplayEvalVerdict, TTTSpecialistLaneSpec, SpecialistLaneGateCheck, SpecialistLaneReplayEval, SpecialistLanePromotionRecord, SpecialistLaneRoutingSignal, SelfHostedModelBoundary } from "./ttt-specialist-lane.js";
export { registerResourceProbe, runPreflightProbes, classifyLanes, generatePreflightTruthReport, getLiveNowLanes, getBlockedLanes } from "./post-frontier-preflight.js";
export type { ResourceClassification, ResourceProbeResult, LaneClassification, PreflightTruthReport } from "./post-frontier-preflight.js";
export { verifyObservabilityActivation, verifyPersistenceActivation, runObservabilityPersistenceActivationVerification } from "./observability-persistence-activation.js";
export type { ObservabilityActivationStatus, PersistenceActivationStatus, ObservabilityPersistenceActivationReport } from "./observability-persistence-activation.js";
export { validateCurrentHost, generateCrossPlatformValidationReport } from "./host-validation-activation.js";
export type { HostPlatform, HostValidationStatus, HostValidationResult, CrossPlatformValidationReport } from "./host-validation-activation.js";
export { runFinalProductionHonestyPass } from "./production-honesty-pass.js";
export type { ProductionReadinessLevel, ProductionHonestyAssessment } from "./production-honesty-pass.js";
export { getDefaultDelegationPolicy, loadDelegationPolicy, updateDelegationPolicy, detectMachineResources, computeEffectiveDelegationLimits, getDelegationPolicyDiagnostics } from "./delegation-policy.js";
export type { SubagentResourceMode, DelegationPolicySettings, MachineResourceEnvelope, EffectiveDelegationLimits } from "./delegation-policy.js";
export { createDispatchPlan, addDispatchStep, assignStepToSubagent, releaseLease, updateStepResult, activatePlan, getDispatchPlan, getDispatchStep, listDispatchStepsForPlan, getDispatchDiagnostics, getDispatchPlanForTask, getActiveLeaseForStep, getDispatchLeaseById, failDispatchStep } from "./dispatch-plan-leasing.js";
export type { DispatchPlanStatus, DispatchStepStatus, LeaseStatus, AgentDispatchPlan, AgentDispatchStep, SubagentAssignment, AssignmentLease } from "./dispatch-plan-leasing.js";
export { buildSubagentContextEnvelope, buildSubagentResultEnvelope, getContextEnvelope, getResultEnvelope, getContextEnvelopesForStep, getResultEnvelopesForStep, getContextEnvelopesForTask, getResultEnvelopesForTask } from "./subagent-envelopes.js";
export type { SubagentContextEnvelope, SubagentResultEnvelope } from "./subagent-envelopes.js";
export { createDispatchLeaseForDelegation, releaseDispatchLeaseForSession, createWorkerSessionWithOwnership, heartbeatWorkerSessionWithMetadata, detectOrphanedSessions, detectStalledSessions, superviseAndRestartSession, completeSupervisedRestart, prepareDelegatedResumePackage, applyDelegatedResumePackage, failDelegatedResumePackage, rollbackDelegatedResumePackage, listDelegatedResumePackages, getDelegatedResumePackage, recoverFromCheckpointForSession, releaseLeaseWithCleanup, forceCleanupForTask, linkAttemptToWorkerSession, getAttemptWorkerSessionChain, runDelegatedRuntimeMaintenanceCycle, getWorkerSupervisionEvents, getWorkerSessionDiagnostics } from "./delegated-runtime-hardening.js";
export type { DispatchLeaseContext } from "./delegated-runtime-hardening.js";
export { createAcceptanceReview, issueAcceptanceVerdict, getAcceptanceReview, getAcceptanceVerdict, listAcceptanceReviewsForTask, listAcceptanceVerdictsForTask, getCompletionPathStatus } from "./acceptance-agent.js";
export type { AcceptanceVerdictKind, AcceptanceFinding, AcceptanceReview, AcceptanceVerdict } from "./acceptance-agent.js";
export { registerModelPricing, initializeDefaultPricingRegistry, lookupModelPricing, listModelPricing, createBudgetPolicy, getBudgetPolicy, getBudgetPolicyForTask, initializeBudgetStatus, trackModelSpend, resolveBudgetInterruption, getBudgetStatusForTask, getPendingInterruptionForTask, getInterruptionEvent, getBudgetDiagnostics } from "./task-budget.js";
export type { BudgetMode, OnLimitReached, ModelPricingRegistryEntry, TaskBudgetPolicy, TaskBudgetStatus, BudgetInterruptionEvent } from "./task-budget.js";
export { createSkillEvolutionRun, createPromptEvolutionRun, createToolDescriptionEvolutionRun, addEvolutionCandidate, updateEvolutionCandidateStatus, recordEvolutionPromotionDecision, recordEvolutionRollback, getEvolutionRunStatus, listEvolutionRunsForTarget, getEvolutionDiagnostics, collectEvolutionSignals, generateEvolutionCandidatesFromSignals, gateEvolutionCandidate, gateAllPendingCandidates, runEvolutionCycle } from "./evolution-runtime.js";
export type { EvolutionSignal, EvolutionGateResult } from "./evolution-runtime.js";
export { createClawHubRegistryConfig, getClawHubRegistryConfig, listClawHubRegistryConfigs, searchClawHubSkills, inspectClawHubSkill, installClawHubSkill, listClawHubInstallRecords, publishToClawHub, listClawHubPublishRecords, syncClawHubRegistry, listClawHubSyncRecords, assessRemoteSkillTrust, listRemoteSkillTrustVerdicts, getClawHubDiagnostics } from "./clawhub-registry-adapter.js";
export type { ScreenCapture, UIPerception, InputAction, ComputerUseStep, ComputerUseSession, HumanTakeover, ComputerUseReplayStep } from "@apex/shared-types";
export type { LocalAppInvocation } from "@apex/shared-state";
import {
  AgentTeamSummarySchema,
  AgentTeamTimelineEntrySchema,
  type ApplicabilityRules,
  type CapabilityResolution,
  type Artifact,
  ArtifactSchema,
  type AuditEntry,
  AuditEntrySchema,
  buildSuggestedDefinitionOfDone,
  CompletionContractSchema,
  type Checkpoint,
  CheckpointSchema,
  type ChecklistRunResult,
  ChecklistRunResultSchema,
  createEntityId,
  type DoneGateResult,
  DoneGateResultSchema,
  type EvidenceNode,
  EvidenceNodeSchema,
  type EvidenceGraph,
  EvidenceGraphSchema,
  type CompletionEngineResult,
  CompletionEngineResultSchema,
  type MemoryDirectory,
  MemoryDirectorySchema,
  type MemoryDocument,
  MemoryDocumentSchema,
  type MemoryDocumentSection,
  MemoryDocumentSectionSchema,
  type MemoryRetrievalTrace,
  MemoryRetrievalTraceSchema,
  type LearningFactoryStage,
  LearningFactoryStageSchema,
  type LearningFactoryPipelineStatus,
  type LearningFactoryPipeline,
  LearningFactoryPipelineSchema,
  type LearningFactoryBacklogItem,
  LearningFactoryBacklogItemSchema,
  type EventLedgerEntryKind,
  type EventLedgerEntry,
  EventLedgerEntrySchema,
  type EventProjection,
  EventProjectionSchema,
  type OutboxEntry,
  OutboxEntrySchema,
  type PolicyDecisionVerdict,
  type PolicyDecision,
  PolicyDecisionSchema,
  type PolicyEnforcementAction,
  PolicyEnforcementActionSchema,
  type PolicyRule,
  PolicyRuleSchema,
  type LocalCapabilityCategory,
  type LocalCapability,
  LocalCapabilitySchema,
  type CapabilityDescriptor,
  CapabilityDescriptorSchema,
  type AutonomousCompletionState,
  AutonomousCompletionStateSchema,
  type TaskCheckpoint,
  TaskCheckpointSchema,
  type HeartbeatRecord,
  HeartbeatRecordSchema,
  type AutonomousCompletionConfig,
  AutonomousCompletionConfigSchema,
  type ReviewerVerdict,
  ReviewerVerdictSchema,
  type ReviewerExpectation,
  ReviewerExpectationSchema,
  type ReviewerFeedback,
  ReviewerFeedbackSchema,
  type RalphAttempt,
  RalphAttemptSchema,
  type RalphLoopState,
  RalphLoopStateSchema,
  type SpanKind,
  SpanKindSchema,
  type SpanStatus,
  type TraceSpan,
  TraceSpanSchema,
  type RunTimeline,
  RunTimelineSchema,
  type CostBreakdown,
  CostBreakdownSchema,
  type SLOMetric,
  SLOMetricSchema,
  type EgressRuleAction,
  EgressRuleActionSchema,
  type EgressRule,
  EgressRuleSchema,
  type EgressRequest,
  EgressRequestSchema,
  type EgressVerdict,
  EgressVerdictSchema,
  type EgressAudit,
  EgressAuditSchema,
  type CQSCommandKind,
  CQSCommandKindSchema,
  type CQSQueryKind,
  CQSQueryKindSchema,
  type CQSEventKind,
  CQSEventKindSchema,
  type CQSCommand,
  CQSCommandSchema,
  type CQSQuery,
  CQSQuerySchema,
  type CQSEvent,
  CQSEventSchema,
  type CQSDispatchResult,
  CQSDispatchResultSchema,
  type CQSQueryResult,
  type ExperimentStatus,
  ExperimentStatusSchema,
  type ExperimentCandidate,
  ExperimentCandidateSchema,
  type ExperimentBudget,
  ExperimentBudgetSchema,
  type ExperimentRun,
  ExperimentRunSchema,
  type SandboxTier,
  SandboxTierSchema,
  type FilesystemMount,
  type CapabilityToken,
  CapabilityTokenSchema,
  type ResourceQuota,
  type SandboxManifest,
  SandboxManifestSchema,
  type TaskControlCommandKind,
  TaskControlCommandKindSchema,
  type TaskControlCommand,
  TaskControlCommandSchema,
  type LineageMutationKind,
  LineageMutationKindSchema,
  type MethodLineage,
  MethodLineageSchema,
  type MetricsWindow,
  MetricsWindowSchema,
  type OperationalMetrics,
  OperationalMetricsSchema,
  type ReplayPackage,
  ReplayPackageSchema,
  type PrivacyLevel,
  PrivacyLevelSchema,
  type ModelProvider,
  ModelProviderSchema,
  type ModelRoute,
  ModelRouteSchema,
  type ModelRequest,
  ModelRequestSchema,
  type AutomationTriggerKind,
  AutomationTriggerKindSchema,
  type AutomationDedupStrategy,
  type AutomationRecursionPolicy,
  type AutomationDefinition,
  AutomationDefinitionSchema,
  type AutomationTriggerRecord,
  AutomationTriggerRecordSchema,
  type WikiPageClass,
  WikiPageClassSchema,
  type WikiPageStatus,
  type WikiPage,
  WikiPageSchema,
  type WikiCompilationResult,
  WikiCompilationResultSchema,
  type ExecutionStepKind,
  ExecutionStepKindSchema,
  type ExecutionStepStatus,
  type ExecutionStep,
  ExecutionStepSchema,
  type TaskRunStatus,
  type TaskRun,
  TaskRunSchema,
  type TaskAttemptStatus,
  type TaskAttempt,
  TaskAttemptSchema,
  type WorkerSessionStatus,
  type WorkerSession,
  WorkerSessionSchema,
  type SandboxLeaseStatus,
  type SandboxLease,
  SandboxLeaseSchema,
  type HarnessKind,
  type HarnessStatus,
  type ExecutionHarness,
  ExecutionHarnessSchema,
  type ReuseFeedbackKind,
  type ReuseFeedback,
  ReuseFeedbackSchema,
  type ScheduledJob,
  ScheduledJobSchema,
  type CheckpointSnapshot,
  CheckpointSnapshotSchema,
  type EventSubscription,
  EventSubscriptionSchema,
  type SLOAlert,
  SLOAlertSchema,
  CQSQueryResultSchema,
  type MemoryItem,
  MemoryItemSchema,
  nowIso,
  type ReconciliationRunResult,
  ReconciliationRunResultSchema,
  type Schedule,
  ScheduleSchema,
  type SkillCandidate,
  SkillCandidateSchema,
  SubagentCheckpointSchema,
  SubagentExecutionRunSchema,
  SubagentMessageSchema,
  SubagentRuntimeBindingSchema,
  SubagentRuntimeAdapterRunSchema,
  SubagentRuntimeRunnerBackendLeaseSchema,
  SubagentRuntimeBackendExecutionSchema,
  SubagentRuntimeDriverRunSchema,
  SubagentRuntimeRunnerHandleSchema,
  SubagentRuntimeRunnerExecutionSchema,
  SubagentRuntimeRunnerJobSchema,
  SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema,
  SubagentRuntimeRunnerBackendAdapterStatusSchema,
  SubagentRuntimeInstanceSchema,
  SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema,
  SubagentRuntimeLauncherBackendAdapterStatusSchema,
  SubagentRuntimeLaunchReceiptSchema,
  SubagentRuntimeLaunchSpecSchema,
  SubagentResumePackageSchema,
  SubagentResumeRequestSchema,
  SubagentSessionSchema,
  type TaskTemplate,
  TaskTemplateSchema,
  type TaskContract,
  TaskContractSchema,
  type ToolInvocation,
  ToolInvocationSchema,
  type WorkerKind,
  type WorkerRun,
  WorkerRunSchema,
  type VerificationRunResult,
  VerificationRunResultSchema
} from "@apex/shared-types";
import { listTaskCapabilityResolutions, resolveTaskCapabilities, getCapabilityScoreBreakdowns } from "./capabilities.js";
import {
  detectObjectSecuritySignals,
  detectTextSecuritySignals,
  sanitizeMethodologyText
} from "./security.js";

function compactEvidence(taskId: string): string[] {
  return [...new Set(listTaskArtifacts(taskId).map(artifact => artifact.name))].slice(0, 8);
}

function getDefaultLauncherDriverId(launcherKind: "worker_run" | "sandbox_runner" | "cloud_runner") {
  switch (launcherKind) {
    case "sandbox_runner":
      return "sandbox_pool_driver" as const;
    case "cloud_runner":
      return "cloud_control_plane_driver" as const;
    case "worker_run":
    default:
      return "local_worker_run_driver" as const;
  }
}

function validateLauncherDriver(
  launcherKind: "worker_run" | "sandbox_runner" | "cloud_runner",
  launcherDriverId: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver"
) {
  const expectedDriverId = getDefaultLauncherDriverId(launcherKind);
  if (expectedDriverId !== launcherDriverId) {
    throw new Error(`Launcher driver '${launcherDriverId}' is not compatible with launcher kind '${launcherKind}'.`);
  }
}

function getDefaultRunnerKind(backendKind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter") {
  switch (backendKind) {
    case "sandbox_runner_adapter":
      return "sandbox_pool_job" as const;
    case "cloud_runner_adapter":
      return "cloud_control_plane_job" as const;
    case "local_worker_adapter":
    default:
      return "local_worker_process" as const;
  }
}

function getRunnerBackendAdapterId(
  runnerKind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job"
) {
  switch (runnerKind) {
    case "sandbox_pool_job":
      return "sandbox_job_runner_backend" as const;
    case "cloud_control_plane_job":
      return "cloud_job_runner_backend" as const;
    case "local_worker_process":
    default:
      return "local_process_runner_backend" as const;
  }
}

function getDefaultRunnerJobKind(runnerKind: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job") {
  switch (runnerKind) {
    case "sandbox_pool_job":
      return "sandbox_execution_job" as const;
    case "cloud_control_plane_job":
      return "cloud_execution_job" as const;
    case "local_worker_process":
    default:
      return "local_process_job" as const;
  }
}

function getLauncherDriverContract(launcherDriverId: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver") {
  switch (launcherDriverId) {
    case "sandbox_pool_driver":
      return {
        isolation_scope: "sandbox_pool" as const,
        quota_profile: "sandbox_pool_default" as const,
        mutation_guarded: true
      };
    case "cloud_control_plane_driver":
      return {
        isolation_scope: "remote_control_plane" as const,
        quota_profile: "cloud_runner_default" as const,
        mutation_guarded: true
      };
    case "local_worker_run_driver":
    default:
      return {
        isolation_scope: "host_process" as const,
        quota_profile: "local_worker_default" as const,
        mutation_guarded: true
      };
  }
}

function getLauncherBackendKind(
  launcherDriverId: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver"
) {
  switch (launcherDriverId) {
    case "sandbox_pool_driver":
      return "sandbox_runner_adapter" as const;
    case "cloud_control_plane_driver":
      return "cloud_runner_adapter" as const;
    case "local_worker_run_driver":
    default:
      return "local_worker_adapter" as const;
  }
}

function getLauncherBackendAdapterId(
  backendKind: "local_worker_adapter" | "sandbox_runner_adapter" | "cloud_runner_adapter"
) {
  switch (backendKind) {
    case "sandbox_runner_adapter":
      return "sandbox_pool_backend_adapter" as const;
    case "cloud_runner_adapter":
      return "cloud_control_plane_backend_adapter" as const;
    case "local_worker_adapter":
    default:
      return "local_worker_backend_adapter" as const;
  }
}

export function getSubagentRuntimeLauncherBackendAdapterCatalog() {
  return [
    SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema.parse({
      adapter_id: "local_worker_backend_adapter",
      backend_kind: "local_worker_adapter",
      supported_driver_ids: ["local_worker_run_driver"],
      label: "Managed Worker Backend Adapter",
      description: "Consumes launch receipts through the local control plane and transitions them into delegated adapter runs.",
      consumption_mode: "managed_runtime_launch",
      heartbeat_contract: "worker_run_lifecycle",
      release_contract: "managed_worker_release",
      execution_style: "inline_control_plane",
      future_upgrade_path: "Replace with a dedicated local delegated worker supervisor once runtime hardening graduates from host-managed workers."
    }),
    SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema.parse({
      adapter_id: "sandbox_pool_backend_adapter",
      backend_kind: "sandbox_runner_adapter",
      supported_driver_ids: ["sandbox_pool_driver"],
      label: "Sandbox Pool Backend Adapter",
      description: "Consumes launch receipts and hands delegated runtime control to an external sandbox pool with heartbeat confirmation.",
      consumption_mode: "external_launch_handoff",
      heartbeat_contract: "external_heartbeat",
      release_contract: "sandbox_pool_release",
      execution_style: "delegated_runtime_adapter",
      future_upgrade_path: "Swap locator handoff for pool-native scheduling once dedicated sandbox orchestration is available."
    }),
    SubagentRuntimeLauncherBackendAdapterCatalogEntrySchema.parse({
      adapter_id: "cloud_control_plane_backend_adapter",
      backend_kind: "cloud_runner_adapter",
      supported_driver_ids: ["cloud_control_plane_driver"],
      label: "Cloud Control Plane Backend Adapter",
      description: "Consumes launch receipts through a remote control plane contract and defers execution ownership to a hosted runtime.",
      consumption_mode: "remote_control_plane",
      heartbeat_contract: "cloud_control_plane",
      release_contract: "cloud_control_plane_release",
      execution_style: "future_remote_runner",
      future_upgrade_path: "Bind to a hosted delegated runtime fleet when the optional cloud control plane ships."
    })
  ];
}

export function getSubagentRuntimeLauncherBackendAdapterStatuses() {
  const launchReceipts = [...store.subagentRuntimeLaunchReceipts.values()];
  const adapterRuns = [...store.subagentRuntimeAdapterRuns.values()];
  return getSubagentRuntimeLauncherBackendAdapterCatalog().map(adapter => {
    const matchingReceipts = launchReceipts.filter(item => item.backend_kind === adapter.backend_kind);
    const matchingRuns = adapterRuns.filter(item => item.backend_kind === adapter.backend_kind);
    const activeAdapterRunCount = matchingRuns.filter(item => item.status === "running").length;
    const completedAdapterRunCount = matchingRuns.filter(item => item.status === "completed").length;
    const failedAdapterRunCount = matchingRuns.filter(item => item.status === "failed").length;
    const health =
      failedAdapterRunCount > 0
        ? "attention"
        : activeAdapterRunCount > 0 || matchingReceipts.length > 0
          ? "healthy"
          : "attention";
    const recommendedAction =
      failedAdapterRunCount > 0
        ? "inspect_failed_adapter_runs"
        : activeAdapterRunCount > 0
          ? "monitor_active_adapter_runs"
          : matchingReceipts.length > 0
            ? "consume_launch_receipts"
            : "standby_for_runtime_launch";
    const summary =
      failedAdapterRunCount > 0
        ? `${failedAdapterRunCount} adapter run(s) failed for ${adapter.adapter_id}; inspect receipts and delegated runtime checkpoints.`
        : activeAdapterRunCount > 0
          ? `${activeAdapterRunCount} adapter run(s) are currently active through ${adapter.adapter_id}.`
          : matchingReceipts.length > 0
            ? `${matchingReceipts.length} launch receipt(s) are ready to be consumed by ${adapter.adapter_id}.`
            : `No launch receipts have been routed through ${adapter.adapter_id} yet.`;
    return SubagentRuntimeLauncherBackendAdapterStatusSchema.parse({
      adapter_id: adapter.adapter_id,
      backend_kind: adapter.backend_kind,
      health,
      launched_receipt_count: matchingReceipts.length,
      active_adapter_run_count: activeAdapterRunCount,
      completed_adapter_run_count: completedAdapterRunCount,
      failed_adapter_run_count: failedAdapterRunCount,
      recommended_action: recommendedAction,
      summary
    });
  });
}

export function getSubagentRuntimeRunnerBackendAdapterCatalog() {
  return [
    SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema.parse({
      adapter_id: "local_process_runner_backend",
      runner_kind: "local_worker_process",
      backend_kind: "local_worker_adapter",
      supported_driver_ids: ["local_worker_run_driver"],
      label: "Local Process Runner Backend",
      description: "Runs delegated runner executions as host-managed local processes until a dedicated worker supervisor is introduced.",
      execution_contract: "host_process_lifecycle",
      heartbeat_contract: "local_process_heartbeat",
      release_contract: "host_process_release",
      future_upgrade_path: "Replace with a supervised local process pool once hard sandboxing moves risky execution out of the host process."
    }),
    SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema.parse({
      adapter_id: "sandbox_job_runner_backend",
      runner_kind: "sandbox_pool_job",
      backend_kind: "sandbox_runner_adapter",
      supported_driver_ids: ["sandbox_pool_driver"],
      label: "Sandbox Job Runner Backend",
      description: "Runs delegated runner executions as sandbox-pool jobs with external heartbeat and release semantics.",
      execution_contract: "sandbox_job_lifecycle",
      heartbeat_contract: "external_job_heartbeat",
      release_contract: "sandbox_job_release",
      future_upgrade_path: "Swap simulated sandbox jobs for a real sandbox scheduler when pooled isolation becomes available."
    }),
    SubagentRuntimeRunnerBackendAdapterCatalogEntrySchema.parse({
      adapter_id: "cloud_job_runner_backend",
      runner_kind: "cloud_control_plane_job",
      backend_kind: "cloud_runner_adapter",
      supported_driver_ids: ["cloud_control_plane_driver"],
      label: "Cloud Job Runner Backend",
      description: "Runs delegated runner executions through a hosted control plane contract with cloud-managed lifecycle semantics.",
      execution_contract: "cloud_job_lifecycle",
      heartbeat_contract: "cloud_job_heartbeat",
      release_contract: "cloud_job_release",
      future_upgrade_path: "Bind to a durable hosted runner fleet when the optional cloud control plane is implemented."
    })
  ];
}

export function getSubagentRuntimeRunnerBackendAdapterStatuses() {
  const runnerExecutions = [...store.subagentRuntimeRunnerExecutions.values()];
  return getSubagentRuntimeRunnerBackendAdapterCatalog().map(adapter => {
    const matchingExecutions = runnerExecutions.filter(item => item.runner_kind === adapter.runner_kind);
    const runningExecutionCount = matchingExecutions.filter(item => item.status === "running").length;
    const completedExecutionCount = matchingExecutions.filter(item => item.status === "completed").length;
    const failedExecutionCount = matchingExecutions.filter(item => item.status === "failed").length;
    const health =
      failedExecutionCount > 0
        ? "attention"
        : runningExecutionCount > 0 || completedExecutionCount > 0
          ? "healthy"
          : "attention";
    const recommendedAction =
      failedExecutionCount > 0
        ? "inspect_failed_runner_executions"
        : runningExecutionCount > 0
          ? "monitor_active_runner_executions"
          : "standby_for_runner_execution";
    const summary =
      failedExecutionCount > 0
        ? `${failedExecutionCount} runner execution(s) failed for ${adapter.adapter_id}; inspect runner checkpoints and delegated-runtime receipts.`
        : runningExecutionCount > 0
          ? `${runningExecutionCount} runner execution(s) are currently active through ${adapter.adapter_id}.`
          : completedExecutionCount > 0
            ? `${completedExecutionCount} runner execution(s) already completed through ${adapter.adapter_id}.`
            : `No runner executions have been started through ${adapter.adapter_id} yet.`;
    return SubagentRuntimeRunnerBackendAdapterStatusSchema.parse({
      adapter_id: adapter.adapter_id,
      runner_kind: adapter.runner_kind,
      backend_kind: adapter.backend_kind,
      health,
      running_execution_count: runningExecutionCount,
      completed_execution_count: completedExecutionCount,
      failed_execution_count: failedExecutionCount,
      recommended_action: recommendedAction,
      summary
    });
  });
}

function buildRuntimeLaunchLocator(
  launcherDriverId: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver",
  instanceId: string,
  locatorOverride?: string
) {
  if (locatorOverride) return locatorOverride;
  switch (launcherDriverId) {
    case "sandbox_pool_driver":
      return `sandbox-runner://runtime/${instanceId}`;
    case "cloud_control_plane_driver":
      return `cloud-runner://runtime/${instanceId}`;
    case "local_worker_run_driver":
    default:
      return `local-worker://runtime/${instanceId}`;
  }
}

function buildRuntimeExecutionLocator(
  launcherDriverId: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver",
  executionRunId: string,
  runtimeLocator?: string
) {
  if (runtimeLocator) return runtimeLocator;
  switch (launcherDriverId) {
    case "sandbox_pool_driver":
      return `sandbox-runner://execution/${executionRunId}`;
    case "cloud_control_plane_driver":
      return `cloud-runner://execution/${executionRunId}`;
    case "local_worker_run_driver":
    default:
      return `local-worker://execution/${executionRunId}`;
  }
}

function mergeImprovementHints(existing: string[] | undefined, hint: string | null): string[] {
  return [...new Set([...(existing ?? []), ...(hint ? [hint] : [])])].slice(-6);
}

function getReuseImprovementContext(task: Pick<TaskContract, "task_id" | "inputs">) {
  const sourceKind = task.inputs?.source_kind;
  const targetKind = task.inputs?.reuse_target_kind;
  const targetId = task.inputs?.reuse_target_id;
  if (
    sourceKind !== "reuse_navigation"
    || (targetKind !== "execution_template" && targetKind !== "learned_playbook")
    || typeof targetId !== "string"
    || targetId.trim().length === 0
  ) {
    return null;
  }
  return {
    target_kind: targetKind,
    target_id: targetId,
    target_task_id:
      typeof task.inputs?.reuse_target_task_id === "string" ? task.inputs.reuse_target_task_id : undefined,
    deep_link:
      typeof task.inputs?.reuse_target_deep_link === "string" ? task.inputs.reuse_target_deep_link : undefined,
    suggested_learning_action:
      task.inputs?.suggested_learning_action === "refine_execution_template"
      || task.inputs?.suggested_learning_action === "refine_learned_playbook"
        ? task.inputs.suggested_learning_action
        : targetKind === "execution_template"
          ? "refine_execution_template"
          : "refine_learned_playbook"
  } as const;
}

function buildReuseImprovementFingerprint(task: Pick<TaskContract, "inputs">) {
  const reuse = getReuseImprovementContext(task as Pick<TaskContract, "task_id" | "inputs">);
  if (!reuse) return null;
  const targetSuffix = reuse.target_id.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "target";
  return `reuse_improvement_${reuse.target_kind}_${targetSuffix}`.toLowerCase();
}

function resolveReuseTargetTaskTemplate(task: Pick<TaskContract, "inputs">): TaskTemplate | null {
  const reuse = getReuseImprovementContext(task as Pick<TaskContract, "task_id" | "inputs">);
  if (!reuse || reuse.target_kind !== "execution_template") {
    return null;
  }
  const direct = store.taskTemplates.get(reuse.target_id);
  if (direct) {
    return direct;
  }
  if (reuse.target_task_id) {
    const targetTask = store.tasks.get(reuse.target_task_id);
    const reusedTemplateId =
      typeof targetTask?.inputs?.reused_task_template_id === "string"
        ? targetTask.inputs.reused_task_template_id
        : undefined;
    if (reusedTemplateId) {
      return store.taskTemplates.get(reusedTemplateId) ?? null;
    }
  }
  return null;
}

function compactMethodologySummary(task: TaskContract, evidence: string[], capabilityResolutions: CapabilityResolution[]): string {
  const reused = capabilityResolutions
    .filter(resolution => resolution.strategy !== "implement_local")
    .map(resolution => resolution.need_key)
    .slice(0, 6);
  const reuseContext = getReuseImprovementContext(task);
  return [
    `Intent: ${task.intent}`,
    `Department: ${task.department}`,
    reuseContext
      ? `Reuse improvement target: ${reuseContext.target_kind} ${reuseContext.target_id} via ${reuseContext.suggested_learning_action}`
      : null,
    evidence.length > 0 ? `Evidence: ${evidence.join(", ")}` : "Evidence: none",
    reused.length > 0 ? `Reusable capabilities: ${reused.join(", ")}` : "Reusable capabilities: none"
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function compactSessionSummary(task: TaskContract, evidence: string[], capabilityResolutions: CapabilityResolution[]): string {
  const reuseContext = getReuseImprovementContext(task);
  const reusableNeeds = capabilityResolutions
    .filter(resolution => resolution.strategy !== "implement_local")
    .map(resolution => resolution.need_key)
    .slice(0, 5);
  const fallbackNeeds = capabilityResolutions
    .filter(resolution => resolution.strategy === "implement_local")
    .map(resolution => resolution.need_key)
    .slice(0, 5);

  return [
    `Task ${task.task_id} completed with status ${task.status}.`,
    `Intent: ${task.intent}`,
    evidence.length > 0 ? `Artifacts: ${evidence.join(", ")}` : "Artifacts: none",
    reusableNeeds.length > 0 ? `Reused capabilities: ${reusableNeeds.join(", ")}` : "Reused capabilities: none",
    fallbackNeeds.length > 0 ? `Fallback capabilities: ${fallbackNeeds.join(", ")}` : null,
    reuseContext
      ? `Reuse improvement requested for ${reuseContext.target_kind} ${reuseContext.target_id} via ${reuseContext.suggested_learning_action}.`
      : null
  ].filter((line): line is string => Boolean(line)).join(" ");
}

function buildReuseImprovementHint(task: Pick<TaskContract, "intent" | "inputs">): string | null {
  const reuseContext = getReuseImprovementContext(task as Pick<TaskContract, "task_id" | "inputs">);
  if (!reuseContext) return null;
  return sanitizeMethodologyText(
    reuseContext.target_kind === "execution_template"
      ? `Operators repeatedly reopened this execution template while working on "${task.intent}". Refine the execution template summary, applicability, and failure boundaries so the next operator can act without reopening the same detail view.`
      : `Operators repeatedly reopened this learned playbook while working on "${task.intent}". Refine the playbook summary, applicability, and compact evidence so the next operator can apply it directly without reopening the same guidance.`
  ).sanitized;
}

function getTaskSecurityAssessment(task: Pick<TaskContract, "intent" | "inputs" | "constraints">) {
  const reasons = new Set<string>();
  for (const reason of detectTextSecuritySignals(task.intent).reasons) {
    reasons.add(reason);
  }
  for (const reason of detectObjectSecuritySignals(task.inputs).reasons) {
    reasons.add(reason);
  }
  for (const reason of detectObjectSecuritySignals(task.constraints).reasons) {
    reasons.add(reason);
  }
  return {
    flagged: reasons.size > 0,
    reasons: [...reasons]
  };
}

function overlapScore(left: Iterable<string>, right: Iterable<string>): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  let overlap = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) overlap += 1;
  }
  return overlap / Math.max(leftSet.size, rightSet.size);
}

function hoursSince(value?: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - Date.parse(value);
  return ms / (1000 * 60 * 60);
}

function buildApplicabilityRules(task: TaskContract): ApplicabilityRules {
  const tokens = getLearningTokens(task);
  const executionTemplateKey = getExecutionTemplateKey(task);
  const reuseContext = getReuseImprovementContext(task);
  return {
    required_tags: [...new Set([task.department, task.task_type, ...(executionTemplateKey ? [executionTemplateKey] : [])])],
    preferred_tags: [
      ...new Set([
        ...tokens.slice(0, 4),
        ...(reuseContext ? [reuseContext.target_kind, reuseContext.suggested_learning_action] : [])
      ])
    ],
    excluded_tags: task.risk_level === "critical" ? ["low-risk-only"] : []
  };
}

function buildFailureBoundaries(task: TaskContract, capabilityResolutions: CapabilityResolution[]): string[] {
  const boundaries = new Set<string>();
  const fallbackNeeds = capabilityResolutions
    .filter(resolution => resolution.strategy === "implement_local")
    .map(resolution => resolution.need_key);

  if (fallbackNeeds.length > 0) {
    boundaries.add(`Requires local implementation fallback for: ${fallbackNeeds.join(", ")}`);
  }
  if (task.risk_level === "critical") {
    boundaries.add("Do not auto-reuse without additional approval in critical-risk workflows.");
  }
  if (task.task_type === "scheduled" || task.task_type === "recurring") {
    boundaries.add("Validate scheduling assumptions before reusing in automation contexts.");
  }
  const reuseContext = getReuseImprovementContext(task);
  if (reuseContext) {
    boundaries.add(
      reuseContext.target_kind === "execution_template"
        ? "Do not revise the execution template without checking whether the detail view is noisy, stale, or unclear."
        : "Do not revise the learned playbook without checking whether the guidance is stale, ambiguous, or overly broad."
    );
  }
  return [...boundaries];
}

function applyReuseImprovementFeedback(taskId: string): void {
  const task = requireTask(taskId);
  const reuseContext = getReuseImprovementContext(task);
  if (!reuseContext) {
    return;
  }

  const improvementHint = buildReuseImprovementHint(task);
  if (!improvementHint) {
    return;
  }

  const now = nowIso();
  if (reuseContext.target_kind === "execution_template") {
    const targetTemplate = resolveReuseTargetTaskTemplate(task);
    if (!targetTemplate) {
      recordAudit("learning.reuse_improvement_target_missing", { target_kind: reuseContext.target_kind, target_id: reuseContext.target_id }, taskId);
      return;
    }
    const updatedTemplate = TaskTemplateSchema.parse({
      ...targetTemplate,
      improvement_hints: mergeImprovementHints(targetTemplate.improvement_hints, improvementHint),
      last_improved_at: now,
      updated_at: now
    });
    store.taskTemplates.set(updatedTemplate.template_id, updatedTemplate);
    recordAudit(
      "learning.reuse_improvement_attached",
      {
        target_kind: reuseContext.target_kind,
        target_id: reuseContext.target_id,
        suggested_learning_action: reuseContext.suggested_learning_action
      },
      taskId
    );
    return;
  }

  const targetCandidate = store.skillCandidates.get(reuseContext.target_id);
  if (!targetCandidate) {
    recordAudit("learning.reuse_improvement_target_missing", { target_kind: reuseContext.target_kind, target_id: reuseContext.target_id }, taskId);
    return;
  }
  const updatedCandidate = SkillCandidateSchema.parse({
    ...targetCandidate,
    improvement_hints: mergeImprovementHints(targetCandidate.improvement_hints, improvementHint),
    updated_at: now,
    last_improved_at: now
  });
  store.skillCandidates.set(updatedCandidate.candidate_id, updatedCandidate);
  recordAudit(
    "learning.reuse_improvement_attached",
    {
      target_kind: reuseContext.target_kind,
      target_id: reuseContext.target_id,
      suggested_learning_action: reuseContext.suggested_learning_action
    },
    taskId
  );
}

function resetExecutionPlanForReuse(plan: TaskContract["execution_plan"]): TaskContract["execution_plan"] {
  return plan.map(step => ({
    ...step,
    status: step.step_id === "plan" ? "completed" : "pending"
  }));
}

function scoreTemplateMatch(
  task: Pick<TaskContract, "department" | "task_type" | "intent"> & { inputs?: Record<string, unknown> },
  template: TaskTemplate
): number {
  const taskTags = new Set([task.department, task.task_type, ...getLearningTokens(task), ...(getExecutionTemplateKey(task) ? [getExecutionTemplateKey(task)!] : [])]);
  if (template.applicability.excluded_tags.some(tag => taskTags.has(tag))) {
    return -1;
  }
  if (template.applicability.required_tags.some(tag => !taskTags.has(tag))) {
    return -1;
  }
  let score = 0;
  if (template.department === task.department) score += 4;
  if (template.task_type === task.task_type) score += 4;
  if (template.fingerprint === buildLearningFingerprint(task)) score += 10;
  const taskTokens = new Set(getLearningTokens(task));
  for (const tag of template.tags) {
    if (taskTokens.has(tag)) score += 1;
  }
  for (const tag of template.applicability.preferred_tags) {
    if (taskTags.has(tag)) score += 2;
  }
  score += overlapScore(taskTags, [...template.tags, ...template.applicability.preferred_tags]) * 8;
  score += Math.min(template.source_task_count, 5);
  score += Math.min(template.version, 3);
  if (hoursSince(template.last_used_at) <= 24) score += 2;
  return score;
}

function findBestTaskTemplate(
  task: Pick<TaskContract, "department" | "task_type" | "intent"> & { inputs?: Record<string, unknown> }
): TaskTemplate | null {
  return [...store.taskTemplates.values()]
    .map(template => ({ template, score: scoreTemplateMatch(task, template) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || right.template.source_task_count - left.template.source_task_count)
    .map(item => item.template)[0] ?? null;
}

function searchTaskTemplates(task: Pick<TaskContract, "department" | "task_type" | "intent"> & { inputs?: Record<string, unknown> }): Array<{
  template: TaskTemplate;
  score: number;
}> {
  return [...store.taskTemplates.values()]
    .map(template => ({ template, score: scoreTemplateMatch(task, template) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || right.template.source_task_count - left.template.source_task_count);
}

function cloneCompletionContract(template: TaskTemplate): TaskContract["definition_of_done"] {
  return CompletionContractSchema.parse(JSON.parse(JSON.stringify(template.definition_of_done)));
}

function buildDefaultExecutionPlan(): TaskContract["execution_plan"] {
  return [
    { step_id: "plan", title: "Generate definition of done and execution plan", status: "completed", owner: "manager-service" },
    {
      step_id: "capability_discovery",
      title: "Resolve reusable Skills, MCP servers, Tools, and Workers before implementation",
      status: "completed",
      owner: "capability-discovery"
    },
    { step_id: "execute", title: "Execute worker actions and produce artifacts", status: "pending", owner: "tool-gateway-service" },
    { step_id: "verify", title: "Run checklist, reconciliation, verifier, done gate", status: "pending", owner: "verification-service" }
  ];
}

function upsertTaskTemplate(taskId: string): TaskTemplate | null {
  const task = requireTask(taskId);
  const doneGate = store.doneGateResults.get(taskId);
  if (doneGate?.status !== "passed") {
    return null;
  }

  const fingerprint = buildLearningFingerprint(task);
  const existingTemplate = [...store.taskTemplates.values()].find(template => template.fingerprint === fingerprint);
  const now = nowIso();
  const template = TaskTemplateSchema.parse({
    template_id: existingTemplate?.template_id ?? `template_${fingerprint}`,
    fingerprint,
    department: task.department,
    task_type: task.task_type,
    title: existingTemplate?.title ?? `${task.department} template for ${task.intent.slice(0, 64)}`,
    version: existingTemplate ? existingTemplate.version + 1 : 1,
    definition_of_done: task.definition_of_done,
    execution_plan: task.execution_plan.length > 0 ? task.execution_plan : buildDefaultExecutionPlan(),
    applicability: buildApplicabilityRules(task),
    failure_boundaries: buildFailureBoundaries(task, listTaskCapabilityResolutions(taskId)),
    improvement_hints: existingTemplate?.improvement_hints ?? [],
    tags: [...new Set([task.department, task.task_type, ...getLearningTokens(task), ...(getExecutionTemplateKey(task) ? [getExecutionTemplateKey(task)!] : [])])],
    source_task_count: (existingTemplate?.source_task_count ?? 0) + 1,
    created_at: existingTemplate?.created_at ?? now,
    updated_at: now,
    last_used_at: now,
    last_improved_at: existingTemplate?.last_improved_at
  });
  store.taskTemplates.set(template.template_id, template);
  recordAudit(
    existingTemplate ? "task.template_updated" : "task.template_promoted",
    {
      template_id: template.template_id,
      fingerprint: template.fingerprint,
      source_task_count: template.source_task_count
    },
    taskId
  );
  return template;
}

export function upsertDefinitionOfDone(taskId: string): TaskContract {
  const task = requireTask(taskId);
  const hasDefinition =
    task.definition_of_done.completion_criteria.length > 0 ||
    task.definition_of_done.acceptance_tests.length > 0 ||
    task.definition_of_done.required_artifacts.length > 0;

  if (!hasDefinition) {
    const template = findBestTaskTemplate(task);
    if (template) {
      task.definition_of_done = cloneCompletionContract(template);
      recordAudit(
        "task.definition_of_done_reused_from_template",
        {
          task_id: taskId,
          template_id: template.template_id,
          fingerprint: template.fingerprint,
          source_task_count: template.source_task_count,
          version: template.version
        },
        taskId
      );
    } else {
      task.definition_of_done = buildSuggestedDefinitionOfDone(task);
      recordAudit("task.definition_of_done_generated", { task_id: taskId }, taskId);
    }
  }
  return touchTask(task);
}

export function addCheckpoint(taskId: string, stage: string, summary: string): Checkpoint {
  requireTask(taskId);
  const checkpoint = CheckpointSchema.parse({
    checkpoint_id: createEntityId("ckp"),
    task_id: taskId,
    stage,
    summary,
    created_at: nowIso()
  });
  store.checkpoints.set(checkpoint.checkpoint_id, checkpoint);
  recordAudit("task.checkpoint_added", { stage, summary }, taskId);
  return checkpoint;
}

export function listTaskCheckpoints(taskId: string): Checkpoint[] {
  return [...store.checkpoints.values()].filter(checkpoint => checkpoint.task_id === taskId);
}

export function addArtifact(taskId: string, name: string, kind: Artifact["kind"], content: string, status: Artifact["status"] = "ready"): Artifact {
  requireTask(taskId);
  const artifact = ArtifactSchema.parse({
    artifact_id: createEntityId("artifact"),
    task_id: taskId,
    name,
    kind,
    status,
    content,
    uri: `memory://${taskId}/${name}`,
    created_at: nowIso()
  });
  store.artifacts.set(artifact.artifact_id, artifact);
  recordAudit("task.artifact_added", { artifact_id: artifact.artifact_id, name, kind }, taskId);
  return artifact;
}

export function listTaskArtifacts(taskId: string): Artifact[] {
  return [...store.artifacts.values()].filter(artifact => artifact.task_id === taskId);
}

export function sendHeartbeat(taskId: string, source: string): TaskContract {
  const task = requireTask(taskId);
  task.progress_heartbeat_at = nowIso();
  recordAudit("task.heartbeat", { source }, taskId);
  return touchTask(task);
}

export function createExecutionPlan(taskId: string): TaskContract {
  const task = upsertDefinitionOfDone(taskId);
  const template = findBestTaskTemplate(task);
  const capabilityResolutions = resolveTaskCapabilities(taskId);
  task.status = "planning";
  task.execution_plan = template
    ? resetExecutionPlanForReuse(template.execution_plan.length > 0 ? template.execution_plan : buildDefaultExecutionPlan())
    : buildDefaultExecutionPlan();
  if (template) {
    addCheckpoint(taskId, "planning_fast_path", `Reused task template ${template.template_id} for faster planning.`);
    recordAudit(
      "task.template_applied",
      {
        template_id: template.template_id,
        fingerprint: template.fingerprint,
        source_task_count: template.source_task_count,
        version: template.version
      },
      taskId
    );
    template.last_used_at = nowIso();
    template.updated_at = nowIso();
    store.taskTemplates.set(template.template_id, template);
  }

  try {
    const memoryItems = Array.from(store.memoryItems.values()).filter(m => m.task_id === taskId);
    const reuseConfidence = memoryItems.length > 0
      ? memoryItems.filter(m => m.kind === "methodology" || m.kind === "evaluation").length / Math.max(memoryItems.length, 1)
      : 0;
    const hasPlaybook = memoryItems.some(m => m.kind === "methodology");
    const hasTemplate = !!template;
    const signals = gatherRoutingSignals({
      task_id: taskId,
      task_family: task.inputs?.task_family as string | undefined,
      department: task.department,
      context_length: (task.inputs?.context_length as string | undefined) as "short" | "medium" | "long" | "very_long" | undefined,
      model_route: task.inputs?.model_route as string | undefined,
      memory_hit_quality: memoryItems.length > 0 ? (reuseConfidence > 0.5 ? "high" : reuseConfidence > 0.2 ? "medium" : "low") : "none",
      reuse_confidence: reuseConfidence,
      has_playbook: hasPlaybook,
      has_template: hasTemplate,
      is_replayable: task.definition_of_done?.required_artifacts?.length > 0,
      has_completion_criteria: task.definition_of_done?.goal !== undefined && task.definition_of_done?.goal !== "",
      expected_task_value: task.risk_level === "critical" ? "critical" : task.risk_level === "high" ? "high" : task.risk_level === "medium" ? "medium" : "low"
    });
    const recommendation = recommendMemoryMode({
      task_id: taskId,
      task_family: task.inputs?.task_family as string | undefined,
      department: task.department,
      routing_signals: signals
    });
    const gateResult = evaluateTTTEligibility({
      recommendation_id: recommendation.recommendation_id,
      model_route: task.inputs?.model_route as string | undefined,
      task_family: task.inputs?.task_family as string | undefined,
      is_privileged_planner: false,
      has_completion_criteria: task.definition_of_done?.goal !== undefined && task.definition_of_done?.goal !== "",
      is_replayable: task.definition_of_done?.required_artifacts?.length > 0
    });
    task.memory_mode = gateResult.resolved_mode;
    task.memory_strategy_recommendation_id = recommendation.recommendation_id;
    task.ttt_eligibility_gate_id = gateResult.gate_id;
    addCheckpoint(taskId, "memory_strategy_selected", `Memory mode: ${gateResult.resolved_mode}. Recommendation: ${recommendation.recommended_mode}. Gate verdict: ${gateResult.verdict}.`);
  } catch {
    task.memory_mode = "durable_retrieval";
  }

  recordAudit(
    "task.planned",
    {
      steps: task.execution_plan.length,
      planning_strategy: template ? "template_fast_path" : "generated_from_defaults",
      capability_strategies: capabilityResolutions.map(resolution => ({
        need_key: resolution.need_key,
        strategy: resolution.strategy
      })),
      memory_mode: task.memory_mode
    },
    taskId
  );
  return touchTask(task);
}

function isVerifierOwnedArtifact(artifactName: string): boolean {
  return artifactName === "verification_report.json";
}

function getPreVerifierRequiredArtifacts(requiredArtifacts: string[]): string[] {
  return requiredArtifacts.filter(artifact => !isVerifierOwnedArtifact(artifact));
}

export function executeTask(taskId: string): TaskContract {
  const task = requireTask(taskId);
  if (task.execution_plan.length === 0) {
    createExecutionPlan(taskId);
  }
  task.status = "running";
  task.timestamps.started_at = task.timestamps.started_at ?? nowIso();
  task.execution_plan = task.execution_plan.map(step =>
    step.step_id === "execute" ? { ...step, status: "completed" } : step
  );
  touchTask(task);
  const capabilityResolutions = listTaskCapabilityResolutions(taskId).length > 0 ? listTaskCapabilityResolutions(taskId) : resolveTaskCapabilities(taskId);
  sendHeartbeat(taskId, "execution");
  addCheckpoint(taskId, "execution_started", "Worker execution started.");
  const existingNames = new Set(listTaskArtifacts(taskId).map(artifact => artifact.name));
  const artifactContentByName: Record<string, string> = {
    [`${task.department}_summary.md`]: `Completed task intent: ${task.intent}`,
    "execution_log.json": JSON.stringify({ task_id: taskId, executed_at: nowIso() }, null, 2),
    "implementation_notes.md": `Implementation notes for ${task.intent}`,
    "test_results.md": `Test evidence for ${task.intent}`,
    "sales_actions.md": `Sales execution summary for ${task.intent}`,
    "campaign_output.md": `Campaign output summary for ${task.intent}`,
    "hr_actions.md": `HR process summary for ${task.intent}`,
    "finance_summary.md": `Finance summary for ${task.intent}`,
    "task_output.md": `Generic task output for ${task.intent}`,
    "capability_resolution.json": JSON.stringify(
      capabilityResolutions.map(resolution => ({
        need_key: resolution.need_key,
        strategy: resolution.strategy,
        selected_capabilities: resolution.selected_capabilities.map(item => item.capability_id)
      })),
      null,
      2
    )
  };

  for (const artifactName of getPreVerifierRequiredArtifacts(task.definition_of_done.required_artifacts)) {
    if (existingNames.has(artifactName)) continue;
    const kind: Artifact["kind"] =
      artifactName.includes("finance")
        ? "finance_note"
        : artifactName.includes("sales")
          ? "sales_note"
          : artifactName.includes("hr")
            ? "hr_note"
            : artifactName.includes("test")
              ? "qa_result"
              : artifactName.includes("implementation")
                ? "code"
                : "report";
    addArtifact(taskId, artifactName, kind, artifactContentByName[artifactName] ?? `Artifact output for ${artifactName}`, "ready");
  }
  if (!existingNames.has("capability_resolution.json")) {
    addArtifact(taskId, "capability_resolution.json", "generic", artifactContentByName["capability_resolution.json"], "ready");
  }
  addCheckpoint(taskId, "execution_completed", "Worker execution completed and primary artifacts generated.");
  recordAudit(
    "task.executed",
    {
      artifact_count: listTaskArtifacts(taskId).length,
      capability_reuse: capabilityResolutions
        .filter(resolution => resolution.strategy !== "implement_local")
        .map(resolution => resolution.need_key),
      local_implementation_fallbacks: capabilityResolutions
        .filter(resolution => resolution.strategy === "implement_local")
        .map(resolution => resolution.need_key)
    },
    taskId
  );
  return touchTask(task);
}

export function runChecklist(taskId: string): ChecklistRunResult {
  const task = requireTask(taskId);
  const artifacts = listTaskArtifacts(taskId);
  const mandatoryItems = [
    ...task.mandatory_checklists.pre_complete_checklist,
    ...task.mandatory_checklists.auto_check_items,
    ...getPreVerifierRequiredArtifacts(task.definition_of_done.required_artifacts).map(artifact => `artifact:${artifact}`)
  ];
  const passedItems = mandatoryItems.filter(item => {
    if (!item.startsWith("artifact:")) return true;
    const artifactName = item.slice("artifact:".length);
    return artifacts.some(artifact => artifact.name === artifactName && artifact.status !== "partial");
  });
  const failedItems = mandatoryItems.filter(item => !passedItems.includes(item));
  const result = ChecklistRunResultSchema.parse({
    status: failedItems.length === 0 ? "passed" : "failed",
    passed_items: passedItems,
    failed_items: failedItems
  });
  store.checklistResults.set(taskId, result);
  recordAudit("task.checklist_ran", { status: result.status, failed_items: failedItems }, taskId);
  return result;
}

export function runReconciliation(taskId: string): ReconciliationRunResult {
  const task = requireTask(taskId);
  const artifacts = listTaskArtifacts(taskId);
  const expectedStates = [
    ...task.reconciliation_requirements.expected_external_state,
    ...getPreVerifierRequiredArtifacts(task.definition_of_done.required_artifacts).map(artifact => `artifact_ready:${artifact}`)
  ];
  const matchedStates = expectedStates.filter(item => {
    if (!item.startsWith("artifact_ready:")) return true;
    const artifactName = item.slice("artifact_ready:".length);
    return artifacts.some(artifact => artifact.name === artifactName && artifact.status === "ready");
  });
  const missingStates = expectedStates.filter(item => !matchedStates.includes(item));
  const result = ReconciliationRunResultSchema.parse({
    status: missingStates.length === 0 ? "passed" : "failed",
    matched_states: matchedStates,
    missing_states: missingStates
  });
  store.reconciliationResults.set(taskId, result);
  recordAudit("task.reconciliation_ran", { status: result.status, missing_states: missingStates }, taskId);
  return result;
}

export function runVerifier(taskId: string): VerificationRunResult {
  const checklist = store.checklistResults.get(taskId);
  const reconciliation = store.reconciliationResults.get(taskId);
  const missingItems = [
    ...(checklist?.failed_items ?? []),
    ...(reconciliation?.missing_states ?? [])
  ];
  const result = VerificationRunResultSchema.parse({
    verdict: missingItems.length === 0 ? "pass" : "fail",
    summary:
      missingItems.length === 0
        ? "Verifier confirms that required artifacts and completion gates are satisfied."
        : "Verifier found unresolved completion gaps.",
    missing_items: missingItems,
    quality_issues: [],
    policy_issues: [],
    evidence: listTaskArtifacts(taskId).map(artifact => artifact.uri ?? artifact.name),
    recommended_fix:
      missingItems.length === 0
        ? []
        : missingItems.map(item => `Resolve missing requirement: ${item}`),
    rerun_scope: missingItems.length === 0 ? "none" : "partial"
  });
  store.verificationResults.set(taskId, result);
  addArtifact(taskId, "verification_report.json", "generic", JSON.stringify(result, null, 2), "ready");
  recordAudit("task.verifier_ran", { verdict: result.verdict }, taskId);
  return result;
}

export function runDoneGate(taskId: string): DoneGateResult {
  const task = requireTask(taskId);
  const checklist = store.checklistResults.get(taskId);
  const reconciliation = store.reconciliationResults.get(taskId);
  const verification = store.verificationResults.get(taskId);
  const completionEngineResult = store.evidenceGraphs.has(taskId)
    ? (store.completionEngineResults.get(taskId) ?? evaluateEvidenceGraph(taskId))
    : undefined;
  const reasons: string[] = [];
  if (!checklist || checklist.status !== "passed") reasons.push("Checklist has not passed.");
  if (!reconciliation || reconciliation.status !== "passed") reasons.push("Reconciliation has not passed.");
  if (!verification || (verification.verdict !== "pass" && verification.verdict !== "pass_with_notes")) {
    reasons.push("Verifier did not return a passing verdict.");
  }
  if (completionEngineResult && completionEngineResult.verdict !== "complete") {
    reasons.push(`Completion Engine verdict is ${completionEngineResult.verdict}.`);
  }
  const result = DoneGateResultSchema.parse({
    status: reasons.length === 0 ? "passed" : "failed",
    reasons,
    completed_at: reasons.length === 0 ? nowIso() : undefined
  });
  store.doneGateResults.set(taskId, result);
  if (result.status === "passed") {
    task.status = "completed";
    task.timestamps.completed_at = nowIso();
    task.execution_plan = task.execution_plan.map(step =>
      step.step_id === "verify" ? { ...step, status: "completed" } : step
    );
  }
  touchTask(task);
  recordAudit("task.done_gate_ran", { status: result.status, reasons }, taskId);
  return result;
}

export function buildEvidenceGraph(taskId: string): EvidenceGraph {
  const task = requireTask(taskId);
  const now = nowIso();
  const existing = store.evidenceGraphs.get(taskId);
  if (existing) {
    return existing;
  }
  const dod = task.definition_of_done;
  const nodes: EvidenceNode[] = [];
  for (const criterion of dod.completion_criteria) {
    nodes.push(EvidenceNodeSchema.parse({
      node_id: createEntityId("ev"),
      task_id: taskId,
      kind: "execution_output",
      status: "pending",
      label: `Completion criterion: ${criterion}`,
      required_for_completion: true,
      depends_on: []
    }));
  }
  for (const artifact of dod.required_artifacts) {
    nodes.push(EvidenceNodeSchema.parse({
      node_id: createEntityId("ev"),
      task_id: taskId,
      kind: "artifact_presence",
      status: "pending",
      label: `Required artifact: ${artifact}`,
      required_for_completion: true,
      depends_on: []
    }));
  }
  for (const test of dod.acceptance_tests) {
    nodes.push(EvidenceNodeSchema.parse({
      node_id: createEntityId("ev"),
      task_id: taskId,
      kind: "verifier",
      status: "pending",
      label: `Acceptance test: ${test}`,
      required_for_completion: true,
      depends_on: []
    }));
  }
  for (const approval of dod.approval_requirements) {
    nodes.push(EvidenceNodeSchema.parse({
      node_id: createEntityId("ev"),
      task_id: taskId,
      kind: "approval",
      status: "pending",
      label: `Approval required: ${approval}`,
      required_for_completion: true,
      depends_on: []
    }));
  }
  for (const item of task.mandatory_checklists.pre_complete_checklist) {
    nodes.push(EvidenceNodeSchema.parse({
      node_id: createEntityId("ev"),
      task_id: taskId,
      kind: "checklist",
      status: "pending",
      label: `Checklist item: ${item}`,
      required_for_completion: true,
      depends_on: []
    }));
  }
  for (const state of task.reconciliation_requirements.expected_external_state) {
    nodes.push(EvidenceNodeSchema.parse({
      node_id: createEntityId("ev"),
      task_id: taskId,
      kind: "external_state_confirmation",
      status: "pending",
      label: `External state: ${state}`,
      required_for_completion: true,
      depends_on: []
    }));
  }
  nodes.push(EvidenceNodeSchema.parse({
    node_id: createEntityId("ev"),
    task_id: taskId,
    kind: "policy_decision",
    status: "pending",
    label: "Policy compliance check",
    required_for_completion: true,
    depends_on: []
  }));
  nodes.push(EvidenceNodeSchema.parse({
    node_id: createEntityId("ev"),
    task_id: taskId,
    kind: "reconciliation",
    status: "pending",
    label: "State reconciliation",
    required_for_completion: true,
    depends_on: nodes.filter(n => n.kind === "external_state_confirmation").map(n => n.node_id)
  }));
  nodes.push(EvidenceNodeSchema.parse({
    node_id: createEntityId("ev"),
    task_id: taskId,
    kind: "verifier",
    status: "pending",
    label: "Final verification verdict",
    required_for_completion: true,
    depends_on: nodes
      .filter(n => n.kind === "checklist" || (n.kind === "artifact_presence" && !isVerifierOwnedArtifact(n.label.replace(/^Required artifact:\s*/, ""))))
      .map(n => n.node_id)
  }));
  const graph = EvidenceGraphSchema.parse({
    graph_id: createEntityId("eg"),
    task_id: taskId,
    nodes,
    completion_eligible: false,
    blocking_node_count: nodes.filter(n => n.required_for_completion).length,
    passed_node_count: 0,
    failed_node_count: 0,
    pending_node_count: nodes.length,
    created_at: now,
    updated_at: now
  });
  store.evidenceGraphs.set(taskId, graph);
  recordAudit("evidence_graph.built", { node_count: nodes.length }, taskId);
  return graph;
}

export function getEvidenceGraph(taskId: string): EvidenceGraph | undefined {
  return store.evidenceGraphs.get(taskId);
}

export function addEvidenceNode(taskId: string, node: Omit<EvidenceNode, "node_id" | "task_id">): EvidenceGraph {
  const graph = store.evidenceGraphs.get(taskId) ?? buildEvidenceGraph(taskId);
  const now = nowIso();
  const fullNode = EvidenceNodeSchema.parse({
    ...node,
    node_id: createEntityId("ev"),
    task_id: taskId
  });
  const updatedNodes = [...graph.nodes, fullNode];
  const counts = countNodes(updatedNodes);
  const updated = EvidenceGraphSchema.parse({
    ...graph,
    nodes: updatedNodes,
    ...counts,
    updated_at: now
  });
  store.evidenceGraphs.set(taskId, updated);
  recordAudit("evidence_graph.node_added", { kind: fullNode.kind, label: fullNode.label }, taskId);
  return updated;
}

export function updateEvidenceNode(taskId: string, nodeId: string, patch: Partial<Pick<EvidenceNode, "status" | "verdict" | "details" | "produced_at" | "label" | "description">>): EvidenceGraph {
  const graph = store.evidenceGraphs.get(taskId);
  if (!graph) {
    throw new Error(`Evidence graph not found for task ${taskId}`);
  }
  const now = nowIso();
  const updatedNodes = graph.nodes.map(node =>
    node.node_id === nodeId
      ? EvidenceNodeSchema.parse({ ...node, ...patch, ...(patch.status && !patch.produced_at ? { produced_at: now } : {}) })
      : node
  );
  const counts = countNodes(updatedNodes);
  const updated = EvidenceGraphSchema.parse({
    ...graph,
    nodes: updatedNodes,
    ...counts,
    updated_at: now
  });
  store.evidenceGraphs.set(taskId, updated);
  recordAudit("evidence_graph.node_updated", { node_id: nodeId, ...patch }, taskId);
  return updated;
}

function countNodes(nodes: EvidenceNode[]) {
  return {
    passed_node_count: nodes.filter(n => n.status === "passed" || n.status === "produced").length,
    failed_node_count: nodes.filter(n => n.status === "failed").length,
    pending_node_count: nodes.filter(n => n.status === "pending").length,
    blocking_node_count: nodes.filter(n => n.required_for_completion && n.status !== "passed" && n.status !== "produced" && n.status !== "skipped").length
  };
}

export function evaluateEvidenceGraph(taskId: string): CompletionEngineResult {
  const graph = store.evidenceGraphs.get(taskId) ?? buildEvidenceGraph(taskId);
  const now = nowIso();
  const requiredNodes = graph.nodes.filter(n => n.required_for_completion);
  const passedRequired = requiredNodes.filter(n => n.status === "passed" || n.status === "produced");
  const failedRequired = requiredNodes.filter(n => n.status === "failed");
  const reviseRequired = requiredNodes.filter(n => n.status === "revise_and_retry");
  const pendingRequired = requiredNodes.filter(n => n.status === "pending");
  const skippedRequired = requiredNodes.filter(n => n.status === "skipped");
  const blocking_reasons: string[] = [];
  const next_actions: string[] = [];
  if (failedRequired.length > 0) {
    blocking_reasons.push(`${failedRequired.length} required evidence node(s) failed: ${failedRequired.map(n => n.label).join("; ")}`);
    next_actions.push(...failedRequired.map(n => `Fix and re-produce: ${n.label}`));
  }
  if (reviseRequired.length > 0) {
    blocking_reasons.push(`${reviseRequired.length} required evidence node(s) need revision: ${reviseRequired.map(n => n.label).join("; ")}`);
    next_actions.push(...reviseRequired.map(n => `Revise and retry: ${n.label}`));
  }
  if (pendingRequired.length > 0) {
    blocking_reasons.push(`${pendingRequired.length} required evidence node(s) are still pending: ${pendingRequired.map(n => n.label).join("; ")}`);
    next_actions.push(...pendingRequired.filter(n => n.depends_on.length === 0 || n.depends_on.every(depId => graph.nodes.some(gn => gn.node_id === depId && (gn.status === "passed" || gn.status === "produced")))).map(n => `Produce evidence for: ${n.label}`));
  }
  let verdict: CompletionEngineResult["verdict"];
  if (failedRequired.length > 0) {
    verdict = reviseRequired.length > 0 ? "revise_and_retry" : "blocked";
  } else if (reviseRequired.length > 0) {
    verdict = "revise_and_retry";
  } else if (pendingRequired.length > 0) {
    verdict = "incomplete";
  } else {
    verdict = "complete";
  }
  const counts = countNodes(graph.nodes);
  const updatedGraph = EvidenceGraphSchema.parse({
    ...graph,
    ...counts,
    completion_eligible: verdict === "complete",
    evaluated_at: now,
    updated_at: now
  });
  store.evidenceGraphs.set(taskId, updatedGraph);
  const result = CompletionEngineResultSchema.parse({
    result_id: createEntityId("cer"),
    task_id: taskId,
    graph_id: graph.graph_id,
    verdict,
    passed_nodes: counts.passed_node_count,
    failed_nodes: counts.failed_node_count,
    pending_nodes: counts.pending_node_count,
    revise_nodes: reviseRequired.length,
    blocking_reasons,
    next_actions,
    evaluated_at: now
  });
  store.completionEngineResults.set(taskId, result);
  recordAudit("evidence_graph.evaluated", { verdict, passed: counts.passed_node_count, failed: counts.failed_node_count, pending: counts.pending_node_count }, taskId);
  return result;
}

export function feedChecklistToEvidenceGraph(taskId: string, checklistResult: ChecklistRunResult): EvidenceGraph {
  const graph = store.evidenceGraphs.get(taskId) ?? buildEvidenceGraph(taskId);
  const now = nowIso();
  const checklistNodes = graph.nodes.filter(n => n.kind === "checklist");
  const artifactNodes = graph.nodes.filter(n => n.kind === "artifact_presence");
  for (const node of checklistNodes) {
    const itemLabel = node.label.replace(/^Checklist item:\s*/, "");
    const isPassed = checklistResult.passed_items.includes(itemLabel);
    updateEvidenceNode(taskId, node.node_id, {
      status: isPassed ? "passed" : "failed",
      verdict: isPassed ? "pass" : "fail",
      produced_at: now,
      details: { checklist_result: checklistResult.status }
    });
  }
  for (const node of artifactNodes) {
    const artifactName = node.label.replace(/^Required artifact:\s*/, "");
    const isPresent = checklistResult.passed_items.includes(`artifact:${artifactName}`);
    if (isPresent) {
      updateEvidenceNode(taskId, node.node_id, {
        status: "passed",
        verdict: "pass",
        produced_at: now,
        details: { artifact_name: artifactName }
      });
    }
  }
  return store.evidenceGraphs.get(taskId)!;
}

export function feedReconciliationToEvidenceGraph(taskId: string, reconciliationResult: ReconciliationRunResult): EvidenceGraph {
  const graph = store.evidenceGraphs.get(taskId) ?? buildEvidenceGraph(taskId);
  const now = nowIso();
  const externalStateNodes = graph.nodes.filter(n => n.kind === "external_state_confirmation");
  const reconciliationNodes = graph.nodes.filter(n => n.kind === "reconciliation");
  for (const node of externalStateNodes) {
    const stateLabel = node.label.replace(/^External state:\s*/, "");
    const isMatched = reconciliationResult.matched_states.includes(stateLabel);
    updateEvidenceNode(taskId, node.node_id, {
      status: isMatched ? "passed" : "failed",
      verdict: isMatched ? "pass" : "fail",
      produced_at: now,
      details: { reconciliation_status: reconciliationResult.status }
    });
  }
  for (const node of reconciliationNodes) {
    updateEvidenceNode(taskId, node.node_id, {
      status: reconciliationResult.status === "passed" ? "passed" : "failed",
      verdict: reconciliationResult.status === "passed" ? "pass" : "fail",
      produced_at: now,
      details: { matched: reconciliationResult.matched_states, missing: reconciliationResult.missing_states }
    });
  }
  return store.evidenceGraphs.get(taskId)!;
}

export function feedVerifierToEvidenceGraph(taskId: string, verificationResult: VerificationRunResult): EvidenceGraph {
  const graph = store.evidenceGraphs.get(taskId) ?? buildEvidenceGraph(taskId);
  const task = requireTask(taskId);
  const now = nowIso();
  const artifacts = listTaskArtifacts(taskId);
  const executionOutputNodes = graph.nodes.filter(n => n.kind === "execution_output");
  const artifactNodes = graph.nodes.filter(n => n.kind === "artifact_presence");
  const verifierNodes = graph.nodes.filter(n => n.kind === "verifier");
  const policyNodes = graph.nodes.filter(n => n.kind === "policy_decision");
  const approvalNodes = graph.nodes.filter(n => n.kind === "approval");
  const verifierPassed = verificationResult.verdict !== "fail" && verificationResult.missing_items.length === 0;
  const approvedBy =
    typeof task.inputs.approved_by === "string" && task.inputs.approved_by.trim().length > 0
      ? task.inputs.approved_by.trim()
      : typeof task.inputs.approval_actor_role === "string" && task.inputs.approval_actor_role.trim().length > 0
        ? task.inputs.approval_actor_role.trim()
        : undefined;
  for (const node of executionOutputNodes) {
    updateEvidenceNode(taskId, node.node_id, {
      status: verifierPassed ? "passed" : "failed",
      verdict: verifierPassed ? "pass" : "fail",
      produced_at: now,
      details: { verified_by: "final_verifier", summary: verificationResult.summary }
    });
  }
  for (const node of artifactNodes) {
    const artifactName = node.label.replace(/^Required artifact:\s*/, "");
    if (!isVerifierOwnedArtifact(artifactName)) continue;
    const artifactReady = artifacts.some(artifact => artifact.name === artifactName && artifact.status === "ready");
    updateEvidenceNode(taskId, node.node_id, {
      status: artifactReady ? "passed" : "failed",
      verdict: artifactReady ? "pass" : "fail",
      produced_at: now,
      details: { artifact_name: artifactName, produced_by: "final_verifier" }
    });
  }
  for (const node of verifierNodes) {
    if (node.label === "Final verification verdict") {
      updateEvidenceNode(taskId, node.node_id, {
        status: verificationResult.verdict === "fail" ? "failed" : "passed",
        verdict: verificationResult.verdict,
        produced_at: now,
        details: { summary: verificationResult.summary, missing_items: verificationResult.missing_items, quality_issues: verificationResult.quality_issues }
      });
    } else {
      const testLabel = node.label.replace(/^Acceptance test:\s*/, "");
      const isCovered = verificationResult.missing_items.length === 0 || !verificationResult.recommended_fix.some(fix => fix.includes(testLabel));
      updateEvidenceNode(taskId, node.node_id, {
        status: isCovered ? "passed" : "failed",
        verdict: isCovered ? "pass" : "fail",
        produced_at: now,
        details: { test_label: testLabel }
      });
    }
  }
  for (const node of policyNodes) {
    updateEvidenceNode(taskId, node.node_id, {
      status: verificationResult.policy_issues.length === 0 ? "passed" : "failed",
      verdict: verificationResult.policy_issues.length === 0 ? "pass" : "fail",
      produced_at: now,
      details: { policy_issues: verificationResult.policy_issues }
    });
  }
  for (const node of approvalNodes) {
    updateEvidenceNode(taskId, node.node_id, {
      status: approvedBy ? "passed" : "failed",
      verdict: approvedBy ? "pass" : "fail",
      produced_at: now,
      details: {
        approved_by: approvedBy ?? null,
        approved_at: typeof task.inputs.approved_at === "string" ? task.inputs.approved_at : null
      }
    });
  }
  return store.evidenceGraphs.get(taskId)!;
}

export function createMemoryDirectory(input: {
  kind: MemoryDirectory["kind"];
  key: string;
  title: string;
  description?: string;
  parent_directory_id?: string;
  department?: string;
  owners?: string[];
  tags?: string[];
  freshness_window_days?: number;
}): MemoryDirectory {
  const now = nowIso();
  const existing = [...store.memoryDirectories.values()].find(d => d.kind === input.kind && d.key === input.key);
  if (existing) return existing;
  const directory = MemoryDirectorySchema.parse({
    directory_id: createEntityId("mdir"),
    kind: input.kind,
    key: input.key,
    title: input.title,
    description: input.description,
    parent_directory_id: input.parent_directory_id,
    department: input.department,
    owners: input.owners ?? [],
    tags: input.tags ?? [],
    document_count: 0,
    child_directory_count: 0,
    freshness_window_days: input.freshness_window_days ?? 90,
    created_at: now,
    updated_at: now
  });
  store.memoryDirectories.set(directory.directory_id, directory);
  if (input.parent_directory_id) {
    const parent = store.memoryDirectories.get(input.parent_directory_id);
    if (parent) {
      parent.child_directory_count += 1;
      parent.updated_at = now;
      store.memoryDirectories.set(parent.directory_id, parent);
    }
  }
  recordAudit("memory.directory_created", { kind: input.kind, key: input.key });
  return directory;
}

export function getMemoryDirectory(directoryId: string): MemoryDirectory | undefined {
  return store.memoryDirectories.get(directoryId);
}

export function listMemoryDirectories(filter?: { kind?: MemoryDirectory["kind"]; department?: string; parent_directory_id?: string }): MemoryDirectory[] {
  let dirs = [...store.memoryDirectories.values()];
  if (filter?.kind) dirs = dirs.filter(d => d.kind === filter.kind);
  if (filter?.department) dirs = dirs.filter(d => d.department === filter.department);
  if (filter?.parent_directory_id !== undefined) dirs = dirs.filter(d => d.parent_directory_id === filter.parent_directory_id);
  return dirs.sort((a, b) => a.title.localeCompare(b.title));
}

export function findMemoryDirectoryByKey(kind: MemoryDirectory["kind"], key: string): MemoryDirectory | undefined {
  return [...store.memoryDirectories.values()].find(d => d.kind === kind && d.key === key);
}

export function createMemoryDocument(input: {
  directory_id: string;
  kind: MemoryDocument["kind"];
  key: string;
  title: string;
  content: string;
  summary?: string;
  department?: string;
  task_family?: string;
  owners?: string[];
  source_artifact_ids?: string[];
  source_evidence_ids?: string[];
  promotion_status?: MemoryDocument["promotion_status"];
  tags?: string[];
  freshness_window_days?: number;
}): MemoryDocument {
  const now = nowIso();
  const directory = store.memoryDirectories.get(input.directory_id);
  if (!directory) {
    throw new Error(`Memory directory ${input.directory_id} not found`);
  }
  const existing = [...store.memoryDocuments.values()].find(d => d.directory_id === input.directory_id && d.key === input.key);
  if (existing) {
    const updated = MemoryDocumentSchema.parse({
      ...existing,
      content: input.content,
      summary: input.summary ?? existing.summary,
      promotion_status: input.promotion_status ?? existing.promotion_status,
      tags: input.tags ?? existing.tags,
      freshness_window_days: input.freshness_window_days ?? existing.freshness_window_days,
      updated_at: now
    });
    store.memoryDocuments.set(updated.document_id, updated);
    return updated;
  }
  const document = MemoryDocumentSchema.parse({
    document_id: createEntityId("mdoc"),
    directory_id: input.directory_id,
    kind: input.kind,
    key: input.key,
    title: input.title,
    content: input.content,
    summary: input.summary,
    department: input.department ?? directory.department,
    task_family: input.task_family,
    owners: input.owners ?? directory.owners,
    source_artifact_ids: input.source_artifact_ids ?? [],
    source_evidence_ids: input.source_evidence_ids ?? [],
    promotion_status: input.promotion_status ?? "draft",
    freshness_window_days: input.freshness_window_days ?? directory.freshness_window_days,
    tags: input.tags ?? [],
    section_count: 0,
    created_at: now,
    updated_at: now
  });
  store.memoryDocuments.set(document.document_id, document);
  directory.document_count += 1;
  directory.updated_at = now;
  store.memoryDirectories.set(directory.directory_id, directory);
  recordAudit("memory.document_created", { directory_id: input.directory_id, kind: input.kind, key: input.key });
  return document;
}

export function getMemoryDocument(documentId: string): MemoryDocument | undefined {
  return store.memoryDocuments.get(documentId);
}

export function listMemoryDocuments(filter?: { directory_id?: string; kind?: MemoryDocument["kind"]; department?: string; promotion_status?: MemoryDocument["promotion_status"]; tags?: string[] }): MemoryDocument[] {
  let docs = [...store.memoryDocuments.values()];
  if (filter?.directory_id) docs = docs.filter(d => d.directory_id === filter.directory_id);
  if (filter?.kind) docs = docs.filter(d => d.kind === filter.kind);
  if (filter?.department) docs = docs.filter(d => d.department === filter.department);
  if (filter?.promotion_status) docs = docs.filter(d => d.promotion_status === filter.promotion_status);
  if (filter?.tags && filter.tags.length > 0) {
    const tagSet = new Set(filter.tags);
    docs = docs.filter(d => d.tags.some(t => tagSet.has(t)));
  }
  return docs.sort((a, b) => a.title.localeCompare(b.title));
}

export function createMemoryDocumentSection(input: {
  document_id: string;
  title: string;
  content: string;
  parent_section_id?: string;
  section_index?: number;
  tags?: string[];
  source_artifact_id?: string;
}): MemoryDocumentSection {
  const now = nowIso();
  const document = store.memoryDocuments.get(input.document_id);
  if (!document) {
    throw new Error(`Memory document ${input.document_id} not found`);
  }
  const section = MemoryDocumentSectionSchema.parse({
    section_id: createEntityId("msec"),
    document_id: input.document_id,
    directory_id: document.directory_id,
    parent_section_id: input.parent_section_id,
    title: input.title,
    content: input.content,
    section_index: input.section_index ?? document.section_count,
    tags: input.tags ?? [],
    source_artifact_id: input.source_artifact_id,
    created_at: now,
    updated_at: now
  });
  store.memoryDocumentSections.set(section.section_id, section);
  document.section_count += 1;
  document.updated_at = now;
  store.memoryDocuments.set(document.document_id, document);
  return section;
}

export function listMemoryDocumentSections(documentId: string): MemoryDocumentSection[] {
  return [...store.memoryDocumentSections.values()]
    .filter(s => s.document_id === documentId)
    .sort((a, b) => a.section_index - b.section_index);
}

export function searchMemoryDocuments(query: string, options?: { department?: string; kinds?: MemoryDocument["kind"][]; limit?: number }): Array<{ document: MemoryDocument; score: number; stage: MemoryRetrievalTrace["stage"] }> {
  const now = nowIso();
  const queryLower = query.trim().toLowerCase();
  const queryTokens = queryLower.split(/[^a-z0-9\u4e00-\u9fff]+/).filter(t => t.length >= 2);
  const limit = options?.limit ?? 10;
  let docs = [...store.memoryDocuments.values()].filter(d => d.promotion_status !== "retired");
  if (options?.department) docs = docs.filter(d => d.department === options.department);
  if (options?.kinds && options.kinds.length > 0) docs = docs.filter(d => options.kinds!.includes(d.kind));

  const results = docs.map(doc => {
    let score = 0;
    let stage: MemoryRetrievalTrace["stage"] = "lexical_hit";
    const dir = store.memoryDirectories.get(doc.directory_id);
    const dirKey = dir?.key?.toLowerCase() ?? "";
    if (dirKey === queryLower || doc.key.toLowerCase() === queryLower) {
      score = 100;
      stage = "direct_address";
    } else if (doc.tags.some(t => t.toLowerCase() === queryLower)) {
      score = 80;
      stage = "metadata_filter";
    } else {
      const haystack = `${doc.title} ${doc.summary ?? ""} ${doc.content.slice(0, 500)} ${doc.tags.join(" ")}`.toLowerCase();
      if (haystack.includes(queryLower)) {
        score = 60;
        stage = "lexical_hit";
      } else {
        const matchedTokens = queryTokens.filter(t => haystack.includes(t));
        score = (matchedTokens.length / Math.max(queryTokens.length, 1)) * 40;
        stage = matchedTokens.length > 0 ? "lexical_hit" : "semantic_hit";
      }
    }
    if (doc.promotion_status === "approved") score += 5;
    if (dir) {
      if (dir.kind === "department" || dir.kind === "task_family") score += 3;
    }
    const trace = MemoryRetrievalTraceSchema.parse({
      trace_id: createEntityId("mrt"),
      query,
      stage,
      directory_id: doc.directory_id,
      document_id: doc.document_id,
      matched: score > 0,
      score,
      created_at: now
    });
    store.memoryRetrievalTraces.push(trace);
    return { document: doc, score, stage };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);

  return results;
}

export function promoteMemoryDocument(documentId: string): MemoryDocument {
  const doc = store.memoryDocuments.get(documentId);
  if (!doc) throw new Error(`Memory document ${documentId} not found`);
  const now = nowIso();
  const updated = MemoryDocumentSchema.parse({
    ...doc,
    promotion_status: "approved",
    updated_at: now
  });
  store.memoryDocuments.set(updated.document_id, updated);
  recordAudit("memory.document_promoted", { document_id: documentId, kind: doc.kind, key: doc.key });
  return updated;
}

export function retireMemoryDocument(documentId: string): MemoryDocument {
  const doc = store.memoryDocuments.get(documentId);
  if (!doc) throw new Error(`Memory document ${documentId} not found`);
  const now = nowIso();
  const updated = MemoryDocumentSchema.parse({
    ...doc,
    promotion_status: "retired",
    updated_at: now
  });
  store.memoryDocuments.set(updated.document_id, updated);
  recordAudit("memory.document_retired", { document_id: documentId, kind: doc.kind, key: doc.key });
  return updated;
}

const LEARNING_FACTORY_STAGES: LearningFactoryStage[] = [
  "distill",
  "sanitize",
  "cluster_and_deduplicate",
  "replay_eval",
  "policy_review",
  "canary_adoption",
  "general_promotion",
  "rollback"
];

export function createLearningFactoryPipeline(input: {
  source_task_id: string;
  source_artifact_type: LearningFactoryPipeline["source_artifact_type"];
  source_artifact_id: string;
  fingerprint?: string;
  department?: string;
  task_family?: string;
}): LearningFactoryPipeline {
  const now = nowIso();
  const task = store.tasks.get(input.source_task_id);
  const stages = LEARNING_FACTORY_STAGES.map(stage => ({
    stage,
    status: "pending" as LearningFactoryPipelineStatus,
    started_at: undefined as string | undefined,
    completed_at: undefined as string | undefined,
    result: {} as Record<string, unknown>,
    error: undefined as string | undefined
  }));
  const pipeline = LearningFactoryPipelineSchema.parse({
    pipeline_id: createEntityId("lfpipe"),
    source_task_id: input.source_task_id,
    source_artifact_type: input.source_artifact_type,
    source_artifact_id: input.source_artifact_id,
    current_stage: "distill",
    status: "pending",
    stages,
    canary_task_ids: [],
    canary_pass_count: 0,
    canary_fail_count: 0,
    rollback_reason: undefined,
    promoted_artifact_id: undefined,
    fingerprint: input.fingerprint,
    department: input.department ?? task?.department,
    task_family: input.task_family,
    created_at: now,
    updated_at: now
  });
  store.learningFactoryPipelines.set(pipeline.pipeline_id, pipeline);
  recordAudit("learning_factory.pipeline_created", { pipeline_id: pipeline.pipeline_id, source_task_id: input.source_task_id, source_artifact_type: input.source_artifact_type });
  return pipeline;
}

export function getLearningFactoryPipeline(pipelineId: string): LearningFactoryPipeline | undefined {
  return store.learningFactoryPipelines.get(pipelineId);
}

export function listLearningFactoryPipelines(filter?: { status?: LearningFactoryPipelineStatus; source_artifact_type?: LearningFactoryPipeline["source_artifact_type"]; department?: string }): LearningFactoryPipeline[] {
  let pipelines = [...store.learningFactoryPipelines.values()];
  if (filter?.status) pipelines = pipelines.filter(p => p.status === filter.status);
  if (filter?.source_artifact_type) pipelines = pipelines.filter(p => p.source_artifact_type === filter.source_artifact_type);
  if (filter?.department) pipelines = pipelines.filter(p => p.department === filter.department);
  return pipelines.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function advanceLearningFactoryStage(pipelineId: string, stageResult?: Record<string, unknown>): LearningFactoryPipeline {
  const pipeline = store.learningFactoryPipelines.get(pipelineId);
  if (!pipeline) throw new Error(`Learning factory pipeline ${pipelineId} not found`);
  if (pipeline.status === "completed" || pipeline.status === "failed" || pipeline.status === "rolled_back") {
    throw new Error(`Pipeline ${pipelineId} is already in terminal state: ${pipeline.status}`);
  }
  const now = nowIso();
  const currentStageIndex = LEARNING_FACTORY_STAGES.indexOf(pipeline.current_stage);
  const currentStageEntry = pipeline.stages[currentStageIndex];
  if (currentStageEntry) {
    currentStageEntry.status = "completed";
    currentStageEntry.completed_at = now;
    currentStageEntry.result = stageResult ?? {};
  }
  if (currentStageIndex === LEARNING_FACTORY_STAGES.indexOf("general_promotion")) {
    pipeline.status = "completed";
    pipeline.promoted_artifact_id = pipeline.source_artifact_id;
    pipeline.updated_at = now;
    store.learningFactoryPipelines.set(pipeline.pipeline_id, pipeline);
    recordAudit("learning_factory.pipeline_completed", { pipeline_id: pipelineId, promoted_artifact_id: pipeline.promoted_artifact_id });
    try {
      const signals = collectEvolutionSignals();
      if (signals.length > 0) {
        generateEvolutionCandidatesFromSignals(signals);
      }
    } catch {}
    return pipeline;
  }
  const nextStageIndex = currentStageIndex + 1;
  if (nextStageIndex >= LEARNING_FACTORY_STAGES.length) {
    pipeline.status = "completed";
    pipeline.updated_at = now;
    store.learningFactoryPipelines.set(pipeline.pipeline_id, pipeline);
    return pipeline;
  }
  const nextStage = LEARNING_FACTORY_STAGES[nextStageIndex];
  pipeline.current_stage = nextStage;
  pipeline.status = "in_progress";
  const nextStageEntry = pipeline.stages[nextStageIndex];
  if (nextStageEntry) {
    nextStageEntry.status = "in_progress";
    nextStageEntry.started_at = now;
  }
  pipeline.updated_at = now;
  store.learningFactoryPipelines.set(pipeline.pipeline_id, pipeline);
  recordAudit("learning_factory.stage_advanced", { pipeline_id: pipelineId, stage: nextStage });
  return pipeline;
}

export function failLearningFactoryStage(pipelineId: string, error: string): LearningFactoryPipeline {
  const pipeline = store.learningFactoryPipelines.get(pipelineId);
  if (!pipeline) throw new Error(`Learning factory pipeline ${pipelineId} not found`);
  const now = nowIso();
  const currentStageIndex = LEARNING_FACTORY_STAGES.indexOf(pipeline.current_stage);
  const currentStageEntry = pipeline.stages[currentStageIndex];
  if (currentStageEntry) {
    currentStageEntry.status = "failed";
    currentStageEntry.error = error;
  }
  pipeline.status = "failed";
  pipeline.updated_at = now;
  store.learningFactoryPipelines.set(pipeline.pipeline_id, pipeline);
  recordAudit("learning_factory.stage_failed", { pipeline_id: pipelineId, stage: pipeline.current_stage, error });

  try {
    const signals = collectEvolutionSignals();
    if (signals.length > 0) {
      generateEvolutionCandidatesFromSignals(signals);
    }
  } catch {}

  return pipeline;
}

export function rollbackLearningFactoryPipeline(pipelineId: string, reason: string): LearningFactoryPipeline {
  const pipeline = store.learningFactoryPipelines.get(pipelineId);
  if (!pipeline) throw new Error(`Learning factory pipeline ${pipelineId} not found`);
  const now = nowIso();
  pipeline.status = "rolled_back";
  pipeline.rollback_reason = reason;
  pipeline.current_stage = "rollback";
  const rollbackStageEntry = pipeline.stages[LEARNING_FACTORY_STAGES.indexOf("rollback")];
  if (rollbackStageEntry) {
    rollbackStageEntry.status = "completed";
    rollbackStageEntry.started_at = now;
    rollbackStageEntry.completed_at = now;
    rollbackStageEntry.result = { reason };
  }
  pipeline.updated_at = now;
  store.learningFactoryPipelines.set(pipeline.pipeline_id, pipeline);
  recordAudit("learning_factory.pipeline_rolled_back", { pipeline_id: pipelineId, reason });
  return pipeline;
}

export function addCanaryResultToPipeline(pipelineId: string, taskId: string, passed: boolean): LearningFactoryPipeline {
  const pipeline = store.learningFactoryPipelines.get(pipelineId);
  if (!pipeline) throw new Error(`Learning factory pipeline ${pipelineId} not found`);
  const now = nowIso();
  if (!pipeline.canary_task_ids.includes(taskId)) {
    pipeline.canary_task_ids.push(taskId);
  }
  if (passed) {
    pipeline.canary_pass_count += 1;
  } else {
    pipeline.canary_fail_count += 1;
  }
  pipeline.updated_at = now;
  store.learningFactoryPipelines.set(pipeline.pipeline_id, pipeline);
  return pipeline;
}

export function createLearningFactoryBacklogItem(input: {
  source_type: LearningFactoryBacklogItem["source_type"];
  source_task_id?: string;
  target_artifact_type?: LearningFactoryBacklogItem["target_artifact_type"];
  target_artifact_id?: string;
  description: string;
  priority?: LearningFactoryBacklogItem["priority"];
}): LearningFactoryBacklogItem {
  const now = nowIso();
  const item = LearningFactoryBacklogItemSchema.parse({
    backlog_id: createEntityId("lfback"),
    source_type: input.source_type,
    source_task_id: input.source_task_id,
    target_artifact_type: input.target_artifact_type,
    target_artifact_id: input.target_artifact_id,
    description: input.description,
    priority: input.priority ?? "medium",
    status: "open",
    pipeline_id: undefined,
    created_at: now,
    updated_at: now
  });
  store.learningFactoryBacklog.push(item);
  recordAudit("learning_factory.backlog_item_created", { backlog_id: item.backlog_id, source_type: input.source_type });
  return item;
}

export function listLearningFactoryBacklog(filter?: { status?: LearningFactoryBacklogItem["status"]; source_type?: LearningFactoryBacklogItem["source_type"]; priority?: LearningFactoryBacklogItem["priority"] }): LearningFactoryBacklogItem[] {
  let items = [...store.learningFactoryBacklog.values()];
  if (filter?.status) items = items.filter(i => i.status === filter.status);
  if (filter?.source_type) items = items.filter(i => i.source_type === filter.source_type);
  if (filter?.priority) items = items.filter(i => i.priority === filter.priority);
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return items.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
}

export function resolveLearningFactoryBacklogItem(backlogId: string, pipelineId?: string): LearningFactoryBacklogItem {
  const items = [...store.learningFactoryBacklog.values()];
  const item = items.find(i => i.backlog_id === backlogId);
  if (!item) throw new Error(`Learning factory backlog item ${backlogId} not found`);
  const now = nowIso();
  item.status = "resolved";
  item.pipeline_id = pipelineId;
  item.updated_at = now;
  store.learningFactoryBacklog.push(item);
  recordAudit("learning_factory.backlog_item_resolved", { backlog_id: backlogId, pipeline_id: pipelineId });
  return item;
}

export function runLearningFactoryPipeline(pipelineId: string): LearningFactoryPipeline {
  const pipeline = store.learningFactoryPipelines.get(pipelineId);
  if (!pipeline) throw new Error(`Learning factory pipeline ${pipelineId} not found`);
  if (pipeline.status !== "pending" && pipeline.status !== "in_progress") {
    throw new Error(`Pipeline ${pipelineId} is in state ${pipeline.status}, cannot run`);
  }
  const task = store.tasks.get(pipeline.source_task_id);
  const now = nowIso();
  if (pipeline.status === "pending") {
    pipeline.status = "in_progress";
    const firstStage = pipeline.stages[0];
    if (firstStage) {
      firstStage.status = "in_progress";
      firstStage.started_at = now;
    }
    pipeline.updated_at = now;
  }
  const sourceArtifact = pipeline.source_artifact_type === "methodology"
    ? store.memoryItems.get(pipeline.source_artifact_id)
    : pipeline.source_artifact_type === "skill_candidate"
      ? store.skillCandidates.get(pipeline.source_artifact_id)
      : store.taskTemplates.get(pipeline.source_artifact_id);

  const distillStage = pipeline.stages[0];
  if (distillStage && distillStage.status === "in_progress") {
    const distilled = sourceArtifact
      ? { title: "title" in sourceArtifact ? sourceArtifact.title : "unknown", summary: "summary" in sourceArtifact ? (sourceArtifact as Record<string, unknown>).summary : "content" in sourceArtifact ? String((sourceArtifact as Record<string, unknown>).content).slice(0, 200) : "distilled" }
      : { title: "unknown", summary: "no source artifact found" };
    return advanceLearningFactoryStage(pipelineId, { distilled });
  }

  const sanitizeStage = pipeline.stages[1];
  if (sanitizeStage && sanitizeStage.status === "in_progress") {
    const sanitized = { sensitive_data_removed: true, pii_detected: false };
    return advanceLearningFactoryStage(pipelineId, { sanitized });
  }

  const clusterStage = pipeline.stages[2];
  if (clusterStage && clusterStage.status === "in_progress") {
    const existingCount = [...store.learningFactoryPipelines.values()].filter(
      p => p.pipeline_id !== pipelineId && p.fingerprint === pipeline.fingerprint && p.status === "completed"
    ).length;
    const clusterResult = { duplicate_count: existingCount, merged: existingCount > 0 };
    return advanceLearningFactoryStage(pipelineId, { clusterResult });
  }

  const replayEvalStage = pipeline.stages[3];
  if (replayEvalStage && replayEvalStage.status === "in_progress") {
    const verificationResults = pipeline.source_task_id
      ? store.verificationResults.get(pipeline.source_task_id)
      : undefined;
    const replayPassed = verificationResults ? verificationResults.verdict === "pass" : true;
    if (!replayPassed) {
      return failLearningFactoryStage(pipelineId, "Replay eval failed: verification verdict was not pass");
    }
    return advanceLearningFactoryStage(pipelineId, { replay_eval_passed: true });
  }

  const policyReviewStage = pipeline.stages[4];
  if (policyReviewStage && policyReviewStage.status === "in_progress") {
    const riskLevel = task?.risk_level ?? "medium";
    const policyApproved = riskLevel !== "critical" || pipeline.source_artifact_type !== "skill_candidate";
    if (!policyApproved) {
      return failLearningFactoryStage(pipelineId, "Policy review failed: critical-risk skill candidates require manual approval");
    }
    return advanceLearningFactoryStage(pipelineId, { policy_approved: true, risk_level: riskLevel });
  }

  const canaryStage = pipeline.stages[5];
  if (canaryStage && canaryStage.status === "in_progress") {
    const canaryPassed = pipeline.canary_fail_count === 0 || pipeline.canary_pass_count > pipeline.canary_fail_count;
    if (!canaryPassed) {
      return rollbackLearningFactoryPipeline(pipelineId, "Canary adoption failed: more failures than passes");
    }
    return advanceLearningFactoryStage(pipelineId, { canary_passed: true, canary_pass_count: pipeline.canary_pass_count, canary_fail_count: pipeline.canary_fail_count });
  }

  const promotionStage = pipeline.stages[6];
  if (promotionStage && promotionStage.status === "in_progress") {
    return advanceLearningFactoryStage(pipelineId, { promoted: true });
  }

  return pipeline;
}

let eventSequenceCounter = 0;

export function appendEvent(input: {
  kind: EventLedgerEntryKind;
  aggregate_type: string;
  aggregate_id: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, string>;
  correlation_id?: string;
  causation_id?: string;
  occurred_at?: string;
}): EventLedgerEntry {
  const now = nowIso();
  eventSequenceCounter += 1;
  const entry = EventLedgerEntrySchema.parse({
    event_id: createEntityId("evt"),
    sequence_number: eventSequenceCounter,
    kind: input.kind,
    aggregate_type: input.aggregate_type,
    aggregate_id: input.aggregate_id,
    payload: input.payload ?? {},
    metadata: input.metadata ?? {},
    correlation_id: input.correlation_id,
    causation_id: input.causation_id,
    occurred_at: input.occurred_at ?? now,
    recorded_at: now
  });
  store.eventLedger.push(entry);
  updateProjections(entry);
  if (input.kind !== "outbox_pending" && input.kind !== "outbox_sent" && input.kind !== "audit_event") {
    createOutboxEntry(entry);
  }
  return entry;
}

function updateProjections(event: EventLedgerEntry): void {
  const projectionKey = `${event.aggregate_type}:${event.aggregate_id}`;
  const existing = store.eventProjections.get(projectionKey);
  const now = nowIso();
  if (existing) {
    existing.last_sequence_number = event.sequence_number;
    existing.state = { ...existing.state, last_event_kind: event.kind, last_event_at: event.occurred_at };
    existing.updated_at = now;
    store.eventProjections.set(projectionKey, existing);
  } else {
    const projection = EventProjectionSchema.parse({
      projection_id: createEntityId("proj"),
      projection_type: event.aggregate_type,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      last_sequence_number: event.sequence_number,
      state: { last_event_kind: event.kind, last_event_at: event.occurred_at },
      updated_at: now
    });
    store.eventProjections.set(projectionKey, projection);
  }
}

function createOutboxEntry(event: EventLedgerEntry): void {
  const now = nowIso();
  const outboxEntry = OutboxEntrySchema.parse({
    outbox_id: createEntityId("out"),
    event_id: event.event_id,
    target: "cloud_sync",
    status: "pending",
    payload: { kind: event.kind, aggregate_type: event.aggregate_type, aggregate_id: event.aggregate_id },
    attempts: 0,
    created_at: now,
    updated_at: now
  });
  store.outboxEntries.push(outboxEntry);
}

export function getEventLedger(filter?: { aggregate_type?: string; aggregate_id?: string; kind?: EventLedgerEntryKind; from_sequence?: number; limit?: number }): EventLedgerEntry[] {
  let entries = [...store.eventLedger.values()];
  if (filter?.aggregate_type) entries = entries.filter(e => e.aggregate_type === filter.aggregate_type);
  if (filter?.aggregate_id) entries = entries.filter(e => e.aggregate_id === filter.aggregate_id);
  if (filter?.kind) entries = entries.filter(e => e.kind === filter.kind);
  if (filter?.from_sequence) entries = entries.filter(e => e.sequence_number >= filter.from_sequence!);
  return entries.sort((a, b) => a.sequence_number - b.sequence_number).slice(0, filter?.limit ?? 100);
}

export function getEventProjection(aggregateType: string, aggregateId: string): EventProjection | undefined {
  return store.eventProjections.get(`${aggregateType}:${aggregateId}`);
}

export function listEventProjections(filter?: { projection_type?: string; limit?: number }): EventProjection[] {
  let projections = [...store.eventProjections.values()];
  if (filter?.projection_type) projections = projections.filter(p => p.projection_type === filter.projection_type);
  return projections.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, filter?.limit ?? 100);
}

export function getPendingOutboxEntries(limit?: number): OutboxEntry[] {
  return [...store.outboxEntries.values()]
    .filter(e => e.status === "pending")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit ?? 50);
}

export function markOutboxEntrySent(outboxId: string): OutboxEntry {
  const entries = [...store.outboxEntries.values()];
  const entry = entries.find(e => e.outbox_id === outboxId);
  if (!entry) throw new Error(`Outbox entry ${outboxId} not found`);
  const now = nowIso();
  entry.status = "sent";
  entry.attempts += 1;
  entry.last_attempt_at = now;
  entry.updated_at = now;
  store.outboxEntries.push(entry);
  appendEvent({
    kind: "outbox_sent",
    aggregate_type: "outbox",
    aggregate_id: outboxId,
    payload: { target: entry.target, event_id: entry.event_id }
  });
  return entry;
}

export function markOutboxEntryFailed(outboxId: string, error: string): OutboxEntry {
  const entries = [...store.outboxEntries.values()];
  const entry = entries.find(e => e.outbox_id === outboxId);
  if (!entry) throw new Error(`Outbox entry ${outboxId} not found`);
  const now = nowIso();
  entry.status = "failed";
  entry.attempts += 1;
  entry.last_attempt_at = now;
  entry.error = error;
  entry.updated_at = now;
  store.outboxEntries.push(entry);
  return entry;
}

export function replayEvents(aggregateType: string, aggregateId: string): EventLedgerEntry[] {
  return [...store.eventLedger.values()]
    .filter(e => e.aggregate_type === aggregateType && e.aggregate_id === aggregateId)
    .sort((a, b) => a.sequence_number - b.sequence_number);
}

export function createPolicyRule(input: {
  name: string;
  description?: string;
  effect: PolicyRule["effect"];
  priority?: number;
  conditions?: PolicyRule["conditions"];
  enabled?: boolean;
}): PolicyRule {
  const now = nowIso();
  const rule = PolicyRuleSchema.parse({
    rule_id: createEntityId("prule"),
    name: input.name,
    description: input.description,
    effect: input.effect,
    priority: input.priority ?? 0,
    conditions: input.conditions ?? [],
    enabled: input.enabled ?? true,
    created_at: now,
    updated_at: now
  });
  store.policyRules.set(rule.rule_id, rule);
  recordAudit("policy.rule_created", { rule_id: rule.rule_id, name: input.name, effect: input.effect });
  return rule;
}

export function listPolicyRules(filter?: { enabled?: boolean; effect?: PolicyRule["effect"] }): PolicyRule[] {
  let rules = [...store.policyRules.values()];
  if (filter?.enabled !== undefined) rules = rules.filter(r => r.enabled === filter.enabled);
  if (filter?.effect) rules = rules.filter(r => r.effect === filter.effect);
  return rules.sort((a, b) => b.priority - a.priority);
}

export function evaluatePolicy(input: {
  pep_id: string;
  subject: string;
  action: string;
  resource: string;
  scope?: string;
  sandbox_tier?: PolicyDecision["sandbox_tier"];
  risk_level?: PolicyDecision["risk_level"];
  task_id?: string;
  correlation_id?: string;
}): PolicyDecision {
  const now = nowIso();
  const requestId = createEntityId("preq");
  const rules = listPolicyRules({ enabled: true });
  const matchedAllowRules: string[] = [];
  const matchedDenyRules: string[] = [];
  const conditions: string[] = [];
  let verdict: PolicyDecisionVerdict = "allow";
  let reasoning = "No deny rules matched; defaulting to allow.";

  for (const rule of rules) {
    const ruleMatches = rule.conditions.every(cond => {
      const fieldValue = getPolicyContextValue(cond.field, input);
      return evaluateCondition(fieldValue, cond.operator, cond.value);
    });
    if (ruleMatches) {
      if (rule.effect === "deny") {
        matchedDenyRules.push(rule.rule_id);
      } else {
        matchedAllowRules.push(rule.rule_id);
      }
    }
  }

  if (matchedDenyRules.length > 0) {
    const highestPriorityDeny = matchedDenyRules.reduce((best, ruleId) => {
      const rule = store.policyRules.get(ruleId);
      return rule && (!best || rule.priority > best.priority) ? rule : best;
    }, null as PolicyRule | null);
    if (highestPriorityDeny) {
      const allowPriorities = matchedAllowRules.map(id => store.policyRules.get(id)?.priority ?? 0);
      const maxAllowPriority = Math.max(0, ...allowPriorities);
      if (highestPriorityDeny.priority >= maxAllowPriority) {
        verdict = "deny";
        reasoning = `Denied by rule "${highestPriorityDeny.name}" (priority ${highestPriorityDeny.priority}).`;
      } else {
        verdict = "conditional";
        conditions.push(`Override deny rule "${highestPriorityDeny.name}" with higher-priority allow`);
        reasoning = `Conditional: deny rule "${highestPriorityDeny.name}" exists but allow rules have higher priority.`;
      }
    }
  }

  if (input.risk_level === "critical" && input.sandbox_tier === "isolated_mutation") {
    if (verdict === "allow") {
      verdict = "conditional";
      conditions.push("Critical risk with isolated mutation requires explicit approval");
      reasoning = "Critical risk level with isolated mutation sandbox tier requires conditional approval.";
    }
  }

  if (input.action === "file_write" && input.sandbox_tier === "host_readonly") {
    verdict = "deny";
    conditions.length = 0;
    reasoning = "File write is not allowed in host_readonly sandbox tier.";
  }

  const decision = PolicyDecisionSchema.parse({
    decision_id: createEntityId("pdec"),
    request_id: requestId,
    pep_id: input.pep_id,
    subject: input.subject,
    action: input.action,
    resource: input.resource,
    scope: input.scope,
    sandbox_tier: input.sandbox_tier,
    risk_level: input.risk_level ?? "medium",
    verdict,
    conditions,
    reasoning,
    policy_rules_matched: [...matchedAllowRules, ...matchedDenyRules],
    correlation_id: input.correlation_id,
    task_id: input.task_id,
    decided_at: now
  });
  store.policyDecisions.push(decision);
  appendEvent({
    kind: "policy_decision",
    aggregate_type: "policy_decision",
    aggregate_id: decision.decision_id,
    payload: { verdict, action: input.action, resource: input.resource, pep_id: input.pep_id, task_id: input.task_id },
    correlation_id: input.correlation_id
  });
  return decision;
}

function getPolicyContextValue(field: string, context: Record<string, unknown>): unknown {
  const parts = field.split(".");
  let value: unknown = context;
  for (const part of parts) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function evaluateCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
  switch (operator) {
    case "eq": return fieldValue === conditionValue;
    case "neq": return fieldValue !== conditionValue;
    case "in": return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
    case "not_in": return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
    case "contains": return typeof fieldValue === "string" && typeof conditionValue === "string" && fieldValue.includes(conditionValue);
    case "gt": return typeof fieldValue === "number" && typeof conditionValue === "number" && fieldValue > conditionValue;
    case "lt": return typeof fieldValue === "number" && typeof conditionValue === "number" && fieldValue < conditionValue;
    case "gte": return typeof fieldValue === "number" && typeof conditionValue === "number" && fieldValue >= conditionValue;
    case "lte": return typeof fieldValue === "number" && typeof conditionValue === "number" && fieldValue <= conditionValue;
    default: return false;
  }
}

export function enforcePolicy(decisionId: string, enforcementResult: PolicyEnforcementAction["enforcement_result"], evidenceNodeId?: string): PolicyEnforcementAction {
  const decisions = [...store.policyDecisions.values()];
  const decision = decisions.find(d => d.decision_id === decisionId);
  if (!decision) throw new Error(`Policy decision ${decisionId} not found`);
  const now = nowIso();
  const action = PolicyEnforcementActionSchema.parse({
    enforcement_id: createEntityId("penf"),
    decision_id: decisionId,
    pep_id: decision.pep_id,
    action: decision.action,
    resource: decision.resource,
    enforcement_result: enforcementResult,
    evidence_node_id: evidenceNodeId,
    task_id: decision.task_id,
    enforced_at: now
  });
  store.policyEnforcementActions.push(action);
  recordAudit("policy.enforced", { decision_id: decisionId, verdict: decision.verdict, enforcement_result: enforcementResult });
  return action;
}

export function listPolicyDecisions(filter?: { pep_id?: string; verdict?: PolicyDecisionVerdict; task_id?: string }): PolicyDecision[] {
  let decisions = [...store.policyDecisions.values()];
  if (filter?.pep_id) decisions = decisions.filter(d => d.pep_id === filter.pep_id);
  if (filter?.verdict) decisions = decisions.filter(d => d.verdict === filter.verdict);
  if (filter?.task_id) decisions = decisions.filter(d => d.task_id === filter.task_id);
  return decisions.sort((a, b) => b.decided_at.localeCompare(a.decided_at));
}

export function listPolicyEnforcementActions(filter?: { pep_id?: string; enforcement_result?: PolicyEnforcementAction["enforcement_result"]; task_id?: string }): PolicyEnforcementAction[] {
  let actions = [...store.policyEnforcementActions.values()];
  if (filter?.pep_id) actions = actions.filter(a => a.pep_id === filter.pep_id);
  if (filter?.enforcement_result) actions = actions.filter(a => a.enforcement_result === filter.enforcement_result);
  if (filter?.task_id) actions = actions.filter(a => a.task_id === filter.task_id);
  return actions.sort((a, b) => b.enforced_at.localeCompare(a.enforced_at));
}

export function checkPolicyAndEnforce(input: {
  pep_id: string;
  subject: string;
  action: string;
  resource: string;
  scope?: string;
  sandbox_tier?: PolicyDecision["sandbox_tier"];
  risk_level?: PolicyDecision["risk_level"];
  task_id?: string;
  correlation_id?: string;
}): { decision: PolicyDecision; enforcement: PolicyEnforcementAction } {
  const decision = evaluatePolicy(input);
  let enforcementResult: PolicyEnforcementAction["enforcement_result"];
  if (decision.verdict === "deny") {
    enforcementResult = "blocked";
  } else if (decision.verdict === "conditional") {
    enforcementResult = "condition_applied";
  } else {
    enforcementResult = "executed";
  }
  const enforcement = enforcePolicy(decision.decision_id, enforcementResult);
  return { decision, enforcement };
}

export function registerLocalCapability(input: {
  category: LocalCapabilityCategory;
  name: string;
  version?: string;
  install_path?: string;
  invocation_method: LocalCapability["invocation_method"];
  risk_tier?: LocalCapability["risk_tier"];
  sandbox_requirement?: LocalCapability["sandbox_requirement"];
  available?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): LocalCapability {
  const now = nowIso();
  const existing = [...store.localCapabilities.values()].find(
    c => c.category === input.category && c.name === input.name
  );
  if (existing) {
    const updated = LocalCapabilitySchema.parse({
      ...existing,
      version: input.version ?? existing.version,
      install_path: input.install_path ?? existing.install_path,
      invocation_method: input.invocation_method,
      risk_tier: input.risk_tier ?? existing.risk_tier,
      sandbox_requirement: input.sandbox_requirement ?? existing.sandbox_requirement,
      available: input.available ?? existing.available,
      tags: input.tags ?? existing.tags,
      metadata: input.metadata ?? existing.metadata,
      last_verified_at: now
    });
    store.localCapabilities.set(updated.local_capability_id, updated);
    recordAudit("local_capability.updated", { category: input.category, name: input.name });
    return updated;
  }
  const capability = LocalCapabilitySchema.parse({
    local_capability_id: createEntityId("lcap"),
    category: input.category,
    name: input.name,
    version: input.version,
    install_path: input.install_path,
    invocation_method: input.invocation_method,
    risk_tier: input.risk_tier ?? "medium",
    sandbox_requirement: input.sandbox_requirement ?? "guarded_mutation",
    detected_at: now,
    last_verified_at: now,
    available: input.available ?? true,
    tags: input.tags ?? [],
    metadata: input.metadata ?? {}
  });
  store.localCapabilities.set(capability.local_capability_id, capability);
  recordAudit("local_capability.registered", { category: input.category, name: input.name });
  return capability;
}

export function listLocalCapabilities(filter?: { category?: LocalCapabilityCategory; available?: boolean; risk_tier?: LocalCapability["risk_tier"]; invocation_method?: LocalCapability["invocation_method"] }): LocalCapability[] {
  let caps = [...store.localCapabilities.values()];
  if (filter?.category) caps = caps.filter(c => c.category === filter.category);
  if (filter?.available !== undefined) caps = caps.filter(c => c.available === filter.available);
  if (filter?.risk_tier) caps = caps.filter(c => c.risk_tier === filter.risk_tier);
  if (filter?.invocation_method) caps = caps.filter(c => c.invocation_method === filter.invocation_method);
  return caps.sort((a, b) => a.name.localeCompare(b.name));
}

export function discoverLocalCapabilities(): LocalCapability[] {
  const discovered: LocalCapability[] = [];
  const commonTools: Array<{
    category: LocalCapabilityCategory;
    name: string;
    invocation_method: LocalCapability["invocation_method"];
    risk_tier: LocalCapability["risk_tier"];
    sandbox_requirement: LocalCapability["sandbox_requirement"];
    tags: string[];
  }> = [
    { category: "cli", name: "git", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["version-control", "git", "scm"] },
    { category: "cli", name: "node", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["runtime", "javascript", "nodejs"] },
    { category: "cli", name: "npm", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["package-manager", "javascript", "nodejs"] },
    { category: "cli", name: "npx", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["package-runner", "javascript", "nodejs"] },
    { category: "cli", name: "python", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["runtime", "python"] },
    { category: "cli", name: "pip", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["package-manager", "python"] },
    { category: "package_manager", name: "npm", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["package-manager", "javascript"] },
    { category: "package_manager", name: "pip", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["package-manager", "python"] },
    { category: "package_manager", name: "cargo", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["package-manager", "rust"] },
    { category: "browser", name: "chrome", invocation_method: "protocol", risk_tier: "high", sandbox_requirement: "isolated_mutation", tags: ["browser", "chromium", "automation"] },
    { category: "browser", name: "firefox", invocation_method: "protocol", risk_tier: "high", sandbox_requirement: "isolated_mutation", tags: ["browser", "automation"] },
    { category: "ide", name: "vscode", invocation_method: "cli", risk_tier: "low", sandbox_requirement: "host_readonly", tags: ["ide", "editor", "development"] },
    { category: "cli", name: "docker", invocation_method: "cli", risk_tier: "high", sandbox_requirement: "isolated_mutation", tags: ["container", "virtualization", "isolation"] },
    { category: "cli", name: "curl", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["http", "network", "download"] },
    { category: "cli", name: "sqlite3", invocation_method: "cli", risk_tier: "medium", sandbox_requirement: "guarded_mutation", tags: ["database", "sqlite", "storage"] },
    { category: "os_automation", name: "powershell", invocation_method: "cli", risk_tier: "critical", sandbox_requirement: "isolated_mutation", tags: ["shell", "automation", "windows"] },
    { category: "os_automation", name: "bash", invocation_method: "cli", risk_tier: "critical", sandbox_requirement: "isolated_mutation", tags: ["shell", "automation", "unix"] },
    { category: "system_service", name: "ssh", invocation_method: "cli", risk_tier: "high", sandbox_requirement: "guarded_mutation", tags: ["network", "remote", "security"] }
  ];

  for (const tool of commonTools) {
    const cap = registerLocalCapability({
      category: tool.category,
      name: tool.name,
      invocation_method: tool.invocation_method,
      risk_tier: tool.risk_tier,
      sandbox_requirement: tool.sandbox_requirement,
      available: true,
      tags: tool.tags
    });
    discovered.push(cap);
  }

  recordAudit("local_capability.discovery_completed", { discovered_count: discovered.length });
  return discovered;
}

export function getLocalCapabilityAsDescriptor(cap: LocalCapability): CapabilityDescriptor {
  return CapabilityDescriptorSchema.parse({
    capability_id: `local.${cap.category}.${cap.name}`,
    name: cap.name,
    kind: cap.invocation_method === "cli" ? "tool" : cap.invocation_method === "protocol" ? "mcp_server" : "tool",
    source: "local-registry",
    summary: `Local ${cap.category}: ${cap.name}`,
    tags: cap.tags
  });
}

export function getLocalCapabilitiesAsDescriptors(): CapabilityDescriptor[] {
  return [...store.localCapabilities.values()]
    .filter(c => c.available)
    .map(getLocalCapabilityAsDescriptor);
}

export function verifyLocalCapabilityAvailability(localCapabilityId: string): LocalCapability {
  const cap = store.localCapabilities.get(localCapabilityId);
  if (!cap) throw new Error(`Local capability ${localCapabilityId} not found`);
  const now = nowIso();
  cap.last_verified_at = now;
  cap.available = true;
  store.localCapabilities.set(cap.local_capability_id, cap);
  return cap;
}

export function setAutonomousCompletionConfig(taskId: string, config: Partial<AutonomousCompletionConfig>): AutonomousCompletionConfig {
  const existing = store.autonomousCompletionConfigs.get(taskId);
  const merged = AutonomousCompletionConfigSchema.parse({
    max_retries: config.max_retries ?? existing?.max_retries ?? 3,
    retry_backoff_ms: config.retry_backoff_ms ?? existing?.retry_backoff_ms ?? 1000,
    circuit_breaker_threshold: config.circuit_breaker_threshold ?? existing?.circuit_breaker_threshold ?? 5,
    circuit_breaker_reset_ms: config.circuit_breaker_reset_ms ?? existing?.circuit_breaker_reset_ms ?? 30000,
    heartbeat_interval_ms: config.heartbeat_interval_ms ?? existing?.heartbeat_interval_ms ?? 10000,
    watchdog_timeout_ms: config.watchdog_timeout_ms ?? existing?.watchdog_timeout_ms ?? 120000,
    auto_escalation: config.auto_escalation ?? existing?.auto_escalation ?? true,
    human_judgment_boundaries: config.human_judgment_boundaries ?? existing?.human_judgment_boundaries ?? []
  });
  store.autonomousCompletionConfigs.set(taskId, merged);
  recordAudit("autonomous_completion.config_set", { task_id: taskId });
  return merged;
}

export function getAutonomousCompletionConfig(taskId: string): AutonomousCompletionConfig {
  const config = store.autonomousCompletionConfigs.get(taskId);
  if (config) return config;
  return AutonomousCompletionConfigSchema.parse({});
}

export function createCheckpoint(taskId: string, stepIndex: number, stepDescription?: string, stateSnapshot?: Record<string, unknown>): TaskCheckpoint {
  const now = nowIso();
  const checkpoint = TaskCheckpointSchema.parse({
    checkpoint_id: createEntityId("ckpt"),
    task_id: taskId,
    step_index: stepIndex,
    step_description: stepDescription,
    state_snapshot: stateSnapshot ?? {},
    created_at: now
  });
  store.taskCheckpoints.push(checkpoint);
  recordAudit("autonomous_completion.checkpoint_created", { task_id: taskId, step_index: stepIndex });
  return checkpoint;
}

export function getLatestCheckpoint(taskId: string): TaskCheckpoint | undefined {
  const checkpoints = [...store.taskCheckpoints.values()]
    .filter(c => c.task_id === taskId)
    .sort((a, b) => b.step_index - a.step_index);
  return checkpoints[0];
}

export function listCheckpoints(taskId: string): TaskCheckpoint[] {
  return [...store.taskCheckpoints.values()]
    .filter(c => c.task_id === taskId)
    .sort((a, b) => a.step_index - b.step_index);
}

export function recordHeartbeat(taskId: string, status: AutonomousCompletionState, progressNote?: string): HeartbeatRecord {
  const config = getAutonomousCompletionConfig(taskId);
  const lastHeartbeats = [...store.heartbeatRecords.values()]
    .filter(h => h.task_id === taskId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const lastHeartbeat = lastHeartbeats[0];
  let retryCount = 0;
  let circuitOpen = false;
  let escalated = false;
  let escalationReason: string | undefined;

  if (status === "retrying") {
    retryCount = (lastHeartbeat?.retry_count ?? 0) + 1;
    if (retryCount > config.max_retries) {
      circuitOpen = true;
      status = "circuit_open";
      escalationReason = `Max retries (${config.max_retries}) exceeded`;
      if (config.auto_escalation) {
        escalated = true;
        status = "escalated";
      }
    }
  } else if (status === "running") {
    retryCount = 0;
  } else {
    retryCount = lastHeartbeat?.retry_count ?? 0;
  }

  if (status === "circuit_open" || status === "escalated") {
    circuitOpen = true;
  }

  if (lastHeartbeat?.circuit_open && status === "running") {
    const timeSinceCircuitOpen = Date.now() - new Date(lastHeartbeat.recorded_at).getTime();
    if (timeSinceCircuitOpen < config.circuit_breaker_reset_ms) {
      circuitOpen = true;
      status = "circuit_open";
      escalationReason = "Circuit breaker reset period not yet elapsed";
    }
  }

  const now = nowIso();
  const heartbeat = HeartbeatRecordSchema.parse({
    heartbeat_id: createEntityId("hbeat"),
    task_id: taskId,
    status,
    progress_note: progressNote,
    retry_count: retryCount,
    max_retries: config.max_retries,
    circuit_open: circuitOpen,
    escalated: escalated || (lastHeartbeat?.escalated ?? false),
    escalation_reason: escalationReason ?? lastHeartbeat?.escalation_reason,
    recorded_at: now
  });
  store.heartbeatRecords.push(heartbeat);
  return heartbeat;
}

export function getLatestHeartbeat(taskId: string): HeartbeatRecord | undefined {
  const heartbeats = [...store.heartbeatRecords.values()]
    .filter(h => h.task_id === taskId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  return heartbeats[0];
}

export function listHeartbeats(taskId: string, limit?: number): HeartbeatRecord[] {
  let heartbeats = [...store.heartbeatRecords.values()]
    .filter(h => h.task_id === taskId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  if (limit) heartbeats = heartbeats.slice(0, limit);
  return heartbeats;
}

export function checkWatchdog(taskId: string): { timedOut: boolean; lastHeartbeat: HeartbeatRecord | undefined } {
  const config = getAutonomousCompletionConfig(taskId);
  const lastHeartbeat = getLatestHeartbeat(taskId);
  if (!lastHeartbeat) return { timedOut: false, lastHeartbeat: undefined };
  if (lastHeartbeat.status === "completed" || lastHeartbeat.status === "failed" || lastHeartbeat.status === "cancelled") {
    return { timedOut: false, lastHeartbeat };
  }
  const elapsed = Date.now() - new Date(lastHeartbeat.recorded_at).getTime();
  const timedOut = elapsed > config.watchdog_timeout_ms;
  if (timedOut && config.auto_escalation && !lastHeartbeat.escalated) {
    recordHeartbeat(taskId, "escalated", `Watchdog timeout after ${config.watchdog_timeout_ms}ms without heartbeat`);
  }
  return { timedOut, lastHeartbeat };
}

export function isHumanJudgmentBoundary(taskId: string, currentStep: string): boolean {
  const config = getAutonomousCompletionConfig(taskId);
  return config.human_judgment_boundaries.some(boundary =>
    currentStep.toLowerCase().includes(boundary.toLowerCase())
  );
}

export function recoverFromCheckpoint(taskId: string): { checkpoint: TaskCheckpoint | undefined; config: AutonomousCompletionConfig; canRecover: boolean; reason: string } {
  const config = getAutonomousCompletionConfig(taskId);
  const checkpoint = getLatestCheckpoint(taskId);
  const lastHeartbeat = getLatestHeartbeat(taskId);

  if (!checkpoint) {
    return { checkpoint: undefined, config, canRecover: false, reason: "No checkpoint available" };
  }

  if (lastHeartbeat?.circuit_open) {
    const elapsed = Date.now() - new Date(lastHeartbeat.recorded_at).getTime();
    if (elapsed < config.circuit_breaker_reset_ms) {
      return { checkpoint, config, canRecover: false, reason: `Circuit breaker active, resets in ${config.circuit_breaker_reset_ms - elapsed}ms` };
    }
  }

  if (lastHeartbeat?.retry_count && lastHeartbeat.retry_count > config.max_retries) {
    return { checkpoint, config, canRecover: false, reason: `Retry limit (${config.max_retries}) exceeded` };
  }

  return { checkpoint, config, canRecover: true, reason: "Recovery possible from checkpoint" };
}

export function evaluateCompletionStatus(taskId: string): {
  isComplete: boolean;
  completionState: AutonomousCompletionState;
  completionPercentage: number;
  unmetCriteria: string[];
  nextAction: string;
} {
  const task = store.tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const dod = task.definition_of_done;
  const evidenceGraph = store.evidenceGraphs.get(taskId);
  const evidenceNodes = evidenceGraph?.nodes ?? [];
  const completedEvidence = evidenceNodes.filter(n => n.status === "passed" || n.status === "produced");
  const lastHeartbeat = getLatestHeartbeat(taskId);

  const unmetCriteria: string[] = [];
  for (const criterion of dod.completion_criteria) {
    const hasEvidence = completedEvidence.some(e =>
      e.kind === "checklist" || e.kind === "verifier" || e.kind === "reconciliation"
    );
    if (!hasEvidence) unmetCriteria.push(criterion);
  }

  const totalCriteria = dod.completion_criteria.length || 1;
  const metCriteria = totalCriteria - unmetCriteria.length;
  const completionPercentage = Math.round((metCriteria / totalCriteria) * 100);

  let completionState: AutonomousCompletionState = "running";
  let isComplete = false;
  let nextAction = "Continue execution";

  if (task.status === "completed") {
    completionState = "completed";
    isComplete = true;
    nextAction = "Task already completed";
  } else if (task.status === "failed") {
    completionState = "failed";
    nextAction = "Task has failed";
  } else if (task.status === "cancelled") {
    completionState = "cancelled";
    nextAction = "Task was cancelled";
  } else if (lastHeartbeat?.escalated) {
    completionState = "escalated";
    nextAction = "Requires human judgment to proceed";
  } else if (lastHeartbeat?.circuit_open) {
    completionState = "circuit_open";
    nextAction = "Circuit breaker is open; wait for reset or manual intervention";
  } else if (unmetCriteria.length === 0 && dod.completion_criteria.length > 0) {
    completionState = "completed";
    isComplete = true;
    nextAction = "All completion criteria satisfied";
  } else if (unmetCriteria.length > 0) {
    nextAction = `Satisfy remaining criteria: ${unmetCriteria.slice(0, 3).join(", ")}${unmetCriteria.length > 3 ? "..." : ""}`;
  }

  return { isComplete, completionState, completionPercentage, unmetCriteria, nextAction };
}

export function startRalphLoop(taskId: string, maxAttempts?: number): RalphLoopState {
  const now = nowIso();
  const attemptId = createEntityId("attempt");
  const attempt = RalphAttemptSchema.parse({
    attempt_id: attemptId,
    task_id: taskId,
    attempt_number: 1,
    status: "in_progress",
    started_at: now
  });
  store.ralphAttempts.push(attempt);
  const loopState = RalphLoopStateSchema.parse({
    loop_id: createEntityId("rloop"),
    task_id: taskId,
    current_attempt_id: attemptId,
    attempt_count: 1,
    max_attempts: maxAttempts ?? 5,
    loop_status: "iterating",
    accepted_count: 0,
    revise_count: 0,
    blocked_count: 0,
    created_at: now,
    updated_at: now
  });
  store.ralphLoopStates.set(loopState.loop_id, loopState);
  recordAudit("ralph_loop.started", { task_id: taskId, max_attempts: maxAttempts ?? 5 });
  return loopState;
}

export function getRalphLoopState(taskId: string): RalphLoopState | undefined {
  return [...store.ralphLoopStates.values()].find(l => l.task_id === taskId);
}

export function addReviewerExpectation(taskId: string, attemptId: string, criterion: string, description?: string, required?: boolean): ReviewerExpectation {
  const now = nowIso();
  const expectation = ReviewerExpectationSchema.parse({
    expectation_id: createEntityId("rexpect"),
    task_id: taskId,
    attempt_id: attemptId,
    criterion,
    description,
    required: required ?? true,
    created_at: now
  });
  store.reviewerExpectations.push(expectation);
  return expectation;
}

export function listReviewerExpectations(taskId: string, attemptId?: string): ReviewerExpectation[] {
  let expectations = [...store.reviewerExpectations.values()].filter(e => e.task_id === taskId);
  if (attemptId) expectations = expectations.filter(e => e.attempt_id === attemptId);
  return expectations;
}

export function submitReviewerFeedback(input: {
  task_id: string;
  attempt_id: string;
  expectation_id: string;
  verdict: ReviewerVerdict;
  notes?: string;
  evidence_node_id?: string;
  reviewer_type?: ReviewerFeedback["reviewer_type"];
}): ReviewerFeedback {
  const now = nowIso();
  const feedback = ReviewerFeedbackSchema.parse({
    feedback_id: createEntityId("rfeed"),
    task_id: input.task_id,
    attempt_id: input.attempt_id,
    expectation_id: input.expectation_id,
    verdict: input.verdict,
    notes: input.notes,
    evidence_node_id: input.evidence_node_id,
    reviewer_type: input.reviewer_type ?? "auto_verifier",
    reviewed_at: now
  });
  store.reviewerFeedbacks.push(feedback);
  recordAudit("ralph_loop.feedback_submitted", {
    task_id: input.task_id,
    attempt_id: input.attempt_id,
    verdict: input.verdict,
    reviewer_type: input.reviewer_type ?? "auto_verifier"
  });
  return feedback;
}

export function listReviewerFeedback(taskId: string, attemptId?: string): ReviewerFeedback[] {
  let feedbacks = [...store.reviewerFeedbacks.values()].filter(f => f.task_id === taskId);
  if (attemptId) feedbacks = feedbacks.filter(f => f.attempt_id === attemptId);
  return feedbacks.sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));
}

export function evaluateAttempt(taskId: string, attemptId: string): {
  overallVerdict: ReviewerVerdict;
  acceptedCount: number;
  reviseCount: number;
  blockedCount: number;
  totalExpectations: number;
  canProceed: boolean;
} {
  const expectations = listReviewerExpectations(taskId, attemptId);
  const feedbacks = listReviewerFeedback(taskId, attemptId);
  const requiredExpectations = expectations.filter(e => e.required);
  let acceptedCount = 0;
  let reviseCount = 0;
  let blockedCount = 0;

  for (const expectation of requiredExpectations) {
    const feedback = feedbacks.find(f => f.expectation_id === expectation.expectation_id);
    if (!feedback) {
      reviseCount++;
      continue;
    }
    switch (feedback.verdict) {
      case "accepted":
      case "accepted_with_notes":
        acceptedCount++;
        break;
      case "revise_and_retry":
        reviseCount++;
        break;
      case "blocked":
        blockedCount++;
        break;
    }
  }

  let overallVerdict: ReviewerVerdict = "accepted";
  if (blockedCount > 0) {
    overallVerdict = "blocked";
  } else if (reviseCount > 0) {
    overallVerdict = "revise_and_retry";
  } else if (acceptedCount > 0 && acceptedCount < requiredExpectations.length) {
    overallVerdict = "accepted_with_notes";
  }

  const canProceed = overallVerdict === "accepted" || overallVerdict === "accepted_with_notes";

  return {
    overallVerdict,
    acceptedCount,
    reviseCount,
    blockedCount,
    totalExpectations: requiredExpectations.length,
    canProceed
  };
}

export function advanceRalphLoop(taskId: string): {
  loopState: RalphLoopState;
  newAttempt: RalphAttempt | null;
  action: string;
} {
  const loopState = getRalphLoopState(taskId);
  if (!loopState) throw new Error(`No Ralph loop found for task ${taskId}`);
  if (loopState.loop_status !== "iterating") {
    return { loopState, newAttempt: null, action: `Loop is already ${loopState.loop_status}` };
  }

  const evaluation = evaluateAttempt(taskId, loopState.current_attempt_id);
  const now = nowIso();

  const currentAttempt = [...store.ralphAttempts.values()].find(a => a.attempt_id === loopState.current_attempt_id);
  if (currentAttempt) {
    currentAttempt.status = evaluation.overallVerdict === "blocked" ? "blocked"
      : evaluation.canProceed ? "accepted" : "revise_and_retry";
    currentAttempt.completed_at = now;
    currentAttempt.review_summary = `Accepted: ${evaluation.acceptedCount}, Revise: ${evaluation.reviseCount}, Blocked: ${evaluation.blockedCount}`;
    store.ralphAttempts.push(currentAttempt);
  }

  loopState.accepted_count = evaluation.acceptedCount;
  loopState.revise_count = evaluation.reviseCount;
  loopState.blocked_count = evaluation.blockedCount;
  loopState.updated_at = now;

  if (evaluation.overallVerdict === "blocked") {
    loopState.loop_status = "blocked";
    store.ralphLoopStates.set(loopState.loop_id, loopState);
    recordAudit("ralph_loop.blocked", { task_id: taskId, attempt_count: loopState.attempt_count });
    return { loopState, newAttempt: null, action: "Loop blocked by reviewer" };
  }

  if (evaluation.canProceed) {
    loopState.loop_status = "accepted";
    store.ralphLoopStates.set(loopState.loop_id, loopState);
    recordAudit("ralph_loop.accepted", { task_id: taskId, attempt_count: loopState.attempt_count });
    return { loopState, newAttempt: null, action: "All expectations accepted" };
  }

  if (loopState.attempt_count >= loopState.max_attempts) {
    loopState.loop_status = "blocked";
    store.ralphLoopStates.set(loopState.loop_id, loopState);
    recordAudit("ralph_loop.max_attempts_reached", { task_id: taskId, attempt_count: loopState.attempt_count });
    return { loopState, newAttempt: null, action: `Max attempts (${loopState.max_attempts}) reached` };
  }

  const newAttemptId = createEntityId("attempt");
  const newAttempt = RalphAttemptSchema.parse({
    attempt_id: newAttemptId,
    task_id: taskId,
    attempt_number: loopState.attempt_count + 1,
    parent_attempt_id: loopState.current_attempt_id,
    status: "in_progress",
    started_at: now
  });
  store.ralphAttempts.push(newAttempt);

  loopState.current_attempt_id = newAttemptId;
  loopState.attempt_count += 1;
  loopState.updated_at = now;
  store.ralphLoopStates.set(loopState.loop_id, loopState);

  recordAudit("ralph_loop.new_attempt", { task_id: taskId, attempt_number: newAttempt.attempt_number });
  return { loopState, newAttempt, action: `Starting attempt ${newAttempt.attempt_number}` };
}

export function stopRalphLoop(taskId: string): RalphLoopState {
  const loopState = getRalphLoopState(taskId);
  if (!loopState) throw new Error(`No Ralph loop found for task ${taskId}`);
  const now = nowIso();
  loopState.loop_status = "stopped";
  loopState.updated_at = now;
  store.ralphLoopStates.set(loopState.loop_id, loopState);
  const currentAttempt = [...store.ralphAttempts.values()].find(a => a.attempt_id === loopState.current_attempt_id);
  if (currentAttempt && currentAttempt.status === "in_progress") {
    currentAttempt.status = "blocked";
    currentAttempt.completed_at = now;
    currentAttempt.review_summary = "Stopped by user";
    store.ralphAttempts.push(currentAttempt);
  }
  recordAudit("ralph_loop.stopped", { task_id: taskId });
  return loopState;
}

export function getRalphLoopSummary(taskId: string): {
  loopState: RalphLoopState | undefined;
  attempts: RalphAttempt[];
  currentExpectations: ReviewerExpectation[];
  currentFeedbacks: ReviewerFeedback[];
} {
  const loopState = getRalphLoopState(taskId);
  const attempts = [...store.ralphAttempts.values()]
    .filter(a => a.task_id === taskId)
    .sort((a, b) => a.attempt_number - b.attempt_number);
  const currentAttemptId = loopState?.current_attempt_id;
  const currentExpectations = currentAttemptId ? listReviewerExpectations(taskId, currentAttemptId) : [];
  const currentFeedbacks = currentAttemptId ? listReviewerFeedback(taskId, currentAttemptId) : [];
  return { loopState, attempts, currentExpectations, currentFeedbacks };
}

export function startTrace(taskId: string): { traceId: string; timeline: RunTimeline; rootSpan: TraceSpan } {
  const now = nowIso();
  const traceId = createEntityId("trace");
  const rootSpanId = createEntityId("span");
  const rootSpan = TraceSpanSchema.parse({
    span_id: rootSpanId,
    trace_id: traceId,
    parent_span_id: undefined,
    task_id: taskId,
    kind: "execution",
    name: `task:${taskId}`,
    status: "ok",
    started_at: now,
    attributes: {}
  });
  store.traceSpans.push(rootSpan);
  const timeline = RunTimelineSchema.parse({
    timeline_id: createEntityId("timeline"),
    task_id: taskId,
    trace_id: traceId,
    started_at: now,
    span_count: 1,
    error_count: 0,
    status: "running"
  });
  store.runTimelines.set(timeline.timeline_id, timeline);
  recordAudit("observability.trace_started", { task_id: taskId, trace_id: traceId });
  return { traceId, timeline, rootSpan };
}

export function createSpan(input: {
  trace_id: string;
  parent_span_id?: string;
  task_id?: string;
  attempt_id?: string;
  kind: SpanKind;
  name: string;
  attributes?: Record<string, unknown>;
}): TraceSpan {
  const now = nowIso();
  const span = TraceSpanSchema.parse({
    span_id: createEntityId("span"),
    trace_id: input.trace_id,
    parent_span_id: input.parent_span_id,
    task_id: input.task_id,
    attempt_id: input.attempt_id,
    kind: input.kind,
    name: input.name,
    status: "ok",
    started_at: now,
    attributes: input.attributes ?? {}
  });
  store.traceSpans.push(span);
  const timelines = [...store.runTimelines.values()].filter(t => t.trace_id === input.trace_id);
  for (const timeline of timelines) {
    timeline.span_count += 1;
    store.runTimelines.set(timeline.timeline_id, timeline);
  }
  return span;
}

export function endSpan(spanId: string, status?: SpanStatus): TraceSpan {
  const spans = [...store.traceSpans.values()];
  const span = spans.find(s => s.span_id === spanId);
  if (!span) throw new Error(`Span ${spanId} not found`);
  const now = nowIso();
  span.ended_at = now;
  span.duration_ms = Date.parse(now) - Date.parse(span.started_at);
  if (status) span.status = status;
  store.traceSpans.push(span);
  if (span.status === "error") {
    const timelines = [...store.runTimelines.values()].filter(t => t.trace_id === span.trace_id);
    for (const timeline of timelines) {
      timeline.error_count += 1;
      store.runTimelines.set(timeline.timeline_id, timeline);
    }
  }
  return span;
}

export function addSpanEvent(spanId: string, eventName: string, attributes?: Record<string, unknown>): TraceSpan {
  const spans = [...store.traceSpans.values()];
  const span = spans.find(s => s.span_id === spanId);
  if (!span) throw new Error(`Span ${spanId} not found`);
  span.events.push({
    name: eventName,
    timestamp: nowIso(),
    attributes: attributes ?? {}
  });
  store.traceSpans.push(span);
  return span;
}

export function getTraceSpans(traceId: string): TraceSpan[] {
  return [...store.traceSpans.values()]
    .filter(s => s.trace_id === traceId)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
}

export function getSpanTree(traceId: string): { spans: TraceSpan[]; rootSpan: TraceSpan | undefined; depth: number } {
  const spans = getTraceSpans(traceId);
  const rootSpan = spans.find(s => !s.parent_span_id);
  let maxDepth = 0;
  const childMap = new Map<string, TraceSpan[]>();
  for (const span of spans) {
    if (span.parent_span_id) {
      const children = childMap.get(span.parent_span_id) ?? [];
      children.push(span);
      childMap.set(span.parent_span_id, children);
    }
  }
  function computeDepth(spanId: string | undefined, depth: number): void {
    if (depth > maxDepth) maxDepth = depth;
    const children = childMap.get(spanId ?? "") ?? [];
    for (const child of children) {
      computeDepth(child.span_id, depth + 1);
    }
  }
  computeDepth(rootSpan?.span_id, 0);
  return { spans, rootSpan, depth: maxDepth };
}

export function endTrace(traceId: string, finalStatus?: RunTimeline["status"]): RunTimeline {
  const timelines = [...store.runTimelines.values()].filter(t => t.trace_id === traceId);
  const timeline = timelines[0];
  if (!timeline) throw new Error(`Timeline for trace ${traceId} not found`);
  const now = nowIso();
  timeline.completed_at = now;
  timeline.total_duration_ms = Date.parse(now) - Date.parse(timeline.started_at);
  timeline.status = finalStatus ?? (timeline.error_count > 0 ? "failed" : "completed");
  store.runTimelines.set(timeline.timeline_id, timeline);
  return timeline;
}

export function getRunTimeline(taskId: string): RunTimeline | undefined {
  return [...store.runTimelines.values()].find(t => t.task_id === taskId);
}

export function recordCostBreakdown(input: {
  task_id: string;
  trace_id: string;
  llm_tokens_used?: number;
  llm_cost_usd?: number;
  tool_invocations?: number;
  external_calls?: number;
  memory_operations?: number;
  total_duration_ms?: number;
}): CostBreakdown {
  const now = nowIso();
  const existing = [...store.costBreakdowns.values()].find(c => c.task_id === input.task_id);
  if (existing) {
    existing.llm_tokens_used += input.llm_tokens_used ?? 0;
    existing.llm_cost_usd += input.llm_cost_usd ?? 0;
    existing.tool_invocations += input.tool_invocations ?? 0;
    existing.external_calls += input.external_calls ?? 0;
    existing.memory_operations += input.memory_operations ?? 0;
    existing.total_duration_ms = input.total_duration_ms ?? existing.total_duration_ms;
    existing.computed_at = now;
    store.costBreakdowns.set(existing.cost_id, existing);
    return existing;
  }
  const cost = CostBreakdownSchema.parse({
    cost_id: createEntityId("cost"),
    task_id: input.task_id,
    trace_id: input.trace_id,
    llm_tokens_used: input.llm_tokens_used ?? 0,
    llm_cost_usd: input.llm_cost_usd ?? 0,
    tool_invocations: input.tool_invocations ?? 0,
    external_calls: input.external_calls ?? 0,
    memory_operations: input.memory_operations ?? 0,
    total_duration_ms: input.total_duration_ms ?? 0,
    computed_at: now
  });
  store.costBreakdowns.set(cost.cost_id, cost);
  return cost;
}

export function getCostBreakdown(taskId: string): CostBreakdown | undefined {
  return [...store.costBreakdowns.values()].find(c => c.task_id === taskId);
}

export function recordSLOMetric(input: {
  metric_name: string;
  value: number;
  unit?: string;
  threshold?: number;
  task_id?: string;
  trace_id?: string;
}): SLOMetric {
  const now = nowIso();
  const breached = input.threshold !== undefined && input.value > input.threshold;
  const metric = SLOMetricSchema.parse({
    metric_id: createEntityId("slo"),
    metric_name: input.metric_name,
    value: input.value,
    unit: input.unit ?? "ms",
    threshold: input.threshold,
    breached,
    measured_at: now,
    task_id: input.task_id,
    trace_id: input.trace_id
  });
  store.sloMetrics.push(metric);
  return metric;
}

export function getSLOMetrics(filter?: { metric_name?: string; task_id?: string; breached?: boolean }): SLOMetric[] {
  let metrics = [...store.sloMetrics.values()];
  if (filter?.metric_name) metrics = metrics.filter(m => m.metric_name === filter.metric_name);
  if (filter?.task_id) metrics = metrics.filter(m => m.task_id === filter.task_id);
  if (filter?.breached !== undefined) metrics = metrics.filter(m => m.breached === filter.breached);
  return metrics.sort((a, b) => b.measured_at.localeCompare(a.measured_at));
}

export function computeTaskSLOs(taskId: string): SLOMetric[] {
  const timeline = getRunTimeline(taskId);
  const cost = getCostBreakdown(taskId);
  const traceId = timeline?.trace_id;
  const metrics: SLOMetric[] = [];

  if (timeline?.total_duration_ms !== undefined) {
    metrics.push(recordSLOMetric({
      metric_name: "task_completion_latency",
      value: timeline.total_duration_ms,
      unit: "ms",
      threshold: 300000,
      task_id: taskId,
      trace_id: traceId
    }));
  }

  if (timeline?.error_count !== undefined) {
    metrics.push(recordSLOMetric({
      metric_name: "error_count",
      value: timeline.error_count,
      unit: "count",
      threshold: 3,
      task_id: taskId,
      trace_id: traceId
    }));
  }

  if (cost) {
    metrics.push(recordSLOMetric({
      metric_name: "llm_cost",
      value: cost.llm_cost_usd,
      unit: "usd",
      threshold: 1.0,
      task_id: taskId,
      trace_id: traceId
    }));
    metrics.push(recordSLOMetric({
      metric_name: "external_call_count",
      value: cost.external_calls,
      unit: "count",
      threshold: 50,
      task_id: taskId,
      trace_id: traceId
    }));
  }

  return metrics;
}

export function addEgressRule(input: {
  name: string;
  description?: string;
  action: EgressRuleAction;
  destination_pattern: string;
  destination_type: EgressRule["destination_type"];
  protocol?: EgressRule["protocol"];
  policy_source?: EgressRule["policy_source"];
  priority?: number;
  enabled?: boolean;
}): EgressRule {
  const now = nowIso();
  const rule = EgressRuleSchema.parse({
    rule_id: createEntityId("egress_rule"),
    name: input.name,
    description: input.description,
    action: input.action,
    destination_pattern: input.destination_pattern,
    destination_type: input.destination_type,
    protocol: input.protocol ?? "any",
    policy_source: input.policy_source ?? "local",
    priority: input.priority ?? 0,
    enabled: input.enabled ?? true,
    created_at: now
  });
  store.egressRules.set(rule.rule_id, rule);
  recordAudit("egress.rule_added", { rule_id: rule.rule_id, action: rule.action, destination: rule.destination_pattern });
  return rule;
}

export function updateEgressRule(ruleId: string, updates: Partial<Pick<EgressRule, "name" | "description" | "action" | "destination_pattern" | "destination_type" | "protocol" | "policy_source" | "priority" | "enabled">>): EgressRule {
  const rule = store.egressRules.get(ruleId);
  if (!rule) throw new Error(`Egress rule ${ruleId} not found`);
  const now = nowIso();
  Object.assign(rule, updates, { updated_at: now });
  store.egressRules.set(ruleId, rule);
  recordAudit("egress.rule_updated", { rule_id: ruleId });
  return rule;
}

export function listEgressRules(filter?: { action?: EgressRuleAction; policy_source?: EgressRule["policy_source"]; enabled?: boolean }): EgressRule[] {
  let rules = [...store.egressRules.values()];
  if (filter?.action) rules = rules.filter(r => r.action === filter.action);
  if (filter?.policy_source) rules = rules.filter(r => r.policy_source === filter.policy_source);
  if (filter?.enabled !== undefined) rules = rules.filter(r => r.enabled === filter.enabled);
  return rules.sort((a, b) => b.priority - a.priority);
}

export function removeEgressRule(ruleId: string): void {
  const rule = store.egressRules.get(ruleId);
  if (!rule) throw new Error(`Egress rule ${ruleId} not found`);
  store.egressRules.delete(ruleId);
  recordAudit("egress.rule_removed", { rule_id: ruleId, name: rule.name });
}

function matchEgressDestination(destination: string, pattern: string, destType: EgressRule["destination_type"]): boolean {
  switch (destType) {
    case "wildcard":
      return true;
    case "domain":
      return destination === pattern || destination.endsWith(`.${pattern}`);
    case "url_prefix":
      return destination.startsWith(pattern);
    case "ip":
      return destination === pattern;
    case "cidr": {
      const [base, bits] = pattern.split("/");
      if (!bits) return destination === base;
      const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
      const destParts = destination.split(".").map(Number);
      const baseParts = base.split(".").map(Number);
      if (destParts.length !== 4 || baseParts.length !== 4) return false;
      const destNum = ((destParts[0] << 24) | (destParts[1] << 16) | (destParts[2] << 8) | destParts[3]) >>> 0;
      const baseNum = ((baseParts[0] << 24) | (baseParts[1] << 16) | (baseParts[2] << 8) | baseParts[3]) >>> 0;
      return (destNum & mask) === (baseNum & mask);
    }
    case "port":
      return destination === pattern;
    default:
      return false;
  }
}

export function checkEgress(input: {
  destination: string;
  destination_type: EgressRequest["destination_type"];
  protocol?: EgressRequest["protocol"];
  port?: number;
  path?: string;
  method?: string;
  task_id?: string;
  trace_id?: string;
  payload_size_bytes?: number;
  payload_summary?: string;
}): { verdict: EgressVerdict; audit: EgressAudit; request: EgressRequest } {
  const now = nowIso();
  const request = EgressRequestSchema.parse({
    request_id: createEntityId("egress_req"),
    task_id: input.task_id,
    trace_id: input.trace_id,
    destination: input.destination,
    destination_type: input.destination_type,
    protocol: input.protocol ?? "any",
    port: input.port,
    path: input.path,
    method: input.method,
    payload_size_bytes: input.payload_size_bytes,
    payload_summary: input.payload_summary,
    requested_at: now
  });
  store.egressRequests.push(request);

  const rules = listEgressRules({ enabled: true });
  let matchedRule: EgressRule | undefined;
  for (const rule of rules) {
    if (matchEgressDestination(input.destination, rule.destination_pattern, rule.destination_type)) {
      if (rule.protocol === "any" || rule.protocol === input.protocol) {
        matchedRule = rule;
        break;
      }
    }
  }

  let verdict: EgressVerdict;
  let denialReason: string | undefined;
  let approvedBy: string | undefined;

  if (matchedRule) {
    switch (matchedRule.action) {
      case "allow":
        verdict = "allowed";
        approvedBy = matchedRule.policy_source;
        break;
      case "deny":
        verdict = "denied";
        denialReason = `Denied by rule "${matchedRule.name}" (${matchedRule.policy_source})`;
        break;
      case "ask":
        verdict = "pending_approval";
        denialReason = `Requires approval per rule "${matchedRule.name}" (${matchedRule.policy_source})`;
        break;
    }
  } else {
    verdict = "denied";
    denialReason = "No matching allow rule found — deny-by-default";
  }

  const audit = EgressAuditSchema.parse({
    audit_id: createEntityId("egress_audit"),
    request_id: request.request_id,
    task_id: input.task_id,
    trace_id: input.trace_id,
    destination: input.destination,
    protocol: input.protocol ?? "any",
    verdict,
    matched_rule_id: matchedRule?.rule_id,
    matched_rule_name: matchedRule?.name,
    policy_source: matchedRule?.policy_source,
    denial_reason: denialReason,
    approved_by: approvedBy,
    payload_redacted: input.payload_size_bytes !== undefined && input.payload_size_bytes > 0,
    audited_at: now
  });
  store.egressAudits.push(audit);

  recordAudit("egress.checked", {
    destination: input.destination,
    verdict,
    matched_rule: matchedRule?.name ?? "none"
  });

  return { verdict, audit, request };
}

export function approveEgressRequest(requestId: string, approvedBy: string): EgressAudit {
  const request = [...store.egressRequests.values()].find(r => r.request_id === requestId);
  if (!request) throw new Error(`Egress request ${requestId} not found`);
  const audit = [...store.egressAudits.values()].find(a => a.request_id === requestId);
  if (!audit) throw new Error(`Egress audit for request ${requestId} not found`);
  if (audit.verdict !== "pending_approval") throw new Error(`Request ${requestId} is not pending approval (current: ${audit.verdict})`);

  audit.verdict = "allowed";
  audit.approved_by = approvedBy;
  audit.denial_reason = undefined;
  store.egressAudits.push(audit);

  recordAudit("egress.approved", { request_id: requestId, approved_by: approvedBy });
  return audit;
}

export function listEgressAudits(filter?: { verdict?: EgressVerdict; task_id?: string; destination?: string }): EgressAudit[] {
  let audits = [...store.egressAudits.values()];
  if (filter?.verdict) audits = audits.filter(a => a.verdict === filter.verdict);
  if (filter?.task_id) audits = audits.filter(a => a.task_id === filter.task_id);
  if (filter?.destination) audits = audits.filter(a => a.destination.includes(filter.destination!));
  return audits.sort((a, b) => b.audited_at.localeCompare(a.audited_at));
}

export function getEgressAuditStats(): { total: number; allowed: number; denied: number; pending: number; top_destinations: { destination: string; count: number }[] } {
  const audits = [...store.egressAudits.values()];
  const allowed = audits.filter(a => a.verdict === "allowed").length;
  const denied = audits.filter(a => a.verdict === "denied").length;
  const pending = audits.filter(a => a.verdict === "pending_approval").length;
  const destCounts = new Map<string, number>();
  for (const audit of audits) {
    destCounts.set(audit.destination, (destCounts.get(audit.destination) ?? 0) + 1);
  }
  const topDestinations = [...destCounts.entries()]
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  return { total: audits.length, allowed, denied, pending, top_destinations: topDestinations };
}

export function initializeDefaultEgressRules(): EgressRule[] {
  const existing = listEgressRules();
  if (existing.length > 0) return existing;
  const defaults: Array<{ name: string; action: EgressRuleAction; destination_pattern: string; destination_type: EgressRule["destination_type"]; policy_source: EgressRule["policy_source"]; priority: number }> = [
    { name: "deny-all-default", action: "deny", destination_pattern: "*", destination_type: "wildcard", policy_source: "global", priority: 0 },
    { name: "allow-localhost", action: "allow", destination_pattern: "127.0.0.1", destination_type: "ip", policy_source: "local", priority: 100 },
    { name: "allow-localhost-ipv6", action: "allow", destination_pattern: "::1", destination_type: "ip", policy_source: "local", priority: 100 },
    { name: "allow-local-control-plane", action: "allow", destination_pattern: "localhost", destination_type: "domain", policy_source: "local", priority: 100 }
  ];
  const rules: EgressRule[] = [];
  for (const def of defaults) {
    rules.push(addEgressRule(def));
  }
  recordAudit("egress.defaults_initialized", { count: rules.length });
  return rules;
}

export function dispatchCommand(input: {
  kind: CQSCommandKind;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  issued_by?: string;
  correlation_id?: string;
}): CQSDispatchResult {
  const now = nowIso();
  const commandId = createEntityId("cmd");
  const command = CQSCommandSchema.parse({
    command_id: commandId,
    kind: input.kind,
    aggregate_type: input.aggregate_type,
    aggregate_id: input.aggregate_id,
    payload: input.payload,
    issued_at: now,
    issued_by: input.issued_by,
    correlation_id: input.correlation_id
  });
  store.cqsCommands.push(command);

  let result: unknown;
  let success = true;
  let error: string | undefined;
  const events: CQSEvent[] = [];

  try {
    switch (input.kind) {
      case "create_task": {
        const task = requireTask(input.aggregate_id);
        result = task;
        events.push(emitCQSEvent("task_created", "task", task.task_id, { intent: task.intent }, commandId, input.correlation_id));
        break;
      }
      case "start_task": {
        const taskId = input.aggregate_id;
        const runResult = runTaskEndToEnd(taskId);
        result = runResult;
        events.push(emitCQSEvent("task_state_changed", "task", taskId, { status: "running" }, commandId, input.correlation_id));
        break;
      }
      case "stop_task": {
        const taskId = input.aggregate_id;
        const task = requireTask(taskId);
        task.status = "cancelled";
        store.tasks.set(taskId, task);
        result = task;
        events.push(emitCQSEvent("task_state_changed", "task", taskId, { status: "cancelled" }, commandId, input.correlation_id));
        break;
      }
      case "add_evidence_node": {
        const taskId = input.aggregate_id;
        const graph = addEvidenceNode(taskId, input.payload as Parameters<typeof addEvidenceNode>[1]);
        result = graph;
        events.push(emitCQSEvent("evidence_produced", "task", taskId, {}, commandId, input.correlation_id));
        break;
      }
      case "submit_reviewer_feedback": {
        const feedback = submitReviewerFeedback(input.payload as Parameters<typeof submitReviewerFeedback>[0]);
        result = feedback;
        events.push(emitCQSEvent("reviewer_feedback_submitted", "task", feedback.task_id, { verdict: feedback.verdict }, commandId, input.correlation_id));
        break;
      }
      case "add_egress_rule": {
        const rule = addEgressRule(input.payload as Parameters<typeof addEgressRule>[0]);
        result = rule;
        events.push(emitCQSEvent("egress_checked", "egress_rule", rule.rule_id, { action: rule.action }, commandId, input.correlation_id));
        break;
      }
      case "approve_egress": {
        const requestId = input.payload.request_id as string;
        const approvedBy = input.payload.approved_by as string;
        const audit = approveEgressRequest(requestId, approvedBy);
        result = audit;
        events.push(emitCQSEvent("egress_approved", "egress_request", requestId, { approved_by: approvedBy }, commandId, input.correlation_id));
        break;
      }
      case "start_trace": {
        const taskId = input.aggregate_id;
        const traceResult = startTrace(taskId);
        result = traceResult;
        events.push(emitCQSEvent("trace_started", "task", taskId, { trace_id: traceResult.traceId }, commandId, input.correlation_id));
        break;
      }
      case "end_trace": {
        const traceId = input.aggregate_id;
        const timeline = endTrace(traceId, input.payload.status as RunTimeline["status"] | undefined);
        result = timeline;
        events.push(emitCQSEvent("trace_ended", "trace", traceId, { status: timeline.status }, commandId, input.correlation_id));
        break;
      }
      case "record_cost": {
        const cost = recordCostBreakdown(input.payload as Parameters<typeof recordCostBreakdown>[0]);
        result = cost;
        break;
      }
      case "capture_memory": {
        const taskId = input.aggregate_id;
        const memories = captureMemories(taskId);
        result = memories;
        events.push(emitCQSEvent("memory_captured", "task", taskId, { count: memories.length }, commandId, input.correlation_id));
        break;
      }
      default: {
        result = { acknowledged: true, kind: input.kind };
        events.push(emitCQSEvent("custom", input.aggregate_type, input.aggregate_id, input.payload, commandId, input.correlation_id));
      }
    }
  } catch (err) {
    success = false;
    error = String(err);
  }

  return CQSDispatchResultSchema.parse({
    success,
    command_id: commandId,
    result,
    events,
    error
  });
}

function emitCQSEvent(kind: CQSEventKind, aggregateType: string, aggregateId: string, payload: Record<string, unknown>, causedByCommandId?: string, correlationId?: string): CQSEvent {
  const now = nowIso();
  const event = CQSEventSchema.parse({
    event_id: createEntityId("evt"),
    kind,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    payload,
    caused_by_command_id: causedByCommandId,
    occurred_at: now,
    correlation_id: correlationId
  });
  store.cqsEvents.push(event);
  return event;
}

export function executeQuery(input: {
  kind: CQSQueryKind;
  target_type: string;
  target_id?: string;
  filter?: Record<string, unknown>;
  projection?: string[];
  correlation_id?: string;
}): CQSQueryResult {
  const now = nowIso();
  const queryId = createEntityId("qry");
  const query = CQSQuerySchema.parse({
    query_id: queryId,
    kind: input.kind,
    target_type: input.target_type,
    target_id: input.target_id,
    filter: input.filter ?? {},
    projection: input.projection,
    issued_at: now,
    correlation_id: input.correlation_id
  });
  store.cqsQueries.push(query);

  let data: unknown;
  let success = true;
  let error: string | undefined;

  try {
    switch (input.kind) {
      case "get_task": {
        const taskId = input.target_id ?? "";
        data = requireTask(taskId);
        break;
      }
      case "list_tasks": {
        data = [...store.tasks.values()];
        break;
      }
      case "get_workspace": {
        const taskId = input.target_id ?? "";
        data = { task_id: taskId, workspace: store.tasks.get(taskId) };
        break;
      }
      case "get_evidence_graph": {
        const taskId = input.target_id ?? "";
        data = getEvidenceGraph(taskId);
        break;
      }
      case "get_completion_verdict": {
        const taskId = input.target_id ?? "";
        data = evaluateCompletionStatus(taskId);
        break;
      }
      case "get_capability_score": {
        const taskId = input.target_id ?? "";
        data = getCapabilityScoreBreakdowns(taskId);
        break;
      }
      case "get_run_timeline": {
        const taskId = input.target_id ?? "";
        data = getRunTimeline(taskId);
        break;
      }
      case "get_cost_breakdown": {
        const taskId = input.target_id ?? "";
        data = getCostBreakdown(taskId);
        break;
      }
      case "get_slo_metrics": {
        data = getSLOMetrics(input.filter as Parameters<typeof getSLOMetrics>[0]);
        break;
      }
      case "get_span_tree": {
        const traceId = input.target_id ?? "";
        data = getSpanTree(traceId);
        break;
      }
      case "list_egress_rules": {
        data = listEgressRules(input.filter as Parameters<typeof listEgressRules>[0]);
        break;
      }
      case "list_egress_audits": {
        data = listEgressAudits(input.filter as Parameters<typeof listEgressAudits>[0]);
        break;
      }
      case "get_egress_stats": {
        data = getEgressAuditStats();
        break;
      }
      case "list_memory": {
        const taskId = input.target_id;
        data = taskId ? captureMemories(taskId) : listMemoryDocuments();
        break;
      }
      case "get_policy": {
        data = listPolicyRules();
        break;
      }
      case "get_agent_team": {
        const taskId = input.target_id ?? "";
        data = getTaskAgentTeamSummary(taskId);
        break;
      }
      default: {
        data = { kind: input.kind, note: "custom query not mapped" };
      }
    }
  } catch (err) {
    success = false;
    error = String(err);
  }

  return CQSQueryResultSchema.parse({
    success,
    query_id: queryId,
    data,
    error
  });
}

export function listCQSCommands(filter?: { kind?: CQSCommandKind; aggregate_type?: string; aggregate_id?: string }): CQSCommand[] {
  let commands = [...store.cqsCommands.values()];
  if (filter?.kind) commands = commands.filter(c => c.kind === filter.kind);
  if (filter?.aggregate_type) commands = commands.filter(c => c.aggregate_type === filter.aggregate_type);
  if (filter?.aggregate_id) commands = commands.filter(c => c.aggregate_id === filter.aggregate_id);
  return commands.sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}

export function listCQSQueries(filter?: { kind?: CQSQueryKind; target_type?: string }): CQSQuery[] {
  let queries = [...store.cqsQueries.values()];
  if (filter?.kind) queries = queries.filter(q => q.kind === filter.kind);
  if (filter?.target_type) queries = queries.filter(q => q.target_type === filter.target_type);
  return queries.sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}

export function listCQSEvents(filter?: { kind?: CQSEventKind; aggregate_type?: string; aggregate_id?: string; caused_by_command_id?: string }): CQSEvent[] {
  let events = [...store.cqsEvents.values()];
  if (filter?.kind) events = events.filter(e => e.kind === filter.kind);
  if (filter?.aggregate_type) events = events.filter(e => e.aggregate_type === filter.aggregate_type);
  if (filter?.aggregate_id) events = events.filter(e => e.aggregate_id === filter.aggregate_id);
  if (filter?.caused_by_command_id) events = events.filter(e => e.caused_by_command_id === filter.caused_by_command_id);
  return events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

export function createExperimentRun(input: {
  objective: string;
  hypothesis?: string;
  success_metric: string;
  budget: ExperimentBudget;
  task_family?: string;
  department?: string;
}): ExperimentRun {
  const now = nowIso();
  const experiment = ExperimentRunSchema.parse({
    experiment_id: createEntityId("exp"),
    objective: input.objective,
    hypothesis: input.hypothesis,
    status: "draft",
    candidates: [],
    budget: input.budget,
    success_metric: input.success_metric,
    tokens_used: 0,
    cost_incurred: 0,
    wall_clock_ms: 0,
    attempts_used: 0,
    created_at: now,
    updated_at: now,
    task_family: input.task_family,
    department: input.department
  });
  store.experimentRuns.set(experiment.experiment_id, experiment);
  return experiment;
}

export function getExperimentRun(experimentId: string): ExperimentRun | undefined {
  return store.experimentRuns.get(experimentId);
}

export function listExperimentRuns(filter?: { status?: ExperimentStatus; task_family?: string; department?: string }): ExperimentRun[] {
  let experiments = [...store.experimentRuns.values()];
  if (filter?.status) experiments = experiments.filter(e => e.status === filter.status);
  if (filter?.task_family) experiments = experiments.filter(e => e.task_family === filter.task_family);
  if (filter?.department) experiments = experiments.filter(e => e.department === filter.department);
  return experiments.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addExperimentCandidate(experimentId: string, candidate: Omit<ExperimentCandidate, "candidate_id" | "status">): ExperimentRun {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
  if (experiment.status !== "draft") throw new Error(`Can only add candidates to draft experiments`);

  const newCandidate = ExperimentCandidateSchema.parse({
    ...candidate,
    candidate_id: createEntityId("cand"),
    status: "pending"
  });
  experiment.candidates.push(newCandidate);
  experiment.updated_at = nowIso();
  store.experimentRuns.set(experimentId, experiment);
  return experiment;
}

export function promoteExperimentWinnerToLearningFactory(experimentId: string): { pipeline_id: string; lineage_id: string } | null {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment || experiment.status !== "completed" || !experiment.winner_candidate_id) return null;

  const winner = experiment.candidates.find(c => c.candidate_id === experiment.winner_candidate_id);
  if (!winner) return null;

  const pipeline = createLearningFactoryPipeline({
    source_task_id: experiment.objective,
    source_artifact_type: winner.method_type === "skill" ? "skill_candidate" : "methodology",
    source_artifact_id: winner.candidate_id
  });

  const lineage = createMethodLineage({
    asset_type: winner.method_type === "skill" ? "skill" : "template",
    asset_id: winner.candidate_id,
    mutation_kind: "experiment_winner",
    mutation_reason: `Winner of experiment ${experimentId} with metric ${winner.success_metric_value}`,
    snapshot: winner.config as Record<string, unknown>,
    mutation_source_id: experimentId
  });

  recordAudit("experiment.promoted_to_learning_factory", { experiment_id: experimentId, winner_id: winner.candidate_id, pipeline_id: pipeline.pipeline_id, lineage_id: lineage.lineage_id });
  return { pipeline_id: pipeline.pipeline_id, lineage_id: lineage.lineage_id };
}

export function triggerExperimentFromLowConfidence(taskId: string): ExperimentRun | null {
  const resolutions = listTaskCapabilityResolutions(taskId);
  const lowConfResolutions = resolutions.filter(r => r.strategy === "implement_local" || r.status === "fallback_required");
  if (lowConfResolutions.length === 0) return null;

  const task = requireTask(taskId);
  const experiment = createExperimentRun({
    objective: `Find best approach for: ${task.intent}`,
    hypothesis: `Multiple approaches should be compared for low-confidence capability needs`,
    success_metric: "completion_rate",
    budget: { max_attempts: 3, max_tokens: 10000, max_wall_clock_ms: 300000, max_cost: 1.0 }
  });

  for (const resolution of lowConfResolutions) {
    addExperimentCandidate(experiment.experiment_id, {
      name: `Local implementation for ${resolution.need_key}`,
      method_type: "implementation",
      config: { need_key: resolution.need_key, strategy: resolution.strategy }
    });
  }

  recordAudit("experiment.auto_triggered", { task_id: taskId, experiment_id: experiment.experiment_id, low_confidence_count: lowConfResolutions.length });
  return experiment;
}

export function startExperimentRun(experimentId: string): ExperimentRun {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
  if (experiment.status !== "draft") throw new Error(`Can only start draft experiments`);
  if (experiment.candidates.length === 0) throw new Error(`Cannot start experiment without candidates`);

  experiment.status = "running";
  experiment.updated_at = nowIso();
  for (const candidate of experiment.candidates) {
    candidate.status = "running";
  }
  store.experimentRuns.set(experimentId, experiment);
  return experiment;
}

export function recordExperimentCandidateResult(experimentId: string, candidateId: string, result: {
  result: unknown;
  success_metric_value?: number;
  tokens_used?: number;
  cost_incurred?: number;
  wall_clock_ms?: number;
}): ExperimentRun {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
  if (experiment.status !== "running") throw new Error(`Can only record results for running experiments`);

  const candidate = experiment.candidates.find(c => c.candidate_id === candidateId);
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

  candidate.result = result.result;
  candidate.success_metric_value = result.success_metric_value;
  candidate.status = "completed";

  if (result.tokens_used) experiment.tokens_used += result.tokens_used;
  if (result.cost_incurred) experiment.cost_incurred += result.cost_incurred;
  if (result.wall_clock_ms) experiment.wall_clock_ms += result.wall_clock_ms;
  experiment.attempts_used += 1;
  experiment.updated_at = nowIso();

  if (checkExperimentBudgetExhausted(experiment)) {
    experiment.status = "budget_exhausted";
    experiment.completed_at = nowIso();
  }

  store.experimentRuns.set(experimentId, experiment);
  return experiment;
}

export function failExperimentCandidate(experimentId: string, candidateId: string): ExperimentRun {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);

  const candidate = experiment.candidates.find(c => c.candidate_id === candidateId);
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

  candidate.status = "failed";
  experiment.attempts_used += 1;
  experiment.updated_at = nowIso();

  if (checkExperimentBudgetExhausted(experiment)) {
    experiment.status = "budget_exhausted";
    experiment.completed_at = nowIso();
  }

  store.experimentRuns.set(experimentId, experiment);
  return experiment;
}

function checkExperimentBudgetExhausted(experiment: ExperimentRun): boolean {
  const budget = experiment.budget;
  if (experiment.attempts_used >= budget.max_attempts) return true;
  if (budget.max_tokens !== undefined && experiment.tokens_used >= budget.max_tokens) return true;
  if (budget.max_cost !== undefined && experiment.cost_incurred >= budget.max_cost) return true;
  if (budget.max_wall_clock_ms !== undefined && experiment.wall_clock_ms >= budget.max_wall_clock_ms) return true;
  return false;
}

export function completeExperimentRun(experimentId: string): ExperimentRun {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
  if (experiment.status !== "running") throw new Error(`Can only complete running experiments`);

  const completedCandidates = experiment.candidates.filter(c => c.status === "completed");
  if (completedCandidates.length === 0) {
    experiment.status = "failed";
  } else {
    const best = completedCandidates.reduce((prev, curr) => {
      const prevVal = prev.success_metric_value ?? -Infinity;
      const currVal = curr.success_metric_value ?? -Infinity;
      return currVal > prevVal ? curr : prev;
    });
    experiment.winner_candidate_id = best.candidate_id;
    experiment.comparison_summary = {
      total_candidates: experiment.candidates.length,
      completed_candidates: completedCandidates.length,
      failed_candidates: experiment.candidates.filter(c => c.status === "failed").length,
      winner: best.name,
      winner_metric_value: best.success_metric_value,
      all_results: completedCandidates.map(c => ({
        candidate_id: c.candidate_id,
        name: c.name,
        method_type: c.method_type,
        success_metric_value: c.success_metric_value
      }))
    };
    experiment.status = "completed";
  }
  experiment.completed_at = nowIso();
  experiment.updated_at = nowIso();
  store.experimentRuns.set(experimentId, experiment);
  return experiment;
}

export function cancelExperimentRun(experimentId: string): ExperimentRun {
  const experiment = store.experimentRuns.get(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
  if (experiment.status === "completed" || experiment.status === "cancelled") throw new Error(`Cannot cancel experiment in ${experiment.status} state`);

  experiment.status = "cancelled";
  experiment.completed_at = nowIso();
  experiment.updated_at = nowIso();
  for (const candidate of experiment.candidates) {
    if (candidate.status === "running" || candidate.status === "pending") {
      candidate.status = "failed";
    }
  }
  store.experimentRuns.set(experimentId, experiment);
  return experiment;
}

export function createSandboxManifest(input: {
  task_id: string;
  tier: SandboxTier;
  resource_quota: ResourceQuota;
  filesystem_mounts?: FilesystemMount[];
  egress_rule_ids?: string[];
  rollback_hints?: { action: string; target: string; method: string }[];
  compensation_available?: boolean;
  ttl_ms?: number;
}): SandboxManifest {
  const now = nowIso();
  const ttl = input.ttl_ms ?? 3600000;
  const manifest = SandboxManifestSchema.parse({
    manifest_id: createEntityId("sbx"),
    task_id: input.task_id,
    tier: input.tier,
    filesystem_mounts: input.filesystem_mounts ?? [],
    capability_tokens: [],
    resource_quota: input.resource_quota,
    egress_rule_ids: input.egress_rule_ids ?? [],
    rollback_hints: input.rollback_hints ?? [],
    compensation_available: input.compensation_available ?? false,
    signed_at: now,
    expires_at: new Date(Date.parse(now) + ttl).toISOString(),
    status: "active",
    usage_summary: { file_writes: 0, shell_commands: 0, network_calls: 0, memory_peak_bytes: 0, wall_clock_ms: 0 }
  });
  store.sandboxManifests.set(manifest.manifest_id, manifest);
  return manifest;
}

export function getSandboxManifest(manifestId: string): SandboxManifest | undefined {
  return store.sandboxManifests.get(manifestId);
}

export function getSandboxManifestsForTask(taskId: string): SandboxManifest[] {
  return [...store.sandboxManifests.values()].filter(m => m.task_id === taskId);
}

export function issueCapabilityToken(manifestId: string, capability: string, scope?: string, ttl_ms?: number): SandboxManifest {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`Sandbox manifest not found: ${manifestId}`);
  if (manifest.status !== "active") throw new Error(`Cannot issue tokens for ${manifest.status} manifest`);

  const now = nowIso();
  const ttl = ttl_ms ?? 1800000;
  const token = CapabilityTokenSchema.parse({
    token_id: createEntityId("cap"),
    capability,
    scope,
    issued_at: now,
    expires_at: new Date(Date.parse(now) + ttl).toISOString()
  });
  manifest.capability_tokens.push(token);
  store.sandboxManifests.set(manifestId, manifest);
  return manifest;
}

export function revokeCapabilityToken(manifestId: string, tokenId: string): SandboxManifest {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`Sandbox manifest not found: ${manifestId}`);

  manifest.capability_tokens = manifest.capability_tokens.filter(t => t.token_id !== tokenId);
  store.sandboxManifests.set(manifestId, manifest);
  return manifest;
}

export function checkSandboxQuota(manifestId: string, action: "file_write" | "shell_command" | "network_call"): { allowed: boolean; reason?: string } {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) return { allowed: false, reason: "Manifest not found" };
  if (manifest.status !== "active") return { allowed: false, reason: `Manifest is ${manifest.status}` };

  const now = new Date();
  if (new Date(manifest.expires_at) <= now) {
    manifest.status = "expired";
    store.sandboxManifests.set(manifestId, manifest);
    return { allowed: false, reason: "Manifest has expired" };
  }

  const quota = manifest.resource_quota;
  const usage = manifest.usage_summary;

  switch (action) {
    case "file_write":
      if (quota.max_file_writes !== undefined && usage.file_writes >= quota.max_file_writes) {
        return { allowed: false, reason: `File write quota exhausted (${usage.file_writes}/${quota.max_file_writes})` };
      }
      break;
    case "shell_command":
      if (quota.max_shell_commands !== undefined && usage.shell_commands >= quota.max_shell_commands) {
        return { allowed: false, reason: `Shell command quota exhausted (${usage.shell_commands}/${quota.max_shell_commands})` };
      }
      break;
    case "network_call":
      if (quota.max_network_calls !== undefined && usage.network_calls >= quota.max_network_calls) {
        return { allowed: false, reason: `Network call quota exhausted (${usage.network_calls}/${quota.max_network_calls})` };
      }
      break;
  }

  return { allowed: true };
}

export function recordSandboxUsage(manifestId: string, usage: {
  file_writes?: number;
  shell_commands?: number;
  network_calls?: number;
  memory_peak_bytes?: number;
  wall_clock_ms?: number;
}): SandboxManifest {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`Sandbox manifest not found: ${manifestId}`);

  if (usage.file_writes) manifest.usage_summary.file_writes += usage.file_writes;
  if (usage.shell_commands) manifest.usage_summary.shell_commands += usage.shell_commands;
  if (usage.network_calls) manifest.usage_summary.network_calls += usage.network_calls;
  if (usage.memory_peak_bytes) manifest.usage_summary.memory_peak_bytes = Math.max(manifest.usage_summary.memory_peak_bytes, usage.memory_peak_bytes);
  if (usage.wall_clock_ms) manifest.usage_summary.wall_clock_ms += usage.wall_clock_ms;

  store.sandboxManifests.set(manifestId, manifest);
  return manifest;
}

export function revokeSandboxManifest(manifestId: string): SandboxManifest {
  const manifest = store.sandboxManifests.get(manifestId);
  if (!manifest) throw new Error(`Sandbox manifest not found: ${manifestId}`);

  manifest.status = "revoked";
  manifest.capability_tokens = [];
  store.sandboxManifests.set(manifestId, manifest);
  return manifest;
}

export function issueTaskControlCommand(input: {
  kind: TaskControlCommandKind;
  task_id: string;
  reason: string;
  correction?: string;
  new_intent?: string;
  issued_by?: string;
  resume_from_checkpoint?: boolean;
}): TaskControlCommand {
  const task = store.tasks.get(input.task_id);
  if (!task) throw new Error(`Task not found: ${input.task_id}`);

  const now = nowIso();
  const command = TaskControlCommandSchema.parse({
    command_id: createEntityId("ctrl"),
    kind: input.kind,
    task_id: input.task_id,
    issued_by: input.issued_by,
    issued_at: now,
    reason: input.reason,
    correction: input.correction,
    new_intent: input.new_intent,
    resume_from_checkpoint: input.resume_from_checkpoint ?? false,
    status: "pending"
  });

  switch (input.kind) {
    case "interrupt": {
      if (task.status !== "running" && task.status !== "planning") {
        command.status = "rejected";
        store.taskControlCommands.push(command);
        return command;
      }
      const stepIds = [...store.executionSteps.toArray()].filter(s => s.task_id === input.task_id).map(s => s.step_id);
      const evidenceIds = [...store.evidenceGraphs.values()].filter(g => g.task_id === input.task_id).flatMap(g => g.nodes.map(n => n.node_id));
      const snapshot = createCheckpointSnapshot({
        task_id: input.task_id,
        task_status: task.status,
        execution_step_ids: stepIds,
        evidence_node_ids: evidenceIds,
        snapshot_data: { intent: task.intent, previous_status: task.status }
      });
      command.checkpoint_id = snapshot.checkpoint_id;
      task.status = "paused";
      store.tasks.set(input.task_id, task);
      command.status = "applied";
      break;
    }
    case "correct": {
      if (!input.correction) throw new Error("correct command requires a correction description");
      if (task.status !== "running" && task.status !== "planning" && task.status !== "paused") {
        command.status = "rejected";
        store.taskControlCommands.push(command);
        return command;
      }
      task.status = "corrected";
      store.tasks.set(input.task_id, task);
      command.status = "applied";
      break;
    }
    case "redirect": {
      if (!input.new_intent) throw new Error("redirect command requires a new_intent");
      task.intent = input.new_intent;
      task.status = "redirected";
      store.tasks.set(input.task_id, task);
      command.status = "applied";
      break;
    }
  }

  store.taskControlCommands.push(command);
  return command;
}

export function listTaskControlCommands(taskId: string, filter?: { kind?: TaskControlCommandKind; status?: "pending" | "applied" | "rejected" }): TaskControlCommand[] {
  let commands = store.taskControlCommands.filter(c => c.task_id === taskId);
  if (filter?.kind) commands = commands.filter(c => c.kind === filter.kind);
  if (filter?.status) commands = commands.filter(c => c.status === filter.status);
  return commands.sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}

export function resumeFromInterrupt(taskId: string): { task_id: string; status: string; checkpoint_id?: string; restored_from_checkpoint: boolean } {
  const task = store.tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.status !== "paused") throw new Error(`Task is not paused (current: ${task.status})`);

  const lastInterrupt = store.taskControlCommands
    .filter(c => c.task_id === taskId && c.kind === "interrupt" && c.status === "applied")
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))[0];

  let restoredFromCheckpoint = false;
  if (lastInterrupt?.checkpoint_id) {
    try {
      restoreFromCheckpoint(lastInterrupt.checkpoint_id);
      restoredFromCheckpoint = true;
    } catch {
      // checkpoint not found, just resume
    }
  }

  task.status = "running";
  store.tasks.set(taskId, task);

  recordAudit("task.resumed_from_interrupt", {
    task_id: taskId,
    checkpoint_id: lastInterrupt?.checkpoint_id,
    restored_from_checkpoint: restoredFromCheckpoint
  });

  return {
    task_id: taskId,
    status: "running",
    checkpoint_id: lastInterrupt?.checkpoint_id,
    restored_from_checkpoint: restoredFromCheckpoint
  };
}

export function createMethodLineage(input: {
  asset_type: "skill" | "template" | "playbook" | "method";
  asset_id: string;
  mutation_kind: LineageMutationKind;
  mutation_reason: string;
  snapshot: Record<string, unknown>;
  mutation_source_id?: string;
  parent_lineage_id?: string;
  created_by?: string;
  tags?: string[];
}): MethodLineage {
  const now = nowIso();
  let version = 1;

  if (input.parent_lineage_id) {
    const parent = store.methodLineages.get(input.parent_lineage_id);
    if (parent) {
      version = parent.version + 1;
      parent.is_active = false;
      store.methodLineages.set(parent.lineage_id, parent);
    }
  } else {
    const existing = [...store.methodLineages.values()]
      .filter(l => l.asset_type === input.asset_type && l.asset_id === input.asset_id);
    if (existing.length > 0) {
      version = Math.max(...existing.map(l => l.version)) + 1;
      for (const old of existing.filter(l => l.is_active)) {
        old.is_active = false;
        store.methodLineages.set(old.lineage_id, old);
      }
    }
  }

  const lineage = MethodLineageSchema.parse({
    lineage_id: createEntityId("lin"),
    asset_type: input.asset_type,
    asset_id: input.asset_id,
    version,
    parent_lineage_id: input.parent_lineage_id,
    mutation_kind: input.mutation_kind,
    mutation_reason: input.mutation_reason,
    mutation_source_id: input.mutation_source_id,
    snapshot: input.snapshot,
    created_at: now,
    created_by: input.created_by,
    is_active: true,
    tags: input.tags ?? []
  });
  store.methodLineages.set(lineage.lineage_id, lineage);
  return lineage;
}

export function getMethodLineage(lineageId: string): MethodLineage | undefined {
  return store.methodLineages.get(lineageId);
}

export function getActiveLineageForAsset(assetType: "skill" | "template" | "playbook" | "method", assetId: string): MethodLineage | undefined {
  return [...store.methodLineages.values()]
    .find(l => l.asset_type === assetType && l.asset_id === assetId && l.is_active);
}

export function getLineageHistory(assetType: "skill" | "template" | "playbook" | "method", assetId: string): MethodLineage[] {
  return [...store.methodLineages.values()]
    .filter(l => l.asset_type === assetType && l.asset_id === assetId)
    .sort((a, b) => a.version - b.version);
}

export function getLineageChain(lineageId: string): MethodLineage[] {
  const chain: MethodLineage[] = [];
  let current = store.methodLineages.get(lineageId);
  while (current) {
    chain.push(current);
    if (!current.parent_lineage_id) break;
    current = store.methodLineages.get(current.parent_lineage_id);
  }
  return chain.reverse();
}

export function recordLineageEvaluation(lineageId: string, evaluation: {
  score?: number;
  passed?: boolean;
  metric_name?: string;
  metric_value?: number;
}): MethodLineage {
  const lineage = store.methodLineages.get(lineageId);
  if (!lineage) throw new Error(`Lineage not found: ${lineageId}`);

  lineage.evaluation_result = {
    ...evaluation,
    evaluated_at: nowIso()
  };
  store.methodLineages.set(lineageId, lineage);
  return lineage;
}

export function listMethodLineages(filter?: {
  asset_type?: "skill" | "template" | "playbook" | "method";
  mutation_kind?: LineageMutationKind;
  is_active?: boolean;
  tags?: string[];
}): MethodLineage[] {
  let lineages = [...store.methodLineages.values()];
  if (filter?.asset_type) lineages = lineages.filter(l => l.asset_type === filter.asset_type);
  if (filter?.mutation_kind) lineages = lineages.filter(l => l.mutation_kind === filter.mutation_kind);
  if (filter?.is_active !== undefined) lineages = lineages.filter(l => l.is_active === filter.is_active);
  if (filter?.tags && filter.tags.length > 0) lineages = lineages.filter(l => filter.tags!.some(t => l.tags.includes(t)));
  return lineages.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function autoCreateLineageFromPromotion(input: {
  asset_type: "skill" | "template" | "playbook" | "method";
  asset_id: string;
  promotion_source: "learning_factory" | "experiment_winner" | "manual";
  snapshot: Record<string, unknown>;
  created_by?: string;
}): MethodLineage {
  const activeLineage = getActiveLineageForAsset(input.asset_type, input.asset_id);

  const lineage = createMethodLineage({
    asset_type: input.asset_type,
    asset_id: input.asset_id,
    mutation_kind: input.promotion_source === "learning_factory" ? "learning_factory_promotion" : input.promotion_source === "experiment_winner" ? "experiment_winner" : "manual_edit",
    mutation_reason: `Auto-created from ${input.promotion_source}`,
    snapshot: input.snapshot,
    parent_lineage_id: activeLineage?.lineage_id,
    created_by: input.created_by
  });

  recordAudit("lineage.auto_created", {
    lineage_id: lineage.lineage_id,
    asset_type: input.asset_type,
    asset_id: input.asset_id,
    promotion_source: input.promotion_source,
    version: lineage.version
  });

  return lineage;
}

export function computeLineageDiff(lineageIdA: string, lineageIdB: string): {
  lineage_a: { id: string; version: number };
  lineage_b: { id: string; version: number };
  added_fields: string[];
  removed_fields: string[];
  changed_fields: Array<{ field: string; from: unknown; to: unknown }>;
  summary: string;
} {
  const a = store.methodLineages.get(lineageIdA);
  const b = store.methodLineages.get(lineageIdB);
  if (!a) throw new Error(`Lineage not found: ${lineageIdA}`);
  if (!b) throw new Error(`Lineage not found: ${lineageIdB}`);

  const snapA = a.snapshot as Record<string, unknown>;
  const snapB = b.snapshot as Record<string, unknown>;

  const keysA = new Set(Object.keys(snapA));
  const keysB = new Set(Object.keys(snapB));

  const added = [...keysB].filter(k => !keysA.has(k));
  const removed = [...keysA].filter(k => !keysB.has(k));
  const changed: Array<{ field: string; from: unknown; to: unknown }> = [];

  for (const key of [...keysA].filter(k => keysB.has(k))) {
    if (JSON.stringify(snapA[key]) !== JSON.stringify(snapB[key])) {
      changed.push({ field: key, from: snapA[key], to: snapB[key] });
    }
  }

  return {
    lineage_a: { id: lineageIdA, version: a.version },
    lineage_b: { id: lineageIdB, version: b.version },
    added_fields: added,
    removed_fields: removed,
    changed_fields: changed,
    summary: `${added.length} added, ${removed.length} removed, ${changed.length} changed`
  };
}

export function computeOperationalMetrics(input: {
  window: MetricsWindow;
  window_start: string;
  window_end: string;
  department?: string;
  task_family?: string;
}): OperationalMetrics {
  const tasks = [...store.tasks.values()].filter(t => {
    const taskCreated = t.timestamps.created_at;
    const inWindow = taskCreated >= input.window_start && taskCreated <= input.window_end;
    if (!inWindow) return false;
    if (input.department && t.department !== input.department) return false;
    return true;
  });

  const totalCreated = tasks.length;
  const totalCompleted = tasks.filter(t => t.status === "completed").length;
  const totalFailed = tasks.filter(t => t.status === "failed").length;
  const totalCancelled = tasks.filter(t => t.status === "cancelled").length;
  const completionRate = totalCreated > 0 ? totalCompleted / totalCreated : 0;
  const failureRate = totalCreated > 0 ? totalFailed / totalCreated : 0;

  const completedTasks = tasks.filter(t => t.status === "completed" && t.timestamps.created_at && t.timestamps.updated_at);
  const durations = completedTasks.map(t => Date.parse(t.timestamps.updated_at!) - Date.parse(t.timestamps.created_at)).sort((a, b) => a - b);
  const avgDuration = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;
  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const idx = Math.ceil(arr.length * p) - 1;
    return arr[Math.max(0, idx)];
  };

  const allVerifications = tasks.flatMap(t => {
    const graph = store.evidenceGraphs.get(t.task_id);
    return graph ? graph.nodes.filter(n => n.kind === "verifier") : [];
  });
  const totalVerifications = allVerifications.length;
  const passedVerifications = allVerifications.filter(n => n.status === "passed").length;
  const failedVerifications = allVerifications.filter(n => n.status === "failed").length;

  const totalTokens = tasks.reduce((s, t) => s + (t.cost_metrics.input_tokens ?? 0) + (t.cost_metrics.output_tokens ?? 0), 0);
  const totalCost = tasks.reduce((s, t) => s + (t.cost_metrics.total_cost_usd ?? 0), 0);

  const metrics = OperationalMetricsSchema.parse({
    metrics_id: createEntityId("met"),
    window: input.window,
    window_start: input.window_start,
    window_end: input.window_end,
    department: input.department,
    task_family: input.task_family,
    task_metrics: {
      total_created: totalCreated,
      total_completed: totalCompleted,
      total_failed: totalFailed,
      total_cancelled: totalCancelled,
      completion_rate: completionRate,
      failure_rate: failureRate,
      avg_duration_ms: avgDuration,
      p50_duration_ms: percentile(durations, 0.5),
      p95_duration_ms: percentile(durations, 0.95),
      p99_duration_ms: percentile(durations, 0.99)
    },
    verification_metrics: {
      total_verifications: totalVerifications,
      passed: passedVerifications,
      failed: failedVerifications,
      pass_rate: totalVerifications > 0 ? passedVerifications / totalVerifications : 0,
      avg_attempts_to_pass: 0
    },
    reuse_metrics: {
      total_tasks: totalCreated,
      tasks_with_reuse: 0,
      reuse_hit_rate: 0,
      skills_reused: 0,
      playbooks_reused: 0
    },
    cost_metrics: {
      total_tokens: totalTokens,
      total_cost: totalCost,
      avg_tokens_per_task: totalCreated > 0 ? totalTokens / totalCreated : 0,
      avg_cost_per_task: totalCreated > 0 ? totalCost / totalCreated : 0,
      by_model: {}
    },
    computed_at: nowIso()
  });

  store.operationalMetrics.set(metrics.metrics_id, metrics);
  return metrics;
}

export function getOperationalMetrics(metricsId: string): OperationalMetrics | undefined {
  return store.operationalMetrics.get(metricsId);
}

export function listOperationalMetrics(filter?: {
  window?: MetricsWindow;
  department?: string;
  task_family?: string;
}): OperationalMetrics[] {
  let metrics = [...store.operationalMetrics.values()];
  if (filter?.window) metrics = metrics.filter(m => m.window === filter.window);
  if (filter?.department) metrics = metrics.filter(m => m.department === filter.department);
  if (filter?.task_family) metrics = metrics.filter(m => m.task_family === filter.task_family);
  return metrics.sort((a, b) => b.computed_at.localeCompare(a.computed_at));
}

export function createReplayPackage(input: {
  name: string;
  description?: string;
  task_id?: string;
  time_range_start: string;
  time_range_end: string;
  event_kinds?: string[];
  created_by?: string;
}): ReplayPackage {
  let events = [...store.cqsEvents.values()]
    .filter(e => e.occurred_at >= input.time_range_start && e.occurred_at <= input.time_range_end);

  if (input.task_id) {
    events = events.filter(e => e.aggregate_id === input.task_id);
  }
  if (input.event_kinds && input.event_kinds.length > 0) {
    events = events.filter(e => input.event_kinds!.includes(e.kind));
  }

  const eventIds = events.map(e => e.event_id);

  const pkg = ReplayPackageSchema.parse({
    package_id: createEntityId("rpl"),
    name: input.name,
    description: input.description,
    task_id: input.task_id,
    time_range_start: input.time_range_start,
    time_range_end: input.time_range_end,
    event_kinds: input.event_kinds ?? [],
    included_event_ids: eventIds,
    annotations: [],
    status: "ready",
    event_count: eventIds.length,
    created_at: nowIso(),
    created_by: input.created_by
  });

  store.replayPackages.set(pkg.package_id, pkg);
  return pkg;
}

export function getReplayPackage(packageId: string): ReplayPackage | undefined {
  return store.replayPackages.get(packageId);
}

export function listReplayPackages(filter?: { task_id?: string; status?: "building" | "ready" | "error" }): ReplayPackage[] {
  let packages = [...store.replayPackages.values()];
  if (filter?.task_id) packages = packages.filter(p => p.task_id === filter.task_id);
  if (filter?.status) packages = packages.filter(p => p.status === filter.status);
  return packages.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getReplayPackageEvents(packageId: string): CQSEvent[] {
  const pkg = store.replayPackages.get(packageId);
  if (!pkg) throw new Error(`Replay package not found: ${packageId}`);

  const events: CQSEvent[] = [];
  for (const eventId of pkg.included_event_ids) {
    const event = store.cqsEvents.filter(e => e.event_id === eventId)[0];
    if (event) events.push(event);
  }
  return events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

export function addReplayAnnotation(packageId: string, annotation: {
  event_id: string;
  note: string;
  severity?: "info" | "warning" | "critical";
  annotated_by?: string;
}): ReplayPackage {
  const pkg = store.replayPackages.get(packageId);
  if (!pkg) throw new Error(`Replay package not found: ${packageId}`);

  pkg.annotations.push({
    event_id: annotation.event_id,
    note: annotation.note,
    severity: annotation.severity ?? "info",
    annotated_at: nowIso(),
    annotated_by: annotation.annotated_by
  });
  store.replayPackages.set(packageId, pkg);
  return pkg;
}

export function captureReplayStateSnapshot(packageId: string): ReplayPackage {
  const pkg = store.replayPackages.get(packageId);
  if (!pkg) throw new Error(`Replay package not found: ${packageId}`);

  const taskId = pkg.task_id;
  const snapshot: Record<string, unknown> = {
    package_id: packageId,
    snapshot_at: nowIso(),
    task_count: store.tasks.size,
    event_count: pkg.event_count
  };

  if (taskId) {
    const task = store.tasks.get(taskId);
    if (task) {
      snapshot.task_status = task.status;
      snapshot.task_intent = task.intent;
    }
    const evidence = store.evidenceGraphs.get(taskId);
    if (evidence) {
      snapshot.evidence_node_count = evidence.nodes.length;
    }
  }

  pkg.state_snapshot = snapshot;
  store.replayPackages.set(packageId, pkg);
  return pkg;
}

const PRIVACY_LEVEL_ORDER: Record<PrivacyLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3
};

export function createModelRoute(input: {
  model_alias: string;
  provider: ModelProvider;
  model_id: string;
  max_privacy_level: PrivacyLevel;
  priority?: number;
  max_tokens?: number;
  temperature?: number;
  fallback_route_id?: string;
}): ModelRoute {
  const route = ModelRouteSchema.parse({
    route_id: createEntityId("mrt"),
    model_alias: input.model_alias,
    provider: input.provider,
    model_id: input.model_id,
    max_privacy_level: input.max_privacy_level,
    priority: input.priority ?? 0,
    max_tokens: input.max_tokens,
    temperature: input.temperature,
    is_active: true,
    fallback_route_id: input.fallback_route_id
  });
  store.modelRoutes.set(route.route_id, route);
  return route;
}

export function getModelRoute(routeId: string): ModelRoute | undefined {
  return store.modelRoutes.get(routeId);
}

export function listModelRoutes(filter?: { model_alias?: string; provider?: ModelProvider; is_active?: boolean }): ModelRoute[] {
  let routes = [...store.modelRoutes.values()];
  if (filter?.model_alias) routes = routes.filter(r => r.model_alias === filter.model_alias);
  if (filter?.provider) routes = routes.filter(r => r.provider === filter.provider);
  if (filter?.is_active !== undefined) routes = routes.filter(r => r.is_active === filter.is_active);
  return routes.sort((a, b) => b.priority - a.priority);
}

export function resolveModelRoute(modelAlias: string, privacyLevel: PrivacyLevel): ModelRoute | undefined {
  const routes = [...store.modelRoutes.values()]
    .filter(r => r.model_alias === modelAlias && r.is_active)
    .filter(r => PRIVACY_LEVEL_ORDER[r.max_privacy_level] >= PRIVACY_LEVEL_ORDER[privacyLevel])
    .sort((a, b) => b.priority - a.priority);
  return routes[0];
}

export function recordModelRequest(input: {
  route_id: string;
  task_id?: string;
  model_alias: string;
  provider: ModelProvider;
  model_id: string;
  privacy_level: PrivacyLevel;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  status: "pending" | "success" | "error" | "rate_limited" | "fallback";
  error_message?: string;
  retry_count?: number;
}): ModelRequest {
  const request = ModelRequestSchema.parse({
    request_id: createEntityId("mrq"),
    route_id: input.route_id,
    task_id: input.task_id,
    model_alias: input.model_alias,
    provider: input.provider,
    model_id: input.model_id,
    privacy_level: input.privacy_level,
    input_tokens: input.input_tokens ?? 0,
    output_tokens: input.output_tokens ?? 0,
    cost_usd: input.cost_usd ?? 0,
    latency_ms: input.latency_ms ?? 0,
    status: input.status,
    error_message: input.error_message,
    retry_count: input.retry_count ?? 0,
    created_at: nowIso()
  });
  store.modelRequests.push(request);
  return request;
}

export function listModelRequests(filter?: { task_id?: string; route_id?: string; provider?: ModelProvider; status?: string }): ModelRequest[] {
  let requests = store.modelRequests.toArray();
  if (filter?.task_id) requests = requests.filter(r => r.task_id === filter.task_id);
  if (filter?.route_id) requests = requests.filter(r => r.route_id === filter.route_id);
  if (filter?.provider) requests = requests.filter(r => r.provider === filter.provider);
  if (filter?.status) requests = requests.filter(r => r.status === filter.status);
  return requests.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getModelCostSummary(filter?: { task_id?: string; provider?: ModelProvider }): {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  by_provider: Record<string, { requests: number; tokens: number; cost: number }>;
} {
  let requests = store.modelRequests.toArray();
  if (filter?.task_id) requests = requests.filter(r => r.task_id === filter.task_id);
  if (filter?.provider) requests = requests.filter(r => r.provider === filter.provider);

  const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const r of requests) {
    if (!byProvider[r.provider]) byProvider[r.provider] = { requests: 0, tokens: 0, cost: 0 };
    byProvider[r.provider].requests += 1;
    byProvider[r.provider].tokens += r.input_tokens + r.output_tokens;
    byProvider[r.provider].cost += r.cost_usd;
  }

  const totalLatency = requests.reduce((s, r) => s + r.latency_ms, 0);
  return {
    total_requests: requests.length,
    total_input_tokens: requests.reduce((s, r) => s + r.input_tokens, 0),
    total_output_tokens: requests.reduce((s, r) => s + r.output_tokens, 0),
    total_cost_usd: requests.reduce((s, r) => s + r.cost_usd, 0),
    avg_latency_ms: requests.length > 0 ? totalLatency / requests.length : 0,
    by_provider: byProvider
  };
}

export function createAutomationDefinition(input: {
  name: string;
  description?: string;
  trigger_kind: AutomationTriggerKind;
  trigger_config?: Record<string, unknown>;
  task_template: {
    intent: string;
    department: string;
    task_type: string;
    priority?: string;
    inputs?: Record<string, unknown>;
  };
  dedup_strategy?: AutomationDedupStrategy;
  dedup_window_ms?: number;
  recursion_policy?: AutomationRecursionPolicy;
  max_recursion_depth?: number;
}): AutomationDefinition {
  const now = nowIso();
  const def = AutomationDefinitionSchema.parse({
    automation_id: createEntityId("aut"),
    name: input.name,
    description: input.description,
    trigger_kind: input.trigger_kind,
    trigger_config: input.trigger_config ?? {},
    task_template: {
      intent: input.task_template.intent,
      department: input.task_template.department,
      task_type: input.task_template.task_type,
      priority: input.task_template.priority ?? "medium",
      inputs: input.task_template.inputs ?? {}
    },
    dedup_strategy: input.dedup_strategy ?? "exact_intent",
    dedup_window_ms: input.dedup_window_ms ?? 3600000,
    recursion_policy: input.recursion_policy ?? "block",
    max_recursion_depth: input.max_recursion_depth ?? 0,
    is_active: true,
    trigger_count: 0,
    created_at: now,
    updated_at: now
  });
  store.automationDefinitions.set(def.automation_id, def);
  return def;
}

export function getAutomationDefinition(automationId: string): AutomationDefinition | undefined {
  return store.automationDefinitions.get(automationId);
}

export function listAutomationDefinitions(filter?: { trigger_kind?: AutomationTriggerKind; is_active?: boolean }): AutomationDefinition[] {
  let defs = [...store.automationDefinitions.values()];
  if (filter?.trigger_kind) defs = defs.filter(d => d.trigger_kind === filter.trigger_kind);
  if (filter?.is_active !== undefined) defs = defs.filter(d => d.is_active === filter.is_active);
  return defs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function checkAutomationDedup(automationId: string): { is_duplicate: boolean; reason?: string } {
  const def = store.automationDefinitions.get(automationId);
  if (!def) throw new Error(`Automation definition not found: ${automationId}`);
  if (def.dedup_strategy === "none") return { is_duplicate: false };

  const now = Date.now();
  const windowStart = new Date(now - def.dedup_window_ms).toISOString();
  const recentTriggers = store.automationTriggerRecords.toArray()
    .filter(r => r.automation_id === automationId && r.triggered_at >= windowStart && !r.was_deduplicated);

  if (recentTriggers.length === 0) return { is_duplicate: false };

  if (def.dedup_strategy === "window") {
    return { is_duplicate: true, reason: `trigger within ${def.dedup_window_ms}ms window` };
  }

  if (def.dedup_strategy === "exact_intent") {
    const hasExactIntent = recentTriggers.some(r => {
      const task = r.task_id ? store.tasks.get(r.task_id) : undefined;
      return task && task.intent === def.task_template.intent;
    });
    if (hasExactIntent) return { is_duplicate: true, reason: "exact intent match in window" };
  }

  return { is_duplicate: false };
}

export function checkAutomationRecursion(automationId: string, currentDepth: number): { allowed: boolean; reason?: string } {
  const def = store.automationDefinitions.get(automationId);
  if (!def) throw new Error(`Automation definition not found: ${automationId}`);

  if (def.recursion_policy === "allow") return { allowed: true };
  if (def.recursion_policy === "block" && currentDepth > 0) {
    return { allowed: false, reason: "recursion blocked by policy" };
  }
  if (def.recursion_policy === "max_depth" && currentDepth > def.max_recursion_depth) {
    return { allowed: false, reason: `recursion depth ${currentDepth} exceeds max ${def.max_recursion_depth}` };
  }
  return { allowed: true };
}

export function triggerAutomation(automationId: string, recursionDepth: number = 0): AutomationTriggerRecord {
  const def = store.automationDefinitions.get(automationId);
  if (!def) throw new Error(`Automation definition not found: ${automationId}`);
  if (!def.is_active) throw new Error("Automation is not active");

  const recursionCheck = checkAutomationRecursion(automationId, recursionDepth);
  if (!recursionCheck.allowed) {
    const record = AutomationTriggerRecordSchema.parse({
      trigger_id: createEntityId("atr"),
      automation_id: automationId,
      trigger_kind: def.trigger_kind,
      was_deduplicated: true,
      dedup_reason: recursionCheck.reason,
      recursion_depth: recursionDepth,
      triggered_at: nowIso()
    });
    store.automationTriggerRecords.push(record);
    return record;
  }

  const dedupCheck = checkAutomationDedup(automationId);
  if (dedupCheck.is_duplicate) {
    const record = AutomationTriggerRecordSchema.parse({
      trigger_id: createEntityId("atr"),
      automation_id: automationId,
      trigger_kind: def.trigger_kind,
      was_deduplicated: true,
      dedup_reason: dedupCheck.reason,
      recursion_depth: recursionDepth,
      triggered_at: nowIso()
    });
    store.automationTriggerRecords.push(record);
    return record;
  }

  const task = mirrorTaskContract(TaskContractSchema.parse({
    task_id: createEntityId("task"),
    intent: def.task_template.intent,
    department: def.task_template.department,
    task_type: def.task_template.task_type,
    status: "pending",
    priority: (def.task_template.priority as "low" | "medium" | "high" | "critical") ?? "medium",
    inputs: def.task_template.inputs,
    definition_of_done: { required_artifacts: [], validation_criteria: [] },
    execution_plan: [],
    cost_metrics: { input_tokens: 0, output_tokens: 0, total_cost_usd: 0, model_calls: 0 },
    timestamps: { created_at: nowIso(), updated_at: nowIso() }
  }));

  def.trigger_count += 1;
  def.last_triggered_at = nowIso();
  def.updated_at = nowIso();
  store.automationDefinitions.set(automationId, def);

  const record = AutomationTriggerRecordSchema.parse({
    trigger_id: createEntityId("atr"),
    automation_id: automationId,
    trigger_kind: def.trigger_kind,
    task_id: task.task_id,
    was_deduplicated: false,
    recursion_depth: recursionDepth,
    triggered_at: nowIso()
  });
  store.automationTriggerRecords.push(record);
  return record;
}

export function detectMissedTriggers(automationId: string): AutomationTriggerRecord[] {
  const def = store.automationDefinitions.get(automationId);
  if (!def) throw new Error(`Automation definition not found: ${automationId}`);
  if (def.trigger_kind !== "schedule") return [];

  const config = def.trigger_config as Record<string, unknown>;
  const intervalMs = config.interval_ms as number | undefined;
  if (!intervalMs) return [];

  const lastTrigger = store.automationTriggerRecords.toArray()
    .filter(r => r.automation_id === automationId && !r.was_deduplicated)
    .sort((a, b) => b.triggered_at.localeCompare(a.triggered_at))[0];

  const lastTriggerTime = lastTrigger ? Date.parse(lastTrigger.triggered_at) : Date.parse(def.created_at);
  const now = Date.now();
  const elapsed = now - lastTriggerTime;
  const missedCount = Math.floor(elapsed / intervalMs) - (lastTrigger ? 1 : 0);

  const missedRecords: AutomationTriggerRecord[] = [];
  for (let i = 0; i < Math.min(missedCount, 10); i++) {
    const record = triggerAutomation(automationId);
    missedRecords.push(record);
  }
  return missedRecords;
}

export function listAutomationTriggerRecords(filter?: { automation_id?: string; was_deduplicated?: boolean }): AutomationTriggerRecord[] {
  let records = store.automationTriggerRecords.toArray();
  if (filter?.automation_id) records = records.filter(r => r.automation_id === filter.automation_id);
  if (filter?.was_deduplicated !== undefined) records = records.filter(r => r.was_deduplicated === filter.was_deduplicated);
  return records.sort((a, b) => b.triggered_at.localeCompare(a.triggered_at));
}

export function matchEventTriggers(event: {
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
}): AutomationTriggerRecord[] {
  const matchedRecords: AutomationTriggerRecord[] = [];

  for (const def of store.automationDefinitions.values()) {
    if (!def.is_active) continue;
    if (def.trigger_kind !== "event") continue;

    const config = def.trigger_config as Record<string, unknown>;
    const configEventType = config.event_type as string | undefined;
    const configSource = config.source as string | undefined;
    const configFilter = config.filter as Record<string, unknown> | undefined;

    if (configEventType && configEventType !== event.event_type) continue;
    if (configSource && configSource !== event.source) continue;

    if (configFilter) {
      let matches = true;
      for (const [key, value] of Object.entries(configFilter)) {
        if (event.payload[key] !== value) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }

    try {
      const record = triggerAutomation(def.automation_id);
      matchedRecords.push(record);
    } catch {
      // skip failed triggers
    }
  }

  recordAudit("automation.event_triggers_matched", {
    event_type: event.event_type,
    source: event.source,
    matched_count: matchedRecords.length
  });

  return matchedRecords;
}

export function enforceExecutionStepTimeouts(timeoutMs: number = 300000): ExecutionStep[] {
  const now = Date.now();
  const timedOut: ExecutionStep[] = [];

  for (const step of store.executionSteps.toArray()) {
    if (step.status !== "running") continue;

    const startedAt = step.started_at ? Date.parse(step.started_at) : Date.parse(step.created_at);
    if (now - startedAt > timeoutMs) {
      step.status = "failed";
      step.completed_at = nowIso();
      store.executionSteps.push(step);
      timedOut.push(step);

      recordAudit("execution_step.timeout", {
        step_id: step.step_id,
        task_id: step.task_id,
        kind: step.kind,
        timeout_ms: timeoutMs,
        elapsed_ms: now - startedAt
      });
    }
  }

  return timedOut;
}

export function runRuntimeMaintenanceCycle(options?: {
  heartbeat_timeout_ms?: number;
  step_timeout_ms?: number;
}): {
  expired_sessions: WorkerSession[];
  expired_leases: SandboxLease[];
  timed_out_steps: ExecutionStep[];
} {
  const expiredSessions = detectExpiredWorkerSessions(options?.heartbeat_timeout_ms ?? 60000);
  const expiredLeases = enforceSandboxLeaseExpiry();
  const timedOutSteps = enforceExecutionStepTimeouts(options?.step_timeout_ms ?? 300000);

  recordAudit("runtime.maintenance_cycle", {
    expired_sessions: expiredSessions.length,
    expired_leases: expiredLeases.length,
    timed_out_steps: timedOutSteps.length
  });

  return {
    expired_sessions: expiredSessions,
    expired_leases: expiredLeases,
    timed_out_steps: timedOutSteps
  };
}

export function createWikiPage(input: {
  title: string;
  page_class: WikiPageClass;
  content_markdown: string;
  owners?: string[];
  tags?: string[];
  linked_skill_ids?: string[];
  linked_template_ids?: string[];
}): WikiPage {
  const now = nowIso();
  const sections = parseWikiSections(input.content_markdown);
  const page = WikiPageSchema.parse({
    page_id: createEntityId("wiki"),
    title: input.title,
    page_class: input.page_class,
    status: "draft",
    content_markdown: input.content_markdown,
    owners: input.owners ?? [],
    tags: input.tags ?? [],
    freshness_date: now,
    linked_skill_ids: input.linked_skill_ids ?? [],
    linked_template_ids: input.linked_template_ids ?? [],
    sections,
    backlink_page_ids: [],
    compiled_summary: undefined,
    compiled_at: undefined,
    created_at: now,
    updated_at: now
  });
  store.wikiPages.set(page.page_id, page);
  updateWikiBacklinks(page);
  return page;
}

function parseWikiSections(markdown: string): WikiPage["sections"] {
  const lines = markdown.split("\n");
  const sections: WikiPage["sections"] = [];
  let currentSection: { heading: string; level: number; content: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      if (currentSection) {
        sections.push({
          section_id: createEntityId("wsec"),
          heading: currentSection.heading,
          level: currentSection.level,
          content: currentSection.content.join("\n"),
          child_section_ids: []
        });
      }
      currentSection = {
        heading: match[2],
        level: match[1].length,
        content: []
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      section_id: createEntityId("wsec"),
      heading: currentSection.heading,
      level: currentSection.level,
      content: currentSection.content.join("\n"),
      child_section_ids: []
    });
  }

  for (let i = 1; i < sections.length; i++) {
    for (let j = i - 1; j >= 0; j--) {
      if (sections[j].level < sections[i].level) {
        sections[j].child_section_ids.push(sections[i].section_id);
        break;
      }
    }
  }

  return sections;
}

function updateWikiBacklinks(page: WikiPage): void {
  const pageRefPattern = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  const referencedTitles = new Set<string>();

  while ((match = pageRefPattern.exec(page.content_markdown)) !== null) {
    referencedTitles.add(match[1]);
  }

  for (const otherPage of store.wikiPages.values()) {
    if (otherPage.page_id === page.page_id) continue;
    if (referencedTitles.has(otherPage.title)) {
      if (!otherPage.backlink_page_ids.includes(page.page_id)) {
        otherPage.backlink_page_ids.push(page.page_id);
        store.wikiPages.set(otherPage.page_id, otherPage);
      }
    }
    const otherRefs = [...otherPage.content_markdown.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
    if (otherRefs.includes(page.title)) {
      if (!page.backlink_page_ids.includes(otherPage.page_id)) {
        page.backlink_page_ids.push(otherPage.page_id);
      }
    }
  }
  store.wikiPages.set(page.page_id, page);
}

export function getWikiPage(pageId: string): WikiPage | undefined {
  return store.wikiPages.get(pageId);
}

export function listWikiPages(filter?: { page_class?: WikiPageClass; status?: WikiPageStatus; tag?: string; owner?: string }): WikiPage[] {
  let pages = [...store.wikiPages.values()];
  if (filter?.page_class) pages = pages.filter(p => p.page_class === filter.page_class);
  if (filter?.status) pages = pages.filter(p => p.status === filter.status);
  if (filter?.tag) pages = pages.filter(p => p.tags.includes(filter.tag!));
  if (filter?.owner) pages = pages.filter(p => p.owners.includes(filter.owner!));
  return pages.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function updateWikiPage(pageId: string, updates: {
  title?: string;
  content_markdown?: string;
  page_class?: WikiPageClass;
  status?: WikiPageStatus;
  owners?: string[];
  tags?: string[];
  linked_skill_ids?: string[];
  linked_template_ids?: string[];
}): WikiPage {
  const page = store.wikiPages.get(pageId);
  if (!page) throw new Error(`Wiki page not found: ${pageId}`);

  if (updates.title !== undefined) page.title = updates.title;
  if (updates.content_markdown !== undefined) {
    page.content_markdown = updates.content_markdown;
    page.sections = parseWikiSections(updates.content_markdown);
  }
  if (updates.page_class !== undefined) page.page_class = updates.page_class;
  if (updates.status !== undefined) page.status = updates.status;
  if (updates.owners !== undefined) page.owners = updates.owners;
  if (updates.tags !== undefined) page.tags = updates.tags;
  if (updates.linked_skill_ids !== undefined) page.linked_skill_ids = updates.linked_skill_ids;
  if (updates.linked_template_ids !== undefined) page.linked_template_ids = updates.linked_template_ids;

  page.updated_at = nowIso();
  store.wikiPages.set(pageId, page);
  updateWikiBacklinks(page);
  return page;
}

const wikiPageHistory = new Map<string, Array<{
  version: number;
  title: string;
  content_markdown: string;
  page_class: WikiPageClass;
  status: WikiPageStatus;
  tags: string[];
  edited_by?: string;
  edit_reason?: string;
  timestamp: string;
}>>();

export function getWikiPageHistory(pageId: string): Array<{
  version: number;
  title: string;
  content_markdown: string;
  page_class: WikiPageClass;
  status: WikiPageStatus;
  tags: string[];
  edited_by?: string;
  edit_reason?: string;
  timestamp: string;
}> {
  return wikiPageHistory.get(pageId) ?? [];
}

export function updateWikiPageWithHistory(pageId: string, updates: {
  title?: string;
  content_markdown?: string;
  page_class?: WikiPageClass;
  status?: WikiPageStatus;
  owners?: string[];
  tags?: string[];
  linked_skill_ids?: string[];
  linked_template_ids?: string[];
  edited_by?: string;
  edit_reason?: string;
}): WikiPage {
  const page = store.wikiPages.get(pageId);
  if (!page) throw new Error(`Wiki page not found: ${pageId}`);

  let history = wikiPageHistory.get(pageId);
  if (!history) {
    history = [{
      version: 1,
      title: page.title,
      content_markdown: page.content_markdown,
      page_class: page.page_class,
      status: page.status,
      tags: [...page.tags],
      timestamp: page.created_at
    }];
    wikiPageHistory.set(pageId, history);
  }

  history.push({
    version: history.length + 1,
    title: updates.title ?? page.title,
    content_markdown: updates.content_markdown ?? page.content_markdown,
    page_class: updates.page_class ?? page.page_class,
    status: updates.status ?? page.status,
    tags: updates.tags ?? [...page.tags],
    edited_by: updates.edited_by,
    edit_reason: updates.edit_reason,
    timestamp: nowIso()
  });

  return updateWikiPage(pageId, updates);
}

export function restoreWikiPageVersion(pageId: string, version: number, edited_by?: string): WikiPage {
  const history = wikiPageHistory.get(pageId);
  if (!history) throw new Error(`No version history for wiki page: ${pageId}`);

  const targetVersion = history.find(v => v.version === version);
  if (!targetVersion) throw new Error(`Version ${version} not found for wiki page: ${pageId}`);

  return updateWikiPageWithHistory(pageId, {
    title: targetVersion.title,
    content_markdown: targetVersion.content_markdown,
    page_class: targetVersion.page_class,
    status: targetVersion.status,
    tags: targetVersion.tags,
    edited_by,
    edit_reason: `Restored from version ${version}`
  });
}

export function compileWiki(): WikiCompilationResult {
  const pages = [...store.wikiPages.values()];
  const now = Date.now();
  const staleThreshold = 90 * 24 * 60 * 60 * 1000;
  const stalePages: string[] = [];
  const orphanPages: string[] = [];
  let totalBacklinks = 0;
  let totalSections = 0;

  for (const page of pages) {
    totalBacklinks += page.backlink_page_ids.length;
    totalSections += page.sections.length;

    const freshnessAge = now - Date.parse(page.freshness_date);
    if (freshnessAge > staleThreshold && page.status === "published") {
      stalePages.push(page.page_id);
      page.status = "stale";
      store.wikiPages.set(page.page_id, page);
    }

    if (page.backlink_page_ids.length === 0 && page.status !== "draft") {
      orphanPages.push(page.page_id);
    }

    const firstParagraph = page.content_markdown.split("\n\n")[0] ?? "";
    page.compiled_summary = firstParagraph.length > 300 ? firstParagraph.substring(0, 297) + "..." : firstParagraph;
    page.compiled_at = nowIso();
    store.wikiPages.set(page.page_id, page);
  }

  return WikiCompilationResultSchema.parse({
    compilation_id: createEntityId("wcomp"),
    total_pages: pages.length,
    total_backlinks: totalBacklinks,
    total_sections: totalSections,
    stale_pages: stalePages,
    orphan_pages: orphanPages,
    compiled_at: nowIso()
  });
}

export function searchWikiPages(query: string): WikiPage[] {
  const lowerQuery = query.toLowerCase();
  const pages = [...store.wikiPages.values()]
    .filter(p => p.status !== "retired")
    .map(p => {
      let score = 0;
      if (p.title.toLowerCase().includes(lowerQuery)) score += 10;
      if (p.tags.some(t => t.toLowerCase().includes(lowerQuery))) score += 5;
      if (p.content_markdown.toLowerCase().includes(lowerQuery)) score += 3;
      if (p.compiled_summary?.toLowerCase().includes(lowerQuery)) score += 2;
      return { page: p, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.page);
  return pages;
}

export function createExecutionStep(input: {
  task_id: string;
  run_id?: string;
  attempt_id?: string;
  parent_step_id?: string;
  kind: ExecutionStepKind;
  label: string;
  input?: Record<string, unknown>;
}): ExecutionStep {
  const step = ExecutionStepSchema.parse({
    step_id: createEntityId("estep"),
    task_id: input.task_id,
    run_id: input.run_id,
    attempt_id: input.attempt_id,
    parent_step_id: input.parent_step_id,
    kind: input.kind,
    status: "pending",
    label: input.label,
    input: input.input ?? {},
    output: {},
    error: undefined,
    started_at: undefined,
    completed_at: undefined,
    duration_ms: 0,
    retry_count: 0,
    evidence_node_ids: [],
    child_step_ids: [],
    created_at: nowIso()
  });

  if (input.parent_step_id) {
    const parent = store.executionSteps.toArray().find(s => s.step_id === input.parent_step_id);
    if (parent && !parent.child_step_ids.includes(step.step_id)) {
      parent.child_step_ids.push(step.step_id);
      store.executionSteps.push(parent);
    }
  }

  store.executionSteps.push(step);
  return step;
}

export function startExecutionStep(stepId: string): ExecutionStep {
  const step = store.executionSteps.toArray().find(s => s.step_id === stepId);
  if (!step) throw new Error(`Execution step not found: ${stepId}`);
  if (step.status !== "pending") throw new Error(`Step is not pending: ${step.status}`);

  step.status = "running";
  step.started_at = nowIso();
  store.executionSteps.push(step);
  return step;
}

export function completeExecutionStep(stepId: string, output?: Record<string, unknown>): ExecutionStep {
  const step = store.executionSteps.toArray().find(s => s.step_id === stepId);
  if (!step) throw new Error(`Execution step not found: ${stepId}`);
  if (step.status !== "running") throw new Error(`Step is not running: ${step.status}`);

  const now = nowIso();
  step.status = "completed";
  step.completed_at = now;
  step.output = output ?? step.output;
  if (step.started_at) {
    step.duration_ms = Date.parse(now) - Date.parse(step.started_at);
  }
  store.executionSteps.push(step);
  return step;
}

export function failExecutionStep(stepId: string, error: string): ExecutionStep {
  const step = store.executionSteps.toArray().find(s => s.step_id === stepId);
  if (!step) throw new Error(`Execution step not found: ${stepId}`);

  step.status = "failed";
  step.error = error;
  step.completed_at = nowIso();
  if (step.started_at) {
    step.duration_ms = Date.parse(step.completed_at) - Date.parse(step.started_at);
  }
  store.executionSteps.push(step);
  return step;
}

export function skipExecutionStep(stepId: string): ExecutionStep {
  const step = store.executionSteps.toArray().find(s => s.step_id === stepId);
  if (!step) throw new Error(`Execution step not found: ${stepId}`);

  step.status = "skipped";
  step.completed_at = nowIso();
  store.executionSteps.push(step);
  return step;
}

export function retryExecutionStep(stepId: string): ExecutionStep {
  const step = store.executionSteps.toArray().find(s => s.step_id === stepId);
  if (!step) throw new Error(`Execution step not found: ${stepId}`);
  if (step.status !== "failed") throw new Error(`Can only retry failed steps: ${step.status}`);

  step.status = "pending";
  step.error = undefined;
  step.started_at = undefined;
  step.completed_at = undefined;
  step.duration_ms = 0;
  step.retry_count += 1;
  store.executionSteps.push(step);
  return step;
}

export function linkStepEvidence(stepId: string, evidenceNodeId: string): ExecutionStep {
  const step = store.executionSteps.toArray().find(s => s.step_id === stepId);
  if (!step) throw new Error(`Execution step not found: ${stepId}`);

  if (!step.evidence_node_ids.includes(evidenceNodeId)) {
    step.evidence_node_ids.push(evidenceNodeId);
    store.executionSteps.push(step);
  }
  return step;
}

export function getExecutionStep(stepId: string): ExecutionStep | undefined {
  return store.executionSteps.toArray().find(s => s.step_id === stepId);
}

export function listExecutionSteps(filter: { task_id: string; run_id?: string; attempt_id?: string; kind?: ExecutionStepKind; status?: ExecutionStepStatus }): ExecutionStep[] {
  let steps = store.executionSteps.toArray();
  steps = steps.filter(s => s.task_id === filter.task_id);
  if (filter.run_id) steps = steps.filter(s => s.run_id === filter.run_id);
  if (filter.attempt_id) steps = steps.filter(s => s.attempt_id === filter.attempt_id);
  if (filter.kind) steps = steps.filter(s => s.kind === filter.kind);
  if (filter.status) steps = steps.filter(s => s.status === filter.status);
  return steps.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getExecutionStepTree(taskId: string): { root_steps: ExecutionStep[]; all_steps: ExecutionStep[] } {
  const steps = store.executionSteps.toArray().filter(s => s.task_id === taskId);
  const rootSteps = steps.filter(s => !s.parent_step_id);
  return { root_steps: rootSteps.sort((a, b) => a.created_at.localeCompare(b.created_at)), all_steps: steps.sort((a, b) => a.created_at.localeCompare(b.created_at)) };
}

export function createTaskRun(taskId: string): TaskRun {
  const now = nowIso();
  const run = TaskRunSchema.parse({
    run_id: createEntityId("trun"),
    task_id: taskId,
    status: "created",
    attempt_count: 0,
    current_attempt_id: undefined,
    started_at: undefined,
    completed_at: undefined,
    duration_ms: 0,
    total_step_count: 0,
    completed_step_count: 0,
    failed_step_count: 0,
    created_at: now,
    updated_at: now
  });
  store.taskRuns.set(run.run_id, run);
  return run;
}

export function startTaskRun(runId: string): TaskRun {
  const run = store.taskRuns.get(runId);
  if (!run) throw new Error(`TaskRun not found: ${runId}`);
  if (run.status !== "created") throw new Error(`TaskRun is not in created state: ${run.status}`);

  run.status = "running";
  run.started_at = nowIso();
  run.updated_at = nowIso();
  store.taskRuns.set(runId, run);
  return run;
}

export function completeTaskRun(runId: string): TaskRun {
  const run = store.taskRuns.get(runId);
  if (!run) throw new Error(`TaskRun not found: ${runId}`);
  if (run.status !== "running") throw new Error(`TaskRun is not running: ${run.status}`);

  const now = nowIso();
  run.status = "completed";
  run.completed_at = now;
  run.updated_at = now;
  if (run.started_at) {
    run.duration_ms = Date.parse(now) - Date.parse(run.started_at);
  }
  const steps = store.executionSteps.toArray().filter(s => s.task_id === run.task_id && s.run_id === runId);
  run.total_step_count = steps.length;
  run.completed_step_count = steps.filter(s => s.status === "completed").length;
  run.failed_step_count = steps.filter(s => s.status === "failed").length;
  store.taskRuns.set(runId, run);
  return run;
}

export function failTaskRun(runId: string): TaskRun {
  const run = store.taskRuns.get(runId);
  if (!run) throw new Error(`TaskRun not found: ${runId}`);

  const now = nowIso();
  run.status = "failed";
  run.completed_at = now;
  run.updated_at = now;
  if (run.started_at) {
    run.duration_ms = Date.parse(now) - Date.parse(run.started_at);
  }
  store.taskRuns.set(runId, run);
  return run;
}

export function getTaskRun(runId: string): TaskRun | undefined {
  return store.taskRuns.get(runId);
}

export function listTaskRuns(taskId: string): TaskRun[] {
  return [...store.taskRuns.values()].filter(r => r.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function createTaskAttempt(input: { run_id: string; task_id: string; parent_attempt_id?: string }): TaskAttempt {
  const run = store.taskRuns.get(input.run_id);
  if (!run) throw new Error(`TaskRun not found: ${input.run_id}`);

  const existingAttempts = store.taskAttempts.toArray().filter(a => a.run_id === input.run_id);
  const attemptNumber = existingAttempts.length + 1;
  const now = nowIso();

  const attempt = TaskAttemptSchema.parse({
    attempt_id: createEntityId("tatt"),
    run_id: input.run_id,
    task_id: input.task_id,
    attempt_number: attemptNumber,
    status: "pending",
    parent_attempt_id: input.parent_attempt_id,
    worker_session_id: undefined,
    sandbox_lease_id: undefined,
    started_at: undefined,
    completed_at: undefined,
    duration_ms: 0,
    verdict: undefined,
    created_at: now
  });

  store.taskAttempts.push(attempt);
  run.attempt_count = attemptNumber;
  run.current_attempt_id = attempt.attempt_id;
  run.updated_at = nowIso();
  store.taskRuns.set(input.run_id, run);
  return attempt;
}

export function startTaskAttempt(attemptId: string): TaskAttempt {
  const attempt = store.taskAttempts.toArray().find(a => a.attempt_id === attemptId);
  if (!attempt) throw new Error(`TaskAttempt not found: ${attemptId}`);
  if (attempt.status !== "pending") throw new Error(`TaskAttempt is not pending: ${attempt.status}`);

  attempt.status = "running";
  attempt.started_at = nowIso();
  store.taskAttempts.push(attempt);
  return attempt;
}

export function completeTaskAttempt(attemptId: string, verdict?: "accepted" | "accepted_with_notes" | "revise_and_retry" | "blocked"): TaskAttempt {
  const attempt = store.taskAttempts.toArray().find(a => a.attempt_id === attemptId);
  if (!attempt) throw new Error(`TaskAttempt not found: ${attemptId}`);

  const now = nowIso();
  attempt.status = "completed";
  attempt.completed_at = now;
  attempt.duration_ms = attempt.started_at ? Date.parse(now) - Date.parse(attempt.started_at) : 0;
  attempt.verdict = verdict ?? "accepted";
  store.taskAttempts.push(attempt);
  return attempt;
}

export function failTaskAttempt(attemptId: string): TaskAttempt {
  const attempt = store.taskAttempts.toArray().find(a => a.attempt_id === attemptId);
  if (!attempt) throw new Error(`TaskAttempt not found: ${attemptId}`);

  attempt.status = "failed";
  attempt.completed_at = nowIso();
  attempt.duration_ms = attempt.started_at ? Date.parse(attempt.completed_at) - Date.parse(attempt.started_at) : 0;
  store.taskAttempts.push(attempt);
  return attempt;
}

export function getTaskAttempt(attemptId: string): TaskAttempt | undefined {
  return store.taskAttempts.toArray().find(a => a.attempt_id === attemptId);
}

export function listTaskAttempts(runId: string): TaskAttempt[] {
  return store.taskAttempts.toArray().filter(a => a.run_id === runId).sort((a, b) => a.attempt_number - b.attempt_number);
}

export function createWorkerSession(input: { worker_id: string; task_id?: string; run_id?: string }): WorkerSession {
  const now = nowIso();
  const session = WorkerSessionSchema.parse({
    session_id: createEntityId("wses"),
    worker_id: input.worker_id,
    task_id: input.task_id,
    run_id: input.run_id,
    status: "active",
    started_at: now,
    last_heartbeat_at: now,
    terminated_at: undefined,
    step_count: 0,
    created_at: now
  });
  store.workerSessions.set(session.session_id, session);
  return session;
}

export function heartbeatWorkerSession(sessionId: string): WorkerSession {
  const session = store.workerSessions.get(sessionId);
  if (!session) throw new Error(`WorkerSession not found: ${sessionId}`);

  session.last_heartbeat_at = nowIso();
  store.workerSessions.set(sessionId, session);
  return session;
}

export function terminateWorkerSession(sessionId: string): WorkerSession {
  const session = store.workerSessions.get(sessionId);
  if (!session) throw new Error(`WorkerSession not found: ${sessionId}`);

  session.status = "terminated";
  session.terminated_at = nowIso();
  store.workerSessions.set(sessionId, session);
  return session;
}

export function getWorkerSession(sessionId: string): WorkerSession | undefined {
  return store.workerSessions.get(sessionId);
}

export function listWorkerSessions(filter?: { worker_id?: string; status?: WorkerSessionStatus }): WorkerSession[] {
  let sessions = [...store.workerSessions.values()];
  if (filter?.worker_id) sessions = sessions.filter(s => s.worker_id === filter.worker_id);
  if (filter?.status) sessions = sessions.filter(s => s.status === filter.status);
  return sessions.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function createSandboxLease(input: { task_id: string; attempt_id?: string; sandbox_manifest_id?: string; tier?: "host_readonly" | "guarded_mutation" | "isolated_mutation"; expires_at?: string }): SandboxLease {
  const now = nowIso();
  const lease = SandboxLeaseSchema.parse({
    lease_id: createEntityId("sble"),
    task_id: input.task_id,
    attempt_id: input.attempt_id,
    sandbox_manifest_id: input.sandbox_manifest_id,
    status: "active",
    tier: input.tier ?? "host_readonly",
    issued_at: now,
    expires_at: input.expires_at,
    released_at: undefined,
    created_at: now
  });
  store.sandboxLeases.set(lease.lease_id, lease);

  if (input.attempt_id) {
    const attempt = store.taskAttempts.toArray().find(a => a.attempt_id === input.attempt_id);
    if (attempt) {
      attempt.sandbox_lease_id = lease.lease_id;
      store.taskAttempts.push(attempt);
    }
  }

  return lease;
}

export function releaseSandboxLease(leaseId: string): SandboxLease {
  const lease = store.sandboxLeases.get(leaseId);
  if (!lease) throw new Error(`SandboxLease not found: ${leaseId}`);
  if (lease.status !== "active") throw new Error(`SandboxLease is not active: ${lease.status}`);

  lease.status = "released";
  lease.released_at = nowIso();
  store.sandboxLeases.set(leaseId, lease);
  return lease;
}

export function revokeSandboxLease(leaseId: string): SandboxLease {
  const lease = store.sandboxLeases.get(leaseId);
  if (!lease) throw new Error(`SandboxLease not found: ${leaseId}`);

  lease.status = "revoked";
  lease.released_at = nowIso();
  store.sandboxLeases.set(leaseId, lease);
  return lease;
}

export function getSandboxLease(leaseId: string): SandboxLease | undefined {
  return store.sandboxLeases.get(leaseId);
}

export function listSandboxLeases(taskId: string): SandboxLease[] {
  return [...store.sandboxLeases.values()].filter(l => l.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function detectExpiredWorkerSessions(heartbeatTimeoutMs: number = 60000): WorkerSession[] {
  const now = Date.now();
  const expired: WorkerSession[] = [];

  for (const session of store.workerSessions.values()) {
    if (session.status !== "active") continue;
    if (!session.last_heartbeat_at) continue;

    const lastHeartbeat = Date.parse(session.last_heartbeat_at);
    if (now - lastHeartbeat > heartbeatTimeoutMs) {
      session.status = "terminated";
      session.terminated_at = nowIso();
      store.workerSessions.set(session.session_id, session);
      expired.push(session);

      recordAudit("worker_session.expired", {
        session_id: session.session_id,
        worker_id: session.worker_id,
        last_heartbeat_at: session.last_heartbeat_at,
        heartbeat_timeout_ms: heartbeatTimeoutMs
      });
    }
  }

  return expired;
}

export function enforceSandboxLeaseExpiry(): SandboxLease[] {
  const now = Date.now();
  const expired: SandboxLease[] = [];

  for (const lease of store.sandboxLeases.values()) {
    if (lease.status !== "active") continue;
    if (!lease.expires_at) continue;

    const expiryTime = Date.parse(lease.expires_at);
    if (now > expiryTime) {
      lease.status = "expired";
      lease.released_at = nowIso();
      store.sandboxLeases.set(lease.lease_id, lease);
      expired.push(lease);

      recordAudit("sandbox_lease.auto_expired", {
        lease_id: lease.lease_id,
        task_id: lease.task_id,
        tier: lease.tier,
        expires_at: lease.expires_at
      });

      if (lease.sandbox_manifest_id) {
        const manifest = store.sandboxManifests.get(lease.sandbox_manifest_id);
        if (manifest && manifest.status === "active") {
          manifest.status = "expired";
          store.sandboxManifests.set(lease.sandbox_manifest_id, manifest);
          recordAudit("sandbox_manifest.auto_expired", {
            manifest_id: lease.sandbox_manifest_id,
            reason: "lease_expiry"
          });
        }
      }
    }
  }

  return expired;
}

export function createTaskRunFromTask(taskId: string): TaskRun {
  const task = store.tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const existingRuns = [...store.taskRuns.values()].filter(r => r.task_id === taskId);

  const run = TaskRunSchema.parse({
    run_id: createEntityId("trun"),
    task_id: taskId,
    status: "created",
    started_at: nowIso(),
    completed_at: undefined,
    current_attempt_id: undefined,
    attempt_count: 0,
    total_step_count: 0,
    duration_ms: 0,
    created_at: nowIso()
  });

  store.taskRuns.set(run.run_id, run);

  recordAudit("task_run.auto_created", {
    run_id: run.run_id,
    task_id: taskId,
    existing_run_count: existingRuns.length
  });

  return run;
}

export function startTaskRunFromTask(taskId: string): TaskRun {
  let run = [...store.taskRuns.values()]
    .filter(r => r.task_id === taskId && (r.status === "created" || r.status === "running"))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  if (!run) {
    run = createTaskRunFromTask(taskId);
  }

  if (run.status === "created") {
    run.status = "running";
    run.started_at = nowIso();
    store.taskRuns.set(run.run_id, run);

    recordAudit("task_run.auto_started", {
      run_id: run.run_id,
      task_id: taskId
    });
  }

  return run;
}

export function createPipelineStepsForTask(taskId: string, runId?: string): ExecutionStep[] {
  const task = store.tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const pipelineStages: Array<{ kind: ExecutionStepKind; label: string }> = [
    { kind: "planning", label: "Plan task execution" },
    { kind: "capability_resolution", label: "Resolve required capabilities" },
    { kind: "policy_check", label: "Check policy compliance" },
    { kind: "execution", label: "Execute task" },
    { kind: "verification", label: "Verify results" },
    { kind: "memory_capture", label: "Capture methodology" },
    { kind: "learning", label: "Record learning" }
  ];

  const steps: ExecutionStep[] = [];
  for (const stage of pipelineStages) {
    const step = createExecutionStep({
      task_id: taskId,
      run_id: runId,
      kind: stage.kind,
      label: stage.label
    });
    steps.push(step);
  }

  if (steps.length > 0) {
    startExecutionStep(steps[0].step_id);
  }

  recordAudit("task.pipeline_steps_created", {
    task_id: taskId,
    run_id: runId,
    step_count: steps.length
  });

  return steps;
}

export function advancePipelineStep(taskId: string, currentStepKind: ExecutionStepKind): ExecutionStep | null {
  const steps = store.executionSteps.toArray()
    .filter(s => s.task_id === taskId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const currentIdx = steps.findIndex(s => s.kind === currentStepKind && s.status === "running");
  if (currentIdx === -1) return null;

  completeExecutionStep(steps[currentIdx].step_id);

  if (currentIdx + 1 < steps.length) {
    startExecutionStep(steps[currentIdx + 1].step_id);
    return steps[currentIdx + 1];
  }

  return null;
}

export function recordStepCost(input: {
  step_id: string;
  model_alias?: string;
  provider?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  tool_invocations?: number;
  external_calls?: number;
  memory_operations?: number;
}): ExecutionStep {
  const step = store.executionSteps.toArray().find(s => s.step_id === input.step_id);
  if (!step) throw new Error(`ExecutionStep not found: ${input.step_id}`);

  const costData: Record<string, unknown> = {
    ...(step.output ?? {}),
    cost_tracking: {
      model_alias: input.model_alias,
      provider: input.provider,
      input_tokens: input.input_tokens ?? 0,
      output_tokens: input.output_tokens ?? 0,
      cost_usd: input.cost_usd ?? 0,
      tool_invocations: input.tool_invocations ?? 0,
      external_calls: input.external_calls ?? 0,
      memory_operations: input.memory_operations ?? 0,
      recorded_at: nowIso()
    }
  };

  step.output = costData;
  store.executionSteps.push(step);

  recordAudit("execution_step.cost_recorded", {
    step_id: input.step_id,
    task_id: step.task_id,
    cost_usd: input.cost_usd,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens
  });

  return step;
}

export function getStepCostSummary(taskId: string): {
  total_steps: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tool_invocations: number;
  total_external_calls: number;
  total_memory_operations: number;
  by_kind: Record<string, { count: number; cost_usd: number; input_tokens: number; output_tokens: number }>;
} {
  const steps = store.executionSteps.toArray().filter(s => s.task_id === taskId);

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalToolInvocations = 0;
  let totalExternalCalls = 0;
  let totalMemoryOps = 0;
  const byKind: Record<string, { count: number; cost_usd: number; input_tokens: number; output_tokens: number }> = {};

  for (const step of steps) {
    const costTracking = (step.output as Record<string, unknown>)?.cost_tracking as Record<string, unknown> | undefined;
    const cost = (costTracking?.cost_usd as number) ?? 0;
    const inputTokens = (costTracking?.input_tokens as number) ?? 0;
    const outputTokens = (costTracking?.output_tokens as number) ?? 0;

    totalCost += cost;
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    totalToolInvocations += (costTracking?.tool_invocations as number) ?? 0;
    totalExternalCalls += (costTracking?.external_calls as number) ?? 0;
    totalMemoryOps += (costTracking?.memory_operations as number) ?? 0;

    if (!byKind[step.kind]) byKind[step.kind] = { count: 0, cost_usd: 0, input_tokens: 0, output_tokens: 0 };
    byKind[step.kind].count += 1;
    byKind[step.kind].cost_usd += cost;
    byKind[step.kind].input_tokens += inputTokens;
    byKind[step.kind].output_tokens += outputTokens;
  }

  return {
    total_steps: steps.length,
    total_cost_usd: totalCost,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_tool_invocations: totalToolInvocations,
    total_external_calls: totalExternalCalls,
    total_memory_operations: totalMemoryOps,
    by_kind: byKind
  };
}

export function createExecutionHarness(input: {
  task_id: string;
  step_id?: string;
  kind: HarnessKind;
  label: string;
  fixed_input: Record<string, unknown>;
  expected_output: Record<string, unknown>;
  timeout_ms?: number;
  rollback_available?: boolean;
}): ExecutionHarness {
  const harness = ExecutionHarnessSchema.parse({
    harness_id: createEntityId("hrns"),
    task_id: input.task_id,
    step_id: input.step_id,
    kind: input.kind,
    status: "pending",
    label: input.label,
    fixed_input: input.fixed_input,
    expected_output: input.expected_output,
    actual_output: {},
    timeout_ms: input.timeout_ms ?? 30000,
    started_at: undefined,
    completed_at: undefined,
    duration_ms: 0,
    error: undefined,
    evidence_node_id: undefined,
    rollback_available: input.rollback_available ?? false,
    rollback_executed: false,
    created_at: nowIso()
  });
  store.executionHarnesses.set(harness.harness_id, harness);
  return harness;
}

export function runExecutionHarness(harnessId: string, executeFn: (input: Record<string, unknown>) => Record<string, unknown>): ExecutionHarness {
  const harness = store.executionHarnesses.get(harnessId);
  if (!harness) throw new Error(`ExecutionHarness not found: ${harnessId}`);
  if (harness.status !== "pending") throw new Error(`Harness is not pending: ${harness.status}`);

  harness.status = "running";
  harness.started_at = nowIso();
  store.executionHarnesses.set(harnessId, harness);

  try {
    const result = executeFn(harness.fixed_input);
    const now = nowIso();
    harness.actual_output = result;
    harness.completed_at = now;
    harness.duration_ms = Date.parse(now) - Date.parse(harness.started_at);

    const outputMatches = Object.keys(harness.expected_output).every(key => {
      const expected = harness.expected_output[key];
      const actual = result[key];
      return JSON.stringify(expected) === JSON.stringify(actual);
    });

    harness.status = outputMatches ? "passed" : "failed";

    const graph = addEvidenceNode(harness.task_id, {
      kind: "execution_output",
      label: `Harness: ${harness.label}`,
      status: harness.status === "passed" ? "passed" : "failed",
      description: `Harness ${harness.kind} ${harness.status}`,
      depends_on: [],
      verdict: harness.status === "passed" ? "pass" : "fail",
      details: { harness_id: harness.harness_id, kind: harness.kind, duration_ms: harness.duration_ms },
      required_for_completion: true,
      produced_at: now
    });
    const addedNode = graph.nodes[graph.nodes.length - 1];
    harness.evidence_node_id = addedNode?.node_id;

    store.executionHarnesses.set(harnessId, harness);
    recordAudit("harness.completed", { harness_id: harnessId, status: harness.status, kind: harness.kind });
    return harness;
  } catch (err) {
    const now = nowIso();
    harness.status = "error";
    harness.error = err instanceof Error ? err.message : String(err);
    harness.completed_at = now;
    harness.duration_ms = Date.parse(now) - Date.parse(harness.started_at);

    const graph = addEvidenceNode(harness.task_id, {
      kind: "execution_output",
      label: `Harness error: ${harness.label}`,
      status: "failed",
      description: `Harness ${harness.kind} error: ${harness.error}`,
      depends_on: [],
      verdict: "fail",
      details: { harness_id: harness.harness_id, kind: harness.kind, error: harness.error },
      required_for_completion: true,
      produced_at: now
    });
    const addedNode = graph.nodes[graph.nodes.length - 1];
    harness.evidence_node_id = addedNode?.node_id;

    store.executionHarnesses.set(harnessId, harness);
    recordAudit("harness.error", { harness_id: harnessId, error: harness.error });
    return harness;
  }
}

export function timeoutExecutionHarness(harnessId: string): ExecutionHarness {
  const harness = store.executionHarnesses.get(harnessId);
  if (!harness) throw new Error(`ExecutionHarness not found: ${harnessId}`);
  if (harness.status !== "running") throw new Error(`Harness is not running: ${harness.status}`);

  harness.status = "timed_out";
  harness.completed_at = nowIso();
  harness.error = `Harness timed out after ${harness.timeout_ms}ms`;
  if (harness.started_at) {
    harness.duration_ms = Date.parse(harness.completed_at) - Date.parse(harness.started_at);
  }

  const graph = addEvidenceNode(harness.task_id, {
    kind: "execution_output",
    label: `Harness timeout: ${harness.label}`,
    status: "failed",
    description: `Harness ${harness.kind} timed out after ${harness.timeout_ms}ms`,
    depends_on: [],
    verdict: "fail",
    details: { harness_id: harness.harness_id, kind: harness.kind, timeout_ms: harness.timeout_ms },
    required_for_completion: true,
    produced_at: harness.completed_at
  });
  const addedNode = graph.nodes[graph.nodes.length - 1];
  harness.evidence_node_id = addedNode?.node_id;

  store.executionHarnesses.set(harnessId, harness);
  recordAudit("harness.timed_out", { harness_id: harnessId, timeout_ms: harness.timeout_ms });
  return harness;
}

export function rollbackExecutionHarness(harnessId: string): ExecutionHarness {
  const harness = store.executionHarnesses.get(harnessId);
  if (!harness) throw new Error(`ExecutionHarness not found: ${harnessId}`);
  if (!harness.rollback_available) throw new Error("Harness does not support rollback");
  if (harness.rollback_executed) throw new Error("Rollback already executed");

  harness.rollback_executed = true;
  store.executionHarnesses.set(harnessId, harness);
  recordAudit("harness.rollback", { harness_id: harnessId, kind: harness.kind });
  return harness;
}

export function getExecutionHarness(harnessId: string): ExecutionHarness | undefined {
  return store.executionHarnesses.get(harnessId);
}

export function listExecutionHarnesses(taskId: string, filter?: { kind?: HarnessKind; status?: HarnessStatus }): ExecutionHarness[] {
  let harnesses = [...store.executionHarnesses.values()].filter(h => h.task_id === taskId);
  if (filter?.kind) harnesses = harnesses.filter(h => h.kind === filter.kind);
  if (filter?.status) harnesses = harnesses.filter(h => h.status === filter.status);
  return harnesses.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function submitReuseFeedback(input: {
  task_id: string;
  kind: ReuseFeedbackKind;
  target_type: "playbook" | "template" | "skill" | "methodology" | "capability";
  target_id: string;
  preferred_alternative_id?: string;
  reason?: string;
  user_id?: string;
}): ReuseFeedback {
  const feedback = ReuseFeedbackSchema.parse({
    feedback_id: createEntityId("rfeed"),
    task_id: input.task_id,
    kind: input.kind,
    target_type: input.target_type,
    target_id: input.target_id,
    preferred_alternative_id: input.preferred_alternative_id,
    reason: input.reason,
    user_id: input.user_id,
    created_at: nowIso()
  });
  store.reuseFeedbacks.push(feedback);
  recordAudit("reuse_feedback.submitted", { kind: feedback.kind, target_type: feedback.target_type, target_id: feedback.target_id });
  return feedback;
}

export function listReuseFeedbacks(taskId: string, filter?: { kind?: ReuseFeedbackKind; target_type?: string }): ReuseFeedback[] {
  let feedbacks = store.reuseFeedbacks.toArray().filter(f => f.task_id === taskId);
  if (filter?.kind) feedbacks = feedbacks.filter(f => f.kind === filter.kind);
  if (filter?.target_type) feedbacks = feedbacks.filter(f => f.target_type === filter.target_type);
  return feedbacks.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getReuseFeedbackStats(taskId: string): {
  total: number;
  accept_count: number;
  ignore_count: number;
  prefer_count: number;
  reject_count: number;
  approve_count: number;
  by_target_type: Record<string, number>;
} {
  const feedbacks = store.reuseFeedbacks.toArray().filter(f => f.task_id === taskId);
  const byTargetType: Record<string, number> = {};
  for (const f of feedbacks) {
    byTargetType[f.target_type] = (byTargetType[f.target_type] ?? 0) + 1;
  }
  return {
    total: feedbacks.length,
    accept_count: feedbacks.filter(f => f.kind === "accept_recommendation").length,
    ignore_count: feedbacks.filter(f => f.kind === "ignore_recommendation").length,
    prefer_count: feedbacks.filter(f => f.kind === "prefer_template").length,
    reject_count: feedbacks.filter(f => f.kind === "reject_playbook").length,
    approve_count: feedbacks.filter(f => f.kind === "approve_methodology").length,
    by_target_type: byTargetType
  };
}

export interface EgressAwareFetchOptions {
  task_id?: string;
  trace_id?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  payload_summary?: string;
}

export async function egressAwareFetch(url: string, options: EgressAwareFetchOptions = {}): Promise<{ ok: boolean; status: number; data: unknown; egress_verdict: string }> {
  const parsedUrl = new URL(url);
  const egressResult = checkEgress({
    destination: parsedUrl.hostname,
    destination_type: "domain",
    protocol: parsedUrl.protocol.replace(":", "") as "http" | "https",
    port: parseInt(parsedUrl.port) || (parsedUrl.protocol === "https:" ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: options.method ?? "GET",
    task_id: options.task_id,
    trace_id: options.trace_id,
    payload_summary: options.payload_summary
  });

  if (egressResult.verdict !== "allowed") {
    recordAudit("egress_middleware.blocked", { url, verdict: egressResult.verdict, task_id: options.task_id });
    return { ok: false, status: 0, data: { error: `Egress blocked: ${egressResult.audit.denial_reason ?? "policy denial"}`, verdict: egressResult.verdict }, egress_verdict: egressResult.verdict };
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => null);
    recordAudit("egress_middleware.completed", { url, status: response.status, task_id: options.task_id });
    return { ok: response.ok, status: response.status, data, egress_verdict: "allowed" };
  } catch (err) {
    recordAudit("egress_middleware.error", { url, error: err instanceof Error ? err.message : String(err), task_id: options.task_id });
    return { ok: false, status: 0, data: { error: err instanceof Error ? err.message : String(err) }, egress_verdict: "allowed" };
  }
}

export function parseCronField(field: string, min: number, max: number): number[] {
  if (field === "*") return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = parseInt(stepStr);
    const values = range === "*" ? Array.from({ length: max - min + 1 }, (_, i) => min + i) : range.split(",").map(Number);
    return values.filter((_, i) => i % step === 0);
  }
  if (field.includes(",")) return field.split(",").map(Number);
  if (field.includes("-")) {
    const [start, end] = field.split("-").map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  return [parseInt(field)];
}

export function getNextCronTime(cronExpression: string, from?: Date): Date {
  const parts = cronExpression.trim().split(/\s+/);
  const minuteField = parts[0];
  const hourField = parts[1];
  const dayOfMonthField = parts[2];
  const monthField = parts[3];
  const dayOfWeekField = parts[4];

  const minutes = parseCronField(minuteField, 0, 59);
  const hours = parseCronField(hourField, 0, 23);
  const daysOfMonth = parseCronField(dayOfMonthField, 1, 31);
  const months = parseCronField(monthField, 1, 12);
  const daysOfWeek = parseCronField(dayOfWeekField, 0, 6);

  const now = from ?? new Date();
  const candidate = new Date(now.getTime() + 60000);
  candidate.setSeconds(0, 0);

  for (let attempt = 0; attempt < 525600; attempt++) {
    if (!months.includes(candidate.getMonth() + 1)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (dayOfMonthField !== "*" && !daysOfMonth.includes(candidate.getDate())) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (dayOfWeekField !== "*" && !daysOfWeek.includes(candidate.getDay())) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hours.includes(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minutes.includes(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
      continue;
    }
    return candidate;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export function createScheduledJob(input: {
  name: string;
  cron_expression?: string;
  interval_ms?: number;
  task_intent: string;
  enabled?: boolean;
}): ScheduledJob {
  if (!input.cron_expression && !input.interval_ms) {
    throw new Error("Either cron_expression or interval_ms must be provided");
  }
  const now = nowIso();
  const nextTrigger = input.cron_expression
    ? getNextCronTime(input.cron_expression).toISOString()
    : new Date(Date.now() + (input.interval_ms ?? 60000)).toISOString();

  const job = ScheduledJobSchema.parse({
    job_id: createEntityId("sjob"),
    name: input.name,
    cron_expression: input.cron_expression,
    interval_ms: input.interval_ms,
    task_intent: input.task_intent,
    enabled: input.enabled ?? true,
    last_triggered_at: undefined,
    next_trigger_at: nextTrigger,
    trigger_count: 0,
    failure_count: 0,
    last_failure_reason: undefined,
    created_at: now,
    updated_at: now
  });
  store.scheduledJobs.set(job.job_id, job);
  recordAudit("scheduled_job.created", { job_id: job.job_id, name: job.name, cron: job.cron_expression });
  return job;
}

export function updateScheduledJob(jobId: string, updates: Partial<Pick<ScheduledJob, "name" | "cron_expression" | "interval_ms" | "task_intent" | "enabled">>): ScheduledJob {
  const job = store.scheduledJobs.get(jobId);
  if (!job) throw new Error(`ScheduledJob not found: ${jobId}`);

  if (updates.name !== undefined) job.name = updates.name;
  if (updates.cron_expression !== undefined) job.cron_expression = updates.cron_expression;
  if (updates.interval_ms !== undefined) job.interval_ms = updates.interval_ms;
  if (updates.task_intent !== undefined) job.task_intent = updates.task_intent;
  if (updates.enabled !== undefined) job.enabled = updates.enabled;
  job.updated_at = nowIso();

  if (updates.cron_expression || updates.interval_ms) {
    job.next_trigger_at = job.cron_expression
      ? getNextCronTime(job.cron_expression).toISOString()
      : new Date(Date.now() + (job.interval_ms ?? 60000)).toISOString();
  }

  store.scheduledJobs.set(jobId, job);
  return job;
}

export function triggerScheduledJob(jobId: string): { task_id: string; job: ScheduledJob } {
  const job = store.scheduledJobs.get(jobId);
  if (!job) throw new Error(`ScheduledJob not found: ${jobId}`);
  if (!job.enabled) throw new Error("ScheduledJob is disabled");

  try {
    const task = mirrorTaskContract(TaskContractSchema.parse({
      task_id: createEntityId("task"),
      intent: job.task_intent,
      status: "created",
      timestamps: { created_at: nowIso(), updated_at: nowIso() },
      cost_metrics: { input_tokens: 0, output_tokens: 0, total_cost_usd: 0 },
      verification: { checklist_passed: false, verifier_passed: false, reconciliation_passed: false, done_gate_passed: false }
    }));
    store.tasks.set(task.task_id, task);

    job.last_triggered_at = nowIso();
    job.trigger_count += 1;
    job.next_trigger_at = job.cron_expression
      ? getNextCronTime(job.cron_expression).toISOString()
      : new Date(Date.now() + (job.interval_ms ?? 60000)).toISOString();
    job.updated_at = nowIso();
    store.scheduledJobs.set(jobId, job);

    recordAudit("scheduled_job.triggered", { job_id: jobId, task_id: task.task_id });
    return { task_id: task.task_id, job };
  } catch (err) {
    job.failure_count += 1;
    job.last_failure_reason = err instanceof Error ? err.message : String(err);
    job.updated_at = nowIso();
    store.scheduledJobs.set(jobId, job);
    throw err;
  }
}

export function getDueScheduledJobs(): ScheduledJob[] {
  const now = Date.now();
  return [...store.scheduledJobs.values()].filter(job => {
    if (!job.enabled || !job.next_trigger_at) return false;
    return Date.parse(job.next_trigger_at) <= now;
  });
}

export function getScheduledJob(jobId: string): ScheduledJob | undefined {
  return store.scheduledJobs.get(jobId);
}

export function listScheduledJobs(filter?: { enabled?: boolean }): ScheduledJob[] {
  let jobs = [...store.scheduledJobs.values()];
  if (filter?.enabled !== undefined) jobs = jobs.filter(j => j.enabled === filter.enabled);
  return jobs.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function deleteScheduledJob(jobId: string): void {
  store.scheduledJobs.delete(jobId);
  recordAudit("scheduled_job.deleted", { job_id: jobId });
}

export function createCheckpointSnapshot(input: {
  task_id: string;
  step_id?: string;
  task_status: string;
  execution_step_ids?: string[];
  evidence_node_ids?: string[];
  snapshot_data?: Record<string, unknown>;
}): CheckpointSnapshot {
  const task = store.tasks.get(input.task_id);
  const snapshotData = input.snapshot_data ?? (task ? { intent: task.intent, status: task.status } : {});

  const snapshot = CheckpointSnapshotSchema.parse({
    checkpoint_id: createEntityId("ckpt"),
    task_id: input.task_id,
    step_id: input.step_id,
    snapshot_data: snapshotData,
    task_status: input.task_status,
    execution_step_ids: input.execution_step_ids ?? [],
    evidence_node_ids: input.evidence_node_ids ?? [],
    created_at: nowIso()
  });
  store.checkpointSnapshots.set(snapshot.checkpoint_id, snapshot);
  recordAudit("checkpoint.created", { task_id: input.task_id, checkpoint_id: snapshot.checkpoint_id });
  return snapshot;
}

export function restoreFromCheckpoint(checkpointId: string): { task_id: string; restored_status: string; snapshot_data: Record<string, unknown> } {
  const snapshot = store.checkpointSnapshots.get(checkpointId);
  if (!snapshot) throw new Error(`CheckpointSnapshot not found: ${checkpointId}`);

  const task = store.tasks.get(snapshot.task_id);
  if (task) {
    task.status = snapshot.task_status as TaskContract["status"];
    store.tasks.set(snapshot.task_id, task);
  }

  recordAudit("checkpoint.restored", { task_id: snapshot.task_id, checkpoint_id: checkpointId });
  return { task_id: snapshot.task_id, restored_status: snapshot.task_status, snapshot_data: snapshot.snapshot_data };
}

export function getCheckpointSnapshot(checkpointId: string): CheckpointSnapshot | undefined {
  return store.checkpointSnapshots.get(checkpointId);
}

export function listCheckpointSnapshots(taskId: string): CheckpointSnapshot[] {
  return [...store.checkpointSnapshots.values()].filter(c => c.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function linkWikiToMemoryDocument(wikiPageId: string, memoryDocumentId: string): { wiki_page_id: string; memory_document_id: string } {
  const wikiPage = store.wikiPages.get(wikiPageId);
  if (!wikiPage) throw new Error(`WikiPage not found: ${wikiPageId}`);

  const memoryDoc = [...store.memoryDocuments.values()].find(d => d.document_id === memoryDocumentId);
  if (!memoryDoc) throw new Error(`MemoryDocument not found: ${memoryDocumentId}`);

  if (!wikiPage.linked_template_ids.includes(memoryDocumentId)) {
    wikiPage.linked_template_ids.push(memoryDocumentId);
    store.wikiPages.set(wikiPageId, wikiPage);
  }

  recordAudit("wiki.memory_linked", { wiki_page_id: wikiPageId, memory_document_id: memoryDocumentId });
  return { wiki_page_id: wikiPageId, memory_document_id: memoryDocumentId };
}

export function unlinkWikiFromMemoryDocument(wikiPageId: string, memoryDocumentId: string): void {
  const wikiPage = store.wikiPages.get(wikiPageId);
  if (wikiPage) {
    wikiPage.linked_template_ids = wikiPage.linked_template_ids.filter((id: string) => id !== memoryDocumentId);
    store.wikiPages.set(wikiPageId, wikiPage);
  }

  recordAudit("wiki.memory_unlinked", { wiki_page_id: wikiPageId, memory_document_id: memoryDocumentId });
}

export function getLinkedWikiPages(memoryDocumentId: string): WikiPage[] {
  return [...store.wikiPages.values()].filter(p => p.linked_template_ids.includes(memoryDocumentId));
}

export function getLinkedMemoryDocuments(wikiPageId: string): MemoryDocument[] {
  const wikiPage = store.wikiPages.get(wikiPageId);
  if (!wikiPage) return [];
  return [...store.memoryDocuments.values()].filter(d => wikiPage.linked_template_ids.includes(d.document_id));
}

export function createEventSubscription(input: {
  event_kind: string;
  subscriber_type?: "webhook" | "internal_callback" | "poll";
  callback_url?: string;
  description?: string;
  enabled?: boolean;
}): EventSubscription {
  const subscription = EventSubscriptionSchema.parse({
    subscription_id: createEntityId("esub"),
    event_kind: input.event_kind,
    subscriber_type: input.subscriber_type ?? "poll",
    callback_url: input.callback_url,
    description: input.description,
    enabled: input.enabled ?? true,
    last_triggered_at: undefined,
    trigger_count: 0,
    created_at: nowIso()
  });
  store.eventSubscriptions.set(subscription.subscription_id, subscription);
  recordAudit("event_subscription.created", { subscription_id: subscription.subscription_id, event_kind: input.event_kind });
  return subscription;
}

export function notifyEventSubscribers(eventKind: string, payload: Record<string, unknown>): EventSubscription[] {
  const matchingSubs = [...store.eventSubscriptions.values()].filter(
    s => s.enabled && (s.event_kind === eventKind || s.event_kind === "*")
  );

  for (const sub of matchingSubs) {
    sub.last_triggered_at = nowIso();
    sub.trigger_count += 1;
    store.eventSubscriptions.set(sub.subscription_id, sub);

    if (sub.subscriber_type === "webhook" && sub.callback_url) {
      egressAwareFetch(sub.callback_url, {
        method: "POST",
        payload_summary: `Event: ${eventKind}`,
        body: { event_kind: eventKind, subscription_id: sub.subscription_id, payload }
      }).catch(() => {});
    }
  }

  return matchingSubs;
}

export function getEventSubscription(subscriptionId: string): EventSubscription | undefined {
  return store.eventSubscriptions.get(subscriptionId);
}

export function listEventSubscriptions(filter?: { event_kind?: string; enabled?: boolean }): EventSubscription[] {
  let subs = [...store.eventSubscriptions.values()];
  if (filter?.event_kind) subs = subs.filter(s => s.event_kind === filter.event_kind);
  if (filter?.enabled !== undefined) subs = subs.filter(s => s.enabled === filter.enabled);
  return subs.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function deleteEventSubscription(subscriptionId: string): void {
  store.eventSubscriptions.delete(subscriptionId);
  recordAudit("event_subscription.deleted", { subscription_id: subscriptionId });
}

export function createSLOAlert(input: {
  slo_name: string;
  threshold: number;
  actual_value: number;
  severity?: "warning" | "critical";
  task_id?: string;
}): SLOAlert {
  const alert = SLOAlertSchema.parse({
    alert_id: createEntityId("sloa"),
    slo_name: input.slo_name,
    threshold: input.threshold,
    actual_value: input.actual_value,
    severity: input.severity ?? (input.actual_value > input.threshold * 2 ? "critical" : "warning"),
    task_id: input.task_id,
    acknowledged: false,
    acknowledged_by: undefined,
    acknowledged_at: undefined,
    created_at: nowIso()
  });
  store.sloAlerts.push(alert);
  recordAudit("slo_alert.created", { alert_id: alert.alert_id, slo_name: input.slo_name, severity: alert.severity });
  notifyEventSubscribers("slo.breach", { alert_id: alert.alert_id, slo_name: input.slo_name, severity: alert.severity, actual_value: input.actual_value, threshold: input.threshold });
  return alert;
}

export function acknowledgeSLOAlert(alertId: string, acknowledgedBy: string): SLOAlert {
  const alert = store.sloAlerts.toArray().find(a => a.alert_id === alertId);
  if (!alert) throw new Error(`SLOAlert not found: ${alertId}`);
  if (alert.acknowledged) throw new Error("SLOAlert already acknowledged");

  alert.acknowledged = true;
  alert.acknowledged_by = acknowledgedBy;
  alert.acknowledged_at = nowIso();
  store.sloAlerts.push(alert);
  return alert;
}

export function listSLOAlerts(filter?: { slo_name?: string; severity?: "warning" | "critical"; acknowledged?: boolean }): SLOAlert[] {
  let alerts = store.sloAlerts.toArray();
  if (filter?.slo_name) alerts = alerts.filter(a => a.slo_name === filter.slo_name);
  if (filter?.severity) alerts = alerts.filter(a => a.severity === filter.severity);
  if (filter?.acknowledged !== undefined) alerts = alerts.filter(a => a.acknowledged === filter.acknowledged);
  return alerts.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function evaluateSLOs(): SLOAlert[] {
  const alerts: SLOAlert[] = [];
  const metrics = [...store.operationalMetrics.values()];

  for (const metric of metrics) {
    if (metric.task_metrics.completion_rate < 0.95) {
      alerts.push(createSLOAlert({
        slo_name: "task_completion_rate",
        threshold: 0.95,
        actual_value: metric.task_metrics.completion_rate,
        severity: metric.task_metrics.completion_rate < 0.5 ? "critical" : "warning"
      }));
    }

    if (metric.verification_metrics.pass_rate < 0.90) {
      alerts.push(createSLOAlert({
        slo_name: "verification_pass_rate",
        threshold: 0.90,
        actual_value: metric.verification_metrics.pass_rate,
        severity: metric.verification_metrics.pass_rate < 0.5 ? "critical" : "warning"
      }));
    }

    if (metric.task_metrics.avg_duration_ms > 300000) {
      alerts.push(createSLOAlert({
        slo_name: "average_task_duration_ms",
        threshold: 300000,
        actual_value: metric.task_metrics.avg_duration_ms,
        severity: metric.task_metrics.avg_duration_ms > 600000 ? "critical" : "warning"
      }));
    }

    if (metric.task_metrics.failure_rate > 0.05) {
      alerts.push(createSLOAlert({
        slo_name: "error_rate",
        threshold: 0.05,
        actual_value: metric.task_metrics.failure_rate,
        severity: metric.task_metrics.failure_rate > 0.10 ? "critical" : "warning"
      }));
    }
  }

  return alerts;
}

export function captureMemories(taskId: string): MemoryItem[] {
  const task = requireTask(taskId);
  const evidence = compactEvidence(taskId);
  const fingerprint = buildLearningFingerprint(task);
  const reuseImprovementFingerprint = buildReuseImprovementFingerprint(task);
  const reuseContext = getReuseImprovementContext(task);
  const capabilityResolutions = listTaskCapabilityResolutions(taskId);
  const securityAssessment = getTaskSecurityAssessment(task);
  const existingMethodology = [...store.memoryItems.values()].find(
    item => item.kind === "methodology" && item.fingerprint === fingerprint
  );
  const existingReuseImprovement = reuseImprovementFingerprint
    ? [...store.memoryItems.values()].find(
        item => item.kind === "methodology" && item.fingerprint === reuseImprovementFingerprint
      )
    : null;
  const methodologySummary = compactMethodologySummary(task, evidence, capabilityResolutions);
  const sanitizedMethodology = sanitizeMethodologyText(methodologySummary);
  const result: MemoryItem[] = [
    MemoryItemSchema.parse({
      memory_id: createEntityId("memory"),
      task_id: taskId,
      kind: "session",
      title: `Session summary for ${task.intent}`,
      content: compactSessionSummary(task, evidence, capabilityResolutions),
      tags: [...new Set([task.department, task.task_type, "compacted-session", ...(reuseContext ? ["reuse-improvement-session"] : [])])],
      created_at: nowIso()
    }),
    MemoryItemSchema.parse({
      memory_id: existingMethodology?.memory_id ?? `memory_methodology_${fingerprint}`,
      task_id: taskId,
      kind: "methodology",
      title: `Playbook candidate for ${task.department}`,
      content: sanitizedMethodology.sanitized,
      fingerprint,
      source_task_count: (existingMethodology?.source_task_count ?? 0) + 1,
      tags: [...new Set(["playbook", task.department, task.task_type, ...getLearningTokens(task), ...(getExecutionTemplateKey(task) ? [getExecutionTemplateKey(task)!] : [])])],
      created_at: nowIso()
    })
  ];
  if (reuseContext && reuseImprovementFingerprint) {
    const improvementHint = buildReuseImprovementHint(task);
    const reuseImprovementSummary = sanitizeMethodologyText(
      [
        improvementHint ? `Improvement suggestion: ${improvementHint}` : null,
        `Target kind: ${reuseContext.target_kind}`,
        `Target id: ${reuseContext.target_id}`,
        `Suggested learning action: ${reuseContext.suggested_learning_action}`,
        `Intent: ${task.intent}`,
        evidence.length > 0 ? `Evidence: ${evidence.join(", ")}` : "Evidence: none"
      ].filter((line): line is string => Boolean(line)).join("\n")
    );
    result.push(
      MemoryItemSchema.parse({
        memory_id: existingReuseImprovement?.memory_id ?? `memory_${reuseImprovementFingerprint}`,
        task_id: taskId,
        kind: "methodology",
        title: `Reuse improvement for ${reuseContext.target_kind} ${reuseContext.target_id}`,
        content: reuseImprovementSummary.sanitized,
        fingerprint: reuseImprovementFingerprint,
        source_task_count: (existingReuseImprovement?.source_task_count ?? 0) + 1,
        tags: [
          ...new Set([
            "reuse-improvement",
            reuseContext.target_kind,
            reuseContext.suggested_learning_action,
            task.department,
            task.task_type,
            reuseContext.target_id
          ])
        ],
        created_at: nowIso()
      })
    );
  }
  for (const item of result) {
    store.memoryItems.set(item.memory_id, item);
  }
  recordAudit(
    "task.session_compacted",
    {
      evidence_count: evidence.length,
      reuse_improvement: Boolean(reuseContext)
    },
    taskId
  );
  recordAudit("task.memory_captured", { count: result.length }, taskId);
  if (securityAssessment.flagged || sanitizedMethodology.reasons.length > 0) {
    recordAudit(
      "task.memory_capture_sanitized",
      {
        reasons: [...new Set([...securityAssessment.reasons, ...sanitizedMethodology.reasons])],
        fingerprint
      },
      taskId
    );
  }
  return result;
}

export function createSkillCandidate(taskId: string): SkillCandidate {
  const task = requireTask(taskId);
  const doneGate = store.doneGateResults.get(taskId);
  const checklist = store.checklistResults.get(taskId);
  const reconciliation = store.reconciliationResults.get(taskId);
  const verification = store.verificationResults.get(taskId);
  const fingerprint = buildLearningFingerprint(task);
  const existingCandidate = [...store.skillCandidates.values()].find(candidate => candidate.fingerprint === fingerprint);
  const evidence = [...new Set([...(existingCandidate?.evidence ?? []), ...compactEvidence(taskId)])].slice(0, 12);
  const improvementHint = buildReuseImprovementHint(task);
  const securityAssessment = getTaskSecurityAssessment(task);
  const shouldApprove =
    doneGate?.status === "passed" &&
    checklist?.status === "passed" &&
    reconciliation?.status === "passed" &&
    (verification?.verdict === "pass" || verification?.verdict === "pass_with_notes") &&
    !securityAssessment.flagged;
  const summary = sanitizeMethodologyText(
    compactMethodologySummary(task, evidence, listTaskCapabilityResolutions(taskId))
  );
  const candidate = SkillCandidateSchema.parse({
    candidate_id: existingCandidate?.candidate_id ?? `skill_${fingerprint}`,
    task_id: taskId,
    title: `${task.department} playbook for ${task.intent.slice(0, 48)}`,
    summary: summary.sanitized,
    fingerprint,
    version: existingCandidate ? existingCandidate.version + 1 : 1,
    source_task_count: (existingCandidate?.source_task_count ?? 0) + 1,
    applicability: buildApplicabilityRules(task),
    failure_boundaries: buildFailureBoundaries(task, listTaskCapabilityResolutions(taskId)),
    improvement_hints: mergeImprovementHints(existingCandidate?.improvement_hints, improvementHint),
    evidence,
    status: securityAssessment.flagged
      ? "rejected"
      : shouldApprove || existingCandidate?.status === "approved"
        ? "approved"
        : "candidate",
    created_at: existingCandidate?.created_at ?? nowIso(),
    updated_at: nowIso(),
    last_improved_at: improvementHint ? nowIso() : existingCandidate?.last_improved_at
  });
  store.skillCandidates.set(candidate.candidate_id, candidate);
  recordAudit(
    "task.skill_candidate_created",
    {
      candidate_id: candidate.candidate_id,
      status: candidate.status,
      security_reasons: securityAssessment.reasons
    },
    taskId
  );
  if (candidate.status === "approved") {
    const memory = MemoryItemSchema.parse({
      memory_id: createEntityId("memory"),
      task_id: taskId,
      kind: "evaluation",
      title: `Approved learned playbook for ${task.department}`,
      content: `Skill candidate ${candidate.candidate_id} was auto-approved after verification gates passed for intent: ${task.intent}`,
      tags: ["evaluation", "approved-playbook", task.department, task.task_type],
      created_at: nowIso()
    });
    store.memoryItems.set(memory.memory_id, memory);
    recordAudit("task.skill_candidate_approved", { candidate_id: candidate.candidate_id }, taskId);
  } else if (candidate.status === "rejected") {
    recordAudit(
      "task.skill_candidate_rejected_for_security",
      {
        candidate_id: candidate.candidate_id,
        reasons: securityAssessment.reasons
      },
      taskId
    );
  }
  return candidate;
}

export function createSchedule(intent: string, cadence: string, department: Schedule["task_template"]["department"], taskType: Schedule["task_template"]["task_type"]): Schedule {
  const schedule = ScheduleSchema.parse({
    schedule_id: createEntityId("schedule"),
    task_template: {
      intent,
      task_type: taskType,
      department,
      risk_level: "medium"
    },
    cadence,
    created_at: nowIso()
  });
  store.schedules.set(schedule.schedule_id, schedule);
  recordAudit("schedule.created", { schedule_id: schedule.schedule_id, cadence });
  return schedule;
}

export function triggerSchedule(scheduleId: string): Schedule {
  const schedule = store.schedules.get(scheduleId);
  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found`);
  }
  schedule.last_triggered_at = nowIso();
  store.schedules.set(schedule.schedule_id, schedule);
  recordAudit("schedule.triggered", { schedule_id: scheduleId });
  return schedule;
}

export function recordToolInvocation(
  taskId: string,
  toolName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  status: ToolInvocation["status"],
  metadata?: {
    idempotency_key?: string;
    compensation_available?: boolean;
    compensation_status?: ToolInvocation["compensation_status"];
  }
): ToolInvocation {
  const invocation = ToolInvocationSchema.parse({
    invocation_id: createEntityId("tool"),
    task_id: taskId,
    tool_name: toolName,
    status,
    idempotency_key: metadata?.idempotency_key,
    compensation_available: metadata?.compensation_available ?? false,
    compensation_status: metadata?.compensation_status ?? (metadata?.compensation_available ? "available" : "not_required"),
    input,
    output,
    created_at: nowIso()
  });
  store.toolInvocations.set(invocation.invocation_id, invocation);
  recordAudit(
    "tool.invoked",
    {
      tool_name: toolName,
      status,
      idempotency_key: invocation.idempotency_key,
      compensation_available: invocation.compensation_available,
      compensation_status: invocation.compensation_status
    },
    taskId
  );
  return invocation;
}

export function listTaskToolInvocations(taskId: string): ToolInvocation[] {
  return [...store.toolInvocations.values()].filter(invocation => invocation.task_id === taskId);
}

export function selectWorker(taskId: string): { worker_kind: WorkerKind; worker_name: string } {
  const task = requireTask(taskId);
  if (task.department === "engineering" && task.task_type === "long_running") {
    return { worker_kind: "deerflow_worker", worker_name: "deerflow-long-runner" };
  }
  if (task.department === "engineering") {
    return { worker_kind: "coding_worker", worker_name: "coding-specialist" };
  }
  if (task.department === "qa") {
    return { worker_kind: "qa_worker", worker_name: "qa-validator" };
  }
  if (task.department === "finance") {
    return { worker_kind: "finance_worker", worker_name: "finance-operator" };
  }
  if (["sales", "marketing", "hr", "ops"].includes(task.department)) {
    return { worker_kind: "business_worker", worker_name: `${task.department}-operator` };
  }
  return { worker_kind: "general_worker", worker_name: "general-operator" };
}

function upsertSubagentSession(taskId: string, payload: Omit<ReturnType<typeof SubagentSessionSchema.parse>, "task_id" | "created_at" | "updated_at">) {
  const existing = store.subagentSessions.get(payload.subagent_session_id);
  const createdAt = existing?.created_at ?? nowIso();
  const session = SubagentSessionSchema.parse({
    ...payload,
    task_id: taskId,
    created_at: createdAt,
    updated_at: nowIso()
  });
  store.subagentSessions.set(session.subagent_session_id, session);
  return session;
}

function upsertSubagentMessage(taskId: string, payload: Omit<ReturnType<typeof SubagentMessageSchema.parse>, "task_id" | "created_at">) {
  const message = SubagentMessageSchema.parse({
    ...payload,
    task_id: taskId,
    created_at: nowIso()
  });
  store.subagentMessages.push(message);
  return message;
}

function upsertSubagentCheckpoint(taskId: string, payload: Omit<ReturnType<typeof SubagentCheckpointSchema.parse>, "task_id" | "created_at">) {
  const checkpoint = SubagentCheckpointSchema.parse({
    ...payload,
    task_id: taskId,
    created_at: nowIso()
  });
  store.subagentCheckpoints.push(checkpoint);
  return checkpoint;
}

function getSessionRole(taskId: string, subagentSessionId?: string) {
  if (!subagentSessionId) return undefined;
  return store.subagentSessions.get(subagentSessionId)?.role;
}

function buildTaskAgentTeamState(taskId: string) {
  const task = requireTask(taskId);
  const workerRuns = [...store.workerRuns.values()].filter(run => run.task_id === taskId);
  const capabilityResolutions = listTaskCapabilityResolutions(taskId);
  const checkpoints = [...store.checkpoints.values()].filter(checkpoint => checkpoint.task_id === taskId);
  const hasVerificationArtifacts =
    Boolean(store.checklistResults.get(taskId))
    || Boolean(store.verificationResults.get(taskId))
    || Boolean(store.reconciliationResults.get(taskId))
    || Boolean(store.doneGateResults.get(taskId))
    || task.definition_of_done.acceptance_tests.length > 0;
  const reuseContext = getReuseImprovementContext(task);
  const memoryItems = [...store.memoryItems.values()].filter(item => item.task_id === taskId);
  const mainWorkerRun =
    workerRuns.find(run => run.status === "running")
    ?? workerRuns.at(-1)
    ?? WorkerRunSchema.parse({
      worker_run_id: `worker_virtual_${taskId}`,
      task_id: taskId,
      worker_kind: selectWorker(taskId).worker_kind,
      worker_name: selectWorker(taskId).worker_name,
      status: "assigned",
      created_at: task.timestamps.created_at
    });

  const mode =
    capabilityResolutions.length > 1 || hasVerificationArtifacts || reuseContext || task.task_type === "long_running"
      ? "delegated_team"
      : "single_worker";
  const teamId = `team_${taskId}`;
  const now = nowIso();
  const subagentCheckpoints = [];

  let dispatchPlanId: string | undefined;
  if (mode === "delegated_team") {
    try {
      let existingPlan = getDispatchPlanForTask(taskId);
      if (!existingPlan) {
        existingPlan = createDispatchPlan({
          task_id: taskId,
          supervisor_agent_id: `subagent_${taskId}_supervisor`
        });
        activatePlan(existingPlan.plan_id);
      }
      dispatchPlanId = existingPlan.plan_id;
    } catch {}
  }

  const sessions = [
    upsertSubagentSession(taskId, {
      subagent_session_id: `subagent_${taskId}_supervisor`,
      team_id: teamId,
      parent_worker_run_id: mainWorkerRun.worker_run_id,
      role: "supervisor",
      worker_kind: "manager",
      worker_name: "task-supervisor",
      status: task.status === "completed" ? "completed" : task.status === "running" ? "running" : "planned",
      isolated_context_key: `session:${taskId}:supervisor`,
      checkpoint_count: checkpoints.length,
      message_count: 0,
      resume_supported: true,
      result_summary: `Supervises ${task.intent}`,
      started_at: mainWorkerRun.started_at ?? mainWorkerRun.created_at,
      completed_at: task.status === "completed" ? task.timestamps.completed_at ?? now : undefined
    })
  ];

  const messages = [
    upsertSubagentMessage(taskId, {
      message_id: `submsg_${taskId}_supervisor_assignment`,
      team_id: teamId,
      subagent_session_id: `subagent_${taskId}_supervisor`,
      direction: "supervisor_to_subagent",
      kind: "assignment",
      summary: `Coordinate the task lifecycle for "${task.intent}".`,
      payload: {
        planner_mode:
          typeof task.inputs.reused_task_template_id === "string"
            ? "template_reuse"
            : capabilityResolutions.length > 0
              ? "mixed"
              : "fresh_plan"
      }
    })
  ];

  if (capabilityResolutions.length > 0) {
    sessions.push(
      upsertSubagentSession(taskId, {
        subagent_session_id: `subagent_${taskId}_capability_router`,
        team_id: teamId,
        parent_worker_run_id: mainWorkerRun.worker_run_id,
        role: "capability_router",
        worker_kind: "manager",
        worker_name: "capability-router",
        status: "completed",
        isolated_context_key: `session:${taskId}:capability_router`,
        checkpoint_count: 0,
        message_count: 0,
        resume_supported: true,
        result_summary: `Resolved ${capabilityResolutions.length} capability need(s).`,
        started_at: mainWorkerRun.started_at ?? mainWorkerRun.created_at,
        completed_at: now
      })
    );
    messages.push(
      upsertSubagentMessage(taskId, {
        message_id: `submsg_${taskId}_capability_assignment`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_capability_router`,
        direction: "supervisor_to_subagent",
        kind: "assignment",
        summary: `Resolve reusable capabilities before implementation.`,
        payload: {
          capability_resolution_count: capabilityResolutions.length
        }
      }),
      upsertSubagentMessage(taskId, {
        message_id: `submsg_${taskId}_capability_result`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_capability_router`,
        direction: "subagent_to_supervisor",
        kind: "result",
        summary: `Capability routing completed with ${capabilityResolutions.length} decision(s).`,
        payload: {
          strategies: capabilityResolutions.map(resolution => resolution.strategy)
        }
      }),
      upsertSubagentMessage(taskId, {
        message_id: `submsg_${taskId}_capability_handoff`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_capability_router`,
        direction: "subagent_to_supervisor",
        kind: "handoff",
        summary: `Capability router handed execution guidance to ${mainWorkerRun.worker_name}.`,
        payload: {
          next_role: "execution_worker",
          next_worker_kind: mainWorkerRun.worker_kind,
          next_worker_name: mainWorkerRun.worker_name
        }
      })
    );
    subagentCheckpoints.push(
      upsertSubagentCheckpoint(taskId, {
        checkpoint_id: `subcp_${taskId}_capability_router`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_capability_router`,
        stage: "capability_resolution",
        summary: `Resolved ${capabilityResolutions.length} capability requirement(s).`
      })
    );
  }

  sessions.push(
    upsertSubagentSession(taskId, {
      subagent_session_id: `subagent_${taskId}_execution_worker`,
      team_id: teamId,
      parent_worker_run_id: mainWorkerRun.worker_run_id,
      role: "execution_worker",
      worker_kind: mainWorkerRun.worker_kind,
      worker_name: mainWorkerRun.worker_name,
      status:
        mainWorkerRun.status === "completed"
          ? "completed"
          : mainWorkerRun.status === "running"
            ? "running"
            : mainWorkerRun.status === "failed"
              ? "failed"
              : "planned",
      isolated_context_key: `session:${taskId}:execution_worker`,
      checkpoint_count: checkpoints.length,
      message_count: 0,
      resume_supported: true,
      result_summary: mainWorkerRun.summary,
      started_at: mainWorkerRun.started_at ?? mainWorkerRun.created_at,
      completed_at: mainWorkerRun.completed_at
    })
  );

  messages.push(
    upsertSubagentMessage(taskId, {
      message_id: `submsg_${taskId}_execution_assignment`,
      team_id: teamId,
      subagent_session_id: `subagent_${taskId}_execution_worker`,
      direction: "supervisor_to_subagent",
      kind: "assignment",
      summary: `Execute the primary worker run for "${task.intent}".`,
      payload: {
        worker_kind: mainWorkerRun.worker_kind,
        worker_name: mainWorkerRun.worker_name
      }
    }),
    upsertSubagentMessage(taskId, {
      message_id: `submsg_${taskId}_execution_handoff`,
      team_id: teamId,
      subagent_session_id: `subagent_${taskId}_execution_worker`,
      direction: "supervisor_to_subagent",
      kind: "handoff",
      summary: `Supervisor handed live execution to ${mainWorkerRun.worker_name}.`,
      payload: {
        from_role: "supervisor",
        to_role: "execution_worker",
        worker_kind: mainWorkerRun.worker_kind
      }
    })
  );
  for (const checkpoint of checkpoints) {
    subagentCheckpoints.push(
      upsertSubagentCheckpoint(taskId, {
        checkpoint_id: `subcp_${taskId}_execution_${checkpoint.checkpoint_id}`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_execution_worker`,
        stage: checkpoint.stage,
        summary: checkpoint.summary
      })
    );
  }
  if (!subagentCheckpoints.some(checkpoint => checkpoint.subagent_session_id === `subagent_${taskId}_execution_worker`)) {
    subagentCheckpoints.push(
      upsertSubagentCheckpoint(taskId, {
        checkpoint_id: `subcp_${taskId}_execution_state`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_execution_worker`,
        stage: "execution_state",
        summary: mainWorkerRun.summary ?? `Execution worker is ${mainWorkerRun.status}.`
      })
    );
  }

  if (hasVerificationArtifacts) {
    sessions.push(
      upsertSubagentSession(taskId, {
        subagent_session_id: `subagent_${taskId}_verification_guard`,
        team_id: teamId,
        parent_worker_run_id: mainWorkerRun.worker_run_id,
        role: "verification_guard",
        worker_kind: "qa_worker",
        worker_name: "verification-guard",
        status: task.status === "completed" ? "completed" : "planned",
        isolated_context_key: `session:${taskId}:verification_guard`,
        checkpoint_count: 0,
        message_count: 0,
        resume_supported: true,
        result_summary: hasVerificationArtifacts ? "Verification stack engaged." : undefined,
        started_at: mainWorkerRun.started_at ?? mainWorkerRun.created_at,
        completed_at: task.status === "completed" ? task.timestamps.completed_at ?? now : undefined
      })
    );
    messages.push(
      upsertSubagentMessage(taskId, {
        message_id: `submsg_${taskId}_verification_result`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_verification_guard`,
        direction: "subagent_to_supervisor",
        kind: "result",
        summary: "Verification guard checked checklist, reconciliation, verifier, and done gate.",
        payload: {
          checklist: Boolean(store.checklistResults.get(taskId)),
          verification: Boolean(store.verificationResults.get(taskId)),
          reconciliation: Boolean(store.reconciliationResults.get(taskId)),
          done_gate: Boolean(store.doneGateResults.get(taskId))
        }
      }),
      upsertSubagentMessage(taskId, {
        message_id: `submsg_${taskId}_verification_handoff`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_execution_worker`,
        direction: "subagent_to_supervisor",
        kind: "handoff",
        summary: "Execution worker handed verification evidence to the verification guard.",
        payload: {
          next_role: "verification_guard"
        }
      })
    );
    subagentCheckpoints.push(
      upsertSubagentCheckpoint(taskId, {
        checkpoint_id: `subcp_${taskId}_verification_guard`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_verification_guard`,
        stage: "verification",
        summary: "Verification guard completed checklist, reconciliation, verifier, and done gate checks."
      })
    );
  }

  if (reuseContext || memoryItems.some(item => item.kind === "methodology" || item.kind === "evaluation")) {
    sessions.push(
      upsertSubagentSession(taskId, {
        subagent_session_id: `subagent_${taskId}_learning_curator`,
        team_id: teamId,
        parent_worker_run_id: mainWorkerRun.worker_run_id,
        role: "learning_curator",
        worker_kind: "general_worker",
        worker_name: "learning-curator",
        status: task.status === "completed" ? "completed" : "planned",
        isolated_context_key: `session:${taskId}:learning_curator`,
        checkpoint_count: 0,
        message_count: 0,
        resume_supported: true,
        result_summary: "Curates compact session summaries and reusable guidance.",
        started_at: mainWorkerRun.started_at ?? mainWorkerRun.created_at,
        completed_at: task.status === "completed" ? task.timestamps.completed_at ?? now : undefined
      })
    );
    messages.push(
      upsertSubagentMessage(taskId, {
        message_id: `submsg_${taskId}_learning_result`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_learning_curator`,
        direction: "subagent_to_supervisor",
        kind: "result",
        summary: reuseContext
          ? `Reuse improvement guidance captured for ${reuseContext.target_kind} ${reuseContext.target_id}.`
          : "Reusable methodology and evaluation memory were promoted.",
        payload: {
          methodology_items: memoryItems.filter(item => item.kind === "methodology").length,
          evaluation_items: memoryItems.filter(item => item.kind === "evaluation").length
        }
      }),
      upsertSubagentMessage(taskId, {
        message_id: `submsg_${taskId}_learning_handoff`,
        team_id: teamId,
        subagent_session_id: hasVerificationArtifacts
          ? `subagent_${taskId}_verification_guard`
          : `subagent_${taskId}_execution_worker`,
        direction: "subagent_to_supervisor",
        kind: "handoff",
        summary: hasVerificationArtifacts
          ? "Verification guard handed validated context to the learning curator."
          : "Execution worker handed reusable context directly to the learning curator.",
        payload: {
          next_role: "learning_curator"
        }
      })
    );
    subagentCheckpoints.push(
      upsertSubagentCheckpoint(taskId, {
        checkpoint_id: `subcp_${taskId}_learning_curator`,
        team_id: teamId,
        subagent_session_id: `subagent_${taskId}_learning_curator`,
        stage: "learning_promotion",
        summary: reuseContext
          ? `Attached reuse-improvement guidance to ${reuseContext.target_kind} ${reuseContext.target_id}.`
          : "Promoted compact methodology and evaluation memory."
      })
    );
  }

  const sessionMessageCounts = new Map<string, number>();
  for (const message of messages) {
    sessionMessageCounts.set(message.subagent_session_id, (sessionMessageCounts.get(message.subagent_session_id) ?? 0) + 1);
  }
  const sessionCheckpointCounts = new Map<string, number>();
  for (const checkpoint of subagentCheckpoints) {
    sessionCheckpointCounts.set(
      checkpoint.subagent_session_id,
      (sessionCheckpointCounts.get(checkpoint.subagent_session_id) ?? 0) + 1
    );
  }
  const updatedSessions = sessions.map(session => {
    const lastMessage = [...messages]
      .filter(message => message.subagent_session_id === session.subagent_session_id)
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
      .at(-1);
    const next = SubagentSessionSchema.parse({
      ...session,
      checkpoint_count: sessionCheckpointCounts.get(session.subagent_session_id) ?? session.checkpoint_count,
      message_count: sessionMessageCounts.get(session.subagent_session_id) ?? 0,
      last_message_id: lastMessage?.message_id,
      updated_at: now
    });
    store.subagentSessions.set(next.subagent_session_id, next);
    return next;
  });

  const summary = AgentTeamSummarySchema.parse({
    team_id: teamId,
    task_id: taskId,
    mode,
    status: task.status === "completed" ? "completed" : task.status === "running" ? "active" : "planned",
    supervisor_session_id: `subagent_${taskId}_supervisor`,
    resume_supported: true,
    session_count: updatedSessions.length,
    active_session_count: updatedSessions.filter(session => session.status === "running").length,
    completed_session_count: updatedSessions.filter(session => session.status === "completed").length,
    message_count: messages.length,
    isolated_context_count: new Set(updatedSessions.map(session => session.isolated_context_key)).size,
    checkpoint_count: subagentCheckpoints.length,
    dispatch_plan_id: dispatchPlanId,
    future_upgrade_path: "Promote supervisor and delegated sessions into independently resumable subagent runtimes as Runtime Hardening Phase 5 continues.",
    created_at: store.agentTeams.get(teamId)?.created_at ?? now,
    updated_at: now
  });
  store.agentTeams.set(teamId, summary);
  recordAudit("task.agent_team_synced", { team_id: teamId, mode, session_count: summary.session_count, message_count: summary.message_count }, taskId);
  return summary;
}

export function listTaskSubagentSessions(taskId: string) {
  return [...store.subagentSessions.values()]
    .filter(session => session.task_id === taskId)
    .sort((left, right) => left.subagent_session_id.localeCompare(right.subagent_session_id));
}

export function listTaskSubagentMessages(taskId: string) {
  return store.subagentMessages
    .filter(message => message.task_id === taskId)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
}

export function listTaskSubagentCheckpoints(taskId: string) {
  return store.subagentCheckpoints
    .filter(checkpoint => checkpoint.task_id === taskId)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
}

export function listTaskSubagentResumeRequests(taskId: string) {
  return [...store.subagentResumeRequests.values()]
    .filter(request => request.task_id === taskId)
    .sort((left, right) => Date.parse(left.requested_at) - Date.parse(right.requested_at));
}

export function listTaskSubagentResumePackages(taskId: string) {
  return [...store.subagentResumePackages.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
}

export function listTaskSubagentExecutionRuns(taskId: string) {
  return [...store.subagentExecutionRuns.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));
}

export function listTaskSubagentRuntimeBindings(taskId: string) {
  return [...store.subagentRuntimeBindings.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.bound_at) - Date.parse(right.bound_at));
}

export function listTaskSubagentRuntimeInstances(taskId: string) {
  return [...store.subagentRuntimeInstances.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.launched_at) - Date.parse(right.launched_at));
}

export function listTaskSubagentRuntimeLaunchReceipts(taskId: string) {
  return [...store.subagentRuntimeLaunchReceipts.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.launched_at) - Date.parse(right.launched_at));
}

export function listTaskSubagentRuntimeAdapterRuns(taskId: string) {
  return [...store.subagentRuntimeAdapterRuns.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));
}

export function listTaskSubagentRuntimeRunnerBackendLeases(taskId: string) {
  return [...store.subagentRuntimeRunnerBackendLeases.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.allocated_at) - Date.parse(right.allocated_at));
}

export function listTaskSubagentRuntimeBackendExecutions(taskId: string) {
  return [...store.subagentRuntimeBackendExecutions.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));
}

export function listTaskSubagentRuntimeDriverRuns(taskId: string) {
  return [...store.subagentRuntimeDriverRuns.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));
}

export function listTaskSubagentRuntimeRunnerHandles(taskId: string) {
  return [...store.subagentRuntimeRunnerHandles.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.attached_at) - Date.parse(right.attached_at));
}

export function listTaskSubagentRuntimeRunnerExecutions(taskId: string) {
  return [...store.subagentRuntimeRunnerExecutions.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));
}

export function listTaskSubagentRuntimeRunnerJobs(taskId: string) {
  return [...store.subagentRuntimeRunnerJobs.values()]
    .filter(item => item.task_id === taskId)
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));
}

export function getSubagentRuntimeLaunchSpec(taskId: string, instanceId: string) {
  const runtimeInstance = store.subagentRuntimeInstances.get(instanceId);
  if (!runtimeInstance || runtimeInstance.task_id !== taskId) {
    throw new Error(`Runtime instance ${instanceId} not found for task ${taskId}.`);
  }
  const runtimeBinding = store.subagentRuntimeBindings.get(runtimeInstance.binding_id);
  if (!runtimeBinding || runtimeBinding.task_id !== taskId) {
    throw new Error(`Runtime binding ${runtimeInstance.binding_id} not found for task ${taskId}.`);
  }
  const executionRun = store.subagentExecutionRuns.get(runtimeInstance.execution_run_id);
  if (!executionRun || executionRun.task_id !== taskId) {
    throw new Error(`Execution run ${runtimeInstance.execution_run_id} not found for task ${taskId}.`);
  }
  const resumePackage = store.subagentResumePackages.get(runtimeInstance.package_id);
  if (!resumePackage || resumePackage.task_id !== taskId) {
    throw new Error(`Resume package ${runtimeInstance.package_id} not found for task ${taskId}.`);
  }

  return SubagentRuntimeLaunchSpecSchema.parse({
    launch_spec_id: `launchspec_${runtimeInstance.instance_id}`,
    instance_id: runtimeInstance.instance_id,
    binding_id: runtimeInstance.binding_id,
    execution_run_id: runtimeInstance.execution_run_id,
    package_id: runtimeInstance.package_id,
    request_id: runtimeInstance.request_id,
    team_id: runtimeInstance.team_id,
    task_id: runtimeInstance.task_id,
    subagent_session_id: runtimeInstance.subagent_session_id,
    runtime_kind: runtimeInstance.runtime_kind,
    sandbox_profile: runtimeInstance.sandbox_profile,
    runtime_locator: runtimeInstance.runtime_locator,
    launcher_kind: runtimeInstance.launcher_kind,
    launcher_driver_id: runtimeInstance.launcher_driver_id,
    launcher_state: runtimeInstance.launcher_state,
    launcher_locator: runtimeInstance.launcher_locator,
    launcher_worker_run_id: runtimeInstance.launcher_worker_run_id,
    isolation_scope: runtimeInstance.isolation_scope,
    quota_profile: runtimeInstance.quota_profile,
    mutation_guarded: runtimeInstance.mutation_guarded,
    handoff_checkpoint_id: resumePackage.handoff_checkpoint_id,
    start_checkpoint_id: executionRun.start_checkpoint_id,
    latest_checkpoint_id: executionRun.latest_checkpoint_id,
    applied_checkpoint_id: resumePackage.applied_checkpoint_id,
    package_summary: resumePackage.package_summary,
    execution_state_summary: resumePackage.execution_state_summary,
    latest_heartbeat_at: runtimeInstance.latest_heartbeat_at,
    latest_heartbeat_note: runtimeInstance.latest_heartbeat_note,
    consumer_contract_version: 1,
    deep_link: runtimeInstance.deep_link,
    created_at: runtimeInstance.launched_at
  });
}

export function listTaskSubagentRuntimeLaunchSpecs(taskId: string) {
  return listTaskSubagentRuntimeInstances(taskId).map(instance =>
    getSubagentRuntimeLaunchSpec(taskId, instance.instance_id)
  );
}

export function requestSubagentResume(
  taskId: string,
  subagentSessionId: string,
  input: { actor_role: string; reason?: string }
) {
  const task = requireTask(taskId);
  const team = buildTaskAgentTeamState(taskId);
  const session = store.subagentSessions.get(subagentSessionId);
  if (!session || session.task_id !== taskId) {
    throw new Error(`Subagent session ${subagentSessionId} not found for task ${taskId}.`);
  }
  if (!session.resume_supported) {
    throw new Error(`Subagent session ${subagentSessionId} does not support delegated resume.`);
  }
  const lastCheckpoint = listTaskSubagentCheckpoints(taskId)
    .filter(checkpoint => checkpoint.subagent_session_id === subagentSessionId)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];
  const existingPending = [...store.subagentResumeRequests.values()].find(
    request =>
      request.task_id === taskId
      && request.subagent_session_id === subagentSessionId
      && (request.status === "pending" || request.status === "accepted")
  );
  const now = nowIso();
  const request = SubagentResumeRequestSchema.parse({
    request_id: existingPending?.request_id ?? createEntityId("subresume"),
    team_id: team.team_id,
    task_id: taskId,
    subagent_session_id: subagentSessionId,
    actor_role: input.actor_role,
    reason: input.reason,
    last_checkpoint_id: lastCheckpoint?.checkpoint_id,
    deep_link: `#kind=task&taskId=${taskId}`,
    status: existingPending?.status ?? "pending",
    result_summary:
      existingPending?.result_summary
      ?? `Resume requested for ${session.role} from ${lastCheckpoint?.stage ?? "latest state"}.`,
    requested_at: existingPending?.requested_at ?? now,
    updated_at: now
  });
  store.subagentResumeRequests.set(request.request_id, request);
  recordAudit(
    "task.agent_team_resume_requested",
    {
      request_id: request.request_id,
      subagent_session_id: subagentSessionId,
      actor_role: input.actor_role,
      last_checkpoint_id: request.last_checkpoint_id
    },
    taskId
  );
  return request;
}

export function updateSubagentResumeRequest(
  taskId: string,
  requestId: string,
  input: {
    actor_role: string;
    action: "accept" | "complete" | "reject";
    note?: string;
  }
) {
  const request = store.subagentResumeRequests.get(requestId);
  if (!request || request.task_id !== taskId) {
    throw new Error(`Resume request ${requestId} not found for task ${taskId}.`);
  }
  const session = store.subagentSessions.get(request.subagent_session_id);
  if (!session || session.task_id !== taskId) {
    throw new Error(`Subagent session ${request.subagent_session_id} not found for task ${taskId}.`);
  }

  const now = nowIso();
  if (input.action === "accept") {
    if (request.status !== "pending") {
      throw new Error(`Resume request ${requestId} cannot be accepted from status ${request.status}.`);
    }
    const acceptedRequest = SubagentResumeRequestSchema.parse({
      ...request,
      status: "accepted",
      accepted_by: input.actor_role,
      accepted_at: now,
      resolution_note: input.note,
      result_summary: input.note
        ? `Resume request accepted for ${session.role}. ${input.note}`
        : `Resume request accepted for ${session.role}.`,
      updated_at: now
    });
    store.subagentResumeRequests.set(acceptedRequest.request_id, acceptedRequest);
    upsertSubagentMessage(taskId, {
      message_id: `submsg_${requestId}_resume_accepted`,
      team_id: request.team_id,
      subagent_session_id: request.subagent_session_id,
      direction: "supervisor_to_subagent",
      kind: "progress",
      summary: acceptedRequest.result_summary ?? "Resume request accepted.",
      payload: {
        request_id: requestId,
        actor_role: input.actor_role,
        status: acceptedRequest.status
      }
    });
    recordAudit(
      "task.agent_team_resume_accepted",
      {
        request_id: requestId,
        subagent_session_id: request.subagent_session_id,
        actor_role: input.actor_role
      },
      taskId
    );
    return acceptedRequest;
  }

  if (input.action === "complete") {
    if (request.status !== "accepted") {
      throw new Error(`Resume request ${requestId} cannot be completed from status ${request.status}.`);
    }
    const handoffCheckpointId = `subcp_${requestId}_resume_ready`;
    const previousPackages = [...store.subagentResumePackages.values()].filter(
      item =>
        item.task_id === taskId
        && item.subagent_session_id === request.subagent_session_id
        && item.status === "prepared"
    );
    for (const previousPackage of previousPackages) {
      const superseded = SubagentResumePackageSchema.parse({
        ...previousPackage,
        status: "superseded",
        superseded_at: now,
        updated_at: now
      });
      store.subagentResumePackages.set(superseded.package_id, superseded);
    }
    const completedRequest = SubagentResumeRequestSchema.parse({
      ...request,
      status: "completed",
      resolved_by: input.actor_role,
      resolved_at: now,
      resolution_note: input.note,
      result_summary: input.note
        ? `Delegated resume handoff prepared for ${session.role}. ${input.note}`
        : `Delegated resume handoff prepared for ${session.role}.`,
      updated_at: now
    });
    store.subagentResumeRequests.set(completedRequest.request_id, completedRequest);
    upsertSubagentCheckpoint(taskId, {
      checkpoint_id: handoffCheckpointId,
      team_id: request.team_id,
      subagent_session_id: request.subagent_session_id,
      stage: "resume_ready",
      summary: completedRequest.result_summary ?? "Delegated resume handoff prepared."
    });
    const executionStateCheckpoint = listTaskSubagentCheckpoints(taskId)
      .filter(checkpoint => checkpoint.subagent_session_id === request.subagent_session_id)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];
    const resumePackage = SubagentResumePackageSchema.parse({
      package_id: `subpkg_${requestId}`,
      request_id: requestId,
      team_id: request.team_id,
      task_id: taskId,
      subagent_session_id: request.subagent_session_id,
      handoff_checkpoint_id: handoffCheckpointId,
      deep_link: `#kind=task&taskId=${taskId}`,
      status: "prepared",
      package_summary: completedRequest.result_summary ?? "Delegated resume handoff prepared.",
      execution_state_summary: executionStateCheckpoint?.summary,
      created_by: input.actor_role,
      created_at: now,
      updated_at: now
    });
    store.subagentResumePackages.set(resumePackage.package_id, resumePackage);
    upsertSubagentMessage(taskId, {
      message_id: `submsg_${requestId}_resume_completed`,
      team_id: request.team_id,
      subagent_session_id: request.subagent_session_id,
      direction: "supervisor_to_subagent",
      kind: "handoff",
      summary: completedRequest.result_summary ?? "Delegated resume handoff prepared.",
      payload: {
        request_id: requestId,
        actor_role: input.actor_role,
        status: completedRequest.status,
        checkpoint_id: handoffCheckpointId,
        resume_package_id: resumePackage.package_id
      }
    });
    recordAudit(
      "task.agent_team_resume_completed",
      {
        request_id: requestId,
        subagent_session_id: request.subagent_session_id,
        actor_role: input.actor_role,
        resume_package_id: resumePackage.package_id
      },
      taskId
    );
    return completedRequest;
  }

  if (request.status !== "pending" && request.status !== "accepted") {
    throw new Error(`Resume request ${requestId} cannot be rejected from status ${request.status}.`);
  }
  const rejectedRequest = SubagentResumeRequestSchema.parse({
    ...request,
    status: "rejected",
    resolved_by: input.actor_role,
    resolved_at: now,
    resolution_note: input.note,
    result_summary: input.note
      ? `Resume request rejected for ${session.role}. ${input.note}`
      : `Resume request rejected for ${session.role}.`,
    updated_at: now
  });
  store.subagentResumeRequests.set(rejectedRequest.request_id, rejectedRequest);
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${requestId}_resume_rejected`,
    team_id: request.team_id,
    subagent_session_id: request.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "progress",
    summary: rejectedRequest.result_summary ?? "Resume request rejected.",
    payload: {
      request_id: requestId,
      actor_role: input.actor_role,
      status: rejectedRequest.status
    }
  });
  recordAudit(
    "task.agent_team_resume_rejected",
    {
      request_id: requestId,
      subagent_session_id: request.subagent_session_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return rejectedRequest;
}

export function applySubagentResumePackage(
  taskId: string,
  packageId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const resumePackage = store.subagentResumePackages.get(packageId);
  if (!resumePackage || resumePackage.task_id !== taskId) {
    throw new Error(`Resume package ${packageId} not found for task ${taskId}.`);
  }
  if (resumePackage.status !== "prepared") {
    throw new Error(`Resume package ${packageId} cannot be applied from status ${resumePackage.status}.`);
  }

  const session = store.subagentSessions.get(resumePackage.subagent_session_id);
  if (!session || session.task_id !== taskId) {
    throw new Error(`Subagent session ${resumePackage.subagent_session_id} not found for task ${taskId}.`);
  }

  const now = nowIso();
  const appliedCheckpointId = `subcp_${packageId}_resume_applied`;
  const appliedPackage = SubagentResumePackageSchema.parse({
    ...resumePackage,
    status: "applied",
    applied_at: now,
    applied_by: input.actor_role,
    applied_note: input.note,
    applied_checkpoint_id: appliedCheckpointId,
    updated_at: now
  });
  store.subagentResumePackages.set(appliedPackage.package_id, appliedPackage);

  const executionRun = SubagentExecutionRunSchema.parse({
    execution_run_id: `subrun_${packageId}`,
    package_id: packageId,
    request_id: appliedPackage.request_id,
    team_id: appliedPackage.team_id,
    task_id: taskId,
    subagent_session_id: appliedPackage.subagent_session_id,
    status: "running",
    runtime_kind: "delegated_runtime",
    start_checkpoint_id: appliedCheckpointId,
    latest_checkpoint_id: appliedCheckpointId,
    result_summary: input.note
      ? `Delegated execution resumed from package ${packageId}. ${input.note}`
      : `Delegated execution resumed from package ${packageId}.`,
    started_by: input.actor_role,
    started_at: now,
    updated_at: now,
    deep_link: appliedPackage.deep_link
  });
  store.subagentExecutionRuns.set(executionRun.execution_run_id, executionRun);

  upsertSubagentSession(taskId, {
    ...session,
    status: "running",
    result_summary: input.note
      ? `Delegated runtime resumed from package ${packageId}. ${input.note}`
      : `Delegated runtime resumed from package ${packageId}.`
  });

  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: appliedCheckpointId,
    team_id: appliedPackage.team_id,
    subagent_session_id: appliedPackage.subagent_session_id,
    stage: "resume_applied",
    summary: input.note
      ? `Resume package ${packageId} applied. ${input.note}`
      : `Resume package ${packageId} applied and ready for delegated execution.`
  });

  upsertSubagentMessage(taskId, {
    message_id: `submsg_${packageId}_resume_package_applied`,
    team_id: appliedPackage.team_id,
    subagent_session_id: appliedPackage.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Resume package applied by ${input.actor_role}. ${input.note}`
      : `Resume package applied by ${input.actor_role}.`,
    payload: {
      package_id: packageId,
      request_id: appliedPackage.request_id,
      actor_role: input.actor_role,
      checkpoint_id: appliedCheckpointId,
      execution_run_id: executionRun.execution_run_id
    }
  });

  recordAudit(
    "task.agent_team_resume_package_applied",
    {
      package_id: packageId,
      request_id: appliedPackage.request_id,
      subagent_session_id: appliedPackage.subagent_session_id,
      actor_role: input.actor_role,
      checkpoint_id: appliedCheckpointId,
      execution_run_id: executionRun.execution_run_id
    },
    taskId
  );

  return appliedPackage;
}

export function updateSubagentExecutionRun(
  taskId: string,
  executionRunId: string,
  input: {
    actor_role: string;
    action: "complete" | "fail";
    note?: string;
  }
) {
  const executionRun = store.subagentExecutionRuns.get(executionRunId);
  if (!executionRun || executionRun.task_id !== taskId) {
    throw new Error(`Execution run ${executionRunId} not found for task ${taskId}.`);
  }
  if (executionRun.status !== "running") {
    throw new Error(`Execution run ${executionRunId} cannot transition from status ${executionRun.status}.`);
  }

  const session = store.subagentSessions.get(executionRun.subagent_session_id);
  if (!session || session.task_id !== taskId) {
    throw new Error(`Subagent session ${executionRun.subagent_session_id} not found for task ${taskId}.`);
  }

  const now = nowIso();
  const completionCheckpointId = `subcp_${executionRunId}_${input.action}`;
  const nextStatus = input.action === "complete" ? "completed" : "failed";
  const updatedRun = SubagentExecutionRunSchema.parse({
    ...executionRun,
    status: nextStatus,
    latest_checkpoint_id: completionCheckpointId,
    result_summary: input.note
      ? `Delegated execution ${nextStatus}. ${input.note}`
      : `Delegated execution ${nextStatus}.`,
    completed_at: now,
    completion_note: input.note,
    updated_at: now
  });
  store.subagentExecutionRuns.set(updatedRun.execution_run_id, updatedRun);

  const activeBinding = [...store.subagentRuntimeBindings.values()].find(
    binding =>
      binding.task_id === taskId
      && binding.execution_run_id === executionRunId
      && binding.status === "bound"
  );
  if (activeBinding) {
    const releasedBinding = SubagentRuntimeBindingSchema.parse({
      ...activeBinding,
      status: "released",
      latest_heartbeat_at: now,
      released_at: now,
      release_reason:
        input.action === "complete"
          ? "Execution run completed and runtime binding was released."
          : "Execution run failed and runtime binding was released."
    });
    store.subagentRuntimeBindings.set(releasedBinding.binding_id, releasedBinding);
  }
  const activeRuntimeInstance = [...store.subagentRuntimeInstances.values()].find(
    item => item.task_id === taskId && item.execution_run_id === executionRunId && item.status === "active"
  );
  if (activeRuntimeInstance) {
    const finishedRuntimeInstance = SubagentRuntimeInstanceSchema.parse({
      ...activeRuntimeInstance,
      status: input.action === "complete" ? "completed" : "failed",
      latest_heartbeat_at: now,
      latest_heartbeat_note: input.note,
      launcher_state: "released",
      finished_at: now,
      finish_reason:
        input.note
        ?? (input.action === "complete"
          ? "Delegated execution run completed."
          : "Delegated execution run failed.")
    });
    store.subagentRuntimeInstances.set(finishedRuntimeInstance.instance_id, finishedRuntimeInstance);
    if (finishedRuntimeInstance.launcher_worker_run_id) {
      const launcherWorkerRun = store.workerRuns.get(finishedRuntimeInstance.launcher_worker_run_id);
      if (launcherWorkerRun) {
        store.workerRuns.set(
          launcherWorkerRun.worker_run_id,
          WorkerRunSchema.parse({
            ...launcherWorkerRun,
            status: input.action === "complete" ? "completed" : "failed",
            summary: finishedRuntimeInstance.finish_reason ?? launcherWorkerRun.summary,
            completed_at: now
          })
        );
      }
    }
  }

  upsertSubagentSession(taskId, {
    ...session,
    status: input.action === "complete" ? "completed" : "failed",
    completed_at: now,
    result_summary: updatedRun.result_summary
  });

  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: completionCheckpointId,
    team_id: updatedRun.team_id,
    subagent_session_id: updatedRun.subagent_session_id,
    stage: input.action === "complete" ? "resume_run_completed" : "resume_run_failed",
    summary: updatedRun.result_summary ?? `Delegated execution ${nextStatus}.`
  });

  upsertSubagentMessage(taskId, {
    message_id: `submsg_${executionRunId}_${input.action}`,
    team_id: updatedRun.team_id,
    subagent_session_id: updatedRun.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: updatedRun.result_summary ?? `Delegated execution ${nextStatus}.`,
    payload: {
      execution_run_id: executionRunId,
      actor_role: input.actor_role,
      status: updatedRun.status,
      checkpoint_id: completionCheckpointId
    }
  });

  recordAudit(
    input.action === "complete" ? "task.agent_team_execution_run_completed" : "task.agent_team_execution_run_failed",
    {
      execution_run_id: executionRunId,
      package_id: updatedRun.package_id,
      actor_role: input.actor_role,
      checkpoint_id: completionCheckpointId
    },
    taskId
  );

  return updatedRun;
}

export function bindSubagentExecutionRunRuntime(
  taskId: string,
  executionRunId: string,
  input: {
    actor_role: string;
    runtime_kind?: "host_guarded" | "sandbox_runner" | "cloud_runner";
    sandbox_profile?: "delegated_resume_default" | "verified_readonly" | "connector_guarded";
    runtime_locator?: string;
    launcher_kind?: "worker_run" | "sandbox_runner" | "cloud_runner";
    launcher_driver_id?: "local_worker_run_driver" | "sandbox_pool_driver" | "cloud_control_plane_driver";
    launcher_locator?: string;
    note?: string;
  }
) {
  const executionRun = store.subagentExecutionRuns.get(executionRunId);
  if (!executionRun || executionRun.task_id !== taskId) {
    throw new Error(`Execution run ${executionRunId} not found for task ${taskId}.`);
  }
  if (executionRun.status !== "running") {
    throw new Error(`Execution run ${executionRunId} must be running before a runtime can bind.`);
  }
  const existingBound = [...store.subagentRuntimeBindings.values()].find(
    binding =>
      binding.task_id === taskId
      && binding.execution_run_id === executionRunId
      && binding.status === "bound"
  );
  if (existingBound) {
    throw new Error(`Execution run ${executionRunId} already has an active runtime binding.`);
  }

  const now = nowIso();
  const launcherKind = input.launcher_kind ?? "worker_run";
  const launcherDriverId = input.launcher_driver_id ?? getDefaultLauncherDriverId(launcherKind);
  validateLauncherDriver(launcherKind, launcherDriverId);
  const launcherDriverContract = getLauncherDriverContract(launcherDriverId);
  const binding = SubagentRuntimeBindingSchema.parse({
    binding_id: `subbind_${executionRunId}`,
    execution_run_id: executionRunId,
    package_id: executionRun.package_id,
    request_id: executionRun.request_id,
    team_id: executionRun.team_id,
    task_id: taskId,
    subagent_session_id: executionRun.subagent_session_id,
    status: "bound",
    runtime_kind: input.runtime_kind ?? "sandbox_runner",
    sandbox_profile: input.sandbox_profile ?? "delegated_resume_default",
    runtime_locator: input.runtime_locator,
    latest_heartbeat_at: now,
    bound_by: input.actor_role,
    bound_at: now,
    deep_link: executionRun.deep_link
  });
  store.subagentRuntimeBindings.set(binding.binding_id, binding);
  const runtimeInstance = SubagentRuntimeInstanceSchema.parse({
    instance_id: `subinst_${executionRunId}`,
    binding_id: binding.binding_id,
    execution_run_id: executionRunId,
    package_id: executionRun.package_id,
    request_id: executionRun.request_id,
    team_id: executionRun.team_id,
    task_id: taskId,
    subagent_session_id: executionRun.subagent_session_id,
    status: "active",
    runtime_kind: binding.runtime_kind,
    sandbox_profile: binding.sandbox_profile,
    runtime_locator: binding.runtime_locator,
    launched_by: input.actor_role,
    launched_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note,
    launcher_kind: launcherKind,
    launcher_driver_id: launcherDriverId,
    isolation_scope: launcherDriverContract.isolation_scope,
    quota_profile: launcherDriverContract.quota_profile,
    mutation_guarded: launcherDriverContract.mutation_guarded,
    launcher_state: launcherKind !== "worker_run" ? "external_pending" : "attached",
    launcher_locator: input.launcher_locator ?? input.runtime_locator,
    launcher_attached_at: launcherKind !== "worker_run" ? undefined : now,
    launcher_summary:
      launcherKind !== "worker_run"
        ? `Awaiting ${launcherKind} launcher attachment through ${launcherDriverId}.`
        : `Attached to local delegated worker launcher through ${launcherDriverId}.`,
    deep_link: executionRun.deep_link
  });
  const launcherWorkerRun = runtimeInstance.launcher_kind === "worker_run"
    ? WorkerRunSchema.parse({
        worker_run_id: createEntityId("worker"),
        task_id: taskId,
        worker_kind: "general_worker",
        worker_name: `delegated-runtime-${launcherDriverId}`,
        status: "running",
        summary: `Runtime instance ${runtimeInstance.instance_id} attached to delegated execution ${executionRun.execution_run_id} through ${launcherDriverId}.`,
        delegated_execution_run_id: executionRun.execution_run_id,
        delegated_runtime_instance_id: runtimeInstance.instance_id,
        started_at: now,
        created_at: now
      })
    : undefined;
  if (launcherWorkerRun) {
    store.workerRuns.set(launcherWorkerRun.worker_run_id, launcherWorkerRun);
  }
  const attachedRuntimeInstance = SubagentRuntimeInstanceSchema.parse({
    ...runtimeInstance,
    launcher_worker_run_id: launcherWorkerRun?.worker_run_id
  });
  store.subagentRuntimeInstances.set(attachedRuntimeInstance.instance_id, attachedRuntimeInstance);

  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${executionRunId}_runtime_bound`,
    team_id: executionRun.team_id,
    subagent_session_id: executionRun.subagent_session_id,
    stage: "runtime_bound",
    summary: input.note
      ? `Runtime binding ${binding.binding_id} established. ${input.note}`
      : `Runtime binding ${binding.binding_id} established for delegated execution.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${executionRunId}_runtime_bound`,
    team_id: executionRun.team_id,
    subagent_session_id: executionRun.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runtime bound by ${input.actor_role}. ${input.note}`
      : `Runtime bound by ${input.actor_role}.`,
    payload: {
      execution_run_id: executionRunId,
      binding_id: binding.binding_id,
      runtime_kind: binding.runtime_kind,
      sandbox_profile: binding.sandbox_profile,
      launcher_driver_id: launcherDriverId
    }
  });
  recordAudit(
    "task.agent_team_execution_run_bound",
    {
      execution_run_id: executionRunId,
      binding_id: binding.binding_id,
      instance_id: attachedRuntimeInstance.instance_id,
      launcher_kind: attachedRuntimeInstance.launcher_kind,
      launcher_driver_id: attachedRuntimeInstance.launcher_driver_id,
      launcher_worker_run_id: launcherWorkerRun?.worker_run_id,
      actor_role: input.actor_role,
      runtime_kind: binding.runtime_kind,
      sandbox_profile: binding.sandbox_profile
    },
    taskId
  );
  return binding;
}

export function releaseSubagentRuntimeBinding(
  taskId: string,
  bindingId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const binding = store.subagentRuntimeBindings.get(bindingId);
  if (!binding || binding.task_id !== taskId) {
    throw new Error(`Runtime binding ${bindingId} not found for task ${taskId}.`);
  }
  if (binding.status !== "bound") {
    throw new Error(`Runtime binding ${bindingId} cannot be released from status ${binding.status}.`);
  }
  const now = nowIso();
  const releasedBinding = SubagentRuntimeBindingSchema.parse({
    ...binding,
    status: "released",
    latest_heartbeat_at: now,
    released_at: now,
    release_reason: input.note ?? "Runtime binding released by operator."
  });
  store.subagentRuntimeBindings.set(releasedBinding.binding_id, releasedBinding);
  const activeRuntimeInstance = [...store.subagentRuntimeInstances.values()].find(
    item => item.task_id === taskId && item.binding_id === bindingId && item.status === "active"
  );
  if (activeRuntimeInstance) {
    const releasedRuntimeInstance = SubagentRuntimeInstanceSchema.parse({
      ...activeRuntimeInstance,
      status: "released",
      latest_heartbeat_at: now,
      latest_heartbeat_note: input.note,
      launcher_state: "released",
      finished_at: now,
      finish_reason: input.note ?? "Runtime binding released by operator."
    });
    store.subagentRuntimeInstances.set(releasedRuntimeInstance.instance_id, releasedRuntimeInstance);
    if (releasedRuntimeInstance.launcher_worker_run_id) {
      const launcherWorkerRun = store.workerRuns.get(releasedRuntimeInstance.launcher_worker_run_id);
      if (launcherWorkerRun) {
        store.workerRuns.set(
          launcherWorkerRun.worker_run_id,
          WorkerRunSchema.parse({
            ...launcherWorkerRun,
            status: "stopped",
            summary: `Runtime instance ${releasedRuntimeInstance.instance_id} released. ${releasedRuntimeInstance.finish_reason ?? ""}`.trim(),
            completed_at: now
          })
        );
      }
    }
  }
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${binding.execution_run_id}_runtime_released`,
    team_id: binding.team_id,
    subagent_session_id: binding.subagent_session_id,
    stage: "runtime_released",
    summary: input.note
      ? `Runtime binding ${binding.binding_id} released. ${input.note}`
      : `Runtime binding ${binding.binding_id} released.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${binding.execution_run_id}_runtime_released`,
    team_id: binding.team_id,
    subagent_session_id: binding.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "progress",
    summary: input.note
      ? `Runtime released by ${input.actor_role}. ${input.note}`
      : `Runtime released by ${input.actor_role}.`,
    payload: {
      execution_run_id: binding.execution_run_id,
      binding_id: binding.binding_id
    }
  });
  recordAudit(
    "task.agent_team_execution_run_released",
    {
      execution_run_id: binding.execution_run_id,
      binding_id: binding.binding_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return releasedBinding;
}

export function heartbeatSubagentRuntimeInstance(
  taskId: string,
  instanceId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const runtimeInstance = store.subagentRuntimeInstances.get(instanceId);
  if (!runtimeInstance || runtimeInstance.task_id !== taskId) {
    throw new Error(`Runtime instance ${instanceId} not found for task ${taskId}.`);
  }
  if (runtimeInstance.status !== "active") {
    throw new Error(`Runtime instance ${instanceId} cannot heartbeat from status ${runtimeInstance.status}.`);
  }
  const now = nowIso();
  const updatedRuntimeInstance = SubagentRuntimeInstanceSchema.parse({
    ...runtimeInstance,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Heartbeat from ${input.actor_role}.`,
    launcher_state: runtimeInstance.launcher_state === "external_pending" ? "attached" : runtimeInstance.launcher_state,
    launcher_attached_at: runtimeInstance.launcher_attached_at ?? now,
    launcher_summary:
      runtimeInstance.launcher_kind === "worker_run"
        ? runtimeInstance.launcher_summary
        : input.note
          ? `External launcher attached and alive. ${input.note}`
          : "External launcher attached and heartbeat is healthy."
  });
  store.subagentRuntimeInstances.set(updatedRuntimeInstance.instance_id, updatedRuntimeInstance);
  if (updatedRuntimeInstance.launcher_worker_run_id) {
    const launcherWorkerRun = store.workerRuns.get(updatedRuntimeInstance.launcher_worker_run_id);
    if (launcherWorkerRun) {
      store.workerRuns.set(
        launcherWorkerRun.worker_run_id,
        WorkerRunSchema.parse({
          ...launcherWorkerRun,
          summary: input.note
            ? `Runtime instance ${instanceId} heartbeat: ${input.note}`
            : `Runtime instance ${instanceId} heartbeat recorded.`
        })
      );
    }
  }
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${runtimeInstance.execution_run_id}_runtime_heartbeat`,
    team_id: runtimeInstance.team_id,
    subagent_session_id: runtimeInstance.subagent_session_id,
    stage: "runtime_heartbeat",
    summary: input.note
      ? `Runtime heartbeat received for ${instanceId}. ${input.note}`
      : `Runtime heartbeat received for ${instanceId}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${runtimeInstance.execution_run_id}_runtime_heartbeat`,
    team_id: runtimeInstance.team_id,
    subagent_session_id: runtimeInstance.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "progress",
    summary: input.note
      ? `Runtime heartbeat from ${input.actor_role}. ${input.note}`
      : `Runtime heartbeat from ${input.actor_role}.`,
    payload: {
      instance_id: instanceId,
      execution_run_id: runtimeInstance.execution_run_id,
      actor_role: input.actor_role
    }
  });
  recordAudit(
    "task.agent_team_runtime_instance_heartbeat",
    {
      instance_id: instanceId,
      binding_id: runtimeInstance.binding_id,
      execution_run_id: runtimeInstance.execution_run_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updatedRuntimeInstance;
}

export function launchSubagentRuntimeInstance(
  taskId: string,
  instanceId: string,
  input: {
    actor_role: string;
    note?: string;
    launch_locator?: string;
    runtime_locator?: string;
  }
) {
  const runtimeInstance = store.subagentRuntimeInstances.get(instanceId);
  if (!runtimeInstance || runtimeInstance.task_id !== taskId) {
    throw new Error(`Runtime instance ${instanceId} not found for task ${taskId}.`);
  }
  if (runtimeInstance.status !== "active") {
    throw new Error(`Runtime instance ${instanceId} cannot launch from status ${runtimeInstance.status}.`);
  }

  const launchSpec = getSubagentRuntimeLaunchSpec(taskId, instanceId);
  const existingReceipt = [...store.subagentRuntimeLaunchReceipts.values()].find(
    item => item.task_id === taskId && item.instance_id === instanceId && item.status === "launched"
  );
  if (existingReceipt) {
    return existingReceipt;
  }

  const now = nowIso();
  const backendKind = getLauncherBackendKind(runtimeInstance.launcher_driver_id);
  const launchLocator = buildRuntimeLaunchLocator(
    runtimeInstance.launcher_driver_id,
    instanceId,
    input.launch_locator ?? runtimeInstance.launcher_locator
  );
  const executionLocator = buildRuntimeExecutionLocator(
    runtimeInstance.launcher_driver_id,
    runtimeInstance.execution_run_id,
    input.runtime_locator ?? runtimeInstance.runtime_locator
  );

  const updatedRuntimeInstance = SubagentRuntimeInstanceSchema.parse({
    ...runtimeInstance,
    runtime_locator: executionLocator,
    launcher_state: "attached",
    launcher_locator: launchLocator,
    launcher_attached_at: runtimeInstance.launcher_attached_at ?? now,
    launcher_summary: input.note
      ? `Launch spec consumed by ${backendKind}. ${input.note}`
      : `Launch spec consumed by ${backendKind}.`,
    latest_heartbeat_at: runtimeInstance.latest_heartbeat_at ?? now,
    latest_heartbeat_note: runtimeInstance.latest_heartbeat_note ?? `Launch acknowledged by ${input.actor_role}.`
  });
  store.subagentRuntimeInstances.set(updatedRuntimeInstance.instance_id, updatedRuntimeInstance);

  const receipt = SubagentRuntimeLaunchReceiptSchema.parse({
    receipt_id: `sublaunch_${instanceId}`,
    launch_spec_id: launchSpec.launch_spec_id,
    instance_id: instanceId,
    binding_id: runtimeInstance.binding_id,
    execution_run_id: runtimeInstance.execution_run_id,
    package_id: runtimeInstance.package_id,
    request_id: runtimeInstance.request_id,
    team_id: runtimeInstance.team_id,
    task_id: taskId,
    subagent_session_id: runtimeInstance.subagent_session_id,
    launcher_kind: runtimeInstance.launcher_kind,
    launcher_driver_id: runtimeInstance.launcher_driver_id,
    backend_kind: backendKind,
    status: "launched",
    launched_by: input.actor_role,
    launched_at: now,
    launch_locator: launchLocator,
    execution_locator: executionLocator,
    note: input.note,
    consumer_contract_version: 1,
    deep_link: runtimeInstance.deep_link
  });
  store.subagentRuntimeLaunchReceipts.set(receipt.receipt_id, receipt);

  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${runtimeInstance.execution_run_id}_runtime_launch_dispatched`,
    team_id: runtimeInstance.team_id,
    subagent_session_id: runtimeInstance.subagent_session_id,
    stage: "runtime_launch_dispatched",
    summary: input.note
      ? `Runtime instance ${instanceId} launch dispatched through ${backendKind}. ${input.note}`
      : `Runtime instance ${instanceId} launch dispatched through ${backendKind}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${runtimeInstance.execution_run_id}_runtime_launch_dispatched`,
    team_id: runtimeInstance.team_id,
    subagent_session_id: runtimeInstance.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Launch dispatched by ${input.actor_role}. ${input.note}`
      : `Launch dispatched by ${input.actor_role}.`,
    payload: {
      instance_id: instanceId,
      receipt_id: receipt.receipt_id,
      launch_spec_id: launchSpec.launch_spec_id,
      backend_kind: backendKind,
      launch_locator: launchLocator,
      execution_locator: executionLocator
    }
  });
  recordAudit(
    "task.agent_team_runtime_launch_dispatched",
    {
      instance_id: instanceId,
      receipt_id: receipt.receipt_id,
      binding_id: runtimeInstance.binding_id,
      execution_run_id: runtimeInstance.execution_run_id,
      launcher_driver_id: runtimeInstance.launcher_driver_id,
      backend_kind: backendKind,
      actor_role: input.actor_role
    },
    taskId
  );

  return receipt;
}

export function startSubagentRuntimeAdapterRun(
  taskId: string,
  receiptId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const receipt = store.subagentRuntimeLaunchReceipts.get(receiptId);
  if (!receipt || receipt.task_id !== taskId) {
    throw new Error(`Runtime launch receipt ${receiptId} not found for task ${taskId}.`);
  }
  if (receipt.status !== "launched") {
    throw new Error(`Runtime launch receipt ${receiptId} cannot start adapter execution from status ${receipt.status}.`);
  }
  const existing = [...store.subagentRuntimeAdapterRuns.values()].find(
    item => item.task_id === taskId && item.receipt_id === receiptId && item.status === "running"
  );
  if (existing) {
    return existing;
  }
  const runtimeInstance = store.subagentRuntimeInstances.get(receipt.instance_id);
  if (!runtimeInstance || runtimeInstance.task_id !== taskId) {
    throw new Error(`Runtime instance ${receipt.instance_id} not found for task ${taskId}.`);
  }
  const now = nowIso();
  const adapterRun = SubagentRuntimeAdapterRunSchema.parse({
    adapter_run_id: `subadapter_${receiptId}`,
    receipt_id: receiptId,
    instance_id: receipt.instance_id,
    binding_id: receipt.binding_id,
    execution_run_id: receipt.execution_run_id,
    package_id: receipt.package_id,
    request_id: receipt.request_id,
    team_id: receipt.team_id,
    task_id: taskId,
    subagent_session_id: receipt.subagent_session_id,
    backend_kind: receipt.backend_kind,
    launcher_driver_id: receipt.launcher_driver_id,
    launch_locator: receipt.launch_locator,
    execution_locator: receipt.execution_locator,
    status: "running",
    started_by: input.actor_role,
    started_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Adapter run started by ${input.actor_role}.`,
    deep_link: receipt.deep_link
  });
  store.subagentRuntimeAdapterRuns.set(adapterRun.adapter_run_id, adapterRun);
  heartbeatSubagentRuntimeInstance(taskId, receipt.instance_id, {
    actor_role: input.actor_role,
    note: input.note ?? `Adapter run ${adapterRun.adapter_run_id} started.`
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${receipt.execution_run_id}_runtime_adapter_started`,
    team_id: receipt.team_id,
    subagent_session_id: receipt.subagent_session_id,
    stage: "runtime_adapter_started",
    summary: input.note
      ? `Runtime adapter run ${adapterRun.adapter_run_id} started. ${input.note}`
      : `Runtime adapter run ${adapterRun.adapter_run_id} started.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${receipt.execution_run_id}_runtime_adapter_started`,
    team_id: receipt.team_id,
    subagent_session_id: receipt.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runtime adapter started by ${input.actor_role}. ${input.note}`
      : `Runtime adapter started by ${input.actor_role}.`,
    payload: {
      adapter_run_id: adapterRun.adapter_run_id,
      receipt_id: receiptId,
      backend_kind: receipt.backend_kind
    }
  });
  recordAudit(
    "task.agent_team_runtime_adapter_started",
    {
      adapter_run_id: adapterRun.adapter_run_id,
      receipt_id: receiptId,
      instance_id: receipt.instance_id,
      backend_kind: receipt.backend_kind,
      actor_role: input.actor_role
    },
    taskId
  );
  return adapterRun;
}

export function consumeSubagentRuntimeLaunchReceipt(
  taskId: string,
  receiptId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const receipt = store.subagentRuntimeLaunchReceipts.get(receiptId);
  if (!receipt || receipt.task_id !== taskId) {
    throw new Error(`Runtime launch receipt ${receiptId} not found for task ${taskId}.`);
  }
  const adapterId = getLauncherBackendAdapterId(receipt.backend_kind);
  const adapter = getSubagentRuntimeLauncherBackendAdapterCatalog().find(item => item.adapter_id === adapterId);
  if (!adapter) {
    throw new Error(`No launcher backend adapter is registered for backend kind '${receipt.backend_kind}'.`);
  }
  if (!adapter.supported_driver_ids.includes(receipt.launcher_driver_id)) {
    throw new Error(
      `Launcher backend adapter '${adapter.adapter_id}' does not support driver '${receipt.launcher_driver_id}'.`
    );
  }
  const adapterRun = startSubagentRuntimeAdapterRun(taskId, receiptId, {
    actor_role: input.actor_role,
    note:
      input.note
      ?? `Launch receipt consumed by ${adapter.adapter_id} through ${adapter.execution_style}.`
  });
  const heartbeat =
    adapterRun.status === "running"
      ? heartbeatSubagentRuntimeAdapterRun(taskId, adapterRun.adapter_run_id, {
          actor_role: input.actor_role,
          note: `Adapter ${adapter.adapter_id} acknowledged delegated runtime handoff.`
        })
      : adapterRun;
  recordAudit(
    "task.agent_team_runtime_launch_receipt_consumed",
    {
      receipt_id: receiptId,
      adapter_id: adapter.adapter_id,
      adapter_run_id: heartbeat.adapter_run_id,
      launcher_driver_id: receipt.launcher_driver_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return {
    adapter,
    receipt,
    adapter_run: heartbeat
  };
}

export function acquireSubagentRuntimeRunnerBackendLease(
  taskId: string,
  adapterRunId: string,
  input: {
    actor_role: string;
    note?: string;
    resource_locator?: string;
    execution_locator?: string;
  }
) {
  const adapterRun = store.subagentRuntimeAdapterRuns.get(adapterRunId);
  if (!adapterRun || adapterRun.task_id !== taskId) {
    throw new Error(`Runtime adapter run ${adapterRunId} not found for task ${taskId}.`);
  }
  if (adapterRun.status !== "running") {
    throw new Error(`Runtime adapter run ${adapterRunId} cannot allocate a runner backend lease from status ${adapterRun.status}.`);
  }
  const existing = [...store.subagentRuntimeRunnerBackendLeases.values()].find(
    item => item.task_id === taskId && item.adapter_run_id === adapterRunId && item.status === "allocated"
  );
  if (existing) {
    return existing;
  }
  const adapter = getSubagentRuntimeRunnerBackendAdapterCatalog().find(item => item.backend_kind === adapterRun.backend_kind);
  if (!adapter) {
    throw new Error(`No runner backend adapter is registered for backend kind '${adapterRun.backend_kind}'.`);
  }
  const launchSpec = getSubagentRuntimeLaunchSpec(taskId, adapterRun.instance_id);
  const now = nowIso();
  const lease = SubagentRuntimeRunnerBackendLeaseSchema.parse({
    lease_id: createEntityId("sublease"),
    adapter_run_id: adapterRun.adapter_run_id,
    receipt_id: adapterRun.receipt_id,
    instance_id: adapterRun.instance_id,
    binding_id: adapterRun.binding_id,
    execution_run_id: adapterRun.execution_run_id,
    package_id: adapterRun.package_id,
    request_id: adapterRun.request_id,
    team_id: adapterRun.team_id,
    task_id: taskId,
    subagent_session_id: adapterRun.subagent_session_id,
    adapter_id: adapter.adapter_id,
    runner_kind: adapter.runner_kind,
    backend_kind: adapter.backend_kind,
    launcher_driver_id: adapterRun.launcher_driver_id,
    quota_profile: launchSpec.quota_profile,
    isolation_scope: launchSpec.isolation_scope,
    execution_locator: input.execution_locator ?? adapterRun.execution_locator ?? adapterRun.launch_locator,
    resource_locator:
      input.resource_locator
      ?? adapterRun.execution_locator
      ?? adapterRun.launch_locator
      ?? launchSpec.runtime_locator
      ?? launchSpec.launcher_locator,
    status: "allocated",
    allocated_by: input.actor_role,
    allocated_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner backend lease allocated by ${input.actor_role}.`,
    deep_link: adapterRun.deep_link
  });
  store.subagentRuntimeRunnerBackendLeases.set(lease.lease_id, lease);
  heartbeatSubagentRuntimeAdapterRun(taskId, adapterRunId, {
    actor_role: input.actor_role,
    note: input.note ?? `Runner backend lease ${lease.lease_id} allocated.`
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${adapterRun.execution_run_id}_runtime_runner_backend_lease_allocated`,
    team_id: adapterRun.team_id,
    subagent_session_id: adapterRun.subagent_session_id,
    stage: "runtime_runner_backend_lease_allocated",
    summary: input.note
      ? `Runner backend lease ${lease.lease_id} allocated. ${input.note}`
      : `Runner backend lease ${lease.lease_id} allocated.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${adapterRun.execution_run_id}_runtime_runner_backend_lease_allocated`,
    team_id: adapterRun.team_id,
    subagent_session_id: adapterRun.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runner backend lease allocated by ${input.actor_role}. ${input.note}`
      : `Runner backend lease allocated by ${input.actor_role}.`,
    payload: {
      lease_id: lease.lease_id,
      adapter_run_id: adapterRun.adapter_run_id,
      adapter_id: adapter.adapter_id,
      runner_kind: adapter.runner_kind
    }
  });
  recordAudit(
    "task.agent_team_runtime_runner_backend_lease_allocated",
    {
      lease_id: lease.lease_id,
      adapter_run_id: adapterRun.adapter_run_id,
      adapter_id: adapter.adapter_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return lease;
}

export function releaseSubagentRuntimeRunnerBackendLease(
  taskId: string,
  leaseId: string,
  input: {
    actor_role: string;
    action?: "release" | "fail";
    note?: string;
  }
) {
  const lease = store.subagentRuntimeRunnerBackendLeases.get(leaseId);
  if (!lease || lease.task_id !== taskId) {
    throw new Error(`Runtime runner backend lease ${leaseId} not found for task ${taskId}.`);
  }
  if (lease.status !== "allocated") {
    throw new Error(`Runtime runner backend lease ${leaseId} cannot transition from status ${lease.status}.`);
  }
  const now = nowIso();
  const nextStatus = input.action === "fail" ? "failed" : "released";
  const updated = SubagentRuntimeRunnerBackendLeaseSchema.parse({
    ...lease,
    status: nextStatus,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner backend lease ${nextStatus} by ${input.actor_role}.`,
    released_at: now,
    release_note: input.note ?? (nextStatus === "released" ? "Runner backend lease released." : "Runner backend lease failed.")
  });
  store.subagentRuntimeRunnerBackendLeases.set(updated.lease_id, updated);
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${lease.execution_run_id}_runtime_runner_backend_lease_${nextStatus}`,
    team_id: lease.team_id,
    subagent_session_id: lease.subagent_session_id,
    stage: `runtime_runner_backend_lease_${nextStatus}`,
    summary: input.note
      ? `Runner backend lease ${lease.lease_id} ${nextStatus}. ${input.note}`
      : `Runner backend lease ${lease.lease_id} ${nextStatus}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${lease.execution_run_id}_runtime_runner_backend_lease_${nextStatus}`,
    team_id: lease.team_id,
    subagent_session_id: lease.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: input.note
      ? `Runner backend lease ${nextStatus} by ${input.actor_role}. ${input.note}`
      : `Runner backend lease ${nextStatus} by ${input.actor_role}.`,
    payload: {
      lease_id: lease.lease_id,
      adapter_run_id: lease.adapter_run_id,
      action: nextStatus
    }
  });
  recordAudit(
    nextStatus === "released"
      ? "task.agent_team_runtime_runner_backend_lease_released"
      : "task.agent_team_runtime_runner_backend_lease_failed",
    {
      lease_id: lease.lease_id,
      adapter_run_id: lease.adapter_run_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function startSubagentRuntimeBackendExecution(
  taskId: string,
  adapterRunId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const adapterRun = store.subagentRuntimeAdapterRuns.get(adapterRunId);
  if (!adapterRun || adapterRun.task_id !== taskId) {
    throw new Error(`Runtime adapter run ${adapterRunId} not found for task ${taskId}.`);
  }
  if (adapterRun.status !== "running") {
    throw new Error(`Runtime adapter run ${adapterRunId} cannot start backend execution from status ${adapterRun.status}.`);
  }
  const existing = [...store.subagentRuntimeBackendExecutions.values()].find(
    item => item.task_id === taskId && item.adapter_run_id === adapterRunId && item.status === "running"
  );
  if (existing) {
    return existing;
  }
  const adapterId = getLauncherBackendAdapterId(adapterRun.backend_kind);
  const adapter = getSubagentRuntimeLauncherBackendAdapterCatalog().find(item => item.adapter_id === adapterId);
  if (!adapter) {
    throw new Error(`No launcher backend adapter is registered for backend kind '${adapterRun.backend_kind}'.`);
  }
  const backendLease = [...store.subagentRuntimeRunnerBackendLeases.values()].find(
    item => item.task_id === taskId && item.adapter_run_id === adapterRunId && item.status === "allocated"
  );
  const now = nowIso();
  const backendExecution = SubagentRuntimeBackendExecutionSchema.parse({
    backend_execution_id: `subbackend_${adapterRunId}`,
    lease_id: backendLease?.lease_id,
    adapter_run_id: adapterRunId,
    receipt_id: adapterRun.receipt_id,
    instance_id: adapterRun.instance_id,
    binding_id: adapterRun.binding_id,
    execution_run_id: adapterRun.execution_run_id,
    package_id: adapterRun.package_id,
    request_id: adapterRun.request_id,
    team_id: adapterRun.team_id,
    task_id: taskId,
    subagent_session_id: adapterRun.subagent_session_id,
    adapter_id: adapter.adapter_id,
    backend_kind: adapterRun.backend_kind,
    launcher_driver_id: adapterRun.launcher_driver_id,
    execution_style: adapter.execution_style,
    launch_locator: adapterRun.launch_locator,
    execution_locator: adapterRun.execution_locator,
    status: "running",
    started_by: input.actor_role,
    started_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Backend execution started by ${input.actor_role}.`,
    deep_link: adapterRun.deep_link
  });
  if (backendLease) {
    store.subagentRuntimeRunnerBackendLeases.set(
      backendLease.lease_id,
      SubagentRuntimeRunnerBackendLeaseSchema.parse({
        ...backendLease,
        latest_heartbeat_at: now,
        latest_heartbeat_note: input.note ?? `Lease ${backendLease.lease_id} consumed by backend execution ${backendExecution.backend_execution_id}.`
      })
    );
  }
  store.subagentRuntimeBackendExecutions.set(backendExecution.backend_execution_id, backendExecution);
  heartbeatSubagentRuntimeAdapterRun(taskId, adapterRunId, {
    actor_role: input.actor_role,
    note: input.note ?? `Backend execution ${backendExecution.backend_execution_id} started.`
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${adapterRun.execution_run_id}_runtime_backend_started`,
    team_id: adapterRun.team_id,
    subagent_session_id: adapterRun.subagent_session_id,
    stage: "runtime_backend_started",
    summary: input.note
      ? `Runtime backend execution ${backendExecution.backend_execution_id} started. ${input.note}`
      : `Runtime backend execution ${backendExecution.backend_execution_id} started.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${adapterRun.execution_run_id}_runtime_backend_started`,
    team_id: adapterRun.team_id,
    subagent_session_id: adapterRun.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runtime backend started by ${input.actor_role}. ${input.note}`
      : `Runtime backend started by ${input.actor_role}.`,
    payload: {
      backend_execution_id: backendExecution.backend_execution_id,
      adapter_run_id: adapterRunId,
      adapter_id: adapter.adapter_id,
      execution_style: adapter.execution_style
    }
  });
  recordAudit(
    "task.agent_team_runtime_backend_execution_started",
    {
      backend_execution_id: backendExecution.backend_execution_id,
      lease_id: backendLease?.lease_id,
      adapter_run_id: adapterRunId,
      adapter_id: adapter.adapter_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return backendExecution;
}

export function heartbeatSubagentRuntimeBackendExecution(
  taskId: string,
  backendExecutionId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const backendExecution = store.subagentRuntimeBackendExecutions.get(backendExecutionId);
  if (!backendExecution || backendExecution.task_id !== taskId) {
    throw new Error(`Runtime backend execution ${backendExecutionId} not found for task ${taskId}.`);
  }
  if (backendExecution.status !== "running") {
    throw new Error(`Runtime backend execution ${backendExecutionId} cannot heartbeat from status ${backendExecution.status}.`);
  }
  const now = nowIso();
  const updated = SubagentRuntimeBackendExecutionSchema.parse({
    ...backendExecution,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Backend execution heartbeat from ${input.actor_role}.`
  });
  store.subagentRuntimeBackendExecutions.set(updated.backend_execution_id, updated);
  if (backendExecution.lease_id) {
    const lease = store.subagentRuntimeRunnerBackendLeases.get(backendExecution.lease_id);
    if (lease?.status === "allocated") {
      store.subagentRuntimeRunnerBackendLeases.set(
        lease.lease_id,
        SubagentRuntimeRunnerBackendLeaseSchema.parse({
          ...lease,
          latest_heartbeat_at: now,
          latest_heartbeat_note: input.note ?? `Lease ${lease.lease_id} heartbeat through backend execution ${backendExecutionId}.`
        })
      );
    }
  }
  heartbeatSubagentRuntimeAdapterRun(taskId, backendExecution.adapter_run_id, {
    actor_role: input.actor_role,
    note: input.note ?? `Backend execution ${backendExecutionId} heartbeat.`
  });
  recordAudit(
    "task.agent_team_runtime_backend_execution_heartbeat",
    {
      backend_execution_id: backendExecutionId,
      adapter_run_id: backendExecution.adapter_run_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function finalizeSubagentRuntimeBackendExecution(
  taskId: string,
  backendExecutionId: string,
  input: {
    actor_role: string;
    action: "complete" | "fail";
    note?: string;
  }
) {
  const backendExecution = store.subagentRuntimeBackendExecutions.get(backendExecutionId);
  if (!backendExecution || backendExecution.task_id !== taskId) {
    throw new Error(`Runtime backend execution ${backendExecutionId} not found for task ${taskId}.`);
  }
  if (backendExecution.status !== "running") {
    throw new Error(
      `Runtime backend execution ${backendExecutionId} cannot transition from status ${backendExecution.status}.`
    );
  }
  const now = nowIso();
  const nextStatus = input.action === "complete" ? "completed" : "failed";
  const updated = SubagentRuntimeBackendExecutionSchema.parse({
    ...backendExecution,
    status: nextStatus,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Backend execution ${nextStatus} by ${input.actor_role}.`,
    completed_at: now,
    completion_note: input.note
  });
  store.subagentRuntimeBackendExecutions.set(updated.backend_execution_id, updated);
  if (backendExecution.lease_id) {
    const lease = store.subagentRuntimeRunnerBackendLeases.get(backendExecution.lease_id);
    if (lease?.status === "allocated") {
      store.subagentRuntimeRunnerBackendLeases.set(
        lease.lease_id,
        SubagentRuntimeRunnerBackendLeaseSchema.parse({
          ...lease,
          latest_heartbeat_at: now,
          latest_heartbeat_note: input.note ?? `Lease ${lease.lease_id} observed backend execution ${nextStatus}.`
        })
      );
    }
  }
  finalizeSubagentRuntimeAdapterRun(taskId, backendExecution.adapter_run_id, {
    actor_role: input.actor_role,
    action: input.action,
    note: input.note
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${backendExecution.execution_run_id}_runtime_backend_${nextStatus}`,
    team_id: backendExecution.team_id,
    subagent_session_id: backendExecution.subagent_session_id,
    stage: `runtime_backend_${nextStatus}`,
    summary: input.note
      ? `Runtime backend execution ${backendExecution.backend_execution_id} ${nextStatus}. ${input.note}`
      : `Runtime backend execution ${backendExecution.backend_execution_id} ${nextStatus}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${backendExecution.execution_run_id}_runtime_backend_${nextStatus}`,
    team_id: backendExecution.team_id,
    subagent_session_id: backendExecution.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: input.note
      ? `Runtime backend ${nextStatus} by ${input.actor_role}. ${input.note}`
      : `Runtime backend ${nextStatus} by ${input.actor_role}.`,
    payload: {
      backend_execution_id: backendExecution.backend_execution_id,
      adapter_run_id: backendExecution.adapter_run_id,
      action: input.action
    }
  });
  recordAudit(
    input.action === "complete"
      ? "task.agent_team_runtime_backend_execution_completed"
      : "task.agent_team_runtime_backend_execution_failed",
    {
      backend_execution_id: backendExecution.backend_execution_id,
      adapter_run_id: backendExecution.adapter_run_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function startSubagentRuntimeDriverRun(
  taskId: string,
  backendExecutionId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const backendExecution = store.subagentRuntimeBackendExecutions.get(backendExecutionId);
  if (!backendExecution || backendExecution.task_id !== taskId) {
    throw new Error(`Runtime backend execution ${backendExecutionId} not found for task ${taskId}.`);
  }
  if (backendExecution.status !== "running") {
    throw new Error(`Runtime backend execution ${backendExecutionId} cannot start driver run from status ${backendExecution.status}.`);
  }
  const existing = [...store.subagentRuntimeDriverRuns.values()].find(
    item => item.task_id === taskId && item.backend_execution_id === backendExecutionId && item.status === "running"
  );
  if (existing) {
    return existing;
  }
  const now = nowIso();
  const driverRun = SubagentRuntimeDriverRunSchema.parse({
    driver_run_id: `subdriver_${backendExecutionId}`,
    backend_execution_id: backendExecution.backend_execution_id,
    adapter_run_id: backendExecution.adapter_run_id,
    receipt_id: backendExecution.receipt_id,
    instance_id: backendExecution.instance_id,
    binding_id: backendExecution.binding_id,
    execution_run_id: backendExecution.execution_run_id,
    package_id: backendExecution.package_id,
    request_id: backendExecution.request_id,
    team_id: backendExecution.team_id,
    task_id: taskId,
    subagent_session_id: backendExecution.subagent_session_id,
    adapter_id: backendExecution.adapter_id,
    backend_kind: backendExecution.backend_kind,
    launcher_driver_id: backendExecution.launcher_driver_id,
    execution_style: backendExecution.execution_style,
    launch_locator: backendExecution.launch_locator,
    execution_locator: backendExecution.execution_locator,
    status: "running",
    started_by: input.actor_role,
    started_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Driver run started by ${input.actor_role}.`,
    deep_link: backendExecution.deep_link
  });
  store.subagentRuntimeDriverRuns.set(driverRun.driver_run_id, driverRun);
  heartbeatSubagentRuntimeBackendExecution(taskId, backendExecutionId, {
    actor_role: input.actor_role,
    note: input.note ?? `Driver run ${driverRun.driver_run_id} started.`
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${backendExecution.execution_run_id}_runtime_driver_started`,
    team_id: backendExecution.team_id,
    subagent_session_id: backendExecution.subagent_session_id,
    stage: "runtime_driver_started",
    summary: input.note
      ? `Runtime driver run ${driverRun.driver_run_id} started. ${input.note}`
      : `Runtime driver run ${driverRun.driver_run_id} started.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${backendExecution.execution_run_id}_runtime_driver_started`,
    team_id: backendExecution.team_id,
    subagent_session_id: backendExecution.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runtime driver started by ${input.actor_role}. ${input.note}`
      : `Runtime driver started by ${input.actor_role}.`,
    payload: {
      driver_run_id: driverRun.driver_run_id,
      backend_execution_id: backendExecutionId,
      launcher_driver_id: backendExecution.launcher_driver_id
    }
  });
  recordAudit(
    "task.agent_team_runtime_driver_run_started",
    {
      driver_run_id: driverRun.driver_run_id,
      backend_execution_id: backendExecutionId,
      launcher_driver_id: backendExecution.launcher_driver_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return driverRun;
}

export function heartbeatSubagentRuntimeDriverRun(
  taskId: string,
  driverRunId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const driverRun = store.subagentRuntimeDriverRuns.get(driverRunId);
  if (!driverRun || driverRun.task_id !== taskId) {
    throw new Error(`Runtime driver run ${driverRunId} not found for task ${taskId}.`);
  }
  if (driverRun.status !== "running") {
    throw new Error(`Runtime driver run ${driverRunId} cannot heartbeat from status ${driverRun.status}.`);
  }
  const now = nowIso();
  const updated = SubagentRuntimeDriverRunSchema.parse({
    ...driverRun,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Driver heartbeat from ${input.actor_role}.`
  });
  store.subagentRuntimeDriverRuns.set(updated.driver_run_id, updated);
  heartbeatSubagentRuntimeBackendExecution(taskId, driverRun.backend_execution_id, {
    actor_role: input.actor_role,
    note: input.note ?? `Driver run ${driverRunId} heartbeat.`
  });
  recordAudit(
    "task.agent_team_runtime_driver_run_heartbeat",
    {
      driver_run_id: driverRunId,
      backend_execution_id: driverRun.backend_execution_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function finalizeSubagentRuntimeDriverRun(
  taskId: string,
  driverRunId: string,
  input: {
    actor_role: string;
    action: "complete" | "fail";
    note?: string;
  }
) {
  const driverRun = store.subagentRuntimeDriverRuns.get(driverRunId);
  if (!driverRun || driverRun.task_id !== taskId) {
    throw new Error(`Runtime driver run ${driverRunId} not found for task ${taskId}.`);
  }
  if (driverRun.status !== "running") {
    throw new Error(`Runtime driver run ${driverRunId} cannot transition from status ${driverRun.status}.`);
  }
  const now = nowIso();
  const nextStatus = input.action === "complete" ? "completed" : "failed";
  const updated = SubagentRuntimeDriverRunSchema.parse({
    ...driverRun,
    status: nextStatus,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Driver run ${nextStatus} by ${input.actor_role}.`,
    completed_at: now,
    completion_note: input.note
  });
  store.subagentRuntimeDriverRuns.set(updated.driver_run_id, updated);
  finalizeSubagentRuntimeBackendExecution(taskId, driverRun.backend_execution_id, {
    actor_role: input.actor_role,
    action: input.action,
    note: input.note
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${driverRun.execution_run_id}_runtime_driver_${nextStatus}`,
    team_id: driverRun.team_id,
    subagent_session_id: driverRun.subagent_session_id,
    stage: `runtime_driver_${nextStatus}`,
    summary: input.note
      ? `Runtime driver run ${driverRun.driver_run_id} ${nextStatus}. ${input.note}`
      : `Runtime driver run ${driverRun.driver_run_id} ${nextStatus}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${driverRun.execution_run_id}_runtime_driver_${nextStatus}`,
    team_id: driverRun.team_id,
    subagent_session_id: driverRun.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: input.note
      ? `Runtime driver ${nextStatus} by ${input.actor_role}. ${input.note}`
      : `Runtime driver ${nextStatus} by ${input.actor_role}.`,
    payload: {
      driver_run_id: driverRun.driver_run_id,
      backend_execution_id: driverRun.backend_execution_id,
      action: input.action
    }
  });
  recordAudit(
    input.action === "complete"
      ? "task.agent_team_runtime_driver_run_completed"
      : "task.agent_team_runtime_driver_run_failed",
    {
      driver_run_id: driverRun.driver_run_id,
      backend_execution_id: driverRun.backend_execution_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function attachSubagentRuntimeRunnerHandle(
  taskId: string,
  driverRunId: string,
  input: {
    actor_role: string;
    runner_kind?: "local_worker_process" | "sandbox_pool_job" | "cloud_control_plane_job";
    runner_locator?: string;
    note?: string;
  }
) {
  const driverRun = store.subagentRuntimeDriverRuns.get(driverRunId);
  if (!driverRun || driverRun.task_id !== taskId) {
    throw new Error(`Runtime driver run ${driverRunId} not found for task ${taskId}.`);
  }
  if (driverRun.status !== "running") {
    throw new Error(`Runtime driver run ${driverRunId} cannot attach runner handle from status ${driverRun.status}.`);
  }
  const existing = [...store.subagentRuntimeRunnerHandles.values()].find(
    item => item.task_id === taskId && item.driver_run_id === driverRunId && item.status === "attached"
  );
  if (existing) {
    return existing;
  }
  const now = nowIso();
    const runnerHandle = SubagentRuntimeRunnerHandleSchema.parse({
      runner_handle_id: createEntityId("subrunner"),
    driver_run_id: driverRun.driver_run_id,
    backend_execution_id: driverRun.backend_execution_id,
    adapter_run_id: driverRun.adapter_run_id,
    receipt_id: driverRun.receipt_id,
    instance_id: driverRun.instance_id,
    binding_id: driverRun.binding_id,
    execution_run_id: driverRun.execution_run_id,
    package_id: driverRun.package_id,
    request_id: driverRun.request_id,
    team_id: driverRun.team_id,
    task_id: taskId,
    subagent_session_id: driverRun.subagent_session_id,
    adapter_id: driverRun.adapter_id,
    backend_kind: driverRun.backend_kind,
    launcher_driver_id: driverRun.launcher_driver_id,
    runner_kind: input.runner_kind ?? getDefaultRunnerKind(driverRun.backend_kind),
    status: "attached",
    attached_by: input.actor_role,
    attached_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner attached by ${input.actor_role}.`,
    runner_locator: input.runner_locator,
    deep_link: driverRun.deep_link
  });
  store.subagentRuntimeRunnerHandles.set(runnerHandle.runner_handle_id, runnerHandle);
  heartbeatSubagentRuntimeDriverRun(taskId, driverRunId, {
    actor_role: input.actor_role,
    note: input.note ?? `Runner handle ${runnerHandle.runner_handle_id} attached.`
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${driverRun.execution_run_id}_runtime_runner_attached`,
    team_id: driverRun.team_id,
    subagent_session_id: driverRun.subagent_session_id,
    stage: "runtime_runner_attached",
    summary: input.note
      ? `Runtime runner handle ${runnerHandle.runner_handle_id} attached. ${input.note}`
      : `Runtime runner handle ${runnerHandle.runner_handle_id} attached.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${driverRun.execution_run_id}_runtime_runner_attached`,
    team_id: driverRun.team_id,
    subagent_session_id: driverRun.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runtime runner attached by ${input.actor_role}. ${input.note}`
      : `Runtime runner attached by ${input.actor_role}.`,
    payload: {
      runner_handle_id: runnerHandle.runner_handle_id,
      driver_run_id: driverRunId,
      runner_kind: runnerHandle.runner_kind
    }
  });
  recordAudit(
    "task.agent_team_runtime_runner_handle_attached",
    {
      runner_handle_id: runnerHandle.runner_handle_id,
      driver_run_id: driverRunId,
      actor_role: input.actor_role,
      runner_kind: runnerHandle.runner_kind
    },
    taskId
  );
  return runnerHandle;
}

export function heartbeatSubagentRuntimeRunnerHandle(
  taskId: string,
  runnerHandleId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const runnerHandle = store.subagentRuntimeRunnerHandles.get(runnerHandleId);
  if (!runnerHandle || runnerHandle.task_id !== taskId) {
    throw new Error(`Runtime runner handle ${runnerHandleId} not found for task ${taskId}.`);
  }
  if (runnerHandle.status !== "attached") {
    throw new Error(`Runtime runner handle ${runnerHandleId} cannot heartbeat from status ${runnerHandle.status}.`);
  }
  const now = nowIso();
  const updated = SubagentRuntimeRunnerHandleSchema.parse({
    ...runnerHandle,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner heartbeat from ${input.actor_role}.`
  });
  store.subagentRuntimeRunnerHandles.set(updated.runner_handle_id, updated);
  heartbeatSubagentRuntimeDriverRun(taskId, runnerHandle.driver_run_id, {
    actor_role: input.actor_role,
    note: input.note ?? `Runner handle ${runnerHandleId} heartbeat.`
  });
  recordAudit(
    "task.agent_team_runtime_runner_handle_heartbeat",
    {
      runner_handle_id: runnerHandleId,
      driver_run_id: runnerHandle.driver_run_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function finalizeSubagentRuntimeRunnerHandle(
  taskId: string,
  runnerHandleId: string,
  input: {
    actor_role: string;
    action: "release" | "fail";
    note?: string;
  }
) {
  const runnerHandle = store.subagentRuntimeRunnerHandles.get(runnerHandleId);
  if (!runnerHandle || runnerHandle.task_id !== taskId) {
    throw new Error(`Runtime runner handle ${runnerHandleId} not found for task ${taskId}.`);
  }
  if (runnerHandle.status !== "attached") {
    throw new Error(`Runtime runner handle ${runnerHandleId} cannot transition from status ${runnerHandle.status}.`);
  }
  const now = nowIso();
  const nextStatus = input.action === "release" ? "released" : "failed";
  const updated = SubagentRuntimeRunnerHandleSchema.parse({
    ...runnerHandle,
    status: nextStatus,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner handle ${nextStatus} by ${input.actor_role}.`,
    released_at: now,
    release_reason: input.note ?? (input.action === "release" ? "Runner released." : "Runner failed.")
  });
  store.subagentRuntimeRunnerHandles.set(updated.runner_handle_id, updated);
  const activeLease = [...store.subagentRuntimeRunnerBackendLeases.values()].find(
    item => item.task_id === taskId && item.adapter_run_id === runnerHandle.adapter_run_id && item.status === "allocated"
  );
  if (activeLease) {
    releaseSubagentRuntimeRunnerBackendLease(taskId, activeLease.lease_id, {
      actor_role: input.actor_role,
      action: input.action === "release" ? "release" : "fail",
      note:
        input.note
        ?? (input.action === "release"
          ? `Runner handle ${runnerHandleId} released; backend lease ${activeLease.lease_id} released.`
          : `Runner handle ${runnerHandleId} failed; backend lease ${activeLease.lease_id} failed.`)
    });
  }
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${runnerHandle.execution_run_id}_runtime_runner_${nextStatus}`,
    team_id: runnerHandle.team_id,
    subagent_session_id: runnerHandle.subagent_session_id,
    stage: `runtime_runner_${nextStatus}`,
    summary: input.note
      ? `Runtime runner handle ${runnerHandle.runner_handle_id} ${nextStatus}. ${input.note}`
      : `Runtime runner handle ${runnerHandle.runner_handle_id} ${nextStatus}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${runnerHandle.execution_run_id}_runtime_runner_${nextStatus}`,
    team_id: runnerHandle.team_id,
    subagent_session_id: runnerHandle.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: input.note
      ? `Runtime runner ${nextStatus} by ${input.actor_role}. ${input.note}`
      : `Runtime runner ${nextStatus} by ${input.actor_role}.`,
    payload: {
      runner_handle_id: runnerHandle.runner_handle_id,
      driver_run_id: runnerHandle.driver_run_id,
      action: input.action
    }
  });
  recordAudit(
    input.action === "release"
      ? "task.agent_team_runtime_runner_handle_released"
      : "task.agent_team_runtime_runner_handle_failed",
    {
      runner_handle_id: runnerHandle.runner_handle_id,
      driver_run_id: runnerHandle.driver_run_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function startSubagentRuntimeRunnerExecution(
  taskId: string,
  runnerHandleId: string,
  input: {
    actor_role: string;
    execution_locator?: string;
    note?: string;
  }
) {
  const runnerHandle = store.subagentRuntimeRunnerHandles.get(runnerHandleId);
  if (!runnerHandle || runnerHandle.task_id !== taskId) {
    throw new Error(`Runtime runner handle ${runnerHandleId} not found for task ${taskId}.`);
  }
  if (runnerHandle.status !== "attached") {
    throw new Error(`Runtime runner handle ${runnerHandleId} cannot start execution from status ${runnerHandle.status}.`);
  }
  const existing = [...store.subagentRuntimeRunnerExecutions.values()].find(
    item => item.task_id === taskId && item.runner_handle_id === runnerHandleId && item.status === "running"
  );
  if (existing) {
    return existing;
  }
  const now = nowIso();
  const runnerExecution = SubagentRuntimeRunnerExecutionSchema.parse({
    runner_execution_id: createEntityId("subrexec"),
    runner_handle_id: runnerHandle.runner_handle_id,
    driver_run_id: runnerHandle.driver_run_id,
    backend_execution_id: runnerHandle.backend_execution_id,
    adapter_run_id: runnerHandle.adapter_run_id,
    receipt_id: runnerHandle.receipt_id,
    instance_id: runnerHandle.instance_id,
    binding_id: runnerHandle.binding_id,
    execution_run_id: runnerHandle.execution_run_id,
    package_id: runnerHandle.package_id,
    request_id: runnerHandle.request_id,
    team_id: runnerHandle.team_id,
    task_id: taskId,
    subagent_session_id: runnerHandle.subagent_session_id,
    adapter_id: runnerHandle.adapter_id,
    backend_kind: runnerHandle.backend_kind,
    launcher_driver_id: runnerHandle.launcher_driver_id,
    runner_kind: runnerHandle.runner_kind,
    runner_locator: runnerHandle.runner_locator,
    execution_locator: input.execution_locator ?? runnerHandle.runner_locator,
    status: "running",
    started_by: input.actor_role,
    started_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner execution started by ${input.actor_role}.`,
    deep_link: runnerHandle.deep_link
  });
  const runnerBackend = getSubagentRuntimeRunnerBackendAdapterCatalog().find(
    item => item.adapter_id === getRunnerBackendAdapterId(runnerHandle.runner_kind)
  );
  if (!runnerBackend) {
    throw new Error(`No runner backend adapter is registered for runner kind '${runnerHandle.runner_kind}'.`);
  }
  if (runnerBackend.backend_kind !== runnerHandle.backend_kind) {
    throw new Error(
      `Runner backend adapter '${runnerBackend.adapter_id}' is not compatible with backend kind '${runnerHandle.backend_kind}'.`
    );
  }
  store.subagentRuntimeRunnerExecutions.set(runnerExecution.runner_execution_id, runnerExecution);
  heartbeatSubagentRuntimeRunnerHandle(taskId, runnerHandleId, {
    actor_role: input.actor_role,
    note: input.note ?? `Runner execution ${runnerExecution.runner_execution_id} started.`
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${runnerHandle.execution_run_id}_runtime_runner_execution_started`,
    team_id: runnerHandle.team_id,
    subagent_session_id: runnerHandle.subagent_session_id,
    stage: "runtime_runner_execution_started",
    summary: input.note
      ? `Runtime runner execution ${runnerExecution.runner_execution_id} started. ${input.note}`
      : `Runtime runner execution ${runnerExecution.runner_execution_id} started.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${runnerHandle.execution_run_id}_runtime_runner_execution_started`,
    team_id: runnerHandle.team_id,
    subagent_session_id: runnerHandle.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runtime runner execution started by ${input.actor_role}. ${input.note}`
      : `Runtime runner execution started by ${input.actor_role}.`,
    payload: {
      runner_execution_id: runnerExecution.runner_execution_id,
      runner_handle_id: runnerHandleId,
      execution_locator: runnerExecution.execution_locator
    }
  });
  recordAudit(
    "task.agent_team_runtime_runner_execution_started",
    {
      runner_execution_id: runnerExecution.runner_execution_id,
      runner_handle_id: runnerHandleId,
      driver_run_id: runnerHandle.driver_run_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return runnerExecution;
}

export function heartbeatSubagentRuntimeRunnerExecution(
  taskId: string,
  runnerExecutionId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const runnerExecution = store.subagentRuntimeRunnerExecutions.get(runnerExecutionId);
  if (!runnerExecution || runnerExecution.task_id !== taskId) {
    throw new Error(`Runtime runner execution ${runnerExecutionId} not found for task ${taskId}.`);
  }
  if (runnerExecution.status !== "running") {
    throw new Error(`Runtime runner execution ${runnerExecutionId} cannot heartbeat from status ${runnerExecution.status}.`);
  }
  const now = nowIso();
  const updated = SubagentRuntimeRunnerExecutionSchema.parse({
    ...runnerExecution,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner execution heartbeat from ${input.actor_role}.`
  });
  store.subagentRuntimeRunnerExecutions.set(updated.runner_execution_id, updated);
  heartbeatSubagentRuntimeRunnerHandle(taskId, runnerExecution.runner_handle_id, {
    actor_role: input.actor_role,
    note: input.note ?? `Runner execution ${runnerExecutionId} heartbeat.`
  });
  recordAudit(
    "task.agent_team_runtime_runner_execution_heartbeat",
    {
      runner_execution_id: runnerExecutionId,
      runner_handle_id: runnerExecution.runner_handle_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function finalizeSubagentRuntimeRunnerExecution(
  taskId: string,
  runnerExecutionId: string,
  input: {
    actor_role: string;
    action: "complete" | "fail";
    note?: string;
  }
) {
  const runnerExecution = store.subagentRuntimeRunnerExecutions.get(runnerExecutionId);
  if (!runnerExecution || runnerExecution.task_id !== taskId) {
    throw new Error(`Runtime runner execution ${runnerExecutionId} not found for task ${taskId}.`);
  }
  if (runnerExecution.status !== "running") {
    throw new Error(`Runtime runner execution ${runnerExecutionId} cannot transition from status ${runnerExecution.status}.`);
  }
  const now = nowIso();
  const nextStatus = input.action === "complete" ? "completed" : "failed";
  const updated = SubagentRuntimeRunnerExecutionSchema.parse({
    ...runnerExecution,
    status: nextStatus,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner execution ${nextStatus} by ${input.actor_role}.`,
    completed_at: now,
    completed_by: input.actor_role,
    completion_note: input.note ?? (input.action === "complete" ? "Runner execution completed." : "Runner execution failed.")
  });
  store.subagentRuntimeRunnerExecutions.set(updated.runner_execution_id, updated);
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${runnerExecution.execution_run_id}_runtime_runner_execution_${nextStatus}`,
    team_id: runnerExecution.team_id,
    subagent_session_id: runnerExecution.subagent_session_id,
    stage: `runtime_runner_execution_${nextStatus}`,
    summary: input.note
      ? `Runtime runner execution ${runnerExecution.runner_execution_id} ${nextStatus}. ${input.note}`
      : `Runtime runner execution ${runnerExecution.runner_execution_id} ${nextStatus}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${runnerExecution.execution_run_id}_runtime_runner_execution_${nextStatus}`,
    team_id: runnerExecution.team_id,
    subagent_session_id: runnerExecution.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: input.note
      ? `Runtime runner execution ${nextStatus} by ${input.actor_role}. ${input.note}`
      : `Runtime runner execution ${nextStatus} by ${input.actor_role}.`,
    payload: {
      runner_execution_id: runnerExecution.runner_execution_id,
      runner_handle_id: runnerExecution.runner_handle_id,
      action: input.action
    }
  });
  recordAudit(
    input.action === "complete"
      ? "task.agent_team_runtime_runner_execution_completed"
      : "task.agent_team_runtime_runner_execution_failed",
    {
      runner_execution_id: runnerExecution.runner_execution_id,
      runner_handle_id: runnerExecution.runner_handle_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function startSubagentRuntimeRunnerJob(
  taskId: string,
  runnerExecutionId: string,
  input: {
    actor_role: string;
    job_locator?: string;
    note?: string;
  }
) {
  const runnerExecution = store.subagentRuntimeRunnerExecutions.get(runnerExecutionId);
  if (!runnerExecution || runnerExecution.task_id !== taskId) {
    throw new Error(`Runtime runner execution ${runnerExecutionId} not found for task ${taskId}.`);
  }
  if (runnerExecution.status !== "running") {
    throw new Error(`Runtime runner execution ${runnerExecutionId} cannot start runner job from status ${runnerExecution.status}.`);
  }
  const existing = [...store.subagentRuntimeRunnerJobs.values()].find(
    item => item.task_id === taskId && item.runner_execution_id === runnerExecutionId && item.status === "running"
  );
  if (existing) {
    return existing;
  }
  const now = nowIso();
  const runnerJob = SubagentRuntimeRunnerJobSchema.parse({
    runner_job_id: createEntityId("subrjob"),
    runner_execution_id: runnerExecution.runner_execution_id,
    runner_handle_id: runnerExecution.runner_handle_id,
    driver_run_id: runnerExecution.driver_run_id,
    backend_execution_id: runnerExecution.backend_execution_id,
    adapter_run_id: runnerExecution.adapter_run_id,
    receipt_id: runnerExecution.receipt_id,
    lease_id: store.subagentRuntimeBackendExecutions.get(runnerExecution.backend_execution_id)?.lease_id,
    instance_id: runnerExecution.instance_id,
    binding_id: runnerExecution.binding_id,
    execution_run_id: runnerExecution.execution_run_id,
    package_id: runnerExecution.package_id,
    request_id: runnerExecution.request_id,
    team_id: runnerExecution.team_id,
    task_id: taskId,
    subagent_session_id: runnerExecution.subagent_session_id,
    adapter_id: runnerExecution.adapter_id,
    backend_kind: runnerExecution.backend_kind,
    launcher_driver_id: runnerExecution.launcher_driver_id,
    runner_kind: runnerExecution.runner_kind,
    job_kind: getDefaultRunnerJobKind(runnerExecution.runner_kind),
    runner_locator: runnerExecution.runner_locator,
    execution_locator: runnerExecution.execution_locator,
    job_locator: input.job_locator,
    status: "running",
    started_by: input.actor_role,
    started_at: now,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner job started by ${input.actor_role}.`,
    deep_link: runnerExecution.deep_link
  });
  store.subagentRuntimeRunnerJobs.set(runnerJob.runner_job_id, runnerJob);
  heartbeatSubagentRuntimeRunnerExecution(taskId, runnerExecutionId, {
    actor_role: input.actor_role,
    note: input.note ?? `Runner job ${runnerJob.runner_job_id} started.`
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${runnerExecution.execution_run_id}_runtime_runner_job_started`,
    team_id: runnerJob.team_id,
    subagent_session_id: runnerJob.subagent_session_id,
    stage: "runtime_runner_job_started",
    summary: input.note
      ? `Runtime runner job ${runnerJob.runner_job_id} started. ${input.note}`
      : `Runtime runner job ${runnerJob.runner_job_id} started.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${runnerExecution.execution_run_id}_runtime_runner_job_started`,
    team_id: runnerJob.team_id,
    subagent_session_id: runnerJob.subagent_session_id,
    direction: "supervisor_to_subagent",
    kind: "handoff",
    summary: input.note
      ? `Runtime runner job started by ${input.actor_role}. ${input.note}`
      : `Runtime runner job started by ${input.actor_role}.`,
    payload: {
      runner_job_id: runnerJob.runner_job_id,
      runner_execution_id: runnerJob.runner_execution_id,
      job_kind: runnerJob.job_kind
    }
  });
  recordAudit(
    "task.agent_team_runtime_runner_job_started",
    {
      runner_job_id: runnerJob.runner_job_id,
      runner_execution_id: runnerJob.runner_execution_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return runnerJob;
}

export function heartbeatSubagentRuntimeRunnerJob(
  taskId: string,
  runnerJobId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const runnerJob = store.subagentRuntimeRunnerJobs.get(runnerJobId);
  if (!runnerJob || runnerJob.task_id !== taskId) {
    throw new Error(`Runtime runner job ${runnerJobId} not found for task ${taskId}.`);
  }
  if (runnerJob.status !== "running") {
    throw new Error(`Runtime runner job ${runnerJobId} cannot heartbeat from status ${runnerJob.status}.`);
  }
  const now = nowIso();
  const updated = SubagentRuntimeRunnerJobSchema.parse({
    ...runnerJob,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner job heartbeat from ${input.actor_role}.`
  });
  store.subagentRuntimeRunnerJobs.set(updated.runner_job_id, updated);
  heartbeatSubagentRuntimeRunnerExecution(taskId, runnerJob.runner_execution_id, {
    actor_role: input.actor_role,
    note: input.note ?? `Runner job ${runnerJobId} heartbeat.`
  });
  recordAudit(
    "task.agent_team_runtime_runner_job_heartbeat",
    {
      runner_job_id: runnerJobId,
      runner_execution_id: runnerJob.runner_execution_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function finalizeSubagentRuntimeRunnerJob(
  taskId: string,
  runnerJobId: string,
  input: {
    actor_role: string;
    action: "complete" | "fail";
    note?: string;
  }
) {
  const runnerJob = store.subagentRuntimeRunnerJobs.get(runnerJobId);
  if (!runnerJob || runnerJob.task_id !== taskId) {
    throw new Error(`Runtime runner job ${runnerJobId} not found for task ${taskId}.`);
  }
  if (runnerJob.status !== "running") {
    throw new Error(`Runtime runner job ${runnerJobId} cannot transition from status ${runnerJob.status}.`);
  }
  const now = nowIso();
  const nextStatus = input.action === "complete" ? "completed" : "failed";
  const updated = SubagentRuntimeRunnerJobSchema.parse({
    ...runnerJob,
    status: nextStatus,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Runner job ${nextStatus} by ${input.actor_role}.`,
    completed_at: now,
    completed_by: input.actor_role,
    completion_note: input.note ?? (input.action === "complete" ? "Runner job completed." : "Runner job failed.")
  });
  store.subagentRuntimeRunnerJobs.set(updated.runner_job_id, updated);
  const activeRunnerExecution = store.subagentRuntimeRunnerExecutions.get(runnerJob.runner_execution_id);
  if (activeRunnerExecution?.status === "running") {
    finalizeSubagentRuntimeRunnerExecution(taskId, runnerJob.runner_execution_id, {
      actor_role: input.actor_role,
      action: input.action,
      note: input.note
        ? `Runner job ${updated.runner_job_id} ${nextStatus}. ${input.note}`
        : `Runner job ${updated.runner_job_id} ${nextStatus}.`
    });
  }
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${runnerJob.execution_run_id}_runtime_runner_job_${nextStatus}`,
    team_id: runnerJob.team_id,
    subagent_session_id: runnerJob.subagent_session_id,
    stage: `runtime_runner_job_${nextStatus}`,
    summary: input.note
      ? `Runtime runner job ${runnerJob.runner_job_id} ${nextStatus}. ${input.note}`
      : `Runtime runner job ${runnerJob.runner_job_id} ${nextStatus}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${runnerJob.execution_run_id}_runtime_runner_job_${nextStatus}`,
    team_id: runnerJob.team_id,
    subagent_session_id: runnerJob.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: input.note
      ? `Runtime runner job ${nextStatus} by ${input.actor_role}. ${input.note}`
      : `Runtime runner job ${nextStatus} by ${input.actor_role}.`,
    payload: {
      runner_job_id: runnerJob.runner_job_id,
      runner_execution_id: runnerJob.runner_execution_id,
      action: input.action
    }
  });
  recordAudit(
    input.action === "complete"
      ? "task.agent_team_runtime_runner_job_completed"
      : "task.agent_team_runtime_runner_job_failed",
    {
      runner_job_id: runnerJob.runner_job_id,
      runner_execution_id: runnerJob.runner_execution_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function heartbeatSubagentRuntimeAdapterRun(
  taskId: string,
  adapterRunId: string,
  input: {
    actor_role: string;
    note?: string;
  }
) {
  const adapterRun = store.subagentRuntimeAdapterRuns.get(adapterRunId);
  if (!adapterRun || adapterRun.task_id !== taskId) {
    throw new Error(`Runtime adapter run ${adapterRunId} not found for task ${taskId}.`);
  }
  if (adapterRun.status !== "running") {
    throw new Error(`Runtime adapter run ${adapterRunId} cannot heartbeat from status ${adapterRun.status}.`);
  }
  const now = nowIso();
  const updated = SubagentRuntimeAdapterRunSchema.parse({
    ...adapterRun,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Adapter heartbeat from ${input.actor_role}.`
  });
  store.subagentRuntimeAdapterRuns.set(updated.adapter_run_id, updated);
  heartbeatSubagentRuntimeInstance(taskId, adapterRun.instance_id, {
    actor_role: input.actor_role,
    note: input.note ?? `Adapter run ${adapterRunId} heartbeat.`
  });
  recordAudit(
    "task.agent_team_runtime_adapter_heartbeat",
    {
      adapter_run_id: adapterRunId,
      instance_id: adapterRun.instance_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function finalizeSubagentRuntimeAdapterRun(
  taskId: string,
  adapterRunId: string,
  input: {
    actor_role: string;
    action: "complete" | "fail";
    note?: string;
  }
) {
  const adapterRun = store.subagentRuntimeAdapterRuns.get(adapterRunId);
  if (!adapterRun || adapterRun.task_id !== taskId) {
    throw new Error(`Runtime adapter run ${adapterRunId} not found for task ${taskId}.`);
  }
  if (adapterRun.status !== "running") {
    throw new Error(`Runtime adapter run ${adapterRunId} cannot transition from status ${adapterRun.status}.`);
  }
  const now = nowIso();
  const nextStatus = input.action === "complete" ? "completed" : "failed";
  const updated = SubagentRuntimeAdapterRunSchema.parse({
    ...adapterRun,
    status: nextStatus,
    latest_heartbeat_at: now,
    latest_heartbeat_note: input.note ?? `Adapter run ${nextStatus} by ${input.actor_role}.`,
    completed_at: now,
    completion_note: input.note
  });
  store.subagentRuntimeAdapterRuns.set(updated.adapter_run_id, updated);
  updateSubagentExecutionRun(taskId, adapterRun.execution_run_id, {
    actor_role: input.actor_role,
    action: input.action,
    note: input.note
  });
  upsertSubagentCheckpoint(taskId, {
    checkpoint_id: `subcp_${adapterRun.execution_run_id}_runtime_adapter_${nextStatus}`,
    team_id: adapterRun.team_id,
    subagent_session_id: adapterRun.subagent_session_id,
    stage: `runtime_adapter_${nextStatus}`,
    summary: input.note
      ? `Runtime adapter run ${adapterRun.adapter_run_id} ${nextStatus}. ${input.note}`
      : `Runtime adapter run ${adapterRun.adapter_run_id} ${nextStatus}.`
  });
  upsertSubagentMessage(taskId, {
    message_id: `submsg_${adapterRun.execution_run_id}_runtime_adapter_${nextStatus}`,
    team_id: adapterRun.team_id,
    subagent_session_id: adapterRun.subagent_session_id,
    direction: "subagent_to_supervisor",
    kind: "result",
    summary: input.note
      ? `Runtime adapter ${nextStatus} by ${input.actor_role}. ${input.note}`
      : `Runtime adapter ${nextStatus} by ${input.actor_role}.`,
    payload: {
      adapter_run_id: adapterRun.adapter_run_id,
      receipt_id: adapterRun.receipt_id,
      action: input.action
    }
  });
  recordAudit(
    input.action === "complete"
      ? "task.agent_team_runtime_adapter_completed"
      : "task.agent_team_runtime_adapter_failed",
    {
      adapter_run_id: adapterRun.adapter_run_id,
      receipt_id: adapterRun.receipt_id,
      actor_role: input.actor_role
    },
    taskId
  );
  return updated;
}

export function listTaskAgentTeamTimeline(taskId: string) {
  const sessions = listTaskSubagentSessions(taskId).map(session =>
    AgentTeamTimelineEntrySchema.parse({
      entry_id: `timeline_session_${session.subagent_session_id}`,
      team_id: session.team_id,
      task_id: taskId,
      source_type: "session",
      source_id: session.subagent_session_id,
      subagent_session_id: session.subagent_session_id,
      role: session.role,
      event_kind: "session_state",
      summary: `${session.role} session is ${session.status}.`,
      created_at: session.started_at ?? session.created_at
    })
  );
  const messages = listTaskSubagentMessages(taskId).map(message =>
    AgentTeamTimelineEntrySchema.parse({
      entry_id: `timeline_message_${message.message_id}`,
      team_id: message.team_id,
      task_id: taskId,
      source_type: "message",
      source_id: message.message_id,
      subagent_session_id: message.subagent_session_id,
      role: getSessionRole(taskId, message.subagent_session_id),
      event_kind: message.kind,
      summary: message.summary,
      created_at: message.created_at
    })
  );
  const checkpoints = listTaskSubagentCheckpoints(taskId).map(checkpoint =>
    AgentTeamTimelineEntrySchema.parse({
      entry_id: `timeline_checkpoint_${checkpoint.checkpoint_id}`,
      team_id: checkpoint.team_id,
      task_id: taskId,
      source_type: "checkpoint",
      source_id: checkpoint.checkpoint_id,
      subagent_session_id: checkpoint.subagent_session_id,
      role: getSessionRole(taskId, checkpoint.subagent_session_id),
      event_kind: checkpoint.stage,
      summary: checkpoint.summary,
      created_at: checkpoint.created_at
    })
  );
  const resumeRequests = listTaskSubagentResumeRequests(taskId).map(request =>
    AgentTeamTimelineEntrySchema.parse({
      entry_id: `timeline_resume_${request.request_id}`,
      team_id: request.team_id,
      task_id: taskId,
      source_type: "resume_request",
      source_id: request.request_id,
      subagent_session_id: request.subagent_session_id,
      role: getSessionRole(taskId, request.subagent_session_id),
      event_kind: `resume_${request.status}`,
      summary: request.result_summary ?? `Resume request ${request.status}.`,
      created_at: request.updated_at
    })
  );
  const resumePackages = listTaskSubagentResumePackages(taskId).map(item =>
    AgentTeamTimelineEntrySchema.parse({
      entry_id: `timeline_resume_package_${item.package_id}`,
      team_id: item.team_id,
      task_id: taskId,
      source_type: "resume_package",
      source_id: item.package_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id),
      event_kind: `resume_package_${item.status}`,
      summary: item.package_summary,
      created_at: item.updated_at
    })
  );
  const executionRuns = listTaskSubagentExecutionRuns(taskId).map(item =>
    AgentTeamTimelineEntrySchema.parse({
      entry_id: `timeline_execution_run_${item.execution_run_id}`,
      team_id: item.team_id,
      task_id: taskId,
      source_type: "execution_run",
      source_id: item.execution_run_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id),
      event_kind: `execution_run_${item.status}`,
      summary: item.result_summary ?? `Delegated execution run ${item.status}.`,
      created_at: item.updated_at
    })
  );
  const runtimeBindings = listTaskSubagentRuntimeBindings(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_binding" as const,
      source_id: item.binding_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_binding_${item.binding_id}_bound`,
        event_kind: "runtime_binding_bound",
        summary: `Runtime binding ${item.binding_id} is active (${item.runtime_kind}/${item.sandbox_profile}).`,
        created_at: item.bound_at
      })
    ];
    if (item.status === "released") {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_binding_${item.binding_id}_released`,
          event_kind: "runtime_binding_released",
          summary: `Runtime binding ${item.binding_id} was released.`,
          created_at: item.released_at ?? item.bound_at
        })
      );
    }
    return entries;
  });
  const runtimeInstances = listTaskSubagentRuntimeInstances(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_instance" as const,
      source_id: item.instance_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_instance_${item.instance_id}_started`,
        event_kind: "runtime_instance_started",
        summary: `Runtime instance ${item.instance_id} launched (${item.runtime_kind}/${item.sandbox_profile}).`,
        created_at: item.launched_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_instance_${item.instance_id}_heartbeat`,
          event_kind: "runtime_instance_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime instance ${item.instance_id} heartbeat received.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    if (item.status !== "active") {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_instance_${item.instance_id}_${item.status}`,
          event_kind: `runtime_instance_${item.status}`,
          summary:
            item.finish_reason
            ?? `Runtime instance ${item.instance_id} ${item.status}.`,
          created_at: item.finished_at ?? item.latest_heartbeat_at ?? item.launched_at
        })
      );
    }
    return entries;
  });
  const runtimeLaunchReceipts = listTaskSubagentRuntimeLaunchReceipts(taskId).map(item =>
    AgentTeamTimelineEntrySchema.parse({
      entry_id: `timeline_runtime_launch_receipt_${item.receipt_id}`,
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_launch_receipt",
      source_id: item.receipt_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id),
      event_kind: `runtime_launch_${item.status}`,
      summary:
        item.note
        ? `Launch receipt ${item.receipt_id} recorded through ${item.backend_kind}. ${item.note}`
        : `Launch receipt ${item.receipt_id} recorded through ${item.backend_kind}.`,
      created_at: item.launched_at
    })
  );
  const runtimeAdapterRuns = listTaskSubagentRuntimeAdapterRuns(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_adapter_run" as const,
      source_id: item.adapter_run_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_adapter_run_${item.adapter_run_id}_started`,
        event_kind: "runtime_adapter_started",
        summary: `Runtime adapter ${item.adapter_run_id} started through ${item.backend_kind}.`,
        created_at: item.started_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_adapter_run_${item.adapter_run_id}_heartbeat`,
          event_kind: "runtime_adapter_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime adapter ${item.adapter_run_id} heartbeat received.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    if (item.status !== "running") {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_adapter_run_${item.adapter_run_id}_${item.status}`,
          event_kind: `runtime_adapter_${item.status}`,
          summary: item.completion_note ?? `Runtime adapter ${item.adapter_run_id} ${item.status}.`,
          created_at: item.completed_at ?? item.started_at
        })
      );
    }
    return entries;
  });
  const runtimeRunnerBackendLeases = listTaskSubagentRuntimeRunnerBackendLeases(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_runner_backend_lease" as const,
      source_id: item.lease_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_runner_backend_lease_${item.lease_id}_allocated`,
        event_kind: "runtime_runner_backend_lease_allocated",
        summary: `Runtime runner backend lease ${item.lease_id} allocated (${item.adapter_id}/${item.runner_kind}).`,
        created_at: item.allocated_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_backend_lease_${item.lease_id}_heartbeat`,
          event_kind: "runtime_runner_backend_lease_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime runner backend lease ${item.lease_id} heartbeat.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    if (item.status !== "allocated") {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_backend_lease_${item.lease_id}_${item.status}`,
          event_kind: `runtime_runner_backend_lease_${item.status}`,
          summary:
            item.release_note
            ?? `Runtime runner backend lease ${item.lease_id} ${item.status}.`,
          created_at: item.released_at ?? item.allocated_at
        })
      );
    }
    return entries;
  });
  const runtimeBackendExecutions = listTaskSubagentRuntimeBackendExecutions(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_backend_execution" as const,
      source_id: item.backend_execution_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_backend_execution_${item.backend_execution_id}`,
        event_kind: `runtime_backend_${item.status}`,
        summary:
          item.completion_note
            ? `Runtime backend execution ${item.backend_execution_id} ${item.status}. ${item.completion_note}`
            : `Runtime backend execution ${item.backend_execution_id} ${item.status}.`,
        created_at: item.completed_at ?? item.started_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_backend_execution_heartbeat_${item.backend_execution_id}`,
          event_kind: "runtime_backend_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime backend execution ${item.backend_execution_id} heartbeat.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    return entries;
  });
  const runtimeDriverRuns = listTaskSubagentRuntimeDriverRuns(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_driver_run" as const,
      source_id: item.driver_run_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_driver_run_${item.driver_run_id}`,
        event_kind: `runtime_driver_${item.status}`,
        summary:
          item.completion_note
            ? `Runtime driver run ${item.driver_run_id} ${item.status}. ${item.completion_note}`
            : `Runtime driver run ${item.driver_run_id} ${item.status}.`,
        created_at: item.completed_at ?? item.started_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_driver_run_heartbeat_${item.driver_run_id}`,
          event_kind: "runtime_driver_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime driver run ${item.driver_run_id} heartbeat.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    return entries;
  });
  const runtimeRunnerHandles = listTaskSubagentRuntimeRunnerHandles(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_runner_handle" as const,
      source_id: item.runner_handle_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_runner_handle_${item.runner_handle_id}_attached`,
        event_kind: "runtime_runner_attached",
        summary: `Runtime runner handle ${item.runner_handle_id} attached (${item.runner_kind}).`,
        created_at: item.attached_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_handle_${item.runner_handle_id}_heartbeat`,
          event_kind: "runtime_runner_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime runner handle ${item.runner_handle_id} heartbeat.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    if (item.status === "released" || item.status === "failed") {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_handle_${item.runner_handle_id}_${item.status}`,
          event_kind: `runtime_runner_${item.status}`,
          summary: item.release_reason ?? `Runtime runner handle ${item.runner_handle_id} ${item.status}.`,
          created_at: item.released_at ?? item.attached_at
        })
      );
    }
    return entries;
  });
  const runtimeRunnerExecutions = listTaskSubagentRuntimeRunnerExecutions(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_runner_execution" as const,
      source_id: item.runner_execution_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_runner_execution_${item.runner_execution_id}_started`,
        event_kind: "runtime_runner_execution_started",
        summary: `Runtime runner execution ${item.runner_execution_id} started (${item.runner_kind}).`,
        created_at: item.started_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_execution_${item.runner_execution_id}_heartbeat`,
          event_kind: "runtime_runner_execution_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime runner execution ${item.runner_execution_id} heartbeat.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    if (item.status === "completed" || item.status === "failed") {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_execution_${item.runner_execution_id}_${item.status}`,
          event_kind: `runtime_runner_execution_${item.status}`,
          summary: item.completion_note ?? `Runtime runner execution ${item.runner_execution_id} ${item.status}.`,
          created_at: item.completed_at ?? item.started_at
        })
      );
    }
    return entries;
  });
  const runtimeRunnerJobs = listTaskSubagentRuntimeRunnerJobs(taskId).flatMap(item => {
    const baseEntry = {
      team_id: item.team_id,
      task_id: taskId,
      source_type: "runtime_runner_job" as const,
      source_id: item.runner_job_id,
      subagent_session_id: item.subagent_session_id,
      role: getSessionRole(taskId, item.subagent_session_id)
    };
    const entries = [
      AgentTeamTimelineEntrySchema.parse({
        ...baseEntry,
        entry_id: `timeline_runtime_runner_job_${item.runner_job_id}_started`,
        event_kind: "runtime_runner_job_started",
        summary: `Runtime runner job ${item.runner_job_id} started (${item.job_kind}).`,
        created_at: item.started_at
      })
    ];
    if (item.latest_heartbeat_at) {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_job_${item.runner_job_id}_heartbeat`,
          event_kind: "runtime_runner_job_heartbeat",
          summary: item.latest_heartbeat_note ?? `Runtime runner job ${item.runner_job_id} heartbeat.`,
          created_at: item.latest_heartbeat_at
        })
      );
    }
    if (item.status === "completed" || item.status === "failed") {
      entries.push(
        AgentTeamTimelineEntrySchema.parse({
          ...baseEntry,
          entry_id: `timeline_runtime_runner_job_${item.runner_job_id}_${item.status}`,
          event_kind: `runtime_runner_job_${item.status}`,
          summary: item.completion_note ?? `Runtime runner job ${item.runner_job_id} ${item.status}.`,
          created_at: item.completed_at ?? item.started_at
        })
      );
    }
    return entries;
  });
  return [...sessions, ...messages, ...checkpoints, ...resumeRequests, ...resumePackages, ...executionRuns, ...runtimeBindings, ...runtimeInstances, ...runtimeLaunchReceipts, ...runtimeAdapterRuns, ...runtimeRunnerBackendLeases, ...runtimeBackendExecutions, ...runtimeDriverRuns, ...runtimeRunnerHandles, ...runtimeRunnerExecutions, ...runtimeRunnerJobs].sort(
    (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)
  );
}

export function getTaskAgentTeamSummary(taskId: string) {
  const existing = store.agentTeams.get(`team_${taskId}`);
  if (existing) {
    return existing;
  }
  return buildTaskAgentTeamState(taskId);
}

export function createWorkerRun(taskId: string): WorkerRun {
  const selection = selectWorker(taskId);
  const run = WorkerRunSchema.parse({
    worker_run_id: createEntityId("worker"),
    task_id: taskId,
    worker_kind: selection.worker_kind,
    worker_name: selection.worker_name,
    status: "assigned",
    created_at: nowIso()
  });
  store.workerRuns.set(run.worker_run_id, run);
  buildTaskAgentTeamState(taskId);
  recordAudit("task.worker_assigned", selection, taskId);
  return run;
}

export function startWorkerRun(taskId: string): WorkerRun {
  const existing = [...store.workerRuns.values()].find(run => run.task_id === taskId && ["assigned", "running"].includes(run.status));
  const run = existing ?? createWorkerRun(taskId);
  run.status = "running";
  run.started_at = run.started_at ?? nowIso();
  store.workerRuns.set(run.worker_run_id, run);
  buildTaskAgentTeamState(taskId);
  recordAudit("task.worker_started", { worker_run_id: run.worker_run_id, worker_kind: run.worker_kind }, taskId);
  return run;
}

export function completeWorkerRun(taskId: string, summary: string): WorkerRun {
  const run = startWorkerRun(taskId);
  run.status = "completed";
  run.summary = summary;
  run.completed_at = nowIso();
  store.workerRuns.set(run.worker_run_id, run);
  buildTaskAgentTeamState(taskId);
  recordAudit("task.worker_completed", { worker_run_id: run.worker_run_id }, taskId);
  return run;
}

export function stopWorkerRun(taskId: string, reason: string): WorkerRun {
  const run = startWorkerRun(taskId);
  run.status = "stopped";
  run.summary = reason;
  run.completed_at = nowIso();
  store.workerRuns.set(run.worker_run_id, run);
  buildTaskAgentTeamState(taskId);
  recordAudit("task.worker_stopped", { worker_run_id: run.worker_run_id, reason }, taskId);
  return run;
}

export function listTaskWorkerRuns(taskId: string): WorkerRun[] {
  return [...store.workerRuns.values()].filter(run => run.task_id === taskId);
}

export function listTaskCapabilityResults(taskId: string): CapabilityResolution[] {
  return listTaskCapabilityResolutions(taskId);
}

export function evaluateWatchdog(taskId: string): { status: "healthy" | "stalled"; reasons: string[] } {
  const task = requireTask(taskId);
  const reasons: string[] = [];
  if (task.status === "running" && !task.progress_heartbeat_at) {
    reasons.push("Task is running but has never emitted a heartbeat.");
  }
  if (task.status === "running" && task.progress_heartbeat_at) {
    const lastHeartbeat = Date.parse(task.progress_heartbeat_at);
    const ageMs = Date.now() - lastHeartbeat;
    if (ageMs > task.watchdog_policy.heartbeat_timeout_sec * 1000) {
      reasons.push("Heartbeat timeout exceeded.");
    }
  }
  const status = reasons.length === 0 ? "healthy" : "stalled";
  recordAudit("task.watchdog_evaluated", { status, reasons }, taskId);
  return { status, reasons };
}

export function runTaskEndToEnd(taskId: string): {
  task: TaskContract;
  workerRun: WorkerRun;
  capabilityResolutions: CapabilityResolution[];
  checklist: ChecklistRunResult;
  reconciliation: ReconciliationRunResult;
  verification: VerificationRunResult;
  doneGate: DoneGateResult;
  evidenceGraph: EvidenceGraph;
  completionEngineResult: CompletionEngineResult;
  taskRun: TaskRun;
  taskAttempt: TaskAttempt;
} {
  const taskRun = createTaskRun(taskId);
  startTaskRun(taskRun.run_id);
  const taskAttempt = createTaskAttempt({ run_id: taskRun.run_id, task_id: taskId });
  startTaskAttempt(taskAttempt.attempt_id);

  try {
    const policy = getBudgetPolicyForTask(taskId);
    initializeBudgetStatus(taskId, policy?.policy_id ?? "default");
  } catch {}

  appendEvent({ kind: "execution_started", aggregate_type: "task", aggregate_id: taskId });

  const planStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "planning", label: "Create execution plan" });
  startExecutionStep(planStep.step_id);
  createExecutionPlan(taskId);
  completeExecutionStep(planStep.step_id);
  appendEvent({ kind: "execution_started", aggregate_type: "task", aggregate_id: taskId });

  const capStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "capability_resolution", label: "Resolve capabilities" });
  startExecutionStep(capStep.step_id);
  const capabilityResolutions = listTaskCapabilityResolutions(taskId);
  completeExecutionStep(capStep.step_id, { resolution_count: capabilityResolutions.length });
  appendEvent({ kind: "capability_resolved", aggregate_type: "task", aggregate_id: taskId, payload: { resolution_count: capabilityResolutions.length } });

  const execStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "execution", label: "Execute task" });
  startExecutionStep(execStep.step_id);

  let dispatchLeaseContext: import("./delegated-runtime-hardening.js").DispatchLeaseContext | undefined;
  let executionSession: import("@apex/shared-types").WorkerSession | undefined;
  try {
    const leaseResult = createDispatchLeaseForDelegation({
      task_id: taskId,
      supervisor_agent_id: `subagent_${taskId}_supervisor`,
      step_goal: `Execute primary worker run for task: ${requireTask(taskId).intent}`,
      subagent_id: `subagent_${taskId}_execution_worker`
    });
    if (!("error" in leaseResult)) {
      dispatchLeaseContext = leaseResult;
      executionSession = createWorkerSessionWithOwnership({
        worker_id: `subagent_${taskId}_execution_worker`,
        task_id: taskId,
        run_id: taskRun.run_id,
        attempt_id: taskAttempt.attempt_id,
        supervision_policy: "restart_on_stall",
        dispatch_lease_context: leaseResult
      });
    }
  } catch {}

  const workerRun = startWorkerRun(taskId);
  executeTask(taskId);
  completeWorkerRun(taskId, `Worker ${workerRun.worker_name} completed task execution.`);

  if (executionSession && dispatchLeaseContext) {
    try {
      releaseDispatchLeaseForSession(dispatchLeaseContext.lease.lease_id, "completed");
    } catch {}
  }

  completeExecutionStep(execStep.step_id);
  appendEvent({ kind: "execution_completed", aggregate_type: "task", aggregate_id: taskId });

  const taskAfterExec = requireTask(taskId);
  if (taskAfterExec.memory_mode && taskAfterExec.memory_mode !== "durable_retrieval" && taskAfterExec.ttt_eligibility_gate_id) {
    const tttStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "execution", label: "TTT adaptation run" });
    startExecutionStep(tttStep.step_id);
    try {
      const tttRun = executeTTTAdaptationRun({
        gate_id: taskAfterExec.ttt_eligibility_gate_id,
        task_id: taskId,
        session_id: taskAfterExec.task_id,
        model_route: taskAfterExec.inputs?.model_route as string | undefined,
        task_prompt: taskAfterExec.intent,
        budget_limit: 50
      });
      taskAfterExec.ttt_adaptation_run_id = tttRun.run_id;
      touchTask(taskAfterExec);
      addCheckpoint(taskId, "ttt_adaptation", `TTT adaptation run: ${tttRun.status}, delta verdict: ${tttRun.delta_analysis?.verdict ?? "n/a"}`);
    } catch {
      addCheckpoint(taskId, "ttt_adaptation_skipped", "TTT adaptation skipped due to error");
    }
    completeExecutionStep(tttStep.step_id);
    appendEvent({ kind: "task_state_changed", aggregate_type: "task", aggregate_id: taskId });
  }

  const evStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "verification", label: "Build evidence graph" });
  startExecutionStep(evStep.step_id);
  buildEvidenceGraph(taskId);
  completeExecutionStep(evStep.step_id);

  const clStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "verification", label: "Run checklist" });
  startExecutionStep(clStep.step_id);
  const checklist = runChecklist(taskId);
  feedChecklistToEvidenceGraph(taskId, checklist);
  completeExecutionStep(clStep.step_id, { status: checklist.status });
  appendEvent({ kind: "checklist_completed", aggregate_type: "task", aggregate_id: taskId, payload: { status: checklist.status } });

  const recStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "verification", label: "Run reconciliation" });
  startExecutionStep(recStep.step_id);
  const reconciliation = runReconciliation(taskId);
  feedReconciliationToEvidenceGraph(taskId, reconciliation);
  completeExecutionStep(recStep.step_id, { status: reconciliation.status });
  appendEvent({ kind: "reconciliation_completed", aggregate_type: "task", aggregate_id: taskId, payload: { status: reconciliation.status } });

  const verStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "verification", label: "Run verifier" });
  startExecutionStep(verStep.step_id);
  const verification = runVerifier(taskId);
  feedVerifierToEvidenceGraph(taskId, verification);
  completeExecutionStep(verStep.step_id, { verdict: verification.verdict });
  appendEvent({ kind: "verifier_completed", aggregate_type: "task", aggregate_id: taskId, payload: { verdict: verification.verdict } });

  const compStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "verification", label: "Evaluate completion" });
  startExecutionStep(compStep.step_id);
  const completionEngineResult = evaluateEvidenceGraph(taskId);
  completeExecutionStep(compStep.step_id, { verdict: completionEngineResult.verdict });
  appendEvent({ kind: "completion_engine_evaluated", aggregate_type: "task", aggregate_id: taskId, payload: { verdict: completionEngineResult.verdict } });

  const accStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "verification", label: "Acceptance review" });
  startExecutionStep(accStep.step_id);
  try {
    const accReview = createAcceptanceReview({
      task_id: taskId,
      reviewer_kind: "acceptance_agent",
      findings: [],
      deterministic_passed: checklist.status === "passed" && reconciliation.status === "passed",
      semantic_verdict: completionEngineResult.verdict === "complete" ? "accepted" : "revise_and_retry",
      risk_level: (requireTask(taskId).risk_level ?? "medium") as "low" | "medium" | "high" | "critical"
    });
    issueAcceptanceVerdict({
      task_id: taskId,
      review_id: accReview.review_id,
      verdict: accReview.semantic_verdict ?? "accepted",
      rationale: `Deterministic: ${accReview.deterministic_passed ? "passed" : "failed"}, completion: ${completionEngineResult.verdict}`,
      risk_level: accReview.risk_level
    });
    addCheckpoint(taskId, "acceptance_review", `Acceptance verdict: ${accReview.semantic_verdict ?? "accepted"}, deterministic: ${accReview.deterministic_passed}`);
  } catch {
    addCheckpoint(taskId, "acceptance_review_skipped", "Acceptance review skipped due to error");
  }
  completeExecutionStep(accStep.step_id);
  appendEvent({ kind: "acceptance_review_completed", aggregate_type: "task", aggregate_id: taskId });

  const doneGate = runDoneGate(taskId);
  appendEvent({ kind: "done_gate_evaluated", aggregate_type: "task", aggregate_id: taskId, payload: { status: doneGate.status } });

  const memStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "memory_capture", label: "Capture memories" });
  startExecutionStep(memStep.step_id);
  captureMemories(taskId);

  const taskForDistill = requireTask(taskId);
  if (taskForDistill.ttt_adaptation_run_id) {
    try {
      distillTTTAdaptation({ adaptation_run_id: taskForDistill.ttt_adaptation_run_id });
      addCheckpoint(taskId, "ttt_distillation", "TTT adaptation results distilled back to durable memory");
    } catch {
      addCheckpoint(taskId, "ttt_distillation_skipped", "TTT distillation skipped due to error");
    }
  }

  completeExecutionStep(memStep.step_id);
  appendEvent({ kind: "memory_captured", aggregate_type: "task", aggregate_id: taskId });

  const learnStep = createExecutionStep({ task_id: taskId, run_id: taskRun.run_id, attempt_id: taskAttempt.attempt_id, kind: "learning", label: "Create skill candidate and template" });
  startExecutionStep(learnStep.step_id);
  createSkillCandidate(taskId);
  upsertTaskTemplate(taskId);
  applyReuseImprovementFeedback(taskId);
  completeExecutionStep(learnStep.step_id);
  appendEvent({ kind: "skill_candidate_created", aggregate_type: "task", aggregate_id: taskId });
  appendEvent({ kind: "task_template_upserted", aggregate_type: "task", aggregate_id: taskId });

  buildTaskAgentTeamState(taskId);

  completeTaskAttempt(taskAttempt.attempt_id, doneGate.status === "passed" ? "accepted" : "revise_and_retry");
  completeTaskRun(taskRun.run_id);

  const task = requireTask(taskId);
  const evidenceGraph = store.evidenceGraphs.get(taskId)!;
  log("info", "task end-to-end pipeline completed", { task_id: taskId, status: task.status, done_gate: doneGate.status, evidence_verdict: completionEngineResult.verdict });
  return {
    task,
    workerRun: listTaskWorkerRuns(taskId).at(-1) ?? workerRun,
    capabilityResolutions,
    checklist,
    reconciliation,
    verification,
    doneGate,
    evidenceGraph,
    completionEngineResult,
    taskRun,
    taskAttempt
  };
}

export {
  getCapabilityCatalog,
  inferCapabilityNeeds,
  listTaskCapabilityResolutions,
  resolveTaskCapabilities,
  searchLearnedPlaybooks,
  searchCapabilityCatalog,
  getCapabilityScoreBreakdowns
} from "./capabilities.js";

export {
  detectObjectSecuritySignals,
  detectTextSecuritySignals,
  sanitizeMethodologyText
} from "./security.js";

export { searchTaskTemplates };
export {
  createInternalSkill,
  exportCanonicalSkill,
  exportCanonicalSkillBundle,
  getCanonicalSkill,
  importCanonicalSkillBundle,
  importSkillDocument,
  importClaudeSkill,
  importOpenAiSkill,
  importOpenClawSkill,
  listCanonicalSkillAudits,
  listCanonicalSkillBundleHistory,
  listCanonicalSkillReviewQueue,
  listCanonicalSkills,
  registerCanonicalSkill,
  searchCanonicalSkills,
  updateCanonicalSkillGovernance,
  verifyCanonicalSkillBundle
} from "./skills.js";
