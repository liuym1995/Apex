import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entryPoint = resolve(rootDir, "apps", "local-control-plane", "src", "index.ts");
const outputDir = resolve(rootDir, "apps", "desktop-shell", "src-tauri", "resources", "local-control-plane");
const outputFile = resolve(outputDir, "index.cjs");
const manifestFile = resolve(outputDir, "manifest.json");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await build({
  entryPoints: [entryPoint],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info",
  external: ["playwright"]
});

await writeFile(
  manifestFile,
  JSON.stringify(
    {
      name: "apex-local-control-plane",
      entry: "index.cjs",
      runtime: "node",
      generated_at: new Date().toISOString(),
      optional_external_dependencies: ["playwright"]
    },
    null,
    2
  ),
  "utf8"
);
