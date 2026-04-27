import {
  createEntityId,
  nowIso,
  type ExternalReadinessStatus
} from "@apex/shared-types";

export interface ReadinessTestResult {
  test_id: string;
  test_name: string;
  layer: string;
  passed: boolean;
  error_message?: string;
  duration_ms: number;
  details: Record<string, unknown>;
}

export interface ReadinessSuiteResult {
  suite_id: string;
  total_tests: number;
  passed: number;
  failed: number;
  results: ReadinessTestResult[];
  layer_summaries: Record<string, { total: number; passed: number; failed: number }>;
  duration_ms: number;
  run_at: string;
}

function createTestResult(name: string, layer: string, fn: () => void): ReadinessTestResult {
  const start = Date.now();
  try {
    fn();
    return {
      test_id: createEntityId("rdytst"),
      test_name: name,
      layer,
      passed: true,
      duration_ms: Date.now() - start,
      details: {}
    };
  } catch (err) {
    return {
      test_id: createEntityId("rdytst"),
      test_name: name,
      layer,
      passed: false,
      error_message: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start,
      details: {}
    };
  }
}

export function runCloudControlPlaneReadinessSuite(): ReadinessSuiteResult {
  const results: ReadinessTestResult[] = [];
  const suiteStart = Date.now();
  const layer = "cloud_control_plane";

  const {
    createCloudControlPlaneConfig,
    prepareSyncEnvelope,
    simulateSyncSend,
    getCloudReadinessDiagnostics,
    getOrgAuditAggregationContract,
    getMultiDeviceSessionSyncContract,
    getCloudHealthEndpointContracts,
    getBootstrapManifest
  } = require("./cloud-control-plane-readiness.js") as typeof import("./cloud-control-plane-readiness.js");

  results.push(createTestResult("config_creation", layer, () => {
    const config = createCloudControlPlaneConfig({ mode: "local_only" });
    if (config.mode !== "local_only") throw new Error("Mode not set");
    if (config.auth_provider !== "none") throw new Error("Default auth should be none");
  }));

  results.push(createTestResult("sync_envelope_preparation", layer, () => {
    const envelope = prepareSyncEnvelope({ sync_kind: "audit_upload" });
    if (envelope.status !== "prepared") throw new Error("Envelope should be prepared");
    if (envelope.sync_kind !== "audit_upload") throw new Error("Sync kind not set");
  }));

  results.push(createTestResult("sync_send_local_only_mode", layer, () => {
    createCloudControlPlaneConfig({ mode: "local_only" });
    const envelope = prepareSyncEnvelope({ sync_kind: "session_sync" });
    const result = simulateSyncSend(envelope.envelope_id);
    if (result.status !== "failed") throw new Error("Should fail in local_only mode");
  }));

  results.push(createTestResult("cloud_readiness_diagnostics", layer, () => {
    const diag = getCloudReadinessDiagnostics();
    if (!["not_configured", "local_only", "configured_not_connected", "ready_for_connection"].includes(diag.readiness_level)) {
      throw new Error(`Invalid readiness level: ${diag.readiness_level}`);
    }
  }));

  results.push(createTestResult("org_audit_aggregation_contract", layer, () => {
    const contract = getOrgAuditAggregationContract();
    if (!contract.contract_shape) throw new Error("Contract shape missing");
    if (!contract.supported_sync_kinds.length) throw new Error("No sync kinds");
  }));

  results.push(createTestResult("multi_device_session_sync_contract", layer, () => {
    const contract = getMultiDeviceSessionSyncContract();
    if (!contract.contract_shape) throw new Error("Contract shape missing");
    if (!contract.conflict_strategies.length) throw new Error("No conflict strategies");
  }));

  results.push(createTestResult("health_endpoint_contracts", layer, () => {
    const endpoints = getCloudHealthEndpointContracts();
    if (endpoints.length === 0) throw new Error("No health endpoints defined");
    if (!endpoints.every(e => e.contract_available)) throw new Error("Not all endpoints have contracts");
  }));

  results.push(createTestResult("bootstrap_manifest", layer, () => {
    const manifest = getBootstrapManifest();
    if (!manifest.required_env_vars.length) throw new Error("No required env vars");
    if (!manifest.deployment_steps.length) throw new Error("No deployment steps");
  }));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("rdysuite"),
    total_tests: results.length,
    passed,
    failed,
    results,
    layer_summaries: { [layer]: { total: results.length, passed, failed } },
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runTemporalLangGraphReadinessSuite(): ReadinessSuiteResult {
  const results: ReadinessTestResult[] = [];
  const suiteStart = Date.now();
  const layer = "temporal_langgraph";

  const {
    createOrchestratorBoundaryConfig,
    registerWorkflowContractShape,
    translateLocalRuntimeToWorkflowContract,
    translateWorkflowResultToLocalRuntime,
    dryRunOrchestratorWorkflow,
    getOrchestratorReadinessDiagnostics,
    initializeDefaultWorkflowContractShapes
  } = require("./temporal-langgraph-boundary.js") as typeof import("./temporal-langgraph-boundary.js");

  results.push(createTestResult("orchestrator_config_creation", layer, () => {
    const config = createOrchestratorBoundaryConfig();
    if (config.active_mode !== "local_typed_runtime") throw new Error("Default should be local_typed_runtime");
    if (!config.dry_run) throw new Error("Default should be dry_run=true");
  }));

  results.push(createTestResult("workflow_contract_shape_registration", layer, () => {
    const shape = registerWorkflowContractShape({
      workflow_name: "test_workflow",
      orchestrator_target: "temporal"
    });
    if (shape.orchestrator_target !== "temporal") throw new Error("Target not set");
  }));

  results.push(createTestResult("local_to_temporal_translation", layer, () => {
    const translated = translateLocalRuntimeToWorkflowContract({
      task_id: "t-123",
      intent: "test",
      task_type: "one_off",
      department: "engineering",
      risk_level: "low"
    });
    if (!translated.temporal_workflow.workflow_id) throw new Error("Workflow ID not set");
    if (!(translated.temporal_workflow.signal_names as string[] | undefined)?.length) throw new Error("No signals defined");
  }));

  results.push(createTestResult("local_to_langgraph_translation", layer, () => {
    const translated = translateLocalRuntimeToWorkflowContract({
      task_id: "t-456",
      intent: "test",
      task_type: "one_off"
    });
    if (!translated.langgraph_graph.thread_id) throw new Error("Thread ID not set");
    if (!(translated.langgraph_graph.node_names as string[] | undefined)?.length) throw new Error("No nodes defined");
  }));

  results.push(createTestResult("temporal_result_to_local_translation", layer, () => {
    const result = translateWorkflowResultToLocalRuntime({
      status: "COMPLETED",
      workflow_id: "wf-123",
      result: { evidence: "test" }
    }, "temporal");
    if (result.status !== "completed") throw new Error(`Expected completed, got ${result.status}`);
  }));

  results.push(createTestResult("langgraph_result_to_local_translation", layer, () => {
    const result = translateWorkflowResultToLocalRuntime({
      status: "running",
      thread_id: "th-456",
      output: { evidence: "test" }
    }, "langgraph");
    if (result.status !== "running") throw new Error(`Expected running, got ${result.status}`);
  }));

  results.push(createTestResult("dry_run_orchestrator_workflow", layer, () => {
    const result = dryRunOrchestratorWorkflow({
      workflow_name: "test_workflow",
      orchestrator_target: "temporal",
      task_data: { task_id: "t-789", intent: "dry run test" }
    });
    if (result.status !== "dry_run_completed") throw new Error("Dry run should complete");
    if (!result.translated_input) throw new Error("No translated input");
  }));

  results.push(createTestResult("orchestrator_readiness_diagnostics", layer, () => {
    const diag = getOrchestratorReadinessDiagnostics();
    if (!["not_configured", "local_runtime_only", "boundary_prepared", "ready_for_orchestrator"].includes(diag.readiness_level)) {
      throw new Error(`Invalid readiness level: ${diag.readiness_level}`);
    }
  }));

  results.push(createTestResult("default_workflow_shapes_initialization", layer, () => {
    const shapes = initializeDefaultWorkflowContractShapes();
    if (shapes.length === 0) throw new Error("No default shapes created");
  }));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("rdysuite"),
    total_tests: results.length,
    passed,
    failed,
    results,
    layer_summaries: { [layer]: { total: results.length, passed, failed } },
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runEnterpriseSSOReadinessSuite(): ReadinessSuiteResult {
  const results: ReadinessTestResult[] = [];
  const suiteStart = Date.now();
  const layer = "enterprise_sso";

  const {
    registerSSOProviderBoundary,
    createOrgTenant,
    createClaimsToPolicyMapping,
    resolveClaimsToPolicy,
    getEnterpriseReadinessDiagnostics,
    initializeDefaultSSOProviderBoundaries,
    getSSOIntegrationRunbook
  } = require("./enterprise-sso-readiness.js") as typeof import("./enterprise-sso-readiness.js");

  results.push(createTestResult("sso_provider_registration", layer, () => {
    const provider = registerSSOProviderBoundary({
      provider_kind: "okta",
      display_name: "Test Okta"
    });
    if (provider.active) throw new Error("Should be inactive by default");
    if (provider.provider_kind !== "okta") throw new Error("Provider kind not set");
  }));

  results.push(createTestResult("org_tenant_creation", layer, () => {
    const tenant = createOrgTenant({ org_name: "Test Org", tier: "enterprise" });
    if (tenant.tier !== "enterprise") throw new Error("Tier not set");
    if (!tenant.role_definitions.length) throw new Error("No default roles");
  }));

  results.push(createTestResult("claims_to_policy_mapping", layer, () => {
    const provider = registerSSOProviderBoundary({
      provider_kind: "custom_oidc",
      display_name: "Test OIDC"
    });
    const mapping = createClaimsToPolicyMapping({
      provider_id: provider.provider_id,
      claim_path: "sub",
      policy_field: "user_id"
    });
    if (mapping.transform !== "direct") throw new Error("Default transform should be direct");
  }));

  results.push(createTestResult("claims_resolution_direct", layer, () => {
    const provider = registerSSOProviderBoundary({
      provider_kind: "azure_ad",
      display_name: "Test Azure"
    });
    createClaimsToPolicyMapping({
      provider_id: provider.provider_id,
      claim_path: "oid",
      policy_field: "user_id"
    });
    createClaimsToPolicyMapping({
      provider_id: provider.provider_id,
      claim_path: "tid",
      policy_field: "tenant_id"
    });
    const policy = resolveClaimsToPolicy({ oid: "user-123", tid: "tenant-456" }, provider.provider_id);
    if (policy.user_id !== "user-123") throw new Error("Direct mapping failed");
    if (policy.tenant_id !== "tenant-456") throw new Error("Direct mapping failed for tenant");
  }));

  results.push(createTestResult("claims_resolution_prefix", layer, () => {
    const provider = registerSSOProviderBoundary({
      provider_kind: "custom_saml",
      display_name: "Test SAML"
    });
    createClaimsToPolicyMapping({
      provider_id: provider.provider_id,
      claim_path: "group",
      policy_field: "role",
      transform: "prefix"
    });
    const policy = resolveClaimsToPolicy({ group: "admin" }, provider.provider_id);
    if (policy.role !== "sso_admin") throw new Error(`Expected sso_admin, got ${policy.role}`);
  }));

  results.push(createTestResult("enterprise_readiness_diagnostics", layer, () => {
    const diag = getEnterpriseReadinessDiagnostics();
    if (!["not_prepared", "contracts_only", "boundary_prepared", "ready_for_sso_integration"].includes(diag.readiness_level)) {
      throw new Error(`Invalid readiness level: ${diag.readiness_level}`);
    }
  }));

  results.push(createTestResult("default_sso_providers_initialization", layer, () => {
    const providers = initializeDefaultSSOProviderBoundaries();
    if (providers.length === 0) throw new Error("No default providers created");
  }));

  results.push(createTestResult("sso_integration_runbook", layer, () => {
    const runbook = getSSOIntegrationRunbook("okta");
    if (!runbook.required_env_vars.length) throw new Error("No required env vars");
    if (!runbook.setup_steps.length) throw new Error("No setup steps");
  }));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("rdysuite"),
    total_tests: results.length,
    passed,
    failed,
    results,
    layer_summaries: { [layer]: { total: results.length, passed, failed } },
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runDeerFlowBackboneReadinessSuite(): ReadinessSuiteResult {
  const results: ReadinessTestResult[] = [];
  const suiteStart = Date.now();
  const layer = "deerflow_backbone";

  const {
    createDeerFlowBackboneReadiness,
    configureDeerFlowRuntimeMode,
    registerExternalDeerFlowWorker,
    simulateDeerFlowHealthCheck,
    getDeerFlowBackboneReadinessDiagnostics,
    getDeerFlowDeploymentRunbook
  } = require("./deerflow-backbone-readiness.js") as typeof import("./deerflow-backbone-readiness.js");

  results.push(createTestResult("backbone_readiness_creation", layer, () => {
    const readiness = createDeerFlowBackboneReadiness();
    if (readiness.runtime_mode !== "local_backbone") throw new Error("Default should be local_backbone");
    if (!readiness.fallback_to_local) throw new Error("Should fallback to local by default");
  }));

  results.push(createTestResult("runtime_mode_configuration", layer, () => {
    const readiness = configureDeerFlowRuntimeMode("deerflow_worker_lane");
    if (readiness.runtime_mode !== "deerflow_worker_lane") throw new Error("Mode not changed");
  }));

  results.push(createTestResult("external_worker_registration_boundary", layer, () => {
    const reg = registerExternalDeerFlowWorker({ worker_name: "test-worker" });
    if (reg.status !== "registered_boundary_only") throw new Error("Should be boundary only");
  }));

  results.push(createTestResult("health_check_simulation", layer, () => {
    createDeerFlowBackboneReadiness();
    const check = simulateDeerFlowHealthCheck();
    if (!["not_configured", "endpoint_unreachable", "simulated_healthy"].includes(check.status)) {
      throw new Error(`Invalid health check status: ${check.status}`);
    }
  }));

  results.push(createTestResult("backbone_readiness_diagnostics", layer, () => {
    const diag = getDeerFlowBackboneReadinessDiagnostics();
    if (!["not_prepared", "local_backbone_only", "boundary_prepared", "ready_for_deerflow_deployment"].includes(diag.readiness_level)) {
      throw new Error(`Invalid readiness level: ${diag.readiness_level}`);
    }
    if (diag.fallback_to_local !== true) throw new Error("Should always fallback to local");
  }));

  results.push(createTestResult("deployment_runbook", layer, () => {
    const runbook = getDeerFlowDeploymentRunbook();
    if (!runbook.required_env_vars.length) throw new Error("No required env vars");
    if (!runbook.deployment_steps.length) throw new Error("No deployment steps");
    if (!runbook.rollback_steps.length) throw new Error("No rollback steps");
  }));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("rdysuite"),
    total_tests: results.length,
    passed,
    failed,
    results,
    layer_summaries: { [layer]: { total: results.length, passed, failed } },
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function runOSIsolationReadinessSuite(): ReadinessSuiteResult {
  const results: ReadinessTestResult[] = [];
  const suiteStart = Date.now();
  const layer = "os_isolation";

  const {
    registerOSIsolationBackend,
    detectOSIsolationCapabilities,
    createIsolationPolicyToBackendMapping,
    translateSandboxTierToBackendCapabilities,
    getOSIsolationReadinessDiagnostics,
    initializeDefaultOSIsolationBackends,
    getOSIsolationRunbook
  } = require("./os-isolation-readiness.js") as typeof import("./os-isolation-readiness.js");

  results.push(createTestResult("backend_registration", layer, () => {
    const backend = registerOSIsolationBackend({
      backend_kind: "container_docker",
      display_name: "Test Docker"
    });
    if (backend.available) throw new Error("Should not be available by default");
    if (backend.capability_level !== "none") throw new Error("Default capability should be none");
  }));

  results.push(createTestResult("capability_detection", layer, () => {
    const caps = detectOSIsolationCapabilities();
    if (!["windows", "linux", "macos", "unknown"].includes(caps.platform)) {
      throw new Error(`Invalid platform: ${caps.platform}`);
    }
    if (!["rule_only", "policy_translated", "backend_enforced"].includes(caps.current_enforcement_level)) {
      throw new Error(`Invalid enforcement level: ${caps.current_enforcement_level}`);
    }
  }));

  results.push(createTestResult("policy_to_backend_mapping", layer, () => {
    const backend = registerOSIsolationBackend({
      backend_kind: "windows_job_object",
      display_name: "Test Job Object",
      capability_level: "process_restriction"
    });
    const mapping = createIsolationPolicyToBackendMapping({
      sandbox_tier: "guarded_mutation",
      backend_id: backend.backend_id,
      enforcement_level: "policy_translated"
    });
    if (mapping.enforcement_level !== "policy_translated") throw new Error("Enforcement level not set");
  }));

  results.push(createTestResult("sandbox_tier_translation", layer, () => {
    const translation = translateSandboxTierToBackendCapabilities("isolated_mutation");
    if (!translation.required_capabilities.length) throw new Error("No required capabilities");
    if (translation.current_enforcement !== "rule_only") throw new Error("Default should be rule_only");
  }));

  results.push(createTestResult("os_isolation_readiness_diagnostics", layer, () => {
    const diag = getOSIsolationReadinessDiagnostics();
    if (!["not_prepared", "rule_based_only", "boundary_prepared", "ready_for_backend_enforcement"].includes(diag.readiness_level)) {
      throw new Error(`Invalid readiness level: ${diag.readiness_level}`);
    }
  }));

  results.push(createTestResult("default_backends_initialization", layer, () => {
    const backends = initializeDefaultOSIsolationBackends();
    if (backends.length === 0) throw new Error("No default backends created");
    const hasWindowsBackend = backends.some(b => b.platform === "windows");
    if (!hasWindowsBackend) throw new Error("No Windows backends");
  }));

  results.push(createTestResult("os_isolation_runbook", layer, () => {
    const runbook = getOSIsolationRunbook("container_docker");
    if (!runbook.setup_steps.length) throw new Error("No setup steps");
    if (!runbook.verification_steps.length) throw new Error("No verification steps");
  }));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suite_id: createEntityId("rdysuite"),
    total_tests: results.length,
    passed,
    failed,
    results,
    layer_summaries: { [layer]: { total: results.length, passed, failed } },
    duration_ms: Date.now() - suiteStart,
    run_at: nowIso()
  };
}

export function getExternalReadinessStatusReport(): ExternalReadinessStatus[] {
  const {
    getCloudReadinessDiagnostics
  } = require("./cloud-control-plane-readiness.js") as typeof import("./cloud-control-plane-readiness.js");
  const {
    getOrchestratorReadinessDiagnostics
  } = require("./temporal-langgraph-boundary.js") as typeof import("./temporal-langgraph-boundary.js");
  const {
    getEnterpriseReadinessDiagnostics
  } = require("./enterprise-sso-readiness.js") as typeof import("./enterprise-sso-readiness.js");
  const {
    getDeerFlowBackboneReadinessDiagnostics
  } = require("./deerflow-backbone-readiness.js") as typeof import("./deerflow-backbone-readiness.js");
  const {
    getOSIsolationReadinessDiagnostics
  } = require("./os-isolation-readiness.js") as typeof import("./os-isolation-readiness.js");

  const cloudDiag = getCloudReadinessDiagnostics();
  const orchestratorDiag = getOrchestratorReadinessDiagnostics();
  const enterpriseDiag = getEnterpriseReadinessDiagnostics();
  const deerflowDiag = getDeerFlowBackboneReadinessDiagnostics();
  const osIsolationDiag = getOSIsolationReadinessDiagnostics();

  const readinessLevelMap: Record<string, ExternalReadinessStatus["status"]> = {
    "not_configured": "contracts_only",
    "not_prepared": "contracts_only",
    "local_only": "contracts_only",
    "local_runtime_only": "contracts_only",
    "local_backbone_only": "contracts_only",
    "rule_based_only": "contracts_only",
    "contracts_only": "contracts_only",
    "boundary_prepared": "adapter_boundary",
    "configured_not_connected": "adapter_boundary",
    "ready_for_connection": "dry_run_available",
    "ready_for_orchestrator": "dry_run_available",
    "ready_for_sso_integration": "dry_run_available",
    "ready_for_deerflow_deployment": "dry_run_available",
    "ready_for_backend_enforcement": "dry_run_available",
    "ready_for_integration": "ready_for_integration"
  };

  return [
    {
      layer: "cloud_control_plane",
      status: readinessLevelMap[cloudDiag.readiness_level] ?? "contracts_only",
      blocking_dependencies: cloudDiag.blocking_items,
      notes: `Mode: ${cloudDiag.mode}, Auth: ${cloudDiag.auth_provider}`
    },
    {
      layer: "temporal_langgraph",
      status: readinessLevelMap[orchestratorDiag.readiness_level] ?? "contracts_only",
      blocking_dependencies: orchestratorDiag.blocking_items,
      notes: `Active mode: ${orchestratorDiag.active_mode}, Shapes: ${orchestratorDiag.workflow_shapes_registered}`
    },
    {
      layer: "enterprise_sso",
      status: readinessLevelMap[enterpriseDiag.readiness_level] ?? "contracts_only",
      blocking_dependencies: enterpriseDiag.blocking_items,
      notes: `Providers: ${enterpriseDiag.sso_providers_registered}, Tenants: ${enterpriseDiag.org_tenants_created}`
    },
    {
      layer: "deerflow_backbone",
      status: readinessLevelMap[deerflowDiag.readiness_level] ?? "contracts_only",
      blocking_dependencies: deerflowDiag.blocking_items,
      notes: `Runtime mode: ${deerflowDiag.runtime_mode}, Fallback: ${deerflowDiag.fallback_to_local}`
    },
    {
      layer: "os_isolation",
      status: readinessLevelMap[osIsolationDiag.readiness_level] ?? "contracts_only",
      blocking_dependencies: osIsolationDiag.blocking_items,
      notes: `Platform: ${osIsolationDiag.current_platform}, Enforcement: ${osIsolationDiag.current_enforcement_level}`
    }
  ];
}

export function runAllExternalReadinessSuites(): {
  cloud_control_plane: ReadinessSuiteResult;
  temporal_langgraph: ReadinessSuiteResult;
  enterprise_sso: ReadinessSuiteResult;
  deerflow_backbone: ReadinessSuiteResult;
  os_isolation: ReadinessSuiteResult;
  readiness_status_report: ExternalReadinessStatus[];
  overall_passed: boolean;
  total_passed: number;
  total_failed: number;
  total_tests: number;
} {
  const cloud = runCloudControlPlaneReadinessSuite();
  const temporal = runTemporalLangGraphReadinessSuite();
  const enterprise = runEnterpriseSSOReadinessSuite();
  const deerflow = runDeerFlowBackboneReadinessSuite();
  const osIsolation = runOSIsolationReadinessSuite();

  const totalPassed = cloud.passed + temporal.passed + enterprise.passed + deerflow.passed + osIsolation.passed;
  const totalFailed = cloud.failed + temporal.failed + enterprise.failed + deerflow.failed + osIsolation.failed;
  const totalTests = cloud.total_tests + temporal.total_tests + enterprise.total_tests + deerflow.total_tests + osIsolation.total_tests;

  return {
    cloud_control_plane: cloud,
    temporal_langgraph: temporal,
    enterprise_sso: enterprise,
    deerflow_backbone: deerflow,
    os_isolation: osIsolation,
    readiness_status_report: getExternalReadinessStatusReport(),
    overall_passed: totalFailed === 0,
    total_passed: totalPassed,
    total_failed: totalFailed,
    total_tests: totalTests
  };
}
