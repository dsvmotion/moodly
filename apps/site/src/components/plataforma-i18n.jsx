"use client";
import { useEffect, useState } from "react";
import { PLAT_LANG_KEY, PLAT_LANGS } from "./lang-script";

// Idioma del prototipo de la plataforma: es (original) · en · fr · de.
//
// El prototipo está escrito en español. En vez de reescribir 67 pantallas, una capa
// de traducción en el navegador sustituye los textos ya pintados: diccionario exacto
// (plataforma-i18n/<idioma>.json, sacado de recorrer todas las pantallas) → patrones
// con números y horas → frases separadas por « · ». Un MutationObserver traduce lo
// que React pinte después (modales, pestañas, cambios de estado). Lo que no esté en el
// diccionario se queda en español. Marca con translate="no" lo que no deba traducirse.
//
// En apps/web esto se hará con next-intl; estos diccionarios sirven de punto de partida.
export { PLAT_LANG_KEY, PLAT_LANGS };
const EVT = "moodly-plataforma-lang-change";
const ATTRS = ["placeholder", "aria-label", "title", "alt"];

function read() { try { const l = localStorage.getItem(PLAT_LANG_KEY); return PLAT_LANGS[l] ? l : "es"; } catch { return "es"; } }

export function usePlatformLang() {
  const [lang, setLangState] = useState("es");
  useEffect(() => {
    setLangState(read());
    const on = () => setLangState(read());
    window.addEventListener(EVT, on); window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  const setLang = (l) => { try { localStorage.setItem(PLAT_LANG_KEY, l); } catch {} setLangState(l); window.dispatchEvent(new Event(EVT)); };
  return [lang, setLang];
}

// Textos con partes variables (horas, días, años). $1, $2… son los grupos del patrón.
const PATTERNS = {
  en: [[/^Hoy,? (\d\d?:\d\d)$/, "Today $1"], [/^Ayer,? (\d\d?:\d\d)$/, "Yesterday $1"], [/^[Hh]ace (\d+) días? · (\d\d?:\d\d)$/, "$1 days ago · $2"], [/^[Hh]ace (\d+) min$/, "$1 min ago"], [/^[Hh]ace (\d+) h$/, "$1 h ago"], [/^[Hh]ace (\d+) días?$/, "$1 days ago"], [/^[Hh]ace (\d+) meses$/, "$1 months ago"], [/^Cliente desde (\d{4})$/, "Customer since $1"], [/^Sin email$/, "No email"]],
  fr: [[/^Hoy,? (\d\d?:\d\d)$/, "Aujourd'hui $1"], [/^Ayer,? (\d\d?:\d\d)$/, "Hier $1"], [/^[Hh]ace (\d+) días? · (\d\d?:\d\d)$/, "Il y a $1 jours · $2"], [/^[Hh]ace (\d+) min$/, "il y a $1 min"], [/^[Hh]ace (\d+) h$/, "il y a $1 h"], [/^[Hh]ace (\d+) días?$/, "il y a $1 jours"], [/^[Hh]ace (\d+) meses$/, "il y a $1 mois"], [/^Cliente desde (\d{4})$/, "Client depuis $1"], [/^Sin email$/, "Sans e-mail"]],
  de: [[/^Hoy,? (\d\d?:\d\d)$/, "Heute $1"], [/^Ayer,? (\d\d?:\d\d)$/, "Gestern $1"], [/^[Hh]ace (\d+) días? · (\d\d?:\d\d)$/, "Vor $1 Tagen · $2"], [/^[Hh]ace (\d+) min$/, "vor $1 Min."], [/^[Hh]ace (\d+) h$/, "vor $1 Std."], [/^[Hh]ace (\d+) días?$/, "vor $1 Tagen"], [/^[Hh]ace (\d+) meses$/, "vor $1 Monaten"], [/^Cliente desde (\d{4})$/, "Kunde seit $1"], [/^Sin email$/, "Ohne E-Mail"]],
};

// Comunes a los tres idiomas: día abreviado + número u hora («Mié 8», «Jue 10:30»),
// «Activar <modelo>» y «Quedan N».
const DAYS = { en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], fr: ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."], de: ["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."] };
const ES_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ENABLE = { en: "Enable", fr: "Activer", de: "aktivieren" };
const LEFT = { en: "$1 left", fr: "Il en reste $1", de: "Noch $1" };
function commonPatterns(lang) {
  const days = [[new RegExp(`^(${ES_DAYS.join("|")}) (\\d\\d?(?::\\d\\d)?)$`), (_, d, n) => `${DAYS[lang][ES_DAYS.indexOf(d)]} ${n}`]];
  const enable = [/^Activar ([A-Z][\w .-]*\d[\w .-]*|[A-Z]\w+ [A-Z][\w .-]*)$/, (_, m) => (lang === "de" ? `${m} ${ENABLE.de}` : `${ENABLE[lang]} ${m}`)];
  return [...days, enable, [/^Quedan (\d+)$/, LEFT[lang]]];
}

function makeTranslator(lang, dict) {
  const pats = [...(PATTERNS[lang] || []), ...commonPatterns(lang)];
  const core = (s) => {
    if (dict[s] !== undefined) return dict[s];
    for (const [re, out] of pats) if (re.test(s)) return s.replace(re, out);
    return null;
  };
  return (text) => {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    const s = m[2];
    if (!s || !/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(s)) return null;
    let out = core(s);
    if (out === null && s.includes(" · ")) {
      // Frase compuesta («WhatsApp · Recepción · hace 5 min»): cada trozo por separado.
      const parts = s.split(" · ").map((p) => core(p) ?? p);
      const joined = parts.join(" · ");
      if (joined !== s) out = joined;
    }
    return out === null ? null : m[1] + out + m[3];
  };
}

const skip = (el) => !el || el.closest("script,style,[translate='no']");

export function PlatformI18n() {
  const [lang] = usePlatformLang();
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    // Nodos tocados: { src: texto original, out: lo que escribimos }.
    const texts = (window.__moodlyI18nTexts ||= new Map());
    const attrs = (window.__moodlyI18nAttrs ||= new Map());
    const restore = () => {
      texts.forEach((r, n) => { if (n.isConnected && n.nodeValue === r.out) n.nodeValue = r.src; });
      attrs.forEach((byAttr, el) => { if (el.isConnected) Object.entries(byAttr).forEach(([a, r]) => { if (el.getAttribute(a) === r.out) el.setAttribute(a, r.src); }); });
      texts.clear(); attrs.clear();
      document.title = window.__moodlyI18nTitle ||= document.title;
    };
    restore();
    if (lang === "es") { html.removeAttribute("data-i18n-pending"); return; }

    let observer; let cancelled = false;
    import(`./plataforma-i18n/${lang}.json`).then(({ default: dict }) => {
      if (cancelled) return;
      const tr = makeTranslator(lang, dict);
      const doText = (n) => {
        if (skip(n.parentElement)) return;
        const r = texts.get(n);
        if (r && n.nodeValue === r.out) return; // lo escribimos nosotros
        const src = n.nodeValue; const out = tr(src);
        if (out !== null && out !== src) { texts.set(n, { src, out }); n.nodeValue = out; } else texts.delete(n);
      };
      const doAttr = (el, a) => {
        const v = el.getAttribute(a); if (!v) return;
        const byAttr = attrs.get(el) || {}; const r = byAttr[a];
        if (r && v === r.out) return;
        const out = tr(v);
        if (out !== null && out !== v) { byAttr[a] = { src: v, out }; attrs.set(el, byAttr); el.setAttribute(a, out); }
      };
      const walk = (root) => {
        if (root.nodeType === 3) return doText(root);
        if (root.nodeType !== 1 || skip(root)) return;
        ATTRS.forEach((a) => root.hasAttribute(a) && doAttr(root, a));
        root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => !skip(el) && ATTRS.forEach((a) => el.hasAttribute(a) && doAttr(el, a)));
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) doText(n);
      };
      walk(document.body);
      const t = tr(window.__moodlyI18nTitle); if (t) document.title = t;
      observer = new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === "characterData") doText(m.target);
          else if (m.type === "attributes") { if (!skip(m.target)) doAttr(m.target, m.attributeName); }
          else m.addedNodes.forEach(walk);
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      html.removeAttribute("data-i18n-pending");
    }).catch(() => html.removeAttribute("data-i18n-pending"));
    return () => { cancelled = true; observer?.disconnect(); };
  }, [lang]);
  return null;
}

// Selector de idioma reutilizable (Preferencias, perfil, móvil). Los nombres de los
// idiomas van en su propia lengua y no se traducen.
export function PlatformLangSelect({ style, ariaLabel = "Idioma" }) {
  const [lang, setLang] = usePlatformLang();
  return (
    <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={ariaLabel} style={style}>
      {Object.entries(PLAT_LANGS).map(([id, name]) => <option key={id} value={id} lang={id} translate="no">{name}</option>)}
    </select>
  );
}
