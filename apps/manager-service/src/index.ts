import Fastify from "fastify";
import { loadBaseEnv } from "@apex/shared-config";
import { log } from "@apex/shared-observability";
import {
  createExecutionPlan,
  createSkillCandidate,
  createWorkerRun,
  listTaskWorkerRuns,
  recordAudit,
  requireTask,
  runDoneGate,
  runReconciliation,
  runVerifier,
  runChecklist,
  touchTask,
  upsertDefinitionOfDone
} from "@apex/shared-runtime";
import { store } from "@apex/shared-state";
import { nowIso } from "@apex/shared-types";

const env = loadBaseEnv({ ...process.env, SERVICE_NAME: "manager-service", PORT: process.env.PORT ?? "3003" });
const app = Fastify({ logger: false });

app.post("/internal/manager/plan", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    const task = createExecutionPlan(task_id);
    return { task_id, definition_of_done: task.definition_of_done, execution_plan: task.execution_plan };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/manager/dispatch", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    const workerRun = createWorkerRun(task_id);
    const task = requireTask(task_id);
    task.status = "running";
    touchTask(task);
    return {
      task_id,
      status: task.status,
      dispatched_to: "worker-adapter-service",
      worker_run: workerRun,
      worker_runs: listTaskWorkerRuns(task_id),
      artifact_count: [...store.artifacts.values()].filter(artifact => artifact.task_id === task_id).length
    };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/manager/replan", async (request, reply) => {
  const { task_id, reason } = request.body as { task_id: string; reason: string };
  try {
    const task = requireTask(task_id);
    task.status = "planning";
    recordAudit("task.replanned", { reason }, task_id);
    touchTask(task);
    return { task_id, replanned: true, reason };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/manager/complete-check", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    const task = upsertDefinitionOfDone(task_id);
    const checklist = runChecklist(task_id);
    const verification = runVerifier(task_id);
    const reconciliation = runReconciliation(task_id);
    const doneGate = runDoneGate(task_id);
    return {
      task_id,
      ready_for_verification: checklist.status === "passed",
      required_artifacts: task.definition_of_done.required_artifacts,
      completion_criteria: task.definition_of_done.completion_criteria,
      checklist,
      reconciliation,
      verification,
      done_gate: doneGate
    };
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.post("/internal/manager/evolve", async (request, reply) => {
  const { task_id } = request.body as { task_id: string };
  try {
    return createSkillCandidate(task_id);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
});

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  log("info", "manager-service started", { host: env.HOST, port: env.PORT });
});
