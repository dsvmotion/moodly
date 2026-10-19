import "../globals.css";
import DemoActions from "@/components/demo-actions";
import { SedeProvider } from "@/components/use-sede";
import { ThemeSync } from "@/components/theme";
import { THEME_SCRIPT } from "@/components/theme-script";

export const metadata = { title: "Moodly AI · Plataforma (demo)" };

// Prototipo navegable de la plataforma. De momento solo en español.
export default function PlataformaLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preload" href="/fonts/LabilGrotesk-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <SedeProvider>
          {children}
          <DemoActions />
          <ThemeSync />
        </SedeProvider>
      </body>
    </html>
  );
}
