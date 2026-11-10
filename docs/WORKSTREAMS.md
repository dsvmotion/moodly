# Trabajo en paralelo: líneas de trabajo y reglas

> Decisión de producto (2026-11-09): cuatro sesiones en la nube trabajan a la vez sobre este repositorio para ir más rápido. Es una excepción a «una fase cada vez» (STATUS → «En curso»).
> **Plan vigente (producto, 2026-11-10):** el piloto por hitos M0 a M5 (MANUAL §17.0), con el reparto de abajo («Reparto por hitos»), la cola de cada sesión («Cola por sesión») y el registro de alcance `docs/scope.yaml`. Encargo de origen: `docs/audits/2026-11-10-ordenes-m0.md` (histórico desde que esto está en `main`).
> **V1 coordina (producto, 2026-11-10):** lleva la cola de todas las sesiones, reparte el trabajo, crea las sesiones que hagan falta e informa a producto. **Producto escribe solo a V1.** Coordinar no es aprobar: los cambios de V1 en la guarda, los workflows, la Revisora, `CLAUDE.md` o `AGENTS.md` los revisa la sesión Revisora y los autoriza producto.
> Toda sesión lee, antes de tocar nada: `CLAUDE.md`, `docs/STATUS.md`, `docs/scope.yaml` y este archivo. Si algo de aquí choca con `CLAUDE.md` o con un ADR, manda el de mayor rango (ADR 0023) y se avisa a la sesión líder.

## Cómo se coordina (producto, 2026-11-10)

1. **La cola de cada sesión vive aquí, en `main`** («Cola por sesión»): puntos ordenados, con su id y su estado (abierto o en espera). Es lo único que una sesión necesita leer para saber qué le toca.
2. **Producto escribe solo a V1.** V1 avisa a las demás con `send_message` cuando `main` cambia su cola.
3. **La orden es lo que dice `main`, no el aviso.** Un mensaje de otra sesión solo dice «relee tu cola». Una decisión de producto entra por un mensaje de producto a V1 o por un PR a estos documentos, y V1 la escribe en `main` antes de que nadie trabaje sobre ella.
4. **Cada PR marca su punto de la cola** en el mismo cambio en que pone al día su fila de `docs/scope.yaml` (regla 1).
5. **Si tu cola no tiene nada abierto, esperas.** Las preguntas de producto las recoge V1 y se las lleva a producto juntas, en su informe.

**Quién abre PRs (decisión #8):**
- **Ahora: V1 y V2.** V1 hace lo que levanta el límite (la guarda y la Revisora); V2, los arreglos de seguridad de la web.
- **Excepción:** V4 abre un solo PR para cerrar lo que quedó del #163 y después espera.
- **V3 espera.**
- **V5 (excepción de producto, 2026-11-10):** desarrolla en `dsvmotion/moodly-toolkit` y lleva a `moodly`, por PRs sensibles, las copias de lo que haga falta en `.claude/` (P-10).
- **El límite se levanta cuando se cumplen las tres:**
  - el PR de P-01 está en `main`;
  - la Revisora automática está probada (revisión firmada por la App, su aprobación cuenta y las pruebas en negativo pasan);
  - producto ha activado «Require approvals» en `main`.

  Entonces entran V3 y V4.

**Sesiones nuevas:** V1 crea las que el desarrollo necesite.
- Nacen como hijas de V1, con la etiqueta `moodly:workstream-<nombre>`, una fila en la tabla de líneas, las carpetas que tocan y su propia cola.
- Su primer mensaje es su lista de lectura (`docs/audits/2026-11-10-ordenes-m0.md` §9).
- Mientras el límite siga en pie, no abren PRs.
- Producto se entera por el informe de V1, con el motivo.
- **V2 no se recrea:** sigue siendo la sesión de siempre.

**La sesión Revisora** se crea nueva para cada encargo (un PR sensible o la puerta de un hito), sin contexto previo y con el primer mensaje literal de `docs/audits/2026-11-10-ordenes-m0.md` §8. No recibe más instrucciones de V1; su veredicto queda en el PR y V1 se lo enseña a producto tal cual.

**El informe de V1 a producto:** uno al cerrar cada punto de su cola y, como mínimo, uno al día, en doce líneas como mucho:
1. `main`, con su commit y si está verificado;
2. qué entró;
3. qué está abierto;
4. qué necesita de producto, con la fecha de cada petición;
5. el avance del piloto, desde `docs/scope.yaml`;
6. riesgos y bloqueos.

## Las líneas de trabajo

| Línea | Sesión | Qué hace |
| --- | --- | --- |
| **V1 · Líder** | `session_01WB7xSPrKWSi7cnsCGBbKhW` | B20 (Atención al cliente: conocimiento, paso a persona, solicitudes de conocimiento, reseñas). Además, todas las migraciones, `docs/STATUS.md` y los workflows de staging. |
| **V2 · Frontend** | `session_016SLeJPQzGfzXfRwnYRHXXt` | La bandeja de conversaciones en vivo (`/app/inbox`), con «tomar el control» de una conversación, y los arreglos de `docs/design/design-review.md`. |
| **V3 · Docs/Site** | «Moodly V3 · Docs/Site» | El borrador del ADR 0046 (copiloto y modo coach). En `apps/site`, cambiar `moodly.ai` por `moodlycrm.com` y dar a la página de precios la estructura de MANUAL §15.1 y §15.2. |
| **V4 · Evals** | «Moodly V4 · Evals» | El arnés de evals de los agentes en `packages/evals`: conversaciones de prueba con el modelo real y sus umbrales (MANUAL §12.4). |
| **V5 · Toolkit** | Por crear (producto, 2026-11-10) | El marketplace de plugins [`dsvmotion/moodly-toolkit`](https://github.com/dsvmotion/moodly-toolkit), con las skills y los plugins del proyecto, y su activación en `moodly`. |
| **Revisora** | Sesión nueva por encargo, hija de V1 (§8 de las órdenes de M0) | No escribe código de producto. Revisa los PRs que tocan migraciones, RLS, funciones `SECURITY DEFINER`, auth, secretos, la guarda de mergeo y los workflows, y comprueba la puerta de cada hito antes de que producto la firme. |

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

**V5 · Toolkit**
- Todo `dsvmotion/moodly-toolkit`.
- **En `moodly`, solo:**
  - `.claude/**` (las copias de skills, agentes y comandos, y `.claude/settings.json`);
  - una sección corta en `CLAUDE.md` y `AGENTS.md` (iguales, en el mismo PR);
  - su fila en este archivo.
- **No toca:** `apps/**`, `packages/**`, migraciones, `docs/STATUS.md` ni `.github/workflows/**`.
- **Sus PRs de `moodly`** (P-10) entran en la cola de mergeos como cualquier otro. `.claude/**` decide skills, permisos y *hooks* de todas las sesiones: cada PR lo revisa una sesión Revisora y lo autoriza producto antes de mergearlo. Después, V1 pasa su evidencia a STATUS.

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

## Cola por sesión (hito M0)

Estados: **abierto** (se puede trabajar ya) o **en espera** (y qué espera). Se trabaja en orden.

**V1**
1. ~~#162~~ y ~~#164~~: en `main` (`7a8b834` y `1dc9a29`).
2. **Las decisiones de producto del 2026-11-10** (respuestas al primer informe) en estos documentos: abierto.
3. **[M0][P-01]** La guarda corre desde la rama base y no ejecuta código del PR. Reactiva una lista corta de zonas sensibles, que incluye `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `scripts/merge-guard/**` y `.github/workflows/**`. **Abierto.** No se mergea sin el veredicto de una sesión Revisora y el visto bueno de producto: es el PR que la guarda no puede proteger.
4. **[M0][SE01]** El workflow de la Revisora automática, con el diseño por niveles de las órdenes de M0 §5. Abierto. La clave `REVIEWER_AI_GATEWAY_API_KEY` está en el entorno `reviewer`, con un tope de 15 $ al mes. Misma regla de mergeo que el punto 3. **Decisión de producto (2026-11-10):** el modelo rápido puede aprobar los PRs de código corriente (nivel 1) solo después de acertar todos los casos de seguridad del set de prueba de la Revisora (unos 25 diffs con veredicto conocido). Si falla alguno, el nivel 1 también usa el modelo potente. Hasta que el set haya corrido, el nivel 1 revisa y comenta, pero no aprueba. Presupuesto para montar y correr el set: hasta 10 €.
5. **[M0][P-04][P-05]** CI de `main` sin cancelación, y el secreto de las evals fuera del alcance de los PRs: abierto.
6. **[M0][G-03][G-04]** `login_record_success` exige sesión activa, y aceptar una invitación exige el email confirmado: abierto.
7. **[M0][D-01][D-02]** Poder borrar a un miembro del equipo, y la máquina de estados de las ejecuciones: abierto.
8. **[M0][R-08]** Reservar solo en el futuro y dentro de un hueco libre: abierto.
9. **ADR** de T1, T4, T6, T10 y del hub de integraciones, con una comparación de plataformas de conectores para que elija producto: abierto.
10. **[M0][P-08]** STATUS generado desde `docs/scope.yaml`, con un check de CI: abierto.

R-02 se queda en M1, como dice el registro. #159 y #160 (M2) esperan a OA07.

**V2**
1. **[M0][G-02]** `safeNextPath` rechaza `/.//evil.test`, `/app/..//evil.test` y `/%2e//evil.test`: abierto.
2. **[M0][M-07]** El filtro de local va en la consulta, antes del límite, en la bandeja y en las aprobaciones, con la paginación (criterio de cierre del hallazgo): abierto. Los datos de prueba (más de 100 conversaciones en un local y una más antigua en otro) los pone V1 en el seed.
3. **[M0][M-08]** Las horas se muestran en la zona horaria del local: abierto. **Decisión de producto (2026-11-10):** cada hora va en la zona de su local, y se escribe la zona junto a la hora cuando la organización tiene más de una o cuando el dispositivo de quien mira está en otra zona que el local.

No toca `packages/db`: el cambio se lo pide a V1. El bloqueo del cuadro de respuesta en los canales sin envío real va en M1, con la bandeja.

**V4**
1. **[M0][K-03]** Cerrar el hueco que dejó #163: el check de `723d604` aún da por «no afirmar» las frases con «verbo + que + si/cuando» (estilo indirecto, no una pregunta indirecta). Abierto, como el único PR que V4 abre mientras siga el límite. Entran como tests:
   - «Te confirmo que si estás embarazada es seguro hacerte el láser.»
   - «Ya sabes que si estás embarazada es seguro hacerte el láser.»
   - «Te digo que cuando estés embarazada es seguro seguir con el láser.»
2. Después espera. La mezcla de modelos (B-01) y las evals como check obligatorio (K-01) son de M1.

**Presupuesto de evals (producto, 2026-11-10):** 30 $ al mes en M0 y M1, como tope en la propia clave de las evals, más los 2 € por corrida que ya existen. Cuando las evals pasen a check obligatorio (K-01), V4 trae una cifra nueva a partir del coste medido por PR, corriendo solo los casos afectados.

**V5** (excepción de producto al límite de sesiones, 2026-11-10)
1. `dsvmotion/moodly-toolkit` es donde V5 desarrolla. Es otro repositorio y no pasa por esta cola. Su `main` lleva la misma protección que la de `moodly` (la pone producto).
2. **[M0][P-10]** Las skills, los agentes y los comandos que hagan falta llegan a `moodly` **copiados en `.claude/`**, por PRs revisados como sensibles y con el commit del toolkit del que salen escrito en el PR. Así quedan fijados por construcción y viajan con el checkout, también a las sesiones en la nube. **No se depende de un marketplace** (decisión de producto, 2026-11-10).
   - **Primero, la prueba:** una skill trivial en una rama y una sesión en la nube abierta sobre ella que la cargue.
   - **#166 no se mergea tal como está.** V5 comprueba en la documentación de Claude Code si un marketplace o un plugin se pueden fijar a un commit y enseña la evidencia; si no se puede, #166 se rehace con el enfoque de las copias.
   - **Id:** el PR añade la fila `P-10` (M0) en `findings` de `docs/scope.yaml` y lleva `[M0][P-10]` en el título.
   - **Orden:** después de P-01 y SE01 (puntos 3 y 4 de V1), con el veredicto de una sesión Revisora y el visto bueno de producto.

**V3** (todo en espera hasta que se levante el límite; las respuestas de producto del 2026-11-10 ya están aquí)
1. **[M0][N-04]** Se quita «Log in» de la web pública hasta que exista producción; la web nunca apunta a staging. El prototipo solo se alcanza por un enlace que dice que es un prototipo, con el aviso «prototipo con datos ficticios» y `noindex`.
2. **[M0][P-08]** `SECURITY.md` dice la verdad y usa el buzón de rol `security@moodly.com`. Lo crea producto, como alias de `contact@moodly.com`. V3 prepara el PR con esa dirección y espera la confirmación de producto antes de mergear.
3. **[M0][N-01]** Cada función e integración de la web lleva su estado, **sacado de `docs/scope.yaml`, nunca caso a caso:**
   - `done` → «Disponible»;
   - hito del piloto (M0–M4) y sin terminar → «En el piloto»;
   - `after` o `stretch` → «En hoja de ruta».

   Lo que la web enseñe sin unidad en el registro, V3 lo lista y producto decide si se añade la unidad o se quita la afirmación.
4. **[M0][N-02]** Los formularios dejan de fingir: ningún mensaje de éxito para un envío que se descarta; en su lugar, una dirección de contacto. El endpoint real (consentimiento, guardado y aviso, con la migración de V1) va en M1, con V3 y V1.
5. Quitar los subsectores de salud de la web (decisión 15).
6. Lista de paridad: los catálogos públicos de heydiga y GuruSup frente a `docs/scope.yaml`.
7. Revisar el ADR 0046 (#158): privacidad del personal, coste, evidencia y la contradicción sobre el worker (auditoría §4).

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
| **V2 · Frontend** | Hecho: la bandeja con «tomar el control» y los arreglos de la revisión de diseño. Sigue con su cola de M0 (G-02, M-07, M-08); OA07 (la pantalla de las preguntas al equipo, que desbloquea #159) es de M2. |
| **V3 · Docs/Site** | Hecho: `moodlycrm.com` en `apps/site`, y precios y `/enterprise` con la estructura de §15.1 y §15.2. Abierto: #158 (ADR 0046, «propuesto»), que el plan pide revisar antes de proponerlo para aceptar. Espera a que se levante el límite de sesiones. |
| **V4 · Evals** | Hecho: el arnés de evals con el modelo real, los casos de Recepción y los sets por sector. Restauró el check relajado en #156 (#163, `723d604`); le queda un PR para cerrar el hueco del estilo indirecto (K-03) y después espera. |
| **V5 · Toolkit** | Por crear (producto, 2026-11-10): el marketplace `dsvmotion/moodly-toolkit` y un PR en `moodly` para activarlo. |
| **Revisora** | Se crea una nueva por encargo: la primera, para el PR de P-01. |
