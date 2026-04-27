import { z } from "zod";

const BaseEnvSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().default("apex-service")
});

export type BaseEnv = z.infer<typeof BaseEnvSchema>;

export function loadBaseEnv(overrides: Record<string, string | undefined> = process.env): BaseEnv {
  return BaseEnvSchema.parse(overrides);
}

export {
  RemoteControlPlaneEnvSchema,
  type RemoteControlPlaneEnv,
  loadRemoteControlPlaneEnv
} from "./remote-control-plane-config.js";

export {
  LibSQLConfigSchema,
  type LibSQLConfig,
  loadLibSQLConfig,
  OTELCollectorConfigSchema,
  type OTELCollectorConfig,
  loadOTELCollectorConfig
} from "./infra-config.js";

export {
  EditableLocalAppSettingsSchema,
  LocalAppSettingsSchema,
  type EditableLocalAppSettings,
  type LocalAppSettings,
  resolveLocalAppSettingsPath,
  resolveDefaultLocalDevRoot,
  buildRecommendedLocalAppSettings,
  loadLocalAppSettings,
  saveLocalAppSettings,
  resolveTaskDirectoryPaths
} from "./local-app-settings.js";
