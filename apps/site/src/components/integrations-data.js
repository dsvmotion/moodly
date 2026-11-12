// Catálogo de integraciones — fuente única para la lista (Configuración ›
// Integraciones) y la ficha de cada integración. TODO(backend): `integrations` +
// estado de salud por organización; OAuth real.
// Cada integración declara sus ACCIONES (lo que el agente puede hacer con ella),
// su categoría y, si procede, el conjunto por defecto (Google / Microsoft).
export const ALL = [
  { id: "whatsapp", name: "WhatsApp Business", logo: "whatsapp.svg", cat: "Mensajería", use: "Número +34 600 000 000", actions: "Responder, enviar plantillas, notas de voz", agents: "Recepción, Atención" },
  { id: "gcal", name: "Google Calendar", logo: "googlecalendar.svg", cat: "Calendario", suite: "google", use: "Agenda de las 3 profesionales", actions: "Crear, mover y cancelar citas", agents: "Recepción" },
  { id: "gmail", name: "Gmail", logo: "gmail.svg", cat: "Email", suite: "google", use: "info@estudiobellezasol.es", actions: "Leer y responder correos", agents: "Atención" },
  { id: "holded", name: "Holded", logo: "holded.png", cat: "Facturación", use: "Facturas y cobros", actions: "Crear factura, registrar cobro", agents: "Administración" },
  { id: "twilio", name: "Teléfono (Twilio)", logo: "twilio.svg", cat: "Voz", use: "Línea +34 910 000 000", actions: "Atender y hacer llamadas", agents: "Recepción" },
  { id: "instagram", name: "Instagram", logo: "instagram.svg", cat: "Mensajería", use: "Mensajes directos", actions: "Responder DMs y comentarios", agents: "Atención" },
  { id: "outlook", name: "Outlook / Microsoft 365", logo: "microsoftoutlook.svg", cat: "Email", suite: "microsoft", use: "Email y calendario", actions: "Correo y calendario", agents: "Recepción, Atención" },
  { id: "maps", name: "Google Reviews", logo: "googlemaps.svg", cat: "Reseñas", use: "Reseñas de tu ficha", actions: "Leer y responder reseñas", agents: "Atención" },
  { id: "hubspot", name: "HubSpot", logo: "hubspot.svg", cat: "CRM", use: "Contactos y presupuestos", actions: "Crear contactos, mover oportunidades", agents: "Comercial" },
  { id: "salesforce", name: "Salesforce", logo: "salesforce.svg", cat: "CRM", use: "Cuentas y oportunidades", actions: "Crear y actualizar oportunidades", agents: "Comercial" },
  { id: "pipedrive", name: "Pipedrive", logo: "pipedrive.svg", cat: "CRM", use: "Embudo de ventas", actions: "Mover tratos de etapa", agents: "Comercial" },
  { id: "booksy", name: "Booksy", logo: "", cat: "Calendario", use: "Reservas de belleza [vía partner]", actions: "Leer y crear citas", agents: "Recepción" },
  { id: "calendly", name: "Calendly", logo: "calendly.svg", cat: "Calendario", use: "Reservas online", actions: "Crear y leer reservas", agents: "Recepción" },
  { id: "stripe", name: "Stripe", logo: "stripe.svg", cat: "Facturación", use: "Cobros y enlaces de pago", actions: "Crear enlaces de pago, ver cobros", agents: "Administración" },
  { id: "quickbooks", name: "QuickBooks", logo: "quickbooks.svg", cat: "Facturación", use: "Contabilidad", actions: "Emitir facturas", agents: "Administración" },
  { id: "drive", name: "Google Drive", logo: "googledrive.svg", cat: "Almacenamiento", suite: "google", use: "Protocolos y tarifas", actions: "Leer documentos para responder", agents: "Todos" },
  { id: "onedrive", name: "OneDrive / SharePoint", logo: "microsoftonedrive.svg", cat: "Almacenamiento", suite: "microsoft", use: "Documentos del equipo", actions: "Leer documentos", agents: "Todos" },
  { id: "notion", name: "Notion", logo: "notion.svg", cat: "Almacenamiento", use: "Base de conocimiento", actions: "Leer páginas", agents: "Todos" },
  { id: "shopify", name: "Shopify", logo: "shopify.svg", cat: "CRM", use: "Pedidos y clientes", actions: "Ver pedidos y estados", agents: "Atención, Comercial" },
  { id: "messenger", name: "Facebook Messenger", logo: "messenger.svg", cat: "Mensajería", use: "Mensajes de la página", actions: "Responder mensajes", agents: "Atención" },
  { id: "telegram", name: "Telegram", logo: "telegram.svg", cat: "Mensajería", use: "Canal y mensajes", actions: "Responder mensajes", agents: "Atención" },
  { id: "elevenlabs", name: "ElevenLabs (voz)", logo: "elevenlabs.svg", cat: "Voz", use: "Voz del agente en llamadas", actions: "Síntesis y clonación de voz", agents: "Recepción" },
  { id: "zendesk", name: "Zendesk", logo: "zendesk.svg", cat: "Mensajería", use: "Tickets de soporte", actions: "Crear y responder tickets", agents: "Atención" },
  { id: "thefork", name: "TheFork", logo: "thefork.png", cat: "Calendario", use: "Reservas de mesa", actions: "Leer y gestionar reservas", agents: "Recepción" },
];
export const INITIAL = { whatsapp: "on", gcal: "error", gmail: "on", holded: "on", twilio: "on" };

// Ficha de salud y permisos de las integraciones conectadas.
export const DETAIL = {
  whatsapp: { since: "2 oct 2026", by: "Marta Ruiz", lastSync: "hace 1 min", scopes: [["Leer y responder mensajes", true], ["Enviar plantillas aprobadas", true], ["Notas de voz", true], ["Gestionar el perfil de empresa", false]],
    events: [["ok", "Hoy 10:42", "Mensaje entregado a Laura M."], ["ok", "Hoy 09:58", "Plantilla «Recordatorio 24 h» enviada (12)"], ["ok", "Ayer 18:20", "Webhook verificado"]] },
  gcal: { since: "2 oct 2026", by: "Marta Ruiz", lastSync: "hace 3 h", error: "El permiso de Google caducó (token revocado al cambiar la contraseña de la cuenta).", affected: ["Reservar citas", "Reprogramar y cancelar", "Lista de espera"],
    scopes: [["Ver calendarios", true], ["Crear y mover eventos", true], ["Ver disponibilidad de profesionales", true], ["Borrar calendarios", false]],
    events: [["err", "Hoy 07:12", "Error 401 al leer la agenda de Lucía Ruiz"], ["err", "Hoy 07:10", "Token revocado por Google"], ["ok", "Ayer 21:00", "Sincronización completa (3 calendarios)"]] },
  gmail: { since: "2 oct 2026", by: "Marta Ruiz", lastSync: "hace 4 min", scopes: [["Leer correos de info@", true], ["Responder en el hilo", true], ["Enviar correos nuevos", true], ["Borrar correos", false]],
    events: [["ok", "Hoy 10:15", "4 respuestas enviadas"], ["ok", "Hoy 08:02", "Sincronización completa"]] },
  holded: { since: "3 oct 2026", by: "Marta Ruiz", lastSync: "hace 12 min", scopes: [["Crear facturas en borrador", true], ["Registrar cobros", true], ["Emitir facturas sin aprobación", false]],
    events: [["ok", "Hoy 11:02", "Borrador F-0412 creado"], ["ok", "Ayer 19:30", "Cobro de Iván Rubio registrado"]] },
  twilio: { since: "4 oct 2026", by: "Marta Ruiz", lastSync: "en directo", scopes: [["Atender llamadas entrantes", true], ["Hacer llamadas salientes", true], ["Grabar con consentimiento", true]],
    events: [["ok", "Hoy 10:31", "Llamada de Sara Pérez (1:42)"], ["ok", "Hoy 10:12", "Llamada entrante (0:58)"]] },
};
export function detailFor(id) {
  return DETAIL[id] ?? { since: "hoy", by: "Marta Ruiz", lastSync: "hace un momento", scopes: [["Acceso básico de lectura", true]], events: [["ok", "Hoy", "Conectada"]] };
}
