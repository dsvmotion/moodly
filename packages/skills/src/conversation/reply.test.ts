import { decide } from "@repo/agent-core";
import type { RunScope, SkillContext, SkillDefinition, SkillSettings } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { createFakeConversationSender } from "./fake.js";
import { MAX_REPLY_LENGTH, ReplyTargetError, createReplySkill } from "./reply.js";

const scope: RunScope = { organizationId: "org-1", locationId: "loc-1", runId: "run-1", conversation: { id: "conv-1", contactId: "ana" } };
const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  organizationId: "org-1",
  locationId: "loc-1",
  runId: "run-1",
  contactId: "ana",
  conversationId: "conv-1",
  target: { kind: "conversation", conversationId: "conv-1", contactId: "ana" },
  idempotencyKey: "run-1:0:0:reply",
  ...over,
});

function setup() {
  const sender = createFakeConversationSender();
  const reply = createReplySkill({ sender });
  return { sender, reply, skills: new Map([[reply.key, reply as unknown as SkillDefinition<unknown>]]) };
}
const settings = (autonomy: SkillSettings["autonomy"]) => new Map([["reply", { enabled: true, autonomy }]]);

describe("reply con el motor de políticas", () => {
  it("nace en borrador y va a la conversación del run", async () => {
    const { reply, skills } = setup();
    expect(reply.defaultAutonomy).toBe("draft");
    const decision = await decide({ proposal: { skillKey: "reply", args: { text: "Hola" } }, scope, skills, settings: settings("draft") });
    expect(decision).toMatchObject({ outcome: "draft", target: { kind: "conversation", conversationId: "conv-1", contactId: "ana" } });
  });

  it("sin conversación no hay a quién responder", async () => {
    const { skills } = setup();
    const decision = await decide({
      proposal: { skillKey: "reply", args: { text: "Hola" } },
      scope: { ...scope, conversation: null },
      skills,
      settings: settings("autonomous"),
    });
    expect(decision).toMatchObject({ outcome: "reject", reason: "no_conversation" });
  });

  it("el modelo no elige el destinatario", async () => {
    const { skills } = setup();
    const decision = await decide({
      proposal: { skillKey: "reply", args: { text: "Hola", to: "+34600000000" } },
      scope,
      skills,
      settings: settings("autonomous"),
    });
    expect(decision).toMatchObject({ outcome: "reject", reason: "reserved_field" });
  });

  it("rechaza una respuesta vacía o demasiado larga para cualquier canal", async () => {
    const { skills } = setup();
    const propose = (text: string) => decide({ proposal: { skillKey: "reply", args: { text } }, scope, skills, settings: settings("autonomous") });
    expect(await propose("   ")).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await propose("a".repeat(MAX_REPLY_LENGTH + 1))).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await propose("a".repeat(MAX_REPLY_LENGTH))).toMatchObject({ outcome: "execute" });
  });
});

describe("enviar la respuesta", () => {
  it("la manda a la conversación del destino, una sola vez por ejecución", async () => {
    const { reply, sender } = setup();
    const first = await reply.execute(ctx(), { text: "Hola, Ana" });
    const retry = await reply.execute(ctx(), { text: "Hola, Ana" });
    expect(retry).toEqual(first);
    expect(sender.sent).toEqual([{ id: "msg-1", conversationId: "conv-1", text: "Hola, Ana", idempotencyKey: "run-1:0:0:reply" }]);
  });

  it("nunca a otro sitio que no sea una conversación", async () => {
    const { reply, sender } = setup();
    await expect(reply.execute(ctx({ target: { kind: "none" } }), { text: "Hola" })).rejects.toThrow(ReplyTargetError);
    expect(sender.sent).toEqual([]);
  });

  it("la vista previa enseña el texto que se enviaría", async () => {
    const { reply } = setup();
    expect((await reply.preview(ctx(), { text: "Tengo hueco a las 9:00" })).summary).toBe("Responder: «Tengo hueco a las 9:00»");
  });
});
