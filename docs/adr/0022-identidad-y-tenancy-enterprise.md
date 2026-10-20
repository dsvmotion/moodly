# 0022 — Identidad, cuentas y permisos a escala enterprise

- **Estado:** propuesto (pendiente de decisión de producto en los puntos marcados **[DECIDIR]**)
- **Fecha:** 2026-10-21
- **Secciones del MANUAL afectadas:** §4.1 (jerarquía de tenants), §4.2 (`memberships`, `platform_staff`), §4.4 (RLS), §9.7 (`/ops`), §10.2 (autenticación y autorización)
- **Relación:** amplía ADR 0003 (RLS y guardas) y la tabla `platform_staff` de #16 (ADR 0021). Corrige el hallazgo 2.2 de `docs/audits/2026-10-20-revision-seguridad-plataforma.md`.

## Contexto

Hoy el modelo es `organization → region → location`. Hay 4 roles fijos (`org_admin`, `region_manager`, `location_manager`, `staff`) guardados en `memberships`, con el alcance en arrays. Un `org_admin` da de alta a una persona creando su membership directamente.

Para una pyme sobra. Para el cliente enterprise que queremos vender, no llega:

- **Grupos con varias empresas o cadenas** bajo una misma empresa matriz. Cada cadena tiene sus datos y su facturación, pero la dirección del grupo necesita ver varias, y el departamento de IT quiere gestionarlo todo desde un solo sitio.
- **Miles de usuarios** que entran con la cuenta de la empresa (SSO). Se dan de alta y de baja solos desde su directorio (SCIM), y su rol depende del grupo al que pertenecen en ese directorio (Entra ID, Okta, Google).
- **Administración delegada:** el responsable de una región gestiona a las personas de su región, y nada más.
- **Roles a medida:** «auditor de solo lectura», «facturación», «supervisor de turno»… Los 4 roles fijos no bastan.
- **Bajas inmediatas y verificables:** cuando alguien deja la empresa pierde el acceso al momento, también en las sesiones abiertas.
- **Garantías que piden los cuestionarios de seguridad:** MFA y SSO obligatorios, IP permitidas, auditoría exportable a su SIEM, revisiones periódicas de accesos y acceso del proveedor (nosotros) controlado y visible.

Así lo resuelven los productos enterprise de referencia: Slack Enterprise Grid, Atlassian Cloud, Google Workspace y Notion Enterprise. Todos tienen una **cuenta de empresa** por encima de los espacios de trabajo, **dominios verificados** que convierten a sus usuarios en «gestionados» por la empresa, **SSO y SCIM** a nivel de cuenta, y **roles compuestos de permisos**. Ese es el modelo que se propone.

## Decisión propuesta

### 1. Jerarquía: cuenta → organización → región → local

```
account (cuenta de empresa / grupo)          ← identidad, SSO, SCIM, políticas, facturación consolidada
 └── organization (tenant)                   ← frontera de datos: RLS, agentes, conocimiento, residencia
      └── region (opcional)
           └── location (local)
```

- **La organización sigue siendo la frontera de datos.** RLS, agentes, memoria, conocimiento e integraciones viven por organización, como hoy. La cuenta **no** concede acceso a datos por sí misma: solo identidad, políticas y administración.
- **Pyme:** una cuenta con una organización. La cuenta no se ve en la interfaz.
- **Grupo con varias cadenas:** una cuenta con N organizaciones. La dirección del grupo tiene acceso a varias organizaciones con roles asignados por regla (punto 4), no por un «superusuario».
- **Red de franquicias:** franquiciador y franquiciados son **organizaciones distintas** (cada franquiciado es responsable de sus datos), unidas por `networks`. La red solo comparte plantillas, políticas bloqueadas y **métricas agregadas** (sin datos personales), mediante funciones de lectura revisadas. Es lo que ya enseña el prototipo `/plataforma/red`.

### 2. Identidad: una persona, una identidad, varias organizaciones

- **Cada persona es una sola identidad** (`auth.users`) y puede pertenecer a varias organizaciones, con un selector de organización. La organización activa se valida en el servidor en cada petición; RLS no se fía del navegador.
- **Dominios verificados por cuenta** (registro TXT en el DNS). Los usuarios con email de un dominio verificado pasan a estar **gestionados**: la cuenta decide cómo entran (SSO obligatorio), sus altas y bajas, y sus sesiones.
- **Nunca se fusionan cuentas por coincidir el email** sin verificar el dominio, ni se crea una identidad nueva para un email que ya pertenece a otra cuenta gestionada.

### 3. SSO y SCIM a nivel de cuenta **[DECIDIR proveedor]**

| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| **A. Supabase Auth SAML + SCIM propio** | SAML 2.0 de Supabase (plan Pro: 50 usuarios con SSO incluidos y luego un precio por usuario activo al mes) y un endpoint SCIM 2.0 que construimos nosotros | Todo en un proveedor y coste bajo con pocos usuarios con SSO | Hay que construir, mantener y certificar SCIM con cada IdP, y una pantalla para que el IT del cliente lo configure |
| **B. WorkOS (SSO + Directory Sync + Admin Portal) como proveedor de identidad externo de Supabase** | Supabase acepta los tokens de WorkOS; WorkOS resuelve SAML/OIDC con cualquier IdP y la sincronización del directorio | El IT del cliente lo configura solo desde un portal; compatible con todos los IdPs del mercado; es el estándar del sector | Coste por conexión de cliente; un proveedor (y un subencargado) más |

**Recomendación:** B para el plan enterprise (el coste por conexión lo cubre el precio enterprise) y email con contraseña + MFA para las pymes. A queda como alternativa si el volumen de conexiones lo justifica. Antes de decidir hay que comprobar en el piloto cómo llegan a Supabase los grupos del directorio.

### 4. Autorización: permisos + alcance, materializados

- **Permisos atómicos** con nombre estable, por ejemplo:
  - `conversations.read`, `conversations.takeover`;
  - `approvals.decide`, `approvals.decide.financial`;
  - `agents.configure`, `agents.publish`, `knowledge.manage`;
  - `members.manage`, `roles.manage`, `billing.manage`, `audit.read`, `security.manage`, `data.export`.
- **Roles = conjuntos de permisos.** Roles de sistema: los 4 actuales, más «auditor (solo lectura)» y «facturación». Cada cuenta puede crear **roles a medida**, nunca por encima de los techos de plataforma: por ejemplo, ningún rol a medida puede aprobar lo financiero sin MFA.
- **Alcance:** cada asignación de rol lleva su ámbito: organización, una o varias regiones, o uno o varios locales.
- **Asignación por grupos del directorio:** «grupo `Moodly-Recepción-Madrid` de Entra ID → rol Recepción en los locales de la región Madrid». Las reglas viven en la cuenta y la sincronización SCIM crea y quita las asignaciones.
- **Permisos efectivos materializados:** la tabla `effective_permissions(user_id, organization_id, permission, region_id?, location_id?)` se recalcula con triggers cuando cambian roles, asignaciones o la estructura. Las políticas RLS consultan esa tabla con índice: el coste es el mismo con 10 usuarios que con 10.000.
  - Los permisos **no** se meten en el JWT: quedarían desfasados hasta que el token caducara, y una baja tiene que ser inmediata.
- **Rendimiento comprobado, no supuesto:** un test de carga con 10.000 usuarios, 2.000 locales y 50 organizaciones, con `EXPLAIN ANALYZE` de las consultas principales y un umbral en CI.

### 5. Altas: invitación con consentimiento o directorio

- **Invitación:** email con un enlace de un solo uso. En la base solo se guarda el hash del token, caduca a los 7 días y queda auditada. La membership **solo se crea cuando la persona acepta**, mediante una función revisada.
- **Dominio gestionado:** alta por SCIM o al primer inicio de sesión con SSO (*just-in-time*), con el rol que diga la regla de grupos o, si no hay regla, **sin acceso a ninguna organización** hasta que un admin lo asigne. Nunca se crea un admin automáticamente.
- Se elimina la vía de hoy (el admin escribe la membership directamente).

### 6. Bajas inmediatas y completas

Cuando el directorio da de baja a alguien, o un admin lo quita, en la misma transacción o en el mismo job:
1. se borran sus asignaciones y se recalculan sus permisos efectivos;
2. se revocan sus sesiones: Auth las cierra y `private.session_is_active()` ya corta en RLS cualquier token copiado;
3. se revocan sus claves de API personales y se invalidan sus invitaciones pendientes;
4. se reasignan sus aprobaciones pendientes y las conversaciones que tenía en modo humano;
5. queda una entrada en la auditoría con quién o qué lo dio de baja.

### 7. Administración delegada sin escalada

- **Niveles de administración:** admin de cuenta → admin de organización → admin de región o local. Cada uno gestiona personas y roles **solo dentro de su ámbito**.
- **Anti-escalada** (lo hace cumplir la base de datos): nadie puede conceder un permiso que no tiene, ni darse más permisos a sí mismo, ni quitar al último admin de cuenta.
- **Cambios en roles de administración:**
  - exigen MFA reciente (`aal2`);
  - se notifican a todos los admins de la cuenta;
  - si la cuenta lo activa, necesitan la aprobación de un segundo admin.
- **Mínimo dos admins de cuenta** y una **cuenta de emergencia** (*break-glass*) con MFA de llave física, fuera del SSO. Por si cae el IdP del cliente.

### 8. Políticas de seguridad por cuenta

Se configuran en la cuenta y las heredan sus organizaciones; se pueden bloquear para que una organización no las relaje:
- MFA obligatorio (para todos o por rol) y SSO obligatorio para los dominios gestionados;
- duración e inactividad de las sesiones;
- IPs permitidas, con excepción para la cuenta de emergencia;
- residencia de datos (ADR 0019) y retención de conversaciones y auditoría;
- exportar datos solo con el permiso `data.export` y siempre auditado.

### 9. Acceso del equipo interno (Moodly)

- **Acceso *just-in-time*:** el equipo interno pide acceso a una organización concreta, con un motivo y una caducidad (por defecto 4 h). Queda en la auditoría **del cliente**, que puede verlo.
- **Contenido de conversaciones:** solo en modo soporte. En el plan enterprise, el modo soporte necesita la **aprobación del cliente**.
- El equipo interno siempre con MFA de llave física y desde dispositivos gestionados.

### 10. Auditoría y revisiones de acceso

- Auditoría por cuenta y organización, de solo inserción. Se puede exportar a CSV o JSON y enviar en tiempo real al SIEM del cliente (webhook firmado o un bucket S3), con la retención de su plan.
- **Revisión de accesos trimestral:** un informe por cuenta con quién tiene qué permisos y su último acceso. El admin lo confirma o retira accesos, y queda registrado. Es lo que piden ISO 27001 y SOC 2.

## Alternativas consideradas

- **Mantener los 4 roles fijos y solo añadir SSO:** no cubre los roles a medida ni la delegación ni los grupos. Habría que rehacerlo con el primer cliente grande.
- **La cuenta como frontera de datos (una sola organización enorme):** mezcla los datos de empresas distintas de un mismo grupo y complica la residencia y la facturación por empresa. Descartada.
- **Permisos en el JWT:** más rápido, pero los permisos quedan desfasados hasta que el token caduca, y las bajas dejan de ser inmediatas. Descartada.
- **Un «superusuario de grupo» que ve todo:** rompe el mínimo privilegio y no deja rastro por organización. Se sustituye por asignaciones por regla, visibles en cada organización.

## Consecuencias

- **Tablas nuevas:** `accounts`, `account_domains`, `account_policies`, `organizations.account_id`, `roles`, `role_permissions`, `role_assignments` (sustituye a `memberships`), `group_role_rules`, `effective_permissions`, `invitations`, `networks`, `network_members`, `access_reviews` y `support_access_grants`.
- **Migración desde el modelo actual** en dos fases (ampliar y después contraer, MANUAL §14): cada membership de hoy se convierte en una asignación del rol de sistema equivalente con el mismo alcance. Los 186 tests pgTAP se mantienen y se amplían.
- **Todo esto es zona sensible** (migraciones, RLS, auth): un PR por bloque, con revisión humana.
- **Coste:** WorkOS por conexión enterprise (si se elige B) y SSO de Supabase por usuario activo. Se repercute en el plan enterprise.

## Verificación (antes de darlo por hecho)

- pgTAP por cada tabla y regla:
  - aislamiento entre organizaciones de la **misma** cuenta;
  - delegación sin escalada;
  - baja inmediata, con un token copiado que deja de leer al momento;
  - invitación caducada o ya usada.
- e2e:
  - SSO con un IdP de prueba;
  - alta y baja por SCIM;
  - selector de organización;
  - política de MFA obligatoria.
- Prueba de carga con 10.000 usuarios y 2.000 locales, con umbral en CI.

## Fuentes
- [Supabase — precios: SSO SAML 2.0 en el plan Pro](https://supabase.com/pricing)
- [Supabase — WorkOS como proveedor de identidad externo](https://supabase.com/docs/guides/auth/third-party/workos)
- [WorkOS — integración con Supabase (AuthKit)](https://workos.com/docs/integrations/supabase-authkit)
