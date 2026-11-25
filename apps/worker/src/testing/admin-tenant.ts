import type pg from "pg";
import type { TenantDb } from "@repo/db/service";

/**
 * Un TenantDb sobre el cliente de administración (postgres, sin RLS), para los
 * tests que comprueban que el SQL del worker lleva la organización explícita
 * (control 3.2): sin RLS, lo único que separa las organizaciones es su filtro.
 * Fija moodly.organization_id en la transacción como el worker, para las
 * funciones que la leen. Solo tiene lo que usan esas consultas: organizationId
 * y transaction.
 */
export function adminTenant(admin: pg.Client, organizationId: string): TenantDb {
  return {
    organizationId,
    transaction: async <T>(fn: (sql: { query: <R>(text: string, params?: readonly unknown[]) => Promise<R[]> }) => Promise<T>): Promise<T> => {
      await admin.query("begin");
      try {
        await admin.query("select set_config('moodly.organization_id', $1, true)", [organizationId]);
        const result = await fn({ query: async <R>(text: string, params?: readonly unknown[]) => (await admin.query(text, params as unknown[])).rows as R[] });
        await admin.query("commit");
        return result;
      } catch (error) {
        await admin.query("rollback");
        throw error;
      }
    },
  } as unknown as TenantDb;
}
