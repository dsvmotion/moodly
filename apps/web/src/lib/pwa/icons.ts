// Iconos de la PWA declarados en el manifest. Los PNG se generan con
// scripts/pwa-icons.ts a partir de scripts/pwa-icons/app-icon.svg y se
// commitean. apple-touch-icon.png (180×180, opaco) va aparte, en los metadatos.
export const PWA_ICONS: ReadonlyArray<{ file: string; size: number; purpose: "any" | "maskable" }> = [
  { file: "/icons/icon-192.png", size: 192, purpose: "any" },
  { file: "/icons/icon-512.png", size: 512, purpose: "any" },
  { file: "/icons/icon-192-maskable.png", size: 192, purpose: "maskable" },
  { file: "/icons/icon-512-maskable.png", size: 512, purpose: "maskable" },
];
