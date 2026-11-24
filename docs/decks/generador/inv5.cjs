// Fifth pass: specific unit economics — with/without for the customer, cost to serve, margin by plan.
module.exports = function (k, S, N) {
  const { C } = k;
  Object.assign(N, {
    ahorro: 'Todo sale de la diapositiva anterior más tres supuestos que debes decir en voz alta. Uno: el local dedica entre 15 y 32,6 horas a la semana a estas tareas, es decir, entre 3 y 6,5 horas al día, a 14,20 euros la hora. Dos: los agentes asumen la mitad de ese tiempo; es un supuesto, no un dato. Tres: recordatorios y respuesta inmediata recuperan parte de las citas y llamadas perdidas. Suma: entre 4.900 y 10.700 euros de tiempo más entre 6.300 y 15.600 de ingresos, frente a una cuota de 1.176 a 3.576 euros al año. La conversación atendida por una persona supone 4 minutos, también supuesto. El piloto existe para sustituir estos supuestos por medidas.',
    economia: 'Cliente tipo de la auditoría: 300 conversaciones y 150 citas al mes. Primera columna, lo que hay hoy: todo pasa por el modelo caro, 0,25 euros por conversación, 85 euros de coste y un 13 % de margen. Segunda: mandar el 70 % de los turnos al modelo rápido, 40 veces más barato, deja la conversación en 0,08 euros. Tercera: el objetivo del documento de precios, 85 % rápido y caché de instrucciones, unos 0,02 euros. Solo la primera está medida. La infraestructura por cliente está sin medir: son 500 euros al mes repartidos entre 100 clientes. La memoria y los embeddings cuestan céntimos.',
    margenes: 'Los tres planes con el coste del escenario intermedio, 0,08 euros por conversación. Equipo supone 1.000 conversaciones y 3 sedes; Empresa, 20 sedes con 300 conversaciones cada una. Con 64 euros de margen por cliente Esencial, entre 4 y 6 clientes cubren los 250 a 400 euros al mes de infraestructura y herramientas actuales. El objetivo de 300 empresas daría unos 0,6 millones de ingresos anuales y unos 0,4 de margen bruto. Punto débil que te pueden señalar: la conversación extra a 0,10 euros apenas cubre su coste de 0,08 hasta que el reparto de modelos mejore.',
  });
  const fact = (v, t) => k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">${v}</p>\n` + k.p(t, 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px');
  const big = (bg, tag, val, def, sz = 84) => k.tile(bg, k.lab(tag, k.onSoft(bg), 30) + '\n<div style="flex:1"></div>\n' + `<p style="font-family:${k.FT};font-size:${sz}px;line-height:1.05;letter-spacing:-3px">${val}</p>\n` + k.p(def, 26, k.onSoft(bg)), { pad: '32px 36px', gap: 10 });
  S.ahorro = k.slide('ahorro', { foot: 'Estimación propia para un local de 8 personas · supuestos en las notas', gap: 32, body: k.pill('Con y sin Moodly') + '\n' + k.h2('Un local recupera entre 11.000 y 26.000 € al año') + '\n' + k.row(
    big(C.white, 'Sin Moodly, cada día', '43–93 €', 'Entre 3 y 6,5 horas del equipo en atender, reservar, hacer seguimiento y cobrar') + '\n'
    + big(C.white, 'Con Moodly, cada día', '3–10 €', 'La cuota: de 98 a 298 € al mes, según el plan') + '\n'
    + big(C.ink, 'Lo que recupera al año', '11.000–26.000 €', 'Entre 7 y 9 veces la cuota, si los agentes asumen la mitad de ese trabajo', 64), 16, ';align-items:stretch;flex:1')
    + '\n' + k.row(fact('0,95 €', 'cuesta una conversación atendida por una persona, a 4 minutos') + '\n' + fact('0,08–0,24 €', 'cuesta la misma conversación en IA') + '\n' + fact('25.300 €', 'cuesta al año un puesto de recepción en España'), 24) });
  S.economia = k.compare('economia', { tag: 'Coste de servir a un cliente', title: 'De 85 € a 16 € al mes por cliente', fs: 26, pad: '15px 24px', firstW: 470,
    foot: 'Medido: 0,24 € por conversación; el resto, estimado · 300 conversaciones y 150 citas al mes',
    head: ['Cliente tipo, al mes', 'Hoy: modelo caro', '70 % modelo rápido', 'Objetivo: 85 % y caché'], rows: [
      ['IA por conversación', '0,25 €', '0,08 €', '0,02 €'],
      ['IA al mes', '75 €', '24 €', '6 €'],
      ['WhatsApp: 300 recordatorios', '5 €', '5 €', '5 €'],
      ['Base de datos, cómputo y memoria', '5 €', '5 €', '5 €'],
      ['Coste total', '85 €', '34 €', '16 €'],
      ['Margen bruto a 98 € al mes', '13 %', '65 %', '84 %']] });
  const plan = (bg, name, price, lines, margin) => k.tile(bg, k.lab(name, k.onSoft(bg), 30) + '\n' + `<p style="font-family:${k.FT};font-size:80px;line-height:1.05;letter-spacing:-4px">${price}</p>\n` + k.ul(lines, 26) + '\n<div style="flex:1"></div>\n'
    + k.row(`<p style="font-family:${k.FD};font-size:52px;line-height:1.1;letter-spacing:-2px">${margin}</p>\n` + k.p('de margen bruto', 26, k.onSoft(bg), ';padding:0px 0px 6px'), 14, ';align-items:flex-end'), { pad: '32px 36px', gap: 14 });
  S.margenes = k.slide('margenes', { foot: 'Con 0,08 € por conversación · volúmenes supuestos · propuesta a validar en el piloto', gap: 32, body: k.pill('Márgenes por plan') + '\n' + k.h2('Entre el 65 % y el 79 % de margen bruto') + '\n' + k.row(
    plan(C.white, 'Esencial · al mes', '98 €', ['300 conversaciones', 'Coste de servirlo: 34 €'], '65 %') + '\n'
    + plan(C.white, 'Equipo · al mes', '298 €', ['1.000 conversaciones, 3 sedes', 'Coste de servirlo: 105 €'], '65 %') + '\n'
    + plan(C.ink, 'Empresa, 20 sedes · al mes', '3.000 €', ['6.000 conversaciones', 'Coste de servirlo: 630 €'], '79 %'), 16, ';align-items:stretch;flex:1')
    + '\n' + k.row(fact('4–6 clientes', 'cubren la infraestructura y las herramientas de hoy') + '\n' + fact('0,6 M€', 'de ingresos anuales con 300 empresas') + '\n' + fact('≈ 0,4 M€', 'de margen bruto con esas 300 empresas'), 24) });
  S.negocio = S.negocio.replace('Precios propuestos, a validar en el piloto · prueba de 7 días con 5 € de crédito', 'Precios propuestos · extra: 0,10 € por conversación y 0,20 € por minuto de voz · prueba de 7 días con 5 € de crédito');
  S.__order.splice(S.__order.indexOf('coste') + 1, 0, 'ahorro');
  S.__order.splice(S.__order.indexOf('economia') + 1, 0, 'margenes');
};
