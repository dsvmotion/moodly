import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, REDACTED, redactConnectionStrings } from "./logger.ts";

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { lines, logger: createLogger("debug", stream) };
}

describe("redactConnectionStrings", () => {
  it.each([
    ["postgresql://dbos_worker:s3cr3t@db.example.test:5432/postgres", `postgresql://dbos_worker:${REDACTED}@db.example.test:5432/postgres`],
    ["error en postgres://u:p%40ss@h/db: timeout", `error en postgres://u:${REDACTED}@h/db: timeout`],
    ["dos: postgres://a:x@h1/d y postgresql://b:y@h2/d", `dos: postgres://a:${REDACTED}@h1/d y postgresql://b:${REDACTED}@h2/d`],
  ])("censura la contraseña de %s", (input, expected) => {
    expect(redactConnectionStrings(input)).toBe(expected);
  });

  it("deja igual un texto sin credenciales", () => {
    expect(redactConnectionStrings("postgresql://h:5432/db sin usuario")).toBe("postgresql://h:5432/db sin usuario");
  });

  it("censura una clave secreta de Supabase", () => {
    // Armada en tiempo de ejecución: un literal con forma de clave lo marcaría gitleaks.
    const key = ["sb", "secret", "Ab1-".repeat(6)].join("_");
    expect(redactConnectionStrings(`apikey: ${key}`)).toBe(`apikey: sb_secret_${REDACTED}`);
  });
});

describe("createLogger", () => {
  it("JSON con service, level y msg, y la URL censurada en el mensaje", () => {
    const { lines, logger } = capture();
    logger.info("conectando a postgresql://dbos_worker:s3cr3t@db.example.test/postgres");
    expect(lines[0]).toMatchObject({ service: "worker", level: "info" });
    expect(String(lines[0]?.["msg"])).not.toContain("s3cr3t");
  });

  it("censura la URL en el mensaje y la pila de un error", () => {
    const { lines, logger } = capture();
    logger.error({ err: new Error("falló postgresql://dbos_worker:s3cr3t@db.example.test/postgres") }, "error");
    expect(JSON.stringify(lines[0])).not.toContain("s3cr3t");
  });

  it("registra el tipo, el mensaje, la pila y la causa de un error, censurados", () => {
    const { lines, logger } = capture();
    const cause = Object.assign(new Error("password authentication failed for postgresql://moodly_worker:s3cr3t@h/db"), { code: "28P01" });
    logger.fatal({ err: new Error("WORKER_DATABASE_URL: no se pudo entrar", { cause }) }, "el worker no arrancó");
    const err = lines[0]?.["err"] as Record<string, unknown>;
    expect(err["type"]).toBe("Error");
    // pino encadena el mensaje de la causa: «…: password authentication failed …».
    expect(String(err["message"])).toContain("WORKER_DATABASE_URL: no se pudo entrar");
    expect(String(err["stack"])).toContain("WORKER_DATABASE_URL: no se pudo entrar");
    expect(JSON.stringify(err)).toContain("28P01");
    expect(JSON.stringify(err)).toContain("password authentication failed");
    expect(JSON.stringify(lines[0])).not.toContain("s3cr3t");
  });

  it("registra los errores de un AggregateError (conexión IPv4 e IPv6)", () => {
    const { lines, logger } = capture();
    const inner = [Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }), Object.assign(new Error("connect ENETUNREACH ::1:5432"), { code: "ENETUNREACH" })];
    logger.error({ err: new AggregateError(inner) }, "error");
    const text = JSON.stringify(lines[0]);
    expect(text).toContain("ECONNREFUSED");
    expect(text).toContain("ENETUNREACH");
  });

  it("registra como texto lo que se lanza sin ser un error", () => {
    const { lines, logger } = capture();
    logger.error({ err: "falló postgresql://u:s3cr3t@h/db" }, "error");
    expect(lines[0]?.["err"]).toEqual({ type: "string", message: `falló postgresql://u:${REDACTED}@h/db` });
  });

  it("censura un error muy anidado y no deja pasar objetos más allá del tope", () => {
    const { lines, logger } = capture();
    let deep: Record<string, unknown> = { err: new Error("falló postgresql://u:s3cr3t@h/db") };
    for (let i = 0; i < 12; i++) deep = { nivel: deep };
    logger.info({ deep, otro: { a: { b: { c: { d: { e: { f: { g: { h: { i: { url: "postgresql://u:s3cr3t@h/db" } } } } } } } } } } }, "anidado");
    expect(JSON.stringify(lines[0])).not.toContain("s3cr3t");
  });

  it("no registra el detail ni el where de un error de pg (llevan datos de personas)", () => {
    const { lines, logger } = capture();
    const pgError = Object.assign(new Error("duplicate key value violates unique constraint \"users_email_key\""), {
      code: "23505",
      severity: "ERROR",
      constraint: "users_email_key",
      table: "users",
      detail: "Key (email)=(ana@example.com) already exists.",
      where: "SQL statement \"insert into users values ('ana@example.com')\"",
      internalQuery: "select 'ana@example.com'",
      position: "42",
      hint: "ana@example.com",
    });
    logger.error({ err: pgError }, "error");
    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain("ana@example.com");
    expect(text).toContain("23505");
    expect(text).toContain("users_email_key");
  });

  it("censura el valor entrecomillado del mensaje de un error de datos de pg (22P02)", () => {
    const { lines, logger } = capture();
    const pgError = Object.assign(new Error('invalid input syntax for type uuid: "ana@example.com"'), { code: "22P02" });
    logger.error({ err: new Error("no se pudo leer", { cause: pgError }) }, "error");
    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain("ana@example.com");
    expect(text).toContain("22P02");
    expect(text).toContain("invalid input syntax for type uuid");
  });

  it("censura el valor de un 22P02 aunque esté debajo de muchos envoltorios", () => {
    const { lines, logger } = capture();
    let err: Error = Object.assign(new Error('invalid input syntax for type uuid: "ana@example.com"'), { code: "22P02" });
    for (let i = 0; i < 8; i++) err = new Error(`envoltorio ${i}`, { cause: err });
    logger.error({ err }, "error");
    expect(JSON.stringify(lines[0])).not.toContain("ana@example.com");
  });

  it("el valor de un 22P02 se censura también en los errors de un AggregateError", () => {
    const { lines, logger } = capture();
    const pgError = Object.assign(new Error('invalid input syntax for type uuid: "ana@example.com"'), { code: "22P02" });
    const copy = new Error('copia: invalid input syntax for type uuid: "ana@example.com"');
    logger.error({ err: new AggregateError([copy], "varios", { cause: pgError }) }, "error");
    logger.error({ err: new AggregateError([copy, pgError], "varios") }, "error");
    expect(JSON.stringify(lines)).not.toContain("ana@example.com");
  });

  it("una cadena de causas larga se corta y no sale ninguna contraseña", () => {
    const { lines, logger } = capture();
    let err = new Error("raíz postgresql://u:s3cr3t@h/db");
    for (let i = 0; i < 12; i++) err = new Error(`nivel ${i} postgresql://u:s3cr3t@h/db`, { cause: err });
    logger.fatal({ err }, "error");
    expect(JSON.stringify(lines[0])).not.toContain("s3cr3t");
  });

  it("una causa cíclica (err.cause = err) no revienta el log", () => {
    const { lines, logger } = capture();
    const err = new Error("cíclico postgresql://u:s3cr3t@h/db");
    (err as { cause?: unknown }).cause = err;
    logger.fatal({ err }, "error");
    expect(lines).toHaveLength(1);
    expect(JSON.stringify(lines[0])).not.toContain("s3cr3t");
  });

  it("también un error en otro campo que no es err", () => {
    const { lines, logger } = capture();
    logger.warn({ reason: new Error("algo") }, "aviso");
    expect((lines[0]?.["reason"] as Record<string, unknown>)["message"]).toBe("algo");
  });

  it("censura la URL en cualquier campo, también anidado", () => {
    const { lines, logger } = capture();
    logger.info({ url: "postgresql://dbos_worker:s3cr3t@db.example.test/postgres", db: { urls: ["postgres://a:s3cr3t@h/d"] } }, "campos");
    expect(JSON.stringify(lines[0])).not.toContain("s3cr3t");
    expect(lines[0]?.["url"]).toBe(`postgresql://dbos_worker:${REDACTED}@db.example.test/postgres`);
  });

  it("censura las claves sensibles de los campos", () => {
    const { lines, logger } = capture();
    logger.info({ password: "s3cr3t", user: { email: "persona@example.test" } }, "campos");
    expect(lines[0]?.["password"]).toBe(REDACTED);
    expect(JSON.stringify(lines[0])).not.toContain("persona@example.test");
  });
});
