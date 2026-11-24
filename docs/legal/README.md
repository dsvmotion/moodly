> **BORRADOR — pendiente de revisión por un abogado; no publicar.**

# Textos legales de Moodly (borradores para la asesoría)

Preparados el 2026-11-12 por la sesión V13 · Legal para las tareas de producto **F06** (entidad y asesoría: DPA, privacidad, condiciones) y **F10** (DPAs con cada proveedor). **Son borradores para que los revise un abogado: no sustituyen a la asesoría ni se publican tal cual.** Las páginas publicadas de `apps/site` (`/privacidad`, `/terminos`, `/aviso-legal`, `/cookies`) no se tocan hasta esa revisión.

## Documentos

| # | Documento | Español | Inglés | Para quién |
|---|---|---|---|---|
| 1 | Política de privacidad (Moodly responsable: web, contactos, usuarios) | [01-politica-privacidad.es.md](01-politica-privacidad.es.md) | [01-privacy-policy.en.md](01-privacy-policy.en.md) | Público |
| 2 | Condiciones del servicio (B2B; prueba de 7 días, créditos, enterprise) | [02-condiciones-servicio.es.md](02-condiciones-servicio.es.md) | [02-terms-of-service.en.md](02-terms-of-service.en.md) | Clientes |
| 3a | Aviso legal (LSSI-CE) | [03-aviso-legal.es.md](03-aviso-legal.es.md) | [03-legal-notice.en.md](03-legal-notice.en.md) | Público |
| 3b | Política de cookies (lo que de verdad ponen la web y la app) | [03-politica-cookies.es.md](03-politica-cookies.es.md) | [03-cookie-policy.en.md](03-cookie-policy.en.md) | Público |
| 4 | Contrato de encargo del tratamiento (DPA, art. 28 RGPD) | [04-contrato-encargo-tratamiento.es.md](04-contrato-encargo-tratamiento.es.md) | [04-data-processing-agreement.en.md](04-data-processing-agreement.en.md) | Clientes |
| 5 | Registro de subencargados (con fuentes consultadas el 2026-11-12) | [05-registro-subencargados.md](05-registro-subencargados.md) | — (la sección 3 es el anexo para clientes) | Interno / anexo del DPA |
| 6 | Registro de actividades de tratamiento (art. 30: responsable y encargado) | [06-registro-actividades-tratamiento.md](06-registro-actividades-tratamiento.md) | — | Interno |
| 7a | Nota de transparencia de IA para clientes finales (plantilla) | [07-nota-transparencia-ia.es.md](07-nota-transparencia-ia.es.md) | [07-ai-transparency-note.en.md](07-ai-transparency-note.en.md) | Clientes de nuestros clientes |
| 7b | Reglamento de IA: rol y nivel de riesgo de los agentes | [07-evaluacion-ai-act.md](07-evaluacion-ai-act.md) | — | Interno |
| 8 | Cribado de EIPD del piloto | [08-cribado-eipd.md](08-cribado-eipd.md) | — | Interno / cliente piloto |
| 9 | Checklist para producto: qué decide o firma la asesoría y qué sigue abierto | [09-checklist-producto.md](09-checklist-producto.md) | — | Diego |

## Lo más importante (resumen para leer primero)

1. **Hace falta una EIPD completa antes del primer dato real** (`08`): la obligación es del cliente piloto, pero Moodly le prepara la EIPD de producto.
2. **La inferencia no está fijada en la UE** (decisión de producto del 2026-11-12) y todos los textos lo dicen así. Ningún texto promete «inferencia en la UE».
3. 🔴 **Vercel AI Gateway:** su compromiso de no entrenar con el contenido solo figura para el plan Enterprise; hay que resolverlo (plan o confirmación escrita, y activar retención cero) antes del primer dato real (`05`, `09` punto 10b).
4. **Varios proveedores de EE. UU. guardan parte de los datos en EE. UU.** aunque usemos su región UE (Resend, Sentry, Railway): los textos no dicen «todo en la UE».
5. **Lo que no existe no se promete:** retención y purga, exportación y borrado por contacto, enmascarado de datos y certificaciones aparecen como «en desarrollo» o «no implantado». La página `/seguridad` publicada hoy promete algunas de esas cosas (`09`, sección 4).
6. Los agentes son de **riesgo limitado** (art. 50 del Reglamento de IA) mientras el coach y el asistente no evalúen a trabajadores (`07-evaluacion-ai-act.md`).

## Datos que faltan (marcadores)

`[RAZÓN SOCIAL]`, `[NIF]`, `[DOMICILIO SOCIAL]`, `[EMAIL DPO/CONTACTO]` (hoy se usa contact@moodly.com, ver `SECURITY.md`), `[IMPORTE]` y las fechas de publicación. El resto de corchetes son decisiones abiertas, recogidas en `09`.

## Cómo se hicieron

- **Fuentes del repositorio:** `docs/MANUAL.md` (§1, §5, §6, §10, §11, §15, §18), `docs/STATUS.md`, `docs/scope.yaml` (F06, F10), ADR 0020, 0032, 0046, 0047, 0049–0053, `SECURITY.md`, el código de cookies y almacenamiento de `apps/web` y `apps/site`, y las páginas legales actuales de `apps/site`.
- **Fuentes externas:** las páginas públicas de cada proveedor, consultadas el 2026-11-12 (URL en cada fila de `05`), y la lista del DPF.
- **Skills de este entorno:** `privacy-legal-pia-generation` (cribado de EIPD), `privacy-legal-dpa-review` (revisión del DPA del lado encargado), `ai-governance-legal-ai-inventory` (inventario y clasificación del Reglamento de IA) y, como criterio, el de `product-legal-marketing-claims-review` para las afirmaciones de la web. Los perfiles de práctica de esas skills no existen en el entorno (`~/.claude/plugins/config/claude-for-legal/`): la entrevista inicial se contestó con el repositorio y las suposiciones están escritas en cada documento.
- **Citas legales:** las que van marcadas `[verificar]` salen del conocimiento del modelo y hay que contrastarlas con la fuente oficial; las marcadas `[consolidado]` son referencias estables.

## Mantenimiento

Cambia cuando cambie lo que describe: un proveedor nuevo (`05`, `06`, anexo III del DPA y aviso con 30 días a los clientes), una cookie nueva (`03`), un agente o un canal nuevo (`06`, `07`, `08`). Las versiones publicadas viven en `apps/site`; esta carpeta es la fuente que revisa la asesoría.
