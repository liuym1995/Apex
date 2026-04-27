import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  type ScheduledJobRetryPolicy,
  type MissedRunPolicy
} from "@apex/shared-types";
import { recordAudit } from "./core.js";
import { parseCronExpression, getNextCronFireTime } from "./cron-parser.js";

export interface ScheduledJob {
  job_id: string;
  name: string;
  cron_expression: string;
  handler_name: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_success_at?: string;
  last_error_at?: string;
  run_count: number;
  error_count: number;
  consecutive_error_count: number;
  retry_policy: ScheduledJobRetryPolicy;
  missed_run_policy: MissedRunPolicy;
  last_missed_run_at?: string;
  missed_run_count: number;
  checkpoint_aware: boolean;
  maintenance_cycle_job: boolean;
  created_at: string;
}

export interface MetricsComputationResult {
  computation_id: string;
  metrics_type: string;
  computed_at: string;
  values: Record<string, number>;
  alerts_triggered: string[];
}

const scheduledJobs = new Map<string, ScheduledJob>();
const jobExecutionLog: Array<{
  job_id: string;
  executed_at: string;
  success: boolean;
  duration_ms: number;
  error_message?: string;
}> = [];

export function computeAllMetrics(): MetricsComputationResult[] {
  const results: MetricsComputationResult[] = [];

  const taskMetrics = computeTaskMetrics();
  results.push(taskMetrics);

  const modelMetrics = computeModelMetrics();
  results.push(modelMetrics);

  const reuseMetrics = computeReuseMetrics();
  results.push(reuseMetrics);

  const sandboxMetrics = computeSandboxMetrics();
  results.push(sandboxMetrics);

  const sloAlerts = checkSLOBreaches();
  for (const alert of sloAlerts) {
    recordAudit("metrics.slo_breach_detected", {
      alert_id: alert.alert_id,
      slo_name: alert.slo_name,
      current_value: alert.current_value,
      threshold: alert.threshold,
      severity: alert.severity
    });
  }

  recordAudit("metrics.auto_computation_completed", {
    computation_count: results.length,
    alerts_triggered: sloAlerts.length,
    computed_at: nowIso()
  });

  return results;
}

function computeTaskMetrics(): MetricsComputationResult {
  const tasks = [...store.tasks.values()];
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const failed = tasks.filter(t => t.status === "failed").length;
  const running = tasks.filter(t => t.status === "running").length;
  const completionRate = total > 0 ? completed / total : 0;
  const failureRate = total > 0 ? failed / total : 0;

  return {
    computation_id: createEntityId("metcomp"),
    metrics_type: "task",
    computed_at: nowIso(),
    values: {
      total_tasks: total,
      completed_tasks: completed,
      failed_tasks: failed,
      running_tasks: running,
      completion_rate: Math.round(completionRate * 10000) / 10000,
      failure_rate: Math.round(failureRate * 10000) / 10000
    },
    alerts_triggered: []
  };
}

function computeModelMetrics(): MetricsComputationResult {
  const requests = store.modelRequests.toArray();
  const totalRequests = requests.length;
  const totalInputTokens = requests.reduce((sum, r) => sum + (r.input_tokens ?? 0), 0);
  const totalOutputTokens = requests.reduce((sum, r) => sum + (r.output_tokens ?? 0), 0);
  const totalCost = requests.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
  const avgLatency = totalRequests > 0
    ? requests.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / totalRequests
    : 0;

  const byProvider: Record<string, { count: number; cost: number; tokens: number }> = {};
  for (const req of requests) {
    const provider = req.provider ?? "unknown";
    if (!byProvider[provider]) byProvider[provider] = { count: 0, cost: 0, tokens: 0 };
    byProvider[provider].count += 1;
    byProvider[provider].cost += req.cost_usd ?? 0;
    byProvider[provider].tokens += (req.input_tokens ?? 0) + (req.output_tokens ?? 0);
  }

  const byModel: Record<string, { cost: number; tokens: number }> = {};
  for (const req of requests) {
    const model = req.model_alias ?? req.model_id ?? "unknown";
    if (!byModel[model]) byModel[model] = { cost: 0, tokens: 0 };
    byModel[model].cost += req.cost_usd ?? 0;
    byModel[model].tokens += (req.input_tokens ?? 0) + (req.output_tokens ?? 0);
  }

  const opMetrics = store.operationalMetrics.get("default");
  if (opMetrics) {
    opMetrics.cost_metrics.by_model = byModel;
    store.operationalMetrics.set("default", opMetrics);
  }

  return {
    computation_id: createEntityId("metcomp"),
    metrics_type: "model",
    computed_at: nowIso(),
    values: {
      total_requests: totalRequests,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_cost_usd: Math.round(totalCost * 1000000) / 1000000,
      avg_latency_ms: Math.round(avgLatency),
      by_provider_count: Object.keys(byProvider).length
    },
    alerts_triggered: []
  };
}

function computeReuseMetrics(): MetricsComputationResult {
  const tasks = [...store.tasks.values()];
  const skills = [...store.canonicalSkills.values()];
  const templates = [...store.taskTemplates.values()];

  const skillReuseCounts = skills.map(s => {
    const skillAudits = store.audits.toArray().filter(a =>
      a.action?.includes("skill") && (a.payload as Record<string, unknown>)?.skill_id === s.skill_id
    );
    return skillAudits.length;
  });
  const templateUseCounts = templates.map(t => {
    const templateAudits = store.audits.toArray().filter(a =>
      a.action?.includes("template") && (a.payload as Record<string, unknown>)?.template_id === t.template_id
    );
    return templateAudits.length;
  });

  const totalSkillReuse = skillReuseCounts.reduce((a, b) => a + b, 0);
  const totalTemplateReuse = templateUseCounts.reduce((a, b) => a + b, 0);
  const avgSkillReuse = skills.length > 0 ? totalSkillReuse / skills.length : 0;
  const avgTemplateReuse = templates.length > 0 ? totalTemplateReuse / templates.length : 0;

  const opMetrics = store.operationalMetrics.get("default");
  if (opMetrics) {
    opMetrics.reuse_metrics = {
      total_tasks: totalSkillReuse + totalTemplateReuse,
      tasks_with_reuse: Math.min(totalSkillReuse + totalTemplateReuse, tasks.length),
      reuse_hit_rate: tasks.length > 0 ? Math.min(1, (totalSkillReuse + totalTemplateReuse) / tasks.length) : 0,
      skills_reused: totalSkillReuse,
      playbooks_reused: totalTemplateReuse
    };
    store.operationalMetrics.set("default", opMetrics);
  }

  return {
    computation_id: createEntityId("metcomp"),
    metrics_type: "reuse",
    computed_at: nowIso(),
    values: {
      total_skill_reuse: totalSkillReuse,
      total_template_reuse: totalTemplateReuse,
      avg_skill_reuse: Math.round(avgSkillReuse * 100) / 100,
      avg_template_reuse: Math.round(avgTemplateReuse * 100) / 100,
      skill_count: skills.length,
      template_count: templates.length
    },
    alerts_triggered: []
  };
}

function computeSandboxMetrics(): MetricsComputationResult {
  const manifests = [...store.sandboxManifests.values()];
  const leases = [...store.sandboxLeases.values()];

  return {
    computation_id: createEntityId("metcomp"),
    metrics_type: "sandbox",
    computed_at: nowIso(),
    values: {
      total_manifests: manifests.length,
      active_manifests: manifests.filter(m => m.status === "active").length,
      total_leases: leases.length,
      active_leases: leases.filter(l => l.status === "active").length,
      expired_leases: leases.filter(l => l.status === "expired").length
    },
    alerts_triggered: []
  };
}

interface SLOBreachAlert {
  alert_id: string;
  slo_name: string;
  current_value: number;
  threshold: number;
  severity: "warning" | "critical";
  message: string;
  timestamp: string;
}

function checkSLOBreaches(): SLOBreachAlert[] {
  const alerts: SLOBreachAlert[] = [];

  const tasks = [...store.tasks.values()];
  const totalTasks = tasks.length;
  const failedTasks = tasks.filter(t => t.status === "failed").length;
  const failureRate = totalTasks > 0 ? failedTasks / totalTasks : 0;

  if (failureRate > 0.2) {
    alerts.push({
      alert_id: createEntityId("sloalert"),
      slo_name: "task_failure_rate",
      current_value: failureRate,
      threshold: 0.2,
      severity: failureRate > 0.4 ? "critical" : "warning",
      message: `Task failure rate ${(failureRate * 100).toFixed(1)}% exceeds SLO threshold of 20%`,
      timestamp: nowIso()
    });
  }

  const requests = store.modelRequests.toArray();
  const recentRequests = requests.filter(r => {
    const createdAt = r.created_at;
    return createdAt && Date.now() - Date.parse(createdAt) < 3600000;
  });
  const avgLatency = recentRequests.length > 0
    ? recentRequests.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / recentRequests.length
    : 0;

  if (avgLatency > 30000) {
    alerts.push({
      alert_id: createEntityId("sloalert"),
      slo_name: "model_latency_p95",
      current_value: avgLatency,
      threshold: 30000,
      severity: avgLatency > 60000 ? "critical" : "warning",
      message: `Average model latency ${Math.round(avgLatency)}ms exceeds SLO threshold of 30000ms`,
      timestamp: nowIso()
    });
  }

  const totalCost = requests.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
  if (totalCost > 100) {
    alerts.push({
      alert_id: createEntityId("sloalert"),
      slo_name: "daily_cost_budget",
      current_value: totalCost,
      threshold: 100,
      severity: totalCost > 200 ? "critical" : "warning",
      message: `Total model cost $${totalCost.toFixed(2)} exceeds daily budget of $100`,
      timestamp: nowIso()
    });
  }

  return alerts;
}

export function createCronScheduledJob(input: {
  name: string;
  cron_expression: string;
  handler_name: string;
  is_active?: boolean;
  retry_policy?: ScheduledJobRetryPolicy;
  missed_run_policy?: MissedRunPolicy;
  checkpoint_aware?: boolean;
  maintenance_cycle_job?: boolean;
}): ScheduledJob {
  const cron = parseCronExpression(input.cron_expression);
  const nextFire = getNextCronFireTime(cron);

  const job: ScheduledJob = {
    job_id: createEntityId("sjob"),
    name: input.name,
    cron_expression: input.cron_expression,
    handler_name: input.handler_name,
    is_active: input.is_active ?? true,
    next_run_at: nextFire.next_fire_time,
    run_count: 0,
    error_count: 0,
    consecutive_error_count: 0,
    retry_policy: input.retry_policy ?? {
      max_retries: 3,
      backoff_base_ms: 1000,
      backoff_multiplier: 2,
      max_backoff_ms: 60000,
      retry_on_error: true,
      retry_on_timeout: true
    },
    missed_run_policy: input.missed_run_policy ?? "run_and_alert",
    missed_run_count: 0,
    checkpoint_aware: input.checkpoint_aware ?? false,
    maintenance_cycle_job: input.maintenance_cycle_job ?? false,
    created_at: nowIso()
  };

  scheduledJobs.set(job.job_id, job);

  recordAudit("scheduler.job_created", {
    job_id: job.job_id,
    name: job.name,
    cron_expression: job.cron_expression,
    handler_name: job.handler_name,
    next_run_at: job.next_run_at,
    retry_policy: job.retry_policy,
    missed_run_policy: job.missed_run_policy
  });

  return job;
}

export function executeScheduledJob(jobId: string): {
  success: boolean;
  duration_ms: number;
  error_message?: string;
  retry_count: number;
} {
  const job = scheduledJobs.get(jobId);
  if (!job) throw new Error(`Scheduled job not found: ${jobId}`);
  if (!job.is_active) return { success: false, duration_ms: 0, error_message: "Job is not active", retry_count: 0 };

  const startTime = Date.now();
  let lastError: string | undefined;
  let retryCount = 0;
  let succeeded = false;

  const maxAttempts = job.retry_policy.max_retries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptStart = Date.now();
    try {
      executeJobHandler(job.handler_name);
      succeeded = true;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      retryCount = attempt;

      if (attempt < job.retry_policy.max_retries) {
        const backoffMs = Math.min(
          job.retry_policy.backoff_base_ms * Math.pow(job.retry_policy.backoff_multiplier, attempt),
          job.retry_policy.max_backoff_ms
        );
        const jitter = Math.random() * backoffMs * 0.1;
        const waitMs = backoffMs + jitter;

        recordAudit("scheduler.job_retry", {
          job_id: jobId,
          name: job.name,
          attempt: attempt + 1,
          max_retries: job.retry_policy.max_retries,
          backoff_ms: Math.round(waitMs),
          error: lastError
        });

        const deadline = Date.now() + waitMs;
        while (Date.now() < deadline) {
          // busy wait for backoff
        }
      }
    }
  }

  const duration = Date.now() - startTime;

  if (succeeded) {
    job.run_count += 1;
    job.last_run_at = nowIso();
    job.last_success_at = nowIso();
    job.consecutive_error_count = 0;

    const nextFire = getNextCronFireTime(job.cron_expression);
    job.next_run_at = nextFire.next_fire_time;

    scheduledJobs.set(jobId, job);

    jobExecutionLog.push({
      job_id: jobId,
      executed_at: nowIso(),
      success: true,
      duration_ms: duration
    });

    recordAudit("scheduler.job_executed", {
      job_id: jobId,
      name: job.name,
      handler_name: job.handler_name,
      duration_ms: duration,
      run_count: job.run_count,
      retry_count: retryCount
    });

    return { success: true, duration_ms: duration, retry_count: retryCount };
  } else {
    job.error_count += 1;
    job.consecutive_error_count += 1;
    job.last_error_at = nowIso();

    jobExecutionLog.push({
      job_id: jobId,
      executed_at: nowIso(),
      success: false,
      duration_ms: duration,
      error_message: lastError
    });

    recordAudit("scheduler.job_error", {
      job_id: jobId,
      name: job.name,
      error_message: lastError,
      consecutive_error_count: job.consecutive_error_count,
      retry_count: retryCount
    });

    return { success: false, duration_ms: duration, error_message: lastError, retry_count: retryCount };
  }
}

function executeJobHandler(handlerName: string): void {
  switch (handlerName) {
    case "compute_all_metrics": {
      computeAllMetrics();
      break;
    }
    case "enforce_sandbox_lease_expiry": {
      const { enforceSandboxLeaseExpiry } = require("./index.js");
      enforceSandboxLeaseExpiry();
      break;
    }
    case "detect_expired_worker_sessions": {
      const { detectExpiredWorkerSessions } = require("./index.js");
      detectExpiredWorkerSessions();
      break;
    }
    case "enforce_execution_step_timeouts": {
      const { enforceExecutionStepTimeouts } = require("./index.js");
      enforceExecutionStepTimeouts();
      break;
    }
    case "run_maintenance_cycle": {
      const { runRuntimeMaintenanceCycle } = require("./index.js");
      runRuntimeMaintenanceCycle();
      break;
    }
    case "trigger_low_confidence_experiments": {
      const { triggerExperimentsForLowConfidence } = require("./learning-factory-automation.js");
      triggerExperimentsForLowConfidence();
      break;
    }
    case "run_delegated_runtime_maintenance": {
      const { runDelegatedRuntimeMaintenanceCycle } = require("./delegated-runtime-hardening.js");
      runDelegatedRuntimeMaintenanceCycle({ auto_restart: true });
      break;
    }
    case "detect_missed_schedule_runs": {
      detectMissedScheduleRuns();
      break;
    }
    case "recover_stale_scheduled_jobs": {
      recoverStaleScheduledJobs();
      break;
    }
    case "enforce_maintenance_cycle": {
      enforceMaintenanceCycle();
      break;
    }
    default: {
      throw new Error(`Unknown handler: ${handlerName}`);
    }
  }
}

export function listCronScheduledJobs(): ScheduledJob[] {
  return [...scheduledJobs.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getScheduledJobExecutionLog(jobId?: string, limit?: number): Array<{
  job_id: string;
  executed_at: string;
  success: boolean;
  duration_ms: number;
  error_message?: string;
}> {
  let log = [...jobExecutionLog].sort((a, b) => b.executed_at.localeCompare(a.executed_at));
  if (jobId) log = log.filter(e => e.job_id === jobId);
  if (limit) log = log.slice(0, limit);
  return log;
}

export function activateScheduledJob(jobId: string): ScheduledJob {
  const job = scheduledJobs.get(jobId);
  if (!job) throw new Error(`Scheduled job not found: ${jobId}`);
  job.is_active = true;
  const nextFire = getNextCronFireTime(job.cron_expression);
  job.next_run_at = nextFire.next_fire_time;
  scheduledJobs.set(jobId, job);
  return job;
}

export function deactivateScheduledJob(jobId: string): ScheduledJob {
  const job = scheduledJobs.get(jobId);
  if (!job) throw new Error(`Scheduled job not found: ${jobId}`);
  job.is_active = false;
  scheduledJobs.set(jobId, job);
  return job;
}

export function createDefaultScheduledJobs(): ScheduledJob[] {
  const defaults: Array<{
    name: string;
    cron_expression: string;
    handler_name: string;
    checkpoint_aware?: boolean;
    maintenance_cycle_job?: boolean;
    missed_run_policy?: MissedRunPolicy;
  }> = [
    { name: "metrics-computation", cron_expression: "*/5 * * * *", handler_name: "compute_all_metrics" },
    { name: "sandbox-lease-expiry", cron_expression: "*/1 * * * *", handler_name: "enforce_sandbox_lease_expiry", maintenance_cycle_job: true },
    { name: "worker-session-expiry", cron_expression: "*/2 * * * *", handler_name: "detect_expired_worker_sessions", maintenance_cycle_job: true },
    { name: "step-timeout-enforcement", cron_expression: "*/1 * * * *", handler_name: "enforce_execution_step_timeouts", maintenance_cycle_job: true },
    { name: "runtime-maintenance", cron_expression: "*/5 * * * *", handler_name: "run_maintenance_cycle", maintenance_cycle_job: true, checkpoint_aware: true },
    { name: "low-confidence-experiments", cron_expression: "0 */6 * * *", handler_name: "trigger_low_confidence_experiments" },
    { name: "delegated-runtime-maintenance", cron_expression: "*/3 * * * *", handler_name: "run_delegated_runtime_maintenance", maintenance_cycle_job: true, checkpoint_aware: true, missed_run_policy: "run_immediately" },
    { name: "missed-schedule-detection", cron_expression: "*/10 * * * *", handler_name: "detect_missed_schedule_runs", missed_run_policy: "skip" },
    { name: "stale-job-recovery", cron_expression: "*/15 * * * *", handler_name: "recover_stale_scheduled_jobs", maintenance_cycle_job: true },
    { name: "maintenance-cycle-enforcement", cron_expression: "*/5 * * * *", handler_name: "enforce_maintenance_cycle", maintenance_cycle_job: true, checkpoint_aware: true }
  ];

  const jobs: ScheduledJob[] = [];
  for (const def of defaults) {
    const existing = [...scheduledJobs.values()].find(j => j.handler_name === def.handler_name);
    if (!existing) {
      jobs.push(createCronScheduledJob({
        name: def.name,
        cron_expression: def.cron_expression,
        handler_name: def.handler_name,
        checkpoint_aware: def.checkpoint_aware,
        maintenance_cycle_job: def.maintenance_cycle_job,
        missed_run_policy: def.missed_run_policy
      }));
    }
  }
  return jobs;
}

export function detectMissedScheduleRuns(): Array<{
  job_id: string;
  job_name: string;
  missed_fire_time: string;
  action_taken: string;
}> {
  const now = Date.now();
  const missed: Array<{
    job_id: string;
    job_name: string;
    missed_fire_time: string;
    action_taken: string;
  }> = [];

  for (const job of scheduledJobs.values()) {
    if (!job.is_active || !job.next_run_at) continue;

    const nextFireTime = Date.parse(job.next_run_at);
    if (now > nextFireTime + 60000) {
      const missedFireTime = job.next_run_at;
      job.missed_run_count += 1;
      job.last_missed_run_at = nowIso();

      let actionTaken: string;
      switch (job.missed_run_policy) {
        case "run_immediately": {
          try {
            executeScheduledJob(job.job_id);
            actionTaken = "executed";
          } catch {
            actionTaken = "execution_failed";
          }
          break;
        }
        case "run_and_alert": {
          try {
            executeScheduledJob(job.job_id);
            actionTaken = "executed_with_alert";
          } catch {
            actionTaken = "execution_failed_with_alert";
          }
          recordAudit("scheduler.missed_run_alert", {
            job_id: job.job_id,
            job_name: job.name,
            missed_fire_time: missedFireTime
          });
          break;
        }
        case "queue_for_next_cycle": {
          actionTaken = "queued_for_next_cycle";
          break;
        }
        default: {
          actionTaken = "skipped";
          break;
        }
      }

      missed.push({
        job_id: job.job_id,
        job_name: job.name,
        missed_fire_time: missedFireTime,
        action_taken: actionTaken
      });

      recordAudit("scheduler.missed_run_detected", {
        job_id: job.job_id,
        job_name: job.name,
        missed_fire_time: missedFireTime,
        action_taken: actionTaken,
        missed_run_count: job.missed_run_count
      });
    }
  }

  return missed;
}

export function recoverStaleScheduledJobs(): Array<{
  job_id: string;
  job_name: string;
  recovery_action: string;
}> {
  const recovered: Array<{
    job_id: string;
    job_name: string;
    recovery_action: string;
  }> = [];

  for (const job of scheduledJobs.values()) {
    if (!job.is_active) continue;

    if (job.consecutive_error_count >= 5) {
      job.is_active = false;
      recovered.push({
        job_id: job.job_id,
        job_name: job.name,
        recovery_action: "deactivated_due_to_consecutive_errors"
      });

      recordAudit("scheduler.job_deactivated_consecutive_errors", {
        job_id: job.job_id,
        job_name: job.name,
        consecutive_error_count: job.consecutive_error_count
      });
      continue;
    }

    if (job.consecutive_error_count >= 3 && job.consecutive_error_count < 5) {
      const nextFire = getNextCronFireTime(job.cron_expression);
      job.next_run_at = nextFire.next_fire_time;
      recovered.push({
        job_id: job.job_id,
        job_name: job.name,
        recovery_action: "schedule_reset_after_errors"
      });

      recordAudit("scheduler.job_schedule_reset", {
        job_id: job.job_id,
        job_name: job.name,
        consecutive_error_count: job.consecutive_error_count,
        new_next_run_at: job.next_run_at
      });
    }
  }

  return recovered;
}

export function enforceMaintenanceCycle(): Array<{
  job_id: string;
  job_name: string;
  enforcement_action: string;
}> {
  const actions: Array<{
    job_id: string;
    job_name: string;
    enforcement_action: string;
  }> = [];

  for (const job of scheduledJobs.values()) {
    if (!job.maintenance_cycle_job) continue;
    if (!job.is_active) continue;

    if (!job.last_run_at) {
      const timeSinceCreation = Date.now() - Date.parse(job.created_at);
      if (timeSinceCreation > 600000) {
        try {
          executeScheduledJob(job.job_id);
          actions.push({
            job_id: job.job_id,
            job_name: job.name,
            enforcement_action: "initial_run_enforced"
          });
        } catch {
          actions.push({
            job_id: job.job_id,
            job_name: job.name,
            enforcement_action: "initial_run_failed"
          });
        }
      }
      continue;
    }

    const timeSinceLastRun = Date.now() - Date.parse(job.last_run_at);
    const cron = parseCronExpression(job.cron_expression);
    const expectedInterval = estimateCronIntervalMs(cron);

    if (timeSinceLastRun > expectedInterval * 2) {
      try {
        executeScheduledJob(job.job_id);
        actions.push({
          job_id: job.job_id,
          job_name: job.name,
          enforcement_action: "overdue_run_enforced"
        });
      } catch {
        actions.push({
          job_id: job.job_id,
          job_name: job.name,
          enforcement_action: "overdue_run_failed"
        });
      }
    }
  }

  if (actions.length > 0) {
    recordAudit("scheduler.maintenance_cycle_enforcement", {
      actions_taken: actions.length,
      action_summary: actions.map(a => `${a.job_name}: ${a.enforcement_action}`).join(", ")
    });
  }

  return actions;
}

function estimateCronIntervalMs(cron: ReturnType<typeof parseCronExpression>): number {
  const times = getNextNCronFireTimes(cron, 3);
  if (times.length < 2) return 300000;
  const diff1 = Date.parse(times[1].next_fire_time) - Date.parse(times[0].next_fire_time);
  if (times.length >= 3) {
    const diff2 = Date.parse(times[2].next_fire_time) - Date.parse(times[1].next_fire_time);
    return Math.round((diff1 + diff2) / 2);
  }
  return diff1;
}

function getNextNCronFireTimes(cron: ReturnType<typeof parseCronExpression>, n: number): Array<{ next_fire_time: string }> {
  const results: Array<{ next_fire_time: string }> = [];
  for (let i = 0; i < n; i++) {
    const next = getNextCronFireTime(cron.original);
    results.push(next);
    if (!next.next_fire_time) break;
  }
  return results;
}

export function getScheduleHealthDiagnostics(): {
  total_jobs: number;
  active_jobs: number;
  jobs_with_errors: number;
  jobs_with_missed_runs: number;
  maintenance_jobs: number;
  checkpoint_aware_jobs: number;
  health_status: "healthy" | "degraded" | "unhealthy";
  issues: string[];
  follow_up_tasks: Array<{ description: string; priority: "low" | "medium" | "high" }>;
} {
  const jobs = [...scheduledJobs.values()];
  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(j => j.is_active).length;
  const jobsWithErrors = jobs.filter(j => j.consecutive_error_count > 0).length;
  const jobsWithMissedRuns = jobs.filter(j => j.missed_run_count > 0).length;
  const maintenanceJobs = jobs.filter(j => j.maintenance_cycle_job).length;
  const checkpointAwareJobs = jobs.filter(j => j.checkpoint_aware).length;

  const issues: string[] = [];
  const followUpTasks: Array<{ description: string; priority: "low" | "medium" | "high" }> = [];

  for (const job of jobs) {
    if (job.consecutive_error_count >= 5) {
      issues.push(`Job ${job.name} has ${job.consecutive_error_count} consecutive errors`);
      followUpTasks.push({ description: `Investigate and fix job ${job.name}`, priority: "high" });
    } else if (job.consecutive_error_count >= 3) {
      issues.push(`Job ${job.name} has ${job.consecutive_error_count} consecutive errors`);
      followUpTasks.push({ description: `Monitor job ${job.name} for continued errors`, priority: "medium" });
    }

    if (job.missed_run_count >= 5) {
      issues.push(`Job ${job.name} has ${job.missed_run_count} missed runs`);
      followUpTasks.push({ description: `Review schedule for ${job.name}`, priority: "medium" });
    }
  }

  const healthStatus: "healthy" | "degraded" | "unhealthy" =
    jobsWithErrors >= totalJobs * 0.5 ? "unhealthy"
    : jobsWithErrors >= totalJobs * 0.2 ? "degraded"
    : "healthy";

  return {
    total_jobs: totalJobs,
    active_jobs: activeJobs,
    jobs_with_errors: jobsWithErrors,
    jobs_with_missed_runs: jobsWithMissedRuns,
    maintenance_jobs: maintenanceJobs,
    checkpoint_aware_jobs: checkpointAwareJobs,
    health_status: healthStatus,
    issues,
    follow_up_tasks: followUpTasks
  };
}
