import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error("npm_execpath is unavailable. Run this script through npm.");
  process.exit(1);
}

const processes = [];
let shuttingDown = false;

function startWorkspace(label, args) {
  const child = spawn(process.execPath, [npmCli, ...args], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR ?? "1"
    }
  });

  child.on("exit", code => {
    if (shuttingDown) return;
    console.error(`[desktop-supervisor] ${label} exited with code ${code ?? 0}`);
    shutdown(code ?? 1);
  });

  child.on("error", error => {
    if (shuttingDown) return;
    console.error(`[desktop-supervisor] ${label} failed to start`);
    console.error(error);
    shutdown(1);
  });

  processes.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode), 150);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

startWorkspace("local-control-plane", ["run", "dev", "-w", "@apex/local-control-plane"]);
startWorkspace("desktop-shell", ["run", "dev", "-w", "@apex/desktop-shell", "--", "--host", "127.0.0.1", "--port", "4173"]);

console.log("[desktop-supervisor] local-control-plane and desktop-shell started");
