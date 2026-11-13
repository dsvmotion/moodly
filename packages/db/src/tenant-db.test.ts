import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./database.types.js";
import { TenantScopeError, tenantDb } from "./tenant-db.ts";

// Con el cliente real de supabase-js y un fetch falso: se comprueba la
// petición que llega a PostgREST, no una imitación del cliente.
const ORG = "5eed0000-0000-4000-8000-00000000000a";
const OTHER = "5eed0000-0000-4000-8000-00000000000b";

interface Sent {
  method: string;
  url: URL;
  body: unknown;
}
let sent: Sent[] = [];

const client = createClient<Database>("http://127.0.0.1:54321", "test-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: async (input, init) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ method: init?.method ?? "GET", url: new URL(input instanceof Request ? input.url : String(input)), body });
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    },
  },
});
const db = tenantDb(client, ORG);

function only(): Sent {
  expect(sent).toHaveLength(1);
  const [request] = sent;
  if (!request) throw new Error("sin petición");
  return request;
}

beforeEach(() => {
  sent = [];
});

describe("tenantDb: toda consulta queda acotada a la organización", () => {
  it("select añade organization_id y lo que se encadena después no lo amplía", async () => {
    await db.from("locations").select("id, name").eq("id", OTHER).or(`organization_id.eq.${OTHER}`);
    const { method, url } = only();
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/rest/v1/locations");
    expect(url.searchParams.getAll("organization_id")).toEqual([`eq.${ORG}`]);
    // PostgREST combina con AND cada parámetro: el or() no quita el filtro.
    expect(url.searchParams.get("or")).toBe(`(organization_id.eq.${OTHER})`);
  });

  it("update añade el filtro y no puede cambiar organization_id", async () => {
    await db.from("locations").update({ name: "Nuevo" }).eq("id", OTHER);
    const { method, url, body } = only();
    expect(method).toBe("PATCH");
    expect(url.searchParams.getAll("organization_id")).toEqual([`eq.${ORG}`]);
    expect(body).toEqual({ name: "Nuevo" });

    sent = [];
    // Desde código sin tipos (o con un cast), la guarda sigue en tiempo de ejecución.
    const move = { name: "x", organization_id: OTHER } as unknown as { name: string };
    expect(() => db.from("locations").update(move)).toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });

  it("delete añade el filtro", async () => {
    await db.from("regions").delete().eq("id", OTHER);
    const { method, url } = only();
    expect(method).toBe("DELETE");
    expect(url.searchParams.getAll("organization_id")).toEqual([`eq.${ORG}`]);
  });

  it("insert pone la organización en cada fila y rechaza filas de otra", async () => {
    const explicitUndefined = { name: "Centro", organization_id: undefined } as unknown as { name: string };
    await db.from("regions").insert([{ name: "Sur" }, { name: "Este", organization_id: ORG }, explicitUndefined]);
    const { method, body } = only();
    expect(method).toBe("POST");
    expect(body).toEqual([
      { name: "Sur", organization_id: ORG },
      { name: "Este", organization_id: ORG },
      { name: "Centro", organization_id: ORG },
    ]);

    sent = [];
    expect(() => db.from("regions").insert([{ name: "Sur" }, { name: "Norte", organization_id: OTHER }])).toThrow(TenantScopeError);
    const noOrg = { name: "Oeste", organization_id: null } as unknown as { name: string };
    expect(() => db.from("regions").insert(noOrg)).toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });

  it("select no admite recursos embebidos (se resolverían sin el filtro)", () => {
    expect(() => db.from("locations").select("id, regions(name)")).toThrow(TenantScopeError);
    expect(() => db.from("memberships").select("*, users!inner(email)")).toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });

  it("organization_id tiene que ser un UUID: nada de vacíos ni filtros colados", () => {
    for (const bad of ["", "abc", `${ORG},organization_id.neq.x`, `${ORG} `, "*"]) {
      expect(() => tenantDb(client, bad)).toThrow(TenantScopeError);
    }
  });

  it("no expone upsert ni rpc: solo funciones con nombre y acotadas (searchKnowledge, findBookingSlots, agentTurnContext, approvalNotification, handoffNotification, usageSpend, checkBudgetThresholds, budgetNotification) y la transacción bajo RLS", () => {
    const query = db.from("locations");
    expect(Object.keys(query).sort()).toEqual(["delete", "insert", "select", "update"]);
    expect(Object.keys(db).sort()).toEqual([
      "agentTurnContext",
      "approvalNotification",
      "budgetNotification",
      "checkBudgetThresholds",
      "findBookingSlots",
      "from",
      "handoffNotification",
      "organizationId",
      "searchKnowledge",
      "transaction",
      "usageSpend",
    ]);
  });

  it("sin WORKER_DATABASE_URL no hay transacciones bajo RLS (no cae al acceso sin RLS)", async () => {
    await expect(db.transaction(async () => "nunca")).rejects.toThrow(/WORKER_DATABASE_URL/);
  });
});

describe("tenantDb.searchKnowledge (ADR 0037)", () => {
  const LOCATION = "5eed0000-0000-4000-8000-0000000000c1";
  const params = { locationId: LOCATION, embeddingModel: "fake-hash-3", queryEmbedding: [0.5, -0.25, 1e-7], query: "horarios", k: 5 };

  it("llama a search_knowledge con la organización de este acceso", async () => {
    await db.searchKnowledge(params);
    const { method, url, body } = only();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/search_knowledge");
    expect(body).toEqual({
      p_organization_id: ORG,
      p_location_id: LOCATION,
      p_embedding_model: "fake-hash-3",
      p_query_embedding: "[0.5,-0.25,1e-7]",
      p_query: "horarios",
      p_k: 5,
    });
  });

  it("la organización no se cambia desde fuera, ni con un cast", async () => {
    await db.searchKnowledge({ ...params, p_organization_id: OTHER, organizationId: OTHER } as unknown as typeof params);
    expect((only().body as Record<string, unknown>).p_organization_id).toBe(ORG);
  });

  it("un run de organización busca sin local", async () => {
    await db.searchKnowledge({ ...params, locationId: null });
    expect((only().body as Record<string, unknown>).p_location_id).toBeNull();
  });

  it("rechaza un local que no es un UUID y un embedding con valores no finitos, sin llamar", async () => {
    await expect(db.searchKnowledge({ ...params, locationId: `${LOCATION},x` })).rejects.toThrow(TenantScopeError);
    await expect(db.searchKnowledge({ ...params, queryEmbedding: [1, Number.POSITIVE_INFINITY] })).rejects.toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });
});

describe("tenantDb.findBookingSlots (paso 4b)", () => {
  const LOCATION = "5eed0000-0000-4000-8000-0000000000c1";
  const SERVICE = "5eed0000-0000-4000-8000-0000000000d1";
  const params = {
    locationId: LOCATION,
    serviceId: SERVICE,
    from: new Date("2030-06-03T07:00:00Z"),
    to: new Date("2030-06-04T07:00:00Z"),
    limit: 10,
  };

  it("llama a find_booking_slots con la organización de este acceso", async () => {
    await db.findBookingSlots(params);
    const { method, url, body } = only();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/find_booking_slots");
    expect(body).toEqual({
      p_organization_id: ORG,
      p_location_id: LOCATION,
      p_service_id: SERVICE,
      p_from: "2030-06-03T07:00:00.000Z",
      p_to: "2030-06-04T07:00:00.000Z",
      p_limit: 10,
    });
  });

  it("la organización no se cambia desde fuera, ni con un cast", async () => {
    await db.findBookingSlots({ ...params, p_organization_id: OTHER } as unknown as typeof params);
    expect((only().body as Record<string, unknown>).p_organization_id).toBe(ORG);
  });

  it("rechaza un local o un servicio que no son UUID, sin llamar", async () => {
    await expect(db.findBookingSlots({ ...params, locationId: "centro" })).rejects.toThrow(TenantScopeError);
    await expect(db.findBookingSlots({ ...params, serviceId: `${SERVICE},x` })).rejects.toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });
});

describe("tenantDb.agentTurnContext (paso 4d-2)", () => {
  const AGENT = "5eed0000-0000-4000-8000-0000000000e1";

  it("llama a agent_turn_context con la organización de este acceso", async () => {
    await db.agentTurnContext(AGENT);
    const { method, url, body } = only();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/agent_turn_context");
    expect(body).toEqual({ p_organization_id: ORG, p_agent_id: AGENT });
  });

  it("rechaza un agente que no es un UUID, sin llamar", async () => {
    await expect(db.agentTurnContext(`${AGENT},x`)).rejects.toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });
});

describe("tenantDb.approvalNotification (M-02)", () => {
  const APPROVAL = "5eed0000-0000-4000-8000-0000000000a1";

  it("llama a approval_notification con la organización de este acceso", async () => {
    await db.approvalNotification(APPROVAL);
    const { method, url, body } = only();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/approval_notification");
    expect(body).toEqual({ p_organization_id: ORG, p_approval_id: APPROVAL });
  });

  it("rechaza una aprobación que no es un UUID, sin llamar", async () => {
    await expect(db.approvalNotification(`${APPROVAL},x`)).rejects.toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });
});

describe("tenantDb.handoffNotification (CU3)", () => {
  const CONVERSATION = "5eed000b-0000-4000-8000-0000000000b2";

  it("llama a handoff_notification con la organización de este acceso", async () => {
    await db.handoffNotification(CONVERSATION);
    const { method, url, body } = only();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/handoff_notification");
    expect(body).toEqual({ p_organization_id: ORG, p_conversation_id: CONVERSATION });
  });

  it("rechaza una conversación que no es un UUID, sin llamar", async () => {
    await expect(db.handoffNotification(`${CONVERSATION},x`)).rejects.toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });
});

describe("tenantDb.usageSpend (PL-ledger)", () => {
  it("llama a usage_spend con la organización de este acceso y los comienzos del día y del mes", async () => {
    await db.usageSpend({ dayStart: new Date("2026-11-12T00:00:00Z"), monthStart: new Date("2026-11-01T00:00:00Z") });
    const { method, url, body } = only();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/usage_spend");
    expect(body).toEqual({ p_organization_id: ORG, p_day_start: "2026-11-12T00:00:00.000Z", p_month_start: "2026-11-01T00:00:00.000Z" });
  });

  it("rechaza una fecha que no lo es, sin llamar", async () => {
    await expect(db.usageSpend({ dayStart: new Date("x"), monthStart: new Date() })).rejects.toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });
});

describe("tenantDb: los avisos del tope mensual (PL-ledger)", () => {
  it("checkBudgetThresholds llama a check_budget_thresholds con la organización de este acceso", async () => {
    await db.checkBudgetThresholds();
    const { method, url, body } = only();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/check_budget_thresholds");
    expect(body).toEqual({ p_organization_id: ORG });
  });

  it("budgetNotification llama a budget_notification con la organización de este acceso, el mes y el umbral", async () => {
    await db.budgetNotification("2026-11-01", 80);
    const { url, body } = only();
    expect(url.pathname).toBe("/rest/v1/rpc/budget_notification");
    expect(body).toEqual({ p_organization_id: ORG, p_month: "2026-11-01", p_threshold: 80 });
  });

  it("rechaza un mes que no es el primer día o un umbral que no es 80 ni 100, sin llamar", async () => {
    for (const month of ["2026-11-02", "2026-11", "x,2026-11-01"]) await expect(db.budgetNotification(month, 80)).rejects.toThrow(TenantScopeError);
    for (const threshold of [0, 50, 101, Number.NaN]) await expect(db.budgetNotification("2026-11-01", threshold)).rejects.toThrow(TenantScopeError);
    expect(sent).toEqual([]);
  });
});
