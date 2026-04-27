import Fastify from "fastify";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import { addCheckpoint, createSchedule, requireTask, sendHeartbeat, touchTask, triggerSchedule } from "@apex/shared-runtime";
import { store } from "@apex/shared-state";
import { nowIso } from "@apex/shared-types";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "workflow-service", PORT: process.env.PORT ?? "3002" });
const app = Fastify({ logger: false });

app.post("/internal/workflows/start", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  const task = store.tasks.get(task_id);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  task.status = "running";
  task.timestamps.started_at = task.timestamps.started_at ?? nowIso();
  sendHeartbeat(task_id, "workflow-start");
  addCheckpoint(task_id, "workflow_started", "Workflow service started task execution.");
  touchTask(task);
  return { task_id, status: task.status };
});

app.post("/internal/workflows/stop", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  const task = store.tasks.get(task_id);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  task.status = "cancelled";
  addCheckpoint(task_id, "workflow_stopped", "Task was stopped by workflow service.");
  touchTask(task);
  return { task_id, status: task.status };
});

app.post("/internal/workflows/resume", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  const task = store.tasks.get(task_id);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  task.status = "running";
  sendHeartbeat(task_id, "workflow-resume");
  addCheckpoint(task_id, "workflow_resumed", "Task resumed from workflow service.");
  touchTask(task);
  return { task_id, status: task.status };
});

app.post("/internal/workflows/heartbeat", async (request, reply) => {
  const { task_id, source } = request.body as { task_id: string; source?: string };
  try {
    const task = sendHeartbeat(task_id, source ?? "workflow-service");
    return { task_id, heartbeat_at: task.progress_heartbeat_at };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/internal/workflows/:taskId/checkpoints", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    requireTask(taskId);
    const checkpoints = [...store.checkpoints.values()].filter(checkpoint => checkpoint.task_id === taskId);
    return { task_id: taskId, checkpoints };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/schedules", async request => {
  const body = request.body as { intent: string; cadence: string; department?: "engineering" | "qa" | "marketing" | "sales" | "hr" | "finance" | "ops" | "general"; task_type?: "recurring" | "scheduled" };
  const schedule = createSchedule(body.intent, body.cadence, body.department ?? "general", body.task_type ?? "scheduled");
  return { status: "accepted", schedule };
});

app.get("/internal/schedules", async () => {
  return { schedules: [...store.schedules.values()] };
});

app.post("/internal/schedules/:id/trigger", async (request, reply) => {
  const scheduleId = (request.params as { id: string }).id;
  try {
    return { status: "triggered", schedule: triggerSchedule(scheduleId) };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "workflow-service started", { host: env.HOST, port: env.PORT });
});
