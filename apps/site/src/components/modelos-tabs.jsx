"use client";

// Pestañas del área «Modelos de IA» en Configuración: catálogo + las pantallas de
// infra de proveedores (ADR 0019). Sub-navegación compartida para que todo sea
// alcanzable y coherente.
const TABS = [
  ["catalogo", "Catálogo", "/plataforma/configuracion/modelos"],
  ["proveedores", "Proveedores y vías", "/plataforma/proveedores"],
  ["residencia", "Residencia", "/plataforma/residencia"],
  ["topes", "Topes y fiabilidad", "/plataforma/topes"],
  ["datos", "Datos y DPA", "/plataforma/subprocesadores"],
];

export default function ModelosTabs({ active }) {
  return (
    <div role="tablist" aria-label="Modelos de IA" style={{ display: "flex", gap: "4px", flexWrap: "wrap", borderBottom: "1px solid var(--line-soft)" }}>
      {TABS.map(([key, label, href]) => {
        const on = key === active;
        return (
          <a key={key} href={href} role="tab" aria-selected={on} style={{ padding: "8px 14px", borderRadius: "8px 8px 0 0", fontSize: "14px", textDecoration: "none", color: on ? "var(--ink)" : "var(--muted)", fontWeight: on ? 500 : 400, boxShadow: on ? "inset 0 -2px 0 var(--ink)" : "none" }}>{label}</a>
        );
      })}
    </div>
  );
}
