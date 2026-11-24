// Pilot deck: fixes from outside reviews (business language, effort asked, honest call to action, example earlier).
module.exports = function (k, S, N) {
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  require('./shared12.cjs')(k, S, 'pil', 'ejemplo');
  N.coste = 'Las 9,8 horas a la semana son una media de pymes europeas (Observatorio de Pagos de la UE) y el coste por hora es la media de la UE; en un negocio español será menos. Úsalo para abrir la conversación y pregunta enseguida por sus cifras: cuántas horas se van en cobrar, reservar y contestar.';
  rep('estado', 'casos de seguridad superados', 'antes de cobros y mensajes sensibles'); rep('estado', '>24 de 24<', '>Tu OK<');
  rep('estado', '≈ 2.380', '24 de 24'); rep('estado', 'tests automáticos en verde', 'intentos de engaño, parados');
  rep('estado', '>1.145<', '>Tus datos<'); rep('estado', 'pruebas de aislamiento de datos', 'aislados de otras empresas');
  rep('confianza', 'Datos de cada cliente aislados, con 1.145 pruebas', 'Datos de cada cliente aislados y almacenados en la UE'); rep('confianza', 'Todo el tratamiento en la UE', 'Tratamiento de IA en la UE');
  rep('piloto', 'Un rato cada semana para contarnos qué falla', 'Unos 20 minutos a la semana para contarnos qué falla');
  rep('piloto', 'Acceso a tus sistemas y a alguien que los conozca', 'Acceso a tus sistemas: la configuración la hacemos nosotros');
  rep('cierre', 'Pon tu primer agente a trabajar.', 'Reserva tu plaza de empresa fundadora.');
  rep('cierre', 'Con eso sabemos si encajas en el piloto.', 'Con eso sabemos si encajas en el piloto. Arranque previsto: marzo de 2027.');
  S.__move = [['ejemplo', 'problema']];
};
