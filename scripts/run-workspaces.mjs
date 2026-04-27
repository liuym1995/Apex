import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const targetScript = process.argv[2];

if (!targetScript) {
  console.error("Usage: node scripts/run-workspaces.mjs <script-name>");
  process.exit(1);
}

function expandWorkspace(pattern) {
  if (!pattern.endsWith("/*")) {
    return [join(rootDir, pattern)];
  }

  const baseDir = join(rootDir, pattern.slice(0, -2));
  return readdirSync(baseDir)
    .map(entry => join(baseDir, entry))
    .filter(entry => statSync(entry).isDirectory());
}

function hasScript(workspaceDir, scriptName) {
  const workspacePackageJson = JSON.parse(readFileSync(join(workspaceDir, "package.json"), "utf8"));
  return Boolean(workspacePackageJson.scripts?.[scriptName]);
}

const workspaces = packageJson.workspaces.flatMap(expandWorkspace);
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("npm_execpath is not available. Run this script through npm.");
  process.exit(1);
}

for (const workspaceDir of workspaces) {
  if (!hasScript(workspaceDir, targetScript)) continue;
  if (targetScript === "build" || targetScript === "typecheck") {
    rmSync(join(workspaceDir, "dist"), { recursive: true, force: true });
  }
  console.log(`\n> workspace ${workspaceDir}`);
  const result = spawnSync(process.execPath, [npmCli, "run", targetScript], {
    cwd: workspaceDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS
        ? `${process.env.NODE_OPTIONS} --max-old-space-size=12288`
        : "--max-old-space-size=12288"
    }
  });
  if (result.error) {
    console.error(`Failed to run '${targetScript}' in ${workspaceDir}`);
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
