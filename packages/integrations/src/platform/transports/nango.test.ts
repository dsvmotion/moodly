import { describe, expect, it, vi } from "vitest";
import { ConnectorPlatformError } from "../types.js";
import { NANGO_DEFAULT_HOST, createNangoPlatform, parseNangoHost } from "./nango.js";

const KEY = "sk-test-not-real";

function fakeFetch(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(new URL(String(input)), init ?? {}));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const TAGS = { organization_id: "org-1", end_user_id: "user-1", integration_id: "int-1" };

describe("parseNangoHost", () => {
  it("por defecto, Nango Cloud", () => {
    expect(parseNangoHost(undefined)).toBe(NANGO_DEFAULT_HOST);
    expect(parseNangoHost("  ")).toBe(NANGO_DEFAULT_HOST);
  });

  it("acepta https (la instancia autoalojada) y quita la barra final", () => {
    expect(parseNangoHost("https://nango.eu.example.com/")).toBe("https://nango.eu.example.com");
  });

  it("acepta http solo en loopback (el stub de los e2e)", () => {
    expect(parseNangoHost("http://127.0.0.1:3999")).toBe("http://127.0.0.1:3999");
    expect(parseNangoHost("http://localhost:3999")).toBe("http://localhost:3999");
  });

  it.each(["http://nango.example.com", "http://10.0.0.5:3003", "ftp://nango.example.com", "https://u:p@nango.example.com", "https://nango.example.com/?x=1", "no-es-url"])(
    "rechaza %s",
    (value) => {
      expect(() => parseNangoHost(value)).toThrow(/NANGO_HOST/);
    },
  );

  it("el error no repite el valor", () => {
    expect(() => parseNangoHost("http://secreto.example.com")).toThrow(expect.not.objectContaining({ message: expect.stringContaining("secreto") }));
  });
});

describe("createNangoPlatform", () => {
  it("exige la clave", () => {
    expect(() => createNangoPlatform({ secretKey: " " })).toThrow();
  });

  it("crea la sesión de conexión con las etiquetas y solo esa integración", async () => {
    const fetch = fakeFetch(async (url, init) => {
      expect(url.toString()).toBe("https://nango.eu.example.com/connect/sessions");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${KEY}`);
      expect(JSON.parse(String(init.body))).toEqual({ tags: TAGS, allowed_integrations: ["google-calendar"] });
      return jsonResponse(
        { data: { token: "tok", connect_link: "https://connect.nango.dev/?session_token=tok", expires_at: "2026-11-13T01:30:00.000Z" } },
        201,
      );
    });
    const nango = createNangoPlatform({ secretKey: KEY, host: "https://nango.eu.example.com", fetch });
    const session = await nango.createConnectSession({ integrationKey: "google-calendar", tags: TAGS });
    expect(session).toEqual({
      connectLink: "https://connect.nango.dev/?session_token=tok",
      expiresAt: new Date("2026-11-13T01:30:00.000Z"),
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("con permisos en la petición, la sesión los fija para esa integración (oauth_scopes_override, separados por comas)", async () => {
    const fetch = fakeFetch((_url, init) => {
      expect(JSON.parse(String(init.body))).toEqual({
        tags: TAGS,
        allowed_integrations: ["outlook"],
        integrations_config_defaults: { outlook: { connection_config: { oauth_scopes_override: "offline_access,Calendars.Read" } } },
      });
      return jsonResponse({ data: { token: "t", connect_link: "https://connect.nango.dev/?session_token=t", expires_at: "2026-11-13T01:30:00Z" } }, 201);
    });
    const nango = createNangoPlatform({ secretKey: KEY, fetch });
    await nango.createConnectSession({ integrationKey: "outlook", tags: TAGS, scopes: ["offline_access", "Calendars.Read"] });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([["a b"], ["a,b"], [""]])("un permiso con forma rara (%j) no sale hacia Nango", async (scope) => {
    const fetch = fakeFetch(() => jsonResponse({}));
    const nango = createNangoPlatform({ secretKey: KEY, fetch });
    await expect(nango.createConnectSession({ integrationKey: "outlook", tags: TAGS, scopes: [scope] })).rejects.toBeInstanceOf(
      ConnectorPlatformError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "http://connect.evil.example/", "no-es-url"])("rechaza un enlace de conexión %s", async (link) => {
    const fetch = fakeFetch(() => jsonResponse({ data: { token: "t", connect_link: link, expires_at: "2026-11-13T01:30:00Z" } }));
    const nango = createNangoPlatform({ secretKey: KEY, fetch });
    await expect(nango.createConnectSession({ integrationKey: "google-calendar", tags: TAGS })).rejects.toBeInstanceOf(ConnectorPlatformError);
  });

  it("lee la conexión por el listado (sin credenciales) y comprueba la integración", async () => {
    const fetch = fakeFetch((url) => {
      expect(url.pathname).toBe("/connections");
      expect(url.searchParams.get("connectionId")).toBe("conn-1");
      return jsonResponse({
        connections: [
          { connection_id: "conn-1", provider_config_key: "otra", tags: {} },
          { connection_id: "conn-1", provider_config_key: "google-calendar", tags: TAGS },
        ],
      });
    });
    const nango = createNangoPlatform({ secretKey: KEY, fetch });
    await expect(nango.getConnection("google-calendar", "conn-1")).resolves.toEqual({
      connectionId: "conn-1",
      integrationKey: "google-calendar",
      tags: TAGS,
    });
    await expect(nango.getConnection("gmail", "conn-1")).resolves.toBeNull();
  });

  it("borrar una conexión que ya no existe no falla", async () => {
    const fetch = fakeFetch((url, init) => {
      expect(init.method).toBe("DELETE");
      expect(url.pathname).toBe("/connections/conn%2F1");
      expect(url.searchParams.get("provider_config_key")).toBe("google-calendar");
      return jsonResponse({ error: { code: "not_found" } }, 404);
    });
    await expect(createNangoPlatform({ secretKey: KEY, fetch }).deleteConnection("google-calendar", "conn/1")).resolves.toBeUndefined();
  });

  it("el proxy lleva la conexión en sus cabeceras y la ruta tal cual", async () => {
    const fetch = fakeFetch((url, init) => {
      expect(url.pathname).toBe("/proxy/calendar/v3/calendars/primary/events");
      expect(url.searchParams.get("maxResults")).toBe("5");
      expect(init.headers).toMatchObject({ "Connection-Id": "conn-1", "Provider-Config-Key": "google-calendar" });
      return jsonResponse({ items: [] });
    });
    const nango = createNangoPlatform({ secretKey: KEY, fetch });
    await expect(
      nango.proxy({ integrationKey: "google-calendar", connectionId: "conn-1", method: "GET", path: "/calendar/v3/calendars/primary/events", query: { maxResults: "5" } }),
    ).resolves.toEqual({ items: [] });
  });

  it.each(["calendar/v3", "//evil.example/x", "/a/../connections", "/a?b=c", "/a#b", "/a b"])("el proxy rechaza la ruta %s", async (path) => {
    const fetch = fakeFetch(() => jsonResponse({}));
    const nango = createNangoPlatform({ secretKey: KEY, fetch });
    await expect(nango.proxy({ integrationKey: "google-calendar", connectionId: "c", method: "GET", path })).rejects.toBeInstanceOf(ConnectorPlatformError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [404, "not_found"],
    [400, "rejected"],
    [429, "transient"],
    [502, "transient"],
  ] as const)("un %d es %s, y el error no lleva la clave ni el cuerpo", async (status, kind) => {
    const fetch = fakeFetch(() => jsonResponse({ error: { message: "token ya-tok-123 de alguien" } }, status));
    const nango = createNangoPlatform({ secretKey: KEY, fetch });
    const err = await nango.proxy({ integrationKey: "g", connectionId: "c", method: "GET", path: "/x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectorPlatformError);
    expect((err as ConnectorPlatformError).kind).toBe(kind);
    expect((err as Error).message).not.toContain(KEY);
    expect((err as Error).message).not.toContain("ya-tok-123");
  });

  it("sin red es transitorio", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const err = await createNangoPlatform({ secretKey: KEY, fetch }).getConnection("g", "c").catch((e: unknown) => e);
    expect((err as ConnectorPlatformError).retryable).toBe(true);
  });
});
