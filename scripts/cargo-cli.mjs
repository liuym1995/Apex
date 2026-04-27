import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { buildDesktopEnv, ensureDesktopEnvDirs, syncCargoHomeConfig } from "./desktop-env.mjs";

const cargoArgs = process.argv.slice(2);

if (cargoArgs.length === 0) {
  console.error("Usage: node scripts/cargo-cli.mjs <cargo-args...>");
  process.exit(1);
}

const dirs = ensureDesktopEnvDirs();
syncCargoHomeConfig(process.env);
const env = buildDesktopEnv(process.env);
const cwd = resolve(dirs.rootDir, "apps", "desktop-shell", "src-tauri");

const child =
  process.platform === "win32"
    ? spawn(resolve(dirs.cargoHome, "bin", "cargo.exe"), cargoArgs, {
        cwd,
        env,
        stdio: "inherit"
      })
    : spawn("cargo", cargoArgs, {
        cwd,
        env,
        stdio: "inherit"
      });

child.on("exit", code => {
  process.exit(code ?? 1);
});
