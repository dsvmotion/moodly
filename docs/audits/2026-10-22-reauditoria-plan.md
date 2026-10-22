# Re-auditoría de plataforma y plan actualizado — 2026-10-22

> Sustituye al plan de trabajo de la auditoría backend del 2026-10-21 (entregada en el chat, fases A–E y decisiones D1–D8) y actualiza el «Orden de trabajo propuesto» de `2026-10-20-revision-seguridad-plataforma.md`. Rango de este documento: `docs/audits/` (histórico). Lo que manda sigue siendo ADR > MANUAL > diseño (ADR 0023).

## 0. Resumen

**Fase A (seguridad de los cimientos): cerrada salvo el MFA obligatorio.** Entre el 21 y el 22 entraron en `main`:

| PR | Qué cierra | Hallazgo |
|---|---|---|
| #41 | Organizaciones suspendidas o archivadas sin acceso | P0-2 |
| #47 | gitleaks con `pull-requests: read` (el check de seguridad fallaba en todos los PRs) | CI |
| #48, #49 | Mergeo autónomo sin revisión humana hasta el primer dato real (decisión de producto) | Proceso |
| #16 | Equipo interno (`platform_staff`), `audit_logs` de solo inserción y acceso JIT con MFA (`support_grants`, aal2, ≤ 8 h) | 2.4, ADR 0021 D8/D12 |
| #36 | Freno del login con clave de servidor: un anónimo ya no puede bloquear cuentas ajenas | 1.1, P0-1 |
| #50 | **Nuevo:** `next` ≤ 16.4.0 con ejecución remota de código sin autenticar (crítico) → 16.4.2; `vitest` 5.0.5 | R-1 |
| #37 | Invitaciones con consentimiento; fuera el alta directa de memberships; rechaza organizaciones suspendidas | 2.2, P0-3 |

**Riesgos abiertos, por orden:**
1. **Escribir como `org_admin` no exige MFA** (2.3, P0-6). Es lo siguiente.
2. **Ninguna observabilidad** (8.1): sin errores centralizados, sin logs estructurados, sin alertas. La cuenta de Sentry ya existe (región UE, `de.sentry.io`).
3. **Ningún entorno alojado.** Todo lo verificado es local + CI. Las cuentas existen; faltan los conectores de Supabase y Vercel en esta sesión (ver §4).
4. **Datos reales bloqueados** hasta: Supabase Pro en la UE con copias (2.5), revisión humana reactivada y `main` protegida (8.2), DPAs.
5. **Worker vacío** (`apps/worker/src/index.ts`): el control 3.2 (`tenantDb`) y el *spike* de DBOS (ADR 0027) van antes de la primera skill.

## 1. Método y evidencia

Sobre `main` (`b15a62f`, tras #37). Verificación: pgTAP 406/406, `db lint` limpio, `pnpm check` 52/52 y e2e 95/95. Además:
- Inventario de funciones de `public` y `private` (modo, `search_path`, permisos de EXECUTE) consultando `pg_proc` en la base local.
- `grep` dirigido en `apps/web/src` y `packages/*/src`: Zod, logs, `throw` con mensajes concatenados, `.limit(1)`, paginación, salud.
- `packages/db/supabase/config.toml` (API, Auth, sesiones, límites).
- `pnpm audit`, estado de los PRs de Dependabot, workflows de CI.
- Cuentas conectadas (solo lectura): Railway, Sentry, WorkOS, Resend, Hostinger.

## 2. Estado por área

### 2.1 Base de datos y RLS

| Punto | Estado |
|---|---|
| RLS activado y forzado en todas las tablas de `public`; toda política empieza por `session_is_active()` | ✔ test estructural `00_rls_enabled` |
| Funciones `SECURITY DEFINER`: 13 en `private` + 4 en `public` (`login_throttle`, `login_record_failure`, `login_record_success`, `register_server_key`) + `accept_invitation` | ✔ todas con `search_path = ''`; `register_server_key` solo `service_role`; las del freno exigen la clave de servidor; `accept_invitation` con 12 tests en negativo |
| Escrituras desde `SECURITY DEFINER` en tablas de tenants | Solo `accept_invitation` (explicada en #37). `login_record_failure` escribe en `private.login_attempts` |
| Organizaciones suspendidas | ✔ helpers con `org_is_active` (#41); `accept_invitation` también (#37) |
| Equipo interno | ✔ lectura solo con aal2 y concesión JIT vigente (#16) |
| **Escrituras de `org_admin` sin aal2** | ✘ **P0-6** |
| `graphql_public` expuesto en la API (`config.toml`) | Abierto (R-5, baja): RLS aplica igual, pero es superficie que no se usa |
| `max_rows = 1000` + listados sin paginar | Abierto (P1-1): `records-data.ts` trunca en silencio a partir de 1.000 filas |

### 2.2 Web (`apps/web`)

| Punto | Estado |
|---|---|
| `requireUser()` con `getUser()` en páginas y acciones | ✔ |
| CSP con nonce, cabeceras OWASP | ✔ (#29) |
| Freno del login | ✔ (#36); falta Turnstile (cuenta de Cloudflare conectada) |
| **MFA: no hay alta de TOTP ni paso de código en el login** | ✘ P0-6 (Auth lo tiene activado desde #30, pero no hay interfaz) |
| Rol con `.limit(1)` en `scope-data.ts` (multi-organización) | Abierto (1.6) |
| `throw new Error(\`…${error.message}\`)` (4 sitios) | Abierto (1.5) |
| Validación con Zod en Server Actions | Abierto: no se usa Zod en ningún sitio |
| Errores y trazas centralizados | ✘ (8.1) |
| Login sin traducir, Inicio (P1) como destino tras el login | Pendiente de la tarea 4 |
| Invitaciones: el enlace se copia a mano | Pendiente (Resend) |

### 2.3 CI, cadena de suministro y proceso

| Punto | Estado |
|---|---|
| 5 checks obligatorios sobre el commit exacto + `check-sensitive.sh` | ✔ |
| **Un aviso publicado deja `main` vulnerable sin que el CI lo vea** hasta el siguiente PR | **R-2 (media)** → workflow diario de `pnpm audit` (este PR) |
| Dependabot: #42 (gitleaks-action v3) y #44 (setup-cli v3), mayores sin revisar; #43 y #45 pendientes; #46 cerrado (Node 24 fija `@types/node` 24) | R-11: rebase tras #50 y revisar los mayores con su CI |
| El job `sensitive-paths` lee la lista de la rama del PR | R-13: leerla de la rama base cuando se reactive la revisión humana |
| `main` sin protección técnica (GitHub Free) | Bloqueado (8.2) |
| El e2e del CI tarda ~20 min cuando la instalación de Playwright es lenta (9 min en un run) | R-12 (baja): caché de navegadores |
| `docs/STATUS.md` desfasado (decía que producto revisa y mergea los PRs) | R-3: reescrito en este PR |

### 2.4 Infraestructura y cuentas (consultado hoy, solo lectura)

| Cuenta | Estado | Para qué |
|---|---|---|
| Supabase | Conectada en claude.ai, **desactivada en esta sesión** | Proyecto de staging en la UE |
| Vercel (Pro) | Conectada en claude.ai, **desactivada en esta sesión** | `apps/web` en `fra1` |
| Railway | Conectada; 0 proyectos | Worker (cuando exista: tarea 6) |
| Sentry | Organización en la región UE (`de.sentry.io`); 1 proyecto ajeno (`python`) | Errores de `apps/web` y del worker |
| WorkOS | Entornos Staging (sandbox) y Production | *Spike* del ADR 0022 |
| Resend | 0 dominios | Email transaccional (invitaciones) |
| Hostinger | `moodly.com` y otros dominios activos | DNS de staging y de email |
| Cloudflare | Conectada | Turnstile |
| Meta for Developers | Sin conector | WhatsApp (ADR 0020) |

## 3. Hallazgos nuevos

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| R-1 | `next` ≤ 16.4.0: ejecución remota de código sin autenticar (2 avisos críticos) y denegación de servicio con Server Actions (alto). Publicados el 22, ponían en rojo el check de seguridad de todos los PRs | **Crítica** | Cerrado (#50) |
| R-2 | Sin revisión programada de dependencias: `main` puede quedarse vulnerable días sin que nadie lo vea | Media | Este PR: `security-daily.yml` |
| R-3 | `STATUS.md` desfasado frente al proceso real | Media | Este PR |
| R-4 | `accept_invitation` (`SECURITY DEFINER`) admitía altas en organizaciones suspendidas | Media | Cerrado (#37) |
| R-5 | `graphql_public` expuesto sin uso | Baja | Plan (A3) |
| R-11 | PRs mayores de Dependabot sin revisar | Baja | Plan (A4) |
| R-12 | CI lento por la instalación de Playwright | Baja | Plan (A4) |
| R-13 | La guarda lee su lista desde la rama del PR | Media cuando se reactive | Condición de salida a producción |
| R-14 | El seed falla en ~5 % de las ejecuciones: las contraseñas del equipo interno (`randomBytes(18)` en base64url) a veces no tienen dígito, y la política de contraseñas lo exige. Afecta también al e2e del CI | Media (CI intermitente) | Este PR: mismo sufijo `aA1` que el resto de usuarios |
| R-15 | Supabase Auth: dos verificaciones de MFA simultáneas de la misma persona chocan (*deadlock*, HTTP 500), y verificar el factor cierra las demás sesiones aal1 de esa persona | Info (afecta al diseño de A2) | A2 reintenta los 5xx sin contarlos en el freno; los e2e serializan el paso «contraseña → código» por usuario |

## 4. Plan actualizado

Regla que no cambia: una fase no avanza hasta que la anterior está mergeada, verificada sobre `main` y anotada en `STATUS.md`.

### Fase A — cerrar la seguridad de los cimientos (en curso)
- **A1 ✔** #41, #47, #48, #49, #16, #36, #50, #37.
- **A2 · P0-6 MFA obligatorio para administrar.** RLS: toda escritura de `org_admin` (organizations, regions, locations, memberships, invitations) exige `aal2`; los managers no cambian. Web: alta de TOTP en Ajustes → Seguridad (QR + código), paso del código tras la contraseña, y `requireUser()` que manda al paso de MFA a quien tiene un factor y sesión aal1. Seed: los `org_admin` con TOTP (secreto solo en `credentials.local.json`). Tests: pgTAP aal1 frente a aal2 por cada política y e2e del alta y del login con código.
- **A3 · higiene de la web.** Organización activa explícita (1.6), paginación de Registros (P1-1), errores sin concatenar (1.5), Zod en las Server Actions, `graphql_public` fuera de la API (R-5).
- **A4 · CI.** Revisión diaria de dependencias (este PR), Dependabot (#42–#45) y caché de Playwright.

### Fase B — staging alojado y operación
- **B1 · Observabilidad.** Sentry en `apps/web` (región UE, *tunnel* propio para no abrir la CSP, sin datos personales) y logs estructurados con `organization_id` y `trace_id`. Alertas mínimas: ráfagas de fallos de login, accesos del equipo interno, cambios de rol.
- **B2 · Staging.** Proyecto de Supabase en la UE y proyecto de Vercel (`fra1`) en `staging.<dominio>` (DNS en Hostinger). Migraciones con `supabase db push` desde el CI, nunca a mano. **Necesita** activar los conectores de Supabase y Vercel en esta sesión y decidir el dominio (ver «Decisiones»).
- **B3 · Auth de producción (3c-2)** en el proyecto alojado: límites, `jwt_expiry`, sesiones (el *timebox* necesita Pro), Turnstile, `LOGIN_THROTTLE_KEY` registrada.
- **B4 · Email transaccional** con Resend (dominio verificado con SPF/DKIM/DMARC): la invitación llega por email.

### Fase C — identidad enterprise
- *Spike* de WorkOS (ADR 0022) contra su entorno Staging: login, MFA, SSO de prueba, revocación inmediata y los tests de aislamiento en verde.

### Fase D — runtime de agentes
- Catálogo `agent_types`/`agents`/`skills` (tarea 5, ADR 0030).
- *Spike* de DBOS (ADR 0027) y worker en Railway (tarea 6).
- `tenantDb(orgId)` con regla de lint (3.2), aprobaciones atadas al hash (3.3), destinatarios fijados por el runtime (3.4) y evals de ataque antes de activar ningún agente (3.8).

### Fase E — canales e integraciones
- WhatsApp Cloud API (ADR 0020; falta la cuenta de Meta), webhooks firmados (7.1), OAuth (7.2).

### Condiciones de salida a producción (sin cambios, más R-13)
Supabase Pro en la UE con copias y una restauración probada; revisión humana reactivada (migraciones, RLS, `SECURITY DEFINER`, auth, secretos y la guarda) con la lista leída de la rama base; `main` protegida; DPAs; DPIA si el piloto es una clínica.

## 5. Decisiones que necesito de producto
1. **Activar los conectores de Supabase y Vercel en esta sesión** (están conectados en claude.ai pero desactivados aquí). Sin ellos no puedo crear el staging.
2. **Dominio del producto:** `moodly.com` (activo desde 2024) frente a `moodlycrm.com`/`moodlycrm.cloud`. Propuesta: `moodly.com`, con `staging.moodly.com` para staging y un subdominio de envío para el email.
3. Email de seguridad para `SECURITY.md` (sigue bloqueado).
4. Cuándo pasar a Supabase Pro y GitHub Team (copias de seguridad y protección de `main`).
