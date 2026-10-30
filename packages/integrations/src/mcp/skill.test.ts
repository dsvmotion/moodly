import { decide } from "@repo/agent-core";
import type { RunScope, SkillContext, SkillDefinition } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import type { ReviewedMcpServer } from "./catalog.js";
import { createFakeMcpClient } from "./fake.js";
import { governMcpClient } from "./governed.js";
import { MCP_UNCLASSIFIED, importMcpTools } from "./import.js";
import { McpSkillError, mcpSkill } from "./skill.js";
import type { McpSkillRow } from "./skill.js";
import type { McpTool } from "./types.js";

const ORG = "a0000000-0000-4000-8000-000000000000";
const OTHER_ORG = "b0000000-0000-4000-8000-000000000000";
const SERVER: ReviewedMcpServer = {
  key: "crm-demo",
  name: "CRM de prueba",
  url: "https://mcp.example.com/mcp",
  version: "1.2.0",
  reviewedAt: "2026-10-30",
  tools: ["find_lead", "send_email"],
};
const findLead: McpTool = {
  name: "find_lead",
  description: "Busca un lead",
  inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
};
const sendEmail: McpTool = {
  name: "send_email",
  inputSchema: { type: "object", properties: { to: { type: "string" }, body: { type: "string" } } },
};

const client = createFakeMcpClient({ tools: [findLead, sendEmail] });
const connection = governMcpClient({ organizationId: ORG, server: SERVER, client });
const [draft, emailDraft] = importMcpTools(SERVER, [findLead, sendEmail]).drafts;
if (!draft || !emailDraft) throw new Error("fixture: faltan borradores");

/** La fila tal y como la deja la base de datos al importarla (sin clasificar). */
const unclassified: McpSkillRow = {
  key: draft.key,
  version: 1,
  name: draft.name,
  description: draft.description,
  effectClass: draft.effectClass,
  defaultAutonomy: draft.defaultAutonomy,
  mcpToolName: draft.mcpToolName,
  mcpToolHash: draft.mcpToolHash,
  inputSchema: draft.inputSchema,
};
const scope: RunScope = { organizationId: ORG, locationId: null, runId: "33333333-3333-4333-8333-333333333333", conversation: null };
const ctx: SkillContext = { organizationId: ORG, locationId: null, runId: scope.runId, target: { kind: "none" }, idempotencyKey: "k" };

function decideWith(row: McpSkillRow, args: Record<string, unknown>, autonomy: "suggest" | "draft" | "execute" | "autonomous") {
  const skill = mcpSkill(row, connection);
  return decide({
    proposal: { skillKey: skill.key, args },
    scope,
    skills: new Map([[skill.key, skill as unknown as SkillDefinition<unknown>]]),
    settings: new Map([[skill.key, { enabled: true, autonomy }]]),
  });
}

describe("mcpSkill", () => {
  it("sin clasificar es un external_message: con la autonomía que le deja la base de datos (draft), queda en borrador", async () => {
    expect(unclassified.effectClass).toBe(MCP_UNCLASSIFIED.effectClass);
    const skill = mcpSkill(unclassified, connection);
    const decision = await decide({
      proposal: { skillKey: skill.key, args: { query: "Ana" } },
      scope: { ...scope, conversation: { id: "c1", contactId: "p1" } },
      skills: new Map([[skill.key, skill as unknown as SkillDefinition<unknown>]]),
      settings: new Map([[skill.key, { enabled: true, autonomy: MCP_UNCLASSIFIED.maxAutonomy }]]),
    });
    expect(decision.outcome).toBe("draft");
  });

  it("y como external_message, sin conversación no tiene a quién ir", async () => {
    expect(await decideWith(unclassified, { query: "Ana" }, "draft")).toMatchObject({ outcome: "reject", reason: "no_conversation" });
  });

  it("clasificada como lectura, se ejecuta con la autonomía del agente y llama a la herramienta fijada", async () => {
    const decision = await decideWith({ ...unclassified, effectClass: "read", defaultAutonomy: "execute" }, { query: "Ana" }, "execute");
    expect(decision.outcome).toBe("execute");
    if (decision.outcome === "reject") return;
    const result = await decision.skill.execute(ctx, decision.input);
    expect(result).toMatchObject({ untrusted: true, source: "mcp:crm-demo@1.2.0/find_lead" });
  });

  it("rechaza argumentos que la herramienta no declara (objeto cerrado)", async () => {
    const decision = await decideWith({ ...unclassified, effectClass: "read" }, { query: "Ana", extra: "x" }, "execute");
    expect(decision).toMatchObject({ outcome: "reject", reason: "invalid_input" });
  });

  it("rechaza el tenant colado en los argumentos", async () => {
    const decision = await decideWith({ ...unclassified, effectClass: "read" }, { query: "Ana", organization_id: OTHER_ORG }, "execute");
    expect(decision).toMatchObject({ outcome: "reject", reason: "reserved_field" });
  });

  it("no convierte en skill una herramienta con el destinatario en la entrada", () => {
    expect(() =>
      mcpSkill({ ...unclassified, key: emailDraft.key, mcpToolName: emailDraft.mcpToolName, inputSchema: emailDraft.inputSchema }, connection),
    ).toThrow(/to: campo reservado/);
  });

  it("ni una clasificada como external_outreach (su audiencia no la calcula la plataforma)", () => {
    expect(() => mcpSkill({ ...unclassified, effectClass: "external_outreach" }, connection)).toThrow(McpSkillError);
  });

  it("la conexión de una organización nunca ejecuta para otra", async () => {
    const skill = mcpSkill({ ...unclassified, effectClass: "read" }, connection);
    await expect(skill.execute({ ...ctx, organizationId: OTHER_ORG }, { query: "Ana" })).rejects.toThrow(/otra organización/);
  });

  it("la vista previa dice qué herramienta, dónde y con qué", async () => {
    const skill = mcpSkill(unclassified, connection);
    expect((await skill.preview(ctx, { query: "Ana" })).summary).toBe('«find_lead» en CRM de prueba, con {"query":"Ana"}');
  });
});
