// Twelfth pass: fixes from three outside reviews (facts, consistency between decks, competition in the main deck).
module.exports = function (k, S, N) {
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  require('./shared12.cjs')(k, S, 'inv', 'demo');
  N.coste = 'Las 9,8 horas a la semana son la media que da el Observatorio de Pagos de la UE para las pymes europeas; se ha leído en resúmenes, no en el informe. El coste por hora, 34,9 euros, es la media de la UE en 2025 según Eurostat, comprobada en su página; en España el coste por hora es más bajo, así que para un negocio español la cifra real será menor. El dato de Sage es antiguo (2018 y 2019) y mide gestión interna: queda solo como referencia.';
  rep('fuentes', '3,19 £', '3,70 €'); rep('fuentes', 'ContactBabel, Reino Unido', 'ContactBabel, Reino Unido (3,19 £)');
  rep('fuentes', 'Empresas de la UE que usan IA (13,5 % un año antes)', 'Empresas de la UE de 10+ empleados que usan IA (13,5 % antes)');
  rep('fuentes', 'Ada, Klarna, Salesforce, Intercom', 'Ada, Salesforce, Intercom');
  rep('hoja', 'Solo código: 14 de enero', 'Pronto: enero'); rep('hoja', 'Realista: 8 de marzo', 'Previsto: marzo'); rep('hoja', 'Prudente: 10 de mayo', 'Tarde: mayo');
  rep('hoja', '24 nov · ahora', 'Nov · ahora'); rep('hoja', '>18 dic<', '>Mediados de dic<'); rep('hoja', '>27 ene<', '>Finales de enero<'); rep('hoja', '>8 mar<', '>Marzo de 2027<'); rep('hoja', '>5 abr<', '>Abril de 2027<');
  rep('hoja', '16 casos de uso, 30 integraciones', '16 casos de uso, 5 canales'); rep('hoja', '22 casos de uso, 50 integraciones', '22 casos de uso, asistente y coach');
  rep('tam', 'SOM · objetivo a 24 meses', 'SOM · objetivo a finales de 2028'); rep('tam', '0,9 M€', '0,7 M€'); rep('tam', '300 empresas con la mezcla de planes propuesta', '200 empresas de pago, las mismas del plan');
  rep('tam', 'supuestos en las notas', 'adopción de IA medida en empresas de 10+ empleados');
  rep('competencia', '200+ clientes, 6,5 M€ levantados', '250+ clientes, 6,5 M€ levantados'); rep('competencia', '100.000 pymes', 'Decenas de miles de pymes');
  rep('competencia', 'Atiende, vende, cobra y organiza', 'Varios agentes coordinados');
  rep('competencia', 'Precios de HeyDiga y Fin vistos en su web el 11 de noviembre de 2026', 'HeyDiga y Fin, vistos en su web el 11 de noviembre de 2026');
  rep('ventajas', 'Un equipo de agentes, no un canal: atiende, vende, cobra y organiza', 'Agentes que se coordinan: Recepción reserva y Administración cobra la señal');
  rep('confianza', 'Datos alojados en la UE', 'Datos almacenados en la UE'); rep('confianza', 'Revisión humana de cambios sensibles', 'Tratamiento de IA en la UE');
  rep('cuenta', 'Escenario base propio, no una previsión · en millones de euros', 'Escenario propio, en M€ · se factura menos que el ingreso recurrente de cierre: los clientes entran durante el año');
  const o = S.__order; o.splice(o.indexOf('competencia'), 1); o.splice(o.indexOf('ventajas'), 0, 'competencia');
};
