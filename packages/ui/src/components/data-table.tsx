"use client";

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, Columns3Icon, SearchIcon } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";

// Solo las funcionalidades que usa la tabla (TanStack Table v9 las registra
// explícitamente): filtro global, orden, selección y visibilidad de columnas.
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  rowSelectionFeature,
  columnVisibilityFeature,
});

export interface DataTableColumn<TData extends RowData> {
  id: string;
  header: string;
  /** Valor para ordenar y filtrar. */
  value: (row: TData) => string | number | null;
  /** Presentación de la celda; por defecto, el valor. */
  cell?: (row: TData) => ReactNode;
  enableSorting?: boolean;
  enableHiding?: boolean;
}

export interface DataTableLabels {
  search: string;
  columns: string;
  selectAll: string;
  selectRow: (rowLabel: string) => string;
  openRow: (rowLabel: string) => string;
  noResults: string;
  rowCount: (visible: number, total: number) => string;
  selectedCount: (selected: number) => string;
  sortAscending: string;
  sortDescending: string;
}

const EMPTY_SELECTION: RowSelectionState = {};
/** A partir de este número de filas se virtualiza el cuerpo de la tabla. */
export const VIRTUALIZE_FROM = 100;
const ROW_HEIGHT = 40;

/**
 * Tabla de objetos (P2, MANUAL §9.3): búsqueda, orden, selección múltiple,
 * columnas visibles y virtualización para miles de filas. Cada fila se abre
 * con clic, Enter o Espacio (p. ej. en el panel de vista previa, P4).
 */
export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  rowLabel,
  onRowOpen,
  enableSelection = true,
  labels,
  toolbar,
  className,
  testId = "data-table",
}: {
  data: TData[];
  columns: DataTableColumn<TData>[];
  getRowId: (row: TData) => string;
  rowLabel: (row: TData) => string;
  onRowOpen?: (row: TData) => void;
  enableSelection?: boolean;
  labels: DataTableLabels;
  toolbar?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(EMPTY_SELECTION);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  const tableColumns = useMemo((): Array<ColumnDef<typeof features, TData, unknown>> => {
    const helper = createColumnHelper<typeof features, TData>();
    const dataColumns = columns.map((column) =>
      helper.accessor((row): unknown => column.value(row) ?? "", {
        id: column.id,
        header: column.header,
        enableSorting: column.enableSorting ?? true,
        enableHiding: column.enableHiding ?? true,
        sortFn: "alphanumeric",
        cell: (info) => (column.cell ? column.cell(info.row.original) : (column.value(info.row.original) ?? "")),
      }),
    );
    return enableSelection
      ? [helper.display({ id: "__select", enableHiding: false, enableSorting: false, header: "" }), ...dataColumns]
      : dataColumns;
  }, [columns, enableSelection]);

  const table = useTable({
    features,
    columns: tableColumns,
    data,
    getRowId: (row) => getRowId(row),
    globalFilterFn: "includesString",
    state: { globalFilter, sorting, rowSelection, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    enableSortingRemoval: true,
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = rows.length >= VIRTUALIZE_FROM;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: virtualize,
  });
  const virtualItems = virtualize ? virtualizer.getVirtualItems() : [];
  const renderedRows = virtualize ? virtualItems.flatMap((item) => rows[item.index] ?? []) : rows;
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingTop = firstItem ? firstItem.start : 0;
  const paddingBottom = lastItem ? virtualizer.getTotalSize() - lastItem.end : 0;

  const selectedCount = Object.keys(rowSelection).length;
  const visibleColumns = table.getVisibleLeafColumns();
  const allSelected = rows.length > 0 && rows.every((row) => rowSelection[row.id]);
  const someSelected = !allSelected && rows.some((row) => rowSelection[row.id]);

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: TData) => {
    if (!onRowOpen || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowOpen(row);
    }
  };

  return (
    <div data-testid={testId} className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            className="pl-8"
            data-testid={`${testId}-search`}
          />
        </div>
        {toolbar}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto" data-testid={`${testId}-columns`}>
              <Columns3Icon aria-hidden="true" />
              {labels.columns}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{labels.columns}</DropdownMenuLabel>
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                  onSelect={(event) => event.preventDefault()}
                >
                  {columns.find((c) => c.id === column.id)?.header ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={scrollRef} className="min-h-0 overflow-auto rounded-lg border border-border" style={virtualize ? { maxHeight: "70vh" } : undefined}>
        <table className="w-full caption-bottom border-collapse text-sm" aria-rowcount={virtualize ? rows.length + 1 : undefined}>
          <thead className="sticky top-0 z-10 bg-surface">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-border">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn("h-10 px-3 text-left font-medium text-muted-foreground", header.column.id === "__select" && "w-10")}
                    >
                      {header.column.id === "__select" ? (
                        <Checkbox
                          aria-label={labels.selectAll}
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={(value) => table.toggleAllRowsSelected(Boolean(value))}
                        />
                      ) : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUpIcon className="size-3.5" aria-label={labels.sortAscending} />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon className="size-3.5" aria-label={labels.sortDescending} />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-50" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 ? <tr aria-hidden="true" style={{ height: paddingTop }} /> : null}
            {renderedRows.map((row) => (
              <tr
                key={row.id}
                data-testid={`${testId}-row`}
                data-state={row.getIsSelected() ? "selected" : undefined}
                aria-selected={enableSelection ? row.getIsSelected() : undefined}
                aria-label={onRowOpen ? labels.openRow(rowLabel(row.original)) : undefined}
                tabIndex={onRowOpen ? 0 : undefined}
                onClick={onRowOpen ? () => onRowOpen(row.original) : undefined}
                onKeyDown={(event) => onRowKeyDown(event, row.original)}
                className={cn(
                  "border-b border-border last:border-0 data-[state=selected]:bg-muted",
                  onRowOpen && "cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60",
                )}
                style={{ height: ROW_HEIGHT }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {cell.column.id === "__select" ? (
                      <Checkbox
                        aria-label={labels.selectRow(rowLabel(row.original))}
                        checked={row.getIsSelected()}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
                      />
                    ) : (
                      <table.FlexRender cell={cell} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {paddingBottom > 0 ? <tr aria-hidden="true" style={{ height: paddingBottom }} /> : null}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="h-24 px-3 text-center text-muted-foreground">
                  {labels.noResults}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-live="polite">
        <span data-testid={`${testId}-count`}>{labels.rowCount(rows.length, data.length)}</span>
        {selectedCount > 0 ? <span data-testid={`${testId}-selected`}>{labels.selectedCount(selectedCount)}</span> : null}
      </div>
    </div>
  );
}
