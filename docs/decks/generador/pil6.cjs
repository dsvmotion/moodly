// Pilot deck: sourced customer-value slides and the concrete founder prices.
module.exports = function (k, S, N) {
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  N.coste = 'Las cifras tienen fuente, pero di lo que miden: el 10,5 % es tiempo de gestión interna (facturas, cobros, personal) según Sage con YouGov, no tiempo de atender a clientes. Los 34.000 euros salen de aplicar ese porcentaje al coste laboral medio de España con ocho personas; es una media y en un negocio pequeño puede ser menos. Úsalo para abrir la conversación y pide enseguida sus cifras: cuántas horas a la semana se van en esto y cuántas citas o mensajes se quedan sin atender.';
  N.ahorro = 'El 52 a 76 % son cifras que publican otras empresas de agentes sobre sus propios clientes; nosotros todavía no tenemos la nuestra, y medirla en su negocio es justo el objetivo del piloto. No prometas un ahorro en euros: propón medirlo juntos el primer mes. El coste del chat atendido por una persona es de centros de contacto, no de un negocio como el suyo.';
  const sh = require('./shared10.cjs')(k, 'pil'); S.coste = sh.coste; S.ahorro = sh.ahorro;
  rep('piloto', '<li>Precio de fundador: la mitad durante el primer año</li>', '<li>Precio de fundador: la mitad el primer año (Esencial 75 €, Equipo 199 €)</li>');
};
