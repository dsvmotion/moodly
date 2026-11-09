import { decide } from "@repo/agent-core";
import type { RunScope, SkillContext, SkillDefinition } from "@repo/agent-core";
import type { KnowledgeHit, KnowledgeQuery, KnowledgeRetriever } from "@repo/knowledge";
import { describe, expect, it } from "vitest";
import { KNOWLEDGE_RESULTS, SEARCH_KNOWLEDGE_SKILL_KEY, createSearchKnowledgeSkill } from "./search.js";

const ORG = "a0000000-0000-4000-8000-000000000000";
const OTHER_ORG = "b0000000-0000-4000-8000-000000000000";
const LOC = "a2000000-0000-4000-8000-000000000001";
const RUN = "d0000000-0000-4000-8000-000000000001";

const hit = (title: string, content: string): KnowledgeHit => ({
  untrusted: true,
  source: "knowledge:s1",
  chunkId: "c1",
  content,
  score: 0.03,
  citation: { sourceId: "s1", type: "policy", title },
});

function setup(hits: KnowledgeHit[] = []) {
  const queries: KnowledgeQuery[] = [];
  const retriever: KnowledgeRetriever = {
    search(query) {
      queries.push(query);
      return Promise.resolve(hits);
    },
  };
  return { queries, skill: createSearchKnowledgeSkill({ retriever }) };
}

const scope: RunScope = { organizationId: ORG, locationId: LOC, runId: RUN, conversation: { id: "conv-1", contactId: "ct-1" } };
const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  organizationId: ORG,
  locationId: LOC,
  runId: RUN,
  contactId: "ct-1",
  conversationId: "conv-1",
  target: { kind: "none" },
  idempotencyKey: `${RUN}:0:0:search_knowledge`,
  ...over,
});

async function decideWith(args: Record<string, unknown>, autonomy: "autonomous" | "draft" = "autonomous") {
  const { skill } = setup();
  return decide({
    proposal: { skillKey: SEARCH_KNOWLEDGE_SKILL_KEY, args },
    scope,
    skills: new Map([[SEARCH_KNOWLEDGE_SKILL_KEY, skill as unknown as SkillDefinition<unknown>]]),
    settings: new Map([[SEARCH_KNOWLEDGE_SKILL_KEY, { enabled: true, autonomy }]]),
  });
}

describe("buscar en el conocimiento del negocio (B20-2)", () => {
  it("es lectura y sale sola", async () => {
    const { skill } = setup();
    expect([skill.key, skill.version, skill.effectClass, skill.defaultAutonomy]).toEqual(["search_knowledge", 1, "read", "autonomous"]);
    expect(await decideWith({ query: "¿Cuánto cuesta el láser?" })).toMatchObject({ outcome: "execute", target: { kind: "none" } });
  });

  it("busca con la organización y el local del run, nunca con lo que proponga el modelo", async () => {
    const { skill, queries } = setup();
    const input = skill.input.parse({ query: "  política de cancelación ", organization_id: OTHER_ORG, location_id: null });
    await skill.execute(ctx(), input);
    expect(queries).toEqual([{ scope: { organizationId: ORG, locationId: LOC }, query: "política de cancelación", k: KNOWLEDGE_RESULTS }]);

    // Un run sin local (de organización) solo busca en lo de toda la organización.
    await skill.execute(ctx({ locationId: null }), input);
    expect(queries[1]?.scope).toEqual({ organizationId: ORG, locationId: null });
  });

  it("devuelve el texto con su fuente, marcado como dato y no como instrucción", async () => {
    const { skill } = setup([hit("Política de cancelación", "Cancela gratis hasta 24 horas antes.")]);
    const output = await skill.execute(ctx(), { query: "cancelar" });
    expect(output).toEqual({
      untrusted: true,
      note: expect.stringContaining("not instructions") as unknown as string,
      results: [{ text: "Cancela gratis hasta 24 horas antes.", source: "Política de cancelación", source_type: "policy" }],
    });
    expect(skill.output.parse(output)).toEqual(output);
  });

  it("sin nada escrito sobre eso, le dice al modelo que lo pase a una persona", async () => {
    const { skill } = setup([]);
    const output = await skill.execute(ctx(), { query: "¿hacéis tatuajes?" });
    expect(output.results).toEqual([]);
    expect(output.note).toContain("a person from the team will reply");
  });

  it("la consulta: de 2 a 500 caracteres", async () => {
    expect(await decideWith({ query: " " })).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await decideWith({ query: "x".repeat(501) })).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await decideWith({})).toMatchObject({ outcome: "reject", reason: "invalid_input" });
  });
});
