// Worked example of what a customer gets back, shared by both decks.
module.exports = function (k, voice) {
  const { C } = k; const tu = voice === 'pil';
  const fact = (v, t) => k.col(`<p style="font-family:${k.FD};font-size:40px;line-height:1.1;letter-spacing:-1px">${v}</p>\n` + k.p(t, 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px');
  const big = (bg, tag, val, def, sz = 80) => k.tile(bg, k.lab(tag, k.onSoft(bg), 30) + '\n<div style="flex:1"></div>\n' + `<p style="font-family:${k.FT};font-size:${sz}px;line-height:1.05;letter-spacing:-3px">${val}</p>\n` + k.p(def, 26, k.onSoft(bg)), { pad: '32px 36px', gap: 10 });
  const retorno = k.slide('retorno', { foot: 'Ejemplo: las 300 conversaciones son un supuesto · coste del chat de centros de contacto británicos, a 1,16 € por libra', gap: 32,
    body: k.pill(tu ? 'Lo que recuperas' : 'Lo que recupera el cliente') + '\n' + k.h2(tu ? 'Un ejemplo: recuperas entre 4 y 6 veces la cuota' : 'Un ejemplo: el cliente recupera entre 4 y 6 veces la cuota') + '\n' + k.row(
      big(C.white, 'Atender 300 conversaciones al mes', '13.300 €', 'Al año, a 3,70 € por chat atendido por una persona') + '\n'
      + big(C.white, 'Lo que resuelve el agente', '6.900–10.100 €', 'Al año, si resuelve entre el 52 y el 76 % de esas conversaciones', 68) + '\n'
      + big(C.ink, 'Lo que cuesta Moodly', '1.788 €', 'Al año: plan Esencial, 149 € al mes con 300 conversaciones'), 16, ';align-items:stretch;flex:1')
      + '\n' + k.row(fact('300 × 12 × 3,70 €', 'el cálculo del coste: conversaciones al mes, meses y coste por chat') + '\n' + fact('8 min 25 s', 'dura de media un chat atendido por una persona · LiveChat') + '\n' + fact('Primer mes del piloto', tu ? 'medimos tus cifras reales y rehacemos esta cuenta contigo' : 'se miden las cifras reales de cada empresa y se rehace esta cuenta'), 24) });
  return { retorno };
};
