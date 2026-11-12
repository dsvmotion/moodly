# 0054 — La bandeja en vivo: un relé de Server-Sent Events del mismo origen

- **Estado:** aceptado (V1, 2026-11-12: «opción B»)
- **Fecha:** 2026-11-12
- **Relación:**
  - auditoría de preproducción, hallazgo **M-10** («la bandeja pide la página cada 5 s: ~120 peticiones por minuto por pestaña»);
  - la parte de la base de datos es **#216** (V6): avisos Broadcast privados de Realtime por local, `inbox:<org>:<local>` o `inbox:<org>:org`, solo con identificadores, y la política `inbox_read` sobre `realtime.messages`;
  - las cookies de sesión **httpOnly** y la CSP **`connect-src 'self'`** vienen de la auditoría R-29 (`apps/web/src/lib/cookie-options.ts`), y `apps/web/e2e/security.e2e.ts` comprueba que el navegador solo habla con la app.

## Contexto

- #216 deja a Realtime avisando de cada alta o cambio en `messages` y `conversations`. Para escucharlo, un cliente se une a un **canal privado** con el **JWT de la persona** (`supabase.realtime.setAuth()`), y Realtime comprueba al unirse que puede leer ese tema.
- La web está hecha para que **el navegador no hable nunca con Supabase**: las cookies de sesión son `httpOnly` (el JavaScript de la página no ve el token) y la CSP solo deja conectar con el propio origen. Una suscripción desde el navegador choca con las dos cosas.

## Opciones

- **A. Realtime directo desde el navegador.** Hace falta dar el token de acceso al JavaScript (un endpoint que lo devuelva, o cookies sin `httpOnly`), abrir `connect-src` a `wss://<supabase>/realtime/v1` y cambiar la aserción de `security.e2e`. Deshace R-29: un XSS podría llevarse el token (la CSP con nonces lo mitiga, pero no lo evita).
- **B. Un relé del mismo origen (Server-Sent Events).** El servidor de la app escucha Realtime con la sesión de la persona (la de sus cookies, que nunca salen del servidor) y reenvía al navegador, por `GET /app/inbox/events`, solo identificadores. Se mantienen `httpOnly`, `connect-src 'self'` y `security.e2e` tal cual.
- **C. Una sonda de cambios.** Un endpoint que devuelve una «versión» de la bandeja y la página se relee solo si cambia. Mantiene el modelo, pero no usa #216 y sigue preguntando cada pocos segundos.

## Decisión

**B.** A deshace una decisión de seguridad y cambia un test de seguridad; C no aprovecha #216.

### Cómo funciona

- **Servidor** (`apps/web/src/app/app/inbox/events/route.ts`):
  - **Acceso:** sesión viva con `getUser()` y, con un segundo factor verificado, `aal2`. Si no, 401, y el navegador sigue con la relectura periódica.
  - **Temas:** salen del alcance real de la sesión, leído en el servidor con RLS (`getScopeContext`), **nunca de la petición**: cada local que ve la persona y, si es `org_admin`, el de toda la organización (`inboxTopics`, igual que `can_see_scope`). Realtime vuelve a comprobar cada tema al unirse (`inbox_read`).
  - **Token:** `supabase.realtime.setAuth()` sin argumentos, que toma el de la sesión de las cookies, el mismo con el que van las consultas por RLS. El acceso ya lo ha decidido `getUser()`; el código de la app no llama a `getSession()`.
  - **Solo identificadores:** de cada aviso se reenvía `{type, conversationId, messageId?}`, validados como uuid (`liveEvent`). El resto de la carga no sale del servidor.
  - **Vida de la conexión:**
    - como mucho **270 s**, por debajo de `maxDuration = 300`;
    - un comentario cada 25 s para que ningún proxy la dé por muerta;
    - se cierra si se cae un canal (`CHANNEL_ERROR`, `TIMED_OUT` o `CLOSED`) o si el navegador se va (`request.signal`).
    - Al cerrarse, el navegador vuelve a conectar y la ruta comprueba otra vez sesión y alcance, con el token ya renovado por el proxy. Así se vuelve a comprobar el alcance al renovarse el token.
- **Navegador** (`apps/web/src/components/inbox/inbox-live.tsx`, un `EventSource`):
  - con cada aviso, una relectura de la página con `router.refresh()`; los de un mismo cambio se juntan en 300 ms (un mensaje trae también el aviso de su conversación);
  - **solo con la pestaña a la vista:** al ocultarla se cierra la conexión, y al volver se abre otra y se relee;
  - al (re)conectar, una relectura de lo que cambió mientras no escuchaba;
  - **cada 60 s, una relectura aunque no llegue nada**, porque `realtime.send` no corta la transacción si falla y un aviso se puede perder;
  - se monta con `key` = organización activa: al cambiar de organización, salir de la bandeja o cerrar sesión se desmonta y la conexión se cierra.
- **CI:** el job e2e levanta también Realtime (antes se excluía), para probarlo de verdad.

## Consecuencias

- **Seguridad:**
  - no cambia lo que ve el navegador: no recibe tokens y no habla con terceros;
  - quien pierde un local, cierra sesión o cambia de organización deja de recibir avisos, como tarde, al acabar la conexión en curso (≤ 270 s; el navegador la cierra antes al salir de la página). Son solo identificadores, y lo que se relee pasa por RLS en ese momento.
- **Coste (estimación para el piloto; la valida V9 con los precios vigentes de Vercel).** Supuestos: 20 personas a la vez, 8 h al día, con la bandeja a la vista todo ese tiempo (peor caso; con la pestaña oculta no hay conexión).
  - **Invocaciones:** una cada 270 s por persona, es decir ~13 por hora → 20 × 8 × 13 ≈ **2.100 al día** (~64.000 al mes), más las relecturas de la página: cada aviso o cada 60 s, como las de antes, pero muchas menos que con la consulta cada 5 s (de ~720 por hora y pestaña a ~60 más los avisos).
  - **CPU activa:** casi nula. La conexión pasa el tiempo esperando (un ping cada 25 s y algún aviso), y con Fluid compute se cobra la CPU activa.
  - **Memoria aprovisionada (GB-h):** mientras haya conexiones abiertas hay una instancia viva. Con concurrencia dentro de la función (Fluid), las conexiones comparten instancia: entre ~1–2 instancias × 8 h × la memoria de la función (mejor caso) y 20 × 8 h × la memoria (peor caso, una instancia por persona). Con 2 GB: **entre ~16–32 y ~320 GB-h al día**.
  - **Antes** (consulta cada 5 s): ~720 renderizados completos de la página por hora y pestaña, cada uno con sus consultas a Postgres.
- **Límites:**
  - una conexión abierta por pestaña visible de la bandeja;
  - si Realtime no está disponible, la bandeja se pone al día cada 60 s como mínimo.
- **Si hace falta escalar:** juntar las conexiones de una misma organización en un proceso fuera de las funciones (el worker, por ejemplo). Se decide con datos de uso.
