import { getTranslations } from "next-intl/server";
import { Skeleton } from "@repo/ui/components/skeleton";

// Mientras llega una sección de la app (auditoría M-10: no había estados de
// carga, y al navegar la página anterior se quedaba quieta sin decir nada). La
// forma de lo que llega (título, descripción y filas), no un spinner; para el
// lector de pantalla, un estado «Cargando…».
//
// Va como loading.tsx solo en secciones cuya página nunca da 404 (Aprobaciones,
// Objetivos, Conocimiento). Un loading.tsx encima de una página que llama a
// notFound() hace que Next empiece a enviar la respuesta con 200 antes de que
// la página decida el 404 (agents/[type], inbox/[id], settings/[section] y las
// rutas que no existen): por eso no hay uno en la raíz de /app.
export default async function SectionLoading() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4" role="status" aria-label={t("loadingPage")} data-testid="app-loading">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-2 pt-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
