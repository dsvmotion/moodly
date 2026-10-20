// Estados de cada pantalla del prototipo: cargando, vacío, error y sin permiso.
// Se ven con ?estado=cargando|vacio|error|sin-permiso (o desde «Ver estados de
// pantalla» en el menú de usuario). Lo que es común a todas vive en screen-states.jsx;
// aquí va lo propio de cada una:
//   name   título de la pantalla
//   kind   forma del esqueleto mientras carga: panel | lista | tabla | tarjetas |
//          formulario | chat | calendario | tablero | movil
//   empty  [título, texto, [botón, ruta]] del estado vacío, o null si la pantalla es
//          un paso de un flujo y no puede estar vacía
//   role   quién puede verla (lo que se muestra en «sin permiso")
// TODO(backend): cada estado sale de la consulta real (loading/error de la petición,
// lista vacía, 403 de RLS) — ver docs/design/mapa-pantallas-datos.md.

const OWNER = "Dueño o Administración";
const OPS = "Dueño, Administración o Recepción";
const ALL = "cualquier persona del equipo";

export const SCREENS = {
  "/plataforma": { name: "Inicio", kind: "panel", role: ALL, empty: ["Tus agentes aún no han empezado", "Cuando conectes un canal y actives un agente, aquí verás lo que hacen cada día: conversaciones, citas y lo que espera tu aprobación.", ["Conectar un canal", "/plataforma/conectar"]] },
  "/plataforma/conversaciones": { name: "Conversaciones", kind: "lista", role: OPS, empty: ["Todavía no hay conversaciones", "Cuando un cliente escriba por WhatsApp, Instagram, email o la web, la conversación aparecerá aquí con lo que hizo el agente.", ["Conectar un canal", "/plataforma/conectar"]] },
  "/plataforma/tomar": { name: "Tomar el control", kind: "chat", role: OPS, empty: null },
  "/plataforma/aprobaciones": { name: "Aprobaciones", kind: "lista", role: OWNER, empty: ["Nada pendiente de aprobar", "Cuando un agente quiera hacer algo que tus reglas reservan para ti (enviar una factura, mover citas en bloque), te lo pedirá aquí.", ["Ver las reglas", "/plataforma/reglas"]] },
  "/plataforma/revisar": { name: "Revisar una aprobación", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/agenda": { name: "Agenda", kind: "calendario", role: OPS, empty: ["La agenda de esta semana está vacía", "No hay citas entre el 6 y el 10 de octubre. Las que reserven tus agentes o tu equipo aparecerán aquí.", ["Ver horarios", "/plataforma/horarios"]] },
  "/plataforma/horarios": { name: "Horarios", kind: "tabla", role: OWNER, empty: ["Aún no hay horarios", "Añade el horario de la sede y de cada profesional para que los agentes solo ofrezcan huecos reales.", ["Añadir horario", "/plataforma/horarios"]] },
  "/plataforma/clientes": { name: "Clientes", kind: "tabla", role: OPS, empty: ["Aún no hay fichas de clientes", "Tus agentes crean y actualizan una ficha por cada cliente con el que hablan. También puedes importarlas.", ["Importar clientes", "/plataforma/configuracion/integraciones"]] },
  "/plataforma/leads": { name: "Leads", kind: "tablero", role: OPS, empty: ["Sin leads por ahora", "Los contactos que preguntan por un tratamiento y aún no son clientes aparecerán aquí, ordenados por etapa.", ["Ver conversaciones", "/plataforma/conversaciones"]] },
  "/plataforma/llamadas": { name: "Llamadas", kind: "lista", role: OPS, empty: ["Todavía no hay llamadas", "Activa la voz de Recepción para que atienda el teléfono. Cada llamada quedará aquí con su transcripción.", ["Configurar la voz", "/plataforma/voz"]] },
  "/plataforma/facturas": { name: "Facturas e inventario", kind: "tabla", role: OWNER, empty: ["Sin facturas este mes", "Las facturas que prepare Administración y los pedidos de material aparecerán aquí.", ["Conectar facturación", "/plataforma/configuracion/integraciones"]] },
  "/plataforma/informes": { name: "Informes", kind: "panel", role: OWNER, empty: ["Aún no hay datos para el informe", "Los informes se llenan con la actividad de tus agentes. Vuelve cuando lleven unos días trabajando.", ["Ir al inicio", "/plataforma"]] },
  "/plataforma/red": { name: "Red de franquicias", kind: "tabla", role: "Franquiciador", empty: ["Tu red aún no tiene franquiciados", "Invita a cada franquiciado: tendrá sus propios datos y heredará las plantillas y políticas de la red.", ["Invitar franquiciado", "/plataforma/configuracion/equipo"]] },
  "/plataforma/agente": { name: "Mis agentes", kind: "tarjetas", role: OWNER, empty: ["Aún no tienes agentes", "Empieza por Recepción: atiende, reserva y recuerda citas. Viene configurado para tu sector.", ["Crear un agente", "/plataforma/agente-nuevo"]] },
  "/plataforma/agente-nuevo": { name: "Nuevo agente", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/probar": { name: "Probar y activar", kind: "chat", role: OWNER, empty: null },
  "/plataforma/publicar": { name: "Publicar cambios", kind: "formulario", role: OWNER, empty: ["No hay cambios sin publicar", "Todo lo que ves en el agente ya está en uso con tus clientes.", ["Ver mis agentes", "/plataforma/agente"]] },
  "/plataforma/reglas": { name: "Reglas y aprobaciones", kind: "tabla", role: OWNER, empty: ["Sin reglas propias", "Tus agentes usan las reglas de serie: todo lo que implique dinero o cambios en bloque necesita tu aprobación.", ["Añadir una regla", "/plataforma/reglas"]] },
  "/plataforma/autonomia": { name: "Techo de autonomía", kind: "tabla", role: OWNER, empty: null },
  "/plataforma/flujos": { name: "Flujos automáticos", kind: "tarjetas", role: OWNER, empty: ["Aún no hay flujos", "Un flujo une un aviso con una acción: «si se cancela una cita, avisa a la lista de espera». Empieza por una plantilla.", ["Ver plantillas", "/plataforma/flujos"]] },
  "/plataforma/voz": { name: "Voz del agente", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/memoria": { name: "Memoria del negocio", kind: "lista", role: OWNER, empty: ["Tus agentes aún no han aprendido nada", "Cada vez que un agente aprenda algo de tu negocio (un precio, una preferencia de un cliente), lo verás aquí para revisarlo.", ["Ir a Conocimiento", "/plataforma/conocimiento"]] },
  "/plataforma/conocimiento": { name: "Conocimiento", kind: "tabla", role: OWNER, empty: ["Aún no has subido documentos", "Sube tarifas, protocolos o tu FAQ. Es lo que los agentes usan para responder con datos de tu negocio.", ["Subir documentos", "/plataforma/ingesta"]] },
  "/plataforma/ingesta": { name: "Subir conocimiento", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/coach": { name: "Modo coach", kind: "tarjetas", role: OWNER, empty: ["Sin propuestas esta semana", "El modo coach revisa cómo trabajan tus agentes y te propone mejoras. Las próximas llegarán el lunes.", ["Ver informes", "/plataforma/informes"]] },
  "/plataforma/asistente": { name: "Asistente", kind: "chat", role: ALL, empty: ["Pregunta lo que necesites", "El asistente te ayuda a configurar la plataforma, entender un dato o hacer una tarea. No hay conversaciones todavía.", ["Ir al inicio", "/plataforma"]] },
  "/plataforma/onboarding": { name: "Onboarding", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/checkout": { name: "Pago y prueba", kind: "formulario", role: "Dueño", empty: null },
  "/plataforma/aceptar": { name: "Aceptar invitación", kind: "formulario", role: ALL, empty: null },
  "/plataforma/conectar": { name: "Conectar un canal", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/proveedores": { name: "Proveedores y vías", kind: "tabla", role: "Dueño", empty: null },
  "/plataforma/residencia": { name: "Residencia de datos", kind: "formulario", role: "Dueño", empty: null },
  "/plataforma/topes": { name: "Topes de gasto", kind: "tabla", role: OWNER, empty: ["Sin topes de gasto", "Pon un tope por agente o por sede para que el gasto de IA nunca te sorprenda a fin de mes.", ["Añadir un tope", "/plataforma/topes"]] },
  "/plataforma/subprocesadores": { name: "Subencargados y DPA", kind: "tabla", role: OWNER, empty: null },
  "/plataforma/byok": { name: "Tus propias claves", kind: "formulario", role: "Dueño", empty: ["Aún no has añadido claves", "Usa tus propias claves de Anthropic, OpenAI o Google si quieres pagar la IA a tu proveedor.", ["Añadir una clave", "/plataforma/byok"]] },
  "/plataforma/nube": { name: "Tu nube", kind: "formulario", role: "Dueño", empty: ["Tu nube no está conectada", "Conecta AWS Bedrock, Google Vertex o Azure para que los modelos corran en tu cuenta y tu región.", ["Conectar tu nube", "/plataforma/nube"]] },
  "/plataforma/privacidad": { name: "Derechos RGPD de un cliente", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/configuracion/general": { name: "General", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/configuracion/perfil": { name: "Mi perfil", kind: "formulario", role: ALL, empty: null },
  "/plataforma/configuracion/preferencias": { name: "Preferencias", kind: "formulario", role: ALL, empty: null },
  "/plataforma/configuracion/privacidad": { name: "Privacidad", kind: "formulario", role: ALL, empty: null },
  "/plataforma/configuracion/equipo": { name: "Miembros", kind: "tabla", role: OWNER, empty: ["Solo estás tú", "Invita a tu equipo para que vea las conversaciones, apruebe tareas o lleve la agenda. Cada persona entra con su rol.", ["Invitar a alguien", "/plataforma/configuracion/equipo"]] },
  "/plataforma/configuracion/roles": { name: "Roles", kind: "tabla", role: OWNER, empty: null },
  "/plataforma/configuracion/sedes": { name: "Sedes", kind: "tabla", role: OWNER, empty: ["Aún no hay sedes", "Añade tu primera sede con su dirección y su horario. Los agentes trabajan siempre dentro de una sede.", ["Añadir una sede", "/plataforma/configuracion/sedes"]] },
  "/plataforma/configuracion/plan": { name: "Plan y consumo", kind: "panel", role: OWNER, empty: null },
  "/plataforma/configuracion/facturacion": { name: "Facturación", kind: "formulario", role: "Dueño", empty: ["Aún no hay facturas", "La primera factura se emite el día 1 del mes que viene, al acabar la prueba.", ["Ver plan y consumo", "/plataforma/configuracion/plan"]] },
  "/plataforma/configuracion/modelos": { name: "Modelos de IA", kind: "tarjetas", role: "Dueño", empty: null },
  "/plataforma/configuracion/integraciones": { name: "Integraciones", kind: "tarjetas", role: OWNER, empty: ["Aún no has conectado nada", "Conecta tu calendario, WhatsApp y tu software de facturación para que los agentes trabajen con tus datos.", ["Conectar un canal", "/plataforma/conectar"]] },
  "/plataforma/configuracion/integraciones/detalle": { name: "Ficha de integración", kind: "formulario", role: OWNER, empty: null },
  "/plataforma/configuracion/api": { name: "Claves de API", kind: "tabla", role: "Dueño", empty: ["No hay claves de API", "Crea una clave por herramienta, con los permisos mínimos y caducidad.", ["Crear clave", "/plataforma/configuracion/api"]] },
  "/plataforma/configuracion/seguridad": { name: "Seguridad y acceso", kind: "formulario", role: "Dueño", empty: null },
  "/plataforma/configuracion/seguridad/2fa": { name: "Verificación en dos pasos", kind: "formulario", role: ALL, empty: null },
  "/plataforma/configuracion/seguridad/sso": { name: "Inicio de sesión único (SSO)", kind: "formulario", role: "Dueño", empty: null },
  "/plataforma/configuracion/auditoria": { name: "Registro de auditoría", kind: "tabla", role: OWNER, empty: ["Aún no hay actividad registrada", "Cada cambio de configuración, aprobación o acceso a datos queda aquí, con quién lo hizo y cuándo.", ["Ver seguridad", "/plataforma/configuracion/seguridad"]] },
  "/plataforma/movil": { name: "Inicio", kind: "movil", role: ALL, empty: ["Tus agentes aún no han empezado", "Cuando actives un agente, verás aquí su actividad del día.", ["Ver agentes", "/plataforma/movil/agentes"]] },
  "/plataforma/movil/chats": { name: "Chats", kind: "movil", role: OPS, empty: ["Todavía no hay chats", "Las conversaciones con tus clientes aparecerán aquí.", ["Ir al inicio", "/plataforma/movil"]] },
  "/plataforma/movil/conversacion": { name: "Conversación", kind: "movil", role: OPS, empty: null },
  "/plataforma/movil/aprobaciones": { name: "Aprobaciones", kind: "movil", role: OWNER, empty: ["Nada pendiente de aprobar", "Te avisaremos cuando un agente necesite tu visto bueno.", ["Ir al inicio", "/plataforma/movil"]] },
  "/plataforma/movil/agenda": { name: "Agenda", kind: "movil", role: OPS, empty: ["Hoy no hay citas", "Las citas del día aparecerán aquí.", ["Ir al inicio", "/plataforma/movil"]] },
  "/plataforma/movil/mas": { name: "Más", kind: "movil", role: ALL, empty: null },
  "/plataforma/movil/clientes": { name: "Clientes", kind: "movil", role: OPS, empty: ["Aún no hay clientes", "Tus agentes crean una ficha por cada cliente con el que hablan.", ["Ir al inicio", "/plataforma/movil"]] },
  "/plataforma/movil/agentes": { name: "Agentes", kind: "movil", role: OWNER, empty: ["Aún no tienes agentes", "Crea tu primer agente desde el ordenador.", ["Ir al inicio", "/plataforma/movil"]] },
  "/plataforma/movil/informes": { name: "Informes", kind: "movil", role: OWNER, empty: ["Aún no hay datos", "Vuelve cuando tus agentes lleven unos días trabajando.", ["Ir al inicio", "/plataforma/movil"]] },
  "/plataforma/movil/integraciones": { name: "Integraciones", kind: "movil", role: OWNER, empty: ["Aún no has conectado nada", "Conecta tus canales desde el ordenador.", ["Ir al inicio", "/plataforma/movil"]] },
  "/plataforma/movil/plan": { name: "Plan y consumo", kind: "movil", role: OWNER, empty: null },
  "/plataforma/movil/ajustes": { name: "Ajustes", kind: "movil", role: ALL, empty: null },
  "/plataforma/movil/perfil": { name: "Mi perfil", kind: "movil", role: ALL, empty: null },
};

export const STATES = ["normal", "cargando", "vacio", "error", "sin-permiso"];
export const STATE_LABELS = { normal: "Normal", cargando: "Cargando", vacio: "Vacío", error: "Error", "sin-permiso": "Sin permiso" };
