"use client";

import { useTranslations } from "next-intl";
import type { DataTableLabels } from "@repo/ui/components/data-table";

/** Textos de DataTable traducidos (los componentes de @repo/ui no conocen i18n). */
export function useTableLabels(): DataTableLabels {
  const t = useTranslations("records");
  return {
    search: t("search"),
    columns: t("columns"),
    selectAll: t("selectAll"),
    selectRow: (name) => t("selectRow", { name }),
    openRow: (name) => t("openRow", { name }),
    noResults: t("noResults"),
    rowCount: (visible, total) => t("rowCount", { visible, total }),
    selectedCount: (count) => t("selectedCount", { count }),
    sortAscending: t("sortAscending"),
    sortDescending: t("sortDescending"),
  };
}
