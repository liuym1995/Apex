import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { buildDesktopEnv, ensureDesktopEnvDirs, syncCargoHomeConfig } from "./desktop-env.mjs";

const mode = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!mode || !["dev", "build", "info"].includes(mode)) {
  console.error("Usage: node scripts/tauri-cli.mjs <dev|build|info> [...args]");
  process.exit(1);
}

const dirs = ensureDesktopEnvDirs();
syncCargoHomeConfig(process.env);
const env = buildDesktopEnv(process.env);
const cwd = resolve(dirs.rootDir, "apps", "desktop-shell");

const child =
  process.platform === "win32"
    ? spawn(
        "cmd.exe",
        ["/d", "/s", "/c", `npx @tauri-apps/cli@2 ${mode}${extraArgs.length ? ` ${extraArgs.join(" ")}` : ""}`],
        {
          cwd,
          env,
          stdio: "inherit"
        }
      )
    : spawn("npx", ["@tauri-apps/cli@2", mode, ...extraArgs], {
        cwd,
        env,
        stdio: "inherit"
      });

child.on("exit", code => {
  process.exit(code ?? 1);
});
