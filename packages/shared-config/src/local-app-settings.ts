import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const LOCAL_APP_SETTINGS_VERSION = 1 as const;

export const EditableLocalAppSettingsSchema = z.object({
  install_completed: z.boolean().optional(),
  workspace_root: z.string().min(1).optional(),
  default_output_dir: z.string().min(1).optional(),
  default_task_workdir: z.string().min(1).optional(),
  default_write_root: z.string().min(1).optional(),
  default_export_dir: z.string().min(1).optional(),
  artifact_dir: z.string().min(1).optional(),
  export_dir: z.string().min(1).optional(),
  verification_evidence_dir: z.string().min(1).optional(),
  task_run_dir: z.string().min(1).optional(),
  local_dev_root: z.string().min(1).optional()
});

export const LocalAppSettingsSchema = z.object({
  config_version: z.literal(LOCAL_APP_SETTINGS_VERSION),
  install_completed: z.boolean().default(false),
  workspace_root: z.string(),
  default_output_dir: z.string(),
  default_task_workdir: z.string(),
  default_write_root: z.string(),
  default_export_dir: z.string(),
  artifact_dir: z.string(),
  export_dir: z.string(),
  verification_evidence_dir: z.string(),
  task_run_dir: z.string(),
  local_dev_root: z.string(),
  local_db_path: z.string(),
  updated_at: z.string().optional()
});

export type EditableLocalAppSettings = z.infer<typeof EditableLocalAppSettingsSchema>;
export type LocalAppSettings = z.infer<typeof LocalAppSettingsSchema>;

function resolveBaseConfigDir(overrides: Record<string, string | undefined> = process.env): string {
  const explicitSettingsPath = overrides.APEX_LOCAL_SETTINGS_PATH?.trim();
  if (explicitSettingsPath) {
    return dirname(resolve(explicitSettingsPath));
  }

  if (process.platform === "win32") {
    const localAppData = overrides.LOCALAPPDATA?.trim();
    if (localAppData) {
      return resolve(localAppData, "CompanyBrain");
    }
    return resolve(homedir(), "AppData", "Local", "CompanyBrain");
  }

  const xdgConfigHome = overrides.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) {
    return resolve(xdgConfigHome, "apex");
  }

  return resolve(homedir(), ".config", "apex");
}

export function resolveLocalAppSettingsPath(
  overrides: Record<string, string | undefined> = process.env
): string {
  const explicitPath = overrides.APEX_LOCAL_SETTINGS_PATH?.trim();
  if (explicitPath) {
    return resolve(explicitPath);
  }
  return resolve(resolveBaseConfigDir(overrides), "app-settings.json");
}

export function resolveDefaultLocalDevRoot(
  overrides: Record<string, string | undefined> = process.env
): string {
  const explicitRoot = overrides.APEX_LOCAL_DEV_ROOT?.trim();
  if (explicitRoot) {
    return resolve(explicitRoot);
  }

  if (process.platform === "win32") {
    return "D:\\apex-localdev";
  }

  return resolve(resolveBaseConfigDir(overrides), "localdev");
}

function resolveDefaultWorkspaceRoot(
  cwd: string = process.cwd(),
  overrides: Record<string, string | undefined> = process.env
): string {
  const explicitRoot = overrides.APEX_WORKSPACE_ROOT?.trim();
  return explicitRoot ? resolve(explicitRoot) : resolve(cwd);
}

export function buildRecommendedLocalAppSettings(
  overrides: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd()
): LocalAppSettings {
  const workspaceRoot = resolveDefaultWorkspaceRoot(cwd, overrides);
  const localDevRoot = resolveDefaultLocalDevRoot(overrides);
  return {
    config_version: LOCAL_APP_SETTINGS_VERSION,
    install_completed: false,
    workspace_root: workspaceRoot,
    default_output_dir: resolve(workspaceRoot, "output"),
    default_task_workdir: resolve(workspaceRoot, "work"),
    default_write_root: resolve(workspaceRoot, "output"),
    default_export_dir: resolve(localDevRoot, "exports"),
    artifact_dir: resolve(localDevRoot, "artifacts"),
    export_dir: resolve(localDevRoot, "exports"),
    verification_evidence_dir: resolve(localDevRoot, "verification"),
    task_run_dir: resolve(localDevRoot, "tasks"),
    local_dev_root: localDevRoot,
    local_db_path:
      overrides.APEX_LOCAL_DB_PATH?.trim()
        ? resolve(overrides.APEX_LOCAL_DB_PATH)
        : resolve(localDevRoot, "data", "local-control-plane.sqlite")
  };
}

function readPersistedLocalAppSettings(
  overrides: Record<string, string | undefined> = process.env
): EditableLocalAppSettings | null {
  const path = resolveLocalAppSettingsPath(overrides);
  if (!existsSync(path)) {
    return null;
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return EditableLocalAppSettingsSchema.parse(raw);
}

export function loadLocalAppSettings(
  overrides: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd()
): LocalAppSettings {
  const defaults = buildRecommendedLocalAppSettings(overrides, cwd);
  const persisted = readPersistedLocalAppSettings(overrides);
  if (!persisted) {
    return defaults;
  }

  const localDevRoot = persisted.local_dev_root ? resolve(persisted.local_dev_root) : defaults.local_dev_root;
  const workspaceRoot = persisted.workspace_root ? resolve(persisted.workspace_root) : defaults.workspace_root;

  return LocalAppSettingsSchema.parse({
    config_version: LOCAL_APP_SETTINGS_VERSION,
    install_completed: persisted.install_completed ?? false,
    workspace_root: workspaceRoot,
    default_output_dir: persisted.default_output_dir
      ? resolve(persisted.default_output_dir)
      : resolve(workspaceRoot, "output"),
    default_task_workdir: persisted.default_task_workdir
      ? resolve(persisted.default_task_workdir)
      : resolve(workspaceRoot, "work"),
    default_write_root: persisted.default_write_root
      ? resolve(persisted.default_write_root)
      : resolve(workspaceRoot, "output"),
    default_export_dir: persisted.default_export_dir
      ? resolve(persisted.default_export_dir)
      : resolve(localDevRoot, "exports"),
    artifact_dir: persisted.artifact_dir ? resolve(persisted.artifact_dir) : resolve(localDevRoot, "artifacts"),
    export_dir: persisted.export_dir ? resolve(persisted.export_dir) : resolve(localDevRoot, "exports"),
    verification_evidence_dir: persisted.verification_evidence_dir
      ? resolve(persisted.verification_evidence_dir)
      : resolve(localDevRoot, "verification"),
    task_run_dir: persisted.task_run_dir
      ? resolve(persisted.task_run_dir)
      : resolve(localDevRoot, "tasks"),
    local_dev_root: localDevRoot,
    local_db_path:
      overrides.APEX_LOCAL_DB_PATH?.trim()
        ? resolve(overrides.APEX_LOCAL_DB_PATH)
        : resolve(localDevRoot, "data", "local-control-plane.sqlite"),
    updated_at: existsSync(resolveLocalAppSettingsPath(overrides))
      ? new Date().toISOString()
      : undefined
  });
}

export function saveLocalAppSettings(
  input: EditableLocalAppSettings,
  overrides: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd()
): LocalAppSettings {
  const current = loadLocalAppSettings(overrides, cwd);
  const nextLocalDevRoot = input.local_dev_root ? resolve(input.local_dev_root) : current.local_dev_root;
  const nextWorkspaceRoot = input.workspace_root ? resolve(input.workspace_root) : current.workspace_root;

  const persisted = {
    config_version: LOCAL_APP_SETTINGS_VERSION,
    install_completed: input.install_completed ?? current.install_completed,
    workspace_root: nextWorkspaceRoot,
    default_output_dir: input.default_output_dir
      ? resolve(input.default_output_dir)
      : current.default_output_dir,
    default_task_workdir: input.default_task_workdir
      ? resolve(input.default_task_workdir)
      : current.default_task_workdir,
    default_write_root: input.default_write_root
      ? resolve(input.default_write_root)
      : current.default_write_root,
    default_export_dir: input.default_export_dir
      ? resolve(input.default_export_dir)
      : current.default_export_dir,
    artifact_dir: input.artifact_dir ? resolve(input.artifact_dir) : current.artifact_dir,
    export_dir: input.export_dir ? resolve(input.export_dir) : current.export_dir,
    verification_evidence_dir: input.verification_evidence_dir
      ? resolve(input.verification_evidence_dir)
      : current.verification_evidence_dir,
    task_run_dir: input.task_run_dir
      ? resolve(input.task_run_dir)
      : current.task_run_dir,
    local_dev_root: nextLocalDevRoot,
    updated_at: new Date().toISOString()
  };

  const settingsPath = resolveLocalAppSettingsPath(overrides);
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
  return loadLocalAppSettings(overrides, cwd);
}

export function resolveTaskDirectoryPaths(settings: LocalAppSettings, taskId: string): {
  task_workdir: string;
  task_write_root: string;
  task_export_dir: string;
  task_artifact_dir: string;
  task_verification_dir: string;
  task_run_dir: string;
  screenshot_dir: string;
  recording_dir: string;
  ocr_dir: string;
  replay_dir: string;
} {
  return {
    task_workdir: resolve(settings.default_task_workdir, taskId),
    task_write_root: settings.default_write_root,
    task_export_dir: settings.default_export_dir,
    task_artifact_dir: settings.artifact_dir,
    task_verification_dir: settings.verification_evidence_dir,
    task_run_dir: resolve(settings.task_run_dir, taskId),
    screenshot_dir: resolve(settings.artifact_dir, "screenshots"),
    recording_dir: resolve(settings.artifact_dir, "recordings"),
    ocr_dir: resolve(settings.artifact_dir, "ocr"),
    replay_dir: resolve(settings.artifact_dir, "replay")
  };
}
