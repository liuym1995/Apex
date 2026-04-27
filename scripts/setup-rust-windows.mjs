import { existsSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { buildDesktopEnv, ensureDesktopEnvDirs, syncCargoHomeConfig } from "./desktop-env.mjs";

if (process.platform !== "win32") {
  console.error("This setup script is intended for Windows only.");
  process.exit(1);
}

const dirs = ensureDesktopEnvDirs();
syncCargoHomeConfig(process.env);
const env = buildDesktopEnv(process.env);
const rustupInitPath = resolve(dirs.toolingDir, "rustup-init.exe");

async function downloadRustupInit() {
  if (existsSync(rustupInitPath)) {
    return;
  }

  const response = await fetch("https://win.rustup.rs/x86_64");
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download rustup-init.exe: ${response.status}`);
  }

  await pipeline(response.body, createWriteStream(rustupInitPath));
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: dirs.rootDir,
      env,
      stdio: "inherit"
    });

    child.on("exit", code => {
      if (code === 0) {
        resolvePromise(undefined);
      } else {
        rejectPromise(new Error(`${command} exited with code ${code ?? 1}`));
      }
    });
  });
}

async function main() {
  console.log("Preparing local Rust environment under:", dirs.localDevRoot);
  await downloadRustupInit();
  await run(rustupInitPath, [
    "-y",
    "--profile",
    "minimal",
    "--no-modify-path",
    "--default-toolchain",
    "stable"
  ]);
  await run(resolve(dirs.cargoHome, "bin", "cargo.exe"), ["--version"]);
  await run(resolve(dirs.cargoHome, "bin", "rustc.exe"), ["--version"]);
  console.log("Rust toolchain is now installed into the D-drive local development directory.");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
