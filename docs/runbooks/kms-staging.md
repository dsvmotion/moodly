# Runbook: claves de AWS KMS para staging

**Para quién:** producto (Diego), en la consola de AWS.
**Por qué:** los secretos de las integraciones con clave del cliente (Koibox; ADR 0034 y 0055) se cifran con AWS KMS en `eu-central-1`. En desarrollo y en los tests el código usa un par de claves local. En staging hacen falta dos claves de KMS y un usuario de IAM para el worker.
**Cuánto se tarda:** unos 30 minutos.
**Qué no hacer:** no pegues en el chat, en GitHub ni en el repositorio ninguna clave de acceso de AWS. Las claves de acceso solo van en las variables del servicio `worker` de Railway.

> Estado del código (2026-11-14): el worker todavía no lee estas variables. Las lee el incremento 2 de Koibox (ADR 0055), que está en construcción. Hasta entonces, crear todo esto no cambia nada en staging. Los nombres de las variables de abajo son los que leerá ese código.

## 0. La cuenta de AWS

- Usa una cuenta de AWS solo para Moodly, o una cuenta de staging dentro de una AWS Organization. No uses una cuenta personal ni una con otros proyectos.
- El usuario raíz tiene MFA y **no tiene claves de acceso**.
- Trabaja con un usuario administrador con MFA (IAM Identity Center o un usuario de IAM). Nunca con el raíz.
- Región: **Europe (Frankfurt) `eu-central-1`**. Comprueba el selector de región, arriba a la derecha, antes de cada paso. Las claves de KMS son de una sola región.

## 1. La clave de `SecretVault` (simétrica)

Cifra las claves de datos de cada secreto, con el contexto de cifrado `organization_id` (ADR 0034).

1. KMS → **Customer managed keys** → **Create key**.
2. **Key type:** Symmetric. **Key usage:** Encrypt and decrypt. **Advanced options:** origen KMS y **Single-Region key**.
3. **Alias:** `moodly-staging-secret-vault`. **Description:** `Moodly staging: SecretVault (ADR 0034)`.
4. **Key administrators:** solo tu usuario administrador. Desmarca «Allow key administrators to delete this key» si no lo necesitas.
5. **Key users:** **ninguno**. El permiso de uso lo da la política de IAM del paso 3, que es más estrecha que la que pone el asistente.
   - **Deja la política de la clave tal como la propone el asistente.** Su primera declaración, `"Sid": "Enable IAM User Permissions"` (principal `arn:aws:iam::<cuenta>:root`, acción `kms:*`), es la que hace que KMS respete las políticas de IAM de esta cuenta. Sin ella, y con «Key users» vacío, la política del paso 3 no serviría y el worker no podría usar la clave. No la borres ni la edites (en la clave → **Key policy**, debe seguir ahí).
6. Crea la clave. En la clave → pestaña **Key rotation** → activa **Automatically rotate this KMS key** (cada año). Los secretos antiguos se siguen descifrando.
7. Apunta el **ARN** de la clave (`arn:aws:kms:eu-central-1:<cuenta>:key/<id>`). No es secreto.

## 2. La clave de ingreso (asimétrica)

La web cifra con su parte pública la clave que pega el cliente, y solo el worker la descifra (ADR 0055 §1).

1. KMS → **Customer managed keys** → **Create key**.
2. **Key type:** Asymmetric. **Key usage:** Encrypt and decrypt. **Key spec:** `RSA_4096`. Single-Region.
3. **Alias:** `moodly-staging-integration-ingress`. **Description:** `Moodly staging: ingreso de claves de integraciones (ADR 0055)`.
4. **Key administrators:** solo tu usuario administrador. **Key users:** ninguno (igual que en el paso 1), y la política de la clave tal como la propone el asistente, con la declaración `Enable IAM User Permissions` (ver el paso 1.5).
5. Crea la clave y apunta su **ARN**.
6. La parte pública: en la clave → pestaña **Public key** → **Download**, o con la CLI:
   ```
   aws kms get-public-key --region eu-central-1 --key-id <ARN de la clave de ingreso> --query PublicKey --output text
   ```
   Sale en base64 (DER). **No es secreta**: es la variable de la web del paso 5.
7. Las claves asimétricas no rotan solas. Rotarla es crear otra (ver «Rotación»).

## 3. El usuario de IAM del worker

Railway no da un rol de IAM a los contenedores ni una identidad federada que AWS pueda verificar. Lo más seguro que queda es un **usuario de IAM solo para el worker de staging**, sin consola, con una política mínima y claves de acceso que solo viven en Railway.

1. IAM → **Users** → **Create user**.
   - **Name:** `moodly-staging-worker`.
   - **No** marques «Provide user access to the AWS Management Console».
   - Sin grupos y sin políticas gestionadas.
2. En el usuario → **Add permissions** → **Create inline policy** → JSON. Pega esta política con los dos ARN y llámala `moodly-staging-worker-kms`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "SecretVaultConContextoDeOrganizacion",
         "Effect": "Allow",
         "Action": ["kms:Encrypt", "kms:Decrypt"],
         "Resource": "<ARN de moodly-staging-secret-vault>",
         "Condition": {
           "ForAllValues:StringEquals": { "kms:EncryptionContextKeys": ["organization_id"] },
           "Null": { "kms:EncryptionContextKeys": "false" }
         }
       },
       {
         "Sid": "IngresoSoloDescifrar",
         "Effect": "Allow",
         "Action": "kms:Decrypt",
         "Resource": "<ARN de moodly-staging-integration-ingress>",
         "Condition": {
           "StringEquals": { "kms:EncryptionAlgorithm": "RSAES_OAEP_SHA_256" }
         }
       }
     ]
   }
   ```
   - Sobre la clave de `SecretVault`: cifrar y descifrar, y solo con el contexto `organization_id` (sin él, KMS dice que no).
   - Sobre la de ingreso: solo descifrar, y solo con el algoritmo del ADR. Ni `kms:Encrypt` ni `kms:GetPublicKey` (la web ya tiene la parte pública).
   - Nada más: ni crear, ni borrar, ni listar claves, ni otros servicios.
3. En el usuario → **Security credentials** → **Create access key** → caso de uso «Application running outside AWS». Copia el **Access key ID** y el **Secret access key** **directamente** a Railway (paso 4), sin pasar por el chat, un archivo o el portapapeles de otra aplicación. AWS solo enseña el secreto una vez: si se pierde, se crea otra.

## 4. Las variables del worker (Railway)

Proyecto `moodly-staging` → servicio `worker` → **Variables**, en el entorno `staging`:

| Variable | Valor | ¿Secreta? |
|---|---|---|
| `AWS_REGION` | `eu-central-1` | No |
| `AWS_ACCESS_KEY_ID` | la del paso 3 | Sí |
| `AWS_SECRET_ACCESS_KEY` | la del paso 3 | **Sí** |
| `SECRET_VAULT_KMS_KEY_ID` | ARN de `moodly-staging-secret-vault` | No |
| `INTEGRATION_INGRESS_KMS_KEY_ID` | ARN de `moodly-staging-integration-ingress` | No |

- Si Railway ofrece sellar la variable (que no se vuelva a ver su valor), séllala para las dos claves de acceso.
- No las pongas en GitHub (ni en secretos de Actions), en Vercel ni en el `.env` de nadie: el único que las usa es el worker.

## 5. Las variables de la web (Vercel)

Proyecto de la web de staging → **Settings → Environment Variables**, solo para el entorno de staging:

| Variable | Valor | ¿Secreta? |
|---|---|---|
| `INTEGRATION_INGRESS_PUBLIC_KEY` | la parte pública del paso 2.6 (base64) | No |
| `INTEGRATION_INGRESS_KEY_REF` | ARN de `moodly-staging-integration-ingress` | No |

La web **no** recibe ninguna clave de acceso de AWS ni permiso de KMS (ADR 0050 y 0055).

## 6. Comprobar

- Con el usuario `moodly-staging-worker` no se puede entrar en la consola, y en **Permissions** solo aparece la política del paso 3.
- En CloudTrail → **Event history**, filtrando por **Event source** `kms.amazonaws.com`, aparece cada `Encrypt` y `Decrypt` del worker con el usuario `moodly-staging-worker` (cuando haya código que las use).
- La prueba de extremo a extremo (pegar una clave de Koibox en staging y verla activa) llega con el incremento 2. Hasta entonces, nada de esto está «verificado en real».

## Rotación

- **Claves de acceso del usuario, cada 90 días** (y en cuanto se sospeche una fuga):
  1. crea una segunda clave de acceso en el usuario;
  2. cámbiala en Railway y vuelve a desplegar el worker;
  3. comprueba que el worker responde en `/health` y que una integración de Koibox sigue activa;
  4. **desactiva** la clave vieja, y bórrala una semana después si nada ha fallado.
- **Clave de `SecretVault`:** la rotación automática anual del paso 1.6. No hace falta nada más.
- **Clave de ingreso:**
  1. crea otra igual (paso 2);
  2. en la política del paso 3, la declaración `IngresoSoloDescifrar` pasa a tener las dos claves: `"Resource": ["<ARN de la clave vieja>", "<ARN de la nueva>"]`. Así el worker puede abrir los envíos cifrados con cualquiera de las dos mientras dura el cambio;
  3. cambia en Vercel `INTEGRATION_INGRESS_PUBLIC_KEY` y `INTEGRATION_INGRESS_KEY_REF` a los de la nueva, y en Railway `INTEGRATION_INGRESS_KMS_KEY_ID`;
  4. espera al menos 15 minutos: los envíos viejos caducan (ADR 0055 §2);
  5. deja en `Resource` solo el ARN nuevo (vuelve a ser una cadena, no una lista) y programa el borrado de la vieja en KMS (el mínimo son 7 días).

## Si se filtra una clave de acceso

1. IAM → el usuario → **Security credentials** → desactiva la clave filtrada.
2. Crea otra y ponla en Railway (paso 4).
3. Revisa en CloudTrail qué hizo esa clave desde la fecha probable de la fuga.
4. Avisa a V1, que lo apunta en `docs/STATUS.md`.

## Producción

Es el mismo procedimiento, con `production` en lugar de `staging` en los nombres, otras dos claves y otro usuario. **Nunca** se comparten claves ni usuario entre entornos.
