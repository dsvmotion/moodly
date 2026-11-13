# 0055 — Alta de las claves de una integración: cifrada hacia el worker y una tabla de solo inserción

- **Estado:** propuesto (V15, 2026-11-13). Lo decide producto (V1 lo lleva).
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
- **La app solo inserta:** política de INSERT para el `org_admin` con aal2 de esa organización (`session_is_active()` y `session_is_aal2()` como siempre), privilegios de columna solo de INSERT, **ningún SELECT, UPDATE ni DELETE para `authenticated`**. Una guarda fija `submitted_by` y comprueba que la integración es de la organización y está pendiente.
- **El worker** (`moodly_worker`, ADR 0049): SELECT de las columnas que necesita y DELETE, con su política por organización. Sin INSERT ni UPDATE.
- **Límites:** un envío vivo por integración (una restricción única: el siguiente sustituye al anterior) y una caducidad corta (por ejemplo, 15 minutos): un barrido del worker borra los que no se procesaron.

### 3. El recorrido

1. El `org_admin` pega la clave en Ajustes → Integraciones (Server Action con `requireUser()`, `org_admin` y aal2). La fila de `integrations` pasa a «pendiente» (como en O-02).
2. El servidor de la web cifra la clave con la parte pública, inserta el envío y emite el evento `integration.key_submitted` (solo identificadores) con su log de auditoría, **sin el valor**. La clave en claro no sale de la memoria de esa petición.
3. El worker, al recibir el evento por el outbox (ADR 0009), en un workflow de DBOS cuyo estado lleva **solo identificadores**:
   1. lee el envío (`forOrganization(org)`; la organización sale de la fila, nunca del payload);
   2. lo descifra con KMS dentro del mismo paso que lo usa;
   3. comprueba la clave contra el proveedor (Koibox: `GET /api/api-key/me/`);
   4. si vale, la cifra con `SecretVault` (ADR 0034) en `integration_secrets`, enlaza `integrations.secret_id` y pone la integración activa; si no, la pone en error;
   5. borra el envío en cualquier caso.
4. La pantalla relee el estado (activa o error, con un mensaje sin detalles de la clave).

### 4. Rotar y desconectar

- **Rotar** es otro envío: si la nueva clave vale, sustituye al secreto (`rotated_at`); si no, la integración sigue con la anterior y se avisa.
- **Desconectar** borra el secreto y deja la integración desconectada (la clave sigue viva en Koibox: la pantalla le dice al cliente que la revoque allí).

## Consecuencias

- **Se gana:** la clave en claro solo existe en la memoria de una petición de la web y de un paso del worker; nunca en la base de datos, las copias, el outbox, `dbos` ni los logs. La web no puede descifrar nada. Funciona aunque el worker esté reiniciando.
- **Se pierde:** la respuesta no es inmediata (unos segundos hasta que el worker procesa el envío); una tabla, un evento y un workflow más.
- **Pendiente antes del primer secreto real** (lo prepara producto, en la nube del equipo, no en el repositorio):
  - la clave simétrica de `SecretVault` del ADR 0034 y la asimétrica de ingreso de este ADR, en `eu-central-1`, una por entorno;
  - el rol de IAM del worker con `kms:Encrypt`/`kms:Decrypt` sobre la de `SecretVault` y `kms:Decrypt` sobre la de ingreso;
  - la parte pública de la de ingreso como variable de la web.
- **Pruebas que exige** (con el incremento 2):
  - pgTAP: la app solo inserta (ni lee, ni cambia, ni borra), solo el `org_admin` con aal2 y solo en su organización; el worker no inserta; un envío de otra organización no se ve;
  - integración del worker con el par local: un envío movido a otra organización o integración no se descifra; una clave mala deja la integración en error y borra el envío; el estado del workflow no contiene la clave;
  - e2e de la pantalla contra el Koibox falso;
  - un test estructural de que ningún log ni evento lleva el campo de la clave.
- **Alcance:** solo las integraciones con clave del cliente. Lo que va por Nango (OAuth) no cambia (ADR 0053).
