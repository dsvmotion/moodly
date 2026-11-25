// Feedback pass shared by both decks: cost slide on verified EU figures, no pounds, no Klarna, AI disclosure.
module.exports = function (k, S, voice, demoId) {
  const { C } = k; const tu = voice === 'pil';
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  const fact = (v, t) => k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">${v}</p>\n` + k.p(t, 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px');
  const big = (bg, tag, val, def) => k.tile(bg, k.lab(tag, k.onSoft(bg), 30) + '\n<div style="flex:1"></div>\n' + `<p style="font-family:${k.FT};font-size:84px;line-height:1.05;letter-spacing:-3px">${val}</p>\n` + k.p(def, 26, k.onSoft(bg)), { pad: '32px 36px', gap: 10 });
  S.coste = k.slide('coste', { foot: 'Horas: Observatorio de Pagos de la UE · coste por hora: Eurostat, media de la UE en 2025 · cálculo propio', gap: 32,
    body: k.pill(tu ? 'Lo que te cuesta hoy' : 'Lo que cuesta hoy') + '\n' + k.h2('Casi diez horas a la semana solo en reclamar cobros') + '\n' + k.row(
      big(C.white, 'Una pyme europea, de media', '9,8 horas', 'A la semana persiguiendo facturas que no se pagan a tiempo') + '\n'
      + big(C.ink, 'Lo que cuesta ese tiempo', '≈ 17.800 €', 'Al año: 9,8 horas × 52 semanas × 34,9 € por hora de coste laboral'), 16, ';align-items:stretch;flex:1')
      + '\n' + k.row(fact('80,5 días', 'de plazo medio de pago en España · CEPYME, 2025') + '\n' + fact('10,5 %', 'del tiempo de una pyme española se iba en gestión interna · Sage con YouGov, 2018–2019') + '\n' + fact('94,6 %', 'de los internautas en España usa WhatsApp · CNMC, 2025'), 24) });
  rep('ahorro', 'Ada 52 %, Klarna dos tercios, Salesforce 70 %, Intercom 76 %', 'Ada 52 %, Salesforce 70 %, Intercom 76 %');
  rep('ahorro', '3,19 £', '3,70 €');
  rep('ahorro', 'Coste medio en un centro de contacto; una llamada, entre 5,58 y 6,26 £ · ContactBabel', 'Coste medio en un centro de contacto británico, pasado a euros · ContactBabel');
  rep('ahorro', '>30 %<', '>20 %<');
  rep('ahorro', 'de las citas se reservan fuera de horario · Doctoralia España', 'de las empresas de la UE con 10+ empleados ya usa IA · Eurostat, 2025');
  rep(demoId, 'Sí: jueves a las 20:30 para seis.', 'Soy el asistente de IA. Sí: jueves a las 20:30 para seis.');
};
