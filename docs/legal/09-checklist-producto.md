> **BORRADOR — pendiente de revisión por un abogado; no publicar.**
> Preparado el 2026-11-12 por la sesión V13 · Legal. Para Diego (producto). Qué tiene que decidir o firmar la asesoría, y qué sigue abierto. Tareas de producto F06 y F10 (`docs/scope.yaml`).

# Checklist legal para producto

## 1. Antes de poder publicar cualquier texto (F06)

| # | Qué | Quién | Bloquea |
|---|---|---|---|
| 1 | **Constituir la sociedad** y rellenar [RAZÓN SOCIAL], [NIF], [DOMICILIO SOCIAL] y los datos registrales en todos los textos. | Diego + gestoría | Todo |
| 2 | **Contratar la asesoría** y darle esta carpeta (`docs/legal/`). | Diego | Todo |
| 3 | **Email de privacidad** ([EMAIL DPO/CONTACTO]): decidir si es contact@moodly.com u otro (p. ej. privacy@…), y confirmar que `moodly.com` es nuestro y qué proveedor aloja el buzón (es un encargado más). | Diego | Política de privacidad, aviso legal |
| 4 | **¿DPD (delegado de protección de datos)?** Hoy no parece obligatorio (art. 37 RGPD y art. 34 LOPDGDD: Moodly no hace perfiles a gran escala ni seguimiento sistemático a gran escala [verificar]). Revisar al crecer. La asesoría decide; si no se designa, dejarlo por escrito. | Asesoría | Política, RAT |
| 5 | **Marca «Moodly»:** comprobación legal en la OEPM/EUIPO (MANUAL §18.1 #1). | Asesoría | Aviso legal, lanzamiento |
| 6 | **Plazos de conservación:** confirmar los propuestos (contactos 12 meses; cuentas; auditoría; fiscales 4/6 años; conversaciones de clientes finales por defecto 12 meses). | Asesoría + Diego | Política, DPA, RAT |
| 7 | **Condiciones del servicio:** importes ([IMPORTE]), caducidad y reembolso de créditos, si la voz y el coste de WhatsApp van aparte, límite de responsabilidad, preavisos, fuero; y si un autónomo puede darse de alta (¿consumidor?). | Diego + asesoría | Condiciones |
| 8 | **Créditos:** que el prepago no sea dinero electrónico y el IVA de los paquetes. | Asesoría fiscal | Condiciones |
| 9 | **Texto de descargo del coach** (MANUAL §18.1 #19). | Asesoría | Coach |

## 2. Proveedores y DPAs (F10)

| # | Qué | Estado | Nota |
|---|---|---|---|
| 10 | **Firmar o aceptar el DPA** de cada proveedor activo: Supabase, Vercel (incluye AI Gateway), Railway, Resend, Sentry, GitHub. | Abierto | Fuentes y forma de aceptación en `05-registro-subencargados.md`. Muchos son «click-through» en el panel: hay que hacerlo con la cuenta de la sociedad, no la personal. |
| 10b | 🔴 **AI Gateway y entrenamiento:** las AI Product Terms de Vercel (§8.4.1) solo comprometen a no usar el contenido del gateway para entrenar o mejorar sus productos de IA **en el plan Enterprise**. Antes del primer dato real: plan Enterprise o confirmación por escrito de Vercel, y activar «Disallow Prompt Training» y retención cero (ZDR). | Abierto | Fuente y detalle en `05`, sección 1 |
| 11 | **Proveedores de modelos detrás del AI Gateway:** confirmar con Vercel qué términos aplican (¿Vercel es encargado y los proveedores sus subencargados, o hay que aceptar los de cada proveedor?), retención y no entrenamiento de cada uno. | Abierto | Es la pieza que más importa: el texto de la conversación sale del EEE. |
| 12 | **Evaluación de impacto de las transferencias (TIA)** a EE. UU. para los proveedores de modelos que no estén en el DPF. | Abierto | La hace la asesoría con nuestra ayuda. |
| 13 | **Decisión del 2026-11-12 (inferencia no fijada en la UE):** reflejarla en MANUAL §18.0 #6 y §18.1 #5, `docs/STATUS.md` (condición de salida 9) y el ADR 0051, que todavía dicen «la UE por defecto». | Abierto | Lo hace V1; este PR no toca esos archivos. |
| 14 | **Web pública en EE. UU.:** el servicio `site` de Railway está en una región de EE. UU. Moverlo a la UE (más simple) o declararlo. | Abierto | `docs/STATUS.md` |
| 15 | **Socio de Instagram/Messenger** (ManyChat o similar, ADR 0052): elegir, revisar su DPA y su estatus ante Meta. | Abierto | Stretch de M4 |
| 16 | **Nango y la licencia Elastic License 2.0:** confirmar que usarlo autoalojado dentro de Moodly no es «ofrecerlo como servicio gestionado» (lo que la licencia prohíbe), y qué incluye la versión gratuita. | Abierto | ADR 0053. Autoalojado, Nango no es subencargado: es software nuestro en Railway. |
| 17 | **Meta (WhatsApp Cloud API):** cuenta Meta Business verificada (F05) y aceptar sus condiciones de tratamiento de datos. | Abierto | Bloqueado en `docs/STATUS.md` |
| 18 | **Stripe** (cuando se cree la cuenta): confirmar su papel (responsable independiente o encargado) para los pagos. | Abierto | |
| 19 | **ElevenLabs** (voz, después de WhatsApp): DPA, retención cero y región antes de la primera llamada real. | Abierto | |
| 20 | **AWS** (KMS en `eu-central-1`, ADR 0034): DPA de AWS (se acepta en la cuenta). Si se usa Bedrock (ADR 0051), también. | Abierto | KMS solo ve claves, no contenido |
| 21 | **Langfuse u otra herramienta de trazas de LLM** (MANUAL §12.2): no activar sin DPA y sin incluirla en la lista; vería el contenido de las conversaciones. | Aviso | |

## 3. Antes del primer dato real de un cliente

| # | Qué | Quién |
|---|---|---|
| 22 | **EIPD completa** del piloto, firmada por el cliente piloto (ver `08-cribado-eipd.md`). | Asesoría + V1 + cliente |
| 23 | **Retención y purga automáticas**, exportación y borrado por contacto: hoy no existen en el código. El DPA y la política dicen que existen «en desarrollo»; no publicarlos como hechos. | V1 |
| 24 | **Regla «sin datos de salud»** en los agentes y en la memoria, con eval. | V1 / V4 |
| 25 | **Nota de transparencia** publicada por el cliente piloto en su web y en el primer mensaje del agente. | Cliente + V1 |
| 26 | **DPA firmado** con el cliente piloto. | Diego |
| 27 | **Lista pública de subencargados** en la web (`/subencargados` o similar) y enlace desde privacidad y DPA. La web enlaza hoy «Lista de subencargados» a `/contacto`. | V3 tras la revisión |

## 4. Afirmaciones de la web que revisar (no se cambian en este PR)

Revisadas con el criterio de la skill `product-legal-marketing-claims-review` (cada afirmación necesita prueba):

| Página | Afirmación | Problema | Propuesta |
|---|---|---|---|
| `/seguridad` | «Tus datos no entrenan modelos de IA» | Sin verificar proveedor a proveedor (F10) | Mantener «[confirmar]» hasta cerrar F10 |
| `/seguridad` | «La región de los modelos de IA, [por confirmar]» | Producto ya decidió: global | Cambiar a «los modelos pueden procesar fuera de la UE, con garantías del RGPD» |
| `/seguridad` | «Los datos sensibles se enmascaran antes de enviarse al modelo» | T5 aceptado para el plan, no implementado | Quitar o pasar a «en la hoja de ruta» |
| `/seguridad` | «AES-256 en reposo y TLS 1.2+ … de nuestros proveedores» | Es lo que dicen los proveedores; conviene citar | Enlazar la fuente o decir «según nuestros proveedores» |
| `/seguridad` | «Bóveda por organización» | ADR 0050 en curso | «En desarrollo» hasta que esté |
| `/seguridad` | «Exporta todos tus datos o elimina la cuenta cuando quieras» | No hay exportación ni borrado implementados | «En desarrollo» |
| `/seguridad` | «Nube dedicada», «Tu propia nube», «En tus servidores» | No existen hoy | Marcar «bajo pedido / en estudio» |
| `/privacidad`, `/cookies`, `/aviso-legal`, `/terminos` | Borradores con corchetes ya publicados | Se publican textos incompletos | Sustituir por estos tras la revisión, o quitar del menú hasta entonces |
| `/cookies` | Habla de analítica con consentimiento y de un aviso de cookies | No existen | Sustituir por `03-politica-cookies.es.md` |

## 5. Lo que hace V1 con esto

- Marcar en `docs/scope.yaml` F06 como «borradores listos para la asesoría» y F10 con la lista de la sección 2 (este PR no toca ese archivo).
- Reflejar la decisión del 2026-11-12 (punto 13).
- Convertir los puntos 23, 24 y 27 en unidades con su hito.
