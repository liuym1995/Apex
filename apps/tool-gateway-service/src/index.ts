import Fastify from "fastify";
import { createHash } from "node:crypto";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import {
  addArtifact,
  listTaskToolInvocations,
  mirrorTaskContract,
  recordToolInvocation,
  requireTask,
  sendHeartbeat
} from "@apex/shared-runtime";
import { TaskContractSchema, type ConnectorSpec } from "@apex/shared-types";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "tool-gateway-service", PORT: process.env.PORT ?? "3007" });
const app = Fastify({ logger: false });
const HTTP_FETCH_ALLOWLIST = (process.env.APEX_TOOL_HTTP_ALLOWLIST ?? "127.0.0.1,localhost")
  .split(",")
  .map(item => item.trim().toLowerCase())
  .filter(Boolean);

type ConnectorExecutionContext = {
  task_id: string;
  input: Record<string, unknown>;
};

type ConnectorExecutionResult = {
  task_id: string;
  tool_name: string;
  message: string;
  reconciliation_mode: "artifact" | "external_state";
  idempotent_reuse: boolean;
} & Record<string, unknown>;

type RuntimeConnectorSpec = ConnectorSpec & {
  execute?: (context: ConnectorExecutionContext) => Promise<ConnectorExecutionResult>;
};

const externalState = new Map<string, {
  task_id: string;
  tool_name: string;
  idempotency_key: string;
  state: "pending" | "applied" | "failed";
  message: string;
  updated_at: string;
}>();

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(",")}}`;
}

function buildIdempotencyKey(toolName: string, taskId: string, input: Record<string, unknown>) {
  const digest = createHash("sha256").update(`${toolName}:${taskId}:${stableStringify(input)}`).digest("hex").slice(0, 24);
  return `${toolName}_${digest}`;
}

function externalStateKey(taskId: string, toolName: string, idempotencyKey: string) {
  return `${taskId}:${toolName}:${idempotencyKey}`;
}

function assertAllowedHttpTarget(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are allowed for http_json_fetch.");
  }
  const normalizedHostname = url.hostname.toLowerCase();
  if (!HTTP_FETCH_ALLOWLIST.includes(normalizedHostname)) {
    throw new Error(`Host '${url.hostname}' is not in the http_json_fetch allowlist.`);
  }
  return url;
}

function getBearerTokenFromEnv(envName: string) {
  const token = process.env[envName]?.trim();
  if (!token) {
    throw new Error(`Missing required bearer token environment variable '${envName}'.`);
  }
  return token;
}

async function executeHttpJsonFetch(taskId: string, normalizedInput: Record<string, unknown>): Promise<ConnectorExecutionResult> {
  const rawUrl = typeof normalizedInput.url === "string" ? normalizedInput.url : "";
  if (!rawUrl) {
    throw new Error("http_json_fetch requires input.url.");
  }
  const url = assertAllowedHttpTarget(rawUrl);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain;q=0.9, */*;q=0.5",
      "user-agent": "apex-tool-gateway/0.1"
    },
    signal: AbortSignal.timeout(10_000)
  });
  const contentType = response.headers.get("content-type") ?? null;
  const bodyText = await response.text();
  const trimmedBody = bodyText.slice(0, 4000);
  let parsedJson: unknown = null;
  if (contentType?.includes("application/json")) {
    try {
      parsedJson = JSON.parse(bodyText);
    } catch {
      parsedJson = null;
    }
  }
  addArtifact(
    taskId,
    `http_json_fetch_${url.hostname.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.json`,
    "generic",
    JSON.stringify(
      {
        url: url.toString(),
        status_code: response.status,
        content_type: contentType,
        body_preview: trimmedBody,
        json: parsedJson
      },
      null,
      2
    ),
    response.ok ? "ready" : "partial"
  );
  return {
    task_id: taskId,
    tool_name: "http_json_fetch",
    message: `Fetched ${url.toString()} via allowlisted http_json_fetch.`,
    reconciliation_mode: "artifact" as const,
    idempotent_reuse: false,
    url: url.toString(),
    status_code: response.status,
    content_type: contentType,
    body_preview: trimmedBody,
    json: parsedJson
  };
}

async function executeCrmContactLookup(taskId: string, normalizedInput: Record<string, unknown>): Promise<ConnectorExecutionResult> {
  const rawUrl = typeof normalizedInput.url === "string" ? normalizedInput.url : "";
  const email = typeof normalizedInput.email === "string" ? normalizedInput.email.trim().toLowerCase() : "";
  const contactId = typeof normalizedInput.contact_id === "string" ? normalizedInput.contact_id.trim() : "";
  if (!rawUrl) {
    throw new Error("crm_contact_lookup requires input.url.");
  }
  if (!email && !contactId) {
    throw new Error("crm_contact_lookup requires input.email or input.contact_id.");
  }

  const url = assertAllowedHttpTarget(rawUrl);
  if (email) {
    url.searchParams.set("email", email);
  }
  if (contactId) {
    url.searchParams.set("contact_id", contactId);
  }
  const pageSize = typeof normalizedInput.page_size === "number" ? normalizedInput.page_size : undefined;
  const cursor = typeof normalizedInput.cursor === "string" ? normalizedInput.cursor.trim() : "";
  if (pageSize) {
    url.searchParams.set("page_size", String(pageSize));
  }
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  const bearerEnvName = typeof normalizedInput.auth_env === "string" && normalizedInput.auth_env.trim().length > 0
    ? normalizedInput.auth_env.trim()
    : "APEX_CRM_BEARER_TOKEN";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${getBearerTokenFromEnv(bearerEnvName)}`,
      "user-agent": "apex-tool-gateway/0.1"
    },
    signal: AbortSignal.timeout(10_000)
  });

  const contentType = response.headers.get("content-type") ?? null;
  const bodyText = await response.text();
  let parsedJson: Record<string, unknown> | null = null;
  try {
    parsedJson = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new Error("crm_contact_lookup expected a JSON response.");
  }

  const mappedContact = {
    contact_id: typeof parsedJson.contact_id === "string" ? parsedJson.contact_id : null,
    email: typeof parsedJson.email === "string" ? parsedJson.email : email || null,
    full_name: typeof parsedJson.full_name === "string" ? parsedJson.full_name : null,
    company: typeof parsedJson.company === "string" ? parsedJson.company : null,
    lifecycle_stage: typeof parsedJson.lifecycle_stage === "string" ? parsedJson.lifecycle_stage : null,
    last_activity_at: typeof parsedJson.last_activity_at === "string" ? parsedJson.last_activity_at : null,
    raw_status: response.status
  };

  addArtifact(
    taskId,
    `crm_contact_lookup_${(mappedContact.contact_id ?? mappedContact.email ?? "unknown_contact").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.json`,
    "generic",
    JSON.stringify(
      {
        url: url.toString(),
        status_code: response.status,
        content_type: contentType,
        contact: mappedContact,
        raw: parsedJson
      },
      null,
      2
    ),
    response.ok ? "ready" : "partial"
  );

  return {
    task_id: taskId,
    tool_name: "crm_contact_lookup",
    message: `Looked up CRM contact ${mappedContact.email ?? mappedContact.contact_id ?? "unknown"} via allowlisted connector.`,
    reconciliation_mode: "artifact" as const,
    idempotent_reuse: false,
    status_code: response.status,
    content_type: contentType,
    pagination: {
      strategy: "cursor",
      cursor_requested: cursor || null,
      page_size_requested: pageSize ?? null,
      next_cursor: typeof parsedJson.next_cursor === "string" ? parsedJson.next_cursor : null
    },
    contact: mappedContact,
    raw: parsedJson
  };
}

async function executeHrCandidateLookup(taskId: string, normalizedInput: Record<string, unknown>): Promise<ConnectorExecutionResult> {
  const rawUrl = typeof normalizedInput.url === "string" ? normalizedInput.url : "";
  const email = typeof normalizedInput.email === "string" ? normalizedInput.email.trim().toLowerCase() : "";
  const candidateId = typeof normalizedInput.candidate_id === "string" ? normalizedInput.candidate_id.trim() : "";
  if (!rawUrl) {
    throw new Error("hr_candidate_lookup requires input.url.");
  }
  if (!email && !candidateId) {
    throw new Error("hr_candidate_lookup requires input.email or input.candidate_id.");
  }

  const url = assertAllowedHttpTarget(rawUrl);
  if (email) {
    url.searchParams.set("email", email);
  }
  if (candidateId) {
    url.searchParams.set("candidate_id", candidateId);
  }
  const pageSize = typeof normalizedInput.page_size === "number" ? normalizedInput.page_size : undefined;
  const cursor = typeof normalizedInput.cursor === "string" ? normalizedInput.cursor.trim() : "";
  if (pageSize) {
    url.searchParams.set("page_size", String(pageSize));
  }
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  const bearerEnvName = typeof normalizedInput.auth_env === "string" && normalizedInput.auth_env.trim().length > 0
    ? normalizedInput.auth_env.trim()
    : "APEX_HR_BEARER_TOKEN";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${getBearerTokenFromEnv(bearerEnvName)}`,
      "user-agent": "apex-tool-gateway/0.1"
    },
    signal: AbortSignal.timeout(10_000)
  });

  const contentType = response.headers.get("content-type") ?? null;
  const bodyText = await response.text();
  let parsedJson: Record<string, unknown> | null = null;
  try {
    parsedJson = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new Error("hr_candidate_lookup expected a JSON response.");
  }

  const mappedCandidate = {
    candidate_id: typeof parsedJson.candidate_id === "string" ? parsedJson.candidate_id : null,
    email: typeof parsedJson.email === "string" ? parsedJson.email : email || null,
    full_name: typeof parsedJson.full_name === "string" ? parsedJson.full_name : null,
    current_stage: typeof parsedJson.current_stage === "string" ? parsedJson.current_stage : null,
    job_title: typeof parsedJson.job_title === "string" ? parsedJson.job_title : null,
    location: typeof parsedJson.location === "string" ? parsedJson.location : null,
    updated_at: typeof parsedJson.updated_at === "string" ? parsedJson.updated_at : null,
    raw_status: response.status
  };

  addArtifact(
    taskId,
    `hr_candidate_lookup_${(mappedCandidate.candidate_id ?? mappedCandidate.email ?? "unknown_candidate").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.json`,
    "generic",
    JSON.stringify(
      {
        url: url.toString(),
        status_code: response.status,
        content_type: contentType,
        candidate: mappedCandidate,
        raw: parsedJson
      },
      null,
      2
    ),
    response.ok ? "ready" : "partial"
  );

  return {
    task_id: taskId,
    tool_name: "hr_candidate_lookup",
    message: `Looked up HR candidate ${mappedCandidate.email ?? mappedCandidate.candidate_id ?? "unknown"} via allowlisted connector.`,
    reconciliation_mode: "artifact" as const,
    idempotent_reuse: false,
    status_code: response.status,
    content_type: contentType,
    pagination: {
      strategy: "cursor",
      cursor_requested: cursor || null,
      page_size_requested: pageSize ?? null,
      next_cursor: typeof parsedJson.next_cursor === "string" ? parsedJson.next_cursor : null
    },
    candidate: mappedCandidate,
    raw: parsedJson
  };
}

async function executeFinanceReconcile(taskId: string, normalizedInput: Record<string, unknown>): Promise<ConnectorExecutionResult> {
  const rawUrl = typeof normalizedInput.url === "string" ? normalizedInput.url : "";
  const batchId = typeof normalizedInput.batch_id === "string" ? normalizedInput.batch_id.trim() : "";
  const reportDate = typeof normalizedInput.report_date === "string" ? normalizedInput.report_date.trim() : "";
  if (!rawUrl) {
    throw new Error("finance_reconcile requires input.url.");
  }
  if (!batchId && !reportDate) {
    throw new Error("finance_reconcile requires input.batch_id or input.report_date.");
  }

  const url = assertAllowedHttpTarget(rawUrl);
  if (batchId) {
    url.searchParams.set("batch_id", batchId);
  }
  if (reportDate) {
    url.searchParams.set("report_date", reportDate);
  }

  const bearerEnvName = typeof normalizedInput.auth_env === "string" && normalizedInput.auth_env.trim().length > 0
    ? normalizedInput.auth_env.trim()
    : "APEX_FINANCE_BEARER_TOKEN";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${getBearerTokenFromEnv(bearerEnvName)}`,
      "user-agent": "apex-tool-gateway/0.1"
    },
    signal: AbortSignal.timeout(10_000)
  });

  const contentType = response.headers.get("content-type") ?? null;
  const bodyText = await response.text();
  let parsedJson: Record<string, unknown> | null = null;
  try {
    parsedJson = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new Error("finance_reconcile expected a JSON response.");
  }

  const reconciliation = {
    batch_id: typeof parsedJson.batch_id === "string" ? parsedJson.batch_id : batchId || null,
    report_date: typeof parsedJson.report_date === "string" ? parsedJson.report_date : reportDate || null,
    status: typeof parsedJson.status === "string" ? parsedJson.status : "unknown",
    currency: typeof parsedJson.currency === "string" ? parsedJson.currency : null,
    total_amount: typeof parsedJson.total_amount === "number" ? parsedJson.total_amount : null,
    discrepancy_count: typeof parsedJson.discrepancy_count === "number" ? parsedJson.discrepancy_count : 0,
    unresolved_items: Array.isArray(parsedJson.unresolved_items)
      ? parsedJson.unresolved_items.filter((item): item is string => typeof item === "string").slice(0, 10)
      : [],
    raw_status: response.status
  };

  addArtifact(
    taskId,
    `finance_reconcile_${(reconciliation.batch_id ?? reconciliation.report_date ?? "unknown_batch").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.json`,
    "generic",
    JSON.stringify(
      {
        url: url.toString(),
        status_code: response.status,
        content_type: contentType,
        reconciliation,
        raw: parsedJson
      },
      null,
      2
    ),
    response.ok ? "ready" : "partial"
  );

  return {
    task_id: taskId,
    tool_name: "finance_reconcile",
    message: `Reconciled finance batch ${reconciliation.batch_id ?? reconciliation.report_date ?? "unknown"} with status ${reconciliation.status}.`,
    reconciliation_mode: "external_state" as const,
    idempotent_reuse: false,
    status_code: response.status,
    content_type: contentType,
    reconciliation: reconciliation,
    raw: parsedJson
  };
}

const connectorSpecs: RuntimeConnectorSpec[] = [
  {
    name: "browser_research",
    category: "research",
    risk: "medium",
    compensation_available: false,
    reconciliation_mode: "artifact",
    connector_type: "simulated",
    auth_strategy: "none",
    pagination_strategy: "none",
    required_inputs: []
  },
  {
    name: "code_executor",
    category: "engineering",
    risk: "high",
    compensation_available: false,
    reconciliation_mode: "artifact",
    connector_type: "simulated",
    auth_strategy: "none",
    pagination_strategy: "none",
    required_inputs: []
  },
  {
    name: "crm_sync",
    category: "sales",
    risk: "medium",
    compensation_available: true,
    reconciliation_mode: "external_state",
    connector_type: "simulated",
    auth_strategy: "none",
    pagination_strategy: "none",
    required_inputs: []
  },
  {
    name: "crm_contact_lookup",
    category: "sales",
    risk: "medium",
    compensation_available: false,
    reconciliation_mode: "artifact",
    connector_type: "crm_contact_lookup",
    auth_strategy: "bearer_env",
    pagination_strategy: "cursor",
    required_inputs: ["url", "email|contact_id"],
    execute: async ({ task_id, input }) => executeCrmContactLookup(task_id, input)
  },
  {
    name: "hr_checker",
    category: "hr",
    risk: "medium",
    compensation_available: true,
    reconciliation_mode: "external_state",
    connector_type: "simulated",
    auth_strategy: "none",
    pagination_strategy: "none",
    required_inputs: []
  },
  {
    name: "hr_candidate_lookup",
    category: "hr",
    risk: "medium",
    compensation_available: false,
    reconciliation_mode: "artifact",
    connector_type: "hr_candidate_lookup",
    auth_strategy: "bearer_env",
    pagination_strategy: "cursor",
    required_inputs: ["url", "email|candidate_id"],
    execute: async ({ task_id, input }) => executeHrCandidateLookup(task_id, input)
  },
  {
    name: "finance_reconcile",
    category: "finance",
    risk: "high",
    compensation_available: false,
    reconciliation_mode: "external_state",
    connector_type: "finance_reconcile",
    auth_strategy: "bearer_env",
    pagination_strategy: "none",
    required_inputs: ["url", "batch_id|report_date"],
    execute: async ({ task_id, input }) => executeFinanceReconcile(task_id, input)
  },
  {
    name: "http_json_fetch",
    category: "integration",
    risk: "medium",
    compensation_available: false,
    reconciliation_mode: "artifact",
    connector_type: "http_json_fetch",
    auth_strategy: "none",
    pagination_strategy: "none",
    required_inputs: ["url"],
    execute: async ({ task_id, input }) => executeHttpJsonFetch(task_id, input)
  }
];

const toolCatalog = connectorSpecs.map(spec => ({
  name: spec.name,
  category: spec.category,
  risk: spec.risk,
  compensation_available: spec.compensation_available,
  reconciliation_mode: spec.reconciliation_mode,
  connector_type: spec.connector_type ?? "simulated",
  auth_strategy: spec.auth_strategy ?? "none",
  pagination_strategy: spec.pagination_strategy ?? "none",
  required_inputs: spec.required_inputs ?? []
}));

app.get("/internal/tools", async () => {
  return { tools: toolCatalog };
});

app.post("/internal/tools/:toolName/invoke", async (request, reply) => {
  const toolName = (request.params as { toolName: string }).toolName;
  const { task_id, task_contract, input, idempotency_key } = request.body as {
    task_id: string;
    task_contract?: unknown;
    input?: Record<string, unknown>;
    idempotency_key?: string;
  };
  try {
    if (task_contract) {
      mirrorTaskContract(TaskContractSchema.parse(task_contract));
    }
    const task = requireTask(task_id);
    const toolSpec = connectorSpecs.find(item => item.name === toolName);
    if (!toolSpec) {
      return reply.code(404).send({ message: `Tool ${toolName} not found` });
    }

    const normalizedInput = input ?? {};
    const finalIdempotencyKey = idempotency_key ?? buildIdempotencyKey(toolName, task_id, normalizedInput);
    const priorInvocation = listTaskToolInvocations(task_id).find(invocation =>
      invocation.tool_name === toolName &&
      invocation.status === "succeeded" &&
      invocation.idempotency_key === finalIdempotencyKey
    );

    if (priorInvocation) {
      const reusedOutput: Record<string, unknown> = {
        ...(priorInvocation.output as Record<string, unknown>),
        reused_from_invocation_id: priorInvocation.invocation_id,
        idempotent_reuse: true
      };
      return {
        task_id,
        tool_name: toolName,
        idempotency_key: finalIdempotencyKey,
        compensation_available: toolSpec.compensation_available,
        reconciliation_mode: toolSpec.reconciliation_mode,
        reconciliation_state: typeof reusedOutput.reconciliation_state === "string" ? reusedOutput.reconciliation_state : undefined,
        reused: true,
        output: reusedOutput
      };
    }

    sendHeartbeat(task_id, toolName);
    const shouldFail = normalizedInput.simulate_failure === true;
    const output = toolSpec.execute
      ? await toolSpec.execute({ task_id, input: normalizedInput })
      : {
          task_id,
          tool_name: toolName,
          message: `Simulated ${toolName} execution for ${task.department}.`,
          reconciliation_mode: toolSpec.reconciliation_mode,
          idempotent_reuse: false
        };
    if (toolSpec.reconciliation_mode === "external_state") {
      externalState.set(
        externalStateKey(task_id, toolName, finalIdempotencyKey),
        {
          task_id,
          tool_name: toolName,
          idempotency_key: finalIdempotencyKey,
          state: shouldFail ? "failed" : "applied",
          message: output.message,
          updated_at: new Date().toISOString()
        }
      );
    }

    const reconciliationState = toolSpec.reconciliation_mode === "external_state"
      ? externalState.get(externalStateKey(task_id, toolName, finalIdempotencyKey))?.state ?? "pending"
      : "artifact_ready";

    recordToolInvocation(
      task_id,
      toolName,
      normalizedInput,
      {
        ...output,
        reconciliation_state: reconciliationState
      },
      shouldFail ? "failed" : "succeeded",
      {
        idempotency_key: finalIdempotencyKey,
        compensation_available: toolSpec.compensation_available,
        compensation_status: toolSpec.compensation_available ? "available" : "not_required"
      }
    );
    addArtifact(task_id, `${toolName}_result.md`, "generic", output.message, "ready");
    if (shouldFail) {
      return reply.code(502).send({
        task_id,
        tool_name: toolName,
        idempotency_key: finalIdempotencyKey,
        compensation_available: toolSpec.compensation_available,
        reconciliation_mode: toolSpec.reconciliation_mode,
        reconciliation_state: reconciliationState,
        message: `Simulated ${toolName} failure for resilience testing.`
      });
    }
    return {
      ...output,
      idempotency_key: finalIdempotencyKey,
      compensation_available: toolSpec.compensation_available,
      reconciliation_mode: toolSpec.reconciliation_mode,
      reconciliation_state: reconciliationState,
      reconciliation_expected: toolSpec.reconciliation_mode
    };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/internal/tools/reconcile/:taskId/:toolName", async (request, reply) => {
  const { taskId, toolName } = request.params as { taskId: string; toolName: string };
  const { idempotency_key } = request.query as { idempotency_key?: string };
  try {
    requireTask(taskId);
    const toolSpec = connectorSpecs.find(item => item.name === toolName);
    if (!toolSpec) {
      return reply.code(404).send({ message: `Tool ${toolName} not found` });
    }
    if (!idempotency_key) {
      return reply.code(400).send({ message: "idempotency_key is required" });
    }
    if (toolSpec.reconciliation_mode === "artifact") {
      return {
        task_id: taskId,
        tool_name: toolName,
        idempotency_key,
        state: "artifact_ready"
      };
    }
    const state = externalState.get(externalStateKey(taskId, toolName, idempotency_key));
    if (!state) {
      return reply.code(404).send({ message: "External reconciliation state not found" });
    }
    return state;
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/internal/tools/invocations/:taskId", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    requireTask(taskId);
    return { task_id: taskId, invocations: listTaskToolInvocations(taskId) };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "tool-gateway-service started", { host: env.HOST, port: env.PORT });
});
