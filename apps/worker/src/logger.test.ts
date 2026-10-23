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
