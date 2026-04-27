import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";
import { getDispatchPlanForTask } from "./dispatch-plan-leasing.js";

export interface SubagentContextEnvelope {
  envelope_id: string;
  plan_id: string;
  step_id: string;
  agent_id: string;
  step_goal: string;
  allowed_tools: string[];
  allowed_sandbox_tiers: string[];
  relevant_artifacts: Array<{ artifact_id: string; description: string }>;
  relevant_memory_hits: Array<{ memory_id: string; relevance: number }>;
  policy_slice: {
    max_parallel_subagents: number;
    max_delegation_depth: number;
    budget_limit?: number;
  };
  definition_of_done: string[];
  return_schema: string;
  created_at: string;
}

export interface SubagentResultEnvelope {
  envelope_id: string;
  plan_id: string;
  step_id: string;
  agent_id: string;
  status: "completed" | "partial" | "failed" | "blocked";
  summary: string;
  artifacts: Array<{ artifact_id: string; description: string }>;
  evidence: Array<{ evidence_id: string; kind: string; path: string }>;
  blockers: string[];
  follow_up_note?: string;
  created_at: string;
}

const contextEnvelopes = new Map<string, SubagentContextEnvelope>();
const resultEnvelopes = new Map<string, SubagentResultEnvelope>();

export function buildSubagentContextEnvelope(input: {
  plan_id: string;
  step_id: string;
  agent_id: string;
  step_goal: string;
  allowed_tools?: string[];
  allowed_sandbox_tiers?: string[];
  relevant_artifacts?: Array<{ artifact_id: string; description: string }>;
  relevant_memory_hits?: Array<{ memory_id: string; relevance: number }>;
  max_parallel_subagents?: number;
  max_delegation_depth?: number;
  budget_limit?: number;
  definition_of_done?: string[];
  return_schema?: string;
}): SubagentContextEnvelope {
  const envelope: SubagentContextEnvelope = {
    envelope_id: createEntityId("subctx"),
    plan_id: input.plan_id,
    step_id: input.step_id,
    agent_id: input.agent_id,
    step_goal: input.step_goal,
    allowed_tools: input.allowed_tools ?? ["filesystem_read", "filesystem_write", "shell_exec"],
    allowed_sandbox_tiers: input.allowed_sandbox_tiers ?? ["host_readonly", "guarded_mutation"],
    relevant_artifacts: input.relevant_artifacts ?? [],
    relevant_memory_hits: input.relevant_memory_hits ?? [],
    policy_slice: {
      max_parallel_subagents: input.max_parallel_subagents ?? 4,
      max_delegation_depth: input.max_delegation_depth ?? 2,
      budget_limit: input.budget_limit
    },
    definition_of_done: input.definition_of_done ?? [],
    return_schema: input.return_schema ?? "SubagentResultEnvelope",
    created_at: nowIso()
  };

  contextEnvelopes.set(envelope.envelope_id, envelope);
  recordAudit("subagent_envelope.context_built", { envelope_id: envelope.envelope_id, plan_id: input.plan_id, step_id: input.step_id });
  return envelope;
}

export function buildSubagentResultEnvelope(input: {
  plan_id: string;
  step_id: string;
  agent_id: string;
  status: SubagentResultEnvelope["status"];
  summary: string;
  artifacts?: Array<{ artifact_id: string; description: string }>;
  evidence?: Array<{ evidence_id: string; kind: string; path: string }>;
  blockers?: string[];
  follow_up_note?: string;
}): SubagentResultEnvelope {
  const envelope: SubagentResultEnvelope = {
    envelope_id: createEntityId("subres"),
    plan_id: input.plan_id,
    step_id: input.step_id,
    agent_id: input.agent_id,
    status: input.status,
    summary: input.summary,
    artifacts: input.artifacts ?? [],
    evidence: input.evidence ?? [],
    blockers: input.blockers ?? [],
    follow_up_note: input.follow_up_note,
    created_at: nowIso()
  };

  resultEnvelopes.set(envelope.envelope_id, envelope);
  recordAudit("subagent_envelope.result_built", { envelope_id: envelope.envelope_id, plan_id: input.plan_id, step_id: input.step_id, status: input.status });
  return envelope;
}

export function getContextEnvelope(envelopeId: string): SubagentContextEnvelope | undefined {
  return contextEnvelopes.get(envelopeId);
}

export function getResultEnvelope(envelopeId: string): SubagentResultEnvelope | undefined {
  return resultEnvelopes.get(envelopeId);
}

export function getContextEnvelopesForStep(stepId: string): SubagentContextEnvelope[] {
  return [...contextEnvelopes.values()].filter(e => e.step_id === stepId);
}

export function getResultEnvelopesForStep(stepId: string): SubagentResultEnvelope[] {
  return [...resultEnvelopes.values()].filter(e => e.step_id === stepId);
}

export function getContextEnvelopesForTask(taskId: string): SubagentContextEnvelope[] {
  const plan = getDispatchPlanForTask(taskId);
  if (!plan) return [];
  return [...contextEnvelopes.values()].filter(e => e.plan_id === plan.plan_id);
}

export function getResultEnvelopesForTask(taskId: string): SubagentResultEnvelope[] {
  const plan = getDispatchPlanForTask(taskId);
  if (!plan) return [];
  return [...resultEnvelopes.values()].filter(e => e.plan_id === plan.plan_id);
}
