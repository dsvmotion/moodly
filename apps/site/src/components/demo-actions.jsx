"use client";
import { useEffect, useState } from "react";

// Capa de interacción del prototipo de la plataforma: los botones y enlaces marcados con
// data-demo responden con un aviso coherente con su acción. TODO(backend): sustituir cada
// data-demo por la llamada real cuando exista la API.
const RULES = [
  [/cerrar las demás sesiones/i, "Las demás sesiones se han cerrado"],
  [/eliminar|borrar/i, "Te pediremos confirmación por email antes de eliminar nada"],
  [/^aprobar|aprobar y enviar|^enviar$/i, "Aprobado y enviado"],
  [/rechazar|descartar/i, "Descartado. El agente no lo hará"],
  [/editar|modificar|cambiar/i, "Abierto para editar"],
  [/guardar|aplicar/i, "Cambios guardados"],
  [/invitar/i, "Invitación enviada"],
  [/conectar|reconectar/i, "Conexión iniciada: te llevaremos al proveedor para autorizar"],
  [/desconectar/i, "Integración desconectada"],
  [/añadir|nuevo|nueva|crear|subir/i, "Creado como borrador"],
  [/exportar|descargar|pdf/i, "Preparando la descarga"],
  [/tomar el control|responder yo/i, "Has tomado la conversación. El agente queda en pausa"],
  [/devolver|reanudar|activar/i, "El agente vuelve a encargarse"],
  [/pausar|desactivar/i, "Agente en pausa"],
  [/probar|simular/i, "Prueba lanzada con datos de ejemplo"],
  [/llamar/i, "Llamada iniciada"],
];

function messageFor(label) {
  const hit = RULES.find(([re]) => re.test(label));
  return hit ? hit[1] : `«${label}»`;
}

export default function DemoActions() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    const onClick = (e) => {
      const el = e.target.closest("[data-demo]");
      if (!el) return;
      e.preventDefault();
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
      // Tarjetas de lista: marcar la elegida dentro de su grupo
      const parent = el.parentElement;
      if (el.tagName === "A" && parent) {
        [...parent.children].forEach((c) => c.matches("[data-demo]") && (c.style.outline = c === el ? "2px solid #000000" : ""));
      }
      setToast({ text: messageFor(label), id: Date.now() });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)", zIndex: 1000, display: "flex", alignItems: "center", gap: "10px", maxWidth: "calc(100vw - 32px)", boxSizing: "border-box", padding: "12px 18px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "20px", boxShadow: "0 8px 24px #0000001f" }}>
      <span aria-hidden="true" style={{ color: "#a3c2a7" }}>✓</span>{toast.text}
      <span style={{ padding: "1px 8px", borderRadius: "800px", background: "#ffffff26", fontSize: "11px" }}>demo</span>
    </div>
  );
}
