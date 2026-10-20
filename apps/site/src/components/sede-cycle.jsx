"use client";
import { SEDES, useSede } from "@/components/use-sede";

// Controles de sede reutilizables para pantallas estáticas: muestran la sede activa
// y la cambian (la misma que el selector del menú lateral).
export function SedeName() {
  const { sede } = useSede();
  return <>{sede}</>;
}

// Botón que pasa a la siguiente sede (móvil).
export function SedeCycle({ style, children }) {
  const { sede, setSede } = useSede();
  return (
    <button type="button" aria-label={`Sede activa: ${sede}. Cambiar de sede`} onClick={() => setSede(SEDES[(SEDES.indexOf(sede) + 1) % SEDES.length])} style={{ border: 0, background: "transparent", font: "inherit", color: "inherit", cursor: "pointer", padding: 0, textAlign: "left", ...style }}>
      {children ?? <>{sede} ⌄</>}
    </button>
  );
}

// Selector nativo de sede (escritorio).
export function SedeSelect({ style, label = "Sede" }) {
  const { sede, setSede } = useSede();
  return (
    <label style={{ display: "inline-flex" }}>
      <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>{label}</span>
      <select value={sede} onChange={(e) => setSede(e.target.value)} style={{ cursor: "pointer", font: "inherit", color: "inherit", ...style }}>
        {SEDES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}
