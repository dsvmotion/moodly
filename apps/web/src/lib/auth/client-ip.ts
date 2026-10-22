// IP del visitante, para el freno de login (migración login_throttle).
//
// En producción la plataforma de despliegue pone la IP real como primer valor de
// x-forwarded-for. En local no hay proxy: se usa "local". Si alguien manipula la
// cabecera, solo cambia la clave por IP: los límites por email siguen frenando.
const IP_CHARS = /^[0-9a-fA-F:.]{2,45}$/;

export function clientIp(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  return first && IP_CHARS.test(first) ? first : "local";
}
