import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./register";

// Dobles mínimos de la API de Service Worker sobre EventTarget de Node.
class FakeWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
  becomeInstalled(registration: FakeRegistration) {
    this.state = "installed";
    registration.installing = null;
    registration.waiting = this;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  startUpdate() {
    const worker = new FakeWorker();
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
    return worker;
  }
}

function setup({ controlled, waiting = false }: { controlled: boolean; waiting?: boolean }) {
  const registration = new FakeRegistration();
  if (waiting) registration.waiting = new FakeWorker();
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
    register: vi.fn(async () => registration),
  });
  const onUpdateReady = vi.fn<(apply: () => void) => void>();
  const reload = vi.fn();
  const run = () =>
    registerServiceWorker(container as unknown as ServiceWorkerContainer, onUpdateReady, reload);
  return { registration, container, onUpdateReady, reload, run };
}

describe("registerServiceWorker", () => {
  it("registra /sw.js en la raíz", async () => {
    const { container, run } = setup({ controlled: false });
    await run();
    expect(container.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("en la primera instalación no avisa de versión nueva", async () => {
    const { registration, onUpdateReady, run } = setup({ controlled: false });
    await run();
    registration.startUpdate().becomeInstalled(registration);
    expect(onUpdateReady).not.toHaveBeenCalled();
  });

  it("con la app ya controlada, avisa cuando la versión nueva queda instalada", async () => {
    const { registration, onUpdateReady, run } = setup({ controlled: true });
    await run();
    const worker = registration.startUpdate();
    expect(onUpdateReady).not.toHaveBeenCalled();
    worker.becomeInstalled(registration);
    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("avisa si ya había una versión esperando al registrar", async () => {
    const { onUpdateReady, run } = setup({ controlled: true, waiting: true });
    await run();
    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("aplicar activa la versión en espera y recarga una sola vez", async () => {
    const { registration, container, onUpdateReady, reload, run } = setup({ controlled: true, waiting: true });
    await run();
    const apply = onUpdateReady.mock.calls[0]?.[0];
    expect(apply).toBeTypeOf("function");

    apply?.();
    expect(registration.waiting?.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();

    container.dispatchEvent(new Event("controllerchange"));
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
