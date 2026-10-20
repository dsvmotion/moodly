"use client";
import { ArrowLeft, Bot, Braces, Building2, CreditCard, KeyRound, Lock, Plug, Receipt, ScrollText, ShieldCheck, SlidersHorizontal, Store, User, Users } from "lucide-react";

// Menú lateral del modo Configuración (referencia: Langdock). Sustituye al menú
// de operación; se vuelve a la plataforma con el enlace de arriba.
const GROUPS = [
  ["Personal", [
    ["perfil", "Mi perfil", "/plataforma/configuracion/perfil", User],
    ["preferencias", "Preferencias", "/plataforma/configuracion/preferencias", SlidersHorizontal],
    ["privacidad", "Privacidad", "/plataforma/configuracion/privacidad", ShieldCheck],
  ]],
  ["Equipo y permisos", [
    ["equipo", "Miembros", "/plataforma/configuracion/equipo", Users],
    ["roles", "Roles", "/plataforma/configuracion/roles", KeyRound],
  ]],
  ["Tu negocio", [
    ["general", "General", "/plataforma/configuracion/general", Building2],
    ["sedes", "Sedes", "/plataforma/configuracion/sedes", Store],
    ["plan", "Plan y consumo", "/plataforma/configuracion/plan", CreditCard],
    ["facturacion", "Facturación", "/plataforma/configuracion/facturacion", Receipt],
  ]],
  ["IA y conexiones", [
    ["modelos", "Modelos de IA", "/plataforma/configuracion/modelos", Bot],
    ["integraciones", "Integraciones", "/plataforma/configuracion/integraciones", Plug],
    ["api", "Claves de API", "/plataforma/configuracion/api", Braces],
  ]],
  ["Seguridad", [
    ["seguridad", "Seguridad y acceso", "/plataforma/configuracion/seguridad", Lock],
    ["auditoria", "Registro de auditoría", "/plataforma/configuracion/auditoria", ScrollText],
  ]],
];

export default function SettingsNav({ active }) {
  return (
    <nav aria-label="Configuración" data-sidenav="" style={{ width: "248px", minHeight: "100dvh", boxSizing: "border-box", padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px", fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", borderRight: "1px solid var(--line-soft)", letterSpacing: "-0.16px", fontSize: "14px", lineHeight: "20px" }}>
      <a href="/plataforma" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px 14px", color: "var(--muted)", textDecoration: "none" }}>
        <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />Volver a la plataforma
      </a>
      <span style={{ padding: "0 10px 10px", fontSize: "20px", lineHeight: "26px", fontWeight: 400, letterSpacing: "-0.4px", color: "var(--ink)" }}>Configuración</span>
      {GROUPS.map(([title, items]) => (
        <div key={title} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ padding: "16px 10px 6px", fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{title}</span>
          {items.map(([key, label, href, Icon]) => {
            const on = key === active;
            return (
              <a key={key} href={href} aria-current={on ? "page" : undefined} className={on ? undefined : "side-link"} style={{ padding: "7px 10px", borderRadius: "10px", textDecoration: "none", display: "flex", gap: "10px", alignItems: "center", background: on ? "var(--line-soft)" : "transparent", color: on ? "var(--ink)" : "var(--ink-2)", fontWeight: on ? 500 : 400 }}>
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" style={{ flex: "none", color: on ? "var(--ink)" : "var(--muted)" }} />
                <span style={{ flex: 1 }}>{label}</span>
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
