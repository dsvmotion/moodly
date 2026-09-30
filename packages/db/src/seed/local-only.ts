// El seed solo puede ejecutarse contra Supabase local: compara el hostname
// ya parseado (no un prefijo de texto), así que "127.0.0.1.evil.test" o
// "localhost@evil.test" no cuelan.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function assertLocalSupabaseUrl(apiUrl: string): void {
  let host: string;
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    throw new Error(`API_URL no es una URL válida: ${apiUrl}`);
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`El seed solo se ejecuta contra Supabase local; API_URL apunta a ${host}`);
  }
}
