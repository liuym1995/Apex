import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  type AuditEntry,
  AuditEntrySchema,
  type TaskContract,
  TaskContractSchema
} from "@apex/shared-types";

export function requireTask(taskId: string): TaskContract {
  const task = store.tasks.get(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  return task;
}

export function recordAudit(action: string, payload: Record<string, unknown> = {}, taskId?: string): AuditEntry {
  const entry = AuditEntrySchema.parse({
    audit_id: createEntityId("audit"),
    task_id: taskId,
    action,
    payload,
    created_at: nowIso()
  });
  store.audits.push(entry);
  return entry;
}

export function touchTask(task: TaskContract): TaskContract {
  task.timestamps.updated_at = nowIso();
  store.tasks.set(task.task_id, task);
  return task;
}

export function mirrorTaskContract(taskContract: TaskContract): TaskContract {
  const mirroredTask = TaskContractSchema.parse(taskContract);
  store.tasks.set(mirroredTask.task_id, mirroredTask);
  return mirroredTask;
}

export function tokenizeForLearning(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter(token => token.length >= 2)
    .slice(0, 8);
}

export function getExecutionTemplateKey(task: { inputs?: Record<string, unknown> }) {
  const raw = task.inputs?.execution_template_key;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().toLowerCase() : undefined;
}

export function getLearningTokens(task: Pick<TaskContract, "intent"> & { inputs?: Record<string, unknown> }): string[] {
  const intentTokens = tokenizeForLearning(task.intent);
  const templateTokens = tokenizeForLearning(getExecutionTemplateKey(task) ?? "");
  return [...new Set([...templateTokens, ...intentTokens])].slice(0, 10);
}

export function buildLearningFingerprint(task: Pick<TaskContract, "department" | "task_type" | "intent"> & { inputs?: Record<string, unknown> }): string {
  const executionTemplateKey = getExecutionTemplateKey(task);
  if (executionTemplateKey) {
    const templateSuffix = executionTemplateKey.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "template";
    return `${task.department}_${task.task_type}_${templateSuffix}`;
  }
  const tokens = getLearningTokens(task);
  const suffix = (tokens.length > 0 ? tokens.slice(0, 5).join("_") : "generic").slice(0, 48);
  return `${task.department}_${task.task_type}_${suffix}`;
}
