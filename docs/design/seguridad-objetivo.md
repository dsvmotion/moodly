# Seguridad objetivo: análisis de brecha frente a Langdock

- **Estado:** propuesto. Solo documentación; las unidades nuevas las adopta V1 en `docs/scope.yaml`.
- **Origen:** decisión de producto de Diego del 2026-11-14: «la arquitectura tiene que ser como https://langdock.com/security». Encargo de V1 a V3.
- **Fecha:** 2026-11-24, sobre `main` en `5a15bb2`.
- **Para qué sirve:** es la base de SE08, la página de confianza construida con controles reales.

## Cómo leer este documento

Cada fila es un control que Langdock publica en su página de seguridad, tal como V1 la leyó el 2026-11-14. Para cada uno:

- **Hoy:** lo que existe, con su evidencia: PR, test, ADR o página del proveedor. Hay tres niveles, y solo el primero cuenta como hecho:
  - **Verificado:** un test en el CI o una prueba real lo demuestra.
  - **Del proveedor:** lo dice el proveedor en su web. No lo hemos comprobado nosotros.
  - **No existe.**
- **Falta:** lo que queda para llegar al nivel de Langdock.
- **Unidad:** la de `docs/scope.yaml` que lo cubre, o una **nueva propuesta** (SE14 a SE18, al final).
- **Depende de:** producto, la asesoría legal (F06/F10), un auditor externo o nadie.

Dos decisiones de producto mandan sobre todo el documento:

1. **Procesamiento de modelos global, con DPA** con cada proveedor y solo en la UE si el cliente lo pide (ADR 0051, aceptado el 2026-11-12). No copiamos el «la mayoría de modelos en la UE» de Langdock como valor por defecto.
2. **Solo cuenta lo verificado con evidencia real** (Diego, 2026-11-13). Lo construido sin probar con el proveedor real no es «hecho» y no sale en la web como si funcionara.

## Resumen

| Control | Estado hoy | Unidad |
|---|---|---|
| ISO 27001 | No existe | SE12 |
| SOC 2 Type II | No existe | SE12 |
| RGPD: derechos, DPA, privacidad | Borradores legales; sin ejecución de derechos | F06, F10, SE03 |
| Sin entrenamiento con los datos | Sin verificar proveedor a proveedor | F10, PL-T6 |
| SaaS multi-tenant en la UE | Verificado (aislamiento); producción por crear | PL-prod |
| Single-tenant | No existe | PL-cells |
| Nube propia del cliente | No existe | **SE14** (nueva) |
| On-premise (Helm) | No existe | **SE14** (nueva) |
| App en la UE | Casi: base de datos, web y worker en la UE; la web pública en EE. UU. | PL-prod, F10 |
| Modelos en la UE, configurable | No existe; global por decisión de producto | SE02, OA24 |
| Cifrado AES-256 y TLS 1.2+ | Del proveedor; por organización, planificado | SE13, PL-T4 |
| Mínimo privilegio | Verificado | — (hecho por partes) |
| Defensa en profundidad | Verificado por capas | — (hecho por partes) |
| Pentest independiente | No existe | SE07, F12 |
| Revisión y lista pública de subencargados | Registro interno en borrador; sin lista pública | F10, **SE15** (nueva) |
| BYOK y API unificada | Parcial: enrutador y bóveda construidos; sin pantalla | PL-T6, PL-T4, OA24 |
| Permisos a nivel de organización | Verificado | OA29 (editor de roles) |
| Integraciones con los permisos de la herramienta 1:1 | No existe | **SE16** (nueva) |
| Analítica opcional | No hay analítica de producto | **SE17** (nueva) |
| Monitorización | Parcial: errores y salud de staging | PL-health, **SE18** (nueva) |
| Borrado de datos al irse | No existe como trabajo automático | SE03 |

## Detalle por control

### 1. Certificaciones: ISO 27001 y SOC 2 Type II

- **Hoy:** no existen. `SECURITY.md` publica el contacto de seguridad (F14, hecho) y la política de divulgación.
- **Falta:**
  - un sistema de gestión de la seguridad (políticas, gestión de riesgos, inventario de activos, formación);
  - la evidencia continua de los controles;
  - un auditor acreditado.

  SOC 2 Type II, además, pide un periodo de observación de 3 a 12 meses con producción en marcha. ENS sería lo equivalente para el sector público español.
- **Unidad:** SE12 (after, Founder).
- **Depende de:** producto (presupuesto y calendario) y un auditor externo. No se puede empezar el Type II sin producción (PL-prod) ni sin datos reales.

### 2. RGPD: derechos, DPA y política de privacidad

- **Hoy:**
  - Borradores legales de V13 para la revisión del abogado (PR #271, abierto): privacidad, condiciones, DPA, registro de actividades, registro de subencargados y cribado de la EIPD.
  - Sin datos reales todavía, por regla del proyecto: la lista completa de zonas sensibles se reactiva antes del primer dato real.
  - Las páginas `/privacidad`, `/terminos` y `/cookies` de la web llevan borradores con corchetes.
- **Falta:**
  - los textos revisados y publicados;
  - el DPA firmable con los clientes;
  - el proceso de derechos de los interesados: acceso, rectificación, supresión, portabilidad y oposición, con plazos;
  - las herramientas para ejecutarlos: exportar y borrar por contacto (SE03).
- **Unidad:** F06 (asesoría y textos), F10 (DPA con cada proveedor) y SE03 (exportar, borrar y conservar).
- **Depende de:** la asesoría legal y producto (constituir la sociedad).

### 3. Sin entrenamiento con los datos de los clientes

- **Hoy:** sin verificar. La web ya no lo afirma: la tarjeta «Sin entrenamiento» se quitó de `/seguridad` en #307 y #311.
  - El registro de V13 (#271, `docs/legal/05`) recoge lo que dice cada proveedor.
  - Vercel AI Gateway solo compromete a no entrenar en el plan Enterprise, salvo confirmación escrita y la opción «Disallow Prompt Training».
  - Mistral entrena salvo exclusión.
- **Falta:**
  - el DPA y los términos firmados con cada proveedor detrás del gateway;
  - activar la retención cero (ZDR) y «Disallow Prompt Training»;
  - comprobar, con una llamada real, que el transporte manda la opción de retención cero.
- **Unidad:** F10 (DPA) y PL-T6 (proveedores detrás del enrutador). La comprobación real va en PL-T6, con evidencia de una petición real a staging.
- **Depende de:** la asesoría legal y producto (plan de Vercel).

### 4. Modelos de despliegue

| Opción de Langdock | Hoy | Falta | Unidad |
|---|---|---|---|
| SaaS multi-tenant en la UE | **Verificado el aislamiento:** RLS en todas las tablas de tenants (pgTAP `00_rls_enabled`, `01_org_isolation`, `02_location_scope`), worker con un rol ligado a la organización (ADR 0049, PL-T1, `42_worker_role`). Staging en la UE: Supabase en Fráncfort, web en `fra1` y worker en Ámsterdam. | Producción, con copias y simulacro de restauración | PL-prod (M1), F09 |
| Single-tenant (instancia dedicada) | No existe. ADR 0026 (propuesto) describe las celdas | Construirlas | PL-cells (after) |
| En la nube del cliente | No existe. ADR 0028 (propuesto) describe la portabilidad y BYOC; PL-T12 prueba una imagen de la web | Imagen del worker y de la web, plantilla de despliegue y documentación | **SE14** (nueva) |
| On-premise con Helm | No existe | Chart de Helm, dependencias (Postgres, colas) y actualizaciones | **SE14** (nueva) |

- **Depende de:** producto. Single-tenant, nube propia y on-premise son decisiones de negocio para el plan Enterprise. Hasta que existan, la web los enseña como hoja de ruta o no los enseña: «Tu propia nube» se quitó en #272.

### 5. Alojamiento en la UE de la app y de los modelos

- **Hoy:**
  - **Base de datos:** Supabase en Fráncfort (`eu-central-1`), según el proveedor; se ve en el proyecto de staging.
  - **Funciones de la web:** Vercel en `fra1`, por configuración.
  - **Worker:** Railway en `europe-west4` (Ámsterdam).
  - **Web pública:** Railway, **en EE. UU.** (`docs/STATUS.md`).
  - **Metadatos en EE. UU.:** los de Resend; la cuenta de Sentry. Railway declara EE. UU. como lugar principal de tratamiento.
  - **Modelos:** inferencia global (ADR 0051). La web lo dice así desde #272.
- **Falta:**
  - mover el servicio `site` de Railway a la UE;
  - el modo «solo UE» por organización, que el cliente puede pedir: proveedores y regiones de la UE, comprobado con una llamada real;
  - el ajuste en la app para elegirlo.
- **Unidad:** SE02 (M1, el modo solo UE), OA24 (after, la pantalla de modelos y residencia), PL-prod (región de producción) y F10 (transferencias y TIA).
- **Depende de:** producto (si el modo UE es un extra de pago) y la asesoría (TIA de las transferencias).

### 6. Cifrado AES-256 en reposo y TLS 1.2+ en tránsito

- **Hoy:**
  - **Del proveedor:** Supabase cifra en reposo con AES-256 y todo va por TLS (SE13, hecho, con las páginas de los proveedores como evidencia).
  - **Verificado:** las cabeceras de seguridad de la web (HSTS y CSP) en `security-headers.e2e.ts`.
- **Falta:**
  - el cifrado por organización con claves en KMS (ADR 0050, aceptado). La bóveda existe con un proveedor de claves local y sin llamadas;
  - cifrar las claves de los proveedores de IA y los secretos de MCP de cada organización.
- **Unidad:** SE13 (hecho, el del proveedor) y PL-T4 (M3, por organización).
- **Depende de:** nadie para construirlo; AWS KMS necesita la cuenta de la sociedad (F06).

### 7. Mínimo privilegio

- **Hoy:** verificado por partes:
  - **Roles y alcance:** cuatro roles (`org_admin`, `region_manager`, `location_manager`, `staff`) y alcance por región y sede en RLS (pgTAP `02_location_scope`, `03_org_admin`, `15_least_privilege`; e2e `roles`, `scope` y ahora `calendar`).
  - **Guardas por columna:** triggers `guard_*` (ADR 0003, `05_review_guards`).
  - **Worker:** un rol de base de datos propio ligado a una organización por transacción (ADR 0049, `42_worker_role`), sin service role para leer datos de un tenant.
  - **Equipo interno:** accede con permisos de soporte con caducidad (ADR 0021, `07_platform_staff`, `12_support_grants`).
  - **Web:** no usa la service role para datos de usuario (regla de CLAUDE.md).
- **Falta:**
  - terminar PL-T1: las escrituras del worker por el mismo rol;
  - un editor de roles para permisos más finos (OA29).
- **Unidad:** PL-T1 (M1, en curso) y OA29 (after).
- **Depende de:** nadie.

### 8. Defensa en profundidad

- **Hoy:** verificado por capas:
  - **Sesión:** MFA obligatorio para administrar (`13_admin_mfa`, `14_mfa_reads`, `mfa.e2e`), sesiones revocables (`06_session_revocation`, `session-revocation.e2e`) y freno de intentos de login (`09_login_throttle`, `login-throttle.e2e`).
  - **Web:** cabeceras de seguridad y CSP (`security-headers.e2e`).
  - **Datos:** RLS y guardas en la base de datos.
  - **Agentes:**
    - motor de políticas y techos de autonomía (`43_execution_autonomy_ceiling`);
    - los mensajes de los clientes se tratan como datos y no como órdenes;
    - set de ataque en el CI (SE06, check obligatorio «evals · modelo falso»);
    - topes de gasto por organización (PL-ledger).
  - **Repositorio:** guarda de mergeo desde la rama base (SE01, P-01) y escaneo de dependencias y secretos en cada PR (check «seguridad · dependencias y secretos»).
- **Falta:**
  - la resistencia a inyecciones por diseño: taint tracking y lista de enlaces permitidos;
  - enmascarar los datos personales antes del modelo;
  - el set de ataque con el modelo real como check obligatorio;
  - que el usuario vea los topes de gasto.
- **Unidad:** PL-T9 (M3), PL-T5 (M2), SE06 (M3, en curso) y SE05 (M3).
- **Depende de:** nadie; el set con el modelo real tiene coste (lo decide producto).

### 9. Pruebas de penetración independientes

- **Hoy:** no existe ninguna. `SECURITY.md` acepta informes de investigadores.
- **Falta:**
  - contratar el pentest antes del primer dato real (condición de salida a producción);
  - corregir lo que salga;
  - repetirlo cada año y publicar un resumen.
- **Unidad:** SE07 (M3, Founder) y F12 (reservarlo).
- **Depende de:** producto (presupuesto) y un auditor externo.

### 10. Revisión de subencargados y lista publicada

- **Hoy:** el registro interno de V13 en borrador (#271, `docs/legal/05`), con lo que dice cada proveedor, su garantía de transferencia y su DPA. No hay ningún DPA firmado, y la web enlaza «Lista de subencargados» a `/contacto`.
- **Falta:**
  - firmar o aceptar cada DPA (F10);
  - publicar la lista revisada en la web y enlazarla desde privacidad y desde el DPA;
  - avisar de los cambios con antelación, como pide el DPA;
  - revisar a cada proveedor nuevo antes de usarlo.
- **Unidad:** F10 (DPA) y **SE15** (nueva): la lista pública de subencargados con aviso de cambios.
- **Depende de:** la asesoría legal (revisión de la lista y del DPA).

### 11. BYOK de las claves de modelos y API unificada

- **Hoy:**
  - **API unificada:** un único enrutador de modelos con claves lógicas (`fast`, `smart`) en `packages/config` (ADR 0033 y 0019, PL-T6 en curso, el transporte de Vercel AI Gateway desde #118).
  - **Base de datos para BYOK:** el esquema de claves de modelos y secretos por organización, con pgTAP `23_model_settings_secrets` y `41_model_key_balanced` (ADR 0034).
- **Falta:**
  - que la organización meta su clave desde la app (OA24);
  - que el enrutador la use en lugar de la de la plataforma, comprobado con una llamada real con una clave del cliente;
  - cifrarla con la clave de la organización (PL-T4).
- **Unidad:** PL-T6 (M1), PL-T4 (M3) y OA24 (after).
- **Depende de:** nadie para construirlo; la prueba real necesita una clave de un proveedor de verdad (la pone producto).

### 12. Permisos a nivel de organización (workspace)

- **Hoy:** verificado. Cada organización está aislada por RLS (`01_org_isolation`), con roles, regiones y sedes. La organización activa se elige y se valida contra las membresías (`active-org.e2e`), y quien trabaja para dos empresas ve cada una por separado.
- **Falta:**
  - permisos configurables por organización (OA29, el editor de roles);
  - SSO y SCIM para las organizaciones grandes.
- **Unidad:** OA29 (after), PL-sso (after) y SE10 (after, SSO en todos los planes).
- **Depende de:** producto (SSO en qué planes).

### 13. Integraciones que respetan los permisos de la herramienta de origen (1:1)

- **Hoy:** no existe.
  - Nango autoalojado es la plataforma de conectores (ADR 0053), y el alta de claves de integraciones es el ADR 0055, aceptado (opción A, #319).
  - El asistente actúa con los permisos del usuario (ADR 0029, aceptado), pero el conocimiento que viene de una integración (p. ej. Google Drive o SharePoint) todavía no guarda los permisos de cada documento.
- **Falta:**
  - conectar las integraciones por usuario con OAuth, no con una cuenta de servicio compartida, para lo que es personal;
  - sincronizar los permisos de cada documento o registro con la herramienta de origen;
  - filtrar la búsqueda de conocimiento y las respuestas de los agentes con esos permisos;
  - tests en negativo: alguien sin acceso al documento en la herramienta no lo ve en la plataforma.
- **Unidad:** **SE16** (nueva).
- **Depende de:** producto (qué integraciones primero) y de que O-02 conecte integraciones reales.

### 14. Analítica opcional

- **Hoy:** la plataforma no tiene analítica de producto: ni píxeles ni herramientas de terceros que sigan a los usuarios. La política de cookies de V13 lo recoge (#271). En la web pública, la tarjeta «Analítica opcional» sale sin unidad y no se enseña (#272).
- **Falta:** si algún día se añade, apagada por defecto, con opción por organización y por persona, y en la lista de subencargados si la da un tercero.
- **Unidad:** **SE17** (nueva).
- **Depende de:** producto (si se quiere analítica de producto).

### 15. Monitorización

- **Hoy:**
  - **Errores de la web:** van a Sentry en su región de la UE, sin datos de usuario (ADR 0032).
  - **Logs:** estructurados, con seudónimos y censura (ADR 0032, `logger` y `securityEvent()`).
  - **Salud de staging:** `/health` de la web y del worker y la alerta «Staging · salud», que abre un issue (PL-health, #308; verificado en staging, #310).
  - **Main en rojo:** el aviso «alerta-main».
- **Falta:**
  - la monitorización en producción, con guardia y escalado;
  - alertas de seguridad: picos de logins fallidos, acciones de administración fuera de lo normal, accesos del equipo interno con permiso de soporte, errores de RLS;
  - un registro de incidentes con plazos de aviso (RGPD, 72 h).
- **Unidad:** PL-health (M1) y **SE18** (nueva): la monitorización de seguridad y la respuesta a incidentes.
- **Depende de:** producción (PL-prod); el plan de incidentes, de la asesoría (plazos de notificación).

### 16. Borrado de los datos al irse

- **Hoy:** no existe como trabajo automático. Ya existe la máquina de estados de baja de una organización: las ejecuciones y aprobaciones de una organización que se va pasan a estados finales (D-01 y D-02, #192 y #225, `40_offboarding_execution_states`). No hay borrado ni exportación.
- **Falta:**
  - exportar todos los datos de la organización en un formato abierto;
  - borrarlos al terminar el contrato, con un plazo pactado en el DPA, también en los proveedores (copias de seguridad, Sentry, Resend, Nango);
  - el certificado de borrado;
  - la retención automática por tipo de dato.
- **Unidad:** SE03 (M3).
- **Depende de:** la asesoría (plazos en el DPA y en la política).

## Unidades nuevas propuestas

Para que V1 las adopte en `docs/scope.yaml`. Los ids siguen a SE13, el último de la serie.

| Id | Nombre | Hito | Responsable | Depende de | Para cerrarla |
|---|---|---|---|---|---|
| **SE14** | Despliegue en la nube del cliente y on-premise (Helm), sobre ADR 0028 | after | V1 | Producto (plan Enterprise) | Instalación de prueba en una cuenta limpia siguiendo solo la documentación; actualizar de versión sin perder datos |
| **SE15** | Lista pública de subencargados, con aviso de cambios | M3 | V3 (con V13) | Asesoría legal (F10) | Página publicada desde un único registro, enlazada desde privacidad y DPA; procedimiento de aviso probado una vez |
| **SE16** | Integraciones con los permisos de la herramienta de origen (1:1) | after | V1 | Producto (qué integraciones); O-02 | Tests en negativo con una cuenta real de la integración: un documento sin permiso no aparece en la búsqueda ni en las respuestas |
| **SE17** | Analítica de producto opcional, apagada por defecto | after | V2 | Producto | Si se construye: test de que sin consentimiento no se envía nada; si no, la afirmación «sin analítica de terceros», comprobada en la CSP |
| **SE18** | Monitorización de seguridad y respuesta a incidentes | M3 | V1 | Producción (PL-prod); asesoría (plazos de aviso) | Alertas probadas con un evento provocado en producción; simulacro de incidente con su registro |

## Qué puede enseñar la página de confianza (SE08) hoy

Solo lo verificado, con la etiqueta de estado del registro (N-01):

- **Disponible:** el cifrado del proveedor (SE13, con la etiqueta «según nuestros proveedores»).
- **En construcción:**
  - aislamiento por organización y mínimo privilegio (PL-T1);
  - registro de auditoría (SE04);
  - enrutador de modelos (PL-T6);
  - set de ataque (SE06).
- **En el piloto:** modo solo UE (SE02), exportar y borrar (SE03), cifrado por organización (PL-T4), pentest (SE07), enmascarado (PL-T5) y lista de subencargados (SE15).
- **En hoja de ruta:** ISO 27001 y SOC 2 (SE12), single-tenant (PL-cells), nube propia y on-premise (SE14), permisos de las integraciones (SE16) y SSO (SE10).

Lo que no tiene unidad no sale. Lo que depende del abogado (DPA, lista de subencargados, textos legales) no se publica hasta su revisión.
