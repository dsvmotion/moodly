import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

type SwRequest = { method: string; url: string; mode: string };

type FakeResponse = { ok: boolean; type: string; clone: () => FakeResponse };
type FakeEvent = { request: SwRequest; waitUntil: (promise: Promise<unknown>) => void };

// Fuente única: se evalúa public/sw.js con un `self` vacío, de modo que no se
// registran los listeners del SW. `caches` y `fetch` se inyectan como dobles.
const source = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
function loadSw(caches?: unknown, fetch?: unknown) {
  return new Function("self", "caches", "fetch", `${source}\nreturn { pickStrategy, cacheFirst };`)({}, caches, fetch) as {
    pickStrategy: (request: SwRequest, origin: string) => string;
    cacheFirst: (event: FakeEvent) => Promise<FakeResponse>;
  };
}
const { pickStrategy } = loadSw();

const ORIGIN = "https://app.moodly.test";
const req = (method: string, path: string, mode = "cors"): SwRequest => ({
  method,
  url: new URL(path, ORIGIN).href,
  mode,
});

describe("pickStrategy del service worker", () => {
  it.each([
    ["Server Action (POST en navegación)", req("POST", "/app/approvals", "navigate")],
    ["POST del login", req("POST", "/login")],
    ["Supabase (otro origen)", req("GET", "https://xyz.supabase.co/rest/v1/organizations")],
    ["navegación al login", req("GET", "/login", "navigate")],
    ["login con destino", req("GET", "/login?next=%2Fapp", "navigate")],
    ["callback de auth", req("GET", "/auth/callback")],
    ["petición de API", req("GET", "/api/anything")],
    // Chunks con hash: ya los cachea el navegador (immutable) y, como las
    // páginas no se guardan, en caché del SW solo crecerían sin servir offline.
    ["chunk de build", req("GET", "/_next/static/chunks/main.js")],
    ["fuente de build", req("GET", "/_next/static/media/font.woff2")],
  ])("%s → passthrough (nunca se cachea)", (_, request) => {
    expect(pickStrategy(request, ORIGIN)).toBe("passthrough");
  });

  it.each([
    ["/app", req("GET", "/app", "navigate")],
    ["/app/settings/organization", req("GET", "/app/settings/organization", "navigate")],
    ["/", req("GET", "/", "navigate")],
  ])("navegación a %s → network-first (sin guardar la página)", (_, request) => {
    expect(pickStrategy(request, ORIGIN)).toBe("network-first");
  });

  it.each([
    "/icons/icon-192.png",
    "/manifest.webmanifest",
    "/offline.html",
  ])("asset público %s → cache-first", (path) => {
    expect(pickStrategy(req("GET", path), ORIGIN)).toBe("cache-first");
  });
});

describe("cacheFirst del service worker", () => {
  it("si guardar en caché falla (p. ej. cuota llena), la respuesta de red se entrega igual", async () => {
    const response: FakeResponse = { ok: true, type: "basic", clone: () => response };
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async () => {
        throw new Error("QuotaExceededError");
      }),
    };
    const { cacheFirst } = loadSw({ open: async () => cache }, async () => response);
    const pending: Promise<unknown>[] = [];
    const event: FakeEvent = { request: req("GET", "/icons/icon-192.png"), waitUntil: (p) => void pending.push(p) };

    await expect(cacheFirst(event)).resolves.toBe(response);
    expect(cache.put).toHaveBeenCalledTimes(1);
    await expect(Promise.all(pending)).resolves.toBeDefined();
  });
});

describe("página sin conexión", () => {
  const html = readFileSync(new URL("../../../public/offline.html", import.meta.url), "utf8");

  it("avisa de que no hay conexión y no ejecuta código", () => {
    expect(html).toContain("Sin conexión");
    expect(html).not.toContain("<script");
  });

  it("permite reintentar sin JavaScript: el enlace vacío recarga la URL actual", () => {
    // En la app instalada (standalone) no hay barra ni botón de recarga.
    expect(html).toMatch(/<a href="">Reintentar<\/a>/);
  });
});
