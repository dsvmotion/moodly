"use client";

// Si falla el propio layout raíz (el idioma, el tema), no hay traducciones ni
// estilos de la app en los que confiar: un mensaje mínimo, en inglés (el idioma
// por defecto, ADR 0041) y en español, con la referencia del error y un botón
// para reintentar. El detalle lo registra el servidor (ADR 0032).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}
      >
        <main role="alert" style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem" }}>Something went wrong · Algo ha fallado</h1>
          <p>Please try again. · Inténtalo de nuevo.</p>
          {error.digest ? <p style={{ fontSize: "0.75rem", opacity: 0.7 }}>Ref. {error.digest}</p> : null}
          <button type="button" onClick={() => reset()} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
            Try again · Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
