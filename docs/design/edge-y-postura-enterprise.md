# Antes del backend: postura enterprise + ventaja competitiva (edge)

Fecha: 2026-10-08 · Estado: **PROPUESTO** (para decidir con producto antes de fijar el scope del backend).

Responde a dos preguntas antes de construir:
1. **Postura enterprise**: ¿el diseño aguanta venderle a una empresa exigente? (seguridad, confidencialidad, datos, despliegue, modelos, cloud).
2. **Edge**: ¿qué hace a Moodly medible-mente mejor que un bot genérico, GuruSup o Langdock?

La conclusión adelantada: la **postura enterprise ya está diseñada** (solo faltan decisiones, no rediseño). El **edge más fuerte y aún poco desarrollado es la «Voz del negocio»**, y conviene subirlo a capa de primer nivel desde el día 1 — eso **amplía el scope del backend** con una capa de Voz (§5).

---

## 1. Postura enterprise: lo que ya está y lo que falta decidir

Todo esto ya está en el diseño o en los documentos; lo que falta son **decisiones**, no pantallas.

| Pilar | Estado del diseño | Qué falta (decisión) |
|---|---|---|
| Aislamiento por cliente | RLS forzada por tenant + revocación de sesión real (hecho en BD) | Extender a cada tabla nueva con su pgTAP |
| Confidencialidad frente al LLM | Diseñado: enmascarado de PII antes de la llamada; lo entrante siempre como datos | Implementar en `agent-core`; elegir proveedores con no-entrenamiento |
| Secretos de cliente (BYOK, OAuth) | Diseñado: bóveda cifrada, nunca legible desde el navegador | **Mecanismo: Supabase Vault vs KMS** (abierto) |
| Residencia de datos | UE-only, pantalla de Modelos con residencia UE/US/Global | Confirmar proveedor y región de alojamiento |
| Derechos RGPD | Exportar/borrar, retención por tipo, audit log (pantalla Auditoría) | `data_requests` + jobs de purga |
| Gobierno y auditoría | Roles/permisos, registro de auditoría, separación por sede/franquicia | `audit_logs` de solo inserción |
| Despliegue por escala | Nube compartida / dedicada / tu nube / on-prem (`arquitectura-agentes-enterprise.md`) | Umbrales por nº de sedes |
| Modelos de IA | Enrutador multi-proveedor, BYOK, «solo UE», fallback (pantalla Modelos) | Proveedores LLM + embeddings |
| Cloud / servidores | Workers stateless + colas; sin VPS por agente; celdas dedicadas enterprise | Proveedor del worker (Fly/Railway/Hetzner) |
| Auth enterprise | SSO SAML, SCIM, allowlist de IP, invalidación global (pantalla Seguridad) | Plan de Supabase para SSO |

**Veredicto:** la capa de confianza está diseñada a nivel Langdock. No bloquea el backend; se ejecuta por capas (plan de la auditoría de plataforma §7).

---

## 2. El edge principal: la «Voz del negocio»

**El problema del mercado:** los competidores te dan *un bot*. Suena a bot, o suena igual para todos. El dueño de un negocio con carácter (una clínica de confianza, un restaurante con personalidad, una asesoría seria) nota el bache: «esto no habla como nosotros».

**La propuesta de Moodly:** los agentes no solo saben del negocio — **suenan como ese negocio**. Su tono, su vocabulario, sus manías, su forma de saludar, de tratar una queja, de cerrar. Igual en los 4 agentes, en cada canal, en cada sede, y **mejorando con el tiempo**. Esto es defendible y medible, y hoy está solo esbozado (campo «tono» en Contexto de empresa y Memoria).

### Qué es, en concreto, un «perfil de voz»
- **Persona y tono**: adjetivos de marca (cercano, sobrio, con humor sutil…), nivel de formalidad (**tú/usted**, ajustable por edad/segmento), energía, concisión.
- **Registro por canal**: WhatsApp más informal que el email; voz (teléfono) distinta del chat.
- **Idioma y variante**: es-ES / es-MX / catalán / euskera…, no solo «español».
- **Léxico propio**: cómo llaman a sus servicios, cómo se refieren a sí mismos («la clínica», «nosotros»), nombres de marca, **términos prohibidos**, emojis sí/no, despedida/firma.
- **Peculiaridades**: saludo propio, cómo gestionan una queja, cómo piden una reseña, cómo derivan a una persona.
- **Guardarraíles de voz**: lo que **nunca** dicen (consejo clínico, promesas de resultado, precios sin confirmar) y el tono obligado ante urgencias/quejas.

### Cómo se construye (encaja con lo que ya hay)
1. **Arranque (onboarding)**: 4-5 preguntas + «pega 5 mensajes reales vuestros» → el sistema **infiere** el perfil de voz (extracción de estilo + few-shot). Nuevo paso natural del asistente de alta que ya rediseñamos.
2. **Aprende**: de las ediciones humanas, las tomas de control y los mensajes aprobados salen **propuestas de ajuste de voz** → se aprueban en **Modo coach** → pasan **evals de voz** → publicación gradual con vuelta atrás. Reutiliza el ciclo de aprendizaje y `agent_versions` ya diseñados.
3. **Se aplica**: la voz entra como **capa de estilo** en el montaje de contexto (`agent-core`), **separada** del contenido (conocimiento) y de la política (autonomía). Nunca mezcla «qué decir» con «cómo decirlo».

### Por qué es un edge de verdad
- **Consistencia de marca a escala**: crítico para cadenas y **franquicias** — la central fija la voz y las sedes la heredan (ya tenemos herencia y bloqueo de claves; la pantalla Red lo muestra).
- **Barrera de salida sana**: cuanto más aprende tu voz, más cuesta cambiarte (lock-in por valor, no por candado).
- **Medible y vendible**: «tus agentes suenan un 92% como tú» es una métrica de producto y un gancho comercial que un bot genérico no puede dar.

---

## 3. Otros edges (ya en el diseño; subrayarlos en producto y web)

- **Agentes que ACTÚAN con techo de autonomía + aprobación** — reservan, facturan, mueven agenda; no solo responden. La aprobación humana es *feature*, no límite.
- **Aprenden y mejoran** (coach + señales + versiones + publicación gradual + vuelta atrás). Un bot normal es estático.
- **Memoria que compone** (del cliente final y del negocio): contexto acumulado que ningún proveedor nuevo tiene.
- **Residencia UE sin fugas**: si no hay modelo UE con calidad, **paso a humano**, nunca cruzar región en silencio. Compliance como producto.
- **Multi-agente coordinado** (recepción/atención/comercial/admin comparten memoria) frente a un único bot.

---

## 4. Riesgo específico a cubrir (porque los agentes actúan)

- **Inyección de instrucciones** en mensajes de clientes: lo entrante es **siempre dato**, nunca orden. Defensa explícita antes de cada llamada.
- **Suplantación de voz**: los guardarraíles de voz impiden que el agente prometa lo que el negocio no quiere, aunque el cliente insista.
- **Few-shot con datos reales**: si guardamos mensajes del negocio como ejemplos de estilo, hay que tratar **consentimiento, anonimización y retención** (RGPD).

---

## 5. ¿Amplía el scope del backend? Sí: una capa de «Voz»

No es una arquitectura nueva — **extiende** la herencia y el versionado que ya están en el plan (`config_overrides`, `config_snapshots`, `agent_versions`). Entidades nuevas:

- `voice_profiles` — perfil de voz **resuelto por herencia** (red → organización → región → local → agente → canal), **versionado**.
- `voice_rules` / `lexicon` — do/don't, términos propios y prohibidos, formalidad por canal/segmento, firma, política de emojis.
- `voice_samples` — few-shot: mensajes reales del negocio, **con consentimiento y retención propias**.
- `voice_eval_runs` — «¿suena a ellos? ¿respeta los guardarraíles?» como **puerta de publicación** (igual que las evals de agente).
- Señales de voz en el ciclo de aprendizaje (una edición que cambia el tono → propuesta de ajuste).

Implicaciones para `packages/agent-core`: el montaje de contexto trata **ESTILO (voz)** como capa propia, distinta de **CONTENIDO (conocimiento)** y **POLÍTICA (autonomía)**. El pipeline de publicación añade una **eval de voz**.

**Coste de meterlo ahora vs después:** barato ahora (encaja en la herencia y el onboarding ya diseñados); caro después (habría que reabrir el modelo de configuración y el asistente de alta). Recomendación: **capa de primer nivel desde el día 1**, aunque el motor de aprendizaje de voz llegue en una fase posterior.

---

## 6. Decisiones a cerrar antes del backend

Nuevas (de este documento):
1. **¿La «Voz del negocio» es capa de primer nivel desde el día 1?** (recomendado sí) — define `voice_profiles` y el paso de voz en el onboarding.
2. **¿Guardamos mensajes reales del negocio como few-shot?** (consentimiento, anonimización, retención) — decisión de datos/RGPD.
3. **¿La central (franquicia) puede bloquear la voz para toda la red?** (encaja con la herencia; recomendado sí).

Ya abiertas (de las auditorías anteriores, siguen bloqueando):
4. Mecanismo de secretos de cliente (Vault vs KMS).
5. Proveedores LLM + embeddings, y si hay modelo UE con calidad suficiente para la «voz».
6. Vertical y cliente piloto; pymes o cadenas primero.
7. GitHub Team (proteger `main`).

---

## 7. QA de diseño (2026-10-08): hallazgos

Revisión visual de todas las pantallas operativas, de configuración/gobierno y de agente. **El diseño es consistente y a nivel; sin errores de maquetación ni incoherencias de marca.** Corregido:
- Auditoría: retención «[N] días» → «365 días».
- Contexto de empresa: «en el centro de [ciudad]» → «de la ciudad».

Intencionales (se mantienen): `[por confirmar proveedor y región]` y `[desde N sedes]` en Seguridad/Enterprise son marcadores deliberados de hechos sin confirmar (benchmark-langdock §4). Los 36 enlaces `href="#"` del prototipo son placeholders que se resuelven al reconstruir en `apps/web`.
