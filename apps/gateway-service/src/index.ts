import Fastify from "fastify";
import { getDefaultAuthContext } from "@apex/shared-auth";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import {
  createExecutionPlan,
  listTaskArtifacts,
  listTaskCheckpoints,
  recordAudit,
  runTaskEndToEnd,
  touchTask,
  upsertDefinitionOfDone
} from "@apex/shared-runtime";
import { store } from "@apex/shared-state";
import { buildDefaultTask, nowIso } from "@apex/shared-types";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "gateway-service", PORT: process.env.PORT ?? "3001" });
const app = Fastify({ logger: false });

app.post("/tasks", async (request, reply) => {
  const auth = getDefaultAuthContext();
  const body = (request.body ?? {}) as Record<string, unknown>;
  const task = buildDefaultTask({
    task_type: (body.task_type as "one_off" | "long_running" | "recurring" | "scheduled") ?? "one_off",
    intent: String(body.intent ?? "Untitled task"),
    department: (body.department as "engineering" | "qa" | "marketing" | "sales" | "hr" | "finance" | "ops" | "general") ?? "general",
    risk_level: (body.risk_level as "low" | "medium" | "high" | "critical") ?? "medium",
    initiator: {
      tenant_id: auth.tenantId,
      user_id: auth.userId,
      channel: "api"
    },
    inputs: (body.inputs as Record<string, unknown> | undefined) ?? {}
  });
  task.status = "queued";
  task.timestamps.updated_at = nowIso();
  store.tasks.set(task.task_id, task);
  recordAudit("task.created", {}, task.task_id);
  return reply.code(201).send(task);
});

app.get("/tasks/:taskId", async (request, reply) => {
  const task = store.tasks.get((request.params as { taskId: string }).taskId);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  return task;
});

app.post("/tasks/:taskId/stop", async (request, reply) => {
  const task = store.tasks.get((request.params as { taskId: string }).taskId);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  task.status = "stopping";
  task.timestamps.updated_at = nowIso();
  touchTask(task);
  recordAudit("task.stop_requested", {}, task.task_id);
  return { task_id: task.task_id, status: task.status };
});

app.post("/tasks/:taskId/resume", async (request, reply) => {
  const task = store.tasks.get((request.params as { taskId: string }).taskId);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  task.status = "resuming";
  task.timestamps.updated_at = nowIso();
  touchTask(task);
  recordAudit("task.resume_requested", {}, task.task_id);
  return { task_id: task.task_id, status: task.status };
});

app.get("/tasks/:taskId/artifacts", async (request, reply) => {
  const task = store.tasks.get((request.params as { taskId: string }).taskId);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  return { task_id: task.task_id, artifacts: listTaskArtifacts(task.task_id) };
});

app.get("/tasks/:taskId/audit", async request => {
  const taskId = (request.params as { taskId: string }).taskId;
  return store.audits.filter(entry => entry.task_id === taskId);
});

app.get("/tasks/:taskId/checkpoints", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  if (!store.tasks.has(taskId)) return reply.code(404).send({ message: "Task not found" });
  return { task_id: taskId, checkpoints: listTaskCheckpoints(taskId) };
});

app.post("/tasks/:taskId/definition-of-done", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    const task = upsertDefinitionOfDone(taskId);
    return { task_id: taskId, definition_of_done: task.definition_of_done };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/tasks/:taskId/plan", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    const task = createExecutionPlan(taskId);
    return { task_id: taskId, status: task.status, execution_plan: task.execution_plan };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/tasks/:taskId/run", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    return runTaskEndToEnd(taskId);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "gateway-service started", { host: env.HOST, port: env.PORT });
});
