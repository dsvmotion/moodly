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
  WORKER_DATABASE_URL: "postgresql://moodly_worker:secreto-largo@db.example.test:5432/postgres",
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
      workerDatabaseUrl: valid.WORKER_DATABASE_URL,
      aiGatewayApiKey: null,
      resendApiKey: null,
      webAppUrl: null,
      intentRouting: false,
      healthPort: 8080,
      nango: null,
    });
  });

  it("WORKER_DATABASE_URL es obligatoria y tiene que ser moodly_worker (directo o por el pooler)", () => {
    const pooled = "postgresql://moodly_worker.sgeswmdqstonegceusej:secreto@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
    expect(loadConfig({ ...valid, WORKER_DATABASE_URL: pooled }).workerDatabaseUrl).toBe(pooled);
    expect(() => loadConfig({ ...valid, WORKER_DATABASE_URL: undefined })).toThrow(/falta WORKER_DATABASE_URL/);
    for (const url of [
      "postgresql://postgres:secreto@db.example.test:5432/postgres",
      "postgresql://service_role:secreto@db.example.test:5432/postgres",
      "postgresql://dbos_worker:secreto@db.example.test:5432/postgres",
      "postgresql://moodly_worker_x:secreto@db.example.test:5432/postgres",
      "https://moodly_worker:secreto@db.example.test/postgres",
      "no es una url",
    ]) {
      expect(() => loadConfig({ ...valid, WORKER_DATABASE_URL: url }), url).toThrow(WorkerConfigError);
    }
  });

  it("los errores de WORKER_DATABASE_URL no llevan su valor (la contraseña)", () => {
    try {
      loadConfig({ ...valid, WORKER_DATABASE_URL: "postgresql://postgres:muy-secreta@db.example.test/postgres" });
      throw new Error("no lanzó");
    } catch (error) {
      expect((error as Error).message).not.toContain("muy-secreta");
    }
  });

  it("Nango (O-02): hacen falta las dos claves; la URL base por defecto es Nango Cloud; http solo en loopback", () => {
    const secret = `nango-${"s".repeat(24)}`;
    const signing = "00000000-0000-4000-8000-00000000000a";
    expect(loadConfig({ ...valid, NANGO_API_KEY: secret }).nango).toBeNull();
    expect(loadConfig({ ...valid, NANGO_WEBHOOK_SIGNING_KEY: signing }).nango).toBeNull();
    expect(loadConfig({ ...valid, NANGO_API_KEY: secret, NANGO_WEBHOOK_SIGNING_KEY: signing }).nango).toEqual({
      secretKey: secret,
      webhookSigningKey: signing,
      host: "https://api.nango.dev",
    });
    expect(loadConfig({ ...valid, NANGO_API_KEY: secret, NANGO_WEBHOOK_SIGNING_KEY: signing, NANGO_HOST: "https://nango.eu.example.com/" }).nango?.host).toBe(
      "https://nango.eu.example.com",
    );
    for (const bad of ["http://nango.example.com", "https://u:p@nango.example.com", "nango"]) {
      expect(() => loadConfig({ ...valid, NANGO_HOST: bad })).toThrow(/NANGO_HOST/);
    }
    expect(() => loadConfig({ ...valid, NANGO_API_KEY: "corta un poco" })).toThrow(/NANGO_API_KEY/);
    expect(() => loadConfig({ ...valid, NANGO_API_KEY: "corta un poco" })).not.toThrow(/corta un poco/);
  });

  it("la clave de Resend es opcional; vacía cuenta como ausente; una que no lo parece no arranca sin decir cuál era", () => {
    const key = `re_${"r".repeat(30)}`;
    expect(loadConfig({ ...valid, RESEND_API_KEY: key }).resendApiKey).toBe(key);
    expect(loadConfig({ ...valid, RESEND_API_KEY: ` ${key}\n` }).resendApiKey).toBe(key);
    expect(loadConfig({ ...valid, RESEND_API_KEY: "" }).resendApiKey).toBeNull();
    const bad = "sk_no_es_de_resend_123456";
    expect(() => loadConfig({ ...valid, RESEND_API_KEY: bad })).toThrow(/RESEND_API_KEY/);
    expect(() => loadConfig({ ...valid, RESEND_API_KEY: bad })).not.toThrow(new RegExp(bad));
  });

  it("WEB_APP_URL: https sin ruta (sin barra final); http solo en local; vacía cuenta como ausente", () => {
    expect(loadConfig({ ...valid, WEB_APP_URL: "https://staging.moodlycrm.com/" }).webAppUrl).toBe("https://staging.moodlycrm.com");
    expect(loadConfig({ ...valid, WEB_APP_URL: "http://127.0.0.1:3000" }).webAppUrl).toBe("http://127.0.0.1:3000");
    expect(loadConfig({ ...valid, WEB_APP_URL: "" }).webAppUrl).toBeNull();
    for (const bad of ["http://staging.moodlycrm.com", "https://staging.moodlycrm.com/app", "https://u:p@staging.moodlycrm.com", "https://x.com?a=1", "staging"]) {
      expect(() => loadConfig({ ...valid, WEB_APP_URL: bad })).toThrow(/WEB_APP_URL/);
    }
  });

  it("el puerto de salud sale de PORT (Railway) y se valida", () => {
    expect(loadConfig({ ...valid, PORT: "3001" }).healthPort).toBe(3001);
    for (const port of ["0", "70000", "abc", "80 80"]) expect(() => loadConfig({ ...valid, PORT: port })).toThrow(WorkerConfigError);
  });

  it("el enrutado por intención (PL-T3) está apagado salvo que INTENT_ROUTING lo encienda", () => {
    for (const on of ["on", "true", "1", " ON ", "True"]) expect(loadConfig({ ...valid, INTENT_ROUTING: on }).intentRouting).toBe(true);
    for (const off of ["off", "false", "0", "", "  "]) expect(loadConfig({ ...valid, INTENT_ROUTING: off }).intentRouting).toBe(false);
    expect(() => loadConfig({ ...valid, INTENT_ROUTING: "yes" })).toThrow(/INTENT_ROUTING: on\/off, true\/false o 1\/0/);
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
