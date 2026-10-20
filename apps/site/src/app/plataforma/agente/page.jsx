"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { AGENT_DOT, dashboardFor } from "@/components/sede-data";

// Mis agentes: un agente visible a la vez, con selector para cambiar entre los
// cuatro. Cada agente tiene su color (fuente única AGENT_DOT), sus skills, su tono y
// su estado real en la sede activa. Admite ?a=clave (reception|recepcion, …).
// TODO(backend): leer agents + agent_skills + business_rules del tenant; el
// selector cambia de agente; los toggles escriben agent_skills.
const AGENTS = [
  {
    key: "reception", es: "recepcion", name: "Recepción", color: AGENT_DOT.recepcion, sub: "Citas, agenda y llamadas · Plantilla Clínicas", status: "active",
    skills: [
      { id: "reservar", name: "Reservar citas", desc: "Ofrece huecos libres y crea la cita en Calendar.", approval: false, on: true },
      { id: "reprogramar", name: "Reprogramar y cancelar", desc: "Mueve citas a petición del paciente.", approval: false, on: true },
      { id: "recordatorios", name: "Recordatorios 24 h antes", desc: "Por WhatsApp, con confirmación de asistencia.", approval: false, on: true },
      { id: "espera", name: "Lista de espera", desc: "Avisa a pacientes en espera cuando se libera un hueco.", approval: false, on: true },
      { id: "llamadas", name: "Atender llamadas", desc: "Contesta, reserva y pasa la llamada si hace falta.", approval: false, on: true },
      { id: "masivo", name: "Mover citas en bloque", desc: "Reorganiza la agenda ante bajas o cierres.", approval: true, on: true },
      { id: "resenas", name: "Pedir reseña tras la visita", desc: "Envía un enlace a Google Reviews al día siguiente.", approval: false, on: false },
    ],
    tono: "Cercano", tonos: { Cercano: "“¡Hola, Laura! Tengo el jueves a las 10:30 o el viernes a las 17:00. ¿Cuál te viene mejor?”", Formal: "“Buenos días, Laura. Disponemos de cita el jueves a las 10:30 o el viernes a las 17:00. Indíquenos su preferencia.”", Breve: "“Jue 10:30 o vie 17:00. ¿Cuál?”" },
  },
  {
    key: "customer", es: "atencion", name: "Atención al cliente", color: AGENT_DOT.atencion, sub: "Incidencias, seguimiento y relación", status: "active",
    skills: [
      { id: "dudas", name: "Responder dudas", desc: "Precios, horarios, preparación de tratamientos.", approval: false, on: true },
      { id: "seguimiento", name: "Seguimiento post-visita", desc: "Pregunta cómo ha ido y detecta problemas.", approval: false, on: true },
      { id: "incidencias", name: "Gestionar incidencias", desc: "Abre y hace seguimiento de un problema.", approval: false, on: true },
      { id: "quejas", name: "Resolver quejas", desc: "Propone compensación dentro de un límite.", approval: true, on: true },
      { id: "derivar", name: "Derivar a humano", desc: "Pasa el caso a una persona cuando hace falta.", approval: false, on: true },
      { id: "encuesta", name: "Encuesta de satisfacción", desc: "Envía NPS tras cerrar la incidencia.", approval: false, on: false },
    ],
    tono: "Cercano", tonos: { Cercano: "“Siento el fallo, Laura. Lo soluciono ahora mismo y te confirmo en cuanto esté. ¿Te va bien?”", Formal: "“Lamentamos la incidencia, Laura. La estamos resolviendo y le confirmaremos en cuanto esté solucionada.”", Breve: "“Lo siento. Lo arreglo y te aviso.”" },
  },
  {
    key: "sales", es: "comercial", name: "Comercial", color: AGENT_DOT.comercial, sub: "Leads, presupuestos y recuperación", status: "active",
    skills: [
      { id: "cualificar", name: "Cualificar leads", desc: "Entiende la necesidad y clasifica el lead.", approval: false, on: true },
      { id: "presupuesto", name: "Enviar presupuesto", desc: "Prepara y manda el presupuesto del tratamiento.", approval: true, on: true },
      { id: "recuperar", name: "Recuperar presupuestos", desc: "Hace seguimiento de presupuestos sin cerrar.", approval: false, on: true },
      { id: "recomendar", name: "Recomendar tratamientos", desc: "Sugiere según el caso, sin diagnosticar.", approval: false, on: true },
      { id: "primeravisita", name: "Agendar primera visita", desc: "Convierte el interés en una cita gratuita.", approval: false, on: true },
      { id: "descuento", name: "Ofrecer descuento", desc: "Aplica un descuento dentro de un margen.", approval: true, on: false },
    ],
    tono: "Cercano", tonos: { Cercano: "“Te preparo un presupuesto sin compromiso. ¿Quieres que lo veamos en una primera visita gratuita?”", Formal: "“Le preparamos un presupuesto sin compromiso. Podemos revisarlo en una primera visita sin coste.”", Breve: "“Presupuesto sin compromiso. ¿Primera visita gratis?”" },
  },
  {
    key: "admin", es: "admin", name: "Administración", color: AGENT_DOT.admin, sub: "Facturas, cobros y día a día", status: "active",
    skills: [
      { id: "factura", name: "Emitir factura", desc: "Crea y envía la factura tras la visita.", approval: true, on: true },
      { id: "cobro", name: "Registrar cobro", desc: "Anota el pago y concilia con la factura.", approval: true, on: true },
      { id: "recordatorio", name: "Recordatorio de pago", desc: "Avisa de facturas pendientes con tacto.", approval: false, on: true },
      { id: "informe", name: "Informe mensual", desc: "Resume ingresos, citas y pendientes.", approval: false, on: true },
      { id: "inventario", name: "Avisar de inventario bajo", desc: "Detecta material por debajo del mínimo.", approval: false, on: true },
      { id: "plazos", name: "Pago a plazos", desc: "Propone fraccionar el pago.", approval: true, on: false },
    ],
    tono: "Formal", tonos: { Cercano: "“¡Hola, Laura! Te paso la factura de tu última visita (75,00 €). Cualquier duda, me dices.”", Formal: "“Hola Laura, te adjunto la factura de tu última visita (75,00 €). Cualquier duda, aquí estoy.”", Breve: "“Factura adjunta: 75,00 €.”" },
  },
];

const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px" };
const LIGHT = ["#9dbecc", "#a3c2a7", "#f6f2e8"];
const AgentIcon = ({ color }) => (
  <span style={{ width: "56px", height: "56px", borderRadius: "800px", background: color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={LIGHT.includes(color) ? "var(--ink)" : "#ffffff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>
  </span>
);

export default function Screen() {
  const { sede } = useSede();
  const [sel, setSel] = useState(0);
  const [on, setOn] = useState({});         // overrides por "agentKey:skillId"
  const [paused, setPaused] = useState({});  // overrides de estado por agente
  const [tone, setTone] = useState({});      // tono elegido por agente
  // ?a=clave → abre ese agente (acepta la clave canónica o la de sede-data).
  useEffect(() => { const k = new URLSearchParams(window.location.search).get("a"); const i = AGENTS.findIndex((g) => g.key === k || g.es === k); if (i >= 0) setSel(i); }, []);
  const a = AGENTS[sel];
  const base = dashboardFor(sede).agents.find((g) => g.key === a.es);
  const isPaused = a.key in paused ? paused[a.key] : /Pausado/.test(base?.status.label ?? "");
  const curTone = tone[a.key] ?? a.tono;
  const isOn = (s) => { const k = `${a.key}:${s.id}`; return k in on ? on[k] : s.on; };
  const toggle = (s) => setOn((o) => ({ ...o, [`${a.key}:${s.id}`]: !isOn(s) }));
  const activeCount = a.skills.filter(isOn).length;

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agentes" /></div>
      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "14px", lineHeight: "21px", color: "var(--muted)" }}>{`Agentes / ${a.name}`}</span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <div role="tablist" aria-label="Tus agentes" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {AGENTS.map((g, i) => {
              const cur = i === sel;
              return (
                <button key={g.key} type="button" role="tab" aria-selected={cur} onClick={() => setSel(i)} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "800px", border: "1px solid", borderColor: cur ? "var(--ink)" : "var(--line)", background: cur ? "var(--ink)" : "var(--paper)", color: cur ? "var(--on-ink)" : "var(--ink)", font: "500 13px/13px var(--font-display)", cursor: "pointer" }}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "800px", background: g.color, flex: "none", boxShadow: cur ? "0 0 0 2px var(--on-ink-55)" : "none" }} />{g.name}
                </button>
              );
            })}
          </div>
            <a href="/plataforma/agente-nuevo" style={{ display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: "800px", border: "1px dashed var(--line-strong)", background: "transparent", color: "var(--muted)", font: "500 13px/13px var(--font-display)", textDecoration: "none" }}>+ Nuevo agente</a>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <AgentIcon color={a.color} />
            <div><h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>{a.name}</h1><span style={{ fontSize: "14px", lineHeight: "21px", color: "var(--muted)" }}>{a.sub}</span></div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ padding: "6px 12px", borderRadius: "800px", background: isPaused ? "var(--sunken)" : "var(--green-bg)", color: isPaused ? "var(--muted)" : "var(--green-fg)", fontSize: "14px", lineHeight: "14px" }}>{isPaused ? "○ Pausado" : "● Activo"}</span>
            <button type="button" onClick={() => setPaused((x) => ({ ...x, [a.key]: !isPaused }))} style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>{isPaused ? "Reanudar" : "Pausar"}</button>
            <a href={`/plataforma/probar?a=${a.key}`} style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", textDecoration: "none" }}>Probar</a>
            <a href={`/plataforma/publicar?a=${a.key}`} style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", textDecoration: "none" }}>Publicar cambios</a>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[["Techo de autonomía", `/plataforma/autonomia?a=${a.key}`], ["Voz del agente", `/plataforma/voz?a=${a.key}`], ["Conocimiento", "/plataforma/conocimiento"], ["Memoria del negocio", "/plataforma/memoria"]].map(([l, h]) => (<a key={l} href={h} style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 13px/13px var(--font-display)", textDecoration: "none" }}>{l}</a>))}
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...box, flex: "3 1 460px", minWidth: "0", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--line-soft)", gap: "12px", flexWrap: "wrap" }}>
              <div><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Skills</h2><span style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{`${activeCount} de ${a.skills.length} activas · Configuradas de serie para clínicas`}</span></div>
            </div>
            {a.skills.map((s) => {
              const act = isOn(s);
              return (
                <div key={s.id} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
                  <div style={{ flex: "1", minWidth: "0" }}>
                    <div style={{ fontSize: "14px", lineHeight: "21px", fontWeight: "500" }}>{s.name}</div>
                    <div style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{s.desc}</div>
                  </div>
                  {s.approval && <span style={{ padding: "4px 10px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px", lineHeight: "16px", whiteSpace: "nowrap" }}>Con aprobación</span>}
                  <button type="button" role="switch" aria-checked={act} aria-label={s.name} onClick={() => toggle(s)} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: act ? "var(--ink)" : "var(--track)", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", top: "3px", left: act ? "19px" : "3px", width: "18px", height: "18px", borderRadius: "800px", background: "var(--paper)", transition: "left .15s ease" }}></span></button>
                </div>
              );
            })}
          </section>

          <div style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
            <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tono</h2>
              <Pills label={`Tono de ${a.name}`} options={[["Cercano", "Cercano"], ["Formal", "Formal"], ["Breve", "Breve"]]} value={curTone} onChange={(t) => setTone((x) => ({ ...x, [a.key]: t }))} />
              <div style={{ background: "var(--canvas)", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", lineHeight: "21px", color: "var(--muted)" }}>{a.tonos[curTone]}</div>
            </section>
            <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Canales</h2>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>WhatsApp Business</span><span style={{ color: "var(--green-fg)" }}>Conectado</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Teléfono (voz)</span><span style={{ color: "var(--green-fg)" }}>Conectado</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Google Calendar</span><a href="/plataforma/configuracion/integraciones" style={{ color: "var(--amber-fg)" }}>! Reconectar</a></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Instagram</span><a href="/plataforma/configuracion/integraciones" style={{ color: "var(--blue-fg)" }}>Conectar</a></div>
            </section>
            <section style={{ borderRadius: "12px", background: "var(--mist)", padding: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
              <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Lo que sabe de tu negocio</h2>
              <span>Horario: L–V 9:00–20:00 · 2 sedes · 4 profesionales · 5 servicios con precio.</span>
              <a href="/plataforma/memoria" style={{ fontWeight: "500" }}>Editar memoria →</a>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
