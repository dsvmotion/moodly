// Second pass on the investor deck: accelerator structure, USP, moat, market, pricing, traction, ask.
module.exports = function (k, S, N) {
  const { C, AG } = k;
  Object.assign(N, {
    cover: 'Una frase: qué hace Moodly y para quién. Di desde el principio la fase: producto en construcción, sin clientes ni ingresos, piloto previsto para la primavera de 2027.',
    tesis: 'Esta es la propuesta de valor en una línea. Si solo recuerdan una frase de la reunión, que sea esta.',
    usp: 'Cada una de las cuatro existe por separado en el mercado. Lo que no hemos visto es las cuatro juntas en un producto que una empresa mediana pueda poner en marcha sin un equipo técnico. Dilo así, como hipótesis que el piloto tiene que confirmar, no como hecho.',
    problema: 'El hueco de abajo es deliberado: todavía no tenemos medido cuánto le cuesta el problema a un cliente. Es lo primero que hay que medir en el piloto: horas a la semana y ventas o cobros que se pierden.',
    demo: 'Es una maqueta fiel a las tres vistas del producto, no una captura. Si puedes, sustitúyela en la reunión por una demostración en vivo en el entorno de pruebas: reservar por chat ya funciona allí.',
    porque: 'Los tres cambios son recientes. La cifra de coste es nuestra, medida en el entorno de pruebas con el modelo más caro; con reparto entre modelos el objetivo es un tercio.',
    foso: 'Responde de frente a la pregunta que te harán: no tenemos modelo propio ni datos propios todavía. La defensa es lo que rodea al modelo, y crece con cada cliente. El último punto convierte la amenaza en ventaja: cuando un proveedor mejora o abarata su modelo, nosotros lo aprovechamos.',
    tam: 'TAM y SAM están sin calcular a propósito: hay que sacarlos de una fuente oficial, por ejemplo el directorio de empresas del INE, y no de un informe genérico sobre IA. El SOM sí es nuestro: 300 empresas en 24 meses con la mezcla de planes propuesta.',
    negocio: 'Son precios propuestos. El de 98 euros viene del modelo de costes de la auditoría; los otros dos son una propuesta de partida que el piloto tiene que validar. El ejemplo de la cadena es aritmética con esos precios, no un contrato.',
    estado: 'Sé directo: la tracción hoy es técnica, no comercial. Rellena los dos huecos con el número real de empresas con las que has hablado y cuántas han dicho por escrito que quieren ser piloto. Una carta de intención firmada cambia esta diapositiva.',
    equipo: 'En esta fase se invierte sobre todo en la persona. Completa tu perfil: qué has construido antes y por qué este problema. Di claro que el primer uso del dinero es dejar de ser un equipo de uno.',
    fondos: 'Propuesta de partida, para ajustar contigo. 250.000 euros cubren 12 meses con una persona de ingeniería y otra de ventas e implantación. El primer tramo, 60.000, es lo que hace falta para llegar al primer cliente y se puede cerrar con personas cercanas. La nota convertible evita fijar valoración ahora; cap y descuento se negocian.',
  });
  S.cover = k.cover('cover', { tag: 'Presentación para inversores · noviembre de 2026', title: 'Un equipo de agentes de IA para cualquier empresa', sub: 'Moodly hace el trabajo operativo de una empresa: atiende, vende, cobra y organiza. Aprende de su equipo y actúa bajo sus reglas.', foot: 'Diego Sanjuan, fundador · producto en construcción' });
  S.tesis = k.statement('tesis', { tag: 'Propuesta de valor', title: 'Un equipo de agentes propio para cada empresa.', soft: 'Hace el trabajo, aprende de su equipo y actúa bajo sus reglas.' });
  S.usp = k.bento('usp', { tag: 'Qué nos hace distintos', title: 'Cuatro cosas que hoy no vienen juntas', cols: 2, items: [
    { picto: 'paquete', title: 'Trabajo de principio a fin', text: 'Actúa en los sistemas de la empresa; no se queda en responder.' },
    { picto: 'libro', title: 'Memoria que aprende', text: 'Cada corrección del equipo pasa a ser conocimiento del agente.' },
    { picto: 'equilibrio', title: 'Control en cada acción', text: 'Autonomía por niveles, aprobación humana y traza de cada decisión.' },
    { picto: 'ordenador', title: 'Cualquier sector y tamaño', text: 'Agentes a medida por configuración; de una sede a una cadena.' }] });
  S.problema = k.split('problema', { tag: 'El problema', title: 'El trabajo operativo se come el día de cualquier empresa.', soft: 'Y lo que hay hoy no lo quita.', foot: 'Coste para el cliente, en horas y ventas perdidas: [medir en el piloto]', tiles: [
    { bg: C.white, picto: 'comentario', title: 'Chatbots', text: 'Responden, pero no hacen: el trabajo vuelve a una persona.' },
    { bg: C.white, picto: 'tiempo', title: 'Automatización por flujos', text: 'Hay que programar cada caso, y se rompe cuando algo cambia.' },
    { bg: C.white, picto: 'energia', title: 'Contratar más', text: 'No escala, y el conocimiento se va con cada baja.' }] });
  const bub = (t, mine) => `<p style="font-size:28px;line-height:1.4;background:${mine ? AG.green : C.canvas};color:${mine ? C.white : C.ink};padding:18px 24px;border-radius:12px;width:450px;align-self:${mine ? 'flex-end' : 'flex-start'}">${t}</p>`;
  const tr = (a, b) => k.row(`<p style="font-family:${k.FD};font-size:26px;line-height:1.3;color:${C.muted};width:200px">${a}</p>\n` + k.p(b, 26), 12);
  S.demo = k.slide('demo', { foot: 'Maqueta fiel al producto · demostración en vivo en el entorno de pruebas', body: k.pill('La solución, en un caso') + '\n' + k.h2('De un mensaje a un trabajo hecho') + '\n' + k.row(
    k.tile(C.white, k.lab('Lo que ve el cliente · WhatsApp') + '\n' + bub('Hola, ¿tenéis hueco el jueves por la noche? Somos seis.') + '\n' + bub('Sí: jueves a las 20:30 para seis. Para grupos pedimos una señal. ¿Te envío el enlace?', 1) + '\n' + bub('Perfecto, envíalo.'), { pad: '36px', gap: 18, flex: 'flex:1.3;' }) + '\n'
    + k.col(k.tile(AG.peach, k.lab('Pendiente de tu aprobación', AG.cin) + '\n' + k.p('Administración preparó el enlace de pago de la señal.', 30) + '\n' + k.row(k.pill('Aprobar y enviar', C.ink, C.white, false) + '\n' + k.pill('Editar'), 12), { pad: '32px', gap: 14 }) + '\n'
      + k.tile('#dcebdd', k.lab('✓ Hecho', AG.green) + '\n' + k.p('Recepción reservó la mesa · WhatsApp → Calendar', 28), { pad: '32px', gap: 10, flex: '' }), 16, ';flex:1') + '\n'
    + k.tile(C.white, k.lab('El porqué de cada paso', C.soft) + '\n' + tr('Entrada', 'WhatsApp') + '\n' + tr('Conocimiento', 'horario y aforo') + '\n' + tr('Regla', 'grupos: señal') + '\n' + tr('Acción', 'reserva creada') + '\n' + tr('Acción', 'cobro en borrador') + '\n' + tr('Espera', 'tu aprobación'), { pad: '36px', gap: 18 }), 16, ';align-items:stretch;flex:1') });
  S.porque = k.split('porque', { tag: '¿Por qué ahora?', title: 'Tres cambios recientes lo hacen posible.', soft: '', tiles: [
    { bg: C.white, picto: 'ordenador', title: 'Los modelos ya actúan', text: 'Usan herramientas: reservan, cobran o actualizan un CRM.' },
    { bg: C.white, picto: 'comentario', title: 'El cliente ya escribe', text: 'WhatsApp, email y chat son hoy el mostrador de la empresa.' },
    { bg: C.white, picto: 'equilibrio', title: 'El coste lo permite', text: '0,24 € medidos por conversación completa, y bajando.' }] });
  S.foso = k.split('foso', { tag: 'Defensa', title: 'Si un gigante lanza agentes, ¿qué nos queda?', soft: '', text: 'El modelo es intercambiable. Lo que cuesta copiar es lo que lo rodea.', leftW: 560, foot: 'Hoy todavía sin datos propios: la defensa crece con cada cliente', tiles: [
    { bg: C.ink, label: 'Memoria de cada empresa', labelW: 400, text: 'Conocimiento y correcciones acumuladas: cuanto más se usa, más cuesta irse' },
    { bg: C.white, label: 'Integraciones', labelW: 400, text: '147 conectores previstos con los sistemas de cada sector' },
    { bg: C.white, label: 'Control y traza', labelW: 400, text: 'Reglas, aprobaciones y auditoría: lo que exige una empresa grande' },
    { bg: C.white, label: 'Plantillas por sector', labelW: 400, text: 'Agentes, reglas y evaluaciones listos para cada tipo de negocio' },
    { bg: C.white, label: 'Libertad de modelo', labelW: 400, text: 'Cada modelo mejor o más barato juega a nuestro favor' }] });
  const mkt = (bg, tag, val, def) => k.tile(bg, k.lab(tag, k.onSoft(bg), 28) + '\n<div style="flex:1"></div>\n' + `<p style="font-family:${k.FT};font-size:96px;line-height:1.05;letter-spacing:-4px">${val}</p>\n` + k.p(def, 28, k.onSoft(bg)), { pad: '40px', gap: 14 });
  S.tam = k.slide('tam', { foot: 'TAM y SAM: por calcular con datos del INE · SOM: objetivo propio con los precios propuestos', body: k.pill('Mercado') + '\n' + k.h2('Empezar por España,', 'por empresas que ya atienden por escrito.') + '\n' + k.row(
    mkt(C.white, 'TAM · mercado total', '[€__]', 'Empresas con empleados en España, por la cuota anual media') + '\n'
    + mkt(C.white, 'SAM · al que podemos servir', '[€__]', 'Servicios, comercio y hostelería con varios canales o varias sedes') + '\n'
    + mkt(C.ink, 'SOM · objetivo a 24 meses', '300 empresas', 'Unos 0,6 M€ de ingresos anuales con la mezcla de planes propuesta'), 16, ';align-items:stretch;flex:1') });
  const plan = (bg, name, price, unit, lines) => k.tile(bg, k.lab(name, k.onSoft(bg), 30) + '\n' + k.row(`<p style="font-family:${k.FT};font-size:88px;line-height:1.05;letter-spacing:-4px">${price}</p>\n` + k.p(unit, 28, k.onSoft(bg), ';padding:0px 0px 10px'), 14, ';align-items:flex-end') + '\n' + k.ul(lines, 28), { pad: '36px', gap: 18 });
  S.negocio = k.slide('negocio', { foot: 'Precios propuestos, a validar en el piloto · prueba de 7 días con 5 € de crédito', body: k.pill('Modelo de negocio') + '\n' + k.h2('Suscripción por empresa,', 'más uso y más implantación.') + '\n' + k.row(
    plan(C.white, 'Esencial · autoservicio', '98 €', 'al mes', ['Los 4 agentes de serie', '1 sede', 'Uso incluido hasta un tope']) + '\n'
    + plan(C.white, 'Equipo · autoservicio', '298 €', 'al mes', ['Agentes propios', 'Hasta 3 sedes', 'Más integraciones']) + '\n'
    + plan(C.ink, 'Empresa · contrato anual', '150 €', 'por sede al mes', ['Implantación desde 5.000 €', 'Agentes y skills a medida', 'Soporte y seguridad dedicados']), 16, ';align-items:stretch;flex:1')
    + '\n' + k.row(k.lab('Ejemplo: cadena de 20 sedes', C.ink, 30) + '\n' + k.p('20 × 150 € × 12 meses + 15.000 € de implantación = 51.000 € el primer año', 30, C.muted), 24, ';align-items:center') });
  S.estado = k.numbers('estado', { tag: 'Tracción y validación', title: 'La base está probada.', soft: 'La validación comercial empieza con el piloto.', foot: 'A 11 de noviembre de 2026',
    nums: [['≈ 2.380', 'tests automáticos'], ['1.145', 'tests de aislamiento entre empresas'], ['24 de 24', 'casos de ataque superados'], ['59', 'cambios integrados en 12 días']], track: { done: 1, label: 'Hito 1 de 5 en curso: base segura' },
    tiles: [{ bg: C.ink, title: 'Validación técnica', text: 'En pruebas: acceso con segundo factor, ejecución duradera y un agente que reserva por chat con un modelo real.' }, { bg: C.white, title: 'Validación comercial', text: 'Sin ingresos todavía. Empresas en conversación: [n]. Cartas de intención firmadas: [n].' }] });
  S.equipo = k.slide('equipo', { foot: 'Ritmo medido en los 12 días hasta el 11 de noviembre de 2026', body: k.pill('El equipo') + '\n' + k.h2('Un fundador y un método de desarrollo con IA.', 'La ronda paga las dos primeras incorporaciones.') + '\n' + k.row(
    k.tile(C.white, k.lab('Fundador', C.soft) + '\n' + k.h3('Diego Sanjuan', 60) + '\n' + k.p('[Perfil: qué has construido antes, tu experiencia técnica y de negocio, por qué este problema]', 28, C.muted) + '\n<div style="flex:1"></div>\n' + k.p('Primeras incorporaciones: ingeniería, y ventas e implantación', 28), { pad: '44px', gap: 20 }) + '\n'
    + k.tile(C.ink, k.row(`<p style="font-family:${k.FT};font-size:180px;line-height:1;letter-spacing:-8px">59</p>\n` + k.p('cambios integrados<br>en 12 días', 32, '', ';padding:0px 0px 20px'), 28, ';align-items:flex-end') + '\n' + k.ul(['Varias sesiones de IA en paralelo, con una que coordina', 'Ningún cambio entra sin tests en verde', 'El plan y el estado viven en el repositorio'], 26), { pad: '44px', gap: 24 }), 16, ';align-items:stretch;flex:1') });
  const use = (t, v, pct) => k.box(`display:flex;flex-direction:row;gap:24px;align-items:center;background:${C.white};padding:22px 32px;border:1px solid ${C.line};border-radius:12px`, k.p(t, 28, '', ';flex:1') + '\n' + `<p style="font-family:${k.FD};font-size:28px;line-height:1.2;color:${C.ink}">${v}</p>\n<p style="font-family:${k.FD};font-size:28px;line-height:1.2;color:${C.muted};width:80px;text-align:right">${pct}</p>`);
  S.fondos = k.slide('fondos', { foot: 'Propuesta de partida · instrumento sugerido: nota convertible, condiciones por negociar', body: k.row(
    k.col(k.pill('La ronda') + '\n' + k.tile(C.orange, `<p style="font-family:${k.FT};font-size:136px;line-height:1;letter-spacing:-6px">250.000 €</p>\n<div style="flex:1"></div>\n` + k.p('12 meses: piloto completo, 10 empresas de pago y los 3 primeros contratos de empresa', 34) + '\n' + k.p('Dos tramos: 60.000 € ahora, hasta el primer cliente, y 190.000 € al cerrar el piloto', 26, C.ink), { pad: '44px', gap: 16 }), 40, ';width:760px') + '\n'
    + k.col(k.lab('Uso de los fondos', C.ink, 34) + '\n' + use('Producto e ingeniería', '100.000 €', '40 %') + '\n' + use('Ventas e implantación', '60.000 €', '24 %') + '\n' + use('Fundador y operación', '45.000 €', '18 %') + '\n' + use('Infraestructura e IA', '25.000 €', '10 %') + '\n' + use('Seguridad y legal', '20.000 €', '8 %'), 14, ';flex:1;justify-content:flex-end'), 48, ';align-items:stretch;flex:1') });
  S.__order = ['cover', 'tesis', 'usp', 'problema', 'producto', 'demo', 'motor', 'porque', 'foso', 'horizontal', 'tam', 'negocio', 'economia', 'estado', 'hoja', 'mercado', 'competencia', 'confianza', 'equipo', 'fondos', 'riesgos', 'cierre'];
  S.__sections = {
    gancho: { description: 'El gancho: qué hace Moodly, para quién y qué lo hace distinto.', start: 'cover' },
    problema: { description: 'El problema y por qué las soluciones actuales no lo resuelven.', start: 'problema' },
    solucion: { description: 'La solución: el producto, un caso de principio a fin y cómo trabaja por dentro.', start: 'producto' },
    momento: { description: 'Por qué ahora, qué nos defiende y hasta dónde llega el producto.', start: 'porque' },
    negocio: { description: 'El mercado, el modelo de negocio y la economía por conversación.', start: 'tam' },
    traccion: { description: 'La tracción, la hoja de ruta, la salida al mercado, la competencia y la seguridad.', start: 'estado' },
    ronda: { description: 'El equipo, la ronda y los riesgos.', start: 'equipo' },
  };
};
