import { describe, expect, it } from "vitest";
import { loadConfig, WorkerConfigError } from "./config.ts";

// Se arma en tiempo de ejecución: un literal con forma de clave lo marcaría gitleaks.
const SECRET_KEY = `sb_secret_${"x".repeat(24)}`;
const valid = {
  WORKER_SYSTEM_DATABASE_URL: "postgresql://dbos_worker:secreto-largo@db.example.test:5432/postgres",
  WORKER_EXECUTOR_ID: "worker-1",
  WORKER_APP_VERSION: "3f2c1ab",
  SUPABASE_URL: "https://ref.supabase.co",
  SUPABASE_SECRET_KEY: SECRET_KEY,
};

describe("loadConfig", () => {
  it("lee la configuración y pone info por defecto", () => {
    expect(loadConfig(valid)).toEqual({
      systemDatabaseUrl: valid.WORKER_SYSTEM_DATABASE_URL,
      executorId: "worker-1",
      applicationVersion: "3f2c1ab",
      logLevel: "info",
      gitCommit: null,
      supabaseUrl: "https://ref.supabase.co",
      supabaseSecretKey: SECRET_KEY,
      aiGatewayApiKey: null,
      intentRouting: false,
    });
  });

  it("el enrutado por intención (PL-T3) está apagado salvo INTENT_ROUTING=on", () => {
    expect(loadConfig({ ...valid, INTENT_ROUTING: "on" }).intentRouting).toBe(true);
    expect(loadConfig({ ...valid, INTENT_ROUTING: "off" }).intentRouting).toBe(false);
    expect(() => loadConfig({ ...valid, INTENT_ROUTING: "yes" })).toThrow(/INTENT_ROUTING: on u off/);
  });

  it("la clave del gateway es opcional; vacía cuenta como ausente", () => {
    const key = `gw_${"k".repeat(30)}`;
    expect(loadConfig({ ...valid, AI_GATEWAY_API_KEY: key }).aiGatewayApiKey).toBe(key);
    expect(loadConfig({ ...valid, AI_GATEWAY_API_KEY: ` ${key}\n` }).aiGatewayApiKey).toBe(key);
    expect(loadConfig({ ...valid, AI_GATEWAY_API_KEY: "" }).aiGatewayApiKey).toBeNull();
    expect(loadConfig({ ...valid, AI_GATEWAY_API_KEY: "   " }).aiGatewayApiKey).toBeNull();
  });

  it.each(["corta", "con espacio en medio de la clave", "ñ".repeat(20)])("rechaza una clave del gateway que no lo parece sin decir cuál era", (key) => {
    let message = "";
    try {
      loadConfig({ ...valid, AI_GATEWAY_API_KEY: key });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/AI_GATEWAY_API_KEY/);
    expect(message).not.toContain(key);
  });

  it("toma el commit desplegado de Railway, solo para los logs", () => {
    const sha = "c7201c87d3efc093984c140a74012b8baca7cfb7";
    expect(loadConfig({ ...valid, RAILWAY_GIT_COMMIT_SHA: sha }).gitCommit).toBe(sha);
  });

  it("rechaza un commit que no lo es", () => {
    expect(() => loadConfig({ ...valid, RAILWAY_GIT_COMMIT_SHA: "main; rm -rf /" })).toThrow(/RAILWAY_GIT_COMMIT_SHA/);
  });

  it.each(["WORKER_SYSTEM_DATABASE_URL", "WORKER_EXECUTOR_ID", "WORKER_APP_VERSION", "SUPABASE_URL", "SUPABASE_SECRET_KEY"])("sin %s no arranca", (name) => {
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

  it("acepta la API local por http y quita la barra final", () => {
    expect(loadConfig({ ...valid, SUPABASE_URL: "http://127.0.0.1:54321/" }).supabaseUrl).toBe("http://127.0.0.1:54321");
  });

  it.each([
    "http://ref.supabase.co",
    "https://usuario:clave@ref.supabase.co",
    "https://ref.supabase.co/?apikey=x",
    "ref.supabase.co",
  ])("rechaza la URL de Supabase %j (http fuera de local, credenciales o parámetros)", (url) => {
    expect(() => loadConfig({ ...valid, SUPABASE_URL: url })).toThrow(/SUPABASE_URL/);
  });

  it.each(["eyJhbGciOiJIUzI1NiJ9.legacy.jwt", "sb_publishable_abcdefghijklmnopqrst", "sb_secret_corta"])(
    "rechaza una clave que no es secreta: %j",
    (key) => {
      expect(() => loadConfig({ ...valid, SUPABASE_SECRET_KEY: key })).toThrow(/SUPABASE_SECRET_KEY/);
    },
  );

  it("el error nunca incluye la clave secreta", () => {
    const key = "sb_secret_con espacios y no valida";
    expect(() => loadConfig({ ...valid, SUPABASE_SECRET_KEY: key })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("con espacios") }),
    );
  });
});
