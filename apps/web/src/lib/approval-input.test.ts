import { describe, expect, it } from "vitest";
import { MAX_REPLY_LENGTH } from "@repo/config";
import { parseApprovalInput, replyEditFor, slotHasPassed } from "./approval-input";

const SERVICE = "5eed000a-0000-4000-8000-000000000001";
const APPOINTMENT = "5eed000b-0000-4000-8000-000000000001";
const NOW = new Date("2030-06-03T07:30:00Z");

describe("parseApprovalInput", () => {
  it("una respuesta, con su texto", () => {
    expect(parseApprovalInput("reply", { text: "Hola" })).toEqual({ kind: "reply", text: "Hola" });
  });

  it("una reserva, con o sin recurso", () => {
    expect(parseApprovalInput("book_appointment", { service_id: SERVICE, resource_id: "r1", starts_at: "2030-06-03T09:00:00+02:00" })).toEqual({
      kind: "booking",
      serviceId: SERVICE,
      resourceId: "r1",
      startsAt: "2030-06-03T09:00:00+02:00",
    });
    expect(parseApprovalInput("book_appointment", { service_id: SERVICE, starts_at: "2030-06-03T09:00:00+02:00" })).toMatchObject({
      kind: "booking",
      resourceId: null,
    });
  });

  it("un cambio de cita y una cancelación", () => {
    expect(parseApprovalInput("reschedule_appointment", { appointment_id: APPOINTMENT, starts_at: "2030-06-04T10:00:00Z" })).toEqual({
      kind: "reschedule",
      appointmentId: APPOINTMENT,
      resourceId: null,
      startsAt: "2030-06-04T10:00:00Z",
    });
    expect(parseApprovalInput("cancel_appointment", { appointment_id: APPOINTMENT })).toEqual({ kind: "cancel", appointmentId: APPOINTMENT });
  });

  it("lo que no tiene la forma esperada no se adivina: «other»", () => {
    expect(parseApprovalInput("reply", { text: "" })).toEqual({ kind: "other" });
    expect(parseApprovalInput("reply", null)).toEqual({ kind: "other" });
    expect(parseApprovalInput("book_appointment", { service_id: SERVICE, starts_at: "el lunes" })).toEqual({ kind: "other" });
    expect(parseApprovalInput("cancel_appointment", {})).toEqual({ kind: "other" });
    expect(parseApprovalInput("waitlist_offer", { text: "Hola" })).toEqual({ kind: "other" });
  });
});

describe("slotHasPassed", () => {
  const booking = (startsAt: string) => parseApprovalInput("book_appointment", { service_id: SERVICE, starts_at: startsAt });

  it("una reserva o un cambio cuya hora ya pasó, o es justo ahora", () => {
    expect(slotHasPassed(booking("2030-06-03T07:00:00Z"), NOW)).toBe(true);
    expect(slotHasPassed(booking(NOW.toISOString()), NOW)).toBe(true);
    expect(slotHasPassed(parseApprovalInput("reschedule_appointment", { appointment_id: APPOINTMENT, starts_at: "2030-06-01T10:00:00Z" }), NOW)).toBe(true);
  });

  it("con la hora por llegar, no; y lo que no tiene hora, nunca", () => {
    expect(slotHasPassed(booking("2030-06-03T10:00:00+02:00"), NOW)).toBe(false);
    expect(slotHasPassed(parseApprovalInput("reply", { text: "Hola" }), NOW)).toBe(false);
    expect(slotHasPassed(parseApprovalInput("cancel_appointment", { appointment_id: APPOINTMENT }), NOW)).toBe(false);
    expect(slotHasPassed({ kind: "other" }, NOW)).toBe(false);
  });
});

describe("replyEditFor (OA02)", () => {
  const reply = parseApprovalInput("reply", { text: "Hola, tenemos hueco el lunes." });

  it("un texto distinto es una corrección, sin los espacios de los lados", () => {
    expect(replyEditFor(reply, "  Hola, tenemos hueco el martes.  ")).toEqual({ ok: true, edited: { text: "Hola, tenemos hueco el martes." } });
  });

  it("el mismo texto (con o sin espacios) no es una corrección", () => {
    expect(replyEditFor(reply, "Hola, tenemos hueco el lunes.")).toEqual({ ok: true, edited: null });
    expect(replyEditFor(reply, "  Hola, tenemos hueco el lunes.\n")).toEqual({ ok: true, edited: null });
  });

  it("vacío o más largo que una respuesta: no vale", () => {
    expect(MAX_REPLY_LENGTH).toBe(4000);
    expect(replyEditFor(reply, "   ")).toEqual({ ok: false, reason: "invalid" });
    expect(replyEditFor(reply, "a".repeat(MAX_REPLY_LENGTH + 1))).toEqual({ ok: false, reason: "invalid" });
    expect(replyEditFor(reply, "a".repeat(MAX_REPLY_LENGTH))).toEqual({ ok: true, edited: { text: "a".repeat(MAX_REPLY_LENGTH) } });
  });

  it("solo se corrige una respuesta", () => {
    const booking = parseApprovalInput("book_appointment", { service_id: "s", starts_at: "2030-06-03T10:00:00Z" });
    expect(replyEditFor(booking, "Otra cosa")).toEqual({ ok: false, reason: "not_editable" });
    expect(replyEditFor({ kind: "other" }, "Otra cosa")).toEqual({ ok: false, reason: "not_editable" });
  });
});
