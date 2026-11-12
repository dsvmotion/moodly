import { describe, expect, it } from "vitest";
import { decidableRoles, needsYouItems } from "./needs-you";

// Auditoría de preproducción, M-02 (OA10 y OA11): lo que espera a una persona,
// con su contador y el enlace a donde se resuelve. Solo lo que hay: una cuenta
// a cero no sale.
describe("needsYouItems", () => {
  it("sin nada pendiente, no hay entradas", () => {
    expect(needsYouItems({ approvals: 0, humanConversations: 0 }, null)).toEqual([]);
  });

  it("las aprobaciones llevan a Aprobaciones; las conversaciones del equipo, a su pestaña de la bandeja", () => {
    expect(needsYouItems({ approvals: 3, humanConversations: 2 }, null)).toEqual([
      { key: "approvals", count: 3, href: "/app/approvals" },
      { key: "humanConversations", count: 2, href: "/app/inbox?status=human" },
    ]);
  });

  it("conservan el alcance elegido", () => {
    expect(needsYouItems({ approvals: 1, humanConversations: 1 }, "location:l2")).toEqual([
      { key: "approvals", count: 1, href: "/app/approvals?scope=location%3Al2" },
      { key: "humanConversations", count: 1, href: "/app/inbox?status=human&scope=location%3Al2" },
    ]);
  });

  it("solo sale lo que tiene algo pendiente", () => {
    expect(needsYouItems({ approvals: 0, humanConversations: 4 }, null).map((item) => item.key)).toEqual(["humanConversations"]);
    expect(needsYouItems({ approvals: 5, humanConversations: 0 }, "all").map((item) => item.key)).toEqual(["approvals"]);
  });
});

// V10 (revisión de #178): el contador de Aprobaciones cuenta lo que la persona
// puede decidir (private.can_decide_approval), no todo lo que ve. Ver y
// decidir llegan a los mismos locales; lo que cambia es el rango: hace falta
// un rol igual o superior al que pide la aprobación (member_role_rank).
describe("decidableRoles", () => {
  it("cada rol decide lo que piden su rol y los de rango inferior", () => {
    expect(decidableRoles("staff")).toEqual(["staff"]);
    expect(decidableRoles("location_manager")).toEqual(["staff", "location_manager"]);
    expect(decidableRoles("region_manager")).toEqual(["staff", "location_manager", "region_manager"]);
    expect(decidableRoles("org_admin")).toEqual(["staff", "location_manager", "region_manager", "org_admin"]);
  });

  it("sin rol en la organización, ninguno", () => {
    expect(decidableRoles(null)).toEqual([]);
  });
});
