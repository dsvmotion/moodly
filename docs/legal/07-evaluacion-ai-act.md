> **BORRADOR — pendiente de revisión por un abogado; no publicar.**
> Preparado el 2026-11-12 por la sesión V13 · Legal con el esquema de la skill `ai-governance-legal-ai-inventory` (rol y nivel de riesgo **por sistema**, no por empresa). No es asesoramiento jurídico. El perfil de práctica de la skill no existe en este entorno: la entrevista inicial se ha contestado con el repositorio (MANUAL §1.4, §5, §6, §11; ADR 0023, 0029, 0030, 0046, 0047, 0051, 0052). Las referencias van marcadas `[verificar con el texto vigente del Reglamento]`: no es prudencia de estilo, es que el Reglamento se aplica por fases hasta 2027 y hay propuestas de modificación en curso («ómnibus digital», noviembre de 2025) cuyo estado a la fecha no he podido comprobar.

# Reglamento (UE) 2024/1689 de IA: rol y nivel de riesgo de los agentes de Moodly

## 1. Conclusión

- **Rol de Moodly:** *proveedor* (art. 3.3) de cada agente, porque los desarrolla integrando modelos de propósito general de terceros y los pone en servicio con su nombre. **No** es proveedor de los modelos de propósito general (GPAI): esos son OpenAI, Anthropic, Google, etc. El **cliente** es *responsable del despliegue* (art. 3.4).
- **Nivel:** los seis papeles del piloto son de **riesgo limitado** (obligaciones de transparencia del art. 50) **si se respetan las condiciones de la sección 4**. Ninguno toca una práctica prohibida del art. 5 ni un área del Anexo III con el diseño actual.
- **Dos riesgos de recalificación a alto riesgo**, que dependen de cómo se construyan:
  1. el **coach** y el **asistente del dueño**, si evalúan el rendimiento o el comportamiento de personas trabajadoras o les asignan tareas según rasgos personales (Anexo III, punto 4.b);
  2. un **agente propio** (ADR 0030) que el cliente configure para un uso del Anexo III (seleccionar candidatos, decidir sobre crédito). La cláusula 8 de las condiciones lo prohíbe sin acuerdo.
- **Ya aplicable hoy:** alfabetización en IA (art. 4, desde el 2-2-2025) para el equipo de Moodly y prohibiciones del art. 5 (desde el 2-2-2025). **Transparencia del art. 50:** desde el 2-8-2026 [verificar con el texto vigente del Reglamento, art. 113].

## 2. Inventario (formato de la skill)

```yaml
systems:
  - id: sys-001
    name: "Recepción (reception)"
    owner: "Producto / Diego"
    description: "Conversa con clientes finales por chat web y WhatsApp (voz después) y crea, mueve y cancela citas en la agenda del negocio."
    status: in_development
    eu_nexus: true
    role: provider
    role_basis: "Moodly lo desarrolla sobre modelos GPAI de terceros y lo pone en servicio con su nombre; el cliente lo despliega [verificar con el texto vigente del Reglamento, art. 3.3 y 3.4]"
    tier: limited
    tier_basis: "Sistema destinado a interactuar directamente con personas físicas: art. 50.1 [verificar con el texto vigente del Reglamento]. Con voz, además art. 50.2 (marcado de audio sintético)."
    obligations_assessed: false
    next_review: "al añadir la voz o antes del primer dato real"
  - id: sys-002
    name: "Atención al cliente (customer)"
    owner: "Producto / Diego"
    description: "Atiende mensajes entrantes (WhatsApp, chat web, email; Instagram más adelante): dudas, incidencias, reseñas y paso a una persona."
    status: in_development
    eu_nexus: true
    role: provider
    role_basis: "Igual que sys-001 [verificar con el texto vigente del Reglamento]"
    tier: limited
    tier_basis: "Art. 50.1 [verificar con el texto vigente del Reglamento]"
    obligations_assessed: false
    next_review: "antes del primer dato real"
  - id: sys-003
    name: "Comercial (sales)"
    owner: "Producto / Diego"
    description: "Cualifica leads, registra en el CRM, hace seguimiento y recupera clientes; ejecuta campañas que propone el coach."
    status: planned
    eu_nexus: true
    role: provider
    role_basis: "Igual que sys-001 [verificar con el texto vigente del Reglamento]"
    tier: limited
    tier_basis: "Art. 50.1. La cualificación de leads no es un área del Anexo III mientras no decida sobre crédito, seguros o acceso a servicios esenciales [verificar con el texto vigente del Reglamento, Anexo III punto 5]"
    obligations_assessed: false
    next_review: "al diseñar la cualificación de leads"
  - id: sys-004
    name: "Administración (admin)"
    owner: "Producto / Diego"
    description: "Prepara facturas a través del software del cliente, recuerda cobros, inventario y documentos para la gestoría."
    status: planned
    eu_nexus: true
    role: provider
    role_basis: "Igual que sys-001 [verificar con el texto vigente del Reglamento]"
    tier: limited
    tier_basis: "Art. 50.1 cuando escribe a personas. Recordar pagos no es evaluar la solvencia (Anexo III 5.b) si no puntúa ni decide sobre crédito [verificar con el texto vigente del Reglamento]"
    obligations_assessed: false
    next_review: "al diseñar cobros"
  - id: sys-005
    name: "Asistente del dueño (ADR 0029)"
    owner: "Producto / Diego"
    description: "Ayuda al equipo del cliente a gestionar la plataforma y orquesta a los agentes, con los permisos del usuario."
    status: planned
    eu_nexus: true
    role: provider
    role_basis: "Igual que sys-001 [verificar con el texto vigente del Reglamento]"
    tier: limited
    tier_basis: "Art. 50.1; riesgo de Anexo III 4.b si se usa para evaluar o asignar tareas a trabajadores (ver condiciones) [verificar con el texto vigente del Reglamento]"
    obligations_assessed: false
    next_review: "al aceptar el ADR 0029"
  - id: sys-006
    name: "Coach (ADR 0046)"
    owner: "Producto / Diego"
    description: "Revisa el negocio (gestión, contabilidad, marketing, tendencias) y propone mejoras al dueño."
    status: planned
    eu_nexus: true
    role: provider
    role_basis: "Igual que sys-001 [verificar con el texto vigente del Reglamento]"
    tier: limited
    tier_basis: "Art. 50.1. Riesgo de Anexo III 4.b si sus recomendaciones evalúan el rendimiento o el comportamiento de personas trabajadoras concretas [verificar con el texto vigente del Reglamento]"
    obligations_assessed: false
    next_review: "al aceptar el ADR 0046"
```

## 3. Cómo se ha clasificado

1. **Art. 5 (prohibidas):** ningún agente usa técnicas subliminales, explota vulnerabilidades, puntúa socialmente, reconoce emociones en el trabajo o la educación, categoriza biométricamente ni identifica a distancia. **Ojo con dos diseños futuros:** la detección del «sentimiento» de un cliente final por texto no es reconocimiento de emociones en el sentido del Reglamento (que se basa en datos biométricos, art. 3.39) [verificar]; pero si con la voz se infieren emociones a partir de la voz, sí podría serlo, y en el ámbito laboral estaría prohibido.
2. **Anexo III (alto riesgo):** ver los dos riesgos de la sección 1. Ningún otro punto encaja: no hay biometría, infraestructuras críticas, educación, servicios públicos, policía, migración ni justicia.
3. **GPAI:** Moodly no entrena ni pone en el mercado modelos de propósito general. Si algún día hace un ajuste fino de un modelo GPAI y lo distribuye, habría que revisarlo [verificar con el texto vigente del Reglamento, considerando 109 y Directrices de la Comisión sobre GPAI].
4. **Modificación sustancial (art. 25):** si un cliente configura un agente propio para un uso del Anexo III, podría pasar a ser él el proveedor de un sistema de alto riesgo. Las condiciones lo prohíben sin acuerdo previo.

## 4. Condiciones para mantener el riesgo limitado

| # | Condición | Dónde se cumple | Estado |
|---|---|---|---|
| C1 | El agente se identifica como IA al empezar y nunca lo niega | Regla de plataforma 1 (`packages/agent-core/src/runtime/prompt.ts`: «You are an AI assistant. Say so in your first message, and whenever someone asks») y el check `saysItIsAI` de las evals (`packages/evals/src/conversations/checks.ts`) | Hecho en el texto y con eval de modelo falso; falta comprobar con el modelo real que no lo niega cuando el cliente insiste («¿seguro que no eres una persona?») |
| C2 | Paso a una persona siempre disponible | MANUAL §5.10 | En diseño |
| C3 | Voz: aviso al empezar la llamada y audio sintético marcado | ADR de voz (pendiente) | Abierto |
| C4 | El coach y el asistente del dueño no puntúan ni clasifican a personas trabajadoras ni asignan tareas según su comportamiento o rasgos | ADR 0046 («privacidad del personal») | Por fijar como regla y probar con evals |
| C5 | Ningún agente decide sobre crédito, seguros o acceso a servicios esenciales | Diseño de `sales` y `admin` | Por fijar |
| C6 | Agentes propios: el cliente no puede configurarlos para usos del Anexo III sin acuerdo | Condiciones, cláusula 8 | Borrador |
| C7 | Alfabetización en IA del equipo de Moodly y guía para los clientes (art. 4) | Formación y documentación | Abierto |
| C8 | Información al responsable del despliegue sobre el sistema (capacidades, límites, que puede equivocarse) | Condiciones, cláusula 9; documentación de producto | Borrador |

## 5. Siguiente paso

Hacer una evaluación de impacto de IA completa (skill `ai-governance-legal-aia-generation`) del coach antes de aceptar el ADR 0046, porque es el que tiene el riesgo de recalificación más claro. Revisar este inventario al añadir la voz, al abrir los agentes propios y en cada cambio del Reglamento.
