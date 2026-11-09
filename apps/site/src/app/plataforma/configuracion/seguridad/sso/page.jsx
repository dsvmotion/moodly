"use client";
import { useEffect, useRef, useState } from "react";
import SettingsShell from "@/components/settings-shell";

// Configurar SSO (SAML): verificar el dominio → conectar el proveedor de identidad
// → probar el inicio de sesión → aplicarlo al equipo. La dueña conserva un acceso
// de emergencia por si el proveedor falla.
// TODO(backend): Supabase Auth SSO (SAML 2.0) + verificación DNS TXT; aplicar SSO
// y el acceso de emergencia son 🔒 y quedan en audit_logs.
const card = { background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", lineHeight: "21px" };
const muted = { color: "var(--muted)" };
const btn = (dark) => ({ padding: "11px 18px", borderRadius: "800px", border: dark ? "1px solid var(--ink)" : "1px solid var(--line)", background: dark ? "var(--ink)" : "var(--paper)", color: dark ? "var(--on-ink)" : "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer", textDecoration: "none" });
const field = { boxSizing: "border-box", width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/18px var(--font-body)", color: "var(--ink)" };
const mono = { ...field, fontFamily: "var(--font-mono)", background: "var(--canvas)" };
const STEPS = ["Dominio", "Proveedor", "Probar", "Aplicar"];
const IDPS = [["google", "Google Workspace"], ["entra", "Microsoft Entra ID"], ["okta", "Okta"], ["saml", "Otro (SAML 2.0)"]];
const Spinner = () => <span className="mo-spin" aria-hidden="true" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid var(--on-ink-55)", borderTopColor: "var(--on-ink)", animation: "mo-spin .7s linear infinite" }} />;

function Copy({ label, value }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>{label}
      <span style={{ display: "flex", gap: "8px" }}><input readOnly value={value} style={mono} /><button type="button" data-demo="" onClick={() => navigator.clipboard?.writeText(value)} style={{ ...btn(false), padding: "9px 14px" }}>Copiar</button></span>
    </label>
  );
}

export default function Sso() {
  const [step, setStep] = useState(1);
  const [dns, setDns] = useState("idle"); // idle | checking | missing | ok
  const [idp, setIdp] = useState("google");
  const [meta, setMeta] = useState("");
  const [test, setTest] = useState("idle"); // idle | testing | ok
  const [enforce, setEnforce] = useState(true);
  const [applied, setApplied] = useState(false);
  const tries = useRef(0);
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);
  const wait = (f) => setTimeout(f, reduced.current ? 0 : 1300);
  const checkDns = () => { setDns("checking"); wait(() => { tries.current += 1; setDns(tries.current === 1 ? "missing" : "ok"); }); };
  const runTest = () => { setTest("testing"); wait(() => setTest("ok")); };
  const metaOk = /^https:\/\/\S+\.\S+/.test(meta.trim());

  return (
    <SettingsShell active="seguridad" title="Inicio de sesión único" intro="· SAML">
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}}`}</style>
      <a href="/plataforma/configuracion/seguridad" style={{ fontSize: "14px", color: "var(--muted)", textDecoration: "none" }}>‹ Seguridad y acceso</a>
      <ol aria-label="Pasos" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "13px" }}>
        {STEPS.map((l, i) => { const n = i + 1; const cur = step === n && !applied; const done = step > n || applied; return <li key={l} aria-current={cur ? "step" : undefined} style={{ padding: "6px 12px", borderRadius: "800px", ...(cur ? { background: "var(--ink)", color: "var(--on-ink)" } : done ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { boxShadow: "inset 0 0 0 1px var(--line)", color: "var(--muted)" }) }}>{done ? "✓" : n} · {l}</li>; })}
      </ol>

      {step === 1 && (
        <section style={card}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Demuestra que el dominio es tuyo</span>
          <span style={muted}>Añade este registro TXT en el DNS de <strong style={{ fontWeight: 500, color: "var(--ink)" }}>clinicadentalsol.es</strong> (donde gestiones el dominio). Puede tardar unos minutos en propagarse.</span>
          <Copy label="Nombre" value="_moodly-verification.clinicadentalsol.es" />
          <Copy label="Valor TXT" value="moodly-site-verification=7f3a9c21e8b4" />
          {dns === "missing" && <span role="alert" style={{ padding: "12px 14px", borderRadius: "10px", background: "var(--amber-bg)", color: "var(--amber-fg)" }}>Aún no vemos el registro. Si acabas de añadirlo, espera unos minutos y vuelve a comprobarlo.</span>}
          {dns === "ok" && <span role="status" style={{ padding: "12px 14px", borderRadius: "10px", background: "var(--green-bg)", color: "var(--green-fg)" }}>✓ Dominio verificado.</span>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            {dns === "ok" ? <button type="button" onClick={() => setStep(2)} style={btn(true)}>Continuar</button>
              : <button type="button" disabled={dns === "checking"} onClick={checkDns} style={{ ...btn(true), display: "inline-flex", alignItems: "center", gap: "8px", opacity: dns === "checking" ? 0.6 : 1 }}>{dns === "checking" ? <><Spinner />Comprobando…</> : dns === "missing" ? "Volver a comprobar" : "Comprobar registro"}</button>}
          </div>
        </section>
      )}

      {step === 2 && (
        <section style={card}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Conecta tu proveedor de identidad</span>
          <div role="radiogroup" aria-label="Proveedor de identidad" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px" }}>
            {IDPS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={idp === v} onClick={() => setIdp(v)} style={{ padding: "12px 14px", borderRadius: "10px", textAlign: "left", border: "1px solid", borderColor: idp === v ? "var(--ink)" : "var(--line)", outline: idp === v ? "1px solid var(--ink)" : "none", background: "var(--paper)", color: "var(--ink)", font: "500 14px/18px var(--font-display)", cursor: "pointer" }}>{l}</button>)}
          </div>
          <span style={muted}>1. En tu proveedor, crea una aplicación SAML con estos datos:</span>
          <Copy label="URL de respuesta (ACS)" value="https://auth.moodlycrm.com/sso/saml/acs/org_8f21" />
          <Copy label="Identificador (Entity ID)" value="https://auth.moodlycrm.com/sso/saml/metadata/org_8f21" />
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>2. Pega aquí la URL de metadatos que te da el proveedor
            <input value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="https://accounts.google.com/o/saml2/idp?idpid=…" aria-invalid={meta !== "" && !metaOk} style={field} />
            {meta !== "" && !metaOk && <span role="alert" style={{ color: "var(--rose-fg)" }}>Tiene que ser una URL que empiece por https://</span>}
          </label>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><button type="button" onClick={() => setStep(1)} style={btn(false)}>Atrás</button><button type="button" disabled={!metaOk} onClick={() => setStep(3)} style={{ ...btn(true), opacity: metaOk ? 1 : 0.45, cursor: metaOk ? "pointer" : "not-allowed" }}>Continuar</button></div>
        </section>
      )}

      {step === 3 && (
        <section style={card}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Prueba el inicio de sesión</span>
          <span style={muted}>Abriremos tu proveedor en una ventana nueva. Entra con tu cuenta de empresa; no afecta a nadie más del equipo.</span>
          {test === "ok" && (
            <div role="status" style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "14px", borderRadius: "10px", background: "var(--green-bg)", color: "var(--green-fg)" }}>
              <strong style={{ fontWeight: 500 }}>✓ Inicio de sesión correcto. Hemos recibido:</strong>
              <span>Email: marta.ruiz@clinicadentalsol.es · Nombre: Marta Ruiz · Grupo: Dirección</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <button type="button" onClick={() => setStep(2)} style={btn(false)}>Atrás</button>
            {test === "ok" ? <button type="button" onClick={() => setStep(4)} style={btn(true)}>Continuar</button>
              : <button type="button" disabled={test === "testing"} onClick={runTest} style={{ ...btn(true), display: "inline-flex", alignItems: "center", gap: "8px", opacity: test === "testing" ? 0.6 : 1 }}>{test === "testing" ? <><Spinner />Esperando al proveedor…</> : "Probar con mi cuenta"}</button>}
          </div>
        </section>
      )}

      {step === 4 && !applied && (
        <section style={card}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Aplícalo a tu equipo</span>
          <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}><input type="checkbox" checked={enforce} onChange={(e) => setEnforce(e.target.checked)} style={{ width: "18px", height: "18px", marginTop: "2px" }} /><span><span style={{ display: "block" }}>Obligar a entrar con SSO a todo @clinicadentalsol.es</span><span style={{ ...muted, fontSize: "13px" }}>Sin esto, cada persona puede elegir entre SSO o su contraseña.</span></span></label>
          <span style={{ padding: "12px 14px", borderRadius: "10px", background: "var(--linen)", fontSize: "13px" }}>Acceso de emergencia: tú (dueña) podrás seguir entrando con email + 2FA si el proveedor de identidad falla.</span>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><button type="button" onClick={() => setStep(3)} style={btn(false)}>Atrás</button><button type="button" onClick={() => setApplied(true)} style={btn(true)}>Activar SSO</button></div>
        </section>
      )}

      {applied && (
        <section role="status" style={{ ...card, background: "var(--green-bg)", color: "var(--green-fg)" }}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>✓ SSO activado con {IDPS.find((x) => x[0] === idp)[1]}</span>
          <span>{enforce ? "Tu equipo entrará con la cuenta de la empresa a partir de su próximo inicio de sesión." : "Tu equipo ya puede entrar con la cuenta de la empresa."} Para dar de alta y de baja automáticamente, genera un token SCIM en Seguridad.</span>
          <a href="/plataforma/configuracion/seguridad" style={{ ...btn(true), alignSelf: "flex-start" }}>Volver a Seguridad</a>
        </section>
      )}
    </SettingsShell>
  );
}
