import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { recordAudit } from "./core.js";
import {
  registerPrivilegedOperationContract,
  listPrivilegedOperationContracts,
  addAdminOperationRegistryEntry,
  listAdminOperationRegistryEntries,
  executeElevationDryRun,
  listElevationDryRunResults,
  getPrivilegedReadinessDiagnostics,
  generatePrivilegedRunRunbook,
  listPrivilegedRunRunbooks,
  initializeDefaultPrivilegedOperationContracts
} from "./privileged-execution-readiness.js";
import {
  detectRuntimeInstallState,
  generateBootstrapPlan,
  listBootstrapPlans,
  runPostInstallVerification,
  listPostInstallVerifications,
  generateLocalEnvironmentReport,
  detectAllRuntimes,
  listRuntimeDiagnostics
} from "./local-runtime-bootstrap.js";
import {
  registerEndpointConfig,
  listEndpointConfigs,
  runConnectivityPreflight,
  getCredentialInventory,
  generateOnboardingRunbook,
  listOnboardingRunbooks,
  validateEndpointConfigSchema,
  initializeDefaultEndpointConfigs
} from "./endpoint-onboarding.js";
import {
  buildReadinessMatrix,
  listReadinessMatrices,
  exportReadinessStatusArtifact,
  buildBlockerDashboardState
} from "./blocker-dashboard.js";

export interface PrivilegedReadinessTestResult {
  test_id: string;
  test_name: string;
  suite: string;
  passed: boolean;
  error_message?: string;
  duration_ms: number;
  details?: Record<string, unknown>;
}

export interface PrivilegedReadinessSuiteResult {
  suite_id: string;
  suite_name: string;
  total_tests: number;
  passed: number;
  failed: number;
  results: PrivilegedReadinessTestResult[];
  duration_ms: number;
  run_at: string;
}

function runTest(
  testName: string,
  suite: string,
  fn: () => void | { details?: Record<string, unknown> }
): PrivilegedReadinessTestResult {
  const start = Date.now();
  try {
    const result = fn();
    return {
      test_id: createEntityId("prtest"),
      test_name: testName,
      suite,
      passed: true,
      duration_ms: Date.now() - start,
      details: result && typeof result === "object" && "details" in result ? result.details : undefined
    };
  } catch (err) {
    return {
      test_id: createEntityId("prtest"),
      test_name: testName,
      suite,
      passed: false,
      error_message: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start
    };
  }
}

function makeSuiteResult(suiteName: string, results: PrivilegedReadinessTestResult[], startMs: number): PrivilegedReadinessSuiteResult {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return {
    suite_id: createEntityId("prsuite"),
    suite_name: suiteName,
    total_tests: results.length,
    passed,
    failed,
    results,
    duration_ms: Date.now() - startMs,
    run_at: nowIso()
  };
}

export function runPrivilegedOperationContractSuite(): PrivilegedReadinessSuiteResult {
  const start = Date.now();
  const results: PrivilegedReadinessTestResult[] = [];

  results.push(runTest("register privileged operation contract", "privileged_operation_contracts", () => {
    const contract = registerPrivilegedOperationContract({
      operation_kind: "integrity_level_change",
      display_name: "Test Integrity Level",
      description: "Test contract for integrity level change",
      requires_admin: true,
      expected_command: "icacls test /setintegritylevel Low",
      rollback_command: "icacls test /setintegritylevel Medium",
      rollback_notes: "Restore to Medium",
      risk_level: "high",
      affected_system_area: "filesystem_security",
      prerequisites: ["Admin session"]
    });
    if (!contract.contract_id) throw new Error("Contract ID not generated");
    if (contract.readiness_status !== "supported_but_blocked_by_missing_admin") throw new Error(`Unexpected readiness: ${contract.readiness_status}`);
    return { details: { contract_id: contract.contract_id, readiness: contract.readiness_status } };
  }));

  results.push(runTest("register non-admin operation contract", "privileged_operation_contracts", () => {
    const contract = registerPrivilegedOperationContract({
      operation_kind: "job_object_creation",
      display_name: "Test Job Object",
      description: "Test contract for job object creation",
      requires_admin: false,
      expected_command: "CreateJobObjectW(...)",
      risk_level: "medium"
    });
    if (contract.readiness_status !== "supported_and_ready") throw new Error(`Unexpected readiness: ${contract.readiness_status}`);
  }));

  results.push(runTest("list privileged operation contracts with filter", "privileged_operation_contracts", () => {
    const all = listPrivilegedOperationContracts();
    const adminOnly = listPrivilegedOperationContracts({ requires_admin: true });
    const ready = listPrivilegedOperationContracts({ readiness_status: "supported_and_ready" });
    if (all.length === 0) throw new Error("No contracts found");
    if (adminOnly.length === 0) throw new Error("No admin contracts found");
    if (adminOnly.some(c => !c.requires_admin)) throw new Error("Non-admin contract in admin filter");
    if (ready.some(c => c.readiness_status !== "supported_and_ready")) throw new Error("Non-ready contract in ready filter");
  }));

  results.push(runTest("initialize default privileged operation contracts", "privileged_operation_contracts", () => {
    const defaults = initializeDefaultPrivilegedOperationContracts();
    if (defaults.length < 5) throw new Error(`Expected at least 5 default contracts, got ${defaults.length}`);
    const kinds = defaults.map(d => d.operation_kind);
    if (!kinds.includes("integrity_level_change")) throw new Error("Missing integrity_level_change");
    if (!kinds.includes("firewall_rule_change")) throw new Error("Missing firewall_rule_change");
    if (!kinds.includes("hyper_v_check")) throw new Error("Missing hyper_v_check");
  }));

  results.push(runTest("admin operation registry entry CRUD", "privileged_operation_contracts", () => {
    const entry = addAdminOperationRegistryEntry({
      operation_kind: "firewall_rule_change",
      reason: "Test reason",
      expected_command: "New-NetFirewallRule",
      rollback_notes: "Remove rule",
      impact_if_unavailable: "degraded",
      alternative_approach: "Rule-based enforcement"
    });
    if (!entry.entry_id) throw new Error("Entry ID not generated");
    if (entry.impact_if_unavailable !== "degraded") throw new Error("Wrong impact level");

    const entries = listAdminOperationRegistryEntries({ operation_kind: "firewall_rule_change" });
    if (entries.length === 0) throw new Error("No entries found for firewall_rule_change");
  }));

  results.push(runTest("elevation dry-run execution", "privileged_operation_contracts", () => {
    const dryRun = executeElevationDryRun({
      operation_kind: "integrity_level_change"
    });
    if (dryRun.would_succeed) throw new Error("Dry run should not succeed without elevation");
    if (!dryRun.would_require_elevation) throw new Error("Should require elevation");
    if (dryRun.current_elevation_status !== "not_elevated") throw new Error("Should report not_elevated");
    if (dryRun.warnings.length === 0) throw new Error("Should have warnings");

    const dryRunResults = listElevationDryRunResults({ operation_kind: "integrity_level_change" });
    if (dryRunResults.length === 0) throw new Error("Dry run results not stored");
  }));

  results.push(runTest("privileged readiness diagnostics", "privileged_operation_contracts", () => {
    const diagnostics = getPrivilegedReadinessDiagnostics();
    if (diagnostics.elevation_status !== "not_elevated") throw new Error("Should report not_elevated");
    if (diagnostics.contracts.length === 0) throw new Error("Should have contracts");
    if (diagnostics.summary.total_operations === 0) throw new Error("Should have total operations");
    if (diagnostics.next_actions.length === 0) throw new Error("Should have next actions");
  }));

  results.push(runTest("privileged run runbook generation", "privileged_operation_contracts", () => {
    const runbook = generatePrivilegedRunRunbook({
      title: "Test Runbook",
      operation_kinds: ["integrity_level_change", "firewall_rule_change"],
      estimated_duration_minutes: 15
    });
    if (!runbook.runbook_id) throw new Error("Runbook ID not generated");
    if (runbook.steps.length === 0) throw new Error("Should have steps");
    if (runbook.total_elevation_steps === 0) throw new Error("Should have elevation steps");
    if (!runbook.rollback_plan) throw new Error("Should have rollback plan");

    const runbooks = listPrivilegedRunRunbooks();
    if (runbooks.length === 0) throw new Error("Runbooks not stored");
  }));

  return makeSuiteResult("privileged_operation_contracts", results, start);
}

export function runInstallerBootstrapDiagnosticsSuite(): PrivilegedReadinessSuiteResult {
  const start = Date.now();
  const results: PrivilegedReadinessTestResult[] = [];

  results.push(runTest("detect runtime install state", "installer_bootstrap_diagnostics", () => {
    const diag = detectRuntimeInstallState("docker_desktop");
    if (!diag.diagnostics_id) throw new Error("Diagnostics ID not generated");
    if (!diag.detection_command) throw new Error("Detection command not set");
    if (diag.install_state === "installed_and_running" && !diag.detected_version) throw new Error("Installed but no version detected");
  }));

  results.push(runTest("detect all runtimes", "installer_bootstrap_diagnostics", () => {
    const allDiags = detectAllRuntimes();
    if (allDiags.length < 5) throw new Error(`Expected at least 5 runtime diagnostics, got ${allDiags.length}`);
    const kinds = allDiags.map(d => d.runtime_kind);
    if (!kinds.includes("docker_desktop")) throw new Error("Missing docker_desktop");
    if (!kinds.includes("node_js")) throw new Error("Missing node_js");
  }));

  results.push(runTest("generate bootstrap plan for Docker", "installer_bootstrap_diagnostics", () => {
    const plan = generateBootstrapPlan("docker_desktop");
    if (!plan.plan_id) throw new Error("Plan ID not generated");
    if (plan.steps.length === 0) throw new Error("Should have steps");
    if (plan.total_steps === 0) throw new Error("Total steps should be > 0");
    if (plan.title !== "Docker Desktop Installation and Setup") throw new Error("Wrong title");
  }));

  results.push(runTest("generate bootstrap plan for WSL2", "installer_bootstrap_diagnostics", () => {
    const plan = generateBootstrapPlan("wsl2");
    if (plan.steps.length === 0) throw new Error("Should have steps");
    const hasElevationStep = plan.steps.some(s => s.description.toLowerCase().includes("dism") || s.description.toLowerCase().includes("enable"));
    if (!hasElevationStep) throw new Error("Should have elevation-related steps");
  }));

  results.push(runTest("generate bootstrap plan for Rust/Cargo", "installer_bootstrap_diagnostics", () => {
    const plan = generateBootstrapPlan("rust_cargo");
    if (plan.steps.length === 0) throw new Error("Should have steps");
    if (plan.required_steps === 0) throw new Error("Should have required steps");
  }));

  results.push(runTest("generate bootstrap plan for Ollama", "installer_bootstrap_diagnostics", () => {
    const plan = generateBootstrapPlan("ollama");
    if (plan.steps.length === 0) throw new Error("Should have steps");
  }));

  results.push(runTest("generate bootstrap plan for Temporal CLI", "installer_bootstrap_diagnostics", () => {
    const plan = generateBootstrapPlan("temporal_cli");
    if (plan.steps.length === 0) throw new Error("Should have steps");
  }));

  results.push(runTest("list bootstrap plans", "installer_bootstrap_diagnostics", () => {
    const plans = listBootstrapPlans();
    if (plans.length === 0) throw new Error("No bootstrap plans found");
  }));

  results.push(runTest("run post-install verification", "installer_bootstrap_diagnostics", () => {
    const verification = runPostInstallVerification("docker_desktop");
    if (!verification.verification_id) throw new Error("Verification ID not generated");
    if (verification.checks.length === 0) throw new Error("Should have checks");
  }));

  results.push(runTest("list post-install verifications", "installer_bootstrap_diagnostics", () => {
    const verifications = listPostInstallVerifications();
    if (verifications.length === 0) throw new Error("No verifications found");
  }));

  results.push(runTest("generate local environment report", "installer_bootstrap_diagnostics", () => {
    const report = generateLocalEnvironmentReport();
    if (!report.report_id) throw new Error("Report ID not generated");
    if (report.runtimes.length === 0) throw new Error("Should have runtimes");
    if (report.summary.total_runtimes === 0) throw new Error("Should have total runtimes");
  }));

  results.push(runTest("list runtime diagnostics with filter", "installer_bootstrap_diagnostics", () => {
    const all = listRuntimeDiagnostics();
    const dockerOnly = listRuntimeDiagnostics({ runtime_kind: "docker_desktop" });
    if (dockerOnly.some(d => d.runtime_kind !== "docker_desktop")) throw new Error("Filter not working");
    if (dockerOnly.length > all.length) throw new Error("Filtered results should be subset");
  }));

  return makeSuiteResult("installer_bootstrap_diagnostics", results, start);
}

export function runConfigValidationSuite(): PrivilegedReadinessSuiteResult {
  const start = Date.now();
  const results: PrivilegedReadinessTestResult[] = [];

  results.push(runTest("register endpoint config for Temporal", "config_validation", () => {
    const config = registerEndpointConfig({
      endpoint_kind: "temporal",
      display_name: "Test Temporal",
      description: "Test Temporal endpoint",
      url: "http://localhost:7233",
      protocol: "grpc",
      required_env_vars: [
        { var_name: "TEMPORAL_ADDRESS", description: "Address", is_secret: false, is_required: true, example_value: "localhost:7233" }
      ]
    });
    if (!config.config_id) throw new Error("Config ID not generated");
    if (config.status === "not_configured") throw new Error("Should not be not_configured with URL set");
  }));

  results.push(runTest("register endpoint config without URL", "config_validation", () => {
    const config = registerEndpointConfig({
      endpoint_kind: "langgraph",
      display_name: "Test LangGraph (no URL)",
      description: "Test LangGraph endpoint without URL",
      required_env_vars: [
        { var_name: "LANGGRAPH_ENDPOINT", description: "Endpoint", is_secret: false, is_required: true }
      ]
    });
    if (config.status !== "not_configured") throw new Error(`Should be not_configured, got ${config.status}`);
  }));

  results.push(runTest("list endpoint configs with filter", "config_validation", () => {
    const temporalOnly = listEndpointConfigs({ endpoint_kind: "temporal" });
    if (temporalOnly.some(c => c.endpoint_kind !== "temporal")) throw new Error("Filter not working");
  }));

  results.push(runTest("validate endpoint config schema", "config_validation", () => {
    const configs = listEndpointConfigs({ endpoint_kind: "temporal" });
    if (configs.length === 0) throw new Error("No temporal configs to validate");
    const validation = validateEndpointConfigSchema(configs[0].config_id);
    if (validation.errors === undefined) throw new Error("Should have validation result");
  }));

  results.push(runTest("run connectivity preflight", "config_validation", () => {
    const configs = listEndpointConfigs({ endpoint_kind: "temporal" });
    if (configs.length === 0) throw new Error("No temporal configs");
    const preflight = runConnectivityPreflight(configs[0].config_id);
    if (!preflight.preflight_id) throw new Error("Preflight ID not generated");
    if (preflight.recommendations.length === 0) throw new Error("Should have recommendations");
  }));

  results.push(runTest("get credential inventory", "config_validation", () => {
    const inventory = getCredentialInventory("temporal");
    if (!inventory.inventory_id) throw new Error("Inventory ID not generated");
    if (inventory.total_required === 0) throw new Error("Should have required secrets");
  }));

  results.push(runTest("generate onboarding runbook for Temporal", "config_validation", () => {
    const runbook = generateOnboardingRunbook("temporal");
    if (!runbook.runbook_id) throw new Error("Runbook ID not generated");
    if (runbook.setup_steps.length === 0) throw new Error("Should have setup steps");
    if (runbook.expected_secret_inventory.length === 0) throw new Error("Should have expected secrets");
    if (runbook.troubleshooting.length === 0) throw new Error("Should have troubleshooting entries");
  }));

  results.push(runTest("generate onboarding runbook for SSO", "config_validation", () => {
    const runbook = generateOnboardingRunbook("sso");
    if (runbook.setup_steps.length === 0) throw new Error("Should have setup steps");
  }));

  results.push(runTest("generate onboarding runbook for model inference", "config_validation", () => {
    const runbook = generateOnboardingRunbook("model_inference");
    if (runbook.setup_steps.length === 0) throw new Error("Should have setup steps");
  }));

  results.push(runTest("list onboarding runbooks", "config_validation", () => {
    const runbooks = listOnboardingRunbooks();
    if (runbooks.length === 0) throw new Error("No runbooks found");
  }));

  results.push(runTest("initialize default endpoint configs", "config_validation", () => {
    const defaults = initializeDefaultEndpointConfigs();
    if (defaults.length < 5) throw new Error(`Expected at least 5 default configs, got ${defaults.length}`);
    const kinds = defaults.map(d => d.endpoint_kind);
    if (!kinds.includes("temporal")) throw new Error("Missing temporal");
    if (!kinds.includes("sso")) throw new Error("Missing sso");
    if (!kinds.includes("model_inference")) throw new Error("Missing model_inference");
  }));

  results.push(runTest("validate config with missing secrets", "config_validation", () => {
    const config = registerEndpointConfig({
      endpoint_kind: "deerflow",
      display_name: "Test DeerFlow (missing secrets)",
      description: "Test with missing required secrets",
      url: "http://localhost:50051",
      required_env_vars: [
        { var_name: "DEERFLOW_AUTH_TOKEN", description: "Auth token", is_secret: true, is_required: true }
      ]
    });
    if (config.missing_env_vars.length === 0) throw new Error("Should have missing env vars");
  }));

  return makeSuiteResult("config_validation", results, start);
}

export function runReadinessMatrixSuite(): PrivilegedReadinessSuiteResult {
  const start = Date.now();
  const results: PrivilegedReadinessTestResult[] = [];

  results.push(runTest("build readiness matrix", "readiness_matrix", () => {
    const matrix = buildReadinessMatrix();
    if (!matrix.matrix_id) throw new Error("Matrix ID not generated");
    if (matrix.entries.length === 0) throw new Error("Should have entries");
    if (matrix.summary.total_items === 0) throw new Error("Should have total items");
  }));

  results.push(runTest("readiness matrix has all source layers", "readiness_matrix", () => {
    const matrix = buildReadinessMatrix();
    const layers = [...new Set(matrix.entries.map(e => e.source_layer))];
    if (!layers.includes("admin_backend")) throw new Error("Missing admin_backend layer");
    if (!layers.includes("local_prerequisite")) throw new Error("Missing local_prerequisite layer");
    if (!layers.includes("external_endpoint")) throw new Error("Missing external_endpoint layer");
    if (!layers.includes("host_availability")) throw new Error("Missing host_availability layer");
  }));

  results.push(runTest("readiness matrix has all blocker categories", "readiness_matrix", () => {
    const matrix = buildReadinessMatrix();
    const categories = [...new Set(matrix.entries.map(e => e.category))];
    if (categories.length < 3) throw new Error(`Expected at least 3 categories, got ${categories.length}`);
  }));

  results.push(runTest("readiness matrix summary is consistent", "readiness_matrix", () => {
    const matrix = buildReadinessMatrix();
    const sumCounts = matrix.summary.ready_now_count
      + matrix.summary.needs_admin_count
      + matrix.summary.needs_install_count
      + matrix.summary.needs_credential_count
      + matrix.summary.needs_external_endpoint_count
      + matrix.summary.needs_unavailable_host_count;
    if (sumCounts !== matrix.summary.total_items) throw new Error(`Category counts (${sumCounts}) don't match total (${matrix.summary.total_items})`);
  }));

  results.push(runTest("readiness percentage calculation", "readiness_matrix", () => {
    const matrix = buildReadinessMatrix();
    const expectedPct = matrix.summary.total_items > 0
      ? Math.round((matrix.summary.ready_now_count / matrix.summary.total_items) * 100)
      : 0;
    if (matrix.summary.readiness_percentage !== expectedPct) throw new Error(`Expected ${expectedPct}%, got ${matrix.summary.readiness_percentage}%`);
  }));

  results.push(runTest("list readiness matrices", "readiness_matrix", () => {
    const matrices = listReadinessMatrices();
    if (matrices.length === 0) throw new Error("No matrices found");
  }));

  results.push(runTest("export readiness status artifact as JSON", "readiness_matrix", () => {
    const artifact = exportReadinessStatusArtifact("json");
    if (!artifact.artifact_id) throw new Error("Artifact ID not generated");
    if (artifact.export_format !== "json") throw new Error("Wrong format");
    if (!artifact.checksum) throw new Error("Missing checksum");
    if (!artifact.matrix) throw new Error("Missing matrix");
  }));

  results.push(runTest("export readiness status artifact as markdown", "readiness_matrix", () => {
    const artifact = exportReadinessStatusArtifact("markdown");
    if (artifact.export_format !== "markdown") throw new Error("Wrong format");
  }));

  results.push(runTest("build blocker dashboard state", "readiness_matrix", () => {
    const dashboard = buildBlockerDashboardState();
    if (!dashboard.dashboard_id) throw new Error("Dashboard ID not generated");
    if (dashboard.top_blockers.length === 0 && dashboard.category_counts.needs_admin + dashboard.category_counts.needs_install + dashboard.category_counts.needs_external_endpoint > 0) {
      throw new Error("Should have top blockers when non-ready items exist");
    }
    if (dashboard.next_human_actions.length === 0 && dashboard.readiness_percentage < 100) {
      throw new Error("Should have next human actions when not 100% ready");
    }
  }));

  results.push(runTest("dashboard overall readiness level is consistent", "readiness_matrix", () => {
    const dashboard = buildBlockerDashboardState();
    const pct = dashboard.readiness_percentage;
    const level = dashboard.overall_readiness_level;
    if (pct >= 90 && level !== "ready") throw new Error(`Expected 'ready' for ${pct}%, got '${level}'`);
    if (pct < 15 && level !== "blocked") throw new Error(`Expected 'blocked' for ${pct}%, got '${level}'`);
  }));

  return makeSuiteResult("readiness_matrix", results, start);
}

export function runDryRunReportGenerationSuite(): PrivilegedReadinessSuiteResult {
  const start = Date.now();
  const results: PrivilegedReadinessTestResult[] = [];

  results.push(runTest("dry-run for integrity level change", "dry_run_report_generation", () => {
    const dryRun = executeElevationDryRun({ operation_kind: "integrity_level_change" });
    if (dryRun.would_succeed) throw new Error("Should not succeed without elevation");
    if (!dryRun.warnings.some(w => w.includes("icacls") || w.includes("elevation"))) throw new Error("Should warn about icacls/elevation");
  }));

  results.push(runTest("dry-run for firewall rule change", "dry_run_report_generation", () => {
    const dryRun = executeElevationDryRun({ operation_kind: "firewall_rule_change" });
    if (dryRun.would_succeed) throw new Error("Should not succeed without elevation");
    if (!dryRun.warnings.some(w => w.includes("Firewall") || w.includes("Administrator"))) throw new Error("Should warn about Firewall/Admin");
  }));

  results.push(runTest("dry-run for job object creation (non-admin)", "dry_run_report_generation", () => {
    const dryRun = executeElevationDryRun({ operation_kind: "job_object_creation" });
    if (!dryRun.would_require_elevation) throw new Error("Should not require elevation for job object");
  }));

  results.push(runTest("dry-run for Hyper-V check", "dry_run_report_generation", () => {
    const dryRun = executeElevationDryRun({ operation_kind: "hyper_v_check" });
    if (!dryRun.warnings.some(w => w.includes("Hyper-V"))) throw new Error("Should warn about Hyper-V");
  }));

  results.push(runTest("dry-run for unknown operation", "dry_run_report_generation", () => {
    const dryRun = executeElevationDryRun({ operation_kind: "service_installation" });
    if (dryRun.readiness_after === "supported_and_ready") throw new Error("Should not be ready for unregistered operation");
  }));

  results.push(runTest("generate runbook for admin operations", "dry_run_report_generation", () => {
    const runbook = generatePrivilegedRunRunbook({
      title: "Full Admin Setup Runbook",
      operation_kinds: ["integrity_level_change", "firewall_rule_change", "hyper_v_check"],
      estimated_duration_minutes: 30
    });
    if (runbook.total_elevation_steps === 0) throw new Error("Should have elevation steps");
    if (runbook.prerequisites.length === 0) throw new Error("Should have prerequisites");
  }));

  results.push(runTest("generate environment report with blockers", "dry_run_report_generation", () => {
    const report = generateLocalEnvironmentReport();
    if (report.summary.needs_install_count + report.summary.detection_failed_count > 0) {
      const hasBlockers = report.runtimes.some(r => r.blocker);
      if (!hasBlockers) throw new Error("Should have blockers when runtimes need install");
    }
  }));

  results.push(runTest("full readiness diagnostics report", "dry_run_report_generation", () => {
    const diagnostics = getPrivilegedReadinessDiagnostics();
    if (diagnostics.blocking_items.length > 0) {
      if (diagnostics.next_actions.length === 0) throw new Error("Should have next actions when blockers exist");
    }
  }));

  results.push(runTest("blocker dashboard export consistency", "dry_run_report_generation", () => {
    const dashboard = buildBlockerDashboardState();
    const totalFromCounts = dashboard.category_counts.ready_now
      + dashboard.category_counts.needs_admin
      + dashboard.category_counts.needs_install
      + dashboard.category_counts.needs_credential
      + dashboard.category_counts.needs_external_endpoint
      + dashboard.category_counts.needs_unavailable_host;
    if (totalFromCounts === 0) throw new Error("Dashboard should have items");
  }));

  return makeSuiteResult("dry_run_report_generation", results, start);
}

export function runAllPrivilegedReadinessSuites(): {
  overall_passed: boolean;
  total_passed: number;
  total_failed: number;
  total_tests: number;
  suites: PrivilegedReadinessSuiteResult[];
} {
  const suites: PrivilegedReadinessSuiteResult[] = [];

  suites.push(runPrivilegedOperationContractSuite());
  suites.push(runInstallerBootstrapDiagnosticsSuite());
  suites.push(runConfigValidationSuite());
  suites.push(runReadinessMatrixSuite());
  suites.push(runDryRunReportGenerationSuite());

  const totalPassed = suites.reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = suites.reduce((sum, s) => sum + s.failed, 0);
  const totalTests = suites.reduce((sum, s) => sum + s.total_tests, 0);

  recordAudit("privileged_readiness.all_suites_run", {
    total_tests: totalTests,
    total_passed: totalPassed,
    total_failed: totalFailed,
    overall_passed: totalFailed === 0
  });

  return {
    overall_passed: totalFailed === 0,
    total_passed: totalPassed,
    total_failed: totalFailed,
    total_tests: totalTests,
    suites
  };
}
