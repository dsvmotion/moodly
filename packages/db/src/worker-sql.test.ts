import { describe, expect, it } from "vitest";
import { WorkerSqlError, assertAllowedStatement, verifyRole } from "./worker-sql.ts";

// Lo que una consulta de quien llama puede ser dentro de inOrganization (ADR
// 0049): solo consultas; nada que cambie la organización, el rol o la
// transacción. La prueba contra Postgres está en worker-sql.integration.ts.
describe("assertAllowedStatement", () => {
  it("deja pasar las consultas", () => {
    for (const ok of [
      "select 1",
      "  SELECT id from public.conversations where id = $1",
      "-- comentario\nselect 1",
      "/* x */ (select 1)",
      "with x as (select 1) select * from x",
      "insert into public.messages (content) values ($1)",
      "update public.conversations set mode = $1 where id = $2",
      "delete from public.regions where id = $1",
      "select current_setting('moodly.organization_id', true)",
    ]) {
      expect(() => assertAllowedStatement(ok), ok).not.toThrow();
    }
  });

  it("rechaza SET, RESET, DISCARD, DO, CALL y el control de la transacción, también con comentarios delante", () => {
    for (const bad of [
      "set local role service_role",
      `set local "moodly"."organization_id" = 'x'`,
      "SET moodly.organization_id = 'x'",
      "reset role",
      "reset all",
      "discard all",
      "/* hola */ set role postgres",
      "-- x\nreset role",
      "do $$ begin perform 1; end $$",
      "call algo()",
      "commit",
      "rollback",
      "begin",
      "savepoint s",
      "prepare p as select 1",
      "execute p",
      "",
    ]) {
      expect(() => assertAllowedStatement(bad), bad).toThrow(WorkerSqlError);
    }
  });

  it("rechaza set_config aunque el nombre vaya en un parámetro, y los identificadores U&", () => {
    for (const bad of [
      "select set_config($1, $2, true)",
      `select pg_catalog."set_config"('moodly.organization_id', $1, true)`,
      `select SET_CONFIG ('x', 'y', true)`,
      `select U&"set\\005fconfig"($1, $2, true)`,
      `select u& 'x'`,
    ]) {
      expect(() => assertAllowedStatement(bad), bad).toThrow(WorkerSqlError);
    }
  });
});

describe("verifyRole: cada conexión nueva, antes de entrar al pool", () => {
  const conn = (row: { current: string; session: string; unsafe: boolean }) =>
    ({ query: async () => ({ rows: [row] }) }) as unknown as Parameters<typeof verifyRole>[0];

  it("acepta moodly_worker como current_user y session_user, sin BYPASSRLS", async () => {
    await expect(verifyRole(conn({ current: "moodly_worker", session: "moodly_worker", unsafe: false }))).resolves.toBeUndefined();
  });

  it("rechaza postgres con el rol puesto (-c role=moodly_worker): con RESET ROLE volvería a postgres", async () => {
    await expect(verifyRole(conn({ current: "moodly_worker", session: "postgres", unsafe: false }))).rejects.toThrow(WorkerSqlError);
  });

  it("rechaza otro rol y un rol que se salta RLS", async () => {
    await expect(verifyRole(conn({ current: "service_role", session: "service_role", unsafe: true }))).rejects.toThrow(WorkerSqlError);
    await expect(verifyRole(conn({ current: "moodly_worker", session: "moodly_worker", unsafe: true }))).rejects.toThrow(WorkerSqlError);
  });
});
