import { describe, expect, it } from "vitest";
import { eventPayloads, isEventType, parsePayload } from "./catalog.ts";
import { createEventRegistry, type EventHandler } from "./handlers.ts";
import { deliveryWorkflowId } from "./outbox.ts";

const INVITATION = "5eed0000-0000-4000-8000-0000000000a1";
const USER = "5eed0000-0000-4000-8000-0000000000b1";
const OTHER_ORG = "5eed0000-0000-4000-8000-00000000000b";

function handler(key: string, eventTypes: EventHandler["eventTypes"]): EventHandler {
  return { key, eventTypes, handle: async () => {} };
}

describe("catálogo de eventos", () => {
  it("quita del payload lo que no está en su esquema, también el tenant (3.7)", () => {
    const payload = { invitation_id: INVITATION, role: "staff", invited_by: USER, organization_id: OTHER_ORG, location_id: OTHER_ORG, email: "x@y.z" };
    expect(parsePayload("invitation.created", payload)).toEqual({ invitation_id: INVITATION, role: "staff", invited_by: USER });
  });

  it("rechaza un payload que no cumple su esquema", () => {
    expect(() => parsePayload("invitation.created", { invitation_id: "no-es-un-uuid", role: "staff", invited_by: USER })).toThrow();
    expect(() => parsePayload("invitation.created", { invitation_id: INVITATION, role: "dueño", invited_by: USER })).toThrow();
  });

  it("los de las citas: el id y las horas con su zona, tal como los escribe Postgres", () => {
    const appointment = "a0000000-0000-4000-8000-0000000000a1";
    // to_jsonb(timestamptz) da la hora con su desfase, p. ej. "2030-06-03T09:00:00+02:00".
    expect(parsePayload("appointment.created", { appointment_id: appointment, starts_at: "2030-06-03T07:00:00+00:00", contact_id: USER })).toEqual({
      appointment_id: appointment,
      starts_at: "2030-06-03T07:00:00+00:00",
    });
    expect(
      parsePayload("appointment.rescheduled", {
        appointment_id: appointment,
        starts_at: "2030-06-03T09:00:00.123456+00:00",
        previous_starts_at: "2030-06-03T07:00:00+00:00",
      }),
    ).toMatchObject({ previous_starts_at: "2030-06-03T07:00:00+00:00" });
    expect(() => parsePayload("appointment.cancelled", { appointment_id: appointment, starts_at: "mañana" })).toThrow();
    expect(() => parsePayload("appointment.cancelled", { appointment_id: appointment })).toThrow();
  });

  it("ningún esquema admite claves de tenant", () => {
    for (const schema of Object.values(eventPayloads)) {
      expect(Object.keys(schema.shape)).not.toContain("organization_id");
      expect(Object.keys(schema.shape)).not.toContain("location_id");
    }
  });

  it("solo conoce los tipos de su catálogo", () => {
    expect(isEventType("invitation.created")).toBe(true);
    expect(isEventType("toString")).toBe(false);
    expect(isEventType("appointment.created")).toBe(true);
    expect(isEventType("payment.received")).toBe(false);
  });
});

describe("registro de consumidores", () => {
  it("da los suscritos a un tipo, más los de «*»", () => {
    const registry = createEventRegistry([handler("log", "*"), handler("invitations", ["invitation.created"])]);
    expect(registry.handlersFor("invitation.created").map((h) => h.key)).toEqual(["log", "invitations"]);
    expect(registry.handlersFor("appointment.created").map((h) => h.key)).toEqual(["log"]);
    expect(registry.get("invitations")?.key).toBe("invitations");
    expect(registry.get("nadie")).toBeUndefined();
  });

  it("rechaza claves repetidas o no válidas y tipos fuera del catálogo", () => {
    expect(() => createEventRegistry([handler("log", "*"), handler("log", "*")])).toThrow(/repetido/);
    expect(() => createEventRegistry([handler("Con Espacios", "*")])).toThrow(/clave/);
    expect(() => createEventRegistry([handler("x", ["payment.received" as "invitation.created"])])).toThrow(/catálogo/);
  });

  it("el ID de una entrega es el mismo cada vez: volver a encolar no crea otra", () => {
    expect(deliveryWorkflowId(INVITATION, "log")).toBe(`event:${INVITATION}:log`);
    expect(deliveryWorkflowId(INVITATION, "log")).toBe(deliveryWorkflowId(INVITATION, "log"));
  });
});
