import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type EndpointKind =
  | "temporal"
  | "langgraph"
  | "sso"
  | "deerflow"
  | "model_inference"
  | "libsql"
  | "otel_collector";

export type EndpointConfigStatus = "not_configured" | "configured_but_unreachable" | "configured_and_reachable" | "configured_invalid";

export interface EndpointConfig {
  config_id: string;
  endpoint_kind: EndpointKind;
  display_name: string;
  description: string;
  url?: string;
  port?: number;
  protocol?: "http" | "https" | "grpc" | "ws" | "wss";
  status: EndpointConfigStatus;
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

export interface CredentialInventory {
  inventory_id: string;
  endpoint_kind: EndpointKind;
  required_secrets: Array<{
    secret_name: string;
    description: string;
    is_configured: boolean;
    source?: "env_var" | "config_file" | "vault" | "cli_arg" | "not_set";
  }>;
  total_required: number;
  total_configured: number;
  total_missing: number;
  created_at: string;
}

export interface ConnectivityPreflightResult {
  preflight_id: string;
  endpoint_kind: EndpointKind;
  url: string;
  status: "reachable" | "unreachable" | "dns_failed" | "connection_refused" | "timeout" | "ssl_error" | "auth_failed" | "not_configured";
  response_time_ms?: number;
  http_status_code?: number;
  error_details?: string;
  recommendations: string[];
  checked_at: string;
}

export interface OnboardingRunbook {
  runbook_id: string;
  endpoint_kind: EndpointKind;
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

export function registerEndpointConfig(input: {
  endpoint_kind: EndpointKind;
  display_name: string;
  description: string;
  url?: string;
  port?: number;
  protocol?: "http" | "https" | "grpc" | "ws" | "wss";
  required_env_vars?: Array<{
    var_name: string;
    description: string;
    is_secret: boolean;
    is_required: boolean;
    example_value?: string;
  }>;
}): EndpointConfig {
  const configuredEnvVars: string[] = [];
  const missingEnvVars: string[] = [];

  const envVars = input.required_env_vars ?? [];
  for (const ev of envVars) {
    if (ev.is_required && !process.env[ev.var_name]) {
      missingEnvVars.push(ev.var_name);
    } else if (process.env[ev.var_name]) {
      configuredEnvVars.push(ev.var_name);
    }
  }

  let status: EndpointConfigStatus = "not_configured";
  if (input.url && missingEnvVars.length === 0) {
    status = "configured_but_unreachable";
  } else if (input.url && missingEnvVars.length > 0) {
    status = "configured_invalid";
  } else if (!input.url) {
    status = "not_configured";
  }

  const redactedConfig: Record<string, unknown> = {};
  if (input.url) redactedConfig["url"] = input.url;
  if (input.protocol) redactedConfig["protocol"] = input.protocol;
  for (const ev of envVars) {
    redactedConfig[ev.var_name] = process.env[ev.var_name] ? "***REDACTED***" : "<NOT_SET>";
  }

  const config: EndpointConfig = {
    config_id: createEntityId("epcfg"),
    endpoint_kind: input.endpoint_kind,
    display_name: input.display_name,
    description: input.description,
    url: input.url,
    port: input.port,
    protocol: input.protocol,
    status,
    required_env_vars: envVars,
    configured_env_vars: configuredEnvVars,
    missing_env_vars: missingEnvVars,
    connectivity_preflight: {
      attempted: false
    },
    redacted_config: redactedConfig,
    created_at: nowIso()
  };

  store.endpointConfigs.set(config.config_id, config);

  recordAudit("endpoint_onboarding.config_registered", {
    config_id: config.config_id,
    endpoint_kind: input.endpoint_kind,
    status,
    missing_env_vars_count: missingEnvVars.length
  });

  return config;
}

export function listEndpointConfigs(filter?: {
  endpoint_kind?: EndpointKind;
  status?: EndpointConfigStatus;
}): EndpointConfig[] {
  let configs = [...store.endpointConfigs.values()] as EndpointConfig[];
  if (filter?.endpoint_kind) configs = configs.filter(c => c.endpoint_kind === filter.endpoint_kind);
  if (filter?.status) configs = configs.filter(c => c.status === filter.status);
  return configs.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getEndpointConfig(configId: string): EndpointConfig | undefined {
  return store.endpointConfigs.get(configId) as EndpointConfig | undefined;
}

export function runConnectivityPreflight(configId: string): ConnectivityPreflightResult {
  const config = store.endpointConfigs.get(configId) as EndpointConfig | undefined;
  if (!config || !config.url) {
    const result: ConnectivityPreflightResult = {
      preflight_id: createEntityId("preflight"),
      endpoint_kind: config?.endpoint_kind ?? "temporal",
      url: config?.url ?? "not_configured",
      status: "not_configured",
      recommendations: ["Configure the endpoint URL before running connectivity preflight"],
      checked_at: nowIso()
    };
    return result;
  }

  const recommendations: string[] = [];

  if (config.missing_env_vars.length > 0) {
    recommendations.push(`Set missing environment variables: ${config.missing_env_vars.join(", ")}`);
  }
  recommendations.push(`Verify the ${config.display_name} service is running at ${config.url}`);
  recommendations.push(`Check network connectivity and firewall rules for ${config.url}`);

  if (config.endpoint_kind === "temporal") {
    recommendations.push("Ensure Temporal server is running: temporal server start-dev");
  }
  if (config.endpoint_kind === "langgraph") {
    recommendations.push("Ensure LangGraph runtime is deployed and accessible");
  }
  if (config.endpoint_kind === "sso") {
    recommendations.push("Verify SSO provider issuer URL and client credentials");
  }
  if (config.endpoint_kind === "model_inference") {
    recommendations.push("For Ollama: ensure 'ollama serve' is running");
    recommendations.push("For cloud providers: verify API key and endpoint URL");
  }

  const result: ConnectivityPreflightResult = {
    preflight_id: createEntityId("preflight"),
    endpoint_kind: config.endpoint_kind,
    url: config.url,
    status: "unreachable",
    recommendations,
    checked_at: nowIso()
  };

  config.connectivity_preflight = {
    attempted: true,
    reachable: false,
    error: `Endpoint ${config.url} not reachable (simulated - no real network call in preparation layer)`,
    checked_at: nowIso()
  };
  config.status = "configured_but_unreachable";
  config.updated_at = nowIso();
  store.endpointConfigs.set(config.config_id, config);

  recordAudit("endpoint_onboarding.preflight_run", {
    preflight_id: result.preflight_id,
    endpoint_kind: config.endpoint_kind,
    status: result.status,
    url: config.url
  });

  return result;
}

export function getCredentialInventory(endpointKind: EndpointKind): CredentialInventory {
  const configs = ([...store.endpointConfigs.values()] as EndpointConfig[])
    .filter(c => c.endpoint_kind === endpointKind);

  const secrets = configs.flatMap(c =>
    c.required_env_vars.filter(ev => ev.is_secret).map(ev => ({
      secret_name: ev.var_name,
      description: ev.description,
      is_configured: !!process.env[ev.var_name],
      source: process.env[ev.var_name] ? "env_var" as const : "not_set" as const
    }))
  );

  const totalRequired = secrets.length;
  const totalConfigured = secrets.filter(s => s.is_configured).length;
  const totalMissing = totalRequired - totalConfigured;

  const inventory: CredentialInventory = {
    inventory_id: createEntityId("credinv"),
    endpoint_kind: endpointKind,
    required_secrets: secrets,
    total_required: totalRequired,
    total_configured: totalConfigured,
    total_missing: totalMissing,
    created_at: nowIso()
  };

  return inventory;
}

export function generateOnboardingRunbook(endpointKind: EndpointKind): OnboardingRunbook {
  const runbooks: Record<EndpointKind, Omit<OnboardingRunbook, "runbook_id" | "created_at" | "endpoint_kind">> = {
    temporal: {
      title: "Temporal Endpoint Onboarding",
      setup_steps: [
        { step_number: 1, description: "Install Temporal CLI", command: "npm install -g @temporalio/cli", expected_outcome: "Temporal CLI available in PATH" },
        { step_number: 2, description: "Start local Temporal server", command: "temporal server start-dev", expected_outcome: "Temporal server running on localhost:7233" },
        { step_number: 3, description: "Set Temporal endpoint environment variable", command: "set TEMPORAL_ADDRESS=localhost:7233", expected_outcome: "TEMPORAL_ADDRESS env var set", verification: "echo %TEMPORAL_ADDRESS%" },
        { step_number: 4, description: "Set Temporal namespace", command: "set TEMPORAL_NAMESPACE=default", expected_outcome: "TEMPORAL_NAMESPACE env var set" },
        { step_number: 5, description: "Verify Temporal connectivity", command: "temporal workflow list", expected_outcome: "Workflow list returns (may be empty)" }
      ],
      expected_secret_inventory: [
        { secret_name: "TEMPORAL_ADDRESS", description: "Temporal server address", source_hint: "Set to localhost:7233 for local dev" },
        { secret_name: "TEMPORAL_NAMESPACE", description: "Temporal namespace", source_hint: "Set to 'default' for local dev" },
        { secret_name: "TEMPORAL_TLS_CERT", description: "TLS certificate path (production)", source_hint: "Only needed for TLS-enabled Temporal" }
      ],
      verification_steps: [
        { step_number: 1, description: "Check Temporal server health", command: "temporal operator cluster health", expected_result: "Cluster is healthy" },
        { step_number: 2, description: "List namespaces", command: "temporal operator namespace list", expected_result: "At least 'default' namespace listed" }
      ],
      troubleshooting: [
        { symptom: "Connection refused on port 7233", likely_cause: "Temporal server not running", resolution: "Start Temporal server with 'temporal server start-dev'" },
        { symptom: "TLS handshake error", likely_cause: "TLS configured but certificates missing", resolution: "Set TEMPORAL_TLS_CERT and TEMPORAL_TLS_KEY or disable TLS for local dev" }
      ]
    },
    langgraph: {
      title: "LangGraph Endpoint Onboarding",
      setup_steps: [
        { step_number: 1, description: "Deploy LangGraph runtime", expected_outcome: "LangGraph runtime accessible via HTTP/gRPC endpoint" },
        { step_number: 2, description: "Set LangGraph endpoint URL", command: "set LANGGRAPH_ENDPOINT=http://localhost:8000", expected_outcome: "LANGGRAPH_ENDPOINT env var set" },
        { step_number: 3, description: "Set LangGraph API key if required", command: "set LANGGRAPH_API_KEY=your-api-key", expected_outcome: "LANGGRAPH_API_KEY env var set" },
        { step_number: 4, description: "Verify LangGraph connectivity", expected_outcome: "LangGraph health endpoint responds 200 OK" }
      ],
      expected_secret_inventory: [
        { secret_name: "LANGGRAPH_ENDPOINT", description: "LangGraph runtime URL", source_hint: "Set to deployed LangGraph instance URL" },
        { secret_name: "LANGGRAPH_API_KEY", description: "API key for LangGraph", source_hint: "Obtain from LangGraph deployment" }
      ],
      verification_steps: [
        { step_number: 1, description: "Check LangGraph health", expected_result: "Health endpoint returns 200" },
        { step_number: 2, description: "List available graphs", expected_result: "At least one graph is registered" }
      ],
      troubleshooting: [
        { symptom: "Endpoint returns 404", likely_cause: "LangGraph runtime not deployed or wrong URL", resolution: "Verify deployment and URL path" },
        { symptom: "Authentication failed", likely_cause: "Invalid or missing API key", resolution: "Verify LANGGRAPH_API_KEY is set correctly" }
      ]
    },
    sso: {
      title: "SSO Provider Endpoint Onboarding",
      setup_steps: [
        { step_number: 1, description: "Register application with SSO provider", expected_outcome: "Client ID and secret obtained from provider" },
        { step_number: 2, description: "Set SSO issuer URL", command: "set SSO_ISSUER_URL=https://your-provider.okta.com/oauth2/default", expected_outcome: "SSO_ISSUER_URL env var set" },
        { step_number: 3, description: "Set SSO client ID", command: "set SSO_CLIENT_ID=your-client-id", expected_outcome: "SSO_CLIENT_ID env var set" },
        { step_number: 4, description: "Set SSO client secret", command: "set SSO_CLIENT_SECRET=your-client-secret", expected_outcome: "SSO_CLIENT_SECRET env var set" },
        { step_number: 5, description: "Configure callback URL in SSO provider", expected_outcome: "Callback URL registered: http://localhost:3000/auth/callback" }
      ],
      expected_secret_inventory: [
        { secret_name: "SSO_ISSUER_URL", description: "SSO provider issuer URL", source_hint: "Obtain from SSO provider dashboard" },
        { secret_name: "SSO_CLIENT_ID", description: "SSO application client ID", source_hint: "Obtain from SSO provider dashboard" },
        { secret_name: "SSO_CLIENT_SECRET", description: "SSO application client secret", source_hint: "Obtain from SSO provider dashboard" }
      ],
      verification_steps: [
        { step_number: 1, description: "Verify SSO issuer URL is reachable", expected_result: "OIDC discovery endpoint returns valid configuration" },
        { step_number: 2, description: "Test authentication flow", expected_result: "User can authenticate via SSO provider" }
      ],
      troubleshooting: [
        { symptom: "OIDC discovery fails", likely_cause: "Invalid issuer URL", resolution: "Verify issuer URL format matches provider documentation" },
        { symptom: "Invalid client error", likely_cause: "Wrong client ID or secret", resolution: "Verify credentials from provider dashboard" }
      ]
    },
    deerflow: {
      title: "DeerFlow Endpoint Onboarding",
      setup_steps: [
        { step_number: 1, description: "Deploy DeerFlow worker service", expected_outcome: "DeerFlow worker accessible via gRPC endpoint" },
        { step_number: 2, description: "Set DeerFlow endpoint URL", command: "set DEERFLOW_ENDPOINT=http://localhost:50051", expected_outcome: "DEERFLOW_ENDPOINT env var set" },
        { step_number: 3, description: "Set DeerFlow authentication token", command: "set DEERFLOW_AUTH_TOKEN=your-token", expected_outcome: "DEERFLOW_AUTH_TOKEN env var set" },
        { step_number: 4, description: "Verify DeerFlow connectivity", expected_outcome: "DeerFlow health check returns OK" }
      ],
      expected_secret_inventory: [
        { secret_name: "DEERFLOW_ENDPOINT", description: "DeerFlow worker endpoint URL", source_hint: "Set to deployed DeerFlow instance URL" },
        { secret_name: "DEERFLOW_AUTH_TOKEN", description: "Authentication token for DeerFlow", source_hint: "Obtain from DeerFlow deployment admin" }
      ],
      verification_steps: [
        { step_number: 1, description: "Check DeerFlow health", expected_result: "Health check returns OK" },
        { step_number: 2, description: "List registered workers", expected_result: "At least one worker is registered" }
      ],
      troubleshooting: [
        { symptom: "gRPC connection refused", likely_cause: "DeerFlow worker not running", resolution: "Start DeerFlow worker service" },
        { symptom: "Authentication failed", likely_cause: "Invalid or expired token", resolution: "Regenerate auth token from DeerFlow admin" }
      ]
    },
    model_inference: {
      title: "Model Inference Endpoint Onboarding",
      setup_steps: [
        { step_number: 1, description: "Install Ollama for local inference", command: "winget install Ollama.Ollama", expected_outcome: "Ollama installed" },
        { step_number: 2, description: "Start Ollama service", command: "ollama serve", expected_outcome: "Ollama listening on localhost:11434" },
        { step_number: 3, description: "Pull a model", command: "ollama pull llama3.2", expected_outcome: "Model downloaded and available" },
        { step_number: 4, description: "Set model inference endpoint", command: "set MODEL_INFERENCE_URL=http://localhost:11434", expected_outcome: "MODEL_INFERENCE_URL env var set" },
        { step_number: 5, description: "Set API key for cloud providers (if using)", command: "set OPENAI_API_KEY=sk-...", expected_outcome: "API key configured" }
      ],
      expected_secret_inventory: [
        { secret_name: "MODEL_INFERENCE_URL", description: "Model inference endpoint URL", source_hint: "http://localhost:11434 for Ollama, or cloud provider URL" },
        { secret_name: "OPENAI_API_KEY", description: "OpenAI API key (if using OpenAI)", source_hint: "Obtain from https://platform.openai.com/api-keys" },
        { secret_name: "ANTHROPIC_API_KEY", description: "Anthropic API key (if using Claude)", source_hint: "Obtain from https://console.anthropic.com/" }
      ],
      verification_steps: [
        { step_number: 1, description: "Check Ollama health", command: "ollama list", expected_result: "At least one model listed" },
        { step_number: 2, description: "Test model inference", command: "ollama run llama3.2 'Hello'", expected_result: "Model responds with text" }
      ],
      troubleshooting: [
        { symptom: "Ollama not responding", likely_cause: "Ollama service not running", resolution: "Run 'ollama serve' to start the service" },
        { symptom: "Model not found", likely_cause: "Model not pulled", resolution: "Run 'ollama pull <model_name>' to download" },
        { symptom: "API key invalid", likely_cause: "Expired or incorrect key", resolution: "Regenerate API key from provider dashboard" }
      ]
    },
    libsql: {
      title: "libSQL/Turso Endpoint Onboarding",
      setup_steps: [
        { step_number: 1, description: "Create Turso database", command: "turso db create apex", expected_outcome: "Turso database created" },
        { step_number: 2, description: "Get database URL", command: "turso db show apex --url", expected_outcome: "Database URL obtained" },
        { step_number: 3, description: "Create auth token", command: "turso db tokens create apex", expected_outcome: "Auth token obtained" },
        { step_number: 4, description: "Set environment variables", command: "set LIBSQL_URL=libsql://apex-xxx.turso.io", expected_outcome: "LIBSQL_URL env var set" }
      ],
      expected_secret_inventory: [
        { secret_name: "LIBSQL_URL", description: "libSQL connection URL", source_hint: "Obtain from Turso dashboard or 'turso db show --url'" },
        { secret_name: "LIBSQL_AUTH_TOKEN", description: "libSQL authentication token", source_hint: "Obtain from 'turso db tokens create'" }
      ],
      verification_steps: [
        { step_number: 1, description: "Test database connection", expected_result: "Connection established and schema accessible" }
      ],
      troubleshooting: [
        { symptom: "Connection refused", likely_cause: "Database URL incorrect or service down", resolution: "Verify URL from Turso dashboard" },
        { symptom: "Authentication failed", likely_cause: "Invalid or expired token", resolution: "Regenerate token with 'turso db tokens create'" }
      ]
    },
    otel_collector: {
      title: "OTEL Collector Endpoint Onboarding",
      setup_steps: [
        { step_number: 1, description: "Deploy OTEL Collector", expected_outcome: "OTEL Collector accessible at configured endpoint" },
        { step_number: 2, description: "Set OTEL export endpoint", command: "set OTEL_EXPORT_ENDPOINT=http://localhost:4318/v1/traces", expected_outcome: "OTEL_EXPORT_ENDPOINT env var set" },
        { step_number: 3, description: "Set OTEL headers (if auth required)", command: "set OTEL_EXPORT_HEADERS=Authorization=Bearer xxx", expected_outcome: "OTEL_EXPORT_HEADERS env var set" }
      ],
      expected_secret_inventory: [
        { secret_name: "OTEL_EXPORT_ENDPOINT", description: "OTEL collector endpoint URL", source_hint: "Set to OTEL collector HTTP endpoint" },
        { secret_name: "OTEL_EXPORT_HEADERS", description: "OTEL export headers (auth)", source_hint: "Set if collector requires authentication" }
      ],
      verification_steps: [
        { step_number: 1, description: "Send test trace", expected_result: "Trace exported successfully without error" }
      ],
      troubleshooting: [
        { symptom: "Export fails with connection refused", likely_cause: "OTEL collector not running", resolution: "Start OTEL collector service" },
        { symptom: "Export fails with 401", likely_cause: "Authentication header missing or invalid", resolution: "Verify OTEL_EXPORT_HEADERS value" }
      ]
    }
  };

  const runbookDef = runbooks[endpointKind];

  const runbook: OnboardingRunbook = {
    runbook_id: createEntityId("onbrunbook"),
    endpoint_kind: endpointKind,
    title: runbookDef.title,
    setup_steps: runbookDef.setup_steps,
    expected_secret_inventory: runbookDef.expected_secret_inventory,
    verification_steps: runbookDef.verification_steps,
    troubleshooting: runbookDef.troubleshooting,
    created_at: nowIso()
  };

  store.onboardingRunbooks.set(runbook.runbook_id, runbook);

  recordAudit("endpoint_onboarding.runbook_generated", {
    runbook_id: runbook.runbook_id,
    endpoint_kind: endpointKind,
    title: runbookDef.title
  });

  return runbook;
}

export function listOnboardingRunbooks(filter?: { endpoint_kind?: EndpointKind }): OnboardingRunbook[] {
  let runbooks = [...store.onboardingRunbooks.values()] as OnboardingRunbook[];
  if (filter?.endpoint_kind) runbooks = runbooks.filter(r => r.endpoint_kind === filter.endpoint_kind);
  return runbooks.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function validateEndpointConfigSchema(configId: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const config = store.endpointConfigs.get(configId) as EndpointConfig | undefined;
  if (!config) {
    return { valid: false, errors: ["Config not found"], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.url && config.endpoint_kind !== "sso") {
    errors.push("URL is required for this endpoint kind");
  }

  if (config.url) {
    try {
      new URL(config.url);
    } catch {
      errors.push(`Invalid URL format: ${config.url}`);
    }
  }

  const requiredSecrets = config.required_env_vars.filter(ev => ev.is_required && ev.is_secret);
  for (const secret of requiredSecrets) {
    if (!process.env[secret.var_name]) {
      errors.push(`Required secret not configured: ${secret.var_name}`);
    }
  }

  const requiredNonSecrets = config.required_env_vars.filter(ev => ev.is_required && !ev.is_secret);
  for (const ns of requiredNonSecrets) {
    if (!process.env[ns.var_name]) {
      warnings.push(`Required environment variable not set: ${ns.var_name}`);
    }
  }

  if (config.protocol === "https" && config.url && config.url.startsWith("http://")) {
    warnings.push("Protocol is HTTPS but URL starts with http://");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function initializeDefaultEndpointConfigs(): EndpointConfig[] {
  const existing = [...store.endpointConfigs.values()] as EndpointConfig[];
  if (existing.length > 0) return existing;

  const defaults: Array<Parameters<typeof registerEndpointConfig>[0]> = [
    {
      endpoint_kind: "temporal",
      display_name: "Temporal Server",
      description: "Temporal workflow orchestration server endpoint",
      url: process.env.TEMPORAL_ADDRESS ?? undefined,
      protocol: "grpc",
      required_env_vars: [
        { var_name: "TEMPORAL_ADDRESS", description: "Temporal server address", is_secret: false, is_required: true, example_value: "localhost:7233" },
        { var_name: "TEMPORAL_NAMESPACE", description: "Temporal namespace", is_secret: false, is_required: false, example_value: "default" },
        { var_name: "TEMPORAL_TLS_CERT", description: "TLS certificate path", is_secret: true, is_required: false }
      ]
    },
    {
      endpoint_kind: "langgraph",
      display_name: "LangGraph Runtime",
      description: "LangGraph graph runtime endpoint",
      url: process.env.LANGGRAPH_ENDPOINT ?? undefined,
      protocol: "http",
      required_env_vars: [
        { var_name: "LANGGRAPH_ENDPOINT", description: "LangGraph runtime URL", is_secret: false, is_required: true, example_value: "http://localhost:8000" },
        { var_name: "LANGGRAPH_API_KEY", description: "API key for LangGraph", is_secret: true, is_required: false }
      ]
    },
    {
      endpoint_kind: "sso",
      display_name: "SSO Provider",
      description: "Single Sign-On identity provider endpoint",
      url: process.env.SSO_ISSUER_URL ?? undefined,
      protocol: "https",
      required_env_vars: [
        { var_name: "SSO_ISSUER_URL", description: "SSO provider issuer URL", is_secret: false, is_required: true, example_value: "https://your-provider.okta.com/oauth2/default" },
        { var_name: "SSO_CLIENT_ID", description: "SSO application client ID", is_secret: false, is_required: true },
        { var_name: "SSO_CLIENT_SECRET", description: "SSO application client secret", is_secret: true, is_required: true }
      ]
    },
    {
      endpoint_kind: "deerflow",
      display_name: "DeerFlow Worker",
      description: "DeerFlow worker service endpoint",
      url: process.env.DEERFLOW_ENDPOINT ?? undefined,
      protocol: "grpc",
      required_env_vars: [
        { var_name: "DEERFLOW_ENDPOINT", description: "DeerFlow worker endpoint URL", is_secret: false, is_required: true, example_value: "http://localhost:50051" },
        { var_name: "DEERFLOW_AUTH_TOKEN", description: "Authentication token for DeerFlow", is_secret: true, is_required: true }
      ]
    },
    {
      endpoint_kind: "model_inference",
      display_name: "Model Inference Service",
      description: "LLM model inference endpoint (Ollama, OpenAI, etc.)",
      url: process.env.MODEL_INFERENCE_URL ?? process.env.OLLAMA_HOST ?? undefined,
      protocol: "http",
      required_env_vars: [
        { var_name: "MODEL_INFERENCE_URL", description: "Model inference endpoint URL", is_secret: false, is_required: true, example_value: "http://localhost:11434" },
        { var_name: "OPENAI_API_KEY", description: "OpenAI API key", is_secret: true, is_required: false },
        { var_name: "ANTHROPIC_API_KEY", description: "Anthropic API key", is_secret: true, is_required: false }
      ]
    },
    {
      endpoint_kind: "libsql",
      display_name: "libSQL/Turso Database",
      description: "libSQL database connection endpoint",
      url: process.env.LIBSQL_URL ?? undefined,
      protocol: "http",
      required_env_vars: [
        { var_name: "LIBSQL_URL", description: "libSQL connection URL", is_secret: false, is_required: true, example_value: "libsql://apex-xxx.turso.io" },
        { var_name: "LIBSQL_AUTH_TOKEN", description: "libSQL authentication token", is_secret: true, is_required: true }
      ]
    },
    {
      endpoint_kind: "otel_collector",
      display_name: "OTEL Collector",
      description: "OpenTelemetry collector endpoint for trace export",
      url: process.env.OTEL_EXPORT_ENDPOINT ?? undefined,
      protocol: "http",
      required_env_vars: [
        { var_name: "OTEL_EXPORT_ENDPOINT", description: "OTEL collector endpoint URL", is_secret: false, is_required: true, example_value: "http://localhost:4318/v1/traces" },
        { var_name: "OTEL_EXPORT_HEADERS", description: "OTEL export headers (auth)", is_secret: true, is_required: false }
      ]
    }
  ];

  return defaults.map(d => registerEndpointConfig(d));
}
