# 0034 — BYOK y secretos: `SecretVault` con cifrado de sobre y AWS KMS

- **Estado:** aceptado (producto, 2026-10-30)
- **Fecha:** 2026-10-30
- **Secciones del MANUAL afectadas:** §4 (`org_model_settings`, `integration_secrets`), §10.4, §18 #6
- **Relación:**
  - concreta el ADR 0019 §3–§4 (tres modos de conexión; cifrado de sobre con una clave por tenant en un KMS);
  - fija la decisión de producto del 2026-10-24 (AWS KMS en `eu-central-1`, con una clave maestra por entorno y una clave de datos ligada a cada `organization_id`);
  - el ADR 0033 (enrutador) lee el modo de conexión que guarda este;
  - el ADR 0035 (residencia) usa la misma tabla.

## Contexto

Un cliente grande quiere traer sus claves de modelo (BYOK). El piloto, además, necesitará guardar el token de WhatsApp de cada número y los tokens OAuth de cada integración. Faltaba:
- dónde se guardan esos secretos;
- quién puede leerlos;
- cómo se cifran;
- cómo sabe el enrutador que una organización está en BYOK.

## Decisión

1. **`integration_secrets`** guarda cada secreto de una organización: una clave de modelo o el token de una integración.
   - Solo guarda texto cifrado (base64), la referencia de la clave maestra y la clave de datos cifrada.
   - **La app no lo lee ni lo escribe:** una política explícita que no deja pasar a nadie y ningún privilegio para `anon` ni `authenticated`. Tampoco lo lee el equipo interno.
   - Solo el worker accede, con `forOrganization(org)`.
2. **`SecretVault`** (worker, `apps/worker/src/secrets`), con **cifrado de sobre**:
   - una clave de datos aleatoria por secreto cifra el valor con AES-256-GCM, con la organización como dato asociado;
   - la clave maestra cifra la clave de datos, también ligada a la organización (en KMS, con el contexto de cifrado `organization_id`);
   - un secreto copiado a otra organización, con un byte cambiado o cifrado con otra clave maestra no se descifra;
   - el valor en claro solo existe en memoria, en el momento de usarlo, y la clave de datos se borra después.
3. **La clave maestra:**
   - **AWS KMS en `eu-central-1`,** solo KMS (no Bedrock), con una clave por entorno. Llega con la primera integración que guarde credenciales, no en este paso.
   - **En desarrollo y en los tests,** una clave local de 32 bytes con la misma interfaz (`local:v1`), que nunca se usa en staging ni en producción.
4. **`org_model_settings.connection`** (`managed`, `byok` o `customer_cloud`) **lo pone solo la plataforma** cuando guarda las claves del cliente. La app no puede cambiarlo: no tiene privilegio sobre la columna y una guarda lo impide.
   - Así, «estoy en BYOK» siempre significa que las claves existen.
   - Y el enrutador nunca cae a credenciales de Moodly (ADR 0033).

## Alternativas consideradas

- **Supabase Vault.** Ya descartado en el ADR 0019: el secreto y la clave quedan en el mismo sistema, y el descifrado no deja rastro en un KMS.
- **Cifrar con una sola clave de la aplicación.** Una fuga de esa clave lo abre todo y no se puede rotar por organización.
- **Dejar que el `org_admin` elija el modo de conexión.** Podría marcar BYOK sin claves, y el enrutador fallaría en producción o, peor, se tentaría a caer a las de Moodly.

## Consecuencias

- **Pendiente antes del primer secreto real:**
  - crear la clave de KMS y el rol del worker (en la nube del equipo, no en el repositorio);
  - el `KeyProvider` de KMS, con el contexto de cifrado `organization_id`;
  - la rotación (`rotated_at`) y la pantalla de Ajustes → Modelos para traer claves.
- Rotar la clave maestra = volver a cifrar las claves de datos, sin tocar los valores. Para eso se guarda `key_ref` con cada secreto.

## Verificación

- **pgTAP `23_model_settings_secrets`:** la app ni el equipo interno leen ni escriben secretos; un secreto por organización, tipo y nombre; solo base64. Una mutación que deja leerlos se detecta.
- **`SecretVault`, 13 tests:**
  - ida y vuelta, también con Unicode;
  - nada en claro en lo guardado;
  - otra organización, otro byte, otra clave de datos, otra clave maestra u otra versión de clave no descifran;
  - el IV no se repite nunca, tampoco bajo la clave maestra.

  4 mutaciones, todas detectadas: sin ligar a la organización, sin comprobar la referencia, IV fijo y sin etiqueta GCM.
