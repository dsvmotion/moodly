const fs = require('fs'), path = require('path');
const mk = require('./lib.cjs');
const SP = path.resolve(__dirname, '..');
const readNotes = dir => { const n = {}; for (const f of fs.readdirSync(`${SP}/${dir}/project/slides`)) { const s = fs.readFileSync(`${SP}/${dir}/project/slides/${f}`, 'utf8'); const m = s.match(/<aside>([\s\S]*?)<\/aside>/); if (m) n[f.replace('.html', '')] = m[1]; } return n; };
const TL = [0.076, 0.218, 0.453, 0.688, 0.853];

// ---------------- investor deck ----------------
function investor() {
  const A = { lw: '92470743ed2a00302b0a6ea1be928068', lb: 'ed2430aba2c050803ab96560cd961b63', p: { comentario: '4d945979184ff0c6fa86edeee405f136', diurno: '2aa62014dc0d17abd993397747752220', equilibrio: 'f0b12967abc1a428e023cd0705272310', libro: '9e4978923890c52002405fca51304428', ordenador: '0009d7963ce0a809661a45028152244d', tiempo: 'bb384f57e2fe311ee1b0aa9c1809a7f2', energia: '6d217470e7f07778f9c6138441e4df34', paquete: '04b613069f45064a0132b07f66137b77' } };
  const N = readNotes('deck-inv'); const k = mk(A, N), { C, AG } = k, S = {};
  S.cover = k.cover('cover', { tag: 'Presentación para inversores · noviembre de 2026', title: 'El equipo de agentes de IA de cualquier empresa', sub: 'Hacen el trabajo, aprenden del equipo y responden de cada decisión.', foot: 'Producto en construcción' });
  S.tesis = k.statement('tesis', { tag: 'La tesis', title: 'Las empresas no necesitan otro chatbot.', soft: 'Necesitan agentes que hagan el trabajo y respondan de él.' });
  S.problema = k.split('problema', { tag: 'El problema y el momento', title: 'El trabajo operativo se repite en todas las empresas.', soft: 'Ahora se puede delegar.', foot: 'Tamaño de mercado: [por documentar con una fuente]', tiles: [
    { bg: C.sage, picto: 'ordenador', title: 'Los modelos ya actúan', text: 'Reservan, cobran o actualizan un CRM; ya no solo conversan.' },
    { bg: C.linen, picto: 'comentario', title: 'El cliente ya escribe', text: 'WhatsApp, email y chat son hoy el mostrador de cualquier empresa.' },
    { bg: C.pink, picto: 'equilibrio', title: 'El coste lo permite', text: 'Una conversación completa cuesta céntimos, y sigue bajando.' }] });
  S.producto = k.agents('producto', { tag: 'El producto', title: 'Un equipo de agentes por empresa.', soft: 'Cuatro de serie y los que cada una cree.', cards: [
    ['Agenda, reservas, pedidos y peticiones.', 'WhatsApp · web'], ['Responde con lo que sabe de la empresa.', 'Email · redes'], ['Capta, cualifica y hace seguimiento.', 'CRM · email'], ['Cobros, facturas y recordatorios.', 'Pagos']],
    own: ['+ Los propios', 'Cada empresa crea los suyos, desde cero o duplicando uno.', 'Configuración'], line: 'Cada agente tiene su memoria, su aprendizaje, sus permisos y sus objetivos. Todos comparten motor.' });
  S.motor = k.flow('motor', { tag: 'El motor', title: 'Un mismo recorrido para cada tarea', steps: [['Entrada', 'Un mensaje, un evento o un objetivo.'], ['Contexto', 'Conocimiento, memoria y datos.'], ['Decisión', 'Las reglas dicen si actúa o pide aprobación.'], ['Acción', 'En la herramienta real, una sola vez.'], ['Registro', 'Qué hizo, por qué y cuánto costó.']],
    levelsLabel: 'Cuatro niveles de autonomía, con un techo según el riesgo de cada acción', levels: ['Sugiere', 'Redacta', 'Ejecuta', 'Autónomo'] });
  S.horizontal = k.bento('horizontal', { tag: 'Alcance horizontal', title: 'Un sector nuevo es configuración, no código.', soft: 'Eso abre contratos más grandes.', foot: 'Ejemplos de configuración · todavía no son clientes', items: [
    ['Agencia creativa', 'Briefs, presupuestos, proyectos y facturación.'], ['Tienda online y física', 'Pedidos, devoluciones y stock entre tiendas.'], ['Marca de moda', 'Mayoristas, muestras y calendario de colección.'],
    ['Cadena de restauración', 'Reservas, proveedores, turnos y reseñas.'], ['Supermercado multicentro', 'Incidencias, proveedores y precios por centro.'], ['Agencia de talento', 'Castings, contratos y liquidaciones.']] });
  S.foso = k.split('foso', { tag: 'La tecnología', title: 'La ventaja está en la base, no en el modelo.', soft: '', text: 'Seis capas, en distinto grado de construcción.', leftW: 600, foot: 'TypeScript · Next.js · Postgres · DBOS · AI Gateway', tiles: [
    { bg: C.rock, label: 'Canales', text: 'WhatsApp, email, chat web y voz: 12 previstos, 5 en el piloto' },
    { bg: C.green, label: 'Agentes', text: 'Un motor común con reglas y aprobaciones; cada agente es configuración' },
    { bg: C.sage, label: 'Integraciones', text: 'Un concentrador de conectores: 147 previstas, 50 en el piloto' },
    { bg: C.linen, label: 'Datos', text: 'Aislamiento por empresa en la base de datos, con 1.145 tests' },
    { bg: C.peach, label: 'Modelos', text: 'Varios modelos tras una pasarela; el turno sencillo va al barato' },
    { bg: C.white, label: 'Operación', text: 'Ejecución que se reanuda tras un fallo, traza y coste medido' }] });
  S.confianza = k.columns('confianza', { tag: 'Seguridad y confianza', title: 'Una empresa solo delega si puede controlar.', soft: 'Qué hay y qué falta.', cols: [
    { bg: C.ink, title: 'Ya en la base', items: ['Datos de cada empresa aislados', 'Segundo factor para administrar', 'Aprobación humana según la acción', 'Traza de cada decisión', 'Datos alojados en la UE'] },
    { bg: C.white, title: 'Antes del primer cliente', items: ['Revisión de seguridad externa', 'Contratos y textos legales de datos', 'Revisión humana de cambios sensibles', 'Copias y recuperación probadas'] },
    { bg: C.white, title: 'En hoja de ruta', items: ['Certificaciones de seguridad', 'Auditoría externa periódica', 'Requisitos de cada contrato'] }] });
  S.negocio = k.slide('negocio', { body: k.pill('Modelo de negocio') + '\n' + k.h2('Dos vías de entrada, una plataforma.', 'Los importes aún no están decididos.') + '\n' + k.row(
    k.tile(C.linen, k.lab('Autoservicio', C.soft) + '\n' + k.h3('La empresa se da de alta sola', 46) + '\n' + k.ul(['Prueba de 7 días con 5 € de crédito', 'Cuota mensual más uso', 'Precio propuesto: 98 € al mes, sin decidir'], 32), { pad: '40px', gap: 16 }) + '\n'
    + k.tile(C.wine, k.lab('Empresa', C.onDark) + '\n' + k.h3('Implantación a medida y contrato', 46) + '\n' + k.ul(['Implantación con presupuesto cerrado', 'Referencia para una pyme: 1.000–5.000 €', 'Cuota por sedes y agentes: [€__]'], 32), { pad: '44px', gap: 20 }), 16, ';align-items:stretch;flex:1')
    + '\n' + k.row(k.lab('Palancas de ingreso', C.ink, 28) + '\n' + ['Agentes desplegados', 'Sedes', 'Volumen de uso', 'Integraciones'].map(t => k.pill(t)).join('\n'), 16, ';align-items:center') });
  const bar = (v, h, bg, l) => k.col(`<p style="font-family:${k.FT};font-size:80px;line-height:1.1;letter-spacing:-3px">${v}</p>\n<div style="width:260px;height:${h}px;background:${bg};border-radius:12px 12px 0px 0px"></div>\n<p style="font-size:24px;line-height:1.4;color:${C.muted};width:260px;height:68px">${l}</p>`, 12);
  const hyp = (bg, v, t) => k.tile(bg, k.lab('Hipótesis', C.soft) + '\n' + `<p style="font-family:${k.FT};font-size:88px;line-height:1.1;letter-spacing:-3px">${v}</p>\n` + k.p(t, 26, C.soft), { pad: '28px 36px', gap: 6 });
  S.economia = k.slide('economia', { foot: 'Fuente: auditoría interna de noviembre de 2026', body: k.pill('Economía por conversación') + '\n' + k.h2('El coste se mide desde el primer día') + '\n' + k.row(
    k.tile(C.white, k.lab('Coste de una reserva de 6 turnos', C.muted) + '\n' + k.row(bar('0,24 €', 240, C.wine, 'Medido: todo con el modelo más caro') + '\n' + bar('≈ 0,08 €', 80, C.blue, 'Objetivo: 70 % de turnos en el modelo rápido'), 64, ';align-items:flex-end'), { pad: '36px 40px', gap: 16, flex: 'flex:1.15;' }) + '\n'
    + k.col(hyp(C.linen, '25–35 €', 'Coste mensual de servir a una empresa pequeña') + '\n' + hyp(C.peach, '65–75 %', 'Margen bruto a 98 € al mes, precio sin decidir'), 16, ';flex:1'), 16, ';align-items:stretch') });
  S.estado = k.numbers('estado', { tag: 'Dónde estamos hoy', title: 'La base está construida y probada.', soft: 'Todavía no hay clientes ni ingresos.', foot: 'A 11 de noviembre de 2026',
    nums: [['≈ 2.380', 'tests automáticos'], ['1.145', 'tests de aislamiento entre empresas'], ['24 de 24', 'casos de ataque superados'], ['59', 'cambios integrados en 12 días']], track: { done: 1, label: 'Hito 1 de 5 en curso: base segura' },
    tiles: [{ bg: C.ink, title: 'Funciona en pruebas', text: 'Acceso con segundo factor, ejecución duradera, un agente que conversa con un modelo real.' }, { bg: C.white, title: 'Falta para el primer cliente', text: 'Canales reales, primeras integraciones, cobro y las condiciones de seguridad y legales.' }] });
  S.hoja = k.timeline('hoja', { tag: 'Hoja de ruta', title: 'Primer cliente en marzo de 2027.', soft: 'Piloto completo en abril.', foot: 'Estimaciones, no compromisos · después: voz, más sectores, autoservicio y certificaciones', points: [
    { at: TL[0], kind: 'now', date: '24 nov · ahora', title: 'Base segura', text: 'Guardas y decisiones de arquitectura' },
    { at: TL[1], date: '18 dic', title: 'Plataforma', text: 'Motor, reglas, memoria y conectores' },
    { at: TL[2], date: '27 ene', title: 'Servicio en pruebas', text: 'El servicio principal, de principio a fin' },
    { at: TL[3], kind: 'key', date: '8 mar', title: 'Primer cliente', text: '16 casos de uso, 30 integraciones' },
    { at: TL[4], date: '5 abr', title: 'Piloto completo', text: '22 casos de uso, 50 integraciones' }],
    strip: { label: 'Primer cliente, por escenario', items: ['Solo código: 14 de enero', 'Realista: 8 de marzo', 'Prudente: 10 de mayo'], hot: 1 } });
  S.mercado = k.stairs('mercado', { tag: 'Salida al mercado', title: 'De la red propia a contratos de empresa', line: 'El autoservicio corre en paralelo desde el piloto completo: capta la empresa pequeña sin coste de venta.', steps: [
    ['01 · ahora', 'Red del fundador', 'Conversaciones abiertas, ninguna carta firmada todavía.'], ['02 · 2027', 'Piloto de pago', 'Pocas empresas, acompañadas. Sale un caso con cifras.'],
    ['03', 'Canal', 'Agencias, consultoras e integradores que implantan a sus clientes.'], ['04', 'Empresa', 'Cadenas y grupos: un contrato, muchas sedes y muchos agentes.']] });
  S.competencia = k.compare('competencia', { tag: 'Posicionamiento', title: 'Entre el chatbot y la automatización a medida', foot: 'Comparación por categorías · competidores concretos: [por añadir]', head: ['', 'Chatbots de atención', 'Automatización por flujos', 'Moodly'], rows: [
    ['Trabajo de principio a fin', 'Responde y deriva', 'Solo lo programado', 'Decide, actúa y registra'], ['Aprende con el uso', 'Se reajusta a mano', 'Hay que rehacer el flujo', 'Memoria por agente'],
    ['Control de lo que hace', 'Guion fijo', 'Reglas en cada flujo', 'Autonomía por niveles'], ['Varias sedes y equipos', 'Rara vez', 'Proyecto a medida', 'Organización, región, local'], ['Agentes nuevos', 'Un bot por caso', 'Un flujo nuevo cada vez', 'Configuración, mismo motor']] });
  S.equipo = k.slide('equipo', { foot: 'Ritmo medido en los 12 días hasta el 11 de noviembre de 2026', body: k.pill('El equipo') + '\n' + k.h2('Un fundador y un método de desarrollo con IA.', 'Rápido, y con cada cambio probado.') + '\n' + k.row(
    k.tile(C.linen, k.lab('Fundador', C.soft) + '\n' + k.h3('[Nombre y apellidos]', 52) + '\n' + k.p('[Perfil: experiencia previa, por qué este problema, qué has construido antes]', 28, C.soft) + '\n<div style="flex:1"></div>\n' + k.p('Primeras incorporaciones: [por definir]', 28), { pad: '40px', gap: 16 }) + '\n'
    + k.tile(C.ink, k.row(`<p style="font-family:${k.FT};font-size:180px;line-height:1;letter-spacing:-8px">59</p>\n` + k.p('cambios integrados<br>en 12 días', 32, '', ';padding:0px 0px 20px'), 28, ';align-items:flex-end') + '\n' + k.ul(['Varias sesiones de IA en paralelo, con una que coordina', 'Ningún cambio entra sin tests en verde', 'El plan y el estado viven en el repositorio'], 26), { pad: '44px', gap: 24 }), 16, ';align-items:stretch;flex:1') });
  const use = (t, v, ph) => k.box(`display:flex;flex-direction:row;gap:24px;align-items:center;justify-content:space-between;background:${C.white};padding:24px 32px;border:1px solid ${C.line};border-radius:12px`, k.p(t, 28) + '\n' + `<p style="font-family:${k.FD};font-size:28px;line-height:1.2;color:${ph ? C.blue : C.ink}">${v}</p>`);
  S.fondos = k.slide('fondos', { foot: 'Los tres importes con cifra son estimaciones propias, sin presupuesto de proveedor', body: k.row(
    k.col(k.pill('Lo que buscamos') + '\n' + k.tile(C.orange, `<p style="font-family:${k.FT};font-size:176px;line-height:1;letter-spacing:-8px">[€__]</p>\n<div style="flex:1"></div>\n` + k.p('para llegar al piloto completo antes y con casos medidos', 36) + '\n' + k.p('Instrumento: [por definir] · Horizonte: [__ meses]', 26, C.soft), { pad: '44px', gap: 16 }), 40, ';width:720px') + '\n'
    + k.col(k.lab('Uso de los fondos', C.ink, 34) + '\n' + use('Capacidad de desarrollo', '[€__]', 1) + '\n' + use('Primeras ventas a empresa', '[€__]', 1) + '\n' + use('Revisión de seguridad externa', '3.000–10.000 €') + '\n' + use('Asesoría legal y de datos', '1.500–5.000 €') + '\n' + use('Herramientas e IA, seis meses', '3.000–3.500 €'), 14, ';flex:1;justify-content:flex-end'), 48, ';align-items:stretch;flex:1') });
  S.riesgos = k.risks('riesgos', { tag: 'Riesgos', title: 'Los riesgos, dichos de frente', items: [
    ['Dependencias externas', 'Altas en canales, seguridad y legal marcan la fecha más que el código.', 'Empezarlas ya, en paralelo al desarrollo.'], ['Coste de los modelos', 'El margen depende de que el modelo rápido resuelva la mayoría de turnos.', 'Coste medido y libertad para cambiar de modelo.'],
    ['Un solo fundador', 'Hoy el proyecto depende de una persona.', 'Plan y estado escritos en el repositorio; incorporaciones con la ronda.'], ['Confianza de la empresa grande', 'Delegar trabajo real en IA exige garantías, y aún no hay casos.', 'Aprobaciones, traza y revisión externa antes del primer dato real.']] });
  S.cierre = k.closing('cierre', { title: 'Agentes que hacen el trabajo, en cualquier empresa.', sub: 'Siguiente paso: una demostración en el entorno de pruebas y el plan técnico completo.', contact: 'contact@moodly.com' });
  require('./inv2.cjs')(k, S, N);
  require('./inv3.cjs')(k, S, N);
  require('./inv4.cjs')(k, S, N);
  require('./inv5.cjs')(k, S, N);
  require('./inv6.cjs')(k, S, N);
  require('./inv7.cjs')(k, S, N);
  require('./inv8.cjs')(k, S, N);
  require('./inv9.cjs')(k, S, N);
  require('./inv10.cjs')(k, S, N);
  require('./inv11.cjs')(k, S, N);
  require('./inv12.cjs')(k, S, N);
  require('./inv13.cjs')(k, S, N);
  return S;
}

// ---------------- pilot deck ----------------
function pilot() {
  const A = { lw: '4e458777514f445d93dcafd9e6a32984', lb: '8225a852b9cea02ed2cce294b2a6db5f', p: { comentario: '363c1a0937222888d7ca3a261bb27265', diurno: '18c25480f3fc5f90d73c68dfd8b0b66c', equilibrio: 'aa6fb291a8a10bd3f1f58b911f7dde80', libro: '0f7f3880008897fe1b45cb78a121326d', ordenador: '97024e1eccca822d5994f6db377213be', tiempo: '55c55cc29899808a314365a670a74226', energia: '687f1238cb79aed8d1439a3dcfae21c1', paquete: '7cbf8573d8e6971de98a166d7b6403ff' } };
  const N = readNotes('deck'); const k = mk(A, N), { C, AG } = k, S = {};
  S.cover = k.cover('cover', { tag: 'Piloto 2027 · presentación para empresas', title: 'Un equipo de agentes de IA dentro de tu empresa', sub: 'Atienden, venden, cobran y organizan. Aprenden de tu equipo. Lo sensible pasa por ti.', foot: 'Noviembre de 2026 · producto en construcción' });
  S.tesis = k.statement('tesis', { tag: 'La idea', title: 'No es un chatbot.', soft: 'Es un equipo que hace el trabajo, lo explica y aprende.' });
  S.problema = k.split('problema', { tag: 'El problema', title: 'Toda empresa repite cada día el mismo trabajo.', soft: 'Y lo que no se atiende, se pierde.', tiles: [
    { bg: C.sage, picto: 'comentario', title: 'Atender', text: 'Mensajes, correos y llamadas a cualquier hora.' }, { bg: C.linen, picto: 'energia', title: 'Vender', text: 'Contactos a los que nadie vuelve a escribir.' },
    { bg: C.pink, picto: 'equilibrio', title: 'Cobrar', text: 'Señales, facturas y recordatorios hechos a mano.' }, { bg: C.rock, picto: 'tiempo', title: 'Organizar', text: 'Agenda, pedidos y turnos que dependen de una persona.' }] });
  S.agentes = k.agents('agentes', { tag: 'El equipo', title: 'Cuatro agentes de serie.', soft: 'Y todos los que tu empresa necesite.', cards: [
    ['Agenda, reservas, pedidos y peticiones.', 'WhatsApp · web'], ['Responde con lo que sabe de tu empresa.', 'Email · redes'], ['Capta, cualifica y hace seguimiento.', 'CRM · email'], ['Cobros y facturas, con tu visto bueno.', 'Pagos']],
    own: ['+ Los tuyos', 'Creados para tu empresa: eventos, compras, prensa, castings.', 'A medida'], line: 'Se coordinan entre sí: una reserva genera su recordatorio y su cobro.' });
  S.amedida = k.slide('amedida', { foot: 'En el piloto, los agentes propios los configuramos contigo', body: k.pill('Agentes a medida') + '\n' + k.h2('Cada agente tiene lo suyo.', 'Y todos trabajan como un solo equipo.') + '\n' + k.row(
    k.col([[C.sage, 'De serie', 'Los cuatro, listos el primer día.'], [C.linen, 'De plantilla', 'Por sector: reseñas, personal, proveedores.'], [C.pink, 'Propios', 'Creados para ti, desde cero o duplicando uno.']].map(t => k.tile(t[0], k.h3(t[1], 36) + '\n' + k.p(t[2], 26, C.soft), { pad: '26px 32px', gap: 6 })).join('\n'), 16, ';flex:1') + '\n'
    + k.tile(C.green, k.lab('Lo que tiene cada agente', C.sage) + '\n' + k.ul(['Su conocimiento y su memoria', 'Su ciclo de aprendizaje con tu equipo', 'Sus skills, canales y permisos', 'Sus objetivos y su nivel de autonomía'], 32) + '\n<div style="flex:1"></div>\n' + k.p('Mismo motor, mismas reglas, misma traza.', 28, C.sage), { pad: '44px', gap: 24 }), 16, ';align-items:stretch;flex:1') });
  S.anatomia = k.flow('anatomia', { tag: 'Cómo trabaja un agente', title: 'Cada acción sigue el mismo recorrido', steps: [['Entrada', 'WhatsApp, email, chat web.'], ['Contexto', 'Conocimiento y memoria de tu empresa.'], ['Decisión', 'Qué puede hacer y con qué permiso.'], ['Acción', 'En tu agenda, tu CRM o tus pagos.'], ['Registro', 'Traza, coste y resultado.']],
    levelsLabel: 'Cuatro niveles de autonomía: el techo lo pone el riesgo de la acción, no el modelo', levels: ['Sugiere', 'Prepara', 'Ejecuta', 'Autónomo'] });
  const bub = (t, mine) => `<p style="font-size:28px;line-height:1.4;background:${mine ? AG.green : C.canvas};color:${mine ? C.white : C.ink};padding:18px 24px;border-radius:12px;width:450px;align-self:${mine ? 'flex-end' : 'flex-start'}">${t}</p>`;
  const tr = (a, b) => k.row(`<p style="font-family:${k.FD};font-size:26px;line-height:1.3;color:${C.muted};width:200px">${a}</p>\n` + k.p(b, 26), 12);
  S.ejemplo = k.slide('ejemplo', { foot: 'Ejemplo ilustrativo con un restaurante', body: k.pill('Un ejemplo') + '\n' + k.h2('De un mensaje a un trabajo hecho') + '\n' + k.row(
    k.tile(C.white, k.lab('Lo que ve el cliente · WhatsApp') + '\n' + bub('Hola, ¿tenéis hueco el jueves por la noche? Somos seis.') + '\n' + bub('Sí: jueves a las 20:30 para seis. Para grupos pedimos una señal. ¿Te envío el enlace?', 1) + '\n' + bub('Perfecto, envíalo.'), { pad: '36px', gap: 18, flex: 'flex:1.3;' }) + '\n'
    + k.col(k.tile(AG.peach, k.lab('Pendiente de tu aprobación', AG.cin) + '\n' + k.p('Administración preparó el enlace de pago de la señal.', 30) + '\n' + k.row(k.pill('Aprobar y enviar', C.ink, C.white, false) + '\n' + k.pill('Editar'), 12), { pad: '32px', gap: 14 }) + '\n'
      + k.tile('#dcebdd', k.lab('✓ Hecho', AG.green) + '\n' + k.p('Recepción reservó la mesa · WhatsApp → Calendar', 28), { pad: '32px', gap: 10, flex: '' }), 16, ';flex:1') + '\n'
    + k.tile(C.linen, k.lab('El porqué de cada paso', C.soft) + '\n' + tr('Entrada', 'WhatsApp') + '\n' + tr('Conocimiento', 'horario y aforo') + '\n' + tr('Regla', 'grupos: señal') + '\n' + tr('Acción', 'reserva creada') + '\n' + tr('Acción', 'cobro en borrador') + '\n' + tr('Espera', 'tu aprobación'), { pad: '36px', gap: 18 }), 16, ';align-items:stretch;flex:1') });
  const sector = (name, lines) => k.tile(C.white, k.h3(name, 38) + '\n' + [[AG.green, C.white, 'Recepción'], [AG.rock, C.ink, 'Atención'], [AG.wine, C.white, 'Comercial'], [AG.cin, C.white, 'Admin.']].map((a, i) =>
    k.row(`<p style="font-family:${k.FD};font-size:26px;line-height:1.2;background:${a[0]};color:${a[1]};border-radius:800px;padding:8px 18px;width:172px">${a[2]}</p>\n` + k.p(lines[i], 26, '', ';flex:1'), 16, ';align-items:center')).join('\n<div style="flex:1"></div>\n'), { pad: '28px 32px', gap: 8 });
  S.sectores1 = k.slide('sectores1', { foot: 'Ejemplos de configuración por sector, no funciones ya entregadas · 1 de 2', body: k.pill('Sectores') + '\n' + k.h2('Un mismo equipo, cualquier empresa') + '\n' + k.row(
    sector('Cadena de restauración', ['Reservas, grupos y lista de espera', 'Alérgenos, horarios y pedidos', 'Eventos y empresas', 'Señales y facturas de eventos']) + '\n' + sector('Supermercados', ['Pedidos para recoger y entregas', 'Disponibilidad e incidencias', 'Clientes de empresa y hostelería', 'Devoluciones y proveedores']) + '\n' + sector('Tienda online y física', ['Citas en tienda y recogidas', 'Estado del pedido, cambios, tallas', 'Carritos abandonados y recompra', 'Reembolsos y facturas']), 16, ';align-items:stretch;flex:1')
    + '\n' + k.p('El piloto arranca con reservas y atención. El resto se activa con skills e integraciones a medida.', 28) });
  S.sectores2 = k.slide('sectores2', { foot: 'Ejemplos de configuración por sector, no funciones ya entregadas · 2 de 2', body: k.pill('Sectores') + '\n' + k.h2('También donde el producto es talento o marca') + '\n' + k.row(
    sector('Agencia creativa', ['Reuniones, briefings y entregas', 'Estado de cada proyecto', 'Peticiones: briefing y propuesta', 'Presupuestos, horas y facturas']) + '\n' + sector('Marca de moda', ['Showroom, fittings y salas', 'Tiendas, mayoristas y prensa', 'Pedidos de mayoristas', 'Facturas, cobros y gastos']) + '\n' + sector('Agencia de talento', ['Castings, pruebas y viajes', 'Disponibilidad y materiales', 'Condiciones, fechas y tarifas', 'Contratos y liquidaciones']), 16, ';align-items:stretch;flex:1')
    + '\n' + k.p('Si tu empresa no está aquí, la pregunta es la misma: qué se repite cada día y a qué sistemas hay que conectarse.', 28) });
  S.adaptacion = k.slide('adaptacion', { body: k.pill('Cómo se adapta') + '\n' + k.h2('Tres capas para hacerlo tuyo, sin programar') + '\n' + k.row(
    [[C.sage, 'Capa 1', 'Plantilla de fábrica', 'Tono, mensajes, skills y aprobaciones por defecto para tu sector.'], [C.linen, 'Capa 2', 'Interruptores', 'Activas o desactivas lo que viene hecho, sin escribir nada.'], [C.pink, 'Capa 3', 'Modo avanzado', 'Textos, umbrales, reglas y conocimiento a tu medida.']].map(t => k.tile(t[0], k.lab(t[1], C.soft) + '\n<div style="flex:1"></div>\n' + k.h3(t[2], 46) + '\n' + k.p(t[3], 28, C.soft), { pad: '36px', gap: 10 })).join('\n'), 16, ';align-items:stretch;flex:1.4')
    + '\n' + k.row(k.tile(C.green, k.h3('Varios locales o sedes', 42) + '\n' + k.p('Organización, región y local: cada nivel bloquea lo que los de abajo no deben cambiar.', 28, C.onDark), { pad: '32px 36px', gap: 8 }) + '\n' + k.tile(C.white, k.h3('A medida', 42) + '\n' + k.p('Skills e integraciones propias para los sistemas que no están en el catálogo.', 28, C.muted), { pad: '32px 36px', gap: 8 }), 16, ';align-items:stretch;flex:1') });
  S.diferencia = k.bento('diferencia', { tag: 'Qué lo hace distinto', title: 'Hace el trabajo completo.', soft: 'Y responde de él.', items: [
    { picto: 'paquete', title: 'Se coordinan', text: 'Una reserva genera su recordatorio y su cobro.' }, { picto: 'libro', title: 'Aprende', text: 'Cada corrección de tu equipo pasa a ser conocimiento.' }, { picto: 'comentario', title: 'Se explica', text: 'Ves qué hizo, con qué datos y por qué.' },
    { picto: 'equilibrio', title: 'Se gana la autonomía', text: 'Empieza pidiendo permiso; tú decides cuándo soltarle.' }, { picto: 'diurno', title: 'Mide lo que aporta', text: 'Valor creado frente a lo que cuesta.' }, { picto: 'ordenador', title: 'Una sede o cien', text: 'Reglas por organización, región y local.' }] });
  S.confianza = k.columns('confianza', { tag: 'Seguridad y confianza', title: 'Seguridad que se puede enseñar.', soft: 'Sin prometer lo que aún no está.', cols: [
    { bg: C.ink, title: 'Ya está en la base', items: ['Datos de cada cliente aislados, con 1.145 pruebas', 'Doble factor para quien administra', 'Aprobación humana para lo sensible'] },
    { bg: C.white, title: 'Antes del primer cliente', items: ['Todo el tratamiento en la UE', 'Revisión de seguridad independiente', 'Registro de accesos, borrado y exportación'] },
    { bg: C.white, title: 'En hoja de ruta', items: ['Certificaciones ISO 27001 y ENS', 'Acceso con la cuenta de empresa', 'Nube dedicada para grandes cuentas'] }] });
  S.estado = k.numbers('estado', { tag: 'Dónde estamos hoy', title: 'En construcción.', soft: 'Con la base hecha y todavía sin clientes reales.', foot: 'Datos del repositorio a 11 de noviembre de 2026',
    nums: [['≈ 2.380', 'tests automáticos en verde'], ['1.145', 'pruebas de aislamiento de datos'], ['24 de 24', 'casos de seguridad superados'], ['1 de 5', 'hitos: vamos por el primero']], track: { done: 1, label: 'Hito 1 de 5 en curso: base segura' },
    tiles: [{ bg: C.ink, title: 'Ya funciona en pruebas', items: ['Reservar, cambiar y cancelar por chat', 'Respuestas con el conocimiento de la empresa'] }, { bg: C.white, title: 'Falta para el primer cliente', items: ['WhatsApp real y conexión con reservas y cobro', 'Revisión de seguridad y textos legales'] }] });
  S.calendario = k.timeline('calendario', { tag: 'El plan', title: 'Cinco hitos hasta el piloto completo', foot: 'Fechas estimadas, no compromisos · después: voz, más sectores, autoservicio y certificaciones', points: [
    { at: TL[0], kind: 'now', date: 'Nov · aquí', title: 'Base segura', text: 'Reglas y revisión del desarrollo' }, { at: TL[1], date: 'Mediados de dic', title: 'Plataforma', text: 'WhatsApp, chat web y operación' },
    { at: TL[2], date: 'Finales de enero', title: 'Servicio en pruebas', text: 'Recepción y Atención completas' }, { at: TL[3], kind: 'key', date: 'Marzo de 2027', title: 'Primer cliente real', text: '16 casos de uso, 5 canales' }, { at: TL[4], date: 'Abril de 2027', title: 'Piloto completo', text: '22 casos de uso, asistente y coach' }],
    strip: { label: 'El primer cliente puede llegar', items: ['Pronto: enero', 'Previsto: marzo', 'Tarde: mayo'], hot: 1 } });
  S.piloto = k.columns('piloto', { tag: 'El piloto', title: 'Qué recibe una empresa piloto.', soft: 'Y qué le pedimos a cambio.', size: 30, cols: [
    { bg: C.ink, title: 'Lo que te llevas', items: ['Tus agentes configurados con tu forma de trabajar', 'Conexión con los sistemas que ya usas', 'Puesta en marcha y acompañamiento directo', 'Precio de fundador: [€__]'] },
    { bg: C.linen, title: 'Lo que te pedimos', items: ['Un rato cada semana para contarnos qué falla', 'Acceso a tus sistemas y a alguien que los conozca', 'Permiso para contar tu caso con cifras'] }] });
  S.buscamos = k.bento('buscamos', { tag: 'A quién buscamos', title: 'De cinco a diez empresas fundadoras.', soft: 'De una sede a una cadena.', line: 'Restauración, comercio, moda, agencias, servicios con cita. Plazas limitadas y precio cerrado, a cambio de tu opinión y de un caso de éxito.', items: [
    { picto: 'comentario', title: 'Clientes que escriben', text: 'Más de lo que el equipo puede atender a tiempo.' }, { picto: 'tiempo', title: 'Trabajo que se repite', text: 'Reservas, pedidos, seguimiento o cobros, cada día.' }, { picto: 'energia', title: 'Ganas de probar', text: 'Un responsable con un rato cada semana.' }] });
  S.cierre = k.closing('cierre', { title: 'Pon tu primer agente a trabajar.', sub: 'Cuéntame qué se repite cada día en tu empresa y qué sistemas usas. Con eso sabemos si encajas en el piloto.', contact: 'contact@moodly.com' });
  require('./pil2.cjs')(k, S, N);
  require('./pil3.cjs')(k, S, N);
  require('./pil4.cjs')(k, S, N);
  require('./pil5.cjs')(k, S, N);
  require('./pil6.cjs')(k, S, N);
  require('./pil7.cjs')(k, S, N);
  require('./pil8.cjs')(k, S, N);
  require('./pil9.cjs')(k, S, N);
  return S;
}

const SITE = path.resolve(__dirname, '../../../apps/site/public'), FONTS = `${SITE}/fonts`, BR = `${SITE}/brand`;
for (const [src, out, S] of [['deck-inv', 'inv', investor()], ['deck', 'pil', pilot()]]) {
  const idx = JSON.parse(fs.readFileSync(`${SP}/${src}/project/deck.json`, 'utf8'));
  if (S.__order) { idx.order = S.__order; idx.sections = S.__sections; }
  if (S.__after) for (const [a, ids] of S.__after) idx.order.splice(idx.order.indexOf(a) + 1, 0, ...ids);
  if (S.__move) for (const [id, after] of S.__move) { idx.order.splice(idx.order.indexOf(id), 1); idx.order.splice(idx.order.indexOf(after) + 1, 0, id); }
  for (const id of idx.order) if (!S[id]) throw new Error(`missing ${src}/${id}`);
  fs.mkdirSync(`${__dirname}/${out}/project/slides`, { recursive: true });
  for (const id of idx.order) fs.writeFileSync(`${__dirname}/${out}/project/slides/${id}.html`, S[id]);
  delete idx.faces['jetbrains-mono'];
  fs.writeFileSync(`${__dirname}/${out}/project/deck.json`, JSON.stringify(idx, null, 2) + '\n');
  // local preview
  const blobs = {};
  const add = (id, f) => { blobs[id] = 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64'); };
  const all = idx.order.map(id => S[id]).join('\n');
  const ids = [...new Set(all.match(/\/_blob\/[0-9a-f]{32}/g))];
  const cfg = fs.readFileSync(__filename, 'utf8');
  for (const b of ids) { const id = b.slice(7); const m = cfg.match(new RegExp(`(\\w+): '${id}'`)); const name = m[1]; add(id, name === 'lw' ? `${BR}/moodly-logo-white.svg` : name === 'lb' ? `${BR}/moodly-logo-black.svg` : `${BR}/pictos/${name}.svg`); }
  let html = all.replace(/\/_blob\/([0-9a-f]{32})/g, (_, id) => blobs[id]);
  const f64 = n => fs.readFileSync(`${FONTS}/${n}`).toString('base64');
  html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"Labil Grotesk";src:url(data:font/woff2;base64,${f64('LabilGrotesk-Regular.woff2')})}
@font-face{font-family:"Labil Grotesk Thin";src:url(data:font/woff2;base64,${f64('LabilGrotesk-Thin.woff2')})}
@font-face{font-family:"Plus Jakarta Sans";font-weight:400;src:url(data:font/woff2;base64,${f64('PlusJakartaSans-Regular.woff2')})}
@font-face{font-family:"Plus Jakarta Sans";font-weight:300;src:url(data:font/woff2;base64,${f64('PlusJakartaSans-Light.woff2')})}
*{box-sizing:border-box}body{margin:0;background:#888}p,h1,h2,h3,ul{margin:0}ul{padding-left:1.2em}
section{position:relative;width:1920px;height:1080px;overflow:hidden;margin:0 0 24px}aside{display:none}
x-shape{display:block;clip-path:polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)}
</style>${html}`;
  fs.writeFileSync(`${__dirname}/${out}/preview.html`, html);
  console.log(out, idx.order.length, 'slides');
}
