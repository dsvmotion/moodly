# 0021 — Equipo interno (`platform_staff`), lectura entre tenants y auditoría para el `/ops` de la Fase 0

- **Estado:** propuesto (pendiente de revisión humana de la migración, las políticas RLS y el helper `SECURITY DEFINER`)
- **Fecha:** 2026-10-06
- **Secciones del MANUAL afectadas:** §4.2, §4.4, §9.2, §9.7, §9.9, §10.1, §10.2, §10.5, §11, §17

## Contexto
La Fase 0 (MANUAL §17) incluye un "`/ops` mínimo" sin definir su alcance. §4.2 nombra `platform_staff` (`platform_admin` / `platform_operator`) y `audit_logs`, pero no dice qué puede hacer cada rol, cómo se concede el acceso ni cómo se audita. §4.4 exige que el acceso del equipo interno a datos de un cliente quede en `audit_logs`, y §10.5 que `audit_logs` sea append-only para todo rol de aplicación. Además, la service role solo se usa en el worker (§4.4, AGENTS.md), así que `/ops` no puede leer con ella.

La especificación del panel (`/ops` mínimo, Fase 0) dejó 14 decisiones abiertas (D1–D14). **Diego las cerró el 2026-10-06 aceptando todos los valores recomendados.** Este ADR las recoge y fija el diseño de base de datos que implementa el PR 1 (migración `20261006170108_platform_staff_audit`).

## Decisión
1. **Identidad del equipo interno separada de los roles tenant.** Tabla `public.platform_staff` (`user_id` único → `public.users`, `role` en `platform_admin`/`platform_operator`, `created_at`, `updated_at` y `revoked_at`). `revoked_at` es un añadido a §4.2: retira el acceso sin borrar el historial, y con cualquier valor la fila cuenta como revocada. En código y textos se dice siempre `platform_staff`, nunca `staff` a secas (ese es un rol tenant).
2. **Conceder y retirar es de la plataforma (D4).** `platform_staff` no tiene políticas de INSERT/UPDATE/DELETE y `authenticated` no tiene esos privilegios. La única política deja a cada usuario ver su propia fila (la puerta de `/ops` la leerá así, sin service role).
3. **Helper `private.is_platform_staff(p_roles text[] default null)`**, con los mismos criterios que los del ADR 0003: `STABLE`, `SECURITY DEFINER`, `search_path = ''`, anclado en `(select auth.uid())`, EXECUTE solo para `authenticated` y `service_role`, y solo lee. Verdadero si existe una fila no revocada (y el rol coincide, si se indica). Los helpers tenant no cambian: una cuenta interna no obtiene nada en `/app` por ser interna.
4. **Identidades separadas (D2).** Un usuario no puede ser a la vez interno no revocado y tener una membership tenant. Lo impone el trigger `validate_identity` en `memberships` y en `platform_staff` (`private.validate_identity_separation()`, con bloqueo consultivo por usuario). Es una regla de integridad, no una guarda de la app: actúa para todos los roles, también la plataforma, igual que `validate_scope`. Un interno revocado sí puede tener membership, y entonces no se le puede devolver el acceso interno.
5. **Lectura entre tenants, solo lectura.** Una política SELECT permisiva nueva por tabla (`organizations`, `regions`, `locations`, `memberships`, `users`), separada de las tenant: `using ((select private.session_is_active()) and (select private.is_platform_staff()))`. Ninguna política de escritura para el equipo interno; las guardas del ADR 0003 siguen como segunda capa. `users` solo expone `full_name` y `locale` (el email está en `auth.users`).
6. **`public.audit_logs`** (§4.2, §10.5): `id`, `organization_id` (null admitido, D7), `actor_type` (`agent`/`user`/`platform_staff`/`system`), `actor_id`, `action`, `target` y `metadata` (`jsonb`, `{}` por defecto) y `at`.
   - **Solo inserción para todos los roles de aplicación**, también la service role (D6): sin UPDATE, DELETE ni TRUNCATE por privilegio y, como segunda capa, un trigger que los rechaza para `authenticated`, `anon` y `service_role`. La plataforma (migraciones, SQL con credenciales de plataforma) no queda bloqueada.
   - **`at` lo fija la base de datos** (trigger `set_at`): nadie puede antedatar ni posfechar una fila.
   - **INSERT:** solo el equipo interno, y solo filas propias: `actor_type = 'platform_staff' and actor_id = (select auth.uid())`. Los usuarios tenant no insertan nada todavía.
   - **SELECT:** el equipo interno lee todas las filas; el `org_admin` lee las de su organización (D5, "exportable por organización"; sin UI tenant).
   - **D7:** `check (organization_id is not null or actor_type in ('platform_staff', 'system'))`. Además, solo el sistema puede no tener `actor_id`.
   - `actor_id` sin FK, para que el registro sobreviva al actor. `organization_id` con `on delete restrict`: borrar una organización con auditoría obliga a decidir antes qué se hace con ella (D6), en lugar de borrarla en cascada sin aviso.
   - Sin `created_at`/`updated_at` (convención de §4.2): en una tabla de solo inserción `at` es la fecha de creación y no hay modificaciones.
7. **Toda política nueva empieza por `(select private.session_is_active()) AND …`** (ADR 0003 §7). Logout, sesión caducada, ban o borrado cortan también el acceso interno en la siguiente consulta.

### Actualización 2026-10-21: acceso con permiso temporal y MFA (D8 y D12 cerradas)

La auditoría del backend (P0-3) comprobó que la lectura permanente del equipo interno se podía usar llamando directamente a la API REST, sin MFA y sin dejar ninguna fila de auditoría: la «fila por vista» de D8 solo la imponía la app. Producto aprobó el acceso *just-in-time* (decisión D3 de la auditoría, en línea con el ADR 0022). La migración `20261006180000_support_grants` lo impone en la base de datos:

- **`public.support_grants`:** permiso de un interno sobre una organización, con motivo (10–500 caracteres), caducidad de **8 h como máximo** y revocación. No se borra (queda como historial).
- **Leer datos de un cliente exige a la vez** sesión viva, **MFA en la sesión (`aal2`)** y un permiso vigente para esa organización (`private.staff_can_read`). Sin permiso, el interno no ve nada de ningún cliente.
- **Solo un `platform_admin` con MFA concede o revoca.** `granted_by` y las fechas los fija la base de datos. De un permiso solo se puede cambiar `revoked_at`, y una vez.
- **Conceder y revocar escriben en `audit_logs` en la misma transacción.** El `org_admin` del cliente lo ve en la auditoría de su organización (D5).
- **Leer toda la auditoría** también exige MFA.
- **Perfiles:** el interno ve los de las personas de organizaciones con permiso vigente y los de otros internos.

Con esto, **D8 queda cerrada** (el acceso lo impone la base de datos, no la app) y **D12 queda impuesta en la base de datos** (sin `aal2` no hay lectura). Para usarlo en un entorno alojado, los internos tienen que tener MFA activado (llega con el PR #30). El permiso lo crea hoy un `platform_admin` por SQL o por la API; la pantalla de `/ops` para pedir y conceder permisos va con los PR 2–4. En el plan enterprise, la aprobación del propio cliente (ADR 0022) se añadirá sobre esta misma tabla.

### Decisiones D1–D14 (cerradas por Diego el 2026-10-06)
| # | Decisión |
|---|---|
| D1 | `platform_admin` y `platform_operator` con el mismo acceso de solo lectura en la Fase 0. La distinción se guarda ya y se usará con las escrituras (admin: alta y configuración de clientes y conceder acceso interno; operator: lectura y soporte). |
| D2 | Identidades separadas: una cuenta interna no puede tener memberships tenant (trigger). El equipo interno usa una cuenta dedicada. |
| D3 | Sin escrituras en el `/ops` de la Fase 0. Llegarán después de la 3b (invitaciones), con funciones de base de datos auditadas y revisadas por una persona o con un job del worker; nunca con la service role en `apps/web`. |
| D4 | Conceder/retirar: en local y CI, por el seed. En el entorno alojado, un SQL puntual documentado (abajo) que ejecuta Diego con credenciales de plataforma y que escribe también una fila de `audit_logs` con `actor_type = 'system'`. Sin UI. |
| D5 | El `org_admin` lee las filas de auditoría de su organización (solo política, sin UI). |
| D6 | **Abierta:** borrado RGPD frente a auditoría de solo inserción. Por ahora los roles de aplicación son estrictamente de solo inserción; la regla (seudonimizar `actor_id`/`target` o borrar) se decide con el trabajo de §11. |
| D7 | `organization_id` admite null en eventos internos o de sistema entre tenants, con el check de arriba. Alternativa descartada por ahora: una tabla aparte `platform_audit_logs`. |
| D8 | **Abierta (aplazada):** en la Fase 0 la auditoría se impone en la capa de aplicación (`withPlatformStaffAudit` antes de cada lectura, PR 2–4, verificado por e2e). Las "sesiones de acceso" impuestas por la base de datos llegan con el modo soporte. |
| D9 | `/ops` sigue el idioma por defecto de la app. Cambiar ese defecto a inglés es un cambio aparte en §9.9 con su ADR. |
| D10 | Quien no es equipo interno recibe 404 (`notFound()`), no 403. |
| D11 | Entrada por un enlace solo para el equipo interno en el menú de usuario; sin cambios en la redirección tras el login. |
| D12 | **Abierta (bloquea el uso alojado):** MFA (AAL2 de Supabase Auth) obligatorio para el equipo interno antes de cualquier uso alojado o en producción, a verificar contra el plan de Supabase (§18 #11). No se exige en local en la Fase 0. |
| D13 | `^apps/web/src/app/ops/` pasa a `scripts/merge-guard/sensitive-paths.txt`, con los PRs web de `/ops` (no en este). |
| D14 | `/ops/agent-types` solo si la tarea 5 ya está mergeada; `/ops/queues` espera a la tarea 6. |

### Procedimiento D4 en el entorno alojado (borrador, a ejecutar por Diego)
Requisito: la cuenta existe en `auth.users` y tiene perfil en `public.users`, y no tiene memberships (D2). Hoy el perfil solo lo crea el seed; en el entorno alojado se crea en el mismo paso hasta que exista la 3b.
```sql
begin;
insert into public.platform_staff (user_id, role) values ('<user_id>', 'platform_operator');
insert into public.audit_logs (actor_type, action, target)
values ('system', 'platform_staff.granted', jsonb_build_object('user_id', '<user_id>', 'role', 'platform_operator'));
commit;

-- Retirar el acceso (sin borrar la fila):
begin;
update public.platform_staff set revoked_at = now() where user_id = '<user_id>';
insert into public.audit_logs (actor_type, action, target)
values ('system', 'platform_staff.revoked', jsonb_build_object('user_id', '<user_id>'));
commit;
```
Los nombres de acción `platform_staff.granted` / `platform_staff.revoked` son una propuesta. Sin datos personales en `target` ni `metadata` (§12.1).

## Alternativas consideradas
- **Service role en `apps/web` para `/ops`:** prohibido por §4.4 y AGENTS.md; el manual no hace excepción para `/ops`.
- **Dar acceso al equipo interno a través de memberships o de los helpers tenant:** reutilizaría implícitamente la UI y los roles tenant (§9.2 sugiere al equipo interno en el selector de organización; no se adopta) y mezclaría dos modelos de acceso en las mismas funciones.
- **Tabla aparte `platform_audit_logs` para eventos entre tenants (D7):** dos tablas que exportar y consultar; se puede revisar si el check se queda corto.
- **"Sesiones de acceso" en la base de datos (D8):** más fuerte, pero necesita el modo soporte; aplazado.
- **`organization_id` con `on delete cascade` en `audit_logs`:** borraría la auditoría de un cliente sin pasar por la decisión de D6.

## Consecuencias
- La lectura entre tenants del equipo interno vive en 5 políticas nuevas; cualquier tabla nueva con datos de cliente que deba verse en `/ops` necesita su propia política `…_select_platform_staff`.
- Cada consulta de un usuario tenant evalúa también `is_platform_staff()`, envuelta en `(select …)`: una sola vez por consulta (InitPlan), como `session_is_active()`.
- Hasta D8, que cada vista de `/ops` deje su fila de auditoría depende de la capa de aplicación (PR 2–4 y su regla en AGENTS.md/CLAUDE.md).
- Borrar una organización con filas de auditoría falla hasta que se decida D6.
- Un `org_admin` que intente dar de alta a una cuenta interna recibe un error que revela que es interna. Es menor y desaparece con las invitaciones (3b), que sustituyen el INSERT directo en `memberships`.
- Antes de cualquier uso alojado: MFA para el equipo interno (D12) y el procedimiento D4.

## Verificación
- `supabase test db`: 301 tests en 9 archivos (186 previos sin cambios + `07_platform_staff` 55 + `08_audit_logs` 60), en verde con la CLI 2.118.0. El estructural `00_rls_enabled` pasa sin cambios con las tablas y políticas nuevas.
- Pruebas negativas, cada una restaurada después con `supabase db reset`; todas hacen fallar tests: política del equipo interno `using (true)`, helper siempre `true`, helper que ignora `revoked_at` y política de INSERT de auditoría sin comprobar el actor.
- El rollback `supabase/rollbacks/20261006170108_platform_staff_audit.down.sql` se probó en local: deja el esquema como en `main` y la migración se vuelve a aplicar sin errores.
- `supabase db lint --level warning --fail-on warning`: sin errores.
- Evidencia completa en el PR.
