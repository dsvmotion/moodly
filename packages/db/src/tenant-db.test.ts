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

  it("no expone upsert ni rpc", () => {
    const query = db.from("locations");
    expect(Object.keys(query).sort()).toEqual(["delete", "insert", "select", "update"]);
    expect(Object.keys(db).sort()).toEqual(["from", "organizationId"]);
  });
});
