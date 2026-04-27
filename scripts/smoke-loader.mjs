import { join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = resolvePath(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const distRoot = join(rootDir, "packages", "shared-local-core", "dist", "packages");

const aliasMap = new Map([
  ["@apex/shared-local-core", join(distRoot, "shared-local-core", "src", "index.js")],
  ["@apex/shared-observability", join(distRoot, "shared-observability", "src", "index.js")],
  ["@apex/shared-runtime", join(distRoot, "shared-runtime", "src", "index.js")],
  ["@apex/shared-state", join(distRoot, "shared-state", "src", "index.js")],
  ["@apex/shared-types", join(distRoot, "shared-types", "src", "index.js")]
]);

export async function resolve(specifier, context, nextResolve) {
  const mapped = aliasMap.get(specifier);
  if (mapped) {
    return {
      url: pathToFileURL(mapped).href,
      shortCircuit: true
    };
  }
  return nextResolve(specifier, context);
}
