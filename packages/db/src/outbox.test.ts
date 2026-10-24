import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./database.types.js";
import { OutboxError, outbox } from "./outbox.ts";

// Como en tenant-db.test.ts: el cliente real de supabase-js y un fetch falso,
// para comprobar la petición que llega a PostgREST.
const EVENT = "5eed0000-0000-4000-8000-0000000000e1";
const ORG = "5eed0000-0000-4000-8000-00000000000a";

interface Sent {
  method: string;
  url: URL;
  body: unknown;
}
let sent: Sent[] = [];
let reply: unknown = [];

const client = createClient<Database>("http://127.0.0.1:54321", "test-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: async (input, init) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ method: init?.method ?? "GET", url: new URL(input instanceof Request ? input.url : String(input)), body });
      return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
    },
  },
});
const box = outbox(client);

function only(): Sent {
  expect(sent).toHaveLength(1);
  const [request] = sent;
  if (!request) throw new Error("sin petición");
  return request;
}

beforeEach(() => {
  sent = [];
  reply = [];
});

describe("outbox: lo único que el publicador ve entre organizaciones", () => {
  it("pending pide solo id, organización y tipo de los pendientes, en orden", async () => {
    reply = [{ id: EVENT, organization_id: ORG, type: "invitation.created" }];
    expect(await box.pending(50)).toEqual([{ id: EVENT, organizationId: ORG, type: "invitation.created" }]);
    const { method, url } = only();
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/rest/v1/domain_events");
    // Nada del contenido: ni el payload ni el local.
    expect(url.searchParams.get("select")).toBe("id,organization_id,type");
    expect(url.searchParams.get("published_at")).toBe("is.null");
    expect(url.searchParams.get("order")).toBe("created_at.asc,id.asc");
    expect(url.searchParams.get("limit")).toBe("50");
  });

  it("pending rechaza un lote fuera de 1–500 sin preguntar a la base de datos", async () => {
    for (const limit of [0, -1, 501, 1.5, Number.NaN]) {
      await expect(box.pending(limit)).rejects.toThrow(OutboxError);
    }
    expect(sent).toEqual([]);
  });

  it("markPublished solo toca published_at de esos ids y solo si siguen pendientes", async () => {
    reply = [{ id: EVENT }];
    expect(await box.markPublished([EVENT])).toBe(1);
    const { method, url, body } = only();
    expect(method).toBe("PATCH");
    expect(Object.keys(body as object)).toEqual(["published_at"]);
    expect(url.searchParams.get("id")).toBe(`in.(${EVENT})`);
    expect(url.searchParams.get("published_at")).toBe("is.null");
  });

  it("markPublished sin ids no hace nada, y con un id que no es un UUID se niega", async () => {
    expect(await box.markPublished([])).toBe(0);
    await expect(box.markPublished([EVENT, "1) or (true"])).rejects.toThrow(OutboxError);
    expect(sent).toEqual([]);
  });
});
