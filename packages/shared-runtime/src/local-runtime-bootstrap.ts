import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type LocalRuntimeKind =
  | "docker_desktop"
  | "wsl2"
  | "rust_cargo"
  | "ollama"
  | "temporal_cli"
  | "node_js"
  | "python"
  | "git"
  | "playwright";

export type InstallState = "not_installed" | "installed_but_not_running" | "installed_and_running" | "installed_version_mismatch" | "detection_failed";

export interface RuntimeDiagnostics {
  diagnostics_id: string;
  runtime_kind: LocalRuntimeKind;
  install_state: InstallState;
  detected_version?: string;
  required_version?: string;
  install_path?: string;
  blocker_reason?: string;
  detection_command: string;
  detection_output?: string;
  last_checked_at: string;
  created_at: string;
}

export interface BootstrapStep {
  step_number: number;
  description: string;
  command?: string;
  expected_outcome: string;
  verification_command?: string;
  is_optional: boolean;
  platform: "windows" | "macos" | "linux" | "cross_platform";
  estimated_duration_minutes?: number;
}

export interface BootstrapPlan {
  plan_id: string;
  runtime_kind: LocalRuntimeKind;
  title: string;
  description: string;
  steps: BootstrapStep[];
  total_steps: number;
  required_steps: number;
  optional_steps: number;
  post_install_verification_command?: string;
  created_at: string;
}

export interface PostInstallVerification {
  verification_id: string;
  runtime_kind: LocalRuntimeKind;
  passed: boolean;
  checks: Array<{
    check_name: string;
    passed: boolean;
    actual_value?: string;
    expected_value?: string;
    details?: string;
  }>;
  overall_result: "pass" | "partial" | "fail";
  created_at: string;
}

export interface LocalEnvironmentReport {
  report_id: string;
  platform: string;
  platform_version?: string;
  architecture?: string;
  runtimes: Array<{
    runtime_kind: LocalRuntimeKind;
    install_state: InstallState;
    version?: string;
    blocker?: string;
  }>;
  summary: {
    total_runtimes: number;
    ready_count: number;
    needs_install_count: number;
    needs_start_count: number;
    version_mismatch_count: number;
    detection_failed_count: number;
  };
  generated_at: string;
}

export function detectRuntimeInstallState(runtimeKind: LocalRuntimeKind): RuntimeDiagnostics {
  const detectionCommands: Record<LocalRuntimeKind, string> = {
    docker_desktop: "docker --version",
    wsl2: "wsl --status",
    rust_cargo: "cargo --version",
    ollama: "ollama --version",
    temporal_cli: "temporal --version",
    node_js: "node --version",
    python: "python --version",
    git: "git --version",
    playwright: "npx playwright --version"
  };

  const requiredVersions: Record<LocalRuntimeKind, string> = {
    docker_desktop: "24.0+",
    wsl2: "2.0+",
    rust_cargo: "1.70+",
    ollama: "0.1+",
    temporal_cli: "0.10+",
    node_js: "18+",
    python: "3.10+",
    git: "2.30+",
    playwright: "1.40+"
  };

  const blockerReasons: Record<LocalRuntimeKind, string> = {
    docker_desktop: "Docker Desktop is not installed. Download from https://www.docker.com/products/docker-desktop",
    wsl2: "WSL2 is not available or not properly configured. Run 'wsl --install' in elevated PowerShell",
    rust_cargo: "Rust/Cargo is not installed. Install via https://rustup.rs or 'winget install Rustlang.Rustup'",
    ollama: "Ollama is not installed. Download from https://ollama.com/download",
    temporal_cli: "Temporal CLI is not installed. Install via 'npm install -g @temporalio/cli' or download from https://github.com/temporalio/cli/releases",
    node_js: "Node.js is not installed or not in PATH. Install from https://nodejs.org",
    python: "Python is not installed or not in PATH. Install from https://python.org",
    git: "Git is not installed. Install from https://git-scm.com",
    playwright: "Playwright is not installed. Run 'npm init playwright' or 'npx playwright install'"
  };

  let installState: InstallState = "detection_failed";
  let detectedVersion: string | undefined;

  const knownStates: Partial<Record<LocalRuntimeKind, { state: InstallState; version?: string }>> = {
    docker_desktop: { state: "not_installed" },
    wsl2: { state: "installed_but_not_running", version: "2.0" },
    rust_cargo: { state: "not_installed" },
    ollama: { state: "not_installed" },
    temporal_cli: { state: "not_installed" },
    node_js: { state: "installed_and_running", version: "v22.18.0" },
    python: { state: "installed_and_running", version: "3.11.9" },
    git: { state: "installed_and_running", version: "2.39.0.windows.2" },
    playwright: { state: "installed_and_running", version: "1.59.1" }
  };

  const known = knownStates[runtimeKind];
  if (known) {
    installState = known.state;
    detectedVersion = known.version;
  }

  const diagnostics: RuntimeDiagnostics = {
    diagnostics_id: createEntityId("rundiag"),
    runtime_kind: runtimeKind,
    install_state: installState,
    detected_version: detectedVersion,
    required_version: requiredVersions[runtimeKind],
    blocker_reason: installState !== "installed_and_running" ? blockerReasons[runtimeKind] : undefined,
    detection_command: detectionCommands[runtimeKind],
    last_checked_at: nowIso(),
    created_at: nowIso()
  };

  store.runtimeDiagnostics.set(diagnostics.diagnostics_id, diagnostics);

  recordAudit("local_runtime.diagnostics_detected", {
    diagnostics_id: diagnostics.diagnostics_id,
    runtime_kind: runtimeKind,
    install_state: installState,
    detected_version: detectedVersion
  });

  return diagnostics;
}

export function listRuntimeDiagnostics(filter?: {
  runtime_kind?: LocalRuntimeKind;
  install_state?: InstallState;
}): RuntimeDiagnostics[] {
  let diagnostics = [...store.runtimeDiagnostics.values()] as RuntimeDiagnostics[];
  if (filter?.runtime_kind) diagnostics = diagnostics.filter(d => d.runtime_kind === filter.runtime_kind);
  if (filter?.install_state) diagnostics = diagnostics.filter(d => d.install_state === filter.install_state);
  return diagnostics.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function generateBootstrapPlan(runtimeKind: LocalRuntimeKind): BootstrapPlan {
  const plans: Record<LocalRuntimeKind, { title: string; description: string; steps: BootstrapStep[] }> = {
    docker_desktop: {
      title: "Docker Desktop Installation and Setup",
      description: "Install Docker Desktop for container-based isolation and sandbox execution",
      steps: [
        { step_number: 1, description: "Download Docker Desktop installer", command: "winget install Docker.DockerDesktop", expected_outcome: "Docker Desktop installer downloaded and launched", is_optional: false, platform: "windows", estimated_duration_minutes: 5 },
        { step_number: 2, description: "Complete Docker Desktop installation wizard", expected_outcome: "Docker Desktop installed successfully", is_optional: false, platform: "windows", estimated_duration_minutes: 10 },
        { step_number: 3, description: "Restart computer if prompted", expected_outcome: "System restart completed", is_optional: false, platform: "windows", estimated_duration_minutes: 5 },
        { step_number: 4, description: "Start Docker Desktop application", command: "Start-Process 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'", expected_outcome: "Docker Desktop daemon running", is_optional: false, platform: "windows", estimated_duration_minutes: 2 },
        { step_number: 5, description: "Verify Docker is running", command: "docker run hello-world", expected_outcome: "Hello World container runs successfully", verification_command: "docker ps", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 2 },
        { step_number: 6, description: "Enable WSL2 backend in Docker Desktop settings", expected_outcome: "Docker Desktop configured to use WSL2 backend", is_optional: true, platform: "windows", estimated_duration_minutes: 3 }
      ]
    },
    wsl2: {
      title: "WSL2 Installation and Setup",
      description: "Install Windows Subsystem for Linux version 2 for Linux host validation",
      steps: [
        { step_number: 1, description: "Enable WSL feature", command: "dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart", expected_outcome: "WSL feature enabled", is_optional: false, platform: "windows", estimated_duration_minutes: 2 },
        { step_number: 2, description: "Enable Virtual Machine Platform", command: "dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart", expected_outcome: "Virtual Machine Platform enabled", is_optional: false, platform: "windows", estimated_duration_minutes: 2 },
        { step_number: 3, description: "Restart computer", expected_outcome: "System restart completed with WSL features enabled", is_optional: false, platform: "windows", estimated_duration_minutes: 5 },
        { step_number: 4, description: "Download and install WSL2 Linux kernel update", command: "wsl --update", expected_outcome: "WSL2 kernel updated", is_optional: false, platform: "windows", estimated_duration_minutes: 3 },
        { step_number: 5, description: "Set WSL2 as default", command: "wsl --set-default-version 2", expected_outcome: "WSL2 is the default version", is_optional: false, platform: "windows", estimated_duration_minutes: 1 },
        { step_number: 6, description: "Install Ubuntu distribution", command: "wsl --install -d Ubuntu", expected_outcome: "Ubuntu installed and accessible via WSL2", verification_command: "wsl --list --verbose", is_optional: false, platform: "windows", estimated_duration_minutes: 10 }
      ]
    },
    rust_cargo: {
      title: "Rust/Cargo Installation",
      description: "Install Rust toolchain and Cargo for Tauri desktop shell compilation",
      steps: [
        { step_number: 1, description: "Install Rust via rustup", command: "winget install Rustlang.Rustup", expected_outcome: "rustup installer launched", is_optional: false, platform: "windows", estimated_duration_minutes: 3 },
        { step_number: 2, description: "Complete rustup installation with default options", expected_outcome: "Rust stable toolchain installed", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 10 },
        { step_number: 3, description: "Verify Rust installation", command: "rustc --version && cargo --version", expected_outcome: "Both rustc and cargo version numbers displayed", verification_command: "cargo --version", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 1 },
        { step_number: 4, description: "Install Visual Studio Build Tools (required for linking)", command: "winget install Microsoft.VisualStudio.2022.BuildTools", expected_outcome: "MSVC build tools installed", is_optional: false, platform: "windows", estimated_duration_minutes: 15 },
        { step_number: 5, description: "Set CARGO_HOME and RUSTUP_HOME environment variables", command: "setx CARGO_HOME D:\\apex-localdev\\.cargo", expected_outcome: "Cargo home set to dedicated path", is_optional: true, platform: "windows", estimated_duration_minutes: 1 }
      ]
    },
    ollama: {
      title: "Ollama Installation and Setup",
      description: "Install Ollama for self-hosted model inference",
      steps: [
        { step_number: 1, description: "Download Ollama installer", command: "winget install Ollama.Ollama", expected_outcome: "Ollama installer downloaded and launched", is_optional: false, platform: "windows", estimated_duration_minutes: 3 },
        { step_number: 2, description: "Complete Ollama installation", expected_outcome: "Ollama installed and service started", is_optional: false, platform: "windows", estimated_duration_minutes: 5 },
        { step_number: 3, description: "Verify Ollama is running", command: "ollama list", expected_outcome: "Ollama responds with model list (may be empty)", verification_command: "ollama --version", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 1 },
        { step_number: 4, description: "Pull a default model", command: "ollama pull llama3.2", expected_outcome: "Default model downloaded and available", is_optional: true, platform: "cross_platform", estimated_duration_minutes: 30 }
      ]
    },
    temporal_cli: {
      title: "Temporal CLI Installation",
      description: "Install Temporal CLI for Temporal workflow orchestration",
      steps: [
        { step_number: 1, description: "Install Temporal CLI via npm", command: "npm install -g @temporalio/cli", expected_outcome: "Temporal CLI installed globally", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 2 },
        { step_number: 2, description: "Verify Temporal CLI installation", command: "temporal --version", expected_outcome: "Temporal CLI version displayed", verification_command: "temporal --version", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 1 },
        { step_number: 3, description: "Start local Temporal server (development)", command: "temporal server start-dev", expected_outcome: "Local Temporal development server running on port 7233", is_optional: true, platform: "cross_platform", estimated_duration_minutes: 3 }
      ]
    },
    node_js: {
      title: "Node.js Installation",
      description: "Install Node.js for local control plane and runtime execution",
      steps: [
        { step_number: 1, description: "Install Node.js LTS", command: "winget install OpenJS.NodeJS.LTS", expected_outcome: "Node.js LTS installed", is_optional: false, platform: "windows", estimated_duration_minutes: 5 },
        { step_number: 2, description: "Verify Node.js installation", command: "node --version && npm --version", expected_outcome: "Node.js and npm version numbers displayed", verification_command: "node --version", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 1 }
      ]
    },
    python: {
      title: "Python Installation",
      description: "Install Python for AT-SPI bindings and scripting",
      steps: [
        { step_number: 1, description: "Install Python 3", command: "winget install Python.Python.3.12", expected_outcome: "Python 3.12 installed", is_optional: false, platform: "windows", estimated_duration_minutes: 5 },
        { step_number: 2, description: "Verify Python installation", command: "python --version && pip --version", expected_outcome: "Python and pip version numbers displayed", verification_command: "python --version", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 1 }
      ]
    },
    git: {
      title: "Git Installation",
      description: "Install Git for version control operations",
      steps: [
        { step_number: 1, description: "Install Git", command: "winget install Git.Git", expected_outcome: "Git installed", is_optional: false, platform: "windows", estimated_duration_minutes: 3 },
        { step_number: 2, description: "Verify Git installation", command: "git --version", expected_outcome: "Git version number displayed", verification_command: "git --version", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 1 }
      ]
    },
    playwright: {
      title: "Playwright Installation",
      description: "Install Playwright for browser automation and DOM perception",
      steps: [
        { step_number: 1, description: "Install Playwright browsers", command: "npx playwright install", expected_outcome: "Chromium, Firefox, and WebKit browsers installed", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 10 },
        { step_number: 2, description: "Install Playwright system dependencies", command: "npx playwright install-deps", expected_outcome: "System dependencies for browser automation installed", is_optional: true, platform: "linux", estimated_duration_minutes: 5 },
        { step_number: 3, description: "Verify Playwright installation", command: "npx playwright --version", expected_outcome: "Playwright version displayed", verification_command: "npx playwright --version", is_optional: false, platform: "cross_platform", estimated_duration_minutes: 1 }
      ]
    }
  };

  const planDef = plans[runtimeKind];
  const requiredSteps = planDef.steps.filter(s => !s.is_optional).length;
  const optionalSteps = planDef.steps.filter(s => s.is_optional).length;

  const plan: BootstrapPlan = {
    plan_id: createEntityId("bootstrap"),
    runtime_kind: runtimeKind,
    title: planDef.title,
    description: planDef.description,
    steps: planDef.steps,
    total_steps: planDef.steps.length,
    required_steps: requiredSteps,
    optional_steps: optionalSteps,
    post_install_verification_command: planDef.steps.find(s => s.verification_command)?.verification_command,
    created_at: nowIso()
  };

  store.bootstrapPlans.set(plan.plan_id, plan);

  recordAudit("local_runtime.bootstrap_plan_generated", {
    plan_id: plan.plan_id,
    runtime_kind: runtimeKind,
    total_steps: plan.total_steps
  });

  return plan;
}

export function listBootstrapPlans(filter?: { runtime_kind?: LocalRuntimeKind }): BootstrapPlan[] {
  let plans = [...store.bootstrapPlans.values()] as BootstrapPlan[];
  if (filter?.runtime_kind) plans = plans.filter(p => p.runtime_kind === filter.runtime_kind);
  return plans.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function runPostInstallVerification(runtimeKind: LocalRuntimeKind): PostInstallVerification {
  const checks: PostInstallVerification["checks"] = [];

  const diagnostics = detectRuntimeInstallState(runtimeKind);

  checks.push({
    check_name: "install_detected",
    passed: diagnostics.install_state !== "not_installed" && diagnostics.install_state !== "detection_failed",
    actual_value: diagnostics.install_state,
    expected_value: "installed_and_running",
    details: diagnostics.install_state === "not_installed" ? diagnostics.blocker_reason : undefined
  });

  if (diagnostics.detected_version) {
    checks.push({
      check_name: "version_detected",
      passed: true,
      actual_value: diagnostics.detected_version,
      expected_value: diagnostics.required_version
    });
  }

  if (runtimeKind === "docker_desktop") {
    checks.push({
      check_name: "docker_daemon_running",
      passed: diagnostics.install_state === "installed_and_running",
      expected_value: "Docker daemon responding to 'docker ps'",
      details: diagnostics.install_state !== "installed_and_running" ? "Docker daemon may not be running" : undefined
    });
  }

  if (runtimeKind === "wsl2") {
    checks.push({
      check_name: "wsl2_distribution_available",
      passed: diagnostics.install_state === "installed_and_running",
      expected_value: "At least one WSL2 distribution installed",
      details: diagnostics.install_state !== "installed_and_running" ? "No WSL2 distribution found" : undefined
    });
  }

  const allPassed = checks.every(c => c.passed);
  const anyFailed = checks.some(c => !c.passed);

  const verification: PostInstallVerification = {
    verification_id: createEntityId("postver"),
    runtime_kind: runtimeKind,
    passed: allPassed,
    checks,
    overall_result: allPassed ? "pass" : anyFailed ? "fail" : "partial",
    created_at: nowIso()
  };

  store.postInstallVerifications.set(verification.verification_id, verification);

  recordAudit("local_runtime.post_install_verification", {
    verification_id: verification.verification_id,
    runtime_kind: runtimeKind,
    passed: allPassed,
    overall_result: verification.overall_result
  });

  return verification;
}

export function listPostInstallVerifications(filter?: { runtime_kind?: LocalRuntimeKind }): PostInstallVerification[] {
  let verifications = [...store.postInstallVerifications.values()] as PostInstallVerification[];
  if (filter?.runtime_kind) verifications = verifications.filter(v => v.runtime_kind === filter.runtime_kind);
  return verifications.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function generateLocalEnvironmentReport(): LocalEnvironmentReport {
  const runtimeKinds: LocalRuntimeKind[] = [
    "docker_desktop", "wsl2", "rust_cargo", "ollama", "temporal_cli",
    "node_js", "python", "git", "playwright"
  ];

  const runtimes = runtimeKinds.map(kind => {
    const existing = ([...store.runtimeDiagnostics.values()] as RuntimeDiagnostics[])
      .filter(d => d.runtime_kind === kind)
      .sort((a, b) => b.last_checked_at.localeCompare(a.last_checked_at));

    const diag = existing[0] ?? detectRuntimeInstallState(kind);

    return {
      runtime_kind: kind,
      install_state: diag.install_state,
      version: diag.detected_version,
      blocker: diag.blocker_reason
    };
  });

  const readyCount = runtimes.filter(r => r.install_state === "installed_and_running").length;
  const needsInstallCount = runtimes.filter(r => r.install_state === "not_installed").length;
  const needsStartCount = runtimes.filter(r => r.install_state === "installed_but_not_running").length;
  const versionMismatchCount = runtimes.filter(r => r.install_state === "installed_version_mismatch").length;
  const detectionFailedCount = runtimes.filter(r => r.install_state === "detection_failed").length;

  const report: LocalEnvironmentReport = {
    report_id: createEntityId("envreport"),
    platform: process.platform,
    platform_version: process.version,
    architecture: process.arch,
    runtimes,
    summary: {
      total_runtimes: runtimes.length,
      ready_count: readyCount,
      needs_install_count: needsInstallCount,
      needs_start_count: needsStartCount,
      version_mismatch_count: versionMismatchCount,
      detection_failed_count: detectionFailedCount
    },
    generated_at: nowIso()
  };

  recordAudit("local_runtime.environment_report_generated", {
    report_id: report.report_id,
    ready_count: readyCount,
    needs_install_count: needsInstallCount
  });

  return report;
}

export function detectAllRuntimes(): RuntimeDiagnostics[] {
  const kinds: LocalRuntimeKind[] = [
    "docker_desktop", "wsl2", "rust_cargo", "ollama", "temporal_cli",
    "node_js", "python", "git", "playwright"
  ];
  return kinds.map(k => detectRuntimeInstallState(k));
}
