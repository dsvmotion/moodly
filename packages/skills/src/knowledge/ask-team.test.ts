import { decide } from "@repo/agent-core";
import type { RunScope, SkillContext, SkillDefinition } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { ASK_TEAM_SKILL_KEY, AskTeamScopeError, createAskTeamSkill } from "./ask-team.js";
import type { KnowledgeRequestDraft, KnowledgeRequestStore } from "./ask-team.js";

const ORG = "a0000000-0000-4000-8000-000000000000";
const OTHER_LOC = "a2000000-0000-4000-8000-000000000009";
const LOC = "a2000000-0000-4000-8000-000000000001";
const RUN = "d0000000-0000-4000-8000-000000000001";

function setup() {
  const drafts: KnowledgeRequestDraft[] = [];
  const store: KnowledgeRequestStore = {
    create(draft) {
      const existing = drafts.findIndex((d) => d.idempotencyKey === draft.idempotencyKey);
      if (existing >= 0) return Promise.resolve({ id: `kr-${existing}`, alreadyAsked: true });
      drafts.push(draft);
      return Promise.resolve({ id: `kr-${drafts.length - 1}`, alreadyAsked: false });
    },
  };
  return { drafts, skill: createAskTeamSkill({ store }) };
}

const scope: RunScope = { organizationId: ORG, locationId: LOC, runId: RUN, conversation: { id: "conv-1", contactId: "ct-1" } };
const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  organizationId: ORG,
  locationId: LOC,
  runId: RUN,
  contactId: "ct-1",
  conversationId: "conv-1",
  target: { kind: "none" },
  idempotencyKey: `${RUN}:0:0:ask_team`,
  ...over,
});

async function decideWith(args: Record<string, unknown>) {
  const { skill } = setup();
  return decide({
    proposal: { skillKey: ASK_TEAM_SKILL_KEY, args },
    scope,
    skills: new Map([[ASK_TEAM_SKILL_KEY, skill as unknown as SkillDefinition<unknown>]]),
    settings: new Map([[ASK_TEAM_SKILL_KEY, { enabled: true, autonomy: "execute" }]]),
  });
}

describe("preguntar al equipo en vez de inventar (B20-4b)", () => {
  it("es escritura interna y sale sola: no compromete nada ni va al cliente", async () => {
    const { skill } = setup();
    expect([skill.key, skill.version, skill.effectClass, skill.defaultAutonomy]).toEqual(["ask_team", 1, "internal_write", "execute"]);
    expect(await decideWith({ question: "¿Tenéis aparcamiento?" })).toMatchObject({ outcome: "execute", target: { kind: "none" } });
  });

  it("pregunta con el local, el run y la conversación del runtime, nunca con lo que proponga el modelo", async () => {
    const { skill, drafts } = setup();
    const input = skill.input.parse({ question: "  ¿Hacéis tatuajes?  ", location_id: OTHER_LOC, conversation_id: "otra" });
    const output = await skill.execute(ctx(), input);
    expect(drafts).toEqual([
      { locationId: LOC, conversationId: "conv-1", runId: RUN, question: "¿Hacéis tatuajes?", idempotencyKey: `${RUN}:0:0:ask_team` },
    ]);
    expect(output).toEqual({ request_id: "kr-0", already_asked: false, note: expect.stringContaining("a person from the team will reply") as unknown as string });
    expect(skill.output.parse(output)).toEqual(output);
  });

  it("si el paso se repite, devuelve la misma pregunta", async () => {
    const { skill, drafts } = setup();
    await skill.execute(ctx(), { question: "¿Abrís en agosto?" });
    expect(await skill.execute(ctx(), { question: "¿Abrís en agosto?" })).toMatchObject({ request_id: "kr-0", already_asked: true });
    expect(drafts).toHaveLength(1);
  });

  it("un run de toda la organización pregunta sin local (la contesta un org_admin)", async () => {
    const { skill, drafts } = setup();
    await skill.execute(ctx({ locationId: null }), { question: "¿Tenéis tarjeta regalo?" });
    expect(drafts[0]?.locationId).toBeNull();
  });

  it("sin conversación no pregunta: la respuesta no tendría a quién llegar", async () => {
    const { skill, drafts } = setup();
    await expect(skill.execute(ctx({ conversationId: null }), { question: "¿Tenéis aparcamiento?" })).rejects.toBeInstanceOf(AskTeamScopeError);
    expect(drafts).toEqual([]);
  });

  it("la pregunta: de 5 a 500 caracteres", async () => {
    expect(await decideWith({ question: "  ¿?  " })).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await decideWith({ question: "x".repeat(501) })).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await decideWith({})).toMatchObject({ outcome: "reject", reason: "invalid_input" });
  });
});
