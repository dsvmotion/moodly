# 0009 — Eventos de dominio con outbox en Postgres, publicador programado de DBOS y tenant de la fila

- **Estado:** propuesto (implementado en W3; pendiente de aceptación por producto)
- **Fecha:** 2026-10-24
- **Secciones del MANUAL afectadas:** §4.4 (worker), §5.8 (coordinación entre agentes)
- **Relación:** ADR 0003 (RLS y guardas), ADR 0027 (DBOS; «el publicador de `domain_events` es un workflow programado»), revisión de seguridad del 2026-10-20 (controles 3.2 y 3.7), roadmap A3

## Contexto

Los agentes no se llaman entre sí (MANUAL §5.8): lo que pasa en una organización se apunta como **evento de dominio** y quien tenga que reaccionar lo recibe después. Hace falta:

- que el evento se escriba **en la misma transacción** que la acción: si la acción no se confirma, no hay evento; si se confirma, el evento no se pierde;
- que cada consumidor lo reciba **una vez** aunque el worker muera a mitad, y que un consumidor que falla no frene a los demás;
- que el **tenant** del evento no se pueda manipular: un consumidor que actuara sobre la organización que dice el payload rompería el aislamiento (control 3.7);
- no añadir infraestructura: todo en el Postgres que ya hay (ADR 0026).

## Decisión

1. **Tabla `domain_events`** (outbox) con `organization_id` y `location_id` como columnas, `type`, `payload`, `source_run_id`, `chain_depth` y `published_at`:
   - **El tenant sale de la fila, nunca del payload.** Los payloads llevan ids y datos mínimos, nunca datos personales en claro ni claves de tenant; cada tipo tiene su esquema Zod en el worker, que quita cualquier clave que no esté en él.
   - Protección contra bucles en la propia tabla: `chain_depth` entre 0 y 5 (un evento que provoca otro le suma 1). Payload de 8 KB como mucho.
   - **Nadie de la app escribe eventos.** Si `authenticated` pudiera insertar, un miembro falsificaría eventos de su organización por la API. Los escriben triggers de la base de datos, y el primero es `invitation.created` al crear una invitación. Leen el `org_admin` de su organización (para el futuro panel de actividad) y el equipo interno con soporte vigente.
   - La service role solo lee y marca como publicado, y la hora la pone la base de datos.
2. **Emisores `SECURITY DEFINER` acotados.** El trigger que escribe el evento se ejecuta como su dueño porque quien hace la acción no tiene privilegios sobre `domain_events`. Cada emisor:
   - escribe una sola fila, con la organización de la fila que lo dispara (que ya pasó RLS y sus guardas);
   - sin datos personales;
   - sin `EXECUTE` para ningún rol de la app.

   Cada emisor nuevo se explica en su PR y lleva tests en negativo (CLAUDE.md, «Base de datos: guardas»).
3. **Publicador: workflow programado de DBOS** (`outbox.publish`, cada 5 s), como dice el ADR 0027:
   - lee los pendientes (solo id, organización y tipo);
   - encola una **entrega por consumidor** (`outbox.deliver`) con ID determinista `event:<evento>:<consumidor>`, en la cola `domain-events`;
   - marca los eventos como publicados.

   Si se interrumpe antes de marcar, la siguiente vuelta los vuelve a encolar con el mismo ID y DBOS devuelve la entrega existente en vez de crear otra.
4. **La única lectura entre organizaciones** del worker es `createServiceDb().outbox` (`packages/db`):
   - los metadatos de los pendientes, sin el payload;
   - marcarlos como publicados, solo los que sigan pendientes.

   Es la excepción, con nombre y revisada, a «el worker accede a una organización solo con `forOrganization`».
5. **La entrega lee el evento con `forOrganization(la organización de la fila)`** y se lo da al consumidor con ese mismo acceso y nada más. Si el `organization_id` del payload dice otra cosa, el consumidor ni lo ve.
6. **Consumidores en código** (`EventHandler`, registro en el worker):
   - cada uno con una clave estable y los tipos a los que se suscribe;
   - sus efectos van en pasos (`ctx.step`), que DBOS no repite al reanudar;
   - un paso interrumpido a mitad sí se repite (regla 2), así que lo que hagan fuera de la base de datos es idempotente.

   La tabla `event_subscriptions` del MANUAL (qué tipo de agente reacciona a qué evento) llega con el primer agente que reaccione a eventos; hasta entonces no hay suscripciones en datos que guardar. El primer consumidor deja cada entrega en el log (`log`).
7. **Limpieza horaria** (`outbox.prune`): borra del esquema `dbos` las vueltas del publicador que terminaron bien hace más de una hora. Las que fallaron se quedan para investigarlas, y las entregas también.
8. **El worker promueve su versión a la última al arrancar** (`DBOS.setLatestApplicationVersion`). DBOS manda los workflows programados a la última versión registrada, y un worker de otra versión no los recoge. Sin la promoción, tras volver a una versión anterior de `WORKER_APP_VERSION` el publicador se pararía en silencio. Hay un solo worker por entorno (el lock del ADR 0027, regla 1), así que la versión desplegada es la vigente.

## Alternativas consideradas

- **Bucle propio con `LISTEN/NOTIFY` y `FOR UPDATE SKIP LOCKED`**, en vez de un workflow programado. Daría menos latencia y no dejaría un workflow por vuelta en el esquema `dbos`. Pero es más código propio de concurrencia y contradice el ADR 0027. Se puede añadir un `NOTIFY` que despierte al publicador si la latencia de unos segundos llega a molestar.
- **Que `authenticated` inserte eventos con una política que lo limite.** No impide falsificar eventos de la propia organización (otro tipo, otro payload), y cada tabla con un emisor necesitaría reglas por tipo de evento.
- **Un workflow por evento que llame a todos los consumidores.** Un consumidor que falla repetiría o bloquearía a los demás, y reanudar sería más difícil de razonar.
- **El tenant en el payload, comprobado contra la fila.** Más código para el mismo resultado y una tentación permanente de leerlo del payload. Mejor que no esté.

## Consecuencias

- **Latencia.** Un evento tarda entre 1 y 5 s en salir más el margen de DBOS (medido en local: 1,9–4,3 s desde la web). Vale para coordinar agentes (recordatorios, cobros en borrador, resúmenes). No vale para responder a un cliente final, que va por el run de su conversación (ADR 0027).
- **Volumen en `dbos`.** Cada vuelta del publicador deja un workflow (unos 17.000 al día), y la limpieza horaria deja como mucho las de la última hora. Las entregas (una por evento y consumidor) y el resto de workflows siguen sin retención: antes de producción hay que fijarla para todo el esquema `dbos`.
- **Cambiar `WORKER_APP_VERSION`.** Las entregas encoladas o a medias de la versión vieja solo las recoge esa versión. Antes de subirla hay que vaciar la vieja: que no queden workflows `ENQUEUED` ni `PENDING` de esa versión, o moverlos con el procedimiento de versiones de DBOS. Si no, esas entregas se pierden (sus eventos ya están publicados). Lo mismo valdrá para los runs de los agentes.
- **Payload.** El payload se copia en las salidas de los pasos de DBOS (esquema `dbos`). Es otra razón para que no lleve datos personales.
- **Tipos nuevos.** Un tipo de evento nuevo va en el mismo PR que su esquema y sus consumidores. Si un worker anterior al despliegue publica un evento de ese tipo, solo llega a los consumidores de «*» y queda publicado.
- **Eventos desde el worker.** Las acciones de los agentes irán por el worker, que hoy habla con la base de datos por PostgREST: una petición, una transacción. Emitir el evento en la misma transacción que la acción del agente exigirá una función o un trigger por acción (como `invitation.created`), y `INSERT` para la service role cuando haga falta. Se decide con A4 y la primera skill.
- **Despliegue.** El worker necesita `SUPABASE_URL` y `SUPABASE_SECRET_KEY`, una clave secreta propia del worker, revocable sin tocar nada más. Railway debe redesplegarlo también cuando cambie `packages/db/src`.

## Verificación

- **pgTAP `20_domain_events`, 36 tests:**
  - privilegios por rol;
  - el evento nace con la invitación y en la misma transacción, y un alta rechazada no lo deja;
  - el payload sin email ni token;
  - quién lee;
  - nadie de la app escribe;
  - integridad del local, del tipo, de la cadena, del tamaño y de la hora.

  Siete mutaciones (un `INSERT` concedido a `authenticated`, la service role cambiando el payload, el emisor sin `SECURITY DEFINER`, sin validar el local, la hora del cliente, una política que deja leer al staff, el email en el payload): todas detectadas.
- **Integración del worker (`outbox.integration.ts`, 4 tests) contra Supabase local:**
  - la invitación llega al consumidor con la organización de la fila, y volver a publicarla no la entrega otra vez;
  - un evento de A con el payload apuntando a una invitación de B y `organization_id` de B llega con la organización A, sin las claves de tenant, y no toca la invitación de B;
  - el worker muere con `SIGKILL` en mitad de una entrega, vuelve con el mismo `executorID` y la termina sin repetir los pasos hechos;
  - la limpieza borra una vuelta terminada de hace dos horas y deja la que falló, la reciente y la entrega.

  Cinco mutaciones (tenant tomado del payload, payload sin quitar claves, ID de entrega no determinista, pasos sin *checkpoint*, limpieza sin filtrar por estado): todas detectadas.
- **Promoción de versión.** Antes de añadirla, con otra versión registrada después, los tres tests fallaron: el publicador no llegaba y DBOS avisaba de «Current version 'test-outbox' is not the latest version». Con ella pasan aunque la otra versión se registre justo antes, porque el test usa a propósito una versión fija. Al quitarla otra vez, no siempre falla: si quedan vueltas del publicador encoladas para esa misma versión, el worker las recoge al arrancar y publica con ellas.
- **Desde la web,** con el worker local, las invitaciones que crea el e2e como `org_admin` con MFA se entregan en 2–4 s. Lo mismo con la imagen de Docker, que además para limpia con `SIGTERM`.
