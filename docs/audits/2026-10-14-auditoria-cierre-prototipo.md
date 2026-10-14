# Auditoría de cierre del prototipo — flujos de infra, agentes y mensaje

Fecha: 2026-10-14 · Autor: diseño (Claude) · Estado: revisión en profundidad del trabajo de
hoy antes de pasar a backend.

Audita en profundidad lo construido hoy sobre la base de la
[auditoría de flujos](2026-10-14-auditoria-flujos-infra.md) y los ADR
[0019](../adr/0019-enrutador-ia-multiregion-byok-kms.md)/[0020](../adr/0020-whatsapp-cloud-api-directo.md):
coherencia del mensaje (multi-región), gobierno de agentes (B1–B4) e infra de proveedores
(A1–A4, A6, A9). Da un veredicto de preparación diseño → backend.

---

## 1. Inventario consolidado de flujos del prototipo

18 recorridos construidos (⚡ = con llamada de prueba/estado real verificado en navegador):

| Área | Ruta | Estado |
|---|---|---|
| Invitación | `/plataforma/aceptar` | ✅ |
| Canal WhatsApp + plantillas | `/plataforma/conectar` ⚡ | ✅ |
| Voz (persona/clonación) | `/plataforma/voz` | ✅ |
| Detalle de aprobación | `/plataforma/revisar` | ✅ |
| Checkout Stripe | `/plataforma/checkout` | ✅ |
| Tomar el control | `/plataforma/tomar` | ✅ |
| Publicar versión | `/plataforma/publicar` ⚡ | ✅ |
| Ingesta de conocimiento | `/plataforma/ingesta` ⚡ | ✅ |
| Export/borrado RGPD | `/plataforma/privacidad` | ✅ |
| **A1** Proveedores y vías | `/plataforma/proveedores` ⚡ | ✅ |
| **A2** BYOK | `/plataforma/byok` ⚡ | ✅ |
| **A3** Nube propia (BYOC) | `/plataforma/nube` ⚡ | ✅ |
| **A4** Residencia y fallback | `/plataforma/residencia` ⚡ | ✅ |
| **A6** Topes y circuit breaker | `/plataforma/topes` ⚡ | ✅ |
| **A9** DPA y subprocesadores | `/plataforma/subprocesadores` ⚡ | ✅ |
| **B1** Nuevo agente | `/plataforma/agente-nuevo` | ✅ |
| **B2+B3** Probar y activar | `/plataforma/probar` ⚡ | ✅ |
| **B4** Techo de autonomía | `/plataforma/autonomia` ⚡ | ✅ |

---

## 2. Calidad y consistencia

**Bien:**
- Patrón compartido estable: `Sidebar` + estilos inline (`box/muted/btnDark/btnLight`), estados
  reales (carga con spinner, error + reintento, éxito), confirmación 🔒 para lo sensible, y
  `prefers-reduced-motion` respetado en todas las animaciones.
- Las acciones destructivas o de riesgo siempre tienen fricción: modal (publicar, activar,
  aprobar, tomar control, DPA), confirmación escrita (borrado RGPD) o aviso inline (acción
  sensible en automático).
- Coherencia de dominio multi-región: Proveedores → Residencia → Topes → Subprocesadores usan
  el mismo vocabulario de vía/región/fallback, alineado con ADR 0019.

**A vigilar (no bloquea, se resuelve al portar a `apps/web`):**
- **Estado no compartido entre pantallas.** Cada pantalla tiene su copia de los datos demo;
  Proveedores, Residencia y Subprocesadores no comparten la política de residencia. En
  `apps/web` es una sola fuente: `org_model_settings` + `provider_connections`.
- **A2 y A3 se solapan.** `/byok?byoc=1` y `/nube` cubren la nube del cliente por dos caminos;
  en backend es una única entidad `provider_connections(modo='byoc')`. Decisión: `/nube` es la
  versión detallada (elegir modelos a exponer); `/byok` queda para claves. Unificar al portar.
- **Constantes duplicadas** (`box/muted/btn…`) en cada archivo: aceptable en el prototipo;
  en `apps/web` son componentes de `packages/ui`.

---

## 3. Hueco real de navegación (accionable antes de cerrar el prototipo)

Las 18 pantallas existen pero **varias no están enlazadas** desde su pantalla madre ni desde el
menú; hoy se llega por URL. Para que el prototipo valga como especificación *navegable*:

| Falta enlazar | Desde |
|---|---|
| Proveedores, Residencia, Topes, Subprocesadores | pestañas de **Configuración → Modelos** (ya diseñé el `SubNav`, falta aplicarlo a la pantalla Modelos existente) |
| BYOK, Nube | desde las tarjetas de **Proveedores** (ya enlazado A1→A2/A3 ✓) |
| Nuevo agente, Probar, Techo de autonomía | desde **Mis agentes** (`/agente`) y desde **Reglas** |
| Conectar, Ingesta, Voz, etc. | desde sus pantallas madre (Integraciones, Conocimiento, Agente) |

**Recomendación:** un PR pequeño de "cableado de navegación" que añada los enlaces/pestañas y,
donde aporte, una entrada en el menú. Es barato y deja el prototipo recorrible de principio a fin.

---

## 4. Coherencia con las decisiones

- **ADR 0019 (multi-región, residencia por tenant, BYOK/BYOC, KMS):** reflejado en A1–A4/A6/A9 y
  en el mensaje (catálogo, landing, postura). ✅
- **ADR 0020 (WhatsApp Cloud API directo):** `/conectar` lo asume. ✅
- **Mensaje:** "solo UE" ya es garantía opcional por plan, no la esencia. Pendiente verificar que
  no quede ningún "UE-first" suelto fuera de lo tocado (buscar en toda la web antes del lanzamiento).

---

## 5. Lo que queda para cerrar diseño (no bloquea el piloto)

Del inventario de `2026-10-14-auditoria-flujos-infra.md`, siguen sin pantalla:

- **Usuarios (C):** MFA, SSO SAML/OIDC, SCIM, **API keys**, offboarding → fase enterprise.
- **Integraciones (D):** salud/reconexión, revocar, añadir servidor MCP, sandbox.
- **Datos (E):** visor de auditoría (filtrar/exportar), residencia visible por conversación, retención.
- **Infra (A):** A7 embeddings (proveedor/región), A10 enmascarado de PII, A8 infra de voz (workers UE).
- **Facturación (F):** portal Stripe, cambio de plan con aprobación.

Prioridad para piloto: salud de integraciones (D3) y visor de auditoría (E2). El resto es fase 2–3.

---

## 6. Riesgos

- **Reconstrucción `apps/web`.** El prototipo es la especificación (ES/claro); `apps/web` sale
  es+en y claro+oscuro sobre `packages/ui`. El riesgo es divergencia visual; se mitiga con el
  `mapa-pantallas-datos.md` como contrato y portando pantalla a pantalla.
- **Complejidad multi-región real.** Más proveedores/cuentas/regiones = más superficie de fallo y
  más DPAs. Se mitiga con el circuit breaker (A6), la lista dinámica (A9) y medición por vía en el
  piloto antes de fijar el AI Gateway.
- **Secretos (KMS).** Es zona sensible: su implementación requiere revisión humana (CLAUDE.md).

---

## 7. Veredicto

**El diseño está suficientemente cerrado para arrancar backend.** Los 18 flujos cubren los
recorridos críticos del piloto (alta, operación, gobierno de agentes, infra de modelos,
cumplimiento) y las 6 decisiones de infra están cerradas en ADR. Lo que falta es enterprise o
fase 2–3 y no bloquea el primer tenant.

**Siguiente paso recomendado:**
1. PR pequeño de **cableado de navegación** (§3) para dejar el prototipo recorrible.
2. **Backend Paso 1:** esquema + RLS del primer tenant siguiendo `mapa-pantallas-datos.md`
   (entidades `organizations`/`agents`/`model_providers`/`provider_connections`/`org_model_settings`),
   con su test pgTAP de aislamiento. Zonas sensibles (KMS, RLS, políticas) → revisión humana.
