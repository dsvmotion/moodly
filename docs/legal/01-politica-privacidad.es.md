> **BORRADOR — pendiente de revisión por un abogado; no publicar.**
> Preparado el 2026-11-12 por la sesión V13 · Legal a partir del repositorio. No es asesoramiento jurídico. Los textos entre corchetes son datos que faltan o decisiones abiertas (lista completa en `09-checklist-producto.md`). La versión publicada en `apps/site` (`/privacidad`) no se toca hasta que la revise la asesoría.

# Política de privacidad de Moodly

**Última actualización:** [FECHA DE PUBLICACIÓN]

Esta política explica cómo trata Moodly los datos personales de quienes visitan nuestra web, de quienes nos escriben y de las personas que usan la plataforma Moodly en nombre de una empresa cliente. Está escrita por capas (artículo 11 de la LOPDGDD): primero lo esencial y después el detalle.

## Lo esencial

| | |
|---|---|
| **Responsable** | [RAZÓN SOCIAL], NIF [NIF], domicilio en [DOMICILIO SOCIAL] («Moodly»). |
| **Contacto de privacidad** | [EMAIL DPO/CONTACTO] (mientras tanto, contact@moodly.com). Delegado de protección de datos: [nombre o «no designado»; ver el punto 4 del checklist]. |
| **Para qué** | Atender tus consultas y solicitudes de demo; darte de alta y prestarte el servicio si tu empresa es cliente; facturar; mantener la plataforma segura; avisarte de lo que pasa en tu cuenta. |
| **Base jurídica** | Medidas precontractuales y contrato; interés legítimo (seguridad, contacto profesional B2B); obligación legal (fiscalidad); consentimiento cuando lo pidamos (comunicaciones comerciales). |
| **Con quién** | Proveedores que nos prestan servicios (alojamiento, email, pagos, IA, monitorización de errores) con contrato de encargo. No vendemos datos. |
| **Fuera del EEE** | Algunos proveedores tratan datos fuera del Espacio Económico Europeo, en particular **los proveedores de modelos de IA**, cuyo procesamiento no está limitado a la UE. Lo hacen con garantías del RGPD (Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo). |
| **Tus derechos** | Acceso, rectificación, supresión, oposición, limitación y portabilidad, y reclamar ante la AEPD. |

## 1. Dos papeles distintos: responsable y encargado

Moodly trata datos en dos papeles, y esta política solo cubre el primero:

- **Moodly como responsable del tratamiento:** los datos de quienes visitan la web, nos escriben o piden una demo, y los de las personas usuarias de la plataforma (el equipo de cada empresa cliente: nombre, email, rol, accesos).
- **Moodly como encargado del tratamiento:** cuando los agentes de IA de Moodly atienden a los clientes de una empresa cliente (por chat web, WhatsApp u otros canales), quien decide sobre esos datos es la empresa cliente, que es la responsable. Moodly los trata solo por su cuenta y según sus instrucciones, con el contrato de encargo del tratamiento (DPA) que firmamos con ella. **Si has hablado con el asistente de un negocio que usa Moodly, la política de privacidad que te aplica es la de ese negocio**, y es a él a quien debes dirigir tus solicitudes; si nos llegan a nosotros, se las pasaremos.

## 2. Qué datos tratamos, para qué y con qué base

| Quién | Datos | Finalidad | Base jurídica (RGPD art. 6.1) | Plazo |
|---|---|---|---|---|
| Visitantes de la web | Datos técnicos de la conexión que registran nuestros proveedores de alojamiento (IP, navegador, URL pedida) y la cookie de idioma (ver la política de cookies). La web no usa analítica ni publicidad. | Servir la web y protegerla. | Interés legítimo (f): que la web funcione y sea segura. | Lo que conserven los registros del proveedor de alojamiento [confirmar plazo de Railway]. |
| Quien nos escribe o pide una demo | Los formularios de la web abren tu programa de correo con un mensaje ya escrito; nos llegan los datos que tú envíes: nombre, email de trabajo, empresa, teléfono, mensaje. | Contestarte y, si lo pides, preparar una demo o una propuesta. | Medidas precontractuales a petición tuya (b) e interés legítimo (f) para el contacto profesional (art. 19 LOPDGDD). | Hasta 12 meses desde el último contacto si no llegas a ser cliente [confirmar]. |
| Personas usuarias de la plataforma (equipo del cliente) | Nombre, email, idioma, rol y local o locales a los que tiene acceso; credenciales (la contraseña la gestiona Supabase Auth y no la vemos); segundo factor (MFA); registros de seguridad (inicios de sesión, cambios de permisos), con el email y la IP sustituidos por seudónimos en los logs; las acciones que hace en la plataforma (registro de auditoría); preferencias (tema, idioma, organización activa). | Dar acceso a la plataforma, prestar el servicio y mantener su seguridad y trazabilidad. | Ejecución del contrato con la empresa cliente (b) e interés legítimo (f) de la empresa cliente y de Moodly en dar acceso a su equipo y proteger la cuenta. | Mientras la cuenta esté activa y [X] meses después; los registros de auditoría, [X años; decisión #14: al borrar a una persona se seudonimizan sus campos y se conserva el evento]. |
| Contactos de facturación del cliente | Nombre, email, datos fiscales de la empresa; datos de la tarjeta, que trata directamente Stripe (nosotros no los vemos completos). | Cobrar el servicio, la prueba de 7 días y los créditos; emitir facturas. | Contrato (b) y obligación legal (c): normativa fiscal y mercantil. | Lo que exija la ley: [6 años, art. 30 Código de Comercio; 4 años, normativa tributaria; confirmar]. |
| Personas usuarias: avisos | Email y contenido del aviso (por ejemplo, «tienes una aprobación pendiente»). | Avisarte de lo que necesita tu atención en tu cuenta. | Contrato (b). | [Plazo de registro del proveedor de email; confirmar con Resend]. |
| Errores técnicos | Datos técnicos del error (ruta sin parámetros, navegador, traza). Están configurados para no enviar usuario, IP, cookies, cabeceras ni cuerpos, y los emails se censuran. | Detectar y corregir fallos. | Interés legítimo (f). | [Plazo de retención de Sentry; confirmar]. |
| Comunicaciones comerciales | Email. | Contarte novedades de Moodly. | Consentimiento (a), o interés legítimo si ya eres cliente y es sobre productos similares (art. 21.2 LSSI-CE). Puedes darte de baja en cada envío. | Hasta que te des de baja. **Hoy no enviamos comunicaciones comerciales.** |

No tomamos decisiones basadas únicamente en tratamiento automatizado que produzcan efectos jurídicos sobre ti o te afecten de forma significativa (art. 22 RGPD).

## 3. Inteligencia artificial

- Moodly usa modelos de IA de terceros (a través de Vercel AI Gateway y de los proveedores de modelos que figuran en la lista de subencargados) para que los agentes y el asistente de la plataforma funcionen.
- **Dónde se procesa:** el procesamiento por los modelos **no está limitado a la Unión Europea**: puede hacerse en EE. UU. u otros países donde operen esos proveedores. Los datos de la plataforma se guardan en la UE (ver punto 5). Cada transferencia está cubierta por un contrato de encargo con el proveedor y por una garantía del capítulo V del RGPD.
- **Entrenamiento:** [Redacción pendiente de verificar proveedor a proveedor (`05-registro-subencargados.md`). Solo publicar «los proveedores no usan tus datos para entrenar sus modelos» si los términos de cada proveedor activo lo dicen y está confirmado por la asesoría.]
- Las acciones de los agentes con efecto fuera de la plataforma (enviar, reservar, cobrar) pasan por un motor de políticas, y las sensibles requieren la aprobación de una persona.

## 4. Con quién compartimos los datos

- **Proveedores (encargados del tratamiento)** que necesitamos para prestar el servicio: alojamiento de la base de datos y de la aplicación, ejecución de procesos, email, modelos de IA, conexión con las herramientas del cliente, monitorización de errores y pagos. La lista completa y al día, con la región y la garantía de transferencia de cada uno, está en [URL DE LA LISTA DE SUBENCARGADOS].
- **Stripe** actúa como [responsable independiente / encargado; confirmar con el contrato de Stripe] en el procesamiento de los pagos.
- **Autoridades**, cuando una ley nos obligue.
- **No vendemos** datos personales ni los cedemos con fines publicitarios.

## 5. Dónde están los datos y transferencias internacionales

- **En la UE:** la base de datos de la plataforma (Supabase, región de Frankfurt, Alemania), los procesos de los agentes (Railway, región de Ámsterdam), la aplicación web (Vercel, funciones en Frankfurt) y los eventos de error (Sentry, Frankfurt).
- **Fuera del EEE:** los proveedores de modelos de IA; los metadatos y registros de los emails que enviamos (Resend guarda en EE. UU. los datos de la cuenta aunque envíe desde Irlanda); los datos de cuenta de algunos proveedores estadounidenses (por ejemplo, Sentry y Railway); la red de distribución global de Vercel, y [la web pública, alojada hoy en EE. UU. — ver checklist]. Para cada uno nos apoyamos en la decisión de adecuación del Marco de Privacidad de Datos UE-EE. UU. (Decisión de Ejecución (UE) 2023/1795) si el proveedor está certificado, o en las cláusulas contractuales tipo de la Comisión (Decisión de Ejecución (UE) 2021/914). Puedes pedirnos una copia de las garantías escribiendo a [EMAIL DPO/CONTACTO].

## 6. Cuánto tiempo los conservamos

Los plazos del punto 2. Al acabar, los suprimimos o los anonimizamos, salvo que haya que conservarlos bloqueados para atender responsabilidades legales (art. 32 LOPDGDD) durante su plazo de prescripción. [La purga automática por plazos todavía no está implementada en la plataforma: es condición antes del primer dato real (checklist).]

## 7. Tus derechos

Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, y retirar el consentimiento cuando lo hayas dado, escribiendo a [EMAIL DPO/CONTACTO] con una forma de identificarte. Te contestamos en un mes (ampliable dos más en casos complejos, art. 12.3 RGPD).

Si crees que no hemos atendido bien tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).

## 8. Seguridad

Aislamiento de los datos de cada cliente en la base de datos, cifrado en tránsito y en reposo de nuestros proveedores, MFA para administrar una organización, registro de auditoría y revisión de la configuración de seguridad. Si se produce una violación de seguridad que te afecte, te lo comunicaremos cuando lo exija el artículo 34 del RGPD.

## 9. Menores

La plataforma es para empresas y no está dirigida a menores de 18 años.

## 10. Cambios

Si cambiamos esta política de forma relevante, lo avisaremos en la web y, a las personas usuarias, en la plataforma o por email.

---

### Notas para la asesoría (no forman parte del texto)

1. **Buzón de contacto:** los formularios de la web hacen `mailto:` a contact@moodly.com. Falta saber qué proveedor aloja ese buzón (es otro encargado) y si `moodly.com` ya es nuestro (MANUAL §18.0 #3: el dominio actual es `moodlycrm.com`).
2. **Web pública en EE. UU.:** el servicio `site` de Railway está hoy en una región de EE. UU. (`docs/STATUS.md`). Moverlo a la UE o declararlo como transferencia.
3. **Plazos:** todos los plazos entre corchetes son propuesta; los fiscales y mercantiles los confirma la asesoría.
4. **Entrenamiento:** no publicar la frase sobre entrenamiento hasta cerrar F10. En concreto, las AI Product Terms de Vercel solo comprometen a no entrenar con el contenido del AI Gateway en el plan Enterprise (§8.4.1), y Mistral entrena salvo exclusión (`05-registro-subencargados.md`).
5. **Coherencia:** la página publicada hoy (`apps/site/src/app/[lang]/privacidad/copy.js`) dice «Alojamos los datos en la Unión Europea [por confirmar región y proveedor]» y no menciona el procesamiento global de los modelos; al publicar esta versión se sustituye entera, en los cuatro idiomas.
