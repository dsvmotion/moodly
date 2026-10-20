# Auditoría de decisiones y flujos antes del backend

Fecha: 2026-10-09 · Previo a tocar backend (Paso 1). Complementa `docs/audits/2026-10-09-cierre-diseno-backend.md`.

Objetivo: **pensar y decidir bien** las dos cosas que bloquean el backend —(1) las decisiones de negocio/infra y (2) los flujos que faltan— antes de construir nada. Cada decisión viene con opciones, trade-offs y **una recomendación con criterio**, pero la elección es de producto.

> **PR #16 (platform_staff + audit_logs + /ops): en espera.** No se mergea hasta cerrar esto. Es trabajo válido pero sensible; cuando lo retomemos, se actualiza con `main`, re-revisas y re-etiquetas.

---

## 1. Decisiones de negocio/infra (cerrar antes del Paso 1)

### 1.1 Vertical y cliente piloto ★ (la más importante)
Es la decisión que condiciona todo lo demás (integraciones, plantillas, evals, voz).
- **Criterios para elegir**: (a) tienes **acceso a un cliente real** que quiera usarlo; (b) ROI claro y medible (citas, no-shows, horas); (c) integraciones acotadas (2-3 canales); (d) riesgo bajo (nada clínico/legal crítico automatizado).
- **Recomendación**: **un** vertical + **un** cliente piloto real, no varios. Clínicas/belleza es el ejemplo que ya tienes maquetado y encaja (WhatsApp + Calendar + facturación, ROI de agenda claro). Pero manda el **acceso al cliente**: si tienes mejor entrada en hostelería o gestorías, empieza ahí.
- **Qué decides tú**: vertical + cliente, y **pymes o cadenas primero** (empezaría por **una pyme** para cerrar el ciclo rápido, luego cadena/franquicia).

### 1.2 Proveedores LLM + embeddings
- **Contexto**: requisito UE-first, router por tarea, BYOK, fallback (ya diseñado; catálogo en `models-catalog.js`).
- **Opciones**: Mistral (**UE nativa**, buena relación calidad/precio) · Claude/GPT/Gemini vía **regiones UE** del hosting (Azure UE, Bedrock UE, Vertex UE) para calidad · modelos abiertos autoalojados (enterprise).
- **Trade-off**: UE estricta ⇒ Mistral directo o los demás solo por región UE (más fricción). Calidad alta de redacción ⇒ Claude/GPT, pero confirmar términos de **no-entrenamiento** y región.
- **Recomendación**: para el **piloto**, **un** proveedor simple con región UE (p. ej. Claude o Mistral); el **router multi-proveedor** y BYOK llegan después (Paso 5). Embeddings: una opción UE (Mistral embed o un modelo abierto UE). No construir el router antes de tener 1 agente funcionando.

### 1.3 Proveedor de voz (TTS + clonación)
- **Front-runners** (de la investigación previa): **Cartesia** (optimizado telefonía 8 kHz, clon instantáneo ~3 s, **on-prem/on-device** ⇒ residencia UE controlable, barato) vs **ElevenLabs** (mejor calidad de clonación, pero **residencia UE solo Enterprise** y con matices).
- **Recomendación**: **capa de voz agnóstica** (adaptador, como el router de modelos). Arrancar el piloto con **Cartesia** por el encaje UE+telefonía+coste; validar con una **prueba propia de latencia UE y calidad de clonación** antes de fijar. Decisión a nivel de proveedor, no bloquea el resto.

### 1.4 WhatsApp: Cloud API directo vs BSP
- **Base (igual en todos)**: Meta cobra **por mensaje** (desde jul-2025) según país del destinatario; UE aprox. marketing ~€0,045, utility ~€0,025, auth ~€0,018; desde **oct-2026 también se cobran los mensajes de servicio**. Verificar la tarifa oficial de Meta antes de presupuestar.
- **Opciones**:
  - **Meta Cloud API directo**: sin markup de BSP, control total, datos en hosting UE de Meta. **Más desarrollo** (onboarding de números, plantillas, webhooks propios).
  - **360dialog** (BSP **europeo**): cuota fija ~€49-99/mes por número, **sin markup** por mensaje, menos desarrollo, buen encaje RGPD. Precios a confirmar (han cambiado en 2026).
  - **Twilio**: integración fácil pero **+~$0,005/mensaje** (se acumula a volumen).
- **Recomendación**: para salir rápido y con RGPD, **360dialog** (BSP UE, cuota fija, poco desarrollo). Si prioriza coste y control a escala, **Cloud API directo**. **Evitar Twilio** como canal principal por el markup por mensaje. Confirmar precios actuales antes de firmar.

### 1.5 Secretos de cliente (BYOK, tokens OAuth, muestras de voz)
- **Opciones**: **Supabase Vault** (integrado, pgsodium, simple, mismo proveedor) vs **KMS** (AWS `eu-central-1`, cifrado por sobres, estándar enterprise, independiente de Supabase).
- **Trade-off**: Vault = menos piezas y rápido, pero acopla a Supabase. KMS = más robusto/portable (clave para «tu nube»/on-prem enterprise) pero más complejo.
- **Recomendación**: **Vault para el v1** (rápido, suficiente para el piloto), con el **diseño preparado para KMS** (una interfaz `secrets` que permita cambiar el backend sin tocar el resto). No dependas de algo que solo exista en Supabase sin alternativa (requisito enterprise).

### 1.6 Worker always-on (cola, agentes, webhooks, cron)
- **Opciones**: **Railway** (lo más fácil, UE) · **Fly.io** (fácil, regiones UE, escala por máquina) · **Hetzner + Docker** (lo más barato a escala, UE, más manual).
- **Recomendación**: **Fly.io o Railway** para arrancar (velocidad > coste en el piloto); migrar a **Hetzner** si el coste manda al crecer. Cola: **pg-boss sobre el Postgres de Supabase** (ya decidido). Región UE obligatoria.

### 1.7 GitHub Team
- **Contexto**: hoy no se puede proteger `main` (plan Free, repo privado) — la regla «no mergear sin CI» solo la sostiene el proceso.
- **Recomendación**: **sí, pasar a GitHub Team ya** (coste bajo). Habilita branch protection + revisión obligatoria + que el agente no pueda mergear sin checks. Es barato y cierra un riesgo real.

### 1.8 Precios
- **Estado**: provisionales (49 €/agente, etc.). **Recomendación**: validarlos con la **disposición a pagar del cliente piloto** real antes de meterlos en Stripe. No publicar cifras hasta confirmarlas.

### 1.9 Plan de Supabase
- **Recomendación**: **Pro** (con **PITR**) para staging + prod en Frankfurt (proyectos separados). SSO/SAML y plan superior solo si se vende a enterprise (más adelante).

**Resumen de lo que hay que decidir YA para arrancar el Paso 1:** vertical+cliente piloto (1.1), GitHub Team (1.7), plan Supabase (1.9) y crear las cuentas alojadas. Lo demás (LLM/voz/WhatsApp/secretos/worker) se puede cerrar justo antes de su paso correspondiente, no bloquea el Paso 1 (entornos).

---

## 2. Flujos que faltan (diseñar antes de construir)

Para cada uno: propósito · pasos · estados · datos/entidades · seguridad. Los diseño en el prototipo cuando digas; aquí queda la especificación para auditar.

### 2.1 Invitar → aceptar miembro
- **Propósito**: alta de miembros por invitación (no INSERT directo). STATUS 3b.
- **Pasos**: admin invita (email, rol, plan) → email con enlace (Resend) → invitado acepta → se crea `public.users` + `membership`.
- **Estados**: pendiente / aceptada / caducada / revocada.
- **Datos**: `invitations`(email, rol, token, caducidad), `memberships`, `users`.
- **Seguridad**: token de un solo uso con caducidad; el alta de `public.users` por trigger `SECURITY DEFINER` sobre `auth.users` **requiere revisión humana**; retirar el INSERT directo actual.

### 2.2 Conectar canal (OAuth) + reconexión + plantillas WhatsApp
- **Propósito**: conectar WhatsApp/Gmail/Calendar/CRM con OAuth real.
- **Pasos**: elegir integración → OAuth (redirección al proveedor) → callback → guardar token cifrado → health check. WhatsApp: alta del número + **envío de plantillas a Meta** (estado: borrador/en revisión/aprobada/rechazada).
- **Estados**: conectando / conectada / error / caducada / reconectar.
- **Datos**: `integrations`, `integration_secrets`(cifrado), `whatsapp_templates`.
- **Seguridad**: tokens en bóveda; nunca en el navegador; scopes mínimos; **aceptar términos/OAuth es acción con consentimiento explícito**.

### 2.3 Alta de voz (persona + clonación + consentimiento) ★ nuevo edge
- **Propósito**: dar al agente de voz una **persona** y, opcional, **clonar la voz propia** del negocio.
- **Pasos**: elegir persona (sexo/tono/estilo/acento) → (opcional) **subir audios** para clonar → **consentimiento de uso de la voz** → prueba → publicar.
- **Estados**: sin voz / persona elegida / clonando / lista / error.
- **Datos**: `voice_personas`, `voice_samples`(audio + consentimiento + retención), `voice_eval_runs`.
- **Seguridad/RGPD**: la voz clonada exige **derecho/consentimiento** de la persona; retención y borrado; residencia UE del proveedor.

### 2.4 Revisar antes de aprobar (detalle de aprobación)
- **Propósito**: el paso «revisar» que hoy falta entre la lista y el envío.
- **Pasos**: abrir aprobación → ver contexto (conversación, factura, cambio propuesto) → editar / aprobar / rechazar → feedback (toast) → `audit_logs`.
- **Estados**: pendiente / aprobada / rechazada / editada.
- **Datos**: `approvals`, `executions`, entidad afectada.
- **Seguridad**: acción 🔒 según `role_permissions`; todo al registro.

### 2.5 Checkout / Stripe
- **Propósito**: alta de pago, prueba, portal.
- **Pasos**: elegir plan (agentes/sedes) → checkout Stripe (test) → prueba 14 días → suscripción → uso medido → aviso 80 % → paso al equipo 100 % → portal de cliente.
- **Estados**: trial / activa / morosa / cancelada.
- **Datos**: `billing_accounts`, `subscriptions`, `usage_records`, `usage_limits`, `invoices`.
- **Seguridad**: Stripe tokeniza el pago (nunca tocamos tarjeta); IVA ES (Stripe Tax/Holded); facturación electrónica a revisar con asesoría.

### 2.6 (menores, ya parciales)
- **Tomar el control** de una conversación y devolverla al agente.
- **Publicar versión de agente** (coach): propuesta → eval → 10 % → 100 % → vuelta atrás.
- **Ingesta de conocimiento** (subir PDF/URL/FAQ → indexar) y **export/borrado RGPD**.

---

## 3. Orden recomendado (pensar → decidir → hacer)

1. **Decidir ahora**: vertical+cliente piloto, GitHub Team, plan Supabase; y **crear cuentas** (Supabase/Vercel/Resend/Sentry). *(producto)*
2. **Diseñar los flujos 2.1–2.5** en el prototipo *(yo, sin backend)* → quedan como spec visual + contrato.
3. **Cerrar** LLM/voz/WhatsApp/secretos/worker **justo antes de su paso** (no bloquean el Paso 1).
4. **Arrancar Paso 1** (entornos staging) solo cuando 1 y 2 estén listos.

## 4. Riesgos a vigilar (auditar en cada decisión)
- **Residencia UE real**: ElevenLabs UE = Enterprise con matices; WhatsApp = hosting UE de Meta; LLM solo UE si vía Mistral o región UE del hosting; voz = Cartesia on-prem. **Nunca cruzar región en silencio.**
- **RGPD**: consentimiento de voz clonada, retención por tipo, export/borrado, subencargados.
- **Lock-in**: diseñar `secrets`, `models` y `voice` como adaptadores para poder cambiar proveedor.
- **Coste a escala**: WhatsApp por mensaje (evitar markup Twilio), LLM por tokens (router + caché), voz por minuto.
- **Seguridad del que actúa**: el orquestador y los agentes ejecutan — techo de autonomía, confirmación, auditoría, defensa ante inyección.

---

**Siguiente paso sugerido**: tú cierras las decisiones «de ahora» (§3.1); yo empiezo a **diseñar los flujos 2.1–2.5** en el prototipo para que queden auditados y listos antes de construir. ¿Te parece?
