import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// La imagen del worker (Dockerfile) lleva cada paquete del monorepo que el
// worker usa, directa o indirectamente: si falta uno, el worker de Railway no
// arranca, y ningún test unitario lo vería (usan el código fuente).

const ROOT = join(import.meta.dirname, "..", "..", "..");
const dockerfile = readFileSync(join(ROOT, "apps/worker/Dockerfile"), "utf8");

interface Manifest {
  name: string;
  dependencies?: Record<string, string>;
}
const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as Manifest;

/** Directorio de cada paquete del monorepo en packages/, por nombre. */
const packageDirs = new Map(
  readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [read(`packages/${entry.name}/package.json`).name, entry.name] as const),
);

const workspaceDeps = (manifest: Manifest) =>
  Object.entries(manifest.dependencies ?? {})
    .filter(([, version]) => version.startsWith("workspace:"))
    .map(([name]) => name);

/** Los paquetes del monorepo que el worker usa en producción, también a través de otros. */
function usedPackages(): string[] {
  const seen = new Set<string>();
  const pending = workspaceDeps(read("apps/worker/package.json"));
  while (pending.length > 0) {
    const name = pending.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    const dir = packageDirs.get(name);
    if (!dir) throw new Error(`${name} no está en packages/`);
    pending.push(...workspaceDeps(read(`packages/${dir}/package.json`)));
  }
  return [...seen].sort();
}

describe("imagen del worker", () => {
  it("sabe qué paquetes del monorepo usa el worker", () => {
    expect(usedPackages()).toEqual(["@repo/agent-core", "@repo/config", "@repo/db", "@repo/integrations", "@repo/knowledge", "@repo/skills"]);
  });

  it.each(usedPackages())("copia %s: lo compilado, su package.json y sus dependencias", (name) => {
    const dir = packageDirs.get(name) as string;
    expect(dockerfile).toContain(`COPY --from=build /repo/packages/${dir}/dist ./packages/${dir}/dist`);
    expect(dockerfile).toContain(`COPY packages/${dir}/package.json ./packages/${dir}/`);
    const hasDeps = Object.keys(read(`packages/${dir}/package.json`).dependencies ?? {}).length > 0;
    if (hasDeps) expect(dockerfile).toContain(`COPY --from=prod-deps /repo/packages/${dir}/node_modules ./packages/${dir}/node_modules`);
  });
});
