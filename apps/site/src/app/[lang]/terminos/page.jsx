"use client";
import LegalPage from "@/components/legal-page";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";

export default function Terminos() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  return <LegalPage title={t.title} updated={t.updated} intro={t.intro} sections={t.sections} />;
}
