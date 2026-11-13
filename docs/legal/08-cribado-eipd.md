> **BORRADOR — pendiente de revisión por un abogado; no publicar.**
> Preparado el 2026-11-12 por la sesión V13 · Legal con el esquema de la skill `privacy-legal-pia-generation` (paso 0: ¿hace falta?; después, riesgos concretos ligados al diseño). No es asesoramiento jurídico. El perfil de práctica de la skill no existe en este entorno: no hay EIPD ni cribados anteriores sobre esta actividad (arranque en frío) y las respuestas de la entrevista salen del repositorio. Fuentes marcadas: `[consolidado]` (referencia estable), `[verificar]` (cita real que conviene comprobar) y `[verificar-cita]` (apartado concreto: comprobar siempre).

# Cribado de EIPD (art. 35 RGPD) para el piloto

## 1. Conclusión

**Hace falta una EIPD completa antes del primer dato real del piloto.** Se cumplen al menos dos de los criterios de las Directrices del CEPD (WP248 rev.01) [verificar] —uso innovador de tecnología (agentes con modelos de lenguaje que actúan) y evaluación o perfilado (memoria que aprende de cada cliente final y cualificación de leads)—, y con dos criterios la EIPD se considera, como regla general, necesaria [consolidado: WP248, apartado III.B.a]. La lista de la AEPD de tratamientos que requieren EIPD (art. 35.4 RGPD) apunta en el mismo sentido [verificar-cita: qué puntos de la lista aplican].

**De quién es la obligación:** del **responsable**, que en el piloto es el centro de estética cliente, no Moodly. Moodly, como encargado, debe ayudarle (art. 28.3.f RGPD) [consolidado]. Recomendación: **Moodly prepara una EIPD «de producto»** que cubra el diseño común (agentes, memoria, modelos fuera de la UE, subencargados) y la entrega al cliente piloto para que la complete con lo suyo (sus finalidades, sus plazos, su canal) y la firme. Es lo que hará con cada cliente después.

**Moodly como responsable** (web, cuentas del equipo de los clientes, facturación): no requiere EIPD; son tratamientos habituales sin criterios de riesgo.

## 2. El tratamiento cribado

| | |
|---|---|
| **Qué** | Los agentes de Moodly (Recepción y Atención al cliente en M1; Comercial, Administración, asistente del dueño y coach después) atienden a los clientes finales de un centro de estética de Madrid, sin tratamientos médicos (MANUAL §18.1 #3), por chat web y WhatsApp, y gestionan sus citas. |
| **Interesados** | Clientes finales del centro (público general, adultos en su mayoría; puede haber menores), y el equipo del centro. |
| **Datos** | Nombre, teléfono (WhatsApp) o email, contenido de las conversaciones, citas (servicio, fecha, profesional), resúmenes de conversación, memorias derivadas (preferencias), solicitudes de conocimiento al equipo. **Datos de salud no previstos pero posibles** (el cliente cuenta una alergia, un embarazo, una medicación). |
| **Operaciones** | Recepción, almacenamiento (Supabase, Frankfurt), envío del texto a modelos de IA (fuera de la UE posible), acciones en la agenda, resúmenes y memoria, avisos al equipo. |
| **Escala del piloto** | Un cliente, un local, cientos o pocos miles de conversaciones [estimación: confirmar]. No es «gran escala» en el piloto; lo será con el producto abierto. |

## 3. Criterios del CEPD (WP248) uno a uno

| Criterio | ¿Se da? | Por qué |
|---|---|---|
| 1. Evaluación o puntuación (incluido perfilado) | **Sí, parcial** | La memoria aprende preferencias de cada cliente final (MANUAL §6.2); el agente comercial cualificará leads. |
| 2. Decisiones automatizadas con efectos jurídicos o similares | No, con condiciones | El agente reserva, mueve o cancela citas que el cliente pide; no deniega servicios. Las acciones sensibles pasan por aprobación (ADR 0047). |
| 3. Observación sistemática | No | No hay vigilancia de espacios ni seguimiento fuera de la conversación. |
| 4. Datos sensibles o muy personales | **Posible** | Datos de salud que el cliente cuente sin que se le pidan; contenido de mensajes privados. |
| 5. Gran escala | No en el piloto | Sí cuando haya muchos clientes: revisar. |
| 6. Combinación de conjuntos de datos | **Parcial** | Memoria «cruzada entre agentes y locales» (MANUAL §6.2, §6.4): datos de canales distintos sobre la misma persona. |
| 7. Interesados vulnerables | No en principio | Posibles menores. |
| 8. Uso innovador o nueva tecnología | **Sí** | Agentes con modelos de lenguaje que actúan en sistemas del negocio. |
| 9. Impide ejercer un derecho o usar un servicio | No | Siempre hay paso a una persona. |

**Además (no es criterio del WP248, pero pesa en la evaluación):** transferencias internacionales a los proveedores de modelos, sin inferencia fijada en la UE (decisión de producto del 2026-11-12).

## 4. Riesgos concretos (para la EIPD completa)

| # | Riesgo, ligado al diseño | Prob. | Impacto | Medida | Estado |
|---|---|---|---|---|---|
| 1 | **Transferencia del contenido de las conversaciones a proveedores de modelos fuera del EEE** a través de Vercel AI Gateway, que añade un subencargado intermedio; la región concreta de cada llamada hoy no se registra (ADR 0051) | Alta (es el diseño) | Media | DPA y garantía del cap. V con Vercel y con cada proveedor de modelos; evaluación de impacto de la transferencia (TIA); retención cero donde exista; registrar proveedor y región de cada llamada (ADR 0051, punto 6); enmascarar datos personales innecesarios antes del modelo (T5) | Brecha: DPAs sin firmar (F10); TIA sin hacer; registro por llamada sin hacer; **el compromiso de Vercel de no entrenar con el contenido del gateway solo figura para Enterprise** (AI Product Terms §8.4.1) y ZDR no está activado |
| 2 | **Datos de salud volcados por el cliente final** (alergias, embarazo) acaban en el historial, los resúmenes y la memoria, que se envían a los modelos y se reutilizan | Media | Alta (art. 9) | Regla de plataforma: no pedir ni guardar datos de salud; no extraer memorias de categorías especiales; aviso en la nota de transparencia; plantilla del centro sin preguntas de salud | Brecha: no hay regla ni eval para esto |
| 3 | **La memoria guarda inferencias sobre clientes finales** (preferencias, hábitos) y las reutiliza entre agentes y locales sin que el cliente final lo sepa | Media | Media | Informar en la nota (base y plazo); memorias revisables por el equipo (MANUAL §6.2); minimización; borrado en cascada al suprimir un contacto (MANUAL §11) | Parcial: diseño propuesto, sin implementar |
| 4 | **Sin purga por plazos:** las conversaciones y memorias se conservan indefinidamente (no hay retención configurable ni purga implementadas: ninguna migración las crea) | Alta | Media | Retención configurable por organización con purga automática (MANUAL §11) antes del primer dato real | Brecha |
| 5 | **Inyección de instrucciones por el cliente final** para que el agente revele datos de otro cliente o actúe por otro | Media | Alta | Mensajes marcados como datos no confiables; el agente solo actúa para quien le habla (reglas de plataforma); tenant y destinatarios fijados por el runtime; RLS; evals del set de ataque al 100 % | Hecho en lo básico (reglas y evals con modelo falso); falta la corrida con modelo real (crédito del AI Gateway, `docs/STATUS.md`) |

## 5. Derechos de los interesados (estado)

| Derecho | ¿Se puede hoy? | Cómo / falta |
|---|---|---|
| Acceso y portabilidad | No con herramienta | Exportación por contacto (MANUAL §11): falta |
| Supresión | No con herramienta | Borrado físico en cascada (conversaciones, chunks, memorias): falta |
| Rectificación | Parcial | El equipo edita el contacto en la plataforma [verificar] |
| Oposición / no hablar con la IA | Sí | Paso a una persona en cualquier momento |

## 6. Recomendación

**Hacer la EIPD completa** (con la skill `privacy-legal-pia-generation`, sección por sección, y la herramienta de la AEPD «Gestiona EIPD» como referencia [verificar]) **antes del primer dato real**, con estas condiciones de salida:

- [ ] DPAs firmados con Vercel (AI Gateway incluido) y con cada proveedor de modelos activo, y TIA de esas transferencias (F10) — producto + asesoría.
- [ ] Regla y eval de «sin datos de salud» y sin memorias de categorías especiales — V1.
- [ ] Retención configurable y purga automática; exportación y borrado por contacto — V1.
- [ ] Registro de proveedor y región por llamada (ADR 0051, punto 6) — V1.
- [ ] Nota de transparencia publicada por el centro (`07-nota-transparencia-ia.es.md`) — cliente piloto.
- [ ] Evals del set de ataque con el modelo real al 100 % — V4.
- [ ] Revisión de la EIPD por la asesoría y firma del responsable (cliente piloto).

Si tras las medidas el riesgo residual siguiera alto, el responsable tendría que consultar a la AEPD (art. 36 RGPD) [consolidado]. Con las medidas de arriba no lo prevemos.
