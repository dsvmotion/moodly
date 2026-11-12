// Los 8 verticales de Moodly: Vertical → Subsector → Agente → Skills → Personalización.
// Nombres y palabras clave (kw) según la investigación de búsquedas: docs/design/verticales-seo.md.
// Las cifras citan siempre su fuente; los [corchetes] son datos por confirmar.
import { RICH, SUBS } from "./verticals-i18n";

const SRC = {
  calls: "411 Locals (2016)",
  hbr: "Harvard Business Review, «The Short Life of Online Sales Leads»",
  reviews: "BrightLocal, Local Consumer Review Survey 2024",
};
const calls = { n: "62 %", t: "de las llamadas a pequeñas empresas se quedan sin contestar" };
const callsLost = { n: "78 %", t: "de quienes no son atendidos al llamar no vuelve a intentarlo" };
const lead1h = { n: "7×", t: "más probable cualificar un contacto si respondes en menos de 1 hora" };
const lead42 = { n: "42 h", t: "tarda de media una empresa en responder a un contacto web" };
const lead24 = { n: "24 %", t: "de las empresas nunca llega a responder a un contacto web" };
const reviews = { n: "88 %", t: "de los clientes elegiría un negocio que responde a todas sus reseñas" };

const U = (t) => ({ t, user: true });
const A = (t) => ({ t, user: false });

export const VERTICALS = [
  {
    id: "belleza", name: "Belleza y estética", kw: "Agente de IA para centros de estética, peluquerías y barberías", text: "Estética, peluquerías, barberías, uñas.", color: "#a3c2a7", on: "#000000",
    subsectors: ["Estética y belleza", "Peluquerías", "Barberías", "Uñas", "Pestañas y cejas"],
    h1: "Tu centro atendido, aunque tengas las manos ocupadas",
    sub: "Moodly contesta WhatsApp y reserva y recuerda citas. Tu equipo se ocupa de las personas.",
    chatHead: "WhatsApp · 22:47", chatMeta: "Fuera de horario",
    chat: [U("Hola, ¿tenéis hueco para corte y color el sábado?"), A("¡Hola, Marta! El sábado tengo a las 10:00 con Lucía o a las 12:30 con Andrea. ¿Cuál te viene mejor?"), U("10:00"), A("Reservado: sábado a las 10:00, corte y color con Lucía. Te lo recuerdo el viernes.")],
    side: [["Agenda · sábado", "10:00 · Corte y color · Marta G.", "Lucía · reservada por Recepción"], ["Ficha de la clienta", "Servicio: corte y color", "Solo lo que dijo la clienta"], ["Aviso al equipo · 9:00", "Cita nueva para Lucía", "Por la app"]],
    pains: [calls, callsLost, reviews],
    source: `Fuentes: ${SRC.calls}; ${SRC.reviews}.`,
    skills: {
      recepcion: ["Reservar, mover y cancelar citas", "Recordatorio 24 h antes", "Lista de espera automática", "Reserva por profesional y servicio"],
      atencion: ["Precios, horarios y servicios", "Indicaciones antes de la cita", "Pasa a tu equipo lo que no sabe", "Pide reseña tras la visita"],
      comercial: ["Seguimiento de presupuestos", "Bonos y paquetes", "Reactivar clientes inactivos"],
      administracion: ["Facturas a clientes", "Señal o pago al reservar", "Cobros pendientes"],
    },
    custom: ["Profesionales, cabinas y duración de cada servicio", "Servicios y tarifas", "Política de cancelación", "Tono: cercano o formal"],
    special: ["Tu agenda, sin dobles reservas.", "Cada cita sale de tus horarios, tus profesionales y la duración real de cada servicio.", ["Reserva solo en huecos libres de verdad", "Respeta la duración de cada servicio", "Cada persona del equipo ve solo lo suyo", "Si no está seguro, pregunta al equipo"]],
    faq: [["¿Funciona con mi programa de reservas?", "Con Google Calendar y Outlook, que llegan con el piloto. Si usas otro, lo valoramos al empezar."], ["¿Qué pasa si preguntan algo que no sabe?", "El agente no se lo inventa: te lo pasa a ti o a tu equipo."]],
  },
  {
    id: "hosteleria", name: "Hostelería y turismo", kw: "Agente de IA para restaurantes, hoteles y apartamentos turísticos", text: "Restaurantes, hoteles, apartamentos, experiencias.", color: "#ff6301", on: "#000000",
    subsectors: ["Restaurantes", "Hoteles", "Apartamentos turísticos", "Property managers", "Hostels", "Experiencias y turismo"],
    h1: "Reservas y huéspedes atendidos, aunque estés en pleno servicio",
    sub: "Moodly gestiona reservas por WhatsApp, Instagram, Booking.com y teléfono, responde a huéspedes y reseñas y ofrece extras en el momento justo.",
    chatHead: "WhatsApp · 20:41", chatMeta: "Huésped · llega mañana",
    chat: [U("Hola, llegamos mañana sobre las 23:00. ¿Hay problema?"), A("Ninguno, Laura. Te envío el código de acceso mañana a las 18:00. ¿Os reservo el parking? Son 15 € la noche."), U("Sí, por favor. Somos dos coches"), A("Hecho: 2 plazas de parking para 3 noches. ¡Buen viaje!")],
    side: [["Reserva · apto. 4B", "Check-in 23:00 · 3 noches", "Código de acceso programado"], ["Extra vendido", "2 plazas de parking · 90 €", "Añadido a la reserva"], ["Limpieza", "Salida a las 11:00 del viernes", "Aviso al equipo de limpieza"]],
    pains: [{ n: "3,3 %", t: "de las reservas de restaurante no se presentan en España" }, { n: "15.500 €", t: "al año de facturación perdida por no-shows en un restaurante medio" }, reviews],
    source: `Fuentes: TheFork, datos de 2025 recogidos por elEconomista; ${SRC.reviews}.`,
    skills: {
      recepcion: ["Reservas de mesa y habitación", "Confirmación y lista de espera", "Check-in y códigos de acceso", "Llamadas en pleno servicio"],
      atencion: ["Carta, alérgenos y horarios", "Dudas de huéspedes 24/7 en varios idiomas", "Incidencias durante la estancia", "Respuesta a reseñas"],
      comercial: ["Venta de extras: parking, late check-out, cenas", "Grupos y eventos", "Reservas directas sin comisión"],
      administracion: ["Pedidos a proveedores", "Avisos a limpieza y mantenimiento", "Facturas y depósitos"],
    },
    custom: ["Carta y alérgenos, o fichas de cada alojamiento", "Política de cancelación y depósitos", "Extras y precios", "Idiomas de atención"],
    special: ["Alérgenos y normas sin errores.", "La información sale de tu carta y tus fichas, no de la imaginación del agente.", ["Alérgenos solo con tu carta actualizada", "Intolerancias anotadas para cocina", "Normas de la casa en el idioma del huésped", "Si no está seguro, pregunta al equipo"]],
    faq: [["¿Funciona con mi sistema de reservas?", "Con TheFork [vía partner], Booking.com, Lightspeed y [sistemas compatibles]. Si usas otro, lo valoramos al empezar."], ["¿Atiende en otros idiomas?", "Sí. Responde en el idioma del cliente con tu información."]],
  },
  {
    id: "inmobiliario", name: "Inmobiliarias", kw: "Agente de IA para inmobiliarias y gestión de alquileres", text: "Venta, alquiler, obra nueva y gestión.", color: "#ffbab5", on: "#000000",
    subsectors: ["Venta", "Alquiler", "Obra nueva", "Gestión de alquileres", "Administración de fincas"],
    h1: "Cada lead de portal atendido en minutos, con visita agendada",
    sub: "Moodly responde a los interesados de portales y redes, los cualifica, agenda visitas y lo registra todo en tu CRM.",
    chatHead: "WhatsApp · 22:05", chatMeta: "Lead de [portal]",
    chat: [U("Hola, me interesa el piso de la calle Mayor. ¿Sigue disponible?"), A("¡Sí! 3 habitaciones, 92 m², [000.000] €. ¿Buscas para vivir o para invertir?"), U("Para vivir. ¿Se puede ver esta semana?"), A("Claro. Tengo jueves a las 18:00 o sábado a las 11:00 con Elena. ¿Te va bien alguno?")],
    side: [["Lead cualificado", "Compra para vivir · financiación pendiente", "Registrado en el CRM"], ["Visita", "Sábado 11:00 · calle Mayor", "Con Elena · confirmada"], ["Seguimiento", "Mañana a las 10:00", "Si no confirma la visita"]],
    pains: [lead1h, lead42, lead24],
    source: `Fuente: ${SRC.hbr} (auditoría de 2.241 empresas).`,
    skills: {
      recepcion: ["Agendar visitas por agente", "Confirmación el día antes", "Reprogramar si alguien se retrasa"],
      atencion: ["Responder con la ficha de cada inmueble", "Documentación para alquilar", "Incidencias de inquilinos"],
      comercial: ["Cualificar leads de portales", "Seguimiento tras la visita", "Captación de propietarios"],
      administracion: ["Recibos y cobros de alquiler", "Contratos para firma", "Avisos a mantenimiento"],
    },
    custom: ["Portales y cartera de inmuebles", "Criterios de cualificación", "Reparto de visitas por agente", "Requisitos para alquilar"],
    special: ["Conectado a tus portales.", "Los leads entran solos y nadie se queda sin respuesta.", ["Leads de [portales] directos al agente", "Respuestas con la ficha real del inmueble", "Ofertas y contraofertas siempre a una persona", "Todo registrado en tu CRM"]],
    faq: [["¿Qué portales se conectan?", "[Portales compatibles: por confirmar]. También formularios web y redes."], ["¿Puede negociar precios?", "No. Las ofertas pasan siempre a una persona."]],
  },
  {
    id: "profesionales", name: "Despachos y asesorías", kw: "Agente de IA para gestorías, asesorías y despachos de abogados", text: "Gestorías, abogados, consultoras, agencias.", color: "#f6f2e8", on: "#000000",
    subsectors: ["Gestorías y asesorías", "Abogados", "Consultorías", "Arquitectura e ingeniería", "Agencias", "Selección de personal"],
    h1: "Tus clientes, al día con plazos y papeles sin que los persigas",
    sub: "Moodly recoge documentación, agenda reuniones, sigue propuestas y prepara la facturación por cliente o por proyecto.",
    chatHead: "WhatsApp · 09:12", chatMeta: "Campaña del trimestre",
    chat: [A("Hola, Raúl. El 20 de octubre vence el IVA del tercer trimestre. ¿Me envías las facturas de julio a septiembre?"), U("Te las mando hoy. ¿Las de gastos también?"), A("Sí, gastos e ingresos. Puedes enviarlas aquí mismo en foto o PDF."), U("[3 archivos adjuntos]")],
    side: [["Documentación · Raúl S.", "3 de 4 documentos recibidos", "Falta el extracto bancario"], ["Plazo", "IVA 3T · 20 oct", "12 clientes pendientes"], ["Bandeja de email", "38 emails clasificados", "Por cliente y por tema"]],
    pains: [{ n: "226 h", t: "al año dedica un autónomo a trámites administrativos" }, { n: "3.390 €", t: "al año le cuestan esas obligaciones a cada autónomo" }, lead1h],
    source: `Fuentes: ATA, Federación Nacional de Asociaciones de Trabajadores Autónomos (2025); ${SRC.hbr}.`,
    skills: {
      recepcion: ["Agendar reuniones y primeras consultas", "Recordar plazos y vencimientos", "Filtrar llamadas"],
      atencion: ["Recoger documentos por WhatsApp y email", "Ordenarlos por cliente y expediente", "Clasificar la bandeja de entrada"],
      comercial: ["Recibir briefings y encargos", "Seguir propuestas enviadas", "Hojas de encargo para firma"],
      administracion: ["Facturas por hito, mes u horas", "Cobros pendientes", "Control de horas por cliente"],
    },
    custom: ["Calendario fiscal o de plazos", "Plantillas de briefing y de encargo", "Tarifas y forma de facturar", "Qué consultas pasan siempre a ti"],
    special: ["Ni un consejo sin ti.", "El agente recoge y ordena; tú asesoras.", ["Nunca da asesoramiento fiscal, legal ni técnico", "Documentos por cliente y expediente", "Confidencialidad por cliente y por persona", "Recordatorios escalonados hasta recibirlo todo"]],
    faq: [["¿Se conecta con mi programa de contabilidad o de despacho?", "Con Holded, Sage, Pennylane, Odoo y [programas compatibles]. Si usas otro, lo valoramos al empezar."], ["¿Puede presentar impuestos o escritos?", "No. Prepara y ordena; la presentación siempre la haces tú."]],
  },
  {
    id: "retail", name: "Tiendas y ecommerce", kw: "Agente de IA para tiendas online y comercios", text: "Moda, cosmética, alimentación, marcas DTC.", color: "#e8edff", on: "#000000",
    subsectors: ["Moda", "Belleza y cosmética", "Alimentación", "Marcas DTC", "Tiendas especializadas"],
    h1: "Pedidos, cambios y devoluciones resueltos sin colas",
    sub: "Moodly responde dónde está cada pedido, gestiona cambios y devoluciones, vigila el stock y recupera clientes con mensajes a tiempo.",
    chatHead: "Instagram · 18:22", chatMeta: "Cliente con pedido",
    chat: [U("Hola, mi pedido 4821 no llega y lo necesito para el sábado"), A("Hola, Sara. Sale hoy del almacén y llega el viernes antes de las 14:00. Te paso el seguimiento."), U("¿Y si no me queda bien la talla?"), A("Tienes 30 días para cambiarla gratis. Te dejo el enlace para pedir el cambio.")],
    side: [["Pedido #4821", "En reparto · llega el viernes", "Shopify · seguimiento enviado"], ["Stock", "Vestido Lino · talla M: 3 unidades", "Aviso de reposición en 2 tallas"], ["Recuperación", "12 carritos abandonados hoy", "Mensaje enviado con tu aprobación"]],
    pains: [reviews, lead42, lead24],
    source: `Fuentes: ${SRC.reviews}; ${SRC.hbr}.`,
    skills: {
      recepcion: ["Citas en tienda y personal shopper", "Recogida en tienda", "Llamadas de clientes"],
      atencion: ["Estado de pedidos", "Cambios y devoluciones", "Tallas, ingredientes y disponibilidad", "Respuesta a reseñas"],
      comercial: ["Carritos abandonados", "Recomendaciones según compras", "Campañas por WhatsApp y email"],
      administracion: ["Avisos de stock bajo", "Pedidos a proveedores", "Conciliación de cobros y reembolsos"],
    },
    custom: ["Catálogo y tienda online", "Política de cambios y devoluciones", "Tono de marca", "Qué campañas requieren aprobación"],
    special: ["Con el tono de tu marca.", "Cada respuesta suena a ti, en cada canal.", ["Datos de pedido y stock en tiempo real", "Reembolsos siempre con aprobación", "Campañas con consentimiento del cliente", "Mismo tono en tienda, web y redes"]],
    faq: [["¿Con qué tiendas online funciona?", "Shopify, WooCommerce, PrestaShop, Adobe Commerce y BigCommerce."], ["¿Puede hacer reembolsos?", "Los prepara; se ejecutan solo con tu aprobación o dentro del límite que fijes."]],
  },
  {
    id: "hogar", name: "Reformas y servicios técnicos", kw: "Agente de IA para empresas de reformas, instaladores y servicios técnicos", text: "Reformas, instaladores, climatización, limpieza.", color: "#2457f5", on: "#ffffff",
    subsectors: ["Reformas", "Electricistas", "Fontanería", "Climatización", "Limpieza", "Mantenimiento", "Instaladores"],
    h1: "Del aviso al presupuesto y al técnico, sin perder una llamada",
    sub: "Moodly atiende avisos mientras estás en una obra, pide fotos, prepara el presupuesto, agenda al técnico y hace el seguimiento hasta la factura.",
    chatHead: "WhatsApp · 08:05", chatMeta: "Cliente nuevo",
    chat: [U("Buenos días, el aire acondicionado no enfría y gotea"), A("Buenos días, Pedro. ¿Me mandas una foto de la unidad y de la etiqueta con el modelo?"), U("[2 fotos]"), A("Gracias. Puedo enviarte a Iván mañana entre 9 y 11. La visita son 45 € y se descuentan si haces la reparación.")],
    side: [["Aviso nuevo", "Avería de climatización · con fotos", "Modelo identificado"], ["Agenda del técnico", "Mañana 9–11 · Iván", "Ruta optimizada con 3 avisos más"], ["Presupuesto", "Borrador listo para revisar", "Se envía con tu aprobación"]],
    pains: [calls, callsLost, lead1h],
    source: `Fuentes: ${SRC.calls}; ${SRC.hbr}.`,
    skills: {
      recepcion: ["Atender llamadas mientras estás en obra", "Agendar técnicos por zona", "Avisar al cliente de la llegada"],
      atencion: ["Recoger fotos y datos del aviso", "Urgencias fuera de horario", "Estado de la reparación"],
      comercial: ["Presupuestos a partir de tus tarifas", "Seguimiento de presupuestos enviados", "Contratos de mantenimiento"],
      administracion: ["Partes de trabajo y facturas", "Cobros y señales", "Pedido de material"],
    },
    custom: ["Zonas y técnicos", "Tarifas, desplazamiento y urgencias", "Plantilla de presupuesto", "Qué avisos son urgentes"],
    special: ["Presupuestos que salen el mismo día.", "Con tus tarifas y tu plantilla, revisados por ti.", ["Nunca promete precio sin tus tarifas", "Fotos y datos del aviso antes de la visita", "Urgencias reales a tu teléfono", "Factura al cerrar el parte"]],
    faq: [["¿Sirve si trabajo solo?", "Sí. Es donde más se nota: atiende mientras estás en una obra."], ["¿Se conecta con mi programa de presupuestos?", "Con Holded, Odoo y [programas compatibles]. Si no, Moodly genera el presupuesto con tu plantilla."]],
  },
  {
    id: "automocion", name: "Talleres y concesionarios", kw: "Agente de IA para talleres mecánicos y concesionarios", text: "Concesionarios, talleres, rent-a-car.", color: "#000000", on: "#ffffff",
    subsectors: ["Concesionarios", "Talleres", "Rent-a-car", "Detailing", "Motos"],
    h1: "Citas de taller y leads de coches atendidos al momento",
    sub: "Moodly agenda revisiones, avisa cuando el coche está listo, responde a interesados en cada vehículo y sigue cada oportunidad en tu CRM.",
    chatHead: "WhatsApp · 19:40", chatMeta: "Lead de [portal de coches]",
    chat: [U("¿Sigue disponible el SUV híbrido de 2022?"), A("Sí, Andrés: 38.000 km, garantía de 12 meses y [00.000] €. ¿Tienes coche para entregar?"), U("Sí, un compacto de 2016"), A("Perfecto, lo tasamos en la visita. ¿Te va bien el sábado a las 10:30 para verlo y probarlo?")],
    side: [["Lead cualificado", "SUV híbrido · con coche a entregar", "Registrado en el CRM"], ["Prueba", "Sábado 10:30 · con Marta", "Confirmación el viernes"], ["Taller", "4 coches listos para recoger", "Clientes avisados por WhatsApp"]],
    pains: [lead1h, lead42, calls],
    source: `Fuentes: ${SRC.hbr}; ${SRC.calls}.`,
    skills: {
      recepcion: ["Citas de taller y pruebas", "Aviso de coche listo", "Recordatorio de ITV y revisiones"],
      atencion: ["Estado de la reparación", "Ficha de cada vehículo", "Reservas y dudas de alquiler"],
      comercial: ["Cualificar leads de portales", "Tasación de vehículo usado (cita)", "Seguimiento tras la prueba"],
      administracion: ["Presupuestos de reparación", "Facturas y cobros", "Pedido de recambios"],
    },
    custom: ["Stock de vehículos y portales", "Servicios y tiempos de taller", "Reparto de leads por comercial", "Condiciones de alquiler"],
    special: ["Ningún lead se enfría.", "Respuesta en minutos y seguimiento hasta la venta.", ["Datos del vehículo desde tu stock", "Precios y financiación solo con tus condiciones", "Reparaciones extra siempre con aprobación del cliente", "Todo en tu CRM"]],
    faq: [["¿Se conecta con mi DMS o mi CRM?", "Con Salesforce, HubSpot, Dynamics 365 y [DMS compatibles]."], ["¿Puede aprobar una reparación?", "No: envía el presupuesto al cliente y registra su respuesta."]],
  },
  {
    id: "educacion", name: "Academias y gimnasios", kw: "Agente de IA para academias, escuelas de idiomas y gimnasios", text: "Academias, idiomas, gimnasios, pilates.", color: "#fff3e8", on: "#000000",
    subsectors: ["Academias", "Escuelas de idiomas", "Gimnasios", "Pilates y yoga", "Entrenamiento personal", "Centros de formación"],
    h1: "Matrículas, clases y cuotas, sin pasarte el día al teléfono",
    sub: "Moodly informa de cursos y horarios, reserva pruebas de nivel y clases, gestiona listas de espera y recuerda cuotas pendientes.",
    chatHead: "Instagram · 21:15", chatMeta: "Interesada en clases",
    chat: [U("Hola, ¿tenéis pilates por las tardes? Nunca he hecho"), A("¡Hola, Clara! Tenemos nivel inicial martes y jueves a las 19:00. ¿Te reservo una clase de prueba gratis?"), U("Sí, el jueves"), A("Reservada: jueves 19:00 con Ana. Ven con ropa cómoda y 10 minutos antes.")],
    side: [["Clase de prueba", "Jueves 19:00 · Pilates inicial", "Con Ana · 9 de 10 plazas"], ["Seguimiento", "Viernes 10:00", "Oferta de alta si le gustó"], ["Cuotas", "6 recibos pendientes", "Recordatorio enviado"]],
    pains: [calls, lead1h, reviews],
    source: `Fuentes: ${SRC.calls}; ${SRC.hbr}; ${SRC.reviews}.`,
    skills: {
      recepcion: ["Reservar clases y pruebas de nivel", "Lista de espera por grupo", "Avisos de cambios de horario"],
      atencion: ["Cursos, horarios y precios", "Dudas de alumnos y familias", "Justificantes y certificados"],
      comercial: ["Seguimiento tras la clase de prueba", "Campañas de matrícula", "Recuperar bajas"],
      administracion: ["Cuotas y domiciliaciones", "Recibos pendientes", "Facturas de matrícula"],
    },
    custom: ["Grupos, niveles y aforos", "Calendario del curso", "Tarifas, bonos y matrícula", "Política de bajas"],
    special: ["Grupos llenos, sin perseguir a nadie.", "Plazas, listas de espera y cuotas al día.", ["Aforo por grupo en tiempo real", "Avisos a familias con su consentimiento", "Cobros por domiciliación (GoCardless)", "Datos de menores tratados con cuidado"]],
    faq: [["¿Se conecta con mi programa de reservas o gestión?", "Con Google Calendar, Calendly y [programas compatibles]. Si usas otro, lo valoramos al empezar."], ["¿Gestiona cobros?", "Recuerda cuotas y prepara recibos; los cobros van por tu pasarela o domiciliación."]],
  },
];

export const AGENT_KEYS = [
  ["recepcion", "Recepción", "#004c39", "#ffffff"],
  ["atencion", "Atención al cliente", "#9dbecc", "#000000"],
  ["comercial", "Comercial", "#a30042", "#ffffff"],
  ["administracion", "Administración", "#8e4e00", "#ffffff"],
];

// Por subsector: plural, «tu …» y titular propio. Las secciones de /sectores se adaptan al elegido.
export const SUBSECTORS = {
  belleza: [
    ["Estética y belleza", "centros de estética", "tu centro de estética", "Tu centro de estética reservando citas mientras trabajas"],
    ["Peluquerías", "peluquerías", "tu peluquería", "Tu peluquería contesta WhatsApp sin soltar las tijeras"],
    ["Barberías", "barberías", "tu barbería", "Tu barbería con la agenda llena y sin llamadas a mitad de corte"],
    ["Uñas", "centros de uñas", "tu centro de uñas", "Tu centro de uñas reserva y recuerda citas solo"],
    ["Pestañas y cejas", "estudios de pestañas y cejas", "tu estudio", "Tu estudio de pestañas y cejas sin huecos perdidos"],
  ],
  hosteleria: [
    ["Restaurantes", "restaurantes", "tu restaurante", "Tu restaurante reserva mesas aunque estés en pleno servicio"],
    ["Hoteles", "hoteles", "tu hotel", "Tu hotel responde a cada huésped, en su idioma y a cualquier hora"],
    ["Apartamentos turísticos", "apartamentos turísticos", "tus apartamentos", "Check-in, códigos y dudas de huéspedes resueltos sin llamadas"],
    ["Property managers", "gestores de alquiler vacacional", "tu cartera de alojamientos", "Todos tus alojamientos atendidos desde un solo sitio"],
    ["Hostels", "hostels", "tu hostel", "Tu hostel lleno, con reservas directas y sin comisiones"],
    ["Experiencias y turismo", "empresas de experiencias", "tu empresa de experiencias", "Reservas de tours y actividades confirmadas al momento"],
  ],
  inmobiliario: [
    ["Venta", "inmobiliarias de venta", "tu inmobiliaria", "Cada lead de portal atendido en minutos, con visita agendada"],
    ["Alquiler", "inmobiliarias de alquiler", "tu agencia de alquiler", "Interesados filtrados y visitas de alquiler agendadas solas"],
    ["Obra nueva", "promotoras de obra nueva", "tu promoción", "Tu promoción de obra nueva con cada lead seguido hasta la reserva"],
    ["Gestión de alquileres", "gestoras de alquileres", "tu gestora", "Inquilinos atendidos e incidencias resueltas sin perseguirlas"],
    ["Administración de fincas", "administradores de fincas", "tu administración de fincas", "Avisos de vecinos ordenados y comunidades informadas"],
  ],
  profesionales: [
    ["Gestorías y asesorías", "gestorías y asesorías", "tu gestoría", "Tus clientes, al día con plazos y papeles sin que los persigas"],
    ["Abogados", "despachos de abogados", "tu despacho", "Tu despacho filtra consultas y agenda primeras reuniones solo"],
    ["Consultorías", "consultoras", "tu consultora", "Propuestas con seguimiento y clientes informados en cada hito"],
    ["Arquitectura e ingeniería", "estudios de arquitectura e ingeniería", "tu estudio", "Encargos, documentación y visitas de obra bajo control"],
    ["Agencias", "agencias", "tu agencia", "Briefings ordenados, propuestas con seguimiento y facturas al día"],
    ["Selección de personal", "empresas de selección", "tu empresa de selección", "Candidatos atendidos y entrevistas agendadas sin idas y venidas"],
  ],
  retail: [
    ["Moda", "tiendas de moda", "tu tienda de moda", "Pedidos, tallas y cambios resueltos sin colas"],
    ["Belleza y cosmética", "marcas de cosmética", "tu marca de cosmética", "Tus clientas con su rutina y su pedido, siempre atendidas"],
    ["Alimentación", "tiendas de alimentación", "tu tienda de alimentación", "Pedidos, stock y repartos coordinados sin descolgar el teléfono"],
    ["Marcas DTC", "marcas DTC", "tu marca", "Tu marca atiende y recupera ventas en todos sus canales"],
    ["Tiendas especializadas", "tiendas especializadas", "tu tienda", "Consejo experto y disponibilidad al momento, también de noche"],
  ],
  hogar: [
    ["Reformas", "empresas de reformas", "tu empresa de reformas", "Del aviso al presupuesto de reforma, sin perder una llamada"],
    ["Electricistas", "electricistas", "tu negocio de electricidad", "Avisos y urgencias eléctricas atendidos mientras estás en obra"],
    ["Fontanería", "fontaneros", "tu fontanería", "Cada fuga y cada aviso, con fotos y técnico asignado"],
    ["Climatización", "empresas de climatización", "tu empresa de climatización", "Averías y mantenimientos de clima agendados por zona"],
    ["Limpieza", "empresas de limpieza", "tu empresa de limpieza", "Presupuestos, turnos y clientes recurrentes sin papeleo"],
    ["Mantenimiento", "empresas de mantenimiento", "tu empresa de mantenimiento", "Contratos de mantenimiento con avisos y partes al día"],
    ["Instaladores", "instaladores", "tu empresa instaladora", "Instalaciones planificadas, con material y cliente avisados"],
  ],
  automocion: [
    ["Concesionarios", "concesionarios", "tu concesionario", "Cada lead de coche atendido al momento, con prueba agendada"],
    ["Talleres", "talleres mecánicos", "tu taller", "Citas de taller y coches listos avisados sin coger el teléfono"],
    ["Rent-a-car", "empresas de alquiler de coches", "tu rent-a-car", "Reservas, recogidas y dudas de alquiler resueltas 24/7"],
    ["Detailing", "centros de detailing", "tu centro de detailing", "Agenda llena y presupuestos de detailing enviados al momento"],
    ["Motos", "concesionarios y talleres de motos", "tu negocio de motos", "Revisiones y leads de motos atendidos sin esperas"],
  ],
  educacion: [
    ["Academias", "academias", "tu academia", "Matrículas, clases y cuotas, sin pasarte el día al teléfono"],
    ["Escuelas de idiomas", "escuelas de idiomas", "tu escuela de idiomas", "Pruebas de nivel y grupos completos sin perseguir a nadie"],
    ["Gimnasios", "gimnasios", "tu gimnasio", "Altas, bajas y cuotas de tu gimnasio gestionadas solas"],
    ["Pilates y yoga", "estudios de pilates y yoga", "tu estudio", "Clases reservadas y listas de espera que se llenan solas"],
    ["Entrenamiento personal", "entrenadores personales", "tu negocio de entrenamiento", "Sesiones, bonos y seguimiento de clientes en piloto automático"],
    ["Centros de formación", "centros de formación", "tu centro de formación", "Inscripciones, certificados y dudas de alumnos resueltos"],
  ],
};

// Traducción de los nombres, subsectores y resumen de cada vertical (home + nav).
// El contenido rico de cada sector (h1, sub, chat, etc.) se localiza en la página /sectores.
const VERT_LOC = {
  belleza: {
    en: { name: "Beauty & aesthetics", text: "Aesthetics, hair salons, barbers, nails.", subsectors: ["Aesthetics & beauty", "Hair salons", "Barbers", "Nails", "Lashes & brows"] },
    fr: { name: "Beauté et esthétique", text: "Esthétique, coiffure, barbiers, ongles.", subsectors: ["Esthétique et beauté", "Salons de coiffure", "Barbiers", "Ongles", "Cils et sourcils"] },
    de: { name: "Beauty & Kosmetik", text: "Kosmetik, Friseure, Barbiere, Nägel.", subsectors: ["Ästhetik & Beauty", "Friseursalons", "Barbiere", "Nägel", "Wimpern & Brauen"] },
  },
  hosteleria: {
    en: { name: "Hospitality & tourism", text: "Restaurants, hotels, rentals, experiences.", subsectors: ["Restaurants", "Hotels", "Holiday rentals", "Property managers", "Hostels", "Experiences & tourism"] },
    fr: { name: "Hôtellerie et tourisme", text: "Restaurants, hôtels, locations, expériences.", subsectors: ["Restaurants", "Hôtels", "Locations saisonnières", "Property managers", "Auberges", "Expériences et tourisme"] },
    de: { name: "Gastgewerbe & Tourismus", text: "Restaurants, Hotels, Ferienwohnungen, Erlebnisse.", subsectors: ["Restaurants", "Hotels", "Ferienwohnungen", "Property Manager", "Hostels", "Erlebnisse & Tourismus"] },
  },
  inmobiliario: {
    en: { name: "Real estate", text: "Sales, rentals, new builds and management.", subsectors: ["Sales", "Rentals", "New builds", "Rental management", "Property administration"] },
    fr: { name: "Agences immobilières", text: "Vente, location, neuf et gestion.", subsectors: ["Vente", "Location", "Immobilier neuf", "Gestion locative", "Syndic de copropriété"] },
    de: { name: "Immobilien", text: "Verkauf, Vermietung, Neubau und Verwaltung.", subsectors: ["Verkauf", "Vermietung", "Neubau", "Mietverwaltung", "Hausverwaltung"] },
  },
  profesionales: {
    en: { name: "Professional services", text: "Accountants, lawyers, consultancies, agencies.", subsectors: ["Accounting & advisory", "Law firms", "Consultancies", "Architecture & engineering", "Agencies", "Recruitment"] },
    fr: { name: "Cabinets et conseil", text: "Experts-comptables, avocats, conseil, agences.", subsectors: ["Expertise comptable", "Avocats", "Conseil", "Architecture et ingénierie", "Agences", "Recrutement"] },
    de: { name: "Kanzleien & Beratung", text: "Steuerberater, Anwälte, Berater, Agenturen.", subsectors: ["Steuer- & Unternehmensberatung", "Anwaltskanzleien", "Beratung", "Architektur & Ingenieurwesen", "Agenturen", "Personalvermittlung"] },
  },
  retail: {
    en: { name: "Shops & ecommerce", text: "Fashion, cosmetics, food, DTC brands.", subsectors: ["Fashion", "Beauty & cosmetics", "Food", "DTC brands", "Specialty shops"] },
    fr: { name: "Commerces et e-commerce", text: "Mode, cosmétiques, alimentation, marques DTC.", subsectors: ["Mode", "Beauté et cosmétiques", "Alimentation", "Marques DTC", "Boutiques spécialisées"] },
    de: { name: "Geschäfte & E-Commerce", text: "Mode, Kosmetik, Lebensmittel, DTC-Marken.", subsectors: ["Mode", "Beauty & Kosmetik", "Lebensmittel", "DTC-Marken", "Fachgeschäfte"] },
  },
  hogar: {
    en: { name: "Renovations & trades", text: "Renovations, installers, HVAC, cleaning.", subsectors: ["Renovations", "Electricians", "Plumbing", "HVAC", "Cleaning", "Maintenance", "Installers"] },
    fr: { name: "Rénovation et services techniques", text: "Rénovation, installateurs, climatisation, nettoyage.", subsectors: ["Rénovation", "Électriciens", "Plomberie", "Climatisation", "Nettoyage", "Maintenance", "Installateurs"] },
    de: { name: "Renovierung & Handwerk", text: "Renovierung, Installateure, Klimatechnik, Reinigung.", subsectors: ["Renovierung", "Elektriker", "Sanitär", "Klimatechnik", "Reinigung", "Wartung", "Installateure"] },
  },
  automocion: {
    en: { name: "Workshops & dealerships", text: "Dealerships, workshops, car rental.", subsectors: ["Dealerships", "Workshops", "Car rental", "Detailing", "Motorcycles"] },
    fr: { name: "Garages et concessions", text: "Concessions, garages, location de voitures.", subsectors: ["Concessions", "Garages", "Location de voitures", "Detailing", "Motos"] },
    de: { name: "Werkstätten & Autohäuser", text: "Autohäuser, Werkstätten, Autovermietung.", subsectors: ["Autohäuser", "Werkstätten", "Autovermietung", "Detailing", "Motorräder"] },
  },
  educacion: {
    en: { name: "Academies & gyms", text: "Academies, languages, gyms, pilates.", subsectors: ["Academies", "Language schools", "Gyms", "Pilates & yoga", "Personal training", "Training centers"] },
    fr: { name: "Écoles et salles de sport", text: "Écoles, langues, sport, pilates.", subsectors: ["Écoles privées", "Écoles de langues", "Salles de sport", "Pilates et yoga", "Coaching personnel", "Centres de formation"] },
    de: { name: "Akademien & Fitnessstudios", text: "Akademien, Sprachen, Fitness, Pilates.", subsectors: ["Akademien", "Sprachschulen", "Fitnessstudios", "Pilates & Yoga", "Personal Training", "Bildungszentren"] },
  },
};

// Verticales localizados: nombre/subsectores/resumen + contenido rico de /sectores.
export function getVerticals(lang = "es") {
  if (lang === "es" || !lang) return VERTICALS;
  const rich = RICH[lang] || {};
  return VERTICALS.map((v) => {
    const loc = (VERT_LOC[v.id] && VERT_LOC[v.id][lang]) || {};
    const r = rich[v.id];
    if (!r) return { ...v, ...loc };
    const chat = r.chat.map(([t, type]) => ({ t, user: type === "u" }));
    const pains = r.pains.map(([n, t]) => ({ n, t }));
    return { ...v, ...loc, ...r, chat, pains };
  });
}

// Subsectores [name, plural, «tu …», h1] en el idioma dado (es = originales).
export function getSubsectors(lang = "es") {
  return (lang && SUBS[lang]) || SUBSECTORS;
}
