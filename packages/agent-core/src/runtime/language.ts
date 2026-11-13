// El idioma de un texto, por palabras que casi solo salen en un idioma (el que
// más tiene gana). Lo usan el turno, para el texto fijo del paso a una persona
// (CU3), y las evals, para comprobar en qué idioma contesta el agente: la misma
// detección en los dos sitios.

import { HAND_OFF_TEXTS } from "./turn.js";
import type { HistoryMessage } from "./turn.js";

export const LANGUAGES = ["es", "en", "fr", "de"] as const;
export type Language = (typeof LANGUAGES)[number];

const STOPWORDS: Record<Language, readonly string[]> = {
  es: ["el", "la", "los", "las", "de", "que", "y", "en", "un", "una", "para", "con", "por", "tu", "te", "es", "está", "hay", "puedo", "hola", "gracias", "cita", "hueco", "lunes", "martes", "mañana", "tarde", "persona", "equipo", "nos", "lo", "si", "sí", "pero", "como", "más"],
  en: ["the", "and", "you", "your", "is", "are", "to", "of", "for", "with", "we", "have", "can", "i", "a", "an", "it", "on", "at", "hi", "hello", "thanks", "appointment", "slot", "monday", "tuesday", "available", "will", "be", "this", "that", "please", "would", "team"],
  fr: ["le", "la", "les", "de", "des", "et", "vous", "votre", "est", "pour", "avec", "nous", "un", "une", "je", "bonjour", "merci", "rendez-vous", "lundi", "mardi", "disponible", "créneau", "pas", "ne", "sur", "au", "du", "équipe", "sera", "peux", "pouvez", "il", "y", "a"],
  de: ["der", "die", "das", "und", "sie", "ihr", "ihre", "ist", "für", "mit", "wir", "ein", "eine", "ich", "hallo", "danke", "termin", "montag", "dienstag", "verfügbar", "nicht", "zu", "am", "um", "den", "dem", "es", "gibt", "können", "kann", "team", "gerne", "uhr"],
};

/** Los aciertos de cada idioma en un texto. */
export function languageScores(text: string): Record<Language, number> {
  const tokens = text.toLowerCase().match(/[\p{L}-]+/gu) ?? [];
  const scores = { es: 0, en: 0, fr: 0, de: 0 };
  for (const language of LANGUAGES) {
    const words = new Set(STOPWORDS[language]);
    scores[language] = tokens.filter((token) => words.has(token)).length;
  }
  return scores;
}

/** El idioma de un texto, o null si no hay un ganador claro. */
export function detectLanguage(text: string): Language | null {
  const scores = languageScores(text);
  const ranked = [...LANGUAGES].sort((a, b) => scores[b] - scores[a]);
  const [first, second] = ranked as [Language, Language];
  return scores[first] > 0 && scores[first] > scores[second] ? first : null;
}

/**
 * El texto fijo del paso a una persona (CU3) en el idioma de la conversación:
 * el del último mensaje del cliente, si es uno de los de HAND_OFF_TEXTS. Si no
 * se sabe, o no hay texto en ese idioma, `fallback` (el de la organización).
 */
export function handOffTextForConversation(history: readonly HistoryMessage[], fallback: string): string {
  const last = [...history].reverse().find((message) => message.author === "contact");
  const language = last ? detectLanguage(last.content) : null;
  return language && language in HAND_OFF_TEXTS ? HAND_OFF_TEXTS[language as keyof typeof HAND_OFF_TEXTS] : fallback;
}
