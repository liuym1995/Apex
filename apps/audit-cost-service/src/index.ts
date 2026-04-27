import Fastify from "fastify";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import { evaluateWatchdog, recordAudit, requireTask, sendHeartbeat, touchTask } from "@apex/shared-runtime";
import { store } from "@apex/shared-state";
import { nowIso } from "@apex/shared-types";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "audit-cost-service", PORT: process.env.PORT ?? "3006" });
const app = Fastify({ logger: false });

app.get("/internal/audit/tasks/:taskId", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  if (!store.tasks.has(taskId)) return reply.code(404).send({ message: "Task not found" });
  return store.audits.filter(entry => entry.task_id === taskId);
});

app.post("/internal/audit/events", async request => {
  const body = (request.body ?? {}) as Record<string, unknown> & { action?: string; task_id?: string };
  return recordAudit(body.action ?? "custom.event", body, body.task_id);
});

app.post("/internal/audit/heartbeat", async (request, reply) => {
  const { task_id, source } = request.body as { task_id: string; source?: string };
  try {
    const task = sendHeartbeat(task_id, source ?? "audit-service");
    return { task_id, heartbeat_at: task.progress_heartbeat_at };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/audit/costs", async (request, reply) => {
  const { task_id, input_tokens, output_tokens, total_cost_usd, tool_calls } = request.body as {
    task_id: string;
    input_tokens?: number;
    output_tokens?: number;
    total_cost_usd?: number;
    tool_calls?: number;
  };
  try {
    const task = requireTask(task_id);
    task.cost_metrics.input_tokens += input_tokens ?? 0;
    task.cost_metrics.output_tokens += output_tokens ?? 0;
    task.cost_metrics.total_cost_usd += total_cost_usd ?? 0;
    task.cost_metrics.tool_calls += tool_calls ?? 0;
    touchTask(task);
    recordAudit("task.cost_updated", { input_tokens, output_tokens, total_cost_usd, tool_calls }, task_id);
    return { task_id, cost_metrics: task.cost_metrics };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/watchdog/evaluate", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    return evaluateWatchdog(task_id);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/internal/metrics/tasks/:taskId", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const task = store.tasks.get(taskId);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  return {
    task_id: taskId,
    status: task.status,
    heartbeat_at: task.progress_heartbeat_at ?? null,
    updated_at: task.timestamps.updated_at ?? task.timestamps.created_at,
    cost_metrics: task.cost_metrics,
    audit_count: store.audits.filter(entry => entry.task_id === taskId).length,
    artifact_count: [...store.artifacts.values()].filter(artifact => artifact.task_id === taskId).length,
    observed_at: nowIso()
  };
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "audit-cost-service started", { host: env.HOST, port: env.PORT });
});
