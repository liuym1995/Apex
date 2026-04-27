import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export type BudgetMode = "inherit_default" | "task_specific";
export type OnLimitReached = "pause_and_ask" | "pause_and_require_new_limit";

export interface ModelPricingRegistryEntry {
  entry_id: string;
  provider: string;
  model: string;
  input_token_price_per_million: number;
  output_token_price_per_million: number;
  cache_input_token_price_per_million?: number;
  effective_date: string;
  source: string;
}

export interface TaskBudgetPolicy {
  policy_id: string;
  task_id?: string;
  budget_mode: BudgetMode;
  budget_currency: string;
  hard_limit_amount: number;
  warning_threshold_pct: number;
  on_limit_reached: OnLimitReached;
  user_override_policy?: string;
  created_at: string;
}

export interface TaskBudgetStatus {
  status_id: string;
  task_id: string;
  policy_id: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  estimated_cost: number;
  hard_limit: number;
  warning_threshold: number;
  budget_remaining: number;
  budget_exhausted: boolean;
  last_updated_at: string;
}

export interface BudgetInterruptionEvent {
  event_id: string;
  task_id: string;
  policy_id: string;
  interruption_kind: "warning" | "hard_stop";
  spend_at_interruption: number;
  limit_at_interruption: number;
  user_decision: "continue_with_new_limit" | "one_time_extension" | "stop_task" | "pending";
  new_limit?: number;
  extension_amount?: number;
  interrupted_at: string;
  resolved_at?: string;
}

const pricingRegistry = new Map<string, ModelPricingRegistryEntry>();
const budgetPolicies = new Map<string, TaskBudgetPolicy>();
const budgetStatuses = new Map<string, TaskBudgetStatus>();
const interruptionEvents = new Map<string, BudgetInterruptionEvent>();

const DEFAULT_PRICING: Array<Omit<ModelPricingRegistryEntry, "entry_id">> = [
  { provider: "openai", model: "gpt-4o", input_token_price_per_million: 2.5, output_token_price_per_million: 10, cache_input_token_price_per_million: 1.25, effective_date: "2025-01-01", source: "openai_pricing_page" },
  { provider: "openai", model: "gpt-4o-mini", input_token_price_per_million: 0.15, output_token_price_per_million: 0.6, cache_input_token_price_per_million: 0.075, effective_date: "2025-01-01", source: "openai_pricing_page" },
  { provider: "anthropic", model: "claude-sonnet-4-20250514", input_token_price_per_million: 3, output_token_price_per_million: 15, cache_input_token_price_per_million: 1.5, effective_date: "2025-01-01", source: "anthropic_pricing_page" },
  { provider: "anthropic", model: "claude-haiku-4-20250506", input_token_price_per_million: 0.8, output_token_price_per_million: 4, cache_input_token_price_per_million: 0.4, effective_date: "2025-01-01", source: "anthropic_pricing_page" },
  { provider: "local", model: "local-default", input_token_price_per_million: 0, output_token_price_per_million: 0, effective_date: "2025-01-01", source: "local_runtime" }
];

const DEFAULT_BUDGET_POLICY: Omit<TaskBudgetPolicy, "policy_id" | "created_at"> = {
  budget_mode: "inherit_default",
  budget_currency: "USD",
  hard_limit_amount: 5.0,
  warning_threshold_pct: 80,
  on_limit_reached: "pause_and_ask"
};

export function registerModelPricing(input: Omit<ModelPricingRegistryEntry, "entry_id">): ModelPricingRegistryEntry {
  const entry: ModelPricingRegistryEntry = { ...input, entry_id: createEntityId("mpre") };
  pricingRegistry.set(entry.entry_id, entry);
  recordAudit("budget.pricing_registered", { provider: input.provider, model: input.model, input_price: input.input_token_price_per_million, output_price: input.output_token_price_per_million });
  return entry;
}

export function initializeDefaultPricingRegistry(): ModelPricingRegistryEntry[] {
  return DEFAULT_PRICING.map(p => registerModelPricing(p));
}

export function lookupModelPricing(provider: string, model: string): ModelPricingRegistryEntry | undefined {
  return [...pricingRegistry.values()].find(p => p.provider === provider && p.model === model);
}

export function listModelPricing(): ModelPricingRegistryEntry[] {
  return [...pricingRegistry.values()];
}

export function createBudgetPolicy(input: { task_id?: string } & Partial<Omit<TaskBudgetPolicy, "policy_id" | "created_at" | "task_id">>): TaskBudgetPolicy {
  const policy: TaskBudgetPolicy = {
    policy_id: createEntityId("tbp"),
    task_id: input.task_id,
    budget_mode: input.budget_mode ?? DEFAULT_BUDGET_POLICY.budget_mode,
    budget_currency: input.budget_currency ?? DEFAULT_BUDGET_POLICY.budget_currency,
    hard_limit_amount: input.hard_limit_amount ?? DEFAULT_BUDGET_POLICY.hard_limit_amount,
    warning_threshold_pct: input.warning_threshold_pct ?? DEFAULT_BUDGET_POLICY.warning_threshold_pct,
    on_limit_reached: input.on_limit_reached ?? DEFAULT_BUDGET_POLICY.on_limit_reached,
    user_override_policy: input.user_override_policy,
    created_at: nowIso()
  };
  budgetPolicies.set(policy.policy_id, policy);
  recordAudit("budget.policy_created", { policy_id: policy.policy_id, task_id: input.task_id, hard_limit: policy.hard_limit_amount });
  return policy;
}

export function getBudgetPolicy(policyId: string): TaskBudgetPolicy | undefined {
  return budgetPolicies.get(policyId);
}

export function getBudgetPolicyForTask(taskId: string): TaskBudgetPolicy | undefined {
  const taskSpecific = [...budgetPolicies.values()].find(p => p.task_id === taskId);
  if (taskSpecific) return taskSpecific;
  const defaultPolicy = [...budgetPolicies.values()].find(p => !p.task_id);
  return defaultPolicy ?? createBudgetPolicy({});
}

export function initializeBudgetStatus(taskId: string, policyId: string): TaskBudgetStatus {
  const policy = budgetPolicies.get(policyId);
  const hardLimit = policy?.hard_limit_amount ?? DEFAULT_BUDGET_POLICY.hard_limit_amount;
  const warningThreshold = hardLimit * (policy?.warning_threshold_pct ?? DEFAULT_BUDGET_POLICY.warning_threshold_pct) / 100;

  const status: TaskBudgetStatus = {
    status_id: createEntityId("tbs"),
    task_id: taskId,
    policy_id: policyId,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cached_tokens: 0,
    estimated_cost: 0,
    hard_limit: hardLimit,
    warning_threshold: warningThreshold,
    budget_remaining: hardLimit,
    budget_exhausted: false,
    last_updated_at: nowIso()
  };
  budgetStatuses.set(status.status_id, status);
  recordAudit("budget.status_initialized", { status_id: status.status_id, task_id: taskId, hard_limit: hardLimit });
  return status;
}

export function trackModelSpend(input: {
  task_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens?: number;
}): TaskBudgetStatus | BudgetInterruptionEvent {
  const status = [...budgetStatuses.values()].find(s => s.task_id === input.task_id);
  if (!status) {
    const policy = getBudgetPolicyForTask(input.task_id);
    initializeBudgetStatus(input.task_id, policy?.policy_id ?? createEntityId("tbp"));
  }

  const currentStatus = [...budgetStatuses.values()].find(s => s.task_id === input.task_id);
  if (!currentStatus) throw new Error("Budget status not found after initialization");

  const pricing = lookupModelPricing(input.provider, input.model);
  const inputCost = (input.input_tokens / 1_000_000) * (pricing?.input_token_price_per_million ?? 0);
  const outputCost = (input.output_tokens / 1_000_000) * (pricing?.output_token_price_per_million ?? 0);
  const cacheCost = ((input.cached_tokens ?? 0) / 1_000_000) * (pricing?.cache_input_token_price_per_million ?? 0);
  const incrementalCost = inputCost + outputCost + cacheCost;

  currentStatus.total_input_tokens += input.input_tokens;
  currentStatus.total_output_tokens += input.output_tokens;
  currentStatus.total_cached_tokens += input.cached_tokens ?? 0;
  currentStatus.estimated_cost = Number((currentStatus.estimated_cost + incrementalCost).toFixed(6));
  currentStatus.budget_remaining = Number((currentStatus.hard_limit - currentStatus.estimated_cost).toFixed(6));
  currentStatus.budget_exhausted = currentStatus.estimated_cost >= currentStatus.hard_limit;
  currentStatus.last_updated_at = nowIso();

  budgetStatuses.set(currentStatus.status_id, currentStatus);

  const policy = budgetPolicies.get(currentStatus.policy_id);

  if (currentStatus.estimated_cost >= currentStatus.hard_limit) {
    const event: BudgetInterruptionEvent = {
      event_id: createEntityId("bie"),
      task_id: input.task_id,
      policy_id: currentStatus.policy_id,
      interruption_kind: "hard_stop",
      spend_at_interruption: currentStatus.estimated_cost,
      limit_at_interruption: currentStatus.hard_limit,
      user_decision: "pending",
      interrupted_at: nowIso()
    };
    interruptionEvents.set(event.event_id, event);
    recordAudit("budget.hard_stop", { event_id: event.event_id, task_id: input.task_id, spend: currentStatus.estimated_cost, limit: currentStatus.hard_limit });
    return event;
  }

  if (currentStatus.estimated_cost >= currentStatus.warning_threshold && policy?.on_limit_reached !== "pause_and_require_new_limit") {
    const existingWarning = [...interruptionEvents.values()].find(
      e => e.task_id === input.task_id && e.interruption_kind === "warning" && e.user_decision === "pending"
    );
    if (!existingWarning) {
      const event: BudgetInterruptionEvent = {
        event_id: createEntityId("bie"),
        task_id: input.task_id,
        policy_id: currentStatus.policy_id,
        interruption_kind: "warning",
        spend_at_interruption: currentStatus.estimated_cost,
        limit_at_interruption: currentStatus.hard_limit,
        user_decision: "pending",
        interrupted_at: nowIso()
      };
      interruptionEvents.set(event.event_id, event);
      recordAudit("budget.warning", { event_id: event.event_id, task_id: input.task_id, spend: currentStatus.estimated_cost, threshold: currentStatus.warning_threshold });
      return event;
    }
  }

  return currentStatus;
}

export function resolveBudgetInterruption(input: {
  event_id: string;
  user_decision: "continue_with_new_limit" | "one_time_extension" | "stop_task";
  new_limit?: number;
  extension_amount?: number;
}): BudgetInterruptionEvent | { error: string } {
  const event = interruptionEvents.get(input.event_id);
  if (!event) return { error: "Event not found" };
  if (event.user_decision !== "pending") return { error: "Event already resolved" };

  event.user_decision = input.user_decision;
  event.resolved_at = nowIso();

  if (input.user_decision === "continue_with_new_limit" && input.new_limit !== undefined) {
    event.new_limit = input.new_limit;
    const status = [...budgetStatuses.values()].find(s => s.task_id === event.task_id);
    if (status) {
      status.hard_limit = input.new_limit;
      status.warning_threshold = input.new_limit * 0.8;
      status.budget_remaining = Number((input.new_limit - status.estimated_cost).toFixed(6));
      status.budget_exhausted = status.estimated_cost >= input.new_limit;
      status.last_updated_at = nowIso();
      budgetStatuses.set(status.status_id, status);
    }
  } else if (input.user_decision === "one_time_extension" && input.extension_amount !== undefined) {
    event.extension_amount = input.extension_amount;
    const status = [...budgetStatuses.values()].find(s => s.task_id === event.task_id);
    if (status) {
      status.hard_limit = Number((status.hard_limit + input.extension_amount).toFixed(6));
      status.warning_threshold = status.hard_limit * 0.8;
      status.budget_remaining = Number((status.hard_limit - status.estimated_cost).toFixed(6));
      status.budget_exhausted = status.estimated_cost >= status.hard_limit;
      status.last_updated_at = nowIso();
      budgetStatuses.set(status.status_id, status);
    }
  }

  interruptionEvents.set(event.event_id, event);
  recordAudit("budget.interruption_resolved", { event_id: input.event_id, decision: input.user_decision });
  return event;
}

export function getBudgetStatusForTask(taskId: string): TaskBudgetStatus | undefined {
  return [...budgetStatuses.values()].find(s => s.task_id === taskId);
}

export function getPendingInterruptionForTask(taskId: string): BudgetInterruptionEvent | undefined {
  return [...interruptionEvents.values()].find(
    e => e.task_id === taskId && e.user_decision === "pending"
  );
}

export function getInterruptionEvent(eventId: string): BudgetInterruptionEvent | undefined {
  return interruptionEvents.get(eventId);
}

export function getBudgetDiagnostics(): {
  pricing_entries: number;
  policies: number;
  active_tasks: number;
  total_interruptions: number;
  pending_interruptions: number;
} {
  return {
    pricing_entries: pricingRegistry.size,
    policies: budgetPolicies.size,
    active_tasks: budgetStatuses.size,
    total_interruptions: interruptionEvents.size,
    pending_interruptions: [...interruptionEvents.values()].filter(e => e.user_decision === "pending").length
  };
}
