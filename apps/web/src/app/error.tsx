"use client";

import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth-shell";
import { ErrorPanel } from "@/components/error-panel";

// Lo que falla fuera de una página de /app: el propio marco de la app (su
// layout), el login o el segundo factor. Con el marco del login, que no depende
// de la sesión ni de la organización.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("states.error");
  return (
    <AuthShell title={t("title")}>
      <ErrorPanel digest={error.digest} reset={reset} />
    </AuthShell>
  );
}
