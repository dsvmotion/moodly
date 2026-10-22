"use client";

import { ChevronRightIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { Collapsible, Slot } from "radix-ui";
import {
  cloneElement,
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Badge } from "@repo/ui/components/badge";
import { formatCount } from "@repo/ui/lib/count";
import { cn } from "@repo/ui/lib/utils";

const SidebarContext = createContext<{ collapsed: boolean }>({ collapsed: false });

// true en el cliente una vez hidratado, false en el HTML del servidor. Hasta
// entonces los botones de la barra no responden: data-hydrated lo indica (los e2e
// esperan a él antes de pulsar).
const noopSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * Barra lateral (MANUAL §9.2): secciones colapsables, contadores de
 * pendientes y modo compacto (solo iconos).
 */
export function Sidebar({
  label,
  defaultCollapsed = false,
  onCollapsedChange,
  collapseLabels,
  header,
  footer,
  children,
}: {
  label: string;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseLabels: { collapse: string; expand: string };
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const hydrated = useHydrated();
  const toggle = () => {
    setCollapsed(!collapsed);
    onCollapsedChange?.(!collapsed);
  };

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <nav
        aria-label={label}
        data-slot="sidebar"
        data-collapsed={collapsed}
        data-hydrated={hydrated}
        className={cn(
          "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          collapsed ? "w-14" : "w-64",
        )}
      >
        <div className="flex flex-col gap-1 p-2">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{children}</div>
        <div className="flex flex-col gap-1 border-t border-sidebar-border p-2">
          {footer}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={collapsed}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <PanelLeftOpenIcon className="size-4" aria-hidden="true" /> : <PanelLeftCloseIcon className="size-4" aria-hidden="true" />}
            <span className={collapsed ? "sr-only" : undefined}>
              {collapsed ? collapseLabels.expand : collapseLabels.collapse}
            </span>
          </button>
        </div>
      </nav>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

/** Sección con título; colapsable si tiene `title`. */
export function SidebarSection({
  title,
  defaultOpen = true,
  children,
  ...props
}: Omit<ComponentProps<"div">, "title"> & { title?: string; defaultOpen?: boolean }) {
  const { collapsed } = useSidebar();
  const [open, setOpen] = useState(defaultOpen);

  if (!title) {
    return (
      <div className="py-1" {...props}>
        <ul className="flex flex-col gap-0.5">{children}</ul>
      </div>
    );
  }

  return (
    <Collapsible.Root open={collapsed ? true : open} onOpenChange={setOpen} className="py-1" {...props}>
      {collapsed ? (
        <div role="separator" className="mx-2 my-1 h-px bg-sidebar-border" />
      ) : (
        <Collapsible.Trigger className="group flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium tracking-wide text-sidebar-muted-foreground uppercase hover:text-sidebar-foreground">
          <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
          {title}
        </Collapsible.Trigger>
      )}
      <Collapsible.Content>
        <ul className="flex flex-col gap-0.5" aria-label={title}>
          {children}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/**
 * Entrada de navegación. El hijo es el enlace (p. ej. `<Link href>` de Next):
 * recibe las clases, el icono, el contador y `aria-current` si está activa.
 */
export function SidebarItem({
  icon,
  count,
  countLabel,
  active = false,
  children,
}: {
  icon?: ReactNode;
  count?: number | null;
  countLabel?: (count: string) => string;
  active?: boolean;
  children: ReactElement<{ children?: ReactNode }>;
}) {
  const { collapsed } = useSidebar();
  const countText = formatCount(count);

  return (
    <li>
      <Slot.Root
        data-active={active}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {icon ? <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4" aria-hidden="true">{icon}</span> : null}
        <Slot.Slottable>
          {wrapLabel(children, collapsed)}
        </Slot.Slottable>
        {countText && !collapsed ? (
          <Badge className="ml-auto" aria-label={countLabel ? countLabel(countText) : undefined}>
            {countText}
          </Badge>
        ) : null}
      </Slot.Root>
    </li>
  );
}

// En modo compacto la etiqueta se oculta visualmente pero se conserva para
// lectores de pantalla (el enlace sigue teniendo nombre accesible).
function wrapLabel(child: ReactElement<{ children?: ReactNode }>, collapsed: boolean): ReactElement {
  return cloneElement(child, {
    children: <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>{child.props.children}</span>,
  });
}
