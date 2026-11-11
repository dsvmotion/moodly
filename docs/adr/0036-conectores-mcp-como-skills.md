# 0036 — Conectores: servidores MCP revisados, herramientas fijadas y skills `mcp`

- **Estado:** aceptado (producto, 2026-10-30)
- **Fecha:** 2026-10-30
- **Secciones del MANUAL afectadas:** §4 (`integrations`, `skills`), §5.5, §7.1
- **Relación:**
  - concreta el ADR 0030 §2 (skills `mcp`: cada herramienta de un servidor conectado es una skill, y entra sin clasificar como `external_message` en `draft`);
  - aplica la revisión de seguridad del 2026-10-20 §7.3 (servidores MCP de terceros);
  - aplica los controles 3.4 y 3.8 del ADR 0047 (destinatarios del runtime; lo que se lee es dato, no instrucción);
  - las credenciales van en `integration_secrets` con el `SecretVault` (ADR 0034);
  - roadmap enterprise §3.4 (MCP como estándar de conectores);
  - **modificado por el ADR 0053** (2026-11-11): el hub de integraciones de plataforma es Nango autoalojado en la UE; las skills `mcp` y sus credenciales en `integration_secrets` no cambian.

## Contexto

MCP es el estándar abierto para conectar agentes con herramientas, y es el camino rápido del MANUAL §7.1 («MCP primero»). Un servidor MCP de terceros, sin embargo, trae cuatro riesgos:

1. **Herramientas peligrosas:** puede ofrecer herramientas que nadie ha revisado, como «exportar todo» o «borrar».
2. **Cambios después de revisarlas (*rug pull*):** puede cambiar una herramienta, o solo su descripción, después de revisarla. El modelo lee esa descripción, así que es una vía de inyección.
3. **Destinatarios o tenant colados:** puede pedir en su entrada un destinatario o el tenant, que solo pone el runtime (control 3.4).
4. **Respuestas e infraestructura:** puede devolver texto con instrucciones, respuestas enormes o no responder. Y una URL mal elegida puede llevar el worker a la red interna o a los metadatos de la nube.

Faltaba el modelo de datos de las integraciones y la forma de llamar a una herramienta MCP con esas protecciones. Este paso no conecta ningún servidor real.

## Decisión

1. **`integrations`:** una fila por integración de una organización o de uno de sus locales, con:
   - el proveedor y el tipo (`mcp` o `native`);
   - la versión revisada del servidor (solo MCP);
   - el estado y los permisos;
   - el secreto cifrado, siempre de la misma organización (clave externa compuesta);
   - quién la conectó y la última comprobación de salud.

   Quién accede:
   - **La ve el `org_admin`.** El resto del equipo ve las skills que salen de ella, no la integración.
   - **La escribe solo la plataforma** hasta que llegue el flujo de conexión (OAuth, revisión de seguridad §7.2), que traerá su propia política y su auditoría.
   - **Lo que la identifica no cambia:** organización, local, proveedor y tipo.
   - **Una integración con skills no se borra:** se desconecta (`status`).
2. **Catálogo de servidores revisados** (`REVIEWED_MCP_SERVERS`, en `packages/integrations`):
   - solo se conecta un servidor que está ahí, en su versión exacta y con su lista de herramientas revisadas;
   - añadir uno es un PR con su revisión: quién lo mantiene, qué hace cada herramienta, con qué permisos y dónde procesa;
   - hoy está vacío.
3. **Antes de conectar, `assertSafeServerUrl`:**
   - solo `https` en el puerto por defecto, sin credenciales en la URL y con un nombre público (nunca una IP, `localhost`, `.internal` o `.local`);
   - todas las direcciones a las que resuelve tienen que ser públicas: ni privadas, ni loopback, ni enlace local, ni CGNAT, ni metadatos de la nube, ni IPv4 escondidas en IPv6;
   - el transporte conecta a la dirección comprobada, sin volver a resolver (contra el *DNS rebinding*).
4. **Cada herramienta importada es una skill `mcp` fijada:**
   - lleva `mcp_tool_name` y `mcp_tool_hash`, el SHA-256 del JSON canónico de su nombre, su descripción y su esquema de entrada;
   - `importMcpTools` solo importa las herramientas revisadas del servidor.
   
   La base de datos impone:
   - una skill `mcp` es siempre de una organización, y sale de una integración MCP de esa misma organización;
   - entra como `external_message` en `draft`, con máximo `draft` y estado `draft`, diga lo que diga el importador;
   - **si cambia la herramienta fijada (nombre, huella o integración), vuelve a ese estado**;
   - si baja el techo de una skill, los agentes que la tenían por encima bajan con ella (`cap_agent_skills_autonomy`). Así `agent_skills` nunca supera `skills.max_autonomy`, que es lo que lee el runtime.
5. **La entrada de la herramienta, como la de una skill de código** (`toolInputSchema`):
   - un objeto que no dice nada de `additionalProperties` se cierra, para que solo lleguen los campos revisados;
   - con campos reservados (destinatarios, tenant, local, contacto) o claves abiertas, la herramienta se importa, pero **no se puede usar como skill** (`mcpSkill` falla) hasta tener un conector que ponga esos campos desde el runtime;
   - una herramienta MCP **no puede ser `external_outreach`**: su audiencia la calcula una consulta de la plataforma con consentimientos, no un tercero.
6. **La única forma de llamar es `governMcpClient`.** Envuelve un cliente con las credenciales de **una** organización y, en cada llamada:
   - solo deja herramientas revisadas;
   - nunca deja campos reservados en los argumentos;
   - pide al servidor la herramienta que anuncia en ese momento, y **no la llama si su huella ya no es la fijada**;
   - corta por tiempo (20 s);
   - deja pasar solo texto, recortado a 20.000 caracteres;
   - **devuelve un dato no confiable con su procedencia** (`mcp:<servidor>@<versión>/<herramienta>`), que el runtime le da al modelo como dato, nunca como instrucción (control 3.8);
   - sus errores no repiten el mensaje del servidor ni los argumentos (ADR 0032).

   Además, la skill comprueba que la conexión es de la organización del run.
7. **Frontera estructural** (`sdk-boundary.test.ts`): nada fuera de `packages/integrations/src/mcp/transports/` importa un cliente MCP.

## Alternativas consideradas

- **Fiarse de la lista de herramientas del servidor en cada conexión, sin fijarlas.** Es lo que hacen muchos clientes MCP. Un cambio en una descripción o en un esquema llegaría al modelo sin que nadie lo revise.
- **Conectores nativos para todo.** Más control, pero cada API a mano. Se mantienen para lo que mueve el negocio del piloto (WhatsApp, reservas o calendario; roadmap §3.4), y MCP para ampliar el catálogo.
- **Convertir el esquema de la herramienta sin cerrarlo.** Por defecto, JSON Schema admite claves no declaradas, y el modelo podría colar campos que nadie revisó.
- **Dejar al `org_admin` añadir servidores por URL.** Es la fase F3–F4 (servidores MCP del cliente). Llegará con su propio ADR: revisión, aislamiento de red por cliente y quién responde de ese servidor.

## Consecuencias

- **Pendiente para el primer servidor real:**
  - su entrada en el catálogo con la revisión;
  - el transporte en `mcp/transports/`, con el SDK oficial fijado a una versión, conectando a la dirección comprobada y con las credenciales del `SecretVault`;
  - el flujo de conexión (OAuth con PKCE y `state` atado a la sesión y a la organización);
  - la comprobación periódica de salud: una integración rota baja sus skills a `suggest` (`integrationHealthy`, MANUAL §7.1).
- **La clasificación de herramientas en Ajustes → Integraciones** (quién, con `aal2` y auditada) llega con esa pantalla (F3). Hasta entonces, solo la plataforma clasifica.
- **Las interfaces por tipo** (`CalendarProvider`, `BookingProvider`…) llegan con su primer conector (B19), para no diseñarlas sin uso.

## Verificación

- **pgTAP `24_integrations_mcp`:** 31 tests.
  - Quién ve las integraciones: `org_admin` sí; `location_manager` y otra organización no. La app no las escribe.
  - Su formato e integridad: local, persona y secreto de la misma organización; una por proveedor y ámbito; lo que la identifica no cambia.
  - Las skills `mcp`: entran sin clasificar, vuelven a ese estado si cambia la herramienta y los agentes bajan con su techo. Siempre de una organización, con huella e integración MCP propias.

  15 mutaciones de la migración, todas detectadas.
- **`packages/integrations`:** 83 tests.
  - URL segura: 34.
  - Esquema cerrado y campos reservados.
  - Importación y huella.
  - Conexión gobernada: herramienta no revisada, cambiada o desaparecida, campos reservados, recorte, tiempo y errores sin datos.
  - La skill con `decide()`.
  - Frontera estructural.

  17 mutaciones, todas detectadas.
