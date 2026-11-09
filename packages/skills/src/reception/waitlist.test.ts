import { decide } from "@repo/agent-core";
import type { RunScope, SkillContext, SkillDefinition } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { JOIN_WAITLIST_SKILL_KEY, WaitlistScopeError, createJoinWaitlistSkill } from "./waitlist.js";
import type { JoinWaitlistRequest, WaitlistStore } from "./waitlist.js";

const ORG = "a0000000-0000-4000-8000-000000000000";
const LOC = "a2000000-0000-4000-8000-000000000001";
const LASER = "c1000000-0000-4000-8000-000000000001";
const ANA = "c3000000-0000-4000-8000-000000000001";
const RUN = "d0000000-0000-4000-8000-000000000001";

function setup() {
  const calls: JoinWaitlistRequest[] = [];
  const store: WaitlistStore = {
    join(request) {
      calls.push(request);
      return Promise.resolve({
        entry: { id: "wl-1", serviceId: request.serviceId, wantedFrom: request.wantedFrom, wantedUntil: request.wantedUntil, status: "waiting" },
        alreadyWaiting: calls.length > 1,
      });
    },
  };
  return { calls, skill: createJoinWaitlistSkill({ store }) };
}

const scope: RunScope = { organizationId: ORG, locationId: LOC, runId: RUN, conversation: { id: "conv-1", contactId: ANA } };
const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  organizationId: ORG,
  locationId: LOC,
  runId: RUN,
  contactId: ANA,
  conversationId: "conv-1",
  target: { kind: "none" },
  idempotencyKey: `${RUN}:0:0:join_waitlist`,
  ...over,
});
const args = (over: Record<string, unknown> = {}) => ({ service_id: LASER, from: "2030-06-03T00:00:00+02:00", until: "2030-06-10T00:00:00+02:00", ...over });

async function decideWith(input: Record<string, unknown>, autonomy: "execute" | "draft" = "execute") {
  const { skill } = setup();
  return decide({
    proposal: { skillKey: JOIN_WAITLIST_SKILL_KEY, args: input },
    scope,
    skills: new Map([[JOIN_WAITLIST_SKILL_KEY, skill as unknown as SkillDefinition<unknown>]]),
    settings: new Map([[JOIN_WAITLIST_SKILL_KEY, { enabled: true, autonomy }]]),
  });
}

describe("apuntarse a la lista de espera con el motor de políticas", () => {
  it("sale sola (execute): apuntarse no compromete nada", async () => {
    expect(await decideWith(args())).toMatchObject({ outcome: "execute", autonomy: "execute", target: { kind: "none" } });
  });

  it("la franja tiene que tener sentido: hasta después de desde, y como mucho 62 días", async () => {
    expect(await decideWith(args({ until: "2030-06-03T00:00:00+02:00" }))).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await decideWith(args({ until: "2030-09-03T00:00:00+02:00" }))).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await decideWith(args({ from: "2030-06-03T00:00:00" }))).toMatchObject({ outcome: "reject", reason: "invalid_input" });
  });

  it("el LLM no puede elegir a quién, ni el local, ni la conversación", async () => {
    for (const extra of [{ contact_id: "otro" }, { location_id: LOC }, { conversation_id: "otra" }, { to: "2030-06-10T00:00:00+02:00" }]) {
      expect(await decideWith(args(extra))).toMatchObject({ outcome: "reject", reason: "reserved_field" });
    }
  });
});

describe("apuntarse a la lista de espera", () => {
  it("con el contacto, el local y la conversación del run, y la clave de la ejecución", async () => {
    const { calls, skill } = setup();
    const result = await skill.execute(ctx(), skill.input.parse(args()));
    expect(calls).toEqual([
      {
        locationId: LOC,
        contactId: ANA,
        conversationId: "conv-1",
        serviceId: LASER,
        wantedFrom: new Date("2030-06-03T00:00:00+02:00"),
        wantedUntil: new Date("2030-06-10T00:00:00+02:00"),
        idempotencyKey: `${RUN}:0:0:join_waitlist`,
      },
    ]);
    expect(result).toEqual({ entry_id: "wl-1", already_waiting: false, from: "2030-06-02T22:00:00.000Z", until: "2030-06-09T22:00:00.000Z" });
  });

  it("si ya estaba apuntado, lo dice", async () => {
    const { skill } = setup();
    await skill.execute(ctx(), skill.input.parse(args()));
    expect((await skill.execute(ctx({ idempotencyKey: "otra" }), skill.input.parse(args()))).already_waiting).toBe(true);
  });

  it("sin local o sin contacto no apunta a nadie", async () => {
    const { calls, skill } = setup();
    await expect(skill.execute(ctx({ locationId: null }), skill.input.parse(args()))).rejects.toThrow(WaitlistScopeError);
    await expect(skill.execute(ctx({ contactId: null }), skill.input.parse(args()))).rejects.toThrow(WaitlistScopeError);
    expect(calls).toEqual([]);
  });
});
