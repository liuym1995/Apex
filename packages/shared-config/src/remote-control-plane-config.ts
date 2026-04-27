import { z } from "zod";

const DEVELOPMENT_JWT_SECRET = "dev-secret-change-in-production";
const DEVELOPMENT_API_KEY_SALT = "dev-salt-change-in-production";

export const RemoteControlPlaneEnvSchema = z.object({
  PORT: z.coerce.number().int().default(3020),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().default("remote-control-plane"),
  DATABASE_URL: z.string().default("http://127.0.0.1:8080"),
  DATABASE_AUTH_TOKEN: z.string().default(""),
  DATABASE_SYNC_INTERVAL_MS: z.coerce.number().int().default(5000),
  DATABASE_SYNC_URL: z.string().default(""),
  JWT_SECRET: z.string().default(DEVELOPMENT_JWT_SECRET),
  JWT_ISSUER: z.string().default("apex-rcp"),
  JWT_AUDIENCE: z.string().default("apex-services"),
  JWT_EXPIRY_SECONDS: z.coerce.number().int().default(3600),
  API_KEY_SALT: z.string().default(DEVELOPMENT_API_KEY_SALT),
  CORS_ORIGINS: z.string().default("*"),
  RATE_LIMIT_MAX: z.coerce.number().int().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(""),
  OTEL_SERVICE_NAME: z.string().default("remote-control-plane"),
  LOCAL_CONTROL_PLANE_URL: z.string().default("http://127.0.0.1:3010"),
  SYNC_ENABLED: z.coerce.boolean().default(false),
  SYNC_INTERVAL_MS: z.coerce.number().int().default(30000),
  FLEET_HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().default(60000),
  MAX_FLEET_AGENTS: z.coerce.number().int().default(100),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;
  if (env.JWT_SECRET === DEVELOPMENT_JWT_SECRET || env.JWT_SECRET.trim().length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "Production remote control plane requires an explicit JWT_SECRET with at least 32 characters."
    });
  }
  if (env.API_KEY_SALT === DEVELOPMENT_API_KEY_SALT || env.API_KEY_SALT.trim().length < 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["API_KEY_SALT"],
      message: "Production remote control plane requires an explicit API_KEY_SALT with at least 16 characters."
    });
  }
  if (env.CORS_ORIGINS.trim() === "*") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CORS_ORIGINS"],
      message: "Production remote control plane must not use wildcard CORS_ORIGINS."
    });
  }
});

export type RemoteControlPlaneEnv = z.infer<typeof RemoteControlPlaneEnvSchema>;

export function loadRemoteControlPlaneEnv(
  overrides: Record<string, string | undefined> = process.env
): RemoteControlPlaneEnv {
  return RemoteControlPlaneEnvSchema.parse(overrides);
}
