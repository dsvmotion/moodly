import { createFakeConnectorPlatform } from "@repo/integrations";
import { platformIntegration } from "@repo/integrations/platform";
import { describe, expect, it } from "vitest";
import { connectFlow, disconnectFlow, type IntegrationRow, type IntegrationStore } from "./flows";

const found = platformIntegration("google-calendar");
if (!found) throw new Error("google-calendar no está en el catálogo");
const ENTRY = found;
const TAGS = { organizationId: "org-a", userId: "user-a" };

/** Una fila en memoria que se comporta como la tabla (incluida la condición de markDisconnected). */
function memoryStore(initial: IntegrationRow | null, hooks: { beforeMarkDisconnected?: (row: IntegrationRow) => void } = {}) {
  let row = initial ? { ...initial } : null;
  const store: IntegrationStore & { row: () => IntegrationRow | null } = {
    row: () => row,
    async find() {
      return row ? { ...row } : null;
    },
    async insertPending() {
      row = { id: "int-new", status: "pending", externalConnectionId: null };
      return row.id;
    },
    async setPending(id) {
      if (!row || row.id !== id) return false;
      row = { ...row, status: "pending" };
      return true;
    },
    async markDisconnected(id, expected) {
      if (row) hooks.beforeMarkDisconnected?.(row);
      if (!row || row.id !== id || row.externalConnectionId !== expected) return false;
      row = { ...row, status: "disconnected", externalConnectionId: null };
      return true;
    },
  };
  return store;
}

describe("disconnectFlow", () => {
  it("borra la conexión en Nango y pasa la fila a desconectada", async () => {
    const platform = createFakeConnectorPlatform();
    const store = memoryStore({ id: "int-1", status: "active", externalConnectionId: "conn-a" });
    await expect(disconnectFlow(store, platform, ENTRY)).resolves.toMatchObject({ ok: true, deleted: ["conn-a"] });
    expect(store.row()).toEqual({ id: "int-1", status: "disconnected", externalConnectionId: null });
  });

  it("carrera: si el webhook trae otra conexión entre la lectura y el cambio, también la borra en Nango", async () => {
    const platform = createFakeConnectorPlatform();
    let raced = false;
    const store = memoryStore(
      { id: "int-1", status: "active", externalConnectionId: "conn-a" },
      {
        // El worker activa la conexión B justo después de que se borre A en Nango.
        beforeMarkDisconnected: (row) => {
          if (!raced) {
            raced = true;
            row.externalConnectionId = "conn-b";
            row.status = "active";
          }
        },
      },
    );
    const outcome = await disconnectFlow(store, platform, ENTRY);
    expect(outcome).toMatchObject({ ok: true, deleted: ["conn-a", "conn-b"] });
    expect(platform.deleted.map((d) => d.connectionId)).toEqual(["conn-a", "conn-b"]);
    expect(store.row()).toEqual({ id: "int-1", status: "disconnected", externalConnectionId: null });
  });

  it("si Nango falla, la fila no cambia", async () => {
    const platform = createFakeConnectorPlatform();
    platform.failNext("deleteConnection");
    const store = memoryStore({ id: "int-1", status: "active", externalConnectionId: "conn-a" });
    await expect(disconnectFlow(store, platform, ENTRY)).resolves.toMatchObject({ ok: false, error: "platform_failed" });
    expect(store.row()).toEqual({ id: "int-1", status: "active", externalConnectionId: "conn-a" });
  });

  it("una pendiente sin conexión se desconecta sin llamar a Nango", async () => {
    const platform = createFakeConnectorPlatform();
    const store = memoryStore({ id: "int-1", status: "pending", externalConnectionId: null });
    await expect(disconnectFlow(store, platform, ENTRY)).resolves.toMatchObject({ ok: true, deleted: [] });
    expect(platform.deleted).toEqual([]);
    expect(store.row()?.status).toBe("disconnected");
  });

  it("sin fila (otra organización o sin permiso), no hace nada", async () => {
    const platform = createFakeConnectorPlatform();
    await expect(disconnectFlow(memoryStore(null), platform, ENTRY)).resolves.toMatchObject({ ok: false, error: "not_allowed" });
    expect(platform.deleted).toEqual([]);
  });
});

describe("connectFlow: nunca deja una pendiente sin salida", () => {
  it("una nueva: la crea pendiente y pide la sesión con nuestras etiquetas", async () => {
    const platform = createFakeConnectorPlatform();
    const store = memoryStore(null);
    const outcome = await connectFlow(store, platform, ENTRY, TAGS);
    expect(outcome).toMatchObject({ ok: true, integrationId: "int-new" });
    expect(platform.sessions).toEqual([
      { integrationKey: "google-calendar", tags: { organization_id: "org-a", end_user_id: "user-a", integration_id: "int-new" } },
    ]);
    expect(store.row()?.status).toBe("pending");
  });

  it("Outlook: la sesión pide los permisos mínimos del catálogo (leer el calendario y refrescar)", async () => {
    const outlook = platformIntegration("outlook-calendar");
    if (!outlook) throw new Error("outlook-calendar no está en el catálogo");
    const platform = createFakeConnectorPlatform();
    await connectFlow(memoryStore(null), platform, outlook, TAGS);
    expect(platform.sessions).toEqual([
      {
        integrationKey: "outlook",
        tags: { organization_id: "org-a", end_user_id: "user-a", integration_id: "int-new" },
        scopes: ["offline_access", "Calendars.Read"],
      },
    ]);
  });

  it("una nueva: si Nango falla, vuelve a desconectada", async () => {
    const platform = createFakeConnectorPlatform();
    platform.failNext("createConnectSession");
    const store = memoryStore(null);
    await expect(connectFlow(store, platform, ENTRY, TAGS)).resolves.toMatchObject({ ok: false, error: "platform_failed" });
    expect(store.row()).toEqual({ id: "int-new", status: "disconnected", externalConnectionId: null });
  });

  it("reconectar: si Nango falla, la fila se queda como estaba (activa)", async () => {
    const platform = createFakeConnectorPlatform();
    platform.failNext("createConnectSession");
    const store = memoryStore({ id: "int-1", status: "active", externalConnectionId: "conn-a" });
    await expect(connectFlow(store, platform, ENTRY, TAGS)).resolves.toMatchObject({ ok: false, error: "platform_failed" });
    expect(store.row()).toEqual({ id: "int-1", status: "active", externalConnectionId: "conn-a" });
  });

  it("reconectar: con la sesión creada, pasa a pendiente", async () => {
    const platform = createFakeConnectorPlatform();
    const store = memoryStore({ id: "int-1", status: "error", externalConnectionId: null });
    await expect(connectFlow(store, platform, ENTRY, TAGS)).resolves.toMatchObject({ ok: true });
    expect(store.row()?.status).toBe("pending");
  });
});
