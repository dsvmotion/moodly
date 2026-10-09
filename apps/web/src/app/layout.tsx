import { BRAND_NAME } from "@repo/config";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { parseTheme, THEME_COOKIE, themeAttribute } from "@/lib/preferences";
import { jakarta, labil } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_NAME,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  // Tema elegido por el usuario (cookie); sin atributo, el del sistema.
  const theme = themeAttribute(parseTheme((await cookies()).get(THEME_COOKIE)?.value));

  return (
    <html lang={locale} data-theme={theme} className={`${jakarta.variable} ${labil.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
