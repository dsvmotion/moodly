import { BRAND_NAME } from "@repo/config";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { parseTheme, THEME_COOKIE, themeAttribute } from "@/lib/preferences";
import { jakarta, labil } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_NAME,
  // PWA instalable en el iPhone (el manifest lo enlaza Next desde app/manifest.ts).
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: BRAND_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f4f4f5",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  // Tema elegido por el usuario (cookie); sin atributo, el del sistema.
  const theme = themeAttribute(parseTheme((await cookies()).get(THEME_COOKIE)?.value));

  return (
    <html lang={locale} data-theme={theme} className={`${jakarta.variable} ${labil.variable}`}>
      <body>
        <NextIntlClientProvider>
          {children}
          <ServiceWorkerRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
