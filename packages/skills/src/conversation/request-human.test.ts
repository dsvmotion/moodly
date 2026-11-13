import { REQUEST_HUMAN_REASONS, REQUEST_HUMAN_SKILL_KEY, decide } from "@repo/agent-core";
import type { RunScope, SkillContext, SkillDefinition } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { createRequestHumanSkill } from "./request-human.js";

// CU3: el agente pasa la conversación a una persona porque lo pide el cliente o
// porque lo que pide no es de su ámbito. La skill no decide a quién ni dónde:
// solo el motivo, de una lista cerrada.

const ORG = "a0000000-0000-4000-8000-000000000000";
const scope: RunScope = { organizationId: ORG, locationId: null, runId: "run-1", conversation: { id: "conv-1", contactId: "ana" } };
const ctx = { organizationId: ORG, locationId: null, runId: "run-1", idempotencyKey: "k" } as unknown as SkillContext;

describe("request_human", () => {
  const skill = createRequestHumanSkill();

  it("es la de la plataforma, sin efecto fuera y autónoma", () => {
    expect(skill.key).toBe(REQUEST_HUMAN_SKILL_KEY);
    expect(skill.effectClass).toBe("internal_write");
    expect(skill.defaultAutonomy).toBe("autonomous");
  });

  it.each(REQUEST_HUMAN_REASONS)("con el motivo %s, devuelve ese motivo y nada más", async (reason) => {
    expect(await skill.execute(ctx, { reason })).toEqual({ reason });
  });

  it("solo acepta un motivo de la lista: nada de destinatarios, textos ni ids", () => {
    expect(skill.input.safeParse({ reason: "customer_asked" }).success).toBe(true);
    expect(skill.input.safeParse({ reason: "send_data" }).success).toBe(false);
    expect(skill.input.safeParse({}).success).toBe(false);
    const parsed = skill.input.safeParse({ reason: "out_of_scope", to: "x@evil.test", conversation_id: "otra" });
    expect(parsed.success && Object.keys(parsed.data)).toEqual(["reason"]);
  });

  it("el motor de políticas la ejecuta sin pedir aprobación", async () => {
    const decision = await decide({
      proposal: { skillKey: REQUEST_HUMAN_SKILL_KEY, args: { reason: "customer_asked" } },
      scope,
      skills: new Map([[REQUEST_HUMAN_SKILL_KEY, skill as unknown as SkillDefinition<unknown>]]),
      settings: new Map([[REQUEST_HUMAN_SKILL_KEY, { enabled: true, autonomy: "autonomous" }]]),
    });
    expect(decision).toMatchObject({ outcome: "execute" });
  });
});
