import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error("npm_execpath is not available. Run this script through npm.");
  process.exit(1);
}

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpm(args) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const iconPath = resolve(rootDir, "apps", "desktop-shell", "src-tauri", "icons", "icon.ico");
if (!existsSync(iconPath)) {
  runNpm(["run", "generate:desktop-icons"]);
}

runNpm(["run", "bundle:desktop"]);
runNpm(["run", "prepare:portable-node"]);
runNodeScript(resolve(rootDir, "scripts", "prepare-tauri-companion.mjs"));
