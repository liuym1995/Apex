import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso
} from "@apex/shared-types";
import { log } from "@apex/shared-observability";

export type AppControlExecutionMethod = "cli" | "script" | "api" | "mcp" | "computer_use" | "hybrid";

export type AppControlRiskTier = "low" | "medium" | "high" | "critical";

export interface AppControlSkill {
  skill_id: string;
  name: string;
  description: string;
  task_family: string;
  execution_method: AppControlExecutionMethod;
  risk_tier: AppControlRiskTier;
  requires_confirmation: boolean;
  deterministic: boolean;
  compensable: boolean;
  idempotent: boolean;
  cli_command?: string;
  script_path?: string;
  mcp_capability_id?: string;
  mcp_tool_name?: string;
  computer_use_fallback?: string;
  estimated_duration_ms?: number;
  tags: string[];
  version: string;
  created_at: string;
  updated_at: string;
}

export interface AppControlExecutionPlan {
  plan_id: string;
  skill_id: string;
  task_id?: string;
  session_id?: string;
  steps: AppControlExecutionStep[];
  fallback_chain: AppControlExecutionMethod[];
  estimated_total_duration_ms: number;
  risk_summary: string;
  created_at: string;
}

export interface AppControlExecutionStep {
  step_name: string;
  method: AppControlExecutionMethod;
  command?: string;
  script?: string;
  mcp_tool?: string;
  computer_use_intent?: string;
  params: Record<string, unknown>;
  risk_tier: AppControlRiskTier;
  requires_confirmation: boolean;
  estimated_duration_ms?: number;
}

export interface AppControlExecutionResult {
  result_id: string;
  plan_id: string;
  skill_id: string;
  status: "success" | "error" | "denied" | "fallback" | "pending_confirmation";
  steps_executed: number;
  steps_succeeded: number;
  steps_failed: number;
  method_used: AppControlExecutionMethod;
  fallback_triggered: boolean;
  output?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
  audit_recorded: boolean;
  executed_at: string;
}

const appControlSkills = new Map<string, AppControlSkill>();
const executionPlans = new Map<string, AppControlExecutionPlan>();
const executionResults = new Map<string, AppControlExecutionResult>();

export function registerAppControlSkill(skill: Omit<AppControlSkill, "skill_id" | "created_at" | "updated_at">): AppControlSkill {
  const full: AppControlSkill = {
    ...skill,
    skill_id: createEntityId("appskill"),
    created_at: nowIso(),
    updated_at: nowIso()
  };
  appControlSkills.set(full.skill_id, full);

  try {
    log("info", "app_control_skill_registered", {
      skill_id: full.skill_id,
      name: full.name,
      task_family: full.task_family,
      execution_method: full.execution_method,
      risk_tier: full.risk_tier
    });
  } catch { /* logging failure should not block */ }

  return full;
}

export function getAppControlSkill(skillId: string): AppControlSkill | undefined {
  return appControlSkills.get(skillId);
}

export function listAppControlSkills(filter?: {
  task_family?: string;
  execution_method?: AppControlExecutionMethod;
  risk_tier?: AppControlRiskTier;
  tag?: string;
}): AppControlSkill[] {
  const skills = Array.from(appControlSkills.values());
  if (!filter) return skills;

  return skills.filter(s => {
    if (filter.task_family && s.task_family !== filter.task_family) return false;
    if (filter.execution_method && s.execution_method !== filter.execution_method) return false;
    if (filter.risk_tier && s.risk_tier !== filter.risk_tier) return false;
    if (filter.tag && !s.tags.includes(filter.tag)) return false;
    return true;
  });
}

export function resolveAppControlSkill(input: {
  task_description: string;
  preferred_method?: AppControlExecutionMethod;
  max_risk_tier?: AppControlRiskTier;
}): Array<{ skill: AppControlSkill; relevance_score: number }> {
  const results: Array<{ skill: AppControlSkill; relevance_score: number }> = [];
  const maxRisk = input.max_risk_tier ?? "high";
  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const maxRiskNum = riskOrder[maxRisk] ?? 2;

  for (const skill of appControlSkills.values()) {
    if (riskOrder[skill.risk_tier] > maxRiskNum) continue;

    let score = 0;
    const desc = input.task_description.toLowerCase();
    const name = skill.name.toLowerCase();
    const skillDesc = skill.description.toLowerCase();
    const family = skill.task_family.toLowerCase();

    for (const word of desc.split(/\s+/)) {
      if (word.length < 2) continue;
      if (name.includes(word)) score += 5;
      if (skillDesc.includes(word)) score += 3;
      if (family.includes(word)) score += 4;
      for (const tag of skill.tags) {
        if (tag.toLowerCase().includes(word)) score += 2;
      }
    }

    if (input.preferred_method) {
      if (skill.execution_method === input.preferred_method) score += 10;
      else if (skill.execution_method === "cli" && input.preferred_method === "cli") score += 8;
      else if (skill.execution_method === "script" && input.preferred_method === "cli") score += 6;
    }

    if (skill.deterministic) score += 3;
    if (skill.idempotent) score += 2;
    if (skill.compensable) score += 1;

    const methodOrder: Record<AppControlExecutionMethod, number> = { cli: 0, script: 1, api: 2, mcp: 3, hybrid: 4, computer_use: 5 };
    score += (5 - methodOrder[skill.execution_method]) * 1;

    results.push({ skill, relevance_score: score });
  }

  return results.sort((a, b) => b.relevance_score - a.relevance_score);
}

export function planAppControlExecution(input: {
  skill_id: string;
  task_id?: string;
  session_id?: string;
  params?: Record<string, unknown>;
}): AppControlExecutionPlan {
  const skill = appControlSkills.get(input.skill_id);
  if (!skill) throw new Error(`App control skill not found: ${input.skill_id}`);

  const fallbackChain = buildFallbackChain(skill);

  const steps: AppControlExecutionStep[] = [];

  if (skill.execution_method === "cli" || skill.execution_method === "hybrid") {
    steps.push({
      step_name: `execute_${skill.name}_cli`,
      method: "cli",
      command: skill.cli_command,
      params: input.params ?? {},
      risk_tier: skill.risk_tier,
      requires_confirmation: skill.requires_confirmation,
      estimated_duration_ms: skill.estimated_duration_ms
    });
  }

  if (skill.execution_method === "script") {
    steps.push({
      step_name: `execute_${skill.name}_script`,
      method: "script",
      script: skill.script_path,
      params: input.params ?? {},
      risk_tier: skill.risk_tier,
      requires_confirmation: skill.requires_confirmation,
      estimated_duration_ms: skill.estimated_duration_ms
    });
  }

  if (skill.execution_method === "mcp") {
    steps.push({
      step_name: `execute_${skill.name}_mcp`,
      method: "mcp",
      mcp_tool: skill.mcp_tool_name,
      params: input.params ?? {},
      risk_tier: skill.risk_tier,
      requires_confirmation: skill.requires_confirmation,
      estimated_duration_ms: skill.estimated_duration_ms
    });
  }

  if (skill.execution_method === "computer_use" || (skill.computer_use_fallback && skill.execution_method !== "cli")) {
    steps.push({
      step_name: `execute_${skill.name}_computer_use`,
      method: "computer_use",
      computer_use_intent: skill.computer_use_fallback ?? skill.description,
      params: input.params ?? {},
      risk_tier: skill.risk_tier,
      requires_confirmation: true,
      estimated_duration_ms: (skill.estimated_duration_ms ?? 5000) * 3
    });
  }

  if (skill.execution_method === "api") {
    steps.push({
      step_name: `execute_${skill.name}_api`,
      method: "api",
      params: input.params ?? {},
      risk_tier: skill.risk_tier,
      requires_confirmation: skill.requires_confirmation,
      estimated_duration_ms: skill.estimated_duration_ms
    });
  }

  const totalDuration = steps.reduce((sum, s) => sum + (s.estimated_duration_ms ?? 5000), 0);
  const riskSummary = skill.risk_tier === "critical" ? "Critical risk: requires explicit approval and isolated sandbox"
    : skill.risk_tier === "high" ? "High risk: confirmation required, guarded sandbox recommended"
    : skill.risk_tier === "medium" ? "Medium risk: confirmation recommended"
    : "Low risk: safe for automatic execution";

  const plan: AppControlExecutionPlan = {
    plan_id: createEntityId("appplan"),
    skill_id: input.skill_id,
    task_id: input.task_id,
    session_id: input.session_id,
    steps,
    fallback_chain: fallbackChain,
    estimated_total_duration_ms: totalDuration,
    risk_summary: riskSummary,
    created_at: nowIso()
  };

  executionPlans.set(plan.plan_id, plan);
  return plan;
}

function buildFallbackChain(skill: AppControlSkill): AppControlExecutionMethod[] {
  const chain: AppControlExecutionMethod[] = [];

  if (skill.cli_command) chain.push("cli");
  if (skill.script_path) chain.push("script");
  if (skill.mcp_capability_id && skill.mcp_tool_name) chain.push("mcp");
  chain.push("api");
  if (skill.computer_use_fallback || skill.execution_method === "computer_use") chain.push("computer_use");

  if (chain.length === 0) chain.push(skill.execution_method);

  return [...new Set(chain)];
}

export async function executeAppControlPlan(planId: string): Promise<AppControlExecutionResult> {
  const plan = executionPlans.get(planId);
  if (!plan) throw new Error(`Execution plan not found: ${planId}`);

  const skill = appControlSkills.get(plan.skill_id);
  if (!skill) throw new Error(`Skill not found: ${plan.skill_id}`);

  const startTime = Date.now();
  let stepsExecuted = 0;
  let stepsSucceeded = 0;
  let stepsFailed = 0;
  let methodUsed: AppControlExecutionMethod = skill.execution_method;
  let fallbackTriggered = false;
  let output: Record<string, unknown> | undefined;
  let error: string | undefined;

  for (const step of plan.steps) {
    stepsExecuted++;

    try {
      switch (step.method) {
        case "cli": {
          if (!step.command) {
            stepsFailed++;
            continue;
          }

          const { execFile } = await import("node:child_process");
          const { promisify } = await import("node:util");
          const execFileAsync = promisify(execFile);

          const args: string[] = [];
          for (const [key, value] of Object.entries(step.params)) {
            args.push(`--${key}`, String(value));
          }

          try {
            const { stdout, stderr } = await execFileAsync(step.command, args, { timeout: 30000 });
            stepsSucceeded++;
            output = { stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 1000) };
            methodUsed = "cli";
          } catch (cliError) {
            stepsFailed++;
            fallbackTriggered = true;

            if (skill.computer_use_fallback) {
              methodUsed = "computer_use";
            }
          }
          break;
        }
        case "script": {
          if (!step.script) {
            stepsFailed++;
            continue;
          }

          const { execFile } = await import("node:child_process");
          const { promisify } = await import("node:util");
          const execFileAsync = promisify(execFile);

          try {
            const interpreter = process.platform === "win32" ? "powershell.exe" : "bash";
            const { stdout, stderr } = await execFileAsync(interpreter, [step.script], { timeout: 30000 });
            stepsSucceeded++;
            output = { stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 1000) };
            methodUsed = "script";
          } catch (scriptError) {
            stepsFailed++;
            fallbackTriggered = true;
          }
          break;
        }
        case "mcp": {
          try {
            const { invokeMCPTool } = await import("./mcp-execution-fabric.js");
            const result = await invokeMCPTool({
              capability_id: skill.mcp_capability_id ?? "",
              tool_name: skill.mcp_tool_name ?? step.mcp_tool ?? "",
              arguments: step.params,
              task_id: plan.task_id,
              session_id: plan.session_id
            });

            if (result.status === "success") {
              stepsSucceeded++;
              output = result.result;
              methodUsed = "mcp";
            } else {
              stepsFailed++;
              fallbackTriggered = true;
              error = result.error;
            }
          } catch (mcpError) {
            stepsFailed++;
            fallbackTriggered = true;
            error = (mcpError as Error).message;
          }
          break;
        }
        case "computer_use": {
          try {
            const { createComputerUseSession, perceiveScreen, executeElementAction, buildAccessibilityTree } = await import("./computer-use-runtime.js");

            const session = createComputerUseSession({
              taskId: plan.task_id ?? createEntityId("appctrl"),
              maxSteps: 20,
              sandboxTier: skill.risk_tier === "critical" || skill.risk_tier === "high" ? "guarded_mutation" : "guarded_mutation"
            });

            const perception = await buildAccessibilityTree({ taskId: plan.task_id, sessionId: session.session_id });
            const intent = step.computer_use_intent ?? skill.description;

            stepsSucceeded++;
            output = {
              session_id: session.session_id,
              perception_elements: perception.elements.length,
              intent,
              note: "Computer use session created for intent - requires LLM-driven loop to complete"
            };
            methodUsed = "computer_use";
          } catch (cuError) {
            stepsFailed++;
            error = (cuError as Error).message;
          }
          break;
        }
        case "api": {
          stepsFailed++;
          fallbackTriggered = true;
          error = "API execution requires an external service binding and was not executed.";
          output = {
            note: "API execution skipped because no external service binding is configured.",
            required_binding: typeof step.params.api_endpoint === "string"
              ? step.params.api_endpoint
              : "app_control_api"
          };
          methodUsed = "api";
          break;
        }
        default:
          stepsFailed++;
          error = `Unknown execution method: ${step.method}`;
      }
    } catch (stepError) {
      stepsFailed++;
      error = (stepError as Error).message;
    }
  }

  const overallStatus: AppControlExecutionResult["status"] =
    stepsFailed === 0 ? "success"
    : stepsSucceeded === 0 ? "error"
    : fallbackTriggered ? "fallback"
    : "error";

  const result: AppControlExecutionResult = {
    result_id: createEntityId("appresult"),
    plan_id: planId,
    skill_id: plan.skill_id,
    status: overallStatus,
    steps_executed: stepsExecuted,
    steps_succeeded: stepsSucceeded,
    steps_failed: stepsFailed,
    method_used: methodUsed,
    fallback_triggered: fallbackTriggered,
    output,
    error,
    duration_ms: Date.now() - startTime,
    audit_recorded: true,
    executed_at: nowIso()
  };

  executionResults.set(result.result_id, result);

  try {
    log("info", "app_control_execution", {
      result_id: result.result_id,
      skill_id: plan.skill_id,
      status: result.status,
      method_used: result.method_used,
      fallback_triggered: result.fallback_triggered,
      duration_ms: result.duration_ms
    });
  } catch { /* logging failure should not affect result */ }

  return result;
}

export function getAppControlExecutionPlan(planId: string): AppControlExecutionPlan | undefined {
  return executionPlans.get(planId);
}

export function getAppControlExecutionResult(resultId: string): AppControlExecutionResult | undefined {
  return executionResults.get(resultId);
}

export function registerBuiltinAppControlSkills(): AppControlSkill[] {
  const builtin: Omit<AppControlSkill, "skill_id" | "created_at" | "updated_at">[] = [
    {
      name: "Open Application",
      description: "Launch a desktop application by name or path",
      task_family: "app_launch",
      execution_method: "cli",
      risk_tier: "medium",
      requires_confirmation: true,
      deterministic: true,
      compensable: false,
      idempotent: false,
      cli_command: process.platform === "win32" ? "powershell.exe" : "open",
      computer_use_fallback: "Open the application by clicking on its icon or menu entry",
      tags: ["app", "launch", "desktop"],
      version: "1.0.0"
    },
    {
      name: "File Explorer Navigation",
      description: "Open and navigate the file explorer to a specific path",
      task_family: "file_navigation",
      execution_method: "cli",
      risk_tier: "low",
      requires_confirmation: false,
      deterministic: true,
      compensable: false,
      idempotent: true,
      cli_command: process.platform === "win32" ? "explorer.exe" : "open",
      computer_use_fallback: "Open file explorer and navigate to the specified path",
      tags: ["files", "navigation", "explorer"],
      version: "1.0.0"
    },
    {
      name: "Web Browser Open URL",
      description: "Open a URL in the default or specified web browser",
      task_family: "web_browsing",
      execution_method: "cli",
      risk_tier: "low",
      requires_confirmation: false,
      deterministic: true,
      compensable: false,
      idempotent: true,
      cli_command: process.platform === "win32" ? "cmd.exe" : "open",
      computer_use_fallback: "Open the browser and navigate to the URL",
      tags: ["browser", "web", "url"],
      version: "1.0.0"
    },
    {
      name: "Terminal Command Execution",
      description: "Execute a command in the system terminal",
      task_family: "shell_execution",
      execution_method: "cli",
      risk_tier: "high",
      requires_confirmation: true,
      deterministic: true,
      compensable: false,
      idempotent: false,
      cli_command: process.platform === "win32" ? "cmd.exe" : "bash",
      computer_use_fallback: "Open a terminal and type the command",
      tags: ["shell", "terminal", "command", "execution"],
      version: "1.0.0"
    },
    {
      name: "Text Editor Open File",
      description: "Open a file in a text editor (VS Code, Notepad, etc.)",
      task_family: "text_editing",
      execution_method: "cli",
      risk_tier: "low",
      requires_confirmation: false,
      deterministic: true,
      compensable: false,
      idempotent: true,
      cli_command: "code",
      computer_use_fallback: "Open the text editor application and open the file",
      tags: ["editor", "text", "file", "code"],
      version: "1.0.0"
    },
    {
      name: "System Information Query",
      description: "Query system information such as OS version, disk space, memory, CPU",
      task_family: "system_info",
      execution_method: "cli",
      risk_tier: "low",
      requires_confirmation: false,
      deterministic: true,
      compensable: false,
      idempotent: true,
      cli_command: process.platform === "win32" ? "powershell.exe" : "uname",
      tags: ["system", "info", "query", "diagnostics"],
      version: "1.0.0"
    },
    {
      name: "Process Management",
      description: "List, find, or terminate running processes",
      task_family: "process_management",
      execution_method: "cli",
      risk_tier: "high",
      requires_confirmation: true,
      deterministic: true,
      compensable: false,
      idempotent: false,
      cli_command: process.platform === "win32" ? "powershell.exe" : "ps",
      computer_use_fallback: "Open Task Manager or Activity Monitor and manage the process",
      tags: ["process", "management", "kill", "list"],
      version: "1.0.0"
    },
    {
      name: "Screenshot Capture",
      description: "Capture a screenshot of the current screen or a specific region",
      task_family: "screenshot",
      execution_method: "cli",
      risk_tier: "low",
      requires_confirmation: false,
      deterministic: true,
      compensable: false,
      idempotent: true,
      cli_command: process.platform === "win32" ? "powershell.exe" : "screencapture",
      tags: ["screenshot", "capture", "screen"],
      version: "1.0.0"
    },
    {
      name: "Clipboard Operations",
      description: "Read from or write to the system clipboard",
      task_family: "clipboard",
      execution_method: "cli",
      risk_tier: "medium",
      requires_confirmation: true,
      deterministic: true,
      compensable: false,
      idempotent: true,
      cli_command: process.platform === "win32" ? "powershell.exe" : "pbcopy",
      computer_use_fallback: "Use keyboard shortcut Ctrl+C/Ctrl+V to interact with clipboard",
      tags: ["clipboard", "copy", "paste"],
      version: "1.0.0"
    },
    {
      name: "Window Management",
      description: "Minimize, maximize, restore, or close application windows",
      task_family: "window_management",
      execution_method: "computer_use",
      risk_tier: "medium",
      requires_confirmation: true,
      deterministic: false,
      compensable: false,
      idempotent: false,
      computer_use_fallback: "Use keyboard shortcuts or window controls to manage the window",
      tags: ["window", "manage", "minimize", "maximize"],
      version: "1.0.0"
    },
    {
      name: "Form Filling",
      description: "Fill in form fields in a desktop or web application",
      task_family: "form_filling",
      execution_method: "computer_use",
      risk_tier: "high",
      requires_confirmation: true,
      deterministic: false,
      compensable: true,
      idempotent: false,
      computer_use_fallback: "Locate form fields and type the required values",
      tags: ["form", "fill", "input", "data-entry"],
      version: "1.0.0"
    },
    {
      name: "Document Creation",
      description: "Create a new document in an office application",
      task_family: "document_creation",
      execution_method: "computer_use",
      risk_tier: "medium",
      requires_confirmation: true,
      deterministic: false,
      compensable: true,
      idempotent: false,
      computer_use_fallback: "Open the office application and create a new document with the specified content",
      tags: ["document", "create", "office", "word", "excel"],
      version: "1.0.0"
    }
  ];

  const registered: AppControlSkill[] = [];
  for (const spec of builtin) {
    const skill = registerAppControlSkill(spec);
    registered.push(skill);
  }

  return registered;
}
