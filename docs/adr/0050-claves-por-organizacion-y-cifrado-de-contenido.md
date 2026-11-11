# 0050 — Claves por organización: cifrado de sobre de los mensajes y los datos de contacto, y borrado destruyendo la clave (T4)

- **Estado:** propuesto
- **Fecha:** 2026-11-11
- **Secciones del MANUAL afectadas:** §4.2 (`messages`, `contacts`, `contact_identities`), §10.3, §10.4, §11 (borrado)
- **Relación:**
  - auditoría de preproducción §17.3 T4, §18.2 («T4: do it now»), §18.4 etapa D («claves por organización antes del primer mensaje real»), §18.5 V1 #5 y hallazgo H-02;
  - amplía el ADR 0034 (`SecretVault`, AWS KMS en `eu-central-1`), que hoy solo cifra secretos, al contenido de los clientes;
  - el acceso del worker a los datos es el del ADR 0049; la ingesta de mensajes, la del ADR 0052;
  - unidad `PL-T4` (M3) de `docs/scope.yaml` y condición 8 de salida a producción en `docs/STATUS.md`.

## Contexto

- **El contenido de los clientes está en claro** en la base de datos, en sus copias y en el estado de los workflows:
  - `messages.content` (`20261031130000_contacts_conversations.sql:203`);
  - `contacts.display_name` (`:79`);
  - `contact_identities.external_id` (teléfono, email; `:97-111`), con una restricción única y comprobaciones de formato (E.164, minúsculas) que hoy se aplican sobre el valor en claro;
  - la salida del paso `load` del turno (`apps/worker/src/agents/converse.ts:490`), que lleva la conversación, queda guardada en el esquema `dbos`.
- **No hay forma de borrar a una persona o a una organización de todo** (H-02): las copias de seguridad y la recuperación a un punto en el tiempo conservan el texto, y el estado de los workflows también.
- **El `SecretVault` existe pero nadie lo usa.** Solo lo importa su test (`apps/worker/src/secrets/vault.test.ts`); la única clave maestra es la local de desarrollo (`vault.ts:93-109`). Su esquema es una clave de datos por secreto, envuelta por una clave maestra por entorno con la organización como contexto (ADR 0034): destruir una organización no se puede hacer destruyendo una clave.
- **Quién lee el contenido hoy:**
  - la web, por RLS: la bandeja (`apps/web/src/lib/inbox-data.ts:189` y `229`) y el envío de un mensaje del equipo (`apps/web/src/app/app/inbox/actions.ts:92`);
  - dos funciones SQL que insertan mensajes (`20261104090000_test_chat.sql:171` y `20261110100000_knowledge_requests.sql:213`);
  - el worker, para el turno y los recordatorios.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **A. Solo el cifrado del disco del proveedor y borrar filas** | Nada que construir | El borrado no llega a las copias ni a `dbos`; no hay argumento de venta |
| **B. Una clave de KMS por organización** (clave gestionada por el cliente en AWS KMS, `eu-central-1`) que envuelve las claves de datos de esa organización | Borrar = desactivar la clave (al momento) y programar su destrucción: el contenido queda ilegible también en las copias. Cada descifrado queda en el registro de KMS con su organización | Un coste fijo por organización y al mes en KMS (del orden de 1 $ por clave, a verificar); crear la clave es un paso más del alta |
| **C. Una clave maestra por entorno y una clave de organización envuelta, guardada en la base de datos** | Más barata a escala | La clave de organización envuelta viaja en las copias de la base de datos y la maestra la sigue abriendo: para que borrar sea real, esa tabla tendría que vivir fuera de las copias. Más difícil de demostrar |
| **D. Cifrado dentro de Postgres** (pgsodium y similares) | Transparente para las consultas | La clave vive en el mismo sistema que los datos (por eso el ADR 0019 descartó Supabase Vault) |

## Decisión recomendada

**Opción B, con la interfaz preparada para pasar a C** si el número de organizaciones hace caro B.

1. **Jerarquía de claves:**
   - una clave de KMS por organización (alias `org/<organization_id>`), creada en el alta por el worker con un rol de IAM que solo puede crear, usar y desactivar claves con ese prefijo;
   - una clave de datos por organización y periodo (por ejemplo, por mes), envuelta por la de KMS y guardada en `organization_data_keys`;
   - la clave de datos en claro solo en memoria del proceso que la usa, con una caché corta por organización para no llamar a KMS en cada mensaje.
2. **Qué se cifra** (AES-256-GCM, con la organización y la fila como dato asociado):
   - `messages.content` y los metadatos de los adjuntos;
   - `contacts.display_name`;
   - `contact_identities.external_id`, con un **índice ciego**: una columna HMAC con una clave por organización, que mantiene la unicidad y la búsqueda por teléfono o email. Las comprobaciones de formato pasan a la aplicación, antes de cifrar;
   - las respuestas de `knowledge_requests` que se envían al cliente.
3. **El estado de los workflows lleva identificadores, no contenido** (H-02): los pasos de DBOS devuelven ids y el contenido se vuelve a leer y descifrar dentro del paso que lo usa.
4. **Quién descifra:**
   - el worker, para el turno, los recordatorios y los envíos;
   - el servidor de la web (nunca el navegador), para la bandeja: lee por RLS lo que la sesión puede ver y descifra con un permiso de KMS limitado al contexto `organization_id` de la fila. El cliente de Supabase de la web sigue sin la clave secreta (CLAUDE.md).
5. **Las dos funciones SQL que insertan mensajes** pasan a recibir el texto ya cifrado desde la aplicación, o se sustituyen por código del worker y de la web.
6. **Borrar una organización:** desactivar su clave (ilegible al momento), programar su destrucción con el plazo mínimo de KMS (7 días) y borrar las filas. **Borrar a una persona** (un contacto): borrar sus filas y seudonimizar sus eventos (decisión de producto #14); su contenido en las copias caduca con la retención de las copias. Si eso no bastara a la asesoría legal, el siguiente paso es una clave por contacto.

## Consecuencias

- **Se gana:** un borrado que se puede demostrar («destruimos tu clave») y que alcanza copias y estado; cada lectura del contenido queda en el registro de KMS; argumento de venta (auditoría §17.4).
- **Se pierde:** búsqueda de texto y filtros por contenido en SQL sobre los mensajes (hoy no existen); las restricciones de formato del contacto salen de la base de datos.
- **Coste:** una clave de KMS por organización al mes más las peticiones (a verificar en la tarifa de AWS); la caché de claves de datos mantiene las peticiones bajas.
- **Dependencias:** la cuenta de AWS y el rol de KMS del ADR 0034, que siguen pendientes (los crea una persona en la nube del equipo, no en el repositorio).
- **Orden:** después del ADR 0049 (las escrituras del worker pasan por transacciones) y antes del primer mensaje real (M3). El modelo recibe el texto en claro igualmente; enmascararlo es T5.
- **Vuelta atrás:** mientras no haya datos reales, las columnas cifradas conviven con las de texto y se migra por tabla.

## Qué la haría «aceptada»

1. Producto dice sí.
2. Un *spike* en staging demuestra:
   - un mensaje cifrado con la clave de KMS de la organización A se lee en la bandeja de A y no se descifra con la de B (también en pgTAP con el dato asociado cambiado);
   - desactivar la clave de A deja ilegible su contenido, también en una copia restaurada;
   - la búsqueda por teléfono con el índice ciego encuentra al contacto y respeta la unicidad;
   - el coste de KMS por organización y por 1.000 mensajes, medido.

## Verificación

Pendiente: es lo que pide el punto 2 de «Qué la haría aceptada».
