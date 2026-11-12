"use client";
import { usePlatformLang } from "./plataforma-i18n";

// Aviso fijo del prototipo (auditoría 2026-11-10, N-04): todo lo que se ve en
// /plataforma es una maqueta con datos ficticios, no el producto. Va en cada ruta
// del prototipo (lo pinta su layout) y en el idioma elegido en el prototipo; por eso
// lleva translate="no", para que la capa de traducción no lo toque.
const TEXT = {
  es: ["Prototipo con datos ficticios.", "No es el producto: las pantallas, los nombres y las cifras son de ejemplo.", "Volver a la web"],
  en: ["Prototype with fictional data.", "This is not the product: screens, names and figures are examples.", "Back to the website"],
  fr: ["Prototype avec des données fictives.", "Ce n'est pas le produit : les écrans, les noms et les chiffres sont des exemples.", "Retour au site"],
  de: ["Prototyp mit fiktiven Daten.", "Das ist nicht das Produkt: Bildschirme, Namen und Zahlen sind Beispiele.", "Zurück zur Website"],
};

export default function PrototypeBanner() {
  const [lang] = usePlatformLang();
  const [strong, rest, back] = TEXT[lang] || TEXT.es;
  return (
    <div role="note" data-prototype-banner="" translate="no" style={{ position: "relative", zIndex: 65, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "4px 12px", padding: "6px 16px", background: "#fff3e8", color: "#6b3a00", borderBottom: "1px solid #f3d3b4", font: "400 13px/19px var(--font-display)", textAlign: "center" }}>
      <span><strong style={{ fontWeight: 600 }}>{strong}</strong> {rest}</span>
      <a href={`/${lang}`} style={{ color: "#6b3a00", textDecoration: "underline", textUnderlineOffset: "2px" }}>{back}</a>
    </div>
  );
}
