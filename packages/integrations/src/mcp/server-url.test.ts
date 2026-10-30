import { describe, expect, it } from "vitest";
import { UnsafeServerUrlError, assertSafeServerUrl, isPublicAddress } from "./server-url.js";
import type { Resolver } from "./server-url.js";

const resolvesTo =
  (...addresses: string[]): Resolver =>
  () =>
    Promise.resolve(addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
const PUBLIC = resolvesTo("93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c");

describe("assertSafeServerUrl (sin acceso a la red interna)", () => {
  it("acepta https con un nombre público que resuelve a direcciones públicas", async () => {
    const addresses = await assertSafeServerUrl("https://mcp.example.com/v1/mcp", PUBLIC);
    expect(addresses.map((a) => a.address)).toEqual(["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"]);
  });

  it.each([
    ["http", "http://mcp.example.com/mcp"],
    ["credenciales en la URL", "https://user:pass@mcp.example.com/mcp"],
    ["otro puerto", "https://mcp.example.com:8443/mcp"],
    ["IPv4 literal", "https://10.0.0.5/mcp"],
    ["IPv4 pública literal", "https://93.184.215.14/mcp"],
    ["IPv6 literal", "https://[::1]/mcp"],
    ["localhost", "https://localhost/mcp"],
    ["subdominio de localhost", "https://mcp.localhost/mcp"],
    ["nombre de una sola etiqueta", "https://metadata/computeMetadata"],
    [".internal (red privada de Railway)", "https://postgres.railway.internal/mcp"],
    [".local", "https://printer.local/mcp"],
    ["no es una URL", "mcp.example.com"],
  ])("rechaza %s", async (_label, url) => {
    await expect(assertSafeServerUrl(url, PUBLIC)).rejects.toThrow(UnsafeServerUrlError);
  });

  it.each([
    ["una red privada", "10.1.2.3"],
    ["los metadatos de la nube", "169.254.169.254"],
    ["loopback", "127.0.0.1"],
    ["CGNAT", "100.64.0.1"],
    ["loopback IPv6", "::1"],
    ["una IPv4 privada mapeada en IPv6", "::ffff:10.0.0.1"],
    ["una ULA IPv6", "fd12:3456::1"],
    ["enlace local IPv6", "fe80::1"],
  ])("rechaza un nombre público que resuelve a %s", async (_label, address) => {
    await expect(assertSafeServerUrl("https://mcp.example.com/mcp", resolvesTo(address))).rejects.toThrow(/no públicas/);
  });

  it("rechaza el nombre si UNA de sus direcciones no es pública", async () => {
    await expect(assertSafeServerUrl("https://mcp.example.com/mcp", resolvesTo("93.184.215.14", "192.168.1.10"))).rejects.toThrow(
      /192\.168\.1\.10/,
    );
  });

  it("y si no resuelve", async () => {
    await expect(assertSafeServerUrl("https://mcp.example.com/mcp", resolvesTo())).rejects.toThrow(/no resuelve/);
  });
});

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("%s es pública", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
  it.each(["172.16.0.1", "192.0.2.1", "0.0.0.0", "224.0.0.1", "::", "64:ff9b::a00:1", "2002:a00:1::1", "no-es-ip"])(
    "%s no lo es",
    (address) => {
      expect(isPublicAddress(address)).toBe(false);
    },
  );
});
