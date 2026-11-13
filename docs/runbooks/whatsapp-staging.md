# WhatsApp en staging con el número de prueba de Meta (O-01)

**Estado:** construido, sin verificar en real. Nada de WhatsApp cuenta como probado hasta pasar este runbook con la API de Meta de verdad y un teléfono de verdad (producto, 2026-11-13). Los tests con la Graph API falsa (`ingress.integration.ts`, `one-reply.integration.ts`) solo protegen contra regresiones.

Qué se comprueba al final, todo en real:

1. Meta llama al webhook del worker de staging y el worker lo acepta (firma con el secreto de la app).
2. Un mensaje desde el teléfono de quien prueba crea su `inbound_event` y su mensaje en la conversación.
3. Recepción contesta con el modelo de verdad; la respuesta sale por la Graph API con un wamid real y Meta avisa de que llegó (`delivered`).
4. Gate M1: dos mensajes seguidos → una sola respuesta.

Lo hace una persona de producto (las claves solo las ve ella). Los agentes no ven ningún valor: solo preparan el código, el workflow y este documento.

## Antes de empezar

- La organización de demo de staging existe (Actions → «Staging · organización de demo»), y quien prueba es su `org_admin` con MFA (para aprobar la respuesta en la bandeja).
- El worker de staging contesta con el modelo de verdad: «Staging · agente» con `saludo` termina en `completed` o `awaiting_approval` (si no, falta `AI_GATEWAY_API_KEY` en Railway).
- Un teléfono con WhatsApp para recibir y escribir.

## 1. Meta: la app y el número de prueba

En [Meta for Developers](https://developers.facebook.com/apps) (la cuenta de Meta for Developers ya existe; para el número de prueba **no** hace falta la cuenta de Meta Business verificada):

1. **Crear la app** (o usar la que ya hay): tipo *Business*.
2. **Añadir el producto WhatsApp** a la app. Meta crea una cuenta de WhatsApp Business de prueba y un **número de prueba** gratuito.
3. En **WhatsApp → API Setup** apunta (no son secretos):
   - **Phone number ID** del número de prueba (solo dígitos). Lo pide el workflow en el paso 3.
   - El número de prueba en sí (el «From»): es al que escribirás desde tu teléfono.
4. En **API Setup → «To»**: añade tu teléfono como destinatario y verifícalo con el código que te llega. El número de prueba solo puede escribir a destinatarios verificados (hasta 5); a cualquier otro, Meta rechaza el envío (error 131030) y el worker lo deja `failed` con ese código.
5. **Token de acceso** (para enviar). Dos opciones:
   - **Temporal** (API Setup → «Generate access token»): dura 24 h. Vale para una prueba en el día.
   - **Permanente** (recomendado): Business Settings → *Users → System users* → un usuario de sistema con rol *Admin*, con la app y la cuenta de WhatsApp asignadas → *Generate new token* para la app, con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, sin caducidad.
6. **Secreto de la app**: App settings → *Basic* → *App secret* (Show). Firma cada webhook (`X-Hub-Signature-256`).
7. **Token de verificación del webhook**: una cadena aleatoria que eliges tú, de al menos 16 caracteres (por ejemplo, la salida de `openssl rand -hex 24`). Solo sirve para dar de alta el webhook.

Si la interfaz de Meta ha cambiado de nombres, lo que importa es: el *Phone number ID*, un token con permiso para enviar mensajes por ese número, el *App secret* y un token de verificación propio.

## 2. Railway: las variables del worker

Servicio `worker` del proyecto `moodly-staging` → *Variables*. Las tres a la vez (con solo una o dos, el worker no arranca):

| Variable | Valor |
| --- | --- |
| `WHATSAPP_APP_SECRET` | el *App secret* (paso 1.6) |
| `WHATSAPP_VERIFY_TOKEN` | tu token de verificación (paso 1.7) |
| `WHATSAPP_ACCESS_TOKEN` | el token de acceso (paso 1.5) |

Guarda y deja que Railway redespliegue. Nunca van a los logs ni a GitHub.

Comprobación: Actions → **«Staging · WhatsApp»** → Run workflow con `check`. El primer paso, «Ruta del webhook en el worker», tiene que decir que la ruta existe (el worker contesta 403 a un token que no es el suyo). Si dice 404, al worker le faltan las variables o no se ha redesplegado. El resto del `check` fallará todavía: aún no hay cuenta ni mensajes.

## 3. GitHub: la cuenta de WhatsApp de la organización de demo

Actions → **«Staging · WhatsApp»** → Run workflow con la acción `setup` y el **Phone number ID** del paso 1.3. Deja una cuenta de canal `whatsapp` activa en la organización de demo, con ese id y Recepción como agente por defecto (sin él, el worker no sabe de qué organización es cada webhook y lo ignora). Se puede repetir; si cambia el número de prueba, se vuelve a lanzar con el id nuevo.

## 4. Meta: dar de alta el webhook

En la app → **WhatsApp → Configuration → Webhook → Edit**:

- **Callback URL:** `https://worker-staging-47c75e8c.up.railway.app/channels/whatsapp/webhook`
- **Verify token:** el mismo `WHATSAPP_VERIFY_TOKEN` de Railway.
- **Verify and save.** Meta hace un GET con el token; el worker contesta con el *challenge* si coincide. Si falla, el token de Meta y el de Railway no son iguales, o el worker no tiene las variables (vuelve al paso 2).

Después, en **Webhook fields**, suscríbete a **`messages`** (trae los mensajes que llegan y los avisos de estado: enviado, entregado, leído, fallido).

## 5. La prueba

1. **Un mensaje.** Desde tu teléfono, escribe al número de prueba, por ejemplo «Hola, ¿qué podéis hacer por mí?». Escribir tú primero abre la ventana de 24 h de Meta: dentro de ella el agente puede contestar con texto libre (fuera, solo con plantillas aprobadas).
2. **Aprobar la respuesta.** En staging, Recepción contesta en borrador: en la app de staging, **Aprobaciones** (`/app/approvals`) → apruébala. Al aprobarla, el worker la envía por la Graph API.
3. **Te llega al teléfono.** Lanza «Staging · WhatsApp» con `check`. Deben salir ✔ `webhook`, ✔ `procesado`, ✔ `respuesta` (salió con wamid) y ✔ `entregada` (Meta avisó de que llegó). `un_mensaje` todavía «no aplica».
4. **Gate M1: dos mensajes seguidos.** Escribe dos mensajes uno detrás de otro, sin esperar respuesta (por ejemplo «¿Tenéis hueco el lunes?» y, enseguida, «Por la mañana, a poder ser»). En **Aprobaciones** tiene que haber **una sola** respuesta pendiente para esa conversación (la del último mensaje); apruébala. Lanza `check`: ✔ `un_mensaje` (ninguna respuesta entre los dos mensajes y exactamente una después) y ✔ `entregada`.

El `check` no enseña teléfonos ni textos: solo estados, horas, si hay wamid, el error de Meta si lo hubo y el estado de cada run.

## Si algo no sale

| Síntoma en `check` | Qué mirar |
| --- | --- |
| La ruta da 404 | Faltan las `WHATSAPP_*` en Railway o no se redesplegó (paso 2). |
| `webhook` ✘ (no llegó nada en 2 h) | Webhook sin dar de alta o sin el campo `messages` (paso 4). Si Meta lo da por bueno y aun así no llega nada, la app puede no estar suscrita a la cuenta de WhatsApp de prueba: en el Graph API Explorer, `POST /<WABA_ID>/subscribed_apps` con el token. Los logs del worker en Railway dicen si llegó algo con firma mala (`ingress.bad_signature`: el `WHATSAPP_APP_SECRET` no es el de esta app). |
| `procesado` ✘ | El webhook llegó pero no se convirtió en mensaje: logs del worker (`channels.ingest`). Si el `phone_number_id` del webhook no es el de la cuenta del paso 3, se ignora. |
| Sin respuesta pendiente en Aprobaciones | El run del mensaje (columna `run` de `mensajes`): `handed_off` = pasó a una persona (logs del worker: ¿modelo, presupuesto?). |
| `respuesta` ✘ con `error` `whatsapp:131030` | Tu teléfono no está en la lista de destinatarios del número de prueba (paso 1.4). |
| `respuesta` ✘ con `error` `whatsapp:190` o similar | El token de acceso caducó o no tiene permiso (paso 1.5): el temporal dura 24 h. |
| `respuesta` ✘ con `error` `whatsapp:131047` | Fuera de la ventana de 24 h: escribe tú primero otra vez. |
| Estado `unknown` | No se sabe si salió (timeout o 5xx de Meta): no se repite nunca solo. Lo concilia el primer aviso de estado de Meta; si no llega, una persona. |
| `entregada` ✘ con `respuesta` ✔ | Meta aceptó el envío pero aún no avisó de que llegó: espera un minuto y repite `check`. |

## Qué queda fuera

- La cuenta de Meta Business verificada, un número propio y las plantillas aprobadas (F05, bloqueado): hacen falta para escribir a quien no está en la lista de destinatarios y para los recordatorios fuera de la ventana de 24 h.
- El alta de la cuenta de WhatsApp desde la app (aquí la crea el workflow).
