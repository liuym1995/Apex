import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
const nodeResourceDir = resolve(rootDir, "apps", "desktop-shell", "src-tauri", "resources", "node");
const manifestPath = resolve(nodeResourceDir, "manifest.json");

if (!npmCli) {
  console.error("npm_execpath is not available. Run this script through npm.");
  process.exit(1);
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

function resolvePortableNodeSource() {
  const configured = process.env.APEX_PORTABLE_NODE_SOURCE?.trim();
  if (configured && existsSync(configured)) {
    return {
      version: process.env.APEX_PORTABLE_NODE_VERSION?.trim() || process.version.replace(/^v/, ""),
      nodeExePath: configured,
      licensePath: null,
      source: "configured_path"
    };
  }

  runNpm(["run", "setup:node:portable"]);

  const version = (process.env.APEX_PORTABLE_NODE_VERSION?.trim() || process.version).replace(/^v/, "");
  const nodeExePath = resolve(
    process.env.APEX_LOCAL_DEV_ROOT?.trim() || "D:\\apex-localdev",
    "tooling",
    `node-v${version}-win-${process.arch === "arm64" ? "arm64" : "x64"}`,
    "node.exe"
  );
  const licensePath = resolve(
    process.env.APEX_LOCAL_DEV_ROOT?.trim() || "D:\\apex-localdev",
    "tooling",
    `node-v${version}-win-${process.arch === "arm64" ? "arm64" : "x64"}`,
    "LICENSE"
  );

  return {
    version,
    nodeExePath,
    licensePath: existsSync(licensePath) ? licensePath : null,
    source: "downloaded_archive"
  };
}

const portableNode = resolvePortableNodeSource();
await rm(nodeResourceDir, { recursive: true, force: true });
await mkdir(nodeResourceDir, { recursive: true });
await copyFile(portableNode.nodeExePath, resolve(nodeResourceDir, "node.exe"));

if (portableNode.licensePath) {
  await copyFile(portableNode.licensePath, resolve(nodeResourceDir, "LICENSE"));
}

await writeFile(
  manifestPath,
  JSON.stringify(
    {
      runtime: "node",
      version: portableNode.version,
      source: portableNode.source,
      prepared_at: new Date().toISOString()
    },
    null,
    2
  ),
  "utf8"
);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
console.log(JSON.stringify(manifest, null, 2));
