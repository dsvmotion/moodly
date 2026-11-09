import { defineSkill } from "@repo/agent-core";
import type { SkillContext, SkillDefinition } from "@repo/agent-core";
import { z } from "zod";
import type { ConversationSender } from "../conversation/reply.js";

// La oferta de la lista de espera (paso 4f-2, MANUAL §5.1, decidido por
// producto el 2026-11-08): cuando se cancela una cita, la plataforma ofrece el
// hueco al primero de la lista que encaje durante 30 minutos, por la
// conversación en la que se apuntó. No la propone el modelo: la lanza la
// plataforma, así que el modelo nunca la ve como herramienta.
//
// - Envío a un cliente (external_outreach) con autonomía execute: sale sola.
//   Es un aviso que pidió el propio cliente al apuntarse.
// - El destinatario no sale de la entrada: es el contacto de la entrada, si
//   sigue con esta oferta (ofrecida, para ese hueco, hasta esa hora y con su
//   conversación).
// - El texto es fijo por idioma (sin modelo, sin coste de IA): el servicio, el
//   local, el día y la hora del hueco, y hasta cuándo se le guarda.

export const WAITLIST_OFFER_SKILL_KEY = "waitlist_offer";

/** Lo que la oferta necesita de la entrada, de la organización del run. */
export interface OfferedEntry {
  id: string;
  status: string;
  contactId: string;
  /** La conversación en la que se apuntó; sin ella no hay por dónde ofrecer. */
  conversationId: string | null;
  offeredStartsAt: Date | null;
  offerExpiresAt: Date | null;
  service: string;
  location: string;
  timezone: string;
  /** El idioma del contacto o, si no lo tiene, el de la organización. */
  locale: string;
}

export interface WaitlistOfferSource {
  /** La entrada, o null si no existe en esta organización. */
  load(entryId: string): Promise<OfferedEntry | null>;
}

export class WaitlistOfferNotApplicableError extends Error {
  override name = "WaitlistOfferNotApplicableError";
}

type Offered = OfferedEntry & { conversationId: string; offeredStartsAt: Date; offerExpiresAt: Date };

/** Si la entrada sigue con esta oferta: ofrecida, para ese hueco, hasta esa hora y con su conversación. */
export function stillOffered(entry: OfferedEntry, startsAt: string, expiresAt: string): entry is Offered {
  return (
    entry.status === "offered" &&
    entry.offeredStartsAt?.getTime() === Date.parse(startsAt) &&
    entry.offerExpiresAt?.getTime() === Date.parse(expiresAt) &&
    entry.conversationId !== null
  );
}

type Texts = { offer: (a: { service: string; location: string; when: string; until: string }) => string };
const TEXTS: Record<"es" | "en", Texts> = {
  es: {
    offer: ({ service, location, when, until }) =>
      `¡Se ha liberado un hueco! ${service} en ${location} el ${when}. Te lo guardamos hasta las ${until}: si lo quieres, contesta SÍ. Si no, se lo ofreceremos a la siguiente persona de la lista de espera.`,
  },
  en: {
    offer: ({ service, location, when, until }) =>
      `A slot has opened up: ${service} at ${location} on ${when}. We'll hold it for you until ${until}. Reply YES if you want it; otherwise we'll offer it to the next person on the waitlist.`,
  },
};

function language(locale: string): "es" | "en" {
  return locale.toLowerCase().startsWith("es") ? "es" : "en";
}

/** El texto de la oferta, con el día, la hora y el plazo en la zona del local. */
export function offerText(entry: Pick<Offered, "service" | "location" | "timezone" | "locale" | "offeredStartsAt" | "offerExpiresAt">): string {
  const lang = language(entry.locale);
  const locale = lang === "es" ? "es-ES" : "en-GB";
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: entry.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(entry.offeredStartsAt);
  const until = new Intl.DateTimeFormat(locale, { timeZone: entry.timezone, hour: "2-digit", minute: "2-digit" }).format(entry.offerExpiresAt);
  return TEXTS[lang].offer({ service: entry.service, location: entry.location, when, until });
}

const input = z.object({
  entry_id: z.uuid(),
  // El hueco y el plazo de esta oferta: si la entrada ya no los tiene, esta no vale.
  starts_at: z.iso.datetime({ offset: true }),
  expires_at: z.iso.datetime({ offset: true }),
});
type OfferInput = z.infer<typeof input>;
const output = z.object({ message_id: z.string(), conversation_id: z.string() });
type OfferOutput = z.infer<typeof output>;

export type WaitlistOfferSkill = SkillDefinition<OfferInput, OfferOutput>;

export function createWaitlistOfferSkill({ source, sender }: { source: WaitlistOfferSource; sender: ConversationSender }): WaitlistOfferSkill {
  async function applicable(args: OfferInput) {
    const entry = await source.load(args.entry_id);
    return entry && stillOffered(entry, args.starts_at, args.expires_at) ? entry : null;
  }

  return defineSkill({
    key: WAITLIST_OFFER_SKILL_KEY,
    version: 1,
    description: "Ofrece un hueco que se ha liberado a la siguiente persona de la lista de espera, durante 30 minutos, en la conversación en la que se apuntó.",
    effectClass: "external_outreach",
    defaultAutonomy: "execute",
    input,
    output,
    // El contacto de la entrada, solo si sigue con esta oferta.
    async audience(_ctx, args) {
      const entry = await applicable(args);
      return entry ? [entry.contactId] : [];
    },
    async preview(_ctx, args) {
      const entry = await applicable(args);
      return { summary: entry ? offerText(entry) : "Ofrecer un hueco que ya no está ofrecido a esta persona (no se enviará)" };
    },
    async execute(ctx: SkillContext, args) {
      const entry = await applicable(args);
      if (!entry) throw new WaitlistOfferNotApplicableError("la entrada ya no tiene esta oferta");
      if (ctx.target.kind !== "audience" || !ctx.target.contactIds.includes(entry.contactId)) {
        throw new WaitlistOfferNotApplicableError("el contacto de la entrada no está en la audiencia que resolvió el runtime");
      }
      const sent = await sender.send({ conversationId: entry.conversationId, text: offerText(entry), idempotencyKey: ctx.idempotencyKey });
      return { message_id: sent.messageId, conversation_id: entry.conversationId };
    },
  });
}
