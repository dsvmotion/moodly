// Sixth pass: premium positioning and the three-stage plan to bring cost per conversation down.
module.exports = function (k, S, N) {
  const { C } = k;
  N.plancoste = 'Esta es la respuesta a «¿cómo pasáis del 13 % al 65 % de margen?». Hoy todos los turnos usan el modelo más caro porque así se construyó primero. Etapa 1: un enrutador manda los turnos sencillos (saludo, pregunta frecuente, consulta) al modelo rápido, 40 veces más barato, y deja en el caro los que reservan, cobran o son ambiguos; el enrutador ya está en curso en el hito de plataforma. Etapa 2: las instrucciones del agente y las herramientas, unos 3.000 de los 3.300 tokens de entrada, se leen de caché al 10 % de su precio, y se recorta el historial. La regla que no se toca: el modelo de cada turno lo decide una evaluación de calidad, no el precio; si un tipo de turno no pasa la evaluación con el modelo rápido, se queda en el caro. Solo la etapa 0 está medida.';
  N.negocio = 'Posicionamiento: no somos los más baratos. El precio cubre cuatro agentes, la memoria, las aprobaciones y la traza, y queda a la altura de quien vende un solo canal. Son precios propuestos, a validar en el piloto; la alternativa más alta que está sobre la mesa es 149, 399 y 200 euros por sede. El ejemplo de la cadena es aritmética con estos precios, no un contrato.';
  const stage = (bg, tag, val, title, lines, when) => k.tile(bg, k.lab(tag, k.onSoft(bg), 28) + '\n' + `<p style="font-family:${k.FT};font-size:80px;line-height:1.05;letter-spacing:-4px">${val}</p>\n` + k.h3(title, 34) + '\n' + k.ul(lines, 26, k.onSoft(bg)) + '\n<div style="flex:1"></div>\n' + k.lab(when, k.onSoft(bg), 26), { pad: '28px 32px', gap: 10 });
  S.plancoste = k.slide('plancoste', { foot: 'Coste por conversación · medida solo la etapa 0; las otras dos son estimación y objetivo', gap: 32, body: k.pill('Cómo bajamos el coste') + '\n' + k.h2('De 0,24 € a 0,02 € por conversación') + '\n' + k.row(
    stage(C.white, 'Etapa 0 · hoy', '0,24 €', 'Todo con el modelo caro', ['Así se construyó primero', 'Margen del 13 % a 98 €'], 'Medido en pruebas')
    + `\n<x-shape kind="arrow-right" style="width:28px;height:18px;background:${C.ink};align-self:center"></x-shape>\n`
    + stage(C.white, 'Etapa 1 · enrutado por turno', '≈ 0,08 €', '70 % de turnos al modelo rápido', ['Reservar y cobrar siguen en el caro', 'Margen del 65 %'], 'Hito de plataforma, en curso')
    + `\n<x-shape kind="arrow-right" style="width:28px;height:18px;background:${C.ink};align-self:center"></x-shape>\n`
    + stage(C.ink, 'Etapa 2 · caché y recorte', '≈ 0,02 €', '85 % rápido y caché', ['Instrucciones leídas de caché', 'Margen del 84 %'], 'Se mide en el piloto'), 12, ';align-items:stretch;flex:1')
    + '\n' + k.p('El modelo de cada turno lo decide una evaluación de calidad, no el precio.', 28) });
  const a = 'Suscripción por empresa,', b = 'más uso y más implantación.';
  if (!S.negocio.includes(a) || !S.negocio.includes(b)) throw new Error('negocio heading changed');
  S.negocio = S.negocio.replace(a, 'Precio de servicio premium,').replace(b, 'con margen desde el primer plan.')
    .replace('extra: 0,10 € por conversación', 'extra: 0,25 € por conversación')
    .replace(/<aside>[\s\S]*?<\/aside>/, `<aside>${N.negocio}</aside>`);
  S.margenes = S.margenes.replace('la conversación extra a 0,10 euros apenas cubre su coste de 0,08 hasta que el reparto de modelos mejore.', 'la conversación extra se cobra a 0,25 euros: deja un 68 % con el coste de 0,08, pero hoy, con 0,24 de coste, no deja margen.');
  S.__order.splice(S.__order.indexOf('economia') + 1, 0, 'plancoste');
};
