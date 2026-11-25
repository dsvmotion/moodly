// Pilot deck: premium price level (2026-11-11).
module.exports = function (k, S) {
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  rep('ahorro', '3–10 €', '5–13 €'); rep('ahorro', 'La cuota: de 98 a 298 € al mes, según el plan', 'La cuota: de 149 a 399 € al mes, según el plan');
  rep('ahorro', 'Si los agentes asumen la mitad de ese trabajo: entre 7 y 9 veces la cuota', 'Si los agentes asumen la mitad de ese trabajo: unas 6 veces la cuota');
  rep('ahorro', 'La cuota de 98 a 298 euros es el precio propuesto', 'La cuota de 149 a 399 euros es el precio propuesto');
};
