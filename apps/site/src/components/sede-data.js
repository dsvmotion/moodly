import { SEDE_ALL } from "./use-sede";

// Datos del panel por sede (prototipo). La forma imita al backend: cada sede
// (location_id) tiene su propio conjunto, y «Todas las sedes» se calcula agregando.
// Números y textos son de ejemplo; cuando exista la API, esto se sustituye por la
// consulta real con el alcance (organización / región / local) del usuario.

// Colores de agente de la identidad Moodly (ver design system).
const AGENT_COLOR = { recepcion: "#004c39", atencion: "#9dbecc", comercial: "#a30042", admin: "#8e4e00" };
const ACTIVE = { label: "● Activo", bg: "#dcebdd", fg: "#004c39" };
const PAUSED = { label: "○ Pausado", bg: "#ebebed", fg: "#5f5f63" };

const DATA = {
  "Sede Centro": {
    greetingName: "Marta",
    tasks: 42,
    kpis: { conversaciones: "42", citas: "18", leads: "7", horas: "4,2 h" },
    approvals: [
      { agent: "Administración", tint: "#ffe8d6", fg: "#8e4e00", text: "Enviar factura F-0412 a Laura M. · 75,00 €" },
      { agent: "Atención", tint: "#ffe8d6", fg: "#8e4e00", text: "Responder a una queja en Google Reviews de Pedro G." },
      { agent: "Recepción", tint: "#ffe8d6", fg: "#8e4e00", text: "Mover 3 citas del viernes por la baja de la Dra. Ruiz" },
    ],
    agents: [
      { key: "recepcion", name: "Recepción", stack: "WhatsApp · Teléfono · Calendar", status: ACTIVE },
      { key: "atencion", name: "Atención al cliente", stack: "WhatsApp · Gmail · Instagram", status: ACTIVE },
      { key: "comercial", name: "Comercial", stack: "CRM", status: PAUSED },
      { key: "admin", name: "Administración", stack: "Facturación · Inventario", status: ACTIVE },
    ],
    activity: [
      { time: "10:42", text: "Recepción reservó una limpieza para Laura M. el jueves a las 10:30", via: "WhatsApp → Calendar" },
      { time: "10:15", text: "Atención respondió 4 emails sobre horarios y precios", via: "Gmail" },
      { time: "09:58", text: "Administración avisó de stock bajo de guantes de nitrilo", via: "Inventario" },
      { time: "09:31", text: "Recepción atendió una llamada y confirmó 2 citas", via: "Teléfono" },
    ],
  },
  "Sede Norte": {
    greetingName: "Marta",
    tasks: 27,
    kpis: { conversaciones: "29", citas: "11", leads: "4", horas: "2,8 h" },
    approvals: [
      { agent: "Comercial", tint: "#ffe8d6", fg: "#8e4e00", text: "Enviar presupuesto de ortodoncia a Javier R. · 1.900 €" },
      { agent: "Atención", tint: "#ffe8d6", fg: "#8e4e00", text: "Responder una reseña de 3★ en Google de Marta L." },
    ],
    agents: [
      { key: "recepcion", name: "Recepción", stack: "WhatsApp · Teléfono · Calendar", status: ACTIVE },
      { key: "atencion", name: "Atención al cliente", stack: "WhatsApp · Gmail", status: ACTIVE },
      { key: "comercial", name: "Comercial", stack: "CRM", status: ACTIVE },
      { key: "admin", name: "Administración", stack: "Facturación · Inventario", status: PAUSED },
    ],
    activity: [
      { time: "11:05", text: "Comercial registró un lead de Instagram y agendó una llamada", via: "Instagram → CRM" },
      { time: "10:28", text: "Recepción confirmó 3 primeras visitas para mañana", via: "WhatsApp" },
      { time: "09:47", text: "Atención resolvió una duda de financiación", via: "Gmail" },
    ],
  },
};

// Orden de agentes para la vista agregada.
const AGENT_ORDER = [
  { key: "recepcion", name: "Recepción", stack: "WhatsApp · Teléfono · Calendar" },
  { key: "atencion", name: "Atención al cliente", stack: "WhatsApp · Gmail · Instagram" },
  { key: "comercial", name: "Comercial", stack: "CRM" },
  { key: "admin", name: "Administración", stack: "Facturación · Inventario" },
];

const num = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const sedeKeys = Object.keys(DATA);

// «Todas las sedes»: agrega las sedes reales de la organización.
function aggregate() {
  const sum = (field) => sedeKeys.reduce((t, k) => t + num(DATA[k].kpis[field]), 0);
  const horas = sedeKeys.reduce((t, k) => t + num(DATA[k].kpis.horas), 0);
  const agents = AGENT_ORDER.map((a) => {
    const activeIn = sedeKeys.filter((k) => DATA[k].agents.find((x) => x.key === a.key)?.status === ACTIVE).length;
    const status = activeIn === 0 ? PAUSED : { label: `● Activo en ${activeIn} ${activeIn === 1 ? "sede" : "sedes"}`, bg: "#dcebdd", fg: "#004c39" };
    return { ...a, status };
  });
  const activity = sedeKeys
    .flatMap((k) => DATA[k].activity.map((e) => ({ ...e, sede: k })))
    .sort((a, b) => (a.time < b.time ? 1 : -1))
    .slice(0, 5);
  return {
    greetingName: "Marta",
    tasks: sedeKeys.reduce((t, k) => t + DATA[k].tasks, 0),
    kpis: {
      conversaciones: String(sum("conversaciones")),
      citas: String(sum("citas")),
      leads: String(sum("leads")),
      horas: `${horas.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`,
    },
    approvals: sedeKeys.flatMap((k) => DATA[k].approvals.map((a) => ({ ...a, sede: k }))),
    agents,
    activity,
    aggregated: true,
  };
}

export const AGENT_DOT = AGENT_COLOR;

export function dashboardFor(sede) {
  if (sede === SEDE_ALL) return aggregate();
  return DATA[sede] ?? DATA["Sede Centro"];
}

// Nº de aprobaciones pendientes para el contador del menú lateral.
export function approvalsCount(sede) {
  return dashboardFor(sede).approvals.length;
}

// ---------------------------------------------------------------------------
// Datos por sede del resto de páginas del panel. Misma idea: cada sede tiene los
// suyos; «Todas las sedes» agrega (suma de totales, unión de listas con su etiqueta).
// Centro = datos actuales del prototipo; Norte = una sede más pequeña y distinta.
// ---------------------------------------------------------------------------

const AV = { sage: "#a3c2a7", mist: "#9dbecc", coral: "#ffbab5", linen: "#f6f2e8" };

// ----- CLIENTES -----
const CLIENTES = {
  "Sede Centro": {
    count: "4.271",
    list: [
      { initials: "LM", color: AV.sage, name: "Laura Martín", sub: "Cita jue 10:30 · WhatsApp", active: true },
      { initials: "PG", color: AV.mist, name: "Pedro García", sub: "Reseña pendiente de respuesta", flag: "!" },
      { initials: "AT", color: AV.coral, name: "Ana Torres", sub: "Presupuesto de ortodoncia enviado" },
      { initials: "JL", color: AV.linen, name: "Jorge López", sub: "Última visita hace 7 meses" },
      { initials: "SP", color: AV.linen, name: "Sara Pérez", sub: "Cita mar 9:30 · Llamada" },
    ],
    detail: {
      initials: "LM", color: AV.sage, name: "Laura Martín",
      meta: "+34 6•• ••• 812 · laura.martin@gmail.com · Cliente desde 2021",
      tags: ["✓ Consentimiento WhatsApp", "Prefiere mañanas", "Dra. Ruiz"],
      stats: { Visitas: "42", Facturado: "427 €", Ausencias: "0", "Próxima cita": "Jue 10:30" },
      history: [
        { color: "#8e4e00", text: "Factura F-0412 preparada · pendiente de aprobación", time: "Hoy 11:02" },
        { color: "#004c39", text: "Cita reservada por WhatsApp: limpieza, jue 10:30", time: "Hoy 10:42" },
        { color: "#9dbecc", text: "Preguntó por el precio del blanqueamiento", time: "12 sep" },
        { color: "#000000", text: "Visita: revisión con la Dra. Ruiz", time: "3 mar" },
      ],
    },
  },
  "Sede Norte": {
    count: "1.830",
    list: [
      { initials: "JR", color: AV.sage, name: "Javier Ramos", sub: "Presupuesto ortodoncia · 1.900 €", active: true },
      { initials: "ML", color: AV.mist, name: "Marta Lillo", sub: "Reseña de 3★ pendiente", flag: "!" },
      { initials: "DC", color: AV.coral, name: "Diego Cuevas", sub: "Cita mié 17:00 · Instagram" },
      { initials: "NF", color: AV.linen, name: "Nuria Ferrer", sub: "Última visita hace 9 meses" },
    ],
    detail: {
      initials: "JR", color: AV.sage, name: "Javier Ramos",
      meta: "+34 6•• ••• 204 · javier.ramos@gmail.com · Cliente desde 2023",
      tags: ["✓ Consentimiento WhatsApp", "Prefiere tardes", "Dr. Soler"],
      stats: { Visitas: "11", Facturado: "190 €", Ausencias: "1", "Próxima cita": "—" },
      history: [
        { color: "#8e4e00", text: "Presupuesto de ortodoncia preparado · 1.900 €", time: "Hoy 09:40" },
        { color: "#a30042", text: "Lead de Instagram · interesado en ortodoncia invisible", time: "Ayer 18:12" },
        { color: "#000000", text: "Primera visita: estudio ortodóncico", time: "2 ago" },
      ],
    },
  },
};

// ----- LEADS -----
const LEADS = {
  "Sede Centro": {
    open: "42", budget: "4.271 €",
    columns: [
      { title: "Nuevos", count: 4, cards: [
        { name: "Marc Puig", sub: "Preguntó por implantes", via: "WhatsApp", when: "hace 1 h" },
        { name: "Elena Gil", sub: "Formulario web: blanqueamiento", via: "Web", when: "hace 3 h" },
      ]},
      { title: "Cualificados", count: 3, cards: [
        { name: "Ana Torres", sub: "Ortodoncia · primera visita reservada", tag: "✓ Cita jue 12:00", tagBg: "#dcebdd", tagFg: "#004c39" },
        { name: "Raúl Sanz", sub: "Estética dental · presupuesto aprox.", via: "Instagram" },
      ]},
      { title: "En seguimiento", count: 5, cards: [
        { name: "Grupo familiar Ortiz", sub: "Presupuesto ortodoncia x2 · 4.271 €", note: "Comercial escribirá mañana (día 3)", pill: "Mañana" },
        { name: "Luis Cano", sub: "Implante · 4.271 €", tag: "! Pide pago a plazos", tagBg: "#ffe8d6", tagFg: "#8e4e00" },
      ]},
      { title: "Ganados este mes", count: 6, cards: [
        { name: "Iván Rubio", sub: "Endodoncia aceptada · 427 €", note: "Tras 2 seguimientos del agente" },
        { won: true, label: "Ganado gracias a Comercial", value: "4.271 €" },
      ]},
    ],
  },
  "Sede Norte": {
    open: "18", budget: "2.400 €",
    columns: [
      { title: "Nuevos", count: 2, cards: [
        { name: "Clara Vidal", sub: "Preguntó por ortodoncia invisible", via: "Instagram", when: "hace 2 h" },
      ]},
      { title: "Cualificados", count: 2, cards: [
        { name: "Javier Ramos", sub: "Ortodoncia · estudio hecho", tag: "✓ Presupuesto enviado", tagBg: "#dcebdd", tagFg: "#004c39" },
      ]},
      { title: "En seguimiento", count: 3, cards: [
        { name: "Diego Cuevas", sub: "Blanqueamiento · 240 €", note: "Comercial escribirá el jueves", pill: "Jueves" },
      ]},
      { title: "Ganados este mes", count: 2, cards: [
        { name: "Nuria Ferrer", sub: "Limpieza + revisión · 90 €" },
        { won: true, label: "Ganado gracias a Comercial", value: "2.400 €" },
      ]},
    ],
  },
};

// ----- FACTURAS -----
const FACTURAS = {
  "Sede Centro": {
    cards: { porAprobar: "6", enviadas: "427", pendiente: "4.271 €", cobrado: "42.718 €" },
    invoices: [
      { id: "F-0101", client: "Laura Martín", amount: "42,71 €", via: "WhatsApp" },
      { id: "F-0102", client: "Seguros Salud+", amount: "427,18 €", via: "Email" },
      { id: "F-0103", client: "Iván Rubio", amount: "427,18 €", via: "Email" },
      { id: "F-0104", client: "Sara Pérez", amount: "42,71 €", via: "WhatsApp" },
    ],
    stock: [
      { name: "Guantes de nitrilo M", left: "Quedan 2 cajas", leftColor: "#a30042", pct: 15, bar: "#a30042", note: "Pedido preparado: 10 cajas a DentalPro", action: "Aprobar pedido" },
      { name: "Anestesia local", left: "Quedan 12", leftColor: "#8e4e00", pct: 35, bar: "#8e4e00", note: "Se pedirá cuando queden 8" },
    ],
  },
  "Sede Norte": {
    cards: { porAprobar: "3", enviadas: "198", pendiente: "2.400 €", cobrado: "19.040 €" },
    invoices: [
      { id: "F-0210", client: "Javier Ramos", amount: "190,00 €", via: "WhatsApp" },
      { id: "F-0211", client: "Mutua Dental Norte", amount: "640,00 €", via: "Email" },
      { id: "F-0212", client: "Diego Cuevas", amount: "120,00 €", via: "WhatsApp" },
    ],
    stock: [
      { name: "Fresas de diamante", left: "Quedan 3", leftColor: "#a30042", pct: 18, bar: "#a30042", note: "Pedido preparado: 20 uds a DentalPro", action: "Aprobar pedido" },
    ],
  },
};

// ----- INFORMES -----
const INFORMES = {
  "Sede Centro": {
    hours: "42 h", heroSub: "Equivale a 4 jornadas de recepción. +42% respecto a agosto.",
    stats: { "Conversaciones atendidas": "427", "Fuera de horario": "42%", "Citas reservadas": "427", "Ausencias evitadas": "42", "Respuesta media": "42 s", "Ingresos de citas del agente": "4.271 €" },
    bars: [55, 68, 74, 88], barLabels: ["1–7 sep", "8–14 sep", "15–21 sep", "22–28 sep"],
    channels: [{ name: "WhatsApp", pct: 62 }, { name: "Teléfono", pct: 21 }, { name: "Email", pct: 11 }, { name: "Instagram", pct: 6 }],
    tip: "el 42% de las reservas llega después de las 20:00.",
    agents: [
      { key: "recepcion", name: "Recepción", tasks: "427", solo: "42%", approve: "4%", human: "4%" },
      { key: "atencion", name: "Atención al cliente", tasks: "427", solo: "42%", approve: "4%", human: "4%" },
      { key: "admin", name: "Administración", tasks: "42", solo: "42%", approve: "42%", human: "4%" },
    ],
  },
  "Sede Norte": {
    hours: "26 h", heroSub: "Equivale a 2,5 jornadas de recepción. +31% respecto a agosto.",
    stats: { "Conversaciones atendidas": "243", "Fuera de horario": "38%", "Citas reservadas": "211", "Ausencias evitadas": "24", "Respuesta media": "51 s", "Ingresos de citas del agente": "2.400 €" },
    bars: [40, 52, 61, 70], barLabels: ["1–7 sep", "8–14 sep", "15–21 sep", "22–28 sep"],
    channels: [{ name: "WhatsApp", pct: 54 }, { name: "Teléfono", pct: 18 }, { name: "Email", pct: 10 }, { name: "Instagram", pct: 18 }],
    tip: "el 38% de las reservas llega fuera del horario de la clínica.",
    agents: [
      { key: "recepcion", name: "Recepción", tasks: "243", solo: "39%", approve: "5%", human: "5%" },
      { key: "atencion", name: "Atención al cliente", tasks: "198", solo: "41%", approve: "4%", human: "6%" },
      { key: "comercial", name: "Comercial", tasks: "64", solo: "28%", approve: "12%", human: "8%" },
    ],
  },
};

const AGENT_TABLE_COLOR = { recepcion: "#004c39", atencion: "#9dbecc", comercial: "#a30042", admin: "#8e4e00" };
export { AGENT_TABLE_COLOR };

const PAGES = { clientes: CLIENTES, leads: LEADS, facturas: FACTURAS, informes: INFORMES };

// Devuelve los datos de una página para la sede activa. Para «Todas las sedes»
// agrega con el constructor propio de cada página.
export function pageData(page, sede) {
  const byPage = PAGES[page];
  if (!byPage) return null;
  if (sede !== SEDE_ALL) return byPage[sede] ?? byPage["Sede Centro"];
  return AGG[page] ? AGG[page](byPage) : byPage["Sede Centro"];
}

const sum = (...xs) => xs.reduce((t, x) => t + (parseFloat(String(x).replace(/\./g, "").replace(/[^\d.-]/g, "")) || 0), 0);
const eur = (n) => `${n.toLocaleString("es-ES")} €`;
const keys = ["Sede Centro", "Sede Norte"];

// Agregadores de «Todas las sedes» por página.
const AGG = {
  clientes: (p) => ({
    count: sum(p["Sede Centro"].count, p["Sede Norte"].count).toLocaleString("es-ES"),
    list: keys.flatMap((k) => p[k].list.map((c) => ({ ...c, active: false, sede: k }))),
    detail: p["Sede Centro"].detail,
  }),
  leads: (p) => ({
    open: String(sum(p["Sede Centro"].open, p["Sede Norte"].open)),
    budget: eur(sum(p["Sede Centro"].budget, p["Sede Norte"].budget)),
    columns: p["Sede Centro"].columns.map((col, i) => {
      const other = p["Sede Norte"].columns[i];
      return { title: col.title, count: col.count + (other?.count ?? 0), cards: [...col.cards, ...(other?.cards ?? [])] };
    }),
  }),
  facturas: (p) => ({
    cards: {
      porAprobar: String(sum(p["Sede Centro"].cards.porAprobar, p["Sede Norte"].cards.porAprobar)),
      enviadas: String(sum(p["Sede Centro"].cards.enviadas, p["Sede Norte"].cards.enviadas)),
      pendiente: eur(sum(p["Sede Centro"].cards.pendiente, p["Sede Norte"].cards.pendiente)),
      cobrado: eur(sum(p["Sede Centro"].cards.cobrado, p["Sede Norte"].cards.cobrado)),
    },
    invoices: keys.flatMap((k) => p[k].invoices.map((inv) => ({ ...inv, sede: k }))),
    stock: keys.flatMap((k) => p[k].stock.map((s) => ({ ...s, sede: k }))),
  }),
  informes: (p) => {
    const c = p["Sede Centro"], n = p["Sede Norte"];
    const statSum = (field) => {
      const a = c.stats[field], b = n.stats[field];
      if (String(a).includes("%") || String(a).includes("s")) return a; // medias: no se suman
      const t = sum(a, b);
      return String(a).includes("€") ? eur(t) : t.toLocaleString("es-ES");
    };
    const stats = {};
    Object.keys(c.stats).forEach((k) => (stats[k] = statSum(k)));
    return {
      hours: `${sum(c.hours, n.hours)} h`, heroSub: "Suma de todas las sedes de la organización.",
      stats, bars: c.bars.map((v, i) => Math.round((v + n.bars[i]) / 2)), barLabels: c.barLabels,
      channels: c.channels, tip: c.tip,
      agents: c.agents,
    };
  },
};

// ----- AGENDA ----- (eventos del calendario semanal por sede)
// col: columna del día (2=Lun … 6=Vie). rs/re: fila inicio/fin (grid-row).
const AGENDA = {
  "Sede Centro": {
    pro: "Todos los profesionales",
    events: [
      { col: 2, rs: 2, re: 4, bg: "#a3c2a7", title: "Ana T. · Blanqueamiento", sub: "Dr. Vidal · WhatsApp" },
      { col: 2, rs: 5, re: 7, bg: "#ffffff", border: true, title: "Jorge L. · Revisión", sub: "Dra. Ruiz", subMuted: true },
      { col: 2, rs: 8, re: 9, bg: "#a3c2a7", title: "Pedro G. · Urgencia" },
      { col: 3, rs: 3, re: 5, bg: "#a3c2a7", title: "Sara P. · Ortodoncia", sub: "Dr. Vidal · Llamada" },
      { col: 3, rs: 9, re: 12, bg: "#ffffff", border: true, title: "Bloqueado · Formación", sub: "Todo el equipo", subMuted: true },
      { col: 4, rs: 2, re: 3, bg: "#a3c2a7", title: "Luis C. · Revisión" },
      { col: 4, rs: 6, re: 8, bg: "#a3c2a7", title: "Marta S. · Implante", sub: "Dra. Ruiz · Instagram" },
      { col: 5, rs: 4, re: 6, bg: "#a3c2a7", title: "Laura M. · Limpieza", sub: "Dra. Ruiz · WhatsApp", ring: true },
      { col: 5, rs: 8, re: 10, bg: "#a3c2a7", title: "Nuria F. · Revisión", sub: "Dr. Vidal · Llamada" },
      { col: 6, rs: 3, re: 5, bg: "#ffe8d6", fg: "#8e4e00", title: "! 3 citas a mover", sub: "Baja Dra. Ruiz" },
      { col: 6, rs: 7, re: 9, bg: "#a3c2a7", title: "Iván R. · Endodoncia", sub: "Dr. Vidal · WhatsApp" },
    ],
    booked: "reservó 42 citas", reminders: "y envió 42 recordatorios.",
    waitlist: { strong: "Huecos libres el martes por la tarde.", rest: "Recepción puede avisar a los 5 pacientes en lista de espera." },
  },
  "Sede Norte": {
    pro: "Todos los profesionales",
    events: [
      { col: 2, rs: 2, re: 4, bg: "#a3c2a7", title: "Clara V. · Ortodoncia", sub: "Dr. Soler · Instagram" },
      { col: 2, rs: 6, re: 8, bg: "#a3c2a7", title: "Diego C. · Blanqueamiento", sub: "Dr. Soler · WhatsApp" },
      { col: 3, rs: 4, re: 6, bg: "#ffffff", border: true, title: "Bloqueado · Reunión", sub: "Equipo", subMuted: true },
      { col: 4, rs: 3, re: 5, bg: "#a3c2a7", title: "Javier R. · Estudio orto.", sub: "Dr. Soler · WhatsApp", ring: true },
      { col: 5, rs: 5, re: 7, bg: "#ffe8d6", fg: "#8e4e00", title: "! Hueco sin cubrir", sub: "Avisar lista de espera" },
      { col: 6, rs: 6, re: 8, bg: "#a3c2a7", title: "Nuria F. · Revisión", sub: "Dr. Soler · Llamada" },
    ],
    booked: "reservó 21 citas", reminders: "y envió 21 recordatorios.",
    waitlist: { strong: "La mañana del jueves está casi completa.", rest: "Recepción avisará si se libera algún hueco a los 3 en espera." },
  },
};
AGENDA["Todas las sedes"] = {
  pro: "Todas las sedes",
  events: AGENDA["Sede Centro"].events,
  booked: "reservó 63 citas", reminders: "y envió 63 recordatorios, sumando las sedes.",
  waitlist: { strong: "Vista combinada de la organización.", rest: "Cambia a una sede para ver y mover sus citas." },
};

// ----- CONVERSACIONES ----- (lista + conversación activa + ficha del CRM)
const CONVS = {
  "Sede Centro": {
    list: [
      { name: "Laura M.", time: "10:42", preview: "Hecho: jueves a las 10:30 con la Dra. Ruiz…", meta: "WhatsApp · Recepción · ✓ Resuelta", active: true },
      { name: "Pedro G.", time: "10:20", preview: "Respuesta a reseña preparada, pendiente de tu OK", meta: "Google Reviews · Atención · ! Aprobación", metaColor: "#8e4e00" },
      { name: "Ana T.", time: "09:51", preview: "¿Cuánto cuesta un blanqueamiento?", meta: "Instagram · Atención · ✓ Resuelta" },
      { name: "+34 6•• ••• 812", time: "09:31", preview: "Llamada: confirmadas 2 citas", meta: "Teléfono · Recepción · ✓ Resuelta" },
      { name: "Seguros Salud+", time: "Ayer", preview: "Solicitud de factura del mes de septiembre", meta: "Gmail · Administración · En curso" },
    ],
    header: { name: "Laura M.", channel: "WhatsApp" },
    thread: [
      { from: "them", text: "Hola, ¿tenéis hueco para una limpieza dental esta semana?" },
      { from: "agent", text: "¡Hola, Laura! Tengo el jueves a las 10:30 o el viernes a las 17:00. ¿Cuál te viene mejor?" },
      { from: "them", text: "El jueves perfecto" },
      { from: "agent-actions", chips: [ { bg: "#9dbecc", text: "Calendar · Cita creada" }, { bg: "#a3c2a7", text: "CRM · Ficha actualizada" } ], text: "Hecho: jueves a las 10:30 con la Dra. Ruiz. Te enviaré un recordatorio el día antes." },
      { from: "them", text: "Genial, gracias. ¿Me podéis mandar la factura de la última visita?" },
      { from: "approval", text: "Administración ha preparado la factura F-0412 (75,00 €) para enviarla por WhatsApp." },
    ],
    crm: { initials: "LM", color: "#a3c2a7", name: "Laura M.", since: "Paciente desde 2021", rows: { "Próxima cita": "Jue 10:30", "Visitas": "5", "Profesional": "Dra. Ruiz" }, notes: ["Prefiere citas por la mañana", "Pide factura después de cada visita"] },
  },
  "Sede Norte": {
    list: [
      { name: "Javier R.", time: "09:40", preview: "Presupuesto de ortodoncia preparado, pendiente de tu OK", meta: "WhatsApp · Comercial · ! Aprobación", metaColor: "#8e4e00", active: true },
      { name: "Marta L.", time: "09:12", preview: "Reseña de 3★ preparada para responder", meta: "Google Reviews · Atención · ! Aprobación", metaColor: "#8e4e00" },
      { name: "Diego C.", time: "Ayer", preview: "¿Hacéis ortodoncia invisible?", meta: "Instagram · Atención · ✓ Resuelta" },
      { name: "+34 6•• ••• 204", time: "Ayer", preview: "Llamada: pedida cita para revisión", meta: "Teléfono · Recepción · ✓ Resuelta" },
    ],
    header: { name: "Javier R.", channel: "WhatsApp" },
    thread: [
      { from: "them", text: "Hola, me gustaría un presupuesto de ortodoncia invisible." },
      { from: "agent", text: "¡Hola, Javier! Con el estudio que te hicimos, te preparo el presupuesto. ¿Lo quieres con pago a plazos?" },
      { from: "them", text: "Sí, a plazos mejor." },
      { from: "agent-actions", chips: [ { bg: "#a3c2a7", text: "CRM · Lead actualizado" } ], text: "Perfecto, lo preparo con financiación a 12 meses y te lo paso enseguida." },
      { from: "approval", text: "Comercial ha preparado el presupuesto de ortodoncia (1.900 €) para enviarlo por WhatsApp." },
    ],
    crm: { initials: "JR", color: "#a3c2a7", name: "Javier R.", since: "Cliente desde 2023", rows: { "Próxima cita": "—", "Visitas": "1", "Profesional": "Dr. Soler" }, notes: ["Interesado en ortodoncia invisible", "Prefiere pago a plazos"] },
  },
};
CONVS["Todas las sedes"] = {
  list: [
    ...CONVS["Sede Centro"].list.map((c) => ({ ...c, active: false, sede: "Sede Centro" })),
    ...CONVS["Sede Norte"].list.map((c) => ({ ...c, active: false, sede: "Sede Norte" })),
  ].map((c, i) => ({ ...c, active: i === 0 })),
  header: CONVS["Sede Centro"].header,
  thread: CONVS["Sede Centro"].thread,
  crm: CONVS["Sede Centro"].crm,
};

export function agendaFor(sede) { return AGENDA[sede] ?? AGENDA["Sede Centro"]; }
export function convsFor(sede) { return CONVS[sede] ?? CONVS["Sede Centro"]; }
