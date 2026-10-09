/**
 * Store mínimo de toasts (sin dependencias). La UI lo lee con useSyncExternalStore
 * en components/toast.tsx; cualquier módulo lo escribe con `toast(...)`. Un toast
 * confirma el resultado de una acción (enviada, aprobada, error al guardar); no
 * sustituye a un estado de error de página.
 */
export type ToastVariant = "default" | "success" | "error";
export type ToastItem = { id: string; title: string; description?: string; variant: ToastVariant };

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

export function toast(input: { title: string; description?: string; variant?: ToastVariant }): string {
  counter += 1;
  const item: ToastItem = { id: `t${counter}`, variant: "default", ...input };
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
