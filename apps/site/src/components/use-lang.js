"use client";
import { useParams } from "next/navigation";
import { hasLocale } from "./i18n";

// Idioma de la página actual, leído del segmento /[lang] de la URL.
export function useLang() {
  const { lang } = useParams() || {};
  return hasLocale(lang) ? lang : "es";
}
