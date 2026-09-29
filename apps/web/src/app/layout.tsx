import { BRAND_NAME } from "@repo/config";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: BRAND_NAME,
};

// Sin diseño todavía: el app shell con packages/ui es la tarea 4 (MANUAL §9.2).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
