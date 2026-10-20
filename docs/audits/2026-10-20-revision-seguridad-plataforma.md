# Revisión de seguridad de toda la plataforma — 2026-10-20

Petición de producto: revisar a fondo la seguridad de los cimientos y de todos los pilares (código, funcionamiento interno, rutas, usuarios, agentes, datos, modelos de IA e integraciones).

Complementa `2026-10-20-seguridad-cimientos.md`, que recoge los arreglos ya preparados en los PRs #28–#31.

**Cómo leerla.** Cada pilar dice qué existe ya **en código** (revisado línea a línea) y qué existe solo **en diseño** (MANUAL y ADRs). Hoy agentes, IA, conversaciones e integraciones son diseño. Para esos pilares, la revisión fija los **controles obligatorios antes de construirlos**: es mucho más barato meterlos desde el primer commit que añadirlos después.

Gravedad: **Crítica** (bloquea producción) · **Alta** (antes del primer cliente) · **Media** (antes de enterprise) · **Baja** (mejora).

## Resumen

- **Lo que ya existe está bien construido.** RLS forzado en todas las tablas, sesiones revocables de verdad, ninguna clave secreta en el navegador, redirecciones blindadas y la guarda de mergeo. Los 8 problemas de la primera revisión ya tienen PR (#28–#31).
- **Un hallazgo nuevo de gravedad alta en código:** el login no tiene freno contra la fuerza bruta (comprobado: 40 intentos fallidos sin bloqueo), y el límite por IP de Supabase no sirve porque el login pasa por el servidor (§1.1).
- **El diseño de agentes del MANUAL (§5 y §10) cubre lo esencial:**
  - tenant inyectado por el runtime;
  - motor de políticas antes de cualquier efecto;
  - techos de autonomía;
  - datos marcados como no confiables;
  - outbox;
  - evals de ataque.
- **Al diseño le faltan 14 controles concretos** (§3–§7): sobre todo la propiedad de *cualquier* identificador que proponga el LLM, aprobaciones atadas al contenido exacto, SSRF en la ingesta de webs, el *confused deputy* en BYOC de AWS y el aislamiento de servidores MCP de terceros.

---

## 1. Plataforma web y rutas (`apps/web`, en código)

| # | Hallazgo | Gravedad | Qué hacer |
|---|---|---|---|
| 1.1 | **Fuerza bruta en el login.** La app no tiene ningún freno propio. **Comprobado:** 40 intentos fallidos seguidos contra el Auth local, sin un solo bloqueo, y el login correcto de otro usuario sigue funcionando. Supabase alojado limita por IP, pero `signIn` se ejecuta en el servidor, así que todas las peticiones le llegan desde la IP del servidor: ese límite no distingue atacantes, y podría acabar bloqueando el login de todos a la vez. **Pendiente de comprobar en el proyecto alojado** (en local no aplica). | **Alta** | Límite propio por IP del visitante y por email: tabla y función en Postgres, sin servicios externos. Además, CAPTCHA (Cloudflare Turnstile) pasado a Supabase con `captchaToken`. Aviso al usuario tras N fallos. |
| 1.2 | Las cookies de preferencias no llevan `Secure`. | Baja | `secure: true` en producción. |
| 1.3 | Rutas: solo `/login` es pública; todo lo demás exige sesión en el proxy y otra vez en la capa de datos (`requireUser`). Probado. | ✔ | — |
| 1.4 | Server Actions: Next comprueba el `Origin` (protección CSRF). `signIn` valida tipos y da un error genérico. | ✔ | Con cada acción nueva: validar con Zod, `requireUser()` y comprobar el rol en el servidor, no solo en la UI. |
| 1.5 | Errores de Supabase dentro de los `throw` (`…: ${error.message}`). En producción Next no los envía al navegador (solo un *digest*). | Baja | Pasarlos al log estructurado (§8) y no concatenarlos en mensajes. |
| 1.6 | Un usuario con varias organizaciones: `getScopeContext` toma un rol cualquiera (`limit(1)`). RLS sigue protegiendo los datos, pero la interfaz podría mostrar el rol equivocado. | Media | Organización activa explícita (selector) y rol de esa organización. |
| 1.7 | Cabeceras, CSP, MFA, contraseñas, sesiones y dependencias. | Alta | En curso: #28, #29, #30. |

## 2. Usuarios, roles y datos de tenants (`packages/db`, en código)

| # | Hallazgo | Gravedad | Qué hacer |
|---|---|---|---|
| 2.1 | RLS activado **y forzado** en las 5 tablas. Todas las políticas exigen sesión viva. Helpers `SECURITY DEFINER` de solo lectura con `search_path = ''`. Sin `TRUNCATE`/`REFERENCES`/`TRIGGER` para `authenticated` y nada para `anon`. 186 tests pgTAP. | ✔ | Mantener la regla: cada tabla nueva llega con sus tests de aislamiento. |
| 2.2 | **Un `org_admin` puede añadir a su organización a cualquier usuario del sistema** con solo conocer su `user_id` (`memberships_insert` no pide su consentimiento). **Comprobado en local:** el admin de la organización A añadió al usuario de la B como `staff` de A sin invitación. No filtra datos de B, pero da acceso a A sin que la persona lo acepte. | Media | Tabla `invitations` (email + token de un solo uso con caducidad, guardado como hash). La membership solo se crea al aceptar, mediante una función revisada. |
| 2.3 | Escribir con un rol alto no exige MFA. | **Alta** | Tras #30: RLS que exija `aal2` (`auth.jwt()->>'aal'`) para escribir como `org_admin` y para el equipo interno, más el paso de MFA en el login. |
| 2.4 | `platform_staff`, `audit_logs` y lectura entre tenants (#16): append-only, identidades separadas y `at` fijado por la base de datos. | ✔ diseño | Mergear #16. Modo soporte con caducidad y motivo, y aviso al cliente cuando se abra. |
| 2.5 | Copias de seguridad y recuperación: Supabase Free no tiene. | **Crítica** para datos reales | Plan Pro: copias diarias y PITR. Fijar RPO/RTO y probar una restauración cada trimestre. |

## 3. Agentes y runtime (diseño: MANUAL §5)

El diseño ya incluye: tenant inyectado por el runtime, solo las skills activas como herramientas, el motor de políticas antes de cualquier efecto, techos por clase de efecto, aprobaciones persistidas, outbox con límite de profundidad, pasos máximos por run y paso a humano. Faltan estos controles:

| # | Control que falta | Gravedad | Por qué |
|---|---|---|---|
| 3.1 | **Propiedad de cualquier identificador que proponga el LLM.** No basta con inyectar `organization_id`. Un `appointment_id`, `invoice_id` o `contact_id` en los argumentos debe comprobarse contra el tenant (y el local y el contacto de la conversación) con una consulta acotada antes de usarse. | **Alta** | Sin esto, una inyección de instrucciones («cancela la cita 8f2…») puede afectar a otro cliente final del mismo negocio, o a otro tenant si una skill olvida el filtro. |
| 3.2 | **Cliente de base de datos acotado obligatorio en el worker:** un `tenantDb(orgId)` que añade el filtro a toda consulta, junto a una regla de lint y un test que prohíban el cliente de service role sin acotar. | **Alta** | El MANUAL lo pide en §4.4. Hay que hacerlo primero, antes de la primera skill. |
| 3.3 | **Aprobación atada al contenido exacto.** La aprobación guarda el hash de la entrada de la ejecución. Al ejecutar se comprueba que coincide, para que no se apruebe una cosa y se ejecute otra. Solo se aprueba con sesión, rol y alcance correctos, con `aal2` para lo financiero, y nunca por un enlace sin sesión. | **Alta** | Evita el cambio entre aprobar y ejecutar (TOCTOU) y las aprobaciones suplantadas. |
| 3.4 | **Destinatarios fijados por el runtime.** Un mensaje saliente va solo al contacto de la conversación. Las skills de *outreach* reciben los destinatarios de una consulta, nunca del LLM, y respetan los consentimientos. | **Alta** | El LLM no debe poder elegir a quién se envía nada (regla ya en AGENTS.md; falta implementarla en el código). |
| 3.5 | **Filtro de salida antes de enviar al cliente final:** no revelar reglas de plataforma ni prompts, ni datos de otros contactos o locales; enlaces solo a dominios del negocio. | Media | Contención si una inyección consigue algo. |
| 3.6 | **Consola interna (§8 del MANUAL), «actúa con los permisos del usuario».** El worker usa service role, así que el motor de políticas tiene que recibir el usuario que da la orden y comprobar su rol y su alcance en cada efecto. | **Alta** | Sin esto, un `staff` pide al agente lo que él no puede hacer (*confused deputy*). |
| 3.7 | Eventos del outbox: el consumidor toma el tenant de la fila del evento, nunca del `payload`. | Media | Un `payload` manipulado no debe cambiar de tenant. |
| 3.8 | Evals de ataque **antes** de activar cualquier agente, con umbral que bloquee el merge: inyección, datos de otro tenant o local, efectos fuera de alcance, envenenamiento de memoria e IDs de otro cliente (3.1). | **Alta** | Ya están en el MANUAL §12.4; falta crearlas. |

## 4. Memoria, conocimiento y datos (diseño: MANUAL §6 y §11)

| # | Control | Gravedad | Detalle |
|---|---|---|---|
| 4.1 | **SSRF en la ingesta de webs** («pega la dirección de tu web») y en las señales externas. | **Alta** | Un fetcher aislado que bloquee IPs privadas, *loopback*, *link-local* y metadatos de la nube (169.254.169.254); resuelva el DNS y valide la IP antes de conectar (contra el *rebinding*); solo http(s); límites de tamaño, tiempo y redirecciones. |
| 4.2 | **Subida de documentos.** | **Alta** | Tipo real por *magic bytes* y no por extensión; tamaño máximo; antivirus; Storage con RLS por `organization_id` en la ruta; URLs firmadas de vida corta; nada ejecutable. |
| 4.3 | **Memoria por contacto aislada.** RLS separa organizaciones, pero dentro de una misma organización la memoria de un contacto solo puede llegar a las conversaciones de ese contacto. | **Alta** | Filtro del runtime por `contact_id`, con su eval. |
| 4.4 | Borrado RGPD en cascada, también de embeddings, memorias, entidades, trazas de LLM y copias de seguridad (con su plazo). | Alta | Diseñado en §11; falta la prueba de extremo a extremo. Seudonimizar `actor_id` en `audit_logs` (decisión D6 de #16). |
| 4.5 | **Datos de salud (clínicas).** | **Crítica** para ese vertical | Evaluación de impacto (DPIA) antes de lanzar. El agente gestiona citas y dudas generales, nunca historiales. Filtro de categorías especiales en la memoria. |
| 4.6 | Cifrado en reposo del proveedor + TLS. Las columnas especialmente sensibles (tokens), con cifrado de aplicación (ver §6). | ✔ diseño | — |

## 5. Modelos de IA (diseño: ADR 0019)

| # | Control | Gravedad | Detalle |
|---|---|---|---|
| 5.1 | Residencia por tenant que el *fallback* nunca cruza; si no hay modelo que cumpla, paso a humano. | ✔ diseño | Test: un tenant «solo UE» nunca llega a un endpoint de fuera de la UE, ni siquiera tras un fallo. |
| 5.2 | **Sin retención ni entrenamiento con los datos:** contratos «zero data retention» o equivalentes con cada proveedor y vía, y DPA firmado antes de enviar datos reales. | **Alta** | Lista de subencargados dinámica (ya decidido). |
| 5.3 | **Trazas de LLM (Langfuse) con datos personales.** | **Alta** | Alojamiento en la UE o propio; retención corta; seudonimizar teléfonos y emails antes de guardar; acceso solo para el equipo interno con auditoría. |
| 5.4 | Topes de gasto por tenant, agente y local, con corte duro y degradación a `suggest` o paso a humano (nunca silencio). | ✔ diseño | Alertas al 80 %. |
| 5.5 | **BYOK:** las claves del cliente se validan con una llamada de prueba, se guardan cifradas (§6), no se vuelven a mostrar, nunca aparecen en logs ni trazas, y cada uso queda auditado. | Alta | — |

## 6. Secretos y BYOC (diseño: ADR 0019)

| # | Control | Gravedad | Detalle |
|---|---|---|---|
| 6.1 | *Envelope encryption* con clave por tenant en un KMS. Se descifra solo en el worker y en el momento de usarlo. Cada descifrado queda en el log del KMS. Rotación anual y al dar de baja a alguien. | **Alta** | Decisión pendiente: AWS KMS o GCP KMS (MANUAL §18). |
| 6.2 | **BYOC en AWS (Bedrock en la cuenta del cliente): *confused deputy*.** El rol que el cliente crea para Moodly debe exigir un **ExternalId único por tenant** en su política de confianza. Si no, otro cliente que conozca el ARN podría hacer que Moodly use la cuenta de un tercero. | **Alta** | Generar el ExternalId en el alta y mostrarlo en la pantalla «Tu nube». Lo mismo en GCP (Workload Identity) y Azure (credenciales federadas). |
| 6.3 | Secretos de plataforma (claves de LLM, Stripe, Meta) solo en el gestor de secretos del hosting, separados por entorno y rotables. La service role, solo en el worker. | Alta | Ya en el MANUAL §10.4. Falta el inventario y el procedimiento de rotación. |
| 6.4 | Claves de API de clientes (pantalla «Claves de API»): guardar solo el hash, mostrar la clave una vez, prefijo visible para identificarla, permisos mínimos, caducidad y nunca acciones sensibles. | Media | El prototipo ya lo refleja; hay que respetarlo al construirlo. |

## 7. Integraciones y canales (diseño: MANUAL §7–§8 y ADR 0020)

| # | Control | Gravedad | Detalle |
|---|---|---|---|
| 7.1 | **Webhooks de Meta (WhatsApp/Instagram).** | **Alta** | Firma `X-Hub-Signature-256` (HMAC-SHA256 con el *app secret*) sobre el cuerpo **crudo** y comparada en tiempo constante; idempotencia por `external_event_id`. El tenant sale de `channel_accounts` (`phone_number_id` único), nunca del contenido del mensaje. |
| 7.2 | **OAuth** (Google, Microsoft, CRM…). | Alta | PKCE y `state` atado a la sesión **y** a la organización; `redirect_uri` exacta; permisos mínimos; refresh tokens cifrados (§6); revocar los tokens en el proveedor al desconectar. |
| 7.3 | **Servidores MCP de terceros.** | **Alta** | Solo servidores revisados y fijados a una versión, ejecutados aislados (sin acceso a secretos de otros tenants ni a la red interna), con credenciales del tenant concreto y lista blanca de herramientas. Sus respuestas son datos no confiables, igual que los mensajes. |
| 7.4 | **Widget de chat web.** Es público y lleva el `organization_id` en el script. | **Alta** | Lista de dominios permitidos por organización; límites por IP y por sesión; token de conversación firmado; un contacto no verificado nunca ve datos de su ficha (verificación de identidad con HMAC del lado del negocio). |
| 7.5 | **Pagos (Stripe).** El prototipo de Facturación tiene campos de número de tarjeta. | **Alta** | En `apps/web`, **nunca** formularios propios de tarjeta: Stripe Checkout o Elements (PCI SAQ A). Webhooks de Stripe con firma e idempotencia. |
| 7.6 | **SSO SAML y SCIM** (diseñados en el prototipo). | Media | Verificar el dominio por DNS; nunca dar `org_admin` automáticamente al entrar por SSO; acceso de emergencia; token SCIM guardado como hash y rotable. |
| 7.7 | Embedded Signup de WhatsApp (cada cliente conecta su número). | Media | Tokens de negocio por cuenta de WhatsApp, cifrados; registro de quién conectó qué. |

## 8. Operación, observabilidad y proceso

| # | Hallazgo | Gravedad | Qué hacer |
|---|---|---|---|
| 8.1 | Sin logs estructurados ni alertas de seguridad. | **Alta** | pino con `organization_id`, `run_id` y `trace_id`, sin datos personales en claro. Alertas para: fallos de login en ráfaga, accesos del equipo interno, desactivación de MFA, cambios de rol y secretos descifrados fuera de lo normal. |
| 8.2 | `main` sin protección técnica (GitHub Free en repo privado). | Alta | GitHub Team. Hasta entonces: guarda de mergeo + checks obligatorios (#31). |
| 8.3 | Prototipo público `apps/site/plataforma`: datos inventados, pero enseña el producto y su diseño interno. | Baja | Al desplegarlo: `noindex` y acceso con contraseña, o no publicarlo. |
| 8.4 | Los formularios de contacto y demo de la web no envían nada. No es un riesgo de seguridad, pero se pierden los contactos. | Producto | Cuando se conecten: anti-spam (Turnstile), límites y sin datos sensibles. |
| 8.5 | Sin plan de respuesta a incidentes, ni pentest, ni políticas escritas. | Media | Antes del primer cliente enterprise (ver el informe de cimientos, §C). |

---

## Orden de trabajo propuesto

1. **Mergear #28 → #29 → #30 → #31, y #16.** Lo revisas tú.
2. **Antes de construir el backend de agentes** (cada punto, un PR con sus tests):
   - **a.** Límite de intentos de login propio (1.1) y Turnstile cuando tengas la cuenta.
   - **b.** MFA obligatorio por rol con `aal2` en RLS (2.3).
   - **c.** Invitaciones con consentimiento (2.2).
   - **d.** `tenantDb(orgId)` y la regla de lint para el worker (3.2).
   - **e.** Logs estructurados y alertas de seguridad (8.1).
3. **Con cada pieza del backend**, sus controles: canal WhatsApp (7.1), skills (3.1, 3.4, 3.6), aprobaciones (3.3), conocimiento (4.1–4.3), modelos (5.x), secretos (6.x), integraciones (7.2–7.4), y evals de ataque desde el primer agente (3.8).
4. **Antes de datos reales:** Supabase Pro en la UE con copias de seguridad (2.5), DPAs con cada proveedor (5.2), DPIA si el piloto es una clínica (4.5).
