> **BORRADOR — pendiente de revisión por un abogado; no publicar.**
> Preparado el 2026-11-12 por la sesión V13 · Legal. No es asesoramiento jurídico. Es una **plantilla** para que cada negocio que usa Moodly informe a sus clientes. El responsable de esos datos es el negocio; Moodly es su encargado. Base: art. 50.1 del Reglamento (UE) 2024/1689 (aplicable desde el 2 de agosto de 2026 [verificar que no lo ha aplazado ninguna modificación]) y arts. 13 y 14 del RGPD.

# Nota de transparencia: estás hablando con un asistente de IA

Tres piezas: el aviso dentro de la conversación (obligatorio), la nota corta enlazada y el texto que el negocio añade a su política de privacidad.

## A. Aviso dentro de la conversación (lo dice el agente)

Al empezar cada conversación nueva, o cuando el cliente pregunte, el agente se identifica. Texto base (el agente lo adapta al idioma del cliente sin cambiar su contenido):

> Hola, soy el asistente virtual de **[NOMBRE DEL NEGOCIO]**. Soy un sistema de inteligencia artificial, no una persona. Puedo ayudarte con [citas, dudas sobre servicios, horarios…]. Si prefieres hablar con alguien del equipo, dímelo y te paso. Más información: [ENLACE A LA NOTA].

Reglas de producto que esta nota da por hechas (regla de plataforma del prompt, MANUAL §5.3 y §11) y que hay que comprobar con evals antes de publicarla:

1. El agente **nunca niega ser una IA** ni dice ser una persona, aunque se le pida.
2. Si el cliente pide hablar con una persona, la conversación **pasa a una persona** del negocio (MANUAL §5.10) y el agente lo dice.
3. En WhatsApp, el primer mensaje de cada conversación iniciada por el negocio lleva la identificación en la plantilla [verificar que las plantillas lo incluyen].
4. En voz (cuando llegue, con ElevenLabs), el aviso se dice al principio de la llamada y el audio sintético se marca como tal (art. 50.2 del Reglamento de IA) [verificar alcance con la asesoría].

## B. Nota corta (enlazada desde el aviso)

**El asistente de [NOMBRE DEL NEGOCIO]**

- **Qué es:** un asistente de inteligencia artificial que contesta mensajes y gestiona citas y consultas en nombre de [NOMBRE DEL NEGOCIO]. Funciona con la plataforma Moodly.
- **Qué hace:** responde con la información que le ha dado el negocio. Si no sabe algo, no se lo inventa: lo pregunta al equipo y te contesta después, o te pasa con una persona.
- **Qué no hace:** no da consejos médicos, jurídicos ni fiscales, y no toma decisiones importantes sobre ti sin que intervenga una persona del negocio. Los cobros, envíos de documentos y cambios sensibles requieren la aprobación de alguien del equipo.
- **Hablar con una persona:** escribe «quiero hablar con una persona» en cualquier momento.
- **Tus datos:** los trata [NOMBRE DEL NEGOCIO] como responsable, para atender tu consulta y gestionar tus citas. Moodly los trata por su cuenta como encargado. Para responderte, el texto de la conversación se envía a proveedores de modelos de IA, que **pueden procesarlo fuera de la Unión Europea** con las garantías del RGPD. Más información y tus derechos: [ENLACE A LA POLÍTICA DE PRIVACIDAD DEL NEGOCIO].

## C. Texto para la política de privacidad del negocio

> **Atención mediante asistente de IA.** Para atender los mensajes que nos envías por [WhatsApp / chat web / email], usamos un asistente de inteligencia artificial de la plataforma Moodly ([RAZÓN SOCIAL], [DOMICILIO SOCIAL]), que trata tus datos por nuestra cuenta como encargado del tratamiento. Tratamos tu nombre, tu teléfono o email, el contenido de la conversación y los datos de tus citas para atender tu consulta y gestionar tus reservas (base jurídica: la relación precontractual o contractual contigo, art. 6.1.b RGPD) [y, si el asistente guarda preferencias para atenderte mejor en el futuro, nuestro interés legítimo, art. 6.1.f — ver el cribado de EIPD]. El texto de la conversación se envía a proveedores de modelos de IA, que pueden tratarlo fuera del Espacio Económico Europeo con cláusulas contractuales tipo o el Marco de Privacidad de Datos UE-EE. UU. Conservamos las conversaciones [plazo que fije el negocio]. Puedes pedir hablar con una persona en cualquier momento y ejercer tus derechos escribiendo a [CONTACTO DEL NEGOCIO].

## Notas para la asesoría

1. **Quién está obligado:** Moodly es *proveedor* del sistema (art. 50.1: diseñarlo para que la persona sepa que interactúa con una IA, salvo que sea evidente); el negocio es *responsable del despliegue*. Ver `07-evaluacion-ai-act.md`.
2. **Categorías especiales:** en estética sin tratamientos médicos no deberían aparecer datos de salud, pero el cliente final puede contarlos (alergias, embarazo). La nota no lo resuelve: ver el cribado de EIPD, riesgo 2.
3. **Memoria:** si el asistente recuerda preferencias entre conversaciones (MANUAL §6.2), hay que decirlo aquí con su base y su plazo.
