"use client";
import LangLink from "@/components/lang-link";
import { PRICING as P, eur } from "@/components/pricing";
import { VERTICALS } from "@/components/verticals";
import { Fragment, useState } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import AgentCarousel from "@/components/agent-carousel";
import DemoForm from "@/components/demo-form";

export default function Page() {
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const data = [
{ id: 'clinicas', label: 'Clínicas', intro: 'Pacientes atendidos al momento, agenda siempre llena y menos ausencias.', skills: [
{ text: 'Reserva y reprograma citas por WhatsApp y teléfono', agent: 'Recepción' },
{ text: 'Recordatorios y gestión de ausencias', agent: 'Recepción' },
{ text: 'Respuestas a preguntas frecuentes de pacientes', agent: 'Atención' },
{ text: 'Facturas a pacientes y aseguradoras', agent: 'Administración' }] },
{ id: 'restaurantes', label: 'Restaurantes', intro: 'Reservas sin descolgar el teléfono y stock bajo control.', skills: [
{ text: 'Reservas por WhatsApp, Instagram y teléfono', agent: 'Recepción' },
{ text: 'Confirmaciones y lista de espera', agent: 'Recepción' },
{ text: 'Respuestas a reseñas y mensajes', agent: 'Atención' },
{ text: 'Avisos de stock bajo y pedidos a proveedores', agent: 'Administración' }] },
{ id: 'gestorias', label: 'Gestorías', intro: 'Documentación a tiempo y clientes informados sin perseguirlos.', skills: [
{ text: 'Recogida de documentación de clientes', agent: 'Atención' },
{ text: 'Recordatorios de plazos fiscales', agent: 'Recepción' },
{ text: 'Clasificación y respuesta de emails', agent: 'Atención' },
{ text: 'Facturas recurrentes', agent: 'Administración' }] },
{ id: 'inmobiliarias', label: 'Inmobiliarias', intro: 'Cada lead de portal atendido, cualificado y con visita agendada.', skills: [
{ text: 'Cualificación de leads de portales', agent: 'Comercial' },
{ text: 'Agenda de visitas', agent: 'Recepción' },
{ text: 'Seguimiento en el CRM', agent: 'Comercial' },
{ text: 'Respuestas sobre inmuebles', agent: 'Atención' }] },
{ id: 'agencias', label: 'Agencias', intro: 'Briefings ordenados, propuestas con seguimiento y facturación al día.', skills: [
{ text: 'Recepción de briefings', agent: 'Atención' },
{ text: 'Seguimiento de propuestas', agent: 'Comercial' },
{ text: 'Facturación por proyecto', agent: 'Administración' },
{ text: 'Agenda de reuniones', agent: 'Recepción' }] }
];
const picked = (this.state && this.state.picked) || 'clinicas';
const current = data.find((d) => d.id === picked) || data[0];
return {
current,
verticals: data.map((d) => ({ label: d.label, active: d.id === picked, inactive: d.id !== picked, pick: () => this.setState({ picked: d.id }) }))
};
}.call(ctx);
  const { current, verticals } = vals;
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>

<div style={{ background: "#000000", color: "#ffffff", padding: "10px 16px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap", textAlign: "center" }}>
<span style={{ padding: "2px 8px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px", lineHeight: "18px" }}>Nuevo</span>
<span>Agentes de IA listos para clínicas, hostelería, inmobiliarias, despachos, tiendas, reformas, talleres y academias.</span>
<a href="#sectores" style={{ color: "#ffffff", textDecoration: "underline" }}>Ver sectores →</a>
</div>

<SiteHeader />

<section style={{ padding: "80px 24px 48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
<h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "720px" }}>Agentes de IA que ya saben cómo funciona tu negocio</h1>
<p style={{ margin: "0", fontSize: "18px", lineHeight: "27px", fontWeight: "300", maxWidth: "460px" }}>Se conectan a WhatsApp, Gmail, Calendar, tu CRM y tu facturación, y hacen el trabajo repetitivo. Tú decides qué aprueban.</p>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "12px" }}>
<a href="#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff" }}>Pedir demo gratis</a>
<a href="#agentes" style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: "1px solid #0000001a" }}>Ver los agentes</a>
</div>
</section>

<section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
<div className="hero-collage" style={{ maxWidth: "1232px", margin: "0 auto", borderRadius: "16px", background: "linear-gradient(180deg, #ececee 0%, #f2f2f4 100%)", padding: "clamp(28px, 5vw, 64px) clamp(12px, 4vw, 48px) 0", boxSizing: "border-box", overflow: "hidden" }}>
<div style={{ position: "relative", maxWidth: "1080px", margin: "0 auto", height: "clamp(260px, 44vw, 600px)" }}>
<img className="collage-back" src="/shots/inicio.png" alt="" style={{ position: "absolute", left: 0, top: "56px", width: "52%", borderRadius: "12px", boxShadow: "0 12px 32px #0000001f", opacity: 0.92 }} />
<img className="collage-back" src="/shots/informes.png" alt="" style={{ position: "absolute", right: 0, top: "56px", width: "52%", borderRadius: "12px", boxShadow: "0 12px 32px #0000001f", opacity: 0.92 }} />
<img src="/shots/conversaciones.png" alt="Bandeja de conversaciones de Moodly AI: el agente de Recepción reserva una cita por WhatsApp y pide aprobación para enviar una factura" style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: "min(84%, 900px)", borderRadius: "12px 12px 0 0", boxShadow: "0 24px 64px #00000033, 0 0 0 1px #0000000f", zIndex: 2 }} />
<img src="/shots/movil-aprobar.png" alt="App móvil de Moodly AI: aprobaciones pendientes" style={{ position: "absolute", right: "clamp(0px, 3vw, 40px)", bottom: "-8%", width: "clamp(110px, 19%, 210px)", borderRadius: "clamp(18px, 2.6vw, 34px)", border: "clamp(4px, 0.6vw, 7px) solid #000000", boxShadow: "0 24px 48px #00000040", zIndex: 3 }} />
</div>
</div>
</section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "96px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "28px", alignItems: "center" }}>
<span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Se conecta con las herramientas que ya usas</span>
<div className="logo-grid" style={{ width: "100%", maxWidth: "1040px", display: "grid", gap: "10px" }}><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/whatsapp.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>WhatsApp</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/gmail.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Gmail</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/googlecalendar.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Google Calendar</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/microsoftoutlook.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Outlook</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/microsoftteams.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Teams</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/instagram.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Instagram</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/hubspot.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>HubSpot</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/salesforce.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Salesforce</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/stripe.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Stripe</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/holded.png" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Holded</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/googledrive.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Google Drive</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/slack.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Slack</span></span><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src="/logos/openai.svg" alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>OpenAI</span></span><LangLink href="/integraciones" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#000000", border: "1px solid #000000", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap", color: "#ffffff" }}>+100 más →</LangLink></div>
<div className="benefit-grid" style={{ width: "100%", maxWidth: "1232px", display: "grid", gap: "32px 24px", marginTop: "72px", textAlign: "left" }}><div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><img src="/brand/pictos/diurno.svg" alt="" width="44" height="44" style={{ objectFit: "contain", objectPosition: "left" }} /><span style={{ fontSize: "18px", lineHeight: "24px" }}>Atiende 24/7</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Responde de noche, en festivos y en pleno servicio.</span></div><div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><img src="/brand/pictos/comentario.svg" alt="" width="44" height="44" style={{ objectFit: "contain", objectPosition: "left" }} /><span style={{ fontSize: "18px", lineHeight: "24px" }}>En todos tus canales</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>WhatsApp, email, web, redes y teléfono.</span></div><div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><img src="/brand/pictos/tiempo.svg" alt="" width="44" height="44" style={{ objectFit: "contain", objectPosition: "left" }} /><span style={{ fontSize: "18px", lineHeight: "24px" }}>Horas de vuelta</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Citas, recordatorios y papeles sin que tu equipo los toque.</span></div><div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><img src="/brand/pictos/equilibrio.svg" alt="" width="44" height="44" style={{ objectFit: "contain", objectPosition: "left" }} /><span style={{ fontSize: "18px", lineHeight: "24px" }}>Tú tienes el control</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Lo importante siempre pasa por tu aprobación.</span></div><div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><img src="/brand/pictos/libro.svg" alt="" width="44" height="44" style={{ objectFit: "contain", objectPosition: "left" }} /><span style={{ fontSize: "18px", lineHeight: "24px" }}>Aprende tu negocio</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Tus precios, normas y tono, y mejora con cada conversación.</span></div><div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><img src="/brand/pictos/ordenador.svg" alt="" width="44" height="44" style={{ objectFit: "contain", objectPosition: "left" }} /><span style={{ fontSize: "18px", lineHeight: "24px" }}>Todo en una plataforma</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Agenda, clientes, facturas e informes en un solo sitio.</span></div></div>
</div>
<div style={{ display: "flex", gap: "48px", flexWrap: "wrap", justifyContent: "space-between" }}>
<div style={{ flex: "1 1 360px", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "24px" }}>
<h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em" }}>Tu negocio sabe que tiene que usar IA. <span style={{ color: "#5f5f63" }}>Un chatbot genérico no sirve y una consultora sale cara. Moodly es el punto medio.</span></h2>
<a href="#como-funciona" style={{ display: "inline-flex", alignItems: "center", gap: "12px", fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: "#00000014", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></span>Cómo funciona</a>
</div>
<figure style={{ flex: "1 1 360px", maxWidth: "584px", margin: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "32px", borderRadius: "12px", background: "#ffffff", border: "1px solid #0000000f", boxSizing: "border-box" }}><span style={{ fontSize: "clamp(48px, 6vw, 72px)", lineHeight: "1", letterSpacing: "-0.04em" }}>62 %</span><blockquote style={{ margin: "0", fontSize: "18px", lineHeight: "27px" }}>de las llamadas a pequeñas empresas no se contestan. Y la mayoría de esos clientes llama a la competencia.</blockquote><figcaption style={{ fontSize: "13px", lineHeight: "19px", color: "#6b6b70" }}>Fuente: 411 Locals, estudio de llamadas a 85 pymes de 58 sectores (2016).</figcaption></figure>
</div>
</div>
</section>

<section id="agentes" style={{ padding: "160px clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto 48px" }}>
<h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>Cuatro agentes para el trabajo de cada día. <span style={{ color: "#5f5f63" }}>Configurados de serie, listos para tu sector.</span></h2>
</div>
<div style={{ maxWidth: "1232px", margin: "0 auto" }}>
<AgentCarousel>

<LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#004c39", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
<span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Recepción</span>
<span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>Citas, agenda y llamadas de voz. Reserva, confirma y recuerda.</span>
<span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></span>
<span style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>Jueves</span><span style={{ color: "#6b6b70" }}>3 citas nuevas</span></span>
<span style={{ borderRadius: "8px", background: "#a3c2a7", padding: "8px 12px" }}>10:30 · Laura M. · WhatsApp</span>
<span style={{ borderRadius: "8px", background: "#a3c2a7", padding: "8px 12px" }}>12:00 · Pedro G. · Llamada</span>
<span style={{ borderRadius: "8px", background: "#f4f4f5", padding: "8px 12px", color: "#5f5f63" }}>17:00 · Libre</span>
</span>
</LangLink>

<LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#9dbecc", color: "#000000", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
<span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Atención al cliente</span>
<span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>Responde por WhatsApp, email y redes con el tono de tu negocio, a cualquier hora.</span>
<span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#00000014", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></span>
<span style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ alignSelf: "flex-start", background: "#f6f2e8", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>¿Abrís el domingo?</span>
<span style={{ alignSelf: "flex-end", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>Sí, de 13:00 a 16:30. ¿Te reservo mesa?</span>
<span style={{ display: "flex", gap: "6px" }}><span style={{ padding: "6px 12px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>WhatsApp</span><span style={{ padding: "6px 12px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>Email</span><span style={{ padding: "6px 12px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>Instagram</span></span>
</span>
</LangLink>

<LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#a30042", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
<span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Comercial</span>
<span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>Registra cada contacto en el CRM, cualifica leads y hace el seguimiento.</span>
<span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></span>
<span style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>Leads de esta semana</span><span style={{ color: "#6b6b70" }}>CRM</span></span>
<span style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #0000000f", paddingTop: "8px" }}><span>Ana T.</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "12px" }}>✓ Cualificado</span></span>
<span style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #0000000f", paddingTop: "8px" }}><span>Grupo Norte</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px" }}>Seguimiento</span></span>
<span style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #0000000f", paddingTop: "8px" }}><span>Marc P.</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#f4f4f5", color: "#5f5f63", fontSize: "12px" }}>Nuevo</span></span>
</span>
</LangLink>

<LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#8e4e00", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
<span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Administración</span>
<span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>Facturación e inventario. Prepara facturas, avisa del stock bajo y pide tu visto bueno.</span>
<span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></span>
<span style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>Factura F-[0000]</span><span>[000,00] €</span></span>
<span style={{ color: "#5f5f63" }}>Grupo Norte · vence en 30 días</span>
<span style={{ display: "flex", gap: "8px" }}><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#000000", color: "#ffffff" }}>Aprobar y enviar</span><span style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a" }}>Revisar</span></span>
</span>
</LangLink>

<LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
<span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Agente a medida</span>
<span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>¿Tu negocio necesita otra cosa? Creamos skills propias encima de los cuatro agentes.</span>
<span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></span>
<span style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
<span style={{ height: "72px", borderRadius: "12px", background: "#004c39" }}></span><span style={{ height: "72px", borderRadius: "12px", background: "#9dbecc" }}></span>
<span style={{ height: "72px", borderRadius: "12px", background: "#a30042" }}></span><span style={{ height: "72px", borderRadius: "12px", background: "#8e4e00" }}></span>
</span>
</LangLink>

</AgentCarousel>
</div>

</section>

<section id="sectores" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}><div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}><h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>Hecho para tu sector. <span style={{ color: "#5f5f63" }}>Plantillas listas para ocho verticales y más de cuarenta tipos de negocio.</span></h2><LangLink href="/sectores" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", fontSize: "14px", lineHeight: "21px" }}>Ver todos los sectores</LangLink></div><div className="vertical-grid" style={{ display: "grid", gap: "16px" }}>{VERTICALS.map((v) => (<a key={v.id} href={`/sectores#${v.id}`} style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: "190px", padding: "24px", borderRadius: "12px", background: v.color, color: v.on, boxSizing: "border-box", boxShadow: v.color === "#ffffff" ? "inset 0 0 0 1px #0000000f" : "none" }}><span style={{ fontSize: "20px", lineHeight: "24px", letterSpacing: "-0.4px" }}>{v.name}</span><span style={{ fontSize: "15px", lineHeight: "22px", opacity: ".75" }}>{v.subsectors.slice(0, 4).join(", ")}…</span><span style={{ marginTop: "auto", fontSize: "14px" }}>Ver sector →</span></a>))}</div></div></section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
<h2 style={{ margin: "0 auto", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", textAlign: "center", maxWidth: "512px" }}>Un agente que se adapta a tu negocio.</h2>
<div style={{ display: "flex", flexWrap: "wrap", gap: "40px" }}>

<div style={{ flex: "2 1 560px", minHeight: "440px", borderRadius: "12px", background: "#a3c2a7", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
<h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Plug and play</h3>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75", maxWidth: "440px" }}>Viene configurado de serie: tono, reglas y flujos. Activa lo que quieras y personaliza encima. Cada sector arranca con sus skills ya preparadas.</p>
<div style={{ marginTop: "auto", background: "#ffffff", borderRadius: "12px", padding: "8px 20px", maxWidth: "480px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #0000000f" }}><span>Recordatorio 24 h antes de cada cita</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span></div>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #0000000f" }}><span>Lista de espera si no hay hueco</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span></div>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}><span>Pedir reseña tras la visita</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#d4d4d8", position: "relative", flex: "none" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span></div>
</div>
</div>

<div style={{ flex: "1 1 320px", minHeight: "440px", borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
<h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tú decides qué se aprueba</h3>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>Marca qué puede hacer solo y qué necesita tu visto bueno. Apruebas desde el móvil y todo queda registrado.</p>
<div style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "8px 16px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #0000000f" }}><span>Reservar cita</span><span style={{ padding: "0 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39" }}>Automático</span></div>
<div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #0000000f" }}><span>Enviar factura</span><span style={{ padding: "0 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00" }}>Con aprobación</span></div>
<div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}><span>Aplicar descuento</span><span style={{ padding: "0 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00" }}>Con aprobación</span></div>
</div>
</div>

<div style={{ flex: "1 1 320px", minHeight: "440px", borderRadius: "12px", background: "#f6f2e8", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
<h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Memoria de negocio</h3>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>Conoce tus objetivos, servicios y clientes, y aprende de cada conversación. Tú confirmas lo que aprende antes de usarlo.</p>
<div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ background: "#ffffff", borderRadius: "12px", padding: "12px 16px" }}>Objetivo: llenar las tardes de los martes</div>
<div style={{ background: "#ffffff", borderRadius: "12px", padding: "12px 16px" }}>Laura prefiere citas por la mañana</div>
<div style={{ background: "#ffffff", borderRadius: "12px", padding: "12px 16px" }}>No ofrecer descuentos en primera visita</div>
</div>
</div>

<div style={{ flex: "2 1 560px", minHeight: "440px", borderRadius: "12px", background: "#ffbab5", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Modo coach</h3><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "12px", lineHeight: "14px" }}>Próximamente</span></div>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75", maxWidth: "440px" }}>Propone mejoras, detecta debilidades frente a tu competencia y sugiere campañas.</p>
<div style={{ marginTop: "auto", background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", maxWidth: "520px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ fontWeight: "500" }}>Sugerencia de esta semana</div>
<div style={{ color: "#5f5f63" }}>Los martes por la tarde tienen un [00]% de huecos. ¿Envío una campaña por WhatsApp a quien no viene desde hace 6 meses?</div>
<div style={{ display: "flex", gap: "8px" }}><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#2457f5", color: "#ffffff" }}>Preparar campaña</span><span style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a" }}>Ahora no</span></div>
</div>
</div>

<div style={{ flex: "1 1 480px", minHeight: "440px", borderRadius: "12px", background: "#ffffff", border: "1px solid #0000000f", padding: "36px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}> <h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Integraciones oficiales</h3> <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", color: "#5f5f63", maxWidth: "440px" }}>APIs oficiales de WhatsApp Business, Google y Microsoft, y MCP para el resto. Sin desarrollos a medida.</p><div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", gap: "10px" }}><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/whatsapp.svg" alt="WhatsApp" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/gmail.svg" alt="Gmail" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/googlecalendar.svg" alt="Google Calendar" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/microsoftoutlook.svg" alt="Outlook" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/microsoftteams.svg" alt="Microsoft Teams" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/hubspot.svg" alt="HubSpot" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/salesforce.svg" alt="Salesforce" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/pipedrive.svg" alt="Pipedrive" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/stripe.svg" alt="Stripe" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/quickbooks.svg" alt="QuickBooks" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/xero.svg" alt="Xero" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/shopify.svg" alt="Shopify" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/notion.svg" alt="Notion" width="28" height="28" /></span><span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/logos/slack.svg" alt="Slack" width="28" height="28" /></span></div><LangLink href="/integraciones" style={{ fontSize: "14px", color: "#2457f5" }}>Ver las 120+ integraciones →</LangLink></div>

<div style={{ flex: "1 1 480px", minHeight: "440px", borderRadius: "12px", background: "#ff6301", color: "#000000", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
<h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Solo tareas delegables</h3>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75", maxWidth: "420px" }}>Trabajo operativo sin riesgo para tu empresa ni para las personas. Lo sensible siempre pasa por ti.</p>
<div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px", fontSize: "16px", lineHeight: "24px" }}>
<span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ color: "#000000" }}>✓</span>Citas, respuestas, fichas, borradores</span>
<span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ color: "#000000" }}>✓</span>Facturas y cambios en bloque, con tu aprobación</span>
<span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ color: "#000000" }}>×</span>Nada de diagnósticos, contratos ni decisiones sensibles</span>
</div>
</div>

</div>
</div>
</section>

<section id="como-funciona" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
<h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>De la primera llamada a tu agente trabajando. <span style={{ color: "#5f5f63" }}>Te acompañamos en cada paso.</span></h2>
<ol style={{ margin: "0", padding: "0", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "40px" }}>
<li style={{ borderTop: "1px solid #000000", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}><span style={{ font: "400 13px/20px var(--font-mono)", color: "#6b6b70" }}>01</span><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Implantación</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>Conectamos tus herramientas y cargamos servicios, horarios, precios y reglas.</span></li>
<li style={{ borderTop: "1px solid #000000", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}><span style={{ font: "400 13px/20px var(--font-mono)", color: "#6b6b70" }}>02</span><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Activa y personaliza</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>Eliges agentes y skills, ajustas el tono y decides qué necesita aprobación.</span></li>
<li style={{ borderTop: "1px solid #000000", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}><span style={{ font: "400 13px/20px var(--font-mono)", color: "#6b6b70" }}>03</span><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Trabaja y aprende</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>El agente atiende, registra y prepara. Tú revisas lo importante.</span></li>
</ol>
</div>
</section>

<section id="precios" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "984px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center" }}>
<h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "512px" }}>Precios claros</h2>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", color: "#5f5f63", maxWidth: "520px" }}>Una cuota fija por agente, una parte variable según tu uso y una implantación según la escala de tu proyecto.</p>
</div>
<div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "stretch" }}>
<div style={{ flex: "1 1 280px", borderRadius: "12px", background: "#ffffff66", border: "1px solid #0000000f", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px" }}>
<span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Prueba</span>
<span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{P.trialDays} días · sin tarjeta</span>
<span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>0 €</span>
<span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Un agente con la plantilla de tu sector, trabajando con tus datos.</span>
<ul style={{ margin: "8px 0 0", padding: "16px 0 0", borderTop: "1px solid #0000000f", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}><li>✓ {P.trialConversations} conversaciones</li><li>✓ WhatsApp, email y web</li><li>✓ Sesión de configuración incluida</li></ul>
</div>
<div style={{ flex: "1 1 280px", borderRadius: "12px", border: "1px solid #2457f5", padding: "32px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px" }}>
<span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Negocio</span><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#2457f5", color: "#ffffff", fontSize: "12px", lineHeight: "14px" }}>Fijo + uso</span></span>
<span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Por agente, al mes</span>
<span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>{P.perAgent} €<span style={{ fontSize: "16px", color: "#5f5f63" }}> /agente</span></span>
<span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{P.includedPerAgent} conversaciones incluidas por agente. Después, {eur(P.perConversation, 2)} por conversación.</span>
<ul style={{ margin: "8px 0 0", padding: "16px 0 0", borderTop: "1px solid #0000000f", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}><li>✓ Sin permanencia</li><li>+ Implantación según escala</li><li>✓ Límite de gasto que decides tú</li><li>✓ Mejoras y soporte incluidos</li></ul>
<LangLink href="/precios" style={{ marginTop: "auto", textAlign: "center", padding: "11px 18px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "21px" }}>Calcular mi precio</LangLink>
</div>
<div style={{ flex: "1 1 280px", borderRadius: "12px", background: "#000000cc", color: "#ffffff", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px" }}>
<span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>Cadenas y multisede</span>
<span style={{ fontSize: "14px", lineHeight: "21px", opacity: ".75" }}>Varias sedes o marcas</span>
<span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>A medida</span>
<span style={{ fontSize: "14px", lineHeight: "21px", opacity: ".75" }}>Agentes por sede, reglas comunes y un panel para toda la cadena.</span>
<LangLink href="/#demo" style={{ marginTop: "auto", textAlign: "center", padding: "10px 18px", borderRadius: "800px", background: "#ffffff", color: "#000000", fontSize: "14px", lineHeight: "21px" }}>Hablar con ventas</LangLink>
</div>
</div>
</div>
</section>

<section id="demo" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
<h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "420px" }}>Pon tu primer agente a trabajar.</h2>
<DemoForm />
<p style={{ margin: "0", fontSize: "12px", lineHeight: "18px", color: "#5f5f63" }}>Te respondemos en menos de 24 h. O <LangLink href="/#demo" style={{ textDecoration: "underline", color: "#5f5f63" }}>habla con ventas</LangLink>.</p>
</div></section>

<SiteFooter />
</div>
</>
  );
}
