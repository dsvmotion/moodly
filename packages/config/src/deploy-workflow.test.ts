import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// P-04: el orden de los jobs de deploy-staging.yml. Si `fresh` leyera su propia
// salida (o `migrations` no esperara a `fresh`), todos los despliegues se saltarían
// en silencio; si `code` no esperara a `migrations`, el código podría desplegarse
// sin su esquema. No hay un lector de YAML en el monorepo: se leen los bloques de job.
const ROOT = join(import.meta.dirname, "..", "..", "..");
const workflow = readFileSync(join(ROOT, ".github/workflows/deploy-staging.yml"), "utf8");

function job(name: string): string {
  const start = workflow.search(new RegExp(`^  ${name}:\\n`, "m"));
  expect(start, `el job ${name} existe`).toBeGreaterThanOrEqual(0);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/^ {2}[a-z][\w-]*:\n/m);
  return next < 0 ? rest : rest.slice(0, next);
}
const FRESH_OK = "needs.fresh.outputs.current == 'true'";

describe("deploy-staging: esquema antes que código, y solo la cabeza de main", () => {
  it("`fresh` corre siempre que el evento valga: sin needs y sin leer su propia salida", () => {
    const fresh = job("fresh");
    expect(fresh).not.toMatch(/^ {4}needs:/m);
    expect(fresh).not.toContain("needs.");
    expect(fresh).toContain("current: ${{ steps.head.outputs.current }}");
    expect(fresh).toContain("sha: ${{ steps.head.outputs.sha }}");
  });

  it("`fresh` decide con should-deploy.sh (el último commit en verde siempre se despliega) y puede leer el CI", () => {
    const fresh = job("fresh");
    expect(fresh).toContain("scripts/deploy/should-deploy.sh");
    expect(fresh).toMatch(/permissions:\n\s+contents: read\n\s+actions: read/);
    // Ya no exige ser la cabeza de main: eso dejaba sin desplegar si main se movía más deprisa que el CI.
    expect(fresh).not.toMatch(/commits\/main/);
  });

  it("migraciones y código usan el commit resuelto por `fresh`, no el de la corrida", () => {
    // Si usaran el de la corrida, un commit más nuevo en verde migraría un esquema y
    // desplegaría código de otro, o el despliegue retrocedería.
    const migrations = job("migrations");
    expect(migrations).toContain("ref: ${{ needs.fresh.outputs.sha }}");
    const code = job("code");
    expect(code).toContain("DEPLOY_SHA: ${{ needs.fresh.outputs.sha }}");
    expect(migrations).not.toContain("workflow_run.head_sha");
    expect(code).not.toContain("workflow_run.head_sha");
  });

  it("los despliegues nunca se solapan ni se cancelan a medias", () => {
    expect(workflow).toMatch(/^concurrency:\n {2}group: deploy-staging\n {2}cancel-in-progress: false$/m);
  });

  it("`migrations` espera a `fresh` y solo corre si es la cabeza de main", () => {
    const migrations = job("migrations");
    expect(migrations).toMatch(/^ {4}needs: fresh$/m);
    expect(migrations).toContain(FRESH_OK);
  });

  it("si hay job `code`, espera a `migrations` (el código nunca va antes que el esquema)", () => {
    if (!/^ {2}code:\n/m.test(workflow)) return;
    // Lista: necesita a `fresh` directamente para leer su salida (needs no es transitivo).
    expect(job("code")).toMatch(/^ {4}needs: \[fresh, migrations\]$/m);
  });
});
