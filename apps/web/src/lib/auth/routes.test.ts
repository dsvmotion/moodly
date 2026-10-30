import { describe, expect, it } from "vitest";
import { HOME_PATH, LOGIN_PATH, routeRedirect, safeNextPath } from "./routes";

describe("routeRedirect", () => {
  it("sin sesión, cualquier ruta privada va al login conservando el destino", () => {
    expect(routeRedirect("/app/settings/general", "", false)).toBe(
      `${LOGIN_PATH}?next=${encodeURIComponent("/app/settings/general")}`,
    );
    expect(routeRedirect("/app", "?tab=1", false)).toBe(`${LOGIN_PATH}?next=${encodeURIComponent("/app?tab=1")}`);
    expect(routeRedirect("/", "", false)).toBe(LOGIN_PATH);
  });

  it("sin sesión, el login es accesible", () => {
    expect(routeRedirect(LOGIN_PATH, "", false)).toBeNull();
  });

  it("con token, el proxy deja pasar (la página decide con getUser)", () => {
    // /login con sesión redirige desde la propia página tras getUser(): si lo
    // hiciera el proxy con getClaims(), una sesión revocada causaría un bucle.
    expect(routeRedirect(LOGIN_PATH, "", true)).toBeNull();
    expect(routeRedirect("/app/settings/general", "", true)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("acepta rutas internas, con query y hash", () => {
    expect(safeNextPath("/app/settings/general")).toBe("/app/settings/general");
    expect(safeNextPath("/app?tab=1#x")).toBe("/app?tab=1#x");
    // Codificado sigue siendo una ruta interna (el navegador no lo decodifica a host).
    expect(safeNextPath("/%2F%2Fevil.test")).toBe("/%2F%2Fevil.test");
  });

  it.each([
    undefined,
    null,
    "",
    "app",
    42,
    "//evil.test",
    "https://evil.test",
    "javascript:alert(1)",
    "/\\evil.test",
    "\\/evil.test",
    "/\t/evil.test",
    "/\n/evil.test",
    "/\r/evil.test",
    "/ /evil.test",
    " //evil.test",
    "/\u0000/evil.test",
    `/${"a".repeat(2048)}`,
  ])(
    "rechaza %j y vuelve a la home",
    (value) => {
      expect(safeNextPath(value)).toBe(HOME_PATH);
    },
  );
});
