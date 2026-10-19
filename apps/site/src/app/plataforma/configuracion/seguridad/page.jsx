"use client";
import { useState } from "react";
import SettingsShell from "@/components/settings-shell";

// Seguridad y acceso: resumen con estado real y entrada a los recorridos
// (activar 2FA, configurar SSO). SCIM revela el token una sola vez; los rangos de
// IP se validan; cerrar todas las sesiones pide confirmación.
// TODO(backend): Supabase Auth MFA (TOTP), SSO SAML, SCIM, allowlist y
// invalidación global de sesiones (🔒, audit_logs).
const card = { background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const sub = { fontSize: "13px", color: "var(--muted)" };
const btn = (dark) => ({ padding: "9px 16px", borderRadius: "800px", border: dark ? "1px solid var(--ink)" : "1px solid var(--line)", background: dark ? "var(--ink)" : "var(--paper)", color: dark ? "var(--on-ink)" : "var(--ink)", font: "500 14px/18px var(--font-display)", cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" });
const field = { boxSizing: "border-box", padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/18px var(--font-body)", color: "var(--ink)" };
const ent = { padding: "2px 10px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)", fontSize: "12px", lineHeight: "18px" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid var(--line-soft)", paddingTop: "14px", flexWrap: "wrap" };
const TEAM = [["Marta Ruiz", "Dueña", true], ["Javier Soler", "Gerente", true], ["Carmen Díaz", "Recepción", false], ["Lucía Vidal", "Profesional", true], ["Andrés Gil", "Profesional", false]];
const CIDR = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}\/([0-9]|[12]\d|3[0-2])$/;

// Solo demo: en producción el servidor genera el secreto con un CSPRNG
// (crypto.randomBytes) y guarda únicamente su hash + un prefijo no secreto.
const demoSecret = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

function Switch({ on, onClick, label, disabled }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? "#004c39" : "var(--track-2)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}><span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "var(--paper)" }} /></button>;
}

export default function Seguridad() {
  const [enforce, setEnforce] = useState(false);
  const [scim, setScim] = useState(null);     // null | token (solo visible ahora) | "hidden"
  const [ranges, setRanges] = useState(["80.25.0.0/16"]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [closing, setClosing] = useState(null); // null | confirming | done
  const without = TEAM.filter((t) => !t[2]);
  const add = () => { const v = draft.trim(); if (!CIDR.test(v)) { setErr("Usa el formato CIDR, p. ej. 80.25.0.0/16"); return; } if (ranges.includes(v)) { setErr("Ese rango ya está en la lista"); return; } setRanges([...ranges, v]); setDraft(""); setErr(""); };
  const genScim = () => setScim(`scim_${demoSecret(32)}`);

  return (
    <SettingsShell active="seguridad" title="Seguridad y acceso." intro="Cómo entra tu equipo y desde dónde.">
      <section style={card}>
        <h2 style={h2}>Verificación en dos pasos</h2>
        <div style={row}>
          <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span>Tu cuenta</span><span style={sub}>Sin verificación en dos pasos.</span></span>
          <a href="/plataforma/configuracion/seguridad/2fa" style={btn(true)}>Activar en mi cuenta</a>
        </div>
        <div style={row}>
          <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span>Exigir 2FA a todo el equipo</span><span style={sub}>{without.length} de {TEAM.length} personas aún no la tienen: {without.map((t) => t[0]).join(", ")}. Tendrán que activarla al entrar.</span></span>
          <Switch label="Exigir 2FA a todo el equipo" on={enforce} onClick={() => setEnforce(!enforce)} />
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}><h2 style={h2}>Inicio de sesión único (SSO)</h2><span style={ent}>Enterprise</span></div>
        <span style={sub}>Tu equipo entra con la cuenta de la empresa (Google Workspace, Microsoft Entra ID, Okta u otro proveedor SAML).</span>
        <div style={row}>
          <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span>Estado</span><span style={sub}>Sin configurar · dominio clinicadentalsol.es sin verificar</span></span>
          <a href="/plataforma/configuracion/seguridad/sso" style={btn(true)}>Configurar SSO</a>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}><h2 style={h2}>Altas y bajas automáticas (SCIM)</h2><span style={ent}>Enterprise</span></div>
        <span style={sub}>Tu directorio da de alta y de baja a las personas automáticamente. Necesitas un token que se muestra una sola vez.</span>
        {scim && scim !== "hidden" ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: "8px", background: "var(--linen)", borderRadius: "10px", padding: "14px" }}>
            <span style={{ fontWeight: 500 }}>Copia el token ahora: no se volverá a mostrar.</span>
            <span style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><input readOnly value={scim} aria-label="Token SCIM" style={{ ...field, flex: "1 1 240px", fontFamily: "var(--font-mono)" }} /><button type="button" data-demo="" onClick={() => navigator.clipboard?.writeText(scim)} style={btn(false)}>Copiar</button><button type="button" onClick={() => setScim("hidden")} style={btn(true)}>Ya lo he guardado</button></span>
          </div>
        ) : (
          <div style={row}>
            <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span>Token SCIM</span><span style={sub}>{scim === "hidden" ? "Activo · scim_•••• (creado hoy)" : "Sin token"}</span></span>
            <button type="button" onClick={genScim} style={btn(scim !== "hidden")}>{scim === "hidden" ? "Rotar token" : "Generar token"}</button>
          </div>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>Acceso por red</h2>
        <span style={sub}>Solo se podrá entrar desde estos rangos de IP. Lista vacía = sin restricción.</span>
        {ranges.map((r) => (
          <div key={r} style={row}><span style={{ fontFamily: "var(--font-mono)" }}>{r}</span><button type="button" onClick={() => setRanges(ranges.filter((x) => x !== r))} style={btn(false)} aria-label={`Quitar ${r}`}>Quitar</button></div>
        ))}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 220px", maxWidth: "280px" }}>
            <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Nuevo rango de IP</span>
            <input value={draft} onChange={(e) => { setDraft(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="p. ej. 81.40.12.0/24" aria-invalid={!!err} aria-describedby={err ? "cidr-err" : undefined} style={{ ...field, borderColor: err ? "var(--rose-fg)" : "var(--line)" }} />
            {err && <span id="cidr-err" role="alert" style={{ fontSize: "12px", color: "var(--rose-fg)" }}>{err}</span>}
          </label>
          <button type="button" onClick={add} style={btn(false)}>Añadir rango</button>
        </div>
      </section>

      <section style={{ ...card, border: "1px solid var(--rose-line)" }}>
        <h2 style={h2}>Zona delicada</h2>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={sub}>{closing === "done" ? "Se han cerrado todas las sesiones. Cada persona tendrá que volver a entrar." : "Cerrar la sesión de todas las personas del espacio (por ejemplo, si un portátil se ha perdido)."}</span>
          <button type="button" disabled={closing === "done"} onClick={() => setClosing("confirming")} style={{ ...btn(false), color: "var(--rose-fg)", borderColor: "var(--rose-line)", opacity: closing === "done" ? 0.5 : 1 }}>Cerrar todas las sesiones</button>
        </div>
      </section>

      {closing === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label="Cerrar todas las sesiones" onClick={() => setClosing(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Cerrar todas las sesiones?</span>
            <span style={{ ...sub, fontSize: "14px", lineHeight: "21px" }}>Las {TEAM.length} personas del espacio (tú incluida) tendrán que volver a entrar. Los agentes siguen funcionando. Queda registrado.</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setClosing(null)} style={btn(false)}>Cancelar</button>
              <button type="button" onClick={() => setClosing("done")} style={{ ...btn(true), background: "#a30042", borderColor: "var(--rose-fg)" }}>Cerrar todas</button>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
