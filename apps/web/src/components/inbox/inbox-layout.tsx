import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { cn } from "@repo/ui/lib/utils";
import { InboxRefresh } from "./inbox-refresh";

/**
 * La bandeja en dos columnas (P2 + P3): la lista a la izquierda y la
 * conversación abierta a la derecha. En pantallas estrechas se ve una cosa cada
 * vez: la lista, o la conversación con un enlace para volver.
 */
export async function InboxLayout({ list, detail, hasSelection }: { list: ReactNode; detail: ReactNode; hasSelection: boolean }) {
  const t = await getTranslations("inboxPage");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* Con una conversación abierta en el móvil, el título sigue ahí para los lectores de pantalla. */}
      <div className={cn("flex flex-col gap-1", hasSelection && "sr-only lg:not-sr-only")}>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn(hasSelection && "hidden lg:block")}>{list}</div>
        <div className={cn(!hasSelection && "hidden lg:block")}>{detail}</div>
      </div>
      <InboxRefresh />
    </div>
  );
}
