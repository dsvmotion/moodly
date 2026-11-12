# Leads de la web pública: guardar las peticiones de demo y contacto

- **Estado:** propuesto. Sin migración ni código hasta que exista producción (`PL-prod`). Decisión de V1 del 2026-11-12: una función `SECURITY DEFINER` que puede ejecutar `anon`, desplegada en staging sin uso, es superficie de ataque sin beneficio.
- **Hallazgo:** N-02. El paso de M0 está hecho: los formularios ya no fingen un envío, abren el correo con el mensaje escrito y lo dicen (#245). Este documento es el paso siguiente.
- **Fecha:** 2026-11-12. Lo escribe V3; lo revisa V1.

## Por qué no se hace todavía

No hay producción. Si el formulario escribiera en la base de datos de staging, los datos personales reales de quien pide una demo acabarían en staging. Eso choca con dos reglas:

- «Datos reales: ninguno hasta cumplir las condiciones de salida a producción» (`docs/STATUS.md`).
- N-04: «la web nunca apunta a staging».

Opciones que se valoraron:

1. **Mantener el `mailto` honesto de #245 hasta `PL-prod`.** Es la elegida.
2. Un proyecto mínimo de Supabase en la UE solo para leads. Pide DPA, claves y copias propias (producto).
3. Aceptar leads en staging como excepción explícita. Descartada.

Cuando exista producción, la migración se escribe en el hueco que le toque en ese momento. El hueco `20261112100000` que V1 reservó para esto se libera.

## La tabla: `private.leads`

Son datos de la plataforma, no de un tenant. La tabla vive en `private`, fuera de la API. Guarda solo lo necesario:

| Columna | Tipo y reglas |
|---|---|
| `id` | `uuid` primary key, `default gen_random_uuid()` |
| `created_at` | `timestamptz not null default now()` |
| `name` | `text not null`, de 1 a 120 caracteres |
| `email` | `text not null`, hasta 254, con comprobación básica de formato |
| `company` | `text null`, hasta 160 |
| `team_size` | `text null`, uno de `'1-10'`, `'11-50'`, `'51-250'`, `'250+'` |
| `topic` | `text not null`, uno de `'demo'`, `'pricing'`, `'enterprise'`, `'support'`, `'press'` |
| `message` | `text null`, hasta 2000 |
| `locale` | `text not null`, uno de `'es'`, `'en'`, `'fr'`, `'de'` |
| `source_path` | `text not null`, hasta 200, empieza por `/` |
| `consent_text_version` | `text not null`: la versión del texto de consentimiento, versionado en el código de la web (p. ej. `'contacto-2026-11-12'`) |
| `consent_at` | `timestamptz not null`. El formulario no se envía sin la casilla marcada. |
| `ip_hash` | `text not null`: SHA-256 con sal, solo para el freno. La sal está en `private.server_keys` y el hash lo calcula la base de datos dentro de `submit_lead`. Sin IP en claro ni *user agent*. |
| `status` | `text not null default 'new'`, uno de `'new'`, `'contacted'`, `'closed'` |

## Escritura

Solo por `public.submit_lead(p_key text, p_lead jsonb)`:

- **Tipo de función:** `SECURITY DEFINER`, con `set search_path = ''`. La puede ejecutar `anon`.
- **Clave de servidor:** exige la clave `leads_form` (`private.server_key_ok`), con el mismo patrón que `LOGIN_THROTTLE_KEY`. La clave publicable sola no inserta nada.
- **Validación:** las mismas reglas que la tabla.
- **Freno dentro de la función:** 5 envíos por hora por `ip_hash` y 3 al día por el hash del email.
- **De dónde sale la IP:** la acción de servidor la toma de una sola cabecera de confianza, la que fija el borde de la plataforma y el cliente no puede falsear.
  - Si la web pública de producción está en Vercel, es `x-vercel-forwarded-for`.
  - Hoy `apps/site` está en el servicio `site` de Railway (`docs/STATUS.md`). Si sigue ahí, antes de la migración hay que comprobar qué cabecera sobrescribe su proxy, con una prueba que mande una cabecera falsa, y dejarlo escrito aquí.
  - Nunca se toma de una cabecera que el cliente pueda poner ni del cuerpo. Si falta la cabecera de confianza, se rechaza el envío.
- **El hash:** la acción no lo calcula. Pasa la IP en `p_lead`, y `submit_lead` calcula el hash con la sal y la descarta.
- **Respuesta:** solo `'ok'`, `'limited'` o `'invalid'`. No deja saber si un email ya existe.
- **Dónde escribe:** solo en `private.leads`, que no es una tabla de tenant. Aun así, el PR lo explicará y llevará tests en negativo (CLAUDE.md, «Base de datos: guardas»).

La acción de servidor valida antes con Zod (el mismo esquema) y llama a la función.

## Lectura

`private` no está expuesto en la API, así que el panel interno no lee la tabla directamente. Usa dos funciones en `public`:

- **`public.list_leads(p_status text default null, p_limit int default 50, p_before timestamptz default null)`**. Es `SECURITY DEFINER` y solo lee. Devuelve las columnas de la tabla salvo `ip_hash`.
- **`public.set_lead_status(p_id uuid, p_status text)`**. Es `SECURITY DEFINER` y solo cambia `status`. Emite el evento de auditoría (ADR 0032).

Ninguna de las dos puede ejecutarla `anon`. Postgres da `EXECUTE` a `PUBLIC` por defecto, así que la migración hace `revoke execute … from public, anon` en `list_leads`, `set_lead_status`, `purge_leads` y `erase_lead`. Después concede `EXECUTE` solo a quien lo necesita: `authenticated` en las dos de lectura y estado y en `erase_lead`; el rol del worker en `purge_leads`. `submit_lead` se concede a `anon` de forma explícita. Las dos empiezan comprobando `private.session_is_active()`, `private.is_platform_staff()` y `private.session_is_aal2()`. Si falla cualquiera, lanzan un error sin datos.

`set_lead_status` es una función `SECURITY DEFINER` que escribe. Aunque `private.leads` no es una tabla de tenant, llevará tests en negativo: `anon`, un usuario normal y el equipo interno con aal1.

Además, como defensa en profundidad:

- RLS activada y forzada en `private.leads`, sin políticas para `anon` ni `authenticated`.
- `revoke all` para `public`, `anon` y `authenticated`.
- Un trigger `guard_*` con lista blanca (ADR 0003): cualquier `UPDATE` que no venga de `set_lead_status` solo puede tocar `status`.
- **DELETE:** ninguno por la API. Solo la purga y `erase_lead`.

## Retención y derechos

- **Plazos:** 12 meses desde `created_at`; los `closed`, 3 meses después de cerrarse.
- **Purga:** la hace `private.purge_leads()`. La llama un trabajo diario de DBOS en el worker, porque no hay `pg_cron`.
- **Borrado a petición:** `erase_lead(email)`, para el equipo interno con aal2. Borra también el hash del email del freno.

## Dónde vive la acción

`apps/site` no puede importar un cliente de Supabase (regla de lint y test estructural, CLAUDE.md). Hay dos caminos:

| Camino | Cómo | A favor | En contra |
|---|---|---|---|
| **(i)** | La acción de servidor de la web llama a la función con un `fetch` a `/rest/v1/rpc/submit_lead`, HTTP sin el cliente. Usa `LEADS_FORM_KEY` y la URL, en el entorno del servidor. | La web pública no depende de la app. | Necesita una excepción explícita a la regla para ese único archivo. |
| (ii) | Un *route handler* en `apps/web`, que sí puede usar el cliente, y la web lo llama de servidor a servidor. | Respeta la regla tal cual. | Ata la web pública a la app. |

**Propuesta: (i).** La excepción se documenta en CLAUDE.md y AGENTS.md, y un test estructural comprueba que solo ese archivo hace la llamada.

## Vuelta atrás

`supabase/rollbacks/<hueco>_leads.down.sql` borra, por este orden, las funciones (`submit_lead`, `list_leads`, `set_lead_status`, `purge_leads`, `erase_lead`), el trigger, la tabla y la clave `leads_form` con su sal.

## Tests pgTAP previstos

1. RLS activada y forzada.
2. `anon` y `authenticated` no pueden ni leer ni insertar directamente.
3. `submit_lead` sin clave, con una clave equivocada o con un payload malo devuelve `'invalid'` y no crea ninguna fila.
4. El sexto envío en una hora desde el mismo `ip_hash` devuelve `'limited'`.
5. `list_leads` y `set_lead_status` fallan sin datos para `anon`, para un `authenticated` que no es del equipo interno y para el equipo con aal1. Con aal2 funcionan, y `list_leads` no devuelve `ip_hash`.
6. Nada puede cambiar más que `status`, ni por `set_lead_status` ni por un `UPDATE` directo (la guarda).
7. La IP en claro no se guarda en ninguna columna: solo `ip_hash`.
8. La purga borra solo lo caducado.
9. La migración de vuelta atrás no deja rastro.
