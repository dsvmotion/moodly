"use client";

// Grupo de pastillas seleccionables (filtros, periodos, vistas). Sustituye a los
// <span> que solo simulaban un selector: son <button aria-pressed>, accesibles
// por teclado y lector de pantalla, y avisan del cambio con onChange.
//   variant="outline"   → pastillas sueltas con borde (filtros de lista)
//   variant="segmented" → pastillas dentro de una cápsula blanca (vistas/periodos)
export default function Pills({ options, value, onChange, label, variant = "outline", size = "md" }) {
  const pad = size === "sm" ? "6px 12px" : "8px 14px";
  const font = size === "sm" ? "13px" : "14px";
  const wrap = variant === "segmented"
    ? { display: "inline-flex", padding: "4px", gap: "2px", borderRadius: "800px", background: "#ffffff", flexWrap: "wrap" }
    : { display: "flex", gap: "6px", flexWrap: "wrap" };
  return (
    <div role="group" aria-label={label} style={wrap}>
      {options.map(([val, text]) => {
        const on = val === value;
        const look = on
          ? { background: "#000000", color: "#ffffff", boxShadow: "none" }
          : variant === "segmented"
            ? { background: "transparent", color: "#000000", boxShadow: "none" }
            : { background: "#ffffff", color: "#000000", boxShadow: "inset 0 0 0 1px #0000001a" };
        return (
          <button key={val} type="button" aria-pressed={on} onClick={() => onChange(val)}
            style={{ padding: pad, borderRadius: "800px", border: 0, font: `${on ? 500 : 400} ${font}/14px var(--font-display)`, cursor: "pointer", whiteSpace: "nowrap", ...look }}>
            {text}
          </button>
        );
      })}
    </div>
  );
}
