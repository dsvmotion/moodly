import { describe, expect, it, vi } from "vitest";
import { forwardEnvelope, parseDsn, TUNNEL_MAX_BYTES, upstreamFor } from "./sentry-tunnel";

const DSN = "https://clavepublica@o123.ingest.de.sentry.io/456";
const OTHER = "https://otra@o999.ingest.us.sentry.io/789";
const envelope = (dsn: string) => `${JSON.stringify({ event_id: "e1", dsn })}\n{"type":"event"}\n{"message":"x"}`;

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/monitoring", { method: "POST", body, headers });
}

describe("tunnel de Sentry (ADR 0032)", () => {
  it("lee el DSN y rechaza los que no son de Sentry por https con proyecto numérico", () => {
    expect(parseDsn(DSN)).toEqual({ host: "o123.ingest.de.sentry.io", projectId: "456", publicKey: "clavepublica" });
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("http://clave@o1.ingest.de.sentry.io/2")).toBeNull();
    expect(parseDsn("https://o1.ingest.de.sentry.io/2")).toBeNull();
    expect(parseDsn("https://clave@o1.ingest.de.sentry.io/abc")).toBeNull();
    expect(parseDsn("no es una url")).toBeNull();
  });

  it("solo reenvía a la ingesta de nuestro proyecto, construida con el DSN esperado", () => {
    const expected = parseDsn(DSN);
    if (!expected) throw new Error("DSN de prueba no válido");
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(upstreamFor(bytes(envelope(DSN)), expected)).toBe("https://o123.ingest.de.sentry.io/api/456/envelope/");
    expect(upstreamFor(bytes(envelope(OTHER)), expected)).toBeNull();
    expect(upstreamFor(bytes(envelope("https://otra@o123.ingest.de.sentry.io/456")), expected)).toBeNull();
    expect(upstreamFor(bytes(envelope("https://clavepublica@o123.ingest.de.sentry.io/999")), expected)).toBeNull();
    expect(upstreamFor(bytes(envelope("https://clavepublica@o999.ingest.de.sentry.io/456")), expected)).toBeNull();
    expect(upstreamFor(bytes('{"event_id":"e1"}\n{}'), expected)).toBeNull();
    expect(upstreamFor(bytes("no es json"), expected)).toBeNull();
  });

  it("sin DSN configurado el tunnel no existe (404) y no llama a nadie", async () => {
    const send = vi.fn<typeof fetch>();
    expect((await forwardEnvelope(post(envelope(DSN)), undefined, send)).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("un sobre de otro proyecto no se reenvía (400): no es un relé abierto", async () => {
    const send = vi.fn<typeof fetch>();
    expect((await forwardEnvelope(post(envelope(OTHER)), DSN, send)).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("un sobre demasiado grande se rechaza (413)", async () => {
    const send = vi.fn<typeof fetch>();
    const big = envelope(DSN) + "x".repeat(TUNNEL_MAX_BYTES);
    expect((await forwardEnvelope(post(big), DSN, send)).status).toBe(413);
    expect((await forwardEnvelope(post("{}", { "content-length": String(TUNNEL_MAX_BYTES + 1) }), DSN, send)).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it("reenvía el sobre tal cual y devuelve el estado de Sentry, sin su cuerpo", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"id":"e1"}', { status: 200 }));
    const response = await forwardEnvelope(post(envelope(DSN)), DSN, send);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe("https://o123.ingest.de.sentry.io/api/456/envelope/");
    expect(init?.method).toBe("POST");
    expect(new TextDecoder().decode(init?.body as Uint8Array)).toBe(envelope(DSN));
  });

  it("si Sentry no responde, 502", async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    expect((await forwardEnvelope(post(envelope(DSN)), DSN, send)).status).toBe(502);
  });
});
