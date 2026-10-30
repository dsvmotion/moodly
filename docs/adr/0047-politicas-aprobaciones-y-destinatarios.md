# 0047 — Motor de políticas, aprobaciones atadas al contenido y destinatarios fijados por el runtime

- **Estado:** aceptado por producto el 2026-10-30, con la condición de que sea lo más seguro para clientes enterprise. Por eso se añadieron la separación de funciones y la auditoría de cada decisión (§3).
- **Fecha:** 2026-10-30
- **Secciones del MANUAL afectadas:** §4 (`agent_runs`, `executions`, `approvals`), §5.4, §5.5, §5.6, §5.7, §12.4
- **Relación:** controles 3.3, 3.4 y 3.8 de `docs/audits/2026-10-20-revision-seguridad-plataforma.md`; ADR 0009 (outbox), ADR 0027 (DBOS), ADR 0030 (skills y techos de autonomía); paso 2 del orden de trabajo de producto del 2026-10-24

## Contexto

Antes de que exista la primera skill, producto pidió tres controles (paso 2 del orden de trabajo):

- **3.3 · Aprobación atada al contenido exacto.** Que nadie apruebe una cosa y se ejecute otra: ni porque el contenido cambie entre aprobar y ejecutar, ni porque alguien apruebe sin sesión, sin el rol o fuera de su alcance.
- **3.4 · Destinatarios fijados por el runtime.** El LLM no elige a quién se envía nada: ni el tenant, ni el local, ni el contacto, ni la dirección.
- **3.8 · Evals de ataque** que bloqueen el merge antes de activar ningún agente.

Lo que ya hay:
- el catálogo con la clase de efecto de cada skill y los techos de autonomía en la base de datos (`private.effect_class_ceiling`, D1);
- la configuración heredada con bloqueos y sus *snapshots* (D2);
- el worker con DBOS (W1, W2);
- el outbox (W3);
- `tenantDb(orgId)` (3.2).

`packages/agent-core`, `packages/skills` y `packages/evals` están vacíos, y no existen `agent_runs`, `executions` ni `approvals`. Los contactos, las conversaciones y los consentimientos llegan con el primer agente (B19).

## Decisión

### 1. El contrato de skill y el motor de políticas viven en `packages/agent-core` y no confían en el LLM

- **`defineSkill()`** (MANUAL §5.5) rechaza al registrar cualquier entrada que declare un campo reservado del runtime:
  - el tenant y el local: `organization_id`, `location_id`;
  - el contacto y la conversación: `contact_id`, `conversation_id`;
  - los destinatarios: `to`, `cc`, `bcc`, `recipient(s)`, `phone`, `email` o `channel_address`.

  Da igual cómo se escriban (`organizationId`, `Organization-ID`…) y a qué profundidad estén. También rechaza las estructuras con claves abiertas (`z.record`, `z.any`, objetos que admiten claves no declaradas), porque por ahí el LLM podría colar cualquiera de esos campos. Al ejecutar, el motor rechaza los argumentos crudos del LLM que traigan alguno de esos nombres, en vez de descartarlos en silencio. Un test estructural recorre el registro de skills y falla si alguna lo intenta.
- **El motor de políticas** es una función pura: `decide(propuesta, contexto) → ejecutar | borrador | aprobación | pedir dato | rechazar`. Aplica el §5.4:
  - **Ya ahora:**
    - la skill está activa para ese agente;
    - la autonomía efectiva es el mínimo entre la configurada y el techo de la clase de efecto;
    - el *scoping*: el runtime pone el tenant, el local y el destino, y los argumentos que propone el LLM se validan con el esquema estricto de la skill.
  - **Puntos de extensión** que se rellenan con cada pieza: integración sana, reglas de negocio y límites de uso.

### 2. Los destinatarios los resuelve el runtime, nunca la entrada

- **`external_message`:** el destino es siempre el contacto de la conversación en curso. Lo pone el runtime en `SkillContext.target`.
- **`external_outreach`:** la skill declara su audiencia como una consulta propia (`audience(ctx)`), acotada al tenant con `tenantDb`. El LLM, como mucho, elige entre segmentos enumerados por la skill: nunca direcciones ni IDs sueltos.
- **Consentimientos:** el runtime filtra la audiencia por consentimiento y canal antes de ejecutar. Sin un `ConsentChecker` configurado, no envía a nadie (por defecto, denegar).

### 3. Cada ejecución lleva el hash de su contenido, y la aprobación se ata a ese hash

- **`input_hash`:** SHA-256 de un JSON canónico (claves ordenadas, sin espacios, UTF-8) de:
  - la versión del formato;
  - la organización, el local y el run;
  - la skill y su versión;
  - la entrada validada;
  - el destino resuelto por el runtime.

  Lo calcula `agent-core` y se guarda en `executions` al crearla.
- **Inmutabilidad:** `executions.input` e `input_hash` no cambian nunca (guarda en base de datos). `approvals.input_hash` se copia al crear la aprobación y una guarda comprueba que coincide con el de su ejecución.
- **Al ejecutar lo aprobado,** el worker relee la ejecución y la aprobación con `forOrganization(org)` y llama a `verifyApproval()` de `agent-core`, que recalcula el hash de la entrada guardada. Exige además que:
  - ese hash coincida con los dos guardados;
  - la aprobación esté `approved` y no haya caducado.

  Si algo no cuadra, no ejecuta: marca la ejecución como fallida y emite un evento de seguridad.
- **Decidir una aprobación** solo se puede con una sesión de Supabase (RLS como `authenticated`), nunca con un enlace o un token sin sesión:
  - el rol tiene que ser igual o superior al exigido, dentro del alcance del local;
  - hace falta `aal2` si la clase es `financial` o `destructive`, o si decide un `org_admin`, como en todo lo que administra.

  Una guarda `guard_*` solo deja cambiar:
  - `status`, de `pending` a `approved` o `rejected`, antes de `expires_at`;
  - `decided_by`, que tiene que ser `auth.uid()`;
  - `decided_at`.
- **Separación de funciones:** lo financiero y lo destructivo que pidió una persona (un run `staff_instruction`, con `requested_by`) no lo puede aprobar esa misma persona, aunque tenga el rol, el alcance y `aal2`. La aprobación copia `requested_by` del run al crearla, y no cambia.
- **Auditoría:** cada decisión queda en `audit_logs` (append-only) con quien decidió, la acción (`approval.approved` o `approval.rejected`) y el hash de lo aprobado.
- **La decisión emite `approval.decided` en el outbox,** en la misma transacción. Lo escribe un trigger `SECURITY DEFINER` que solo inserta esa fila, como `invitation.created`. El worker despierta al workflow del run (MANUAL §5.7).

### 4. Evals de ataque deterministas desde ya; con modelo real cuando exista el enrutador

- `packages/evals` empieza con un **set de ataque determinista**: un «modelo» guionizado propone las llamadas que haría una inyección, y el set comprueba que el runtime y el motor las bloquean. Por ejemplo:
  - otro tenant o local en los argumentos;
  - un destinatario metido en la entrada;
  - lo financiero sin aprobación;
  - aprobar una cosa y ejecutar otra;
  - una aprobación caducada o de otro alcance;
  - instrucciones dentro del mensaje del cliente.
- Corre con `pnpm test`, dentro del check obligatorio «typecheck · lint · test · build». Si una regresión rompe el set, el merge queda bloqueado.
- **Pendiente para más adelante:**
  - los sets con un modelo real y umbral llegan con el enrutador (paso 3, ADR 0033);
  - el de envenenamiento de memoria llega con la memoria (ADR 0024).

## Orden de implementación (un PR cada uno, con sus tests)

1. **2a · `agent-core`:**
   - tipos (clases de efecto y autonomía, los mismos que el catálogo);
   - JSON canónico y `input_hash`;
   - `defineSkill()` con los campos reservados;
   - resolución del destino;
   - el motor de políticas.

   Sin base de datos.
2. **2b · Base de datos y comprobación al ejecutar:**
   - `agent_runs`, `executions` y `approvals` con RLS, las guardas y pgTAP (también en negativo: decidir sin rol, fuera de alcance, sin `aal2`, caducada, cambiar la entrada o el hash, decidir dos veces);
   - el evento `approval.decided`, en el catálogo del worker;
   - `verifyApproval()` en `agent-core`, una función pura. El worker la llamará justo antes de ejecutar cuando exista el runtime que ejecuta skills (con B19). Cablear ahora el worker con `agent-core` obligaría a cambiar la imagen, el CI y Railway para un código que nadie llama todavía.
3. **2c · Evals de ataque deterministas** en `packages/evals` contra 2a y 2b, en el CI.

## Alternativas consideradas

- **Atar la aprobación al ID de la ejecución y no al contenido.** Si la entrada cambia por un error o por un camino que la reescribe, se ejecutaría algo distinto de lo aprobado sin que nadie lo note. El hash cuesta muy poco y cierra ese hueco.
- **Calcular el hash en SQL** (`jsonb::text`). El orden de las claves de `jsonb` no es el de un JSON canónico, y dos implementaciones del mismo cálculo acaban divergiendo. Se calcula en un solo sitio (`agent-core`); la base de datos guarda los hashes, los hace inmutables y exige que coincidan.
- **Aprobar desde un enlace firmado** (por email o WhatsApp), sin sesión. Es cómodo, pero un enlace reenviado o filtrado aprueba en nombre de otro y se salta el `aal2`. El enlace puede llevar a la pantalla de aprobaciones; aprobar exige sesión.
- **Dejar que el LLM proponga destinatarios y validarlos después.** La validación tendría que ser perfecta en cada skill. Si el campo ni siquiera existe en la entrada, no hay nada que validar.
- **Evals de ataque solo con un modelo real.** No se pueden correr hasta que exista el enrutador, y dependen del azar del modelo. Las deterministas prueban el runtime ya, sin coste. Las de modelo prueban el prompt cuando llegue.

## Consecuencias

- Toda skill nueva pasa por `defineSkill()` y el motor. Una skill que no se ajuste falla en el registro o en el test estructural, no en producción.
- **Lo aprobado puede encontrarse otro estado al ejecutar.** Por ejemplo, el hueco de la cita ya está ocupado. El hash garantiza que se ejecuta exactamente lo aprobado, no que siga siendo posible: cada `execute` vuelve a comprobar sus condiciones y, si ya no se cumplen, falla con motivo en vez de improvisar.
- Hay un nuevo trigger `SECURITY DEFINER` que escribe en `domain_events`. Se explica en su PR y lleva tests en negativo (AGENTS.md, «Base de datos: guardas»).
- `contacts`, `conversations` y los consentimientos no existen aún: el runtime define sus interfaces y los tests usan dobles. Se conectan con B19.
- **Lo que este ADR no cubre todavía, y cuándo llega:**
  - que cada ID que proponga el LLM sea del tenant, del local y del contacto (control 3.1): con la primera skill;
  - el filtro de salida antes de responder al cliente (3.5): con Recepción (B19);
  - el «actúa con los permisos de quien lo pide» de la consola y el asistente (3.6): con ellos (ADR 0029);
  - las evals con un modelo real: con el enrutador (paso 3).

  Para clientes enterprise que lo pidan quedan como opción futura, por organización:
  - una doble aprobación (dos personas distintas) para importes altos;
  - umbrales de importe por rol.

## Verificación

Se completa con cada PR del orden de implementación:
- **2a (hecho):** 77 tests unitarios en `packages/agent-core`:
  - JSON canónico: orden de claves, Unicode, números y lo que rechaza;
  - el hash, contra un SHA-256 de referencia;
  - los campos reservados a cualquier profundidad y las claves abiertas;
  - cada salida del motor;
  - el destino;
  - que las clases de efecto y los techos coinciden con la migración del catálogo.

  13 mutaciones, cada una quita un control: sin la comprobación de campos reservados, sin el techo, sin el filtro de consentimiento, el hash sin el destino… Todas hacen fallar algún test, salvo una que no modela un fallo real: la entrada de esa skill no tiene ningún campo de contacto del que leer;
- **2b (hecho):**
  - **pgTAP `22_runs_approvals`, 66 tests:**
    - coherencia al crear: otra organización, otro local, otro hash, otra clase, nacer aprobada o caducada, aprobaciones de toda la organización;
    - inmutabilidad también para la service role: entrada, destino, hash, skill, caducidad y rol;
    - la plataforma (service role y dueño de las tablas) no aprueba;
    - quién ve qué;
    - la app no crea, no borra ni cambia ejecuciones;
    - decidir según rol, alcance y `aal2`;
    - solo cambia el estado (no `decided_by` ni otras columnas);
    - una decisión no se repite ni se deshace;
    - caducidad;
    - el evento, sin datos personales;
    - separación de funciones;
    - la auditoría de cada decisión.

    15 mutaciones de la migración, una por control: todas hacen fallar algún test. Las dos de alcance sobrevivían al principio porque la RLS de lectura ya oculta los otros locales; se añadieron tests directos de `can_decide_approval`.
  - **`verifyApproval`, 17 tests unitarios,** y 4 mutaciones, todas detectadas;
- **2c (hecho):** `packages/evals`, set de ataque determinista con 25 casos en 7 categorías:
  - otro tenant o local;
  - destinatarios colados por la entrada (también con un homoglifo);
  - skills o argumentos fuera de lo permitido;
  - lo financiero o destructivo sin aprobación;
  - aprobar una cosa y ejecutar otra (también con los dos hashes forjados);
  - aprobaciones que no valen;
  - consentimiento.

  Cada caso es el mensaje que llevaría al modelo a proponer la llamada y lo que tiene que pasar. Umbral del 100 %, dentro de `pnpm test`. 11 mutaciones de `agent-core`, cada una quita un control: todas ponen el set en rojo.
