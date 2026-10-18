import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type SwRequest = { method: string; url: string; mode: string };

// Fuente única: se evalúa public/sw.js con un `self` vacío, de modo que no se
// registran los listeners del SW y solo se recupera la función pura.
const source = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
const pickStrategy = new Function("self", `${source}\nreturn pickStrategy;`)({}) as (
  request: SwRequest,
  origin: string,
) => string;

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
    "/_next/static/chunks/main.js",
    "/_next/static/media/font.woff2",
    "/icons/icon-192.png",
    "/manifest.webmanifest",
    "/offline.html",
  ])("asset público %s → cache-first", (path) => {
    expect(pickStrategy(req("GET", path), ORIGIN)).toBe("cache-first");
  });
});

describe("página sin conexión", () => {
  const html = readFileSync(new URL("../../../public/offline.html", import.meta.url), "utf8");

  it("avisa de que no hay conexión y no ejecuta código", () => {
    expect(html).toContain("Sin conexión");
    expect(html).not.toContain("<script");
  });
});
