import "../globals.css";
import DemoActions from "@/components/demo-actions";
import { SedeProvider } from "@/components/use-sede";
import { ThemeSync } from "@/components/theme";
import { THEME_SCRIPT } from "@/components/theme-script";
import { LANG_SCRIPT } from "@/components/lang-script";
import { PlatformI18n } from "@/components/plataforma-i18n";
import DialogA11y from "@/components/dialog-a11y";

export const metadata = { title: "Moodly AI · Plataforma (demo)" };

// Prototipo navegable de la plataforma. Escrito en español; en/fr/de con la capa de
// traducción de components/plataforma-i18n.jsx (el idioma se elige en Preferencias).
export default function PlataformaLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
        <link rel="preload" href="/fonts/LabilGrotesk-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="plataforma-root">
        <SedeProvider>
          {children}
          <DemoActions />
          <ThemeSync />
          <PlatformI18n />
          <DialogA11y />
        </SedeProvider>
      </body>
    </html>
  );
}
