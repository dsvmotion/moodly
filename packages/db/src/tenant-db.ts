// Acceso de la plataforma (worker) a los datos de una organización (MANUAL
// §4.4; revisión de seguridad del 2026-10-20, 3.2). Con la clave secreta no
// hay RLS: este envoltorio es lo único que separa a un tenant de otro.
//
// - Solo admite tablas de tenant: las que tienen organization_id obligatorio.
//   Las demás (organizations, users, catálogos con organization_id nulo...)
//   necesitan una función propia, con nombre y revisada, no este acceso. Si
//   alguien se salta el tipo (JS o un cast), PostgREST rechaza el filtro en una
//   tabla sin organization_id, y en una con organization_id nulo solo devuelve
//   las filas de la organización.
// - Añade organization_id = <la organización> a toda lectura, actualización y
//   borrado. PostgREST combina los filtros con AND: nada de lo que se encadene
//   después puede ampliarlo.
// - Al insertar pone la organización y rechaza una fila de otra; una
//   actualización no puede tocar organization_id.
// - Sin recursos embebidos en select ("tabla(...)"): se resuelven por clave
//   externa sin este filtro. Sin upsert ni rpc: con la clave secreta, un upsert
//   por id pisaría la fila de otra organización, y una función no recibe el
//   filtro. Las excepciones son searchKnowledge, findBookingSlots,
//   agentTurnContext y approvalNotification: funciones con nombre a las que
//   tenantDb les pasa la organización.
import type { PostgrestQueryBuilder, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";
import { WorkerSqlError, type TenantSql, type WorkerSql } from "./worker-sql.ts";

type PublicSchema = Database["public"];
type PublicTables = PublicSchema["Tables"];
type ClientOptions =
  SupabaseClient<Database> extends SupabaseClient<Database, "public", "public", PublicSchema, infer Options> ? Options : never;
/** El constructor de consultas que daría el cliente tipado para una tabla concreta. */
type QueryBuilder<T extends TenantTable> = PostgrestQueryBuilder<ClientOptions, PublicSchema, PublicTables[T], T>;

/** Tablas con organization_id obligatorio: las únicas que admite tenantDb. */
export type TenantTable = {
  [K in keyof PublicTables]: PublicTables[K]["Row"] extends { organization_id: string } ? K : never;
}[keyof PublicTables];

/** Una fila nueva: organization_id lo pone tenantDb (si viene, debe ser la misma). */
export type TenantInsert<T extends TenantTable> = Omit<PublicTables[T]["Insert"], "organization_id"> & {
  organization_id?: string;
};
export type TenantUpdate<T extends TenantTable> = Omit<PublicTables[T]["Update"], "organization_id">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantScopeError extends Error {
  override readonly name = "TenantScopeError";
}

function assertColumns(columns: string | undefined): void {
  if (columns?.includes("(")) {
    throw new TenantScopeError("tenantDb: select no admite recursos embebidos; haz otra consulta acotada");
  }
}

export function tenantDb(client: SupabaseClient<Database>, organizationId: string, workerSql?: WorkerSql) {
  if (!UUID.test(organizationId)) {
    throw new TenantScopeError("tenantDb: organization_id no es un UUID");
  }

  // Por dentro, el cliente sin tipos: con la tabla genérica, los tipos de
  // supabase-js agotan al compilador. Hacia fuera, TenantQuery<T> da a quien
  // llama los tipos de su tabla concreta, como el cliente tipado.
  const untyped = client as unknown as SupabaseClient;

  function from<T extends TenantTable>(table: T): TenantQuery<T> {
    const query = untyped.from(table);

    const select = (columns?: string, options?: { head?: boolean; count?: "exact" | "planned" | "estimated" }) => {
      assertColumns(columns);
      return query.select(columns, options).eq("organization_id", organizationId);
    };

    return {
      select: select as unknown as TenantQuery<T>["select"],

      insert(rows) {
        const withOrganization = (Array.isArray(rows) ? rows : [rows]).map((row) => {
          if (row.organization_id !== undefined && row.organization_id !== organizationId) {
            throw new TenantScopeError("tenantDb: la fila es de otra organización");
          }
          return { ...row, organization_id: organizationId };
        });
        return query.insert(withOrganization) as unknown as TenantMutation<T, "insert">;
      },

      update(values) {
        if ("organization_id" in values) {
          throw new TenantScopeError("tenantDb: organization_id no se actualiza");
        }
        return query.update(values as Record<string, unknown>).eq("organization_id", organizationId) as unknown as TenantMutation<T, "update">;
      },

      delete() {
        return query.delete().eq("organization_id", organizationId) as unknown as TenantMutation<T, "delete">;
      },
    };
  }

  /**
   * La búsqueda de conocimiento (ADR 0025 §1, ADR 0037): search_knowledge con
   * la organización de este acceso, que no se puede cambiar desde fuera. Es la
   * única función que admite tenantDb, con nombre y revisada.
   */
  async function searchKnowledge(params: KnowledgeSearchParams): Promise<KnowledgeSearchRow[]> {
    if (params.locationId !== null && !UUID.test(params.locationId)) {
      throw new TenantScopeError("tenantDb: location_id no es un UUID");
    }
    if (!params.queryEmbedding.every(Number.isFinite)) {
      throw new TenantScopeError("tenantDb: el embedding de la consulta tiene valores no finitos");
    }
    const { data, error } = await untyped.rpc("search_knowledge", {
      p_organization_id: organizationId,
      p_location_id: params.locationId,
      p_embedding_model: params.embeddingModel,
      p_query_embedding: `[${params.queryEmbedding.join(",")}]`,
      p_query: params.query,
      p_k: params.k,
    });
    if (error) throw new Error(`search_knowledge: ${error.message}`);
    return (data ?? []) as KnowledgeSearchRow[];
  }

  /**
   * Los huecos libres de un servicio en un local (find_booking_slots, paso
   * 4b), con la organización de este acceso. Como searchKnowledge: una
   * función con nombre y revisada, nunca rpc genérico.
   */
  async function findBookingSlots(params: BookingSlotsParams): Promise<BookingSlotRow[]> {
    if (!UUID.test(params.locationId) || !UUID.test(params.serviceId)) {
      throw new TenantScopeError("tenantDb: location_id y service_id tienen que ser UUID");
    }
    const { data, error } = await untyped.rpc("find_booking_slots", {
      p_organization_id: organizationId,
      p_location_id: params.locationId,
      p_service_id: params.serviceId,
      p_from: params.from.toISOString(),
      p_to: params.to.toISOString(),
      p_limit: params.limit,
    });
    if (error) throw new Error(`find_booking_slots: ${error.message}`);
    return (data ?? []) as BookingSlotRow[];
  }

  /**
   * Lo que necesita el turno de un agente (agent_turn_context, paso 4d-2): el
   * agente, su tipo, sus skills con lo que tiene configurado y el nombre de la
   * organización. Con la organización de este acceso: un agente de otra no
   * existe (null). Como findBookingSlots: con nombre y revisada.
   */
  async function agentTurnContext(agentId: string): Promise<AgentTurnContext | null> {
    if (!UUID.test(agentId)) {
      throw new TenantScopeError("tenantDb: agent_id no es un UUID");
    }
    const { data, error } = await untyped.rpc("agent_turn_context", { p_organization_id: organizationId, p_agent_id: agentId });
    if (error) throw new Error(`agent_turn_context: ${error.message}`);
    return (data ?? null) as AgentTurnContext | null;
  }

  /**
   * Lo que necesita el aviso de una aprobación nueva (approval_notification,
   * M-02): la aprobación, su agente y su local, y a quién se le envía (quien
   * puede decidirla, con la regla de can_decide_approval). Con la organización
   * de este acceso: una aprobación de otra no existe (null).
   */
  async function approvalNotification(approvalId: string): Promise<ApprovalNotification | null> {
    if (!UUID.test(approvalId)) {
      throw new TenantScopeError("tenantDb: approval_id no es un UUID");
    }
    const { data, error } = await untyped.rpc("approval_notification", { p_organization_id: organizationId, p_approval_id: approvalId });
    if (error) throw new Error(`approval_notification: ${error.message}`);
    return (data ?? null) as ApprovalNotification | null;
  }

  /**
   * Una transacción SQL bajo RLS con el rol moodly_worker y esta organización
   * fijada (ADR 0049, PL-T1). Lo que se lea o escriba dentro solo puede ser de
   * esta organización, aunque la consulta se equivoque de filtro. Solo existe si
   * el worker tiene WORKER_DATABASE_URL; mientras tanto, from() sigue igual.
   */
  async function transaction<T>(fn: (sql: TenantSql) => Promise<T>): Promise<T> {
    if (!workerSql) throw new WorkerSqlError("tenantDb: sin WORKER_DATABASE_URL no hay transacciones bajo RLS");
    return workerSql.inOrganization(organizationId, fn);
  }

  return { organizationId, from, searchKnowledge, findBookingSlots, agentTurnContext, approvalNotification, transaction };
}

/** Tal como lo devuelve approval_notification; quien lo usa lo valida antes de fiarse. */
export interface ApprovalNotification {
  approval: { id: string; status: string; reason: string | null; created_at: string; expires_at: string; location_id: string | null };
  agent: { display_name: string | null; type_key: string; type_name: string };
  organization: { default_locale: string };
  location: { name: string; timezone: string } | null;
  /** Quien puede decidirla: de la base de datos, nunca del evento ni del modelo. */
  recipients: { user_id: string; email: string; locale: string }[];
}

/** Tal como lo devuelve agent_turn_context; quien lo usa lo valida antes de fiarse. */
export interface AgentTurnContext {
  agent: { id: string; status: string; display_name: string | null; type_key: string; type_name: string };
  organization: { name: string; default_locale: string };
  skills: { key: string; version: number; kind: string; effect_class: string; enabled: boolean; autonomy_level: string }[];
}

export interface BookingSlotsParams {
  locationId: string;
  serviceId: string;
  from: Date;
  to: Date;
  limit: number;
}

export type BookingSlotRow = Database["public"]["Functions"]["find_booking_slots"]["Returns"][number];

export interface KnowledgeSearchParams {
  /** null = un run de organización: solo lo de toda la organización. */
  locationId: string | null;
  embeddingModel: string;
  queryEmbedding: readonly number[];
  query: string;
  k: number;
}

export type KnowledgeSearchRow = Database["public"]["Functions"]["search_knowledge"]["Returns"][number];

type TenantMutation<T extends TenantTable, Method extends "insert" | "update" | "delete"> = ReturnType<QueryBuilder<T>[Method]>;

/** Consultas sobre una tabla de tenant, ya acotadas a la organización. */
export interface TenantQuery<T extends TenantTable> {
  select: QueryBuilder<T>["select"];
  insert(rows: TenantInsert<T> | TenantInsert<T>[]): TenantMutation<T, "insert">;
  update(values: TenantUpdate<T>): TenantMutation<T, "update">;
  delete(): TenantMutation<T, "delete">;
}

export type TenantDb = ReturnType<typeof tenantDb>;
