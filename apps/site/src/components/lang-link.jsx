"use client";
import Link from "next/link";
import { localize } from "./i18n";
import { useLang } from "./use-lang";

// Enlace interno que añade el idioma de la página actual: "/precios" → "/en/precios".
export default function LangLink({ href, ...props }) {
  const lang = useLang();
  return <Link href={localize(lang, href)} {...props} />;
}
