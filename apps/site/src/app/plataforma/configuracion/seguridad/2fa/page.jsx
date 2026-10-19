"use client";
import { useMemo, useState } from "react";
import SettingsShell from "@/components/settings-shell";

// Activar la verificación en dos pasos (TOTP) en tu cuenta: escanear → confirmar
// con un código → guardar los códigos de recuperación → hecho.
// TODO(backend): Supabase Auth MFA (enroll/challenge/verify); los códigos de
// recuperación se guardan con hash; activar y desactivar quedan en audit_logs.
const card = { background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", lineHeight: "21px" };
const muted = { color: "#5f5f63" };
const btn = (dark) => ({ padding: "11px 18px", borderRadius: "800px", border: dark ? "1px solid #000000" : "1px solid #0000001a", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer", textDecoration: "none" });
const STEPS = ["Escanear", "Confirmar", "Recuperación", "Listo"];
const SECRET = "JBSW Y3DP EHPK 3PXP";

// QR ilustrativo determinista (no es un QR real; el backend lo genera de verdad).
function FakeQR() {
  const cells = useMemo(() => { const out = []; let x = 7; for (let i = 0; i < 21 * 21; i++) { x = (x * 1103515245 + 12345) % 2147483648; out.push(x % 3 === 0); } return out; }, []);
  const finder = (r, c) => { const inF = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7; if (!(inF(0, 0) || inF(0, 14) || inF(14, 0))) return null; const rr = r % 7 === r ? r : r - 14, cc = c >= 14 ? c - 14 : c; const ring = rr === 0 || rr === 6 || cc === 0 || cc === 6; const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4; return ring || core; };
  return (
    <svg role="img" aria-label="Código QR para tu app de autenticación" width="168" height="168" viewBox="0 0 21 21" style={{ background: "#ffffff", padding: "8px", borderRadius: "8px", boxShadow: "inset 0 0 0 1px #0000001a" }} shapeRendering="crispEdges">
      {cells.map((on, i) => { const r = Math.floor(i / 21), c = i % 21; const f = finder(r, c); const fill = f === null ? on : f; return fill ? <rect key={i} x={c} y={r} width="1" height="1" fill="#000000" /> : null; })}
    </svg>
  );
}

export default function DosPasos() {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const codes = useMemo(() => Array.from({ length: 8 }, (_, i) => `${(48213 + i * 7919).toString(36)}-${(91027 + i * 3571).toString(36)}`.toUpperCase()), []);
  const verify = () => { if (!/^\d{6}$/.test(code)) { setErr("Escribe los 6 números que muestra tu app."); return; } if (code === "000000") { setErr("Ese código no es válido o ha caducado. Prueba con el siguiente que muestre tu app."); return; } setErr(""); setStep(3); };

  return (
    <SettingsShell active="seguridad" title="Verificación en dos pasos" intro="· tu cuenta">
      <a href="/plataforma/configuracion/seguridad" style={{ fontSize: "14px", color: "#5f5f63", textDecoration: "none" }}>‹ Seguridad y acceso</a>
      <ol aria-label="Pasos" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "13px" }}>
        {STEPS.map((l, i) => { const n = i + 1; const cur = step === n; const done = step > n; return <li key={l} aria-current={cur ? "step" : undefined} style={{ padding: "6px 12px", borderRadius: "800px", ...(cur ? { background: "#000000", color: "#ffffff" } : done ? { background: "#dcebdd", color: "#004c39" } : { boxShadow: "inset 0 0 0 1px #0000001a", color: "#5f5f63" }) }}>{done ? "✓" : n} · {l}</li>; })}
      </ol>

      {step === 1 && (
        <section style={card}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Escanea el código con tu app de autenticación</span>
          <span style={muted}>Google Authenticator, Microsoft Authenticator, 1Password o similar. Cada vez que entres te pediremos el código de 6 números que muestre.</span>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
            <FakeQR />
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 220px" }}>
              <span style={muted}>¿No puedes escanear? Escribe esta clave en la app:</span>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "16px", letterSpacing: "1px", padding: "10px 12px", borderRadius: "10px", background: "#f4f4f5" }}>{SECRET}</code>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={() => setStep(2)} style={btn(true)}>Ya la he añadido</button></div>
        </section>
      )}

      {step === 2 && (
        <section style={card}>
          <label htmlFor="totp" style={{ fontSize: "17px", fontWeight: 500 }}>Escribe el código que muestra la app</label>
          <input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") verify(); }} placeholder="123456" aria-invalid={!!err} aria-describedby={err ? "totp-err" : "totp-help"} style={{ width: "200px", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${err ? "#a30042" : "#0000001a"}`, font: "500 24px/28px var(--font-mono)", letterSpacing: "6px", color: "#000000" }} />
          {err ? <span id="totp-err" role="alert" style={{ color: "#a30042" }}>{err}</span> : <span id="totp-help" style={muted}>El código cambia cada 30 segundos.</span>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><button type="button" onClick={() => setStep(1)} style={btn(false)}>Atrás</button><button type="button" onClick={verify} style={btn(true)}>Comprobar</button></div>
        </section>
      )}

      {step === 3 && (
        <section style={card}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Guarda tus códigos de recuperación</span>
          <span style={muted}>Si pierdes el móvil, cada código te deja entrar una vez. Guárdalos en un sitio seguro: no los volveremos a mostrar.</span>
          <ul aria-label="Códigos de recuperación" style={{ margin: 0, padding: "16px", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", background: "#f4f4f5", borderRadius: "10px", fontFamily: "var(--font-mono)", fontSize: "15px" }}>
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" data-demo="" style={btn(false)}>Descargar .txt</button>
            <button type="button" data-demo="" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))} style={btn(false)}>Copiar</button>
          </div>
          <label style={{ display: "flex", gap: "10px", alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} style={{ width: "18px", height: "18px" }} />He guardado los códigos en un sitio seguro</label>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" disabled={!saved} onClick={() => setStep(4)} style={{ ...btn(true), opacity: saved ? 1 : 0.45, cursor: saved ? "pointer" : "not-allowed" }}>Activar verificación</button></div>
        </section>
      )}

      {step === 4 && (
        <section style={{ ...card, background: "#dcebdd", color: "#004c39" }} role="status">
          <span style={{ fontSize: "17px", fontWeight: 500 }}>✓ Verificación en dos pasos activada</span>
          <span>A partir de ahora te pediremos el código al entrar desde un dispositivo nuevo. Lo hemos anotado en el registro de auditoría.</span>
          <a href="/plataforma/configuracion/seguridad" style={{ ...btn(true), alignSelf: "flex-start" }}>Volver a Seguridad</a>
        </section>
      )}
    </SettingsShell>
  );
}
