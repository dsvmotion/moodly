// Idiomas de la web pública. La URL lleva el idioma (/es, /en, /fr, /de) y src/proxy.js
// redirige a cada visitante según su elección guardada, su país o su navegador.

export const LOCALES = ["es", "en", "fr", "de"];
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_NAMES = { es: "Español", en: "English", fr: "Français", de: "Deutsch" };

export const hasLocale = (l) => LOCALES.includes(l);

// Rutas fuera de la web pública: no llevan idioma.
const UNLOCALIZED = ["/plataforma"];

// "/precios" → "/en/precios"; "/#demo" → "/en#demo"; "/plataforma" no cambia.
export function localize(lang, href) {
  if (!href || !href.startsWith("/") || UNLOCALIZED.some((p) => href.startsWith(p))) return href;
  if (LOCALES.some((l) => href === `/${l}` || href.startsWith(`/${l}/`) || href.startsWith(`/${l}#`))) return href;
  return href === "/" ? `/${lang}` : href.startsWith("/#") ? `/${lang}${href.slice(1)}` : `/${lang}${href}`;
}

// Cambia el idioma de una ruta ya localizada: "/es/precios" → "/de/precios".
export function switchLocale(pathname, next) {
  const parts = pathname.split("/");
  if (hasLocale(parts[1])) parts[1] = next; else parts.splice(1, 0, next);
  return parts.join("/") || `/${next}`;
}

// País (cabecera de la CDN) → idioma. Lo que no esté aquí cae en el navegador o en inglés.
export const COUNTRY_LOCALE = {
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", UY: "es", EC: "es", VE: "es", BO: "es", PY: "es", CR: "es", PA: "es", DO: "es", GT: "es", HN: "es", SV: "es", NI: "es", CU: "es", PR: "es",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", SN: "fr", CI: "fr", MA: "fr", TN: "fr", DZ: "fr",
  DE: "de", AT: "de", LI: "de", CH: "de",
};

// Textos de la cabecera, el pie y los avisos comunes, en los cuatro idiomas.
export const UI = {
  es: {
    badges: [["Seguridad de nivel enterprise", "Cifrado y aislamiento por cliente"], ["Despliegue donde quieras", "Nube gestionada, tu nube u on-premise"], ["Diseñado para el RGPD", "Alojamiento en la UE [por confirmar]"]],
    moreSecurity: "Más sobre seguridad", languages: "Idiomas", vuln: "Política de divulgación de vulnerabilidades", city: "Madrid", address: ["[Dirección de la oficina]", "[Código postal] Madrid", "España"],
    platform: "Plataforma", sectors: "Sectores", resources: "Recursos", security: "Seguridad", enterprise: "Enterprise", pricing: "Precios",
    talkSales: "Hablar con ventas", demo: "Pedir demo", agents: "Agentes", openMenu: "Abrir menú", closeMenu: "Cerrar menú", language: "Idioma",
    seePlatform: ["Ver la plataforma", "Cómo es por dentro y cómo se pone en marcha, con capturas reales.", "Ver la presentación"],
    cases: ["Casos de uso →", "Cómo trabajan los agentes en negocios como el tuyo."],
    noSector: ["¿Tu sector no está?", "Partimos de la plantilla más cercana y la adaptamos a tu negocio.", "Hablar con nosotros"],
    about: ["Sobre nosotros", "Quiénes somos y por qué hacemos Moodly."],
    contact: ["Contacto", "Ventas, soporte y prensa."],
    trust: ["Centro de confianza", "Cómo protegemos los datos de tu negocio y de tus clientes.", "Ver seguridad"],
    tagline: "Agentes de IA listos para usar, para pymes, cadenas y empresas.",
    gdpr: "Diseñado para el RGPD", euHosting: "Alojamiento en la UE [por confirmar]", noTrain: "Tus datos no entrenan modelos", noTrainSub: "Política de proveedores de IA",
    footerNav: "Pie de página", company: "Empresa",
    translating: null,
  },
  en: {
    badges: [["Enterprise-grade security", "Encryption and per-customer isolation"], ["Deployable anywhere", "Managed, your own cloud or on-prem"], ["Built for GDPR", "EU hosting [to be confirmed]"]],
    moreSecurity: "More about security", languages: "Languages", vuln: "Vulnerability disclosure policy", city: "Madrid", address: ["[Office address]", "[Postcode] Madrid", "Spain"],
    platform: "Platform", sectors: "Industries", resources: "Resources", security: "Security", enterprise: "Enterprise", pricing: "Pricing",
    talkSales: "Talk to sales", demo: "Book a demo", agents: "Agents", openMenu: "Open menu", closeMenu: "Close menu", language: "Language",
    seePlatform: ["See the platform", "What it looks like inside and how you get started, with real screenshots.", "See the overview"],
    cases: ["Use cases →", "How the agents work in businesses like yours."],
    noSector: ["Industry not listed?", "We start from the closest template and adapt it to your business.", "Talk to us"],
    about: ["About us", "Who we are and why we build Moodly."],
    contact: ["Contact", "Sales, support and press."],
    trust: ["Trust center", "How we protect your business and customer data.", "See security"],
    tagline: "Ready-to-use AI agents for SMBs, chains and enterprises.",
    gdpr: "Built for GDPR", euHosting: "EU hosting [to be confirmed]", noTrain: "Your data never trains models", noTrainSub: "AI provider policy",
    footerNav: "Footer", company: "Company",
    translating: "We're translating this page. Some content is still shown in Spanish.",
  },
  fr: {
    badges: [["Sécurité de niveau entreprise", "Chiffrement et isolation par client"], ["Déployable partout", "Cloud géré, votre cloud ou sur site"], ["Conçu pour le RGPD", "Hébergement dans l'UE [à confirmer]"]],
    moreSecurity: "En savoir plus sur la sécurité", languages: "Langues", vuln: "Politique de divulgation des vulnérabilités", city: "Madrid", address: ["[Adresse du bureau]", "[Code postal] Madrid", "Espagne"],
    platform: "Plateforme", sectors: "Secteurs", resources: "Ressources", security: "Sécurité", enterprise: "Entreprise", pricing: "Tarifs",
    talkSales: "Parler aux ventes", demo: "Demander une démo", agents: "Agents", openMenu: "Ouvrir le menu", closeMenu: "Fermer le menu", language: "Langue",
    seePlatform: ["Voir la plateforme", "À quoi elle ressemble et comment démarrer, avec de vraies captures.", "Voir la présentation"],
    cases: ["Cas d'usage →", "Comment les agents travaillent dans des entreprises comme la vôtre."],
    noSector: ["Votre secteur n'y est pas ?", "Nous partons du modèle le plus proche et l'adaptons à votre activité.", "Nous contacter"],
    about: ["À propos", "Qui nous sommes et pourquoi nous créons Moodly."],
    contact: ["Contact", "Ventes, support et presse."],
    trust: ["Centre de confiance", "Comment nous protégeons les données de votre entreprise et de vos clients.", "Voir la sécurité"],
    tagline: "Des agents IA prêts à l'emploi pour les PME, les réseaux et les entreprises.",
    gdpr: "Conçu pour le RGPD", euHosting: "Hébergement dans l'UE [à confirmer]", noTrain: "Vos données n'entraînent aucun modèle", noTrainSub: "Politique des fournisseurs d'IA",
    footerNav: "Pied de page", company: "Entreprise",
    translating: "Traduction en cours. Une partie du contenu est encore en espagnol.",
  },
  de: {
    badges: [["Sicherheit auf Enterprise-Niveau", "Verschlüsselung und Isolierung pro Kunde"], ["Überall einsetzbar", "Verwaltet, eigene Cloud oder On-Premise"], ["Für die DSGVO entwickelt", "Hosting in der EU [wird bestätigt]"]],
    moreSecurity: "Mehr zur Sicherheit", languages: "Sprachen", vuln: "Richtlinie zur Offenlegung von Schwachstellen", city: "Madrid", address: ["[Büroadresse]", "[PLZ] Madrid", "Spanien"],
    platform: "Plattform", sectors: "Branchen", resources: "Ressourcen", security: "Sicherheit", enterprise: "Enterprise", pricing: "Preise",
    talkSales: "Vertrieb kontaktieren", demo: "Demo anfragen", agents: "Agenten", openMenu: "Menü öffnen", closeMenu: "Menü schließen", language: "Sprache",
    seePlatform: ["Plattform ansehen", "So sieht sie aus und so startest du, mit echten Screenshots.", "Übersicht ansehen"],
    cases: ["Anwendungsfälle →", "So arbeiten die Agenten in Betrieben wie deinem."],
    noSector: ["Deine Branche fehlt?", "Wir starten mit der passendsten Vorlage und passen sie an deinen Betrieb an.", "Sprich mit uns"],
    about: ["Über uns", "Wer wir sind und warum wir Moodly bauen."],
    contact: ["Kontakt", "Vertrieb, Support und Presse."],
    trust: ["Trust Center", "Wie wir die Daten deines Betriebs und deiner Kunden schützen.", "Sicherheit ansehen"],
    tagline: "Einsatzbereite KI-Agenten für KMU, Filialketten und Unternehmen.",
    gdpr: "Für die DSGVO entwickelt", euHosting: "Hosting in der EU [wird bestätigt]", noTrain: "Deine Daten trainieren keine Modelle", noTrainSub: "Richtlinie für KI-Anbieter",
    footerNav: "Fußzeile", company: "Unternehmen",
    translating: "Diese Seite wird gerade übersetzt. Einige Inhalte sind noch auf Spanisch.",
  },
};

export const ui = (lang) => UI[lang] || UI.es;
