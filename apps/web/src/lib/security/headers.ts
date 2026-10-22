// Cabeceras de seguridad de la app (OWASP Secure Headers). Puras, para probarlas sin Next.
//
// - CSP con nonce por petición (la pone el proxy): solo se ejecutan los scripts de
//   la propia app que lleven ese nonce; 'strict-dynamic' deja cargar los chunks que
//   esos scripts piden. Sin 'unsafe-inline' ni 'unsafe-eval' en producción.
// - connect-src 'self': el navegador solo habla con la app; Supabase se consulta
//   siempre desde el servidor (lo comprueba e2e/security.e2e.ts).
// - El resto van en todas las respuestas (next.config.ts), también en los estáticos.

/** Nonce aleatorio de 128 bits en base64, uno por petición. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

// `https`: solo entonces se añade upgrade-insecure-requests. Servida por http (en
// local o en los e2e), esa directiva mandaría las peticiones a https://, que no existe.
export function contentSecurityPolicy(nonce: string, { dev = false, https = true }: { dev?: boolean; https?: boolean } = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // En desarrollo, React y el recargado en caliente de Next necesitan eval.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    // Radix y next/font ponen estilos en línea; no ejecutan código.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(dev ? ["ws:"] : [])],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev && https) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Cabeceras fijas para todas las respuestas. */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  // Solo HTTPS durante 2 años, subdominios incluidos (el navegador la ignora en http://).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Respaldo de frame-ancestors para navegadores antiguos: nadie puede incrustar la app.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Nada de cámara, micrófono, ubicación ni pagos hasta que una función los necesite.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];
