import Fastify from "fastify";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import {
  listTaskArtifacts,
  requireTask,
  runChecklist,
  runDoneGate,
  runReconciliation,
  runVerifier
} from "@apex/shared-runtime";
import { store } from "@apex/shared-state";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "verification-service", PORT: process.env.PORT ?? "3004" });
const app = Fastify({ logger: false });

app.post("/internal/verification/checklist", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    requireTask(task_id);
    return runChecklist(task_id);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/verification/reconcile", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    requireTask(task_id);
    return runReconciliation(task_id);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/verification/verifier", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    requireTask(task_id);
    return runVerifier(task_id);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/verification/done-gate", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    requireTask(task_id);
    return runDoneGate(task_id);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.get("/internal/verification/tasks/:taskId/summary", async (request, reply) => {
  const taskId = (request.params as { taskId: string }).taskId;
  const task = store.tasks.get(taskId);
  if (!task) return reply.code(404).send({ message: "Task not found" });
  return {
    task,
    artifacts: listTaskArtifacts(taskId),
    checklist: store.checklistResults.get(taskId) ?? null,
    reconciliation: store.reconciliationResults.get(taskId) ?? null,
    verification: store.verificationResults.get(taskId) ?? null,
    done_gate: store.doneGateResults.get(taskId) ?? null
  };
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "verification-service started", { host: env.HOST, port: env.PORT });
});
