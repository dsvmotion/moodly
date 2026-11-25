// Pilot deck: comparison with the alternatives a business owner has, and a concrete founder offer.
module.exports = function (k, S, N) {
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  N.comparativa = 'Son las tres alternativas que tiene hoy quien te escucha. No hables mal de ninguna: una recepcionista de voz resuelve bien el teléfono y contratar a alguien sigue siendo lo mejor para lo que requiere criterio. Lo que cambia con Moodly es que un mismo equipo de agentes cubre varios trabajos, aprende de sus correcciones y no hace nada sensible sin su visto bueno. Las tres primeras columnas describen categorías, no a una empresa concreta.';
  S.comparativa = k.compare('comparativa', { tag: 'Frente a otras opciones', title: 'Las opciones que tienes hoy', fs: 26, pad: '18px 22px', firstW: 300,
    foot: 'Comparación por tipo de solución, no con una empresa concreta',
    head: ['', 'Recepcionista de voz', 'Chatbot de atención', 'Contratar a alguien', 'Moodly'], rows: [
      ['Qué cubre', 'El teléfono', 'Chat y email', 'Lo que le dé tiempo', 'WhatsApp, email y chat'],
      ['Qué hace', 'Atiende y reserva', 'Responde y deriva', 'De todo, en su horario', 'Atiende, vende, cobra y organiza'],
      ['Aprende de tu equipo', 'Depende del producto', 'Se reajusta a mano', 'Sí, y se va con la persona', 'Cada corrección se queda'],
      ['Quién decide', 'Reglas fijas', 'Guion fijo', 'Tú', 'Tú: lo sensible pide tu aprobación'],
      ['Cuánto cuesta', 'Por minutos de llamada', 'Por resolución', 'Un sueldo', 'Desde 149 € al mes']] });
  rep('piloto', '<li>Precio de fundador: [€__]</li>', '<li>Precio de fundador: la mitad durante el primer año</li>\n<li>Sin permanencia: te vas cuando quieras</li>');
  S.piloto = S.piloto.replace(/<aside>[\s\S]*?<\/aside>/, '<aside>La oferta, tal cual: piloto de pago, no gratis. Precio de fundador a mitad de tarifa durante doce meses (Esencial 75 euros al mes, Equipo 199, Empresa 100 por sede), sin permanencia y con la puesta en marcha incluida. A cambio pides tres cosas: un rato cada semana, acceso a sus sistemas y permiso para contar el caso con cifras. Antes de empezar, acordad por escrito qué se va a medir: mensajes atendidos, citas reservadas, tiempo que ahorra el equipo. Pide una carta de intención aunque el producto no esté listo: fija el precio y la fecha, y es lo que enseñas a un inversor. Los importes son una propuesta: ajústalos antes de enseñar la diapositiva.</aside>');
  for (const a of S.__after) if (a[0] === 'problema') { /* keep */ }
  S.__after.push(['diferencia', ['comparativa']]);
};
