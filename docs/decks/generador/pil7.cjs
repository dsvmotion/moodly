// Pilot deck: worked example of what the customer gets back.
module.exports = function (k, S, N) {
  N.retorno = 'Es un ejemplo para abrir la conversación, no una promesa. Las 300 conversaciones al mes y el coste por chat son supuestos generales; pregunta por sus cifras y rehaz la cuenta delante de ellos. Lo que sí puedes comprometer: medirlo juntos durante el primer mes del piloto.';
  S.retorno = require('./shared11.cjs')(k, 'pil').retorno;
  S.__after.push(['ahorro', ['retorno']]);
};
