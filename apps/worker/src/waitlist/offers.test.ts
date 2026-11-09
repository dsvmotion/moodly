import { describe, expect, it } from "vitest";
import { reminderRunId } from "../reminders/reminders.ts";
import { WAITLIST_RULES, nextOffer, offerKey, offerRunId, waitlistOfferConsent, waitlistWorkflowId } from "./offers.ts";

const MINUTE = 60_000;
// El lunes 3 de junio de 2030, en Madrid (UTC+2).
const at = (time: string) => Date.parse(`2030-06-03T${time}:00+02:00`);
const MADRID = "Europe/Madrid";

describe("cuándo sale la próxima oferta de un hueco", () => {
  it("de día, ya, con 30 minutos de plazo", () => {
    expect(nextOffer(at("10:00"), at("12:00"), MADRID)).toEqual({ sendAt: at("10:00"), expiresAt: at("10:30") });
  });

  it("si el hueco empieza antes de que acabe el plazo, no se ofrece; justo al acabar, sí", () => {
    expect(nextOffer(at("10:00"), at("10:29"), MADRID)).toBeNull();
    expect(nextOffer(at("10:00"), at("10:30"), MADRID)).toEqual({ sendAt: at("10:00"), expiresAt: at("10:30") });
    // Un hueco que ya pasó tampoco.
    expect(nextOffer(at("10:00"), at("09:00"), MADRID)).toBeNull();
  });

  it("de 22:00 a 07:00 del local, espera a las 07:00 (en la hora del local, no la del servidor)", () => {
    expect(nextOffer(at("03:00"), at("09:00"), MADRID)).toEqual({ sendAt: at("07:00"), expiresAt: at("07:30") });
    expect(nextOffer(Date.parse("2030-06-02T23:15:00+02:00"), at("09:00"), MADRID)).toEqual({ sendAt: at("07:00"), expiresAt: at("07:30") });
    // A las 21:59 todavía sale.
    expect(nextOffer(Date.parse("2030-06-02T21:59:00+02:00"), at("09:00"), MADRID)?.sendAt).toBe(Date.parse("2030-06-02T21:59:00+02:00"));
    // En Canarias es una hora menos: las 06:30 de Madrid son las 05:30 allí.
    expect(nextOffer(at("06:30"), at("12:00"), "Atlantic/Canary")?.sendAt).toBe(at("08:00"));
  });

  it("si el hueco es a primera hora y la noche no deja plazo, no se ofrece", () => {
    expect(nextOffer(at("03:00"), at("07:15"), MADRID)).toBeNull();
  });

  it("de serie: 30 minutos a cada uno, sin enviar de 22:00 a 07:00, a 20 personas como mucho", () => {
    expect(WAITLIST_RULES).toEqual({ offerMs: 30 * MINUTE, quietHours: { startMinute: 22 * 60, endMinute: 7 * 60 }, maxOffers: 20 });
  });
});

describe("las claves", () => {
  const ENTRY = "c5000000-0000-4000-8000-000000000001";
  it("un workflow por cita cancelada: la entrega repetida no arranca otro", () => {
    expect(waitlistWorkflowId("appt-1")).toBe("waitlist:appt-1");
  });

  it("una clave por oferta (entrada, hueco y plazo), la misma escriba la hora como la escriba", () => {
    const key = offerKey(ENTRY, "2030-06-03T09:00:00+02:00", "2030-06-03T08:30:00+02:00");
    expect(key).toBe(`waitlist-offer:${ENTRY}:2030-06-03T07:00:00.000Z:2030-06-03T06:30:00.000Z`);
    expect(offerKey(ENTRY, "2030-06-03T07:00:00Z", "2030-06-03T06:30:00.000Z")).toBe(key);
    // Otra oferta del mismo hueco a la misma persona (otro plazo) es otra clave.
    expect(offerKey(ENTRY, "2030-06-03T07:00:00Z", "2030-06-03T07:00:00Z")).not.toBe(key);
  });

  it("el run de una oferta es un UUID estable, distinto del de un recordatorio con la misma clave", () => {
    const key = offerKey(ENTRY, "2030-06-03T07:00:00Z", "2030-06-03T06:30:00Z");
    expect(offerRunId(key)).toBe(offerRunId(key));
    expect(offerRunId(key)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(offerRunId(key)).not.toBe(reminderRunId(key));
  });
});

describe("el permiso para la oferta", () => {
  it("apuntarse es pedirla: deja pasar a los de la audiencia, y solo para esta skill", async () => {
    expect(await waitlistOfferConsent.allowed({ contactIds: ["ana", "bea"], skillKey: "waitlist_offer", organizationId: "org" })).toEqual(["ana", "bea"]);
    expect(await waitlistOfferConsent.allowed({ contactIds: ["ana"], skillKey: "appointment_reminder", organizationId: "org" })).toEqual([]);
  });
});
