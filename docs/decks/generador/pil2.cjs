// Pilot deck: customer-facing numbers (what the problem costs, with and without Moodly).
module.exports = function (k, S, N) {
  const { C } = k;
  Object.assign(N, {
    coste: 'Es una estimación con datos públicos, no un dato de su empresa. Úsala para abrir la conversación y pide enseguida sus cifras reales: cuántas horas a la semana se van en atender, reservar, hacer seguimiento y cobrar, y cuántas citas o llamadas se pierden. Caso prudente: 15 horas a la semana; caso central: el 10,2 % del tiempo de trabajo que Sage atribuye a tareas administrativas en España. Hora a 14,20 euros, salario medio de recepción más cotizaciones.',
    ahorro: 'Tres supuestos que conviene decir: el equipo dedica entre 3 y 6,5 horas al día a estas tareas; los agentes asumen la mitad; y los recordatorios y la respuesta inmediata recuperan parte de las citas y llamadas perdidas. El piloto sirve para medirlo en su empresa: propón revisar juntos estas cifras al mes de empezar. La cuota de 98 a 298 euros es el precio propuesto; el de fundador será menor.',
  });
  const fact = (v, t) => k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">${v}</p>\n` + k.p(t, 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px');
  const big = (bg, tag, val, def, sz = 84) => k.tile(bg, k.lab(tag, k.onSoft(bg), 30) + '\n<div style="flex:1"></div>\n' + `<p style="font-family:${k.FT};font-size:${sz}px;line-height:1.05;letter-spacing:-3px">${val}</p>\n` + k.p(def, 26, k.onSoft(bg)), { pad: '32px 36px', gap: 10 });
  S.coste = k.slide('coste', { foot: 'Estimación con fuentes públicas, no medida en tu empresa · en el piloto la medimos contigo', gap: 32, body: k.pill('Lo que te cuesta hoy') + '\n' + k.h2('Entre 16.000 y 37.000 € al año por local') + '\n' + k.row(
    big(C.white, 'Un local con 8 personas', '16.000–37.000 €', 'Al año: tiempo de tu equipo en atender, reservar y cobrar, más citas y llamadas perdidas') + '\n'
    + big(C.ink, 'Una cadena de 20 locales', '320.000–745.000 €', 'Al año: el equivalente a entre 7 y 16 personas a jornada completa'), 16, ';align-items:stretch;flex:1')
    + '\n' + k.row(fact('10,2 %', 'del tiempo de trabajo en España se va en tareas administrativas · Sage') + '\n' + fact('80,5 días', 'de plazo medio de pago en España · CEPYME, 2025') + '\n' + fact('94,6 %', 'de los internautas en España usa WhatsApp · CNMC, 2025'), 24) });
  S.ahorro = k.slide('ahorro', { foot: 'Estimación para un local de 8 personas · cuota al precio propuesto; el de fundador será menor', gap: 32, body: k.pill('Con y sin Moodly') + '\n' + k.h2('Tu local recupera entre 11.000 y 26.000 € al año') + '\n' + k.row(
    big(C.white, 'Hoy, cada día', '43–93 €', 'Entre 3 y 6,5 horas de tu equipo en atender, reservar, hacer seguimiento y cobrar') + '\n'
    + big(C.white, 'Con Moodly, cada día', '3–10 €', 'La cuota: de 98 a 298 € al mes, según el plan') + '\n'
    + big(C.ink, 'Lo que recuperas al año', '11.000–26.000 €', 'Si los agentes asumen la mitad de ese trabajo: entre 7 y 9 veces la cuota', 64), 16, ';align-items:stretch;flex:1')
    + '\n' + k.row(fact('A cualquier hora', 'responde también cuando el local está cerrado o el equipo ocupado') + '\n' + fact('0,95 €', 'cuesta hoy cada conversación que atiende una persona, a 4 minutos') + '\n' + fact('25.300 €', 'cuesta al año un puesto de recepción en España'), 24) });
  S.__after = [['problema', ['coste', 'ahorro']]];
};
