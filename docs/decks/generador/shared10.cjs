// Sourced versions of the two customer-value slides, shared by both decks (voice: 'inv' third person, 'pil' tú).
module.exports = function (k, voice) {
  const { C } = k; const tu = voice === 'pil';
  const fact = (v, t) => k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">${v}</p>\n` + k.p(t, 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px');
  const big = (bg, tag, val, def, sz = 84) => k.tile(bg, k.lab(tag, k.onSoft(bg), 30) + '\n<div style="flex:1"></div>\n' + `<p style="font-family:${k.FT};font-size:${sz}px;line-height:1.05;letter-spacing:-3px">${val}</p>\n` + k.p(def, 26, k.onSoft(bg)), { pad: '32px 36px', gap: 10 });
  const coste = k.slide('coste', { foot: 'Sage con YouGov (2018–2019) e INE (cuarto trimestre de 2025) · es gestión interna, no atención al cliente', gap: 32,
    body: k.pill(tu ? 'Lo que te cuesta hoy' : 'Lo que cuesta hoy') + '\n' + k.h2('El 10,5 % del tiempo de una pyme se va en gestión') + '\n' + k.row(
      big(C.white, 'Un negocio de 8 personas', '≈ 34.000 €', 'Al año en facturas, cobros y papeleo de personal, al coste laboral medio de España') + '\n'
      + big(C.ink, 'Una cadena de 20 locales', '≈ 680.000 €', 'Al año: el mismo cálculo por veinte'), 16, ';align-items:stretch;flex:1')
      + '\n' + k.row(fact('9,8 horas', 'a la semana reclamando cobros, de media en las pymes europeas · Observatorio Europeo de Pagos, 2025') + '\n' + fact('80,5 días', 'de plazo medio de pago en España · CEPYME, 2025') + '\n' + fact('94,6 %', 'de los internautas en España usa WhatsApp · CNMC, 2025'), 24) });
  const ahorro = k.slide('ahorro', { foot: 'Cifras de los propios proveedores, cada uno con su definición de «resuelto» · coste del chat: centros de contacto británicos', gap: 32,
    body: k.pill(tu ? 'Qué puede hacer un agente por ti' : 'Qué puede hacer un agente') + '\n' + k.h2('La IA ya resuelve entre la mitad y tres cuartos de las conversaciones') + '\n' + k.row(
      big(C.white, 'Conversaciones resueltas sin una persona', '52–76 %', 'Ada 52 %, Klarna dos tercios, Salesforce 70 %, Intercom 76 %') + '\n'
      + big(C.white, 'Un chat atendido por una persona', '3,19 £', 'Coste medio en un centro de contacto; una llamada, entre 5,58 y 6,26 £ · ContactBabel') + '\n'
      + (tu ? big(C.ink, 'Con Moodly', 'Desde 149 €', 'Al mes, con los cuatro agentes; la mitad el primer año para las empresas piloto', 72)
            : big(C.ink, 'Lo que nos cuesta esa conversación', '0,18–0,34 €', 'IA entre 0,08 y 0,24 €, más unos 0,10 € de WhatsApp', 72)), 16, ';align-items:stretch;flex:1')
      + '\n' + k.row(fact('14 %', 'resolvía el autoservicio antiguo, sin agentes · Gartner, 2024') + '\n' + fact('30 %', 'de las citas se reservan fuera de horario · Doctoralia España') + '\n' + fact('+14 %', 'de casos por hora cuando la IA ayuda a una persona · Brynjolfsson y otros, 2023'), 24) });
  return { coste, ahorro };
};
