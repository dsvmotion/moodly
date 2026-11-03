# Modelo de precios: fijo + variable

Fecha: 2026-10-07 · Estado: **PROPUESTO**. Los costes de proveedores salen de sus webs
oficiales, consultadas el 7 oct 2026. Nuestros precios son una propuesta a validar con
el coste medido en 2 o 3 pilotos.

Fuente única de las cifras en la web: `apps/site/src/components/pricing.js`.

> **Actualización (producto, 2026-11-03):** manda lo decidido en MANUAL §15.1 y §15.2, y deja atrás parte de esta propuesta:
> - **La prueba es otra:** sin método de pago no hay IA; al añadirlo, 5 € de crédito. Nada se cobra ni se renueva sin que la organización elija cómo seguir: consumo bajo demanda con tope, paquete de créditos o plan mensual con créditos.
> - **La implantación solo es para enterprise y a medida,** con presupuesto cerrado.
>
> Las cifras de abajo siguen siendo **PROPUESTO**.

Tipo de cambio usado: **1 € = 1,1177 $** (referencia del BCE, 7 oct 2026), es decir,
1 $ ≈ 0,895 €.

## 1. Por qué fijo + variable

El modelo anterior era una implantación de 1.000 a 5.000 € más 50–100 €/mes.
- La implantación frenaba la entrada.
- La cuota no tenía relación con el coste real, que depende del volumen.

Langdock separa una base por usuario de unos complementos y uso variable (§4). Lo
adaptamos con el **agente** como unidad.

## 2. Precios propuestos (Moodly)

| Concepto | Precio |
|---|---|
| Prueba | 0 € · 14 días · 1 agente · 100 conversaciones · sin tarjeta |
| Fijo por agente | **49 €/mes**, con 250 conversaciones incluidas, usuarios ilimitados, app e integraciones estándar |
| Sede adicional | 29 €/mes |
| Conversación extra | **0,10 €** |
| Minuto de voz | **0,20 €** |
| BYOK (tus claves de IA) | 0,03 € por conversación extra · 0,06 € por minuto (telefonía + plataforma) |
| Plantillas de WhatsApp | A precio de Meta, sin margen |
| Implantación a medida | Opcional, presupuesto cerrado |
| Enterprise | A medida, desde 3 sedes o 5.000 conversaciones al mes |

Protección del cliente: límite de gasto mensual. Aviso al 80 %; al 100 %, los agentes
pasan las conversaciones al equipo.

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

Reglas vigentes:
- Cobro por mensaje de plantilla entregado (desde el 1 jul 2025).
- Gratis:
  - mensajes sin plantilla dentro de la ventana de 24 h;
  - conversaciones de servicio;
  - plantillas de utilidad dentro de la ventana;
  - 72 h tras un anuncio Click-to-WhatsApp.
- Los cambios del 1 oct 2026 **no** empiezan a cobrar estos mensajes. Algunos artículos
  de terceros dicen lo contrario y se equivocan.

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

- Con 0,10 € por conversación extra, el margen es de unas 5 veces sobre la mezcla, pero
  solo de 1 vez si todo fuera modelo avanzado.
- **Regla para el enrutador (MANUAL §5.11):** modelo rápido por defecto, modelo avanzado
  solo en tareas marcadas y con tope por organización. Usar la caché de 1 h para las
  instrucciones del agente cuando haya varios mensajes seguidos.

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

| Negocio | Configuración | Fijo | Variable | Total/mes |
|---|---|---|---|---|
| Clínica dental pequeña | Recepción + Atención, 400 conversaciones | 98 € | 0 € | **98 €** |
| Restaurante | Recepción, 600 conversaciones, 200 min de voz | 49 € | 35 € + 40 € | **124 €** |
| Inmobiliaria de 2 oficinas | 3 agentes, 1.500 conversaciones | 147 € + 29 € | 75 € | **251 €** |
| Taller, sobre todo por teléfono | Recepción, 100 conversaciones, 400 min | 49 € | 80 € | **129 €** |

## 6. Decisiones abiertas

1. Confirmar las cifras de Mistral y las tarifas de WhatsApp en las fuentes oficiales
   (Mistral Studio y CSV de Meta).
2. Proveedor de voz: ElevenLabs (calidad) o Gemini/OpenAI realtime (coste).
3. Definición de «conversación» para el cliente. Propuesta: un tema por cliente en 24 h.
4. Descuento anual (Langdock: −20 %). No se muestra hasta decidirlo.
5. Umbral de Enterprise.
6. Precios en otras divisas cuando la web esté traducida.
