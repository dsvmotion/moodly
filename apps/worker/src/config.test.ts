import { describe, expect, it } from "vitest";
import { loadConfig, WorkerConfigError } from "./config.ts";

const valid = {
  WORKER_SYSTEM_DATABASE_URL: "postgresql://dbos_worker:secreto-largo@db.example.test:5432/postgres",
  WORKER_EXECUTOR_ID: "worker-1",
  WORKER_APP_VERSION: "3f2c1ab",
};

describe("loadConfig", () => {
  it("lee la configuración y pone info por defecto", () => {
    expect(loadConfig(valid)).toEqual({
      systemDatabaseUrl: valid.WORKER_SYSTEM_DATABASE_URL,
      executorId: "worker-1",
      applicationVersion: "3f2c1ab",
      logLevel: "info",
    });
  });

  it.each(["WORKER_SYSTEM_DATABASE_URL", "WORKER_EXECUTOR_ID", "WORKER_APP_VERSION"])("sin %s no arranca", (name) => {
    const env: Record<string, string | undefined> = { ...valid, [name]: undefined };
    expect(() => loadConfig(env)).toThrow(WorkerConfigError);
    expect(() => loadConfig(env)).toThrow(name);
  });

  it("rechaza el pooler en modo transacción (6543): DBOS necesita LISTEN/NOTIFY", () => {
    const env = { ...valid, WORKER_SYSTEM_DATABASE_URL: "postgresql://dbos_worker.ref:secreto@pooler.example.test:6543/postgres" };
    expect(() => loadConfig(env)).toThrow(/6543/);
  });

  it("acepta el pooler en modo sesión (5432)", () => {
    const env = { ...valid, WORKER_SYSTEM_DATABASE_URL: "postgres://dbos_worker.ref:secreto@pooler.example.test:5432/postgres" };
    expect(loadConfig(env).systemDatabaseUrl).toBe(env.WORKER_SYSTEM_DATABASE_URL);
  });

  it.each(["https://db.example.test", "no-es-una-url", ""])("rechaza una URL que no es de Postgres: %s", (url) => {
    expect(() => loadConfig({ ...valid, WORKER_SYSTEM_DATABASE_URL: url })).toThrow(WorkerConfigError);
  });

  it.each(["", "Worker 1", "-empieza-por-guion", "a".repeat(65)])("rechaza el executorID %j", (id) => {
    expect(() => loadConfig({ ...valid, WORKER_EXECUTOR_ID: id })).toThrow(/WORKER_EXECUTOR_ID/);
  });

  it("rechaza un nivel de log desconocido", () => {
    expect(() => loadConfig({ ...valid, LOG_LEVEL: "verbose" })).toThrow(WorkerConfigError);
  });

  it("el error nunca incluye la URL ni su contraseña", () => {
    const urls = [
      "postgresql://dbos_worker:secreto-largo@pooler.example.test:6543/postgres",
      "https://dbos_worker:secreto-largo@db.example.test",
    ];
    for (const url of urls) {
      expect(() => loadConfig({ ...valid, WORKER_SYSTEM_DATABASE_URL: url })).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining("secreto-largo") }),
      );
    }
  });
});
