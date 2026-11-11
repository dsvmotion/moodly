# Modelo de precios: plan mensual + uso

Fecha: 2026-10-07 · Revisado: 2026-11-11 · Estado: **PROPUESTO**. Los costes de proveedores
salen de sus webs oficiales, consultadas el 7 oct 2026. Nuestros precios son una propuesta
a validar con el coste medido en 2 o 3 pilotos.

La web pública no muestra importes de planes: `apps/site/src/components/pricing.js` solo
lleva lo decidido (la prueba). Cuando producto cierre estos importes, van allí.

> **Actualización (producto, 2026-11-11):** cambian la unidad y el posicionamiento.
> - **Posicionamiento: servicio premium.** No competimos por precio. Competimos por hacer el trabajo completo, con seguridad, control y rapidez. Los precios tienen que dejar margen.
> - **La unidad pasa del agente a la empresa.** Tres planes (Esencial, Equipo y Empresa) sustituyen a los 49 € por agente. Los cuatro agentes de serie van en todos los planes.
> - **Nivel de precio alto.** Producto eligió el 2026-11-11 los importes de §2 (149 €, 399 € y 200 € por sede) frente a una primera propuesta de 98 €, 298 € y 150 €, que dejaba un 52 %, 48 % y 70 % de margen. Se validan con el coste medido en el piloto (§4).

> **Actualización (producto, 2026-11-03):** manda lo decidido en MANUAL §15.1 y §15.2:
> - **La prueba:** sin método de pago no hay IA; al añadirlo, 7 días con 5 € de crédito. Nada se cobra ni se renueva sin que la organización elija cómo seguir: consumo bajo demanda con tope, paquete de créditos o plan mensual con créditos.
> - **La implantación solo es para enterprise y a medida,** con presupuesto cerrado.

Tipo de cambio usado: **1 € = 1,1177 $** (referencia del BCE, 7 oct 2026), es decir,
1 $ ≈ 0,895 €.

## 1. Por qué plan mensual + uso

La propuesta de octubre cobraba 49 € al mes por agente. Se deja por tres motivos:
- **El producto es el equipo, no el agente suelto.** Cobrar por agente empuja al cliente a
  activar menos agentes, justo lo contrario de lo que le da valor (MANUAL §5.12).
- **No dejaba margen.** Con el coste medido en staging, una organización con dos agentes
  pagaba 98 € frente a unos 85 € de coste (13 % de margen); con uno, margen negativo
  (auditoría del 2026-11-10, §11).
- **No encaja con un servicio premium.** El precio de entrada tiene que cubrir los cuatro
  agentes, la memoria, las aprobaciones y la traza.

Los planes de abajo son la opción «plan mensual con créditos» de MANUAL §15.1. El consumo
bajo demanda con tope y los paquetes de créditos siguen existiendo; sus importes salen de la
definición de crédito (decisión de producto n.º 5 del 2026-11-10: 1 € de consumo medido a
precio de lista más un margen fijo de plataforma).

## 2. Precios propuestos (Moodly)

| Concepto | Precio | Incluye |
|---|---|---|
| Prueba | 7 días con 5 € de crédito de IA | Con método de pago y sin cobro hasta que la organización elija cómo seguir (MANUAL §15.1) |
| **Esencial** · autoservicio | **149 €/mes** | Los 4 agentes de serie, 1 sede, 300 conversaciones, usuarios ilimitados, integraciones estándar |
| **Equipo** · autoservicio | **399 €/mes** | Lo anterior, agentes propios, hasta 3 sedes, 1.000 conversaciones, más integraciones |
| **Empresa** · contrato anual | **200 €/mes por sede** | 300 conversaciones por sede, agentes y skills a medida, soporte y seguridad dedicados |
| Implantación (solo Empresa) | Desde 5.000 €, presupuesto cerrado | Integraciones propias y puesta en marcha (MANUAL §15.2) |
| Conversación extra | **0,35 €** | Antes 0,10 €, que no cubría el coste medido (§4) |
| Minuto de voz | **0,20 €** | Cuando exista el canal de voz |
| BYOK (tus claves de IA) | 0,03 € por conversación extra · 0,06 € por minuto | Telefonía y plataforma |
| Plantillas de WhatsApp | A precio de Meta, sin margen | |

Protección del cliente: límite de gasto mensual. Aviso al 80 %; al 100 %, los agentes
pasan las conversaciones al equipo.

**Referencias de mercado** (noviembre de 2026; HeyDiga y Fin, contrastados en su web; el resto, de
resultados de búsqueda sin contrastar): HeyDiga 49–279 €/mes por minutos de voz, con WhatsApp conversacional aparte a 39 €/mes (visto en su web el 2026-11-11); Fin (antes
Intercom) 0,99 $ por resolución con un mínimo de 49 $/mes (visto en su web el 2026-11-11); Treatwell AI Receptionist desde 69 £/mes;
Fresha AI Concierge 29,95–99,95 $ por sede y mes. Esencial y Equipo quedan por encima de
HeyDiga y cubren cuatro agentes en lugar de un canal.

## 3. Costes oficiales de proveedores (7 oct 2026)

### 3.1 Modelos de texto (USD por millón de tokens)

| Proveedor · modelo | Entrada | Caché (lectura) | Salida | Contexto | Fuente |
|---|---|---|---|---|---|
| Anthropic · Claude Haiku 5.5 (prompts ≤100k) | $0,10 | $0,01 | $0,50 | 1M | [platform.claude.com/…/pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Anthropic · Claude Haiku 4.5 | $1 | $0,10 | $5 | — | ídem |
| Anthropic · Claude Sonnet 5.5 | $2 | $0,20 | $10 | 1M | ídem · [modelos](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Anthropic · Claude Opus 5.5 | $4 | $0,20 | $20 | 1M | ídem |
| OpenAI · gpt-6-luna | $0,10 | $0,01 | $0,50 | 1,05M | [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) · [modelos](https://developers.openai.com/api/docs/models) |
| OpenAI · gpt-6.1-sol | $2 | $0,10 | $10 | 1,05M | ídem |
| OpenAI · gpt-5.4-mini | $0,75 | $0,075 | $4,50 | — | ídem |
| Google · Gemini 3.5 Flash-Lite | $0,30 | $0,03 | $2,50 | — | [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Google · Gemini 3.5 Flash | $1,50 | $0,15 | $9 | 1.048.576 | ídem · [ficha del modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash) |
| Google · Gemini 3.1 Pro (≤200k) | $2 | $0,20 | $12 | — | ídem |
| Mistral · Mistral Large | $0,50 | — | $1,50 | — | [mistral.ai/pricing](https://mistral.ai/pricing) (ejemplo de su FAQ) |
| Mistral · Medium 3.5 | $1,50 | — | $7,50 | — | Sin tabla oficial accesible: dato de [OpenRouter](https://openrouter.ai/mistralai/mistral-medium-3-5/api). **Confirmar en Mistral Studio** |

Notas oficiales:
- Anthropic: Batch −50 %. La lectura de caché cuesta el 10 % de la entrada. La escritura
  en caché cuesta 1,25× (5 min) o 2× (1 h).
- Haiku 5.5 sube a $0,50/$2,50 con prompts de más de 100k tokens.

### 3.2 Voz

| Componente | Precio oficial | Fuente |
|---|---|---|
| ElevenLabs Agents (voz conversacional) | $0,08/min adicional (ráfaga: $0,16/min). El LLM se cobra aparte. Telefonía incluida en ElevenLabs; el operador cobra aparte | [elevenlabs.io/pricing/agents](https://elevenlabs.io/pricing/agents) |
| ElevenLabs planes | Pro $99/mes (1.238 min incluidos) · Scale $299 (3.738 min) · Business $990 (12.375 min) | ídem |
| ElevenLabs TTS | v3 $0,08 por 1.000 caracteres · Flash/Turbo $0,04 | [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api) |
| ElevenLabs STT | Scribe v2 $0,22/h · Realtime $0,39/h | ídem |
| Google Gemini 3.8 Live | Audio de entrada $0,005/min · audio de salida $0,018/min | [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| OpenAI gpt-realtime-2.1-mini | Audio $10 entrada / $20 salida por millón de tokens | [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) |
| OpenAI transcripción | gpt-4o-mini-transcribe $0,003/min | ídem |
| Twilio España | Llamada entrante a número local $0,0178/min · móvil $0,0486/min · número desde $1,15/mes | [twilio.com/…/voice/pricing/es](https://www.twilio.com/en-us/voice/pricing/es) |

### 3.3 WhatsApp Business Platform

**Fuente oficial:** [developers.facebook.com/…/whatsapp/pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).

Reglas vigentes (leídas en la página oficial el 2026-11-11):
- Cobro por mensaje entregado, por categoría y mercado (desde el 1 jul 2025). Los mensajes
  del usuario a la empresa no se cobran.
- **Desde el 1 oct 2026 los mensajes de servicio vuelven a cobrarse** (eran gratis desde el
  1 nov 2024). Son las respuestas sin plantilla dentro de la ventana de 24 h, es decir,
  casi todo lo que escribe un agente.
- Gratis:
  - los primeros **1.000 mensajes de servicio al mes por número de teléfono** (no se
    acumulan);
  - todo lo enviado en la ventana de punto de entrada gratuito (hasta 7 días tras un
    anuncio Click-to-WhatsApp).
- Sin método de pago en la cuenta, Meta deja de entregar los mensajes de servicio.

> **Corrección (2026-11-11):** la versión anterior de este documento decía que los cambios
> del 1 oct 2026 no cobraban estos mensajes. Era falso y afecta al coste por cliente (§4).

Tarifas para España:
- Marketing: **0,0509 €** por mensaje.
- Utilidad y autenticación: **0,0166 €** por mensaje.
- Fuente: [whautomate](https://whautomate.com/whatsapp-business-api-pricing-spain), que
  cita la tarifa de Meta. **Confirmar en la tarifa CSV oficial** de Meta.

### 3.4 Referencia de mercado: Langdock

Fuente: [langdock.com/pricing](https://langdock.com/pricing).

- **Prueba:** 7 días, con 5 € de créditos y sin tarjeta.
- **Business:** 25 €/usuario/mes; Business Max 99 €/usuario/mes. Pago anual con −20 %.
- **Enterprise:** a medida, desde 1.000 usuarios.
- **Workflows:** Starter incluido (2.500 ejecuciones al mes). Business: 539 €/mes por
  40.000 ejecuciones o 1.199 €/mes por 100.000.
- **Governance:** gratis hasta el 1 ene 2027; después, 3,50 €/usuario/mes (2,80 € en
  anual).
- **API:** pago por uso. Ejemplos:
  - GPT-5.5: 4,80 € / 28,81 €;
  - Sonnet 4.6: 2,62 € / 13,10 €;
  - Gemini 3.1 Pro: 1,92 € / 11,52 €.

  Es decir, aplica margen sobre el precio del proveedor.

## 4. Coste unitario calculado

### Conversación de texto

**Supuesto:** 6 turnos. En cada turno, unos 8.000 tokens de entrada (instrucciones del
agente, conocimiento del negocio e historial) y 300 de salida.

En WhatsApp los turnos llegan espaciados, así que **no contamos con la caché de 5
minutos**. Es el peor caso realista.

| Modelo | Cálculo por turno | Por conversación |
|---|---|---|
| Rápido (Haiku 5.5 / gpt-6-luna) | 8.000 × $0,10 + 300 × $0,50 = $0,00095 | $0,0057 ≈ **0,005 €** |
| Gemini 3.5 Flash-Lite | 8.000 × $0,30 + 300 × $2,50 = $0,00315 | $0,019 ≈ **0,017 €** |
| Avanzado (Sonnet 5.5 / gpt-6.1-sol) | 8.000 × $2 + 300 × $10 = $0,019 | $0,114 ≈ **0,10 €** |

**Mezcla típica** (85 % rápido, 15 % avanzado): **≈ 0,02 €** por conversación.

- Estas cifras son el suelo teórico. El coste medido y el plan para acercarse a él están
  en el apartado siguiente.
- **Regla para el enrutador (MANUAL §5.11):** modelo rápido por defecto, modelo avanzado
  solo en tareas marcadas y con tope por organización. Usar la caché de 1 h para las
  instrucciones del agente cuando haya varios mensajes seguidos.

### Coste medido y plan para bajarlo (2026-11-11)

La tabla de arriba es teórica (8.000 tokens por turno y modelo avanzado de precio medio). Lo
medido en staging es más caro porque hoy **todos los turnos usan el modelo `smart`** de
`packages/config` ($4 / $20 por millón de tokens): una reserva de 6 turnos cuesta
**0,24 €** (auditoría del 2026-11-10, §11).

El plan tiene tres etapas. Solo la primera está medida.

| Etapa | Qué cambia | Coste por conversación | Qué hace falta | Cómo se comprueba |
|---|---|---|---|---|
| **0. Hoy** | Todo con el modelo `smart` | **0,24–0,25 €** (medido) | Nada | `usage_records` de staging |
| **1. Enrutado por turno** | El 70 % de los turnos va al modelo `fast`, 40 veces más barato | **≈ 0,08 €** (estimado) | El enrutador de modelos (unidad PL-T6 del registro, hito M1); clasificar el turno (saludo, pregunta frecuente y lectura van a `fast`; reservar, cobrar y los turnos ambiguos se quedan en `smart`) | Evals por tipo de turno con los umbrales de siempre (seguridad 100 %, comportamiento 90 %). Un tipo de turno que no los pasa en `fast` se queda en `smart` |
| **2. Caché y recorte** | El 85 % en `fast`; caché de 1 h para las instrucciones y los esquemas de herramientas (unos 3.000 de los 3.300 tokens de entrada son fijos y la lectura de caché cuesta el 10 %); menos historial que los 20 mensajes de hoy; textos fijos sin modelo | **≈ 0,02 €** (objetivo) | Medir en el piloto qué parte del tráfico llega dentro de la ventana de caché | Coste por conversación resuelta, que se mide al cerrar el hito M4 |

Reglas que no cambian con el coste:
- El modelo de cada turno lo decide la eval bajo un techo de coste, no el precio (decisión
  de producto n.º 4 del 2026-11-10).
- No se bajan umbrales de evals para abaratar.
- Cada organización tiene un tope de gasto.

**Coste de servir a un cliente tipo** (300 conversaciones y 150 citas al mes; supuesto de la
auditoría):

| Concepto | Etapa 0 | Etapa 1 | Etapa 2 |
|---|---|---|---|
| IA | 75 € | 24 € | 6 € |
| WhatsApp: 300 recordatorios y unas 800 respuestas de pago (1.800 menos las 1.000 gratis), a 0,0166 € | 18 € | 18 € | 18 € |
| Infraestructura (sin medir; 500 €/mes entre 100 clientes) | 5 € | 5 € | 5 € |
| **Total** | **98 €** | **47 €** | **29 €** |
| Margen bruto con Esencial (149 €) | 34 % | 68 % | 81 % |

La tarifa española de los mensajes de servicio no está contrastada: se usa la de utilidad
(0,0166 €) y seis respuestas por conversación. Confirmarla en el CSV de tarifas de Meta.

**Margen por plan en la etapa 1** (0,08 € por conversación; los volúmenes son supuestos):

| Plan | Ingreso al mes | Coste de servirlo | Margen bruto |
|---|---|---|---|
| Esencial, 300 conversaciones | 149 € | 47 € | 68 % |
| Equipo, 1.000 conversaciones y 3 sedes | 399 € | ≈ 155 € | 61 % |
| Empresa, 20 sedes y 6.000 conversaciones | 4.000 € | ≈ 900 € | 78 % |

En la etapa 2, los mismos planes quedan en el 81 %, el 76 % y el 87 %.

**Para planificar se usa un margen más bajo que el de este modelo** (producto, 2026-11-11: «mejor ser
precavido»): 35–45 % en los dos primeros años y 55–60 % a escala. Las tablas de arriba son el modelo de
costes propio, con las etapas 1 y 2 sin construir; el margen que declaran las empresas de IA es menor
(45 % de media en 2025 según ICONIQ, en torno al 60 % las eficientes según Bessemer, 49,9 % Twilio por el
coste de la mensajería). Esas referencias se leyeron en resúmenes de los informes, no en el original. La
tarifa de WhatsApp para España sigue sin verificar en la tabla de Meta: los 0,0166 € por respuesta son la
tarifa de utilidad usada como aproximación.

La conversación extra a 0,35 € deja un 49 % de margen en la etapa 1 (0,08 € de IA más unos 0,10 € de WhatsApp fuera del tramo gratuito: seis respuestas a 0,0166 €) y es deficitaria en la
etapa 0 (0,24–0,25 € de IA más el WhatsApp): hasta que el enrutado esté en producción, el tope de gasto
por organización es lo que limita la exposición.

### Minuto de voz

| Arquitectura | Coste por minuto |
|---|---|
| ElevenLabs Agents | $0,08 + LLM (≈ $0,005) + Twilio entrante ($0,018–0,049) ≈ $0,10–0,13 → **0,09–0,12 €** |
| Gemini Live | $0,005 + $0,018 de audio + contexto + Twilio ≈ $0,04–0,07 → **0,04–0,06 €** |

Con 0,20 € por minuto, el margen es de 1,7 a 5 veces según la arquitectura. Elegir
proveedor de voz es la decisión que más afecta al margen.

### Otros costes

- **Infraestructura por cliente:** sin medir. Estimarla con la factura de Supabase y Vercel
  del piloto.
- **Número de teléfono:** desde $1,15 al mes (Twilio, España).

## 5. Ejemplos con los precios propuestos

| Negocio | Plan y uso | Fijo | Variable | Total/mes |
|---|---|---|---|---|
| Clínica dental pequeña | Esencial, 400 conversaciones | 149 € | 100 × 0,35 € = 35 € | **184 €** |
| Restaurante | Esencial, 600 conversaciones, 200 min de voz | 149 € | 105 € + 40 € | **294 €** |
| Inmobiliaria de 2 oficinas | Equipo, 1.500 conversaciones | 399 € | 500 × 0,35 € = 175 € | **574 €** |
| Cadena de 20 sedes | Empresa, dentro de lo incluido | 4.000 € | 0 € | **4.000 €** (más 15.000 € de implantación el primer año) |

## 6. Decisiones abiertas

1. **Nivel de precio: decidido** (producto, 2026-11-11). Queda por comprobar en el piloto
   que no frena la captación.
2. Conversaciones incluidas en cada plan (300 y 1.000 son supuestos).
3. Confirmar las cifras de Mistral y las tarifas de WhatsApp en las fuentes oficiales
   (Mistral Studio y CSV de Meta).
4. Proveedor de voz: ElevenLabs (calidad) o Gemini/OpenAI realtime (coste).
5. Definición de «conversación» para el cliente. Propuesta: un tema por cliente en 24 h.
6. Descuento anual (Langdock: −20 %). No se muestra hasta decidirlo.
7. Importes del consumo bajo demanda y de los paquetes de créditos (MANUAL §15.1).
8. Precios en otras divisas cuando la web esté traducida.
9. Contrastar las referencias de mercado de §2 en la web de cada empresa.
