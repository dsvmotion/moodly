// Seventh pass: figures checked on primary sources (11 Nov 2026), WhatsApp service-message cost, five-year scenario.
module.exports = function (k, S, N) {
  const { C } = k;
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  const note = (id, t) => { S[id] = S[id].replace(/<aside>[\s\S]*?<\/aside>/, `<aside>${t}</aside>`); };
  // --- cost of the problem: replace the figure that could not be found at its source
  rep('coste', '10,2 %', '34,9 €'); rep('coste', 'del tiempo de trabajo en España se va en tareas administrativas · Sage', 'cuesta de media una hora de trabajo en la UE · Eurostat, 2025');
  note('coste', 'Es una estimación propia, no un dato medido en clientes. Supuestos: el local dedica entre 15 y 33 horas a la semana a atender, reservar, hacer seguimiento y reclamar cobros, a 14,20 euros la hora; se suma una parte ilustrativa de ingresos perdidos por citas a las que no se acude y llamadas sin atender. Las horas y el coste por hora no están contrastados: la cifra de Sage que sostenía el caso alto no aparece en su página, y el salario de recepción viene de Indeed, que no se pudo abrir. Contrastado en la fuente el 11 de noviembre de 2026: coste laboral de la UE (Eurostat), plazo de pago (CEPYME) y uso de WhatsApp (CNMC).');
  rep('ahorro', k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">25.300 €</p>\n` + k.p('cuesta al año un puesto de recepción en España', 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px'),
    k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">A cualquier hora</p>\n` + k.p('responde también con el local cerrado o el equipo ocupado', 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px'));
  // --- cost to serve: WhatsApp service messages are charged again since 1 Oct 2026 (1,000 free per number and month)
  rep('economia', 'De 85 € a 16 € al mes por cliente', 'De 98 € a 29 € al mes por cliente');
  rep('economia', 'WhatsApp: 300 recordatorios', 'WhatsApp: respuestas y recordatorios');
  S.economia = S.economia.replace(/(WhatsApp: respuestas y recordatorios<\/p>\n)([\s\S]*?)(<\/div>)/, (m, a, cells, z) => a + cells.split('5 €').join('18 €') + z);
  rep('economia', '>85 €<', '>98 €<'); rep('economia', '>34 €<', '>47 €<'); rep('economia', '>16 €<', '>29 €<');
  rep('economia', '>13 %<', '>0 %<'); rep('economia', '>65 %<', '>52 %<'); rep('economia', '>84 %<', '>70 %<');
  note('economia', 'Cliente tipo de la auditoría: 300 conversaciones y 150 citas al mes. Primera columna, lo que hay hoy: todo pasa por el modelo caro y el coste iguala a la cuota. Segunda: el 70 % de los turnos al modelo rápido. Tercera: 85 % rápido y caché. Solo la primera está medida. Novedad contrastada en la web de Meta: desde el 1 de octubre de 2026 las respuestas dentro de la conversación vuelven a cobrarse, con 1.000 gratis al mes por número; con seis respuestas por conversación son unas 800 de pago. La tarifa española de esos mensajes no está contrastada: se usa la de utilidad, 0,0166 euros. Precios de modelos contrastados con la tarifa de Anthropic; Supabase, Vercel y Railway, con sus páginas de precios.');
  rep('plancoste', 'Margen del 13 % a 98 €', 'Sin margen a 98 €'); rep('plancoste', 'Margen del 65 %', 'Margen del 52 %'); rep('plancoste', 'Margen del 84 %', 'Margen del 70 %');
  rep('margenes', 'Entre el 65 % y el 79 % de margen bruto', 'Entre el 48 % y el 70 % de margen bruto');
  rep('margenes', 'Coste de servirlo: 34 €', 'Coste de servirlo: 47 €'); rep('margenes', 'Coste de servirlo: 105 €', 'Coste de servirlo: 155 €'); rep('margenes', 'Coste de servirlo: 630 €', 'Coste de servirlo: 900 €');
  S.margenes = S.margenes.replace('>65 %</p>', '>52 %</p>').replace('>65 %</p>', '>48 %</p>').replace('>79 %</p>', '>70 %</p>');
  rep('margenes', '4–6 clientes', '5–8 clientes'); rep('margenes', '≈ 0,4 M€', '≈ 0,3 M€');
  note('margenes', 'Los tres planes en la etapa 1 del plan de coste, 0,08 euros por conversación, con WhatsApp ya cobrando las respuestas. Equipo supone 1.000 conversaciones y 3 sedes; Empresa, 20 sedes con 300 conversaciones cada una. Con 51 euros de margen por cliente Esencial, entre 5 y 8 clientes cubren la infraestructura y las herramientas de hoy. Con estos precios el margen queda por debajo de lo habitual en software. La alternativa sobre la mesa, 149, 399 y 200 euros por sede, lo llevaría al 68 %, 61 % y 78 %. En la etapa 2 del plan de coste, los precios actuales dan 70 %, 68 % y 82 %.');
  rep('negocio', 'con margen desde el primer plan.', 'con precio por empresa, uso e implantación.');
  // --- competitors: checked on their own sites
  rep('competencia', '49–279 € al mes', '49–279 € al mes; WhatsApp aparte'); rep('competencia', 'Sin precio claro', 'Sin precio publicado'); rep('competencia', '0,99 $ por resolución', '0,99 $ por resolución, mínimo 49 $');
  rep('competencia', 'Datos publicados por cada empresa o por la prensa, a noviembre de 2026 · sin contrastar en origen', 'Precios de HeyDiga y Fin vistos en su web el 11 de noviembre de 2026 · el resto, de prensa');
  // --- founder: clients listed on his own site
  rep('equipo', '3D y motion para Marine Serre, A Better Feeling, SHM / Alexander Wessely y Selam X Studio.', '3D y motion para Marine Serre, Zegna, Selfridges, Puma y LaLiga, entre otros.');
  // --- five-year scenario
  Object.assign(N, {
    crecimiento: 'Es un escenario objetivo construido por nosotros, no una previsión ni un compromiso. Parte de 45 clientes al cierre de 2027 y llega a 3.600 en 2031, con la mezcla de planes propuesta y cada vez más peso de cadenas. No modela bajas: son clientes netos. Para situarlo: HeyDiga declara más de 200 clientes a los 14 meses de fundarse, con unos 6,5 millones de euros levantados. El primer año depende de cerrar los pilotos; todo lo demás depende de que el primer año salga.',
    cuenta: 'El mismo escenario en cuenta de resultados. Los ingresos son la media del ingreso recurrente al principio y al final de cada año; la implantación va aparte. El margen bruto sube según el plan de coste: de un 30 % el primer año a un 70 % el quinto. Los costes operativos son sobre todo equipo: de 3 personas a 50. El resultado es negativo cuatro años y suma un déficit de 1,5 millones: los 250.000 de esta ronda y alrededor de 1,3 millones más, que habría que levantar en el segundo año con los pilotos como prueba. Qué gana el inversor depende de la valoración de entrada, que está por negociar.',
  });
  const Y = [['2027', 0.11, '0,1 M€', '45 clientes'], ['2028', 0.64, '0,6 M€', '300 clientes'], ['2029', 2.1, '2,1 M€', '900 clientes'], ['2030', 5.0, '5,0 M€', '2.000 clientes'], ['2031', 10.3, '10,3 M€', '3.600 clientes']];
  const bars = Y.map((y, i) => k.col(`<p style="font-family:${k.FT};font-size:56px;line-height:1.05;letter-spacing:-2px">${y[2]}</p>\n<div style="height:${Math.max(8, Math.round(y[1] / 10.3 * 220))}px;background:${i === 4 ? C.ink : i === 0 ? C.orange : '#a1a1a6'};border-radius:12px 12px 0px 0px"></div>\n`
    + `<div style="display:flex;flex-direction:column;gap:4px;border-top:2px solid ${C.ink};padding:14px 0px 0px">\n` + k.lab(y[0], C.ink, 30) + '\n' + k.p(y[3], 26, C.muted) + '\n</div>', 10, ';flex:1')).join('\n');
  S.crecimiento = k.slide('crecimiento', { foot: 'Escenario objetivo propio, no una previsión · clientes netos, sin bajas modeladas', gap: 32, body: k.pill('Crecimiento') + '\n' + k.h2('De 0,1 a 10 M€ de ingreso recurrente') + '\n'
    + k.tile(C.white, k.lab('Ingreso recurrente anual al cierre de cada año') + '\n<div style="flex:1"></div>\n' + k.row(bars, 24, ';align-items:flex-end'), { pad: '28px 36px', gap: 8 }) });
  S.cuenta = k.compare('cuenta', { tag: 'Cuenta de resultados', title: 'Rentable en el quinto año, con 1,5 M€ de capital', fs: 26, pad: '15px 22px', firstW: 330,
    foot: 'Escenario objetivo propio, no una previsión · importes en euros · implantación aparte',
    head: ['', '2027', '2028', '2029', '2030', '2031'], rows: [
      ['Clientes', '45', '300', '900', '2.000', '3.600'],
      ['Ingreso recurrente al cierre', '0,1 M', '0,6 M', '2,1 M', '5,0 M', '10,3 M'],
      ['Ingresos del año', '0,05 M', '0,4 M', '1,4 M', '3,6 M', '7,7 M'],
      ['Margen bruto', '30 %', '50 %', '62 %', '68 %', '70 %'],
      ['Costes operativos', '0,25 M', '0,6 M', '1,4 M', '2,8 M', '5,0 M'],
      ['Resultado', '−0,2 M', '−0,4 M', '−0,5 M', '−0,4 M', '+0,4 M'],
      ['Equipo', '3', '7', '15', '30', '50']] });
  S.__order.splice(S.__order.indexOf('margenes') + 1, 0, 'crecimiento', 'cuenta');
};
