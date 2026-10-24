import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { localSystemDatabaseUrl } from "./testing/local-system-db.ts";

// Tarea 6 de la Fase 0 (ADR 0027): el worker real, con el rol sin DDL y el
// esquema que migra el CI, retoma un workflow tras matar el proceso con SIGKILL
// y no repite los pasos que ya había terminado.
const fixture = join(import.meta.dirname, "testing", "three-steps-worker.ts");
const dir = mkdtempSync(join(tmpdir(), "worker-resume-"));
// Un worker que se queda esperando no puede sobrevivir al test: seguiría
// conectado a la base de datos y estorbaría a las ejecuciones siguientes.
const children = new Set<ChildProcess>();
afterAll(() => {
  for (const child of children) child.kill("SIGKILL");
  rmSync(dir, { recursive: true, force: true });
});

// Muy por debajo del testTimeout: si un worker no termina, el test falla con
// su salida en vez de por tiempo.
const RUN_LIMIT_MS = 20_000;

interface Run {
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
  timedOut: boolean;
}

interface Started {
  child: ChildProcess;
  /** Lo que lleva escrito el proceso hasta ahora. */
  output(): string;
  done: Promise<Run>;
}

function startWorker(args: string[], env: NodeJS.ProcessEnv): Started {
  const child = spawn(process.execPath, [fixture, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let output = "";
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, RUN_LIMIT_MS);
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const done = new Promise<Run>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      resolve({ code, signal, output, timedOut });
    });
  });
  return { child, output: () => output, done };
}

function runWorker(args: string[], env: NodeJS.ProcessEnv): Promise<Run> {
  return startWorker(args, env).done;
}

async function waitFor(condition: () => boolean, what: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`no llegó a pasar: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function effects(file: string): { step: string; pid: number }[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { step: string; pid: number });
}

describe("worker con DBOS: reanudación tras SIGKILL", () => {
  const systemDatabaseUrl = localSystemDatabaseUrl();
  const password = new URL(systemDatabaseUrl).password;
  // Un executorID por ejecución del test (regla 1): no recoge runs de otras.
  const env = {
    ...process.env,
    WORKER_SYSTEM_DATABASE_URL: systemDatabaseUrl,
    WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
    WORKER_APP_VERSION: "test-resume",
    LOG_LEVEL: "info",
  };

  it("muere tras el paso 2, vuelve con el mismo executorID y solo ejecuta el 3", async () => {
    const workflowId = `testing:resume:${randomUUID()}`;
    const file = join(dir, `${randomUUID()}.jsonl`);

    const crashed = await runWorker(["start", workflowId, file], { ...env, CRASH_AFTER_STEP2: "1" });
    expect(crashed.timedOut, crashed.output).toBe(false);
    expect(crashed.signal).toBe("SIGKILL");
    expect(effects(file).map((e) => e.step)).toEqual(["step1", "step2"]);

    const recovered = await runWorker(["recover", workflowId, file], env);
    expect(recovered.timedOut, `no se reanudó en ${RUN_LIMIT_MS} ms\n${recovered.output}`).toBe(false);
    expect(recovered.code, recovered.output).toBe(0);

    const all = effects(file);
    expect(all.map((e) => e.step)).toEqual(["step1", "step2", "step3"]);
    // Los pasos 1 y 2 los hizo el proceso muerto; el 3, el nuevo.
    expect(all[0]?.pid).toBe(all[1]?.pid);
    expect(all[2]?.pid).not.toBe(all[0]?.pid);

    // Logs JSON del worker (ADR 0032): arrancó con el rol dbos_worker y la
    // contraseña no sale en ningún log, tampoco en los de DBOS.
    expect(recovered.output).toContain('"msg":"worker arrancado"');
    expect(crashed.output + recovered.output).not.toContain(password);
  });

  it("dos procesos con el mismo executorID no se solapan: el segundo espera a que muera el primero", async () => {
    const workflowId = `testing:overlap:${randomUUID()}`;
    const file = join(dir, `${randomUUID()}.jsonl`);
    // Un executorID propio: el de los otros tests no debe recoger este run.
    const overlapEnv = { ...env, WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}` };

    // A, vivo y con el paso 3 en curso.
    const a = startWorker(["start", workflowId, file], { ...overlapEnv, HANG_IN_STEP3: "1" });
    await waitFor(() => effects(file).some((e) => e.step === "step3-begin"), "A empieza el paso 3");

    // B arranca con el mismo executorID: sin el lock recuperaría el run y
    // repetiría el paso 3 a la vez que A (regla 1). Con el lock, espera.
    const b = startWorker(["recover", workflowId, file], overlapEnv);
    await waitFor(() => b.output().includes("otro proceso tiene este executorID"), "B avisa de que espera");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(effects(file).map((e) => e.step)).toEqual(["step1", "step2", "step3-begin"]);

    // Muere A: su conexión se cierra, Postgres suelta el lock y B sigue.
    a.child.kill("SIGKILL");
    await a.done;
    const recovered = await b.done;
    expect(recovered.timedOut, `B no terminó en ${RUN_LIMIT_MS} ms\n${recovered.output}`).toBe(false);
    expect(recovered.code, recovered.output).toBe(0);
    expect(recovered.output).toContain('"msg":"lock del executor tomado"');

    const all = effects(file);
    expect(all.map((e) => e.step)).toEqual(["step1", "step2", "step3-begin", "step3"]);
    // El paso en curso de A se repite en B (regla 2: «al menos una vez»), pero
    // nunca a la vez: B solo lo empezó después de morir A.
    expect(all[3]?.pid).toBe(b.child.pid);
    expect(all[2]?.pid).toBe(a.child.pid);
  });

  it("sin el rol del worker (contraseña incorrecta) no arranca y no enseña la contraseña", async () => {
    const url = new URL(systemDatabaseUrl);
    url.password = `mal-${randomUUID()}`;
    const failed = await runWorker(["recover", `testing:none:${randomUUID()}`, join(dir, "none.jsonl")], {
      ...env,
      WORKER_SYSTEM_DATABASE_URL: url.toString(),
    });
    expect(failed.timedOut, failed.output).toBe(false);
    expect(failed.code).not.toBe(0);
    expect(failed.output).not.toContain(url.password);
  });
});
