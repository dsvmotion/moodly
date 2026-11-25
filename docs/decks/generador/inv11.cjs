// Eleventh pass: more evidence, a capital-efficient base case, margin levers, neutral team slide, smaller angel round.
module.exports = function (k, S, N) {
  const { C } = k;
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  const fact = (v, t) => k.col(`<p style="font-family:${k.FD};font-size:40px;line-height:1.1;letter-spacing:-1px">${v}</p>\n` + k.p(t, 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px');
  const big = (bg, tag, val, def) => k.tile(bg, k.lab(tag, k.onSoft(bg), 30) + '\n<div style="flex:1"></div>\n' + `<p style="font-family:${k.FT};font-size:92px;line-height:1.05;letter-spacing:-4px">${val}</p>\n` + k.p(def, 26, k.onSoft(bg)), { pad: '32px 36px', gap: 10 });
  Object.assign(N, {
    retorno: 'Es un ejemplo, no una medición. Las 300 conversaciones al mes son el supuesto de nuestro plan Esencial: no hay dato publicado de cuántas recibe una pyme. El coste de 3,70 euros por chat viene de centros de contacto británicos (ContactBabel, 3,19 libras); en un negocio pequeño lo atiende alguien que hace más cosas y el coste real puede ser menor. El 52 a 76 % es lo que publican otros proveedores. Con todo eso, el cliente recupera entre 6.900 y 10.100 euros al año por 1.788 de cuota: entre 4 y 6 veces. El piloto sirve para sustituir estos supuestos por cifras propias.',
    fuentes: 'Cada cifra del deck, con su fuente. Abiertas en la página original: Eurostat, CEPYME y CNMC. El resto se ha leído en resúmenes de búsqueda o en prensa: ábrelas antes de una reunión formal. El 10,5 % de Sage es de 2018 y 2019 y mide gestión interna, no atención al cliente.',
    margenes: 'El estándar: el software clásico tiene márgenes brutos del 80 al 90 % según Bessemer; las empresas de IA, alrededor del 60 %, porque cada uso cuesta dinero (45 % de media en 2025 según ICONIQ, con previsión del 59 % en 2027). Nuestro plan es llegar al 60 % y subir hacia el 70 % con tres palancas: mandar la mayoría de turnos al modelo rápido, guardar en caché las instrucciones que se repiten y cobrar cuota fija más uso con tope. Los dos primeros años el margen será más bajo, del 35 al 45 %, porque hoy todo pasa por el modelo caro. El 70 % es un objetivo, no un dato: nuestro modelo de costes da un 68 % en el plan de 149 euros cuando la primera palanca esté hecha.',
    crecimiento: 'Escenario base propio, no una previsión. Supone 40 clientes de pago al acabar 2027 y perder el 2,5 % de clientes al mes, el extremo bueno del rango habitual en pymes. Llega al millón de ingreso recurrente hacia mediados de 2029, unos dos años y cuarto después del primer cliente: algo más rápido que la mediana que publica ChartMogul (2 años y 9 meses) y más lento que HeyDiga, que declara más de 200 clientes en 14 meses. El escenario prudente, con la mediana y una baja del 3,5 %, se queda en 4 millones en el quinto año.',
    cuenta: 'Mismo escenario base, con equipo pequeño y crecimiento orgánico. Pérdidas los tres primeros años, que suman alrededor de medio millón de euros; resultado positivo desde el cuarto. Ese medio millón sale de esta ronda, de los ingresos y de financiación pública sin dilución, que está por solicitar. Retorno para el inversor, solo como ilustración: con 6,8 millones de ingreso recurrente en el quinto año, una valoración de entre 3 y 5 veces ese ingreso serían de 20 a 34 millones; el múltiplo es un supuesto nuestro y depende del mercado en ese momento. En el escenario prudente la empresa no es rentable en cinco años y necesita unos 3 millones: conviene tenerlo presente si preguntan.',
    equipo: 'Presenta tu perfil de producto y diseño y la idea de equipo fundador mixto: un perfil técnico y uno de negocio y marketing, como cofundadores con participación. Si preguntan por la parte técnica, responde con naturalidad: la base está construida y probada, y la dirección técnica es la primera incorporación. No entres en más detalle si no lo piden.',
    fondos: 'Propuesta de partida, pensada para diluir poco: 200.000 euros de inversores particulares, con nota convertible, en dos tramos. Cubre el primer año y parte del segundo. El plan necesita alrededor de medio millón hasta ser rentable: el resto sale de los ingresos y de financiación pública sin dilución (préstamos participativos y ayudas a la innovación), que hay que solicitar y no está garantizada. Dilución orientativa: 200.000 euros con un tope de valoración de 1,5 a 2 millones serían entre el 10 y el 13 %; es una estimación nuestra. Los cofundadores entran con participación y permanencia, no con sueldo de mercado.',
  });
  S.retorno = require('./shared11.cjs')(k, 'inv').retorno;
  rep('coste', 'Al año en facturas, cobros y papeleo de personal, al coste laboral medio de España', '8 personas × 3.383 € al mes × 12 × 10,5 %: facturas, cobros y papeleo de personal');
  S.fuentes = k.compare('fuentes', { tag: 'Las cifras, una a una', title: 'De dónde sale cada número', fs: 24, pad: '9px 24px', firstW: 720,
    foot: 'Abiertas en la fuente original: Eurostat, CEPYME y CNMC · el resto, en resúmenes y prensa',
    head: ['Dato', 'Fuente', 'Cifra'], rows: [
      ['Tiempo de una pyme española en gestión interna', 'Sage con YouGov, 2018–2019', '10,5 %'],
      ['Coste laboral por trabajador y mes, España', 'INE, 4.º trimestre de 2025', '3.383 €'],
      ['Coste laboral por hora, Unión Europea', 'Eurostat, 2025', '34,9 €'],
      ['Horas a la semana reclamando cobros, pymes europeas', 'Observatorio de Pagos de la UE, 2025', '9,8 h'],
      ['Plazo medio de pago, España', 'CEPYME, 2025', '80,5 días'],
      ['Empresas de la UE que usan IA (13,5 % un año antes)', 'Eurostat, 2025', '20 %'],
      ['Internautas en España que usan WhatsApp', 'CNMC, 2025', '94,6 %'],
      ['Chat atendido por una persona, coste medio', 'ContactBabel, Reino Unido', '3,19 £'],
      ['Conversaciones que resuelve la IA sin una persona', 'Ada, Klarna, Salesforce, Intercom', '52–76 %']] });
  S.margenes = k.slide('margenes', { foot: 'Los dos primeros años, 35–45 %: hoy todo pasa por el modelo caro · referencias leídas en resúmenes de los informes', gap: 32, body: k.pill('Márgenes') + '\n' + k.h2('El estándar en IA es el 60 %. Nuestro objetivo, el 70 %') + '\n' + k.row(
    big(C.white, 'Software clásico', '80–90 %', 'Margen bruto habitual: servir a un cliente más casi no cuesta · Bessemer') + '\n'
    + big(C.white, 'Empresas de IA', '≈ 60 %', 'Cada conversación cuesta dinero. Media de 2025: 45 % · Bessemer, ICONIQ') + '\n'
    + big(C.ink, 'Moodly', '60 → 70 %', 'El 60 % es el plan a escala; el 70 %, el objetivo con las tres palancas de abajo'), 16, ';align-items:stretch;flex:1')
    + '\n' + k.row(fact('Modelo rápido', 'para el 70 % de los turnos: cuesta 40 veces menos que el modelo caro') + '\n' + fact('Caché', 'de las instrucciones que se repiten en cada conversación') + '\n' + fact('Cuota fija más uso', 'con tope de gasto por empresa, y la implantación se cobra aparte'), 24) });
  const Y = [['2027', 0.13, '0,13 M€', '40 clientes'], ['2028', 0.7, '0,7 M€', '200 clientes'], ['2029', 1.9, '1,9 M€', '550 clientes'], ['2030', 3.9, '3,9 M€', '1.100 clientes'], ['2031', 6.8, '6,8 M€', '1.900 clientes']];
  const bars = Y.map((y, i) => k.col(`<p style="font-family:${k.FT};font-size:56px;line-height:1.05;letter-spacing:-2px">${y[2]}</p>\n<div style="height:${Math.max(8, Math.round(y[1] / 6.8 * 220))}px;background:${i === 4 ? C.ink : i === 0 ? C.orange : '#a1a1a6'};border-radius:12px 12px 0px 0px"></div>\n`
    + `<div style="display:flex;flex-direction:column;gap:4px;border-top:2px solid ${C.ink};padding:14px 0px 0px">\n` + k.lab(y[0], C.ink, 30) + '\n' + k.p(y[3], 26, C.muted) + '\n</div>', 10, ';flex:1')).join('\n');
  S.crecimiento = k.slide('crecimiento', { foot: 'Escenario base propio, no una previsión · baja del 2,5 % de clientes al mes · rentable desde 2030', gap: 32, body: k.pill('Crecimiento') + '\n' + k.h2('6,8 M€ de ingreso recurrente en el quinto año') + '\n'
    + k.tile(C.white, k.lab('Ingreso recurrente anual al cierre de cada año') + '\n<div style="flex:1"></div>\n' + k.row(bars, 24, ';align-items:flex-end'), { pad: '28px 36px', gap: 8 }) });
  S.cuenta = k.compare('cuenta', { tag: 'Los próximos cinco años', title: 'Rentable desde el cuarto año', fs: 28, pad: '14px 24px', firstW: 400,
    foot: 'Escenario base propio, no una previsión · en millones de euros',
    head: ['', '2027', '2028', '2029', '2030', '2031'], rows: [
      ['Empresas que pagan', '40', '200', '550', '1.100', '1.900'],
      ['Lo que se factura en el año', '0,06', '0,4', '1,3', '2,9', '5,3'],
      ['Lo que se gasta en el año', '0,22', '0,6', '1,45', '2,8', '4,6'],
      ['Resultado del año', '−0,16', '−0,2', '−0,15', '+0,1', '+0,7'],
      ['Personas en el equipo', '3', '5', '10', '18', '30']] });
  S.cuenta = S.cuenta.replace(/\n<p style="position:absolute;left:128px/, '\n' + k.p('Hace falta medio millón de inversión en total. Equipo pequeño y crecimiento orgánico: se recupera con los propios ingresos desde 2030.', 30) + '\n<p style="position:absolute;left:128px');
  S.equipo = k.slide('equipo', { body: k.pill('El equipo') + '\n' + k.h2('Producto y diseño, tecnología y negocio') + '\n' + k.row(
    k.tile(C.white, k.lab('Fundador · producto y diseño', C.soft) + '\n' + k.h3('Diego Sanjuan', 50) + '\n'
      + k.p('Diseñador de producto en Madrid. Desde 2019 trabaja en 3D y diseño visual para marcas como Marine Serre, Zegna, Selfridges, Puma y LaLiga.', 26, C.muted) + '\n'
      + k.p('Dirige el producto, la marca y la relación con los primeros clientes.', 26, C.muted), { pad: '36px 40px', gap: 14 }) + '\n'
    + k.tile(C.ink, k.lab('Equipo fundador · en formación', C.onDark) + '\n' + k.h3('Cofundadores', 50) + '\n' + k.ul(['Tecnología: dirección técnica de la plataforma', 'Negocio y marketing: ventas, finanzas y crecimiento'], 28) + '\n<div style="flex:1"></div>\n' + k.p('Entran con participación en la empresa.', 28, C.onDark), { pad: '36px 40px', gap: 16 }), 16, ';align-items:stretch;flex:1') });
  const use = (t, v, pct) => k.box(`display:flex;flex-direction:row;gap:24px;align-items:center;background:${C.white};padding:22px 32px;border:1px solid ${C.line};border-radius:12px`, k.p(t, 28, '', ';flex:1') + '\n' + `<p style="font-family:${k.FD};font-size:28px;line-height:1.2;color:${C.ink}">${v}</p>\n<p style="font-family:${k.FD};font-size:28px;line-height:1.2;color:${C.muted};width:80px;text-align:right">${pct}</p>`);
  S.fondos = k.slide('fondos', { foot: 'Propuesta de partida · inversores particulares, nota convertible · se completa con financiación pública sin dilución', body: k.row(
    k.col(k.pill('La ronda') + '\n' + k.tile(C.orange, `<p style="font-family:${k.FT};font-size:136px;line-height:1;letter-spacing:-6px">200.000 €</p>\n<div style="flex:1"></div>\n` + k.p('12 meses: piloto completo, equipo fundador y los primeros 40 clientes de pago', 34) + '\n' + k.p('Dos tramos: 50.000 € ahora, hasta el primer cliente, y 150.000 € al cerrar el piloto', 26, C.ink), { pad: '44px', gap: 16 }), 40, ';width:760px') + '\n'
    + k.col(k.lab('Uso de los fondos', C.ink, 34) + '\n' + use('Producto y tecnología', '90.000 €', '45 %') + '\n' + use('Ventas e implantación', '40.000 €', '20 %') + '\n' + use('Infraestructura e IA', '30.000 €', '15 %') + '\n' + use('Seguridad y legal', '20.000 €', '10 %') + '\n' + use('Operación', '20.000 €', '10 %'), 14, ';flex:1;justify-content:flex-end'), 48, ';align-items:stretch;flex:1') });
  rep('riesgos', 'Sin equipo técnico todavía', 'Equipo en formación'); rep('riesgos', 'Un fundador de producto y diseño; la ingeniería se ha hecho con IA.', 'El equipo fundador se está completando.'); rep('riesgos', 'El primer uso de la ronda es incorporar dirección técnica.', 'Cofundadores de tecnología y de negocio, con participación.');
  const o = S.__order; o.splice(o.indexOf('ahorro') + 1, 0, 'retorno'); o.splice(o.indexOf('anexo') + 1, 0, 'fuentes');
};
