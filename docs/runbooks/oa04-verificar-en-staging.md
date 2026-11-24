# OA04 · Verificar en staging los ajustes del negocio y el precio del agente

Guía para comprobar en staging, de verdad y no con dobles, lo que construyó OA04:

- **Parte A:** cambiar desde la app servicios, precios, equipo y horario (#300).
- **Parte B:** que el agente de Recepción diga el precio que se puso en Ajustes, y que no se invente ninguno cuando no lo hay (el PR del precio).

Hasta que alguien la haga y deje la evidencia, OA04 sigue **«construido, sin verificar en real»** (decisión de producto del 2026-11-13). Se tarda unos 20 minutos. La parte B llama al modelo de verdad y cuesta unos céntimos por mensaje.

## Antes de empezar

- **Quién:** una persona con la cuenta `org_admin` de la organización de demo de staging, con el segundo factor (MFA) activado. Sin MFA, la app enseña los ajustes pero no deja cambiar nada: es lo correcto.
- **Qué tiene que estar desplegado:**
  - La migración `20261113140000_business_setup`, que la aplica «Despliegue a staging» al mergear en `main`. Se comprueba en Actions: la última ejecución de «Despliegue a staging» posterior al merge de #300 está en verde.
  - La web de `main` en `https://staging.moodlycrm.com`.
  - Solo para la parte B, el worker de Railway con el commit del PR del precio o posterior, con `AI_GATEWAY_API_KEY`. Railway → servicio `worker` → Deployments: el último está en `SUCCESS` y `/health` responde `ok`.
- **Qué apuntar:** la fecha, el commit de `main` desplegado (en Vercel y en Railway) y una captura o la salida de cada paso marcado con 📸.

## Parte A · Ajustes del negocio desde la app

Entra en `https://staging.moodlycrm.com`, con contraseña y código. Ve a **Ajustes → Tu negocio → Servicios y equipo**.

### A1. Un servicio con precio

1. **Nuevo servicio** con:
   - nombre `Prueba OA04`;
   - duración `45`;
   - precio `30`, en moneda `EUR`;
   - «Se ofrece en» `Todas las sedes`.

   Pulsa **Crear**.
2. **Esperado:** sale en la lista con `45 minutos` y `30,00 €`. 📸
3. Ábrelo, cambia el precio a `32,50` y guarda. **Esperado:** «Guardado», y en la lista `32,50 €`.
4. Vuelve a abrirlo, borra el precio (déjalo vacío) y guarda. **Esperado:** en la lista sale «Sin precio».
5. **En negativo:** ábrelo, pon el precio `-5` y guarda. **Esperado:** sale «Revisa los datos: hay algo que no se puede guardar así» y el servicio sigue «Sin precio».

### A2. Desactivar y activar

1. En `Prueba OA04`, pulsa **Desactivar**. **Esperado:** pasa a «Desactivado».
2. Pulsa **Activar**. **Esperado:** vuelve a «Activo».

Los servicios no se borran, porque las citas apuntan a ellos.

### A3. Equipo y recursos

1. Pestaña **Equipo y recursos** → **Nuevo profesional o recurso**, con:
   - nombre `Profesional OA04`;
   - tipo `Profesional`;
   - sede, la de la demo;
   - en «Servicios que hace», marca `Primera visita` y `Prueba OA04`.

   Pulsa **Crear**.
2. **Esperado:** sale en la lista con esos dos servicios. 📸
3. Ábrelo, desmarca `Prueba OA04` y guarda. **Esperado:** solo queda `Primera visita`.

### A4. Horario de la sede

1. Ve a **Ajustes → Sedes** y abre la sede de la demo → **Cambiar el horario**.
2. Marca la casilla del sábado, ponlo de `10:00` a `13:00` y guarda. **Esperado:** «Guardado», y el horario de la sede incluye el sábado. 📸
3. **En negativo:** pon el sábado con el cierre antes de la apertura (abre a `13:00`, cierra a `10:00`) y guarda. **Esperado:** no se guarda, y el sábado sigue de 10:00 a 13:00.
4. Deja el horario como estaba: desmarca la casilla del sábado (sale «Cerrado») y guarda.

### A5. Opcional: sin permiso

Si hay en la demo una cuenta sin el rol `org_admin`, o una `org_admin` sin MFA, entra con ella. **Esperado:**
- ve los servicios, el equipo y el horario;
- no tiene botones para cambiarlos, o ve el aviso de que necesita el segundo factor.

### A6. Opcional: los eventos

En Vercel → proyecto `moodly-staging` → Logs, busca `business.`. **Esperado:**
- salen `business.service_created`, `business.service_updated` (con `fields`, p. ej. `price_cents`), `business.resource_created`, `business.resource_updated` y el del horario;
- llevan ids y nombres de campos, nunca valores: ni precios ni nombres.

## Parte B · El agente dice el precio de Ajustes

Usa el workflow **Actions → «Staging · agente» → Run workflow**, desde `main`, con el mensaje **`precio`**. El contacto de prueba escribe «¿Cuánto cuesta una primera visita?» a Recepción de la demo, y el workflow enseña qué hizo el agente.

### B1. Con precio

1. En **Servicios y equipo**, pon a `Primera visita` el precio `45`, en `EUR`, y guarda.
2. Lanza «Staging · agente» con `precio`.
3. **Esperado** en la salida del paso «Qué hizo el agente»: 📸
   - `estado` es `awaiting_approval` o `completed`;
   - `precio_primera_visita` es `4500` (los céntimos de 45 €);
   - en `ejecuciones` sale `reply` con un `resumen` como `Responder: «… 45,00 € …»`, con el precio exacto que pusiste y ningún otro;
   - no sale `request_human`.
4. La respuesta nace en borrador. En la app, **Bandeja**, sale la aprobación con ese texto: apruébala o recházala, da igual para la prueba.

### B2. Sin precio

1. En **Servicios y equipo**, borra el precio de `Primera visita` (déjalo vacío) y guarda.
2. Lanza «Staging · agente» con `precio`.
3. **Esperado:** 📸
   - en `ejecuciones` no sale ninguna cantidad de dinero;
   - el agente pasa la conversación a una persona: `estado` es `handed_off`, `precio_primera_visita` es `null` y en `ejecuciones` sale `request_human` (`executed`). El workflow solo lo da por bueno así, con un aviso. Un paso a una persona sin `request_human` (un fallo: sin `AI_GATEWAY_API_KEY`, el modelo caído) o con la primera visita con precio sale en rojo.
   - Si en vez de eso contesta con texto, ese texto no puede dar ningún precio y tiene que decir que alguien del equipo lo confirmará.
4. **Si sale un precio** (45 € o cualquier otro): falla. Apunta la salida y avísale a V1.

### B3. Dejarlo como estaba

Pon a `Primera visita` el precio que producto quiera para la demo, o déjala sin precio.

## Limpieza

- Desactiva `Prueba OA04` y `Profesional OA04` (no se borran).
- El horario ya quedó como estaba en A4.

## Qué hacer con la evidencia

Pásale a V1:
- la fecha y los commits desplegados;
- las capturas 📸 y la salida de las dos ejecuciones de «Staging · agente»;
- cualquier paso que no salió como dice «Esperado».

V1 actualiza la fila OA04 de `docs/scope.yaml` y `docs/STATUS.md`. Con todo en verde, OA04 pasa a «verificado en staging»; si algo falla, se queda como estaba, con lo que falló.
