import { describe, expect, it } from "vitest";
import { HOME_PATH, LOGIN_PATH, routeRedirect, safeNextPath } from "./routes";

describe("routeRedirect", () => {
  it("sin sesión, cualquier ruta privada va al login conservando el destino", () => {
    expect(routeRedirect("/app/settings/organization", "", false)).toBe(
      `${LOGIN_PATH}?next=${encodeURIComponent("/app/settings/organization")}`,
    );
    expect(routeRedirect("/app", "?tab=1", false)).toBe(`${LOGIN_PATH}?next=${encodeURIComponent("/app?tab=1")}`);
    expect(routeRedirect("/", "", false)).toBe(LOGIN_PATH);
  });

  it("sin sesión, el login es accesible", () => {
    expect(routeRedirect(LOGIN_PATH, "", false)).toBeNull();
  });

  it("con sesión, el login redirige a la app y el resto pasa", () => {
    expect(routeRedirect(LOGIN_PATH, "", true)).toBe(HOME_PATH);
    expect(routeRedirect("/app/settings/organization", "", true)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/app/settings/organization")).toBe("/app/settings/organization");
  });

  it.each([undefined, null, "", "app", "//evil.test", "/\\evil.test", "https://evil.test", 42])(
    "rechaza %j y vuelve a la home",
    (value) => {
      expect(safeNextPath(value)).toBe(HOME_PATH);
    },
  );
});
