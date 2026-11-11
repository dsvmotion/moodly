import { describe, expect, it } from "vitest";
import { EmailSendError, createResendSender, type SendEmailRequest } from "./resend.js";

// El envío con la API REST de Resend (M-02), con un fetch falso: se comprueba
// la petición que saldría, sin enviar nada.

// Se arma en tiempo de ejecución: un literal con forma de clave lo marcaría gitleaks.
const KEY = `re_${"k".repeat(24)}`;

const request: SendEmailRequest = {
  from: { email: "notificaciones@example.test", name: "Marca de prueba" },
  to: "persona@example.test",
  subject: "Asunto",
  html: "<p>Hola</p>",
  text: "Hola",
  idempotencyKey: "approval:a:u",
};

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(response: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response();
  };
  return { fetch, calls };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createResendSender", () => {
  it("hace un POST a /emails con la clave, la clave de idempotencia y el cuerpo del email", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { id: "email-1" }));
    const sender = createResendSender({ apiKey: KEY, fetch });

    await expect(sender.send(request)).resolves.toEqual({ id: "email-1" });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe("https://api.resend.com/emails");
    expect(call?.init.method).toBe("POST");
    expect(call?.init.headers).toEqual({
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "approval:a:u",
    });
    expect(JSON.parse(String(call?.init.body))).toEqual({
      from: "Marca de prueba <notificaciones@example.test>",
      to: ["persona@example.test"],
      subject: "Asunto",
      html: "<p>Hola</p>",
      text: "Hola",
    });
  });

  it("sin clave no se crea (y no se llama a nadie)", () => {
    const { fetch, calls } = fakeFetch(() => json(200, {}));
    expect(() => createResendSender({ apiKey: "  ", fetch })).toThrow(/clave/);
    expect(calls).toHaveLength(0);
  });

  it("el nombre del remitente no puede romper la cabecera From", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { id: "x" }));
    await createResendSender({ apiKey: KEY, fetch }).send({ ...request, from: { email: "n@example.test", name: 'Marca "mala" <x@y>\r\nBcc: z' } });
    expect(JSON.parse(String(calls[0]?.init.body)).from).toBe("Marca mala x@y Bcc: z <n@example.test>");
  });

  it("sin clave de idempotencia, o con una de más de 256 caracteres, no envía", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, {}));
    const sender = createResendSender({ apiKey: KEY, fetch });
    await expect(sender.send({ ...request, idempotencyKey: "" })).rejects.toBeInstanceOf(EmailSendError);
    await expect(sender.send({ ...request, idempotencyKey: "x".repeat(257) })).rejects.toBeInstanceOf(EmailSendError);
    expect(calls).toHaveLength(0);
  });

  it.each([
    [429, "rate_limit_exceeded", true],
    [500, "internal_server_error", true],
    [503, "application_error", true],
    [409, "concurrent_idempotent_requests", true],
    [409, "invalid_idempotent_request", false],
    [422, "validation_error", false],
    [403, "invalid_from_address", false],
  ])("un %i (%s) es reintentable: %s", async (status, name, retryable) => {
    const { fetch } = fakeFetch(() => json(status, { name, message: "persona@example.test no vale" }));
    const error = await createResendSender({ apiKey: KEY, fetch })
      .send(request)
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(EmailSendError);
    expect(error).toMatchObject({ status, retryable });
  });

  it("el error no lleva la clave ni el cuerpo de la respuesta (puede repetir la dirección)", async () => {
    const { fetch } = fakeFetch(() => json(422, { name: "validation_error", message: "persona@example.test no vale" }));
    const error = (await createResendSender({ apiKey: KEY, fetch })
      .send(request)
      .catch((err: unknown) => err)) as Error;
    expect(error.message).toBe("Resend rechazó el email (422 validation_error)");
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain("persona@example.test");
  });

  it("si la red falla, es reintentable", async () => {
    const fetch: typeof globalThis.fetch = async () => {
      throw new TypeError(`fallo de red con ${KEY}`);
    };
    const error = (await createResendSender({ apiKey: KEY, fetch })
      .send(request)
      .catch((err: unknown) => err)) as EmailSendError;
    expect(error).toBeInstanceOf(EmailSendError);
    expect(error.retryable).toBe(true);
    expect(error.status).toBeNull();
    expect(error.message).not.toContain(KEY);
  });
});
