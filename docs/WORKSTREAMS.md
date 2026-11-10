# Trabajo en paralelo: líneas de trabajo y reglas

> Decisión de producto (2026-11-09): cuatro sesiones en la nube trabajan a la vez sobre este repositorio para ir más rápido. Es una excepción a «una fase cada vez» (STATUS → «En curso»).
> Toda sesión lee, antes de tocar nada: `CLAUDE.md`, `docs/STATUS.md` y este archivo. Si algo de aquí choca con `CLAUDE.md` o con un ADR, manda el de mayor rango (ADR 0023) y se avisa a la sesión líder.

## Las líneas de trabajo

| Línea | Sesión | Qué hace |
| --- | --- | --- |
| **V1 · Líder** | `session_01WB7xSPrKWSi7cnsCGBbKhW` | B20 (Atención al cliente: conocimiento, paso a persona, solicitudes de conocimiento, reseñas). Además, todas las migraciones, `docs/STATUS.md` y los workflows de staging. |
| **V2 · Frontend** | `session_016SLeJPQzGfzXfRwnYRHXXt` | La bandeja de conversaciones en vivo (`/app/inbox`), con «tomar el control» de una conversación, y los arreglos de `docs/design/design-review.md`. |
| **V3 · Docs/Site** | «Moodly V3 · Docs/Site» | El borrador del ADR 0046 (copiloto y modo coach). En `apps/site`, cambiar `moodly.ai` por `moodlycrm.com` y dar a la página de precios la estructura de MANUAL §15.1 y §15.2. |
| **V4 · Evals** | «Moodly V4 · Evals» | El arnés de evals de los agentes en `packages/evals`: conversaciones de prueba con el modelo real y sus umbrales (MANUAL §12.4). |

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

**Compartidas: con cuidado.** Cambios pequeños, en su propio commit, explicados en el PR y rebasados sobre `main` justo antes de abrirlo:
- `packages/ui`: componentes de todas las pantallas. Se añade y no se rompe; un cambio de API se avisa a V1.
- `packages/config`: marca, modelos y precios. Un modelo nuevo o un cambio de modelo es de V1.
- i18n (`apps/web/messages/*.json` y los textos de `apps/site`): cada uno añade sus claves en su sección, sin reordenar ni renombrar las de otros.
- `CLAUDE.md` y `AGENTS.md`: iguales siempre, en el mismo PR. Solo para documentar un comando nuevo (por ejemplo, el de las evals).
- `pnpm-lock.yaml`: solo con `pnpm install`, nunca a mano. Si dos PRs lo tocan, el segundo lo regenera al rebasar.

## Reglas

1. **Una rama por PR abierto, una tarea por PR.** PRs pequeños, rebasados sobre `main` justo antes de abrirlos. Tras un merge (squash), la tarea siguiente empieza en una rama nueva desde `main`; no se reutiliza la rama mergeada.
2. **Solo V1 crea migraciones.** Si una línea necesita un cambio de esquema, se lo pide a V1 con lo que necesita y para qué. Construye encima cuando la migración esté mergeada. Ejemplo: el estado de «tomar el control» para la bandeja de V2.
3. **Solo V1 edita `docs/STATUS.md`.** Cada PR lleva su evidencia (tests, capturas, logs); después del merge, V1 la pasa a STATUS.
4. **Solo V1 lanza los workflows de staging** (Actions → «Staging · …» y el despliegue a mano). Leer su resultado sí puede hacerlo cualquiera.
5. **Mergeos de uno en uno**, con el procedimiento de `CLAUDE.md` → «Mergeo autónomo»: CI en verde sobre el commit exacto, sin tests debilitados, squash con `expectedHeadSha` y el comentario de evidencia. **El turno lo da V1:** toda sesión, también una que no sea V1–V4, pide turno a V1 antes de mergear y avisa al terminar. Además:
   - **Antes de mergear:**
     - tu rama contiene el `main` actual; si `main` se movió, rebasa, empuja y espera al CI otra vez;
     - el último PR mergeado en `main` tiene su comentario «✅ Verificado sobre main». Si no lo tiene, espera: alguien está comprobando `main`.
   - **Después de mergear,** quien mergea comprueba `main` antes de que nadie más mergee:
     - `pnpm check`, `pnpm test:db` y el e2e (y la integración, si tocó el worker);
     - lee el resultado de «Despliegue a staging» y, si tocó el worker, que el de Railway arrancó.

     Después publica en su PR «✅ Verificado sobre main (`<sha>`)» con lo que corrió. Si algo falla, lo arregla o revierte enseguida y avisa a V1.
6. **Las preguntas de producto son de producto (Diego), nunca las decide una sesión.** La sesión se para en ese punto, pregunta en su propia conversación y avisa a V1 de que está bloqueada.
7. **Nada de credenciales, cuentas ni proveedores inventados** (`CLAUDE.md` → «Prohibido»). Llamar al modelo de verdad cuesta dinero: en las evals, con el presupuesto que diga producto.

## Orden de los mergeos

- Por orden de llegada, de uno en uno (regla 5), con dos excepciones:
  - las migraciones de V1 van primero cuando otra línea espera por ellas;
  - un PR que deja `main` en rojo se arregla o se revierte antes que nada.
- **Lo que pasó (2026-11-09 y 2026-11-10):** este documento, B20-2 y la migración de «tomar el control» entraron primero, como estaba previsto; después, de uno en uno y con «✅ Verificado sobre main» entre cada uno: V1 (#138, #139, #141, #144, #146, #148, #150, #151, #153, #159, #160), V2 (#143, #147, #154), V3 (#140, #157, #158), V4 (#142, #152, #155, #156) y dos PRs de sesiones fuera de las cuatro (#145 y #149). **Desde el 2026-11-10, mergeos en pausa** por el plan nuevo de producto (#161): quedan #159, #160 (V1) y #158 (V3). La lista con los commits está en STATUS → «Estado a 2026-11-10».
- **Números de ADR:** el 0046 es de V3. Para cualquier otro, se pide el número a V1.

## Qué se le cuenta a V1

Con `send_message` a `session_01WB7xSPrKWSi7cnsCGBbKhW`, un mensaje corto:
- **PR mergeado:** número, commit de `main`, «✅ Verificado sobre main» o qué falló, y la evidencia que V1 debe pasar a STATUS.
- **Bloqueo:** qué falta (una migración, una decisión de producto, una credencial) y desde cuándo.
- **Petición de esquema:** tabla o función, columnas, quién lee y quién escribe, y para qué pantalla o flujo.
- Nada más: ni avances ni resúmenes intermedios.

## Estado de las líneas (auditoría del 2026-11-10)

| Línea | Estado |
| --- | --- |
| **V1 · Líder** | B20-1 a B20-4a mergeados y verificados (conocimiento, búsqueda, pantalla de conocimiento, reindexado y preguntas al equipo en la base de datos). En espera por la pausa: #159 (`ask_team`) y #160. Después, B20-4c (la pantalla de preguntas del equipo). |
| **V2 · Frontend** | Terminado: la bandeja en vivo con «tomar el control» y los arreglos de la revisión de diseño. Sin PRs abiertos. Sus preguntas de producto, en STATUS. |
| **V3 · Docs/Site** | Terminado: `moodlycrm.com` en `apps/site`, precios y `/enterprise` con la estructura de §15.1 y §15.2, y el ADR 0046 en estado «propuesto» (#158, en espera por la pausa; lo acepta producto). |
| **V4 · Evals** | Terminado: el arnés de evals con el modelo real, los casos de Recepción y los sets por sector. Sin PRs abiertos. Sus preguntas de producto (modelo, presupuesto y si el check pasa a obligatorio), en STATUS. |
