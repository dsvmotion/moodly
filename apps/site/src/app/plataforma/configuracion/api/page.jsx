"use client";
import { useState } from "react";
import SettingsShell from "@/components/settings-shell";

// Claves de API: crear (nombre, permisos, caducidad) → se muestra UNA vez → lista
// con último uso → revocar con confirmación.
// TODO(backend): api_keys (solo hash + prefijo), permisos por clave, caducidad,
// last_used_at; crear y revocar son 🔒 y quedan en audit_logs.
const card = { background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const muted = { color: "var(--muted)" };
const btn = (dark) => ({ padding: "10px 16px", borderRadius: "800px", border: dark ? "1px solid var(--ink)" : "1px solid var(--line)", background: dark ? "var(--ink)" : "var(--paper)", color: dark ? "var(--on-ink)" : "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer", whiteSpace: "nowrap" });
const field = { boxSizing: "border-box", width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/18px var(--font-body)", color: "var(--ink)" };
const SCOPES = [["conversations:read", "Leer conversaciones"], ["messages:write", "Enviar mensajes"], ["contacts:read", "Leer clientes"], ["contacts:write", "Crear y editar clientes"], ["appointments:write", "Crear y mover citas"], ["webhooks", "Recibir eventos (webhooks)"]];
const INITIAL = [
  { id: "k1", name: "Integración web de reservas", prefix: "mdl_live_8f2a", scopes: ["appointments:write", "contacts:read"], created: "2 oct 2026", by: "Marta Ruiz", used: "hace 6 min", exp: "2 oct 2027" },
  { id: "k2", name: "Informe semanal (Make)", prefix: "mdl_live_31cc", scopes: ["conversations:read"], created: "5 oct 2026", by: "Javier Soler", used: "hace 2 días", exp: "Sin caducidad" },
];

// Solo demo: en producción el servidor genera el secreto con un CSPRNG
// (crypto.randomBytes) y guarda únicamente su hash + un prefijo no secreto.
const demoSecret = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

export default function Api() {
  const [keys, setKeys] = useState(INITIAL);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["conversations:read"]);
  const [exp, setExp] = useState("90");
  const [secret, setSecret] = useState(null);   // clave recién creada (solo ahora)
  const [revoking, setRevoking] = useState(null);
  const toggle = (s) => setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const canCreate = name.trim().length > 2 && scopes.length > 0;
  const create = () => {
    const rand = demoSecret(4);
    const full = `mdl_live_${rand}${demoSecret(28)}`;
    const expTxt = exp === "never" ? "Sin caducidad" : `en ${exp} días`;
    setKeys([{ id: `k${Date.now()}`, name: name.trim(), prefix: `mdl_live_${rand}`, scopes, created: "Hoy", by: "Marta Ruiz", used: "Nunca", exp: expTxt }, ...keys]);
    setSecret(full); setCreating(false); setName(""); setScopes(["conversations:read"]); setExp("90");
  };

  return (
    <SettingsShell active="api" title="Claves de API." intro="Para conectar tus propias herramientas." actions={<button type="button" onClick={() => setCreating(true)} style={btn(true)}>Crear clave</button>}>
      {secret && (
        <section role="status" style={{ ...card, background: "var(--linen)" }}>
          <strong style={{ fontWeight: 500 }}>Copia la clave ahora: no se volverá a mostrar.</strong>
          <span style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><input readOnly value={secret} aria-label="Clave de API nueva" style={{ ...field, flex: "1 1 300px", fontFamily: "var(--font-mono)" }} /><button type="button" data-demo="" onClick={() => navigator.clipboard?.writeText(secret)} style={btn(false)}>Copiar</button><button type="button" onClick={() => setSecret(null)} style={btn(true)}>Ya la he guardado</button></span>
          <span style={{ fontSize: "13px", ...muted }}>Guárdala como un secreto (gestor de contraseñas o variables de entorno). Si la pierdes, revócala y crea otra.</span>
        </section>
      )}

      <section style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
          <caption style={{ textAlign: "left", padding: "18px 24px 6px", fontSize: "13px", color: "var(--muted)" }}>{keys.length} {keys.length === 1 ? "clave activa" : "claves activas"}. Solo guardamos el principio de cada clave.</caption>
          <thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th scope="col" style={{ padding: "10px 24px", fontWeight: 500 }}>Nombre</th><th scope="col" style={{ padding: "10px", fontWeight: 500 }}>Permisos</th><th scope="col" style={{ padding: "10px", fontWeight: 500 }}>Último uso</th><th scope="col" style={{ padding: "10px", fontWeight: 500 }}>Caduca</th><th scope="col" style={{ padding: "10px 24px" }}><span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Acciones</span></th></tr></thead>
          <tbody>
            {keys.length === 0 && <tr><td colSpan={5} style={{ padding: "20px 24px", ...muted }}>No hay claves. Crea una para conectar tus herramientas.</td></tr>}
            {keys.map((k) => (
              <tr key={k.id} style={{ borderTop: "1px solid var(--line-soft)", verticalAlign: "top" }}>
                <td style={{ padding: "14px 24px" }}><span style={{ display: "block", fontWeight: 500 }}>{k.name}</span><span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", ...muted }}>{k.prefix}••••</span><span style={{ display: "block", fontSize: "12px", ...muted }}>{k.created} · {k.by}</span></td>
                <td style={{ padding: "14px 10px" }}><span style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{k.scopes.map((s) => <span key={s} style={{ padding: "2px 8px", borderRadius: "800px", background: "var(--canvas)", fontSize: "12px" }}>{SCOPES.find((x) => x[0] === s)?.[1] ?? s}</span>)}</span></td>
                <td style={{ padding: "14px 10px", ...muted }}>{k.used}</td>
                <td style={{ padding: "14px 10px", ...muted }}>{k.exp}</td>
                <td style={{ padding: "14px 24px", textAlign: "right" }}><button type="button" onClick={() => setRevoking(k)} style={{ ...btn(false), padding: "7px 12px", color: "var(--rose-fg)", borderColor: "var(--rose-line)" }}>Revocar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={card}>
        <span style={{ fontWeight: 500 }}>Buenas prácticas</span>
        <span style={muted}>Una clave por herramienta, con los permisos mínimos y caducidad. Las claves actúan con los permisos de la organización, nunca con los de una persona: no pueden aprobar acciones sensibles.</span>
      </section>

      {creating && (
        <div role="dialog" aria-modal="true" aria-label="Crear clave de API" onClick={() => setCreating(false)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: "0 24px 64px #00000033", fontSize: "14px" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>Nueva clave de API</span>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--muted)" }}>Nombre (para reconocerla)<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Web de reservas" style={field} /></label>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              <legend style={{ color: "var(--muted)", marginBottom: "6px" }}>Permisos</legend>
              {SCOPES.map(([v, l]) => <label key={v} style={{ display: "flex", gap: "10px", alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={scopes.includes(v)} onChange={() => toggle(v)} style={{ width: "18px", height: "18px" }} />{l}</label>)}
            </fieldset>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--muted)" }}>Caducidad<select value={exp} onChange={(e) => setExp(e.target.value)} style={field}><option value="30">30 días</option><option value="90">90 días (recomendado)</option><option value="365">1 año</option><option value="never">Sin caducidad</option></select></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}><button type="button" onClick={() => setCreating(false)} style={btn(false)}>Cancelar</button><button type="button" disabled={!canCreate} onClick={create} style={{ ...btn(true), opacity: canCreate ? 1 : 0.45, cursor: canCreate ? "pointer" : "not-allowed" }}>Crear clave</button></div>
          </div>
        </div>
      )}

      {revoking && (
        <div role="dialog" aria-modal="true" aria-label="Revocar clave" onClick={() => setRevoking(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Revocar «{revoking.name}»?</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Dejará de funcionar al instante. Lo que la use ({revoking.used === "Nunca" ? "aún no se ha usado" : `último uso ${revoking.used}`}) empezará a recibir errores 401. No se puede deshacer.</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}><button type="button" onClick={() => setRevoking(null)} style={btn(false)}>Cancelar</button><button type="button" onClick={() => { setKeys(keys.filter((x) => x.id !== revoking.id)); setRevoking(null); }} style={{ ...btn(true), background: "#a30042", borderColor: "var(--rose-fg)" }}>Revocar</button></div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
