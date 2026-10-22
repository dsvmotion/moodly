import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce, SECURITY_HEADERS } from "./headers";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("createNonce", () => {
  it("es distinto en cada llamada y tiene 128 bits", () => {
    const a = createNonce();
    expect(a).not.toBe(createNonce());
    expect(atob(a)).toHaveLength(16);
  });
});

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy("abc123");

  it("solo ejecuta scripts propios con el nonce de la petición", () => {
    expect(directive(prod, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  });

  it("en producción no permite eval ni scripts en línea", () => {
    expect(prod).not.toContain("'unsafe-eval'");
    expect(directive(prod, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("el navegador solo habla con la propia app", () => {
    expect(directive(prod, "connect-src")).toBe("connect-src 'self'");
  });

  it("nadie puede incrustar la app ni cambiar la base ni el destino de los formularios", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
    expect(directive(prod, "form-action")).toBe("form-action 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("en desarrollo añade solo lo que necesita el recargado en caliente", () => {
    const dev = contentSecurityPolicy("abc123", { dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toBe("connect-src 'self' ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("sin HTTPS no pide subir las peticiones a https:// (en local no existe)", () => {
    expect(contentSecurityPolicy("abc123", { https: false })).not.toContain("upgrade-insecure-requests");
  });
});

describe("SECURITY_HEADERS", () => {
  const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));

  it("incluye las cabeceras de OWASP Secure Headers", () => {
    expect(byKey["Strict-Transport-Security"]).toMatch(/max-age=63072000; includeSubDomains/);
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(byKey["Permissions-Policy"]).toContain("camera=()");
  });
});
