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

  // Auditoría de preproducción, G-02. Al resolver la URL, los segmentos de punto
  // («.», «..» y sus formas codificadas «%2e») desaparecen y lo que queda puede
  // empezar por «//», que el navegador lee como otro sitio: «/.//evil.test»
  // pasaba el filtro de la entrada y salía como «//evil.test».
  it.each([
    "/.//evil.test",
    "/app/..//evil.test",
    "/%2e//evil.test",
    "/.//evil.test/x",
    "/.//evil.test?volver=1#x",
    "/././/evil.test",
    "/.///evil.test",
    "/..//evil.test",
    "/%2E//evil.test",
    "/%2e%2e//evil.test",
    "/app/%2e%2E//evil.test",
    "/app/settings/../..//evil.test",
  ])("rechaza %j: sin los segmentos de punto apunta fuera de la app", (value) => {
    expect(safeNextPath(value)).toBe(HOME_PATH);
  });

  it("devuelve siempre una ruta que el navegador resuelve dentro de la app", () => {
    const origin = "http://127.0.0.1:3000";
    for (const value of ["/.//evil.test/x", "/app/..//evil.test", "/%2e//evil.test", "/app/../app/inbox?status=human"]) {
      expect(new URL(safeNextPath(value), origin).origin).toBe(origin);
    }
  });

  it("lo que devuelve ya está limpio: pasarlo otra vez no lo cambia", () => {
    // Si la salida no superase su propia comprobación, un sitio que la usa una
    // sola vez (la redirección de /login con sesión) quedaría expuesto.
    for (const value of ["/app", "/app?tab=1#x", "/app/./settings", "/.//evil.test/x", "/app/..//evil.test", "/%2e//evil.test"]) {
      const once = safeNextPath(value);
      expect(safeNextPath(once), value).toBe(once);
    }
  });

  it("los segmentos de punto que se quedan dentro de la app se aceptan, ya resueltos", () => {
    expect(safeNextPath("/app/./settings")).toBe("/app/settings");
    expect(safeNextPath("/app/../app/inbox?status=human")).toBe("/app/inbox?status=human");
    // Una barra doble en medio de la ruta no cambia de sitio.
    expect(safeNextPath("/app//inbox")).toBe("/app//inbox");
  });
});
