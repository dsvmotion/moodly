const fs = require("fs");
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const d of process.argv.slice(2)) {
    const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await pg.goto('file://' + __dirname + '/' + d + '/preview.html');
    await pg.evaluate(() => document.fonts.ready);
    const secs = await pg.$$('section');
    const over = [];
    for (const s of secs) {
      const id = await s.getAttribute('id');
      await s.screenshot({ path: `${__dirname}/${d}/${id}.png` });
      const o = await s.evaluate(el => {
        const top = el.getBoundingClientRect().top;
        const kids = [...el.children].filter(c => getComputedStyle(c).position !== 'absolute' && c.tagName !== 'ASIDE');
        return Math.round(Math.max(...kids.map(c => c.getBoundingClientRect().bottom)) - top);
      });
      over.push(`${id}:${o}${o > 920 ? '!!' : ''}`);
    }
    console.log(d, over.join('  '));
    // contact sheets, 6 per sheet
    const ids = await pg.$$eval('section', ss => ss.map(s => s.id));
    for (let i = 0; i < ids.length; i += 6) {
      const sh = await b.newPage({ viewport: { width: 1940, height: 1110 } });
      fs.writeFileSync(`${__dirname}/${d}/sheet.html`, `<body style="margin:0;background:#666;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">${ids.slice(i, i + 6).map(x => `<img src="file://${__dirname}/${d}/${x}.png" style="width:100%">`).join('')}</body>`.split(`file://${__dirname}/${d}/`).join(""));
      await sh.goto(`file://${__dirname}/${d}/sheet.html`);
      await sh.screenshot({ path: `${__dirname}/${d}/sheet${i / 6}.png`, fullPage: true });
      await sh.close();
    }
  }
  await b.close();
})();
