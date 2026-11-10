# Trabajo en paralelo: líneas de trabajo y reglas

> Decisión de producto (2026-11-09): cuatro sesiones en la nube trabajan a la vez sobre este repositorio para ir más rápido. Es una excepción a «una fase cada vez» (STATUS → «En curso»).
> **Plan vigente (producto, 2026-11-10):** el piloto por hitos M0 a M5 (MANUAL §17.0), con el reparto de abajo («Reparto por hitos») y el registro de alcance `docs/scope.yaml`. **Hasta cerrar la guarda y la revisión (P-01 y P-02, hito M0), como mucho dos sesiones abren PRs a la vez, más la revisora** (decisión de producto #8); cuáles, lo dice producto.
> Toda sesión lee, antes de tocar nada: `CLAUDE.md`, `docs/STATUS.md`, `docs/scope.yaml` y este archivo. Si algo de aquí choca con `CLAUDE.md` o con un ADR, manda el de mayor rango (ADR 0023) y se avisa a la sesión líder.

## Las líneas de trabajo

| Línea | Sesión | Qué hace |
| --- | --- | --- |
| **V1 · Líder** | `session_01WB7xSPrKWSi7cnsCGBbKhW` | B20 (Atención al cliente: conocimiento, paso a persona, solicitudes de conocimiento, reseñas). Además, todas las migraciones, `docs/STATUS.md` y los workflows de staging. |
| **V2 · Frontend** | `session_016SLeJNZPWnhbVqF81AjXMe` | La bandeja de conversaciones en vivo (`/app/inbox`), con «tomar el control» de una conversación, y los arreglos de `docs/design/design-review.md`. |
| **V3 · Docs/Site** | «Moodly V3 · Docs/Site» | El borrador del ADR 0046 (copiloto y modo coach). En `apps/site`, cambiar `moodly.ai` por `moodlycrm.com` y dar a la página de precios la estructura de MANUAL §15.1 y §15.2. |
| **V4 · Evals** | «Moodly V4 · Evals» | El arnés de evals de los agentes en `packages/evals`: conversaciones de prueba con el modelo real y sus umbrales (MANUAL §12.4). |
| **Revisora** | Sesión independiente (la designa producto) | No escribe código de producto. Revisa los PRs que tocan migraciones, RLS, funciones `SECURITY DEFINER`, auth, secretos, la guarda de mergeo y los workflows, y comprueba la puerta de cada hito antes de que producto la firme. |

## Qué carpetas toca cada una

**V1 · Líder**
- `packages/db/**`: todas las migraciones, pgTAP, el seed y los tipos (`database.types.ts`).
- `apps/worker/**`, `packages/agent-core/**`, `packages/skills/**` y `packages/knowledge/**`.
- La pantalla de conocimiento: `apps/web/src/app/app/knowledge/**` (B20-3).
- `docs/STATUS.md`, `docs/MANUAL.md` y los ADR nuevos (salvo el 0046).
- `.github/workflows/**` y `scripts/**`.

**V2 · Frontend**
- `apps/web/**`, salvo `apps/web/src/app/app/knowledge/**`.
- `packages/ui/**` (compartida, ver abajo).

**V3 · Docs/Site**
- `apps/site/**`.
- `docs/adr/0046-*.md`: el borrador, con estado «propuesto»; lo acepta producto.
- `docs/design/**`.

**V4 · Evals**
- `packages/evals/**`. `src/embeddings` es la eval de los embeddings del ADR 0048: se puede ampliar, no cambiar lo que mide.
- Si el arnés necesita algo de `agent-core` o del worker (por ejemplo, exportar el prompt o el turno), lo pide a V1.

**Revisora**
- No escribe en `apps/**` ni en `packages/**`. Solo comenta en los PRs y, si hace falta, añade en `docs/audits/**` el informe de la puerta de un hito.
- **Qué revisa:** todo PR que toque `packages/db/supabase/migrations/**`, políticas RLS, funciones `SECURITY DEFINER`, auth (`apps/web/src/lib/auth/**`, `config.toml`), secretos, `scripts/merge-guard/**` o `.github/workflows/**`.
- **Cómo:** lee el diff y los tests; deja en el PR «Revisado por la revisora (`<sha>`)» con lo que comprobó, o los cambios que pide. Un PR de esos no se mergea sin ese comentario sobre su commit actual; en migraciones, RLS, auth y la guarda, además, con el visto bueno de Diego (decisión de producto #7).
- **Puertas:** antes de cerrar un hito, comprueba cada punto de su puerta (MANUAL §17.0) con evidencia y lo deja escrito para que lo firme producto.

**Compartidas: con cuidado.** Cambios pequeños, en su propio commit, explicados en el PR y rebasados sobre `main` justo antes de abrirlo:
- `packages/ui`: componentes de todas las pantallas. Se añade y no se rompe; un cambio de API se avisa a V1.
- `packages/config`: marca, modelos y precios. Un modelo nuevo o un cambio de modelo es de V1.
- i18n (`apps/web/messages/*.json` y los textos de `apps/site`): cada uno añade sus claves en su sección, sin reordenar ni renombrar las de otros.
- `CLAUDE.md` y `AGENTS.md`: iguales siempre, en el mismo PR. Solo para documentar un comando nuevo (por ejemplo, el de las evals).
- `pnpm-lock.yaml`: solo con `pnpm install`, nunca a mano. Si dos PRs lo tocan, el segundo lo regenera al rebasar.

## Reglas

1. **Cada PR lleva en el título el id de su unidad o hallazgo** y pone al día su fila en `docs/scope.yaml`:
   - **el formato:** el hito y después la unidad o el hallazgo, entre corchetes, por ejemplo `[M0][P-01] La guarda corre desde la rama base` o `[M3][RC7] Señal o política de no presentarse al reservar`;
   - **la fila de una unidad:** `status` y `evidence` (PR, test o corrida de evals). Una unidad pasa a `done` solo si cumple el `done_when` de su área y con evidencia;
   - **un hallazgo:** su fila en la sección `findings` del registro (id, estado y evidencia); si no la tiene, la añade;
   - **añadir, quitar o mover una unidad es decisión de producto.**
2. **Una rama por PR abierto, una tarea por PR.** PRs pequeños, rebasados sobre `main` justo antes de abrirlos. Tras un merge (squash), la tarea siguiente empieza en una rama nueva desde `main`; no se reutiliza la rama mergeada.
3. **Solo V1 crea migraciones.** Si una línea necesita un cambio de esquema, se lo pide a V1 con lo que necesita y para qué. Construye encima cuando la migración esté mergeada. Ejemplo: el estado de «tomar el control» para la bandeja de V2.
4. **Solo V1 edita `docs/STATUS.md`.** Cada PR lleva su evidencia (tests, capturas, logs); después del merge, V1 la pasa a STATUS.
5. **Solo V1 lanza los workflows de staging** (Actions → «Staging · …» y el despliegue a mano). Leer su resultado sí puede hacerlo cualquiera.
6. **Mergeos de uno en uno**, con el procedimiento de `CLAUDE.md` → «Mergeo autónomo»: CI en verde sobre el commit exacto, sin tests debilitados, squash con `expectedHeadSha` y el comentario de evidencia. **El turno lo da V1:** toda sesión, también una que no sea V1–V4, pide turno a V1 antes de mergear y avisa al terminar. Además:
   - **Antes de mergear:**
     - tu rama contiene el `main` actual; si `main` se movió, rebasa, empuja y espera al CI otra vez;
     - el último PR mergeado en `main` tiene su comentario «✅ Verificado sobre main». Si no lo tiene, espera: alguien está comprobando `main`.
   - **Después de mergear,** quien mergea comprueba `main` antes de que nadie más mergee:
     - `pnpm check`, `pnpm test:db` y el e2e (y la integración, si tocó el worker);
     - lee el resultado de «Despliegue a staging» y, si tocó el worker, que el de Railway arrancó.

     Después publica en su PR «✅ Verificado sobre main (`<sha>`)» con lo que corrió. Si algo falla, lo arregla o revierte enseguida y avisa a V1.
7. **Las preguntas de producto son de producto (Diego), nunca las decide una sesión.** La sesión se para en ese punto, pregunta en su propia conversación y avisa a V1 de que está bloqueada.
8. **Nada de credenciales, cuentas ni proveedores inventados** (`CLAUDE.md` → «Prohibido»). Llamar al modelo de verdad cuesta dinero: en las evals, con el presupuesto que diga producto.

## Orden de los mergeos

- Por orden de llegada, de uno en uno (regla 6), con dos excepciones:
  - las migraciones de V1 van primero cuando otra línea espera por ellas;
  - un PR que deja `main` en rojo se arregla o se revierte antes que nada.
- **Lo que pasó (2026-11-09 y 2026-11-10):** este documento, B20-2 y la migración de «tomar el control» entraron primero, como estaba previsto; después, de uno en uno y con «✅ Verificado sobre main» entre cada uno: V1 (#138, #139, #141, #144, #146, #148, #150, #151, #153, #159, #160), V2 (#143, #147, #154), V3 (#140, #157, #158), V4 (#142, #152, #155, #156) y dos PRs de sesiones fuera de las cuatro (#145 y #149). **Desde el 2026-11-10, mergeos en pausa** por el plan nuevo de producto (#161): quedan #159, #160 (V1) y #158 (V3). La lista con los commits está en STATUS → «Estado a 2026-11-10».
- **Números de ADR:** el 0046 es de V3. Para cualquier otro, se pide el número a V1.

## Reparto por hitos (producto, 2026-11-10)

Fuente: auditoría de preproducción §19.4. Las unidades de cada hito, con su responsable, están en `docs/scope.yaml`.

| Línea | M0 | M1 | M2 | M3 | M4 |
| --- | --- | --- | --- | --- | --- |
| **V1** (base de datos, worker, agentes, CI) | Guarda desde la rama base; arreglos de diseño; ADR; registro de alcance | Acceso del worker a los datos; capa de canales; hub de integraciones; enrutador y libro de consumo; operación | Recepción y Atención al cliente a punto; lote A; enmascarado | Skills de Ventas y Administración; lote B; claves por organización; borrado; trazas | Catálogo de herramientas del asistente; flujo del coach; memoria con procedencia; lote C |
| **V2** (web, UI) | Arreglos de redirección, alcance y zona horaria | Tomar el control; contadores; chat web; base del tiempo real | Capacidades de la app del dueño de M2 | Capacidades de M3; diseño para el teléfono | Panel del asistente; objetivos y coach; sugerencias de autonomía |
| **V3** (web pública, docs) | Honestidad de la web (aviso, `noindex`, afirmaciones); `SECURITY.md`; lista de paridad de integraciones | Textos legales con la asesoría; catálogo con el estado real | Ayuda para la configuración | Página de confianza; lista de subencargados; ficha del piloto | Borrador del caso de éxito; mantener los ADR |
| **V4** (evals) | La corrección de las evals (#152, ya en `main`); restaurar el check de seguridad relajado en #156 | Experimento de la mezcla de modelos; evals como check obligatorio | Sets de varios turnos de Recepción y Atención al cliente | Sets de Ventas y Administración; set de ataque; puntuación nocturna | Sets del asistente y del coach; métrica de tasa de resolución |
| **Revisora** | Revisa los PRs de gobierno (guarda, identidad, workflows) y la puerta de M0 | Revisa los sensibles y la puerta de M1 | Ídem, M2 | Ídem, M3, con la lista de salida a producción | Ídem, M4 |
| **Producto** | Identidad del agente y reglas de rama; sociedad; marca; asesoría legal; empezar la verificación de Meta | Supabase Pro; DPAs de los proveedores; carta de intención del piloto; elegir la plataforma de conectores | Claves de API y contratos del cliente piloto | Firmar el DPA con el piloto; decidir si se arranca | Revisión del piloto; decisión de precios |

## Qué se le cuenta a V1

Con `send_message` a `session_01WB7xSPrKWSi7cnsCGBbKhW`, un mensaje corto:
- **PR mergeado:** número, commit de `main`, «✅ Verificado sobre main» o qué falló, y la evidencia que V1 debe pasar a STATUS.
- **Bloqueo:** qué falta (una migración, una decisión de producto, una credencial) y desde cuándo.
- **Petición de esquema:** tabla o función, columnas, quién lee y quién escribe, y para qué pantalla o flujo.
- Nada más: ni avances ni resúmenes intermedios.

## Estado de las líneas (auditoría del 2026-11-10)

Lo asignado antes del plan nuevo está hecho; desde el 2026-11-10 cada línea sigue con su columna de M0 en «Reparto por hitos».

| Línea | Estado |
| --- | --- |
| **V1 · Líder** | B20-1 a B20-4a mergeados y verificados (conocimiento, búsqueda, pantalla de conocimiento, reindexado y preguntas al equipo en la base de datos). Abiertos: #159 (`ask_team`, espera la pantalla del equipo, OA07) y #160 (después, sin el texto de los borradores en el prompt). Sigue con M0. |
| **V2 · Frontend** | Sesión nueva desde el 2026-11-10 (`session_016SLeJNZPWnhbVqF81AjXMe`, hija de V1, por decisión de producto); la anterior la archiva producto. Hecho: la bandeja con «tomar el control» y los arreglos de la revisión de diseño. Sigue con M0 y con OA07 (la pantalla de las preguntas al equipo), que desbloquea #159. |
| **V3 · Docs/Site** | Hecho: `moodlycrm.com` en `apps/site`, y precios y `/enterprise` con la estructura de §15.1 y §15.2. Abierto: #158 (ADR 0046, «propuesto»), que el plan pide revisar antes de proponerlo para aceptar. Sigue con M0. |
| **V4 · Evals** | Hecho: el arnés de evals con el modelo real, los casos de Recepción y los sets por sector. Sigue con M0: restaurar el check de seguridad relajado en #156. |
| **Revisora** | Por designar (producto). |
