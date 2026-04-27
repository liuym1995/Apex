import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ensureDesktopEnvDirs } from "./desktop-env.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
const args = process.argv.slice(2);

if (!npmCli) {
  console.error("npm_execpath is not available. Run this script through npm.");
  process.exit(1);
}

function parseArgs(argv) {
  let unsigned = false;
  let installer = null;
  const passthrough = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--unsigned") {
      unsigned = true;
      continue;
    }
    if (arg === "--installer") {
      installer = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    passthrough.push(arg);
  }

  return { unsigned, installer, passthrough };
}

const options = parseArgs(args);

function run(command, commandArgs, { cwd = rootDir, env = process.env } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: "inherit",
    env
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNode(args, opts) {
  run(process.execPath, args, opts);
}

function runNpm(args, opts) {
  run(process.execPath, [npmCli, ...args], opts);
}

function hasSigningConfig() {
  return Boolean(
    process.env.APEX_WINDOWS_SIGN_COMMAND?.trim() ||
      process.env.APEX_WINDOWS_CERT_THUMBPRINT?.trim() ||
      process.env.APEX_WINDOWS_CERT_FILE?.trim()
  );
}

function collectFiles(root) {
  if (!existsSync(root)) {
    return [];
  }
  const results = [];
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function compressDirectory(sourceDir, zipPath) {
  run(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -LiteralPath '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
    ],
    { cwd: rootDir }
  );
}

function stagePortableRelease({
  dirs,
  signed,
  releaseRoot,
  releaseBinary,
  portableNodeRoot,
  portableCompanionRoot
}) {
  const portableRoot = resolve(releaseRoot, "portable");
  const portableResourcesRoot = resolve(portableRoot, "resources");
  const portableNodeTarget = resolve(portableResourcesRoot, "node");
  const portableCompanionTarget = resolve(portableResourcesRoot, "local-control-plane");

  mkdirSync(portableNodeTarget, { recursive: true });
  mkdirSync(portableCompanionTarget, { recursive: true });

  copyFileSync(releaseBinary, resolve(portableRoot, "apex-desktop-shell.exe"));

  for (const file of collectFiles(portableNodeRoot)) {
    const destination = resolve(portableNodeTarget, relative(portableNodeRoot, file));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(file, destination);
  }

  for (const file of collectFiles(portableCompanionRoot)) {
    const destination = resolve(portableCompanionTarget, relative(portableCompanionRoot, file));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(file, destination);
  }

  if (signed) {
    runNode([resolve(rootDir, "scripts", "windows-sign.mjs"), resolve(portableRoot, "apex-desktop-shell.exe")]);
    runNode([resolve(rootDir, "scripts", "windows-sign.mjs"), resolve(portableNodeTarget, "node.exe")]);
  }

  const zipPath = resolve(releaseRoot, "apex-portable-windows.zip");
  compressDirectory(portableRoot, zipPath);

  return {
    portableRoot,
    zipPath
  };
}

runNpm(["run", "prepare:portable-node"]);
runNpm(["run", "prepare:tauri-build"]);

const dirs = ensureDesktopEnvDirs();
const signed = !options.unsigned && hasSigningConfig();
const buildArgs = ["scripts/tauri-cli.mjs", "build", "--no-bundle", ...options.passthrough];
if (!signed) {
  buildArgs.push("--no-sign");
}
runNode(buildArgs);

const releaseBinary = resolve(dirs.cargoTargetDir, "release", "apex-desktop-shell.exe");
const portableNodeRoot = resolve(rootDir, "apps", "desktop-shell", "src-tauri", "resources", "node");
const portableCompanionRoot = resolve(rootDir, "apps", "desktop-shell", "src-tauri", "resources", "local-control-plane");
const releaseRoot = resolve(dirs.localDevRoot, "releases", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(releaseRoot, { recursive: true });

const portableRelease = stagePortableRelease({
  dirs,
  signed,
  releaseRoot,
  releaseBinary,
  portableNodeRoot,
  portableCompanionRoot
});

let installerBundleRoot = null;
if (options.installer) {
  const installerArgs = ["scripts/tauri-cli.mjs", "build", "--bundles", options.installer, ...options.passthrough];
  if (!signed) {
    installerArgs.push("--no-sign");
  }
  runNode(installerArgs);

  const bundleRoot = resolve(dirs.cargoTargetDir, "release", "bundle");
  installerBundleRoot = bundleRoot;
  const installerStageRoot = resolve(releaseRoot, "installer");
  mkdirSync(installerStageRoot, { recursive: true });
  for (const file of collectFiles(bundleRoot)) {
    const destination = resolve(installerStageRoot, relative(bundleRoot, file));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(file, destination);
  }
}

console.log(
  JSON.stringify(
    {
      signed,
      portableRoot: portableRelease.portableRoot,
      portableZip: portableRelease.zipPath,
      installer: options.installer ?? null,
      installerBundleRoot
    },
    null,
    2
  )
);
