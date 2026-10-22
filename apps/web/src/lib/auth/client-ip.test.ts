import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const h = (values: Record<string, string>) => new Headers(values);

describe("clientIp", () => {
  it("toma el primer valor de x-forwarded-for (el que pone la plataforma)", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("acepta IPv6", () => {
    expect(clientIp(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("usa x-real-ip si no hay x-forwarded-for", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("sin cabeceras (local) devuelve «local»", () => {
    expect(clientIp(h({}))).toBe("local");
  });

  it("descarta valores que no son una IP", () => {
    expect(clientIp(h({ "x-forwarded-for": "<script>alert(1)</script>" }))).toBe("local");
    expect(clientIp(h({ "x-forwarded-for": "a".repeat(100) }))).toBe("local");
  });
});
