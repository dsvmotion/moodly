> **BORRADOR — pendiente de revisión por un abogado; no publicar.**
> Preparado el 2026-11-12 por la sesión V13 · Legal a partir del código y de los ADR. No es asesoramiento jurídico. La excepción para empresas de menos de 250 personas (art. 30.5 RGPD) no aplica: los tratamientos no son ocasionales [consolidado]. Documento interno: no se publica, se enseña a la AEPD si lo pide (art. 30.4).

# Registro de actividades de tratamiento (art. 30 RGPD)

**Titular:** [RAZÓN SOCIAL], NIF [NIF], [DOMICILIO SOCIAL]. Contacto: [EMAIL DPO/CONTACTO]. DPD: [designado / no designado; ver checklist]. **Fecha:** 2026-11-12 (preproducción: hoy no hay datos reales de clientes).

Los proveedores se citan por su nombre corto; el detalle (entidad, región, garantía de transferencia y fuente) está en `05-registro-subencargados.md`.

## Parte A — Moodly como responsable (art. 30.1)

| # | Actividad | Finalidad | Base (art. 6) | Interesados | Categorías de datos | Destinatarios / encargados | Transferencias fuera del EEE | Plazo de supresión | Medidas (art. 32) |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Web pública | Servir la web y protegerla | 6.1.f | Visitantes | Datos de conexión de los registros del hosting; cookie de idioma | Railway (web pública) | **Sí: el servicio `site` está hoy en EE. UU.** — DPF/SCC de Railway [verificar] | Retención de logs del hosting [confirmar] | TLS; sin analítica ni terceros |
| A2 | Contacto y demos | Contestar y preparar propuestas | 6.1.b y 6.1.f (art. 19 LOPDGDD) | Personas de contacto de empresas | Nombre, email, empresa, teléfono, mensaje | Proveedor del buzón contact@moodly.com [desconocido: confirmar] | [Según el proveedor del buzón] | 12 meses desde el último contacto [propuesta] | Acceso restringido al buzón |
| A3 | Cuentas y acceso a la plataforma | Dar acceso al equipo de cada cliente; autenticación y MFA | 6.1.b (contrato con el cliente) y 6.1.f | Usuarios del equipo del cliente | Nombre, email, idioma, rol, memberships, factor MFA, sesiones | Supabase (Auth y BD), Vercel (app), Resend (emails de invitación y acceso) | BD en Frankfurt (Supabase, SCC); Vercel con CDN global (DPF); metadatos de los emails de Resend en EE. UU. (DPF) | Vida de la cuenta + [X] meses [propuesta] | RLS por organización, MFA para administrar, cookies httpOnly, sesiones revocables |
| A4 | Seguridad y auditoría | Detectar abusos, freno del login, trazabilidad | 6.1.f y 6.1.c (art. 32 RGPD) | Usuarios; personas que intentan entrar | Seudónimos HMAC de email e IP en logs; `ip_hash` en fallos de login; eventos de seguridad; `audit_logs` (solo inserción) | Supabase, Vercel (logs), Railway (logs del worker) | Ver A3 | Fallos de login: [ventana del freno]; `audit_logs`: [X años; al borrar a una persona se seudonimizan sus campos, decisión #14] | Seudonimización con clave de servidor; registros de solo inserción |
| A5 | Errores técnicos | Corregir fallos | 6.1.f | Usuarios y visitantes de la app | Datos técnicos del error, sin usuario, IP, cookies, cabeceras ni cuerpos; emails censurados (ADR 0032) | Sentry (región UE, `de.sentry.io`) | Eventos en Frankfurt; cuentas, configuración y auditoría de Sentry en EE. UU. — DPF y SCC | [Retención del plan de Sentry] | Limpieza en `beforeSend`, tunnel propio |
| A6 | Avisos de la plataforma | Avisar de aprobaciones pendientes y del estado de la cuenta y el crédito | 6.1.b | Usuarios | Email, nombre, contenido del aviso | Resend (envío desde eu-west-1) | **Sí:** Resend guarda en EE. UU. los metadatos, logs y registros de la API — DPF y SCC | [Retención de logs de Resend] | Plantillas sin datos de clientes finales [verificar] |
| A7 | Facturación y cobro | Cobrar la prueba, créditos y planes; facturar | 6.1.b y 6.1.c (normativa fiscal y mercantil) | Contactos de facturación de los clientes | Nombre, email, datos fiscales; tarjeta (solo Stripe) | Stripe; asesoría fiscal [si se externaliza] | Stripe, según su DPA [verificar] | 6 años (art. 30 C. Com.) / 4 años (LGT) [confirmar] | Moodly no guarda datos de tarjeta |
| A8 | Medición de consumo | Calcular créditos y límites | 6.1.b | Organizaciones (y usuarios que lanzan acciones) | Tokens, coste, agente, local; sin contenido | Supabase | No | Lo que exija la facturación | RLS |
| A9 | Comunicaciones comerciales | Novedades del producto | 6.1.a o art. 21.2 LSSI-CE | Contactos y clientes | Email | [Herramienta por elegir] | [—] | Hasta la baja | **Hoy no existe**; no activar sin revisar |

## Parte B — Moodly como encargado (art. 30.2)

Un registro por cliente responsable. Plantilla común (todos los clientes usan el mismo servicio):

| Campo | Contenido |
|---|---|
| **Responsable** | Cada cliente (organización) de Moodly: nombre y contacto en la ficha del cliente y en su DPA firmado. Su representante o DPD, si lo tiene. |
| **Encargado** | [RAZÓN SOCIAL], [EMAIL DPO/CONTACTO]. |
| **Categorías de tratamiento** | (1) Atención de los clientes finales por los agentes en chat web, WhatsApp y email (Instagram y voz, más adelante); (2) gestión de citas y recursos en la agenda; (3) conocimiento del negocio (documentos y textos que sube el cliente, indexados con embeddings); (4) resúmenes de conversación y memorias derivadas; (5) solicitudes de conocimiento y aprobaciones al equipo; (6) bandeja: el equipo toma el control y escribe; (7) acciones en las herramientas conectadas del cliente (calendario, CRM, facturación) mediante integraciones; (8) coach y asistente del dueño sobre los datos del negocio. |
| **Categorías de datos** | Identificación y contacto de clientes finales (nombre, teléfono, email, identificadores del canal), contenido de las conversaciones, citas, preferencias y memorias, datos del equipo del cliente que aparecen en la operación. **No previstos pero posibles:** datos de salud que cuente el cliente final (ver `08`). |
| **Subencargados y transferencias** | Ver el Anexo III del DPA y `05-registro-subencargados.md`. **El contenido de las conversaciones se envía a proveedores de modelos que pueden procesarlo fuera del EEE** (decisión de producto del 2026-11-12), con SCC o DPF según el proveedor. |
| **Medidas de seguridad (art. 32)** | Anexo II del DPA: aislamiento por organización con RLS y tests, rol del worker ligado a la organización (ADR 0049, en curso), claves por organización (ADR 0050, en curso), cifrado en tránsito y en reposo del proveedor, MFA para administrar, registro de auditoría, motor de políticas y aprobaciones humanas, mensajes de clientes tratados como datos no confiables. |
| **Plazo** | El que fije cada responsable; por defecto, [propuesta: conversaciones 12 meses desde el último mensaje]. **Hoy no hay purga implementada** (condición antes del primer dato real). |

### Clientes registrados

| Cliente (responsable) | Fecha del DPA | Canales | Particularidades |
|---|---|---|---|
| — | — | — | Ninguno: no hay clientes con datos reales a 2026-11-12. |

## Mantenimiento

Se actualiza con cada subencargado nuevo, cada canal o agente que entre en producción y cada cliente firmado. Propietario: [persona responsable de privacidad].
