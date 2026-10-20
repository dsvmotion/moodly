# 0019 — Enrutador de IA multi-proveedor y multi-región; residencia como política por tenant; BYOK/BYOC; secretos con KMS

- **Estado:** aceptado
- **Fecha:** 2026-10-14
- **Secciones del MANUAL afectadas:** §3.2 (Proveedores LLM [ABIERTO] → cerrado), §5 (runtime/enrutado), §10.4 (secretos), §11 (residencia/DPA), §15 (consumo)
- **Sustituye el estado [ABIERTO]** de "Proveedores LLM" en MANUAL §3.2 y recoge lo propuesto en `docs/design/arquitectura-agentes-enterprise.md` §2.3.

## Contexto

La política de residencia no se cumple eligiendo "qué modelo", sino "qué modelo, por qué vía,
en qué región": un mismo modelo se sirve por API directa, AWS Bedrock, Google Vertex, Azure
OpenAI o Mistral nativo, cada vía con distinta residencia, DPA, latencia y coste (ver
`docs/audits/2026-10-14-auditoria-flujos-infra.md` §1). Había seis decisiones abiertas acopladas
(regiones, enrutador, bóveda de secretos, embeddings, DPA) que bloquean el bloque de flujos de
infra. Producto las resolvió el 2026-10-14 pidiendo **máxima disponibilidad y el camino más
seguro y escalable**.

## Decisión

1. **Todas las regiones, no solo UE.** El gateway sirve modelos por todas las regiones
   disponibles para maximizar disponibilidad, calidad y coste. La **residencia es una política
   por organización/sede** ("sin restricción" por defecto; "solo UE", "solo EE. UU.", etc. como
   opción). Cuando un tenant fija una residencia, el enrutador **y su cadena de fallback no
   cruzan** esa frontera; si no hay modelo que cumpla con la calidad mínima, **paso a humano**,
   nunca cruzar región en silencio.
2. **Enrutador:** capa propia delgada sobre **Vercel AI SDK** (abstracción de proveedor,
   tool-calling, streaming) apoyada en los **gateways nativos de nube** (Bedrock, Vertex, Azure
   OpenAI) para servir en-región. Se evalúa un **AI Gateway gestionado o LiteLLM autoalojado**
   para unificar claves, facturación y *fallback*; la elección final queda para medición en
   piloto, pero la interfaz interna del enrutador es estable desde ya.
3. **Tres modos de conexión por proveedor:** claves de **Moodly** (gestionado) · **BYOK**
   (claves del cliente en bóveda cifrada) · **BYOC** (nube del cliente: Bedrock/Vertex/Azure en
   su cuenta y su región).
4. **Secretos con KMS (envelope encryption), clave por tenant**, nunca legibles desde el
   navegador. Supabase Vault se descarta como bóveda principal por control criptográfico.
5. **Embeddings:** proveedor con despliegue multi-región que respete la política de residencia
   del tenant (candidato por defecto: embeddings a través del mismo gateway de nube en la región
   del tenant). Se confirma proveedor y coste en piloto; cambiar de proveedor obliga a reindexar.
6. **DPA y subprocesadores:** plantilla de DPA + **lista pública de subencargados generada
   automáticamente** según proveedores, vías y regiones activos por tenant; se registra la
   aceptación del DPA.

## Alternativas consideradas

- **Solo-UE global** — descartada por producto: limita disponibilidad, calidad y coste.
- **Enrutador propio mínimo (2 proveedores)** — insuficiente para multi-región + BYOC +
  *fallback* seguro a escala; se mantiene como punto de partida interno, no como meta.
- **Supabase Vault como bóveda principal** — menos control que KMS con clave por cliente.
- **API directa (Anthropic/OpenAI US) como única vía del piloto** — más simple y barata, pero
  sin residencia configurable; descartada como *única* vía, admitida como una vía más.

## Consecuencias

- La pantalla **Modelos** crece a **Proveedores · vías · residencia · topes** (flujos A1/A2/A4).
- Cada llamada al modelo registra **proveedor, región, vía, tokens, coste y latencia** en
  `agent_runs` / `usage_records`; de ahí salen facturación por uso y márgenes.
- Nuevas entidades de backend: `model_providers`, `provider_connections` (modo + región + vía),
  `org_model_settings` (residencia, fallback, topes), `integration_secrets` (KMS).
- Hay que firmar **DPA con cada proveedor/región** que se use; la lista de subencargados es
  **dinámica** por tenant.
- Mayor complejidad operativa (multi-región, multi-cuenta); se mitiga con infra como
  contenedores y configuración por variables (`arquitectura-agentes-enterprise.md` §6).
- **Cambio de mensaje:** "solo UE" deja de ser la esencia del producto y pasa a ser una
  **garantía opcional por plan**. Hay que actualizar el relato donde hoy dice "UE-first/solo UE"
  (`models-catalog.js`, landing `/modelos`, `edge-y-postura-enterprise.md`).

## Verificación

- Prototipos **A1 (vías por proveedor)**, **A2 (BYOK)** y **A4 (residencia y fallback)** en
  `apps/site/plataforma` (este cambio), revisados en navegador.
- En backend: medición real de residencia, latencia y coste por vía en el piloto antes de
  fijar el AI Gateway y el proveedor de embeddings.
