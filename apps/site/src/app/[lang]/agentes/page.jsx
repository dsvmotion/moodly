"use client";
import LangLink from "@/components/lang-link";
import { Fragment, useState } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import DemoForm from "@/components/demo-form";

export default function Page() {
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const U = (t) => ({ t, user: true, agent: false, tag: false });
const A = (t) => ({ t, user: false, agent: true, tag: false });
const G = (t) => ({ t, user: false, agent: false, tag: true });
const K = (t, d) => ({ t, d });
const r = (t, m) => ({ t, auto: m === 'a', ask: m === 'p', never: m === 'n' });
const sec = (n, href, t) => ({ n, href, t });
const dark = { fg: '#ffffff', chipBg: '#ffffff33', btnBg: '#ffffff', btnFg: '#000000', lineColor: '#ffffff66' };
const light = { fg: '#000000', chipBg: '#00000014', btnBg: '#000000', btnFg: '#ffffff', lineColor: '#0000001a' };
const D = {
recepcion: { ...dark, name: 'Recepción', bg: '#004c39',
h1: 'Tu agenda llena, sin descolgar el teléfono', sub: 'Reserva, confirma, reprograma y recuerda citas por WhatsApp y teléfono. Y llena los huecos con la lista de espera.',
chatHead: 'Llamada · 10:31', chat: [U('Quería pedir cita para esta semana.'), A('Claro. Tengo el martes a las 9:30 o el jueves a las 18:00. ¿Cuál te va mejor?'), U('El martes.'), G('Calendar · Cita creada')],
skills: [K('Reservar citas', 'En el hueco libre adecuado, según servicio y profesional.'), K('Recordatorios', '24 h antes, con confirmación. Menos ausencias.'), K('Reprogramar y cancelar', 'Cuando el cliente lo pide, sin llamadas de ida y vuelta.'), K('Lista de espera', 'Avisa cuando se libera un hueco.'), K('Llamadas de voz', 'Contesta el teléfono cuando el equipo no puede.'), K('Fuera de horario', 'Atiende y reserva para cuando abráis.')],
channels: ['Teléfono', 'WhatsApp', 'Google Calendar', 'Outlook', 'Instagram'],
rules: [r('Reservar en un hueco libre', 'a'), r('Mover citas en bloque', 'p'), r('Reservar fuera del horario', 'n'), r('Enviar recordatorios', 'a')],
sectors: [sec('Clínicas', '/sectores', 'Citas, urgencias y recordatorios.'), sec('Restaurantes', '/sectores', 'Reservas de mesa y lista de espera.'), sec('Gestorías', '/sectores', 'Reuniones y plazos fiscales.'), sec('Inmobiliarias', '/sectores', 'Visitas según cada comercial.'), sec('Agencias', '/sectores', 'Reuniones con clientes.')],
metrics: [{ n: '62 %', t: 'de las llamadas a pymes se quedan sin contestar', src: '411 Locals (2016)' }, { n: '−23 %', t: 'de ausencias con recordatorios automáticos', src: 'Dental Tribune, 1,6 M de citas' }, { n: '24/7', t: 'reservas también fuera de horario', src: 'Moodly' }] },
atencion: { ...light, name: 'Atención al cliente', bg: '#9dbecc',
h1: 'Respuestas al momento, con el tono de tu negocio', sub: 'Contesta WhatsApp, email y redes con la información que tú le das. Lo que no sabe, te lo pasa.',
chatHead: 'WhatsApp · 23:12', chat: [U('¿Aceptáis pago a plazos?'), A('Sí, para tratamientos de más de [000] €, hasta 12 meses sin intereses. ¿Te cuento cómo funciona?'), G('Conocimiento · Preguntas frecuentes')],
skills: [K('Preguntas frecuentes', 'Horarios, precios, servicios y cómo llegar.'), K('Varios canales', 'WhatsApp, email, Instagram y Facebook en una bandeja.'), K('Reseñas', 'Responde a reseñas; las negativas pasan por ti.'), K('Varios idiomas', 'Responde en el idioma del cliente.'), K('Recogida de datos', 'Pide lo necesario antes de pasar a una persona.'), K('Paso a persona', 'Si el cliente lo pide o algo se complica.')],
channels: ['WhatsApp', 'Gmail', 'Outlook', 'Instagram', 'Facebook', 'Chat web'],
rules: [r('Responder con tu información', 'a'), r('Responder reseñas negativas', 'p'), r('Dar consejo médico, legal o fiscal', 'n'), r('Inventar información', 'n')],
sectors: [sec('Clínicas', '/sectores', 'Precios, aseguradoras y preparación.'), sec('Restaurantes', '/sectores', 'Carta, alérgenos y eventos.'), sec('Gestorías', '/sectores', 'Recogida de documentos.'), sec('Inmobiliarias', '/sectores', 'Preguntas sobre inmuebles.'), sec('Agencias', '/sectores', 'Briefings completos.')],
metrics: [{ n: '88 %', t: 'elegiría un negocio que responde a todas sus reseñas', src: 'BrightLocal 2024' }, { n: '42 h', t: 'tarda de media una empresa en responder a un contacto web', src: 'Harvard Business Review' }, { n: '78 %', t: 'abandona un negocio después de una llamada sin respuesta', src: '411 Locals (2016)' }] },
comercial: { ...dark, name: 'Comercial', bg: '#a30042',
h1: 'Ningún cliente potencial se queda sin seguimiento', sub: 'Registra cada contacto en tu CRM, cualifica leads y hace el seguimiento de presupuestos en el momento justo.',
chatHead: 'WhatsApp · día 3', chat: [A('Hola, Ana. ¿Pudiste ver el presupuesto de ortodoncia? Si tienes dudas, te las resuelvo.'), U('Sí, pero me parece mucho de golpe.'), A('Lo entiendo. Se puede pagar en 12 meses sin intereses. ¿Te paso los detalles?'), G('CRM · Etapa: seguimiento')],
skills: [K('Cualificar leads', 'Pregunta lo justo para saber si encaja.'), K('Registrar en el CRM', 'Cada contacto con su origen y su historial.'), K('Seguimiento', 'Recuerda presupuestos en los días que tú marques.'), K('Reseñas', 'Pide reseña tras una buena experiencia.'), K('Reactivar clientes', 'Escribe a quien hace tiempo que no viene.'), K('Avisos de oportunidad', 'Te dice cuándo un cliente está listo.')],
channels: ['WhatsApp', 'Email', 'Formularios web', 'Portales', 'Tu CRM'],
rules: [r('Hacer seguimiento de presupuestos', 'a'), r('Ofrecer descuentos', 'p'), r('Ofrecer pago a plazos', 'p'), r('Cambiar precios', 'n')],
sectors: [sec('Clínicas', '/sectores', 'Presupuestos de tratamientos.'), sec('Restaurantes', '/sectores', 'Grupos y eventos.'), sec('Gestorías', '/sectores', 'Nuevas altas de clientes.'), sec('Inmobiliarias', '/sectores', 'Leads de portales.'), sec('Agencias', '/sectores', 'Propuestas enviadas.')],
metrics: [{ n: '7×', t: 'más probable cualificar un lead si respondes en menos de 1 hora', src: 'Harvard Business Review' }, { n: '60×', t: 'más probable que si esperas 24 horas o más', src: 'Harvard Business Review' }, { n: '24 %', t: 'de las empresas nunca responde a un lead', src: 'Harvard Business Review' }] },
admin: { ...dark, name: 'Administración', bg: '#8e4e00',
h1: 'Facturas listas para aprobar en un minuto', sub: 'Prepara facturas, avisa de cobros pendientes y controla el stock. Siempre con tu visto bueno.',
chatHead: 'App · aprobación', chat: [G('Factura F-[0000] preparada'), A('He preparado la factura de Laura M. por [00,00] €. ¿La envío por WhatsApp?'), U('Sí, adelante.'), G('Enviada · Registrada en facturación')],
skills: [K('Facturas', 'A clientes y aseguradoras, con tus datos fiscales.'), K('Recurrentes', 'Cuotas mensuales o por hito, preparadas a tiempo.'), K('Cobros', 'Recuerda con amabilidad los pagos pendientes.'), K('Inventario', 'Avisa cuando algo baja del mínimo.'), K('Pedidos', 'Prepara pedidos a proveedores para que los apruebes.'), K('Resumen mensual', 'Lo facturado, cobrado y pendiente.')],
channels: ['Tu facturación', 'Email', 'WhatsApp', 'Inventario', 'Proveedores'],
rules: [r('Preparar facturas', 'a'), r('Enviar facturas', 'p'), r('Pedir material', 'p'), r('Mover dinero', 'n')],
sectors: [sec('Clínicas', '/sectores', 'Pacientes y aseguradoras.'), sec('Restaurantes', '/sectores', 'Stock y proveedores.'), sec('Gestorías', '/sectores', 'Cuotas de clientes.'), sec('Inmobiliarias', '/sectores', 'Honorarios y alquileres.'), sec('Agencias', '/sectores', 'Facturación por proyecto.')],
metrics: [{ n: '226 h', t: 'al año dedica un autónomo a trámites administrativos', src: 'ATA (2025)' }, { n: '3.390 €', t: 'al año cuestan esas obligaciones a cada autónomo', src: 'ATA (2025)' }, { n: '46 %', t: 'de los mandos dedica más de 5 h semanales a tareas administrativas', src: 'Estudios de carga administrativa en pymes' }] }
};
const order = [['recepcion', 'Recepción', '#004c39'], ['atencion', 'Atención al cliente', '#9dbecc'], ['comercial', 'Comercial', '#a30042'], ['admin', 'Administración', '#8e4e00']];
const key = (this.state && this.state.agent) || 'recepcion';
return { a: D[key] || D.recepcion, tabs: order.map(([id, label, dot]) => ({ label, dot, on: id === key, off: id !== key, pick: () => this.setState({ agent: id }) })) };
}.call(ctx);
  const { a, tabs } = vals;
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", width: "100%" }}>

<SiteHeader />

<div style={{ position: "sticky", top: "52px", zIndex: "9", background: "#f7f7f8e6", borderBottom: "1px solid #0000000f" }}>
<div role="tablist" aria-label="Agentes" style={{ maxWidth: "1312px", margin: "0 auto", padding: "8px clamp(16px, 4vw, 40px)", boxSizing: "border-box", display: "flex", gap: "6px", overflowX: "auto" }}>
{(tabs).map((tb, $index) => (<Fragment key={$index}>
{(tb.on) ? (<><button type="button" role="tab" aria-selected="true" style={{ flex: "none", display: "flex", gap: "8px", alignItems: "center", padding: "10px 18px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)" }}><span style={{ width: "10px", height: "10px", borderRadius: "800px", background: tb.dot }}></span>{tb.label}</button></>) : null}
{(tb.off) ? (<><button type="button" role="tab" aria-selected="false" onClick={tb.pick} style={{ flex: "none", display: "flex", gap: "8px", alignItems: "center", padding: "10px 18px", borderRadius: "800px", border: "0", background: "transparent", color: "#5f5f63", font: "400 14px/21px var(--font-display)", cursor: "pointer" }}><span style={{ width: "10px", height: "10px", borderRadius: "800px", background: tb.dot }}></span>{tb.label}</button></>) : null}
</Fragment>))}
</div>
</div>

<section style={{ padding: "24px clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", borderRadius: "12px", background: a.bg, color: a.fg, padding: "clamp(40px, 7vw, 96px) clamp(24px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "48px", flexWrap: "wrap", alignItems: "center" }}>
<div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "20px" }}>
<span style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: "800px", background: a.chipBg, fontSize: "14px", lineHeight: "14px" }}>Agente de {a.name}</span>
<h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em" }}>{a.h1}</h1>
<p style={{ margin: "0", fontSize: "18px", lineHeight: "27px", fontWeight: "300", maxWidth: "460px", opacity: ".85" }}>{a.sub}</p>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><a href="#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: a.btnBg, color: a.btnFg, textDecoration: "none" }}>Pedir demo</a><LangLink href="/precios" style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: `1px solid ${a.lineColor}`, color: a.fg, textDecoration: "none" }}>Ver precios</LangLink></div>
</div>
<div style={{ flex: "1 1 360px", maxWidth: "440px", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px", boxShadow: "0 8px 24px #0000001f" }}>
<div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #0000000f" }}><span style={{ fontWeight: "500" }}>{a.chatHead}</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Ejemplo</span></div>
{(a.chat).map((m, $index) => (<Fragment key={$index}>
{(m.user) ? (<><div style={{ alignSelf: "flex-start", background: "#f4f4f5", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{m.t}</div></>) : null}
{(m.agent) ? (<><div style={{ alignSelf: "flex-end", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{m.t}</div></>) : null}
{(m.tag) ? (<><span style={{ alignSelf: "flex-end", padding: "5px 10px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>{m.t}</span></>) : null}
</Fragment>))}
</div>
</div>
</section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
<h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>Qué hace. <span style={{ color: "#5f5f63" }}>Skills listas de serie que activas o desactivas.</span></h2>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
{(a.skills).map((k, $index) => (<Fragment key={$index}><div style={{ background: "#ffffff", borderRadius: "12px", padding: "28px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "180px" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: a.bg }}></span><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{k.t}</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>{k.d}</span></div></Fragment>))}
</div>
</div>
</section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", gap: "48px", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "20px" }}>
<h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em" }}>Dónde trabaja. <span style={{ color: "#5f5f63" }}>En los canales y herramientas que ya usas.</span></h2>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>{(a.channels).map((c, $index) => (<Fragment key={$index}><span style={{ padding: "10px 18px", borderRadius: "800px", background: "#ffffff" }}>{c}</span></Fragment>))}</div>
<LangLink href="/integraciones" style={{ alignSelf: "flex-start", fontSize: "14px", color: "#2457f5", textDecoration: "none" }}>Ver todas las integraciones →</LangLink>
</div>
<div style={{ flex: "1 1 480px", background: "#ffffff", borderRadius: "12px", padding: "8px 24px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ padding: "16px 0 8px", fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>Lo que decides tú</div>
{(a.rules).map((r, $index) => (<Fragment key={$index}><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "14px 0", borderTop: "1px solid #0000000f" }}><span>{r.t}</span>{(r.auto) ? (<><span style={{ padding: "0 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", whiteSpace: "nowrap" }}>Automático</span></>) : null}{(r.ask) ? (<><span style={{ padding: "0 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", whiteSpace: "nowrap" }}>Con aprobación</span></>) : null}{(r.never) ? (<><span style={{ padding: "0 10px", borderRadius: "800px", background: "#fbe1ea", color: "#a30042", whiteSpace: "nowrap" }}>Nunca</span></>) : null}</div></Fragment>))}
</div>
</div>
</section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
<h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>En cada sector. <span style={{ color: "#5f5f63" }}>Las mismas bases, adaptadas a tu negocio.</span></h2>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
{(a.sectors).map((s, $index) => (<Fragment key={$index}><LangLink href={s.href} style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "8px", color: "#000000", textDecoration: "none", minHeight: "160px" }}><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{s.n}</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{s.t}</span><span style={{ marginTop: "auto", fontSize: "14px", color: "#2457f5" }}>Ver →</span></LangLink></Fragment>))}
</div>
</div>
</section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
{(a.metrics).map((x, $index) => (<Fragment key={$index}><div style={{ borderTop: "1px solid #000000", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "44px", lineHeight: "48px", letterSpacing: "-1.76px", fontWeight: 100 }}>{x.n}</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>{x.t}</span><span style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>Fuente: {x.src}</span></div></Fragment>))}
</div>
</section>

<section id="demo" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 64px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
<h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "560px" }}>Pon a trabajar a tu agente de {a.name}.</h2>
<DemoForm id="agent-email" />

</div>
</section>
<SiteFooter />
</div>
</>
  );
}
