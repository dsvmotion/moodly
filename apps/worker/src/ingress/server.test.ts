import type { AddressInfo } from "node:net";
import pino from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES, createIngressServer } from "./server.ts";

const logger = pino({ level: "silent" });
let close: (() => Promise<void>) | null = null;

afterEach(async () => {
  await close?.();
  close = null;
});

async function start(receive = vi.fn().mockResolvedValue({ status: 200, accepted: 1, duplicates: 0, ignored: 0 })) {
  const server = createIngressServer(receive, logger);
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

  it("solo POST en /channels/<canal>/webhook; /healthz para Railway; el resto, 404", async () => {
    const { base, receive } = await start();
    expect((await fetch(`${base}/channels/webchat/webhook`)).status).toBe(405);
    expect((await fetch(`${base}/channels/Web Chat/webhook`, { method: "POST" })).status).toBe(404);
    expect((await fetch(`${base}/otra`, { method: "POST" })).status).toBe(404);
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect(receive).not.toHaveBeenCalled();
  });

  it("un cuerpo demasiado grande no llega a procesarse", async () => {
    const { base, receive } = await start();
    const response = await fetch(`${base}/channels/webchat/webhook`, { method: "POST", body: "x".repeat(MAX_BODY_BYTES + 1) }).catch(() => null);
    if (response) expect(response.status).toBe(413);
    expect(receive).not.toHaveBeenCalled();
  });

  it("si no se pudo guardar, 500 (el proveedor reintenta) sin detalles", async () => {
    const { base } = await start(vi.fn().mockRejectedValue(new Error("detalle interno con datos")));
    const response = await fetch(`${base}/channels/webchat/webhook`, { method: "POST", body: "{}" });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("{}");
  });
});
