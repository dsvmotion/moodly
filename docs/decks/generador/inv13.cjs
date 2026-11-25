// Thirteenth pass: platform positioning, learning loop, five first sectors, no contact email yet.
module.exports = function (k, S, N) {
  const { C } = k;
  const rep = (id, a, b) => { if (!S[id].includes(a)) throw new Error(`${id}: missing "${a.slice(0, 50)}"`); S[id] = S[id].split(a).join(b); };
  const noMail = (id) => { const n = S[id].replace(/\n?<p[^>]*>contact@moodly\.com<\/p>/, ''); if (n === S[id]) throw new Error(id + ': email not found'); S[id] = n; };
  noMail('cierre');
  rep('cover', 'Un equipo de agentes de IA para cualquier empresa', 'Un equipo de agentes de IA dentro de cada empresa');
  rep('cover', 'Moodly hace el trabajo operativo de una empresa: atiende, vende, cobra y organiza. Aprende de su equipo y actúa bajo sus reglas.', 'Una capa operativa de IA sobre los sistemas que la empresa ya usa: atiende, vende, cobra y organiza. Aprende de su equipo y actúa bajo sus reglas.');
  const layer = (name, text, dark) => k.tile(dark ? C.ink : C.white, k.h3(name, 36) + '\n' + k.p(text, 26, dark ? C.onDark : C.muted), { pad: '22px 28px', gap: 6, flex: '' });
  S.plataforma = k.slide('plataforma', { foot: 'Diseño de la plataforma · una parte está construida y otra en el plan', gap: 32, body: k.pill('La plataforma') + '\n' + k.h2('Los agentes son la entrada.', 'El producto es lo que hay debajo.') + '\n'
    + k.box('flex:1;display:grid;grid-template-columns:repeat(4, 1fr);grid-template-rows:repeat(2, 1fr);gap:16px', [
      layer('Agentes', 'Lo que ve la empresa: cuatro de serie y los que cree.', true),
      layer('Conocimiento', 'Lo que la empresa sabe: horarios, precios y normas.'),
      layer('Memoria', 'Lo que pasó y lo que se corrigió, por agente y compartida.'),
      layer('Skills', 'Capacidades que se reutilizan entre agentes y sectores.'),
      layer('Integraciones', 'Las herramientas que la empresa ya usa.'),
      layer('Reglas y permisos', 'Qué puede hacer cada agente y cuándo pide aprobación.'),
      layer('Orquestación', 'Reparte el trabajo: un agente reserva y otro cobra.'),
      layer('Modelos de IA', 'Intercambiables: se usa el mejor o el más barato.')].join('\n')) });
  S.aprendizaje = k.flow('aprendizaje', { tag: 'El ciclo de aprendizaje', title: 'Cada corrección mejora al equipo entero', hot: 2, foot: 'Diseño del ciclo · es la prioridad del producto y está en construcción',
    steps: [['Tarea', 'El agente hace un trabajo.'], ['Revisión', 'Una persona aprueba o corrige.'], ['Validación', 'La corrección se guarda con versión.'], ['Evaluación', 'Se comprueba que mejora.'], ['Reutilización', 'Sirve a otros agentes y locales.']],
    levelsLabel: 'Con el uso, la empresa acumula algo que cuesta llevarse a otro sitio', levels: ['Más conocimiento', 'Mejores reglas', 'Menos supervisión', 'Más autonomía'] });
  S.horizontal = k.bento('horizontal', { tag: 'Primeros sectores', title: 'Cinco sectores para empezar.', soft: 'Todos viven de la cita y del mensaje.', foot: 'Sectores objetivo · todavía no son clientes', items: [
    ['Belleza y bienestar', 'Citas, bonos, recordatorios y señales.'], ['Hostelería y restauración', 'Reservas, grupos, eventos y señales.'], ['Automoción y talleres', 'Citas de taller, presupuestos y avisos.'],
    ['Salud y bienestar', 'Citas y recordatorios, sin datos clínicos.'], ['Viviendas e inmuebles', 'Interesados, visitas y seguimiento.'], ['Después', 'Comercio, agencias y cadenas de otros sectores.']] });
  Object.assign(N, {
    plataforma: 'La idea central para un inversor: no vendemos cuatro agentes, construimos la capa que los hace posibles. El modelo de IA es intercambiable; el valor está en lo que lo rodea, que es propio de cada empresa. Sé claro con el estado: la base, las reglas, el aislamiento de datos y un agente que reserva están en pruebas; la memoria que aprende y la mayoría de integraciones están en el plan.',
    aprendizaje: 'Es el diferenciador a largo plazo y todavía no está construido entero: dilo así. Una corrección no pasa a ser conocimiento sin validación, versión y evaluación; eso es lo que evita que el agente aprenda errores. Con el tiempo, la empresa acumula conocimiento, reglas y contexto que no se lleva fácilmente a otro proveedor: esa es la defensa, y crece con cada cliente. Hoy no existe aún.',
    horizontal: 'Son los cinco sectores donde empezamos: negocios de cita y de mensaje, muchos con varios locales. Son exactamente los cinco en los que HeyDiga ya vende, con 250 clientes y 6,5 millones levantados: un inversor lo sabrá. La respuesta es qué hacemos distinto en esos sectores: el trabajo de después de la conversación (señal, recordatorio, cambio de cita, con aprobación), las reglas por organización, región y local, y la traza. En salud, el piloto se limita a citas y precios, sin datos clínicos: los datos de salud exigen consentimiento expreso y más garantías.',
    fondos: 'Propuesta de partida, pensada para diluir poco: 200.000 euros de inversores particulares, con nota convertible, en dos tramos. El primer tramo de 50.000 euros está abierto: todavía no hay inversor ni sociedad constituida; la sociedad se constituye antes de firmar. El plan necesita alrededor de medio millón hasta ser rentable: el resto sale de los ingresos y de ayudas públicas y europeas a fondo perdido para contratar equipo, que se solicitan con la sociedad constituida, cartas de intención de empresas piloto firmadas e inversores interesados. No están concedidas. Dilución orientativa: entre el 10 y el 13 % con un tope de valoración de 1,5 a 2 millones; es una estimación nuestra.',
  });
  rep('fondos', 'se completa con financiación pública sin dilución', 'se completa con ayudas públicas, por solicitar');
  S.__order = ['cover', 'problema', 'coste', 'producto', 'demo', 'plataforma', 'aprendizaje', 'ahorro', 'porque', 'tam', 'horizontal', 'negocio', 'margenes', 'crecimiento', 'competencia', 'estado', 'equipo', 'fondos', 'cierre',
    'anexo', 'fuentes', 'retorno', 'ventajas', 'tesis', 'usp', 'motor', 'foso', 'economia', 'plancoste', 'cuenta', 'hoja', 'mercado', 'confianza', 'riesgos'];
};
