// Registro del service worker y aviso de versión nueva, sin React para poder
// probarlo. La versión nueva nunca se activa sola: espera a que el usuario
// acepte el aviso (apply), y entonces se recarga la página una única vez.

type Container = Pick<ServiceWorkerContainer, "register" | "controller" | "addEventListener">;

export async function registerServiceWorker(
  container: Container,
  onUpdateReady: (apply: () => void) => void,
  reload: () => void,
): Promise<void> {
  const registration = await container.register("/sw.js", { scope: "/" });

  const apply = () => {
    let reloaded = false;
    container.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      reload();
    });
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  // Sin controller es la primera instalación: no hay versión anterior que cambiar.
  if (registration.waiting && container.controller) onUpdateReady(apply);

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && container.controller) onUpdateReady(apply);
    });
  });
}
