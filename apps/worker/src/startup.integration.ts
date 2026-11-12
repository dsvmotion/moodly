import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "./testing/local-system-db.ts";

// El worker real arranca, ejecuta un workflow y para sin avisos de deprecación.
// En pg 8, dos consultas a la vez en el mismo cliente dan un DeprecationWarning;
// en pg 9 serán un error y el worker no arrancaría. Con --trace-deprecation, si
// vuelve a pasar, la salida del test lleva la pila que dice quién lo hizo.
const fixture = join(import.meta.dirname, "testing", "three-steps-worker.ts");
const dir = mkdtempSync(join(tmpdir(), "worker-startup-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const RUN_LIMIT_MS = 20_000;

function run(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number | null; output: string }> {
  const child = spawn(process.execPath, ["--trace-deprecation", fixture, ...args], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const timer = setTimeout(() => child.kill("SIGKILL"), RUN_LIMIT_MS);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

describe("arranque del worker", () => {
  it("arranca, ejecuta un workflow y para sin ningún DeprecationWarning (pg 9)", async () => {
    const api = localSupabaseApi();
    const env = {
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
      WORKER_APP_VERSION: "test-startup",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
    };

    const { code, output } = await run(["start", `testing:startup:${randomUUID()}`, join(dir, "effects.jsonl")], env);

    expect(code, output).toBe(0);
    expect(output).toContain('"msg":"worker arrancado"');
    expect(output).toContain('"msg":"worker parado"');
    expect(output, output).not.toContain("DeprecationWarning");
  });
});
