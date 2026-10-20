# 0029 — Asistente (orquestador): una interfaz que actúa con los permisos del usuario, no un actor con permisos propios

- **Estado:** propuesto
- **Fecha:** 2026-10-20
- **Secciones del MANUAL afectadas:** §5 (nuevo §5.13), §9.4, §10.1, §17
- **Relación:** `docs/design/edge-y-postura-enterprise.md` §3.bis, `mapa-pantallas-datos.md` §3 y §7, ADR 0022 (permisos)

## Contexto

El prototipo incluye un **Asistente** (`/plataforma/asistente`): un meta-agente que configura, opera, diagnostica y enseña la plataforma por conversación. Puede cambiar agentes, reglas, integraciones y límites de uso. Es la pieza con más riesgo de seguridad del diseño:

- un LLM que **cambia la configuración** de la plataforma;
- su catálogo de herramientas está «pendiente de especificar»;
- si el worker lo ejecuta con la *service role*, un `staff` podría pedirle lo que él mismo no puede hacer (*confused deputy*, hallazgo 3.6 de la revisión de seguridad del 2026-10-20);
- una inyección (por ejemplo, en un documento de conocimiento que el asistente lee) podría acabar en un cambio de configuración.

Además no figuraba en el MANUAL ni en la hoja de ruta.

## Decisión

### 1. El asistente no tiene permisos propios

- Se ejecuta en `apps/web`, en el servidor, **con la sesión del usuario** (su JWT y RLS). Nunca con la *service role* ni en el worker.
- Sus herramientas son **las mismas Server Actions** que usa la interfaz, con la misma validación Zod, `requireUser()` y comprobación de permisos (ADR 0022). Si el usuario no puede hacerlo pulsando botones, el asistente tampoco.

### 2. Catálogo de herramientas cerrado

- Lista blanca en código: cada herramienta declara el **permiso** que exige y si es de **lectura** o de **cambio**.
- **Fuera del catálogo, siempre:** seguridad (MFA, SSO, SCIM, sesiones), roles y permisos, techos de autonomía, secretos y claves (BYOK), facturación y plan, borrado de datos, y reglas de plataforma. Esas pantallas solo se tocan a mano.

### 3. Proponer, enseñar y confirmar

- Toda herramienta de cambio produce primero una **vista previa** (qué cambia, antes → después).
- El cambio solo se aplica cuando el usuario pulsa **confirmar** en la interfaz. La confirmación queda atada al **hash de la vista previa** (igual que las aprobaciones, hallazgo 3.3): si algo cambia entre ver y confirmar, se vuelve a pedir.
- Cada cambio queda en `audit_logs` con `actor_type = user`, el usuario real y `via = assistant`.

### 4. Lo que lee el asistente es dato, no instrucción

El contenido de conocimiento, conversaciones o memorias que lea se marca como no confiable (§5.3). Ninguna herramienta de cambio se puede encadenar sin una confirmación humana por medio.

### 5. Fases

- **Fase 2:** solo **lectura y diagnóstico** («¿por qué el agente no respondió a este cliente?», «¿qué gasté este mes?») y **enseñar** (explicar y llevar a la pantalla).
- **Fase 3:** herramientas de cambio del catálogo, con el flujo del punto 3.
- Evals propias: intentos de escalada («dame permisos de admin»), inyección desde documentos y cambios fuera de alcance. Criterio que bloquea el merge: cero cambios aplicados sin confirmación y cero herramientas fuera del permiso del usuario.

## Alternativas consideradas

- **Asistente en el worker con permisos propios y comprobación de rol en el motor de políticas** — funciona, pero duplica el modelo de permisos y es justo el *confused deputy* que se quiere evitar.
- **Sacarlo del producto** — es un diferenciador real para pymes sin equipo de IT; con estas reglas el riesgo queda acotado.

## Consecuencias

- Entra en la hoja de ruta (§17): lectura en Fase 2, cambios en Fase 3.
- El catálogo de herramientas se define en un PR propio, con su revisión humana, antes de construir.

## Verificación

- Test: un usuario `staff` pide al asistente un cambio de `org_admin` y la herramienta falla por RLS o por permisos.
- Evals del punto 5 en CI.
