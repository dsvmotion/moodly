// Catálogo de modelos — fuente única para la pantalla de ajustes y la landing.
// Agrupado por DÓNDE se opera cada modelo. Están todos disponibles: la residencia
// es una política por cliente (ADR 0019), no un límite del producto. Por defecto
// «sin restricción» (máxima disponibilidad); si el cliente fija «solo UE» u otra
// región, el enrutador y su fallback se quedan dentro de esa frontera.
// Precios de referencia por millón de tokens (entrada / salida), orientativos — se
// confirman al elegir proveedores. Lineup real a 2026 (Anthropic vía referencia
// oficial; OpenAI, Google y Mistral verificados en la web). Mistral opera en la UE.

export const TYPES = {
  chat: ["Chat", "var(--blue-bg)", "var(--blue-fg)"],
  razon: ["Razonamiento", "var(--violet-bg-2)", "var(--violet-fg)"],
  vision: ["Visión", "var(--green-bg)", "var(--green-fg)"],
  codigo: ["Código", "var(--amber-bg-2)", "var(--amber-fg)"],
  imagen: ["Imagen", "var(--amber-bg)", "var(--amber-fg)"],
  voz: ["Voz", "var(--rose-bg)", "var(--rose-fg)"],
};

export const CATALOG = [
  {
    region: "Operado en la UE",
    note: "Si fijas residencia «solo UE», el enrutador se queda aquí.",
    providers: [
      {
        name: "Mistral AI", logo: "mistralai", models: [
          { id: "mistral-large", n: "Mistral Large", type: "razon", ctx: "128k", in: "2,00", out: "6,00", on: true },
          { id: "mistral-small", n: "Mistral Small", type: "chat", ctx: "128k", in: "0,20", out: "0,60", on: true },
          { id: "ministral-3", n: "Ministral 3 14B", type: "chat", ctx: "128k", in: "0,20", out: "0,20", on: false },
          { id: "devstral-2", n: "Devstral 2", type: "codigo", ctx: "256k", in: "0,40", out: "0,90", on: false },
        ],
      },
    ],
  },
  {
    region: "Operado en EE. UU.",
    note: "Datos procesados fuera de la UE (o en región UE del proveedor, según plan).",
    providers: [
      {
        name: "Anthropic", logo: "anthropic", models: [
          { id: "claude-haiku-5-5", n: "Claude Haiku 5.5", type: "chat", ctx: "1M", in: "0,10", out: "0,50", on: true },
          { id: "claude-sonnet-5-5", n: "Claude Sonnet 5.5", type: "razon", ctx: "1M", in: "2,00", out: "10,00", on: true },
          { id: "claude-opus-5-5", n: "Claude Opus 5.5", type: "razon", ctx: "1M", in: "4,00", out: "20,00", on: true },
          { id: "claude-opus-5", n: "Claude Opus 5", type: "razon", ctx: "1M", in: "5,00", out: "25,00", on: false },
          { id: "claude-fable-5-1", n: "Claude Fable 5.1", type: "razon", ctx: "1M", in: "10,00", out: "50,00", on: false },
        ],
      },
      {
        name: "OpenAI", logo: "openai", models: [
          { id: "gpt-56-luna", n: "GPT-5.6 Luna", type: "chat", ctx: "1M", in: "0,20", out: "1,20", on: true },
          { id: "gpt-56-terra", n: "GPT-5.6 Terra", type: "chat", ctx: "1M", in: "2,00", out: "12,00", on: true },
          { id: "gpt-56-sol", n: "GPT-5.6 Sol", type: "razon", ctx: "1,1M", in: "5,00", out: "30,00", on: false },
          { id: "gpt-6-astra", n: "GPT-6 Astra", type: "razon", ctx: "1M", in: "10,00", out: "50,00", on: false },
        ],
      },
    ],
  },
  {
    region: "Despliegue global",
    note: "Región variable según disponibilidad.",
    providers: [
      {
        name: "Google", logo: "googlegemini", models: [
          { id: "gemini-31-flash-lite", n: "Gemini 3.1 Flash Lite", type: "chat", ctx: "1M", in: "0,25", out: "1,50", on: true },
          { id: "gemini-35-flash", n: "Gemini 3.5 Flash", type: "vision", ctx: "1M", in: "1,50", out: "9,00", on: true },
          { id: "gemini-31-pro", n: "Gemini 3.1 Pro", type: "razon", ctx: "1M", in: "2,00", out: "12,00", on: false },
        ],
      },
    ],
  },
  {
    region: "Voz (síntesis y clonación)",
    note: "Para la skill de voz: llamadas y notas de voz. El coste es por minuto, no por token.",
    providers: [
      {
        name: "Cartesia", logo: "", models: [
          { id: "cartesia-sonic", n: "Cartesia Sonic", type: "voz", ctx: "Telefonía 8 kHz · clon 3 s", in: "0,06 €/min", out: "", on: true },
        ],
      },
      {
        name: "ElevenLabs", logo: "elevenlabs", models: [
          { id: "elevenlabs-clone", n: "ElevenLabs · clonación", type: "voz", ctx: "Clon instant. y pro · UE en Enterprise", in: "~0,12 €/min", out: "", on: false },
        ],
      },
    ],
  },
];

export const DEFAULT_ON = CATALOG.flatMap((g) => g.providers.flatMap((p) => p.models.filter((m) => m.on).map((m) => m.id)));
export const TOTAL_MODELS = CATALOG.reduce((a, g) => a + g.providers.reduce((b, p) => b + p.models.length, 0), 0);
