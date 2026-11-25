// Ninth pass: plain-language five-year slide, and an honest strengths-versus-competitors slide.
module.exports = function (k, S, N) {
  const { C } = k;
  N.cuenta = 'Léela de izquierda a derecha, fila a fila. Clientes: cuántas empresas pagan al acabar cada año. Lo que se factura: las cuotas de ese año. Lo que se gasta: el coste de dar el servicio (IA, WhatsApp, servidores) más el equipo. Resultado: la diferencia. Los tres primeros años se gasta más de lo que entra; sumados, falta medio millón de euros, que es lo que hay que financiar entre esta ronda y la siguiente. A partir de 2030 el negocio se paga solo. Es un escenario objetivo nuestro, no una previsión: supone los mismos clientes aunque el precio sea alto, y unos gastos de equipo estimados.';
  S.cuenta = k.compare('cuenta', { tag: 'Los próximos cinco años', title: 'Tres años invirtiendo; desde 2030, gana dinero', fs: 28, pad: '20px 24px', firstW: 400,
    foot: 'Escenario objetivo propio, no una previsión · en millones de euros',
    head: ['', '2027', '2028', '2029', '2030', '2031'], rows: [
      ['Empresas que pagan', '45', '300', '900', '2.000', '3.600'],
      ['Lo que se factura en el año', '0,07', '0,5', '2,0', '5,1', '10,7'],
      ['Lo que se gasta en el año', '0,3', '0,8', '2,0', '4,1', '7,5'],
      ['Resultado del año', '−0,2', '−0,3', '0', '+1,0', '+3,2'],
      ['Personas en el equipo', '3', '7', '15', '30', '50']] });
  S.cuenta = S.cuenta.replace('<img src="/_blob/' + '', '<img src="/_blob/');
  const line = k.p('Hasta 2029 se gasta más de lo que entra: en total, medio millón de euros. Eso es lo que hay que financiar.', 30);
  S.cuenta = S.cuenta.replace(/\n<p style="position:absolute;left:128px/, '\n' + line + '\n<p style="position:absolute;left:128px');
  N.ventajas = 'Empieza por la columna de la izquierda: el inversor ya lo sabe y te gana la confianza que lo digas tú. HeyDiga declara más de 200 clientes y unos 6,5 millones levantados; las herramientas de reservas ya venden su recepcionista de IA a su propia base. La columna de la derecha es lo que no hemos encontrado junto en ninguno de ellos; es ausencia de evidencia en lo que publican, no una prueba, y parte de ello está diseñado pero no construido. La apuesta: quien entra por un solo canal tendrá que reconstruir memoria, control y jerarquía; nosotros partimos de ahí y añadimos canales.';
  S.ventajas = k.slide('ventajas', { foot: 'Lo de la izquierda es lo que publican ellos · lo de la derecha, nuestro diseño, parte por construir', body: k.pill('Ventajas y carencias') + '\n' + k.h2('Qué nos falta y qué hacemos distinto') + '\n' + k.row(
    k.tile(C.white, k.h3('Dónde van por delante', 44) + '\n' + k.ul(['Clientes y casos: nosotros aún no tenemos', 'Capital: rondas de 1 a 6 millones', 'Voz: es la puerta de entrada en la pyme', 'Integraciones ya hechas con los sistemas del sector', 'Distribución: las herramientas de reservas venden a su base'], 28, C.muted), { pad: '40px', gap: 24 }) + '\n'
    + k.tile(C.ink, k.h3('Dónde somos distintos', 44) + '\n' + k.ul(['Un equipo de agentes, no un canal: atiende, vende, cobra y organiza', 'Memoria que aprende de cada corrección del equipo', 'Autonomía por niveles, con aprobación y traza', 'Pensado para cadenas: organización, región y local', 'Agentes propios por configuración'], 28), { pad: '40px', gap: 24 }), 16, ';align-items:stretch;flex:1') });
  S.__order.splice(S.__order.indexOf('competencia') + 1, 0, 'ventajas');
};
