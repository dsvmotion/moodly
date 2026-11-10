import { defineSkill } from "@repo/agent-core";
import type { SkillContext, SkillDefinition } from "@repo/agent-core";
import { z } from "zod";

// Apuntarse a la lista de espera (paso 4f, MANUAL §5.1, decidido por producto
// el 2026-11-08): si no hay hueco que le sirva, el agente le ofrece apuntarse a
// la lista del servicio en su local, dentro de la franja en la que le viene
// bien. Cuando se libera un hueco, la plataforma se lo ofrece (4f-2).
//
// - El contacto, el local y la conversación los pone el runtime; el LLM solo
//   propone el servicio y la franja.
// - Escritura interna con autonomía execute de serie: apuntarse no compromete
//   nada, así que no espera a una persona.
// - Idempotente con la clave de la ejecución, y una sola entrada viva por
//   contacto, servicio y local: si ya estaba apuntado, devuelve la que tiene.

export const JOIN_WAITLIST_SKILL_KEY = "join_waitlist";

/** La franja más larga que se admite (la base de datos lo exige igual). */
export const MAX_WAITLIST_WINDOW_MS = 62 * 86_400_000;

export interface WaitlistEntry {
  id: string;
  serviceId: string;
  wantedFrom: Date;
  wantedUntil: Date;
  status: string;
}

export interface JoinWaitlistRequest {
  locationId: string;
  contactId: string;
  conversationId: string | null;
  serviceId: string;
  wantedFrom: Date;
  wantedUntil: Date;
  idempotencyKey: string;
}

export interface WaitlistStore {
  /** Idempotente; si el contacto ya tiene una entrada viva de ese servicio en ese local, devuelve esa. */
  join(request: JoinWaitlistRequest): Promise<{ entry: WaitlistEntry; alreadyWaiting: boolean }>;
}

export class WaitlistScopeError extends Error {
  override name = "WaitlistScopeError";
}

const instant = z.iso.datetime({ offset: true });
const input = z
  .object({
    service_id: z.uuid(),
    // «from» y «until»: «to» es un campo reservado (un destinatario, ADR 0047).
    from: instant,
    until: instant,
  })
  .refine((value) => Date.parse(value.until) > Date.parse(value.from), { message: "until tiene que ser posterior a from" })
  .refine((value) => Date.parse(value.until) - Date.parse(value.from) <= MAX_WAITLIST_WINDOW_MS, { message: "la franja no puede pasar de 62 días" });
type JoinInput = z.infer<typeof input>;

const output = z.object({
  entry_id: z.string(),
  already_waiting: z.boolean(),
  from: z.string(),
  until: z.string(),
});
type JoinOutput = z.infer<typeof output>;

export type JoinWaitlistSkill = SkillDefinition<JoinInput, JoinOutput>;

function requireScope(ctx: SkillContext): { locationId: string; contactId: string } {
  if (!ctx.locationId) throw new WaitlistScopeError("este run no tiene local: la lista de espera es de un local");
  if (!ctx.contactId) throw new WaitlistScopeError("este run no tiene contacto: la lista de espera es de alguien");
  return { locationId: ctx.locationId, contactId: ctx.contactId };
}

export function createJoinWaitlistSkill({ store }: { store: WaitlistStore }): JoinWaitlistSkill {
  return defineSkill({
    key: JOIN_WAITLIST_SKILL_KEY,
    version: 1,
    description:
      "Adds the person you are talking to to the waitlist for a service at this location, in the time range that suits them, when no free slot works for them. Offer it first and add them only if they say yes. If a slot frees up, they will be told in this conversation.",
    effectClass: "internal_write",
    defaultAutonomy: "execute",
    input,
    output,
    preview: (_ctx, args) =>
      Promise.resolve({ summary: `Apuntar en la lista de espera entre ${args.from} y ${args.until}` }),
    async execute(ctx, args) {
      const { locationId, contactId } = requireScope(ctx);
      const { entry, alreadyWaiting } = await store.join({
        locationId,
        contactId,
        conversationId: ctx.conversationId,
        serviceId: args.service_id,
        wantedFrom: new Date(args.from),
        wantedUntil: new Date(args.until),
        idempotencyKey: ctx.idempotencyKey,
      });
      return {
        entry_id: entry.id,
        already_waiting: alreadyWaiting,
        from: entry.wantedFrom.toISOString(),
        until: entry.wantedUntil.toISOString(),
      };
    },
  });
}
