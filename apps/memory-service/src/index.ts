import Fastify from "fastify";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import { captureMemories, createSkillCandidate, requireTask } from "@apex/shared-runtime";
import { store } from "@apex/shared-state";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "memory-service", PORT: process.env.PORT ?? "3005" });
const app = Fastify({ logger: false });

app.post("/internal/memory/tasks/:taskId/capture", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    requireTask(taskId);
    return { task_id: taskId, memory_items: captureMemories(taskId) };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/internal/memory/tasks/:taskId", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  if (!store.tasks.has(taskId)) return reply.code(404).send({ message: "Task not found" });
  const items = [...store.memoryItems.values()].filter(item => item.task_id === taskId);
  return { task_id: taskId, items };
});

app.get("/internal/memory/search", async request => {
  const query = String((request.query as { q?: string }).q ?? "").toLowerCase();
  const items = [...store.memoryItems.values()].filter(item =>
    !query ? true : item.title.toLowerCase().includes(query) || item.content.toLowerCase().includes(query)
  );
  return { total: items.length, items };
});

app.post("/internal/memory/tasks/:taskId/skill-candidate", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  try {
    requireTask(taskId);
    return createSkillCandidate(taskId);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "memory-service started", { host: env.HOST, port: env.PORT });
});
