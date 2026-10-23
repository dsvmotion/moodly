import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "./database.types.js";
import { seedLocations, seedOrganizations } from "./seed/data.ts";
import { readLocalSupabase } from "./seed/local-supabase.ts";
import { TenantScopeError, createServiceDb } from "./service.ts";

// tenantDb contra Supabase local con el seed aplicado: lo que no se ve en el
// test unitario (que PostgREST aplica de verdad el filtro con la clave
// secreta, sin RLS). Las filas de prueba son regiones temporales que se borran
// al terminar; no se toca ningún dato del seed.
const local = readLocalSupabase();
const service = createServiceDb({ url: local.apiUrl, secretKey: local.secretKey });
// Cliente sin acotar, solo para preparar y comprobar desde fuera.
const admin = createClient<Database>(local.apiUrl, local.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function orgId(name: string): string {
  const org = seedOrganizations.find((candidate) => candidate.name === name);
  if (!org) throw new Error(`No hay organización ${name} en el seed`);
  return org.id;
}
const ORG_A = orgId("Demo A");
const ORG_B = orgId("Demo B");
const tenantA = service.forOrganization(ORG_A);
const marker = `tenantdb-${randomUUID()}`;
// Por id y no por nombre: si el filtro fallara, la región de B quedaría renombrada.
const created: string[] = [];

async function regionOfB(): Promise<string> {
  const { data, error } = await admin.from("regions").insert({ organization_id: ORG_B, name: `${marker}-b` }).select("id").single();
  if (error) throw new Error(error.message);
  created.push(data.id);
  return data.id;
}

async function regionName(id: string): Promise<string | null> {
  const { data, error } = await admin.from("regions").select("name").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.name ?? null;
}

afterAll(async () => {
  await admin.from("regions").delete().in("id", created);
  await admin.from("regions").delete().like("name", `${marker}%`);
});

describe("tenantDb con la clave secreta (sin RLS)", () => {
  it("lee solo los datos de su organización", async () => {
    const { data, error } = await tenantA.from("locations").select("id, organization_id");
    expect(error).toBeNull();
    const expected = seedLocations.filter((location) => location.organizationId === ORG_A).map((location) => location.id);
    expect(data?.map((row) => row.id).sort()).toEqual([...expected].sort());
    expect(data?.every((row) => row.organization_id === ORG_A)).toBe(true);
  });

  it("no actualiza ni borra una fila de otra organización aunque se pida por su id", async () => {
    const id = await regionOfB();

    const updated = await tenantA.from("regions").update({ name: "cambiada" }).eq("id", id).select("id");
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual([]);

    const deleted = await tenantA.from("regions").delete().eq("id", id).select("id");
    expect(deleted.error).toBeNull();
    expect(deleted.data).toEqual([]);

    expect(await regionName(id)).toBe(`${marker}-b`);
  });

  it("inserta con su organización y rechaza filas de otra antes de llegar a la base de datos", async () => {
    const { data, error } = await tenantA.from("regions").insert({ name: `${marker}-a` }).select("id, organization_id").single();
    expect(error).toBeNull();
    if (data) created.push(data.id);
    expect(data?.organization_id).toBe(ORG_A);

    expect(() => tenantA.from("regions").insert({ name: `${marker}-x`, organization_id: ORG_B })).toThrow(TenantScopeError);
    const { count } = await admin.from("regions").select("id", { count: "exact", head: true }).eq("name", `${marker}-x`);
    expect(count).toBe(0);
  });
});
