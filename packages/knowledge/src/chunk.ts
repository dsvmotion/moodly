// El troceado de una fuente de texto para indexarla (paso B20-1, ADR 0048):
// por párrafos, juntando los cortos y partiendo los largos por frases (y, si
// una frase sola no cabe, por palabras), con el título de la fuente delante de
// cada trozo: «¿Cuánto cuesta?» encuentra el precio aunque el párrafo no diga
// de qué servicio habla el título.

/** El tamaño máximo de un trozo, con su título (la tabla admite hasta 8000). */
export const MAX_CHUNK_CHARS = 1000;

function pack(pieces: readonly string[], budget: number, joiner: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const next = current ? `${current}${joiner}${piece}` : piece;
    if (next.length <= budget) {
      current = next;
    } else {
      if (current) out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Un trozo que no cabe se parte por frases y, si una frase sola no cabe, por palabras (y una palabra enorme, a cachos). */
function split(text: string, budget: number): string[] {
  if (text.length <= budget) return [text];
  const sentences = text.split(/(?<=[.!?…])\s+/u).flatMap((sentence) => {
    if (sentence.length <= budget) return [sentence];
    const words = sentence.split(/\s+/u).flatMap((word) => (word.length <= budget ? [word] : (word.match(new RegExp(`.{1,${budget}}`, "gsu")) ?? [])));
    return pack(words, budget, " ");
  });
  return pack(sentences, budget, " ");
}

/** Los trozos de una fuente: cada uno con su título delante y como mucho maxChars caracteres. */
export function chunkText(title: string, body: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const heading = title.trim();
  // Sin título no hay nada delante: el trozo puede llegar al máximo.
  const budget = heading ? Math.max(maxChars - heading.length - 1, Math.floor(maxChars / 2)) : maxChars;
  const paragraphs = body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0)
    .flatMap((paragraph) => split(paragraph, budget));
  return pack(paragraphs, budget, "\n\n").map((chunk) => (heading ? `${heading}\n${chunk}` : chunk));
}
