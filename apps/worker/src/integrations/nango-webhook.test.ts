import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { ServiceDb } from "@repo/db/service";
import { createFakeConnectorPlatform, signNangoWebhook } from "@repo/integrations";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { createHealthServer } from "../health.ts";
import { NANGO_WEBHOOK_PATH, createNangoWebhookHandler, handleNangoWebhook, type NangoWebhookDeps } from "./nango-webhook.ts";

// El webhook sin base de datos: todo lo que se rechaza o se ignora antes de
// llegar a ella. Lo que escribe se prueba contra Supabase local en
// nango-webhook.integration.ts.

const SIGNING_KEY = "00000000-0000-4000-8000-00000000000a";
const ORG = "a0000000-0000-4000-8000-000000000000";
const ROW = "a9000000-0000-4000-8000-000000000001";
const silent = pino({ level: "silent" });

/** Una base de datos que no se puede tocar: si el webhook llega a ella, el test falla. */
const untouchable = {
  forOrganization() {
    throw new Error("el webhook no debía tocar la base de datos");
  },
} as unknown as ServiceDb;

function deps(overrides: Partial<NangoWebhookDeps> = {}): NangoWebhookDeps {
  return { db: untouchable, platform: createFakeConnectorPlatform(), signingKey: SIGNING_KEY, logger: silent, ...overrides };
}

function authBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "auth",
    operation: "creation",
    success: true,
    connectionId: "conn-1",
    providerConfigKey: "google-calendar",
    tags: { organization_id: ORG, end_user_id: "u", integration_id: ROW },
    ...overrides,
  });
}

describe("handleNangoWebhook, antes de la base de datos", () => {
  it("una firma que no vale no llega ni a parsear el cuerpo", async () => {
    await expect(handleNangoWebhook(deps(), Buffer.from("no es json"), "f".repeat(64))).resolves.toBe("invalid_signature");
  });

  it("sin cabecera de firma, tampoco", async () => {
    await expect(handleNangoWebhook(deps(), Buffer.from(authBody()), undefined)).resolves.toBe("invalid_signature");
  });

  it("firmado con otra clave (p. ej. la clave secreta de la API), tampoco", async () => {
    const body = authBody();
    await expect(handleNangoWebhook(deps(), Buffer.from(body), signNangoWebhook(body, "otra-clave-de-nango"))).resolves.toBe(
      "invalid_signature",
    );
  });

  it("firmado pero sin JSON: 400, sin tocar nada", async () => {
    await expect(handleNangoWebhook(deps(), Buffer.from("{"), signNangoWebhook("{", SIGNING_KEY))).resolves.toBe("invalid_body");
  });

  it.each([
    ["un webhook que no es de auth", JSON.stringify({ type: "sync", connectionId: "c" })],
    ["una integración fuera del catálogo", authBody({ providerConfigKey: "gmail" })],
    ["sin nuestras etiquetas", authBody({ tags: { end_user_id: "u" } })],
    ["con una organización que no es un uuid", authBody({ tags: { organization_id: "acme", integration_id: ROW } })],
    ["un refresco correcto (nada que cambiar)", authBody({ operation: "refresh" })],
  ])("%s se ignora sin tocar la base de datos", async (_case, body) => {
    await expect(handleNangoWebhook(deps(), Buffer.from(body), signNangoWebhook(body, SIGNING_KEY))).resolves.toBe("ignored");
  });

  it("si la conexión no existe en Nango o lleva otras etiquetas, se ignora", async () => {
    const platform = createFakeConnectorPlatform();
    const body = authBody();
    const sig = signNangoWebhook(body, SIGNING_KEY);
    await expect(handleNangoWebhook(deps({ platform }), Buffer.from(body), sig)).resolves.toBe("ignored");
    platform.addConnection({
      connectionId: "conn-1",
      integrationKey: "google-calendar",
      tags: { organization_id: "b0000000-0000-4000-8000-000000000000", integration_id: ROW },
    });
    await expect(handleNangoWebhook(deps({ platform }), Buffer.from(body), sig)).resolves.toBe("ignored");
  });
});

describe("createNangoWebhookHandler, montado en el servidor de salud bajo /webhooks/", () => {
  let server: Server | undefined;
  afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

  async function listen(handler: ReturnType<typeof createNangoWebhookHandler>): Promise<string> {
    // El servidor de verdad (health.ts), con su sonda parada: /health y /webhooks/ en el mismo puerto.
    server = createHealthServer({
      logger: silent,
      probe: { phase: () => "stopping", pingDatabase: async () => undefined, oldestPendingEventAt: async () => null },
      webhooks: handler,
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
  }

  it("401 con una firma que no vale, 200 con una buena (ignorado), 405 con GET, 413 si es enorme; otras rutas, 404; /health no cambia", async () => {
    const base = await listen(createNangoWebhookHandler(deps()));
    const body = JSON.stringify({ type: "sync" });
    const bad = await fetch(`${base}${NANGO_WEBHOOK_PATH}`, { method: "POST", body, headers: { "X-Nango-Hmac-Sha256": "0".repeat(64) } });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ status: "unauthorized" });
    const good = await fetch(`${base}${NANGO_WEBHOOK_PATH}`, {
      method: "POST",
      body,
      headers: { "X-Nango-Hmac-Sha256": signNangoWebhook(body, SIGNING_KEY) },
    });
    expect(good.status).toBe(200);
    expect((await fetch(`${base}${NANGO_WEBHOOK_PATH}`)).status).toBe(405);
    const huge = await fetch(`${base}${NANGO_WEBHOOK_PATH}`, { method: "POST", body: "x".repeat(70 * 1024) });
    expect(huge.status).toBe(413);
    expect((await fetch(`${base}/webhooks/otra`)).status).toBe(404);
    expect((await fetch(`${base}/otra`)).status).toBe(404);
    // /health sigue igual: solo {status}.
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ status: "stopping" });
  });

  it("un fallo pasajero responde 500 (Nango reintenta)", async () => {
    const platform = createFakeConnectorPlatform();
    platform.failNext("getConnection");
    const base = await listen(createNangoWebhookHandler(deps({ platform })));
    const body = authBody();
    const res = await fetch(`${base}${NANGO_WEBHOOK_PATH}`, {
      method: "POST",
      body,
      headers: { "X-Nango-Hmac-Sha256": signNangoWebhook(body, SIGNING_KEY) },
    });
    expect(res.status).toBe(500);
  });
});
