# Auditoría total, segunda pasada — 2026-10-23

> Tercera pieza del día, tras `2026-10-23-auditoria-estado.md` (R-16…R-28) y `2026-10-23-auditoria-frontend.md` (F-1…F-12).
> - **Qué hace:** repasa todo después de aplicar los arreglos (#60–#66), anota lo nuevo (R-29…R-37) y propone el orden para la revisión de mañana.
> - **Rango:** histórico (`docs/audits/`). Manda el estado de `docs/STATUS.md`.

## 0. Resumen

**Hecho hoy, mergeado y con CI en verde sobre el commit exacto:**

| PR | Qué | Hallazgos |
|---|---|---|
| #60 | El MFA protege también las lecturas en la capa de datos. Con la contraseña sola ya no se lee nada por la API de Supabase. Migración aplicada en staging por el CI. | R-16 (alta) |
| #61 | Rutas canónicas del ADR 0023, sección Agentes con sus 4 ventanas, una entrada por destino, logotipo. Arreglo del orden de ⌘K. | F-1, F-5, F-6, F-12 |
| #62 | Menú de usuario desplegable. | F-4 |
| #63 | Ajustes como área P6: 13 secciones en 5 grupos. Mi perfil y Preferencias nuevas; las pendientes dicen qué habrá y con qué llega. | F-3, F-10 |
| #64 | Login y segundo paso con marca, traducidos (es/en). | F-7 |

**En PR, verificados en local:**

| PR | Qué | Hallazgos |
|---|---|---|
| #65 | Inicio (P1) como destino tras entrar. | F-2 |
| siguiente | Código para desactivar el MFA, 5xx fuera del freno, cookies `Secure`, cookies de sesión `httpOnly`. | R-21, R-23, R-24, R-29 |

**Lo que más pesa ahora:**
1. **Nadie puede ver la app en staging** (R-34). El diseño ya está en `staging.moodlycrm.com`, pero no hay usuarios. Es una decisión de producto, y desbloquea la revisión de mañana.
2. **Los *previews* de Vercel siguen compilando con las claves de servidor de staging** (R-18). Hoy se han empujado seis ramas, varias veces cada una, y cada empuje ha generado un *preview* con esas claves. Sube de prioridad: es el primer paso de B5 y se hace en dos minutos.
3. **Producto:** sigue sin código de agentes, memoria, objetivos ni coach (R-28). Con el frontend ya en su sitio, la fase D es lo siguiente con más valor.

## 1. Cómo se ha verificado
- **Cada PR:**
  - `pnpm typecheck`, `lint`, `test` y `build` en local;
  - e2e completo contra Supabase local con las 9 migraciones (de 103 a 117 tests, según la rama);
  - `check-sensitive.sh`;
  - los 5 checks del CI sobre el commit exacto antes del squash con `expectedHeadSha`.
- **Tras cada merge:** CI de `main` en verde (#60, #61, #62; #63 y #64 en curso al escribir esto).
  - Despliegue de Vercel en `staging.moodlycrm.com`: comprobado el de #61. `/app/agentes/reception` sin sesión lleva al login, con la CSP con nonce y HSTS.
  - Migración `mfa_reads` en staging: historial 9/9, igual al del repo.
- **Fallos encontrados por el camino** (todos corregidos antes del merge):
  - un patrón de URL con la ruta vieja;
  - el orden de grupos de cmdk;
  - el caso especial de `isActive`;
  - el radio controlado de Preferencias;
  - `signIn()` atado al español;
  - el botón de enviar ambiguo en la página del código;
  - los 7 casos de `next` malicioso que esperaban la URL vieja.

## 2. Estado por área

| Área | Estado | Pendiente |
|---|---|---|
| **Datos y RLS** | 28 políticas con `session_is_active()`, que ahora exige aal2 a quien tiene un factor. Escrituras de administración con aal2. pgTAP 455. | R-20 (privilegios que sobran). Guarda de columnas en `public.users` (R-35). |
| **Auth** | Freno del login y del MFA, MFA obligatorio para administrar y para leer. Con el PR de seguridad: código para desactivar el MFA, 5xx fuera del freno y cookies de sesión `httpOnly`/`Secure`. | Auth como código en el proyecto alojado (R-17). Códigos de recuperación del MFA. Recuperar contraseña (con B4). |
| **Web** | Rutas canónicas, navegación única, menú de usuario, Ajustes P6, Inicio, login con marca, es/en, axe en claro y en oscuro, CSP con nonce. | Pantallas de negocio (P2, P3, P5, P7) con sus tablas (fase D). Atajos `g i`/`g a`. Barra inferior en móvil (F-9). Acciones en la barra superior (F-8). |
| **CI/CD** | 5 checks obligatorios, mergeo con `expectedHeadSha`, despliegue de migraciones a staging solo desde el CI. | `main` sin protección (plan de GitHub). Entorno `staging` sin restringir a `main` (R-18b). |
| **Staging** | Supabase `eu-central-1` y Vercel `fra1` en `staging.moodlycrm.com`, 9/9 migraciones. | Primer usuario (R-34). Claves fuera de Preview (R-18a). Plan de Vercel (R-19). *Log drain* y alertas. |
| **Observabilidad** | Logs JSON con censura y seudónimos, eventos de seguridad. | Sentry (B1b), ya desbloqueado: el hook de Semgrep (R-26) dejó de actuar al reiniciarse la sesión. |
| **Producto** | 4 agentes de serie visibles con su ventana, «Sin configurar». | Fase D: catálogo de agentes, *spike* de DBOS, worker, primera skill, memoria y objetivos (R-28). |
| **Documentación** | STATUS al día con cada PR; tres auditorías hoy. | MANUAL §3.2 y ADRs por redactar (R-27). |

## 3. Hallazgos nuevos

| # | Hallazgo | Gravedad | Propuesta |
|---|---|---|---|
| R-29 | **Cookies de sesión de Supabase legibles desde JavaScript.** `@supabase/ssr` las pone por defecto con `httpOnly: false` y sin `Secure`. Un XSS podría llevarse el token; la CSP con nonce lo dificulta, pero no debe ser la única barrera. | Media | **Corregido en el PR de seguridad.** `httpOnly` (el navegador nunca habla con Supabase: no hay cliente de navegador y `connect-src 'self'`) y `Secure` por https, en los dos clientes de servidor. e2e: ninguna cookie es legible desde JS. |
| R-30 | **Pasadas de e2e locales seguidas fallaban por estado y no por código.** Dos causas. (1) **De proceso (del agente):** `pnpm db:seed` necesita la CLI de Supabase en el `PATH`; en varias pasadas no estaba, el seed fallaba al arrancar sin cambiar nada y su salida iba a `/dev/null`, así que el estado no se limpiaba (de ahí el MFA de `guest_mfa` que seguía activo). (2) **Del seed:** no vaciaba el freno del login, y tres pasadas en menos de 15 minutos superan los 20 fallos por email de `guest_mfa_throttle`. El CI no se ve afectado porque parte de cero. | Baja | **Corregido en el PR de higiene:** el seed vacía los fallos del freno de sus usuarios con TOTP (`login_record_success`, como un login con éxito). Prueba en negativo: sin el cambio, la tercera pasada seguida falla; con él, pasan las tres. Y comprobar siempre la salida del seed. |
| R-31 | **El e2e local depende de la *build* exacta del navegador de Playwright.** En el entorno del agente hubo que lanzarlo con una configuración temporal fuera del repo para usar el Chromium instalado. | Baja | **Corregido en el PR de higiene:** `playwright.config.ts` acepta `CHROMIUM_PATH` (como ya hace el script de los iconos de la PWA), documentado en AGENTS.md. |
| R-32 | **Textos huérfanos y sin test de paridad.** `sidebarEmpty.agents`, `nav.locations` y `nav.people` ya no se usan. Hoy es y en tienen las mismas claves (comprobado), pero nada lo vigila. | Baja | **Corregido en el PR de higiene:** borrados, y un test unitario comprueba que es y en tienen las mismas claves y ningún texto vacío. |
| R-33 | **cmdk 1.1.1 no reordena los grupos** al buscar: los busca por su id en `data-value`, donde guarda el título. | Info (resuelto) | `orderGroupsBySearch()` en `packages/ui`, con tests. Quitarlo cuando cmdk lo arregle (vigilar al actualizarlo). |
| R-34 | **Staging sin usuarios.** El diseño ya se ve en `staging.moodlycrm.com`, pero solo hasta el login: no hay a quién enseñárselo. | Media (bloquea la revisión de producto) | Decisión de producto. Propuesta: (1) producto crea su usuario en el panel de Supabase de staging; (2) un workflow manual del CI crea la organización de demo con sus locales y le da la membership de `org_admin`, sin service role en la app y sin migraciones a mano. |
| R-35 | **`public.users` no tiene guarda de columnas.** Con `users_update_self`, cada persona puede cambiar cualquier columna de su fila, también `created_at` y `locale`. Las guardas son listas blancas (ADR 0003) y esta tabla no tiene ninguna. | Baja | Guarda `guard_users_*` con solo `full_name` (y `locale`) editables por la propia persona, con pgTAP en negativo. Va antes de hacer editable «Mi perfil», junto a R-20. |
| R-36 | **Ramas apiladas y *previews*.** Para no bloquearse, hoy se han encadenado PRs (rutas → menú → Ajustes → login → Inicio → seguridad), rebasando cada rama sobre `main` tras cada merge con el árbol idéntico comprobado. Funciona, pero cada empuje genera un *preview* con las claves de staging (R-18). | Info | Mantener el procedimiento (rebase con `--onto` y `git diff` vacío como prueba) y resolver R-18 antes de seguir apilando. |
| R-37 | **Todos los textos de la app viajan al navegador en cada página**, también en el login sin sesión (`NextIntlClientProvider` recibe el catálogo entero; comprobado en `staging.moodlycrm.com/login`). No hay secretos, pero pesa cada vez más y enseña textos internos antes de entrar. | Baja | Pasar al cliente solo los espacios de nombres que usan sus componentes cliente (`pick` por ruta, o mensajes por *layout*: acceso y app). |

## 4. Hallazgos de la primera pasada (R-16…R-28)

| # | Estado |
|---|---|
| R-16 | Hecho (#60), verificado en `main` y en staging. |
| R-17 | Paso 1 hecho (#68): el diff encontró 16 diferencias en el alojado. Paso 2 en curso: `config push` desde el despliegue, aprobado por producto. Sesiones sin caducidad hasta el plan Pro. |
| R-18 | **Abierto, sube de prioridad** (R-36): (a) claves de servidor fuera de Preview; (b) entorno `staging` restringido a `main`. |
| R-19 | Abierto: confirmar el plan de Vercel (producto). |
| R-20 | Abierto: revocar los privilegios que sobran. Cambia aserciones de los tests de privilegios, así que irá en un PR explicado, con R-35. |
| R-21, R-23, R-24 | Hecho (#66), con R-29. |
| R-22 | Abierto: el token de la invitación, fuera de la query (con B4, los emails). |
| R-25 | Corregido (proceso). |
| R-26 | Resuelto: el hook de Semgrep dejó de actuar al reiniciarse la sesión. Desbloquea Sentry (B1b) y R-17. |
| R-27 | Abierto: MANUAL §3.2 y ADRs. |
| R-28 | Abierto: decisión de producto (D antes que C). |

## 5. Orden propuesto para mañana
1. **Decisiones de producto** (desbloquean el resto):
   - primer usuario de staging (R-34; propuesta en §3);
   - plan de Vercel (R-19);
   - D antes que C (R-28);
   - visto bueno al diseño en staging, en cuanto haya usuario.
2. **B5, higiene de staging:**
   - R-18a: quitar `LOGIN_THROTTLE_KEY` y `LOG_PSEUDONYM_KEY` del entorno Preview de Vercel (confirmado hoy: están en Production y Preview). Los *previews* no necesitan login: sin clave, el login falla cerrado y los logs omiten el seudónimo.
     - **Lo hace producto en el panel:** Settings → Environment Variables → editar cada una → desmarcar Preview.
     - El agente no lo hace por API: son variables *sensitive*. Si la edición exigiera reenviar el valor, se perdería, y habría que rotar la clave y registrar su hash, que solo puede hacer una persona o el CI.
   - R-18b: restringir el entorno `staging` de GitHub a `main`.
   - *Log drain* y alertas en cuanto se confirme el plan.
3. **B1b, Sentry:** `@sentry/nextjs` con *tunnel* propio, sin datos personales, sin *replay* y con `tracesSampleRate` 0. El proyecto y el DSN ya están.
4. **B3:**
   - R-17 (Auth como código);
   - R-20 + R-35 (privilegios y guarda de `users`), y con ellos «Mi perfil» editable.
5. **Higiene de desarrollo:** R-30, R-31 y R-32, ya en su PR (el siguiente al de seguridad).
6. **Fase D** (si producto la confirma antes que la C):
   - catálogo de agentes (ADR 0030);
   - *spike* de DBOS y worker en Railway;
   - controles previos a la primera skill (`tenantDb(orgId)`, aprobaciones atadas al hash, destinatarios fijados por el runtime, evals de ataque);
   - memoria con procedencia y objetivos.
   - La ventana de agente (P5) y Aprobaciones son las primeras pantallas de negocio, ya con su ruta.
