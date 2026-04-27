import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveLocalSettingsPath(baseEnv = process.env) {
  const explicitPath = baseEnv.APEX_LOCAL_SETTINGS_PATH?.trim();
  if (explicitPath) {
    return resolve(explicitPath);
  }

  if (process.platform === "win32") {
    const localAppData = baseEnv.LOCALAPPDATA?.trim();
    return resolve(localAppData || resolve(homedir(), "AppData", "Local"), "CompanyBrain", "app-settings.json");
  }

  return resolve(baseEnv.XDG_CONFIG_HOME?.trim() || resolve(homedir(), ".config"), "apex", "app-settings.json");
}

function readSavedLocalDevRoot(baseEnv = process.env) {
  try {
    const settingsPath = resolveLocalSettingsPath(baseEnv);
    if (!existsSync(settingsPath)) {
      return null;
    }
    const raw = JSON.parse(readFileSync(settingsPath, "utf8"));
    const candidate = typeof raw?.local_dev_root === "string" ? raw.local_dev_root.trim() : "";
    return candidate ? resolve(candidate) : null;
  } catch {
    return null;
  }
}

function detectPreferredLocalDevRoot() {
  const configured = process.env.APEX_LOCAL_DEV_ROOT?.trim();
  if (configured) {
    return configured;
  }

  const saved = readSavedLocalDevRoot(process.env);
  if (saved) {
    return saved;
  }

  if (process.platform === "win32") {
    return "D:\\apex-localdev";
  }

  return resolve(rootDir, ".localdev");
}

const localDevRoot = detectPreferredLocalDevRoot();

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

function detectCargoMirrorConfig(baseEnv = process.env) {
  const preset = baseEnv.APEX_CARGO_MIRROR?.trim().toLowerCase();
  const explicitIndex = baseEnv.APEX_CARGO_INDEX_URL?.trim();

  if (explicitIndex) {
    return {
      mode: "custom",
      sourceName: "apex-custom-sparse",
      registry: explicitIndex.startsWith("sparse+") ? explicitIndex : `sparse+${explicitIndex}`
    };
  }

  if (!preset || preset === "default" || preset === "official" || preset === "none") {
    return null;
  }

  if (preset === "rsproxy") {
    return {
      mode: "preset",
      sourceName: "apex-rsproxy-sparse",
      registry: "sparse+https://rsproxy.cn/index/"
    };
  }

  throw new Error(
    `Unsupported APEX_CARGO_MIRROR preset "${preset}". Supported values: rsproxy, official, none.`
  );
}

function buildCargoHomeConfig(baseEnv = process.env) {
  const mirror = detectCargoMirrorConfig(baseEnv);
  const lines = [
    "[registries.crates-io]",
    'protocol = "sparse"',
    "",
    "[http]",
    "timeout = 120",
    "multiplexing = false",
    "",
    "[net]",
    "retry = 10"
  ];

  if (mirror) {
    lines.push(
      "",
      "[source.crates-io]",
      `replace-with = "${mirror.sourceName}"`,
      "",
      `[source.${mirror.sourceName}]`,
      `registry = "${mirror.registry}"`,
      "",
      `[registries.${mirror.sourceName}]`,
      `index = "${mirror.registry}"`
    );
  }

  return `${lines.join("\n")}\n`;
}

export function ensureDesktopEnvDirs() {
  return {
    rootDir,
    localDevRoot,
    cargoHome: ensureDir(resolve(localDevRoot, "cargo-home")),
    rustupHome: ensureDir(resolve(localDevRoot, "rustup-home")),
    cargoTargetDir: ensureDir(resolve(localDevRoot, "cargo-target")),
    tempDir: ensureDir(resolve(localDevRoot, "tmp")),
    npmCacheDir: ensureDir(resolve(localDevRoot, "npm-cache")),
    playwrightBrowsersPath: ensureDir(resolve(localDevRoot, "playwright-browsers")),
    toolingDir: ensureDir(resolve(localDevRoot, "tooling"))
  };
}

export function buildDesktopEnv(baseEnv = process.env) {
  const dirs = ensureDesktopEnvDirs();
  const cargoBinDir = resolve(dirs.cargoHome, "bin");
  const mirror = detectCargoMirrorConfig(baseEnv);

  return {
    ...baseEnv,
    APEX_LOCAL_DEV_ROOT: dirs.localDevRoot,
    CARGO_HOME: dirs.cargoHome,
    RUSTUP_HOME: dirs.rustupHome,
    CARGO_TARGET_DIR: dirs.cargoTargetDir,
    TMP: dirs.tempDir,
    TEMP: dirs.tempDir,
    PLAYWRIGHT_BROWSERS_PATH: dirs.playwrightBrowsersPath,
    npm_config_cache: dirs.npmCacheDir,
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL: baseEnv.CARGO_REGISTRIES_CRATES_IO_PROTOCOL ?? "sparse",
    CARGO_HTTP_TIMEOUT: baseEnv.CARGO_HTTP_TIMEOUT ?? "120",
    CARGO_NET_RETRY: baseEnv.CARGO_NET_RETRY ?? "10",
    CARGO_HTTP_MULTIPLEXING: baseEnv.CARGO_HTTP_MULTIPLEXING ?? "false",
    ...(mirror ? { APEX_EFFECTIVE_CARGO_MIRROR: mirror.registry } : {}),
    Path: `${cargoBinDir};${baseEnv.Path ?? ""}`
  };
}

export function getDesktopEnvSummary() {
  const dirs = ensureDesktopEnvDirs();
  return {
    rootDir,
    ...dirs
  };
}

export function syncCargoHomeConfig(baseEnv = process.env) {
  const dirs = ensureDesktopEnvDirs();
  const configPath = resolve(dirs.cargoHome, "config.toml");
  writeFileSync(configPath, buildCargoHomeConfig(baseEnv), "utf8");
  return configPath;
}
