# 0052 — Una capa de canales: mensaje normalizado, entrada firmada y sin duplicados, estados de entrega y plantillas (T10)

- **Estado:** aceptado (producto, 2026-11-12)
- **Fecha:** 2026-11-11
- **Secciones del MANUAL afectadas:** §3.3 (`packages/channels`), §7.2, §8, §18.0 (arquitectura: T10 «ya»)
- **Relación:**
  - auditoría de preproducción §17.3 T10 y T2, §18.2 («T10: do it now»), §18.3 #4 (dos familias de canales), §18.5 V1 #7, hallazgos O-01, D-03, R-01 y R-02;
  - mantiene el ADR 0020 (WhatsApp por la Cloud API de Meta, sin BSP);
  - Instagram y Messenger, por ManyChat o un socio parecido (MANUAL §18.0), no por una integración propia con Meta;
  - el acceso del worker a los datos es el del ADR 0049, y el contenido se cifra como dice el 0050;
  - unidades `PL-T10` y `PL-T2` (M1) y las `ch-*` del área `channels` de `docs/scope.yaml`.

## Contexto

- **No hay ningún canal que llegue a un cliente** (O-01). `packages/channels/src/index.ts` está vacío (`export {}`). El «envío» del agente es una fila con `status: 'sent'` (`apps/worker/src/agents/conversation-sender.ts:17-26`); el chat web y el de prueba la leen de ahí.
- **El modelo de datos ya prevé canales:** `channel_accounts` (`20261031130000_contacts_conversations.sql:51-65`, único por canal e id externo), los canales de una conversación (`20261109230000_inbox_takeover.sql:54`) y los estados de un mensaje, de `received` a `failed` (`20261031130000:207-208`).
- **No hay deduplicación de lo que entra** (D-03). El comentario de `messages.external_message_id` dice que va en `inbound_events` (`20261031130000:205`), pero esa tabla no existe.
- **No hay orden por conversación** (R-01). Cada evento se entrega en una cola única con 4 workflows a la vez (`apps/worker/src/events/outbox.ts:128-132` y `178`): dos mensajes seguidos del mismo cliente pueden producir dos turnos y dos respuestas.
- **El agente puede escribir después de que una persona tome el control** (R-02): el sender no mira `conversations.mode`.
- **El worker no tiene servidor HTTP**, y la web no puede escribir datos de un tenant sin una sesión (CLAUDE.md: nada de clave secreta en `apps/web` para datos de usuario).
- La versión de DBOS que usamos (`@dbos-inc/dbos-sdk` 5.3.0) ya trae colas con partición y concurrencia por partición (`partitionConcurrency`, en su `dist/src/wfqueue.d.ts:36-41`) y un *debouncer* (`dist/src/debouncer.d.ts`).

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **A. Cada canal a mano en el worker**, empezando por WhatsApp | Lo más rápido para el primer canal | Deduplicación, estados, ventana de 24 h, plantillas y orden repetidos en cada canal; el séptimo canal cuesta lo mismo que el primero |
| **B. Una capa propia en `packages/channels`** con un adaptador por canal | Las reglas difíciles (firma, duplicados, orden, estados, toma de control) se escriben y se prueban una vez; cada canal nuevo es un adaptador | Diseñar la interfaz antes de tener el segundo canal; hay que acertar con lo común |
| **C. Un agregador omnicanal** (Twilio, Bird, Infobip, Sinch…) | Una API para muchos canales | Cobro por mensaje y un subencargado más para todo el tráfico; contradice el ADR 0020; los canales de equipo (Slack, Discord) no encajan |

## Decisión recomendada

**Opción B**, con un socio solo donde la plataforma no deja otra vía (Instagram y Messenger).

1. **El contrato (`packages/channels`):**
   - `NormalizedInbound` y `NormalizedOutbound` (MANUAL §8): texto, adjuntos, botones o listas cuando el canal los tiene, identidad del contacto, cuenta del canal e id del proveedor;
   - `ChannelAdapter` por canal: comprobar la firma, convertir lo que llega en mensajes normalizados, enviar, traducir los avisos de estado del proveedor y declarar lo que admite (longitud máxima, botones, plantillas, ventana de 24 h);
   - dos familias: **canales del cliente** (WhatsApp, chat web, email, Telegram, voz más adelante, Instagram y Messenger por socio) y **canales del equipo** (Slack, Discord, Teams), por donde llegan avisos y aprobaciones.
2. **Entrada (T2):**
   - un proceso de entrada (`ingress`) en el servicio del worker en Railway (región UE), separable a su propio servicio cuando haga falta escalarlo;
   - comprueba la firma y escribe en **`inbound_events`**, con clave única (cuenta del canal, id del evento del proveedor): un reintento del webhook no crea nada nuevo;
   - la organización sale de la fila de `channel_accounts` que corresponde a la cuenta firmada, nunca de otro campo del payload;
   - arranca el turno directamente, con el id del workflow derivado del id del mensaje del proveedor (sin esperar al sondeo del outbox).
3. **Un turno por conversación:** cola de DBOS con partición por `conversation_id` y concurrencia 1, y un *debouncer* corto para juntar ráfagas de mensajes (cierra R-01).
4. **Salida:**
   - el mensaje se guarda `pending` y el adaptador lo envía en un paso de DBOS con clave de idempotencia;
   - antes de enviar, el paso vuelve a mirar `conversations.mode`: si ya no es `agent`, no envía (cierra R-02);
   - los avisos del proveedor mueven el estado: `sent`, `delivered`, `read` o `failed`. Un `failed` se ve en la bandeja.
5. **Plantillas:** un registro `message_templates` por cuenta de canal (nombre, idioma, categoría, variables y estado de aprobación en Meta). Fuera de la ventana de 24 h de WhatsApp solo salen plantillas aprobadas; los recordatorios usan plantilla.
6. **Consentimiento:** el adaptador no envía nada iniciado por la empresa sin el consentimiento que corresponde (`contacts.consents`, `20261031130000:82`; ADR 0047); el de marketing es aparte del de recordatorios (auditoría §18.6).
7. **Orden de los canales** (`docs/scope.yaml`): WhatsApp y chat web (M1), email (M2), Telegram y Slack (M3); Instagram, Messenger y Discord como *stretch* de M4; voz, SMS, Signal y Teams después del piloto. Signal no tiene una API oficial para empresas que conozcamos: se comprueba antes de prometerlo. La voz tendrá su propio ADR.

## Consecuencias

- **Se gana:** el primer cliente real recibe respuestas; los reintentos de los webhooks no duplican; un mensaje a mitad de turno da una sola respuesta; un canal nuevo es un adaptador y sus tests.
- **Coste:** una migración (`inbound_events`, `message_templates` y la cola nueva), el proceso de entrada y el adaptador de WhatsApp en M1, con la verificación de Meta (F05) como camino crítico.
- **Riesgos:**
  - mientras haya una sola réplica del worker (J-04), la entrada cae con él; los proveedores reintentan los webhooks (el plazo de cada uno, a verificar), y la alerta de «worker parado» es de la puerta de M1;
  - el socio de Instagram es un subencargado más, con su DPA (F10).
- **El chat web** usa la misma entrada: el widget envía al proceso de entrada y recibe las respuestas de él, sin tocar Supabase desde el navegador del visitante.

## Qué la haría «aceptada»

1. Producto dice sí.
2. Los tests de la puerta de M1 pasan:
   - un webhook de prueba de WhatsApp repetido crea exactamente un mensaje;
   - un segundo mensaje que llega a mitad de turno produce una sola respuesta;
   - con la conversación pasada a una persona a mitad de turno, el agente no envía nada;
   - una respuesta, un mensaje del equipo y un recordatorio llegan a un número de prueba con su estado de entrega.

## Verificación

Pendiente: es lo que pide el punto 2 de «Qué la haría aceptada».
