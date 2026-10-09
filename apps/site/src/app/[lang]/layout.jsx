import { notFound } from "next/navigation";
import { hasLocale, LOCALES } from "@/components/i18n";
import "../globals.css";

// Raíz de la web pública: una versión por idioma (/es, /en, /fr, /de).
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const META = {
  es: ["Moodly AI · Agentes de IA para pymes y cadenas", "Agentes de IA listos para usar que se conectan a WhatsApp, Gmail, Calendar, tu CRM y tu facturación."],
  en: ["Moodly AI · AI agents for SMBs and chains", "Ready-to-use AI agents that connect to WhatsApp, Gmail, Calendar, your CRM and your invoicing."],
  fr: ["Moodly AI · Agents IA pour PME et réseaux", "Des agents IA prêts à l'emploi connectés à WhatsApp, Gmail, Agenda, votre CRM et votre facturation."],
  de: ["Moodly AI · KI-Agenten für KMU und Filialketten", "Einsatzbereite KI-Agenten für WhatsApp, Gmail, Kalender, dein CRM und deine Rechnungen."],
};

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const [title, description] = META[lang] || META.es;
  return {
    title, description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  };
}

export default async function LangLayout({ children, params }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html lang={lang}>
      <head>
        <link rel="preload" href="/fonts/LabilGrotesk-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
