import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { logSecurityEvent } from "./events-core";
import { createLogger, pathOnly, pseudonym, REDACTED } from "./logger-core";

const KEY = "k".repeat(32);

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      for (const line of chunk.toString().split("\n").filter(Boolean)) lines.push(JSON.parse(line) as Record<string, unknown>);
      done();
    },
  });
  return { logger: createLogger(stream, "info"), lines };
}

describe("logger", () => {
  it("escribe JSON con nivel en texto, servicio y fecha ISO", () => {
    const { logger, lines } = capture();
    logger.info({ organization_id: "org-1" }, "hola");
    expect(lines[0]).toMatchObject({ level: "info", service: "web", msg: "hola", organization_id: "org-1" });
    expect(String(lines[0]?.["time"])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("censura contraseñas, tokens, emails y cabeceras de sesión, también anidados", () => {
    const { logger, lines } = capture();
    logger.info({
      password: "p",
      token: "t",
      email: "ana@demo.test",
      body: { password: "p2", access_token: "a", refresh_token: "r", email: "otra@demo.test" },
      req: { headers: { cookie: "sb=1", authorization: "Bearer x", accept: "text/html" } },
    });
    const line = JSON.stringify(lines[0]);
    for (const secret of ['"p"', '"t"', "ana@demo.test", "p2", '"a"', '"r"', "otra@demo.test", "sb=1", "Bearer x"]) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain(REDACTED);
    expect(line).toContain("text/html");
  });
});

describe("seudónimos y rutas", () => {
  it("pseudonym: estable, sin el dato y sin clave no hay seudónimo", () => {
    const a = pseudonym("Ana@Demo.test ", KEY);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(pseudonym("ana@demo.test", KEY)).toBe(a);
    expect(pseudonym("ana@demo.test", "otra-clave-de-32-caracteres-xxxxx")).not.toBe(a);
    expect(pseudonym("ana@demo.test", undefined)).toBeUndefined();
    expect(pseudonym("ana@demo.test", "corta")).toBeUndefined();
  });

  it("pathOnly quita query y fragmento (tokens de invitación)", () => {
    expect(pathOnly("/app/invitation?token=secreto")).toBe("/app/invitation");
    expect(pathOnly("/app/contacts#x")).toBe("/app/contacts");
    expect(pathOnly("/app")).toBe("/app");
  });
});

describe("eventos de seguridad", () => {
  it("escriben el evento con ids internos y seudónimos, nunca email ni IP en claro", () => {
    process.env["LOG_PSEUDONYM_KEY"] = KEY;
    const { logger, lines } = capture();
    logSecurityEvent(logger, "auth.login_failed", { email: "ana@demo.test", ip: "203.0.113.7", reason: "credenciales" });
    logSecurityEvent(logger, "org.invitation_created", { userId: "u-1", organizationId: "o-1", role: "staff" });
    const [failed, created] = lines;
    expect(failed).toMatchObject({ level: "warn", event: "auth.login_failed", reason: "credenciales" });
    expect(failed?.["email_ref"]).toBe(pseudonym("ana@demo.test", KEY));
    expect(failed?.["ip_ref"]).toBe(pseudonym("203.0.113.7", KEY));
    expect(JSON.stringify(failed)).not.toMatch(/ana@demo\.test|203\.0\.113\.7/);
    expect(created).toMatchObject({ level: "info", event: "org.invitation_created", user_id: "u-1", organization_id: "o-1", role: "staff" });
    delete process.env["LOG_PSEUDONYM_KEY"];
  });
});
