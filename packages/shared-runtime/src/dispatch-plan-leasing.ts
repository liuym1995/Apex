import { store } from "@apex/shared-state";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";
import { loadDelegationPolicy, computeEffectiveDelegationLimits } from "./delegation-policy.js";

export type DispatchPlanStatus = "drafting" | "active" | "completed" | "cancelled";
export type DispatchStepStatus = "pending" | "assigned" | "in_progress" | "completed" | "failed" | "cancelled";
export type LeaseStatus = "active" | "released" | "expired" | "revoked";

export interface AgentDispatchPlan {
  plan_id: string;
  task_id: string;
  plan_version: number;
  status: DispatchPlanStatus;
  supervisor_agent_id: string;
  step_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AgentDispatchStep {
  step_id: string;
  plan_id: string;
  plan_version: number;
  step_index: number;
  goal: string;
  status: DispatchStepStatus;
  assignee_agent_id?: string;
  lease_id?: string;
  idempotency_key: string;
  depends_on_step_ids: string[];
  result_envelope_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface SubagentAssignment {
  assignment_id: string;
  plan_id: string;
  step_id: string;
  agent_id: string;
  supervisor_agent_id: string;
  delegation_depth: number;
  created_at: string;
}

export interface AssignmentLease {
  lease_id: string;
  plan_id: string;
  step_id: string;
  agent_id: string;
  status: LeaseStatus;
  acquired_at: string;
  expires_at?: string;
  released_at?: string;
}

const dispatchPlans = new Map<string, AgentDispatchPlan>();
const dispatchSteps = new Map<string, AgentDispatchStep>();
const assignments = new Map<string, SubagentAssignment>();
const leases = new Map<string, AssignmentLease>();

export function createDispatchPlan(input: { task_id: string; supervisor_agent_id: string }): AgentDispatchPlan {
  const plan: AgentDispatchPlan = {
    plan_id: createEntityId("dplan"),
    task_id: input.task_id,
    plan_version: 1,
    status: "drafting",
    supervisor_agent_id: input.supervisor_agent_id,
    step_ids: [],
    created_at: nowIso(),
    updated_at: nowIso()
  };
  dispatchPlans.set(plan.plan_id, plan);
  recordAudit("dispatch_plan.created", { plan_id: plan.plan_id, task_id: input.task_id });
  return plan;
}

export function addDispatchStep(input: {
  plan_id: string;
  goal: string;
  depends_on_step_ids?: string[];
  supervisor_agent_id: string;
}): AgentDispatchStep | { error: string } {
  const plan = dispatchPlans.get(input.plan_id);
  if (!plan) return { error: "Plan not found" };
  if (plan.supervisor_agent_id !== input.supervisor_agent_id) return { error: "Only supervisor can add steps" };

  const step: AgentDispatchStep = {
    step_id: createEntityId("dstep"),
    plan_id: input.plan_id,
    plan_version: plan.plan_version,
    step_index: plan.step_ids.length,
    goal: input.goal,
    status: "pending",
    idempotency_key: createEntityId("dkey"),
    depends_on_step_ids: input.depends_on_step_ids ?? [],
    created_at: nowIso(),
    updated_at: nowIso()
  };

  dispatchSteps.set(step.step_id, step);
  plan.step_ids.push(step.step_id);
  plan.updated_at = nowIso();
  dispatchPlans.set(plan.plan_id, plan);

  recordAudit("dispatch_plan.step_added", { plan_id: input.plan_id, step_id: step.step_id });
  return step;
}

export function assignStepToSubagent(input: {
  plan_id: string;
  step_id: string;
  agent_id: string;
  supervisor_agent_id: string;
}): SubagentAssignment | { error: string } {
  const plan = dispatchPlans.get(input.plan_id);
  if (!plan) return { error: "Plan not found" };
  if (plan.supervisor_agent_id !== input.supervisor_agent_id) return { error: "Only supervisor can assign steps" };

  const step = dispatchSteps.get(input.step_id);
  if (!step) return { error: "Step not found" };
  if (step.plan_id !== input.plan_id) return { error: "Step does not belong to plan" };
  if (step.status === "completed" || step.status === "cancelled") return { error: "Step already terminal" };

  const activeLease = [...leases.values()].find(
    l => l.step_id === input.step_id && l.status === "active"
  );
  if (activeLease) return { error: "Step already has an active lease. Duplicate assignment denied." };

  const policy = loadDelegationPolicy();
  const effective = computeEffectiveDelegationLimits(policy);

  const activeAssignmentsForPlan = [...assignments.values()].filter(
    a => a.plan_id === input.plan_id && a.supervisor_agent_id === input.supervisor_agent_id
  );
  const activeParallel = activeAssignmentsForPlan.filter(a => {
    const s = dispatchSteps.get(a.step_id);
    return s && (s.status === "assigned" || s.status === "in_progress");
  }).length;

  if (activeParallel >= effective.effective_max_parallel) {
    return { error: `Max parallel subagents (${effective.effective_max_parallel}) reached` };
  }

  const totalForPlan = activeAssignmentsForPlan.length;
  if (totalForPlan >= effective.effective_max_total_per_task) {
    return { error: `Max total subagents per task (${effective.effective_max_total_per_task}) reached` };
  }

  const currentDepth = activeAssignmentsForPlan.length > 0
    ? Math.max(...activeAssignmentsForPlan.map(a => a.delegation_depth))
    : 0;
  const newDepth = currentDepth + 1;
  if (newDepth > effective.effective_max_depth) {
    return { error: `Max delegation depth (${effective.effective_max_depth}) reached` };
  }

  const assignment: SubagentAssignment = {
    assignment_id: createEntityId("dassign"),
    plan_id: input.plan_id,
    step_id: input.step_id,
    agent_id: input.agent_id,
    supervisor_agent_id: input.supervisor_agent_id,
    delegation_depth: newDepth,
    created_at: nowIso()
  };
  assignments.set(assignment.assignment_id, assignment);

  const lease: AssignmentLease = {
    lease_id: createEntityId("dlease"),
    plan_id: input.plan_id,
    step_id: input.step_id,
    agent_id: input.agent_id,
    status: "active",
    acquired_at: nowIso()
  };
  leases.set(lease.lease_id, lease);

  step.status = "assigned";
  step.assignee_agent_id = input.agent_id;
  step.lease_id = lease.lease_id;
  step.updated_at = nowIso();
  dispatchSteps.set(step.step_id, step);

  recordAudit("dispatch_plan.step_assigned", { plan_id: input.plan_id, step_id: input.step_id, agent_id: input.agent_id, lease_id: lease.lease_id });
  return assignment;
}

export function releaseLease(leaseId: string): AssignmentLease | { error: string } {
  const lease = leases.get(leaseId);
  if (!lease) return { error: "Lease not found" };
  if (lease.status !== "active") return { error: "Lease not active" };

  lease.status = "released";
  lease.released_at = nowIso();
  leases.set(lease.lease_id, lease);

  const step = dispatchSteps.get(lease.step_id);
  if (step && step.lease_id === leaseId) {
    step.status = "completed";
    step.updated_at = nowIso();
    dispatchSteps.set(step.step_id, step);
  }

  recordAudit("dispatch_plan.lease_released", { lease_id: leaseId, step_id: lease.step_id });
  return lease;
}

export function updateStepResult(input: { step_id: string; agent_id: string; result_envelope_ref: string }): AgentDispatchStep | { error: string } {
  const step = dispatchSteps.get(input.step_id);
  if (!step) return { error: "Step not found" };
  if (step.assignee_agent_id !== input.agent_id) return { error: "Only assigned agent can update step result" };

  step.result_envelope_ref = input.result_envelope_ref;
  step.updated_at = nowIso();
  dispatchSteps.set(step.step_id, step);

  recordAudit("dispatch_plan.step_result_updated", { step_id: input.step_id, agent_id: input.agent_id });
  return step;
}

export function activatePlan(planId: string): AgentDispatchPlan | { error: string } {
  const plan = dispatchPlans.get(planId);
  if (!plan) return { error: "Plan not found" };
  plan.status = "active";
  plan.updated_at = nowIso();
  dispatchPlans.set(plan.plan_id, plan);
  recordAudit("dispatch_plan.activated", { plan_id: planId });
  return plan;
}

export function getDispatchPlan(planId: string): AgentDispatchPlan | undefined {
  return dispatchPlans.get(planId);
}

export function getDispatchPlanForTask(taskId: string): AgentDispatchPlan | undefined {
  return [...dispatchPlans.values()].find(p => p.task_id === taskId && p.status === "active");
}

export function getActiveLeaseForStep(stepId: string): AssignmentLease | undefined {
  return [...leases.values()].find(l => l.step_id === stepId && l.status === "active");
}

export function getDispatchStep(stepId: string): AgentDispatchStep | undefined {
  return dispatchSteps.get(stepId);
}

export function listDispatchStepsForPlan(planId: string): AgentDispatchStep[] {
  return [...dispatchSteps.values()].filter(s => s.plan_id === planId).sort((a, b) => a.step_index - b.step_index);
}

export function getDispatchDiagnostics(): {
  total_plans: number;
  active_plans: number;
  total_steps: number;
  active_leases: number;
  duplicate_assignments_prevented: number;
} {
  return {
    total_plans: dispatchPlans.size,
    active_plans: [...dispatchPlans.values()].filter(p => p.status === "active").length,
    total_steps: dispatchSteps.size,
    active_leases: [...leases.values()].filter(l => l.status === "active").length,
    duplicate_assignments_prevented: 0
  };
}

export function getDispatchLeaseById(leaseId: string): AssignmentLease | undefined {
  return leases.get(leaseId);
}

export function failDispatchStep(stepId: string, reason: string): AgentDispatchStep | { error: string } {
  const step = dispatchSteps.get(stepId);
  if (!step) return { error: "Step not found" };
  step.status = "failed";
  step.updated_at = nowIso();
  dispatchSteps.set(step.step_id, step);

  const lease = [...leases.values()].find(l => l.step_id === stepId && l.status === "active");
  if (lease) {
    lease.status = "revoked";
    lease.released_at = nowIso();
    leases.set(lease.lease_id, lease);
  }

  recordAudit("dispatch_plan.step_failed", { step_id: stepId, reason, lease_revoked: !!lease });
  return step;
}
