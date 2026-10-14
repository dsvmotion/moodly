# Auditoría de flujos — infra de modelos (Bedrock/Vertex/Azure), agentes, usuarios, integraciones

Fecha: 2026-10-14 · Autor: diseño (Claude) · Estado: para revisión de producto antes de backend.

Audita **todos los recorridos** del producto cruzando tres capas: lo que ya está
prototipado (`apps/site/plataforma`), lo que está **especificado en docs pero sin pantalla**,
y lo que **falta por completo** — con foco en la **infra real de proveedores de modelos**
(AWS Bedrock, Google Vertex, Azure OpenAI, APIs directas, Mistral UE) y en lo que cuelga de
ella: agentes, usuarios/acceso, integraciones y cumplimiento.

Base: `docs/design/mapa-pantallas-datos.md` §7, `docs/design/arquitectura-agentes-enterprise.md`
§2.3/§6/§7, `docs/MANUAL.md` §3.2/§5/§7/§10/§11, `apps/site/.../components/models-catalog.js`.

Notación: ✅ prototipado · 🟡 especificado en docs, sin pantalla · ❌ sin diseñar · 🔒 acción sensible.

---

## 0. Inventario de flujos — estado actual

Los **9 flujos** construidos hasta hoy (PRs #19 y #20):

| Flujo | Ruta prototipo | Estado |
|---|---|---|
| Aceptar invitación | `/plataforma/aceptar` | ✅ |
| Conectar canal (WhatsApp Cloud API) + plantillas | `/plataforma/conectar` | ✅ |
| Alta/clonación de voz | `/plataforma/voz` | ✅ |
| Detalle de aprobación | `/plataforma/revisar` | ✅ |
| Checkout (Stripe) | `/plataforma/checkout` | ✅ |
| Tomar el control de una conversación | `/plataforma/tomar` | ✅ |
| Publicar versión de agente | `/plataforma/publicar` | ✅ |
| Ingesta de conocimiento | `/plataforma/ingesta` | ✅ |
| Export/borrado RGPD | `/plataforma/privacidad` | ✅ |

Esos 9 cierran la lista de "flujos sin pantalla" de `mapa-pantallas-datos.md` §7 **salvo**
`MFA/SSO/SCIM` y `API keys` — y **ninguno** cubre la capa de infra de proveedores de modelos,
que es justo lo que esta auditoría abre.

---

## 1. Hallazgo central: "modelo" ≠ "vía de servicio"

La pantalla **Modelos de IA** y `models-catalog.js` agrupan los modelos por **residencia**
(UE / EE. UU. / Global). Eso es correcto de cara al comprador, pero **colapsa una dimensión
que el backend necesita como ciudadana de primera clase**: un mismo modelo se puede servir por
varias **vías**, cada una con distinta residencia, DPA, latencia y coste.

| Modelo | API directa | AWS Bedrock | Google Vertex | Azure OpenAI | Mistral La Plateforme |
|---|---|---|---|---|---|
| Claude (Haiku/Sonnet/Opus) | US (api.anthropic.com) | **UE** (eu-central-1, eu-west-1/2/3) | **UE** (europe-west*) | — | — |
| GPT-5.x / GPT-6 | US (api.openai.com) | — | — | **UE** (Sweden, France, Switzerland) | — |
| Gemini 3.x | Global (AI Studio) | — | **UE** (europe-west*) | — | — |
| Mistral | **UE** (nativo) | UE (Bedrock) | UE (Vertex) | UE (Azure) | **UE** |
| Llama / abiertos | — | UE | UE | — | — |

**Consecuencia:** la política "solo UE" no se cumple eligiendo "qué modelo", sino **"qué modelo
por qué vía y en qué región"**. Hoy el prototipo no modela la vía. Es el primer flujo de infra
que falta y del que dependen los demás (residencia, fallback, BYOK, BYOC, DPA).

Esto ya está intuido en docs (`arquitectura-agentes-enterprise.md` §2.3 "Modos de conexión:
claves de Moodly / BYOK / nube del cliente — Azure OpenAI, Bedrock o Vertex"; `mapa-pantallas-datos.md`
§5 "Modelos de IA … modo (incluido/BYOK/nube)"), pero **sin recorrido**.

---

## 2. Flujos que faltan — por bloque

### A. Infra de proveedores de modelos (el gateway) — el bloque más grande y nuevo

| # | Flujo | Qué hace | Estado | Prioridad |
|---|---|---|---|---|
| A1 | **Elegir vía de servicio por proveedor** | Por cada proveedor activo: Moodly gestionado (gateway UE) · BYOK (claves del cliente) · Nube del cliente (Bedrock/Vertex/Azure en su cuenta/región). Wizard por vía. | ❌ | **Alta** |
| A2 | **Conectar BYOK** | Pegar/validar clave del proveedor → test de llamada → guardar en bóveda cifrada (nunca legible desde el navegador) → estado de salud. | 🟡 (`integration_secrets` previsto) | **Alta** |
| A3 | **Conectar nube del cliente (BYOC)** | Credenciales de rol (AWS IAM role/Bedrock, GCP service account/Vertex, Azure OpenAI endpoint+key), elegir región, elegir qué modelos de esa cuenta se exponen, test. | ❌ | Media (enterprise) |
| A4 | **Política de residencia y enrutado** | Regla por organización/sede: "solo UE", calidad mínima, coste máximo; **cadena de fallback que no cruza región**; qué pasa si no hay modelo UE con calidad → **paso a humano** (nunca cruzar en silencio). | 🟡 (`org_model_settings`) | **Alta** |
| A5 | **Asignar modelo por tarea/agente/skill** | Modelo rápido por defecto (Haiku/Flash-Lite); modelo avanzado solo en tareas marcadas y con tope. Override por agente y por skill. | 🟡 | **Alta** |
| A6 | **Topes de gasto y circuit breaker** | Tope € por proveedor/modelo/flujo; aviso al acercarse; corte o degradado automático; estado "proveedor degradado → fallback activo". | 🟡 (parcial en config) | Media |
| A7 | **Embeddings: proveedor y región** | Elegir proveedor de embeddings (pgvector es el almacén; el embebido lo hace un modelo) y su región UE; reindexado al cambiar. | ❌ | Media |
| A8 | **Voz: proveedor + workers UE** | Elegir Cartesia/ElevenLabs, región, modo retención; los **workers de voz** escalan por llamadas simultáneas, no por agente. Prueba de latencia UE. | 🟡 (persona/clonación ✅, infra ❌) | Media |
| A9 | **DPA y subprocesadores** | Aceptar DPA al activar un proveedor; **lista pública de subencargados** que se actualiza sola según proveedores/vías activas; registro de la aceptación. | ❌ | **Alta** (bloquea venta UE) |
| A10 | **Enmascarado de PII antes del LLM** | Vista previa de qué se enmascara (nombres, teléfonos, nº de historia) antes de salir al modelo; on/off por política. | ❌ | Media |

**Pantalla que lo agrupa:** `/app/ajustes/modelos` crece de "activar modelos" a **"proveedores,
vías, residencia y topes"**. Candidato a dividir en pestañas: *Modelos* · *Proveedores y vías* ·
*Residencia y fallback* · *Consumo y topes*.

### B. Agentes (ciclo de vida completo)

| # | Flujo | Estado | Prioridad |
|---|---|---|---|
| B1 | Crear/clonar agente desde plantilla (`agent_type` × vertical) | ❌ | **Alta** |
| B2 | Probar agente en sandbox / correr evals antes de activar | 🟡 (`agent_versions`, evals) | **Alta** |
| B3 | Activar / pausar / retirar agente | 🟡 | **Alta** |
| B4 | Techo de autonomía por acción/sede/agente (solo/aprobación/nunca) | 🟡 (`/plataforma/reglas` existe como pantalla, falta el recorrido de edición 🔒) | **Alta** |
| B5 | Límites por ejecución (máx. pasos, timeout, presupuesto de tokens, lista blanca de herramientas) | 🟡 | Media |
| B6 | Publicar versión + vuelta atrás | ✅ `/plataforma/publicar` | — |
| B7 | Modo coach: propuesta → eval → publicación gradual → rollback | 🟡 (pantalla existe, falta recorrido 🔒) | Media |
| B8 | Voz del agente | ✅ `/plataforma/voz` (falta la pestaña dentro de `/app/agentes`) | — |

### C. Usuarios y acceso

| # | Flujo | Estado | Prioridad |
|---|---|---|---|
| C1 | Alta real (magic link / email) + primer acceso | 🟡 | **Alta** |
| C2 | Invitar miembro → aceptar | ✅ `/plataforma/aceptar` | — |
| C3 | Roles y permisos (capacidades + alcance por sede) | 🟡 (`/plataforma/configuracion/roles` existe, falta recorrido) | **Alta** |
| C4 | MFA (activar, factores de recuperación) | ❌ | Media |
| C5 | SSO SAML/OIDC para cadenas | ❌ | Media (enterprise) |
| C6 | SCIM (aprovisionamiento, token de un solo uso) | ❌ | Baja (enterprise) |
| C7 | Sesiones activas / revocar / invalidación global 🔒 | 🟡 (previsto en Privacidad/Seguridad) | Media |
| C8 | Offboarding (dar de baja, reasignar propiedad, nunca quedar sin `org_admin`) | ❌ | Media |
| C9 | **API keys** (crear/rotar/revocar, scopes, último uso) | ❌ | Media |

### D. Integraciones y canales

| # | Flujo | Estado | Prioridad |
|---|---|---|---|
| D1 | Conectar canal (OAuth) + plantillas WhatsApp | ✅ `/plataforma/conectar` | — |
| D2 | **Onboarding BSP de WhatsApp** (elegir BSP, alta del número, opt-in, verificación) | 🟡 (BSP **[ABIERTO]**) | **Alta** |
| D3 | Reconectar / salud / token caducado de una integración | 🟡 (principio en MANUAL §7.1) | **Alta** |
| D4 | Revocar integración (y degradar skills dependientes a `suggest`) | 🟡 | Media |
| D5 | Permisos/acciones por integración (scopes mínimos) | 🟡 (prototipo de integraciones los lista, falta el recorrido de edición) | Media |
| D6 | Añadir servidor **MCP** (registro, fiabilidad, sandbox) | ❌ | Media |
| D7 | Modo sandbox/fixtures por integración (para tests y evals) | ❌ | Baja |

### E. Datos y cumplimiento

| # | Flujo | Estado | Prioridad |
|---|---|---|---|
| E1 | Export/borrado RGPD de un cliente | ✅ `/plataforma/privacidad` | — |
| E2 | Registro de auditoría: ver, filtrar, **exportar**, retención por plan | 🟡 (`/plataforma/configuracion/auditoria` existe) | Media |
| E3 | Residencia visible: badge UE/US por conversación/acción | ❌ | Media |
| E4 | Retención de datos por tipo (conversaciones, grabaciones, logs) | ❌ | Media |

### F. Facturación y consumo

| # | Flujo | Estado | Prioridad |
|---|---|---|---|
| F1 | Checkout (Stripe) | ✅ `/plataforma/checkout` | — |
| F2 | Portal de facturación (método de pago, facturas) | 🟡 | Media |
| F3 | Consumo + topes + avisos (por org, por sede, por proveedor) | 🟡 (Informes/Plan existen) | **Alta** |
| F4 | Cambio de plan/límite con solicitud → aprobación 🔒 | 🟡 | Media |
| F5 | Precio con BYOK / nube del cliente (cuota reducida) | 🟡 (`modelo-precios.md`) | Baja |

---

## 3. Prioridad alineada al plan por fases

`arquitectura-agentes-enterprise.md` §9 define Piloto → Pymes a escala → Enterprise. Mapeo de los
flujos que faltan:

- **Piloto (ahora):** A1 (vía por proveedor, aunque sea Moodly-gestionado UE + 2 proveedores),
  A4 (residencia + fallback + paso a humano), A5 (modelo por tarea), A9 (DPA/subprocesadores),
  B1–B4 (alta y gobierno de agentes), C1/C3 (acceso y roles), D2/D3 (BSP WhatsApp + salud), F3 (topes/avisos).
- **Pymes a escala:** A2 (BYOK), A6 (circuit breaker), A7 (embeddings), A8 (voz infra), B5/B7, C7/C9, D4–D6, E2–E4, F2/F4.
- **Enterprise:** A3 (BYOC Bedrock/Vertex/Azure), A10 (PII masking configurable), C4–C6 (MFA/SSO/SCIM), celdas dedicadas, KMS por cliente.

---

## 4. Decisiones — **cerradas 2026-10-14** (ADR 0019 y 0020)

Las seis se resolvieron el 2026-10-14. Resumen (detalle en
[`adr/0019`](../adr/0019-enrutador-ia-multiregion-byok-kms.md) y
[`adr/0020`](../adr/0020-whatsapp-cloud-api-directo.md)):

1. **Regiones:** ✅ **todas, no solo UE** — máxima disponibilidad. La residencia pasa a ser
   **política por tenant** ("sin restricción" por defecto; "solo UE" u otra como opción, con
   fallback que no cruza y paso a humano).
2. **Enrutador:** ✅ capa propia sobre Vercel AI SDK + gateways de nube (Bedrock/Vertex/Azure);
   se evalúa AI Gateway/LiteLLM para unificar. "Lo más potente, seguro y escalable."
3. **Secretos:** ✅ **KMS** (envelope encryption, clave por tenant). Vault descartado.
4. **WhatsApp:** ✅ **Cloud API directo** de Meta, sin BSP en el piloto (ADR 0020).
5. **Embeddings:** ✅ proveedor multi-región que respete la residencia del tenant; se confirma en piloto.
6. **DPA/subprocesadores:** ✅ plantilla + **lista pública dinámica** por proveedores/vías/regiones activos.

> **Impacto de mensaje:** "solo UE" deja de ser la esencia del producto y pasa a **garantía
> opcional por plan**. Pendiente: actualizar `models-catalog.js`, landing `/modelos` y
> `edge-y-postura-enterprise.md` donde hoy dicen "UE-first/solo UE".

---

## 5. Recomendación de siguientes pantallas a prototipar

Si seguimos cerrando diseño antes de backend, el orden de mayor valor:

1. **Proveedores y vías de servicio** (A1 + A2 + A4): el flujo que hoy no existe y del que
   depende la promesa "solo UE". Pestañas en `/app/ajustes/modelos`.
2. **Alta y gobierno de agentes** (B1–B4): crear desde plantilla → probar/eval → activar, y el
   recorrido de techo de autonomía 🔒.
3. **Roles y acceso** (C1/C3) + **salud de integraciones** (D3).
4. **DPA/subprocesadores** (A9) y **consumo/topes** (F3).

MFA/SSO/SCIM (C4–C6) y BYOC (A3) pueden esperar a la fase enterprise sin bloquear el piloto.

---

*Este documento no cambia código. Cada tabla/entidad nueva que implique llevará, al construir el
backend, su RLS + test pgTAP de aislamiento; las acciones 🔒 pasan por el motor de políticas y
quedan en `audit_logs`.*
