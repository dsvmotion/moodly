# Simulacro de restauración de la base de datos (PL-prod)

Puerta de M1: «se ha hecho un simulacro de restauración». Este documento dice qué prueba el simulacro automático, cómo lanzarlo, qué da el plan de Supabase y qué pasos hace una persona para restaurar un proyecto entero (que el simulacro **no** cubre).

## 1. Qué prueba el simulacro y qué no

**Prueba** (con una ejecución real, no «en teoría»): que de la base de datos de staging se puede sacar un volcado propio (roles, esquema y datos, con `supabase db dump`), restaurarlo en un Postgres desechable y que lo restaurado es lo que había:

- el volcado entra sin errores (roles y esquema, y datos, de estos solo se enseña el código SQLSTATE);
- cada tabla con datos tiene las mismas filas que el volcado (recuento por tabla);
- RLS sigue activado **y forzado** en todas las tablas de `public`, y `public` tiene al menos las tablas que crea el esquema del origen (con `public` vacío, «0 tablas sin RLS» no vale); el número de políticas es el del volcado;
- los roles propios del origen (los que crea su volcado de roles: `dbos_worker` y `moodly_worker`, y tienen que estar) existen en el destino con los mismos atributos (`LOGIN`, `NOBYPASSRLS`…): los de la plataforma (`anon`, `authenticated`…) ya vienen en la imagen y no prueban nada;
- las migraciones aplicadas (`supabase_migrations.schema_migrations`) son exactamente las del repositorio.

**No prueba:**

- restaurar un **proyecto entero** desde las copias de Supabase (copias diarias o PITR): eso lo hace una persona desde el panel (sección 4);
- los objetos de Storage (los ficheros; la base de datos solo tiene sus metadatos), las Edge Functions, los ajustes de Auth, las claves de API ni la configuración del proyecto (`config.toml` se vuelve a aplicar con `supabase config push`, que ya hace el despliegue a staging);
- las contraseñas de los roles propios `dbos_worker` y `moodly_worker`: ni el volcado ni las copias diarias de Supabase las llevan (ver sección 5);
- el tiempo de una restauración real a escala de producción: el tiempo que da el simulacro es el de una base de datos pequeña (staging) por el camino lógico (volcado + restauración). Es una cota de trabajo, no un compromiso de RTO.

El volcado puede llevar datos personales (`auth.users`, contactos, mensajes). Por eso el simulacro solo imprime recuentos, nombres de tablas, códigos SQLSTATE y tiempos, el volcado vive en un directorio `0700` del runner que se borra al salir, y no se sube como artefacto.

## 2. Cómo se lanza

- **Contra staging (la prueba de verdad):** Actions → «Staging · simulacro de restauración» → Run workflow (`.github/workflows/staging-restore-drill.yml`; solo desde `main`). Usa los secretos del entorno `staging` que ya usa el despliegue (`SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD`) y solo **lee** staging. El Postgres desechable es un servicio del propio job (la imagen de Supabase, versión 17, como el proyecto). Los tiempos y el resultado salen en el log y en el resumen del job.
- **Ensayo en local** (sin tocar staging): con Supabase local levantado y el seed aplicado, un Postgres desechable y el script:

  ```bash
  docker run -d --name drill-pg -e POSTGRES_PASSWORD=postgres -p 54399:5432 public.ecr.aws/supabase/postgres:17.6.1.054
  DRILL_SOURCE=local DRILL_TARGET_URL='postgresql://supabase_admin:postgres@127.0.0.1:54399/postgres' bash scripts/supabase/restore-drill.sh
  ```

  Cada ensayo necesita un destino nuevo (`docker rm -f drill-pg` y volver a crearlo). El script sale con 0 solo si todo cuadra y con 1 si algo no (también si falla una fase, como el volcado o la conexión con el destino), y no necesita nada más que `supabase`, `psql` y Docker.
- **Pruebas del propio simulacro** (`bash scripts/supabase/tests/restore-drill.test.sh`, con Supabase local y el seed; no corren en el CI): hace una restauración de verdad, comprueba que sale bien y después estropea una cosa por caso, exigiendo que el simulacro la detecte: un rol propio con `BYPASSRLS` de más, un destino sin tablas en `public`, un `FATAL` o un `psql: error:` en la salida de la restauración (esquema y datos) y un volcado que falla a medias. Se lanzan al tocar `scripts/supabase/restore-drill.sh`.

## 3. Resultado

| Dónde | Cuándo | Resultado | Tiempos |
|---|---|---|---|
| Local (ensayo, Supabase local con el seed, 69 migraciones) | 2026-11-24 | OK: 122 tablas con datos cuadran (1850 filas), RLS activado y forzado en las 40 tablas de `public` (el origen crea 40), 145 políticas, 2 roles propios con sus atributos, 69 migraciones = repositorio | volcado 6 s · preparar 0 s · restaurar 4 s · comprobar 6 s · **total 16 s** |
| Staging (la corrida real desde `main`) | **pendiente** | — | — |

Pruebas en negativo (el simulacro tiene que fallar cuando algo no cuadra; ver `scripts/supabase/tests/restore-drill.test.sh`): contra las comprobaciones de la primera versión, 5 fallos pasaban sin que se detectaran (un rol propio con `BYPASSRLS`, un `public` vacío, un `psql: error:`/`FATAL` en la restauración del esquema y otro en la de datos, y un volcado que falla a medias); con las comprobaciones actuales se detectan los 5. Además, con una migración en el repositorio que la base no tiene, sale con 1 y dice qué versión falta. Y el camino de los errores de datos imprime solo `ERROR: 23505`, sin el mensaje ni el detalle (que llevan el valor de la fila).

La fila de staging se rellena con la primera corrida real desde `main` (número de la ejecución, recuentos y tiempos). Hasta entonces la puerta **no** está cumplida.

## 4. Qué da Supabase y cómo se restaura un proyecto entero

Según la documentación de Supabase (https://supabase.com/docs/guides/platform/backups y https://supabase.com/docs/guides/platform/clone-project, leídas el 2026-11-24; los planes y precios cambian: se vuelve a mirar antes de contratar):

- **Copias diarias:** en Pro (7 días), Team (14) y Enterprise (hasta 30). Free no las tiene (la documentación recomienda `supabase db dump` y copias fuera del proveedor).
- **PITR:** complemento de pago para Pro, Team y Enterprise (retención de 7, 14 o 28 días según el nivel; granularidad de segundos; RPO de dos minutos en el peor caso). **Al activar PITR dejan de hacerse las copias diarias.**
- **Restaurar en el mismo proyecto:** Database → Backups, elegir la copia (o, con PITR, «Start a restore» y la fecha y hora). El proyecto **no está accesible durante la restauración** y el tiempo crece con el tamaño de la base de datos. Reemplaza el estado actual: lo posterior al punto elegido se pierde.
- **Restaurar en un proyecto nuevo** (para conservar los datos actuales): Database → Backups → «Restore to a New Project». Crea una copia **solo de la base de datos**, en la misma región, con coste extra mensual. La documentación avisa de que hay que reconfigurar a mano lo que no se copia (Storage, Edge Functions, ajustes de Auth y claves de API, ajustes de Realtime, ajustes de la base de datos, integraciones y ajustes del proyecto) y de que las extensiones con efectos externos (`pg_net`, `pg_cron`, wrappers) empiezan a ejecutar sus tareas en cuanto termina la restauración.
- **Borrar un proyecto borra también sus copias** (irreversible).

**Pasos que hace una persona (el fundador; el simulacro automático no los sustituye):**

1. Tener Supabase Pro (o superior) en la UE en el proyecto de producción y decidir si se contrata PITR (RPO de minutos) o se queda con las copias diarias (RPO de hasta 24 h). Es una decisión de producto y de coste.
2. **Ensayar la restauración en un proyecto que no sea producción** (por ejemplo, un proyecto nuevo con una copia de staging si el plan lo permite): Database → Backups → «Restore to a New Project», medir cuánto tarda y apuntarlo aquí.
3. Reconfigurar lo que no se copia: `supabase config push` para los ajustes de `config.toml`, claves de API y secretos de la web y del worker, y los ajustes de Auth que no estén en `config.toml`.
4. Dar login a los roles propios (sección 5) y volver a comprobar con «Staging · worker» (`connect` y `rls-connect`).
5. Comprobar la web y el worker contra el proyecto restaurado y la salud (`/health`).

## 5. Después de cualquier restauración: las contraseñas de `dbos_worker` y `moodly_worker`

Las copias diarias de Supabase no guardan las contraseñas de los roles propios, y el volcado de roles del simulacro tampoco (el rol sale con `LOGIN` y sin contraseña). Tras restaurar hay que volver a darles login con «Staging · worker» (acciones `role` y `rls-role`, que usan los secretos `DBOS_WORKER_DB_PASSWORD` y `MOODLY_WORKER_DB_PASSWORD`) y comprobar con `connect` y `rls-connect`. Mientras no se haga, el worker no arranca.

## 6. Cuando haya datos reales

Antes del primer dato real de un cliente: el simulacro corrido contra el proyecto de producción (con las mismas comprobaciones), la restauración a un proyecto nuevo ensayada por una persona (paso 2 de la sección 4) con su tiempo medido, y el RPO y el RTO que se prometen escritos aquí con esos números. Los DPAs y el resto de condiciones de salida están en `docs/STATUS.md`.
