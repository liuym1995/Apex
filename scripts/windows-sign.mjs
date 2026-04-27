import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2];

if (!target) {
  console.error("Usage: node scripts/windows-sign.mjs <path-to-binary>");
  process.exit(1);
}

if (!existsSync(target)) {
  console.error(`Signing target does not exist: ${target}`);
  process.exit(1);
}

const customCommand = process.env.APEX_WINDOWS_SIGN_COMMAND?.trim();
if (customCommand) {
  const expanded = customCommand.replace(/%1/g, `"${target}"`);
  const result = spawnSync(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32" ? ["/d", "/s", "/c", expanded] : ["-lc", expanded],
    {
      stdio: "inherit",
      env: process.env
    }
  );
  process.exit(result.status ?? 1);
}

const certThumbprint = process.env.APEX_WINDOWS_CERT_THUMBPRINT?.trim();
const certFile = process.env.APEX_WINDOWS_CERT_FILE?.trim();
const certPassword = process.env.APEX_WINDOWS_CERT_PASSWORD ?? "";
const timestampUrl =
  process.env.APEX_WINDOWS_TIMESTAMP_URL?.trim() || "http://timestamp.digicert.com";
const signtool =
  process.env.APEX_SIGNTOOL_PATH?.trim() ||
  process.env.WINDOWS_SIGNTOOL_PATH?.trim() ||
  "signtool.exe";

if (!certThumbprint && !certFile) {
  console.error(
    "Windows signing is not configured. Set APEX_WINDOWS_SIGN_COMMAND or certificate environment variables."
  );
  process.exit(2);
}

const args = ["sign", "/fd", "SHA256", "/tr", timestampUrl, "/td", "SHA256"];

if (certFile) {
  args.push("/f", resolve(certFile));
  if (certPassword) {
    args.push("/p", certPassword);
  }
} else if (certThumbprint) {
  args.push("/sha1", certThumbprint);
}

args.push(target);

const result = spawnSync(signtool, args, {
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
