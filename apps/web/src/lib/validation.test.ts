import { describe, expect, it } from "vitest";
import { idSchema, inviteSchema, tokenSchema, totpCodeSchema } from "./validation";

const ORG = "5eed0000-0000-4000-8000-00000000000a";
const LOC = "5eed0002-0000-4000-8000-0000000000a1";

describe("inviteSchema", () => {
  it("acepta una invitación bien formada (alcance vacío por defecto)", () => {
    expect(inviteSchema.parse({ organizationId: ORG, email: "ana@demo.test", role: "staff", scopeId: LOC })).toEqual({
      organizationId: ORG,
      email: "ana@demo.test",
      role: "staff",
      scopeId: LOC,
    });
    expect(inviteSchema.parse({ organizationId: ORG, email: "ana@demo.test", role: "org_admin" }).scopeId).toBe("");
  });

  it.each([
    ["organización que no es un uuid", { organizationId: "1; drop table", email: "ana@demo.test", role: "staff" }],
    ["email sin @", { organizationId: ORG, email: "no-es-un-email", role: "staff" }],
    ["rol inventado", { organizationId: ORG, email: "ana@demo.test", role: "platform_admin" }],
    ["alcance que no es un uuid", { organizationId: ORG, email: "ana@demo.test", role: "staff", scopeId: "x" }],
    ["email demasiado largo", { organizationId: ORG, email: `${"a".repeat(320)}@demo.test`, role: "staff" }],
  ])("rechaza %s", (_label, input) => {
    expect(inviteSchema.safeParse(input).success).toBe(false);
  });
});

describe("otros esquemas", () => {
  it("idSchema solo acepta uuid", () => {
    expect(idSchema.safeParse(LOC).success).toBe(true);
    expect(idSchema.safeParse("123").success).toBe(false);
  });

  it("tokenSchema acota la longitud", () => {
    expect(tokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(tokenSchema.safeParse("").success).toBe(false);
    expect(tokenSchema.safeParse("a".repeat(129)).success).toBe(false);
  });

  it("totpCodeSchema: 6 cifras, con espacios tolerados", () => {
    expect(totpCodeSchema.parse("123 456")).toBe("123456");
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
    expect(totpCodeSchema.safeParse("12a456").success).toBe(false);
  });
});
