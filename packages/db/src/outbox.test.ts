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

  it("oldestPendingAt pide solo la hora de creación del pendiente más antiguo", async () => {
    reply = [{ created_at: "2026-11-11T10:00:00+00:00" }];
    expect(await box.oldestPendingAt()).toEqual(new Date("2026-11-11T10:00:00Z"));
    const { method, url } = only();
    expect(method).toBe("GET");
    expect(url.searchParams.get("select")).toBe("created_at");
    expect(url.searchParams.get("published_at")).toBe("is.null");
    expect(url.searchParams.get("order")).toBe("created_at.asc");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("oldestPendingAt devuelve null sin pendientes", async () => {
    reply = [];
    expect(await box.oldestPendingAt()).toBeNull();
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
  it("published pide solo metadatos de los ya publicados de un tipo desde una hora, en orden", async () => {
    reply = [{ id: EVENT, organization_id: ORG, type: "approval.decided", created_at: "2026-11-13T10:00:00.123456+00:00" }];
    const since = new Date("2026-11-12T10:00:00Z");
    expect(await box.published("approval.decided", since, null, 100)).toEqual([
      { id: EVENT, organizationId: ORG, type: "approval.decided", createdAt: "2026-11-13T10:00:00.123456+00:00" },
    ]);
    const { method, url } = only();
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/rest/v1/domain_events");
    expect(url.searchParams.get("select")).toBe("id,organization_id,type,created_at");
    expect(url.searchParams.get("type")).toBe("eq.approval.decided");
    expect(url.searchParams.get("published_at")).toBe("not.is.null");
    expect(url.searchParams.get("created_at")).toBe(`gte.${since.toISOString()}`);
    expect(url.searchParams.get("or")).toBeNull();
    expect(url.searchParams.get("order")).toBe("created_at.asc,id.asc");
    expect(url.searchParams.get("limit")).toBe("100");
  });

  it("published sigue después del cursor: más nuevo, o a la misma hora con un id mayor", async () => {
    const createdAt = "2026-11-13T10:00:00.123456+00:00";
    await box.published("approval.decided", new Date("2026-11-12T10:00:00Z"), { createdAt, id: EVENT }, 10);
    const { url } = only();
    expect(url.searchParams.get("or")).toBe(`(created_at.gt."${createdAt}",and(created_at.eq."${createdAt}",id.gt.${EVENT}))`);
  });

  it("published se niega con un lote, un tipo, una hora o un cursor que no valen, sin preguntar a la base de datos", async () => {
    const since = new Date("2026-11-12T10:00:00Z");
    for (const limit of [0, 501, 1.5]) await expect(box.published("approval.decided", since, null, limit)).rejects.toThrow(OutboxError);
    for (const type of ["", "approval", "approval.decided,id.gt.0", "Approval.decided"]) {
      await expect(box.published(type, since, null, 10)).rejects.toThrow(OutboxError);
    }
    await expect(box.published("approval.decided", new Date(Number.NaN), null, 10)).rejects.toThrow(OutboxError);
    await expect(box.published("approval.decided", since, { createdAt: "ayer", id: EVENT }, 10)).rejects.toThrow(OutboxError);
    await expect(box.published("approval.decided", since, { createdAt: "2026-11-13T10:00:00Z", id: "1) or (true" }, 10)).rejects.toThrow(OutboxError);
    await expect(box.published("approval.decided", since, { createdAt: '2026-11-13T10:00:00Z",id.gt.0', id: EVENT }, 10)).rejects.toThrow(OutboxError);
    expect(sent).toEqual([]);
  });
});
