import { VERTICALS } from "./verticals";
import { localize } from "./i18n";

// Fuente única de la navegación de la web pública: la usan la cabecera y el pie.
// Colores principales de agente (paleta Moodly 2026): únicos y constantes en toda la web.
// Las rutas son las mismas en todos los idiomas; getNav(lang) les pone el prefijo del idioma.

const COLORS = ["#004c39", "#9dbecc", "#a30042", "#8e4e00"];

// [texto por idioma] en orden es · en · fr · de
const T = {
  agents: [
    [["Recepción", "Citas, agenda y llamadas de voz."], ["Reception", "Appointments, calendar and voice calls."], ["Accueil", "Rendez-vous, agenda et appels vocaux."], ["Empfang", "Termine, Kalender und Anrufe."]],
    [["Atención al cliente", "WhatsApp, email y redes, 24/7."], ["Customer service", "WhatsApp, email and social, 24/7."], ["Service client", "WhatsApp, e-mail et réseaux, 24h/24."], ["Kundenservice", "WhatsApp, E-Mail und Social Media, rund um die Uhr."]],
    [["Comercial", "Leads, CRM y seguimiento."], ["Sales", "Leads, CRM and follow-ups."], ["Commercial", "Leads, CRM et relances."], ["Vertrieb", "Leads, CRM und Nachfassen."]],
    [["Administración", "Facturas e inventario."], ["Administration", "Invoices and inventory."], ["Administration", "Factures et stocks."], ["Verwaltung", "Rechnungen und Lager."]],
  ],
  platform: [
    ["/integraciones", ["Integraciones", "WhatsApp, Google, Microsoft, CRM, facturación y más."], ["Integrations", "WhatsApp, Google, Microsoft, CRM, invoicing and more."], ["Intégrations", "WhatsApp, Google, Microsoft, CRM, facturation et plus."], ["Integrationen", "WhatsApp, Google, Microsoft, CRM, Rechnungen und mehr."]],
    ["/modelos", ["Modelos de IA", "OpenAI, Anthropic, Google, Mistral… o tus propias claves."], ["AI models", "OpenAI, Anthropic, Google, Mistral… or your own keys."], ["Modèles d'IA", "OpenAI, Anthropic, Google, Mistral… ou vos propres clés."], ["KI-Modelle", "OpenAI, Anthropic, Google, Mistral … oder eigene Schlüssel."]],
    ["/app-movil", ["App móvil", "Aprueba y responde desde cualquier sitio."], ["Mobile app", "Approve and reply from anywhere."], ["App mobile", "Validez et répondez où que vous soyez."], ["Mobile App", "Freigeben und antworten, wo du gerade bist."]],
    ["/producto", ["Ver la plataforma", "Capturas y el onboarding, paso a paso."], ["See the platform", "Screenshots and onboarding, step by step."], ["Voir la plateforme", "Captures et onboarding, étape par étape."], ["Plattform ansehen", "Screenshots und Onboarding, Schritt für Schritt."]],
  ],
  verticals: {
    belleza: [["Beauty & Aesthetics", "Aesthetics, hair salons, barbers, nails."], ["Beauté et esthétique", "Esthétique, coiffure, barbiers, ongles."], ["Beauty & Kosmetik", "Kosmetik, Friseure, Barbiere, Nägel."]],
    hosteleria: [["Hospitality", "Restaurants, hotels, holiday rentals, experiences."], ["Hôtellerie-restauration", "Restaurants, hôtels, locations, activités."], ["Gastronomie & Hotellerie", "Restaurants, Hotels, Ferienwohnungen, Erlebnisse."]],
    inmobiliario: [["Real Estate", "Sales, rentals, new builds and management."], ["Immobilier", "Vente, location, neuf et gestion."], ["Immobilien", "Verkauf, Vermietung, Neubau und Verwaltung."]],
    profesionales: [["Professional Services", "Accountants, law firms, consultancies, agencies."], ["Cabinets et conseil", "Expertise comptable, avocats, conseil, agences."], ["Kanzleien & Beratung", "Steuerberatung, Kanzleien, Beratung, Agenturen."]],
    retail: [["Retail & Ecommerce", "Fashion, cosmetics, food, DTC brands."], ["Commerce et e-commerce", "Mode, cosmétique, alimentation, marques DTC."], ["Handel & E-Commerce", "Mode, Kosmetik, Lebensmittel, D2C-Marken."]],
    hogar: [["Home Services", "Renovations, installers, HVAC, cleaning."], ["Artisans et dépannage", "Rénovation, installateurs, climatisation, nettoyage."], ["Handwerk", "Renovierung, Installateure, Klima, Reinigung."]],
    automocion: [["Auto Dealers & Repair", "Dealerships, garages, car rental."], ["Garages et concessions", "Concessions, garages, location de voitures."], ["Autohaus & Werkstatt", "Autohäuser, Werkstätten, Autovermietung."]],
    educacion: [["Schools & Gyms", "Academies, language schools, gyms, pilates."], ["Écoles et salles de sport", "Écoles, langues, salles de sport, pilates."], ["Schulen & Fitnessstudios", "Akademien, Sprachschulen, Fitnessstudios, Pilates."]],
  },
  resources: [
    ["/implantacion", ["Cómo funciona", "De la primera llamada a tu agente trabajando."], ["How it works", "From the first call to your agent at work."], ["Comment ça marche", "Du premier appel à votre agent en action."], ["So funktioniert's", "Vom ersten Gespräch bis zum arbeitenden Agenten."]],
    ["/casos", ["Casos de uso", "Cómo trabajan los agentes en cada sector."], ["Use cases", "How the agents work in each industry."], ["Cas d'usage", "Comment les agents travaillent dans chaque secteur."], ["Anwendungsfälle", "So arbeiten die Agenten in jeder Branche."]],
    ["/seguridad", ["Centro de confianza", "Seguridad, privacidad y cumplimiento."], ["Trust center", "Security, privacy and compliance."], ["Centre de confiance", "Sécurité, confidentialité et conformité."], ["Trust Center", "Sicherheit, Datenschutz und Compliance."]],
    ["/enterprise", ["Enterprise", "Cadenas, multisede y despliegue propio."], ["Enterprise", "Chains, multi-site and private deployment."], ["Entreprise", "Réseaux, multisite et déploiement privé."], ["Enterprise", "Filialketten, mehrere Standorte, eigenes Hosting."]],
  ],
  footer: {
    agents: ["Agentes", "Agents", "Agents", "Agenten"],
    pricing: ["Precios", "Pricing", "Tarifs", "Preise"],
    about: ["Sobre nosotros", "About us", "À propos", "Über uns"],
    contact: ["Contacto", "Contact", "Contact", "Kontakt"],
    sales: ["Hablar con ventas", "Talk to sales", "Parler aux ventes", "Vertrieb kontaktieren"],
    cols: [["Plataforma", "Platform", "Plateforme", "Plattform"], ["Sectores", "Industries", "Secteurs", "Branchen"], ["Recursos", "Resources", "Ressources", "Ressourcen"], ["Empresa", "Company", "Entreprise", "Unternehmen"]],
  },
  legal: [
    ["/aviso-legal", ["Aviso legal", "Legal notice", "Mentions légales", "Impressum"]],
    ["/privacidad", ["Privacidad", "Privacy", "Confidentialité", "Datenschutz"]],
    ["/terminos", ["Términos", "Terms", "Conditions", "AGB"]],
    ["/cookies", ["Cookies", "Cookies", "Cookies", "Cookies"]],
  ],
};

const IDX = { es: 0, en: 1, fr: 2, de: 3 };

export function getNav(lang = "es") {
  const i = IDX[lang] ?? 0;
  const L = (href) => localize(lang, href);
  const agents = T.agents.map((t, k) => ({ name: t[i][0], text: t[i][1], color: COLORS[k], href: L("/agentes") }));
  const platform = T.platform.map(([href, ...t]) => ({ name: t[i][0], text: t[i][1], href: L(href) }));
  const sectors = VERTICALS.map((v) => {
    const [name, text] = i === 0 ? [v.name, v.text] : T.verticals[v.id][i - 1];
    return { id: v.id, name, text, href: L(`/sectores#${v.id}`), color: v.color };
  });
  const resources = T.resources.map(([href, ...t]) => ({ name: t[i][0], text: t[i][1], href: L(href) }));
  const f = T.footer;
  const footer = [
    { title: f.cols[0][i], links: [[f.agents[i], L("/agentes")], ...platform.map((p) => [p.name, p.href]), [f.pricing[i], L("/precios")]] },
    { title: f.cols[1][i], links: sectors.map((x) => [x.name, x.href]) },
    { title: f.cols[2][i], links: resources.map((r) => [r.name, r.href]) },
    { title: f.cols[3][i], links: [[f.about[i], L("/sobre-nosotros")], [f.contact[i], L("/contacto")], [f.sales[i], L("/contacto")]] },
  ];
  const legal = T.legal.map(([href, names]) => [names[i], L(href)]);
  return { agents, platform, sectors, resources, footer, legal };
}

// Compatibilidad: páginas que aún leen la navegación en español.
const ES = getNav("es");
export const AGENTS = ES.agents.map((a) => ({ ...a, href: "/agentes" }));
export const SECTORS = ES.sectors;
