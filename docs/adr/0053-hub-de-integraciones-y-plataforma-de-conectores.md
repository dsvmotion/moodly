# 0053 — Hub de integraciones: gobierno propio para todas las conexiones y una plataforma de conectores para la amplitud

- **Estado:** aceptado (producto, 2026-11-11: «nango seems good», tras comparar las opciones por seguridad y nivel empresa): Nango autoalojado en la UE. Quedan por confirmar antes de construir la licencia (ELv2, uso interno; asesoría legal) y qué incluye la versión autoalojada gratuita (el proxy).
- **Fecha:** 2026-11-11
- **Secciones del MANUAL afectadas:** §3.2, §4 (`integrations`), §7.1, §7.2, §10.4, §18.0 #2
- **Relación:**
  - auditoría de preproducción §18.1 #2, §18.3 #2 («adopt for breadth, build for depth»), §18.4 etapa B, §18.5 V1 #6, §18.8 (oleadas), §19.2 (50 integraciones en el piloto), §19.6 y hallazgos O-02 y A-04;
  - aplica el criterio de construir frente a adoptar (ADR 0031 §5) y el gobierno de conectores del ADR 0036 (catálogo revisado, herramientas fijadas por huella, `governMcpClient`);
  - las acciones pasan por el motor de políticas y empiezan como borrador (ADR 0047); las credenciales, por el `SecretVault` (ADR 0034) con las claves del ADR 0050; el acceso del worker, por el ADR 0049;
  - tareas de producto F10 (DPAs) y F11 («elegir la plataforma de conectores»), y unidades OA08 e `int-*` de `docs/scope.yaml`.

## Contexto

- **El marco de integraciones es un andamio** (O-02):
  - el catálogo de servidores MCP revisados está vacío (`packages/integrations/src/mcp/catalog.ts:20`) y no existe `mcp/transports/`;
  - no hay flujo OAuth;
  - el `SecretVault` solo lo usa su test y solo tiene la clave local (`apps/worker/src/secrets/vault.ts:93-109`);
  - `integrations.kind` admite `mcp` o `native` (`20261031090000_integrations_mcp.sql:33`);
  - la única interfaz por tipo es `BookingProvider`, con el calendario propio (MANUAL §7.1).
- **Producto quiere todas las integraciones posibles** (decisión #2). El piloto cuenta 50 sistemas a nivel 1 o más: 12 en M2 (lote A), 18 en M3 (lote B, con el sistema de reservas del cliente piloto) y 20 en M4 (lote C) (`docs/scope.yaml`, área `integrations`). La auditoría dice que sin una plataforma de conectores 50 sistemas en M4 no es realista (§19.6).
- **Producto, 2026-11-11:** la mínima intervención humana posible. Una plataforma que se contrata hablando con ventas, o un subencargado más con su DPA, son intervención humana.
- **Lo que no se negocia** (ADR 0031 §2, 0036 y 0047): ninguna herramienta llega al modelo sin revisar y fijar; cada acción pasa por `decide()` y empieza como borrador; el tenant, el contacto y los destinatarios los pone el runtime; lo que devuelve un tercero es un dato no confiable.

## El hub, sea cual sea la plataforma

1. **Una interfaz por tipo** (`CalendarProvider`, `CrmProvider`, `PaymentProvider`, `InvoicingProvider`, `StorageProvider`, `TeamChannel`…), y cada acción es una skill con su clase de efecto y su techo de autonomía.
2. **Tres formas de conectar, una sola fila en `integrations`:** `native` (código nuestro), `mcp` (servidor revisado, ADR 0036) y `platform` (nueva: la conexión vive en la plataforma de conectores y la fila guarda su id). El id de la conexión se lee con `forOrganization(orgId)`, nunca de lo que genera el modelo.
3. **El SDK de la plataforma solo se importa en `packages/integrations/src/platform/transports/`**, con un test de frontera como el de los modelos y el de MCP.
4. **Las herramientas que dé la plataforma se fijan como las de MCP:** nombre, descripción y esquema con su huella; si la plataforma las cambia, no se llaman hasta revisarlas.
5. **OAuth con PKCE y `state` atado a la sesión y a la organización**; el canje del código lo hace el servidor, nunca el navegador.
6. **Salud y estado:** una comprobación periódica por conexión; los cinco estados de la auditoría §18.8 (disponible, en curso, necesita tu clave, necesita contrato, no es posible) se ven en la app (OA08) y en la web (N-01).
7. **Profundidad nativa** (auditoría §18.3): WhatsApp (ADR 0052), calendario, pagos y el sistema de reservas del piloto. Los servidores MCP oficiales de cada proveedor, donde existan y pasen la revisión del ADR 0036.
8. **Zapier, Make y n8n** se integran como lo que son, unidades del catálogo: el cliente conecta su propia cuenta y llega a Moodly por webhooks o por la API pública. Sirven de salida para la cola larga, pero no son el hub: lo que hacen no pasa por nuestro motor de políticas.

## Opciones consideradas: plataformas de conectores

Leído el 2026-11-11 en las páginas de cada proveedor y en comparativas de terceros (fuentes al final). **Ningún precio ni condición está contrastado con un contrato**; lo que pone «a verificar» no lo he podido confirmar.

| Opción | Residencia UE y DPA | Autoalojable | Custodia de los tokens OAuth | Precio a escala del piloto | Cobertura de los lotes A y B (M2–M3) | Atadura | Encaje con el worker, DBOS y `forOrganization` |
|---|---|---|---|---|---|---|---|
| **1. Construir sobre nuestra capa** (skills, MCP gobernado, OAuth propio, nativos) | Total: todo en nuestra infraestructura UE; sin subencargado nuevo | Sí | Nosotros, en el `SecretVault` con KMS por organización (ADR 0050) | Solo tiempo de desarrollo: hay que escribir y mantener la autenticación y el refresco de cada proveedor | La que construyamos: unos 30 sistemas en M2–M3, dentro de un plan de unos 235 PRs hasta M3 (auditoría §19.3) | Ninguna | Total |
| **2. Nango autoalojado** (código bajo Elastic License 2.0) **+ acciones nuestras** | Total si lo alojamos nosotros en la UE; Nango no tiene nube UE («We currently don't have an EU cloud»); sin subencargado nuevo | Sí. La versión gratuita cubre autenticación y proxy (la documentación se contradice sobre el proxy, a verificar); sincronizaciones y acciones, de pago | Nosotros, en la base de datos de Nango, cifrados con la clave de la instancia (a verificar), no con la de cada organización | Gratis autoalojado; su nube cobra por conexión y mes (cifra a verificar) | Autenticación ya configurada para cientos de APIs (cifra a verificar), que cubre la mayoría de los SaaS generales de A y B; Holded, SumUp y Brevo, a verificar. Las acciones las escribimos nosotros | Baja: las acciones son nuestras; los tokens están en nuestra base de datos. La licencia prohíbe ofrecerlo como servicio gestionado; usarlo dentro del producto es la lectura habitual (a confirmar con la asesoría) | Bueno: el worker lee el id de la conexión de su fila, pide a Nango el token o la llamada por proxy y sigue con nuestra skill. Un servicio más que operar (contenedor y su Postgres) |
| **3. Composio** | Nube sin región UE encontrada (a verificar); SOC 2 tipo II según el proveedor; DPA nuevo | Solo en el plan Enterprise (VPC o autoalojado) | Composio, en su nube | Por uso (a verificar) | Catálogo amplio pensado para agentes; la mayoría de A y B probable; los españoles, a verificar | Alta: sus definiciones de herramientas y su ejecución | Medio: sus herramientas hay que fijarlas por huella; las llamadas salen de la UE salvo en Enterprise |
| **4. Pipedream Connect** | Sin residencia UE encontrada (un hilo de su comunidad dice que no); Workday firmó su compra el 2025-11-19; DPA nuevo | No | Pipedream | A verificar | Catálogo muy amplio (miles de apps, a verificar) | Alta, y con cambio de dueño | Medio: proxy y acciones por API; datos fuera de la UE |
| **5. Paragon** (ActionKit) | Centros de datos en EE. UU. y Europa; DPA nuevo | Solo en Enterprise (en nuestra nube) | Paragon, o nosotros autoalojado | Por contrato con ventas (a verificar) | Amplia en SaaS generales (a verificar por sistema) | Media-alta | Medio: acciones listas para agentes; contratación con ventas |
| **6. Merge** (API unificada) | Entorno UE en Estocolmo, con cuenta y endpoints aparte; DPA nuevo | No | Merge | Por cuenta conectada, de los más caros según comparativas (a verificar) | Solo categorías: CRM (HubSpot, Pipedrive, Zoho), almacenamiento (Drive, OneDrive), contabilidad (lote C), tickets. Sin calendario, email, pagos, tienda ni mensajería | Media: su modelo unificado | Bajo: pensado para sincronizar y leer; según un competidor guarda copia de los datos (a verificar), más datos personales fuera |
| **7. Activepieces autoalojado** (edición comunitaria MIT) | Total si lo alojamos en la UE | Sí; integrarlo en un producto es de pago según el proveedor | Nosotros, en su base de datos | Gratis autoalojado; integración, de pago (a verificar) | Cientos de «pieces» publicadas como servidores MCP (la cifra varía según la fuente) | Baja-media | Medio: encaja como servidores MCP detrás de `governMcpClient`, pero su aislamiento entre organizaciones dentro de una instancia está por comprobar |
| **8. Zapier, Make o n8n como hub** | Make tiene zonas UE; Zapier, residencia UE solo en planes altos (fuentes contradictorias); n8n autoalojable | n8n sí (con licencia propia para integrarlo) | La cuenta de cada cliente, o la nuestra | Por tareas, a verificar | Muy amplia | Alta | Malo como hub: los flujos se ejecutan fuera de nuestro motor de políticas. Sí como integraciones del catálogo (punto 8 del hub) |

No evaluadas a fondo: otras API unificadas (Unified.to, Apideck, Kombo) y agregadores de herramientas para agentes más nuevos. Se pueden añadir si producto quiere comparar más.

## Decisión recomendada

**El hub de arriba, con Nango autoalojado en la UE como motor de autenticación** (opción 2), y las acciones de cada sistema escritas por nosotros como skills.

- **Por qué:**
  - cumple la UE por defecto (decisión #6) sin un subencargado nuevo ni un DPA que firmar (F10), y sin hablar con ventas: es la opción con menos intervención humana (producto, 2026-11-11);
  - los tokens quedan en nuestra infraestructura y cada llamada sale de nuestro worker, con nuestras reglas;
  - quita la parte más cara de construir cada conector (la autenticación, el refresco y las rarezas de cada proveedor) y deja la parte que tenemos que controlar igualmente (qué hace cada acción);
  - es gratis y se puede abandonar sin reescribir las skills.
- **Si la versión gratuita no incluye el proxy**, el worker pide a Nango el token vigente y llama él a la API del proveedor. Si la licencia o el producto cambian, la salida es la opción 1 con lo ya escrito: solo cambia la autenticación.
- **Lo que hay que cubrir aparte:**
  - los tokens no quedan bajo la clave de cada organización (ADR 0050): al borrar una organización, se borran sus conexiones en Nango y se revocan en cada proveedor;
  - es un servicio más que operar en Railway, con su copia de seguridad.
- **Cuándo cambiaría la recomendación:** si producto prioriza tener más sistemas antes que la residencia y la custodia, lo más rápido es una plataforma alojada con acciones hechas (Composio, Paragon o Pipedream Connect), pagando y con un DPA más. Ninguna de las tres tiene hoy una nube UE comprobada salvo Paragon.

## La pregunta a producto

**¿Adoptamos Nango autoalojado en nuestra infraestructura de la UE como motor de autenticación de las integraciones (gratis, sin DPA nuevo, tokens en casa, y las acciones de cada sistema las escribimos nosotros), o preferís pagar una plataforma alojada con acciones ya hechas (Composio, Paragon o Pipedream Connect), que da más sistemas antes a cambio de tokens y datos fuera de nuestra infraestructura y un DPA más?**

**Respuesta de producto (2026-11-11): Nango autoalojado.** Es reversible: el hub esconde la plataforma detrás de `platform/transports/`, y cambiar de plataforma no toca las skills.

## Consecuencias

- `integrations.kind` admite `platform`, con el id de la conexión externa (migración).
- Un servicio nuevo en Railway (UE) con su base de datos y su copia de seguridad, y su línea en la lista de componentes (no de subencargados, porque es nuestro).
- Cada sistema del catálogo cuesta un PR pequeño (configuración, acciones como skills, la prueba contra su sandbox y su eval si escribe), no un conector entero.
- Los sistemas de reservas de belleza del lote C y el del cliente piloto no los cubre ninguna plataforma: son nativos, por API, por acuerdo de socio o por contrato, y esas conversaciones conviene empezarlas pronto (auditoría §18.3).
- Zapier, Make y n8n necesitan la API pública y los webhooks, que hoy son de después del piloto (`PL-api`): o se adelanta una parte o esas tres unidades se mueven. Lo decide producto cuando llegue el lote A (M2), no ahora.

## Qué la haría «aceptada»

1. Producto contesta la pregunta, o pasa M0 sin contestar y vale el valor por defecto.
2. Un *spike* demuestra, con la opción elegida:
   - una organización conecta Google Calendar por OAuth desde la app y otra no ve ni usa esa conexión;
   - una lectura y un borrador de escritura pasan por `decide()`, con la herramienta fijada por huella;
   - la comprobación de salud marca una conexión revocada y sus skills bajan a `suggest`;
   - con Nango: corre en la UE, los tokens no salen de nuestra infraestructura, y borrar la organización borra sus conexiones.

## Verificación

Pendiente: es lo que pide el punto 2 de «Qué la haría aceptada».

## Fuentes (leídas el 2026-11-11)

- Nango: [precios](https://nango.dev/pricing), [autoalojamiento gratuito](https://nango.dev/docs/guides/platform/free-self-hosting), [autoalojamiento](https://www.nango.dev/docs/guides/platform/self-hosting).
- Merge: [Merge en la UE](https://merge.dev/eu), [preguntas sobre el entorno UE](https://help.merge.dev/articles/6480050-eu-multi-tenant-frequently-asked-questions-faq).
- Composio: [Enterprise](https://composio.dev/enterprise).
- Pipedream: [compra por Workday](https://newsroom.workday.com/2025-11-19-Workday-Signs-Definitive-Agreement-to-Acquire-Pipedream), [residencia de datos en su comunidad](https://pipedream.com/community/t/is-there-a-uk-only-infrastructure-or-data-residency-support-for-pipedream-connect/14080).
- Paragon: [opciones de alojamiento](https://useparagon.com/hosting-options), [on-premise](https://docs.useparagon.com/on-premise).
- Activepieces: [licencia](https://www.activepieces.com/blog/activepieces-open-source-license-what-is-free-2026).
- Make y Zapier: [zonas de datos de Make](https://help.make.com/ai-providers-and-data-zones-in-make), [DPA de marca blanca de Zapier](https://zapier.com/legal/white-label-dpa).
