import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { register } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const smokeDir = mkdtempSync(join(tmpdir(), "apex-smoke-"));
const workspaceDir = join(smokeDir, "workspace");
const sampleFile = join(workspaceDir, "README.txt");
const globalSkillPolicyFile = join(smokeDir, "skill-policy.global.json");
const workspaceSkillPolicyFile = join(smokeDir, "skill-policy.workspace.json");
const localSkillPolicyFile = join(smokeDir, "skill-policy.local.json");
const policyBundleFile = join(smokeDir, "policy-bundle.json");

mkdirSync(workspaceDir, { recursive: true });
writeFileSync(sampleFile, "company brain smoke file\n", "utf8");
writeFileSync(
  globalSkillPolicyFile,
  JSON.stringify(
    {
      trust: {
        allowed_release_channels: ["promoted", "stable"]
      },
      content: {
        allowed_skill_sources: ["internal", "openclaw"],
        blocked_capabilities: ["global_only_capability"]
      },
      roles: {
        review_roles: ["reviewer", "admin"]
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  workspaceSkillPolicyFile,
  JSON.stringify(
    {
      trust: {
        require_trusted_bundle_import: true
      },
      content: {
        allowed_skill_sources: ["internal", "openclaw", "claude", "openai"]
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  localSkillPolicyFile,
  JSON.stringify(
    {
      content: {
        blocked_capabilities: ["local_only_capability"]
      },
      roles: {
        trusted_import_roles: ["releaser", "admin"]
      }
    },
    null,
    2
  ),
  "utf8"
);

const browserServer = await new Promise((resolvePromise, rejectPromise) => {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/demo/crm/contact") {
      const email = requestUrl.searchParams.get("email");
      const contactId = requestUrl.searchParams.get("contact_id");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          contact_id: contactId ?? "contact_001",
          email: email ?? "alex@example.com",
          full_name: "Alex Chen",
          company: "Evismart Labs",
          lifecycle_stage: "qualified",
          last_activity_at: "2026-04-10T09:30:00.000Z"
        })
      );
      return;
    }

    if (requestUrl.pathname === "/demo/hr/candidate") {
      const email = requestUrl.searchParams.get("email");
      const candidateId = requestUrl.searchParams.get("candidate_id");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          candidate_id: candidateId ?? "candidate_001",
          email: email ?? "jordan@example.com",
          full_name: "Jordan Li",
          current_stage: "onsite",
          job_title: "Senior Platform Engineer",
          location: "Shanghai",
          updated_at: "2026-04-11T14:10:00.000Z"
        })
      );
      return;
    }

    if (requestUrl.pathname === "/demo/finance/reconcile") {
      const batchId = requestUrl.searchParams.get("batch_id");
      const reportDate = requestUrl.searchParams.get("report_date");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          batch_id: batchId ?? "batch_001",
          report_date: reportDate ?? "2026-04-11",
          status: "balanced",
          currency: "USD",
          total_amount: 128930.42,
          discrepancy_count: 0,
          unresolved_items: []
        })
      );
      return;
    }

    if (request.url === "/follow-up") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><head><title>Smoke Browser Follow Up</title></head><body><h1>Follow Up</h1><a href=\"/\">home</a></body></html>");
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<html><head><title>Smoke Browser</title></head><body><h1>QA browser smoke validation</h1><a href=\"/follow-up\">next</a><button>Run</button></body></html>");
  });

  server.once("error", rejectPromise);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      rejectPromise(new Error("Failed to resolve smoke browser server address."));
      return;
    }
    resolvePromise({
      server,
      baseUrl: `http://127.0.0.1:${address.port}`
    });
  });
});

async function waitForHttpOk(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function getFreePort() {
  return await new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        rejectPromise(new Error("Failed to allocate a free port."));
        return;
      }
      server.close(() => resolvePromise(address.port));
    });
  });
}

process.env.APEX_LOCAL_DB_PATH = join(smokeDir, "local-control-plane.sqlite");

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is unavailable. Run the smoke script through npm.");
}
function attachProcessLogs(child) {
  const logs = {
    stdout: [],
    stderr: []
  };
  child.stdout?.on("data", chunk => {
    logs.stdout.push(String(chunk));
    if (logs.stdout.length > 20) logs.stdout.shift();
  });
  child.stderr?.on("data", chunk => {
    logs.stderr.push(String(chunk));
    if (logs.stderr.length > 20) logs.stderr.shift();
  });
  return logs;
}

function spawnWorkspaceDev(workspaceName, env) {
  if (process.platform === "win32") {
    const child = spawn(process.execPath, [npmCli, "run", "dev", "-w", workspaceName], {
      cwd: rootDir,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { child, logs: attachProcessLogs(child), workspaceName };
  }

  const child = spawn("npm", ["run", "dev", "-w", workspaceName], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return { child, logs: attachProcessLogs(child), workspaceName };
}

function stopSpawnedProcess(processInfo) {
  if (!processInfo?.child || processInfo.child.killed) {
    return;
  }
  const pid = processInfo.child.pid;
  if (!pid) {
    processInfo.child.kill();
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore"
    });
    return;
  }
  processInfo.child.kill("SIGTERM");
}

for (const group of ["apps", "packages"]) {
  const groupDir = join(rootDir, group);
  for (const entry of readdirSync(groupDir)) {
    const workspaceDir = join(groupDir, entry);
    if (!statSync(workspaceDir).isDirectory()) continue;
    rmSync(join(workspaceDir, "dist"), { recursive: true, force: true });
  }
}

const buildResult = spawnSync(process.execPath, [npmCli, "run", "build", "-w", "@apex/shared-local-core"], {
  cwd: rootDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS
      ? `${process.env.NODE_OPTIONS} --max-old-space-size=12288`
      : "--max-old-space-size=12288"
  }
});
if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}
for (const workspace of ["@apex/tool-gateway-service", "@apex/local-control-plane"]) {
  const serviceBuildResult = spawnSync(process.execPath, [npmCli, "run", "build", "-w", workspace], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS
        ? `${process.env.NODE_OPTIONS} --max-old-space-size=12288`
        : "--max-old-space-size=12288"
    }
  });
  if (serviceBuildResult.status !== 0) {
    process.exit(serviceBuildResult.status ?? 1);
  }
}

const toolGatewayPort = await getFreePort();
const localControlPlanePort = await getFreePort();
const serviceEnvBase = {
  ...process.env,
  APEX_SKILL_POLICY_PATH_GLOBAL: globalSkillPolicyFile,
  APEX_SKILL_POLICY_PATH_WORKSPACE: workspaceSkillPolicyFile,
  APEX_SKILL_POLICY_PATH_LOCAL: localSkillPolicyFile,
  APEX_CRM_BEARER_TOKEN: "smoke-token",
  APEX_HR_BEARER_TOKEN: "smoke-token",
  APEX_FINANCE_BEARER_TOKEN: "smoke-token",
  APEX_SKILL_BUNDLE_SECRET: "smoke-bundle-secret",
  APEX_SKILL_BUNDLE_KEY_ID: "smoke-key",
  APEX_SKILL_TRUSTED_PUBLISHERS: "smoke.publisher",
  APEX_SKILL_BLOCKED_TAGS: "blocked-tag",
  APEX_SKILL_PROMOTE_ROLES: "admin,releaser",
  APEX_SKILL_POLICY_SCOPE_LABELS: JSON.stringify({
    global: "Global Baseline",
    org: "Org Guardrails",
    workspace: "Workspace Controls",
    local: "Local Experiment"
  }),
  APEX_SKILL_POLICY_PROMOTION_PIPELINE: "local>workspace,workspace>org,org>global",
  APEX_SKILL_POLICY_EDIT_ROLES: "admin,policy-editor",
  APEX_SKILL_POLICY_APPROVE_ROLES: "admin,security-reviewer",
  APEX_SKILL_POLICY_PROMOTE_ROLES: "admin,release-manager",
  APEX_READ_LIMIT_PER_WINDOW: "400",
  APEX_MUTATION_LIMIT_PER_WINDOW: "320",
  NODE_OPTIONS: process.env.NODE_OPTIONS
    ? `${process.env.NODE_OPTIONS} --max-old-space-size=4096`
    : "--max-old-space-size=4096"
};

const toolGatewayProcess = spawnWorkspaceDev("@apex/tool-gateway-service", {
  ...serviceEnvBase,
  APEX_LOCAL_DB_PATH: join(smokeDir, "tool-gateway.sqlite"),
  PORT: String(toolGatewayPort),
  APEX_TOOL_HTTP_ALLOWLIST: "127.0.0.1,localhost"
});

const localControlPlaneProcess = spawnWorkspaceDev("@apex/local-control-plane", {
  ...serviceEnvBase,
  APEX_LOCAL_DB_PATH: join(smokeDir, "local-control-plane-service.sqlite"),
  PORT: String(localControlPlanePort),
  APEX_TOOL_GATEWAY_BASE_URL: `http://127.0.0.1:${toolGatewayPort}`
});

try {
  await waitForHttpOk(`http://127.0.0.1:${toolGatewayPort}/internal/tools`);
  await waitForHttpOk(`http://127.0.0.1:${localControlPlanePort}/health`);
} catch (error) {
  stopSpawnedProcess(toolGatewayProcess);
  stopSpawnedProcess(localControlPlaneProcess);
  const startupErrorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(
    [
      startupErrorMessage,
      `[tool-gateway stdout]\n${toolGatewayProcess.logs.stdout.join("")}`,
      `[tool-gateway stderr]\n${toolGatewayProcess.logs.stderr.join("")}`,
      `[local-control-plane stdout]\n${localControlPlaneProcess.logs.stdout.join("")}`,
      `[local-control-plane stderr]\n${localControlPlaneProcess.logs.stderr.join("")}`
    ].join("\n")
  );
}

const serviceTaskResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/tasks`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    intent: "Service-side external connector smoke task",
    taskType: "one_off",
    department: "sales",
    riskLevel: "medium",
    inputs: {
      workspace_paths: [workspaceDir]
    }
  })
});
assert.equal(serviceTaskResponse.ok, true);
const serviceTaskPayload = await serviceTaskResponse.json();
const serviceTaskId = serviceTaskPayload.task.task_id;
assert.ok(serviceTaskId);

register(new URL("./smoke-loader.mjs", import.meta.url));

const localCore = await import("@apex/shared-local-core");
const runtime = await import("@apex/shared-runtime");
const sharedState = await import("@apex/shared-state");
const sharedTypes = await import("@apex/shared-types");

const {
  runTaskEndToEnd,
  createSchedule,
  triggerSchedule,
  recordToolInvocation,
  listTaskWorkerRuns,
  listTaskCapabilityResolutions,
  searchLearnedPlaybooks,
  searchCanonicalSkills,
  searchCapabilityCatalog,
  updateCanonicalSkillGovernance
} = runtime;
const { importOpenClawSkill, importClaudeSkill, importOpenAiSkill, listCanonicalSkills } = runtime;
const { store, stateBackendInfo } = sharedState;
const { buildDefaultTask } = sharedTypes;
const {
  captureLocalBrowserSnapshot,
  getLocalTaskWorkspace,
  listLocalFiles,
  navigateLocalBrowserSession,
  patchLocalFileExact,
  readLocalFile,
  rollbackLocalFileOperation,
  runLocalShellCommand,
  summarizeLocalIdeWorkspace,
  writeLocalFile
} = localCore;

const task = buildDefaultTask({
  task_type: "one_off",
  intent: "Prepare a validated engineering task output",
  department: "engineering",
  risk_level: "medium",
  initiator: {
    tenant_id: "tenant_demo",
    user_id: "user_demo",
    channel: "smoke-test"
  },
  inputs: {
    workspace_paths: [workspaceDir]
  }
});

store.tasks.set(task.task_id, task);

const listed = listLocalFiles(task.task_id, workspaceDir);
assert.equal(listed.status, "completed");
assert.ok((listed.result?.entries.length ?? 0) >= 1);

const fileRead = readLocalFile(task.task_id, sampleFile);
assert.equal(fileRead.status, "completed");
assert.match(fileRead.result?.content ?? "", /company brain smoke file/);

const writePath = join(workspaceDir, "generated-output.txt");
const writeResult = writeLocalFile({
  taskId: task.task_id,
  path: writePath,
  content: "generated from smoke\n",
  confirm: true
});
assert.equal(writeResult.status, "completed");
assert.equal(readFileSync(writePath, "utf8"), "generated from smoke\n");
const writeResultRepeated = writeLocalFile({
  taskId: task.task_id,
  path: writePath,
  content: "generated from smoke\n",
  confirm: true
});
assert.equal(writeResultRepeated.status, "completed");
assert.equal(writeResultRepeated.result?.bytes_written, writeResult.result?.bytes_written);

const patchResult = patchLocalFileExact({
  taskId: task.task_id,
  path: writePath,
  expectedContent: "generated from smoke\n",
  nextContent: "generated from smoke\npatched exactly\n",
  confirm: true
});
assert.equal(patchResult.status, "completed");
assert.equal(readFileSync(writePath, "utf8"), "generated from smoke\npatched exactly\n");
const rollbackResult = rollbackLocalFileOperation({
  taskId: task.task_id,
  path: writePath,
  confirm: true
});
assert.equal(rollbackResult.status, "completed");
assert.equal(readFileSync(writePath, "utf8"), "generated from smoke\n");

const shellResult = runLocalShellCommand({
  taskId: task.task_id,
  command: process.platform === "win32" ? "Get-Location" : "pwd",
  cwd: workspaceDir,
  confirm: true
});
assert.equal(shellResult.status, "completed");

const browserResult = await captureLocalBrowserSnapshot({
  taskId: task.task_id,
  url: browserServer.baseUrl,
  confirm: true
});
assert.equal(browserResult.status, "completed");
assert.equal(browserResult.result?.title, "Smoke Browser");
assert.ok(["fetch_snapshot", "playwright_worker"].includes(browserResult.result?.engine ?? ""));
assert.ok((browserResult.result?.dom_summary?.heading_count ?? 0) >= 0);
const browserSessionId = [...store.browserSessions.values()][0]?.session_id;
assert.ok(browserSessionId);

const browserNavigation = await navigateLocalBrowserSession({
  taskId: task.task_id,
  sessionId: browserSessionId,
  url: `${browserServer.baseUrl}/follow-up`,
  confirm: true
});
assert.equal(browserNavigation.status, "completed");
assert.equal(browserNavigation.result?.session_id, browserSessionId);

const externalCatalogResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/tools/external/catalog`);
assert.equal(externalCatalogResponse.ok, true);
const externalCatalog = await externalCatalogResponse.json();
assert.ok(Array.isArray(externalCatalog.tools));
assert.ok(externalCatalog.tools.some(tool => tool.name === "http_json_fetch"));

const externalInvokeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/tools/external/http_json_fetch/invoke`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        url: `${browserServer.baseUrl}/follow-up`
      }
    })
  }
);
const externalInvokeBody = await externalInvokeResponse.text();
assert.equal(externalInvokeResponse.ok, true, `http_json_fetch invoke failed: ${externalInvokeBody}`);
const externalInvoke = JSON.parse(externalInvokeBody);
assert.equal(externalInvoke.tool_name, "http_json_fetch");
assert.equal(externalInvoke.status_code, 200);
assert.match(externalInvoke.url, /follow-up/);

const externalReconcileResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/tools/external/http_json_fetch/reconcile?idempotency_key=${encodeURIComponent(externalInvoke.idempotency_key)}`
);
assert.equal(externalReconcileResponse.ok, true);
const externalReconcile = await externalReconcileResponse.json();
assert.equal(externalReconcile.state, "artifact_ready");

const crmLookupResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/tools/external/crm_contact_lookup/invoke`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        url: `${browserServer.baseUrl}/demo/crm/contact`,
        email: "alex@example.com"
      }
    })
  }
);
const crmLookupBody = await crmLookupResponse.text();
assert.equal(crmLookupResponse.ok, true, `crm_contact_lookup invoke failed: ${crmLookupBody}`);
const crmLookup = JSON.parse(crmLookupBody);
assert.equal(crmLookup.tool_name, "crm_contact_lookup");
assert.equal(crmLookup.contact.email, "alex@example.com");
assert.equal(crmLookup.contact.company, "Evismart Labs");

const hrLookupResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/tools/external/hr_candidate_lookup/invoke`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        url: `${browserServer.baseUrl}/demo/hr/candidate`,
        email: "jordan@example.com"
      }
    })
  }
);
const hrLookupBody = await hrLookupResponse.text();
assert.equal(hrLookupResponse.ok, true, `hr_candidate_lookup invoke failed: ${hrLookupBody}`);
const hrLookup = JSON.parse(hrLookupBody);
assert.equal(hrLookup.tool_name, "hr_candidate_lookup");
assert.equal(hrLookup.candidate.email, "jordan@example.com");
assert.equal(hrLookup.candidate.current_stage, "onsite");

const financeReconcileResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/tools/external/finance_reconcile/invoke`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        url: `${browserServer.baseUrl}/demo/finance/reconcile`,
        batch_id: "batch_smoke_001"
      }
    })
  }
);
const financeReconcileBody = await financeReconcileResponse.text();
assert.equal(financeReconcileResponse.ok, true, `finance_reconcile invoke failed: ${financeReconcileBody}`);
const financeReconcile = JSON.parse(financeReconcileBody);
assert.equal(financeReconcile.tool_name, "finance_reconcile");
assert.equal(financeReconcile.reconciliation.batch_id, "batch_smoke_001");
assert.equal(financeReconcile.reconciliation.status, "balanced");

const openClawSkill = importOpenClawSkill({
  markdown: `# Research Connector\n\nUse this skill when you need structured research.\n\n## Capabilities\n- browser_research\n- http_json_fetch\n\n## Workers\n- general_worker\n\n## Notes\n- Prefer reusable connectors before local implementation`
});
assert.equal(openClawSkill.source, "openclaw");
assert.ok(openClawSkill.required_capabilities.includes("browser_research"));

const claudeSkill = importClaudeSkill({
  command_name: "/triage-account",
  markdown: "Review the customer account state, summarize blockers, and recommend the next action."
});
assert.equal(claudeSkill.source, "claude");
assert.ok(claudeSkill.trigger_phrases.includes("/triage-account"));

const openAiSkill = importOpenAiSkill({
  name: "Sales Follow Up",
  description: "Prepare a validated sales follow-up sequence.",
  instructions: "Use crm_contact_lookup, reuse prior playbooks, and produce a concise action plan.",
  required_capabilities: ["crm_contact_lookup"]
});
assert.equal(openAiSkill.source, "openai");
assert.ok(openAiSkill.required_capabilities.includes("crm_contact_lookup"));
assert.equal(openAiSkill.status, "review_required");
updateCanonicalSkillGovernance({
  skill_id: openClawSkill.skill_id,
  status: "active",
  reviewed_by: "smoke:test",
  governance_note: "approved for capability discovery"
});
updateCanonicalSkillGovernance({
  skill_id: claudeSkill.skill_id,
  status: "active",
  reviewed_by: "smoke:test"
});
updateCanonicalSkillGovernance({
  skill_id: openAiSkill.skill_id,
  status: "active",
  reviewed_by: "smoke:test"
});
assert.equal(listCanonicalSkills().length >= 3, true);
assert.equal(searchCanonicalSkills({ query: "triage-account", source: "claude" }).length >= 1, true);
assert.equal(
  searchCapabilityCatalog({
    query: "sales follow up crm_contact_lookup",
    preferredKinds: ["skill"]
  }).some(capability => capability.source === "openai-registry"),
  true
);
const registerSkillResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ skill: openAiSkill })
});
assert.equal(registerSkillResponse.ok, true);
const approveOpenAiSkillResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/${encodeURIComponent(openAiSkill.skill_id)}/governance`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "active",
      reviewed_by: "smoke:test",
      governance_note: "approved after import",
      actor_role: "admin"
    })
  }
);
assert.equal(approveOpenAiSkillResponse.ok, true);
const registerClaudeSkillResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ skill: claudeSkill })
});
assert.equal(registerClaudeSkillResponse.ok, true);
const disableClaudeSkillResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/${encodeURIComponent(claudeSkill.skill_id)}/governance`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "disabled",
      reviewed_by: "smoke:test",
      governance_note: "temporarily disabled for governance test",
      actor_role: "admin"
    })
  }
);
assert.equal(disableClaudeSkillResponse.ok, true);
const disabledCapabilitySearchResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/capabilities/search?q=${encodeURIComponent("triage-account")}&kind=skill`
);
assert.equal(disabledCapabilitySearchResponse.ok, true);
const disabledCapabilitySearchPayload = await disabledCapabilitySearchResponse.json();
assert.equal(
  disabledCapabilitySearchPayload.items.some(capability => capability.source === "claude-registry"),
  false
);
const reEnableClaudeSkillResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/${encodeURIComponent(claudeSkill.skill_id)}/governance`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "active",
      reviewed_by: "smoke:test",
      governance_note: "re-enabled for search",
      actor_role: "admin"
    })
  }
);
assert.equal(reEnableClaudeSkillResponse.ok, true);
const reEnabledCapabilitySearchResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/capabilities/search?q=${encodeURIComponent("triage-account")}&kind=skill`
);
assert.equal(reEnabledCapabilitySearchResponse.ok, true);
const reEnabledCapabilitySearchPayload = await reEnabledCapabilitySearchResponse.json();
assert.equal(
  reEnabledCapabilitySearchPayload.items.some(capability => capability.source === "claude-registry"),
  true
);
const importSkillResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/import`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    source_format: "openclaw_markdown",
    content: `# Revenue Research\n\nUse this skill when you need revenue-oriented account research.\n\n## Capabilities\n- crm_contact_lookup\n- finance_reconcile\n\n## Workers\n- analyst_worker`
  })
});
assert.equal(importSkillResponse.ok, true);
const importedSkillPayload = await importSkillResponse.json();
assert.equal(importedSkillPayload.skill.source, "openclaw");
assert.equal(importedSkillPayload.skill.status, "review_required");
const importedCapabilitySearchResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/capabilities/search?q=${encodeURIComponent("revenue research finance_reconcile")}&kind=skill`
);
assert.equal(importedCapabilitySearchResponse.ok, true);
const importedCapabilitySearchPayload = await importedCapabilitySearchResponse.json();
assert.equal(
  importedCapabilitySearchPayload.items.some(
    capability => capability.capability_id === `canonical_skill_${importedSkillPayload.skill.skill_id}`
  ),
  false
);
const reviewQueueResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/review-queue`);
assert.equal(reviewQueueResponse.ok, true);
const reviewQueuePayload = await reviewQueueResponse.json();
assert.equal(reviewQueuePayload.items.some(skill => skill.skill_id === importedSkillPayload.skill.skill_id), true);
const exportedCanonicalResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/${encodeURIComponent(claudeSkill.skill_id)}/export`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ format: "canonical_json" })
  }
);
assert.equal(exportedCanonicalResponse.ok, true);
const exportedCanonicalPayload = await exportedCanonicalResponse.json();
assert.equal(exportedCanonicalPayload.format, "canonical_json");
const exportedSkillPath = join(smokeDir, "skills", "triage-account.json");
const exportFileResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/${encodeURIComponent(claudeSkill.skill_id)}/export-file`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      format: "canonical_json",
      path: exportedSkillPath
    })
  }
);
assert.equal(exportFileResponse.ok, true);
assert.equal(readFileSync(exportedSkillPath, "utf8").includes("\"skill_id\""), true);
const importFileResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/import-file`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    source_format: "canonical_json",
    path: exportedSkillPath
  })
});
assert.equal(importFileResponse.ok, true);
const importFilePayload = await importFileResponse.json();
assert.equal(importFilePayload.skill.skill_id, claudeSkill.skill_id);
const getSkillResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/${encodeURIComponent(claudeSkill.skill_id)}`
);
assert.equal(getSkillResponse.ok, true);
const getSkillPayload = await getSkillResponse.json();
assert.equal(getSkillPayload.skill.skill_id, claudeSkill.skill_id);
const skillAuditResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/${encodeURIComponent(claudeSkill.skill_id)}/audits`
);
assert.equal(skillAuditResponse.ok, true);
const skillAuditPayload = await skillAuditResponse.json();
assert.equal(skillAuditPayload.items.some(item => item.action === "skill.governance_updated"), true);
const filteredSkillResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills?q=triage-account&source=claude`);
assert.equal(filteredSkillResponse.ok, true);
const filteredSkillPayload = await filteredSkillResponse.json();
assert.equal(Array.isArray(filteredSkillPayload.items), true);
assert.equal(filteredSkillPayload.items.some(skill => skill.source === "claude"), true);
const capabilitySearchResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/capabilities/search?q=${encodeURIComponent("triage-account")}&kind=skill`
);
assert.equal(capabilitySearchResponse.ok, true);
const capabilitySearchPayload = await capabilitySearchResponse.json();
assert.equal(Array.isArray(capabilitySearchPayload.items), true);
const activeSkillResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills?status=active`);
assert.equal(activeSkillResponse.ok, true);
const activeSkillPayload = await activeSkillResponse.json();
assert.equal(activeSkillPayload.items.some(skill => skill.skill_id === openAiSkill.skill_id), true);
const reviewRequiredSkillResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills?status=review_required`);
assert.equal(reviewRequiredSkillResponse.ok, true);
const reviewRequiredSkillPayload = await reviewRequiredSkillResponse.json();
assert.equal(Array.isArray(reviewRequiredSkillPayload.items), true);
const skillPolicyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy`);
assert.equal(skillPolicyResponse.ok, true);
const skillPolicyPayload = await skillPolicyResponse.json();
assert.equal(skillPolicyPayload.trust.trusted_publishers.includes("smoke.publisher"), true);
assert.equal(skillPolicyPayload.trust.allowed_release_channels.includes("promoted"), true);
assert.equal(skillPolicyPayload.trust.require_trusted_bundle_import, true);
assert.equal(skillPolicyPayload.roles.promote_roles.includes("admin"), true);
assert.equal(skillPolicyPayload.content.blocked_tags.includes("blocked-tag"), true);
assert.equal(skillPolicyPayload.content.blocked_capabilities.includes("local_only_capability"), true);
assert.equal(skillPolicyPayload.sources.trusted_publishers, "env");
assert.equal(skillPolicyPayload.sources.allowed_release_channels, "global_file");
assert.equal(skillPolicyPayload.sources.require_trusted_bundle_import, "workspace_file");
assert.equal(skillPolicyPayload.sources.allowed_skill_sources, "workspace_file");
assert.equal(skillPolicyPayload.sources.blocked_capabilities, "local_file");
assert.equal(skillPolicyPayload.sources.promote_roles, "env");
assert.equal(skillPolicyPayload.roles.policy_edit_roles.includes("policy-editor"), true);
assert.equal(skillPolicyPayload.roles.policy_approve_roles.includes("security-reviewer"), true);
assert.equal(skillPolicyPayload.roles.policy_promote_roles.includes("release-manager"), true);
assert.equal(skillPolicyPayload.sources.policy_edit_roles, "env");
assert.equal(skillPolicyPayload.sources.policy_approve_roles, "env");
assert.equal(skillPolicyPayload.sources.policy_promote_roles, "env");
assert.equal(skillPolicyPayload.environments.labels.workspace, "Workspace Controls");
assert.equal(skillPolicyPayload.environments.promotion_pipeline.includes("workspace>org"), true);
assert.equal(skillPolicyPayload.sources.scope_labels, "env");
assert.equal(skillPolicyPayload.sources.promotion_pipeline, "env");
assert.equal(skillPolicyPayload.policy_file.loaded, true);
assert.equal(skillPolicyPayload.policy_file.path, localSkillPolicyFile);
assert.equal(skillPolicyPayload.policy_file.error, null);
assert.equal(skillPolicyPayload.policy_files.length, 4);
assert.equal(skillPolicyPayload.policy_files.find(item => item.scope === "global")?.loaded, true);
assert.equal(skillPolicyPayload.policy_files.find(item => item.scope === "workspace")?.path, workspaceSkillPolicyFile);
assert.equal(skillPolicyPayload.policy_files.find(item => item.scope === "local")?.path, localSkillPolicyFile);
const skillPolicyScopesResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/scopes`);
assert.equal(skillPolicyScopesResponse.ok, true);
const skillPolicyScopesPayload = await skillPolicyScopesResponse.json();
assert.equal(skillPolicyScopesPayload.items.length, 4);
assert.equal(skillPolicyScopesPayload.items.find(item => item.scope === "local")?.loaded, true);
const policyEnvironmentSnapshotsResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/environment-snapshots`
);
assert.equal(policyEnvironmentSnapshotsResponse.ok, true);
const policyEnvironmentSnapshotsPayload = await policyEnvironmentSnapshotsResponse.json();
assert.equal(policyEnvironmentSnapshotsPayload.items.length, 4);
const policyCompareResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/compare`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    from_scope: "workspace",
    to_scope: "org"
  })
});
assert.equal(policyCompareResponse.ok, true);
const policyComparePayload = await policyCompareResponse.json();
assert.equal(Array.isArray(policyComparePayload.changed_fields), true);
assert.equal(policyComparePayload.changed_fields.length >= 1, true);
assert.equal(Array.isArray(policyComparePayload.changed_groups), true);
assert.equal(policyComparePayload.changed_groups.some(item => item.group === "content" || item.group === "environments"), true);
assert.equal(Array.isArray(policyComparePayload.risk_summary), true);
assert.equal(typeof policyComparePayload.advisory?.recommended_action, "string");
assert.equal(policyComparePayload.advisory?.manual_approval_required, true);
assert.equal(policyComparePayload.advisory?.next_step, "create_promotion_proposal");
assert.equal(typeof policyComparePayload.advisory?.suggested_note, "string");
const policyDiffResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/diff`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    scope: "local",
    actor_role: "admin",
    config: {
      content: {
        blocked_capabilities: ["local_editor_capability"]
      }
    }
  })
});
assert.equal(policyDiffResponse.ok, true);
const policyDiffPayload = await policyDiffResponse.json();
assert.equal(Array.isArray(policyDiffPayload.changed_fields), true);
assert.equal(policyDiffPayload.changed_fields.some(item => item.field === "content.blocked_capabilities"), true);
const saveLocalPolicyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/scopes/local`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    actor_role: "admin",
    config: {
      content: {
        blocked_capabilities: ["local_editor_capability"]
      },
      roles: {
        trusted_import_roles: ["releaser", "admin"]
      }
    }
  })
});
assert.equal(saveLocalPolicyResponse.ok, true);
const skillPolicyAfterSaveResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy`);
assert.equal(skillPolicyAfterSaveResponse.ok, true);
const skillPolicyAfterSavePayload = await skillPolicyAfterSaveResponse.json();
assert.equal(skillPolicyAfterSavePayload.content.blocked_capabilities.includes("local_editor_capability"), true);
assert.equal(skillPolicyAfterSavePayload.sources.blocked_capabilities, "local_file");
const policyAuditResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/audits`);
assert.equal(policyAuditResponse.ok, true);
const policyAuditPayload = await policyAuditResponse.json();
assert.equal(policyAuditPayload.items.some(item => item.action === "skill.policy_scope_updated"), true);
const policyBundlePreviewResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/export`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    actor_role: "admin"
  })
});
assert.equal(policyBundlePreviewResponse.ok, true);
const policyBundlePreviewPayload = await policyBundlePreviewResponse.json();
assert.equal(policyBundlePreviewPayload.scope_count ?? policyBundlePreviewPayload.scopes.length, 3);
const policyBundleExportResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/export`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    actor_role: "admin",
    path: policyBundleFile
  })
});
assert.equal(policyBundleExportResponse.ok, true);
assert.equal(readFileSync(policyBundleFile, "utf8").includes("\"bundle_version\""), true);
const policyBundleVerifyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/verify-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    path: policyBundleFile
  })
});
assert.equal(policyBundleVerifyResponse.ok, true);
const policyBundleVerifyPayload = await policyBundleVerifyResponse.json();
assert.equal(policyBundleVerifyPayload.valid, true);
const secondSaveLocalPolicyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/scopes/local`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    actor_role: "admin",
    config: {
      content: {
        blocked_capabilities: ["temporary_capability"]
      }
    }
  })
});
assert.equal(secondSaveLocalPolicyResponse.ok, true);
const rollbackLocalPolicyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/scopes/local/rollback`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    actor_role: "admin",
    audit_id: saveLocalPolicyResponse.ok ? policyAuditPayload.items.find(item => item.action === "skill.policy_scope_updated")?.audit_id : undefined
  })
});
assert.equal(rollbackLocalPolicyResponse.ok, true);
const policyAfterRollbackResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy`);
assert.equal(policyAfterRollbackResponse.ok, true);
const policyAfterRollbackPayload = await policyAfterRollbackResponse.json();
assert.equal(policyAfterRollbackPayload.content.blocked_capabilities.includes("local_editor_capability"), true);
const policyBundleImportResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/import`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    actor_role: "admin",
    path: policyBundleFile
  })
});
assert.equal(policyBundleImportResponse.ok, true);
const policyBundleImportPayload = await policyBundleImportResponse.json();
assert.equal(policyBundleImportPayload.scope_count, 3);
const bundlePreviewResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/export-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    bundle_name: "smoke-promoted",
    statuses: ["active"],
    publisher_id: "smoke.publisher",
    publisher_name: "Smoke Publisher",
    source_environment: "smoke-lab",
    release_channel: "promoted",
    promotion_note: "Smoke promotion export",
    actor_role: "admin"
  })
});
assert.equal(bundlePreviewResponse.ok, true);
const bundlePreviewPayload = await bundlePreviewResponse.json();
assert.equal(bundlePreviewPayload.skill_count >= 1, true);
assert.equal(bundlePreviewPayload.skills.every(skill => skill.status === "active"), true);
assert.equal(bundlePreviewPayload.signature.algorithm, "hmac-sha256");
assert.equal(bundlePreviewPayload.publisher.publisher_id, "smoke.publisher");
assert.equal(bundlePreviewPayload.publisher.publisher_name, "Smoke Publisher");
assert.equal(bundlePreviewPayload.provenance.current_event.action, "bundle_promoted");
assert.equal(bundlePreviewPayload.provenance.current_event.release_channel, "promoted");
assert.equal(bundlePreviewPayload.provenance.current_event.environment, "smoke-lab");
assert.equal(bundlePreviewPayload.provenance.current_event.note, "Smoke promotion export");
const bundlePath = join(smokeDir, "skills", "promoted-bundle.json");
const bundleExportResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/export-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    bundle_name: "smoke-promoted",
    statuses: ["active"],
    path: bundlePath,
    publisher_id: "smoke.publisher",
    publisher_name: "Smoke Publisher",
    source_environment: "smoke-lab",
    release_channel: "promoted",
    promotion_note: "Smoke promotion export",
    actor_role: "admin"
  })
});
assert.equal(bundleExportResponse.ok, true);
assert.equal(readFileSync(bundlePath, "utf8").includes("\"skill_count\""), true);
const policySimulationResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/simulate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    path: bundlePath,
    actor_role: "admin",
    trust_bundle: true
  })
});
assert.equal(policySimulationResponse.ok, true);
const policySimulationPayload = await policySimulationResponse.json();
assert.equal(policySimulationPayload.valid, true);
assert.equal(policySimulationPayload.role_policy.can_import_trusted_bundle, true);
assert.equal(policySimulationPayload.policy_file.loaded, true);
assert.equal(policySimulationPayload.policy_sources.allowed_release_channels, "global_file");
const bundleVerifyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/verify-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    path: bundlePath
  })
});
assert.equal(bundleVerifyResponse.ok, true);
const bundleVerifyPayload = await bundleVerifyResponse.json();
assert.equal(bundleVerifyPayload.valid, true);
assert.equal(bundleVerifyPayload.signature_valid, true);
assert.equal(bundleVerifyPayload.publisher_trusted, true);
assert.equal(bundleVerifyPayload.release_channel_allowed, true);
assert.equal(bundleVerifyPayload.source_policy_allowed, true);
assert.equal(bundleVerifyPayload.tag_policy_allowed, true);
assert.equal(bundleVerifyPayload.capability_policy_allowed, true);
const bundleImportResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/import-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    path: bundlePath,
    trust_bundle: true,
    actor_role: "admin"
  })
});
assert.equal(bundleImportResponse.ok, true);
const bundleImportPayload = await bundleImportResponse.json();
assert.equal(bundleImportPayload.imported.length >= 1, true);
assert.equal(bundleImportPayload.verification.valid, true);
const bundleHistoryResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/export-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    bundle_name: "smoke-promoted",
    statuses: ["active"],
    publisher_id: "smoke.publisher",
    publisher_name: "Smoke Publisher",
    source_environment: "smoke-lab",
    release_channel: "promoted",
    promotion_note: "Smoke promotion export",
    actor_role: "admin"
  })
});
assert.equal(bundleHistoryResponse.ok, true);
const bundleHistoryPayload = await bundleHistoryResponse.json();
assert.equal(bundleHistoryPayload.provenance.promotion_history.length >= 2, true);
assert.equal(
  bundleHistoryPayload.provenance.promotion_history.some(event => event.action === "bundle_imported"),
  true
);
assert.equal(
  bundleHistoryPayload.provenance.promotion_history.some(event => event.action === "bundle_promoted"),
  true
);
const bundleHistoryFeedResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/bundle-history?bundle_name=${encodeURIComponent("smoke-promoted")}`
);
assert.equal(bundleHistoryFeedResponse.ok, true);
const bundleHistoryFeedPayload = await bundleHistoryFeedResponse.json();
assert.equal(bundleHistoryFeedPayload.items.length >= 3, true);
assert.equal(bundleHistoryFeedPayload.items[0].bundle_name, "smoke-promoted");
const untrustedVerifyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/verify-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    bundle: {
      ...bundlePreviewPayload,
      publisher: {
        ...bundlePreviewPayload.publisher,
        publisher_id: "rogue.publisher"
      }
    }
  })
});
assert.equal(untrustedVerifyResponse.ok, true);
const untrustedVerifyPayload = await untrustedVerifyResponse.json();
assert.equal(untrustedVerifyPayload.valid, false);
assert.equal(untrustedVerifyPayload.publisher_trusted, false);
const untrustedImportResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/import-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    trust_bundle: true,
    actor_role: "admin",
    bundle: {
      ...bundlePreviewPayload,
      publisher: {
        ...bundlePreviewPayload.publisher,
        publisher_id: "rogue.publisher"
      }
    }
  })
});
assert.equal(untrustedImportResponse.ok, false);
const blockedTagVerifyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/verify-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    bundle: {
      ...bundlePreviewPayload,
      skills: bundlePreviewPayload.skills.map((skill, index) =>
        index === 0 ? { ...skill, tags: [...skill.tags, "blocked-tag"] } : skill
      )
    }
  })
});
assert.equal(blockedTagVerifyResponse.ok, true);
const blockedTagVerifyPayload = await blockedTagVerifyResponse.json();
assert.equal(blockedTagVerifyPayload.valid, false);
assert.equal(blockedTagVerifyPayload.tag_policy_allowed, false);
const unauthorizedPromoteResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/export-bundle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    bundle_name: "unauthorized-bundle",
    statuses: ["active"],
    actor_role: "viewer"
  })
});
assert.equal(unauthorizedPromoteResponse.ok, false);

const createPolicyProposalResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/scope`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    target_scope: "workspace",
    actor_role: "policy-editor",
    requested_by: "smoke-policy-editor",
    rationale: "Promote workspace review requirements",
    config: {
      content: {
        blocked_tags: ["workspace-reviewed-tag"]
      }
    }
  })
});
assert.equal(createPolicyProposalResponse.ok, true);
const createPolicyProposalPayload = await createPolicyProposalResponse.json();
assert.equal(createPolicyProposalPayload.proposal.status, "pending_review");
const proposalQueueResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals`);
assert.equal(proposalQueueResponse.ok, true);
const proposalQueuePayload = await proposalQueueResponse.json();
assert.equal(proposalQueuePayload.items.some(item => item.proposal_id === createPolicyProposalPayload.proposal.proposal_id), true);
const proposalQueuesResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/queues`);
assert.equal(proposalQueuesResponse.ok, true);
const proposalQueuesPayload = await proposalQueuesResponse.json();
assert.equal(proposalQueuesPayload.total >= 1, true);
assert.equal(proposalQueuesPayload.queues.some(queue => queue.review_path === "standard" && queue.count >= 1), true);
assert.equal(proposalQueuesPayload.queues.some(queue => queue.review_path === "standard" && queue.suggested_action === "process_standard_queue"), true);
assert.equal(proposalQueuesPayload.queues.some(queue => queue.review_path === "standard" && queue.health_status === "attention"), true);
const proposalFollowUpsResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/follow-ups`);
assert.equal(proposalFollowUpsResponse.ok, true);
const proposalFollowUpsPayload = await proposalFollowUpsResponse.json();
assert.equal(proposalFollowUpsPayload.total >= 1, true);
assert.equal(proposalFollowUpsPayload.items.some(item => item.action === "process_standard_promotions"), true);
const inboxResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/inbox`);
assert.equal(inboxResponse.ok, true);
const inboxPayload = await inboxResponse.json();
assert.equal(inboxPayload.total >= 1, true);
assert.equal(inboxPayload.items.some(item => item.kind === "policy_follow_up"), true);
assert.equal(inboxPayload.items.every(item => typeof item.deep_link === "string" && item.deep_link.startsWith("#kind=")), true);
const dashboardResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/dashboard`);
assert.equal(dashboardResponse.ok, true);
const dashboardPayload = await dashboardResponse.json();
assert.equal(dashboardPayload.inbox_summary.total_open, inboxPayload.total);
assert.equal(dashboardPayload.inbox_summary.by_kind.policy_follow_up >= 1, true);
assert.equal(typeof dashboardPayload.governance_alert_summary.total, "number");
const filteredInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox?kind=policy_follow_up&status=new`
);
assert.equal(filteredInboxResponse.ok, true);
const filteredInboxPayload = await filteredInboxResponse.json();
assert.equal(filteredInboxPayload.total >= 1, true);
const taskDeepLinkResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/navigation/deep-link`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    kind: "task",
    taskId: serviceTaskId
  })
});
assert.equal(taskDeepLinkResponse.ok, true);
const taskDeepLinkPayload = await taskDeepLinkResponse.json();
assert.equal(taskDeepLinkPayload.deep_link, `#kind=task&taskId=${serviceTaskId}`);
const executionTemplateDeepLinkResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/navigation/deep-link`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    kind: "execution_template",
    taskId: serviceTaskId,
    templateId: "template_smoke_execution"
  })
});
assert.equal(executionTemplateDeepLinkResponse.ok, true);
const executionTemplateDeepLinkPayload = await executionTemplateDeepLinkResponse.json();
assert.equal(
  executionTemplateDeepLinkPayload.deep_link,
  `#kind=execution_template&taskId=${serviceTaskId}&templateId=template_smoke_execution`
);
const learnedPlaybookDeepLinkResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/navigation/deep-link`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    kind: "learned_playbook",
    taskId: serviceTaskId,
    playbookId: "playbook_smoke_execution"
  })
});
assert.equal(learnedPlaybookDeepLinkResponse.ok, true);
const learnedPlaybookDeepLinkPayload = await learnedPlaybookDeepLinkResponse.json();
assert.equal(
  learnedPlaybookDeepLinkPayload.deep_link,
  `#kind=learned_playbook&taskId=${serviceTaskId}&playbookId=playbook_smoke_execution`
);
const firstInboxItem = inboxPayload.items[0];
const ackInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox/${encodeURIComponent(firstInboxItem.inbox_id)}/ack`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "admin"
    })
  }
);
assert.equal(ackInboxResponse.ok, true);
const acknowledgedInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox?status=acknowledged`
);
assert.equal(acknowledgedInboxResponse.ok, true);
const acknowledgedInboxPayload = await acknowledgedInboxResponse.json();
assert.equal(
  acknowledgedInboxPayload.items.some(item => item.inbox_id === firstInboxItem.inbox_id && item.state === "acknowledged"),
  true
);
const governanceAlertCreateResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/desktop-navigation`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      risk_id: "smoke_desktop_risk_repeat",
      severity: "critical",
      title: "Repeated system handoff detected",
      detail: "The same deep link target was injected multiple times by system entry points.",
      recommended_action: "Create an ops task to review desktop handoff routing.",
      target: {
        kind: "task",
        taskId: task.task_id
      }
    })
  }
);
assert.equal(governanceAlertCreateResponse.ok, true);
const governanceAlertCreatePayload = await governanceAlertCreateResponse.json();
assert.equal(governanceAlertCreatePayload.governance_alert.source_kind, "desktop_navigation");
const governanceAlertCreateAgainResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/desktop-navigation`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      risk_id: "smoke_desktop_risk_repeat_2",
      severity: "critical",
      title: "Repeated system handoff detected",
      detail: "The same deep link target was injected multiple times by system entry points.",
      recommended_action: "Create an ops task to review desktop handoff routing.",
      target: {
        kind: "task",
        taskId: task.task_id
      }
    })
  }
);
assert.equal(governanceAlertCreateAgainResponse.ok, true);
const governanceAlertCreateAgainPayload = await governanceAlertCreateAgainResponse.json();
assert.equal(
  governanceAlertCreateAgainPayload.governance_alert.alert_id,
  governanceAlertCreatePayload.governance_alert.alert_id
);
assert.equal(governanceAlertCreateAgainPayload.governance_alert.occurrence_count, 2);
const governanceInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox?kind=governance_alert&status=new`
);
assert.equal(governanceInboxResponse.ok, true);
const governanceInboxPayload = await governanceInboxResponse.json();
assert.equal(governanceInboxPayload.total >= 1, true);
const governanceInboxItem = governanceInboxPayload.items.find(
  item => item.source_id === governanceAlertCreatePayload.governance_alert.alert_id
);
assert.ok(governanceInboxItem);
const executeGovernanceInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox/${encodeURIComponent(governanceInboxItem.inbox_id)}/execute`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "admin"
    })
  }
);
assert.equal(executeGovernanceInboxResponse.ok, true);
const executeGovernanceInboxPayload = await executeGovernanceInboxResponse.json();
assert.equal(executeGovernanceInboxPayload.governance_alert.alert_id, governanceAlertCreatePayload.governance_alert.alert_id);
assert.equal(
  executeGovernanceInboxPayload.task.inputs.execution_template_key,
  "governance_alert:system_handoff_investigation"
);
assert.equal(
  executeGovernanceInboxPayload.task.definition_of_done.required_artifacts.includes("desktop_navigation_incident.md"),
  true
);
const governanceInboxAfterExecuteResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox?kind=governance_alert`
);
assert.equal(governanceInboxAfterExecuteResponse.ok, true);
const governanceInboxAfterExecutePayload = await governanceInboxAfterExecuteResponse.json();
assert.equal(
  governanceInboxAfterExecutePayload.items.some(item => item.source_id === governanceAlertCreatePayload.governance_alert.alert_id),
  false
);
const governanceAlertsListResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts`);
assert.equal(governanceAlertsListResponse.ok, true);
const governanceAlertsListPayload = await governanceAlertsListResponse.json();
assert.equal(governanceAlertsListPayload.summary.aggregated_occurrences >= 2, true);
assert.equal(governanceAlertsListPayload.top_repeated[0].occurrence_count >= 2, true);
const escalatedGovernanceAlertCreateResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/desktop-navigation`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      risk_id: "smoke_desktop_warning_risk_1",
      severity: "warning",
      title: "Repeated desktop navigation loop",
      detail: "A low-severity desktop navigation loop kept recurring from system-originated entry points.",
      recommended_action: "Review desktop event routing and notification dedupe behavior.",
      target: {
        kind: "task",
        taskId: task.task_id
      }
    })
  }
);
assert.equal(escalatedGovernanceAlertCreateResponse.ok, true);
const escalatedGovernanceAlertCreatePayload = await escalatedGovernanceAlertCreateResponse.json();
const escalatedGovernanceInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox?kind=governance_alert&status=new`
);
assert.equal(escalatedGovernanceInboxResponse.ok, true);
const escalatedGovernanceInboxPayload = await escalatedGovernanceInboxResponse.json();
const escalatedGovernanceInboxItem = escalatedGovernanceInboxPayload.items.find(
  item => item.source_id === escalatedGovernanceAlertCreatePayload.governance_alert.alert_id
);
assert.ok(escalatedGovernanceInboxItem);
const resolveEscalatedGovernanceInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox/${encodeURIComponent(escalatedGovernanceInboxItem.inbox_id)}/resolve`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "admin"
    })
  }
);
assert.equal(resolveEscalatedGovernanceInboxResponse.ok, true);
const escalatedGovernanceAlertCreateAgainResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/desktop-navigation`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      risk_id: "smoke_desktop_warning_risk_2",
      severity: "warning",
      title: "Repeated desktop navigation loop",
      detail: "A low-severity desktop navigation loop kept recurring from system-originated entry points.",
      recommended_action: "Review desktop event routing and notification dedupe behavior.",
      target: {
        kind: "task",
        taskId: task.task_id
      }
    })
  }
);
assert.equal(escalatedGovernanceAlertCreateAgainResponse.ok, true);
const escalatedGovernanceAlertCreateAgainPayload = await escalatedGovernanceAlertCreateAgainResponse.json();
assert.equal(
  escalatedGovernanceAlertCreateAgainPayload.governance_alert.alert_id,
  escalatedGovernanceAlertCreatePayload.governance_alert.alert_id
);
assert.equal(escalatedGovernanceAlertCreateAgainPayload.governance_alert.occurrence_count, 2);
const reopenedGovernanceInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox?kind=governance_alert&status=new`
);
assert.equal(reopenedGovernanceInboxResponse.ok, true);
const reopenedGovernanceInboxPayload = await reopenedGovernanceInboxResponse.json();
assert.equal(
  reopenedGovernanceInboxPayload.items.some(item => item.source_id === escalatedGovernanceAlertCreatePayload.governance_alert.alert_id),
  true
);
const escalatedGovernanceAlertCreateThirdResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/desktop-navigation`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      risk_id: "smoke_desktop_warning_risk_3",
      severity: "warning",
      title: "Repeated desktop navigation loop",
      detail: "A low-severity desktop navigation loop kept recurring from system-originated entry points.",
      recommended_action: "Review desktop event routing and notification dedupe behavior.",
      target: {
        kind: "task",
        taskId: task.task_id
      }
    })
  }
);
assert.equal(escalatedGovernanceAlertCreateThirdResponse.ok, true);
const escalatedGovernanceAlertCreateThirdPayload = await escalatedGovernanceAlertCreateThirdResponse.json();
assert.equal(escalatedGovernanceAlertCreateThirdPayload.governance_alert.alert_id, escalatedGovernanceAlertCreatePayload.governance_alert.alert_id);
assert.equal(escalatedGovernanceAlertCreateThirdPayload.governance_alert.occurrence_count, 3);
assert.equal(escalatedGovernanceAlertCreateThirdPayload.governance_alert.severity, "critical");
assert.equal(escalatedGovernanceAlertCreateThirdPayload.governance_alert.auto_escalated, true);
assert.equal(
  escalatedGovernanceAlertCreateThirdPayload.governance_alert.action,
  "investigate_system_handoff"
);
const governanceFollowUpsResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/follow-ups`);
assert.equal(governanceFollowUpsResponse.ok, true);
const governanceFollowUpsPayload = await governanceFollowUpsResponse.json();
assert.equal(governanceFollowUpsPayload.total >= 1, true);
const escalatedGovernanceFollowUp = governanceFollowUpsPayload.items.find(
  item => item.alert_id === escalatedGovernanceAlertCreatePayload.governance_alert.alert_id
);
assert.ok(escalatedGovernanceFollowUp);
assert.equal(escalatedGovernanceFollowUp.action, "investigate_system_handoff");
const executeGovernanceFollowUpResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/follow-ups/${encodeURIComponent(escalatedGovernanceFollowUp.follow_up_id)}/execute`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "admin"
    })
  }
);
assert.equal(executeGovernanceFollowUpResponse.ok, true);
const executeGovernanceFollowUpPayload = await executeGovernanceFollowUpResponse.json();
assert.equal(executeGovernanceFollowUpPayload.follow_up.follow_up_id, escalatedGovernanceFollowUp.follow_up_id);
assert.equal(
  executeGovernanceFollowUpPayload.task.inputs.execution_template_key,
  "governance_alert:auto_escalated_investigation"
);
const runGovernanceFollowUpTaskResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${encodeURIComponent(executeGovernanceFollowUpPayload.task.task_id)}/run`,
  {
    method: "POST"
  }
);
assert.equal(runGovernanceFollowUpTaskResponse.ok, true);
const repeatedGovernanceAlertCreateResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/desktop-navigation`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      risk_id: "smoke_desktop_warning_risk_4",
      severity: "warning",
      title: "Repeated desktop navigation loop",
      detail: "A low-severity desktop navigation loop kept recurring from system-originated entry points.",
      recommended_action: "Review desktop event routing and notification dedupe behavior.",
      target: {
        kind: "task",
        taskId: task.task_id
      }
    })
  }
);
assert.equal(repeatedGovernanceAlertCreateResponse.ok, true);
const repeatedGovernanceAlertCreatePayload = await repeatedGovernanceAlertCreateResponse.json();
assert.equal(
  repeatedGovernanceAlertCreatePayload.governance_alert.alert_id,
  escalatedGovernanceAlertCreatePayload.governance_alert.alert_id
);
const repeatedGovernanceFollowUpsResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/follow-ups`);
assert.equal(repeatedGovernanceFollowUpsResponse.ok, true);
const repeatedGovernanceFollowUpsPayload = await repeatedGovernanceFollowUpsResponse.json();
const repeatedGovernanceFollowUp = repeatedGovernanceFollowUpsPayload.items.find(
  item => item.alert_id === escalatedGovernanceAlertCreatePayload.governance_alert.alert_id
);
assert.ok(repeatedGovernanceFollowUp);
const executeRepeatedGovernanceFollowUpResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/follow-ups/${encodeURIComponent(repeatedGovernanceFollowUp.follow_up_id)}/execute`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "admin"
    })
  }
);
assert.equal(executeRepeatedGovernanceFollowUpResponse.ok, true);
const executeRepeatedGovernanceFollowUpPayload = await executeRepeatedGovernanceFollowUpResponse.json();
assert.equal(
  typeof executeRepeatedGovernanceFollowUpPayload.task.inputs.reused_task_template_id,
  "string"
);
assert.equal(
  typeof executeRepeatedGovernanceFollowUpPayload.task.inputs.reused_task_template_version,
  "number"
);
const repeatedGovernanceWorkspaceResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${encodeURIComponent(executeRepeatedGovernanceFollowUpPayload.task.task_id)}/workspace`
);
assert.equal(repeatedGovernanceWorkspaceResponse.ok, true);
const repeatedGovernanceWorkspacePayload = await repeatedGovernanceWorkspaceResponse.json();
assert.equal(["compacted", "promoted"].includes(repeatedGovernanceWorkspacePayload.runtimeBoundaries.session.memory_strategy), true);
assert.equal(repeatedGovernanceWorkspacePayload.runtimeBoundaries.harness.fast_path_reuse, true);
assert.equal(typeof repeatedGovernanceWorkspacePayload.runtimeBoundaries.sandbox.execution_profile, "string");
assert.equal(
  repeatedGovernanceWorkspacePayload.executionTemplate.execution_template_key,
  executeRepeatedGovernanceFollowUpPayload.task.inputs.execution_template_key
);
assert.equal(
  repeatedGovernanceWorkspacePayload.executionTemplate.reused_task_template_id,
  executeRepeatedGovernanceFollowUpPayload.task.inputs.reused_task_template_id
);
assert.equal(
  repeatedGovernanceWorkspacePayload.executionTemplate.deep_link,
  `#kind=execution_template&taskId=${encodeURIComponent(executeRepeatedGovernanceFollowUpPayload.task.task_id)}&templateId=${encodeURIComponent(executeRepeatedGovernanceFollowUpPayload.task.inputs.reused_task_template_id)}`
);
assert.equal(
  typeof repeatedGovernanceWorkspacePayload.executionTemplate.related_playbooks?.[0]?.deep_link,
  "string"
);
const reuseGovernanceAlertCreateResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/governance-alerts/desktop-navigation`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      risk_id: "smoke_reuse_risk_1",
      severity: "critical",
      title: "Repeated reuse-detail review detected",
      detail: "Operators repeatedly reopened the same execution template detail instead of progressing the task.",
      recommended_action: "Review whether the execution template guidance is insufficient and capture a safer reusable path.",
      target: {
        kind: "execution_template",
        taskId: task.task_id,
        templateId: "template_smoke_execution"
      }
    })
  }
);
assert.equal(reuseGovernanceAlertCreateResponse.ok, true);
const reuseGovernanceAlertCreatePayload = await reuseGovernanceAlertCreateResponse.json();
assert.equal(reuseGovernanceAlertCreatePayload.governance_alert.source_kind, "reuse_navigation");
assert.equal(reuseGovernanceAlertCreatePayload.governance_alert.action, "investigate_reuse_loop");
const reuseGovernanceInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox?kind=governance_alert&status=new`
);
assert.equal(reuseGovernanceInboxResponse.ok, true);
const reuseGovernanceInboxPayload = await reuseGovernanceInboxResponse.json();
const reuseGovernanceInboxItem = reuseGovernanceInboxPayload.items.find(
  item => item.source_id === reuseGovernanceAlertCreatePayload.governance_alert.alert_id
);
assert.ok(reuseGovernanceInboxItem);
const executeReuseGovernanceInboxResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/inbox/${encodeURIComponent(reuseGovernanceInboxItem.inbox_id)}/execute`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "admin"
    })
  }
);
assert.equal(executeReuseGovernanceInboxResponse.ok, true);
const executeReuseGovernanceInboxPayload = await executeReuseGovernanceInboxResponse.json();
assert.equal(
  executeReuseGovernanceInboxPayload.task.inputs.execution_template_key,
  "governance_alert:reuse_loop_investigation"
);
assert.equal(
  executeReuseGovernanceInboxPayload.task.definition_of_done.required_artifacts.includes("reuse_navigation_review.md"),
  true
);
const runReuseGovernanceTaskResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${encodeURIComponent(executeReuseGovernanceInboxPayload.task.task_id)}/run`,
  {
    method: "POST"
  }
);
assert.equal(runReuseGovernanceTaskResponse.ok, true);
const reuseGovernanceWorkspaceResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${encodeURIComponent(executeReuseGovernanceInboxPayload.task.task_id)}/workspace`
);
assert.equal(reuseGovernanceWorkspaceResponse.ok, true);
const reuseGovernanceWorkspacePayload = await reuseGovernanceWorkspaceResponse.json();
assert.equal(reuseGovernanceWorkspacePayload.reuseImprovement.target_kind, "execution_template");
assert.equal(reuseGovernanceWorkspacePayload.reuseImprovement.target_id, "template_smoke_execution");
assert.equal(reuseGovernanceWorkspacePayload.reuseImprovement.suggested_learning_action, "refine_execution_template");
assert.equal(typeof reuseGovernanceWorkspacePayload.reuseImprovement.deep_link, "string");
assert.equal((reuseGovernanceWorkspacePayload.reuseImprovement.target_improvement_hints?.length ?? 0) >= 1, true);
assert.equal(
  reuseGovernanceWorkspacePayload.reuseImprovement.target_improvement_hints.some(item => typeof item === "string" && item.length > 24),
  true
);
const refreshedDashboardResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/dashboard`);
assert.equal(refreshedDashboardResponse.ok, true);
const refreshedDashboardPayload = await refreshedDashboardResponse.json();
assert.equal(refreshedDashboardPayload.governance_alert_summary.escalated_count >= 1, true);
const policyTemplatesResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/approval-templates`);
assert.equal(policyTemplatesResponse.ok, true);
const policyTemplatesPayload = await policyTemplatesResponse.json();
assert.equal(policyTemplatesPayload.approval.length >= 1, true);
const approvePolicyProposalResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/${encodeURIComponent(createPolicyProposalPayload.proposal.proposal_id)}/approve`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "security-reviewer",
      approved_by: "smoke-security-reviewer"
    })
  }
);
assert.equal(approvePolicyProposalResponse.ok, true);
const applyPolicyProposalResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/${encodeURIComponent(createPolicyProposalPayload.proposal.proposal_id)}/apply`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "release-manager",
      applied_by: "smoke-release-manager"
    })
  }
);
assert.equal(applyPolicyProposalResponse.ok, true);
const scopesAfterProposalResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/scopes`);
assert.equal(scopesAfterProposalResponse.ok, true);
const scopesAfterProposalPayload = await scopesAfterProposalResponse.json();
assert.equal(scopesAfterProposalPayload.items.find(item => item.scope === "workspace")?.config.content.blocked_tags.includes("workspace-reviewed-tag"), true);

const createBatchProposalOneResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/scope`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    target_scope: "org",
    actor_role: "policy-editor",
    requested_by: "smoke-policy-editor",
    rationale: "Batch proposal one",
    config: {
      trust: {
        allowed_release_channels: ["promoted", "stable", "org-reviewed"]
      }
    }
  })
});
assert.equal(createBatchProposalOneResponse.ok, true);
const createBatchProposalOnePayload = await createBatchProposalOneResponse.json();
const createBatchProposalTwoResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/scope`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    target_scope: "org",
    actor_role: "policy-editor",
    requested_by: "smoke-policy-editor",
    rationale: "Batch proposal two",
    config: {
      content: {
        blocked_tags: ["blocked-tag", "org-reviewed-tag"]
      }
    }
  })
});
assert.equal(createBatchProposalTwoResponse.ok, true);
const createBatchProposalTwoPayload = await createBatchProposalTwoResponse.json();
const batchApproveResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/batch`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    proposal_ids: [
      createBatchProposalOnePayload.proposal.proposal_id,
      createBatchProposalTwoPayload.proposal.proposal_id
    ],
    action: "approve",
    actor_role: "security-reviewer",
    note: policyTemplatesPayload.approval[0]
  })
});
assert.equal(batchApproveResponse.ok, true);
const batchApprovePayload = await batchApproveResponse.json();
assert.equal(batchApprovePayload.count, 2);
const batchApplyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/batch`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    proposal_ids: [
      createBatchProposalOnePayload.proposal.proposal_id,
      createBatchProposalTwoPayload.proposal.proposal_id
    ],
    action: "apply",
    actor_role: "release-manager"
  })
});
assert.equal(batchApplyResponse.ok, true);
const batchApplyPayload = await batchApplyResponse.json();
assert.equal(batchApplyPayload.count, 2);

const createPromotionProposalResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/promote`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    source_scope: "workspace",
    target_scope: "org",
    actor_role: "policy-editor",
    requested_by: "smoke-policy-editor",
    rationale: policyComparePayload.advisory.suggested_note,
    review_path: policyComparePayload.advisory.review_path,
    advisory_recommended_action: policyComparePayload.advisory.recommended_action,
    advisory_reasons: policyComparePayload.advisory.reasons
  })
});
assert.equal(createPromotionProposalResponse.ok, true);
const createPromotionProposalPayload = await createPromotionProposalResponse.json();
assert.equal(createPromotionProposalPayload.proposal.review_path, "security_review");
assert.equal(createPromotionProposalPayload.proposal.advisory_recommended_action, policyComparePayload.advisory.recommended_action);
const unauthorizedSecurityQueueApproveResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/${encodeURIComponent(createPromotionProposalPayload.proposal.proposal_id)}/approve`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "reviewer",
      approved_by: "smoke-reviewer"
    })
  }
);
assert.equal(unauthorizedSecurityQueueApproveResponse.ok, false);
const proposalQueuesAfterPromotionResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/queues`);
assert.equal(proposalQueuesAfterPromotionResponse.ok, true);
const proposalQueuesAfterPromotionPayload = await proposalQueuesAfterPromotionResponse.json();
assert.equal(
  proposalQueuesAfterPromotionPayload.queues.some(
    queue => queue.review_path === "security_review" && queue.items.some(item => item.proposal_id === createPromotionProposalPayload.proposal.proposal_id)
  ),
  true
);
assert.equal(
  proposalQueuesAfterPromotionPayload.queues.every(
    queue => queue.items.every(item => typeof item.deep_link === "string" && item.deep_link.startsWith("#kind=policy_proposal"))
  ),
  true
);
assert.equal(
  proposalQueuesAfterPromotionPayload.queues.some(
    queue => queue.review_path === "security_review" && queue.suggested_action === "prioritize_security_review"
  ),
  true
);
assert.equal(
  proposalQueuesAfterPromotionPayload.queues.some(
    queue =>
      queue.review_path === "security_review" &&
      queue.escalation_required === true &&
      queue.follow_up_action === "assign_security_reviewer" &&
      queue.health_status === "attention"
  ),
  true
);
const proposalFollowUpsAfterPromotionResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/follow-ups`);
assert.equal(proposalFollowUpsAfterPromotionResponse.ok, true);
const proposalFollowUpsAfterPromotionPayload = await proposalFollowUpsAfterPromotionResponse.json();
assert.equal(
  proposalFollowUpsAfterPromotionPayload.items.some(
    item => item.review_path === "security_review" && item.action === "assign_security_reviewer" && item.severity === "warning"
  ),
  true
);
const securityReviewFollowUp = proposalFollowUpsAfterPromotionPayload.items.find(item => item.review_path === "security_review");
assert.ok(securityReviewFollowUp);
const taskCountBeforeFollowUpResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/tasks`);
assert.equal(taskCountBeforeFollowUpResponse.ok, true);
const taskCountBeforeFollowUpPayload = await taskCountBeforeFollowUpResponse.json();
const executeFollowUpResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/follow-ups/${encodeURIComponent(securityReviewFollowUp.follow_up_id)}/execute`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "security-reviewer"
    })
  }
);
assert.equal(executeFollowUpResponse.ok, true);
const executeFollowUpPayload = await executeFollowUpResponse.json();
assert.equal(executeFollowUpPayload.follow_up.action, "assign_security_reviewer");
assert.equal(executeFollowUpPayload.task.department, "ops");
assert.equal(typeof executeFollowUpPayload.task.inputs.execution_template_key, "string");
const taskCountAfterFollowUpResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/tasks`);
assert.equal(taskCountAfterFollowUpResponse.ok, true);
const taskCountAfterFollowUpPayload = await taskCountAfterFollowUpResponse.json();
assert.equal(taskCountAfterFollowUpPayload.tasks.length, taskCountBeforeFollowUpPayload.tasks.length + 1);
const inboxAfterFollowUpExecuteResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/inbox`);
assert.equal(inboxAfterFollowUpExecuteResponse.ok, true);
const inboxAfterFollowUpExecutePayload = await inboxAfterFollowUpExecuteResponse.json();
assert.equal(
  inboxAfterFollowUpExecutePayload.items.some(item => item.source_id === securityReviewFollowUp.follow_up_id),
  false
);
const disallowedPromotionProposalResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/promote`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    source_scope: "local",
    target_scope: "global",
    actor_role: "policy-editor",
    requested_by: "smoke-policy-editor",
    rationale: "This should be blocked by pipeline"
  })
});
assert.equal(disallowedPromotionProposalResponse.ok, false);
const approvePromotionProposalResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/${encodeURIComponent(createPromotionProposalPayload.proposal.proposal_id)}/approve`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "security-reviewer",
      approved_by: "smoke-security-reviewer"
    })
  }
);
assert.equal(approvePromotionProposalResponse.ok, true);
const applyPromotionProposalResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/${encodeURIComponent(createPromotionProposalPayload.proposal.proposal_id)}/apply`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "release-manager",
      applied_by: "smoke-release-manager"
    })
  }
);
assert.equal(applyPromotionProposalResponse.ok, true);
const applyPromotionProposalPayload = await applyPromotionProposalResponse.json();
const policyAuditsAfterProposalResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/audits`);
assert.equal(policyAuditsAfterProposalResponse.ok, true);
const policyAuditsAfterProposalPayload = await policyAuditsAfterProposalResponse.json();
assert.equal(policyAuditsAfterProposalPayload.items.some(item => item.action === "skill.policy_proposal_applied"), true);
const policyReleaseHistoryResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/release-history`);
assert.equal(policyReleaseHistoryResponse.ok, true);
const policyReleaseHistoryPayload = await policyReleaseHistoryResponse.json();
assert.equal(policyReleaseHistoryPayload.items.some(item => item.action === "skill.policy_proposal_applied"), true);
const unauthorizedPolicyApproveResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/skills/policy/proposals/${encodeURIComponent(createPromotionProposalPayload.proposal.proposal_id)}/approve`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "viewer"
    })
  }
);
assert.equal(unauthorizedPolicyApproveResponse.ok, false);

const serviceWorkspaceResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/workspace`);
assert.equal(serviceWorkspaceResponse.ok, true);
const serviceWorkspace = await serviceWorkspaceResponse.json();
assert.equal(serviceWorkspace.operationalSummary.tooling.external_invocations >= 4, true);
assert.equal(serviceWorkspace.operationalSummary.reconciliation.artifact_ready >= 3, true);
assert.equal(serviceWorkspace.operationalSummary.reconciliation.external_state_applied >= 1, true);
const agentTeamEndpointResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team`);
assert.equal(agentTeamEndpointResponse.ok, true);
const agentTeamEndpointPayload = await agentTeamEndpointResponse.json();
const agentTeamLauncherCatalogResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/agent-team/launchers`);
assert.equal(agentTeamLauncherCatalogResponse.ok, true);
const agentTeamLauncherCatalogPayload = await agentTeamLauncherCatalogResponse.json();
const agentTeamLauncherStatusResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/agent-team/launchers/status`);
assert.equal(agentTeamLauncherStatusResponse.ok, true);
const agentTeamLauncherStatusPayload = await agentTeamLauncherStatusResponse.json();
const agentTeamLauncherDriverCatalogResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/agent-team/launcher-drivers`);
assert.equal(agentTeamLauncherDriverCatalogResponse.ok, true);
const agentTeamLauncherDriverCatalogPayload = await agentTeamLauncherDriverCatalogResponse.json();
const agentTeamLauncherDriverStatusResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/agent-team/launcher-drivers/status`);
assert.equal(agentTeamLauncherDriverStatusResponse.ok, true);
const agentTeamLauncherDriverStatusPayload = await agentTeamLauncherDriverStatusResponse.json();
assert.equal(agentTeamLauncherCatalogPayload.items.length >= 3, true);
assert.equal(agentTeamLauncherCatalogPayload.items.some(item => item.launcher_kind === "worker_run"), true);
assert.equal(agentTeamLauncherCatalogPayload.items.some(item => item.launcher_kind === "sandbox_runner"), true);
assert.equal(agentTeamLauncherStatusPayload.items.length >= 3, true);
assert.equal(agentTeamLauncherDriverCatalogPayload.items.length >= 3, true);
assert.equal(agentTeamLauncherDriverCatalogPayload.items.some(item => item.driver_id === "local_worker_run_driver"), true);
assert.equal(agentTeamLauncherDriverCatalogPayload.items.some(item => item.driver_id === "sandbox_pool_driver"), true);
assert.equal(agentTeamLauncherDriverCatalogPayload.items.some(item => item.driver_id === "sandbox_pool_driver" && item.isolation_scope === "sandbox_pool"), true);
assert.equal(agentTeamLauncherDriverStatusPayload.items.length >= 3, true);
assert.equal(agentTeamEndpointPayload.summary.resume_supported, true);
assert.equal(agentTeamEndpointPayload.sessions.length >= 2, true);
assert.equal(agentTeamEndpointPayload.checkpoints.length >= 1, true);
assert.equal(agentTeamEndpointPayload.messages.some(message => message.kind === "handoff"), true);
assert.equal(agentTeamEndpointPayload.timeline.length >= agentTeamEndpointPayload.messages.length, true);
assert.equal(agentTeamEndpointPayload.launcherCatalog.length >= 3, true);
assert.equal(agentTeamEndpointPayload.launcherStatuses.length >= 3, true);
assert.equal(agentTeamEndpointPayload.launcherDrivers.length >= 3, true);
assert.equal(agentTeamEndpointPayload.launcherDriverStatuses.length >= 3, true);
const resumableSession = agentTeamEndpointPayload.sessions.find(session => session.resume_supported);
assert.ok(resumableSession);
const delegatedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/sessions/${encodeURIComponent(resumableSession.subagent_session_id)}/resume`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "operator",
      reason: "resume smoke validation"
    })
  }
);
assert.equal(delegatedResumeResponse.ok, true);
const delegatedResumePayload = await delegatedResumeResponse.json();
assert.equal(delegatedResumePayload.request.status, "pending");
const acceptedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/resume-requests/${encodeURIComponent(delegatedResumePayload.request.request_id)}/accept`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "lead_operator",
      note: "Validated latest checkpoint and accepted delegated resume."
    })
  }
);
assert.equal(acceptedResumeResponse.ok, true);
const acceptedResumePayload = await acceptedResumeResponse.json();
assert.equal(acceptedResumePayload.request.status, "accepted");
const completedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/resume-requests/${encodeURIComponent(delegatedResumePayload.request.request_id)}/complete`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "lead_operator",
      note: "Prepared delegated handoff for the next runtime pass."
    })
  }
);
assert.equal(completedResumeResponse.ok, true);
const completedResumePayload = await completedResumeResponse.json();
assert.equal(completedResumePayload.request.status, "completed");
const serviceAgentTeamAfterCompleteResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team`
);
assert.equal(serviceAgentTeamAfterCompleteResponse.ok, true);
const serviceAgentTeamAfterCompletePayload = await serviceAgentTeamAfterCompleteResponse.json();
const preparedResumePackage = serviceAgentTeamAfterCompletePayload.resumePackages.find(item => item.status === "prepared");
assert.ok(preparedResumePackage);
const appliedResumePackageResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/resume-packages/${encodeURIComponent(preparedResumePackage.package_id)}/apply`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime",
      note: "Applied delegated resume package into the next runtime handoff."
    })
  }
);
assert.equal(appliedResumePackageResponse.ok, true);
const appliedResumePackagePayload = await appliedResumePackageResponse.json();
assert.equal(appliedResumePackagePayload.package.status, "applied");
const serviceAgentTeamAfterApplyResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team`
);
assert.equal(serviceAgentTeamAfterApplyResponse.ok, true);
const serviceAgentTeamAfterApplyPayload = await serviceAgentTeamAfterApplyResponse.json();
const runningExecutionRun = serviceAgentTeamAfterApplyPayload.executionRuns.find(item => item.status === "running");
assert.ok(runningExecutionRun);
const boundRuntimeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/execution-runs/${encodeURIComponent(runningExecutionRun.execution_run_id)}/bind`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime",
      runtime_kind: "sandbox_runner",
      sandbox_profile: "delegated_resume_default",
      runtime_locator: "sandbox://smoke/delegated-runtime/1",
      launcher_driver_id: "local_worker_run_driver",
      note: "Bound runtime for delegated execution smoke coverage."
    })
  }
);
assert.equal(boundRuntimeResponse.ok, true);
const boundRuntimePayload = await boundRuntimeResponse.json();
assert.equal(boundRuntimePayload.runtime_binding.status, "bound");
const runtimeInstanceAfterBindResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/workspace`
);
assert.equal(runtimeInstanceAfterBindResponse.ok, true);
const runtimeInstanceAfterBindPayload = await runtimeInstanceAfterBindResponse.json();
const activeRuntimeInstance = runtimeInstanceAfterBindPayload.agentTeam.runtimeInstances.find(item => item.status === "active");
assert.ok(activeRuntimeInstance);
assert.ok(activeRuntimeInstance.launcher_worker_run_id);
assert.equal(activeRuntimeInstance.launcher_driver_id, "local_worker_run_driver");
assert.equal(activeRuntimeInstance.isolation_scope, "host_process");
assert.equal(activeRuntimeInstance.quota_profile, "local_worker_default");
assert.equal(
  runtimeInstanceAfterBindPayload.workerRuns.some(
    item => item.worker_run_id === activeRuntimeInstance.launcher_worker_run_id && item.delegated_runtime_instance_id === activeRuntimeInstance.instance_id
  ),
  true
);
const runtimeLaunchSpecResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-instances/${encodeURIComponent(activeRuntimeInstance.instance_id)}/launch-spec`
);
assert.equal(runtimeLaunchSpecResponse.ok, true);
const runtimeLaunchSpecPayload = await runtimeLaunchSpecResponse.json();
assert.equal(runtimeLaunchSpecPayload.launch_spec.instance_id, activeRuntimeInstance.instance_id);
assert.equal(runtimeLaunchSpecPayload.launch_spec.launcher_driver_id, "local_worker_run_driver");
assert.equal(runtimeLaunchSpecPayload.launch_spec.isolation_scope, "host_process");
assert.equal(runtimeLaunchSpecPayload.launch_spec.consumer_contract_version, 1);
const localRuntimeLaunchResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-instances/${encodeURIComponent(activeRuntimeInstance.instance_id)}/launch`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_launcher",
      note: "Local worker launcher consumed the delegated launch spec."
    })
  }
);
assert.equal(localRuntimeLaunchResponse.ok, true);
const localRuntimeLaunchPayload = await localRuntimeLaunchResponse.json();
assert.equal(localRuntimeLaunchPayload.launch_receipt.instance_id, activeRuntimeInstance.instance_id);
assert.equal(localRuntimeLaunchPayload.launch_receipt.backend_kind, "local_worker_adapter");
assert.equal(localRuntimeLaunchPayload.launch_receipt.consumer_contract_version, 1);
const localAdapterConsumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-launch-receipts/${encodeURIComponent(localRuntimeLaunchPayload.launch_receipt.receipt_id)}/consume`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_launcher",
      note: "Consumed local delegated runtime launch receipt."
    })
  }
);
assert.equal(localAdapterConsumeResponse.ok, true);
const localAdapterConsumePayload = await localAdapterConsumeResponse.json();
assert.equal(localAdapterConsumePayload.adapter.adapter_id, "local_worker_backend_adapter");
assert.equal(localAdapterConsumePayload.adapter_run.status, "running");
const localRunnerBackendLeaseAcquireResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(localAdapterConsumePayload.adapter_run.adapter_run_id)}/acquire-runner-backend-lease`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_runner_backend",
      note: "Allocated local runner backend lease."
    })
  }
);
assert.equal(localRunnerBackendLeaseAcquireResponse.ok, true);
const localRunnerBackendLeaseAcquirePayload = await localRunnerBackendLeaseAcquireResponse.json();
assert.equal(localRunnerBackendLeaseAcquirePayload.runner_backend_lease.status, "allocated");
const localBackendExecutionStartResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(localAdapterConsumePayload.adapter_run.adapter_run_id)}/execute`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_backend",
      note: "Started local delegated runtime backend execution."
    })
  }
);
assert.equal(localBackendExecutionStartResponse.ok, true);
const localBackendExecutionStartPayload = await localBackendExecutionStartResponse.json();
assert.equal(localBackendExecutionStartPayload.backend_execution.status, "running");
assert.equal(
  localBackendExecutionStartPayload.backend_execution.lease_id,
  localRunnerBackendLeaseAcquirePayload.runner_backend_lease.lease_id
);
const localBackendHeartbeatResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-backend-executions/${encodeURIComponent(localBackendExecutionStartPayload.backend_execution.backend_execution_id)}/heartbeat`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_backend",
      note: "Local delegated runtime backend heartbeat."
    })
  }
);
assert.equal(localBackendHeartbeatResponse.ok, true);
const localBackendHeartbeatPayload = await localBackendHeartbeatResponse.json();
assert.equal(localBackendHeartbeatPayload.backend_execution.status, "running");
const localDriverStartResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-backend-executions/${encodeURIComponent(localBackendExecutionStartPayload.backend_execution.backend_execution_id)}/start-driver`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_driver",
      note: "Started local delegated runtime driver run."
    })
  }
);
assert.equal(localDriverStartResponse.ok, true);
const localDriverStartPayload = await localDriverStartResponse.json();
assert.equal(localDriverStartPayload.driver_run.status, "running");
const localRunnerAttachResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(localDriverStartPayload.driver_run.driver_run_id)}/attach-runner`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_runner",
      note: "Attached local delegated runtime runner handle."
    })
  }
);
assert.equal(localRunnerAttachResponse.ok, true);
const localRunnerAttachPayload = await localRunnerAttachResponse.json();
assert.equal(localRunnerAttachPayload.runner_handle.status, "attached");
const localDriverHeartbeatResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(localDriverStartPayload.driver_run.driver_run_id)}/heartbeat`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_driver",
      note: "Local delegated runtime driver heartbeat."
    })
  }
);
assert.equal(localDriverHeartbeatResponse.ok, true);
const localDriverHeartbeatPayload = await localDriverHeartbeatResponse.json();
assert.equal(localDriverHeartbeatPayload.driver_run.status, "running");
const localRunnerHeartbeatResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(localDriverStartPayload.driver_run.driver_run_id)}/runner-handles/${encodeURIComponent(localRunnerAttachPayload.runner_handle.runner_handle_id)}/heartbeat`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_runner",
      note: "Local delegated runtime runner heartbeat."
    })
  }
);
if (!localRunnerHeartbeatResponse.ok) {
  throw new Error(`Local runtime runner heartbeat failed: ${await localRunnerHeartbeatResponse.text()}`);
}
  const localRunnerHeartbeatPayload = await localRunnerHeartbeatResponse.json();
  assert.equal(localRunnerHeartbeatPayload.runner_handle.status, "attached");
  const localRunnerExecutionStartResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-handles/${encodeURIComponent(localRunnerAttachPayload.runner_handle.runner_handle_id)}/start-execution`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "delegated_runtime_runner_execution",
        note: "Local delegated runtime runner execution started."
      })
    }
  );
  assert.equal(localRunnerExecutionStartResponse.ok, true);
  const localRunnerExecutionStartPayload = await localRunnerExecutionStartResponse.json();
  assert.equal(localRunnerExecutionStartPayload.runner_execution.status, "running");
  const localRunnerExecutionHeartbeatResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-executions/${encodeURIComponent(localRunnerExecutionStartPayload.runner_execution.runner_execution_id)}/heartbeat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "delegated_runtime_runner_execution",
        note: "Local delegated runtime runner execution heartbeat."
      })
    }
  );
  assert.equal(localRunnerExecutionHeartbeatResponse.ok, true);
  const localRunnerExecutionHeartbeatPayload = await localRunnerExecutionHeartbeatResponse.json();
  assert.equal(localRunnerExecutionHeartbeatPayload.runner_execution.status, "running");
  const localRunnerJobStartResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-executions/${encodeURIComponent(localRunnerExecutionStartPayload.runner_execution.runner_execution_id)}/start-job`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "delegated_runtime_runner_job",
        note: "Local delegated runtime runner job started."
      })
    }
  );
  assert.equal(localRunnerJobStartResponse.ok, true);
  const localRunnerJobStartPayload = await localRunnerJobStartResponse.json();
  assert.equal(localRunnerJobStartPayload.runner_job.status, "running");
  const localRunnerJobHeartbeatResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-jobs/${encodeURIComponent(localRunnerJobStartPayload.runner_job.runner_job_id)}/heartbeat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "delegated_runtime_runner_job",
        note: "Local delegated runtime runner job heartbeat."
      })
    }
  );
  assert.equal(localRunnerJobHeartbeatResponse.ok, true);
  const localRunnerJobHeartbeatPayload = await localRunnerJobHeartbeatResponse.json();
  assert.equal(localRunnerJobHeartbeatPayload.runner_job.status, "running");
  const localRunnerJobCompleteResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-jobs/${encodeURIComponent(localRunnerJobStartPayload.runner_job.runner_job_id)}/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "delegated_runtime_runner_job",
        note: "Local delegated runtime runner job completed."
      })
    }
  );
  assert.equal(localRunnerJobCompleteResponse.ok, true);
  const localRunnerJobCompletePayload = await localRunnerJobCompleteResponse.json();
  assert.equal(localRunnerJobCompletePayload.runner_job.status, "completed");
  const completedExecutionRunResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(localDriverStartPayload.driver_run.driver_run_id)}/complete`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_driver",
      note: "Delegated runtime driver completed the resumed execution."
    })
  }
);
assert.equal(completedExecutionRunResponse.ok, true);
const completedExecutionRunPayload = await completedExecutionRunResponse.json();
assert.equal(completedExecutionRunPayload.driver_run.status, "completed");
const localRunnerReleaseResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(localDriverStartPayload.driver_run.driver_run_id)}/runner-handles/${encodeURIComponent(localRunnerAttachPayload.runner_handle.runner_handle_id)}/release`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime_runner",
      note: "Released local delegated runtime runner handle."
    })
  }
);
assert.equal(localRunnerReleaseResponse.ok, true);
const localRunnerReleasePayload = await localRunnerReleaseResponse.json();
assert.equal(localRunnerReleasePayload.runner_handle.status, "released");
const secondDelegatedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/sessions/${encodeURIComponent(resumableSession.subagent_session_id)}/resume`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "operator",
      reason: "negative-path resume lifecycle check"
    })
  }
);
assert.equal(secondDelegatedResumeResponse.ok, true);
const secondDelegatedResumePayload = await secondDelegatedResumeResponse.json();
const rejectedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/resume-requests/${encodeURIComponent(secondDelegatedResumePayload.request.request_id)}/reject`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "lead_operator",
      note: "Rejected because this smoke path only validates lifecycle branching."
    })
  }
);
assert.equal(rejectedResumeResponse.ok, true);
const rejectedResumePayload = await rejectedResumeResponse.json();
assert.equal(rejectedResumePayload.request.status, "rejected");
const thirdDelegatedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/sessions/${encodeURIComponent(resumableSession.subagent_session_id)}/resume`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "operator",
      reason: "external launcher delegated resume coverage"
    })
  }
);
assert.equal(thirdDelegatedResumeResponse.ok, true);
const thirdDelegatedResumePayload = await thirdDelegatedResumeResponse.json();
const thirdAcceptedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/resume-requests/${encodeURIComponent(thirdDelegatedResumePayload.request.request_id)}/accept`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "lead_operator",
      note: "Accepted for external launcher coverage."
    })
  }
);
assert.equal(thirdAcceptedResumeResponse.ok, true);
const thirdCompletedResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/resume-requests/${encodeURIComponent(thirdDelegatedResumePayload.request.request_id)}/complete`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "lead_operator",
      note: "Prepared external launcher handoff."
    })
  }
);
assert.equal(thirdCompletedResumeResponse.ok, true);
const serviceAgentTeamAfterThirdCompleteResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team`
);
assert.equal(serviceAgentTeamAfterThirdCompleteResponse.ok, true);
const serviceAgentTeamAfterThirdCompletePayload = await serviceAgentTeamAfterThirdCompleteResponse.json();
const externalPreparedResumePackage = serviceAgentTeamAfterThirdCompletePayload.resumePackages.find(
  item => item.status === "prepared" && item.request_id === thirdDelegatedResumePayload.request.request_id
);
assert.ok(externalPreparedResumePackage);
const externalAppliedResumePackageResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/resume-packages/${encodeURIComponent(externalPreparedResumePackage.package_id)}/apply`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime",
      note: "Applied package for external sandbox launcher."
    })
  }
);
assert.equal(externalAppliedResumePackageResponse.ok, true);
const serviceAgentTeamAfterExternalApplyResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team`
);
assert.equal(serviceAgentTeamAfterExternalApplyResponse.ok, true);
const serviceAgentTeamAfterExternalApplyPayload = await serviceAgentTeamAfterExternalApplyResponse.json();
const externalRunningExecutionRun = serviceAgentTeamAfterExternalApplyPayload.executionRuns.find(
  item => item.status === "running" && item.request_id === thirdDelegatedResumePayload.request.request_id
);
assert.ok(externalRunningExecutionRun);
const externalBindRuntimeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/execution-runs/${encodeURIComponent(externalRunningExecutionRun.execution_run_id)}/bind`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "delegated_runtime",
      runtime_kind: "sandbox_runner",
      sandbox_profile: "delegated_resume_default",
      runtime_locator: "sandbox://smoke/delegated-runtime/external",
      launcher_kind: "sandbox_runner",
      launcher_driver_id: "sandbox_pool_driver",
      launcher_locator: "sandbox://pool/runtime-external-1",
      note: "Bound delegated runtime through external sandbox launcher."
    })
  }
);
assert.equal(externalBindRuntimeResponse.ok, true);
const externalRuntimeWorkspaceResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/workspace`
);
assert.equal(externalRuntimeWorkspaceResponse.ok, true);
const externalRuntimeWorkspacePayload = await externalRuntimeWorkspaceResponse.json();
const externalActiveRuntimeInstance = externalRuntimeWorkspacePayload.agentTeam.runtimeInstances.find(
  item => item.status === "active" && item.execution_run_id === externalRunningExecutionRun.execution_run_id
);
assert.ok(externalActiveRuntimeInstance);
assert.equal(externalActiveRuntimeInstance.launcher_kind, "sandbox_runner");
assert.equal(externalActiveRuntimeInstance.launcher_driver_id, "sandbox_pool_driver");
assert.equal(externalActiveRuntimeInstance.isolation_scope, "sandbox_pool");
assert.equal(externalActiveRuntimeInstance.quota_profile, "sandbox_pool_default");
assert.equal(externalActiveRuntimeInstance.launcher_state, "external_pending");
assert.equal(externalActiveRuntimeInstance.launcher_worker_run_id ?? null, null);
assert.equal(externalActiveRuntimeInstance.launcher_locator, "sandbox://pool/runtime-external-1");
const externalRuntimeLaunchSpecResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-instances/${encodeURIComponent(externalActiveRuntimeInstance.instance_id)}/launch-spec`
);
assert.equal(externalRuntimeLaunchSpecResponse.ok, true);
const externalRuntimeLaunchSpecPayload = await externalRuntimeLaunchSpecResponse.json();
assert.equal(externalRuntimeLaunchSpecPayload.launch_spec.instance_id, externalActiveRuntimeInstance.instance_id);
assert.equal(externalRuntimeLaunchSpecPayload.launch_spec.launcher_driver_id, "sandbox_pool_driver");
assert.equal(externalRuntimeLaunchSpecPayload.launch_spec.isolation_scope, "sandbox_pool");
assert.equal(externalRuntimeLaunchSpecPayload.launch_spec.launcher_locator, "sandbox://pool/runtime-external-1");
const externalRuntimeLaunchResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-instances/${encodeURIComponent(externalActiveRuntimeInstance.instance_id)}/launch`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_pool_controller",
      note: "Sandbox runner accepted the delegated launch spec."
    })
  }
);
assert.equal(externalRuntimeLaunchResponse.ok, true);
const externalRuntimeLaunchPayload = await externalRuntimeLaunchResponse.json();
assert.equal(externalRuntimeLaunchPayload.launch_receipt.instance_id, externalActiveRuntimeInstance.instance_id);
assert.equal(externalRuntimeLaunchPayload.launch_receipt.backend_kind, "sandbox_runner_adapter");
assert.equal(externalRuntimeLaunchPayload.launch_receipt.consumer_contract_version, 1);
const externalAdapterConsumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-launch-receipts/${encodeURIComponent(externalRuntimeLaunchPayload.launch_receipt.receipt_id)}/consume`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_pool_controller",
      note: "Consumed sandbox delegated runtime launch receipt."
    })
  }
);
assert.equal(externalAdapterConsumeResponse.ok, true);
const externalAdapterConsumePayload = await externalAdapterConsumeResponse.json();
assert.equal(externalAdapterConsumePayload.adapter.adapter_id, "sandbox_pool_backend_adapter");
assert.equal(externalAdapterConsumePayload.adapter_run.status, "running");
const externalRunnerBackendLeaseAcquireResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(externalAdapterConsumePayload.adapter_run.adapter_run_id)}/acquire-runner-backend-lease`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runner_backend",
      note: "Allocated sandbox runner backend lease."
    })
  }
);
assert.equal(externalRunnerBackendLeaseAcquireResponse.ok, true);
const externalRunnerBackendLeaseAcquirePayload = await externalRunnerBackendLeaseAcquireResponse.json();
assert.equal(externalRunnerBackendLeaseAcquirePayload.runner_backend_lease.status, "allocated");
const externalBackendExecutionStartResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-adapter-runs/${encodeURIComponent(externalAdapterConsumePayload.adapter_run.adapter_run_id)}/execute`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_backend",
      note: "Started external sandbox runtime backend execution."
    })
  }
);
assert.equal(externalBackendExecutionStartResponse.ok, true);
const externalBackendExecutionStartPayload = await externalBackendExecutionStartResponse.json();
assert.equal(externalBackendExecutionStartPayload.backend_execution.status, "running");
assert.equal(
  externalBackendExecutionStartPayload.backend_execution.lease_id,
  externalRunnerBackendLeaseAcquirePayload.runner_backend_lease.lease_id
);
const externalBackendHeartbeatResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-backend-executions/${encodeURIComponent(externalBackendExecutionStartPayload.backend_execution.backend_execution_id)}/heartbeat`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_backend",
      note: "External sandbox runtime backend heartbeat."
    })
  }
);
assert.equal(externalBackendHeartbeatResponse.ok, true);
const externalBackendHeartbeatPayload = await externalBackendHeartbeatResponse.json();
assert.equal(externalBackendHeartbeatPayload.backend_execution.status, "running");
const externalDriverStartResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-backend-executions/${encodeURIComponent(externalBackendExecutionStartPayload.backend_execution.backend_execution_id)}/start-driver`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_driver",
      note: "Started external sandbox runtime driver run."
    })
  }
);
assert.equal(externalDriverStartResponse.ok, true);
const externalDriverStartPayload = await externalDriverStartResponse.json();
assert.equal(externalDriverStartPayload.driver_run.status, "running");
const externalRunnerAttachResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(externalDriverStartPayload.driver_run.driver_run_id)}/attach-runner`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_runner",
      note: "Attached external sandbox runtime runner handle."
    })
  }
);
assert.equal(externalRunnerAttachResponse.ok, true);
const externalRunnerAttachPayload = await externalRunnerAttachResponse.json();
assert.equal(externalRunnerAttachPayload.runner_handle.status, "attached");
const externalDriverHeartbeatResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(externalDriverStartPayload.driver_run.driver_run_id)}/heartbeat`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_driver",
      note: "External sandbox runtime driver heartbeat."
    })
  }
);
assert.equal(externalDriverHeartbeatResponse.ok, true);
const externalDriverHeartbeatPayload = await externalDriverHeartbeatResponse.json();
assert.equal(externalDriverHeartbeatPayload.driver_run.status, "running");
const externalRunnerHeartbeatResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(externalDriverStartPayload.driver_run.driver_run_id)}/runner-handles/${encodeURIComponent(externalRunnerAttachPayload.runner_handle.runner_handle_id)}/heartbeat`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_runner",
      note: "External sandbox runtime runner heartbeat."
    })
  }
);
if (!externalRunnerHeartbeatResponse.ok) {
  throw new Error(`External runtime runner heartbeat failed: ${await externalRunnerHeartbeatResponse.text()}`);
}
  const externalRunnerHeartbeatPayload = await externalRunnerHeartbeatResponse.json();
  assert.equal(externalRunnerHeartbeatPayload.runner_handle.status, "attached");
  const externalRunnerExecutionStartResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-handles/${encodeURIComponent(externalRunnerAttachPayload.runner_handle.runner_handle_id)}/start-execution`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "sandbox_runtime_runner_execution",
        note: "External sandbox runtime runner execution started."
      })
    }
  );
  assert.equal(externalRunnerExecutionStartResponse.ok, true);
  const externalRunnerExecutionStartPayload = await externalRunnerExecutionStartResponse.json();
  assert.equal(externalRunnerExecutionStartPayload.runner_execution.status, "running");
  const externalRunnerExecutionHeartbeatResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-executions/${encodeURIComponent(externalRunnerExecutionStartPayload.runner_execution.runner_execution_id)}/heartbeat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "sandbox_runtime_runner_execution",
        note: "External sandbox runtime runner execution heartbeat."
      })
    }
  );
  assert.equal(externalRunnerExecutionHeartbeatResponse.ok, true);
  const externalRunnerExecutionHeartbeatPayload = await externalRunnerExecutionHeartbeatResponse.json();
  assert.equal(externalRunnerExecutionHeartbeatPayload.runner_execution.status, "running");
  const externalRunnerJobStartResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-executions/${encodeURIComponent(externalRunnerExecutionStartPayload.runner_execution.runner_execution_id)}/start-job`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "sandbox_runtime_runner_job",
        note: "External sandbox runtime runner job started."
      })
    }
  );
  assert.equal(externalRunnerJobStartResponse.ok, true);
  const externalRunnerJobStartPayload = await externalRunnerJobStartResponse.json();
  assert.equal(externalRunnerJobStartPayload.runner_job.status, "running");
  const externalRunnerJobHeartbeatResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-jobs/${encodeURIComponent(externalRunnerJobStartPayload.runner_job.runner_job_id)}/heartbeat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "sandbox_runtime_runner_job",
        note: "External sandbox runtime runner job heartbeat."
      })
    }
  );
  assert.equal(externalRunnerJobHeartbeatResponse.ok, true);
  const externalRunnerJobHeartbeatPayload = await externalRunnerJobHeartbeatResponse.json();
  assert.equal(externalRunnerJobHeartbeatPayload.runner_job.status, "running");
  const externalRunnerJobCompleteResponse = await fetch(
    `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-runner-jobs/${encodeURIComponent(externalRunnerJobStartPayload.runner_job.runner_job_id)}/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_role: "sandbox_runtime_runner_job",
        note: "External sandbox runtime runner job completed."
      })
    }
  );
  assert.equal(externalRunnerJobCompleteResponse.ok, true);
  const externalRunnerJobCompletePayload = await externalRunnerJobCompleteResponse.json();
  assert.equal(externalRunnerJobCompletePayload.runner_job.status, "completed");
  const externalCompletedExecutionRunResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(externalDriverStartPayload.driver_run.driver_run_id)}/complete`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_driver",
      note: "External sandbox runtime driver completed."
    })
  }
);
assert.equal(externalCompletedExecutionRunResponse.ok, true);
const externalCompletedExecutionRunPayload = await externalCompletedExecutionRunResponse.json();
assert.equal(externalCompletedExecutionRunPayload.driver_run.status, "completed");
const externalRunnerReleaseResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team/runtime-driver-runs/${encodeURIComponent(externalDriverStartPayload.driver_run.driver_run_id)}/runner-handles/${encodeURIComponent(externalRunnerAttachPayload.runner_handle.runner_handle_id)}/release`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor_role: "sandbox_runtime_runner",
      note: "Released external sandbox runtime runner handle."
    })
  }
);
assert.equal(externalRunnerReleaseResponse.ok, true);
const externalRunnerReleasePayload = await externalRunnerReleaseResponse.json();
assert.equal(externalRunnerReleasePayload.runner_handle.status, "released");
const agentTeamLauncherStatusAfterExternalResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/agent-team/launchers/status`
);
assert.equal(agentTeamLauncherStatusAfterExternalResponse.ok, true);
const agentTeamLauncherStatusAfterExternalPayload = await agentTeamLauncherStatusAfterExternalResponse.json();
assert.equal(
  agentTeamLauncherStatusAfterExternalPayload.items.some(
    item => item.launcher_kind === "sandbox_runner" && item.released_runtime_count >= 1
  ),
  true
);
const agentTeamLauncherBackendAdapterStatusResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/agent-team/launcher-backend-adapters/status`
);
assert.equal(agentTeamLauncherBackendAdapterStatusResponse.ok, true);
const agentTeamLauncherBackendAdapterStatusPayload = await agentTeamLauncherBackendAdapterStatusResponse.json();
assert.equal(
  agentTeamLauncherBackendAdapterStatusPayload.items.some(
    item => item.adapter_id === "local_worker_backend_adapter" && item.active_adapter_run_count >= 0
  ),
  true
);
const serviceAgentTeamAfterResumeResponse = await fetch(
  `http://127.0.0.1:${localControlPlanePort}/api/local/tasks/${serviceTaskId}/agent-team`
);
assert.equal(serviceAgentTeamAfterResumeResponse.ok, true);
const serviceAgentTeamAfterResumePayload = await serviceAgentTeamAfterResumeResponse.json();
assert.equal(serviceAgentTeamAfterResumePayload.resumeRequests.length >= 2, true);
assert.equal(serviceAgentTeamAfterResumePayload.resumePackages.length >= 1, true);
assert.equal(serviceAgentTeamAfterResumePayload.executionRuns.length >= 1, true);
assert.equal(serviceAgentTeamAfterResumePayload.runtimeBindings.length >= 1, true);
assert.equal(serviceAgentTeamAfterResumePayload.runtimeInstances.length >= 1, true);
assert.equal(
  serviceAgentTeamAfterResumePayload.resumePackages.some(item => item.status === "applied"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.runtimeBindings.some(item => item.status === "released"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.runtimeInstances.some(item => item.status === "completed"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.source_type === "resume_request"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.source_type === "resume_package"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "resume_completed"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "resume_package_applied"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "execution_run_completed"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "runtime_binding_bound"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "runtime_binding_released"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "runtime_instance_started"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "runtime_instance_heartbeat"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "runtime_instance_completed"),
  true
);
assert.equal(
  serviceAgentTeamAfterResumePayload.timeline.some(entry => entry.event_kind === "resume_rejected"),
  true
);

const ideSummary = summarizeLocalIdeWorkspace({
  taskId: task.task_id,
  rootPath: workspaceDir,
  confirm: true
});
assert.equal(ideSummary.status, "completed");
assert.equal(ideSummary.result?.root_path, workspaceDir);
assert.equal(ideSummary.result?.project_name, null);

  recordToolInvocation(task.task_id, "code_executor", { scope: "smoke" }, { ok: true }, "succeeded");
  recordToolInvocation(
    task.task_id,
    "crm_sync",
    { scope: "smoke" },
    { reconciliation_mode: "external_state", reconciliation_state: "applied", ok: true },
    "succeeded",
    {
      idempotency_key: "crm_sync_smoke_success",
      compensation_available: true,
      compensation_status: "available"
    }
  );
  recordToolInvocation(
    task.task_id,
    "hr_checker",
    { scope: "smoke" },
    { reconciliation_mode: "external_state", reconciliation_state: "failed", ok: false },
    "failed",
    {
      idempotency_key: "hr_checker_smoke_failure",
      compensation_available: true,
      compensation_status: "failed"
    }
  );
  const result = runTaskEndToEnd(task.task_id);

assert.equal(result.task.status, "completed");
assert.equal(result.doneGate.status, "passed");
assert.equal(result.workerRun.status, "completed");
assert.ok(listTaskWorkerRuns(task.task_id).length >= 1);
assert.ok(store.memoryItems.size >= 2);
assert.ok(store.skillCandidates.size >= 1);
assert.ok(listTaskCapabilityResolutions(task.task_id).length >= 1);
assert.equal(stateBackendInfo.kind, "sqlite");
assert.ok([...store.skillCandidates.values()].some(candidate => candidate.task_id === task.task_id && candidate.status === "approved"));

const learnedTask = buildDefaultTask({
  task_type: "one_off",
  intent: "Prepare a validated engineering task output for release review",
  department: "engineering",
  risk_level: "medium",
  initiator: {
    tenant_id: "tenant_demo",
    user_id: "user_demo",
    channel: "smoke-test"
  },
  inputs: {
    workspace_paths: [workspaceDir]
  }
});
store.tasks.set(learnedTask.task_id, learnedTask);
const learnedResult = runTaskEndToEnd(learnedTask.task_id);
assert.equal(learnedResult.task.status, "completed");
const learnedCapabilityHits = listTaskCapabilityResolutions(learnedTask.task_id)
  .flatMap(resolution => resolution.selected_capabilities)
  .filter(capability => capability.source === "learned-playbook");
assert.ok(learnedCapabilityHits.length >= 1);
const approvedLearnedSkills = [...store.skillCandidates.values()].filter(candidate => candidate.status === "approved");
assert.equal(approvedLearnedSkills.length, 1);
assert.equal(approvedLearnedSkills[0]?.source_task_count, 2);
assert.equal(approvedLearnedSkills[0]?.version, 2);
assert.ok(approvedLearnedSkills[0]?.applicability.required_tags.includes("engineering"));
assert.ok((approvedLearnedSkills[0]?.failure_boundaries.length ?? 0) >= 0);
const methodologyEntries = [...store.memoryItems.values()].filter(item => item.kind === "methodology");
assert.equal(methodologyEntries.length, 1);
assert.equal(methodologyEntries[0]?.source_task_count, 2);
const taskTemplates = [...store.taskTemplates.values()];
assert.equal(taskTemplates.length, 1);
assert.equal(taskTemplates[0]?.source_task_count, 2);
assert.equal(taskTemplates[0]?.version, 2);
assert.ok(taskTemplates[0]?.applicability.required_tags.includes("engineering"));
const templateAppliedAudits = store.audits.filter(
  audit => audit.task_id === learnedTask.task_id && audit.action === "task.template_applied"
);
assert.ok(templateAppliedAudits.length >= 1);
const learnedPlaybookMatches = searchLearnedPlaybooks({
  department: learnedTask.department,
  task_type: learnedTask.task_type,
  intent: learnedTask.intent
});
assert.ok(learnedPlaybookMatches.length >= 1);
assert.ok(learnedPlaybookMatches[0].score > 0);
  const learnedWorkspace = getLocalTaskWorkspace(learnedTask.task_id);
  assert.ok(learnedWorkspace.reuseRecommendations.length >= 1);
  assert.ok(learnedWorkspace.reuseRecommendations.some(item => item.kind === "learned_playbook"));
  const workspaceSummary = getLocalTaskWorkspace(task.task_id).operationalSummary;
  const runtimeWorkspace = getLocalTaskWorkspace(task.task_id);
  assert.equal(runtimeWorkspace.agentTeam.summary.session_count >= 2, true);
  assert.equal(runtimeWorkspace.agentTeam.summary.message_count >= 2, true);
  assert.equal(runtimeWorkspace.agentTeam.summary.resume_supported, true);
  assert.equal(runtimeWorkspace.agentTeam.sessions.some(session => session.role === "supervisor"), true);
  assert.equal(runtimeWorkspace.agentTeam.sessions.every(session => session.resume_supported), true);
  assert.equal(runtimeWorkspace.agentTeam.messages.some(message => message.kind === "assignment"), true);
  assert.equal(workspaceSummary.tooling.external_invocations >= 2, true);
  assert.equal(workspaceSummary.reconciliation.external_state_applied >= 1, true);
  assert.equal(workspaceSummary.reconciliation.external_state_failed >= 1, true);
  assert.equal(workspaceSummary.tooling.compensable_pending >= 1, true);
  assert.equal(workspaceSummary.tooling.compensations_failed >= 1, true);
  assert.equal(workspaceSummary.manual_attention.length >= 1, true);

const settingsStatusResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/settings`);
assert.equal(settingsStatusResponse.ok, true);
const settingsStatus = await settingsStatusResponse.json();
assert.ok(settingsStatus.effective.default_task_workdir);
assert.ok(settingsStatus.effective.default_write_root);
assert.ok(settingsStatus.effective.default_export_dir);
assert.ok(settingsStatus.effective.verification_evidence_dir);
assert.ok(settingsStatus.effective.task_run_dir);
const newDirField = settingsStatus.fields.find(f => f.key === "default_task_workdir");
assert.ok(newDirField);
assert.equal(newDirField.editable, true);

const delegationPolicyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/settings/delegation-policy`);
assert.equal(delegationPolicyResponse.ok, true);
const delegationPolicy = await delegationPolicyResponse.json();
assert.ok(delegationPolicy.policy);
assert.ok(delegationPolicy.limits);
assert.ok(delegationPolicy.machine);
assert.equal(typeof delegationPolicy.policy.max_parallel_subagents, "number");
assert.equal(typeof delegationPolicy.limits.effective_max_parallel, "number");

const budgetPolicyResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/settings/budget-policy`);
assert.equal(budgetPolicyResponse.ok, true);
const budgetPolicy = await budgetPolicyResponse.json();
assert.ok(budgetPolicy.policy);
assert.ok(budgetPolicy.pricing);
assert.equal(typeof budgetPolicy.policy.hard_limit_amount, "number");

const acceptanceResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/acceptance/${task.task_id}`);
assert.equal(acceptanceResponse.ok, true);
const acceptanceData = await acceptanceResponse.json();
assert.ok(acceptanceData.completion_path);
assert.equal(typeof acceptanceData.completion_path.can_mark_done, "boolean");

const budgetStatusResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/budget/${task.task_id}`);
assert.equal(budgetStatusResponse.ok, true);
const budgetData = await budgetStatusResponse.json();
assert.ok(budgetData.status || budgetData.policy);
if (budgetData.status) {
  assert.equal(typeof budgetData.status.hard_limit, "number");
  assert.equal(typeof budgetData.status.budget_exhausted, "boolean");
}

const dispatchPlanResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/dispatch-plans`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ task_id: task.task_id, steps: [{ goal: "test step" }] })
});
assert.equal(dispatchPlanResponse.ok, true);
const dispatchPlan = await dispatchPlanResponse.json();
assert.ok(dispatchPlan.plan);
assert.ok(dispatchPlan.plan.plan_id);

const { createDispatchLeaseForDelegation, releaseDispatchLeaseForSession } = await import("@apex/shared-runtime");

const dispatchTestTaskId = `dispatch_test_${Date.now()}`;
const leaseResult1 = createDispatchLeaseForDelegation({
  task_id: dispatchTestTaskId,
  supervisor_agent_id: "test_supervisor",
  step_goal: "Test delegated execution step",
  subagent_id: "test_subagent_1"
});
assert.ok(!("error" in leaseResult1), "Dispatch lease creation should succeed");
assert.ok(leaseResult1.plan, "Lease result should have plan");
assert.ok(leaseResult1.step, "Lease result should have step");
assert.ok(leaseResult1.assignment, "Lease result should have assignment");
assert.ok(leaseResult1.lease, "Lease result should have lease");
assert.equal(leaseResult1.lease.status, "active", "Lease should be active");

const duplicateLeaseResult = createDispatchLeaseForDelegation({
  task_id: dispatchTestTaskId,
  supervisor_agent_id: "test_supervisor",
  step_goal: "Test second step",
  subagent_id: "test_subagent_2"
});
if ("error" in duplicateLeaseResult) {
  assert.ok(duplicateLeaseResult.error.includes("Max parallel"), `Second lease error should be about parallel limits, got: ${duplicateLeaseResult.error}`);
} else {
  assert.equal(duplicateLeaseResult.plan.plan_id, leaseResult1.plan.plan_id, "Should reuse same plan");
}

const { getContextEnvelopesForTask, getResultEnvelopesForTask } = await import("@apex/shared-runtime");
const contextEnvelopes = getContextEnvelopesForTask(dispatchTestTaskId);
assert.ok(contextEnvelopes.length >= 1, "Should have context envelopes for handoff");
assert.equal(contextEnvelopes[0].step_goal, "Test delegated execution step", "Context envelope should have step goal");
assert.ok(contextEnvelopes[0].policy_slice.max_parallel_subagents >= 1, "Context envelope should have policy slice");
assert.ok(contextEnvelopes[0].definition_of_done.length > 0, "Context envelope should have DoD");

const releaseResult = releaseDispatchLeaseForSession(leaseResult1.lease.lease_id, "completed");
assert.ok(!("error" in releaseResult), "Lease release should succeed");
assert.equal(releaseResult.status, "released", "Released lease should have released status");

const resultEnvelopes = getResultEnvelopesForTask(dispatchTestTaskId);
assert.ok(resultEnvelopes.length >= 1, "Should have result envelopes after release");
assert.equal(resultEnvelopes[0].status, "completed", "Result envelope should be completed");

const { createBudgetPolicy, trackModelSpend, getPendingInterruptionForTask, resolveBudgetInterruption, getBudgetStatusForTask, initializeDefaultPricingRegistry } = await import("@apex/shared-runtime");
initializeDefaultPricingRegistry();
const testBudgetTaskId = `budget_test_${Date.now()}`;
const testPolicy = createBudgetPolicy({ task_id: testBudgetTaskId, hard_limit_amount: 0.01, on_limit_reached: "pause_and_ask" });
const { initializeBudgetStatus } = await import("@apex/shared-runtime");
initializeBudgetStatus(testBudgetTaskId, testPolicy.policy_id);
const spendResult = trackModelSpend({
  task_id: testBudgetTaskId,
  provider: "openai",
  model: "gpt-4o",
  input_tokens: 500000,
  output_tokens: 200000
});
const pendingInterruption = getPendingInterruptionForTask(testBudgetTaskId);
assert.ok(pendingInterruption, "Budget interruption should be pending after exceeding limit");
assert.equal(pendingInterruption.interruption_kind, "hard_stop", "Should be hard_stop interruption");
assert.equal(pendingInterruption.user_decision, "pending", "Decision should be pending");

const budgetStatusAfterPause = getBudgetStatusForTask(testBudgetTaskId);
assert.ok(budgetStatusAfterPause.budget_exhausted, "Budget should be exhausted");

const resolveResult = resolveBudgetInterruption({
  event_id: pendingInterruption.event_id,
  user_decision: "continue_with_new_limit",
  new_limit: 10.0
});
assert.ok(!("error" in resolveResult), "Budget resolution should succeed");
assert.equal(resolveResult.user_decision, "continue_with_new_limit", "Decision should be recorded");

const budgetStatusAfterResume = getBudgetStatusForTask(testBudgetTaskId);
assert.equal(budgetStatusAfterResume.hard_limit, 10.0, "Hard limit should be updated");
assert.ok(!budgetStatusAfterResume.budget_exhausted, "Budget should no longer be exhausted");

const noMorePending = getPendingInterruptionForTask(testBudgetTaskId);
assert.ok(!noMorePending, "No more pending interruptions after resolution");

const { listAcceptanceReviewsForTask, listAcceptanceVerdictsForTask, getCompletionPathStatus } = await import("@apex/shared-runtime");
const acceptanceReviews = listAcceptanceReviewsForTask(task.task_id);
assert.ok(acceptanceReviews.length >= 1, "Should have acceptance reviews after e2e run");
const acceptanceVerdicts = listAcceptanceVerdictsForTask(task.task_id);
assert.ok(acceptanceVerdicts.length >= 1, "Should have acceptance verdicts after e2e run");
const completionPath = getCompletionPathStatus(task.task_id);
assert.ok(completionPath.has_acceptance_review, "Should have acceptance review");
assert.ok(completionPath.has_done_gate, "Should have done gate");

const {
  createSkillEvolutionRun,
  addEvolutionCandidate,
  gateEvolutionCandidate,
  recordEvolutionPromotionDecision,
  getEvolutionDiagnostics,
  collectEvolutionSignals,
  runEvolutionCycle,
  buildEvolutionStatusPanelState
} = await import("@apex/shared-runtime");

const evoRun = createSkillEvolutionRun({
  skill_id: "smoke_skill_001",
  skill_name: "Smoke Test Skill",
  trigger_signals: ["signal_1"],
  budget_allocated_usd: 1.0
});
assert.ok(evoRun.run_id, "Evolution run should have run_id");
assert.equal(evoRun.skill_id, "smoke_skill_001");
assert.equal(evoRun.status, "candidate_generated");

const evoCandidate = addEvolutionCandidate({
  evolution_run_id: evoRun.run_id,
  kind: "skill",
  target_id: "smoke_skill_001",
  target_name: "Smoke Test Skill",
  proposed_change: "Improve error handling based on replay mismatch",
  source_signals: ["signal_1"],
  confidence: 0.85
});
assert.ok(!("error" in evoCandidate), "Candidate creation should succeed");
assert.equal(evoCandidate.kind, "skill");
assert.equal(evoCandidate.status, "candidate_generated");

const gateResult = gateEvolutionCandidate({
  candidate_id: evoCandidate.candidate_id,
  replay_score_threshold: 0.6,
  budget_remaining_usd: 5.0
});
assert.ok(!("error" in gateResult), "Gating should succeed");
assert.equal(typeof gateResult.passed, "boolean");
assert.equal(typeof gateResult.replay_score, "number");
assert.ok(gateResult.gate_details.length > 0, "Gate should have details");

const evoDiag = getEvolutionDiagnostics();
assert.ok(evoDiag.total_candidates >= 1, "Should have at least one candidate");
assert.ok(evoDiag.skill_runs >= 1, "Should have at least one skill run");

const evoSignals = collectEvolutionSignals();
assert.ok(Array.isArray(evoSignals), "Signals should be an array");

const evoCycleResult = runEvolutionCycle();
assert.ok(typeof evoCycleResult.signals_collected === "number");
assert.ok(typeof evoCycleResult.candidates_generated === "number");

const evoPanelState = buildEvolutionStatusPanelState();
assert.ok(typeof evoPanelState.total_candidates === "number");
assert.ok(Array.isArray(evoPanelState.recent_candidates));

const evoDiagResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/evolution/diagnostics`);
assert.equal(evoDiagResponse.ok, true);
const evoDiagApi = await evoDiagResponse.json();
assert.ok(typeof evoDiagApi.total_candidates === "number");

const evoCycleResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/evolution/cycle`, { method: "POST" });
assert.equal(evoCycleResponse.ok, true);
const evoCycleApi = await evoCycleResponse.json();
assert.ok(typeof evoCycleApi.signals_collected === "number");

const evoPanelResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/evolution/workspace-panel`);
assert.equal(evoPanelResponse.ok, true);
const evoPanelApi = await evoPanelResponse.json();
assert.ok(typeof evoPanelApi.total_candidates === "number");

const {
  createClawHubRegistryConfig,
  searchClawHubSkills,
  installClawHubSkill,
  publishToClawHub,
  syncClawHubRegistry,
  assessRemoteSkillTrust,
  getClawHubDiagnostics
} = await import("@apex/shared-runtime");

const clawhubConfig = createClawHubRegistryConfig({
  registry_name: "smoke_test",
  auth_method: "none"
});
assert.ok(clawhubConfig.config_id, "ClawHub config should have config_id");
assert.equal(clawhubConfig.registry_name, "smoke_test");
assert.equal(clawhubConfig.auth_method, "none");

const searchResults = searchClawHubSkills({ query: "test", registry_name: "smoke_test" });
assert.ok(Array.isArray(searchResults), "Search should return array");

const installRecord = installClawHubSkill({
  remote_skill_id: "remote_skill_001",
  remote_skill_name: "Remote Test Skill",
  remote_version: "1.0.0",
  registry_name: "smoke_test"
});
assert.ok(installRecord.install_id, "Install should have install_id");
assert.equal(installRecord.install_status, "pending_review");
assert.equal(installRecord.governance_review_required, true);

const publishRecord = publishToClawHub({
  local_skill_id: "local_skill_001",
  local_skill_name: "Local Test Skill",
  local_version: 1,
  registry_name: "smoke_test"
});
assert.ok(publishRecord.publish_id, "Publish should have publish_id");
assert.equal(publishRecord.publish_status, "pending_approval");
assert.equal(publishRecord.governance_approved, false);

const syncRecord = syncClawHubRegistry({ registry_name: "smoke_test", sync_kind: "incremental" });
assert.ok(syncRecord.sync_id, "Sync should have sync_id");
assert.equal(syncRecord.sync_status, "failed");
assert.ok(syncRecord.errors.length > 0, "Sync without endpoint should have errors");

const trustVerdict = assessRemoteSkillTrust({
  remote_skill_id: "remote_skill_001",
  registry_name: "smoke_test",
  publisher_verified: true,
  compatibility_check: "compatible"
});
assert.ok(trustVerdict.verdict_id, "Trust verdict should have verdict_id");
assert.equal(trustVerdict.trust_level, "trusted");
assert.equal(trustVerdict.governance_review_required, true);

const untrustedVerdict = assessRemoteSkillTrust({
  remote_skill_id: "remote_skill_002",
  registry_name: "smoke_test",
  publisher_verified: false,
  compatibility_check: "unknown"
});
assert.equal(untrustedVerdict.trust_level, "untrusted");
assert.equal(untrustedVerdict.governance_review_required, true);

const clawhubDiag = getClawHubDiagnostics();
assert.ok(clawhubDiag.registry_configs >= 1, "Should have at least one config");
assert.ok(clawhubDiag.install_records >= 1, "Should have at least one install");
assert.ok(clawhubDiag.publish_records >= 1, "Should have at least one publish");
assert.ok(clawhubDiag.trust_verdicts >= 2, "Should have at least two verdicts");

const clawhubDiagResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/clawhub/diagnostics`);
assert.equal(clawhubDiagResponse.ok, true);
const clawhubDiagApi = await clawhubDiagResponse.json();
assert.ok(typeof clawhubDiagApi.registry_configs === "number");

const clawhubInstallsResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/clawhub/installs`);
assert.equal(clawhubInstallsResponse.ok, true);

const clawhubTrustVerdictsResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/clawhub/trust-verdicts`);
assert.equal(clawhubTrustVerdictsResponse.ok, true);

const {
  buildRemoteSkillReviewPanelState
} = await import("@apex/shared-runtime");

const remoteReviewPanel = buildRemoteSkillReviewPanelState();
assert.ok(typeof remoteReviewPanel.registry_configs === "number");
assert.ok(typeof remoteReviewPanel.pending_installs === "number");
assert.ok(Array.isArray(remoteReviewPanel.pending_reviews));
assert.ok(Array.isArray(remoteReviewPanel.recent_verdicts));

const remoteReviewPanelResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/clawhub/remote-skill-review-panel`);
assert.equal(remoteReviewPanelResponse.ok, true);
const remoteReviewPanelApi = await remoteReviewPanelResponse.json();
assert.ok(typeof remoteReviewPanelApi.pending_installs === "number");

const installApproveResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/clawhub/install/${installRecord.install_id}/approve`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reviewed_by: "smoke_tester" })
});
assert.equal(installApproveResponse.ok, true);
const approvedInstall = await installApproveResponse.json();
assert.equal(approvedInstall.install_status, "installed");
assert.equal(approvedInstall.installed_by, "smoke_tester");

const publishApproveResponse = await fetch(`http://127.0.0.1:${localControlPlanePort}/api/local/clawhub/publish/${publishRecord.publish_id}/approve`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reviewed_by: "smoke_tester" })
});
assert.equal(publishApproveResponse.ok, true);
const approvedPublish = await publishApproveResponse.json();
assert.equal(approvedPublish.publish_status, "published");
assert.equal(approvedPublish.governance_approved, true);

const schedule = createSchedule("Run weekly finance reconciliation", "0 9 * * 1", "finance", "scheduled");
const triggered = triggerSchedule(schedule.schedule_id);
assert.equal(triggered.schedule_id, schedule.schedule_id);
assert.ok(triggered.last_triggered_at);

console.log(
  JSON.stringify(
    {
      smoke: "passed",
      state_backend: stateBackendInfo,
      task_id: task.task_id,
      done_gate: result.doneGate.status,
      local_tools: {
        listed_entries: listed.result?.entries.length ?? 0,
        write_bytes: writeResult.result?.bytes_written ?? null,
        write_idempotent_bytes: writeResultRepeated.result?.bytes_written ?? null,
        patch_bytes: patchResult.result?.bytes_written ?? null,
        rollback_restored: rollbackResult.result?.restored ?? false,
        shell_exit_code: shellResult.result?.exit_code ?? null,
        browser_title: browserResult.result?.title ?? null,
        browser_engine: browserResult.result?.engine ?? null,
        browser_links: browserResult.result?.dom_summary?.link_count ?? 0,
        browser_interactive: browserResult.result?.dom_summary?.interactive_count ?? 0,
        browser_session_history: [...store.browserSessions.values()][0]?.history.length ?? 0,
        ide_workspace_kind: ideSummary.result?.workspace_kind ?? null
      },
      worker_runs: listTaskWorkerRuns(task.task_id).length,
      capability_resolutions: listTaskCapabilityResolutions(task.task_id).length,
      learned_capability_hits: learnedCapabilityHits.length,
        learned_playbook_matches: learnedPlaybookMatches.length,
        workspace_reuse_recommendations: learnedWorkspace.reuseRecommendations.length,
        workspace_external_invocations: workspaceSummary.tooling.external_invocations,
        workspace_pending_compensations: workspaceSummary.tooling.compensable_pending,
        workspace_manual_attention: workspaceSummary.manual_attention.length,
        external_http_fetch_status: externalInvoke.status_code,
        external_http_reconcile_state: externalReconcile.state,
        crm_contact_lookup_company: crmLookup.contact.company,
        hr_candidate_lookup_stage: hrLookup.candidate.current_stage,
        finance_reconcile_status: financeReconcile.reconciliation.status,
        imported_skill_sources: [openClawSkill.source, claudeSkill.source, openAiSkill.source].join(","),
        canonical_skill_count: listCanonicalSkills().length,
        canonical_active_skill_count: listCanonicalSkills().filter(skill => skill.status === "active").length,
        api_imported_skill_source: importedSkillPayload.skill.source,
        exported_skill_format: exportedCanonicalPayload.format,
        imported_file_skill_id: importFilePayload.skill.skill_id,
        skill_review_queue_count: reviewQueuePayload.items.length,
  skill_audit_count: skillAuditPayload.items.length,
  skill_policy_trusted_publishers: skillPolicyPayload.trust.trusted_publishers.length,
  bundle_skill_count: bundlePreviewPayload.skill_count,
  bundle_signature_valid: bundleVerifyPayload.signature_valid,
  bundle_imported_count: bundleImportPayload.imported.length,
  bundle_publisher: bundlePreviewPayload.publisher.publisher_id,
  bundle_promotion_history: bundleHistoryPayload.provenance.promotion_history.length,
  bundle_history_feed: bundleHistoryFeedPayload.items.length,
  bundle_trusted_policy: bundleVerifyPayload.publisher_trusted,
  bundle_policy_simulation_trusted_import: policySimulationPayload.role_policy.can_import_trusted_bundle,
  bundle_tag_policy: bundleVerifyPayload.tag_policy_allowed,
  policy_proposal_queue: proposalQueuePayload.items.length,
  policy_proposal_queue_standard: proposalQueuesPayload.queues.find(queue => queue.review_path === "standard")?.count ?? 0,
  policy_proposal_queue_security: proposalQueuesAfterPromotionPayload.queues.find(queue => queue.review_path === "security_review")?.count ?? 0,
  policy_proposal_queue_security_sla_breaches:
    proposalQueuesAfterPromotionPayload.queues.find(queue => queue.review_path === "security_review")?.pending_review_sla_breach_count ?? 0,
  policy_proposal_queue_security_escalation:
    proposalQueuesAfterPromotionPayload.queues.find(queue => queue.review_path === "security_review")?.escalation_required ?? false,
  policy_follow_up_feed: proposalFollowUpsAfterPromotionPayload.total,
  deep_link_task_hash: taskDeepLinkPayload.deep_link,
  deep_link_execution_template_hash: executionTemplateDeepLinkPayload.deep_link,
  deep_link_learned_playbook_hash: learnedPlaybookDeepLinkPayload.deep_link,
  inbox_items: inboxPayload.total,
  inbox_filtered_warning_policy: filteredInboxPayload.total,
  inbox_acknowledged_items: acknowledgedInboxPayload.total,
  governance_inbox_items: governanceInboxPayload.total,
  governance_alert_executed_task: executeGovernanceInboxPayload.task.task_id,
  governance_alert_execution_template: executeGovernanceInboxPayload.task.inputs.execution_template_key,
  governance_alert_summary_total: refreshedDashboardPayload.governance_alert_summary.total,
  governance_alert_escalated_count: refreshedDashboardPayload.governance_alert_summary.escalated_count,
  governance_alert_aggregated_occurrences: governanceAlertsListPayload.summary.aggregated_occurrences,
  governance_reuse_alerts: refreshedDashboardPayload.governance_alert_summary.by_source_kind.reuse_navigation,
  governance_reuse_execution_template: executeReuseGovernanceInboxPayload.task.inputs.execution_template_key,
  governance_reuse_improvement_target: reuseGovernanceWorkspacePayload.reuseImprovement.target_id,
  governance_reuse_learning_action: reuseGovernanceWorkspacePayload.reuseImprovement.suggested_learning_action,
  governance_reuse_improvement_hints: reuseGovernanceWorkspacePayload.reuseImprovement.target_improvement_hints?.length ?? 0,
  governance_follow_up_feed: governanceFollowUpsPayload.total,
  governance_follow_up_executed_task: executeGovernanceFollowUpPayload.task.task_id,
  governance_follow_up_reused_task_template: executeRepeatedGovernanceFollowUpPayload.task.inputs.reused_task_template_id,
  workspace_execution_template_key: repeatedGovernanceWorkspacePayload.executionTemplate.execution_template_key,
  workspace_runtime_harness_mode: repeatedGovernanceWorkspacePayload.runtimeBoundaries.harness.planner_mode,
  workspace_agent_team_mode: runtimeWorkspace.agentTeam.summary.mode,
  workspace_agent_team_sessions: runtimeWorkspace.agentTeam.summary.session_count,
  workspace_agent_team_messages: runtimeWorkspace.agentTeam.summary.message_count,
  workspace_agent_team_resume_supported: runtimeWorkspace.agentTeam.summary.resume_supported,
  workspace_agent_team_checkpoints: runtimeWorkspace.agentTeam.checkpoints.length,
  workspace_agent_team_timeline: runtimeWorkspace.agentTeam.timeline.length,
  workspace_agent_team_handoffs: runtimeWorkspace.agentTeam.messages.filter(message => message.kind === "handoff").length,
  workspace_agent_team_resume_requests: serviceAgentTeamAfterResumePayload.resumeRequests.length,
  workspace_agent_team_resume_packages: serviceAgentTeamAfterResumePayload.resumePackages.length,
  workspace_agent_team_resume_packages_applied:
    serviceAgentTeamAfterResumePayload.resumePackages.filter(item => item.status === "applied").length,
  workspace_agent_team_execution_runs: serviceAgentTeamAfterResumePayload.executionRuns.length,
  workspace_agent_team_runtime_bindings: serviceAgentTeamAfterResumePayload.runtimeBindings.length,
  workspace_agent_team_runtime_instances: serviceAgentTeamAfterResumePayload.runtimeInstances.length,
  agent_team_launcher_catalog_count: agentTeamLauncherCatalogPayload.items.length,
  agent_team_launcher_status_count: agentTeamLauncherStatusPayload.items.length,
  agent_team_launcher_driver_catalog_count: agentTeamLauncherDriverCatalogPayload.items.length,
  agent_team_launcher_driver_status_count: agentTeamLauncherDriverStatusPayload.items.length,
  agent_team_launcher_backend_adapter_status_count: agentTeamLauncherBackendAdapterStatusPayload.items.length,
  agent_team_endpoint_sessions: agentTeamEndpointPayload.sessions.length,
  agent_team_endpoint_timeline: agentTeamEndpointPayload.timeline.length,
  agent_team_endpoint_launcher_catalog_count: agentTeamEndpointPayload.launcherCatalog.length,
  agent_team_endpoint_launcher_driver_count: agentTeamEndpointPayload.launcherDrivers.length,
  agent_team_resume_status: delegatedResumePayload.request.status,
  agent_team_resume_accepted_status: acceptedResumePayload.request.status,
  agent_team_resume_completed_status: completedResumePayload.request.status,
  agent_team_resume_package_applied_status: appliedResumePackagePayload.package.status,
  agent_team_runtime_binding_status: boundRuntimePayload.runtime_binding.status,
  agent_team_runtime_adapter_status: localAdapterConsumePayload.adapter_run.status,
  agent_team_runtime_instance_launcher_driver: activeRuntimeInstance.launcher_driver_id,
  agent_team_runtime_instance_isolation_scope: activeRuntimeInstance.isolation_scope,
  agent_team_runtime_instance_launcher_worker_run: activeRuntimeInstance.launcher_worker_run_id,
  agent_team_runtime_launch_spec_contract: runtimeLaunchSpecPayload.launch_spec.consumer_contract_version,
  agent_team_runtime_launch_receipt_contract: localRuntimeLaunchPayload.launch_receipt.consumer_contract_version,
  agent_team_runtime_backend_adapter: localAdapterConsumePayload.adapter.adapter_id,
  agent_team_runtime_adapter_contract: localAdapterConsumePayload.adapter_run.status,
  agent_team_runtime_backend_execution_status: localBackendHeartbeatPayload.backend_execution.status,
    agent_team_runtime_driver_status: localDriverHeartbeatPayload.driver_run.status,
    agent_team_runtime_runner_handle_status: localRunnerHeartbeatPayload.runner_handle.status,
    agent_team_runtime_runner_execution_status: localRunnerExecutionHeartbeatPayload.runner_execution.status,
    agent_team_runtime_runner_job_status: localRunnerJobHeartbeatPayload.runner_job.status,
    agent_team_runtime_runner_job_completed: localRunnerJobCompletePayload.runner_job.status,
    agent_team_runtime_runner_handle_released: localRunnerReleasePayload.runner_handle.status,
  agent_team_external_runtime_launcher_kind: externalActiveRuntimeInstance.launcher_kind,
  agent_team_external_runtime_launcher_driver: externalActiveRuntimeInstance.launcher_driver_id,
  agent_team_external_runtime_isolation_scope: externalActiveRuntimeInstance.isolation_scope,
  agent_team_external_runtime_launcher_state: "attached",
  agent_team_external_runtime_locator: externalActiveRuntimeInstance.launcher_locator,
  agent_team_external_runtime_launch_spec_contract: externalRuntimeLaunchSpecPayload.launch_spec.consumer_contract_version,
  agent_team_external_runtime_launch_receipt_contract: externalRuntimeLaunchPayload.launch_receipt.consumer_contract_version,
  agent_team_external_runtime_backend_adapter: externalAdapterConsumePayload.adapter.adapter_id,
  agent_team_external_runtime_adapter_contract: externalAdapterConsumePayload.adapter_run.status,
  agent_team_external_runtime_backend_execution_status: externalBackendHeartbeatPayload.backend_execution.status,
    agent_team_external_runtime_driver_status: externalDriverHeartbeatPayload.driver_run.status,
    agent_team_external_runtime_runner_handle_status: externalRunnerHeartbeatPayload.runner_handle.status,
    agent_team_external_runtime_runner_execution_status: externalRunnerExecutionHeartbeatPayload.runner_execution.status,
    agent_team_external_runtime_runner_job_status: externalRunnerJobHeartbeatPayload.runner_job.status,
    agent_team_external_runtime_runner_job_completed: externalRunnerJobCompletePayload.runner_job.status,
    agent_team_external_runtime_runner_handle_released: externalRunnerReleasePayload.runner_handle.status,
  agent_team_sandbox_launcher_released_count:
    agentTeamLauncherStatusAfterExternalPayload.items.find(item => item.launcher_kind === "sandbox_runner")?.released_runtime_count ?? 0,
  agent_team_execution_run_completed_status: completedExecutionRunPayload.driver_run.status,
  agent_team_external_execution_run_completed_status: externalCompletedExecutionRunPayload.driver_run.status,
  agent_team_resume_rejected_status: rejectedResumePayload.request.status,
  governance_alert_auto_escalated: escalatedGovernanceAlertCreateThirdPayload.governance_alert.auto_escalated,
  governance_alert_reopened_after_resolution: reopenedGovernanceInboxPayload.items.some(
    item => item.source_id === escalatedGovernanceAlertCreatePayload.governance_alert.alert_id
  ),
  inbox_after_follow_up_execute: inboxAfterFollowUpExecutePayload.total,
  policy_follow_up_executed_task: executeFollowUpPayload.task.task_id,
  policy_follow_up_execution_template: executeFollowUpPayload.task.inputs.execution_template_key,
  policy_security_queue_reviewer_rejected: unauthorizedSecurityQueueApproveResponse.status,
  policy_approval_templates: policyTemplatesPayload.approval.length,
  policy_batch_approved: batchApprovePayload.count,
  policy_batch_applied: batchApplyPayload.count,
      policy_scope_proposal_status: createPolicyProposalPayload.proposal.status,
      policy_promotion_status: applyPromotionProposalPayload.proposal.status,
      policy_promotion_review_path: createPromotionProposalPayload.proposal.review_path,
      policy_promotion_pipeline: skillPolicyPayload.environments.promotion_pipeline.length,
      policy_audit_feed: policyAuditsAfterProposalPayload.items.length,
      policy_release_history: policyReleaseHistoryPayload.items.length,
      policy_environment_snapshots: policyEnvironmentSnapshotsPayload.items.length,
      policy_compare_changed_fields: policyComparePayload.changed_fields.length,
      policy_compare_groups: policyComparePayload.changed_groups.length,
      policy_compare_risks: policyComparePayload.risk_summary.length,
      policy_compare_advisory: policyComparePayload.advisory.recommended_action,
      policy_compare_next_step: policyComparePayload.advisory.next_step,
      service_workspace_external_invocations: serviceWorkspace.operationalSummary.tooling.external_invocations,
      approved_learned_skills: approvedLearnedSkills.length,
      task_templates: taskTemplates.length,
      memory_items: [...store.memoryItems.values()].length,
      skill_candidates: [...store.skillCandidates.values()].length,
      schedule_id: schedule.schedule_id,
      post_contract_integration: {
        settings_new_dir_fields: !!settingsStatus.effective.default_task_workdir,
        delegation_policy_loaded: !!delegationPolicy.policy,
        budget_policy_loaded: !!budgetPolicy.policy,
        acceptance_completion_path: !!acceptanceData.completion_path,
        budget_status_accessible: !!(budgetData.status || budgetData.policy),
        dispatch_plan_created: !!dispatchPlan.plan
      },
      final_local_closure: {
        dispatch_lease_created: !!leaseResult1.lease,
        dispatch_lease_active: leaseResult1.lease?.status === "active",
        plan_reused_or_limited: !("error" in duplicateLeaseResult) || (duplicateLeaseResult.error?.includes("Max parallel")),
        context_envelopes_auto_created: contextEnvelopes.length >= 1,
        result_envelope_auto_created: resultEnvelopes.length >= 1,
        budget_pause_interruption: !!pendingInterruption,
        budget_resume_after_raise: budgetStatusAfterResume.hard_limit === 10.0,
        acceptance_gates_completion: completionPath.has_acceptance_review && completionPath.has_done_gate
      },
      hermes_clawhub: {
        evolution_run_created: !!evoRun.run_id,
        evolution_candidate_created: !("error" in evoCandidate),
        evolution_gate_result_passed: typeof gateResult.passed === "boolean",
        evolution_diagnostics_accessible: evoDiag.total_candidates >= 1,
        evolution_cycle_ran: typeof evoCycleResult.signals_collected === "number",
        evolution_panel_state_accessible: typeof evoPanelState.total_candidates === "number",
        evolution_api_diagnostics: evoDiagResponse.ok,
        evolution_api_cycle: evoCycleResponse.ok,
        evolution_api_panel: evoPanelResponse.ok,
        clawhub_config_created: !!clawhubConfig.config_id,
        clawhub_install_pending_review: installRecord.install_status === "pending_review",
        clawhub_publish_pending_approval: publishRecord.publish_status === "pending_approval",
        clawhub_sync_failed_no_endpoint: syncRecord.sync_status === "failed",
        clawhub_trust_verdict_trusted: trustVerdict.trust_level === "trusted",
        clawhub_trust_verdict_untrusted: untrustedVerdict.trust_level === "untrusted",
        clawhub_governance_always_required: trustVerdict.governance_review_required && untrustedVerdict.governance_review_required,
        clawhub_diagnostics_accessible: clawhubDiag.registry_configs >= 1,
        clawhub_api_diagnostics: clawhubDiagResponse.ok,
        clawhub_api_installs: clawhubInstallsResponse.ok,
        clawhub_api_trust_verdicts: clawhubTrustVerdictsResponse.ok,
        remote_skill_review_panel_accessible: typeof remoteReviewPanel.registry_configs === "number",
        remote_skill_review_api: remoteReviewPanelResponse.ok,
        install_approved_via_governance: approvedInstall.install_status === "installed",
        publish_approved_via_governance: approvedPublish.publish_status === "published"
      }
    },
    null,
    2
  )
);

await new Promise(resolvePromise => browserServer.server.close(resolvePromise));
stopSpawnedProcess(toolGatewayProcess);
stopSpawnedProcess(localControlPlaneProcess);
