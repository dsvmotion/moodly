// Modelo de precios de Moodly: fijo + variable (como Langdock) + implantación según escala.
// Precios propuestos a partir de costes oficiales de proveedores (7 oct 2026):
// ver docs/design/modelo-precios.md. Pendientes de validar con el coste medido en pilotos.
// Cambiar aquí actualiza la home, /precios e /implantacion a la vez.

export const PRICING = {
  trialDays: 14,
  trialConversations: 100,
  // Parte fija
  perAgent: 49,              // € al mes por agente activo
  includedPerAgent: 250,     // conversaciones incluidas al mes por agente
  perExtraSite: 29,          // € al mes por sede adicional
  // Parte variable
  perConversation: 0.1,      // € por conversación extra · coste IA 0,005–0,10 € (mezcla típica ~0,02 €)
  perConversationByok: 0.03, // con tus propias claves: solo plataforma, sin coste de IA
  perVoiceMinute: 0.2,       // € por minuto de llamada · coste voz + telefonía 0,04–0,12 €
  perVoiceMinuteByok: 0.06,  // telefonía + plataforma
  enterpriseFromSites: 3,
  enterpriseFromConversations: 5000,
};

// Implantación según la escala del proyecto. Se anuncia «+ implantación» y se presupuesta
// cerrada tras el diagnóstico; sin precio público hasta validarlo con pilotos.
export const IMPLEMENTATION = [
  { id: "arranque", name: "Arranque", price: "Incluido", text: "Plantilla de tu sector, una sesión de configuración y conexión de WhatsApp, email y calendario.", fit: "1 sede · integraciones estándar" },
  { id: "guiada", name: "Implantación guiada", price: "Presupuesto cerrado", text: "Carga de servicios, precios y reglas, conexión de CRM y facturación, pruebas con tu equipo y formación.", fit: "1–2 sedes · hasta 4 agentes" },
  { id: "medida", name: "Implantación a medida", price: "Presupuesto cerrado", text: "Varias sedes, integraciones especiales, migración de datos, flujos propios y despliegue por fases.", fit: "Cadenas y Enterprise" },
];

export const eur = (n, decimals = 0) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " €";

// Estimación mensual: devuelve el desglose para mostrarlo tal cual en la web.
export function estimate({ agents, sites, conversations, voiceMinutes, byok }) {
  const p = PRICING;
  const n = Math.max(1, agents);
  const fixedAgents = n * p.perAgent;
  const fixedSites = Math.max(0, sites - 1) * p.perExtraSite;
  const included = n * p.includedPerAgent;
  const extraConversations = Math.max(0, conversations - included);
  const variableConversations = extraConversations * (byok ? p.perConversationByok : p.perConversation);
  const variableVoice = voiceMinutes * (byok ? p.perVoiceMinuteByok : p.perVoiceMinute);
  const fixed = fixedAgents + fixedSites;
  const variable = variableConversations + variableVoice;
  return {
    fixedAgents, fixedSites, fixed,
    included, extraConversations, variableConversations, variableVoice, variable,
    total: fixed + variable,
    enterprise: sites >= p.enterpriseFromSites || conversations >= p.enterpriseFromConversations,
  };
}
