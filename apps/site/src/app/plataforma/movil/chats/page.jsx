"use client";
import { useState } from "react";
import MobileFrame from "@/components/mobile-frame";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { convsFor, convStatus } from "@/components/sede-data";

// Chats (móvil): misma bandeja que escritorio, por sede. Filtros y buscador reales;
// cada fila abre SU conversación (?c=).
const AV = ["var(--sage)", "var(--mist)", "var(--coral)", "var(--linen)", "#ebebed"];

export default function Screen() {
  const { sede } = useSede();
  const list = convsFor(sede).list;
  const [filter, setFilter] = useState("todas");
  const [q, setQ] = useState("");
  const need = list.filter((c) => convStatus(c) === "atencion").length;
  const visible = list.filter((c) => (filter === "todas" || convStatus(c) === filter) && (!q.trim() || `${c.name} ${c.preview}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <MobileFrame active="chats" title="Chats">
      <label htmlFor="q" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar</label>
      <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversación" style={{ padding: "12px 16px", borderRadius: "800px", border: 0, background: "var(--paper)", font: "400 15px/20px var(--font-display)", color: "var(--ink)" }} />
      <Pills label="Filtrar chats" options={[["todas", "Todas"], ["atencion", `Te necesitan · ${need}`], ["resuelta", "Resueltas"]]} value={filter} onChange={setFilter} size="sm" />
      <div style={{ background: "var(--paper)", borderRadius: "12px", overflow: "hidden" }}>
        {visible.length === 0 && <p style={{ margin: 0, padding: "16px 14px", color: "var(--muted)" }}>Nada con este filtro.</p>}
        {visible.map((c, i) => {
          const st = convStatus(c);
          return (
            <a key={`${c.name}${c.sede ?? ""}`} href={`/plataforma/movil/conversacion?c=${encodeURIComponent(c.name)}`} style={{ display: "flex", gap: "12px", padding: "12px 14px", borderTop: i ? "1px solid var(--line-soft)" : 0, textDecoration: "none", color: "var(--ink)" }}>
              <span style={{ width: "40px", height: "40px", borderRadius: "800px", background: AV[i % AV.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, flex: "none" }}>{c.name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2) || "?"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: 500 }}>{c.name}</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{c.time}</span></span>
                <span style={{ display: "block", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</span>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "2px" }}><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{c.meta.split(" · ").slice(0, 2).join(" · ")}{c.sede ? ` · ${c.sede}` : ""}</span>{st === "atencion" && <span style={{ padding: "0 7px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px", lineHeight: "20px" }}>Te necesita</span>}</span>
              </span>
            </a>
          );
        })}
      </div>
    </MobileFrame>
  );
}
