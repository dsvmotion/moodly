// Fourth pass: founder profile from his own services deck.
module.exports = function (k, S, N) {
  const { C } = k;
  N.equipo = 'Cuenta el recorrido tal cual: vienes del 3D y el diseño audiovisual, llevas desde 2019 como freelance y ahora diseñas y construyes productos de IA con Claude como herramienta principal. Di de frente lo que falta: no eres ingeniero de formación, y por eso la primera incorporación es de ingeniería. La cifra de 59 cambios en 12 días demuestra que el método funciona; la persona de ingeniería reduce el riesgo. Sobre el nombre: quien te busque verá «AKH» en tu web. Explícalo tú antes: es el nombre provisional de la plataforma mientras moodly.com sigue funcionando como tienda de cosmética; cuando el piloto esté en marcha, la plataforma pasa a moodly.com y la tienda a otro dominio.';
  S.equipo = k.slide('equipo', { foot: 'Ritmo medido en los 12 días hasta el 11 de noviembre de 2026', body: k.pill('El equipo') + '\n' + k.h2('Quién lo construye y cómo') + '\n' + k.row(
    k.tile(C.white, k.lab('Fundador · producto y diseño', C.soft) + '\n' + k.h3('Diego Sanjuan', 50) + '\n'
      + k.p('Diseñador de producto en Madrid. Freelance en 3D y diseño visual desde 2019: más de 20 proyectos para más de 15 clientes. Hoy diseña y construye agentes, automatizaciones y webs con IA.', 26, C.muted) + '\n'
      + k.p('3D y motion para Marine Serre, A Better Feeling, SHM / Alexander Wessely y Selam X Studio. Socio estratégico de Genera Space, empresa de medios generativos. Cofundó Moodly en 2023 como marca y tienda online.', 26, C.muted) + '\n<div style="flex:1"></div>\n'
      + k.p('Primeras incorporaciones: ingeniería y ventas', 28), { pad: '30px 40px', gap: 10 }) + '\n'
    + k.tile(C.ink, k.row(`<p style="font-family:${k.FT};font-size:180px;line-height:1;letter-spacing:-8px">59</p>\n` + k.p('cambios integrados<br>en 12 días', 32, '', ';padding:0px 0px 20px'), 28, ';align-items:flex-end') + '\n' + k.ul(['Varias sesiones de IA en paralelo, con una que coordina', 'Ningún cambio entra sin tests en verde', 'El plan y el estado viven en el repositorio'], 26), { pad: '40px', gap: 24 }), 16, ';align-items:stretch;flex:1') });
  const a = 'Hoy el proyecto depende de una persona.', b = 'Plan y estado escritos en el repositorio; incorporaciones con la ronda.';
  if (!S.riesgos.includes(a) || !S.riesgos.includes(b)) throw new Error('riesgos text changed');
  S.riesgos = S.riesgos.replace(a, 'Una persona, con perfil de producto y diseño.').replace(b, 'Todo escrito en el repositorio; la primera incorporación es de ingeniería.');
};
