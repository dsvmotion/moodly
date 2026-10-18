/* global self, caches */
// Service worker de la PWA (Fase 0). Solo hace la app instalable y muestra
// una página sin conexión. Nunca guarda páginas ni datos: en caché solo van
// los iconos, el manifest y /offline.html. Los chunks de /_next/static no:
// ya los cachea el navegador (immutable) y, sin páginas guardadas, no sirven
// offline; en la caché del SW solo se acumularían de despliegue en despliegue.

const CACHE = "moodly-shell-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

/**
 * Decide qué hace el SW con una petición. Pura, para poder probarla.
 * - "passthrough": el SW no interviene (la petición va a la red tal cual).
 * - "cache-first": icono, manifest u offline; de caché, y se refresca en segundo plano.
 * - "network-first": navegación; red, y si no hay conexión, /offline.html.
 */
function pickStrategy(request, origin) {
  if (request.method !== "GET") return "passthrough";
  const url = new URL(request.url);
  if (url.origin !== origin) return "passthrough";

  const path = url.pathname;
  const isAuth = path === "/login" || path.startsWith("/login/") || path === "/auth" || path.startsWith("/auth/");
  if (isAuth) return "passthrough";

  const isPublicAsset = path.startsWith("/icons/") || path === "/manifest.webmanifest" || path === OFFLINE_URL;
  if (isPublicAsset) return "cache-first";

  if (request.mode === "navigate") return "network-first";
  return "passthrough";
}

async function cacheFirst(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  // Guardar es lo de menos: si put falla (cuota llena, respuesta parcial), la
  // respuesta de red se entrega igual.
  const refresh = fetch(event.request).then((response) => {
    if (response.ok && response.type === "basic") {
      event.waitUntil(cache.put(event.request, response.clone()).catch(() => undefined));
    }
    return response;
  });
  if (!cached) return refresh;
  event.waitUntil(refresh.catch(() => undefined));
  return cached;
}

// La respuesta de navegación no se guarda nunca: puede llevar datos del tenant.
async function networkFirst(event) {
  try {
    return await fetch(event.request);
  } catch {
    return (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

// Al probar pickStrategy en Node, `self` no es un ServiceWorkerGlobalScope.
if (typeof self !== "undefined" && self.addEventListener) {
  self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
        .then(() => self.clients.claim()),
    );
  });

  // La versión nueva espera hasta que el usuario acepta el aviso de recarga.
  self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  });

  self.addEventListener("fetch", (event) => {
    const strategy = pickStrategy(event.request, self.location.origin);
    if (strategy === "cache-first") event.respondWith(cacheFirst(event));
    else if (strategy === "network-first") event.respondWith(networkFirst(event));
  });
}
