import { afterEach, describe, expect, it } from "vitest";
import { __resetToasts, dismissToast, getToasts, subscribeToasts, toast } from "./toast-store";

afterEach(() => {
  __resetToasts();
});

describe("store de toasts", () => {
  it("añade un toast y notifica a los suscriptores", () => {
    let calls = 0;
    const unsubscribe = subscribeToasts(() => {
      calls += 1;
    });
    const id = toast({ title: "Factura enviada" });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({ id, title: "Factura enviada", variant: "default" });
    expect(calls).toBe(1);
    unsubscribe();
  });

  it("descarta por id sin tocar los demás", () => {
    const first = toast({ title: "A" });
    toast({ title: "B" });
    dismissToast(first);
    const ids = getToasts().map((item) => item.id);
    expect(ids).not.toContain(first);
    expect(getToasts()).toHaveLength(1);
  });

  it("conserva la variante indicada", () => {
    toast({ title: "No se pudo guardar", variant: "error" });
    expect(getToasts()[0]?.variant).toBe("error");
  });

  it("deja de notificar tras cancelar la suscripción", () => {
    let calls = 0;
    const unsubscribe = subscribeToasts(() => {
      calls += 1;
    });
    unsubscribe();
    toast({ title: "X" });
    expect(calls).toBe(0);
  });
});
