import { SEDE_ALL } from "./use-sede";

// Datos del panel por sede (prototipo). La forma imita al backend: cada sede
// (location_id) tiene su propio conjunto, y «Todas las sedes» se calcula agregando.
// Números y textos son de ejemplo; cuando exista la API, esto se sustituye por la
// consulta real con el alcance (organización / región / local) del usuario.

// Colores de agente de la identidad Moodly (ver design system).
const AGENT_COLOR = { recepcion: "#004c39", atencion: "#9dbecc", comercial: "#a30042", admin: "#8e4e00" };
const ACTIVE = { label: "● Activo", bg: "var(--green-bg)", fg: "var(--green-fg)" };
const PAUSED = { label: "○ Pausado", bg: "var(--sunken)", fg: "var(--muted)" };

const DATA = {
  "Sede Centro": {
    greetingName: "Marta",
    tasks: 42,
    kpis: { conversaciones: "42", citas: "18", leads: "7", horas: "4,2 h" },
    approvals: [
      { agent: "Administración", tint: "var(--amber-bg)", fg: "var(--amber-fg)", text: "Enviar factura F-0412 a Laura M. · 75,00 €", id: "f0412" },
      { agent: "Atención", tint: "var(--amber-bg)", fg: "var(--amber-fg)", text: "Responder a una queja en Google Reviews de Pedro G.", id: "resena" },
      { agent: "Recepción", tint: "var(--amber-bg)", fg: "var(--amber-fg)", text: "Mover 3 citas del viernes por la baja de la Dra. Ruiz", id: "citas" },
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
      { agent: "Comercial", tint: "var(--amber-bg)", fg: "var(--amber-fg)", text: "Enviar presupuesto de ortodoncia a Javier R. · 1.900 €", id: "presu-javier" },
      { agent: "Atención", tint: "var(--amber-bg)", fg: "var(--amber-fg)", text: "Responder una reseña de 3★ en Google de Marta L.", id: "resena-marta" },
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
    const status = activeIn === 0 ? PAUSED : { label: `● Activo en ${activeIn} ${activeIn === 1 ? "sede" : "sedes"}`, bg: "var(--green-bg)", fg: "var(--green-fg)" };
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

const AV = { sage: "var(--sage)", mist: "var(--mist)", coral: "var(--coral)", linen: "var(--linen)" };

// ----- CLIENTES -----
const CLIENTES = {
  "Sede Centro": {
    count: "4.271",
    list: [
      { initials: "LM", color: AV.sage, seg: ["cita"], name: "Laura Martín", sub: "Cita jue 10:30 · WhatsApp", active: true },
      { initials: "PG", color: AV.mist, seg: [], name: "Pedro García", sub: "Reseña pendiente de respuesta", flag: "!" },
      { initials: "AT", color: AV.coral, seg: ["presupuesto"], name: "Ana Torres", sub: "Presupuesto de ortodoncia enviado" },
      { initials: "JL", color: AV.linen, seg: ["inactivo"], name: "Jorge López", sub: "Última visita hace 7 meses" },
      { initials: "SP", color: AV.linen, seg: ["cita"], name: "Sara Pérez", sub: "Cita mar 9:30 · Llamada" },
    ],
    detail: {
      initials: "LM", color: AV.sage, name: "Laura Martín",
      meta: "+34 6•• ••• 812 · laura.martin@gmail.com · Cliente desde 2021",
      tags: ["✓ Consentimiento WhatsApp", "Prefiere mañanas", "Dra. Ruiz"],
      stats: { Visitas: "42", Facturado: "427 €", Ausencias: "0", "Próxima cita": "Jue 10:30" },
      history: [
        { color: "var(--amber-fg)", text: "Factura F-0412 preparada · pendiente de aprobación", time: "Hoy 11:02" },
        { color: "var(--green-fg)", text: "Cita reservada por WhatsApp: limpieza, jue 10:30", time: "Hoy 10:42" },
        { color: "#9dbecc", text: "Preguntó por el precio del blanqueamiento", time: "12 sep" },
        { color: "var(--ink)", text: "Visita: revisión con la Dra. Ruiz", time: "3 mar" },
      ],
    },
  },
  "Sede Norte": {
    count: "1.830",
    list: [
      { initials: "JR", color: AV.sage, seg: ["presupuesto"], name: "Javier Ramos", sub: "Presupuesto ortodoncia · 1.900 €", active: true },
      { initials: "ML", color: AV.mist, seg: [], name: "Marta Lillo", sub: "Reseña de 3★ pendiente", flag: "!" },
      { initials: "DC", color: AV.coral, seg: ["cita"], name: "Diego Cuevas", sub: "Cita mié 17:00 · Instagram" },
      { initials: "NF", color: AV.linen, seg: ["inactivo"], name: "Nuria Ferrer", sub: "Última visita hace 9 meses" },
    ],
    detail: {
      initials: "JR", color: AV.sage, name: "Javier Ramos",
      meta: "+34 6•• ••• 204 · javier.ramos@gmail.com · Cliente desde 2023",
      tags: ["✓ Consentimiento WhatsApp", "Prefiere tardes", "Dr. Soler"],
      stats: { Visitas: "11", Facturado: "190 €", Ausencias: "1", "Próxima cita": "—" },
      history: [
        { color: "var(--amber-fg)", text: "Presupuesto de ortodoncia preparado · 1.900 €", time: "Hoy 09:40" },
        { color: "var(--rose-fg)", text: "Lead de Instagram · interesado en ortodoncia invisible", time: "Ayer 18:12" },
        { color: "var(--ink)", text: "Primera visita: estudio ortodóncico", time: "2 ago" },
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
        { name: "Ana Torres", via: "Instagram", sub: "Ortodoncia · primera visita reservada", tag: "✓ Cita jue 12:00", tagBg: "var(--green-bg)", tagFg: "var(--green-fg)" },
        { name: "Raúl Sanz", sub: "Estética dental · presupuesto aprox.", via: "Instagram" },
      ]},
      { title: "En seguimiento", count: 5, cards: [
        { name: "Grupo familiar Ortiz", via: "WhatsApp", sub: "Presupuesto ortodoncia x2 · 4.271 €", note: "Comercial escribirá mañana (día 3)", pill: "Mañana" },
        { name: "Luis Cano", via: "Web", sub: "Implante · 4.271 €", tag: "! Pide pago a plazos", tagBg: "var(--amber-bg)", tagFg: "var(--amber-fg)" },
      ]},
      { title: "Ganados este mes", count: 6, cards: [
        { name: "Iván Rubio", via: "WhatsApp", sub: "Endodoncia aceptada · 427 €", note: "Tras 2 seguimientos del agente" },
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
        { name: "Javier Ramos", via: "WhatsApp", sub: "Ortodoncia · estudio hecho", tag: "✓ Presupuesto enviado", tagBg: "var(--green-bg)", tagFg: "var(--green-fg)" },
      ]},
      { title: "En seguimiento", count: 3, cards: [
        { name: "Diego Cuevas", via: "Instagram", sub: "Blanqueamiento · 240 €", note: "Comercial escribirá el jueves", pill: "Jueves" },
      ]},
      { title: "Ganados este mes", count: 2, cards: [
        { name: "Nuria Ferrer", via: "WhatsApp", sub: "Limpieza + revisión · 90 €" },
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
      { id: "F-0412", client: "Laura Martín", amount: "75,00 €", via: "WhatsApp", status: "aprobar", date: "Hoy", approval: "f0412" },
      { id: "F-0102", client: "Seguros Salud+", amount: "427,18 €", via: "Email", status: "aprobar", date: "Hoy" },
      { id: "F-0103", client: "Iván Rubio", amount: "427,18 €", via: "Email", status: "aprobar", date: "Ayer" },
      { id: "F-0104", client: "Sara Pérez", amount: "42,71 €", via: "WhatsApp", status: "aprobar", date: "Ayer" },
      { id: "F-0105", client: "Pedro García", amount: "64,00 €", via: "Email", status: "aprobar", date: "Ayer" },
      { id: "F-0106", client: "Luis Cano", amount: "85,00 €", via: "WhatsApp", status: "aprobar", date: "Ayer" },
      { id: "F-0095", client: "Ana Torres", amount: "180,00 €", via: "WhatsApp", status: "enviada", date: "3 oct" },
      { id: "F-0094", client: "Jorge López", amount: "85,00 €", via: "Email", status: "enviada", date: "2 oct" },
      { id: "F-0090", client: "Marta S.", amount: "1.200,00 €", via: "Email", status: "cobrada", date: "29 sep" },
      { id: "F-0089", client: "Iván Rubio", amount: "427,18 €", via: "WhatsApp", status: "cobrada", date: "27 sep" },
    ],
    stock: [
      { name: "Guantes de nitrilo M", left: "Quedan 2 cajas", leftColor: "var(--rose-fg)", pct: 15, bar: "#a30042", note: "Pedido preparado: 10 cajas a DentalPro", action: "Aprobar pedido" },
      { name: "Anestesia local", left: "Quedan 12", leftColor: "var(--amber-fg)", pct: 35, bar: "#8e4e00", note: "Se pedirá cuando queden 8" },
    ],
    inventory: [
      { name: "Guantes de nitrilo M", qty: "2 cajas", min: "5 cajas", state: "bajo" },
      { name: "Anestesia local", qty: "12 uds", min: "8 uds", state: "atento" },
      { name: "Mascarillas FFP2", qty: "340 uds", min: "100 uds", state: "ok" },
      { name: "Composite A2", qty: "18 jeringas", min: "6 jeringas", state: "ok" },
      { name: "Fresas de diamante", qty: "24 uds", min: "10 uds", state: "ok" },
    ],
  },
  "Sede Norte": {
    cards: { porAprobar: "3", enviadas: "198", pendiente: "2.400 €", cobrado: "19.040 €" },
    invoices: [
      { id: "F-0210", client: "Javier Ramos", amount: "190,00 €", via: "WhatsApp", status: "aprobar", date: "Hoy" },
      { id: "F-0211", client: "Mutua Dental Norte", amount: "640,00 €", via: "Email", status: "aprobar", date: "Hoy" },
      { id: "F-0212", client: "Diego Cuevas", amount: "120,00 €", via: "WhatsApp", status: "aprobar", date: "Ayer" },
      { id: "F-0205", client: "Clara Vidal", amount: "60,00 €", via: "WhatsApp", status: "enviada", date: "4 oct" },
      { id: "F-0201", client: "Nuria Ferrer", amount: "90,00 €", via: "Email", status: "cobrada", date: "30 sep" },
    ],
    stock: [
      { name: "Fresas de diamante", left: "Quedan 3", leftColor: "var(--rose-fg)", pct: 18, bar: "#a30042", note: "Pedido preparado: 20 uds a DentalPro", action: "Aprobar pedido" },
    ],
    inventory: [
      { name: "Fresas de diamante", qty: "3 uds", min: "10 uds", state: "bajo" },
      { name: "Guantes de nitrilo M", qty: "9 cajas", min: "5 cajas", state: "ok" },
      { name: "Anestesia local", qty: "20 uds", min: "8 uds", state: "ok" },
      { name: "Alineadores (kits)", qty: "4 kits", min: "3 kits", state: "atento" },
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
    inventory: keys.flatMap((k) => p[k].inventory.map((s) => ({ ...s, sede: k }))),
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
      { col: 2, rs: 2, re: 4, bg: "var(--sage)", title: "Ana T. · Blanqueamiento", sub: "Dr. Vidal · WhatsApp" },
      { col: 2, rs: 5, re: 7, bg: "var(--paper)", border: true, title: "Jorge L. · Revisión", sub: "Dra. Ruiz", subMuted: true },
      { col: 2, rs: 8, re: 9, bg: "var(--sage)", title: "Pedro G. · Urgencia" },
      { col: 3, rs: 3, re: 5, bg: "var(--sage)", title: "Sara P. · Ortodoncia", sub: "Dr. Vidal · Llamada" },
      { col: 3, rs: 9, re: 12, bg: "var(--paper)", border: true, title: "Bloqueado · Formación", sub: "Todo el equipo", subMuted: true },
      { col: 4, rs: 2, re: 3, bg: "var(--sage)", title: "Luis C. · Revisión" },
      { col: 4, rs: 6, re: 8, bg: "var(--sage)", title: "Marta S. · Implante", sub: "Dra. Ruiz · Instagram" },
      { col: 5, rs: 4, re: 6, bg: "var(--sage)", title: "Laura M. · Limpieza", sub: "Dra. Ruiz · WhatsApp", ring: true },
      { col: 5, rs: 8, re: 10, bg: "var(--sage)", title: "Nuria F. · Revisión", sub: "Dr. Vidal · Llamada" },
      { col: 6, rs: 3, re: 5, bg: "var(--amber-bg)", fg: "var(--amber-fg)", title: "! 3 citas a mover", sub: "Baja Dra. Ruiz" },
      { col: 6, rs: 7, re: 9, bg: "var(--sage)", title: "Iván R. · Endodoncia", sub: "Dr. Vidal · WhatsApp" },
    ],
    booked: "reservó 42 citas", reminders: "y envió 42 recordatorios.",
    waitlist: { strong: "Huecos libres el martes por la tarde.", rest: "Recepción puede avisar a los 5 pacientes en lista de espera." },
  },
  "Sede Norte": {
    pro: "Todos los profesionales",
    events: [
      { col: 2, rs: 2, re: 4, bg: "var(--sage)", title: "Clara V. · Ortodoncia", sub: "Dr. Soler · Instagram" },
      { col: 2, rs: 6, re: 8, bg: "var(--sage)", title: "Diego C. · Blanqueamiento", sub: "Dr. Soler · WhatsApp" },
      { col: 3, rs: 4, re: 6, bg: "var(--paper)", border: true, title: "Bloqueado · Reunión", sub: "Equipo", subMuted: true },
      { col: 4, rs: 3, re: 5, bg: "var(--sage)", title: "Javier R. · Estudio orto.", sub: "Dr. Soler · WhatsApp", ring: true },
      { col: 5, rs: 5, re: 7, bg: "var(--amber-bg)", fg: "var(--amber-fg)", title: "! Hueco sin cubrir", sub: "Avisar lista de espera" },
      { col: 6, rs: 6, re: 8, bg: "var(--sage)", title: "Nuria F. · Revisión", sub: "Dr. Soler · Llamada" },
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
      { name: "Pedro G.", time: "10:20", preview: "Respuesta a reseña preparada, pendiente de tu OK", meta: "Google Reviews · Atención · ! Aprobación", metaColor: "var(--amber-fg)" },
      { name: "Ana T.", time: "09:51", preview: "¿Cuánto cuesta un blanqueamiento?", meta: "Instagram · Atención · ✓ Resuelta" },
      { name: "+34 6•• ••• 812", time: "09:31", preview: "Llamada: confirmadas 2 citas", meta: "Teléfono · Recepción · ✓ Resuelta" },
      { name: "Seguros Salud+", time: "Ayer", preview: "Solicitud de factura del mes de septiembre", meta: "Gmail · Administración · En curso" },
    ],
    header: { name: "Laura M.", channel: "WhatsApp" },
    thread: [
      { from: "them", text: "Hola, ¿tenéis hueco para una limpieza dental esta semana?" },
      { from: "agent", text: "¡Hola, Laura! Tengo el jueves a las 10:30 o el viernes a las 17:00. ¿Cuál te viene mejor?" },
      { from: "them", text: "El jueves perfecto" },
      { from: "agent-actions", chips: [ { bg: "var(--mist)", text: "Calendar · Cita creada" }, { bg: "var(--sage)", text: "CRM · Ficha actualizada" } ], text: "Hecho: jueves a las 10:30 con la Dra. Ruiz. Te enviaré un recordatorio el día antes." },
      { from: "them", text: "Genial, gracias. ¿Me podéis mandar la factura de la última visita?" },
      { from: "approval", id: "f0412", text: "Administración ha preparado la factura F-0412 (75,00 €) para enviarla por WhatsApp." },
    ],
    crm: { initials: "LM", color: "var(--sage)", name: "Laura M.", since: "Paciente desde 2021", rows: { "Próxima cita": "Jue 10:30", "Visitas": "5", "Profesional": "Dra. Ruiz" }, notes: ["Prefiere citas por la mañana", "Pide factura después de cada visita"] },
  },
  "Sede Norte": {
    list: [
      { name: "Javier R.", time: "09:40", preview: "Presupuesto de ortodoncia preparado, pendiente de tu OK", meta: "WhatsApp · Comercial · ! Aprobación", metaColor: "var(--amber-fg)", active: true },
      { name: "Marta L.", time: "09:12", preview: "Reseña de 3★ preparada para responder", meta: "Google Reviews · Atención · ! Aprobación", metaColor: "var(--amber-fg)" },
      { name: "Diego C.", time: "Ayer", preview: "¿Hacéis ortodoncia invisible?", meta: "Instagram · Atención · ✓ Resuelta" },
      { name: "+34 6•• ••• 204", time: "Ayer", preview: "Llamada: pedida cita para revisión", meta: "Teléfono · Recepción · ✓ Resuelta" },
    ],
    header: { name: "Javier R.", channel: "WhatsApp" },
    thread: [
      { from: "them", text: "Hola, me gustaría un presupuesto de ortodoncia invisible." },
      { from: "agent", text: "¡Hola, Javier! Con el estudio que te hicimos, te preparo el presupuesto. ¿Lo quieres con pago a plazos?" },
      { from: "them", text: "Sí, a plazos mejor." },
      { from: "agent-actions", chips: [ { bg: "var(--sage)", text: "CRM · Lead actualizado" } ], text: "Perfecto, lo preparo con financiación a 12 meses y te lo paso enseguida." },
      { from: "approval", id: "presu-javier", text: "Comercial ha preparado el presupuesto de ortodoncia (1.900 €) para enviarlo por WhatsApp." },
    ],
    crm: { initials: "JR", color: "var(--sage)", name: "Javier R.", since: "Cliente desde 2023", rows: { "Próxima cita": "—", "Visitas": "1", "Profesional": "Dr. Soler" }, notes: ["Interesado en ortodoncia invisible", "Prefiere pago a plazos"] },
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

// ---------------------------------------------------------------------------
// FICHAS POR ELEMENTO — cada fila de una lista tiene su propio detalle.
// Las páginas maestro-detalle (Clientes, Conversaciones, Llamadas) seleccionan una
// fila y piden aquí su ficha. TODO(backend): sustituir por consultas por id.
// ---------------------------------------------------------------------------

const CLIENT_DETAILS = {
  "Pedro García": {
    meta: "+34 6•• ••• 233 · pedro.garcia@gmail.com · Cliente desde 2019",
    tags: ["✓ Consentimiento WhatsApp", "Reseña pendiente", "Dr. Vidal"],
    stats: { Visitas: "18", Facturado: "1.240 €", Ausencias: "2", "Próxima cita": "—" },
    history: [
      { color: "var(--amber-fg)", text: "Respuesta a su reseña de 3★ preparada · pendiente de tu OK", time: "Hoy 10:20" },
      { color: "var(--ink)", text: "Urgencia atendida: dolor de muela", time: "Lun" },
      { color: "var(--ink)", text: "Visita: empaste con el Dr. Vidal", time: "22 sep" },
    ],
  },
  "Ana Torres": {
    meta: "+34 6•• ••• 590 · ana.torres@gmail.com · Cliente desde 2024",
    tags: ["✓ Consentimiento WhatsApp", "Presupuesto enviado", "Dr. Vidal"],
    stats: { Visitas: "3", Facturado: "180 €", Ausencias: "0", "Próxima cita": "Jue 12:00" },
    history: [
      { color: "var(--rose-fg)", text: "Presupuesto de ortodoncia enviado por Comercial · 3.200 €", time: "Ayer" },
      { color: "var(--green-fg)", text: "Primera visita reservada: jue 12:00", time: "2 oct" },
      { color: "#9dbecc", text: "Preguntó por el blanqueamiento por Instagram", time: "28 sep" },
    ],
  },
  "Jorge López": {
    meta: "+34 6•• ••• 118 · Sin email · Cliente desde 2017",
    tags: ["Sin consentimiento WhatsApp", "Prefiere llamadas", "Dra. Ruiz"],
    stats: { Visitas: "9", Facturado: "640 €", Ausencias: "1", "Próxima cita": "—" },
    history: [
      { color: "var(--amber-fg)", text: "Llamada pasada a Carmen: queja por una factura", time: "Hoy 09:47" },
      { color: "var(--green-fg)", text: "Recordatorio de revisión anual enviado", time: "12 ago" },
      { color: "var(--ink)", text: "Visita: revisión con la Dra. Ruiz", time: "14 mar" },
    ],
  },
  "Sara Pérez": {
    meta: "+34 6•• ••• 761 · sara.perez@gmail.com · Cliente desde 2022",
    tags: ["✓ Consentimiento WhatsApp", "Prefiere mañanas", "Dr. Vidal"],
    stats: { Visitas: "6", Facturado: "390 €", Ausencias: "0", "Próxima cita": "Mar 9:30" },
    history: [
      { color: "var(--green-fg)", text: "Llamada: reservó revisión el martes 9:30", time: "Hoy 10:31" },
      { color: "#9dbecc", text: "Confirmación enviada por WhatsApp", time: "Hoy 10:33" },
      { color: "var(--ink)", text: "Visita: ajuste de ortodoncia", time: "5 sep" },
    ],
  },
  "Marta Lillo": {
    meta: "+34 6•• ••• 342 · marta.lillo@gmail.com · Cliente desde 2021",
    tags: ["✓ Consentimiento WhatsApp", "Reseña 3★ pendiente", "Dr. Soler"],
    stats: { Visitas: "7", Facturado: "520 €", Ausencias: "0", "Próxima cita": "—" },
    history: [
      { color: "var(--amber-fg)", text: "Respuesta a su reseña de 3★ preparada · pendiente de tu OK", time: "Hoy 09:12" },
      { color: "var(--ink)", text: "Visita: limpieza con el Dr. Soler", time: "30 sep" },
    ],
  },
  "Diego Cuevas": {
    meta: "+34 6•• ••• 905 · @diegocuevas (Instagram) · Cliente desde 2025",
    tags: ["✓ Consentimiento WhatsApp", "Llegó por Instagram", "Dr. Soler"],
    stats: { Visitas: "2", Facturado: "120 €", Ausencias: "0", "Próxima cita": "Mié 17:00" },
    history: [
      { color: "var(--green-fg)", text: "Cita reservada: blanqueamiento, mié 17:00", time: "Ayer" },
      { color: "#9dbecc", text: "Preguntó por la ortodoncia invisible", time: "Ayer" },
    ],
  },
  "Nuria Ferrer": {
    meta: "+34 6•• ••• 477 · nuria.ferrer@gmail.com · Cliente desde 2020",
    tags: ["✓ Consentimiento WhatsApp", "Vuelve tras 9 meses", "Dr. Soler"],
    stats: { Visitas: "12", Facturado: "860 €", Ausencias: "1", "Próxima cita": "Hoy 17:30" },
    history: [
      { color: "var(--green-fg)", text: "Llamada: confirmó la cita de hoy", time: "Hoy 09:20" },
      { color: "var(--green-fg)", text: "Recepción la recuperó con el aviso de revisión", time: "6 oct" },
      { color: "var(--ink)", text: "Última visita: limpieza", time: "Ene" },
    ],
  },
};

// Ficha de un cliente de la lista: la detallada si existe; si no, una coherente
// derivada de su fila (para que ninguna fila quede sin ficha).
export function clientDetail(c) {
  if (!c) return null;
  const sedeDetail = Object.values(CLIENTES).map((x) => x.detail).find((x) => x.name === c.name);
  const extra = CLIENT_DETAILS[c.name];
  const base = sedeDetail ?? {
    meta: "Ficha creada por tus agentes",
    tags: ["Sin etiquetas aún"],
    stats: { Visitas: "—", Facturado: "—", Ausencias: "—", "Próxima cita": "—" },
    history: [{ color: "var(--ink)", text: c.sub, time: "Reciente" }],
  };
  return { ...base, ...extra, initials: c.initials, color: c.color, name: c.name };
}

// Estado de una conversación a partir de su meta (para los filtros de la bandeja).
export function convStatus(c) {
  if (/Resuelta/.test(c.meta)) return "resuelta";
  return "atencion"; // ! Aprobación · En curso
}

const CONV_DETAILS = {
  "Pedro G.": {
    client: "Pedro García", channel: "Google Reviews",
    thread: [
      { from: "them", text: "★★★☆☆ «Me atendieron bien, pero esperé 40 minutos en la sala.»" },
      { from: "approval", id: "resena", text: "Atención ha preparado una respuesta pública a la reseña de Pedro, disculpándose por la espera." },
    ],
    crm: { initials: "PG", color: "var(--mist)", since: "Paciente desde 2019", rows: { "Próxima cita": "—", "Visitas": "18", "Profesional": "Dr. Vidal" }, notes: ["Le molestan las esperas", "Valora que le llamen por su nombre"] },
  },
  "Ana T.": {
    client: "Ana Torres", channel: "Instagram",
    thread: [
      { from: "them", text: "Hola, ¿cuánto cuesta un blanqueamiento?" },
      { from: "agent", text: "¡Hola, Ana! El blanqueamiento en clínica está en 240 €. Si quieres, te lo valoran en tu próxima visita del jueves." },
      { from: "them", text: "Vale, lo hablo el jueves. ¡Gracias!" },
    ],
    crm: { initials: "AT", color: "var(--coral)", since: "Paciente desde 2024", rows: { "Próxima cita": "Jue 12:00", "Visitas": "3", "Profesional": "Dr. Vidal" }, notes: ["Interesada en estética dental", "Tiene presupuesto de ortodoncia enviado"] },
  },
  "+34 6•• ••• 812": {
    client: null, channel: "Teléfono",
    thread: [
      { from: "them", text: "(Llamada) Quería confirmar las citas de mis dos hijos para el viernes." },
      { from: "agent-actions", chips: [{ bg: "var(--mist)", text: "Calendar · 2 citas confirmadas" }], text: "Confirmadas las dos citas del viernes a las 17:00 y 17:30. Os enviamos recordatorio el jueves." },
    ],
    crm: { initials: "?", color: "var(--linen)", since: "Contacto sin ficha", rows: { "Próxima cita": "Vie 17:00", "Visitas": "—", "Profesional": "Dra. Ruiz" }, notes: ["Crear ficha al llegar a la clínica"] },
  },
  "Seguros Salud+": {
    client: null, channel: "Gmail",
    thread: [
      { from: "them", text: "Buenos días, necesitamos la factura agregada de septiembre de nuestros asegurados." },
      { from: "agent", text: "Buenos días. Administración la está preparando con el desglose por paciente; la tendréis hoy antes de las 14:00." },
    ],
    crm: { initials: "S+", color: "var(--linen)", since: "Aseguradora · convenio desde 2020", rows: { "Facturas pendientes": "1", "Asegurados": "38", "Contacto": "Admin." }, notes: ["Factura mensual agregada", "Pago a 30 días"] },
  },
  "Marta L.": {
    client: "Marta Lillo", channel: "Google Reviews",
    thread: [
      { from: "them", text: "★★★☆☆ «Buen trato, pero me cambiaron la cita dos veces.»" },
      { from: "approval", id: "resena-marta", text: "Atención ha preparado una respuesta a la reseña de Marta, ofreciendo prioridad en su próxima cita." },
    ],
    crm: { initials: "ML", color: "var(--mist)", since: "Paciente desde 2021", rows: { "Próxima cita": "—", "Visitas": "7", "Profesional": "Dr. Soler" }, notes: ["Evitar moverle citas", "Prefiere mañanas"] },
  },
  "Diego C.": {
    client: "Diego Cuevas", channel: "Instagram",
    thread: [
      { from: "them", text: "¿Hacéis ortodoncia invisible?" },
      { from: "agent", text: "¡Sí, Diego! Trabajamos con alineadores invisibles. En tu cita del miércoles el Dr. Soler te hace una valoración sin coste." },
    ],
    crm: { initials: "DC", color: "var(--coral)", since: "Paciente desde 2025", rows: { "Próxima cita": "Mié 17:00", "Visitas": "2", "Profesional": "Dr. Soler" }, notes: ["Interesado en ortodoncia invisible"] },
  },
  "+34 6•• ••• 204": {
    client: null, channel: "Teléfono",
    thread: [
      { from: "them", text: "(Llamada) Quiero pedir una revisión para la semana que viene." },
      { from: "agent-actions", chips: [{ bg: "var(--mist)", text: "Calendar · Cita creada" }], text: "Hecho: martes a las 11:00 con el Dr. Soler. Te llegará la confirmación por SMS." },
    ],
    crm: { initials: "?", color: "var(--linen)", since: "Contacto sin ficha", rows: { "Próxima cita": "Mar 11:00", "Visitas": "—", "Profesional": "Dr. Soler" }, notes: ["Crear ficha al llegar a la clínica"] },
  },
};

// Conversación completa (cabecera, hilo y ficha CRM) de una fila de la bandeja.
export function convDetail(c, sede) {
  if (!c) return null;
  const sedeKey = c.sede ?? sede;
  const src = CONVS[sedeKey] ?? CONVS["Sede Centro"];
  if (src.header.name === c.name) {
    return { header: src.header, thread: src.thread, crm: src.crm, client: c.name === "Laura M." ? "Laura Martín" : c.name === "Javier R." ? "Javier Ramos" : null };
  }
  const d = CONV_DETAILS[c.name];
  if (!d) return { header: { name: c.name, channel: c.meta.split(" · ")[0] }, thread: [{ from: "them", text: c.preview }], crm: { initials: c.name.slice(0, 2), color: "#f6f2e8", name: c.name, since: "—", rows: {}, notes: [] }, client: null };
  return { header: { name: c.name, channel: d.channel }, thread: d.thread, crm: { ...d.crm, name: c.name }, client: d.client };
}

// ----- LLAMADAS ----- (por sede; cada llamada con su resumen y transcripción)
const CALLS = {
  "Sede Centro": [
    { name: "Sara Pérez", client: "Sara Pérez", time: "10:31", dur: "1:42", kind: "reserva", line: "Reservó revisión el martes 9:30", agent: "Recepción",
      summary: "Sara quería una revisión esta semana. Se le ofreció el martes a las 9:30 con el Dr. Vidal y aceptó.",
      tags: [["var(--mist)", "Calendar · Cita creada"], ["var(--sage)", "CRM · Ficha actualizada"], ["var(--sunken)", "WhatsApp · Confirmación enviada"]],
      transcript: [["Agente", "Clínica Dental Sol, buenos días. Soy el asistente de la clínica, ¿en qué puedo ayudarte?"], ["Sara", "Hola, quería pedir una revisión para esta semana si puede ser."], ["Agente", "Claro. Tengo el martes a las 9:30 o el jueves a las 18:00. ¿Cuál te va mejor?"], ["Sara", "El martes."]] },
    { name: "+34 6•• ••• 447", client: null, time: "10:12", dur: "0:58", kind: "info", line: "Preguntó horarios del sábado", agent: "Recepción",
      summary: "Preguntó si la clínica abre los sábados. Se le informó del horario de sábado (10:00–14:00) y no pidió cita.",
      tags: [["var(--sunken)", "Sin acciones"]],
      transcript: [["Llamante", "Hola, ¿abrís los sábados?"], ["Agente", "Sí, los sábados abrimos de 10:00 a 14:00. ¿Quieres que te reserve un hueco?"], ["Llamante", "De momento no, gracias."]] },
    { name: "Jorge López", client: "Jorge López", time: "09:47", dur: "2:10", kind: "traspaso", line: "Pasada a Carmen: queja por una factura", agent: "Recepción",
      summary: "Jorge no estaba de acuerdo con el importe de su última factura. El agente lo pasó a Carmen (administración) al tratarse de una reclamación.",
      tags: [["var(--amber-bg)", "Traspasada a Carmen"], ["var(--sage)", "CRM · Nota añadida"]],
      transcript: [["Agente", "Clínica Dental Sol, ¿en qué puedo ayudarte?"], ["Jorge", "Me habéis cobrado de más en la última factura."], ["Agente", "Lo siento, Jorge. Te paso con Carmen, de administración, que lo revisa contigo ahora mismo."]] },
    { name: "Luis Cano", client: null, time: "09:20", dur: "1:05", kind: "confirma", line: "Confirmó su revisión de hoy", agent: "Recepción",
      summary: "Luis llamó para confirmar su revisión de hoy a las 12:00. Confirmado y recordatorio desactivado.",
      tags: [["var(--mist)", "Calendar · Asistencia confirmada"]],
      transcript: [["Luis", "Hola, llamo para confirmar mi cita de hoy."], ["Agente", "Confirmada, Luis: hoy a las 12:00 con la Dra. Ruiz. ¡Hasta luego!"]] },
  ],
  "Sede Norte": [
    { name: "Nuria Ferrer", client: "Nuria Ferrer", time: "09:20", dur: "1:05", kind: "confirma", line: "Confirmó la cita de hoy", agent: "Recepción",
      summary: "Nuria confirmó su cita de hoy a las 17:30 tras el aviso de revisión. Vuelve después de 9 meses.",
      tags: [["var(--mist)", "Calendar · Asistencia confirmada"], ["var(--sage)", "CRM · Cliente recuperada"]],
      transcript: [["Nuria", "Hola, os llamo por el mensaje de la revisión. Confirmo la de hoy."], ["Agente", "¡Perfecto, Nuria! Hoy a las 17:30 con el Dr. Soler. Te esperamos."]] },
    { name: "Diego Cuevas", client: "Diego Cuevas", time: "Ayer 18:02", dur: "2:31", kind: "reserva", line: "Reservó blanqueamiento el miércoles", agent: "Recepción",
      summary: "Diego pidió cita para blanqueamiento. Se reservó el miércoles a las 17:00 y preguntó por la ortodoncia invisible.",
      tags: [["var(--mist)", "Calendar · Cita creada"], ["var(--coral)", "Comercial · Lead creado"]],
      transcript: [["Diego", "Quería pedir cita para un blanqueamiento."], ["Agente", "Tengo el miércoles a las 17:00. ¿Te va bien?"], ["Diego", "Sí. Y ¿hacéis ortodoncia invisible?"], ["Agente", "Sí; el Dr. Soler te lo valora en la misma visita."]] },
  ],
};
CALLS["Todas las sedes"] = [
  ...CALLS["Sede Centro"].map((c) => ({ ...c, sede: "Sede Centro" })),
  ...CALLS["Sede Norte"].map((c) => ({ ...c, sede: "Sede Norte" })),
];
export function callsFor(sede) { return CALLS[sede] ?? CALLS["Sede Centro"]; }

// ----- APROBACIONES ----- (fuente única: Inicio, contador del menú y pantalla)
const APPROVALS = {
  "Sede Centro": [
  { id: "f0412", agent: "Administración", color: "var(--amber-fg)", when: "hace 5 min", tag: "Factura", title: "Enviar factura F-0412 a Laura M. por WhatsApp", note: "La pidió en la conversación de esta mañana.", head: "Enviar factura a Laura M.",
    lines: [["Limpieza dental", "45,00 €"], ["Revisión", "30,00 €"], ["IVA (exento, art. 20 LIVA)", "0,00 €"]], total: "75,00 €",
    message: "¡Hola, Laura! Te adjunto la factura de tu última visita. Cualquier duda, aquí estoy.", rule: "«Enviar factura» requiere aprobación." },
  { id: "resena", agent: "Atención al cliente", color: "#9dbecc", when: "hace 22 min", tag: "Reseña", title: "Responder a una reseña de 2 estrellas de Pedro G.", note: "Las reseñas negativas siempre pasan por ti.", head: "Respuesta a la reseña de Pedro G.",
    quote: "«Tuve que esperar 25 minutos aunque tenía cita.» ★★☆☆☆",
    message: "Hola, Pedro. Sentimos mucho la espera: ese día tuvimos una urgencia que retrasó la agenda. Nos gustaría compensarte con una revisión sin coste. ¿Te llamamos para buscar hueco?", rule: "Las reseñas de 3 estrellas o menos requieren aprobación." },
  { id: "citas", agent: "Recepción", color: "var(--green-fg)", when: "hace 1 h", tag: "Agenda", title: "Mover 3 citas del viernes por la baja de la Dra. Ruiz", note: "Propone pasarlas al lunes con el Dr. Vidal.", head: "Reprogramar 3 citas",
    lines: [["Ana P. · vie 10:00", "→ lun 10:00 · Dr. Vidal"], ["Marcos R. · vie 11:30", "→ lun 12:00 · Dr. Vidal"], ["Lucía G. · vie 17:00", "→ lun 16:30 · Dr. Vidal"]],
    message: "Hola, te escribimos de Clínica Dental Sol: la Dra. Ruiz no podrá atenderte el viernes. ¿Te va bien el lunes a la hora indicada con el Dr. Vidal?", rule: "Cambios de varias citas a la vez requieren aprobación." },
  ],
  "Sede Norte": [
  { id: "presu-javier", agent: "Comercial", color: "var(--rose-fg)", when: "hace 10 min", tag: "Presupuesto", title: "Enviar presupuesto de ortodoncia a Javier R. por WhatsApp", note: "Lo pidió con pago a plazos en la conversación de hoy.", head: "Presupuesto de ortodoncia para Javier R.",
    lines: [["Ortodoncia invisible (12 meses)", "1.900,00 €"], ["Financiación a 12 meses", "158,33 €/mes"], ["Estudio ortodóncico", "Incluido"]], total: "1.900,00 €",
    message: "¡Hola, Javier! Te paso el presupuesto de ortodoncia invisible con pago a plazos (158,33 €/mes). Si te encaja, te reservo la primera cita.", rule: "«Enviar presupuesto» requiere aprobación." },
  { id: "resena-marta", agent: "Atención al cliente", color: "#9dbecc", when: "hace 40 min", tag: "Reseña", title: "Responder a una reseña de 3 estrellas de Marta L.", note: "Las reseñas de 3 estrellas o menos pasan por ti.", head: "Respuesta a la reseña de Marta L.",
    quote: "«Buen trato, pero me cambiaron la cita dos veces.» ★★★☆☆",
    message: "Hola, Marta. Tienes toda la razón: no debimos moverte la cita dos veces. Tu próxima visita tendrá prioridad y la confirmaremos contigo antes de agendarla.", rule: "Las reseñas de 3 estrellas o menos requieren aprobación." },
  ],
};
APPROVALS["Todas las sedes"] = [
  ...APPROVALS["Sede Centro"].map((i) => ({ ...i, sede: "Sede Centro" })),
  ...APPROVALS["Sede Norte"].map((i) => ({ ...i, sede: "Sede Norte" })),
];
export function approvalsFor(sede) { return APPROVALS[sede] ?? APPROVALS["Sede Centro"]; }
