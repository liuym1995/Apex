import Fastify from "fastify";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import {
  completeWorkerRun,
  createWorkerRun,
  executeTask,
  listTaskWorkerRuns,
  requireTask,
  selectWorker,
  startWorkerRun,
  stopWorkerRun
} from "@apex/shared-runtime";
import { store } from "@apex/shared-state";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "worker-adapter-service", PORT: process.env.PORT ?? "3008" });
const app = Fastify({ logger: false });

app.post("/internal/workers/select", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    requireTask(task_id);
    return { task_id, worker: selectWorker(task_id) };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/workers/dispatch", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    const assigned = createWorkerRun(task_id);
    const started = startWorkerRun(task_id);
    executeTask(task_id);
    const completed = completeWorkerRun(task_id, `Worker ${started.worker_name} finished task execution.`);
    return { task_id, assigned, completed };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/workers/:taskId/stop", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const body = (request.body ?? {}) as { reason?: string };
  try {
    return stopWorkerRun(taskId, body.reason ?? "Stopped by operator request.");
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/internal/workers/:taskId/runs", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  if (!store.tasks.has(taskId)) return reply.code(404).send({ message: "Task not found" });
  return { task_id: taskId, worker_runs: listTaskWorkerRuns(taskId) };
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "worker-adapter-service started", { host: env.HOST, port: env.PORT });
});
