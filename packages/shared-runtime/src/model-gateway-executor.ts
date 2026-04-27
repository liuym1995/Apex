import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  type ModelRoute,
  type ModelProvider,
  type PrivacyLevel,
  type ModelRequest
} from "@apex/shared-types";
import { recordAudit } from "./core.js";
import { resolveModelRoute, recordModelRequest } from "./index.js";

export interface LLMCallOptions {
  model_alias: string;
  privacy_level: PrivacyLevel;
  task_id?: string;
  messages: LLMMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: "json_object" | "text" };
  structured_output_schema?: Record<string, unknown>;
  max_retries?: number;
  retry_base_delay_ms?: number;
  timeout_ms?: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface LLMCallResult {
  request_id: string;
  route_id: string;
  model_alias: string;
  provider: ModelProvider;
  model_id: string;
  content: string;
  structured_output: Record<string, unknown> | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: "success" | "error" | "rate_limited" | "fallback";
  retry_count: number;
  error_message?: string;
  validation_passed: boolean;
  validation_errors: string[];
}

export interface ProviderQuota {
  provider: ModelProvider;
  max_requests_per_minute: number;
  max_tokens_per_minute: number;
  max_cost_per_day_usd: number;
  current_requests_this_minute: number;
  current_tokens_this_minute: number;
  current_cost_today_usd: number;
  minute_window_start: number;
  day_window_start: number;
}

export interface StructuredOutputValidationResult {
  valid: boolean;
  errors: string[];
  coerced_output: Record<string, unknown> | null;
}

const providerQuotas = new Map<ModelProvider, ProviderQuota>();
const DEFAULT_QUOTAS: Record<ModelProvider, { rpm: number; tpm: number; daily_cost: number }> = {
  openai: { rpm: 60, tpm: 150000, daily_cost: 50 },
  anthropic: { rpm: 50, tpm: 100000, daily_cost: 40 },
  google: { rpm: 60, tpm: 120000, daily_cost: 30 },
  local: { rpm: 1000, tpm: 1000000, daily_cost: 0 },
  custom: { rpm: 30, tpm: 50000, daily_cost: 20 }
};

const COST_PER_TOKEN: Record<ModelProvider, { input: number; output: number }> = {
  openai: { input: 0.00003, output: 0.00006 },
  anthropic: { input: 0.000025, output: 0.00005 },
  google: { input: 0.00002, output: 0.00004 },
  local: { input: 0, output: 0 },
  custom: { input: 0.00002, output: 0.00004 }
};

function getOrCreateQuota(provider: ModelProvider): ProviderQuota {
  let quota = providerQuotas.get(provider);
  if (!quota) {
    const defaults = DEFAULT_QUOTAS[provider];
    const now = Date.now();
    quota = {
      provider,
      max_requests_per_minute: defaults.rpm,
      max_tokens_per_minute: defaults.tpm,
      max_cost_per_day_usd: defaults.daily_cost,
      current_requests_this_minute: 0,
      current_tokens_this_minute: 0,
      current_cost_today_usd: 0,
      minute_window_start: now,
      day_window_start: now
    };
    providerQuotas.set(provider, quota);
  }
  return quota;
}

function resetQuotaWindows(quota: ProviderQuota): void {
  const now = Date.now();
  if (now - quota.minute_window_start >= 60000) {
    quota.current_requests_this_minute = 0;
    quota.current_tokens_this_minute = 0;
    quota.minute_window_start = now;
  }
  if (now - quota.day_window_start >= 86400000) {
    quota.current_cost_today_usd = 0;
    quota.day_window_start = now;
  }
}

function checkQuota(provider: ModelProvider, estimatedTokens: number): { allowed: boolean; reason?: string } {
  const quota = getOrCreateQuota(provider);
  resetQuotaWindows(quota);

  if (quota.current_requests_this_minute >= quota.max_requests_per_minute) {
    return { allowed: false, reason: `Rate limit: ${quota.current_requests_this_minute}/${quota.max_requests_per_minute} requests per minute` };
  }
  if (quota.current_tokens_this_minute + estimatedTokens > quota.max_tokens_per_minute) {
    return { allowed: false, reason: `Token limit: ${quota.current_tokens_this_minute + estimatedTokens}/${quota.max_tokens_per_minute} tokens per minute` };
  }
  return { allowed: true };
}

function recordQuotaUsage(provider: ModelProvider, tokens: number, costUsd: number): void {
  const quota = getOrCreateQuota(provider);
  quota.current_requests_this_minute += 1;
  quota.current_tokens_this_minute += tokens;
  quota.current_cost_today_usd += costUsd;
}

function estimateTokens(messages: LLMMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += msg.content.length;
  }
  return Math.ceil(totalChars / 4);
}

function calculateCost(provider: ModelProvider, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_TOKEN[provider] ?? COST_PER_TOKEN.custom;
  return inputTokens * rates.input + outputTokens * rates.output;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Model provider requires environment variable '${name}' before external inference can run.`);
  }
  return value;
}

function normalizeProviderBaseUrl(value: string, envName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${envName}: expected an absolute HTTP(S) URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid ${envName}: only HTTP(S) model provider URLs are allowed.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function buildProviderRequest(route: ModelRoute, options: LLMCallOptions): {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
} {
  const provider = route.provider;

  if (provider === "openai") {
    const baseUrl = normalizeProviderBaseUrl(process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1", "OPENAI_BASE_URL");
    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getRequiredEnv("OPENAI_API_KEY")}`
      },
      body: {
        model: route.model_id,
        messages: options.messages,
        max_tokens: options.max_tokens ?? route.max_tokens,
        temperature: options.temperature ?? route.temperature,
        ...(options.response_format ? { response_format: options.response_format } : {})
      }
    };
  }

  if (provider === "custom") {
    const baseUrl = normalizeProviderBaseUrl(getRequiredEnv("CUSTOM_BASE_URL"), "CUSTOM_BASE_URL");
    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getRequiredEnv("CUSTOM_API_KEY")}`
      },
      body: {
        model: route.model_id,
        messages: options.messages,
        max_tokens: options.max_tokens ?? route.max_tokens,
        temperature: options.temperature ?? route.temperature,
        ...(options.response_format ? { response_format: options.response_format } : {})
      }
    };
  }

  if (provider === "anthropic") {
    const baseUrl = normalizeProviderBaseUrl(process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1", "ANTHROPIC_BASE_URL");
    return {
      url: `${baseUrl}/messages`,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getRequiredEnv("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01"
      },
      body: {
        model: route.model_id,
        max_tokens: options.max_tokens ?? route.max_tokens ?? 4096,
        messages: options.messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })),
        ...(options.messages.find(m => m.role === "system") ? { system: options.messages.find(m => m.role === "system")!.content } : {}),
        temperature: options.temperature ?? route.temperature
      }
    };
  }

  if (provider === "google") {
    const baseUrl = normalizeProviderBaseUrl(process.env.GOOGLE_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta", "GOOGLE_BASE_URL");
    const apiKey = getRequiredEnv("GOOGLE_API_KEY");
    return {
      url: `${baseUrl}/models/${route.model_id}:generateContent?key=${apiKey}`,
      headers: { "Content-Type": "application/json" },
      body: {
        contents: options.messages.filter(m => m.role !== "system").map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          maxOutputTokens: options.max_tokens ?? route.max_tokens,
          temperature: options.temperature ?? route.temperature
        },
        ...(options.messages.find(m => m.role === "system") ? { systemInstruction: { parts: [{ text: options.messages.find(m => m.role === "system")!.content }] } } : {})
      }
    };
  }

  if (provider === "local") {
    const baseUrl = normalizeProviderBaseUrl(process.env.LOCAL_LLM_BASE_URL ?? "http://localhost:11434", "LOCAL_LLM_BASE_URL");
    return {
      url: `${baseUrl}/api/chat`,
      headers: { "Content-Type": "application/json" },
      body: {
        model: route.model_id,
        messages: options.messages,
        stream: false,
        options: {
          num_predict: options.max_tokens ?? route.max_tokens,
          temperature: options.temperature ?? route.temperature
        }
      }
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function parseProviderResponse(provider: ModelProvider, responseBody: Record<string, unknown>): {
  content: string;
  input_tokens: number;
  output_tokens: number;
} {
  if (provider === "openai" || provider === "custom") {
    const choices = responseBody.choices as Array<{ message: { content: string } }> | undefined;
    const usage = responseBody.usage as { prompt_tokens: number; completion_tokens: number } | undefined;
    return {
      content: choices?.[0]?.message?.content ?? "",
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0
    };
  }

  if (provider === "anthropic") {
    const content = responseBody.content as Array<{ type: string; text: string }> | undefined;
    const usage = responseBody.usage as { input_tokens: number; output_tokens: number } | undefined;
    return {
      content: content?.filter(c => c.type === "text").map(c => c.text).join("") ?? "",
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0
    };
  }

  if (provider === "google") {
    const candidates = responseBody.candidates as Array<{ content: { parts: Array<{ text: string }> } }> | undefined;
    const usage = responseBody.usageMetadata as { promptTokenCount: number; candidatesTokenCount: number } | undefined;
    return {
      content: candidates?.[0]?.content?.parts?.map(p => p.text).join("") ?? "",
      input_tokens: usage?.promptTokenCount ?? 0,
      output_tokens: usage?.candidatesTokenCount ?? 0
    };
  }

  if (provider === "local") {
    const message = responseBody.message as { content: string } | undefined;
    return {
      content: message?.content ?? (responseBody.content as string) ?? "",
      input_tokens: (responseBody.prompt_eval_count as number) ?? 0,
      output_tokens: (responseBody.eval_count as number) ?? 0
    };
  }

  return { content: JSON.stringify(responseBody), input_tokens: 0, output_tokens: 0 };
}

export function validateStructuredOutput(
  content: string,
  schema: Record<string, unknown>
): StructuredOutputValidationResult {
  const errors: string[] = [];
  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      valid: false,
      errors: ["Response is not valid JSON"],
      coerced_output: null
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ["Response is not a JSON object"],
      coerced_output: null
    };
  }

  const requiredFields = schema.required as string[] | undefined;
  if (requiredFields) {
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (properties) {
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in parsed) {
        const value = parsed[key];
        const expectedType = propSchema.type as string | undefined;

        if (expectedType) {
          const actualType = Array.isArray(value) ? "array" : typeof value;
          if (actualType !== expectedType && !(expectedType === "number" && typeof value === "number")) {
            if (expectedType === "integer" && typeof value === "number" && Number.isInteger(value)) {
              // ok
            } else if (expectedType === "integer" && typeof value === "number") {
              parsed[key] = Math.round(value as number);
            } else {
              errors.push(`Field '${key}' expected type '${expectedType}', got '${actualType}'`);
            }
          }
        }

        if (propSchema.enum && Array.isArray(propSchema.enum)) {
          if (!propSchema.enum.includes(value)) {
            errors.push(`Field '${key}' value '${value}' not in enum: ${propSchema.enum.join(", ")}`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    coerced_output: parsed
  };
}

async function executeHTTPRequest(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutHandle);

    const responseText = await response.text();
    let responseBody: Record<string, unknown>;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = { raw: responseText };
    }

    return { status: response.status, body: responseBody };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function callLLM(options: LLMCallOptions): Promise<LLMCallResult> {
  const route = resolveModelRoute(options.model_alias, options.privacy_level);
  if (!route) {
    const errorResult: LLMCallResult = {
      request_id: createEntityId("mrq"),
      route_id: "",
      model_alias: options.model_alias,
      provider: "custom",
      model_id: "",
      content: "",
      structured_output: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "error",
      retry_count: 0,
      error_message: `No active route found for model alias '${options.model_alias}' at privacy level '${options.privacy_level}'`,
      validation_passed: false,
      validation_errors: []
    };
    recordModelRequest({
      route_id: "",
      task_id: options.task_id,
      model_alias: options.model_alias,
      provider: "custom",
      model_id: "",
      privacy_level: options.privacy_level,
      status: "error",
      error_message: errorResult.error_message
    });
    return errorResult;
  }

  const maxRetries = options.max_retries ?? 3;
  const retryBaseDelay = options.retry_base_delay_ms ?? 1000;
  const timeoutMs = options.timeout_ms ?? 60000;
  const estimatedTokens = estimateTokens(options.messages);

  const quotaCheck = checkQuota(route.provider, estimatedTokens);
  if (!quotaCheck.allowed) {
    const errorResult: LLMCallResult = {
      request_id: createEntityId("mrq"),
      route_id: route.route_id,
      model_alias: options.model_alias,
      provider: route.provider,
      model_id: route.model_id,
      content: "",
      structured_output: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "rate_limited",
      retry_count: 0,
      error_message: quotaCheck.reason,
      validation_passed: false,
      validation_errors: []
    };
    recordModelRequest({
      route_id: route.route_id,
      task_id: options.task_id,
      model_alias: options.model_alias,
      provider: route.provider,
      model_id: route.model_id,
      privacy_level: options.privacy_level,
      status: "rate_limited",
      error_message: quotaCheck.reason
    });
    return errorResult;
  }

  if (options.task_id) {
    try {
      const { getBudgetStatusForTask } = await import("./task-budget.js");
      const budgetStatus = getBudgetStatusForTask(options.task_id);
      if (budgetStatus && budgetStatus.budget_exhausted) {
        const budgetResult: LLMCallResult = {
          request_id: createEntityId("mrq"),
          route_id: route.route_id,
          model_alias: options.model_alias,
          provider: route.provider,
          model_id: route.model_id,
          content: "",
          structured_output: null,
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
          latency_ms: 0,
          status: "error",
          retry_count: 0,
          error_message: `Budget exhausted for task '${options.task_id}'. Hard limit: $${budgetStatus.hard_limit.toFixed(2)}, spent: $${budgetStatus.estimated_cost.toFixed(2)}`,
          validation_passed: false,
          validation_errors: []
        };
        recordModelRequest({
          route_id: route.route_id,
          task_id: options.task_id,
          model_alias: options.model_alias,
          provider: route.provider,
          model_id: route.model_id,
          privacy_level: options.privacy_level,
          status: "error",
          error_message: budgetResult.error_message
        });
        return budgetResult;
      }
    } catch {}
  }

  let lastError: string | undefined;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = retryBaseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
      retryCount = attempt;

      recordAudit("model_gateway.retry", {
        model_alias: options.model_alias,
        provider: route.provider,
        attempt,
        max_retries: maxRetries,
        delay_ms: delay
      });
    }

    const startTime = Date.now();

    try {
      const providerRequest = buildProviderRequest(route, options);
      const response = await executeHTTPRequest(
        providerRequest.url,
        providerRequest.headers,
        providerRequest.body,
        timeoutMs
      );

      const latencyMs = Date.now() - startTime;

      if (response.status === 429) {
        lastError = `Rate limited by provider (HTTP 429)`;
        recordModelRequest({
          route_id: route.route_id,
          task_id: options.task_id,
          model_alias: options.model_alias,
          provider: route.provider,
          model_id: route.model_id,
          privacy_level: options.privacy_level,
          latency_ms: latencyMs,
          status: "rate_limited",
          error_message: lastError,
          retry_count: attempt
        });
        continue;
      }

      if (response.status >= 500) {
        lastError = `Provider server error (HTTP ${response.status})`;
        recordModelRequest({
          route_id: route.route_id,
          task_id: options.task_id,
          model_alias: options.model_alias,
          provider: route.provider,
          model_id: route.model_id,
          privacy_level: options.privacy_level,
          latency_ms: latencyMs,
          status: "error",
          error_message: lastError,
          retry_count: attempt
        });
        continue;
      }

      if (response.status >= 400) {
        lastError = `Provider client error (HTTP ${response.status})`;
        const parsed = parseProviderResponse(route.provider, response.body);
        recordModelRequest({
          route_id: route.route_id,
          task_id: options.task_id,
          model_alias: options.model_alias,
          provider: route.provider,
          model_id: route.model_id,
          privacy_level: options.privacy_level,
          input_tokens: parsed.input_tokens,
          output_tokens: parsed.output_tokens,
          cost_usd: calculateCost(route.provider, parsed.input_tokens, parsed.output_tokens),
          latency_ms: latencyMs,
          status: "error",
          error_message: lastError,
          retry_count: attempt
        });

        return {
          request_id: createEntityId("mrq"),
          route_id: route.route_id,
          model_alias: options.model_alias,
          provider: route.provider,
          model_id: route.model_id,
          content: parsed.content,
          structured_output: null,
          input_tokens: parsed.input_tokens,
          output_tokens: parsed.output_tokens,
          cost_usd: calculateCost(route.provider, parsed.input_tokens, parsed.output_tokens),
          latency_ms: latencyMs,
          status: "error",
          retry_count: attempt,
          error_message: lastError,
          validation_passed: false,
          validation_errors: []
        };
      }

      const parsed = parseProviderResponse(route.provider, response.body);
      const costUsd = calculateCost(route.provider, parsed.input_tokens, parsed.output_tokens);

      recordQuotaUsage(route.provider, parsed.input_tokens + parsed.output_tokens, costUsd);

      if (options.task_id) {
        try {
          const { trackModelSpend } = await import("./task-budget.js");
          trackModelSpend({
            task_id: options.task_id,
            provider: route.provider,
            model: route.model_id,
            input_tokens: parsed.input_tokens,
            output_tokens: parsed.output_tokens
          });
        } catch {}
      }

      recordModelRequest({
        route_id: route.route_id,
        task_id: options.task_id,
        model_alias: options.model_alias,
        provider: route.provider,
        model_id: route.model_id,
        privacy_level: options.privacy_level,
        input_tokens: parsed.input_tokens,
        output_tokens: parsed.output_tokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        status: "success",
        retry_count: attempt
      });

      let structuredOutput: Record<string, unknown> | null = null;
      let validationPassed = true;
      const validationErrors: string[] = [];

      if (options.structured_output_schema) {
        const validation = validateStructuredOutput(parsed.content, options.structured_output_schema);
        structuredOutput = validation.coerced_output;
        validationPassed = validation.valid;
        validationErrors.push(...validation.errors);
      } else if (options.response_format?.type === "json_object") {
        try {
          structuredOutput = JSON.parse(parsed.content);
        } catch {
          validationPassed = false;
          validationErrors.push("Response is not valid JSON despite json_object format request");
        }
      }

      recordAudit("model_gateway.call_success", {
        model_alias: options.model_alias,
        provider: route.provider,
        model_id: route.model_id,
        input_tokens: parsed.input_tokens,
        output_tokens: parsed.output_tokens,
        cost_usd: costUsd.toFixed(6),
        latency_ms: latencyMs,
        retry_count: attempt,
        validation_passed: validationPassed
      });

      return {
        request_id: createEntityId("mrq"),
        route_id: route.route_id,
        model_alias: options.model_alias,
        provider: route.provider,
        model_id: route.model_id,
        content: parsed.content,
        structured_output: structuredOutput,
        input_tokens: parsed.input_tokens,
        output_tokens: parsed.output_tokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        status: "success",
        retry_count: attempt,
        validation_passed: validationPassed,
        validation_errors: validationErrors
      };

    } catch (err) {
      const latencyMs = Date.now() - startTime;
      lastError = err instanceof Error ? err.message : String(err);

      recordModelRequest({
        route_id: route.route_id,
        task_id: options.task_id,
        model_alias: options.model_alias,
        provider: route.provider,
        model_id: route.model_id,
        privacy_level: options.privacy_level,
        latency_ms: latencyMs,
        status: "error",
        error_message: lastError,
        retry_count: attempt
      });
    }
  }

  if (route.fallback_route_id) {
    const fallbackRoute = store.modelRoutes.get(route.fallback_route_id);
    if (fallbackRoute && fallbackRoute.is_active) {
      recordAudit("model_gateway.fallback", {
        model_alias: options.model_alias,
        original_route_id: route.route_id,
        fallback_route_id: route.fallback_route_id,
        original_provider: route.provider,
        fallback_provider: fallbackRoute.provider
      });

      const fallbackOptions: LLMCallOptions = {
        ...options,
        max_retries: 1
      };

      const fallbackResult = await callLLMWithRoute(fallbackRoute, fallbackOptions);
      fallbackResult.status = "fallback";
      return fallbackResult;
    }
  }

  return {
    request_id: createEntityId("mrq"),
    route_id: route.route_id,
    model_alias: options.model_alias,
    provider: route.provider,
    model_id: route.model_id,
    content: "",
    structured_output: null,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    status: "error",
    retry_count: retryCount,
    error_message: lastError ?? "All retries exhausted",
    validation_passed: false,
    validation_errors: []
  };
}

async function callLLMWithRoute(route: ModelRoute, options: LLMCallOptions): Promise<LLMCallResult> {
  const timeoutMs = options.timeout_ms ?? 60000;
  const startTime = Date.now();

  try {
    const providerRequest = buildProviderRequest(route, options);
    const response = await executeHTTPRequest(
      providerRequest.url,
      providerRequest.headers,
      providerRequest.body,
      timeoutMs
    );

    const latencyMs = Date.now() - startTime;
    const parsed = parseProviderResponse(route.provider, response.body);
    const costUsd = calculateCost(route.provider, parsed.input_tokens, parsed.output_tokens);

    recordQuotaUsage(route.provider, parsed.input_tokens + parsed.output_tokens, costUsd);

    recordModelRequest({
      route_id: route.route_id,
      task_id: options.task_id,
      model_alias: options.model_alias,
      provider: route.provider,
      model_id: route.model_id,
      privacy_level: options.privacy_level,
      input_tokens: parsed.input_tokens,
      output_tokens: parsed.output_tokens,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      status: "success"
    });

    let structuredOutput: Record<string, unknown> | null = null;
    let validationPassed = true;
    const validationErrors: string[] = [];

    if (options.structured_output_schema) {
      const validation = validateStructuredOutput(parsed.content, options.structured_output_schema);
      structuredOutput = validation.coerced_output;
      validationPassed = validation.valid;
      validationErrors.push(...validation.errors);
    }

    return {
      request_id: createEntityId("mrq"),
      route_id: route.route_id,
      model_alias: options.model_alias,
      provider: route.provider,
      model_id: route.model_id,
      content: parsed.content,
      structured_output: structuredOutput,
      input_tokens: parsed.input_tokens,
      output_tokens: parsed.output_tokens,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      status: "success",
      retry_count: 0,
      validation_passed: validationPassed,
      validation_errors: validationErrors
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      request_id: createEntityId("mrq"),
      route_id: route.route_id,
      model_alias: options.model_alias,
      provider: route.provider,
      model_id: route.model_id,
      content: "",
      structured_output: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      status: "error",
      retry_count: 0,
      error_message: err instanceof Error ? err.message : String(err),
      validation_passed: false,
      validation_errors: []
    };
  }
}

export function setProviderQuota(provider: ModelProvider, limits: {
  max_requests_per_minute?: number;
  max_tokens_per_minute?: number;
  max_cost_per_day_usd?: number;
}): ProviderQuota {
  const quota = getOrCreateQuota(provider);
  if (limits.max_requests_per_minute !== undefined) quota.max_requests_per_minute = limits.max_requests_per_minute;
  if (limits.max_tokens_per_minute !== undefined) quota.max_tokens_per_minute = limits.max_tokens_per_minute;
  if (limits.max_cost_per_day_usd !== undefined) quota.max_cost_per_day_usd = limits.max_cost_per_day_usd;
  return quota;
}

export function getProviderQuota(provider: ModelProvider): ProviderQuota {
  return getOrCreateQuota(provider);
}

export function getAllProviderQuotas(): ProviderQuota[] {
  const providers: ModelProvider[] = ["openai", "anthropic", "google", "local", "custom"];
  return providers.map(p => getOrCreateQuota(p));
}
