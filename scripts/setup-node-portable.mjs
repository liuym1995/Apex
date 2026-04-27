import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { buildDesktopEnv, ensureDesktopEnvDirs } from "./desktop-env.mjs";

const dirs = ensureDesktopEnvDirs();
const env = buildDesktopEnv(process.env);
const version = (process.env.APEX_PORTABLE_NODE_VERSION?.trim() || process.version).replace(/^v/, "");
const platform = process.platform === "win32" ? "win" : process.platform;
const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;

if (platform !== "win") {
  console.error("Portable Node setup is currently implemented for Windows packaging only.");
  process.exit(1);
}

if (!["x64", "arm64"].includes(arch)) {
  console.error(`Unsupported Windows architecture for portable Node: ${arch}`);
  process.exit(1);
}

const archiveBaseName = `node-v${version}-${platform}-${arch}`;
const archiveName = `${archiveBaseName}.zip`;
const downloadUrl = `https://nodejs.org/dist/v${version}/${archiveName}`;
const shasumsUrl = `https://nodejs.org/dist/v${version}/SHASUMS256.txt`;
const toolingNodeRoot = resolve(dirs.toolingDir, archiveBaseName);
const archivePath = resolve(dirs.toolingDir, archiveName);
const nodeExePath = resolve(toolingNodeRoot, "node.exe");
const licensePath = resolve(toolingNodeRoot, "LICENSE");
const manifestPath = resolve(toolingNodeRoot, "portable-node.manifest.json");

async function downloadFile(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  await pipeline(response.body, createWriteStream(destinationPath));
}

async function computeFileSha256(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex").toLowerCase();
}

async function readPortableNodeManifest() {
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

async function writePortableNodeManifest(payload) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(payload, null, 2), "utf8");
}

async function verifyArchiveChecksum() {
  const actualHash = await computeFileSha256(archivePath);
  const cachedManifest = await readPortableNodeManifest();
  if (
    cachedManifest &&
    cachedManifest.version === version &&
    cachedManifest.archive_name === archiveName &&
    cachedManifest.sha256 === actualHash
  ) {
    return { verification: "local_manifest", sha256: actualHash };
  }

  const checksumsResponse = await fetch(shasumsUrl);
  if (!checksumsResponse.ok) {
    throw new Error(`Failed to fetch SHASUMS256.txt for Node ${version}: ${checksumsResponse.status}`);
  }
  const checksumsText = await checksumsResponse.text();
  const expectedLine = checksumsText
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.endsWith(`  ${archiveName}`) || line.endsWith(` *${archiveName}`));

  if (!expectedLine) {
    throw new Error(`Could not find checksum entry for ${archiveName}`);
  }

  const expectedHash = expectedLine.split(/\s+/)[0].toLowerCase();

  if (expectedHash !== actualHash) {
    throw new Error(`Checksum mismatch for ${archiveName}. Expected ${expectedHash}, got ${actualHash}.`);
  }

  await writePortableNodeManifest({
    version,
    archive_name: archiveName,
    sha256: actualHash,
    download_url: downloadUrl,
    verified_from: shasumsUrl,
    verified_at: new Date().toISOString()
  });

  return { verification: "remote_shasums", sha256: actualHash };
}

function runPowerShellExpandArchive(sourcePath, destinationDir) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -LiteralPath '${sourcePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`
      ],
      {
        cwd: dirs.rootDir,
        env,
        stdio: "inherit"
      }
    );

    child.on("exit", code => {
      if (code === 0) {
        resolvePromise(undefined);
      } else {
        rejectPromise(new Error(`Expand-Archive exited with code ${code ?? 1}`));
      }
    });
  });
}

async function ensurePortableNode() {
  if (!existsSync(archivePath) && existsSync(nodeExePath)) {
    return {
      version,
      archivePath: null,
      nodeExePath,
      licensePath: existsSync(licensePath) ? licensePath : null,
      verification: "existing_runtime"
    };
  }

  if (!existsSync(archivePath)) {
    console.log(`Downloading portable Node ${version} from ${downloadUrl}`);
    await downloadFile(downloadUrl, archivePath);
  }

  let verification = "unknown";
  try {
    verification = (await verifyArchiveChecksum()).verification;
  } catch (error) {
    if (!existsSync(nodeExePath)) {
      throw error;
    }
    console.warn(
      `Portable Node checksum verification could not be refreshed (${error instanceof Error ? error.message : String(error)}). ` +
        "Reusing the existing extracted runtime."
    );
    verification = "existing_runtime";
  }

  if (!existsSync(nodeExePath)) {
    await rm(toolingNodeRoot, { recursive: true, force: true });
    await mkdir(dirname(toolingNodeRoot), { recursive: true });
    await runPowerShellExpandArchive(archivePath, dirname(toolingNodeRoot));
  }

  const nodeStat = await stat(nodeExePath);
  if (!nodeStat.isFile()) {
    throw new Error(`Portable Node executable was not extracted: ${nodeExePath}`);
  }

  return {
    version,
    archivePath: existsSync(archivePath) ? archivePath : null,
    nodeExePath,
    licensePath: existsSync(licensePath) ? licensePath : null,
    verification
  };
}

const result = await ensurePortableNode();
console.log(
  JSON.stringify(
    {
      portableNodeVersion: result.version,
      archive: result.archivePath ? basename(result.archivePath) : null,
      nodeExePath: result.nodeExePath,
      verification: result.verification
    },
    null,
    2
  )
);
