import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { ChannelAccountError, channelAccounts } from "./channel-accounts.ts";
import type { Database } from "./database.types.js";

// Como en outbox.test.ts: el cliente real de supabase-js y un fetch falso, para
// comprobar la petición exacta que llega a PostgREST.
interface Sent {
  method: string;
  url: URL;
}
let sent: Sent[] = [];
let reply: unknown = null;
let status = 200;

const client = createClient<Database>("http://127.0.0.1:54321", "test-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: async (input, init) => {
      sent.push({ method: init?.method ?? "GET", url: new URL(input instanceof Request ? input.url : String(input)) });
      return new Response(JSON.stringify(reply), { status, headers: { "content-type": "application/json" } });
    },
  },
});
const accounts = channelAccounts(client);

beforeEach(() => {
  sent = [];
  reply = null;
  status = 200;
});

describe("channelAccounts.resolve: la cuenta de un canal, y nada más (ADR 0052 §2)", () => {
  it("pide solo id, organización y estado, por coincidencia exacta de canal e id externo", async () => {
    reply = [{ id: "c-1", organization_id: "o-1", status: "active" }];
    await expect(accounts.resolve("whatsapp", "123456")).resolves.toEqual({ id: "c-1", organizationId: "o-1", status: "active" });
    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.method).toBe("GET");
    expect(request?.url.pathname).toBe("/rest/v1/channel_accounts");
    expect(request?.url.searchParams.get("select")).toBe("id,organization_id,status");
    expect(request?.url.searchParams.get("channel")).toBe("eq.whatsapp");
    expect(request?.url.searchParams.get("external_id")).toBe("eq.123456");
    // Ni filtros de rango ni de patrón: solo esas dos igualdades.
    expect([...(request?.url.searchParams.keys() ?? [])].sort()).toEqual(["channel", "external_id", "select"]);
  });

  it("una cuenta que no existe no se resuelve", async () => {
    reply = [];
    await expect(accounts.resolve("webchat", "no-existe")).resolves.toBeNull();
  });

  it("una cuenta desactivada se resuelve con su estado: quien la usa la rechaza", async () => {
    reply = [{ id: "c-2", organization_id: "o-2", status: "disabled" }];
    await expect(accounts.resolve("webchat", "w-2")).resolves.toMatchObject({ status: "disabled" });
  });

  it("no consulta con un canal o un id externo que no cuadran", async () => {
    await expect(accounts.resolve("Whats App", "1")).rejects.toThrow(ChannelAccountError);
    await expect(accounts.resolve("whatsapp", "")).rejects.toThrow(ChannelAccountError);
    await expect(accounts.resolve("whatsapp", "x".repeat(201))).rejects.toThrow(ChannelAccountError);
    expect(sent).toHaveLength(0);
  });

  it("un error de PostgREST es un error, nunca «no existe»", async () => {
    status = 500;
    reply = { code: "XX000", message: "boom" };
    await expect(accounts.resolve("whatsapp", "1")).rejects.toThrow(ChannelAccountError);
  });
});
