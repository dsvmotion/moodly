# Benchmark: Langdock → Moodly AI

Fecha: 2026-10-07 · Estado: **PROPUESTO** (orientación de producto, no decisiones cerradas)

Revisión de langdock.com (menús, Seguridad, Enterprise, Precios y Modelos) para orientar
el desarrollo de Moodly hacia pymes, medianas empresas y cadenas. Cada punto enlaza la
sección del `docs/MANUAL.md` a la que afecta. Lo que ya está maquetado en `apps/site`
aparece con su ruta.

## 1. Qué es Langdock y en qué nos diferenciamos

Langdock es una plataforma de IA horizontal para empleados de empresa: chat, agentes,
flujos de trabajo y API sobre muchos modelos. Su comprador es TI o dirección de una
empresa mediana o grande.

Moodly es vertical: cuatro agentes listos para usar que atienden a los **clientes** del
negocio (WhatsApp, email, llamadas) y hacen trabajo de back-office. Su comprador es el
dueño o el gerente de una pyme o cadena.

**Conclusión:** copiamos su capa de confianza (seguridad, gobierno, despliegue, precios
transparentes, agnosticismo de modelo), pero no su producto. No construimos un chat
genérico para empleados.

## 2. Arquitectura de información de la web

| Langdock | Moodly (`apps/site`) | Estado |
|---|---|---|
| Platform: Chat, Workflows, Agents, Integrations, API, Models | Plataforma: Agentes, Integraciones, Modelos de IA, App móvil, Ver la plataforma | Hecho |
| Solutions por departamento | Sectores: clínicas, restaurantes, gestorías, inmobiliarias, agencias (`/sectores`) | Hecho |
| Learn: Docs, Customer stories, Changelog, Trust center | Recursos: Cómo funciona, Casos, Centro de confianza, Enterprise | Hecho |
| Security, Enterprise, Pricing (primer nivel) | Seguridad, Enterprise, Precios (primer nivel) | Hecho |
| Footer legal: Imprint, Privacy, Terms, Vulnerability disclosure, Status | Aviso legal, Privacidad, Términos, Cookies (plantillas con `[placeholders]`) | Hecho, pendiente de revisión legal |
| Docs, Changelog, Status, Brand kit, Careers | — | **Pendiente**: Changelog y Status cuando haya clientes; Docs cuando haya API |

## 3. Modelos de IA: agnóstico de proveedor → MANUAL §5.11, §3.2

Langdock ofrece todos los modelos de los grandes proveedores tras una sola interfaz, con
precios por millón de tokens, BYOK y despliegue en la nube del cliente.

**Propuesta para Moodly:**

1. **Enrutador de modelos por tarea.** Ya está en §5.11: clasificación, conversación,
   razonamiento y extracción, con modelos definidos en `packages/config`. Ampliarlo a un
   registro de proveedores (`model_providers`) con capacidades (texto, visión, voz),
   región (UE o no), coste y estado.
2. **Tres modos de conexión por organización** (pantalla `/plataforma/modelos`):
   - Incluido: claves de Moodly y consumo dentro de la cuota.
   - BYOK: claves del cliente, guardadas en la bóveda cifrada de §10.4.
   - Tu nube: Azure OpenAI, Bedrock o Vertex con las credenciales del cliente (Enterprise).
3. **Modelo fijado por agente** como sobrescritura opcional, con «Automático» por defecto.
   Encaja en la herencia de configuración de §4.3: org → sede → agente.
4. **Política «solo UE».** Es un filtro del enrutador. Si no hay modelo UE disponible,
   se hace paso a humano y nunca se pasa en silencio a una región fuera de la UE.
5. **Fallback entre proveedores.** Ya está en §5.11. Hay que registrar en `agent_runs`
   qué proveedor respondió.
6. **Enmascarado de datos personales antes del LLM.** Se apoya en la redacción de PII
   de §11.

Abrir un ADR: «Enrutador multi-proveedor y BYOK».

## 4. Seguridad y confianza → MANUAL §10, §11

La página de seguridad de Langdock funciona porque es concreta: certificaciones,
opciones de despliegue, bases de confianza, arquitectura, gobierno, documentos legales y
preguntas frecuentes. Rediseñada así en `/seguridad`.

**Reglas para Moodly:**
- **No declarar certificaciones que no tenemos.** ISO 27001 y SOC 2 aparecen como
  `[En hoja de ruta]` (§10.6). RGPD es «Diseñado para el RGPD», no «certificado».
- Pendiente de confirmar antes de publicar:
  - región y proveedor de alojamiento UE;
  - términos de no entrenamiento de cada proveedor de IA;
  - lista de subencargados;
  - plantilla de DPA.
- Añadir **política de divulgación responsable** (security@) y, más adelante, una página
  de **estado** del servicio.
- Riesgo específico de Moodly que Langdock no destaca: **agentes que actúan**. Por eso
  la web subraya la aprobación humana, el techo de autonomía (§5.6) y la defensa ante
  instrucciones maliciosas en mensajes de clientes (§10.1).

## 5. Enterprise y despliegue → MANUAL §3.4, §4.1

Langdock tiene cuatro niveles de despliegue según el número de puestos: SaaS multi-tenant,
single-tenant, nube propia y on-premise.

Moodly los adapta con **sedes** como métrica, no puestos:

| Nivel | Para quién | Implicación técnica |
|---|---|---|
| Nube compartida (UE) | Pymes | Lo actual: multi-tenant con RLS (§4.4) |
| Nube dedicada | Cadenas medianas | Proyecto Supabase por cliente; plantilla de infraestructura reproducible |
| Tu nube | Grandes cuentas | Despliegue en la cuenta del cliente; requiere empaquetado (contenedores) |
| On-premise | Casos regulados | Solo bajo demanda; no planificar antes de tener demanda real |

Umbrales `[desde N sedes]` por decidir con negocio. Requisito para no cerrar puertas:
**ningún servicio debe depender de algo que solo exista en Supabase Cloud** sin una
alternativa autoalojable.

## 6. Gobierno y administración → MANUAL §4.1, §10.2, §10.5

Langdock vende el gobierno como complemento (permisos, analítica, auditoría, SSO).

**Para Moodly:**
- **Roles por sede y permisos heredados.** Ya diseñados en §4.1 y §4.3. La central
  define políticas que las sedes no pueden relajar.
- **SSO** (Google Workspace / Entra ID) en Enterprise. **SCIM** en la hoja de ruta.
- **Registro de auditoría consultable** por el cliente (§10.5), con retención por plan.
- **Gobierno de agentes:** los cambios en prompts, reglas o skills pasan por revisión
  antes de publicarse, con versiones y vuelta atrás. Es nuevo y conviene añadirlo a §5.
- **Panel de consumo por sede y agente**, con límites y avisos (§15).

## 7. Interoperabilidad → MANUAL §7

Langdock destaca REST API, MCP, A2A, bases vectoriales propias y RAG a medida.

**Orden propuesto para Moodly:**
1. **Conectores MCP** como mecanismo genérico para «otras herramientas» (ya usado en el
   copy de `/integraciones`).
2. **Webhooks salientes** de eventos (cita creada, lead cualificado, factura aprobada).
3. **API REST pública** (marcada «Próximamente» en precios).
4. **A2A y RAG o base vectorial del cliente**: solo Enterprise y bajo demanda.

## 8. Precios → MANUAL §1.10, §15

Langdock tiene controles a la izquierda (usuarios, mensual/anual, complementos), planes
que se recalculan, complementos con precio propio y una comparativa. Es transparente y
autoservicio.

**Aplicado en `/precios`:**
- Configurador: agentes, conversaciones al mes, voz, sedes. Recalcula dentro del modelo
  decidido: implantación de 1.000 a 5.000 € más una cuota de 50 a 100 € al mes.
- Planes Pymes (precio calculado) y Enterprise (a medida, recomendado desde 3 sedes).
- Complementos:
  - voz;
  - sede adicional;
  - BYOK (cuota reducida, `[por confirmar]`);
  - gobierno avanzado;
  - API («Próximamente»).
- **Sin descuento anual inventado.** Si se decide ofrecerlo, añadir el conmutador
  mensual/anual.

**Decisiones abiertas para negocio:**
- precio con BYOK;
- umbral de Enterprise;
- política de exceso de consumo (hoy: «avisamos antes, nunca cobramos sin aprobación»);
- permanencia o preaviso.

## 9. Próximos pasos sugeridos

1. ADR: enrutador multi-proveedor y BYOK (§3).
2. Añadir a §5 el gobierno de agentes con versiones y aprobación de cambios.
3. Confirmar los datos `[por confirmar]` de seguridad y legales y pasar los textos
   legales por asesoría.
4. Backend del formulario de contacto y demo: tabla `leads` o CRM. Hay
   `TODO(backend)` en `demo-form.jsx` y `contact-form.jsx`.
5. Changelog y página de estado cuando haya clientes en producción.
