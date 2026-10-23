// El seed solo puede ejecutarse contra Supabase local: compara el hostname
// ya parseado (no un prefijo de texto), así que "127.0.0.1.evil.test" o
// "localhost@evil.test" no cuelan.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function assertLocalSupabaseUrl(apiUrl: string): void {
  let host: string;
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    // Sin el valor: puede ser una URL de Postgres con su contraseña.
    throw new Error("La URL de Supabase no es válida");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`El seed solo se ejecuta contra Supabase local; la URL apunta a ${host}`);
  }
}
