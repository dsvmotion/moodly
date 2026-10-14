"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";

// Mis agentes: un agente visible a la vez, con selector para cambiar entre los
// cuatro. Cada agente tiene su color, sus skills, su tono y su estado.
// TODO(backend): leer agents + agent_skills + business_rules del tenant; el
// selector cambia de agente; los toggles escriben agent_skills.
const AGENTS = [
  {
    key: "reception", name: "Recepción", color: "#004c39", sub: "Citas, agenda y llamadas · Plantilla Clínicas", status: "active",
    skills: [
      { id: "reservar", name: "Reservar citas", desc: "Ofrece huecos libres y crea la cita en Calendar.", approval: false, on: true },
      { id: "reprogramar", name: "Reprogramar y cancelar", desc: "Mueve citas a petición del paciente.", approval: false, on: true },
      { id: "recordatorios", name: "Recordatorios 24 h antes", desc: "Por WhatsApp, con confirmación de asistencia.", approval: false, on: true },
      { id: "espera", name: "Lista de espera", desc: "Avisa a pacientes en espera cuando se libera un hueco.", approval: false, on: true },
      { id: "llamadas", name: "Atender llamadas", desc: "Contesta, reserva y pasa la llamada si hace falta.", approval: false, on: true },
      { id: "masivo", name: "Mover citas en bloque", desc: "Reorganiza la agenda ante bajas o cierres.", approval: true, on: true },
      { id: "resenas", name: "Pedir reseña tras la visita", desc: "Envía un enlace a Google Reviews al día siguiente.", approval: false, on: false },
    ],
    tono: "Cercano", tonoEx: "“¡Hola, Laura! Tengo el jueves a las 10:30 o el viernes a las 17:00. ¿Cuál te viene mejor?”",
  },
  {
    key: "customer", name: "Atención al cliente", color: "#2457f5", sub: "Incidencias, seguimiento y relación", status: "active",
    skills: [
      { id: "dudas", name: "Responder dudas", desc: "Precios, horarios, preparación de tratamientos.", approval: false, on: true },
      { id: "seguimiento", name: "Seguimiento post-visita", desc: "Pregunta cómo ha ido y detecta problemas.", approval: false, on: true },
      { id: "incidencias", name: "Gestionar incidencias", desc: "Abre y hace seguimiento de un problema.", approval: false, on: true },
      { id: "quejas", name: "Resolver quejas", desc: "Propone compensación dentro de un límite.", approval: true, on: true },
      { id: "derivar", name: "Derivar a humano", desc: "Pasa el caso a una persona cuando hace falta.", approval: false, on: true },
      { id: "encuesta", name: "Encuesta de satisfacción", desc: "Envía NPS tras cerrar la incidencia.", approval: false, on: false },
    ],
    tono: "Cercano", tonoEx: "“Siento el fallo, Laura. Lo soluciono ahora mismo y te confirmo en cuanto esté. ¿Te va bien?”",
  },
  {
    key: "sales", name: "Comercial", color: "#a30042", sub: "Leads, presupuestos y recuperación", status: "active",
    skills: [
      { id: "cualificar", name: "Cualificar leads", desc: "Entiende la necesidad y clasifica el lead.", approval: false, on: true },
      { id: "presupuesto", name: "Enviar presupuesto", desc: "Prepara y manda el presupuesto del tratamiento.", approval: true, on: true },
      { id: "recuperar", name: "Recuperar presupuestos", desc: "Hace seguimiento de presupuestos sin cerrar.", approval: false, on: true },
      { id: "recomendar", name: "Recomendar tratamientos", desc: "Sugiere según el caso, sin diagnosticar.", approval: false, on: true },
      { id: "primeravisita", name: "Agendar primera visita", desc: "Convierte el interés en una cita gratuita.", approval: false, on: true },
      { id: "descuento", name: "Ofrecer descuento", desc: "Aplica un descuento dentro de un margen.", approval: true, on: false },
    ],
    tono: "Cercano", tonoEx: "“Te preparo un presupuesto sin compromiso. ¿Quieres que lo veamos en una primera visita gratuita?”",
  },
  {
    key: "admin", name: "Administración", color: "#8e4e00", sub: "Facturas, cobros y día a día", status: "active",
    skills: [
      { id: "factura", name: "Emitir factura", desc: "Crea y envía la factura tras la visita.", approval: true, on: true },
      { id: "cobro", name: "Registrar cobro", desc: "Anota el pago y concilia con la factura.", approval: true, on: true },
      { id: "recordatorio", name: "Recordatorio de pago", desc: "Avisa de facturas pendientes con tacto.", approval: false, on: true },
      { id: "informe", name: "Informe mensual", desc: "Resume ingresos, citas y pendientes.", approval: false, on: true },
      { id: "inventario", name: "Avisar de inventario bajo", desc: "Detecta material por debajo del mínimo.", approval: false, on: true },
      { id: "plazos", name: "Pago a plazos", desc: "Propone fraccionar el pago.", approval: true, on: false },
    ],
    tono: "Formal", tonoEx: "“Hola Laura, te adjunto la factura de tu última visita (75,00 €). Cualquier duda, aquí estoy.”",
  },
];

const box = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px" };
const AgentIcon = ({ color }) => (
  <span style={{ width: "56px", height: "56px", borderRadius: "800px", background: color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>
  </span>
);

export default function Screen() {
  const [sel, setSel] = useState(0);
  const [on, setOn] = useState({}); // overrides por "agentKey:skillId"
  const a = AGENTS[sel];
  const isOn = (s) => { const k = `${a.key}:${s.id}`; return k in on ? on[k] : s.on; };
  const toggle = (s) => setOn((o) => ({ ...o, [`${a.key}:${s.id}`]: !isOn(s) }));
  const activeCount = a.skills.filter(isOn).length;

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agentes" /></div>
      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Agentes / {a.name}</span>
          <div role="tablist" aria-label="Tus agentes" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {AGENTS.map((g, i) => {
              const cur = i === sel;
              return (
                <button key={g.key} type="button" role="tab" aria-selected={cur} onClick={() => setSel(i)} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "800px", border: "1px solid", borderColor: cur ? "#000000" : "#0000001a", background: cur ? "#000000" : "#ffffff", color: cur ? "#ffffff" : "#000000", font: "500 13px/13px var(--font-display)", cursor: "pointer" }}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "800px", background: g.color, flex: "none", boxShadow: cur ? "0 0 0 2px #ffffff55" : "none" }} />{g.name}
                </button>
              );
            })}
            <a href="/plataforma/agente-nuevo" style={{ display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: "800px", border: "1px dashed #0000002a", background: "transparent", color: "#5f5f63", font: "500 13px/13px var(--font-display)", textDecoration: "none" }}>+ Nuevo agente</a>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <AgentIcon color={a.color} />
            <div><h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>{a.name}</h1><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{a.sub}</span></div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ padding: "6px 12px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "14px", lineHeight: "14px" }}>● Activo</span>
            <a href="/plataforma/probar" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", textDecoration: "none" }}>Probar</a>
            <a href="/plataforma/publicar" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", textDecoration: "none" }}>Publicar cambios</a>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[["Techo de autonomía", "/plataforma/autonomia"], ["Voz del agente", "/plataforma/voz"], ["Conocimiento", "/plataforma/conocimiento"], ["Memoria del negocio", "/plataforma/memoria"]].map(([l, h]) => (<a key={l} href={h} style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 13px/13px var(--font-display)", textDecoration: "none" }}>{l}</a>))}
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...box, flex: "3 1 460px", minWidth: "0", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid #0000000f", gap: "12px", flexWrap: "wrap" }}>
              <div><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Skills</h2><span style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{activeCount} de {a.skills.length} activas · Configuradas de serie para clínicas</span></div>
            </div>
            {a.skills.map((s) => {
              const act = isOn(s);
              return (
                <div key={s.id} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #0000000f" }}>
                  <div style={{ flex: "1", minWidth: "0" }}>
                    <div style={{ fontSize: "14px", lineHeight: "21px", fontWeight: "500" }}>{s.name}</div>
                    <div style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{s.desc}</div>
                  </div>
                  {s.approval && <span style={{ padding: "4px 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", fontSize: "12px", lineHeight: "16px", whiteSpace: "nowrap" }}>Con aprobación</span>}
                  <button type="button" role="switch" aria-checked={act} aria-label={s.name} onClick={() => toggle(s)} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: act ? "#000000" : "#d4d4d8", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", top: "3px", left: act ? "19px" : "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff", transition: "left .15s ease" }}></span></button>
                </div>
              );
            })}
          </section>

          <div style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
            <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tono</h2>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["Cercano", "Formal", "Breve"].map((t) => <span key={t} style={{ padding: "8px 14px", borderRadius: "800px", fontSize: "14px", lineHeight: "14px", ...(t === a.tono ? { background: "#000000", color: "#ffffff" } : { boxShadow: "inset 0 0 0 1px #0000001a" }) }}>{t}</span>)}
              </div>
              <div style={{ background: "#f4f4f5", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{a.tonoEx}</div>
            </section>
            <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Canales</h2>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>WhatsApp Business</span><span style={{ color: "#004c39" }}>Conectado</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Teléfono (voz)</span><span style={{ color: "#004c39" }}>Conectado</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Google Calendar</span><span style={{ color: "#004c39" }}>Conectado</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Instagram</span><a href="/plataforma/configuracion/integraciones" style={{ color: "#2457f5" }}>Conectar</a></div>
            </section>
            <section style={{ borderRadius: "12px", background: "#9dbecc", padding: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
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
