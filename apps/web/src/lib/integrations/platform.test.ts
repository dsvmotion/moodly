import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn() } }));

const { getConnectorPlatform } = await import("./platform");

// La web siempre usa el transporte real de Nango: no hay interruptor de «falso».
// Lo único que cambia entre entornos es la configuración (O-02).
describe("getConnectorPlatform", () => {
  const key = `nango-${"k".repeat(24)}`;

  it("sin NANGO_API_KEY no hay plataforma", () => {
    expect(getConnectorPlatform({})).toBeNull();
    expect(getConnectorPlatform({ NANGO_API_KEY: "  " })).toBeNull();
  });

  it("con la clave, Nango (Cloud por defecto, o la URL base configurada)", () => {
    expect(getConnectorPlatform({ NANGO_API_KEY: key })).not.toBeNull();
    expect(getConnectorPlatform({ NANGO_API_KEY: key, NANGO_HOST: "https://nango.eu.example.com" })).not.toBeNull();
    expect(getConnectorPlatform({ NANGO_API_KEY: key, NANGO_HOST: "http://127.0.0.1:3999" })).not.toBeNull();
  });

  it.each(["http://nango.example.com", "http://10.0.0.8:3003", "https://u:p@nango.example.com"])(
    "una NANGO_HOST %s (http fuera de loopback, credenciales…) deja la plataforma sin activar",
    (host) => {
      expect(getConnectorPlatform({ NANGO_API_KEY: key, NANGO_HOST: host })).toBeNull();
    },
  );

  it("no lee ningún interruptor de plataforma falsa", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./platform.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/NANGO_FAKE|createFakeConnectorPlatform/);
  });
});
