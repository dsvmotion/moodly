// Shared slide builders for the two Moodly decks (brand: light canvas, agent colour fields, pills, pictograms).
const C = { canvas: '#f4f4f5', ink: '#000000', muted: '#5f5f63', line: '#0000001a', blue: '#2457f5', orange: '#ff6301',
  green: '#000000', sage: '#ffffff', rock: '#ffffff', linen: '#ffffff', wine: '#000000', rosa: '#ffffff', cin: '#000000',
  peach: '#ffffff', pink: '#ffffff', ok: '#ffffff', grey: '#a1a1a6', white: '#ffffff', soft: '#000000b3', onDark: '#ffffffcc' };
const AG = { green: '#004c39', sage: '#a3c2a7', rock: '#9dbecc', linen: '#f6f2e8', wine: '#a30042', rosa: '#fbe1ea', cin: '#8e4e00', peach: '#ffe8d6' };
const FD = "'Labil Grotesk', Arial, sans-serif";
const FT = "'Labil Grotesk Thin', 'Labil Grotesk', Arial, sans-serif";
const FB = "'Plus Jakarta Sans', Arial, sans-serif";
const DARK = new Set([C.ink, C.blue, '#3f3f46', AG.green, AG.wine, AG.cin]);
const on = bg => (DARK.has(bg) ? C.white : C.ink);
const onSoft = bg => (DARK.has(bg) ? C.onDark : C.soft);

module.exports = function mk(A, notes) {
  const img = (id, w, h, extra = '', alt = 'Moodly') => `<img src="/_blob/${id}" alt="${alt}" style="width:${w}px;height:${h}px;object-fit:contain${extra}">`;
  const picto = (name, size = 72) => img(A.p[name], size, size, '', '');
  const pill = (t, bg = C.white, fg = C.ink, bd = true) => `<p style="font-family:${FD};font-size:24px;line-height:1.2;color:${fg};background:${bg};${bd ? `border:1px solid ${C.line};` : ''}border-radius:800px;padding:10px 24px;align-self:flex-start">${t}</p>`;
  const h2 = (t, soft = '', size = 80, sc = C.muted) => `<h2 style="font-family:${FD};font-size:${size}px;font-weight:400;line-height:1.08;letter-spacing:-3px">${t}${soft ? ` <span style="color:${sc}">${soft}</span>` : ''}</h2>`;
  const h3 = (t, size = 36, color = '') => `<h3 style="font-family:${FD};font-size:${size}px;font-weight:400;line-height:1.15;letter-spacing:-1px${color ? `;color:${color}` : ''}">${t}</h3>`;
  const p = (t, size = 26, color = '', extra = '') => `<p style="font-size:${size}px;line-height:1.4${color ? `;color:${color}` : ''}${extra}">${t}</p>`;
  const lab = (t, color = C.muted, size = 24) => `<p style="font-family:${FD};font-size:${size}px;line-height:1.2;color:${color}">${t}</p>`;
  const ul = (items, size = 28, color = '') => `<ul style="font-size:${size}px;line-height:1.45${color ? `;color:${color}` : ''}">\n${items.map(i => `<li>${i}</li>`).join('\n')}\n</ul>`;
  const box = (style, inner) => `<div style="${style}">\n${inner}\n</div>`;
  const tile = (bg, inner, { pad = '36px', gap = 12, flex = 'flex:1;', extra = '' } = {}) =>
    box(`${flex}display:flex;flex-direction:column;gap:${gap}px;background:${bg};color:${on(bg)};padding:${pad};border-radius:12px${bg === C.white ? `;border:1px solid ${C.line}` : ''}${extra}`, inner);
  const row = (inner, gap = 16, extra = '') => box(`display:flex;flex-direction:row;gap:${gap}px${extra}`, inner);
  const col = (inner, gap = 16, extra = '') => box(`display:flex;flex-direction:column;gap:${gap}px${extra}`, inner);

  const slide = (id, { bg = C.canvas, logo = 'b', foot = '', justify = '', gap = 40, body }) => {
    const fg = on(bg), fc = DARK.has(bg) ? C.grey : C.muted;
    return `<section id="${id}" data-transition="fade" style="background:${bg};color:${fg};font-family:${FB};padding:128px 128px 160px;display:flex;flex-direction:column;${justify ? `justify-content:${justify};` : ''}gap:${gap}px">\n${body}\n`
      + (foot ? `<p style="position:absolute;left:128px;bottom:64px;font-family:${FD};font-size:24px;color:${fc}">${foot}</p>\n` : '')
      + (logo ? img(logo === 'w' ? A.lw : A.lb, 124, 32, ';position:absolute;right:128px;bottom:64px') + '\n' : '')
      + `<aside>${notes[id] || ''}</aside>\n</section>\n`;
  };

  // ---- slide kinds ----
  const abs = (l, t, w, h, bg, r = '0px') => `<div style="position:absolute;left:${l}px;top:${t}px;width:${w}px;height:${h}px;background:${bg};border-radius:${r}"></div>`;
  const slabs = () => [
    abs(1240, 0, 300, 1080, C.ink),
    abs(1272, 660, 196, 44, C.canvas, '800px'), abs(1272, 724, 236, 44, C.canvas, '800px'),
    abs(1272, 788, 112, 44, C.canvas, '800px'), abs(1400, 788, 108, 44, C.canvas, '800px'),
    abs(1572, 96, 348, 268, AG.rock, '24px 0px 0px 24px'),
    abs(1572, 396, 220, 684, AG.cin, '24px 24px 0px 0px'),
    abs(1824, 396, 96, 72, AG.green, '800px 0px 0px 800px'),
    abs(1824, 500, 96, 580, AG.wine, '24px 0px 0px 0px'),
  ].join('\n');

  const cover = (id, { tag, title, sub, foot }) => slide(id, {
    logo: '', foot, justify: 'space-between', gap: 48,
    body: slabs() + '\n' + img(A.lb, 248, 64, ';align-self:flex-start') + '\n' + col(
      pill(tag) + '\n' + `<h1 style="font-family:${FT};font-size:104px;font-weight:400;line-height:1.05;letter-spacing:-4px">${title}</h1>\n` + p(sub, 36, C.muted, ';font-weight:300'),
      36, ';width:1040px'),
  });

  const statement = (id, { tag, title, soft, bg = C.green, foot = '' }) => slide(id, {
    bg, logo: DARK.has(bg) ? 'w' : 'b', foot, justify: 'space-between', gap: 48,
    body: pill(tag, C.white, C.ink, false) + '\n'
      + `<h1 style="font-family:${FT};font-size:112px;font-weight:400;line-height:1.08;letter-spacing:-4px">${title} <span style="color:${DARK.has(bg) ? C.grey : C.soft}">${soft}</span></h1>`,
  });

  const closing = (id, { title, sub, contact }) => slide(id, {
    bg: C.green, logo: '', justify: 'space-between', gap: 48,
    body: img(A.lw, 248, 64, ';align-self:flex-start') + '\n' + col(
      `<h1 style="font-family:${FT};font-size:124px;font-weight:400;line-height:1.05;letter-spacing:-5px">${title}</h1>\n` + p(sub, 36, C.grey, ';font-weight:300') + '\n' + pill(contact, C.white, C.ink, false),
      40, ';width:1500px'),
  });

  // heading on the left, tinted tiles with pictograms on the right
  const split = (id, { tag, title, soft, text = '', tiles, foot = '', leftW = 680, size = 72 }) => slide(id, {
    foot,
    body: row(
      col(pill(tag) + '\n' + h2(title, soft, size) + (text ? '\n' + p(text, 30, C.muted) : ''), 40, `;width:${leftW}px`) + '\n'
      + col(tiles.map(t => box(`flex:1;display:flex;flex-direction:row;align-items:center;gap:40px;background:${t.bg};color:${on(t.bg)};padding:20px 44px;border-radius:12px${t.bg === C.white ? `;border:1px solid ${C.line}` : ''}`,
        (t.picto ? picto(t.picto, 104) + '\n' : '') + (t.label ? `<p style="font-family:${FD};font-size:40px;line-height:1.15;width:${t.labelW || 290}px">${t.label}</p>\n` : '')
        + (t.title ? col(h3(t.title, 46) + '\n' + p(t.text, 30, onSoft(t.bg)), 10, ';flex:1') : p(t.text, 26, onSoft(t.bg), ';flex:1')))).join('\n'), tiles.length > 4 ? 8 : 16, ';flex:1'),
      64, ';flex:1'),
  });

  const agentCard = (bg, alt, name, role, chips) => tile(bg, h3(name, 34) + '\n' + p(role, 28, onSoft(bg)) + '\n<div style="flex:1"></div>\n'
    + `<p style="font-family:${FD};font-size:24px;line-height:1.2;color:${C.ink};background:${alt};border-radius:800px;padding:8px 18px;align-self:flex-start">${chips}</p>`, { pad: '32px', gap: 16 });
  const agents = (id, { tag, title, soft, cards, own, line, foot = '' }) => slide(id, {
    foot,
    body: pill(tag) + '\n' + h2(title, soft) + '\n' + row([
      agentCard(AG.green, AG.sage, 'Recepción', cards[0][0], cards[0][1]),
      agentCard(AG.rock, AG.linen, 'Atención', cards[1][0], cards[1][1]),
      agentCard(AG.wine, AG.rosa, 'Comercial', cards[2][0], cards[2][1]),
      agentCard(AG.cin, AG.peach, 'Administración', cards[3][0], cards[3][1]),
      box(`flex:1;display:flex;flex-direction:column;gap:12px;background:${C.white};padding:32px;border:2px solid ${C.blue};border-radius:12px`,
        h3(own[0], 40, C.blue) + '\n' + p(own[1], 28, C.muted) + '\n<div style="flex:1"></div>\n'
        + `<p style="font-family:${FD};font-size:24px;line-height:1.2;color:${C.white};background:${C.blue};border-radius:800px;padding:8px 18px;align-self:flex-start">${own[2]}</p>`),
    ].join('\n'), 16, ';flex:1;align-items:stretch') + '\n' + p(line, 32),
  });

  const flow = (id, { tag, title, steps, hot = 2, levelsLabel, levels, foot = '' }) => slide(id, {
    foot,
    body: pill(tag) + '\n' + h2(title) + '\n' + row(steps.map((s, i) => {
      const bg = i === hot ? C.orange : C.white;
      return box(`flex:1;display:flex;flex-direction:column;gap:8px;background:${bg};padding:28px;border-radius:12px${bg === C.white ? `;border:1px solid ${C.line}` : ''}`,
        `<p style="font-family:${FT};font-size:104px;line-height:1.05;letter-spacing:-4px">0${i + 1}</p>\n<div style="flex:1"></div>\n` + h3(s[0], 42) + '\n' + p(s[1], 28, i === hot ? C.ink : C.muted, ';height:118px'));
    }).join(`\n<x-shape kind="arrow-right" style="width:28px;height:18px;background:${C.ink};align-self:center"></x-shape>\n`), 12, ';align-items:stretch;flex:1')
      + '\n' + col(lab(levelsLabel, C.ink, 30) + '\n' + row(levels.map((l, i) => {
        const bg = [C.white, '#e4e4e7', C.grey, C.ink][i];
        return `<p style="flex:1;font-family:${FD};font-size:32px;line-height:1.2;color:${on(bg)};background:${bg};${bg === C.white ? `border:1px solid ${C.line};` : ''}border-radius:800px;padding:18px 32px">${l}</p>`;
      }).join('\n'), 12), 16),
  });

  const bento = (id, { tag, title, soft, items, line = '', foot = '', cols = 3 }) => {
    const tints = [C.sage, C.linen, C.pink, C.rock, C.peach, C.rosa];
    return slide(id, {
      foot,
      body: pill(tag) + '\n' + h2(title, soft) + '\n'
        + box(`flex:1;display:grid;grid-template-columns:repeat(${cols}, 1fr);grid-template-rows:repeat(${Math.ceil(items.length / cols)}, 1fr);gap:16px`, items.map((it, i) => tile(it.bg || tints[i % 6],
          (it.picto ? picto(it.picto, 80) + '\n' : '') + '<div style="flex:1"></div>\n' + h3(it[0] || it.title, 38) + '\n' + p(it[1] || it.text, 26, onSoft(it.bg || tints[i % 6])), { pad: '26px 32px', gap: 6, flex: '' })).join('\n'))
        + (line ? '\n' + p(line, 32) : ''),
    });
  };

  const columns = (id, { tag, title, soft, cols, foot = '', size = 28 }) => slide(id, {
    foot,
    body: pill(tag) + '\n' + h2(title, soft) + '\n' + row(cols.map(c => tile(c.bg, h3(c.title, 44, c.fg || '') + '\n' + ul(c.items, size)
      , { pad: '40px', gap: 24 })).join('\n'), 16, ';align-items:stretch;flex:1'),
  });

  const numbers = (id, { tag, title, soft, nums, track, tiles, foot = '' }) => slide(id, {
    foot, gap: 32,
    body: pill(tag) + '\n' + h2(title, soft) + '\n' + row(nums.map(n => col(
      `<p style="font-family:${FT};font-size:96px;line-height:1.1;letter-spacing:-4px">${n[0]}</p>\n` + p(n[1], 26, C.muted), 4, `;flex:1;border-top:1px solid #0000004d;padding:16px 0px 0px`)).join('\n'), 24)
      + '\n' + col(row([0, 1, 2, 3, 4].map(i => `<div style="flex:1;height:16px;border-radius:800px;background:${i < track.done ? C.orange : '#d4d4d8'}"></div>`).join('\n'), 8) + '\n' + lab(track.label, C.ink), 12)
      + '\n' + row(tiles.map(t => tile(t.bg, h3(t.title, 30, t.fg) + '\n' + (t.items ? ul(t.items, 26) : p(t.text, 26)), { pad: '24px 32px', gap: 8 })).join('\n'), 16, ';align-items:stretch'),
  });

  const timeline = (id, { tag, title, soft, points, strip, foot = '' }) => {
    const W = 1664, H = 330;
    const marks = points.map((m, i) => {
      const x = Math.round(m.at * W), last = i === points.length - 1;
      const bg = m.kind === 'now' ? C.orange : m.kind === 'key' ? C.blue : C.white;
      const lx = x - 24;
      return `<div style="position:absolute;left:${x - 24}px;top:0px;width:48px;height:48px;border-radius:50%;background:${bg};border:2px solid ${bg === C.white ? C.ink : bg}"></div>\n`
        + `<div style="position:absolute;left:${lx}px;top:80px;width:228px;display:flex;flex-direction:column;gap:10px">\n`
        + lab(m.date, m.kind === 'key' ? C.blue : C.muted, 26) + '\n' + h3(m.title, 38) + '\n' + p(m.text, 26, C.muted) + '\n</div>';
    }).join('\n');
    return slide(id, {
      foot,
      body: pill(tag) + '\n' + h2(title, soft) + '\n'
        + `<div style="position:relative;width:${W}px;height:${H}px">\n<div style="position:absolute;left:0px;top:23px;width:${W}px;height:2px;background:#00000033"></div>\n`
        + `<div style="position:absolute;left:0px;top:21px;width:${Math.round(points[0].at * W)}px;height:6px;background:${C.orange};border-radius:800px"></div>\n${marks}\n</div>\n`
        + row(lab(strip.label, C.ink, 30) + '\n' + strip.items.map((s, i) => `<p style="font-family:${FD};font-size:30px;line-height:1.2;color:${i === strip.hot ? C.white : C.ink};background:${i === strip.hot ? C.blue : C.white};${i === strip.hot ? '' : `border:1px solid ${C.line};`}border-radius:800px;padding:12px 26px">${s}</p>`).join('\n'), 16, ';align-items:center'),
    });
  };

  const stairs = (id, { tag, title, steps, line, foot = '' }) => {
    const bgs = [C.white, '#d4d4d8', '#3f3f46', C.ink], hs = [330, 380, 430, 480];
    return slide(id, {
      foot,
      body: pill(tag) + '\n' + h2(title) + '\n' + row(steps.map((s, i) => box(
        `flex:1;height:${hs[i]}px;display:flex;flex-direction:column;gap:10px;background:${bgs[i]};color:${on(bgs[i])};padding:32px;border-radius:12px${i === 0 ? `;border:1px solid ${C.line}` : ''}`,
        lab(s[0], onSoft(bgs[i])) + '\n' + h3(s[1], 46) + '\n' + p(s[2], 28, onSoft(bgs[i])))).join('\n'), 16, ';align-items:flex-end')
        + '\n' + p(line, 30),
    });
  };

  const compare = (id, { tag, title, soft, head, rows, foot = '', fs = 26, pad = '20px 28px', firstW = 430 }) => {
    const cell = (t, first, moodly, header, lastRow) => `<p style="${first ? `width:${firstW}px` : 'flex:1'};font-family:${header || first ? FD : FB};font-size:${fs}px;line-height:1.3;padding:${pad};${moodly ? `background:${C.green};color:${C.white}` : `color:${header ? C.muted : first ? C.ink : C.muted}`}">${t}</p>`;
    const line = (cells, header, last) => box(`display:flex;flex-direction:row;align-items:stretch${last ? '' : `;border-bottom:1px solid ${C.line}`}`, cells.map((t, i) => cell(t, i === 0, i === cells.length - 1, header)).join('\n'));
    return slide(id, {
      foot,
      body: pill(tag) + '\n' + h2(title, soft) + '\n' + box(`display:flex;flex-direction:column;background:${C.white};border:1px solid ${C.line};border-radius:12px;overflow:hidden`,
        line(head, true) + '\n' + rows.map((r, i) => line(r, false, i === rows.length - 1)).join('\n')),
    });
  };

  const risks = (id, { tag, title, items, foot = '' }) => slide(id, {
    foot,
    body: pill(tag) + '\n' + h2(title) + '\n' + box('flex:1;display:grid;grid-template-columns:repeat(2, 1fr);grid-template-rows:repeat(2, 1fr);gap:16px', items.map(it => tile(C.white,
      h3(it[0], 38) + '\n' + p(it[1], 26, C.muted) + '\n<div style="flex:1"></div>' + '\n' + p(`<span style="font-family:${FD};color:${C.green}">Respuesta.</span> ${it[2]}`, 26), { pad: '28px 36px', gap: 10, flex: '' })).join('\n')),
  });

  return { C, AG, FD, FT, FB, on, onSoft, img, picto, pill, h2, h3, p, lab, ul, box, tile, row, col, slide, cover, statement, closing, split, agents, flow, bento, columns, numbers, timeline, stairs, compare, risks };
};
