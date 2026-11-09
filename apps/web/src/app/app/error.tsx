"use client";

import { useTranslations } from "next-intl";
import { ErrorPanel } from "@/components/error-panel";

// Una página de /app que falla se queda dentro de la app (revisión del diseño
// §4): la barra lateral sigue ahí para ir a otra parte, y se puede reintentar.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("states.error");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <ErrorPanel digest={error.digest} reset={reset} />
    </div>
  );
}
