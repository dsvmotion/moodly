import { decide } from "@repo/agent-core";
import type { ConsentChecker, RunScope, SkillContext, SkillDefinition, SkillSettings } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { createFakeConversationSender } from "../conversation/fake.js";
import { WAITLIST_OFFER_SKILL_KEY, WaitlistOfferNotApplicableError, createWaitlistOfferSkill, offerText, stillOffered } from "./waitlist-offer.js";
import type { OfferedEntry } from "./waitlist-offer.js";

const ORG = "a0000000-0000-4000-8000-000000000000";
const LOC = "a2000000-0000-4000-8000-000000000001";
const ENTRY = "c5000000-0000-4000-8000-000000000001";
const ANA = "c3000000-0000-4000-8000-000000000001";
const RUN = "d0000000-0000-4000-8000-000000000001";
const STARTS = "2030-06-03T09:00:00+02:00";
const EXPIRES = "2030-06-02T18:30:00+02:00";

const entry = (over: Partial<OfferedEntry> = {}): OfferedEntry => ({
  id: ENTRY,
  status: "offered",
  contactId: ANA,
  conversationId: "conv-1",
  offeredStartsAt: new Date(STARTS),
  offerExpiresAt: new Date(EXPIRES),
  service: "Láser",
  location: "Centro",
  timezone: "Europe/Madrid",
  locale: "es",
  ...over,
});

function setup(current: OfferedEntry | null = entry()) {
  const sender = createFakeConversationSender();
  const skill = createWaitlistOfferSkill({ source: { load: (id) => Promise.resolve(id === ENTRY ? current : null) }, sender });
  return { sender, skill };
}

const scope: RunScope = { organizationId: ORG, locationId: LOC, runId: RUN, conversation: { id: "conv-1", contactId: ANA } };
const everyone: ConsentChecker = { allowed: ({ contactIds }) => Promise.resolve(contactIds) };
const args = (over: Record<string, unknown> = {}) => ({ entry_id: ENTRY, starts_at: STARTS, expires_at: EXPIRES, ...over });

async function decideWith(skill: SkillDefinition<unknown>, settings: SkillSettings = { enabled: true, autonomy: "execute" }, consent = everyone, input = args()) {
  return decide({
    proposal: { skillKey: WAITLIST_OFFER_SKILL_KEY, args: input },
    scope,
    skills: new Map([[WAITLIST_OFFER_SKILL_KEY, skill]]),
    settings: new Map([[WAITLIST_OFFER_SKILL_KEY, settings]]),
    consent,
  });
}

const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  organizationId: ORG,
  locationId: LOC,
  runId: RUN,
  contactId: ANA,
  conversationId: "conv-1",
  target: { kind: "audience", contactIds: [ANA] },
  idempotencyKey: `waitlist-offer:${ENTRY}:2030-06-03T07:00:00.000Z:2030-06-02T16:30:00.000Z`,
  ...over,
});

describe("el texto de la oferta", () => {
  it("en español: el servicio, el local, el día y la hora del hueco, hasta cuándo se le guarda y cómo aceptarlo", () => {
    const text = offerText(entry() as Parameters<typeof offerText>[0]);
    expect(text).toContain("Láser");
    expect(text).toContain("Centro");
    expect(text).toContain("lunes, 3 de junio");
    expect(text).toContain("09:00");
    expect(text).toContain("hasta las 18:30");
    expect(text).toContain("SÍ");
  });

  it("en inglés, con YES; y las horas son siempre las del local, no las del servidor", () => {
    const text = offerText(entry({ locale: "en", timezone: "Atlantic/Canary" }) as Parameters<typeof offerText>[0]);
    expect(text).toContain("Monday 3 June");
    expect(text).toContain("08:00");
    expect(text).toContain("until 17:30");
    expect(text).toContain("YES");
  });

  it("un idioma que no tenemos sale en inglés", () => {
    expect(offerText(entry({ locale: "fr" }) as Parameters<typeof offerText>[0])).toMatch(/^A slot has opened up/);
  });
});

describe("si la entrada sigue con esta oferta", () => {
  it("ofrecida, para ese hueco, hasta esa hora y con su conversación: sí (la misma hora en otra zona también)", () => {
    expect(stillOffered(entry(), STARTS, EXPIRES)).toBe(true);
    expect(stillOffered(entry(), "2030-06-03T07:00:00Z", "2030-06-02T16:30:00Z")).toBe(true);
  });

  it("otro hueco, otro plazo (otra oferta), ya no ofrecida o sin conversación: no", () => {
    expect(stillOffered(entry(), "2030-06-03T10:00:00+02:00", EXPIRES)).toBe(false);
    expect(stillOffered(entry(), STARTS, "2030-06-02T19:00:00+02:00")).toBe(false);
    for (const status of ["waiting", "booked", "expired", "cancelled"]) expect(stillOffered(entry({ status }), STARTS, EXPIRES)).toBe(false);
    expect(stillOffered(entry({ conversationId: null }), STARTS, EXPIRES)).toBe(false);
    expect(stillOffered(entry({ offeredStartsAt: null, offerExpiresAt: null }), STARTS, EXPIRES)).toBe(false);
  });
});

describe("la oferta con el motor de políticas", () => {
  it("sale sola (execute) y va al contacto de la entrada", async () => {
    const { skill } = setup();
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>)).toMatchObject({
      outcome: "execute",
      target: { kind: "audience", contactIds: [ANA] },
      autonomy: "execute",
    });
  });

  it("no pasa de execute aunque el agente la tenga en autónoma (el techo de la clase)", async () => {
    const { skill } = setup();
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, { enabled: true, autonomy: "autonomous" })).toMatchObject({
      outcome: "execute",
      autonomy: "execute",
    });
  });

  it("si la entrada ya no tiene esta oferta o no es de esta organización, no hay a quién enviarla", async () => {
    for (const current of [entry({ status: "waiting" }), entry({ offerExpiresAt: new Date("2030-06-02T19:00:00+02:00") }), null]) {
      const { skill } = setup(current);
      expect(await decideWith(skill as unknown as SkillDefinition<unknown>)).toMatchObject({ outcome: "reject", reason: "no_recipients" });
    }
  });

  it("el comprobador de permisos no puede añadir a nadie", async () => {
    const { skill } = setup();
    const extra: ConsentChecker = { allowed: () => Promise.resolve([ANA, "otro-contacto"]) };
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, undefined, extra)).toMatchObject({ target: { contactIds: [ANA] } });
  });

  it("desactivada, no sale; con menos autonomía, no es execute (el worker no la envía)", async () => {
    const { skill } = setup();
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, { enabled: false, autonomy: "execute" })).toMatchObject({
      outcome: "reject",
      reason: "skill_disabled",
    });
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, { enabled: true, autonomy: "draft" })).toMatchObject({ outcome: "draft" });
  });

  it("la entrada no admite un destinatario, un contacto ni otra conversación", async () => {
    const { skill } = setup();
    for (const extra of [{ conversation_id: "otra" }, { contact_id: "otro" }, { to: "otro" }]) {
      expect(await decideWith(skill as unknown as SkillDefinition<unknown>, undefined, everyone, args(extra))).toMatchObject({
        outcome: "reject",
        reason: "reserved_field",
      });
    }
  });
});

describe("enviar la oferta", () => {
  it("por la conversación en la que se apuntó, con la clave de la ejecución: un reintento no la repite", async () => {
    const { sender, skill } = setup();
    const input = skill.input.parse(args());
    const first = await skill.execute(ctx(), input);
    const again = await skill.execute(ctx(), input);
    expect(again).toEqual(first);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({ conversationId: "conv-1", idempotencyKey: ctx().idempotencyKey });
    expect(sender.sent[0]?.text).toContain("Láser");
    expect(first).toEqual({ message_id: "msg-1", conversation_id: "conv-1" });
  });

  it("nunca a la conversación del run si no es la de la entrada", async () => {
    const { sender, skill } = setup(entry({ conversationId: "conv-de-la-lista" }));
    await skill.execute(ctx({ conversationId: "otra-conversacion" }), skill.input.parse(args()));
    expect(sender.sent[0]?.conversationId).toBe("conv-de-la-lista");
  });

  it("si el contacto no está en la audiencia que resolvió el runtime, no se envía", async () => {
    const { sender, skill } = setup();
    await expect(skill.execute(ctx({ target: { kind: "audience", contactIds: ["otro"] } }), skill.input.parse(args()))).rejects.toThrow(
      WaitlistOfferNotApplicableError,
    );
    await expect(skill.execute(ctx({ target: { kind: "none" } }), skill.input.parse(args()))).rejects.toThrow(WaitlistOfferNotApplicableError);
    expect(sender.sent).toHaveLength(0);
  });

  it("si la oferta cambió entre decidir y enviar, no se envía", async () => {
    const { sender, skill } = setup(entry({ status: "waiting" }));
    await expect(skill.execute(ctx(), skill.input.parse(args()))).rejects.toThrow(WaitlistOfferNotApplicableError);
    expect(sender.sent).toHaveLength(0);
  });

  it("lo que ve quien revisa la ejecución es el texto que se envía", async () => {
    const { skill } = setup();
    expect((await skill.preview(ctx(), skill.input.parse(args()))).summary).toBe(offerText(entry() as Parameters<typeof offerText>[0]));
  });
});
