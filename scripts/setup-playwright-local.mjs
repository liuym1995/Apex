import { spawn } from "node:child_process";
import { buildDesktopEnv, ensureDesktopEnvDirs } from "./desktop-env.mjs";

const dirs = ensureDesktopEnvDirs();
const env = buildDesktopEnv(process.env);

const child = spawn(
  process.platform === "win32" ? "cmd.exe" : "npx",
  process.platform === "win32"
    ? ["/d", "/s", "/c", "npx playwright install chromium"]
    : ["playwright", "install", "chromium"],
  {
    cwd: dirs.rootDir,
    env,
    stdio: "inherit"
  }
);

child.on("exit", code => {
  process.exit(code ?? 1);
});
