// Pilot deck: figures checked on primary sources (11 Nov 2026).
module.exports = function (k, S, N) {
  const { C } = k;
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  rep('coste', '10,2 %', '34,9 €'); rep('coste', 'del tiempo de trabajo en España se va en tareas administrativas · Sage', 'cuesta de media una hora de trabajo en la UE · Eurostat, 2025');
  S.coste = S.coste.replace(/<aside>[\s\S]*?<\/aside>/, '<aside>Es una estimación con datos públicos, no un dato de su empresa. Úsala para abrir la conversación y pide enseguida sus cifras reales: cuántas horas a la semana se van en atender, reservar, hacer seguimiento y cobrar, y cuántas citas o llamadas se pierden. Supuestos: entre 15 y 33 horas a la semana, a 14,20 euros la hora; ni las horas ni ese coste por hora están contrastados. Sí están contrastados en la fuente el coste laboral de la UE, el plazo de pago y el uso de WhatsApp.</aside>');
  rep('ahorro', k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">25.300 €</p>\n` + k.p('cuesta al año un puesto de recepción en España', 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px'),
    k.col(`<p style="font-family:${k.FD};font-size:44px;line-height:1.1;letter-spacing:-1px">Tú decides</p>\n` + k.p('lo sensible espera tu aprobación antes de enviarse', 24, C.muted), 6, ';flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px'));
};
