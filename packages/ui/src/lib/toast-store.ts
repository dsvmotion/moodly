/**
 * Store mínimo de toasts (sin dependencias). La UI lo lee con useSyncExternalStore
 * en components/toast.tsx; cualquier módulo lo escribe con `toast(...)`. Un toast
 * confirma el resultado de una acción (enviada, aprobada, error al guardar); no
 * sustituye a un estado de error de página.
 */
export type ToastVariant = "default" | "success" | "error";
/** Un enlace dentro de la app («Ver»). Solo rutas relativas de la app: nada que salga a otro sitio. */
export type ToastAction = { label: string; href: string };
export type ToastItem = { id: string; title: string; description?: string; variant: ToastVariant; action?: ToastAction };

type Listener = () => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return items;
}

let counter = 0;

/** Una ruta de la app: empieza por una sola barra (no «//host») y no es un esquema. */
function isAppPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
}

export function toast(input: { title: string; description?: string; variant?: ToastVariant; action?: ToastAction }): string {
  counter += 1;
  const { action, ...rest } = input;
  const item: ToastItem = { id: `t${counter}`, variant: "default", ...rest };
  if (action && isAppPath(action.href)) item.action = action;
  items = [...items, item];
  emit();
  return item.id;
}

export function dismissToast(id: string) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Solo para tests. */
export function __resetToasts() {
  items = [];
  counter = 0;
  emit();
}
