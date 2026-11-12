import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import pino from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { MAX_BODY_BYTES, createIngressHandler } from "./server.ts";
import type { Handshake } from "./server.ts";

const logger = pino({ level: "silent" });
let close: (() => Promise<void>) | null = null;

afterEach(async () => {
  await close?.();
  close = null;
});

async function start(receive = vi.fn().mockResolvedValue({ status: 200, accepted: 1, duplicates: 0, ignored: 0 }), handshake?: Handshake) {
  const server = createServer(createIngressHandler(receive, logger, handshake));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  close = () => new Promise((resolve) => server.close(() => resolve()));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, receive };
}

describe("el servidor de la entrada de canales", () => {
  it("pasa el cuerpo exacto y las cabeceras al canal de la ruta, y devuelve lo que diga", async () => {
    const { base, receive } = await start();
    const body = '{"messages": []}';
    const response = await fetch(`${base}/channels/webchat/webhook`, { method: "POST", body, headers: { "x-fake-signature": "abc" } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accepted: 1, duplicates: 0, ignored: 0 });
    expect(receive).toHaveBeenCalledWith("webchat", { headers: expect.objectContaining({ "x-fake-signature": "abc" }), rawBody: body });
  });

  it("solo POST (y el GET del alta) en /channels/<canal>/webhook; el resto, 404 (la salud es de health.ts)", async () => {
    const { base, receive } = await start();
    expect((await fetch(`${base}/channels/webchat/webhook`, { method: "PUT" })).status).toBe(405);
    expect((await fetch(`${base}/channels/webchat/webhook`, { method: "DELETE" })).status).toBe(405);
    // Un canal sin comprobación del alta: el GET no vale.
    expect((await fetch(`${base}/channels/webchat/webhook`)).status).toBe(403);
    expect((await fetch(`${base}/channels/Web Chat/webhook`, { method: "POST" })).status).toBe(404);
    expect((await fetch(`${base}/otra`, { method: "POST" })).status).toBe(404);
    expect((await fetch(`${base}/healthz`)).status).toBe(404);
    expect(receive).not.toHaveBeenCalled();
  });

  it("un cuerpo demasiado grande no llega a procesarse: 413 de verdad, con la longitud declarada", async () => {
    const { base, receive } = await start();
    const response = await fetch(`${base}/channels/webchat/webhook`, { method: "POST", body: "x".repeat(MAX_BODY_BYTES + 1) });
    expect(response.status).toBe(413);
    expect(response.headers.get("connection")).toBe("close");
    expect(receive).not.toHaveBeenCalled();
  });

  it("y también sin longitud declarada (por trozos): 413 en cuanto pasa del límite, y se cierra", async () => {
    const { base, receive } = await start();
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(`${base}/channels/webchat/webhook`, { method: "POST", headers: { "transfer-encoding": "chunked" } }, (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      request.on("error", reject);
      const chunk = "x".repeat(64 * 1024);
      for (let sent = 0; sent <= MAX_BODY_BYTES; sent += chunk.length) request.write(chunk);
      // No se termina la petición: el servidor tiene que contestar igual.
    });
    expect(status).toBe(413);
    expect(receive).not.toHaveBeenCalled();
  });

  it("el GET del alta (Meta): el challenge en texto si el canal lo acepta; si no, 403", async () => {
    const handshake = vi.fn((channel: string, query: URLSearchParams) =>
      channel === "whatsapp" && query.get("hub.verify_token") === "t" ? (query.get("hub.challenge") ?? null) : null,
    );
    const { base, receive } = await start(undefined, handshake);
    const good = await fetch(`${base}/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=t&hub.challenge=42`);
    expect(good.status).toBe(200);
    expect(good.headers.get("content-type")).toContain("text/plain");
    expect(await good.text()).toBe("42");
    expect((await fetch(`${base}/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=42`)).status).toBe(403);
    expect((await fetch(`${base}/channels/webchat/webhook?hub.mode=subscribe&hub.verify_token=t&hub.challenge=42`)).status).toBe(403);
    expect(receive).not.toHaveBeenCalled();
  });

  it("si no se pudo guardar, 500 (el proveedor reintenta) sin detalles", async () => {
    const { base } = await start(vi.fn().mockRejectedValue(new Error("detalle interno con datos")));
    const response = await fetch(`${base}/channels/webchat/webhook`, { method: "POST", body: "{}" });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("{}");
  });
});
