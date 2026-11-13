# 0055 — Alta de las claves de una integración: cifrada hacia el worker y una tabla de solo inserción

- **Estado:** propuesto (V15, 2026-11-13; revisión de V10 incorporada). Lo decide producto (V1 lo lleva).
- **Fecha:** 2026-11-13
- **Secciones del MANUAL afectadas:** §4.4 (secretos), §7 (integraciones), §10.4
- **Relación:**
  - el ADR 0034 (`integration_secrets` y `SecretVault`: la app no lee ni escribe los secretos; el valor en claro solo existe en memoria del worker al usarlo);
  - el ADR 0050 (claves de KMS en `eu-central-1`; la web no tiene acceso a los secretos);
  - el ADR 0049 (el worker accede a los datos como `moodly_worker`, bajo RLS);
  - el ADR 0053 (hub de integraciones: lo que tiene conector en Nango no pasa por aquí);
  - O-02 / int-koibox: el incremento 1 (#289) ya lee la clave cifrada de un centro; falta cómo entra.

## Contexto

- **Las integraciones sin plataforma** (las que no están en Nango: Koibox y, después, otras con «API del cliente», ver `docs/design/paridad-integraciones.md`) se conectan con una **clave que da el cliente**. Para Koibox, el administrador del centro la crea en Koibox (Ajustes → API Keys) y la copia.
- **Quien la pega es el `org_admin`, en la web** (Ajustes → Integraciones), con su sesión y el segundo factor (aal2).
- **Pero la web no puede guardarla** (ADR 0034):
  - no tiene privilegios sobre `integration_secrets` (y no debe tenerlos);
  - no tiene la clave maestra ni permisos de KMS para cifrar (ADR 0050 solo le da descifrar contenido con el contexto de su organización, y eso llega con T4).
- **Y la clave no puede quedar en claro en ningún sitio:** ni en la base de datos (ni en sus copias), ni en el payload de un evento del outbox, ni en el estado de un workflow de DBOS, ni en un log.
- **Hace falta, además, comprobarla** antes de darla por buena (en Koibox, `GET /api/api-key/me/`), y que la pantalla diga si quedó conectada o no.

## Opciones

- **A. La web la cifra hacia el worker («sealed box») y la deja en una tabla de solo inserción.**
  - El worker tiene una **clave asimétrica de ingreso**; la web solo conoce su parte pública.
  - La web cifra la clave del cliente con esa parte pública, con la organización, la integración y el id del envío como dato asociado, e inserta el texto cifrado en `integration_secret_submissions`.
  - El worker lo abre, comprueba la clave contra el proveedor, la vuelve a cifrar con `SecretVault` en `integration_secrets`, enlaza la integración y borra el envío.
- **B. Un endpoint interno del worker.** El servidor de la web le manda la clave por TLS en una petición firmada (HMAC con un secreto compartido, o mTLS), y el worker la comprueba y la guarda en el momento.
- **C. La web la cifra con `SecretVault` y escribe en `integration_secrets`.**
- **D. La clave en el payload de un evento o de un workflow.**

| | A. Sealed box + tabla | B. Endpoint interno | C. La web escribe el secreto | D. En un evento |
|---|---|---|---|---|
| Clave en claro guardada | Nunca | Nunca | Nunca | **Sí** (outbox, `dbos`) |
| La web puede descifrar | No: solo tiene la parte pública | No | **Sí** (necesita KMS) | — |
| Superficie nueva en el worker | Ninguna (lee una tabla, como ya hace) | **Un endpoint público** en el puerto de Railway, con su autenticación, réplica y límites | Ninguna | Ninguna |
| Si el worker está caído | El envío espera y se procesa al volver | La conexión falla | — | — |
| Rompe una decisión aceptada | No | No | **ADR 0034** (la app escribe secretos) | **ADR 0034** |

C y D quedan descartadas por romper el ADR 0034.

## Decisión recomendada

**A.** No añade superficie al worker, no le da a la web nada que descifre, y el envío sobrevive a un worker caído o a un despliegue. B es razonable, pero es un endpoint público más que proteger y una dependencia síncrona entre la web y el worker.

### 1. La clave de ingreso

- **En staging y producción, una clave asimétrica de AWS KMS** (`RSA_4096`, uso `ENCRYPT_DECRYPT`, `RSAES_OAEP_SHA_256`) en `eu-central-1`, una por entorno: la parte privada no sale nunca de KMS y cada descifrado queda en el registro de KMS.
- **El rol del worker** puede `kms:Decrypt` con esa clave y nada más sobre ella; **la web no tiene ningún permiso de KMS** para ella: le basta la parte pública, que es configuración (no secreta) y se lee al arrancar.
- **Cifrado de sobre en la web:** una clave de datos aleatoria cifra el valor con AES-256-GCM, con el dato asociado `organization_id|integration_id|submission_id|provider`; la clave de datos se cifra con la parte pública (RSA-OAEP). Así el envío no se puede mover a otra organización, integración o envío: no se descifra.
- **En desarrollo y en los tests,** un par de claves local con la misma interfaz (como `local:v1` en el ADR 0034), que nunca se usa en staging ni en producción.

### 2. La tabla `integration_secret_submissions`

- **Columnas:** `id`, `organization_id`, `integration_id` (de la misma organización), `provider`, `key_ref` (qué clave de ingreso), `encrypted_data_key`, `ciphertext` (base64), `submitted_by`, `created_at`.
- **La app solo inserta:** política de INSERT para el `org_admin` con aal2 de esa organización (`session_is_active()` y `session_is_aal2()` como siempre), privilegios de columna solo de INSERT en `id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext`, **ningún SELECT, UPDATE ni DELETE para `authenticated`**. El `id` lo genera el servidor de la web antes de cifrar, porque va en el dato asociado; la restricción de clave primaria impide reutilizarlo.
- **Una guarda de inserción** (`guard_secret_submission`, solo para `authenticated`) fija `submitted_by = auth.uid()` y `created_at = now()`, y exige que la integración:
  - sea de la misma organización, de tipo `native` y del mismo `provider`;
  - esté **pendiente, activa o en error**. Activa o en error es la rotación (ver el punto 4); desconectada, no.
- **Sin restricción de unicidad.** Una restricción única («un envío vivo por integración») chocaría con «solo inserción»: la app no puede borrar ni sustituir el envío anterior, así que el segundo intento fallaría hasta que el worker procesara o caducara el primero. En su lugar:
  - el worker procesa **solo el envío más reciente** de cada integración y **borra todos los demás** de esa integración en el mismo paso;
  - **el límite de envíos no lo pone la base de datos:** contar filas de esta tabla no frena nada (el worker las borra en segundos) y la guarda necesitaría una función SECURITY DEFINER para verlas. Lo pone el servidor de la web, con el mismo freno que el login (por organización e integración: como mucho 5 envíos en 15 minutos).
- **El worker** (`moodly_worker`, ADR 0049): SELECT de las columnas que necesita y DELETE, con su política por organización. Sin INSERT ni UPDATE.
- **Caducidad:** un barrido del worker borra los envíos de más de 15 minutos que no se procesaron.

### 3. Los privilegios nuevos de escritura del worker (y sus guardas)

Hoy (#289, `20261113100000`) `moodly_worker` solo **lee** `integration_secrets` (siete columnas) e `integrations.secret_id`. El incremento 2 necesita escribir; esto es exactamente lo que se le daría, y nada más:

| Tabla | Privilegio nuevo | Para qué |
|---|---|---|
| `integration_secret_submissions` | SELECT (`id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext, created_at`), DELETE | Leer el envío y borrarlo |
| `integration_secrets` | INSERT (`organization_id, kind, name, key_ref, encrypted_data_key, ciphertext`) | Guardar la clave cifrada con `SecretVault` |
| `integration_secrets` | UPDATE (`key_ref, encrypted_data_key, ciphertext, rotated_at`) | Rotar |
| `integration_secrets` | DELETE | Desconectar (la app no puede borrar el secreto) |
| `integrations` | UPDATE (`secret_id`), además de `status` y `last_health_check`, que ya tiene (20261112210000) | Enlazar el secreto y activar o marcar el error |

- **`guard_worker_integration` se amplía** (hoy solo deja tocar las de `kind = 'platform'`). Para las de `kind = 'native'`:
  - **status:** de pendiente a activa o error; de activa a error o activa; de error a activa o error. Nunca reactiva una desconectada (la desconectó una persona) ni la pasa a pendiente;
  - **`secret_id`:** solo a un secreto de la misma organización, de `kind = 'integration'` y con el nombre de esa integración (`koibox.<local>` o `koibox.api_key`); a null solo en dos casos: en una integración que ya está desconectada (`OLD.status` y `NEW.status` desconectada: la desconecta la persona y el worker limpia después, sección 5), o en una pendiente que pasa a error en la misma sentencia (reconexión con clave mala, sección 4). Nunca en una activa o en error, ni en una pendiente que sigue pendiente o pasa a activa;
  - **`external_connection_id`:** sigue siendo solo de las de plataforma: en una nativa, nunca.
- **Una guarda nueva en `integration_secrets` para `moodly_worker`** (`guard_worker_integration_secret`):
  - solo `kind = 'integration'` (no toca las claves de modelo de BYOK, ADR 0034, `kind = 'model_provider'`);
  - `organization_id`, `kind` y `name` no cambian en un UPDATE;
  - un UPDATE pone `rotated_at = now()`.
- **pgTAP en negativo que exige** (con la organización A fijada, como en `53_worker_koibox_read`):
  - privilegios exactos por columna en las tres tablas, y ningún privilegio de tabla entera;
  - no escribe un secreto en B (RLS, WITH CHECK), ni lee ni borra un envío de B;
  - no toca un secreto `model_provider`, ni cambia el `organization_id`, el `kind` o el `name` de uno suyo;
  - no inserta ni cambia un envío; no cambia un secreto ajeno a la integración;
  - en una integración nativa: no reactiva una desconectada, no la pasa a pendiente, no pone `external_connection_id`, no enlaza un secreto de otra organización ni de otra integración, no pone `secret_id` a null en una activa o en error, ni en una pendiente que sigue pendiente o pasa a activa (y sí puede al pasar una pendiente a error);
  - en una de plataforma, lo de #277 sigue igual;
  - la app sigue sin leer los secretos y los envíos.

### 4. El recorrido

1. El `org_admin` pega la clave en Ajustes → Integraciones (Server Action con `requireUser()`, `org_admin` y aal2). En la primera conexión, la fila de `integrations` se crea pendiente (como en O-02); al rotar, sigue como estaba (activa o en error).
2. El servidor de la web genera el `id` del envío, cifra la clave con la parte pública e inserta el envío. **El evento `integration.key_submitted` (solo identificadores) sale en la misma transacción que el envío**, de un disparador AFTER INSERT de la tabla, como los demás eventos del outbox (ADR 0009): no hay envío sin evento ni evento sin envío. El log de auditoría va **sin el valor**. La clave en claro no sale de la memoria de esa petición.
3. El worker, al recibir el evento por el outbox (ADR 0009), en un workflow de DBOS cuyo estado lleva **solo identificadores**:
   1. lee el envío más reciente de esa integración con `forOrganization(org)`, y borra los anteriores. `org` es el `organization_id` de la fila del evento en el outbox, que pone el disparador a partir de la fila del envío (ADR 0009). Nunca sale del payload ni de nada que mande el cliente. Si el envío no existe en esa organización, el workflow termina sin hacer nada;
   2. lo descifra con KMS dentro del mismo paso que lo usa;
   3. comprueba la clave contra el proveedor (Koibox: `GET /api/api-key/me/`);
   4. escribe el resultado en **una sola `forOrganization(org).transaction` que empieza con `select … from integrations where id = <integración> and organization_id = org for update`**. La comprobación contra el proveedor (paso 3) va antes y fuera de la transacción; la decisión se toma con el estado que hay **después** del bloqueo, no con el que había al empezar. La limpieza al desconectar (sección 5) toma el mismo bloqueo, así que las dos nunca se cruzan:
      - **la integración está desconectada** (la persona desconectó mientras tanto): no se escribe nada;
      - **en cualquier otro estado** (pendiente, activa o en error), si la clave **vale**:
        - si la integración **ya tiene `secret_id`** (una rotación, o una reconexión que aún conserva el de antes): se cambia la clave de **ese mismo secreto**, `where id = <secret_id actual> and organization_id = org and kind = 'integration'`, con `rotated_at`. No se inserta otro: el nombre del secreto es único en cada organización (`koibox.<local>` o `koibox.api_key`), así que un segundo secreto con el mismo nombre fallaría;
        - si **no tiene `secret_id`** (primera conexión, o una en error que nunca tuvo clave buena): se inserta un secreto nuevo con `SecretVault` (ADR 0034) y se enlaza;
        - en los dos casos la integración queda activa;
      - si la clave **no vale**:
        - una **pendiente** pasa a error. Si conservaba un `secret_id` de antes (una reconexión antes de que llegara la limpieza), en la misma transacción se le quita y se borra ese secreto (`where id = <secret_id> and organization_id = org and kind = 'integration'`). Es la clave que la persona quiso quitar al desconectar, así que no se guarda ni un momento más de lo necesario;
        - una **activa o en error** no cambia ni de estado ni de secreto, y el resultado se apunta en el evento `integration.key_rejected` (solo identificadores) para que la pantalla avise;
   5. borra el envío en cualquier caso.
4. La pantalla relee el estado (activa o error, con un mensaje sin detalles de la clave).

### 5. Rotar y desconectar

- **Rotar** es otro envío sobre una integración activa o en error (la guarda lo admite). Si la nueva clave vale, cambia la clave del mismo secreto (`rotated_at`), o inserta uno si la integración no tenía, y la integración queda activa. Si no vale, la integración sigue como estaba y la pantalla avisa (sección 4, paso 4).
- **Desconectar:** la persona pasa la integración a desconectada (como en O-02) y el worker, al recibir el evento, limpia el secreto exacto que tenía: el evento lleva el `secret_id` anterior (`OLD.secret_id`, lo pone el disparador; nunca el cliente). La clave sigue viva en Koibox: la pantalla le dice al cliente que la revoque allí. Las dos escrituras van en una sola `createServiceDb().forOrganization(org).transaction`, con `org` sacada de la fila del evento en el outbox (como en la sección 4). Esa transacción empieza con el mismo `select … for update` de la fila de la integración que el paso 4 de la sección 4:
  1. `update integrations set secret_id = null where id = <integración> and organization_id = org and status = desconectada and secret_id = <secret_id del evento> returning id`. La guarda solo admite null en una que ya está desconectada;
  2. **solo si ese update tocó la fila**, `delete from integration_secrets where id = <secret_id del evento> and organization_id = org and kind = 'integration'`. Nunca se busca un secreto por nombre. Si el update no tocó nada, no se borra nada.
  - Si la persona reconectó antes de que llegara el evento, la fila ya no está desconectada (o apunta a otro secreto). El update no la toca, y el secreto que tenga, nuevo o rotado sobre el mismo id, sigue intacto.
  - Al reconectar, la persona pasa la integración de desconectada a pendiente. Si aún conserva el `secret_id` de antes (la limpieza no había llegado), una clave buena cambia la clave de ese mismo secreto, y una mala deja la integración en error y borra ese secreto (sección 4, paso 4). La limpieza pendiente ya no toca la fila, porque no está desconectada. Las dos escrituras toman el mismo bloqueo, así que nunca se escribe sobre un secreto borrado, nunca queda un secreto huérfano y nunca hay una integración activa sin secreto.

## Consecuencias

- **Se gana:** la clave en claro solo existe en la memoria de una petición de la web y de un paso del worker; nunca en la base de datos, las copias, el outbox, `dbos` ni los logs. La web no puede descifrar nada. Funciona aunque el worker esté reiniciando.
- **Se pierde:** la respuesta no es inmediata (unos segundos hasta que el worker procesa el envío); una tabla, un evento y un workflow más; y `moodly_worker` pasa a escribir secretos (sección 3), acotado por columnas y por dos guardas.
- **Pendiente antes del primer secreto real** (lo prepara producto, en la nube del equipo, no en el repositorio):
  - la clave simétrica de `SecretVault` del ADR 0034 y la asimétrica de ingreso de este ADR, en `eu-central-1`, una por entorno;
  - el rol de IAM del worker con `kms:Encrypt`/`kms:Decrypt` sobre la de `SecretVault` y `kms:Decrypt` sobre la de ingreso;
  - la parte pública de la de ingreso como variable de la web.
- **Pruebas que exige** (con el incremento 2):
  - pgTAP: la app solo inserta (ni lee, ni cambia, ni borra), solo el `org_admin` con aal2 y solo en su organización; el evento sale con el envío; los negativos del worker de la sección 3;
  - el freno de envíos de la web (el sexto en 15 minutos no se inserta);
  - integración del worker con el par local: un envío movido a otra organización o integración no se descifra; en la primera conexión, una clave mala deja la integración en error y borra el envío; **al rotar, una clave mala no cambia ni el estado ni el secreto (sigue la clave anterior), emite `integration.key_rejected` y borra el envío**; al desconectar, el worker deja `secret_id` a null y borra el secreto del evento (el `secret_id` anterior), y **si la persona reconectó antes de que llegara el evento, la limpieza no toca nada**. Reconexión con el `secret_id` viejo aún enlazado: con una clave buena se cambia la clave de ese mismo secreto, sin insertar otro (el nombre es único); con una mala, la integración pasa a error, sin `secret_id`, y el secreto viejo se borra en la misma transacción. Una integración en error y sin secreto acepta un envío nuevo (inserta y activa). **Cruce de la rotación o reconexión con la limpieza** (los dos workflows sobre la misma integración a la vez, con la comprobación de la clave ya hecha): por el `for update`, en cualquier orden no queda ningún secreto huérfano, ninguna integración activa sin secreto, y nada escribe sobre un secreto borrado. Un envío que termina cuando la integración ya está desconectada no escribe nada. Un evento con el `secret_id` de otra organización no cambia ni borra nada (RLS y el filtro por `organization_id`); la guarda rechaza poner `secret_id` a null en una activa o en error, o en una pendiente que no pasa a error (y lo admite en una desconectada y al pasar una pendiente a error); el estado del workflow no contiene la clave;
  - e2e de la pantalla contra el Koibox falso;
  - un test estructural de que ningún log ni evento lleva el campo de la clave.
- **Alcance:** solo las integraciones con clave del cliente. Lo que va por Nango (OAuth) no cambia (ADR 0053).
